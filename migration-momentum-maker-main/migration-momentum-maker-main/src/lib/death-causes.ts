// R116 — THE DEATH-CAUSE LENS: who kills the port, and is that changing?
//
// The boot ledger (R111) counts deaths meticulously and even groups tenure
// at death BY cause (its killer lens — descriptive medians only). But the
// record's own recent history carried a finding the killer lens cannot
// speak: for 22 kills the journal wrote `port` as the cause of death, and
// then the box's own memory scarcity began taking its turns —
// `avail-critical` struck four times, twice back-to-back. R115's risk #1
// named the watch: "if the next death is also avail-critical, the
// cause-shift is an era-level finding, not a datapoint." This lens is that
// watch, instrumented.
//
//   THE CENSUS   — every settled death (deceased && served) grouped by the
//                  journal's own death reason. Stillborn boots (spawned
//                  ok:false, never confirmed serving) are excluded and
//                  NAMED — a boot that never served did not hold the port
//                  and cannot die "of" anything the lens measures. The
//                  living boot is censored and named. Unjournaled ends are
//                  excluded and named.
//
//   THE ORDER    — deaths keep their spawn order (the ledger's own walk
//                  order). The RUN decomposition compresses that order into
//                  consecutive same-cause runs — `rss×3 → port×3 → rss×1 →
//                  port×34 → …` — the record's cause history at a glance,
//                  with each cause's longest unbroken run carried per cause.
//
//   THE STRIDES  — for a cause with ≥ 2 strikes: the death-index gaps
//                  between successive strikes, over the house lower-median
//                  (eras.ts exports it — one calibration, many readers).
//                  Small strides mean the cause strikes in bunches; large
//                  strides mean it visits occasionally. The engine reports,
//                  it does not romanticize.
//
//   THE VERDICT  — the last CAUSE_RECENT_WINDOW deaths are the window the
//                  record is living in now. Three words + the refusal:
//                    · PORT MONOPOLY  — the window is all port
//                    · THE FLOOR TAKES TURN — some non-port cause holds ≥
//                      CAUSE_SHARE_CALL of the window (INCLUSIVE edge — a
//                      share exactly at the line is a turn, not a visit)
//                    · PORT RULES — non-port deaths present but below the
//                      call (visits, not turns)
//                    · TOO FEW — under CAUSE_MIN_DEATHS settled deaths; the
//                      lens refuses to call a shift on a thin record
//                  The window is honest about its own size: when the record
//                  has fewer deaths than the nominal window, the window IS
//                  the record (window = deaths), and the verdict still fires
//                  above the minimum — a small record is not a mute one.
//
//   THE DRIFT    — R118's risk #1, instrumented (R119): the non-port share
//                  traced DEATH BY DEATH — the trailing-window share that
//                  ends at every death i (window = min(CAUSE_RECENT_WINDOW,
//                  i)), each point carrying the word the verdict would have
//                  read there. The walk forecasts the instrument's future
//                  under the null; the drift lane shows the instrument's
//                  PAST as it actually happened — the two together are the
//                  full edge picture. The lane also carries the floor's era
//                  question (is the box's scarcity becoming the LEADING
//                  killer?) as its own line: the 50% leadership rule, past
//                  which non-port deaths outnumber port in the trailing
//                  window. The lane reports the peak (share + where), the
//                  deaths that have ridden a turn, and the latest crossing
//                  into turn territory — dated, not implied.
//
//   THE TWIN     — R119's risk #2, instrumented (R120): the record has TWO
//                  honest feeds and the lens's window reads only one of
//                  them. THE LEDGER counts every journaled settled death
//                  (the boot ledger's walk — this read's own census). THE
//                  WITNESS carries only the kills the guardian sampled
//                  with a memory witness window (the 20s-interval feed the
//                  rhythm instruments read). Same record, two populations:
//                  the twin applies the SAME window rules (the same 12,
//                  the same 25% call, the same words) to BOTH and names
//                  the agreement or the divergence — the cross-feed
//                  flapping chip made legible instead of mysterious. A
//                  thin witness window refuses the comparison and says so.
//                  The engine stays pure: the witnessed feed is HANDED IN
//                  (the route derives it from the same journal parse —
//                  one parse, many readers), never re-read.
//
// Pure: no I/O, no clock, no re-derivation of anything the ledger already
// says. The route hands in the boot ledger's boots; the lens reads them.

import { houseLowerMedian } from "./eras";
import type { BootTenure } from "./boot-ledger";

/** The recent window = the last N settled deaths — the record's present. */
export const CAUSE_RECENT_WINDOW = 12;
/** A non-port cause holding ≥ this share of the window (INCLUSIVE) is
 *  taking its turns, not visiting. Calibrated so the live record's
 *  avail-critical 3/12 = 0.25 exactly at the line reads as a turn. */
export const CAUSE_SHARE_CALL = 0.25;
/** Below this many settled deaths the verdict refuses (TOO FEW). */
export const CAUSE_MIN_DEATHS = 8;

export type DeathCauseVerdict = "PORT MONOPOLY" | "THE FLOOR TAKES TURN" | "PORT RULES" | "TOO FEW";

/** THE SENSITIVITY WALK's bound — the null hypothesis is walked this many
 *  simulated deaths forward, never further (bounded reads, honest refusals
 *  past the bound: `holds past the walk` is said out loud, not implied). */
export const CAUSE_WALK_MAX = 24;

export interface SensitivityStep {
  /** Simulated future deaths under the all-port null (0 = now). */
  k: number;
  verdict: DeathCauseVerdict;
}

export interface CauseExit {
  pid: number;
  cause: string;
  /** The 1-based FUTURE death count at which this window member leaves the
   *  window under the null walk (death #(deaths + k) for the first k where
   *  it is out). */
  exitsAtDeath: number;
}

/** One step of THE ASCENT — the trailing window under the challenger null
 *  (every future death the floor's): k simulated challenger strikes deep,
 *  the window's non-port share and the word it would read. */
export interface AscentStep {
  /** Simulated future challenger deaths (0 = now). */
  k: number;
  /** non-port / window under the ascent — the share the call line reads. */
  share: number;
  /** Past the leadership line (share > 0.5, STRICT — exactly half is a
   *  tie, not a lead; the leadership lens's own grammar). */
  leads: boolean;
  /** The word the verdict would read at this step. */
  verdict: DeathCauseVerdict;
}

/** THE ASCENT — R125's instrument, the walk's mirror on the challenger's
 *  side. The sensitivity walk simulates every future death PORT and asks
 *  how long today's word HOLDS; the ascent simulates every future death
 *  the FLOOR'S and asks how far the record is from the floor LEADING.
 *  Where the null walk's share only falls, the ascent's share only RISES
 *  (each simulated strike adds a non-port death; real members age out
 *  underneath, and an exiting member can only remove what it carried) —
 *  so a turn can never un-turn under the ascent, and the events to stop
 *  at are a word FLIP (a visit record's turn arriving) or the STRICT
 *  LEADERSHIP crossing (share > 0.5 — the leadership lens's own line,
 *  exactly half is a tie). Like the walk it forecasts the INSTRUMENT,
 *  never the record: no strike is predicted, only how far the window's
 *  own arithmetic stands from the leadership line. */
export interface CauseAscent {
  /** The simulated challenger — the window's leading non-port cause
   *  (tie → name asc); when the window is all-port, the record's NEWEST
   *  non-port cause (the one that struck last is the one that would
   *  plausibly strike first). null when the walk refuses. */
  challenger: string | null;
  /** Where the challenger came from — 'window' or 'record' (a window with
   *  no non-port death borrows the record's newest; said, never silent). */
  challengerFrom: "window" | "record" | null;
  /** First k where the WORD changes (a PORT RULES record's turn arriving).
   *  null when the word holds the whole bound — a turn record's word
   *  cannot un-turn under the ascent (the share only rises). */
  flipK: number | null;
  flipWord: DeathCauseVerdict | null;
  /** First k where the simulated window's non-port OUT-NUMBERS the port
   *  (share > 0.5 STRICT). null when the bound passes uncrossed — said,
   *  never implied. */
  leadsK: number | null;
  leadsShare: number | null;
  /** k = 0 .. the first event (flip or lead, whichever comes first), else
   *  the whole bound — a forecast past its own first event teaches
   *  nothing the event does not (the walk's own truncation grammar). */
  steps: AscentStep[];
  note: string;
}

/** One point of THE DRIFT — the trailing window's non-port share as of the
 *  i-th death (the window the verdict would have read there). */
