// src/lib/warm-curve.ts — R101 · THE LIVING READ, the warm boot vs the
// death zone.
// ─────────────────────────────────────────────────────────────────────────────
// R100's ceiling strip drew the DEAD: where every witnessed kill's window
// topped out (2007–2174.9 MB, 7/7 sawtooth). This module reads the LIVING
// boot against that geography — the guardian's own ring-buffer series
// (memSeries, ~90 passes at 20s ≈ a 30-minute window) placed beside the
// ceiling band, so the operator can see, in one arithmetic read:
//
//   WHERE the boot rides right now (the last finite rss sample),
//   against the dead's band — below it, inside it, or above it,
//   and what PHASE the ride is in (warming / cooling / riding),
//   and the next guard line ABOVE the current ride, in MB — never in
//   minutes, because an ETA would be a slope extrapolated into the
//   future, and the estate measures, it does not prophesy.
//
// Honesty rules (the estate's own, inherited from the witness windows):
//   - null rssKb samples are SKIPPED, never imputed — the line is drawn
//     from what was witnessed.
//   - one calibration shared: the phase threshold IS the witness windows'
//     SLOPE_THRESHOLD_MB_PER_MIN and the reversal floor IS their
//     REVERSAL_MIN_DELTA_MB — a boot that is "warming" here and "flat"
//     there would be two engines lying to each other.
//   - the recent slope is OLS over the last RECENT_WINDOW_MIN minutes only;
//     the full-window slope is reported alongside so a 30-minute plateau
//     cannot hide behind its last ten minutes (or vice versa).
//   - the death band comes from the witnessed record, not from this boot —
//     a boot with no witnessed kills on file has no band to be judged
//     against, and the read says so instead of inventing one.
// ─────────────────────────────────────────────────────────────────────────────

import { parseGuardianStamp } from './operator-projection';
import { REVERSAL_MIN_DELTA_MB, SLOPE_THRESHOLD_MB_PER_MIN } from './witness-windows';

/** The recent-drift window (minutes of the series' tail the phase reads).
 *  First calibration: the warm cycle's swings move on ~5–15 min scales;
 *  10 minutes is long enough to ride out one-pass jitter (20s) and short
 *  enough to catch a phase change while it is happening. */
export const RECENT_WINDOW_MIN = 10;

export type WarmPhase = 'warming' | 'cooling' | 'riding';
export type WarmPosition = 'below-the-dead' | 'inside-the-death-zone' | 'above-the-dead';

export interface WarmCurveRead {
  /** Finite rss samples used — the read's real n. */
  samples: number;
  /** First→last finite sample, minutes (null under 2 samples). */
  spanMin: number | null;
  /** The last finite rss sample (MB) — where the boot rides NOW. */
  currentMb: number | null;
  /** The window's extremes (MB, finite samples only). */
  minMb: number | null;
  maxMb: number | null;
  /** OLS slope over the series' tail (MB/min) — the phase's input. */
  recentSlopeMbPerMin: number | null;
  /** OLS slope over the whole window (MB/min) — the context the recent
   *  read must not be allowed to hide from. */
  fullSlopeMbPerMin: number | null;
  /** Real reversals over the FULL window (steps ≥ the witness windows'
   *  5 MB floor). A bounce inside the window dominates this count — the
   *  recent reversals are the honest oscillation read for a living boot. */
  reversals: number | null;
  /** Real reversals over the recent tail (the phase's own window) — the
   *  oscillation test that transition noise cannot flood. */
  recentReversals: number | null;
  /** warming (≥ +15 MB/min recent) / cooling (≤ −15) / riding (else). */
  phase: WarmPhase | null;
  /** The ride vs the dead's ceiling band (null without a band). */
  position: WarmPosition | null;
  /** Distance to the nearest band edge, MB, positive = outside the band.
   *  Below the dead → current − band.min (negative). Above → current −
   *  band.max (positive). Inside → the nearer edge, signed toward it. */
  bandMarginMb: number | null;
  /** The smallest guard ABOVE the current ride (null when none or when
   *  every line sits below) — the next line a continued climb would meet. */
  nextGuardAboveMb: number | null;
  /** nextGuardAbove − current (MB). Null with the guard. */
  nextGuardGapMb: number | null;
  /** The honest one-liner — the engine's own read. */
  note: string;
}

interface Pt {
  tMin: number;
  mb: number;
}

function extract(series: Array<{ t: string; rssKb: number | null }>): Pt[] {
  const out: Pt[] = [];
  for (const s of series ?? []) {
    if (!s || typeof s !== 'object') continue;
    const kb = s.rssKb;
    if (typeof kb !== 'number' || !Number.isFinite(kb)) continue;
    const tMs = parseGuardianStamp(s.t);
    if (!Number.isFinite(tMs)) continue;
    out.push({ tMin: tMs / 60000, mb: kb / 1024 });
  }
  return out;
}

function olsSlope(pts: Pt[]): number | null {
  const n = pts.length;
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const p of pts) {
    sx += p.tMin;
    sy += p.mb;
    sxx += p.tMin * p.tMin;
    sxy += p.tMin * p.mb;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  return (n * sxy - sx * sy) / denom;
}

function reversals(pts: Pt[]): number {
  let count = 0;
  let lastDir: 1 | -1 | null = null;
  for (let i = 1; i < pts.length; i++) {
    const d = pts[i]!.mb - pts[i - 1]!.mb;
    if (Math.abs(d) < REVERSAL_MIN_DELTA_MB) continue;
    const dir: 1 | -1 = d > 0 ? 1 : -1;
    if (lastDir != null && dir !== lastDir) count += 1;
    lastDir = dir;
  }
  return count;
}

