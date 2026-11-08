// src/app/api/estate/watchboard/route.ts — R125 · THE WATCHBOARD's read
// side: the standing watches, compiled from the engines that already own
// them. ONE journal parse feeds every cause/era row (the house convention
// — one parse, many readers); the latency-memory rows ride the SAME store
// the memory panel's own polling writes, READ-ONLY here (this route never
// appends a snapshot — the memory's 30s same-window refusal and the
// panel's cadence own that, and a board read must not move the record it
// reads). A read that fails renders NO FEED on its rows — the refusal is
// the status, never a guessed state.
//
// R128 · THE BOARD'S OWN LEDGER — the POST side. GET stays read-only (a
// board read must never append — the R125 contract stands untouched).
// POST is the SAMPLER: it composes the board exactly as GET does (the
// client sends nothing — the board is the server's own arithmetic, never
// the client's claim), computes the signature, and records the board into
// the WatchboardSnapshot store ONLY when the signature differs from the
// newest stored one. The ledger records the board's FLIPS, never the
// reader's cadence; the memory store stays read-only to this route too —
// the ledger's writes are its OWN store, the words' motion, nothing else.

import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { db } from '@/lib/db';
import {
  boardSignature,
  shouldRecordSnapshot,
  summarizeLedger,
  LEDGER_KEEP,
  LEDGER_TAIL,
  type WatchboardSnapshot,
  type WatchboardSnapshotRow,
} from '@/lib/watchboard-ledger';
import { buildBootLedger, BOOT_JOURNAL_TAIL_ROWS, type BounceRowInput } from '@/lib/boot-ledger';
import { deathCauseRead } from '@/lib/death-causes';
import { killPaceRead } from '@/lib/kill-pace';
import { witnessedDeaths, type ProjectionBounceRow, type WitnessSample } from '@/lib/operator-projection';
import { stormHistory } from '@/lib/storm-history';
import { stormEras } from '@/lib/eras';
import { latencyMemoryRead, type LatencySnapshot } from '@/lib/latency-memory';
import { watchboard } from '@/lib/watchboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROOT = process.cwd();
const JOURNAL_PATH = join(ROOT, 'vvu-trust', 'guardian', 'bounces.jsonl');
const DEV_PID_PATH = join(ROOT, '.zscripts', 'dev.pid');
const MEMORY_STORE_PATH = join(ROOT, '.zscripts', 'latency-memory.json');

/** composeWatchboard — the board, compiled from the journal and the
 *  memory store exactly as GET has always composed it. Shared by GET
 *  (the read) and POST (the sample): one composition, two verbs — the
 *  sampled board can never drift from the read board. */
function composeWatchboard(): {
  board: ReturnType<typeof watchboard>;
  builtAt: string;
} {
  // The cause read + the eras read + the pace read: one journal parse, ONE
  // heartbeat calibration, three readers (the route's own convention —
  // R126 adds the pace read so THE COMPRESS and THE TENURE DIAL ride the
  // same witnessed feed their home panel rides).
  let cause: ReturnType<typeof deathCauseRead> | null = null;
  let eras: ReturnType<typeof stormEras> | null = null;
  let pace: ReturnType<typeof killPaceRead> | null = null;
  try {
    if (existsSync(JOURNAL_PATH)) {
      const raw = readFileSync(JOURNAL_PATH, 'utf8');
      const lines = raw.split('\n').filter((l) => l.trim());
      const kept = lines.slice(-BOOT_JOURNAL_TAIL_ROWS);
      const parsed: BounceRowInput[] = [];
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
            memWitness: Array.isArray(row.memWitness) ? (row.memWitness as WitnessSample[]) : null,
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

      const ledger = buildBootLedger(parsed, { nowMs: Date.now(), currentDevPid });
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
      cause = deathCauseRead(ledger.boots, { witnessed });
      const heartbeatMin = stormHistory(
        witnessed.map((w) => ({ at: w.at, atMs: w.atMs, maxRssMb: w.maxRssMb })),
      ).medianIntervalMin;
      eras = stormEras(
        witnessed.map((d) => ({ at: d.at, atMs: d.atMs, maxRssMb: d.maxRssMb, minAvailMb: d.minAvailMb })),
        { heartbeatMin },
      );
      pace = killPaceRead(
        witnessed.map((d) => ({ at: d.at, atMs: d.atMs, cause: d.cause })),
        { heartbeatMin, nowMs: Date.now() },
      );
    }
  } catch {
    cause = null;
    eras = null;
    pace = null;
  }

  // The latency-memory read: the SAME store the memory panel's polling
  // writes, read-only here (never append — a board read must not move the
  // record it reads). A corrupt/missing store reads as NO FEED — the
  // board's rows render their honest refusals from it.
  let memory: ReturnType<typeof latencyMemoryRead> | null = null;
  try {
    if (existsSync(MEMORY_STORE_PATH)) {
      const parsedStore = JSON.parse(readFileSync(MEMORY_STORE_PATH, 'utf8')) as unknown;
      if (Array.isArray(parsedStore)) {
        memory = latencyMemoryRead(parsedStore as Array<LatencySnapshot>);
      }
    }
  } catch {
    memory = null;
  }

  const board = watchboard({ cause, eras, memory, pace });
  return { board, builtAt: new Date().toISOString() };
}

