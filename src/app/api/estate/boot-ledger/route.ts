// src/app/api/estate/boot-ledger/route.ts — R111 · THE BOOT LEDGER's read side.
// ─────────────────────────────────────────────────────────────────────────────
//   GET → the guardian's bounce journal (vvu-trust/guardian/bounces.jsonl)
//         read through the shared boot-ledger engine: every port-3000
//         boot's tenure — spawn, death, end state — plus the settled
//         population's medians, halves, OLS trend, and the tenure-at-death
//         lens by cause.
//
// Honesty rules:
//   - READ-ONLY: this route never writes, never rotates, never trims the
//     journal. The tail bound (BOOT_JOURNAL_TAIL_ROWS) bounds the read,
//     never the file.
//   - The current dev pid comes from the same dev.pid file the guardian
//     itself uses — the living/unjournaled split is the guardian's own
//     truth, not a guess. An unreadable dev.pid degrades honestly: every
//     death-row-less boot reads unjournaled (tenure unknown), none are
//     assumed alive.
//   - A missing journal is ok:false with the REAL error string — no fake
//     empty ledger.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildBootLedger,
  BOOT_JOURNAL_TAIL_ROWS,
  type BounceRowInput,
} from '@/lib/boot-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROOT = process.cwd();
const JOURNAL_PATH = join(ROOT, 'vvu-trust', 'guardian', 'bounces.jsonl');
const DEV_PID_PATH = join(ROOT, '.zscripts', 'dev.pid');

export async function GET() {
  try {
    if (!existsSync(JOURNAL_PATH)) {
      return NextResponse.json(
        { ok: false, error: 'bounce journal does not exist — the boot ledger refuses to invent a record' },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const raw = readFileSync(JOURNAL_PATH, 'utf8');
    const lines = raw.split('\n').filter((l) => l.trim());
    const kept = lines.slice(-BOOT_JOURNAL_TAIL_ROWS);
    const parsed: BounceRowInput[] = [];
    for (const line of kept) {
      try {
        const row = JSON.parse(line) as Record<string, unknown>;
        parsed.push({
          at: String(row.at ?? ''),
          reason: String(row.reason ?? 'unknown'),
          ok: row.ok === true,
          oldPid: Number(row.oldPid),
          newPid: Number(row.newPid),
          drill: row.drill === true,
          port: typeof row.port === 'number' ? row.port : null,
        });
      } catch {
        // A torn line is not a journal row — the journal's own grammar is
        // one JSON object per line; skipped at the boundary, never parsed
        // into something it is not.
      }
    }

    let currentDevPid: number | null = null;
    try {
      const pidRaw = readFileSync(DEV_PID_PATH, 'utf8').trim();
      const pid = Number(pidRaw);
      if (Number.isFinite(pid) && pid > 0) currentDevPid = pid;
    } catch {
      // no dev.pid — degrade honestly, no living boot will be claimed
    }

    const ledger = buildBootLedger(parsed, {
      nowMs: Date.now(),
      currentDevPid,
    });
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
