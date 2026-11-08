// R111 — THE BOOT LEDGER: every boot's tenure on port 3000.
//
// The record counts deaths meticulously — 17 witnessed kills, 51 saves,
// ceilings, floors, drifts — but it never once asked the simplest question
// a mortality record can ask: HOW LONG DID EACH BOOT LIVE? The guardian's
// bounce journal (vvu-trust/guardian/bounces.jsonl, one row per bounce
// attempt, the append-only file that has survived every respawn) carries
// the full spawn/death chain: every row names the boot it killed (oldPid)
// and the boot it spawned (newPid). Walk the chain and each pid becomes a
// lifespan — a TENURE: how long that boot held the port before something
// ended it.
//
//   THE WALK: rows in journal order. A row whose oldPid is a tracked boot
//   with no death yet is that boot's DEATH row (any ok — a failed save
//   still killed its old boot). A row with oldPid !== newPid and ok:true
//   SPAWNS a boot (newPid) at that stamp. A row with oldPid === newPid is
//   a re-land — the same boot re-confirmed, no spawn, no death across it.
//
//   THE DRILLS: the journal also carries the drill harness's victim
//   bounces (drill:true, port 3999). Those are NOT the estate's boots —
//   a drill victim dies by the drill, unjournaled, and would pollute the
//   chain with ghost immortals. The engine EXCLUDES them and names the
//   count. What remains is port-3000's own chain (early rows predate the
//   port field; the drill flag is the honest filter).
//
//   THE END STATES — every tracked boot ends in exactly one of three
//   named states, and the difference is never papered over:
//     · deceased — a later row killed it. Tenure = death − spawn.
//     · living   — no death row AND it is the CURRENT dev pid (handed in,
//                  read from the same dev.pid file the guardian uses).
//                  Tenure = now − spawn, censored, excluded from the
//                  settled population (a life without an end has no
//                  settled tenure).
//     · unjournaled — no death row and NOT the current pid: the boot's
//                  end happened outside the journal's reach. Its tenure
//                  is UNKNOWN (null) — never invented, never "assumed
//                  still alive".
//     · stillborn is a FLAG across deceased/living: a boot whose spawn
//                  row was ok:false — it was written down but never
//                  confirmed to serve a 200 (the failed bounce's child).
//
//   THE ROOT: the first kept row's oldPid was born before the record —
//   its spawn is not in the journal. It is NAMED (pid + "born before the
//   record") and excluded from every tenure statistic: a boot without a
//   witnessed spawn has no honest tenure.
//
//   THE STATS: settled = deceased && served. Median tenure, the longest
//   and shortest settled tenures with their pids, halves median (the
//   pair-sheet convention, floor(n/2)), and an OLS of settled tenure vs
//   spawn index — are boots living shorter as the record ages? Trend word
//   SHORTENING / LENGTHENING / FLAT on ±TENURE_TREND_MIN_PER_BOOT strict,
//   refused below TENURE_MIN_TREND_N settled boots (TOO FEW). Confidence
//   rides the SHARED R2_CALL_THRESHOLD (imported from three-drifts — one
//   calibration, many readers).
//
//   THE KILLER LENS: tenure-at-death grouped by the journal's own death
//   reason (rss / port / avail-critical / whatever the journal writes) —
//   do young boots die of a different cause than old ones? Descriptive
//   medians only; the engine never calls a killer.
//
// Pure: no I/O, no clock of its own (nowMs and currentDevPid are handed
// in), no re-derivation of anything the journal already says.

import { R2_CALL_THRESHOLD } from './three-drifts';

/** Below this many settled tenures the trend refuses (TOO FEW). */
export const TENURE_MIN_TREND_N = 8;
/** Strict ± band (min/boot) around zero for the trend word — calibrated
 *  on the live record (n=48: slope −0.17 min/boot, R² 0.01, FLAT). */
export const TENURE_TREND_MIN_PER_BOOT = 1.0;
/** The route's bounded read — the journal grows one row per bounce
 *  (~27 min median); the tail bound keeps the read bounded forever. */
export const BOOT_JOURNAL_TAIL_ROWS = 2000;

