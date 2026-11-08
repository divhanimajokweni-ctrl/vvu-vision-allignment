// src/lib/witness-windows.ts — R98 · THE WITNESS WINDOWS, THE SHAPE ENGINE.
// ─────────────────────────────────────────────────────────────────────────────
// R94's memWitness records the guardian's last ≤12 passes before each kernel
// kill (the "dying minute", ~4 min at 20s sampling). R96's projection reads
// those windows for CATCHABILITY — whether a rail line would have crossed —
// but never asks what the trajectory LOOKED like. Four witnessed kills are
// now on record and their windows have never been drawn. This module turns
// each window into a SHAPE WORD the operator can act on:
//
//   SAWTOOTH  — rss climbed, RELIEVED, climbed again (≥2 real reversals).
//               The kernel killed a crossing inside an oscillation, not a
//               runaway. The record's first four windows read this way —
//               the estate's deaths are crossings, not leaks.
//   CLIMBING  — monotone-ish rise ≥ SLOPE_THRESHOLD MB/min (the runaway a
//               guard rail exists to catch).
//   FALLING   — mirror of climbing (memory returning; a kill here is the
//               kernel acting on stale pressure).
//   FLAT      — drift inside the noise band; the kill came from nowhere
//               this window can testify to.
//   SINGLE / UNJUDGED — fewer than MIN_FIT samples with rss: the window
//               cannot carry a trajectory, and the word says so instead of
//               guessing.
//
// Honesty rules (the estate's own):
//   - a reversal only counts when the swing exceeds REVERSAL_MIN_DELTA_MB —
//     sub-noise jitter (a few MB at 20s sampling) is not a swing, and
//     counting it would read every window as sawtooth.
//   - null rssKb samples (the kernel's own death blotting the last read, or
//     a missed pass) are SKIPPED, never imputed — the shape is computed
//     from what was witnessed and nothing else.
//   - the fit is OLS over (minutes-into-window, MB); R² is reported so the
//     surface can show HOW line-like a climb was, and every threshold is a
//     FIRST CALIBRATION named in constants — re-read as the record grows,
//     exactly like the tier engine's bands.
// ─────────────────────────────────────────────────────────────────────────────

import type { WitnessSample } from "@/lib/operator-projection";

/** A rise/fall must exceed this to read as a direction (MB per minute).
 *  First calibration: the witnessed windows swing 40–90 MB inside ~4 min;
 *  15 MB/min separates real drift from sampling noise. */
export const SLOPE_THRESHOLD_MB_PER_MIN = 15;

/** A reversal only counts when the step exceeds this (MB). First
 *  calibration: 20s sampling jitters a few MB between passes; 5 MB is the
 *  smallest step the journal's own windows treat as a swing. */
export const REVERSAL_MIN_DELTA_MB = 5;

/** The minimum finite-rss samples for a linear fit (OLS needs ≥2; 3 is the
 *  smallest series a slope is honest about). */
export const MIN_FIT_SAMPLES = 3;

export type WitnessShapeKind = "sawtooth" | "climbing" | "falling" | "flat" | "single" | "unjudged";

export interface WitnessWindowShape {
  kind: WitnessShapeKind;
  /** OLS slope of rss over the window (MB/min) — signed. null below the
   *  fit minimum. */
  rssSlopeMbPerMin: number | null;
  /** R² of the rss fit — how line-like the trajectory is (0..1). */
  rssR2: number | null;
  /** Real reversal count in the rss series (steps ≥ REVERSAL_MIN_DELTA_MB
   *  changing sign). null below the fit minimum. */
  rssReversals: number | null;
  /** Minutes-into-window where the peak rss sample sat (0 = window start).
   *  A peak AT the window's edge means the kernel killed the climb's top;
   *  a peak mid-window means it killed during a lull. null without rss. */
  peakAtMin: number | null;
  /** The avail series' own slope (MB/min) — the floor-rail side of the
   *  story (a sinking avail window reads negative). */
  availSlopeMbPerMin: number | null;
  /** Finite rss samples used by the fit — the shape's real n. */
  rssSamples: number;
  /** Finite avail samples seen in the window. */
  availSamples: number;
  /** Window span in minutes (first→last FINITE rss sample; null without). */
  spanMin: number | null;
  /** The honest one-liner for tooltips — the engine's own reading. */
  note: string;
}

