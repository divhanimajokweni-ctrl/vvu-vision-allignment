// src/app/api/traffic/route.ts — R76 · the traffic counter's READ side.
// ─────────────────────────────────────────────────────────────────────────────
// One number, honestly framed: HTTP requests received by the :3000 node
// process SINCE ITS BOOT (counted passively at the http.Server layer by
// the instrumentation hook — see src/instrumentation.ts). This is the
// leak hunt's request baseline: read it next to the plateau scope's RSS
// drift and the boot boundary, and the attribution question (request-
// driven vs compile-driven vs ambient climb) becomes answerable with data.
//
// R77 — THE DATA PHASE: the total alone can only say WHETHER the climb
// tracks requests; the response now also carries the PER-ROUTE ledger the
// instrumentation hook buckets (`METHOD path`, query-stripped, capped at
// 512 distinct keys — the cap's overflow is counted, never hidden). The
// top rows answer WHO; `SELF_POLL`-style attribution stays a READER'S job
// — this endpoint reports raw buckets, it does not editorialize.
//
// Honesty rules:
//   - the counter RESETS at every boot — it is REQUESTS SINCE BOOT, never
//     a cumulative series (the boot boundary is the plateau scope's own
//     unit of analysis, so a per-boot counter is the honest companion)
//   - it includes the dashboard's OWN polling — the watchman is part of
//     the traffic it watches; the tooltip and the leak-hunt reading must
//     account for that, not hide it
//   - it covers THIS process only — the mini-services run in their own
//     processes and are not counted here
//   - HTTP only: websocket upgrades fire 'upgrade', not 'request', so
//     socket.io-style traffic is out of the baseline BY CONSTRUCTION
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const g = globalThis as {
    __vvuRequestsSinceBoot?: number;
    __vvuRouteCounts?: Map<string, number>;
    __vvuRouteOverflow?: number;
  };
  const uptimeSec = Math.round(process.uptime());
  const requestsSinceBoot = g.__vvuRequestsSinceBoot ?? null;
  const counts = g.__vvuRouteCounts;
  // Top 24 is a READ cap, not a storage cap — the map may hold up to 512
  // keys; the response carries the busiest slice and says how much exists.
  let routes: { key: string; count: number }[] | null = null;
  let routesTracked: number | null = null;
  let routeOverflow: number | null = null;
  if (counts) {
    routesTracked = counts.size;
    routeOverflow = g.__vvuRouteOverflow ?? 0;
    routes = [...counts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 24);
  }
  return NextResponse.json(
    {
      requestsSinceBoot,
      counterArmed: requestsSinceBoot != null,
      reqPerMin: requestsSinceBoot != null && uptimeSec > 0 ? Math.round((requestsSinceBoot / uptimeSec) * 60) : null,
      routes,
      routesTracked,
      routeOverflow,
      uptimeSec,
      pid: process.pid,
      sampledAtUtc: new Date().toISOString(),
      note: 'requests received by this node process since boot — includes the dashboard\u0027s own polling; resets at every boot; HTTP only (websocket upgrades are not counted); per-route buckets are query-stripped and capped at 512 distinct keys',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
