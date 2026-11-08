/**
 * THE THREE DRIFTS — the storm's reconciliation card (R106).
 *
 * Three engines already measure the storm's velocities, each on its own
 * geography:
 *   · storm-history  — the CEILING axis: the altitude where boots die
 *                      (MB per kill; rising = deaths climb higher).
 *   · box-floor      — the FLOOR axis: the depth where the box stands when
 *                      the kernel strikes (MB per kill; settling = driven
 *                      deeper).
 *   · pair-sheet     — the OPENING axis: how hot each new boot opens
 *                      (MB per cycle; warming = hotter openers).
 *
 * Each axis carries its own climate word, its own R², its own halves
 * medians — but no panel answers THE question an operator actually asks:
 * do the three geographies AGREE? The storm is one event read on three
 * axes; a ceiling that settles while the floor deepens while the openings
 * warm is not three stories, it is one story told by three instruments —
 * and the only honest way to read them together is directionally, with
 * every confidence number disclosed and every disagreement named.
 *
 * HONESTY RULES (the estate's own):
 *   · No axis invents a velocity — each drift value is its engine's own
 *     output, verbatim. This module re-derives nothing, averages nothing.
 *   · A direction is only CALLED when the axis carries signal: the fit's
 *     R² must reach R2_CALL_THRESHOLD AND the axis's own read must be
 *     non-flat AND the halves medians must move the same way as the fit
 *     (two evidence tracks; when they contradict, the axis is marked
 *     self-contradicted and stays out of every verdict — disclosed,
 *     never resolved by picking a winner).
 *   · Everything short of a call stays the GRIND — the steady, noisy
 *     baseline the witness era actually shows. The grind is a finding,
 *     not a failure to find.
 */

import { DRIFT_THRESHOLD_MB_PER_KILL, MIN_DRIFT_KILLS, type StormHistory } from "./storm-history";
import {
  FLOOR_DRIFT_THRESHOLD_MB_PER_KILL,
  MIN_FLOOR_DRIFT_KILLS,
  type BoxFloorRead,
} from "./box-floor";
import {
  OPENING_DRIFT_THRESHOLD_MB_PER_CYCLE,
  MIN_OPENING_DRIFT_CYCLES,
  type PairSheetRead,
} from "./pair-sheet";

/** A called direction must explain at least half the variance. Below
 *  this the fit leans, it does not speak. */
export const R2_CALL_THRESHOLD = 0.5;

/** The three axes, in the order the eye reads the storm. */
export type AxisKey = "ceiling" | "floor" | "opening";

/** The operator's common tongue — what the axis's own climate word MEANS
 *  for the storm: easing (the pressure recedes), grinding (the steady
 *  baseline), worsening (the pressure builds). */
export type StormDirection = "easing" | "grinding" | "worsening";

/** The reconciliation's own verdicts:
 *  · waiting   — no axis carries any fit at all (the record is too young).
 *  · grind     — fits exist but none callable: the steady baseline.
 *  · solo      — exactly one axis calls; the other two stay quiet. Named
 *                honestly: one instrument is not a chorus.
 *  · one-voice — two or more callable axes agree.
 *  · split     — two or more callable axes disagree. */
export type ReconcileVerdict = "waiting" | "grind" | "solo" | "one-voice" | "split";

export interface DriftAxis {
  key: AxisKey;
  /** The geography the axis measures. */
  label: "CEILING" | "FLOOR" | "OPENING";
  /** The axis's own unit — the three velocities are NOT one number. */
  unit: "MB/KILL" | "MB/CYCLE";
  /** The fitted velocity, verbatim from its engine (null below the
   *  engine's own minimum-n). */
  driftMb: number | null;
  /** R² of that fit, verbatim. */
  r2: number | null;
  /** The axis's own climate word, verbatim (rising/settling/flat or
   *  warming/cooling/flat), null when the engine refused. */
  read: string | null;
  /** The engine's honest n for the fit (judged kills / openings). */
  judged: number;
  /** Halves medians, verbatim — the distribution-free second track. */
  firstHalfMedianMb: number | null;
  secondHalfMedianMb: number | null;
  /** The axis's own calibration the climate word was read at (the
   *  threshold its engine applied to |drift|). */
  thresholdMb: number;
  /** The engine's own minimum-n below which it refuses a fit. */
  minForDrift: number;
  /** The common-tongue direction the word maps to (null = no fit). */
  direction: StormDirection | null;
  /** True when the fit and the halves contradict — the axis disagrees
   *  with itself and stays out of every verdict. */
  selfContradicted: boolean;
  /** callable = fit present, read non-flat, R² at threshold, halves
   *  agree (or are silent). */
  callable: boolean;
}

export interface ThreeDriftsRead {
  axes: [DriftAxis, DriftAxis, DriftAxis];
  /** The callable axes — the only voices that may speak a verdict. */
  called: Array<{ key: AxisKey; direction: StormDirection }>;
  /** Axes with a fit that stayed the grind. */
  grindCount: number;
  /** Axes with no fit at all. */
  waitingCount: number;
  /** Axes marked self-contradicted (disclosed, never averaged away). */
  contradictedCount: number;
  verdict: ReconcileVerdict;
  /** The verdict's direction when solo/one-voice (null otherwise). */
  verdictDirection: StormDirection | null;
  /** The honest one-liner. */
  note: string;
}

