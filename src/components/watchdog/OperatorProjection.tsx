'use client';

// src/components/watchdog/OperatorProjection.tsx — R96 · THE OPERATOR
// PROJECTION, ON THE SURFACE WHERE THE DECISION LIVES.
//
// The R93 OperatorBrief put the calibration menu on the evidence surface and
// left the decision PENDING · OPERATOR. The R94/R95 handovers both asked for
// the same next thing: the COMPUTED projection — what the operator's
// guard-2200 proposal would actually buy, from the journal's own numbers.
// This panel is that answer, served from /api/guardian's railProjection
// (the r96-tested engine; one dataset with the ledger, zero drift):
//
//   DISPOSITIONS — each witnessed kernel kill (a port row carrying an R94
//   memWitness) with its in-window peak rss / deepest avail, and the
//   verdict of the CURRENTLY ARMED rails against it (both storm kills were
//   invisible to every current line — the rails cleaned up, nothing more).
//
//   SCENARIOS — a grid of proposed guard / floor levels: CATCHES (with the
//   margin the controlled landing would have had), BLIND (never crossed
//   inside the witnessed window — no guessing beyond it), WOULD LOOP (fires
//   on the warm state: at/below the R69 plateau for guards, at/above the
//   live minimum avail for floors — unlandable as armed, quoted before any
//   catch count).
//
//   THE PROJECTIONS — kills/day and saves/day re-read with the caught kills
//   reclassified as controlled landings, and the downtime/day delta. The
//   honest headline: the downtime win is MODEST (a kernel kill costs ~26.6s,
//   a controlled landing ~15.5s) — the projection's real currency is
//   CONTROL: a scheduled landing instead of a mid-compile SIGKILL.
//
// It decides NOTHING (the brief's contract is inherited). Every absence
// renders as a dash (the R75 contract); the witness window's scope is
// disclosed on the surface, because a "~4 minutes before death" sample is
// the whole truth this panel is allowed to know.

import { useState } from 'react';
import { GitCompareArrows, Info } from 'lucide-react';
import type { RailProjectionPayload, RailScenario } from '@/lib/operator-projection';
import { ceilingDistribution, guardVsCeilings } from '@/lib/witness-windows';
import { warmCurveRead } from '@/lib/warm-curve';
import { StormHistory } from './StormHistory';
import { StormEras } from './StormEras';
import { KillPace } from './KillPace';
import { BoxFloor } from './BoxFloor';

interface OperatorProjectionProps {
  projection?: RailProjectionPayload | null;
  /** R102 — the guardian's live ring-buffer series, so the try line can
   *  read the living boot's distance to a rehearsed level. Optional: the
   *  try line degrades to the record-only read without it. */
  series?: Array<{ t: string; rssKb: number | null; availKb: number | null }> | null;
  /** R102 — the rehearsal lives in the WORKSPACE, not here: the projection
   *  unmounts when a poll cycle reports present:false, and a rehearsal that
   *  dies with a refetch is a rehearsal the operator cannot trust. */
  tryGuardMb?: number | null;
  onTryGuardMb?: (mb: number | null) => void;
}

function fmtMargin(m: number | null): string {
  return m != null ? `${m.toFixed(1)}M` : '—';
}

const VERDICT_TONE: Record<RailScenario['verdict'], { text: string; cls: string }> = {
  CATCHES: { text: 'CATCHES', cls: 'text-[#c8ff00] border-[#6b8a40]/60 bg-[#6b8a40]/10' },
  BLIND: { text: 'BLIND', cls: 'text-[#e5484d] border-[#e5484d]/50 bg-[#e5484d]/10' },
  'WOULD LOOP': { text: 'WOULD LOOP', cls: 'text-[#e0a030] border-[#e0a030]/50 bg-[#e0a030]/10' },
};

// R98 — the witness window's shape word, toned to its meaning: a sawtooth
// (crossings inside an oscillation) reads amber, a climbing runaway reads
// rose, a kill during returning memory reads cyan, an untestifiable window
// reads dim. Every absence keeps its own word — never dressed as another.
const WITNESS_SHAPE_CHIP: Record<string, { label: string; cls: string }> = {
  sawtooth: { label: 'SAWTOOTH', cls: 'border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10' },
  climbing: { label: 'CLIMBING', cls: 'border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10' },
  falling: { label: 'FALLING', cls: 'border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10' },
  flat: { label: 'FLAT', cls: 'border-[#3a4530] text-[#7a8a6e] bg-black/30' },
  single: { label: '1 SAMPLE', cls: 'border-[#3a4530] text-[#5f6e55] bg-black/30' },
  unjudged: { label: 'UNJUDGED', cls: 'border-[#3a4530] text-[#5f6e55] bg-black/30' },
};

/** The sparkline path for one series — finite samples only, split into
 *  sub-paths at null gaps (the death blot renders as the line simply
 *  ending, which is what happened: the pass never returned). x spreads the
 *  SAMPLE INDEX evenly (20s cadence), y scales to the series' own range
 *  with breathing room — the shape is the message, not the absolute level
 *  (the dispositions' numbers carry the levels). */
function sparkPath(values: Array<number | null>, width: number, height: number, padY: number): string {
  const finite = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (finite.length < 2) return '';
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  const span = hi - lo || 1;
  const stepX = width / (values.length - 1);
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      pen = false;
      return;
    }
    const x = (i * stepX).toFixed(1);
    const y = (padY + (1 - (v - lo) / span) * (height - 2 * padY)).toFixed(1);
    d += `${pen ? 'L' : 'M'}${x} ${y} `;
    pen = true;
  });
  return d.trim();
}

