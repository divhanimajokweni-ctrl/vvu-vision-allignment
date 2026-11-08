// src/lib/watchboard-ledger.ts — R128 · THE BOARD'S OWN LEDGER.
//
// The watchboard (R125) compiles the standing watches into eleven rows,
// each a live status word. The board shows the record's PRESENT — but a
// board that only ever shows the present cannot show the present's own
// MOTION: the compress streak climbing, the drift deepening, the walk's
// holds spending, the tenure dial crossing. This engine is the board's
// memory: samples of the compiled board, kept only when a word (or a
// tone) MOVED, and the flips derived between consecutive moved samples.
//
// THE HONESTY RULES:
//   - The ledger reads the BOARD, never the record. It adds no read, no
//     calibration, no arithmetic of its own — a flip entry is two board
//     words and the stamps the board itself printed. Where the board's
//     row says HOLDS 1 and later reads PORT MONOPOLY, the ledger says
//     exactly that, dated by the board's own build stamp.
//   - A sample whose signature equals the newest stored one is REFUSED
//     (shouldRecordSnapshot): the ledger records the words' motion, not
//     the reader's cadence. Ten reads with an unmoved board store zero.
//   - A flip is a WORD change (kind 'word') or — rarer, still honest —
//     a TONE-only change on a stable word (kind 'tone': the same word
//     riding a different severity). Both are the board moving.
//   - The composition stays pure: no clocks, no I/O, no globals. The
//     route owns the store, the client owns the sampling cadence.

export interface WatchboardSnapshotRow {
  id: string;
  name: string;
  word: string;
  tone: string;
}

export interface WatchboardSnapshot {
  builtAt: string; // the sampled board's own build stamp (ISO)
  signature: string;
  hotCount: number;
  rows: WatchboardSnapshotRow[];
}

export interface BoardFlip {
  id: string;
  name: string;
  kind: 'word' | 'tone';
  from: string;
  to: string;
  fromTone: string;
  toTone: string;
  at: string; // the NEW sample's build stamp — when the board was seen moved
}

export interface LedgerSummary {
  samples: number; // snapshots in the ledger tail (the MOVED ones)
  readsRefused: number | null; // refused same-signature samples, when known
  flips: BoardFlip[]; // chronological, oldest first
  hotSeries: Array<{ at: string; hotCount: number }>; // oldest first
  spanMin: number | null; // newest − oldest sample stamp, minutes
  distinctRows: number; // rows that moved at least once
  busiest: { id: string; name: string; count: number } | null; // most-flipped row
}

/** LEDGER_KEEP — the store's prune bound: the newest 200 MOVED samples.
 *  A flip ledger older than two hundred moves is history the rounds
 *  already narrate; the store stays small, the tail stays honest. */
export const LEDGER_KEEP = 200;

/** LEDGER_TAIL — how much of the ledger the lane renders from. */
export const LEDGER_TAIL = 24;

/**
 * boardSignature — the board's words, in READING ORDER, hashed.
 * Order-sensitive by design: the board's reading order is canonical, and
 * a reorder is the board moving. Tones ride the signature (a tone-only
 * move must refuse the same-signature sample). FNV-1a 32-bit — small,
 * deterministic, collision-safe for a 11-row board's purposes.
 */
