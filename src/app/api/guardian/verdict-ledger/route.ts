// src/app/api/guardian/verdict-ledger/route.ts — R80 · the verdict readings ledger.
// ─────────────────────────────────────────────────────────────────────────────
//   GET  → the recorded readings, newest first (+ total + corrupt count).
//          READ-ONLY: a ledger read writes nothing.
//   POST → record ONE reading. The client sends NO numbers — the route
//          re-reads the plateau scope and the in-process traffic counter and
//          classifies through the shared tier engine, so a row can never
//          claim anything the server cannot reproduce. 60s cooldown per boot
//          pid (409 with the last row's time — refused rows are not written).
//
// The trend this ledger enables is R78's stated calibration need: the ratio
// of one boot is a reading; the TREND of the ratio across boots is the
// signal (compile/HMR-driven vs request-driven).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';

import { recordVerdictReading, readVerdictLedger, viaFromHeader } from '@/server/guardian/verdict-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ledger = readVerdictLedger();
    return NextResponse.json({ ok: true, ledger }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'verdict ledger read failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function POST(req: Request) {
  try {
    // R99 — provenance: the guardian's auto-pair marks its triggers with
    // X-VVU-Auto: guardian; everything else is the operator's hand. The
    // header decides ONLY the row's via field — the numbers stay
    // server-derived, exactly as they were for the button.
    const outcome = recordVerdictReading(viaFromHeader(req.headers.get('x-vvu-auto')));
    if (outcome.ok) {
      return NextResponse.json(
        { ok: true, row: outcome.row, ledgerTotal: outcome.ledgerTotal },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: outcome.error,
        ...(outcome.status === 409 ? { lastRowAt: outcome.lastRowAt, retryableAfterSec: outcome.retryableAfterSec } : {}),
      },
      { status: outcome.status, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'verdict ledger record failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
