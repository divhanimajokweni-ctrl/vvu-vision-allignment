'use client';

// src/components/watchdog/SawtoothReadout.tsx — R109 · THE SAWTOOTH READOUT,
// the breath, measured.
//
// R108 drew the dying minutes; this panel measures what the drawing showed.
// The record's central finding — sawtooth: crossings inside an oscillation,
// not runaways — has had a count (the diamonds, REV·MED) but never a DEPTH.
// For every certified reversal (the death-windows engine's own pivots — the
// cyan dots the cards already draw), the readout measures the SWING: the
// full rise + fall traversal through the pivot, in MB. One reversal = one
// breath's stroke depth; a window's median swing is its representative
// breath; the record's aggregates answer the standing question the shapes
// only gestured at — how hard does the boot breathe before the kernel
// strikes, which window breathed deepest, and is the breath deepening over
// the witnessed era?
//
//   the bars   — one slot per witnessed window in witnessed order; bar
//                height = the window's deepest swing, the mid-line marker =
//                its median; hollow slots = windows that cannot breathe or
//                certified none (a climb or flat died without oscillating —
//                zero is a reading, the slot stays)
//   the caps   — the record's deepest swing wears the rose cap and names
//                its kill
//   the trend  — OLS over per-window median breath vs witnessed index,
//                dashed: amber DEEPENING / cyan SHALLOWING / neutral FLAT
//                (±10 MB/window strict — the same strict-inequality grammar
//                the opening drift uses); refused below 4 breathing windows
//                (TOO FEW — no line, no word invented)
//
// THE READ is the engine's own note, verbatim.

import { useMemo } from 'react';

import { deathWindows } from '@/lib/death-windows';
import { parseGuardianStampMs } from '@/components/watchdog/MemoryPressure';
import type { RailProjectionPayload } from '@/lib/operator-projection';
import { sawtoothReadout, SWING_TREND_MB_PER_WINDOW } from '@/lib/sawtooth';
import type { BreathWindowRead, SawtoothRead } from '@/lib/sawtooth';

const SAGE = '#c8ff00';
const SAGE_DIM = 'rgba(200,255,0,0.35)';
const CYAN = '#00d4e0';
const ROSE = '#e5484d';
const AMBER = '#e0a030';
const NEUTRAL = '#7a8a6e';

function fmt1(v: number | null): string {
  return v == null ? '—' : `${Math.round(v * 10) / 10}`;
}

function signed(v: number | null): string {
  return v == null ? '—' : `${v >= 0 ? '+' : ''}${Math.round(v * 100) / 100}`;
}

const TREND_META: Record<SawtoothRead['trend'], { color: string; word: string }> = {
  deepening: { color: AMBER, word: 'DEEPENING' },
  shallowing: { color: CYAN, word: 'SHALLOWING' },
  flat: { color: NEUTRAL, word: 'FLAT' },
  'too-few': { color: NEUTRAL, word: 'TOO FEW' },
};

const W = 520;
const H = 64;
const PAD_L = 10;
const PAD_R = 10;
const PAD_T = 8;
const PAD_B = 12;