export interface CauseDriftPoint {
  /** 1-based death number this point ends at. */
  deathIndex: number;
  /** The trailing window's actual size at this point —
   *  min(CAUSE_RECENT_WINDOW, deathIndex). */
  window: number;
  /** Non-port deaths inside the point's window. */
  nonPort: number;
  /** nonPort / window — the share the call line reads. */
  share: number;
  /** Past the leadership line (share > 0.5): non-port deaths OUTNUMBER port
   *  in the trailing window — the floor's era question answered "yes, for
   *  this window". */
  leads: boolean;
  /** The word the verdict would have read at this death (TOO FEW below
   *  CAUSE_MIN_DEATHS — the pre-verdict zone, drawn dimmed). */
  verdictAt: DeathCauseVerdict;
}

export interface CauseDrift {
  points: CauseDriftPoint[];
  /** The record's peak non-port share among the VERDICT-ELIGIBLE windows
   *  (verdictAt !== 'TOO FEW') and the death it stood at — a 1-death window
   *  at 100% is arithmetic trivia, not the era question's answer, so the
   *  pre-verdict zone does not speak here (its points still draw, dimmed).
   *  Null before the verdict's first breath. */
  peak: { share: number; deathIndex: number } | null;
  /** How many deaths' windows read THE FLOOR TAKES TURN. */
  turnDeaths: number;
  /** The 1-based death number of the LATEST entry into turn territory (a
   *  point that reads the turn right after one that does not); null when no
   *  point has ever ridden a turn. */
  lastCrossing: number | null;
  /** The engine's own one-liner — THE READ carries it verbatim. */
  note: string;
}

/** One side of THE TWIN WINDOWS — the same window rules applied to one
 *  feed's population. */
export interface CauseTwinWindow {
  label: "THE LEDGER" | "THE WITNESS";
  /** The feed's total settled deaths. */
  deaths: number;
  /** The trailing window's actual size — min(CAUSE_RECENT_WINDOW, deaths). */
  window: number;
  /** The window's own census (n desc, then name asc). */
  census: Array<{ reason: string; n: number }>;
  /** Non-port deaths inside the window. */
  nonPort: number;
  /** nonPort / window — each feed reads its own share of its own window. */
  share: number;
  /** The word this feed's window reads. */
  verdict: DeathCauseVerdict;
}

export interface CauseTwin {
  /** The ledger side — this read's own census (never null; it IS the
   *  read's verdict). */
  ledger: CauseTwinWindow;
  /** The witness side — null when no witnessed feed was handed in. */
  witness: CauseTwinWindow | null;
  /** The words agree? Null when either side reads TOO FEW — a thin window
   *  cannot be compared, only named. */
  agree: boolean | null;
  /** The engine's own one-liner — THE READ carries it verbatim. */
  note: string;
}

// ─── R121 · THE SCARCITY LADDER — the floor's depth gauge ──────────────────
//
// The twin windows and the drift read WHO kills and whether the shares are
// shifting; kill #29's avail-critical strike at 139.5 MB — the second-deepest
// scarcity on the witnessed record — posed the question neither can answer:
// HOW DEEP was the floor when the floor took its turns? The witness windows
// carry the answer: every witnessed death's own minAvail — the lowest host
// memory the guardian's 20s sampling saw before the kernel struck.
//
//   THE LADDER    — witnessed deaths ranked deepest-first by their window's
//                   minAvail. Deaths whose window carries no finite avail
//                   sample are excluded and NAMED (a depth cannot be read
//                   from what was never sampled).
//   THE DEEP BAND — minAvail ≤ SCARCITY_DEEP_LINE_MB (first calibration:
//                   the record's own data draws it — five of the record's
//                   six avail-critical strikes sit at ≤ 145.4 MB). The
//                   band's ac:port ratio against the rest of the record is
//                   the condensation the era question asks for.
//   THE WORDS     — THE DEEP BAND IS THE FLOOR'S TURN (more ac than port
//                   below the line) / THE DEEP BAND IS PORT COUNTRY (port
//                   leads or owns the band) / CONTESTED (even) / TOO FEW
//                   (the band holds fewer than SCARCITY_MIN_DEEP deaths, or
//                   nothing is judgeable).
//
// An avail-critical strike ABOVE the line is never hidden — the note names
// it: the band is a tendency the record drew, not a law the journal obeys.
// Pure: the witnessed feed is handed in (the route derives it from the SAME
// journal parse the ledger rides); the engine invents nothing.

/** The deep-scarcity line (MB of host avail). First calibration from the
 *  record itself: the witnessed record's six avail-critical strikes sit at
 *  129.8 / 134.3 / 134.7 / 139.5 / 145.4 / 650.5 — five under 146, one far
 *  above; 150 MB is the honest line between the band and the rest. */
export const SCARCITY_DEEP_LINE_MB = 150;

/** The minimum deaths inside the deep band before the ladder's word speaks. */
export const SCARCITY_MIN_DEEP = 5;

export type ScarcityVerdict =
  "THE DEEP BAND IS THE FLOOR'S TURN" | "THE DEEP BAND IS PORT COUNTRY" | "CONTESTED" | "TOO FEW";

/** One rung of the ladder — one witnessed death, judged. */
export interface ScarcityDeath {
  /** The journal's own stamp, verbatim (the witness feed's join key). */
  at: string;
  atMs: number | null;
  cause: string;
  /** The dying window's lowest host avail (MB) — the depth this rung reads. */
  minAvailMb: number;
  /** The dying window's peak process rss (MB), when sampled — the ceiling
   *  instrument's own field, carried for the hover. */
  maxRssMb: number | null;
  /** 1 = the deepest scarcity on the witnessed record. Ties read
   *  chronologically (the earlier strike ranks deeper). */
  rank: number;
}

export interface ScarcityLadder {
  /** Judged deaths, deepest first (rank 1..n). */
  ladder: ScarcityDeath[];
  judged: number;
  /** Witnessed rows without a finite avail reading — excluded and named. */
  unjudged: number;
  deepLineMb: number;
  /** Deaths at/below the line (the band, INCLUSIVE — the call line's own
   *  convention). */
  deepN: number;
  /** avail-critical strikes inside the band. */
  deepAcN: number;
  /** port kills inside the band. */
  deepPortN: number;
  /** Band deaths of any other cause (rss, …) — disclosed when non-zero. */
  deepOtherN: number;
  /** Deaths above the line. */
  aboveN: number;
  /** avail-critical strikes ABOVE the line — the tendency's exceptions,
   *  named, never hidden. */
  aboveAcN: number;
  /** The deepest (lowest) avail-critical strike, null with none. */
  deepestAcMb: number | null;
  /** The deepest port kill, null with none. */
  deepestPortMb: number | null;
  /** The ac share below the line vs above it — the condensation the era
   *  question reads. Null denominators stay null. */
  deepAcShare: number | null;
  aboveAcShare: number | null;
  verdict: ScarcityVerdict;
  verdictReason: string;
  /** The engine's own one-liner — THE READ carries it verbatim. */
  note: string;
}

export interface CauseSensitivity {
  /** The walk's hypothesis — the record's dominant killer. Every simulated
   *  future death is this cause; the walk asks how long today's verdict
   *  survives a return to business as usual. */
  nullCause: "port";
  /** Simulated deaths today's verdict holds for under the null (null = it
   *  holds past the walk's bound — said, not implied). */
  holdsK: number | null;
  /** The verdict the walk flips to after `holdsK` (null = no change inside
   *  the bound). */
  nextVerdict: DeathCauseVerdict | null;
  /** k = 0 .. min(holdsK ?? CAUSE_WALK_MAX, CAUSE_WALK_MAX) — the forecast
   *  strip (bounded). */
  steps: SensitivityStep[];
  /** 1-based death numbers of the window's edges (oldest exits first). */
  windowFromDeath: number;
  windowToDeath: number;
  /** The window members' exit schedule, walk order (oldest first). */
  exits: CauseExit[];
  /** The engine's own one-liner — THE READ carries it verbatim. */
  note: string;
}

export interface DeathCauseDeath {
  pid: number;
  reason: string;
  tenureMin: number;
  deathAt: string | null;
  /** 0-based position among settled deaths, in ledger walk order. */
  index: number;
}

export interface DeathCauseStat {
  reason: string;
  n: number;
  /** n / deaths — the all-time share. */
  share: number;
  firstIndex: number | null;
  lastIndex: number | null;
  firstAt: string | null;
  lastAt: string | null;
  medianTenureMin: number | null;
  minTenureMin: number | null;
  maxTenureMin: number | null;
  /** Strikes inside the recent window. */
  recentN: number;
  /** Longest unbroken run of this cause in the death order. */
  longestRun: number;
  /** Death-index gaps between successive strikes (null under 2 strikes). */
  strides: number[] | null;
  medianStride: number | null;
}

