// src/server/guardian/plateau-scope.ts — R80 · the plateau READ, extracted.
// ─────────────────────────────────────────────────────────────────────────────
// The R72 scope endpoint's parser moves here verbatim so a SECOND reader can
// join: the verdict ledger (R80) records boot-scoped climbs computed by the
// EXACT same code the scope draws — one parser, two readers, zero drift.
// The endpoint's response contract is unchanged (the client cannot tell the
// difference, which is the point).
//
// Sources (honesty rules unchanged from R72/R73):
//   guardian.log (+ .1 rotated generation, read FIRST) — one line per 20s
//     pass; DOWN passes are COUNTED, never invented into the series.
//   vvu-trust/guardian/bounces.jsonl — real saves become the BOOT BOUNDARY
//     markers; boundaries come from the journal, never guessed from dips.
//   vvu-trust/guardian/status.json — guardMb/intervalSec for the scope's
//     guard line.
//
// READ-ONLY: the request path touches three files and returns.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const GUARDIAN_LOG = join(ROOT, '.zscripts', 'guardian.log');
const GUARDIAN_LOG_PREV = `${GUARDIAN_LOG}.1`; // R73 — rotated generation (older)
const JOURNAL_PATH = join(ROOT, 'vvu-trust', 'guardian', 'bounces.jsonl');
const STATUS_PATH = join(ROOT, 'vvu-trust', 'guardian', 'status.json');

export const DEFAULT_POINTS = 360; // 20s interval → ~2 hours of shape
export const MAX_POINTS = 720; // ~4 hours — enough to read a full plateau cycle

export interface ScopeSample {
  at: string; // verbatim guardian stamp "YYYY-MM-DD HH:MM:SS UTC"
  atMs: number;
  rssMb: number;
  hwmMb: number | null;
  availMb: number | null;
  port: 'UP' | 'DOWN';
  decision: string; // verbatim tail ("monitor", "port dead (1/2)", …)
  pid: number | null; // the next-server pid the guardian watched on that pass
  devPid: number | null; // the dev TREE ROOT pid — the namespace the journal's oldPid/newPid speak
}

export interface ScopeMarker {
  at: string;
  atMs: number;
  reason: string;
  ok: boolean;
  downtimeMs: number | null;
  oldPid: number | null;
  newPid: number | null;
}

function parseUtc(label: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC$/.exec(label.trim());
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? 0)
    : Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
}

export interface PlateauScopeResult {
  present: boolean;
  reason?: string;
  generatedAtUtc?: string;
  guardMb?: number | null;
  intervalSec?: number | null;
  requestedPoints?: number;
  logGenerations?: Array<{ path: string; present: boolean; lines: number }>;
  window?: {
    passes: number;
    downPasses: number;
    lastDownAt: string | null;
    otherLines: number;
    since: string | null;
    until: string | null;
    spanSec: number | null;
  };
  samples?: ScopeSample[];
  markers?: ScopeMarker[];
  stats?: {
    firstMb: number | null;
    lastMb: number | null;
    minMb: number | null;
    maxMb: number | null;
    climbMb: number | null;
    bootStart: string | null;
    bootComplete: boolean;
    bootPids: [number | null, number | null] | null;
    baselineMb: number | null;
  };
  otherLines?: number;
}

/** The whole scope read — called by the plateau-history endpoint (the chart)
 *  and by the verdict ledger (recorded rows). `points` is the UP-pass cap. */
