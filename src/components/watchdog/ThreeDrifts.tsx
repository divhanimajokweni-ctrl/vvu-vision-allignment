'use client';

/**
 * THE THREE DRIFTS — the reconciliation card (R106).
 *
 * Three engines already measure the storm's velocities on three geographies:
 *   · CEILING (storm-history)  — the altitude where boots die      (MB/kill)
 *   · FLOOR    (box-floor)      — the depth where the box stands   (MB/kill)
 *   · OPENING  (pair-sheet)     — how hot each new boot opens      (MB/cycle)
 *
 * This card reads all three verbatim and asks the operator's question:
 * do the geographies AGREE? Each axis's own climate word maps into the
 * common tongue (easing / grinding / worsening); a direction is only
 * CALLED when the fit's R² reaches the call threshold AND the halves
 * medians move the same way (two evidence tracks — a fit that contradicts
 * its own halves is marked CONTRADICTED and stays out of every verdict).
 * Everything short of a call stays the GRIND — the steady baseline is a
 * finding, not a failure to find. The bar lengths are velocities scaled
 * to 2× each axis's own threshold (capped, arithmetic in every tooltip);
 * the halves medians are LEVELS, not velocities — they stay text, never
 * squeezed onto the velocity bar (the honest-drawable rule).
 */

import { threeDrifts, R2_CALL_THRESHOLD, type DriftAxis } from '@/lib/three-drifts';
import { stormHistory } from '@/lib/storm-history';
import { boxFloorRead } from '@/lib/box-floor';
import { pairSheet, type PairSheetRow } from '@/lib/pair-sheet';
import type { RailProjectionPayload } from '@/lib/operator-projection';

const VERDICT_TAG: Record<string, { label: string; cls: string }> = {
  waiting: { label: 'RECONCILIATION WAITING', cls: 'border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10' },
  grind: { label: 'THE GRIND', cls: 'border-[#3a4530] text-[#7a8a6e] bg-black/30' },
  solo: { label: 'SOLO CALL', cls: 'border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10' },
  'one-voice': { label: 'ONE VOICE', cls: 'border-[#6b8a40]/70 text-[#c8ff00] bg-[#6b8a40]/10' },
  split: { label: 'SPLIT VERDICT', cls: 'border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10' },
};

/** Each axis's climate word keeps its OWN panel's hue — the ceiling's
 *  rising rose is the storm-history chip, the floor's settling rose is
 *  the box-floor chip (deeper = the box loses), the opening's warming
 *  amber is the pair-sheet chip. One grammar per geography, never fused. */
function wordTone(key: DriftAxis['key'], read: string | null): { hex: string; cls: string } {
  if (read === 'flat' || read == null) return { hex: '#7a8a6e', cls: 'border-[#3a4530] text-[#7a8a6e] bg-black/30' };
  const worsening = (key === 'ceiling' && read === 'rising') || (key === 'floor' && read === 'settling') || (key === 'opening' && read === 'warming');
  if (key === 'opening') return worsening
    ? { hex: '#e0a030', cls: 'border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10' }
    : { hex: '#00d4e0', cls: 'border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10' };
  return worsening
    ? { hex: '#e5484d', cls: 'border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10' }
    : { hex: '#00d4e0', cls: 'border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10' };
}

const GEOGRAPHY: Record<DriftAxis['key'], string> = {
  ceiling: 'the altitude where boots die',
  floor: 'the depth where the box stands',
  opening: 'how hot each new boot opens',
};

