'use client';

// src/components/watchdog/LivingRead.tsx — R101 · THE LIVING READ, the warm
// boot vs the death zone.
//
// The ceiling strip (R100) drew the DEAD: where every witnessed kill's
// window topped out. This panel places the LIVING boot beside them — the
// guardian's own ring-buffer series (~90 passes at 20s ≈ a 30-minute
// window) against the witnessed ceiling band, in one arithmetic read:
// where the ride sits (below / inside / above the band), what phase it is
// in (warming / cooling / riding, at the witness windows' own 15 MB/min
// calibration), how many real reversals the ride has taken, and the next
// guard line ABOVE — reported in MB, never in minutes, because an ETA
// would be a slope extrapolated into a future nobody has witnessed.
//
// Every absence renders as a dash or an honest wait state (the R75
// contract); the series is the guardian's window, not the boot's biography
// — a bounce inside it shows as the drop it was, never smoothed away.

import { ceilingDistribution } from '@/lib/witness-windows';
import { warmCurveRead, type WarmPhase, type WarmPosition } from '@/lib/warm-curve';
import type { RailProjectionPayload } from '@/lib/operator-projection';

interface LivingReadProps {
  projection?: RailProjectionPayload | null;
  series?: Array<{ t: string; rssKb: number | null; availKb: number | null }> | null;
  guardMb?: number | null;
}

const PHASE_CHIP: Record<string, { label: string; cls: string }> = {
  warming: { label: 'WARMING', cls: 'border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10' },
  cooling: { label: 'COOLING', cls: 'border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10' },
  riding: { label: 'RIDING', cls: 'border-[#3a4530] text-[#7a8a6e] bg-black/30' },
};

const POSITION_CHIP: Record<string, { label: string; cls: string }> = {
  'below-the-dead': { label: 'BELOW THE DEAD', cls: 'border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10' },
  'inside-the-death-zone': { label: 'INSIDE THE DEATH ZONE', cls: 'border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10' },
  'above-the-dead': { label: 'ABOVE THE DEAD', cls: 'border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10' },
};

