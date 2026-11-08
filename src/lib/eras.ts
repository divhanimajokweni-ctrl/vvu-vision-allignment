// R113 — THE ERAS OF THE STORM: the record's timeline, carved at its own
// lulls and named era by era.
//
// The record's prose has always spoken in eras — "the storm's fastest
// era", "the pressure era", "the longest calm" — but no instrument ever
// SEGMENTED the timeline it was describing. This engine does the carving
// with the record's own rules and nothing new:
//
//   THE LINE: a gap between consecutive witnessed kills that runs past
//   the LULL LINE — the heartbeat (storm-history's full-median interval,
//   handed in by the caller) × CADENCE_STRETCH_RATIO (1.25, the same
//   constant the outlook's lull dial reads) — OPENS A NEW ERA. The lull
//   dial already declares the estate "stretching" when the live gap
//   crosses this line; the era card applies the identical rule to
//   history. One calibration, many readers.
//
//   THE ERAS: every era carries its own honest arithmetic — the kill
//   count, the span (first → last), the gap that OPENED it (null for the
//   first era: the record opens mid-storm), the median gap INSIDE it
//   (null for a single-kill era: no internal interval exists), the
//   median ceiling and floor over the non-null witnessed values (nulls
//   are skipped, never averaged as zero; an all-null era reads null),
//   and the kill rate per hour (null for singletons — a span of zero
//   has no honest rate). Single-kill eras are NOT merged away: in this
//   record they are the deep-floor pressure stretch, and merging them
//   would erase the very structure the card exists to show.
//
//   THE EXTREMES: the longest era by span, the deepest era by median
//   floor, the densest era by kill rate (span > 0 only), the longest
//   split lull with its stamps. All descriptive; the card names, it
//   does not diagnose.
//
//   THE REFUSAL: an unreadable heartbeat (null or ≤ 0) means there is
//   no line to split at — the record reads as ONE era and the note says
//   so out loud. It never invents a substitute line.
//
// Pure: no I/O, no clock. The kills and the heartbeat are handed in;
// the gaps are the deterministic arithmetic of consecutive atMs.

import { CADENCE_STRETCH_RATIO } from './storm-history';

export interface EraKill {
  at: string;
  atMs: number;
  maxRssMb: number | null;
  minAvailMb: number | null;
}

export interface StormEra {
  /** 1-based era number, in kill order. */
  index: number;
  /** 1-based witnessed-kill sequence numbers this era spans. */
  firstSeq: number;
  lastSeq: number;
  n: number;
  firstAt: string;
  lastAt: string;
  /** The gap (minutes) that opened this era — null for era 1. */
  openedByGapMin: number | null;
  /** first → last, minutes; 0 for a single-kill era. */
  spanMin: number;
  gapsInsideMin: number[];
  medianGapInsideMin: number | null;
  /** Medians over the era's non-null witnessed values. */
  medianCeilingMb: number | null;
  medianFloorMb: number | null;
  /** n per hour over the span — null for singletons (span 0). */
  killsPerHour: number | null;
}

export interface SplitLull {
  /** The 1-based seq of the kill BEFORE the lull. */
  afterSeq: number;
  gapMin: number;
  fromAt: string;
  toAt: string;
}

export interface StormErasRead {
  eras: StormEra[];
  eraCount: number;
  heartbeatMin: number | null;
  lullLineMin: number | null;
  splitLulls: SplitLull[];
  longestLull: SplitLull | null;
  /** The era holding the record's newest kill. */
  currentEraIndex: number | null;
  longestEra: { index: number; spanMin: number } | null;
  deepestEra: { index: number; medianFloorMb: number } | null;
  densestEra: { index: number; killsPerHour: number } | null;
  note: string;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** THE HOUSE LOWER-MEDIAN — the record's one median convention (R113's
 *  era grammar pinned it; R114's memory reuses it): sorted, the element at
 *  floor((n−1)/2) — for an even count the LOWER of the two middles, never
 *  an invented midpoint. One calibration, many readers. */
export function houseLowerMedian(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)]!;
}

