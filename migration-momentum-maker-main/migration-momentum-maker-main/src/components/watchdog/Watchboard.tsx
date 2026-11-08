"use client";

// src/components/watchdog/Watchboard.tsx — R125 · THE WATCHBOARD.
//
// Every round's handoff has carried a list of STANDING WATCHES — the open
// tensions the next round must read before it trusts anything (the edge
// ride, the walk's remaining holds, the newest era's whisker carve, the
// deep band's untested word, the quiet hour's countdown, the churn clock's
// ETA, the leadership line's closest approach). Until now they lived in
// prose and the operator read them panel by panel. This board compiles
// them into ONE lane: each watch a row, each row a live status word, a
// one-line detail, and the watch's contract in its own tooltip.
//
// THE HONESTY CONTRACTS:
//   - The board derives nothing: every row reads its home engine's own
//     output (the /api/estate/watchboard route composes the same
//     death-cause read, the same eras read, the same latency-memory read
//     the panels serve — one calibration, many readers). A number here is
//     the number its home panel shows.
//   - The memory rows ride the store READ-ONLY: a board read never
//     appends a snapshot, never moves the record it reads.
//   - A read that fails renders NO FEED as its own status — the refusal
//     is the row's word, never a guessed state.
//   - The board forecasts nothing: the walk's and the ascent's simulated
//     steps are labelled as the simulations they are.
//
// R128 · TWO ADDITIONS, SAME CONTRACT:
//   - THE TENSION DIGEST: the hot rows (amber/rose) surfaced as clickable
//     chips in reading order — the operator's ten-second brief. A chip
//     scrolls to its row and flashes it; COPY DIGEST puts the full
//     word-level brief on the clipboard. No new arithmetic: the digest IS
//     the rows, re-read.
//   - THE BOARD'S OWN LEDGER: the board gains a memory. After each read
//     the panel fires one POST sampler — the SERVER composes the board
//     itself (the client sends nothing) and records the sample only when
//     the words MOVED (signature dedupe on the store). The lane renders
//     the flips (old word → new word, dated by the board's own stamp) and
//     a hot-count sparkline. The board reads the record; the ledger reads
//     the board — and the GET stays side-effect-free (the R125 contract).
//
// R131 · THREE ADDITIONS, SAME CONTRACT:
//   - THE HOUR HAND: the read names the SCALE its span stands on
//     (minute <15′ · quarter <30′ · half-hour <60′ · hour-scale ≥60′) —
//     a rate without its span is a number without its unit.
//   - KILL MARKS: the tenure dial's resets (a standing age collapsing
//     under a minute) drawn as rose ticks on the motion line — the
//     ledger's own shadow of the record's kills, read from the board's
//     words alone, never counted inside the read's narrative.
//   - COPY TAIL: the open tail exported as JSON, the digest's own
//     clipboard discipline (execCommand fallback included).
//
// R132 · THE QUIET HAND + THE STILL CENSUS, SAME CONTRACT:
//   - THE PACE: the read's fifth line — the gaps between consecutive
//     flips, their median (staccato ≤2′ · brisk ≤6′ · steady ≤12′ ·
//     sparse above, inclusive), and the LONGEST QUIET with the row that
//     ended it. The line names the ROW, never the event — the mirror
//     rule holds on the pace line too.
//   - THE QUIET BAND: the longest quiet drawn as a shaded span on the
//     motion line's own axis, between the two seats the gap runs
//     between — the silence given geometry, tooltip-verbatim.
//   - THE STILL CENSUS: the board's rows the open tail never heard —
//     grey dashed chips, clickable into the same row filter, with the
//     honest empty that says the row is still (depth-relative, said).
//
// R133 · THE SILENCE LADDER, SAME CONTRACT:
//   - The still census names WHO is silent; the ladder reads WHEN each
//     silent row was last heard — its newest flip in the store's whole
//     reach (the newest 200 moved boards), its quiet ruled against the
//     store's own span (never the wall clock), the never-heard rows
//     named with NO bar (a bar needs a number; the store has none).
//     The display ladders loudest-first; the engine keeps the census's
//     own order. The depth read (?silence=1) carries it — the display
//     always follows the depth read now: one reader, one truth.
//
// R133 · TWO MORE, SAME CONTRACT:
//   - THE FIRST WORD: each distinct row's first flip in the open tail
//     (firstWords, chronological contract) drawn as a hollow ring
//     around the dot that IS the birth — no new seats, the ring marks
//     a flip already on the axis. Depth-relative by definition, said
//     in the caption; the ring's color is the birth's own landing
//     tone.
//   - THE STILL SPEAKS: the silence's live edge — when a sampler read
//     (same depth, time moved) hears a row the previous read carried
//     as still, the lane toasts the row's newest flip and the quiet
//     the previous read held. Depth changes never fire it (a wider
//     reach is not a row speaking); the toast names the ROW and its
//     words — the mirror rule holds on the toast too.
//
// R134 · THE BIRTH LADDER + THE WEIGHT, SAME CONTRACT:
//   - THE BIRTH LADDER: the first words' ORDER as narrative — numbered
//     chips in birth order, the waits and the cadence the stamps
//     allow, the self-quoting line (engine birthLadder).
//   - THE WEIGHT: the tail's choreography as one stacked bar — every
//     moved row's share, heaviest first, colored by each row's newest
//     landing tone (engine motionWeights).
//
// R135 · THE WEIGHT LADDER + THE FIRST WORD SPEAKS, SAME CONTRACT:
//   - THE WEIGHT LADDER: the carrier read ACROSS the depths — the
//     route answers every depth chip at once (engine weightLadder on
//     the store's own reach), and the lane renders the rungs: does the
//     carrier HOLD, or does the CROWN MOVE (a row that owns the
//     shallows while another owns the deep)? A share is never quoted
//     naked — every rung names its depth.
//   - THE FIRST WORD SPEAKS: the births' live edge, the silence's
//     live edge's own mirror (R133). Only a sampler-driven read (SAME
//     depth, time moved) may speak, and only for a row the previous
//     read had never heard within the open depth; a depth change
//     overwrites the comparison set WITHOUT speaking (a wider reach
//     is not a row being born). The toast names the ROW and its
//     words — the mirror rule holds (no word of it says KILL, even
//     when a birth is a tenure-dial reset).
//
// R136 · THE COMPANY + THE QUIET LADDER, SAME CONTRACT:
//   - THE COMPANY: who moves WITH whom — flips landing on the SAME
//     board stamp (one transition, several rows) are company. The
//     engine's one clock-free read: the stamp STRING is the
//     transition's identity, so grouping needs no minute. The lane
//     renders the strongest pairs (A ⇄ B ×N, click into the pair's
//     senior row), the solo/ensemble census, and the ENSEMBLE BANDS on
//     the motion line — a shaded band behind every stamp where ≥2 rows
//     moved together.
//   - THE QUIET LADDER: the pace's SHAPE, not just its longest — the
//     N longest quiets ruled longest-first (ties keep input order,
//     gapsOf's own convention), each a chip with a micro-bar ruled
//     against the ladder's own longest. The line says the WHOLE gap
//     count first, then names the rungs — a display bound, never an
//     arithmetic one.
//
// R140 · THE SHARED GROUND + THE EDGES LIT, SAME CONTRACT:
//   - THE SHARED GROUND: the restless × the silent — which rows BOTH
//     changed their mind (reversals' own rows) AND frame one of the
//     tail's RULED quiets (the quiet ladder's rungs). The composition
//     rides the RULED quiets because every flip frames SOME gap —
//     over all gaps the overlap would collapse into the restless
//     census alone. The strip renders the shared rows (chips with the
//     ↩ and ⌇ counts, click into the row's motion), the three-way
//     census, and the honest empty state (the dashed strip) when the
//     restless and the silent keep different rows.
//   - THE EDGES LIT: the handoff and quiet-company PAIR chips own the
//     relay's light — HOLD a chip (hover or focus) and the motion
//     line halos the edge's own seats, the underline band riding the
//     chip's family color (the handoff's amber, the quiet's cyan).
//     The engine grew the fuel (HandoffPair.seats, QuietPair.seats —
//     the edge's own flips, pinned in the r140 suite).
//
// R141 · THE TURNAROUND'S EDGES + THE TWO FACES, SAME CONTRACT:
//   - THE TURNAROUND'S EDGES: what delivered each changed mind — the
//     return flip's chronological predecessor either belongs to
//     another row (the directed edge that DELIVERED it) or to the
//     same row (the mind grew at home). The turnaround strip carries
//     the delivery census badge and the top delivery-edge chips (⇒
//     A → B ×N, click into the delivering row). Do the changed minds
//     ride the strongest handoff edges? Now the lane can say.
//   - THE TWO FACES: the shared-ground ROW chips own the light too —
//     HOLD a shared chip and the motion line halos the row's
//     turnaround flips in VIOLET and its quiet-frame flips in CYAN,
//     the restless and the silent made visible at once on the same
//     row. The MotionLine light is now GROUPED (each group its own
//     color; the band rides the holder's family).
//
// R142 · THE UNRULED TAIL + THE DELIVERY LIT + THE VIOLET FACE,
// SAME CONTRACT:
//   - THE UNRULED TAIL: the quiets the ladder does not name — the
//     quiet ladder's own complement, given their own shape: the
//     count below the rungs, the minutes' share of the whole
//     silence, the biggest unnamed quiet, the rows that keep them.
//     The split is exactly the ladder's slice — the two reads can
//     never disagree about who is ruled. The strip renders the
//     census (⌇↓ N BELOW · P% OF THE SILENCE), the biggest three
//     below-chips (click into the ender's motion), the line, and
//     the honest all-ruled empty state.
//   - THE DELIVERY LIT: the delivery-edge chips own the light —
//     HOLD a ⇒ A → B chip and the motion line halos each delivery's
//     own pair: the DELIVERERS in AMBER (the hand that passed) and
//     the CHANGED MINDS in VIOLET (the mind that arrived). The
//     engine grew the fuel (TurnaroundEdge.seats — each delivery's
//     two flips, flat in the tail's order, referenced not copied).
//   - THE VIOLET FACE: the turnaround row chips own the light —
//     HOLD a row chip and the motion line halos the row's changed
//     minds in violet, one face alone (the two-faces light's natural
//     sibling).
//
// R143 · THE UNRULED ROWS + THE BELOW LIT, SAME CONTRACT:
//   - THE UNRULED ROWS: the quiet-company read applied to the
//     ladder's own complement — which DIRECTED row pairs own the
//     quiets BELOW the rungs (the unnamed silence). It rides the
//     SAME shared slice helper as the unruled tail (one split, the
//     reads can never disagree); direction load-bearing, self-kept
//     its own company. Its strip renders the census (⌇⇄ C COMPANIES
//     over B BELOW), the top three pair chips (click into the
//     ender's motion), the line, and the honest all-ruled quiet.
//   - THE BELOW LIT: the below-chips AND the below pair chips own
//     the light — HOLD one and the motion line halos the quiet's own
//     seats (opener + ender) in the unruled family teal (#7ac8d0):
//     the unnamed silence made visible like the ruled ones.
//
// R144 · THE KEPT STORY + THE KEPT LIGHT, SAME CONTRACT:
//   - THE KEPT STORY: the self-kept quiets, and which of them end in
//     the row TAKING ITS OWN WORD BACK (a kept ender — the changed
//     mind that grew at home). The R141 kept-turnaround × R142
//     self-kept-quiet composition, made precise: a kept turnaround's
//     whole-tail predecessor is the same row, so it BY CONSTRUCTION
//     ends a self-kept quiet — the converse is the news. Each row's
//     HOMECOMING CADENCE rides too (the median interval between its
//     self-kept enders). On a clean tail keptStory().keptEnders ===
//     turnaroundEdges().kept — pinned.
//   - THE KEPT LIGHT: the kept-row chips own the light — HOLD one and
//     the motion line halos the row's self-kept quiet seats in TEAL
//     AND its kept enders in VIOLET (two groups, one story).
//   - THE DISCLOSURES: the unruled strips' +more grow into buttons —
//     click expands in place (the whole shape, not a link out); click
//     again folds.
//
// Self-fetching (60s re-read + one sampler POST — the panel's own cadence).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw,
  Radar,
  History,
  ClipboardCopy,
  Check,
  Activity,
  VolumeX,
  Scaling,
  Users,
  Hourglass,
  Undo2,
  MoveRight,
  Moon,
  Layers,
  ListEnd,
  GitFork,
  Home,
  Repeat2,
} from "lucide-react";
import { toast } from "sonner";

import type { WatchboardRead, WatchTone } from "@/lib/watchboard";
import { useClock } from "@/lib/use-clock";
import {
  ledgerRead,
  motionLinePoints,
  killMarks,
  gapsOf,
  stillCensus,
  firstWords,
  birthLadder,
  motionWeights,
  companions,
  quietLadder,
  reversals,
  handoffs,
  quietCompany,
  sharedGround,
  turnaroundEdges,
  unruledTail,
  unruledRows,
  unruledTurnovers,
  keptStory,
  crossCadence,
  moverLadder,
  hotHands,
  parseFolds,
  foldRecord,
  foldStamps,
  FOLD_NAMES,
  stampedRecord,
  adoptFoldMemory,
  foldMemoryOrigin,
  foldMemoryFooter,
  mirrorEstateRecord,
  readEstateStamp,
  readEstateStamps,
  standingGreeting,
  tabHueColor,
  consentDot,
  fadingEdge,
  fadingAlpha,
  mirrorAge,
  heartbeatTempo,
  headAge,
  firstHandRest,
  consentVoice,
  consentSpokenVoice,
  tempoTier,
  ageVoice,
  glyphRest,
  copyAge,
  legendArc,
  handRests,
  isOriginHand,
  handVoice,
  writerSpokenVoice,
  clockAgeMin,
  clockBeat,
  clockTier,
  clockSpokenVoice,
  clockTierHue,
  restBadge,
  restVoice,
  tierGlyph,
  writerLineAria,
  unstampedWriterVoice,
  rowGlyphAria,
  silenceGlyph,
  legendArcAria,
  hueLegendGlyph,
  HUE_LEGEND_VOICE,
  stateLineAria,
  buildDevSeedFixture,
  DEV_SEED_FLAG_KEY,
  rereadVoice,
  withdrawVoice,
  WITHDRAW_ARMED_MS,
  REREAD_HOME_MS,
  foldChipAria,
  foldBackVoice,
  filterAllAria,
  moverFoldAria,
  rowFilterChipAria,
  readDevseedFilterFlag,
  buildSessionSeedFixture,
  copyTailAria,
  depthChipAria,
  digestButtonAria,
  watchRowAria,
  digestChipAria,
  digestExport,
  type FoldName,
  type FoldValue,
  type FoldMemoryOrigin,
  LEDGER_SPAN_BANDS,
  LEDGER_PACE_BANDS,
  LEDGER_DEPTHS,
  type LedgerSummary,
  type BoardFlip,
  type LedgerMotionWord,
  type LedgerPaceWord,
  type SilenceRead,
  type SilenceEntry,
  type MotionWeight,
  type WeightLadderRead,
  type CompanyRead,
  type QuietLadderRead,
  type ReversalRead,
  type HandoffRead,
  type QuietCompanyRead,
  type SharedGroundRead,
  type TurnaroundEdgeRead,
  type UnruledRead,
  type UnruledRowsRead,
  type UnruledTurnoverRead,
  type KeptStoryRead,
  type CrossCadenceRead,
  type FreshnessHand,
} from "@/lib/watchboard-ledger";

const TONE_CLS: Record<WatchTone, string> = {
  sage: "border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10",
  cyan: "border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10",
  rose: "border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10",
  amber: "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10",
  neutral: "border-[#3a4530] text-[#c9d4bd] bg-black/30",
};

const TONE_DOT: Record<WatchTone, string> = {
  sage: "bg-[#c8ff00]",
  cyan: "bg-[#00d4e0]",
  rose: "bg-[#e5484d]",
  amber: "bg-[#e0a030]",
  neutral: "bg-[#5f6e55]",
};

/** Hot rows carry a tone-tinted left edge — the scanning aid the digest
 *  chips point at. Calm rows keep the plain hairline. */
const HOT_EDGE: Partial<Record<WatchTone, string>> = {
  amber: "border-l-2 border-l-[#e0a030]/70",
  rose: "border-l-2 border-l-[#e5484d]/70",
};

/** R180 · THE TENSION'S HEAT: a hot row's dot glows in its own tone —
 *  the tension visible on the row's smallest element, not just the
 *  left edge. Calm dots stay quiet. */
const TONE_GLOW: Partial<Record<WatchTone, string>> = {
  amber: "shadow-[0_0_5px_rgba(224,160,48,0.55)]",
  rose: "shadow-[0_0_5px_rgba(229,72,77,0.55)]",
};

/** R180 · the hot row's name warms with its state — the identity
 *  itself carries the tension's tone at a dim variant (readable on
 *  the dark ground). Calm names keep the muted green. */
const TONE_NAME: Partial<Record<WatchTone, string>> = {
  amber: "text-[#e0a030]/85",
  rose: "text-[#e5484d]/85",
};

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00] focus-visible:ring-offset-0";

const FLIP_TONE_DOT: Record<string, string> = {
  sage: "bg-[#c8ff00]",
  cyan: "bg-[#00d4e0]",
  rose: "bg-[#e5484d]",
  amber: "bg-[#e0a030]",
  neutral: "bg-[#5f6e55]",
};

/** The motion word's tone — the read's own severity ladder. STORMING is
 *  rose but the caption always says the mirror-honesty: the board's
 *  words, never the record's kills. */
const MOTION_TONE: Record<LedgerMotionWord, string> = {
  QUIET: "border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10",
  MOVING: "border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10",
  CHURNING: "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10",
  STORMING: "border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10",
  "NO SPAN": "border-[#3a4530] text-[#c9d4bd] bg-black/30",
};

/** The pace word's tone (R132) — the quiet hand's severity ladder, read
 *  in reverse: a STACCATO board is the restless one (rose), a SPARSE
 *  board the calm one (sage). The pace measures the gaps between the
 *  board's words, never the record's kills. */
const PACE_TONE: Record<LedgerPaceWord, string> = {
  STACCATO: "border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10",
  BRISK: "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10",
  STEADY: "border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10",
  SPARSE: "border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10",
  "NO GAPS": "border-[#3a4530] text-[#c9d4bd] bg-black/30",
};

function stampOf(iso: string): string {
  return iso.length >= 19 ? iso.slice(11, 19) : iso;
}

/** R156 · THE HOUSE REMEMBERS ITS FOLDS: the watchboard's fold
 *  states (the mover ladder, the kept company's full roll) ride the
 *  session — a reload or a route's return lands the reads the way
 *  the reader left them, instead of resetting every surface to
 *  folded. R157 · THE WIDENED MEMORY: the family grows to every
 *  foldable surface — the cadence compass, the below, the paired
 *  companies, the turnover enders — six keys, one record, the parse
 *  and the record lifted into the ENGINE (parseFolds / foldRecord,
 *  the laws the suite holds). sessionStorage, guarded for the server
 *  render (the restore only ever opens — the folded default stays
 *  the honest default; a hydration mismatch is impossible because
 *  the server and the first client render agree on closed, and the
 *  restore is a post-mount effect's own read). */
const FOLD_MEMORY_KEY = "vvu.watchboard.folds.v1";

// R159 · THE ESTATE'S MEMORY: the record's second home — the reader's
// explicit opt-in lets the fold record mirror BEYOND the tab (localStorage,
// shared by every tab of the estate). The consent keys are the write's own
// law: no opt-in, no mirror; withdrawal erases the estate's copy. The
// session record stays the tab's own voice — the estate is only ever
// ADOPTED by a tab that has no record of its own (adoptFoldMemory's law,
// the engine's, suite-held).
const ESTATE_MEMORY_KEY = "vvu.watchboard.folds.estate.v1";
const ESTATE_OPTIN_KEY = "vvu.watchboard.folds.estate.optin";
// R168 · THE HELD CLOCK: when the consent was given — the stamp the
// consent's voice reads when no mirror exists yet (a consent with no
// mirror is young forever, and now it says how long it has been
// young). Written at opt-in, removed at withdraw — never guessed.
const ESTATE_OPTIN_SINCE_KEY = "vvu.watchboard.folds.estate.optin.since";

function readEstateOptIn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ESTATE_OPTIN_KEY) === "on";
  } catch {
    return false;
  }
}

const TAB_ID_KEY = "vvu.watchboard.tab.id";

/** R161 · THE WRITER'S STAMP: this tab's own name — minted once per
 *  tab lifetime (sessionStorage dies with the tab, exactly like its
 *  memory), four hex of identity, so the estate's copy can say whose
 *  hands last wrote it. A broken store mints anonymously per call —
 *  the stamp is provenance garnish, never a correctness dependency. */
function getTabId(): string {
  try {
    const existing = window.sessionStorage.getItem(TAB_ID_KEY);
    if (existing) return existing;
    const minted = `tab-${Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, "0")}`;
    window.sessionStorage.setItem(TAB_ID_KEY, minted);
    return minted;
  } catch {
    return "tab-anon";
  }
}

/** The tab's record AS IT STANDS, the adoption riding inside: a fresh
 *  tab (no session record) that opted in adopts the estate's record —
 *  verbatim, and written INTO the session (adoption is ownership: the
 *  estate never re-leads over a tab that can speak for itself). A
 *  broken session record adopts the same way (the estate's whole
 *  voice beats a broken one). Broken stores read as absence — the
 *  folded default stays the honest default through any failure.
 *  R160 · THE ADOPTED VOICE: the read also records its ORIGIN (the
 *  engine's foldMemoryOrigin — the same law the adoption applies), so
 *  the surfaces can say WHOSE memory they restored (own / adopted /
 *  none) — one flag per read, read back by lastFoldOrigin. */
let lastReadOrigin: FoldMemoryOrigin = "none";
let originCaptured = false;

function lastFoldOrigin(): FoldMemoryOrigin {
  return lastReadOrigin;
}

function sessionRecordRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const session = window.sessionStorage.getItem(FOLD_MEMORY_KEY);
    const estate = readEstateOptIn() ? window.localStorage.getItem(ESTATE_MEMORY_KEY) : null;
    const origin = foldMemoryOrigin(session, estate);
    // R160 · THE ADOPTED VOICE: the ARRIVAL story is captured ONCE per
    // tab lifetime — the first read that finds a memory names its
    // origin, and the whispers keep that story even after the adoption
    // writes the session (the later reads ride the tab's own,
    // already-owned record; they do not rewrite how it arrived).
    if (!originCaptured && origin !== "none") {
      lastReadOrigin = origin;
      originCaptured = true;
    }
    const adopted = adoptFoldMemory(session, estate);
    if (adopted !== null && adopted !== session) {
      try {
        window.sessionStorage.setItem(FOLD_MEMORY_KEY, adopted);
      } catch {
        // the adoption stays a read when the session store refuses —
        // the parse still rides the adopted record for this mount
      }
    }
    return adopted;
  } catch {
    return null;
  }
}

function readRememberedFolds(): Record<FoldName, boolean> {
  if (typeof window === "undefined") return foldRecord({});
  try {
    // R157 · the parse is the ENGINE's (parseFolds — the same laws
    // the suite holds). R159 · the read now rides the adoption
    // (sessionRecordRaw): a fresh opted-in tab starts from the
    // estate's memory, its own record still wins whenever it has one.
    return parseFolds(sessionRecordRaw());
  } catch {
    return foldRecord({});
  }
}

/** R158 · THE DATED MEMORY: the WHEN read — the same record read for
 *  the stamps (when each fold was left open). A v1 record has no
 *  when; the absence is honest. */
function readRememberedStamps(): Partial<Record<FoldName, string>> {
  if (typeof window === "undefined") return {};
  try {
    // R159 · the same adoption-aware read (sessionRecordRaw) — the
    // stamps and the openness can never disagree about which record
    // they read.
    return foldStamps(sessionRecordRaw());
  } catch {
    return {};
  }
}

/** R160 · THE CONSENT SURFACE's read: the tab's record as the panel
 *  shows it — a PURE read (no adoption write inside a render), the
 *  session's own bytes, parsed for the ledger. Broken stores read as
 *  absence (the panel says the house holds nothing — honestly). */
function panelRecordRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(FOLD_MEMORY_KEY);
  } catch {
    return null;
  }
}

/** The estate's copy, read PURE for the panel's live origin line (no
 *  consent logic here — the caller decides whether to look). */
function panelEstateRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ESTATE_MEMORY_KEY);
  } catch {
    return null;
  }
}

/** R168 · THE HELD CLOCK, read: minutes since the consent was given
 *  (the since-stamp's own date); null for every silence — no stamp
 *  (a pre-R168 consent), a broken stamp, no window — the voice says
 *  nothing it cannot read. */
function estateHeldMin(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const since = window.localStorage.getItem(ESTATE_OPTIN_SINCE_KEY);
    if (since === null) return null;
    const t = Date.parse(since);
    if (!Number.isFinite(t)) return null;
    return Math.max(0, (Date.now() - t) / 60000);
  } catch {
    return null;
  }
}

function rememberFold(name: FoldName, open: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(FOLD_MEMORY_KEY);
    const obj: Record<string, unknown> =
      raw !== null ? (JSON.parse(raw) as Record<string, unknown>) : {};
    // R158 · THE DATED MEMORY: an OPEN fold writes WHEN the reader
    // left it (the instant of their own click); a closed fold writes
    // false — the when erased with the opening. stampedRecord strips
    // to the six known keys (the session never accumulates junk) and
    // normalizes junk values to the closed they would read as.
    const record = stampedRecord({
      ...(obj as Partial<Record<FoldName, FoldValue>>),
      [name]: open ? new Date().toISOString() : false,
    });
    const out = JSON.stringify(record);
    window.sessionStorage.setItem(FOLD_MEMORY_KEY, out);
    // R159 · THE ESTATE'S MEMORY: the mirror is the CONSENT's own
    // act — with the opt-in on, the same record rides the estate's
    // store (the memory outliving the tab); without it, the write is
    // session-local exactly as before. No opt-in, no mirror.
    // R162 · THE MIRROR'S OWN LAW: folds from the session's record as
    // it stands, provenance from the write, and the LOG from the
    // estate store's own history (this write appended) — the log is
    // the store's story, never a one-entry stub.
    if (readEstateOptIn()) {
      const mirrored = mirrorEstateRecord(
        out,
        window.localStorage.getItem(ESTATE_MEMORY_KEY),
        getTabId(),
      );
      window.localStorage.setItem(ESTATE_MEMORY_KEY, mirrored ?? out);
    }
  } catch {
    // a private mode's quota or a broken store — the fold stays a
    // session-local read, the memory's absence is silent
  }
}

/** The hand's dot classes — ONE visual vocabulary for the freshness
 *  hands wherever they sit (the kept rows' R155 dots, the digest's
 *  R156 tension dots): freshest solid teal + glow, in-rhythm teal
 *  at rest, drifted the dim olive-gray of a voice grown distant. */
const HAND_DOT_CLS: Record<Exclude<FreshnessHand, never>, string> = {
  freshest: "bg-[#7ac8d0] shadow-[0_0_4px_rgba(122,200,208,0.6)]",
  "in-rhythm": "bg-[#7ac8d0]/60",
  drifted: "bg-[#5f6e55]",
};

/** The hand's word color — the unfold button's company counts wear
 *  their own hand's tone (R156). */
const HAND_WORD_CLS: Record<Exclude<FreshnessHand, never>, string> = {
  freshest: "text-[#7ac8d0]",
  "in-rhythm": "text-[#7ac8d0]/80",
  drifted: "text-[#7a8a6e]",
};

