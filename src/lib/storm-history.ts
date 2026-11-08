// src/lib/storm-history.ts — R103 · THE STORM HISTORY, the record's heartbeat.
// ─────────────────────────────────────────────────────────────────────────────
// R100's ceiling strip drew WHERE the dead topped out (the band, the guard
// menu's geography). R101's living read drew where the LIVING boot rides.
// Both panels freeze time — the strip's diamonds float in MB space with no
// when, and the two questions the handovers kept asking need exactly that
// axis:
//
//   DOES THE BAND DRIFT AS THE STORM AGES?  The ceiling cluster is 9 kills
//   deep, all inside one storm window. If the oscillation tops out higher
//   kill after kill, the storm is DEEPENING and every guard read on the
//   menu (↓ALL / ±SOME / ↑NEVER) is a snapshot of a moving geography. If it
//   holds, the band is a place and the menu's classes are stable. The read:
//   OLS of ceiling vs kill sequence (MB per kill) + the first-half median
//   against the second-half median — two estimators, one shown beside the
//   other, neither allowed to hide behind the mean.
//
//   IS THE REGIME TURNING?  The kill intervals are the storm's heartbeat.
//   The cadence read compares the recent median gap (last 3) against the
//   full witnessed median: a stretch means the storm is loosening, a
//   quickening means it is tightening — and STEADY, the honest default,
//   means the recent beats sit inside the record's own spread.
//
// Honesty rules (the estate's own, inherited):
//   - journal order is chronology; the sequence axis is the witnessed era
//     only (witness coverage began R94 — earlier kills cannot appear here,
//     and the panel says so rather than backfilling).
//   - a null ceiling keeps its beat row (the kill happened; the record says
//     so) but drops from every drift statistic — counted, never imputed.
//   - an unparsable stamp keeps its beat but contributes no gap; the gaps
//     on either side of it stay null rather than bridging the hole.
//   - every threshold is a FIRST CALIBRATION named in a constant — re-read
//     as the record grows, exactly like the witness windows' 15 MB/min.
//   - the drift read is a STORM-WINDOW read: nine kills inside ~3 hours
//     cannot testify about the quiet regime the storm interrupted. The
//     panel discloses the window it lives in; it never declares a climate.
// ─────────────────────────────────────────────────────────────────────────────

/** Drift needs at least this many judged ceilings before a slope is named
 *  (a two-point "trend" is a line, not a read). First calibration: the
 *  witnessed population passed 4 kills mid-storm at R100; 4 is the smallest
 *  population where a halves comparison also exists. */
export const MIN_DRIFT_KILLS = 4;

/** |OLS slope| above this reads rising/settling rather than flat (MB per
 *  kill). First calibration: the witnessed cluster's own spread is ~168 MB
 *  across 9 kills — 10 MB/kill is the smallest migration that outruns the
 *  sampling noise the windows already swear by. */
export const DRIFT_THRESHOLD_MB_PER_KILL = 10;

/** The cadence read needs at least this many intervals (the recent window
 *  plus at least one beat before it). */
export const MIN_CADENCE_INTERVALS = 4;

/** How many of the most recent gaps form the recent-median side of the
 *  cadence ratio. Three matches the living read's recent-tail discipline:
 *  the freshest beats, not the whole history. */
export const RECENT_INTERVALS = 3;

/** recent-median ÷ full-median above this reads STRETCHING. */
export const CADENCE_STRETCH_RATIO = 1.25;
/** recent-median ÷ full-median below this reads QUICKENING. */
export const CADENCE_QUICKEN_RATIO = 0.8;

/** Two witnessed kills inside this many minutes read as a double strike —
 *  the kernel's own pair, disclosed rather than averaged away. */
export const DOUBLE_KILL_GAP_MIN = 2;

export interface StormBeat {
  /** The kill stamp verbatim — the join key back to the witnessed row. */
  at: string;
  /** Parsed stamp (ms), null when the row's stamp did not parse. */
  atMs: number | null;
  /** 1-based position in the witnessed era (journal order = chronology). */
  seq: number;
  /** The witnessed window's peak rss (MB), null when the window carried no
   *  finite rss — the beat stays, the drift skips it. */
  ceilingMb: number | null;
  /** Minutes since the previous witnessed kill, null for the first beat or
   *  when either neighbor's stamp did not parse. */
  gapFromPrevMin: number | null;
}

export type DriftRead = 'rising' | 'settling' | 'flat' | null;
export type CadenceRead = 'steady' | 'quickening' | 'stretching' | null;