export interface BounceRowInput {
  at: string;
  reason: string;
  ok: boolean;
  oldPid: number;
  newPid: number;
  /** The journal's own grammar writes null on pre-field rows — the engine
   *  reads null and false alike as "not a drill" (the drill flag OR the
   *  drill port is the honest filter). */
  drill?: boolean | null;
  port?: number | null;
}

export type BootEndState = 'deceased' | 'living' | 'unjournaled';

export interface BootTenure {
  pid: number;
  spawnAt: string;
  spawnMs: number;
  /** spawn row ok:true — the boot was confirmed serving. */
  served: boolean;
  /** spawn row ok:false — written down, never confirmed serving. */
  stillborn: boolean;
  deathAt: string | null;
  deathMs: number | null;
  deathReason: string | null;
  /** The death row's own ok — a failed save's kill is still a death. */
  deathOk: boolean | null;
  endState: BootEndState;
  /** minutes: deceased = death − spawn; living = now − spawn (censored);
   *  unjournaled = null (unknown, never invented). */
  tenureMin: number | null;
  /** Order of spawn among tracked boots (0-based, journal order). */
  spawnIndex: number;
}

export interface ReasonTenure {
  reason: string;
  n: number;
  medianMin: number | null;
  minMin: number | null;
  maxMin: number | null;
}

export interface BootLedgerRead {
  drillsExcluded: number;
  rowsKept: number;
  unparsedRows: number;
  root: { pid: number; note: string } | null;
  boots: BootTenure[];
  settledCount: number;
  livingCount: number;
  stillbornPids: number[];
  unjournaledPids: number[];
  medianTenureMin: number | null;
  longest: { pid: number; tenureMin: number; from: string; to: string } | null;
  shortest: { pid: number; tenureMin: number; from: string; to: string } | null;
  firstHalfMedianMin: number | null;
  lastHalfMedianMin: number | null;
  slopeMinPerBoot: number | null;
  r2: number | null;
  trend: 'SHORTENING' | 'LENGTHENING' | 'FLAT' | 'TOO FEW';
  /** true when |slope| ≥ the band AND r2 ≥ R2_CALL_THRESHOLD — a trend
   *  word is SHOWN, its confidence is DRAWN (the panel dashes a loose one). */
  trendTight: boolean;
  tenureByDeath: ReasonTenure[];
  livingTenureMin: number | null;
  livingVsMedian: number | null;
  note: string;
}

/** Parse the journal's own stamp grammar: "YYYY-MM-DD HH:MM:SS UTC". */
export function parseJournalStamp(at: string): number | null {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) UTC$/.exec(at);
  if (!m) return null;
  const ms = Date.parse(`${m[1]}T${m[2]}Z`);
  return Number.isFinite(ms) ? ms : null;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function olsSlopeR2(xs: number[], ys: number[]): { slope: number; r2: number } | null {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) * (xs[i] - mx);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const sst = ys.reduce((a, y) => a + (y - my) * (y - my), 0);
  const ssr = ys.reduce((a, y, i) => {
    const fit = my + slope * (xs[i] - mx);
    return a + (y - fit) * (y - fit);
  }, 0);
  const r2 = sst === 0 ? 0 : 1 - ssr / sst;
  return { slope, r2 };
}

