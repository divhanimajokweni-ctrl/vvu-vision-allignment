// R118 — THE QUICKENING LENS: the pace of the storm, measured.
//
// R117's risk #1 named the watch: four kills landed in 77 minutes (gaps
// 30.95 / 22.2 / 24.0 — every one at or under the heartbeat), and the
// question stood uninstrumented — is the record's kill cadence COMPRESSING,
// HOLDING, or STRETCHING? The era card carves the timeline at its lulls;
// the storm history reads the band's drift; neither answers the pace
// question directly. This lens does, with the record's own vocabulary and
// nothing new:
//
//   THE GAPS     — consecutive witnessed-death intervals (the heartbeat's
//                  own raw material, all causes — the R116 feed).
//
//   THE WINDOW   — the last PACE_WINDOW gaps are the record's present
//                  pace. Their house lower-median against the heartbeat
//                  (storm-history's full-median interval, handed in by the
//                  caller — one calibration, many readers) gives THE
//                  VERDICT:
//     QUICKENING  — window median ≤ PACE_QUICKEN_RATIO × the line (the
//                   storm compressing; INCLUSIVE edge — at the line is
//                   quickened, not steady)
//     STRETCHING  — window median ≥ CADENCE_STRETCH_RATIO × the line (the
//                   same 1.25 the lull dial and the era card read — the
//                   record's own stretch line, not a new one)
//     STEADY      — between the lines
//     TOO FEW     — under PACE_MIN_GAPS honest gaps; a thin record cannot
//                   call a pace shift
//   When the heartbeat itself is unreadable (null or ≤ 0), the lens does
//   not invent one: its line falls back to the record's own full gap
//   median and the reason SAYS SO.
//
//   THE STREAK   — how many consecutive trailing gaps landed INSIDE the
//                  heartbeat (strictly below it): the compress's depth.
//                  R117's "a fifth kill inside the heartbeat" is this
//                  counter reaching five — the streak is the finding's
//                  arithmetic, not a prophecy.
//
//   THE SUB-VERDICT — R118's risk #2, the tension the median grammar can
//                  hide: the window's median can sit BETWEEN the lines
//                  (STEADY) while every recent kill lands inside the
//                  heartbeat. When the verdict is STEADY and the streak
//                  reaches PACE_STREAK_SUB_VERDICT (five — the count R117
//                  named), the lens speaks a second word — COMPRESSING
//                  UNDERNEATH — next to the first. Both grammars are said;
//                  neither overrides the other. It fires on STEADY only:
//                  QUICKENING already says compressing (no tension), and a
//                  streak of five inside the heartbeat is arithmetically
//                  incompatible with STRETCHING (five of the six window
//                  gaps under the line drags the median under it) — a
//                  STEADY window with a deep tail is the one honest
//                  disagreement the two grammars can have.
//
//   THE ROLLING PACE — kills in the last 60 min / 3 h / 6 h from the
//                  caller's clock, kills per hour each. The caller's
//                  clock is handed in (the engine stays pure); the panel
//                  owns Date.now().
//
//   THE CLOCK    — minutes since the newest death, against the window's
//                  own median gap: the live dial. It names ELAPSED vs
//                  EXPECTED, never when the next death comes — the lens
//                  reads the record's past; the future is nobody's to
//                  read. A stamp ahead of the caller's clock (skew)
//                  refuses the dial honestly.
//
// Pure: no I/O, no clock. Deaths and options handed in; the gaps are the
// deterministic arithmetic of consecutive atMs (clock-skewed rows —
// negative or non-finite intervals — are skipped, as eras.ts skips them).

import { houseLowerMedian } from "./eras";
import { CADENCE_STRETCH_RATIO } from "./storm-history";

/** The recent window = the last N honest gaps — the record's present pace. */
export const PACE_WINDOW = 6;

/** Below this many honest gaps the verdict refuses (TOO FEW). */
export const PACE_MIN_GAPS = 4;

/** QUICKENING line: window median at or below this fraction of the line. */
export const PACE_QUICKEN_RATIO = 0.75;

/** Rolling pace spans the panel reads (minutes). */
export const PACE_ROLLING_MIN = [60, 180, 360];

/** The streak depth at which the sub-verdict speaks: R117 named "a fifth
 *  kill inside the heartbeat"; R118's risk #2 named the tension; this is
 *  the count that resolves it into a word. */