export interface StormHistory {
  beats: StormBeat[];
  /** Beats with a finite ceiling — the drift's honest n. */
  judged: number;
  /** First→last kill stamp in minutes, null without two parsed stamps. */
  spanMin: number | null;
  /** Median ceiling across the storm's FIRST half (journal order, middle
   *  beat dropped when the judged count is odd). */
  firstHalfMedianMb: number | null;
  /** Median ceiling across the storm's LAST half. */
  secondHalfMedianMb: number | null;
  /** OLS of ceiling vs kill sequence, MB per kill-step, null below
   *  MIN_DRIFT_KILLS. */
  driftMbPerKill: number | null;
  /** R² of that fit — how line-like the migration is (0..1). */
  driftR2: number | null;
  /** rising / settling / flat at the DRIFT_THRESHOLD calibration. */
  driftRead: DriftRead;
  /** Gaps between consecutive witnessed kills (beats 2..n), minutes. */
  intervalsMin: number[];
  /** Median of every witnessed gap. */
  medianIntervalMin: number | null;
  /** Median of the last RECENT_INTERVALS gaps — the freshest heartbeat. */
  recentMedianIntervalMin: number | null;
  /** steady / quickening / stretching at the ratio calibrations. */
  cadenceRead: CadenceRead;
  /** True when any witnessed gap landed inside the double-strike window. */
  doubleStrike: boolean;
  /** R104 — EVERY witnessed gap inside the double-strike window, with its
   *  beat pair: the 02:00Z double strike put TWO on record (kills 1→2 at
   *  1.15 min, kills 11→12 at 1.83 min) and a disclosure that names only
   *  the first is a disclosure that lies by omission. */
  doubleStrikeCount: number;
  doubleStrikeBeats: Array<{ from: number; to: number; gapMin: number }>;
  /** The honest one-liner — the engine's own reading. */
  note: string;
}

function round(v: number, places = 1): number {
  const f = 10 ** places;
  return Math.round(v * f) / f;
}

function median(vals: number[]): number | null {
  if (vals.length === 0) return null;
  const s = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** OLS of y over x (plain closed form). Returns null when the x's carry no
 *  variance (every beat at one sequence position cannot have a trend). */
function olsSlopeR2(xs: number[], ys: number[]): { slope: number; r2: number } | null {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i]! - mx) * (xs[i]! - mx);
    sxy += (xs[i]! - mx) * (ys[i]! - my);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssTot += (ys[i]! - my) * (ys[i]! - my);
    const pred = slope * xs[i]! + intercept;
    ssRes += (ys[i]! - pred) * (ys[i]! - pred);
  }
  const r2 = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 0;
  return { slope, r2: Number.isFinite(r2) ? r2 : 0 };
}

/** THE storm history — witnessed kills in, the record's heartbeat and the
 *  band's migration out. Pure: journal order is trusted as chronology (the
 *  same order every panel below it draws), ceilings join by position, and
 *  every statistic counts only what exists. The note names its own window:
 *  this is a storm-era read, not a climate verdict. */