interface SeriesPoint {
  tMin: number;
  vMb: number;
}

/** Extract a minutes/MB series from witness samples, skipping nulls and
 *  unparsable stamps. The origin is the FIRST FINITE sample (t=0) so the
 *  slope's units are MB/min regardless of stamp gaps. */
function extractSeries(
  witness: Array<WitnessSample>,
  key: "rssKb" | "availKb",
  parseStamp: (t: string | null | undefined) => number,
): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (const s of witness ?? []) {
    if (!s || typeof s !== "object") continue;
    const v = s[key];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const tMs = parseStamp(s.t);
    if (!Number.isFinite(tMs)) continue;
    out.push({ tMin: tMs / 60000, vMb: v / 1024 });
  }
  if (out.length === 0) return out;
  const t0 = out[0]!.tMin;
  for (const p of out) p.tMin = p.tMin - t0;
  return out;
}

interface OlsFit {
  slope: number;
  r2: number;
}

/** OLS over (x, y) with R² — the plain closed form; n ≥ 2 enforced by the
 *  caller. Degenerate (zero-variance x) returns null rather than divide. */
function ols(pts: SeriesPoint[]): OlsFit | null {
  const n = pts.length;
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of pts) {
    sx += p.tMin;
    sy += p.vMb;
    sxx += p.tMin * p.tMin;
    sxy += p.tMin * p.vMb;
    syy += p.vMb * p.vMb;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null; // all samples at one instant — no time axis
  const slope = (n * sxy - sx * sy) / denom;
  const meanY = sy / n;
  let ssTot = 0;
  let ssRes = 0;
  for (const p of pts) {
    const pred = slope * p.tMin + (sy - slope * sx) / n;
    ssTot += (p.vMb - meanY) * (p.vMb - meanY);
    ssRes += (p.vMb - pred) * (p.vMb - pred);
  }
  const r2 = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 0;
  return { slope, r2: Number.isFinite(r2) ? r2 : 0 };
}

/** Real reversals: sign changes between consecutive steps whose magnitude
 *  clears REVERSAL_MIN_DELTA_MB. Sub-noise steps are skipped entirely (they
 *  neither count nor reset the previous direction). */
function countReversals(pts: SeriesPoint[]): number {
  let reversals = 0;
  let lastDir: 1 | -1 | null = null;
  for (let i = 1; i < pts.length; i++) {
    const d = pts[i]!.vMb - pts[i - 1]!.vMb;
    if (Math.abs(d) < REVERSAL_MIN_DELTA_MB) continue;
    const dir: 1 | -1 = d > 0 ? 1 : -1;
    if (lastDir != null && dir !== lastDir) reversals += 1;
    lastDir = dir;
  }
  return reversals;
}

function round(v: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(v * f) / f;
}

/** THE shape classifier — one witness window in, one honest shape word
 *  out. Order matters: reversals outrank slope (a window that climbed AND
 *  relieved twice is a sawtooth even if its net slope is flat); slope words
 *  only fire on a net drift beyond the threshold; everything else reads
 *  flat. Thin windows get their own words instead of a guessed shape. */
