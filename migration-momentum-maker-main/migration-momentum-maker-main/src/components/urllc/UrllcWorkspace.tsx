'use client';

// src/components/urllc/UrllcWorkspace.tsx — Round 28 · URLLC+ NEURAL EDGE.
// The seventh hash projection (#/urllc), built from the paper "Technical
// Comparative Analysis of Deep Learning Paradigms for 6G URLLC Systems".
// Each paper pillar mapped to something REAL in this sandbox:
//   §0 NTN PASS TRACK       — deterministic LEO pass (h=550 km, v=7.5 km/s)
//                             polled every 3 s from /api/vvu/urllc; elevation,
//                             slant, live Doppler (computed ±458 kHz max vs
//                             TR 38.811 ±480 kHz), bent-pipe vs regenerative
//                             RTT, S&F buffering below horizon (paper §1).
//   §1 DTL TRANSFER LAB     — the paper's FNN (40→800×4→20) with S₀/S₁ frozen
//                             layers, sample slider, server-recomputed run
//                             verdict + exact parameter/FLOP arithmetic (§2).
//   §2 PRIMAL-DUAL LAB      — finite-blocklength resource boundary + dual-
//                             priced admission + QoS shadow prices λₖ,
//                             committed server-side with WORM (§3).
//   §3 DOPPLER/WAVEFORM LAB — CP-OFDM/OTFS/AFDM/OCDM BLER at the live ε_d,
//                             TDL-A/TDL-C toggle, scheduler packet-loss
//                             matrix (KA-DDPG-T-DRL vs DDPG) (§4).
//   §4 DEPLOYMENT MATRIX    — the paper's paradigm comparison table (§5).
// SECURITY POSTURE (unchanged since Round 17/18): every committed run is
// RECOMPUTED SERVER-SIDE (/api/vvu/urllc → src/lib/urllc.ts); client-side
// calls into the pure module are advisory previews only; every commit
// appends a WORM event (source 'URLLC').

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  Brain,
  ChevronRight,
  Cpu,
  Database,
  FlaskConical,
  Gauge,
  Loader2,
  RadioTower,
  Sigma,
  Satellite,
  Snowflake,
  Waves,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Chip,
  HttpError,
  LiveDot,
  QueryErrorCard,
  ScadaPolishStyles,
  SectionHeader,
  SectionReveal,
  useQueryErrorToast,
} from '@/components/analytics/shared';
import { dtlAccuracy, DTL_TARGET_ETA, type TimeWarp, type TdlChannel } from '@/lib/urllc';
import { useSendWormLog } from '@/hooks/use-vvu-socket';
import type {
  UrllcDtlRunResponse,
  UrllcOptRunResponse,
  UrllcResponse,
} from '@/types/vvu';

const URLLC_TEAL = '#2ea8a0';
const OPT_USER_DEFAULTS = [
  { snrDb: 10, demandBits: 24 },
  { snrDb: 8, demandBits: 16 },
  { snrDb: 6, demandBits: 16 },
  { snrDb: 4, demandBits: 12 },
  { snrDb: 2, demandBits: 8 },
  { snrDb: 0, demandBits: 8 },
];
const DTL_STEPS = [10, 50, 100, 300, 1000, 3000, 5000, 10000, 20000] as const;

// ─── Round 28 scoped CSS (vvu28-*) ───────────────────────────────────────────

function UrllcStyles() {
  return (
    <style>{`
/* headline number glow — URLLC teal */
.vvu28-glow { text-shadow: 0 0 18px rgba(46,168,160,0.5); }

/* pass-track arc satellite dot — soft pulse */
.vvu28-sat-dot { animation: vvu28Pulse 2.4s ease-in-out infinite; transform-origin: center; }
@keyframes vvu28Pulse { 0%,100% { opacity: 0.85; } 50% { opacity: 0.45; } }

/* frozen FNN layers — slow frost shimmer (reduced-motion safe) */
.vvu28-frozen { background-image: repeating-linear-gradient(115deg, rgba(143,179,90,0.05) 0 6px, transparent 6px 12px); }
.vvu28-trainable { background-image: repeating-linear-gradient(115deg, rgba(200,255,0,0.10) 0 6px, transparent 6px 12px); }

/* deferred user row — amber heartbeat while λ climbs */
.vvu28-deferred { animation: vvu28Defer 1.8s ease-in-out infinite; }
@keyframes vvu28Defer {
  0%,100% { border-color: rgba(224,160,48,0.35); }
  50% { border-color: rgba(224,160,48,0.9); box-shadow: 0 0 10px rgba(224,160,48,0.25); }
}

/* S&F buffering chip — database drip */
.vvu28-sfn { animation: vvu28Sfn 2.6s ease-in-out infinite; }
@keyframes vvu28Sfn { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }

/* meter track + fill (mirrors vvu28-meter, self-contained this round) */
.vvu28-meter { height: 6px; border-radius: 3px; background: #131811; border: 1px solid rgba(107,138,64,0.2); overflow: hidden; }
.vvu28-meter-fill { height: 100%; border-radius: 3px; }

/* range inputs — lime accent, 44px hit target */
.vvu28-range { accent-color: #c8ff00; min-height: 44px; width: 100%; cursor: pointer; }

/* bler bar transition */
.vvu28-bler { transition: width 700ms ease-out; height: 100%; border-radius: 3px; }

@media (prefers-reduced-motion: reduce) {
  .vvu28-sat-dot, .vvu28-deferred, .vvu28-sfn { animation: none !important; }
  .vvu28-bler { transition: none !important; }
}
`}</style>
  );
}

// ─── shared small pieces ─────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  unit,
  tone = 'teal',
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'teal' | 'lime' | 'amber' | 'crimson' | 'dim';
  sub?: string;
}) {
  const color =
    tone === 'lime'
      ? '#c8ff00'
      : tone === 'amber'
        ? '#e0a030'
        : tone === 'crimson'
          ? '#e5484d'
          : tone === 'dim'
            ? '#7a8a6e'
            : URLLC_TEAL;
  return (
    <div className="vvu-panel-solid p-3 sm:p-4 min-w-0">
      <div className="vvu-label text-[8px] sm:text-[9px] text-[#7a8a6e] tracking-[0.14em] truncate">
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5 min-w-0">
        <span
          className="text-lg sm:text-2xl font-bold tabular-nums vvu28-glow truncate"
          style={{ color }}
        >
          {value}
        </span>
        {unit && <span className="vvu-label text-[9px] text-[#7a8a6e] shrink-0">{unit}</span>}
      </div>
      {sub && <div className="vvu-label text-[7px] sm:text-[8px] text-[#5a684e] mt-1 truncate">{sub}</div>}
    </div>
  );
}