function WitnessSpark({ k }: { k: RailProjectionPayload['witnessed'][number] }) {
  const W = 240;
  const H = 52;
  const PAD = 5;
  const rss = k.witness.map((s) => (typeof s.rssKb === 'number' && Number.isFinite(s.rssKb) ? s.rssKb / 1024 : null));
  const avail = k.witness.map((s) => (typeof s.availKb === 'number' && Number.isFinite(s.availKb) ? s.availKb / 1024 : null));
  const rssD = sparkPath(rss, W, H, PAD);
  const availD = sparkPath(avail, W, H, PAD);
  // the peak marker: the largest finite rss sample
  let peakIdx = -1;
  let peakV = -Infinity;
  rss.forEach((v, i) => {
    if (v != null && v > peakV) {
      peakV = v;
      peakIdx = i;
    }
  });
  const peakXY =
    peakIdx >= 0 && rssD
      ? (() => {
          const finite = rss.filter((v): v is number => v != null);
          if (finite.length < 2) return null;
          const lo = Math.min(...finite);
          const hi = Math.max(...finite);
          const span = hi - lo || 1;
          const stepX = W / (rss.length - 1);
          return { x: peakIdx * stepX, y: PAD + (1 - (peakV - lo) / span) * (H - 2 * PAD) };
        })()
      : null;
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="shrink-0"
      role="img"
      aria-label={`witness window sparkline for kill at ${k.at}`}
    >
      {/* hairline frame */}
      <line x1={0} y1={H - 1} x2={W} y2={H - 1} stroke="#3a4530" strokeWidth={1} />
      {availD && <path d={availD} fill="none" stroke="#00d4e0" strokeWidth={1} opacity={0.55} strokeDasharray="2 2" />}
      {rssD && <path d={rssD} fill="none" stroke="#e5484d" strokeWidth={1.5} />}
      {peakXY && <circle cx={peakXY.x} cy={peakXY.y} r={2} fill="#e0a030" />}
      {/* the kill edge — the window's right boundary, where the pass blotted */}
      <line x1={W - 1} y1={2} x2={W - 1} y2={H - 2} stroke="#e5484d" strokeWidth={1.5} opacity={0.7} />
    </svg>
  );
}

// R100 — THE CEILING STRIP: the witness windows answered WHAT the deaths
// looked like (sawtooth — crossings inside an oscillation); this strip
// answers WHERE. Each witnessed kill's in-window peak rss is plotted on the
// guard menu's own scale, the cluster band shaded, each level toned by how
// it reads against the cluster (catch-all lime / in-cluster amber / blind
// dim-rose), the armed guard drawn solid. The loop question is NOT re-derived
// here — that stays the scenarios grid's job; this strip is the crossing
// line's own geography. Text lives in HTML (legend + read line), never in
// the SVG, so the 390px downscale cannot shrink it below readability.
const CEILING_SHAPE_FILL: Record<string, string> = {
  sawtooth: '#e0a030',
  climbing: '#e5484d',
  falling: '#00d4e0',
  flat: '#7a8a6e',
  single: '#5f6e55',
  unjudged: '#5f6e55',
};

function guardChipCls(pos: 'catch-all' | 'in-cluster' | 'blind'): string {
  if (pos === 'catch-all') return 'border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10';
  if (pos === 'in-cluster') return 'border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10';
  return 'border-[#e5484d]/40 text-[#e5484d]/80 bg-[#e5484d]/5';
}