export function boardSignature(rows: WatchboardSnapshotRow[]): string {
  const text = rows.map((r) => `${r.id}=${r.word}|${r.tone}`).join(';');
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * shouldRecordSnapshot — the dedupe contract: a sample is recorded iff
 * its signature differs from the newest stored one (and there is no
 * stored sample yet, of course). Equality with anything OLDER than the
 * newest is irrelevant — the ledger is the words' motion between
 * consecutive moved boards, not a distinct-signatures census.
 */
export function shouldRecordSnapshot(
  last: Pick<WatchboardSnapshot, 'signature'> | null,
  next: Pick<WatchboardSnapshot, 'signature'>,
): boolean {
  return last === null || last.signature !== next.signature;
}

/**
 * deriveFlips — the board's motion between two consecutive MOVED
 * samples, in the board's own reading order. A row present in one side
 * only (the board grew or shrank a row) is a flip of kind 'word' with
 * the missing side rendered as '(absent)' — the structure's motion is
 * the board's motion too.
 */
export function deriveFlips(
  prev: WatchboardSnapshot,
  next: WatchboardSnapshot,
): BoardFlip[] {
  const flips: BoardFlip[] = [];
  const prevById = new Map(prev.rows.map((r) => [r.id, r]));
  const nextById = new Map(next.rows.map((r) => [r.id, r]));
  const order: string[] = [];
  for (const r of next.rows) if (!order.includes(r.id)) order.push(r.id);
  for (const r of prev.rows) if (!order.includes(r.id)) order.push(r.id);

  for (const id of order) {
    const p = prevById.get(id);
    const n = nextById.get(id);
    if (!p && n) {
      flips.push({ id, name: n.name, kind: 'word', from: '(absent)', to: n.word, fromTone: 'neutral', toTone: n.tone, at: next.builtAt });
      continue;
    }
    if (p && !n) {
      flips.push({ id, name: p.name, kind: 'word', from: p.word, to: '(absent)', fromTone: p.tone, toTone: 'neutral', at: next.builtAt });
      continue;
    }
    if (!p || !n) continue;
    if (p.word !== n.word) {
      flips.push({ id, name: n.name, kind: 'word', from: p.word, to: n.word, fromTone: p.tone, toTone: n.tone, at: next.builtAt });
    } else if (p.tone !== n.tone) {
      flips.push({ id, name: n.name, kind: 'tone', from: n.word, to: n.word, fromTone: p.tone, toTone: n.tone, at: next.builtAt });
    }
  }
  return flips;
}

/**
 * summarizeLedger — the tail's own story, oldest first. The flips come
 * from consecutive pairs; the hot series is every moved sample's
 * hotCount; the busiest row is the flip census's leader (ties break to
 * the earlier row in reading order). A single-sample ledger has motion
 * recorded but no flips derivable — flips [] is the honest empty, and
 * the lane says the ledger waits for its next move.
 */
export function summarizeLedger(
  snapshots: WatchboardSnapshot[],
  opts: { readsRefused?: number } = {},
): LedgerSummary {
  const ordered = [...snapshots].sort((a, b) => a.builtAt.localeCompare(b.builtAt));
  const flips: BoardFlip[] = [];
  for (let i = 1; i < ordered.length; i++) {
    flips.push(...deriveFlips(ordered[i - 1]!, ordered[i]!));
  }

  const census = new Map<string, { name: string; count: number }>();
  for (const f of flips) {
    const cur = census.get(f.id);
    if (cur) cur.count += 1;
    else census.set(f.id, { name: f.name, count: 1 });
  }
  let busiest: LedgerSummary['busiest'] = null;
  for (const [id, { name, count }] of census) {
    if (!busiest || count > busiest.count) busiest = { id, name, count };
  }

  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  let spanMin: number | null = null;
  if (ordered.length >= 2 && first && last) {
    const a = Date.parse(first.builtAt);
    const b = Date.parse(last.builtAt);
    if (Number.isFinite(a) && Number.isFinite(b)) spanMin = (b - a) / 60_000;
  }

  return {
    samples: ordered.length,
    readsRefused: opts.readsRefused ?? null,
    flips,
    hotSeries: ordered.map((s) => ({ at: s.builtAt, hotCount: s.hotCount })),
    spanMin,
    distinctRows: census.size,
    busiest,
  };
}

// — R129 · THE LEDGER'S OWN READ — the ledger's story, spoken honestly.
//
// The lane renders the flips and the spark; a human reads the motion out
// of them. This engine IS that reading, made explicit and pinned: the
// motion rate (flips per hour over the tail's span), the hot-count's
// direction (the first-half median against the second-half median — the
// storm-history convention, one calibration shared), and the motion's
// concentration (the busiest row's share of the flips). Every word names
// its own band or line in the caption; the read refuses honestly when
// the tail is too thin (one sample has no span, no direction, no census).
//
// THE HONESTY RULES:
//   - The read derives from the SUMMARY ONLY — no clocks, no store, no
//     re-derivation of the flips. Whatever the sampler said, the read
//     says; it is the narrative of the numbers already on the lane.
//   - A thin tail renders refusals as words (NO SPAN / NO TREND), never
//     guesses. One sample is a point, not a motion.
//   - The bands are the read's own calibration and are SAID in the lane's
//     caption (quiet ≤2 · moving ≤8 · churning ≤20 · storming >20 flips
//     per hour, inclusive edges at the named bound). They measure the
//     BOARD's words, never the record's kills — a churning board is a
//     restless mirror, not a storm report.
//   - The direction band is exclusive past ±10% (a full ten-percent move
//     is a move) — the drift row's own convention, reused.

export type LedgerMotionWord = 'QUIET' | 'MOVING' | 'CHURNING' | 'STORMING' | 'NO SPAN';
export type LedgerDirectionWord = 'HEATING' | 'COOLING' | 'LEVEL' | 'NO TREND';

export interface LedgerConcentration {
  id: string;
  name: string;
  count: number;
  share: number; // busiest flips / all flips, 0..1
}

export interface LedgerMotionRead {
  motionWord: LedgerMotionWord;
  motionRatePerHour: number | null; // flips / span hours; null when no span
  directionWord: LedgerDirectionWord;
  firstHalfMedianHot: number | null;
  secondHalfMedianHot: number | null;
  concentration: LedgerConcentration | null; // null when no flips
  concentrationWord: 'CONCENTRATED' | 'SPREAD' | 'NO FLIPS';
  spanWord: LedgerSpanWord; // the hour hand (R131): the scale the tail has reached
  paceWord: LedgerPaceWord; // the quiet hand (R132): the gaps' median's own word
  medianGapMin: number | null; // the gaps' median, minutes; null when no gaps
  longestQuiet: { min: number; endedBy: string; endedAt: string } | null; // the FIRST longest
  lines: string[]; // the narrative, 2–5 lines, each saying its own numbers
}

/** LEDGER_MOTION_BANDS — the read's own calibration, exported so the
 *  lane's caption and the tests quote the SAME numbers (one calibration,
 *  many readers). Upper bounds inclusive: a rate exactly at the bound
 *  reads the lower word (a full pass of the band is a pass). */
export const LEDGER_MOTION_BANDS = {
  quiet: 2,
  moving: 8,
  churning: 20,
} as const;

/** LEDGER_DIRECTION_BAND — exclusive past ±10% (the drift row's band). */
export const LEDGER_DIRECTION_BAND = 0.1;

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * ledgerRead — the tail's story, from the summary alone.
 */
export function ledgerRead(summary: LedgerSummary): LedgerMotionRead {
  const flips = summary.flips;
  const spanMin = summary.spanMin;

  // — the motion word —
  let motionWord: LedgerMotionWord = 'NO SPAN';
  let motionRatePerHour: number | null = null;
  if (spanMin !== null && spanMin > 0) {
    motionRatePerHour = (flips.length / spanMin) * 60;
    motionWord =
      motionRatePerHour <= LEDGER_MOTION_BANDS.quiet
        ? 'QUIET'
        : motionRatePerHour <= LEDGER_MOTION_BANDS.moving
          ? 'MOVING'
          : motionRatePerHour <= LEDGER_MOTION_BANDS.churning
            ? 'CHURNING'
            : 'STORMING';
  }

  // — the direction (first-half vs second-half medians of the hot series) —
  let directionWord: LedgerDirectionWord = 'NO TREND';
  let firstHalfMedianHot: number | null = null;
  let secondHalfMedianHot: number | null = null;
  const series = summary.hotSeries.map((h) => h.hotCount);
  if (series.length >= 2) {
    const half = Math.floor(series.length / 2);
    const firstHalf = series.slice(0, half);
    const secondHalf = series.slice(series.length % 2 === 0 ? half : half + 1);
    firstHalfMedianHot = median(firstHalf);
    secondHalfMedianHot = median(secondHalf);
    if (firstHalfMedianHot !== null && secondHalfMedianHot !== null && firstHalfMedianHot > 0) {
      const move = (secondHalfMedianHot - firstHalfMedianHot) / firstHalfMedianHot;
      directionWord =
        move > LEDGER_DIRECTION_BAND ? 'HEATING' : move < -LEDGER_DIRECTION_BAND ? 'COOLING' : 'LEVEL';
    } else if (firstHalfMedianHot === 0 && secondHalfMedianHot !== null && secondHalfMedianHot > 0) {
      directionWord = 'HEATING'; // from zero the only honest motion is up
    } else if (firstHalfMedianHot === 0 && secondHalfMedianHot === 0) {
      directionWord = 'LEVEL';
    }
  }

  // — the concentration —
  let concentration: LedgerConcentration | null = null;
  let concentrationWord: LedgerMotionRead['concentrationWord'] = 'NO FLIPS';
  if (flips.length > 0 && summary.busiest) {
    const share = summary.busiest.count / flips.length;
    concentration = {
      id: summary.busiest.id,
      name: summary.busiest.name,
      count: summary.busiest.count,
      share,
    };
    concentrationWord = share >= 0.5 ? 'CONCENTRATED' : 'SPREAD';
  }

  // — the hour hand (R131): the scale the tail has reached —
  const spanWord = spanWordOf(spanMin);

  // — the quiet hand (R132): the gaps' median and the longest quiet —
  const gaps = gapsOf(flips);
  let longestQuiet: LedgerMotionRead['longestQuiet'] = null;
  if (gaps.longest) {
    const at = gaps.longest.toFlip.at;
    longestQuiet = {
      min: gaps.longest.min,
      endedBy: gaps.longest.toFlip.name,
      endedAt: at.includes('T') ? at.slice(11, 19) : at, // the board's own stamp, time-slice
    };
  }

  // — the lines (each says its own numbers) —
  const lines: string[] = [];
  if (motionWord === 'NO SPAN') {
    lines.push(
      summary.samples <= 1
        ? `the tail holds ${summary.samples} sample — a point, not a motion; the read refuses the rate`
        : `the tail's stamps do not parse — the read refuses the rate`,
    );
  } else {
    lines.push(
      `the board moved ${flips.length} time${flips.length === 1 ? '' : 's'} in ${spanMin!.toFixed(1)}′ — ${motionRatePerHour!.toFixed(1)} flips/hour — ${motionWord} (bands: quiet ≤${LEDGER_MOTION_BANDS.quiet} · moving ≤${LEDGER_MOTION_BANDS.moving} · churning ≤${LEDGER_MOTION_BANDS.churning} · storming above)`,
    );
  }
  if (spanWord !== 'NO SPAN') {
    lines.push(
      `the tail spans ${spanMin!.toFixed(1)}′ — ${spanWord} (scales: minute <${LEDGER_SPAN_BANDS.minute}′ · quarter <${LEDGER_SPAN_BANDS.quarter}′ · half-hour <${LEDGER_SPAN_BANDS.halfHour}′ · hour-scale at or past ${LEDGER_SPAN_BANDS.halfHour}′ — the bound begins the scale)`,
    );
  }
  if (directionWord === 'NO TREND') {
    lines.push(`the live-tension count reads no trend from ${series.length} sample${series.length === 1 ? '' : 's'} — a trend needs two`);
  } else {
    lines.push(
      `the live-tension count reads ${directionWord}: first-half median ${firstHalfMedianHot} vs second-half ${secondHalfMedianHot} (a full ±10% move is a move)`,
    );
  }
  if (concentrationWord === 'NO FLIPS') {
    lines.push(`no flips in the tail — motion's census waits for the words to move`);
  } else {
    lines.push(
      `motion ${concentrationWord === 'CONCENTRATED' ? 'concentrates in' : 'is spread, its centre'} ${concentration!.name} — ${concentration!.count} of ${flips.length} flip${flips.length === 1 ? '' : 's'} (${(concentration!.share * 100).toFixed(0)}%)`,
    );
  }
  // — the pace line (R132): the gaps breathe, the longest quiet named —
  if (flips.length < 2) {
    lines.push(`the tail holds no gap to breathe — the pace waits for a second flip`);
  } else if (gaps.gaps.length === 0) {
    lines.push(
      gaps.broken > 0
        ? `the stamps do not parse — the pace refuses the gaps (${gaps.broken} chain${gaps.broken === 1 ? '' : 's'} broken, said not bridged)`
        : `no honest gap between the tail's flips — the pace refuses`,
    );
  } else {
    lines.push(
      `the gaps breathe at a ${gaps.medianGapMin!.toFixed(1)}′ median — ${gaps.paceWord} (bands: staccato ≤${LEDGER_PACE_BANDS.staccato}′ · brisk ≤${LEDGER_PACE_BANDS.brisk}′ · steady ≤${LEDGER_PACE_BANDS.steady}′ · sparse above); the longest quiet stretched ${gaps.longest!.min.toFixed(1)}′, ended by ${gaps.longest!.toFlip.name} @ ${longestQuiet!.endedAt} UTC`,
    );
  }

  return {
    motionWord,
    motionRatePerHour,
    directionWord,
    firstHalfMedianHot,
    secondHalfMedianHot,
    concentration,
    concentrationWord,
    spanWord,
    paceWord: gaps.paceWord,
    medianGapMin: gaps.medianGapMin,
    longestQuiet,
    lines,
  };
}

// — R130 · THE ROW'S MOTION LINE — a filtered row's flips, drawn.
//
// The lane already reads the tail three ways (the chip list, the counts,
// the spark). A FILTERED row earns a fourth: its flips as a timeline —
// one dot per flip, seated by its stamp between the tail's first and
// last stamp, colored by the flip's LANDING tone. The eye then reads
// what the census counts: a row whose motion clusters (the tenure dial's
// clock churn) reads dense; a row that moved once reads a lone dot. The
// geometry is pure and pinned here; the lane owns the drawing.
//
// THE HONESTY RULES:
//   - The line derives from the flips ALONE — its bounds are the TAIL's
//     own first and last stamps (not the wall clock), so the drawing
//     re-derives byte-identically from any stored tail.
//   - A single flip has no interval: its dot seats at the CENTER (0.5)
//     and the line says so — a lone dot is a point, drawn, never stretched.
//   - Dots carry their flip's own stamp and words in the lane's tooltips;
//     the geometry adds nothing but the seat.

// — R131 · THE HOUR HAND — the read speaks its own SCALE.
//
// The depth lanes (R130) made the store's whole history reachable, and
// the tail now outgrows a round: a span of minutes is a churn watch, a
// span of hours is an era witness. The read's rate (flips/hour) already
// divides by the span — but never said WHAT SPAN it stood on. The hour
// hand is that word: the tail names its own scale, and the reader knows
// whether "35.7 flips/hour" is one restless hour or a whole afternoon's
// rhythm. The bands are the read's own calibration, SAID in the line:
// a tail under 15′ reads MINUTE-SCALE; at 15′ the QUARTER scale begins;
// at 30′ the HALF-HOUR; at or past 60′ the tail is HOUR-SCALE — the
// bound names the scale that BEGINS there (a full pass of the lower
// scale is a pass, the motion bands' own inclusive convention).
//
// — R131 · KILL MARKS — the ledger's own shadow of the record's kills.
//
// The tenure dial is the board's clock of the newest death's age. When
// a kill lands, the age collapses: the dial's word falls from a minute
// count (RESTING/PAST/LATE, ≥ 1′) to under one minute (RESTING 0.x′).
// That collapse is VISIBLE in the flips — and only there. killMarks()
// reads exactly that shape: a tenure-dial WORD flip whose landing is
// under a minute while its starting word stood at a minute or more.
// The honesty rules:
//   - A mark is the BOARD's reset shadow, never the record's kill
//     confirmation — the ledger measures the board's words; the record
//     holds the deaths. The lane's caption says so.
//   - The read (ledgerRead) NEVER counts kills — the R128 rule stands:
//     the read measures the board, the marks are the motion line's own
//     layer, beside the dots, not inside the narrative.
//   - Unreadable words (from or to) are SKIPPED — never a mark at an
//     invented minute. A tone-only flip is not a reset (the word must
//     move). '(absent)' is not a minute. The landing is strictly under
//     1.0 (a full minute is not under it); the start is 1.0 or more
//     (the dial stood the fresh birth's first minute).

export type LedgerSpanWord =
  | 'MINUTE-SCALE'
  | 'QUARTER-SCALE'
  | 'HALF-HOUR-SCALE'
  | 'HOUR-SCALE'
  | 'NO SPAN';

/** LEDGER_SPAN_BANDS — the hour hand's calibration, exported so the
 *  lane's badge, the read's line and the tests quote the SAME numbers.
 *  A span exactly at a bound reads the HIGHER scale (the bound begins
 *  the scale): 15′ is quarter, 30′ is half-hour, 60′ is hour. */
export const LEDGER_SPAN_BANDS = {
  minute: 15,
  quarter: 30,
  halfHour: 60,
} as const;

/** spanWordOf — the tail's scale, from the span alone. */
export function spanWordOf(spanMin: number | null): LedgerSpanWord {
  if (spanMin === null || !Number.isFinite(spanMin) || spanMin <= 0) return 'NO SPAN';
  if (spanMin < LEDGER_SPAN_BANDS.minute) return 'MINUTE-SCALE';
  if (spanMin < LEDGER_SPAN_BANDS.quarter) return 'QUARTER-SCALE';
  if (spanMin < LEDGER_SPAN_BANDS.halfHour) return 'HALF-HOUR-SCALE';
  return 'HOUR-SCALE';
}

export interface KillMark {
  flip: BoardFlip; // the reset flip itself (id, words, stamp ride)
  fromMin: number; // the dial's standing age before the collapse (≥ 1)
  toMin: number; // the landing age, strictly under 1
}

/** tenureMinutes — the minute count a dial word stands at, or null when
 *  the word carries no trailing minute token ("RESTING 7.4′" → 7.4,
 *  "LATE 8′" → 8; "(absent)", "ETA ~93 MIN", "RESTING ~2′" → null — the
 *  number must be the dial's OWN printed arithmetic, whitespace-led;
 *  a tilde is a different word's shorthand, not the dial's minute). */
export function tenureMinutes(word: string): number | null {
  const m = /(?:^|\s)([0-9]+(?:\.[0-9]+)?)′\s*$/.exec(word.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** killMarks — the dial's resets, in input order. A mark is a
 *  tenure-dial WORD flip landing strictly under one minute from a
 *  standing age of a minute or more. */
export function killMarks(flips: BoardFlip[]): KillMark[] {
  const marks: KillMark[] = [];
  for (const f of flips) {
    if (f.id !== 'tenure-dial' || f.kind !== 'word') continue;
    const from = tenureMinutes(f.from);
    const to = tenureMinutes(f.to);
    if (from === null || to === null) continue;
    if (to < 1 && from >= 1) marks.push({ flip: f, fromMin: from, toMin: to });
  }
  return marks;
}

export interface MotionLinePoint {
  flip: BoardFlip;
  x: number; // 0..1, seated by stamp between the tail's bounds (0.5 when lone)
  landingTone: string;
}

// — R132 · THE QUIET HAND — the ledger's own PACE, and the board's
// SILENCE, named.
//
// The read already says how FAST the board's words moved (flips/hour
// over the span) — but a rate is an average over the whole tail, and a
// tail that stormed early can sit perfectly quiet late. The pace is the
// gaps' own word: the intervals between CONSECUTIVE flips, their median,
// and the LONGEST QUIET — the stretch the board held its tongue, and
// the row that ended it. Where the motion word reads the tail's average
// breath, the pace word reads the breaths themselves.
//
// THE HONESTY RULES:
//   - The pace derives from the flips' stamps ALONE — no clocks, no
//     store. A gap is the interval between two CONSECUTIVE seated flips;
//     an unreadable stamp between them BREAKS THE CHAIN (a gap across an
//     unknown digest would be an invented quiet) — the break is counted
//     and SAID, never bridged.
//   - The bands are inclusive at every named bound (the motion bands'
//     own convention): a median exactly at the bound reads the lower
//     word. A full pass of the band is a pass.
//   - The longest quiet's tie rule: the FIRST longest wins (input order)
//     — said here once, pinned by test, so the lane never has to guess.
//   - THE MIRROR RULE HOLDS: the pace line names the ROW that ended a
//     quiet, never the EVENT. When the longest quiet ends on a tenure-
//     dial reset, the line still says the dial's name and no word of it
//     says KILL — the read measures the board; the record holds the
//     deaths (the R128 rule, now pinned on the pace line too).
//
// — R132 · THE STILL CENSUS — the board's silence, named.
//
// The ledger records the rows that MOVED; the board carries eleven.
// The difference is the silence: rows whose words have not moved within
// the open depth — the quiet hour that has yet to move once, the
// leadership that never ceded. stillCensus() reads that difference from
// the board's rows and the tail's flips: board reading order preserved,
// a row that moved even once excluded. The DEPTH-RELATIVITY is the
// lane's caption's job (a row still in the 24-tail may have moved
// deeper — the depth chips are the reach); the engine only ever says
// which rows the OPEN TAIL did not hear.

export type LedgerPaceWord = 'STACCATO' | 'BRISK' | 'STEADY' | 'SPARSE' | 'NO GAPS';

/** LEDGER_PACE_BANDS — the quiet hand's calibration, exported so the
 *  lane's caption and the tests quote the SAME numbers. Upper bounds
 *  inclusive: a median exactly at the bound reads the lower word. */
export const LEDGER_PACE_BANDS = {
  staccato: 2,
  brisk: 6,
  steady: 12,
} as const;

export interface LedgerGap {
  fromFlip: BoardFlip; // the flip that OPENED the quiet (the gap runs after it)
  toFlip: BoardFlip; // the flip that ENDED the quiet
  min: number; // the quiet's length, minutes
}

export interface LedgerGaps {
  gaps: LedgerGap[]; // chronological, input order
  broken: number; // chains an unreadable stamp broke (gaps NOT computed across them)
  medianGapMin: number | null;
  longest: LedgerGap | null; // the FIRST longest, input order
  paceWord: LedgerPaceWord;
}

/** paceWordOf — the median gap's own word, bands inclusive. */
export function paceWordOf(medianGapMin: number | null): LedgerPaceWord {
  if (medianGapMin === null || !Number.isFinite(medianGapMin) || medianGapMin < 0) return 'NO GAPS';
  if (medianGapMin <= LEDGER_PACE_BANDS.staccato) return 'STACCATO';
  if (medianGapMin <= LEDGER_PACE_BANDS.brisk) return 'BRISK';
  if (medianGapMin <= LEDGER_PACE_BANDS.steady) return 'STEADY';
  return 'SPARSE';
}

/** gapsOf — the tail's breaths: one gap per pair of CONSECUTIVE seated
 *  flips. An unreadable stamp breaks the chain — the gap across it is
 *  never computed (it would span an unknown digest), the break is said. */
export function gapsOf(flips: BoardFlip[]): LedgerGaps {
  const gaps: LedgerGap[] = [];
  let broken = 0;
  let prev: { flip: BoardFlip; t: number } | null = null;
  for (const f of flips) {
    const t = Date.parse(f.at);
    if (!Number.isFinite(t)) {
      if (prev !== null) broken += 1; // the chain was whole; now it is not
      prev = null;
      continue;
    }
    if (prev !== null) {
      const min = (t - prev.t) / 60000;
      if (min > 0) gaps.push({ fromFlip: prev.flip, toFlip: f, min });
    }
    prev = { flip: f, t };
  }
  const medianGapMin = median(gaps.map((g) => g.min));
  let longest: LedgerGap | null = null;
  for (const g of gaps) if (longest === null || g.min > longest.min) longest = g;
  return { gaps, broken, medianGapMin, longest, paceWord: paceWordOf(medianGapMin) };
}

export interface StillRow {
  id: string;
  name: string;
  word: string;
  tone: string;
}

/** stillCensus — the board's rows the open tail never heard move, in
 *  the board's own reading order. Depth-relative by construction: the
 *  caller owns which flips are "the open tail". */
export function stillCensus(rows: WatchboardSnapshotRow[], flips: BoardFlip[]): StillRow[] {
  const moved = new Set(flips.map((f) => f.id));
  return rows.filter((r) => !moved.has(r.id)).map((r) => ({ id: r.id, name: r.name, word: r.word, tone: r.tone }));
}

/**
 * motionLinePoints — the filtered flips, seated in tail-time. Input
 * order is preserved (newest-first as the lane stores it; the DRAWING
 * reads x, never order). Stamps that fail to parse seat at the bounds
 * honestly? No — they are SKIPPED, and the skip is the caller's to say:
 * a dot with an unreadable stamp would be a dot at a invented seat.
 */
export function motionLinePoints(flips: BoardFlip[]): {
  points: MotionLinePoint[];
  skipped: number;
} {
  if (flips.length === 0) return { points: [], skipped: 0 };
  const stamps = flips.map((f) => Date.parse(f.at));
  const usable = stamps.filter((t) => Number.isFinite(t));
  const skipped = stamps.length - usable.length;
  if (usable.length === 0) return { points: [], skipped };
  const min = Math.min(...usable);
  const max = Math.max(...usable);
  const span = max - min;
  const points: MotionLinePoint[] = [];
  flips.forEach((f, i) => {
    const t = stamps[i]!;
    if (!Number.isFinite(t)) return;
    points.push({
      flip: f,
      x: span === 0 ? 0.5 : (t - min) / span,
      landingTone: f.toTone,
    });
  });
  return { points, skipped };
}

// — R133 · THE SILENCE LADDER — the still census's own PAST.
//
// The still census (R132) names the rows the open tail never heard —
// but silence has a history too: a row went quiet WHEN its words last
// moved, and the store's deeper reaches know that stamp even when the
// open depth does not (a hearing inside the open tail would contradict
// the census — every heard still row's last flip necessarily sits
// deeper). silenceRead() reads the still rows' own past from the DEEP
// flips (the store's whole reach, the newest LEDGER_KEEP moved boards):
// each row's LAST hearing — its words, its landing tone, its stamp —
// and the quiet measured since, ruled against the store's own span.
// The depth-relative honesty becomes concrete: the ladder shows HOW
// deep a still row's silence actually runs.
//
// THE HONESTY RULES:
//   - The read derives from the passed arrays ALONE — no clocks, no
//     store, no re-derivation of flips. The quiet is measured to the
//     deep tail's NEWEST READABLE stamp (refStamp), never the wall
//     clock — the read re-derives byte-identically from any stored
//     tail, and the ladder's ruler is the store's own reach
//     (deepSpanMin), said in the lane's caption.
//   - deepFlips are CHRONOLOGICAL, oldest first (gapsOf's own
//     contract): a row's LAST hearing is its newest flip in that order
//     — the store's own truth of recency. The order is load-bearing
//     and pinned by test.
//   - A flip with an unreadable stamp is still a HEARING (the row
//     moved; the WHEN is what refuses): the entry keeps the flip and
//     seats no quiet (quietSinceMin null). A row the deep tail never
//     heard renders last: null — the STRONGEST silence, beyond the
//     store's whole reach, counted in `unheard`, said in the line, and
//     given NO bar in the lane (a bar needs a number; the store has
//     none).
//   - The census order is the board's reading order (stillCensus's own
//     contract) — the engine preserves it; the lane may LADDER it
//     (loudest first) as a display reading, said in the header.
//   - The line is the silence's own voice and names only ROWS and
//     STAMPS — the mirror rule (R128) holds here too: no word of it
//     says KILL, even when the row that holds the loudest silence last
//     moved on a tenure-dial reset.

export interface SilenceEntry {
  id: string;
  name: string;
  word: string; // the row's word as the census carried it
  tone: string;
  last: BoardFlip | null; // the row's newest hearing in the deep tail's own order
  quietSinceMin: number | null; // refStamp − last.at, minutes; null when either stamp refuses
}

export interface SilenceRead {
  entries: SilenceEntry[]; // the census's own order, preserved
  refStamp: string | null; // the deep tail's newest READABLE stamp — the quiet's reference
  deepSpanMin: number | null; // the deep tail's own span — the ladder's ruler
  unheard: number; // entries the store's whole reach never heard
  line: string; // the silence's own voice, self-quoting
}

/** silenceRead — the still rows' own past, from the deep flips alone. */
export function silenceRead(rows: WatchboardSnapshotRow[], deepFlips: BoardFlip[]): SilenceRead {
  // The reference: the deep tail's newest READABLE stamp, and its span.
  let refMs: number | null = null;
  let refStamp: string | null = null;
  let oldestMs: number | null = null;
  for (const f of deepFlips) {
    const t = Date.parse(f.at);
    if (!Number.isFinite(t)) continue;
    if (refMs === null || t > refMs) {
      refMs = t;
      refStamp = f.at;
    }
    if (oldestMs === null || t < oldestMs) oldestMs = t;
  }
  const deepSpanMin =
    refMs !== null && oldestMs !== null ? (refMs - oldestMs) / 60_000 : null;

  const entries: SilenceEntry[] = rows.map((r) => {
    let last: BoardFlip | null = null;
    for (const f of deepFlips) {
      if (f.id === r.id) last = f; // chronological input: the last seen is the newest
    }
    let quietSinceMin: number | null = null;
    if (last && refMs !== null) {
      const t = Date.parse(last.at);
      // A hearing stamped after the reference cannot be (the reference
      // IS the newest readable stamp) — the guard only refuses a
      // negative quiet, never invents a positive one.
      if (Number.isFinite(t) && t <= refMs) quietSinceMin = (refMs - t) / 60_000;
    }
    return { id: r.id, name: r.name, word: r.word, tone: r.tone, last, quietSinceMin };
  });
  const unheard = entries.filter((e) => e.last === null).length;

  // The line — the silence's own voice, every wording said up front.
  let line: string;
  if (rows.length === 0) {
    line = 'the board\'s every row moved within the open depth — the silence holds none';
  } else if (deepFlips.length === 0) {
    line = `the silence holds ${rows.length} row${rows.length === 1 ? '' : 's'} — the store holds no flip to read the silence against`;
  } else {
    const heard = entries.filter((e) => e.last !== null && e.quietSinceMin !== null);
    let loudest: SilenceEntry | null = null;
    for (const e of heard) {
      if (!loudest || (e.quietSinceMin ?? 0) > (loudest.quietSinceMin ?? 0)) loudest = e;
    }
    const unheardClause =
      unheard > 0
        ? `${unheard} row${unheard === 1 ? '' : 's'} the store's whole reach has never heard`
        : 'none beyond the store\'s reach';
    if (!loudest) {
      line = `the silence holds ${rows.length} row${rows.length === 1 ? '' : 's'} — ${unheardClause} (no readable quiet to rule)`;
    } else {
      const at = loudest.last!.at;
      const stamp = at.includes('T') ? at.slice(11, 19) : at;
      line = `the silence holds ${rows.length} row${rows.length === 1 ? '' : 's'} — its loudest ${loudest.name}, quiet ${loudest.quietSinceMin!.toFixed(1)}′ since ${loudest.last!.from} → ${loudest.last!.to} @ ${stamp} UTC; ${unheardClause}`;
    }
  }

  return { entries, refStamp, deepSpanMin, unheard, line };
}

// — R133 · THE FIRST WORD — motion's births within the open tail.
//
// The silence ladder reads the still rows' past; the MOVED rows have a
// past too: within the open tail, each row's motion BEGAN somewhere —
// its first flip. firstWords() reads those births from the tail's
// chronological flips alone: for every distinct row the tail heard,
// the first flip it heard (in the tail's own order), numbered by birth
// order. The lane draws each birth as a hollow ring around the dot
// that IS the birth — no new seats, no new geometry; the ring marks a
// flip already on the axis.
//
// THE HONESTY RULES:
//   - The births derive from the passed flips ALONE — no clocks, no
//     store, no re-seating. The caller owns the order contract: the
//     lane passes the CHRONOLOGICAL flips (gapsOf's own contract), so
//     ordinal 1 is the tail's first-born row and the order is
//     load-bearing — pinned by test.
//   - A birth is DEPTH-RELATIVE: a row whose motion began before the
//     tail's reach was born deeper — the ring says "first within the
//     open depth", never "first ever" (the lane's caption says the
//     depth chips are the reach).
//   - A birth is the row's first WORD-flip or TONE-flip alike — the
//     tail heard the row move; the kind is the flip's own.
//   - The mirror rule needs no line here: a birth names a ROW and a
//     flip, and so will the lane's caption — no word of it says KILL,
//     even when a row was born on a tenure-dial reset.

export interface FirstWord {
  flip: BoardFlip; // the row's first flip within the open tail
  ordinal: number; // 1-based birth order, chronological input
}

/** firstWords — the tail's births: each distinct row's first flip, in
 *  the order the tail first heard them. */
export function firstWords(flips: BoardFlip[]): FirstWord[] {
  const seen = new Set<string>();
  const births: FirstWord[] = [];
  for (const f of flips) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    births.push({ flip: f, ordinal: births.length + 1 });
  }
  return births;
}

// — R134 · THE BIRTH LADDER — the first words' ORDER as narrative.
//
// firstWords() names WHO began within the open tail; the handoff's
// next reading is the order itself: which row the tail heard FIRST,
// which LAST, and at what cadence the births arrived. birthLadder()
// composes on firstWords() (the pinned primitive — its order contract
// is load-bearing here too) and enriches each birth with the waits the
// tail itself stamps: the wait from the tail's first flip to this
// birth, and the gap since the previous birth.
//
// THE HONESTY RULES:
//   - Every number derives from the PASSED flips' own stamps — no
//     clocks, no store, no wall clock. The waits refuse (null) when a
//     needed stamp refuses; a refusal is said, never bridged.
//   - The waits are TAIL-RELATIVE: "into the tail" means from the
//     tail's own first flip, not from any depth boundary. The birth is
//     depth-relative (firstWords' own rule); the ladder inherits it
//     and the lane's caption says the depth chips are the reach.
//   - The median cadence is the median of the readable since-previous
//     gaps ALONE — unreadable pairs drop out and are counted nowhere
//     (an honest median of what the stamps allow).
//   - The line is the ladder's own voice and names only ROWS and
//     STAMPS — the mirror rule holds: no word of it says KILL, even
//     when a birth arrived on a tenure-dial reset.

export interface BirthEntry {
  flip: BoardFlip; // the row's first flip within the open tail
  ordinal: number; // 1-based birth order (firstWords' own contract)
  waitMin: number | null; // tail's first flip → this birth, minutes
  sincePrevMin: number | null; // previous birth → this birth; null for ordinal 1 or an unreadable pair
}

export interface BirthLadderRead {
  births: BirthEntry[]; // birth order preserved (firstWords' order)
  medianCadenceMin: number | null; // median of the readable since-previous gaps
  line: string; // the ladder's own voice, self-quoting
}

/** birthLadder — the first words' order as a narrative read. */
export function birthLadder(flips: BoardFlip[]): BirthLadderRead {
  const raw = firstWords(flips);
  const startMs = raw.length > 0 ? Date.parse(raw[0].flip.at) : null;

  const births: BirthEntry[] = raw.map((b, i) => {
    const t = Date.parse(b.flip.at);
    const prevT = i > 0 ? Date.parse(raw[i - 1].flip.at) : null;
    const waitMin =
      startMs !== null && Number.isFinite(startMs) && Number.isFinite(t) && t >= startMs
        ? (t - startMs) / 60_000
        : null;
    const sincePrevMin =
      i > 0 && prevT !== null && Number.isFinite(prevT) && Number.isFinite(t) && t >= prevT
        ? (t - prevT) / 60_000
        : null;
    return { flip: b.flip, ordinal: b.ordinal, waitMin, sincePrevMin };
  });

  // The median cadence: the readable since-previous gaps alone, sorted.
  const gaps = births
    .map((b) => b.sincePrevMin)
    .filter((g): g is number => g !== null)
    .sort((a, b) => a - b);
  const medianCadenceMin =
    gaps.length === 0
      ? null
      : gaps.length % 2 === 1
        ? gaps[(gaps.length - 1) / 2]
        : (gaps[gaps.length / 2 - 1] + gaps[gaps.length / 2]) / 2;

  const stampOf = (at: string) => (at.includes('T') ? at.slice(11, 19) : at);
  let line: string;
  if (births.length === 0) {
    line = 'the tail heard no row begin — motion\'s births wait deeper than the open depth';
  } else if (births.length === 1) {
    line = `the tail heard one row begin — ${births[0].flip.name} @ ${stampOf(births[0].flip.at)} UTC`;
  } else {
    const first = births[0];
    const last = births[births.length - 1];
    const cadence =
      medianCadenceMin !== null
        ? `; a birth every ${medianCadenceMin >= 100 ? Math.round(medianCadenceMin) : medianCadenceMin.toFixed(1)}′ (median)`
        : '';
    line = `the tail heard ${births.length} rows begin — ${first.flip.name} spoke first @ ${stampOf(first.flip.at)} UTC, ${last.flip.name} last @ ${stampOf(last.flip.at)} UTC${cadence}`;
  }

  return { births, medianCadenceMin, line };
}

// — R134 · THE WEIGHT — who carries the tail's motion.
//
// The read's concentration names the BUSIEST row alone (a single
// share); the tail's choreography is wider: every moved row holds a
// share of the flips, and the bar shows them all at once. motionWeights()
// reads each distinct row's flip count and share of the passed flips,
// with the row's NEWEST landing tone (chronological input: the last
// seen for the id) so the bar's colors are the board's own.
//
// THE HONESTY RULES:
//   - The weights derive from the PASSED flips alone — no clocks, no
//     store. An empty tail weighs nothing (an empty array).
//   - The share is the row's count over the WHOLE passed tail — the
//     lane's display may clamp a thin segment to stay clickable, and
//     says so there; the ENGINE's share is never clamped.
//   - The order is deterministic: count descending, name ascending as
//     the tiebreak — pinned by test, stable across re-derivations.
//   - No line here: the numbers are the voice, and the lane's caption
//     quotes them beside the tail they weigh. The mirror rule holds by
//     construction — a weight names a ROW and a count, never a KILL.

// — R135 · THE WEIGHT LADDER — the carrier read ACROSS the depths.
//
// THE WEIGHT (R134) reads one tail at ONE depth, and the handoff's own
// caution stands: the carrier's share is depth-relative (58% at 200
// vs 43% at 24) — a share quoted without its depth is a number
// without its unit. weightLadder() reads the SAME weights at EVERY
// depth chip the lane offers and answers one question: does the
// carrier HOLD across the depths, or does the CROWN MOVE — a row
// that owns the shallows while another owns the deep?
//
// THE HONESTY RULES:
//   - Each rung derives from the store's own snapshots alone —
//     summarizeLedger on the newest `depth` moved boards, the SAME
//     summarizer the R130 depth read serves — so a rung's numbers are
//     the numbers the lane would show at that depth. No new
//     arithmetic, one calibration, many readers.
//   - A depth the store cannot fill says so: `reach` is the store's
//     actual answer (≤ the ask), and the rung is ruled by what the
//     store HAS, never by the depth's ask.
//   - An empty rung carries nobody (carrier null) and speaks nowhere.
//   - A rung's flips are the shallower rung's flips PLUS the deeper
//     transitions (each flip belongs to exactly one transition), so
//     the totals are monotone in depth — pinned by test.
//   - The line names ROWS, DEPTHS, and SHARES — a share is never
//     quoted naked — and the mirror rule holds (no word of it says
//     KILL, even with tenure-dial resets in the store).

/** The lane's depth chips, as the engine owns them — one list, two
 *  readers (the route's ladder and the lane's chips can never drift). */
export const LEDGER_DEPTHS = [24, 48, 96, 200] as const;

export interface WeightRung {
  depth: number; // the asked depth
  reach: number; // the snapshots the store actually ruled (≤ depth)
  total: number; // flips within this rung's reach
  carrier: MotionWeight | null; // the heaviest row (count desc, name asc) — null when no flips
  weights: MotionWeight[]; // the rung's full choreography, heaviest first
}

export interface WeightLadderRead {
  rungs: WeightRung[]; // in the order the depths were asked
  holds: boolean | null; // the carrier question: true/false when ≥2 spoken rungs, null otherwise
  line: string; // the ladder's own voice, self-quoting, depths named
}

/** weightLadder — THE WEIGHT read at every depth chip at once. */
export function weightLadder(orderedAll: WatchboardSnapshot[], depths: number[]): WeightLadderRead {
  const rungs: WeightRung[] = depths.map((d) => {
    const slice = orderedAll.length > d ? orderedAll.slice(-d) : orderedAll;
    const flips = summarizeLedger(slice).flips;
    const weights = motionWeights(flips);
    return {
      depth: d,
      reach: slice.length,
      total: flips.length,
      carrier: weights[0] ?? null,
      weights,
    };
  });

  const spoken = rungs.filter((r) => r.carrier !== null);
  let holds: boolean | null = null;
  let line: string;
  if (spoken.length === 0) {
    line = 'no depth has a carrier yet — the weights wait for the words to move';
  } else if (spoken.length === 1) {
    const r = spoken[0]!;
    const c = r.carrier!;
    line = `only the depth-${r.depth} tail carries motion — ${c.name} leads with ${(c.share * 100).toFixed(0)}% of ${r.total} flip${r.total === 1 ? '' : 's'}`;
  } else {
    holds = spoken.every((r) => r.carrier!.id === spoken[0]!.carrier!.id);
    if (holds) {
      const rungsStr = spoken
        .map((r) => `${r.depth} (${(r.carrier!.share * 100).toFixed(0)}%)`)
        .join(' → ');
      line = `the carrier holds at every depth — ${spoken[0]!.carrier!.name} leads at ${rungsStr}`;
    } else {
      const rungsStr = spoken
        .map((r) => `${r.carrier!.name} at ${r.depth} (${(r.carrier!.share * 100).toFixed(0)}%)`)
        .join(', ');
      line = `the crown moves across the depths — ${rungsStr}`;
    }
  }

  return { rungs, holds, line };
}

export interface MotionWeight {
  id: string;
  name: string;
  count: number; // the row's flips within the passed tail
  share: number; // count / total flips (total > 0 by construction)
  tone: string; // the row's newest landing tone within the passed flips
}

/** motionWeights — every moved row's share of the tail's motion,
 *  heaviest first (count desc, name asc). */
export function motionWeights(flips: BoardFlip[]): MotionWeight[] {
  const m = new Map<string, { name: string; count: number; tone: string }>();
  for (const f of flips) {
    const cur = m.get(f.id);
    if (cur) {
      cur.count += 1;
      cur.tone = f.toTone; // chronological input: the last seen is the newest landing
    } else {
      m.set(f.id, { name: f.name, count: 1, tone: f.toTone });
    }
  }
  const total = flips.length;
  return [...m.entries()]
    .map(([id, v]) => ({ id, name: v.name, count: v.count, share: total > 0 ? v.count / total : 0, tone: v.tone }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// — R136 · THE COMPANY — who moves WITH whom.
//
// The census names who moved; the births name when each began; the
// weights name who carries. The last reading the tail owes its own
// choreography is the ENSEMBLE: which rows moved TOGETHER — their
// flips landing on the SAME board stamp, the board seen moved once
// with both words changed (one transition, several rows). companions()
// reads that company from the flips alone.
//
// THE HONESTY RULES:
//   - The company derives from the PASSED flips alone — no clocks, no
//     store, NO DATE ARITHMETIC AT ALL: the stamp STRING is the
//     transition's identity, so grouping is exact by construction
//     (flips share a stamp iff the same board build printed them).
//     The one clock-free read: a company needs no minute, only the
//     board's own word that two moves were seen at once.
//   - A stamp whose string fails to parse still groups (identity is
//     identity) and still earns its flips a seat in the census — but
//     the read SAYS how many flips carry stamps the clock refuses
//     (clockRefused, said in the line), never silently absorbed.
//   - A pair is two DISTINCT rows sharing ≥1 stamp. A row cannot pair
//     with itself: distinct rows are counted per stamp (a defensive
//     Set), so even a duplicate-carrying input cannot invent
//     self-company.
//   - Pair orientation is NAME-ASC (aName ≤ bName) so the read is
//     independent of which row the input seated first; the pair order
//     is count desc, then aName asc, then bName asc — deterministic,
//     stable across re-derivations, pinned by test.
//   - The input order is LOAD-BEARING (the chronological contract,
//     oldest first): a pair's lastAt is its LAST shared stamp in input
//     order (the last seen is the newest — motionWeights' own rule),
//     never a parsed max; maxEnsembleAt is the FIRST stamp carrying
//     the max (the longest-quiet tie's own convention).
//   - The line is the company's own voice and names only ROWS, STAMPS,
//     and COUNTS — the mirror rule holds: no word of it says KILL,
//     even when an ensemble landed on a tenure-dial reset.

export interface CompanyPair {
  aId: string;
  aName: string; // orientation: aName ≤ bName (name asc)
  bId: string;
  bName: string;
  count: number; // shared stamps (transitions) across the tail
  lastAt: string | null; // the pair's LAST shared stamp, input order — the newest
  lastA: BoardFlip | null; // each row's flip ON that last shared stamp
  lastB: BoardFlip | null;
}

export interface CompanyRead {
  pairs: CompanyPair[]; // count desc, then aName asc, then bName asc
  readableStamps: number; // stamps (transitions) carrying ≥1 flip
  soloStamps: number; // exactly ONE distinct row flipped
  ensembleStamps: number; // ≥2 distinct rows
  soloShare: number | null; // soloStamps / readableStamps; null when no stamps
  maxEnsemble: number; // the largest distinct-row count on one stamp
  maxEnsembleAt: string | null; // the FIRST stamp carrying the max, input order
  strongest: CompanyPair | null; // pairs[0] when any pair exists
  clockRefused: number; // flips whose stamp fails to parse — grouped by string, said in the line
  line: string; // the company's own voice, self-quoting
}

/** companions — the tail's ensembles: which rows moved together, from
 *  the flips alone (chronological input, the order load-bearing). */
export function companions(flips: BoardFlip[]): CompanyRead {
  const byStamp = new Map<string, BoardFlip[]>();
  let clockRefused = 0;
  for (const f of flips) {
    if (!Number.isFinite(Date.parse(f.at))) clockRefused += 1;
    const cur = byStamp.get(f.at);
    if (cur) cur.push(f);
    else byStamp.set(f.at, [f]);
  }

  const pairAcc = new Map<
    string,
    { aId: string; aName: string; bId: string; bName: string; count: number; lastAt: string | null; lastA: BoardFlip | null; lastB: BoardFlip | null }
  >();
  let readableStamps = 0;
  let soloStamps = 0;
  let ensembleStamps = 0;
  let maxEnsemble = 0;
  let maxEnsembleAt: string | null = null;

  for (const [stamp, fs] of byStamp) {
    const rows = new Set(fs.map((f) => f.id));
    readableStamps += 1;
    if (rows.size === 1) soloStamps += 1;
    if (rows.size >= 2) {
      ensembleStamps += 1;
      if (rows.size > maxEnsemble) {
        maxEnsemble = rows.size;
        maxEnsembleAt = stamp; // the FIRST stamp carrying the max (strict >)
      }
    }
    const ids = [...rows];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const fa = fs.find((f) => f.id === ids[i]);
        const fb = fs.find((f) => f.id === ids[j]);
        if (!fa || !fb) continue;
        const [a, b] = fa.name.localeCompare(fb.name) <= 0 ? [fa, fb] : [fb, fa];
        const key = `${a.id}|${b.id}`;
        const cur = pairAcc.get(key);
        if (cur) {
          cur.count += 1;
          cur.lastAt = stamp; // input order: the last occurrence is the newest
          cur.lastA = a;
          cur.lastB = b;
        } else {
          pairAcc.set(key, {
            aId: a.id,
            aName: a.name,
            bId: b.id,
            bName: b.name,
            count: 1,
            lastAt: stamp,
            lastA: a,
            lastB: b,
          });
        }
      }
    }
  }

  const pairs: CompanyPair[] = [...pairAcc.values()].sort(
    (x, y) => y.count - x.count || x.aName.localeCompare(y.aName) || x.bName.localeCompare(y.bName),
  );
  const soloShare = readableStamps > 0 ? soloStamps / readableStamps : null;

  const timeOf = (at: string | null) =>
    at ? (at.includes('T') ? at.slice(11, 19) : at) : '—';

  let line: string;
  if (flips.length === 0) {
    line = 'no flips in the tail — the company read waits for the words to move';
  } else if (pairs.length === 0) {
    line = `the tail's ${readableStamps} stamp${readableStamps === 1 ? '' : 's'} heard one row at a time — no company yet; the rows move alone`;
  } else {
    const s = pairs[0]!;
    const soloClause =
      soloStamps > 0
        ? `; ${soloStamps} stamp${soloStamps === 1 ? '' : 's'} moved alone (${((soloShare ?? 0) * 100).toFixed(0)}%)`
        : '';
    const ensembleClause =
      maxEnsemble > 2
        ? ` — up to ${maxEnsemble} rows together @ ${timeOf(maxEnsembleAt)} UTC`
        : '';
    line = `${s.aName} ⇄ ${s.bName} share the tail's closest company — ${s.count} stamp${s.count === 1 ? '' : 's'} together, last @ ${timeOf(s.lastAt)} UTC${ensembleClause}${soloClause}`;
    if (clockRefused > 0) {
      line += ` · ${clockRefused} flip${clockRefused === 1 ? '' : 's'} carry stamps the clock refuses (grouped by the stamp's own string — no clock needed)`;
    }
  }

  return {
    pairs,
    readableStamps,
    soloStamps,
    ensembleStamps,
    soloShare,
    maxEnsemble,
    maxEnsembleAt,
    strongest: pairs[0] ?? null,
    clockRefused,
    line,
  };
}

// — R136 · THE QUIET LADDER — the pace's SHAPE, not just its longest.
//
// The quiet hand (R132) names THE longest quiet; the tail's quieter
// shape is wider — the N longest quiets, ruled longest-first. The
// ladder composes on gapsOf (the pinned primitive: consecutive seated
// flips, the broken chain said, the first-longest tie) and orders the
// gaps descending with the SAME tie rule: equal quiets keep the input
// order — the FIRST occurrence wins, pinned by test.
//
// THE HONESTY RULES:
//   - Every rung derives from the gaps' own stamps and minutes — no
//     clocks, no store, no re-derivation of the gaps. The ordinals are
//     the ladder's own; the arithmetic is gapsOf's.
//   - The asked n is a DISPLAY bound, not an arithmetic one: the read
//     never hides the tail's gap count — the line says the whole count
//     first, then names the asked rungs.
//   - The line names ROWS, STAMPS, and MINUTES — the mirror rule
//     holds, even when a quiet ended on a tenure-dial reset.

export interface QuietRung {
  gap: LedgerGap; // gapsOf's own gap, untouched
  ordinal: number; // 1 = the longest (ties: first in input order)
}

export interface QuietLadderRead {
  rungs: QuietRung[]; // longest first, at most n
  totalGaps: number; // the tail's WHOLE gap count — never hidden
  asked: number; // the n the caller asked for
  line: string; // the ladder's own voice, self-quoting
}

/** quietLadder — the N longest quiets, longest first, the ties honest. */
export function quietLadder(flips: BoardFlip[], n = 5): QuietLadderRead {
  const { gaps } = gapsOf(flips);
  const decorated = gaps.map((g, i) => ({ g, i }));
  decorated.sort((x, y) => y.g.min - x.g.min || x.i - y.i);
  const rungs: QuietRung[] = decorated
    .slice(0, Math.max(0, n))
    .map(({ g }, i) => ({ gap: g, ordinal: i + 1 }));

  const timeOf = (at: string) => (at.includes('T') ? at.slice(11, 19) : at);
  let line: string;
  if (gaps.length === 0) {
    line =
      flips.length < 2
        ? 'the tail holds no gap to ladder — the quiet waits for a second flip'
        : 'the tail holds no readable gap — the pace refuses, and so does the ladder';
  } else {
    const list = rungs
      .map(
        (r) =>
          `${r.gap.min >= 100 ? Math.round(r.gap.min) : r.gap.min.toFixed(1)}′ ended by ${r.gap.toFlip.name} @ ${timeOf(r.gap.toFlip.at)} UTC`,
      )
      .join(' · ');
    line = `the tail's ${gaps.length} quiet${gaps.length === 1 ? '' : 's'}, the ${rungs.length} longest: ${list}`;
  }

  return { rungs, totalGaps: gaps.length, asked: n, line };
}

// — R137 · THE TURNAROUND — the board changing its mind.
//
// Every read so far has read motion FORWARD — births (the firsts), the
// pace (the quiets), company (who moves with whom), weight (who
// carries). The board's UNDO has never been read: a row that TAKES
// ITS OWN WORD BACK. The turnaround walks each row's own chain (the
// row's flips, input order) for RETURNS, at two depths:
//
//   - ROUND TRIP (span 1): the row's flip inverts its own previous
//     flip — A→B then B→A, the word undone in one step, the sharpest
//     changed-mind a chain can carry. At the flip's own level: a word
//     round trip is (from,to) == (prev.to, prev.from); a tone round
//     trip is the TONES swapped on the same word (the word never
//     moved — the severity came back). A word flip and a tone flip
//     are different kinds of motion: neither inverts the other, and
//     an adjacent pair of different kinds is never a round trip.
//   - REPRISE (span ≥ 2): the row's flip repeats a pair the SAME row
//     has already made, with at least one flip between — the motion
//     CAME BACK. The pair's identity is the flip's own level: word
//     pairs for word flips, tone pairs on the row's word for tone
//     flips. The predecessor kept is the NEAREST one (the span
//     tightens as the chain continues — the most recent repeat is the
//     honest one).
//
// THE SHARPEST-WINS RULE: a flip that qualifies BOTH ways (its pair
// repeats an older pair AND it inverts its immediate predecessor) is
// classified ROUND TRIP — an immediate undo is never demoted to a
// reprise. Pinned by test.
//
// THE HONESTY RULES:
//   - The classification is STRUCTURAL — pairs and order, no clocks.
//     The minutes ride the stamps and refuse when either stamp
//     refuses (the clockRefused convention, counted and said).
//   - The chain's continuity is the ledger's own (between two flips
//     of a row the row was constant, so each flip starts where the
//     previous ended) — the read adds no continuity of its own and
//     never assumes a value it was not shown.
//   - A SEESAW is the round trip CHAINED: ≥ 2 consecutive round trips
//     on one row — the board flipping back and forth. The read names
//     the longest seesaw per row, ties keeping input order (the
//     engine's first-occurrence convention, pinned).
//   - The line names ROWS, STAMPS, and MINUTES — the mirror rule
//     holds, even when the undo is the whole news.

export interface ReversalEntry {
  id: string;
  name: string;
  from: string; // the RETURN flip's from — the word the undo started from
  to: string; // the RETURN flip's to — the word TAKEN BACK
  at: string; // the return flip's stamp (when the undo was seen)
  departedAt: string; // the departure flip's stamp (when the word left)
  gapMin: number | null; // return − departure, minutes (null: a stamp refuses)
  span: number; // flips between departure and return ON THE ROW'S OWN CHAIN (1 = immediate)
  kind: 'round-trip' | 'reprise';
  toTone: string; // the return's landing tone (for the dot)
}

export interface ReversalRow {
  id: string;
  name: string;
  count: number; // the row's turnaround count in the tail
  seesaw: number; // the row's longest consecutive round-trip streak
}

export interface ReversalRead {
  reversals: ReversalEntry[]; // input order reversed — the newest first
  roundTrips: number;
  reprises: number;
  rows: ReversalRow[]; // count desc, name asc
  latest: ReversalEntry | null; // the tail's newest turnaround
  sharpest: ReversalEntry | null; // the smallest span; ties keep the LATEST
  longestSeesaw: (ReversalRow & { length: number }) | null; // the biggest back-and-forth
  clockRefused: number; // turnarounds whose minutes the stamps refuse
  line: string; // the read's own voice, self-quoting
}

/** reversals — the board's changed minds, structural and clock-honest. */
export function reversals(flips: BoardFlip[]): ReversalRead {
  // The row chains, input order preserved (the pairs' contract).
  const chains = new Map<string, { name: string; flips: BoardFlip[] }>();
  for (const f of flips) {
    const c = chains.get(f.id);
    if (c) {
      if (f.name < c.name) c.name = f.name; // name-asc for the row's label (companions' orientation)
      c.flips.push(f);
    } else {
      chains.set(f.id, { name: f.name, flips: [f] });
    }
  }

  const pairKey = (f: BoardFlip): string =>
    f.kind === 'word' ? `w:${f.from}|${f.to}` : `t:${f.from}|${f.fromTone}|${f.toTone}`;

  const inverted = (f: BoardFlip, p: BoardFlip): boolean => {
    if (f.kind !== p.kind) return false; // different kinds of motion never undo each other
    if (f.kind === 'word') return f.from === p.to && f.to === p.from;
    return f.from === p.from && f.fromTone === p.toTone && f.toTone === p.fromTone;
  };

  const entries: ReversalEntry[] = [];
  const rows: ReversalRow[] = [];
  let clockRefused = 0;

  for (const [id, chain] of chains) {
    const seen = new Map<string, number>(); // pairKey → the flip's index on THIS chain
    let seesaw = 0;
    let seesawBest = 0;
    let count = 0;
    for (let i = 0; i < chain.flips.length; i++) {
      const f = chain.flips[i]!;
      const prev = i > 0 ? chain.flips[i - 1]! : null;
      let kind: 'round-trip' | 'reprise' | null = null;
      let departed: BoardFlip | null = null;
      let span = 0;
      if (prev && inverted(f, prev)) {
        // THE SHARPEST-WINS RULE: the immediate undo, never demoted.
        kind = 'round-trip';
        departed = prev;
        span = 1;
      } else {
        const j = seen.get(pairKey(f));
        if (j !== undefined && i > j) {
          kind = 'reprise';
          departed = chain.flips[j]!;
          span = i - j;
        }
      }
      if (kind && departed) {
        const depMs = Date.parse(departed.at);
        const retMs = Date.parse(f.at);
        const gapMin = Number.isFinite(depMs) && Number.isFinite(retMs) ? (retMs - depMs) / 60000 : null;
        if (gapMin === null) clockRefused += 1;
        entries.push({
          id,
          name: f.name,
          from: f.from,
          to: f.to,
          at: f.at,
          departedAt: departed.at,
          gapMin,
          span,
          kind,
          toTone: f.toTone,
        });
        count += 1;
      }
      // The seesaw counts CONSECUTIVE round trips on the row's chain.
      if (kind === 'round-trip') {
        seesaw += 1;
        if (seesaw > seesawBest) seesawBest = seesaw;
      } else {
        seesaw = 0;
      }
      seen.set(pairKey(f), i); // the NEAREST predecessor is the honest one
    }
    if (count > 0) rows.push({ id, name: chain.name, count, seesaw: seesawBest });
  }

  rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const newestFirst = [...entries].reverse();
  let sharpest: ReversalEntry | null = null;
  for (const e of entries) {
    if (!sharpest || e.span <= sharpest.span) sharpest = e; // ties keep the LATEST
  }
  const seesawWinner = [...rows].sort((a, b) => b.seesaw - a.seesaw || a.name.localeCompare(b.name)).find((r) => r.seesaw >= 2) ?? null;
  const roundTrips = entries.filter((e) => e.kind === 'round-trip').length;
  const reprises = entries.filter((e) => e.kind === 'reprise').length;

  const timeOf = (at: string) => (at.includes('T') ? at.slice(11, 19) : at);
  const minStr = (m: number | null) => (m === null ? '—' : m >= 100 ? String(Math.round(m)) : m.toFixed(1));
  let line: string;
  if (flips.length === 0) {
    line = 'no flips in the tail — the turnaround read waits for the words to move';
  } else if (entries.length === 0) {
    line = `the tail's ${flips.length} flip${flips.length === 1 ? '' : 's'} hold no turnaround — no row has taken its word back; the board moves forward`;
  } else {
    const l = newestFirst[0]!;
    const seesawClause = seesawWinner
      ? `; ${seesawWinner.name} seesawed longest — ${seesawWinner.seesaw} round trips back to back`
      : '';
    line = `the board changed its mind ${entries.length} time${entries.length === 1 ? '' : 's'} — ${roundTrips} round trip${roundTrips === 1 ? '' : 's'} · ${reprises} reprise${reprises === 1 ? '' : 's'}; the latest: ${l.name} took ${l.from} → ${l.to} back @ ${timeOf(l.at)} UTC (${l.kind === 'round-trip' ? 'undone in one step' : `gone ${minStr(l.gapMin)}′, ${l.span} flips`})${seesawClause}`;
    if (clockRefused > 0) {
      line += ` · ${clockRefused} turnaround${clockRefused === 1 ? '' : 's'} carry stamps the clock refuses (the structure stands, the minutes do not)`;
    }
  }

  return {
    reversals: newestFirst,
    roundTrips,
    reprises,
    rows,
    latest: newestFirst[0] ?? null,
    sharpest,
    longestSeesaw: seesawWinner ? { ...seesawWinner, length: seesawWinner.seesaw } : null,
    clockRefused,
    line,
  };
}

// — R138 · THE HANDOFF — the motion passing between rows.
//
// THE COMPANY (R136) read WHO MOVES WITH WHOM — flips on the SAME
// stamp, the simultaneity read, clock-free. THE HANDOFF is its
// TEMPORAL MIRROR: the board's motion in SUCCESSION — flip i's row
// hands the board's attention to flip i+1's row. Every ADJACENT pair
// of flips in the tail's chronological order is one passage:
//
//   - HANDED: flip i+1 belongs to a DIFFERENT row than flip i — the
//     motion moved from row A to row B, a DIRECTED passage (A→B; the
//     reverse passage B→A is a different edge, pinned by test).
//   - KEPT: flip i+1 belongs to the SAME row — the row kept its turn
//     (a double flip; the motion stayed home).
//
// The chain is the passage's longest run: consecutive flips whose
// rows are pairwise-distinct ADJACENTLY (a relay may revisit a row,
// it just cannot repeat itself back-to-back). Ties keep the FIRST
// occurrence — the engine's own first-longest convention (gapsOf's,
// pinned twice before).
//
// THE HONESTY RULES:
//   - The read is ORDER-ONLY: positions and rows, no clocks, no
//     minutes, no word values — the company's clock-free discipline
//     carried one step further (the passage needs no clock because
//     succession is the input's own order, said in the line).
//   - Direction is load-bearing: A→B and B→A are different passages.
//     A relay that swings shows as TWO strong edges, the seesaw's
//     temporal shadow.
//   - The line names ROWS and STAMPS — the mirror rule holds; the
//     word KILL never appears, even when a tenure-dial reset rides
//     the tail.

export interface HandoffPair {
  aId: string;
  aName: string;
  bId: string;
  bName: string;
  count: number; // the directed edge's passages
  lastAt: string | null; // the newest passage's stamp (the RECEIVING flip's own)
  /** R140 · the edge light's fuel: the handing and receiving flips of
   *  EACH passage, input order (adjacent passages share seats — the
   *  same flip may appear twice; the light dedups by seat key). No new
   *  geometry: the flips are the input's own objects, referenced. */
  seats: BoardFlip[];
}

export interface HandoffChain {
  rows: Array<{ id: string; name: string }>; // in order, adjacent-distinct
  flips: BoardFlip[]; // the run's own flips, in order — the light's fuel (the relay lit reads them)
  from: string; // the run's first flip's stamp
  to: string; // the run's last flip's stamp
  length: number; // flips in the run (≥ 2 to exist)
}

export interface HandoffRead {
  pairs: HandoffPair[]; // count desc, aName asc, bName asc
  strongest: HandoffPair | null;
  handed: number; // adjacent passages where the row CHANGED
  kept: number; // adjacent passages where the row KEPT its turn
  chainLength: number; // the longest adjacent-distinct run (0 when no flips)
  longestChain: HandoffChain | null; // ties keep the FIRST occurrence
  line: string; // the read's own voice, self-quoting
}

/** handoffs — the board's motion in succession, order-only, directed. */
export function handoffs(flips: BoardFlip[]): HandoffRead {
  const pairAcc = new Map<
    string,
    {
      aId: string;
      aName: string;
      bId: string;
      bName: string;
      count: number;
      lastAt: string | null;
      seats: BoardFlip[];
    }
  >();
  let handed = 0;
  let kept = 0;

  // The longest adjacent-distinct run, ties keeping the FIRST occurrence.
  let bestStart = 0;
  let bestLen = 0;
  let runStart = 0;
  for (let i = 0; i < flips.length; i++) {
    if (i > 0) {
      if (flips[i]!.id === flips[i - 1]!.id) {
        kept += 1;
        runStart = i; // the run restarts at the repeat
      } else {
        handed += 1;
      }
    }
    const runLen = i - runStart + 1;
    if (runLen > bestLen) {
      bestLen = runLen; // strict > — the FIRST longest wins
      bestStart = runStart;
    }
  }

  for (let i = 1; i < flips.length; i++) {
    const a = flips[i - 1]!;
    const b = flips[i]!;
    if (a.id === b.id) continue; // kept — not a passage
    const key = `${a.id}>${b.id}`;
    const cur = pairAcc.get(key);
    if (cur) {
      cur.count += 1;
      cur.lastAt = b.at; // input order: the last occurrence is the newest
      cur.seats.push(a, b); // the light's fuel: both seats, input order
    } else {
      pairAcc.set(key, {
        aId: a.id,
        aName: a.name,
        bId: b.id,
        bName: b.name,
        count: 1,
        lastAt: b.at,
        seats: [a, b],
        // The edge's direction is (aId → bId) — the NAMES ride for
        // display, the ids carry the direction (two rows may share a
        // name; the ids cannot share an identity).
      });
    }
  }

  const pairs: HandoffPair[] = [...pairAcc.values()].sort(
    (x, y) => y.count - x.count || x.aName.localeCompare(y.aName) || x.bName.localeCompare(y.bName),
  );

  const chain: HandoffChain | null =
    bestLen >= 2
      ? {
          rows: flips.slice(bestStart, bestStart + bestLen).map((f) => ({ id: f.id, name: f.name })),
          flips: flips.slice(bestStart, bestStart + bestLen),
          from: flips[bestStart]!.at,
          to: flips[bestStart + bestLen - 1]!.at,
          length: bestLen,
        }
      : null;

  const timeOf = (at: string) => (at.includes('T') ? at.slice(11, 19) : at);
  let line: string;
  if (flips.length < 2) {
    line = 'the tail holds no succession — the handoff read waits for a second flip';
  } else if (pairs.length === 0) {
    line = `the tail's ${kept + 1} flip${kept + 1 === 1 ? '' : 's'} belong to one row — the motion kept its own turn throughout; no handoff to read`;
  } else {
    const s = pairs[0]!;
    const chainClause = chain
      ? `; the longest relay ran ${chain.length} flips without a repeat (${chain.rows.map((r) => r.name).join(' → ')})`
      : '';
    line = `${s.aName} → ${s.bName} is the tail's strongest handoff — ${s.count} passage${s.count === 1 ? '' : 's'}, last @ ${timeOf(s.lastAt ?? '')} UTC${chainClause}; ${handed} of ${handed + kept} passage${handed + kept === 1 ? '' : 's'} handed, ${kept} kept`;
  }

  return {
    pairs,
    strongest: pairs[0] ?? null,
    handed,
    kept,
    chainLength: bestLen,
    longestChain: chain,
    line,
  };
}

// — R139 · THE QUIET'S COMPANY — the quiets' succession, the silence
// given its own handoff read.
//
// The quiet ladder (R136) rules the N longest quiets; the handoff
// (R138) reads the motion's succession. The composition neither has
// made alone: every QUIET is a passage too — one row's flip OPENS the
// silence (the gap's fromFlip), a row's flip ENDS it (the gap's
// toFlip), and the directed pair (opener → ender) is the edge the
// silence hung on. Which pairs OWN the tail's quiets is the read:
// the same two rows repeatedly framing the board's silences is a
// rhythm no motion read can see, because the motion reads stop where
// the quiet begins.
//
// THE HONESTY RULES:
//   - The read composes on gapsOf's own gaps (the pinned primitive):
//     every gap's opener and ender are the gaps' own flips, untouched;
//     the minutes are the gaps' minutes. No clocks, no store, no
//     re-derivation. Broken chains (an unreadable stamp splitting the
//     tail) are SAID (broken carried up), never bridged.
//   - The pair is DIRECTED and load-bearing: A opening → B ending is a
//     different company than B opening → A ending — the direction is
//     the silence's own grammar (who spoke before it, who ended it).
//   - THE SELF-KEPT QUIET: opener and ender the same row — the row
//     went quiet and ended its own silence. Counted, named, never
//     folded into the handed companies (a row keeping its own company
//     is its own fact).
//   - Ordering: count desc, then openerName asc, then enderName asc —
//     the house convention (gapsOf's first-longest ties live upstream;
//     this read counts, it does not rank quiets).
//   - The mirror rule holds: rows, stamps, minutes — the word KILL
//     never appears, even when a quiet ends on a tenure-dial reset.

export interface QuietPair {
  openerId: string;
  openerName: string;
  enderId: string;
  enderName: string;
  count: number; // the quiets this directed pair owns
  totalMin: number; // the pair's summed quiet minutes
  longestMin: number; // the pair's longest quiet
  lastAt: string | null; // the newest ender stamp, input order
  /** R140 · the silence's edge light's fuel: the opener and ender of
   *  EACH owned quiet, input order (a self-kept quiet seats the same
   *  flip twice — the light dedups by seat key). Referenced, not
   *  copied: the gaps' own flip objects. */
  seats: BoardFlip[];
}

export interface QuietCompanyRead {
  pairs: QuietPair[]; // count desc, openerName asc, enderName asc
  strongest: QuietPair | null; // pairs[0] when any pair exists
  quiets: number; // the tail's readable quiets (= the gaps counted)
  companies: number; // distinct directed pairs owning at least one quiet
  selfKept: number; // quiets opened and ended by the SAME row
  broken: number; // gapsOf's broken chains, said not bridged
  line: string; // the read's own voice, self-quoting
}

/** quietCompany — which directed row pairs own the tail's quiets. */
export function quietCompany(flips: BoardFlip[]): QuietCompanyRead {
  const { gaps, broken } = gapsOf(flips);

  const acc = new Map<
    string,
    {
      openerId: string;
      openerName: string;
      enderId: string;
      enderName: string;
      count: number;
      totalMin: number;
      longestMin: number;
      lastAt: string | null;
      seats: BoardFlip[];
    }
  >();
  let selfKept = 0;

  for (const g of gaps) {
    const opener = g.fromFlip;
    const ender = g.toFlip;
    if (opener.id === ender.id) selfKept += 1;
    const key = `${opener.id}>${ender.id}`;
    const cur = acc.get(key);
    if (cur) {
      cur.count += 1;
      cur.totalMin += g.min;
      if (g.min > cur.longestMin) cur.longestMin = g.min;
      cur.lastAt = ender.at; // input order: the last occurrence is the newest
      cur.seats.push(opener, ender); // the light's fuel: both seats
    } else {
      acc.set(key, {
        openerId: opener.id,
        openerName: opener.name,
        enderId: ender.id,
        enderName: ender.name,
        count: 1,
        totalMin: g.min,
        longestMin: g.min,
        lastAt: ender.at,
        seats: [opener, ender],
      });
    }
  }

  const pairs: QuietPair[] = [...acc.values()].sort(
    (x, y) =>
      y.count - x.count ||
      x.openerName.localeCompare(y.openerName) ||
      x.enderName.localeCompare(y.enderName),
  );

  const minStr = (m: number) => (m >= 100 ? String(Math.round(m)) : m.toFixed(1));
  const timeOf = (at: string) => (at.includes('T') ? at.slice(11, 19) : at);
  let line: string;
  if (flips.length < 2) {
    line = 'the tail holds no quiet to company — the read waits for a second flip';
  } else if (pairs.length === 0) {
    line =
      broken > 0
        ? `the tail's quiets refuse the clock — ${broken} chain${broken === 1 ? '' : 's'} broken by an unreadable stamp, said not bridged`
        : 'the tail holds no readable quiet — the company of the silence waits';
  } else {
    const s = pairs[0]!;
    const selfClause = selfKept > 0
      ? `; ${selfKept} self-kept (a row's own quiet, opened and ended by the same row)`
      : '';
    const brokenClause = broken > 0
      ? `; ${broken} chain${broken === 1 ? '' : 's'} broken by an unreadable stamp, said not bridged`
      : '';
    const rhythmClause = s.count >= 2
      ? ` — a rhythm: the same two rows framing the silence ${s.count} time${s.count === 1 ? '' : 's'}`
      : '';
    line = `${s.openerName} → ${s.enderName} own the tail's quiets — ${s.count} quiet${s.count === 1 ? '' : 's'}, ${minStr(s.totalMin)}′ total, the longest ${minStr(s.longestMin)}′, last ended @ ${timeOf(s.lastAt ?? '')} UTC${rhythmClause}; ${pairs.length} compan${pairs.length === 1 ? 'y' : 'ies'} over ${gaps.length} quiet${gaps.length === 1 ? '' : 's'}${selfClause}${brokenClause}`;
  }

  return {
    pairs,
    strongest: pairs[0] ?? null,
    quiets: gaps.length,
    companies: pairs.length,
    selfKept,
    broken,
    line,
  };
}

// — R140 · THE SHARED GROUND — the changed minds × the ruled quiets.
//
// The turnaround (R137) names the rows that TAKE THEIR WORDS BACK;
// the quiet ladder (R136) rules the tail's N LONGEST quiets; the
// quiet's company (R139) gave every quiet a framing pair. Neither
// read asks the composition's own question: do the RESTLESS and the
// SILENT share the same rows? A row that both changes its mind AND
// frames one of the tail's ruled quiets is a different animal from
// either alone — the restlessness and the quiet are the same row's
// two faces, and the lane has been reading them on separate strips.
//
// WHY THE RULED QUIETS: every flip on the tail frames SOME gap (a
// flip is every gap's opener or ender — the tail's own edges), so a
// composition over ALL gaps makes the overlap trivial — every row
// with a flip would own quiets, and the shared ground would collapse
// into the restless census alone. The honest composition rides the
// quiets the lane ITSELF names (the quiet ladder's rungs — the tail's
// longest, the ones the strip renders): a row that frames one of
// THOSE has earned the quiet-owning name, and the overlap means
// something. The whole gap count is never hidden (totalQuiets rides
// the read, the ladder's own discipline).
//
// THE HONESTY RULES:
//   - The read COMPOSES on the pinned primitives and adds no clock
//     of its own: turnaround counts come from reversals()'s own rows
//     (structural — pairs and order); the ruled quiets come from
//     quietLadder()'s own rungs (gapsOf's gaps, the minutes already
//     vetted upstream). A row's quiet PARTS are the ruled quiets it
//     opens or ends; the SELF-KEPT quiet (opener === ender) is ONE
//     part of that row, never two.
//   - Shared = BOTH counts ≥ 1 on the same row id. A row restless
//     but never quiet-owning, or quiet-owning but never restless, is
//     said by the census (restless / silent) and left out of the
//     entries — the composition reads the OVERLAP, not the union.
//   - Ordering: turnarounds desc, then quietParts desc, then name
//     asc, then id asc — the house convention's own extension.
//   - Broken chains (an unreadable stamp splitting the tail) are
//     SAID (broken carried up), never bridged; the readable ruled
//     quiets still compose.
//   - The entry's name rides the reversal chains' name-asc
//     orientation (the turnaround strip's own label); lastAt is the
//     newest stamp of the row's RULED-quiet involvement, input order.
//   - The mirror rule holds: rows, counts, stamps — the word KILL
//     never appears, even when a turnaround rides a tenure reset.

export interface SharedGroundEntry {
  id: string;
  name: string;
  turnarounds: number; // the row's changed minds (reversals' own count)
  seesaw: number; // the row's longest round-trip streak (rides along)
  quietParts: number; // RULED quiets the row opens or ends (self-kept once)
  selfKept: number; // of those, the quiets the row opened AND ended alone
  lastAt: string | null; // the newest stamp of the row's ruled-quiet parts
}

export interface SharedGroundRead {
  entries: SharedGroundEntry[]; // the shared rows, ordered
  shared: number; // entries.length — rows holding BOTH
  restless: number; // rows with ≥ 1 turnaround
  silent: number; // rows opening or ending ≥ 1 ruled quiet
  quiets: number; // the ruled quiets composed on (the ladder's rungs)
  totalQuiets: number; // the tail's WHOLE readable gap count — never hidden
  broken: number; // said, not bridged
  line: string; // the read's own voice, self-quoting
}

/** sharedGround — the restless and the silent, read on the same rows. */
export function sharedGround(flips: BoardFlip[], n = 5): SharedGroundRead {
  const rev = reversals(flips);
  const ladder = quietLadder(flips, n);
  const ruled = ladder.rungs.map((r) => r.gap);
  const { broken } = gapsOf(flips); // the breaks ride the ladder's own primitive

  // The quiet parts, per row, over the RULED quiets (input order —
  // the last write is the newest).
  const quietAcc = new Map<
    string,
    { name: string; parts: number; selfKept: number; lastAt: string | null }
  >();
  for (const g of ruled) {
    const opener = g.fromFlip;
    const ender = g.toFlip;
    if (opener.id === ender.id) {
      // THE SELF-KEPT QUIET: one part of one row, never two. The
      // part's newest stamp is the ENDER's — the same row's ending
      // flip (the involvement completes when the silence ends).
      const cur = quietAcc.get(opener.id);
      if (cur) {
        cur.parts += 1;
        cur.selfKept += 1;
        cur.lastAt = ender.at;
      } else {
        quietAcc.set(opener.id, { name: opener.name, parts: 1, selfKept: 1, lastAt: ender.at });
      }
      continue;
    }
    for (const f of [opener, ender]) {
      const cur = quietAcc.get(f.id);
      if (cur) {
        cur.parts += 1;
        cur.lastAt = f.at;
      } else {
        quietAcc.set(f.id, { name: f.name, parts: 1, selfKept: 0, lastAt: f.at });
      }
    }
  }

  // The overlap: reversal rows that also own ruled-quiet parts.
  const entries: SharedGroundEntry[] = [];
  for (const r of rev.rows) {
    const q = quietAcc.get(r.id);
    if (!q) continue; // restless only — said by the census, not shared
    entries.push({
      id: r.id,
      name: r.name,
      turnarounds: r.count,
      seesaw: r.seesaw,
      quietParts: q.parts,
      selfKept: q.selfKept,
      lastAt: q.lastAt,
    });
  }
  entries.sort(
    (a, b) =>
      b.turnarounds - a.turnarounds ||
      b.quietParts - a.quietParts ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );

  const timeOf = (at: string | null) => {
    if (!at) return '—';
    return at.includes('T') ? at.slice(11, 19) : at;
  };
  let line: string;
  if (flips.length < 2) {
    line = 'the tail holds no ground to share — the read waits for a second flip';
  } else if (entries.length === 0) {
    line =
      rev.rows.length === 0 && quietAcc.size === 0
        ? `the tail holds neither changed mind nor ruled quiet — no ground to share yet${broken > 0 ? ` (${broken} chain${broken === 1 ? '' : 's'} broken by an unreadable stamp, said not bridged)` : ''}`
        : `the changed minds and the ruled quiets keep different rows — ${rev.rows.length} restless, ${quietAcc.size} quiet-owning, no row among both`;
  } else {
    const s = entries[0]!;
    const selfClause = s.selfKept > 0 ? ` (${s.selfKept} self-kept)` : '';
    const brokenClause = broken > 0
      ? `; ${broken} chain${broken === 1 ? '' : 's'} broken by an unreadable stamp, said not bridged`
      : '';
    line = `${s.name} owns the shared ground — ${s.turnarounds} changed mind${s.turnarounds === 1 ? '' : 's'} · ${s.quietParts} of the tail's ${ladder.rungs.length} ruled quiet${ladder.rungs.length === 1 ? '' : 's'} framed${selfClause}, last heard @ ${timeOf(s.lastAt)} UTC; ${entries.length} of ${rev.rows.length} restless and ${quietAcc.size} quiet-owning rows hold both${brokenClause}`;
  }

  return {
    entries,
    shared: entries.length,
    restless: rev.rows.length,
    silent: quietAcc.size,
    quiets: ladder.rungs.length,
    totalQuiets: ladder.totalGaps,
    broken,
    line,
  };
}

// — R141 · THE TURNAROUND'S EDGES — what delivered each changed mind.
//
// The turnaround (R137) names the board's changed minds; the handoff
// (R138) reads the motion's succession. The composition neither has
// made alone: a changed mind ARRIVES — the return flip has a
// chronological predecessor in the tail (the input's own order, the
// handoff's own grammar), and that predecessor's row is the row the
// board was reading when the mind changed. Two arrivals exist:
//
//   - HANDED: the predecessor belongs to a DIFFERENT row — the edge
//     (predecessor's row → the turnaround's row) DELIVERED the changed
//     mind. A directed edge, load-bearing: A delivering to B is a
//     different delivery than B delivering to A.
//   - KEPT: the predecessor belongs to the SAME row — the row kept
//     its own turn and then changed its mind (the changed mind grew
//     at home, no edge carried it).
//
// THE QUESTION the read answers: do the changed minds ride the
// strongest handoff edges? The turnaround strip's rows and the
// handoff strip's edges have never been read against each other —
// an edge that repeatedly delivers changed minds is a different
// animal from one that merely passes motion through.
//
// THE HONESTY RULES:
//   - The read COMPOSES on reversals()'s own entries (the
//     classification — round trip or reprise, word or tone — is the
//     turnaround's, untouched) and the input's own order (the
//     predecessor is the tail's chronological previous flip). No new
//     clock, no re-classification. BOTH kinds of changed mind count —
//     a reprise arrives exactly as a round trip does.
//   - UNSEEN: a turnaround with no predecessor (the tail's own edge)
//     is counted, never folded — the composition never invents a
//     delivery. (By the turnaround's own construction the chain's
//     first flip cannot be a return, so this stays 0 on any tail —
//     pinned by test as the honesty's own guard.)
//   - Ordering: count desc, then aName asc, then bName asc — the
//     house convention.
//   - THE DELIVERY'S SEATS (R142): each edge keeps its deliveries'
//     own flips — the delivering predecessor and the changed-mind
//     return, one ADJACENT PAIR per delivery, the pairs themselves in
//     the tail's order (oldest first; the walk is newest-first, so the
//     pairs reverse, never the pairs' own shape), referenced not
//     copied. A kept arrival seats nothing; an unseen one never
//     invents its pair. The light's fuel, pinned by test.
//   - The mirror rule holds: rows, counts, stamps — the word KILL
//     never appears, even when a turnaround rides a tenure reset.

export interface TurnaroundEdge {
  aId: string; // the delivering row (the predecessor flip's row)
  aName: string;
  bId: string; // the turnaround row (the return flip's row)
  bName: string;
  count: number; // changed minds this directed edge delivered
  lastAt: string | null; // the newest delivery's return-flip stamp
  /** THE DELIVERY'S SEATS (R142): every delivery's own two flips — the
   *  delivering predecessor and the changed-mind return — one ADJACENT
   *  PAIR per delivery (deliverer first), the pairs in the TAIL's
   *  order (chronological). The flips are the input's own objects,
   *  referenced not copied. A kept arrival seats nothing (no edge
   *  exists); the light's fuel. */
  seats: BoardFlip[];
}

export interface TurnaroundEdgeRead {
  edges: TurnaroundEdge[]; // count desc, aName asc, bName asc
  strongest: TurnaroundEdge | null; // edges[0] when any edge exists
  handed: number; // turnarounds delivered by a handoff
  kept: number; // turnarounds grown at home (the row kept its turn)
  unseen: number; // turnarounds with no predecessor — 0 by construction, the honesty's guard
  total: number; // every changed mind the tail holds (handed + kept + unseen)
  line: string; // the read's own voice, self-quoting
}

/** turnaroundEdges — which directed edges carried the changed minds in. */
export function turnaroundEdges(flips: BoardFlip[]): TurnaroundEdgeRead {
  const rev = reversals(flips);

  // The return flips' seats in the input's own order — the entries
  // name (id, at); the tail's order names the predecessor.
  const seatIndex = new Map<string, number>();
  for (let i = 0; i < flips.length; i++) seatIndex.set(`${flips[i]!.id}|${flips[i]!.at}`, i);

  const acc = new Map<
    string,
    {
      aId: string;
      aName: string;
      bId: string;
      bName: string;
      count: number;
      lastAt: string | null;
      seats: BoardFlip[][]; // accumulated NEWEST-FIRST (the walk's own order), one pair per delivery
    }
  >();
  let handed = 0;
  let kept = 0;
  let unseen = 0;

  for (const e of rev.reversals) {
    const idx = seatIndex.get(`${e.id}|${e.at}`);
    if (idx === undefined || idx === 0) {
      unseen += 1; // no predecessor in the tail — said, never invented
      continue;
    }
    const prev = flips[idx - 1]!;
    if (prev.id === e.id) {
      kept += 1; // the row kept its own turn and changed its mind at home
      continue;
    }
    handed += 1;
    const key = `${prev.id}>${e.id}`;
    const cur = acc.get(key);
    if (cur) {
      cur.count += 1;
      // The entries ride NEWEST-FIRST (reversals' own contract) — the
      // FIRST write is the newest delivery; the later writes are older.
      if (cur.lastAt === null) cur.lastAt = e.at;
      cur.seats.push([prev, flips[idx]!]);
    } else {
      acc.set(key, {
        aId: prev.id,
        aName: prev.name,
        bId: e.id,
        bName: e.name,
        count: 1,
        lastAt: e.at,
        // The delivery's own pair — the input's own objects,
        // referenced not copied (the light's fuel).
        seats: [[prev, flips[idx]!]],
      });
    }
  }

  // The pairs leave the walk NEWEST-FIRST; the tail's order is the
  // honest reading order (chronological). Reversing the PAIRS — never
  // the flat array — keeps each pair's own shape (deliverer first,
  // changed mind second) while the pairs themselves ride oldest-first.
  const edges: TurnaroundEdge[] = [...acc.values()]
    .map((v) => ({
      aId: v.aId,
      aName: v.aName,
      bId: v.bId,
      bName: v.bName,
      count: v.count,
      lastAt: v.lastAt,
      seats: v.seats.slice().reverse().flat(),
    }))
    .sort(
      (x, y) => y.count - x.count || x.aName.localeCompare(y.aName) || x.bName.localeCompare(y.bName),
    );

  const timeOf = (at: string | null) => {
    if (!at) return '—';
    return at.includes('T') ? at.slice(11, 19) : at;
  };
  let line: string;
  if (flips.length < 2) {
    line = 'the tail holds no delivery to read — the read waits for a second flip';
  } else if (rev.reversals.length === 0) {
    line = `the tail holds no changed mind — no delivery to read over ${flips.length} flip${flips.length === 1 ? '' : 's'}`;
  } else {
    const s = edges[0];
    const strongClause = s
      ? `; the strongest delivery: ${s.aName} → ${s.bName} carried ${s.count} changed mind${s.count === 1 ? '' : 's'}, last @ ${timeOf(s.lastAt)} UTC`
      : '';
    const unseenClause = unseen > 0 ? `; ${unseen} arrived unseen (no predecessor — said, never invented)` : '';
    line = `${handed} of ${rev.reversals.length} changed mind${rev.reversals.length === 1 ? '' : 's'} arrived by handoff, ${kept} grew at home (the row kept its own turn)${strongClause}${unseenClause}`;
  }

  return {
    edges,
    strongest: edges[0] ?? null,
    handed,
    kept,
    unseen,
    total: rev.reversals.length,
    line,
  };
}

// — R142 · THE UNRULED TAIL — the shape below the rungs.
//
// The quiet ladder (R136) names its N longest quiets — the RULED
// rungs the lane itself speaks (the shared ground rides them too).
// Every quiet the bound leaves unnamed has never had a read of its
// own: THE UNRULED TAIL is the ladder's complement — the quiets
// below the rungs, given their own shape. The question the read
// answers: does the tail's silence concentrate in the named rungs,
// or does it hide below them? A ladder that names 5 of 47 quiets
// has been showing the crest of the silence; the shape below is the
// news.
//
// THE SHAPE the read gives:
//   - the census: total (the tail's WHOLE readable gap count, never
//     hidden), ruled (the rungs the ladder names), unruled (the
//     complement), and the minutes' share — ruledMin + unruledMin is
//     the tail's whole quiet time, and the share below is said
//     outright (a percentage the lane can quote against the ladder's
//     own).
//   - the BELOW ladder: the unruled quiets themselves, longest-first
//     by the ladder's own sort (ties keep input order) — the shape
//     below the rungs has a face, and its biggest is the first.
//   - the row census: the distinct rows opening or ending an
//     unruled quiet, and how many of the unruled are SELF-KEPT
//     (opener === ender — the shared ground's own discipline,
//     riding along).
//
// THE HONESTY RULES:
//   - The read COMPOSES on gapsOf's own gaps and the ladder's own
//     sort (min desc, ties keep input order — the first occurrence
//     wins): the ruled/unruled split is exactly quietLadder's slice,
//     so the two reads can never disagree about who is ruled.
//   - The asked n is a DISPLAY bound, not an arithmetic one. When
//     the tail holds fewer gaps than n, ALL are ruled and the read
//     says so plainly — the shape below is empty, honest, not
//     invented. The total is never hidden either way.
//   - Broken chains are SAID (broken carried up), never bridged.
//   - Purity: the input is never mutated; re-derivation is
//     byte-identical. The line names ROWS, STAMPS, and MINUTES —
//     the mirror rule holds.

export interface UnruledRead {
  total: number; // the tail's WHOLE readable gap count
  ruled: number; // the ladder's rungs named (≤ asked)
  unruled: number; // the complement below the rungs
  ruledMin: number; // summed minutes of the rungs
  unruledMin: number; // summed minutes below the rungs
  below: LedgerGap[]; // the unruled quiets, longest-first (the ladder's own sort)
  rows: number; // distinct rows opening or ending an unruled quiet
  selfKept: number; // unruled quiets opened AND ended by one row
  broken: number; // said, not bridged
  asked: number; // the n the caller asked for
  line: string; // the read's own voice, self-quoting
}

/** ladderSplit — THE shared slice: the gaps decorated by input index,
 *  sorted min desc (ties keep input order — the first occurrence
 *  wins), cut at the asked n. quietLadder's rungs, unruledTail's
 *  ruled/below, and unruledRows' below all ride THIS one helper, so
 *  the three reads can never disagree about who is ruled.
 *  R145 · THE INDEXES: the slice also carries the below's INPUT-order
 *  indexes (belowIdx) — the display ladder is min desc, but the
 *  CENSUS reads (lastAt, seats, first-wins ties) need the gaps' own
 *  order. Riding the indexes keeps the membership identical (never
 *  disagree about who is below) while the iteration order becomes the
 *  input's own — the real order-vs-sort bug the r145 suite caught in
 *  unruledRows' lastAt (the last write was the LONGEST quiet's ender,
 *  not the newest stamp), fixed at the slice so every rider inherits
 *  the fix. */
function ladderSplit(gaps: LedgerGap[], n: number): { ruled: LedgerGap[]; below: LedgerGap[]; belowIdx: number[] } {
  const decorated = gaps.map((g, i) => ({ g, i }));
  decorated.sort((x, y) => y.g.min - x.g.min || x.i - y.i);
  const cut = Math.max(0, n);
  return {
    ruled: decorated.slice(0, cut).map(({ g }) => g),
    below: decorated.slice(cut).map(({ g }) => g),
    belowIdx: decorated.slice(cut).map(({ i }) => i).sort((a, b) => a - b),
  };
}

/** unruledTail — the quiets the ladder does not name, given their own shape. */
export function unruledTail(flips: BoardFlip[], n = 5): UnruledRead {
  const { gaps, broken } = gapsOf(flips);
  const { ruled: ruledPart, below: unruledPart } = ladderSplit(gaps, n);

  let ruledMin = 0;
  for (const g of ruledPart) ruledMin += g.min;
  let unruledMin = 0;
  for (const g of unruledPart) unruledMin += g.min;
  const below = unruledPart;

  // The row census over the unruled (input order — the last write is
  // the newest stamp). The self-kept quiet is ONE row's involvement,
  // counted once — the shared ground's own discipline.
  const rowAcc = new Map<string, string>();
  let selfKept = 0;
  for (const g of unruledPart) {
    if (g.fromFlip.id === g.toFlip.id) {
      selfKept += 1;
      rowAcc.set(g.fromFlip.id, g.fromFlip.name);
      continue;
    }
    rowAcc.set(g.fromFlip.id, g.fromFlip.name);
    rowAcc.set(g.toFlip.id, g.toFlip.name);
  }

  const fmt = (min: number) => (min >= 100 ? Math.round(min) : min.toFixed(1));
  const timeOf = (at: string) => (at.includes('T') ? at.slice(11, 19) : at);
  let line: string;
  if (flips.length < 2) {
    line = 'the tail holds no quiet below the rungs — the read waits for a second flip';
  } else if (gaps.length === 0) {
    line = `the tail holds no readable gap over ${flips.length} flip${flips.length === 1 ? '' : 's'} — nothing to rule, nothing waits below`;
  } else if (unruledPart.length === 0) {
    line = `the ladder names all ${gaps.length} of the tail's quiet${gaps.length === 1 ? '' : 's'} — nothing waits below the rungs${broken > 0 ? ` (${broken} chain${broken === 1 ? '' : 's'} broken by an unreadable stamp, said not bridged)` : ''}`;
  } else {
    const pct = ruledMin + unruledMin > 0 ? Math.round((unruledMin / (ruledMin + unruledMin)) * 100) : 0;
    const biggest = below[0]!;
    const selfClause = selfKept > 0 ? `, ${selfKept} self-kept` : '';
    const brokenClause = broken > 0
      ? `; ${broken} chain${broken === 1 ? '' : 's'} broken by an unreadable stamp, said not bridged`
      : '';
    line = `the ladder names ${ruledPart.length} of the tail's ${gaps.length} quiet${gaps.length === 1 ? '' : 's'} — the ${unruledPart.length} below hold ${fmt(unruledMin)}′ of ${fmt(ruledMin + unruledMin)}′ (${pct}%), the biggest unnamed ${fmt(biggest.min)}′ ended by ${biggest.toFlip.name} @ ${timeOf(biggest.toFlip.at)} UTC; ${rowAcc.size} row${rowAcc.size === 1 ? '' : 's'} keep the unnamed silence${selfClause}${brokenClause}`;
  }

  return {
    total: gaps.length,
    ruled: ruledPart.length,
    unruled: unruledPart.length,
    ruledMin,
    unruledMin,
    below,
    rows: rowAcc.size,
    selfKept,
    broken,
    asked: n,
    line,
  };
}

// — R143 · THE UNRULED ROWS — who owns the unnamed silence.
//
// The quiet's company (R139) read the WHOLE tail's quiets — every
// directed pair the silence ever hung on. The unruled tail (R142)
// split the tail into the rungs and the BELOW, and found the news:
// the silence hides below the rungs (78% of the minutes at depth
// 200, 134 of 193 quiets self-kept). The composition's own question
// has never been asked: of the quiets BELOW the rungs — the unnamed
// ones — which DIRECTED row pairs own them? The company read over
// the whole tail cannot answer (its strongest pair may own only
// ruled quiets); the unruled tail counts the below but does not
// name its owners. THE UNRULED ROWS is the quiet-company read
// applied to the ladder's own complement — the below's ownership
// given its face.
//
// WHY THE BELOW: the R142 handover's own observation — the kept
// silences concentrate below the rungs, so the kept story and the
// unruled story may be the same story. If the below's ownership is
// the self-kept rows' own monopoly, the read says so; if a directed
// pair quietly owns the unnamed silence, the read names it.
//
// THE HONESTY RULES:
//   - The read COMPOSES on gapsOf's own gaps and rides the SAME
//     shared slice helper as the unruled tail (ladderSplit — min
//     desc, ties keep input order, cut at the asked n): the two
//     reads can never disagree about who is below, and the asked n
//     stays a display bound, never an arithmetic one.
//   - The direction is LOAD-BEARING (the handoff's own grammar):
//     A opening → B ending is a different company than B → A. The
//     SELF-KEPT quiet (opener === ender) is its own company — a row
//     keeping its own silence — and counts once in selfKept.
//   - The seats are the below light's fuel (R143's own THE BELOW
//     LIT): the opener and ender of EACH owned below quiet, input
//     order, opener first — REFERENCED, not copied (the gaps' own
//     flip objects; a self-kept quiet seats its ROW twice — opener
//     and ender are two flips of one row, the light dedups by seat
//     key).
//   - Broken chains (an unreadable stamp splitting the tail) are
//     SAID, never bridged. Purity: the input is never mutated;
//     re-derivation is byte-identical. The line names ROWS, STAMPS,
//     and MINUTES — the mirror rule holds.
//   - Ordering: count desc, then openerName asc, then enderName asc
//     — the quiet-company read's own convention, applied below.

export interface UnruledPair {
  openerId: string;
  openerName: string;
  enderId: string;
  enderName: string;
  count: number; // the BELOW quiets this directed pair owns
  totalMin: number; // the pair's summed below minutes
  longestMin: number; // the pair's longest below quiet
  lastAt: string | null; // the newest ender stamp, input order
  /** R143 · the below light's fuel: the opener and ender of EACH
   *  owned below quiet, input order (a self-kept quiet seats its ROW
   *  twice — opener and ender are two flips of one row; the light
   *  dedups by seat key). Referenced, not copied. */
  seats: BoardFlip[];
}

export interface UnruledRowsRead {
  pairs: UnruledPair[]; // count desc, openerName asc, enderName asc
  strongest: UnruledPair | null; // pairs[0] when any pair exists
  below: number; // the unruled quiets (= unruledTail's complement for the same n)
  companies: number; // distinct directed pairs owning at least one below quiet
  selfKept: number; // below quiets opened AND ended by one row
  rows: number; // distinct rows opening or ending a below quiet
  broken: number; // said, not bridged
  asked: number; // the n the ladder rides (the display bound)
  line: string; // the read's own voice, self-quoting
}

/** unruledRows — the quiet-company read applied to the ladder's
 *  complement: which directed row pairs own the quiets BELOW the
 *  rungs (the unnamed silence), with each pair's own seats as the
 *  light's fuel. */
export function unruledRows(flips: BoardFlip[], n = 5): UnruledRowsRead {
  const { gaps, broken } = gapsOf(flips);
  const { below, belowIdx } = ladderSplit(gaps, n);

  const acc = new Map<
    string,
    {
      openerId: string;
      openerName: string;
      enderId: string;
      enderName: string;
      count: number;
      totalMin: number;
      longestMin: number;
      lastAt: string | null;
      seats: BoardFlip[];
    }
  >();
  let selfKept = 0;
  const rowAcc = new Map<string, string>();

  // R145 · the INPUT-order ride: the census iterates the slice's own
  // indexes (identical membership, the gaps' own order) — lastAt is
  // the newest stamp and the seats ride input order, as the contract
  // always said (the r145 suite caught the min-desc drift).
  for (const gi of belowIdx) {
    const g = gaps[gi]!;
    const opener = g.fromFlip;
    const ender = g.toFlip;
    if (opener.id === ender.id) selfKept += 1;
    rowAcc.set(opener.id, opener.name);
    rowAcc.set(ender.id, ender.name);
    const key = `${opener.id}>${ender.id}`;
    const cur = acc.get(key);
    if (cur) {
      cur.count += 1;
      cur.totalMin += g.min;
      if (g.min > cur.longestMin) cur.longestMin = g.min;
      cur.lastAt = ender.at; // input order: the last occurrence is the newest
      cur.seats.push(opener, ender); // the light's fuel: both seats
    } else {
      acc.set(key, {
        openerId: opener.id,
        openerName: opener.name,
        enderId: ender.id,
        enderName: ender.name,
        count: 1,
        totalMin: g.min,
        longestMin: g.min,
        lastAt: ender.at,
        seats: [opener, ender],
      });
    }
  }

  const pairs: UnruledPair[] = [...acc.values()].sort(
    (x, y) =>
      y.count - x.count ||
      x.openerName.localeCompare(y.openerName) ||
      x.enderName.localeCompare(y.enderName),
  );

  const minStr = (m: number) => (m >= 100 ? String(Math.round(m)) : m.toFixed(1));
  const timeOf = (at: string) => (at.includes('T') ? at.slice(11, 19) : at);
  let line: string;
  if (flips.length < 2) {
    line = 'the tail holds no quiet below the rungs — the below keeps no company yet';
  } else if (gaps.length === 0) {
    line = `the tail holds no readable gap over ${flips.length} flips — the below has no rows to name`;
  } else if (pairs.length === 0) {
    line = `the ladder names all ${gaps.length} of the tail's quiet${gaps.length === 1 ? '' : 's'} — the below keeps no company${broken > 0 ? ` (${broken} chain${broken === 1 ? '' : 's'} broken by an unreadable stamp, said not bridged)` : ''}`;
  } else {
    const s = pairs[0]!;
    const selfClause = selfKept > 0 ? `, ${selfKept} self-kept` : '';
    const brokenClause = broken > 0
      ? `; ${broken} chain${broken === 1 ? '' : 's'} broken by an unreadable stamp, said not bridged`
      : '';
    const rhythmClause = s.count >= 2
      ? ` — a rhythm: the same two rows framing the unnamed silence ${s.count} time${s.count === 1 ? '' : 's'}`
      : '';
    line = `${s.openerName} → ${s.enderName} own the unnamed silence — ${s.count} below quiet${s.count === 1 ? '' : 's'}, ${minStr(s.totalMin)}′ total, the longest ${minStr(s.longestMin)}′, last ended @ ${timeOf(s.lastAt ?? '')} UTC${rhythmClause}; ${pairs.length} compan${pairs.length === 1 ? 'y' : 'ies'} over ${below.length} below quiet${below.length === 1 ? '' : 's'}, ${rowAcc.size} row${rowAcc.size === 1 ? '' : 's'} keeping them${selfClause}${brokenClause}`;
  }

  return {
    pairs,
    strongest: pairs[0] ?? null,
    below: below.length,
    companies: pairs.length,
    selfKept,
    rows: rowAcc.size,
    broken,
    asked: n,
    line,
  };
}

// — R144 · THE KEPT STORY — the silence a row keeps with itself, and
// the changed minds that end it.
//
// The turnaround's edges (R141) split the changed minds by DELIVERY:
// handed (another row's flip carried the mind in) vs KEPT (the row
// kept its own turn — the mind grew at home). The unruled tail (R142)
// and its rows (R143) found the below's silence mostly SELF-KEPT —
// the R143 headline read 15 of 17 unnamed quiets as one row keeping
// its own company. The handover's own observation: the kept story
// and the unruled story may be the same story. THE KEPT STORY makes
// the composition precise — and the precision is structural:
//
//   a kept turnaround's whole-tail predecessor is the SAME row's
//   flip, so the gap the return flip ends is a SELF-KEPT quiet. The
//   converse is the news: not every self-kept quiet ends in a
//   changed mind. So the read asks, of the tail's self-kept quiets:
//   which end in the row TAKING ITS OWN WORD BACK (a kept ender —
//   the strongest kind of homecoming), and which end in ordinary
//   motion? And what is the CADENCE — the median interval between a
//   row's homecomings (its self-kept enders)?
//
// THE HONESTY RULES:
//   - The read COMPOSES on pinned primitives only: the self-kept
//     quiets come from gapsOf's own gaps (opener.id === ender.id);
//     the changed minds come from reversals' own entries (the return
//     flips, by id+stamp). No clock of its own — the cadence's
//     intervals ride the stamps the gaps already vetted.
//   - The join is by the motion line's own identity (id|at): a
//     self-kept quiet ENDS IN A CHANGED MIND when its ender flip is
//     some reversal's return flip — kind irrelevant (a round trip
//     and a reprise are both homecomings).
//   - The cross-read discipline: on a clean tail (every stamp
//     readable) keptEnders === turnaroundEdges's kept count — the
//     two reads can never disagree about who grew at home. (A broken
//     chain can part them: the edge read uses ids alone, the gap
//     read needs the stamps — so the broken count rides up, said not
//     bridged, and the pin holds on clean fixtures.)
//   - The seats are the kept light's fuel (R144's own light): teal
//     group — the row's self-kept quiets' opener+ender per quiet
//     (a self-kept quiet seats its ROW twice, two flips of one row);
//     violet group — the kept ENDERS only (the changed minds at
//     home). Referenced, not copied.
//   - The cadence is the row's own: the median interval between
//     consecutive self-kept ENDER stamps (even counts average the
//     two middles). Fewer than two homecomings → null, said plainly.
//   - Ordering: keptEnders desc, then selfKept desc, then name asc,
//     then id asc — the house convention's own extension. The row's
//     label rides the name-asc orientation (the chains' own).
//   - Broken chains SAID, never bridged. Purity: the input never
//     mutates; re-derivation is byte-identical. The line names ROWS,
//     STAMPS, and MINUTES — the mirror rule holds.

/** R149 · THE FRESH HANDS' arithmetic: the NEWEST stamp across a
 *  census's rows (max by Date.parse — CHRONOLOGICAL, never
 *  lexicographic: a '+02:00' offset and a 'Z' suffix can disagree
 *  as strings while agreeing as clocks, and only the clock is the
 *  truth). A row needs no rhythm to ride — a single ender's stamp
 *  is a freshness the cadence never had. Null when no row carries
 *  a readable stamp — the honest absence. */
function newestStampOf(stamps: (string | null)[]): string | null {
  let best: string | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const s of stamps) {
    if (!s) continue;
    const ms = Date.parse(s);
    if (!Number.isFinite(ms)) continue;
    if (best === null || ms > bestMs) {
      best = s;
      bestMs = ms;
    }
  }
  return best;
}

/** R150 · WHO CAME HOME: the freshness read WITH its owner — the
 *  newest stamp and the NAME of the row whose lastAt carries it, one
 *  pass, one max, no second derivation (the stamp and the name can
 *  never disagree about who is freshest). Ties read FIRST-SEEN on the
 *  census's own order (the strictly-greater comparison keeps the
 *  earlier row — a deterministic, order-loyal rule). A row needs no
 *  rhythm to own the freshness — a single-ender row's lone stamp
 *  rides with its name. Null when no row carries a readable stamp. */
function newestStampOwned<T extends { lastAt: string | null; name: string }>(
  rows: T[],
): { at: string; by: string } | null {
  let best: { at: string; by: string } | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const r of rows) {
    if (!r.lastAt) continue;
    const ms = Date.parse(r.lastAt);
    if (!Number.isFinite(ms)) continue;
    if (best === null || ms > bestMs) {
      best = { at: r.lastAt, by: r.name };
      bestMs = ms;
    }
  }
  return best;
}

/** R156 · THE SHARED HAND: the freshness judgment as a HOUSE READ —
 *  the four-way law R155 wrote for the kept rows, lifted out of
 *  keptStory so every surface that judges recency speaks the SAME
 *  vocabulary from the SAME arithmetic (one law, many faces). The
 *  judgment, verbatim: delta 0 (or behind — a stamp at or past the
 *  freshest) reads 'freshest', the degree the delta never argues
 *  with; within ONE yardstick reads 'in-rhythm'; beyond it reads
 *  'drifted'; NO yardstick (the census holds no rhythm of its own)
 *  or an unreadable delta reads null — the hand never guesses. The
 *  yardstick is always the judged census's OWN rhythm (the kept
 *  pool's pooled median, the tail's median gap), never an invented
 *  constant. Pure: no clock, no mutation — delta in, word out. */
export type FreshnessHand = 'freshest' | 'in-rhythm' | 'drifted';

export function classifyFreshness(
  deltaMin: number,
  yardstickMin: number | null,
): FreshnessHand | null {
  if (!Number.isFinite(deltaMin)) return null;
  if (deltaMin <= 0) return 'freshest';
  if (yardstickMin === null || !Number.isFinite(yardstickMin) || yardstickMin < 0) return null;
  return deltaMin <= yardstickMin ? 'in-rhythm' : 'drifted';
}

export interface KeptRow {
  id: string;
  name: string;
  selfKept: number; // the row's self-kept quiets in the tail
  keptEnders: number; // of those, the ones whose ender is a changed mind
  totalMin: number; // the row's summed self-kept minutes
  keptMin: number; // the minutes of the turnaround-ended quiets
  longestMin: number; // the row's longest self-kept quiet
  homecomingMin: number | null; // the median interval between the row's self-kept enders (null: fewer than 2)
  lastAt: string | null; // the newest self-kept ender stamp, input order
  /** R154 · THE SELF-COUNTED ROW: this row's own interval count in
   *  the pooled census — the keeper's arithmetic, said per row (the
   *  SAME count the pool's keeper scan reads, set in the same pass,
   *  no second derivation). Null when the row feeds no intervals
   *  (fewer than two enders — the honest absence rides the row's own
   *  rhythm, exactly like its homecomingMin). The rows' non-null
   *  counts sum to the pool's n (homecomingIntervals) — the census's
   *  own ledger, each row says its share. */
  pooledCount: number | null;
  /** R155 · THE ROWS' FRESHNESS HAND: this row's own recency judged
   *  against the census — 'freshest' when the row's lastAt IS the
   *  census's freshest homecoming (delta 0; a same-instant tie reads
   *  freshest too — the R150 chip still names THE owner first-seen,
   *  the hand says the degree), 'in-rhythm' when it sits within ONE
   *  pooled median of the freshest (the census's own rhythm is the
   *  yardstick, never an invented constant), 'drifted' when it sits
   *  beyond it. Null when there is no yardstick (no pooled rhythm —
   *  fewer than one interval anywhere) or a stamp is unreadable —
   *  the hand never guesses. */
  freshness: 'freshest' | 'in-rhythm' | 'drifted' | null;
  /** R144 · the kept light's teal fuel: the opener and ender of EACH
   *  self-kept quiet, input order (a self-kept quiet seats its ROW
   *  twice — two flips of one row). Referenced, not copied. */
  quietSeats: BoardFlip[];
  /** R144 · the kept light's violet fuel: the kept enders themselves
   *  (the changed minds at home), input order. Referenced, not
   *  copied. */
  keptSeats: BoardFlip[];
}

export interface KeptStoryRead {
  rows: KeptRow[]; // keptEnders desc, selfKept desc, name asc, id asc
  strongest: KeptRow | null; // rows[0] when any row exists
  selfKept: number; // the tail's WHOLE self-kept quiet count
  keptEnders: number; // the self-kept quiets ended by a changed mind
  rowsCount: number; // distinct rows keeping their own silence
  totalMin: number; // the tail's summed self-kept minutes
  turnarounds: number; // the tail's whole changed-mind count (reversals' own)
  /** R147 · THE HOMECOMING LADDER: the SLOWEST homecoming cadence in
   *  the whole census (the max of the rows' homecomingMin) — the kept
   *  chips' mini-bar's stable scale, engine-owned (all rows, not just
   *  the rendered three). Null when no row has come home twice. */
  slowestHomecomingMin: number | null;
  /** R147 · the census's POOLED homecoming rhythm: every row's own
   *  intervals (each computed over that row's time-sorted ender
   *  stamps) pooled into one census and medianed — the kept story's
   *  cadence across ALL rows. Null when fewer than two intervals
   *  exist anywhere. */
  pooledHomecomingMin: number | null;
  /** R147 · the pooled census's n (the count of intervals that rode),
   *  said plainly — a median without its n hides the read's own reach. */
  homecomingIntervals: number;
  /** R149 · THE FRESH HAND: the census's freshest homecoming — the
   *  newest stamp across ALL rows' lastAt (chronological max, not the
   *  strongest row's, not the rendered three's; a rhythmless row's
   *  stamp rides). Tempo says how OFTEN, this says how RECENTLY.
   *  Null when no row carries a stamp. */
  newestHomeAt: string | null;
  /** R150 · WHO CAME HOME: the NAME of the row whose lastAt IS the
   *  freshest homecoming — the freshness read with its owner, one
   *  pass, one max (the name can never disagree with the stamp about
   *  who is freshest). First-seen wins a tie, on the census's own
   *  order. No rhythm required — a single-ender row can own the
   *  freshness. Null when no row carries a stamp. */
  newestHomeBy: string | null;
  /** R151 · THE POOL'S KEEPER: the NAME of the row feeding the most
   *  intervals into the pooled census — whose rhythm shapes the median
   *  most. Counts INTERVALS per row (a row's enders minus its one
   *  opener each), never stamps; first-seen wins a tie, on the
   *  census's own order (keptEnders desc). Present exactly when the
   *  pool is — the keeper rides the pooled read's own existence, no
   *  pool, no keeper, the honest absence together. */
  pooledHomecomingBy: string | null;
  /** R152 · THE POOL'S SECOND VOICE: the NAME of the row feeding the
   *  SECOND-most intervals into the pooled census — the keeper's own
   *  seat excluded, so the census's next voice rides beside its first.
   *  First-seen wins a tie, on the census's own order; null when
   *  fewer than two rows contributed intervals (a pool of one has no
   *  second voice — the honest absence, like the keeper's own). */
  pooledHomecomingSecond: string | null;
  /** R153 · THE COUNTED VOICES: each named voice says HOW MUCH —
   *  the keeper's interval count and the second voice's own, riding
   *  the same pass that named them (the keeper's count is the
   *  census's heaviest share, the second's the next). Null exactly
   *  when their voice is null — a count never outruns its name. */
  pooledHomecomingByCount: number | null;
  pooledHomecomingSecondCount: number | null;
  broken: number; // said, not bridged
  asked: number; // the n the caller asked for (a display bound)
  line: string; // the read's own voice, self-quoting
}

/** keptStory — the self-kept quiets, and which of them end in the row
 *  taking its own word back (the kept enders), with each row's
 *  homecoming cadence and its seats as the light's fuel. */
export function keptStory(flips: BoardFlip[], n = 5): KeptStoryRead {
  const { gaps, broken } = gapsOf(flips);
  const rev = reversals(flips);

  // The changed minds' return flips, by the motion line's identity.
  const turnKeys = new Set(rev.reversals.map((e) => `${e.id}|${e.at}`));

  interface Acc {
    id: string;
    name: string;
    selfKept: number;
    keptEnders: number;
    totalMin: number;
    keptMin: number;
    longestMin: number;
    enders: string[]; // the row's self-kept ender stamps, input order
    lastAt: string | null;
    quietSeats: BoardFlip[];
    keptSeats: BoardFlip[];
  }
  const acc = new Map<string, Acc>();

  for (const g of gaps) {
    const opener = g.fromFlip;
    const ender = g.toFlip;
    if (opener.id !== ender.id) continue; // the kept story reads the self-kept only
    let cur = acc.get(opener.id);
    if (!cur) {
      cur = {
        id: opener.id,
        name: opener.name,
        selfKept: 0,
        keptEnders: 0,
        totalMin: 0,
        keptMin: 0,
        longestMin: 0,
        enders: [],
        lastAt: null,
        quietSeats: [],
        keptSeats: [],
      };
      acc.set(opener.id, cur);
    }
    if (opener.name < cur.name) cur.name = opener.name; // the chains' name-asc orientation
    cur.selfKept += 1;
    cur.totalMin += g.min;
    if (g.min > cur.longestMin) cur.longestMin = g.min;
    cur.lastAt = ender.at; // input order: the last write is the newest
    cur.quietSeats.push(opener, ender); // the teal fuel: both seats
    cur.enders.push(ender.at);
    if (turnKeys.has(`${ender.id}|${ender.at}`)) {
      cur.keptEnders += 1;
      cur.keptMin += g.min;
      cur.keptSeats.push(ender); // the violet fuel: the changed mind itself
    }
  }

  // R147 · THE HOMECOMING LADDER's pooled census: each row's own
  // intervals (computed over that row's TIME-sorted stamps — the sort
  // is load-bearing, the r144 suite's interleaved tails pin it) ride
  // into one pool; the census's median reads the pool. A row's stamps
  // and another row's stamps are never consecutive — the pool joins
  // INTERVALS, not stamps.
  const pooledIntervals: number[] = [];
  // R151 · THE POOL'S KEEPER's ledger: each row's own interval count,
  // taken where the pool itself is filled — the keeper reads the same
  // arithmetic, never a second derivation.
  const pooledCounts = new Map<string, number>();

  const rows: KeptRow[] = [...acc.values()]
    .map((v) => {
      // The homecoming cadence: the median interval between the row's
      // consecutive self-kept enders (even counts average the two
      // middles). The stamps vetted the gaps — they parse.
      let homecomingMin: number | null = null;
      // R154 · the row's own pooled share, taken where the intervals
      // exist — null exactly when homecomingMin is null.
      let pooledCount: number | null = null;
      if (v.enders.length >= 2) {
        const ms = v.enders.map((at) => Date.parse(at)).sort((a, b) => a - b);
        const intervals: number[] = [];
        for (let i = 1; i < ms.length; i++) intervals.push((ms[i]! - ms[i - 1]!) / 60000);
        intervals.sort((a, b) => a - b);
        const mid = Math.floor(intervals.length / 2);
        homecomingMin =
          intervals.length % 2 === 1
            ? intervals[mid]!
            : (intervals[mid - 1]! + intervals[mid]!) / 2;
        pooledIntervals.push(...intervals); // the ladder's pool rides the rows' own arithmetic
        pooledCounts.set(v.id, intervals.length); // R151 · the keeper's count rides the same pass
        pooledCount = intervals.length; // R154 · the row says its own share, same scan
      }
      return {
        id: v.id,
        name: v.name,
        selfKept: v.selfKept,
        keptEnders: v.keptEnders,
        totalMin: v.totalMin,
        keptMin: v.keptMin,
        longestMin: v.longestMin,
        homecomingMin,
        pooledCount,
        freshness: null, // R155 · the hand is assigned after the pool's median exists
        lastAt: v.lastAt,
        quietSeats: v.quietSeats,
        keptSeats: v.keptSeats,
      };
    });

  rows.sort(
    (x, y) =>
      y.keptEnders - x.keptEnders ||
      y.selfKept - x.selfKept ||
      x.name.localeCompare(y.name) ||
      x.id.localeCompare(y.id),
  );

  let selfKeptTotal = 0;
  let keptTotal = 0;
  let totalMin = 0;
  for (const r of rows) {
    selfKeptTotal += r.selfKept;
    keptTotal += r.keptEnders;
    totalMin += r.totalMin;
  }

  // R147 · the census's own reads: the pooled median (the ladder's
  // rhythm across ALL rows) and the slowest row (the kept chips'
  // mini-bar's engine-owned scale — max over ALL rows, not just the
  // rendered three, the slowestCadenceMin pattern's own twin).
  pooledIntervals.sort((a, b) => a - b);
  const pMid = Math.floor(pooledIntervals.length / 2);
  const pooledHomecomingMin: number | null =
    pooledIntervals.length === 0
      ? null
      : pooledIntervals.length % 2 === 1
        ? pooledIntervals[pMid]!
        : (pooledIntervals[pMid - 1]! + pooledIntervals[pMid]!) / 2;
  const slowestHomecomingMin: number | null = rows.reduce<number | null>(
    (m, r) => (r.homecomingMin !== null && (m === null || r.homecomingMin > m) ? r.homecomingMin : m),
    null,
  );

  // R151 · THE POOL'S KEEPER + R152 · THE POOL'S SECOND VOICE: the
  // census's two heaviest contributors, NAMED — the keeper feeds the
  // most intervals, the second voice the next-most (the keeper's own
  // seat excluded, so a 1v1 tie names keeper AND second, and a 1/1/1
  // tie reads census order twice). First-seen wins every tie on the
  // census's own order (the strict '>' keeps the earlier); a pool of
  // fewer than two contributors names a keeper but no second — the
  // honest absence rides the count, never invented.
  let pooledHomecomingBy: string | null = null;
  let pooledHomecomingSecond: string | null = null;
  let pooledBest = 0;
  let secondBest = 0;
  let pooledKeeperId: string | null = null;
  for (const r of rows) {
    const c = pooledCounts.get(r.id) ?? 0;
    if (c > pooledBest) {
      pooledBest = c;
      pooledHomecomingBy = r.name;
      pooledKeeperId = r.id;
    }
  }
  if (pooledKeeperId !== null) {
    for (const r of rows) {
      if (r.id === pooledKeeperId) continue;
      const c = pooledCounts.get(r.id) ?? 0;
      if (c > secondBest) {
        secondBest = c;
        pooledHomecomingSecond = r.name;
      }
    }
  }
  // R153 · THE COUNTED VOICES: the names' own counts, from the same
  // scan — a voice and its count are inseparable (null together, and
  // the sum of the two counts never outruns the pool's n).
  const pooledHomecomingByCount = pooledHomecomingBy !== null ? pooledBest : null;
  const pooledHomecomingSecondCount = pooledHomecomingSecond !== null ? secondBest : null;

  // R149 · THE FRESH HAND: the census's newest stamp, over ALL rows
  // (the strongest row's own stamp has no seniority here — a
  // rhythmless row's single ender can be the freshest homecoming).
  // R150 · WHO CAME HOME: one pass now reads the stamp AND its
  // owner's name — the chip's recency and its who, inseparable.
  const freshestHome = newestStampOwned(rows);
  const newestHomeAt = freshestHome?.at ?? null;
  const newestHomeBy = freshestHome?.by ?? null;

  // R155 · THE ROWS' FRESHNESS HAND: the census's freshness
  // distributed to the rows — each row's lastAt judged against the
  // freshest homecoming, with the POOLED MEDIAN as the yardstick
  // (the census's own rhythm, never an invented constant). R156 ·
  // the judgment rides THE SHARED HAND (classifyFreshness) — the
  // same four-way law the house reads everywhere, keptStory adds
  // no arithmetic of its own anymore.
  const freshestMs = freshestHome ? Date.parse(freshestHome.at) : NaN;
  for (const r of rows) {
    if (!freshestHome || !r.lastAt) {
      r.freshness = null;
      continue;
    }
    const ms = Date.parse(r.lastAt);
    if (!Number.isFinite(freshestMs) || !Number.isFinite(ms)) {
      r.freshness = null;
      continue;
    }
    const deltaMin = (freshestMs - ms) / 60000;
    r.freshness = classifyFreshness(deltaMin, pooledHomecomingMin);
  }

  const minStr = (m: number) => (m >= 100 ? String(Math.round(m)) : m.toFixed(1));
  const timeOf = (at: string) => (at.includes('T') ? at.slice(11, 19) : at);
  let line: string;
  if (flips.length < 2) {
    line = 'the tail holds no silence of its own — the kept story waits for a second flip';
  } else if (rows.length === 0) {
    line = `the tail keeps no silence of its own over ${gaps.length} readable quiet${gaps.length === 1 ? '' : 's'} — the kept story's ground is empty${broken > 0 ? ` (${broken} chain${broken === 1 ? '' : 's'} broken by an unreadable stamp, said not bridged)` : ''}`;
  } else {
    const s = rows[0]!;
    const homeClause =
      s.homecomingMin !== null ? `, the homecomings median ${minStr(s.homecomingMin)}′ apart` : '';
    const poolClause =
      pooledHomecomingMin !== null && pooledIntervals.length >= 2
        ? `, every row's enders pool to a median ${minStr(pooledHomecomingMin)}′ apart (the census's own rhythm, ${pooledIntervals.length} intervals)`
        : '';
    const shareClause = selfKeptTotal > 0
      ? `${keptTotal} of the tail's ${selfKeptTotal} self-kept quiet${selfKeptTotal === 1 ? '' : 's'} end in a changed mind`
      : '';
    const brokenClause = broken > 0
      ? `; ${broken} chain${broken === 1 ? '' : 's'} broken by an unreadable stamp, said not bridged`
      : '';
    line = `${s.name} keeps its own silence and changes its mind at home — ${s.keptEnders} of its ${s.selfKept} self-kept quiet${s.selfKept === 1 ? '' : 's'} end${s.keptEnders === 1 ? 's' : ''} in a taken-back word (${minStr(s.keptMin)}′ of ${minStr(s.totalMin)}′${homeClause}); ${shareClause} across ${rows.length} row${rows.length === 1 ? '' : 's'}, ${minStr(totalMin)}′ of self-kept minutes${poolClause}${brokenClause}`;
  }

  return {
    rows,
    strongest: rows[0] ?? null,
    selfKept: selfKeptTotal,
    keptEnders: keptTotal,
    rowsCount: rows.length,
    totalMin,
    turnarounds: rev.reversals.length,
    slowestHomecomingMin,
    pooledHomecomingMin,
    homecomingIntervals: pooledIntervals.length,
    newestHomeAt,
    newestHomeBy,
    pooledHomecomingBy,
    pooledHomecomingSecond,
    pooledHomecomingByCount,
    pooledHomecomingSecondCount,
    broken,
    asked: n,
    line,
  };
}

// — R154 · THE MOVER LADDER, LIFTED + THE LADDER'S VERDICT — the
// digest's motion distribution, moved INTO the ledger.
//
// R153 rendered the ladder UI-side (the top three heaviest movers of
// the tail, share bars against the whole flip count). R154 lifts the
// arithmetic into the engine where the rest of the census lives —
// same single pass, same house order (count desc, name asc, id asc)
// — and the ladder now speaks its SHAPE: one word for how the tail's
// motion spreads across its movers, judged against the EVEN seat
// (1/k — what every mover would hold if the motion spread evenly).
//
//   solo      — one mover owns every flip (k = 1; the extreme shape,
//               whatever the count)
//   lopsided  — the top mover holds MORE than 1.5× its even seat
//   mixed     — the top leads without dominating (up to 1.5×)
//   even      — the top holds at most 1.25× its even seat (near-even)
//   null      — no flips, no movers, no shape to judge (the honest
//               absence, like every census before it)
//
// The ratio reads in whole counts — top·k/n, the topShare/evenShare
// quotient without the division — exact for the small integers the
// tails hold: no float drift at the 1.25 / 1.5 fences. A ratio of
// exactly 1.5 reads mixed (the fence is strict on lopsided), exactly
// 1.25 reads even (the fence is strict on mixed).

export interface MoverLadderEntry {
  id: string;
  name: string;
  count: number;
}

export interface MoverLadderRead {
  /** every distinct mover in the tail, the house order (count desc,
   *  name asc, id asc) — the k the verdict judges */
  movers: MoverLadderEntry[];
  /** the ladder's rendered rungs: the first three of movers */
  top: MoverLadderEntry[];
  /** the tail's whole flip count — the shares' denominator */
  flips: number;
  /** R154 · the distribution's one-word shape (solo | lopsided |
   *  mixed | even); null with no flips */
  verdict: 'solo' | 'lopsided' | 'mixed' | 'even' | null;
  /** the top mover's share of the tail (count/flips, 0..1); null
   *  with no flips */
  topShare: number | null;
  /** the even seat's share (1/k over k movers); null with no movers */
  evenShare: number | null;
}

export function moverLadder(flips: BoardFlip[]): MoverLadderRead {
  const counts = new Map<string, MoverLadderEntry>();
  for (const f of flips) {
    const cur = counts.get(f.id);
    if (cur) cur.count += 1;
    else counts.set(f.id, { id: f.id, name: f.name, count: 1 });
  }
  const movers = [...counts.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
  const n = flips.length;
  const k = movers.length;
  const top = movers.slice(0, 3);
  if (n === 0 || k === 0) {
    return { movers, top, flips: n, verdict: null, topShare: null, evenShare: null };
  }
  const leader = top[0]!;
  const topShare = leader.count / n;
  const evenShare = 1 / k;
  const ratio = (leader.count * k) / n; // topShare / evenShare, in whole counts
  const verdict =
    k === 1 ? 'solo' : ratio > 1.5 ? 'lopsided' : ratio > 1.25 ? 'mixed' : 'even';
  return { movers, top, flips: n, verdict, topShare, evenShare };
}

// — R145 · THE UNRULED TURNOVERS — the changed minds' share of the
// unnamed silence.
//
// The below's stories so far: the unruled tail (R142) counted the
// quiets the rungs leave unnamed; the unruled rows (R143) named the
// directed pairs that own them; the kept story (R144) read the
// self-kept quiets and which end in a taken-back word AT HOME. The
// below light's second face (R144) then PROVED the composition live:
// some of the below's seats are changed minds — the violet rode with
// the teal. What no read has COUNTED is the below's own turnover
// share: of the quiets below the rungs, how many end in a changed
// mind at all — and of those, how many minds grew at home (the quiet
// the row kept with itself) versus arrived by handoff (the quiet
// another row opened, the changed mind ending someone else's
// silence)?
//
// THE SHAPE the read gives:
//   - the census: the below's whole quiet count and minutes (the
//     shared slice's own below — never re-derived), the turnover
//     count and minutes, and the SHARE said outright (the pct of the
//     below's minutes a taken-back word ended).
//   - the kept/handed split: a turnover quiet whose opener is its own
//     ender (self-kept) grew at home; a turnover quiet whose opener
//     is another row arrived by handoff — the turnaround edges' own
//     grammar, seen through the gap's eyes.
//   - the enders' census: which rows' changed minds end the below,
//     each with its count, minutes, and newest stamp — the busiest
//     ender first.
//   - the longest turnover quiet: the biggest silence a changed mind
//     ended below the rungs.
//
// THE HONESTY RULES:
//   - The read COMPOSES on gapsOf's own gaps + ladderSplit (the ONE
//     shared slice) + reversals' own return flips: it can never
//     disagree with the unruled tail or the unruled rows about who is
//     below, nor with the turnarounds about who changed its mind.
//   - The join is by the motion line's identity (id|at): a below
//     quiet ENDS IN A CHANGED MIND when its ender flip is some
//     reversal's return flip — kind irrelevant (round trip and
//     reprise are both changed minds).
//   - The kept/handed split rides the GAP's own seats: opener.id ===
//     ender.id → grew at home; opener another row → arrived by
//     handoff. On a clean tail at n=0 (everything below) this agrees
//     with turnaroundEdges's own kept/handed split — the cross-read
//     pin (a broken chain can part them: the edge read needs no
//     stamps, the gap read does — said not bridged).
//   - The seats are the light's fuel (the family's own discipline):
//     per ender row, BOTH flips of each turnover quiet it ended
//     (input order, opener first) and the ender flips themselves —
//     REFERENCED, not copied.
//   - R146 · THE TURNOVER CADENCE: each ender row also carries the
//     median interval between its consecutive turnover-ender stamps
//     (the below-ending minds' own rhythm — a keptStory-style read
//     over the ender census). The stamps ride input order, the
//     intervals compute over the time-sorted stamps (the stamps
//     vetted the gaps — they parse); even counts average the two
//     middles. Fewer than two enders → null, the honest absence. The
//     read also carries the SLOWEST cadence in the whole census (the
//     max of the rows' cadenceMin) — the ender chips' cadence
//     mini-bar's stable scale, all rows not just the rendered three.
//   - Broken chains SAID, never bridged. Purity: the input never
//     mutates; re-derivation is byte-identical. The line names ROWS,
//     STAMPS, and MINUTES — the mirror rule holds.
//   - Ordering: count desc, then name asc, then id asc — the house
//     convention. The row's label rides the name-asc orientation
//     (the chains' own).

export interface TurnoverEnder {
  id: string;
  name: string;
  count: number; // below quiets this row's changed minds ended
  totalMin: number; // their summed minutes
  lastAt: string | null; // the newest ender stamp, input order
  /** R146 · THE TURNOVER CADENCE: the median interval between the
   *  row's consecutive turnover-ender stamps (the below-ending
   *  minds' own rhythm). Null when fewer than two enders — the
   *  honest absence, like the kept row's homecomingMin. */
  cadenceMin: number | null;
  /** R145 · the turnover light's teal fuel: BOTH flips of each
   *  turnover quiet this row's minds ended, input order (opener
   *  first). Referenced, not copied. */
  quietSeats: BoardFlip[];
  /** R145 · the turnover light's violet fuel: the ender flips
   *  themselves (the changed minds below). Referenced, not copied. */
  enderSeats: BoardFlip[];
}

export interface UnruledTurnoverRead {
  total: number; // the below's WHOLE quiet count (the shared slice's own)
  totalMin: number; // the below's summed minutes
  turnovers: number; // below quiets whose ender is a changed mind
  turnoverMin: number; // their summed minutes
  share: number; // pct of the below's minutes the turnarounds ended (0 when empty)
  kept: number; // of the turnovers, the minds that grew at home (self-kept quiet)
  handed: number; // the minds that ended a quiet another row opened
  rows: TurnoverEnder[]; // count desc, name asc, id asc
  longest: { min: number; enderName: string; at: string } | null; // the biggest silence a changed mind ended below
  /** R146 · the SLOWEST turnover cadence in the whole census (the
   *  max of the rows' cadenceMin) — the ender chips' cadence
   *  mini-bar's stable scale (all rows, not just the rendered
   *  three). Null when no row has struck twice. */
  slowestCadenceMin: number | null;
  /** R149 · THE FRESH HAND (the striking census's own): the newest
   *  stamp across ALL ender rows' lastAt (chronological max — a
   *  single-strike row rides, no rhythm needed). Recency beside the
   *  rhythm: tempo says how OFTEN, this says how RECENTLY. Null when
   *  no row carries a stamp. */
  newestStrikeAt: string | null;
  /** R150 · WHO CAME HOME (the striking census's own): the NAME of
   *  the ender row whose lastAt IS the freshest strike — one pass,
   *  one max, the stamp and its owner inseparable. First-seen wins a
   *  tie. No rhythm required. Null when no row carries a stamp. */
  newestStrikeBy: string | null;
  broken: number; // said, not bridged
  asked: number; // the n the caller asked for (a display bound)
  line: string; // the read's own voice, self-quoting
}

/** unruledTurnovers — the turnarounds' share of the BELOW silence:
 * which quiets below the rungs a changed mind ended, how the mind
 * grew (at home or by handoff), and who ended the most. */
export function unruledTurnovers(flips: BoardFlip[], n = 5): UnruledTurnoverRead {
  const { gaps, broken } = gapsOf(flips);
  const rev = reversals(flips);
  const { below, belowIdx } = ladderSplit(gaps, n);

  const turnKeys = new Set(rev.reversals.map((e) => `${e.id}|${e.at}`));

  interface Acc {
    id: string;
    name: string;
    count: number;
    totalMin: number;
    lastAt: string | null;
    enders: string[]; // the row's turnover-ender stamps, input order
    quietSeats: BoardFlip[];
    enderSeats: BoardFlip[];
  }
  const acc = new Map<string, Acc>();

  let totalMin = 0;
  let turnovers = 0;
  let turnoverMin = 0;
  let kept = 0;
  let handed = 0;
  let longest: UnruledTurnoverRead['longest'] = null;

  // R145 · the INPUT-order ride (the unruledRows fix's own pattern):
  // the census iterates the slice's indexes — membership identical,
  // order the gaps' own — so lastAt is the newest stamp, the seats
  // ride input order, and the longest pick's first-wins tie is the
  // input's own first.
  for (const gi of belowIdx) {
    const g = gaps[gi]!;
    totalMin += g.min;
    if (!turnKeys.has(`${g.toFlip.id}|${g.toFlip.at}`)) continue;
    turnovers += 1;
    turnoverMin += g.min;
    if (g.fromFlip.id === g.toFlip.id) kept += 1;
    else handed += 1;
    if (!longest || g.min > longest.min) {
      longest = { min: g.min, enderName: g.toFlip.name, at: g.toFlip.at };
    }
    let cur = acc.get(g.toFlip.id);
    if (!cur) {
      cur = {
        id: g.toFlip.id,
        name: g.toFlip.name,
        count: 0,
        totalMin: 0,
        lastAt: null,
        enders: [],
        quietSeats: [],
        enderSeats: [],
      };
      acc.set(g.toFlip.id, cur);
    }
    if (g.toFlip.name < cur.name) cur.name = g.toFlip.name; // the chains' name-asc orientation
    cur.count += 1;
    cur.totalMin += g.min;
    cur.lastAt = g.toFlip.at; // input order: the last write is the newest
    cur.enders.push(g.toFlip.at);
    cur.quietSeats.push(g.fromFlip, g.toFlip);
    cur.enderSeats.push(g.toFlip);
  }

  const rows: TurnoverEnder[] = [...acc.values()]
    .map((v) => {
      // R146 · the turnover cadence: the median interval between the
      // row's consecutive turnover-ender stamps — the minds' own
      // rhythm (even counts average the two middles, the kept
      // story's homecoming arithmetic). The stamps vetted the
      // gaps — they parse; the sort is the time's own.
      let cadenceMin: number | null = null;
      if (v.enders.length >= 2) {
        const ms = v.enders.map((at) => Date.parse(at)).sort((a, b) => a - b);
        const intervals: number[] = [];
        for (let i = 1; i < ms.length; i++) intervals.push((ms[i]! - ms[i - 1]!) / 60000);
        intervals.sort((a, b) => a - b);
        const mid = Math.floor(intervals.length / 2);
        cadenceMin =
          intervals.length % 2 === 1
            ? intervals[mid]!
            : (intervals[mid - 1]! + intervals[mid]!) / 2;
      }
      return {
        id: v.id,
        name: v.name,
        count: v.count,
        totalMin: v.totalMin,
        lastAt: v.lastAt,
        cadenceMin,
        quietSeats: v.quietSeats,
        enderSeats: v.enderSeats,
      };
    })
    .sort(
      (x, y) => y.count - x.count || x.name.localeCompare(y.name) || x.id.localeCompare(y.id),
    );

  // The census-wide scale: the slowest striking rhythm among all
  // the ender rows (null when no row has struck twice).
  const slowestCadenceMin: number | null = rows.reduce<number | null>(
    (m, r) => (r.cadenceMin !== null && (m === null || r.cadenceMin > m) ? r.cadenceMin : m),
    null,
  );

  // R149 · THE FRESH HAND: the striking census's newest stamp, over
  // ALL rows (the busiest ender's stamp has no seniority here — a
  // single-strike row can be the freshest hand). R150 · WHO CAME
  // HOME: one pass reads the stamp AND its owner's name.
  const freshestStrike = newestStampOwned(rows);
  const newestStrikeAt = freshestStrike?.at ?? null;
  const newestStrikeBy = freshestStrike?.by ?? null;

  const fmt = (min: number) => (min >= 100 ? Math.round(min) : min.toFixed(1));
  const timeOf = (at: string) => (at.includes('T') ? at.slice(11, 19) : at);
  let line: string;
  if (flips.length < 2) {
    line = 'the below holds no silence to read — the turnover share waits for a second flip';
  } else if (below.length === 0) {
    line = `the ladder names all ${gaps.length} of the tail's quiet${gaps.length === 1 ? '' : 's'} — nothing waits below the rungs, no turnover share to read`;
  } else if (turnovers === 0) {
    line = `none of the ${below.length} quiet${below.length === 1 ? '' : 's'} below the rungs (${fmt(totalMin)}′) ends in a changed mind — the below's silence is its own, no taken-back word ends it${broken > 0 ? ` (${broken} chain${broken === 1 ? '' : 's'} broken by an unreadable stamp, said not bridged)` : ''}`;
  } else {
    const share = totalMin > 0 ? Math.round((turnoverMin / totalMin) * 100) : 0;
    const s = rows[0]!;
    const longestClause = longest
      ? `, the biggest ${fmt(longest.min)}′ ended by ${longest.enderName} @ ${timeOf(longest.at)} UTC`
      : '';
    const brokenClause = broken > 0
      ? `; ${broken} chain${broken === 1 ? '' : 's'} broken by an unreadable stamp, said not bridged`
      : '';
    const cadenceClause =
      s.cadenceMin !== null ? `, its enders median ${fmt(s.cadenceMin)}′ apart` : '';
    line = `${turnovers} of the ${below.length} quiet${below.length === 1 ? '' : 's'} below the rungs end in a changed mind — ${fmt(turnoverMin)}′ of ${fmt(totalMin)}′ (${share}%)${longestClause}; ${kept} grew at home, ${handed} arrived by handoff; the busiest ender ${s.name} ×${s.count}${cadenceClause}${brokenClause}`;
  }

  return {
    total: below.length,
    totalMin,
    turnovers,
    turnoverMin,
    share: totalMin > 0 ? Math.round((turnoverMin / totalMin) * 100) : 0,
    kept,
    handed,
    rows,
    longest,
    slowestCadenceMin,
    newestStrikeAt,
    newestStrikeBy,
    broken,
    asked: n,
    line,
  };
}

// — R147 · THE CROSS-CADENCE — do a row's two rhythms agree?
//
// The kept story (R144) reads the row's homecoming rhythm: the median
// interval between its consecutive self-kept enders. The unruled
// turnovers (R145/R146) read the row's striking rhythm: the median
// interval between its consecutive turnover-ender stamps (the below
// quiets its changed minds ended). Both cadences belong to the SAME
// row id — the composition joins the two censuses by id and asks the
// handover's own question: does a row that comes home FAST also
// strike below fast, or do the two rhythms run against each other?
//
// The contracts:
//   - The join is by row id over the two reads' OWN rows — no new
//     slice, no re-walk of the flips; the two reads already rode the
//     shared slice, this read composes their answers. (The two
//     cadences count different ender sets — self-kept enders vs
//     turnover enders — so a row can carry one, both, or neither;
//     only rows with BOTH ride.)
//   - faster: homecomingMin < cadenceMin → 'at-home' (the row comes
//     home faster than it strikes below), homecomingMin > cadenceMin
//     → 'below', and an exact tie → 'at-home' (the kinder reading;
//     the spread is 0 either way, said plainly).
//   - widest: the max |spread| row, FIRST-WINS tie (the kept rows'
//     own order — keptEnders desc — decides), the line's named row.
//   - Purity: neither input's rows are touched — the composition
//     reads, never mutates. The line names ROWS and MINUTES — the
//     mirror rule holds.

export interface CrossCadenceRow {
  id: string;
  name: string;
  homecomingMin: number; // the row's homecoming cadence (kept story's own)
  cadenceMin: number; // the row's below-striking cadence (turnovers' own)
  faster: 'at-home' | 'below'; // which rhythm runs faster
  spread: number; // |cadenceMin - homecomingMin| — the two rhythms' distance
  /** R150 · THE WIDER HAND'S SIGNED DELTA: homecomingMin − cadenceMin,
 *  the distance given a DIRECTION — positive reads the homecoming
 *  hand runs the slower (the row lingers at home), negative reads the
 *  striking hand does. The spread is this delta's magnitude and
 *  faster its sign's word (an exact tie is +0 and reads the kinder
 *  'at-home') — three fields, one truth, no re-derivation drift. */
  deltaMin: number;
  /** R149 · THE COMPASS STAMPS: each hand's freshest stamp, ridden
   *  VERBATIM from the two censuses (the kept row's lastAt / the
   *  turnover row's lastAt — no re-derivation, no divergence
   *  possible). The unfold's rows read tempo AND recency. */
  homeLastAt: string | null;
  strikeLastAt: string | null;
  /** R151 · THE STALER HAND: which of the row's two freshest stamps
   *  is the OLDER — 'home' the homecoming hand's recency has drifted,
   *  'strike' the striking hand's has, 'tie' both last spoke the same
   *  instant. Tempo says how OFTEN a hand moves, its stamp says how
   *  RECENTLY; the staler badge names which hand's recency lags.
   *  Null when either stamp is missing or unreadable — the badge is
   *  honestly absent, never guessed. */
  stalerHand: 'home' | 'strike' | 'tie' | null;
}

export interface CrossCadenceRead {
  paired: number; // rows carrying BOTH rhythms
  fasterAtHome: number; // of those, the rows that come home faster
  fasterBelow: number; // the rows that strike below faster
  /** R148 · the BOTH-rhythm rows themselves, in the kept census's own
   *  order (keptEnders desc — the engine never re-sorts: the widest's
   *  first-wins tie reads THIS order). The compass's unfold view rides
   *  it verbatim — the view IS the composition, no second join. */
  rows: CrossCadenceRow[];
  widest: CrossCadenceRow | null; // the max-spread row (first-wins tie)
  line: string; // the read's own voice, self-quoting
}

export function crossCadence(kept: KeptStoryRead, turn: UnruledTurnoverRead): CrossCadenceRead {
  const turnRows = new Map(turn.rows.map((r) => [r.id, r]));
  const rows: CrossCadenceRow[] = [];
  for (const k of kept.rows) {
    const t = turnRows.get(k.id);
    if (!t || k.homecomingMin === null || t.cadenceMin === null) continue;
    // R150 · the signed delta is the primary read now: the homecoming
    // hand's cadence minus the striking hand's — + lingers at home,
    // − strikes the slower. The spread is its magnitude, faster its
    // sign's word (the exact tie stays 'at-home', the kinder reading:
    // 0 <= 0 — the old arithmetic, byte-identical).
    const deltaMin = k.homecomingMin - t.cadenceMin;
    const spread = Math.abs(deltaMin);
    // R151 · THE STALER HAND: the two verbatim stamps compared by
    // Date.parse (never a string compare — the fresh hand's law); the
    // OLDER hand is the staler. Either stamp missing or unreadable →
    // null, the badge's honest absence.
    const homeMs = k.lastAt ? Date.parse(k.lastAt) : NaN;
    const strikeMs = t.lastAt ? Date.parse(t.lastAt) : NaN;
    const stalerHand =
      Number.isFinite(homeMs) && Number.isFinite(strikeMs)
        ? homeMs < strikeMs
          ? 'home'
          : strikeMs < homeMs
            ? 'strike'
            : 'tie'
        : null;
    rows.push({
      id: k.id,
      name: k.name,
      homecomingMin: k.homecomingMin,
      cadenceMin: t.cadenceMin,
      faster: deltaMin <= 0 ? 'at-home' : 'below',
      spread,
      deltaMin,
      homeLastAt: k.lastAt, // R149 · the verbatim ride — no re-derivation
      strikeLastAt: t.lastAt,
      stalerHand,
    });
  }
  const fasterAtHome = rows.filter((r) => r.faster === 'at-home').length;
  const fasterBelow = rows.length - fasterAtHome;
  let widest: CrossCadenceRow | null = null;
  for (const r of rows) {
    if (!widest || r.spread > widest.spread) widest = r;
  }

  const fmt = (min: number) => (min >= 100 ? Math.round(min) : min.toFixed(1));
  let line: string;
  if (rows.length === 0) {
    line =
      'no row carries both rhythms yet — the cross-cadence waits for a row that comes home AND strikes below, each twice';
  } else {
    const widestClause = widest
      ? `; the widest contrast rides ${widest.name} (comes home ${fmt(widest.homecomingMin)}′, strikes ${fmt(widest.cadenceMin)}′ apart)`
      : '';
    const homeClause = `${fasterAtHome} ${fasterAtHome === 1 ? 'comes' : 'come'} home faster than ${fasterAtHome === 1 ? 'it strikes' : 'they strike'} below`;
    line = `${rows.length} row${rows.length === 1 ? '' : 's'} ${rows.length === 1 ? 'carries' : 'carry'} both rhythms — ${homeClause}, ${fasterBelow} the reverse${widestClause}`;
  }

  return { paired: rows.length, fasterAtHome, fasterBelow, rows, widest, line };
}

/** R156 · THE SHARED HAND'S SECOND FACE — THE TENSION'S OWN HAND:
 *  the digest's hot rows judged with the SAME freshness vocabulary
 *  the kept rows speak, against the TAIL's own rhythm. One pass
 *  builds each flip-id's newest stamp (the R151 census's own law —
 *  a chronological max by Date.parse, never a string compare); the
 *  tail's freshest flip is the zero the deltas run from (the R151
 *  fresh hand's law — first-seen wins a tie in the tail's own
 *  order); the yardstick is the TAIL's median gap (gapsOf's own
 *  median — the pace the breaths read), never an invented constant.
 *  The judgment itself is classifyFreshness — the house read, no
 *  second arithmetic. An id with no flip in the tail gets no entry
 *  (the digest's unrecorded law already says that absence); an
 *  entry's hand is null when the yardstick is missing (fewer than
 *  two readable gaps) or a stamp is unreadable — the hand never
 *  guesses. The delta and the verbatim stamp ride beside the hand
 *  so the surface can speak its degree without re-deriving. */
export interface HotHandEntry {
  id: string;
  hand: FreshnessHand | null;
  deltaMin: number | null; // minutes behind the tail's freshest flip (0 = it IS the freshest)
  lastAt: string | null; // the id's own newest flip stamp, verbatim
}

export interface HotHandsRead {
  hands: Map<string, HotHandEntry>; // per flip-id seen in the tail
  yardstickMin: number | null; // the tail's median gap — the rhythm the deltas are judged against
  freshestAt: string | null; // the tail's freshest flip stamp (the zero)
  freshestBy: string | null; // its owner's name
}

export function hotHands(flips: BoardFlip[]): HotHandsRead {
  // One pass: each id's newest stamp (chronological max, first-seen
  // on ties in the tail's own order) — and the tail's freshest flip.
  const newest = new Map<string, { at: string; ms: number }>();
  let freshest: { at: string; ms: number; by: string } | null = null;
  for (const f of flips) {
    const ms = Date.parse(f.at);
    if (!Number.isFinite(ms)) continue;
    const cur = newest.get(f.id);
    if (!cur || ms > cur.ms) newest.set(f.id, { at: f.at, ms });
    if (!freshest || ms > freshest.ms) freshest = { at: f.at, ms, by: f.name };
  }
  // The tail's own rhythm: gapsOf's median — the same census the
  // pace word reads, re-read here so this read stays self-contained.
  const yardstickMin = gapsOf(flips).medianGapMin;
  const hands = new Map<string, HotHandEntry>();
  for (const [id, cur] of newest) {
    const deltaMin =
      freshest !== null ? (freshest.ms - cur.ms) / 60000 : null;
    hands.set(id, {
      id,
      hand: deltaMin !== null ? classifyFreshness(deltaMin, yardstickMin) : null,
      deltaMin: deltaMin !== null && Number.isFinite(deltaMin) ? deltaMin : null,
      lastAt: cur.at,
    });
  }
  return {
    hands,
    yardstickMin,
    freshestAt: freshest?.at ?? null,
    freshestBy: freshest?.by ?? null,
  };
}

// — R157 · THE WIDENED MEMORY — the house remembers EVERY fold, and
// the clipboard speaks the same words the surfaces speak.
//
// R156 taught the house to remember two folds (the mover ladder, the
// kept company's full roll). But the watchboard owns SIX foldable
// surfaces, and a reader who opened four of them found the other
// four reset on every reload — the memory was honest but narrow.
// This read widens the family: the cadence compass's unfold, the
// below's +more, the paired companies' +more, the turnover enders'
// +more — each surface its own key in the one session record. The
// PARSE is lifted here so the suite can hold it: the memory never
// invents an opening (non-boolean values read closed, garbage reads
// the all-folded default — the folded default stays the honest
// default through any broken store).

/** The six foldable surfaces, each its own key in the one record. */
export type FoldName =
  | 'moverLadder'
  | 'keepers'
  | 'compass'
  | 'below'
  | 'unruledRows'
  | 'turnEnders';

export interface RememberedFolds {
  moverLadder: boolean;
  keepers: boolean;
  compass: boolean;
  below: boolean;
  unruledRows: boolean;
  turnEnders: boolean;
}

/** The all-folded default — the honest default the memory restores
 *  FROM, never away from: a missing key, a broken store, a record
 *  from an older vocabulary all land here. */
export const ALL_FOLDED: RememberedFolds = {
  moverLadder: false,
  keepers: false,
  compass: false,
  below: false,
  unruledRows: false,
  turnEnders: false,
};

/** The six foldable surfaces in the house's own order — exported for
 *  the UI's memory ledger (R160 · the consent surface reads the same
 *  order the engine speaks). */
export const FOLD_NAMES: readonly FoldName[] = [
  'moverLadder',
  'keepers',
  'compass',
  'below',
  'unruledRows',
  'turnEnders',
];

/** THE MEMORY'S PARSE: the raw session string (or null) read into
 *  the six-key record. Laws: null/absent → the all-folded default;
 *  unparseable JSON → the all-folded default; a non-object record →
 *  the all-folded default; unknown keys are ignored (an older or
 *  newer vocabulary rides through without poisoning the read); a
 *  non-boolean value reads CLOSED — the memory never invents an
 *  opening — EXCEPT the one v2 widening (R158 · THE DATED MEMORY):
 *  a string that DATE-PARSES is a fold left open at that instant —
 *  the stamp IS the openness. A string that does not date-parse
 *  ("true", junk) stays closed; exactly `true` opens with no when
 *  (the v1 record, still honored). */
export function parseFolds(raw: string | null): RememberedFolds {
  const folds: RememberedFolds = { ...ALL_FOLDED };
  if (raw === null) return folds;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return folds;
  }
  if (typeof parsed !== 'object' || parsed === null) return folds;
  const obj = parsed as Record<string, unknown>;
  for (const name of FOLD_NAMES) {
    if (obj[name] === true || readsAsStamp(obj[name])) folds[name] = true;
  }
  return folds;
}

/** A value reads as a STAMP when it is a string Date.parse can
 *  read — the v2 record's openness. Anything else ("true", numbers,
 *  objects, null) is not a when. */
function readsAsStamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

/** THE MEMORY'S WHEN (R158 · THE DATED MEMORY): the same record
 *  read for the stamps — per key, the verbatim ISO instant the fold
 *  was left open. A v1 record (booleans) has no when; a closed fold
 *  has no when; an unreadable string is no when. The stamps never
 *  invent: only what the record itself says rides. */
export function foldStamps(raw: string | null): Partial<Record<FoldName, string>> {
  const stamps: Partial<Record<FoldName, string>> = {};
  if (raw === null) return stamps;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return stamps;
  }
  if (typeof parsed !== 'object' || parsed === null) return stamps;
  const obj = parsed as Record<string, unknown>;
  for (const name of FOLD_NAMES) {
    const v = obj[name];
    if (readsAsStamp(v)) stamps[name] = v;
  }
  return stamps;
}

