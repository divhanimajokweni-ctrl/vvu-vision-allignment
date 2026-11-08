// src/app/api/safegrid/inbox/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// VVU INBOX — the consumer boundary of the SafeGrid → VVU pipeline.
//
// POST /api/safegrid/inbox — the relay target. Contract:
//   200 {status:'sealed'}                    first terminal seal
//   200 {status:'duplicate'}                 already sealed (idempotent —
//                                             duplicate arrival is 2xx so
//                                             the relay can mark delivered)
//   400 {error:'SEQUENCE_FIELD_FORBIDDEN'…}  contract violation (permanent)
//   500 {error:'SEAL_FAILED'}                transient — relay retries, the
//                                             reconciler backstops
//
// GET /api/safegrid/inbox?status=&limit= — recent rows for the workspace.
//
// Every POST also lazily ensures the reconciler worker is running
// (belt-and-braces alongside instrumentation.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { IngestSealError, IngestValidationError, ingestEvent, validateEnvelope } from '@/server/safegrid/ingest';
import { startReconcilerWorker } from '@/server/safegrid/worker';
import type { InboxRowView, InboxStatus } from '@/lib/safegrid/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  startReconcilerWorker();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_JSON', message: 'body must be JSON' }, { status: 400 });
  }
  let envelope;
  try {
    envelope = validateEnvelope(body);
  } catch (e) {
    if (e instanceof IngestValidationError) {
      return NextResponse.json({ ok: false, error: e.code, message: e.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: 'VALIDATION_REJECTED' }, { status: 400 });
  }
  try {
    const result = await ingestEvent(db, envelope);
    if (result.outcome === 'duplicate') {
      return NextResponse.json({
        ok: true,
        status: 'duplicate',
        seal_ref: result.inbox.sealRef,
        message: 'event already sealed — idempotent duplicate',
      });
    }
    return NextResponse.json({
      ok: true,
      status: 'sealed',
      appended: result.appended,
      seal_ref: `${result.seal.streamId}#${result.seal.position}`,
      position: result.seal.position.toString(),
      record_hash: result.seal.recordHash,
    });
  } catch (e) {
    if (e instanceof IngestSealError) {
      return NextResponse.json(
        { ok: false, error: 'SEAL_FAILED', message: e.message },
        { status: 500 },
      );
    }
    console.error('[safegrid-inbox] unexpected error:', e);
    return NextResponse.json({ ok: false, error: 'INTERNAL' }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  startReconcilerWorker();
  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const limitRaw = Number(url.searchParams.get('limit') ?? 50);
  const limit = Number.isSafeInteger(limitRaw) && limitRaw > 0 && limitRaw <= 200 ? limitRaw : 50;
  const where = statusParam && ['received', 'sealing', 'sealed', 'seal_failed'].includes(statusParam)
    ? { status: statusParam as InboxStatus }
    : {};
  const rows = await db.safegridInbox.findMany({
    where,
    orderBy: { receivedAt: 'desc' }, // informational display order, NOT chain order
    take: limit,
  });
  const counts = await db.safegridInbox.groupBy({ by: ['status'], _count: { _all: true } });
  const view: InboxRowView[] = rows.map((r) => ({
    id: r.id,
    consumerName: r.consumerName,
    eventId: r.eventId,
    eventType: r.eventType,
    streamId: r.streamId,
    status: r.status as InboxStatus,
    receivedAt: r.receivedAt.toISOString(),
    sealAttempts: r.sealAttempts,
    lastSealError: r.lastSealError,
    sealedAt: r.sealedAt ? r.sealedAt.toISOString() : null,
    sealRef: r.sealRef,
  }));
  return NextResponse.json({
    ok: true,
    rows: view,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
  });
}
