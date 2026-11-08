'use client';

// src/components/analytics/TrustGates.tsx — Trust Gates 3A/3B/3C with LIVE
// certification. Progress bars read the live sim (useFrame metrics); the
// CERTIFY button POSTs /api/vvu/gates which checks sim conditions, appends a
// WORM event and unlocks Class B shares into the voting ledger.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileCheck2, Loader2, Network, ShieldCheck, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useConnected, useFrame, useSimSkip } from '@/hooks/use-vvu-socket';
import { MRR_TARGET } from '@/lib/vvu-data';
import { cn } from '@/lib/utils';
import type { GateRecord, TelemetryFrame, VotingLedger } from '@/types/vvu';
import {
  Chip,
  HttpError,
  LiveBar,
  QueryErrorCard,
  SectionHeader,
  fmtNum,
  fmtStamp,
  useAnalyticsQuery,
  useQueryErrorToast,
  type BarSpec,
} from './shared';

type GateId = GateRecord['gateId'];

// Gate accent tones: 3A amber · 3B sage · 3C teal.
const GATE_TONE: Record<GateId, string> = {
  '3A': 'border-[#e0a030]/50 text-[#e0a030]',
  '3B': 'border-[#8fb35a]/50 text-[#8fb35a]',
  '3C': 'border-[#2ea8a0]/50 text-[#2ea8a0]',
};

// Task 9-b: distinct header icon per gate — breaks the three-card text
// monotony (VLM round-9 finding #1) and anchors each headline visually.
// Task 10-b: 3C Server → Network — a compliance-nodes glyph distinct from
// generic compute iconography (VLM round-10 finding #7).
const GATE_ICON: Record<GateId, typeof FileCheck2> = {
  '3A': FileCheck2,
  '3B': TrendingUp,
  '3C': Network,
};
const GATE_ICON_TONE: Record<GateId, string> = {
  '3A': 'text-[#e0a030]',
  '3B': 'text-[#8fb35a]',
  '3C': 'text-[#2ea8a0]',
};

interface GateApiResponse {
  success: boolean;
  message?: string;
  gate?: GateId;
  shares?: number;
  certHash?: string;
  conditionsVerified?: 'VERIFIED' | 'UNVERIFIED' | 'NOT_MET';
  voting?: VotingLedger;
}

interface GateLive {
  met: boolean | null;
  bars: BarSpec[];
  /** 3B only — current consecutive-months-at-R50k streak for the symmetry
   *  chip under the bars (Task 10-b: every gate gets a state chip in that
   *  slot so the three columns keep balanced visual weight). */
  streakMonths: number | null;
  /** 3C only — non-null while the sim clamps steady hours at 71.9h (one tick
   *  short of the 72h condition) awaiting an explicit SIM SKIP 3C. */
  steadyHoldHours: number | null;
}

/** Live sim conditions — mirrored exactly from the telemetry frame metrics. */
function gateLive(gateId: GateId, frame: TelemetryFrame | null): GateLive {
  const m = frame?.metrics ?? null;
  switch (gateId) {
    case '3A':
      return {
        met: m ? m.customers >= 1 : null,
        bars: [{ label: 'CUSTOMERS · CLEARED R5K PILOT', current: m?.customers ?? null, target: 1, fmt: 'num' }],
        streakMonths: null,
        steadyHoldHours: null,
      };
    case '3B':
      return {
        met: m ? m.mrr >= MRR_TARGET && m.consecutiveMonthsAt50k >= 2 : null,
        bars: [
          { label: 'MRR', current: m?.mrr ?? null, target: MRR_TARGET, fmt: 'rand' },
          { label: 'CONSECUTIVE MONTHS AT R50K', current: m?.consecutiveMonthsAt50k ?? null, target: 2, unit: 'mo', fmt: 'num' },
        ],
        streakMonths: m?.consecutiveMonthsAt50k ?? null,
        steadyHoldHours: null,
      };
    case '3C': {
      // Task 7-a/7-b — the sim clamps steady accrual at 71.9h (one tick short
      // of the 72h condition) and flags it via metrics.steadyFrozen until an
      // explicit SIM SKIP 3C is issued. Surface the hold on the card.
      const frozen = m?.steadyFrozen === true;
      return {
        met: m ? m.nodesSteady >= 3 && m.steadyStateHours >= 72 : null,
        bars: [
          { label: 'STEADY NODES', current: m?.nodesSteady ?? null, target: 3, fmt: 'num' },
          {
            label: 'STEADY-STATE HOURS',
            current: m?.steadyStateHours ?? null,
            target: 72,
            fmt: 'hours',
            baseline: 66.2,
            note: frozen
              ? 'ACCRUAL HELD ONE TICK BELOW 72H · RELEASE VIA DEMO FAST-PATH 3C (SIM SKIP)'
              : 'ACCRUES WHILE FSM = STEADY_STATE_LOCKED · SPEED ×1/×5/×20 ACCELERATES',
          },
        ],
        streakMonths: null,
        steadyHoldHours: frozen ? (m?.steadyStateHours ?? 71.9) : null,
      };
    }
  }
}