function buildNote(r: {
  drillsExcluded: number;
  settledCount: number;
  stillbornPids: number[];
  unjournaledPids: number[];
  medianTenureMin: number | null;
  longest: BootLedgerRead['longest'];
  firstHalfMedianMin: number | null;
  lastHalfMedianMin: number | null;
  trend: BootLedgerRead['trend'];
  slopeMinPerBoot: number | null;
  r2: number | null;
  trendTight: boolean;
  tenureByDeath: ReasonTenure[];
  livingTenureMin: number | null;
  root: BootLedgerRead['root'];
}): string {
  const parts: string[] = [];
  parts.push(
    `${r.settledCount} settled boots held the port a median ${r.medianTenureMin !== null ? round1(r.medianTenureMin) : '—'} min`,
  );
  if (r.longest) {
    parts.push(
      `the longest tenure ${round1(r.longest.tenureMin)} min (pid ${r.longest.pid}, ${r.longest.from} → ${r.longest.to})`,
    );
  }
  if (r.firstHalfMedianMin !== null && r.lastHalfMedianMin !== null) {
    parts.push(
      `halves ${round1(r.firstHalfMedianMin)} → ${round1(r.lastHalfMedianMin)} min`,
    );
  }
  if (r.trend === 'TOO FEW') {
    parts.push(`tenure trend TOO FEW (needs ${TENURE_MIN_TREND_N} settled boots)`);
  } else if (r.slopeMinPerBoot !== null && r.r2 !== null) {
    parts.push(
      `tenure ${r.trend} ${r.slopeMinPerBoot >= 0 ? '+' : ''}${round1(r.slopeMinPerBoot)} min/boot R² ${round1(r.r2)}${r.trendTight ? '' : ' · loose'}`,
    );
  }
  if (r.stillbornPids.length) {
    parts.push(`stillborn (spawned ok:false, never confirmed serving): ${r.stillbornPids.join(', ')}`);
  }
  if (r.unjournaledPids.length) {
    parts.push(`${r.unjournaledPids.length} boot(s) end unjournaled — tenure unknown, not assumed alive`);
  }
  if (r.livingTenureMin !== null) {
    parts.push(`the boot serving now has lived ${round1(r.livingTenureMin)} min (censored — a life without an end has no settled tenure)`);
  }
  const killers = r.tenureByDeath.filter((k) => k.n > 0);
  if (killers.length) {
    parts.push(
      `tenure at death by cause: ${killers.map((k) => `${k.reason} n=${k.n} median ${k.medianMin !== null ? round1(k.medianMin) : '—'} min`).join(' · ')}`,
    );
  }
  if (r.drillsExcluded > 0) {
    parts.push(`${r.drillsExcluded} drill rows excluded (a drill victim dies by the drill, not the estate)`);
  }
  if (r.root) {
    parts.push(`root pid ${r.root.pid} born before the record — no witnessed spawn, no honest tenure`);
  }
  return parts.join(' · ');
}

