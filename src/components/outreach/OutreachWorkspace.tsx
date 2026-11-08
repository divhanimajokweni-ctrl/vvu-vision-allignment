'use client';

// src/components/outreach/OutreachWorkspace.tsx — Round 18 · SEQUENCE ENGINE
// + LEAD SCORING. The outreach automation layer as the third hash projection
// (#/outreach):
//   §1 TARGET SELECTION · LEAD SCORING — ICP profile + 6-factor rubric (≥50 =
//      PRIORITY), tier distribution, per-rule hit counts (server-served rubric)
//   §2 PIPELINE KANBAN          — NEW → SENT → OPENED → REPLIED → MEETING → PILOT → CLOSED (+ BLOCKED),
//                                  lanes sorted by lead score (highest first)
//   §3 SEQUENCE BUILDER         — multi-step cadences (Day 1 / 4 / 9 …), CRUD
//   §4 COMPOSE & SEND           — per-contact AI drafts + dry-run/live sends
//   §5 FUNNEL ANALYTICS         — engagement rates + conversion funnel + ICP goals
//   §6 ENGINE WORM LOG          — OUTREACH_* events off the SHA-256 chain
//
// SECURITY NOTES (deviations from the pasted "another assistant" plan):
//  · NO NEXT_PUBLIC_ keys — AI personalisation runs server-side
//    (/api/vvu/outreach/draft → z-ai-web-dev-sdk); this client only ever sees
//    source: 'ai' | 'template'.
//  · Contacts/cadences live in Prisma/SQLite (WORM-grade), NOT localStorage.
//  · POPIA s69 gate is SERVER-side; the UI just renders its refusals.
//  · No prompt()/alert()/confirm() — dialogs + two-click live confirm.
//  · Lead scores: the client PREVIEWS via the shared pure module
//    (@/lib/lead-scoring); the STORED score is always the server's
//    recomputation on write — the preview is advisory, never trusted.
//
// NOTE: NEXT_STATUS / lanes are MIRRORED here (not imported) because
// src/lib/outreach-engine.ts imports z-ai-web-dev-sdk (server-only module).
// The SCORING rules however are imported from @/lib/lead-scoring — a PURE
// module (no SDK) usable on both sides — so the rubric has one source of truth.

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  Crosshair,
  Eye,
  FlaskConical,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Chip,
  HttpError,
  LiveBar,
  QueryErrorCard,
  ScadaPolishStyles,
  SectionHeader,
  SectionReveal,
  fmtNum,
  fmtStamp,
  useLedgerQuery,
  useQueryErrorToast,
} from '@/components/analytics/shared';
import type {
  ConsentBasis,
  DraftResponse,
  OutreachEmail,
  OutreachResponse,
  OutreachSequence,
  OutreachTarget,
  ScoringMeta,
  SequencesResponse,
  StepSendResponse,
} from '@/types/vvu';
import {
  ICP_CORE,
  ICP_SECTORS,
  PRIORITY_THRESHOLD,
  SCORE_MAX,
  SECTOR_LABEL,
  scoreLead,
} from '@/lib/lead-scoring';
import type { LeadProfile, ScoreResult } from '@/lib/lead-scoring';
import {
  clearEstateDraft,
  clearSequenceDraft,
  CONTACT_DRAFT_KEY,
  countDraftWords,
  countSequenceDraftWords,
  CSV_DRAFT_KEY,
  readEstateDraft,
  readSequenceDraft,
  SEQUENCE_DRAFT_KEY,
  writeEstateDraft,
  writeSequenceDraft,
  type SequenceDraft,
} from '@/lib/estate-drafts';

// ─── Constants (client mirror — see header NOTE) ────────────────────────────

const NEXT_STATUS: Record<string, string> = {
  NEW: 'SENT',
  PREVIEWED: 'SENT',
  CONTACTED: 'OPENED',
  SENT: 'OPENED',
  OPENED: 'REPLIED',
  REPLIED: 'MEETING',
  MEETING: 'PILOT',
  PILOT: 'CLOSED',
};

const LANES = [
  { key: 'NEW', tone: 'dim', statuses: ['NEW'] },
  { key: 'SENT', tone: 'sage', statuses: ['SENT', 'PREVIEWED', 'CONTACTED'] },
  { key: 'OPENED', tone: 'lime', statuses: ['OPENED'] },
  { key: 'REPLIED', tone: 'ochre', statuses: ['REPLIED'] },
  { key: 'MEETING', tone: 'teal', statuses: ['MEETING'] },
  { key: 'PILOT', tone: 'amber', statuses: ['PILOT'] },
  { key: 'CLOSED', tone: 'lime', statuses: ['CLOSED'] },
  { key: 'BLOCKED', tone: 'crimson', statuses: ['BLOCKED'] },
] as const;

function laneOf(status: string): string {
  for (const lane of LANES) {
    if ((lane.statuses as readonly string[]).includes(status)) return lane.key;
  }
  return 'NEW';
}

const CONSENT_OPTIONS: ConsentBasis[] = ['OPT_IN', 'EXISTING_CUSTOMER', 'NONE'];

const CONSENT_TONE: Record<ConsentBasis, 'lime' | 'sage' | 'crimson'> = {
  OPT_IN: 'lime',
  EXISTING_CUSTOMER: 'sage',
  NONE: 'crimson',
};

const EMAIL_STATUS_TONE: Record<string, 'lime' | 'crimson' | 'amber' | 'dim'> = {
  SENT: 'lime',
  FAILED: 'crimson',
  BLOCKED: 'crimson',
  DRY_RUN: 'amber',
  QUEUED: 'dim',
};

const INPUT_CLASS =
  'w-full min-h-[44px] rounded-sm border border-[rgba(107,138,64,0.3)] bg-[#060806] px-3 font-mono text-[11px] text-[#c9d4bd] placeholder:text-[#5f6f54] focus:outline-none focus:border-[#8fb35a] focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)] transition-[border-color,box-shadow]';

const TEXTAREA_CLASS =
  'w-full min-h-[76px] rounded-sm border border-[rgba(107,138,64,0.3)] bg-[#060806] px-3 py-2.5 font-mono text-[11px] text-[#c9d4bd] placeholder:text-[#5f6f54] focus:outline-none focus:border-[#8fb35a] focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)] transition-[border-color,box-shadow] resize-y';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ─── Queries ────────────────────────────────────────────────────────────────

function useOutreachQuery() {
  return useQuery<OutreachResponse, HttpError>({
    queryKey: ['vvu-outreach'],
    queryFn: async () => {
      const res = await fetch('/api/vvu/outreach', { cache: 'no-store' });
      if (!res.ok) throw new HttpError(`OUTREACH FEED HTTP ${res.status}`, res.status);
      return (await res.json()) as OutreachResponse;
    },
    refetchInterval: 10_000,
    staleTime: 5000,
  });
}

function useSequencesQuery() {
  return useQuery<SequencesResponse, HttpError>({
    queryKey: ['vvu-sequences'],
    queryFn: async () => {
      const res = await fetch('/api/vvu/sequences', { cache: 'no-store' });
      if (!res.ok) throw new HttpError(`SEQUENCES FEED HTTP ${res.status}`, res.status);
      return (await res.json()) as SequencesResponse;
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

function useInvalidateEngine() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['vvu-outreach'] });
    void queryClient.invalidateQueries({ queryKey: ['vvu-sequences'] });
    void queryClient.invalidateQueries({ queryKey: ['vvu-ledger'] });
    void queryClient.invalidateQueries({ queryKey: ['vvu-analytics'] });
  };
}

// ─── Shared bits ────────────────────────────────────────────────────────────

function ConsentSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: ConsentBasis;
  onChange: (v: ConsentBasis) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={ariaLabel}>
      {CONSENT_OPTIONS.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={active}
            aria-label={`${ariaLabel}: ${opt}`}
            className={cn(
              'vvu6c-btn vvu-label text-[9px] font-bold min-h-[44px] px-2.5 rounded border whitespace-nowrap',
              active
                ? opt === 'NONE'
                  ? 'bg-[#e5484d]/15 text-[#e5484d] border-[#e5484d]/60'
                  : 'bg-[#c8ff00]/10 text-[#c8ff00] border-[#c8ff00]/60'
                : 'border-[rgba(107,138,64,0.35)] text-[#8fb35a] hover:border-[#8fb35a] hover:text-[#c9d4bd]'
            )}
          >
            {opt === 'EXISTING_CUSTOMER' ? 'EXISTING CUST.' : opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Round 18 · shared lead-scoring bits ────────────────────────────────────

/** Extract the ICP profile off a serialized target row. */
function targetProfile(t: OutreachTarget): LeadProfile {
  return {
    sector: t.sector,
    annualRevenue: t.annualRevenue,
    employees: t.employees,
    bbbeeLevel: t.bbbeeLevel,
    supplierCount: t.supplierCount,
    auditFail12m: t.auditFail12m,
    popiaRisk: t.popiaRisk,
    govContracts: t.govContracts,
  };
}

function tierTone(tier: string): 'lime' | 'sage' | 'ochre' | 'dim' {
  return tier === 'PRIORITY' ? 'lime' : tier === 'QUALIFIED' ? 'sage' : tier === 'LONG_SHOT' ? 'ochre' : 'dim';
}

/** Compact score badge for kanban cards / dialog headers. */
function ScoreChip({ target, className }: { target: OutreachTarget; className?: string }) {
  const unscored = target.tier === 'UNSCORED';
  return (
    <Chip tone={tierTone(target.tier)} dashed={unscored} className={cn('!px-1.5 !py-0.5 !text-[8px] tabular-nums', className)}>
      {unscored ? 'UNSCORED' : `${target.score} ${target.tier}`}
    </Chip>
  );
}

/** Editable ICP profile form — shared by AddContactDialog and ContactDialog.
 *  Controlled: `profile` uses '' / null semantics; empty string = not set. */
interface IcpFormState {
  sector: string;
  revenue: string;
  employees: string;
  bbbee: string;
  suppliers: string;
  audit: boolean;
  popia: boolean;
  gov: boolean;
}

const EMPTY_ICP: IcpFormState = {
  sector: '',
  revenue: '',
  employees: '',
  bbbee: '',
  suppliers: '',
  audit: false,
  popia: false,
  gov: false,
};

function icpFormFromProfile(p: LeadProfile): IcpFormState {
  return {
    sector: p.sector ?? '',
    revenue: p.annualRevenue !== null ? String(p.annualRevenue) : '',
    employees: p.employees !== null ? String(p.employees) : '',
    bbbee: p.bbbeeLevel !== null ? String(p.bbbeeLevel) : '',
    suppliers: p.supplierCount !== null ? String(p.supplierCount) : '',
    audit: p.auditFail12m,
    popia: p.popiaRisk,
    gov: p.govContracts,
  };
}

function icpFormToProfile(f: IcpFormState): LeadProfile {
  const num = (s: string): number | null => (s.trim() === '' ? null : Math.max(0, Math.round(Number(s) || 0)));
  return {
    sector: f.sector || null,
    annualRevenue: num(f.revenue),
    employees: num(f.employees),
    bbbeeLevel: num(f.bbbee),
    supplierCount: num(f.suppliers),
    auditFail12m: f.audit,
    popiaRisk: f.popia,
    govContracts: f.gov,
  };
}

function IcpProfileFields({
  form,
  onChange,
  idPrefix,
}: {
  form: IcpFormState;
  onChange: (next: IcpFormState) => void;
  idPrefix: string;
}) {
  const numeric = (
    key: 'revenue' | 'employees' | 'bbbee' | 'suppliers',
    label: string,
    placeholder: string,
    max: number
  ) => (
    <div>
      <label htmlFor={`${idPrefix}-${key}`} className="vvu-label text-[9px] text-[#7a8a6e] mb-1.5 block">{label}</label>
      <input
        id={`${idPrefix}-${key}`}
        type="number"
        min={0}
        max={max}
        inputMode="numeric"
        value={form[key]}
        onChange={(e) => onChange({ ...form, [key]: e.target.value.slice(0, 7) })}
        placeholder={placeholder}
        className={cn(INPUT_CLASS, 'min-h-[40px]')}
      />
    </div>
  );
  const toggle = (key: 'audit' | 'popia' | 'gov', label: string, points: number) => (
    <button
      key={key}
      type="button"
      aria-pressed={form[key]}
      onClick={() => onChange({ ...form, [key]: !form[key] })}
      className={cn(
        'vvu6c-btn vvu-label text-[8px] font-bold min-h-[44px] px-2 rounded border text-left transition-colors',
        form[key]
          ? 'bg-[#c8ff00]/10 text-[#c8ff00] border-[#c8ff00]/60'
          : 'border-[rgba(107,138,64,0.35)] text-[#8fb35a] hover:border-[#8fb35a]'
      )}
    >
      {label} · +{points}
    </button>
  );
  return (
    <div className="space-y-3">
      <div>
        <div className="vvu-label text-[9px] text-[#7a8a6e] mb-1.5">SECTOR · ICP CORE MARKED ●</div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="sector">
          {ICP_SECTORS.map((s) => {
            const core = (ICP_CORE as readonly string[]).includes(s);
            const active = form.sector === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={active}
                aria-label={`sector ${SECTOR_LABEL[s]}`}
                onClick={() => onChange({ ...form, sector: active ? '' : s })}
                className={cn(
                  'vvu6c-btn vvu-label text-[8px] font-bold min-h-[36px] px-2 rounded border transition-colors',
                  active
                    ? 'bg-[#c8ff00]/10 text-[#c8ff00] border-[#c8ff00]/60'
                    : core
                      ? 'border-[rgba(200,255,0,0.3)] text-[#8fb35a] hover:border-[#c8ff00]/60'
                      : 'border-[rgba(107,138,64,0.35)] text-[#7a8a6e] hover:border-[#8fb35a]'
                )}
              >
                {core && <span className="text-[#c8ff00] mr-1" aria-hidden>●</span>}
                {s}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {numeric('revenue', 'REVENUE · R M', 'e.g. 120', 100000)}
        {numeric('employees', 'EMPLOYEES', 'e.g. 450', 500000)}
        {numeric('bbbee', 'B-BBEE LVL 1–8', 'e.g. 6', 8)}
        {numeric('suppliers', 'SUPPLIERS', 'e.g. 80', 100000)}
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        {toggle('audit', 'AUDIT FAILURE ≤12M', 25)}
        {toggle('popia', 'POPIA RISK HISTORY', 20)}
        {toggle('gov', 'GOV CONTRACTS', 15)}
      </div>
    </div>
  );
}

/** Rubric breakdown rows — hit ticks, points, evidence detail. */
function ScoreBreakdownView({ result }: { result: ScoreResult }) {
  return (
    <ul className="space-y-1" aria-label="score breakdown">
      {result.breakdown.map((b) => (
        <li key={b.key} className="flex items-baseline gap-2">
          <span
            className={cn('vvu-label text-[9px] font-bold w-[14px] shrink-0', b.hit ? 'text-[#c8ff00]' : 'text-[#5f6f54]')}
            aria-hidden
          >
            {b.hit ? '✓' : '·'}
          </span>
          <span className={cn('vvu-label text-[8px] flex-1 min-w-[150px]', b.hit ? 'text-[#c9d4bd]' : 'text-[#7a8a6e]')}>
            {b.label}
          </span>
          <span className="vvu-label text-[8px] text-[#7a8a6e] truncate max-w-[110px]" title={b.detail}>{b.detail}</span>
          <span className={cn('vvu-label text-[9px] font-bold tabular-nums shrink-0', b.hit ? 'text-[#c8ff00]' : 'text-[#5f6f54]')}>
            +{b.points}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─── §1 target selection · lead scoring panel ────────────────────────────────

function LeadScoringPanel({
  targets,
  scoring,
}: {
  targets: OutreachTarget[];
  scoring: ScoringMeta | undefined;
}) {
  const rules = scoring?.rules ?? [];
  const threshold = scoring?.priorityThreshold ?? PRIORITY_THRESHOLD;
  const maxScore = scoring?.scoreMax ?? SCORE_MAX;

  const results = useMemo(() => targets.map((t) => ({ t, r: scoreLead(targetProfile(t)) })), [targets]);
  const tiers = useMemo(
    () => ({
      priority: results.filter((x) => x.t.tier === 'PRIORITY').length,
      qualified: results.filter((x) => x.t.tier === 'QUALIFIED').length,
      longShot: results.filter((x) => x.t.tier === 'LONG_SHOT').length,
      unscored: results.filter((x) => x.t.tier === 'UNSCORED').length,
      icpFit: results.filter((x) => x.r.icpFit).length,
      scored: results.filter((x) => x.t.tier !== 'UNSCORED').length,
    }),
    [results]
  );
  const avg = tiers.scored === 0 ? null : Math.round(results.filter((x) => x.t.tier !== 'UNSCORED').reduce((s, x) => s + x.t.score, 0) / tiers.scored);
  // per-rule hit counts across the whole book (breakdown keys are stable)
  const hitsByKey = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const x of results) {
      for (const b of x.r.breakdown) {
        if (b.hit) counts[b.key] = (counts[b.key] ?? 0) + 1;
      }
    }
    return counts;
  }, [results]);

  return (
    <div className="grid lg:grid-cols-[1.35fr_1fr] gap-4">
      {/* rubric matrix */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="lime">RUBRIC · 6 FACTORS · MAX {maxScore}</Chip>
          <Chip tone="ochre" dashed>PRIORITY ≥ {threshold}</Chip>
          <Chip tone="dim" dashed>SERVER-SCORED ON EVERY WRITE</Chip>
        </div>
        <div className="rounded border border-[rgba(107,138,64,0.2)] divide-y divide-[rgba(107,138,64,0.12)]">
          {rules.map((r) => (
            <div key={r.key} className="px-3 py-2 flex items-baseline gap-2.5">
              <span className="vvu-label text-[9px] font-bold text-[#c8ff00] tabular-nums w-[38px] shrink-0">+{r.points}</span>
              <span className="vvu-label text-[9px] text-[#c9d4bd] flex-1 min-w-[160px]">{r.label}</span>
              <span className="vvu-label text-[8px] text-[#7a8a6e] truncate hidden sm:block max-w-[180px]" title={r.hint}>{r.hint}</span>
              <span className="vvu-label text-[9px] text-[#e0a030] tabular-nums shrink-0" title="targets currently hitting this rule">
                {(hitsByKey[r.key] ?? 0) > 0 ? `${hitsByKey[r.key]} HIT` : '—'}
              </span>
            </div>
          ))}
        </div>
        <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed">
          ICP COMPANY FIT (UNSCORED): SECTOR CORE ● · REVENUE R{scoring?.revenueBand.min ?? 50}–{scoring?.revenueBand.max ?? 500}M ·
          {' '}{scoring?.employeeBand.min ?? 100}–{scoring?.employeeBand.max ?? 1000} EMPLOYEES · B-BBEE {scoring?.bbbeeBand.min ?? 4}–{scoring?.bbbeeBand.max ?? 8} ·
          DECISION-MAKER: ESD / PROCUREMENT / COMPLIANCE
        </p>
      </div>
      {/* tier distribution */}
      <div className="grid grid-cols-2 gap-2.5 content-start">
        {[
          { label: 'PRIORITY', value: tiers.priority, tone: 'lime' as const, note: `SCORE ≥ ${threshold}` },
          { label: 'QUALIFIED', value: tiers.qualified, tone: 'sage' as const, note: 'SCORE 25–49' },
          { label: 'LONG_SHOT', value: tiers.longShot, tone: 'ochre' as const, note: 'SCORE < 25' },
          { label: 'UNSCORED', value: tiers.unscored, tone: 'dim' as const, note: 'NO ICP PROFILE' },
          { label: 'ICP FIT', value: tiers.icpFit, tone: 'teal' as const, note: 'FULL BAND MATCH' },
          { label: 'AVG SCORE', value: avg, tone: 'amber' as const, note: tiers.scored === 0 ? 'NO SCORED LEADS' : `OF ${tiers.scored} SCORED`, isRaw: true },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded border border-[rgba(107,138,64,0.25)] flex flex-col gap-1.5">
            <span className="vvu-label text-[8px] text-[#7a8a6e]">{s.label}</span>
            <span className={cn('vvu-label text-xl font-bold tabular-nums', s.value === null ? 'text-[#7a8a6e]' : 'text-[#c8ff00]')}>
              {s.value === null ? '—' : s.isRaw ? s.value : fmtNum(s.value)}
            </span>
            <Chip tone={s.value === 0 || s.value === null ? 'dim' : s.tone} dashed>{s.note}</Chip>
          </div>
        ))}
      </div>
    </div>
  );
}

function DialogShell({
  title,
  kicker,
  onClose,
  closeLabel,
  children,
  widthClass,
  tone = 'rgba(107,138,64,0.35)',
}: {
  title: string;
  kicker: string;
  onClose: () => void;
  closeLabel: string;
  children: React.ReactNode;
  widthClass?: string;
  tone?: string;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-label={title}
        className={cn(
          'vvu-panel-solid flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 shadow-[0_24px_80px_rgba(0,0,0,0.6)]',
          widthClass ?? 'sm:max-w-[480px]'
        )}
        style={{ borderColor: tone }}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[rgba(107,138,64,0.25)] shrink-0">
          <div className="min-w-0">
            <DialogTitle className="font-mono text-left text-[11px] font-bold leading-tight text-[#d7e2c9] break-all">
              {title}
            </DialogTitle>
            <DialogDescription className="font-mono text-left mt-1.5 text-[9px] leading-none tracking-[0.18em] text-[#8fb35a]">
              {kicker}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            title="Close (Escape)"
            className="shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] -my-1.5 -mr-2 rounded-sm text-[#7a8a6e] hover:text-[#e5484d] transition-colors"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** Light-bg inbox sandbox — data-theme-exempt keeps it TRUE light under DAYSHIFT. */
function EmailSandbox({ html, label }: { html: string; label: string }) {
  return (
    <div className="overflow-y-auto bg-[#f4f6f0]" aria-label={label} data-theme-exempt>
      <div className="p-3" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// ─── §1 Add-contact dialog ──────────────────────────────────────────────────

function AddContactDialog({ onClose }: { onClose: () => void }) {
  const invalidate = useInvalidateEngine();
  // THE OUTREACH THAT REMEMBERS (R195) — the target's words survive the
  // storm's bounces: read once at mount (the server renders empty —
  // typeof window), written on every keystroke, cleared on a successful
  // add (a saved target is a WORM row, not a draft — the ghost law).
  // The draft shadows the four PROSE fields; the consent gate and the ICP
  // profile ride their own defaults (the score recomputes server-side).
  const CONTACT_DRAFT_FIELDS = ['org', 'contact', 'email', 'issue'] as const;
  const [draftBoot] = useState(() => {
    if (typeof window === 'undefined') {
      return { restored: null as Record<string, string> | null };
    }
    return { restored: readEstateDraft(window.localStorage, CONTACT_DRAFT_KEY, CONTACT_DRAFT_FIELDS) };
  });
  const [org, setOrg] = useState(draftBoot.restored?.org ?? '');
  const [contact, setContact] = useState(draftBoot.restored?.contact ?? '');
  const [email, setEmail] = useState(draftBoot.restored?.email ?? '');
  const [issue, setIssue] = useState(draftBoot.restored?.issue ?? '');
  const [draftEcho] = useState(draftBoot.restored !== null);
  const [draftWords] = useState(() => (draftBoot.restored ? countDraftWords(draftBoot.restored) : 0));
  const [consent, setConsent] = useState<ConsentBasis>('NONE');
  // Round 18 — ICP profile (live preview via the shared pure module)
  const [icp, setIcp] = useState<IcpFormState>(EMPTY_ICP);

  // the draft rides every keystroke — the whole form's shadow, one write
  const persistContact = (patch: Partial<{ org: string; contact: string; email: string; issue: string }>) => {
    if (typeof window !== 'undefined') {
      writeEstateDraft(window.localStorage, CONTACT_DRAFT_KEY, { org, contact, email, issue, ...patch });
    }
  };

  const mutation = useMutation<{ success: boolean; message?: string }, HttpError, void>({
    mutationFn: async () => {
      const profile = icpFormToProfile(icp);
      const res = await fetch('/api/vvu/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org,
          contactName: contact,
          email,
          criticalIssue: issue,
          consentBasis: consent,
          sector: profile.sector,
          annualRevenue: profile.annualRevenue,
          employees: profile.employees,
          bbbeeLevel: profile.bbbeeLevel,
          supplierCount: profile.supplierCount,
          auditFail12m: profile.auditFail12m,
          popiaRisk: profile.popiaRisk,
          govContracts: profile.govContracts,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success: boolean; message?: string };
      if (!res.ok || !data.success) {
        throw new HttpError(data.message ?? `ADD TARGET FAILED · HTTP ${res.status}`, res.status);
      }
      return data;
    },
    onSuccess: (data) => {
      const preview = scoreLead(icpFormToProfile(icp));
      toast.success('TARGET ADDED', {
        id: 'engine-add',
        description: `CONSENT ${consent}${preview.tier !== 'UNSCORED' ? ` · SCORE ${preview.score} · TIER ${preview.tier}` : ''} · WORM OUTREACH_TARGET_ADDED · ${data.success ? 'OK' : ''}`,
      });
      invalidate();
      if (typeof window !== 'undefined') {
        clearEstateDraft(window.localStorage, CONTACT_DRAFT_KEY);
      }
      onClose();
    },
    onError: (err) => {
      if (err.status === 422 || err.status === 409) {
        toast.warning(err.message, { id: 'engine-add' });
      } else {
        toast.error('ADD TARGET FAILED', { id: 'engine-add', description: err.message });
      }
    },
  });

  const emailOk = EMAIL_RE.test(email.trim());
  const canSubmit = org.trim() && contact.trim() && emailOk && !mutation.isPending;
  const preview = scoreLead(icpFormToProfile(icp));

  return (
    <DialogShell title="ADD OUTREACH TARGET" kicker="MANUAL ENTRY · POPIA s69 GATE APPLIES · ICP-SCORABLE" onClose={onClose} closeLabel="close add target dialog" widthClass="sm:max-w-[560px]">
      <div className="px-4 py-4 space-y-4 overflow-y-auto">
        {draftEcho && (
          <div
            role="status"
            aria-live="polite"
            className="vvu-label text-[8px] font-bold text-[#c8ff00] border border-[#c8ff00]/40 shadow-[0_0_12px_rgba(200,255,0,0.15)] transition-shadow rounded px-2.5 py-2 leading-relaxed"
          >
            DRAFT KEPT · {draftWords} WORD{draftWords === 1 ? '' : 'S'} RESTORED — THE STORM NEVER TAKES A WORD TWICE
          </div>
        )}
        <div>
          <label htmlFor="add-org" className="vvu-label text-[9px] text-[#7a8a6e] mb-2 block">ORGANISATION *</label>
          <input id="add-org" type="text" value={org} onChange={(e) => { setOrg(e.target.value); persistContact({ org: e.target.value }); }} maxLength={120} placeholder="e.g. Nelson Mandela Bay Municipality" className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="add-contact" className="vvu-label text-[9px] text-[#7a8a6e] mb-2 block">CONTACT NAME *</label>
          <input id="add-contact" type="text" value={contact} onChange={(e) => { setContact(e.target.value); persistContact({ contact: e.target.value }); }} maxLength={120} placeholder="e.g. Thandi Mokoena" className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="add-email" className="vvu-label text-[9px] text-[#7a8a6e] mb-2 block">EMAIL *</label>
          <input id="add-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); persistContact({ email: e.target.value }); }} maxLength={254} placeholder="name@org.gov.za" aria-invalid={email.length > 0 && !emailOk} className={INPUT_CLASS} />
        </div>
        <div>
          <div className="vvu-label text-[9px] text-[#7a8a6e] mb-2">CONSENT BASIS · POPIA s69 GATE</div>
          <ConsentSelect value={consent} onChange={setConsent} ariaLabel="consent basis" />
          <p className="vvu-label text-[8px] text-[#7a8a6e] mt-2 leading-relaxed">NONE REFUSES EVERY SEND — SERVER-SIDE, NOT JUST UI</p>
        </div>
        <div>
          <label htmlFor="add-issue" className="vvu-label text-[9px] text-[#7a8a6e] mb-2 block">CRITICAL ISSUE (PERSONALISES THE DRAFT)</label>
          <input id="add-issue" type="text" value={issue} onChange={(e) => { setIssue(e.target.value); persistContact({ issue: e.target.value }); }} maxLength={300} placeholder="e.g. unverified B-BBEE supplier certificates" className={INPUT_CLASS} />
        </div>
        {/* Round 18 — ICP profile · optional, scores the lead server-side */}
        <div className="p-3 rounded border border-[rgba(107,138,64,0.25)] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="vvu-label text-[9px] text-[#7a8a6e]">ICP PROFILE · OPTIONAL · LEAD SCORING</div>
            {preview.tier !== 'UNSCORED' && (
              <Chip tone={tierTone(preview.tier)} className="!text-[8px]">
                {preview.score} {preview.tier} · PREVIEW
              </Chip>
            )}
          </div>
          <IcpProfileFields form={icp} onChange={setIcp} idPrefix="add-icp" />
          <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed">
            PREVIEW USES THE SAME PURE MODULE AS THE SERVER — THE STORED SCORE IS ALWAYS THE SERVER'S RECOMPUTATION
          </p>
        </div>
      </div>
      <div className="px-4 py-3 border-t border-[rgba(107,138,64,0.25)] shrink-0 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} className="vvu6c-btn min-h-[44px] vvu-label text-[10px] font-bold border-[rgba(107,138,64,0.35)] text-[#7a8a6e] hover:text-[#c9d4bd] hover:border-[#8fb35a]">CANCEL</Button>
        <Button type="button" variant="outline" disabled={!canSubmit} onClick={() => mutation.mutate()} className="vvu6c-btn min-h-[44px] vvu-label text-[10px] font-bold border-[#c8ff00]/50 text-[#c8ff00] hover:bg-[#c8ff00]/10 disabled:opacity-40">
          {mutation.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          ADD TARGET
        </Button>
      </div>
    </DialogShell>
  );
}

// ─── §1 CSV import dialog ───────────────────────────────────────────────────

function ImportCsvDialog({ onClose }: { onClose: () => void }) {
  const invalidate = useInvalidateEngine();
  // THE OUTREACH THAT REMEMBERS (R195) — the paste survives the storm's
  // bounces: read once at mount (typeof window guard), written on every
  // keystroke AND on a file load, cleared on a successful import (the
  // ghost law: imported rows are WORM entries, not a draft).
  const [draftBoot] = useState(() => {
    if (typeof window === 'undefined') {
      return { restored: null as Record<string, string> | null };
    }
    return { restored: readEstateDraft(window.localStorage, CSV_DRAFT_KEY, ['csv']) };
  });
  const [csvText, setCsvText] = useState(draftBoot.restored?.csv ?? '');
  const [draftEcho] = useState(draftBoot.restored !== null);
  const [draftWords] = useState(() => (draftBoot.restored ? countDraftWords(draftBoot.restored) : 0));
  const fileRef = useRef<HTMLInputElement>(null);

  // the draft rides every keystroke and every file load alike
  const persistCsv = (value: string) => {
    if (typeof window !== 'undefined') {
      writeEstateDraft(window.localStorage, CSV_DRAFT_KEY, { csv: value });
    }
  };

  const mutation = useMutation<{ added?: number; skipped?: number; message?: string; error?: string }, HttpError, void>({
    mutationFn: async () => {
      const res = await fetch('/api/vvu/outreach/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = (await res.json().catch(() => ({}))) as { added?: number; skipped?: number; message?: string; error?: string };
      if (!res.ok || data.error) {
        throw new HttpError(data.message ?? data.error ?? `CSV IMPORT FAILED · HTTP ${res.status}`, res.status);
      }
      return data;
    },
    onSuccess: (data) => {
      toast.success(`CSV IMPORTED — ADDED ${data.added ?? 0} · SKIPPED ${data.skipped ?? 0}`, {
        id: 'engine-import',
        description: 'unknown consentBasis values degrade to NONE (POPIA-safe) · WORM OUTREACH_IMPORT',
      });
      invalidate();
      if (typeof window !== 'undefined') {
        clearEstateDraft(window.localStorage, CSV_DRAFT_KEY);
      }
      onClose();
    },
    onError: (err) => {
      toast.error('CSV IMPORT FAILED', { id: 'engine-import', description: err.message });
    },
  });

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? '';
      setCsvText(text);
      persistCsv(text);
    };
    reader.readAsText(file);
  };

  return (
    <DialogShell title="IMPORT CONTACTS · CSV" kicker="CORE: org,contactName,email,criticalIssue,consentBasis · OPTIONAL: sector,revenueM,employees,bbbeeLevel,suppliers,auditFail,popiaRisk,govContracts" onClose={onClose} closeLabel="close csv import dialog" widthClass="sm:max-w-[620px]">
      <div className="px-4 py-4 space-y-3 overflow-y-auto">
        {draftEcho && (
          <div
            role="status"
            aria-live="polite"
            className="vvu-label text-[8px] font-bold text-[#c8ff00] border border-[#c8ff00]/40 shadow-[0_0_12px_rgba(200,255,0,0.15)] transition-shadow rounded px-2.5 py-2 leading-relaxed"
          >
            DRAFT KEPT · {draftWords} WORD{draftWords === 1 ? '' : 'S'} RESTORED — THE STORM NEVER TAKES A WORD TWICE
          </div>
        )}
        <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed">
          HEADER ROW OPTIONAL · QUOTED FIELDS TOLERATED · UNKNOWN CONSENT DEGRADES TO NONE (POPIA-SAFE REFUSE) ·
          OPTIONAL SCORING COLUMNS ARE ANY-SUBSET · BOOLEANS ACCEPT TRUE/YES/1/Y · EACH ROW IS SERVER-SCORED + WORM-LOGGED
        </p>
        <div className="flex flex-wrap gap-2">
          <label className="vvu6c-btn vvu-label text-[9px] font-bold min-h-[44px] px-3 rounded border border-[rgba(107,138,64,0.45)] text-[#8fb35a] hover:border-[#8fb35a] hover:text-[#c9d4bd] inline-flex items-center gap-1.5 cursor-pointer transition-colors">
            <Upload className="size-3" aria-hidden />
            PICK .CSV FILE
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>
          <span className="vvu-label text-[8px] text-[#7a8a6e] self-center">
            {csvText ? `${csvText.split('\n').filter(Boolean).length} LINES LOADED` : 'OR PASTE BELOW'}
          </span>
        </div>
        <textarea
          value={csvText}
          onChange={(e) => { setCsvText(e.target.value); persistCsv(e.target.value); }}
          placeholder={'org,contactName,email,criticalIssue,consentBasis,sector,revenueM,employees,bbbeeLevel,suppliers,auditFail,popiaRisk,govContracts\nNMB Municipality,Thandi M,tm@nmb.gov.za,unverified certificates,OPT_IN,MUNICIPAL,420,900,6,120,yes,no,yes'}
          className={cn(TEXTAREA_CLASS, 'min-h-[180px] font-mono')}
          aria-label="CSV text"
        />
      </div>
      <div className="px-4 py-3 border-t border-[rgba(107,138,64,0.25)] shrink-0 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} className="vvu6c-btn min-h-[44px] vvu-label text-[10px] font-bold border-[rgba(107,138,64,0.35)] text-[#7a8a6e] hover:text-[#c9d4bd] hover:border-[#8fb35a]">CANCEL</Button>
        <Button type="button" variant="outline" disabled={!csvText.trim() || mutation.isPending} onClick={() => mutation.mutate()} className="vvu6c-btn min-h-[44px] vvu-label text-[10px] font-bold border-[#c8ff00]/50 text-[#c8ff00] hover:bg-[#c8ff00]/10 disabled:opacity-40">
          {mutation.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          IMPORT
        </Button>
      </div>
    </DialogShell>
  );
}

// ─── §2 sequence builder dialog ─────────────────────────────────────────────

interface BuilderStepState {
  day: string;
  subject: string;
  angle: string;
}

function SequenceBuilderDialog({
  editing,
  onClose,
}: {
  editing: OutreachSequence | null; // null = create
  onClose: () => void;
}) {
  const invalidate = useInvalidateEngine();
  // THE OUTREACH THAT REMEMBERS (R195) — the cadence's authorship survives
  // the storm's bounces. CREATE mode drafts (read once at mount with the
  // typeof window guard, written on every keystroke and every step
  // add/remove, cleared on a successful save — a saved cadence is a WORM
  // row, not a draft). EDIT mode never reads or writes the draft — the
  // server's own truth is its prefill and its restore.
  const [draftBoot] = useState(() => {
    if (typeof window === 'undefined' || editing) {
      return { restored: null as SequenceDraft | null };
    }
    return { restored: readSequenceDraft(window.localStorage, SEQUENCE_DRAFT_KEY) };
  });
  const [name, setName] = useState(editing?.name ?? draftBoot.restored?.name ?? '');
  const [steps, setSteps] = useState<BuilderStepState[]>(
    editing
      ? editing.steps.map((s) => ({ day: String(s.day), subject: s.subject, angle: s.angle }))
      : (draftBoot.restored?.steps as BuilderStepState[] | undefined) ?? [
          { day: '1', subject: '30-second supplier verification for {org}', angle: 'Warm intro: VVU City Digital Twin GIS + edge-AI monitoring; reference their critical issue; R5,000 30-day pilot.' },
          { day: '4', subject: 'The 135% B-BBEE recognition angle for {org}', angle: 'Case-study follow-up: Level 1 B-BBEE (135% procurement recognition) + POPIA-compliant WORM ledger; no repetition of step 1.' },
          { day: '9', subject: 'Last nudge — pilot slot for {org}?', angle: 'Direct close: offer a 20-minute call to scope the R5,000 pilot; easy to say no so the sequence can rest.' },
        ]
  );
  const [draftEcho] = useState(!editing && draftBoot.restored !== null);
  const [draftWords] = useState(() =>
    draftBoot.restored && !editing ? countSequenceDraftWords(draftBoot.restored) : 0
  );

  // the draft rides every keystroke and every step add/remove — create
  // mode only; the cadence's whole shadow, one write
  const persistSequence = (nextName: string, nextSteps: BuilderStepState[]) => {
    if (typeof window !== 'undefined' && !editing) {
      writeSequenceDraft(window.localStorage, SEQUENCE_DRAFT_KEY, { name: nextName, steps: nextSteps });
    }
  };
  const persistName = (nextName: string) => {
    setName(nextName);
    persistSequence(nextName, steps);
  };

  const setStep = (i: number, patch: Partial<BuilderStepState>) => {
    const next = steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    setSteps(next);
    persistSequence(name, next);
  };
  // the state echo law: a step holding prose glows, an empty step rests
  const stepFilled = (s: BuilderStepState) => s.subject.trim().length > 0 || s.angle.trim().length > 0;

  const mutation = useMutation<{ success: boolean; message?: string }, HttpError, void>({
    mutationFn: async () => {
      const payload = {
        id: editing?.id,
        name: name.trim(),
        steps: steps.map((s) => ({ day: Number(s.day), subject: s.subject.trim(), angle: s.angle.trim() })),
      };
      const res = await fetch('/api/vvu/sequences', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { success: boolean; message?: string };
      if (!res.ok || !data.success) {
        throw new HttpError(data.message ?? `SEQUENCE SAVE FAILED · HTTP ${res.status}`, res.status);
      }
      return data;
    },
    onSuccess: () => {
      toast.success(editing ? 'SEQUENCE UPDATED' : 'SEQUENCE CREATED', {
        id: 'engine-seq',
        description: `${name.trim()} · WORM OUTREACH_SEQUENCE_${editing ? 'UPDATED' : 'CREATED'}`,
      });
      if (typeof window !== 'undefined' && !editing) {
        clearSequenceDraft(window.localStorage, SEQUENCE_DRAFT_KEY);
      }
      invalidate();
      onClose();
    },
    onError: (err) => {
      toast.error('SEQUENCE SAVE FAILED', { id: 'engine-seq', description: err.message });
    },
  });

  return (
    <DialogShell
      title={editing ? `EDIT SEQUENCE · ${editing.name}` : 'NEW SEQUENCE'}
      kicker={`CADENCE BUILDER · 1–${steps.length} STEPS · DAYS MUST ASCEND`}
      onClose={onClose}
      closeLabel="close sequence builder"
      widthClass="sm:max-w-[680px]"
    >
      <div className="px-4 py-4 space-y-4 overflow-y-auto">
        {draftEcho && (
          <div
            role="status"
            aria-live="polite"
            className="vvu-label text-[8px] font-bold text-[#c8ff00] border border-[#c8ff00]/40 shadow-[0_0_12px_rgba(200,255,0,0.15)] transition-shadow rounded px-2.5 py-2 leading-relaxed"
          >
            DRAFT KEPT · {draftWords} WORD{draftWords === 1 ? '' : 'S'} RESTORED — THE STORM NEVER TAKES A WORD TWICE
          </div>
        )}
        <div>
          <label htmlFor="seq-name" className="vvu-label text-[9px] text-[#7a8a6e] mb-2 block">SEQUENCE NAME *</label>
          <input id="seq-name" type="text" value={name} onChange={(e) => persistName(e.target.value)} maxLength={60} placeholder="e.g. VVU PILOT 3-STEP" className={INPUT_CLASS} />
        </div>
        <div className="space-y-3">
          <div className="vvu-label text-[9px] text-[#7a8a6e]">STEPS · {steps.length}/7 · PLACEHOLDERS {'{org} {name} {issue}'}</div>
          {steps.map((s, i) => (
            <div key={i} className="p-3 rounded border border-[rgba(107,138,64,0.25)] space-y-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'vvu-label text-[9px] font-bold border rounded px-1.5 py-0.5 shrink-0 tabular-nums transition-[border-color,box-shadow]',
                    stepFilled(s)
                      ? 'text-[#c8ff00] border-[#c8ff00]/40 shadow-[0_0_8px_rgba(200,255,0,0.15)]'
                      : 'text-[#7a8a6e] border-[rgba(107,138,64,0.3)]'
                  )}
                >S{i + 1}</span>
                <label className="sr-only" htmlFor={`seq-day-${i}`}>step {i + 1} day</label>
                <input
                  id={`seq-day-${i}`}
                  type="number"
                  min={1}
                  max={30}
                  value={s.day}
                  onChange={(e) => setStep(i, { day: e.target.value })}
                  className="w-[84px] min-h-[44px] rounded-sm border border-[rgba(107,138,64,0.3)] bg-[#060806] px-2 font-mono text-[11px] text-[#c9d4bd] focus:outline-none focus:border-[#8fb35a] focus-visible:shadow-[0_0_0_2px_rgba(200,255,0,0.3)] transition-[border-color,box-shadow]"
                  aria-label={`step ${i + 1} cadence day`}
                />
                <span className="vvu-label text-[8px] text-[#7a8a6e]">DAYS AFTER START</span>
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = steps.filter((_, idx) => idx !== i);
                      setSteps(next);
                      persistSequence(name, next);
                    }}
                    aria-label={`remove step ${i + 1}`}
                    className="ml-auto shrink-0 flex items-center justify-center size-9 rounded-sm text-[#7a8a6e] hover:text-[#e5484d] transition-colors"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                )}
              </div>
              <div>
                <label htmlFor={`seq-subject-${i}`} className="vvu-label text-[8px] text-[#7a8a6e] mb-1.5 block">SUBJECT · ≤ 78 CHARS</label>
                <input id={`seq-subject-${i}`} type="text" value={s.subject} onChange={(e) => setStep(i, { subject: e.target.value })} maxLength={78} className={INPUT_CLASS} />
              </div>
              <div>
                <label htmlFor={`seq-angle-${i}`} className="vvu-label text-[8px] text-[#7a8a6e] mb-1.5 block">ANGLE · AI WRITER BRIEF · ≤ 300 CHARS</label>
                <textarea id={`seq-angle-${i}`} value={s.angle} onChange={(e) => setStep(i, { angle: e.target.value })} maxLength={300} className={cn(TEXTAREA_CLASS, 'min-h-[64px]')} />
              </div>
            </div>
          ))}
        </div>
        {steps.length < 7 && (
          <button
            type="button"
            onClick={() => {
              const next = [
                ...steps,
                { day: String(Math.min(30, Number(steps[steps.length - 1]?.day ?? 0) + 3 || 12)), subject: '', angle: '' },
              ];
              setSteps(next);
              persistSequence(name, next);
            }}
            className="vvu6c-btn vvu-label text-[9px] font-bold min-h-[44px] w-full px-3 rounded border border-dashed border-[rgba(107,138,64,0.45)] text-[#8fb35a] hover:border-[#8fb35a] hover:text-[#c9d4bd] inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="size-3" aria-hidden />
            ADD STEP
          </button>
        )}
      </div>
      <div className="px-4 py-3 border-t border-[rgba(107,138,64,0.25)] shrink-0 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} className="vvu6c-btn min-h-[44px] vvu-label text-[10px] font-bold border-[rgba(107,138,64,0.35)] text-[#7a8a6e] hover:text-[#c9d4bd] hover:border-[#8fb35a]">CANCEL</Button>
        <Button type="button" variant="outline" disabled={!name.trim() || steps.length === 0 || mutation.isPending} onClick={() => mutation.mutate()} className="vvu6c-btn min-h-[44px] vvu-label text-[10px] font-bold border-[#c8ff00]/50 text-[#c8ff00] hover:bg-[#c8ff00]/10 disabled:opacity-40">
          {mutation.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          {editing ? 'SAVE SEQUENCE' : 'CREATE SEQUENCE'}
        </Button>
      </div>
    </DialogShell>
  );
}

// ─── §1/§3 contact dialog — the composer ───────────────────────────────────

interface DraftApi {
  success: boolean;
  draft?: DraftResponse;
  message?: string;
  blocked?: boolean;
}

interface StepSendApi extends StepSendResponse {
  error?: string;
  message?: string;
  success?: boolean;
}

function ContactDialog({
  target,
  sequences,
  emails,
  resendConfigured,
  onClose,
}: {
  target: OutreachTarget;
  sequences: OutreachSequence[];
  emails: OutreachEmail[];
  resendConfigured: boolean;
  onClose: () => void;
}) {
  const invalidate = useInvalidateEngine();
  const [consent, setConsent] = useState<ConsentBasis>(target.consentBasis);
  const [issue, setIssue] = useState(target.criticalIssue ?? '');
  const [sequenceId, setSequenceId] = useState<string>(target.sequenceId ?? '');
  const [stepIdx, setStepIdx] = useState<number>(
    Math.min(target.currentStep + 1, Math.max(0, (sequences.find((s) => s.id === target.sequenceId)?.steps.length ?? 1) - 1))
  );
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [confirmLive, setConfirmLive] = useState(false);
  const [bodyEmail, setBodyEmail] = useState<OutreachEmail | null>(null);
  // Round 18 — ICP editor state (score card above the composer)
  const [showIcpEdit, setShowIcpEdit] = useState(false);
  const [icp, setIcp] = useState<IcpFormState>(() => icpFormFromProfile(targetProfile(target)));

  const icpPreview = useMemo(() => scoreLead(icpFormToProfile(icp)), [icp]);
  const icpDirty = useMemo(() => JSON.stringify(icpFormToProfile(icp)) !== JSON.stringify(targetProfile(target)), [icp, target]);

  const sequence = sequences.find((s) => s.id === sequenceId) ?? null;
  const history = useMemo(
    () => emails.filter((e) => e.targetId === target.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [emails, target.id]
  );
  const nextStatus = NEXT_STATUS[target.status];

  // ── PATCH helper (consent / status / assign / issue) ──
  const patchMutation = useMutation<{ success: boolean; message?: string }, HttpError, Record<string, unknown>>({
    mutationFn: async (patch) => {
      const res = await fetch('/api/vvu/outreach', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: target.id, ...patch }),
      });
      const data = (await res.json().catch(() => ({}))) as { success: boolean; message?: string };
      if (!res.ok || !data.success) {
        throw new HttpError(data.message ?? `UPDATE FAILED · HTTP ${res.status}`, res.status);
      }
      return data;
    },
    onSuccess: () => invalidate(),
    onError: (err) => toast.error('UPDATE FAILED', { description: err.message }),
  });

  const draftMutation = useMutation<DraftApi, HttpError, void>({
    mutationFn: async () => {
      const res = await fetch('/api/vvu/outreach/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: target.id, sequenceId, stepIndex: stepIdx }),
      });
      const data = (await res.json().catch(() => ({}))) as DraftApi;
      if (!res.ok || !data.success) {
        throw new HttpError(data.message ?? `DRAFT FAILED · HTTP ${res.status}`, res.status);
      }
      return data;
    },
    onSuccess: (data) => {
      setDraft(data.draft ?? null);
      setConfirmLive(false);
      toast.success('DRAFT COMPOSED', {
        id: 'engine-draft',
        description: `${data.draft?.stepLabel ?? ''} · ${data.draft?.source === 'ai' ? 'AI-PERSONALISED' : 'TEMPLATE FALLBACK'} · WORM OUTREACH_DRAFT`,
      });
    },
    onError: (err) => {
      toast.error('DRAFT REFUSED', { id: 'engine-draft', description: err.message });
    },
  });

  const sendMutation = useMutation<StepSendApi, HttpError, boolean>({
    mutationFn: async (dryRun) => {
      const res = await fetch('/api/vvu/outreach/send-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetIds: [target.id], sequenceId, stepIndex: stepIdx, dryRun }),
      });
      const data = (await res.json().catch(() => ({}))) as StepSendApi;
      if (!res.ok) {
        throw new HttpError(data.error ?? data.message ?? `SEND FAILED · HTTP ${res.status}`, res.status);
      }
      return data;
    },
    onSuccess: (data, dryRun) => {
      if (dryRun) {
        const preview = data.previews[0];
        if (preview) {
          setDraft({ subject: preview.subject, bodyText: '', bodyHtml: preview.html, source: preview.source, stepLabel: preview.stepLabel });
          setConfirmLive(false);
        }
        toast.success(`DRY-RUN COMPLETE · ${data.blocked} BLOCKED`, {
          id: 'engine-send',
          description: 'no message sent — draft stored as DRY_RUN evidence row',
        });
      } else {
        toast.success(`SEND COMPLETE · ${data.sent} SENT · ${data.failed} FAILED`, {
          id: 'engine-send',
          description: 'WORM OUTREACH_SENT appended · personalised body stored',
        });
      }
      invalidate();
    },
    onError: (err) => {
      toast.error('SEND FAILED', { id: 'engine-send', description: err.message });
    },
  });

  // ── email body viewer (history) ──
  const bodyMutation = useMutation<{ success: boolean; email?: OutreachEmail; message?: string }, HttpError, string>({
    mutationFn: async (emailId) => {
      const res = await fetch(`/api/vvu/outreach?emailId=${encodeURIComponent(emailId)}`, { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as { success: boolean; email?: OutreachEmail; message?: string };
      if (!res.ok || !data.success) {
        throw new HttpError(data.message ?? `EMAIL FETCH FAILED · HTTP ${res.status}`, res.status);
      }
      return data;
    },
    onSuccess: (data) => setBodyEmail(data.email ?? null),
    onError: (err) => toast.error('EMAIL FETCH FAILED', { description: err.message }),
  });

  const popiaRefused = consent === 'NONE';
  const liveDisabled = !resendConfigured;

  return (
    <DialogShell
      title={target.org}
      kicker={`CONTACT COMMAND · ${target.email} · ${target.status}`}
      onClose={onClose}
      closeLabel="close contact dialog"
      widthClass="sm:max-w-[720px]"
      tone={popiaRefused ? 'rgba(229,72,77,0.45)' : 'rgba(107,138,64,0.35)'}
    >
      <div className="px-4 py-4 space-y-5 overflow-y-auto">
        {/* consent + issue */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="vvu-label text-[9px] text-[#7a8a6e] mb-2">CONSENT BASIS · POPIA s69 GATE</div>
            <ConsentSelect value={consent} onChange={setConsent} ariaLabel="consent basis" />
            {popiaRefused && (
              <p className="vvu-label text-[8px] text-[#e5484d] mt-2 leading-relaxed">NONE REFUSES EVERY DRAFT + SEND — SERVER-SIDE</p>
            )}
          </div>
          <div>
            <label htmlFor={`ct-issue-${target.id}`} className="vvu-label text-[9px] text-[#7a8a6e] mb-2 block">CRITICAL ISSUE (FEEDS THE AI)</label>
            <input id={`ct-issue-${target.id}`} type="text" value={issue} onChange={(e) => setIssue(e.target.value)} maxLength={300} className={INPUT_CLASS} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={patchMutation.isPending}
            onClick={() => patchMutation.mutate({ consentBasis: consent, criticalIssue: issue })}
            className="vvu6c-btn min-h-[44px] vvu-label text-[10px] font-bold border-[#c8ff00]/50 text-[#c8ff00] hover:bg-[#c8ff00]/10"
          >
            {patchMutation.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            SAVE TARGET
          </Button>
          {nextStatus && target.status !== 'BLOCKED' && (
            <Button
              type="button"
              variant="outline"
              disabled={patchMutation.isPending}
              onClick={() => patchMutation.mutate({ status: nextStatus })}
              className="vvu6c-btn min-h-[44px] vvu-label text-[10px] font-bold border-[rgba(107,138,64,0.45)] text-[#8fb35a] hover:border-[#8fb35a] hover:text-[#c9d4bd]"
            >
              ADVANCE ▸ {nextStatus}
              <ChevronRight className="size-3.5" aria-hidden />
            </Button>
          )}
        </div>

        {/* Round 18 — LEAD SCORE card (rubric breakdown + ICP editor) */}
        <div className="p-3 rounded border border-[rgba(107,138,64,0.25)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Crosshair className="size-3.5 text-[#c8ff00] shrink-0" aria-hidden />
              <span className="vvu-label text-[9px] font-bold text-[#f3e38a]">LEAD SCORE</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <ScoreChip target={target} />
              {icpPreview.icpFit && <Chip tone="teal" dashed className="!px-1.5 !py-0.5 !text-[8px]">ICP FIT</Chip>}
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowIcpEdit((v) => !v)}
                aria-expanded={showIcpEdit}
                aria-controls={`ct-icp-${target.id}`}
                className="vvu6c-btn min-h-[32px] vvu-label text-[8px] font-bold px-2 border-[rgba(107,138,64,0.45)] text-[#8fb35a] hover:border-[#8fb35a] hover:text-[#c9d4bd]"
              >
                {showIcpEdit ? 'CLOSE ICP' : 'EDIT ICP'}
              </Button>
            </div>
          </div>
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-start">
            <ScoreBreakdownView result={icpPreview} />
            {showIcpEdit && (
              <div className="sm:w-[200px] shrink-0 space-y-2">
                {icpDirty && (
                  <Chip tone="ochre" dashed className="!text-[8px]">
                    {icpPreview.tier === 'UNSCORED' ? 'CLEARS PROFILE' : `PREVIEW ${icpPreview.score} ${icpPreview.tier}`}
                  </Chip>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={patchMutation.isPending || !icpDirty}
                  onClick={() => {
                    const p = icpFormToProfile(icp);
                    patchMutation.mutate({
                      sector: p.sector,
                      annualRevenue: p.annualRevenue,
                      employees: p.employees,
                      bbbeeLevel: p.bbbeeLevel,
                      supplierCount: p.supplierCount,
                      auditFail12m: p.auditFail12m,
                      popiaRisk: p.popiaRisk,
                      govContracts: p.govContracts,
                    });
                  }}
                  className="vvu6c-btn w-full min-h-[44px] vvu-label text-[10px] font-bold border-[#c8ff00]/50 text-[#c8ff00] hover:bg-[#c8ff00]/10 disabled:opacity-40"
                >
                  {patchMutation.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                  RE-SCORE ▸ SAVE ICP
                </Button>
              </div>
            )}
          </div>
          {showIcpEdit && (
            <div id={`ct-icp-${target.id}`} className="pt-2 border-t border-[rgba(107,138,64,0.18)]">
              <IcpProfileFields form={icp} onChange={setIcp} idPrefix={`ct-icp-${target.id}`} />
            </div>
          )}
        </div>

        {/* sequence assignment */}
        <div className="p-3 rounded border border-[rgba(107,138,64,0.25)] space-y-3">
          <div className="vvu-label text-[9px] text-[#7a8a6e]">ASSIGNED SEQUENCE · STEP {sequence ? `${Math.min(target.currentStep + 1, sequence.steps.length)}/${sequence.steps.length}` : '—'}</div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="sequence assignment">
            <button
              type="button"
              onClick={() => {
                setSequenceId('');
                setDraft(null);
                setConfirmLive(false);
              }}
              aria-pressed={sequenceId === ''}
              className={cn(
                'vvu6c-btn vvu-label text-[9px] font-bold min-h-[44px] px-2.5 rounded border whitespace-nowrap',
                sequenceId === ''
                  ? 'border-[#e0a030]/60 bg-[#e0a030]/10 text-[#e0a030]'
                  : 'border-[rgba(107,138,64,0.35)] text-[#8fb35a] hover:border-[#8fb35a] hover:text-[#c9d4bd]'
              )}
            >
              UNASSIGNED
            </button>
            {sequences.map((s) => {
              const active = sequenceId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSequenceId(s.id);
                    setDraft(null);
                    setConfirmLive(false);
                    setStepIdx(Math.min(target.currentStep + 1, s.steps.length - 1));
                  }}
                  aria-pressed={active}
                  title={`${s.steps.length} steps · D${s.steps[0]?.day ?? 1}→D${s.steps[s.steps.length - 1]?.day ?? 1}`}
                  className={cn(
                    'vvu6c-btn vvu-label text-[9px] font-bold min-h-[44px] px-2.5 rounded border whitespace-nowrap',
                    active
                      ? 'border-[#c8ff00]/60 bg-[#c8ff00]/10 text-[#c8ff00]'
                      : 'border-[rgba(107,138,64,0.35)] text-[#8fb35a] hover:border-[#8fb35a] hover:text-[#c9d4bd]'
                  )}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
          {sequenceId !== (target.sequenceId ?? '') && (
            <Button
              type="button"
              variant="outline"
              disabled={patchMutation.isPending}
              onClick={() => patchMutation.mutate({ sequenceId: sequenceId || null })}
              className="vvu6c-btn min-h-[44px] vvu-label text-[10px] font-bold border-[rgba(107,138,64,0.45)] text-[#8fb35a] hover:border-[#8fb35a] hover:text-[#c9d4bd]"
            >
              ASSIGN SEQUENCE (WORM OUTREACH_ASSIGNED)
            </Button>
          )}
        </div>

        {/* composer */}
        {sequence ? (
          <div className="p-3 rounded border border-[rgba(107,138,64,0.25)] space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="vvu-label text-[9px] text-[#7a8a6e]">COMPOSER · STEP SELECT</div>
              <Chip tone={popiaRefused ? 'crimson' : 'dim'}>{popiaRefused ? 'POPIA GATE · REFUSED' : 'AI RUNS SERVER-SIDE'}</Chip>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="sequence step selector">
              {sequence.steps.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setStepIdx(i);
                    setDraft(null);
                    setConfirmLive(false);
                  }}
                  aria-pressed={stepIdx === i}
                  title={s.subject}
                  className={cn(
                    'vvu6c-btn vvu-label text-[9px] font-bold min-h-[44px] px-2.5 rounded border whitespace-nowrap',
                    stepIdx === i
                      ? 'border-[#c8ff00]/60 bg-[#c8ff00]/10 text-[#c8ff00]'
                      : i <= target.currentStep
                        ? 'border-[rgba(143,179,90,0.3)] text-[#7a8a6e]'
                        : 'border-[rgba(107,138,64,0.35)] text-[#8fb35a] hover:border-[#8fb35a] hover:text-[#c9d4bd]'
                  )}
                >
                  S{i + 1} · D{s.day}
                  {i <= target.currentStep ? ' ✓' : ''}
                </button>
              ))}
            </div>
            <p className="vvu-label text-[8px] text-[#8fb35a] leading-relaxed truncate" title={sequence.steps[stepIdx]?.subject}>
              SUBJECT · {sequence.steps[stepIdx]?.subject ?? '—'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={draftMutation.isPending || popiaRefused}
                onClick={() => draftMutation.mutate()}
                className="vvu6c-btn min-h-[44px] vvu-label text-[10px] font-bold border-[#c8ff00]/50 text-[#c8ff00] hover:bg-[#c8ff00]/10 disabled:opacity-40"
              >
                {draftMutation.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
                DRAFT · AI
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={sendMutation.isPending || popiaRefused}
                onClick={() => sendMutation.mutate(true)}
                className="vvu6c-btn min-h-[44px] vvu-label text-[10px] font-bold border-[#e0a030]/50 text-[#e0a030] hover:bg-[#e0a030]/10 disabled:opacity-40"
              >
                {sendMutation.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <FlaskConical className="size-3.5" aria-hidden />}
                DRY-RUN SEND
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={liveDisabled || sendMutation.isPending || popiaRefused}
                title={liveDisabled ? 'RESEND_API_KEY not configured — server refuses real sends (501)' : 'Sends via Resend REST from the server'}
                onClick={() => {
                  if (confirmLive) {
                    sendMutation.mutate(false);
                  } else {
                    setConfirmLive(true);
                    window.setTimeout(() => setConfirmLive(false), 6000);
                  }
                }}
                className={cn(
                  'vvu6c-btn min-h-[44px] vvu-label text-[10px] font-bold border-[#e5484d]/60 text-[#e5484d] hover:bg-[#e5484d]/10 disabled:opacity-40',
                  confirmLive && !liveDisabled && 'bg-[#e5484d]/15'
                )}
              >
                {sendMutation.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Send className="size-3.5" aria-hidden />}
                {liveDisabled ? 'LIVE SEND · KEY NEEDED' : confirmLive ? 'CONFIRM LIVE ▸' : 'LIVE SEND'}
              </Button>
            </div>
            {draft && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={draft.source === 'ai' ? 'lime' : 'amber'}>{draft.source === 'ai' ? 'AI-PERSONALISED' : 'TEMPLATE FALLBACK'}</Chip>
                  <Chip tone="dim" dashed>{draft.stepLabel}</Chip>
                </div>
                <p className="font-mono text-[11px] text-[#c9d4bd] break-all">{draft.subject}</p>
                <EmailSandbox html={draft.bodyHtml} label="rendered personalised draft preview" />
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 rounded border border-dashed border-[rgba(107,138,64,0.3)]">
            <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed">ASSIGN A SEQUENCE TO ENABLE THE COMPOSER — DRAFT · DRY-RUN · LIVE SEND</p>
          </div>
        )}

        {/* history */}
        <div className="space-y-2">
          <div className="vvu-label text-[9px] text-[#7a8a6e]">EMAIL HISTORY · {history.length} ROW{history.length === 1 ? '' : 'S'}</div>
          {history.length === 0 ? (
            <div className="p-3 rounded border border-dashed border-[rgba(107,138,64,0.3)]">
              <p className="vvu-label text-[8px] text-[#7a8a6e]">NO EMAILS YET — DRAFT OR SEND ABOVE</p>
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded border border-[rgba(107,138,64,0.2)] divide-y divide-[rgba(107,138,64,0.15)]">
              {history.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => bodyMutation.mutate(e.id)}
                  aria-label={`view email ${e.subject}`}
                  className="w-full text-left px-3 py-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 hover:bg-[rgba(107,138,64,0.08)] transition-colors"
                >
                  <Chip tone={EMAIL_STATUS_TONE[e.status] ?? 'dim'}>{e.status}</Chip>
                  <span className="font-mono text-[10px] text-[#c9d4bd] truncate flex-1 min-w-[140px]">{e.subject}</span>
                  {e.stepIndex !== null && <Chip tone="dim" dashed>S{e.stepIndex + 1}</Chip>}
                  {e.aiGenerated && <Chip tone="lime" dashed>AI</Chip>}
                  <span className="vvu-label text-[8px] text-[#7a8a6e] shrink-0">{fmtStamp(e.createdAt)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {bodyEmail && bodyEmail.bodyHtml && (
        <div className="absolute inset-0 z-10 flex flex-col bg-[#060806]/95">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[rgba(107,138,64,0.25)] shrink-0">
            <DialogTitle className="font-mono text-[11px] font-bold text-[#c8ff00]">STORED EMAIL · {bodyEmail.status}</DialogTitle>
            <button type="button" onClick={() => setBodyEmail(null)} aria-label="close stored email view" className="shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] rounded-sm text-[#7a8a6e] hover:text-[#e5484d] transition-colors">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <EmailSandbox html={bodyEmail.bodyHtml} label="stored email body" />
        </div>
      )}
    </DialogShell>
  );
}

// ─── §2 sequence card ───────────────────────────────────────────────────────

function SequenceCard({
  sequence,
  assignedCount,
  onEdit,
}: {
  sequence: OutreachSequence;
  assignedCount: number;
  onEdit: () => void;
}) {
  const invalidate = useInvalidateEngine();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busyStep, setBusyStep] = useState<number | null>(null);

  const bulkSend = useMutation<StepSendApi, HttpError, { stepIndex: number; dryRun: boolean }>({
    mutationFn: async ({ stepIndex, dryRun }) => {
      const res = await fetch('/api/vvu/outreach/send-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequenceId: sequence.id, stepIndex, dryRun }),
      });
      const data = (await res.json().catch(() => ({}))) as StepSendApi;
      if (!res.ok) {
        throw new HttpError(data.error ?? data.message ?? `BULK SEND FAILED · HTTP ${res.status}`, res.status);
      }
      return data;
    },
    onSuccess: (data, vars) => {
      if (vars.dryRun) {
        toast.success(
          `DRY-RUN STEP ${vars.stepIndex + 1} — ${data.previews.length} PREVIEW${data.previews.length === 1 ? '' : 'S'} · ${data.blocked} BLOCKED`,
          { id: 'engine-bulk', description: 'no messages sent — DRY_RUN evidence rows stored' }
        );
      } else {
        toast.success(`STEP ${vars.stepIndex + 1} SENT — ${data.sent} · FAILED ${data.failed} · BLOCKED ${data.blocked}`, {
          id: 'engine-bulk',
          description: 'WORM OUTREACH_SENT events appended per contact',
        });
      }
      invalidate();
    },
    onError: (err) => toast.error('BULK SEND FAILED', { id: 'engine-bulk', description: err.message }),
  });

  const toggleActive = useMutation<{ success: boolean; message?: string }, HttpError, void>({
    mutationFn: async () => {
      const res = await fetch('/api/vvu/sequences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sequence.id, active: !sequence.active }),
      });
      const data = (await res.json().catch(() => ({}))) as { success: boolean; message?: string };
      if (!res.ok || !data.success) throw new HttpError(data.message ?? 'TOGGLE FAILED', res.status);
      return data;
    },
    onSuccess: () => invalidate(),
    onError: (err) => toast.error('TOGGLE FAILED', { description: err.message }),
  });

  const deleteSeq = useMutation<{ success: boolean; unassigned?: number; message?: string }, HttpError, void>({
    mutationFn: async () => {
      const res = await fetch('/api/vvu/sequences', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sequence.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { success: boolean; unassigned?: number; message?: string };
      if (!res.ok || !data.success) throw new HttpError(data.message ?? 'DELETE FAILED', res.status);
      return data;
    },
    onSuccess: (data) => {
      toast.success('SEQUENCE DELETED', { description: `${data.unassigned ?? 0} targets unassigned · WORM OUTREACH_SEQUENCE_DELETED` });
      invalidate();
    },
    onError: (err) => toast.error('DELETE FAILED', { description: err.message }),
  });

  return (
    <div className="vvu-panel-solid p-3.5 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="vvu-label text-[11px] font-bold text-[#f3e38a] tracking-[0.12em] truncate">{sequence.name}</h3>
        <Chip tone={sequence.active ? 'lime' : 'dim'} dashed={!sequence.active}>{sequence.active ? 'ACTIVE' : 'PAUSED'}</Chip>
        <Chip tone="dim">{sequence.steps.length} STEPS · D{sequence.steps[0]?.day ?? 1}→D{sequence.steps[sequence.steps.length - 1]?.day ?? 1}</Chip>
        <Chip tone="sage"><Users className="size-2.5" aria-hidden /> {assignedCount} ASSIGNED</Chip>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button type="button" onClick={onEdit} aria-label={`edit sequence ${sequence.name}`} className="vvu6c-btn vvu-label text-[8px] font-bold min-h-[36px] [@media(pointer:coarse)]:min-h-[44px] px-2 rounded border border-[rgba(107,138,64,0.35)] text-[#8fb35a] hover:border-[#8fb35a] hover:text-[#c9d4bd] inline-flex items-center gap-1 transition-colors">
            <Pencil className="size-3" aria-hidden /> EDIT
          </button>
          <button type="button" onClick={() => toggleActive.mutate()} disabled={toggleActive.isPending} aria-label={sequence.active ? `pause sequence ${sequence.name}` : `activate sequence ${sequence.name}`} className="vvu6c-btn vvu-label text-[8px] font-bold min-h-[36px] [@media(pointer:coarse)]:min-h-[44px] px-2 rounded border border-[rgba(107,138,64,0.35)] text-[#8fb35a] hover:border-[#8fb35a] hover:text-[#c9d4bd] transition-colors disabled:opacity-40">
            {toggleActive.isPending ? '…' : sequence.active ? 'PAUSE' : 'ACTIVATE'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirmDelete) {
                deleteSeq.mutate();
              } else {
                setConfirmDelete(true);
                window.setTimeout(() => setConfirmDelete(false), 6000);
              }
            }}
            disabled={deleteSeq.isPending}
            aria-label={`delete sequence ${sequence.name}`}
            className={cn(
              'vvu6c-btn vvu-label text-[8px] font-bold min-h-[36px] [@media(pointer:coarse)]:min-h-[44px] px-2 rounded border inline-flex items-center gap-1 transition-colors disabled:opacity-40',
              confirmDelete ? 'border-[#e5484d]/60 bg-[#e5484d]/15 text-[#e5484d]' : 'border-[rgba(229,72,77,0.35)] text-[#7a8a6e] hover:text-[#e5484d] hover:border-[#e5484d]/60'
            )}
          >
            <Trash2 className="size-3" aria-hidden /> {confirmDelete ? 'CONFIRM?' : 'DELETE'}
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        {sequence.steps.map((s, i) => {
          const busy = bulkSend.isPending && busyStep === i;
          return (
            <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-2.5 py-2 rounded border border-[rgba(107,138,64,0.18)]">
              <span className="vvu-label text-[9px] font-bold text-[#c8ff00] border border-[#c8ff00]/40 rounded px-1.5 py-0.5 shrink-0 tabular-nums">D{s.day}</span>
              <span className="font-mono text-[10px] text-[#c9d4bd] truncate flex-1 min-w-[160px]" title={s.subject}>{s.subject}</span>
              <span className="vvu-label text-[8px] text-[#7a8a6e] truncate max-w-[240px] hidden sm:block" title={s.angle}>{s.angle}</span>
              <button
                type="button"
                disabled={busy || assignedCount === 0}
                onClick={() => {
                  setBusyStep(i);
                  bulkSend.mutate({ stepIndex: i, dryRun: true });
                }}
                title={assignedCount === 0 ? 'no targets assigned to this sequence' : 'compose + store DRY_RUN previews for all assigned (≤10)'}
                className="vvu6c-btn vvu-label text-[8px] font-bold min-h-[36px] [@media(pointer:coarse)]:min-h-[44px] px-2 rounded border border-[#e0a030]/50 text-[#e0a030] hover:bg-[#e0a030]/10 inline-flex items-center gap-1 transition-colors disabled:opacity-40 shrink-0"
              >
                {busy ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <FlaskConical className="size-3" aria-hidden />}
                ALL · DRY
              </button>
            </div>
          );
        })}
      </div>
      {assignedCount > 10 && (
        <p className="vvu-label text-[8px] text-[#7a8a6e]">BATCH CAP 10 PER CALL — THE FIRST 10 ASSIGNED (ASC) ARE COMPOSED</p>
      )}
    </div>
  );
}

// ─── §1 kanban board ────────────────────────────────────────────────────────

function KanbanBoard({
  targets,
  sequences,
  onOpenContact,
}: {
  targets: OutreachTarget[];
  sequences: OutreachSequence[];
  onOpenContact: (t: OutreachTarget) => void;
}) {
  const invalidate = useInvalidateEngine();
  const advance = useMutation<{ success: boolean; message?: string }, HttpError, { id: string; status: string }>({
    mutationFn: async ({ id, status }) => {
      const res = await fetch('/api/vvu/outreach', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const data = (await res.json().catch(() => ({}))) as { success: boolean; message?: string };
      if (!res.ok || !data.success) throw new HttpError(data.message ?? 'ADVANCE FAILED', res.status);
      return data;
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (err) => toast.error('ADVANCE FAILED', { description: err.message }),
  });

  return (
    <div className="overflow-x-auto pb-2 -mx-1 px-1" role="list" aria-label="pipeline kanban board">
      <div className="flex gap-2.5 min-w-max">
        {LANES.map((lane) => {
          // Round 18 — score-desc inside each lane (UNSCORED sinks to bottom)
          const laneTargets = targets
            .filter((t) => laneOf(t.status) === lane.key)
            .sort((a, b) => (b.tier === 'UNSCORED' ? -1 : 0) - (a.tier === 'UNSCORED' ? -1 : 0) || b.score - a.score);
          return (
            <section
              key={lane.key}
              aria-label={`pipeline lane ${lane.key}`}
              className="w-[172px] sm:w-[210px] shrink-0 rounded border border-[rgba(107,138,64,0.2)] bg-[#0a0d09]/60 flex flex-col"
            >
              <div className="px-2.5 py-2 border-b border-[rgba(107,138,64,0.18)] flex items-center justify-between gap-2">
                <Chip tone={lane.tone}>{lane.key}</Chip>
                <span className="vvu-label text-[9px] font-bold text-[#c9d4bd] tabular-nums">{laneTargets.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[120px] max-h-[420px] overflow-y-auto">
                {laneTargets.length === 0 ? (
                  <p className="vvu-label text-[8px] text-[#7a8a6e] py-4 text-center">EMPTY</p>
                ) : (
                  laneTargets.map((t) => {
                    const seq = sequences.find((s) => s.id === t.sequenceId);
                    const next = NEXT_STATUS[t.status];
                    return (
                      <div
                        key={t.id}
                        role="listitem"
                        className="group/card p-2.5 rounded border border-[rgba(107,138,64,0.25)] bg-[#060806] hover:border-[#c8ff00]/50 transition-colors cursor-pointer"
                        tabIndex={0}
                        onClick={() => onOpenContact(t)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onOpenContact(t);
                          }
                        }}
                        aria-label={`open contact ${t.org}`}
                      >
                        <div className="font-mono text-[10px] font-bold text-[#d7e2c9] truncate">{t.org}</div>
                        <div className="font-mono text-[9px] text-[#7a8a6e] truncate mt-0.5">{t.contactName}</div>
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          <ScoreChip target={t} />
                          {t.sector && (
                            <Chip tone="dim" dashed className="!px-1.5 !py-0.5 !text-[8px]">{t.sector}</Chip>
                          )}
                          <Chip tone={CONSENT_TONE[t.consentBasis]} className="!px-1.5 !py-0.5 !text-[8px]">
                            {t.consentBasis === 'EXISTING_CUSTOMER' ? 'CUST.' : t.consentBasis}
                          </Chip>
                          {t.status !== lane.key && <Chip tone="dim" dashed className="!px-1.5 !py-0.5 !text-[8px]">{t.status}</Chip>}
                          {seq && (
                            <Chip tone="sage" dashed className="!px-1.5 !py-0.5 !text-[8px]">
                              S{Math.min(t.currentStep + 1, seq.steps.length)}/{seq.steps.length}
                            </Chip>
                          )}
                        </div>
                        {next && t.status !== 'BLOCKED' && (
                          <button
                            type="button"
                            disabled={advance.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              advance.mutate({ id: t.id, status: next });
                            }}
                            aria-label={`advance ${t.org} to ${next}`}
                            title={`Advance pipeline → ${next}`}
                            className="mt-2 w-full vvu6c-btn vvu-label text-[8px] font-bold min-h-[32px] px-1.5 rounded border border-[rgba(107,138,64,0.3)] text-[#7a8a6e] hover:border-[#c8ff00]/50 hover:text-[#c8ff00] opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 transition-all inline-flex items-center justify-center gap-1 disabled:opacity-40 [@media(pointer:coarse)]:opacity-100"
                          >
                            ADVANCE ▸ {next}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ─── §4 funnel ──────────────────────────────────────────────────────────────

function FunnelPanel({ targets }: { targets: OutreachTarget[] }) {
  const statusIn = (list: string[]) => targets.filter((t) => list.includes(t.status)).length;

  const engaged = statusIn(['SENT', 'CONTACTED', 'OPENED', 'REPLIED', 'MEETING', 'PILOT', 'CLOSED']);
  const opened = statusIn(['OPENED', 'REPLIED', 'MEETING', 'PILOT', 'CLOSED']);
  const replied = statusIn(['REPLIED', 'MEETING', 'PILOT', 'CLOSED']);
  const meetings = statusIn(['MEETING', 'PILOT', 'CLOSED']);
  const pilots = statusIn(['PILOT', 'CLOSED']);
  const closed = statusIn(['CLOSED']);

  // Round 18 — priority-lane engagement + ICP goal adjudication
  const priority = targets.filter((t) => t.tier === 'PRIORITY');
  const priorityEngaged = priority.filter((t) =>
    ['SENT', 'CONTACTED', 'OPENED', 'REPLIED', 'MEETING', 'PILOT', 'CLOSED'].includes(t.status)
  ).length;

  const rate = (n: number) => (engaged === 0 ? null : Math.round((n / engaged) * 100));
  const replyRate = rate(replied);
  /** ICP GOAL: 15–20% reply rate → at/above band = ON TARGET. */
  const replyVsGoal =
    replyRate === null ? null : replyRate >= 15 ? 'ON TARGET' : replyRate >= 8 ? 'WARMING UP' : 'COLD';

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3.5">
          <LiveBar spec={{ label: 'ENGAGED (SENT FOR REAL)', current: engaged, target: Math.max(targets.length, 1), unit: 'CONTACTS', fmt: 'num' }} />
          <LiveBar spec={{ label: 'OPENED', current: opened, target: Math.max(engaged, 1), unit: 'CONTACTS', fmt: 'num' }} />
          <LiveBar spec={{ label: 'REPLIED', current: replied, target: Math.max(engaged, 1), unit: 'CONTACTS', fmt: 'num' }} />
          <LiveBar spec={{ label: 'MEETING', current: meetings, target: Math.max(engaged, 1), unit: 'CONTACTS', fmt: 'num' }} />
          <LiveBar spec={{ label: 'PILOT', current: pilots, target: Math.max(engaged, 1), unit: 'CONTACTS', fmt: 'num' }} />
          <LiveBar spec={{ label: 'CLOSED-WON', current: closed, target: Math.max(engaged, 1), unit: 'CONTACTS', fmt: 'num' }} />
        </div>
        <div className="grid grid-cols-2 gap-2.5 content-start">
          {[
            { label: 'OPEN RATE', value: rate(opened), tone: 'lime' as const },
            { label: 'REPLY RATE', value: replyRate, tone: 'ochre' as const },
            { label: 'MEETING RATE', value: rate(meetings), tone: 'teal' as const },
            { label: 'PILOT WIN RATE', value: rate(pilots), tone: 'amber' as const },
            { label: 'CLOSE-WON RATE', value: rate(closed), tone: 'lime' as const },
            { label: 'PRIORITY ENGAGED', value: priority.length === 0 ? null : Math.round((priorityEngaged / priority.length) * 100), tone: 'sage' as const },
          ].map((r) => (
            <div key={r.label} className="p-3 rounded border border-[rgba(107,138,64,0.25)] flex flex-col gap-1.5">
              <span className="vvu-label text-[8px] text-[#7a8a6e]">{r.label}</span>
              <span className={cn('vvu-label text-xl font-bold tabular-nums', r.value === null ? 'text-[#7a8a6e]' : 'text-[#c8ff00]')}>
                {r.value === null ? '—' : `${r.value}%`}
              </span>
              <Chip tone={r.value === null ? 'dim' : r.tone} dashed>
                {r.label === 'PRIORITY ENGAGED'
                  ? priority.length === 0 ? 'NO PRIORITY LEADS' : `${fmtNum(priorityEngaged)}/${fmtNum(priority.length)} PRIORITY`
                  : engaged === 0 ? 'NO ENGAGEMENT YET' : `OF ${fmtNum(engaged)} ENGAGED`}
              </Chip>
            </div>
          ))}
        </div>
      </div>
      {/* Round 18 — ICP goal strip (framework targets, adjudicated live) */}
      <div className="flex flex-wrap items-center gap-2">
        <Crosshair className="size-3 text-[#7a8a6e] shrink-0" aria-hidden />
        <Chip tone={replyVsGoal === 'ON TARGET' ? 'lime' : replyVsGoal === 'WARMING UP' ? 'ochre' : 'dim'} dashed>
          ICP GOAL · REPLY 15–20% · {replyVsGoal ?? 'NO DATA'}
        </Chip>
        <Chip tone={pilots >= 5 ? 'lime' : 'dim'} dashed>
          ICP GOAL · 5–7 PILOTS · {fmtNum(pilots)} LIVE
        </Chip>
        <Chip tone="sage" dashed>90-DAY PILOT WINDOW · R25k–R35k REVENUE BAND</Chip>
      </div>
    </div>
  );
}

// ─── §5 engine WORM log ─────────────────────────────────────────────────────

function EngineLogPanel() {
  const ledger = useLedgerQuery();
  const events = useMemo(
    () => (ledger.data?.entries ?? []).filter((e) => e.source === 'OUTREACH').slice(0, 24),
    [ledger.data]
  );
  if (ledger.isError) {
    return <QueryErrorCard label="WORM LEDGER" onRetry={() => ledger.refetch()} />;
  }
  if (ledger.isLoading) {
    return (
      <div className="space-y-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-6 w-full bg-[#131811]" />
        ))}
      </div>
    );
  }
  return (
    <div className="max-h-72 overflow-y-auto rounded border border-[rgba(107,138,64,0.2)] divide-y divide-[rgba(107,138,64,0.12)]">
      {events.length === 0 ? (
        <p className="vvu-label text-[8px] text-[#7a8a6e] p-4 text-center">NO OUTREACH_* EVENTS ON THE CHAIN YET</p>
      ) : (
        events.map((e) => (
          <div key={e.id} className="px-3 py-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="vvu-label text-[9px] font-bold text-[#c8ff00] tabular-nums shrink-0">#{e.seq}</span>
            <span className="vvu-label text-[8px] text-[#e0a030] shrink-0 w-[168px] truncate" title={e.event}>{e.event}</span>
            <span className="font-mono text-[9px] text-[#c9d4bd] truncate flex-1 min-w-[180px]" title={e.details ?? undefined}>{e.details ?? '—'}</span>
            <span className="vvu-label text-[8px] text-[#7a8a6e] shrink-0">{fmtStamp(e.createdAt)}</span>
          </div>
        ))
      )}
    </div>
  );
}

// ─── main workspace ─────────────────────────────────────────────────────────

export function OutreachWorkspace() {
  const outreach = useOutreachQuery();
  useQueryErrorToast(outreach.isError, outreach.error, 'OUTREACH FEED');
  const sequencesQuery = useSequencesQuery();
  useQueryErrorToast(sequencesQuery.isError, sequencesQuery.error, 'SEQUENCES FEED');

  const targets = outreach.data?.targets ?? [];
  const emails = outreach.data?.emails ?? [];
  const sequences = sequencesQuery.data?.sequences ?? [];
  const resendConfigured = outreach.data?.config?.resendConfigured ?? false;

  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingSeq, setEditingSeq] = useState<OutreachSequence | 'new' | null>(null);
  const [openContactId, setOpenContactId] = useState<string | null>(null);

  const openContact = useMemo(
    () => targets.find((t) => t.id === openContactId) ?? null,
    [targets, openContactId]
  );

  const stats = useMemo(() => {
    const consented = targets.filter((t) => t.consentBasis !== 'NONE').length;
    const assigned = targets.filter((t) => t.sequenceId !== null).length;
    const sent = emails.filter((e) => e.status === 'SENT').length;
    const aiCount = emails.filter((e) => e.aiGenerated).length;
    const priority = targets.filter((t) => t.tier === 'PRIORITY').length;
    return { total: targets.length, consented, assigned, sent, aiCount, priority };
  }, [targets, emails]);

  const scoring = outreach.data?.scoring;

  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 overflow-y-auto">
        <ScadaPolishStyles />
        <div className="max-w-[1320px] mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-5 sm:space-y-6 pb-24">
          {/* headline */}
          <SectionReveal featured>
            <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="sequence engine headline">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="vvu-label text-lg sm:text-2xl font-bold text-[#f3e38a] tracking-[0.14em]">SEQUENCE ENGINE</h1>
                  <p className="vvu-label text-[9px] text-[#7a8a6e] mt-1.5 leading-relaxed max-w-xl">
                    ZERO-CAPITAL SALES AUTOMATION · CADENCES → AI DRAFTS → POPIA-GATED SENDS → PIPELINE KANBAN · EVERY ACTION ON THE WORM CHAIN
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <Chip tone={resendConfigured ? 'lime' : 'amber'} dashed>
                      {resendConfigured ? 'RESEND LIVE' : 'DRY-RUN ONLY · NO RESEND KEY'}
                    </Chip>
                    <Chip tone="lime">AI PERSONALISATION · SERVER-SIDE</Chip>
                    <Chip tone="crimson">POPIA s69 · ARMED</Chip>
                    <Chip tone="dim" dashed>ROUTE 3 · SEND_ENGINE PROJECTION</Chip>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2 shrink-0">
                  {[
                    { label: 'CONTACTS', value: stats.total },
                    { label: 'CONSENTED', value: stats.consented },
                    { label: 'PRIORITY', value: stats.priority },
                    { label: 'AI DRAFTS', value: stats.aiCount },
                  ].map((s) => (
                    <div key={s.label} className="px-3 py-2.5 rounded border border-[rgba(107,138,64,0.25)] min-w-[92px]">
                      <div className="vvu-label text-[8px] text-[#7a8a6e]">{s.label}</div>
                      <div className="vvu-label text-lg font-bold text-[#c8ff00] tabular-nums leading-tight">{fmtNum(s.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </SectionReveal>

          {/* §1 target selection · lead scoring */}
          <SectionReveal>
            <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="target selection lead scoring">
              <SectionHeader
                num="1"
                title="TARGET SELECTION · LEAD SCORING"
                kicker="ICP PROFILE → 6-FACTOR RUBRIC → PRIORITY ≥ 50 · WHO DESERVES A PILOT SLOT"
              />
              {outreach.isLoading ? (
                <Skeleton className="h-48 w-full bg-[#131811]" />
              ) : outreach.isError ? (
                <QueryErrorCard label="OUTREACH FEED" onRetry={() => outreach.refetch()} />
              ) : (
                <LeadScoringPanel targets={targets} scoring={scoring} />
              )}
            </section>
          </SectionReveal>

          {/* §2 contacts + kanban */}
          <SectionReveal>
            <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="contacts and pipeline kanban">
              <SectionHeader
                num="2"
                title="PIPELINE KANBAN · CONTACTS"
                kicker="NEW → SENT → OPENED → REPLIED → MEETING → PILOT → CLOSED · LANES SORTED BY LEAD SCORE"
                right={
                  <>
                    <button
                      type="button"
                      onClick={() => setShowAdd(true)}
                      className="vvu6c-btn vvu-label text-[9px] font-bold min-h-[44px] px-3 rounded border border-[#c8ff00]/50 text-[#c8ff00] hover:bg-[#c8ff00]/10 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                    >
                      <Plus className="size-3" aria-hidden /> ADD CONTACT
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowImport(true)}
                      className="vvu6c-btn vvu-label text-[9px] font-bold min-h-[44px] px-3 rounded border border-[rgba(107,138,64,0.45)] text-[#8fb35a] hover:border-[#8fb35a] hover:text-[#c9d4bd] inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                    >
                      <Upload className="size-3" aria-hidden /> IMPORT CSV
                    </button>
                  </>
                }
              />
              {outreach.isLoading ? (
                <Skeleton className="h-64 w-full bg-[#131811]" />
              ) : outreach.isError ? (
                <QueryErrorCard label="OUTREACH FEED" onRetry={() => outreach.refetch()} />
              ) : targets.length === 0 ? (
                <div className="p-8 rounded border border-dashed border-[rgba(107,138,64,0.3)] text-center">
                  <Mail className="size-5 text-[#7a8a6e] mx-auto mb-2.5" aria-hidden />
                  <p className="vvu-label text-[9px] text-[#7a8a6e]">NO CONTACTS — ADD ONE OR IMPORT A CONSENTED CSV LIST</p>
                  <p className="vvu-label text-[8px] text-[#7a8a6e] mt-1.5">THE TABLE STARTS EMPTY BY DESIGN · NO FABRICATED TARGETS · POPIA s69 GATE REFUSES NONE-CONSENT</p>
                </div>
              ) : (
                <KanbanBoard targets={targets} sequences={sequences} onOpenContact={(t) => setOpenContactId(t.id)} />
              )}
            </section>
          </SectionReveal>

          {/* §3 sequences */}
          <SectionReveal>
            <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="sequence builder">
              <SectionHeader
                num="3"
                title="SEQUENCE BUILDER · CADENCES"
                kicker="MULTI-STEP CADENCES · DAY 1 INTRO · DAY 4 CASE STUDY · DAY 9 CLOSE"
                right={
                  <button
                    type="button"
                    onClick={() => setEditingSeq('new')}
                    className="vvu6c-btn vvu-label text-[9px] font-bold min-h-[44px] px-3 rounded border border-[#c8ff00]/50 text-[#c8ff00] hover:bg-[#c8ff00]/10 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                  >
                    <Plus className="size-3" aria-hidden /> NEW SEQUENCE
                  </button>
                }
              />
              {sequencesQuery.isLoading ? (
                <Skeleton className="h-40 w-full bg-[#131811]" />
              ) : sequencesQuery.isError ? (
                <QueryErrorCard label="SEQUENCES FEED" onRetry={() => sequencesQuery.refetch()} />
              ) : (
                <div className="grid lg:grid-cols-2 gap-3">
                  {sequences.map((s) => (
                    <SequenceCard
                      key={s.id}
                      sequence={s}
                      assignedCount={targets.filter((t) => t.sequenceId === s.id).length}
                      onEdit={() => setEditingSeq(s)}
                    />
                  ))}
                </div>
              )}
            </section>
          </SectionReveal>

          {/* §4 compose & send explainer */}
          <SectionReveal>
            <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="compose and send">
              <SectionHeader num="4" title="COMPOSE &amp; SEND · AI-DRAFTS" kicker="SERVER-SIDE z-ai LLM · TEMPLATE FALLBACK · TWO-CLICK LIVE CONFIRM" />
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded border border-[rgba(107,138,64,0.25)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="size-3.5 text-[#c8ff00] shrink-0" aria-hidden />
                    <span className="vvu-label text-[9px] font-bold text-[#f3e38a]">DRAFT · AI</span>
                  </div>
                  <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed">
                    OPEN ANY CONTACT CARD → ASSIGN A SEQUENCE → PICK A STEP → DRAFT. THE LLM COMPOSES
                    SERVER-SIDE (≤150 WORDS, ONE CLOSING QUESTION, ONLY VERIFIABLE VVU FACTS); FALLBACK IS A
                    DETERMINISTIC TEMPLATE — THE ENGINE NEVER BLOCKS ON AI.
                  </p>
                </div>
                <div className="p-3.5 rounded border border-[rgba(224,160,48,0.3)]">
                  <div className="flex items-center gap-2 mb-2">
                    <FlaskConical className="size-3.5 text-[#e0a030] shrink-0" aria-hidden />
                    <span className="vvu-label text-[9px] font-bold text-[#f3e38a]">DRY-RUN</span>
                  </div>
                  <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed">
                    COMPOSES + STORES THE DRAFT AS A DRY_RUN EVIDENCE ROW AND RENDERS THE INBOX PREVIEW —
                    ZERO NETWORK SENDS. THE POPIA s69 GATE REFUSES NONE-CONSENT EVEN IN DRY-RUN.
                  </p>
                </div>
                <div className="p-3.5 rounded border border-[rgba(229,72,77,0.35)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Send className="size-3.5 text-[#e5484d] shrink-0" aria-hidden />
                    <span className="vvu-label text-[9px] font-bold text-[#f3e38a]">LIVE SEND</span>
                  </div>
                  <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed">
                    REQUIRES RESEND_API_KEY IN SERVER ENV (NEVER CLIENT-SIDE). TWO-CLICK CONFIRM. EVERY SEND
                    LANDS OUTREACH_SENT ON THE SHA-256 WORM CHAIN WITH THE BODY STORED AS EVIDENCE.
                  </p>
                </div>
              </div>
            </section>
          </SectionReveal>

          {/* §5 funnel */}
          <SectionReveal>
            <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="outreach funnel analytics">
              <SectionHeader num="5" title="FUNNEL ANALYTICS" kicker="OPEN / REPLY / MEETING / PILOT CONVERSION · COMPUTED FROM LIVE TARGETS · ICP GOALS: 15–20% REPLY · 5–7 PILOTS" />
              {targets.length === 0 ? (
                <p className="vvu-label text-[8px] text-[#7a8a6e] py-4 text-center">FUNNEL APPEARS ONCE CONTACTS EXIST</p>
              ) : (
                <FunnelPanel targets={targets} />
              )}
            </section>
          </SectionReveal>

          {/* §6 engine WORM log */}
          <SectionReveal>
            <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="engine worm log">
              <SectionHeader
                num="6"
                title="ENGINE WORM LOG"
                kicker="OUTREACH_* EVENTS · SHA-256 CHAIN · LIVE POLL"
                right={<Chip tone="dim" dashed>SERVER LEDGER · NOT localStorage</Chip>}
              />
              <EngineLogPanel />
            </section>
          </SectionReveal>

          {/* footer note */}
          <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
            <ShieldAlert className="size-3 text-[#7a8a6e] shrink-0" aria-hidden />
            <p className="vvu-label text-[8px] text-[#7a8a6e] leading-relaxed">
              NO NEXT_PUBLIC KEYS · AI + RESEND RUN SERVER-SIDE ONLY · CONSENT GATE IS SERVER-ENFORCED ·
              REG 2026/259053/07 · FSM STEADY_STATE_LOCKED
            </p>
          </div>
        </div>
      </div>

      {/* dialogs */}
      {showAdd && <AddContactDialog onClose={() => setShowAdd(false)} />}
      {showImport && <ImportCsvDialog onClose={() => setShowImport(false)} />}
      {editingSeq && (
        <SequenceBuilderDialog
          editing={editingSeq === 'new' ? null : editingSeq}
          onClose={() => setEditingSeq(null)}
        />
      )}
      {openContact && (
        <ContactDialog
          target={openContact}
          sequences={sequences}
          emails={emails}
          resendConfigured={resendConfigured}
          onClose={() => setOpenContactId(null)}
        />
      )}
    </div>
  );
}
