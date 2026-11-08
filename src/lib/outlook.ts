/**
 * THE OUTLOOK — the "what's next" read (R107).
 *
 * Every panel so far reads the record BACKWARD: the storm history reads
 * where boots died, the box floor reads where the box stood, the pair
 * sheet reads how boots opened, the three drifts reconcile the three
 * velocities. The operator's remaining question is FORWARD: given the
 * living series and the record's own heartbeat, WHAT IS COMING?
 *
 * Two dials answer it, each from data that already exists:
 *
 *  · THE RUNWAY — the living memSeries' own OLS (MB/min) projected to the
 *    guard line. The eta is a point estimate, never a promise: it speaks
 *    only when the window is deep enough (MIN_RUNWAY_SAMPLES), the climb
 *    has not stalled (rate above RUNWAY_MIN_RATE_MB_PER_MIN), and there is
 *    headroom left to the guard. The fit's R² is disclosed through the
 *    shared call gate (R2_CALL_THRESHOLD, imported — one calibration,
 *    many readers): a 'tight' eta wears one face, a 'loose' eta another,
 *    but both are SHOWN — a noisy eta counted honestly beats an eta
 *    hidden.
 *
 *  · THE LULL — the minutes since the last witnessed kill, read against
 *    the storm history's own heartbeat median (passed in by the caller —
 *    this engine owns no re-derivation of another panel's number). The
 *    stretching threshold is CADENCE_STRETCH_RATIO, imported from
 *    storm-history: the SAME calibration that calls the record's cadence
 *    calls the live gap. When the live gap runs past 1.25× the heartbeat,
 *    the estate is in a lull — the quiet window the ceiling re-read has
 *    been waiting for.
 *
 * Honesty inherited from the house rules: null rss samples keep their
 * place in the count and drop from the fit (counted, never imputed);
 * a stalled climb gets NO eta (a negative-time projection is a lie);
 * an unparseable stamp or a clock-skewed kill (gap < 0) reads 'unjudged'
 * rather than inventing a gap; and every read names its own scope — the
 * runway is THIS WINDOW's projection, the lull is THIS RECORD's heartbeat.
 */

import { parseGuardianStamp } from '@/lib/operator-projection';
import { CADENCE_STRETCH_RATIO } from '@/lib/storm-history';
import { R2_CALL_THRESHOLD } from '@/lib/three-drifts';

/** The runway speaks only from a window this deep (judged samples). */
export const MIN_RUNWAY_SAMPLES = 20;
/** Below this rate (MB/min) the climb has stalled — no eta is honest. */
export const RUNWAY_MIN_RATE_MB_PER_MIN = 1.0;
/** Eta words: ≤ SHORT → 'short', ≤ BUILDING → 'building', else 'open'. */
export const RUNWAY_SHORT_MIN = 30;
export const RUNWAY_BUILDING_MIN = 90;
/** The runway strip's drawing horizon (minutes) — an eta beyond it pins
 *  the far edge with a beyond-horizon disclosure instead of lying wide. */
export const RUNWAY_HORIZON_MIN = 120;

/** One guardian memSeries sample, exactly the shape /api/guardian serves. */
export interface OutlookSample {
  t: string;
  rssKb: number | null;
  availKb: number | null;
}

export type EtaWord = 'short' | 'building' | 'open' | null;
export type LullRead = 'in-cadence' | 'stretching' | 'no-storm' | 'unjudged';
export type ClimbFit = 'tight' | 'loose' | null;

export interface OutlookInputs {
  samples: Array<OutlookSample> | null | undefined;
  /** The live guard line (MB) — the runway's far end. */
  guardMb: number | null | undefined;
  /** Server "now" (ms) — the lull's near edge. */
  nowMs: number;
  /** The last witnessed kill's stamp (ms), null when the record has none
   *  or the stamp did not parse (the caller's honesty, passed through). */
  lastKillAtMs: number | null;
  /** The storm history's full-median heartbeat (minutes), null when the
   *  record cannot carry one yet. */
  heartbeatMedianMin: number | null;
  /** The CURRENT boot's first stamp (ms) — the last bounce's time. The
   *  living memSeries is continuous across bounces (R93's ordering), so a
   *  window that straddles a bounce mixes two boots' climbs AND the death
   *  drop into one fit — exactly the averaging-away the house rules
   *  forbid. When present, samples older than this stamp drop from the
   *  runway (counted in samplesOffered, never imputed — they stay in the
   *  living series, they just do not forecast THIS boot). Null when the
   *  caller has no bounce stamp: the full window speaks. */
  bootSinceMs: number | null;
}

