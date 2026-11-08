'use client';

// src/components/analytics/shared.tsx — shared SCADA primitives for the
// analytics projection (Route 2 / #/analytics): formatting helpers, shared
// TanStack Query hooks (single cache key per feed), chips, section headers
// and the animated live progress bar. Owned by Task 2-b.

import { useEffect, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AnalyticsSummary, LedgerEntry } from '@/types/vvu';

// ─── SCADA palette (mirrors globals.css) ────────────────────────────────────

export const SCADA = {
  bg: '#060806',
  panel: '#0b0f0a',
  sage: '#6b8a40',
  sageBright: '#8fb35a',
  ochre: '#f3e38a',
  lime: '#c8ff00',
  crimson: '#e5484d',
  amber: '#e0a030',
  teal: '#2ea8a0',
  dim: '#7a8a6e',
  text: '#c9d4bd',
} as const;

// ─── Formatting ─────────────────────────────────────────────────────────────

export const fmtNum = (n: number): string => n.toLocaleString('en-ZA');
export const fmtRand = (n: number): string => `R${n.toLocaleString('en-ZA')}`;

const pad2 = (n: number): string => String(n).padStart(2, '0');

export const fmtTime = (iso: string): string => {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

export const fmtStamp = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

// ─── Fetch error carrying the HTTP status ───────────────────────────────────

export class HttpError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

// ─── GET /api/vvu/ledger response contract ─────────────────────────────────

export interface LedgerResponse {
  count: number;
  chainValid: boolean;
  lastHash: string | null;
  breakAt: number | null;
  entries: LedgerEntry[];
}

// ─── GET /api/vvu/audit response contract ──────────────────────────────────

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  fromState: string | null;
  toState: string | null;
  symbol: string | null;
  reason: string | null;
  createdAt: string;
}

export interface AuditResponse {
  total: number;
  entries: AuditEntry[];
}

// ─── Shared query hooks (deduped cache keys across sections) ───────────────

export function useAnalyticsQuery() {
  return useQuery<AnalyticsSummary, HttpError>({
    queryKey: ['vvu-analytics'],
    queryFn: async () => {
      const res = await fetch('/api/vvu/analytics', { cache: 'no-store' });
      if (!res.ok) throw new HttpError(`ANALYTICS FEED HTTP ${res.status}`, res.status);
      return (await res.json()) as AnalyticsSummary;
    },
    refetchInterval: 8000,
    staleTime: 4000,
  });
}

export function useLedgerQuery() {
  return useQuery<LedgerResponse, HttpError>({
    queryKey: ['vvu-ledger'],
    queryFn: async () => {
      const res = await fetch('/api/vvu/ledger?limit=50', { cache: 'no-store' });
      if (!res.ok) throw new HttpError(`WORM LEDGER HTTP ${res.status}`, res.status);
      return (await res.json()) as LedgerResponse;
    },
    refetchInterval: 15000,
    staleTime: 8000,
  });
}

export function useAuditQuery() {
  return useQuery<AuditResponse, HttpError>({
    queryKey: ['vvu-audit'],
    queryFn: async () => {
      const res = await fetch('/api/vvu/audit?limit=50', { cache: 'no-store' });
      if (!res.ok) throw new HttpError(`AUDIT TRAIL HTTP ${res.status}`, res.status);
      return (await res.json()) as AuditResponse;
    },
    refetchInterval: 10_000,
    staleTime: 5000,
  });
}

/** Fires one toast when a feed transitions into the error state. */
export function useQueryErrorToast(isError: boolean, error: HttpError | null, label: string) {
  useEffect(() => {
    if (isError && error) {
      toast.error(`${label} OFFLINE`, { description: `${error.message} · retrying` });
    }
  }, [isError, error, label]);
}

// ─── Chips / headers / bars ─────────────────────────────────────────────────

export type Tone = 'lime' | 'sage' | 'ochre' | 'amber' | 'crimson' | 'teal' | 'dim';

