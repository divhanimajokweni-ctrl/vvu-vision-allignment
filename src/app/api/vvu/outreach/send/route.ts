import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appendWormEvent } from '@/lib/vvu-ledger';
import { buildHtml, buildSubject, OUTREACH_ASSET_BASE, OUTREACH_FROM } from '@/lib/outreach-template';
import { OUTREACH_TENANT_ID } from '@/lib/vvu-data';
import type { OutreachSendResponse, OutreachSendResult, OutreachSendPreview } from '@/types/vvu';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/vvu/outreach/send — the PILOT OUTREACH send engine.
//
// COMPLIANCE RULES, EVALUATED IN ORDER (non-negotiable):
//  (a) no RESEND_API_KEY in env + not dryRun → 501, real sends refused.
//      The key is read from env ONLY; it is never logged or echoed —
//      the API surface exposes resendConfigured as a BOOLEAN.
//  (b) target selection (explicit ids or the full tenant list), capped at
//      10 per call (400 when exceeded).
//  (c) POPIA s69 gate: consentBasis NONE → OutreachEmail BLOCKED +
//      "POPIA s69: no consent basis — send refused", WORM OUTREACH_BLOCKED,
//      target status BLOCKED. Runs for dry-runs too — the gate refuses
//      regardless of send mode.
//  (d) dryRun → render subject+html, store DRY_RUN rows, return previews.
//  (e) real send (only reachable with a key) → POST https://api.resend.com/emails
//      via fetch (no SDK), Bearer key from env; SENT/FAILED per outcome,
//      WORM OUTREACH_EMAIL with org + status (never the key).

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
}

export async function POST(req: NextRequest) {
  let body: { targetIds?: string[]; dryRun?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }
  const dryRun = body.dryRun === true;
  const resendConfigured = Boolean(process.env.RESEND_API_KEY);

  // (a) real sends are impossible without the key — DRY-RUN only.
  if (!resendConfigured && !dryRun) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY not configured — DRY-RUN only', resendConfigured: false },
      { status: 501 }
    );
  }

  try {
    // (b) selection: explicit ids (tenant-scoped) or the full tenant list.
    let targets: TargetRow[];
    if (Array.isArray(body.targetIds) && body.targetIds.length > 0) {
      if (body.targetIds.length > BATCH_CAP) {
        return NextResponse.json(
          { error: `batch cap exceeded — max ${BATCH_CAP} targets per send call` },
          { status: 400 }
        );
      }
      targets = await db.outreachTarget.findMany({
        where: { tenantId: OUTREACH_TENANT_ID, id: { in: body.targetIds } },
      });
    } else {
      targets = await db.outreachTarget.findMany({ where: { tenantId: OUTREACH_TENANT_ID } });
    }
    if (targets.length > BATCH_CAP) {
      return NextResponse.json(
        { error: `batch cap exceeded — max ${BATCH_CAP} targets per send call` },
        { status: 400 }
      );
    }
    if (targets.length === 0) {
      const empty: OutreachSendResponse = { dryRun, previews: [], results: [], blocked: 0, sent: 0, failed: 0 };
      return NextResponse.json({ ...empty, message: 'no targets selected' });
    }

    const previews: OutreachSendPreview[] = [];
    const results: OutreachSendResult[] = [];
    let blocked = 0;
    let sent = 0;
    let failed = 0;

    for (const target of targets) {
      // (c) POPIA s69 gate — refuse BEFORE any rendering or network I/O.
      if (target.consentBasis === 'NONE') {
        const worm = await appendWormEvent({
          source: 'OUTREACH',
          event: 'OUTREACH_BLOCKED',
          details: `${target.org} · ${target.email} · POPIA s69: no consent basis — send refused`,
        });
        await db.outreachEmail.create({
          data: {
            targetId: target.id,
            subject: buildSubject(target),
            status: 'BLOCKED',
            error: 'POPIA s69: no consent basis — send refused',
            wormSeq: worm.seq,
          },
        });
        await db.outreachTarget.update({ where: { id: target.id }, data: { status: 'BLOCKED' } });
        blocked++;
        results.push({ org: target.org, email: target.email, status: 'BLOCKED', error: 'POPIA s69: no consent basis — send refused' });
        continue;
      }

      const subject = buildSubject(target);
      const html = buildHtml(target, OUTREACH_ASSET_BASE);

      if (dryRun) {
        // (d) dry-run: store the preview, touch nothing external.
        await db.outreachEmail.create({
          data: { targetId: target.id, subject, status: 'DRY_RUN' },
        });
        await db.outreachTarget.update({ where: { id: target.id }, data: { status: 'PREVIEWED' } });
        previews.push({ org: target.org, email: target.email, subject, html });
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
          body: JSON.stringify({ from: OUTREACH_FROM, to: target.email, subject, html }),
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

      // WORM evidence: org + status only — NEVER the key or its value.
      const worm = await appendWormEvent({
        source: 'OUTREACH',
        event: 'OUTREACH_EMAIL',
        details: `${target.org} · ${target.email} · ${sendError ? 'FAILED' : 'SENT'}${resendId ? ` · RESEND ${resendId.slice(0, 24)}` : ''}`,
      });

      if (sendError === null && resendId !== null) {
        await db.outreachEmail.create({
          data: {
            targetId: target.id,
            subject,
            status: 'SENT',
            resendId,
            wormSeq: worm.seq,
            sentAt: new Date(),
          },
        });
        await db.outreachTarget.update({ where: { id: target.id }, data: { status: 'CONTACTED' } });
        sent++;
        results.push({ org: target.org, email: target.email, status: 'SENT' });
      } else {
        await db.outreachEmail.create({
          data: {
            targetId: target.id,
            subject,
            status: 'FAILED',
            error: sendError ?? 'send failed',
            wormSeq: worm.seq,
          },
        });
        failed++;
        results.push({ org: target.org, email: target.email, status: 'FAILED', error: sendError ?? 'send failed' });
      }
    }

    const response: OutreachSendResponse = { dryRun, previews, results, blocked, sent, failed };
    return NextResponse.json(response);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
