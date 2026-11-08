// src/server/guardian/verdict-ledger.ts — R80 · THE VERDICT READINGS LEDGER.
// ─────────────────────────────────────────────────────────────────────────────
// R78's calibration insight, made durable: a single-boot ratio is a READING;
// the TREND of the ratio across boots is the signal. Until now every verdict
// line lived in worklog archaeology — read once by a human, then gone. This
// module persists one row per RECORDED reading (boot pid · boot boundary ·
// climb · requests · MB/1k · tier · known-self · profile-next) so boot N vs
// boot N+1 comparison becomes data instead of memory.
//
// WHO computes the row: THE SERVER, not the browser. The POST route takes no
// verdict numbers from the client at all — it re-reads the plateau scope
// (the same extracted parser the chart draws), reads the in-process traffic
// counter, classifies through the SHARED tier engine (src/lib/verdict-tiers)
// and appends what it saw. The button on the page is a TRIGGER, not a source:
// the ledger can never record a number the server cannot reproduce.
//
// Honesty rules:
//   - append-only JSONL (vvu-trust/verdict/readings.jsonl), same journal
//     discipline as the sync and fleet journals — rows are never edited.
//   - a 60-second cooldown PER BOOT PID: the ratio barely moves in a minute,
//     and a ledger of spam is a ledger of lies. A refused recording returns
//     409 with the last row's timestamp — refused rows are NOT appended.
//   - corrupt lines are COUNTED (corrupt), never silently dropped — the
//     same contract the sync journal's reader holds.
//   - WINDOW-ONLY rows are recordable (the climb scope may have no boot
//     boundary inside its window) — the row carries the flag, and the trend
//     strip displays it dimmed, because a window-scoped reading is evidence
//     too; it just cannot be compared boot-to-boot.
// ─────────────────────────────────────────────────────────────────────────────

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { classifyVerdict, computeKnownSelf, type VerdictKind, type VerdictTone } from '@/lib/verdict-tiers';

import { readPlateauScope } from './plateau-scope';

const READINGS_DIR = join(process.cwd(), 'vvu-trust', 'verdict');
const READINGS_PATH = join(READINGS_DIR, 'readings.jsonl');
const COOLDOWN_MS = 60_000; // per boot pid — the ratio barely moves in a minute
const SCOPE_POINTS = 360; // ~2 hours of pass log — the same window the chart draws

export type ReadingVia = 'operator' | 'auto-guardian';

/** R99 — provenance from the POST's own header: the guardian's auto-pair
 *  marks its triggers with X-VVU-Auto: guardian; everything else (the
 *  operator's button, a dev round's curl) reads as the operator's hand.
 *  A pure function so the r99 regression pins it. */
export function viaFromHeader(header: string | null | undefined): ReadingVia {
  return String(header ?? '').trim().toLowerCase() === 'guardian' ? 'auto-guardian' : 'operator';
}

export interface VerdictReadingRow {
  at: string; // recorded-at, "YYYY-MM-DD HH:MM:SS UTC"
  atMs: number;
  bootPid: number;
  /** R86 — the dev TREE ROOT pid (the guardian's bounce namespace — the pid
   *  bounces.jsonl's newPid speaks, the pidfile's pid). The dev topology is
   *  bun → bash → next-server: process.pid (bootPid) is the SERVING WORKER,
   *  the tree root is its ancestor. Both are honest; they answer different
   *  questions — bootPid: who served this reading (and holds the traffic
   *  counter, and keys the cooldown); devTreePid: which guardian bounce this
   *  boot belongs to (the join key to the journal). Rows before R86 carry
   *  null here — append-only means the old rows are never rewritten. */
  devTreePid: number | null;
  uptimeSec: number;
  bootStartUtc: string | null; // the journal's boot boundary the climb was cut at
  windowOnly: boolean; // no boot boundary inside the scope window
  climbMb: number;
  requests: number;
  reqPerMin: number | null;
  mbPer1k: number | null;
  kind: VerdictKind;
  tone: VerdictTone;
  /** R99 — who triggered the reading: the operator's button ('operator')
   *  or the guardian's post-bounce auto-pair ('auto-guardian'). Rows before
   *  R99 lack the field — append-only means they are never rewritten; the
   *  UI renders the absence as the operator's hand (the only trigger that
   *  existed before R99). */
  via?: ReadingVia;
  knownSelfPct: number | null;
  residualReq: number | null;
  profileNextKey: string | null;
  profileNextCount: number | null;
  routesTracked: number | null;
}

export interface VerdictLedgerRead {
  present: boolean;
  rows: VerdictReadingRow[]; // newest first
  total: number;
  corrupt: number;
  cooldownMs: number;
}

export function readVerdictLedger(): VerdictLedgerRead {
  if (!existsSync(READINGS_PATH)) {
    return { present: false, rows: [], total: 0, corrupt: 0, cooldownMs: COOLDOWN_MS };
  }
  const rows: VerdictReadingRow[] = [];
  let corrupt = 0;
  for (const line of readFileSync(READINGS_PATH, 'utf8').split('\n').filter(Boolean)) {
    try {
      rows.push(JSON.parse(line) as VerdictReadingRow);
    } catch {
      corrupt += 1;
    }
  }
  const total = rows.length;
  return { present: true, rows: rows.slice(-500).reverse(), total, corrupt, cooldownMs: COOLDOWN_MS };
}

