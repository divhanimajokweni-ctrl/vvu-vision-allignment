// src/server/proximity/watchdog.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE SENTINEL — scheduled chain verification + a tamper alarm rail.
//
// The stored-bytes rule (verify.ts) catches tamper WHEN SOMEONE RUNS THE
// WALKER. The sentinel makes that someone a schedule: every interval it
// walks the proximity stream, keeps a bounded pass history, and — on the
// VALID→BROKEN transition or a head-position regression (deletion) —
// raises an alarm onto an APPEND-ONLY JSONL rail on disk:
//
//   vvu-trust/chains/proximity-alarms.jsonl
//
// The rail is on disk, not in memory: alarms must outlive the process that
// raised them. The rail is append-only: an alarm is evidence; it is never
// edited or deleted, only superseded by the restore that clears the fault.
//
// Scheduling discipline is the estate's proven pattern (safegrid/worker.ts):
// a generation-stamped globalThis interval, started at boot by
// src/instrumentation.ts AND lazily by the API routes (HMR belt-and-braces),
// timer.unref() so it never holds the process open. PROXIMITY_WATCHDOG=off
// is the kill switch. The operator enable/disable toggle is per-process —
// honest and stated; the alarms themselves are not.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { db } from '@/lib/db';
import {
  formatUtc,
  type WatchdogAlarm,
  type WatchdogAlarmKind,
  type WatchdogPass,
  type WatchdogStatus,
} from '@/lib/proximity/types';
import { verifyProximityChain } from './verify';
import { dispatchWebhook } from './webhook';

const ALARMS_PATH = path.join(process.cwd(), 'vvu-trust', 'chains', 'proximity-alarms.jsonl');
const PASS_HISTORY_CAP = 90;
const DEFAULT_INTERVAL_MS = 30_000;
const MIN_INTERVAL_MS = 10_000;

function intervalFromEnv(): number {
  const raw = Number(process.env.PROXIMITY_WATCHDOG_INTERVAL_MS ?? '');
  if (!Number.isFinite(raw) || raw < MIN_INTERVAL_MS) return DEFAULT_INTERVAL_MS;
  return Math.floor(raw);
}

interface WatchdogGlobal {
  proximityWatchdogTimer?: ReturnType<typeof setInterval>;
  proximityWatchdogGen?: number;
  proximityWatchdogEnabled?: boolean;
  proximityPasses?: WatchdogPass[];
  proximityTotalPasses?: number;
  proximityLastSeenHead?: number | null;
  proximityAlarmSeq?: number;
  proximityAlarms?: WatchdogAlarm[] | null; // lazily loaded from the rail
}

const g = globalThis as unknown as WatchdogGlobal;
const GENERATION = Date.now();

// ─── the alarm rail (append-only JSONL, survives restarts) ──────────────────

async function ensureRailDir(): Promise<void> {
  await mkdir(path.dirname(ALARMS_PATH), { recursive: true });
}

async function loadAlarms(): Promise<WatchdogAlarm[]> {
  if (g.proximityAlarms) return g.proximityAlarms;
  try {
    const text = await readFile(ALARMS_PATH, 'utf8');
    const alarms: WatchdogAlarm[] = [];
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        alarms.push(JSON.parse(trimmed) as WatchdogAlarm);
      } catch {
        /* a torn final line from a hard kill — skipped, never silently dropped silently */
      }
    }
    alarms.sort((a, b) => b.seq - a.seq);
    g.proximityAlarms = alarms;
    g.proximityAlarmSeq = alarms.reduce((max, a) => Math.max(max, a.seq), 0);
    return alarms;
  } catch {
    g.proximityAlarms = [];
    g.proximityAlarmSeq = 0;
    return g.proximityAlarms;
  }
}

async function raiseAlarm(alarm: Omit<WatchdogAlarm, 'seq'>): Promise<WatchdogAlarm> {
  const alarms = await loadAlarms();
  const seq = (g.proximityAlarmSeq ?? 0) + 1;
  const full: WatchdogAlarm = { ...alarm, seq };
  await ensureRailDir();
  await appendFile(ALARMS_PATH, `${JSON.stringify(full)}\n`, 'utf8');
  alarms.unshift(full);
  g.proximityAlarmSeq = seq;

  // OUT-OF-BAND DISPATCH — fire-and-forget, AFTER the rail line is durable.
  // The rail is the evidence of record; the webhook is the shout. A dead
  // endpoint, a timeout, a missing config — none of it may slow, block, or
  // break the sentinel. The dispatcher logs its own attempts and its own
  // honest skipped-counter when unconfigured.
  void dispatchWebhook({
    kind: full.kind,
    mode: 'alarm',
    alarmSeq: full.seq,
    raisedAtUtc: full.raisedAtUtc,
    streamId: 'proximity.gqeberha.v1',
    brokenAt: full.brokenAt,
    reason: full.reason,
    lastGoodPosition: full.lastGoodPosition,
    lastGoodHash: full.lastGoodHash,
    sender: 'vvu-estate/proximity-sentinel',
  }).catch(() => undefined);

  return full;
}

// ─── one pass of the sentinel ────────────────────────────────────────────────

