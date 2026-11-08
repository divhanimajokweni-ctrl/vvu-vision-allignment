import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appendWormEvent } from '@/lib/vvu-ledger';
import { OUTREACH_ASSET_BASE, OUTREACH_FROM, buildSequenceHtml } from '@/lib/outreach-template';
import { generatePersonalised } from '@/lib/outreach-engine';
import { OUTREACH_TENANT_ID } from '@/lib/vvu-data';
import type { StepSendResponse, StepSendPreview, OutreachSendResult } from '@/types/vvu';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Round 17 — POST /api/vvu/outreach/send-step — the SEQUENCE ENGINE sender.
//
// COMPLIANCE RULES, EVALUATED IN ORDER (identical posture to /send):
//  (a) no RESEND_API_KEY + not dryRun → 501, real sends refused. The key is
//      read from env ONLY — never logged, never echoed.
//  (b) batch cap 10 targets per call (explicit ids, or all assigned to the
//      sequence that are not CLOSED).
//  (c) POPIA s69 gate: consentBasis NONE → BLOCKED email row + WORM + target
//      status BLOCKED — refuses regardless of send mode.
//  (d) dryRun → compose (AI personalisation server-side), store DRY_RUN rows
//      with the composed body as evidence, return previews.
//  (e) real send → Resend REST via fetch; SENT/FAILED per outcome with the
//      personalised body stored; target → SENT + currentStep = stepIndex.
//
// The AI runs on the SERVER (z-ai-web-dev-sdk); no key ever reaches the
// client. Personalised bodies are HTML-escaped by buildSequenceHtml.

const BATCH_CAP = 10;
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

interface TargetRow {
  id: string;
  org: string;
  contactName: string;
  email: string;
  criticalIssue: string | null;
  consentBasis: string;
  status: string;
  currentStep: number;
}