const TONE_CLASS: Record<Tone, string> = {
  lime: 'border-[#c8ff00]/50 text-[#c8ff00]',
  sage: 'border-[#8fb35a]/50 text-[#8fb35a]',
  ochre: 'border-[#f3e38a]/50 text-[#f3e38a]',
  amber: 'border-[#e0a030]/50 text-[#e0a030]',
  crimson: 'border-[#e5484d]/60 text-[#e5484d]',
  teal: 'border-[#2ea8a0]/50 text-[#2ea8a0]',
  dim: 'border-[rgba(107,138,64,0.35)] text-[#7a8a6e]',
};

export function Chip({
  tone = 'dim',
  dashed = false,
  className,
  children,
}: {
  tone?: Tone;
  dashed?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'vvu-label text-[9px] px-2 py-1 rounded border inline-flex items-center gap-1 whitespace-nowrap',
        TONE_CLASS[tone],
        dashed && 'border-dashed',
        className
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeader({
  title,
  kicker,
  right,
  num,
}: {
  title: string;
  kicker?: string;
  right?: ReactNode;
  /** section number badge (§n) — document structure feel */
  num?: string;
}) {
  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
          {num && (
            <span
              className="vvu-label text-[9px] font-bold text-[#c8ff00] border border-[#c8ff00]/40 rounded px-1.5 py-0.5 shrink-0 tabular-nums"
              aria-hidden
            >
              §{num}
            </span>
          )}
          <h2 className="vvu-label text-xs sm:text-sm font-bold text-[#f3e38a] tracking-[0.18em]">{title}</h2>
        </div>
        {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
      </div>
      {/* thin divider with the right-aligned chapter reference (Task 6-c polish) */}
      <div className="mt-2.5 flex items-center gap-3">
        <span aria-hidden className="h-px flex-1 bg-[rgba(107,138,64,0.28)]" />
        {kicker && (
          <span className="vvu-label text-[8px] sm:text-[9px] text-[#7a8a6e] whitespace-nowrap shrink-0 max-w-full truncate">
            {kicker}
          </span>
        )}
      </div>
    </div>
  );
}

export function LiveDot({ color = '#c8ff00', dim = false }: { color?: string; dim?: boolean }) {
  return (
    <span aria-hidden className={cn('w-1.5 h-1.5 rounded-full shrink-0', !dim && 'vvu-pulse')} style={{ background: dim ? SCADA.dim : color }} />
  );
}

/** Inline error card with a 44px RETRY touch target. */
export function QueryErrorCard({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div
      className="w-full vvu-panel-solid p-4 flex flex-wrap items-center justify-between gap-3"
      style={{ borderColor: 'rgba(229,72,77,0.4)' }}
    >
      <span className="vvu-label text-[10px] text-[#e5484d]">{label} FEED ERROR · DATA UNAVAILABLE</span>
      <Button
        type="button"
        variant="outline"
        onClick={onRetry}
        className="min-h-[44px] vvu-label text-[10px] font-bold border-[#e5484d]/50 text-[#e5484d] hover:bg-[#e5484d]/10 hover:text-[#e5484d]"
      >
        RETRY FEED
      </Button>
    </div>
  );
}

// ─── Animated live progress bar ─────────────────────────────────────────────

export interface BarSpec {
  label: string;
  current: number | null;
  target: number;
  unit?: string;
  /** value treated as 0% progress (e.g. steady hours accrue from 66.2) */
  baseline?: number;
  fmt?: 'rand' | 'num' | 'hours';
  note?: string;
}

function fmtBarValue(n: number, fmt: BarSpec['fmt']): string {
  if (fmt === 'rand') return fmtRand(n);
  if (fmt === 'hours') return `${n.toFixed(1)}h`;
  return fmtNum(n);
}

export function LiveBar({ spec }: { spec: BarSpec }) {
  const { current, target, baseline = 0, fmt = 'num', unit } = spec;
  const pct =
    current === null || target <= baseline
      ? 0
      : Math.max(0, Math.min(100, ((current - baseline) / (target - baseline)) * 100));
  const complete = current !== null && current >= target;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="vvu-label text-[9px] text-[#7a8a6e] truncate">{spec.label}</span>
        <span
          className={cn(
            'text-[11px] font-bold tabular-nums shrink-0',
            complete ? 'text-[#c8ff00]' : current === null ? 'text-[#7a8a6e]' : 'text-[#c9d4bd]'
          )}
        >
          {current === null ? '—' : fmtBarValue(current, fmt)}
          <span className="text-[#7a8a6e] font-normal">
            {' / '}
            {fmtBarValue(target, fmt)}
            {unit ? ` ${unit}` : ''}
          </span>
          {/* Task 8-a: numeric progress readout — small % chip after the
              current/target span ("R50,000 / R50,000 · 100%"). Bold lime when
              complete, body-green mid-progress, dim sage while null. Purely
              additive — no BarSpec API change, all consumers unaffected. */}
          <span
            className={cn(
              'ml-1 px-1 rounded border tabular-nums text-[9px] font-bold whitespace-nowrap',
              complete
                ? 'text-[#c8ff00] border-[#c8ff00]/40 bg-[#c8ff00]/10'
                : current === null
                  ? 'text-[#7a8a6e] border-[rgba(107,138,64,0.3)]'
                  : 'text-[#c9d4bd] border-[rgba(107,138,64,0.3)]'
            )}
          >
            {current === null ? '—' : `· ${Math.round(pct)}%`}
          </span>
        </span>
      </div>
      <div
        className={cn(
          // Task 7-b: h-2 (was h-1.5) — slightly taller track for readability.
          'h-2 rounded-full bg-[#131811] border border-[rgba(107,138,64,0.2)] overflow-hidden',
          // Task 6-c: subtle gradient sweep, only while the bar is actively live.
          current !== null && 'vvu6c-shimmer'
        )}
        role="progressbar"
        aria-label={spec.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: complete ? SCADA.lime : `linear-gradient(90deg, ${SCADA.sage}, ${SCADA.sageBright})`,
            // Task 7-b: subtle lime glow on the fill when the bar is complete.
            boxShadow: complete ? '0 0 10px rgba(200,255,0,0.25)' : undefined,
          }}
        />
      </div>
      {spec.note && <p className="vvu-label text-[8px] text-[#8a9a7c] mt-1.5">{spec.note}</p>}
    </div>
  );
}