export type RecordOutcome =
  | { ok: true; row: VerdictReadingRow; ledgerTotal: number }
  | { ok: false; status: 409; error: string; lastRowAt: string | null; retryableAfterSec: number }
  | { ok: false; status: 503; error: string };

/** Record ONE reading — everything computed from the server's own sources. */
export function recordVerdictReading(via: ReadingVia = 'operator'): RecordOutcome {
  // The traffic counter lives in THIS process (the instrumentation hook).
  const g = globalThis as {
    __vvuRequestsSinceBoot?: number;
    __vvuRouteCounts?: Map<string, number>;
  };
  const requests = g.__vvuRequestsSinceBoot ?? null;
  const counts = g.__vvuRouteCounts;
  const routes = counts
    ? [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
    : [];
  const routesArmed = counts != null;

  // The climb comes from the SAME parser the scope chart draws.
  const scope = readPlateauScope(SCOPE_POINTS);
  const climbMb = scope.present ? scope.stats?.climbMb ?? null : null;

  // A row without both sides of the ratio is not a reading — refuse honestly
  // rather than append a hollow row (the client disables the button for these
  // states; the server enforces it too, because a ledger trusts nobody).
  if (climbMb == null) {
    return {
      ok: false,
      status: 503,
      error: 'no boot-scoped climb available (fewer than two healthy passes at this boot boundary) — nothing to record yet',
    };
  }
  if (requests == null) {
    return {
      ok: false,
      status: 503,
      error: 'the traffic counter is not armed in this process — the next boot arms it; nothing to record yet',
    };
  }

  const classification = classifyVerdict({
    plateauPresent: scope.present,
    climbMb,
    counterArmed: true,
    requests,
  });
  const knownSelf = computeKnownSelf(routes, requests, routesArmed);
  const uptimeSec = Math.round(process.uptime());
  const reqPerMin = uptimeSec > 0 ? Math.round((requests / uptimeSec) * 60) : null;

  // The cooldown is per boot pid — a fresh boot may be recorded immediately
  // (its row is the boundary's own snapshot), a re-click a minute later may
  // not (the ratio has not moved enough to be worth a row).
  const nowMs = Date.now();
  const bootPid = process.pid;
  // R86 — the tree root comes from the SAME scope read the climb came from:
  // the guardian pass log carries devPid on every line, and the scope keeps
  // it per sample. The newest UP pass speaks for the boot as it stands.
  const devTreePid =
    scope.samples && scope.samples.length > 0
      ? scope.samples[scope.samples.length - 1]?.devPid ?? null
      : null;
  if (existsSync(READINGS_PATH)) {
    const lines = readFileSync(READINGS_PATH, 'utf8').split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const row = JSON.parse(lines[i] ?? '{}') as VerdictReadingRow;
        if (row.bootPid !== bootPid) continue; // a previous boot's row never blocks this one
        const rowMs = typeof row.atMs === 'number' ? row.atMs : NaN;
        if (Number.isFinite(rowMs) && nowMs - rowMs < COOLDOWN_MS) {
          const waitSec = Math.ceil((COOLDOWN_MS - (nowMs - rowMs)) / 1000);
          return {
            ok: false,
            status: 409,
            error: `this boot was already recorded ${Math.round((nowMs - rowMs) / 1000)}s ago — the 60s cooldown keeps the ledger readable, no thrash`,
            lastRowAt: row.at,
            retryableAfterSec: waitSec,
          };
        }
        break; // first row for this boot pid found and it is old enough
      } catch {
        continue; // corrupt tail — the append path owns its own honesty
      }
    }
  }

  const row: VerdictReadingRow = {
    at: new Date(nowMs).toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    atMs: nowMs,
    bootPid,
    devTreePid,
    uptimeSec,
    bootStartUtc: scope.stats?.bootStart ?? null,
    windowOnly: scope.stats?.bootComplete !== true,
    climbMb,
    requests,
    reqPerMin,
    mbPer1k: classification.mbPer1k,
    kind: classification.kind,
    tone: classification.tone,
    via,
    knownSelfPct: knownSelf.selfPct,
    residualReq: knownSelf.residual,
    profileNextKey: knownSelf.profileNext?.key ?? null,
    profileNextCount: knownSelf.profileNext?.count ?? null,
    routesTracked: counts ? counts.size : null,
  };

  mkdirSync(READINGS_DIR, { recursive: true });
  appendFileSync(READINGS_PATH, JSON.stringify(row) + '\n', 'utf8');
  const total = existsSync(READINGS_PATH)
    ? readFileSync(READINGS_PATH, 'utf8').split('\n').filter(Boolean).length
    : 1;
  return { ok: true, row, ledgerTotal: total };
}