function round(v: number, places = 1): number {
  const f = 10 ** places;
  return Math.round(v * f) / f;
}

/** THE living read — the guardian's ring-buffer series + the guard menu +
 *  the dead's ceiling band in, one arithmetic position out. Pure: nothing
 *  here fetches, nothing predicts; the next guard above is reported in MB
 *  only, and a missing band (no witnessed kills yet) leaves the position
 *  honestly null instead of borrowing one. */
export function warmCurveRead(
  series: Array<{ t: string; rssKb: number | null }>,
  guardsMb: Array<number>,
  band: { min: number; max: number } | null,
): WarmCurveRead {
  const pts = extract(series);
  const samples = pts.length;

  const empty: WarmCurveRead = {
    samples,
    spanMin: null,
    currentMb: null,
    minMb: null,
    maxMb: null,
    recentSlopeMbPerMin: null,
    fullSlopeMbPerMin: null,
    reversals: samples >= 2 ? reversals(pts) : null,
    recentReversals: null,
    phase: null,
    position: null,
    bandMarginMb: null,
    nextGuardAboveMb: null,
    nextGuardGapMb: null,
    note:
      samples === 0
        ? 'no finite rss sample in the guardian\u2019s window — the living read waits for the next pass'
        : 'too few finite samples for a trajectory — a point is a position, not a ride',
  };
  if (samples < 2) return empty;

  const t0 = pts[0]!.tMin;
  for (const p of pts) p.tMin = p.tMin - t0;

  const currentMb = pts[samples - 1]!.mb;
  let minMb = pts[0]!.mb;
  let maxMb = pts[0]!.mb;
  for (const p of pts) {
    if (p.mb < minMb) minMb = p.mb;
    if (p.mb > maxMb) maxMb = p.mb;
  }
  const spanMin = round(pts[samples - 1]!.tMin, 2);

  const recent = pts.filter((p) => p.tMin >= spanMin - RECENT_WINDOW_MIN);
  const recentSlope = recent.length >= 2 ? olsSlope(recent) : null;
  const fullSlope = olsSlope(pts);
  const revs = reversals(pts);
  const recentRevs = recent.length >= 2 ? reversals(recent) : null;

  const phase: WarmPhase | null =
    recentSlope == null
      ? null
      : recentSlope >= SLOPE_THRESHOLD_MB_PER_MIN
        ? 'warming'
        : recentSlope <= -SLOPE_THRESHOLD_MB_PER_MIN
          ? 'cooling'
          : 'riding';

  let position: WarmPosition | null = null;
  let bandMarginMb: number | null = null;
  if (band != null && Number.isFinite(band.min) && Number.isFinite(band.max)) {
    if (currentMb < band.min) {
      position = 'below-the-dead';
      bandMarginMb = round(currentMb - band.min);
    } else if (currentMb > band.max) {
      position = 'above-the-dead';
      bandMarginMb = round(currentMb - band.max);
    } else {
      position = 'inside-the-death-zone';
      bandMarginMb = round(currentMb - band.min) <= round(band.max - currentMb) ? round(currentMb - band.min) : round(currentMb - band.max);
    }
  }

  const guards = (guardsMb ?? []).filter((g) => typeof g === 'number' && Number.isFinite(g));
  const above = guards.filter((g) => g > currentMb).sort((a, b) => a - b);
  const nextGuardAboveMb = above.length > 0 ? above[0]! : null;
  const nextGuardGapMb = nextGuardAboveMb != null ? round(nextGuardAboveMb - currentMb) : null;

  const phaseTxt =
    phase != null
      ? `${phase.toUpperCase()} ${recentSlope! > 0 ? '+' : ''}${round(recentSlope!, 1)} MB/MIN over the last ${RECENT_WINDOW_MIN} min`
      : 'phase unjudged (thin tail)';
  const posTxt =
    position === 'below-the-dead'
      ? `${Math.abs(bandMarginMb!)} MB UNDER the dead's shallowest ceiling (${round(band!.min, 1)})`
      : position === 'inside-the-death-zone'
        ? `INSIDE the death zone (${round(band!.min, 1)}–${round(band!.max, 1)}) — the band where every witnessed kill topped out`
        : position === 'above-the-dead'
          ? `${bandMarginMb} MB ABOVE the dead's highest ceiling (${round(band!.max, 1)})`
          : 'no witnessed band on file to judge the ride against';
  const guardTxt =
    nextGuardAboveMb != null
      ? `the next line above is guard-${nextGuardAboveMb}, ${nextGuardGapMb} MB up`
      : 'no guard line above the ride';
  const revTxt =
    recentRevs != null
      ? `${recentRevs} real reversal${recentRevs === 1 ? '' : 's'} in the last ${RECENT_WINDOW_MIN} min`
      : `${revs} real reversal${revs === 1 ? '' : 's'}`;
  const note =
    `THE LIVING BOOT RIDES ${round(currentMb)} MB — ${posTxt} · ${phaseTxt} · ` +
    `${revTxt} · ${guardTxt}`;

  return {
    samples,
    spanMin,
    currentMb: round(currentMb),
    minMb: round(minMb),
    maxMb: round(maxMb),
    recentSlopeMbPerMin: recentSlope != null ? round(recentSlope, 1) : null,
    fullSlopeMbPerMin: fullSlope != null ? round(fullSlope, 1) : null,
    reversals: revs,
    recentReversals: recentRevs,
    phase,
    position,
    bandMarginMb,
    nextGuardAboveMb,
    nextGuardGapMb,
    note,
  };
}