export function stormEras(
  kills: EraKill[],
  opts: { heartbeatMin: number | null },
): StormErasRead {
  // The deterministic gap series over consecutive witnessed kills.
  const gaps: Array<{ afterSeq: number; gapMin: number; fromAt: string; toAt: string }> = [];
  for (let i = 1; i < kills.length; i++) {
    const prev = kills[i - 1]!;
    const cur = kills[i]!;
    const ms = cur.atMs - prev.atMs;
    if (!Number.isFinite(ms) || ms < 0) continue; // clock-skewed row: no honest gap
    gaps.push({
      afterSeq: i, // prev kill's 1-based seq
      gapMin: ms / 60000,
      fromAt: prev.at,
      toAt: cur.at,
    });
  }

  const heartbeat = opts.heartbeatMin;
  const usableHeartbeat = heartbeat != null && Number.isFinite(heartbeat) && heartbeat > 0;
  const lullLineMin = usableHeartbeat ? round2(heartbeat * CADENCE_STRETCH_RATIO) : null;

  // Carve: a gap at or over the line opens a new era (null when the
  // heartbeat is unreadable — one era, said out loud in the note).
  interface Carve {
    start: number;
    end: number;
    openedBy: { gapMin: number; fromAt: string; toAt: string } | null;
  }
  const carved: Carve[] = [];
  let start = 0;
  // The lull that is being crossed OPENS the NEXT era — the era that ends
  // at the lull was opened by the PREVIOUS lull (or by nothing, era 1).
  let pendingOpener: Carve['openedBy'] = null;
  for (const g of gaps) {
    if (lullLineMin !== null && g.gapMin >= lullLineMin) {
      // g.afterSeq is the 1-based seq of the kill BEFORE the lull (and the
      // 0-based index of the kill AFTER it): the era ends at afterSeq − 1,
      // the next era opens at the kill the lull led to.
      carved.push({ start, end: g.afterSeq - 1, openedBy: pendingOpener });
      pendingOpener = { gapMin: g.gapMin, fromAt: g.fromAt, toAt: g.toAt };
      start = g.afterSeq;
    }
  }
  if (start < kills.length) {
    carved.push({ start, end: kills.length - 1, openedBy: pendingOpener });
  }
  if (kills.length === 0) {
    carved.length = 0;
  }

  const built: StormEra[] = carved.map((e, i) => {
    const slice = kills.slice(e.start, e.end + 1);
    const gapsInside = gaps
      .filter((g) => g.afterSeq >= e.start + 1 && g.afterSeq <= e.end)
      .map((g) => g.gapMin);
    const spanMs = slice.length > 1 ? slice[slice.length - 1]!.atMs - slice[0]!.atMs : 0;
    const spanMin = spanMs / 60000;
    const ceilings = slice.map((k) => k.maxRssMb).filter((v): v is number => v != null && Number.isFinite(v));
    const floors = slice.map((k) => k.minAvailMb).filter((v): v is number => v != null && Number.isFinite(v));
    return {
      index: i + 1,
      firstSeq: e.start + 1,
      lastSeq: e.end + 1,
      n: slice.length,
      firstAt: slice[0]!.at,
      lastAt: slice[slice.length - 1]!.at,
      openedByGapMin: e.openedBy ? e.openedBy.gapMin : null,
      spanMin,
      gapsInsideMin: gapsInside,
      medianGapInsideMin: gapsInside.length ? houseLowerMedian(gapsInside) : null,
      medianCeilingMb: ceilings.length ? houseLowerMedian(ceilings) : null,
      medianFloorMb: floors.length ? houseLowerMedian(floors) : null,
      killsPerHour: spanMin > 0 ? round2((slice.length / spanMin) * 60) : null,
    };
  });

  const splitLulls: SplitLull[] = gaps
    .filter((g) => lullLineMin !== null && g.gapMin >= lullLineMin)
    .map((g) => ({ afterSeq: g.afterSeq, gapMin: g.gapMin, fromAt: g.fromAt, toAt: g.toAt }));
  const longestLull = splitLulls.length
    ? splitLulls.reduce((a, b) => (b.gapMin > a.gapMin ? b : a))
    : null;

  let longestEra: StormErasRead['longestEra'] = null;
  let deepestEra: StormErasRead['deepestEra'] = null;
  let densestEra: StormErasRead['densestEra'] = null;
  for (const e of built) {
    if (e.n >= 2 && (longestEra === null || e.spanMin > longestEra.spanMin)) {
      longestEra = { index: e.index, spanMin: e.spanMin };
    }
    if (
      e.medianFloorMb != null &&
      (deepestEra === null || e.medianFloorMb < deepestEra.medianFloorMb)
    ) {
      deepestEra = { index: e.index, medianFloorMb: e.medianFloorMb };
    }
    if (e.killsPerHour != null && (densestEra === null || e.killsPerHour > densestEra.killsPerHour)) {
      densestEra = { index: e.index, killsPerHour: e.killsPerHour };
    }
  }

  const note = buildNote({
    kills: kills.length,
    eraCount: built.length,
    heartbeat,
    lullLineMin,
    splitLulls,
    longestLull,
    eras: built,
    longestEra,
    deepestEra,
    densestEra,
  });

  return {
    eras: built,
    eraCount: built.length,
    heartbeatMin: heartbeat,
    lullLineMin,
    splitLulls,
    longestLull,
    currentEraIndex: built.length ? built[built.length - 1]!.index : null,
    longestEra,
    deepestEra,
    densestEra,
    note,
  };
}

