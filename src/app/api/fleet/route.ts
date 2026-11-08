// src/app/api/fleet/route.ts — R75/R76 · FLEET HEALTH BOARD — the estate's siblings, surfaced.
// ─────────────────────────────────────────────────────────────────────────────
// The six mini-services (:3003-:3008) plus the :3000 surface itself were only
// ever visible to the cron health check (the worklog's 410175 rows) — the
// dashboard probed the DASHBOARD's rails (:3003/:3004/:3005 + proximity) but
// never showed the fleet as a fleet. This route is the honest fleet probe:
//
//   - the registry (src/server/fleet/registry.ts — R76 shared with the
//     restart route so display and enforcement cannot drift) encodes each
//     service's expected root status FROM ITS OWN SOURCE; the "root 404 is
//     the designed answer" convention for pure-API services is expectation,
//     so the board never dresses a healthy 404 up as an error
//   - a parallel root GET / probe per port (1.5s timeout), per-row latency
//   - verdicts: OK (answer matches expectation) · DOWN (no answer — the
//     real error string is shown) · ODD (an answer, but not the expected
//     one — reported, never hidden; a pure-API service answering 200 at the
//     root would be a change in the estate's shape)
//   - READ-ONLY: a probe touches nothing, writes nothing, kills nothing.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { FLEET_REGISTRY } from '@/server/fleet/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FleetRow {
  port: number;
  name: string;
  service: string;
  role: string;
  kind: 'surface' | 'http' | 'api-only';
  expectedRootStatus: number;
  httpStatus: number | null;
  latencyMs: number;
  verdict: 'OK' | 'DOWN' | 'ODD';
  error: string | null;
  note: string | null;
}

async function probeFleetRow(row: (typeof FLEET_REGISTRY)[number]): Promise<FleetRow> {
  const t0 = Date.now();
  try {
    const res = await fetch(`http://127.0.0.1:${row.port}/`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
      // A 404 answer is a valid fleet observation — never throw on status.
      redirect: 'manual',
    });
    const latencyMs = Date.now() - t0;
    const verdict: FleetRow['verdict'] = res.status === row.expectedRootStatus ? 'OK' : 'ODD';
    return { ...row, httpStatus: res.status, latencyMs, verdict, error: null };
  } catch (e) {
    // Connection refused / timeout — the honest DOWN with the real string.
    const latencyMs = Date.now() - t0;
    const msg = e instanceof Error ? e.message : String(e);
    return { ...row, httpStatus: null, latencyMs, verdict: 'DOWN', error: msg };
  }
}

export async function GET() {
  const rows = await Promise.all(FLEET_REGISTRY.map(probeFleetRow));
  const summary = {
    total: rows.length,
    ok: rows.filter((r) => r.verdict === 'OK').length,
    odd: rows.filter((r) => r.verdict === 'ODD').length,
    down: rows.filter((r) => r.verdict === 'DOWN').length,
  };
  return NextResponse.json(
    { probedAtUtc: new Date().toISOString(), summary, rows },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
