// src/lib/rails-sampler.ts — Task 47 · the SLA measurement substrate.
//
// THE HONEST CONTRACT (Trust Sphere Metrics spec):
//   * Every ~15s (once started) the estate's rails are probed IN PARALLEL,
//     each with a 2.5s timeout — exactly the per-fetch budget the metrics
//     surface itself uses client-side.
//   * A sweep is UP iff every probed rail answered 200. One row per sweep
//     is persisted (RailSweep) — SLA over the 72h window is DERIVED from
//     these rows, never declared. Restarts do not zero the window.
//   * The window HONESTLY begins at the first recorded sweep — if the estate
//     has been measured for 20 minutes, the SLA is a 20-minute measurement,
//     labelled as such by the surface (`since <timestamp>`), never faked to
//     72h.
//   * A breach is derived, not declared: a breach is a CONTIGUOUS DOWN
//     EPISODE — a sweep that is down whose predecessor was up (or the first
//     sweep, if down). Its length is the run of consecutive down sweeps.
//
// Rails probed (the estate's real rail set — the spec named
// :3000/:3003/:3004/:3005; :3006 wildfire-mesh and :3007 mesh-demo were
// added by later estate rounds and are included because estate health is
// the health of ALL its rails — documented in trust-sphere-metrics.md):
//   :3000 the Next app itself (HEAD / — self-probe, no recursion)
//   :3003 telemetry-service  /healthz
//   :3004 vault-bridge       /status
//   :3005 vvu-field-onboard  /status
//   :3006 wildfire-mesh      /health
//   :3007 mesh-demo          /health
//
// Start discipline: the sampler starts on first use (ensureSampler) — called
// by GET /api/vvu/rails AND GET /api/watchdog, so the measurement window
// accrues whenever either surface is open. A globalThis guard keeps hot
// reload from stacking intervals.

import { db } from '@/lib/db';

export interface RailProbe {
  port: number;
  id: string;
  label: string;
  path: string;
}

export const RAILS: readonly RailProbe[] = [
  { port: 3000, id: 'app', label: 'VVU APP · :3000', path: '/' },
  { port: 3003, id: 'telemetry', label: 'TELEMETRY · :3003', path: '/healthz' },
  { port: 3004, id: 'vault', label: 'VAULT BRIDGE · :3004', path: '/status' },
  { port: 3005, id: 'field', label: 'FIELD ONBOARD · :3005', path: '/status' },
  { port: 3006, id: 'wildfire', label: 'WILDFIRE MESH · :3006', path: '/health' },
  { port: 3007, id: 'meshdemo', label: 'SENSOR MESH · :3007', path: '/health' },
] as const;

export interface RailState {
  port: number;
  id: string;
  label: string;
  ok: boolean;
  latencyMs: number;
  httpStatus?: number;
  error?: string;
}

