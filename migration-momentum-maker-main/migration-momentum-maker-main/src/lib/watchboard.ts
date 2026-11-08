// src/lib/watchboard.ts — R125 · THE WATCHBOARD.
//
// Every round's handoff has carried a list of STANDING WATCHES — the open
// tensions the next round must read before it trusts anything: the verdict
// riding the inclusive edge, the walk's remaining holds, the newest era's
// whisker carve, the deep band's untested word, the quiet hour's countdown,
// the churn clock's ETA, the leadership line's closest approach. Until now
// those watches lived in prose (the worklog's risk sections) and the
// operator read them panel by panel. This engine compiles them into ONE
// lane: each watch a row, each row a live status word, a one-line detail,
// and the watch's contract in its own tooltip.
//
// THE HONESTY RULES:
//   - The board derives NOTHING. It reads the engines' own outputs (the
//     cause read, the eras read, the latency-memory read) — one
//     calibration, many readers, the house convention. Every number on
//     the board is the same number its home panel shows.
//   - A read that failed to arrive renders as its own row word (NO FEED —
//     the refusal is the status), never a guessed state.
//   - The board forecasts nothing: every row is the record's PRESENT
//     arithmetic (the walk's and ascent's simulated steps are labelled as
//     the simulations they are).
//   - The composer stays pure — the route owns every read, the clock, and
//     the journal parse (one parse, many readers).

import type { DeathCauseRead } from "./death-causes";
import { CAUSE_SHARE_CALL, SCARCITY_DEEP_LINE_MB } from "./death-causes";
import type { StormErasRead } from "./eras";
import type { KillPaceRead } from "./kill-pace";
import { PACE_DRIFT_BAND, PACE_QUICKEN_RATIO, PACE_STREAK_SUB_VERDICT } from "./kill-pace";
import type { LatencyMemoryRead } from "./latency-memory";

export type WatchTone = "neutral" | "sage" | "cyan" | "rose" | "amber";

export interface WatchRow {
  /** Stable row id (the panel's test hooks and the worklog's names). */
  id: string;
  name: string;
  /** The live status word — the row's headline, in the record's own voice. */
  word: string;
  tone: WatchTone;
  /** The one-line live detail (the row's second line, numbers verbatim). */
  detail: string;
  /** The watch's contract + the live arithmetic — the tooltip carries it. */
  title: string;
}

