// src/app/api/proximity/tamper/route.ts
// THE ONE BUTTON — rewrite the stored canonical bytes of a sealed
// SIMULATOR record. Production sources are refused with 403
// PRODUCTION_IMMUTABLE (the boundary is a stored column read at tamper
// time — there is no flag).

import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { BoundaryViolationError, TamperError, tamperSealedRecord } from '@/server/proximity/tamper';

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
    const result = await tamperSealedRecord(db, eventId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof BoundaryViolationError) {
      return NextResponse.json(
        { ok: false, code: e.code, error: e.code, detail: e.message, eventId },
        { status: 403 },
      );
    }
    if (e instanceof TamperError) {
      return NextResponse.json(
        { ok: false, code: e.code, error: e.code, detail: e.message, eventId },
        { status: e.code === 'NOT_FOUND' ? 404 : 409 },
      );
    }
    return NextResponse.json(
      { ok: false, error: 'TAMPER_FAILED', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
