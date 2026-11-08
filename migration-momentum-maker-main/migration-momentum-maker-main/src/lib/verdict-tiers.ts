// src/lib/verdict-tiers.ts — R80 · THE TIER ENGINE, ONE AUTHORITY.
// ─────────────────────────────────────────────────────────────────────────────
// The leak verdict's judgment calls (R78) now live in ONE pure module that
// BOTH the client's verdict block and the server's verdict ledger import —
// the thresholds can never drift between what the page displays and what a
// recorded reading claims, because they are literally the same constants.
//
// No node imports here: this file is imported by client components and by
// server route modules alike. Everything is a pure function over plain data.
//
// THE THRESHOLDS ARE A FIRST CALIBRATION (R78, unchanged): climb ≤ 8MB reads
// flat (the pass log's own noise); <150 requests cannot attribute anything
// (the console's own first minutes); ≥50 MB per 1k requests reads request-
// proportional; <5 reads compile/HMR-driven (R77's stated suspect); between
// = honest MIXED. Re-read as boots accumulate under the raised guard.
// ─────────────────────────────────────────────────────────────────────────────

// The console's own known timer pollers — the SELF-POLL sum and the verdict's
// known-self share both start from this set. Attribution beyond it is the
// READER'S job: the traffic endpoint reports raw buckets and does not
// editorialize.
export const CONSOLE_POLL_ROUTES: ReadonlySet<string> = new Set([
  "GET /api/watchdog",
  "GET /api/integrity",
  "GET /api/bridge/governance",
  "GET /api/guardian",
  "GET /api/guardian/plateau-history",
  "GET /api/guardian/verdict-ledger",
  "GET /api/fleet",
  "GET /api/traffic",
  "GET /api/estate/chronicle",
]);

// The verdict's known-self set: the console pollers PLUS the mesh's own HTTP
// self-probes that arrive from the mini-service processes (safegrid reads the
// estate's health on an interval; the telemetry service posts its queue and
// its ledger flush). The verdict subtracts ALL of them before it lets any
// request carry attribution — the watchman is part of what it watches.
export const KNOWN_SELF_ROUTES: ReadonlySet<string> = new Set([
  ...CONSOLE_POLL_ROUTES,
  "GET /api/safegrid/health",
  "POST /api/vvu/telemetry",
  "POST /api/vvu/ledger",
]);

// The calibration, named so the tooltips can quote it verbatim.
export const FLAT_CLIMB_MB = 8;
export const TOO_FEW_REQUESTS = 150;
export const TRACKED_MB_PER_1K = 50;
export const MIXED_MB_PER_1K = 5;

export type VerdictKind =
  | "no-plateau"
  | "no-climb"
  | "no-counter"
  | "flat"
  | "too-few"
  | "not-tracked"
  | "mixed"
  | "tracked";

export type VerdictTone = "dim" | "lime" | "cyan" | "amber" | "rose";

export const VERDICT_TONE_BY_KIND: Record<VerdictKind, VerdictTone> = {
  "no-plateau": "dim",
  "no-climb": "dim",
  "no-counter": "amber",
  flat: "lime",
  "too-few": "dim",
  "not-tracked": "cyan",
  mixed: "amber",
  tracked: "rose",
};

export interface VerdictInputs {
  plateauPresent: boolean;
  climbMb: number | null;
  counterArmed: boolean;
  requests: number | null;
}

export interface VerdictClassification {
  kind: VerdictKind;
  tone: VerdictTone;
  /** null when the tier does not reach the ratio (flat, too-few, no-*). */
  mbPer1k: number | null;
}

/** THE tier engine — the client's verdict block and the server's verdict
 *  ledger both classify through this, so a recorded row's tier and the
 *  live page's tier can never disagree about the RULES (only about the
 *  moment they sampled, which is expected and honest). */
