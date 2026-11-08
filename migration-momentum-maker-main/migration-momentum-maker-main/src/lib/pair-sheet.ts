// src/lib/pair-sheet.ts — R104 · THE PAIR SHEET, the auto-pairs' own record.
// ─────────────────────────────────────────────────────────────────────────────
// R99 armed the guardian to take its own readings (opener +210s, second
// +1080s after every bounce). R100/R102/R103 verified pairs one fire at a
// time, in worklog prose. The ledger has carried every fire the whole time —
// this engine reads the Cycles out of it, the questions the single fires
// could not answer:
//
//   DO BOOTS OPEN WARMER AS THE STORM DEEPENS?  R103's storm history read
//   the DEAD's ceiling drifting +15 MB/kill. The pair sheet reads the LIVING
//   side of the same question: each cycle's OPENER climb (the boot's own
//   temperature at the moment the guardian first looked). The opener climbs
//   are the warm state's own trajectory — if they rise cycle after cycle,
//   the warm state is migrating up with the storm, and "boots open cold"
//   was a property of a shallower storm, not a law.
//
//   WHAT HAVE THE PAIRS THEMSELVES SAID?  flat→mixed (booted cool, warmed
//   inside the hour), flat→flat (stable), tracked→tracked (opened hot, never
//   cooled) — the pair kinds are the warm-state's phase read, one row per
//   boot, no memory required.
//
//   WHERE DID THE MECHANISM LOSE?  A cycle with an opener and no second is
//   not a missing datapoint — it is the HONEST LOSS design working: the boot
//   died before its +1080s timer, exactly the storm pressure the pair exists
//   to witness. The sheet counts the losses instead of hiding them; when the
//   operator's own hand completed a boot the auto-opener refused (too-few),
//   the sheet says that too — the record's triggers are part of the record.
//
// Honesty rules (inherited):
//   - the ledger is the only source: rows join by bootPid, ordered by atMs;
//     the engine trusts no client-side state and invents no timers — a
//     PENDING cycle names the +1080s design constant but never an ETA.
//   - a too-few opener keeps its cycle row (the guardian fired; the boot was
//     too young to judge) but drops from the opening-drift statistics —
//     counted, never imputed, the storm-history rule verbatim.
//   - outcome derivation is structural, not guessed: a second row closes the
//     cycle COMPLETE; otherwise operator rows on the same boot make it
//     OPERATOR-PAIR; otherwise any later row from a different boot proves
//     the guardian moved on (the boot ended) — HONEST LOSS; only a cycle
//     with NO later evidence anywhere stays PENDING.
//   - every threshold is a FIRST CALIBRATION named in a constant.
// ─────────────────────────────────────────────────────────────────────────────

/** The opening drift needs at least this many judged openers before a slope
 *  is named — the same bar MIN_DRIFT_KILLS sets next door: a two-point
 *  "trend" is a line, not a read, and the halves comparison needs 4. */
export const MIN_OPENING_DRIFT_CYCLES = 4;

/** |OLS slope| above this reads warming/cooling rather than flat (MB per
 *  cycle). First calibration: a bounce's cold boot regularly opens hundreds
 *  of MB below its dead predecessor, so 50 MB/cycle is the smallest
 *  migration that outruns the bounce-to-bounce spread. */
export const OPENING_DRIFT_THRESHOLD_MB_PER_CYCLE = 50;

/** The kind that marks a refusal: the auto-pair fired before the boot held
 *  enough samples to judge. Disclosed in the sheet, excluded from the
 *  drift — a refusal is not an opening temperature. */
export const TOO_FEW_KIND = "too-few";

export type PairCycleOutcome = "complete" | "honest-loss" | "operator-pair" | "pending";

/** Structural row — every field the ledger's VerdictReadingRow already
 *  carries, so the panel passes its rows verbatim and the tests pass raw
 *  JSONL rows. Null-able fields stay null-able: honesty over convenience. */
export interface PairSheetRow {
  atMs: number | null;
  bootPid: number;
  kind: string;
  climbMb: number | null;
  uptimeSec: number | null;
  /** optional (undefined allowed): the ledger's pre-R99 rows carry no via
   *  at all, and the engine reads the absence as "not auto" — the truth. */
  via?: string | null;
}

export interface PairRowRead {
  atMs: number | null;
  uptimeSec: number | null;
  kind: string;
  climbMb: number | null;
  via: string | null;
}

export interface PairCycle {
  /** 1-based position in the auto era (ordered by the opener's atMs). */
  seq: number;
  bootPid: number;
  opener: PairRowRead;
  second: PairRowRead | null;
  outcome: PairCycleOutcome;
  /** The operator's own readings that followed on this boot (via != auto),
   *  kinds in record order — the hand that completed what the auto-opener
   *  refused or lost. */
  operatorKinds: string[];
  /** second.atMs − opener.atMs, minutes — the pair's own span (complete
   *  cycles only). */
  pairGapMin: number | null;
  /** second.climbMb − opener.climbMb (complete cycles only) — the boot's
   *  climb DELTA across the pair: positive means it warmed further, negative
   *  means it settled. */
  climbDeltaMb: number | null;
}

