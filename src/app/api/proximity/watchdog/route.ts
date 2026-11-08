// src/app/api/proximity/watchdog/route.ts
// THE SENTINEL EXPOSED — GET returns the pass history, the alarm rail and
// the scheduler state; POST drives it (enable | disable | run-now).

import { NextResponse } from 'next/server';

import {
  setWatchdogEnabled,
  startProximityWatchdog,
  watchdogPass,
  watchdogStatus,
} from '@/server/proximity/watchdog';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Belt-and-braces: a GET also arms the sentinel (HMR-safe, generation-stamped).
  startProximityWatchdog();
  const status = await watchdogStatus();
  return NextResponse.json({ ok: true, status });
}

export async function POST(request: Request) {
  let body: { action?: string } = {};
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    /* empty body = run-now */
  }
  const action = body.action ?? 'run-now';

  if (action === 'enable') {
    const arm = startProximityWatchdog();
    setWatchdogEnabled(true);
    return NextResponse.json({ ok: true, detail: `sentinel armed · every ${arm.intervalMs} ms`, status: await watchdogStatus() });
  }
  if (action === 'disable') {
    setWatchdogEnabled(false);
    return NextResponse.json({ ok: true, detail: 'sentinel disarmed (per-process toggle — the alarm rail is the durable part)', status: await watchdogStatus() });
  }
  if (action === 'run-now') {
    const pass = await watchdogPass();
    return NextResponse.json({
      ok: pass.valid,
      detail: pass.valid
        ? `pass OK · ${pass.records} records · head #${pass.headPosition} · ${pass.latencyMs} ms · ${pass.atUtc}`
        : `CHAIN BROKEN AT ${pass.brokenAt}`,
      pass,
      status: await watchdogStatus(),
    });
  }
  return NextResponse.json(
    { ok: false, error: `unknown action '${action}' — enable | disable | run-now` },
    { status: 400 },
  );
}
