// src/app/api/guardian/plateau-history/route.ts — R72 · the plateau SCOPE.
// ─────────────────────────────────────────────────────────────────────────────
// R69 gave the plateau a LEVEL (warm baseline), R70 gave it a DIRECTION
// (trend), and both proved the structural point: every uptime climbs and
// ends in a guardian save. What no number shows is the SHAPE of that cycle
// — the climb rate, how the RSS line approaches the guard, where each boot
// begins. This endpoint is the READ side of the guardian's own pass log as
// a time series, for the PlateauScope chart on the watchdog surface:
//
//   guardian.log  .zscripts/guardian.log — one line per 20s pass
//   (+ guardian.log.1 — the R73 rotated generation, read FIRST so the
//   scope's history survives the copytruncate rotation; see guardian.py.)
//   bounces.jsonl vvu-trust/guardian/bounces.jsonl — real saves become the
//     BOOT BOUNDARY markers; boot boundaries come from the journal, never
//     guessed from dips.
//
// R80 — the parser moved VERBATIM into src/server/guardian/plateau-scope.ts
// so the verdict ledger's recorded rows compute their climb from the EXACT
// same code this chart draws (one parser, two readers, zero drift). The
// response contract is unchanged.
//
// Honesty rules (unchanged):
//   - present:false when the log is absent → the UI says NO SCOPE (a
//     missing log is a state, not an error to paper over).
//   - DOWN passes carry rss=None — they cannot be RSS points, so they are
//     COUNTED (downPasses) and never invented into the series.
//   - Non-pass lines (BOUNCE begin/OK, guardian armed) are other line
//     types, not corruption — counted as otherLines, never parsed as data.
//   - READ-ONLY: no writes, no bounces, no kill; the request path touches
//     two files and returns.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';

import { DEFAULT_POINTS, MAX_POINTS, readPlateauScope } from '@/server/guardian/plateau-scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const rawPoints = Number(req.nextUrl.searchParams.get('points') ?? '');
  const points = Number.isFinite(rawPoints) && rawPoints > 0
    ? Math.min(MAX_POINTS, Math.max(60, Math.floor(rawPoints)))
    : DEFAULT_POINTS;

  const result = readPlateauScope(points);
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
