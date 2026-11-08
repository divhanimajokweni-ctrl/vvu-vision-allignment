// R114 — THE LATENCY MEMORY: the latency ledger, remembered.
//
// R110's handover left one question standing: is the analytics route's
// heavy p95 COMPILE-COLD (a one-time compile cost that a fresh window
// would not repeat) or STEADY-HEAVY (a finding for the operator to act
// on)? One read cannot answer it — the ledger's window is a rolling
// 4000-line frame, and the honest test needs the question asked ACROSS
// frames: what does the route's p95 do when the window goes quiet?
//
//   THE QUIET READ — a snapshot whose window carries ZERO `▲ Next.js`
//   boot banners. A respawn forces recompiles; a window without one is
//   as quiet as the record can honestly claim (the ledger invents no
//   clock, so quiet is defined by the log's own vocabulary, not by
//   wall-time silence).
//
//   THE SNAPSHOT — the ledger read distilled to its comparison-bearing
//   fields (window shape, estate percentiles, respawn count, compile
//   share, the hot top-8 with p50/p95, the heaviest route). Each read
//   appends at most one snapshot; reads closer than MIN_GAP to the last
//   are the SAME frame and are refused (the panel's 60s poll and a
//   manual re-read must not double-count one window). The store is
//   bounded — the oldest snapshots fall off the far end.
//
//   THE VERDICT — per tracked route (the latest frame's hot list plus
//   its heaviest), the route's p95 in quiet reads vs noisy reads, over
//   the house lower-median (one calibration, many readers):
//     COMPILE-COLD  — quiet p95 ≤ P95_DROP_RATIO × noisy p95: the
//                     heaviness collapses when the compiles leave.
//     STEADY-HEAVY  — quiet p95 ≥ P95_STICK_RATIO × noisy p95 (or, with
//                     no noisy history at all, ≥ P95_ESTATE_MULT × the
//                     estate's own quiet p95 median — heavy with no
//                     respawn anywhere near, the strongest form).
//     MIXED         — between the lines, honestly.
//     CALM          — quiet reads only, and the route is not heavy
//                     against the estate's own quiet scale.
//     TOO FEW       — the refusal: the quiet hour has not arrived.
//
// Pure: no I/O, no clock. The route owns the file and the timestamp.

import type { LatencyLedgerRead } from "@/lib/latency-ledger";
import { houseLowerMedian } from "@/lib/eras";

/** Bounded store — 360 snapshots at the panel's 60s cadence ≈ a 6h memory. */
export const LATENCY_MEMORY_CAP = 360;

/** Two reads closer than this are the SAME window — the second is refused. */
export const LATENCY_MEMORY_MIN_GAP_MS = 30_000;

/** Hot routes carried per snapshot (the ledger's own hot sort, sliced). */
export const LATENCY_MEMORY_HOT_ROWS = 8;

/** A verdict needs at least this many quiet reads to speak. */
export const MIN_QUIET_READS = 3;

/** …and at least this many noisy reads for the self-comparison. */
export const MIN_NOISY_READS = 3;

/** COMPILE-COLD line: quiet p95 at or below this fraction of noisy p95. */
export const P95_DROP_RATIO = 0.5;

/** STEADY-HEAVY line: quiet p95 keeps at least this fraction of noisy p95. */
export const P95_STICK_RATIO = 0.75;

/** Fallback baseline (no noisy history): heavy means ≥ this × the estate's
 *  own quiet-window p95 median. */
export const P95_ESTATE_MULT = 2.0;

export interface LatencySnapshotHot {
  /** `METHOD /path` — the ledger's own method × path grain. */
  label: string;
  requests: number;
  p50Ms: number;
  p95Ms: number;
}

export interface LatencySnapshot {
  atMs: number;
  windowLines: number;
  totalRequests: number;
  routeCount: number;
  parsed: number;
  contextLines: number;
  /** ▲ Next.js boot banners in the window — 0 is what makes a read quiet. */
  respawns: number;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
  compileSharePct: number | null;
  nonOkTotal: number;
  hot: Array<LatencySnapshotHot>;
  heaviestLabel: string | null;
  heaviestP95Ms: number | null;
}

