// R109 — THE SAWTOOTH READOUT: the breath, measured.
//
// R108 drew the dying minutes; this engine MEASURES the shape the drawing
// showed. The record's central finding — sawtooth: crossings inside an
// oscillation, not runaways — has a count (R100's diamonds, R108's REV·MED)
// but no DEPTH: how many MB the boot swings on one breath (rise + fall
// through a certified reversal), which window breathes deepest, and whether
// the breath is deepening over the witnessed era. The readout answers from
// the SAME certified pivots the death windows draw their dots from —
//
//   ONE CALIBRATION, MANY READERS: the swing legs are not re-detected here.
//   The engine walks each DeathWindowRead's own reversalIdx (the death-windows
//   engine certified those triples against REVERSAL_MIN_DELTA_MB) and
//   measures rise (mid − prev) and fall (next − mid) between the pivot and
//   its nearest finite-rss neighbours — deterministically the same triples
//   the certifying loop walked. Nothing qualifies here that did not qualify
//   there.
//
//   THE SWING: one reversal = one swing = |rise| + |fall| — the full
//   up-and-down traversal through the pivot (the breath's stroke depth).
//   A leg shared with an adjacent pivot is genuinely double duty — that is
//   what an oscillation IS; each certification keeps its own swing.
//
//   THE READ: per window, the median swing is the window's representative
//   breath; the halves and the OLS run over those representatives in
//   witnessed order (same halves convention as the pair sheet: floor(n/2)
//   from each end). The trend word follows the SLOPE with a disclosed
//   threshold (strict inequalities, like the opening drift's ±50) — the
//   halves travel with it, and where they disagree with the slope, the note
//   says so: that tension is a finding, not an error.
//
// Honesty rules (the house grammar):
//   - thin / no-rss windows cannot carry reversals — canBreathe false, the
//     card keeps its place with zero swings (named, never fabricated)
//   - a window with certified reversals of ZERO breathes FLAT — zero is a
//     reading (a climb or a flat died without an oscillation), not a null
//   - fewer than MIN_SWING_OLS_WINDOWS breathing windows: the OLS refuses
//     (too-few) — the trend word says so instead of extrapolating
//   - all arithmetic carried at full precision, rounded once at the edge

import { REVERSAL_MIN_DELTA_MB, type WitnessShapeKind } from "@/lib/witness-windows";
import type { DeathWindowDrawKind, DeathWindowRead } from "@/lib/death-windows";

/** Below this many breathing windows the OLS refuses to speak. */
export const MIN_SWING_OLS_WINDOWS = 4;

/** Strict band around zero for the trend word, MB per witnessed window.
 *  Slope inside ±this reads FLAT; above it DEEPENING; below SHALLOWING. */
export const SWING_TREND_MB_PER_WINDOW = 10;

export interface SwingRead {
  /** Index into the window's points — the pivot sample (the drawn dot). */
  pivotIdx: number;
  /** Index of the nearest finite-rss sample before the pivot. */
  prevIdx: number;
  /** Index of the nearest finite-rss sample after the pivot. */
  nextIdx: number;
  /** MB, signed: pivot rss − prev rss (the leg up, as certified). */
  riseMb: number;
  /** MB, signed: next rss − pivot rss (the leg down, as certified). */
  fallMb: number;
  /** MB: |rise| + |fall| — the full traversal through the pivot. */
  swingMb: number;
}

export interface BreathWindowRead {
  /** The kill stamp verbatim — the join key back to the record. */
  at: string;
  /** Witnessed-order index (0-based) — the card's #NN. */
  index: number;
  /** The window's shape word, null when the record carries no row. */
  shapeKind: WitnessShapeKind | null;
  /** The death-windows engine's draw verdict (curve / thin / no-rss). */
  drawKind: DeathWindowDrawKind;
  /** True when the window has enough finite rss to carry reversals
   *  (≥ 3 finite samples — the certifying engine's own floor). */
  canBreathe: boolean;
  /** The certified swings in witnessed order ([] when none). */
  swings: SwingRead[];
  /** swings.length — a reading of zero for a window that cannot or does
   *  not breathe. */
  swingCount: number;
  /** Median swing through this window's pivots, null when no swings. */
  medianSwingMb: number | null;
  /** Deepest swing through this window's pivots, null when no swings. */
  deepestSwingMb: number | null;
  /** max rss − min rss across the window's curve (the envelope the breath
   *  lives inside), null when the window draws no curve. */
  envelopeMb: number | null;
}