export function stormHistory(
  kills: Array<{ at: string; atMs?: number | null; maxRssMb?: number | null }>,
): StormHistory {
  const rows = kills ?? [];
  const beats: StormBeat[] = rows.map((k, i) => {
    const atMs = typeof k?.atMs === 'number' && Number.isFinite(k.atMs) ? k.atMs : null;
    const ceilingMb =
      typeof k?.maxRssMb === 'number' && Number.isFinite(k.maxRssMb) ? k.maxRssMb : null;
    return { at: String(k?.at ?? ''), atMs, seq: i + 1, ceilingMb, gapFromPrevMin: null };
  });
  for (let i = 1; i < beats.length; i++) {
    const a = beats[i - 1]!.atMs;
    const b = beats[i]!.atMs;
    if (a != null && b != null) beats[i]!.gapFromPrevMin = round((b - a) / 60000, 2);
  }

  const judgedCeilings = beats.filter((b) => b.ceilingMb != null);
  const judged = judgedCeilings.length;

  const parsedStamps = beats.filter((b) => b.atMs != null);
  const spanMin =
    parsedStamps.length >= 2
      ? round(
          (parsedStamps[parsedStamps.length - 1]!.atMs! - parsedStamps[0]!.atMs!) / 60000,
          1,
        )
      : null;

  // ── the drift: two estimators over the judged ceilings ──
  let firstHalfMedianMb: number | null = null;
  let secondHalfMedianMb: number | null = null;
  let driftMbPerKill: number | null = null;
  let driftR2: number | null = null;
  let driftRead: DriftRead = null;
  if (judged >= MIN_DRIFT_KILLS) {
    const half = Math.floor(judged / 2);
    firstHalfMedianMb = median(judgedCeilings.slice(0, half).map((b) => b.ceilingMb!));
    secondHalfMedianMb = median(judgedCeilings.slice(judged - half).map((b) => b.ceilingMb!));
    if (firstHalfMedianMb != null) firstHalfMedianMb = round(firstHalfMedianMb);
    if (secondHalfMedianMb != null) secondHalfMedianMb = round(secondHalfMedianMb);
    const fit = olsSlopeR2(
      judgedCeilings.map((b) => b.seq),
      judgedCeilings.map((b) => b.ceilingMb!),
    );
    if (fit != null) {
      driftMbPerKill = round(fit.slope, 2);
      driftR2 = round(fit.r2, 2);
      driftRead =
        fit.slope > DRIFT_THRESHOLD_MB_PER_KILL
          ? 'rising'
          : fit.slope < -DRIFT_THRESHOLD_MB_PER_KILL
            ? 'settling'
            : 'flat';
    }
  }

  // ── the heartbeat: gaps, medians, the cadence ratio ──
  const intervalsMin = beats.map((b) => b.gapFromPrevMin).filter((g): g is number => g != null);
  const rawMedian = median(intervalsMin);
  const medianIntervalMin = rawMedian != null ? round(rawMedian, 2) : null;
  const recentSlice = intervalsMin.slice(-RECENT_INTERVALS);
  const rawRecent = intervalsMin.length >= RECENT_INTERVALS ? median(recentSlice) : null;
  const recentMedianIntervalMin = rawRecent != null ? round(rawRecent, 2) : null;
  let cadenceRead: CadenceRead = null;
  if (intervalsMin.length >= MIN_CADENCE_INTERVALS && recentMedianIntervalMin != null && medianIntervalMin != null && medianIntervalMin > 0) {
    const ratio = recentMedianIntervalMin / medianIntervalMin;
    cadenceRead =
      ratio >= CADENCE_STRETCH_RATIO
        ? 'stretching'
        : ratio <= CADENCE_QUICKEN_RATIO
          ? 'quickening'
          : 'steady';
  }
  const doubleStrike = intervalsMin.some((g) => g < DOUBLE_KILL_GAP_MIN);
  const doubleStrikeBeats = beats
    .filter((b) => b.gapFromPrevMin != null && b.gapFromPrevMin < DOUBLE_KILL_GAP_MIN)
    .map((b) => ({ from: b.seq - 1, to: b.seq, gapMin: b.gapFromPrevMin! }));
  const doubleStrikeCount = doubleStrikeBeats.length;

  // ── the note ──
  let note: string;
  if (beats.length === 0) {
    note = 'no witnessed beats on record yet — the storm history waits for the journal, honestly empty';
  } else if (beats.length === 1) {
    note = 'one witnessed beat — a single strike does not yet make a rhythm, and the history says so instead of guessing one';
  } else {
    const parts: string[] = [];
    parts.push(
      `${beats.length} witnessed beats across ${spanMin != null ? `${spanMin} min` : 'an unparsable span'} of storm time`,
    );
    if (driftRead != null && driftMbPerKill != null) {
      const dir =
        driftRead === 'rising'
          ? `topping out higher kill after kill (+${driftMbPerKill} MB/kill, R² ${driftR2})`
          : driftRead === 'settling'
            ? `topping out lower kill after kill (${driftMbPerKill} MB/kill, R² ${driftR2})`
            : `holding inside the noise band (${driftMbPerKill > 0 ? '+' : ''}${driftMbPerKill} MB/kill, R² ${driftR2})`;
      parts.push(`the dead's ceiling is ${dir}`);
      if (firstHalfMedianMb != null && secondHalfMedianMb != null) {
        const delta = round(secondHalfMedianMb - firstHalfMedianMb);
        parts.push(
          `the storm's first half centered ${firstHalfMedianMb} MB, its last half ${secondHalfMedianMb} (${delta >= 0 ? '+' : ''}${delta} MB)`,
        );
      }
    }
    if (cadenceRead != null && medianIntervalMin != null) {
      parts.push(
        cadenceRead === 'steady'
          ? `the heartbeat holds a ${medianIntervalMin}-min median (recent three ${recentMedianIntervalMin}) — steady`
          : cadenceRead === 'quickening'
            ? `the heartbeat is QUICKENING — recent three ${recentMedianIntervalMin} min against a ${medianIntervalMin}-min full median`
            : `the heartbeat is STRETCHING — recent three ${recentMedianIntervalMin} min against a ${medianIntervalMin}-min full median`,
      );
    } else if (medianIntervalMin != null) {
      parts.push(`median gap ${medianIntervalMin} min (too few beats for a cadence read yet)`);
    }
    if (doubleStrikeCount === 1) {
      const dbl = doubleStrikeBeats[0]!;
      parts.push(
        `one double strike: kills ${dbl.from}→${dbl.to} landed ${dbl.gapMin} min apart — disclosed, not averaged away`,
      );
    } else if (doubleStrikeCount > 1) {
      const list = doubleStrikeBeats
        .map((d) => `kills ${d.from}→${d.to} (${d.gapMin} min)`)
        .join(', ');
      parts.push(`${doubleStrikeCount} double strikes: ${list} — disclosed, not averaged away`);
    }
    note = `${parts.join(' — ')}. A storm-window read, not a climate verdict: every beat lives inside the storm the witness era has seen.`;
  }

  return {
    beats,
    judged,
    spanMin,
    firstHalfMedianMb,
    secondHalfMedianMb,
    driftMbPerKill,
    driftR2,
    driftRead,
    intervalsMin,
    medianIntervalMin,
    recentMedianIntervalMin,
    cadenceRead,
    doubleStrike,
    doubleStrikeCount,
    doubleStrikeBeats,
    note,
  };
}
