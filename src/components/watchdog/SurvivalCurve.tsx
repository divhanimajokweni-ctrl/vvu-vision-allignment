'use client';

// src/components/watchdog/SurvivalCurve.tsx — R112 · THE SURVIVAL CURVE,
// Kaplan-Meier on the boot ledger's own tenures; R115 · THE HAZARD LENS
// (the Greenwood 95% band + the per-step hazard).
//
// The boot ledger answered HOW LONG each boot lived. This panel answers
// what the tenures were always reaching for: what are a boot's ODDS of
// holding the port past a given minute? The settled medians and the OLS
// read the deaths but silently exclude the one boot whose end has not
// come. Survival analysis has the honest grammar for exactly this:
//   · the living boot is CENSORED at its current age — in every risk set
//     it has truly survived, out the moment its story ends;
//   · unjournaled served boots are censored at spawn (lost sight of at
//     birth — disclosed, never hidden);
//   · stillborn (never confirmed serving) and the root (no witnessed
//     spawn) are excluded BY NAME.
// The curve drops at every distinct death time by deaths/at-risk; the
// checkpoints (5′ / 30′ / 60′), the KM median, and THE INFANCY WATCH —
// the R111 handover's named priority, the five-minute line calibrated
// into the record's own dead zone (3.23 → 15.7 min) — are the read.
//
// THE READ is the engine's note, verbatim.

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { BootLedgerRead } from '@/lib/boot-ledger';
import { useLaneHome } from '@/hooks/use-lane-home';
import { laneRereadHomeVoice, laneRereadVoice } from '@/lib/watchboard-ledger';
import {
  survivalRead,
  INFANT_TENURE_MIN,
  SURVIVAL_CHECKPOINTS_MIN,
  INFANT_ERA_MIN_HALF,
  SURVIVAL_CI_LEVEL,
  type SurvivalRead,
  type SurvivalStep,
} from '@/lib/survival';

const SAGE = '#c8ff00';
const CYAN = '#00d4e0';
const ROSE = '#e5484d';
const AMBER = '#e0a030';
const GRAY = '#5f6e55';