export interface OpeningPoint {
  seq: number;
  bootPid: number;
  climbMb: number;
  kind: string;
}

export type OpeningDriftRead = "warming" | "cooling" | "flat" | null;

export interface PairSheetRead {
  cycles: PairCycle[];
  /** The auto-era rows the sheet is built from (via = auto-guardian). */
  autoRows: number;
  /** Openers eligible for the drift (finite climb, not a too-few refusal). */
  openings: OpeningPoint[];
  openingDriftMbPerCycle: number | null;
  openingDriftR2: number | null;
  openingDriftRead: OpeningDriftRead;
  /** Median opener climb across the FIRST half of the judged openings. */
  firstHalfMedianClimbMb: number | null;
  /** Median opener climb across the LAST half. */
  lastHalfMedianClimbMb: number | null;
  completePairs: number;
  honestLosses: number;
  operatorPairs: number;
  pending: number;
  /** The kinds the openers have read, in cycle order (too-few included —
   *  it is part of the record even where it is excluded from the drift). */
  openerKinds: string[];
  /** The kinds the seconds have read, in cycle order (complete pairs only). */
  secondKinds: string[];
  /** The honest one-liner. */
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

function rowRead(r: PairSheetRow): PairRowRead {
  return {
    atMs: typeof r.atMs === "number" && Number.isFinite(r.atMs) ? r.atMs : null,
    uptimeSec: typeof r.uptimeSec === "number" && Number.isFinite(r.uptimeSec) ? r.uptimeSec : null,
    kind: String(r.kind ?? ""),
    climbMb: typeof r.climbMb === "number" && Number.isFinite(r.climbMb) ? r.climbMb : null,
    via: r.via != null ? String(r.via) : null,
  };
}

/** THE pair sheet — the verdict ledger in, the auto-pair era's own history
 *  out. Pure: rows sort by atMs (nulls last, order-stable), join by bootPid,
 *  and every outcome derives from rows that exist. The note names what the
 *  sheet cannot know: the guardian's timer, not the ledger, schedules the
 *  seconds — a pending cycle is honest exactly because it promises nothing. */
export function pairSheet(rows: Array<PairSheetRow>): PairSheetRead {
  const all = (rows ?? []).map((r) => ({ raw: r, pid: r.bootPid }));
  const parsed = all
    .map((e) => ({
      ...e,
      atMs: typeof e.raw.atMs === "number" && Number.isFinite(e.raw.atMs) ? e.raw.atMs : null,
    }))
    .sort((a, b) => {
      if (a.atMs == null && b.atMs == null) return 0;
      if (a.atMs == null) return 1;
      if (b.atMs == null) return -1;
      return a.atMs - b.atMs;
    });

  const autoRows = parsed.filter((e) => e.raw.via === "auto-guardian");

  // group the auto rows by boot, keeping first-appearance (= opener) order
  const groups: Array<{ pid: number; rows: typeof parsed }> = [];
  for (const e of autoRows) {
    const g = groups.find((x) => x.pid === e.pid);
    if (g) g.rows.push(e);
    else groups.push({ pid: e.pid, rows: [e] });
  }

  const cycles: PairCycle[] = groups.map((g, i) => {
    const opener = rowRead(g.rows[0]!.raw);
    const second = g.rows.length >= 2 ? rowRead(g.rows[1]!.raw) : null;

    // the operator's own readings that followed on this boot
    const operatorKinds = parsed
      .filter(
        (e) =>
          e.pid === g.pid &&
          e.raw.via !== "auto-guardian" &&
          (opener.atMs == null || e.atMs == null || e.atMs > opener.atMs),
      )
      .map((e) => String(e.raw.kind ?? ""));

    let outcome: PairCycleOutcome;
    if (second != null) {
      outcome = "complete";
    } else if (operatorKinds.length > 0) {
      outcome = "operator-pair";
    } else {
      const laterElsewhere = parsed.some(
        (e) => e.pid !== g.pid && opener.atMs != null && e.atMs != null && e.atMs > opener.atMs,
      );
      outcome = laterElsewhere ? "honest-loss" : "pending";
    }

    const pairGapMin =
      second != null && opener.atMs != null && second.atMs != null
        ? round((second.atMs - opener.atMs) / 60000, 2)
        : null;
    const climbDeltaMb =
      second != null && opener.climbMb != null && second.climbMb != null
        ? round(second.climbMb - opener.climbMb)
        : null;

    return {
      seq: i + 1,
      bootPid: g.pid,
      opener,
      second,
      outcome,
      operatorKinds,
      pairGapMin,
      climbDeltaMb,
    };
  });

  // ── the opening drift: judged openers only ──
  const openings: OpeningPoint[] = cycles
    .filter((c) => c.opener.climbMb != null && c.opener.kind !== TOO_FEW_KIND)
    .map((c) => ({
      seq: c.seq,
      bootPid: c.bootPid,
      climbMb: c.opener.climbMb!,
      kind: c.opener.kind,
    }));

  let openingDriftMbPerCycle: number | null = null;
  let openingDriftR2: number | null = null;
  let openingDriftRead: OpeningDriftRead = null;
  let firstHalfMedianClimbMb: number | null = null;
  let lastHalfMedianClimbMb: number | null = null;
  if (openings.length >= MIN_OPENING_DRIFT_CYCLES) {
    const half = Math.floor(openings.length / 2);
    const fh = median(openings.slice(0, half).map((o) => o.climbMb));
    const lh = median(openings.slice(openings.length - half).map((o) => o.climbMb));
    if (fh != null) firstHalfMedianClimbMb = round(fh);
    if (lh != null) lastHalfMedianClimbMb = round(lh);
    const fit = olsSlopeR2(
      openings.map((o) => o.seq),
      openings.map((o) => o.climbMb),
    );
    if (fit != null) {
      openingDriftMbPerCycle = round(fit.slope, 2);
      openingDriftR2 = round(fit.r2, 2);
      openingDriftRead =
        fit.slope > OPENING_DRIFT_THRESHOLD_MB_PER_CYCLE
          ? "warming"
          : fit.slope < -OPENING_DRIFT_THRESHOLD_MB_PER_CYCLE
            ? "cooling"
            : "flat";
    }
  }

  const completePairs = cycles.filter((c) => c.outcome === "complete").length;
  const honestLosses = cycles.filter((c) => c.outcome === "honest-loss").length;
  const operatorPairs = cycles.filter((c) => c.outcome === "operator-pair").length;
  const pending = cycles.filter((c) => c.outcome === "pending").length;
  const openerKinds = cycles.map((c) => c.opener.kind);
  const secondKinds = cycles.filter((c) => c.second != null).map((c) => c.second!.kind);

  // ── the note ──
  let note: string;
  if (cycles.length === 0) {
    note =
      "no auto-guardian cycles on record yet — the pair sheet waits for the guardian to arm, honestly empty";
  } else {
    const parts: string[] = [];
    parts.push(`${cycles.length} auto-pair ${cycles.length === 1 ? "cycle" : "cycles"} on record`);
    parts.push(`openers ${openerKinds.join(" → ") || "—"}`);
    if (openingDriftRead != null && openingDriftMbPerCycle != null) {
      const dir =
        openingDriftRead === "warming"
          ? `opening WARMER cycle after cycle (+${openingDriftMbPerCycle} MB/cycle, R² ${openingDriftR2})`
          : openingDriftRead === "cooling"
            ? `opening COOLER cycle after cycle (${openingDriftMbPerCycle} MB/cycle, R² ${openingDriftR2})`
            : `holding inside the bounce spread (+${openingDriftMbPerCycle} MB/cycle, R² ${openingDriftR2})`;
      parts.push(`the boots are ${dir}`);
      if (firstHalfMedianClimbMb != null && lastHalfMedianClimbMb != null) {
        const delta = round(lastHalfMedianClimbMb - firstHalfMedianClimbMb);
        parts.push(
          `first half opened at a ${firstHalfMedianClimbMb} MB median climb, last half ${lastHalfMedianClimbMb} (${delta >= 0 ? "+" : ""}${delta} MB)`,
        );
      }
    }
    if (secondKinds.length > 0) {
      parts.push(`the seconds read ${secondKinds.join(" → ")}`);
    }
    const bits: string[] = [];
    if (completePairs > 0) bits.push(`${completePairs} completed`);
    if (operatorPairs > 0) bits.push(`${operatorPairs} completed by the operator's hand`);
    if (honestLosses > 0)
      bits.push(
        `${honestLosses} honest ${honestLosses === 1 ? "loss" : "losses"} (the boot died before its +1080s second)`,
      );
    if (pending > 0) bits.push(`${pending} pending`);
    if (bits.length > 0) parts.push(bits.join(", "));
    note = `${parts.join(" — ")}. The ledger holds what fired, never what was scheduled — a pending cycle promises nothing.`;
  }

  return {
    cycles,
    autoRows: autoRows.length,
    openings,
    openingDriftMbPerCycle,
    openingDriftR2,
    openingDriftRead,
    firstHalfMedianClimbMb,
    lastHalfMedianClimbMb,
    completePairs,
    honestLosses,
    operatorPairs,
    pending,
    openerKinds,
    secondKinds,
    note,
  };
}