export function classifyVerdict(i: VerdictInputs): VerdictClassification {
  if (!i.plateauPresent) return { kind: "no-plateau", tone: "dim", mbPer1k: null };
  if (i.climbMb == null) return { kind: "no-climb", tone: "dim", mbPer1k: null };
  if (!i.counterArmed || i.requests == null) {
    return { kind: "no-counter", tone: "amber", mbPer1k: null };
  }
  if (i.climbMb <= FLAT_CLIMB_MB) return { kind: "flat", tone: "lime", mbPer1k: null };
  if (i.requests < TOO_FEW_REQUESTS) return { kind: "too-few", tone: "dim", mbPer1k: null };
  const mbPer1k = i.climbMb / (i.requests / 1000);
  if (mbPer1k >= TRACKED_MB_PER_1K) return { kind: "tracked", tone: "rose", mbPer1k };
  if (mbPer1k >= MIXED_MB_PER_1K) return { kind: "mixed", tone: "amber", mbPer1k };
  return { kind: "not-tracked", tone: "cyan", mbPer1k };
}

export interface RouteBucket {
  key: string;
  count: number;
}

export interface KnownSelfRead {
  selfCount: number;
  selfPct: number | null;
  residual: number | null;
  profileNext: RouteBucket | null;
}

/** The known-self subtraction, shared verbatim by the verdict block's live
 *  display and the ledger's recorded rows. */
export function computeKnownSelf(
  routes: RouteBucket[],
  total: number,
  routesArmed: boolean,
): KnownSelfRead {
  const selfCount = routes
    .filter((r) => KNOWN_SELF_ROUTES.has(r.key))
    .reduce((s, r) => s + r.count, 0);
  const selfPct = routesArmed && total > 0 ? Math.round((selfCount / total) * 100) : null;
  const residual = routesArmed ? Math.max(0, total - selfCount) : null;
  const profileNext = routesArmed
    ? (routes.find((r) => !KNOWN_SELF_ROUTES.has(r.key)) ?? null)
    : null;
  return { selfCount, selfPct, residual, profileNext };
}

// ── R86 · THE CALIBRATION BAND + THE SETTLE ENGINE, ONE AUTHORITY ───────────
// The 16–32 MB/1k steady-state band (R84/R85's calibration) and the per-boot
// settle computation (each boot's own first→last ratio) previously lived in
// the WatchdogWorkspace client — the scorecard's arithmetic had ONE reader.
// Folding the scorecard into the estate chronicle (R86) needs the SAME
// arithmetic on the server, so it moves here: the strip, the curve, and the
// chronicle's calibration block all read these constants and this function,
// and the band's edges can never drift between surfaces because there is
// exactly one definition. The band edges remain CALIBRATION, not law —
// re-read as more boots settle.

/** The steady-state band edges — the two mature boots (21982: 16.36, 17201:
 *  32.03) set them; a third settled boot may recalibrate them HERE, once. */
export const SETTLE_BAND_LO = 16;
export const SETTLE_BAND_HI = 32;

/** The slice of a ledger row the settle engine needs — the real rows carry
 *  these plus more; tests and the chronicle can pass projections. R93 — the
 *  optional `kind`/`climbMb`/`requests` join the slice: a boot whose LAST
 *  reading is the FLAT tier (mbPer1k null by design — the climb ≤ 8MB reads
 *  as the pass log's own noise) has a DETERMINATE outcome the ratio pair
 *  cannot express: the storm resolved completely. The engine names that
 *  outcome instead of leaving it in the dash class. */
export interface SettleRowLike {
  bootPid: number;
  mbPer1k: number | null;
  at: string;
  kind?: string | null;
  climbMb?: number | null;
  requests?: number | null;
  // R97 — optional slices the BOOT ARCS engine reads (the real ledger rows
  // carry all of them; tests and projections may omit). Optional keeps every
  // existing SettleRowLike caller typechecking untouched.
  atMs?: number | null;
  uptimeSec?: number | null;
  tone?: VerdictTone | null;
  devTreePid?: number | null;
  bootStartUtc?: string | null;
  /** R99 — provenance ('operator' | 'auto-guardian'); absent on pre-R99
   *  rows and in tests that omit it. */
  via?: string | null;
}

