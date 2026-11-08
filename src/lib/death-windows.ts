// R108 — THE DEATH WINDOWS: the dying minute, drawn.
//
// The record's central finding has been a WORD, never a CURVE. R98 classified
// the witness windows (sawtooth — crossings, not runaways); R100 plotted the
// ceilings as diamonds on the guard menu's scale; the storm history carries
// the shapes as dot fills. But no panel has ever drawn the actual dying
// minutes — the rss trajectories the kernel struck inside. This engine turns
// the witnessed kills' raw memWitness samples into drawing-ready reads: per
// kill, the window's points (seconds before death), the climb, the reversals
// (direction changes with BOTH legs at/above the witness engine's own
// reversal delta — one calibration, many readers), the span, and an honest
// draw verdict:
//
//   'curve'  — ≥ MIN_CURVE_SAMPLES finite rss samples: a drawable trajectory
//   'thin'   — exactly 1 finite rss sample: a single point is not a
//              trajectory — drawn as a marked point, named THIN
//   'no-rss' — 0 finite rss samples: the card stays, empty and named
//
// Honesty rules (inherited from the house grammar):
//   - stamps that fail to parse never invent a clock: the window draws
//     index-spaced and carries the CLOCK·UNSTAMPED disclosure — sample ORDER
//     is real, equal spacing is disclosed as spacing, never passed off as
//     time; spanSec reads null
//   - rss nulls stay gaps: the point keeps its place (the pass happened),
//     rssMb reads null, and the panel breaks the polyline there — counted in
//     samples, absent from the curve, never interpolated
//   - a reversal counts only where both legs clear REVERSAL_MIN_DELTA_MB
//     (imported from witness-windows — the same threshold that calls a
//     window sawtooth draws its dots); zero legs are skipped entirely
//   - avail rides every point (the box pressure at that moment) for the
//     arithmetic, but the card's scale is rss — the dip is QUOTED, never
//     drawn on the rss scale (a second axis would double the lie surface)
//   - the shape word joins by the `at` stamp verbatim — the same join key
//     the ceiling strip uses; a kill without a window row keeps its place
//     with shapeKind null (counted in the census's 'unknown' lane)

import { REVERSAL_MIN_DELTA_MB, type WitnessShapeKind } from '@/lib/witness-windows';

/** Below this many finite rss samples a window is not a trajectory. */
export const MIN_CURVE_SAMPLES = 2;

export interface DeathWindowPoint {
  /** Seconds relative to the kill stamp (negative = before death, 0 = the
   *  stamp itself). null when either stamp failed to parse — the window
   *  then draws index-spaced under the CLOCK·UNSTAMPED disclosure. */
  dtSec: number | null;
  /** MB. null where the guardian's pass carried no finite rss — a gap in
   *  the polyline, never interpolated. */
  rssMb: number | null;
  /** MB. The box's available memory at that pass — quoted in the
   *  arithmetic, never drawn on the rss scale. */
  availMb: number | null;
}

export type DeathWindowDrawKind = 'curve' | 'thin' | 'no-rss';

export interface DeathWindowRead {
  /** The kill stamp verbatim — the join key back to the record. */
  at: string;
  /** Parsed kill stamp (ms), null when the row's stamp did not parse. */
  atMs: number | null;
  /** Position in the witnessed order (0-based) — the card's #NN. */
  index: number;
  /** The window's shape word (joined by `at`), null when the windows list
   *  carries no row for this kill. */
  shapeKind: WitnessShapeKind | null;
  /** The honest draw verdict (see module header). */
  drawKind: DeathWindowDrawKind;
  /** True when any stamp in the window failed to parse (or the kill stamp
   *  itself is unparsable) — the panel draws index-spaced and discloses. */
  clockSpaced: boolean;
  /** The window's points in journal order (oldest first). */
  points: DeathWindowPoint[];
  /** Finite rss samples in the window (the curve's honest n). */
  rssSamples: number;
  /** Total samples the guardian witnessed on the row (rss + gaps + avail). */
  samples: number;
  firstRssMb: number | null;
  lastRssMb: number | null;
  minRssMb: number | null;
  /** The window's peak rss — the same number the ceiling strip plots. */
  maxRssMb: number | null;
  /** max − first: what the trajectory added inside the window. null below
   *  MIN_CURVE_SAMPLES. */
  climbMb: number | null;
  /** (last t − first t) in seconds, null unless both stamps parse. */
  spanSec: number | null;
  /** Direction changes with both legs ≥ REVERSAL_MIN_DELTA_MB. null when
   *  the window is thin/no-rss (fewer than 3 finite rss points cannot carry
   *  a two-leg reversal). */
  reversals: number | null;
  /** Indices into `points` marking each reversal's pivot sample (the middle
   *  of the qualifying triple) — the panel draws these as dots. */
  reversalIdx: number[];
  /** The window's deepest observed available-memory reading (MB), null when
   *  no pass carried finite avail. */
  minAvailMb: number | null;
}

export interface DeathWindowsRead {
  windows: DeathWindowRead[];
  /** Windows with drawKind 'curve' — the panel's drawable population. */
  drawable: number;
  thin: number;
  noRss: number;
  /** Shape census over the windows (shapeKind → count; null → 'unknown'). */
  shapesCensus: Record<string, number>;
  /** Median reversal count over windows that can carry reversals (null when
   *  no window reaches three finite rss points). */
  reversalsMedian: number | null;
  /** The engine's own one-liner — the panel's THE READ shows it verbatim. */
  note: string;
}

type KillInput = {
  at: string;
  atMs: number | null;
  witness: Array<{ t: string; rssKb: number | null; availKb: number | null }>;
};

type WindowInput = { at: string; shape: { kind: WitnessShapeKind } };