export function ThreeDrifts({
  projection,
  ledgerRows,
}: {
  projection: RailProjectionPayload;
  ledgerRows: Array<PairSheetRow>;
}) {
  // R116 — the drifts read ALL witnessed deaths: an avail-critical death's
  // ceiling and floor are real death-time reads (its floor is by definition
  // the box's deepest — excluding the very deaths the floor axis watches
  // biases the settling story). The rail-level context stays port's.
  const { witnessedDeaths: witnessed, scenarios } = projection;
  if (!witnessed || witnessed.length === 0) return null;

  const storm = stormHistory(witnessed.map((k) => ({ at: k.at, atMs: k.atMs, maxRssMb: k.maxRssMb })));
  if (storm.beats.length < 2) return null;
  const floorLevels = scenarios.filter((s) => s.kind === 'floor').map((s) => s.levelMb).sort((a, b) => a - b);
  const floor = boxFloorRead(
    witnessed.map((k) => ({ at: k.at, atMs: k.atMs, minAvailMb: k.minAvailMb })),
    floorLevels,
  );
  const pairs = pairSheet(
    (ledgerRows ?? []).map((r) => ({
      atMs: typeof r.atMs === 'number' && Number.isFinite(r.atMs) ? r.atMs : null,
      bootPid: r.bootPid,
      kind: String(r.kind ?? ''),
      climbMb: typeof r.climbMb === 'number' && Number.isFinite(r.climbMb) ? r.climbMb : null,
      uptimeSec: typeof r.uptimeSec === 'number' && Number.isFinite(r.uptimeSec) ? r.uptimeSec : null,
      via: r.via != null ? String(r.via) : null,
    })),
  );

  const r = threeDrifts({
    storm: {
      judged: storm.judged,
      driftMbPerKill: storm.driftMbPerKill,
      driftR2: storm.driftR2,
      driftRead: storm.driftRead,
      firstHalfMedianMb: storm.firstHalfMedianMb,
      secondHalfMedianMb: storm.secondHalfMedianMb,
    },
    floor: {
      judged: floor.judged,
      floorDriftMbPerKill: floor.floorDriftMbPerKill,
      floorDriftR2: floor.floorDriftR2,
      floorDriftRead: floor.floorDriftRead,
      firstHalfMedianMb: floor.firstHalfMedianMb,
      secondHalfMedianMb: floor.secondHalfMedianMb,
    },
    pairs: {
      openings: pairs.openings,
      openingDriftMbPerCycle: pairs.openingDriftMbPerCycle,
      openingDriftR2: pairs.openingDriftR2,
      openingDriftRead: pairs.openingDriftRead,
      firstHalfMedianClimbMb: pairs.firstHalfMedianClimbMb,
      lastHalfMedianClimbMb: pairs.lastHalfMedianClimbMb,
    },
  });

  // ── the velocity bars: one SVG, three lanes, one shared zero line.
  // Length = |drift| / (2 × the axis's own threshold), capped at the
  // frame; sign = direction. CALLED axes wear a lime ring. ──
  const W = 520;
  const LANE_H = 26;
  const H = r.axes.length * LANE_H;
  const center = W / 2;
  const halfSpan = center - 10;
  const scaleCap = 2;

  const barFor = (a: DriftAxis) => {
    if (a.driftMb == null || a.driftMb === 0) return null;
    const frac = Math.min(1, Math.abs(a.driftMb) / (scaleCap * a.thresholdMb));
    const len = Math.max(3, frac * halfSpan);
    return a.driftMb > 0 ? { x: center, w: len } : { x: center - len, w: len };
  };

  const statusOf = (a: DriftAxis): { word: string; cls: string } => {
    if (a.callable) return { word: 'CALLED', cls: 'text-[#c8ff00]' };
    if (a.selfContradicted) return { word: 'CONTRADICTED', cls: 'text-[#e5484d]' };
    if (a.driftMb == null) return { word: 'NO FIT', cls: 'text-[#7a8a6e]' };
    if (a.read === 'flat') return { word: 'GRIND', cls: 'text-[#7a8a6e]' };
    return { word: 'LEANING', cls: 'text-[#e0a030]' };
  };

  const fmtV = (v: number | null) =>
    v == null ? 'no fit' : `${v > 0 ? '+' : ''}${Math.round(v * 100) / 100} ${v > 0 ? '↑' : '↓'}`;
  const halvesWord = (a: DriftAxis) => {
    if (a.firstHalfMedianMb == null || a.secondHalfMedianMb == null) return 'halves —';
    const d = Math.round((a.secondHalfMedianMb - a.firstHalfMedianMb) * 10) / 10;
    return `halves ${Math.round(a.firstHalfMedianMb * 10) / 10} → ${Math.round(a.secondHalfMedianMb * 10) / 10} (${d > 0 ? '+' : ''}${d})`;
  };
  const r2Word = (a: DriftAxis) =>
    a.r2 == null ? 'R² —' : `R² ${Math.round(a.r2 * 100) / 100}${a.r2 >= R2_CALL_THRESHOLD ? ' · at call' : ' · leans'}`;

  const verdict = VERDICT_TAG[r.verdict];

  return (
    <div
      className="mt-1.5 space-y-1 border-t border-[#3a4530]/60 pt-1.5 transition-colors duration-200 hover:border-[#4a5a3e]"
      data-testid="three-drifts"
      title="R106 — THE THREE DRIFTS: the storm's reconciliation card. Three engines already measure three geographies — the ceiling strip (the altitude where boots die, MB/kill), the box floor (the depth where the box stands when the kernel strikes, MB/kill), the pair sheet (how hot each new boot opens, MB/cycle). This card reads all three verbatim and asks whether they AGREE: each axis's climate word maps into the common tongue (easing / grinding / worsening), and a direction is only CALLED when the fit's R² reaches 0.5 AND the halves medians move the same way — a fit that contradicts its own halves is marked and stays out of every verdict. The grind — every axis holding inside its noise band — is a finding, not a failure to find. Bar length = |drift| / (2 × the axis's own threshold), capped; the halves medians are levels, not velocities, and stay text."
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="vvu-label text-[7.5px] font-bold tracking-[0.18em] text-[#7a8a6e]">
          THE THREE DRIFTS · ONE STORM, THREE GEOGRAPHIES, RECONCILED
        </p>
        <span className={`vvu-label border px-1.5 py-[1px] text-[7.5px] font-bold tracking-[0.14em] ${verdict.cls}`}>
          {verdict.label}
          {r.verdictDirection ? ` · ${r.verdictDirection.toUpperCase()}` : ''}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full [&_rect]:cursor-help [&_circle]:cursor-help [&_line]:cursor-help [&_path]:cursor-help"
        role="img"
        aria-label={`three drifts: ${r.called.length} axes called, ${r.grindCount} grinding, ${r.waitingCount} without a fit, verdict ${r.verdict}`}
      >
        {r.axes.map((a, i) => {
          const laneTop = i * LANE_H;
          const midY = laneTop + LANE_H / 2;
          const bar = barFor(a);
          const tone = wordTone(a.key, a.read);
          return (
            <g key={a.key} className="cursor-help">
              {/* the lane's zero line — the shared calm every velocity departs from */}
              <line x1={10} y1={midY} x2={W - 10} y2={midY} stroke="#3a4530" strokeWidth={0.6} opacity={0.6}>
                <title>{`${a.label} — drift 0: the axis's own noise floor; a bar leaving this line is the fitted migration`}</title>
              </line>
              <line x1={center} y1={laneTop + 3} x2={center} y2={laneTop + LANE_H - 3} stroke="#3a4530" strokeWidth={0.6} opacity={0.9}>
                <title>{`drift 0 — ${a.label.toLowerCase()} steady`}</title>
              </line>
              {bar ? (
                <rect
                  x={bar.x}
                  y={midY - 4.5}
                  width={bar.w}
                  height={9}
                  fill={tone.hex}
                  opacity={a.callable ? 0.95 : 0.6}
                  stroke={a.callable ? '#c8ff00' : 'none'}
                  strokeWidth={a.callable ? 1 : 0}
                  rx={1.5}
                >
                  <title>
                    {`${a.label}: ${fmtV(a.driftMb)} ${a.unit.toLowerCase()} — read ${String(a.read).toUpperCase()} — ${r2Word(a)} — ${halvesWord(a)} — n=${a.judged} — scale |drift|/(2×${a.thresholdMb} MB), capped${a.selfContradicted ? ' — the fit and the halves CONTRADICT: disclosed, out of the verdict' : ''}${a.callable ? ' — CALLED' : ''}`}
                  </title>
                </rect>
              ) : (
                <circle cx={center} cy={midY} r={2.5} fill="none" stroke="#7a8a6e" strokeWidth={0.8} opacity={0.7}>
                  <title>{`${a.label}: no fit — ${a.driftMb == null ? `below the engine's minimum n (${a.minForDrift})` : 'zero fitted velocity'} — the lane stays honest, hollow`}</title>
                </circle>
              )}
              {/* the axis's name, drawn inside its lane — the eye reads geography before number */}
              <text x={12} y={midY - 4.5} fill="#7a8a6e" fontSize={6} fontWeight="bold" letterSpacing={1.2}>
                {a.label}
              </text>
              <text x={12} y={midY + 7} fill="#5f6e55" fontSize={4.6} letterSpacing={0.4}>
                {GEOGRAPHY[a.key]}
              </text>
              {/* the fitted velocity, verbatim, at the bar's end */}
              <text x={W - 12} y={midY - 4.5} textAnchor="end" fill={tone.hex} fontSize={6.2} fontWeight="bold">
                {a.driftMb == null ? 'no fit' : `${fmtV(a.driftMb)} ${a.unit}/step`}
              </text>
              <text x={W - 12} y={midY + 7} textAnchor="end" fill="#7a8a6e" fontSize={4.6}>
                {`${r2Word(a)} · n=${a.judged}`}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center gap-1">
        {r.axes.map((a) => {
          const tone = wordTone(a.key, a.read);
          const st = statusOf(a);
          return (
            <span
              key={`chip-${a.key}`}
              className={`border px-1.5 py-[1px] text-[7.5px] font-bold tracking-[0.1em] ${tone.cls}`}
              title={`${a.label}: ${fmtV(a.driftMb)} ${a.unit.toLowerCase()} — ${String(a.read ?? 'no word').toUpperCase()} — ${r2Word(a)} — ${halvesWord(a)} — status ${st.word}${a.selfContradicted ? ' (the fit and the halves disagree — disclosed, never averaged away)' : ''}`}
            >
              {a.label} {a.read ? String(a.read).toUpperCase() : 'NO WORD'} · {fmtV(a.driftMb)} · {st.word}
            </span>
          );
        })}
        <span
          className="border border-[#3a4530] bg-black/30 px-1.5 py-[1px] text-[7.5px] font-bold tracking-[0.1em] text-[#7a8a6e]"
          title={`the reconciliation's census: ${r.called.length} called, ${r.grindCount} grinding, ${r.waitingCount} waiting, ${r.contradictedCount} self-contradicted — the call gate is R² ≥ ${R2_CALL_THRESHOLD} plus the halves' agreement`}
        >
          {r.called.length} CALLED · {r.grindCount} GRIND · {r.waitingCount} NO FIT
          {r.contradictedCount > 0 ? ` · ${r.contradictedCount} CONTRADICTED` : ''}
        </span>
      </div>

      <p className="border border-[#3a4530]/50 bg-black/40 px-2 py-1.5 text-[10px] leading-relaxed text-[#a8b89a]">
        {r.note}
      </p>
    </div>
  );
}