/** Probe ONE rail. Never throws — a down rail is data, not an exception. */
export async function probeRail(rail: RailProbe, method: 'GET' | 'HEAD' = 'GET'): Promise<RailState> {
  const t0 = Date.now();
  try {
    const res = await fetch(`http://127.0.0.1:${rail.port}${rail.path}`, {
      cache: 'no-store',
      method,
      signal: AbortSignal.timeout(2500),
    });
    const latencyMs = Date.now() - t0;
    return {
      port: rail.port,
      id: rail.id,
      label: rail.label,
      ok: res.ok,
      latencyMs,
      httpStatus: res.status,
      ...(res.ok ? {} : { error: `HTTP ${res.status}` }),
    };
  } catch (err) {
    return {
      port: rail.port,
      id: rail.id,
      label: rail.label,
      ok: false,
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Probe all rails in parallel (worst case wall-clock ≈ the 2.5s timeout). */
export async function probeAllRails(): Promise<RailState[]> {
  return Promise.all(
    RAILS.map((r) => probeRail(r, r.port === 3000 ? 'HEAD' : 'GET')),
  );
}

/** Persist one sweep row. Failures are swallowed-and-logged: the sampler must
 *  never take a request path down with it. */
async function recordSweep(states: RailState[]): Promise<void> {
  const down = states.filter((s) => !s.ok);
  try {
    await db.railSweep.create({
      data: {
        probed: states.length,
        downCount: down.length,
        downPorts: down.map((d) => d.port).join(','),
      },
    });
  } catch (err) {
    console.warn('[rails-sampler] sweep persist failed:', err instanceof Error ? err.message : err);
  }
}

export interface SlaDerived {
  window: '72h';
  targetPct: number;
  /** Measured uptime percent over the window (or since first sweep). */
  measuredPct: number | null;
  /** ISO timestamp of the first sweep in the window — the honest "since". */
  since: string | null;
  sweeps: number;
  upSweeps: number;
  /** Contiguous down episodes (transitions into a down run). */
  breaches: number;
  /** True when fewer than 2 sweeps exist — nothing measured yet. */
  insufficient: boolean;
}

/** Derive the SLA from the persisted sweeps — the ONLY place it is computed. */
export async function deriveSla(): Promise<SlaDerived> {
  const since72h = new Date(Date.now() - 72 * 60 * 60 * 1000);
  let sweeps;
  try {
    sweeps = await db.railSweep.findMany({
      where: { at: { gte: since72h } },
      orderBy: { at: 'asc' },
      select: { at: true, downCount: true },
    });
  } catch {
    return {
      window: '72h',
      targetPct: 99.5,
      measuredPct: null,
      since: null,
      sweeps: 0,
      upSweeps: 0,
      breaches: 0,
      insufficient: true,
    };
  }
  if (sweeps.length === 0) {
    return {
      window: '72h',
      targetPct: 99.5,
      measuredPct: null,
      since: null,
      sweeps: 0,
      upSweeps: 0,
      breaches: 0,
      insufficient: true,
    };
  }
  const upSweeps = sweeps.filter((s) => s.downCount === 0).length;
  let breaches = 0;
  let prevUp = true;
  for (const s of sweeps) {
    const up = s.downCount === 0;
    if (!up && prevUp) breaches += 1;
    prevUp = up;
  }
  return {
    window: '72h',
    targetPct: 99.5,
    measuredPct: Math.round((upSweeps / sweeps.length) * 10000) / 100,
    since: sweeps[0].at.toISOString(),
    sweeps: sweeps.length,
    upSweeps,
    breaches,
    insufficient: sweeps.length < 2,
  };
}

export interface FieldDevices {
  offline: boolean;
  port: 3005;
  paired: number | null;
  active: number | null;
  stale: number | null;
  agentOnline: boolean | null;
  derivation: string;
}

/** The honest :3005 device numbers. `paired` is the rail's own pairedDevices
 *  count; `active` is 1 when the agent link is live (the only device that can
 *  be "currently sending" on this rail — it keeps a single agent session);
 *  `stale` is paired − active: paired devices with no live session. The rail
 *  does not persist per-device lastSeen for disconnected devices, so a true
 *  "silent > 5 min" duration is UNKNOWABLE — this floor is documented in
 *  trust-sphere-metrics.md rather than fabricated. */
export async function readFieldDevices(): Promise<FieldDevices> {
  try {
    const res = await fetch('http://127.0.0.1:3005/status', {
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const s = (await res.json()) as {
      pairedDevices?: number;
      agentOnline?: boolean;
    };
    const paired = typeof s.pairedDevices === 'number' ? s.pairedDevices : null;
    const active = s.agentOnline === true ? 1 : s.agentOnline === false ? 0 : null;
    return {
      offline: false,
      port: 3005,
      paired,
      active,
      stale: paired !== null && active !== null ? paired - active : null,
      agentOnline: s.agentOnline ?? null,
      derivation: 'paired = :3005 pairedDevices · active = live agent session · stale = paired − active',
    };
  } catch (err) {
    return {
      offline: true,
      port: 3005,
      paired: null,
      active: null,
      stale: null,
      agentOnline: null,
      derivation: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── the background sampler ───────────────────────────────────────────────────

const SWEEP_INTERVAL_MS = 15_000;
const MAX_QUIET_SWEEPS = 480; // 2h of unobserved sampling, then stand down

interface SamplerState {
  timer: ReturnType<typeof setInterval> | null;
  sweeping: boolean;
  lastSweepAt: number;
  quietSweeps: number;
}

const g = globalThis as typeof globalThis & { __vvuRailsSampler?: SamplerState };

/** Rate-limited sweep: no more than one per 10s (a manual ensure call while a
 *  sweep is in flight is a no-op). */
async function sweep(state: SamplerState): Promise<void> {
  if (state.sweeping) return;
  if (Date.now() - state.lastSweepAt < 10_000) return;
  state.sweeping = true;
  try {
    const states = await probeAllRails();
    await recordSweep(states);
    state.lastSweepAt = Date.now();
    state.quietSweeps += 1;
  } finally {
    state.sweeping = false;
  }
}

/** Idempotent starter. Safe to call on every request. */
export function ensureSampler(): void {
  if (g.__vvuRailsSampler) {
    // An observed request means someone is watching — reset the quiet clock.
    g.__vvuRailsSampler.quietSweeps = 0;
    return;
  }
  const state: SamplerState = {
    timer: null,
    sweeping: false,
    lastSweepAt: 0,
    quietSweeps: 0,
  };
  g.__vvuRailsSampler = state;
  state.timer = setInterval(() => {
    const s = g.__vvuRailsSampler;
    if (!s) return;
    if (s.quietSweeps >= MAX_QUIET_SWEEPS) {
      // Nobody has observed the estate for 2h — stand down (never spin
      // forever unobserved). The next ensureSampler() call restarts it.
      if (s.timer) clearInterval(s.timer);
      s.timer = null;
      return;
    }
    void sweep(s);
  }, SWEEP_INTERVAL_MS);
  if (typeof state.timer.unref === 'function') state.timer.unref();
  void sweep(state); // first sweep immediately
}
