import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/vvu/rails — Task 47 · the Trust Sphere Metrics data source.
//
// One aggregate endpoint, honestly labelled. Response:
//   ok             — AND of every rail probe
//   generatedAt    — when THIS response was computed (the SLA panel's
//                    "last check" line; the client marks STALE >60s)
//   rails[]        — per-rail live probe (parallel, 2.5s timeout each)
//   devices        — the :3005 device-mesh numbers (offline:true, never a
//                    cached number, when the rail is down)
//   sla            — DERIVED from persisted RailSweep rows (72h window or
//                    since first sweep, honestly labelled via `since`;
//                    breaches = contiguous down episodes, never declared)
//
// The GET also starts (and keeps alive) the background rails sampler — see
// src/lib/rails-sampler.ts. No cache headers are set beyond no-store: a
// stale SLA is worse than no SLA.

import {
  deriveSla,
  ensureSampler,
  probeAllRails,
  readFieldDevices,
} from '@/lib/rails-sampler';

export async function GET() {
  ensureSampler();

  const [rails, devices, sla] = await Promise.all([
    probeAllRails(),
    readFieldDevices(),
    deriveSla(),
  ]);

  const ok = rails.every((r) => r.ok) && !devices.offline;

  return NextResponse.json(
    {
      ok,
      generatedAt: new Date().toISOString(),
      rails: rails.map((r) => ({
        port: r.port,
        id: r.id,
        label: r.label,
        ok: r.ok,
        latencyMs: r.latencyMs,
        ...(r.httpStatus !== undefined ? { httpStatus: r.httpStatus } : {}),
        ...(r.error ? { error: r.error } : {}),
      })),
      devices,
      sla,
      honesty: {
        measurement: 'SLA derived from persisted 15s sweeps — window starts at first sweep, never fabricated',
        tier: 'T0 · LOCAL_SOFTWARE_SHA256_CHAIN estate ledger discipline',
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
