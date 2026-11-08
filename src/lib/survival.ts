// R112 — THE SURVIVAL CURVE: the record's tenures, read as survival.
//
// The boot ledger (R111) answered HOW LONG each boot lived. This engine
// answers the question the tenures were always reaching for: what are a
// boot's ODDS of holding the port past a given minute? The settled medians
// and the OLS trend read the deaths — but they silently EXCLUDE the one
// boot whose end has not come. A life without an end is not a life that
// never happened; it is a life we have not finished watching. Survival
// analysis has the honest grammar for exactly this: censoring.
//
//   THE ESTIMATOR: Kaplan-Meier, by hand, on the boot ledger's own walk.
//     · population — every served boot with a witnessed spawn (the ledger's
//       boots[] minus the stillborn, who never confirmed serving and so
//       never entered life; minus the root, who has no witnessed spawn).
//     · a deceased boot contributes a DEATH at its tenure.
//     · the living boot contributes a CENSORING at its current age — it
//       stays in every risk set it has truly survived, and leaves the
//       moment its story ends. Unjournaled served boots are censored at
//       their last witnessed moment — the spawn itself (tenure 0) — which
//       mathematically removes them from every risk set; the count is
//       disclosed, never hidden.
//     · at each distinct death time d: S(d) = S(prev) × (1 − deaths_at_d /
//       at_risk_at_d), the risk set being every observation with tenure
//       ≥ d (deaths at d included; censored at d included — the standard
//       convention, and no censoring stamp in this record coincides with
//       a death stamp in practice).
//
//   THE INFANCY WATCH (the R111 handover's named priority): the youngest
//   tail of the tenure strip — boots that died before the five-minute
//   line. Ground truth calibrated the line at INFANT_TENURE_MIN = 5: the
//   live record's settled tenures show a dead zone from 3.23 to 15.7
//   minutes (nine deaths inside it, zero inside the zone's middle), so
//   any line in (3.23, 15.7) counts the same nine; 5 sits squarely in
//   the silence. A boot that has seen five minutes is no longer an
//   infant. The watch is DESCRIPTIVE — counts, shares, and an era split
//   of counts (the pair-sheet halves convention). It never calls a
//   killer and never runs a significance test it does not name.
//
// Pure: no I/O, no clock. The ledger walk is handed in; this module
// re-derives nothing the journal already says.

import type { BootTenure } from './boot-ledger';

/** The five-minute line: a boot that has seen five minutes is no longer
 *  an infant. Calibrated on the live record's dead zone (3.23 → 15.7 min):
 *  identical infant counts at <4, <5, <6, <10 — the line sits in silence. */
export const INFANT_TENURE_MIN = 5.0;

/** The survival checkpoints the panel draws guides at: the five-minute
 *  line, the half hour (one calm cadence), the hour (a long calm). */
export const SURVIVAL_CHECKPOINTS_MIN = [5, 30, 60] as const;

/** Minimum settled boots per half before the era split may speak. */
export const INFANT_ERA_MIN_HALF = 10;

/** R115 — THE HAZARD LENS, layer two of the instrument: the two-sided 95%
 *  normal quantile, full precision — the Greenwood band's own z. */
export const SURVIVAL_CI_Z_975 = 1.959963984540054;
/** The band's level, named for the chips and the note. */
export const SURVIVAL_CI_LEVEL = 95;

export interface SurvivalStep {
  /** Death time in minutes (full precision; the panel rounds). */
  tMin: number;
  /** Cumulative survival just after this step. */
  s: number;
  /** Risk set size just before this step (deaths and censored-at-d in). */
  atRisk: number;
  deathsAt: number;
  /** R115 — THE HAZARD: deaths ÷ at-risk at this death time — the
   *  actuarial risk of dying HERE, the quantity the KM step factors in.
   *  Full precision; the panel scales its lane to the max. */
  hazard: number;
  /** R115 — the Greenwood accumulator Σ dᵢ/(nᵢ(nᵢ−dᵢ)) through this step
   *  (frozen at its last finite value where the band broke). */
  cumTerm: number;
  /** R115 — Greenwood standard error √(S²·Σ), null where the band broke
   *  (every boot at risk died — dᵢ = nᵢ has no honest variance). */
  se: number | null;
  /** R115 — the 95% band, clamped to [0,1]; null where the band broke. */
  ciLo: number | null;
  ciHi: number | null;
}

