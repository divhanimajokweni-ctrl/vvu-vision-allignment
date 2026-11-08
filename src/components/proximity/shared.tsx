'use client';

// src/components/proximity/shared.tsx
// ─────────────────────────────────────────────────────────────────────────────
// PROXIMITY shared atoms — one home for the presentational kernel so the five
// tab modules stay byte-identical to the R60/R61 originals after the split.
//   · fetchJson + the relative endpoint contract (the gateway speaks these)
//   · NO-bare-numbers atoms: Panel / Metric / SourceChip / VerdictChip
//   · the one hash labeler (shortHash) and the workspace types
// ─────────────────────────────────────────────────────────────────────────────

import {
  BadgeCheck,
  Ban,
  Flame,
  Lock,
  Radar,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  type ChainRecordView,
  type ProximityVerifyResult,
} from '@/lib/proximity/types';

// ─── endpoints (ALL relative — the gateway contract) ────────────────────────

export const RECORDS_URL = '/api/proximity/records';
export const CHAIN_URL = '/api/proximity/chain';
export const VERIFY_URL = '/api/proximity/verify';
export const SCAN_URL = '/api/proximity/scan';
export const TAMPER_URL = '/api/proximity/tamper';
export const RESTORE_URL = '/api/proximity/restore';
export const AUDIT_URL = '/api/proximity/audit';
export const WATCHDOG_URL = '/api/proximity/watchdog';
export const ANCHOR_URL = '/api/proximity/anchor';
export const BUNDLE_URL = '/api/proximity/anchor/bundle';
export const BUNDLE_VAULT_URL = '/api/proximity/anchor/bundle/vault';
export const BUNDLE_SYNC_URL = '/api/proximity/anchor/bundle/sync';
export const BUNDLE_SYNC_AUDIT_URL = '/api/proximity/anchor/bundle/sync/audit';
export const WEBHOOK_URL = '/api/proximity/webhook';

export const POLL_MS = 4000;

export const SUPPRESS_THRESHOLD_MILLI = 820; // RISK > 0.820 → SUPPRESS ACTION
export const DWELL_THRESHOLD_MS = 30000; // DWELL > 30.0 s → flag




export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  const body = (await res.json()) as T & { ok?: boolean; detail?: string; error?: string };
  if (!res.ok && body?.ok !== true) {
    throw new Error(body?.detail ?? body?.error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

// ─── small presentational atoms ─────────────────────────────────────────────

export function shortHash(h: string | null, n = 12): string {
  return h ? `${h.slice(0, n)}…${h.slice(-4)}` : '—';
}


/** Card — translucent backing, thin slate-800 border. One primary indicator. */
export function Panel({
  title,
  icon,
  indicator,
  indicatorTone = 'slate',
  children,
  className = '',
  actions,
}: {
  title: string;
  icon: React.ReactNode;
  indicator?: React.ReactNode;
  indicatorTone?: 'slate' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'violet';
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  const tone = {
    slate: 'text-slate-300 border-slate-700/70 bg-slate-800/40',
    emerald: 'text-emerald-300 border-emerald-900/60 bg-emerald-950/40',
    rose: 'text-rose-300 border-rose-900/60 bg-rose-950/40',
    amber: 'text-amber-300 border-amber-900/60 bg-amber-950/40',
    cyan: 'text-cyan-300 border-cyan-900/60 bg-cyan-950/40',
    violet: 'text-violet-300 border-violet-900/60 bg-violet-950/40',
  }[indicatorTone];
  return (
    <section className={`rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm ${className}`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-800 px-4 py-2.5">
        <span className="text-slate-500">{icon}</span>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">{title}</h2>
        {indicator ? (
          <span className={`ml-auto inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${tone}`}>
            {indicator}
          </span>
        ) : null}
        {actions ? <div className={indicator ? 'w-full flex justify-end' : 'ml-auto'}>{actions}</div> : null}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}



/** A labeled numeric — never a bare number. */
export function Metric({ value, unit, label, tone = 'slate' }: { value: string; unit: string; label: string; tone?: 'slate' | 'emerald' | 'rose' | 'amber' | 'cyan' }) {
  const toneCls = {
    slate: 'text-slate-100',
    emerald: 'text-emerald-300',
    rose: 'text-rose-300',
    amber: 'text-amber-300',
    cyan: 'text-cyan-300',
  }[tone];
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
      <div className="flex items-baseline gap-1.5">
        <span className={`font-mono text-lg font-semibold tabular-nums leading-none ${toneCls}`}>{value}</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{unit}</span>
      </div>
      <div className="mt-1 text-[9.5px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</div>
    </div>
  );
}


export function SourceChip({ source }: { source: string }) {
  return source === 'production' ? (
    <Badge variant="outline" className="border-violet-900/70 bg-violet-950/40 text-[9.5px] font-semibold uppercase tracking-wider text-violet-300">
      <Lock className="mr-1 h-2.5 w-2.5" /> production
    </Badge>
  ) : (
    <Badge variant="outline" className="border-cyan-900/70 bg-cyan-950/40 text-[9.5px] font-semibold uppercase tracking-wider text-cyan-300">
      <Radar className="mr-1 h-2.5 w-2.5" /> simulator
    </Badge>
  );
}


export function VerdictChip({ verdict }: { verdict: 'PASS' | 'REFUSED' | 'FIRED' | 'ALLOW' | 'REFUSE' | 'SUPPRESS' | 'PASS_THROUGH' | 'NONE' | string }) {
  const v = verdict.toUpperCase();
  if (v === 'PASS' || v === 'ALLOW' || v === 'PASS_THROUGH' || v === 'OK' || v === 'VALID' || v === 'SEALED') {
    return (
      <Badge variant="outline" className="border-emerald-900/70 bg-emerald-950/40 text-[9.5px] font-bold uppercase tracking-wider text-emerald-300">
        <BadgeCheck className="mr-1 h-2.5 w-2.5" /> {v.replace('_', '-')}
      </Badge>
    );
  }
  if (v === 'REFUSED' || v === 'REFUSE' || v === 'BROKEN' || v === 'NONE') {
    return (
      <Badge variant="outline" className="border-rose-900/70 bg-rose-950/40 text-[9.5px] font-bold uppercase tracking-wider text-rose-300">
        <Ban className="mr-1 h-2.5 w-2.5" /> {v === 'NONE' ? 'no action' : v}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-900/70 bg-amber-950/40 text-[9.5px] font-bold uppercase tracking-wider text-amber-300">
      <Flame className="mr-1 h-2.5 w-2.5" /> {v}
    </Badge>
  );
}


// ─── workspace types (shared by the shell and every tab) ────────────────────

export interface ScanForm {
  subjectId: string;
  distanceCm: number;
  rssiDbm: number;
  batteryMv: number;
  dwellMs: number;
  riskMilli: number;
}

export type TabId = 'pipeline' | 'ledger' | 'governance' | 'watchdog' | 'developers';

export interface ChainResponse {
  ok: boolean;
  chain: ChainRecordView[];
  verification: ProximityVerifyResult;
}