/** THE MEMORY'S RECORD: a partial fold map stripped to the six known
 *  keys, non-boolean values read closed — the session's record never
 *  accumulates junk keys across vocabulary changes. */
export function foldRecord(
  folds: Partial<Record<FoldName, boolean>>,
): Record<FoldName, boolean> {
  const record = {} as Record<FoldName, boolean>;
  for (const name of FOLD_NAMES) record[name] = folds[name] === true;
  return record;
}

/** A fold record's value, v2 (R158 · THE DATED MEMORY): `true` —
 *  open, no when known (the v1 shape, honored); a date-parsing
 *  string — open, left at that instant; `false` — closed. */
export type FoldValue = boolean | string;

/** THE MEMORY'S RECORD, v2: the write side of the dated memory — a
 *  partial map stripped to the six known keys. A date-parsing string
 *  rides VERBATIM (the when the reader left it); `true` rides (the
 *  when unknown is still an opening); everything else writes closed —
 *  the write side never invents an opening either, and a junk string
 *  normalizes to the closed it would read as. */
export function stampedRecord(
  folds: Partial<Record<FoldName, FoldValue>>,
): Record<FoldName, FoldValue> {
  const record = {} as Record<FoldName, FoldValue>;
  for (const name of FOLD_NAMES) {
    const v = folds[name];
    record[name] = readsAsStamp(v) ? v : v === true;
  }
  return record;
}

