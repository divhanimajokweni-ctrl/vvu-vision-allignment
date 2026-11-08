import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/watchdog — Task 41 · honest rail-health probe.
//
// Server-side probe of the rails the dashboard depends on. NEVER fakes
// green: a rail that times out / errors / returns non-200 is reported
// ok:false with the REAL error string, and the top-level `ok` is the AND of
// all rails. Latency is measured per rail with Date.now() deltas around the
// fetch (resolve time; the body is small — :3003 /healthz, :3004/:3005
// /status snapshots).
//
// Rails:
//   :3003 telemetry-service  /healthz  { ok: true }
//   :3004 vault-bridge       /status   { ok, agentOnline, pairedDevices,
//                                        viewerCount, receipts{count, root,
//                                        verified, merkleRoot}, … }
//   :3005 vvu-field-onboard  /status   { ok, node, protocol, agentOnline,
//                                        pairedDevices, receipts{…}, … }
//   :local proximity record layer (R62) — probed IN-PROCESS, not over HTTP:
//                                        a fresh verifyProximityChain walk of
//                                        the stored bytes (read-only — the
//                                        watchdog never mutates what it
//                                        watches) + the sentinel state and
//                                        the append-only alarm rail. A broken
//                                        chain IS a down rail: ok:false with
//                                        the real break point as the error.

import { db } from '@/lib/db';
import { verifyProximityChain } from '@/server/proximity/verify';
import { watchdogStatus } from '@/server/proximity/watchdog';

interface RailResult {
  id: 'telemetry' | 'bridge' | 'field' | 'proximity';
  label: string;
  port: number;
  ok: boolean;
  latencyMs: number;
  httpStatus?: number;
  error?: string;
  detail?: unknown;
}

async function probeRail(
  id: RailResult['id'],
  label: string,
  port: number,
  path: string,
): Promise<RailResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      return { id, label, port, ok: false, latencyMs, httpStatus: res.status, error: `HTTP ${res.status}` };
    }
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      return { id, label, port, ok: false, latencyMs, httpStatus: res.status, error: 'response was not JSON' };
    }
    // A rail that answers 200 with ok:false in its own payload is DOWN —
    // pass the payload through and let its own word decide.
    const railOk =
      typeof detail === 'object' && detail !== null && 'ok' in detail
        ? (detail as { ok?: unknown }).ok === true
        : true;
    return { id, label, port, ok: railOk, latencyMs, httpStatus: res.status, detail };
  } catch (e) {
    // Timeout / connection refused / DNS — the honest error string.
    const latency = Date.now() - t0;
    const msg = e instanceof Error ? e.message : String(e);
    return { id, label, port, ok: false, latencyMs: latency, error: msg };
  }
}

// R62 — the proximity record layer rides the same rail contract, probed
// in-process (it IS this surface, not a sibling port). Read-only: a chain
// walk + the sentinel's own status; no pass history is appended, no alarms
// are raised here — only the 30s sentinel schedules mutate those.
async function probeProximityRail(): Promise<RailResult> {
  const t0 = Date.now();
  try {
    const [verification, sentinel] = await Promise.all([verifyProximityChain(db), watchdogStatus()]);
    const latencyMs = Date.now() - t0;
    const detail = {
      valid: verification.valid,
      records: verification.records,
      headPosition: verification.headPosition,
      headHash: verification.headHash,
      brokenAt: verification.brokenAt,
      reason: verification.reason,
      checkedInMs: verification.checkedInMs,
      sentinel: {
        running: sentinel.running,
        enabled: sentinel.enabled,
        killSwitch: sentinel.killSwitch,
        intervalMs: sentinel.intervalMs,
        consecutiveValid: sentinel.consecutiveValid,
        totalPasses: sentinel.totalPasses,
        lastSeenHeadPosition: sentinel.lastSeenHeadPosition,
      },
      alarmCount: sentinel.alarmCount,
      alarms: sentinel.alarms.slice(0, 5).map((a) => ({
        seq: a.seq,
        raisedAtUtc: a.raisedAtUtc,
        kind: a.kind,
        brokenAt: a.brokenAt,
        reason: a.reason,
      })),
      checkedAtUtc: new Date().toISOString(),
    };
    if (!verification.valid) {
      // The one rail whose DOWN state is an integrity fault, not an outage:
      // the error string IS the break point + the walker's reason.
      return {
        id: 'proximity',
        label: 'PROXIMITY RECORD LAYER',
        port: 0,
        ok: false,
        latencyMs,
        error: `${verification.brokenAt ?? 'chain'} — ${verification.reason ?? 'stored bytes no longer match their digests'}`,
        detail,
      };
    }
    return { id: 'proximity', label: 'PROXIMITY RECORD LAYER', port: 0, ok: true, latencyMs, detail };
  } catch (e) {
    // Even the probe must fail honestly: a DB lock or a walker crash is a
    // DOWN rail with the real error string, never a skipped row.
    const latencyMs = Date.now() - t0;
    return {
      id: 'proximity',
      label: 'PROXIMITY RECORD LAYER',
      port: 0,
      ok: false,
      latencyMs,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function GET() {
  const rails = await Promise.all([
    probeRail('telemetry', 'TELEMETRY SERVICE', 3003, '/healthz'),
    probeRail('bridge', 'VAULT-BRIDGE', 3004, '/status'),
    probeRail('field', 'FIELD-ONBOARD', 3005, '/status'),
    probeProximityRail(),
  ]);
  return NextResponse.json(
    { checkedAt: new Date().toISOString(), ok: rails.every((r) => r.ok), rails },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