export interface BootSettle {
  pid: number;
  count: number;
  first: SettleRowLike;
  last: SettleRowLike;
  /** last ratio − first ratio across the boot's OWN readings; null when the
   *  boot holds fewer than two readings or either endpoint lacks a ratio. */
  settle: number | null;
  settlePct: number | null;
  /** the boot's LAST ratio inside the band — a settled calibration point.
   *  Flat closers sit BELOW the band by construction and never read inBand —
   *  the band's contract (16–32 MB/1k request-proportional) is unchanged. */
  inBand: boolean;
  /** R93 — the closer's identity. 'ratio': the last reading carries a
   *  ratio and the settle arithmetic speaks. 'flat': the boot has ≥2
   *  readings, the first carries a ratio, and the last reading is the FLAT
   *  tier (kind 'flat') — the boot's climb collapsed into noise, the
   *  strongest resolve the ledger can record (R89's "compile-spike opener
   *  must not read as steady state" CONFIRMED). null: the boot cannot be
   *  judged (fewer than two readings, or no first ratio to settle from). */
  closer: "ratio" | "flat" | null;
  /** R93 — settled means the boot's outcome is determinate: a ratio pair OR
   *  a flat closer. This — not settle != null — is the scorecard's
   *  denominator: a boot that flattened settled, it did not vanish. */
  settled: boolean;
  /** R93 — the flat closer's own raw numbers (the last reading's boot-scoped
   *  climb and request count), so the strip can show WHY the boot reads flat.
   *  Null unless closer === 'flat'. */
  flatClimbMb: number | null;
  flatRequests: number | null;
}

/** THE settle engine — takes CHRONOLOGICAL rows (oldest first; the ledger
 *  API returns newest-first, so reverse before calling). Groups by bootPid —
 *  the serving worker's pid, constant for a boot's lifetime and the same key
 *  the ledger's cooldown uses — and returns one settle per boot, ledger
 *  order (first boot first). Boots whose boundary rows carry no ratio report
 *  dashes HONESTLY but are no longer all equal (R93): a boot whose last
 *  reading is the FLAT tier with a ratio-bearing first reading is a flat
 *  closer — settled, determinate, below the band; a boot that cannot be
 *  judged stays closer:null. */
export function computeSettles(chronological: SettleRowLike[]): BootSettle[] {
  const byPid = new Map<number, SettleRowLike[]>();
  for (const r of chronological) {
    const list = byPid.get(r.bootPid) ?? [];
    list.push(r);
    byPid.set(r.bootPid, list);
  }
  return [...byPid.entries()].map(([pid, list]) => {
    const first = list[0] as SettleRowLike;
    const last = list[list.length - 1] as SettleRowLike;
    const firstRatio = first.mbPer1k;
    const lastRatio = last.mbPer1k;
    const settle =
      firstRatio != null && lastRatio != null && list.length >= 2 ? lastRatio - firstRatio : null;
    const settlePct =
      settle != null && firstRatio != null && firstRatio !== 0
        ? (settle / Math.abs(firstRatio)) * 100
        : null;
    const inBand = lastRatio != null && lastRatio >= SETTLE_BAND_LO && lastRatio <= SETTLE_BAND_HI;
    // R93 — the flat closer: ≥2 readings, a first ratio to settle FROM, and
    // a last reading the tier engine filed under FLAT (climb ≤ 8MB — the
    // ratio never computes). The LAST row's kind is the ledger's own word
    // that identifies the class; the first row needs only its ratio.
    const flatCloser =
      list.length >= 2 && firstRatio != null && lastRatio == null && (last.kind ?? null) === "flat";
    // R93 — 'ratio' means the boot's OUTCOME is its last ratio — even when
    // the FIRST reading was flat (no ratio to settle FROM: 15180/17201's
    // shape), the outcome is determinate and the band judges it. The settle
    // NUMBER stays null where an endpoint lacks a ratio; the number and the
    // outcome are different goods and the UI names both.
    const closer: "ratio" | "flat" | null =
      lastRatio != null && list.length >= 2 ? "ratio" : flatCloser ? "flat" : null;
    return {
      pid,
      count: list.length,
      first,
      last,
      settle,
      settlePct,
      inBand,
      closer,
      settled: closer != null,
      flatClimbMb: flatCloser ? (last.climbMb ?? null) : null,
      flatRequests: flatCloser ? (last.requests ?? null) : null,
    };
  });
}

