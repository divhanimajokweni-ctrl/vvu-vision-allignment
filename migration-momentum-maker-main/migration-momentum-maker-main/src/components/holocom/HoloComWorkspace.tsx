'use client';

// src/components/holocom/HoloComWorkspace.tsx — Round 19 · 6G NeXt HOLOCOM.
// The fourth hash projection (#/holocom), adapted from Friese et al., "True
// 3D Holography: A Communication Service of Tomorrow and Its Requirements
// for a New Converged Cloud and Network Architecture on the Path to 6G"
// (project 6G NeXt — Deutsche Telekom / Fraunhofer FOKUS / DFKI / TU Berlin /
// TU Ilmenau / SeeReal / Wildau, BMBF 16KISK17x). The paper's five pillars,
// each mapped to something REAL in this sandbox:
//   §1 SPLIT COMPUTING · MTP PIPELINE  — eye→photon latency budget (§III/IV-A),
//        live legs fed by the telemetry service's 'holo' frames
//   §2 CROSS-LAYER METRICS FUNCTION    — application / computing / network
//        layer KPIs exactly as §IV-B2 defines them (live, 3s cadence)
//   §3 DISCOVERY SERVICE               — parameterized KPI requests scored
//        server-side against the render-instance registry (§IV-B3)
//   §4 SERVICE BROKER                  — degradation alerts + Docker-style
//        deploy/drain lifecycle (§IV-B4, DEPLOYING→ACTIVE lazy state machine)
//   §5 QoE ALIGNMENT                   — P.1203-inspired MOS surrogate with
//        co-presence / immersion / realism constructs (§IV-D)
//   §6 AI QoS PREDICTION + FOUNTAIN LAB — offline/online prediction surrogate
//        over the live MTP series + two-stage FEC/fountain coding rate lab
//        with WORM-logged commits (§IV-E)
//
// SECURITY POSTURE (unchanged since Round 17/18):
//  · every score/MOS/coding rate is RECOMPUTED SERVER-SIDE on write
//    (/api/vvu/holocom → src/lib/holocom.ts); client-side calls into the pure
//    module are advisory previews only.
//  · every action appends a WORM event (source 'HOLOCOM'); the sim appends
//    HOLO_MTP_BREACH / HOLO_MTP_RECOVERED / HOLO_CHANNEL_STRESS itself.
//  · zero client keys, zero localStorage state — registry/logs/samples are
//    Prisma rows.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Boxes,
  Cpu,
  Gauge,
  Loader2,
  Orbit,
  Radio,
  Radar,
  Rocket,
  ScanLine,
  ServerCog,
  Waves,
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
  fmtTime,
  useQueryErrorToast,
} from '@/components/analytics/shared';
import {
  MTP_SEGMENTS,
  QOS_CLASSES,
  computeMtp,
  fountainCoding,
  predictMos,
  predictQos,
} from '@/lib/holocom';
import {
  useConnected,
  useHoloFrame,
  useHoloHistory,
  useSendHoloStress,
  useWormChain,
} from '@/hooks/use-vvu-socket';
import type {
  HoloCodingResult,
  HoloComResponse,
  HoloDiscoverOutcome,
  HoloInstance,
} from '@/types/vvu';

const fmt2 = (n: number): string => n.toFixed(2);
const HOLO_TEAL = '#2ea8a0';
const STRESS_NAMES = ['NOMINAL', 'LIGHT', 'HEAVY', 'SEVERE'] as const;

// ─── Round 19 scoped CSS (vvu19-*) — scanlines, holo glow, breach pulse ─────

function HoloStyles() {
  return (
    <style>{`
/* §1 pipeline panel — slow horizontal scanline sweep (reduced-motion safe) */
.vvu19-scan { position: relative; overflow: hidden; }
.vvu19-scan::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(100deg, transparent 30%, rgba(46,168,160,0.10) 50%, transparent 70%);
  transform: translateX(-140%);
  animation: vvu19Sweep 5s ease-in-out infinite;
  pointer-events: none;
}
@keyframes vvu19Sweep { 0% { transform: translateX(-140%); } 60%, 100% { transform: translateX(140%); } }

/* MTP total number — hologram teal glow */
.vvu19-holo-glow { text-shadow: 0 0 18px rgba(46,168,160,0.5); }

/* breach chip pulse — crimson heartbeat while MTP is over budget */
.vvu19-breach { animation: vvu19Breach 1.6s ease-in-out infinite; }
@keyframes vvu19Breach {
  0%, 100% { box-shadow: 0 0 0 0 rgba(229,72,77,0); border-color: rgba(229,72,77,0.55); }
  50% { box-shadow: 0 0 12px rgba(229,72,77,0.45); border-color: rgba(229,72,77,0.95); }
}

/* DEPLOYING instance card — dashed border crawl while the container boots */
.vvu19-deploying { animation: vvu19DeployCrawl 1.2s linear infinite; }
@keyframes vvu19DeployCrawl { to { background-position: 24px 0; } }

/* meter track + fill for utilisation gauges (§2/§4) */
.vvu19-meter { height: 6px; border-radius: 3px; background: #131811; border: 1px solid rgba(107,138,64,0.2); overflow: hidden; }
.vvu19-meter-fill { height: 100%; border-radius: 3px; transition: width 600ms ease-out; }

/* range inputs — lime accent, 44px hit target */
.vvu19-range { accent-color: #c8ff00; min-height: 44px; width: 100%; cursor: pointer; }

@media (prefers-reduced-motion: reduce) {
  .vvu19-scan::after, .vvu19-breach, .vvu19-deploying { animation: none !important; }
  .vvu19-meter-fill { transition: none !important; }
}
`}</style>
  );
}

// ─── Shared small pieces ────────────────────────────────────────────────────

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
  tone?: 'teal' | 'lime' | 'amber' | 'crimson';
  sub?: string;
}) {
  const valueColor =
    tone === 'lime' ? '#c8ff00' : tone === 'amber' ? '#e0a030' : tone === 'crimson' ? '#e5484d' : HOLO_TEAL;
  return (
    <div className="vvu-panel-solid p-3 sm:p-4 min-w-0">
      <div className="vvu-label text-[8px] sm:text-[9px] text-[#7a8a6e] tracking-[0.14em] truncate">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5 min-w-0">
        <span className={cn('text-lg sm:text-2xl font-bold tabular-nums vvu19-holo-glow')} style={{ color: valueColor }}>
          {value}
        </span>
        {unit && <span className="vvu-label text-[9px] text-[#7a8a6e] shrink-0">{unit}</span>}
      </div>
      {sub && <div className="vvu-label text-[8px] text-[#8a9a7c] mt-1 truncate">{sub}</div>}
    </div>
  );
}

