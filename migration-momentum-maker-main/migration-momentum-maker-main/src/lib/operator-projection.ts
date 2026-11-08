// src/lib/operator-projection.ts — R96 · THE OPERATOR PROJECTION, AS A
// TESTED ENGINE.
//
// R93 put the calibration menu on the surface; R94/R95 armed the rails with
// witnesses (memWitness: ≤12 guardian-pass samples at death) and watched the
// cadence flip ACCELERATING. The standing ask (R94 → R95 handover, twice):
// present the COMPUTED projection — expected bounces/day vs kernel kills/day
// for the operator's guard-2200 proposal — from the journal's own numbers,
// before the operator decides.
//
// This engine answers with the only honest arithmetic available:
//   1. WHICH RAIL CATCHES WHICH KILL — each witnessed 'port' kill (a kernel
//      OOM cleanup) carries its last ≤12 guardian passes (~4 min at 20s).
//      For a proposed rss guard G the rail "catches" the kill when some
//      witnessed pass read rss ≥ G BEFORE the kill stamp; for a proposed
//      avail floor F, when some pass read avail ≤ F. The catch margin is
//      kill-stamp − first-firing-stamp — the time the controlled landing
//      would have had.
//   2. THE LOOP GUARD — a rail that fires on the WARM state is not a rail:
//      a guard at/below the R69 plateau trips every pass (bounce loop); a
//      floor at/above the observed live minimum trips on the current window.
//      Such levels are marked WOULD LOOP before any catch count is quoted.
//   3. THE RATES — saves/day and kills/day over the journal's own coverage,
//      re-projected by reclassifying caught kills as controlled landings:
//      kills/day falls by the caught count, saves/day rises by it, and the
//      caught kills' downtime is replaced by the rss-class landing cost.
//
// HONESTY (the contracts this engine will not break):
//   - Catchability is computed INSIDE the witness window only (~4 min of
//     20s samples before death). "BLIND" means "never crossed in the
//     witnessed window" — a crossing outside the window is unknowable and
//     never guessed. The window's sampling granularity (20s) bounds every
//     margin from below by up to one pass.
//   - Unwitnessed kills stay kills in every projection (an unclassified
//     death is never optimistically reclassified).
//   - A margin ≤ 0 catches nothing — a rail firing at/after the kill stamp
//     is a cleanup, not a landing.
//   - Fewer than two real saves, or a span that cannot be computed, yields
//     null rates: the panel shows the dispositions and says the rates are
//     not yet computable (the R75 absence contract).

export interface WitnessSample {
  t: string;
  rssKb: number | null;
  availKb: number | null;
}

/** The subset of a journal row the engine reads (structural typing over the
 *  route's parsed rows — no I/O, no drift with the writer's schema). */
export interface ProjectionBounceRow {
  at?: string;
  reason?: string;
  drill?: boolean;
  downtimeMs?: number | null;
  memWitness?: Array<WitnessSample> | null;
}

export interface WitnessedKill {
  /** The journal's own UTC stamp for the kill (verbatim). */
  at: string;
  /** Parsed kill stamp (ms) — the same grammar the server uses. */
  atMs: number;
  /** Witness samples on the row (the honest coverage — often ≤12). */
  samples: number;
  /** The raw window (kept for the scenario evaluator — one parse, one
   *  consumer chain; the UI never re-reads the journal). */
  witness: Array<WitnessSample>;
  /** Peak next-server RSS inside the witness window (MB), null if no
   *  sample carried a finite rssKb. */
  maxRssMb: number | null;
  /** Deepest box MemAvailable inside the witness window (MB), null if no
   *  sample carried a finite availKb. */
  minAvailMb: number | null;
  windowFromMs: number | null;
  windowToMs: number | null;
  /** Witness stamps carrying a finite rssKb — the rss rail's real n. */
  rssSamples: number;
  /** Witness stamps carrying a finite availKb — the floor rail's real n. */
  availSamples: number;
  /** The row's own recorded downtime (ms) — the projection's replacement
   *  cost when this kill is reclassified as a controlled landing. */
  downtimeMs: number | null;
}