function buildNote(r: {
  kills: number;
  eraCount: number;
  heartbeat: number | null;
  lullLineMin: number | null;
  splitLulls: SplitLull[];
  longestLull: SplitLull | null;
  eras: StormEra[];
  longestEra: StormErasRead['longestEra'];
  deepestEra: StormErasRead['deepestEra'];
  densestEra: StormErasRead['densestEra'];
}): string {
  if (r.kills === 0) {
    return 'No witnessed kill yet — the storm has no eras to carve. The card waits for the record to exist.';
  }
  if (r.lullLineMin === null) {
    return `${r.kills} witnessed kills read as ONE era — the heartbeat is unreadable, there is no line to split at, and the card refuses to invent one.`;
  }
  const parts: string[] = [];
  parts.push(
    `${r.kills} witnessed kills carved into ${r.eraCount} era${r.eraCount === 1 ? '' : 's'} at the lull line ${r.lullLineMin} min (the heartbeat ${round1(r.heartbeat as number)} × ${CADENCE_STRETCH_RATIO})`,
  );
  if (r.splitLulls.length) {
    parts.push(
      `${r.splitLulls.length} lull${r.splitLulls.length === 1 ? '' : 's'} did the carving: ${r.splitLulls.map((l) => `${round1(l.gapMin)}′ (${l.fromAt} → ${l.toAt})`).join(' · ')}`,
    );
  } else {
    parts.push('no gap ever crossed the line — the storm has run in one breath so far');
  }
  const eraWords = r.eras
    .map((e) => {
      const bits = [`#${e.index} n=${e.n}`];
      if (e.openedByGapMin != null) bits.push(`opened by ${round1(e.openedByGapMin)}′`);
      if (e.spanMin > 0) bits.push(`span ${round1(e.spanMin)}′`);
      if (e.medianCeilingMb != null) bits.push(`ceiling ${round1(e.medianCeilingMb)}`);
      if (e.medianFloorMb != null) bits.push(`floor ${round1(e.medianFloorMb)}`);
      return bits.join(' ');
    })
    .join(' · ');
  parts.push(eraWords);
  if (r.longestEra) {
    parts.push(`the longest era #${r.longestEra.index} at ${round1(r.longestEra.spanMin)} min`);
  }
  if (r.deepestEra) {
    parts.push(`the deepest floor era #${r.deepestEra.index} (median ${round1(r.deepestEra.medianFloorMb)} MB)`);
  }
  if (r.densestEra) {
    parts.push(`the densest era #${r.densestEra.index} at ${r.densestEra.killsPerHour} kills/hour`);
  }
  if (r.longestLull) {
    parts.push(`the record's longest lull ${round1(r.longestLull.gapMin)} min (${r.longestLull.fromAt} → ${r.longestLull.toAt})`);
  }
  return parts.join(' · ');
}