export function classifyWitnessWindow(
  witness: Array<WitnessSample>,
  parseStamp: (t: string | null | undefined) => number,
): WitnessWindowShape {
  const rss = extractSeries(witness, "rssKb", parseStamp);
  const avail = extractSeries(witness, "availKb", parseStamp);
  const rssSamples = rss.length;
  const availSamples = avail.length;

  const rssFit = rssSamples >= MIN_FIT_SAMPLES ? ols(rss) : null;
  const availFit = availSamples >= MIN_FIT_SAMPLES ? ols(avail) : null;
  const reversals = rssSamples >= MIN_FIT_SAMPLES ? countReversals(rss) : null;

  let peakAtMin: number | null = null;
  if (rssSamples > 0) {
    let peak = rss[0]!.vMb;
    let peakT = rss[0]!.tMin;
    for (const p of rss) {
      if (p.vMb > peak) {
        peak = p.vMb;
        peakT = p.tMin;
      }
    }
    peakAtMin = round(peakT, 2);
  }
  const spanMin = rssSamples >= 2 ? round(rss[rssSamples - 1]!.tMin - rss[0]!.tMin, 2) : null;

  const base = {
    rssSlopeMbPerMin: rssFit ? round(rssFit.slope) : null,
    rssR2: rssFit ? round(rssFit.r2, 3) : null,
    rssReversals: reversals,
    peakAtMin,
    availSlopeMbPerMin: availFit ? round(availFit.slope) : null,
    rssSamples,
    availSamples,
    spanMin,
  };

  if (rssSamples === 0) {
    return {
      ...base,
      kind: "unjudged",
      note: "no finite rss sample in the window — the shape cannot be computed, and the surface says so",
    };
  }
  if (rssSamples === 1) {
    return {
      ...base,
      kind: "single",
      note: "exactly one rss sample — a point, not a trajectory",
    };
  }
  if (rssFit == null || reversals == null) {
    return {
      ...base,
      kind: "unjudged",
      note: "fewer than three finite rss samples — too thin for a slope the surface would admit to",
    };
  }

  if (reversals >= 2) {
    return {
      ...base,
      kind: "sawtooth",
      note: `${reversals} real reversals (≥${REVERSAL_MIN_DELTA_MB} MB swings): rss climbed, relieved, and climbed again — the kernel killed a crossing inside an oscillation, not a runaway`,
    };
  }
  if (rssFit.slope >= SLOPE_THRESHOLD_MB_PER_MIN) {
    return {
      ...base,
      kind: "climbing",
      note: `net rise ${round(rssFit.slope, 1)} MB/min (R² ${round(rssFit.r2, 2)}) — the window reads as the climb a guard rail exists to catch`,
    };
  }
  if (rssFit.slope <= -SLOPE_THRESHOLD_MB_PER_MIN) {
    return {
      ...base,
      kind: "falling",
      note: `net fall ${round(Math.abs(rssFit.slope), 1)} MB/min (R² ${round(rssFit.r2, 2)}) — memory was RETURNING when the kernel struck`,
    };
  }
  return {
    ...base,
    kind: "flat",
    note: `net drift ${round(rssFit.slope, 1)} MB/min — inside the noise band; this window cannot testify to a cause`,
  };
}

export interface WitnessWindowRead {
  /** The kill stamp verbatim — the join key back to the disposition row. */
  at: string;
  shape: WitnessWindowShape;
}

/** One-call build over the witnessed kills (journal order preserved) — the
 *  /api/guardian route folds this into the railProjection payload so the UI
 *  draws from the same parse the scenarios came from. */
export function buildWitnessWindows(
  kills: Array<{ at: string; witness: Array<WitnessSample> }>,
  parseStamp: (t: string | null | undefined) => number,
): WitnessWindowRead[] {
  return (kills ?? []).map((k) => ({
    at: k.at,
    shape: classifyWitnessWindow(k.witness, parseStamp),
  }));
}

// ─── R100 · THE CEILING — the oscillation's top, as a distribution ─────────
//
// The witness windows answered WHAT the deaths looked like (6/6 sawtooth —
// crossings inside an oscillation, not runaways). The operator's very next
// question is WHERE: at what rss did the oscillation top out when the kernel
// struck? Each witnessed kill's in-window peak rss IS that ceiling, and the
// distribution of ceilings across kills is the crossing line's own record —
// the data the guard menu's decision has been missing a view of:
//
//   a guard BELOW every ceiling fires on every witnessed kill (its loop
//   check stays the scenarios grid's job — this strip never re-derives it);
//   a guard INSIDE the cluster fires on some kills and not others;
//   a guard ABOVE every ceiling never crossed in-window (the grid's BLIND).
//
// Honesty rules inherited: the ceiling is the window's max FINITE rss sample
// — nothing before the window is guessed, and a window without rss carries
// no ceiling at all (it stays in the read list with nulls, excluded from
// the statistics, counted honestly).