function median(values: Array<number>): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** THE death windows — witnessed kills + their shape words + the stamp
 *  parser in, drawing-ready reads out. Pure: no I/O, no re-derivation of
 *  the kills themselves (the route's witnessedKills owns that parse); the
 *  engine reads the raw samples the kills already carry and adds only the
 *  window's own arithmetic. */
export function deathWindows(
  kills: Array<KillInput>,
  windows: Array<WindowInput>,
  parseStamp: (t: string | null | undefined) => number | null,
): DeathWindowsRead {
  const shapeByAt = new Map<string, WitnessShapeKind>();
  for (const w of windows ?? []) {
    if (w && typeof w.at === 'string') shapeByAt.set(w.at, w.shape.kind);
  }

  const reads: DeathWindowRead[] = (kills ?? []).map((k, index) => {
    const raw = Array.isArray(k.witness) ? k.witness : [];
    const atMs = typeof k.atMs === 'number' && Number.isFinite(k.atMs) ? k.atMs : null;

    const points: DeathWindowPoint[] = raw.map((s) => {
      const tMs = parseStamp(s?.t);
      return {
        dtSec: atMs != null && tMs != null ? (tMs - atMs) / 1000 : null,
        rssMb: typeof s?.rssKb === 'number' && Number.isFinite(s.rssKb) ? s.rssKb / 1024 : null,
        availMb:
          typeof s?.availKb === 'number' && Number.isFinite(s.availKb) ? s.availKb / 1024 : null,
      };
    });

    const rssVals = points.filter((p) => p.rssMb != null).map((p) => p.rssMb as number);
    const rssSamples = rssVals.length;
    const clockSpaced =
      atMs == null || points.some((p) => p.dtSec == null);

    let spanSec: number | null = null;
    if (!clockSpaced && points.length >= 2) {
      const first = points[0].dtSec as number;
      const last = points[points.length - 1].dtSec as number;
      spanSec = Math.round((last - first) * 10) / 10;
    }

    const drawKind: DeathWindowDrawKind =
      rssSamples >= MIN_CURVE_SAMPLES ? 'curve' : rssSamples === 1 ? 'thin' : 'no-rss';

    const firstRssMb = rssSamples > 0 ? rssVals[0] : null;
    const lastRssMb = rssSamples > 0 ? rssVals[rssSamples - 1] : null;
    const minRssMb = rssSamples > 0 ? Math.min(...rssVals) : null;
    const maxRssMb = rssSamples > 0 ? Math.max(...rssVals) : null;
    const climbMb =
      rssSamples > 0 && maxRssMb != null && firstRssMb != null
        ? Math.round((maxRssMb - firstRssMb) * 10) / 10
        : null;

    // Reversals: pivot where both legs clear the shared delta. A window
    // with fewer than 3 finite rss points cannot carry a two-leg reversal.
    const reversalIdx: number[] = [];
    if (rssSamples >= 3) {
      let reversals = 0;
      const finiteIdx = points
        .map((p, i) => (p.rssMb != null ? i : -1))
        .filter((i) => i >= 0);
      for (let j = 1; j < finiteIdx.length - 1; j++) {
        const prev = points[finiteIdx[j - 1]].rssMb as number;
        const mid = points[finiteIdx[j]].rssMb as number;
        const next = points[finiteIdx[j + 1]].rssMb as number;
        const legUp = mid - prev;
        const legDown = next - mid;
        if (
          Math.abs(legUp) >= REVERSAL_MIN_DELTA_MB &&
          Math.abs(legDown) >= REVERSAL_MIN_DELTA_MB &&
          Math.sign(legUp) !== Math.sign(legDown) &&
          Math.sign(legUp) !== 0 &&
          Math.sign(legDown) !== 0
        ) {
          reversals++;
          reversalIdx.push(finiteIdx[j]);
        }
      }
    }

    const availVals = points.filter((p) => p.availMb != null).map((p) => p.availMb as number);
    const minAvailMb = availVals.length > 0 ? Math.min(...availVals) : null;

    return {
      at: k.at,
      atMs,
      index,
      shapeKind: shapeByAt.get(k.at) ?? null,
      drawKind,
      clockSpaced,
      points,
      rssSamples,
      samples: raw.length,
      firstRssMb,
      lastRssMb,
      minRssMb,
      maxRssMb,
      climbMb,
      spanSec,
      reversals: rssSamples >= 3 ? reversalIdx.length : null,
      reversalIdx,
      minAvailMb,
    };
  });

  const drawable = reads.filter((r) => r.drawKind === 'curve').length;
  const thin = reads.filter((r) => r.drawKind === 'thin').length;
  const noRss = reads.filter((r) => r.drawKind === 'no-rss').length;

  const shapesCensus: Record<string, number> = {};
  for (const r of reads) {
    const key = r.shapeKind ?? 'unknown';
    shapesCensus[key] = (shapesCensus[key] ?? 0) + 1;
  }

  const reversalsMedian = median(
    reads.filter((r) => r.reversals != null).map((r) => r.reversals as number),
  );

  const shapeWords = Object.entries(shapesCensus)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${v} ${k}`)
    .join(' · ');

  const note =
    reads.length === 0
      ? 'no witnessed kills yet — the death windows draw nothing because the record holds nothing'
      : `${reads.length} witnessed windows: ${drawable} draw full curves, ${thin} thin (a single witnessed rss point — a marked point, not a trajectory), ${noRss} without rss (kept, named, never fabricated); shapes: ${shapeWords || 'none'}; median reversals ${reversalsMedian ?? '—'} (both legs ≥ ${REVERSAL_MIN_DELTA_MB} MB)`;

  return { windows: reads, drawable, thin, noRss, shapesCensus, reversalsMedian, note };
}