export const PACE_STREAK_SUB_VERDICT = 5;

/** R127 — the drift band: the window median's motion inside ±10% of the
 *  prior window's median reads STEADY; beyond it, FALLING/RISING. The
 *  band is EXCLUSIVE at exactly ±10% (a full ten-percent move is a move). */
export const PACE_DRIFT_BAND = 0.1;

export type PaceDrift = "FALLING" | "RISING" | "STEADY";

export type KillPaceVerdict = "QUICKENING" | "STEADY" | "STRETCHING" | "TOO FEW";

/** The sub-verdict: the median grammar and the streak grammar disagreeing
 *  out loud. STEADY stays the verdict — the sub-verdict rides beside it. */
export type PaceSubVerdict = "COMPRESSING UNDERNEATH";

export interface PaceDeath {
  at: string;
  atMs: number;
  cause: string;
}

export interface PaceGap {
  /** 1-based index of the gap in the honest gap series. */
  index: number;
  gapMin: number;
  fromAt: string;
  toAt: string;
  /** The cause of the death that CLOSED the gap. */
  cause: string;
}

export interface PaceRolling {
  labelMin: number;
  kills: number;
  perHour: number;
}

export interface KillPaceRead {
  deaths: number;
  gaps: PaceGap[];
  /** The last PACE_WINDOW honest gaps (fewer when the record is younger). */
  windowGaps: PaceGap[];
  /** The caller's heartbeat (echoed) — null when unreadable. */
  heartbeatMin: number | null;
  /** The line the verdict actually rode — the heartbeat, or (when the
   *  heartbeat is unreadable) the record's own full gap median, SAID. */
  lineMin: number;
  lineFallback: boolean;
  fullMedianMin: number | null;
  windowMedianMin: number | null;
  /** windowMedian / line — null when the window median is unavailable. */
  ratio: number | null;
  verdict: KillPaceVerdict;
  verdictReason: string;
  /** R119 — the sub-verdict: COMPRESSING UNDERNEATH when the verdict is
   *  STEADY and the streak has reached PACE_STREAK_SUB_VERDICT; null
   *  otherwise (including every other verdict — the tension is a STEADY
   *  tension, and TOO FEW has no word to compound). */
  subVerdict: PaceSubVerdict | null;
  subVerdictReason: string | null;
  /** Trailing consecutive gaps strictly inside the heartbeat (null when
   *  the heartbeat is unreadable). */
  insideStreak: number | null;
  rolling: PaceRolling[];
  /** Minutes since the newest death (null: no deaths, or its stamp runs
   *  ahead of the caller's clock — skew refuses the dial). */
  sinceLastMin: number | null;
  /** sinceLastMin / windowMedianMin — the live dial (null when either
   *  side is unavailable). */
  clockRatio: number | null;
  /** R127 — the window's own motion: the median of the PACE_WINDOW gaps
   *  immediately BEFORE the current window (null when fewer than
   *  PACE_MIN_GAPS exist there — a thin record refuses the drift). */
  priorWindowMedianMin: number | null;
  /** (windowMedian − priorWindowMedian) / priorWindowMedian, signed —
   *  null when either median is unreadable. */
  windowDriftPct: number | null;
  /** FALLING/RISING beyond the PACE_DRIFT_BAND, STEADY inside it; null
   *  when either median is unreadable. The motion SAID, not implied: the
   *  verdict compares the window to the line (the long median), the drift
   *  compares the windows to EACH OTHER (the short motion). */
  windowDrift: PaceDrift | null;
  note: string;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** THE LENS — witnessed deaths in, the pace read out. */
export function killPaceRead(
  deaths: Array<PaceDeath>,
  opts: { heartbeatMin: number | null; nowMs: number },
): KillPaceRead {
  const list = (deaths ?? []).filter((d) => d && Number.isFinite(d.atMs));

  // The honest gap series — consecutive atMs, skewed rows skipped.
  const gaps: PaceGap[] = [];
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1]!;
    const cur = list[i]!;
    const ms = cur.atMs - prev.atMs;
    if (!Number.isFinite(ms) || ms < 0) continue; // clock-skewed pair: no honest gap
    gaps.push({
      index: gaps.length + 1,
      gapMin: ms / 60000,
      fromAt: prev.at,
      toAt: cur.at,
      cause: cur.cause ?? "unknown",
    });
  }

  const windowGaps = gaps.slice(-PACE_WINDOW);
  const windowMedianMin = houseLowerMedian(windowGaps.map((g) => g.gapMin));
  const priorWindowGaps = gaps.slice(-PACE_WINDOW * 2, -PACE_WINDOW);
  const priorWindowMedianMin =
    priorWindowGaps.length >= PACE_MIN_GAPS
      ? houseLowerMedian(priorWindowGaps.map((g) => g.gapMin))
      : null;
  const fullMedianMin = houseLowerMedian(gaps.map((g) => g.gapMin));

  const heartbeat =
    opts.heartbeatMin != null && Number.isFinite(opts.heartbeatMin) && opts.heartbeatMin > 0
      ? opts.heartbeatMin
      : null;
  const lineFallback = heartbeat === null;
  const lineMin = heartbeat ?? fullMedianMin ?? 0;

  // THE STREAK — trailing gaps strictly inside the heartbeat. Computed
  // before the verdict so the sub-verdict can read it (R119).
  let insideStreak: number | null = null;
  if (heartbeat !== null) {
    insideStreak = 0;
    for (let i = gaps.length - 1; i >= 0; i--) {
      const g = gaps[i]!;
      if (g.gapMin < heartbeat) insideStreak += 1;
      else break;
    }
  }

  // The window's own ratio — hoisted so the verdict, the read object, and
  // the sub-verdict's reason all read the same arithmetic (one calibration).
  const ratio = windowMedianMin != null && lineMin > 0 ? round2(windowMedianMin / lineMin) : null;

  // THE VERDICT.
  let verdict: KillPaceVerdict;
  let verdictReason: string;
  if (gaps.length < PACE_MIN_GAPS || windowMedianMin == null || lineMin <= 0) {
    verdict = "TOO FEW";
    verdictReason =
      `${gaps.length} honest gap(s) is under the ${PACE_MIN_GAPS} the verdict needs` +
      (lineMin <= 0 && gaps.length > 0
        ? " — and no line to read against (the record has a median of nothing)"
        : " — a thin record cannot call a pace shift");
  } else {
    const r = windowMedianMin / lineMin;
    if (r <= PACE_QUICKEN_RATIO) {
      verdict = "QUICKENING";
      verdictReason =
        `the last ${windowGaps.length} gaps read a ${round2(windowMedianMin)}-min median against the ${round2(lineMin)}-min line — ` +
        `${Math.round(r * 100)}% of it, at or under the ${Math.round(PACE_QUICKEN_RATIO * 100)}% call: the storm compressing`;
    } else if (r >= CADENCE_STRETCH_RATIO) {
      verdict = "STRETCHING";
      verdictReason =
        `the last ${windowGaps.length} gaps read a ${round2(windowMedianMin)}-min median against the ${round2(lineMin)}-min line — ` +
        `${Math.round(r * 100)}% of it, at or over the ${CADENCE_STRETCH_RATIO} stretch line (the lull dial's own constant): the storm spreading out`;
    } else {
      verdict = "STEADY";
      verdictReason =
        `the last ${windowGaps.length} gaps read a ${round2(windowMedianMin)}-min median against the ${round2(lineMin)}-min line — ` +
        `${Math.round(r * 100)}% of it, between the ${Math.round(PACE_QUICKEN_RATIO * 100)}% and ${CADENCE_STRETCH_RATIO} lines: business as usual`;
    }
    if (lineFallback) {
      verdictReason +=
        " — the heartbeat is unreadable, so the line is the record's own full gap median (said, not hidden)";
    }
  }

  // THE SUB-VERDICT — the STEADY tension (R118's risk #2): a median between
  // the lines while the tail lives inside the heartbeat. STEADY-only, said
  // beside the verdict, never over it.
  let subVerdict: PaceSubVerdict | null = null;
  let subVerdictReason: string | null = null;
  if (verdict === "STEADY" && insideStreak != null && insideStreak >= PACE_STREAK_SUB_VERDICT) {
    subVerdict = "COMPRESSING UNDERNEATH";
    subVerdictReason =
      `the median sits between the lines (${ratio != null ? Math.round(ratio * 100) : "—"}% of the line) while the last ${insideStreak} kills all landed inside the heartbeat — ` +
      `the window's middle hides the compress its tail is living; both grammars are said, neither is hidden`;
  }

  // THE WINDOW'S DRIFT (R127) — the windows compared to each other.
  let windowDriftPct: number | null = null;
  let windowDrift: PaceDrift | null = null;
  if (windowMedianMin != null && priorWindowMedianMin != null && priorWindowMedianMin > 0) {
    windowDriftPct = round2((windowMedianMin - priorWindowMedianMin) / priorWindowMedianMin);
    windowDrift =
      Math.abs(windowDriftPct) < PACE_DRIFT_BAND
        ? "STEADY"
        : windowDriftPct < 0
          ? "FALLING"
          : "RISING";
  }

  // THE ROLLING PACE — kills inside each span ending at the caller's now.
  const lastAtMs = list.length ? list[list.length - 1]!.atMs : null;
  const rolling: PaceRolling[] = PACE_ROLLING_MIN.map((labelMin) => {
    const fromMs = opts.nowMs - labelMin * 60_000;
    const kills = list.filter((d) => d.atMs >= fromMs && d.atMs <= opts.nowMs).length;
    return { labelMin, kills, perHour: round2((kills / labelMin) * 60) };
  });

  // THE CLOCK — elapsed vs the window's own median. Skew refuses.
  let sinceLastMin: number | null = null;
  let clockRatio: number | null = null;
  if (lastAtMs != null) {
    const since = (opts.nowMs - lastAtMs) / 60000;
    if (Number.isFinite(since) && since >= 0) {
      sinceLastMin = round2(since);
      if (windowMedianMin != null && windowMedianMin > 0) {
        clockRatio = round2(sinceLastMin / windowMedianMin);
      }
    }
  }

  const read: KillPaceRead = {
    deaths: list.length,
    gaps,
    windowGaps,
    heartbeatMin: heartbeat,
    lineMin,
    lineFallback,
    fullMedianMin,
    windowMedianMin,
    ratio,
    verdict,
    verdictReason,
    subVerdict,
    subVerdictReason,
    insideStreak,
    rolling,
    sinceLastMin,
    clockRatio,
    priorWindowMedianMin,
    windowDriftPct,
    windowDrift,
    note: "",
  };
  read.note = buildNote(read);
  return read;
}