// R95 — THE OPEN-PAIR WATCHLIST. The two-reading ritual loses a race it is
// also measuring: a boot holding exactly ONE reading cannot be judged (the
// settle engine already says closer:null), and when that boot DIES the pair
// can never form — the opener sits in the ledger forever as an unjudged
// boundary snapshot (7046's 51.81, 17392's 56.03...). computeSettles folds
// those boots into a NO-RATIO-PAIR row; what the operator never SAW was the
// population: how many openers are waiting, which one can still be closed
// (the live boot), and which died open (the ritual lost — count them).
//
// openPairs is that population, derived from the SAME rows computeSettles
// already reads — one dataset, two views, zero drift (the R93 lesson). A
// boot with exactly one reading is an open pair; `live` marks the pair the
// RECORD READING button can still close (pid === the guardian's live
// worker). Openers on non-live boots are unpairable BY CONSTRUCTION —
// readings attach only to the live boot — and the UI names that honestly
// (DIED OPEN) rather than dressing it up.
export interface OpenPairEntry {
  pid: number;
  /** the opener's own tier word (tracked / mixed / flat ...) — null if the
   *  row predates kind. */
  openerKind: string | null;
  /** the opener's ratio — the number waiting to be paired; null for a flat
   *  opener (kind 'flat', no ratio computes). */
  openerMbPer1k: number | null;
  openerAt: string;
  openerClimbMb: number | null;
  openerRequests: number | null;
  /** true when this boot is the CURRENTLY-LIVE worker — the pair can still
   *  be recorded; false means the boot is gone and the opener never closes. */
  live: boolean;
}

/** Build the open-pair population from chronological readings. Boots with
 *  ≥2 readings are the settle engine's territory and are NOT listed here;
 *  boots with exactly one ARE. Order: the live boot first (actionable),
 *  then dead openers newest-first. */
export function openPairs(
  chronological: SettleRowLike[],
  livePid: number | null | undefined,
): OpenPairEntry[] {
  const byPid = new Map<number, SettleRowLike[]>();
  for (const r of chronological) {
    const list = byPid.get(r.bootPid) ?? [];
    list.push(r);
    byPid.set(r.bootPid, list);
  }
  const out: OpenPairEntry[] = [];
  for (const [pid, list] of byPid) {
    if (list.length !== 1) continue;
    const opener = list[0] as SettleRowLike;
    out.push({
      pid,
      openerKind: opener.kind ?? null,
      openerMbPer1k: opener.mbPer1k,
      openerAt: opener.at,
      openerClimbMb: opener.climbMb ?? null,
      openerRequests: opener.requests ?? null,
      live: livePid != null && pid === livePid,
    });
  }
  return out.sort((a, b) => {
    if (a.live !== b.live) return a.live ? -1 : 1;
    return b.openerAt.localeCompare(a.openerAt);
  });
}