export function SawtoothReadout({ projection }: { projection: RailProjectionPayload }) {
  const { witnessed, witnessWindows } = projection;
  const read = useMemo(() => {
    if (!witnessed || witnessed.length === 0) return null;
    const dw = deathWindows(
      witnessed.map((k) => ({
        at: k.at,
        atMs: typeof k.atMs === 'number' && Number.isFinite(k.atMs) ? k.atMs : null,
        witness: Array.isArray(k.witness) ? k.witness : [],
      })),
      witnessWindows ?? [],
      parseGuardianStampMs,
    );
    return sawtoothReadout(dw.windows);
  }, [witnessed, witnessWindows]);

  if (!read) return null;

  const n = read.windows.length;
  const maxDeep = Math.max(
    1,
    ...read.windows.map((w) => w.deepestSwingMb ?? 0),
  );
  const yMb = (v: number) => PAD_T + (1 - v / maxDeep) * (H - PAD_T - PAD_B);
  const slotW = (W - PAD_L - PAD_R) / Math.max(1, n);
  const xOf = (i: number) => PAD_L + (n === 1 ? slotW / 2 : (i + 0.5) * slotW);
  const barW = Math.max(3, Math.min(18, slotW * 0.55));

  const baseline = H - PAD_B;

  // the OLS trend line, drawn between the first and last breathing window
  const trendMeta = TREND_META[read.trend];
  const breathers = read.windows.filter((w) => w.medianSwingMb != null);
  const trendLine =
    read.slopeMbPerWindow != null && breathers.length >= 2
      ? (() => {
          const first = breathers[0]!;
          const last = breathers[breathers.length - 1]!;
          const avgX = breathers.reduce((a, w) => a + w.index, 0) / breathers.length;
          const avgY = breathers.reduce((a, w) => a + (w.medianSwingMb as number), 0) / breathers.length;
          const intercept = avgY - read.slopeMbPerWindow! * avgX;
          const yAt = (idx: number) => yMb(Math.max(0, read.slopeMbPerWindow! * idx + intercept));
          return (
            <line
              x1={xOf(first.index)}
              y1={yAt(first.index)}
              x2={xOf(last.index)}
              y2={yAt(last.index)}
              stroke={trendMeta.color}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.85}
            >
              <title>{`per-window median breath vs witnessed index: OLS slope ${signed(read.slopeMbPerWindow)} MB/window · R² ${read.r2} — ${trendMeta.word} (±${SWING_TREND_MB_PER_WINDOW} strict)`}</title>
            </line>
          );
        })()
      : null;

  const deepestIdx = read.deepestIndex;

  return (
    <div className="mt-1.5 rounded-sm border border-[#3a4530]/60 bg-black/20 p-2 transition-colors duration-200 hover:border-[#4a5a3e]" data-testid="sawtooth-readout">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p
          className="vvu-label text-[7.5px] font-bold tracking-[0.18em] text-[#7a8a6e]"
          title={`the sawtooth's depth, measured from the death-windows engine's own certified pivots — one swing = one reversal's full rise + fall traversal in MB (nothing qualifies here that did not qualify there: the legs already cleared the witness engine's reversal delta). The bars are each window's DEEPEST swing with its median as the mid-line; hollow slots are windows that cannot breathe or certified none — zero is a reading. The dashed line is the OLS over per-window median breath vs witnessed index (±${SWING_TREND_MB_PER_WINDOW} MB/window strict; refused below ${4} breathing windows).`}
        >
          THE SAWTOOTH READOUT · THE BREATH, MEASURED
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <span
            className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10 tabular-nums cursor-help transition-[filter,border-color] hover:brightness-125"
            title={`${read.breathers} of the ${read.breatheCapable} windows that can carry reversals certified at least one (both legs ≥ 5 MB); ${n - read.breatheCapable} cannot breathe (thin / no-rss)`}
          >
            {read.breathers}/{read.breatheCapable} BREATHERS
          </span>
          <span
            className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10 tabular-nums cursor-help transition-[filter,border-color] hover:brightness-125"
            title={`${read.swingsTotal} certified swings across the record — one per reversal, the rise and the fall both certified`}
          >
            {read.swingsTotal} SWINGS
          </span>
          {read.medianSwingMb != null && (
            <span
              className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#3a4530] text-[#c9d4bd] bg-black/30 tabular-nums cursor-help transition-[filter,border-color] hover:brightness-125"
              title={`median swing over ALL ${read.swingsTotal} certified swings`}
            >
              MEDIAN {fmt1(read.medianSwingMb)} MB
            </span>
          )}
          {read.deepestSwingMb != null && (
            <span
              className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10 tabular-nums cursor-help transition-[filter,border-color] hover:brightness-125"
              title={`the deepest single breath on record: ${fmt1(read.deepestSwingMb)} MB (rise ${signed(read.deepestRiseMb)} + fall ${signed(read.deepestFallMb)}) in kill #${String((read.deepestIndex ?? 0) + 1).padStart(2, '0')}'s window (${read.deepestAt})`}
            >
              DEEPEST {fmt1(read.deepestSwingMb)} MB ·#{String((read.deepestIndex ?? 0) + 1).padStart(2, '0')}
            </span>
          )}
          <span
            className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border tabular-nums cursor-help transition-[filter,border-color] hover:brightness-125"
            style={{ borderColor: `${trendMeta.color}66`, color: trendMeta.color, backgroundColor: 'rgba(0,0,0,0.3)' }}
            title={
              read.slopeMbPerWindow != null
                ? `per-window median breath vs witnessed index — OLS slope ${signed(read.slopeMbPerWindow)} MB/window · R² ${read.r2} · halves ${fmt1(read.firstHalfMedianMb)} → ${fmt1(read.lastHalfMedianMb)} MB — ${trendMeta.word} (±${SWING_TREND_MB_PER_WINDOW} strict)`
                : `slope refused — fewer than 4 breathing windows on record (too-few); the halves ${fmt1(read.firstHalfMedianMb)} → ${fmt1(read.lastHalfMedianMb)} MB travel without a line`
            }
          >
            {read.slopeMbPerWindow != null
              ? `BREATH ${trendMeta.word} ${signed(read.slopeMbPerWindow)} MB/WIN`
              : `BREATH ${trendMeta.word}`}
          </span>
        </div>
      </div>

      {/* the strip — one slot per witnessed window, deepest swing as the bar */}
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1.5 w-full [&_rect]:cursor-help [&_line]:cursor-help [&_circle]:cursor-help" role="img" aria-label="per-window deepest sawtooth swing" data-testid="sawtooth-readout-strip">
        <line x1={PAD_L} x2={W - PAD_R} y1={baseline} y2={baseline} stroke="#3a4530" strokeWidth={0.8} />
        {read.windows.map((w) => {
          const isDeepest = w.index === deepestIdx && w.deepestSwingMb != null;
          const tooltip = `KILL #${String(w.index + 1).padStart(2, '0')} · ${w.at} UTC — shape ${w.shapeKind?.toUpperCase() ?? 'UNKNOWN'} · draw ${w.drawKind.toUpperCase()} · ${w.canBreathe ? `can breathe (${w.swingCount} swing${w.swingCount === 1 ? '' : 's'})` : 'cannot breathe (fewer than 3 finite rss samples)'}${w.medianSwingMb != null ? ` · median breath ${fmt1(w.medianSwingMb)} MB · deepest ${fmt1(w.deepestSwingMb)} MB${w.envelopeMb != null ? ` · envelope ${fmt1(w.envelopeMb)} MB` : ''}` : ' · no certified swing — a climb or flat died without oscillating (zero is a reading)'}`;
          if (w.deepestSwingMb == null) {
            return (
              <g key={`sr-${w.at}`}>
                <line x1={xOf(w.index)} x2={xOf(w.index)} y1={baseline - 2.5} y2={baseline + 2.5} stroke={NEUTRAL} strokeWidth={1} opacity={0.6}>
                  <title>{tooltip}</title>
                </line>
              </g>
            );
          }
          const yTop = yMb(w.deepestSwingMb);
          const yMed = w.medianSwingMb != null ? yMb(w.medianSwingMb) : null;
          return (
            <g key={`sr-${w.at}`}>
              <rect
                x={xOf(w.index) - barW / 2}
                y={yTop}
                width={barW}
                height={Math.max(1, baseline - yTop)}
                fill={isDeepest ? 'rgba(229,72,77,0.28)' : 'rgba(200,255,0,0.14)'}
                stroke={isDeepest ? ROSE : SAGE_DIM}
                strokeWidth={0.8}
              >
                <title>{tooltip}</title>
              </rect>
              {yMed != null && (
                <line x1={xOf(w.index) - barW / 2} x2={xOf(w.index) + barW / 2} y1={yMed} y2={yMed} stroke={SAGE} strokeWidth={1} opacity={0.9}>
                  <title>{`median breath ${fmt1(w.medianSwingMb)} MB — the window's representative stroke`}</title>
                </line>
              )}
              {isDeepest && (
                <line x1={xOf(w.index) - barW / 2 - 1.5} x2={xOf(w.index) + barW / 2 + 1.5} y1={yTop} y2={yTop} stroke={ROSE} strokeWidth={1.4}>
                  <title>{`the record's deepest breath: ${fmt1(read.deepestSwingMb)} MB (rise ${signed(read.deepestRiseMb)} + fall ${signed(read.deepestFallMb)})`}</title>
                </line>
              )}
            </g>
          );
        })}
        {trendLine}
        <text x={PAD_L} y={PAD_T + 5} className="vvu-label" fontSize={6} fill={NEUTRAL}>
          {`0–${Math.round(maxDeep)} MB SWING`}
        </text>
        <text x={W - PAD_R} y={H - 2} textAnchor="end" className="vvu-label" fontSize={6} fill="#5f6e55">
          {`${n} WINDOWS · WITNESSED ORDER →`}
        </text>
      </svg>

      <p className="vvu-label mt-1.5 text-[7px] leading-relaxed text-[#7a8a6e]" data-testid="sawtooth-readout-read">
        <span className="font-bold text-[#00d4e0]">THE READ · </span>
        {read.note}
      </p>
    </div>
  );
}

export type { BreathWindowRead };
