// src/app/api/estate/watchboard/ledger/route.ts — R130 · THE LEDGER'S
// DEPTH, read side. The sampler POST (R128) composes the board and
// records a moved sample; THIS route only READS the store: the newest
// `take` moved snapshots, summarized the same way the lane renders them
// (one summarizer, two verbs). No journal parse, no board composition,
// no writes — a depth read moves nothing (the R125/R128 contracts
// compose cleanly: the board reads the record; the ledger reads the
// board; the depth reads the ledger).
//
// R133 · THE SILENCE LADDER, read side — `?silence=1`. The still rows'
// own past read from the store's WHOLE keep (the newest 200 moved
// boards): one extra findMany at the keep bound feeds both the deep
// flips and the census, which stands on the newest snapshot's own rows
// (each snapshot records the WHOLE board, not just its movers) — the
// store-only contract holds. The default read (no flag) is byte-for-
// byte the R130 answer: the depth read grew nothing; the silence read
// pays for its own reach.
//
// R135 · THE WEIGHT LADDER rides the same reach — `weights` joins the
// silence answer, derived from the SAME orderedAll the deep read
// already paid for (weightLadder at the lane's own depth chips; each
// rung the R130 depth read's own arithmetic at that depth). No new
// findMany, no new store, no writes: the deep read's cost, one more
// pure read over what it already held.

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  summarizeLedger,
  stillCensus,
  silenceRead,
  weightLadder,
  LEDGER_TAIL,
  LEDGER_KEEP,
  LEDGER_DEPTHS,
  type WatchboardSnapshot,
  type WatchboardSnapshotRow,
} from '@/lib/watchboard-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = Number(url.searchParams.get('take'));
  // The depth is the operator's read reach, clamped to the store's own
  // prune bound: below 1 the default tail answers, above LEDGER_KEEP the
  // store simply has nothing older to give (the prune owns the history).
  const take = Number.isFinite(raw) && raw >= 1 ? Math.min(Math.floor(raw), LEDGER_KEEP) : LEDGER_TAIL;
  const withSilence = url.searchParams.get('silence') === '1';

  try {
    if (!withSilence) {
      // The R130 depth read, byte-for-byte unchanged.
      const tail = await db.watchboardSnapshot.findMany({ orderBy: { builtAt: 'desc' }, take });
      const ordered = tail.map(toSnapshot).reverse(); // oldest → newest
      return NextResponse.json(
        { ok: true, take, ledger: summarizeLedger(ordered) },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // THE SILENCE LADDER (R133): the deep flips span the store's WHOLE
    // keep; one read, two summarizations (the depth tail and the deep
    // reach share the same snapshots when take >= the store's size).
    const all = await db.watchboardSnapshot.findMany({ orderBy: { builtAt: 'desc' }, take: LEDGER_KEEP });
    const orderedAll = all.map(toSnapshot).reverse(); // oldest → newest
    const deep = summarizeLedger(orderedAll);
    const ledger =
      take >= orderedAll.length ? deep : summarizeLedger(orderedAll.slice(-take));
    // The census stands on the board AS THE STORE LAST HEARD IT — the
    // newest snapshot's own rows. An empty store answers silence: null
    // (the lane renders its honest wait; there is nothing to read past).
    const newest = orderedAll.length > 0 ? orderedAll[orderedAll.length - 1] : null;
    const silence = newest
      ? silenceRead(stillCensus(newest.rows, ledger.flips), deep.flips)
      : null;
    // THE WEIGHT LADDER (R135) rides the same reach: the carrier read
    // at every depth chip, from the orderedAll this branch already
    // holds. An empty store answers an empty ladder (the engine owns
    // that honesty).
    const weights = weightLadder(orderedAll, [...LEDGER_DEPTHS]);
    return NextResponse.json(
      { ok: true, take, ledger, silence, weights },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: true, empty: true, error: 'unavailable' },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