export type LatencyVerdictWord = "COMPILE-COLD" | "STEADY-HEAVY" | "MIXED" | "CALM" | "TOO FEW";

export interface LatencyVerdict {
  label: string;
  word: LatencyVerdictWord;
  /** Quiet/noisy read counts for this label (p95-bearing only). */
  quietCount: number;
  noisyCount: number;
  quietMedP95: number | null;
  noisyMedP95: number | null;
  /** The estate's own quiet p95 median — the fallback baseline. */
  estateQuietMedP95: number | null;
  /** quietMed / noisyMed when the self-comparison ran, else null. */
  ratio: number | null;
  reason: string;
}

export interface LatencyTrendPoint {
  atMs: number;
  p95Ms: number;
  requests: number;
  quiet: boolean;
}

export interface LatencyEstatePoint {
  atMs: number;
  p95Ms: number | null;
  quiet: boolean;
}

export interface LatencyTrend {
  label: string;
  /** The route's p95 across the snapshots where it appears, oldest →
   *  newest, sliced to the last LATENCY_MEMORY_TREND_POINTS — absent
   *  frames are honest gaps, skipped never interpolated. */
  points: Array<LatencyTrendPoint>;
}

/** R118 — THE QUIET HOUR PROGRESS: the R110 answer's own countdown. The
 *  verdicts need MIN_QUIET_READS quiet reads; the trailing streak — the
 *  consecutive quiet snapshots ending at the newest — is how close the
 *  record is. Any noisy read resets the streak to zero (trailing means
 *  trailing); the streak counts snapshots, never wall-time. */
export interface QuietProgress {
  /** Consecutive quiet snapshots ending at the newest. */
  quietStreak: number;
  /** The quiet reads one verdict needs (echoed for the panel's lane). */
  quietNeeded: number;
  /** The newest window's own respawn count — why the streak is live or
   *  broken, in the log's own vocabulary. */
  newestRespawns: number;
  /** True when the newest snapshot itself is quiet — the streak is LIVE
   *  and the next quiet reads extend it. */
  liveQuiet: boolean;
}

/** Per-route trend depth — the last hour at the panel's 60s cadence. */
export const LATENCY_MEMORY_TREND_POINTS = 60;

/** R124 — THE ANSWERED WORD ORDER: the house's severity order for the
 *  answer's distribution. The strongest finding leads (STEADY-HEAVY is the
 *  operator's call to action), the refusal trails. One order, every reader. */
export const QUIET_WORD_ORDER: Array<LatencyVerdictWord> = [
  "STEADY-HEAVY",
  "MIXED",
  "COMPILE-COLD",
  "CALM",
  "TOO FEW",
];

/** R124 — THE ANSWERED CHIP: the quiet hour's own verdict moment. While the
 *  streak counts down, the lane waits; when the trailing quiet reads reach
 *  the need, the R110 question is ANSWERED and the chip names what the
 *  record said — the subject route's own word (the latest frame's heaviest,
 *  the question's subject) first, the whole house's distribution after.
 *  Pure: derived from the same read it rides, never a second parse. */
export interface QuietHourAnswer {
  /** true when the trailing quiet streak reaches the need. */
  answered: boolean;
  streak: number;
  needed: number;
  /** needed − streak, 0 when answered. */
  remaining: number;
  /** tracked routes carrying a word (TOO FEW excluded). */
  speaking: number;
  /** the house's word distribution, severity order, only n > 0 rows. */
  words: Array<{ word: LatencyVerdictWord; n: number }>;
  /** the subject route's own word — null when the subject is absent from
   *  the latest frame or carries no verdict yet (silence is honest). */
  subjectWord: LatencyVerdictWord | null;
  subjectLabel: string | null;
  /** the note's answer clause — verbatim on the card. */
  line: string;
}

