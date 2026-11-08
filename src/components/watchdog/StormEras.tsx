'use client';

// src/components/watchdog/StormEras.tsx — R113 · THE ERAS OF THE STORM.
//
// The record's prose has always spoken in eras — "the fastest era", "the
// pressure era", "the longest calm" — but nothing ever SEGMENTED the
// timeline it was describing. This card does the carving with the
// record's own rules and nothing new: a gap between consecutive witnessed
// kills that runs past the LULL LINE — the heartbeat (storm-history's
// full-median interval) × CADENCE_STRETCH_RATIO (1.25, the same constant
// the outlook lull dial reads) — opens a new era. One calibration, many
// readers.
//
//   the strip   — one segment per era, width ∝ span, in kill order; the
//                 lulls that carved them sit BETWEEN segments as hollow
//                 stretches with the gap length in the tooltip. The
//                 CURRENT era pulses sage; the deepest-floor era wears a
//                 rose border; single-kill eras are NOT merged away —
//                 in this record they are the deep-floor pressure stretch.
//   the table   — every era's arithmetic, focusable: kills, opener,
//                 span, internal cadence, median ceiling, median floor,
//                 kill rate — and R122's WORD: the death-cause lens's own
//                 verdict on the era's membership (the era IS the window;
//                 one calibration, many windows — the twin's lesson, cut
//                 temporally). The era share lane draws the non-port share
//                 era by era against the same call line the drift rides;
//                 the turn's address chip names WHERE the floor's turns
//                 live; a whisker carve (an opener within 5% of the line)
//                 is named — the first place a re-carve will show.
//   THE READ    — the engines' own notes, verbatim.

import { useMemo } from 'react';

import type { RailProjectionPayload } from '@/lib/operator-projection';
import { stormHistory } from '@/lib/storm-history';
import { stormEras, type StormEra } from '@/lib/eras';
import {
  eraVerdicts,
  CAUSE_MIN_DEATHS,
  CAUSE_SHARE_CALL,
  type EraVerdictsRead,
  type DeathCauseVerdict,
} from '@/lib/death-causes';

const SAGE = '#c8ff00';
const ROSE = '#e5484d';

// R117 — the era mix speaks the death-cause lens's color vocabulary: one
// calibration for the cause names across both cards.
function causeColor(cause: string): string {
  if (cause === 'port') return '#00d4e0';
  if (cause === 'avail-critical') return '#e0a030';
  if (cause === 'rss') return ROSE;
  return '#5f6e55';
}

function fmt(v: number | null, digits = 1): string {
  return v == null ? '—' : v.toFixed(digits);
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
    <span className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${toneCls} tabular-nums cursor-help transition-[filter,border-color] hover:brightness-125`} title={title}>
      {label}
    </span>
  );
}

function verdictTone(word: DeathCauseVerdict): 'neutral' | 'sage' | 'cyan' | 'amber' {
  switch (word) {
    case 'PORT MONOPOLY':
      return 'cyan';
    case 'THE FLOOR TAKES TURN':
      return 'amber';
    case 'PORT RULES':
      return 'sage';
    default:
      return 'neutral';
  }
}

function eraTip(
  e: StormEra,
  heartbeat: number | null,
  line: number | null,
  ev?: { word: DeathCauseVerdict; share: number; nonPort: number; n: number; marginMin: number | null; whisker: boolean },
): string {
  const opener =
    e.openedByGapMin == null
      ? 'opened mid-storm (the record\'s first era)'
      : `opened by the ${e.openedByGapMin.toFixed(1)}-min lull (over the ${line?.toFixed(2)}-min line)`;
  const cadence =
    e.medianGapInsideMin == null
      ? e.n === 1
        ? 'no internal interval (a lone strike between lulls)'
        : 'no internal interval'
      : `internal cadence median ${e.medianGapInsideMin.toFixed(1)} min of ${e.gapsInsideMin.length} gap(s)`;
  const rate = e.killsPerHour == null ? 'no honest kill rate (span 0)' : `${e.killsPerHour.toFixed(2)} kills/hour`;
  const lens = ev
    ? `the lens's word on this era: ${ev.word} (non-port ${ev.nonPort}/${ev.n} = ${(ev.share * 100).toFixed(1)}% against the ${(CAUSE_SHARE_CALL * 100).toFixed(0)}% call)${ev.whisker ? " — the carve stands a whisker past the line, the first place a re-carve will show" : ''}`
    : null;
  return [
    `ERA #${e.index}: kills ${e.firstSeq}–${e.lastSeq} (n=${e.n})`,
    opener,
    cadence,
    `span ${fmt(e.spanMin)} min (${e.firstAt} → ${e.lastAt})`,
    `median ceiling ${fmt(e.medianCeilingMb)} MB · median floor ${fmt(e.medianFloorMb)} MB (non-null witnessed values; nulls skipped, never zero)`,
    rate,
    `heartbeat ${fmt(heartbeat, 2)} min × 1.25 = the ${line?.toFixed(2)}-min lull line (CADENCE_STRETCH_RATIO — the same line the outlook's lull dial reads)`,
    ...(lens ? [lens] : []),
  ].join(' · ');
}