export function LivingRead({ projection, series, guardMb }: LivingReadProps) {
  if (!projection || !projection.witnessed || projection.witnessed.length === 0) return null;
  if (!series || series.length < 2) return null;

  const guardLevels = projection.scenarios
    .filter((s) => s.kind === 'guard')
    .map((s) => s.levelMb)
    .sort((a, b) => a - b);
  const ceiling = ceilingDistribution(
    projection.witnessed.map((k) => ({ at: k.at, atMs: k.atMs, maxRssMb: k.maxRssMb })),
    projection.witnessWindows,
    guardLevels,
    guardMb ?? null,
  );
  if (ceiling.judged === 0) return null; // no band, no read — the strip waits

  const band = { min: ceiling.minCeilingMb!, max: ceiling.maxCeilingMb! };
  const read = warmCurveRead(series, guardLevels, band);
  if (read.currentMb == null) return null;

  // chart frame: the ride, the band, the menu — whoever reaches further
  const W = 520;
  const H = 56;
  const pad = 12;
  const levels = [...guardLevels, ...(guardMb != null ? [guardMb] : []), band.min, band.max, read.minMb!, read.maxMb!];
  const lo = Math.floor((Math.min(...levels) - 40) / 50) * 50;
  const hi = Math.ceil((Math.max(...levels) + 40) / 50) * 50;
  const span = hi - lo || 1;
  const x = (v: number) => pad + ((v - lo) / span) * (W - 2 * pad);

  // the ride: finite rss samples only, x by index (20s cadence — the same
  // convention the witness sparks keep), null samples lift the pen
  const xy: Array<{ x: number; y: number } | null> = series.map((s, i) => {
    if (typeof s.rssKb !== 'number' || !Number.isFinite(s.rssKb)) return null;
    return {
      x: (i / (series.length - 1)) * (W - 2 * pad) + pad,
      y: 6 + (1 - (s.rssKb / 1024 - lo) / span) * (H - 12),
    };
  });
  const subPaths: string[] = [];
  let cur: string[] = [];
  for (const p of xy) {
    if (p == null) {
      if (cur.length >= 2) subPaths.push(cur.join(' '));
      cur = [];
    } else {
      cur.push(`${cur.length === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
    }
  }
  if (cur.length >= 2) subPaths.push(cur.join(' '));
  const lastPt = xy.filter((p): p is { x: number; y: number } => p != null).slice(-1)[0];

  const bandLo = x(band.min);
  const bandHi = x(band.max);
  const nextAbove = read.nextGuardAboveMb;

  const phase = PHASE_CHIP[read.phase ?? 'riding'];
  const position = POSITION_CHIP[read.position ?? 'below-the-dead'];
  const hhmm = (ms: number) => new Date(ms).toISOString().slice(11, 19);

  return (
    <div
      className="relative overflow-hidden rounded-sm border border-[#00d4e0]/20 bg-black/20 px-2.5 py-2 transition-colors duration-200 hover:border-[#4a5a3e]"
      data-testid="living-read"
      title="R101 — THE LIVING READ: the ceiling strip drew the dead (each witnessed kill's in-window peak rss); this panel places the guardian's own ring-buffer series — the warm boot's ride over the last ~30 minutes at 20s sampling — beside the dead's band. Position (below/inside/above), phase (warming/cooling/riding at the witness windows' own 15 MB/min calibration), real reversals, and the next guard line ABOVE in MB — never an ETA, because a minute-estimate would be a slope extrapolated into a future nobody has witnessed. All arithmetic, no prophecy."
    >
      <p className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#00d4e0]/80 inline-flex items-center gap-1.5">
        THE LIVING READ · THE WARM BOOT vs THE DEATH ZONE
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 h-auto w-full [&_rect]:cursor-help [&_circle]:cursor-help [&_line]:cursor-help [&_path]:cursor-help"
        role="img"
        aria-label={`the living boot rides ${read.currentMb} MB, ${read.position ?? 'unpositioned'} vs the witnessed ceiling band ${band.min} to ${band.max} MB`}
      >
        {/* the death zone — where the dead topped out */}
        <rect x={bandLo} y={8} width={Math.max(1, bandHi - bandLo)} height={H - 16} fill="#e5484d" opacity={0.09} />
        <line x1={bandLo} y1={8} x2={bandLo} y2={H - 8} stroke="#e5484d" strokeWidth={1} opacity={0.4} strokeDasharray="2 2" />
        <line x1={bandHi} y1={8} x2={bandHi} y2={H - 8} stroke="#e5484d" strokeWidth={1} opacity={0.4} strokeDasharray="2 2" />
        {/* guard lines — dim here; the ceiling strip owns their verdict tones */}
        {guardLevels.map((g) => (
          <line key={`lr-g-${g}`} x1={x(g)} y1={6} x2={x(g)} y2={H - 6} stroke="#3a4530" strokeWidth={1} opacity={g === nextAbove ? 0.8 : 0.45} strokeDasharray={g === nextAbove ? undefined : '3 3'} />
          ))}
        {/* the armed guard, solid */}
        {guardMb != null && (
          <line x1={x(guardMb)} y1={6} x2={x(guardMb)} y2={H - 6} stroke="#e5484d" strokeWidth={1.5} opacity={0.7} />
        )}
        {/* the ride */}
        {subPaths.map((d, i) => (
          <path key={`lr-ride-${i}`} d={d} fill="none" stroke="#e5484d" strokeWidth={1.5} />
        ))}
        {/* the current position */}
        {lastPt && <circle cx={lastPt.x} cy={lastPt.y} r={2.6} fill="#e5484d" stroke="black" strokeWidth={0.5} />}
        {lastPt && (
          <title>{`RIDE ${hhmm(Date.now())}Z — ${read.currentMb} MB · ${read.position?.toUpperCase() ?? '—'} · next line above ${nextAbove ?? '—'}${read.nextGuardGapMb != null ? ` (+${read.nextGuardGapMb} MB)` : ''}`}</title>
        )}
      </svg>

      {/* the legend — HTML chips, 390px-safe */}
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#e5484d]/50 text-[#e5484d] bg-[#e5484d]/5 tabular-nums cursor-help transition-[filter,border-color] hover:brightness-125" title="the last finite rss sample — where the ride is right now">
          RIDE {read.currentMb} MB
        </span>
        <span className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${position.cls}`} title="the ride vs the witnessed ceiling band: below it (every witnessed death topped out higher), inside it (the same band where the dead topped out), or above it">
          {position.label}
          {read.bandMarginMb != null && read.position !== 'inside-the-death-zone' ? ` · ${Math.abs(read.bandMarginMb)} MB` : ''}
        </span>
        {read.phase != null && (
          <span className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${phase.cls}`} title={`the recent drift (last 10 min, OLS): ${read.recentSlopeMbPerMin} MB/min — warming/cooling at the witness windows' own ±15 MB/min calibration, riding inside it. The full-window slope reads ${read.fullSlopeMbPerMin} MB/min — the recent read must not hide from it.`}>
            {phase.label} {read.recentSlopeMbPerMin != null ? `${read.recentSlopeMbPerMin! > 0 ? '+' : ''}${read.recentSlopeMbPerMin}` : ''} MB/MIN
          </span>
        )}
        <span className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#3a4530] text-[#7a8a6e] bg-black/30 tabular-nums" title={`real reversals in the recent tail (steps ≥ the witness windows' 5 MB floor) — the same sawtooth test the dead's windows took, scoped so a bounce's transition noise cannot flood it. The full window (${read.spanMin} min) reads ${read.reversals} reversal(s) including any bounce.`}>
          {read.recentReversals ?? read.reversals} REVERSAL{(read.recentReversals ?? read.reversals) === 1 ? '' : 'S'} · 10M
        </span>
        {nextAbove != null && (
          <span className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#00d4e0]/40 text-[#00d4e0] bg-[#00d4e0]/5 tabular-nums" title={`the smallest guard line above the current ride — reported in MB only: an ETA would be a slope extrapolated into a future nobody has witnessed`}>
            NEXT GUARD {nextAbove} · +{read.nextGuardGapMb} MB
          </span>
        )}
      </div>

      {/* THE READ — the engine's own sentence, plus the window disclosure */}
      <p className="mt-1 text-[9px] leading-relaxed text-[#c9d4bd] rounded-sm border border-[#3a4530]/60 bg-black/20 px-2 py-1">
        {read.note}. The living window is the guardian&apos;s ~30-minute ring buffer (20s sampling); the dead&apos;s
        band is the full witnessed record ({ceiling.judged} ceilings, {band.min}–{band.max} MB). A bounce inside the
        window shows as the drop it was. Nothing here predicts — everything measures.
      </p>
    </div>
  );
}