export interface SurvivalCheckpoint {
  tMin: number;
  /** S(t) — null only when the population is empty. */
  s: number | null;
  /** R115 — the 95% band at t (the last step at-or-before t); before the
   *  first death the band is [1,1] (no variance with no deaths); null only
   *  when the population is empty or the band has broken by t. */
  ciLo: number | null;
  ciHi: number | null;
}

export type InfantEraWord = 'DEEPENING' | 'EASING' | 'EVEN' | 'TOO FEW';

export interface SurvivalRead {
  /** Served boots with a witnessed spawn — the walked population. */
  population: number;
  deaths: number;
  /** Censored observations: the living (age known, end not come) plus
   *  unjournaled served (lost sight of at spawn). */
  censored: number;
  censoredLiving: number;
  censoredUnjournaled: number;
  /** Named exclusions — never silently dropped. */
  excludedStillborn: number;
  rootPid: number | null;
  /** The KM steps, in death-time order. */
  steps: SurvivalStep[];
  /** S at each named checkpoint. */
  checkpoints: SurvivalCheckpoint[];
  /** Smallest death time whose S ≤ 0.5; null when the curve never fell
   *  that far inside the record's observation (medianBeyond names it). */
  medianSurvivalMin: number | null;
  medianBeyond: boolean;
  /** S(INFANT_TENURE_MIN) — the odds of seeing five minutes. */
  sAtInfancy: number | null;
  /** Deaths before the five-minute line, and their share of the walked
   *  population. */
  infantDeaths: number;
  infantSharePct: number | null;
  /** The era split of infant DEATH COUNTS (pair-sheet halves over the
   *  settled population, floor(n/2) per side). */
  infantEraFirstHalf: number | null;
  infantEraLastHalf: number | null;
  infantEraFirstHalfN: number;
  infantEraLastHalfN: number;
  infantEra: InfantEraWord;
  /** R115 — the first death time where every boot at risk died (dᵢ = nᵢ):
   *  past it the Greenwood sum carries an infinite term and the band walks
   *  off the record. Null while the band stays computable. */
  bandBrokenAtMin: number | null;
  /** R115 — where the 95% band is WIDEST (the record's least certain
   *  moment): the step whose clamp-adjusted half-width is largest, in
   *  percentage points. Null when no step carries a band. */
  widestBand: { tMin: number; halfWidthPct: number } | null;
  /** The living boot's current age (censored), minutes. */
  livingAgeMin: number | null;
  note: string;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** Fraction (0–1) to a percent with one decimal. */
function roundPct(x: number): number {
  return Math.round(x * 1000) / 10;
}

/** A value already in percent — one decimal, no re-scaling. */
function roundPctValue(x: number): number {
  return Math.round(x * 10) / 10;
}

export function survivalRead(
  boots: BootTenure[],
  rootPid: number | null,
): SurvivalRead {
  // The walked population: served boots with a witnessed spawn.
  const pop = boots.filter((b) => b.served);
  const excludedStillborn = boots.filter((b) => b.stillborn).length;

  type Obs = { t: number; dead: boolean; infantDeath: boolean };
  const obs: Obs[] = [];
  let censoredLiving = 0;
  let censoredUnjournaled = 0;
  let livingAgeMin: number | null = null;

  for (const b of pop) {
    if (b.endState === 'deceased' && b.tenureMin !== null) {
      obs.push({ t: b.tenureMin, dead: true, infantDeath: b.tenureMin < INFANT_TENURE_MIN });
    } else if (b.endState === 'living' && b.tenureMin !== null) {
      obs.push({ t: b.tenureMin, dead: false, infantDeath: false });
      censoredLiving += 1;
      livingAgeMin = b.tenureMin;
    } else {
      // Unjournaled served: alive at spawn, end unwitnessed. Censored at
      // the last witnessed moment — the spawn itself (tenure 0).
      obs.push({ t: 0, dead: false, infantDeath: false });
      censoredUnjournaled += 1;
    }
  }

  const population = obs.length;
  const deaths = obs.filter((o) => o.dead).length;
  const censored = censoredLiving + censoredUnjournaled;

  // KM steps at each distinct death time — with the Greenwood band and
  // the per-step hazard (R115, THE HAZARD LENS).
  const steps: SurvivalStep[] = [];
  let s = 1;
  let cumTerm = 0;
  let bandBroken = false;
  let bandBrokenAtMin: number | null = null;
  if (population > 0) {
    const deathTimes = [...new Set(obs.filter((o) => o.dead).map((o) => o.t))].sort((a, b) => a - b);
    for (const d of deathTimes) {
      const atRisk = obs.filter((o) => o.t >= d).length;
      const deathsAt = obs.filter((o) => o.dead && o.t === d).length;
      s = s * (1 - deathsAt / atRisk);
      const hazard = deathsAt / atRisk;
      if (!bandBroken) {
        if (atRisk - deathsAt > 0) {
          cumTerm += deathsAt / (atRisk * (atRisk - deathsAt));
          const se = Math.sqrt(s * s * cumTerm);
          steps.push({
            tMin: d,
            s,
            atRisk,
            deathsAt,
            hazard,
            cumTerm,
            se,
            ciLo: Math.max(0, s - SURVIVAL_CI_Z_975 * se),
            ciHi: Math.min(1, s + SURVIVAL_CI_Z_975 * se),
          });
        } else {
          // dᵢ = nᵢ — the sum's next term is infinite; the band walks off.
          bandBroken = true;
          bandBrokenAtMin = d;
          steps.push({ tMin: d, s, atRisk, deathsAt, hazard, cumTerm, se: null, ciLo: null, ciHi: null });
        }
      } else {
        steps.push({ tMin: d, s, atRisk, deathsAt, hazard, cumTerm, se: null, ciLo: null, ciHi: null });
      }
    }
  }

  const checkpoints: SurvivalCheckpoint[] = SURVIVAL_CHECKPOINTS_MIN.map((t) => {
    if (population === 0) return { tMin: t, s: null, ciLo: null, ciHi: null };
    let last: SurvivalStep | null = null;
    for (const st of steps) {
      if (st.tMin <= t) last = st;
      else break;
    }
    if (last === null) return { tMin: t, s: 1, ciLo: 1, ciHi: 1 };
    return { tMin: t, s: last.s, ciLo: last.ciLo, ciHi: last.ciHi };
  });

  let medianSurvivalMin: number | null = null;
  for (const st of steps) {
    if (st.s <= 0.5) {
      medianSurvivalMin = st.tMin;
      break;
    }
  }
  const medianBeyond = population > 0 && medianSurvivalMin === null;

  const sAtInfancy = checkpoints.find((c) => c.tMin === INFANT_TENURE_MIN)?.s ?? null;
  const infantDeaths = obs.filter((o) => o.infantDeath).length;
  const infantSharePct = population > 0 ? (infantDeaths / population) * 100 : null;

  // R115 — the widest band: the record's least certain moment.
  let widestBand: { tMin: number; halfWidthPct: number } | null = null;
  for (const st of steps) {
    if (st.ciLo === null || st.ciHi === null) continue;
    const hw = Math.round(((st.ciHi - st.ciLo) / 2) * 1000) / 10; // percentage points, one decimal
    if (widestBand === null || hw > widestBand.halfWidthPct) {
      widestBand = { tMin: st.tMin, halfWidthPct: hw };
    }
  }

  // The era split: settled boots in spawn order, floor(n/2) per side.
  const settled = pop
    .filter((b) => b.endState === 'deceased' && b.tenureMin !== null)
    .sort((a, b) => a.spawnIndex - b.spawnIndex);
  const half = Math.floor(settled.length / 2);
  let infantEraFirstHalf: number | null = null;
  let infantEraLastHalf: number | null = null;
  let infantEra: InfantEraWord = 'TOO FEW';
  if (half >= INFANT_ERA_MIN_HALF) {
    const firstSlice = settled.slice(0, half);
    const lastSlice = settled.slice(settled.length - half);
    infantEraFirstHalf = firstSlice.filter((b) => (b.tenureMin as number) < INFANT_TENURE_MIN).length;
    infantEraLastHalf = lastSlice.filter((b) => (b.tenureMin as number) < INFANT_TENURE_MIN).length;
    if (infantEraLastHalf! > infantEraFirstHalf!) infantEra = 'DEEPENING';
    else if (infantEraLastHalf! < infantEraFirstHalf!) infantEra = 'EASING';
    else infantEra = 'EVEN';
  }

  const note = buildNote({
    population,
    deaths,
    censored,
    censoredLiving,
    censoredUnjournaled,
    excludedStillborn,
    rootPid,
    checkpoints,
    medianSurvivalMin,
    medianBeyond,
    sAtInfancy,
    infantDeaths,
    infantSharePct,
    infantEraFirstHalf,
    infantEraLastHalf,
    infantEraFirstHalfN: half >= INFANT_ERA_MIN_HALF ? half : 0,
    infantEraLastHalfN: half >= INFANT_ERA_MIN_HALF ? half : 0,
    infantEra,
    bandBrokenAtMin,
    widestBand,
    livingAgeMin,
  });

  return {
    population,
    deaths,
    censored,
    censoredLiving,
    censoredUnjournaled,
    excludedStillborn,
    rootPid,
    steps,
    checkpoints,
    medianSurvivalMin,
    medianBeyond,
    sAtInfancy,
    infantDeaths,
    infantSharePct,
    infantEraFirstHalf,
    infantEraLastHalf,
    infantEraFirstHalfN: half >= INFANT_ERA_MIN_HALF ? half : 0,
    infantEraLastHalfN: half >= INFANT_ERA_MIN_HALF ? half : 0,
    infantEra,
    bandBrokenAtMin,
    widestBand,
    livingAgeMin,
    note,
  };
}

function buildNote(r: {
  population: number;
  deaths: number;
  censored: number;
  censoredLiving: number;
  censoredUnjournaled: number;
  excludedStillborn: number;
  rootPid: number | null;
  checkpoints: SurvivalCheckpoint[];
  medianSurvivalMin: number | null;
  medianBeyond: boolean;
  sAtInfancy: number | null;
  infantDeaths: number;
  infantSharePct: number | null;
  infantEraFirstHalf: number | null;
  infantEraLastHalf: number | null;
  infantEraFirstHalfN: number;
  infantEraLastHalfN: number;
  infantEra: InfantEraWord;
  bandBrokenAtMin: number | null;
  widestBand: { tMin: number; halfWidthPct: number } | null;
  livingAgeMin: number | null;
}): string {
  if (r.population === 0) {
    return 'No served boot has a witnessed spawn yet — the survival curve waits for a population. It does not draw from nothing.';
  }
  const parts: string[] = [];
  const censorBits: string[] = [];
  if (r.censoredLiving > 0 && r.livingAgeMin !== null) {
    censorBits.push(`the living boot at ${round1(r.livingAgeMin)} min, still holding`);
  }
  if (r.censoredUnjournaled > 0) {
    censorBits.push(`${r.censoredUnjournaled} unjournaled (censored at spawn — lost sight of at birth)`);
  }
  parts.push(
    `${r.population} served boots walked: ${r.deaths} deaths, ${r.censored} censored (${censorBits.join('; ') || 'none'})`,
  );
  const cp = r.checkpoints
    .filter((c) => c.s !== null)
    .map((c) => `${roundPct(c.s as number)}% at ${c.tMin} min`)
    .join(' · ');
  if (cp) parts.push(`KM survival ${cp}`);
  if (r.medianSurvivalMin !== null) {
    parts.push(`median survival ${round1(r.medianSurvivalMin)} min`);
  } else if (r.medianBeyond) {
    parts.push('median survival beyond the record — the curve never fell to half inside the observation');
  }
  if (r.widestBand !== null) {
    parts.push(
      `the ${SURVIVAL_CI_LEVEL}% Greenwood band is widest ±${round1(r.widestBand.halfWidthPct)} points at ${round1(r.widestBand.tMin)} min — the record's least certain moment`,
    );
  }
  if (r.bandBrokenAtMin !== null) {
    parts.push(
      `the band walks off at ${round1(r.bandBrokenAtMin)} min — every boot at risk died there, and a sum with a zero denominator has no honest value past it`,
    );
  }
  if (r.sAtInfancy !== null) {
    parts.push(
      `THE INFANCY WATCH: ${r.infantDeaths} of ${r.population} lives ended inside ${INFANT_TENURE_MIN} min (${roundPctValue(r.infantSharePct as number)}%) — odds of seeing the line: ${roundPct(r.sAtInfancy)}%`,
    );
  }
  if (r.infantEra === 'TOO FEW') {
    parts.push(`era split TOO FEW (needs ${INFANT_ERA_MIN_HALF} settled per half)`);
  } else if (r.infantEraFirstHalf !== null && r.infantEraLastHalf !== null) {
    parts.push(
      `infant halves ${r.infantEraFirstHalf}/${r.infantEraFirstHalfN} early → ${r.infantEraLastHalf}/${r.infantEraLastHalfN} late — ${r.infantEra} (a split of counts, not a significance test)`,
    );
  }
  if (r.excludedStillborn > 0) {
    parts.push(`${r.excludedStillborn} stillborn excluded (never confirmed serving — no witnessed life to survive)`);
  }
  if (r.rootPid !== null) {
    parts.push(`root pid ${r.rootPid} excluded (no witnessed spawn)`);
  }
  return parts.join(' · ');
}