export interface SawtoothRead {
  /** One read per input window, same order — the record's full population. */
  windows: BreathWindowRead[];
  /** Windows with enough finite rss to carry reversals. */
  breatheCapable: number;
  /** Windows carrying ≥ 1 certified swing. */
  breathers: number;
  /** Certified swings across the whole record. */
  swingsTotal: number;
  /** Median swing over ALL certified swings. */
  medianSwingMb: number | null;
  /** The deepest single swing on record. */
  deepestSwingMb: number | null;
  /** The deepest swing's kill stamp (verbatim) and witnessed index. */
  deepestAt: string | null;
  deepestIndex: number | null;
  /** The deepest swing's certified legs — the arithmetic, quoted. */
  deepestRiseMb: number | null;
  deepestFallMb: number | null;
  /** Per-window median breath, first half vs last half (witnessed order). */
  firstHalfMedianMb: number | null;
  lastHalfMedianMb: number | null;
  /** OLS over per-window median breath vs witnessed index. */
  slopeMbPerWindow: number | null;
  r2: number | null;
  /** The trend word: deepening / shallowing / flat / too-few. */
  trend: "deepening" | "shallowing" | "flat" | "too-few";
  /** The engine's own one-liner — THE READ shows it verbatim. */
  note: string;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function median(values: Array<number>): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Measure the certified swings in ONE window — the shared core the engine
 *  and the death-windows card readout both call. Walks the window's OWN
 *  reversalIdx; each pivot's legs run to its nearest finite-rss neighbours
 *  (the same walk the certifying loop made). */
export function measureSwings(w: DeathWindowRead): SwingRead[] {
  if (w.reversals == null || w.reversalIdx.length === 0) return [];
  const out: SwingRead[] = [];
  for (const p of w.reversalIdx) {
    const mid = w.points[p]?.rssMb;
    if (mid == null) continue; // a pivot is finite by construction; stay honest anyway
    let prevIdx = -1;
    for (let i = p - 1; i >= 0; i--) {
      if (w.points[i]?.rssMb != null) {
        prevIdx = i;
        break;
      }
    }
    let nextIdx = -1;
    for (let i = p + 1; i < w.points.length; i++) {
      if (w.points[i]?.rssMb != null) {
        nextIdx = i;
        break;
      }
    }
    if (prevIdx < 0 || nextIdx < 0) continue; // cannot happen for a certified triple; never invent
    const rise = (mid as number) - (w.points[prevIdx]!.rssMb as number);
    const fall = (w.points[nextIdx]!.rssMb as number) - (mid as number);
    out.push({
      pivotIdx: p,
      prevIdx,
      nextIdx,
      riseMb: round1(rise),
      fallMb: round1(fall),
      swingMb: round1(Math.abs(rise) + Math.abs(fall)),
    });
  }
  return out;
}

function olsSlopeR2(points: Array<{ x: number; y: number }>): { slope: number; r2: number } | null {
  const n = points.length;
  if (n < MIN_SWING_OLS_WINDOWS) return null;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let ssTot = 0;
  let ssRes = 0;
  for (const p of points) {
    ssTot += (p.y - my) ** 2;
    ssRes += (p.y - (slope * p.x + intercept)) ** 2;
  }
  return { slope, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0 };
}

/** THE SAWTOOTH READOUT — death-windows reads in, the breath's depth out.
 *  Pure: no I/O, no re-certification (the pivots are the death-windows
 *  engine's own), no fabrication where the window cannot breathe. */
export function sawtoothReadout(windows: Array<DeathWindowRead>): SawtoothRead {
  const reads: BreathWindowRead[] = (windows ?? []).map((w) => {
    const swings = measureSwings(w);
    const vals = swings.map((s) => s.swingMb);
    const envelopeMb =
      w.drawKind === "curve" && w.maxRssMb != null && w.minRssMb != null
        ? round1(w.maxRssMb - w.minRssMb)
        : null;
    return {
      at: w.at,
      index: w.index,
      shapeKind: w.shapeKind,
      drawKind: w.drawKind,
      canBreathe: w.rssSamples >= 3,
      swings,
      swingCount: swings.length,
      medianSwingMb: vals.length > 0 ? round1(median(vals) as number) : null,
      deepestSwingMb: vals.length > 0 ? round1(Math.max(...vals)) : null,
      envelopeMb,
    };
  });

  const breatheCapable = reads.filter((r) => r.canBreathe).length;
  const breathers = reads.filter((r) => r.swingCount > 0).length;
  const allSwings = reads.flatMap((r) => r.swings);
  const allVals = allSwings.map((s) => s.swingMb);

  let deepestSwingMb: number | null = null;
  let deepestAt: string | null = null;
  let deepestIndex: number | null = null;
  let deepestRiseMb: number | null = null;
  let deepestFallMb: number | null = null;
  for (const s of allSwings) {
    if (deepestSwingMb == null || s.swingMb > deepestSwingMb) {
      // find the owning window for its at/index
      const owner = reads.find((r) => r.swings.includes(s));
      deepestSwingMb = s.swingMb;
      deepestAt = owner?.at ?? null;
      deepestIndex = owner ? owner.index : null;
      deepestRiseMb = s.riseMb;
      deepestFallMb = s.fallMb;
    }
  }

  const medianSwingMb = allVals.length > 0 ? round1(median(allVals) as number) : null;

  // per-window median breath in witnessed order (the drift population)
  const reps = reads
    .filter((r) => r.medianSwingMb != null)
    .map((r) => ({ x: r.index, y: r.medianSwingMb as number }));

  let firstHalfMedianMb: number | null = null;
  let lastHalfMedianMb: number | null = null;
  let slopeMbPerWindow: number | null = null;
  let r2: number | null = null;
  let trend: SawtoothRead["trend"] = "too-few";
  const fit = olsSlopeR2(reps);
  if (reps.length >= MIN_SWING_OLS_WINDOWS) {
    const half = Math.floor(reps.length / 2);
    const fh = median(reps.slice(0, half).map((p) => p.y));
    const lh = median(reps.slice(reps.length - half).map((p) => p.y));
    if (fh != null) firstHalfMedianMb = round1(fh);
    if (lh != null) lastHalfMedianMb = round1(lh);
  }
  if (fit != null) {
    slopeMbPerWindow = Math.round(fit.slope * 100) / 100;
    r2 = Math.round(fit.r2 * 100) / 100;
    trend =
      fit.slope > SWING_TREND_MB_PER_WINDOW
        ? "deepening"
        : fit.slope < -SWING_TREND_MB_PER_WINDOW
          ? "shallowing"
          : "flat";
  }

  const note = buildNote(reads, {
    breatheCapable,
    breathers,
    swingsTotal: allVals.length,
    medianSwingMb,
    deepestSwingMb,
    deepestIndex,
    deepestRiseMb,
    deepestFallMb,
    firstHalfMedianMb,
    lastHalfMedianMb,
    slopeMbPerWindow,
    r2,
    trend,
  });

  return {
    windows: reads,
    breatheCapable,
    breathers,
    swingsTotal: allVals.length,
    medianSwingMb,
    deepestSwingMb,
    deepestAt,
    deepestIndex,
    deepestRiseMb,
    deepestFallMb,
    firstHalfMedianMb,
    lastHalfMedianMb,
    slopeMbPerWindow,
    r2,
    trend,
    note,
  };
}

function buildNote(
  reads: Array<BreathWindowRead>,
  a: {
    breatheCapable: number;
    breathers: number;
    swingsTotal: number;
    medianSwingMb: number | null;
    deepestSwingMb: number | null;
    deepestIndex: number | null;
    deepestRiseMb: number | null;
    deepestFallMb: number | null;
    firstHalfMedianMb: number | null;
    lastHalfMedianMb: number | null;
    slopeMbPerWindow: number | null;
    r2: number | null;
    trend: SawtoothRead["trend"];
  },
): string {
  if (reads.length === 0) {
    return "no witnessed windows yet — the breath reads nothing because the record holds nothing";
  }
  if (a.swingsTotal === 0) {
    return a.breatheCapable === 0
      ? `${reads.length} witnessed windows, none with enough finite rss to carry a reversal — the breath has nothing to measure`
      : `${a.breatheCapable} of ${reads.length} windows can carry reversals, none certified one — the record's deaths read climb or flat, no breath witnessed yet`;
  }
  const parts: string[] = [];
  parts.push(
    `${a.breathers} of ${a.breatheCapable} breathing windows carry ${a.swingsTotal} certified swings (legs ≥ ${REVERSAL_MIN_DELTA_MB} MB)`,
  );
  if (a.medianSwingMb != null) parts.push(`median swing ${a.medianSwingMb} MB`);
  if (a.deepestSwingMb != null && a.deepestIndex != null) {
    parts.push(
      `deepest ${a.deepestSwingMb} MB at #${String(a.deepestIndex + 1).padStart(2, "0")} (rise ${a.deepestRiseMb} + fall ${a.deepestFallMb})`,
    );
  }
  if (a.firstHalfMedianMb != null && a.lastHalfMedianMb != null) {
    const delta = Math.round((a.lastHalfMedianMb - a.firstHalfMedianMb) * 10) / 10;
    parts.push(
      `breath halves ${a.firstHalfMedianMb} → ${a.lastHalfMedianMb} MB (${delta >= 0 ? "+" : ""}${delta})`,
    );
  }
  if (a.slopeMbPerWindow != null) {
    parts.push(
      `slope ${a.slopeMbPerWindow >= 0 ? "+" : ""}${a.slopeMbPerWindow} MB/window R² ${a.r2} — ${a.trend.toUpperCase()} (±${SWING_TREND_MB_PER_WINDOW} strict)`,
    );
  } else {
    parts.push(`slope refused — fewer than ${MIN_SWING_OLS_WINDOWS} breathing windows (too-few)`);
  }
  return parts.join("; ");
}