function GateSkeletons() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="vvu-panel-solid p-4 space-y-3" aria-hidden>
          <Skeleton className="h-6 w-2/3 bg-[#141a11]" />
          <Skeleton className="h-4 w-full bg-[#141a11]" />
          <Skeleton className="h-4 w-1/2 bg-[#141a11]" />
          <Skeleton className="h-2 w-full bg-[#141a11]" />
          <Skeleton className="h-2 w-full bg-[#141a11]" />
          <Skeleton className="h-11 w-full bg-[#141a11]" />
        </div>
      ))}
    </>
  );
}

function GateCard({
  gate,
  live,
  certifying,
  anyCertifying,
  onCertify,
}: {
  gate: GateRecord;
  live: GateLive;
  certifying: boolean;
  anyCertifying: boolean;
  onCertify: (gate: GateId) => void;
}) {
  const certified = gate.status === 'CERTIFIED';
  const canCertify = !certified && live.met === true && !anyCertifying;

  const statusChip = certified ? (
    <span className="vvu-label text-[10px] font-bold px-2.5 py-1 rounded bg-[#c8ff00] text-[#060806] inline-flex items-center gap-1">
      <ShieldCheck className="size-3" aria-hidden /> CERTIFIED ✓
    </span>
  ) : live.met === true ? (
    // Task 7-b: READY TO CERTIFY gets a lime bg tint + subtle glow so it reads
    // clearly distinct from the amber CONDITIONS PENDING chip (Chip API is
    // unchanged — local className overrides only).
    <Chip tone="lime" className="bg-[#c8ff00]/10 shadow-[0_0_10px_rgba(200,255,0,0.22)]">
      READY TO CERTIFY
    </Chip>
  ) : (
    <Chip tone={live.met === null ? 'dim' : 'amber'} className={live.met === null ? undefined : 'bg-[#e0a030]/25'}>
      {live.met === null ? 'AWAITING TELEMETRY' : 'CONDITIONS PENDING'}
    </Chip>
  );

  return (
    <article
      className={cn(
        // Task 7-b: vvu7b-gate-card — stronger 1px border + resting drop
        // shadow (see ScadaPolishStyles) for card separation against the
        // panel background; gap-4 opens up the header/description blocks.
        'vvu-panel vvu-enter vvu7b-gate-card p-4 flex flex-col gap-4 h-full',
        // Task 6-c: one-time lime glow pulse the moment live conditions turn
        // met (pure CSS — the class is added on the rising edge and the
        // animation fires once; no state, no effects).
        live.met === true && !certified && 'vvu6c-glow'
      )}
      style={certified ? { borderColor: 'rgba(200,255,0,0.55)', boxShadow: '0 0 28px rgba(200,255,0,0.07)' } : undefined}
      aria-label={`trust gate ${gate.gateId} ${gate.status.toLowerCase()}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className={cn('vvu-label text-[11px] font-bold px-2.5 py-1 rounded border', GATE_TONE[gate.gateId])}>{gate.gateId}</span>
        {statusChip}
        <span className="ml-auto vvu-label text-[9px] px-2 py-1 rounded border border-[#8fb35a]/40 text-[#8fb35a] whitespace-nowrap">
          +{fmtNum(gate.shares)} CLASS B
        </span>
      </header>

      <div>
        <div className="flex items-center gap-1.5">
          {(() => {
            const GateIcon = GATE_ICON[gate.gateId];
            return <GateIcon className={cn('size-3.5 shrink-0', GATE_ICON_TONE[gate.gateId])} aria-hidden />;
          })()}
          <h3 className="text-sm font-bold text-[#f3e38a]">{gate.title}</h3>
        </div>
        <p className="text-[11px] text-[#c9d4bd]/75 leading-relaxed mt-1.5">{gate.requirement}</p>
        <div className="vvu-label text-[9px] text-[#7a8a6e] mt-2 space-y-0.5">
          <div>CERT: {gate.certification}</div>
          <div>BENEFICIARY: {gate.beneficiary}</div>
        </div>
      </div>

      {/* Task 8-a: subtle hairline zoning between the card's major blocks —
          header/description | conditions | CTA — without touching the gap-4
          rhythm (border-t + pt-3 only, no extra wrappers). */}
      <div className="space-y-3 border-t border-[rgba(107,138,64,0.18)] pt-3">
        {live.bars.map((bar) => (
          <LiveBar key={bar.label} spec={bar} />
        ))}
        {/* Task 7-b — 3C steady-hold: amber dashed chip under the steady-hours
            bar while the sim clamps accrual at 71.9h awaiting SIM SKIP 3C.
            Task 9-b: wrapped in a subtle amber alert container (VLM round-9
            finding #6 — the chip floated in empty space without context). */}
        {gate.gateId === '3C' && live.steadyHoldHours !== null && (
          <div
            className="flex items-center gap-1.5 rounded border border-dashed border-[#e0a030]/40 bg-[#e0a030]/[0.07] px-2 py-1"
            role="note"
          >
            <Chip tone="amber" dashed className="bg-[#e0a030]/10">
              HOLD @ {live.steadyHoldHours.toFixed(1)}H · AWAITING SIM SKIP 3C
            </Chip>
          </div>
        )}
        {gate.gateId === '3A' &&
          (live.met ? <Chip tone="lime">INVOICE VERIFIED ✓ · WORM + POP</Chip> : <Chip tone="dim" dashed>R5K INVOICE · WORM + POP PENDING</Chip>)}
        {/* Task 10-b: 3B symmetry chip — 3A has the invoice chip and 3C the
            hold note; without this the center column reads empty in that slot
            (VLM round-10 finding #5). */}
        {gate.gateId === '3B' &&
          (live.met ? (
            <Chip tone="lime">MRR STREAK VERIFIED ✓ · XERO RECONCILED</Chip>
          ) : (
            <Chip tone="dim" dashed>STREAK {live.streakMonths ?? '—'}/2 MO · SIM ACCRUAL</Chip>
          ))}
      </div>

      <div className="mt-auto pt-3 border-t border-[rgba(107,138,64,0.18)]">
        {certified ? (
          <div className="vvu-panel-solid p-3 space-y-1" style={{ borderColor: 'rgba(200,255,0,0.35)' }}>
            <div className="vvu-label text-[9px] font-bold text-[#c8ff00]">CERTIFIED ✓ · WORM-IMMUTABLE</div>
            {gate.certifiedAt && <div className="text-[10px] text-[#7a8a6e] tabular-nums">{fmtStamp(gate.certifiedAt)}</div>}
            {gate.certHash && (
              <div className="text-[10px] text-[#7a8a6e] truncate" title={gate.certHash}>
                SHA-256 {gate.certHash.slice(0, 16)}…
              </div>
            )}
          </div>
        ) : (
          <>
            <Button
              type="button"
              onClick={() => onCertify(gate.gateId)}
              disabled={!canCertify}
              title={
                canCertify
                  ? `Append the WORM certification event for Gate ${gate.gateId}`
                  : `DISABLED — awaiting conditions: ${gate.requirement}`
              }
              aria-disabled={!canCertify}
              className="vvu6c-btn w-full min-h-[44px] vvu-label text-[11px] font-bold tracking-[0.12em] disabled:cursor-not-allowed"
            >
              {certifying ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
              {certifying ? 'CERTIFYING…' : `CERTIFY GATE ${gate.gateId}`}
            </Button>
            <p className="vvu-label text-[8px] text-[#7a8a6e] mt-1.5 text-center">
              {live.met === null
                ? 'REQUIRES LIVE TELEMETRY CONDITIONS'
                : live.met
                  ? 'APPENDS WORM EVENT + AUDIT LOG'
                  : 'LIVE CONDITIONS NOT MET YET'}
            </p>
          </>
        )}
      </div>
    </article>
  );
}

export function TrustGates({ num }: { num?: string }) {
  const query = useAnalyticsQuery();
  useQueryErrorToast(query.isError, query.error, 'ANALYTICS FEED');
  const frame = useFrame();
  const queryClient = useQueryClient();
  const connected = useConnected();
  const simSkip = useSimSkip();
  // Task 7-b — true while the sim clamps steady hours at 71.9h: the 3C
  // fast-path button pulses amber to draw the operator's eye to the release.
  const steadyFrozen = frame?.metrics.steadyFrozen ?? false;

  const certMutation = useMutation<GateApiResponse, HttpError, GateId>({
    mutationFn: async (gate) => {
      const res = await fetch('/api/vvu/gates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gate }),
      });
      const data = (await res.json().catch(() => ({}))) as GateApiResponse;
      if (!res.ok || !data.success) {
        throw new HttpError(data.message ?? `GATE ${gate} CERTIFICATION FAILED · HTTP ${res.status}`, res.status);
      }
      return data;
    },
    onSuccess: (data, gate) => {
      toast.success(`Gate ${gate} certified · +${fmtNum(data.shares ?? 0)} Class B unlocked`, {
        description: 'WORM event appended · voting ledger updated',
      });
      void queryClient.invalidateQueries({ queryKey: ['vvu-analytics'] });
      void queryClient.invalidateQueries({ queryKey: ['vvu-ledger'] });
    },
    onError: (err) => {
      // 422 = sim conditions not met · 409 = already certified (WORM-immutable).
      if (err.status === 422 || err.status === 409) {
        toast.warning(err.message);
      } else {
        toast.error('GATE CERTIFICATION FAILED', { description: err.message });
      }
    },
  });

  const gates: GateRecord[] = query.data?.gates ?? [];
  const certifiedCount = gates.filter((g) => g.status === 'CERTIFIED').length;

  return (
    <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="trust gates 3A 3B 3C">
      <SectionHeader
        num={num}
        title="TRUST GATES 3A · 3B · 3C"
        kicker="CHAPTER 3 · APPENDIX F.4 · LIVE CERTIFICATION"
        right={<Chip tone={certifiedCount === 3 ? 'lime' : 'dim'}>{certifiedCount}/3 CERTIFIED</Chip>}
      />
      {/* Task 8-a: description paragraph bumped #7a8a6e → #96a587 (readability).
          Task 10-b: bound to the section with a sage left rule so the intro
          copy no longer floats in typographic no-man's-land between header and
          card grid (VLM round-10 finding #4). */}
      <div className="mb-4 pl-3 border-l-2 border-[rgba(107,138,64,0.45)]">
        <p className="text-[11px] text-[#96a587] leading-relaxed">
          Prove the business with WORM-verified artifacts to unlock Class B shares for the ESD Beneficiary Trust. Progress bars read the
          live Gqeberha edge simulation — certify when the conditions go green.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {query.isPending ? (
          <GateSkeletons />
        ) : query.isError ? (
          <div className="lg:col-span-3">
            <QueryErrorCard label="ANALYTICS FEED" onRetry={() => void query.refetch()} />
          </div>
        ) : (
          gates.map((gate) => (
            <GateCard
              key={gate.gateId}
              gate={gate}
              live={gateLive(gate.gateId, frame)}
              certifying={certMutation.isPending && certMutation.variables === gate.gateId}
              anyCertifying={certMutation.isPending}
              onCertify={(g) => certMutation.mutate(g)}
            />
          ))
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-[rgba(107,138,64,0.25)] flex flex-wrap items-center gap-2">
        <Chip tone="lime">3A + 3B + 3C</Chip>
        <span className="vvu-label text-[9px] text-[#7a8a6e]">→ 109,100 CLASS B ALIGNED → 70.66% TERMINAL CONTROL</span>

        {/* Task 6-c — demo fast-path: advances the business sim straight to a
            gate's conditions so a demo never waits for ×20 time. Certification
            itself still needs the CERTIFY button (WORM evidence required). */}
        <div className="ml-auto flex flex-wrap items-center gap-1.5" role="group" aria-label="demo fast-path controls">
          <span className="vvu-label text-[8px] text-[#7a8a6e]">DEMO FAST-PATH</span>
          {(['3A', '3B', '3C'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => simSkip(g)}
              disabled={!connected}
              title={`Fast-path the sim to Gate ${g} conditions — certification still needs the CERTIFY button`}
              aria-label={`fast-path the simulation to gate ${g} conditions`}
              className={cn(
                'vvu6c-btn vvu-label text-[9px] font-bold min-h-[40px] px-2.5 rounded border',
                connected
                  ? 'border-[#e0a030]/50 text-[#e0a030] hover:bg-[#e0a030]/10 hover:border-[#e0a030]'
                  : 'border-[rgba(107,138,64,0.3)] text-[#7a8a6e] cursor-not-allowed',
                // Task 7-b: amber pulse on the 3C chip while the steady-hold is engaged
                connected && steadyFrozen && g === '3C' && 'vvu7b-hold-pulse'
              )}
            >
              {g}
            </button>
          ))}
          <button
            type="button"
            onClick={() => simSkip('RESET_DEMO')}
            disabled={!connected}
            title="Reset the demo state — MRR R5k · 1 customer · gates PENDING · fresh narrative"
            aria-label="reset the demo simulation state"
            className={cn(
              'vvu6c-btn vvu-label text-[9px] font-bold min-h-[40px] px-2.5 rounded border',
              connected
                ? 'border-[#e5484d]/60 text-[#e5484d] hover:bg-[#e5484d]/10 hover:border-[#e5484d]'
                : 'border-[rgba(107,138,64,0.3)] text-[#7a8a6e] cursor-not-allowed'
            )}
          >
            RESET DEMO
          </button>
        </div>
      </div>
    </section>
  );
}

export default TrustGates;
