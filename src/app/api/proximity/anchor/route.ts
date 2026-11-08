// src/app/api/proximity/anchor/route.ts
// EXTERNAL HEAD ANCHORING EXPOSED — GET replays every anchor against the
// live chain (the continuity ledger); POST anchors the current verified head.

import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { AnchorRefusedError, anchorLedger, anchorNow } from '@/server/proximity/anchor';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ledger = await anchorLedger(db);
  return NextResponse.json({ ok: ledger.continuity !== 'DRIFT', ledger });
}

export async function POST(request: Request) {
  let note = '';
  try {
    const body = (await request.json()) as { note?: string };
    note = typeof body?.note === 'string' ? body.note : '';
  } catch {
    /* note optional */
  }
  try {
    const result = await anchorNow(db, note);
    const ledger = await anchorLedger(db);
    return NextResponse.json({ ok: true, ...result, ledger });
  } catch (e) {
    if (e instanceof AnchorRefusedError) {
      return NextResponse.json({ ok: false, code: e.code, error: e.message }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'anchor failed' }, { status: 500 });
  }
}
