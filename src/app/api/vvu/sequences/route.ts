import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appendWormEvent } from '@/lib/vvu-ledger';
import { OUTREACH_TENANT_ID } from '@/lib/vvu-data';
import { MAX_STEPS, NAME_MAX, parseSteps, serializeSequence } from '@/lib/outreach-engine';
import type { SequenceStep } from '@/types/vvu';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Round 17 — SEQUENCE CRUD. A sequence is product configuration (a cadence of
// steps), NOT personal data — so unlike targets, one DEFAULT cadence is seeded
// idempotently so the engine is immediately usable (and QA-able) without
// fabricating any contact rows. Deletion unassigns its targets first.

const DEFAULT_NAME = 'VVU PILOT 3-STEP';
const DEFAULT_STEPS: SequenceStep[] = [
  {
    day: 1,
    subject: '30-second supplier verification for {org}',
    angle: 'Warm intro: VVU City Digital Twin GIS + edge-AI monitoring; reference their critical issue; R5,000 30-day pilot.',
  },
  {
    day: 4,
    subject: 'The 135% B-BBEE recognition angle for {org}',
    angle: 'Case-study follow-up: Level 1 B-BBEE contributor (135% procurement recognition) + POPIA-compliant WORM audit ledger; no repetition of step 1.',
  },
  {
    day: 9,
    subject: 'Last nudge — pilot slot for {org}?',
    angle: 'Direct close: offer a 20-minute call to scope the R5,000 pilot; make it easy to say no so the sequence can rest.',
  },
];

async function seedDefaultIfEmpty() {
  const count = await db.outreachSequence.count({ where: { tenantId: OUTREACH_TENANT_ID } });
  if (count > 0) return;
  const row = await db.outreachSequence.create({
    data: {
      tenantId: OUTREACH_TENANT_ID,
      name: DEFAULT_NAME,
      stepsJson: JSON.stringify(DEFAULT_STEPS),
      active: true,
    },
  });
  await appendWormEvent({
    source: 'OUTREACH',
    event: 'OUTREACH_SEQUENCE_CREATED',
    details: `${row.name} · 3 steps · DEFAULT CADENCE (engine configuration, no personal data)`,
  });
}

// GET /api/vvu/sequences — list cadences (seeds the default once, idempotent).
export async function GET() {
  try {
    await seedDefaultIfEmpty();
    const rows = await db.outreachSequence.findMany({
      where: { tenantId: OUTREACH_TENANT_ID },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ sequences: rows.map(serializeSequence) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function parseBodySteps(raw: unknown): SequenceStep[] {
  if (!Array.isArray(raw)) {
    throw new Error('steps must be an array of { day, subject, angle }');
  }
  return parseSteps(JSON.stringify(raw)); // reuse strict validation
}

// POST /api/vvu/sequences — create a cadence.
export async function POST(req: NextRequest) {
  let body: { name?: string; steps?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  if (!name || name.length > NAME_MAX) {
    return NextResponse.json(
      { success: false, message: `name required, ≤ ${NAME_MAX} chars` },
      { status: 422 }
    );
  }

  let steps: SequenceStep[];
  try {
    steps = parseBodySteps(body.steps);
  } catch (e) {
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : 'invalid steps' },
      { status: 422 }
    );
  }

  try {
    const existing = await db.outreachSequence.findFirst({
      where: { tenantId: OUTREACH_TENANT_ID, name },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, message: `sequence "${name}" already exists` },
        { status: 409 }
      );
    }
    const row = await db.outreachSequence.create({
      data: { tenantId: OUTREACH_TENANT_ID, name, stepsJson: JSON.stringify(steps) },
    });
    await appendWormEvent({
      source: 'OUTREACH',
      event: 'OUTREACH_SEQUENCE_CREATED',
      details: `${row.name} · ${steps.length} steps · D${steps[0].day}→D${steps[steps.length - 1].day}`,
    });
    return NextResponse.json({ success: true, sequence: serializeSequence(row) }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/vvu/sequences — rename / retoggle / rewrite steps.
export async function PATCH(req: NextRequest) {
  let body: { id?: string; name?: string; active?: boolean; steps?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ success: false, message: 'Missing required field: id' }, { status: 422 });
  }

  const name = body.name?.trim();
  if (name !== undefined && (!name || name.length > NAME_MAX)) {
    return NextResponse.json(
      { success: false, message: `name must be 1–${NAME_MAX} chars` },
      { status: 422 }
    );
  }

  let steps: SequenceStep[] | undefined;
  if (body.steps !== undefined) {
    try {
      steps = parseBodySteps(body.steps);
    } catch (e) {
      return NextResponse.json(
        { success: false, message: e instanceof Error ? e.message : 'invalid steps' },
        { status: 422 }
      );
    }
  }

  try {
    const existing = await db.outreachSequence.findFirst({
      where: { id: body.id, tenantId: OUTREACH_TENANT_ID },
    });
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Sequence not found' }, { status: 404 });
    }
    if (name !== undefined && name !== existing.name) {
      const clash = await db.outreachSequence.findFirst({
        where: { tenantId: OUTREACH_TENANT_ID, name },
      });
      if (clash) {
        return NextResponse.json(
          { success: false, message: `sequence "${name}" already exists` },
          { status: 409 }
        );
      }
    }
    const row = await db.outreachSequence.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
        ...(steps !== undefined ? { stepsJson: JSON.stringify(steps) } : {}),
      },
    });
    await appendWormEvent({
      source: 'OUTREACH',
      event: 'OUTREACH_SEQUENCE_UPDATED',
      details: `${row.name} · ${steps ? `${steps.length} steps (rewritten)` : name ? `renamed from ${existing.name}` : row.active ? 'activated' : 'deactivated'}`,
    });
    return NextResponse.json({ success: true, sequence: serializeSequence(row) });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/vvu/sequences — unassign targets, then delete.
export async function DELETE(req: NextRequest) {
  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ success: false, message: 'Missing required field: id' }, { status: 422 });
  }
  try {
    const existing = await db.outreachSequence.findFirst({
      where: { id: body.id, tenantId: OUTREACH_TENANT_ID },
    });
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Sequence not found' }, { status: 404 });
    }
    const assigned = await db.outreachTarget.count({ where: { sequenceId: existing.id } });
    if (assigned > 0) {
      await db.outreachTarget.updateMany({
        where: { sequenceId: existing.id },
        data: { sequenceId: null },
      });
    }
    await db.outreachSequence.delete({ where: { id: existing.id } });
    await appendWormEvent({
      source: 'OUTREACH',
      event: 'OUTREACH_SEQUENCE_DELETED',
      details: `${existing.name} · ${assigned} targets unassigned`,
    });
    return NextResponse.json({ success: true, unassigned: assigned });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