export interface WitnessedDeath extends WitnessedKill {
  /** The journal's own death reason — the cause lens's vocabulary
   *  (port / avail-critical / rss / whatever the journal writes). The
   *  rhythm instruments (eras, heartbeat, drifts, the lull dial) read
   *  ALL witnessed deaths; the rail grid keeps its port-only subject. */
  cause: string;
}

const KB_PER_MB = 1024;

/** The guardian's stamp grammar ("2026-09-24 22:00:03 UTC"), parsed to ms —
 *  identical grammar to the R94 page-side parser (kept local so the engine
 *  stays dependency-free; the r96 regression pins the behavior). */
export function parseGuardianStamp(t: string | null | undefined): number {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC$/.exec(String(t ?? "").trim());
  if (!m) return Number.NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

function finiteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** THE WALK — every real (non-drill) witnessed death, ANY cause, in journal
 *  order. R116: this used to live inside witnessedKills with a port-only
 *  filter, and the era/heartbeat/drift instruments inherited it — so when
 *  the box's memory scarcity began killing the dev server directly
 *  (avail-critical), those instruments went blind to the new killer: the
 *  07:34:42Z strike was invisible to the era engine, which then carved a
 *  PHANTOM era from a 59.42-min "lull" that was really 28.47 + 30.95 split
 *  by an uncounted death. The walk is now the record's own: every witnessed
 *  death carries its cause; the port instrument filters, the rhythm
 *  instruments do not.
 *
 *  R104 — THE WINDOW BOUND: the guardian's memWitness ring buffer continues
 *  ACROSS bounces (the watcher never restarts), so a bounce that lands soon
 *  after its predecessor carries the predecessor's dying samples at the head
 *  of its own window. The honest attribution: a bounce's window covers only
 *  samples stamped AFTER the previous real (non-drill) bounce — any cause —
 *  that stamp is the moment the previous boot was declared dead and the
 *  lineage passed to the next one. Drills are skipped as predecessors (their
 *  victims live on scratch ports and never enter :3000's boot lineage).
 *  Samples with unparsable stamps cannot be attributed to a boot at all —
 *  when a bound exists they drop from the window (counted nowhere twice);
 *  without a bound the row keeps the whole array, exactly as every
 *  pre-overlap read did. */
export function witnessedDeaths(rows: Array<ProjectionBounceRow>): Array<WitnessedDeath> {
  const out: Array<WitnessedDeath> = [];
  let lastRealAtMs: number | null = null; // the previous real bounce's stamp — the boot boundary
  for (const r of rows ?? []) {
    if (!r || r.drill === true) continue;
    const rowAtMs = parseGuardianStamp(r.at);
    const rowIsReal = Number.isFinite(rowAtMs);
    const w = Array.isArray(r.memWitness) ? r.memWitness : [];
    if (w.length > 0 && rowIsReal) {
      const bound = lastRealAtMs;
      // the boot-bounded window: samples this bounce's own boot lived through
      const ownWitness =
        bound == null
          ? w
          : w.filter((s) => {
              if (!s || typeof s !== "object") return false;
              const tMs = parseGuardianStamp(s.t);
              return Number.isFinite(tMs) && tMs > bound;
            });
      let maxRssKb: number | null = null;
      let minAvailKb: number | null = null;
      let windowFromMs: number | null = null;
      let windowToMs: number | null = null;
      let rssSamples = 0;
      let availSamples = 0;
      for (const s of ownWitness) {
        if (!s || typeof s !== "object") continue;
        const tMs = parseGuardianStamp(s.t);
        if (Number.isFinite(tMs)) {
          if (windowFromMs == null || tMs < windowFromMs) windowFromMs = tMs;
          if (windowToMs == null || tMs > windowToMs) windowToMs = tMs;
        }
        if (finiteNum(s.rssKb)) {
          rssSamples++;
          if (maxRssKb == null || s.rssKb > maxRssKb) maxRssKb = s.rssKb;
        }
        if (finiteNum(s.availKb)) {
          availSamples++;
          if (minAvailKb == null || s.availKb < minAvailKb) minAvailKb = s.availKb;
        }
      }
      out.push({
        at: String(r.at ?? ""),
        atMs: rowAtMs,
        cause: String(r.reason ?? "unknown"),
        samples: ownWitness.length,
        witness: ownWitness,
        maxRssMb: maxRssKb != null ? round1(maxRssKb / KB_PER_MB) : null,
        minAvailMb: minAvailKb != null ? round1(minAvailKb / KB_PER_MB) : null,
        windowFromMs,
        windowToMs,
        rssSamples,
        availSamples,
        downtimeMs:
          finiteNum(r.downtimeMs) && (r.downtimeMs as number) >= 0
            ? (r.downtimeMs as number)
            : null,
      });
    }
    if (rowIsReal) lastRealAtMs = rowAtMs;
  }
  return out;
}

/** The witnessed PORT kills: the rail instrument's subject — the exact
 *  pre-R116 feed (real non-drill 'port' rows carrying a non-empty
 *  memWitness), now a filtered VIEW of the shared walk so the window-bound
 *  math can never drift between the two. The rail grid, the ceiling band
 *  and the witness windows read this; the rhythm instruments read
 *  witnessedDeaths. */
export function witnessedKills(rows: Array<ProjectionBounceRow>): Array<WitnessedKill> {
  return witnessedDeaths(rows)
    .filter((d) => d.cause === "port")
    .map((d) => {
      const { cause: _cause, ...kill } = d;
      return kill;
    });
}

export type RailKind = "guard" | "floor";

export interface RailScenario {
  kind: RailKind;
  /** Proposed rail line in MB (guard fires at rss ≥ level; floor fires at
   *  avail ≤ level). */
  levelMb: number;
  /** True when this level equals the currently armed rail. */
  current: boolean;
  /** Witnessed kills this level catches (fires strictly before the kill). */
  caught: number;
  witnessed: number;
  /** Kill stamps (journal `at`) of the caught kills — the projection's
   *  reclassification set. */
  caughtAts: Array<string>;
  /** Catch margins in minutes (kill − first firing), ascending. */
  marginsMin: Array<number>;
  meanMarginMin: number | null;
  /** True when the level would fire on the WARM state — unlandable as
   *  armed (guard ≤ plateau baseline; floor ≥ observed live minimum).
   *  Null when the reference state is unknown. */
  loopRisk: boolean | null;
  /** The human reason for loopRisk, when true (the numbers that fired it). */
  loopWhy: string | null;
  verdict: "CATCHES" | "BLIND" | "WOULD LOOP";
}

export interface ScenarioRefs {
  currentGuardMb?: number | null;
  currentFloorMb?: number | null;
  /** R69 warm plateau (median RSS of the newest healthy passes) — a guard
   *  at/below it trips on every pass. */
  baselineMb?: number | null;
  /** Smallest box avail observed on the LIVE window (status memSeries) — a
   *  floor at/above it trips on the current calm. */
  observedMinAvailMb?: number | null;
}

export const DEFAULT_GUARD_LEVELS_MB = [1800, 1900, 2000, 2100, 2200, 2400];
export const DEFAULT_FLOOR_LEVELS_MB = [300, 400, 500, 600, 700, 800];

/** First witness sample meeting the rail test, as ms — null when the window
 *  never crosses the line. Samples are read in journal order (the guardian
 *  appends chronologically). */
export function firstFiringMs(
  w: Array<WitnessSample>,
  kind: RailKind,
  levelMb: number,
): number | null {
  for (const s of w ?? []) {
    if (!s || typeof s !== "object") continue;
    if (kind === "guard") {
      if (finiteNum(s.rssKb) && s.rssKb / KB_PER_MB >= levelMb) {
        const t = parseGuardianStamp(s.t);
        if (Number.isFinite(t)) return t;
      }
    } else {
      if (finiteNum(s.availKb) && s.availKb / KB_PER_MB <= levelMb) {
        const t = parseGuardianStamp(s.t);
        if (Number.isFinite(t)) return t;
      }
    }
  }
  return null;
}

/** Evaluate a grid of rail levels against the witnessed kills. Loop risk is
 *  computed FIRST and short-circuits the verdict — an unlandable level never
 *  advertises a catch count (its margins are not quoted: the rail would
 *  never survive to fire them). */
export function evaluateRailScenarios(
  kills: Array<WitnessedKill>,
  opts: ScenarioRefs & {
    guardLevelsMb?: Array<number>;
    floorLevelsMb?: Array<number>;
  } = {},
): Array<RailScenario> {
  const guards = opts.guardLevelsMb ?? [...DEFAULT_GUARD_LEVELS_MB];
  const floors = opts.floorLevelsMb ?? [...DEFAULT_FLOOR_LEVELS_MB];
  const out: Array<RailScenario> = [];

  const build = (kind: RailKind, levelMb: number): RailScenario => {
    const current =
      kind === "guard"
        ? opts.currentGuardMb != null && levelMb === opts.currentGuardMb
        : opts.currentFloorMb != null && levelMb === opts.currentFloorMb;
    const caughtAts: Array<string> = [];
    const marginsMin: Array<number> = [];
    for (const k of kills ?? []) {
      const fireMs = firstFiringMs(k.witness, kind, levelMb);
      if (fireMs == null) continue;
      const marginMin = (k.atMs - fireMs) / 60_000;
      if (marginMin <= 0) continue; // fires at/after death — a cleanup, not a catch
      caughtAts.push(k.at);
      marginsMin.push(round1(marginMin));
    }
    let loopRisk: boolean | null = null;
    let loopWhy: string | null = null;
    if (kind === "guard") {
      if (
        opts.baselineMb != null &&
        Number.isFinite(opts.baselineMb) &&
        levelMb <= opts.baselineMb
      ) {
        loopRisk = true;
        loopWhy = `warm plateau ~${Math.round(opts.baselineMb)} MB sits at/above the line — every pass trips`;
      }
    } else {
      if (
        opts.observedMinAvailMb != null &&
        Number.isFinite(opts.observedMinAvailMb) &&
        levelMb >= opts.observedMinAvailMb
      ) {
        loopRisk = true;
        loopWhy = `live window already dipped to ${Math.round(opts.observedMinAvailMb)} MB — the line fires on the current calm`;
      }
    }
    const verdict: RailScenario["verdict"] =
      loopRisk === true ? "WOULD LOOP" : caughtAts.length > 0 ? "CATCHES" : "BLIND";
    return {
      kind,
      levelMb,
      current,
      caught: caughtAts.length,
      witnessed: (kills ?? []).length,
      caughtAts,
      marginsMin,
      meanMarginMin:
        marginsMin.length > 0
          ? round1(marginsMin.reduce((a, b) => a + b, 0) / marginsMin.length)
          : null,
      loopRisk,
      loopWhy,
      verdict,
    };
  };

  for (const g of guards) if (Number.isFinite(g)) out.push(build("guard", g));
  for (const f of floors) if (Number.isFinite(f)) out.push(build("floor", f));
  return out;
}

export interface ProjectionRates {
  count: number;
  portCount: number;
  rssCount: number;
  /** The journal's own coverage (first→last real save), hours. */
  spanHours: number;
  portMeanMs: number | null;
  rssMeanMs: number | null;
  overallMeanMs: number | null;
  totalDowntimeMs: number;
}

/** Per-reason downtime means and day-rates over the journal's coverage —
 *  the same real (non-drill) rows the resilience block reads. */
export function projectionRates(rows: Array<ProjectionBounceRow>): ProjectionRates | null {
  const real = (rows ?? []).filter((r) => r && r.drill !== true);
  if (real.length < 2) return null;
  const ats = real
    .map((r) => parseGuardianStamp(r.at))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  const spanMs = ats.length >= 2 ? (ats[ats.length - 1] as number) - (ats[0] as number) : 0;
  if (spanMs <= 0) return null;
  const spanHours = spanMs / 3_600_000;

  const portRows = real.filter((r) => String(r.reason ?? "") === "port");
  const rssRows = real.filter((r) => String(r.reason ?? "") === "rss");
  const meanOf = (list: Array<ProjectionBounceRow>): number | null => {
    const ds = list.map((r) => r.downtimeMs).filter((d): d is number => finiteNum(d) && d >= 0);
    if (ds.length === 0) return null;
    return ds.reduce((a, b) => a + b, 0) / ds.length;
  };
  const allDt = real.map((r) => r.downtimeMs).filter((d): d is number => finiteNum(d) && d >= 0);
  return {
    count: real.length,
    portCount: portRows.length,
    rssCount: rssRows.length,
    spanHours: round1(spanHours * 10) / 10,
    portMeanMs: meanOf(portRows),
    rssMeanMs: meanOf(rssRows),
    overallMeanMs: allDt.length > 0 ? allDt.reduce((a, b) => a + b, 0) / allDt.length : null,
    totalDowntimeMs: allDt.reduce((a, b) => a + b, 0),
  };
}

export interface ScenarioProjection {
  /** Projected kernel kills per day (uncaught kills stay kills). */
  killsPerDay: number;
  /** Projected controlled saves per day (rss landings + caught kills). */
  savesPerDay: number;
  /** Projected downtime per day, minutes. */
  downtimePerDayMin: number;
  /** Minutes of downtime per day the scenario saves vs the record. */
  savedPerDayMin: number;
  /** Downtime per day over the record as landed (the comparison line). */
  currentDowntimePerDayMin: number;
}

/** Reclassify the scenario's caught kills as controlled landings and re-read
 *  the day-rates. The caught rows' own downtime leaves the ledger and the
 *  rss-class landing mean takes its place (fallback chain: rss mean →
 *  overall mean → port mean — the projection must stay computable on thin
 *  classes; every candidate is the journal's own number). Unwitnessed and
 *  uncaught kills keep their recorded downtime. */
export function projectScenario(
  rates: ProjectionRates,
  scenario: RailScenario,
  kills: Array<WitnessedKill>,
): ScenarioProjection | null {
  if (!rates || !(rates.spanHours > 0)) return null;
  const caughtSet = new Set(scenario.caughtAts);
  const caught = caughtSet.size;
  const projKills = Math.max(0, rates.portCount - caught);
  const projSaves = rates.rssCount + caught;

  const dtOf = (at: string): number | null => {
    const k = (kills ?? []).find((x) => x.at === at);
    return k ? k.downtimeMs : null;
  };
  let caughtDowntimeMs = 0;
  for (const at of caughtSet) {
    const own = dtOf(at);
    caughtDowntimeMs += own ?? rates.portMeanMs ?? 0;
  }
  const landingCost = rates.rssMeanMs ?? rates.overallMeanMs ?? rates.portMeanMs ?? 0;
  const projectedTotalMs =
    Math.max(0, rates.totalDowntimeMs - caughtDowntimeMs) + caught * landingCost;

  // Day-rates: count-per-day over the journal's own coverage; downtime as
  // minutes per day. One span, the same the resilience block quotes.
  const perDayCount = (n: number) => (n / rates.spanHours) * 24;
  const perDayMin = (ms: number) => (ms / 60_000 / rates.spanHours) * 24;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const currentDowntimePerDayMin = r1(perDayMin(rates.totalDowntimeMs));
  const downtimePerDayMin = r1(perDayMin(projectedTotalMs));
  return {
    killsPerDay: r1(perDayCount(projKills)),
    savesPerDay: r1(perDayCount(projSaves)),
    downtimePerDayMin,
    savedPerDayMin: r1(currentDowntimePerDayMin - downtimePerDayMin),
    currentDowntimePerDayMin,
  };
}

export interface RailProjectionMeta {
  guardMb: number | null;
  floorMb: number | null;
  baselineMb: number | null;
  observedMinAvailMb: number | null;
  /** Witness window scope, disclosed on the surface (the honesty line). */
  windowNote: string;
  witnessedPort: number;
  unwitnessedPort: number;
}

import { buildWitnessWindows, type WitnessWindowRead } from "@/lib/witness-windows";

export interface RailProjectionPayload {
  /** The witnessed kills, journal order (oldest first) — PORT-only: the
   *  rail instrument's subject, unchanged since R96. */
  witnessed: Array<WitnessedKill>;
  /** R116 — every witnessed death, ANY cause (the shared walk, unfiltered).
   *  The rhythm instruments (eras, heartbeat, drifts, the lull dial) read
   *  this: a record whose second killer is invisible would carve phantom
   *  eras from lulls that never happened. */
  witnessedDeaths: Array<WitnessedDeath>;
  /** Rail scenarios, guards then floors, in the grids' order. */
  scenarios: Array<RailScenario>;
  /** The record's day-rates (null when the span cannot carry them). */
  rates: ProjectionRates | null;
  /** Per-scenario projections keyed `${kind}:${levelMb}` — present only for
   *  scenarios whose verdict is CATCHES (a blind or looping rail reclassifies
   *  nothing, so it has no projection to quote). */
  projections: Record<string, ScenarioProjection>;
  /** R98 — the same witnessed kills' window SHAPES, aligned by index with
   *  `witnessed` (the dying minute's trajectory word: sawtooth / climbing /
   *  falling / flat / unjudged). One parse, one more view — zero drift. */
  witnessWindows: Array<WitnessWindowRead>;
  /** R116 — the same SHAPES aligned by index with `witnessedDeaths` (all
   *  causes): the rhythm panels that switched feeds keep their alignment
   *  without a second parse. */
  witnessDeathWindows: Array<WitnessWindowRead>;
  meta: RailProjectionMeta;
}

/** The one-call orchestration the /api/guardian route serves: witnessed
 *  kills → rail scenarios → rates → per-scenario projections, all from the
 *  journal rows + the guardian's own live references. Pure — no I/O here. */
export function buildRailProjection(
  rows: Array<ProjectionBounceRow>,
  opts: ScenarioRefs & {
    guardLevelsMb?: Array<number>;
    floorLevelsMb?: Array<number>;
  } = {},
): RailProjectionPayload {
  const deaths = witnessedDeaths(rows);
  const kills = witnessedKills(rows);
  const scenarios = evaluateRailScenarios(kills, opts);
  const rates = projectionRates(rows);
  const projections: Record<string, ScenarioProjection> = {};
  if (rates) {
    for (const s of scenarios) {
      if (s.verdict !== "CATCHES") continue; // blind/looping rails reclassify nothing
      const p = projectScenario(rates, s, kills);
      if (p) projections[`${s.kind}:${s.levelMb}`] = p;
    }
  }
  const portCount = rates?.portCount ?? 0;
  return {
    witnessed: kills,
    witnessedDeaths: deaths,
    scenarios,
    rates,
    projections,
    witnessWindows: buildWitnessWindows(kills, parseGuardianStamp),
    witnessDeathWindows: buildWitnessWindows(deaths, parseGuardianStamp),
    meta: {
      guardMb: opts.currentGuardMb ?? null,
      floorMb: opts.currentFloorMb ?? null,
      baselineMb: opts.baselineMb ?? null,
      observedMinAvailMb: opts.observedMinAvailMb ?? null,
      windowNote:
        "witness = the guardian\u2019s last \u226412 passes before death (~4 min at 20s) \u2014 catchability is computed inside that window only",
      witnessedPort: kills.length,
      unwitnessedPort: Math.max(0, portCount - kills.length),
    },
  };
}