// — R159 · THE ESTATE'S MEMORY — the record's read widens beyond the
// tab: a fresh tab may ADOPT the estate's record (the opt-in is the
// consent), and the clipboard may SPEAK the reader's own record (the
// fold-memory footer). The laws stay the parse's laws — nothing here
// invents an opening, a when, or a memory.

/** A WHOLE record: a plain JSON object — the six-key vocabulary's own
 *  shape. An array, a scalar, null, unparseable bytes are no record.
 *  ONE law shared by the adoption and the origin read, so the flag
 *  and the adoption can never disagree about what counts. */
function wholeFoldRecord(raw: string | null): boolean {
  if (raw === null) return false;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

/** THE MEMORY'S ORIGIN (R160 · THE ADOPTED VOICE): whose voice is the
 *  record THIS tab reads? 'own' — the tab wrote it (a whole session
 *  record, even all-closed); 'adopted' — the tab had no whole record
 *  of its own and took the estate's (the fresh tab's arrival);
 *  'none' — no memory anywhere. The SAME law adoptFoldMemory applies:
 *  origin === 'adopted' exactly when the adoption returns the
 *  estate's bytes; origin === 'own' exactly when it returns the
 *  session's; origin === 'none' exactly when it returns null. */
export type FoldMemoryOrigin = 'own' | 'adopted' | 'none';

export function foldMemoryOrigin(
  sessionRaw: string | null,
  estateRaw: string | null,
): FoldMemoryOrigin {
  if (wholeFoldRecord(sessionRaw)) return 'own';
  if (wholeFoldRecord(estateRaw)) return 'adopted';
  return 'none';
}

/** THE ESTATE'S ADOPTION: which record does THIS tab read? The tab's
 *  own record wins whenever it is present and whole (a JSON object —
 *  even an all-closed one is the tab's own voice); a record the tab
 *  never wrote (null) or one that is broken (garbage, a non-object)
 *  adopts the estate's record VERBATIM when the estate's is itself
 *  whole. Both absent → null (no memory anywhere — the honest
 *  default). The estate never over-leads a tab that can speak for
 *  itself; the parse laws (parseFolds) stay the read's only truth. */
export function adoptFoldMemory(
  sessionRaw: string | null,
  estateRaw: string | null,
): string | null {
  if (wholeFoldRecord(sessionRaw)) return sessionRaw;
  return wholeFoldRecord(estateRaw) ? estateRaw : null;
}

/** THE WRITER'S STAMP (R161 · THE STANDING MEMORY): provenance on the
 *  estate's copy — WHICH tab wrote it, WHEN. The stamp rides INSIDE
 *  the record (two extra keys on the same plain object — the wholeness
 *  law unaffected, the readers of folds/when unaffected, the adoption
 *  copies it verbatim), so the memory's ledger can say whose hands
 *  last touched it. Pure: the input bytes are never mutated; a record
 *  that is not whole (null, garbage, array, scalar) returns null —
 *  the stamp never invents a record to sign. Re-stamping OVERWRITES
 *  (the last write owns the provenance — one record, one truth).
 *  R162 · THE STAMP LOG: the history rides a capped sub-key — the
 *  flat pair stays the LAST write's truth, the log remembers the
 *  hands before it (the estate's story: which tabs touched this
 *  memory, in order). A corrupt log (not an array) starts fresh;
 *  entries that are not well-formed {by, at} strings are filtered
 *  out; the cap keeps the LAST five (the newest story, never
 *  unbounded growth). The log's tail IS the flat pair — one law,
 *  pinned. */
const STAMP_LOG_CAP = 5;

export interface EstateStampEntry {
  by: string;
  at: string;
}

function validStampEntry(e: unknown): e is EstateStampEntry {
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as { by?: unknown }).by === 'string' &&
    typeof (e as { at?: unknown }).at === 'string'
  );
}