/** THE WALK — the bounce journal in, every boot's tenure out. */
export function buildBootLedger(
  rows: Array<BounceRowInput>,
  opts: { nowMs: number; currentDevPid: number | null },
): BootLedgerRead {
  const drillsExcluded = rows.filter((r) => r.drill === true || r.port === 3999).length;
  const kept = rows.filter((r) => !(r.drill === true || r.port === 3999));

  let unparsedRows = 0;
  const boots = new Map<number, BootTenure>();
  const order: number[] = [];

  for (const row of kept) {
    const ms = parseJournalStamp(row.at);
    if (ms === null) {
      unparsedRows += 1;
      continue;
    }
    const oldPid = row.oldPid;
    const newPid = row.newPid;
    // The death leg: a tracked boot with no death yet meets its end.
    if (boots.has(oldPid)) {
      const b = boots.get(oldPid)!;
      if (b.deathMs === null) {
        b.deathAt = row.at;
        b.deathMs = ms;
        b.deathReason = typeof row.reason === 'string' ? row.reason : 'unknown';
        b.deathOk = row.ok === true;
      }
    }
    // The spawn leg: oldPid === newPid is a re-land, never a spawn.
    if (oldPid === newPid) continue;
    if (!boots.has(newPid)) {
      boots.set(newPid, {
        pid: newPid,
        spawnAt: row.at,
        spawnMs: ms,
        served: row.ok === true,
        stillborn: row.ok !== true,
        deathAt: null,
        deathMs: null,
        deathReason: null,
        deathOk: null,
        endState: 'unjournaled',
        tenureMin: null,
        spawnIndex: order.length,
      });
      order.push(newPid);
    }
  }

  // The root: the first kept row's oldPid, if it was never spawned here.
  let root: BootLedgerRead['root'] = null;
  if (kept.length) {
    const firstOld = kept[0].oldPid;
    if (!boots.has(firstOld)) {
      root = { pid: firstOld, note: 'born before the record — no witnessed spawn, no honest tenure' };
    }
  }

  // End states need now and the current pid.
  const list = order.map((pid) => {
    const b = boots.get(pid)!;
    if (b.deathMs !== null) {
      b.endState = 'deceased';
      b.tenureMin = (b.deathMs - b.spawnMs) / 60000;
    } else if (opts.currentDevPid !== null && b.pid === opts.currentDevPid) {
      b.endState = 'living';
      b.tenureMin = Math.max(0, (opts.nowMs - b.spawnMs) / 60000);
    } else {
      b.endState = 'unjournaled';
      b.tenureMin = null;
    }
    return b;
  });

  const settled = list.filter((b) => b.endState === 'deceased' && b.served);
  const settledTenures = settled.map((b) => b.tenureMin as number);
  const medianTenureMin = median(settledTenures);

  let longest: BootLedgerRead['longest'] = null;
  let shortest: BootLedgerRead['longest'] = null;
  for (const b of settled) {
    const t = b.tenureMin as number;
    if (longest === null || t > longest.tenureMin) {
      longest = { pid: b.pid, tenureMin: t, from: b.spawnAt, to: b.deathAt as string };
    }
    if (shortest === null || t < shortest.tenureMin) {
      shortest = { pid: b.pid, tenureMin: t, from: b.spawnAt, to: b.deathAt as string };
    }
  }

  // Halves on the pair-sheet convention: floor(n/2) each side.
  const half = Math.floor(settled.length / 2);
  const firstHalfMedianMin =
    half > 0 ? median(settled.slice(0, half).map((b) => b.tenureMin as number)) : null;
  const lastHalfMedianMin =
    half > 0 ? median(settled.slice(settled.length - half).map((b) => b.tenureMin as number)) : null;

  // OLS: settled tenure vs spawn index. Refuses below the named floor.
  let slopeMinPerBoot: number | null = null;
  let r2: number | null = null;
  let trend: BootLedgerRead['trend'] = 'TOO FEW';
  let trendTight = false;
  if (settled.length >= TENURE_MIN_TREND_N) {
    const fit = olsSlopeR2(
      settled.map((b) => b.spawnIndex),
      settledTenures,
    );
    if (fit) {
      slopeMinPerBoot = fit.slope;
      r2 = fit.r2;
      if (fit.slope < -TENURE_TREND_MIN_PER_BOOT) trend = 'SHORTENING';
      else if (fit.slope > TENURE_TREND_MIN_PER_BOOT) trend = 'LENGTHENING';
      else trend = 'FLAT';
      trendTight = r2 >= R2_CALL_THRESHOLD;
    }
  }

  // The killer lens: tenure at death, grouped by the journal's own reason.
  const byReason = new Map<string, number[]>();
  for (const b of settled) {
    const reason = b.deathReason ?? 'unknown';
    if (!byReason.has(reason)) byReason.set(reason, []);
    byReason.get(reason)!.push(b.tenureMin as number);
  }
  const tenureByDeath: ReasonTenure[] = [...byReason.entries()]
    .map(([reason, xs]) => ({
      reason,
      n: xs.length,
      medianMin: median(xs),
      minMin: xs.length ? Math.min(...xs) : null,
      maxMin: xs.length ? Math.max(...xs) : null,
    }))
    .sort((a, b) => b.n - a.n || a.reason.localeCompare(b.reason));

  const living = list.filter((b) => b.endState === 'living');
  const livingTenureMin = living.length === 1 ? (living[0].tenureMin as number) : null;
  const livingVsMedian =
    livingTenureMin !== null && medianTenureMin !== null && medianTenureMin > 0
      ? livingTenureMin / medianTenureMin
      : null;

  const read: BootLedgerRead = {
    drillsExcluded,
    rowsKept: kept.length,
    unparsedRows,
    root,
    boots: list,
    settledCount: settled.length,
    livingCount: living.length,
    stillbornPids: list.filter((b) => b.stillborn).map((b) => b.pid),
    unjournaledPids: list.filter((b) => b.endState === 'unjournaled').map((b) => b.pid),
    medianTenureMin,
    longest,
    shortest,
    firstHalfMedianMin,
    lastHalfMedianMin,
    slopeMinPerBoot,
    r2,
    trend,
    trendTight,
    tenureByDeath,
    livingTenureMin,
    livingVsMedian,
    note: '',
  };
  read.note = buildNote(read);
  return read;
}