export function quietHourAnswer(
  tracked: Array<LatencyVerdict>,
  quiet: QuietProgress,
  subjectLabel: string | null,
): QuietHourAnswer {
  const answered = quiet.quietStreak >= quiet.quietNeeded;
  const remaining = Math.max(0, quiet.quietNeeded - quiet.quietStreak);

  const counts = new Map<LatencyVerdictWord, number>();
  for (const v of tracked) counts.set(v.word, (counts.get(v.word) ?? 0) + 1);
  const words = QUIET_WORD_ORDER.filter((w) => (counts.get(w) ?? 0) > 0).map((w) => ({
    word: w,
    n: counts.get(w) as number,
  }));
  const speaking = tracked.filter((v) => v.word !== "TOO FEW").length;

  const subject = subjectLabel ? (tracked.find((v) => v.label === subjectLabel) ?? null) : null;
  const subjectWord = subject && subject.word !== "TOO FEW" ? subject.word : null;

  const house = words.map((w) => `${w.n} ${w.word}`).join(" · ");
  let line: string;
  if (!answered) {
    line = `the quiet hour is not answered — streak ${quiet.quietStreak}/${quiet.quietNeeded}, ${remaining} quiet read(s) short`;
  } else if (subjectWord != null) {
    line = `the quiet hour is ANSWERED — the subject ${subjectLabel} says ${subjectWord}; the house: ${house}`;
  } else if (subject != null) {
    line = `the quiet hour is ANSWERED — the subject ${subjectLabel} is still silent (${subject.word}); the house: ${house}`;
  } else if (subjectLabel != null) {
    line = `the quiet hour is ANSWERED — the subject ${subjectLabel} is still silent (no verdict row); the house: ${house}`;
  } else {
    line = `the quiet hour is ANSWERED — no subject route in the latest frame; the house: ${house}`;
  }

  return {
    answered,
    streak: quiet.quietStreak,
    needed: quiet.quietNeeded,
    remaining,
    speaking,
    words,
    subjectWord,
    subjectLabel,
    line,
  };
}

/** R124 — THE CHURN CLOCK: when does the quiet hour arrive? The window is
 *  the log's own last N lines; a respawn banner exits when the churn pushes
 *  it past the tail. The memory has watched exits happen — consecutive
 *  snapshots whose respawn count DROPPED — and the clock speaks from those
 *  observations alone: the median gap between observed exits (in minutes
 *  from the snapshots' own atMs, in reads from their count), times the
 *  banners still in the newest window. An estimate that says so, never a
 *  prediction dressed as fact — a new respawn entering resets the arithmetic
 *  and the line says the condition out loud. Refusals are honest: no exit
 *  ever observed, or no banner left to wait for. Pure. */
export interface ChurnClock {
  /** snapshot pairs where the respawn count dropped. */
  exitsObserved: number;
  /** total banners that left the window across those drops. */
  bannersExited: number;
  /** respawn banners remaining in the newest window. */
  bannersRemaining: number;
  /** median minutes between observed exits (house lower-median of the
   *  gaps' own deltas). */
  medianExitGapMin: number | null;
  /** median snapshot-steps between observed exits. */
  medianExitGapReads: number | null;
  /** bannersRemaining × medianExitGapReads — null when the clock refuses. */
  etaReads: number | null;
  /** bannersRemaining × medianExitGapMin — null when the clock refuses. */
  etaMin: number | null;
  /** the note's clock clause — verbatim on the card. */
  line: string;
}