export async function watchdogPass(): Promise<WatchdogPass> {
  const t0 = Date.now();
  const verification = await verifyProximityChain(db);
  const pass: WatchdogPass = {
    atUtc: formatUtc(t0),
    valid: verification.valid,
    records: verification.records,
    headPosition: verification.headPosition,
    headHash: verification.headHash,
    latencyMs: Date.now() - t0,
    brokenAt: verification.brokenAt,
    reason: verification.reason,
  };

  const passes = (g.proximityPasses ??= []);
  passes.push(pass);
  if (passes.length > PASS_HISTORY_CAP) passes.splice(0, passes.length - PASS_HISTORY_CAP);
  g.proximityTotalPasses = (g.proximityTotalPasses ?? 0) + 1;

  if (verification.valid) {
    // The watermark only grows: a shrink is a deletion, an alarm, never a reset.
    if (verification.headPosition !== null) {
      g.proximityLastSeenHead = Math.max(g.proximityLastSeenHead ?? 0, verification.headPosition);
    }
  } else {
    const lastGood = [...passes].reverse().find((p) => p.valid) ?? null;
    const alarms = await loadAlarms();
    const newest = alarms[0] ?? null;
    // Dedupe: the rail records NEW and CHANGED faults, not the same fault
    // repeated every interval. A restart re-raises once (honest — the
    // chain is still broken under a fresh process).
    const duplicate =
      newest !== null &&
      newest.kind === 'CHAIN_BROKEN' &&
      newest.brokenAt === verification.brokenAt &&
      newest.reason === verification.reason;
    if (!duplicate) {
      await raiseAlarm({
        raisedAtUtc: formatUtc(Date.now()),
        kind: 'CHAIN_BROKEN' as WatchdogAlarmKind,
        brokenAt: verification.brokenAt,
        reason: verification.reason,
        lastGoodPosition: lastGood?.headPosition ?? null,
        lastGoodHash: lastGood?.headHash ?? null,
      });
    }
  }

  if (
    g.proximityLastSeenHead !== null &&
    g.proximityLastSeenHead !== undefined &&
    verification.headPosition !== null &&
    verification.headPosition < g.proximityLastSeenHead
  ) {
    await raiseAlarm({
      raisedAtUtc: formatUtc(Date.now()),
      kind: 'CHAIN_SHORTENED',
      brokenAt: `proximity#${verification.headPosition}`,
      reason: `head position ${verification.headPosition} < last seen ${g.proximityLastSeenHead} — records were removed`,
      lastGoodPosition: g.proximityLastSeenHead,
      lastGoodHash: null,
    });
    g.proximityLastSeenHead = verification.headPosition; // re-arm at the new reality
  }

  return pass;
}

// ─── scheduling (the estate's generation-stamped pattern) ───────────────────

function armTimer(intervalMs: number): void {
  if (g.proximityWatchdogTimer) clearInterval(g.proximityWatchdogTimer);
  const timer = setInterval(() => {
    void watchdogPass().catch((e) => console.error('[proximity-watchdog] pass failed:', e));
  }, intervalMs);
  timer.unref?.();
  g.proximityWatchdogTimer = timer;
  g.proximityWatchdogGen = GENERATION;
}

export function startProximityWatchdog(): { started: boolean; intervalMs: number; killSwitch: boolean } {
  const killSwitch = process.env.PROXIMITY_WATCHDOG === 'off';
  const intervalMs = intervalFromEnv();
  if (killSwitch) return { started: false, intervalMs, killSwitch };
  if (g.proximityWatchdogTimer && g.proximityWatchdogGen === GENERATION) {
    return { started: false, intervalMs, killSwitch }; // already ours
  }
  g.proximityWatchdogEnabled = true;
  armTimer(intervalMs);
  return { started: true, intervalMs, killSwitch };
}

/** Operator toggle — per-process by design; the alarm rail is the durable part. */
export function setWatchdogEnabled(enabled: boolean): void {
  g.proximityWatchdogEnabled = enabled;
  if (!enabled && g.proximityWatchdogTimer) {
    clearInterval(g.proximityWatchdogTimer);
    g.proximityWatchdogTimer = undefined;
  }
}

export async function watchdogStatus(): Promise<WatchdogStatus> {
  const killSwitch = process.env.PROXIMITY_WATCHDOG === 'off';
  const intervalMs = intervalFromEnv();
  const enabled = (g.proximityWatchdogEnabled ?? false) && !killSwitch;
  const running = !!g.proximityWatchdogTimer && enabled;
  const alarms = await loadAlarms();
  const passes = g.proximityPasses ?? [];

  let consecutiveValid = 0;
  for (let i = passes.length - 1; i >= 0; i -= 1) {
    if (!passes[i].valid) break;
    consecutiveValid += 1;
  }

  return {
    enabled,
    running,
    killSwitch,
    intervalMs,
    passes: [...passes],
    totalPasses: g.proximityTotalPasses ?? 0,
    consecutiveValid,
    alarms: alarms.slice(0, 40),
    alarmCount: alarms.length,
    lastSeenHeadPosition: g.proximityLastSeenHead ?? null,
    nowUtc: formatUtc(Date.now()),
  };
}

export { ALARMS_PATH };