const W = 560;
const H = 196;
const PAD = { l: 36, r: 12, t: 16, b: 22 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;
// R115 — the hazard lane under the curve: per-step death risk, drawn.
const HAZ_TOP = PAD.t + PLOT_H + 34;
const HAZ_H = 30;

function fmt(v: number | null): string {
  return v == null ? '—' : `${Math.round(v * 10) / 10}`;
}

function pct(v: number | null): string {
  return v == null ? '—' : `${Math.round(v * 1000) / 10}%`;
}

/** A value already stored in percent (no re-scaling). */
function pctVal(v: number | null): string {
  return v == null ? '—' : `${Math.round(v * 10) / 10}%`;
}

function Chip({
  label,
  tone = 'neutral',
  title,
}: {
  label: string;
  tone?: 'neutral' | 'sage' | 'cyan' | 'rose' | 'amber';
  title?: string;
}) {
  const toneCls =
    tone === 'sage'
      ? 'border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10'
      : tone === 'cyan'
        ? 'border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10'
        : tone === 'rose'
          ? 'border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10'
          : tone === 'amber'
            ? 'border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10'
            : 'border-[#3a4530] text-[#c9d4bd] bg-black/30';
  return (
    <span className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${toneCls} tabular-nums`} title={title}>
      {label}
    </span>
  );
}

/** S(t) for the censor tick: survival just after the last step ≤ t. */
function sAt(read: SurvivalRead, t: number): number {
  let v = 1;
  for (const st of read.steps) {
    if (st.tMin <= t) v = st.s;
    else break;
  }
  return v;
}

function Curve({ read }: { read: SurvivalRead }) {
  const tenures = [
    ...read.steps.map((st) => st.tMin),
    ...(read.livingAgeMin != null ? [read.livingAgeMin] : []),
  ];
  const xMax = Math.max(60, ...tenures.map((t) => Math.ceil(t)));
  const x = (t: number) => PAD.l + (t / xMax) * PLOT_W;
  const y = (s: number) => PAD.t + (1 - s) * PLOT_H;

  // the step path: hold at each level, drop at each death time
  let d = `M ${x(0)} ${y(1)}`;
  let prev = 1;
  for (const st of read.steps) {
    d += ` L ${x(st.tMin)} ${y(prev)} L ${x(st.tMin)} ${y(st.s)}`;
    prev = st.s;
  }
  d += ` L ${x(xMax)} ${y(prev)}`;

  // R115 — the Greenwood 95% band as a step-shaped ribbon: it holds each
  // step's level between death times, and ENDS where the band breaks (a
  // sum with a zero denominator has no honest value past it).
  const banded: SurvivalStep[] = [];
  for (const st of read.steps) {
    if (st.ciLo === null || st.ciHi === null) break;
    banded.push(st);
  }
  let hiPath = '';
  let loPath = '';
  if (banded.length > 0) {
    let hiPrev = 1;
    let loPrev = 1;
    hiPath = `M ${x(0)} ${y(hiPrev)}`;
    loPath = `M ${x(0)} ${y(loPrev)}`;
    for (const st of banded) {
      hiPath += ` L ${x(st.tMin)} ${y(hiPrev)} L ${x(st.tMin)} ${y(st.ciHi!)}`;
      loPath += ` L ${x(st.tMin)} ${y(loPrev)} L ${x(st.tMin)} ${y(st.ciLo!)}`;
      hiPrev = st.ciHi!;
      loPrev = st.ciLo!;
    }
    const bandEndT = read.bandBrokenAtMin ?? xMax;
    hiPath += ` L ${x(Math.min(bandEndT, xMax))} ${y(hiPrev)}`;
    loPath += ` L ${x(Math.min(bandEndT, xMax))} ${y(loPrev)}`;
  }
  const ribbon = banded.length > 0 ? `${hiPath} L ${loPath.replace('M', 'L').split('L').slice(1).reverse().join('L').trim()} Z` : '';

  const median = read.medianSurvivalMin;
  const livingAge = read.livingAgeMin;
  const infantSteps = read.steps.filter((st) => st.tMin < INFANT_TENURE_MIN);
  const maxHazard = Math.max(0.000001, ...read.steps.map((st) => st.hazard));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto [&_rect]:cursor-help [&_circle]:cursor-help [&_line]:cursor-help [&_path]:cursor-help"
      role="img"
      aria-label={`Kaplan-Meier survival curve with the ${SURVIVAL_CI_LEVEL}% Greenwood band: ${pct(read.sAtInfancy)} survive the five-minute line (band ${pct(read.checkpoints.find((c) => c.tMin === INFANT_TENURE_MIN)?.ciLo ?? null)}–${pct(read.checkpoints.find((c) => c.tMin === INFANT_TENURE_MIN)?.ciHi ?? null)}), median survival ${median != null ? `${fmt(median)} min` : 'beyond the record'}, ${read.infantDeaths} infant deaths before ${INFANT_TENURE_MIN} min, per-step hazard in the lane below`}
      data-testid="survival-svg"
    >
      {/* the infancy zone — the record's first five minutes */}
      <rect
        x={x(0)}
        y={PAD.t}
        width={x(INFANT_TENURE_MIN) - x(0)}
        height={PLOT_H}
        fill={ROSE}
        opacity={0.07}
      />
      <text x={x(0) + 2} y={PAD.t - 5} fontSize={6} fill={ROSE} className="vvu-label" opacity={0.9}>
        INFANCY &lt;{INFANT_TENURE_MIN}′
      </text>

      {/* horizontal gridlines + percent labels */}
      {[0, 25, 50, 75, 100].map((p) => {
        const s = p / 100;
        return (
          <g key={p}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(s)}
              y2={y(s)}
              stroke={p === 50 ? SAGE : '#3a4530'}
              strokeOpacity={p === 50 ? 0.45 : 0.35}
              strokeDasharray={p === 50 ? '3 3' : '1 3'}
              strokeWidth={0.75}
            />
            <text x={PAD.l - 4} y={y(s) + 2} fontSize={6} fill={GRAY} textAnchor="end" className="vvu-label">
              {p}%
            </text>
          </g>
        );
      })}

      {/* the checkpoint guides — 5′ / 30′ / 60′, each carrying its band */}
      {SURVIVAL_CHECKPOINTS_MIN.map((t) => {
        const cp = read.checkpoints.find((c) => c.tMin === t);
        const bandedCp = cp?.ciLo != null && cp?.ciHi != null;
        return (
          <g key={t}>
            <line
              x1={x(t)}
              x2={x(t)}
              y1={PAD.t}
              y2={PAD.t + PLOT_H}
              stroke={CYAN}
              strokeOpacity={0.4}
              strokeDasharray="2 3"
              strokeWidth={0.75}
            >
              <title>{`checkpoint ${t} min — S(t) ${pct(cp?.s ?? null)}${bandedCp ? ` · ${SURVIVAL_CI_LEVEL}% Greenwood band ${pct(cp!.ciLo)}–${pct(cp!.ciHi)}` : cp?.s != null ? ' · band [1,1] (no death yet)' : ''}`}</title>
            </line>
            <text x={x(t)} y={PAD.t + PLOT_H + 12} fontSize={6} fill={CYAN} textAnchor="middle" className="vvu-label">
              {t}′ {pct(cp?.s ?? null)}
            </text>
          </g>
        );
      })}
      <text x={x(xMax)} y={PAD.t + PLOT_H + 12} fontSize={6} fill={GRAY} textAnchor="end" className="vvu-label">
        min on the port →
      </text>

      {/* the KM median marker */}
      {median != null && (
        <g>
          <line
            x1={x(median)}
            x2={x(median)}
            y1={y(0.5)}
            y2={PAD.t + PLOT_H}
            stroke={AMBER}
            strokeOpacity={0.8}
            strokeWidth={1}
          />
          <circle cx={x(median)} cy={y(0.5)} r={2} fill={AMBER} />
          <text x={x(median)} y={y(0.5) - 4} fontSize={6} fill={AMBER} textAnchor="middle" className="vvu-label">
            KM MEDIAN {fmt(median)}′
          </text>
        </g>
      )}

      {/* R115 — the Greenwood 95% band: under the curve, rose at low
          opacity; it ends where the variance walks off the record */}
      {ribbon && <path d={ribbon} fill={ROSE} opacity={0.13} stroke="none" />}
      {banded.length > 0 && read.bandBrokenAtMin != null && (
        <g>
          <line
            x1={x(read.bandBrokenAtMin)}
            x2={x(read.bandBrokenAtMin)}
            y1={y(0)}
            y2={y(1)}
            stroke={AMBER}
            strokeOpacity={0.5}
            strokeDasharray="2 2"
            strokeWidth={0.75}
          >
            <title>{`THE BAND WALKS OFF at ${fmt(read.bandBrokenAtMin)} min — every boot at risk died there (h = 1), and a sum with a zero denominator has no honest value past it. The curve reads on; the uncertainty does not.`}</title>
          </line>
        </g>
      )}

      {/* the curve */}
      <path d={d} fill="none" stroke={SAGE} strokeWidth={1.5} strokeLinejoin="miter" />

      {/* infant deaths — rose dots on the drops inside the zone */}
      {infantSteps.map((st) => (
        <circle key={`inf-${st.tMin}`} cx={x(st.tMin)} cy={y(st.s)} r={1.8} fill={ROSE}>
          <title>{`INFANT DEATH at ${fmt(st.tMin)} min — survival drops to ${pct(st.s)} (${st.atRisk} at risk, ${st.deathsAt} died)`}</title>
        </circle>
      ))}

      {/* the living boot's censor tick — it leaves the risk set here */}
      {livingAge != null && (
        <g>
          <line
            x1={x(livingAge)}
            x2={x(livingAge)}
            y1={y(sAt(read, livingAge)) - 4}
            y2={y(sAt(read, livingAge)) + 4}
            stroke={SAGE}
            strokeWidth={1.2}
            className="animate-pulse"
          />
          <circle cx={x(livingAge)} cy={y(sAt(read, livingAge))} r={2.2} fill="none" stroke={SAGE} strokeWidth={1} className="animate-pulse">
            <title>{`THE LIVING BOOT censored at ${fmt(livingAge)} min — in every risk set it has truly survived, out the moment its story ends. Censored, not excluded: censoring is how the curve stays honest about a life it has not finished watching.`}</title>
          </circle>
        </g>
      )}

      {/* per-step hit bands — full-precision arithmetic in every tooltip */}
      {read.steps.map((st, i) => {
        const prevT = i === 0 ? 0 : read.steps[i - 1]!.tMin;
        const w = Math.max(2, x(st.tMin) - x(prevT));
        return (
          <rect
            key={`hit-${st.tMin}-${i}`}
            x={x(prevT)}
            y={PAD.t}
            width={w}
            height={PLOT_H}
            fill="transparent"
            className="cursor-crosshair"
          >
            <title>{`at ${fmt(st.tMin)} min: survival ${pct(st.s)} · ${st.atRisk} at risk · ${st.deathsAt} died here (KM step ×(1 − ${st.deathsAt}/${st.atRisk})) · hazard h = ${st.deathsAt}/${st.atRisk} = ${pctVal(st.hazard * 100)}${st.ciLo != null && st.ciHi != null ? ` · ${SURVIVAL_CI_LEVEL}% band ${pct(st.ciLo)}–${pct(st.ciHi)}` : ' · BAND BROKEN (no honest variance)'}`}</title>
          </rect>
        );
      })}

      {/* R115 — THE HAZARD LANE: per-step h = deaths ÷ at-risk, rose bars;
          the walk-off step reads amber (certainty with no uncertainty) */}
      <g>
        <text x={PAD.l - 4} y={HAZ_TOP + 3} fontSize={5.5} fill={ROSE} textAnchor="end" className="vvu-label" opacity={0.85}>
          h
        </text>
        <line x1={PAD.l} x2={W - PAD.r} y1={HAZ_TOP + HAZ_H} y2={HAZ_TOP + HAZ_H} stroke="#3a4530" strokeWidth={0.75} />
        {read.steps.map((st, i) => {
          const prevT = i === 0 ? 0 : read.steps[i - 1]!.tMin;
          const bw = Math.max(1.2, Math.min(4, (x(st.tMin) - x(prevT)) * 0.55));
          const bh = Math.max(1, (st.hazard / maxHazard) * HAZ_H);
          const broken = st.ciLo === null;
          return (
            <rect
              key={`haz-${st.tMin}-${i}`}
              x={x(st.tMin) - bw / 2}
              y={HAZ_TOP + HAZ_H - bh}
              width={bw}
              height={bh}
              fill={broken ? AMBER : ROSE}
              opacity={broken ? 0.95 : 0.55}
            >
              <title>{`HAZARD at ${fmt(st.tMin)} min: h = ${st.deathsAt}/${st.atRisk} = ${pctVal(st.hazard * 100)} of the boots still at risk died here${broken ? ' · THE BAND WALKS OFF — every boot at risk died' : ''}`}</title>
            </rect>
          );
        })}
        <text x={W - PAD.r} y={HAZ_TOP - 2} fontSize={5.5} fill={GRAY} textAnchor="end" className="vvu-label">
          HAZARD · h = deaths ÷ at risk · max {pctVal(maxHazard * 100)}
        </text>
      </g>
    </svg>
  );
}

export function SurvivalCurve() {
  const [read, setRead] = useState<SurvivalRead | null>(null);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // R183 · THE LANES' RETURN: the asked read's home-flash state — the
  // R181 idiom, lane-sized (one hook, five lanes). The mount and the
  // 60s self-read never announce; a failed read never reaches the
  // announcement — the completion belongs to the click.
  const { justRead, homeAt, announceHome } = useLaneHome();

  const refetch = useCallback(
    async (announce?: boolean) => {
      setBusy(true);
      try {
        const res = await fetch('/api/estate/boot-ledger', { cache: 'no-store' });
        const body = await res.json();
        if (res.ok && body?.ok) {
          const ledger = body.ledger as BootLedgerRead;
          setRead(survivalRead(ledger.boots, ledger.root?.pid ?? null));
          setLedgerError(null);
          if (announce) announceHome();
        } else {
          setLedgerError(String(body?.error ?? `HTTP ${res.status}`));
        }
      } catch (e) {
        setLedgerError(e instanceof Error ? e.message : 'boot ledger fetch failed');
      } finally {
        setBusy(false);
      }
    },
    [announceHome],
  );

  useEffect(() => {
    void refetch();
    const t = setInterval(() => void refetch(), 60_000);
    return () => clearInterval(t);
  }, [refetch]);

  const eraTone = useMemo(() => {
    if (!read) return 'neutral' as const;
    return read.infantEra === 'DEEPENING'
      ? ('rose' as const)
      : read.infantEra === 'EASING'
        ? ('sage' as const)
        : ('neutral' as const);
  }, [read]);

  if (!read && !ledgerError) return null;

  return (
    <div className="mt-1.5 rounded-sm border border-[#3a4530]/60 bg-black/20 p-2 transition-colors duration-200 hover:border-[#4a5a3e]" data-testid="survival-curve">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p
          className="vvu-label text-[7.5px] font-bold tracking-[0.18em] text-[#7a8a6e]"
          title={`Kaplan-Meier survival on the boot ledger's own tenures — the record's mortality read as ODDS. The living boot is censored at its current age (in every risk set it has truly survived, out the moment its story ends); unjournaled served boots are censored at spawn (lost sight of at birth); stillborn (never confirmed serving) and the root (no witnessed spawn) are excluded by name. THE INFANCY WATCH is the R111 handover's named priority: deaths before the ${INFANT_TENURE_MIN}-minute line, calibrated into the record's own dead zone (3.23 → 15.7 min — nine deaths below, zero inside). One ledger walk, many readers — this panel re-derives nothing the journal already says.`}
        >
          THE SURVIVAL CURVE · ODDS OF HOLDING THE PORT
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {read && (
            <>
              <Chip
                label={`${read.population} WALKED`}
                title={`${read.population} served boots with a witnessed spawn: ${read.deaths} deaths + ${read.censored} censored (${read.censoredLiving} living at ${fmt(read.livingAgeMin)} min, ${read.censoredUnjournaled} unjournaled-censored-at-spawn) · ${read.excludedStillborn} stillborn excluded (never confirmed serving)${read.rootPid != null ? ` · root pid ${read.rootPid} excluded (no witnessed spawn)` : ''}`}
              />
              <Chip
                tone="cyan"
                label={`SURVIVE ${INFANT_TENURE_MIN}′ ${pct(read.sAtInfancy)}`}
                title={`KM survival at the five-minute line: ${pct(read.sAtInfancy)} — the odds a boot that takes the port is still holding it ${INFANT_TENURE_MIN} minutes later. Checkpoints: ${read.checkpoints.map((c) => `${c.tMin}′ ${pct(c.s)}${c.ciLo != null && c.ciHi != null ? ` [${pct(c.ciLo)}–${pct(c.ciHi)}]` : ''}`).join(' · ')}`}
              />
              {read.widestBand != null && (
                <Chip
                  tone={read.widestBand.halfWidthPct >= 25 ? 'amber' : 'cyan'}
                  label={`${SURVIVAL_CI_LEVEL}% BAND ±${fmt(read.widestBand.halfWidthPct)} PTS @ ${fmt(read.widestBand.tMin)}′`}
                  title={`THE HAZARD LENS, layer two: the Greenwood 95% band (SE = √(S²·Σ d/(n(n−d))), z = 1.959963984540054, clamped to [0,1]). Widest at ${fmt(read.widestBand.tMin)} min — ±${fmt(read.widestBand.halfWidthPct)} points — the record's least certain moment (it lands near the 50% crossing, where the risk set is thinning).${read.bandBrokenAtMin != null ? ` The band WALKS OFF at ${fmt(read.bandBrokenAtMin)} min: every boot at risk died there (h = 1), and a sum with a zero denominator has no honest value past it.` : ''}`}
                />
              )}
              <Chip
                tone={read.medianSurvivalMin != null ? 'sage' : 'neutral'}
                label={read.medianSurvivalMin != null ? `KM MEDIAN ${fmt(read.medianSurvivalMin)} MIN` : 'KM MEDIAN BEYOND RECORD'}
                title={
                  read.medianSurvivalMin != null
                    ? `the smallest death time whose cumulative survival ≤ 50%: ${fmt(read.medianSurvivalMin)} min. Where the settled medians read the deaths only, the KM median carries the censored life too — when the two instruments agree, the censoring is not bending the story`
                    : 'the curve never fell to 50% inside the record\'s observation — the median is honestly beyond the record, not missing'
                }
              />
              <Chip
                tone="rose"
                label={`INFANTS ${read.infantDeaths} · ${pctVal(read.infantSharePct)}`}
                title={`THE INFANCY WATCH: ${read.infantDeaths} of ${read.population} walked lives ended inside ${INFANT_TENURE_MIN} min (${pctVal(read.infantSharePct)} of the population). The line is calibrated, not guessed: the record's settled tenures show a dead zone from 3.23 to 15.7 min — nine deaths below it, zero inside it — so any line in that silence counts the same nine. Descriptive counts; the watch names, it never calls a killer`}
              />
              <Chip
                tone={eraTone}
                label={`INFANT ERA ${read.infantEra}`}
                title={
                  read.infantEra === 'TOO FEW'
                    ? `the era split needs ${INFANT_ERA_MIN_HALF} settled boots per half (pair-sheet convention, floor(n/2)) — it refuses until then`
                    : `infant deaths by era: ${read.infantEraFirstHalf}/${read.infantEraFirstHalfN} in the record's early half → ${read.infantEraLastHalf}/${read.infantEraLastHalfN} in the late half — ${read.infantEra}. A split of counts, not a significance test; the word is descriptive and the arithmetic is the evidence`
                }
              />
            </>
          )}
          <button
            type="button"
            onClick={() => void refetch(true)}
            disabled={busy}
            aria-busy={busy}
            aria-label={laneRereadVoice('the journal and the curve', busy)}
            className={`vvu-label text-[7px] font-bold px-1.5 py-px rounded-sm border bg-black/30 transition-colors duration-150 disabled:opacity-50 outline-none ${justRead && !busy ? 'border-[#c8ff00]/60 text-[#c8ff00] shadow-[0_0_6px_rgba(200,255,0,0.3)]' : busy ? 'border-[#e0a030]/60 text-[#e0a030]' : 'border-[#3a4530] text-[#c9d4bd] hover:border-[#6b8a40]/60 hover:text-[#c8ff00] focus-visible:border-[#c8ff00]'}`}
            title="re-walk the journal and re-fit the curve now — also re-read every 60s. R182 · THE LANES' VOICES: the button's state rides its aria — the offer and the in-flight read, heard without hovering; the read in flight wears the amber. R183 · THE LANES' RETURN: a clicked read that lands speaks its home line once — the lane's own arrival stamp in the house's UTC voice — and wears the lime for 2.6s; the unasked passes (mount, the 60s self-read) and a failed read stay silent — the completion belongs to the click."
          >
            {busy ? 'READING…' : 'REREAD'}
          </button>
          <span aria-live="polite" className="sr-only">
            {justRead && !busy && homeAt ? laneRereadHomeVoice('the journal and the curve', String(homeAt)) : ''}
          </span>
        </div>
      </div>

      {ledgerError && (
        <p className="vvu-label mt-1.5 text-[7px] text-[#e5484d]" data-testid="survival-error">
          THE LEDGER IS UNREADABLE · {ledgerError} — the curve refuses to draw from nothing
        </p>
      )}

      {read && (
        <>
          <div className="mt-2" data-testid="survival-strip">
            {read.population > 0 ? (
              <Curve read={read} />
            ) : (
              <p className="vvu-label text-[7px] text-[#5f6e55] py-3 text-center" data-testid="survival-empty">
                NO SERVED BOOT HAS A WITNESSED SPAWN YET — THE CURVE WAITS FOR A POPULATION. IT DOES NOT DRAW FROM NOTHING.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1" aria-hidden>
              <span className="vvu-label text-[6.5px] text-[#c8ff00]">
                <span className="inline-block w-3 h-px bg-[#c8ff00] mr-1 align-middle" />
                KM survival
              </span>
              <span className="vvu-label text-[6.5px] text-[#e5484d]">
                <span className="inline-block w-3 h-1.5 bg-[#e5484d]/25 mr-1 align-middle" />
                95% Greenwood band
              </span>
              <span className="vvu-label text-[6.5px] text-[#e5484d]">
                <span className="inline-block w-1.5 h-2.5 bg-[#e5484d]/60 mr-1 align-middle" />
                hazard h (deaths ÷ at risk)
              </span>
              <span className="vvu-label text-[6.5px] text-[#e0a030]">
                <span className="inline-block w-1.5 h-2.5 bg-[#e0a030] mr-1 align-middle" />
                band walk-off (h = 1)
              </span>
              <span className="vvu-label text-[6.5px] text-[#e5484d]">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#e5484d] mr-1 align-middle" />
                infant death (&lt;{INFANT_TENURE_MIN}′)
              </span>
              <span className="vvu-label text-[6.5px] text-[#c8ff00]">
                <span className="inline-block w-1.5 h-1.5 rounded-full border border-[#c8ff00] mr-1 align-middle" />
                living (censored)
              </span>
              <span className="vvu-label text-[6.5px] text-[#e0a030]">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#e0a030] mr-1 align-middle" />
                KM median
              </span>
              <span className="vvu-label text-[6.5px] text-[#00d4e0]">
                <span className="inline-block w-px h-2 border-l border-dashed border-[#00d4e0] mr-1 align-middle" />
                checkpoints
              </span>
              <span className="vvu-label text-[6.5px] text-[#5f6e55] ml-auto">
                each drop = a death time · drop size = deaths ÷ still at risk
              </span>
            </div>
          </div>
          <p className="vvu-label mt-1.5 text-[7px] leading-relaxed text-[#c9d4bd]" data-testid="survival-read">
            THE READ · {read.note}
          </p>
        </>
      )}
    </div>
  );
}