function buildNote(r: KillPaceRead): string {
  if (r.deaths === 0) {
    return "no witnessed death yet — the storm has no pace to read";
  }
  const parts: string[] = [];
  parts.push(`${r.deaths} witnessed deaths · ${r.gaps.length} honest gap(s)`);
  if (r.gaps.length >= 1) {
    const recent = r.windowGaps.map((g) => round2(g.gapMin)).join(" / ");
    parts.push(
      `the window's gaps: ${recent} (median ${r.windowMedianMin == null ? "—" : round2(r.windowMedianMin)} min)`,
    );
  }
  parts.push(`${r.verdict}: ${r.verdictReason}`);
  if (r.subVerdict && r.subVerdictReason) {
    parts.push(`THE SUB-VERDICT: ${r.subVerdict} — ${r.subVerdictReason}`);
  }
  if (r.insideStreak != null && r.insideStreak >= 2) {
    parts.push(
      `the compress streak: ${r.insideStreak} consecutive kills inside the ${round2(r.lineMin)}-min heartbeat — the quickening's own depth`,
    );
  }
  if (r.rolling.length) {
    parts.push(
      `rolling pace: ${r.rolling.map((s) => `${s.labelMin >= 60 ? `${s.labelMin / 60}h` : `${s.labelMin}m`} ${s.kills} (${s.perHour}/h)`).join(" · ")}`,
    );
  }
  if (r.sinceLastMin != null) {
    const pct =
      r.clockRatio != null ? ` — ${Math.round(r.clockRatio * 100)}% of the window's median` : "";
    parts.push(
      `the clock: ${r.sinceLastMin} min since the newest death${pct} (elapsed, never a forecast)`,
    );
  } else if (r.deaths > 0) {
    parts.push("the clock refuses: the newest death stamp runs ahead of the caller's clock (skew)");
  }
  parts.push("the pace reads the record's past; the future is nobody's to read");
  return parts.join(" · ");
}