export function stampEstateRecord(
  raw: string | null,
  tabId: string,
  now: Date = new Date(),
): string | null {
  if (!wholeFoldRecord(raw)) return null;
  try {
    const parsed = JSON.parse(raw as string) as Record<string, unknown>;
    parsed.writtenBy = tabId;
    parsed.writtenAt = now.toISOString();
    const prior = Array.isArray(parsed.stampLog) ? parsed.stampLog : [];
    const log = prior.filter(validStampEntry);
    log.push({ by: tabId, at: now.toISOString() });
    parsed.stampLog = log.slice(-STAMP_LOG_CAP);
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}

/** THE STAMP LOG, READ (R162): the estate's write history, oldest
 *  first — [{ by, at } …] when the record carries a well-formed log,
 *  [] otherwise (a v1-R161 record stamped without a log, a broken
 *  one, an absence — the ledger shows what the log IS, it never
 *  synthesizes history). The log's tail is the flat pair's truth. */
export function readEstateStamps(raw: string | null): EstateStampEntry[] {
  if (!wholeFoldRecord(raw)) return [];
  try {
    const parsed = JSON.parse(raw as string) as { stampLog?: unknown };
    if (!Array.isArray(parsed.stampLog)) return [];
    return parsed.stampLog.filter(validStampEntry);
  } catch {
    return [];
  }
}

/** THE WRITER'S STAMP, READ (R161): the provenance the ledger shows —
 *  { writtenBy, writtenAt } when the record carries a well-formed
 *  stamp (both strings), null otherwise (a v1 unstamped record, a
 *  broken one, an absence — the ledger says so, it never guesses). */
export function readEstateStamp(
  raw: string | null,
): { writtenBy: string; writtenAt: string } | null {
  if (!wholeFoldRecord(raw)) return null;
  try {
    const parsed = JSON.parse(raw as string) as {
      writtenBy?: unknown;
      writtenAt?: unknown;
    };
    if (typeof parsed.writtenBy !== 'string' || typeof parsed.writtenAt !== 'string') {
      return null;
    }
    return { writtenBy: parsed.writtenBy, writtenAt: parsed.writtenAt };
  } catch {
    return null;
  }
}

/** THE MIRROR'S OWN LAW (R162): one write to the estate's store — the
 *  fold keys come from the SESSION's record as it stands (the consent
 *  law: the same record rides), the PROVENANCE comes from the write
 *  (this tab, this instant), and the LOG is the estate store's OWN
 *  story: the previous copy's history, this write appended, capped.
 *  Calling stampEstateRecord on the fresh session bytes was the R162
 *  live-fire's own catch — every mirror replaced the log with a
 *  one-entry stub, because the session record (stripped to the six
 *  keys) carries no history. The mirror is where the two truths meet:
 *  folds from the reader, memory of the hands from the store. Pure;
 *  null when the session bytes are not whole (never invents). */
export function mirrorEstateRecord(
  sessionRaw: string | null,
  previousEstateRaw: string | null,
  tabId: string,
  now: Date = new Date(),
): string | null {
  if (!wholeFoldRecord(sessionRaw)) return null;
  try {
    const parsed = JSON.parse(sessionRaw as string) as Record<string, unknown>;
    parsed.writtenBy = tabId;
    parsed.writtenAt = now.toISOString();
    const log = [
      ...readEstateStamps(previousEstateRaw),
      { by: tabId, at: now.toISOString() },
    ];
    parsed.stampLog = log.slice(-STAMP_LOG_CAP);
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}

// — R163 · THE PROVENANCE'S COLORS — the estate's story at a glance:
// every tab id wears ONE hue, derived from the id's own characters —
// pure arithmetic, no clock, no randomness — so the same hand wears
// the same color in every tab, in every session, forever. The
// colors are a READING of the provenance, never a write: they change
// no record, no law, no ownership.

/** THE TAB'S HUE (R163): a stable hue in [0, 360) from the tab id —
 *  the id's characters folded through a small deterministic hash.
 *  Same id, same hue, forever; different ids (almost surely) differ.
 *  The empty string hashes to 0 — said, not hidden. */
export function tabHue(tabId: string): number {
  let h = 0;
  for (let i = 0; i < tabId.length; i++) {
    h = (h * 31 + tabId.charCodeAt(i)) % 360;
  }
  return h;
}

/** THE COLOR'S VOICE (R163): the hue as the house speaks it — a soft
 *  pastel on the board's dark ground (s 62%, l 70%), an optional
 *  alpha for the quieter surfaces (alpha < 1 rides inside the hsl).
 *  The same tab, the same voice. */
export function tabHueColor(tabId: string, alpha = 1): string {
  const h = tabHue(tabId);
  return alpha >= 1 ? `hsl(${h} 62% 70%)` : `hsl(${h} 62% 70% / ${alpha})`;
}

/** THE STAMP'S UTC VOICE (R163, the engine's own copy of the house's
 *  reading): an ISO instant printed at HH:MM:SS — the `T`-carrying
 *  string's own clock face; a string without a `T` rides verbatim
 *  (the voice prints what the record claims, it never re-cuts). */
function stampVoice(at: string): string {
  return at.includes('T') ? at.slice(11, 19) : at;
}

/** THE STANDING GREETING (R163 · the provenance SPOKEN): the arrival
 *  story the standing row tells when this tab's memory is STILL
 *  EXACTLY the adoption's bytes — the session record carries the
 *  adopter's stamp AND the writer is not this tab (the reader's own
 *  writes strip the stamp; the greeting retires on the first fold of
 *  the reader's own; a same-tab re-adoption stays silent, honestly).
 *  R163's widening: the greeting names the hand — `in tab-7c7a`, not
 *  `in another tab` — the provenance spoken, matching the hue the
 *  chip wears beside it. The when is the freshest OPEN fold's own
 *  stamp (the reader's last touch); a record whose open folds carry
 *  no stamps (the v1 shape) greets without the when clause. Null for
 *  every silence: arrival not 'adopted', a non-whole record, no flat
 *  stamp, the reader's own hand — the greeting never invents. */
export interface StandingGreeting {
  text: string;
  by: string;
  /** R165 · the greeting's own age in minutes, from the freshest OPEN
   *  fold's stamp to `now` — the clock the fading edge reads. Null for
   *  the when-less greeting (a v1 record's open folds carry no stamps
   *  — no clock, no decay; the edge keeps its full strength). */
  ageMin: number | null;
}

export function standingGreeting(
  raw: string | null,
  ownTabId: string,
  arrival: string | null,
  now: Date = new Date(),
): StandingGreeting | null {
  if (arrival !== 'adopted') return null;
  if (!wholeFoldRecord(raw)) return null;
  const st = readEstateStamp(raw);
  if (st === null || st.writtenBy === ownTabId) return null;
  const folds = parseFolds(raw);
  const stamps = foldStamps(raw);
  // THE OPEN-MEMORY GATE (R162's own law, now the engine's): an
  // all-closed record greets nothing — the greeting speaks a memory
  // that was LEFT OPEN; an empty one is a silence, never a lie.
  if (!FOLD_NAMES.some((n) => folds[n])) return null;
  let when: string | null = null;
  for (const n of FOLD_NAMES) {
    if (!folds[n]) continue;
    const w = stamps[n];
    if (!w) continue;
    if (when === null || Date.parse(w) > Date.parse(when)) when = w;
  }
  if (when !== null && Number.isFinite(Date.parse(when))) {
    const ageMin = Math.max(0, (now.getTime() - Date.parse(when)) / 60000);
    return {
      text: `↺ left open ${ageMin >= 100 ? Math.round(ageMin) : ageMin.toFixed(1)}′ ago (at ${stampVoice(when)} UTC) in ${st.writtenBy} — the estate remembered`,
      by: st.writtenBy,
      ageMin,
    };
  }
  return {
    text: `↺ left open in ${st.writtenBy} — the estate remembered`,
    by: st.writtenBy,
    ageMin: null,
  };
}

// — R164 · THE READER'S OWN COLOR — the consent wears its reader:
// while the consent stands, the pill's dot takes the tab's OWN hue
// (the memory that rides is this tab's record; the reader sees their
// own color on the consent), the arrival's hue paints the standing
// row's edge, and the hands row speaks its legend. All three are
// READINGS of the hue — they change no record, no law, no ownership.

/** THE CONSENT'S DOT (R164): the estate pill's dot voice — the
 *  reader's OWN hue while the consent stands, the glow riding at the
 *  amber glow's own alpha (0.75). Null when the consent is off — the
 *  pill's resting dot keeps the house's slate. Deterministic: the
 *  same tab, the same pair, every call. */
export function consentDot(
  tabId: string,
  estateOn: boolean,
): { color: string; glow: string } | null {
  if (!estateOn) return null;
  return {
    color: tabHueColor(tabId),
    glow: tabHueColor(tabId, 0.75),
  };
}

/** THE ARRIVAL'S EDGE (R164): when the greeting speaks, the standing
 *  row's left border takes the WRITER's hue — the arrival paints the
 *  edge. Null for the silence: the row keeps the house's lavender
 *  when no arrival stands. The alpha rides inside the hsl (default
 *  0.45 — the lavender border's own strength). */
export function arrivalEdge(
  greet: StandingGreeting | null,
  alpha = 0.45,
): string | null {
  if (greet === null) return null;
  return tabHueColor(greet.by, alpha);
}

/** THE HUE'S LEGEND (R164): the hands row's one voice for what the
 *  dots ARE — a constant, so the legend never drifts between the
 *  places it might stand. The colors are the tabs' own: derived from
 *  each id's characters, the same hand the same color everywhere. */
export const HUE_LEGEND_VOICE = 'the colors are the tabs’ own';

// — R165 · THE ARRIVAL'S HEARTBEAT — the living tint: the consent's
// dot breathes (the reader's own hue, pulsing), the arrival's edge
// AGES (the writer's color fading back to the house lavender as the
// greeting grows old), and the legend demonstrates itself (its glyph
// wears the log's own first and last hands). All readings, never
// writes — the tint lives, the record does not move.

/** THE FADING EDGE (R165): the arrival painting the edge, AGING —
 *  the writer's hue at full border strength when the greeting is
 *  fresh (ageMin 0), fading linearly to the floor once the greeting
 *  is fadeMin old, the hues between riding the same hsl voice at the
 *  decaying alpha. The base voice (arrivalEdge) is the age-zero law:
 *  a fresh arrival paints exactly what R164 painted. A when-less
 *  greeting (ageMin null — a v1 record's open folds carry no stamps)
 *  has no clock to age by: the edge keeps its full strength, honestly
 *  undecayed. Null for the silence (the row keeps the house
 *  lavender). */
export function fadingEdge(
  greet: StandingGreeting | null,
  fadeMin = 1,
  floor = 0.15,
): string | null {
  const alpha = fadingAlpha(greet, 0.45, floor, fadeMin);
  if (alpha === null || greet === null) return null;
  return tabHueColor(greet.by, alpha);
}

/** THE LEGEND'S GLYPH (R165): the legend chip's leading dots — the
 *  log's OWN hands demonstrating the legend. The first and the last
 *  hand's hues (the story's opening and its now); a single hand wears
 *  one dot; two hands of the SAME hue wear one dot (two identical
 *  dots would lie about two hues); an empty log wears nothing (the
 *  legend's words stand alone — never a synthesized glyph). */
export function hueLegendGlyph(
  log: ReadonlyArray<{ by: string; at: string }>,
): string[] {
  if (log.length === 0) return [];
  const first = tabHueColor(log[0].by);
  const last = tabHueColor(log[log.length - 1].by);
  return first === last ? [first] : [first, last];
}

// — R166 · THE TEMPO OF TRUST — the living tint keeps its own time:
// the consent's beat SLOWS as the estate copy ages unwritten (a fresh
// mirror rests at the young beat; an elder memory beats slower —
// steadiness spoken in tempo, not dying), the greeting's fade spreads
// to its chip (one clock, two surfaces — the row's edge and the
// chip's border age together), and the story's colors stand on the
// row itself (the log's own ends, always visible). All readings of
// clocks and hues — no record moves.

/** THE MIRROR'S AGE (R166): how long since THIS TAB last wrote the
 *  estate's copy — the freshest stampLog entry carrying the tab's own
 *  id; a tab that never wrote (the freshly-adopted memory) reads the
 *  flat pair's writtenAt (the adoption moment — the memory arrived
 *  then, and the tab has held it since). Null for every silence: no
 *  estate copy, a broken record, an unstamped one — the tempo has no
 *  clock to read and says so. Minutes, like the greeting's clock. */
export function mirrorAge(
  estateRaw: string | null,
  ownTabId: string,
  now: Date = new Date(),
): number | null {
  if (estateRaw === null) return null;
  try {
    const parsed: unknown = JSON.parse(estateRaw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const rec = parsed as Record<string, unknown>;
    let when: string | null = null;
    if (Array.isArray(rec.stampLog)) {
      for (const e of rec.stampLog as unknown[]) {
        if (typeof e !== 'object' || e === null) continue;
        const en = e as Record<string, unknown>;
        if (en.by !== ownTabId) continue;
        if (typeof en.at !== 'string' || !Number.isFinite(Date.parse(en.at))) continue;
        if (when === null || Date.parse(en.at) > Date.parse(when)) when = en.at;
      }
    }
    if (when === null && typeof rec.writtenAt === 'string' && Number.isFinite(Date.parse(rec.writtenAt))) {
      when = rec.writtenAt;
    }
    if (when === null) return null;
    return Math.max(0, (now.getTime() - Date.parse(when)) / 60000);
  } catch {
    return null;
  }
}

/** THE HEARTBEAT'S TEMPO (R166): the consent dot's beat, in seconds —
 *  the young memory rests at 2.4s (the R165 beat); past ten minutes
 *  the beat settles to 4.8s; past the hour it beats elder at 7.2s.
 *  A null age (no clock — the mirror has not happened yet) keeps the
 *  young beat: a consent with nothing mirrored is a new story, not an
 *  old one. Tiered, never continuous — a tempo the eye can name. */
export function heartbeatTempo(ageMin: number | null): number {
  if (ageMin === null) return 2.4;
  if (ageMin > 60) return 7.2;
  if (ageMin > 10) return 4.8;
  return 2.4;
}

/** THE FADING ALPHA (R166): the greeting's clock made pure — the
 *  decaying alpha the fade paints with, from `from` down to `floor`
 *  across `fadeMin` minutes, quantized to the thousandth (a reading
 *  does not ship arithmetic noise — R165's law). Null for the
 *  silence. fadingEdge is this voice at the border's own strengths;
 *  the chip calls it at its own (softer base, softer floor) — ONE
 *  clock, many surfaces, every surface at its own strength. */
export function fadingAlpha(
  greet: StandingGreeting | null,
  from = 0.45,
  floor = 0.15,
  fadeMin = 1,
): number | null {
  if (greet === null) return null;
  if (greet.ageMin === null) return from;
  const t = Math.min(1, Math.max(0, greet.ageMin / fadeMin));
  return Math.round((from - (from - floor) * t) * 1000) / 1000;
}

// — R167 · THE AUDIBLE CLOCK — the tempo SPEAKS: the consent's dot
// names its own tier and its own age (hovering reads the clock
// without arithmetic), the row glyph's last hand DIMS as the copy
// rests unwritten (the story visibly settling), and the greeting's
// title carries the held clock. All readings of the mirrorAge clock —
// the record does not move.

/** THE AGE'S VOICE (R167): one shape for every clock on this surface
 *  — under a minute speaks seconds, under the hour speaks minutes
 *  (one decimal), past the hour speaks hours; null speaks the
 *  honestly-empty ('no mirror yet'). The heartbeat's title and the
 *  greeting's title share this one voice — one clock, one grammar. */
export function ageVoice(ageMin: number | null): string {
  if (ageMin === null) return 'no mirror yet';
  if (ageMin < 1) return `${Math.max(0, Math.round(ageMin * 60))}s ago`;
  if (ageMin < 60) return `${ageMin.toFixed(1)}′ ago`;
  return `${(ageMin / 60).toFixed(1)}h ago`;
}

/** THE TEMPO'S NAME (R167): the consent dot's title voice — the tier
 *  named (young/settling/elder, heartbeatTempo's own tiers), the beat
 *  it rides, and the age that set it. A clock the reader can HEAR by
 *  hovering — no arithmetic asked of the eye. */
export function heartbeatVoice(ageMin: number | null): string {
  return `${tempoTier(ageMin)} · beats ${heartbeatTempo(ageMin)}s — mirrored ${ageVoice(ageMin)}`;
}

/** THE RESTING DOT (R167): the row glyph's last hand dims as the
 *  estate copy rests unwritten — full presence when the clock is
 *  fresh (or unreadable: null keeps full presence — no clock is not a
 *  dimming), easing to the 0.45 floor across two hours, holding
 *  there (the story rests, it never vanishes). Linear, quantized to
 *  the thousandth — a reading does not ship arithmetic noise. */
export function glyphRest(ageMin: number | null): number {
  if (ageMin === null) return 1;
  const t = Math.min(1, Math.max(0, ageMin / 120));
  return Math.round((1 - 0.55 * t) * 1000) / 1000;
}

/** THE COPY'S AGE (R167): how long since ANY hand last wrote the
 *  estate's copy — the stampLog's freshest entry's `at`, falling back
 *  to the flat writtenAt; null for every silence (no copy, broken
 *  record, unstamped). The row glyph's dim reads THIS clock (the
 *  story's own resting), not this tab's mirror clock — the copy rests
 *  when nobody has written, whoever they are. */
export function copyAge(
  estateRaw: string | null,
  now: Date = new Date(),
): number | null {
  if (estateRaw === null) return null;
  try {
    const parsed: unknown = JSON.parse(estateRaw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const rec = parsed as Record<string, unknown>;
    let when: string | null = null;
    if (Array.isArray(rec.stampLog)) {
      for (const e of rec.stampLog as unknown[]) {
        if (typeof e !== 'object' || e === null) continue;
        const en = e as Record<string, unknown>;
        if (typeof en.at !== 'string' || !Number.isFinite(Date.parse(en.at))) continue;
        if (when === null || Date.parse(en.at) > Date.parse(when)) when = en.at;
      }
    }
    if (when === null && typeof rec.writtenAt === 'string' && Number.isFinite(Date.parse(rec.writtenAt))) {
      when = rec.writtenAt;
    }
    if (when === null) return null;
    return Math.max(0, (now.getTime() - Date.parse(when)) / 60000);
  } catch {
    return null;
  }
}

// — R168 · THE SETTLING ARC — the story's whole arc settles: the row
// glyph's FIRST hand dims too (an older, slower dim — the origin
// rests at half the copy's pace and never as deep as its now), the
// ledger's writer line hears the clock (the copy's age and the beat
// it sets, the shared grammar), and a consent with NO mirror speaks
// its own held age (young forever — and now it says how long it has
// been young). All readings of clocks — the record does not move.

/** THE HEAD'S AGE (R168): how long since the OLDEST hand wrote the
 *  estate's copy — the stampLog's earliest entry's `at`, falling back
 *  to the flat writtenAt; null for every silence (no copy, a broken
 *  record, an unstamped one, a log of pure junk). The first hand's
 *  clock: the story's opening — never younger than the copyAge tail
 *  on any honest record. Future stamps clamp to zero, like every
 *  clock here. */
export function headAge(
  estateRaw: string | null,
  now: Date = new Date(),
): number | null {
  if (estateRaw === null) return null;
  try {
    const parsed: unknown = JSON.parse(estateRaw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const rec = parsed as Record<string, unknown>;
    let when: string | null = null;
    if (Array.isArray(rec.stampLog)) {
      for (const e of rec.stampLog as unknown[]) {
        if (typeof e !== 'object' || e === null) continue;
        const en = e as Record<string, unknown>;
        if (typeof en.at !== 'string' || !Number.isFinite(Date.parse(en.at))) continue;
        if (when === null || Date.parse(en.at) < Date.parse(when)) when = en.at;
      }
    }
    if (when === null && typeof rec.writtenAt === 'string' && Number.isFinite(Date.parse(rec.writtenAt))) {
      when = rec.writtenAt;
    }
    if (when === null) return null;
    return Math.max(0, (now.getTime() - Date.parse(when)) / 60000);
  } catch {
    return null;
  }
}

/** THE ORIGIN'S REST (R168): the row glyph's FIRST hand dims as the
 *  story's opening ages — full presence when fresh (or clockless:
 *  null keeps full presence, no clock is not a dimming — R167's
 *  law), easing to the 0.6 floor across FOUR hours. An older, slower
 *  dim: the origin rests at half the copy's pace (240′ to glyphRest's
 *  120′) and never as deep (0.6 to its 0.45) — the story's beginning
 *  holds. Linear, quantized to the thousandth. */
export function firstHandRest(ageMin: number | null): number {
  if (ageMin === null) return 1;
  const t = Math.min(1, Math.max(0, ageMin / 240));
  return Math.round((1 - 0.4 * t) * 1000) / 1000;
}

/** THE TEMPO'S TIER (R168): the tier heartbeatTempo's beat rides,
 *  named — young / settling / elder. Extracted from heartbeatVoice
 *  (whose pins stay byte-identical — composition, not duplication)
 *  so the writer line can name the beat it hears without re-deriving
 *  the mapping. */
export function tempoTier(ageMin: number | null): 'young' | 'settling' | 'elder' {
  const tempo = heartbeatTempo(ageMin);
  return tempo === 2.4 ? 'young' : tempo === 4.8 ? 'settling' : 'elder';
}

/** THE HELD SPAN'S VOICE (R168): the consent's held age in ageVoice's
 *  own grammar, WITHOUT the 'ago' — a span, not a stamp (the consent
 *  has been held THIS long, not heard from THAT long). Null speaks
 *  the honestly-empty ('no clock'). */
export function heldVoice(heldMin: number | null): string {
  if (heldMin === null) return 'no clock';
  if (heldMin < 1) return `${Math.max(0, Math.round(heldMin * 60))}s`;
  if (heldMin < 60) return `${heldMin.toFixed(1)}′`;
  return `${(heldMin / 60).toFixed(1)}h`;
}

/** THE CONSENT'S VOICE (R168): the dot's full hover — the mirror's
 *  clock when the tab has one (heartbeatVoice, byte for byte —
 *  composition, not duplication); a consent with NO mirror appends
 *  its own held age to heartbeatVoice's honest null line (young
 *  forever, and now it SAYS how long it has been young). Both clocks
 *  silent → heartbeatVoice(null), unchanged — nothing is invented. */
export function consentVoice(
  mirrorAgeMin: number | null,
  heldMin: number | null,
): string {
  if (mirrorAgeMin !== null) return heartbeatVoice(mirrorAgeMin);
  if (heldMin === null) return heartbeatVoice(null);
  return `${heartbeatVoice(null)} · consent held ${heldVoice(heldMin)}`;
}

/** THE WRITER'S CLOCK (R168): the ledger's writer line's hover — the
 *  copy's age (copyAge's own voice) and the beat the consent rides
 *  because of it (the tier named, tempoTier's own word; the beat,
 *  heartbeatTempo's own number), one line, the shared grammar. Null
 *  when the copy is silent — an absent writer has no clock. */
export function writerVoice(
  estateRaw: string | null,
  ownTabId: string,
  now: Date = new Date(),
): string | null {
  const cAge = copyAge(estateRaw, now);
  if (cAge === null) return null;
  const mAge = mirrorAge(estateRaw, ownTabId, now);
  return `the copy rests ${ageVoice(cAge)} · the consent ${tempoTier(mAge)} at ${heartbeatTempo(mAge)}s`;
}

// — R169 · THE ONE STORY — every surface of the estate tells the same
// story with the same clocks: the PANEL's legend wears the arc its row
// already wears (the legend demonstrating the settling, not just the
// hues), the writer line's CLOCK WORDS wear the hand's hue (the words
// tinted by the tab that set them), and a tier that has been crossed
// says WHEN (the tempo's own since — derived arithmetic on the mirror
// clock, never new state). All readings — the record does not move.

/** THE LEGEND'S ARC (R169): the two opacities the estate's surfaces
 *  wear — the ORIGIN dot at firstHandRest(headAge) (the opening's
 *  slow dim) and the NOW dot at glyphRest(copyAge) (the resting tail)
 *  — computed ONCE so the row glyph and the panel legend read the
 *  same pair from the same record (one story, every surface; the
 *  arc's order origin ≥ now rides inside firstHandRest ≥ glyphRest).
 *  Null when the record carries no stamp log — a surface with no
 *  glyph wears no arc (the flat-writtenAt fallback lights no dots:
 *  the legend demonstrates the LOG's hands, and a log-less record
 *  has none). */
export function legendArc(
  estateRaw: string | null,
  now: Date = new Date(),
): { origin: number; nowRest: number } | null {
  if (readEstateStamps(estateRaw).length === 0) return null;
  return {
    origin: firstHandRest(headAge(estateRaw, now)),
    nowRest: glyphRest(copyAge(estateRaw, now)),
  };
}

/** THE TIER'S OWN CLOCK (R169): when the consent's tempo crossed INTO
 *  its current tier, in the house's stamp voice — `settling · since
 *  HH:MM:SSZ` for a mirror past ten minutes, `elder · since …` past
 *  the hour. Pure arithmetic on the mirror clock (the tier boundary
 *  is a known age, so the crossing moment is now − the overshoot) —
 *  no new state, no guessed stamps. Null for every silence and for
 *  the YOUNG tier (at or under ten minutes the crossing IS the last
 *  write — 'mirrored X ago' already says it; the voice never says a
 *  thing twice). The boundary edges stay continuous: 10′+ε speaks a
 *  since of now, 60′ stays settling, 60′+ε speaks elder since now. */
export function tierSinceVoice(
  mirrorAgeMin: number | null,
  now: Date = new Date(),
): string | null {
  if (mirrorAgeMin === null) return null;
  const tier = tempoTier(mirrorAgeMin);
  if (tier === 'young') return null;
  const boundary = tier === 'settling' ? 10 : 60;
  const crossedAt = new Date(now.getTime() - (mirrorAgeMin - boundary) * 60000);
  return `${tier} · since ${crossedAt.toISOString().slice(11, 19)}Z`;
}

/** THE CONSENT'S SPOKEN LINE (R169): the dot's full hover, composed —
 *  consentVoice's own line (the R168 composition, untouched), and
 *  when the mirror's tier has been CROSSED, the tier's own since
 *  appended in the house's ' · ' litany. Young and clockless mirrors
 *  leave the line byte-identical to consentVoice (nothing is said
 *  twice; nothing is invented). */
export function consentSpokenVoice(
  mirrorAgeMin: number | null,
  heldMin: number | null,
  now: Date = new Date(),
): string {
  const base = consentVoice(mirrorAgeMin, heldMin);
  const since = tierSinceVoice(mirrorAgeMin, now);
  return since === null ? base : `${base} · ${since}`;
}

// — R170 · THE LOG'S CLOCKS — the log stops being two ends and a
// story between: EVERY hand chip ages by its OWN stamp (the origin
// keeps its slow law, every other hand rests at the now's law — a
// gradient of settling, brightest at the freshest hand), the writer
// line's voice hears the tier's crossing too (one crossing, every
// voice), and the consent's spoken line reaches the ears that cannot
// hover (the pill's aria-label carries the voice). All readings —
// the record does not move.

/** THE HANDS' RESTS (R170): one rest opacity per stamp-log entry, in
 *  the log's own order (oldest first) — the FIRST hand of a multi-hand
 *  log wears firstHandRest (the origin's slow dim across four hours),
 *  every other hand wears glyphRest (the now's law across two). The
 *  log's own stamps are the clocks: each hand ages by ITS OWN `at`,
 *  so the chips read as a gradient of settling, brightest at the
 *  freshest hand. A hand with an unreadable stamp holds full presence
 *  (no clock is not a dimming — the house's null law); future stamps
 *  clamp to zero like every clock here. Empty log → [] (no hands, no
 *  rests). Pure: the log is read, never moved. */
export function handRests(
  log: ReadonlyArray<{ by: string; at: string }>,
  now: Date = new Date(),
): number[] {
  if (log.length === 0) return [];
  return log.map((e, i) => {
    const t = Date.parse(e.at);
    const ageMin: number | null = Number.isFinite(t)
      ? Math.max(0, (now.getTime() - t) / 60000)
      : null;
    return isOriginHand(i, log.length) ? firstHandRest(ageMin) : glyphRest(ageMin);
  });
}

/** THE WRITER'S SPOKEN LINE (R170): the writer line's full hover —
 *  writerVoice's own line (the R168 clock, untouched), and when the
 *  consent's tier has been CROSSED, the tier's own since appended in
 *  the house's ' · ' litany (one crossing, every voice). A silent
 *  copy keeps writerVoice's null (an absent writer has no clock, and
 *  no crossing to speak of); a young mirror keeps the line
 *  byte-identical (the write IS the since — nothing said twice). */
export function writerSpokenVoice(
  estateRaw: string | null,
  ownTabId: string,
  now: Date = new Date(),
): string | null {
  const base = writerVoice(estateRaw, ownTabId, now);
  if (base === null) return null;
  const since = tierSinceVoice(mirrorAge(estateRaw, ownTabId, now), now);
  return since === null ? base : `${base} · ${since}`;
}

// — R171 · THE BRIDGE'S READER — the log's clocks find their words:
// the ORIGIN law is named once (which hand wears the slow rest), the
// chips speak per-hand voices (how old the hand is, at which pace it
// rests), and the estate's own glass reads the bridge's canonical
// clock beside the board's read stamp. All readings — the record
// does not move.

/** THE ORIGIN'S HAND (R171): which entry of a stamp log wears the
 *  origin's slow law — the FIRST hand, and only when there is more
 *  than one (a single hand is both ends, and both-ends law says the
 *  now's surface wins). One law, named once: handRests rests by it,
 *  the chips' voices speak by it, and the two can never drift. */
export function isOriginHand(index: number, logLength: number): boolean {
  return index === 0 && logLength > 1;
}

/** THE HAND'S VOICE (R171): a stamp-log entry's hover — how long ago
 *  the hand was heard (ageVoice's own grammar, composed) and at which
 *  pace it rests (the origin's slower pace by isOriginHand's law, the
 *  now's pace for every hand after). An unreadable stamp holds full
 *  presence and says so (no clock is not a dimming — and not a
 *  silence either). Pure arithmetic on the stamp — the record does
 *  not move. */
export function handVoice(
  at: string,
  isOrigin: boolean,
  now: Date = new Date(),
): string {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) {
    return isOrigin
      ? 'the origin — its stamp unreadable, holding full presence'
      : 'a hand with no readable clock, holding full presence';
  }
  const ageMin = Math.max(0, (now.getTime() - t) / 60000);
  return isOrigin
    ? `the origin — heard ${ageVoice(ageMin)}, resting at the slower pace`
    : `a hand ${ageVoice(ageMin)}, resting at the now’s pace`;
}

// — R172 · THE BRIDGE'S TEMPO — the clock's chip wears the writer's
// own tempo law: the canonical clock's dot beats at the tier its age
// sets (young 2.4s, settling 4.8s, elder 7.2s — heartbeatTempo's own
// numbers, ONE law from the consent's dot to the bridge's dot), the
// tier wears its name on the chip, and the hands chips speak their
// rest opacities as numbers (the badge the eye guessed, now read).
// All readings — the record does not move.

/** THE CLOCK'S AGE (R172): minutes since the canonical clock last
 *  spoke — pure arithmetic on the record's own current_utc. Null for
 *  an absent or unreadable stamp (no clock is not an age); future
 *  stamps clamp to zero like every clock here. */
export function clockAgeMin(
  currentUtc: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (typeof currentUtc !== 'string' || currentUtc.length === 0) return null;
  const t = Date.parse(currentUtc);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (now.getTime() - t) / 60000);
}

/** THE CLOCK'S BEAT (R172): the bridge dot's animation period —
 *  heartbeatTempo on the clock's age. An UNREADABLE stamp keeps the
 *  chip's R171 beat (4.8s) — the tempo it already wore; the chip only
 *  beats when the record speaks, so the fallback is the R171 law
 *  preserved, never a tier invented for a silence. */
export function clockBeat(ageMin: number | null): number {
  return ageMin === null ? 4.8 : heartbeatTempo(ageMin);
}

/** THE CLOCK'S TIER (R172): the beat's name for the chip's visible
 *  word — tempoTier's own law on the clock's age. Null for an
 *  unreadable stamp (a name is not invented for a silence). */
export function clockTier(
  ageMin: number | null,
): 'young' | 'settling' | 'elder' | null {
  return ageMin === null ? null : tempoTier(ageMin);
}

/** THE CLOCK'S SPOKEN LINE (R172): the chip's title voice — how long
 *  since the authority spoke (ageVoice's own grammar), the beat the
 *  dot rides (the tier named, the beat numbered), and — ONE LAW with
 *  the consent's since — when the tier has been CROSSED,
 *  tierSinceVoice's own since appended in the house's ' · ' litany.
 *  Young keeps the line without the since (the advance IS the since —
 *  nothing said twice); an absent or unreadable stamp keeps the null
 *  (no clock, no words). */
export function clockSpokenVoice(
  currentUtc: string | null | undefined,
  now: Date = new Date(),
): string | null {
  const age = clockAgeMin(currentUtc, now);
  if (age === null) return null;
  const base = `the authority spoke ${ageVoice(age)} · ${tempoTier(age)} at ${clockBeat(age)}s`;
  const since = tierSinceVoice(age, now);
  return since === null ? base : `${base} · ${since}`;
}

/** THE REST'S BADGE (R172): a hand's rest opacity spoken as a number —
 *  the badge text itself, printed at the thousandth the rest laws
 *  quantize to (full presence prints 1). Undefined keeps the
 *  full-presence print (no clock is not a dimming — the house's null
 *  law). */
export function restBadge(rest: number | undefined): string {
  return `${rest ?? 1}`;
}

/** THE REST'S VOICE (R172): the badge's title — the number named as
 *  presence, and which law it rides (the origin's slower law across
 *  four hours, the now's law across two). An absent rest speaks the
 *  full-presence honesty. */
export function restVoice(rest: number | undefined, isOrigin: boolean): string {
  const law = isOrigin
    ? 'the origin’s slower law (four hours)'
    : 'the now’s law (two hours)';
  return rest === undefined
    ? 'presence 1 — no clock, holding full presence'
    : `presence ${rest} — ${law}`;
}

// — R173 · THE HEARD TEMPO — the bridge's tempo reaches the readers
// who cannot hover: the chip's spoken line becomes an aria-label (the
// screen reader hears what the cursor learned in R172), and the tier
// wears a HUE — one color per name, on the chip's face and the dot
// alike, so the tempo class is visible before it is audible. All
// readings — the record does not move.

/** THE TIER'S HUE (R173): the color the clock's tier wears — young
 *  keeps the R171 cyan (a fresh clock looks exactly as it always
 *  did), settling deepens to teal (the half-way quiet), elder cools
 *  to slate (the old, slow authority). A tierless clock (spoken but
 *  unparseable) keeps the R171 cyan — the same law clockBeat keeps:
 *  R171's face, preserved, never a color invented for a silence. */
export function clockTierHue(
  tier: 'young' | 'settling' | 'elder' | null,
): string {
  if (tier === 'settling') return '#4fa8a0';
  if (tier === 'elder') return '#8090a8';
  return '#7ac8d0';
}

// — R174 · THE HEARD PARITY — the last hover-only clocks reach the
// ears, and the tier gains a SHAPE: the writer line's clock spoken in
// its own aria (the ears that cannot hover hear what the cursor
// learned — the chip's own R173 lesson, carried to the panel), the
// unstamped copy honest out loud, the standing row's two-dot story
// heard, and the tier wears a glyph beside its word (a second channel
// for the color-blind eye — the glyph never speaks; the word and the
// aria already do). All readings — the record does not move.

/** THE TIER'S SHAPE (R174): one glyph per tier name — the tempo made
 *  visible without color (the color-blind reader's second channel,
 *  and the elder slate's loudness answered). young '◦' (the fresh
 *  point), settling '◔' (the half-turned disc), elder '○' (the full,
 *  slow circle). A tierless clock wears NO glyph (R171's law: nothing
 *  is invented for a silence — the empty string IS the honesty).
 *  Pure: a name in, a shape out. */
export function tierGlyph(
  tier: 'young' | 'settling' | 'elder' | null,
): string {
  if (tier === 'settling') return '◔';
  if (tier === 'elder') return '○';
  if (tier === 'young') return '◦';
  return '';
}

/** THE WRITER LINE'S EAR (R174): the writer line's full spoken line —
 *  the provenance named first ('written by tab-X'), then the R168
 *  clock with R169's crossing (writerSpokenVoice's own line, byte for
 *  byte — composition, never duplication); a silent copy says so
 *  honestly (the title's own fallback, now shared law). The aria the
 *  ears that cannot hover were owed. */
export function writerLineAria(
  writtenBy: string,
  estateRaw: string | null,
  ownTabId: string,
  now: Date = new Date(),
): string {
  const clock = writerSpokenVoice(estateRaw, ownTabId, now);
  return `written by ${writtenBy} — ${clock ?? 'the copy\u2019s clock is silent'}`;
}

/** THE UNSTAMPED'S VOICE (R174): the v1 copy's spoken line — the copy
 *  rides but carries no writer stamp, and the next fold click will
 *  claim it for THIS tab (the tab's own id, named). The honesty the
 *  title speaks, now heard without hovering. */
export function unstampedWriterVoice(ownTabId: string): string {
  return `the estate\u2019s copy rides but carries no writer stamp — a v1 memory; the next fold re-stamps it with this tab\u2019s id (${ownTabId})`;
}

/** THE ROW GLYPH'S STORY (R174): the standing row's two dots, spoken
 *  — the opening's clock (headAge → ageVoice) and the tail's clock
 *  (copyAge → ageVoice), one line each in the house's litany. A clock
 *  that does not read speaks ageVoice's own honest null ('no mirror
 *  yet') — never invented, never omitted. Null raw → null (the
 *  component renders no glyph without a record, and a voice follows
 *  its glyph). */
export function rowGlyphAria(
  estateRaw: string | null,
  now: Date = new Date(),
): string | null {
  if (estateRaw === null) return null;
  return `the memory\u2019s story — the opening heard a hand ${ageVoice(headAge(estateRaw, now))}; the last hand ${ageVoice(copyAge(estateRaw, now))}`;
}

// — R175 · THE HONEST SHAPES — the chip's two silences wear their own
// marks (a silence is never dressed as a tier: the tiers are earned
// by time, the silences are honest absences), and the panel legend's
// arc — the last silent visual on the estate's surfaces — is heard:
// its dots' rests spoken in the badge's own numbers. All readings —
// the record does not move.

/** THE SILENCE'S SHAPE (R175): one mark per honest silence —
 *  unreachable '◌' (the DOTTED circle: the circle the clock should
 *  wear, drawn as absent), waiting '∙' (the small mark before any
 *  beat). Never a tier's shape (◦◔○ are earned by time; a silence
 *  wearing one would be a lie). Pure: a state in, a mark out. */
export function silenceGlyph(state: 'unreachable' | 'waiting'): string {
  return state === 'unreachable' ? '\u25CC' : '\u2219';
}

/** THE LEGEND'S EAR (R175): the panel legend's arc, spoken — the hue
 *  law's own voice first (HUE_LEGEND_VOICE, byte for byte), then the
 *  arc's rests in the badge's own numbers (the origin's slow dim,
 *  the now's resting — the same numbers the eye sees). A two-dot
 *  legend speaks both; a single-dot legend speaks the now's alone
 *  (one dot, one law). Null arc → null (no arc, no aria — the voice
 *  follows its surface; the legend's visible text still speaks). */
export function legendArcAria(
  arc: { origin: number; nowRest: number } | null,
  dots: number,
): string | null {
  if (arc === null) return null;
  const line = dots >= 2
    ? `the origin\u2019s dot rests at ${restBadge(arc.origin)}, the now\u2019s at ${restBadge(arc.nowRest)}`
    : `the now\u2019s dot rests at ${restBadge(arc.nowRest)}`;
  return `${HUE_LEGEND_VOICE} — the legend\u2019s arc: ${line}`;
}

// — R176 · THE STANDING STORY — the standing state line (the last
// unaria'd text surface on the estate's row) is heard: the state it
// shows and the arrival it remembers, spoken without hovering. And
// the QA seed becomes DURABLE: the named three-hand fixture, once a
// per-profile browser-eval one-off, is now an engine-built record a
// dev-only flag can lay down on any fresh profile — the same story
// (head 120′, middle 70′, tail 20′) replayable at any wall clock.
// All readings — the record does not move.

/** THE STATE LINE'S VOICE (R176): the standing row's state, spoken —
 *  the state clause mirrors the line's own words (riding / own /
 *  adopted-available / none, the fold count with its plural law),
 *  the arrival clause speaks when the memory ARRIVED by adoption
 *  (the captured story, not a live re-read — the same law the title
 *  and the footer follow). Composition, never duplication: the
 *  clauses are the title's own story, ordered state-then-arrival. */
export function stateLineAria(
  estateOn: boolean,
  openCount: number,
  origin: FoldMemoryOrigin,
  arrival: FoldMemoryOrigin,
): string {
  const folds = `${openCount} fold${openCount === 1 ? '' : 's'} held`;
  const state = estateOn
    ? `the estate rides — ${folds}, mirrored beyond this tab`
    : origin === 'own'
      ? `session-local — ${folds}, the memory dies with this tab`
      : origin === 'adopted'
        ? 'session-local — the estate holds a memory this tab could adopt'
        : 'session-local — no memory anywhere yet';
  const came = arrival === 'adopted'
    ? '; this tab\u2019s memory arrived by adoption at its first mount'
    : '';
  return `the standing state — ${state}${came}`;
}

/** The dev seed's flag key (R176): one name, shared by the applier,
 *  the QA evals, and the suite. 'on' arms the loader. */
export const DEV_SEED_FLAG_KEY = 'vvu.watchboard.devseed';

/** THE DURABLE SEED (R176): the named three-hand fixture, built —
 *  pure, from a now — as the estate record's exact bytes: the head
 *  hand 120′ old (tab-seed), the middle 70′ (tab-other), the tail
 *  20′ (tab-seed), the writer's stamp the seed hand's (tab-seed at
 *  the tail's instant), two folds left open as dated stamps (compass
 *  at the head's instant, moverLadder at the middle's — the when IS
 *  the openness), four closed. The ages are RELATIVE to the given
 *  now: the same story lays down fresh at any wall clock and ages
 *  live from there (the tier clocks, the legend's arc, the greeting
 *  — all read real arithmetic immediately). The optin rides 'on' —
 *  the estate story is what the seed is FOR. Purity: now in, bytes
 *  out; nothing reads the clock here. */
export function buildDevSeedFixture(now: Date): {
  record: string;
  optin: 'on';
} {
  const at = (ageMin: number) =>
    new Date(now.getTime() - ageMin * 60_000).toISOString();
  const head = at(120);
  const middle = at(70);
  const tail = at(20);
  const record = {
    moverLadder: middle,
    keepers: false,
    compass: head,
    below: false,
    unruledRows: false,
    turnEnders: false,
    writtenBy: 'tab-seed',
    writtenAt: tail,
    stampLog: [
      { by: 'tab-seed', at: head },
      { by: 'tab-other', at: middle },
      { by: 'tab-seed', at: tail },
    ],
  };
  return { record: JSON.stringify(record), optin: 'on' };
}

// — R177 · THE ASKED CONSENT — the board's two mechanical buttons are
// given their voices and their manners: the REREAD button speaks its
// state (a read never appends — the law now heard, not just hovered),
// and the estate switch's WITHDRAW — the one destructive action on
// the row — learns to ASK: the first click arms, the second (inside
// the window) erases. All readings — the record does not move.

/** The withdraw arm's window (R177): how long the armed confirm
 *  stays armed before disarming itself — long enough to read the
 *  warning, short enough not to trap the click. A named constant so
 *  the suite and the component can never drift apart. */
export const WITHDRAW_ARMED_MS = 4000;

/** THE REREAD'S WINDOW (R181): how long the asked read's home-flash
 *  and its spoken completion stay lit after a clicked REREAD lands —
 *  long enough to hear and see the read came home, short enough to
 *  go quiet before the next pass. A named constant so the suite and
 *  the component can never drift apart. */
export const REREAD_HOME_MS = 2600;

/** THE REREAD'S VOICE (R177, widened R181): the header's REREAD
 *  button, spoken — the title's own law (one route, one journal
 *  parse; a read never appends; the sampler rides separately), the
 *  busy state when the read is in flight, and NOW the completion:
 *  the ASKED read's home line, the census in the board's own numbers
 *  (the caption's own words — rows READ LIVE), spoken once through
 *  the sibling live region and never by the unasked passes (the
 *  mount and the 60s interval stay silent — the completion belongs
 *  to the click; a failed read never says home). Pure: a boolean and
 *  an optional census in, a line out; the R177 bytes never moved. */
export function rereadVoice(
  busy: boolean,
  opts?: { justRead?: boolean; rows?: number; hot?: number },
): string {
  if (busy) {
    return 'reading now — every watch\u2019s home engine, one route, one journal parse; a read never appends';
  }
  if (opts?.justRead) {
    const rows = opts.rows ?? 0;
    const hot = opts.hot ?? 0;
    return `the board is home — ${rows} row${rows === 1 ? '' : 's'} read live, ${hot} live tension${hot === 1 ? '' : 's'}, the reads are the record\u2019s own`;
  }
  return 're-read every watch\u2019s home engine (one route, one journal parse) — a read never appends; the ledger\u2019s sampler rides after it, separately';
}

// — R182 · THE LANES' VOICES — the five lane panels' own REREAD
// buttons are heard: the log tail, the memory, the lens, the journal
// and the curve, the boot journal. ONE shared law, five subjects —
// the idle offer carries the lane's own action words plus the shared
// cadence law (the lane re-reads itself every 60s; a re-read is cheap
// and honest), the busy line names the lane's read in flight. The
// per-lane depth (the memory's 30s refusal, the lens's no-store law)
// stays in each button's title — composition, not duplication. All
// readings — the lanes do not move.

/** The lane REREAD's subject — the lane's own action words, spoken
 *  as the offer's object. A narrow union: a lane cannot invent a
 *  subject the house has not named. */
export type LaneRereadSubject =
  | 'the log tail'
  | 'the memory'
  | 'the lens'
  | 'the journal and the curve'
  | 'the boot journal';

/** THE LANE'S REREAD VOICE (R182): the lane panel's spoken button —
 *  the offer names the lane's own object with the shared cadence law
 *  (the 60s self-read every lane keeps), the busy line names the
 *  lane's read in flight. Pure: a subject and a boolean in, a line
 *  out. */
export function laneRereadVoice(subject: LaneRereadSubject, busy: boolean): string {
  return busy
    ? `reading ${subject} now — the lane\u2019s own read is in flight`
    : `re-read ${subject} now — the lane re-reads itself every 60s; a re-read is cheap and honest`;
}

// — R183 · THE LANES' RETURN — the asked lane read now ARRIVES: the
// five lane REREADs keep their R182 offer and flight voices unchanged,
// and the landing gains its own voice — one shared home law, five
// subjects, the arrival stamped in the house's UTC voice, the
// record's-own clause the board's completion speaks (R181) scoped to
// the lane. The completion belongs to the click: the mount and the
// 60s self-read stay silent, and a failed read never reaches this
// voice at all (the component announces on success only). All
// readings — the lanes do not move.

/** THE LANE'S HOME VOICE (R183): the asked lane read's completion —
 *  the lane's read is home, the landing stamped with its own instant
 *  (the stamp's UTC voice — HH:MM:SS, the clock face the house
 *  already speaks) and the record's-own clause, lane-scoped. Pure: a
 *  subject and an ISO instant in, a line out — the caller owns the
 *  clock (the engine never reads one). The home line never speaks the
 *  cadence (that belongs to the offer) and never speaks a census the
 *  lane did not hand it — the arrival itself is the announcement. */
export function laneRereadHomeVoice(subject: LaneRereadSubject, at: string): string {
  return `${subject}\u2019s read is home — landed at ${stampVoice(at)} UTC; the lane\u2019s numbers are the record\u2019s own`;
}

// — R184 · THE TAIL'S VOICE — the ledger's COPY TAIL is heard: the
// digest's own export button (COPY DIGEST, R179) already speaks its
// offer and its arrival; the tail's export has hung silent since
// R131 — a keyboard-reachable control whose very purpose (the depth
// it exports, the honesty of what an export is) lived in the title
// alone. One button, two states, the census in the surface's own
// numbers — the same locals the chip beside the button prints. All
// readings — the clipboard does not move.

/** THE TAIL'S COPY VOICE (R184): the ledger's COPY TAIL, spoken —
 *  the offer names the export (the open tail as JSON) with the
 *  tail's own census: the moved samples, the flips with the plural
 *  law, the span in the surface's own rounding law (≥100 rounds,
 *  below speaks one decimal — the chip's own expression, so the
 *  ears hear exactly what the eyes see) and the export's honesty
 *  clause (an export is a reading, not a write). The arrival names
 *  what landed and what did not move. A null span drops the span
 *  clause — the voice never invents a length the tail did not hand
 *  it. Pure: a boolean and the census in, a line out. */
export function copyTailAria(
  copied: boolean,
  census: { samples: number; flips: number; spanMin: number | null },
): string {
  const flips = `${census.flips} flip${census.flips === 1 ? '' : 's'}`;
  const samples = `${census.samples} moved sample${census.samples === 1 ? '' : 's'}`;
  const span =
    census.spanMin === null
      ? ''
      : ` across ${census.spanMin >= 100 ? Math.round(census.spanMin) : census.spanMin.toFixed(1)}\u2032`;
  if (copied) {
    return `copied — the tail is on the clipboard: ${flips}${span}, nothing on the estate moved`;
  }
  return `copy the open tail as JSON — ${samples}, ${flips}${span}, the read\u2019s own words riding; an export is a reading, not a write`;
}

// — R185 · THE RAIL'S VOICES — the ledger's two rail controls whose
// accessible name is a bare datum are heard: the depth chips (their
// whole name is the number — a screen reader hears "button, 24" with
// no context) and the ALL reset (its name is a word that names no
// deed). One cohort, five buttons, the deed spoken and the state
// named — the offer speaks the deed, the state line names what IS
// and never offers. The census chips beside the ALL stay silent by
// the house's own dissolve law (their visible text reads the row and
// the count). All readings — the rails do not move.

/** THE DEPTH CHIP'S VOICE (R185): one depth chip, spoken — the offer
 *  names the read (the newest N moved samples, the store's own bound
 *  named once) and the state line names the open depth with no verb.
 *  The number rides as the chip prints it — digits, one truth two
 *  mouths. Pure: a depth and a boolean in, a line out. */
export function depthChipAria(n: number, active: boolean): string {
  return active
    ? `${n} moved samples — the ledger\u2019s open depth`
    : `read the newest ${n} moved samples — the ledger\u2019s depth (the store keeps 200)`;
}

/** THE RAIL'S RESET VOICE (R185): the ALL button, spoken — the offer
 *  names the clearing (every flip, newest first, the row's filter
 *  let go) and the state line names the unfiltered calm with no
 *  verb. Pure: a boolean in, a line out. */
export function filterAllAria(active: boolean): string {
  return active
    ? 'every flip shows, newest first — no row filter rides'
    : 'show every flip in the tail, newest first — clear the row\u2019s filter';
}

// — R186 · THE ASKED HANDS — the workspace's destructive two-step
// controls are heard: the mini-fleet's RESTART (the guardian's own
// discipline, offered per port, the ask armed by a second click) and
// the DRILL CONTROL's arm-confirm-disarm triple. The house's own ask
// law (R177's withdraw) scoped to the guard's hands: the idle line
// offers the deed and says the first click only asks; the armed line
// names the commit and the escape window — ONE named constant
// (ARMED_WINDOW_MS) shared by the timers and the voices, so the ears
// hear the same 5s the hands live under. The in-flight spans speak
// the state without the elapsed seconds (the seconds are the eyes'
// own show; a live region re-announcing every second would be noise,
// not a voice). All readings — the guard does not move.

/** THE ASK'S WINDOW (R186): the arm-then-confirm window both
 *  destructive controls live under — the timers consume it and the
 *  voices speak it, one truth two mouths. */
export const ARMED_WINDOW_MS = 5000;

/** THE RESTART'S VOICE (R186): the mini-fleet's per-port restart —
 *  the offer names the deed and the discipline (the guardian's own
 *  ladder: kill tree, port free, daemonize, the healthy answer) and
 *  says the first click only asks; the armed line names the commit
 *  and the escape window. Pure: a port and a boolean in, a line
 *  out. */
export function restartVoice(port: number, armed: boolean): string {
  return armed
    ? `armed — click again to restart :${port} now; do nothing and the ask escapes within ${ARMED_WINDOW_MS / 1000}s`
    : `restart :${port} — the guardian\u2019s own discipline (kill tree, port free, daemonize, wait for the healthy answer); the first click asks`;
}

/** THE RESTART'S FLIGHT (R186): the in-flight span's one line — the
 *  bounce named, no seconds (the elapsed count is the eyes' own
 *  show; the voice names the state once). */
export function restartFlightVoice(port: number): string {
  return `:${port} is restarting — the guardian\u2019s discipline is in flight`;
}

/** THE DRILL'S VOICE (R186): the self-test's two-state arm — the
 *  offer names what fires (a throwaway victim on a scratch port,
 *  :3000 asserted untouched); the armed line names the commit (real
 *  processes) and the escape window. Pure: a boolean in, a line
 *  out. */
export function drillVoice(armed: boolean): string {
  return armed
    ? `armed — the second click spins real processes; do nothing and the ask escapes within ${ARMED_WINDOW_MS / 1000}s`
    : 'arm the guardian self-test — a throwaway victim on a scratch port; :3000 asserted untouched';
}

/** THE ASK'S RETREAT (R186): the DISARM button, spoken — the deed is
 *  the ask's escape, the drill never fired. */
export function disarmVoice(): string {
  return 'disarm the ask — the drill does not fire';
}

/** THE DRILL'S FLIGHT (R186): the in-flight span's one line — the
 *  drill named, no seconds. */
export function drillFlightVoice(): string {
  return 'the drill is in flight — real processes on the scratch port';
}

// — R190 · THE PRE-FILTERED LOAD — the capture choreography: the
// board's row-filter voices (R189) only SPEAK their active line
// while a filter rides, and every capture path to that state ran
// through a live click (the CDP wedge's favorite meal). The devseed
// family gains its composition flag: a second key names a row id,
// the board's filter state reads it at first render, and the
// filtered board EXISTS on load — the ALL button, the pressed
// chips, and the narrowed list all speak in the first window,
// click-free. Dev-only (the production build never reads it), and
// honest about failure: a missing store, a missing flag, or an
// empty ask all read as NO filter — a broken seed never fights the
// board. All pure.

/** THE DEVSEED FILTER KEY (R190): the composition flag's one name —
 *  set it to a row id and the board loads with that row's filter
 *  already riding. One shared name, like its sibling seed key. */
export const DEVSEED_FILTER_FLAG_KEY = 'vvu.watchboard.devseed.filter';

/** THE PRE-FILTER READER (R190): the board's first-render read —
 *  the flag's value trimmed; an empty ask is no ask (null, not an
 *  id of thin air); a store that refuses (the SecurityError the
 *  storm's bounced loads taught us) reads as no filter too. Pure:
 *  a storage-like in, an id or null out. */
export function readDevseedFilterFlag(store: Pick<Storage, 'getItem'> | null): string | null {
  if (!store) return null;
  try {
    const raw = store.getItem(DEVSEED_FILTER_FLAG_KEY);
    if (raw === null) return null;
    const id = raw.trim();
    return id === '' ? null : id;
  } catch {
    return null;
  }
}

// — R193 · THE HEARD ARRIVALS — the async states only the eye saw:
// the panels' failure strips mounted honest red text that a screen
// reader never announced (R188's own law — a mount is not a label
// swap, the news rides a live region — was applied to the PWA's
// waiting pulse but never to the READ failures), and the
// chronicle's match count spoke its narrowing law only through a
// hover title. The law: a failure announces itself once, with its
// reason when one exists and never invented; a count names its own
// law on inspection. All pure.

/** THE FAILURE'S VOICE (R193): a read that just failed, spoken
 *  once at the strip's mount — the surface named, the reason riding
 *  when the error carries one (never invented when it doesn't), the
 *  honesty clause and the deed closing (the records never move; the
 *  panel retries on its own cadence). Pure. */
export function readFailureAria(source: string, detail: string | null): string {
  const reason = detail ? `: ${detail}` : '';
  return `${source} — the read just failed${reason}. The records never move; the panel retries on its own cadence`;
}

/** THE MATCH COUNT'S VOICE (R193): the search's result line, named
 *  — the count as the eye reads it (matched of the class's own
 *  total) and the narrowing law the title always carried (the
 *  search narrows a filter, it never broadens one), hearable on
 *  inspection without the hover. The ask rides verbatim. Pure. */
export function chronicleMatchAria(matched: number, total: number, ask: string): string {
  return `${matched} of ${total} events match “${ask}” — the search narrows the class filter, it never broadens one`;
}

// — R192 · THE NAMED PATHS AND THE OPENED WITNESS — the link-name
// audit and the choreography's third flag. The estate's paths are
// heard: five external links opened a new tab with no spoken
// boundary (a reader following "RAW ↗" never heard that the estate
// ends and a new tab begins); the ↗ glyphs rode INSIDE the spoken
// names; and the docs renderer gave its external hrefs no boundary
// at all. The law: a link's deed must be hearable, its boundary
// must be heard BEFORE the follow (never discovered after), and a
// glyph is for the eye only (R186's twin law). And the witness
// gains its flag: the devseed family's third key pre-opens the
// FIRST witness fold on load — the expanded witness voice (R191's
// suite-pinned remainder) exists click-free, the capture
// choreography composed again. All pure.

/** THE EXTERNAL PATH'S VOICE (R192): a link that leaves the
 *  estate, spoken — the printed name rides verbatim, the deed
 *  names what the path leads to, and the boundary is heard (a new
 *  tab, beyond the estate) before the follow, never after. Pure:
 *  a name and a deed in, a line out. */
export function externalLinkAria(name: string, deed: string): string {
  return `${name} — ${deed} — a new tab beyond the estate`;
}

/** THE DEVSEED WITNESS KEY (R192): the choreography's third flag —
 *  set it to 'open' and the crash-witness accordion's FIRST row
 *  loads unfolded: the expanded voice exists on load, click-free.
 *  One shared name, like its siblings. */
export const DEVSEED_WITNESS_FLAG_KEY = 'vvu.watchboard.devseed.witness';

/** THE WITNESS FLAG READER (R192): the first-render read, honest
 *  about every absence — a missing store, a missing flag, and any
 *  value that is not the open-word all read as CLOSED (a broken
 *  seed never fights the accordion). Pure: a storage-like in, a
 *  boolean out. */
export function readDevseedWitnessFlag(store: Pick<Storage, 'getItem'> | null): boolean {
  if (!store) return false;
  try {
    return store.getItem(DEVSEED_WITNESS_FLAG_KEY) === 'open';
  } catch {
    return false;
  }
}

// — R191 · THE FOLDS AND THE CLASSES — the census's last quiet
// rooms, heard: the digest's top-mover chip folds the mover ladder
// (R152–R156's own feature) but its accessible name was glyph soup
// (caret, restore-mark, name and count glued) and its expanded
// state was never spoken; the guardian journal's WITNESS fold-chips
// carried aria-expanded but no voice at all (what does unfolding
// SAY? the dying boot's own log — the title's own words); and the
// estate chronicle's class filter chips (ALL, SAVES, DRILLS,
// SNAPSHOTS, SYNCS, FLEET OPS, VERDICTS) toggled with aria-pressed
// but no offer and no state line — R189's law unapplied to the
// chronicle's own family. One law again: a control's state must be
// hearable, and the name the eye reads rides verbatim (R189's name
// law — the aria-label replaces the accessible name, so the printed
// name rides every line whole). All pure.

/** THE WITNESS FOLD'S VOICE (R191): the guardian journal's
 *  fold-chip, spoken — the name the chip prints rides verbatim; the
 *  collapsed line offers the deed in the title's own words (the
 *  dying boot's own log, captured before the kill); the open line
 *  names the state with no verb. The bound rides when the tail is
 *  bounded — older lines exist, the honesty the title already
 *  speaks. Pure: a printed name, a boolean and a bound in, a line
 *  out. */
export function witnessFoldAria(name: string, open: boolean, truncated: boolean): string {
  const bound = truncated ? ' — the tail is bounded, older lines exist' : '';
  return open
    ? `${name} — the dying boot’s own log, unfolded${bound}`
    : `${name} — unfold the boot’s own log, captured before the kill${bound}`;
}

/** THE MOVER FOLD'S VOICE (R191): the digest's top-mover chip,
 *  rescued from glyph soup — the mover's own name and its moves ride
 *  (R152's busiest row, the count as the chip prints it), the
 *  collapsed line offers the ladder in R153's own words (the tail's
 *  three heaviest movers), the open line names the state with no
 *  verb. Pure. */
export function moverFoldAria(name: string, count: number, open: boolean): string {
  const who = `top mover ${name} — ${count} move${count === 1 ? '' : 's'} in the tail’s span`;
  return open
    ? `${who} — the mover ladder, unfolded`
    : `${who} — unfold the mover ladder, the tail’s three heaviest movers`;
}

/** THE CHRONICLE CLASS CHIP'S VOICE (R191): one law for the
 *  chronicle's class filters — the offer names the narrowing with
 *  the house's own verb (filter the chronicle) and the count the
 *  chip prints; the active line names the state with no verb. The
 *  count's singular rides honest (one event is one event). Pure. */
export function chronicleClassChipAria(label: string, count: number, active: boolean): string {
  const n = `${count} event${count === 1 ? '' : 's'}`;
  return active
    ? `${label} — the chronicle’s open filter, ${n}`
    : `filter the chronicle to ${label} — ${n}`;
}

/** THE CHRONICLE'S RESET VOICE (R191): the ALL chip, spoken — the
 *  clearing named (every class, the filter let go) and the state
 *  line calm with no verb, the count riding as the chip prints it.
 *  Pure. */
export function chronicleAllChipAria(count: number, active: boolean): string {
  const n = `${count} event${count === 1 ? '' : 's'}`;
  return active
    ? `every class shows — no class filter rides, ${n}`
    : `show every class in the read — clear the class filter — ${n}`;
}

// — R189 · THE PRESSED ROWS — the ledger's row-filter toggles are
// heard: four families of chips click the same filter (the flips
// list narrows to one row's motion) and NONE of them said so — the
// concentration chip, the birth ladder's chips, the weight bar's
// segments, and the company pairs all toggled with their state
// living only in a lime tint (aria-pressed absent), and the weight
// bar's segments were worse: EMPTY buttons, no accessible name at
// all — a screen reader heard "button" with no row, no share, no
// deed. The house's two-voice law (R185's depth chips, the rail's
// own founder) scoped to the rows: the idle line offers the read
// (the tail through this row), the active line names the state
// with NO verb (the ledger's open filter). The row's own name
// rides every line — a name replaced by an aria-label is a name
// the label must carry back. All pure.

/** THE ROW FILTER'S VOICE (R189): one law for the four toggle
 *  families (concentration, births, weights, company pairs) — the
 *  offer names the read through the row and the deed (the house's
 *  own words: filter the flips list to this row); the active line
 *  names the state without a verb. Pure: a name and a boolean in,
 *  a line out. */
export function rowFilterChipAria(name: string, active: boolean): string {
  return active
    ? `${name} — the ledger\u2019s open filter, this row\u2019s flips alone`
    : `read the tail through ${name} — filter the flips list to this row`;
}

// — R188 · THE STATE'S WHY — the controls whose STATES lived only in
// titles (or only in silence): the RECORD READING button's four
// voices (the offer, the ritual closer, the unrecordable refusal,
// the flight) were title-only — a screen reader heard "RECORD
// READING button" with no ritual named, no honesty clause, and no
// reason spoken when the button refused to enable. The PWA shell's
// waiting state was a pulse the ear never saw (a mount is not a
// label swap, so the news rides a live region of its own). The
// chronicle's JSON/CSV exports went dark when unread — disabled
// with no WHY. The law this round: a control's state must be
// hearable, and a refusal must speak its reason (the house's own
// words ride: an export of nothing would be an invention). All
// pure — states in, lines out.

/** THE CLOSER'S VOICE (R188): the RECORD READING button, spoken —
 *  four states, one law each. Unrecordable: the refusal names its
 *  reason (which of the two needs is missing — the climb, the
 *  counter, or both). Recordable: the offer carries the honesty
 *  clause (the client sends no numbers — the server re-reads its
 *  own sources and classifies; the cooldown named). The ritual
 *  closer names the settle pair it completes and the boot that
 *  holds the waiting first reading. Pure. */
export function recordReadingAria(state: {
  recordable: boolean;
  ritualCloseable: boolean;
  bootPid: number | null;
  missingClimb: boolean;
  missingCounter: boolean;
}): string {
  if (!state.recordable) {
    const why =
      state.missingClimb && state.missingCounter
        ? 'the boot-scoped climb and the armed traffic counter are both still missing'
        : state.missingClimb
          ? 'the boot-scoped climb is not read yet'
          : 'the traffic counter is not armed yet';
    return `no reading to record yet — a ledger row needs a boot-scoped climb and an armed traffic counter; ${why}`;
  }
  const honesty =
    'the client sends no numbers; the server re-reads its own sources and classifies; a 60s cooldown per boot keeps the ledger readable';
  return state.ritualCloseable
    ? `close the two-reading ritual — boot ${state.bootPid ?? '?'} holds one reading; this recording completes its settle pair; ${honesty}`
    : `record this moment as a ledger row — ${honesty}`;
}

/** THE RECORD FLIGHT'S VOICE (R188): the recording span, spoken —
 *  the state without the seconds (R186's flight law), the server's
 *  own hands named (it appends, not the client), the arrival path
 *  named (a toast). Pure. */
export function recordFlightAria(): string {
  return 'recording — the server is re-reading its own sources and will append the row itself; the answer arrives as a toast';
}

/** THE SHELL WAIT'S VOICE (R188): the PWA's UPDATE WAITING button,
 *  spoken — the state named (a newer shell is downloaded, not
 *  applied), the deed named (the reload applies it), the boundary
 *  named (the swap moves the shell, never the estate's records).
 *  Pure. */
export function pwaReloadAria(): string {
  return 'reload to apply the newer shell — a newer app shell is downloaded and waiting; the reload swaps the shell in place, the estate\u2019s records never move';
}

/** THE SHELL WAIT'S ANNOUNCEMENT (R188): the visually-hidden status
 *  line that speaks ONCE when the waiting state arrives — a mount
 *  is not a label swap, so the news rides a live region of its own
 *  (the house's sr-only + aria-live idiom). Pure. */
export function pwaWaitingAnnouncement(): string {
  return 'a newer app shell is downloaded and waiting — the reload control is ready when you are';
}

/** THE CHRONICLE EXPORTS' VOICE (R188): the JSON/CSV pair, spoken —
 *  the offer names the payload each format carries and the
 *  client-side build law (the ledgers are not touched); the
 *  disabled line carries the WHY in the house's own words: an
 *  export of nothing would be an invention. Pure. */
export function chronicleExportAria(fmt: 'json' | 'csv', read: boolean): string {
  const body =
    fmt === 'json'
      ? 'export the chronicle as JSON — the machine-readable bundle: events, totals, sources and the calibration block, exactly what the reading returned'
      : 'export the chronicle as CSV — one row per event with the calibration section below, the spreadsheet walk';
  if (!read) {
    return `${body} — disabled: the chronicle has not been read yet; an export of nothing would be an invention`;
  }
  return `${body}; built client-side from the reading — the ledgers are not touched`;
}

// — R187 · THE COPIED HANDS — the workspace's clipboard family is
// heard: the copy controls and the export whose deeds all end at
// the clipboard (or the export file) but whose states lived only
// in visible text — a screen reader heard "COPY MIX button" and
// never heard the arrival. The house's own two-voice law (R184's
// COPY TAIL, the family's founder) scoped to the remaining hands:
// the idle line offers the deed with its honesty clause (the
// clipboard is the only thing a copy writes — an export is a
// reading, not a write — a re-read is a pure GET and writes
// nothing), the copied line names what landed AND what did not
// move (every copied line ends: nothing on the estate moved). The
// chronicle strip's RE-READ — the seventh REREAD, the one the
// R183 sweep's six lanes missed — speaks its cadence and its
// flight (no seconds; R186's flight law). All readings — the
// clipboard is not the estate.

/** THE TRAFFIC MIX'S VOICE (R187): the COPY MIX button, spoken —
 *  the offer names the format and the hunt it serves; the arrival
 *  names the clipboard and the stillness. Pure: a boolean in, a
 *  line out. */
export function copyMixAria(copied: boolean): string {
  return copied
    ? 'copied — the mix is on the clipboard; nothing on the estate moved'
    : 'copy the traffic mix as TSV — routes, counts, shares, for the leak-hunt log; the clipboard is the only thing a copy writes';
}

/** THE VERDICT'S VOICE (R187): the COPY VERDICT button, spoken —
 *  the offer names the paste-ready payload (the raw numbers ride);
 *  the arrival names the clipboard and the stillness. Pure. */
export function copyVerdictAria(copied: boolean): string {
  return copied
    ? 'copied — the verdict is on the clipboard; nothing on the estate moved'
    : 'copy the verdict with its raw numbers — paste-ready for the leak-hunt log; the clipboard is the only thing a copy writes';
}

/** THE ARM COMMAND'S VOICE (R187): the COPY · ARM button, spoken —
 *  the offer names the one-line command and where it goes; the
 *  arrival names the clipboard and the stillness. Pure. */
export function copyArmAria(copied: boolean): string {
  return copied
    ? 'copied — the arm command is on the clipboard; nothing on the estate moved'
    : 'copy the guardian\u2019s arm command — one line, paste-ready where the guardian runs; the clipboard is the only thing a copy writes';
}

/** THE READING LINK'S VOICE (R187): the chronicle's COPY LINK, spoken —
 *  the offer names what rides the URL (the filter and the search,
 *  reopened applied); the arrival names the clipboard and the
 *  stillness. Pure. */
export function copyLinkAria(copied: boolean): string {
  return copied
    ? 'copied — the reading\u2019s link is on the clipboard; nothing on the estate moved'
    : 'copy a link to this reading — the class filter and the search ride the URL and reopen applied; the clipboard is the only thing a copy writes';
}

/** THE EXPORT'S VOICE (R187): the chronicle's EXPORT button, spoken —
 *  its visible name was a bare verb with no object; the offer names
 *  the payload and the wrapper, and R184's honesty clause rides:
 *  an export is a reading, not a write. One line — an export has
 *  no copied state (the file lands in the browser's own hands). */
export function exportLedgerAria(): string {
  return 'export the full ledger as JSON — every row the read returned, wrapped with the export time and the source path; an export is a reading, not a write';
}

/** THE STRIP'S RE-READ VOICE (R187): the seventh REREAD — the
 *  chronicle strip's own, missed by the R183 six-lane sweep — spoken:
 *  the offer names the read and its cadence, the flight names the
 *  fetch without the seconds. Pure: a boolean in, a line out. */
export function rereadStripAria(reading: boolean): string {
  return reading
    ? 'reading the ledger file — the strip\u2019s newest rows are on their way'
    : 're-read the verdict ledger now — the strip follows its own 90s cadence; a re-read is a pure GET and writes nothing';
}

/** THE WITHDRAW'S VOICE (R177): the estate switch's spoken line —
 *  three states, one law each. Off: the let-it-ride offer (what ON
 *  would mean). On, idle: the destructive truth named plainly (the
 *  consent withdrawn AND the estate's copy erased — the session's
 *  own memory untouched). On, ARMED: the ask — the second click
 *  commits, the window escapes it. The session-untouched law rides
 *  BOTH withdraw states: the boundary the erase never crosses. */
export function withdrawVoice(estateOn: boolean, armed: boolean): string {
  if (!estateOn) {
    return 'let the fold record ride: every fold click (and eraser write) mirrors to the estate\u2019s store while on; a fresh tab adopts it when it has no record of its own';
  }
  const boundary = 'the session\u2019s own memory is untouched';
  if (armed) {
    return `armed — click again to withdraw the consent AND erase the estate\u2019s copy (${boundary}); the ask escapes after ${WITHDRAW_ARMED_MS / 1000}s`;
  }
  return `withdraw the consent AND erase the estate\u2019s copy — ${boundary} (the first click asks; the second commits)`;
}

// — R178 · THE FOLD'S VOICE — the panel's per-fold rows are heard:
// each open-fold chip speaks its state (which fold, when it was left,
// whether the memory arrived by adoption) and each fold-back ×
// speaks its manner (the record lets it go; the write mirrors while
// the consent is on). And the durable seed grows its second story:
// a SESSION variant — the tab's OWN record (the writer's stamp the
// tab's own id, the tail hand the tab's own freshest write), laid
// into the session store: the no-adoption story, origin 'own'. All
// readings — the record does not move.

/** THE FOLD CHIP'S VOICE (R178): one open-fold chip, spoken — the
 *  fold's name, the when it was left (the chip's own UTC words via
 *  the stamp's instant), the adoption story when the memory arrived
 *  by adoption. A stampless chip (the v1 record's when-less opening)
 *  says so honestly — the when is not invented. The origin rides the
 *  full FoldMemoryOrigin: 'none' (a ledger restored from silence)
 *  carries no arrival story either — only an ADOPTION speaks one.
 *  Pure: parts in, a line out. */
export function foldChipAria(
  name: string,
  stampIso: string | null,
  restoredAs: FoldMemoryOrigin,
): string {
  const when =
    stampIso !== null && Number.isFinite(Date.parse(stampIso))
      ? ` — left at ${new Date(stampIso).toISOString().slice(11, 19)} UTC`
      : ' — the when is not said';
  const came = restoredAs === 'adopted' ? '; arrived by adoption' : '';
  return `the fold ${name} is open${when}${came}`;
}

/** THE FOLD-BACK'S VOICE (R178): the chip's × button, spoken — the
 *  title's own law byte for byte: the record lets the fold go, and
 *  (while the consent is on) the write mirrors to the estate's copy.
 *  The fold-back is REVERSIBLE (fold it open again) — so unlike the
 *  withdraw, it never asks; the voice says what it does, plainly. */
export function foldBackVoice(name: string): string {
  return `fold ${name} back — the record lets it go (this write mirrors to the estate\u2019s copy while the consent is on)`;
}

/** THE SESSION SEED (R178): the durable seed's second story — the
 *  tab's OWN record as exact bytes: the same three-hand shape (head
 *  120′, middle 70′, tail 20′) but the TAIL hand is the tab's own
 *  (the freshest write is this tab's — the writer's stamp the tab's
 *  own id), so the story reads origin 'own': no adoption, no
 *  greeting, no arrival clause — the session-local story, laid into
 *  the session store by the flag 'session'. The same relative-age
 *  law: fresh at any wall clock, aging live from there. Purity: now
 *  and a tab id in, bytes out. */
export function buildSessionSeedFixture(
  now: Date,
  ownTabId: string,
): string {
  const at = (ageMin: number) =>
    new Date(now.getTime() - ageMin * 60_000).toISOString();
  const head = at(120);
  const middle = at(70);
  const tail = at(20);
  const record = {
    moverLadder: middle,
    keepers: false,
    compass: head,
    below: false,
    unruledRows: false,
    turnEnders: false,
    writtenBy: ownTabId,
    writtenAt: tail,
    stampLog: [
      { by: 'tab-seed', at: head },
      { by: 'tab-other', at: middle },
      { by: ownTabId, at: tail },
    ],
  };
  return JSON.stringify(record);
}

// — R179 · THE DIGEST'S VOICE — the COPY DIGEST button is heard: what
// it would copy, named live from the board's own census (the hot
// tensions, the calm rows, the arrival story when the memory was
// adopted), and the COPIED state — the lime check the eye sees —
// announced to the ears too. All readings — the record does not move.

/** THE DIGEST BUTTON'S VOICE (R179): the clipboard button's spoken
 *  line, both states. Idle: what the digest carries — the census in
 *  the board's own numbers (plural law per count), the freshness
 *  hands, the unrecorded confession, the ladder's shape, the footer's
 *  last line (the reader's own fold record), and the arrival story
 *  when the memory arrived by adoption (the CAPTURED origin's truth —
 *  the same source the footer reads). Copied: the deed done, the
 *  census still named — a confirmation that says WHAT was copied.
 *  Pure: a boolean and a census in, a line out. */
export function digestButtonAria(
  copied: boolean,
  census: { hot: number; calm: number; adopted: boolean },
): string {
  const hotWord = `${census.hot} hot tension${census.hot === 1 ? '' : 's'}`;
  const calmWord = `${census.calm} calm row${census.calm === 1 ? '' : 's'}`;
  const came = census.adopted ? ', the arrival story riding the footer\u2019s last word' : '';
  if (copied) {
    return `copied — the digest is on the clipboard: ${hotWord}, ${calmWord}, the freshness hands, the reader\u2019s own fold record as the footer${came}`;
  }
  return `copy the full word-level digest — ${hotWord}, ${calmWord}, the freshness hands, the unrecorded confession, the ladder\u2019s shape, the reader\u2019s own fold record as the footer${came}`;
}

/** THE MEMORY'S FOOTER (the clipboard's second voice): the reader's
 *  own fold record as one digest line — where THIS reader left
 *  things, for the next reader. Open folds ride in the record's own
 *  key order, a stamp printed in the house's UTC voice (at HH:MM:SSZ,
 *  normalized through the Date the record's own string claims); a v1
 *  `true` rides with no when (the honesty of the when-less opening).
 *  R161 · THE ARRIVAL STORY: opts.adopted appends ` · adopted` — the
 *  memory arrived by adoption at this tab's first mount (another
 *  tab's read, owned from there), spoken from the CAPTURED arrival
 *  (a live re-read would say 'own' — the adoption wrote the session).
 *  Nothing open, no record, a broken record → '' (no line — the
 *  absence is the footer's own honesty; the footer never invents). */
export function foldMemoryFooter(
  raw: string | null,
  opts?: { adopted?: boolean },
): string {
  if (raw === null) return '';
  const folds = parseFolds(raw);
  const stamps = foldStamps(raw);
  const parts: string[] = [];
  for (const name of FOLD_NAMES) {
    if (!folds[name]) continue;
    const when = stamps[name];
    if (when !== undefined) {
      const d = new Date(when);
      const voice = Number.isFinite(d.getTime()) ? d.toISOString().slice(11, 19) : when;
      parts.push(`${name} at ${voice}Z`);
    } else {
      parts.push(name);
    }
  }
  if (parts.length === 0) return '';
  return `⌄ left open: ${parts.join(' · ')}${opts?.adopted ? ' · adopted' : ''}`;
}

// — R180 · THE STANDING VOICES — the board's standing rows are heard:
// each row's tone family first (the dot's own law, spoken: sage/cyan
// = settled or counting, amber/rose = a live tension, neutral =
// standing clear), then the name reads the word, then the detail
// verbatim — one utterance per row, composed in the row's own
// reading order (dot, name, word, detail). The hot digest chip's
// census is heard too: the flip count with the plural law, the
// freshest stamp in the house's UTC voice with its minutes-ago (the
// render's own frame, said), the freshness hand when the tail's
// rhythm speaks (freshest / in-rhythm / drifted, the yardstick
// named), the unrecorded confession when the tail holds nothing.
// All readings — the rows do not move.

/** THE STANDING ROW'S VOICE (R180): the row's one utterance — the
 *  tone family clause mirrors the dot's own title law (three
 *  families, never a color name spoken), then the name reads the
 *  word, then the detail verbatim. Pure: a row in, a line out. */
export function watchRowAria(row: { name: string; word: string; tone: string; detail: string }): string {
  const family =
    row.tone === 'amber' || row.tone === 'rose'
      ? 'a live tension'
      : row.tone === 'sage' || row.tone === 'cyan'
        ? 'settled or counting'
        : 'standing clear';
  return `${family} — ${row.name} reads ${row.word}: ${row.detail}`;
}

/** THE DIGEST CHIP'S VOICE (R180): the hot chip's spoken census — the
 *  name reads the word, the flip count with the plural law, the
 *  freshest stamp with its minutes-ago in the surface's own rounding
 *  law (≥100 rounds, below speaks one decimal), the freshness hand
 *  when the tail's rhythm speaks (the hand's own three words, the
 *  yardstick named in the same rounding law — never an invented
 *  constant), the unrecorded confession when the tail holds nothing.
 *  Pure: a chip's census in, a line out. */
export function digestChipAria(
  row: { name: string; word: string },
  census: {
    flips: number;
    freshest: { stamp: string; ageMin: number | null } | null;
    hand: { kind: 'freshest' | 'in-rhythm' | 'drifted'; deltaMin: number | null; yardstickMin: number | null } | null;
  },
): string {
  const minStr = (m: number | null) => (m === null ? '—' : m >= 100 ? String(Math.round(m)) : m.toFixed(1));
  const base = `the tension digest: ${row.name} reads ${row.word}`;
  if (census.flips === 0) {
    return `${base} — the tail holds no flip of this row — unrecorded`;
  }
  const count = `${census.flips} flip${census.flips === 1 ? '' : 's'}`;
  const fresh = census.freshest
    ? `, the freshest @ ${census.freshest.stamp} UTC, ${minStr(census.freshest.ageMin)}′ ago`
    : '';
  const hand = !census.hand
    ? ''
    : census.hand.kind === 'freshest'
      ? ' · the freshness hand: freshest — this row owns the tail\u2019s freshest flip'
      : census.hand.kind === 'in-rhythm'
        ? ` · the freshness hand: in-rhythm — ${minStr(census.hand.deltaMin)}′ behind the tail\u2019s freshest flip, within one median gap (${minStr(census.hand.yardstickMin)}′)`
        : ` · the freshness hand: drifted — ${minStr(census.hand.deltaMin)}′ behind the tail\u2019s freshest flip, beyond one median gap (${minStr(census.hand.yardstickMin)}′)`;
  return `${base}, the tail holds ${count}${fresh}${hand}`;
}

// — R157 · THE CLIPBOARD'S VOICE — the COPY DIGEST export as an
// ENGINE read. R154 lifted the UI's mover census into the ledger
// ("one truth"); this lift does the same for the digest's clipboard
// text: the export now computes the SAME reads the surfaces compute
// (hotHands for the tensions, moverLadder for the shape), so the
// clipboard carries the freshness hands, the unrecorded confession,
// and the ladder's verdict — the same vocabulary, in plain text.
// The component keeps the clipboard mechanics; the words are the
// engine's.

/** The row slice the export needs (structural — the watchboard's
 *  WatchRow satisfies it without a type dependency). */
export interface DigestRow {
  id: string;
  name: string;
  word: string;
  detail: string;
  tone: string;
}

export interface DigestExportInput {
  /** the read's build stamp — the header carries it verbatim */
  builtAt: string;
  rows: DigestRow[];
  /** null when the ledger read did not arrive — no tail, no hands,
   *  no unrecorded claims (the absence is the export's own law) */
  ledger: { samples: number; flips: BoardFlip[] } | null;
  /** the kept story's hands (R158 · THE DATED MEMORY's second face):
   *  when the caller holds a kept census, its freshness hands ride
   *  the clipboard as a line beside the shape — the company's
   *  recency spoken where the tail's motion is spoken. Absent or
   *  empty → no line (the absence is honest); a row with a null
   *  hand counts in the total but speaks no hand (the hand never
   *  guesses). */
  kept?: { rows: Array<{ id: string; name: string; freshness: FreshnessHand | null }> } | null;
  /** the reader's own fold record (R159 · THE ESTATE'S MEMORY): the
   *  clipboard telling the next reader where THIS reader left things
   *  — one footer line after the calm rows (⌄ left open: …). Absent,
   *  broken, or nothing open → no line (the absence is honest). The
   *  record is the SESSION's own — the tab's memory as it stands at
   *  the click, adopted estate included. */
  memory?: string | null;
  /** the arrival story rides the footer (R161): the reader's memory
   *  ARRIVED by adoption (the captured first-mount origin, not a live
   *  re-read — the adoption writes the session, so a re-read would
   *  say 'own') — the footer's last word says so. Default false. */
  memoryAdopted?: boolean;
}

/** A minute value in the house's stamp voice: one decimal below
 *  100′, whole minutes at and past it. */
function stampMinute(min: number): string {
  return min >= 100 ? `${Math.round(min)}′` : `${min.toFixed(1)}′`;
}

/** The freshness hand as text — the dot's word plus the degree for
 *  every hand but the freshest (the zero needs no distance). */
function handSuffix(hand: FreshnessHand, deltaMin: number): string {
  if (hand === 'freshest') return '● freshest';
  const word = hand === 'in-rhythm' ? 'in-rhythm' : 'drifted';
  return `● ${word} ${stampMinute(deltaMin)} behind`;
}

/** THE CLIPBOARD'S VOICE: the watchboard digest as the engine
 *  speaks it. Hot rows carry their hand (the tail's own rhythm
 *  judging each tension's recency), a hot row the tail never saw
 *  confesses `×0 unrecorded`, and the ladder's verdict rides as the
 *  shape line. The ledger's absence is honest: no tail clause, no
 *  hands, no unrecorded claims — the counts stay the header's own. */
export function digestExport(input: DigestExportInput): string {
  const { builtAt, rows, ledger, kept, memory, memoryAdopted } = input;
  const lines: string[] = [];
  lines.push(`VVU WATCHBOARD — ${builtAt.slice(0, 19)}Z UTC`);

  const hot = rows.filter((r) => r.tone === 'amber' || r.tone === 'rose');
  const flips = ledger?.flips ?? [];
  const handRead = ledger !== null ? hotHands(flips) : null;
  const shapeRead = ledger !== null ? moverLadder(flips) : null;

  const ledgerClause =
    ledger !== null
      ? ` · ledger: ${ledger.samples} moved sample${ledger.samples === 1 ? '' : 's'}, ${flips.length} flip${flips.length === 1 ? '' : 's'}`
      : '';
  lines.push(
    `${hot.length} LIVE TENSION${hot.length === 1 ? '' : 'S'} of ${rows.length} rows${ledgerClause}`,
  );

  for (const r of hot) {
    let line = `· ${r.name} — ${r.word} — ${r.detail}`;
    if (handRead !== null) {
      const entry = handRead.hands.get(r.id);
      if (!entry) line += ' — ×0 unrecorded';
      else if (entry.hand !== null)
        line += ` — ${handSuffix(entry.hand, entry.deltaMin ?? 0)}`;
    }
    lines.push(line);
  }

  if (shapeRead !== null && shapeRead.verdict !== null && shapeRead.top.length > 0) {
    const leader = shapeRead.top[0]!;
    lines.push(
      `⌃ shape: ${shapeRead.verdict} — top ${leader.name} ${Math.round((shapeRead.topShare ?? 0) * 100)}% of ${shapeRead.flips} flips over ${shapeRead.movers.length} movers`,
    );
  }

  if (kept && kept.rows.length > 0) {
    let freshest = 0;
    let inRhythm = 0;
    let drifted = 0;
    for (const r of kept.rows) {
      if (r.freshness === 'freshest') freshest += 1;
      else if (r.freshness === 'in-rhythm') inRhythm += 1;
      else if (r.freshness === 'drifted') drifted += 1;
    }
    lines.push(
      `⌂ kept hands: ${freshest} freshest · ${inRhythm} in-rhythm · ${drifted} drifted of ${kept.rows.length} row${kept.rows.length === 1 ? '' : 's'}`,
    );
  }

  const calm = rows.filter((r) => r.tone !== 'amber' && r.tone !== 'rose');
  if (calm.length > 0) {
    lines.push(`CALM (${calm.length}): ${calm.map((r) => `${r.name} · ${r.word}`).join(' | ')}`);
  }

  // R159 · THE ESTATE'S MEMORY: the footer rides LAST — after the
  // calm rows, the reader's own record spoken plain. Nothing open,
  // no record → no line (the footer never invents).
  const footer = foldMemoryFooter(memory ?? null, { adopted: memoryAdopted ?? false });
  if (footer !== '') lines.push(footer);

  return lines.join('\n');
}
