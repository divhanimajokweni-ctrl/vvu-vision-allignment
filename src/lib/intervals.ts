// src/lib/intervals.ts — R94 · THE INTERVAL SERIES, AS A TESTED ENGINE.
//
// R92's reliability ledger classified the cadence (accelerating / cooling /
// steady) from the journal's consecutive-save intervals but served only the
// CLASS — the numbers behind it stayed invisible. R94 serves the intervals
// themselves (≤40, oldest→newest) so the operator can SEE the rhythm that
// produced the verdict: which gaps were storms, which were calms, and where
// the mean sits. One pure function, shared by the /api/guardian route and
// the r94 regression test — one computation, zero drift (the R93 lesson).
//
// HONESTY: a negative gap is clock noise, not time — it is dropped, never
// clamped into a fake interval. Fewer than two finite stamps produce an
// empty series (one save has no interval). Stamps are ISO strings computed
// from the SERVER's parse of the guardian's own UTC labels — the client
// never re-derives them.

export interface IntervalPoint {
  /** ISO stamp of the earlier save (interval start). */
  from: string;
  /** ISO stamp of the later save (interval end). */
  to: string;
  /** Interval length in minutes — the number the cadence reads. */
  min: number;
}

/** Default tail depth — matches the downtime tail's ≤40 so the two strips
 *  in the reliability ledger always speak the same window. */
export const INTERVAL_SERIES_MAX = 40;

/** Build the consecutive-interval tail from ascending save timestamps (ms).
 *  POLICY: non-finite stamps are filtered out FIRST and the chain runs
 *  across them (a corrupt stamp is not a save); gaps are then taken over
 *  POSITIONAL consecutive pairs of what remains, and a zero/negative gap is
 *  dropped WITHOUT re-chaining (clock noise is not re-interpreted — the
 *  next pair starts from the dropped pair's own later stamp). The result
 *  keeps the NEWEST `max` intervals, in chronological order. */
export function buildIntervalSeries(
  ats: Array<number>,
  max: number = INTERVAL_SERIES_MAX,
): Array<IntervalPoint> {
  if (max <= 0) return [];
  const finite = ats.filter((t) => Number.isFinite(t));
  const out: Array<IntervalPoint> = [];
  for (let i = 1; i < finite.length; i++) {
    const a = finite[i - 1] as number;
    const b = finite[i] as number;
    const gap = b - a;
    if (!Number.isFinite(gap) || gap <= 0) continue; // clock noise, not time
    out.push({ from: new Date(a).toISOString(), to: new Date(b).toISOString(), min: gap / 60_000 });
  }
  return out.slice(-max);
}

/** Classify one interval against the mean — the SAME bands the cadence
 *  verdict uses (R92: ≤0.67× hot / ≥1.5× cool / else steady), so the strip's
 *  colors and the chip's word can never disagree. Null mean (too few
 *  intervals on record) classifies everything steady-neutral: the strip
 *  shows shape without claiming heat. */
export function classifyIntervalVsMean(
  min: number,
  meanMin: number | null | undefined,
): 'hot' | 'cool' | 'steady' {
  if (meanMin == null || !Number.isFinite(meanMin) || meanMin <= 0) return 'steady';
  const ratio = min / meanMin;
  if (ratio <= 0.67) return 'hot';
  if (ratio >= 1.5) return 'cool';
  return 'steady';
}