export interface WatchboardRead {
  rows: WatchRow[];
  /** The engine's own one-liner — the board's caption, verbatim. */
  note: string;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function pct1(x: number): string {
  return `${round1(x * 100)}%`;
}

/** THE WATCHBOARD — the standing watches, compiled. Every input read is
 *  optional: a read that did not arrive renders NO FEED as its own status
 *  (the absence is the row's word, never a guessed state). */
export function watchboard(input: {
  cause: DeathCauseRead | null;
  eras: StormErasRead | null;
  memory: LatencyMemoryRead | null;
  pace: KillPaceRead | null;
}): WatchboardRead {
  const rows: WatchRow[] = [];

  // ── 1 · THE EDGE RIDE — is a non-port cause sitting EXACTLY on the
  // inclusive call? (the R124 risk the walk's HOLDS 1 made live)
  if (input.cause) {
    const c = input.cause;
    const riding = c.causes.filter(
      (x) => x.reason !== "port" && c.window > 0 && x.recentN / c.window === CAUSE_SHARE_CALL,
    );
    const ridingN = riding.reduce((a, x) => a + x.recentN, 0);
    const onEdge = riding.length > 0;
    rows.push({
      id: "edge-ride",
      name: "THE EDGE RIDE",
      word: onEdge ? "RIDING THE EDGE" : "OFF THE LINE",
      tone: onEdge ? "amber" : "neutral",
      detail: onEdge
        ? `${riding.map((x) => x.reason).join(" + ")} ${ridingN}/${c.window} = ${pct1(CAUSE_SHARE_CALL)} exactly — the word ${c.verdict} holds at the inclusive edge`
        : `the window's non-port share ${pct1(c.causes.filter((x) => x.reason !== "port").reduce((a, x) => a + x.recentN, 0) / Math.max(c.window, 1))} — the word ${c.verdict} stands clear of the ${pct1(CAUSE_SHARE_CALL)} call`,
      title: onEdge
        ? `THE INCLUSIVE EDGE: at or past the ${pct1(CAUSE_SHARE_CALL)} call is a TURN, not a visit — and this window sits EXACTLY on the line (${riding.map((x) => `${x.reason} ${x.recentN}/${c.window}`).join(", ")}). One port death out of place disarms the word without any new ac landing; watch the populations, not just the word (R124's risk #2, standing).`
        : `THE INCLUSIVE EDGE: at or past the ${pct1(CAUSE_SHARE_CALL)} call is a TURN, not a visit. The current window does not ride the line — the share stands ${pct1(c.causes.filter((x) => x.reason !== "port").reduce((a, x) => a + x.recentN, 0) / Math.max(c.window, 1))}, clear of the call.`,
    });
  } else {
    rows.push(
      noFeed(
        "edge-ride",
        "THE EDGE RIDE",
        "the death-cause read did not arrive — the edge watch has no window to read",
      ),
    );
  }

  // ── 2 · THE WALK'S EDGE — how many port deaths until the word disarms
  // (the null walk's hold, the disarm clock's own arithmetic)
  if (input.cause) {
    const s = input.cause.sensitivity;
    const near = s.holdsK !== null && s.holdsK <= 3;
    rows.push({
      id: "walk-edge",
      name: "THE WALK'S EDGE",
      word: s.holdsK === null ? `HOLDS PAST THE ${s.steps.length - 1} BOUND` : `HOLDS ${s.holdsK}`,
      tone: s.holdsK === null ? "sage" : near ? "amber" : "neutral",
      detail:
        s.holdsK === null
          ? `under the all-port null the word ${input.cause.verdict} survives the walk's whole bound`
          : `${s.holdsK} more port death${s.holdsK === 1 ? "" : "s"} and the word reads ${s.nextVerdict} — a forecast of the instrument, never the record`,
      title: `THE NULL WALK: every future death port, the window recomputed at each step. ${s.note}`,
    });
  } else {
    rows.push(
      noFeed(
        "walk-edge",
        "THE WALK'S EDGE",
        "the death-cause read did not arrive — the walk watch has no holds to count",
      ),
    );
  }

  // ── 3 · THE ASCENT — how many challenger strikes until the floor LEADS
  // (the strict 50% line, the leadership lens's own grammar)
  if (input.cause) {
    const a = input.cause.ascent;
    rows.push({
      id: "ascent",
      name: "THE ASCENT",
      word: a.leadsK !== null ? `LEADS AT +${a.leadsK}` : "NO LEAD IN BOUND",
      tone: a.leadsK !== null ? "amber" : "sage",
      detail:
        a.leadsK !== null
          ? `${a.leadsK} ${a.challenger} strike${a.leadsK === 1 ? "" : "s"} would put the floor past the strict 50% line (${pct1(a.leadsShare!)} of the window)`
          : `the challenger's arithmetic cannot lead the window inside the ascent's bound`,
      title: `THE CHALLENGER'S MIRROR: every future death the floor's, the window's share rising one strike at a time. ${a.note}`,
    });
  } else {
    rows.push(
      noFeed(
        "ascent",
        "THE ASCENT",
        "the death-cause read did not arrive — the ascent watch has no challenger to simulate",
      ),
    );
  }

  // ── 4 · THE COMPRESS — the inside-streak's countdown to the sub-verdict
  // (the pace panel's own chip as a standing row — R125's hottest watch)
  if (input.pace) {
    const p = input.pace;
    const streak = p.insideStreak;
    if (streak === null) {
      rows.push({
        id: "compress",
        name: "THE COMPRESS",
        word: "NO STREAK",
        tone: "neutral",
        detail: "the heartbeat is unreadable — the inside/outside arithmetic has no line to ride",
        title: `THE COMPRESS (R126): the trailing run of honest gaps strictly INSIDE the heartbeat — the streak grammar riding beside the median grammar. ${PACE_STREAK_SUB_VERDICT} consecutives under a STEADY verdict and the sub-verdict COMPRESSING UNDERNEATH speaks (the engine's own call, the pace panel's own chip). The streak counts GAPS, never wall-time; a gap outside the heartbeat breaks the trailing run.`,
      });
    } else if (p.subVerdict) {
      rows.push({
        id: "compress",
        name: "THE COMPRESS",
        word: "COMPRESSING",
        tone: "rose",
        detail:
          p.subVerdictReason ??
          "the streak reached the call under a steady verdict — the sub-verdict speaks",
        title: `THE COMPRESS (R126): the trailing run of honest gaps strictly INSIDE the heartbeat — the streak grammar riding beside the median grammar. The sub-verdict is LIVE: ${PACE_STREAK_SUB_VERDICT} consecutives under the STEADY verdict — COMPRESSING UNDERNEATH, the engine's own call.`,
      });
    } else {
      const steady = p.verdict === "STEADY";
      const hot = steady && streak >= 3;
      const need = PACE_STREAK_SUB_VERDICT - streak;
      const medianClause =
        p.windowMedianMin !== null && p.heartbeatMin !== null
          ? ` — the window median ${round1(p.windowMedianMin)}′ rides ${p.ratio !== null ? pct1(p.ratio) : "—"} of the heartbeat ${round1(p.heartbeatMin)}′`
          : "";
      rows.push({
        id: "compress",
        name: "THE COMPRESS",
        word: `${streak} INSIDE`,
        tone: hot ? "amber" : "neutral",
        detail: steady
          ? `${need} more inside-heartbeat gap${need === 1 ? "" : "s"} and the sub-verdict COMPRESSING UNDERNEATH speaks${medianClause}`
          : `the verdict rides ${p.verdict} — the compress tension is a STEADY tension; the streak (${streak} trailing inside) compounds only under a steady record`,
        title: `THE COMPRESS (R126): the trailing run of honest gaps strictly INSIDE the heartbeat — the streak grammar riding beside the median grammar. ${PACE_STREAK_SUB_VERDICT} consecutives under a STEADY verdict and the sub-verdict COMPRESSING UNDERNEATH speaks (the engine's own call, the pace panel's own chip). Amber at 3+: the R125 handoff's heat rule. The streak counts GAPS, never wall-time; a gap outside the heartbeat breaks the trailing run.`,
      });
    }
  } else {
    rows.push(
      noFeed(
        "compress",
        "THE COMPRESS",
        "the pace read did not arrive — the compress watch has no streak to count",
      ),
    );
  }

  // ── 5 · THE WINDOW'S DRIFT — the window median's own motion (the
  // windows compared to EACH OTHER — R126's falling-heartbeat risk said)
  if (input.pace) {
    const p = input.pace;
    if (
      p.windowDrift === null ||
      p.windowDriftPct === null ||
      p.priorWindowMedianMin === null ||
      p.windowMedianMin === null
    ) {
      rows.push({
        id: "window-drift",
        name: "THE WINDOW'S DRIFT",
        word: "NO DRIFT",
        tone: "neutral",
        detail: "the prior window\u2019s median is unreadable — a thin record refuses the drift",
        title: `THE WINDOW\u2019S DRIFT (R127): the current window median against the PRIOR window\u2019s — the motion SAID, not implied. The verdict compares the window to the line (the long median); the drift compares the windows to EACH OTHER (the short motion). A falling window drags every line that follows it: the lull line (the heartbeat \u00d7 1.25) moves with the heartbeat, and a moving line re-carves the eras — the numbering\u2019s whiplash (R126\u2019s risk #1) is this row\u2019s shadow. The \u00b1${PACE_DRIFT_BAND * 100}% band reads STEADY (exclusive at exactly \u00b1${PACE_DRIFT_BAND * 100}%).`,
      });
    } else {
      const falling = p.windowDrift === "FALLING";
      const rising = p.windowDrift === "RISING";
      const pctAbs = Math.round(Math.abs(p.windowDriftPct) * 100);
      rows.push({
        id: "window-drift",
        name: "THE WINDOW'S DRIFT",
        word: falling ? `FALLING ${pctAbs}%` : rising ? `RISING ${pctAbs}%` : `STEADY ${pctAbs}%`,
        tone: falling ? "amber" : rising ? "cyan" : "neutral",
        detail: falling
          ? `the window median ${round1(p.windowMedianMin)}\u2032 vs the prior window\u2019s ${round1(p.priorWindowMedianMin)}\u2032 — falling ${pctAbs}% across the back-to-back windows; a moving line re-carves the eras`
          : rising
            ? `the window median ${round1(p.windowMedianMin)}\u2032 vs the prior window\u2019s ${round1(p.priorWindowMedianMin)}\u2032 — rising ${pctAbs}%; the storm spreading out`
            : `the window median ${round1(p.windowMedianMin)}\u2032 vs the prior window\u2019s ${round1(p.priorWindowMedianMin)}\u2032 — holds inside the \u00b1${PACE_DRIFT_BAND * 100}% band`,
        title: `THE WINDOW\u2019S DRIFT (R127): the current window median against the PRIOR window\u2019s — the motion SAID, not implied. The verdict compares the window to the line (the long median); the drift compares the windows to EACH OTHER (the short motion). A falling window drags every line that follows it: the lull line (the heartbeat \u00d7 1.25) moves with the heartbeat, and a moving line re-carves the eras — the numbering\u2019s whiplash (R126\u2019s risk #1) is this row\u2019s shadow. The \u00b1${PACE_DRIFT_BAND * 100}% band reads STEADY (exclusive at exactly \u00b1${PACE_DRIFT_BAND * 100}%).`,
      });
    }
  } else {
    rows.push(
      noFeed(
        "window-drift",
        "THE WINDOW'S DRIFT",
        "the pace read did not arrive — the drift has no windows to compare",
      ),
    );
  }

  // ── 6 · THE TENURE DIAL — the live tree's age against the record's own
  // window median (the pace panel's CLOCK chip as a standing row)
  if (input.pace) {
    const p = input.pace;
    if (p.sinceLastMin === null || p.clockRatio === null || p.windowMedianMin === null) {
      rows.push({
        id: "tenure-dial",
        name: "THE TENURE DIAL",
        word: "NO CLOCK",
        tone: "neutral",
        detail:
          "the dial refuses — the newest death\u2019s stamp or the window median is unreadable (skew refuses the dial)",
        title: `THE TENURE DIAL (R126): the live tree\u2019s age — minutes since the newest witnessed death — against the window\u2019s own median gap (the pace panel\u2019s CLOCK chip, the same ratio). PAST/LATE/RESTING are PRESENT arithmetic, never a promise: a tree past its median has simply stood longer than the window\u2019s typical gap — the dial reads the record, it does not schedule the storm.`,
      });
    } else {
      const due = p.clockRatio >= 1;
      const late = !due && p.clockRatio >= PACE_QUICKEN_RATIO;
      rows.push({
        id: "tenure-dial",
        name: "THE TENURE DIAL",
        word: due
          ? `PAST ${round1(p.sinceLastMin)}′`
          : late
            ? `LATE ${round1(p.sinceLastMin)}′`
            : `RESTING ${round1(p.sinceLastMin)}′`,
        tone: due ? "amber" : late ? "cyan" : "neutral",
        detail: due
          ? `the newest death is ${round1(p.sinceLastMin)}′ old — ${pct1(p.clockRatio)} of the window median ${round1(p.windowMedianMin)}′; the tree stands past the record\u2019s own rhythm`
          : late
            ? `the newest death is ${round1(p.sinceLastMin)}′ old — ${pct1(p.clockRatio)} of the window median ${round1(p.windowMedianMin)}′, past the ${pct1(PACE_QUICKEN_RATIO)} quicken line`
            : `the newest death is ${round1(p.sinceLastMin)}′ old — ${pct1(p.clockRatio)} of the window median ${round1(p.windowMedianMin)}′; the tree rests inside its own rhythm`,
        title: `THE TENURE DIAL (R126): the live tree\u2019s age — minutes since the newest witnessed death — against the window\u2019s own median gap (the pace panel\u2019s CLOCK chip, the same ratio). PAST/LATE/RESTING are PRESENT arithmetic, never a promise: a tree past its median has simply stood longer than the window\u2019s typical gap — the dial reads the record, it does not schedule the storm.`,
      });
    }
  } else {
    rows.push(
      noFeed(
        "tenure-dial",
        "THE TENURE DIAL",
        "the pace read did not arrive — the dial has no newest death to read",
      ),
    );
  }

  // ── 7 · THE WHISKER — the newest era's carve margin (the tender
  // numbering's own tell, three rounds running)
  if (input.eras) {
    const e = input.eras;
    const cur = e.eras.find((x) => x.index === e.currentEraIndex) ?? null;
    const carved = cur && cur.openedByGapMin !== null && e.lullLineMin !== null;
    const marginMin = carved ? cur!.openedByGapMin! - e.lullLineMin! : null;
    const marginRatio =
      marginMin !== null && e.lullLineMin! > 0 ? marginMin / e.lullLineMin! : null;
    const tender = marginRatio !== null && marginRatio < 0.05;
    rows.push({
      id: "whisker",
      name: "THE WHISKER",
      word:
        marginRatio === null
          ? cur
            ? "NO CARVE YET"
            : "NO ERAS YET"
          : tender
            ? `TENDER ${round1(marginRatio! * 100)}%`
            : `SETTLED ${round1(marginRatio! * 100)}%`,
      tone: marginRatio === null ? "neutral" : tender ? "amber" : "sage",
      detail:
        marginMin === null
          ? `the current era #${cur?.index ?? "—"} opened without a lull carve — the margin question waits`
          : `era #${cur!.index} opened ${round1(marginMin)}′ past the ${round1(e.lullLineMin!)}′ line — ${round1(marginRatio! * 100)}% ${tender ? "<" : "≥"} the 5% whisker line`,
      title: `THE CARVE'S MARGIN: an era carved by a lull barely past the line can un-carve on the next re-derivation (the numbering's own tenderness — four states in four rounds, R122→R124). A margin under 5% of the line reads TENDER; the WHISKER CARVE chip on the era card is the standing tell. Read THIS board before trusting any era number.`,
    });
  } else {
    rows.push(
      noFeed(
        "whisker",
        "THE WHISKER",
        "the eras read did not arrive — the carve-margin watch has no line to measure",
      ),
    );
  }

  // ── 8 · THE DEEP BAND — has a NON-ac death landed below the line? (the
  // band's word faces its first honest test the day one does)
  if (input.cause && input.cause.scarcity) {
    const sc = input.cause.scarcity;
    const fired = sc.deepPortN > 0 || sc.deepOtherN > 0;
    rows.push({
      id: "deep-band",
      name: "THE DEEP BAND",
      word: fired ? "BAND TESTED" : "WATCHING",
      tone: fired ? "rose" : "neutral",
      detail: fired
        ? `deep ${sc.deepN} · ${sc.deepAcN} ac — the band HAS taken ${sc.deepPortN + sc.deepOtherN} non-ac death${sc.deepPortN + sc.deepOtherN === 1 ? "" : "s"} (${sc.deepPortN} port · ${sc.deepOtherN} other); the tendency\u2019s exceptions are in the population`
        : `deep ${sc.deepN} · ${sc.deepAcN} ac vs above ${sc.aboveN} · ${sc.aboveAcN} ac — a NON-ac death below ${SCARCITY_DEEP_LINE_MB} MB avail faces the band\u2019s word its first honest test`,
      title: `THE DEEP BAND (R121): deaths ranked by their dying window's own minAvail; at/below the ${SCARCITY_DEEP_LINE_MB} MB line the scarcity tendency condenses (${sc.verdict}: ${sc.verdictReason}). ${fired ? `The band HAS taken a non-ac death (${sc.deepPortN} port, ${sc.deepOtherN} other) — the tendency's exceptions are in the population.` : "Every death in the band so far was avail-critical — the band's word is untested against a non-ac arrival."} ${sc.note}`,
    });
  } else if (input.cause) {
    rows.push(
      noFeed(
        "deep-band",
        "THE DEEP BAND",
        "the witnessed feed did not arrive — the depths come from the witness alone, the ledger carries no memory",
      ),
    );
  } else {
    rows.push(
      noFeed(
        "deep-band",
        "THE DEEP BAND",
        "the death-cause read did not arrive — the band watch has no ladder to rank",
      ),
    );
  }

  // ── 9 · THE QUIET HOUR — the ANSWERED countdown (the lane's own word)
  if (input.memory) {
    const q = input.memory.quiet;
    const answered = input.memory.quietAnswer.answered;
    rows.push({
      id: "quiet-hour",
      name: "THE QUIET HOUR",
      word: answered ? "ANSWERED" : `WAITING ${q.quietStreak}/${q.quietNeeded}`,
      tone: answered ? "sage" : "neutral",
      detail: answered
        ? input.memory.quietAnswer.line
        : `the newest window carried ${q.newestRespawns} respawn${q.newestRespawns === 1 ? "" : "s"} — ${q.quietNeeded - q.quietStreak} more quiet read${q.quietNeeded - q.quietStreak === 1 ? "" : "s"} and a verdict speaks; any noisy read resets`,
      title: `THE ANSWERED COUNTDOWN (R123/R124): ${input.memory.quietAnswer.line} — a quiet hour is ${q.quietNeeded} consecutive quiet snapshots ending at the record's newest end; it counts snapshots, never wall-time.`,
    });
  } else {
    rows.push(
      noFeed(
        "quiet-hour",
        "THE QUIET HOUR",
        "the latency-memory read did not arrive — the countdown watch has no streak to count",
      ),
    );
  }

  // ── 10 · THE CHURN CLOCK — the honest ETA (an estimate that says its
  // condition out loud)
  if (input.memory) {
    const ch = input.memory.churn;
    rows.push({
      id: "churn-clock",
      name: "THE CHURN CLOCK",
      word:
        ch.etaMin !== null
          ? `ETA ~${Math.round(ch.etaMin)} MIN`
          : ch.exitsObserved === 0
            ? "NO EXITS SEEN"
            : "REFUSES",
      tone: ch.etaMin !== null ? "cyan" : "neutral",
      detail: ch.line,
      title: `THE CHURN CLOCK (R124): the memory has watched respawn banners EXIT — the median gap between observed exits × the banners still in the newest window = the ETA, an estimate conditioned on "if no new respawn enters" (a kill resets it; the ${input.memory ? "live heartbeat makes that likely" : "heartbeat makes that likely"}). Its value is the cadence arithmetic, not the promise.`,
    });
  } else {
    rows.push(
      noFeed(
        "churn-clock",
        "THE CHURN CLOCK",
        "the latency-memory read did not arrive — the clock has no observed exits to read",
      ),
    );
  }

  // ── 11 · THE LEADERSHIP — has the floor ever out-numbered the port?
  if (input.cause) {
    const l = input.cause.leadership;
    const reigning = l.reigningNow;
    rows.push({
      id: "leadership",
      name: "THE LEADERSHIP",
      word: reigning ? "THE FLOOR REIGNS" : l.reigns.length > 0 ? "HAS REIGNED" : "NEVER CEDED",
      tone: reigning ? "sage" : "neutral",
      detail:
        l.closest !== null
          ? `${l.eligibleDeaths} eligible windows · ${l.leadWindows} leadership windows — the closest the floor came is ${pct1(l.closest.share)} @ death #${l.closest.deathIndex} (needs ${l.needInFullWindow}/${input.cause.window})`
          : `${l.eligibleDeaths} eligible windows · ${l.leadWindows} leadership windows — the closest approach is unrecorded`,
      title: `THE STRICT 50% (R123): the drift's binarization — a window LEADS when its non-port OUT-NUMBERS the port (exactly half is a tie, not a lead). ${l.note}`,
    });
  } else {
    rows.push(
      noFeed(
        "leadership",
        "THE LEADERSHIP",
        "the death-cause read did not arrive — the leadership watch has no windows to binarize",
      ),
    );
  }

  const live = rows.filter((r) => r.tone === "amber" || r.tone === "rose").length;
  const note =
    `the standing watches, compiled — ${rows.length} rows read live from their home engines (one calibration, many readers); ` +
    `${live} row${live === 1 ? "" : "s"} riding an amber/rose tension right now; the board forecasts nothing — every row is the record's present arithmetic`;
  return { rows, note };
}

function noFeed(id: string, name: string, detail: string): WatchRow {
  return {
    id,
    name,
    word: "NO FEED",
    tone: "neutral",
    detail,
    title: `${name}: the read this watch rides did not arrive — the refusal IS the status, never a guessed state.`,
  };
}