// ─── Task 6-c polish: entrance animation wrapper + SCADA corner brackets ─────

/** Section reveal: fades + rises into view on scroll (once), reduced-motion safe. */
export function SectionReveal({
  children,
  featured = false,
  className,
}: {
  children: ReactNode;
  /** featured panels (Trust Gates, MOI) get lime brackets, others sage */
  featured?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn('relative', className)}
      initial={reduce ? undefined : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <CornerBrackets featured={featured} />
      {children}
    </motion.div>
  );
}

/** 8×8 corner L-brackets at top-left / bottom-right of a relative parent. */
export function CornerBrackets({ featured = false }: { featured?: boolean }) {
  const color = featured ? 'rgba(200,255,0,0.6)' : 'rgba(107,138,64,0.45)';
  return (
    <>
      <span
        aria-hidden
        className="absolute -top-px -left-px w-2 h-2 pointer-events-none z-10"
        style={{ borderTop: `1px solid ${color}`, borderLeft: `1px solid ${color}` }}
      />
      <span
        aria-hidden
        className="absolute -bottom-px -right-px w-2 h-2 pointer-events-none z-10"
        style={{ borderBottom: `1px solid ${color}`, borderRight: `1px solid ${color}` }}
      />
    </>
  );
}

/** Task 6-c keyframes/micro-interaction CSS — mounted once by AnalyticsWorkspace. */
export function ScadaPolishStyles() {
  return (
    <style>{`
/* ── Task 6-c analytics polish — scoped to .vvu6c-* (NOT globals.css) ── */

/* LiveBar progress shimmer sweep (only on actively-live bars) */
.vvu6c-shimmer { position: relative; }
.vvu6c-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(100deg, transparent 25%, rgba(220,255,160,0.16) 50%, transparent 75%);
  transform: translateX(-120%);
  animation: vvu6cSweep 2.4s ease-in-out infinite;
  pointer-events: none;
}
@keyframes vvu6cSweep {
  0% { transform: translateX(-120%); }
  60%, 100% { transform: translateX(120%); }
}

/* One-time lime glow ring when a gate's live conditions become met */
.vvu6c-glow { animation: vvu6cGlow 1.2s ease-out 1; }
@keyframes vvu6cGlow {
  0% { box-shadow: 0 0 0 0 rgba(200,255,0,0.55), 0 0 34px rgba(200,255,0,0.24); }
  100% { box-shadow: 0 0 0 18px rgba(200,255,0,0), 0 0 34px rgba(200,255,0,0); }
}

/* MRR big-number flash when the value increases (keyed remount) */
.vvu6c-flash { animation: vvu6cFlash 300ms ease-out 1; }
@keyframes vvu6cFlash {
  0% { color: #c8ff00; text-shadow: 0 0 16px rgba(200,255,0,0.55); }
}

/* Newest-row lime left-edge fade (audit trail + WORM ledger) */
.vvu6c-row-flash { animation: vvu6cRowFlash 1.8s ease-out 1; }
.vvu6c-row-flash-2s { animation: vvu6cRowFlash 2s ease-out 1; }
@keyframes vvu6cRowFlash {
  0% { background-color: rgba(200,255,0,0.14); }
}
.vvu6c-edge-flash { animation: vvu6cEdgeFlash 2s ease-out 1; }
@keyframes vvu6cEdgeFlash {
  0% { box-shadow: inset 3px 0 0 rgba(200,255,0,0.95); }
}

/* Button micro-interactions: hover lift 1px, active press 0.98, 120ms */
.vvu6c-btn {
  transition: transform 120ms ease, border-color 120ms ease, background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
}
.vvu6c-btn:hover:not(:disabled) { transform: translateY(-1px); }
.vvu6c-btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }

/* ── Task 7-b analytics polish — scoped to .vvu7b-* ──────────────────────── */

/* Gate card separation: stronger 1px border + resting drop shadow (lifts the
   cards off the section panel background); hover warms the border to sage. */
.vvu7b-gate-card {
  border-color: rgba(107, 138, 64, 0.35);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
}
.vvu7b-gate-card:hover {
  border-color: rgba(143, 179, 90, 0.5);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(143, 179, 90, 0.12);
}

/* Gate 3C fast-path button: subtle amber pulse while the sim clamps steady
   hours at 71.9h (metrics.steadyFrozen) awaiting an explicit SIM SKIP 3C. */
.vvu7b-hold-pulse { animation: vvu7bHoldPulse 2.2s ease-in-out infinite; }
@keyframes vvu7bHoldPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(224, 160, 48, 0); border-color: rgba(224, 160, 48, 0.5); }
  50% { box-shadow: 0 0 14px rgba(224, 160, 48, 0.4); border-color: rgba(224, 160, 48, 0.95); }
}

/* Reduced motion: kill every animation above */
@media (prefers-reduced-motion: reduce) {
  .vvu6c-shimmer::after,
  .vvu6c-glow,
  .vvu6c-flash,
  .vvu6c-row-flash,
  .vvu6c-row-flash-2s,
  .vvu6c-edge-flash,
  .vvu7b-hold-pulse {
    animation: none !important;
  }
  .vvu6c-btn { transition: none !important; }
  .vvu6c-btn:hover:not(:disabled),
  .vvu6c-btn:active:not(:disabled) { transform: none !important; }
}
`}</style>
  );
}