export async function GET() {
  const { board, builtAt } = composeWatchboard();
  return NextResponse.json(
    { ok: true, board, builtAt },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

interface LedgerRowModel {
  builtAt: Date;
  signature: string;
  hotCount: number;
  rows: string;
}

function toSnapshot(r: LedgerRowModel): WatchboardSnapshot {
  let rows: WatchboardSnapshotRow[] = [];
  try {
    const parsed = JSON.parse(r.rows) as unknown;
    if (Array.isArray(parsed)) rows = parsed as WatchboardSnapshotRow[];
  } catch {
    rows = [];
  }
  return { builtAt: r.builtAt.toISOString(), signature: r.signature, hotCount: r.hotCount, rows };
}

export async function POST() {
  const { board, builtAt } = composeWatchboard();
  const rows: WatchboardSnapshotRow[] = board.rows.map((r) => ({
    id: r.id,
    name: r.name,
    word: r.word,
    tone: r.tone,
  }));
  const hotCount = rows.filter((r) => r.tone === 'amber' || r.tone === 'rose').length;
  const signature = boardSignature(rows);

  try {
    const last = await db.watchboardSnapshot.findFirst({ orderBy: { builtAt: 'desc' } });
    if (!shouldRecordSnapshot(last, { signature })) {
      // Same words as the newest stored board — the motion is zero, the
      // ledger refuses the sample (the words' motion, not the cadence).
      const tail = await db.watchboardSnapshot.findMany({ orderBy: { builtAt: 'desc' }, take: LEDGER_TAIL });
      return NextResponse.json(
        {
          ok: true,
          recorded: false,
          signature,
          ledger: summarizeLedger(tail.map(toSnapshot).reverse()),
          builtAt,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    await db.watchboardSnapshot.create({
      data: { builtAt: new Date(builtAt), signature, hotCount, rows: JSON.stringify(rows) },
    });

    // Prune — the newest LEDGER_KEEP moved boards are the ledger; older
    // moves are the rounds' narrated history, not the lane's job.
    const stale = await db.watchboardSnapshot.findMany({
      orderBy: { builtAt: 'desc' },
      skip: LEDGER_KEEP,
      select: { id: true },
    });
    if (stale.length > 0) {
      await db.watchboardSnapshot.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
    }

    const tail = await db.watchboardSnapshot.findMany({ orderBy: { builtAt: 'desc' }, take: LEDGER_TAIL });
    const ordered = tail.map(toSnapshot).reverse(); // oldest → newest
    // The summary derives the flips across EVERY consecutive pair of the
    // tail — the same census its busiest row reads from. Sending a
    // newest-pair-only flip list here would make the lane's chip count
    // disagree with its own busiest row (the R128 QA catch — the lane
    // oscillated between full history and the last pair as the sampler
    // alternated record/refuse). One derivation, one truth.
    return NextResponse.json(
      {
        ok: true,
        recorded: true,
        signature,
        ledger: summarizeLedger(ordered),
        builtAt,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    // A store failure is the sampler's own refusal — the read side is
    // untouched, the board still answers GET. The lane renders its
    // honest empty state from this error word.
    return NextResponse.json(
      {
        ok: false,
        recorded: false,
        error: e instanceof Error ? e.message : 'the ledger store refused the sample',
        builtAt,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