export interface CeilingRead {
  /** The kill stamp verbatim — the join key back to the witnessed row. */
  at: string;
  /** Parsed kill stamp (ms), null when the row's stamp did not parse. */
  atMs: number | null;
  /** The witnessed window's peak rss (MB) — where the trajectory topped out
   *  when the kernel struck. null when no finite rss sample survived. */
  ceilingMb: number | null;
  /** The window's shape word (joined by `at`), null when the windows list
   *  carries no row for this kill. */
  shapeKind: WitnessShapeKind | null;
  /** Guard levels the climb had already crossed (guard ≤ ceiling, ascending)
   *  — a rise through a line is exactly what a controlled landing fires on. */
  crossedGuardsMb: number[];
  /** The HIGHEST crossed guard — the closest line a landing could have fired
   *  on (null when no guard sits at/below the ceiling). */
  nearestCatchMb: number | null;
  /** ceiling − nearestCatch (MB) — the headroom the kernel spent above the
   *  line before striking. null without a catchable line. */
  catchHeadroomMb: number | null;
}

export type ArmedGuardCeilingRead = "catch-all" | "in-cluster" | "blind" | null;

export interface CeilingPopulation {
  reads: CeilingRead[];
  /** Kills with a finite ceiling — the distribution's honest n. */
  judged: number;
  minCeilingMb: number | null;
  medianCeilingMb: number | null;
  maxCeilingMb: number | null;
  /** Guards at/below EVERY judged ceiling — lines all witnesses cross. */
  catchAllGuardsMb: number[];
  /** Guards strictly inside (min, max) of the judged cluster — lines the
   *  oscillation crosses on some kills only. */
  inClusterGuardsMb: number[];
  /** The armed guard's own position vs the cluster, for the legend. */
  armedGuardRead: ArmedGuardCeilingRead;
  /** The honest one-liner — the engine's own reading of the spread. */
  note: string;
}

function mb(v: number): string {
  return `${Math.round(v * 10) / 10} MB`;
}

/** THE ceiling distribution — witnessed kills + their window shapes + the
 *  guard menu in, the oscillation's top as a population out. Pure: the join
 *  is by the `at` stamp verbatim (the windows' own join key), guards are
 *  sorted before any comparison, and a kill without a finite peak keeps its
 *  place in the reads with nulls while the statistics count only what
 *  exists. The armed guard is read against the cluster when provided —
 *  catch-all (≤ min), in-cluster, or blind (> max) — never verdicts the
 *  loop question, which is the scenarios grid's to answer. */
export function ceilingDistribution(
  kills: Array<{ at: string; atMs: number; maxRssMb: number | null }>,
  windows: Array<WitnessWindowRead>,
  guardLevelsMb: Array<number>,
  armedGuardMb: number | null = null,
): CeilingPopulation {
  const shapeByAt = new Map<string, WitnessShapeKind>();
  for (const w of windows ?? []) shapeByAt.set(w.at, w.shape.kind);
  const guards = (guardLevelsMb ?? [])
    .filter((g) => typeof g === "number" && Number.isFinite(g))
    .sort((a, b) => a - b);

  const reads: CeilingRead[] = (kills ?? []).map((k) => {
    const at = String(k?.at ?? "");
    const ceilingMb =
      typeof k?.maxRssMb === "number" && Number.isFinite(k.maxRssMb) ? k.maxRssMb : null;
    const crossed = ceilingMb != null ? guards.filter((g) => g <= ceilingMb) : [];
    const nearestCatch = crossed.length > 0 ? crossed[crossed.length - 1]! : null;
    return {
      at,
      atMs: typeof k?.atMs === "number" && Number.isFinite(k.atMs) ? k.atMs : null,
      ceilingMb,
      shapeKind: shapeByAt.get(at) ?? null,
      crossedGuardsMb: crossed,
      nearestCatchMb: nearestCatch,
      catchHeadroomMb:
        nearestCatch != null && ceilingMb != null ? round(ceilingMb - nearestCatch, 1) : null,
    };
  });

  const ceilings = reads
    .map((r) => r.ceilingMb)
    .filter((c): c is number => c != null)
    .sort((a, b) => a - b);
  const judged = ceilings.length;
  const minCeilingMb = judged > 0 ? ceilings[0]! : null;
  const maxCeilingMb = judged > 0 ? ceilings[judged - 1]! : null;
  const mid = Math.floor(judged / 2);
  const medianCeilingMb =
    judged === 0
      ? null
      : judged % 2 === 1
        ? ceilings[mid]!
        : round((ceilings[mid - 1]! + ceilings[mid]!) / 2, 1);

  const catchAllGuardsMb =
    judged === 0 ? [] : guards.filter((g) => minCeilingMb != null && g <= minCeilingMb);
  const inClusterGuardsMb =
    judged === 0
      ? []
      : guards.filter(
          (g) =>
            minCeilingMb != null && maxCeilingMb != null && g > minCeilingMb && g < maxCeilingMb,
        );

  let armedGuardRead: ArmedGuardCeilingRead = null;
  if (armedGuardMb != null && Number.isFinite(armedGuardMb) && judged > 0) {
    armedGuardRead =
      armedGuardMb <= minCeilingMb!
        ? "catch-all"
        : armedGuardMb < maxCeilingMb!
          ? "in-cluster"
          : "blind";
  }

  let note: string;
  if (judged === 0) {
    note = "no witnessed ceiling on record yet — the strip waits for the journal, honestly empty";
  } else {
    const catchAllTxt = catchAllGuardsMb.length > 0 ? catchAllGuardsMb.map(mb).join(" · ") : "none";
    const inClusterTxt =
      inClusterGuardsMb.length > 0 ? inClusterGuardsMb.map(mb).join(" · ") : "none";
    note =
      `${judged} witnessed ceiling${judged === 1 ? "" : "s"} span ${mb(minCeilingMb!)}–${mb(maxCeilingMb!)} ` +
      `(median ${mb(medianCeilingMb!)}) — guards below every ceiling (${catchAllTxt}) cross on ALL ` +
      `${judged}; inside the band (${inClusterTxt}) cross on SOME; above ${mb(maxCeilingMb!)} never crossed in-window`;
  }

  return {
    reads,
    judged,
    minCeilingMb,
    medianCeilingMb,
    maxCeilingMb,
    catchAllGuardsMb,
    inClusterGuardsMb,
    armedGuardRead,
    note,
  };
}

