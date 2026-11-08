'use client';

// src/components/support/SupportWorkspace.tsx — Round 29 · ninth projection
// #/support — the SUPPORT & FUNDING endpoint (local reference engine).
//
// Implements the VVU PUBLIC SUPPORT & INSTITUTIONAL FUNDING ENDPOINT
// ARCHITECTURE v1.5.2 on the validation dashboard:
//   · live Mk-I progress gauge (only LEDGER_LOCKED rows count — never pending)
//   · the 5-state DFA payment engine, server-authoritative (illegal σ → 409)
//   · the contribution flow: σ_init → σ_gateway_open → σ_settled → σ_ledger_commit
//   · SANS-style institutional receipts with SHA-256 receipt hash
//   · the honesty ledger: REAL / LOCAL_REF / DESIGN — the production stack
//     (GitHub Pages + WSS + Postgres/RLS + real gateways) is DESIGN and is
//     labelled as such, never blurred with what runs here.
//
// The gateway step is an operator-advanced LOCAL REFERENCE simulation (no real
// gateway keys exist) — labelled at every point it appears.

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  clearEstateDraft,
  countDraftWords,
  readEstateDraft,
  SUPPORT_CONTRIBUTE_DRAFT_KEY,
  writeEstateDraft,
} from '@/lib/estate-drafts';
import {
  ArrowRight,
  BadgeCheck,
  Copy,
  CreditCard,
  Gauge,
  Landmark,
  Lock,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Sigma,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Chip, LiveDot, QueryErrorCard, SectionHeader, SectionReveal, fmtStamp } from '@/components/analytics/shared';
import { cn } from '@/lib/utils';
import {
  CONTRIBUTION_TYPE_LABELS,
  CONTRIBUTION_TYPES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
} from '@/lib/support-funding';
import type {
  ContributionType,
  FundingActionResult,
  FundingContributionRow,
  FundingSupportResponse,
  PaymentMethod,
  PaymentState,
} from '@/types/vvu';

// ─── fetch helpers ───────────────────────────────────────────────────────────

async function getSupport(): Promise<FundingSupportResponse> {
  const res = await fetch('/api/vvu/support', { cache: 'no-store' });
  if (!res.ok) throw new Error(`SUPPORT FEED HTTP ${res.status}`);
  return (await res.json()) as FundingSupportResponse;
}

async function postAction(payload: Record<string, unknown>): Promise<FundingActionResult> {
  const res = await fetch('/api/vvu/support', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; note?: string; issues?: string[] } | null;
    throw new Error(
      body?.issues?.join(' · ') ?? ([body?.error, body?.note].filter(Boolean).join(' — ') || `HTTP ${res.status}`),
    );
  }
  return (await res.json()) as FundingActionResult;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ─── state styling ───────────────────────────────────────────────────────────

const STATE_TONE: Record<PaymentState, 'dim' | 'amber' | 'lime' | 'crimson'> = {
  INITIATED: 'dim',
  PENDING_SETTLEMENT: 'amber',
  VERIFIED_SETTLED: 'amber',
  LEDGER_LOCKED: 'lime',
  FAILED: 'crimson',
};

const STATE_LABEL: Record<PaymentState, string> = {
  INITIATED: '1 · INITIATED',
  PENDING_SETTLEMENT: '2 · PENDING SETTLEMENT',
  VERIFIED_SETTLED: '3 · VERIFIED SETTLED',
  LEDGER_LOCKED: '4 · LEDGER LOCKED',
  FAILED: '✕ FAILED',
};

/** next legal action button for a row (per the DFA) */
function nextAction(row: FundingContributionRow): { action: string; label: string; icon: React.ReactNode } | null {
  switch (row.paymentState) {
    case 'INITIATED':
      return { action: 'gateway_open', label: 'σ_gateway_open · OPEN GATEWAY', icon: <CreditCard className="w-3.5 h-3.5" /> };
    case 'PENDING_SETTLEMENT':
      return { action: 'settle', label: 'σ_settled · VERIFY WEBHOOK', icon: <ShieldCheck className="w-3.5 h-3.5" /> };
    case 'VERIFIED_SETTLED':
      return { action: 'ledger_commit', label: 'σ_ledger_commit · LOCK LEDGER', icon: <Lock className="w-3.5 h-3.5" /> };
    default:
      return null;
  }
}