function UtilMeter({ label, value, warn = 0.75 }: { label: string; value: number; warn?: number }) {
  const pct = Math.max(0, Math.min(1, value));
  const color = pct >= 0.9 ? '#e5484d' : pct >= warn ? '#e0a030' : HOLO_TEAL;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="vvu-label text-[8px] sm:text-[9px] text-[#7a8a6e] truncate">{label}</span>
        <span className="vvu-label text-[9px] font-bold tabular-nums text-[#c9d4bd] shrink-0">{Math.round(pct * 100)}%</span>
      </div>
      <div className="vvu19-meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}>
        <div className="vvu19-meter-fill" style={{ width: `${pct * 100}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Channel-stress control (feeds 'holo-stress' → sim WORM-logs) ───────────

function StressControl() {
  const frame = useHoloFrame();
  const sendHoloStress = useSendHoloStress();
  const level = frame?.stressLevel ?? 0;
  return (
    <div className="vvu-panel-solid p-1 flex items-center gap-1" role="group" aria-label="HoloCom channel stress injection">
      <span className="vvu-label text-[8px] sm:text-[9px] text-[#7a8a6e] pl-2 pr-1 shrink-0 hidden sm:inline">STRESS</span>
      {STRESS_NAMES.map((name, i) => {
        const active = level === i;
        return (
          <button
            key={name}
            type="button"
            onClick={() => sendHoloStress(i)}
            aria-pressed={active}
            aria-label={`inject channel stress ${name}`}
            style={active ? { boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.45)' } : undefined}
            className={cn(
              'vvu6c-btn vvu-label text-[8px] sm:text-[9px] font-bold min-h-[42px] px-2 sm:px-2.5 rounded border transition-colors',
              active
                ? i >= 2
                  ? 'bg-[#e5484d] text-[#060806] border-[#e5484d]'
                  : i === 1
                    ? 'bg-[#e0a030] text-[#060806] border-[#e0a030]'
                    : 'bg-[#c8ff00] text-[#060806] border-[#c8ff00]'
                : 'border-[rgba(107,138,64,0.25)] text-[#8fb35a] hover:border-[#8fb35a] hover:text-[#c9d4bd]'
            )}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

// ─── §1 SPLIT COMPUTING · MTP PIPELINE ──────────────────────────────────────

function MtpPipeline() {
  const frame = useHoloFrame();
  const mtp = useMemo(
    () => computeMtp(frame?.network.uplinkMs ?? 2.3, frame?.network.downlinkMs ?? 2.5),
    [frame?.network.uplinkMs, frame?.network.downlinkMs]
  );
  const live = frame !== null;

  // stacked budget bar: each segment proportional to its live ms
  const maxScale = Math.max(mtp.budget5gMs, mtp.totalMs);
  const segColor = (domain: string, isLive: boolean): string => {
    if (!isLive) return 'rgba(107,138,64,0.55)';
    switch (domain) {
      case 'NETWORK':
        return HOLO_TEAL;
      case 'EDGE':
        return '#8fb35a';
      case 'DISPLAY':
        return '#f3e38a';
      default:
        return '#6b8a40';
    }
  };

  return (
    <section className="vvu-panel vvu-enter p-4 sm:p-5 vvu19-scan" aria-label="split computing MTP pipeline">
      <SectionHeader
        num="1"
        title="SPLIT COMPUTING · MTP PIPELINE"
        kicker="REMOTE RENDERING ACROSS THE CLOUD CONTINUUM · §III/IV-A"
        right={
          <>
            <Chip tone={mtp.meets6g ? 'lime' : 'crimson'} className={mtp.meets6g ? undefined : 'vvu19-breach'}>
              {mtp.meets6g ? '≤ 6G TARGET' : 'MTP BREACH'}
            </Chip>
            <Chip tone="dim" dashed>
              FIXED {fmt2(mtp.budget6gMs ? MTP_SEGMENTS.reduce((a, s) => a + s.fixedMs, 0) : 0)}ms + LIVE LEGS
            </Chip>
          </>
        }
      />
      <p className="vvu-label text-[9px] sm:text-[10px] text-[#8a9a7c] leading-relaxed mb-4 max-w-3xl">
        Eye-to-photon chain for one H3D view update — the paper&apos;s remote-rendering split: capture on the
        client, headless Unity render at the edge, hologram compute at the display. The two 6G transport legs
        are LIVE (telemetry sim, 3s frames); everything else is fixed hardware.
      </p>

      {/* segment chain — horizontal scroll on mobile, grid on lg */}
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <ol className="flex items-stretch gap-1.5 min-w-[720px]">
          {mtp.segments.map((seg, i) => {
            const isLive = seg.key === 'uplink' || seg.key === 'downlink';
            return (
              <li key={seg.key} className="flex-1 min-w-0 relative">
                <div
                  className={cn(
                    'vvu-panel-solid h-full p-2 sm:p-2.5 flex flex-col gap-1 min-h-[74px]',
                    isLive && 'border-[rgba(46,168,160,0.45)]',
                    !live && 'opacity-70'
                  )}
                >
                  <div className="flex items-center gap-1">
                    {isLive && <LiveDot color={HOLO_TEAL} />}
                    <span className="vvu-label text-[7.5px] sm:text-[8px] text-[#7a8a6e] truncate">{seg.label}</span>
                  </div>
                  <span
                    className={cn('text-sm sm:text-base font-bold tabular-nums', isLive ? 'text-[#2ea8a0]' : 'text-[#c9d4bd]')}
                  >
                    {fmt2(seg.liveMs)}
                    <span className="text-[8px] text-[#7a8a6e] font-normal">ms</span>
                  </span>
                  <span className="vvu-label text-[7px] text-[#6a7a5e] truncate" title={seg.hint}>
                    {seg.hint}
                  </span>
                </div>
                {i < mtp.segments.length - 1 && (
                  <span aria-hidden className="absolute top-1/2 -right-[7px] -translate-y-1/2 text-[#6b8a40] text-[9px] z-10">
                    ▸
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* budget bar */}
      <div className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-1.5">
          <span className="vvu-label text-[9px] text-[#7a8a6e]">MOTION-TO-PHOTON TOTAL</span>
          <span className="flex items-baseline gap-2">
            <span
              className={cn('text-xl sm:text-3xl font-bold tabular-nums vvu19-holo-glow', mtp.meets6g ? 'text-[#c8ff00]' : 'text-[#e5484d]')}
            >
              {fmt2(mtp.totalMs)}
            </span>
            <span className="vvu-label text-[9px] text-[#7a8a6e]">ms</span>
          </span>
        </div>
        <div
          className="relative h-5 rounded-sm bg-[#131811] border border-[rgba(107,138,64,0.25)] overflow-hidden"
          role="progressbar"
          aria-label="MTP latency total against 6G and 5G budgets"
          aria-valuemin={0}
          aria-valuemax={Math.round(maxScale)}
          aria-valuenow={Math.round(mtp.totalMs)}
        >
          <div className="absolute inset-0 flex">
            {mtp.segments.map((seg) => (
              <div
                key={seg.key}
                title={`${seg.label} ${fmt2(seg.liveMs)}ms`}
                style={{ width: `${(seg.liveMs / maxScale) * 100}%`, background: segColor(seg.domain, seg.key === 'uplink' || seg.key === 'downlink') }}
                className="h-full border-r border-[#060806]/60 last:border-r-0"
              />
            ))}
          </div>
          {/* 6G target marker */}
          <div className="absolute top-0 bottom-0 w-px bg-[#c8ff00]" style={{ left: `${(mtp.budget6gMs / maxScale) * 100}%` }}>
            <span className="absolute -top-px -left-6 vvu-label text-[7px] text-[#c8ff00] bg-[#060806]/85 px-0.5">6G 20</span>
          </div>
          {/* 5G baseline marker */}
          <div className="absolute top-0 bottom-0 w-px bg-[#e0a030]/80" style={{ left: `${(mtp.budget5gMs / maxScale) * 100}%` }}>
            <span className="absolute -bottom-px -left-6 vvu-label text-[7px] text-[#e0a030] bg-[#060806]/85 px-0.5">5G 40</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <Chip tone="teal">NETWORK LEGS {fmt2(mtp.networkMs)}ms</Chip>
          <Chip tone={mtp.meets5g ? 'sage' : 'amber'}>
            {mtp.meets5g ? 'WITHIN 5G BASELINE' : 'ABOVE 5G BASELINE'}
          </Chip>
          <Chip tone="dim" dashed>
            STRESS L{frame?.stressLevel ?? 0} · {STRESS_NAMES[frame?.stressLevel ?? 0]}
          </Chip>
        </div>
      </div>
    </section>
  );
}

// ─── §2 CROSS-LAYER METRICS FUNCTION ────────────────────────────────────────

function CrossLayerMetrics() {
  const frame = useHoloFrame();
  if (!frame) {
    return (
      <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="cross-layer metrics">
        <SectionHeader num="2" title="CROSS-LAYER METRICS FUNCTION" kicker="APP · COMPUTING · NETWORK · §IV-B2" />
        <div className="vvu-label text-[10px] text-[#7a8a6e] py-6 text-center">
          AWAITING FIRST &apos;HOLO&apos; FRAME · TELEMETRY SERVICE 3s CADENCE
        </div>
      </section>
    );
  }
  const a = frame.app;
  const c = frame.computing;
  const n = frame.network;

  const rows: Array<{ k: string; v: string; tone?: 'teal' | 'lime' | 'amber' | 'crimson' }> = [
    { k: 'MESH POLYGONS', v: `${fmt2(a.meshPolysM)}M`, tone: 'teal' },
    { k: 'TEXTURE', v: `${a.textureResK}K`, tone: 'lime' },
    { k: 'MESH BITRATE', v: `${fmt2(a.meshBitrateGbps)} Gbps` },
    { k: 'AUDIO', v: `${a.audioBitrateKbps} kbps` },
    { k: 'VIRTUAL CAMERAS', v: `${a.virtualCameras}× H3D` },
    { k: 'RENDER FPS', v: `${a.renderFps}`, tone: a.renderFps < 60 ? 'amber' : 'lime' },
    { k: 'AVG DECODE', v: `${fmt2(a.avgDecodeMs)} ms` },
    { k: 'UPLINK', v: `${fmt2(n.uplinkGbps)} Gbps` },
    { k: 'DOWNLINK', v: `${fmt2(n.downlinkGbps)} Gbps` },
    { k: 'LATENCY UL/DL', v: `${fmt2(n.uplinkMs)} / ${fmt2(n.downlinkMs)} ms`, tone: 'teal' },
    { k: 'JITTER', v: `${fmt2(n.jitterMs)} ms`, tone: n.jitterMs > 2 ? 'amber' : undefined },
    { k: 'PACKET LOSS', v: `${fmt2(n.lossPct)}%`, tone: n.lossPct > 3 ? 'crimson' : undefined },
    { k: 'STALL WINDOW', v: `${fmt2(n.stallMs)} ms`, tone: n.stallMs > 60 ? 'crimson' : undefined },
  ];

  return (
    <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="cross-layer metrics function">
      <SectionHeader
        num="2"
        title="CROSS-LAYER METRICS FUNCTION"
        kicker="APP · COMPUTING · NETWORK — GATHERED FOR THE BROKER & QOE MODEL · §IV-B2"
        right={
          <Chip tone="teal">
            <LiveDot color={HOLO_TEAL} /> FRAME #{frame.tick}
          </Chip>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* a) application layer */}
        <div className="vvu-panel-solid p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <ScanLine className="size-3.5 text-[#2ea8a0] shrink-0" aria-hidden />
            <span className="vvu-label text-[9px] font-bold text-[#2ea8a0] tracking-[0.14em]">a) APPLICATION LAYER</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            {rows.slice(0, 7).map((r) => (
              <div key={r.k} className="min-w-0">
                <dt className="vvu-label text-[7.5px] sm:text-[8px] text-[#7a8a6e] truncate">{r.k}</dt>
                <dd
                  className={cn(
                    'text-[11px] sm:text-xs font-bold tabular-nums',
                    r.tone === 'teal' ? 'text-[#2ea8a0]' : r.tone === 'lime' ? 'text-[#c8ff00]' : r.tone === 'amber' ? 'text-[#e0a030]' : r.tone === 'crimson' ? 'text-[#e5484d]' : 'text-[#c9d4bd]'
                  )}
                >
                  {r.v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        {/* b) computing layer */}
        <div className="vvu-panel-solid p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="size-3.5 text-[#2ea8a0] shrink-0" aria-hidden />
            <span className="vvu-label text-[9px] font-bold text-[#2ea8a0] tracking-[0.14em]">b) COMPUTING LAYER</span>
          </div>
          <div className="space-y-3">
            <UtilMeter label="CLIENT CPU" value={c.clientCpu} />
            <UtilMeter label="CLIENT GPU" value={c.clientGpu} />
            <UtilMeter label="EDGE CPU (RENDER)" value={c.edgeCpu} />
            <UtilMeter label="EDGE GPU (RENDER)" value={c.edgeGpu} />
            <UtilMeter label="EDGE MEMORY" value={c.edgeMem} />
            <UtilMeter label="CENTRAL GPU (SPILL)" value={c.centralGpu} />
          </div>
        </div>
        {/* c) network layer */}
        <div className="vvu-panel-solid p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <Radio className="size-3.5 text-[#2ea8a0] shrink-0" aria-hidden />
            <span className="vvu-label text-[9px] font-bold text-[#2ea8a0] tracking-[0.14em]">c) NETWORK LAYER</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            {rows.slice(7).map((r) => (
              <div key={r.k} className="min-w-0">
                <dt className="vvu-label text-[7.5px] sm:text-[8px] text-[#7a8a6e] truncate">{r.k}</dt>
                <dd
                  className={cn(
                    'text-[11px] sm:text-xs font-bold tabular-nums',
                    r.tone === 'teal' ? 'text-[#2ea8a0]' : r.tone === 'lime' ? 'text-[#c8ff00]' : r.tone === 'amber' ? 'text-[#e0a030]' : r.tone === 'crimson' ? 'text-[#e5484d]' : 'text-[#c9d4bd]'
                  )}
                >
                  {r.v}
                </dd>
              </div>
            ))}
          </dl>
          <p className="vvu-label text-[7.5px] text-[#6a7a5e] mt-3 leading-relaxed">
            MEASURED BETWEEN HOLOCOM CLIENTS AND THE RENDERING FRAMEWORK — FEEDS DISCOVERY + QOE + PREDICTION.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── §3 DISCOVERY SERVICE ───────────────────────────────────────────────────

interface DiscoverFormState {
  clientId: string;
  maxLatencyMs: number;
  minBandwidthMbps: number;
  qosClass: string;
  maxCostPerHour: number | null;
}

function DiscoverySection({ data }: { data: HoloComResponse }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<DiscoverFormState>({
    clientId: 'holocom-client-A',
    maxLatencyMs: 12,
    minBandwidthMbps: 800,
    qosClass: 'CONVERSATIONAL',
    maxCostPerHour: 60,
  });
  const [outcome, setOutcome] = useState<HoloDiscoverOutcome | null>(null);

  const discoverMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/vvu/holocom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'discover',
          clientId: form.clientId,
          maxLatencyMs: form.maxLatencyMs,
          minBandwidthMbps: form.minBandwidthMbps,
          qosClass: form.qosClass,
          maxCostPerHour: form.maxCostPerHour,
        }),
      });
      const json = (await res.json()) as { success: boolean; outcome?: HoloDiscoverOutcome; message?: string };
      if (!res.ok || !json.success || !json.outcome) {
        throw new HttpError(json.message ?? `DISCOVERY HTTP ${res.status}`, res.status);
      }
      return json.outcome;
    },
    onSuccess: (oc) => {
      setOutcome(oc);
      toast.success(
        oc.matched ? `DISCOVERY → ${oc.matched.code}` : 'DISCOVERY → NO MATCH',
        { description: oc.reason }
      );
      void queryClient.invalidateQueries({ queryKey: ['vvu-holocom'] });
    },
    onError: (err: HttpError) => {
      toast.error('DISCOVERY REFUSED', { description: err.message });
    },
  });

  const latPreset = [10, 12, 15, 20, 40];
  const bwPreset = [400, 800, 1200, 2000];

  return (
    <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="discovery service">
      <SectionHeader
        num="3"
        title="DISCOVERY SERVICE"
        kicker="PARAMETERIZED KPI REQUESTS → BEST RENDER INSTANCE · §IV-B3"
        right={
          <Chip tone="dim">
            {data.instances.filter((i) => i.status === 'ACTIVE').length} ACTIVE / {data.instances.length} REGISTERED
          </Chip>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* request form */}
        <div className="lg:col-span-5 vvu-panel-solid p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <Radar className="size-3.5 text-[#2ea8a0] shrink-0" aria-hidden />
            <span className="vvu-label text-[9px] font-bold text-[#2ea8a0] tracking-[0.14em]">DISCOVERY REQUEST</span>
          </div>
          <label className="block mb-3">
            <span className="vvu-label text-[8px] text-[#7a8a6e] block mb-1">CLIENT ID</span>
            <input
              type="text"
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value.slice(0, 60) }))}
              className="w-full vvu-label text-[10px] bg-[#060806] border border-[rgba(107,138,64,0.3)] rounded px-2.5 py-2.5 min-h-[44px] text-[#c9d4bd] focus:border-[#2ea8a0] outline-none"
              aria-label="discovery client id"
            />
          </label>
          <div className="mb-3">
            <span className="vvu-label text-[8px] text-[#7a8a6e] block mb-1.5">
              MAX LATENCY — <b className="text-[#f3e38a] tabular-nums">{form.maxLatencyMs}ms</b>
            </span>
            <div className="flex flex-wrap gap-1" role="group" aria-label="max latency budget presets">
              {latPreset.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, maxLatencyMs: v }))}
                  aria-pressed={form.maxLatencyMs === v}
                  className={cn(
                    'vvu6c-btn vvu-label text-[9px] font-bold min-h-[40px] px-2.5 rounded border',
                    form.maxLatencyMs === v
                      ? 'bg-[#c8ff00] text-[#060806] border-[#c8ff00]'
                      : 'border-[rgba(107,138,64,0.25)] text-[#8fb35a] hover:border-[#8fb35a]'
                  )}
                >
                  {v}ms
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <span className="vvu-label text-[8px] text-[#7a8a6e] block mb-1.5">
              MIN BANDWIDTH — <b className="text-[#f3e38a] tabular-nums">{form.minBandwidthMbps}Mbps</b>
            </span>
            <div className="flex flex-wrap gap-1" role="group" aria-label="min bandwidth presets">
              {bwPreset.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, minBandwidthMbps: v }))}
                  aria-pressed={form.minBandwidthMbps === v}
                  className={cn(
                    'vvu6c-btn vvu-label text-[9px] font-bold min-h-[40px] px-2.5 rounded border',
                    form.minBandwidthMbps === v
                      ? 'bg-[#c8ff00] text-[#060806] border-[#c8ff00]'
                      : 'border-[rgba(107,138,64,0.25)] text-[#8fb35a] hover:border-[#8fb35a]'
                  )}
                >
                  {v}M
                </button>
              ))}
            </div>
          </div>
          <label className="block mb-3">
            <span className="vvu-label text-[8px] text-[#7a8a6e] block mb-1">QoS CLASS</span>
            <select
              value={form.qosClass}
              onChange={(e) => setForm((f) => ({ ...f, qosClass: e.target.value }))}
              className="w-full vvu-label text-[10px] bg-[#060806] border border-[rgba(107,138,64,0.3)] rounded px-2.5 py-2.5 min-h-[44px] text-[#c9d4bd] focus:border-[#2ea8a0] outline-none"
              aria-label="QoS class"
            >
              {QOS_CLASSES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label} — {c.hint}
                </option>
              ))}
            </select>
          </label>
          <label className="block mb-4">
            <span className="vvu-label text-[8px] text-[#7a8a6e] block mb-1">
              MAX COST — <b className="text-[#f3e38a] tabular-nums">{form.maxCostPerHour === null ? '∅' : `R${form.maxCostPerHour}/h`}</b>
            </span>
            <input
              type="range"
              min={0}
              max={120}
              step={2}
              value={form.maxCostPerHour ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                setForm((f) => ({ ...f, maxCostPerHour: v === 0 ? null : v }));
              }}
              className="vvu19-range"
              aria-label="max cost per hour, zero for no limit"
            />
            <span className="vvu-label text-[7.5px] text-[#6a7a5e] block mt-0.5">SLIDE TO 0 = NO COST CEILING</span>
          </label>
          <Button
            type="button"
            onClick={() => discoverMut.mutate()}
            disabled={discoverMut.isPending}
            className="w-full min-h-[44px] vvu-label text-[10px] font-bold bg-[#c8ff00] text-black border border-black hover:bg-[#d9ff4d] vvu6c-btn"
          >
            {discoverMut.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Radar className="size-3.5" aria-hidden />}
            RUN DISCOVERY · WORM-LOGGED
          </Button>
        </div>

        {/* result + candidates */}
        <div className="lg:col-span-7 min-w-0 space-y-3">
          {outcome ? (
            <div className={cn('vvu-panel-solid p-3 sm:p-4', outcome.matched ? 'border-[rgba(46,168,160,0.5)]' : 'border-[rgba(224,160,48,0.5)]')}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="vvu-label text-[9px] font-bold text-[#2ea8a0] tracking-[0.14em]">LATEST OUTCOME</span>
                {outcome.matched ? (
                  <Chip tone="teal">
                    MATCHED · {outcome.matched.score}/100 · SESSION PINNED
                  </Chip>
                ) : (
                  <Chip tone="amber">NO MATCH</Chip>
                )}
              </div>
              {outcome.matched ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg sm:text-xl font-bold text-[#c8ff00] vvu19-holo-glow">{outcome.matched.code}</span>
                    <span className="vvu-label text-[8px] text-[#7a8a6e] truncate">{outcome.matched.site} · {outcome.matched.deployment}</span>
                  </div>
                  <ul className="mt-2.5 space-y-1.5">
                    {outcome.matched.breakdown.map((b) => (
                      <li key={b.label} className="flex items-center gap-2 text-[9px] vvu-label">
                        <span className="w-[92px] shrink-0 text-[#7a8a6e] truncate">{b.label}</span>
                        <span className="w-8 shrink-0 text-right text-[#2ea8a0] font-bold tabular-nums">+{b.points}</span>
                        <span className="flex-1 min-w-0 text-[#8a9a7c] truncate">{b.detail}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="vvu-label text-[9px] text-[#e0a030] leading-relaxed">{outcome.reason}</p>
              )}
            </div>
          ) : (
            <div className="vvu-panel-solid p-3 sm:p-4">
              <p className="vvu-label text-[9px] text-[#8a9a7c] leading-relaxed">
                THE DISCOVERY SERVICE KEEPS TRACK OF INSTANCE ADDRESSES <b className="text-[#c9d4bd]">AND</b> CROSS-LAYER
                METRICS DATA — A CLIENT REQUESTS AN INSTANCE THAT FULFILS ITS KPIs AND RECEIVES THE MOST SUITABLE
                RENDERER. RUN A REQUEST TO SEE THE SERVER-SIDE SCORING (HARD GATE + SOFT RANK).
              </p>
            </div>
          )}

          {/* candidate table (registry snapshot) */}
          <div className="vvu-panel-solid p-3 sm:p-4 overflow-x-auto">
            <div className="vvu-label text-[8px] text-[#7a8a6e] tracking-[0.14em] mb-2">REGISTRY · KPI SNAPSHOT</div>
            <table className="w-full text-left border-collapse min-w-[560px]">
              <thead>
                <tr className="border-b border-[rgba(107,138,64,0.3)]">
                  {['INSTANCE', 'DEPLOY', 'LATENCY', 'CAPACITY', 'COST', 'SESSIONS', 'STATUS'].map((h) => (
                    <th key={h} scope="col" className="vvu-label text-[7.5px] text-[#7a8a6e] font-bold py-1.5 pr-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.instances.map((inst) => (
                  <tr key={inst.id} className="border-b border-[rgba(107,138,64,0.12)]">
                    <td className="vvu-label text-[8.5px] text-[#c9d4bd] font-bold py-2 pr-2 whitespace-nowrap">{inst.code}</td>
                    <td className="py-2 pr-2">
                      <Chip tone={inst.deployment === 'EDGE' ? 'teal' : 'dim'}>{inst.deployment}</Chip>
                    </td>
                    <td className="vvu-label text-[9px] text-[#c9d4bd] tabular-nums py-2 pr-2">{fmt2(inst.baseLatencyMs)}ms</td>
                    <td className="vvu-label text-[9px] text-[#c9d4bd] tabular-nums py-2 pr-2">{fmt2(inst.capacityGbps * 1000)}M</td>
                    <td className="vvu-label text-[9px] text-[#c9d4bd] tabular-nums py-2 pr-2">R{fmt2(inst.costPerHour)}</td>
                    <td className="vvu-label text-[9px] text-[#c9d4bd] tabular-nums py-2 pr-2">{inst.sessions}</td>
                    <td className="py-2">
                      <Chip tone={inst.status === 'ACTIVE' ? 'lime' : inst.status === 'DEPLOYING' ? 'amber' : 'crimson'}>
                        {inst.status}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* recent discovery logs */}
          {data.discoveryLogs.length > 0 && (
            <div className="vvu-panel-solid p-3 sm:p-4">
              <div className="vvu-label text-[8px] text-[#7a8a6e] tracking-[0.14em] mb-2">RECENT DISCOVERY LOGS · WORM-BOUND</div>
              <ul className="space-y-1.5 max-h-40 overflow-y-auto custom-scroll">
                {data.discoveryLogs.slice(0, 6).map((l) => (
                  <li key={l.id} className="flex items-center gap-2 text-[8px] vvu-label min-w-0">
                    <span className="text-[#6a7a5e] shrink-0 tabular-nums">{fmtTime(l.createdAt)}</span>
                    <span className="text-[#8a9a7c] shrink-0 truncate max-w-[110px]">{l.clientId}</span>
                    <span className="text-[#7a8a6e] shrink-0">→</span>
                    <span className={cn('font-bold shrink-0', l.matchedCode ? 'text-[#2ea8a0]' : 'text-[#e0a030]')}>
                      {l.matchedCode ?? 'NO MATCH'}
                    </span>
                    <span className="text-[#6a7a5e] truncate flex-1 min-w-0">
                      ≤{l.maxLatencyMs}ms · ≥{l.minBandwidthMbps}M · {l.qosClass}
                    </span>
                    <span className="text-[#6a7a5e] shrink-0 tabular-nums">#{l.wormSeq ?? '—'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── §4 SERVICE BROKER ──────────────────────────────────────────────────────

function BrokerSection({ data }: { data: HoloComResponse }) {
  const queryClient = useQueryClient();
  const frame = useHoloFrame();
  const [siteIndex, setSiteIndex] = useState(0);

  const degraded = (frame?.mtpBreach ?? false) || (frame?.stressLevel ?? 0) >= 2;

  const deployMut = useMutation({
    mutationFn: async (idx: number) => {
      const res = await fetch('/api/vvu/holocom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deploy', siteIndex: idx }),
      });
      const json = (await res.json()) as { success: boolean; instance?: HoloInstance; message?: string };
      if (!res.ok || !json.success || !json.instance) {
        throw new HttpError(json.message ?? `DEPLOY HTTP ${res.status}`, res.status);
      }
      return json.instance;
    },
    onSuccess: (inst) => {
      toast.success(`BROKER DEPLOYED ${inst.code}`, {
        description: `${inst.site} · ${inst.gpuClass} · container boot window ${data.meta.deployWindowSec}s`,
      });
      void queryClient.invalidateQueries({ queryKey: ['vvu-holocom'] });
    },
    onError: (err: HttpError) => toast.error('BROKER DEPLOY REFUSED', { description: err.message }),
  });

  const drainMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch('/api/vvu/holocom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'drain', id }),
      });
      const json = (await res.json()) as { success: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new HttpError(json.message ?? `DRAIN HTTP ${res.status}`, res.status);
      }
      return id;
    },
    onSuccess: (id) => {
      toast.success('INSTANCE DRAINED · SESSIONS RELEASED', { description: id });
      void queryClient.invalidateQueries({ queryKey: ['vvu-holocom'] });
    },
    onError: (err: HttpError) => toast.error('DRAIN REFUSED', { description: err.message }),
  });

  const now = Date.now();

  return (
    <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="service broker">
      <SectionHeader
        num="4"
        title="SERVICE BROKER"
        kicker="RECOMMEND + DEPLOY + DRAIN · DOCKER PULL → UNITY BOOT · §IV-B4"
        right={
          <Chip tone={degraded ? 'crimson' : 'lime'} className={degraded ? 'vvu19-breach' : undefined}>
            {degraded ? 'KPI DEGRADATION DETECTED' : 'SERVICE LEVELS NOMINAL'}
          </Chip>
        }
      />

      {degraded && (
        <div
          className="vvu-panel-solid px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-3"
          style={{ borderColor: 'rgba(224,160,48,0.5)' }}
          role="alert"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="size-4 text-[#e0a030] shrink-0" aria-hidden />
            <span className="vvu-label text-[9px] sm:text-[10px] text-[#e0a030] leading-relaxed min-w-0">
              RENDERING SERVICE QUALITY FALLING — <b>HOLO_MTP_BREACH</b> WORM-LOGGED · PAPER&apos;S TRIGGER: ASK THE
              BROKER FOR A NEW DEPLOYMENT POSSIBILITY
            </span>
          </div>
          <Button
            type="button"
            onClick={() => deployMut.mutate(0)}
            disabled={deployMut.isPending}
            className="min-h-[44px] vvu-label text-[9px] font-bold bg-[#e0a030] text-black border border-black hover:bg-[#eab54a] vvu6c-btn shrink-0"
          >
            {deployMut.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Rocket className="size-3.5" aria-hidden />}
            DEPLOY EDGE INSTANCE
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* deploy controls */}
        <div className="lg:col-span-4 vvu-panel-solid p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <ServerCog className="size-3.5 text-[#2ea8a0] shrink-0" aria-hidden />
            <span className="vvu-label text-[9px] font-bold text-[#2ea8a0] tracking-[0.14em]">DEPLOY NEW INSTANCE</span>
          </div>
          <div className="space-y-2 mb-4" role="radiogroup" aria-label="deployment site">
            {data.meta.deploySites.map((site, i) => (
              <button
                key={site.site}
                type="button"
                role="radio"
                aria-checked={siteIndex === i}
                onClick={() => setSiteIndex(i)}
                className={cn(
                  'w-full text-left p-2.5 rounded border transition-colors min-h-[56px] vvu6c-btn',
                  siteIndex === i
                    ? 'border-[#2ea8a0] bg-[#2ea8a0]/10'
                    : 'border-[rgba(107,138,64,0.25)] hover:border-[#8fb35a]'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="vvu-label text-[9px] font-bold text-[#c9d4bd] truncate">{site.site}</span>
                  <Chip tone={site.deployment === 'EDGE' ? 'teal' : 'dim'}>{site.deployment}</Chip>
                </div>
                <div className="vvu-label text-[7.5px] text-[#7a8a6e] mt-1">
                  {site.region} · {site.gpuClass} · {fmt2(site.baseLatencyMs)}ms · R{fmt2(site.costPerHour)}/h
                </div>
              </button>
            ))}
          </div>
          <Button
            type="button"
            onClick={() => deployMut.mutate(siteIndex)}
            disabled={deployMut.isPending}
            className="w-full min-h-[44px] vvu-label text-[10px] font-bold bg-[#c8ff00] text-black border border-black hover:bg-[#d9ff4d] vvu6c-btn"
          >
            {deployMut.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Rocket className="size-3.5" aria-hidden />}
            DEPLOY · HOLO_INSTANCE_DEPLOY WORM
          </Button>
          <p className="vvu-label text-[7.5px] text-[#6a7a5e] mt-2.5 leading-relaxed">
            STATUS STARTS DEPLOYING; THE API&apos;S LAZY STATE MACHINE PROMOTES IT TO ACTIVE AFTER THE
            {' '}{data.meta.deployWindowSec}s DOCKER PULL + UNITY BOOT WINDOW — WATCH THE REGISTRY POLL (5s).
          </p>
        </div>

        {/* instance fleet */}
        <div className="lg:col-span-8 vvu-panel-solid p-3 sm:p-4 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Boxes className="size-3.5 text-[#2ea8a0] shrink-0" aria-hidden />
            <span className="vvu-label text-[9px] font-bold text-[#2ea8a0] tracking-[0.14em]">
              INSTANCE FLEET · {data.instances.length}
            </span>
          </div>
          <ul className="space-y-2 max-h-[420px] overflow-y-auto custom-scroll pr-1">
            {data.instances.map((inst) => {
              const ageSec = (now - new Date(inst.createdAt).getTime()) / 1000;
              const booting = inst.status === 'DEPLOYING';
              const remaining = Math.max(0, Math.ceil(data.meta.deployWindowSec - ageSec));
              return (
                <li
                  key={inst.id}
                  className={cn(
                    'rounded border p-2.5 sm:p-3',
                    booting
                      ? 'vvu19-deploying border-[rgba(224,160,48,0.5)]'
                      : inst.status === 'DRAINED'
                        ? 'border-[rgba(229,72,77,0.3)] opacity-60'
                        : 'border-[rgba(107,138,64,0.3)]'
                  )}
                  style={
                    booting
                      ? { backgroundImage: 'repeating-linear-gradient(45deg, rgba(224,160,48,0.06) 0 12px, transparent 12px 24px)' }
                      : undefined
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="vvu-label text-[10px] font-bold text-[#c9d4bd] truncate">{inst.code}</span>
                      <Chip tone={inst.deployment === 'EDGE' ? 'teal' : 'dim'}>{inst.deployment}</Chip>
                      <Chip
                        tone={inst.status === 'ACTIVE' ? 'lime' : inst.status === 'DEPLOYING' ? 'amber' : 'crimson'}
                      >
                        {inst.status}
                        {booting ? ` · ${remaining}s` : ''}
                      </Chip>
                    </div>
                    {inst.status !== 'DRAINED' && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => drainMut.mutate(inst.id)}
                        disabled={drainMut.isPending || drainMut.variables === inst.id}
                        className="min-h-[36px] px-2.5 vvu-label text-[8px] font-bold border-[#e5484d]/50 text-[#e5484d] hover:bg-[#e5484d]/10 hover:text-[#e5484d] vvu6c-btn shrink-0"
                        aria-label={`drain instance ${inst.code}`}
                      >
                        {drainMut.isPending && drainMut.variables === inst.id ? (
                          <Loader2 className="size-3 animate-spin" aria-hidden />
                        ) : (
                          'DRAIN'
                        )}
                      </Button>
                    )}
                  </div>
                  <div className="vvu-label text-[7.5px] text-[#7a8a6e] mt-1.5 truncate">
                    {inst.site} · {inst.region} · {inst.engine} · {inst.gpuClass} · {fmt2(inst.baseLatencyMs)}ms ·
                    R{fmt2(inst.costPerHour)}/h · {inst.sessions} SESSION{inst.sessions === 1 ? '' : 'S'}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <UtilMeter label="CPU" value={inst.cpuUtil} />
                    <UtilMeter label="GPU" value={inst.gpuUtil} />
                    <UtilMeter label="MEM" value={inst.memUtil} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ─── §5 QoE ALIGNMENT ───────────────────────────────────────────────────────

function QoeSection({ data }: { data: HoloComResponse }) {
  const frame = useHoloFrame();
  const queryClient = useQueryClient();
  const lastCommitRef = useRef(0);

  // live advisory estimate (client-side pure module — server recomputes on commit)
  const live = useMemo(
    () =>
      predictMos({
        latencyMs: frame?.mtpTotalMs ?? 19.5,
        jitterMs: frame?.network.jitterMs ?? 0.5,
        lossPct: frame?.network.lossPct ?? 0.3,
        stallMs: frame?.network.stallMs ?? 0,
        codec: 'H265',
      }),
    [frame?.mtpTotalMs, frame?.network.jitterMs, frame?.network.lossPct, frame?.network.stallMs]
  );

  // throttled evidence commits — POST the RAW KPIs every 30s; the server
  // recomputes MOS and owns the stored sample (never trusts a client score).
  useEffect(() => {
    const id = setInterval(() => {
      const f = frame;
      if (!f) return;
      if (Date.now() - lastCommitRef.current < 30_000) return;
      lastCommitRef.current = Date.now();
      void fetch('/api/vvu/holocom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'qoe',
          latencyMs: f.mtpTotalMs,
          jitterMs: f.network.jitterMs,
          lossPct: f.network.lossPct,
          stallMs: f.network.stallMs,
          codec: 'H265',
        }),
      })
        .then((r) => {
          if (r.ok) void queryClient.invalidateQueries({ queryKey: ['vvu-holocom'] });
        })
        .catch(() => {
          /* offline — best effort evidence stream */
        });
    }, 5_000);
    return () => clearInterval(id);
  }, [frame, queryClient]);

  const samples = useMemo(() => [...data.qoeSamples].reverse(), [data.qoeSamples]);
  const bandColor = (band: string): string =>
    band === 'EXCELLENT' ? '#c8ff00' : band === 'GOOD' ? '#8fb35a' : band === 'FAIR' ? '#e0a030' : '#e5484d';

  return (
    <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="QoE alignment">
      <SectionHeader
        num="5"
        title="QoE ALIGNMENT"
        kicker="ITU-T P.1203-INSPIRED MOS MODEL · CONVERSATIONAL CONSTRUCTS · §IV-D"
        right={
          <Chip tone={live.band === 'EXCELLENT' || live.band === 'GOOD' ? 'lime' : live.band === 'FAIR' ? 'amber' : 'crimson'}>
            LIVE {live.band} · MOS {fmt2(live.mos)}
          </Chip>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* live MOS + penalties */}
        <div className="lg:col-span-4 vvu-panel-solid p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="size-3.5 text-[#2ea8a0] shrink-0" aria-hidden />
            <span className="vvu-label text-[9px] font-bold text-[#2ea8a0] tracking-[0.14em]">PREDICTED MOS · LIVE</span>
          </div>
          <div className="flex items-end gap-3 mb-3">
            <span className="text-4xl sm:text-5xl font-bold tabular-nums vvu19-holo-glow" style={{ color: bandColor(live.band) }}>
              {fmt2(live.mos)}
            </span>
            <span className="vvu-label text-[9px] text-[#7a8a6e] pb-2">/ 5.0 · ACR</span>
          </div>
          {/* 5-point ACR scale strip */}
          <div className="flex h-2.5 rounded-sm overflow-hidden border border-[rgba(107,138,64,0.25)]" aria-hidden>
            {[1, 2, 3, 4, 5].map((v) => (
              <div key={v} className="flex-1" style={{ background: bandColor(v >= 4.3 ? 'EXCELLENT' : v >= 3.8 ? 'GOOD' : v >= 3 ? 'FAIR' : 'POOR'), opacity: live.mos >= v ? 1 : 0.25 }} />
            ))}
          </div>
          <ul className="mt-3 space-y-1.5">
            {live.penalties.map((p) => (
              <li key={p.label} className="flex items-center gap-2 text-[9px] vvu-label">
                <span className="w-[64px] shrink-0 text-[#7a8a6e]">{p.label}</span>
                <div className="flex-1 h-1.5 rounded bg-[#131811] overflow-hidden">
                  <div className="h-full rounded bg-[#e5484d]/80" style={{ width: `${Math.min(100, (p.points / 2.2) * 100)}%` }} />
                </div>
                <span className="w-14 shrink-0 text-right text-[#e5484d] tabular-nums">−{fmt2(p.points)}</span>
                <span className="w-20 shrink-0 text-right text-[#6a7a5e] tabular-nums truncate">{p.detail}</span>
              </li>
            ))}
          </ul>
          <p className="vvu-label text-[7.5px] text-[#6a7a5e] mt-3 leading-relaxed">
            RAW KPIs COMMIT TO /api/vvu/holocom (action qoe) EVERY ~30s — THE SERVER RECOMPUTES THE MOS AND WRITES
            THE WORM-BOUND SAMPLE. THIS PANEL&apos;S PREVIEW IS ADVISORY ONLY.
          </p>
        </div>

        {/* constructs + history */}
        <div className="lg:col-span-8 min-w-0 space-y-3">
          <div className="vvu-panel-solid p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-3">
              <Orbit className="size-3.5 text-[#2ea8a0] shrink-0" aria-hidden />
              <span className="vvu-label text-[9px] font-bold text-[#2ea8a0] tracking-[0.14em]">
                CONVERSATIONAL CONSTRUCTS (§IV-D QUESTIONNAIRES)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(
                [
                  ['CO-PRESENCE', live.constructs.coPresence, 'sense of being together'],
                  ['IMMERSION', live.constructs.immersion, 'freezing artifacts dominate'],
                  ['REALISM', live.constructs.realism, 'loss/concealment artifacts'],
                ] as const
              ).map(([label, value, hint]) => (
                <div key={label} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="vvu-label text-[8px] text-[#7a8a6e] truncate">{label}</span>
                    <span className="vvu-label text-[10px] font-bold tabular-nums" style={{ color: bandColor(value >= 4.3 ? 'EXCELLENT' : value >= 3.8 ? 'GOOD' : value >= 3 ? 'FAIR' : 'POOR') }}>
                      {fmt2(value)}
                    </span>
                  </div>
                  <div className="vvu19-meter" role="meter" aria-label={label} aria-valuemin={1} aria-valuemax={5} aria-valuenow={value}>
                    <div className="vvu19-meter-fill" style={{ width: `${((value - 1) / 4) * 100}%`, background: HOLO_TEAL }} />
                  </div>
                  <p className="vvu-label text-[7px] text-[#6a7a5e] mt-1 truncate">{hint}</p>
                </div>
              ))}
            </div>
          </div>

          {/* stored MOS history (server samples) */}
          <div className="vvu-panel-solid p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Activity className="size-3.5 text-[#2ea8a0] shrink-0" aria-hidden />
                <span className="vvu-label text-[9px] font-bold text-[#2ea8a0] tracking-[0.14em]">
                  STORED MOS EVIDENCE · {samples.length} SAMPLES
                </span>
              </div>
              <Chip tone="dim" dashed>
                SERVER-RECOMPUTED · WORM #S {samples.length > 0 ? `${samples[0]?.wormSeq ?? '—'}…${samples[samples.length - 1]?.wormSeq ?? '—'}` : '—'}
              </Chip>
            </div>
            {samples.length === 0 ? (
              <p className="vvu-label text-[9px] text-[#7a8a6e] py-4 text-center">
                FIRST SAMPLE LANDS ~30s AFTER THIS VIEW MOUNTS (THROTTLED COMMIT STREAM).
              </p>
            ) : (
              <div className="flex items-end gap-1 h-24 sm:h-28 overflow-x-auto custom-scroll" aria-label="stored MOS sample history">
                {samples.slice(-60).map((s) => (
                  <div
                    key={s.id}
                    title={`MOS ${fmt2(s.mos)} · ${fmtTime(s.createdAt)} · MTP ${fmt2(s.latencyMs)}ms · loss ${fmt2(s.lossPct)}%`}
                    className="flex-1 min-w-[6px] rounded-t"
                    style={{
                      height: `${((s.mos - 1) / 4) * 100}%`,
                      background: bandColor(s.mos >= 4.3 ? 'EXCELLENT' : s.mos >= 3.8 ? 'GOOD' : s.mos >= 3 ? 'FAIR' : 'POOR'),
                      opacity: 0.85,
                    }}
                    role="img"
                    aria-label={`MOS sample ${fmt2(s.mos)} at ${fmtTime(s.createdAt)}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── §6a AI QoS PREDICTION (offline/online surrogate) ───────────────────────

function PredictionSection() {
  const history = useHoloHistory();
  const values = useMemo(() => history.map((f) => f.mtpTotalMs), [history]);
  const pred = useMemo(() => predictQos(values, 10), [values]);

  // SVG geometry: history occupies x 0..0.6W, prediction 0.6W..W
  const W = 320;
  const H = 96;
  const PAD = 4;
  const splitX = W * 0.6;
  const allVals = [...values, ...pred.predicted];
  const lo = Math.min(18, ...allVals) - 1;
  const hi = Math.max(22, ...allVals) + 1;
  const y = (v: number): number => PAD + ((hi - v) / (hi - lo)) * (H - 2 * PAD);
  const histStep = values.length > 1 ? splitX / (values.length - 1) : 0;
  const predStep = pred.predicted.length > 0 ? (W - splitX - PAD) / pred.predicted.length : 0;

  const histPoints = values.map((v, i) => `${(PAD + i * histStep).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const predBase = values.length > 0 ? splitX : PAD;
  const predPoints = pred.predicted.map((v, i) => `${(predBase + (i + 1) * predStep).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const bandPolygon =
    pred.predicted.length > 0 && values.length > 0
      ? [
          `${predBase.toFixed(1)},${y(values[values.length - 1]).toFixed(1)}`,
          ...pred.predicted.map((v, i) => `${(predBase + (i + 1) * predStep).toFixed(1)},${y(v + pred.confidence[i]).toFixed(1)}`),
          ...[...pred.predicted]
              .reverse()
              .map((v, i) => `${(W - PAD - i * predStep).toFixed(1)},${y(v - pred.confidence[pred.confidence.length - 1 - i]).toFixed(1)}`),
        ].join(' ')
      : '';

  const targetY = y(20);

  return (
    <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="AI QoS prediction">
      <SectionHeader
        num="6"
        title="AI QoS PREDICTION · FOUNTAIN CODING LAB"
        kicker="OFFLINE MODEL → ONLINE PREDICTION HORIZON · RATELESS ADAPTATION · §IV-E"
        right={
          <Chip tone="teal">
            <LiveDot color={HOLO_TEAL} /> {values.length} LIVE SAMPLES
          </Chip>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* prediction curve */}
        <div className="lg:col-span-7 vvu-panel-solid p-3 sm:p-4 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="vvu-label text-[9px] font-bold text-[#2ea8a0] tracking-[0.14em]">
              MTP PREDICTION · 10-STEP HORIZON
            </span>
            <Chip tone={pred.trendPerStep > 0.05 ? 'amber' : pred.trendPerStep < -0.05 ? 'lime' : 'dim'}>
              TREND {pred.trendPerStep >= 0 ? '+' : ''}{fmt2(pred.trendPerStep)}ms/step
            </Chip>
          </div>
          {values.length < 3 ? (
            <p className="vvu-label text-[9px] text-[#7a8a6e] py-8 text-center">
              COLLECTING LIVE FRAMES ({values.length}/3+) · TELEMETRY 3s CADENCE — PREDICTION ONLINE SHORTLY
            </p>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28 sm:h-32" role="img" aria-label="MTP history and prediction curve with confidence band">
              {/* gridlines */}
              {[0.25, 0.5, 0.75].map((f) => (
                <line key={f} x1={PAD} x2={W - PAD} y1={PAD + f * (H - 2 * PAD)} y2={PAD + f * (H - 2 * PAD)} stroke="rgba(107,138,64,0.15)" strokeWidth="0.5" />
              ))}
              {/* 6G target line */}
              <line x1={PAD} x2={W - PAD} y1={targetY} y2={targetY} stroke="#c8ff00" strokeWidth="0.75" strokeDasharray="3 3" />
              <text x={W - PAD} y={targetY - 2} textAnchor="end" fill="#c8ff00" fontSize="7" fontFamily="inherit">
                6G 20ms
              </text>
              {/* confidence band */}
              {bandPolygon && <polygon points={bandPolygon} fill="rgba(46,168,160,0.15)" />}
              {/* history */}
              <polyline points={histPoints} fill="none" stroke={HOLO_TEAL} strokeWidth="1.5" strokeLinejoin="round" />
              {/* prediction */}
              <polyline points={predPoints} fill="none" stroke="#f3e38a" strokeWidth="1.5" strokeDasharray="4 3" strokeLinejoin="round" />
              {/* now marker */}
              {values.length > 0 && (
                <circle cx={splitX} cy={y(values[values.length - 1])} r="2.5" fill="#c8ff00" />
              )}
            </svg>
          )}
          <div className="flex flex-wrap gap-2 mt-1">
            <Chip tone="teal">EMA {fmt2(pred.ema)}ms</Chip>
            <Chip tone="ochre">PREDICTED {pred.predicted.length > 0 ? `${fmt2(pred.predicted[0])}→${fmt2(pred.predicted[pred.predicted.length - 1])}ms` : '—'}</Chip>
            <Chip tone="dim" dashed>
              EMA + WEIGHTED LS SURROGATE (LSTM/DRL STAND-IN — LABELED HONESTLY)
            </Chip>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3 vvu-label text-[7.5px] text-[#7a8a6e]">
            <div className="vvu-panel-solid p-2 leading-relaxed">
              <b className="text-[#8fb35a]">OFFLINE PHASE</b> — QoS data collected via monitoring, processed to
              train and periodically update the prediction model (this sandbox: deterministic surrogate, no NN).
            </div>
            <div className="vvu-panel-solid p-2 leading-relaxed">
              <b className="text-[#8fb35a]">ONLINE PHASE</b> — per request: input features projected over the
              prediction horizon, real-time measurements fold in, trained model answers.
            </div>
          </div>
        </div>

        <FountainLab />
      </div>
    </section>
  );
}

// ─── §6b FOUNTAIN CODING LAB ────────────────────────────────────────────────

function FountainLab() {
  const queryClient = useQueryClient();
  const frame = useHoloFrame();
  const [lossPct, setLossPct] = useState(5);
  const [targetR, setTargetR] = useState(0.999);
  const [committed, setCommitted] = useState<HoloCodingResult | null>(null);

  const live = useMemo(() => fountainCoding(lossPct, targetR, 16), [lossPct, targetR]);

  const commitMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/vvu/holocom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'coding', lossPct, targetReliability: targetR, payloadSymbols: 16 }),
      });
      const json = (await res.json()) as { success: boolean; result?: HoloCodingResult; message?: string };
      if (!res.ok || !json.success || !json.result) {
        throw new HttpError(json.message ?? `CODING HTTP ${res.status}`, res.status);
      }
      return json.result;
    },
    onSuccess: (result) => {
      setCommitted(result);
      toast.success(`CODING RATE ${result.codingRate} COMMITTED`, {
        description: `k=16 + ${result.extraSymbols} fountain symbols · WORM #${result.wormSeq}`,
      });
      void queryClient.invalidateQueries({ queryKey: ['vvu-holocom'] });
    },
    onError: (err: HttpError) => toast.error('CODING COMMIT REFUSED', { description: err.message }),
  });

  return (
    <div className="lg:col-span-5 vvu-panel-solid p-3 sm:p-4 min-w-0">
      <div className="flex items-center gap-2 mb-3">
        <Waves className="size-3.5 text-[#2ea8a0] shrink-0" aria-hidden />
        <span className="vvu-label text-[9px] font-bold text-[#2ea8a0] tracking-[0.14em]">TWO-STAGE FEC + FOUNTAIN LAB</span>
      </div>

      <label className="block mb-3">
        <span className="vvu-label text-[8px] text-[#7a8a6e] block mb-1">
          CHANNEL ERASURE — <b className="text-[#f3e38a] tabular-nums">{fmt2(lossPct)}%</b>
          {frame && <span className="text-[#6a7a5e]"> · live channel {fmt2(frame.network.lossPct)}%</span>}
        </span>
        <input
          type="range"
          min={0.1}
          max={30}
          step={0.1}
          value={lossPct}
          onChange={(e) => setLossPct(Number(e.target.value))}
          className="vvu19-range"
          aria-label="channel erasure probability percent"
        />
        <div className="flex justify-between vvu-label text-[7px] text-[#6a7a5e] mt-0.5">
          <span>0.1%</span>
          <button
            type="button"
            onClick={() => setLossPct(Math.max(0.1, Math.round(frame?.network.lossPct ?? 5)))}
            className="vvu-label text-[7px] text-[#2ea8a0] underline underline-offset-2 min-h-[28px] px-1 vvu6c-btn"
            aria-label="sync slider to live channel loss"
          >
            SYNC TO LIVE
          </button>
          <span>30%</span>
        </div>
      </label>

      <div className="mb-3">
        <span className="vvu-label text-[8px] text-[#7a8a6e] block mb-1.5">TARGET RELIABILITY</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="target decode reliability">
          {[0.99, 0.999, 0.9999].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setTargetR(v)}
              aria-pressed={targetR === v}
              className={cn(
                'vvu6c-btn vvu-label text-[9px] font-bold min-h-[40px] px-2.5 rounded border',
                targetR === v
                  ? 'bg-[#c8ff00] text-[#060806] border-[#c8ff00]'
                  : 'border-[rgba(107,138,64,0.25)] text-[#8fb35a] hover:border-[#8fb35a]'
              )}
            >
              {(v * 100).toFixed(v === 0.99 ? 0 : v === 0.999 ? 1 : 2)}%
            </button>
          ))}
        </div>
      </div>

      {/* symbol stack — payload vs fountain */}
      <div className="flex items-center gap-2 mb-3" aria-hidden>
        <div className="flex gap-0.5">
          {Array.from({ length: Math.min(16, live.payloadSymbols) }).map((_, i) => (
            <div key={`p${i}`} className="w-2.5 h-6 rounded-sm bg-[#8fb35a]/80 border border-[#6b8a40]" title="payload symbol" />
          ))}
        </div>
        <span className="vvu-label text-[8px] text-[#7a8a6e] shrink-0">k=16</span>
        <div className="flex gap-0.5">
          {Array.from({ length: Math.min(24, live.extraSymbols) }).map((_, i) => (
            <div key={`f${i}`} className="w-2.5 h-6 rounded-sm bg-[#2ea8a0]/70 border border-[#2ea8a0]" title="fountain symbol" />
          ))}
        </div>
        <span className="vvu-label text-[8px] text-[#7a8a6e] shrink-0">+{live.extraSymbols}</span>
      </div>
      <p className="sr-only">
        {live.payloadSymbols} payload symbols plus {live.extraSymbols} fountain symbols at {fmt2(lossPct)} percent erasure.
      </p>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-4">
        {(
          [
            ['CODING RATE', `${fmt2(live.codingRate)}`, '#c8ff00'],
            ['OVERHEAD', `+${live.overheadPct}%`, HOLO_TEAL],
            ['TRANSMITTED', `${live.transmittedSymbols} sym`, undefined],
            ['ACHIEVED', `${(live.achievableReliability * 100).toFixed(3)}%`, live.meetsTarget ? '#c8ff00' : '#e5484d'],
          ] as const
        ).map(([label, value, color]) => (
          <div key={label} className="min-w-0">
            <div className="vvu-label text-[7.5px] text-[#7a8a6e] truncate">{label}</div>
            <div className="vvu-label text-xs font-bold tabular-nums" style={{ color: color ?? '#c9d4bd' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        onClick={() => commitMut.mutate()}
        disabled={commitMut.isPending}
        className="w-full min-h-[44px] vvu-label text-[10px] font-bold bg-[#c8ff00] text-black border border-black hover:bg-[#d9ff4d] vvu6c-btn"
      >
        {commitMut.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Waves className="size-3.5" aria-hidden />}
        COMMIT RATE · HOLO_CODING_RATE WORM
      </Button>
      {committed && (
        <p className="vvu-label text-[7.5px] text-[#6a7a5e] mt-2 leading-relaxed">
          LAST COMMIT: rate {fmt2(committed.codingRate)} · k=16+{committed.extraSymbols} · target{' '}
          {(committed.targetReliability * 100).toFixed(3)}% · WORM #{committed.wormSeq} — &ldquo;coding rate adjusted
          on the fly&rdquo;, exactly the paper&apos;s §IV-E promise.
        </p>
      )}
      <p className="vvu-label text-[7.5px] text-[#6a7a5e] mt-2 leading-relaxed">
        STAGE 1 FEC TURNS THE CHANNEL INTO A PACKET-ERASURE CHANNEL; STAGE 2 FOUNTAIN (RATELESS) CODES GENERATE AN
        ARBITRARY NUMBER OF SUB-CODEWORDS — ONLY A CERTAIN NUMBER IS REQUIRED TO DECODE. RATE = k / (k + extra).
      </p>
    </div>
  );
}

// ─── HOLOCOM WORM strip (recent source=HOLOCOM events off the live chain) ──

function HoloWormStrip() {
  const wormChain = useWormChain();
  const holoEvents = useMemo(
    () => wormChain.filter((e) => e.source === 'HOLOCOM').slice(-8).reverse(),
    [wormChain]
  );
  return (
    <section className="vvu-panel vvu-enter p-3 sm:p-4" aria-label="holocom WORM events">
      <SectionHeader
        title="HOLOCOM WORM EVENTS"
        kicker="SHA-256 CHAIN · SOURCE HOLOCOM · LIVE SOCKET FEED"
        right={
          <Chip tone={holoEvents.length ? 'lime' : 'dim'} dashed>
            {holoEvents.length} RECENT
          </Chip>
        }
      />
      {holoEvents.length === 0 ? (
        <p className="vvu-label text-[9px] text-[#7a8a6e] py-3">
          NO HOLOCOM EVENTS ON THE LIVE CHAIN YET — INJECT STRESS OR RUN DISCOVERY/DEPLOY/QOE TO SEE THEM LAND.
        </p>
      ) : (
        <ul className="space-y-1 max-h-44 overflow-y-auto custom-scroll">
          {holoEvents.map((e) => (
            <li key={e.seq} className="flex items-center gap-2 text-[8px] vvu-label min-w-0">
              <span className="text-[#c8ff00] shrink-0 tabular-nums">#{e.seq}</span>
              <span className="text-[#f3e38a] shrink-0 font-bold truncate max-w-[180px]">{e.event}</span>
              <span className="text-[#8a9a7c] truncate flex-1 min-w-0">{e.details}</span>
              <span className="text-[#6a7a5e] shrink-0 tabular-nums">{fmtTime(new Date(e.ts).toISOString())}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Workspace assembly ─────────────────────────────────────────────────────

export function HoloComWorkspace() {
  const connected = useConnected();
  const frame = useHoloFrame();

  const { data, isError, error, refetch } = useQuery<HoloComResponse, HttpError>({
    queryKey: ['vvu-holocom'],
    queryFn: async () => {
      const res = await fetch('/api/vvu/holocom', { cache: 'no-store' });
      if (!res.ok) throw new HttpError(`HOLOCOM FEED HTTP ${res.status}`, res.status);
      return (await res.json()) as HoloComResponse;
    },
    refetchInterval: 5000,
    staleTime: 3000,
  });
  useQueryErrorToast(isError, error, 'HOLOCOM');

  const liveMos = predictMos({
    latencyMs: frame?.mtpTotalMs ?? 19.5,
    jitterMs: frame?.network.jitterMs ?? 0.5,
    lossPct: frame?.network.lossPct ?? 0.3,
    stallMs: frame?.network.stallMs ?? 0,
  });

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <ScadaPolishStyles />
      <HoloStyles />

      <div className="max-w-[1320px] mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-5 sm:space-y-6 pb-24">
        {!connected && (
          <div
            className="vvu-panel-solid px-4 py-2 flex items-center gap-2"
            style={{ borderColor: 'rgba(224,160,48,0.45)' }}
            role="status"
          >
            <AlertTriangle className="size-3.5 text-[#e0a030] shrink-0" aria-hidden />
            <span className="vvu-label text-[10px] text-[#e0a030]">
              TELEMETRY SERVICE OFFLINE · HOLOCOM CROSS-LAYER FRAMES FROZEN
            </span>
          </div>
        )}

        {/* headline */}
        <SectionReveal>
          <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="holocom headline">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="min-w-0">
                <h1 className="vvu-label text-lg sm:text-2xl font-bold text-[#f3e38a] tracking-[0.14em]">
                  TRUE 3D HOLOGRAPHY · 6G NeXt
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <Chip tone="teal">HOLOCOM USE CASE · SPLIT COMPUTING</Chip>
                  <Chip tone="dim" dashed>
                    ROUTE 4 · HOLOCOM PROJECTION
                  </Chip>
                  <Chip tone="dim">FRIESE ET AL. · BMBF 16KISK17x</Chip>
                </div>
              </div>
              <StressControl />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-4">
              <StatTile
                label="MTP · MOTION-TO-PHOTON"
                value={frame ? fmt2(frame.mtpTotalMs) : '—'}
                unit="ms"
                tone={frame ? (frame.mtpBreach ? 'crimson' : 'lime') : 'teal'}
                sub={frame ? `6G TARGET ≤ 20ms · ${frame.mtpBreach ? 'BREACH' : 'ON TARGET'}` : 'AWAITING FRAME'}
              />
              <StatTile
                label="PREDICTED MOS · ACR"
                value={frame ? fmt2(liveMos.mos) : '—'}
                unit="/5"
                tone={liveMos.mos >= 4.3 ? 'lime' : liveMos.mos >= 3.8 ? 'teal' : liveMos.mos >= 3 ? 'amber' : 'crimson'}
                sub={liveMos.band}
              />
              <StatTile
                label="RENDER INSTANCES"
                value={data ? String(data.instances.filter((i) => i.status === 'ACTIVE').length) : '—'}
                unit="ACTIVE"
                tone="teal"
                sub={data ? `${data.instances.length} REGISTERED · ${data.instances.filter((i) => i.deployment === 'EDGE').length} EDGE` : undefined}
              />
              <StatTile
                label="CHANNEL STRESS"
                value={`L${frame?.stressLevel ?? 0}`}
                unit={STRESS_NAMES[frame?.stressLevel ?? 0]}
                tone={(frame?.stressLevel ?? 0) >= 2 ? 'crimson' : (frame?.stressLevel ?? 0) === 1 ? 'amber' : 'lime'}
                sub={frame ? `LOSS ${fmt2(frame.network.lossPct)}% · JITTER ${fmt2(frame.network.jitterMs)}ms` : undefined}
              />
            </div>
          </section>
        </SectionReveal>

        {isError || !data ? (
          <QueryErrorCard label="HOLOCOM FEED" onRetry={() => void refetch()} />
        ) : (
          <>
            <SectionReveal featured>
              <MtpPipeline />
            </SectionReveal>
            <SectionReveal>
              <CrossLayerMetrics />
            </SectionReveal>
            <SectionReveal featured>
              <DiscoverySection data={data} />
            </SectionReveal>
            <SectionReveal>
              <BrokerSection data={data} />
            </SectionReveal>
            <SectionReveal featured>
              <QoeSection data={data} />
            </SectionReveal>
            <SectionReveal>
              <PredictionSection />
            </SectionReveal>
            <SectionReveal>
              <HoloWormStrip />
            </SectionReveal>
          </>
        )}

        {/* citation footer strip */}
        <div className="vvu-panel-solid p-3">
          <p className="vvu-label text-[7.5px] sm:text-[8px] text-[#6a7a5e] leading-relaxed">
            SOURCE FRAMEWORK — I. FRIESE, M. GALKOW-SCHNEIDER, L. BASSBOUSS, A. ZOUBAREV, A. NEPARIDZE, S. MELNYK,
            Q. ZHOU, H. D. SCHOTTEN, T. PFANDZELTER, D. BERMBACH, A. KRITZNER, E. ZSCHAU, P. DHARA, S. GÖRING,
            W. MENZ, A. RAAKE, W. RÜTHER-KINDEL, F. QUAECK, N. STUCKERT, R. VILTER: &ldquo;TRUE 3D HOLOGRAPHY: A
            COMMUNICATION SERVICE OF TOMORROW AND ITS REQUIREMENTS FOR A NEW CONVERGED CLOUD AND NETWORK
            ARCHITECTURE ON THE PATH TO 6G&rdquo; — PROJECT 6G NeXt, BMBF 16KISK174K–183. ADAPTED TO THE VVU
            SANDBOX: SERVER-AUTHORITATIVE SCORING + WORM EVIDENCE + SOCKET TELEMETRY INSTEAD OF 3GPP EDGEAPP /
            POSTGRESQL / RAFT.
          </p>
        </div>
      </div>
    </div>
  );
}

export default HoloComWorkspace;