export function churnClock(store: Array<LatencySnapshot>): ChurnClock {
  const snaps = (Array.isArray(store) ? store : []).filter(
    (s) => s && typeof s.atMs === "number" && typeof s.respawns === "number",
  );
  const newest = snaps.length > 0 ? snaps[snaps.length - 1]! : null;
  const bannersRemaining = newest ? newest.respawns : 0;

  const drops: Array<{ atMs: number; step: number }> = [];
  let exited = 0;
  for (let i = 1; i < snaps.length; i++) {
    const d = snaps[i - 1]!.respawns - snaps[i]!.respawns;
    if (d > 0) {
      drops.push({ atMs: snaps[i]!.atMs, step: i });
      exited += d;
    }
  }

  const refuse = (line: string): ChurnClock => ({
    exitsObserved: drops.length,
    bannersExited: exited,
    bannersRemaining,
    medianExitGapMin: null,
    medianExitGapReads: null,
    etaReads: null,
    etaMin: null,
    line,
  });

  if (drops.length < 2) {
    return refuse(
      drops.length === 0
        ? "the churn clock refuses — no banner exit has ever been observed in the memory"
        : "the churn clock refuses — one banner exit observed, a cadence needs two",
    );
  }

  const gapMin: number[] = [];
  const gapReads: number[] = [];
  for (let k = 1; k < drops.length; k++) {
    gapMin.push((drops[k]!.atMs - drops[k - 1]!.atMs) / 60_000);
    gapReads.push(drops[k]!.step - drops[k - 1]!.step);
  }
  const medMin = houseLowerMedian(gapMin);
  const medReads = houseLowerMedian(gapReads) as number;

  if (bannersRemaining === 0) {
    return {
      exitsObserved: drops.length,
      bannersExited: exited,
      bannersRemaining,
      medianExitGapMin: medMin,
      medianExitGapReads: medReads,
      etaReads: 0,
      etaMin: 0,
      line: "the churn clock: no banner remains in the newest window — the quiet hour is here if the streak holds",
    };
  }

  const etaReads = bannersRemaining * medReads;
  const medMinN = medMin as number;
  const etaMin = bannersRemaining * medMinN;
  return {
    exitsObserved: drops.length,
    bannersExited: exited,
    bannersRemaining,
    medianExitGapMin: medMin,
    medianExitGapReads: medReads,
    etaReads,
    etaMin,
    line: `the churn clock: ${bannersRemaining} banner(s) remain, exits every ~${Math.round(medMinN * 10) / 10} min / ~${medReads} read(s) — the quiet hour is ~${Math.round(etaMin)} min away if no new respawn enters`,
  };
}

export interface LatencyMemoryRead {
  snapshots: number;
  /** Newest minus oldest atMs; null for a one-snapshot memory. */
  spanMs: number | null;
  quietReads: number;
  /** R118 — the ANSWERED countdown: the trailing quiet streak vs the
   *  quiet reads one verdict needs. */
  quiet: QuietProgress;
  /** R124 — the ANSWERED chip: the hour's verdict moment, the subject's
   *  word and the house's distribution. */
  quietAnswer: QuietHourAnswer;
  /** R124 — the churn clock: the observed banner-exit cadence and the
   *  honest ETA to the quiet hour. */
  churn: ChurnClock;
  /** Tracked routes (the latest frame's hot list ∪ its heaviest), verdicts in hot order. */
  tracked: Array<LatencyVerdict>;
  /** Per-tracked-route p95 series, same order as tracked. */
  trends: Array<LatencyTrend>;
  /** The latest frame's heaviest route label — the R110 question's subject. */
  latestHeaviestLabel: string | null;
  /** The estate's p95 across every snapshot, oldest → newest. */
  estateP95Series: Array<LatencyEstatePoint>;
  /** The engine's own one-liner — THE READ shows it verbatim. */
  note: string;
}

/** A read is QUIET when its window carries no respawn banner. */
export function isQuietRead(s: LatencySnapshot): boolean {
  return s.respawns === 0;
}

/** Distill a ledger read into a comparison-bearing snapshot. The clock is
 *  handed in (the engine stays pure); the route owns Date.now(). The hot
 *  list is the ledger's own top-8 BY REQUESTS — plus the HEAVIEST (by p95)
 *  appended when the slice missed it, because the R110 question is asked
 *  about the heavy route and the memory must remember what the verdict
 *  needs (the real record's heaviest — /api/vvu/analytics — serves too few
 *  requests to ride the request-sorted top-8). */
