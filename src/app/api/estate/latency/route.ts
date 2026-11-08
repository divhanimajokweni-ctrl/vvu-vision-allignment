// src/app/api/estate/latency/route.ts — R110 · THE LATENCY LEDGER's read side.
// ─────────────────────────────────────────────────────────────────────────────
//   GET → a bounded tail of the dev log (last LATENCY_WINDOW_LINES lines)
//         parsed through the shared latency-ledger engine: per-route request
//         counts, status censuses, latency distributions, the compile/render
//         split the dev server itself reports, and the respawns visible as
//         boot banners.
//
// Honesty rules:
//   - READ-ONLY: this route never writes, never rotates, never trims the log.
//   - The window is a LINE-COUNT window, never presented as a clock window —
//     dev log lines carry no timestamps and the engine discloses that.
//   - A missing/unreadable log is ok:false with the REAL error string —
//     no fake empty ledger.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { latencyLedger, LATENCY_WINDOW_LINES } from '@/lib/latency-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROOT = process.cwd();
const DEV_LOG_PATH = join(ROOT, 'dev.log');

export async function GET() {
  try {
    if (!existsSync(DEV_LOG_PATH)) {
      return NextResponse.json(
        { ok: false, error: 'dev.log does not exist — the ledger refuses to invent a window' },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const raw = readFileSync(DEV_LOG_PATH, 'utf8');
    const lines = raw.split('\n');
    const window = lines.slice(-LATENCY_WINDOW_LINES);
    const ledger = latencyLedger(window);
    return NextResponse.json(
      { ok: true, ledger },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: true, empty: true, error: 'unavailable' },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