export interface OutlookRead {
  // ── the runway ──
  samplesOffered: number;
  runwayJudged: number;
  windowSpanMin: number | null;
  climbRateMbPerMin: number | null;
  climbR2: number | null;
  climbFit: ClimbFit;
  currentRssMb: number | null;
  headroomMb: number | null;
  etaMin: number | null;
  etaWord: EtaWord;
  etaBeyondHorizon: boolean;
  // ── the lull ──
  gapSinceKillMin: number | null;
  heartbeatMedianMin: number | null;
  lullMultiple: number | null;
  lullRead: LullRead;
  // ── the read ──
  note: string;
}

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Ordinary least squares of y on x; returns slope (per x-unit), r² and
 *  the x/y spans. Nulls must be filtered by the caller — this stays pure
 *  arithmetic on finite pairs. */
function ols(pairs: Array<{ x: number; y: number }>): { slope: number; r2: number } | null {
  const n = pairs.length;
  if (n < 2) return null;
  const mx = pairs.reduce((s, p) => s + p.x, 0) / n;
  const my = pairs.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of pairs) {
    const dx = p.x - mx;
    const dy = p.y - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  const slope = sxy / sxx;
  const r2 = (sxy * sxy) / (sxx * syy);
  return { slope, r2 };
}

export function outlookRead(inputs: OutlookInputs): OutlookRead {
  const raw = Array.isArray(inputs.samples) ? inputs.samples : [];
  const guardMb = finite(inputs.guardMb) ? (inputs.guardMb as number) : null;

  // ── the runway: judged samples are the finite-rss ones (counted, never
  // imputed); stamps must parse — an unparseable sample drops from the fit.
  // Boot-scoped: samples older than the current boot's first stamp drop
  // from the forecast (the death drop is not this boot's climb).
  const bootSinceMs = inputs.bootSinceMs != null && Number.isFinite(inputs.bootSinceMs) ? inputs.bootSinceMs : null;
  const judged: Array<{ x: number; y: number }> = [];
  let firstMs: number | null = null;
  let lastMs: number | null = null;
  for (const s of raw) {
    const tMs = parseGuardianStamp(s?.t);
    if (!Number.isFinite(tMs)) continue;
    if (bootSinceMs != null && tMs < bootSinceMs) continue;
    if (!finite(s?.rssKb)) continue;
    judged.push({ x: tMs / 60000, y: (s.rssKb as number) / 1024 });
    if (firstMs == null || tMs < firstMs) firstMs = tMs;
    if (lastMs == null || tMs > lastMs) lastMs = tMs;
  }
  const windowSpanMin = firstMs != null && lastMs != null && lastMs >= firstMs ? round1((lastMs - firstMs) / 60000) : null;
  const currentRssMb = judged.length > 0 ? round1(judged[judged.length - 1]!.y) : null;

  let climbRateMbPerMin: number | null = null;
  let climbR2: number | null = null;
  let climbFit: ClimbFit = null;
  let etaMin: number | null = null;
  let etaWord: EtaWord = null;
  let etaBeyondHorizon = false;
  let headroomMb: number | null = null;

  if (judged.length < MIN_RUNWAY_SAMPLES) {
    // window too young — the runway refuses to speak
  } else {
    const fit = ols(judged);
    if (fit) {
      climbRateMbPerMin = round2(fit.slope);
      climbR2 = round2(fit.r2);
      climbFit = fit.r2 >= R2_CALL_THRESHOLD ? 'tight' : 'loose';
      if (currentRssMb != null && guardMb != null) {
        headroomMb = round1(guardMb - currentRssMb);
        if (guardMb <= currentRssMb) {
          // past the line — the guardian's own rail owns this moment
        } else if (fit.slope <= RUNWAY_MIN_RATE_MB_PER_MIN) {
          // stalled climb — no eta is honest here
        } else {
          etaMin = round1(headroomMb / fit.slope);
          etaBeyondHorizon = etaMin > RUNWAY_HORIZON_MIN;
          etaWord = etaMin <= RUNWAY_SHORT_MIN ? 'short' : etaMin <= RUNWAY_BUILDING_MIN ? 'building' : 'open';
        }
      }
    }
  }

  // ── the lull: the live gap against the record's own heartbeat.
  let gapSinceKillMin: number | null = null;
  let lullMultiple: number | null = null;
  let lullRead: LullRead;
  if (inputs.lastKillAtMs == null || !Number.isFinite(inputs.lastKillAtMs)) {
    lullRead = 'no-storm';
  } else {
    const gapMs = inputs.nowMs - (inputs.lastKillAtMs as number);
    if (gapMs < 0) {
      // clock skew / a stamp ahead of now — no honest gap to read
      lullRead = 'unjudged';
    } else {
      gapSinceKillMin = round1(gapMs / 60000);
      const med = inputs.heartbeatMedianMin;
      if (!finite(med) || (med as number) <= 0) {
        lullRead = 'unjudged';
      } else {
        lullMultiple = round2(gapSinceKillMin / (med as number));
        lullRead = lullMultiple >= CADENCE_STRETCH_RATIO ? 'stretching' : 'in-cadence';
      }
    }
  }

  // ── the read, assembled with its own arithmetic ──
  const parts: Array<string> = [];
  const scope = bootSinceMs != null ? `this boot's window (since the ${new Date(bootSinceMs).toISOString().slice(11, 19)}Z bounce)` : 'the full window';
  if (climbRateMbPerMin == null) {
    if (bootSinceMs != null && judged.length < MIN_RUNWAY_SAMPLES && raw.length >= MIN_RUNWAY_SAMPLES) {
      parts.push(
        `runway scoped to ${scope} — only ${judged.length} of ${MIN_RUNWAY_SAMPLES} judged samples since the boot landed; the pre-bounce samples stay in the living series but do not forecast THIS boot`,
      );
    } else {
      parts.push(
        `runway window too young — ${judged.length} judged samples of ${MIN_RUNWAY_SAMPLES} needed; no climb rate, no eta`,
      );
    }
  } else {
    const fitWord = climbFit === 'tight' ? `R² ${climbR2} (tight)` : `R² ${climbR2} (loose — the fit is noisy, the number stands but do not lean on it)`;
    const scopeTail = bootSinceMs != null ? ` — scoped to ${scope}` : '';
    if (etaMin == null) {
      parts.push(
        headroomMb != null && headroomMb <= 0
          ? `the boot is AT the guard line — the rail owns the next pass${scopeTail}`
          : `climb ${climbRateMbPerMin >= 0 ? '+' : ''}${climbRateMbPerMin} MB/min over a ${windowSpanMin}-min window, ${fitWord} — at or below the ${RUNWAY_MIN_RATE_MB_PER_MIN} MB/min floor the climb reads STALLED, and a stalled climb gets no eta${scopeTail}`,
      );
    } else {
      parts.push(
        `climb ${climbRateMbPerMin >= 0 ? '+' : ''}${climbRateMbPerMin} MB/min (${fitWord}) from ${judged.length} samples / ${windowSpanMin} min — headroom ${headroomMb} MB to the ${guardMb} MB guard puts the line ~${etaMin} min out (${etaWord}${etaBeyondHorizon ? `, beyond the ${RUNWAY_HORIZON_MIN}-min horizon` : ''})${scopeTail}`,
      );
    }
  }
  if (lullRead === 'no-storm') {
    parts.push('no witnessed kill in the record — the lull dial has no storm to measure against');
  } else if (lullRead === 'unjudged') {
    parts.push('the live gap cannot be judged honestly (clock skew or no heartbeat median yet)');
  } else {
    const tone =
      lullRead === 'stretching'
        ? `past ${CADENCE_STRETCH_RATIO}× the heartbeat — STRETCHING, the quiet window the ceiling re-read has been waiting for`
        : 'inside the record\u2019s own cadence';
    parts.push(
      `${gapSinceKillMin} min since the last witnessed kill against a ${inputs.heartbeatMedianMin}-min heartbeat = ${lullMultiple}× — ${tone}`,
    );
  }
  const note = parts.join('; ') + `. Scope: the runway is ${scope === 'the full window' ? 'THIS WINDOW\u2019s projection' : 'THIS BOOT\u2019s projection'}, the lull is THIS RECORD\u2019s heartbeat — neither is a promise.`;

  return {
    samplesOffered: raw.length,
    runwayJudged: judged.length,
    windowSpanMin,
    climbRateMbPerMin,
    climbR2,
    climbFit,
    currentRssMb,
    headroomMb,
    etaMin,
    etaWord,
    etaBeyondHorizon,
    gapSinceKillMin,
    heartbeatMedianMin: finite(inputs.heartbeatMedianMin) ? (inputs.heartbeatMedianMin as number) : null,
    lullMultiple,
    lullRead,
    note,
  };
}
