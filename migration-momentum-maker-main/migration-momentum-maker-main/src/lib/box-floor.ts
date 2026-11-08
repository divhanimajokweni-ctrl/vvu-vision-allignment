// src/lib/box-floor.ts — R105 · THE BOX FLOOR, the storm's other axis.
// ─────────────────────────────────────────────────────────────────────────────
// R100's ceiling strip drew where the BOOT died (peak rss, the oscillation's
// top when the kernel struck). R105 draws the twin axis: where the BOX died.
// Every witnessed kill already carries minAvailMb — the deepest box
// MemAvailable inside its witness window — and since the 02:00Z double
// strike the record holds a death the ceiling axis CANNOT explain: boot
// 8835 died at 1816 MB, BELOW the witnessed ceiling band, because the BOX
// ran out (avail 612.7 MB) — the kernel killed the box's biggest consumer,
// not a boot crossing its own band. Two death causes, one record; the
// ceiling strip reads one of them.
//
//   WHERE DOES THE BOX SIT WHEN IT DIES?  The minAvail cluster is the
//   box-pressures' own geography — the floor menu (300 never crossed =
//   the guardian's box rail is BLIND; 400–800 crossed on SOME) reads
//   against it exactly the way the guard menu reads against the ceilings.
//
//   IS THE BOX DYING SHALLOWER OR DEEPER?  OLS of minAvail vs kill
//   sequence + the halves' medians — RISING means each death lands at
//   HIGHER avail (shallower box stress), SETTLING means the box is being
//   driven deeper kill after kill.
//
// Honesty rules (the estate's own, inherited):
//   - a null minAvail keeps its kill but drops from every statistic —
//     counted, never imputed (kill 2's 2-sample window is the live case).
//   - a kill-time dip is NOT a loop verdict: the floor menu's WOULD LOOP
//     arithmetic (the box LIVES near 500–800 MB) belongs to the scenarios
//     grid; this read names where the crossings happen, not what loops.
//   - the double-strike window (2 min) is THE SAME calibration the storm
//     history discloses — one definition, two readers.
//   - every threshold is a FIRST CALIBRATION named in a constant.
// ─────────────────────────────────────────────────────────────────────────────

import { DOUBLE_KILL_GAP_MIN } from "./storm-history";

/** The box-floor drift needs at least this many judged kills before a slope
 *  is named — the same bar MIN_DRIFT_KILLS sets next door. */
export const MIN_FLOOR_DRIFT_KILLS = 4;

/** |OLS slope| above this reads rising/settling rather than flat (MB per
 *  kill). First calibration: the same 10 MB/kill the ceiling drift uses —
 *  the two axes must speak the same sensitivity or their disagreement
 *  means nothing. */
export const FLOOR_DRIFT_THRESHOLD_MB_PER_KILL = 10;

export interface BoxFloorKill {
  /** The kill stamp verbatim — the join key back to the witnessed row. */
  at: string;
  /** Parsed stamp (ms), null when the row's stamp did not parse. */
  atMs: number | null;
  /** 1-based position in the witnessed era (journal order = chronology). */
  seq: number;
  /** Deepest box MemAvailable inside the witness window (MB), null when the
   *  window carried none — the kill stays, the statistics skip it. */
  minAvailMb: number | null;
  /** Minutes since the previous witnessed kill, null for the first beat or
   *  when either neighbor's stamp did not parse. */
  gapFromPrevMin: number | null;
  /** The floor levels this kill's dip crossed (minAvailMb < levelMb), in
   *  the input menu's order. */
  crossedFloorsMb: number[];
}

export interface BoxFloorLevelRead {
  levelMb: number;
  /** Kills whose minAvail dipped under this level. */
  crossed: number;
  /** Kills with a finite minAvail — the honest n. */
  judged: number;
  /** below-all: every judged kill crossed it · some: the band case ·
   *  never: no kill crossed it in-window (the grid's BLIND). */
  verdict: "below-all" | "some" | "never";
}

export type FloorDriftRead = "rising" | "settling" | "flat" | null;