function CeilingStrip({ projection, tryGuardMb }: { projection: RailProjectionPayload; tryGuardMb: number | null }) {
  const { witnessed, witnessWindows, scenarios, meta } = projection;
  const guardLevels = scenarios
    .filter((s) => s.kind === 'guard')
    .map((s) => s.levelMb)
    .sort((a, b) => a - b);
  const c = ceilingDistribution(witnessed, witnessWindows, guardLevels, meta.guardMb);
  if (c.judged === 0) return null;

  const W = 520;
  const H = 64;
  const pad = 12;
  const armed = meta.guardMb;
  const levelsForFrame = [...guardLevels, ...(armed != null ? [armed] : [])];
  const lo =
    Math.floor((Math.min(c.minCeilingMb ?? 0, ...levelsForFrame) - 40) / 50) * 50;
  const hi =
    Math.ceil((Math.max(c.maxCeilingMb ?? 0, ...levelsForFrame) + 40) / 50) * 50;
  const span = hi - lo || 1;
  const x = (v: number) => pad + ((v - lo) / span) * (W - 2 * pad);

  const bandLo = x(c.minCeilingMb ?? lo);
  const bandHi = x(c.maxCeilingMb ?? hi);
  const medX = c.medianCeilingMb != null ? x(c.medianCeilingMb) : null;

  const armedPos =
    armed == null
      ? null
      : c.armedGuardRead ??
        (armed <= (c.minCeilingMb ?? Number.POSITIVE_INFINITY)
          ? 'catch-all'
          : armed < (c.maxCeilingMb ?? Number.NEGATIVE_INFINITY)
            ? 'in-cluster'
            : 'blind');

  const hhmm = (ms: number | null) => (ms != null ? new Date(ms).toISOString().slice(11, 19) : '—');
  const laneY = (i: number) => 22 + (i % 3) * 9;

  return (
    <div className="mt-1.5 space-y-1" data-testid="ceiling-strip">
      <p
        className="vvu-label text-[7.5px] font-bold tracking-[0.18em] text-[#7a8a6e]"
        title={`each witnessed kill's in-window peak rss (the oscillation's top when the kernel struck) plotted on the guard menu's own MB scale. The shaded band is the ceiling cluster (min→max); the amber centerline is the median; level lines are toned by how they read against the cluster: lime = below every ceiling (crosses ALL witnessed kills), amber = inside the band (crosses SOME), dim rose = above every ceiling (never crossed in-window — the grid's BLIND). The armed guard draws solid rose. The loop check is NOT re-derived here — the scenarios grid owns it; this strip is where the crossings happen.`}
      >
        THE CEILING · WHERE THE CROSSINGS HAPPEN
      </p>

      {(() => {
        const lines: Array<{ v: number; cls: string; op: number; dashed: boolean; label: string }> = [];
        for (const g of guardLevels) {
          const pos: 'catch-all' | 'in-cluster' | 'blind' =
            g <= (c.minCeilingMb ?? Number.POSITIVE_INFINITY)
              ? 'catch-all'
              : g < (c.maxCeilingMb ?? Number.NEGATIVE_INFINITY)
                ? 'in-cluster'
                : 'blind';
          lines.push({
            v: g,
            cls: pos === 'catch-all' ? '#7ae04a' : pos === 'in-cluster' ? '#e0a030' : '#e5484d',
            op: pos === 'blind' ? 0.3 : 0.55,
            dashed: true,
            label: `GUARD ${g} · ${pos.toUpperCase()}`,
          });
        }
        if (armed != null && armedPos != null) {
          lines.push({ v: armed, cls: '#e5484d', op: 0.85, dashed: false, label: `ARMED ${armed}` });
        }
        // R102 — the try line: the rehearsed level, dashed cyan, honest
        if (tryGuardMb != null) {
          lines.push({ v: tryGuardMb, cls: '#00d4e0', op: 0.9, dashed: true, label: `TRY ${tryGuardMb} — rehearsed, arms nothing` });
        }
        return (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full"
            role="img"
            aria-label={`ceiling distribution: ${c.judged} witnessed kills span ${c.minCeilingMb} to ${c.maxCeilingMb} MB`}
          >
            {/* the cluster band */}
            <rect
              x={bandLo}
              y={12}
              width={Math.max(1, bandHi - bandLo)}
              height={40}
              fill="#e0a030"
              opacity={0.08}
            />
            {/* level lines */}
            {lines.map((l) => (
              <g key={`${l.label}`}>
                <line
                  x1={x(l.v)}
                  y1={8}
                  x2={x(l.v)}
                  y2={56}
                  stroke={l.cls}
                  strokeWidth={l.dashed ? 1 : 1.5}
                  opacity={l.op}
                  strokeDasharray={l.dashed ? '3 3' : undefined}
                />
                <title>{l.label}</title>
              </g>
            ))}
            {/* the median centerline */}
            {medX != null && (
              <line x1={medX} y1={12} x2={medX} y2={52} stroke="#e0a030" strokeWidth={1} opacity={0.5} />
            )}
            {/* the kill diamonds — three lanes so same-height ceilings separate */}
            {c.reads.map((r, i) => {
              if (r.ceilingMb == null) return null; // honest absence — no ceiling, no marker
              const fill = CEILING_SHAPE_FILL[r.shapeKind ?? 'unjudged'] ?? '#5f6e55';
              const cx = x(r.ceilingMb);
              const cy = laneY(i);
              return (
                <g key={`ceil-${r.at}`} className="cursor-help">
                  <path
                    d={`M ${cx} ${cy - 3.4} L ${cx + 3.4} ${cy} L ${cx} ${cy + 3.4} L ${cx - 3.4} ${cy} Z`}
                    fill={fill}
                    stroke="black"
                    strokeWidth={0.5}
                  />
                  <title>
                    {`KILL ${hhmm(r.atMs)} UTC — ceiling ${r.ceilingMb} MB · ${r.shapeKind?.toUpperCase() ?? 'NO SHAPE'} · crossed ${(r.crossedGuardsMb ?? []).join('/') || 'none'} · nearest catch ${r.nearestCatchMb != null ? `${r.nearestCatchMb} (+${r.catchHeadroomMb} MB headroom)` : '—'}`}
                  </title>
                </g>
              );
            })}
          </svg>
        );
      })()}

      {/* the legend — HTML chips, 390px-safe */}
      <div className="flex flex-wrap items-center gap-1">
        {guardLevels.map((g) => {
          const pos: 'catch-all' | 'in-cluster' | 'blind' =
            g <= (c.minCeilingMb ?? Number.POSITIVE_INFINITY)
              ? 'catch-all'
              : g < (c.maxCeilingMb ?? Number.NEGATIVE_INFINITY)
                ? 'in-cluster'
                : 'blind';
          return (
            <span
              key={`g-leg-${g}`}
              className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${guardChipCls(pos)}`}
              title={`guard ${g} MB vs the ceiling cluster: ${pos === 'catch-all' ? `at/below every ceiling — a climb crosses it on ALL ${c.judged} witnessed kills` : pos === 'in-cluster' ? 'inside the band — crosses on SOME kills only' : 'above every ceiling — never crossed in-window (the grid reads it BLIND)'}`}
            >
              {g}{pos === 'catch-all' ? ' ↓ALL' : pos === 'in-cluster' ? ' ±SOME' : ' ↑NEVER'}
            </span>
          );
        })}
        {armed != null && armedPos != null && (
          <span
            className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10"
            title={`the armed guard (${armed} MB) vs the cluster: ${armedPos}. The NOW badge in the grid moves when the operator chooses.`}
          >
            ARMED {armed} · {armedPos.toUpperCase()}
          </span>
        )}
        {tryGuardMb != null && (
          <span
            className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10"
            title={`the rehearsed level (${tryGuardMb} MB) drawn dashed cyan — a rehearsal, not a choice; the armed guard moves only in guardian.py`}
          >
            TRY {tryGuardMb}
          </span>
        )}
      </div>

      {/* THE READ — computed from the population, never hardcoded */}
      <p className="text-[9px] leading-relaxed text-[#c9d4bd] rounded-sm border border-[#3a4530]/60 bg-black/20 px-2 py-1">
        {c.note}.{armedPos === 'blind' && armed != null ? (
          <> The <b className="text-[#e5484d]">ARMED {armed} MB</b> sits ABOVE the cluster — every witnessed
          crossing topped out under the line that is supposed to catch it.</>
        ) : armedPos === 'in-cluster' && armed != null ? (
          <> The <b className="text-[#e0a030]">ARMED {armed} MB</b> sits INSIDE the band — it crosses some
          witnessed kills and not others.</>
        ) : armedPos === 'catch-all' && armed != null ? (
          <> The <b className="text-[#c8ff00]">ARMED {armed} MB</b> sits below every ceiling — every witnessed
          climb crossed it.</>
        ) : null}
      </p>
    </div>
  );
}

function ScenarioRow({ s, projection }: { s: RailScenario; projection: RailProjectionPayload }) {
  const tone = VERDICT_TONE[s.verdict];
  const proj = projection.projections[`${s.kind}:${s.levelMb}`];
  const level =
    s.kind === 'guard' ? `GUARD ≥ ${s.levelMb} MB` : `FLOOR ≤ ${s.levelMb} MB`;
  return (
    <tr
      className={`border-t border-[#3a4530]/50 transition-colors duration-150 hover:bg-white/[0.03] ${
        s.current ? 'bg-white/[0.04]' : ''
      }`}
      title={
        s.verdict === 'WOULD LOOP' && s.loopWhy
          ? `unlandable as armed: ${s.loopWhy}`
          : s.verdict === 'CATCHES'
            ? `catches ${s.caught} of ${s.witnessed} witnessed kills — margins ${s.marginsMin.map((m) => `${m.toFixed(1)}m`).join(', ')}; the projection reclassifies those kills as controlled landings`
            : `no witnessed pass crossed ${s.levelMb} MB inside the witness window — a crossing outside it is unknowable, never guessed`
      }
    >
      <td className="py-1 pr-2">
        <span className="font-mono text-[9.5px] text-[#c9d4bd] tabular-nums inline-flex items-center gap-1.5">
          {level}
          {s.current && (
            <span
              className="vvu-label text-[6.5px] font-bold px-1 py-px rounded-sm border border-[#7a8a6e]/60 text-[#9aa88c]"
              title="the currently armed rail line"
            >
              NOW
            </span>
          )}
        </span>
      </td>
      <td className="py-1 pr-2">
        <span className={`vvu-label text-[7.5px] font-bold px-1 py-px rounded-sm border ${tone.cls}`}>
          {tone.text}
        </span>
      </td>
      <td className="py-1 pr-2 font-mono text-[9.5px] text-[#b8c9a0] tabular-nums">
        {s.caught}/{s.witnessed}
      </td>
      <td className="py-1 pr-2 font-mono text-[9.5px] text-[#b8c9a0] tabular-nums">
        {s.verdict === 'CATCHES' ? fmtMargin(s.meanMarginMin) : '—'}
      </td>
      <td className="py-1 pr-2 font-mono text-[9.5px] tabular-nums">
        {proj ? (
          <span className="text-[#e5484d]">{proj.killsPerDay.toFixed(1)}</span>
        ) : (
          <span className="text-[#5f6e55]">—</span>
        )}
      </td>
      <td className="py-1 pr-2 font-mono text-[9.5px] tabular-nums">
        {proj ? (
          <span className="text-[#c8ff00]">{proj.savesPerDay.toFixed(1)}</span>
        ) : (
          <span className="text-[#5f6e55]">—</span>
        )}
      </td>
      <td className="py-1 font-mono text-[9.5px] tabular-nums">
        {proj ? (
          <span
            className={proj.savedPerDayMin > 0 ? 'text-[#c8ff00]' : 'text-[#9aa88c]'}
            title={`downtime/day: ${proj.currentDowntimePerDayMin.toFixed(1)} min as landed → ${proj.downtimePerDayMin.toFixed(1)} min projected (caught kills re-land controlled at the rss-class mean)`}
          >
            {proj.savedPerDayMin > 0 ? `−${proj.savedPerDayMin.toFixed(1)}` : '±0.0'}
          </span>
        ) : (
          <span className="text-[#5f6e55]">—</span>
        )}
      </td>
    </tr>
  );
}

export function OperatorProjection({ projection, series, tryGuardMb: tryProp, onTryGuardMb }: OperatorProjectionProps) {
  const [tryLocal, setTryLocal] = useState<number | null>(null);
  const tryGuardMb = tryProp !== undefined ? tryProp : tryLocal;
  const setTryGuardMb = (v: number | null) => {
    if (onTryGuardMb) onTryGuardMb(v);
    else setTryLocal(v);
  };
  if (!projection || !projection.meta) return null;

  const { witnessed, scenarios, rates, projections, witnessWindows, meta } = projection;
  if (witnessed.length === 0) {
    // The R75 contract: witness coverage grows from R94 onward — before the
    // first witnessed kill the panel says so instead of inventing a grid.
    return (
      <div
        className="relative overflow-hidden rounded-sm border border-[#00d4e0]/20 bg-black/20 px-2.5 py-2"
        data-testid="operator-projection"
      >
        <p className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#00d4e0]/80 inline-flex items-center gap-1.5">
          <GitCompareArrows className="size-3" aria-hidden />
          OPERATOR PROJECTION · R96
        </p>
        <p className="mt-1 text-[9px] leading-relaxed text-[#7a8a6e]">
          No witnessed kills on record yet — the projection grid arms itself on the first
          port row that carries an R94 memWitness. Until then the menu reads on the proven
          chain alone.
        </p>
      </div>
    );
  }

  const catching = scenarios.filter((s) => s.verdict === 'CATCHES');
  const bestGuard = catching.find((s) => s.kind === 'guard' && s.levelMb === Math.min(...catching.filter((x) => x.kind === 'guard').map((x) => x.levelMb)));
  const bestFloor = catching.find((s) => s.kind === 'floor' && s.levelMb === Math.max(...catching.filter((x) => x.kind === 'floor').map((x) => x.levelMb)));
  const guard2200 = scenarios.find((s) => s.kind === 'guard' && s.levelMb === 2200);
  const peakRss = Math.max(...witnessed.map((k) => k.maxRssMb ?? 0));
  const deepestAvail = Math.min(...witnessed.map((k) => k.minAvailMb ?? Number.POSITIVE_INFINITY));
  const guardScenarios = scenarios.filter((s) => s.kind === 'guard');
  const floorScenarios = scenarios.filter((s) => s.kind === 'floor');
  // R102 — the ceiling population at panel scope: the try line and the
  // strip share one arithmetic (zero drift between the draw and the read)
  const ceilingPop = ceilingDistribution(
    witnessed.map((k) => ({ at: k.at, atMs: k.atMs, maxRssMb: k.maxRssMb })),
    witnessWindows,
    guardScenarios.map((s) => s.levelMb),
    meta.guardMb,
  );

  return (
    <div
      className="relative overflow-hidden rounded-sm border border-[#00d4e0]/25 bg-black/25 px-2.5 py-2"
      data-testid="operator-projection"
      title="R96 — the calibration menu's standing ask, answered: every rail level in the grid is read against the journal's own witnessed kills (memWitness, R94). Catchability is computed inside the witness window only; loop-guarded against the guardian's own warm-state reads; projected into day-rates from the same journal. This panel decides nothing."
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00d4e0]/50 to-transparent"
      />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
        <p className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#00d4e0]/90 inline-flex items-center gap-1.5">
          <GitCompareArrows className="size-3" aria-hidden />
          OPERATOR PROJECTION · THE RAILS vs THE WITNESSED KILLS
        </p>
        <span
          className="vvu-label text-[8px] font-bold px-1.5 py-0.5 rounded-sm border border-[#00d4e0]/50 text-[#00d4e0] bg-[#00d4e0]/10 tabular-nums"
          title="witness coverage began R94 — older kills cannot be backfilled; they stay kills in every projection (an unclassified death is never optimistically reclassified)"
        >
          {meta.witnessedPort} WITNESSED · {meta.unwitnessedPort} UNWITNESSED STAY KILLS
        </span>
      </div>

      {/* THE READ — computed from the grid, never hardcoded */}
      <div className="mt-1.5 rounded-sm border border-[#3a4530]/70 bg-black/30 px-2 py-1.5">
        <p className="text-[9.5px] leading-relaxed text-[#c9d4bd]">
          {guard2200 && guard2200.verdict !== 'CATCHES' && (
            <>
              <b className="text-[#e5484d]">GUARD-2200 IS {guard2200.verdict}</b>
              {guard2200.verdict === 'BLIND' && (
                <> — the witnessed kills peaked at{' '}
                  <b className="font-mono tabular-nums text-[#e0a030]">{peakRss.toFixed(0)} MB</b> in-window and never
                  crossed 2200; the menu&apos;s headline number is refuted by the journal&apos;s own witnesses.{' '}
                </>
              )}
              {guard2200.verdict === 'WOULD LOOP' && <> — at/below the warm plateau; unlandable as armed. </>}
            </>
          )}
          {catching.length > 0 ? (
            <>
              <b className="text-[#c8ff00]">THE LANDABLE LEVERS:</b>{' '}
              {[
                bestGuard && `GUARD ${bestGuard.levelMb} MB`,
                bestFloor && `FLOOR ${bestFloor.levelMb} MB`,
              ]
                .filter(Boolean)
                .join(' · ')}{' '}
              — each catches {catching[0]?.caught}/{catching[0]?.witnessed} with ~
              {fmtMargin(catching[0]?.meanMarginMin ?? null)} of landing margin. Every landable
              line sits within breathing distance of the warm state (plateau ~
              {meta.baselineMb ?? '—'} MB, live avail low {meta.observedMinAvailMb ?? '—'} MB) — the
              estate is living on the edge either way, and the projection&apos;s real currency is{' '}
              <b className="text-[#c8ff00]">CONTROL</b>, not downtime: the win is{' '}
              {rates ? `${Math.max(0, ...Object.values(projections).map((p) => p.savedPerDayMin)).toFixed(1)} min/day` : '—'}{' '}
              plus a scheduled landing instead of a mid-compile SIGKILL.
            </>
          ) : (
            <>
              <b className="text-[#e5484d]">NO LANDABLE LEVER CATCHES THE WITNESSED KILLS</b> — every
              catching level would loop on the warm state; every landable level is blind. The
              honest menu stands at option C (witness + accept the race) until the record grows.
            </>
          )}
        </p>
      </div>

      {/* DISPOSITIONS — the witnessed kills vs the armed rails */}
      <div className="mt-1.5 space-y-1">
        <p className="vvu-label text-[7.5px] font-bold tracking-[0.18em] text-[#7a8a6e]">
          DISPOSITIONS · EACH WITNESSED KILL vs THE ARMED RAILS
        </p>
        {witnessed.map((k) => {
          const hhmm = (ms: number | null) =>
            ms != null ? new Date(ms).toISOString().slice(11, 19) : '—';
          // The armed rails' verdicts come from the CURRENT scenarios' own
          // caughtAts — never assumed. A single-pass cross the 2-pass
          // discipline rode out is possible (the kernel killed between
          // passes), and the chip must say CROSSED·NO FIRE, not NO CROSS.
          const gNow = scenarios.find((s) => s.kind === 'guard' && s.current);
          const fNow = scenarios.find((s) => s.kind === 'floor' && s.current);
          const gCross = gNow?.caughtAts.includes(k.at) ?? false;
          const fCross = fNow?.caughtAts.includes(k.at) ?? false;
          return (
            <div
              key={k.at}
              className="rounded-sm border border-[#3a4530]/60 border-l-2 border-l-[#e5484d]/50 bg-black/20 px-2 py-1 transition-colors duration-150 hover:border-[#e5484d]/40 hover:bg-black/30"
              title={`kernel kill ${k.at} — ${k.samples} witness samples ${hhmm(k.windowFromMs)}→${hhmm(k.windowToMs)} (~4 min at 20s); downtime ${k.downtimeMs != null ? (k.downtimeMs / 1000).toFixed(1) : '—'}s`}
            >
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                <span className="font-mono text-[9.5px] text-[#e5484d] tabular-nums">
                  ◆ KILL {hhmm(k.atMs)}
                </span>
                <span className="font-mono text-[9px] text-[#b8c9a0] tabular-nums" title="peak next-server rss inside the witness window">
                  MAX RSS {k.maxRssMb != null ? `${k.maxRssMb.toFixed(0)} MB` : '—'}
                </span>
                <span className="font-mono text-[9px] text-[#b8c9a0] tabular-nums" title="deepest box MemAvailable inside the witness window">
                  MIN AVAIL {k.minAvailMb != null ? `${k.minAvailMb.toFixed(0)} MB` : '—'}
                </span>
                <span className="font-mono text-[9px] text-[#7a8a6e] tabular-nums">
                  DT {k.downtimeMs != null ? `${(k.downtimeMs / 1000).toFixed(1)}S` : '—'}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <span
                    className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${
                      gCross ? 'border-[#e0a030]/60 text-[#e0a030]' : 'border-[#e5484d]/45 text-[#e5484d]'
                    }`}
                    title={
                      gCross
                        ? `rss crossed the armed guard (${meta.guardMb ?? '—'} MB) inside the window but the 2-pass discipline did not fire before the kernel — a single-pass spike`
                        : `the armed guard (${meta.guardMb ?? '—'} MB) never fired — rss stayed under the line inside the window`
                    }
                  >
                    GUARD {meta.guardMb ?? '—'} → {gCross ? 'CROSSED·NO FIRE' : 'NO CROSS'}
                  </span>
                  <span
                    className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${
                      fCross ? 'border-[#e0a030]/60 text-[#e0a030]' : 'border-[#e5484d]/45 text-[#e5484d]'
                    }`}
                    title={
                      fCross
                        ? `avail crossed under the armed floor (${meta.floorMb ?? '—'} MB) inside the window but the rail did not land the boot before the kernel`
                        : `the armed floor (${meta.floorMb ?? '—'} MB) never fired — avail stayed above the line inside the window`
                    }
                  >
                    FLOOR {meta.floorMb ?? '—'} → {fCross ? 'CROSSED·NO FIRE' : 'NO CROSS'}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* R98 — THE WITNESS WINDOWS: the dying minute, drawn. Each witnessed
          kill's raw memWitness becomes a two-line sparkline (rss rose, avail
          cyan) with a shape word from the tested classifier — the forensic
          read the dispositions' numbers cannot show: was the kernel killing
          a runaway, a crossing inside an oscillation, or nothing this window
          can testify to? */}
      {witnessWindows.length > 0 && (
        <div className="mt-1.5 space-y-1" data-testid="witness-windows">
          <p
            className="vvu-label text-[7.5px] font-bold tracking-[0.18em] text-[#7a8a6e]"
            title={`each witnessed kill's memWitness (the guardian's last ≤12 passes, ~4 min at 20s) drawn as two sparklines: rss (rose) and box MemAvailable (cyan). The shape word comes from the R98 classifier (src/lib/witness-windows.ts): a reversal only counts when the swing clears ${'REVERSAL_MIN_DELTA_MB'} (5 MB) so sampling jitter cannot manufacture an oscillation; null samples are skipped, never imputed. This is the whole truth the window can testify to — nothing before it, nothing after.`}
          >
            THE WITNESS WINDOWS · THE DYING MINUTE, DRAWN
          </p>
          {(() => {
            const shapeCount = new Map<string, number>();
            for (const w of witnessWindows) shapeCount.set(w.shape.kind, (shapeCount.get(w.shape.kind) ?? 0) + 1);
            const saw = shapeCount.get('sawtooth') ?? 0;
            const climb = shapeCount.get('climbing') ?? 0;
            const fell = shapeCount.get('falling') ?? 0;
            const flatC = shapeCount.get('flat') ?? 0;
            const judged = saw + climb + fell + flatC;
            return (
              judged > 0 && (
                <p className="text-[9px] leading-relaxed text-[#c9d4bd] rounded-sm border border-[#3a4530]/60 bg-black/20 px-2 py-1">
                  {saw >= Math.max(climb, fell, flatC) && saw > 0 ? (
                    <>
                      <b className="text-[#e0a030]">{saw} OF {judged} JUDGED WINDOWS READ SAWTOOTH</b> — rss climbed,{' '}
                      <b>relieved</b>, and climbed again inside the window: the kernel killed a{' '}
                      <b className="text-[#c8ff00]">CROSSING</b>, not a runaway leak. A guard AT the crossing line
                      lands these; a leak hunt would have found nothing to fix.
                    </>
                  ) : climb >= Math.max(saw, fell, flatC) && climb > 0 ? (
                    <>
                      <b className="text-[#e5484d]">{climb} OF {judged} JUDGED WINDOWS READ CLIMBING</b> — the kernel
                      killed a rising trajectory: the runaway a guard rail exists to catch.
                    </>
                  ) : (
                    <>
                      {saw} SAWTOOTH · {climb} CLIMBING · {fell} FALLING · {flatC} FLAT across {judged} judged
                      window{judged === 1 ? '' : 's'} — no single shape dominates the record yet.
                    </>
                  )}
                </p>
              )
            );
          })()}
          {witnessed.map((k, idx) => {
            const shape = witnessWindows[idx]?.shape;
            const chip = WITNESS_SHAPE_CHIP[shape?.kind ?? 'unjudged'];
            const hhmm = (ms: number | null) => (ms != null ? new Date(ms).toISOString().slice(11, 19) : '—');
            return (
              <div
                key={`win-${k.at}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-sm border border-[#3a4530]/50 bg-black/20 px-2 py-1 transition-colors duration-150 hover:border-[#e0a030]/40 hover:bg-black/30"
                title={`kill ${hhmm(k.atMs)} window: ${shape?.note ?? 'no shape read'}`}
              >
                <WitnessSpark k={k} />
                <div className="flex min-w-[150px] flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${chip.cls}`}>
                      {chip.label}
                    </span>
                    <span className="font-mono text-[9px] text-[#b8c9a0] tabular-nums">
                      ◆ {hhmm(k.atMs)}
                    </span>
                  </div>
                  <span className="font-mono text-[8.5px] leading-relaxed text-[#7a8a6e] tabular-nums">
                    {shape?.rssSlopeMbPerMin != null ? `${shape.rssSlopeMbPerMin > 0 ? '+' : ''}${shape.rssSlopeMbPerMin.toFixed(1)} MB/MIN` : 'NO SLOPE'}
                    {shape?.rssR2 != null ? ` · R² ${shape.rssR2.toFixed(2)}` : ''}
                    {shape?.rssReversals != null ? ` · ${shape.rssReversals} REVERSAL${shape.rssReversals === 1 ? '' : 'S'}` : ''}
                    {shape?.peakAtMin != null ? ` · PEAK @ ${shape.peakAtMin.toFixed(1)}M` : ''}
                    {shape?.availSlopeMbPerMin != null ? ` · AVAIL ${shape.availSlopeMbPerMin > 0 ? '+' : ''}${shape.availSlopeMbPerMin.toFixed(0)} MB/MIN` : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* R100 — THE CEILING: the witness windows' WHERE. Each witnessed
          kill's in-window peak rss on the guard menu's own scale — the
          oscillation's top, the crossing line's geography. */}
      <CeilingStrip projection={projection} tryGuardMb={tryGuardMb} />

      {/* R105 — THE BOX FLOOR: the ceiling strip's twin on the box's own
          axis. Each witnessed kill's deepest MemAvailable on the floor
          menu's scale — where the BOX stood when the kernel struck. Since
          the 02:00Z double strike this is the only axis that explains boot
          8835's death (1816 MB, below the ceiling band: the box ran out). */}
      <BoxFloor projection={projection} />

      {/* R103 — THE STORM HISTORY: the same witnessed kills given their time
          axis back — the band's drift through the storm (is the ceiling
          migrating kill after kill?) and the heartbeat (is the regime
          turning?). Storm-window reads, never a climate verdict. */}
      <StormHistory projection={projection} />

      {/* R113 — THE ERAS OF THE STORM: the witnessed-kill timeline carved
          at the record's own lulls (heartbeat × CADENCE_STRETCH_RATIO —
          the lull dial's constant). Era arithmetic: opener, span,
          internal cadence, median ceiling/floor, kill rate. Single-kill
          eras kept — the deep-floor pressure stretch lives in them. */}
      <StormEras projection={projection} />

      {/* R118 — THE QUICKENING LENS: the pace of the storm, measured. R117's
          risk #1 instrumented — four kills landed in 77 minutes and the
          cadence question (compressing / holding / stretching) stood
          uninstrumented. Same projection payload as the eras card (one
          parse, many readers; the engine stays pure, the panel hands in
          its own ticking clock): the last 6 gaps vs the heartbeat, the
          compress streak (trailing kills inside the heartbeat), the gap
          strip on one minute scale with the heartbeat and lull lines
          drawn, the rolling hour/3h/6h counts, and the live elapsed dial
          that never forecasts a death. */}
      <KillPace projection={projection} />

      {/* R102 — THE TRY LINE: rehearse a level against everything this
          panel has computed. Client-side only — it arms nothing. */}
      {(() => {
        const levels = guardScenarios.map((s) => s.levelMb).sort((a, b) => a - b);
        const chosen = tryGuardMb != null ? guardScenarios.find((s) => s.levelMb === tryGuardMb) ?? null : null;
        const gv = tryGuardMb != null ? guardVsCeilings(tryGuardMb, ceilingPop) : null;
        const warm = series && series.length >= 2 ? warmCurveRead(series, levels, ceilingPop.judged > 0 ? { min: ceilingPop.minCeilingMb!, max: ceilingPop.maxCeilingMb! } : null) : null;
        const ride = warm?.currentMb ?? null;
        const rideGap = ride != null && tryGuardMb != null ? Math.round((ride - tryGuardMb) * 10) / 10 : null;
        const proj = chosen ? projection.projections[`guard:${chosen.levelMb}`] ?? null : null;
        return (
          <div className="mt-1.5 space-y-1" data-testid="try-line">
            <div className="flex flex-wrap items-center gap-1">
              <p
                className="vvu-label text-[7.5px] font-bold tracking-[0.18em] text-[#00d4e0]/70 mr-1"
                title="rehearse a guard level against everything above: the witnessed ceilings, the scenario grid's own verdict, the living ride. The line draws dashed cyan on the ceiling strip; the read below synthesizes. Client-side only — it arms NOTHING: the guardian's guard moves only in guardian.py, and this row never touches it."
              >
                TRY A LINE · REHEARSE, ARM NOTHING
              </p>
              {levels.map((l) => (
                <button
                  key={`try-${l}`}
                  type="button"
                  onClick={() => setTryGuardMb(tryGuardMb === l ? null : l)}
                  className={`vvu-label text-[7.5px] font-bold px-1.5 py-0.5 rounded-sm border tabular-nums transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00d4e0] ${
                    tryGuardMb === l
                      ? 'border-[#00d4e0] text-[#00d4e0] bg-[#00d4e0]/15'
                      : 'border-[#3a4530] text-[#7a8a6e] bg-black/30 hover:text-[#00d4e0] hover:border-[#00d4e0]/40'
                  }`}
                  title={`rehearse guard-${l}: ${(() => { const g2 = guardVsCeilings(l, ceilingPop); return `${g2.crosses} of ${g2.judged} witnessed ceilings reached it (${g2.cls})`; })()}`}
                >
                  {l}
                </button>
              ))}
              {tryGuardMb != null && (
                <button
                  type="button"
                  onClick={() => setTryGuardMb(null)}
                  className="vvu-label text-[7.5px] font-bold px-1.5 py-0.5 rounded-sm border border-[#3a4530] text-[#7a8a6e] bg-black/30 hover:text-[#e5484d] hover:border-[#e5484d]/40 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e5484d]"
                  title="clear the rehearsal — no line is drawn, nothing is armed (nothing ever was)"
                >
                  CLEAR
                </button>
              )}
            </div>
            {tryGuardMb != null && gv && (
              <div
                className="rounded-sm border border-dashed border-[#00d4e0]/50 bg-[#00d4e0]/[0.04] px-2 py-1.5 space-y-0.5"
                data-testid="try-read"
              >
                <p className="text-[9px] leading-relaxed text-[#c9d4bd]">
                  <b className="text-[#00d4e0]">IF GUARD-{tryGuardMb} WERE ARMED</b> — the grid&apos;s own verdict:{' '}
                  {chosen ? (
                    <b className={
                      chosen.verdict === 'CATCHES' ? 'text-[#c8ff00]' : chosen.verdict === 'BLIND' ? 'text-[#e5484d]' : 'text-[#e0a030]'
                    }>
                      {chosen.verdict}
                    </b>
                  ) : (
                    <span className="text-[#7a8a6e]">NOT ON THE GRID (custom level)</span>
                  )}
                  {chosen?.verdict === 'CATCHES' && chosen.caught != null && (
                    <> · {chosen.caught}/{chosen.witnessed} witnessed kills, mean margin {fmtMargin(chosen.meanMarginMin)}</>
                  )}
                  {chosen?.verdict === 'WOULD LOOP' && chosen.loopWhy && <> — {chosen.loopWhy}</>}
                </p>
                <p className="text-[9px] leading-relaxed text-[#c9d4bd]">
                  The ceilings: it crosses <b className="text-[#c9d4bd]">{gv.crosses} of {gv.judged}</b> witnessed
                  {' '}{gv.judged === 1 ? 'ceiling' : 'ceilings'} ({gv.cls})
                  {gv.marginToBandMb != null ? (
                    <> — {gv.cls === 'catch-all' ? `${Math.abs(gv.marginToBandMb)} MB under the dead's shallowest top` : gv.cls === 'blind' ? `${gv.marginToBandMb} MB over the dead's highest top` : `${Math.abs(gv.marginToBandMb)} MB from the nearer band edge`}</>
                  ) : null}
                  .{ride != null ? (
                    <> The living boot rides <b className="text-[#c9d4bd]">{ride} MB</b>,{' '}
                    {rideGap != null && rideGap <= 0 ? `${Math.abs(rideGap)} MB under the line` : rideGap != null ? `${rideGap} MB over it` : '—'}.</>
                  ) : null}
                  {proj ? (
                    <> Re-projected: <span className="text-[#c8ff00]">{proj.savesPerDay.toFixed(1)} saves/day</span>, downtime/day −{proj.savedPerDayMin.toFixed(1)} min.</>
                  ) : null}
                </p>
                <p className="vvu-label text-[7px] text-[#5f6e55]">
                  A REHEARSAL, NOT A CHOICE — THE ARMED GUARD MOVES ONLY IN GUARDIAN.PY
                </p>
              </div>
            )}
          </div>
        );
      })()}

      {/* SCENARIOS — the grid */}
      <div className="mt-1.5 overflow-x-auto">
        <table className="w-full border-collapse" data-testid="projection-scenarios">
          <thead>
            <tr>
              {['RAIL LEVEL', 'VERDICT', 'CAUGHT', 'MARGIN', 'KILLS/D', 'SAVES/D', 'DT/D Δ'].map((h) => (
                <th
                  key={h}
                  className="vvu-label text-[6.5px] font-bold tracking-[0.14em] text-[#5f6e55] text-left pb-0.5 pr-2"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guardScenarios.map((s) => (
              <ScenarioRow key={`guard:${s.levelMb}`} s={s} projection={projection} />
            ))}
            {floorScenarios.map((s) => (
              <ScenarioRow key={`floor:${s.levelMb}`} s={s} projection={projection} />
            ))}
          </tbody>
        </table>
      </div>

      {/* THE HONESTY LINE */}
      <div className="mt-1.5 flex items-start gap-1.5 border-t border-[#3a4530]/60 pt-1.5">
        <Info className="size-3 mt-px shrink-0 text-[#00d4e0]/60" aria-hidden />
        <p className="text-[8.5px] leading-relaxed text-[#7a8a6e]">
          {meta.windowNote}. Witness sampling is 20s — every margin is bounded below by up to one
          pass; BLIND means never crossed in-window, and a crossing outside it is unknowable,
          never guessed. The loop check reads the LIVE plateau — a fresh boot&apos;s plateau is
          low, and R73&apos;s scope measured warm cycles climbing +758 MB/boot across 2100 in
          normal operation, so a guard under that line tightens as the boot warms (its rhythm
          cost is real, and that trade is exactly what the menu asks the operator to price). The
          downtime column&apos;s win is modest by nature (kernel kill ~
          {rates?.portMeanMs != null ? (rates.portMeanMs / 1000).toFixed(1) : '—'}s vs controlled
          landing ~{rates?.rssMeanMs != null ? (rates.rssMeanMs / 1000).toFixed(1) : '—'}s on
          record) — the projection quantifies rhythm and control, and the decision stays
          PENDING · OPERATOR.
        </p>
      </div>
    </div>
  );
}