function fmtHz(hz: number): string {
  const a = Math.abs(hz);
  if (a >= 1e6) return `${(hz / 1e6).toFixed(2)} MHz`;
  if (a >= 1e3) return `${(hz / 1e3).toFixed(1)} kHz`;
  return `${hz.toFixed(0)} Hz`;
}

function fmtEps(e: number): string {
  if (e <= 0 || !Number.isFinite(e)) return '—';
  if (e >= 1e-3) return `${(e * 100).toFixed(2)} %`;
  return e.toExponential(1);
}

/** BLER bar width on a log10 scale from 1e-9 (empty) to 1 (full). */
function blerPct(bler: number): number {
  const v = Math.min(Math.max(bler, 1e-9), 1);
  return ((Math.log10(v) + 9) / 9) * 100;
}

// ─── pass track arc (SVG) ────────────────────────────────────────────────────

function PassTrackArc({ elevation, inPass, phase }: { elevation: number; inPass: boolean; phase: number }) {
  // satellite position along the visible arc: phase 0=rise, 0.5=zenith, 1=set
  const t = Math.min(Math.max(phase * 2, 0), 1); // 0..1 across the pass half
  const angle = Math.PI * (1 - t); // π (left) → 0 (right)
  const R = 78;
  const cx = 100;
  const cy = 92;
  const sx = cx + R * Math.cos(angle);
  const sy = cy - R * Math.sin(angle);
  const dopplerLeft = phase < 0.5; // approaching half of the pass
  return (
    <svg viewBox="0 0 200 104" className="w-full h-auto max-w-[340px]" role="img" aria-label={`LEO pass track — elevation ${elevation.toFixed(0)} degrees`}>
      <path
        d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
        fill="none"
        stroke="rgba(107,138,64,0.35)"
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />
      {/* earth chord */}
      <line x1={cx - R - 8} y1={cy} x2={cx + R + 8} y2={cy} stroke="rgba(107,138,64,0.55)" strokeWidth="2" />
      {/* range line */}
      {inPass && (
        <line x1={cx} y1={cy} x2={sx} y2={sy} stroke="rgba(46,168,160,0.5)" strokeWidth="1" strokeDasharray="2 2" />
      )}
      {/* satellite */}
      {inPass ? (
        <g className="vvu28-sat-dot">
          <circle cx={sx} cy={sy} r="4.5" fill="#c8ff00" />
          <circle cx={sx} cy={sy} r="8" fill="none" stroke="rgba(200,255,0,0.35)" strokeWidth="1" />
        </g>
      ) : (
        <g className="vvu28-sfn">
          <circle cx={cx + R + 14} cy={cy - 6} r="4" fill="#e0a030" />
        </g>
      )}
      {/* zenith tick */}
      <line x1={cx} y1={cy - R - 4} x2={cx} y2={cy - R + 4} stroke="rgba(143,179,90,0.6)" strokeWidth="1.5" />
      <text x="10" y="102" fontSize="7" fill="#7a8a6e" fontFamily="monospace">RISE</text>
      <text x="170" y="102" fontSize="7" fill="#7a8a6e" fontFamily="monospace">SET</text>
      <text x={cx - 14} y={cy + 10} fontSize="7" fill="#5a684e" fontFamily="monospace">
        {inPass ? `θ ${elevation.toFixed(0)}°` : 'BELOW'}
      </text>
      {inPass && (
        <text x={cx + 8} y={cy - 26} fontSize="7" fill={dopplerLeft ? '#2ea8a0' : '#e0a030'} fontFamily="monospace">
          {dopplerLeft ? 'APPROACH +' : 'RECEDE −'}
        </text>
      )}
    </svg>
  );
}

// ─── main workspace ──────────────────────────────────────────────────────────