export interface DeathCauseRun {
  reason: string;
  length: number;
  fromIndex: number;
  toIndex: number;
}

export interface DeathCauseRead {
  deaths: number;
  stillbornExcluded: number;
  livingCensored: number;
  unjournaledExcluded: number;
  /** The effective window size — the nominal window, or all deaths when
   *  the record is smaller than the window. */
  window: number;
  causes: DeathCauseStat[];
  runs: DeathCauseRun[];
  /** The compressed run order — `rss×3 → port×3 → …` (verbatim in THE READ). */
  runNarrative: string;
  verdict: DeathCauseVerdict;
  verdictReason: string;
  /** The stripline's deaths, walk order, newest last. */
  deathsList: DeathCauseDeath[];
  /** R117 — THE SENSITIVITY WALK: today's verdict under the all-port null. */
  sensitivity: CauseSensitivity;
  /** R125 — THE ASCENT: the walk's mirror — every future death the FLOOR'S,
   *  the road to the strict leadership line (and to a visit record's turn). */
  ascent: CauseAscent;
  /** R119 — THE DRIFT: the non-port share, death by death (the walk's past). */
  drift: CauseDrift;
  /** R120 — THE TWIN WINDOWS: the same rules on the ledger and the witness
   *  feeds (null when no witnessed feed was handed in). */
  twin: CauseTwin | null;
  /** R121 — THE SCARCITY LADDER: the witnessed deaths ranked by their dying
   *  window's own minAvail (null when no witnessed feed was handed in — the
   *  ledger feed carries no memory, the depths come from the witness alone). */
  scarcity: ScarcityLadder | null;
  /** R123 — THE LEADERSHIP LENS: the drift's binarization — has the floor
   *  EVER out-numbered the port? Reigns, droughts, the closest approach.
   *  Always armed (the ledger feed is its own source). */
  leadership: LeadershipRead;
  note: string;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function pct(x: number): string {
  return `${round2(x * 100)}%`;
}

function buildVerdict(
  deaths: number,
  window: number,
  windowCensus: Map<string, number>,
): { verdict: DeathCauseVerdict; reason: string } {
  if (deaths < CAUSE_MIN_DEATHS) {
    return {
      verdict: "TOO FEW",
      reason: `${deaths} settled death(s) is under the ${CAUSE_MIN_DEATHS} the verdict needs — a thin record cannot call a cause shift`,
    };
  }
  const nonPort: Array<{ reason: string; n: number }> = [];
  let portN = 0;
  for (const [reason, n] of windowCensus) {
    if (reason === "port") portN += n;
    else nonPort.push({ reason, n });
  }
  nonPort.sort((a, b) => b.n - a.n || a.reason.localeCompare(b.reason));
  const taking = nonPort.filter((c) => c.n / window >= CAUSE_SHARE_CALL);
  if (taking.length > 0) {
    const parts = taking.map(
      (c) =>
        `${c.reason} ${c.n}/${window} (${pct(c.n / window)} — at or past the ${pct(CAUSE_SHARE_CALL)} call)`,
    );
    return {
      verdict: "THE FLOOR TAKES TURN",
      reason: `the last ${window} deaths: ${parts.join(" · ")} — the ${taking.map((c) => c.reason).join(" and ")} now takes its turns at killing the port`,
    };
  }
  if (nonPort.length === 0) {
    return {
      verdict: "PORT MONOPOLY",
      reason: `the last ${window} deaths are all port — the record's present belongs to the port's own kill, no other cause has struck inside the window`,
    };
  }
  return {
    verdict: "PORT RULES",
    reason: `the last ${window} deaths: port ${portN}, ${nonPort.map((c) => `${c.reason} ${c.n}`).join(", ")} — non-port deaths present but under the ${pct(CAUSE_SHARE_CALL)} call (${pct(nonPort.reduce((a, c) => a + c.n, 0) / window)} of the window): visits, not turns`,
  };
}

/** THE SENSITIVITY WALK — today's verdict under the all-port null. The
 *  record's dominant killer is `port`; the walk simulates k more port
 *  deaths (k = 0 .. CAUSE_WALK_MAX), recomputes the window verdict at each
 *  step, and reports (a) how long today's word holds, (b) what it becomes,
 *  and (c) when each current window member exits. This is a FORECAST OF
 *  THE INSTRUMENT, not of the record: it never predicts a death, it only
 *  names how much of the current verdict is the window's own edge. */
export function causeSensitivity(
  deaths: number,
  deathsList: DeathCauseDeath[],
  verdict: DeathCauseVerdict,
): CauseSensitivity {
  const total = deaths;
  const win = Math.min(CAUSE_RECENT_WINDOW, total);
  const nullCensus = (k: number): Map<string, number> => {
    const m = new Map<string, number>();
    // the simulated window: deaths #(total + k − win + 1) .. #(total + k)
    const fromIdx = total + k - win; // 0-based first member
    for (const d of deathsList) {
      if (d.index >= fromIdx) m.set(d.reason, (m.get(d.reason) ?? 0) + 1);
    }
    m.set("port", (m.get("port") ?? 0) + k);
    return m;
  };

  const steps: SensitivityStep[] = [];
  let holdsK: number | null = null;
  let nextVerdict: DeathCauseVerdict | null = null;
  const startWord = verdict;
  for (let k = 0; k <= CAUSE_WALK_MAX; k++) {
    const { verdict } = buildVerdict(total + k, win, nullCensus(k));
    steps.push({ k, verdict });
    if (holdsK === null && k > 0 && verdict !== startWord) {
      holdsK = k;
      nextVerdict = verdict;
    }
  }
  if (holdsK === null) {
    // holdsK stays null — today's word survives the whole bound.
    steps.length = Math.min(steps.length, CAUSE_WALK_MAX + 1);
  } else {
    // The strip stops at the change: a forecast past its own flip teaches
    // nothing the flip does not.
    steps.length = holdsK + 1;
  }

  // The exit schedule: member at 0-based i is out of the window at the
  // first k where total + k − win > i, i.e. k = win − (total − i) … solved:
  // the future death count #(total + k) when it leaves = i + win + 1.
  const exits: CauseExit[] = deathsList
    .filter((d) => d.index >= total - win)
    .map((d) => ({
      pid: d.pid,
      cause: d.reason,
      exitsAtDeath: d.index + win + 1,
    }));

  const windowFromDeath = total - win + 1;
  const windowToDeath = total;
  const acExits = exits.filter((e) => e.cause !== "port");

  let note: string;
  if (startWord === "TOO FEW") {
    note = `the sensitivity walk refuses — the verdict itself is TOO FEW, there is nothing to hold`;
  } else if (holdsK === null) {
    note = `the null walk (every future death port): the verdict holds ${startWord} past the ${CAUSE_WALK_MAX}-death bound`;
  } else {
    note =
      `the null walk (every future death port): the verdict holds ${startWord} for ${holdsK} more death${holdsK === 1 ? "" : "s"}, ` +
      `then reads ${nextVerdict}` +
      (acExits.length
        ? ` — the non-port strikes exit the window at deaths ${acExits.map((e) => `#${e.exitsAtDeath}`).join(", ")}`
        : "") +
      `; the walk forecasts the instrument, never the record`;
  }

  return {
    nullCause: "port",
    holdsK,
    nextVerdict,
    steps,
    windowFromDeath,
    windowToDeath,
    exits,
    note,
  };
}

/** THE ASCENT — the walk's mirror on the challenger's side (R125). Every
 *  future death is the FLOOR'S (the window's leading non-port cause, or
 *  the record's newest when the window carries none); at each k the
 *  trailing window is the same sliding arithmetic the null walk rides
 *  (real members age out from the old end, k simulated strikes enter at
 *  the new), and the step records the share, the strict leadership flag,
 *  and the word. The strip stops at the FIRST event — a word flip or the
 *  leadership crossing; a record that reaches the bound with neither says
 *  so out loud. Refusals honest: a TOO FEW record has no word to deepen,
 *  a record with no non-port death anywhere has no challenger to simulate. */
export function causeAscent(
  deaths: number,
  deathsList: DeathCauseDeath[],
  verdict: DeathCauseVerdict,
): CauseAscent {
  const refuse = (note: string): CauseAscent => ({
    challenger: null,
    challengerFrom: null,
    flipK: null,
    flipWord: null,
    leadsK: null,
    leadsShare: null,
    steps: [],
    note,
  });

  if (verdict === "TOO FEW") {
    return refuse(
      `the ascent walk refuses — the verdict itself is TOO FEW, there is no word to deepen and no line to cross`,
    );
  }

  const total = deaths;
  const win = Math.min(CAUSE_RECENT_WINDOW, total);

  // The challenger: the window's leading non-port cause (n desc, name asc
  // — the census's own sort), else the record's NEWEST non-port cause.
  const windowDeaths = deathsList.slice(total - win);
  const windowCensus = new Map<string, number>();
  for (const d of windowDeaths) {
    if (d.reason !== "port") windowCensus.set(d.reason, (windowCensus.get(d.reason) ?? 0) + 1);
  }
  let challenger: string | null = null;
  let challengerFrom: "window" | "record" | null = null;
  const windowNonPort = [...windowCensus.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  if (windowNonPort.length > 0) {
    challenger = windowNonPort[0]![0];
    challengerFrom = "window";
  } else {
    const newestNonPort = [...deathsList].reverse().find((d) => d.reason !== "port");
    if (!newestNonPort) {
      return refuse(
        `the ascent walk refuses — no non-port cause has ever struck, the floor's challenger does not exist yet`,
      );
    }
    challenger = newestNonPort.reason;
    challengerFrom = "record";
  }

  // The ascent census at k: real members #(total + k − win + 1) .. #(total)
  // (0-based from total + k − win) with their own reasons, plus k simulated
  // challenger strikes. The share only rises: +1 challenger per step, and
  // the member that ages out carried at most one death's worth.
  const ascentCensus = (k: number): { census: Map<string, number>; nonPort: number } => {
    const m = new Map<string, number>();
    const fromIdx = total + k - win;
    let nonPort = 0;
    for (const d of deathsList) {
      if (d.index >= fromIdx) {
        m.set(d.reason, (m.get(d.reason) ?? 0) + 1);
        if (d.reason !== "port") nonPort += 1;
      }
    }
    m.set(challenger!, (m.get(challenger!) ?? 0) + k);
    nonPort += k;
    return { census: m, nonPort };
  };

  const steps: AscentStep[] = [];
  let flipK: number | null = null;
  let flipWord: DeathCauseVerdict | null = null;
  let leadsK: number | null = null;
  let leadsShare: number | null = null;
  let firstEventK: number | null = null;
  const startWord = verdict;
  for (let k = 0; k <= CAUSE_WALK_MAX; k++) {
    const { census, nonPort } = ascentCensus(k);
    const share = nonPort / win;
    const { verdict: verdictAt } = buildVerdict(total + k, win, census);
    steps.push({ k, share, leads: share > 0.5, verdict: verdictAt });
    if (flipK === null && k > 0 && verdictAt !== startWord) {
      flipK = k;
      flipWord = verdictAt;
    }
    if (leadsK === null && share > 0.5) {
      leadsK = k;
      leadsShare = share;
    }
    // The EVENTS are computed over the FULL bound (a lead at +7 never
    // erases a flip at +10 — both are said); only the STRIP truncates at
    // the first event (the walk's own truncation grammar: a forecast past
    // its first crossing teaches nothing the crossing does not).
    if (flipK !== null || leadsK !== null) firstEventK ??= k;
  }
  if (firstEventK !== null) steps.length = firstEventK + 1;

  const challengerLabel = challenger.replace(/-/g, " ").toUpperCase();
  let note: string;
  const fromClause =
    challengerFrom === "record"
      ? ` (the window is all port — the record's newest non-port cause stands in)`
      : "";
  if (leadsK !== null && flipK !== null) {
    const firstEvent = Math.min(leadsK, flipK);
    note =
      `the ascent walk (every future death ${challengerLabel}${fromClause}): the word flips to ${flipWord} at +${flipK} ` +
      `and the floor LEADS the window at +${leadsK} (${pct(leadsShare!)} — past the strict 50% line, ` +
      `exactly half is a tie); the strip stops at the first event (+${firstEvent})`;
  } else if (leadsK !== null) {
    note =
      `the ascent walk (every future death ${challengerLabel}${fromClause}): the word holds ${startWord} ` +
      `the whole bound — but the floor LEADS the window at +${leadsK} strike${leadsK === 1 ? "" : "s"} ` +
      `(${pct(leadsShare!)} of it, past the strict 50% line — the leadership lens's own line, ` +
      `exactly half is a tie); the ascent forecasts the instrument, never the record`;
  } else if (flipK !== null) {
    note =
      `the ascent walk (every future death ${challengerLabel}${fromClause}): the word flips to ${flipWord} ` +
      `at +${flipK} strike${flipK === 1 ? "" : "s"} — the turn arrives; the leadership line stays ` +
      `uncrossed inside the ${CAUSE_WALK_MAX}-strike bound`;
  } else {
    note =
      `the ascent walk (every future death ${challengerLabel}${fromClause}): the word holds ${startWord} ` +
      `and the leadership line stays uncrossed past the ${CAUSE_WALK_MAX}-strike bound — the challenger's ` +
      `arithmetic cannot lead inside the bound, said out loud`;
  }
  if (flipK !== null && leadsK !== null && leadsK < flipK) {
    note += ` — the floor LEADS before the word even flips: the leadership lens is the stricter read here`;
  }

  return { challenger, challengerFrom, flipK, flipWord, leadsK, leadsShare, steps, note };
}

/** THE DRIFT — the non-port share traced death by death (R118's risk #1,
 *  instrumented R119). For every death i the trailing window ending at i
 *  (min(CAUSE_RECENT_WINDOW, i)) gets its own census, share, leadership
 *  flag, and the word the verdict would have read there. This is the walk's
 *  mirror: the walk simulates the FUTURE under the all-port null; the drift
 *  lane shows the PAST as it actually happened. */
export function causeDrift(deathsList: DeathCauseDeath[]): CauseDrift {
  const points: CauseDriftPoint[] = [];
  const total = deathsList.length;
  for (let i = 1; i <= total; i++) {
    const win = Math.min(CAUSE_RECENT_WINDOW, i);
    const winList = deathsList.slice(i - win, i);
    const census = new Map<string, number>();
    for (const d of winList) census.set(d.reason, (census.get(d.reason) ?? 0) + 1);
    let nonPort = 0;
    for (const [reason, n] of census) if (reason !== "port") nonPort += n;
    const share = win > 0 ? nonPort / win : 0;
    const { verdict: verdictAt } = buildVerdict(i, win, census);
    points.push({
      deathIndex: i,
      window: win,
      nonPort,
      share,
      leads: share > 0.5,
      verdictAt,
    });
  }

  let peak: CauseDrift["peak"] = null;
  let turnDeaths = 0;
  let lastCrossing: number | null = null;
  let prevWasTurn = false;
  for (const p of points) {
    if (p.verdictAt !== "TOO FEW" && (peak === null || p.share > peak.share)) {
      peak = { share: p.share, deathIndex: p.deathIndex };
    }
    const isTurn = p.verdictAt === "THE FLOOR TAKES TURN";
    if (isTurn) turnDeaths += 1;
    if (isTurn && !prevWasTurn) lastCrossing = p.deathIndex;
    prevWasTurn = isTurn;
  }

  let note: string;
  if (total === 0) {
    note = "the drift lane waits — no settled death has laid a point down";
  } else {
    const newest = points[points.length - 1]!;
    const peakPart = peak
      ? `peak ${pct(peak.share)} at death #${peak.deathIndex} (among verdict-eligible windows — a sub-${CAUSE_MIN_DEATHS}-death window's 100% is arithmetic trivia, not the era question's answer)`
      : `no verdict-eligible window yet (the record is under ${CAUSE_MIN_DEATHS} deaths — the pre-verdict zone is all the lane has)`;
    note =
      `the drift lane: the non-port share traced death by death — ${peakPart}, ` +
      `${turnDeaths} death${turnDeaths === 1 ? "" : "s"} ha${turnDeaths === 1 ? "s" : "ve"} ridden a turn` +
      (lastCrossing != null
        ? `, the latest crossing at death #${lastCrossing}`
        : ", no crossing yet") +
      `; the newest point reads ${pct(newest.share)} of its ${newest.window}-death window` +
      (newest.leads ? " — PAST THE 50% LEADERSHIP LINE: the floor out-numbers the port" : "") +
      "; the walk forecasts the instrument's future, the drift shows its past";
  }

  return { points, peak, turnDeaths, lastCrossing, note };
}

/** One side of THE TWIN WINDOWS — the window rules applied to one feed's
 *  census (the same buildVerdict the main verdict rides: one calibration,
 *  many windows). */
function twinWindow(
  label: CauseTwinWindow["label"],
  deaths: number,
  window: number,
  census: Map<string, number>,
): CauseTwinWindow {
  const { verdict } = buildVerdict(deaths, window, census);
  let nonPort = 0;
  for (const [reason, n] of census) if (reason !== "port") nonPort += n;
  return {
    label,
    deaths,
    window,
    census: [...census.entries()]
      .map(([reason, n]) => ({ reason, n }))
      .sort((a, b) => b.n - a.n || a.reason.localeCompare(b.reason)),
    nonPort,
    share: window > 0 ? nonPort / window : 0,
    verdict,
  };
}

function censusPhrase(c: CauseTwinWindow): string {
  return c.census.length
    ? c.census.map((x) => `${x.reason} ${x.n}`).join(" + ")
    : "an empty window";
}

/** THE TWIN WINDOWS — the ledger's window (this read's own) against the
 *  witnessed feed's window (handed in by the route from the SAME journal
 *  parse — one parse, many readers). Same 12, same 25% call, same words:
 *  whatever the two reads say differently is the window's own population,
 *  named here instead of left mysterious. */
export function causeTwin(
  ledger: {
    deaths: number;
    window: number;
    census: Map<string, number>;
    verdict: DeathCauseVerdict;
  },
  witnessed: Array<{ cause: string }>,
): CauseTwin {
  const ledgerWin = twinWindow("THE LEDGER", ledger.deaths, ledger.window, ledger.census);

  const wList = (witnessed ?? []).filter((w) => w && typeof w.cause === "string");
  if (wList.length === 0) {
    return {
      ledger: ledgerWin,
      witness: null,
      agree: null,
      note: "the twin windows wait — no witnessed feed was handed in (the witness side needs the guardian's sampled kills)",
    };
  }

  const wDeaths = wList.length;
  const wWin = Math.min(CAUSE_RECENT_WINDOW, wDeaths);
  const wCensus = new Map<string, number>();
  for (const w of wList.slice(wDeaths - wWin)) {
    wCensus.set(w.cause, (wCensus.get(w.cause) ?? 0) + 1);
  }
  const witnessWin = twinWindow("THE WITNESS", wDeaths, wWin, wCensus);

  const comparable = witnessWin.verdict !== "TOO FEW" && ledgerWin.verdict !== "TOO FEW";
  const agree = comparable ? witnessWin.verdict === ledgerWin.verdict : null;

  let note: string;
  if (!comparable) {
    const thin = witnessWin.verdict === "TOO FEW" ? "the witness" : "the ledger";
    note =
      `the twin windows: the ledger reads ${ledgerWin.verdict} (${censusPhrase(ledgerWin)} — ${pct(ledgerWin.share)}), ` +
      `the witness reads ${witnessWin.verdict} (${censusPhrase(witnessWin)} — ${pct(witnessWin.share)}) — ` +
      `${thin}'s window is thin, so the words cannot be compared, only named`;
  } else if (agree) {
    note =
      `the twin windows: the ledger (every journaled settled death) and the witness (the kills the guardian sampled with a memory window) read the same word — ${ledgerWin.verdict} — ` +
      `from different populations: the ledger's window is ${censusPhrase(ledgerWin)} (${pct(ledgerWin.share)}), ` +
      `the witness's is ${censusPhrase(witnessWin)} (${pct(witnessWin.share)}) — ` +
      `the shares differ, the word holds: same record, two feeds, one finding`;
  } else {
    note =
      `the twin windows DISAGREE: the ledger reads ${ledgerWin.verdict} (${censusPhrase(ledgerWin)} — ${pct(ledgerWin.share)} of its ${ledgerWin.window}-death window), ` +
      `the witness reads ${witnessWin.verdict} (${censusPhrase(witnessWin)} — ${pct(witnessWin.share)} of its ${witnessWin.window}-death window) — ` +
      `same record, two feeds: the divergence is the window's own population (the witness sees only sampled kills; the ledger sees every settled death), not a contradiction — read both, trust neither alone`;
  }

  return { ledger: ledgerWin, witness: witnessWin, agree, note };
}

/** THE SCARCITY LADDER — the witnessed feed in, the floor's depth gauge out.
 *  Every judged death carries its dying window's own minAvail (the lowest
 *  host memory the guardian's sampling saw); the ladder ranks them deepest
 *  first, draws the deep band at SCARCITY_DEEP_LINE_MB, and speaks the band's
 *  word: is the deepest scarcity where the floor takes its turns? Rows
 *  without a finite avail reading are excluded and named — a depth cannot
 *  be read from what was never sampled. The band's exceptions (avail-
 *  critical strikes above the line) stay in the read and the note names
 *  them: a tendency, not a law. */
export function scarcityLadder(
  witnessed: Array<{
    cause: string;
    at?: string;
    atMs?: number;
    minAvailMb?: number | null;
    maxRssMb?: number | null;
  }>,
): ScarcityLadder {
  const rows = (witnessed ?? []).filter((w) => w && typeof w.cause === "string");
  const judgedRows = rows.filter(
    (w) => typeof w.minAvailMb === "number" && Number.isFinite(w.minAvailMb),
  );
  const unjudged = rows.length - judgedRows.length;

  const ladder: ScarcityDeath[] = judgedRows
    .map((w) => ({
      at: String(w.at ?? ""),
      atMs: typeof w.atMs === "number" && Number.isFinite(w.atMs) ? w.atMs : null,
      cause: w.cause,
      minAvailMb: w.minAvailMb as number,
      maxRssMb: typeof w.maxRssMb === "number" && Number.isFinite(w.maxRssMb) ? w.maxRssMb : null,
    }))
    // deepest first; equal depth reads chronologically (the earlier strike
    // ranks deeper); the stamp is the last-resort key (atMs null rows).
    .sort(
      (a, b) =>
        a.minAvailMb - b.minAvailMb || (a.atMs ?? 0) - (b.atMs ?? 0) || a.at.localeCompare(b.at),
    )
    .map((d, i) => ({ ...d, rank: i + 1 }));

  const judged = ladder.length;
  const deep = ladder.filter((d) => d.minAvailMb <= SCARCITY_DEEP_LINE_MB);
  const above = ladder.filter((d) => d.minAvailMb > SCARCITY_DEEP_LINE_MB);
  const deepAcN = deep.filter((d) => d.cause === "avail-critical").length;
  const deepPortN = deep.filter((d) => d.cause === "port").length;
  const deepOtherN = deep.length - deepAcN - deepPortN;
  const aboveAcN = above.filter((d) => d.cause === "avail-critical").length;
  const acDepths = ladder.filter((d) => d.cause === "avail-critical").map((d) => d.minAvailMb);
  const portDepths = ladder.filter((d) => d.cause === "port").map((d) => d.minAvailMb);
  const deepestAcMb = acDepths.length ? Math.min(...acDepths) : null;
  const deepestPortMb = portDepths.length ? Math.min(...portDepths) : null;
  const deepAcShare = deep.length > 0 ? deepAcN / deep.length : null;
  const aboveAcShare = above.length > 0 ? aboveAcN / above.length : null;

  let verdict: ScarcityVerdict;
  let verdictReason: string;
  if (judged === 0) {
    verdict = "TOO FEW";
    verdictReason =
      "no witnessed death carries a finite avail reading — the ladder cannot be drawn from what was never sampled";
  } else if (deep.length < SCARCITY_MIN_DEEP) {
    verdict = "TOO FEW";
    verdictReason = `the deep band (≤ ${SCARCITY_DEEP_LINE_MB} MB) holds ${deep.length} death${deep.length === 1 ? "" : "s"} — under the ${SCARCITY_MIN_DEEP} the ladder's word needs`;
  } else if (deepAcN > deepPortN) {
    verdict = "THE DEEP BAND IS THE FLOOR'S TURN";
    verdictReason = `below the ${SCARCITY_DEEP_LINE_MB} MB line the band holds ${deepAcN} avail-critical vs ${deepPortN} port — the deepest scarcity is where the floor takes its turns`;
  } else if (deepPortN > deepAcN) {
    verdict = "THE DEEP BAND IS PORT COUNTRY";
    verdictReason = `below the ${SCARCITY_DEEP_LINE_MB} MB line the band holds ${deepPortN} port vs ${deepAcN} avail-critical — the deepest scarcity on this record still belonged to the port's own kills`;
  } else {
    verdict = "CONTESTED";
    verdictReason = `below the ${SCARCITY_DEEP_LINE_MB} MB line avail-critical and port hold ${deepAcN} each — the band's word waits for a tiebreak`;
  }

  // The condensation clause — the ac share below vs above the line, said
  // only when both denominators exist (the era question's own arithmetic).
  const condensation =
    deepAcShare != null && aboveAcShare != null
      ? `the ac share below the line ${pct(deepAcShare)} vs ${pct(aboveAcShare)} above it`
      : null;
  // The outlier clause — avail-critical strikes above the line, named.
  const aboveAcDepths = above.filter((d) => d.cause === "avail-critical").map((d) => d.minAvailMb);
  const outlier =
    aboveAcN > 0
      ? `${aboveAcN} avail-critical strike${aboveAcN === 1 ? "" : "s"} sit${aboveAcN === 1 ? "s" : ""} ABOVE the line (shallowest at ${Math.min(...aboveAcDepths)} MB) — the band is a tendency the record drew, not a law the journal obeys`
      : null;
  // The other-cause clause — band deaths that are neither ac nor port.
  const otherClause =
    deepOtherN > 0
      ? ` ${deepOtherN} other-cause death${deepOtherN === 1 ? "" : "s"} inside the band`
      : "";

  let note: string;
  if (verdict === "TOO FEW" && judged === 0) {
    note = `the scarcity ladder waits — ${rows.length} witnessed row(s), none with a finite avail reading (a depth cannot be read from what was never sampled)`;
  } else {
    note =
      `the scarcity ladder: ${judged} witnessed death${judged === 1 ? "" : "s"} ranked by the host memory their dying window bottomed at` +
      (unjudged > 0 ? ` (${unjudged} unjudged — no finite avail sample)` : "") +
      ` — the deep band (≤ ${SCARCITY_DEEP_LINE_MB} MB) holds ${deep.length} (${deepAcN} avail-critical · ${deepPortN} port` +
      (deepOtherN > 0 ? ` · ${deepOtherN} other` : "") +
      `), above it ${above.length} (${aboveAcN} avail-critical)` +
      (condensation ? ` — ${condensation}` : "") +
      (outlier ? `; ${outlier}` : "") +
      (otherClause || "") +
      `; the depths come from the witness windows alone — the ledger feed carries no memory`;
  }

  return {
    ladder,
    judged,
    unjudged,
    deepLineMb: SCARCITY_DEEP_LINE_MB,
    deepN: deep.length,
    deepAcN,
    deepPortN,
    deepOtherN,
    aboveN: above.length,
    aboveAcN,
    deepestAcMb,
    deepestPortMb,
    deepAcShare,
    aboveAcShare,
    verdict,
    verdictReason,
    note,
  };
}

// ─── R122 · THE ERA VERDICTS — the lens's temporal cut ─────────────────────
//
// The drift reads the share death by death; the twin reads it across the
// two feeds; the ladder reads it across DEPTH. What none of them reads is
// the cut the eras card draws: the record's own timeline, carved at its
// lulls. The scarcity ladder's live word — THE DEEP BAND IS THE FLOOR'S
// TURN — posed the temporal question its arithmetic cannot answer: are
// the floor's turns SPREAD across the record, or do they CLUSTER in its
// pressure eras? An era is a window the record itself drew — so the lens
// applies the SAME window rules to every era (the same CAUSE_MIN_DEATHS,
// the same CAUSE_SHARE_CALL inclusive edge, the same four words) and
// names, era by era, who owned the deaths inside it. One calibration,
// many windows — the twin's lesson, cut temporally.
//
//   THE WORDS   — per era, exactly the lens's verdict (buildVerdict with
//                 the era's own membership as the window): PORT MONOPOLY /
//                 THE FLOOR TAKES TURN / PORT RULES / TOO FEW (an era
//                 smaller than CAUSE_MIN_DEATHS refuses honestly — a thin
//                 era is named, never forced to speak).
//   THE ADDRESS — the turn's address: the eras whose word reads THE FLOOR
//                 TAKES TURN. A contiguous deep-pressure stretch reading
//                 the turn is the era-shaped finding; a lone speaking era
//                 reading port everywhere else says the opposite.
//   THE MARGINS — every carve's own distance past the lull line. A carve
//                 standing within ERA_MARGIN_WHISKER_RATIO of the line is
//                 a WHISKER carve and is named: the line itself re-derives
//                 as the heartbeat grows, so a near-line carve is the
//                 first place a re-carve will show (R121's risk — the
//                 numbering moved because the line moved — made visible
//                 on the card instead of left in the note).
//
// Pure: the kills are handed in (cause only — the era cut reads WHO, the
// depths stay the ladder's), the eras are handed in (stormEras' own
// carving — this engine never re-carves), the line is handed in.

/** A carve standing within this fraction of the lull line (above it) is
 *  a WHISKER carve. First calibration from the record: era #2's 32.8′
 *  opener crossed the 31.80′ line by 1.0′ (3.1% — the carve R121's line
 *  move let in), while the next-nearest opener stands 15% clear. 5% is
 *  the honest line between a whisker and a clear carve. */
export const ERA_MARGIN_WHISKER_RATIO = 0.05;

/** One era's verdict — the lens's own window rules applied to the era's
 *  own membership. */
export interface EraVerdict {
  index: number;
  /** 1-based witnessed-kill sequence numbers the era spans (verbatim from
   *  the eras card's carving). */
  firstSeq: number;
  lastSeq: number;
  n: number;
  /** The era's own census (n desc, then name asc — the twin's sort). */
  census: Array<{ reason: string; n: number }>;
  /** Non-port deaths inside the era. */
  nonPort: number;
  /** nonPort / n — the share the call line reads. */
  share: number;
  /** The word this era's window reads. */
  word: DeathCauseVerdict;
  reason: string;
  /** The gap (min) that opened this era — null for era #1 (opened
   *  mid-storm) or when the eras feed omits it. */
  openerGapMin: number | null;
  /** openerGapMin − lullLineMin — how far past the line the carve stood.
   *  Null for era #1, or when no line exists. */
  marginMin: number | null;
  /** True when the carve stands within ERA_MARGIN_WHISKER_RATIO of the
   *  line — the first place a re-carve will show. */
  whisker: boolean;
}

export interface EraVerdictsRead {
  eras: EraVerdict[];
  /** Era indices whose word reads THE FLOOR TAKES TURN. */
  turnEras: number[];
  /** True when any carve is a whisker carve. */
  whiskerCarves: boolean;
  /** The engine's own one-liner — the eras card carries it verbatim. */
  note: string;
}

/** The lens's window rules on ONE window's census — the shared door the
 *  era cut (and any future window cut) walks through: the same
 *  CAUSE_MIN_DEATHS, the same CAUSE_SHARE_CALL, the same four words. */
export function causeWindowVerdict(census: Array<{ reason: string; n: number }>): {
  word: DeathCauseVerdict;
  reason: string;
} {
  const m = new Map<string, number>();
  let total = 0;
  for (const c of census) {
    const n = Number.isFinite(c.n) && c.n > 0 ? c.n : 0;
    if (n === 0) continue;
    m.set(c.reason, (m.get(c.reason) ?? 0) + n);
    total += n;
  }
  const { verdict, reason } = buildVerdict(total, total, m);
  return { word: verdict, reason };
}

/** THE ERA VERDICTS — the lens's temporal cut. Kills are handed in in
 *  witnessed order (index i = seq i+1, the eras card's own feed); eras
 *  come verbatim from stormEras; the line comes from the eras read. */
export function eraVerdicts(
  kills: Array<{ cause: string }>,
  eras: Array<{
    index: number;
    firstSeq: number;
    lastSeq: number;
    openedByGapMin: number | null;
  }>,
  opts: { lullLineMin: number | null },
): EraVerdictsRead {
  const line = opts?.lullLineMin;
  const usableLine = line != null && Number.isFinite(line) && line > 0 ? line : null;

  const built: EraVerdict[] = eras.map((e) => {
    const from = Math.max(0, (e.firstSeq ?? 1) - 1);
    const to = Math.min(kills.length, e.lastSeq ?? from + 1);
    const slice = kills.slice(from, to);
    const censusMap = new Map<string, number>();
    for (const k of slice) {
      const cause = k?.cause ?? "unknown";
      censusMap.set(cause, (censusMap.get(cause) ?? 0) + 1);
    }
    const census = [...censusMap.entries()]
      .map(([reason, n]) => ({ reason, n }))
      .sort((a, b) => b.n - a.n || a.reason.localeCompare(b.reason));
    const nonPort = census.filter((c) => c.reason !== "port").reduce((a, c) => a + c.n, 0);
    const n = slice.length;
    const { word, reason } = causeWindowVerdict(census);
    const openerGapMin =
      e.openedByGapMin != null && Number.isFinite(e.openedByGapMin) ? e.openedByGapMin : null;
    const marginMin =
      openerGapMin != null && usableLine != null
        ? Math.round((openerGapMin - usableLine) * 100) / 100
        : null;
    const whisker =
      marginMin != null && marginMin >= 0 && usableLine != null
        ? marginMin <= usableLine * ERA_MARGIN_WHISKER_RATIO
        : false;
    return {
      index: e.index,
      firstSeq: e.firstSeq,
      lastSeq: e.lastSeq,
      n,
      census,
      nonPort,
      share: n > 0 ? nonPort / n : 0,
      word,
      reason,
      openerGapMin,
      marginMin,
      whisker,
    };
  });

  const turnEras = built.filter((e) => e.word === "THE FLOOR TAKES TURN").map((e) => e.index);
  const whiskerCarves = built.some((e) => e.whisker);

  // THE READ.
  if (built.length === 0) {
    return {
      eras: built,
      turnEras,
      whiskerCarves,
      note: "no eras handed in — the era verdicts wait for the record to be carved",
    };
  }
  const parts: string[] = [];
  const spoken = built.filter((e) => e.word !== "TOO FEW");
  const refused = built.filter((e) => e.word === "TOO FEW");
  parts.push(
    `${built.length} era${built.length === 1 ? "" : "s"} cut by the lens's own window rules (the era's membership IS the window)`,
  );
  parts.push(
    built
      .map((e) => {
        const head = `era #${e.index} ${e.word}`;
        if (e.word === "TOO FEW") return `${head} (n=${e.n})`;
        return `${head} (non-port ${e.nonPort}/${e.n} = ${pct(e.share)})`;
      })
      .join(" · "),
  );
  if (refused.length > 0) {
    parts.push(
      `${refused.length} era${refused.length === 1 ? "" : "s"} TOO FEW (under the ${CAUSE_MIN_DEATHS} the word needs) — named, never forced to speak`,
    );
  }
  if (turnEras.length > 0) {
    parts.push(
      `the turn's address: era${turnEras.length === 1 ? "" : "s"} ${turnEras.map((i) => `#${i}`).join(" and ")} — the floor's turns ${turnEras.length === 1 ? "lives in one era" : "cluster in the pressure stretch"}`,
    );
  } else if (spoken.length > 0) {
    parts.push("no era speaks the turn — the floor's turns are visits so far, era by era");
  }
  const whiskers = built.filter((e) => e.whisker);
  if (whiskers.length > 0) {
    parts.push(
      whiskers
        .map(
          (e) =>
            `era #${e.index}'s carve stands a whisker past the line (${round2(e.openerGapMin!)}′ vs ${round2(usableLine!)}′, margin ${round2(e.marginMin!)}) — the first place a re-carve will show`,
        )
        .join(" · "),
    );
  }
  return { eras: built, turnEras, whiskerCarves: whiskerCarves, note: parts.join("; ") };
}

// R123 — THE LEADERSHIP LENS: has the floor EVER out-numbered the port?
//
// The verdict's call line (25%, inclusive) reads the floor's VISITS; the
// drift's leadership line (50%, STRICT) reads the floor's MAJORITY — the
// era question's stronger form. R122 left the leadership question open:
// the drift computes a per-point `leads` flag and no instrument speaks
// what it implies. This lens is that instrument — THE DRIFT's own
// binarization, derived from the SAME points (one parse, many readers —
// the twin's lesson): the lens can never disagree with the lane it reads.
//
//   THE ELIGIBLE ZONE — windows the verdict would speak in (verdictAt !==
//   'TOO FEW'). A sub-8-death window at 100% is arithmetic trivia, not
//   the era question's answer — the drift's own peak rule, cut again.
//   THE REIGNS    — maximal runs of consecutive leading windows: from,
//                   to, length, the reign's peak share. A reign is the
//                   floor HOLDING the majority across deaths, not visiting.
//   THE WORD      — NO RECORD (no deaths) / TOO FEW (no eligible window) /
//                   THE PORT HAS NEVER CEDED THE MAJORITY (zero reigns) /
//                   THE FLOOR REIGNS (the newest eligible window leads) /
//                   THE FLOOR HAS REIGNED (reigns exist, the newest does
//                   not lead — the drought is dated, not implied).
//   THE CLOSEST   — the highest share any eligible window has ridden
//                   (ties → the earliest): when the answer is no, the
//                   lens says how FAR the floor has climbed instead.
export interface LeadershipReign {
  /** 1-based reign number, chronological. */
  index: number;
  /** The first death whose trailing window leads. */
  fromDeath: number;
  /** The last death whose trailing window leads. */
  toDeath: number;
  /** Consecutive leading windows (toDeath − fromDeath + 1). */
  length: number;
  /** The reign's highest non-port share. */
  peakShare: number;
}

export type LeadershipWord =
  | "NO RECORD"
  | "TOO FEW"
  | "THE PORT HAS NEVER CEDED THE MAJORITY"
  | "THE FLOOR REIGNS"
  | "THE FLOOR HAS REIGNED";

export interface LeadershipRead {
  /** Eligible deaths — the verdict-eligible windows the lens reads. */
  eligibleDeaths: number;
  /** Eligible windows whose share rides past the 50% leadership line. */
  leadWindows: number;
  /** The reigns, chronological. */
  reigns: LeadershipReign[];
  /** The longest reign (ties → the earliest). Null when no reign. */
  longest: LeadershipReign | null;
  /** Whether the NEWEST eligible window leads — the floor reigns now. */
  reigningNow: boolean;
  /** Eligible deaths since the newest reign ended (0 when reigningNow;
   *  null when no reign has ever stood). */
  deathsSinceReign: number | null;
  /** The highest share any eligible window has ridden (ties → earliest);
   *  null when no eligible window exists. The "how far has the floor
   *  climbed" number when the word is NEVER CEDED. */
  closest: { share: number; deathIndex: number } | null;
  /** Non-port deaths a FULL window needs for leadership (> half). */
  needInFullWindow: number;
  /** The lens's word. */
  word: LeadershipWord;
  /** The engine's own one-liner — THE READ carries it verbatim. */
  note: string;
}

export function causeLeadership(deathsList: DeathCauseDeath[]): LeadershipRead {
  // Same parse, same rules: the drift IS the share history — the lens is
  // its binarization. Recomputing the window arithmetic here risks the two
  // instruments drifting apart; reading the drift's points cannot.
  const drift = causeDrift(deathsList);
  const eligible = drift.points.filter((p) => p.verdictAt !== "TOO FEW");
  const leadWindows = eligible.filter((p) => p.leads).length;

  const reigns: LeadershipReign[] = [];
  let cur: LeadershipReign | null = null;
  for (const p of eligible) {
    if (p.leads) {
      if (cur) {
        cur.toDeath = p.deathIndex;
        cur.length += 1;
        cur.peakShare = Math.max(cur.peakShare, p.share);
      } else {
        cur = {
          index: reigns.length + 1,
          fromDeath: p.deathIndex,
          toDeath: p.deathIndex,
          length: 1,
          peakShare: p.share,
        };
      }
    } else if (cur) {
      reigns.push(cur);
      cur = null;
    }
  }
  if (cur) reigns.push(cur);
  reigns.forEach((r, i) => {
    r.index = i + 1;
  });

  let longest: LeadershipReign | null = null;
  for (const r of reigns) if (!longest || r.length > longest.length) longest = r;

  const newest = eligible.length > 0 ? eligible[eligible.length - 1]! : null;
  const reigningNow = newest != null && newest.leads;
  const lastReign = reigns.length > 0 ? reigns[reigns.length - 1]! : null;
  const deathsSinceReign =
    reigningNow && newest ? 0 : lastReign && newest ? newest.deathIndex - lastReign.toDeath : null;

  let closest: LeadershipRead["closest"] = null;
  for (const p of eligible) {
    if (!closest || p.share > closest.share) closest = { share: p.share, deathIndex: p.deathIndex };
  }

  // A full 12-window leads at 7+ non-port (> half — STRICT, the drift's
  // own rule; exactly half is a tie, not a lead).
  const needInFullWindow = Math.floor(CAUSE_RECENT_WINDOW * 0.5) + 1;

  let word: LeadershipWord;
  if (deathsList.length === 0) word = "NO RECORD";
  else if (eligible.length === 0) word = "TOO FEW";
  else if (reigns.length === 0) word = "THE PORT HAS NEVER CEDED THE MAJORITY";
  else if (reigningNow) word = "THE FLOOR REIGNS";
  else word = "THE FLOOR HAS REIGNED";

  let note: string;
  switch (word) {
    case "NO RECORD":
      note = "the leadership lens waits — no settled death has laid a window down";
      break;
    case "TOO FEW":
      note =
        `the leadership lens refuses — ${deathsList.length} settled death(s) is under the ${CAUSE_MIN_DEATHS} ` +
        `an honest window needs; the era question's stronger form waits for the verdict's first breath`;
      break;
    case "THE PORT HAS NEVER CEDED THE MAJORITY": {
      const closestPart = closest
        ? `the closest the floor has come is ${pct(closest.share)} (death #${closest.deathIndex})`
        : "no eligible window has laid a share down";
      note =
        `the port has never ceded the majority — ${eligibleDeathsStr(eligible.length)}, zero leadership ` +
        `windows; ${closestPart} — leadership needs ${needInFullWindow} non-port deaths in a full ` +
        `${CAUSE_RECENT_WINDOW}-window (PAST the 50% line: exactly half is a tie, not a lead)`;
      break;
    }
    case "THE FLOOR REIGNS": {
      const cur2 = lastReign!;
      note =
        `the floor REIGNS — the newest eligible window's non-port out-numbers the port; the reigning stretch ` +
        `has held ${cur2.length} window(s) (death #${cur2.fromDeath} → #${cur2.toDeath}, peak ${pct(cur2.peakShare)}) ` +
        `across ${reigns.length} reign(s) on the record, the longest ${longest!.length}`;
      break;
    }
    case "THE FLOOR HAS REIGNED":
      note =
        `the floor has reigned ${reigns.length} time(s) and does not reign now — the longest reign held ` +
        `${longest!.length} window(s) (death #${longest!.fromDeath} → #${longest!.toDeath}, peak ${pct(longest!.peakShare)}); ` +
        `the drought runs ${deathsSinceReign} eligible death(s) since reign #${lastReign!.index} ended at death #${lastReign!.toDeath}`;
      break;
  }

  return {
    eligibleDeaths: eligible.length,
    leadWindows,
    reigns,
    longest,
    reigningNow,
    deathsSinceReign,
    closest,
    needInFullWindow,
    word,
    note,
  };
}

function eligibleDeathsStr(n: number): string {
  return `${n} eligible window${n === 1 ? "" : "s"}`;
}

/** THE LENS — the boot ledger's boots in, the cause census out. The
 *  witnessed feed is optional (R120): handed in, it arms the twin windows
 *  and R121's scarcity ladder — the extra fields (at/atMs/minAvailMb/
 *  maxRssMb) are optional so every existing caller survives untouched. */
export function deathCauseRead(
  boots: BootTenure[],
  opts?: {
    witnessed?: Array<{
      cause: string;
      at?: string;
      atMs?: number;
      minAvailMb?: number | null;
      maxRssMb?: number | null;
    }>;
  },
): DeathCauseRead {
  const stillbornExcluded = boots.filter((b) => b.endState === "deceased" && !b.served).length;
  const livingCensored = boots.filter((b) => b.endState === "living").length;
  const unjournaledExcluded = boots.filter((b) => b.endState === "unjournaled").length;

  const settled = boots.filter((b) => b.endState === "deceased" && b.served);
  const deathsList: DeathCauseDeath[] = settled.map((b, i) => ({
    pid: b.pid,
    reason: b.deathReason ?? "unknown",
    tenureMin: b.tenureMin as number,
    deathAt: b.deathAt,
    index: i,
  }));
  const deaths = deathsList.length;

  // The run decomposition over the death order.
  const runs: DeathCauseRun[] = [];
  deathsList.forEach((d) => {
    const last = runs[runs.length - 1];
    if (last && last.reason === d.reason) {
      last.toIndex = d.index;
      last.length += 1;
    } else {
      runs.push({ reason: d.reason, length: 1, fromIndex: d.index, toIndex: d.index });
    }
  });
  const runNarrative = runs.map((r) => `${r.reason}×${r.length}`).join(" → ");
  const longestRun = new Map<string, number>();
  for (const r of runs) {
    longestRun.set(r.reason, Math.max(longestRun.get(r.reason) ?? 0, r.length));
  }

  // The recent window and its census.
  const window = Math.min(CAUSE_RECENT_WINDOW, deaths);
  const windowDeaths = deathsList.slice(deaths - window);
  const windowCensus = new Map<string, number>();
  for (const d of windowDeaths) {
    windowCensus.set(d.reason, (windowCensus.get(d.reason) ?? 0) + 1);
  }
  const { verdict, reason: verdictReason } = buildVerdict(deaths, window, windowCensus);
  // R120 — THE TWIN WINDOWS: armed when the route hands in the witnessed
  // feed (the same journal parse, the guardian's sampled kills).
  const twin = causeTwin({ deaths, window, census: windowCensus, verdict }, opts?.witnessed ?? []);
  // R121 — THE SCARCITY LADDER: armed when the route hands in the witnessed
  // feed (the depths come from the witness windows alone); a feed handed in
  // without avail readings reads TOO FEW honestly, never a guessed depth.
  const scarcity =
    opts?.witnessed && opts.witnessed.length > 0 ? scarcityLadder(opts.witnessed) : null;

  // Per-cause stats, sorted n desc then name asc (the killer lens's order).
  const byReason = new Map<string, DeathCauseDeath[]>();
  for (const d of deathsList) {
    if (!byReason.has(d.reason)) byReason.set(d.reason, []);
    byReason.get(d.reason)!.push(d);
  }
  const causes: DeathCauseStat[] = [...byReason.entries()]
    .map(([reason, ds]) => {
      const tenures = ds.map((d) => d.tenureMin);
      const idxs = ds.map((d) => d.index);
      const strides: number[] = [];
      for (let i = 1; i < idxs.length; i++) strides.push(idxs[i] - idxs[i - 1]);
      return {
        reason,
        n: ds.length,
        share: deaths > 0 ? ds.length / deaths : 0,
        firstIndex: idxs[0] ?? null,
        lastIndex: idxs[idxs.length - 1] ?? null,
        firstAt: ds[0].deathAt ?? null,
        lastAt: ds[ds.length - 1].deathAt ?? null,
        medianTenureMin: houseLowerMedian(tenures),
        minTenureMin: tenures.length ? Math.min(...tenures) : null,
        maxTenureMin: tenures.length ? Math.max(...tenures) : null,
        recentN: windowCensus.get(reason) ?? 0,
        longestRun: longestRun.get(reason) ?? 0,
        strides: strides.length ? strides : null,
        medianStride: strides.length ? houseLowerMedian(strides) : null,
      };
    })
    .sort((a, b) => b.n - a.n || a.reason.localeCompare(b.reason));

  const read: DeathCauseRead = {
    deaths,
    stillbornExcluded,
    livingCensored,
    unjournaledExcluded,
    window,
    causes,
    runs,
    runNarrative,
    verdict,
    verdictReason,
    deathsList,
    sensitivity: causeSensitivity(deaths, deathsList, verdict),
    ascent: causeAscent(deaths, deathsList, verdict),
    drift: causeDrift(deathsList),
    twin,
    scarcity,
    leadership: causeLeadership(deathsList),
    note: "",
  };
  read.note = buildNote(read);
  return read;
}

function buildNote(r: DeathCauseRead): string {
  const parts: string[] = [];
  const excl: string[] = [];
  if (r.stillbornExcluded > 0)
    excl.push(
      `${r.stillbornExcluded} stillborn (never served — cannot die of a cause this lens measures)`,
    );
  if (r.livingCensored > 0)
    excl.push(`${r.livingCensored} living (censored — a life without an end has no cause yet)`);
  if (r.unjournaledExcluded > 0) excl.push(`${r.unjournaledExcluded} unjournaled (tenure unknown)`);
  parts.push(
    `${r.deaths} settled deaths on the record${excl.length ? ` (${excl.join(" · ")} excluded)` : ""}`,
  );
  if (r.causes.length) {
    parts.push(
      `the census: ${r.causes.map((c) => `${c.reason} ${c.n} (${pct(c.share)})`).join(" · ")}`,
    );
  }
  if (r.runs.length > 1) {
    const longest = r.causes
      .filter((c) => c.longestRun > 0)
      .sort((a, b) => b.longestRun - a.longestRun)[0];
    parts.push(
      `the death order reads ${r.runNarrative}${longest ? ` — ${longest.reason}'s longest unbroken run ${longest.longestRun}` : ""}`,
    );
  }
  const strided = r.causes.filter((c) => c.strides !== null && c.strides.length >= 2);
  if (strided.length) {
    parts.push(
      `strike strides (deaths between strikes): ${strided
        .map((c) => `${c.reason} ${c.strides!.join(", ")} (lower-median ${c.medianStride})`)
        .join(" · ")}`,
    );
  }
  parts.push(`the last ${r.window} deaths → ${r.verdict}: ${r.verdictReason}`);
  parts.push(r.sensitivity.note);
  parts.push(r.ascent.note);
  parts.push(r.drift.note);
  if (r.twin) parts.push(r.twin.note);
  if (r.scarcity) parts.push(r.scarcity.note);
  parts.push(r.leadership.note);
  return parts.join(" · ");
}
