// src/app/api/estate/death-causes/route.ts — R116 · THE DEATH-CAUSE LENS's
// read side.
// ─────────────────────────────────────────────────────────────────────────────
//   GET → the guardian's bounce journal (vvu-trust/guardian/bounces.jsonl)
//         read through the SHARED boot-ledger engine (one parse, many
//         readers — R114's convention), then the death-cause lens: the
//         census by the journal's own death reason, the run decomposition,
//         the strike strides, and the recent-window shift verdict.
//
// Honesty rules (the boot ledger's own, inherited):
//   - READ-ONLY: this route never writes, never rotates, never trims the
//     journal. The tail bound (BOOT_JOURNAL_TAIL_ROWS) bounds the read,
//     never the file.
//   - A missing journal is ok:false with the REAL error string — no fake
//     empty census.
//   - The current dev pid comes from the same dev.pid file the guardian
//     itself uses — the living/censored split is the guardian's own truth.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildBootLedger,
  BOOT_JOURNAL_TAIL_ROWS,
  type BounceRowInput,
} from '@/lib/boot-ledger';
import { deathCauseRead } from '@/lib/death-causes';
import { witnessedDeaths, type ProjectionBounceRow, type WitnessSample } from '@/lib/operator-projection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROOT = process.cwd();
const JOURNAL_PATH = join(ROOT, 'vvu-trust', 'guardian', 'bounces.jsonl');
const DEV_PID_PATH = join(ROOT, '.zscripts', 'dev.pid');

export async function GET() {
  try {
    if (!existsSync(JOURNAL_PATH)) {
      return NextResponse.json(
        { ok: false, error: 'bounce journal does not exist — the death-cause lens refuses to invent a record' },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const raw = readFileSync(JOURNAL_PATH, 'utf8');
    const lines = raw.split('\n').filter((l) => l.trim());
    const kept = lines.slice(-BOOT_JOURNAL_TAIL_ROWS);
    const parsed: BounceRowInput[] = [];
    // R120 — THE TWIN WINDOWS: the SAME journal rows, projected onto the
    // witness feed (one parse, many readers — the house convention). The
    // witness side carries only the rows the guardian sampled with a
    // memory witness window; witnessedDeaths() applies its own honest
    // filters (drills out, boot-bounded windows, real stamps only).
    const projRows: ProjectionBounceRow[] = [];
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
        projRows.push({
          at: typeof row.at === 'string' ? row.at : undefined,
          reason: typeof row.reason === 'string' ? row.reason : undefined,
          drill: row.drill === true,
          downtimeMs: typeof row.downtimeMs === 'number' ? row.downtimeMs : null,
          memWitness: Array.isArray(row.memWitness)
            ? (row.memWitness as WitnessSample[])
            : null,
        });
      } catch {
        // A torn line is not a journal row — skipped at the boundary.
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
    // R120 — the witnessed feed rides the same parse (the twin's witness
    // side); a projection failure degrades to a witness-null twin, said.
    // R121 — the feed now carries its witness-window memory (at / atMs /
    // minAvailMb / maxRssMb) so THE SCARCITY LADDER can rank the dying
    // windows by their own depth — the ledger feed carries no memory, the
    // witness's sampling is the only honest source.
    let witnessed: Array<{
      cause: string;
      at: string;
      atMs: number;
      minAvailMb: number | null;
      maxRssMb: number | null;
    }> = [];
    try {
      witnessed = witnessedDeaths(projRows).map((w) => ({
        cause: w.cause,
        at: w.at,
        atMs: w.atMs,
        minAvailMb: w.minAvailMb,
        maxRssMb: w.maxRssMb,
      }));
    } catch {
      witnessed = [];
    }
    const read = deathCauseRead(ledger.boots, { witnessed });
    return NextResponse.json(
      { ok: true, read },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: true, empty: true, error: 'unavailable' },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