export function UrllcWorkspace() {
  const sendWormLog = useSendWormLog();
  const [warp, setWarp] = useState<TimeWarp>(10);
  const [channel, setChannel] = useState<TdlChannel>('TDL-A');
  const [samples, setSamples] = useState<number>(100);
  const [marginPct, setMarginPct] = useState<number>(2);
  const [users, setUsers] = useState<Array<{ snrDb: number; demandBits: number }>>(OPT_USER_DEFAULTS);

  const { data, isError, error, refetch, isPending } = useQuery<UrllcResponse, HttpError>({
    queryKey: ['urllc-snapshot', warp, channel],
    queryFn: async () => {
      const res = await fetch('/api/vvu/urllc?warp=' + warp + '&channel=' + channel);
      if (!res.ok) throw new HttpError(`URLLC snapshot failed (${res.status})`, res.status);
      return (await res.json()) as UrllcResponse;
    },
    refetchInterval: 3000,
  });
  useQueryErrorToast(isError, error, 'URLLC snapshot');

  const optRun = useMutation<UrllcOptRunResponse, HttpError, void>({
    mutationFn: async () => {
      const res = await fetch('/api/vvu/urllc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'opt_run', users, marginPct }),
      });
      if (!res.ok) throw new HttpError(`optimizer run failed (${res.status})`, res.status);
      return (await res.json()) as UrllcOptRunResponse;
    },
    onSuccess: (res) => {
      toast.success('PRIMAL-DUAL RUN COMMITTED', {
        description: `ΣB ${(res.run.totalBwHz / 1e3).toFixed(0)} kHz · WORM #${res.wormSeq} · server-recomputed`,
      });
    },
    onError: (e) => toast.error('OPTIMIZER RUN FAILED', { description: e.message }),
  });

  const dtlRun = useMutation<UrllcDtlRunResponse, HttpError, void>({
    mutationFn: async () => {
      const res = await fetch('/api/vvu/urllc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dtl_run', samples }),
      });
      if (!res.ok) throw new HttpError(`DTL run failed (${res.status})`, res.status);
      return (await res.json()) as UrllcDtlRunResponse;
    },
    onSuccess: (res) => {
      toast.success('DTL S₁ RUN COMMITTED', {
        description: `η=${res.authoritative.dtl.toFixed(3)} · WORM #${res.wormSeq} · server-recomputed`,
      });
    },
    onError: (e) => toast.error('DTL RUN FAILED', { description: e.message }),
  });

  const snap = data?.snapshot;
  const pass = snap?.pass;

  const handleWarp = (w: TimeWarp) => {
    if (w === warp) return;
    sendWormLog('URLLC_TIME_WARP', 'URLLC', `pass clock ×${warp} → ×${w}`);
    setWarp(w);
    toast(`PASS CLOCK ×${w}`, { description: 'deterministic orbit clock rescaled' });
  };

  const handleChannel = (c: TdlChannel) => {
    if (c === channel) return;
    sendWormLog('URLLC_CHANNEL', 'URLLC', `waveform lab ${channel} → ${c}`);
    setChannel(c);
    toast(`CHANNEL ${c}`, {
      description: c === 'TDL-C' ? 'LOS · +6 dB offset' : 'NLOS · −4 dB offset',
    });
  };

  const advisoryDtl = snap
    ? { scratch: dtlAccuracy('scratch', samples), dtl: dtlAccuracy('dtl', samples) }
    : null;

  if (isPending) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#060806]">
        <div className="text-center">
          <Loader2 className="size-6 text-[#2ea8a0] animate-spin mx-auto" aria-hidden />
          <div className="vvu-label text-[9px] text-[#7a8a6e] mt-3 animate-pulse">
            LOADING URLLC+ NEURAL EDGE · PASS STATE…
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="absolute inset-0 overflow-y-auto">
        <ScadaPolishStyles />
        <div className="max-w-[720px] mx-auto px-4 py-10">
          <QueryErrorCard label="URLLC SNAPSHOT" onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  if (!snap || !pass) return null;
  const meta = snap.meta;

  return (
    <div className="absolute inset-0 overflow-y-auto custom-scroll">
      <ScadaPolishStyles />
      <UrllcStyles />

      <div className="max-w-[1320px] mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-5 sm:space-y-6 pb-24">
        {/* ── headline + live pass strip ── */}
        <SectionReveal featured>
          <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="urllc headline">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="min-w-0">
                <h1 className="vvu-label text-lg sm:text-2xl font-bold text-[#f3e38a] tracking-[0.14em]">
                  URLLC+ NEURAL EDGE · 6G DL PARADIGMS
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <Chip tone="teal">URLLC+ · EXTREME CONNECTIVITY</Chip>
                  <Chip tone="dim" dashed>
                    ROUTE 7 · #/URLLC
                  </Chip>
                  <Chip tone="lime">
                    <LiveDot /> PASS LIVE · {pass.inPass ? 'VISIBLE' : 'S&F BUFFER'}
                  </Chip>
                </div>
                <p className="text-[11px] sm:text-xs text-[#8a9a7e] mt-3 max-w-[70ch] leading-relaxed">
                  Comparative analysis of deep learning paradigms for 6G URLLC — supervised DTL
                  transfer, unsupervised Lagrangian primal-dual optimization, and
                  knowledge-assisted DRL — projected onto a deterministic LEO pass
                  (v<sub>sat</sub> = {meta.vSatKms} km/s, Ka-band {meta.kaFcGhz} GHz).
                </p>
              </div>
              <div className="shrink-0 flex flex-col items-center gap-2">
                <PassTrackArc elevation={pass.elevationDeg} inPass={pass.inPass} phase={pass.phase} />
                <div className="flex items-center gap-1.5">
                  {meta.timeWarps.map((w) => (
                    <button
                      key={w}
                      onClick={() => handleWarp(w as TimeWarp)}
                      className={cn(
                        'vvu-label text-[8px] px-2.5 py-1.5 border min-h-[32px] transition-colors',
                        w === warp
                          ? 'border-[#c8ff00]/60 text-[#c8ff00] bg-[#c8ff00]/10'
                          : 'border-[rgba(107,138,64,0.3)] text-[#7a8a6e] hover:border-[rgba(143,179,90,0.5)]',
                      )}
                      aria-pressed={w === warp}
                      aria-label={`pass time warp ×${w}`}
                    >
                      ×{w}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* live pass tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 mt-4">
              <StatTile
                label="ELEVATION θ"
                value={pass.inPass ? pass.elevationDeg.toFixed(1) : '—'}
                unit="deg"
                sub={pass.inPass ? 'above horizon' : 'below horizon'}
                tone={pass.inPass ? 'teal' : 'amber'}
              />
              <StatTile
                label="SLANT RANGE ρ"
                value={pass.slantKm.toFixed(0)}
                unit="km"
                sub="UE → satellite"
              />
              <StatTile
                label="DOPPLER f_d"
                value={fmtHz(pass.dopplerHz)}
                sub={`TR 38.811 bound ±${(meta.tr38811DopplerKhz).toFixed(0)} kHz · model ±${meta.modelMaxDopplerKhz.toFixed(0)}`}
                tone={pass.dopplerMagHz > 400e3 ? 'amber' : 'teal'}
              />
              <StatTile
                label="RTT · BENT-PIPE"
                value={pass.rttBentPipeMs === null ? 'NO SVC' : pass.rttBentPipeMs.toFixed(1)}
                unit={pass.rttBentPipeMs === null ? undefined : 'ms'}
                sub="relay → ground GW → core"
                tone={pass.rttBentPipeMs === null ? 'crimson' : 'dim'}
              />
              <StatTile
                label="RTT · REGEN (REL-19)"
                value={pass.rttRegenerativeMs.toFixed(1)}
                unit="ms"
                sub="gNB on-board · ~2× lower"
                tone="lime"
              />
              <StatTile
                label="S&F MODE"
                value={pass.sfn.mode === 'BUFFERING' ? 'BUFFERING' : 'IDLE'}
                sub={
                  pass.sfn.mode === 'BUFFERING' && pass.sfn.nextRiseS !== null
                    ? `next rise ${pass.sfn.nextRiseS.toFixed(0)} s`
                    : 'pass deterministic · store-and-forward armed'
                }
                tone={pass.sfn.mode === 'BUFFERING' ? 'amber' : 'teal'}
              />
            </div>
          </section>
        </SectionReveal>

        {/* ── §1 NTN / regenerative payload ── */}
        <SectionReveal>
          <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="ntn regenerative payload">
            <SectionHeader
              title="NTN REGENERATIVE PAYLOAD"
              num="1"
              kicker="3GPP REL-19 · LEO 550 KM · S&F DETERMINISM"
              right={
                <>
                  <RadioTower className="size-3.5 text-[#2ea8a0]" aria-hidden />
                  <Chip tone="dim" dashed>gNB ON-BOARD</Chip>
                </>
              }
            />
            <div className="grid md:grid-cols-2 gap-2.5 mt-3">
              <div className="vvu-panel-solid p-3.5 sm:p-4">
                <div className="flex items-center gap-2">
                  <ArrowDownUp className="size-3.5 text-[#7a8a6e]" aria-hidden />
                  <span className="vvu-label text-[10px] text-[#c9d4bd] font-bold">BENT-PIPE (LEGACY)</span>
                </div>
                <p className="text-[11px] text-[#8a9a7e] mt-2 leading-relaxed">
                  Satellite is a transparent relay: every packet crosses 4 radio legs
                  (UE↔sat↔GW) plus ground-GW/core processing — deterministic latency is
                  lost below horizon.
                </p>
                <div className="vvu-label text-lg font-bold tabular-nums mt-2 text-[#7a8a6e]">
                  {pass.rttBentPipeMs === null ? 'NO SERVICE' : `${pass.rttBentPipeMs.toFixed(1)} ms`}
                </div>
              </div>
              <div className="vvu-panel-solid p-3.5 sm:p-4" style={{ borderColor: 'rgba(46,168,160,0.4)' }}>
                <div className="flex items-center gap-2">
                  <Satellite className="size-3.5 text-[#2ea8a0]" aria-hidden />
                  <span className="vvu-label text-[10px] text-[#c9d4bd] font-bold">REGENERATIVE (REL-19)</span>
                  <Chip tone="teal">gNB ON-BOARD</Chip>
                </div>
                <p className="text-[11px] text-[#8a9a7e] mt-2 leading-relaxed">
                  Full gNB on the satellite: 2 radio legs + on-board processing — the RTT
                  reduction you see live. Store-and-Forward keeps buffers deterministic
                  through the below-horizon gap.
                </p>
                <div className="vvu-label text-lg font-bold tabular-nums mt-2 vvu28-glow" style={{ color: '#2ea8a0' }}>
                  {pass.rttRegenerativeMs.toFixed(1)} ms
                  {pass.sfn.mode === 'BUFFERING' && (
                    <span className="ml-2 text-[9px] text-[#e0a030] vvu28-sfn inline-flex items-center gap-1">
                      <Database className="size-3" aria-hidden /> S&F HOLD
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {meta.pillars.map((p) => (
                <Chip key={p} tone="sage">
                  {p}
                </Chip>
              ))}
            </div>
          </section>
        </SectionReveal>

        {/* ── §2 DTL transfer lab ── */}
        <SectionReveal>
          <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="dtl transfer lab">
            <SectionHeader
              title="SUPERVISED DTL — TRANSFER LAB"
              num="2"
              kicker="S₀ PRE-TRAIN → S₁ FINE-TUNE · 100 SAMPLES"
              right={
                <>
                  <Brain className="size-3.5 text-[#2ea8a0]" aria-hidden />
                  <Chip tone="dim" dashed>40→800×4→20 FNN</Chip>
                </>
              }
            />
            <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 mt-3">
              {/* FNN diagram */}
              <div className="vvu-panel-solid p-3.5 sm:p-4">
                <div className="vvu-label text-[9px] text-[#7a8a6e] tracking-[0.14em]">
                  S₀ PRE-TRAIN → S₁ FINE-TUNE · LAYER STATE
                </div>
                <div className="mt-3 space-y-2">
                  {[
                    { label: 'INPUT', size: '40', kind: 'io' as const },
                    { label: 'HIDDEN 1', size: '800', kind: 'frozen' as const },
                    { label: 'HIDDEN 2', size: '800', kind: 'frozen' as const },
                    { label: 'HIDDEN 3', size: '800', kind: 'frozen' as const },
                    { label: 'HIDDEN 4', size: '800', kind: 'trainable' as const },
                    { label: 'OUTPUT', size: '20', kind: 'io' as const },
                  ].map((l) => (
                    <div
                      key={l.label}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 border',
                        l.kind === 'frozen' && 'vvu28-frozen border-[rgba(107,138,64,0.35)] bg-[rgba(107,138,64,0.05)]',
                        l.kind === 'trainable' && 'vvu28-trainable border-[rgba(200,255,0,0.45)] bg-[rgba(200,255,0,0.05)]',
                        l.kind === 'io' && 'border-[rgba(107,138,64,0.2)]',
                      )}
                    >
                      <span className="vvu-label text-[9px] text-[#c9d4bd] flex items-center gap-1.5">
                        {l.kind === 'frozen' && <Snowflake className="size-3 text-[#7a8a6e]" aria-hidden />}
                        {l.kind === 'trainable' && <FlaskConical className="size-3 text-[#c8ff00]" aria-hidden />}
                        {(l.kind === 'io' || l.kind === 'frozen') && !l.label.startsWith('H') && <Cpu className="size-3 text-[#5a684e]" aria-hidden />}
                        {l.label} · {l.size}
                      </span>
                      <span
                        className="vvu-label text-[7.5px]"
                        style={{
                          color: l.kind === 'trainable' ? '#c8ff00' : l.kind === 'frozen' ? '#7a8a6e' : '#5a684e',
                        }}
                      >
                        {l.kind === 'frozen' ? 'FROZEN · S₀ WEIGHTS' : l.kind === 'trainable' ? 'FINE-TUNED · S₁' : 'IO'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <StatTile label="TOTAL PARAMS" value={snap.fnn.total.toLocaleString('en-ZA')} tone="dim" />
                  <StatTile label="FROZEN" value={snap.fnn.frozen.toLocaleString('en-ZA')} tone="dim" />
                  <StatTile label="TRAINABLE" value={`${snap.fnn.trainable.toLocaleString('en-ZA')}`} sub={`${snap.fnn.trainablePct.toFixed(1)}%`} tone="lime" />
                </div>
              </div>

              {/* sample lab */}
              <div className="vvu-panel-solid p-3.5 sm:p-4 flex flex-col min-w-0">
                <div className="vvu-label text-[9px] text-[#7a8a6e] tracking-[0.14em]">
                  EDGE SAMPLE BUDGET · S₁ FINE-TUNE
                </div>
                <div className="flex items-baseline gap-2 mt-3">
                  <span className="vvu-label text-2xl font-bold tabular-nums text-[#c8ff00] vvu28-glow">
                    {samples.toLocaleString('en-ZA')}
                  </span>
                  <span className="vvu-label text-[9px] text-[#7a8a6e]">SAMPLES</span>
                </div>
                <input
                  type="range"
                  className="vvu28-range mt-2"
                  min={0}
                  max={DTL_STEPS.length - 1}
                  step={1}
                  value={DTL_STEPS.indexOf(samples as (typeof DTL_STEPS)[number]) >= 0 ? DTL_STEPS.indexOf(samples as (typeof DTL_STEPS)[number]) : 3}
                  onChange={(e) => setSamples(DTL_STEPS[Number(e.target.value)])}
                  aria-label="training samples"
                />
                <div className="flex justify-between vvu-label text-[7px] text-[#5a684e] mt-0.5">
                  <span>10</span>
                  <span>100</span>
                  <span>1k</span>
                  <span>20k</span>
                </div>

                {/* advisory preview */}
                {advisoryDtl && (
                  <div className="mt-3 space-y-2 min-w-0">
                    <div>
                      <div className="flex justify-between vvu-label text-[8px] text-[#7a8a6e]">
                        <span>DTL η (ADVISORY)</span>
                        <span className="tabular-nums">{advisoryDtl.dtl.toFixed(3)}</span>
                      </div>
                      <div className="vvu28-meter mt-1">
                        <div
                          className="vvu28-bler"
                          style={{
                            width: `${advisoryDtl.dtl * 100}%`,
                            background: 'linear-gradient(90deg, rgba(46,168,160,0.7), #c8ff00)',
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between vvu-label text-[8px] text-[#7a8a6e]">
                        <span>SCRATCH η (ADVISORY)</span>
                        <span className="tabular-nums">{advisoryDtl.scratch.toFixed(3)}</span>
                      </div>
                      <div className="vvu28-meter mt-1">
                        <div
                          className="vvu28-bler"
                          style={{
                            width: `${advisoryDtl.scratch * 100}%`,
                            background: 'rgba(122,138,110,0.65)',
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 vvu-label text-[7.5px] text-[#5a684e]">
                      <AlertTriangle className="size-3 shrink-0" aria-hidden />
                      client preview — commit recomputes server-side
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => dtlRun.mutate()}
                  disabled={dtlRun.isPending}
                  className="mt-auto w-full vvu-label text-[10px] font-bold min-h-[44px] bg-[#c8ff00] hover:bg-[#d9ff4d] text-black border border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[1px_1px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all mt-3"
                >
                  {dtlRun.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden /> COMMITTING S₁ RUN…
                    </>
                  ) : (
                    <>
                      <FlaskConical className="size-3.5 mr-1.5" aria-hidden /> COMMIT S₁ RUN → WORM
                    </>
                  )}
                </Button>

                {dtlRun.data && (
                  <div
                    className="mt-3 p-3 border text-[10px] leading-relaxed"
                    style={{
                      borderColor: dtlRun.data.authoritative.dtl >= DTL_TARGET_ETA ? 'rgba(200,255,0,0.4)' : 'rgba(224,160,48,0.45)',
                    }}
                    role="status"
                  >
                    <div className="vvu-label text-[9px] font-bold" style={{ color: dtlRun.data.authoritative.dtl >= DTL_TARGET_ETA ? '#c8ff00' : '#e0a030' }}>
                      SERVER VERDICT · WORM #{dtlRun.data.wormSeq}
                    </div>
                    <div className="text-[#8a9a7e] mt-1.5 font-mono text-[9px]">{dtlRun.data.authoritative.verdict}</div>
                    <div className="text-[#7a8a6e] mt-1.5 font-mono text-[9px]">
                      training compute ≈ {dtlRun.data.flops.ratioPct}% of from-scratch ·{' '}
                      {dtlRun.data.flops.dtlTotalMflops.toLocaleString('en-ZA')} vs{' '}
                      {dtlRun.data.flops.scratchTotalMflops.toLocaleString('en-ZA')} MFLOPs
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* curve mini-chart */}
            <div className="mt-3 vvu-panel-solid p-3.5 sm:p-4">
              <div className="vvu-label text-[9px] text-[#7a8a6e] tracking-[0.14em]">
                SAMPLE-EFFICIENCY CURVES · CALIBRATED TO PAPER REPORT (η TARGET {snap.dtl.target})
              </div>
              <div className="mt-3 grid grid-cols-9 gap-1.5 items-end h-24" role="img" aria-label="DTL vs scratch accuracy curve">
                {snap.dtl.curve.map((pt) => (
                  <div key={pt.samples} className="flex flex-col items-center gap-0.5 min-w-0">
                    <div className="w-full flex items-end justify-center gap-0.5 h-16">
                      <div
                        className="w-2.5 sm:w-3 vvu28-bler"
                        style={{ height: `${Math.max(pt.dtl, 0.02) * 100}%`, background: 'linear-gradient(180deg, #c8ff00, rgba(46,168,160,0.7))' }}
                        title={`DTL ${pt.dtl.toFixed(3)} @ ${pt.samples}`}
                      />
                      <div
                        className="w-2.5 sm:w-3 vvu28-bler"
                        style={{ height: `${Math.max(pt.scratch, 0.02) * 100}%`, background: 'rgba(122,138,110,0.55)' }}
                        title={`scratch ${pt.scratch.toFixed(3)} @ ${pt.samples}`}
                      />
                    </div>
                    <span className="vvu-label text-[6px] sm:text-[7px] text-[#5a684e] tabular-nums">
                      {pt.samples >= 1000 ? `${pt.samples / 1000}k` : pt.samples}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-2 vvu-label text-[7px] text-[#7a8a6e]">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5" style={{ background: 'linear-gradient(180deg,#c8ff00,rgba(46,168,160,0.7))' }} /> DTL (S₀→S₁)
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5" style={{ background: 'rgba(122,138,110,0.55)' }} /> FROM SCRATCH
                </span>
              </div>
            </div>
          </section>
        </SectionReveal>

        {/* ── §3 primal-dual optimizer ── */}
        <SectionReveal>
          <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="primal-dual optimizer">
            <SectionHeader
              title="UNSUPERVISED LAGRANGIAN PRIMAL-DUAL — BANDWIDTH LAB"
              num="3"
              kicker="FINITE BLOCKLENGTH · SHARED 1 MHZ BEAM BUDGET"
              right={
                <>
                  <Sigma className="size-3.5 text-[#2ea8a0]" aria-hidden />
                  <Chip tone="dim" dashed>ε TARGET 1e-5</Chip>
                </>
              }
            />
            <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-3 mt-3">
              {/* users config */}
              <div className="vvu-panel-solid p-3.5 sm:p-4 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="vvu-label text-[9px] text-[#7a8a6e] tracking-[0.14em]">
                    K = {users.length} URLLC USERS · 100 µs SLOT
                  </div>
                  <div className="flex items-center gap-1">
                    {[0, 2, 3].map((m) => (
                      <button
                        key={m}
                        onClick={() => setMarginPct(m)}
                        className={cn(
                          'vvu-label text-[8px] px-2 py-1 border min-h-[30px] transition-colors',
                          m === marginPct
                            ? 'border-[#c8ff00]/60 text-[#c8ff00] bg-[#c8ff00]/10'
                            : 'border-[rgba(107,138,64,0.3)] text-[#7a8a6e] hover:border-[rgba(143,179,90,0.5)]',
                        )}
                        aria-pressed={m === marginPct}
                      >
                        MARGIN {m}%
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-2.5 space-y-2 max-h-[300px] overflow-y-auto custom-scroll pr-1">
                  {users.map((u, i) => (
                    <div
                      key={i}
                      className={cn(
                        'p-2.5 border',
                        optRun.data && !optRun.data.run.users[i]?.feasible
                          ? 'vvu28-deferred border-[rgba(224,160,48,0.35)]'
                          : 'border-[rgba(107,138,64,0.25)]',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="vvu-label text-[9px] text-[#c9d4bd]">
                          USER {i + 1} · SNR {u.snrDb} dB · {u.demandBits} BITS
                        </span>
                        {optRun.data && (
                          <span
                            className="vvu-label text-[8px] tabular-nums"
                            style={{ color: optRun.data.run.users[i]?.feasible ? '#c8ff00' : '#e0a030' }}
                          >
                            {optRun.data.run.users[i]?.feasible
                              ? `✓ ${(optRun.data.run.users[i].bwHz / 1e3).toFixed(0)} kHz`
                              : `DEFERRED · λ${optRun.data.run.users[i]?.lambda ?? 0}`}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <label className="min-w-0">
                          <span className="vvu-label text-[7px] text-[#5a684e]">SNR</span>
                          <input
                            type="range"
                            className="vvu28-range"
                            min={-10}
                            max={20}
                            step={1}
                            value={u.snrDb}
                            onChange={(e) =>
                              setUsers((prev) =>
                                prev.map((p, j) => (j === i ? { ...p, snrDb: Number(e.target.value) } : p)),
                              )
                            }
                            aria-label={`user ${i + 1} SNR dB`}
                          />
                        </label>
                        <label className="min-w-0">
                          <span className="vvu-label text-[7px] text-[#5a684e]">DEMAND (BITS)</span>
                          <input
                            type="range"
                            className="vvu28-range"
                            min={8}
                            max={128}
                            step={8}
                            value={u.demandBits}
                            onChange={(e) =>
                              setUsers((prev) =>
                                prev.map((p, j) => (j === i ? { ...p, demandBits: Number(e.target.value) } : p)),
                              )
                            }
                            aria-label={`user ${i + 1} demand bits`}
                          />
                        </label>
                      </div>
                      {optRun.data && (
                        <div className="vvu28-meter mt-1">
                          <div
                            className="vvu28-bler"
                            style={{
                              width: `${Math.min((optRun.data.run.users[i]?.bwHz ?? 0) / (meta.spectrumBudgetKhz * 1e3 / 2) * 100, 100)}%`,
                              background: optRun.data.run.users[i]?.feasible
                                ? 'linear-gradient(90deg, rgba(46,168,160,0.7), #c8ff00)'
                                : 'rgba(224,160,48,0.7)',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => optRun.mutate()}
                  disabled={optRun.isPending}
                  className="mt-3 w-full vvu-label text-[10px] font-bold min-h-[44px] bg-[#c8ff00] hover:bg-[#d9ff4d] text-black border border-black shadow-[2px_2px_0px_0px_#000] hover:shadow-[1px_1px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                >
                  {optRun.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden /> SOLVING DUALS…
                    </>
                  ) : (
                    <>
                      <Zap className="size-3.5 mr-1.5" aria-hidden /> RUN PRIMAL-DUAL → WORM
                    </>
                  )}
                </Button>
              </div>

              {/* result panel */}
              <div className="vvu-panel-solid p-3.5 sm:p-4 min-w-0 flex flex-col">
                <div className="vvu-label text-[9px] text-[#7a8a6e] tracking-[0.14em]">
                  SOLVE RESULT · SERVER-RECOMPUTED
                </div>
                {optRun.data ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 mt-2.5">
                      <StatTile
                        label="Σ BANDWIDTH"
                        value={(optRun.data.run.totalBwHz / 1e3).toFixed(0)}
                        unit="kHz"
                        sub={`budget ${meta.spectrumBudgetKhz} kHz · margin ${optRun.data.run.marginPct}%`}
                        tone={optRun.data.run.contended ? 'amber' : 'teal'}
                      />
                      <StatTile
                        label="QOS MET"
                        value={`${optRun.data.run.users.filter((u) => u.feasible).length}/${optRun.data.run.users.length}`}
                        sub={optRun.data.run.allQosMet ? 'all users inside ε' : 'deferred users carry λₖ penalty'}
                        tone={optRun.data.run.allQosMet ? 'lime' : 'crimson'}
                      />
                    </div>
                    <div className="mt-2.5 p-2.5 border border-[rgba(107,138,64,0.25)] font-mono text-[9px] text-[#8a9a7e] space-y-1 max-h-40 overflow-y-auto custom-scroll">
                      {optRun.data.run.users.map((u, i) => (
                        <div key={i} className="flex justify-between gap-2 tabular-nums">
                          <span>
                            U{i + 1} {u.snrDb}dB {u.demandBits}b
                          </span>
                          <span style={{ color: u.feasible ? '#c8ff00' : '#e0a030' }}>
                            {(u.bwHz / 1e3).toFixed(0)}/{(u.bwRequiredHz / 1e3).toFixed(0)} kHz · εₐ {fmtEps(u.achievedEps)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* dual trace */}
                    <div className="mt-2.5">
                      <div className="vvu-label text-[8px] text-[#7a8a6e]">
                        DUAL TRACE · μ (SPECTRUM PRICE) · λₘₐₓ (QOS PENALTY)
                      </div>
                      <div className="mt-1.5 space-y-1 max-h-32 overflow-y-auto custom-scroll pr-1">
                        {optRun.data.run.iterations.map((it) => (
                          <div key={it.it} className="flex gap-2 font-mono text-[8px] text-[#7a8a6e] tabular-nums">
                            <span className="text-[#5a684e] w-8 shrink-0">it{it.it}</span>
                            <span className="w-24 shrink-0">alloc {it.allocatedKHz} kHz</span>
                            <span className="w-20 shrink-0">λm {it.lambdaMax}</span>
                            <span>inf {it.infeasibleUsers}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-auto pt-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Chip tone="teal">UNSUPERVISED ERR &lt; {meta.errUnsupervisedPct}%</Chip>
                        <Chip tone="dim" dashed>
                          SUPERVISED ERR &lt; {meta.errSupervisedPct}%
                        </Chip>
                        <Chip tone="sage">RELIABILITY 1−10⁻⁵</Chip>
                        <Chip tone="amber">MARGIN {meta.marginMinPct}–{meta.marginMaxPct}% OVERHEAD</Chip>
                      </div>
                      <p className="text-[10px] text-[#7a8a6e] mt-2 leading-relaxed">
                        The Reliability-Overhead Trade-off: the {meta.marginMinPct}–{meta.marginMaxPct}%
                        margin is spectrum spent as a safety buffer against neural approximation
                        error — watch ΣB grow as you raise it.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                    <Sigma className="size-5 text-[#5a684e] mb-2" aria-hidden />
                    <p className="text-[11px] text-[#8a9a7e] max-w-[36ch] leading-relaxed">
                      Configure users and margin, then run the solve. Stage 1 computes each
                      user&apos;s finite-blocklength boundary n*, stage 2 prices admission
                      against the shared spectrum, stage 3 lets the QoS penalty terms λₖ climb
                      for deferred users.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </SectionReveal>

        {/* ── §4 doppler / waveform lab ── */}
        <SectionReveal>
          <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="doppler waveform lab">
            <SectionHeader
              title="DOPPLER × WAVEFORM × SCHEDULER LAB"
              num="4"
              kicker="ε_d = f_d·T_SYM · SCS 240 kHz · TDL-A/C"
              right={
                <div className="flex items-center gap-1.5">
                  <Waves className="size-3.5 text-[#2ea8a0]" aria-hidden />
                  {(['TDL-A', 'TDL-C'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => handleChannel(c)}
                      className={cn(
                        'vvu-label text-[8px] px-2 py-1 border min-h-[30px] transition-colors',
                        c === channel
                          ? 'border-[#c8ff00]/60 text-[#c8ff00] bg-[#c8ff00]/10'
                          : 'border-[rgba(107,138,64,0.3)] text-[#7a8a6e] hover:border-[rgba(143,179,90,0.5)]',
                      )}
                      aria-pressed={c === channel}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              }
            />
            <div className="flex flex-wrap items-center gap-2.5 mt-3">
              <StatTile label="LIVE f_d" value={fmtHz(pass.dopplerHz)} tone={pass.dopplerMagHz > 400e3 ? 'amber' : 'teal'} sub={pass.inPass ? 'in-pass' : 'hold'} />
              <StatTile label="NORMALIZED ε_d" value={pass.epsDoppler.toFixed(3)} sub="ε_d = |f_d|·T_sym" tone="dim" />
              <StatTile
                label="RADIAL V"
                value={`${pass.radialKms > 0 ? '+' : ''}${pass.radialKms}`}
                unit="km/s"
                sub="LOS radial · −approach/+recede"
                tone="dim"
              />
            </div>

            {/* waveform cards */}
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5 mt-3">
              {snap.waveforms.rows.map((w) => (
                <div
                  key={w.key}
                  className={cn(
                    'vvu-panel-solid p-3.5 min-w-0',
                    !w.usable && 'border-[rgba(229,72,77,0.35)]',
                    w.key === 'afdm' && w.usable && 'border-[rgba(200,255,0,0.4)]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="vvu-label text-[10px] font-bold text-[#c9d4bd]">{w.label}</span>
                    {w.usable ? (
                      <Chip tone="lime">MEETS 1e-5</Chip>
                    ) : (
                      <Chip tone="crimson">{w.key === 'ocdm' ? 'UNUSABLE' : 'OUTAGE'}</Chip>
                    )}
                  </div>
                  <div className="mt-2">
                    <div className="flex justify-between vvu-label text-[8px] text-[#7a8a6e]">
                      <span>BLER (32-bit packet)</span>
                      <span className="tabular-nums">{fmtEps(w.bler)}</span>
                    </div>
                    <div className="vvu28-meter mt-1">
                      <div
                        className="vvu28-bler"
                        style={{
                          width: `${blerPct(w.bler)}%`,
                          background: w.usable
                            ? 'linear-gradient(90deg, rgba(46,168,160,0.7), #c8ff00)'
                            : w.key === 'ocdm'
                              ? 'rgba(229,72,77,0.8)'
                              : 'rgba(224,160,48,0.8)',
                        }}
                      />
                    </div>
                  </div>
                  <div className="vvu-label text-[8px] text-[#7a8a6e] mt-2 tabular-nums">
                    DOPPLER LOSS {w.dopplerLossDb.toFixed(2)} dB
                  </div>
                  <div className="text-[9px] text-[#7a8a6e] mt-1 leading-relaxed font-mono">{w.note}</div>
                </div>
              ))}
            </div>

            {/* scheduler matrix */}
            <div className="mt-3 vvu-panel-solid p-3.5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="vvu-label text-[9px] text-[#7a8a6e] tracking-[0.14em]">
                  SCHEDULER PACKET-LOSS MATRIX · {channel} · LIVE ε_d {pass.epsDoppler.toFixed(3)}
                </div>
                <Chip tone="dim" dashed>
                  KA = CQI + DOMAIN BOUNDS · MULTI-HEAD CRITICS
                </Chip>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-[10px] font-mono tabular-nums min-w-[520px]">
                  <thead>
                    <tr className="vvu-label text-[8px] text-[#7a8a6e]">
                      <th className="text-left py-1.5 pr-2 font-normal">WAVEFORM</th>
                      <th className="text-right py-1.5 px-2 font-normal">DDPG (MODEL-FREE)</th>
                      <th className="text-right py-1.5 px-2 font-normal">DDPG-T</th>
                      <th className="text-right py-1.5 pl-2 font-normal">KA-DDPG-T-DRL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snap.schedLoss.map((row) => {
                      const wfRow = snap.waveforms.rows.find((w) => w.key === row.waveform);
                      return (
                        <tr
                          key={row.waveform}
                          className={cn(
                            'border-t border-[rgba(107,138,64,0.2)]',
                            row.waveform === 'afdm' && 'bg-[rgba(200,255,0,0.04)]',
                          )}
                        >
                          <td className="py-1.5 pr-2 text-[#c9d4bd]">
                            {wfRow?.label ?? row.waveform}
                            {row.waveform === 'afdm' && (
                              <ChevronRight className="inline size-3 text-[#c8ff00] ml-0.5" aria-hidden />
                            )}
                          </td>
                          <td className="text-right py-1.5 px-2 text-[#e5484d]">
                            {(row.ddpg * 100).toFixed(row.ddpg < 0.001 ? 4 : 2)}%
                          </td>
                          <td className="text-right py-1.5 px-2 text-[#e0a030]">
                            {(row.ddpgt * 100).toFixed(row.ddpgt < 0.001 ? 4 : 2)}%
                          </td>
                          <td className="text-right py-1.5 pl-2 text-[#c8ff00]">
                            {(row.kaddpg * 100).toFixed(row.kaddpg < 0.001 ? 4 : 2)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-[#7a8a6e] mt-2.5 leading-relaxed">
                Paper result: KA-DDPG-T-DRL over AFDM cuts average packet loss by orders of
                magnitude versus standard DDPG across TDL-A (NLOS) and TDL-C (LOS). OCDM is
                unusable — its CFO-induced irreducible error floor sits above the 10⁻⁵ target.
                Watch CP-OFDM rejoin the 1e-5 club only near zenith as ε_d falls.
              </p>
            </div>
          </section>
        </SectionReveal>

        {/* ── §5 deployment matrix ── */}
        <SectionReveal>
          <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="deployment matrix">
            <SectionHeader
              title="DEPLOYMENT MATRIX — PARADIGM COMPARISON"
              num="5"
              kicker="PAPER §5 · NET4AI · ROADMAP"
              right={
                <>
                  <Gauge className="size-3.5 text-[#2ea8a0]" aria-hidden />
                  <Chip tone="dim" dashed>3 PARADIGMS × 5 AXES</Chip>
                </>
              }
            />
            <div className="mt-3 grid md:grid-cols-3 gap-2.5">
              {snap.matrix.map((m) => (
                <div
                  key={m.paradigm}
                  className={cn(
                    'vvu-panel-solid p-3.5 min-w-0',
                    m.paradigm.includes('Knowledge') && 'border-[rgba(200,255,0,0.35)]',
                  )}
                >
                  <div className="vvu-label text-[10px] font-bold text-[#f3e38a] tracking-[0.08em]">
                    {m.paradigm.toUpperCase()}
                  </div>
                  <dl className="mt-2 space-y-1.5 text-[10px]">
                    {[
                      ['DATA', m.data],
                      ['COMPLEXITY', m.complexity],
                      ['QOS', m.qos],
                      ['WAVEFORMS', m.waveforms],
                      ['3GPP', m.enabler],
                    ].map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[78px_1fr] gap-2 min-w-0">
                        <dt className="vvu-label text-[7.5px] text-[#5a684e] pt-0.5">{k}</dt>
                        <dd className="text-[#8a9a7e] leading-snug">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[#8a9a7e] mt-3 leading-relaxed max-w-[90ch]">
              Engineering conclusion: 6G fuses the physical and cyber worlds — URLLC+ needs
              paradigms grounded in communication theory (finite blocklength, CQI, domain
              bounds), Rel-19 regenerative payloads to cut RTT, and AFDM/OTFS to survive LEO
              Doppler. The NET4AI posture: the network itself becomes the platform for
              distributed intelligence.
            </p>
          </section>
        </SectionReveal>

        {/* ── provenance footer ── */}
        <SectionReveal>
          <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="provenance">
            <SectionHeader
              title="PROVENANCE · REAL vs CALIBRATED vs REPORTED"
              kicker="SANDBOX HONESTY LEDGER"
              right={
                <>
                  <Activity className="size-3.5 text-[#2ea8a0]" aria-hidden />
                  <Chip tone="dim" dashed>ROUND 28</Chip>
                </>
              }
            />
            <div className="mt-3 space-y-1.5 max-h-56 overflow-y-auto custom-scroll pr-1">
              {meta.provenance.map((p) => (
                <div
                  key={p.label}
                  className="flex items-start gap-2.5 p-2.5 border border-[rgba(107,138,64,0.2)]"
                >
                  <Chip
                    tone={p.kind === 'REAL' ? 'lime' : p.kind === 'CALIBRATED' ? 'amber' : 'sage'}
                  >
                    {p.kind}
                  </Chip>
                  <div className="min-w-0">
                    <div className="vvu-label text-[9px] text-[#c9d4bd]">{p.label}</div>
                    <div className="text-[9.5px] text-[#7a8a6e] mt-0.5 leading-snug">{p.note}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-[9px] text-[#5a684e] mt-3 font-mono leading-relaxed">
              SOURCE · {meta.paper} · projections rebuilt in-sandbox (Round 28) · committed runs
              WORM-logged (source URL) · advisory previews recomputed server-side on commit.
            </div>
          </section>
        </SectionReveal>
      </div>
    </div>
  );
}