export function readPlateauScope(points: number): PlateauScopeResult {
  if (!existsSync(GUARDIAN_LOG) && !existsSync(GUARDIAN_LOG_PREV)) {
    return {
      present: false,
      reason: 'guardian.log absent — the scope reads the guardian pass log; no log, no invention',
    };
  }

  // R73 — read BOTH generations: the rotated .1 (older) first, then the
  // live log. Concatenated [.1, live] keeps chronological order for the
  // newest-first walk below. Either generation alone is enough to draw.
  const generations: Array<{ path: string; present: boolean; lines: number }> = [];
  let text = '';
  for (const [path, label] of [
    [GUARDIAN_LOG_PREV, 'rotated'],
    [GUARDIAN_LOG, 'live'],
  ] as const) {
    if (!existsSync(path)) {
      generations.push({ path: label, present: false, lines: 0 });
      continue;
    }
    try {
      const t = readFileSync(path, 'utf8');
      text += t;
      generations.push({ path: label, present: true, lines: t.split('\n').filter((l) => l.trim()).length });
    } catch (e) {
      // one unreadable generation must not kill the scope — count it honestly
      generations.push({ path: label, present: false, lines: 0 });
      text += `\n[unreadable generation: ${e instanceof Error ? e.message : String(e)}]\n`;
    }
  }
  const anyGenerationPresent = generations.some((g) => g.present);

  // Guard + interval come from the status file when it exists (the scope
  // draws the guard line; without a status file there is no guard value).
  let guardMb: number | null = null;
  let intervalSec: number | null = null;
  try {
    if (existsSync(STATUS_PATH)) {
      const st = JSON.parse(readFileSync(STATUS_PATH, 'utf8')) as { guardMb?: number; intervalSec?: number };
      guardMb = typeof st.guardMb === 'number' ? st.guardMb : null;
      intervalSec = typeof st.intervalSec === 'number' ? st.intervalSec : null;
    }
  } catch {
    // status unreadable — the scope can still draw the series honestly
  }

  // Walk newest-first, cap at `points` UP passes. The line regex is
  // tolerant of the older no-avail format and captures the whole decision
  // tail verbatim (including DOWN counts like "port dead (1/2)").
  const lines = text.split('\n');
  const passRe =
    /^\[([^\]]+)\] pass nextPid=(\S+) rss=(\d+|None) hwm=(\d+|None)(?: avail=(\d+)MB)? port=(UP|DOWN) devPid=(\d+)(?:\(\w+\))? decision=(.+)$/;
  const samples: ScopeSample[] = [];
  let downPasses = 0;
  let lastDownAt: string | null = null;
  let otherLines = 0;
  for (let i = lines.length - 1; i >= 0 && samples.length < points; i--) {
    const line = lines[i] ?? '';
    if (!line.trim()) continue;
    const m = passRe.exec(line);
    if (!m) {
      otherLines += 1; // BOUNCE begin/OK, guardian armed, drill notes…
      continue;
    }
    if (m[6] === 'DOWN') {
      // A dead-port pass has no RSS to plot — counted, never invented.
      downPasses += 1;
      lastDownAt = m[1] ?? lastDownAt;
      continue;
    }
    const rss = Number(m[3]);
    if (!m[1] || !Number.isFinite(rss) || rss <= 0) continue;
    const hwm = m[4] && m[4] !== 'None' ? Number(m[4]) : null;
    const avail = m[5] ? Number(m[5]) : null;
    const pidRaw = m[2];
    const devPidRaw = m[7];
    samples.push({
      at: m[1],
      atMs: parseUtc(m[1]),
      rssMb: Math.round(rss / 1024),
      hwmMb: hwm != null && Number.isFinite(hwm) ? Math.round(hwm / 1024) : null,
      availMb: avail != null && Number.isFinite(avail) ? avail : null,
      port: 'UP',
      decision: (m[8] ?? '').trim(),
      pid: pidRaw && pidRaw !== 'None' && Number.isFinite(Number(pidRaw)) ? Number(pidRaw) : null,
      devPid: devPidRaw && Number.isFinite(Number(devPidRaw)) ? Number(devPidRaw) : null,
    });
  }

  if (samples.length === 0) {
    return {
      present: false,
      reason: anyGenerationPresent
        ? 'no parsable UP passes in guardian.log yet — the scope needs at least one healthy pass'
        : 'guardian.log unreadable — no generation could be read',
      otherLines,
      logGenerations: generations,
    };
  }

  // Chronological order for the series; window bounds from the samples.
  const chron = [...samples].reverse();
  const since = chron[0]?.at ?? null;
  const until = chron[chron.length - 1]?.at ?? null;
  const sinceMs = chron[0]?.atMs ?? NaN;
  const windowStartMs = Number.isFinite(sinceMs) ? sinceMs : 0;

  // Boot boundaries from the JOURNAL (append-only evidence): every real
  // (non-drill) bounce inside the window is where a boot began. Drill rows
  // never touched the real surface → not boundaries.
  const markers: ScopeMarker[] = [];
  if (existsSync(JOURNAL_PATH)) {
    try {
      const rows = readFileSync(JOURNAL_PATH, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as Record<string, unknown>;
          } catch {
            return null; // corrupt rows are the chronicle's business; skip here
          }
        })
        .filter((r): r is Record<string, unknown> => r !== null);
      for (const r of rows) {
        if (r.drill === true) continue;
        const at = typeof r.at === 'string' ? r.at : null;
        if (!at) continue;
        const atMs = parseUtc(at);
        if (!Number.isFinite(atMs) || atMs < windowStartMs) continue;
        markers.push({
          at,
          atMs,
          reason: typeof r.reason === 'string' ? r.reason : 'unknown',
          ok: r.ok === true,
          downtimeMs: typeof r.downtimeMs === 'number' ? r.downtimeMs : null,
          oldPid: typeof r.oldPid === 'number' ? r.oldPid : null,
          newPid: typeof r.newPid === 'number' ? r.newPid : null,
        });
      }
      markers.sort((a, b) => a.atMs - b.atMs);
    } catch {
      // journal unreadable → no markers; the climb reads over the window
    }
  }

  // Stats — first/last/min/max across the window; the CLIMB is measured
  // over the current boot only. DOGFOODED at 09:20:49 (the round's own rss
  // save): the first sample timestamped AFTER the marker can still be the
  // DYING boot's final over-guard pass, and the journal's newPid is the
  // dev TREE ROOT while pass lines carry the next-server CHILD pid — so
  // the cut is three-tier, most-honest first:
  //   1. devPid === marker.newPid  (the journal row joined to the line's
  //      own tree-root field — exact)
  //   2. pid !== the dying boot's last-seen pid (namespace-safe fallback)
  //   3. atMs > marker.atMs        (the crude timestamp cut, last resort)
  const rssValues = chron.map((s) => s.rssMb);
  const firstMb = rssValues[0] ?? null;
  const lastMb = rssValues[rssValues.length - 1] ?? null;
  const minMb = rssValues.length > 0 ? Math.min(...rssValues) : null;
  const maxMb = rssValues.length > 0 ? Math.max(...rssValues) : null;
  const lastMarker = markers[markers.length - 1] ?? null;
  let bootSamples: ScopeSample[] = chron;
  if (lastMarker) {
    const afterMarker = chron.filter((s) => Number.isFinite(s.atMs) && s.atMs > lastMarker.atMs);
    const byDevPid =
      lastMarker.newPid != null
        ? afterMarker.filter((s) => s.devPid != null && s.devPid === lastMarker.newPid)
        : [];
    if (byDevPid.length >= 2) {
      bootSamples = byDevPid;
    } else {
      const before = chron.filter((s) => Number.isFinite(s.atMs) && s.atMs <= lastMarker.atMs);
      const dyingPid = before.length > 0 ? before[before.length - 1].pid : null;
      const byChildPid = dyingPid != null ? afterMarker.filter((s) => s.pid != null && s.pid !== dyingPid) : [];
      bootSamples = byChildPid.length >= 2 ? byChildPid : afterMarker;
    }
  }
  const bootStart = lastMarker ? lastMarker.at : since;
  const climbMb =
    bootSamples.length >= 2 && bootSamples[0] && bootSamples[bootSamples.length - 1]
      ? bootSamples[bootSamples.length - 1].rssMb - bootSamples[0].rssMb
      : null;

  // Baseline contract (R69, unchanged): median of the 10 NEWEST passes.
  const newest = chron.slice(-10);
  const baselineMb = newest.length > 0 ? Math.round(medianOf(newest.map((s) => s.rssMb))) : null;

  const spanSec =
    Number.isFinite(sinceMs) && Number.isFinite(chron[chron.length - 1]?.atMs ?? NaN)
      ? Math.round(((chron[chron.length - 1]?.atMs ?? 0) - sinceMs) / 1000)
      : null;

  return {
    present: true,
    generatedAtUtc: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    guardMb,
    intervalSec,
    requestedPoints: points,
    // R73 — provenance: which log generations fed this series (the UI
    // surfaces a ROTATED GENERATION note when the scope spans a rotation).
    logGenerations: generations,
    window: {
      passes: chron.length,
      downPasses,
      lastDownAt,
      otherLines,
      since,
      until,
      spanSec,
    },
    samples: chron,
    markers,
    stats: {
      firstMb,
      lastMb,
      minMb,
      maxMb,
      climbMb,
      bootStart,
      bootComplete: lastMarker != null,
      bootPids: bootSamples.length >= 2 ? [bootSamples[0].pid, bootSamples[bootSamples.length - 1].pid] : null,
      baselineMb,
    },
  };
}