export interface BoxFloorRead {
  kills: BoxFloorKill[];
  /** Kills with a finite minAvail — the statistics' honest n. */
  judged: number;
  /** First→last kill stamp in minutes, null without two parsed stamps. */
  spanMin: number | null;
  /** The deepest box dip on record (the MINIMUM minAvail). */
  deepestMb: number | null;
  /** The shallowest death dip (the MAXIMUM minAvail). */
  shallowestMb: number | null;
  /** Median of the judged dips. */
  medianMinAvailMb: number | null;
  levels: BoxFloorLevelRead[];
  /** OLS of minAvail vs kill sequence, MB per kill-step, null below
   *  MIN_FLOOR_DRIFT_KILLS. */
  floorDriftMbPerKill: number | null;
  /** R² of that fit. */
  floorDriftR2: number | null;
  /** rising: the box dies at higher avail (shallower stress) · settling:
   *  the box is driven deeper · flat: inside the noise band. */
  floorDriftRead: FloorDriftRead;
  /** Median dip across the storm's FIRST half (journal order, middle beat
   *  dropped when the judged count is odd). */
  firstHalfMedianMb: number | null;
  /** Median dip across the LAST half. */
  secondHalfMedianMb: number | null;
  /** True when any witnessed gap landed inside the double-strike window. */
  doubleStrike: boolean;
  /** Every double strike with its beat pair (the storm history's rule). */
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

/** OLS of y over x (closed form), null when x carries no variance. */
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

/** THE box floor — witnessed kills + the floor menu in, the box's own death
 *  geography out. Pure: journal order is trusted as chronology, dips join by
 *  position, and every statistic counts only what exists. The note names its
 *  own scope: a kill-time dip is where the box stood, not a loop verdict. */
export function boxFloorRead(
  kills: Array<{ at: string; atMs?: number | null; minAvailMb?: number | null }>,
  floorsMb: Array<number>,
): BoxFloorRead {
  const rows = kills ?? [];
  const menu = (floorsMb ?? [])
    .filter((f) => typeof f === "number" && Number.isFinite(f))
    .sort((a, b) => a - b);

  const beats: BoxFloorKill[] = rows.map((k, i) => {
    const atMs = typeof k?.atMs === "number" && Number.isFinite(k.atMs) ? k.atMs : null;
    const minAvailMb =
      typeof k?.minAvailMb === "number" && Number.isFinite(k.minAvailMb) ? k.minAvailMb : null;
    return {
      at: String(k?.at ?? ""),
      atMs,
      seq: i + 1,
      minAvailMb,
      gapFromPrevMin: null,
      crossedFloorsMb: [],
    };
  });
  for (let i = 1; i < beats.length; i++) {
    const a = beats[i - 1]!.atMs;
    const b = beats[i]!.atMs;
    if (a != null && b != null) beats[i]!.gapFromPrevMin = round((b - a) / 60000, 2);
  }

  const judgedBeats = beats.filter((b) => b.minAvailMb != null);
  const judged = judgedBeats.length;

  // the crossings — computed per kill against the sorted menu
  for (const b of beats) {
    if (b.minAvailMb == null) continue;
    b.crossedFloorsMb = menu.filter((f) => b.minAvailMb! < f);
  }

  const levels: BoxFloorLevelRead[] = menu.map((f) => {
    const crossed = judgedBeats.filter((b) => b.minAvailMb! < f).length;
    return {
      levelMb: f,
      crossed,
      judged,
      verdict: judged > 0 && crossed === judged ? "below-all" : crossed === 0 ? "never" : "some",
    };
  });

  const parsedStamps = beats.filter((b) => b.atMs != null);
  const spanMin =
    parsedStamps.length >= 2
      ? round((parsedStamps[parsedStamps.length - 1]!.atMs! - parsedStamps[0]!.atMs!) / 60000, 1)
      : null;

  const dips = judgedBeats.map((b) => b.minAvailMb!);
  const deepestMb = dips.length > 0 ? round(Math.min(...dips)) : null;
  const shallowestMb = dips.length > 0 ? round(Math.max(...dips)) : null;
  const rawMedian = median(dips);
  const medianMinAvailMb = rawMedian != null ? round(rawMedian) : null;

  // ── the drift: two estimators over the judged dips ──
  let firstHalfMedianMb: number | null = null;
  let secondHalfMedianMb: number | null = null;
  let floorDriftMbPerKill: number | null = null;
  let floorDriftR2: number | null = null;
  let floorDriftRead: FloorDriftRead = null;
  if (judged >= MIN_FLOOR_DRIFT_KILLS) {
    const half = Math.floor(judged / 2);
    const fh = median(judgedBeats.slice(0, half).map((b) => b.minAvailMb!));
    const lh = median(judgedBeats.slice(judged - half).map((b) => b.minAvailMb!));
    if (fh != null) firstHalfMedianMb = round(fh);
    if (lh != null) secondHalfMedianMb = round(lh);
    const fit = olsSlopeR2(
      judgedBeats.map((b) => b.seq),
      dips,
    );
    if (fit != null) {
      floorDriftMbPerKill = round(fit.slope, 2);
      floorDriftR2 = round(fit.r2, 2);
      floorDriftRead =
        fit.slope > FLOOR_DRIFT_THRESHOLD_MB_PER_KILL
          ? "rising"
          : fit.slope < -FLOOR_DRIFT_THRESHOLD_MB_PER_KILL
            ? "settling"
            : "flat";
    }
  }

  const doubleStrikeBeats = beats
    .filter((b) => b.gapFromPrevMin != null && b.gapFromPrevMin < DOUBLE_KILL_GAP_MIN)
    .map((b) => ({ from: b.seq - 1, to: b.seq, gapMin: b.gapFromPrevMin! }));
  const doubleStrike = doubleStrikeBeats.length > 0;

  // ── the note ──
  let note: string;
  if (beats.length === 0) {
    note = "no witnessed kills on record yet — the box floor waits for the journal, honestly empty";
  } else if (judged === 0) {
    note =
      "witnessed kills exist but none carries a finite box dip — the floor read waits for a window that saw the box, honestly empty";
  } else {
    const parts: string[] = [];
    parts.push(
      `${judged} witnessed dips across ${spanMin != null ? `${spanMin} min` : "an unparsable span"} of storm time`,
    );
    parts.push(
      `the box died at a ${medianMinAvailMb} MB median dip — deepest ${deepestMb}, shallowest ${shallowestMb}`,
    );
    if (floorDriftRead != null && floorDriftMbPerKill != null) {
      const dir =
        floorDriftRead === "rising"
          ? `dying at HIGHER avail kill after kill (+${floorDriftMbPerKill} MB/kill, R² ${floorDriftR2}) — shallower box stress`
          : floorDriftRead === "settling"
            ? `driven DEEPER kill after kill (${floorDriftMbPerKill} MB/kill, R² ${floorDriftR2})`
            : `holding inside the noise band (${floorDriftMbPerKill > 0 ? "+" : ""}${floorDriftMbPerKill} MB/kill, R² ${floorDriftR2})`;
      parts.push(`the box is ${dir}`);
      if (firstHalfMedianMb != null && secondHalfMedianMb != null) {
        const delta = round(secondHalfMedianMb - firstHalfMedianMb);
        parts.push(
          `the storm's first half died at a ${firstHalfMedianMb} MB median dip, its last half ${secondHalfMedianMb} (${delta >= 0 ? "+" : ""}${delta} MB)`,
        );
      }
    }
    const belowAll = levels.filter((l) => l.verdict === "below-all").map((l) => l.levelMb);
    const never = levels.filter((l) => l.verdict === "never").map((l) => l.levelMb);
    const some = levels.filter((l) => l.verdict === "some").map((l) => l.levelMb);
    if (never.length > 0) {
      parts.push(
        `no dip ever crossed ${never.join("/")} (the box rails there are blind to the whole record)`,
      );
    }
    if (belowAll.length > 0) {
      parts.push(`${belowAll.join("/")} crossed on EVERY judged kill`);
    }
    if (some.length > 0) {
      const someBits = some
        .map((l) => {
          const lv = levels.find((x) => x.levelMb === l)!;
          return `${l} on ${lv.crossed}/${lv.judged}`;
        })
        .join(" · ");
      parts.push(`inside the stress: ${someBits}`);
    }
    if (doubleStrikeBeats.length > 0) {
      const list = doubleStrikeBeats
        .map((d) => `kills ${d.from}→${d.to} (${d.gapMin} min)`)
        .join(", ");
      parts.push(
        doubleStrikeBeats.length === 1
          ? `one double strike: ${list} — the same disclosure the storm history makes`
          : `${doubleStrikeBeats.length} double strikes: ${list} — the same disclosure the storm history makes`,
      );
    }
    note = `${parts.join(" — ")}. A kill-time dip is where the box stood when the kernel struck — the loop verdicts stay the scenarios grid's.`;
  }

  return {
    kills: beats,
    judged,
    spanMin,
    deepestMb,
    shallowestMb,
    medianMinAvailMb,
    levels,
    floorDriftMbPerKill,
    floorDriftR2,
    floorDriftRead,
    firstHalfMedianMb,
    secondHalfMedianMb,
    doubleStrike,
    doubleStrikeBeats,
    note,
  };
}
