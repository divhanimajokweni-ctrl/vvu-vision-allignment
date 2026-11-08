import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { appendWormEvent } from '@/lib/vvu-ledger';
import {
  BOTTLENECKS,
  FACULTY_MAP,
  LEAVE_BEHIND,
  TRUST_BOTTLENECKS,
  WOULD_USE_ANSWERS,
} from '@/lib/fieldkit';
import type {
  FieldKitCapture,
  FieldKitResponse,
  FieldKitStats,
  TrustBottleneck,
  WouldUseAnswer,
} from '@/types/vvu';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// /api/vvu/fieldkit — Round 29 FIELD KIT backing route.
//   GET    → kit content (leave-behind, bottlenecks, faculty map) + persisted
//            captures + computed stats (the Q3 trust-condition digest).
//   POST   → save one CAPTURE TEMPLATE row (a "people note" from a campus
//            walk) — WORM FIELDKIT_CAPTURE_SAVED. Server recomputes nothing
//            about the conversation; it stores what the operator wrote.
//   DELETE → ?id= removes a capture (typo/privacy takedown) — WORM-logged
//            (the WORM row itself is immutable, by design).

type CaptureRow = {
  id: string;
  lecturer: string;
  faculty: string;
  field: string | null;
  q1Unverifiable: string;
  q2FailurePath: string;
  q3TrustCondition: string;
  dominantBottleneck: string;
  wouldUse: string;
  offered: string | null;
  followUp: string | null;
  wormSeq: number | null;
  createdAt: Date;
};

function serialize(row: CaptureRow): FieldKitCapture {
  return {
    id: row.id,
    lecturer: row.lecturer,
    faculty: row.faculty,
    field: row.field,
    q1Unverifiable: row.q1Unverifiable,
    q2FailurePath: row.q2FailurePath,
    q3TrustCondition: row.q3TrustCondition,
    dominantBottleneck: (TRUST_BOTTLENECKS as readonly string[]).includes(row.dominantBottleneck)
      ? (row.dominantBottleneck as TrustBottleneck)
      : 'INSTITUTIONAL_TRUST',
    wouldUse: (WOULD_USE_ANSWERS as readonly string[]).includes(row.wouldUse)
      ? (row.wouldUse as WouldUseAnswer)
      : 'MAYBE',
    offered: row.offered,
    followUp: row.followUp,
    wormSeq: row.wormSeq,
    createdAt: row.createdAt.toISOString(),
  };
}

function computeStats(rows: CaptureRow[]): FieldKitStats {
  const captures = rows.map(serialize);
  const byBottleneck = TRUST_BOTTLENECKS.map((key) => ({
    key,
    count: captures.filter((c) => c.dominantBottleneck === key).length,
  }));
  const byWouldUse = WOULD_USE_ANSWERS.map((key) => ({
    key,
    count: captures.filter((c) => c.wouldUse === key).length,
  }));
  const facultyCounts = new Map<string, number>();
  for (const c of captures) facultyCounts.set(c.faculty, (facultyCounts.get(c.faculty) ?? 0) + 1);
  return {
    captures: captures.length,
    byBottleneck,
    byWouldUse,
    byFaculty: Array.from(facultyCounts.entries())
      .map(([faculty, count]) => ({ faculty, count }))
      .sort((a, b) => b.count - a.count),
    trustConditions: captures.map((c) => ({
      lecturer: c.lecturer,
      faculty: c.faculty,
      condition: c.q3TrustCondition,
    })),
  };
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const rows = await db.fieldKitCapture.findMany({ orderBy: { createdAt: 'desc' } });
    const body: FieldKitResponse = {
      captures: rows.map(serialize),
      stats: computeStats(rows),
      facultyMap: [...FACULTY_MAP],
      bottlenecks: [...BOTTLENECKS],
      leaveBehind: LEAVE_BEHIND,
    };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}

// ─── POST (capture save) ─────────────────────────────────────────────────────

const captureSchema = z.object({
  lecturer: z.string().trim().min(2, 'lecturer name too short').max(120),
  faculty: z.string().trim().min(2).max(120),
  field: z.string().trim().max(160).optional().nullable(),
  q1Unverifiable: z.string().trim().min(4, 'Q1 answer required').max(2000),
  q2FailurePath: z.string().trim().min(4, 'Q2 answer required').max(2000),
  q3TrustCondition: z.string().trim().min(4, 'Q3 trust condition required — write down every word').max(2000),
  dominantBottleneck: z.enum(TRUST_BOTTLENECKS as unknown as [string, ...string[]]),
  wouldUse: z.enum(WOULD_USE_ANSWERS as unknown as [string, ...string[]]),
  offered: z.string().trim().max(600).optional().nullable(),
  followUp: z.string().trim().max(600).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const parsed = captureSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', issues: parsed.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`) },
        { status: 422 },
      );
    }
    const v = parsed.data;
    const row = await db.fieldKitCapture.create({
      data: {
        lecturer: v.lecturer,
        faculty: v.faculty,
        field: v.field?.trim() ? v.field.trim() : null,
        q1Unverifiable: v.q1Unverifiable,
        q2FailurePath: v.q2FailurePath,
        q3TrustCondition: v.q3TrustCondition,
        dominantBottleneck: v.dominantBottleneck,
        wouldUse: v.wouldUse,
        offered: v.offered?.trim() ? v.offered.trim() : null,
        followUp: v.followUp?.trim() ? v.followUp.trim() : null,
      },
    });
    const entry = await appendWormEvent({
      source: 'FIELDKIT',
      event: 'FIELDKIT_CAPTURE_SAVED',
      details: `lecturer=${row.lecturer} · faculty=${row.faculty} · bottleneck=${row.dominantBottleneck} · wouldUse=${row.wouldUse} · q3="${row.q3TrustCondition.slice(0, 90)}"`,
    });
    await db.fieldKitCapture.update({ where: { id: row.id }, data: { wormSeq: entry.seq } });
    return NextResponse.json({ capture: serialize({ ...row, wormSeq: entry.seq }), wormSeq: entry.seq }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}

// ─── DELETE (takedown) ───────────────────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'MISSING_ID' }, { status: 422 });
    const row = await db.fieldKitCapture.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    await db.fieldKitCapture.delete({ where: { id } });
    await appendWormEvent({
      source: 'FIELDKIT',
      event: 'FIELDKIT_CAPTURE_REMOVED',
      details: `lecturer=${row.lecturer} · faculty=${row.faculty} · operator takedown (WORM row remains, by design)`,
    });
    return NextResponse.json({ removed: id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