export function snapshotFromLedger(ledger: LatencyLedgerRead, atMs: number): LatencySnapshot {
  const hot = ledger.routes.slice(0, LATENCY_MEMORY_HOT_ROWS).map((r) => ({
    label: `${r.method} ${r.route}`,
    requests: r.requests,
    p50Ms: r.p50Ms,
    p95Ms: r.p95Ms,
  }));
  if (ledger.heaviest) {
    const hLabel = `${ledger.heaviest.method} ${ledger.heaviest.route}`;
    if (!hot.some((h) => h.label === hLabel)) {
      hot.push({
        label: hLabel,
        requests: ledger.heaviest.requests,
        p50Ms: ledger.heaviest.p50Ms,
        p95Ms: ledger.heaviest.p95Ms,
      });
    }
  }
  return {
    atMs,
    windowLines: ledger.windowLines,
    totalRequests: ledger.totalRequests,
    routeCount: ledger.routeCount,
    parsed: ledger.parsed,
    contextLines: ledger.contextLines,
    respawns: ledger.respawns,
    p50Ms: ledger.p50Ms,
    p95Ms: ledger.p95Ms,
    maxMs: ledger.maxMs,
    compileSharePct: ledger.compileSharePct,
    nonOkTotal: ledger.nonOkTotal,
    hot,
    heaviestLabel: ledger.heaviest ? `${ledger.heaviest.method} ${ledger.heaviest.route}` : null,
    heaviestP95Ms: ledger.heaviest ? ledger.heaviest.p95Ms : null,
  };
}

/** Append with the same-window refusal and the bounded cap. */
export function appendSnapshot(
  store: Array<LatencySnapshot>,
  snap: LatencySnapshot,
): { store: Array<LatencySnapshot>; appended: boolean } {
  const base = Array.isArray(store) ? store.filter((s) => s && typeof s.atMs === "number") : [];
  const last = base.length > 0 ? base[base.length - 1]! : null;
  if (last && snap.atMs - last.atMs < LATENCY_MEMORY_MIN_GAP_MS) {
    return { store: base, appended: false };
  }
  const next = [...base, snap].slice(-LATENCY_MEMORY_CAP);
  return { store: next, appended: true };
}

/** One route's p95 across the snapshots where it appears in the hot list —
 *  absent frames are honest gaps (the route fell out of the hot list),
 *  skipped, never interpolated. Oldest → newest. */
export function routeTrend(store: Array<LatencySnapshot>, label: string): Array<LatencyTrendPoint> {
  const pts: Array<LatencyTrendPoint> = [];
  for (const s of store ?? []) {
    const hit = (s.hot ?? []).find((h) => h.label === label);
    if (hit) {
      pts.push({ atMs: s.atMs, p95Ms: hit.p95Ms, requests: hit.requests, quiet: isQuietRead(s) });
    }
  }
  return pts;
}

function pct(med: number | null): string {
  return med == null ? "—" : `${Math.round(med * 10) / 10}`;
}

function pctOf(quietMed: number, noisyMed: number): number {
  return noisyMed > 0 ? Math.round((quietMed / noisyMed) * 1000) / 1000 : 1;
}