export async function POST(req: NextRequest) {
  let body: { targetIds?: string[]; sequenceId?: string; stepIndex?: number; dryRun?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const { sequenceId } = body;
  const stepIndex = Number(body.stepIndex);
  const dryRun = body.dryRun === true;
  const resendConfigured = Boolean(process.env.RESEND_API_KEY);

  if (!sequenceId || !Number.isInteger(stepIndex) || stepIndex < 0) {
    return NextResponse.json(
      { success: false, message: 'required: sequenceId, stepIndex ≥ 0' },
      { status: 422 }
    );
  }

  // (a) real sends impossible without the key — DRY-RUN only.
  if (!resendConfigured && !dryRun) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY not configured — DRY-RUN only', resendConfigured: false },
      { status: 501 }
    );
  }

  try {
    const sequence = await db.outreachSequence.findFirst({
      where: { id: sequenceId, tenantId: OUTREACH_TENANT_ID },
    });
    if (!sequence) {
      return NextResponse.json({ success: false, message: 'Sequence not found' }, { status: 404 });
    }
    let steps: { day: number; subject: string; angle: string }[];
    try {
      steps = JSON.parse(sequence.stepsJson) as { day: number; subject: string; angle: string }[];
    } catch {
      return NextResponse.json({ success: false, message: 'Sequence steps unreadable' }, { status: 500 });
    }
    const step = steps[stepIndex];
    if (!step) {
      return NextResponse.json(
        { success: false, message: `stepIndex ${stepIndex} out of range (0–${steps.length - 1})` },
        { status: 422 }
      );
    }

    // (b) selection: explicit ids (tenant + assignment scoped) or every
    // assigned, non-CLOSED target of the sequence. Cap 10.
    let targets: TargetRow[];
    if (Array.isArray(body.targetIds) && body.targetIds.length > 0) {
      targets = await db.outreachTarget.findMany({
        where: { tenantId: OUTREACH_TENANT_ID, id: { in: body.targetIds }, sequenceId },
      });
      const missing = body.targetIds.filter((id) => !targets.some((t) => t.id === id));
      if (missing.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `${missing.length} target(s) not assigned to ${sequence.name} — assign them first`,
          },
          { status: 422 }
        );
      }
    } else {
      targets = await db.outreachTarget.findMany({
        where: { tenantId: OUTREACH_TENANT_ID, sequenceId, status: { not: 'CLOSED' } },
        orderBy: { createdAt: 'asc' },
        take: BATCH_CAP,
      });
    }
    if (targets.length > BATCH_CAP) {
      return NextResponse.json(
        { success: false, message: `batch cap exceeded — max ${BATCH_CAP} targets per call` },
        { status: 400 }
      );
    }
    if (targets.length === 0) {
      const empty: StepSendResponse = { dryRun, previews: [], results: [], blocked: 0, sent: 0, failed: 0 };
      return NextResponse.json({ ...empty, message: 'no targets selected' });
    }

    // Subjects already sent per target — anti-repetition context for the AI.
    const priorRows = await db.outreachEmail.findMany({
      where: { targetId: { in: targets.map((t) => t.id) } },
      orderBy: { createdAt: 'asc' },
    });
    const priorByTarget = new Map<string, string[]>();
    for (const row of priorRows) {
      const list = priorByTarget.get(row.targetId) ?? [];
      list.push(row.subject);
      priorByTarget.set(row.targetId, list);
    }

    const previews: StepSendPreview[] = [];
    const results: OutreachSendResult[] = [];
    let blocked = 0;
    let sent = 0;
    let failed = 0;

    for (const target of targets) {
      // (c) POPIA s69 gate — refuse BEFORE any composition or network I/O.
      if (target.consentBasis === 'NONE') {
        const worm = await appendWormEvent({
          source: 'OUTREACH',
          event: 'OUTREACH_BLOCKED',
          details: `${target.org} · ${target.email} · POPIA s69: no consent basis — send refused`,
        });
        await db.outreachEmail.create({
          data: {
            targetId: target.id,
            subject: step.subject,
            status: 'BLOCKED',
            error: 'POPIA s69: no consent basis — send refused',
            stepIndex,
            wormSeq: worm.seq,
          },
        });
        await db.outreachTarget.update({ where: { id: target.id }, data: { status: 'BLOCKED' } });
        blocked++;
        results.push({
          org: target.org,
          email: target.email,
          status: 'BLOCKED',
          error: 'POPIA s69: no consent basis — send refused',
        });
        continue;
      }

      // Personalised draft — server-side AI with deterministic fallback.
      const draft = await generatePersonalised({
        target: {
          contactName: target.contactName,
          org: target.org,
          criticalIssue: target.criticalIssue,
        },
        step,
        stepNumber: stepIndex + 1,
        stepCount: steps.length,
        previousSubjects: priorByTarget.get(target.id) ?? [],
      });

      const stepLabel = `STEP ${stepIndex + 1}/${steps.length} · DAY ${step.day}`;
      const html = buildSequenceHtml(
        {
          org: target.org,
          contactName: target.contactName,
          subject: draft.subject,
          bodyText: draft.bodyText,
          aiGenerated: draft.source === 'ai',
          stepLabel,
        },
        OUTREACH_ASSET_BASE
      );

      if (dryRun) {
        // (d) dry-run: store the composed draft as evidence, touch nothing.
        await db.outreachEmail.create({
          data: {
            targetId: target.id,
            subject: draft.subject,
            status: 'DRY_RUN',
            stepIndex,
            bodyHtml: html,
            aiGenerated: draft.source === 'ai',
          },
        });
        await db.outreachTarget.update({
          where: { id: target.id },
          data: { ...(target.status === 'NEW' ? { status: 'PREVIEWED' } : {}) },
        });
        previews.push({ org: target.org, email: target.email, subject: draft.subject, html, source: draft.source, stepLabel });
        results.push({ org: target.org, email: target.email, status: 'DRY_RUN' });
        continue;
      }

      // (e) real send — only reachable when the key exists.
      let resendId: string | null = null;
      let sendError: string | null = null;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15_000);
        const res = await fetch(RESEND_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: OUTREACH_FROM,
            to: target.email,
            subject: draft.subject,
            html,
            headers: { 'X-Entity-Ref-ID': target.id },
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        const payload = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
        if (res.ok && payload?.id) {
          resendId = payload.id;
        } else {
          sendError = payload?.message?.slice(0, 300) ?? `Resend HTTP ${res.status}`;
        }
      } catch (err) {
        sendError = err instanceof Error ? err.message.slice(0, 300) : 'Resend request failed';
      }

      // WORM evidence: org + step + source + status — NEVER the key.
      const worm = await appendWormEvent({
        source: 'OUTREACH',
        event: sendError === null && resendId !== null ? 'OUTREACH_SENT' : 'OUTREACH_SEND_FAILED',
        details:
          sendError === null && resendId !== null
            ? `${target.org} · ${target.email} · ${stepLabel} · ${draft.source === 'ai' ? 'AI-PERSONALISED' : 'TEMPLATE'}${resendId ? ` · RESEND ${resendId.slice(0, 24)}` : ''}`
            : `${target.org} · ${target.email} · ${stepLabel} · FAILED · ${sendError ?? 'send failed'}`,
      });

      if (sendError === null && resendId !== null) {
        await db.outreachEmail.create({
          data: {
            targetId: target.id,
            subject: draft.subject,
            status: 'SENT',
            resendId,
            stepIndex,
            bodyHtml: html,
            aiGenerated: draft.source === 'ai',
            wormSeq: worm.seq,
            sentAt: new Date(),
          },
        });
        await db.outreachTarget.update({
          where: { id: target.id },
          data: {
            status: 'SENT',
            currentStep: Math.max(target.currentStep, stepIndex),
          },
        });
        sent++;
        results.push({ org: target.org, email: target.email, status: 'SENT' });
      } else {
        await db.outreachEmail.create({
          data: {
            targetId: target.id,
            subject: draft.subject,
            status: 'FAILED',
            error: sendError ?? 'send failed',
            stepIndex,
            bodyHtml: html,
            aiGenerated: draft.source === 'ai',
            wormSeq: worm.seq,
          },
        });
        failed++;
        results.push({ org: target.org, email: target.email, status: 'FAILED', error: sendError ?? 'send failed' });
      }
    }

    const response: StepSendResponse = { dryRun, previews, results, blocked, sent, failed };
    return NextResponse.json(response);
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