// ─── contribution form state ─────────────────────────────────────────────────

type ContributeForm = {
  contributorName: string;
  contributorEmail: string;
  institutionAffiliation: string;
  contributionType: ContributionType;
  amountZar: string;
  paymentMethod: PaymentMethod;
};

const EMPTY_FORM: ContributeForm = {
  contributorName: '',
  contributorEmail: '',
  institutionAffiliation: 'Nelson Mandela University',
  contributionType: 'PUBLIC_DONATION',
  amountZar: '',
  paymentMethod: 'PAYFAST',
};

const QUICK_AMOUNTS = [500, 1000, 5000, 25000, 50000];

// ─── workspace ───────────────────────────────────────────────────────────────

export function SupportWorkspace() {
  const queryClient = useQueryClient();
  // THE SURVIVING TEMPLATE (R194) — the contribution form keeps its words
  // across the storm's bounces, the same law as the fieldkit capture: read
  // once at mount (server renders empty), written on every set, cleared on
  // a successful initiate (a submitted contribution is a WORM row, not a
  // draft — the ghost law).
  const CONTRIBUTE_DRAFT_FIELDS = [
    'contributorName',
    'contributorEmail',
    'institutionAffiliation',
    'contributionType',
    'amountZar',
    'paymentMethod',
  ] as const;
  const [draftBoot] = useState(() => {
    if (typeof window === 'undefined') {
      return { form: EMPTY_FORM, restored: null as Record<string, string> | null };
    }
    const restored = readEstateDraft(window.localStorage, SUPPORT_CONTRIBUTE_DRAFT_KEY, CONTRIBUTE_DRAFT_FIELDS);
    return { form: (restored as ContributeForm | null) ?? EMPTY_FORM, restored };
  });
  const [form, setForm] = useState<ContributeForm>(draftBoot.form);
  const [draftEcho, setDraftEcho] = useState(draftBoot.restored !== null);
  const [draftWords] = useState(() => (draftBoot.restored ? countDraftWords(draftBoot.restored) : 0));
  const set = <K extends keyof ContributeForm>(key: K, value: ContributeForm[K]) =>
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (typeof window !== 'undefined') {
        writeEstateDraft(window.localStorage, SUPPORT_CONTRIBUTE_DRAFT_KEY, next);
      }
      return next;
    });
  const [receiptText, setReceiptText] = useState<string | null>(null);
  const [receiptFor, setReceiptFor] = useState<string | null>(null);

  const supportQuery = useQuery({
    queryKey: ['support'],
    queryFn: getSupport,
    refetchInterval: 10_000,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['support'] });

  const initiateMutation = useMutation({
    mutationFn: (f: ContributeForm) =>
      postAction({
        action: 'initiate',
        contributorName: f.contributorName,
        contributorEmail: f.contributorEmail,
        institutionAffiliation: f.institutionAffiliation,
        contributionType: f.contributionType,
        amountZar: Number(f.amountZar),
        paymentMethod: f.paymentMethod,
      }),
    onSuccess: (r) => {
      toast.success(`CONTRIBUTION INITIATED · WORM #${r.wormSeq}`, {
        description: `${r.transition} · ${r.contribution.contributionId.slice(0, 8)}…`,
      });
      setForm(EMPTY_FORM);
      if (typeof window !== 'undefined') {
        clearEstateDraft(window.localStorage, SUPPORT_CONTRIBUTE_DRAFT_KEY);
      }
      setDraftEcho(false);
      invalidate();
    },
    onError: (e: Error) => toast.error('σ_init REJECTED', { description: e.message }),
  });

  const advanceMutation = useMutation({
    mutationFn: ({ action, id }: { action: string; id: string }) => postAction({ action, id }),
    onSuccess: (r) => {
      toast.success(`${r.transition} · WORM #${r.wormSeq}`, {
        description:
          r.transition.includes('LEDGER_LOCKED')
            ? 'CONTRIBUTION_COMPLETE · receipt generated'
            : r.contribution.gatewayReference
              ? `gateway ${r.contribution.gatewayReference}`
              : r.contribution.contributionId.slice(0, 8),
      });
      if (r.receiptText) {
        setReceiptText(r.receiptText);
        setReceiptFor(r.contribution.receiptId ?? r.contribution.id);
      }
      invalidate();
    },
    onError: (e: Error) => toast.error('TRANSITION REJECTED', { description: e.message }),
  });

  const receiptMutation = useMutation({
    mutationFn: (id: string) => postAction({ action: 'receipt', id }),
    onSuccess: (r) => {
      setReceiptText(r.receiptText ?? null);
      setReceiptFor(r.contribution.receiptId ?? r.contribution.id);
    },
    onError: (e: Error) => toast.error('RECEIPT UNAVAILABLE', { description: e.message }),
  });

  const data = supportQuery.data;
  const progress = data?.progress;
  const fmtRand = (n: number) => `R${n.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;

  const formValid =
    form.contributorName.trim().length >= 2 &&
    /.+@.+\..+/.test(form.contributorEmail.trim()) &&
    Number(form.amountZar) > 0;

  const activeFlow = useMemo(
    () => data?.contributions.find((c) => ['INITIATED', 'PENDING_SETTLEMENT', 'VERIFIED_SETTLED'].includes(c.paymentState)) ?? null,
    [data],
  );

  return (
    <div className="absolute inset-0 overflow-y-auto vvu-grid-bg">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 pb-28 pt-6 space-y-5">
        {/* ── headline + progress gauge ── */}
        <SectionReveal featured>
          <div className="vvu-panel-solid p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="vvu-label text-[10px] text-[#c8ff00] border border-[#c8ff00]/40 px-2 py-0.5">
                    ROUND 29 · NINTH PROJECTION
                  </span>
                  <Chip tone="dim">ARCHITECTURE v1.5.2 · DESIGN FREEZE L1</Chip>
                  <span className="inline-flex items-center gap-1.5 vvu-label text-[9px] text-[#c8ff00]"><LiveDot /> LEDGER FEED LIVE</span>
                </div>
                <h1 className="vvu-label text-xl sm:text-3xl font-bold text-[#f3e38a] mt-3 tracking-wider">
                  SUPPORT · MK-I FUNDING ENDPOINT
                </h1>
                <p className="text-[11px] sm:text-sm text-[#9db08c] mt-2 max-w-2xl leading-relaxed">
                  Public &amp; institutional funding for the Mk-I Prototype Fabrication &amp; Field
                  Validation — tracked with cryptographic transparency. Local reference engine of the
                  production architecture; every transition is WORM-logged.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void supportQuery.refetch()}
                className="min-h-[44px] vvu-label text-[10px] font-bold border-[#7a8a6e]/60 text-[#c9d4bd] hover:bg-[#7a8a6e]/10"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', supportQuery.isFetching && 'animate-spin')} />
                REFRESH
              </Button>
            </div>

            {/* the gauge */}
            <div className="mt-5 border border-[#c8ff00]/30 bg-[#060806] p-4 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="vvu-label text-[9px] text-[#7a8a6e] flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-[#c8ff00]" />
                    LIVE PROGRESS · {progress?.targetLabel ?? 'Mk-I PROTOTYPE FABRICATION'}
                  </p>
                  <p className="vvu-label text-3xl sm:text-5xl font-bold text-[#f3e38a] mt-2 leading-none">
                    {fmtRand(progress?.lockedTotalZar ?? 0)}
                  </p>
                  <p className="vvu-label text-[10px] text-[#9db08c] mt-1.5">
                    OF {fmtRand(progress?.targetZar ?? 0)}{' '}
                    <span className="text-[#f3e38a]/70">· TARGET PROVISIONAL (NOT A QUOTE)</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="vvu-label text-[9px] text-[#7a8a6e]">SUPPORTERS · LEDGER-LOCKED</p>
                  <p className="vvu-label text-2xl font-bold text-[#c8ff00] mt-1">{progress?.supporterCount ?? 0}</p>
                  <p className="vvu-label text-[9px] text-[#7a8a6e] mt-1">
                    PENDING: {fmtRand(progress?.pendingTotalZar ?? 0)} ({progress?.pendingCount ?? 0})
                  </p>
                </div>
              </div>
              <div className="mt-4 h-5 bg-[#0b0f0a] border border-[#7a8a6e]/30 overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-[#c8ff00]/50 to-[#c8ff00] transition-all duration-700"
                  style={{ width: `${Math.max(progress?.pct ?? 0, (progress?.lockedCount ?? 0) > 0 ? 2 : 0)}%` }}
                />
                {(progress?.lockedCount ?? 0) === 0 && (
                  <span className="vvu-label absolute inset-0 flex items-center justify-center text-[9px] text-[#7a8a6e]">
                    R0 LOCKED — STARTS HONEST · NO SEEDED CONTRIBUTIONS
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                <p className="vvu-label text-[9px] text-[#7a8a6e]">
                  GAUGE COUNTS LEDGER-LOCKED ROWS ONLY · PENDING FLOWS SHOWN SEPARATELY, NEVER INFLATED
                </p>
                <p className="vvu-label text-[10px] text-[#f3e38a]">{(progress?.pct ?? 0).toFixed(1)}%</p>
              </div>
            </div>

            {/* allocation */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              {(progress?.allocation ?? []).map((a) => (
                <div key={a.label} className="border border-[#7a8a6e]/30 bg-[#060806] p-3">
                  <div className="vvu-label text-lg font-bold text-[#c8ff00]">{a.pct}%</div>
                  <div className="vvu-label text-[8px] text-[#9db08c] mt-1 leading-snug">{a.label}</div>
                </div>
              ))}
            </div>
          </div>
        </SectionReveal>

        {supportQuery.isError && (
          <QueryErrorCard label="SUPPORT" onRetry={() => void supportQuery.refetch()} />
        )}

        {/* ── FSM ── */}
        <SectionReveal>
          <div className="vvu-panel-solid p-4 sm:p-6">
            <SectionHeader
              num="1"
              title="PAYMENT ENGINE · 5-STATE DFA"
              kicker="deterministic finite automaton · illegal σ jumps rejected server-side (409)"
              right={<Chip tone="dim">v1.5.2 §3</Chip>}
            />
            {/* the rail */}
            <div className="mt-4 flex items-stretch gap-1 overflow-x-auto pb-2">
              {data?.fsm.map((s, i) => {
                const isActive = activeFlow?.paymentState === s.name;
                return (
                  <div key={s.stateId} className="flex items-center gap-1 shrink-0">
                    <div
                      className={cn(
                        'border p-3 min-w-[130px] sm:min-w-[150px]',
                        s.name === 'IDLE' && 'border-[#7a8a6e]/30 bg-[#060806]',
                        s.name === 'INITIATED' && (isActive ? 'border-[#c8ff00]/70 bg-[#c8ff00]/10' : 'border-[#7a8a6e]/30 bg-[#060806]'),
                        s.name === 'PENDING_SETTLEMENT' && (isActive ? 'border-[#f3e38a]/70 bg-[#f3e38a]/10' : 'border-[#7a8a6e]/30 bg-[#060806]'),
                        s.name === 'VERIFIED_SETTLED' && (isActive ? 'border-[#f3e38a]/70 bg-[#f3e38a]/10' : 'border-[#7a8a6e]/30 bg-[#060806]'),
                        s.name === 'LEDGER_LOCKED' && 'border-[#c8ff00]/50 bg-[#060806]',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="vvu-label text-[9px] text-[#7a8a6e]">STATE {s.stateId}</span>
                        {isActive && <LiveDot />}
                      </div>
                      <p
                        className={cn(
                          'vvu-label text-[10px] font-bold mt-1',
                          s.name === 'LEDGER_LOCKED' ? 'text-[#c8ff00]' : 'text-[#f3e38a]',
                        )}
                      >
                        {s.name}
                      </p>
                      <p className="vvu-label text-[8px] text-[#7a8a6e] mt-1.5 leading-snug line-clamp-3">
                        {s.trigger}
                      </p>
                    </div>
                    {i < (data?.fsm.length ?? 0) - 1 && (
                      <ArrowRight className="w-4 h-4 text-[#7a8a6e] shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="border-b border-[#7a8a6e]/40">
                    <th className="vvu-label text-[9px] text-[#7a8a6e] py-2 pr-3">STATE</th>
                    <th className="vvu-label text-[9px] text-[#7a8a6e] py-2 pr-3">TRIGGER</th>
                    <th className="vvu-label text-[9px] text-[#7a8a6e] py-2">SYSTEM ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.fsm.map((s) => (
                    <tr key={s.stateId} className="border-b border-[#7a8a6e]/15 hover:bg-[#7a8a6e]/5">
                      <td className="py-2 pr-3 vvu-label text-[10px] text-[#f3e38a] align-top whitespace-nowrap">
                        {s.stateId} · {s.name}
                      </td>
                      <td className="py-2 pr-3 text-[11px] text-[#c8ff00]/80 align-top">{s.trigger}</td>
                      <td className="py-2 text-[11px] text-[#9db08c] align-top">{s.actions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SectionReveal>

        {/* ── contribute (σ_init) ── */}
        <SectionReveal featured>
          <div className="vvu-panel-solid p-4 sm:p-6">
            <SectionHeader
              num="2"
              title="CONTRIBUTE · σ_init"
              kicker="supporter selects tier & gateway · UUIDv4 contribution id issued server-side"
              right={
                <Chip tone="amber">
                  <Sigma className="w-3 h-3 mr-1" />
                  GATEWAY = LOCAL REFERENCE
                </Chip>
              }
            />
            {draftEcho && (
              <div
                role="status"
                aria-live="polite"
                className="mt-4 flex items-center justify-between gap-3 border border-[#c8ff00]/40 bg-[#060806] px-3 py-2 shadow-[0_0_8px_rgba(200,255,0,0.15)] transition-shadow"
              >
                <span className="vvu-label text-[9px] text-[#c8ff00]">
                  DRAFT KEPT · {draftWords} WORD{draftWords === 1 ? '' : 'S'} RESTORED — THE STORM NEVER TAKES A WORD TWICE
                </span>
                <span className="vvu-label text-[8px] text-[#7a8a6e]">SUBMIT ENDS THE DRAFT</span>
              </div>
            )}
            <div className="grid gap-3 mt-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="support-contribute-name" className="vvu-label text-[9px] text-[#7a8a6e]">CONTRIBUTOR NAME *</Label>
                <Input
                  id="support-contribute-name"
                  value={form.contributorName}
                  onChange={(e) => set('contributorName', e.target.value)}
                  placeholder="e.g. Prof. G. Poggi"
                  className="bg-[#060806] border-[#7a8a6e]/50 text-[13px] min-h-[44px] transition-shadow focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)]"
                  maxLength={160}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="support-contribute-email" className="vvu-label text-[9px] text-[#7a8a6e]">EMAIL (RECEIPT DELIVERY · POPIA) *</Label>
                <Input
                  id="support-contribute-email"
                  type="email"
                  value={form.contributorEmail}
                  onChange={(e) => set('contributorEmail', e.target.value)}
                  placeholder="contributor@institution.ac.za"
                  className="bg-[#060806] border-[#7a8a6e]/50 text-[13px] min-h-[44px] transition-shadow focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)]"
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="support-contribute-institution" className="vvu-label text-[9px] text-[#7a8a6e]">INSTITUTION AFFILIATION</Label>
                <Input
                  id="support-contribute-institution"
                  value={form.institutionAffiliation}
                  onChange={(e) => set('institutionAffiliation', e.target.value)}
                  placeholder="Nelson Mandela University"
                  className="bg-[#060806] border-[#7a8a6e]/50 text-[13px] min-h-[44px] transition-shadow focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)]"
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="support-contribute-type" className="vvu-label text-[9px] text-[#7a8a6e]">CONTRIBUTION TYPE</Label>
                <Select
                  value={form.contributionType}
                  onValueChange={(v) => set('contributionType', v as ContributionType)}
                >
                  <SelectTrigger
                    id="support-contribute-type"
                    className="bg-[#060806] border-[#7a8a6e]/50 text-[13px] min-h-[44px] w-full transition-shadow focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b0f0a] border-[#7a8a6e]/50">
                    {CONTRIBUTION_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-[12px] text-[#c9d4bd] focus:bg-[#7a8a6e]/20">
                        {CONTRIBUTION_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="support-contribute-amount" className="vvu-label text-[9px] text-[#7a8a6e]">AMOUNT (ZAR) *</Label>
                <Input
                  id="support-contribute-amount"
                  type="number"
                  min={1}
                  step="0.01"
                  value={form.amountZar}
                  onChange={(e) => set('amountZar', e.target.value)}
                  placeholder="500"
                  className="bg-[#060806] border-[#7a8a6e]/50 text-[13px] min-h-[44px] transition-shadow focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)]"
                />
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {QUICK_AMOUNTS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => set('amountZar', String(a))}
                      className="vvu-label text-[9px] border border-[#7a8a6e]/40 text-[#9db08c] px-2 py-1 hover:border-[#c8ff00]/50 hover:text-[#c8ff00] transition-colors"
                    >
                      {fmtRand(a)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="support-contribute-method" className="vvu-label text-[9px] text-[#7a8a6e]">PAYMENT METHOD</Label>
                <Select
                  value={form.paymentMethod}
                  onValueChange={(v) => set('paymentMethod', v as PaymentMethod)}
                >
                  <SelectTrigger
                    id="support-contribute-method"
                    className="bg-[#060806] border-[#7a8a6e]/50 text-[13px] min-h-[44px] w-full transition-shadow focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b0f0a] border-[#7a8a6e]/50">
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m} className="text-[12px] text-[#c9d4bd] focus:bg-[#7a8a6e]/20">
                        {PAYMENT_METHOD_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="vvu-label text-[8px] text-[#f3e38a]/70 leading-snug mt-1">
                  ⚠ NO REAL GATEWAY KEYS EXIST — THE GATEWAY STEP IS AN OPERATOR-ADVANCED LOCAL
                  REFERENCE SIMULATION (LABELLED IN THE LEDGER).
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
              <p className="vvu-label text-[9px] text-[#7a8a6e]">
                ALLOCATED TARGET: MK-I PROTOTYPE FABRICATION · EVERY TRANSITION WORM-LOGGED (SOURCE
                SUPPORT)
              </p>
              <Button
                type="button"
                disabled={!formValid || initiateMutation.isPending}
                onClick={() => initiateMutation.mutate(form)}
                className="min-h-[44px] vvu-label text-[10px] font-bold bg-[#c8ff00] text-black hover:bg-[#d8ff4a] border border-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[1px_1px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                {initiateMutation.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wallet className="w-3.5 h-3.5" />
                )}
                σ_init · INITIATE
              </Button>
            </div>
          </div>
        </SectionReveal>

        {/* ── active flow + contributions ledger ── */}
        <SectionReveal>
          <div className="vvu-panel-solid p-4 sm:p-6">
            <SectionHeader
              num="3"
              title="CONTRIBUTIONS LEDGER"
              kicker={`${data?.contributions.length ?? 0} row(s) · advance each flow through the DFA · locked rows immutable`}
              right={<Chip tone="dim">{fmtRand(progress?.lockedTotalZar ?? 0)} LOCKED</Chip>}
            />

            {activeFlow && (
              <div className="mt-4 border border-[#c8ff00]/40 bg-[#c8ff00]/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="vvu-label text-[10px] text-[#c8ff00] flex items-center gap-1.5">
                      <LiveDot /> ACTIVE FLOW · {activeFlow.contributorName}
                    </p>
                    <p className="vvu-label text-[9px] text-[#9db08c] mt-1">
                      {activeFlow.contributionId.slice(0, 8)}… · {fmtRand(activeFlow.amountZar)} ·{' '}
                      {CONTRIBUTION_TYPE_LABELS[activeFlow.contributionType]} ·{' '}
                      {PAYMENT_METHOD_LABELS[activeFlow.paymentMethod]}
                      {activeFlow.gatewayReference ? ` · gateway ${activeFlow.gatewayReference}` : ''}
                    </p>
                  </div>
                  {(() => {
                    const next = nextAction(activeFlow);
                    return next ? (
                      <Button
                        type="button"
                        disabled={advanceMutation.isPending}
                        onClick={() => advanceMutation.mutate({ action: next.action, id: activeFlow.id })}
                        className="min-h-[44px] vvu-label text-[10px] font-bold bg-[#f3e38a] text-black hover:bg-[#ffe97a] border border-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[1px_1px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                      >
                        {advanceMutation.isPending ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          next.icon
                        )}
                        {next.label}
                      </Button>
                    ) : null;
                  })()}
                </div>
              </div>
            )}

            <div className="mt-4 space-y-2 max-h-96 overflow-y-auto pr-1">
              {(data?.contributions.length ?? 0) === 0 ? (
                <div className="border border-dashed border-[#7a8a6e]/35 bg-[#060806] p-6 text-center">
                  <Landmark className="w-6 h-6 text-[#7a8a6e] mx-auto" />
                  <p className="vvu-label text-[10px] text-[#7a8a6e] mt-2">
                    NO CONTRIBUTIONS ON FILE — THE LEDGER STARTS EMPTY (ZERO-FICTIONAL BASELINE)
                  </p>
                </div>
              ) : (
                data?.contributions.map((c) => {
                  const next = nextAction(c);
                  return (
                    <div key={c.id} className="border border-[#7a8a6e]/30 bg-[#060806] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="vvu-label text-[11px] font-bold text-[#f3e38a] truncate">
                            {c.contributorName}
                            <span className="text-[#7a8a6e] font-normal">
                              {' '}
                              · {c.institutionAffiliation}
                            </span>
                          </p>
                          <p className="vvu-label text-[9px] text-[#7a8a6e] mt-0.5">
                            {fmtRand(c.amountZar)} · {CONTRIBUTION_TYPE_LABELS[c.contributionType]} ·{' '}
                            {PAYMENT_METHOD_LABELS[c.paymentMethod]} · {fmtStamp(c.createdAt)} · WORM #
                            {c.wormSeq ?? '—'}
                          </p>
                          <p className="vvu-label text-[8px] text-[#5c6b51] mt-0.5 truncate">
                            cid {c.contributionId}
                            {c.gatewayReference ? ` · gw ${c.gatewayReference}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Chip tone={STATE_TONE[c.paymentState]}>{STATE_LABEL[c.paymentState]}</Chip>
                          {c.paymentState === 'LEDGER_LOCKED' && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => receiptMutation.mutate(c.id)}
                              className="min-h-[36px] h-9 vvu-label text-[9px] font-bold border-[#c8ff00]/50 text-[#c8ff00] hover:bg-[#c8ff00]/10"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              RECEIPT
                            </Button>
                          )}
                          {next && !activeFlow && (
                            <Button
                              type="button"
                              variant="outline"
                              disabled={advanceMutation.isPending}
                              onClick={() => advanceMutation.mutate({ action: next.action, id: c.id })}
                              className="min-h-[36px] h-9 vvu-label text-[9px] font-bold border-[#f3e38a]/50 text-[#f3e38a] hover:bg-[#f3e38a]/10"
                            >
                              {next.icon}
                              {next.label.split('·')[0].trim()}
                            </Button>
                          )}
                        </div>
                      </div>
                      {c.sha256ReceiptHash && (
                        <p className="vvu-label text-[8px] text-[#c8ff00]/70 mt-2 break-all">
                          <BadgeCheck className="w-3 h-3 inline mr-1" />
                          sha256_receipt_hash: {c.sha256ReceiptHash}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </SectionReveal>

        {/* ── receipt viewer ── */}
        <SectionReveal featured>
          <div className="vvu-panel-solid p-4 sm:p-6">
            <SectionHeader
              num="4"
              title="INSTITUTIONAL R&D FUNDING RECEIPT"
              kicker="SANS-style receipt · SHA-256 over the canonical text (placeholder rule)"
              right={
                receiptText ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      const ok = await copyText(receiptText);
                      if (ok) toast.success('RECEIPT COPIED', { description: 'Verbatim text · hash included' });
                    }}
                    className="min-h-[44px] vvu-label text-[10px] font-bold border-[#c8ff00]/50 text-[#c8ff00] hover:bg-[#c8ff00]/10"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    COPY
                  </Button>
                ) : (
                  <Chip tone="dim">NO RECEIPT OPEN</Chip>
                )
              }
            />
            {receiptText ? (
              <>
                <div className="mt-4 bg-[#060806] border border-[#c8ff00]/30 p-3 sm:p-4 overflow-x-auto">
                  <pre className="font-mono text-[9px] sm:text-[10px] leading-relaxed text-[#d8e4c8] whitespace-pre">
                    {receiptText}
                  </pre>
                </div>
                <p className="vvu-label text-[9px] text-[#7a8a6e] mt-3 leading-relaxed">
                  VERIFICATION RULE: REPLACE THE HASH VALUE ON THE &ldquo;SHA-256 RECEIPT HASH&rdquo;
                  LINE WITH THE LITERAL MARKER &lt;computed-on-commit&gt;, THEN SHA-256 THE WHOLE TEXT
                  — THE DIGEST MUST EQUAL THE DISPLAYED HASH. RECEIPT {receiptFor}.
                </p>
              </>
            ) : (
              <p className="text-[12px] text-[#7a8a6e] mt-4 italic">
                Advance a contribution to LEDGER_LOCKED (or press RECEIPT on a locked row) to compose
                the institutional receipt.
              </p>
            )}
          </div>
        </SectionReveal>

        {/* ── honesty ledger ── */}
        <SectionReveal>
          <div className="vvu-panel-solid p-4 sm:p-6">
            <SectionHeader
              num="5"
              title="HONESTY LEDGER · REAL / LOCAL-REF / DESIGN"
              kicker="what runs here vs what the v1.5.2 production architecture specifies — never blurred"
              right={<Chip tone="lime">ZERO-FICTION BASELINE</Chip>}
            />
            <div className="mt-4 space-y-2">
              {data?.honesty.map((h) => (
                <div key={h.layer} className="flex flex-wrap items-start justify-between gap-2 border border-[#7a8a6e]/25 bg-[#060806] p-3">
                  <div className="min-w-0 flex-1">
                    <p className="vvu-label text-[10px] font-bold text-[#c9d4bd]">{h.layer}</p>
                    <p className="text-[11px] text-[#9db08c] mt-1 leading-relaxed">{h.note}</p>
                  </div>
                  <Chip tone={h.status === 'REAL' ? 'lime' : h.status === 'LOCAL_REF' ? 'amber' : 'crimson'}>
                    {h.status === 'REAL' ? 'REAL · RUNS HERE' : h.status === 'LOCAL_REF' ? 'LOCAL REFERENCE' : 'DESIGN · NOT BUILT'}
                  </Chip>
                </div>
              ))}
            </div>
            <p className="vvu-label text-[9px] text-[#7a8a6e] mt-4">
              PROVENANCE: DOCUMENTATION.md § 5 (operator source, extracted text · compiled from
              download/vvu-support-funding-architecture-20260901.md) · PRODUCTION SCHEMA
              vvu-pis-db-schema-20260901.sql FIELD VOCABULARY MIRRORED 1:1 FOR MIGRATION · NO REAL
              PAYMENTS PROCESSED HERE.
            </p>
          </div>
        </SectionReveal>
      </div>
    </div>
  );
}