// ─── R102 · THE TRY LINE — rehearsing a level against the record ───────────
//
// The operator decision has been complete and drawn for rounds; what it
// has never been is TACTILE. guardVsCeilings is the pure core of the try
// line: one menu level against the witnessed ceiling population, the same
// arithmetic the strip draws — how many of the dead crossed it, where it
// sits relative to the band. The UI folds in the scenario grid's own
// verdict (CATCHES / BLIND / WOULD LOOP — never re-derived here) and the
// living ride's distance. It arms nothing: the guardian's guard moves
// only in guardian.py, and the try line says so on its face.

export interface GuardVsCeilings {
  /** The level read. */
  levelMb: number;
  /** Where the level sits vs the cluster — the strip's own classes. */
  cls: "catch-all" | "in-cluster" | "blind";
  /** How many witnessed ceilings reached at/above the level — the kills a
   *  rise through this line would have carried. */
  crosses: number;
  /** The population's judged size (the denominator). */
  judged: number;
  /** level − nearest band edge, MB, positive = outside the band (below
   *  the dead is negative). null without a judged band. */
  marginToBandMb: number | null;
}

export function guardVsCeilings(levelMb: number, pop: CeilingPopulation): GuardVsCeilings {
  const judged = pop.judged;
  const min = pop.minCeilingMb;
  const max = pop.maxCeilingMb;
  const crosses = pop.reads.filter((r) => r.ceilingMb != null && r.ceilingMb >= levelMb).length;
  let cls: GuardVsCeilings["cls"] = "blind";
  let marginToBandMb: number | null = null;
  if (judged > 0 && min != null && max != null) {
    if (levelMb <= min) {
      cls = "catch-all";
      marginToBandMb = Math.round((levelMb - min) * 10) / 10;
    } else if (levelMb < max) {
      cls = "in-cluster";
      const toMin = Math.round((levelMb - min) * 10) / 10;
      const toMax = Math.round((levelMb - max) * 10) / 10;
      marginToBandMb = Math.abs(toMin) <= Math.abs(toMax) ? toMin : toMax;
    } else {
      cls = "blind";
      marginToBandMb = Math.round((levelMb - max) * 10) / 10;
    }
  }
  return { levelMb, cls, crosses, judged, marginToBandMb };
}
