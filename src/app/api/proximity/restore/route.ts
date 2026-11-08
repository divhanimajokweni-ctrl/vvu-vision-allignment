// src/app/api/proximity/restore/route.ts
// Restore a tampered simulator seal: rebuild the original bytes from the
// untampered record row through the same canonicalizer, assert the digest
// matches, write back. The chain returns to VALID because the bytes are
// the bytes that were sealed — not because the verifier was told to look
// away.

import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { BoundaryViolationError, TamperError, restoreSealedRecord } from '@/server/proximity/tamper';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  let body: { eventId?: unknown };
  try {
    body = (await request.json()) as { eventId?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_JSON', detail: 'request body must be JSON' }, { status: 400 });
  }
  const eventId = body.eventId;
  if (typeof eventId !== 'string' || eventId.length === 0) {
    return NextResponse.json({ ok: false, error: 'BAD_EVENT_ID', detail: 'eventId is required' }, { status: 400 });
  }
  try {
    const result = await restoreSealedRecord(db, eventId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof BoundaryViolationError) {
      return NextResponse.json({ ok: false, code: e.code, error: e.code, detail: e.message, eventId }, { status: 403 });
    }
    if (e instanceof TamperError) {
      return NextResponse.json(
        { ok: false, code: e.code, error: e.code, detail: e.message, eventId },
        { status: e.code === 'NOT_FOUND' ? 404 : 409 },
      );
    }
    return NextResponse.json(
      { ok: false, error: 'RESTORE_FAILED', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