export function Watchboard() {
  const [board, setBoard] = useState<WatchboardRead | null>(null);
  // R171 · THE BRIDGE'S READER: the estate reads its own canonical
  // clock (docs/data/clock.json via GET /api/vvu/clock) — the
  // operator's useClock hook verbatim (15s refetch, no-store,
  // fail-closed). READ-ONLY by law: the writers' set is the
  // operator's; the estate's glass only witnesses. Hooks live at the
  // component's top level — the chip renders from this read below.
  const bridgeClock = useClock();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [builtAt, setBuiltAt] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerSummary | null>(null);
  const [silence, setSilence] = useState<SilenceRead | null>(null);
  const [weightRead, setWeightRead] = useState<WeightLadderRead | null>(null);
  const [ledgerErr, setLedgerErr] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // R159 · THE ESTATE'S MEMORY: the toggle's own state — read post-mount
  // (the server and the first render agree on OFF; a hydration mismatch
  // stays impossible, the consent is a client-side read).
  const [estateOn, setEstateOn] = useState(false);
  // R153 · THE MOVER LADDER's fold: the top mover chip unfolds the
  // tail's three heaviest movers on demand — a state like the
  // compass's own, foldable back. R156 · THE HOUSE REMEMBERS ITS
  // FOLDS: both folds ride the session (restored post-mount, server
  // and first render agree on closed — no hydration mismatch); the
  // restored cue says the fold was remembered, not re-derived.
  const [moverLadderOpen, setMoverLadderOpen] = useState(false);
  const [moverLadderRemembered, setMoverLadderRemembered] = useState(false);
  // R158 · THE DATED MEMORY: the WHEN the reader left the ladder
  // open (read from the v2 record at restore; a v1 record has no
  // when — the whisper stays the R157 sentence verbatim).
  const [moverLadderLeftAt, setMoverLadderLeftAt] = useState<string | null>(null);
  // R160 · THE ADOPTED VOICE: whether this tab's memory was ADOPTED
  // from the estate (a fresh tab's arrival) — the whisper and the
  // cues say whose memory they restored.
  const [moverLadderAdopted, setMoverLadderAdopted] = useState(false);
  // R160 · THE CONSENT SURFACE: the estate panel's own open state —
  // the toggle's pill opens the memory's ledger beside it.
  const [estatePanelOpen, setEstatePanelOpen] = useState(false);
  // the ledger's re-read tick — a per-fold eraser bumps it so the
  // panel's next render re-reads the record (the read itself stays a
  // render-time read, never a cached one)
  const [estateLedgerTick, setEstateLedgerTick] = useState(0);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const samplingRef = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const depthRef = useRef(24);
  /** THE STILL SPEAKS (R133): the previous read's silence — who was
   *  still, and the quiet the read held for them. The comparison set
   *  for the sampler-driven reads; a depth change overwrites it
   *  WITHOUT speaking (a wider reach is not a row speaking). */
  const silenceRef = useRef<Map<string, SilenceEntry>>(new Map());
  /** THE FIRST WORD SPEAKS (R135): the previous read's births — the
   *  rows the tail had heard BEGIN, as ids (not stamps: a row whose
   *  earliest flip ages out still has a birth — a later flip becomes
   *  its first word, and that is not a new row being born). Armed by
   *  the first read; a depth change overwrites WITHOUT speaking. */
  const birthsRef = useRef<Set<string>>(new Set());
  const birthsArmedRef = useRef(false);

  /** refreshDepth — the depth read (GET, store-only) with the silence
   *  riding it (R133). The display's ONE reader: the sampler records,
   *  the depth read answers — the lane renders from this and nothing
   *  else, so its counts can never disagree with themselves. */
  const refreshDepth = useCallback(async (take: number, viaSampler = false) => {
    try {
      const res = await fetch(`/api/estate/watchboard/ledger?take=${take}&silence=1`, {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok: boolean;
        ledger?: LedgerSummary;
        silence?: SilenceRead | null;
        weights?: WeightLadderRead | null;
        error?: string;
      };
      if (json.ok && json.ledger) {
        // THE STILL SPEAKS (R133) — the silence's live edge. Only a
        // sampler-driven read (SAME depth, time moved) may speak: a
        // depth change widens the reach, and a row heard by a wider
        // reach did not just speak. The toast names the ROW and its
        // words, and quotes the quiet the PREVIOUS read held (measured
        // to that read's own stamp) — the mirror rule holds: no word
        // of it says KILL, even when the silence ended on a reset.
        if (viaSampler && silenceRef.current.size > 0) {
          const chrono = [...json.ledger.flips].sort((a, b) => a.at.localeCompare(b.at));
          const byRow = new Map<string, { name: string; flip: BoardFlip; quiet: number | null }>();
          for (const f of chrono) {
            const prev = silenceRef.current.get(f.id);
            if (prev) byRow.set(f.id, { name: f.name, flip: f, quiet: prev.quietSinceMin ?? null });
          }
          const spoken = [...byRow.values()];
          if (spoken.length > 3) {
            toast(`THE STILL SPEAKS — ${spoken.length} rows left the silence`, {
              description: `${spoken.map((s) => s.name).join(" · ")} — heard within the open depth (${take} moved samples)`,
            });
          } else {
            for (const s of spoken) {
              toast(`THE STILL SPEAKS — ${s.name}`, {
                description: `${s.flip.from} → ${s.flip.to} @ ${stampOf(s.flip.at)} UTC — heard within the open depth (${take} moved samples); the previous read held it quiet ${s.quiet !== null ? `${s.quiet >= 100 ? Math.round(s.quiet) : s.quiet.toFixed(1)}′` : "—"}`,
              });
            }
          }
        }
        setLedger(json.ledger);
        setSilence(json.silence ?? null);
        silenceRef.current = new Map((json.silence?.entries ?? []).map((e) => [e.id, e]));
        setWeightRead(json.weights ?? null);
        // THE FIRST WORD SPEAKS (R135) — the births' live edge, read
        // from the SAME read the lane renders. Only a sampler-driven
        // read (SAME depth, time moved) may speak, and only once the
        // comparison set is armed by a previous read; the fire happens
        // BEFORE the overwrite (the previous set is the comparison).
        // Births are compared by ROW ID — a row whose earliest flip
        // aged out still has a birth (a later flip becomes its first
        // word); a NEW id is a row the open depth had never heard.
        const fws = firstWords(json.ledger.flips);
        const birthIds = new Set(fws.map((b) => b.flip.id));
        if (viaSampler && birthsArmedRef.current) {
          const firstFlipOf = new Map(fws.map((b) => [b.flip.id, b.flip]));
          const newborns = [...birthIds].filter((id) => !birthsRef.current.has(id));
          const spokenBirths = newborns
            .map((id) => firstFlipOf.get(id))
            .filter((f): f is BoardFlip => f !== undefined);
          if (spokenBirths.length > 3) {
            toast(`THE FIRST WORDS — ${spokenBirths.length} rows spoke for the first time`, {
              description: `${spokenBirths.map((f) => f.name).join(" · ")} — heard within the open depth (${take} moved samples)`,
            });
          } else {
            for (const f of spokenBirths) {
              toast(`THE FIRST WORD — ${f.name}`, {
                description: `${f.from} → ${f.to} @ ${stampOf(f.at)} UTC — the tail heard this row for the first time within the open depth (${take} moved samples)`,
              });
            }
          }
        }
        birthsRef.current = birthIds;
        birthsArmedRef.current = true;
        setLedgerErr(null);
      } else {
        setLedgerErr(json.error ?? "the depth read refused");
      }
    } catch (e) {
      setLedgerErr(e instanceof Error ? e.message : "the depth read refused");
    }
  }, []);

  const sampleLedger = useCallback(async () => {
    if (samplingRef.current) return;
    samplingRef.current = true;
    try {
      const res = await fetch("/api/estate/watchboard", { method: "POST", cache: "no-store" });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
      };
      if (json.ok) {
        // The POST records the sample (the server composes the board,
        // signature dedupe); the display follows the depth read —
        // the R130 split, now uniform at every depth (R133): one
        // reader, one truth, the silence riding the same read. The
        // sampler provenance arms THE STILL SPEAKS (same depth, time
        // moved — the only honest window for a row leaving silence).
        await refreshDepth(depthRef.current, true);
      } else {
        setLedgerErr(json.error ?? "the sampler refused");
      }
    } catch (e) {
      setLedgerErr(e instanceof Error ? e.message : "the sampler refused");
    } finally {
      samplingRef.current = false;
    }
  }, [refreshDepth]);

  const fetchLedgerDepth = useCallback(
    (take: number) => {
      depthRef.current = take;
      void refreshDepth(take);
    },
    [refreshDepth],
  );

  const refetch = useCallback(
    async (announce?: boolean) => {
      setBusy(true);
      try {
        const res = await fetch("/api/estate/watchboard", { cache: "no-store" });
        const json = (await res.json()) as {
          ok: boolean;
          board?: WatchboardRead;
          builtAt?: string;
          error?: string;
        };
        if (!json.ok || !json.board) {
          setError(json.error ?? "the watchboard read failed");
        } else {
          setBoard(json.board);
          setError(null);
          setBuiltAt(json.builtAt ?? null);
          void sampleLedger();
          if (announce) {
            // R181 · THE REREAD'S RETURN: the ASKED read's completion —
            // the button wears the house lime for REREAD_HOME_MS and the
            // sibling live region speaks the census line once. A failed
            // read never says home; the unasked passes (mount, 60s
            // interval) stay silent — the completion belongs to the
            // click. The timer is a ref — a dismount mid-flash cleans
            // up after itself.
            setJustRead(true);
            if (justReadTimerRef.current !== null) clearTimeout(justReadTimerRef.current);
            justReadTimerRef.current = setTimeout(() => setJustRead(false), REREAD_HOME_MS);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "the watchboard read failed");
      } finally {
        setBusy(false);
      }
    },
    [sampleLedger],
  );

  /** R181 · THE REREAD'S RETURN: the asked read's home-flash state —
   *  lime on the button, the census line in the sibling live region,
   *  both lit only by a clicked read's SUCCESS, both gone after
   *  REREAD_HOME_MS (the window's own named constant). */
  const [justRead, setJustRead] = useState(false);
  const justReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (justReadTimerRef.current !== null) clearTimeout(justReadTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    void refetch();
    const t = setInterval(() => void refetch(), 60_000);
    return () => clearInterval(t);
  }, [refetch]);

  // R176 · THE DURABLE SEED: dev-only, flag-armed — when the devseed
  // flag is 'on' AND both stores are silent (no session record, no
  // estate record), the named three-hand fixture lays down fresh
  // (its ages relative to the seed instant — the story replays at
  // any wall clock and ages live from there). A real memory —
  // session OR estate — is never touched: the estate speaks for
  // itself whenever it can. Production is a no-op; a broken store
  // stays broken (the seed never fights the reader). Runs BEFORE
  // the first read effect, so a seeded fresh tab ADOPTS its own
  // seed — the arrival story, the greeting, the writer line, the
  // row glyph, the legend arc: the whole QA story, live.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (typeof window === "undefined") return;
    try {
      const flag = window.localStorage.getItem(DEV_SEED_FLAG_KEY);
      if (flag !== "on" && flag !== "session") return;
      const session = window.sessionStorage.getItem(FOLD_MEMORY_KEY);
      const estate = window.localStorage.getItem(ESTATE_MEMORY_KEY);
      // R178 · THE SESSION VARIANT: flag 'session' lays the tab's OWN
      // story into the SESSION store (no optin, no adoption — origin
      // 'own', no greeting, no arrival clause). Same never-overwrite
      // law: a session that can speak for itself is never touched.
      if (flag === "session") {
        if (session !== null) return;
        window.sessionStorage.setItem(
          FOLD_MEMORY_KEY,
          buildSessionSeedFixture(new Date(), getTabId()),
        );
        return;
      }
      if (session !== null || estate !== null) return;
      const seed = buildDevSeedFixture(new Date());
      window.localStorage.setItem(ESTATE_OPTIN_KEY, seed.optin);
      window.localStorage.setItem(ESTATE_MEMORY_KEY, seed.record);
    } catch {
      // the reader's broken store is not the seed's business
    }
  }, []);

  // R156 · THE HOUSE REMEMBERS ITS FOLDS: one post-mount read of the
  // session's remembered folds — only ever OPENING (the folded
  // default stays the honest default; the restore is the memory's
  // own read, never a re-derivation). The remembered cue rides so
  // the restored ladder can say it was remembered. The kept
  // company's fold lives in BoardLedger — it remembers its own
  // (a fold belongs to the surface that holds it).
  useEffect(() => {
    const folds = readRememberedFolds();
    if (folds.moverLadder) {
      setMoverLadderOpen(true);
      setMoverLadderRemembered(true);
      setMoverLadderLeftAt(readRememberedStamps().moverLadder ?? null);
      // R160 · THE ADOPTED VOICE: the origin read right after this
      // effect's own read — the whisper says whose memory it was.
      setMoverLadderAdopted(lastFoldOrigin() === "adopted");
    }
  }, []);

  // R159 · THE ESTATE'S MEMORY: the consent's own read (post-mount —
  // the toggle renders OFF until the client can honestly read the
  // estate's store).
  useEffect(() => {
    setEstateOn(readEstateOptIn());
  }, []);

  /** R159 · THE ESTATE'S TOGGLE: on — the consent is written and the
   *  CURRENT session record mirrors immediately (the estate starts
   *  from what this tab holds); off — the consent is withdrawn AND
   *  the estate's record is erased (a withdrawn memory is an erased
   *  memory; the session's own copy is untouched either way). */
  const toggleEstate = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      if (readEstateOptIn()) {
        window.localStorage.removeItem(ESTATE_OPTIN_KEY);
        window.localStorage.removeItem(ESTATE_OPTIN_SINCE_KEY);
        window.localStorage.removeItem(ESTATE_MEMORY_KEY);
        setEstateOn(false);
      } else {
        window.localStorage.setItem(ESTATE_OPTIN_KEY, "on");
        // R168 · THE HELD CLOCK: the consent is stamped the moment it
        // is given — the voice reads it when no mirror exists yet.
        window.localStorage.setItem(ESTATE_OPTIN_SINCE_KEY, new Date().toISOString());
        const raw = window.sessionStorage.getItem(FOLD_MEMORY_KEY);
        if (raw !== null) {
          // R162 · THE MIRROR'S OWN LAW: the initial mirror is a write
          // like any other — this tab signs it, the store's log
          // remembers the hands that wrote before this one
          const mirrored = mirrorEstateRecord(
            raw,
            window.localStorage.getItem(ESTATE_MEMORY_KEY),
            getTabId(),
          );
          window.localStorage.setItem(ESTATE_MEMORY_KEY, mirrored ?? raw);
        }
        setEstateOn(true);
      }
    } catch {
      // a broken store — the toggle stays a session-local read, the
      // estate's absence is silent exactly like the memory's
    }
  }, []);

  // R177 · THE ASKED CONSENT: the switch's destructive side learns to
  // ASK — the first click on 'withdraw consent' ARMS (the button wears
  // the ask: 'confirm erase', the danger tint, the voice naming the
  // second click and the boundary); the second click inside the window
  // commits; the window escapes itself after WITHDRAW_ARMED_MS. The
  // non-destructive side never asks (let-it-ride commits at once).
  // The timer is a ref — a dismount mid-ask cleans up after itself.
  const [withdrawArmed, setWithdrawArmed] = useState(false);
  const withdrawTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disarmWithdraw = useCallback(() => {
    if (withdrawTimerRef.current !== null) {
      clearTimeout(withdrawTimerRef.current);
      withdrawTimerRef.current = null;
    }
    setWithdrawArmed(false);
  }, []);
  const handleEstateSwitch = useCallback(() => {
    if (!estateOn) {
      toggleEstate();
      return;
    }
    if (!withdrawArmed) {
      setWithdrawArmed(true);
      if (withdrawTimerRef.current !== null) clearTimeout(withdrawTimerRef.current);
      withdrawTimerRef.current = setTimeout(disarmWithdraw, WITHDRAW_ARMED_MS);
      return;
    }
    disarmWithdraw();
    toggleEstate();
  }, [estateOn, withdrawArmed, toggleEstate, disarmWithdraw]);
  useEffect(() => {
    return () => {
      if (withdrawTimerRef.current !== null) clearTimeout(withdrawTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const rows = board?.rows ?? [];
  const hotRows = rows.filter((r) => r.tone === "amber" || r.tone === "rose");
  const amberRows = hotRows.length;
  // R130 — the present ↔ memory cross-link: each hot row's flip count in
  // the ledger's tail, rendered as a tiny badge on its digest chip. The
  // badge reads the LEDGER's census (the words' recorded motion), never
  // a forecast — a row with no recorded flips shows no badge.
  // R151 · THE MOVE'S FACE's census: each row's FRESHEST recorded flip
  // rides beside its count (a chronological max by Date.parse, never a
  // string compare — the fresh hand's own law), so the digest's motion
  // badge reads recency, not just volume.
  const flipCensus = useMemo(() => {
    const m = new Map<string, { count: number; newestAt: string | null; newestMs: number }>();
    for (const f of ledger?.flips ?? []) {
      const cur = m.get(f.id) ?? { count: 0, newestAt: null, newestMs: -Infinity };
      cur.count += 1;
      const ms = Date.parse(f.at);
      if (Number.isFinite(ms) && ms > cur.newestMs) {
        cur.newestMs = ms;
        cur.newestAt = f.at;
      }
      m.set(f.id, cur);
    }
    return m;
  }, [ledger]);

  // R151 · THE MOVE'S FACE: the ledger tail's freshest flip, with its
  // owner named — one pass, a chronological max by Date.parse (never a
  // string compare), first-seen wins a tie on the tail's own order.
  // The third face's freshness: the kept census's fresh chip says who
  // came HOME last, the striking census's says who STRUCK last — this
  // says who simply MOVED last. The render-frame policy: this
  // component's own render is its clock (no timer, no wall-clock
  // promise — the age is the render's read).
  const digestNow = Date.now();
  const digestFresh = (() => {
    let best: { id: string; name: string; at: string; ms: number } | null = null;
    for (const f of ledger?.flips ?? []) {
      const ms = Date.parse(f.at);
      if (!Number.isFinite(ms)) continue;
      if (!best || ms > best.ms) best = { id: f.id, name: f.name, at: f.at, ms };
    }
    return best;
  })();

  // R156 · THE SHARED HAND'S SECOND FACE: the digest's hot rows wear
  // the SAME freshness vocabulary the kept rows speak — the engine's
  // hotHands read (each id's newest stamp judged against the tail's
  // freshest flip, the TAIL's median gap as the yardstick). The
  // digest adds no arithmetic — it names the read, the dot says the
  // degree, the title carries the delta and the yardstick verbatim.
  const hotHandsRead = useMemo(() => hotHands(ledger?.flips ?? []), [ledger]);

  // R160 · THE CONSENT SURFACE's ledger: the tab's own record read at
  // THIS render (the eraser's tick bumps a re-render; the read never
  // caches) — the open folds, their whens, the memory's origin.
  const estateLedger = estatePanelOpen
    ? (() => {
        void estateLedgerTick; // the eraser's re-read tick — this read is per render
        const raw = panelRecordRaw();
        const folds = parseFolds(raw);
        return {
          open: FOLD_NAMES.filter((n) => folds[n]),
          stamps: foldStamps(raw),
          // the LIVE store status (the engine's own law on the
          // current bytes — never a stale mount snapshot)
          origin: foldMemoryOrigin(raw, panelEstateRaw()),
          // how the record ARRIVED at this tab's restore (the
          // snapshot the whispers and cues speak from)
          restoredAs: lastFoldOrigin(),
        };
      })()
    : null;

  // R158 · THE DATED MEMORY's second face: the kept story over the
  // WHOLE tail (the export's own scope — its shape line speaks the
  // whole tail too), so the clipboard can carry the company's hands
  // beside the shape. The BoardLedger keeps its own depth-filtered
  // read for its surfaces; the export speaks the tail itself.
  const keptForExport = useMemo(() => (ledger ? keptStory(ledger.flips) : null), [ledger]);

  // R154 · THE MOVER LADDER, LIFTED: R153's UI-side census moved INTO
  // the engine (moverLadder) — same single pass, same house order —
  // and the read now speaks its SHAPE: the verdict, one word judged
  // against the even seat (1/k — what every mover would hold if the
  // tail's motion spread evenly). The digest names the read, adds no
  // arithmetic — one truth, the ledger's own.
  const moverRead = useMemo(() => moverLadder(ledger?.flips ?? []), [ledger?.flips]);
  const tailFlips = moverRead.flips;

  const focusRow = useCallback((id: string) => {
    const el = rowRefs.current.get(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 2400);
  }, []);

  // R157 · THE CLIPBOARD'S VOICE: the digest's text is the ENGINE's
  // digestExport — the same reads the surfaces compute (the freshness
  // hands, the unrecorded confession, the ladder's verdict) ride the
  // clipboard. The component keeps the clipboard mechanics only.
  const copyDigest = useCallback(async () => {
    if (!board || !builtAt) return;
    // R159 · THE ESTATE'S MEMORY: the footer speaks the tab's own
    // record AS IT STANDS AT THE CLICK (the session's, adopted estate
    // included) — read here, not cached, so the copy is always the
    // reader's present truth.
    const memoryRaw =
      typeof window !== "undefined" ? window.sessionStorage.getItem(FOLD_MEMORY_KEY) : null;
    const text = digestExport({
      builtAt,
      rows: board.rows,
      ledger: ledger ? { samples: ledger.samples, flips: ledger.flips } : null,
      kept: keptForExport
        ? {
            rows: keptForExport.rows.map((r) => ({
              id: r.id,
              name: r.name,
              freshness: r.freshness,
            })),
          }
        : null,
      memory: memoryRaw,
      // R161 · THE ARRIVAL STORY: the footer's last word says when the
      // memory ARRIVED by adoption — read from the CAPTURED first-mount
      // origin (a live re-read would say 'own': the adoption wrote the
      // session, that is the adoption)
      memoryAdopted: lastFoldOrigin() === "adopted",
    });
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard API refused (permissions/insecure ctx) — the textarea
      // fallback is the honest second attempt, not a different feature
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        // both refused — the button is a convenience, the board itself
        // never depends on it; no invented success state is shown
        document.body.removeChild(ta);
        return;
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [board, builtAt, ledger, keptForExport]);

  return (
    <section
      className="mt-1.5 border border-[#3a4530]/60 bg-black/30 p-2 rounded-sm"
      data-testid="standing-watchboard"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Radar className="h-3 w-3 text-[#00d4e0]" aria-hidden />
        <h3 className="vvu-label text-[7px] font-bold tracking-[0.16em] text-[#c9d4bd]">
          THE WATCHBOARD · THE STANDING WATCHES, COMPILED
        </h3>
        {amberRows > 0 && (
          <span
            className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10 cursor-help transition-[filter] hover:brightness-125"
            title="rows riding an amber/rose tension right now — the round's open questions, live; the digest below names them in reading order"
          >
            {amberRows} LIVE TENSION{amberRows === 1 ? "" : "S"}
          </span>
        )}
        <span
          className="vvu-label text-[6px] text-[#5f6e55] cursor-help"
          title="the board's own build stamp — the rows' reads are as old as this stamp"
        >
          {builtAt ? `READ ${builtAt.slice(11, 19)} UTC` : "READ —"}
        </span>
        {(() => {
          // R171 · THE BRIDGE'S READER: the canonical clock's chip —
          // the same record both environments read, witnessed on the
          // estate's own glass beside the board's read stamp. One
          // authority, many readers; the estate never writes.
          // Fail-closed: no data yet (first poll) → silent, never
          // guessing; an unreachable clock → amber, NO time, NO rev —
          // a stale value is the one thing this chip will never show.
          // R172 · THE BRIDGE'S TEMPO: the chip wears the writer's own
          // tempo law — the dot beats at the tier the clock's age sets
          // (young 2.4s, settling 4.8s, elder 7.2s), the tier wears
          // its name on the chip, and the title speaks the clock's
          // line (ageVoice's grammar + tierSinceVoice's since, ONE
          // law with the consent's dot). A first poll still in
          // flight breathes gently — a wait, not a verdict.
          const c = bridgeClock.data;
          const spoken =
            c?.ok === true && typeof c.revision === "number" && typeof c.current_utc === "string";
          const unreachable = !bridgeClock.isLoading && !spoken;
          const cAge = spoken ? clockAgeMin(c?.current_utc) : null;
          const cTier = clockTier(cAge);
          const cBeat = clockBeat(cAge);
          const cVoice = spoken ? clockSpokenVoice(c?.current_utc) : null;
          // R173 · THE HEARD TEMPO: the tier wears a HUE (young keeps
          // the R171 cyan, settling deepens to teal, elder cools to
          // slate) on the dot AND the tier word — the tempo class
          // visible before it is audible — and the chip's spoken line
          // becomes its aria-label: the screen reader hears what the
          // cursor learned. Unreachable and in-flight still speak
          // their honest states.
          const cHue = clockTierHue(cTier);
          const cAria = unreachable
            ? "the canonical clock — UNREACHABLE, failing closed: no time, no revision, never a stale value"
            : spoken
              ? `the canonical clock — ${cVoice ?? "its stamp does not read; the chip keeps its R171 beat and wears no tier name"}`
              : "the canonical clock — silent while the first poll is in flight";
          return (
            <span
              className={`vvu-label inline-flex items-center gap-1 px-1 py-px rounded-sm border text-[6px] cursor-help transition-[color,border-color,background-color] duration-300 ${
                unreachable
                  ? "border-[#e0a030]/60 bg-[#e0a030]/10 text-[#e0a030]"
                  : "border-[#7ac8d0]/25 bg-[#7ac8d0]/5 text-[#7ac8d0]/85 hover:border-[#7ac8d0]/45"
              }`}
              title={
                unreachable
                  ? `R171 · THE BRIDGE'S READER: the canonical clock is UNREACHABLE (${c?.error ?? "no read yet"}) — the chip fails closed: no time, no revision, never a stale value. Restore docs/data/clock.json and the chip recovers within one 15s poll. R175 · THE HONEST SHAPES: a silence wears its own mark — ◌ unreachable, ∙ waiting — never a tier's shape (the tiers are earned by time; the silences are honest absences).`
                  : `R171 · THE BRIDGE'S READER: the estate witnesses the canonical clock (docs/data/clock.json via GET /api/vvu/clock, every 15s, no-store) — one file, one authority, both environments read. The estate never writes: the writers' set is the operator's (dev-spreadsheet, production-dashboard). Now REV ${c?.revision} · ${c?.current_utc?.slice(11, 19)}Z · last advanced by ${c?.last_written_by ?? "—"}. R172 · THE BRIDGE'S TEMPO: ${cVoice ?? "the stamp does not read — the chip keeps its R171 beat and wears no tier name"}. R174 · THE TIER'S SHAPE: the tier wears a glyph beside its word — ◦ young, ◔ settling, ○ elder — the tempo readable without color (the word and the aria already speak it). R175 · THE HONEST SHAPES: a silence wears its own mark — ◌ unreachable, ∙ waiting — never a tier's shape (the tiers are earned by time; the silences are honest absences).`
              }
              aria-label={cAria}
              data-testid="clock-chip"
            >
              <span
                aria-hidden
                className={`inline-block h-1 w-1 rounded-full shrink-0 ${spoken ? "vvu-heartbeat" : unreachable ? "" : "vvu-clock-wait"}`}
                style={
                  spoken
                    ? { backgroundColor: cHue, animationDuration: `${cBeat}s` }
                    : { backgroundColor: "#e0a030" }
                }
                data-testid="clock-chip-dot"
              />
              {spoken ? (
                <>
                  {`CLOCK REV ${c?.revision} · ${c?.current_utc?.slice(11, 19)}Z`}
                  {cTier ? (
                    <>
                      {" · "}
                      <span style={{ color: cHue }}>
                        <span aria-hidden>{tierGlyph(cTier)}</span> {cTier}
                      </span>
                    </>
                  ) : null}
                </>
              ) : unreachable ? (
                <>
                  <span aria-hidden>{silenceGlyph("unreachable")}</span>
                  {" CLOCK UNREACHABLE"}
                </>
              ) : (
                <>
                  <span aria-hidden>{silenceGlyph("waiting")}</span>
                  {" CLOCK —"}
                </>
              )}
            </span>
          );
        })()}
        <button
          onClick={() => void refetch(true)}
          disabled={busy}
          aria-busy={busy}
          aria-label={rereadVoice(busy)}
          className={`vvu-label ml-auto flex items-center gap-1 border px-1.5 py-px text-[6px] font-bold transition-colors duration-200 disabled:opacity-50 ${
            justRead && !busy
              ? "border-[#c8ff00]/60 text-[#c8ff00] shadow-[0_0_6px_rgba(200,255,0,0.3)]"
              : "border-[#3a4530] text-[#7a8a6e] hover:border-[#4a5a3e] hover:text-[#c9d4bd]"
          } ${FOCUS_RING}`}
          title="re-read every watch's home engine (one route, one journal parse) — a read never appends; the ledger's sampler rides after it, separately. R177 · THE ASKED CONSENT: the button's state rides its aria — idle law and in-flight read, heard without hovering. R181 · THE REREAD'S RETURN: a clicked read that lands wears the lime and speaks its home line — the census in the board's own numbers — once, through the sibling live region; the unasked passes stay silent."
        >
          <RefreshCw className={`h-2 w-2 ${busy ? "animate-spin" : ""}`} aria-hidden />
          REREAD
        </button>
        <span aria-live="polite" className="sr-only">
          {justRead && !busy
            ? rereadVoice(false, { justRead: true, rows: rows.length, hot: hotRows.length })
            : ""}
        </span>
      </div>

      {(() => {
        // R161 · THE STANDING MEMORY: the consent surface's PERMANENT
        // home — the pill and the panel MOVED out of the tension digest
        // (R160's placement vanished with a calm board: hotRows.length
        // === 0 gated the whole header row). The memory is the reader's,
        // not the tensions' — it stands on the board whatever the read
        // holds, even before the first read lands. The state line is a
        // LIVE read of both stores (pure reads, no adoption write inside
        // a render); every fold click re-renders the board and re-reads.
        const raw = panelRecordRaw();
        const estateRaw = panelEstateRaw();
        const openCount = FOLD_NAMES.filter((n) => parseFolds(raw)[n]).length;
        const origin = foldMemoryOrigin(raw, estateRaw);
        const arrival = lastFoldOrigin();
        // R163 · THE STANDING GREETING: the arrival story, spoken where
        // it stands — the law now lives in the ENGINE (one law, the
        // suite's own cohort). It speaks while the memory is STILL
        // EXACTLY the adoption's bytes: the session record carries the
        // adopter's stamp, and it is NOT this tab's (the reader's own
        // writes strip the stamp — the greeting retires on the first
        // fold of the reader's own; a same-tab re-adoption stays
        // silent, honestly). R163's widening: the provenance SPOKEN —
        // `in tab-7c7a`, not `in another tab` — and the chip wears the
        // writer's hue (THE PROVENANCE'S COLORS: same tab, same color,
        // everywhere the hand appears).
        const greet = standingGreeting(raw, getTabId(), arrival);
        // R164 · THE READER'S OWN COLOR: while the consent stands, the
        // pill's dot wears THIS tab's hue (the memory that rides is
        // the reader's own record — the reader sees their own color
        // on the consent); the resting dot keeps the house's slate.
        const ownDot = consentDot(getTabId(), estateOn);
        // R166 · THE HEARTBEAT'S TEMPO: the beat slows as the estate
        // copy ages unwritten — THIS tab's own mirror clock (the log's
        // freshest own entry; a never-wrote adoption reads the flat
        // pair's writtenAt), tiered young/settling/elder.
        const tempo = heartbeatTempo(mirrorAge(panelEstateRaw(), getTabId()));
        // R167 · THE AUDIBLE CLOCK: the dot's hover NAMES the tier and
        // the age — the clock read without arithmetic.
        const mAge = mirrorAge(panelEstateRaw(), getTabId());
        return (
          <div
            className="mt-1.5 rounded-sm border border-[#b8a8d8]/20 border-l-2 border-l-[#b8a8d8]/45 bg-[#b8a8d8]/[0.045] px-2 py-1 transition-[border-color,background-color,box-shadow] duration-300 hover:border-[#b8a8d8]/35 hover:bg-[#b8a8d8]/[0.07]"
            style={greet !== null ? { borderLeftColor: fadingEdge(greet) ?? undefined } : undefined}
            data-testid="estate-standing-row"
          >
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span
                className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#b8a8d8]/90 cursor-help"
                title="R161 · THE STANDING MEMORY: the estate's memory has a permanent home on the board — no longer gated by the tension digest (a calm board lost the surface entirely). The pill opens the memory's ledger; the state line reads the stores live. The memory is the reader's, not the tensions'."
                data-testid="estate-standing-title"
              >
                ⌄ THE ESTATE'S MEMORY ·
              </span>
              <span
                className="vvu-label inline-flex flex-wrap items-center gap-x-[3px] gap-y-0.5 text-[5.5px] text-[#7a8a6e] cursor-help"
                title={`the standing state, read LIVE from the stores: ${estateOn ? "the estate rides — every fold click mirrors beyond this tab" : origin === "own" ? "session-local — the memory dies with this tab; the pill beside it opens the ledger that lets it ride" : origin === "adopted" ? "session-local — the estate holds a memory this tab could adopt" : "session-local — no memory anywhere yet"}${arrival === "adopted" ? " · this tab\u2019s memory ARRIVED by adoption at its first mount" : ""} R176 · THE STANDING STORY: the line\u2019s story rides its aria — the state, then the arrival — heard without hovering.`}
                aria-label={stateLineAria(estateOn, openCount, origin, arrival)}
                data-testid="estate-standing-state"
              >
                <span className="text-[#b8a8d8]/85">{estateOn ? "riding" : "session-local"}</span>
                <span aria-hidden className="text-[#5a6a50]">
                  ·
                </span>
                <span>
                  {estateOn || origin === "own"
                    ? `${openCount} fold${openCount === 1 ? "" : "s"} held`
                    : origin === "adopted"
                      ? "the estate holds a memory"
                      : "no memory yet"}
                </span>
                {arrival === "adopted" && (
                  <span className="rounded-sm border border-[#b8a8d8]/25 bg-[#b8a8d8]/5 px-1 py-px text-[#b8a8d8]/75">
                    arrived adopted
                  </span>
                )}
              </span>
              {(() => {
                // R166 · THE STORY'S COLORS + R167 · THE RESTING DOT +
                // R168 · THE SETTLING ARC: the estate log's own first
                // and last hands, standing on the row itself — the
                // LAST hand dimming as the copy rests unwritten (the
                // copyAge clock), and now the FIRST hand dims too at
                // the older, slower pace (the headAge clock — the
                // origin rests half as fast and never as deep: the
                // story's beginning holds). A single-hue glyph stays
                // the last hand's surface (one dot, one law).
                // An empty log wears nothing.
                const estateRaw = panelEstateRaw();
                const log = readEstateStamps(estateRaw);
                if (log.length === 0) return null;
                const glyph = hueLegendGlyph(log);
                const rest = glyphRest(copyAge(estateRaw));
                const originRest = firstHandRest(headAge(estateRaw));
                return (
                  <span
                    className="inline-flex items-center gap-0.5 cursor-help"
                    title={`R166 · THE STORY'S COLORS: the memory's log, its first and last hands standing on the row — the same hues everywhere (the legend's law). R167 · THE RESTING DOT: the last hand's dim IS the copy's resting — the copy last heard a hand ${ageVoice(copyAge(estateRaw))}. R168 · THE SETTLING ARC: the first hand dims too, at the older slower pace — the opening heard a hand ${ageVoice(headAge(estateRaw))}, and it never rests deeper than the now. R174 · THE HEARD PARITY: the two dots' story rides the span's aria — the opening's clock and the tail's clock, heard without hovering.`}
                    aria-label={rowGlyphAria(estateRaw) ?? undefined}
                    data-testid="estate-row-glyph"
                  >
                    {glyph.map((c, gi) => (
                      <span
                        key={`row-glyph-${gi}`}
                        aria-hidden
                        className={`inline-block h-1 w-1 rounded-full shrink-0 transition-opacity ${gi === 0 && glyph.length === 2 ? "duration-700" : "duration-500"}`}
                        style={{
                          backgroundColor: c,
                          opacity:
                            gi === glyph.length - 1
                              ? rest
                              : gi === 0 && glyph.length === 2
                                ? originRest
                                : 1,
                        }}
                      />
                    ))}
                  </span>
                );
              })()}
              <button
                onClick={() => setEstatePanelOpen((o) => !o)}
                aria-pressed={estateOn}
                aria-expanded={estatePanelOpen}
                aria-label={`estate memory ${estateOn ? "on" : "off"} — ${consentSpokenVoice(mAge, estateHeldMin())}`}
                className={`vvu-label ml-auto inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[6px] font-bold tracking-[0.08em] cursor-pointer transition-[color,border-color,background-color,box-shadow] duration-200 hover:brightness-110 ${FOCUS_RING} ${
                  estateOn
                    ? "border-[#e0a030]/60 bg-[#e0a030]/10 text-[#e0a030] shadow-[0_0_6px_rgba(224,160,48,0.28)]"
                    : "border-[#3a4530] bg-black/30 text-[#7a8a6e] hover:border-[#4a5a3e] hover:text-[#c9d4bd]"
                }`}
                title={`R159 · THE ESTATE'S MEMORY: with this on, your fold record mirrors beyond the tab — a fresh tab (no record of its own) adopts the estate's memory, verbatim, and owns it from there (the session still wins whenever the tab can speak for itself). OFF withdraws the consent AND erases the estate's copy. R160 · THE CONSENT SURFACE: CLICK opens the memory's ledger — what the house holds, whose the memory is, the consent switch, and a fold-back per fold. R161 · THE STANDING MEMORY: this pill stands on the board — it no longer vanishes with a calm digest.`}
                data-testid="estate-memory-toggle"
              >
                <span
                  aria-hidden
                  title={`R167 · THE TEMPO'S NAME: the consent's beat, spoken — ${consentSpokenVoice(mAge, estateHeldMin())}${mAge !== null && tempoTier(mAge) !== "young" ? " (the tier’s own clock: it says when the beat crossed)" : ""}`}
                  className={`inline-block h-1 w-1 rounded-full transition-all duration-200 ${
                    ownDot !== null ? "vvu-heartbeat" : "bg-[#5f6e55]"
                  }`}
                  style={
                    ownDot !== null
                      ? {
                          backgroundColor: ownDot.color,
                          boxShadow: `0 0 4px ${ownDot.glow}`,
                          animationDuration: `${tempo}s`,
                        }
                      : undefined
                  }
                  data-testid="estate-pill-dot"
                />
                ESTATE {estateOn ? "ON" : "OFF"}
              </button>
            </div>
            {greet !== null && (
              <div className="mt-1 flex items-center gap-1 vvu-enter">
                <span
                  className="vvu-label inline-flex items-center gap-1 px-1 py-px rounded-sm border border-[#b8a8d8]/25 bg-[#b8a8d8]/5 text-[5.5px] text-[#b8a8d8]/85 cursor-help transition-[filter,border-color] duration-200 hover:brightness-110 hover:border-[#b8a8d8]/45"
                  style={
                    // R166 · ONE CLOCK, TWO SURFACES: the greeting's
                    // chip border ages with the row's edge — the same
                    // clock (the greeting's ageMin), the chip at its
                    // own softer strength (base 0.25, floor 0.08).
                    {
                      borderColor: tabHueColor(greet.by, fadingAlpha(greet, 0.25, 0.08) ?? 0.25),
                    }
                  }
                  title={`R163 · THE STANDING GREETING: the arrival story, spoken where it stands — this memory ADOPTED from the estate at this tab's first mount (another tab's read, owned from there; R160's voice, R161's home). R163 · THE PROVENANCE'S COLORS: the greeting names its hand (${greet.by}) and the dot wears its hue — the same tab always wears the same color, derived from the id's own characters, in every tab, in every session. It speaks while the memory is still exactly the adoption's bytes — a fold of your own retires it. R166 · THE TEMPO OF TRUST: this chip's border ages with the row's edge — one clock, two surfaces. R167 · THE HELD CLOCK: the copy last heard a hand ${ageVoice(copyAge(panelEstateRaw()))}; this tab ${ageVoice(mAge)}.`}
                  data-testid="estate-standing-greeting"
                >
                  <span
                    aria-hidden
                    className="inline-block h-1 w-1 rounded-full shrink-0"
                    style={{
                      backgroundColor: tabHueColor(greet.by),
                      boxShadow: `0 0 3px ${tabHueColor(greet.by, 0.7)}`,
                    }}
                  />
                  {greet.text}
                </span>
              </div>
            )}
            {hotRows.length === 0 &&
              (() => {
                // R163 · THE CALM FOOTER: when the digest is calm, the
                // memory line still stands — the reader's own record
                // (R159's footer voice) hosted where the memory lives,
                // so a quiet board is not a silent one. The clipboard's
                // footer and this line speak the ONE law; an empty
                // record stays silent (the chip never renders empty).
                const calm = foldMemoryFooter(raw, { adopted: arrival === "adopted" });
                if (calm === "") return null;
                return (
                  <div
                    className="mt-1 flex items-center gap-1 vvu-enter"
                    data-testid="estate-standing-calm-footer"
                  >
                    <span
                      className="vvu-label px-1 py-px rounded-sm border border-[#b8a8d8]/20 bg-black/20 text-[5.5px] text-[#b8a8d8]/70 cursor-help transition-[filter,border-color] duration-200 hover:brightness-110 hover:border-[#b8a8d8]/40"
                      title="R163 · THE CALM FOOTER: the digest is calm, but the memory line still stands — the reader's own fold record (R159's footer voice, the clipboard's own last line) hosted on the standing row, where the memory lives. A calm board is not a silent one."
                    >
                      {calm}
                    </span>
                  </div>
                );
              })()}
            {estatePanelOpen && estateLedger !== null && (
              // R160 · THE CONSENT SURFACE: the memory's ledger —
              // what the house holds, whose the memory is, the
              // consent switch beside the state line (see what rides
              // before you let it ride), and a fold-back per fold.
              <div
                className="vvu-enter mt-1.5 rounded-sm border border-[#3a4530]/60 bg-black/40 px-2 py-1.5"
                data-testid="estate-memory-panel"
              >
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span
                    className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#b8a8d8]/90 cursor-help"
                    title="R160 · THE CONSENT SURFACE: the estate's memory made visible — what the house holds, when each fold was left, whose the memory is (this tab's own or adopted from another tab), and a fold-back per fold. The consent switch rides beside the state line."
                  >
                    THE MEMORY'S LEDGER ·
                  </span>
                  <span
                    className={`vvu-label text-[5.5px] px-1 py-px rounded-sm border cursor-help transition-[filter] hover:brightness-125 ${
                      estateOn
                        ? "border-[#e0a030]/50 bg-[#e0a030]/10 text-[#e0a030]"
                        : "border-[#3a4530] bg-black/30 text-[#7a8a6e]"
                    }`}
                    title={
                      estateOn
                        ? "the estate rides — every fold click mirrors beyond this tab (localStorage, shared by the estate\u2019s tabs); a fresh tab adopts it when it has no record of its own"
                        : "session-local — the memory dies with this tab; the switch beside it lets it ride"
                    }
                    data-testid="estate-panel-state"
                  >
                    {estateOn ? "the estate rides" : "session-local"}
                  </span>
                  <span
                    className="vvu-label text-[5.5px] text-[#7a8a6e] cursor-help"
                    title={`the tab's record, read LIVE from the stores (the engine's own law): ${estateLedger.origin === "own" ? "OWN — this tab holds a whole record of its own" : estateLedger.origin === "adopted" ? "ADOPTED — no whole record here yet; the estate\u2019s would be adopted on the next read" : "NONE — no memory anywhere"}${estateLedger.restoredAs === "adopted" ? " · this tab\u2019s memory ARRIVED by adoption at its first mount (another tab\u2019s read, owned from there)" : ""}`}
                    data-testid="estate-panel-origin"
                  >
                    record: {estateLedger.origin}
                    {estateLedger.restoredAs === "adopted" && " · arrived adopted"}
                  </span>
                  {estateOn &&
                    (() => {
                      // R161 · THE WRITER'S STAMP: the estate's copy
                      // carries its own provenance — whose hands last
                      // wrote it, when. An unstamped copy is a v1
                      // memory (pre-R161) — said plainly, never guessed.
                      const eRaw = panelEstateRaw();
                      if (eRaw === null) return null;
                      const st = readEstateStamp(eRaw);
                      if (st === null) {
                        return (
                          <span
                            className="vvu-label text-[5.5px] text-[#7a8a6e]/80 italic cursor-help"
                            title="the estate's copy rides but carries no writer stamp — a v1 memory (pre-R161); the next fold click re-stamps it with this tab's id. R174 · THE HEARD PARITY: this honesty now rides the span's aria too — heard without hovering."
                            aria-label={unstampedWriterVoice(getTabId())}
                            data-testid="estate-panel-writer-unstamped"
                          >
                            · unstamped (a v1 memory)
                          </span>
                        );
                      }
                      return (
                        <span
                          className="vvu-label inline-flex items-center gap-1 text-[5.5px] text-[#b8a8d8]/60 cursor-help transition-[filter] hover:brightness-125"
                          title={`R161 · THE WRITER'S STAMP: the estate's copy carries its provenance — tab ${st.writtenBy} last wrote it at ${stampOf(st.writtenAt)} UTC. R163 · THE PROVENANCE'S COLORS: the dot wears the writer's hue — the same tab, the same color, everywhere the hand appears. Every mirror write re-stamps: the last write owns the record's provenance. R168 · THE WRITER'S CLOCK: ${writerSpokenVoice(eRaw, getTabId()) ?? "the copy’s clock is silent"}. R169 · THE HAND'S TINT: the clock words themselves wear the writer's hue — the words tinted by the hand that set them. R174 · THE HEARD PARITY: the full line — provenance and clock — rides the span's aria now; the ears that cannot hover hear what the cursor learned.`}
                          aria-label={writerLineAria(st.writtenBy, eRaw, getTabId())}
                          data-testid="estate-panel-writer"
                        >
                          <span
                            aria-hidden
                            className="inline-block h-1 w-1 rounded-full shrink-0"
                            style={{ backgroundColor: tabHueColor(st.writtenBy) }}
                          />
                          · written by {st.writtenBy} at{" "}
                          <span
                            className="transition-colors duration-500"
                            style={{ color: tabHueColor(st.writtenBy, 0.78) }}
                            data-testid="estate-panel-writer-clockwords"
                          >
                            {stampOf(st.writtenAt)}Z
                          </span>
                        </span>
                      );
                    })()}
                  <button
                    onClick={handleEstateSwitch}
                    aria-pressed={estateOn}
                    aria-label={withdrawVoice(estateOn, withdrawArmed)}
                    className={`vvu-label ml-auto px-1 py-px rounded-sm border text-[6px] font-bold cursor-pointer transition-[color,border-color,background-color,box-shadow] duration-200 hover:brightness-110 ${FOCUS_RING} ${
                      withdrawArmed
                        ? "vvu-heartbeat border-[#d06050]/70 bg-[#d06050]/10 text-[#d06050] shadow-[0_0_6px_rgba(208,96,80,0.3)]"
                        : estateOn
                          ? "border-[#e0a030]/60 bg-[#e0a030]/10 text-[#e0a030]"
                          : "border-[#3a4530] bg-black/30 text-[#7a8a6e] hover:text-[#c9d4bd]"
                    }`}
                    title={`${estateOn ? "withdraw the consent AND erase the estate\u2019s copy — the session\u2019s own memory is untouched" : "let the fold record ride: every fold click (and eraser write) mirrors to the estate\u2019s store while on; a fresh tab adopts it when it has no record of its own"} R177 · THE ASKED CONSENT: the destructive side asks first — one click arms, a second commits, the ask escapes after 4s; the switch's full state rides its aria.`}
                    data-testid="estate-panel-switch"
                  >
                    {withdrawArmed
                      ? "confirm erase"
                      : estateOn
                        ? "withdraw consent"
                        : "let it ride"}
                  </button>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5">
                  <span className="vvu-label text-[5.5px] text-[#7a8a6e]">the house holds:</span>
                  {estateLedger.open.length === 0 && (
                    <span
                      className="vvu-label text-[5.5px] text-[#7a8a6e]/80 italic cursor-help"
                      title="the house's empty is honest and has two faces: every fold closed again (the record whole, nothing riding), or no memory anywhere yet (the state line beside says which) — the ledger shows what the house IS, never a filler"
                      data-testid="estate-panel-empty"
                    >
                      nothing open — the house holds no fold for you
                    </span>
                  )}
                  {estateLedger.open.map((name) => (
                    <span
                      key={name}
                      className="vvu-label inline-flex items-center gap-1 px-1 py-px rounded-sm border border-[#b8a8d8]/25 bg-[#b8a8d8]/5 text-[5.5px] text-[#b8a8d8]/90 transition-[filter] hover:brightness-110"
                      title={`R160 · THE CONSENT SURFACE: the fold's chip — what is open and when it was left. R178 · THE FOLD'S VOICE: the chip's story rides its aria — name, when, arrival — heard without hovering.`}
                      aria-label={foldChipAria(
                        name,
                        estateLedger.stamps[name] ?? null,
                        estateLedger.restoredAs,
                      )}
                      data-testid={`estate-panel-fold-${name}`}
                    >
                      {name}
                      {estateLedger.stamps[name] && (
                        <span className="text-[#b8a8d8]/60">
                          · left at {stampOf(estateLedger.stamps[name]!)} UTC
                        </span>
                      )}
                      {estateLedger.restoredAs === "adopted" && (
                        <span className="text-[#b8a8d8]/60">· adopted</span>
                      )}
                      <button
                        onClick={() => {
                          rememberFold(name, false);
                          setEstateLedgerTick((t) => t + 1);
                        }}
                        aria-label={foldBackVoice(name)}
                        className="rounded-sm px-0.5 text-[#e5484d]/70 hover:text-[#e5484d] hover:bg-[#e5484d]/10 cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]"
                        title={`fold ${name} back — the record lets it go (this write mirrors to the estate's copy while the consent is on). R178 · THE FOLD'S VOICE: the button's manner rides its aria — heard without hovering.`}
                        data-testid={`estate-panel-erase-${name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                {estateOn &&
                  (() => {
                    // R162 · THE MEMORY'S HANDS: the stamp log, oldest
                    // first — the estate's write history as chips. The
                    // CURRENT hand wears the amber (the flat pair's
                    // truth); the past hands sit lavender. A v1-R161
                    // record (flat stamp, no log) says nothing here —
                    // the ledger shows what the log IS, never a
                    // synthesized history.
                    const log = readEstateStamps(panelEstateRaw());
                    if (log.length === 0) return null;
                    // R169 · THE LEGEND'S ARC: the panel's legend wears
                    // the same arc its row wears — the origin dot at
                    // the headAge clock's slow dim, the now dot at the
                    // copyAge clock's resting — one story, every
                    // surface. A single-hue glyph stays the last
                    // hand's surface (one dot, one law). legendArc is
                    // null only for log-less records — unreachable
                    // here (the log is non-empty), said anyway.
                    const legendGlyph = hueLegendGlyph(log);
                    const arc = legendArc(panelEstateRaw());
                    const arcOrigin = arc?.origin ?? 1;
                    const arcNowRest = arc?.nowRest ?? 1;
                    // R170 · THE LOG'S CLOCKS: every hand chip ages by
                    // ITS OWN stamp — the origin keeps its slow law,
                    // every other hand rests at the now's law. A
                    // gradient of settling, brightest at the freshest
                    // hand; the ends agree with the legend arc's pair.
                    const rests = handRests(log);
                    return (
                      <div
                        className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5"
                        data-testid="estate-panel-hands"
                      >
                        <span className="vvu-label text-[5.5px] text-[#7a8a6e]">
                          the memory’s hands:
                        </span>
                        {log.map((e, i) => (
                          <span
                            key={`${e.by}-${e.at}-${i}`}
                            className={`vvu-label inline-flex items-center gap-1 px-1 py-px rounded-sm border text-[5.5px] cursor-help transition-[filter] hover:brightness-125 ${
                              i === log.length - 1
                                ? "border-[#e0a030]/50 bg-[#e0a030]/10 text-[#e0a030]"
                                : "border-[#b8a8d8]/25 bg-[#b8a8d8]/5 text-[#b8a8d8]/80"
                            }`}
                            title={
                              i === log.length - 1
                                ? `the CURRENT hand — tab ${e.by} wrote the estate's copy at ${stampOf(e.at)} UTC (the flat pair's truth; the log's tail is the flat pair). R163 · THE PROVENANCE'S COLORS: the dot wears this hand's hue — the same tab, the same color, everywhere it appears. R171 · THE HAND'S VOICE: ${handVoice(e.at, isOriginHand(i, log.length))}. R172 · THE REST'S BADGE: ${restVoice(rests[i], isOriginHand(i, log.length))}.`
                                : `a past hand — tab ${e.by} wrote at ${stampOf(e.at)} UTC (R162 · THE STAMP LOG: the capped history, five entries deep). R163 · THE PROVENANCE'S COLORS: the dot wears this hand's hue. R171 · THE HAND'S VOICE: ${handVoice(e.at, isOriginHand(i, log.length))}. R172 · THE REST'S BADGE: ${restVoice(rests[i], isOriginHand(i, log.length))}.`
                            }
                            aria-label={`hand ${i} — ${handVoice(e.at, isOriginHand(i, log.length))} · ${restVoice(rests[i], isOriginHand(i, log.length))}`}
                            data-testid={`estate-panel-hand-${i}`}
                          >
                            <span
                              aria-hidden
                              className="inline-block h-1 w-1 rounded-full shrink-0 transition-opacity duration-700"
                              style={{
                                backgroundColor: tabHueColor(e.by),
                                opacity: rests[i] ?? 1,
                                ...(i === log.length - 1
                                  ? { boxShadow: `0 0 3px ${tabHueColor(e.by, 0.8)}` }
                                  : {}),
                              }}
                              data-testid={`estate-hand-dot-${i}`}
                            />
                            {e.by} · {stampOf(e.at)}Z · {restBadge(rests[i])}
                            {i === log.length - 1 && " · now"}
                          </span>
                        ))}
                        <span
                          className="vvu-label inline-flex items-center gap-1 px-1 py-px rounded-sm border border-[#b8a8d8]/15 bg-black/20 text-[5.5px] text-[#7a8a6e]/85 cursor-help transition-[filter,border-color] duration-200 hover:brightness-125 hover:border-[#b8a8d8]/30"
                          title="R164 · THE HUE'S LEGEND: every dot on this board is a tab's own color — derived from the tab id's own characters (pure arithmetic, no clock, no randomness). The same hand wears the same color in every tab, in every session; the colors are a READING of the provenance, never a write. R165 · the legend's glyph wears the log's OWN first and last hands — the legend demonstrating itself. R169 · THE ONE STORY: the legend wears the arc too — its dots age with the same two clocks the row's glyph wears (the origin's slow dim across four hours, the now's resting across two), byte-for-byte the same pair. R175 · THE HONEST SHAPES: the arc is heard too — the aria carries both rests in the badge's own numbers."
                          aria-label={legendArcAria(arc, legendGlyph.length) ?? undefined}
                          data-testid="estate-panel-hue-legend"
                        >
                          {legendGlyph.map((c, gi) => (
                            <span
                              key={`legend-glyph-${gi}`}
                              aria-hidden
                              className={`inline-block h-1 w-1 rounded-full shrink-0 transition-opacity ${gi === 0 && legendGlyph.length === 2 ? "duration-700" : "duration-500"}`}
                              style={{
                                backgroundColor: c,
                                opacity:
                                  gi === legendGlyph.length - 1
                                    ? arcNowRest
                                    : gi === 0 && legendGlyph.length === 2
                                      ? arcOrigin
                                      : 1,
                              }}
                              data-testid={`estate-legend-dot-${gi}`}
                            />
                          ))}
                          {HUE_LEGEND_VOICE}
                        </span>
                      </div>
                    );
                  })()}
              </div>
            )}
          </div>
        );
      })()}

      {error && (
        <p className="vvu-label mt-1 text-[6.5px] text-[#e5484d]">
          THE READ FAILED · {error} — the board refuses to invent a row
        </p>
      )}

      {board && (
        <>
          {hotRows.length > 0 && (
            <div
              className="mt-1.5 rounded-sm border border-[#3a4530]/50 bg-black/20 px-2 py-1.5"
              data-testid="standing-watch-digest"
            >
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span
                  className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#7a8a6e] cursor-help"
                  title="the hot rows in the board's own reading order — click a chip to scroll its row into view and flash it; the digest adds no arithmetic, it re-reads the rows"
                >
                  THE TENSION DIGEST ·
                </span>
                {hotRows.map((r) => {
                  const fc = flipCensus.get(r.id);
                  const n = fc?.count ?? 0;
                  // R156 · THE TENSION'S OWN HAND: the row's freshness
                  // judged by the engine's hotHands read — the SAME
                  // vocabulary the kept rows speak, the tail's own
                  // median gap as the yardstick. The dot says the
                  // degree, the title says the arithmetic.
                  const hh = hotHandsRead.hands.get(r.id);
                  // R151 · the chip's motion badge grows its recency:
                  // the row's freshest recorded flip as a minutes-ago
                  // (the render's own frame — no timer, no promise).
                  const freshAgeMin =
                    fc && fc.newestAt !== null && digestNow >= fc.newestMs
                      ? Math.floor((digestNow - fc.newestMs) / 60000)
                      : null;
                  return (
                    <button
                      key={r.id}
                      onClick={() => focusRow(r.id)}
                      className={`vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border cursor-pointer transition-[filter,border-color,transform] hover:brightness-125 active:translate-y-px ${TONE_CLS[r.tone]} ${FOCUS_RING}`}
                      title={`${r.name} — ${r.word}. ${r.title}${n > 0 ? ` · the ledger's tail holds ${n} flip${n === 1 ? "" : "s"} for this row${fc?.newestAt ? `, the freshest @ ${stampOf(fc.newestAt)} UTC${freshAgeMin !== null ? ` (${freshAgeMin}′ ago — the render's own frame)` : ""}` : ""}${hh?.hand ? ` · the freshness hand: ${hh.hand} (R156, judged against the tail's own median gap)` : ""}` : " · the tail holds no flip of this row — unrecorded (R154)"}`}
                      aria-label={digestChipAria(
                        { name: r.name, word: r.word },
                        {
                          flips: n,
                          freshest: fc?.newestAt
                            ? { stamp: stampOf(fc.newestAt), ageMin: freshAgeMin }
                            : null,
                          hand: hh?.hand
                            ? {
                                kind: hh.hand,
                                deltaMin: hh.deltaMin,
                                yardstickMin: hotHandsRead.yardstickMin,
                              }
                            : null,
                        },
                      )}
                      data-testid={`digest-chip-${r.id}`}
                    >
                      {r.name} · {r.word}
                      {n > 0 && hh?.hand && (
                        <span
                          className={`inline-block h-1 w-1 rounded-full cursor-help transition-[filter] hover:brightness-125 ${HAND_DOT_CLS[hh.hand]}`}
                          title={`R156 · THE TENSION'S OWN HAND: ${hh.hand}${hh.hand === "freshest" ? " — this row owns the tail\u2019s freshest flip (the R151 chip names THE mover; the hand says the degree)." : hh.hand === "in-rhythm" ? ` — ${hh.deltaMin !== null ? (hh.deltaMin >= 100 ? Math.round(hh.deltaMin) : hh.deltaMin.toFixed(1)) : "—"}′ behind the tail\u2019s freshest flip, within ONE median gap (${hotHandsRead.yardstickMin !== null ? (hotHandsRead.yardstickMin >= 100 ? Math.round(hotHandsRead.yardstickMin) : hotHandsRead.yardstickMin.toFixed(1)) : "—"}′) — the tail\u2019s own rhythm is the yardstick, never an invented constant.` : ` — ${hh.deltaMin !== null ? (hh.deltaMin >= 100 ? Math.round(hh.deltaMin) : hh.deltaMin.toFixed(1)) : "—"}′ behind the tail\u2019s freshest flip, beyond one median gap (${hotHandsRead.yardstickMin !== null ? (hotHandsRead.yardstickMin >= 100 ? Math.round(hotHandsRead.yardstickMin) : hotHandsRead.yardstickMin.toFixed(1)) : "—"}′) — the row\u2019s recorded recency has drifted.`} The same vocabulary the kept rows speak, judged by the engine\u2019s one read (classifyFreshness) — one law, many faces.`}
                          data-testid={`digest-chip-freshness-${r.id}`}
                        />
                      )}
                      {n > 0 && (
                        <span
                          className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-current opacity-80 cursor-help"
                          title={`${n} flip${n === 1 ? "" : "s"} recorded in the ledger's tail — the present tension's own recorded motion${fc?.newestAt ? `; the freshest @ ${stampOf(fc.newestAt)} UTC${freshAgeMin !== null ? `, ${freshAgeMin}′ ago (the render's own frame)` : ""}` : ""}`}
                          data-testid={`digest-chip-flips-${r.id}`}
                        >
                          ×{n}
                          {fc?.newestAt && freshAgeMin !== null && (
                            <span
                              className="vvu-label px-0.5 rounded-sm bg-black/30 text-[5.5px] text-current opacity-75"
                              data-testid={`digest-chip-fresh-${r.id}`}
                            >
                              · {freshAgeMin >= 100 ? Math.round(freshAgeMin) : freshAgeMin}′
                            </span>
                          )}
                        </span>
                      )}
                      {n === 0 && (
                        <span
                          className="vvu-label px-0.5 rounded-sm border border-dashed border-[#5f6e55]/60 bg-black/30 text-[5.5px] text-[#7a8a6e] cursor-help transition-[filter] hover:brightness-125"
                          title={`R154 · UNRECORDED: the tension rides, the ledger's tail holds NO flip of this row — the tension predates the tail's window (or the row has held its word since). The absence is spoken in place: zero recorded flips is the badge's own truth, not a missing read — the count family's ×0, spelled out.`}
                          data-testid={`digest-chip-unrecorded-${r.id}`}
                        >
                          ×0 unrecorded
                        </span>
                      )}
                    </button>
                  );
                })}
                {digestFresh &&
                  (() => {
                    // R151 · THE MOVE'S FACE: the third freshness chip —
                    // the tail's newest flip, its owner riding beside it,
                    // its minutes-ago reading the render's own frame.
                    const moveAgeMin =
                      digestNow >= digestFresh.ms
                        ? Math.floor((digestNow - digestFresh.ms) / 60000)
                        : null;
                    return (
                      <span
                        className="vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border border-[#2a3324] bg-black/30 text-[#8ac0c8]/85 cursor-help transition-[filter,box-shadow] hover:brightness-125 hover:shadow-[0_0_6px_rgba(122,200,208,0.3),0_0_9px_rgba(184,168,216,0.25)]"
                        title={`R151 · THE MOVE'S FACE: the ledger tail's freshest flip @ ${stampOf(digestFresh.at)} UTC — ${digestFresh.name} moved last (one pass, a chronological max by Date.parse, never a string compare; first-seen on a tie in the tail's own order). The third face's freshness: the kept census's chip says who came HOME last, the striking census's says who STRUCK last, this says who MOVED last. The minutes-ago reads this render's own frame — no timer, no wall-clock promise.`}
                        data-testid="digest-fresh"
                      >
                        ⌁ last moved {stampOf(digestFresh.at)}
                        <span
                          className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#a8d8de]"
                          data-testid="digest-fresh-by"
                        >
                          {digestFresh.name}
                        </span>
                        {moveAgeMin !== null && (
                          <span
                            className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#8ac0c8]/70"
                            data-testid="digest-fresh-age"
                          >
                            · {moveAgeMin >= 100 ? Math.round(moveAgeMin) : moveAgeMin}′ ago
                          </span>
                        )}
                      </span>
                    );
                  })()}
                {ledger?.busiest &&
                  (() => {
                    // R152 · THE TOP MOVER: the digest names its busiest
                    // row — volume beside recency. The fresh chip says
                    // who moved LAST, this says who moves MOST (the
                    // ledger's own busiest read, engine-side — the
                    // digest adds no arithmetic, it names the read).
                    // R153 · CLICK to unfold THE MOVER LADDER — the
                    // tail's three heaviest movers, their shares of the
                    // tail's whole motion, foldable back.
                    const b = ledger.busiest;
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          const next = !moverLadderOpen;
                          setMoverLadderOpen(next);
                          rememberFold("moverLadder", next);
                          // a manual click is the reader's own fold — the
                          // remembered cue retires for this session's read
                          setMoverLadderRemembered(false);
                        }}
                        aria-expanded={moverLadderOpen}
                        aria-label={moverFoldAria(b.name, b.count, moverLadderOpen)}
                        className={`vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border bg-black/30 transition-[filter,border-color,box-shadow] hover:brightness-125 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00] ${moverLadderOpen ? "border-[#c8ff00]/60 text-[#c8ff00] bg-[#c8ff00]/10 shadow-[0_0_6px_rgba(200,255,0,0.2)]" : "border-[#2a3324] text-[#8ac0c8]/85 cursor-pointer hover:shadow-[0_0_6px_rgba(122,200,208,0.3),0_0_9px_rgba(184,168,216,0.25)]"}`}
                        title={`R152 · THE TOP MOVER: the ledger tail's busiest row — ${b.name} moved ${b.count} time${b.count === 1 ? "" : "s"} in the tail's span. Volume beside recency: the fresh chip says who moved LAST, this says who moves MOST (the ledger's own busiest read — the digest adds no arithmetic, it names the read). R153 · CLICK to unfold THE MOVER LADDER — the tail's three heaviest movers, each with its share of the tail's whole motion, foldable back${moverLadderOpen ? " (unfolded — click to fold)" : ""}. R154 · the ladder speaks its shape — the verdict (${moverRead.verdict ?? "no flips to judge"}) rides the unfolded ladder. R155 · the verdict also rides THE FOLD — the shape-word sits beside the count, no unfold needed — and the ladder's bars wear its own color. R156 · the house remembers its folds — this fold rides the session${moverLadderRemembered ? " (↺ restored from your last read)" : ""}.`}
                        data-testid="digest-topmover"
                      >
                        ⌃ top mover
                        {moverLadderRemembered && moverLadderOpen && (
                          <span
                            className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#b8a8d8] cursor-help transition-[filter] hover:brightness-125"
                            title={`R156 · THE HOUSE REMEMBERS ITS FOLDS: this ladder was restored from your last read (the session carries the fold across reloads) — the ↺ says remembered, not re-derived.${moverLadderAdopted ? " R160 · THE ADOPTED VOICE: this memory was ADOPTED from the estate — another tab\u2019s read, owned by this one from its first mount." : ""} Any click of your own retires the cue.`}
                            data-testid="digest-topmover-remembered"
                          >
                            ↺
                          </span>
                        )}
                        <span
                          className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#a8d8de]"
                          data-testid="digest-topmover-by"
                        >
                          {b.name}
                        </span>
                        <span
                          className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#8ac0c8]/70"
                          data-testid="digest-topmover-count"
                        >
                          ×{b.count}
                        </span>
                        {!moverLadderOpen && moverRead.verdict && (
                          <span
                            className={`vvu-label px-0.5 rounded-sm border text-[5.5px] cursor-help transition-[filter] hover:brightness-125 ${moverRead.verdict === "solo" ? "border-[#c8ff00]/40 bg-[#c8ff00]/10 text-[#c8ff00]" : moverRead.verdict === "lopsided" ? "border-[#e0a030]/50 bg-[#e0a030]/10 text-[#e0a030]" : moverRead.verdict === "mixed" ? "border-[#2a3324] bg-black/40 text-[#8ac0c8]" : "border-[#3a4530]/60 bg-black/40 text-[#c9d4bd]"}`}
                            title={`R155 · THE FOLDED VERDICT: the ladder's shape-word rides the fold — ${moverRead.verdict}, judged against the even seat (1/${moverRead.movers.length}); no unfold needed (the R152 wide's reading's own law: the drift rides the fold). The unfolded ladder carries the full reading.`}
                            data-testid="digest-topmover-verdict"
                          >
                            ⌃ {moverRead.verdict}
                          </span>
                        )}
                      </button>
                    );
                  })()}
                {moverLadderOpen &&
                  moverRead.top.length > 0 &&
                  (() => {
                    // R153 · THE MOVER LADDER: the tail's motion made a
                    // distribution — the three heaviest movers, each
                    // with its own share bar against the tail's WHOLE
                    // flip count (min 8% so a thin share still reads).
                    // The house order: count desc, name asc, id asc;
                    // the heaviest wears the TOP badge (the WIDE
                    // badge's lime, the family's own emphasis color).
                    // R158 · THE DATED MEMORY: the whisper's WHEN is
                    // the render's read of the stored stamp (no timer,
                    // no wall-clock promise — the age is this render's
                    // own arithmetic, the stamp verbatim).
                    return (
                      <div
                        className="w-full rounded-sm border border-[#2a3324]/70 bg-black/20 px-1.5 py-1 mt-0.5 transition-colors duration-200 hover:border-[#3a4530]"
                        data-testid="digest-moverladder"
                      >
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                          <span
                            className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#8ac0c8]/90"
                            title={`the tail's mover ladder — the ${moverRead.top.length} heaviest of the tail's movers, in the house order (count desc, name asc): each bar is the row's share of the tail's ${tailFlips} flip${tailFlips === 1 ? "" : "s"} (the bar's length is the share, min 8% so a thin share still reads). R153 · the distribution of motion beside the single busiest chip — a tail moved by ONE row reads a lopsided ladder, a tail moved evenly reads three near-equal bars. R154 · the ladder now SPEAKS its shape: the verdict rides beside the title — one word for the distribution, judged against the even seat (1/k). R155 · the bars wear the verdict's OWN COLOR — the shape visible in the bars themselves (lime solo, amber lopsided, teal-cyan mixed, sage even).`}
                            data-testid="digest-moverladder-title"
                          >
                            ⌃ THE MOVER LADDER · {moverRead.top.length} of the tail's movers ·
                            shares of {tailFlips} flip{tailFlips === 1 ? "" : "s"}
                          </span>
                          {moverRead.verdict && (
                            <span
                              className={`vvu-label px-0.5 rounded-sm border text-[5.5px] cursor-help transition-[filter] hover:brightness-125 ${moverRead.verdict === "solo" ? "border-[#c8ff00]/40 bg-[#c8ff00]/10 text-[#c8ff00] shadow-[0_0_5px_rgba(200,255,0,0.22)]" : moverRead.verdict === "lopsided" ? "border-[#e0a030]/50 bg-[#e0a030]/10 text-[#e0a030]" : moverRead.verdict === "mixed" ? "border-[#2a3324] bg-black/40 text-[#8ac0c8]" : "border-[#3a4530]/60 bg-black/40 text-[#c9d4bd]"}`}
                              title={`R154 · THE LADDER'S VERDICT: the distribution's one-word shape, judged against the EVEN seat (1/${moverRead.movers.length} — what every mover would hold if the tail's motion spread evenly). The top mover holds ${moverRead.topShare !== null ? (moverRead.topShare * 100).toFixed(0) : "—"}% of the tail's ${moverRead.flips} flip${moverRead.flips === 1 ? "" : "s"} across ${moverRead.movers.length} mover${moverRead.movers.length === 1 ? "" : "s"}${moverRead.verdict === "solo" ? " — one mover owns every flip: the extreme shape." : moverRead.verdict === "lopsided" ? " — more than 1.5× its even seat: the tail's motion concentrates." : moverRead.verdict === "mixed" ? " — the top leads without dominating (up to 1.5× its even seat)." : " — at most 1.25× its even seat: a near-even spread."} The ratio reads in whole counts (top·k/n) — no float drift at the 1.25/1.5 fences.`}
                              data-testid="digest-moverladder-verdict"
                            >
                              ⌃ {moverRead.verdict}
                            </span>
                          )}
                          {moverRead.top.map((m, i) => {
                            const sharePct =
                              tailFlips > 0 ? Math.max(8, (m.count / tailFlips) * 100) : 8;
                            return (
                              <span
                                key={m.id}
                                className="vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border border-[#2a3324] bg-black/30 text-[#b8d8de]/90 transition-[filter,box-shadow] hover:brightness-125 hover:shadow-[0_0_6px_rgba(122,200,208,0.3),0_0_9px_rgba(184,168,216,0.25)]"
                                title={`${m.name} moved ${m.count} time${m.count === 1 ? "" : "s"} in the tail's span — ${tailFlips > 0 ? ((m.count / tailFlips) * 100).toFixed(0) : "0"}% of the tail's ${tailFlips} flip${tailFlips === 1 ? "" : "s"}${i === 0 ? " — the heaviest, the TOP badge" : ""}. The ladder reads the same census the digest's chips read; the digest adds no arithmetic, it shows the distribution.`}
                                data-testid={`digest-moverladder-row-${m.id}`}
                              >
                                {i === 0 && (
                                  <span
                                    className="vvu-label px-0.5 rounded-sm bg-[#c8ff00]/15 text-[#c8ff00] text-[5.5px] shadow-[0_0_5px_rgba(200,255,0,0.28)]"
                                    aria-hidden
                                  >
                                    TOP
                                  </span>
                                )}
                                <span
                                  className="inline-block h-[3px] w-[18px] overflow-hidden rounded-full bg-black/50 align-middle"
                                  aria-hidden
                                  data-testid={`digest-moverladder-bar-${m.id}`}
                                >
                                  <span
                                    className={`block h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ${moverRead.verdict === "solo" ? "from-[#c8ff00]/85 to-[#c8ff00]/40" : moverRead.verdict === "lopsided" ? "from-[#e0a030]/85 to-[#e0a030]/40" : moverRead.verdict === "even" ? "from-[#c9d4bd]/85 to-[#c9d4bd]/40" : "from-[#7ac8d0]/85 to-[#8ac0c8]/40"}`}
                                    style={{ width: `${sharePct}%` }}
                                  />
                                </span>
                                {m.name}
                                <span
                                  className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#8ac0c8]/80"
                                  data-testid={`digest-moverladder-count-${m.id}`}
                                >
                                  ×{m.count}
                                  {tailFlips > 0
                                    ? ` · ${((m.count / tailFlips) * 100).toFixed(0)}%`
                                    : ""}
                                </span>
                              </span>
                            );
                          })}
                          {moverLadderRemembered &&
                            (() => {
                              const leftAgeMin = moverLadderLeftAt
                                ? Math.max(0, (Date.now() - Date.parse(moverLadderLeftAt)) / 60000)
                                : null;
                              // R163 · THE PROVENANCE SPOKEN: the whisper
                              // names its hand too — when the session record
                              // STILL carries the adoption's foreign stamp.
                              // The reader's own writes strip the stamp, and
                              // the name retires back to the R160 voice
                              // (honesty about whose the memory NOW is).
                              const wst = moverLadderAdopted
                                ? readEstateStamp(panelRecordRaw())
                                : null;
                              const foreign =
                                wst !== null && wst.writtenBy !== getTabId() ? wst.writtenBy : null;
                              const whose = foreign !== null ? `in ${foreign}` : "in another tab";
                              return (
                                // R157 · THE WHISPER: the restored fold says
                                // WHERE the reader left it. R158 · THE DATED
                                // MEMORY: and WHEN — the age is this render's
                                // own read, the stamp verbatim; a v1 record
                                // (no when) keeps the R157 sentence.
                                // R160 · THE ADOPTED VOICE: an ADOPTED memory
                                // speaks its arrival — the estate remembered,
                                // another tab's read now owned by this one.
                                // R163 · THE PROVENANCE'S COLORS: the arrival
                                // NAMES the hand (while the adoption's bytes
                                // stand), and the dot wears its hue.
                                <span
                                  className="vvu-label inline-flex items-center gap-1 px-1 py-px rounded-sm border border-[#b8a8d8]/25 bg-[#b8a8d8]/5 text-[5.5px] text-[#b8a8d8]/85 cursor-help transition-[filter,border-color] duration-200 hover:brightness-110 hover:border-[#b8a8d8]/45"
                                  title={`R157 · THE WHISPER: this ladder was restored open from your last read — the session remembered where you left it. R158 · THE DATED MEMORY: the memory carries the when${moverLadderLeftAt ? ` (left open at ${stampOf(moverLadderLeftAt)} UTC)` : " — this record has no when (v1)"}.${moverLadderAdopted ? ` R160 · THE ADOPTED VOICE: this memory was ADOPTED from the estate — another tab\u2019s read, owned by this one from its first mount.${foreign !== null ? ` R163 · THE PROVENANCE'S COLORS: the hand is named (${foreign}) and the dot wears its hue — while the adoption's bytes stand; a fold of your own retires the name.` : " A fold of your own retires the whisper."}` : " A fold of your own retires the whisper (the memory follows the reader, never leads)."}`}
                                  data-testid="digest-moverladder-whisper"
                                >
                                  {foreign !== null && (
                                    <span
                                      aria-hidden
                                      className="inline-block h-1 w-1 rounded-full shrink-0"
                                      style={{ backgroundColor: tabHueColor(foreign) }}
                                    />
                                  )}
                                  {moverLadderLeftAt && leftAgeMin !== null
                                    ? moverLadderAdopted
                                      ? `↺ left open ${leftAgeMin >= 100 ? Math.round(leftAgeMin) : leftAgeMin.toFixed(1)}′ ago (at ${stampOf(moverLadderLeftAt)} UTC) ${whose} — the estate remembered`
                                      : `↺ you left this open ${leftAgeMin >= 100 ? Math.round(leftAgeMin) : leftAgeMin.toFixed(1)}′ ago (at ${stampOf(moverLadderLeftAt)} UTC) — the house remembered`
                                    : moverLadderAdopted
                                      ? `↺ left open ${whose} — the estate remembered`
                                      : "↺ you left this open — the house remembered"}
                                </span>
                              );
                            })()}
                          <button
                            type="button"
                            onClick={() => {
                              setMoverLadderOpen(false);
                              setMoverLadderRemembered(false);
                              rememberFold("moverLadder", false);
                            }}
                            className="vvu-label text-[6px] font-bold text-[#7ac8d0]/80 px-1 py-px rounded-sm border border-[#7ac8d0]/30 hover:border-[#2a4a4e] hover:-translate-y-px transition-[color,transform,border-color] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]"
                            title="fold the ladder back — the chip keeps the count and the busiest name; the session remembers the fold (R156)"
                            data-testid="digest-moverladder-fold"
                          >
                            − fold the ladder
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                <button
                  onClick={() => void copyDigest()}
                  aria-live="polite"
                  aria-label={digestButtonAria(copied, {
                    hot: hotRows.length,
                    calm: rows.length - hotRows.length,
                    adopted: lastFoldOrigin() === "adopted",
                  })}
                  className={`vvu-label ml-auto flex items-center gap-1 border px-1.5 py-px text-[6px] font-bold transition-colors duration-200 ${FOCUS_RING} ${
                    copied
                      ? "border-[#c8ff00]/60 bg-[#c8ff00]/5 text-[#c8ff00] shadow-[0_0_6px_rgba(200,255,0,0.2)]"
                      : "border-[#3a4530] text-[#7a8a6e] hover:border-[#4a5a3e] hover:text-[#c9d4bd]"
                  }`}
                  title="copy the full word-level digest — the hot rows with their one-line details AND their freshness hands (the tail's own rhythm judging each tension), a tension the tail never saw confessing ×0 unrecorded, the mover ladder's shape-word riding as the shape line, the calm rows named, the reader's own fold record as the footer's last line (where THIS reader left things — R159), the arrival story riding the footer's last word when the memory was adopted (R161), the ledger's own counts riding the header (R157 · THE CLIPBOARD'S VOICE). R179 · THE DIGEST'S VOICE: the button's offer and its COPIED confirmation both ride its aria — the census in the board's own numbers, heard without hovering."
                  data-testid="digest-copy"
                >
                  {copied ? (
                    <>
                      <Check className="h-2 w-2 text-[#c8ff00]" aria-hidden /> COPIED
                    </>
                  ) : (
                    <>
                      <ClipboardCopy className="h-2 w-2" aria-hidden /> COPY DIGEST
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div
            className="mt-1.5 grid grid-cols-1 gap-1 md:grid-cols-2"
            data-testid="standing-watch-rows"
          >
            {rows.map((r) => {
              const hot = r.tone === "amber" || r.tone === "rose";
              return (
                <div
                  key={r.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(r.id, el);
                    else rowRefs.current.delete(r.id);
                  }}
                  className={`rounded-sm border border-[#3a4530]/50 bg-black/20 px-2 py-1.5 transition-all duration-300 hover:border-[#4a5a3e] ${hot ? (HOT_EDGE[r.tone] ?? "") : ""} ${
                    flashId === r.id
                      ? "border-[#c8ff00]/80 bg-[#c8ff00]/5 shadow-[0_0_0_1px_rgba(200,255,0,0.35)]"
                      : ""
                  }`}
                  title="R180 · THE STANDING VOICES: the row's story rides its aria — the tone family first (the dot's own law, spoken: settled or counting / a live tension / standing clear), then the name, the word, the detail — heard without hovering."
                  aria-label={watchRowAria(r)}
                  data-testid={`standing-watch-row-${r.id}`}
                >
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full cursor-help ${TONE_DOT[r.tone]} ${hot ? (TONE_GLOW[r.tone] ?? "") : ""}`}
                      title={`row status: ${r.tone} — sage/cyan = settled or counting, amber/rose = a live tension, neutral = standing clear`}
                    />
                    <span
                      className={`vvu-label text-[6.5px] font-bold tracking-[0.12em] cursor-help ${TONE_NAME[r.tone] ?? "text-[#7a8a6e]"}`}
                      title={r.title}
                    >
                      {r.name}
                    </span>
                    <span
                      className={`vvu-label ml-auto text-[6.5px] font-bold px-1 py-px rounded-sm border cursor-help transition-[filter,border-color] hover:brightness-125 ${TONE_CLS[r.tone]}`}
                      title={r.title}
                    >
                      {r.word}
                    </span>
                  </div>
                  <p
                    className="vvu-label mt-0.5 text-[6px] leading-relaxed text-[#c9d4bd] cursor-help"
                    title={r.title}
                  >
                    {r.detail}
                  </p>
                </div>
              );
            })}
          </div>
          <p
            className="vvu-label mt-1.5 text-[6px] leading-relaxed text-[#7a8a6e] cursor-help"
            title="the board's caption, verbatim — the honesty contract lives here"
          >
            {board.note}
          </p>
          <BoardLedger
            ledger={ledger}
            silence={silence}
            weightsLadder={weightRead}
            error={ledgerErr}
            onDepthChange={fetchLedgerDepth}
            rows={rows}
          />
        </>
      )}
    </section>
  );
}

/** THE BOARD'S OWN LEDGER — the board's memory, rendered. The flips are
 *  two board words and the board's own stamps; the spark is the hot
 *  count across the moved samples; THE LEDGER'S OWN READ (R129) speaks
 *  the tail's story — motion rate, direction, concentration — every
 *  word naming its own numbers. The lane derives nothing the sampler
 *  did not already say.
 *
 *  R133 · THE SILENCE LADDER: the still census's own past, read from
 *  the store's whole reach — each still row's LAST HEARD flip and the
 *  quiet ruled since, the never-heard rows named with no bar. */
function BoardLedger({
  ledger,
  silence,
  weightsLadder,
  error,
  onDepthChange,
  rows,
}: {
  ledger: LedgerSummary | null;
  silence: SilenceRead | null;
  weightsLadder: WeightLadderRead | null;
  error: string | null;
  onDepthChange: (take: number) => void;
  rows: Array<{ id: string; name: string; word: string; tone: string }>;
}) {
  // R190 · THE PRE-FILTERED LOAD: the devseed family's composition
  // flag names a row id; when it rides (dev only — the production
  // build never reads it), the board OPENS with that row's filter
  // already applied, so the pressed chips, the ALL button's offer,
  // and the narrowed flips list all speak in the first render —
  // the capture choreography without the click. A broken ask (no
  // store, no flag, an empty value) reads as no filter: the seed
  // never fights the board.
  const [filter, setFilter] = useState<string | null>(() =>
    process.env.NODE_ENV === "production"
      ? null
      : readDevseedFilterFlag(typeof window !== "undefined" ? window.localStorage : null),
  );
  const [depth, setDepth] = useState(24);
  /** THE RELAY LIT (R139): the handoff strip's RELAY badge owns a hover
   *  — while held, the motion line lights the run's flips (the reach
   *  made visible). Transient by design: no click, no state past the
   *  hover; focus holds it for the keyboard. */
  const [relayLit, setRelayLit] = useState(false);
  /** THE EDGES LIT (R140): the handoff and quiet-company PAIR chips
   *  own the same light — while a chip is held (hover or focus), the
   *  motion line halos the edge's own seats (the handing and receiving
   *  flips of each passage; the opener and ender of each owned quiet).
   *  The light rides the chip's family color: the handoff's amber, the
   *  quiet's cyan, the turnaround row's violet (R142), the below
   *  quiet's teal (R143). Transient by design — release and the light
   *  goes out. */
  /** R144 · the below lights grew a second face: the seats that are
   *  CHANGED MINDS (reversals' own return flips) ride violetKeys
   *  alongside the teal keys — the below's silence and the turnarounds
   *  that end parts of it, lit together (the two-faces' own pattern,
   *  applied below). Optional — a below light with no changed minds
   *  among its seats stays teal alone.
   *  R145 · THE THREE LIGHTS DEEP: the turnaround row chips compose
   *  the OTHER way too — their violet changed minds ride `keys` while
   *  the row's below-quiet seats ride tealKeys (the silence below the
   *  rungs that the row keeps, lit with its changed minds). And the
   *  turnover ender chips ride kind 'turnover': the below quiets a
   *  row's minds ENDED in teal, the minds themselves in violet. */
  const [edgeLit, setEdgeLit] = useState<{
    keys: Set<string>;
    violetKeys?: Set<string>;
    tealKeys?: Set<string>;
    kind: "handoff" | "quiet" | "turnaround" | "below" | "turnover";
    label: string;
  } | null>(null);
  /** THE DELIVERY LIT (R142): the delivery-edge chips own the light
   *  too — while held, the motion line halos each delivery's own two
   *  flips: the DELIVERERS in amber (the hand that passed) and the
   *  CHANGED MINDS in violet (the mind that arrived), told apart ON
   *  the line. The moment of delivery made visible. */
  const [deliveryLit, setDeliveryLit] = useState<{
    deliverKeys: Set<string>;
    returnKeys: Set<string>;
    label: string;
  } | null>(null);
  /** THE TWO FACES (R141) + THE THIRD FACE (R146): the shared-ground
   *  ROW chips own the light too — while held, the motion line halos
   *  the row's turnaround flips (violet, the changed mind), its
   *  quiet-frame flips (cyan, the ruled silence), and — when the row
   *  holds seats below the rungs — its below-quiet seats (teal, the
   *  unnamed silence): the row's faces made visible at once, each in
   *  its own color. */
  const [twoFaces, setTwoFaces] = useState<{
    turnKeys: Set<string>;
    quietKeys: Set<string>;
    belowKeys?: Set<string>;
    label: string;
  } | null>(null);
  /** THE KEPT LIGHT (R144): the kept-story ROW chips own the light —
   *  while held, the motion line halos the row's self-kept quiet
   *  seats in TEAL (the silence it keeps with itself) AND its kept
   *  enders in VIOLET (the changed minds at home) — the kept story's
   *  two colors, one story. */
  const [keptLit, setKeptLit] = useState<{
    quietKeys: Set<string>;
    keptKeys: Set<string>;
    label: string;
  } | null>(null);
  const [tailCopied, setTailCopied] = useState(false);
  const read = useMemo(() => (ledger ? ledgerRead(ledger) : null), [ledger]);
  const flipsNewestFirst = useMemo(() => (ledger ? [...ledger.flips].reverse() : []), [ledger]);
  const still = useMemo(() => stillCensus(rows, ledger?.flips ?? []), [rows, ledger]);
  /** The silence read joins by id: the lane renders ONE census (the live
   *  board's); the store's read answers each still row's own past. An
   *  entry the live census has not caught up to yet simply stays
   *  unjoined — the next tick reconciles. */
  const silenceById = useMemo(
    () => new Map((silence?.entries ?? []).map((e) => [e.id, e])),
    [silence],
  );
  /** The LADDER (R133): the still rows, loudest first — a display
   *  reading over the engine's census-order entries. Unjoined or
   *  never-heard rows fall to the bottom (their silence is beyond
   *  knowing / beyond the next tick). */
  const ladder = useMemo(() => {
    return still
      .map((s) => ({ row: s, entry: silenceById.get(s.id) ?? null }))
      .sort((a, b) => {
        const qa = a.entry?.quietSinceMin ?? null;
        const qb = b.entry?.quietSinceMin ?? null;
        if (qa === null && qb === null) return 0;
        if (qa === null) return 1;
        if (qb === null) return -1;
        return qb - qa;
      });
  }, [still, silenceById]);

  /** The motion line and the quiet hand read CHRONOLOGICAL flips — the
   *  gaps' contract is oldest-first (a gap is a positive interval); the
   *  chip list keeps its newest-first order for reading. */
  const filteredChrono = useMemo(
    () => (filter ? (ledger?.flips ?? []).filter((f) => f.id === filter) : (ledger?.flips ?? [])),
    [ledger, filter],
  );
  /** THE COMPANY (R136): who moves WITH whom — flips on the same board
   *  stamp (one transition, several rows) are company. The engine's
   *  clock-free read (the stamp string is the identity); it follows
   *  the same filteredChrono the motion line reads — the filter
   *  follows, one tail many readings. */
  const company = useMemo(() => companions(filteredChrono), [filteredChrono]);
  /** THE QUIET LADDER (R136): the pace's shape — the N longest quiets
   *  longest-first, ties keeping input order (gapsOf's own rule). */
  const quiets = useMemo(() => quietLadder(filteredChrono, 5), [filteredChrono]);

  /** THE TURNAROUND (R137): the board changing its mind — round trips
   *  (the word undone in one step) and reprises (a pair come back).
   *  The read is STRUCTURAL (pairs and order, no clocks); it follows
   *  the same filteredChrono the pace reads — the filter follows, one
   *  tail many readings. */
  const turnarounds: ReversalRead = useMemo(() => reversals(filteredChrono), [filteredChrono]);

  /** THE CHANGED MINDS' IDENTITY (R144): the return flips' seat keys
   *  (id|at — the motion line's own identity), one set the below
   *  lights intersect against. The below's silence and the turnarounds
   *  that end parts of it share the same flips — the set makes the
   *  composition a lookup, never a re-derivation. */
  const turnKeySet: Set<string> = useMemo(
    () => new Set(turnarounds.reversals.map((e) => `${e.id}|${e.at}`)),
    [turnarounds],
  );

  /** THE HANDOFF (R138): the motion passing between rows — each
   *  adjacent pair of flips is one passage (handed to another row, or
   *  kept by the same row). The company read's TEMPORAL mirror:
   *  order-only, directed, clock-free. */
  const handoff: HandoffRead = useMemo(() => handoffs(filteredChrono), [filteredChrono]);

  /** THE QUIET'S COMPANY (R139): the quiets' succession — which
   *  DIRECTED row pairs own the tail's silences (opener → ender, the
   *  edge the quiet hung on). The quiet ladder × the handoff
   *  composition; it follows the same filteredChrono — the filter
   *  follows, one tail many readings. */
  const quietCompanies: QuietCompanyRead = useMemo(
    () => quietCompany(filteredChrono),
    [filteredChrono],
  );

  /** THE SHARED GROUND (R140): the restless × the silent — which rows
   *  BOTH changed their mind (reversals' own rows) AND frame one of the
   *  tail's RULED quiets (the quiet ladder's rungs). The composition
   *  rides the ruled quiets because every flip frames SOME gap — over
   *  all gaps the overlap would collapse into the restless census
   *  alone. It follows the same filteredChrono — the filter follows,
   *  one tail many readings. */
  const sharedGrounds: SharedGroundRead = useMemo(
    () => sharedGround(filteredChrono),
    [filteredChrono],
  );

  /** THE TURNAROUND'S EDGES (R141): what delivered each changed mind —
   *  the return flip's chronological predecessor either belongs to
   *  another row (the directed edge that DELIVERED it) or to the same
   *  row (the mind grew at home). The turnaround × handoff
   *  composition; it follows the same filteredChrono — the filter
   *  follows, one tail many readings. */
  const turnEdges: TurnaroundEdgeRead = useMemo(
    () => turnaroundEdges(filteredChrono),
    [filteredChrono],
  );

  /** THE UNRULED TAIL (R142): the quiets the ladder does not name —
   *  the ladder's own complement, given their own shape (the count
   *  below, the minutes' share, the biggest unnamed, the rows that
   *  keep them). It follows the same filteredChrono — the filter
   *  follows, one tail many readings. */
  const unruled: UnruledRead = useMemo(() => unruledTail(filteredChrono), [filteredChrono]);

  /** THE UNRULED ROWS (R143): the quiet-company read applied to the
   *  ladder's own complement — which DIRECTED row pairs own the quiets
   *  BELOW the rungs. It rides the SAME shared slice as the unruled
   *  tail (the two reads can never disagree about who is below); it
   *  follows the same filteredChrono — the filter follows, one tail
   *  many readings. */
  const unruledRowsRead: UnruledRowsRead = useMemo(
    () => unruledRows(filteredChrono),
    [filteredChrono],
  );

  /** THE UNRULED TURNOVERS (R145): the changed minds' share of the
   *  BELOW silence — which quiets below the rungs a taken-back word
   *  ENDED, the minutes' share said outright, the kept/handed split
   *  through the gap's own eyes (grew at home vs arrived by handoff),
   *  and the enders' census with its seats as the light's fuel. It
   *  rides the SAME shared slice as the unruled tail and rows; it
   *  follows the same filteredChrono — the filter follows, one tail
   *  many readings. */
  const unruledTurnoversRead: UnruledTurnoverRead = useMemo(
    () => unruledTurnovers(filteredChrono),
    [filteredChrono],
  );

  /** THE KEPT STORY (R144): the self-kept quiets, and which of them
   *  end in the row TAKING ITS OWN WORD BACK (a kept ender — the
   *  changed mind that grew at home). The R141 kept-turnaround ×
   *  R142 self-kept-quiet composition; on a clean tail keptEnders ===
   *  turnaroundEdges's kept count. It follows the same filteredChrono
   *  — the filter follows, one tail many readings. */
  const keptStoryRead: KeptStoryRead = useMemo(() => keptStory(filteredChrono), [filteredChrono]);

  /** THE CROSS-CADENCE (R147): does a row that comes home fast also
   *  strike below fast? The kept story's homecoming rhythm × the
   *  unruled turnovers' striking rhythm, joined by row — the two
   *  censuses' own rows, one composition, no new slice. It follows
   *  the same filteredChrono — the filter follows, one tail many
   *  readings. */
  const crossCadenceRead: CrossCadenceRead = useMemo(
    () => crossCadence(keptStoryRead, unruledTurnoversRead),
    [keptStoryRead, unruledTurnoversRead],
  );

  /** R148 · the compass's ONE scale, component-level: the two
   *  censuses' own slowest hand (the max of the kept census's
   *  slowest homecoming and the turnover census's slowest strike).
   *  The badge's pair of bars AND the unfold's rows all read this
   *  single source — one scale, no divergence. */
  const compassScale = Math.max(
    keptStoryRead.slowestHomecomingMin ?? 0,
    unruledTurnoversRead.slowestCadenceMin ?? 0,
  );

  /** R150 · THE RENDER-FRAME AGE's clock: the render's own frame is
   *  the board's clock — captured once per render pass, re-read at
   *  each telemetry pass (the board re-renders on its live cadence,
   *  so the fresh chips' minutes-ago breathes with the data). No
   *  wall-clock promise, no timer of its own — the age is the read's
   *  frame, said plainly in the chip's title. */
  const renderNow = Date.now();

  /** THE DISCLOSURES (R144): the unruled strips' +more grow into
   *  expand-in-place buttons — the whole shape on demand, foldable.
   *  R144 · the kept story's +more keepers joins them: the whole
   *  company of keepers on demand, foldable back to the strongest
   *  three (keptEnders desc, selfKept desc, name asc). */
  const [showAllBelow, setShowAllBelow] = useState(false);
  const [showAllUnruledRows, setShowAllUnruledRows] = useState(false);
  const [showAllKeepers, setShowAllKeepers] = useState(false);
  // R156 · THE HOUSE REMEMBERS ITS FOLDS: the kept company's fold
  // belongs to THIS surface — one post-mount read restores it (only
  // ever opening; the folded default stays the honest default).
  // R157 · THE WIDENED MEMORY: the family grows to every fold this
  // surface owns — the compass, the below, the paired companies, the
  // turnover enders — each its own key, each restored open with its
  // own ↺ remembered cue (retiring on the reader's own click).
  const [keepersRemembered, setKeepersRemembered] = useState(false);
  const [compassRemembered, setCompassRemembered] = useState(false);
  const [belowRemembered, setBelowRemembered] = useState(false);
  const [unruledRowsRemembered, setUnruledRowsRemembered] = useState(false);
  const [turnEndersRemembered, setTurnEndersRemembered] = useState(false);
  // R158 · THE DATED MEMORY: the WHEN each fold was left open (the
  // v2 record's stamps) — the ↺ cues' titles carry it; a v1 record
  // has no when and the titles stay as they were.
  const [leftAtStamps, setLeftAtStamps] = useState<Partial<Record<FoldName, string>>>({});
  // R160 · THE ADOPTED VOICE: whether this tab's memory was ADOPTED
  // from the estate — one flag for the whole family's cues (the
  // origin is the RECORD's, not per fold).
  const [rememberedAdopted, setRememberedAdopted] = useState(false);
  /** R148 · THE COMPASS UNFOLD: the cross-cadence badge CLICKS into
   *  the full paired-rows table — every both-rhythm row's two hands
   *  on the one compass scale, the widest badged, foldable back.
   *  The view rides the engine's rows verbatim (no second join). */
  const [compassOpen, setCompassOpen] = useState(false);
  // R145 · the turnover enders' own disclosure joins the family: the
  // whole census of below-ending rows on demand, foldable back to the
  // strongest three (count desc, name asc). Renders only when >3
  // enders exist — the data's honesty, the R143 aged-seats class.
  const [showAllTurnEnders, setShowAllTurnEnders] = useState(false);
  // R157 · the restore ride sits AFTER every fold's declaration (the
  // R156 scope lesson — the net is only as wide as the order is
  // honest): one post-mount read, only ever opening, each surface its
  // own remembered flag for the ↺ cue.
  useEffect(() => {
    const folds = readRememberedFolds();
    setLeftAtStamps(readRememberedStamps());
    // R160 · THE ADOPTED VOICE: the origin read right after this
    // effect's own read — the cues say whose memory they restored.
    setRememberedAdopted(lastFoldOrigin() === "adopted");
    if (folds.keepers) {
      setShowAllKeepers(true);
      setKeepersRemembered(true);
    }
    if (folds.compass) {
      setCompassOpen(true);
      setCompassRemembered(true);
    }
    if (folds.below) {
      setShowAllBelow(true);
      setBelowRemembered(true);
    }
    if (folds.unruledRows) {
      setShowAllUnruledRows(true);
      setUnruledRowsRemembered(true);
    }
    if (folds.turnEnders) {
      setShowAllTurnEnders(true);
      setTurnEndersRemembered(true);
    }
  }, []);

  /** THE RELAY LIT's fuel: the run's own flips as seat keys (id|at —
   *  the motion line's own identity), handed down only while held. */
  const relayKeys = useMemo(
    () =>
      handoff.longestChain
        ? new Set(handoff.longestChain.flips.map((f) => `${f.id}|${f.at}`))
        : null,
    [handoff],
  );
  /** THE LIGHT (R140 edges, R141 two faces): one spec for the motion
   *  line — the relay's run, a pair chip's edge seats, or a shared
   *  row's two faces (each face its own group color). The seat-key
   *  convention is the motion line's own identity (id|at). */
  const seatKey = useCallback((f: BoardFlip) => `${f.id}|${f.at}`, []);
  const lit: {
    kind:
      | "relay"
      | "handoff"
      | "quiet"
      | "twofaces"
      | "turnaround"
      | "delivery"
      | "below"
      | "kept"
      | "turnover";
    groups: Array<{ keys: Set<string>; color: string }>;
    label: string;
  } | null =
    relayLit && relayKeys
      ? { kind: "relay", groups: [{ keys: relayKeys, color: "#00d4e0" }], label: "the longest run" }
      : edgeLit
        ? {
            kind: edgeLit.kind,
            groups: [
              {
                keys: edgeLit.keys,
                color:
                  edgeLit.kind === "handoff"
                    ? "#e0a030"
                    : edgeLit.kind === "turnaround"
                      ? "#b8a8d8"
                      : edgeLit.kind === "below" || edgeLit.kind === "turnover"
                        ? "#7ac8d0"
                        : "#00d4e0",
              },
              // R144 · the below's second face: the changed minds among
              // the seats carry the violet — teal and violet in one
              // light (the kept light's own two-group shape).
              // R145 · kind 'turnover' rides the same shape (the ended
              // quiets in teal, the enders in violet); kind 'turnaround'
              // composes the OTHER way (violet minds, teal below seats).
              ...(edgeLit.kind === "below" && edgeLit.violetKeys && edgeLit.violetKeys.size > 0
                ? [{ keys: edgeLit.violetKeys, color: "#b8a8d8" }]
                : []),
              ...(edgeLit.kind === "turnover" && edgeLit.violetKeys && edgeLit.violetKeys.size > 0
                ? [{ keys: edgeLit.violetKeys, color: "#b8a8d8" }]
                : []),
              ...(edgeLit.kind === "turnaround" && edgeLit.tealKeys && edgeLit.tealKeys.size > 0
                ? [{ keys: edgeLit.tealKeys, color: "#7ac8d0" }]
                : []),
            ],
            label: edgeLit.label,
          }
        : deliveryLit
          ? {
              kind: "delivery",
              groups: [
                { keys: deliveryLit.deliverKeys, color: "#e0a030" },
                { keys: deliveryLit.returnKeys, color: "#b8a8d8" },
              ],
              label: deliveryLit.label,
            }
          : twoFaces
            ? {
                kind: "twofaces",
                groups: [
                  { keys: twoFaces.turnKeys, color: "#b8a8d8" },
                  { keys: twoFaces.quietKeys, color: "#00d4e0" },
                  ...(twoFaces.belowKeys && twoFaces.belowKeys.size > 0
                    ? [{ keys: twoFaces.belowKeys, color: "#7ac8d0" }]
                    : []),
                ],
                label: twoFaces.label,
              }
            : keptLit
              ? {
                  kind: "kept",
                  groups: [
                    { keys: keptLit.quietKeys, color: "#7ac8d0" },
                    { keys: keptLit.keptKeys, color: "#b8a8d8" },
                  ],
                  label: keptLit.label,
                }
              : null;

  /** COPY TAIL (R131) — the open tail exported as JSON. The engine's
   *  purity stands: the export stamps itself at the clipboard's edge
   *  (the UI owns the clock, as the sampler owns its cadence), and the
   *  fallback walks the R128 digest's execCommand path for the headless
   *  and permissionless browsers. */
  const copyTail = useCallback(async () => {
    if (!ledger) return;
    const payload = {
      what: "VVU watchboard ledger tail — the board read the record, this export reads the board",
      exportedAt: new Date().toISOString(),
      depth,
      samples: ledger.samples,
      readsRefused: ledger.readsRefused,
      spanMin: ledger.spanMin,
      spanWord: read?.spanWord ?? null,
      motionWord: read?.motionWord ?? null,
      motionRatePerHour: read?.motionRatePerHour ?? null,
      directionWord: read?.directionWord ?? null,
      concentration: read?.concentration ?? null,
      paceWord: read?.paceWord ?? null,
      medianGapMin: read?.medianGapMin ?? null,
      longestQuiet: read?.longestQuiet ?? null,
      stillRows: still.map((s) => s.name),
      weightsLadder: weightsLadder
        ? {
            holds: weightsLadder.holds,
            line: weightsLadder.line,
            rungs: weightsLadder.rungs.map((r) => ({
              depth: r.depth,
              reach: r.reach,
              total: r.total,
              carrier: r.carrier
                ? { name: r.carrier.name, count: r.carrier.count, share: r.carrier.share }
                : null,
            })),
          }
        : null,
      company: {
        line: company.line,
        readableStamps: company.readableStamps,
        soloStamps: company.soloStamps,
        ensembleStamps: company.ensembleStamps,
        maxEnsemble: company.maxEnsemble,
        maxEnsembleAt: company.maxEnsembleAt,
        clockRefused: company.clockRefused,
        pairs: company.pairs.map((p) => ({
          a: p.aName,
          b: p.bName,
          count: p.count,
          lastAt: p.lastAt,
        })),
      },
      quiets: {
        line: quiets.line,
        totalGaps: quiets.totalGaps,
        rungs: quiets.rungs.map((r) => ({
          min: r.gap.min,
          openedBy: r.gap.fromFlip.name,
          endedBy: r.gap.toFlip.name,
          at: r.gap.toFlip.at,
        })),
      },
      turnarounds: {
        line: turnarounds.line,
        roundTrips: turnarounds.roundTrips,
        reprises: turnarounds.reprises,
        clockRefused: turnarounds.clockRefused,
        rows: turnarounds.rows.map((r) => ({ name: r.name, count: r.count, seesaw: r.seesaw })),
        reversals: turnarounds.reversals.map((e) => ({
          name: e.name,
          kind: e.kind,
          from: e.from,
          to: e.to,
          at: e.at,
          departedAt: e.departedAt,
          gapMin: e.gapMin,
          span: e.span,
        })),
      },
      handoff: {
        line: handoff.line,
        handed: handoff.handed,
        kept: handoff.kept,
        chainLength: handoff.chainLength,
        strongest: handoff.strongest
          ? {
              a: handoff.strongest.aName,
              b: handoff.strongest.bName,
              count: handoff.strongest.count,
              lastAt: handoff.strongest.lastAt,
            }
          : null,
        pairs: handoff.pairs.map((p) => ({
          a: p.aName,
          b: p.bName,
          count: p.count,
          lastAt: p.lastAt,
        })),
        longestChain: handoff.longestChain
          ? {
              length: handoff.longestChain.length,
              rows: handoff.longestChain.rows.map((r) => r.name),
              from: handoff.longestChain.from,
              to: handoff.longestChain.to,
            }
          : null,
      },
      quietCompany: {
        line: quietCompanies.line,
        quiets: quietCompanies.quiets,
        companies: quietCompanies.companies,
        selfKept: quietCompanies.selfKept,
        broken: quietCompanies.broken,
        pairs: quietCompanies.pairs.map((p) => ({
          opener: p.openerName,
          ender: p.enderName,
          count: p.count,
          totalMin: p.totalMin,
          longestMin: p.longestMin,
          lastAt: p.lastAt,
        })),
      },
      sharedGround: {
        line: sharedGrounds.line,
        shared: sharedGrounds.shared,
        restless: sharedGrounds.restless,
        silent: sharedGrounds.silent,
        quiets: sharedGrounds.quiets,
        totalQuiets: sharedGrounds.totalQuiets,
        broken: sharedGrounds.broken,
        entries: sharedGrounds.entries.map((e) => ({
          name: e.name,
          turnarounds: e.turnarounds,
          seesaw: e.seesaw,
          quietParts: e.quietParts,
          selfKept: e.selfKept,
          lastAt: e.lastAt,
        })),
      },
      turnaroundEdges: {
        line: turnEdges.line,
        handed: turnEdges.handed,
        kept: turnEdges.kept,
        unseen: turnEdges.unseen,
        total: turnEdges.total,
        edges: turnEdges.edges.map((p) => ({
          a: p.aName,
          b: p.bName,
          count: p.count,
          lastAt: p.lastAt,
        })),
      },
      unruled: {
        line: unruled.line,
        total: unruled.total,
        ruled: unruled.ruled,
        unruled: unruled.unruled,
        ruledMin: unruled.ruledMin,
        unruledMin: unruled.unruledMin,
        rows: unruled.rows,
        selfKept: unruled.selfKept,
        broken: unruled.broken,
        below: unruled.below.map((g) => ({
          min: g.min,
          opener: g.fromFlip.name,
          ender: g.toFlip.name,
          enderAt: g.toFlip.at,
        })),
      },
      unruledRows: {
        line: unruledRowsRead.line,
        below: unruledRowsRead.below,
        companies: unruledRowsRead.companies,
        selfKept: unruledRowsRead.selfKept,
        rows: unruledRowsRead.rows,
        broken: unruledRowsRead.broken,
        pairs: unruledRowsRead.pairs.map((p) => ({
          opener: p.openerName,
          ender: p.enderName,
          count: p.count,
          totalMin: p.totalMin,
          longestMin: p.longestMin,
          lastAt: p.lastAt,
        })),
      },
      unruledTurnovers: {
        line: unruledTurnoversRead.line,
        total: unruledTurnoversRead.total,
        totalMin: unruledTurnoversRead.totalMin,
        turnovers: unruledTurnoversRead.turnovers,
        turnoverMin: unruledTurnoversRead.turnoverMin,
        share: unruledTurnoversRead.share,
        kept: unruledTurnoversRead.kept,
        handed: unruledTurnoversRead.handed,
        newestStrikeAt: unruledTurnoversRead.newestStrikeAt,
        newestStrikeBy: unruledTurnoversRead.newestStrikeBy,
        broken: unruledTurnoversRead.broken,
        rows: unruledTurnoversRead.rows.map((e) => ({
          name: e.name,
          count: e.count,
          totalMin: e.totalMin,
          lastAt: e.lastAt,
          cadenceMin: e.cadenceMin,
        })),
        longest: unruledTurnoversRead.longest,
      },
      keptStory: {
        line: keptStoryRead.line,
        selfKept: keptStoryRead.selfKept,
        keptEnders: keptStoryRead.keptEnders,
        rowsCount: keptStoryRead.rowsCount,
        totalMin: keptStoryRead.totalMin,
        turnarounds: keptStoryRead.turnarounds,
        slowestHomecomingMin: keptStoryRead.slowestHomecomingMin,
        pooledHomecomingMin: keptStoryRead.pooledHomecomingMin,
        homecomingIntervals: keptStoryRead.homecomingIntervals,
        newestHomeAt: keptStoryRead.newestHomeAt,
        newestHomeBy: keptStoryRead.newestHomeBy,
        broken: keptStoryRead.broken,
        rows: keptStoryRead.rows.map((r) => ({
          name: r.name,
          selfKept: r.selfKept,
          keptEnders: r.keptEnders,
          totalMin: r.totalMin,
          keptMin: r.keptMin,
          longestMin: r.longestMin,
          homecomingMin: r.homecomingMin,
          pooledCount: r.pooledCount, // R154 · the self-counted row rides the projection
          freshness: r.freshness, // R155 · the row's freshness hand rides the projection
          lastAt: r.lastAt,
        })),
      },
      crossCadence: {
        line: crossCadenceRead.line,
        paired: crossCadenceRead.paired,
        fasterAtHome: crossCadenceRead.fasterAtHome,
        fasterBelow: crossCadenceRead.fasterBelow,
        rows: crossCadenceRead.rows.map((r) => ({
          name: r.name,
          homecomingMin: r.homecomingMin,
          cadenceMin: r.cadenceMin,
          faster: r.faster,
          spread: r.spread,
          deltaMin: r.deltaMin,
          homeLastAt: r.homeLastAt,
          strikeLastAt: r.strikeLastAt,
        })),
        widest: crossCadenceRead.widest
          ? {
              name: crossCadenceRead.widest.name,
              homecomingMin: crossCadenceRead.widest.homecomingMin,
              cadenceMin: crossCadenceRead.widest.cadenceMin,
              faster: crossCadenceRead.widest.faster,
              spread: crossCadenceRead.widest.spread,
              deltaMin: crossCadenceRead.widest.deltaMin,
              homeLastAt: crossCadenceRead.widest.homeLastAt,
              strikeLastAt: crossCadenceRead.widest.strikeLastAt,
            }
          : null,
      },
      silence: silence
        ? {
            refStamp: silence.refStamp,
            deepSpanMin: silence.deepSpanMin,
            unheard: silence.unheard,
            line: silence.line,
            entries: silence.entries.map((e) => ({
              name: e.name,
              last: e.last ? { from: e.last.from, to: e.last.to, at: e.last.at } : null,
              quietSinceMin: e.quietSinceMin,
            })),
          }
        : null,
      distinctRows: ledger.distinctRows,
      flips: ledger.flips,
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(ta);
      }
    }
    setTailCopied(true);
    window.setTimeout(() => setTailCopied(false), 2000);
  }, [
    ledger,
    read,
    depth,
    still,
    silence,
    weightsLadder,
    company,
    quiets,
    turnarounds,
    handoff,
    quietCompanies,
    sharedGrounds,
    turnEdges,
    unruled,
    unruledRowsRead,
    keptStoryRead,
  ]);

  /** THE BIRTH LADDER (R134): the first words' ORDER as narrative —
   *  which row the tail heard first, which last, at what cadence the
   *  births arrived. Derives from the same chronological flips the
   *  motion line reads (the filter follows; the caption qualifies when
   *  filtered). */
  const birthRead = useMemo(() => birthLadder(filteredChrono), [filteredChrono]);
  /** THE WEIGHT (R134): who carries the tail's motion — every moved
   *  row's share of the open tail's flips, heaviest first. */
  const weights = useMemo(() => motionWeights(filteredChrono), [filteredChrono]);
  const weightTotal = filteredChrono.length;
  const census = useMemo(() => {
    const m = new Map<string, { name: string; count: number; latestTone: string | null }>();
    for (const f of ledger?.flips ?? []) {
      const cur = m.get(f.id);
      if (cur) cur.count += 1;
      else m.set(f.id, { name: f.name, count: 1, latestTone: null });
    }
    // newest first: the first flip seen per row IS its latest landing
    for (const f of flipsNewestFirst) {
      const cur = m.get(f.id);
      if (cur && cur.latestTone === null) cur.latestTone = f.toTone;
    }
    return [...m.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 6);
  }, [ledger, flipsNewestFirst]);
  const filtered = filter ? flipsNewestFirst.filter((f) => f.id === filter) : flipsNewestFirst;
  const shown = filtered.slice(0, 7);
  const more = filtered.length - shown.length;

  return (
    <div
      className="mt-1.5 rounded-sm border border-[#3a4530]/50 bg-black/20 px-2 py-1.5 transition-colors duration-200 hover:border-[#4a5a3e]"
      data-testid="board-ledger"
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <History className="h-2.5 w-2.5 text-[#00d4e0]" aria-hidden />
        <span
          className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#7a8a6e] cursor-help"
          title="THE BOARD'S OWN LEDGER (R128): the board reads the record; the ledger reads the board. After each read the panel fires one sampler POST — the server composes the board itself (the client sends nothing) and the store keeps the sample ONLY when the words moved (signature dedupe). The lane renders the flips — old word → new word, dated by the board's own build stamp — and the hot-count sparkline across the moved samples. A read stays side-effect-free (the R125 contract); the ledger's writes are its OWN store, the words' motion, nothing else."
        >
          THE BOARD&apos;S OWN LEDGER
        </span>
        {ledger && (
          <span
            className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10 cursor-help transition-[filter] hover:brightness-125"
            title="moved samples kept (the newest 24 of the newest 200 are rendered from) · flips derived between consecutive moved samples · the minutes the tail spans"
          >
            {ledger.samples} MOVED · {ledger.flips.length} FLIP
            {ledger.flips.length === 1 ? "" : "S"}
            {ledger.spanMin !== null
              ? ` · SPAN ${ledger.spanMin >= 100 ? Math.round(ledger.spanMin) : ledger.spanMin.toFixed(1)}′`
              : ""}
            {ledger.readsRefused !== null && ledger.readsRefused > 0
              ? ` · ${ledger.readsRefused} REFUSED`
              : ""}
          </span>
        )}
        {ledger && (
          <button
            onClick={() => void copyTail()}
            aria-live="polite"
            aria-label={copyTailAria(tailCopied, {
              samples: ledger.samples,
              flips: ledger.flips.length,
              spanMin: ledger.spanMin,
            })}
            className={`vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border cursor-pointer transition-[filter,border-color,color] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00] ${tailCopied ? "border-[#c8ff00]/70 text-[#c8ff00] bg-[#c8ff00]/10 shadow-[0_0_6px_rgba(200,255,0,0.2)]" : "border-[#3a4530] text-[#7a8a6e] bg-black/30 hover:text-[#c9d4e0] hover:border-[#4a5a3e]"}`}
            title="COPY TAIL (R131): the open tail exported to the clipboard as JSON — the depth it came from, the read's own words (motion · span scale · direction · concentration) and every flip with the board's own stamps. An export is a reading, not a write: nothing on the estate moves when it fires. R184 · THE TAIL'S VOICE: the offer and its COPIED confirmation ride the aria — the tail's own census (the moved samples, the flips, the span in the chip's own rounding), the export's honesty spoken — heard without hovering."
            data-testid="board-ledger-copy-tail"
          >
            {tailCopied ? (
              <>
                <Check className="h-2 w-2 text-[#c8ff00]" aria-hidden /> COPIED
              </>
            ) : (
              <>
                <ClipboardCopy className="h-2 w-2" aria-hidden /> COPY TAIL
              </>
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="vvu-label mt-1 text-[6px] leading-relaxed text-[#e5484d]">
          THE LEDGER STORE REFUSED THE SAMPLE · {error} — the read side is untouched; the lane
          renders its refusal
        </p>
      )}

      {!error && !ledger && (
        <p
          className="vvu-label mt-1 text-[6px] leading-relaxed text-[#7a8a6e] cursor-help"
          title="the sampler answers after the board's first successful read — the ledger waits, honestly empty"
        >
          THE LEDGER WAITS · no sample answered yet — the board&apos;s words have not been sampled
          since the ledger woke
        </p>
      )}

      {ledger && ledger.samples === 0 && (
        <p className="vvu-label mt-1 text-[6px] leading-relaxed text-[#7a8a6e]">
          THE LEDGER IS EMPTY · the store holds no moved board — the words have not moved since the
          ledger woke
        </p>
      )}

      {ledger && ledger.samples === 1 && (
        <p className="vvu-label mt-1 text-[6px] leading-relaxed text-[#7a8a6e]">
          ONE MOVED SAMPLE · the motion needs a second sample to derive — the next word change lands
          the first flip
        </p>
      )}

      {read && (
        <div
          className="mt-1.5 rounded-sm border border-[#3a4530]/40 bg-black/30 px-2 py-1.5"
          data-testid="board-ledger-read"
        >
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <Activity className="h-2.5 w-2.5 text-[#7a8a6e]" aria-hidden />
            <span
              className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#7a8a6e] cursor-help"
              title="THE LEDGER'S OWN READ (R129): the tail's story, spoken from the summary alone — the motion rate (flips per hour over the span), the hot-count's direction (first-half median vs second-half median — the storm-history convention), the motion's concentration (the busiest row's share), and the pace (R132: the gaps' median — staccato ≤2′ · brisk ≤6′ · steady ≤12′ · sparse above — and the longest quiet, named with the row that ended it). The bands are this read's own calibration: quiet ≤2 · moving ≤8 · churning ≤20 · storming above, INCLUSIVE at every named bound; the direction band is exclusive past ±10% (the drift row's own convention). A churning board is a restless mirror, not a storm report — the read measures the BOARD's words, never the record's kills."
            >
              THE LEDGER&apos;S OWN READ
            </span>
            <span
              className={`vvu-label text-[6px] font-bold px-1 py-px rounded-sm border cursor-help transition-[filter] hover:brightness-125 ${MOTION_TONE[read.motionWord]}`}
              title={
                read.motionWord === "NO SPAN"
                  ? "no readable span — a point is not a motion"
                  : `${read.motionRatePerHour?.toFixed(1)} flips/hour over the tail's span — the bands are inclusive at the named bounds`
              }
              data-testid="board-ledger-motion-word"
            >
              {read.motionWord}
            </span>
            {read.spanWord !== "NO SPAN" && (
              <span
                className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-[#a78bfa]/60 text-[#a78bfa] bg-[#a78bfa]/10 cursor-help transition-[filter] hover:brightness-125"
                title={`THE HOUR HAND (R131): the scale the tail's span has reached — minute <${LEDGER_SPAN_BANDS.minute}′ · quarter <${LEDGER_SPAN_BANDS.quarter}′ · half-hour <${LEDGER_SPAN_BANDS.halfHour}′ · hour-scale at or past ${LEDGER_SPAN_BANDS.halfHour}′ (the bound begins the scale). A rate without its span is a number without its unit: the motion word says how fast, this badge says how LONG a run that speed stood on. At depth 200 the tail reaches the store's whole two-hundred-move memory — an hour-scale read is an era witness, a minute-scale read a churn watch.`}
                data-testid="board-ledger-span-word"
              >
                {read.spanWord}
              </span>
            )}
            {read.directionWord !== "NO TREND" && (
              <span
                className={`vvu-label text-[6px] font-bold px-1 py-px rounded-sm border cursor-help transition-[filter] hover:brightness-125 ${read.directionWord === "HEATING" ? "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10" : read.directionWord === "COOLING" ? "border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10" : "border-[#3a4530] text-[#c9d4bd] bg-black/30"}`}
                title={`first-half median ${read.firstHalfMedianHot} vs second-half ${read.secondHalfMedianHot} — a full ±10% move is a move`}
                data-testid="board-ledger-direction-word"
              >
                {read.directionWord}
              </span>
            )}
            {read.concentrationWord !== "NO FLIPS" && read.concentration && (
              <button
                onClick={() =>
                  setFilter(filter === read.concentration!.id ? null : read.concentration!.id)
                }
                aria-pressed={filter === read.concentration.id}
                aria-label={rowFilterChipAria(
                  read.concentration.name,
                  filter === read.concentration.id,
                )}
                className={`vvu-label text-[6px] font-bold px-1 py-px rounded-sm border cursor-pointer transition-[filter,border-color,box-shadow] hover:brightness-125 ${filter === read.concentration.id ? "border-[#c8ff00]/70 text-[#c8ff00] bg-[#c8ff00]/10 shadow-[0_0_6px_rgba(200,255,0,0.2)]" : "border-[#3a4530] text-[#7a8a6e] bg-black/30 hover:text-[#c9d4bd]"} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]`}
                title={`${read.concentration.name} — ${read.concentration.count} of ${ledger?.flips.length ?? 0} flips (${(read.concentration.share * 100).toFixed(0)}%) — click to filter the flips list to this row. R189 · THE PRESSED ROWS: the offer and the pressed state ride the aria — heard without hovering.`}
                data-testid="board-ledger-concentration"
              >
                {read.concentrationWord === "CONCENTRATED" ? "CONCENTRATED" : "CENTRED"} ·{" "}
                {read.concentration.name}
              </button>
            )}
            <span
              className={`vvu-label text-[6px] font-bold px-1 py-px rounded-sm border cursor-help transition-[filter] hover:brightness-125 ${PACE_TONE[read.paceWord]}`}
              title={
                read.paceWord === "NO GAPS"
                  ? "no honest gap between the tail's flips — the pace refuses (the quiet hand, R132)"
                  : `THE QUIET HAND (R132): the gaps between consecutive flips — median ${read.medianGapMin?.toFixed(1) ?? "—"}′. Bands inclusive at every named bound: staccato ≤${LEDGER_PACE_BANDS.staccato}′ · brisk ≤${LEDGER_PACE_BANDS.brisk}′ · steady ≤${LEDGER_PACE_BANDS.steady}′ · sparse above. The longest quiet is named with the ROW that ended it — the pace measures the board's words, never the record's kills.`
              }
              data-testid="board-ledger-pace-word"
            >
              {read.paceWord}
            </span>
          </div>
          <div className="mt-0.5" data-testid="board-ledger-read-lines">
            {read.lines.map((line, i) => (
              <p
                key={i}
                className="vvu-label text-[6px] leading-relaxed text-[#c9d4bd] cursor-help"
                title={line}
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      )}

      {ledger && ledger.samples >= 2 && (
        <>
          {ledger.hotSeries.length > 1 && (
            <div className="mt-1" data-testid="board-ledger-spark">
              <HotSpark series={ledger.hotSeries} />
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span
              className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#5f6e55] cursor-help"
              title="THE LEDGER'S DEPTH (R130): how many of the store's newest moved boards the tail reads from — the default 24, or deeper (48 · 96 · 200, the store's own prune bound). A depth read is a GET against the store alone: no board composition, no journal parse, no writes — the depth reads the ledger. The read, the spark and the census re-derive from whatever depth is open."
            >
              DEPTH ·
            </span>
            {[...LEDGER_DEPTHS].map((n) => (
              <button
                key={n}
                onClick={() => {
                  setDepth(n);
                  onDepthChange(n);
                }}
                aria-pressed={depth === n}
                aria-label={depthChipAria(n, depth === n)}
                className={`vvu-label text-[6px] font-bold px-1 py-px rounded-sm border cursor-pointer transition-[filter,transform,border-color,box-shadow] hover:brightness-125 active:translate-y-px ${depth === n ? "border-[#00d4e0]/70 text-[#00d4e0] bg-[#00d4e0]/10 shadow-[0_0_6px_rgba(0,212,224,0.25)]" : "border-[#3a4530] text-[#7a8a6e] bg-black/30 hover:text-[#c9d4bd]"} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]`}
                title={`read the newest ${n} moved samples (the store keeps 200). R185 · THE RAIL'S VOICE: the deed and the open-depth state ride the aria — heard without hovering.`}
                data-testid={`board-ledger-depth-${n}`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-1" data-testid="board-ledger-motionline">
            <MotionLine flips={filteredChrono} filtered={filter !== null} depth={depth} lit={lit} />
          </div>
          {birthRead.births.length > 0 && (
            <div className="mt-1" data-testid="board-ledger-birthladder">
              <div className="flex flex-wrap items-center gap-1">
                <span
                  className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#a78bfa]/80 cursor-help"
                  title="THE BIRTH LADDER (R134): the first words' ORDER as narrative — which row the tail heard first, which last, and at what cadence the births arrived. Numbered by birth order (firstWords' own contract); the waits are tail-relative (from the tail's own first flip, never the wall clock) and depth-relative by definition — the depth chips are the reach. A chip clicks into its row's motion."
                >
                  BIRTH LADDER ·
                </span>
                {birthRead.births.map((b) => {
                  const isFirst = b.ordinal === 1;
                  const isLast =
                    b.ordinal === birthRead.births.length && birthRead.births.length > 1;
                  const wait =
                    b.waitMin !== null
                      ? `${b.waitMin >= 100 ? Math.round(b.waitMin) : b.waitMin.toFixed(1)}′ into the tail`
                      : "the tail's first stamp refuses the wait";
                  const since =
                    b.sincePrevMin !== null
                      ? ` · ${b.sincePrevMin >= 100 ? Math.round(b.sincePrevMin) : b.sincePrevMin.toFixed(1)}′ after the previous birth`
                      : "";
                  return (
                    <button
                      key={`${b.flip.id}-${b.flip.at}`}
                      onClick={() => setFilter(filter === b.flip.id ? null : b.flip.id)}
                      aria-pressed={filter === b.flip.id}
                      aria-label={rowFilterChipAria(b.flip.name, filter === b.flip.id)}
                      className={`vvu-label inline-flex items-center gap-0.5 text-[6px] font-bold px-1 py-px rounded-sm border cursor-pointer transition-[filter,transform,border-color,color,box-shadow] hover:brightness-125 hover:-translate-y-px ${filter === b.flip.id ? "border-[#c8ff00]/70 text-[#c8ff00] bg-[#c8ff00]/10 shadow-[0_0_6px_rgba(200,255,0,0.2)]" : "border-[#2a3324] text-[#9a8ac0] bg-black/20 hover:text-[#c9d4e0] hover:border-[#4a3e5a]"} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]`}
                      title={`${b.ordinal}. ${b.flip.name}'s first word — ${b.flip.from} → ${b.flip.to} @ ${stampOf(b.flip.at)} UTC · ${wait}${since} — click to read this row's motion. R189 · THE PRESSED ROWS: the offer and the pressed state ride the aria.`}
                      data-testid={`board-ledger-birth-${b.flip.id}`}
                    >
                      <span
                        className={`inline-flex h-[9px] min-w-[9px] items-center justify-center rounded-full px-0.5 text-[5px] font-bold leading-none ${filter === b.flip.id ? "border border-[#c8ff00]/70 bg-[#c8ff00]/15 text-[#c8ff00]" : isFirst ? "border border-[#00d4e0]/50 bg-[#00d4e0]/20 text-[#00d4e0]" : isLast ? "border border-[#a78bfa]/50 bg-[#a78bfa]/20 text-[#a78bfa]" : "border border-[#3a4530] bg-[#2a3324]/60 text-[#7a8a6e]"}`}
                        aria-hidden
                      >
                        {b.ordinal}
                      </span>
                      {b.flip.name}
                    </button>
                  );
                })}
              </div>
              <p
                className="vvu-label mt-0.5 text-[5.5px] leading-relaxed text-[#a78bfa]/80 cursor-help"
                title={birthRead.line}
                data-testid="board-ledger-birthladder-line"
              >
                ○ {birthRead.line}
                {filter !== null ? " (within this row's motion)" : ""}
              </p>
            </div>
          )}
          {weights.length > 0 && weightTotal > 0 && weights[0] && (
            <div className="mt-1" data-testid="board-ledger-weight">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span
                  className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#5f6e55] cursor-help"
                  title="THE WEIGHT (R134): who carries the tail's motion — every moved row's share of the open tail's flips, one stacked bar, colored by each row's newest landing tone. The engine's share is never clamped; a thin segment is clamped in display only (said in its tooltip) so it stays clickable. A segment clicks into its row's motion; the bar glides when the depth re-derives."
                >
                  MOTION&apos;S WEIGHT ·
                </span>
                <span
                  className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-[#e0a030]/50 text-[#e0a030] bg-[#e0a030]/10 cursor-help transition-[filter] hover:brightness-125"
                  title={`${weights[0].name} carries the tail's motion: ${weights[0].count} of ${weightTotal} flips (${(weights[0].share * 100).toFixed(0)}%) — the heaviest share (count desc, name asc as the tiebreak)`}
                  data-testid="board-ledger-weight-carrier"
                >
                  {weights[0].name} CARRIES {(weights[0].share * 100).toFixed(0)}%
                </span>
              </div>
              <div
                className="mt-0.5 flex h-[7px] w-full overflow-hidden rounded-sm border border-[#2a3324]/70 bg-black/40 shadow-[inset_0_0_2px_rgba(0,0,0,0.8)]"
                role="img"
                aria-label={`the tail's motion weight — ${weights.length} rows share ${weightTotal} flips, heaviest ${weights[0].name}`}
                data-testid="board-ledger-weight-bar"
              >
                {weights.map((w, wi) => {
                  const fill = MOTION_TONE_FILL[w.tone] ?? MOTION_TONE_FILL.neutral!;
                  const rawPct = w.share * 100;
                  const clamped = rawPct < 1.5;
                  const pct = Math.max(rawPct, 1.5);
                  // R135 style pass — the end caps: the bar's first
                  // and last segments carry the container's rounding
                  // so the stacked bar reads as ONE instrument.
                  const cap =
                    wi === 0 ? "rounded-l-sm" : wi === weights.length - 1 ? "rounded-r-sm" : "";
                  return (
                    <button
                      key={w.id}
                      onClick={() => setFilter(filter === w.id ? null : w.id)}
                      aria-pressed={filter === w.id}
                      aria-label={rowFilterChipAria(w.name, filter === w.id)}
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(180deg, ${fill}66, ${fill}22)`,
                        boxShadow:
                          filter === w.id
                            ? `inset 0 0 0 0.5px ${fill}55, 0 0 6px rgba(200,255,0,0.2)`
                            : `inset 0 0 0 0.5px ${fill}55`,
                      }}
                      className={`h-full cursor-pointer border-r border-black/60 transition-[width,filter,box-shadow] duration-700 last:border-r-0 hover:brightness-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#c8ff00] ${filter === w.id ? "brightness-150" : ""} ${cap}`}
                      title={`${w.name}: ${w.count} of ${weightTotal} flips (${rawPct.toFixed(1)}%)${clamped ? " · display-clamped to stay clickable — this tooltip carries the true share" : ""} · latest landing ${w.tone} — click to read this row's motion. R189 · THE PRESSED ROWS: the segment's silent button is named — row, deed, pressed state.`}
                      data-testid={`board-ledger-weight-${w.id}`}
                    />
                  );
                })}
              </div>
              <p
                className="vvu-label mt-0.5 text-[5.5px] leading-relaxed text-[#5f6e55] cursor-help"
                title="the weight's ruler, said: the bar is the open tail's flips split by row, heaviest first; the shares re-derive from whatever depth is open — the depth chips are the reach"
              >
                ⌇ {weights.length} row{weights.length === 1 ? "" : "s"} share the tail&apos;s{" "}
                {weightTotal} flip{weightTotal === 1 ? "" : "s"} — heaviest first, colored by each
                row&apos;s newest landing{filter !== null ? " (within this row's motion)" : ""}
              </p>
              {weightsLadder && weightsLadder.rungs.length > 0 && (
                <div
                  className="mt-1 rounded-sm border border-[#2a3324]/70 bg-black/20 px-1.5 py-1"
                  data-testid="board-ledger-weight-ladder"
                >
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <Scaling className="h-2.5 w-2.5 text-[#a78bfa]/80" aria-hidden />
                    <span
                      className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#a78bfa]/80 cursor-help"
                      title="THE WEIGHT LADDER (R135): the carrier read ACROSS the depths — every rung is the R130 depth read's own arithmetic at that depth (the store's actual reach, said in its tooltip), so a rung's numbers are the numbers the depth chips would show. A share is never quoted naked: every rung names its depth. A rung whose carrier differs from the previous spoken rung wears the cyan edge — the crown moving. A rung clicks its depth open."
                    >
                      WEIGHT BY DEPTH ·
                    </span>
                    {weightsLadder.rungs.map((rung, ri) => {
                      const active = depth === rung.depth;
                      const c = rung.carrier;
                      const prev = ri > 0 ? weightsLadder.rungs[ri - 1] : null;
                      const crownMoved =
                        c !== null && prev?.carrier != null && prev.carrier.id !== c.id;
                      const pct = c !== null ? c.share * 100 : 0;
                      const barPct = c !== null ? Math.max(pct, 4) : 0;
                      const fill = c
                        ? (MOTION_TONE_FILL[c.tone] ?? MOTION_TONE_FILL.neutral!)
                        : MOTION_TONE_FILL.neutral!;
                      return (
                        <button
                          key={rung.depth}
                          onClick={() => {
                            setDepth(rung.depth);
                            onDepthChange(rung.depth);
                          }}
                          className={`vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border cursor-pointer transition-[filter,transform,border-color,color] hover:brightness-125 hover:-translate-y-px active:translate-y-0 ${active ? "border-[#00d4e0]/70 text-[#00d4e0] bg-[#00d4e0]/10" : crownMoved ? "border-[#00d4e0]/40 text-[#9ad8de] bg-black/20" : "border-[#2a3324] text-[#9a8ac0] bg-black/20 hover:text-[#c9d4e0] hover:border-[#4a3e5a]"} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]`}
                          title={
                            c
                              ? `depth ${rung.depth} (the store ruled ${rung.reach}): ${c.name} carries ${c.count} of ${rung.total} flips (${pct.toFixed(1)}%) — click to open this depth; the ladder reads every chip at once`
                              : `depth ${rung.depth} (the store ruled ${rung.reach}): no flips within this reach — nobody carries an empty tail. Click to open this depth.`
                          }
                          data-testid={`board-ledger-weight-rung-${rung.depth}`}
                        >
                          <span className="opacity-80">{rung.depth}</span>
                          <span
                            className="inline-block h-[3px] w-[26px] overflow-hidden rounded-full bg-black/50 align-middle"
                            aria-hidden
                          >
                            {c !== null && (
                              <span
                                className="block h-full rounded-full transition-[width] duration-500"
                                style={{
                                  width: `${barPct}%`,
                                  background: `linear-gradient(90deg, ${fill}cc, ${fill}55)`,
                                }}
                              />
                            )}
                          </span>
                          <span>
                            {c ? `${c.name} ${(c.share * 100).toFixed(0)}%` : "NO MOTION"}
                          </span>
                          {crownMoved && (
                            <span
                              className="text-[5px] text-[#00d4e0]/90 cursor-help"
                              title="the crown moved here — this rung's carrier differs from the previous spoken rung's"
                            >
                              ⌁
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p
                    className="vvu-label mt-0.5 text-[5.5px] leading-relaxed text-[#a78bfa]/80 cursor-help"
                    title={weightsLadder.line}
                    data-testid="board-ledger-weight-ladder-line"
                  >
                    ⌇ {weightsLadder.line}
                    {weightsLadder.holds === true
                      ? " — the shares still move with the depth: quote them beside their chips"
                      : ""}
                  </p>
                </div>
              )}
            </div>
          )}
          {company.pairs.length > 0 && (
            <div
              className="mt-1 rounded-sm border border-[#2a3324]/70 bg-black/20 px-1.5 py-1 transition-colors duration-200 hover:border-[#3a4530]"
              data-testid="board-ledger-company"
            >
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <Users className="h-2.5 w-2.5 text-[#00d4e0]/80" aria-hidden />
                <span
                  className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#00d4e0]/80 cursor-help"
                  title="THE COMPANY (R136): who moves WITH whom — flips landing on the SAME board stamp (one transition, several rows) are company. The engine's one clock-free read: the stamp string is the transition's identity, so grouping needs no minute — a company needs no clock, only the board's own word that two moves were seen at once. A pair clicks into its senior row's motion (name-asc is the orientation, said here so the click's row is never a surprise); the tooltip carries both rows' words on the last shared stamp."
                >
                  THE COMPANY ·
                </span>
                {company.maxEnsemble >= 2 && (
                  <span
                    className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-[#00d4e0]/50 text-[#00d4e0] bg-[#00d4e0]/10 cursor-help transition-[filter] hover:brightness-125"
                    title={`${company.maxEnsemble} rows moved together at most — the largest ensemble landed @ ${company.maxEnsembleAt ? stampOf(company.maxEnsembleAt) : "—"} UTC. ${company.ensembleStamps} of ${company.readableStamps} stamps carried company; ${company.soloStamps} moved alone.`}
                    data-testid="board-ledger-company-ensemble"
                  >
                    ⌁ {company.maxEnsemble} TOGETHER
                  </span>
                )}
                <span
                  className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-[#2a3324] text-[#5f6e55] bg-black/30 cursor-help transition-[filter] hover:brightness-125"
                  title={`${company.pairs.length} distinct pair${company.pairs.length === 1 ? "" : "s"} shared at least one stamp · ${company.soloStamps} of ${company.readableStamps} stamps moved alone (${((company.soloShare ?? 0) * 100).toFixed(0)}%) · the read is clock-free: stamps group by string identity${company.clockRefused > 0 ? ` · ${company.clockRefused} flip${company.clockRefused === 1 ? "" : "s"} carry stamps the clock refuses (grouped anyway, said in the line)` : ""}`}
                  data-testid="board-ledger-company-census"
                >
                  {company.ensembleStamps} IN COMPANY · {company.soloStamps} SOLO
                </span>
                {company.pairs.slice(0, 6).map((p) => (
                  <button
                    key={`${p.aId}|${p.bId}`}
                    onClick={() => setFilter(filter === p.aId ? null : p.aId)}
                    aria-pressed={filter === p.aId || filter === p.bId}
                    aria-label={rowFilterChipAria(
                      `${p.aName} ⇄ ${p.bName}`,
                      filter === p.aId || filter === p.bId,
                    )}
                    className={`vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border cursor-pointer transition-[filter,transform,border-color,color,box-shadow] hover:brightness-125 hover:-translate-y-px active:translate-y-0 ${filter === p.aId || filter === p.bId ? "border-[#c8ff00]/70 text-[#c8ff00] bg-[#c8ff00]/10 shadow-[0_0_6px_rgba(200,255,0,0.2)]" : "border-[#2a3324] text-[#9ad8de] bg-black/20 hover:text-[#c9d4e0] hover:border-[#1e4a50]"} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]`}
                    title={`${p.aName} ⇄ ${p.bName} — ${p.count} shared stamp${p.count === 1 ? "" : "s"}, last @ ${p.lastAt ? stampOf(p.lastAt) : "—"} UTC · ${p.lastA ? `${p.lastA.from} → ${p.lastA.to}` : "—"} · ${p.lastB ? `${p.lastB.from} → ${p.lastB.to}` : "—"} — click to read ${p.aName}'s motion (the senior row, name-asc). R189 · THE PRESSED ROWS: the offer and the pressed state ride the aria.`}
                    data-testid={`board-ledger-company-${p.aId}-${p.bId}`}
                  >
                    {p.lastA && (
                      <span
                        className={`inline-block h-1 w-1 rounded-full ${FLIP_TONE_DOT[p.lastA.toTone] ?? FLIP_TONE_DOT.neutral!}`}
                        aria-hidden
                      />
                    )}
                    {p.lastB && (
                      <span
                        className={`inline-block h-1 w-1 rounded-full ${FLIP_TONE_DOT[p.lastB.toTone] ?? FLIP_TONE_DOT.neutral!}`}
                        aria-hidden
                      />
                    )}
                    {p.aName} ⇄ {p.bName}
                    <span
                      className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-current opacity-80"
                      aria-hidden
                    >
                      ×{p.count}
                    </span>
                  </button>
                ))}
                {company.pairs.length > 6 && (
                  <span
                    className="vvu-label text-[6px] text-[#5f6e55] cursor-help"
                    title={`${company.pairs.length - 6} more pair${company.pairs.length - 6 === 1 ? "" : "s"} in the tail's company — the strongest six render (count desc, name asc)`}
                  >
                    +{company.pairs.length - 6} more pairs
                  </span>
                )}
              </div>
              <p
                className="vvu-label mt-0.5 text-[5.5px] leading-relaxed text-[#00d4e0]/70 cursor-help"
                title={company.line}
                data-testid="board-ledger-company-line"
              >
                ⌇ {company.line}
              </p>
            </div>
          )}
          {census.length > 1 && (
            <div
              className="mt-1 flex flex-wrap items-center gap-1"
              data-testid="board-ledger-filters"
            >
              <span
                className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#5f6e55] cursor-help"
                title="the rows that moved in the tail, by flip count — click one to read its own motion"
              >
                MOTION BY ROW ·
              </span>
              <button
                onClick={() => setFilter(null)}
                aria-pressed={filter === null}
                aria-label={filterAllAria(filter === null)}
                className={`vvu-label text-[6px] font-bold px-1 py-px rounded-sm border cursor-pointer transition-[filter,transform,border-color,box-shadow] hover:brightness-125 active:translate-y-px ${filter === null ? "border-[#c8ff00]/70 text-[#c8ff00] bg-[#c8ff00]/10 shadow-[0_0_6px_rgba(200,255,0,0.2)]" : "border-[#3a4530] text-[#7a8a6e] bg-black/30 hover:text-[#c9d4bd]"} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]`}
                title="show every flip in the tail, newest first. R185 · THE RAIL'S VOICE: the deed and the unfiltered calm ride the aria — heard without hovering."
                data-testid="board-ledger-filter-all"
              >
                ALL
              </button>
              {census.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setFilter(filter === c.id ? null : c.id)}
                  className={`vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border cursor-pointer transition-[filter,transform,border-color] hover:brightness-125 active:translate-y-px ${filter === c.id ? "border-[#c8ff00]/70 text-[#c8ff00] bg-[#c8ff00]/10" : "border-[#3a4530] text-[#7a8a6e] bg-black/30 hover:text-[#c9d4bd]"} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]`}
                  title={`${c.name}: ${c.count} flip${c.count === 1 ? "" : "s"} in the tail, latest landing ${c.latestTone ?? "unknown"} — click to filter to this row's motion`}
                  data-testid={`board-ledger-filter-${c.id}`}
                >
                  {c.latestTone && (
                    <span
                      className={`inline-block h-1 w-1 rounded-full ${FLIP_TONE_DOT[c.latestTone as WatchTone] ?? FLIP_TONE_DOT.neutral!}`}
                      aria-hidden
                    />
                  )}
                  {c.name} ×{c.count}
                </button>
              ))}
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1" data-testid="board-ledger-flips">
            {shown.length === 0 && filter && still.some((s) => s.id === filter) && (
              <span
                className="vvu-label text-[6px] text-[#7a8a6e]"
                data-testid="board-ledger-still-empty"
              >
                THE ROW IS STILL · {still.find((s) => s.id === filter)?.name} has not moved within
                the open depth ({depth} moved samples) — its word rides{" "}
                {still.find((s) => s.id === filter)?.word}; the depth chips are the reach
              </span>
            )}
            {shown.length === 0 && filter && !still.some((s) => s.id === filter) && (
              <span className="vvu-label text-[6px] text-[#7a8a6e]">
                no flips for {census.find((c) => c.id === filter)?.name ?? filter} in the rendered
                tail — the row moved outside the newest samples
              </span>
            )}
            {shown.length === 0 && !filter && (
              <span className="vvu-label text-[6px] text-[#7a8a6e]">
                {ledger.samples} moved sample{ledger.samples === 1 ? "" : "s"} · the tail&apos;s
                consecutive pairs read identical words — the motion is structural, the flips list
                waits
              </span>
            )}
            {shown.map((f, i) => (
              <FlipChip key={`${f.id}-${f.at}-${i}`} flip={f} />
            ))}
            {more > 0 && (
              <span
                className="vvu-label text-[6px] text-[#5f6e55] cursor-help"
                title={`${more} older flip(s) in the tail — the store keeps the newest 200 moved boards`}
              >
                +{more} more in the tail
              </span>
            )}
          </div>
          {still.length > 0 && ledger.samples >= 2 && (
            <div
              className="mt-1 flex flex-wrap items-center gap-1"
              data-testid="board-ledger-still"
            >
              <span
                className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#5f6e55] cursor-help"
                title="THE STILL CENSUS (R132): the board's rows the open tail never heard move — the silence the ledger's motion census does not show. Depth-relative by construction: a row still within this depth may have moved deeper (the depth chips are the reach). A still chip clicks into the same row filter — its honest empty is the census's answer."
              >
                STILL WITHIN {depth} · {still.length} —
              </span>
              {still.map((s) => {
                // R133 — the chip's own past rides its tooltip: the
                // store's silence read answers WHEN this row was last
                // heard (or that the store's whole reach never heard it).
                const e = silenceById.get(s.id) ?? null;
                const lastNote = !e
                  ? "the store's silence read has not answered for this row yet"
                  : e.last && e.quietSinceMin !== null
                    ? `last heard ${e.quietSinceMin >= 100 ? Math.round(e.quietSinceMin) : e.quietSinceMin.toFixed(1)}′ ago: ${e.last.from} → ${e.last.to} @ ${stampOf(e.last.at)} UTC`
                    : e.last
                      ? `last heard @ ${stampOf(e.last.at)} UTC (its stamp refuses the quiet's arithmetic)`
                      : "the store's whole reach (the newest 200 moved boards) has NEVER heard it move";
                return (
                  <button
                    key={s.id}
                    onClick={() => setFilter(filter === s.id ? null : s.id)}
                    className={`vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-dashed cursor-pointer transition-[filter,border-color,border-style,color] hover:brightness-125 ${filter === s.id ? "border-solid border-[#c8ff00]/70 text-[#c8ff00] bg-[#c8ff00]/10" : "border-[#2a3324] text-[#5f6e55] bg-black/20 hover:text-[#c9d4bd] hover:border-[#4a5a3e]"} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]`}
                    title={`${s.name} — no flip of this row within the open depth; its word rides ${s.word} (${s.tone}). ${lastNote}. Click to read its (empty) motion — the honest empty is the answer, the depth chips are the reach.`}
                    data-testid={`board-ledger-still-${s.id}`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
          {still.length > 0 && ledger.samples >= 2 && ladder.length > 0 && (
            <div
              className="mt-1 rounded-sm border border-[#2a3324]/70 bg-black/20 px-2 py-1.5 transition-colors duration-200 hover:border-[#3a4530]"
              data-testid="board-ledger-silence"
            >
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <VolumeX className="h-2.5 w-2.5 text-[#5f6e55]" aria-hidden />
                <span
                  className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#7a8a6e] cursor-help"
                  title="THE SILENCE LADDER (R133): the still census's own past — for every row the open tail never heard, the store's whole reach (the newest 200 moved boards) answers WHEN it was last heard and how long it has been quiet since. The bars are ruled against the store's own span (the deep tail's first-to-last flip), never the wall clock; the display ladders loudest-first (a display reading — the engine keeps the census's board order). A row the store never heard renders NO bar: a bar needs a number, and the store has none. The silence measures the board's words; the record holds the deaths — the mirror rule stands here too."
                >
                  THE SILENCE LADDER
                </span>
                <span
                  className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-[#2a3324] text-[#5f6e55] bg-black/30 cursor-help transition-[filter] hover:brightness-125"
                  title="the still rows laddered · the rows the store's whole reach has never heard (rendered bar-less, the strongest silence)"
                >
                  {ladder.length} STILL · {silence?.unheard ?? 0} UNHEARD
                </span>
              </div>
              {silence && (
                <p
                  className="vvu-label mt-0.5 text-[6px] leading-relaxed text-[#c9d4bd] cursor-help"
                  title={silence.line}
                  data-testid="board-ledger-silence-line"
                >
                  {silence.line}
                  {silence.refStamp
                    ? ` (measured to ${stampOf(silence.refStamp)} UTC, the store's newest readable stamp)`
                    : ""}
                </p>
              )}
              <div className="mt-1 flex flex-col gap-0.5" data-testid="board-ledger-silence-rows">
                {ladder.map(({ row: s, entry }) => {
                  const q = entry?.quietSinceMin ?? null;
                  const last = entry?.last ?? null;
                  const ruler = silence?.deepSpanMin ?? null;
                  const rulerVal = ruler !== null && ruler > 0 ? ruler : null;
                  const pct =
                    q !== null && rulerVal !== null
                      ? Math.min(100, Math.max(2.5, (q / rulerVal) * 100))
                      : null;
                  const fill = last
                    ? (MOTION_TONE_FILL[last.toTone] ?? MOTION_TONE_FILL.neutral!)
                    : MOTION_TONE_FILL.neutral!;
                  const beyondOpen =
                    q !== null &&
                    ledger.spanMin !== null &&
                    ledger.spanMin > 0 &&
                    q > ledger.spanMin;
                  const title = !entry
                    ? `${s.name} — the store's silence read has not answered for this row yet; the next tick reconciles`
                    : !last
                      ? `${s.name} — no hearing anywhere in the store's whole reach (the newest 200 moved boards): the strongest silence, no bar drawn`
                      : `LAST HEARD — ${s.name}: ${last.from} → ${last.to} @ ${stampOf(last.at)} UTC · quiet ${q !== null ? `${q >= 100 ? Math.round(q) : q.toFixed(1)}′` : "—"} since (measured to ${silence?.refStamp ? stampOf(silence.refStamp) : "—"} UTC, the store's newest readable stamp — never the wall clock)${beyondOpen ? ` · beyond the open depth's ${ledger.spanMin?.toFixed(1)}′ span` : ""}`;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setFilter(filter === s.id ? null : s.id)}
                      className="group flex w-full items-center gap-1.5 rounded-sm px-0.5 py-0.5 text-left transition-colors duration-200 hover:bg-black/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]"
                      title={title}
                      data-testid={`board-ledger-silence-${s.id}`}
                    >
                      <span
                        className={`vvu-label w-[86px] shrink-0 truncate text-left text-[6px] font-bold border border-dashed px-1 py-px rounded-sm transition-[border-color,color,transform] group-hover:translate-x-0.5 group-hover:border-[#4a5a3e] group-hover:text-[#c9d4bd] ${filter === s.id ? "border-solid border-[#c8ff00]/70 text-[#c8ff00]" : "border-[#2a3324] text-[#5f6e55]"}`}
                      >
                        {last && (
                          <span
                            className={`mr-0.5 inline-block h-1 w-1 rounded-full align-middle ${FLIP_TONE_DOT[last.toTone] ?? FLIP_TONE_DOT.neutral!}`}
                            aria-hidden
                          />
                        )}
                        {s.name}
                      </span>
                      <span className="relative h-[5px] flex-1 rounded-sm border border-[#2a3324]/60 bg-black/40 overflow-hidden">
                        {pct !== null ? (
                          <span
                            className="absolute inset-y-0 left-0 rounded-sm transition-[width,filter] duration-500 group-hover:brightness-150"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(90deg, ${fill}59, ${fill}14)`,
                              boxShadow: `inset 0 0 0 0.5px ${fill}55`,
                            }}
                            data-testid="board-ledger-silence-bar"
                          />
                        ) : (
                          <span
                            className="absolute inset-y-[42%] left-1 right-1 border-t border-dashed border-[#2a3324]"
                            aria-hidden
                          />
                        )}
                        {rulerVal !== null && ledger.spanMin !== null && ledger.spanMin > 0 && (
                          <span
                            className="absolute inset-y-0 w-px bg-[#7a8a6e]/50"
                            style={{
                              left: `${Math.min(100, Math.max(0, (ledger.spanMin / rulerVal) * 100))}%`,
                            }}
                            title="the open depth's reach ends here — a quiet stretching past the notch outruns the open depth (the depth chips are the reach)"
                            aria-hidden
                            data-testid="board-ledger-silence-notch"
                          />
                        )}
                      </span>
                      <span
                        className={`vvu-label w-[64px] shrink-0 text-right text-[5.5px] font-bold ${q !== null ? "text-[#c9d4bd]" : "text-[#5f6e55]"}`}
                      >
                        {q !== null
                          ? `${q >= 100 ? Math.round(q) : q.toFixed(1)}′ quiet`
                          : last
                            ? "STAMP REFUSES"
                            : "BEYOND REACH"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p
                className="vvu-label mt-0.5 text-[5.5px] leading-relaxed text-[#5f6e55] cursor-help"
                title="the ladder's ruler, said: the bars are fractions of the store's own reach (its deep tail's span), and the quiet is measured to the store's newest readable stamp — the read re-derives from any stored tail, byte-identically"
              >
                ⌇ the ruler is the store&apos;s own reach:{" "}
                {silence?.deepSpanMin !== null && silence?.deepSpanMin !== undefined
                  ? `${silence.deepSpanMin >= 100 ? Math.round(silence.deepSpanMin) : silence.deepSpanMin.toFixed(1)}′`
                  : "—"}{" "}
                of deep tail — a bar is the quiet against that reach; a missing bar is a silence the
                store cannot number
              </p>
            </div>
          )}
          {quiets.rungs.length > 0 && (
            <div
              className="mt-1 rounded-sm border border-[#2a3324]/70 bg-black/20 px-1.5 py-1 transition-colors duration-200 hover:border-[#3a4530]"
              data-testid="board-ledger-quietladder"
            >
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <Hourglass className="h-2.5 w-2.5 text-[#6b8a40]/90" aria-hidden />
                <span
                  className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#7a8a6e] cursor-help"
                  title="THE QUIET LADDER (R136): the pace's SHAPE, not just its longest — the tail's N longest quiets ruled longest-first (ties keep input order: the FIRST longest wins, gapsOf's own convention). The asked count is a DISPLAY bound, never an arithmetic one: the line says the whole gap count first, then names the rungs. Each rung's micro-bar is ruled against the ladder's own longest — a rung clicks into the row that ENDED its quiet."
                >
                  THE QUIET LADDER ·
                </span>
                {quiets.rungs.map((r) => {
                  const longest = quiets.rungs[0]!.gap.min;
                  const pct = longest > 0 ? Math.max(4, (r.gap.min / longest) * 100) : 0;
                  const fill = MOTION_TONE_FILL[r.gap.toFlip.toTone] ?? MOTION_TONE_FILL.neutral!;
                  const minStr =
                    r.gap.min >= 100 ? String(Math.round(r.gap.min)) : r.gap.min.toFixed(1);
                  return (
                    <button
                      key={`quiet-${r.ordinal}-${r.gap.toFlip.id}-${r.gap.toFlip.at}`}
                      onClick={() => setFilter(filter === r.gap.toFlip.id ? null : r.gap.toFlip.id)}
                      className={`vvu-label group inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border cursor-pointer transition-[filter,transform,border-color,color] hover:brightness-125 hover:-translate-y-px active:translate-y-px ${filter === r.gap.toFlip.id ? "border-[#c8ff00]/70 text-[#c8ff00] bg-[#c8ff00]/10" : "border-[#2a3324] text-[#c9d4bd] bg-black/20 hover:text-[#c9d4e0] hover:border-[#4a5a3e]"} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]`}
                      title={`QUIET ${r.ordinal} — ${minStr}′ with no flip anywhere on the board, opened by ${r.gap.fromFlip.name} (${r.gap.fromFlip.from} → ${r.gap.fromFlip.to}) and ended by ${r.gap.toFlip.name} (${r.gap.toFlip.from} → ${r.gap.toFlip.to}) @ ${stampOf(r.gap.toFlip.at)} UTC — the micro-bar is ruled against the ladder's own longest; click to read the ender's motion`}
                      data-testid={`board-ledger-quiet-${r.ordinal}`}
                    >
                      <span
                        className={`inline-flex h-[9px] min-w-[9px] items-center justify-center rounded-full px-0.5 text-[5px] font-bold leading-none border transition-[filter,border-color] duration-300 group-hover:brightness-150 ${r.ordinal === 1 ? "border-[#6b8a40]/60 bg-[#6b8a40]/20 text-[#c8ff00] group-hover:border-[#6b8a40]" : "border-[#3a4530] bg-[#2a3324]/60 text-[#7a8a6e] group-hover:border-[#5a6b4a] group-hover:text-[#a8b89a]"}`}
                        aria-hidden
                      >
                        {r.ordinal}
                      </span>
                      <span
                        className="inline-block h-[3px] w-[26px] overflow-hidden rounded-full bg-black/50 align-middle"
                        aria-hidden
                      >
                        <span
                          className="block h-full rounded-full transition-[width,filter] duration-500 group-hover:brightness-150"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${fill}cc, ${fill}55)`,
                          }}
                        />
                      </span>
                      {minStr}′ → {r.gap.toFlip.name}
                    </button>
                  );
                })}
              </div>
              <p
                className="vvu-label mt-0.5 text-[5.5px] leading-relaxed text-[#5f6e55] cursor-help"
                title={quiets.line}
                data-testid="board-ledger-quietladder-line"
              >
                ⌇ {quiets.line}
                {filter !== null ? " (within this row's motion)" : ""}
              </p>
            </div>
          )}
          {turnarounds.reversals.length > 0 && (
            <div
              className="mt-1 rounded-sm border border-[#2a3324]/70 bg-black/20 px-1.5 py-1 transition-colors duration-200 hover:border-[#3a4530]"
              data-testid="board-ledger-turnaround"
            >
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <Undo2 className="h-2.5 w-2.5 text-[#9a8ac0]/90" aria-hidden />
                <span
                  className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#9a8ac0]/90 cursor-help"
                  title="THE TURNAROUND (R137): the board changing its mind — a row that TAKES ITS OWN WORD BACK. Two depths: the ROUND TRIP is the word undone in one step (A→B then B→A — the sharpest changed-mind a chain can carry); the REPRISE is a pair the row already made coming BACK (span ≥ 2 flips on the row's own chain). The classification is structural — pairs and order, no clocks; the minutes ride the stamps and refuse when a stamp refuses. A SEESAW is the round trip chained (≥ 2 back to back). The sharpest wins: an immediate undo is never demoted to a reprise."
                >
                  THE TURNAROUND ·
                </span>
                <span
                  className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-[#9a8ac0]/50 text-[#b8a8d8] bg-[#9a8ac0]/10 cursor-help transition-[filter] hover:brightness-125"
                  title={`${turnarounds.reversals.length} turnaround${turnarounds.reversals.length === 1 ? "" : "s"} in the open tail — ${turnarounds.roundTrips} round trip${turnarounds.roundTrips === 1 ? "" : "s"} (undone in one step) and ${turnarounds.reprises} reprise${turnarounds.reprises === 1 ? "" : "s"} (a pair come back). The read is structural: pairs and order, no clocks${turnarounds.clockRefused > 0 ? ` — ${turnarounds.clockRefused} carry stamps the clock refuses` : ""}.`}
                  data-testid="board-ledger-turnaround-census"
                >
                  ↩ {turnarounds.reversals.length} CHANGED MIND
                  {turnarounds.reversals.length === 1 ? "" : "S"}
                </span>
                {turnarounds.longestSeesaw && (
                  <span
                    className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-[#00d4e0]/50 text-[#00d4e0] bg-[#00d4e0]/10 cursor-help transition-[filter] hover:brightness-125"
                    title={`THE SEESAW — ${turnarounds.longestSeesaw.name} flipped back and forth longest: ${turnarounds.longestSeesaw.length} round trip${turnarounds.longestSeesaw.length === 1 ? "" : "s"} back to back, the board riding two words like a seesaw. Ties keep the engine's first-occurrence order.`}
                    data-testid="board-ledger-turnaround-seesaw"
                  >
                    ⇄ SEESAW ×{turnarounds.longestSeesaw.length} · {turnarounds.longestSeesaw.name}
                  </span>
                )}
                {turnarounds.latest && (
                  <button
                    onClick={() =>
                      setFilter(filter === turnarounds.latest!.id ? null : turnarounds.latest!.id)
                    }
                    className={`vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border-l-2 cursor-pointer transition-[filter,transform,border-color,color] hover:brightness-125 hover:-translate-y-px active:translate-y-0 ${filter === turnarounds.latest.id ? "border-l-[#c8ff00]/70 border-[#c8ff00]/70 text-[#c8ff00] bg-[#c8ff00]/10" : "border-l-[#9a8ac0]/80 border-[#2a3324] text-[#c9d4bd] bg-black/20 hover:text-[#d8d0e8] hover:border-[#4a3e5a]"} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]`}
                    title={`THE LATEST TURNAROUND — ${turnarounds.latest.name} took ${turnarounds.latest.from} → ${turnarounds.latest.to} back @ ${stampOf(turnarounds.latest.at)} UTC — ${turnarounds.latest.kind === "round-trip" ? "a ROUND TRIP: undone in one step (span 1)" : `a REPRISE: this pair was made before, gone ${turnarounds.latest.gapMin !== null ? (turnarounds.latest.gapMin >= 100 ? Math.round(turnarounds.latest.gapMin) : turnarounds.latest.gapMin.toFixed(1)) + "′" : "an unreadable span"} over ${turnarounds.latest.span} flips`} — click to read the row's motion`}
                    data-testid="board-ledger-turnaround-latest"
                  >
                    <span
                      className={`inline-block h-1 w-1 rounded-full ${FLIP_TONE_DOT[turnarounds.latest.toTone] ?? FLIP_TONE_DOT.neutral!}`}
                      aria-hidden
                    />
                    {turnarounds.latest.kind === "round-trip" ? "⇄" : "↩"} {turnarounds.latest.name}
                    : {turnarounds.latest.from} → {turnarounds.latest.to}
                  </button>
                )}
                {turnarounds.rows.slice(0, 6).map((r) => {
                  // THE VIOLET FACE's fuel (R142): the row's own
                  // turnaround seats — one face alone, the natural
                  // sibling of the shared chip's two.
                  // R145 · THE THREE LIGHTS DEEP: the chip composes the
                  // OTHER way too — the row's below-quiet seats (the
                  // quiets below the rungs the row opens or ends) ride
                  // tealKeys alongside the violet minds. Hold the chip
                  // and the line tells the row's whole below story: the
                  // silence it keeps under the rungs, the minds it
                  // changed on top of it.
                  const faceKeys = new Set(
                    turnarounds.reversals
                      .filter((en) => en.id === r.id)
                      .map((en) => `${en.id}|${en.at}`),
                  );
                  const tealKeys = new Set(
                    unruled.below
                      .filter((g) => g.fromFlip.id === r.id || g.toFlip.id === r.id)
                      .flatMap((g) => [g.fromFlip, g.toFlip])
                      .map(seatKey),
                  );
                  const holdFace = () =>
                    setEdgeLit({ keys: faceKeys, tealKeys, kind: "turnaround", label: r.name });
                  return (
                    <button
                      key={r.id}
                      onClick={() => setFilter(filter === r.id ? null : r.id)}
                      onMouseEnter={holdFace}
                      onMouseLeave={() => setEdgeLit(null)}
                      onFocus={holdFace}
                      onBlur={() => setEdgeLit(null)}
                      className={`vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border cursor-pointer transition-[filter,transform,border-color,color,box-shadow] hover:brightness-125 hover:-translate-y-px active:translate-y-0 ${filter === r.id ? "border-[#c8ff00]/70 text-[#c8ff00] bg-[#c8ff00]/10" : "border-[#2a3324] text-[#b8a8d8] bg-black/20 hover:text-[#d8d0e8] hover:border-[#4a3e5a] hover:shadow-[0_0_6px_rgba(184,168,216,0.3),0_0_9px_rgba(122,200,208,0.25)]"} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]`}
                      title={`${r.name} changed its mind ${r.count} time${r.count === 1 ? "" : "s"} in the tail${r.seesaw >= 2 ? ` — its longest seesaw rode ${r.seesaw} round trips back to back` : ""} — HOLD the chip and the motion line lights the row's changed minds in violet${tealKeys.size > 0 ? ` AND its below-quiet seats in teal (${tealKeys.size} seats of the silence below the rungs)` : ""}; click to read the row's motion`}
                      data-testid={`board-ledger-turnaround-${r.id}`}
                    >
                      {r.name}
                      <span
                        className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-current opacity-80"
                        aria-hidden
                      >
                        ×{r.count}
                      </span>
                    </button>
                  );
                })}
                {turnarounds.rows.length > 6 && (
                  <span
                    className="vvu-label text-[6px] text-[#5f6e55] cursor-help"
                    title={`${turnarounds.rows.length - 6} more row${turnarounds.rows.length - 6 === 1 ? "" : "s"} changed their minds in the tail — the strongest six render (count desc, name asc)`}
                  >
                    +{turnarounds.rows.length - 6} more rows
                  </span>
                )}
                {turnEdges.total > 0 && (
                  <span
                    className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-[#2a3324] text-[#9a8ac0]/80 bg-black/30 cursor-help transition-[filter] hover:brightness-125"
                    title={`THE TURNAROUND'S EDGES (R141): what delivered each changed mind — the return flip's chronological predecessor either belongs to another row (the directed edge that DELIVERED it) or to the same row (the mind grew at home, the row kept its own turn). Both kinds count — a reprise arrives exactly as a round trip does. Direction is load-bearing; the ordering is count desc, aName, bName.`}
                    data-testid="board-ledger-turnaround-edges-census"
                  >
                    ⇒ {turnEdges.handed} ARRIVED BY HANDOFF · {turnEdges.kept} KEPT
                  </span>
                )}
                {turnEdges.edges.slice(0, 3).map((p) => {
                  // THE DELIVERY LIT's fuel (R142): the edge's own
                  // seats — each delivery's (deliverer, return) pair,
                  // adjacent in the tail's order; the pairs split
                  // into the two faces the light tells apart.
                  const deliverKeys = new Set(p.seats.filter((_, i) => i % 2 === 0).map(seatKey));
                  const returnKeys = new Set(p.seats.filter((_, i) => i % 2 === 1).map(seatKey));
                  const holdDelivery = () =>
                    setDeliveryLit({ deliverKeys, returnKeys, label: `${p.aName} → ${p.bName}` });
                  return (
                    <button
                      key={`${p.aId}>${p.bId}`}
                      onClick={() => setFilter(filter === p.aId ? null : p.aId)}
                      onMouseEnter={holdDelivery}
                      onMouseLeave={() => setDeliveryLit(null)}
                      onFocus={holdDelivery}
                      onBlur={() => setDeliveryLit(null)}
                      className={`vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border cursor-pointer transition-[filter,transform,border-color,color,box-shadow] hover:brightness-125 hover:-translate-y-px active:translate-y-0 ${filter === p.aId ? "border-[#c8ff00]/70 text-[#c8ff00] bg-[#c8ff00]/10" : "border-[#2a3324] text-[#9a8ac0]/85 bg-black/20 hover:text-[#c8b8e8] hover:border-[#4a3e5a] hover:shadow-[0_0_6px_rgba(184,168,216,0.3)]"} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]`}
                      title={`DELIVERY EDGE — ${p.aName} → ${p.bName}: this directed edge delivered ${p.count} changed mind${p.count === 1 ? "" : "s"}, last @ ${p.lastAt ? stampOf(p.lastAt) : "—"} UTC — the edge is DIRECTED (the reverse delivery is its own entry) — HOLD the chip and the motion line lights each delivery's own pair: the deliverers in amber, the changed minds in violet; click to read the delivering row's motion`}
                      data-testid={`board-ledger-turnaround-edge-${p.aId}-${p.bId}`}
                    >
                      ⇒ {p.aName} → {p.bName}
                      <span
                        className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-current opacity-80"
                        aria-hidden
                      >
                        ×{p.count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p
                className="vvu-label mt-0.5 text-[5.5px] leading-relaxed text-[#9a8ac0]/70 cursor-help"
                title={turnarounds.line}
                data-testid="board-ledger-turnaround-line"
              >
                ⌇ {turnarounds.line}
                {filter !== null ? " (within this row's motion)" : ""}
              </p>
            </div>
          )}
          {turnarounds.reversals.length === 0 && filteredChrono.length >= 2 && depth < 200 && (
            <div
              className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-sm border border-dashed border-[#2a3324]/70 bg-black/10 px-1.5 py-1 transition-colors duration-200 hover:border-[#3a4530]"
              data-testid="board-ledger-turnaround-empty"
            >
              <Undo2 className="h-2.5 w-2.5 text-[#5f6e55]" aria-hidden />
              <span
                className="vvu-label text-[6px] text-[#7a8a6e] cursor-help"
                title="this window holds no changed mind — no row undid a word or repeated a pair within the open depth. The read is honest about it: the depth chips are the reach, and the deep keep holds what this window cannot."
              >
                no changed mind in this window ({depth} moved samples) —
              </span>
              <button
                onClick={() => {
                  setDepth(200);
                  onDepthChange(200);
                }}
                className="vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border border-[#9a8ac0]/50 text-[#b8a8d8] bg-black/20 cursor-pointer transition-[filter,transform,border-color,color] hover:brightness-125 hover:-translate-y-px active:translate-y-0 hover:border-[#4a3e5a] hover:text-[#d8d0e8] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]"
                title="read the deep keep (the newest 200 moved samples) — where the changed minds live"
                data-testid="board-ledger-turnaround-deepen"
              >
                read the deep keep · 200 →
              </button>
            </div>
          )}
          {handoff.pairs.length > 0 && (
            <div
              className="mt-1 rounded-sm border border-[#2a3324]/70 bg-black/20 px-1.5 py-1 transition-colors duration-200 hover:border-[#3a4530]"
              data-testid="board-ledger-handoff"
            >
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <MoveRight className="h-2.5 w-2.5 text-[#e0a030]/90" aria-hidden />
                <span
                  className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#e0a030]/80 cursor-help"
                  title="THE HANDOFF (R138): the motion passing between rows — the company read's TEMPORAL mirror. Every ADJACENT pair of flips is one passage: HANDED (the row changed — a DIRECTED edge A→B, the reverse edge a different passage) or KEPT (the same row's double flip — the motion stayed home). The read is ORDER-ONLY: positions and rows, no clocks, no minutes, no word values — succession is the input's own order. The RELAY is the passage's longest run of adjacent-distinct rows (a relay may revisit a row, never back-to-back); ties keep the FIRST occurrence."
                >
                  THE HANDOFF ·
                </span>
                {handoff.handed + handoff.kept > 0 && (
                  <span
                    className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-[#2a3324] text-[#e0a030]/80 bg-black/30 cursor-help transition-[filter] hover:brightness-125"
                    title={`${handoff.handed} of ${handoff.handed + handoff.kept} passages handed to another row · ${handoff.kept} kept by their own row — the census covers every adjacent pair in the open tail (order-only, no clocks).`}
                    data-testid="board-ledger-handoff-census"
                  >
                    {handoff.handed} HANDED · {handoff.kept} KEPT
                  </span>
                )}
                {handoff.longestChain && handoff.longestChain.length >= 3 && (
                  <span
                    tabIndex={0}
                    onMouseEnter={() => setRelayLit(true)}
                    onMouseLeave={() => setRelayLit(false)}
                    onFocus={() => setRelayLit(true)}
                    onBlur={() => setRelayLit(false)}
                    className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-[#00d4e0]/50 text-[#00d4e0] bg-[#00d4e0]/10 cursor-help transition-[filter,box-shadow] hover:brightness-125 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00d4e0] focus-visible:brightness-125"
                    title={`THE RELAY — the longest run of adjacent-distinct rows: ${handoff.longestChain.length} flips without a repeat, ${handoff.longestChain.rows.map((r) => r.name).join(" → ")}, from ${stampOf(handoff.longestChain.from)} to ${stampOf(handoff.longestChain.to)} UTC. A relay may revisit a row, it just cannot repeat itself back-to-back; ties keep the FIRST run. HOLD the badge (hover or focus) and the motion line lights the run's flips — the reach made visible.`}
                    data-testid="board-ledger-handoff-relay"
                  >
                    ⌁ RELAY ×{handoff.longestChain.length}
                  </span>
                )}
                {handoff.pairs.slice(0, 5).map((p) => (
                  <button
                    key={`${p.aId}>${p.bId}`}
                    onClick={() => setFilter(filter === p.aId ? null : p.aId)}
                    onMouseEnter={() =>
                      setEdgeLit({
                        keys: new Set(p.seats.map(seatKey)),
                        kind: "handoff",
                        label: `${p.aName} → ${p.bName}`,
                      })
                    }
                    onMouseLeave={() => setEdgeLit(null)}
                    onFocus={() =>
                      setEdgeLit({
                        keys: new Set(p.seats.map(seatKey)),
                        kind: "handoff",
                        label: `${p.aName} → ${p.bName}`,
                      })
                    }
                    onBlur={() => setEdgeLit(null)}
                    className={`vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border cursor-pointer transition-[filter,transform,border-color,color,box-shadow] hover:brightness-125 hover:-translate-y-px active:translate-y-0 ${filter === p.aId ? "border-[#c8ff00]/70 text-[#c8ff00] bg-[#c8ff00]/10" : "border-[#2a3324] text-[#e0a030]/90 bg-black/20 hover:text-[#f0c878] hover:border-[#5a4a2e] hover:shadow-[0_0_6px_rgba(224,160,48,0.25)]"} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]`}
                    title={`${p.aName} → ${p.bName} — the motion passed ${p.count} time${p.count === 1 ? "" : "s"}, last @ ${p.lastAt ? stampOf(p.lastAt) : "—"} UTC — the edge is DIRECTED (the reverse passage is its own entry) — HOLD the chip and the motion line lights the edge's own flips; click to read the handing row's motion`}
                    data-testid={`board-ledger-handoff-${p.aId}-${p.bId}`}
                  >
                    {p.aName} → {p.bName}
                    <span
                      className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-current opacity-80"
                      aria-hidden
                    >
                      ×{p.count}
                    </span>
                  </button>
                ))}
                {handoff.pairs.length > 5 && (
                  <span
                    className="vvu-label text-[6px] text-[#5f6e55] cursor-help"
                    title={`${handoff.pairs.length - 5} more edge${handoff.pairs.length - 5 === 1 ? "" : "s"} in the tail's succession — the strongest five render (count desc, aName, bName)`}
                  >
                    +{handoff.pairs.length - 5} more edges
                  </span>
                )}
              </div>
              <p
                className="vvu-label mt-0.5 text-[5.5px] leading-relaxed text-[#e0a030]/70 cursor-help"
                title={handoff.line}
                data-testid="board-ledger-handoff-line"
              >
                ⌇ {handoff.line}
                {filter !== null ? " (within this row's motion)" : ""}
              </p>
            </div>
          )}
          {quietCompanies.pairs.length > 0 && (
            <div
              className="mt-1 rounded-sm border border-[#2a3324]/70 bg-black/20 px-1.5 py-1 transition-colors duration-200 hover:border-[#3a4530]"
              data-testid="board-ledger-quietcompany"
            >
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <Moon className="h-2.5 w-2.5 text-[#00d4e0]/80" aria-hidden />
                <span
                  className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#00d4e0]/80 cursor-help"
                  title="THE QUIET'S COMPANY (R139): the quiets' succession — which DIRECTED row pairs own the tail's silences. Every quiet is a passage too: one row's flip OPENS it, a row's flip ENDS it, and the directed pair (opener → ender) is the edge the silence hung on. The read composes on gapsOf's own gaps (the quiet ladder's primitive) with the handoff's directed grammar: the direction is load-bearing (A opening → B ending is a different company than B → A); the SELF-KEPT quiet (opened and ended by the same row) is its own fact; broken chains are said, never bridged. A chip clicks into the row that ENDED its quiet."
                >
                  THE QUIET&apos;S COMPANY ·
                </span>
                <span
                  className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-[#00d4e0]/40 text-[#00d4e0]/90 bg-black/30 cursor-help transition-[filter] hover:brightness-125"
                  title={`${quietCompanies.companies} compan${quietCompanies.companies === 1 ? "y" : "ies"} own the tail's ${quietCompanies.quiets} readable quiet${quietCompanies.quiets === 1 ? "" : "s"}${quietCompanies.selfKept > 0 ? ` — ${quietCompanies.selfKept} self-kept (opened and ended by the same row)` : ""}${quietCompanies.broken > 0 ? ` — ${quietCompanies.broken} chain${quietCompanies.broken === 1 ? "" : "s"} broken by an unreadable stamp, said not bridged` : ""}.`}
                  data-testid="board-ledger-quietcompany-census"
                >
                  {quietCompanies.quiets} QUIET{quietCompanies.quiets === 1 ? "" : "S"} ·{" "}
                  {quietCompanies.companies} COMPAN{quietCompanies.companies === 1 ? "Y" : "IES"}
                </span>
                {quietCompanies.selfKept > 0 && (
                  <span
                    className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-[#5f6e55]/50 text-[#7a8a6e] bg-black/30 cursor-help transition-[filter] hover:brightness-125"
                    title={`${quietCompanies.selfKept} quiet${quietCompanies.selfKept === 1 ? "" : "s"} opened AND ended by the same row — the row kept its own company. A distinct fact, never folded into the handed companies.`}
                    data-testid="board-ledger-quietcompany-selfkept"
                  >
                    ⌇ {quietCompanies.selfKept} SELF-KEPT
                  </span>
                )}
                {quietCompanies.pairs.slice(0, 5).map((p) => {
                  const longestTotal = quietCompanies.pairs[0]!.totalMin;
                  const pct = longestTotal > 0 ? Math.max(4, (p.totalMin / longestTotal) * 100) : 0;
                  return (
                    <button
                      key={`${p.openerId}>${p.enderId}`}
                      onClick={() => setFilter(filter === p.enderId ? null : p.enderId)}
                      onMouseEnter={() =>
                        setEdgeLit({
                          keys: new Set(p.seats.map(seatKey)),
                          kind: "quiet",
                          label: `${p.openerName} → ${p.enderName}`,
                        })
                      }
                      onMouseLeave={() => setEdgeLit(null)}
                      onFocus={() =>
                        setEdgeLit({
                          keys: new Set(p.seats.map(seatKey)),
                          kind: "quiet",
                          label: `${p.openerName} → ${p.enderName}`,
                        })
                      }
                      onBlur={() => setEdgeLit(null)}
                      className={`vvu-label group inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border cursor-pointer transition-[filter,transform,border-color,color,box-shadow] hover:brightness-125 hover:-translate-y-px active:translate-y-0 ${filter === p.enderId ? "border-[#c8ff00]/70 text-[#c8ff00] bg-[#c8ff00]/10" : "border-[#2a3324] text-[#00d4e0]/85 bg-black/20 hover:text-[#7adfe8] hover:border-[#1e5a60] hover:shadow-[0_0_6px_rgba(0,212,224,0.25)]"} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]`}
                      title={`${p.openerName} opened and ${p.enderName} ended ${p.count} quiet${p.count === 1 ? "" : "s"} — ${p.totalMin >= 100 ? Math.round(p.totalMin) : p.totalMin.toFixed(1)}′ total, the longest ${p.longestMin >= 100 ? Math.round(p.longestMin) : p.longestMin.toFixed(1)}′, last ended @ ${p.lastAt ? stampOf(p.lastAt) : "—"} UTC — the pair is DIRECTED (the reverse company is its own entry) — HOLD the chip and the motion line lights the silence's own ends; click to read the ender's motion`}
                      data-testid={`board-ledger-quietcompany-${p.openerId}-${p.enderId}`}
                    >
                      <span
                        className="inline-block h-[3px] w-[22px] overflow-hidden rounded-full bg-black/50 align-middle"
                        aria-hidden
                      >
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-[#00d4e0]/80 to-[#00d4e0]/25 transition-[filter] duration-500 group-hover:brightness-150"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      {p.openerName} → {p.enderName}
                      <span
                        className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-current opacity-80"
                        aria-hidden
                      >
                        ×{p.count}
                      </span>
                    </button>
                  );
                })}
                {quietCompanies.pairs.length > 5 && (
                  <span
                    className="vvu-label text-[6px] text-[#5f6e55] cursor-help"
                    title={`${quietCompanies.pairs.length - 5} more compan${quietCompanies.pairs.length - 5 === 1 ? "y" : "ies"} own a quiet in the tail — the strongest five render (count desc, openerName, enderName)`}
                  >
                    +{quietCompanies.pairs.length - 5} more companies
                  </span>
                )}
              </div>
              <p
                className="vvu-label mt-0.5 text-[5.5px] leading-relaxed text-[#00d4e0]/65 cursor-help"
                title={quietCompanies.line}
                data-testid="board-ledger-quietcompany-line"
              >
                ⌇ {quietCompanies.line}
                {filter !== null ? " (within this row's motion)" : ""}
              </p>
            </div>
          )}
          {sharedGrounds.entries.length > 0 && (
            <div
              className="mt-1 rounded-sm border border-[#2a3324]/70 bg-black/20 px-1.5 py-1 transition-colors duration-200 hover:border-[#3a4530]"
              data-testid="board-ledger-sharedground"
            >
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <Layers className="h-2.5 w-2.5 text-[#d08080]/90" aria-hidden />
                <span
                  className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#d08080]/85 cursor-help"
                  title="THE SHARED GROUND (R140): the restless × the silent — which rows BOTH changed their mind (the turnaround's own rows) AND frame one of the tail's RULED quiets (the quiet ladder's rungs). The composition rides the RULED quiets because every flip frames SOME gap — over all gaps the overlap would collapse into the restless census alone. A row restless but never quiet-owning, or quiet-owning but never restless, is said by the census and left out of the entries — the read is the OVERLAP, not the union. The ordering is turnarounds desc, quietParts desc, name asc."
                >
                  THE SHARED GROUND ·
                </span>
                <span
                  className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-[#d08080]/50 text-[#e8a0a0] bg-[#d08080]/10 cursor-help transition-[filter] hover:brightness-125"
                  title={`${sharedGrounds.shared} of ${sharedGrounds.restless} restless and ${sharedGrounds.silent} quiet-owning rows hold BOTH — the changed minds and the ruled quiets on the same row${sharedGrounds.broken > 0 ? `; ${sharedGrounds.broken} chain${sharedGrounds.broken === 1 ? "" : "s"} broken by an unreadable stamp, said not bridged` : ""}. The whole tail holds ${sharedGrounds.totalQuiets} readable quiet${sharedGrounds.totalQuiets === 1 ? "" : "s"}, ${sharedGrounds.quiets} ruled (the ladder's own n).`}
                  data-testid="board-ledger-sharedground-census"
                >
                  ⇄⌇ {sharedGrounds.shared} SHARED · {sharedGrounds.restless} RESTLESS ·{" "}
                  {sharedGrounds.silent} QUIET-OWNING
                </span>
                {sharedGrounds.entries.slice(0, 5).map((e) => {
                  // THE TWO FACES' fuel: the row's own turnaround seats
                  // (the returns' identity) + its ruled-quiet frame
                  // seats — each face lit in its own color on the line.
                  // R146 · THE THIRD FACE: the row's below-quiet seats
                  // ride too (the unruled tail's own below) — the
                  // silence under the rungs joins the violet and the
                  // cyan in one light, teal.
                  const turnKeys = new Set(
                    turnarounds.reversals
                      .filter((en) => en.id === e.id)
                      .map((en) => `${en.id}|${en.at}`),
                  );
                  const quietKeys = new Set(
                    quiets.rungs
                      .filter((r) => r.gap.fromFlip.id === e.id || r.gap.toFlip.id === e.id)
                      .flatMap((r) => [
                        `${r.gap.fromFlip.id}|${r.gap.fromFlip.at}`,
                        `${r.gap.toFlip.id}|${r.gap.toFlip.at}`,
                      ]),
                  );
                  const belowKeys = new Set(
                    unruled.below
                      .filter((g) => g.fromFlip.id === e.id || g.toFlip.id === e.id)
                      .flatMap((g) => [
                        `${g.fromFlip.id}|${g.fromFlip.at}`,
                        `${g.toFlip.id}|${g.toFlip.at}`,
                      ]),
                  );
                  const holdFaces = () =>
                    setTwoFaces({ turnKeys, quietKeys, belowKeys, label: e.name });
                  return (
                    <button
                      key={e.id}
                      onClick={() => setFilter(filter === e.id ? null : e.id)}
                      onMouseEnter={holdFaces}
                      onMouseLeave={() => setTwoFaces(null)}
                      onFocus={holdFaces}
                      onBlur={() => setTwoFaces(null)}
                      className={`vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border cursor-pointer transition-[filter,transform,border-color,color,box-shadow] hover:brightness-125 hover:-translate-y-px active:translate-y-0 ${filter === e.id ? "border-[#c8ff00]/70 text-[#c8ff00] bg-[#c8ff00]/10" : "border-[#2a3324] text-[#e8a0a0]/90 bg-black/20 hover:text-[#f0b8b8] hover:border-[#5a2e2e] hover:shadow-[0_0_6px_rgba(208,128,128,0.3)]"} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]`}
                      title={`${e.name} holds the shared ground — ${e.turnarounds} changed mind${e.turnarounds === 1 ? "" : "s"} (its longest seesaw rode ${e.seesaw} round trip${e.seesaw === 1 ? "" : "s"} back to back) · ${e.quietParts} ruled quiet${e.quietParts === 1 ? "" : "s"} framed${e.selfKept > 0 ? `, ${e.selfKept} self-kept` : ""}, last heard @ ${e.lastAt ? stampOf(e.lastAt) : "—"} UTC — HOLD the chip and the motion line lights the row's ${belowKeys.size > 0 ? `three faces: the changed minds in violet, the ruled quiets' frames in cyan, and the below quiets' seats in teal (${belowKeys.size} below seat${belowKeys.size === 1 ? "" : "s"} — the silence under the rungs rides with its minds)` : `two faces: the changed minds in violet, the ruled quiets' frames in cyan`}; click to read the row's motion`}
                      data-testid={`board-ledger-sharedground-${e.id}`}
                    >
                      {e.name}
                      <span
                        className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-current opacity-80"
                        aria-hidden
                      >
                        ↩×{e.turnarounds}
                      </span>
                      <span
                        className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-current opacity-80"
                        aria-hidden
                      >
                        ⌇×{e.quietParts}
                      </span>
                      {belowKeys.size > 0 && (
                        <span
                          className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#7ac8d0]/90 opacity-90"
                          aria-hidden
                          data-testid={`board-ledger-sharedground-below-${e.id}`}
                        >
                          ⌇↓{belowKeys.size}
                        </span>
                      )}
                    </button>
                  );
                })}
                {sharedGrounds.entries.length > 5 && (
                  <span
                    className="vvu-label text-[6px] text-[#5f6e55] cursor-help"
                    title={`${sharedGrounds.entries.length - 5} more row${sharedGrounds.entries.length - 5 === 1 ? "" : "s"} hold both the changed mind and the ruled quiet — the strongest five render (turnarounds desc, quietParts desc, name asc)`}
                  >
                    +{sharedGrounds.entries.length - 5} more shared rows
                  </span>
                )}
              </div>
              <p
                className="vvu-label mt-0.5 text-[5.5px] leading-relaxed text-[#d08080]/70 cursor-help"
                title={sharedGrounds.line}
                data-testid="board-ledger-sharedground-line"
              >
                ⌇ {sharedGrounds.line}
                {filter !== null ? " (within this row's motion)" : ""}
              </p>
            </div>
          )}
          {sharedGrounds.entries.length === 0 &&
            filteredChrono.length >= 2 &&
            (sharedGrounds.restless > 0 || sharedGrounds.silent > 0) && (
              <div
                className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-sm border border-dashed border-[#2a3324]/70 bg-black/10 px-1.5 py-1 transition-colors duration-200 hover:border-[#3a4530]"
                data-testid="board-ledger-sharedground-empty"
              >
                <Layers className="h-2.5 w-2.5 text-[#5f6e55]" aria-hidden />
                <span
                  className="vvu-label text-[6px] text-[#7a8a6e] cursor-help"
                  title={`the composition read both ways and found no overlap — ${sharedGrounds.restless} restless row${sharedGrounds.restless === 1 ? "" : "s"} (changed minds) and ${sharedGrounds.silent} quiet-owning row${sharedGrounds.silent === 1 ? "" : "s"} (ruled quiets framed), no row among both. The read is honest about it: the restless and the silent keep different company in this window.`}
                >
                  the changed minds and the ruled quiets keep different rows (
                  {sharedGrounds.restless} restless · {sharedGrounds.silent} quiet-owning)
                </span>
              </div>
            )}
          {unruled.total > 0 && unruled.unruled > 0 && (
            <div
              className="mt-1 rounded-sm border border-[#2a3324]/70 bg-black/20 px-1.5 py-1 transition-colors duration-200 hover:border-[#3a4530]"
              data-testid="board-ledger-unruled"
            >
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <ListEnd className="h-2.5 w-2.5 text-[#7ac8d0]/90" aria-hidden />
                <span
                  className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#7ac8d0]/85 cursor-help"
                  title="THE UNRULED TAIL (R142): the quiets the ladder does not name — the quiet ladder's own complement, given their own shape. The ladder rules its N longest (the rungs the lane speaks; the shared ground rides them too); every quiet below has never had a read of its own. The question: does the tail's silence concentrate in the named rungs, or does it hide below them? The split is exactly the ladder's slice — the two reads can never disagree about who is ruled."
                >
                  THE UNRULED TAIL ·
                </span>
                <span
                  className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-[#7ac8d0]/40 text-[#a8d8de] bg-black/30 cursor-help transition-[filter] hover:brightness-125"
                  title={`${unruled.unruled} of the tail's ${unruled.total} readable quiets wait below the ladder's ${unruled.ruled} rungs — the below hold ${unruled.unruledMin >= 100 ? Math.round(unruled.unruledMin) : unruled.unruledMin.toFixed(1)}′ of ${unruled.ruledMin + unruled.unruledMin >= 100 ? Math.round(unruled.ruledMin + unruled.unruledMin) : (unruled.ruledMin + unruled.unruledMin).toFixed(1)}′ (${unruled.ruledMin + unruled.unruledMin > 0 ? Math.round((unruled.unruledMin / (unruled.ruledMin + unruled.unruledMin)) * 100) : 0}%), ${unruled.rows} row${unruled.rows === 1 ? "" : "s"} keep the unnamed silence${unruled.selfKept > 0 ? `, ${unruled.selfKept} self-kept` : ""}${unruled.broken > 0 ? `; ${unruled.broken} chain${unruled.broken === 1 ? "" : "s"} broken by an unreadable stamp, said not bridged` : ""}.`}
                  data-testid="board-ledger-unruled-census"
                >
                  ⌇↓ {unruled.unruled} BELOW ·{" "}
                  {unruled.ruledMin + unruled.unruledMin > 0
                    ? Math.round(
                        (unruled.unruledMin / (unruled.ruledMin + unruled.unruledMin)) * 100,
                      )
                    : 0}
                  % OF THE SILENCE
                </span>
                {(showAllBelow ? unruled.below : unruled.below.slice(0, 3)).map((g, i) => {
                  // THE BELOW LIT (R143) with the R144 second face: the
                  // quiet's own two seats lit in teal, PLUS the violet
                  // for whichever of them is a CHANGED MIND (a kept
                  // ender — the silence a taken-back word ended).
                  const seats = [g.fromFlip, g.toFlip];
                  const violetSeats = seats.filter((f) => turnKeySet.has(`${f.id}|${f.at}`));
                  const holdBelow = () =>
                    setEdgeLit({
                      keys: new Set(seats.map((f) => `${f.id}|${f.at}`)),
                      ...(violetSeats.length > 0
                        ? { violetKeys: new Set(violetSeats.map((f) => `${f.id}|${f.at}`)) }
                        : {}),
                      kind: "below",
                      label: `⌇ ${g.min >= 100 ? Math.round(g.min) : g.min.toFixed(1)}′ → ${g.toFlip.name}`,
                    });
                  return (
                    <button
                      key={`${g.fromFlip.id}|${g.fromFlip.at}-${g.toFlip.id}|${g.toFlip.at}`}
                      onClick={() => setFilter(filter === g.toFlip.id ? null : g.toFlip.id)}
                      onMouseEnter={holdBelow}
                      onMouseLeave={() => setEdgeLit(null)}
                      onFocus={holdBelow}
                      onBlur={() => setEdgeLit(null)}
                      className={`vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border cursor-pointer transition-[filter,transform,border-color,color,box-shadow] hover:brightness-125 hover:-translate-y-px active:translate-y-0 ${filter === g.toFlip.id ? "border-[#c8ff00]/70 text-[#c8ff00] bg-[#c8ff00]/10" : `border-[#2a3324] text-[#8ac0c8] bg-black/20 hover:text-[#b8d8de] hover:border-[#2a4a4e] ${violetSeats.length > 0 ? "hover:shadow-[0_0_6px_rgba(122,200,208,0.3),0_0_9px_rgba(184,168,216,0.25)]" : "hover:shadow-[0_0_6px_rgba(122,200,208,0.3)]"}`} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]`}
                      title={`UNRULED QUIET #${i + 1} below the rungs — ${g.min >= 100 ? Math.round(g.min) : g.min.toFixed(1)}′, opened by ${g.fromFlip.name}, ended by ${g.toFlip.name} @ ${stampOf(g.toFlip.at)} UTC — the quiet the ladder's own n leaves unnamed${i === 0 ? ", the biggest below" : ""}${violetSeats.length > 0 ? " — its ender is a CHANGED MIND: the violet rides the teal when held" : ""} — HOLD the chip and the motion line lights the quiet's own ends; click to read the ender row's motion`}
                      data-testid={`board-ledger-unruled-${i}`}
                    >
                      ⌇ {g.min >= 100 ? Math.round(g.min) : g.min.toFixed(1)}′ → {g.toFlip.name}
                    </button>
                  );
                })}
                {unruled.below.length > 3 && !showAllBelow && (
                  <button
                    onClick={() => {
                      setShowAllBelow(true);
                      setBelowRemembered(false);
                      rememberFold("below", true);
                    }}
                    className="vvu-label text-[6px] font-bold text-[#5f6e55] px-1 py-px rounded-sm border border-transparent hover:border-[#3a4530] hover:text-[#7a8a6e] hover:-translate-y-px transition-[color,transform,border-color] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]"
                    title={`${unruled.below.length - 3} more quiet${unruled.below.length - 3 === 1 ? "" : "s"} wait below the rungs — the biggest three render first (the ladder's own sort: min desc, ties keep input order) — CLICK to unfold the whole shape in place; the session remembers the fold (R157 · the memory widens)`}
                    data-testid="board-ledger-unruled-more"
                  >
                    +{unruled.below.length - 3} more below
                  </button>
                )}
                {showAllBelow && unruled.below.length > 3 && (
                  <button
                    onClick={() => {
                      setShowAllBelow(false);
                      setBelowRemembered(false);
                      rememberFold("below", false);
                    }}
                    className="vvu-label text-[6px] font-bold text-[#7ac8d0]/80 px-1 py-px rounded-sm border border-[#7ac8d0]/30 hover:border-[#2a4a4e] hover:-translate-y-px transition-[color,transform,border-color] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]"
                    title={`the whole below shows — all ${unruled.below.length} unnamed quiet${unruled.below.length === 1 ? "" : "s"}, the ladder's own sort — CLICK to fold back to the biggest three; the session remembers the fold (R157)${leftAtStamps.below ? ` — left open at ${stampOf(leftAtStamps.below)} UTC (R158 · the dated memory)` : ""}`}
                    data-testid="board-ledger-unruled-fold"
                  >
                    {belowRemembered && (
                      <span
                        className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#b8a8d8] cursor-help mr-0.5 transition-[filter] hover:brightness-125"
                        title={`R157 · THE WIDENED MEMORY: this fold was restored from your last read (the session carries it across reloads) — the ↺ says remembered, not re-derived.${rememberedAdopted ? " R160 · THE ADOPTED VOICE: this memory was ADOPTED from the estate — another tab\u2019s read, owned by this one from its first mount." : ""} Any click of your own retires the cue.`}
                        data-testid="board-ledger-below-remembered"
                      >
                        ↺
                      </span>
                    )}
                    − fold the below
                  </button>
                )}
              </div>
              <p
                className="vvu-label mt-0.5 text-[5.5px] leading-relaxed text-[#7ac8d0]/70 cursor-help"
                title={unruled.line}
                data-testid="board-ledger-unruled-line"
              >
                ⌇ {unruled.line}
                {filter !== null ? " (within this row's motion)" : ""}
              </p>
            </div>
          )}
          {unruledRowsRead.pairs.length > 0 && (
            <div
              className="mt-1 rounded-sm border border-[#2a3324]/70 bg-black/20 px-1.5 py-1 transition-colors duration-200 hover:border-[#3a4530]"
              data-testid="board-ledger-unruledrows"
            >
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <GitFork className="h-2.5 w-2.5 text-[#7ac8d0]/80" aria-hidden />
                <span
                  className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#7ac8d0]/80 cursor-help"
                  title="THE UNRULED ROWS (R143): the quiet-company read applied to the ladder's own complement — which DIRECTED row pairs own the quiets BELOW the rungs (the unnamed silence). It rides the SAME shared slice as the unruled tail (one split — the reads can never disagree about who is below); the direction is load-bearing (A opening → B ending is a different company than B → A); the SELF-KEPT quiet is its own company. A pair that owns only RULED quiets does not appear — this read composes the complement, not the whole."
                >
                  THE UNRULED ROWS ·
                </span>
                <span
                  className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-[#7ac8d0]/40 text-[#a8d8de] bg-black/30 cursor-help transition-[filter] hover:brightness-125"
                  title={`${unruledRowsRead.companies} compan${unruledRowsRead.companies === 1 ? "y" : "ies"} own the tail's ${unruledRowsRead.below} below quiet${unruledRowsRead.below === 1 ? "" : "s"} — the quiets the ladder's own n leaves unnamed${unruledRowsRead.selfKept > 0 ? ` — ${unruledRowsRead.selfKept} self-kept (opened and ended by the same row)` : ""}${unruledRowsRead.broken > 0 ? ` — ${unruledRowsRead.broken} chain${unruledRowsRead.broken === 1 ? "" : "s"} broken by an unreadable stamp, said not bridged` : ""}.`}
                  data-testid="board-ledger-unruledrows-census"
                >
                  ⌇⇄ {unruledRowsRead.companies} COMPAN
                  {unruledRowsRead.companies === 1 ? "Y" : "IES"} · {unruledRowsRead.below} BELOW
                </span>
                {unruledRowsRead.selfKept > 0 && (
                  <span
                    className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-[#5f6e55]/50 text-[#7a8a6e] bg-black/30 cursor-help transition-[filter] hover:brightness-125"
                    title={`${unruledRowsRead.selfKept} of the unnamed quiet${unruledRowsRead.selfKept === 1 ? "" : "s"} opened AND ended by the same row — the row kept its own silence, unnamed. A distinct fact, never folded into the handed companies.`}
                    data-testid="board-ledger-unruledrows-selfkept"
                  >
                    ⌇ {unruledRowsRead.selfKept} SELF-KEPT
                  </span>
                )}
                {(showAllUnruledRows
                  ? unruledRowsRead.pairs
                  : unruledRowsRead.pairs.slice(0, 3)
                ).map((p) => {
                  const longestTotal = unruledRowsRead.pairs[0]!.totalMin;
                  const pct = longestTotal > 0 ? Math.max(4, (p.totalMin / longestTotal) * 100) : 0;
                  // R144 · the pair's second face: the seats that are
                  // CHANGED MINDS ride the violet alongside the teal —
                  // the below's ownership and the turnarounds that end
                  // parts of it, lit together (the kept light's own
                  // two-group shape, applied to the companies).
                  const violetSeats = p.seats.filter((f) => turnKeySet.has(`${f.id}|${f.at}`));
                  const holdPair = () =>
                    setEdgeLit({
                      keys: new Set(p.seats.map(seatKey)),
                      ...(violetSeats.length > 0
                        ? { violetKeys: new Set(violetSeats.map(seatKey)) }
                        : {}),
                      kind: "below",
                      label: `${p.openerName} → ${p.enderName}`,
                    });
                  return (
                    <button
                      key={`${p.openerId}>${p.enderId}`}
                      onClick={() => setFilter(filter === p.enderId ? null : p.enderId)}
                      onMouseEnter={holdPair}
                      onMouseLeave={() => setEdgeLit(null)}
                      onFocus={holdPair}
                      onBlur={() => setEdgeLit(null)}
                      className={`vvu-label group inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border cursor-pointer transition-[filter,transform,border-color,color,box-shadow] hover:brightness-125 hover:-translate-y-px active:translate-y-0 ${filter === p.enderId ? "border-[#c8ff00]/70 text-[#c8ff00] bg-[#c8ff00]/10" : `border-[#2a3324] text-[#8ac0c8]/90 bg-black/20 hover:text-[#b8d8de] hover:border-[#2a4a4e] ${violetSeats.length > 0 ? "hover:shadow-[0_0_6px_rgba(122,200,208,0.3),0_0_9px_rgba(184,168,216,0.25)]" : "hover:shadow-[0_0_6px_rgba(122,200,208,0.3)]"}`} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]`}
                      title={`${p.openerName} opened and ${p.enderName} ended ${p.count} of the tail's UNNAMED quiet${p.count === 1 ? "" : "s"} — ${p.totalMin >= 100 ? Math.round(p.totalMin) : p.totalMin.toFixed(1)}′ total, the longest ${p.longestMin >= 100 ? Math.round(p.longestMin) : p.longestMin.toFixed(1)}′, last ended @ ${p.lastAt ? stampOf(p.lastAt) : "—"} UTC — the pair is DIRECTED (the reverse company is its own entry)${violetSeats.length > 0 ? ` — ${violetSeats.length} of its seats are CHANGED MINDS: the violet rides the teal when held` : ""} — HOLD the chip and the motion line lights the unnamed silences' own ends; click to read the ender's motion`}
                      data-testid={`board-ledger-unruledrows-${p.openerId}-${p.enderId}`}
                    >
                      <span
                        className="inline-block h-[3px] w-[22px] overflow-hidden rounded-full bg-black/50 align-middle"
                        aria-hidden
                      >
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-[#7ac8d0]/80 to-[#7ac8d0]/25 transition-[filter] duration-500 group-hover:brightness-150"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      {p.openerName} → {p.enderName}
                      <span
                        className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-current opacity-80"
                        aria-hidden
                      >
                        ×{p.count}
                      </span>
                      {violetSeats.length > 0 && (
                        <span
                          className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#b8a8d8] opacity-90"
                          aria-hidden
                          title={`${violetSeats.length} of the pair's seats are changed minds — the silence they ended, they ended by taking their own word back`}
                        >
                          ↩×{violetSeats.length}
                        </span>
                      )}
                    </button>
                  );
                })}
                {unruledRowsRead.pairs.length > 3 && !showAllUnruledRows && (
                  <button
                    onClick={() => {
                      setShowAllUnruledRows(true);
                      setUnruledRowsRemembered(false);
                      rememberFold("unruledRows", true);
                    }}
                    className="vvu-label text-[6px] font-bold text-[#5f6e55] px-1 py-px rounded-sm border border-transparent hover:border-[#3a4530] hover:text-[#7a8a6e] hover:-translate-y-px transition-[color,transform,border-color] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]"
                    title={`${unruledRowsRead.pairs.length - 3} more compan${unruledRowsRead.pairs.length - 3 === 1 ? "y" : "ies"} own a below quiet in the tail — the strongest three render first (count desc, openerName, enderName) — CLICK to unfold the whole shape in place; the session remembers the fold (R157 · the memory widens)`}
                    data-testid="board-ledger-unruledrows-more"
                  >
                    +{unruledRowsRead.pairs.length - 3} more companies below
                  </button>
                )}
                {showAllUnruledRows && unruledRowsRead.pairs.length > 3 && (
                  <button
                    onClick={() => {
                      setShowAllUnruledRows(false);
                      setUnruledRowsRemembered(false);
                      rememberFold("unruledRows", false);
                    }}
                    className="vvu-label text-[6px] font-bold text-[#7ac8d0]/80 px-1 py-px rounded-sm border border-[#7ac8d0]/30 hover:border-[#2a4a4e] hover:-translate-y-px transition-[color,transform,border-color] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]"
                    title={`the whole shape shows — all ${unruledRowsRead.pairs.length} compan${unruledRowsRead.pairs.length === 1 ? "y" : "ies"} of the unnamed silence — CLICK to fold back to the strongest three; the session remembers the fold (R157)${leftAtStamps.unruledRows ? ` — left open at ${stampOf(leftAtStamps.unruledRows)} UTC (R158 · the dated memory)` : ""}`}
                    data-testid="board-ledger-unruledrows-fold"
                  >
                    {unruledRowsRemembered && (
                      <span
                        className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#b8a8d8] cursor-help mr-0.5 transition-[filter] hover:brightness-125"
                        title={`R157 · THE WIDENED MEMORY: this fold was restored from your last read (the session carries it across reloads) — the ↺ says remembered, not re-derived.${rememberedAdopted ? " R160 · THE ADOPTED VOICE: this memory was ADOPTED from the estate — another tab\u2019s read, owned by this one from its first mount." : ""} Any click of your own retires the cue.`}
                        data-testid="board-ledger-unruledrows-remembered"
                      >
                        ↺
                      </span>
                    )}
                    − fold the companies
                  </button>
                )}
              </div>
              <p
                className="vvu-label mt-0.5 text-[5.5px] leading-relaxed text-[#7ac8d0]/70 cursor-help"
                title={unruledRowsRead.line}
                data-testid="board-ledger-unruledrows-line"
              >
                ⌇ {unruledRowsRead.line}
                {filter !== null ? " (within this row's motion)" : ""}
              </p>
            </div>
          )}
          {unruledTurnoversRead.total > 0 && (
            <div
              className="mt-1 rounded-sm border border-[#2a3324]/70 bg-black/20 px-1.5 py-1 transition-colors duration-200 hover:border-[#3a4530]"
              data-testid="board-ledger-turnovers"
            >
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <Repeat2 className="h-2.5 w-2.5 text-[#b8a8d8]/80" aria-hidden />
                <span
                  className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#9a8ac0]/90 cursor-help"
                  title="THE UNRULED TURNOVERS (R145): the changed minds' share of the BELOW silence — which quiets below the rungs a taken-back word ENDED. The read composes the ONE shared slice (the unruled tail and rows' own below) with the turnarounds' own return flips (joined by id|stamp): the minutes' share is said outright, and the kept/handed split rides the gap's own eyes — a quiet the ender row kept with itself grew AT HOME; a quiet another row opened saw the mind ARRIVE BY HANDOFF. On a clean tail at n=0 the split === the turnaround edges' own kept/handed — the reads can never disagree about who grew at home. R149 · THE FRESH HAND: the census's freshest strike rides its own chip (⌁ last ↩) — recency beside the rhythm. R150 · WHO CAME HOME: the chip grows its owner's name and a minutes-ago age — the freshness read made whole, the render's own frame the clock."
                >
                  THE UNRULED TURNOVERS ·
                </span>
                <span
                  className={`vvu-label text-[6px] font-bold px-1 py-px rounded-sm border bg-black/30 cursor-help transition-[filter,border-color] hover:brightness-125 ${unruledTurnoversRead.turnovers > 0 ? "border-[#b8a8d8]/40 text-[#c8bcd8]" : "border-[#7ac8d0]/40 text-[#a8d8de]"}`}
                  title={`${unruledTurnoversRead.turnovers} of the ${unruledTurnoversRead.total} quiet${unruledTurnoversRead.total === 1 ? "" : "s"} below the rungs end${unruledTurnoversRead.turnovers === 1 ? "s" : ""} in a changed mind — ${unruledTurnoversRead.turnoverMin >= 100 ? Math.round(unruledTurnoversRead.turnoverMin) : unruledTurnoversRead.turnoverMin.toFixed(1)}′ of ${unruledTurnoversRead.totalMin >= 100 ? Math.round(unruledTurnoversRead.totalMin) : unruledTurnoversRead.totalMin.toFixed(1)}′ (${unruledTurnoversRead.share}% of the below's minutes)${unruledTurnoversRead.broken > 0 ? `; ${unruledTurnoversRead.broken} chain${unruledTurnoversRead.broken === 1 ? "" : "s"} broken by an unreadable stamp, said not bridged` : ""}.`}
                  data-testid="board-ledger-turnovers-census"
                >
                  ↩⌇ {unruledTurnoversRead.turnovers} of {unruledTurnoversRead.total} BELOW ·{" "}
                  {unruledTurnoversRead.share}%
                </span>
                {unruledTurnoversRead.turnovers > 0 && (
                  <span
                    className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border border-[#2a3324] text-[#9a8ac0]/80 bg-black/30 cursor-help transition-[filter] hover:brightness-125"
                    title={`how the below-ending minds grew — ${unruledTurnoversRead.kept} ended a quiet the row kept with itself (AT HOME — the kept story's own territory, below the rungs), ${unruledTurnoversRead.handed} ended a quiet another row opened (BY HANDOFF). On a clean tail at n=0 this split === the turnaround edges' own.`}
                    data-testid="board-ledger-turnovers-split"
                  >
                    ⌂ {unruledTurnoversRead.kept} AT HOME · ⇒ {unruledTurnoversRead.handed} BY
                    HANDOFF
                  </span>
                )}
                {unruledTurnoversRead.newestStrikeAt &&
                  (() => {
                    // R150 · WHO CAME HOME + THE RENDER-FRAME AGE: the
                    // fresh chip grows its owner's name and its
                    // minutes-ago — the freshness read made whole
                    // (when, who, how old), the render's own frame the
                    // clock (re-read at each telemetry pass, no
                    // wall-clock promise). One pass in the engine owns
                    // the stamp and the name — no divergence possible.
                    const strikeMs = Date.parse(unruledTurnoversRead.newestStrikeAt!);
                    const strikeAgeMin =
                      Number.isFinite(strikeMs) && renderNow >= strikeMs
                        ? Math.floor((renderNow - strikeMs) / 60000)
                        : null;
                    return (
                      <span
                        className="vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border border-[#2a3324] bg-black/30 text-[#b8a8d8]/85 cursor-help transition-[filter,box-shadow] hover:brightness-125 hover:shadow-[0_0_6px_rgba(184,168,216,0.3),0_0_9px_rgba(122,200,208,0.25)]"
                        title={`R149 · THE FRESH HAND: the census's newest strike @ ${stampOf(unruledTurnoversRead.newestStrikeAt)} UTC — the newest stamp across ALL ender rows (a chronological max by Date.parse, never a string compare). Recency beside the rhythm: the cadence says how OFTEN the minds strike, this says how RECENTLY the last one landed. R150 · WHO CAME HOME: the stamp and its owner ride together — ${unruledTurnoversRead.newestStrikeBy ?? "—"} owns the freshest strike (one pass, one max, first-seen on a tie; the name can never disagree with the stamp). THE RENDER-FRAME AGE: the minutes-ago reads the render's own frame — the board's clock is the render, re-read at each telemetry pass; not a wall-clock promise, a render-frame read.`}
                        data-testid="board-ledger-turnovers-fresh"
                      >
                        ⌁ last ↩ {stampOf(unruledTurnoversRead.newestStrikeAt)}
                        {unruledTurnoversRead.newestStrikeBy && (
                          <span
                            className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#c8bcd8]"
                            data-testid="board-ledger-turnovers-fresh-by"
                          >
                            {unruledTurnoversRead.newestStrikeBy}
                          </span>
                        )}
                        {strikeAgeMin !== null && (
                          <span
                            className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#b8a8d8]/70"
                            data-testid="board-ledger-turnovers-fresh-age"
                          >
                            · {strikeAgeMin >= 100 ? Math.round(strikeAgeMin) : strikeAgeMin}′ ago
                          </span>
                        )}
                      </span>
                    );
                  })()}
                {(showAllTurnEnders
                  ? unruledTurnoversRead.rows
                  : unruledTurnoversRead.rows.slice(0, 3)
                ).map((e) => {
                  // THE TURNOVER LIGHT's fuel: the row's ended below
                  // quiets (teal) + the changed minds that ended them
                  // (violet) — the below's second face, given its own
                  // census.
                  const quietKeys = new Set(e.quietSeats.map(seatKey));
                  const enderKeys = new Set(e.enderSeats.map(seatKey));
                  const holdTurn = () =>
                    setEdgeLit({
                      keys: quietKeys,
                      violetKeys: enderKeys,
                      kind: "turnover",
                      label: e.name,
                    });
                  // R146 · THE ENDER BARS: the count share (the row's
                  // slice of the whole below turnover census) and the
                  // TURNOVER CADENCE (the median interval between its
                  // below-ending minds, against the SLOWEST ender in
                  // the whole census — a stable scale, all rows not
                  // just the rendered three; short bar, fast
                  // striking). No cadence yet (fewer than two
                  // enders) → no bar, the honest absence.
                  const share =
                    unruledTurnoversRead.turnovers > 0
                      ? Math.max(4, (e.count / unruledTurnoversRead.turnovers) * 100)
                      : 0;
                  const cadencePct =
                    e.cadenceMin !== null &&
                    unruledTurnoversRead.slowestCadenceMin !== null &&
                    unruledTurnoversRead.slowestCadenceMin > 0
                      ? Math.max(8, (e.cadenceMin / unruledTurnoversRead.slowestCadenceMin) * 100)
                      : null;
                  return (
                    <button
                      key={e.id}
                      onClick={() => setFilter(filter === e.id ? null : e.id)}
                      onMouseEnter={holdTurn}
                      onMouseLeave={() => setEdgeLit(null)}
                      onFocus={holdTurn}
                      onBlur={() => setEdgeLit(null)}
                      className={`vvu-label group inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border cursor-pointer transition-[filter,transform,border-color,color,box-shadow] hover:brightness-125 hover:-translate-y-px active:translate-y-0 ${filter === e.id ? "border-[#c8ff00]/70 text-[#c8ff00] bg-[#c8ff00]/10" : "border-[#2a3324] text-[#b8a8d8]/90 bg-black/20 hover:text-[#d8d0e8] hover:border-[#4a3e5a] hover:shadow-[0_0_6px_rgba(122,200,208,0.3),0_0_9px_rgba(184,168,216,0.25)]"} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]`}
                      title={`${e.name}'s changed minds ended ${e.count} quiet${e.count === 1 ? "" : "s"} below the rungs (${e.totalMin >= 100 ? Math.round(e.totalMin) : e.totalMin.toFixed(1)}′), last @ ${e.lastAt ? stampOf(e.lastAt) : "—"} UTC${e.cadenceMin !== null ? `, its enders median ${e.cadenceMin >= 100 ? Math.round(e.cadenceMin) : e.cadenceMin.toFixed(1)}′ apart${cadencePct !== null ? " (the teal bar's length is that interval against the slowest ender in the census — short bar, fast striking)" : ""}` : ", a single ender so far"} — HOLD the chip and the motion line lights those quiets in teal and the changed minds that ended them in violet; click to read the row's motion`}
                      data-testid={`board-ledger-turnovers-${e.id}`}
                    >
                      <span
                        className="inline-block h-[3px] w-[22px] overflow-hidden rounded-full bg-black/50 align-middle"
                        aria-hidden
                      >
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-[#b8a8d8]/85 to-[#9a8ac0]/35 transition-[filter] duration-500 group-hover:brightness-150"
                          style={{ width: `${share}%` }}
                        />
                      </span>
                      {cadencePct !== null && (
                        <span
                          className="inline-block h-[3px] w-[16px] overflow-hidden rounded-full bg-black/50 align-middle"
                          aria-hidden
                          data-testid={`board-ledger-turnovers-cadence-${e.id}`}
                        >
                          <span
                            className="block h-full rounded-full bg-[#7ac8d0]/85 transition-[filter] duration-500 group-hover:brightness-150"
                            style={{ width: `${cadencePct}%` }}
                          />
                        </span>
                      )}
                      {e.name}
                      <span
                        className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-current opacity-80"
                        aria-hidden
                      >
                        ↩×{e.count}
                      </span>
                    </button>
                  );
                })}
                {unruledTurnoversRead.rows.length > 3 && !showAllTurnEnders && (
                  <button
                    onClick={() => {
                      setShowAllTurnEnders(true);
                      setTurnEndersRemembered(false);
                      rememberFold("turnEnders", true);
                    }}
                    className="vvu-label text-[6px] font-bold text-[#5f6e55] px-1 py-px rounded-sm border border-transparent hover:border-[#3a4530] hover:text-[#7a8a6e] hover:-translate-y-px transition-[color,transform,border-color] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]"
                    title={`${unruledTurnoversRead.rows.length - 3} more row${unruledTurnoversRead.rows.length - 3 === 1 ? "" : "s"} ended the below with changed minds — the strongest three render first (count desc, name asc) — CLICK to unfold the whole census in place; the session remembers the fold (R157 · the memory widens)`}
                    data-testid="board-ledger-turnovers-more"
                  >
                    +{unruledTurnoversRead.rows.length - 3} more enders
                  </button>
                )}
                {showAllTurnEnders && unruledTurnoversRead.rows.length > 3 && (
                  <button
                    onClick={() => {
                      setShowAllTurnEnders(false);
                      setTurnEndersRemembered(false);
                      rememberFold("turnEnders", false);
                    }}
                    className="vvu-label text-[6px] font-bold text-[#9a8ac0]/80 px-1 py-px rounded-sm border border-[#9a8ac0]/30 hover:border-[#4a3e5a] hover:-translate-y-px transition-[color,transform,border-color] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]"
                    title={`the whole census shows — all ${unruledTurnoversRead.rows.length} row${unruledTurnoversRead.rows.length === 1 ? "" : "s"} whose changed minds ended the below — CLICK to fold back to the strongest three; the session remembers the fold (R157)${leftAtStamps.turnEnders ? ` — left open at ${stampOf(leftAtStamps.turnEnders)} UTC (R158 · the dated memory)` : ""}`}
                    data-testid="board-ledger-turnovers-fold"
                  >
                    {turnEndersRemembered && (
                      <span
                        className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#b8a8d8] cursor-help mr-0.5 transition-[filter] hover:brightness-125"
                        title={`R157 · THE WIDENED MEMORY: this fold was restored from your last read (the session carries it across reloads) — the ↺ says remembered, not re-derived.${rememberedAdopted ? " R160 · THE ADOPTED VOICE: this memory was ADOPTED from the estate — another tab\u2019s read, owned by this one from its first mount." : ""} Any click of your own retires the cue.`}
                        data-testid="board-ledger-turnovers-remembered"
                      >
                        ↺
                      </span>
                    )}
                    − fold the enders
                  </button>
                )}
              </div>
              <p
                className="vvu-label mt-0.5 text-[5.5px] leading-relaxed text-[#9a8ac0]/70 cursor-help"
                title={unruledTurnoversRead.line}
                data-testid="board-ledger-turnovers-line"
              >
                ⌇ {unruledTurnoversRead.line}
                {filter !== null ? " (within this row's motion)" : ""}
              </p>
            </div>
          )}
          {keptStoryRead.rows.length > 0 && (
            <div
              className="mt-1 rounded-sm border border-[#2a3324]/70 bg-black/20 px-1.5 py-1 transition-colors duration-200 hover:border-[#3a4530]"
              data-testid="board-ledger-keptstory"
            >
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <Home className="h-2.5 w-2.5 text-[#7ac8d0]/80" aria-hidden />
                <span
                  className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#7ac8d0]/80 cursor-help"
                  title="THE KEPT STORY (R144): the self-kept quiets, and which of them end in the row TAKING ITS OWN WORD BACK — a kept ENDER, the changed mind that grew at home. The composition is structural: a kept turnaround's whole-tail predecessor is the same row, so it BY CONSTRUCTION ends a self-kept quiet (the R141 kept × the R142 self-kept); the converse is the news — not every self-kept quiet ends in a changed mind. Each row's HOMECOMING CADENCE rides: the median interval between its self-kept enders. R147 · THE HOMECOMING LADDER deepens the census: the rows' intervals pool into one census rhythm (the line says it), and the slowest row in the WHOLE census is the chips' cadence bar's scale. On a clean tail keptEnders === the turnaround edges' kept count — the reads can never disagree about who grew at home. R149 · THE FRESH HAND: the census's freshest homecoming rides its own chip (⌁ last ⌂) — recency beside the pooled rhythm. R150 · WHO CAME HOME: the chip grows its owner's name and a minutes-ago age — the freshness read made whole, the render's own frame the clock. R154 · THE SELF-COUNTED ROWS: each row chip says its own pooled share (⌂×n beside the ⌇×quiets and ↩×kept counts) — the census's arithmetic, said per row, the rows' counts summing to the pool's n. R155 · THE ROWS' FRESHNESS HAND: each row chip wears its own freshness dot — freshest (owns the census's freshest homecoming), in-rhythm (within one pooled median of it), drifted (beyond it) — the census's own rhythm as the yardstick, never an invented constant."
                >
                  THE KEPT STORY ·
                </span>
                <span
                  className={`vvu-label text-[6px] font-bold px-1 py-px rounded-sm border bg-black/30 cursor-help transition-[filter,border-color] hover:brightness-125 ${keptStoryRead.keptEnders > 0 ? "border-[#b8a8d8]/40 text-[#c8bcd8]" : "border-[#7ac8d0]/40 text-[#a8d8de]"}`}
                  title={`${keptStoryRead.keptEnders} of the tail's ${keptStoryRead.selfKept} self-kept quiet${keptStoryRead.selfKept === 1 ? "" : "s"} end${keptStoryRead.keptEnders === 1 ? "s" : ""} in a changed mind — ${keptStoryRead.rowsCount} row${keptStoryRead.rowsCount === 1 ? "" : "s"} keep${keptStoryRead.rowsCount === 1 ? "s" : ""} their own silence, ${keptStoryRead.totalMin >= 100 ? Math.round(keptStoryRead.totalMin) : keptStoryRead.totalMin.toFixed(1)}′ of self-kept minutes${keptStoryRead.broken > 0 ? `; ${keptStoryRead.broken} chain${keptStoryRead.broken === 1 ? "" : "s"} broken by an unreadable stamp, said not bridged` : ""}.`}
                  data-testid="board-ledger-keptstory-census"
                >
                  ⌂ {keptStoryRead.selfKept} SELF-KEPT · {keptStoryRead.keptEnders} HOMEcomings
                </span>
                {keptStoryRead.pooledHomecomingMin !== null &&
                  (() => {
                    // R148 · THE POOLED BAR: the census's own rhythm made
                    // visible like the chips' bars — the pooled median
                    // against a census-internal scale (the max of the
                    // pooled median and the slowest homecomer, so the bar
                    // can never overflow). The census reads its own bar.
                    const pooledScale = Math.max(
                      keptStoryRead.pooledHomecomingMin ?? 0,
                      keptStoryRead.slowestHomecomingMin ?? 0,
                    );
                    const pooledPct =
                      pooledScale > 0
                        ? Math.max(
                            8,
                            ((keptStoryRead.pooledHomecomingMin ?? 0) / pooledScale) * 100,
                          )
                        : 8;
                    return (
                      <span
                        className="vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border border-[#2a3324] bg-black/30 text-[#8ac0c8]/85 cursor-help transition-[filter,box-shadow] hover:brightness-125 hover:shadow-[0_0_6px_rgba(122,200,208,0.3),0_0_9px_rgba(184,168,216,0.25)]"
                        title={`THE HOMECOMING LADDER (R147): the census's POOLED rhythm — every row's own homecoming intervals (each computed over that row's time-sorted self-kept ender stamps) pool into ONE census, and its median reads ${keptStoryRead.pooledHomecomingMin >= 100 ? Math.round(keptStoryRead.pooledHomecomingMin) : keptStoryRead.pooledHomecomingMin.toFixed(1)}′ over ${keptStoryRead.homecomingIntervals} interval${keptStoryRead.homecomingIntervals === 1 ? "" : "s"}. A median without its n hides the read's own reach — the n rides. The pool joins INTERVALS, never a row's stamps to another row's; the slowest row in the WHOLE census (the chips' cadence bar's scale) is ${keptStoryRead.slowestHomecomingMin !== null ? `${keptStoryRead.slowestHomecomingMin >= 100 ? Math.round(keptStoryRead.slowestHomecomingMin) : keptStoryRead.slowestHomecomingMin.toFixed(1)}′` : "—"}. The bar is the pooled median against a census-internal scale (the larger of itself and the slowest homecomer). R151 · THE POOL'S KEEPER: the row feeding the most intervals into this pool is ${keptStoryRead.pooledHomecomingBy ?? "—"} — whose rhythm shapes the median most (intervals counted per row, first-seen on a tie in the census's own order; the keeper rides the pool's own existence). R152 · THE POOL'S SECOND VOICE: the next-most feeder is ${keptStoryRead.pooledHomecomingSecond ?? "—"} (the keeper's own seat excluded, so the census's next voice rides beside its first; first-seen on a tie; absent when fewer than two rows feed the pool). R153 · THE COUNTED VOICES: the keeper feeds ${keptStoryRead.pooledHomecomingByCount ?? "—"} of the pool's ${keptStoryRead.homecomingIntervals} interval${keptStoryRead.homecomingIntervals === 1 ? "" : "s"}, the second voice ${keptStoryRead.pooledHomecomingSecondCount ?? "—"} — the names' own counts, from the same scan. R154 · THE SELF-COUNTED ROWS: each row's chip says its own share (⌂×n) — the rows' non-null counts sum to this very n.`}
                        data-testid="board-ledger-keptstory-pooled"
                      >
                        <span
                          className="inline-block h-[3px] w-[14px] overflow-hidden rounded-full bg-black/50 align-middle"
                          aria-hidden
                          data-testid="board-ledger-keptstory-pooled-bar"
                        >
                          <span
                            className="block h-full rounded-full bg-gradient-to-r from-[#7ac8d0]/85 to-[#8ac0c8]/40 transition-[filter] duration-500"
                            style={{ width: `${pooledPct}%` }}
                          />
                        </span>
                        ⌁ pooled{" "}
                        {keptStoryRead.pooledHomecomingMin >= 100
                          ? Math.round(keptStoryRead.pooledHomecomingMin)
                          : keptStoryRead.pooledHomecomingMin.toFixed(1)}
                        ′ · {keptStoryRead.homecomingIntervals} int
                        {keptStoryRead.pooledHomecomingBy && (
                          <span
                            className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#a8d8de]"
                            data-testid="board-ledger-keptstory-pooled-by"
                          >
                            ⌂ {keptStoryRead.pooledHomecomingBy}
                            {keptStoryRead.pooledHomecomingByCount !== null && (
                              <span
                                className="vvu-label text-[#8ac0c8]/70"
                                data-testid="board-ledger-keptstory-pooled-by-count"
                              >
                                {" "}
                                ×{keptStoryRead.pooledHomecomingByCount}
                              </span>
                            )}
                          </span>
                        )}
                        {keptStoryRead.pooledHomecomingSecond && (
                          <span
                            className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#a8d8de]/70"
                            data-testid="board-ledger-keptstory-pooled-second"
                          >
                            + {keptStoryRead.pooledHomecomingSecond}
                            {keptStoryRead.pooledHomecomingSecondCount !== null && (
                              <span
                                className="vvu-label text-[#8ac0c8]/70"
                                data-testid="board-ledger-keptstory-pooled-second-count"
                              >
                                {" "}
                                ×{keptStoryRead.pooledHomecomingSecondCount}
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    );
                  })()}
                {keptStoryRead.newestHomeAt &&
                  (() => {
                    // R150 · WHO CAME HOME + THE RENDER-FRAME AGE: the
                    // kept census's fresh chip grows its owner's name
                    // and its minutes-ago — symmetric to the striking
                    // census's chip; one engine pass owns the stamp and
                    // the name.
                    const homeMs = Date.parse(keptStoryRead.newestHomeAt!);
                    const homeAgeMin =
                      Number.isFinite(homeMs) && renderNow >= homeMs
                        ? Math.floor((renderNow - homeMs) / 60000)
                        : null;
                    return (
                      <span
                        className="vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border border-[#2a3324] bg-black/30 text-[#8ac0c8]/85 cursor-help transition-[filter,box-shadow] hover:brightness-125 hover:shadow-[0_0_6px_rgba(122,200,208,0.3),0_0_9px_rgba(184,168,216,0.25)]"
                        title={`R149 · THE FRESH HAND: the census's freshest homecoming @ ${stampOf(keptStoryRead.newestHomeAt)} UTC — the newest stamp across ALL rows' lastAt (a chronological max by Date.parse, never a string compare). R150 · WHO CAME HOME: the stamp and its owner ride together — ${keptStoryRead.newestHomeBy ?? "—"} came home last (one pass, one max, first-seen on a tie; no seniority for the strongest row, no rhythm required — a single-ender row can own the freshness). THE RENDER-FRAME AGE: the minutes-ago reads the render's own frame — the board's clock is the render, re-read at each telemetry pass; not a wall-clock promise, a render-frame read. R155 · the freshness is now DISTRIBUTED: every row chip wears its own hand (freshest / in-rhythm / drifted), this chip still names THE owner.`}
                        data-testid="board-ledger-keptstory-fresh"
                      >
                        ⌁ last ⌂ {stampOf(keptStoryRead.newestHomeAt)}
                        {keptStoryRead.newestHomeBy && (
                          <span
                            className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#a8d8de]"
                            data-testid="board-ledger-keptstory-fresh-by"
                          >
                            {keptStoryRead.newestHomeBy}
                          </span>
                        )}
                        {homeAgeMin !== null && (
                          <span
                            className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#8ac0c8]/70"
                            data-testid="board-ledger-keptstory-fresh-age"
                          >
                            · {homeAgeMin >= 100 ? Math.round(homeAgeMin) : homeAgeMin}′ ago
                          </span>
                        )}
                      </span>
                    );
                  })()}
                {crossCadenceRead.paired > 0 &&
                  (() => {
                    // R147 · THE CADENCE COMPASS: the widest contrast row's
                    // two rhythms as a PAIR of mini-bars, one scale for
                    // both — the census's own slowest hand (component-level
                    // compassScale: the max of the kept census's slowest
                    // homecoming and the turnover census's slowest
                    // strike; the unfold's rows read the same source).
                    // Teal = the homecoming hand, violet = the striking
                    // hand; the pair reads WHICH hand runs faster at a
                    // glance. First-wins tie on the widest (the engine's
                    // own rule) — the compass rides it.
                    const homePct =
                      compassScale > 0 && crossCadenceRead.widest
                        ? Math.max(8, (crossCadenceRead.widest.homecomingMin / compassScale) * 100)
                        : 8;
                    const strikePct =
                      compassScale > 0 && crossCadenceRead.widest
                        ? Math.max(8, (crossCadenceRead.widest.cadenceMin / compassScale) * 100)
                        : 8;
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          const next = !compassOpen;
                          setCompassOpen(next);
                          rememberFold("compass", next);
                          // any manual click is the reader's own fold — the
                          // remembered cue retires for this session's read
                          setCompassRemembered(false);
                        }}
                        aria-expanded={compassOpen}
                        className={`vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border bg-black/30 transition-[filter,border-color,box-shadow] hover:brightness-125 border-[#7ac8d0]/40 text-[#a8d8de] hover:shadow-[0_0_6px_rgba(122,200,208,0.35),0_0_9px_rgba(184,168,216,0.35)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00] ${compassOpen ? "border-[#c8ff00]/60 text-[#c8ff00] bg-[#c8ff00]/10" : "cursor-pointer"}`}
                        title={`${crossCadenceRead.line} — the two rhythms joined by row: the kept story's homecoming cadence (the median between a row's self-kept enders) and the unruled turnovers' striking cadence (the median between its below-ending minds), one row carrying BOTH. A row that comes home fast AND strikes below fast runs one temperament; a row fast at one hand and slow at the other runs two — the spread says how far apart the two clocks sit. THE CADENCE COMPASS rides the widest contrast row: the teal bar is its homecoming hand, the violet bar its striking hand — one scale for both (the census's own slowest hand across the two censuses), the longer bar the slower rhythm. R148 · CLICK to unfold the whole paired-rows table — every both-rhythm row's two hands on the one scale, the widest badged. R152 · the folded badge carries the widest row's STALER hand too — the drift rides the fold (⌂ home stale, ↩ strike stale, = tied)${compassOpen ? " (unfolded — click to fold back)" : ""}.`}
                        data-testid="board-ledger-crosscadence"
                      >
                        <span>
                          ⇄⌈ {crossCadenceRead.paired} BOTH RHYTHMS · ⌂
                          {crossCadenceRead.fasterAtHome} ↩{crossCadenceRead.fasterBelow}
                        </span>
                        {crossCadenceRead.widest && (
                          <span
                            className="inline-flex items-center gap-0.5"
                            aria-hidden
                            data-testid="board-ledger-crosscadence-compass"
                          >
                            <span className="inline-block h-[3px] w-[14px] overflow-hidden rounded-full bg-black/50 align-middle">
                              <span
                                className="block h-full rounded-full bg-[#7ac8d0]/85 transition-[filter] duration-500"
                                style={{ width: `${homePct}%` }}
                              />
                            </span>
                            <span className="inline-block h-[3px] w-[14px] overflow-hidden rounded-full bg-black/50 align-middle">
                              <span
                                className="block h-full rounded-full bg-[#b8a8d8]/85 transition-[filter] duration-500"
                                style={{ width: `${strikePct}%` }}
                              />
                            </span>
                            <span className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-current opacity-80">
                              {crossCadenceRead.widest.name}{" "}
                              {crossCadenceRead.widest.deltaMin > 0
                                ? "+"
                                : crossCadenceRead.widest.deltaMin < 0
                                  ? "-"
                                  : "±"}
                              {Math.abs(crossCadenceRead.widest.deltaMin) >= 100
                                ? Math.round(Math.abs(crossCadenceRead.widest.deltaMin))
                                : Math.abs(crossCadenceRead.widest.deltaMin).toFixed(1)}
                              ′
                            </span>
                            {crossCadenceRead.widest.stalerHand &&
                              (() => {
                                // R152 · THE WIDE'S OWN READING: the folded
                                // badge carries the widest row's staler hand
                                // — the drift rides the fold, no unfold
                                // needed. The hand's own color dimmed, the
                                // bars still lead.
                                const staleTone =
                                  crossCadenceRead.widest!.stalerHand === "home"
                                    ? "text-[#7ac8d0]/70"
                                    : crossCadenceRead.widest!.stalerHand === "strike"
                                      ? "text-[#c8bcd8]/70"
                                      : "text-[#9a8ac0]/70";
                                const staleWord =
                                  crossCadenceRead.widest!.stalerHand === "home"
                                    ? "⌂ stale"
                                    : crossCadenceRead.widest!.stalerHand === "strike"
                                      ? "↩ stale"
                                      : "= tied";
                                return (
                                  <span
                                    className={`vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] ${staleTone}`}
                                    aria-hidden
                                    data-testid="board-ledger-crosscadence-compass-stale"
                                  >
                                    {staleWord}
                                  </span>
                                );
                              })()}
                          </span>
                        )}
                      </button>
                    );
                  })()}
                {compassOpen && crossCadenceRead.rows.length > 0 && (
                  <div
                    className="w-full rounded-sm border border-[#2a3324]/70 bg-black/20 px-1.5 py-1 mt-0.5 transition-colors duration-200 hover:border-[#3a4530]"
                    data-testid="board-ledger-crosscadence-unfold"
                  >
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      <span
                        className="vvu-label text-[6px] font-bold tracking-[0.12em] text-[#a8d8de]/90"
                        title={`the compass unfolds — all ${crossCadenceRead.rows.length} row${crossCadenceRead.rows.length === 1 ? "" : "s"} carrying BOTH rhythms, in the kept census's own order (keptEnders desc): the teal bar each row's homecoming hand, the violet bar its striking hand, ONE scale for all (the two censuses' slowest hand). The widest contrast row wears the WIDE badge (first-wins on a tie). A spread ≤15′ reads COMPACT (the two clocks agree); ≥40′ reads SPLIT (they run apart). R149 · each row rides its two hands' freshest stamps (⌂ teal, ↩ violet) — tempo AND recency, one row, one line. R150 · each row's delta is SIGNED (⌂+ lingers at home, ↩- strikes the slower, ±0 the kind tie) — the spread's magnitude given its direction, teal the lingering hand violet the striking one. R151 · each row badges its STALER hand — which of its two stamps is the older, the recency that has drifted.`}
                        data-testid="board-ledger-crosscadence-unfold-title"
                      >
                        ⇄⌈ THE COMPASS UNFOLDS · {crossCadenceRead.rows.length} row
                        {crossCadenceRead.rows.length === 1 ? "" : "s"} · both hands, one scale
                      </span>
                      {crossCadenceRead.rows.map((r) => {
                        const homePctU =
                          compassScale > 0
                            ? Math.max(8, (r.homecomingMin / compassScale) * 100)
                            : 8;
                        const strikePctU =
                          compassScale > 0 ? Math.max(8, (r.cadenceMin / compassScale) * 100) : 8;
                        const isWidest = crossCadenceRead.widest?.id === r.id;
                        const spreadTone =
                          r.spread <= 15
                            ? "text-[#8ac0c8]"
                            : r.spread >= 40
                              ? "text-[#c8bcd8]"
                              : "text-[#9a8ac0]/80";
                        const spreadWord =
                          r.spread <= 15 ? "COMPACT" : r.spread >= 40 ? "SPLIT" : "MIXED";
                        // R150 · THE WIDER HAND'S SIGNED DELTA: the tag
                        // now signs the distance — ⌂+ the homecoming
                        // hand runs the slower (it lingers at home),
                        // ↩- the striking hand does, ±0 the exact tie
                        // reading the kinder at-home. The tone rides
                        // the sign: teal the lingering hand, violet
                        // the striking one — the bars' own two
                        // colors, so the delta reads at a glance.
                        const deltaTone =
                          r.deltaMin > 0
                            ? "text-[#7ac8d0]"
                            : r.deltaMin < 0
                              ? "text-[#c8bcd8]"
                              : "text-[#9a8ac0]/80";
                        const deltaAbs = Math.abs(r.deltaMin);
                        return (
                          <span
                            key={r.id}
                            className="vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border border-[#2a3324] bg-black/30 text-[#b8d8de]/90 transition-[filter,box-shadow] hover:brightness-125 hover:shadow-[0_0_6px_rgba(122,200,208,0.3),0_0_9px_rgba(184,168,216,0.25)]"
                            title={`${r.name}: comes home ${r.homecomingMin >= 100 ? Math.round(r.homecomingMin) : r.homecomingMin.toFixed(1)}′ apart, strikes below ${r.cadenceMin >= 100 ? Math.round(r.cadenceMin) : r.cadenceMin.toFixed(1)}′ apart — the spread ${r.spread >= 100 ? Math.round(r.spread) : r.spread.toFixed(1)}′ reads ${spreadWord}. Last home @ ${r.homeLastAt ? stampOf(r.homeLastAt) : "—"} UTC, last strike @ ${r.strikeLastAt ? stampOf(r.strikeLastAt) : "—"} UTC — the stamps ride the two censuses verbatim (R149). ${r.faster === "at-home" ? "The homecoming hand is the faster (an exact tie reads kinder)." : "The striking hand is the faster."} R150 · the delta SIGNS the wider hand: ⌂+ the homecoming hand runs the slower (it lingers at home), ↩- the striking hand does, ±0 the exact tie reads the kinder at-home — teal the lingering hand, violet the striking one, the bars' own two colors. R151 · the STALER badge names which hand's freshest stamp is the older${r.stalerHand === "home" ? " — ⌂ the homecoming hand's recency has drifted." : r.stalerHand === "strike" ? " — ↩ the striking hand's recency has drifted." : r.stalerHand === "tie" ? " — both hands last spoke the same instant (a stale tie)." : " — absent here: a stamp is unreadable, the badge never guesses."}`}
                            data-testid={`board-ledger-crosscadence-unfold-${r.id}`}
                          >
                            {isWidest && (
                              <span
                                className="vvu-label px-0.5 rounded-sm bg-[#c8ff00]/15 text-[#c8ff00] text-[5.5px] shadow-[0_0_5px_rgba(200,255,0,0.28)]"
                                aria-hidden
                              >
                                WIDE
                              </span>
                            )}
                            <span
                              className="inline-block h-[3px] w-[18px] overflow-hidden rounded-full bg-black/50 align-middle"
                              aria-hidden
                            >
                              <span
                                className="block h-full rounded-full bg-[#7ac8d0]/85 transition-[filter] duration-500"
                                style={{ width: `${homePctU}%` }}
                              />
                            </span>
                            <span
                              className="inline-block h-[3px] w-[18px] overflow-hidden rounded-full bg-black/50 align-middle"
                              aria-hidden
                            >
                              <span
                                className="block h-full rounded-full bg-[#b8a8d8]/85 transition-[filter] duration-500"
                                style={{ width: `${strikePctU}%` }}
                              />
                            </span>
                            {r.name}
                            {r.homeLastAt && (
                              <span
                                className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#7ac8d0]/90"
                                aria-hidden
                                data-testid={`board-ledger-crosscadence-unfold-home-${r.id}`}
                              >
                                ⌂{stampOf(r.homeLastAt)}
                              </span>
                            )}
                            {r.strikeLastAt && (
                              <span
                                className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#b8a8d8]/90"
                                aria-hidden
                                data-testid={`board-ledger-crosscadence-unfold-strike-${r.id}`}
                              >
                                ↩{stampOf(r.strikeLastAt)}
                              </span>
                            )}
                            <span
                              className={`vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] ${deltaTone}`}
                              aria-hidden
                              data-testid={`board-ledger-crosscadence-unfold-delta-${r.id}`}
                            >
                              {r.deltaMin > 0 ? "⌂+" : r.deltaMin < 0 ? "↩-" : "⌂±"}{" "}
                              {deltaAbs >= 100 ? Math.round(deltaAbs) : deltaAbs.toFixed(1)}′{" "}
                              {spreadWord}
                            </span>
                            {r.stalerHand &&
                              (() => {
                                // R151 · THE STALER BADGE: which hand's
                                // recency has drifted — the OLDER of the
                                // two stamps, named with the hand's own
                                // glyph and its own color (dimmed: the
                                // badge warns, the bars still lead). A
                                // stale tie reads neutral; an unreadable
                                // stamp leaves the badge honestly absent
                                // (the engine's null, never guessed).
                                const stalerTone =
                                  r.stalerHand === "home"
                                    ? "text-[#7ac8d0]/75"
                                    : r.stalerHand === "strike"
                                      ? "text-[#c8bcd8]/75"
                                      : "text-[#9a8ac0]/75";
                                const stalerWord =
                                  r.stalerHand === "home"
                                    ? "⌂ staler"
                                    : r.stalerHand === "strike"
                                      ? "↩ staler"
                                      : "= stale tied";
                                return (
                                  <span
                                    className={`vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] ${stalerTone}`}
                                    aria-hidden
                                    data-testid={`board-ledger-crosscadence-unfold-staler-${r.id}`}
                                  >
                                    {stalerWord}
                                  </span>
                                );
                              })()}
                          </span>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          setCompassOpen(false);
                          setCompassRemembered(false);
                          rememberFold("compass", false);
                        }}
                        className="vvu-label text-[6px] font-bold text-[#7ac8d0]/80 px-1 py-px rounded-sm border border-[#7ac8d0]/30 hover:border-[#2a4a4e] hover:-translate-y-px transition-[color,transform,border-color] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]"
                        title={`fold the compass back — the badge keeps the count and the widest contrast row's pair of bars; the session remembers the fold (R157)${leftAtStamps.compass ? ` — left open at ${stampOf(leftAtStamps.compass)} UTC (R158 · the dated memory)` : ""}`}
                        data-testid="board-ledger-crosscadence-fold"
                      >
                        {compassRemembered && (
                          <span
                            className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#b8a8d8] cursor-help mr-0.5 transition-[filter] hover:brightness-125"
                            title={`R157 · THE WIDENED MEMORY: this fold was restored from your last read (the session carries it across reloads) — the ↺ says remembered, not re-derived.${rememberedAdopted ? " R160 · THE ADOPTED VOICE: this memory was ADOPTED from the estate — another tab\u2019s read, owned by this one from its first mount." : ""} Any click of your own retires the cue.`}
                            data-testid="board-ledger-crosscadence-remembered"
                          >
                            ↺
                          </span>
                        )}
                        − fold the compass
                      </button>
                    </div>
                  </div>
                )}
                {(showAllKeepers ? keptStoryRead.rows : keptStoryRead.rows.slice(0, 3)).map((r) => {
                  // THE KEPT LIGHT's fuel: the row's self-kept quiet
                  // seats (teal) + its kept enders (violet) — the
                  // homecoming made visible in two colors.
                  const quietKeys = new Set(r.quietSeats.map(seatKey));
                  const keptKeys = new Set(r.keptSeats.map(seatKey));
                  const holdKept = () => setKeptLit({ quietKeys, keptKeys, label: r.name });
                  const share = r.selfKept > 0 ? Math.max(4, (r.keptEnders / r.selfKept) * 100) : 0;
                  // R145 · THE HOMECOMING MINI-BAR: the cadence made
                  // visible like the share bar — the bar's length is
                  // the row's median homecoming interval against the
                  // SLOWEST homecomer in the whole census (R147 moves
                  // the scale INTO the engine — slowestHomecomingMin,
                  // max over ALL rows, the slowestCadenceMin pattern's
                  // own twin; a stable scale the suite pins). Short bar
                  // = the row comes home fast. No cadence yet (fewer
                  // than two homecomings) → no bar, the honest absence.
                  const cadencePct =
                    r.homecomingMin !== null &&
                    keptStoryRead.slowestHomecomingMin !== null &&
                    keptStoryRead.slowestHomecomingMin > 0
                      ? Math.max(8, (r.homecomingMin / keptStoryRead.slowestHomecomingMin) * 100)
                      : null;
                  // R155 · the row's own freshness hand: the delta to the
                  // census's freshest, the render's own read of the engine's
                  // verdict (the stamps ride verbatim; the minutes ride for
                  // the title).
                  const freshDeltaMin =
                    r.freshness && r.lastAt && keptStoryRead.newestHomeAt
                      ? Math.round(
                          (Date.parse(keptStoryRead.newestHomeAt) - Date.parse(r.lastAt)) / 60000,
                        )
                      : null;
                  const medianStr =
                    keptStoryRead.pooledHomecomingMin !== null
                      ? keptStoryRead.pooledHomecomingMin >= 100
                        ? String(Math.round(keptStoryRead.pooledHomecomingMin))
                        : keptStoryRead.pooledHomecomingMin.toFixed(1)
                      : null;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setFilter(filter === r.id ? null : r.id)}
                      onMouseEnter={holdKept}
                      onMouseLeave={() => setKeptLit(null)}
                      onFocus={holdKept}
                      onBlur={() => setKeptLit(null)}
                      className={`vvu-label group inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border cursor-pointer transition-[filter,transform,border-color,color,box-shadow] hover:brightness-125 hover:-translate-y-px active:translate-y-0 ${filter === r.id ? "border-[#c8ff00]/70 text-[#c8ff00] bg-[#c8ff00]/10" : "border-[#2a3324] text-[#8ac0c8]/90 bg-black/20 hover:text-[#b8d8de] hover:border-[#2a4a4e] hover:shadow-[0_0_6px_rgba(122,200,208,0.3),0_0_9px_rgba(184,168,216,0.3)]"} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]`}
                      title={`${r.name} keeps its own silence — ${r.keptEnders} of its ${r.selfKept} self-kept quiet${r.selfKept === 1 ? "" : "s"} end${r.keptEnders === 1 ? "s" : ""} in a taken-back word (${r.keptMin >= 100 ? Math.round(r.keptMin) : r.keptMin.toFixed(1)}′ of ${r.totalMin >= 100 ? Math.round(r.totalMin) : r.totalMin.toFixed(1)}′), the longest ${r.longestMin >= 100 ? Math.round(r.longestMin) : r.longestMin.toFixed(1)}′${r.homecomingMin !== null ? `, the homecomings median ${r.homecomingMin >= 100 ? Math.round(r.homecomingMin) : r.homecomingMin.toFixed(1)}′ apart${cadencePct !== null ? " (the violet bar's length is that interval against the slowest homecomer — short bar, fast homecoming)" : ""}` : ", a single homecoming so far"}${r.pooledCount !== null ? `, its own ${r.pooledCount} interval${r.pooledCount === 1 ? "" : "s"} in the pool (R154)` : ""}, last @ ${r.lastAt ? stampOf(r.lastAt) : "—"} UTC — HOLD the chip and the motion line lights the row's self-kept quiets in teal and its kept enders in violet; click to read the row's motion`}
                      data-testid={`board-ledger-keptstory-${r.id}`}
                    >
                      <span
                        className="inline-block h-[3px] w-[22px] overflow-hidden rounded-full bg-black/50 align-middle"
                        aria-hidden
                      >
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-[#b8a8d8]/80 to-[#7ac8d0]/40 transition-[filter] duration-500 group-hover:brightness-150"
                          style={{ width: `${share}%` }}
                        />
                      </span>
                      {cadencePct !== null && (
                        <span
                          className="inline-block h-[3px] w-[16px] overflow-hidden rounded-full bg-black/50 align-middle"
                          aria-hidden
                          data-testid={`board-ledger-keptstory-cadence-${r.id}`}
                        >
                          <span
                            className="block h-full rounded-full bg-[#b8a8d8]/85 transition-[filter] duration-500 group-hover:brightness-150"
                            style={{ width: `${cadencePct}%` }}
                          />
                        </span>
                      )}
                      {r.freshness && (
                        <span
                          className={`inline-block h-1 w-1 rounded-full cursor-help transition-[filter] hover:brightness-125 ${HAND_DOT_CLS[r.freshness]}`}
                          title={`R155 · THE ROW'S FRESHNESS HAND: ${r.freshness}${r.freshness === "freshest" ? " — this row owns the census's freshest homecoming (the R150 chip names THE owner; the hand says the degree — a same-instant tie reads freshest too)." : r.freshness === "in-rhythm" ? ` — ${freshDeltaMin}′ behind the freshest, within one pooled median (${medianStr}′) — the census's own rhythm is the yardstick, never an invented constant.` : ` — ${freshDeltaMin}′ behind the freshest, beyond one pooled median (${medianStr}′) — the row's homecoming recency has drifted.`} R156 · the judgment rides THE SHARED HAND (classifyFreshness) — the same law the digest's tension dots speak.`}
                          data-testid={`board-ledger-keptstory-freshness-${r.id}`}
                        />
                      )}
                      {r.name}
                      <span
                        className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-current opacity-80"
                        aria-hidden
                      >
                        ⌇×{r.selfKept}
                      </span>
                      <span
                        className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-current opacity-80"
                        aria-hidden
                      >
                        ↩×{r.keptEnders}
                      </span>
                      {r.pooledCount !== null && (
                        <span
                          className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#7ac8d0]/85 cursor-help"
                          title={`R154 · THE SELF-COUNTED ROW: ${r.pooledCount} of this row's own homecoming intervals feed the pooled census — the keeper's arithmetic, said per row (the rows' non-null counts sum to the pool's ${keptStoryRead.homecomingIntervals}).`}
                          data-testid={`board-ledger-keptstory-pooledcount-${r.id}`}
                        >
                          ⌂×{r.pooledCount}
                        </span>
                      )}
                    </button>
                  );
                })}
                {keptStoryRead.rows.length > 3 &&
                  !showAllKeepers &&
                  (() => {
                    // R156 · THE COMPANY'S HANDS IN THE BUTTON: the rows
                    // the fold hides still speak — their freshness hands
                    // (the SAME vocabulary the visible rows wear) are
                    // counted in the unfold button itself, colored per
                    // hand, so the reader knows who waits inside before
                    // the click. A hidden row with no hand (no pooled
                    // rhythm, an unreadable stamp) says nothing — the
                    // absence is the hand's own law.
                    const hidden = keptStoryRead.rows.slice(3);
                    const handCounts: Record<Exclude<FreshnessHand, never>, number> = {
                      freshest: 0,
                      "in-rhythm": 0,
                      drifted: 0,
                    };
                    for (const r of hidden) if (r.freshness) handCounts[r.freshness] += 1;
                    return (
                      <button
                        onClick={() => {
                          setShowAllKeepers(true);
                          setKeepersRemembered(false);
                          rememberFold("keepers", true);
                        }}
                        className="vvu-label inline-flex items-center gap-1 text-[6px] font-bold text-[#5f6e55] px-1 py-px rounded-sm border border-transparent hover:border-[#3a4530] hover:text-[#7a8a6e] hover:-translate-y-px transition-[color,transform,border-color] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]"
                        title={`${keptStoryRead.rows.length - 3} more row${keptStoryRead.rows.length - 3 === 1 ? "" : "s"} keep their own silence — the strongest three render first (keptEnders desc, selfKept desc, name asc) — CLICK to unfold the whole company in place. R156 · THE COMPANY'S HANDS IN THE BUTTON: the hidden rows' freshness hands are counted here (${handCounts.freshest} freshest, ${handCounts["in-rhythm"]} in-rhythm, ${handCounts.drifted} drifted), the shared vocabulary the visible rows wear — judged by the engine's one read against the pool's own median, never a constant.`}
                        data-testid="board-ledger-keptstory-more"
                      >
                        +{keptStoryRead.rows.length - 3} more keepers
                        {(handCounts.freshest > 0 ||
                          handCounts["in-rhythm"] > 0 ||
                          handCounts.drifted > 0) && (
                          <span className="inline-flex items-center gap-0.5" aria-hidden>
                            {handCounts.freshest > 0 && (
                              <span
                                className={`vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] cursor-help ${HAND_WORD_CLS.freshest}`}
                                title="R156 · the hidden company's freshest hand count — the same word the visible rows' dots wear"
                                data-testid="board-ledger-keptstory-more-hand-freshest"
                              >
                                · {handCounts.freshest} freshest
                              </span>
                            )}
                            {handCounts["in-rhythm"] > 0 && (
                              <span
                                className={`vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] cursor-help ${HAND_WORD_CLS["in-rhythm"]}`}
                                title="R156 · the hidden company's in-rhythm hand count — within one pooled median of the freshest"
                                data-testid="board-ledger-keptstory-more-hand-in-rhythm"
                              >
                                · {handCounts["in-rhythm"]} in-rhythm
                              </span>
                            )}
                            {handCounts.drifted > 0 && (
                              <span
                                className={`vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] cursor-help ${HAND_WORD_CLS.drifted}`}
                                title="R156 · the hidden company's drifted hand count — beyond one pooled median, the recency grown distant"
                                data-testid="board-ledger-keptstory-more-hand-drifted"
                              >
                                · {handCounts.drifted} drifted
                              </span>
                            )}
                          </span>
                        )}
                      </button>
                    );
                  })()}
                {showAllKeepers && keptStoryRead.rows.length > 3 && (
                  <button
                    onClick={() => {
                      setShowAllKeepers(false);
                      setKeepersRemembered(false);
                      rememberFold("keepers", false);
                    }}
                    className="vvu-label text-[6px] font-bold text-[#7ac8d0]/80 px-1 py-px rounded-sm border border-[#7ac8d0]/30 hover:border-[#2a4a4e] hover:-translate-y-px transition-[color,transform,border-color] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c8ff00]"
                    title={`the whole company shows — all ${keptStoryRead.rows.length} keeper${keptStoryRead.rows.length === 1 ? "" : "s"} of their own silence — CLICK to fold back to the strongest three; the session remembers the fold (R156, R157)${leftAtStamps.keepers ? ` — left open at ${stampOf(leftAtStamps.keepers)} UTC (R158 · the dated memory)` : ""}`}
                    data-testid="board-ledger-keptstory-fold"
                  >
                    {keepersRemembered && (
                      <span
                        className="vvu-label px-0.5 rounded-sm bg-black/40 text-[5.5px] text-[#b8a8d8] cursor-help mr-0.5 transition-[filter] hover:brightness-125"
                        title={`R157 · THE WIDENED MEMORY: this fold was restored from your last read (the session carries it across reloads) — the ↺ says remembered, not re-derived.${rememberedAdopted ? " R160 · THE ADOPTED VOICE: this memory was ADOPTED from the estate — another tab\u2019s read, owned by this one from its first mount." : ""} Any click of your own retires the cue.`}
                        data-testid="board-ledger-keptstory-remembered"
                      >
                        ↺
                      </span>
                    )}
                    − fold the keepers
                  </button>
                )}
              </div>
              <p
                className="vvu-label mt-0.5 text-[5.5px] leading-relaxed text-[#7ac8d0]/70 cursor-help"
                title={keptStoryRead.line}
                data-testid="board-ledger-keptstory-line"
              >
                ⌂ {keptStoryRead.line}
                {filter !== null ? " (within this row's motion)" : ""}
              </p>
            </div>
          )}
          {unruled.total > 0 && unruled.unruled === 0 && (
            <div
              className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-sm border border-dashed border-[#2a3324]/70 bg-black/10 px-1.5 py-1 transition-colors duration-200 hover:border-[#3a4530]"
              data-testid="board-ledger-unruled-empty-allruled"
            >
              <ListEnd className="h-2.5 w-2.5 text-[#5f6e55]" aria-hidden />
              <span
                className="vvu-label text-[6px] text-[#7a8a6e] cursor-help"
                title={`the ladder names all ${unruled.total} of the tail's readable quiet${unruled.total === 1 ? "" : "s"} — the shape below the rungs is empty, honest, not invented. Deepen the depth and the tail may hold more silence than the rungs can name.`}
              >
                the ladder names all {unruled.total} of the tail&apos;s quiets — nothing waits below
                the rungs
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FlipChip({ flip }: { flip: BoardFlip }) {
  const toneOnly = flip.kind === "tone";
  return (
    <span
      className={`vvu-label inline-flex items-center gap-1 text-[6px] font-bold px-1 py-px rounded-sm border cursor-help transition-[filter,transform] hover:brightness-125 hover:-translate-y-px ${TONE_CLS[(flip.toTone as WatchTone) ?? "neutral"] ?? TONE_CLS.neutral}`}
      title={
        toneOnly
          ? `${flip.name}: the word held (${flip.from}) while its severity moved ${flip.fromTone} → ${flip.toTone} (board stamp ${stampOf(flip.at)} UTC) — a tone shift, the rarer motion`
          : `${flip.name}: ${flip.from} → ${flip.to} (board stamp ${stampOf(flip.at)} UTC) — the board's own words, dated by the board's own stamp`
      }
      data-testid={`board-ledger-flip-${flip.id}`}
    >
      <span
        className={`inline-block h-1 w-1 rounded-full ${FLIP_TONE_DOT[flip.toTone] ?? FLIP_TONE_DOT.neutral!}`}
        aria-hidden
      />
      {flip.name}: {toneOnly ? `${flip.fromTone}→${flip.toTone}` : `${flip.from} → ${flip.to}`}
      <span className="font-normal text-[5.5px] opacity-70">{stampOf(flip.at)}</span>
    </span>
  );
}

/** THE HOT SPARK — the live-tension count across the moved samples, one
 *  bar per sample. The bar's height is the count the board itself
 *  printed at that stamp; the lane adds no trend word — the shape IS the
 *  read. */
/** THE ROW'S MOTION LINE (R130) — the tail's flips on ONE time axis,
 *  seated between the tail's own first and last stamps (never the wall
 *  clock), each dot colored by its flip's LANDING tone. Unfiltered it
 *  is the whole tail's motion at a glance; filtered it is one row's own
 *  ladder. A skipped unreadable stamp is SAID below the line, never
 *  seated. The geometry is the pinned engine's (motionLinePoints); the
 *  drawing adds nothing but the seat.
 *
 *  R131 · KILL MARKS: the tenure dial's resets (killMarks — a standing
 *  age collapsing under a minute) drawn as ROSE TICKS through the axis,
 *  each with its own tooltip naming the collapse. The mark is the
 *  BOARD's shadow of a kill, never the kill's confirmation — the
 *  caption below the line says exactly that. Quarter ticks mark the
 *  axis's own quarters so a dot's seat is readable against something.
 *
 *  R133 · THE FIRST WORD: each distinct row's first flip in the open
 *  tail (firstWords — the chronological contract) drawn as a HOLLOW
 *  RING around the dot that IS the birth — no new seats; the ring
 *  marks a flip already on the axis, in the birth's own landing tone.
 *  The dot's tooltip gains the birth's line; the caption below says
 *  the depth-relativity outright. */
const MOTION_TONE_FILL: Record<string, string> = {
  sage: "#c8ff00",
  cyan: "#00d4e0",
  amber: "#e0a030",
  rose: "#e5484d",
  neutral: "#5f6e55",
};

function MotionLine({
  flips,
  filtered,
  depth,
  lit,
}: {
  flips: BoardFlip[];
  filtered: boolean;
  depth: number;
  lit: {
    kind:
      | "relay"
      | "handoff"
      | "quiet"
      | "twofaces"
      | "turnaround"
      | "delivery"
      | "below"
      | "kept"
      | "turnover";
    groups: Array<{ keys: Set<string>; color: string }>;
    label: string;
  } | null;
}) {
  const { points, skipped } = motionLinePoints(flips);
  const marks = useMemo(() => killMarks(flips), [flips]);
  /** THE FIRST WORD (R133): the tail's births — each distinct row's
   *  first flip, in the order the tail first heard them. The rings
   *  mark flips already on the axis; no new geometry is seated. */
  const births = useMemo(() => firstWords(flips), [flips]);
  const birthKeys = useMemo(
    () => new Set(births.map((b) => `${b.flip.id}|${b.flip.at}`)),
    [births],
  );
  /** THE QUIET BAND (R132): the tail's longest quiet, drawn on the same
   *  axis. The gaps read the CHRONOLOGICAL flips (the lane passes them
   *  so); both of the longest gap's flips are seated (their stamps parse
   *  — the gap exists only between seated flips), so the band never
   *  seats at an invented x. A broken chain is SAID in the caption. */
  const gaps = useMemo(() => gapsOf(flips), [flips]);
  /** THE COMPANY'S BANDS (R136): the stamps where ≥2 distinct rows
   *  moved together — the ensembles, drawn as shaded bands behind the
   *  axis. Grouping is the stamp STRING alone (the engine's clock-free
   *  identity); the seat comes from any flip on the stamp (all flips
   *  sharing it seat at the same x — the seat derives from the stamp). */
  const ensembles = useMemo(() => {
    const byStamp = new Map<string, Map<string, string>>();
    for (const f of flips) {
      let rows = byStamp.get(f.at);
      if (!rows) {
        rows = new Map<string, string>();
        byStamp.set(f.at, rows);
      }
      if (!rows.has(f.id)) rows.set(f.id, f.name);
    }
    return [...byStamp.entries()]
      .filter(([, rows]) => rows.size >= 2)
      .map(([at, rows]) => ({ at, count: rows.size, names: [...rows.values()] }));
  }, [flips]);
  /** THE LIGHT (R139 relay, R140 edges, R141 two faces, R142 delivery
   *  + violet face, R143 below, R144 kept): while a light-holder is
   *  held (the RELAY badge, a handoff/quiet pair chip, a shared-ground
   *  row chip, a delivery edge chip, a turnaround row chip, an
   *  unruled below/pair chip, or a kept-story row chip — hover or
   *  focus), the holder's own flips are marked on the line: an
   *  underline band spanning the seats' extremes and a halo on every
   *  lit flip. Groups carry their own color — the two-faces light
   *  halos the row's turnarounds in violet AND its quiet frames in
   *  cyan; the delivery light halos the deliverers in amber AND the
   *  changed minds in violet; the below light halos the unnamed
   *  quiet's own ends in teal; the kept light halos the row's
   *  self-kept quiets in teal AND its kept enders in violet — the
   *  faces told apart ON the line. No new geometry is seated: the
   *  keys are the motion line's own identity (id|at), resolved
   *  against the seat map below (a holder older than the open depth
   *  renders nothing, the honesty holds). */
  if (points.length === 0) {
    return skipped > 0 ? (
      <p className="vvu-label text-[6px] text-[#7a8a6e]">
        the motion line draws nothing — {skipped} flip{skipped === 1 ? "" : "s"} with unreadable
        stamp{skipped === 1 ? "" : "s"}, said and skipped
      </p>
    ) : null;
  }
  const W = 560;
  const H = 28;
  const padX = 6;
  const y = H / 2;
  const seatOf = new Map<string, number>();
  for (const p of points) seatOf.set(`${p.flip.id}|${p.flip.at}`, padX + p.x * (W - 2 * padX));
  /** The ensemble bands' seats: one seat per STAMP (every flip sharing
   *  a stamp seats at the same x by construction). */
  const seatByStamp = new Map<string, number>();
  for (const p of points)
    if (!seatByStamp.has(p.flip.at)) seatByStamp.set(p.flip.at, padX + p.x * (W - 2 * padX));
  /** THE LIGHT's seats: the holder's keys resolved against the seat
   *  map — only flips the line already seats can light (a holder older
   *  than the open depth renders nothing, the honesty holds). Each
   *  group resolves its own seats and keeps its own color. */
  const litGroups = (lit?.groups ?? [])
    .map((g) => ({
      color: g.color,
      seats: [...g.keys].map((k) => seatOf.get(k)).filter((v): v is number => v !== undefined),
    }))
    .filter((g) => g.seats.length > 0);
  const litDrawable = litGroups.length > 0;
  const allLitSeats = litGroups.flatMap((g) => g.seats);
  const bandColor =
    lit?.kind === "twofaces"
      ? "#d08080"
      : lit?.kind === "delivery" || lit?.kind === "turnaround"
        ? "#b8a8d8"
        : (litGroups[0]?.color ?? "#00d4e0");
  const band =
    gaps.longest !== null
      ? {
          x1: seatOf.get(`${gaps.longest.fromFlip.id}|${gaps.longest.fromFlip.at}`),
          x2: seatOf.get(`${gaps.longest.toFlip.id}|${gaps.longest.toFlip.at}`),
          gap: gaps.longest,
        }
      : null;
  const bandX1 = band?.x1 !== undefined ? band.x1 : null;
  const bandX2 = band?.x2 !== undefined ? band.x2 : null;
  const bandDrawable =
    band !== null && bandX1 !== null && bandX2 !== null && Math.abs(bandX2 - bandX1) >= 1;
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto [&_circle]:cursor-help [&_line]:cursor-help [&_rect]:cursor-help [&_circle]:transition-[filter] [&_circle:hover]:brightness-150 [&_rect:hover]:brightness-150"
        role="img"
        aria-label={
          filtered
            ? "the filtered row's motion line — one dot per flip, seated in tail-time, colored by landing tone, the row's first word ringed, the tenure dial's resets ticked, the longest quiet shaded"
            : "the tail's motion line — every flip on one time axis, colored by landing tone, each row's first word ringed, the tenure dial's resets ticked, the longest quiet shaded, the ensemble stamps banded"
        }
        data-testid="board-ledger-motionline-svg"
      >
        <defs>
          <linearGradient id="quietBandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a4530" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#00d4e0" stopOpacity="0.28" />
          </linearGradient>
        </defs>
        {/* THE COMPANY'S BANDS (R136): behind everything — the stamps
            where ≥2 rows moved together, shaded; hover reads the rows. */}
        {ensembles.map((e) => {
          const cx = seatByStamp.get(e.at);
          if (cx === undefined) return null;
          return (
            <rect
              key={`ens-${e.at}`}
              x={cx - 2.2}
              y={y - 10}
              width={4.4}
              height={20}
              rx={1.2}
              fill="#e0a030"
              opacity={0.12}
              stroke="#e0a030"
              strokeOpacity={0.25}
              strokeWidth={0.5}
              data-testid="board-ledger-ensemble-band"
            >
              <title>{`THE COMPANY — ${e.count} rows moved together @ ${stampOf(e.at)} UTC (${e.names.join(" · ")}): one board stamp, several words changed — the board seen moved once. The company read groups by the stamp's own string; no clock needed.`}</title>
            </rect>
          );
        })}
        {bandDrawable && (
          <rect
            x={Math.min(bandX1!, bandX2!)}
            y={y + 2.5}
            width={Math.abs(bandX2! - bandX1!)}
            height={5}
            rx={1.5}
            fill="url(#quietBandGrad)"
            stroke="#2a3a3e"
            strokeWidth={0.6}
            strokeDasharray="2 1.5"
            data-testid="board-ledger-quietband"
          >
            <title>{`THE LONGEST QUIET — ${band!.gap.min.toFixed(1)}′ with no flip anywhere on the board, opened by ${band!.gap.fromFlip.name} (${band!.gap.fromFlip.from} → ${band!.gap.fromFlip.to}) and ended by ${band!.gap.toFlip.name} (${band!.gap.toFlip.from} → ${band!.gap.toFlip.to}) @ ${stampOf(band!.gap.toFlip.at)} UTC. The silence is the board's own, read from its words' stamps alone.`}</title>
          </rect>
        )}
        {litDrawable && (
          <rect
            x={Math.min(...allLitSeats)}
            y={y - 7.5}
            width={Math.max(...allLitSeats) - Math.min(...allLitSeats) + 0.1}
            height={5}
            rx={1.5}
            fill={bandColor}
            opacity={0.13}
            stroke={bandColor}
            strokeOpacity={0.45}
            strokeWidth={0.6}
            strokeDasharray="2 1.5"
            data-testid="board-ledger-litband"
          >
            <title>{`THE LIGHT — the held holder's span on the axis: every haloed flip is one of the holder's own flips (the ${lit!.kind === "relay" ? "RELAY badge" : lit!.kind === "twofaces" ? "shared row's chip" : lit!.kind === "delivery" ? "delivery edge's chip" : lit!.kind === "turnaround" ? "turnaround row's chip" : lit!.kind === "below" ? "below chip" : lit!.kind === "kept" ? "kept row's chip" : lit!.kind === "turnover" ? "turnover ender's chip" : "pair chip"}, held). The underline spans the seats' extremes; the holder's own flips carry the halos${lit!.kind === "twofaces" ? " — violet for the changed minds, cyan for the quiets" : lit!.kind === "delivery" ? " — amber for the deliverers, violet for the changed minds" : lit!.kind === "below" ? (lit!.groups.length > 1 ? " — teal for the unnamed silence's own ends, violet for the changed minds among them" : " — teal for the unnamed silence's own ends") : lit!.kind === "kept" ? " — teal for the self-kept quiets, violet for the kept enders" : lit!.kind === "turnaround" ? (lit!.groups.length > 1 ? " — violet for the changed minds, teal for the below-quiet seats" : " — violet for the changed minds") : lit!.kind === "turnover" ? " — teal for the below quiets the row's minds ended, violet for the minds themselves" : ""}.`}</title>
          </rect>
        )}
        {/* the axis quarters — a seat readable against something */}
        {[0.25, 0.5, 0.75].map((q) => (
          <line
            key={q}
            x1={padX + q * (W - 2 * padX)}
            y1={y - 2}
            x2={padX + q * (W - 2 * padX)}
            y2={y + 2}
            stroke="#2a3324"
            strokeWidth={1}
          />
        ))}
        <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="#3a4530" strokeWidth={1} />
        {points.map((p, i) => {
          const cx = padX + p.x * (W - 2 * padX);
          const fill = MOTION_TONE_FILL[p.landingTone] ?? MOTION_TONE_FILL.neutral!;
          const isBirth = birthKeys.has(`${p.flip.id}|${p.flip.at}`);
          return (
            <g key={`${p.flip.id}-${p.flip.at}-${i}`}>
              <circle cx={cx} cy={y} r={3.2} fill={fill} stroke="#0d120b" strokeWidth={0.8}>
                <title>{`${p.flip.name}: ${p.flip.from} → ${p.flip.to} @ ${stampOf(p.flip.at)} UTC${isBirth ? ` · THE ROW'S FIRST WORD within the open depth (${depth} moved samples) — a birth older than the tail's reach sits deeper` : ""}`}</title>
              </circle>
              {isBirth && (
                <>
                  {/* THE BIRTH'S HALO (R135 style pass): a faint solid
                      ring beneath the dashed one — the birth readable
                      at a glance, the dash kept for the honesty. */}
                  <circle
                    cx={cx}
                    cy={y}
                    r={6.8}
                    fill="none"
                    stroke={fill}
                    strokeWidth={1.4}
                    opacity={0.16}
                    pointerEvents="none"
                    data-testid="board-ledger-firstword-halo"
                  />
                  <circle
                    cx={cx}
                    cy={y}
                    r={5.6}
                    fill="none"
                    stroke={fill}
                    strokeWidth={0.9}
                    strokeDasharray="1.8 1.3"
                    opacity={0.9}
                    pointerEvents="none"
                    data-testid="board-ledger-firstword-ring"
                  />
                </>
              )}
            </g>
          );
        })}
        {litDrawable && (
          <g data-testid="board-ledger-lithalos">
            {litGroups.flatMap((g, gi) =>
              g.seats.map((lx, i) => (
                <g key={`lit-halo-${gi}-${i}`} pointerEvents="none">
                  {/* the soft under-glow — the light readable at a glance */}
                  <circle
                    cx={lx}
                    cy={y}
                    r={6.6}
                    fill="none"
                    stroke={g.color}
                    strokeWidth={1.6}
                    opacity={0.18}
                  />
                  {/* the holder's own ring — solid, the birth ring's dashed kept apart */}
                  <circle
                    cx={lx}
                    cy={y}
                    r={5}
                    fill="none"
                    stroke={g.color}
                    strokeWidth={1.1}
                    opacity={0.9}
                  />
                </g>
              )),
            )}
          </g>
        )}
        {marks.map((m) => {
          const cx = seatOf.get(`${m.flip.id}|${m.flip.at}`);
          if (cx === undefined) return null;
          return (
            <g key={`kill-${m.flip.id}-${m.flip.at}`} data-testid="board-ledger-killmark">
              <line
                x1={cx}
                y1={y - 10}
                x2={cx}
                y2={y + 10}
                stroke="#e5484d"
                strokeWidth={1.4}
                opacity={0.9}
                className="drop-shadow-[0_0_2px_rgba(229,72,77,0.7)]"
              />
              <path
                d={`M ${cx - 2.4} ${y - 12} L ${cx + 2.4} ${y - 12} L ${cx} ${y - 8.4} Z`}
                fill="#e5484d"
                opacity={0.95}
              >
                <title>{`KILL MARK — the tenure dial reset: ${m.flip.from} → ${m.flip.to} @ ${stampOf(m.flip.at)} UTC. The board's own shadow of a kill: the newest death's age collapsed from ${m.fromMin}′ under a minute. The ledger reads the board's words; the record holds the deaths — this mark is the shadow, never the confirmation.`}</title>
              </path>
            </g>
          );
        })}
      </svg>
      {births.length > 0 && (
        <p
          className="vvu-label text-[5.5px] text-[#a78bfa]/85 cursor-help"
          title="THE FIRST WORD (R133): each ring is a row's first flip WITHIN THE OPEN DEPTH — the tail heard the row begin. Depth-relative by definition: a row whose motion began before the tail's reach was born deeper (the depth chips are the reach). Word- and tone-flips alike are hearings; the ring's color is the birth's own landing tone."
          data-testid="board-ledger-firstword-caption"
        >
          ○ {births.length} FIRST WORD{births.length === 1 ? "" : "S"} — each ring is a row's first
          flip within the open depth ({depth} moved samples); a birth older than the tail&apos;s
          reach sits deeper — the depth chips are the reach
        </p>
      )}
      {marks.length > 0 && (
        <p
          className="vvu-label text-[5.5px] text-[#e5484d]/90"
          data-testid="board-ledger-killmark-caption"
        >
          ▼ {marks.length} KILL MARK{marks.length === 1 ? "" : "S"} — the tenure dial&apos;s resets
          (a standing age collapsing under a minute): the ledger&apos;s own shadow of the
          record&apos;s kills, read from the board&apos;s words alone
        </p>
      )}
      {ensembles.length > 0 && (
        <p
          className="vvu-label text-[5.5px] text-[#e0a030]/85 cursor-help"
          title="THE COMPANY (R136): each shaded band is a stamp where ≥2 rows moved together — the board seen moved once with several words changed. The band's tooltip names the rows; the pair census rides the COMPANY strip below the read. Grouping is the stamp's own string — the one clock-free read."
          data-testid="board-ledger-ensemble-caption"
        >
          ⌁ {ensembles.length} ENSEMBLE{ensembles.length === 1 ? "" : "S"} — shaded bands mark the
          stamps where ≥2 rows moved together (the board seen moved once with several words changed)
        </p>
      )}
      {bandDrawable && (
        <p
          className="vvu-label text-[5.5px] text-[#00d4e0]/80"
          data-testid="board-ledger-quietband-caption"
        >
          ⌇ THE LONGEST QUIET — {band!.gap.min.toFixed(1)}′, opened by {band!.gap.fromFlip.name},
          ended by {band!.gap.toFlip.name} @ {stampOf(band!.gap.toFlip.at)} UTC
          {gaps.broken > 0
            ? ` · ${gaps.broken} chain${gaps.broken === 1 ? "" : "s"} broken by an unreadable stamp, said not bridged`
            : ""}
        </p>
      )}
      {litDrawable && (
        <p
          className="vvu-label text-[5.5px] text-[#00d4e0]/90"
          data-testid="board-ledger-lit-caption"
          style={
            lit!.kind === "handoff"
              ? { color: "rgba(224,160,48,0.9)" }
              : lit!.kind === "twofaces"
                ? { color: "rgba(208,128,128,0.95)" }
                : lit!.kind === "delivery" || lit!.kind === "turnaround"
                  ? { color: "rgba(184,168,216,0.95)" }
                  : lit!.kind === "below"
                    ? { color: "rgba(122,200,208,0.95)" }
                    : lit!.kind === "kept"
                      ? { color: "rgba(122,200,208,0.95)" }
                      : undefined
          }
        >
          {lit!.kind === "relay"
            ? `⌁ THE RELAY LIT — ${allLitSeats.length} flip${allLitSeats.length === 1 ? "" : "s"} of the longest run carry the halo (the RELAY badge held); release the badge and the light goes out`
            : lit!.kind === "handoff"
              ? `⌁ THE EDGE LIT — ${lit!.label}: ${allLitSeats.length} seat${allLitSeats.length === 1 ? "" : "s"} of the passage${allLitSeats.length === 1 ? "" : "s"} carry the halo (the pair chip held); release and the light goes out`
              : lit!.kind === "quiet"
                ? `⌁ THE SILENCE'S EDGE LIT — ${lit!.label}: ${allLitSeats.length} seat${allLitSeats.length === 1 ? "" : "s"} the quiet hung on carry the halo (the pair chip held); release and the light goes out`
                : lit!.kind === "delivery"
                  ? `⌁ THE DELIVERY LIT — ${lit!.label}: ${litGroups[0]!.seats.length} deliverer seat${litGroups[0]!.seats.length === 1 ? "" : "s"} carry the amber, ${litGroups[1]?.seats.length ?? 0} changed-mind seat${(litGroups[1]?.seats.length ?? 0) === 1 ? "" : "s"} the violet (the delivery chip held); release and the light goes out`
                  : lit!.kind === "turnaround"
                    ? `⌁ THE VIOLET FACE — ${lit!.label}: ${litGroups[0]!.seats.length} changed-mind seat${litGroups[0]!.seats.length === 1 ? "" : "s"} carry the violet${litGroups[1] ? `, ${litGroups[1].seats.length} below-quiet seat${litGroups[1].seats.length === 1 ? "" : "s"} the teal — the silence the row keeps under the rungs rides with its minds` : ""} (the row's chip held); release and the light goes out`
                    : lit!.kind === "turnover"
                      ? `⌁ THE TURNOVER LIT — ${lit!.label}: ${litGroups[0]!.seats.length} below-quiet seat${litGroups[0]!.seats.length === 1 ? "" : "s"} the row's changed minds ended carry the teal, ${litGroups[1]?.seats.length ?? 0} changed-mind seat${(litGroups[1]?.seats.length ?? 0) === 1 ? "" : "s"} the violet (the turnover chip held); release and the light goes out`
                      : lit!.kind === "below"
                        ? `⌁ THE BELOW LIT — ${lit!.label}: ${litGroups[0]!.seats.length} seat${litGroups[0]!.seats.length === 1 ? "" : "s"} of the unnamed silence carry the halo in teal${litGroups[1] ? `, ${litGroups[1].seats.length} changed-mind seat${litGroups[1].seats.length === 1 ? "" : "s"} among them the violet — the silence a taken-back word ended` : ""} (the below chip held); release and the light goes out`
                        : lit!.kind === "kept"
                          ? `⌁ THE KEPT LIGHT — ${lit!.label}: ${litGroups[0]!.seats.length} self-kept seat${litGroups[0]!.seats.length === 1 ? "" : "s"} carry the teal, ${litGroups[1]?.seats.length ?? 0} kept-ender seat${(litGroups[1]?.seats.length ?? 0) === 1 ? "" : "s"} the violet (the kept row's chip held); release and the light goes out`
                          : `⌁ ${litGroups[2] ? "THE THREE FACES" : "THE TWO FACES"} — ${lit!.label}: ${litGroups[0]!.seats.length} changed-mind seat${litGroups[0]!.seats.length === 1 ? "" : "s"} carry the violet, ${litGroups[1]?.seats.length ?? 0} quiet-frame seat${(litGroups[1]?.seats.length ?? 0) === 1 ? "" : "s"} the cyan${litGroups[2] ? `, ${litGroups[2].seats.length} below-quiet seat${litGroups[2].seats.length === 1 ? "" : "s"} the teal — the silence under the rungs rides with its minds` : ""}; release and the light goes out`}
        </p>
      )}
      {skipped > 0 && (
        <p className="vvu-label text-[5.5px] text-[#7a8a6e]">
          {skipped} flip{skipped === 1 ? "" : "s"} skipped — unreadable stamp
          {skipped === 1 ? "" : "s"}, said not seated
        </p>
      )}
    </div>
  );
}

function HotSpark({ series }: { series: Array<{ at: string; hotCount: number }> }) {
  const W = 560;
  const H = 26;
  const padB = 3;
  const n = series.length;
  const slot = n > 0 ? W / n : W;
  const max = Math.max(1, ...series.map((s) => s.hotCount));
  const barW = Math.max(1, Math.min(10, slot - 1));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto [&_rect]:cursor-help [&_rect]:transition-[filter] [&_rect:hover]:brightness-150"
      role="img"
      aria-label="hot-count sparkline — the live-tension count across the ledger's moved samples"
      data-testid="board-ledger-hotspark"
    >
      {series.map((s, i) => {
        const h = Math.max(1, (s.hotCount / max) * (H - padB - 1));
        return (
          <rect
            key={s.at}
            x={i * slot}
            y={H - padB - h}
            width={barW}
            height={h}
            fill={s.hotCount > 0 ? "#e0a030" : "#3a4530"}
            opacity={s.hotCount > 0 ? 0.8 : 0.6}
          >
            <title>{`${s.hotCount} live tension${s.hotCount === 1 ? "" : "s"} @ ${stampOf(s.at)} UTC`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