// ── R97 · THE BOOT ARCS — ONE BOOT IS A SEQUENCE, NOT A PERSONALITY ─────────
// The scorecard's classes read a boot's ENDS (opener kind → closer kind);
// the open-pair watchlist reads its BOUNDARIES. What neither surface could
// see was the arc BETWEEN the readings — until 11015: the FIRST-EVER FLAT
// opener recorded a SECOND reading 17 minutes later that read REQUEST-
// TRACKED (+214 MB / 3,096 req → 69.12 MB/1k). The flat was a COLD-BOOT
// PHASE, not a boot personality — the class changed MID-BOOT, and only a
// per-reading sequence view can name that. computeBootArcs groups the SAME
// rows computeSettles and openPairs read (one dataset, three views, zero
// drift — the R93 lesson, extended), orders each boot's readings by uptime,
// and detects CLASS TRANSITIONS between consecutive readings. arcPopulation
// aggregates the arcs into the calibration read the scorecard cannot make:
// how many boots changed class mid-boot, which flows occurred (FLAT→TRACKED
// ×1 ...), and whether the opener's class predicts the closer's (the
// agreement rate that decides if the scorecard's opener column is evidence
// or decoration).
//
// Honesty rules:
//   - a transition requires BOTH kinds to be non-null — a null-kind reading
//     (a row older than the kind field, or an unclassifiable tier) is an
//     honest GAP in the arc: flat → null → tracked records NO transition,
//     because the middle class was never witnessed. Dressed-up inference is
//     how a ledger starts lying.
//   - the steps sort by (uptimeSec, atMs, input order) — rows older than
//     R80 carry neither field and keep their ledger order (append-only's
//     own chronology), never reordered behind a guess.
//   - 'single' is a shape, not a failure — the open-pair watchlist owns the
//     single-reading story; the arc just draws the one bead.

export interface ArcStep {
  at: string;
  atMs: number | null;
  uptimeSec: number | null;
  kind: string | null;
  tone: VerdictTone | null;
  climbMb: number | null;
  requests: number | null;
  mbPer1k: number | null;
  /** R99 — who triggered the reading ('operator' | 'auto-guardian'); null
   *  on pre-R99 rows. */
  via: string | null;
}

export interface ArcTransition {
  fromKind: string;
  toKind: string;
  /** the NEW reading's uptime — where the class changed (null when the row
   *  predates uptimeSec). */
  atUptimeSec: number | null;
  /** 0-based index of the NEW reading within the arc's steps. */
  readingIndex: number;
}

export type ArcShape = "single" | "stable" | "transition";

export interface BootArc {
  pid: number;
  devTreePid: number | null;
  bootStartUtc: string | null;
  steps: ArcStep[];
  openerKind: string | null;
  closerKind: string | null;
  transitions: ArcTransition[];
  shape: ArcShape;
  /** true when this pid is the currently-live worker — the arc that future
   *  readings will extend. */
  live: boolean;
}

export interface ArcKindFlow {
  from: string;
  to: string;
  count: number;
}

export interface ArcPopulation {
  boots: number;
  singleReading: number;
  stable: number;
  transitioning: number;
  /** every observed class flow across all arcs, count desc then label asc. */
  flows: ArcKindFlow[];
  /** among multi-reading boots whose opener AND closer both carry a class:
   *  does the opener's tier predict the closer's? null when no boot can be
   *  judged (no multi-reading boots, or every arc has a classless end). */
  openerPredictsCloser: { agreeing: number; judged: number } | null;
}

/** Tone fallback: a row with a kind but no recorded tone (rows older than
 *  the tone field, or a test projection) reads the SHARED table — the same
 *  authority the live verdict block uses. Unknown kinds fall to null (no
 *  invented colors). */
function arcTone(kind: string | null, tone: VerdictTone | null | undefined): VerdictTone | null {
  if (tone) return tone;
  if (kind == null) return null;
  return (VERDICT_TONE_BY_KIND as Record<string, VerdictTone | undefined>)[kind] ?? null;
}

/** THE boot arcs engine — takes CHRONOLOGICAL rows (oldest first; the same
 *  input computeSettles reads) and the live worker pid. Returns one arc per
 *  boot, FIRST-APPEARANCE order (the ledger's own boot chronology). */