export function StormEras({ projection }: { projection: RailProjectionPayload }) {
  const { read, eraMixes, ev } = useMemo(() => {
    // R116 — the feed is witnessedDeaths (ALL causes): a record whose second
    // killer is invisible would carve phantom eras from lulls that never
    // happened (the 07:34:42Z avail-critical strike was once invisible here,
    // and the engine answered with a 59.42-min "lull" that was really
    // 28.47 + 30.95 split by an uncounted death). The heartbeat, the lull
    // line and every carve below read the record's WHOLE kill rhythm.
    const deaths = projection.witnessedDeaths ?? projection.witnessed;
    if (!deaths || deaths.length === 0) return { read: null, eraMixes: [], ev: null };
    const storm = stormHistory(deaths.map((k) => ({ at: k.at, atMs: k.atMs, maxRssMb: k.maxRssMb })));
    const r = stormEras(
      deaths.map((k) => ({
        at: k.at,
        atMs: k.atMs,
        maxRssMb: typeof k.maxRssMb === 'number' && Number.isFinite(k.maxRssMb) ? k.maxRssMb : null,
        minAvailMb: typeof k.minAvailMb === 'number' && Number.isFinite(k.minAvailMb) ? k.minAvailMb : null,
      })),
      { heartbeatMin: storm.medianIntervalMin },
    );
    // R117 — the per-era cause mix: the era card now reads all-cause deaths,
    // so each era can say WHO its kills were (the census is the lens's
    // vocabulary — the same cause names, one calibration).
    const mixes = r.eras.map((e) => {
      const census = new Map<string, number>();
      for (const d of deaths.slice(e.firstSeq - 1, e.lastSeq)) {
        const cause = (d as { cause?: string }).cause ?? 'unknown';
        census.set(cause, (census.get(cause) ?? 0) + 1);
      }
      return [...census.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([cause, n]) => ({ cause, n }));
    });
    // R122 — THE ERA VERDICTS: the lens's own window rules on each era's
    // membership (the era IS the window — one calibration, many windows),
    // the turn's address, and the carve margins against the lull line.
    const evRead = eraVerdicts(
      deaths.map((d) => ({ cause: (d as { cause?: string }).cause ?? 'unknown' })),
      r.eras.map((e) => ({
        index: e.index,
        firstSeq: e.firstSeq,
        lastSeq: e.lastSeq,
        openedByGapMin: e.openedByGapMin,
      })),
      { lullLineMin: r.lullLineMin },
    );
    return { read: r, eraMixes: mixes, ev: evRead };
  }, [projection]);

  if (!read || read.eraCount === 0 || !ev) return null;

  const deepestIdx = read.deepestEra?.index ?? null;
  // strip geometry: eras grow by span, lulls by gap — one shared scale
  const weights = read.eras.map((e) => Math.max(e.spanMin, 0.5));
  const lullWeights = read.splitLulls.map((l) => Math.max(l.gapMin, 0.5));

  return (
    <div className="mt-1.5 rounded-sm border border-[#3a4530]/60 bg-black/20 p-2 transition-colors duration-200 hover:border-[#4a5a3e]" data-testid="storm-eras">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p
          className="vvu-label text-[7.5px] font-bold tracking-[0.18em] text-[#7a8a6e]"
          title={`THE ERAS OF THE STORM — the witnessed-death timeline carved at the record's own lulls. R116: the feed reads ALL witnessed deaths (port and avail-critical alike — the death-cause lens caught the port-only feed carving a phantom era from a lull that never happened). A gap between consecutive deaths past the lull line (the heartbeat × ${1.25} — storm-history's CADENCE_STRETCH_RATIO, the same constant the outlook's lull dial reads) opens a new era. Every era carries its own honest arithmetic: the gap that opened it (null for the first — the record opens mid-storm), the median gap inside it (null for a lone strike), median ceiling and floor over the non-null witnessed values, and a kill rate the span can honestly support. Single-death eras are NOT merged away: in this record they are the deep-floor pressure stretch. All descriptive — the card names eras, it does not diagnose them.`}
        >
          THE ERAS OF THE STORM · THE TIMELINE, CARVED AT ITS LULLS
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Chip
            tone="cyan"
            label={`${read.eraCount} ERAS`}
            title={`${read.eraCount} eras carved from ${read.eras.reduce((a, e) => a + e.n, 0)} witnessed deaths (all causes — R116's feed) · heartbeat ${fmt(read.heartbeatMin, 2)} min · lull line ${fmt(read.lullLineMin, 2)} min`}
          />
          <Chip
            label={`LULL LINE ${fmt(read.lullLineMin, 2)}′`}
            title={`the heartbeat ${fmt(read.heartbeatMin, 2)} min × 1.25 — the same line the outlook's lull dial reads (CADENCE_STRETCH_RATIO). ${read.splitLulls.length} lull(s) crossed it and did the carving`}
          />
          {read.longestLull && (
            <Chip
              tone="amber"
              label={`LONGEST LULL ${fmt(read.longestLull.gapMin)}′`}
              title={`the record's longest lull: ${read.longestLull.gapMin.toFixed(1)} min, ${read.longestLull.fromAt} → ${read.longestLull.toAt} — the quiet stretch that opened era #${read.splitLulls.findIndex((l) => l === read.longestLull) + 2}`}
            />
          )}
          {read.deepestEra && (
            <Chip
              tone="rose"
              label={`DEEPEST ERA #${read.deepestEra.index} · ${fmt(read.deepestEra.medianFloorMb)} MB`}
              title={`era #${read.deepestEra.index} holds the record's deepest median floor: ${read.deepestEra.medianFloorMb} MB MemAvailable at the kills — the pressure stretch the prose has always described, now segmented`}
            />
          )}
          {read.densestEra && (
            <Chip
              tone="sage"
              label={`DENSEST #${read.densestEra.index} · ${read.densestEra.killsPerHour.toFixed(2)}/H`}
              title={`era #${read.densestEra.index} is the densest: ${read.densestEra.killsPerHour} kills per hour across its span (single-kill eras carry no honest rate)`}
            />
          )}
          {read.currentEraIndex != null && (
            <Chip
              tone="sage"
              label={`CURRENT ERA #${read.currentEraIndex}`}
              title={`the era holding the record's newest kill (kill #${read.eras[read.eras.length - 1]!.lastSeq}, ${read.eras[read.eras.length - 1]!.lastAt}) — ${read.eras[read.eras.length - 1]!.n} kill(s), ${fmt(read.eras[read.eras.length - 1]!.killsPerHour, 2)} kills/hour`}
            />
          )}
          {/* R122 — THE TURN'S ADDRESS: where the floor's turns live, era by era. */}
          {ev.turnEras.length > 0 ? (
            <Chip
              tone="amber"
              label={`THE TURN LIVES IN ERA ${ev.turnEras.map((i) => `#${i}`).join(' + ')}`}
              title={`THE ERA VERDICTS — the lens's own window rules on each era's membership: ${ev.turnEras.map((i) => `era #${i}`).join(' and ')} read${ev.turnEras.length === 1 ? 's' : ''} THE FLOOR TAKES TURN (a non-port cause holds ≥ ${(CAUSE_SHARE_CALL * 100).toFixed(0)}% of that era's deaths, INCLUSIVE edge). The temporal twin of the scarcity ladder's depth finding — the depth lens says the deep band is the floor's turn; the era cut says WHEN the floor's turns cluster`}
            />
          ) : (
            <Chip
              label="NO ERA SPEAKS THE TURN"
              title={`THE ERA VERDICTS — the lens's window rules applied era by era; no era's membership holds a non-port share at or past the ${(CAUSE_SHARE_CALL * 100).toFixed(0)}% call`}
            />
          )}
          {ev.whiskerCarves && (
            <Chip
              tone="amber"
              label="WHISKER CARVE"
              title={`THE CARVE MARGINS — every carve's own distance past the lull line, and the warning: era ${ev.eras.filter((e) => e.whisker).map((e) => `#${e.index}`).join(' and ')} was opened by a lull standing within 5% of the line (era ${ev.eras.filter((e) => e.whisker).map((e) => `#${e.index}: ${e.openerGapMin?.toFixed(1)}′ vs the ${read.lullLineMin?.toFixed(2)}′ line, margin ${e.marginMin?.toFixed(1)}′`).join('; ')}). The line re-derives as the heartbeat grows — a near-line carve is the FIRST place a re-carve will show (R121's lesson: era #6's number came from the line moving, not a new lull)`}
            />
          )}
        </div>
      </div>

      {/* THE STRIP — eras grow by span, lulls sit between as hollow stretches */}
      <div className="mt-2" data-testid="storm-eras-strip">
        <div className="flex items-stretch gap-0 h-6">
          {read.eras.map((e, i) => {
            const isCurrent = e.index === read.currentEraIndex;
            const isDeepest = e.index === deepestIdx;
            const lull = i < read.splitLulls.length ? read.splitLulls[i] : null;
            const evHere = ev.eras[i];
            const openedEv = ev.eras[i + 1];
            return (
              <div key={e.index} className="flex items-stretch" style={{ flex: `${weights[i]!} 1 0%`, minWidth: 10 }}>
                <div
                  tabIndex={0}
                  title={eraTip(e, read.heartbeatMin, read.lullLineMin, evHere)}
                  aria-label={eraTip(e, read.heartbeatMin, read.lullLineMin, evHere)}
                  className={`flex-1 rounded-sm outline-none transition-all duration-150 opacity-80 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-[#c8ff00]/60 ${
                    isCurrent ? 'bg-[#c8ff00]/25 border border-[#c8ff00]/80 animate-pulse' : isDeepest ? 'bg-[#5f6e55]/60 border border-[#e5484d]/80' : 'bg-[#5f6e55]/50 border border-transparent'
                  }`}
                  style={{ color: isCurrent ? SAGE : undefined }}
                >
                  <span className="vvu-label text-[6.5px] font-bold flex items-center justify-center h-full" style={{ color: isCurrent ? SAGE : '#c9d4bd' }}>
                    #{e.index}
                  </span>
                </div>
                {lull && (
                  <div
                    className="mx-px border-b border-dashed border-[#e0a030]/50"
                    style={{ flex: `${lullWeights[i]!} 1 0%`, minWidth: 6 }}
                    title={`THE LULL THAT CARVED — ${lull.gapMin.toFixed(1)} min with no witnessed kill, ${lull.fromAt} → ${lull.toAt}. Past the ${read.lullLineMin?.toFixed(2)}-min line, this silence opened era #${e.index + 1}.${openedEv?.marginMin != null ? ` The carve stood ${openedEv.marginMin.toFixed(1)}′ past the line${openedEv.whisker ? ' — A WHISKER: the first place a re-carve will show' : ''}.` : ''} The strip's hollow stretch is the quiet, drawn at the same scale as the eras`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1" aria-hidden>
          <span className="vvu-label text-[6.5px] text-[#5f6e55]">
            <span className="inline-block w-2 h-2 rounded-sm bg-[#5f6e55]/50 mr-1 align-middle" />
            era (width ∝ span)
          </span>
          <span className="vvu-label text-[6.5px] text-[#e0a030]">
            <span className="inline-block w-3 border-b border-dashed border-[#e0a030]/60 mr-1 align-middle" />
            the lull that carved
          </span>
          <span className="vvu-label text-[6.5px] text-[#c8ff00]">
            <span className="inline-block w-2 h-2 rounded-sm bg-[#c8ff00]/25 border border-[#c8ff00]/80 mr-1 align-middle" />
            current era
          </span>
          <span className="vvu-label text-[6.5px] text-[#e5484d]">
            <span className="inline-block w-2 h-2 rounded-sm bg-[#5f6e55]/60 border border-[#e5484d]/80 mr-1 align-middle" />
            deepest floor era
          </span>
          <span className="vvu-label text-[6.5px] text-[#5f6e55] ml-auto">left → right = kill order</span>
        </div>
      </div>

      {/* R122 — THE ERA SHARE LANE: the lens's temporal cut, drawn. One bar
          per era (equal width — the eras strip already carries the time
          scale), bar height = the era's own non-port share against the same
          call line the drift rides; amber where the era's word reads THE
          FLOOR TAKES TURN, dimmed where TOO FEW (the word refuses, the
          share still draws), slate where port rules. */}
      <div className="mt-2" data-testid="storm-eras-share-lane">
        <svg viewBox="0 0 560 84" className="w-full h-auto [&_rect]:cursor-help [&_circle]:cursor-help [&_line]:cursor-help" role="img" aria-label="era share lane — non-port share by era against the call line">
          {(() => {
            const top = 6;
            const base = 62;
            const scale = (base - top) / 0.5; // 50% full scale
            const n = ev.eras.length;
            const gap = 4;
            const bw = Math.max(8, (560 - gap * (n - 1)) / n);
            const callY = base - CAUSE_SHARE_CALL * scale;
            const leadY = base - 0.5 * scale;
            return (
              <>
                <line x1={0} x2={560} y1={leadY} y2={leadY} stroke="#5f6e55" strokeDasharray="3 3" strokeWidth={0.75} opacity={0.6}>
                  <title>the 50% leadership line — past it, non-port deaths OUTNUMBER port inside the era</title>
                </line>
                <line x1={0} x2={560} y1={callY} y2={callY} stroke="#e0a030" strokeDasharray="3 3" strokeWidth={0.75} opacity={0.8}>
                  <title>{`the ${(CAUSE_SHARE_CALL * 100).toFixed(0)}% call (INCLUSIVE) — the same line the drift lane rides; a bar at or over it is an era whose word reads THE FLOOR TAKES TURN`}</title>
                </line>
                {ev.eras.map((v, i) => {
                  const h = Math.max(v.share > 0 ? 1.5 : 0, Math.min(base - top, v.share * scale));
                  const x = i * (bw + gap);
                  const refused = v.word === 'TOO FEW';
                  const turn = v.word === 'THE FLOOR TAKES TURN';
                  const fill = turn ? '#e0a030' : refused ? '#2a3324' : '#5f6e55';
                  const tip = [
                    `ERA #${v.index} (kills #${v.firstSeq}–#${v.lastSeq}, n=${v.n})`,
                    `census ${v.census.map((c) => `${c.reason}×${c.n}`).join(' + ') || 'empty'}`,
                    `non-port ${v.nonPort}/${v.n} = ${(v.share * 100).toFixed(1)}%`,
                    `the word: ${v.word}`,
                    v.marginMin != null
                      ? `carve margin ${v.marginMin.toFixed(1)}′ past the line${v.whisker ? ' (a whisker)' : ''}`
                      : 'opened mid-storm (no margin)',
                  ].join(' · ');
                  return (
                    <g key={v.index}>
                      <title>{tip}</title>
                      <rect
                        x={x}
                        y={base - h}
                        width={bw}
                        height={Math.max(h, 0.75)}
                        rx={1.5}
                        fill={fill}
                        opacity={turn ? 0.95 : refused ? 0.55 : 0.8}
                        stroke={turn ? '#e0a030' : 'none'}
                        strokeWidth={turn ? 1 : 0}
                      />
                      <text
                        x={x + bw / 2}
                        y={base + 9}
                        textAnchor="middle"
                        fontSize={6}
                        fill={turn ? '#e0a030' : refused ? '#5f6e55' : '#c9d4bd'}
                        fontFamily="inherit"
                      >
                        #{v.index}
                      </text>
                      <text
                        x={x + bw / 2}
                        y={base + 17.5}
                        textAnchor="middle"
                        fontSize={5.5}
                        fill={turn ? '#e0a030' : '#5f6e55'}
                        fontFamily="inherit"
                      >
                        {turn ? 'TURN' : refused ? '·' : v.word === 'PORT MONOPOLY' ? 'MONO' : 'RULES'}
                      </text>
                    </g>
                  );
                })}
                <text x={560} y={callY - 2} textAnchor="end" fontSize={5.5} fill="#e0a030" opacity={0.9} fontFamily="inherit">
                  call {(CAUSE_SHARE_CALL * 100).toFixed(0)}%
                </text>
              </>
            );
          })()}
        </svg>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5" aria-hidden>
          <span className="vvu-label text-[6.5px] text-[#e0a030]">
            <span className="inline-block w-2 h-2 rounded-sm bg-[#e0a030]/90 mr-1 align-middle" />
            era reads THE FLOOR TAKES TURN
          </span>
          <span className="vvu-label text-[6.5px] text-[#5f6e55]">
            <span className="inline-block w-2 h-2 rounded-sm bg-[#5f6e55]/80 mr-1 align-middle" />
            port-ruled era
          </span>
          <span className="vvu-label text-[6.5px] text-[#5f6e55]">
            <span className="inline-block w-2 h-2 rounded-sm bg-[#2a3324]/60 mr-1 align-middle" />
            TOO FEW (the share draws, the word refuses — under {CAUSE_MIN_DEATHS})
          </span>
          <span className="vvu-label text-[6.5px] text-[#5f6e55] ml-auto">bar height = the era's non-port share · equal widths (the strip above carries the time scale)</span>
        </div>
      </div>

      {/* THE TABLE */}
      <div className="mt-1.5 overflow-x-auto" data-testid="storm-eras-table">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="vvu-label text-[6.5px] font-bold tracking-[0.14em] text-[#5f6e55]">
              <th className="text-left py-0.5 pr-2 font-bold">ERA</th>
              <th className="text-right py-0.5 px-2 font-bold">KILLS</th>
              <th className="text-left py-0.5 px-2 font-bold">CAUSES</th>
              <th className="text-left py-0.5 px-2 font-bold">WORD</th>
              <th className="text-right py-0.5 px-2 font-bold">OPENED BY</th>
              <th className="text-right py-0.5 px-2 font-bold">SPAN</th>
              <th className="text-right py-0.5 px-2 font-bold">CADENCE</th>
              <th className="text-right py-0.5 px-2 font-bold">MED CEILING</th>
              <th className="text-right py-0.5 px-2 font-bold">MED FLOOR</th>
              <th className="text-right py-0.5 pl-2 font-bold">RATE</th>
            </tr>
          </thead>
          <tbody>
            {read.eras.map((e) => {
              const isCurrent = e.index === read.currentEraIndex;
              const isDeepest = e.index === deepestIdx;
              return (
                <tr
                  key={e.index}
                  tabIndex={0}
                  title={eraTip(e, read.heartbeatMin, read.lullLineMin, ev.eras[e.index - 1])}
                  aria-label={eraTip(e, read.heartbeatMin, read.lullLineMin, ev.eras[e.index - 1])}
                  className={`vvu-label text-[7.5px] tabular-nums outline-none transition-colors duration-150 hover:bg-[#6b8a40]/5 focus-visible:bg-[#6b8a40]/10 ${
                    isCurrent ? 'text-[#c8ff00]' : isDeepest ? 'text-[#e5484d]' : 'text-[#c9d4bd]'
                  }`}
                >
                  <td className="py-0.5 pr-2 font-bold">
                    #{e.index}
                    {isCurrent ? ' ◂ NOW' : isDeepest ? ' ▼ DEEPEST' : ''}
                  </td>
                  <td className="text-right py-0.5 px-2">
                    {e.firstSeq === e.lastSeq ? `#${e.firstSeq}` : `#${e.firstSeq}–#${e.lastSeq}`} · n={e.n}
                  </td>
                  <td className="py-0.5 px-2 whitespace-nowrap">
                    {(eraMixes[e.index - 1] ?? []).map((m, mi) => (
                      <span key={mi} className="font-bold" style={{ color: causeColor(m.cause) }} title={`${m.cause}: ${m.n} of era #${e.index}'s ${e.n} witnessed death(s) — the lens's census, sliced to this era`}>
                        {mi > 0 && <span className="text-[#5f6e55] font-normal"> + </span>}
                        {m.cause === 'avail-critical' ? 'ac' : m.cause}×{m.n}
                      </span>
                    ))}
                  </td>
                  <td className="py-0.5 px-2 whitespace-nowrap">
                    {(() => {
                      const v = ev.eras[e.index - 1];
                      if (!v) return null;
                      const tone = verdictTone(v.word);
                      const toneCls =
                        tone === 'amber'
                          ? 'border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10'
                          : tone === 'cyan'
                            ? 'border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10'
                            : tone === 'sage'
                              ? 'border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10'
                              : 'border-[#3a4530] text-[#5f6e55] bg-black/30';
                      return (
                        <span
                          className={`vvu-label text-[6.5px] font-bold px-1 py-px rounded-sm border ${toneCls} tabular-nums`}
                          title={`${v.word} — ${v.reason}${v.marginMin != null ? ` · carve margin ${v.marginMin.toFixed(1)}′ past the line${v.whisker ? ' (a whisker — the first place a re-carve will show)' : ''}` : ''}`}
                        >
                          {v.word === 'TOO FEW' ? `TOO FEW n=${v.n}` : `${v.word} · ${(v.share * 100).toFixed(0)}%`}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="text-right py-0.5 px-2">
                    {e.openedByGapMin == null ? 'mid-storm' : `${e.openedByGapMin.toFixed(1)}′ lull`}
                  </td>
                  <td className="text-right py-0.5 px-2">{e.spanMin > 0 ? `${e.spanMin.toFixed(1)}′` : '—'}</td>
                  <td className="text-right py-0.5 px-2">{e.medianGapInsideMin != null ? `${e.medianGapInsideMin.toFixed(1)}′` : e.n === 1 ? 'lone strike' : '—'}</td>
                  <td className="text-right py-0.5 px-2">{e.medianCeilingMb != null ? `${e.medianCeilingMb.toFixed(1)} MB` : '—'}</td>
                  <td className="text-right py-0.5 px-2">{e.medianFloorMb != null ? `${e.medianFloorMb.toFixed(1)} MB` : '—'}</td>
                  <td className="text-right py-0.5 pl-2">{e.killsPerHour != null ? `${e.killsPerHour.toFixed(2)}/h` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="vvu-label mt-1.5 text-[7px] leading-relaxed text-[#c9d4bd]" data-testid="storm-eras-read">
        THE READ · {read.note}
      </p>

      {/* R122 — the era verdicts' own read line. */}
      <p className="vvu-label mt-1 text-[7px] leading-relaxed text-[#c9d4bd]" data-testid="storm-eras-verdicts">
        <span className="font-bold text-[#e0a030]">THE ERA VERDICTS</span> · {ev.note}
      </p>
    </div>
  );
}