/** THE LATENCY MEMORY — the store read as the R110 answer machine. */
export function latencyMemoryRead(store: Array<LatencySnapshot>): LatencyMemoryRead {
  const snaps = (Array.isArray(store) ? store : []).filter(
    (s) => s && typeof s.atMs === "number" && Array.isArray(s.hot),
  );

  if (snaps.length === 0) {
    return {
      snapshots: 0,
      spanMs: null,
      quietReads: 0,
      quiet: {
        quietStreak: 0,
        quietNeeded: MIN_QUIET_READS,
        newestRespawns: 0,
        liveQuiet: false,
      },
      quietAnswer: quietHourAnswer(
        [],
        { quietStreak: 0, quietNeeded: MIN_QUIET_READS, newestRespawns: 0, liveQuiet: false },
        null,
      ),
      churn: churnClock([]),
      tracked: [],
      trends: [],
      latestHeaviestLabel: null,
      estateP95Series: [],
      note: "the memory is empty — the first read starts it",
    };
  }

  const first = snaps[0]!;
  const last = snaps[snaps.length - 1]!;
  const spanMs = snaps.length > 1 ? last.atMs - first.atMs : null;
  const quietFlags = snaps.map(isQuietRead);
  const quietReads = quietFlags.filter(Boolean).length;

  // The estate's own quiet p95 median — the fallback baseline.
  const estateQuietP95s = snaps
    .filter((s) => isQuietRead(s) && s.p95Ms != null)
    .map((s) => s.p95Ms as number);
  const estateQuietMedP95 = houseLowerMedian(estateQuietP95s);

  // Tracked labels: the latest frame's hot list, plus its heaviest if the
  // hot slice missed it (the heaviest is by p95, the hot list by requests).
  const trackedLabels: string[] = [];
  for (const h of last.hot) trackedLabels.push(h.label);
  if (last.heaviestLabel && !trackedLabels.includes(last.heaviestLabel)) {
    trackedLabels.push(last.heaviestLabel);
  }

  const tracked: Array<LatencyVerdict> = trackedLabels.map((label) => {
    const quietP95s: number[] = [];
    const noisyP95s: number[] = [];
    for (const s of snaps) {
      const hit = (s.hot ?? []).find((h) => h.label === label);
      if (!hit) continue;
      if (isQuietRead(s)) quietP95s.push(hit.p95Ms);
      else noisyP95s.push(hit.p95Ms);
    }

    const base = {
      label,
      quietCount: quietP95s.length,
      noisyCount: noisyP95s.length,
      quietMedP95: houseLowerMedian(quietP95s),
      noisyMedP95: houseLowerMedian(noisyP95s),
      estateQuietMedP95,
      ratio: null as number | null,
    };

    if (quietP95s.length < MIN_QUIET_READS) {
      return {
        ...base,
        word: "TOO FEW" as const,
        reason: `quiet ${quietP95s.length} < ${MIN_QUIET_READS} — the quiet hour has not arrived`,
      };
    }

    const quietMed = houseLowerMedian(quietP95s) as number;

    if (noisyP95s.length >= MIN_NOISY_READS) {
      const noisyMed = houseLowerMedian(noisyP95s) as number;
      const ratio = pctOf(quietMed, noisyMed);
      if (ratio <= P95_DROP_RATIO) {
        return {
          ...base,
          ratio,
          word: "COMPILE-COLD" as const,
          reason: `quiet p95 ${pct(quietMed)} is ${Math.round(ratio * 100)}% of noisy p95 ${pct(noisyMed)} — the heaviness collapses when the compiles leave`,
        };
      }
      if (ratio >= P95_STICK_RATIO) {
        return {
          ...base,
          ratio,
          word: "STEADY-HEAVY" as const,
          reason: `quiet p95 ${pct(quietMed)} keeps ${Math.round(ratio * 100)}% of noisy p95 ${pct(noisyMed)} with no respawn in the quiet windows`,
        };
      }
      return {
        ...base,
        ratio,
        word: "MIXED" as const,
        reason: `quiet p95 ${pct(quietMed)} holds ${Math.round(ratio * 100)}% of noisy p95 ${pct(noisyMed)} — between the lines, honestly`,
      };
    }

    // Quiet reads speak, noisy history too thin: fall back to the estate's
    // own quiet scale.
    if (estateQuietMedP95 == null) {
      return {
        ...base,
        word: "TOO FEW" as const,
        reason: `noisy ${noisyP95s.length} < ${MIN_NOISY_READS} and no estate quiet baseline to fall back to`,
      };
    }
    if (quietMed >= P95_ESTATE_MULT * estateQuietMedP95) {
      return {
        ...base,
        word: "STEADY-HEAVY" as const,
        reason: `quiet p95 ${pct(quietMed)} ≥ ${P95_ESTATE_MULT}× the estate's own quiet p95 median ${pct(estateQuietMedP95)} — heavy with no respawn anywhere near, the strongest form (noisy windows too few: ${noisyP95s.length})`,
      };
    }
    return {
      ...base,
      word: "CALM" as const,
      reason: `quiet p95 ${pct(quietMed)} reads calm against the estate's own quiet p95 median ${pct(estateQuietMedP95)} (noisy windows too few to compare: ${noisyP95s.length})`,
    };
  });

  const estateP95Series = snaps.map((s, i) => ({
    atMs: s.atMs,
    p95Ms: s.p95Ms,
    quiet: quietFlags[i]!,
  }));

  // R118 — THE QUIET HOUR PROGRESS: the trailing streak. Walk backward
  // from the newest snapshot while the reads stay quiet; the first noisy
  // read ends the streak. Trailing means trailing — a quiet hour that was
  // interrupted counts only what survives at the record's present end.
  let quietStreak = 0;
  for (let i = snaps.length - 1; i >= 0; i--) {
    if (quietFlags[i]) quietStreak += 1;
    else break;
  }
  const quiet: QuietProgress = {
    quietStreak,
    quietNeeded: MIN_QUIET_READS,
    newestRespawns: last.respawns,
    liveQuiet: quietStreak > 0,
  };

  // THE READ.
  const parts: string[] = [];
  if (snaps.length === 1) {
    parts.push("1 snapshot (a span needs two)");
  } else {
    // R117 fix: the trailing number used to be the literal `0` — the note
    // read "respawns 0" on every record, even when the newest window
    // carried respawns (which is exactly why it was not quiet). It is the
    // LATEST snapshot's own respawn count now: quiet is defined by the
    // window, so the disclosure names the newest window's storms.
    parts.push(
      `${snaps.length} snapshots across ${(spanMs! / 60_000).toFixed(1)} min (${quietReads} quiet — the newest window carried ${last.respawns} respawn${last.respawns === 1 ? "" : "s"})`,
    );
  }
  if (quietReads === 0) {
    parts.push(
      "no quiet read yet — every window carries a respawn; the R110 question (compile-cold or steady-heavy) stays open",
    );
  }
  // R118 — the countdown line: the streak vs the need, in both directions.
  if (quietStreak >= MIN_QUIET_READS) {
    parts.push(
      `the quiet hour is here — ${quietStreak} trailing quiet read(s), the verdicts speak (a noisy read resets the streak)`,
    );
  } else if (quietStreak > 0) {
    parts.push(
      `the quiet hour: streak ${quietStreak}/${MIN_QUIET_READS}, live at the record's newest end — ${MIN_QUIET_READS - quietStreak} more quiet read(s) and a verdict speaks (any noisy read resets it)`,
    );
  } else {
    parts.push(
      `the quiet hour: streak 0/${MIN_QUIET_READS} — the newest window carried ${last.respawns} respawn(s), the streak waits for a window with none`,
    );
  }
  // R124 — the ANSWERED clause rides THE READ when the hour arrives; the
  // churn clock speaks while it waits.
  const quietAnswer = quietHourAnswer(tracked, quiet, last.heaviestLabel);
  const churn = churnClock(snaps);
  if (quietAnswer.answered) parts.push(quietAnswer.line);
  else parts.push(churn.line);
  if (tracked.length > 0) {
    const vLine = tracked
      .map((v) => `${v.label}: ${v.word} (quiet ${v.quietCount} · noisy ${v.noisyCount})`)
      .join(" · ");
    parts.push(`verdicts — ${vLine}`);
  }
  const trends: Array<LatencyTrend> = trackedLabels.map((label) => ({
    label,
    points: routeTrend(snaps, label).slice(-LATENCY_MEMORY_TREND_POINTS),
  }));

  return {
    snapshots: snaps.length,
    spanMs,
    quietReads,
    quiet,
    quietAnswer,
    churn,
    tracked,
    trends,
    latestHeaviestLabel: last.heaviestLabel,
    estateP95Series,
    note: parts.join("; "),
  };
}