export function computeBootArcs(
  chronological: SettleRowLike[],
  livePid?: number | null,
): BootArc[] {
  const byPid = new Map<number, SettleRowLike[]>();
  for (const r of chronological) {
    const list = byPid.get(r.bootPid) ?? [];
    list.push(r);
    byPid.set(r.bootPid, list);
  }
  const arcs: BootArc[] = [];
  for (const [pid, list] of byPid) {
    // stable sort by (uptimeSec ?? atMs ?? input order): rows carrying
    // uptime sort among themselves; rows without keep ledger chronology.
    // The spread + index tiebreak keeps the sort STABLE across engines.
    const indexed = list.map((row, i) => ({ row, i }));
    indexed.sort((a, b) => {
      const ua = a.row.uptimeSec ?? null;
      const ub = b.row.uptimeSec ?? null;
      if (ua != null && ub != null && ua !== ub) return ua - ub;
      if (ua != null && ub == null) return -1;
      if (ua == null && ub != null) return 1;
      const ma = a.row.atMs ?? null;
      const mb = b.row.atMs ?? null;
      if (ma != null && mb != null && ma !== mb) return ma - mb;
      return a.i - b.i; // ledger order — append-only's own chronology
    });
    const steps: ArcStep[] = indexed.map(({ row }) => ({
      at: row.at,
      atMs: row.atMs ?? null,
      uptimeSec: row.uptimeSec ?? null,
      kind: row.kind ?? null,
      tone: arcTone(row.kind ?? null, row.tone ?? null),
      climbMb: row.climbMb ?? null,
      requests: row.requests ?? null,
      mbPer1k: row.mbPer1k,
      via: row.via ?? null,
    }));
    const transitions: ArcTransition[] = [];
    for (let i = 1; i < steps.length; i++) {
      const fromKind = steps[i - 1]?.kind ?? null;
      const toKind = steps[i]?.kind ?? null;
      // BOTH classes must be witnessed — a null-kind gap records nothing.
      if (fromKind == null || toKind == null || fromKind === toKind) continue;
      transitions.push({
        fromKind,
        toKind,
        atUptimeSec: steps[i]?.uptimeSec ?? null,
        readingIndex: i,
      });
    }
    const shape: ArcShape =
      steps.length <= 1 ? "single" : transitions.length > 0 ? "transition" : "stable";
    arcs.push({
      pid,
      devTreePid: list.map((r) => r.devTreePid ?? null).find((v) => v != null) ?? null,
      bootStartUtc: list.map((r) => r.bootStartUtc ?? null).find((v) => v != null) ?? null,
      steps,
      openerKind: steps[0]?.kind ?? null,
      closerKind: steps[steps.length - 1]?.kind ?? null,
      transitions,
      shape,
      live: livePid != null && pid === livePid,
    });
  }
  return arcs;
}

/** THE arc population — the calibration read over the arcs: how many boots
 *  are single-reading / stable / transition-class, which flows occurred,
 *  and the opener→closer agreement rate (the scorecard's opener column is
 *  evidence only if that rate is high — the number that decides it). */
export function arcPopulation(arcs: BootArc[]): ArcPopulation {
  const flowMap = new Map<string, ArcKindFlow>();
  let judged = 0;
  let agreeing = 0;
  for (const arc of arcs) {
    for (const t of arc.transitions) {
      const key = `${t.fromKind}\u2192${t.toKind}`;
      const cur = flowMap.get(key) ?? { from: t.fromKind, to: t.toKind, count: 0 };
      cur.count += 1;
      flowMap.set(key, cur);
    }
    if (arc.shape !== "single" && arc.openerKind != null && arc.closerKind != null) {
      judged += 1;
      if (arc.openerKind === arc.closerKind) agreeing += 1;
    }
  }
  const flows = [...flowMap.values()].sort(
    (a, b) => b.count - a.count || `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`),
  );
  return {
    boots: arcs.length,
    singleReading: arcs.filter((a) => a.shape === "single").length,
    stable: arcs.filter((a) => a.shape === "stable").length,
    transitioning: arcs.filter((a) => a.shape === "transition").length,
    flows,
    openerPredictsCloser: judged > 0 ? { agreeing, judged } : null,
  };
}