function round(v: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(v * f) / f;
}

function sign(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

/** The halves' second track: do the medians move the way the fit moves?
 *  Silent halves (exactly equal, or null) never contradict. */
function halvesAgree(axis: {
  driftMb: number | null;
  firstHalfMedianMb: number | null;
  secondHalfMedianMb: number | null;
}): boolean {
  if (axis.driftMb == null) return false;
  if (axis.firstHalfMedianMb == null || axis.secondHalfMedianMb == null) return true;
  const delta = axis.secondHalfMedianMb - axis.firstHalfMedianMb;
  if (delta === 0) return true;
  return sign(delta) === sign(axis.driftMb);
}

/** Map each axis's own climate word into the operator's common tongue.
 *  The mappings are the axes' PHYSICS, written once:
 *  · ceiling rising  → deaths climb higher     → worsening
 *  · floor settling  → the box is driven deeper → worsening
 *  · opening warming → boots open hotter       → worsening
 *  (and each word's inverse eases; flat grinds). */
const WORD_TO_DIRECTION: Record<AxisKey, Record<string, StormDirection>> = {
  ceiling: { rising: "worsening", settling: "easing", flat: "grinding" },
  floor: { rising: "easing", settling: "worsening", flat: "grinding" },
  opening: { warming: "worsening", cooling: "easing", flat: "grinding" },
};

function buildAxis(
  key: AxisKey,
  label: DriftAxis["label"],
  unit: DriftAxis["unit"],
  engine: {
    drift: number | null;
    r2: number | null;
    read: string | null;
    judged: number;
    firstHalf: number | null;
    secondHalf: number | null;
    threshold: number;
    minForDrift: number;
  },
): DriftAxis {
  const read = engine.read ?? null;
  const direction =
    engine.drift != null && read != null ? (WORD_TO_DIRECTION[key][read] ?? null) : null;
  // the halves track reads the engine's own fields, named explicitly —
  // the shape mismatch (drift vs driftMb) is exactly the silent-false
  // bug this module refuses to ship
  const contradicted =
    direction != null &&
    read !== "flat" &&
    !halvesAgree({
      driftMb: engine.drift,
      firstHalfMedianMb: engine.firstHalf,
      secondHalfMedianMb: engine.secondHalf,
    });
  const callable =
    direction != null &&
    read !== "flat" &&
    engine.r2 != null &&
    engine.r2 >= R2_CALL_THRESHOLD &&
    !contradicted;
  return {
    key,
    label,
    unit,
    driftMb: engine.drift,
    r2: engine.r2,
    read,
    judged: engine.judged,
    firstHalfMedianMb: engine.firstHalf,
    secondHalfMedianMb: engine.secondHalf,
    thresholdMb: engine.threshold,
    minForDrift: engine.minForDrift,
    direction,
    selfContradicted: contradicted,
    callable,
  };
}

export interface ThreeDriftsInputs {
  storm: Pick<
    StormHistory,
    | "judged"
    | "driftMbPerKill"
    | "driftR2"
    | "driftRead"
    | "firstHalfMedianMb"
    | "secondHalfMedianMb"
  >;
  floor: Pick<
    BoxFloorRead,
    | "judged"
    | "floorDriftMbPerKill"
    | "floorDriftR2"
    | "floorDriftRead"
    | "firstHalfMedianMb"
    | "secondHalfMedianMb"
  >;
  pairs: Pick<
    PairSheetRead,
    | "openings"
    | "openingDriftMbPerCycle"
    | "openingDriftR2"
    | "openingDriftRead"
    | "firstHalfMedianClimbMb"
    | "lastHalfMedianClimbMb"
  >;
}

export function threeDrifts(inputs: ThreeDriftsInputs): ThreeDriftsRead {
  const ceiling = buildAxis("ceiling", "CEILING", "MB/KILL", {
    drift: inputs.storm.driftMbPerKill,
    r2: inputs.storm.driftR2,
    read: inputs.storm.driftRead,
    judged: inputs.storm.judged,
    firstHalf: inputs.storm.firstHalfMedianMb,
    secondHalf: inputs.storm.secondHalfMedianMb,
    threshold: DRIFT_THRESHOLD_MB_PER_KILL,
    minForDrift: MIN_DRIFT_KILLS,
  });
  const floor = buildAxis("floor", "FLOOR", "MB/KILL", {
    drift: inputs.floor.floorDriftMbPerKill,
    r2: inputs.floor.floorDriftR2,
    read: inputs.floor.floorDriftRead,
    judged: inputs.floor.judged,
    firstHalf: inputs.floor.firstHalfMedianMb,
    secondHalf: inputs.floor.secondHalfMedianMb,
    threshold: FLOOR_DRIFT_THRESHOLD_MB_PER_KILL,
    minForDrift: MIN_FLOOR_DRIFT_KILLS,
  });
  const opening = buildAxis("opening", "OPENING", "MB/CYCLE", {
    drift: inputs.pairs.openingDriftMbPerCycle,
    r2: inputs.pairs.openingDriftR2,
    read: inputs.pairs.openingDriftRead,
    judged: inputs.pairs.openings.length,
    firstHalf: inputs.pairs.firstHalfMedianClimbMb,
    secondHalf: inputs.pairs.lastHalfMedianClimbMb,
    threshold: OPENING_DRIFT_THRESHOLD_MB_PER_CYCLE,
    minForDrift: MIN_OPENING_DRIFT_CYCLES,
  });
  const axes: [DriftAxis, DriftAxis, DriftAxis] = [ceiling, floor, opening];

  const called = axes
    .filter((a) => a.callable && a.direction != null)
    .map((a) => ({ key: a.key, direction: a.direction as StormDirection }));
  const grindCount = axes.filter((a) => a.driftMb != null && !a.callable).length;
  const waitingCount = axes.filter((a) => a.driftMb == null).length;
  const contradictedCount = axes.filter((a) => a.selfContradicted).length;

  let verdict: ReconcileVerdict;
  let verdictDirection: StormDirection | null = null;
  if (called.length === 0) {
    verdict = waitingCount === axes.length ? "waiting" : "grind";
  } else if (called.length === 1) {
    verdict = "solo";
    verdictDirection = called[0]!.direction;
  } else {
    const directions = new Set(called.map((c) => c.direction));
    if (directions.size === 1) {
      verdict = "one-voice";
      verdictDirection = called[0]!.direction;
    } else {
      verdict = "split";
    }
  }

  const fmt = (v: number | null): string =>
    v == null ? "no fit" : `${v > 0 ? "+" : ""}${round(v)}`;
  const fmtPair = (a: DriftAxis): string => {
    if (a.firstHalfMedianMb == null || a.secondHalfMedianMb == null) return "halves unavailable";
    const d = round(a.secondHalfMedianMb - a.firstHalfMedianMb);
    return `halves ${round(a.firstHalfMedianMb)} → ${round(a.secondHalfMedianMb)} (${d > 0 ? "+" : ""}${d})`;
  };
  const r2Word = (a: DriftAxis): string =>
    a.r2 == null
      ? "no fit"
      : a.r2 >= R2_CALL_THRESHOLD
        ? `R² ${round(a.r2)} — at the call threshold`
        : `R² ${round(a.r2)} — below the ${R2_CALL_THRESHOLD} call threshold (the fit leans, it does not speak)`;

  let note: string;
  if (verdict === "waiting") {
    note =
      "No axis carries a fit yet — the record is younger than every engine's minimum. The reconciliation waits; it does not guess.";
  } else if (verdict === "grind") {
    const axesWord = axes
      .map(
        (a) =>
          `${a.label.toLowerCase()} ${fmt(a.driftMb)} ${a.unit.toLowerCase()} (${a.read ?? "no word"}, ${r2Word(a)}) — ${fmtPair(a)}${a.selfContradicted ? " — the fit and the halves CONTRADICT (disclosed, out of the verdict)" : ""}`,
      )
      .join("; ");
    note = `THE GRIND: no axis carries a callable migration. ${axesWord}. One storm, three geographies, all holding inside their noise bands — the steady baseline is the read, and the R²s say so out loud.`;
  } else if (verdict === "solo") {
    const axis = axes.find((a) => a.callable)!;
    const others = axes
      .filter((a) => !a.callable)
      .map((a) => `${a.label.toLowerCase()} (${a.read ?? "no word"}, ${r2Word(a)})`)
      .join(" and ");
    note = `SOLO CALL: ${axis.label.toLowerCase()} calls ${axis.direction?.toUpperCase()} (${fmt(axis.driftMb)} ${axis.unit.toLowerCase()}, ${r2Word(axis)}, ${fmtPair(axis)}) — but ${others} stay quiet. One instrument is not a chorus; the verdict names its only voice.`;
  } else if (verdict === "one-voice") {
    const callers = called
      .map((c) => {
        const a = axes.find((x) => x.key === c.key)!;
        return `${a.label.toLowerCase()} (${fmt(a.driftMb)} ${a.unit.toLowerCase()}, ${r2Word(a)})`;
      })
      .join(" · ");
    note = `ONE VOICE: ${called.map((c) => c.key).join(" + ")} all call ${verdictDirection?.toUpperCase()} — ${callers}. Two geographies agreeing is the strongest read this card can make.`;
  } else {
    const callers = called.map((c) => `${c.key} → ${c.direction.toUpperCase()}`).join(" · ");
    note = `SPLIT VERDICT: the callable axes disagree — ${callers}. The disagreement is the finding: one geography's storm is another's calm, and the card does not average them away.`;
  }

  return {
    axes,
    called,
    grindCount,
    waitingCount,
    contradictedCount,
    verdict,
    verdictDirection,
    note,
  };
}
