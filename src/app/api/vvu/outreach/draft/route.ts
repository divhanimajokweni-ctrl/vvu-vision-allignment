import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appendWormEvent } from '@/lib/vvu-ledger';
import { OUTREACH_ASSET_BASE } from '@/lib/outreach-template';
import { buildSequenceHtml } from '@/lib/outreach-template';
import { generatePersonalised } from '@/lib/outreach-engine';
import { OUTREACH_TENANT_ID } from '@/lib/vvu-data';
import type { DraftResponse } from '@/types/vvu';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Round 17 — POST /api/vvu/outreach/draft
// Compose (but do NOT send or store) the personalised email for one target +
// one sequence step. AI personalisation runs HERE on the server via
// z-ai-web-dev-sdk — there is no client-side key and never will be; the
// response only reports source: 'ai' | 'template'.
//
// POPIA s69: composing for a NONE-consent target is refused exactly like a
// send (the Round 14 posture — the gate refuses regardless of mode) and the
// refusal is WORM-logged.

interface DraftApiError {
  success: false;
  blocked?: boolean;
  message: string;
}

export async function POST(req: NextRequest) {
  let body: { targetId?: string; sequenceId?: string; stepIndex?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' } satisfies DraftApiError, { status: 400 });
  }

  const { targetId, sequenceId } = body;
  const stepIndex = Number(body.stepIndex);
  if (!targetId || !sequenceId || !Number.isInteger(stepIndex) || stepIndex < 0) {
    return NextResponse.json(
      { success: false, message: 'required: targetId, sequenceId, stepIndex ≥ 0' } satisfies DraftApiError,
      { status: 422 }
    );
  }

  try {
    const target = await db.outreachTarget.findFirst({
      where: { id: targetId, tenantId: OUTREACH_TENANT_ID },
    });
    if (!target) {
      return NextResponse.json({ success: false, message: 'Target not found' } satisfies DraftApiError, { status: 404 });
    }
    const sequence = await db.outreachSequence.findFirst({
      where: { id: sequenceId, tenantId: OUTREACH_TENANT_ID },
    });
    if (!sequence) {
      return NextResponse.json({ success: false, message: 'Sequence not found' } satisfies DraftApiError, { status: 404 });
    }
    let steps;
    try {
      steps = JSON.parse(sequence.stepsJson) as { day: number; subject: string; angle: string }[];
    } catch {
      return NextResponse.json({ success: false, message: 'Sequence steps unreadable' } satisfies DraftApiError, { status: 500 });
    }
    const step = steps[stepIndex];
    if (!step) {
      return NextResponse.json(
        { success: false, message: `stepIndex ${stepIndex} out of range (0–${steps.length - 1})` } satisfies DraftApiError,
        { status: 422 }
      );
    }

    // POPIA s69 gate — refuse composition without a consent basis.
    if (target.consentBasis === 'NONE') {
      const worm = await appendWormEvent({
        source: 'OUTREACH',
        event: 'OUTREACH_BLOCKED',
        details: `${target.org} · ${target.email} · POPIA s69: no consent basis — draft refused`,
      });
      return NextResponse.json(
        {
          success: false,
          blocked: true,
          wormSeq: worm.seq,
          message: 'POPIA s69: no consent basis — draft refused. Set OPT_IN or EXISTING_CUSTOMER first.',
        } satisfies DraftApiError & { wormSeq?: number },
        { status: 451 }
      );
    }

    // Subjects already sent to this contact (avoid repetition) — OutreachEmail
    // rows with this target + stepIndex, ascending.
    const prior = await db.outreachEmail.findMany({
      where: { targetId: target.id },
      orderBy: { createdAt: 'asc' },
    });
    const previousSubjects = prior.map((e) => e.subject);

    const draft = await generatePersonalised({
      target: {
        contactName: target.contactName,
        org: target.org,
        criticalIssue: target.criticalIssue,
      },
      step,
      stepNumber: stepIndex + 1,
      stepCount: steps.length,
      previousSubjects,
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

    // WORM evidence of composition (not a send): org + step + source only.
    await appendWormEvent({
      source: 'OUTREACH',
      event: 'OUTREACH_DRAFT',
      details: `${target.org} · ${stepLabel} · ${draft.source === 'ai' ? 'AI-PERSONALISED' : 'TEMPLATE'} · composed, not sent`,
    });

    const response: DraftResponse = {
      subject: draft.subject,
      bodyText: draft.bodyText,
      bodyHtml: html,
      source: draft.source,
      stepLabel,
    };
    return NextResponse.json({ success: true, draft: response });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : 'Unknown error' } satisfies DraftApiError,
      { status: 500 }
    );
  }
}
