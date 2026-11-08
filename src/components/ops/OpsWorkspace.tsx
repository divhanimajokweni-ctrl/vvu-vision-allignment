'use client';

// src/components/ops/OpsWorkspace.tsx — Task 45 · #/ops
// THE OPERATIONS LOOP — field sales → back office. The 18th projection:
// the operator's Day-1 field-operations directive — the role split ("you
// sell, the system runs the office"), the OPS_SWEEP_30M spec, the manually
// runnable consolidated sweep, exception-only notification formats, the
// automation authority hard rule, the price-card quick reference, the four
// B2B pilot plays, and the DRAFT compliance pack.
//
// Built in the exact IVE visual language of ManifestWorkspace /
// CommercialWorkspace (gold #C9A84C · proven #3DFFB0 · ready #F5A623 ·
// blocked #FF4D5F · lime #c8ff00, Geist + Geist Mono, 228px left nav,
// grid-paper hero, mono labels, responsive grids).
//
// HONESTY (the Day 1 standard, applied to this build):
//   * The sweep is MANUALLY RUNNABLE today. The operator's scheduling system
//     supports daily/weekly/monthly recurrence only — no pretend 30-minute
//     cron is created (SCHEDULING_CONSTRAINT is rendered verbatim, never
//     worked around).
//   * NOT_INSTRUMENTED domains (customer / sales / commercial) render amber
//     with the honest reason — never a fake green, in the spec AND in the
//     live run results.
//   * Every sweep run is WORM-receipted by the backend. The RUN button logs
//     nothing itself — the receipt IS the log.
//   * Pilot readiness items are PLANS — unchecked squares only, never
//     rendered as completed.
//   * The compliance pack is DRAFT — REVIEW REQUIRED on every card, until
//     the lawyer signs off (manifest L7).
//   * Every count on this view is DERIVED from the ops ledger
//     (src/lib/ops-data.ts) at render time. The ledger wins.
//
// Features:
//   * scroll-spy left nav (desktop) + mobile chip strip — jump to any section
//   * count-up stat cards (rAF, prefers-reduced-motion aware)
//   * RUN SWEEP NOW → /api/ops/sweep → verdict + per-domain rows +
//     exception block COPY (clipboard + legacy fallback + toast + WORM log)
//   * one VIEW_OPEN · OPS WORM log per mount

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ClipboardCopy, Loader2, Play, RefreshCw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import {
  AUTOMATION_AUTHORITY,
  AUTOMATION_TAIL,
  B2B_TARGET_WINDOW,
  COMPLIANCE_PACK,
  COMPLIANCE_PACK_NOTE,
  EXCEPTION_FORMATS,
  NOTIFICATION_POLICY,
  PILOT_PLAYS,
  PRICE_CARD,
  PRICE_CARD_CAVEAT,
  ROLE_OPERATOR,
  ROLE_PRINCIPLE,
  ROLE_SYSTEM,
  SWEEP_CADENCE,
  SWEEP_DOMAINS,
  SCHEDULING_CONSTRAINT,
  opsTotals,
  type ExceptionFormat,
  type PriceRow,
  type SweepDomain,
} from '@/lib/ops-data';
import { useSendWormLog } from '@/hooks/use-vvu-socket';

// ── IVE tokens ───────────────────────────────────────────────────────────────

const GOLD = '#C9A84C';
const PROVEN = '#3DFFB0';
const READY = '#F5A623';
const BLOCKED = '#FF4D5F';
const LIME = '#c8ff00';

const SANS = 'var(--font-geist-sans), system-ui, sans-serif';
const MONO = 'var(--font-geist-mono), monospace';

// ── nav sections (DOM order = view order; ids are valid CSS selectors) ───────

interface NavSection {
  key: string;
  code: string;
  title: string;
}

const NAV_SECTIONS: readonly NavSection[] = [
  { key: 'role', code: 'RL', title: 'THE ROLE SPLIT' },
  { key: 'sweep', code: 'SW', title: 'OPS_SWEEP_30M' },
  { key: 'run', code: 'RN', title: 'RUN THE SWEEP' },
  { key: 'formats', code: 'FX', title: 'EXCEPTION FORMATS' },
  { key: 'authority', code: 'AU', title: 'AUTOMATION AUTHORITY' },
  { key: 'pricecard', code: 'PC', title: 'PRICE CARD (V2)' },
  { key: 'pilots', code: 'PL', title: 'PILOT PLAYS' },
  { key: 'compliance', code: 'CM', title: 'COMPLIANCE PACK' },
] as const;

// ── the sweep route's response shape (src/app/api/ops/sweep/route.ts) ───────

interface SweepDomainResult {
  n: number;
  code: string;
  name: string;
  status: 'GREEN' | 'EXCEPTION' | 'NOT_INSTRUMENTED';
  severity?: 'MCP' | 'SECURITY' | 'ACTION REQUIRED';
  lines: string[];
}

interface SweepResult {
  ranAt: string;
  verdict: 'GREEN' | 'ACTION REQUIRED';
  domains: SweepDomainResult[];
  notification: string;
  wormReceiptId?: string;
  durationMs: number;
}

// ── run-result chip tones (GREEN lime · EXCEPTION amber · dim otherwise) ────

const RUN_CHIP: Record<SweepDomainResult['status'], { color: string; border: string; bg: string }> = {
  GREEN: { color: LIME, border: 'rgba(200,255,0,0.45)', bg: 'rgba(200,255,0,0.08)' },
  EXCEPTION: { color: READY, border: 'rgba(245,166,35,0.45)', bg: 'rgba(245,166,35,0.08)' },
  NOT_INSTRUMENTED: { color: 'rgba(244,244,245,0.45)', border: 'rgba(255,255,255,0.12)', bg: 'rgba(255,255,255,0.02)' },
};

// Exception format / notification kinds → colour (IVE tokens only).
const KIND_COLOR: Record<ExceptionFormat['kind'], string> = {
  GREEN: LIME,
  'ACTION REQUIRED': READY,
  SALES: GOLD,
  SECURITY: BLOCKED,
  MCP: PROVEN,
};

// ── count-up (rAF, zero deps — same pattern as manifest/commercial) ─────────

function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    // Single rAF path (also for reduced motion — completes on the first
    // frame; no synchronous setState inside the effect body).
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = reduce ? 1 : Math.min(1, (t - t0) / durationMs);
      const e = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setValue(Math.round(target * e));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, reduce]);

  return value;
}

// ── clipboard (navigator.clipboard + legacy fallback) ────────────────────────

function legacyCopyText(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// ── presentational helpers ────────────────────────────────────────────────────

function SectionHead({ code, title, sub }: { code: string; title: string; sub?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5">
      <span aria-hidden className="h-[14px] w-[3px] rounded-full" style={{ background: GOLD, opacity: 0.85 }} />
      <h2 className="vvu-label text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(244,244,245,0.85)]">
        <span style={{ color: GOLD }}>{code}</span> — {title}
        {sub && (
          <span className="ml-2 font-normal normal-case tracking-normal text-[rgba(244,244,245,0.4)]">({sub})</span>
        )}
      </h2>
    </div>
  );
}

function SubHead({ children, color = 'rgba(244,244,245,0.7)' }: { children: ReactNode; color?: string }) {
  return (
    <h3 className="vvu-label mb-2.5 text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color }}>
      {children}
    </h3>
  );
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 ${className}`}>{children}</div>;
}

/** Shared whileInView entrance (reduced-motion aware). */
function Section({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      id={id}
      role="region"
      aria-label={label}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
      className="mb-6 scroll-mt-4"
    >
      {children}
    </motion.section>
  );
}

/** Honest amber note box (scheduling constraint, price-card caveat, …). */
function HonestNote({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="rounded-lg border border-[rgba(245,166,35,0.35)] bg-[rgba(245,166,35,0.06)] p-3.5">
      <p className="flex items-start gap-2 text-[10.5px] leading-relaxed text-[#F5A623]" style={{ fontFamily: SANS }}>
        <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span>
          <span className="vvu-label mr-1.5 text-[8px] font-bold uppercase tracking-[0.14em]">{label}</span>
          {children}
        </span>
      </p>
    </div>
  );
}

// ── the loop diagram — field sales → operations loop → … → main ──────────────

function LoopFlow() {
  const nodes: { title: string; sub?: string; accent: string; hub?: boolean }[] = [
    { title: 'FIELD SALES', sub: 'prospects · replies · leads · problems · payments', accent: GOLD },
    { title: 'OPERATIONS LOOP', sub: 'MCP + IVE + PM/OPS', accent: LIME, hub: true },
    { title: 'INCIDENTS · USERS · DEPLOYMENTS', accent: 'rgba(244,244,245,0.78)' },
    { title: 'RECEIPT / ACTION', accent: PROVEN },
    { title: 'MAIN', accent: GOLD },
  ];
  return (
    <div
      role="group"
      aria-label="The loop: field sales feeds the operations loop; the loop watches incidents, users and deployments, returns a receipt or an action, and closes back at main."
      className="flex flex-col items-stretch gap-1.5 lg:flex-row lg:items-center"
    >
      {nodes.map((node, i) => (
        <Fragment key={node.title}>
          {i > 0 && (
            <span
              aria-hidden
              className="flex shrink-0 items-center justify-center py-0.5 text-[13px] font-bold text-[rgba(244,244,245,0.35)] lg:py-0"
              style={{ fontFamily: MONO }}
            >
              <span className="hidden lg:inline">→</span>
              <span className="lg:hidden">↓</span>
            </span>
          )}
          <div
            className={`relative flex-1 rounded-lg border p-3 ${node.hub ? 'bg-[rgba(200,255,0,0.04)]' : 'bg-white/[0.02]'}`}
            style={{ borderColor: node.hub ? 'rgba(200,255,0,0.42)' : 'rgba(255,255,255,0.09)' }}
          >
            {node.hub && (
              <span
                aria-hidden
                className="absolute inset-x-3 top-0 h-[2px] rounded-full"
                style={{ background: LIME, opacity: 0.55 }}
              />
            )}
            <p className="vvu-label text-[9.5px] font-bold leading-snug tracking-[0.05em]" style={{ color: node.accent, fontFamily: MONO }}>
              {node.title}
            </p>
            {node.sub && <p className="vvu-label mt-1.5 text-[8px] leading-snug text-[rgba(244,244,245,0.5)]">{node.sub}</p>}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

// ── sweep domain spec card ────────────────────────────────────────────────────

function DomainCard({ domain, index }: { domain: SweepDomain; index: number }) {
  const live = domain.status === 'LIVE';
  const accent = live ? LIME : READY;
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.04, 0.3), ease: 'easeOut' }}
      className="flex flex-col rounded-lg border bg-white/[0.02] p-3.5"
      style={{ borderColor: live ? 'rgba(200,255,0,0.22)' : 'rgba(245,166,35,0.22)' }}
      aria-label={`Sweep domain ${domain.n} ${domain.code} — ${domain.name} — ${domain.status}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="vvu-label flex size-7 shrink-0 items-center justify-center rounded border text-[9px] font-bold"
            style={{ color: accent, borderColor: live ? 'rgba(200,255,0,0.3)' : 'rgba(245,166,35,0.3)' }}
          >
            {String(domain.n).padStart(2, '0')}
          </span>
          <h3 className="min-w-0 truncate text-[12px] font-semibold text-[#F4F4F5]" style={{ fontFamily: SANS }}>
            <span style={{ fontFamily: MONO, color: accent }}>{domain.code}</span>
            <span className="text-[rgba(244,244,245,0.4)]"> · </span>
            {domain.name}
          </h3>
        </div>
        <span
          className="vvu-label inline-flex shrink-0 items-center gap-1.5 rounded border px-1.5 py-0.5 text-[7px] font-bold"
          style={{ color: accent, borderColor: live ? 'rgba(200,255,0,0.4)' : 'rgba(245,166,35,0.4)', background: live ? 'rgba(200,255,0,0.06)' : 'rgba(245,166,35,0.06)' }}
          title={live ? 'Instrumented in this build — the mapping below is what really runs' : 'Honest: nothing exists to monitor yet'}
        >
          <span aria-hidden className="size-1.5 rounded-full" style={{ background: accent }} />
          {domain.status}
        </span>
      </div>

      <ul className="mt-2.5 flex flex-wrap gap-1">
        {domain.checks.map((c) => (
          <li
            key={c}
            className="vvu-label rounded border border-white/[0.07] bg-white/[0.02] px-1.5 py-0.5 text-[7.5px] text-[rgba(244,244,245,0.55)]"
          >
            {c}
          </li>
        ))}
      </ul>

      <p className="mt-2.5 border-t border-white/[0.06] pt-2 text-[9px] leading-relaxed" style={{ fontFamily: MONO }}>
        <span className="vvu-label mr-1.5 text-[7px] font-bold uppercase tracking-[0.12em]" style={{ color: accent }}>
          {live ? 'THIS BUILD CHECKS' : 'WHY NOT'}
        </span>
        <span className="text-[rgba(244,244,245,0.62)]">{live ? domain.liveMapping : domain.notInstrumentedBecause}</span>
      </p>
    </motion.article>
  );
}

// ── price-card quick row (the ops reference; the full menu is #/commercial) ──

function PriceRowCompact({ row }: { row: PriceRow }) {
  return (
    <div
      className={`relative flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-white/[0.05] px-3 py-2 last:border-0 ${
        row.featured ? 'bg-[rgba(201,168,76,0.045)]' : ''
      }`}
    >
      {row.featured && (
        <span aria-hidden className="absolute inset-y-0 left-0 w-[2px]" style={{ background: GOLD, opacity: 0.65 }} />
      )}
      <span className="vvu-label w-[46px] shrink-0 text-[9px] text-[rgba(244,244,245,0.4)]" style={{ fontFamily: MONO }}>
        {row.id}
      </span>
      <span
        className="min-w-[150px] flex-1 text-[11.5px] font-medium leading-snug"
        style={{ fontFamily: SANS, color: row.featured ? '#F4F4F5' : 'rgba(244,244,245,0.8)' }}
      >
        {row.offering}
        {row.tier && (
          <span
            className="vvu-label ml-2 inline-block translate-y-[-1px] rounded border border-white/[0.1] bg-white/[0.02] px-1 py-px align-baseline text-[7px] font-bold text-[rgba(244,244,245,0.5)]"
            title="Task 44 sales-ledger tier cross-reference"
          >
            {row.tier}
          </span>
        )}
      </span>
      <span className="vvu-label text-[10px] font-bold text-[#C9A84C]">{row.entryPrice}</span>
      <span className="vvu-label text-[8.5px] text-[rgba(244,244,245,0.4)]">{row.delivery}</span>
    </div>
  );
}

// ── workspace ────────────────────────────────────────────────────────────────

export function OpsWorkspace() {
  const totals = useMemo(() => opsTotals(), []);
  const sendWormLog = useSendWormLog();
  const reduceMotion = useReducedMotion();

  const scrollRef = useRef<HTMLDivElement>(null);

  const [activeSection, setActiveSection] = useState<string>(NAV_SECTIONS[0].key);

  // Live sweep run state — component state only, nothing persisted.
  const [sweepResult, setSweepResult] = useState<SweepResult | null>(null);
  const [sweepError, setSweepError] = useState<string | null>(null);
  const [sweepLoading, setSweepLoading] = useState(false);

  // One VIEW_OPEN WORM log per mount (route toggles are logged by
  // WorkspaceToggle / CommandPalette — this records the ARRIVAL).
  const loggedRef = useRef(false);
  useEffect(() => {
    if (!loggedRef.current) {
      loggedRef.current = true;
      sendWormLog(
        'VIEW_OPEN',
        'OPS',
        `the operations loop · sweep domains ${totals.sweepDomains} · price card ${totals.priceRows}`,
      );
    }
  }, [sendWormLog, totals.sweepDomains, totals.priceRows]);

  // Section counts for the nav — derived from the ledger, never hand-claimed.
  const sectionCounts: Record<string, number> = useMemo(
    () => ({
      role: ROLE_OPERATOR.length + ROLE_SYSTEM.length,
      sweep: totals.sweepDomains,
      run: totals.sweepDomains,
      formats: totals.exceptionFormats,
      authority: 1, // one hard rule — not a list to skim
      pricecard: totals.priceRows,
      pilots: totals.pilotPlays,
      compliance: totals.complianceDocs,
    }),
    [totals],
  );

  // Scroll-spy: the topmost section header intersecting the upper band wins.
  // Sections here are static, so one observer per mount holds.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (!best || entry.boundingClientRect.top < best.boundingClientRect.top) {
            best = entry;
          }
        }
        if (best) setActiveSection(best.target.id);
      },
      { root, rootMargin: '-12% 0px -72% 0px', threshold: 0 },
    );
    for (const s of NAV_SECTIONS) {
      const el = root.querySelector(`#${s.key}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const scrollToSection = useCallback(
    (key: string) => {
      const root = scrollRef.current;
      const el = root?.querySelector<HTMLElement>(`#${key}`);
      if (root && el) {
        root.scrollTo({ top: el.offsetTop - 8, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    },
    [reduceMotion],
  );

  // RUN SWEEP NOW — the backend WORM-receipts every run; this button logs
  // nothing itself (the receipt IS the log).
  const runSweep = useCallback(async () => {
    if (sweepLoading) return;
    setSweepLoading(true);
    setSweepError(null);
    try {
      const res = await fetch('/api/ops/sweep', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SweepResult;
      setSweepResult(data);
    } catch {
      setSweepResult(null);
      setSweepError('the operations route did not respond');
    } finally {
      setSweepLoading(false);
    }
  }, [sweepLoading]);

  // COPY EXCEPTION BLOCK — what a phone would receive, ready for any channel.
  const copyExceptionBlock = useCallback(() => {
    if (!sweepResult) return;
    const text = sweepResult.notification;
    const onDone = () => {
      sendWormLog('EXCEPTION_BLOCK_COPIED', 'OPS', `${sweepResult.verdict} · ran ${sweepResult.ranAt}`);
      toast.success('EXCEPTION BLOCK COPIED', {
        id: 'ops-copy-exception',
        description: 'exception-only notification text — ready for any channel',
      });
    };
    const onFail = () => {
      toast.error('CLIPBOARD BLOCKED', {
        id: 'ops-copy-exception',
        description: 'browser denied write access — select the block text manually',
      });
    };
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard
        .writeText(text)
        .then(onDone)
        .catch(() => (legacyCopyText(text) ? onDone() : onFail()));
    } else if (legacyCopyText(text)) {
      onDone();
    } else {
      onFail();
    }
  }, [sweepResult, sendWormLog]);

  const heroDomains = useCountUp(totals.sweepDomains);
  const heroLive = useCountUp(totals.sweepLive);
  const heroNotInstrumented = useCountUp(totals.sweepNotInstrumented);
  const heroPriceRows = useCountUp(totals.priceRows);

  const heroStats: { label: string; value: number; color: string; sub: string }[] = [
    { label: 'Sweep domains', value: heroDomains, color: '#F4F4F5', sub: 'one consolidated sweep — never dozens of jobs' },
    { label: 'Live', value: heroLive, color: LIME, sub: 'instrumented in this build' },
    { label: 'Not instrumented', value: heroNotInstrumented, color: READY, sub: 'honest — nothing exists to monitor yet' },
    { label: 'Price card rows', value: heroPriceRows, color: GOLD, sub: 'the commercial menu v2' },
  ];

  // Notification block: first line is the kind, the rest is the body.
  const notifLines = sweepResult ? sweepResult.notification.split('\n') : [];
  const notifKind = (notifLines[0] ?? '') as ExceptionFormat['kind'];
  const notifBody = notifLines.slice(1);

  return (
    <div
      role="region"
      aria-label="The operations loop — field sales to back office, sweep domains counted honestly"
      className="absolute inset-0 flex overflow-hidden"
      style={{
        background: 'radial-gradient(at 50% 20%, #0F0F18, #09090F 75%)',
        color: '#F4F4F5',
      }}
    >
      {/* ── left nav (desktop) ─────────────────────────────────────────────── */}
      <nav
        aria-label="Operations loop sections"
        className="hidden w-[228px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-white/[0.06] p-3 lg:flex"
      >
        <div className="vvu-label flex items-center gap-2 px-2 pb-1 text-[9px] uppercase tracking-[0.18em] text-[rgba(244,244,245,0.4)]">
          Sections
          <span className="ml-auto rounded border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.06)] px-1.5 py-0.5 text-[8px] font-bold text-[#C9A84C]">
            {NAV_SECTIONS.length}
          </span>
        </div>
        {NAV_SECTIONS.map((s) => {
          const active = activeSection === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => scrollToSection(s.key)}
              aria-current={active ? 'location' : undefined}
              title={s.title}
              className={`vvu-label relative flex min-h-[36px] items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                active
                  ? 'border-white/[0.12] bg-white/[0.05] text-[#F4F4F5]'
                  : 'border-transparent text-[rgba(244,244,245,0.7)] hover:bg-white/[0.03] hover:text-[#F4F4F5]'
              }`}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-y-1.5 left-0 w-[2px] rounded-full"
                  style={{ background: GOLD, boxShadow: '0 0 6px rgba(201,168,76,0.5)' }}
                />
              )}
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded border text-[8.5px] font-bold"
                style={
                  active
                    ? { borderColor: 'rgba(201,168,76,0.31)', background: 'rgba(201,168,76,0.07)', color: GOLD }
                    : { borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(244,244,245,0.4)' }
                }
              >
                {s.code}
              </span>
              <span className="min-w-0 flex-1 truncate">{s.title}</span>
              <span className="vvu-label text-[8px] text-[rgba(244,244,245,0.4)]">{sectionCounts[s.key]}</span>
            </button>
          );
        })}
        <div className="vvu-label mt-auto border-t border-white/[0.06] pt-2 text-[8px] leading-relaxed text-[rgba(244,244,245,0.4)]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(200,255,0,0.3)] bg-[rgba(200,255,0,0.07)] px-2 py-0.5 font-semibold uppercase tracking-[0.1em] text-[#c8ff00]">
            <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-[#c8ff00]" />
            Day 1 · Field Ops
          </span>
          <p className="mt-2 px-1">
            {totals.sweepDomains} domains · {totals.sweepLive} live · {totals.sweepNotInstrumented} not instrumented.
            Counts derived from the ledger.
          </p>
        </div>
      </nav>

      {/* ── right column ──────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* breadcrumb + honest state chip */}
        <div
          className="flex flex-none flex-wrap items-center gap-2 border-b border-white/[0.06] px-3 py-2 sm:px-5"
          style={{ background: 'rgba(255,255,255,0.015)' }}
        >
          <div className="vvu-label flex min-w-0 flex-1 items-center gap-1.5 text-[8px] uppercase tracking-[0.14em] text-[rgba(244,244,245,0.4)]">
            <span className="text-[#C9A84C]">OPS</span>
            <span aria-hidden className="opacity-30">▸</span>
            <span>THE OPERATIONS LOOP</span>
            <span aria-hidden className="opacity-30">▸</span>
            <span className="truncate font-medium text-[rgba(244,244,245,0.85)]">
              {NAV_SECTIONS.find((s) => s.key === activeSection)?.title ?? '—'}
            </span>
          </div>
          <span
            className="vvu-label inline-flex items-center gap-1.5 rounded border border-[rgba(245,166,35,0.35)] bg-[rgba(245,166,35,0.07)] px-2 py-1 text-[7.5px] font-bold text-[#F5A623]"
            title="Customer, sales and commercial have nothing to monitor yet — the sweep says so instead of reporting fake greens."
          >
            <span aria-hidden className="size-1.5 rounded-full bg-[#F5A623]" />
            {totals.sweepNotInstrumented} DOMAINS NOT INSTRUMENTED
          </span>
        </div>

        {/* mobile section chips */}
        <div
          className="no-scrollbar flex flex-none items-stretch gap-1 overflow-x-auto border-b border-white/[0.06] px-3 py-1.5 lg:hidden"
          role="navigation"
          aria-label="Operations loop sections (compact)"
        >
          {NAV_SECTIONS.map((s) => {
            const active = activeSection === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => scrollToSection(s.key)}
                aria-current={active ? 'location' : undefined}
                className={`vvu-label flex min-h-[34px] shrink-0 items-center gap-1.5 rounded border px-2 text-[8px] font-semibold transition-colors ${
                  active
                    ? 'border-[rgba(201,168,76,0.5)] bg-[rgba(201,168,76,0.1)] text-[#C9A84C]'
                    : 'border-white/[0.08] text-[rgba(244,244,245,0.55)]'
                }`}
              >
                <span className="font-bold">{s.code}</span>
                <span className="opacity-60">{sectionCounts[s.key]}</span>
              </button>
            );
          })}
        </div>

        {/* scroll body — pb-28 clears the sticky footer chrome */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1320px] px-4 pb-28 pt-4 sm:px-6">
            {/* ── hero ─────────────────────────────────────────────────── */}
            <motion.section
              aria-label="The operations loop hero"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="relative mb-6 overflow-hidden rounded-xl border border-white/[0.06] p-6 sm:p-8"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(201,168,76,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.05) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                  opacity: 0.5,
                }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background: 'radial-gradient(circle at 82% 15%, rgba(201,168,76,0.12), transparent 52%)',
                }}
              />
              <div className="relative flex flex-wrap items-start gap-6">
                <div className="min-w-[280px] flex-1">
                  <p className="vvu-label mb-2 text-[9px] uppercase tracking-[0.28em] text-[rgba(201,168,76,0.85)]">
                    Day 1 · 16 Sep 2026 · the field-operations directive
                  </p>
                  <h1
                    className="text-[26px] font-extrabold leading-[1.12] tracking-tight sm:text-[32px]"
                    style={{ fontFamily: SANS }}
                  >
                    THE OPERATIONS LOOP
                    <br />
                    <span className="text-[#C9A84C]">FIELD SALES → BACK OFFICE</span>
                  </h1>
                  <p className="vvu-label mt-3 max-w-[640px] text-[10.5px] leading-relaxed text-[rgba(244,244,245,0.7)]">
                    One consolidated sweep across {totals.sweepDomains} domains — {totals.sweepLive} live in this build,{' '}
                    {totals.sweepNotInstrumented} honestly not instrumented. Exception-only notifications. Every run
                    WORM-receipted. The commercial menu it defends: {totals.priceRows} rows.
                  </p>
                </div>
                <dl className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-4 lg:max-w-[560px]">
                  {heroStats.map((s) => (
                    <div
                      key={s.label}
                      className="relative overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.02] p-3"
                    >
                      <span
                        aria-hidden
                        className="absolute inset-x-0 top-0 h-[2px]"
                        style={{ background: s.color, opacity: 0.7 }}
                      />
                      <dt className="vvu-label text-[8px] uppercase tracking-[0.16em] text-[rgba(244,244,245,0.45)]">
                        {s.label}
                      </dt>
                      <dd className="mt-1 text-[26px] font-bold leading-none tabular-nums" style={{ color: s.color }}>
                        {s.value}
                      </dd>
                      <dd className="vvu-label mt-1 text-[7.5px] leading-snug text-[rgba(244,244,245,0.4)]">{s.sub}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <blockquote className="relative mt-5 border-l-2 pl-4" style={{ borderColor: GOLD }}>
                <p
                  className="text-[15px] font-bold leading-[1.3] tracking-tight text-[#C9A84C] sm:text-[18px]"
                  style={{ fontFamily: SANS }}
                >
                  &ldquo;{ROLE_PRINCIPLE}&rdquo;
                </p>
                <cite className="vvu-label mt-1.5 block text-[8px] not-italic text-[rgba(244,244,245,0.4)]">
                  The role principle — why the loop exists
                </cite>
              </blockquote>
            </motion.section>

            {/* ── RL · the role split ─────────────────────────────────── */}
            <Section id="role" label="The role split — you sell, the system runs the office">
              <SectionHead
                code="RL"
                title="THE ROLE SPLIT"
                sub={`you sell. the system runs the office. · ${ROLE_OPERATOR.length} + ${ROLE_SYSTEM.length} duties`}
              />
              <Panel>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-[rgba(201,168,76,0.25)] bg-[rgba(201,168,76,0.04)] p-3.5">
                    <SubHead color="#C9A84C">The operator — field sales ({ROLE_OPERATOR.length})</SubHead>
                    <ol className="space-y-1.5">
                      {ROLE_OPERATOR.map((duty, i) => (
                        <li key={duty} className="flex items-center gap-2.5">
                          <span
                            className="vvu-label flex size-6 shrink-0 items-center justify-center rounded border border-[rgba(201,168,76,0.35)] bg-[rgba(201,168,76,0.07)] text-[8.5px] font-bold text-[#C9A84C]"
                          >
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span className="text-[11.5px] font-medium text-[rgba(244,244,245,0.85)]" style={{ fontFamily: SANS }}>
                            {duty}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="rounded-lg border border-[rgba(200,255,0,0.25)] bg-[rgba(200,255,0,0.03)] p-3.5">
                    <SubHead color="#c8ff00">The system — back office ({ROLE_SYSTEM.length})</SubHead>
                    <ol className="space-y-1.5">
                      {ROLE_SYSTEM.map((duty, i) => (
                        <li key={duty} className="flex items-center gap-2.5">
                          <span
                            className="vvu-label flex size-6 shrink-0 items-center justify-center rounded border border-[rgba(200,255,0,0.3)] bg-[rgba(200,255,0,0.06)] text-[8.5px] font-bold text-[#c8ff00]"
                          >
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span className="text-[11.5px] font-medium text-[rgba(244,244,245,0.85)]" style={{ fontFamily: SANS }}>
                            {duty}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                <div className="mt-4 border-t border-white/[0.06] pt-3.5">
                  <SubHead>The loop, end to end</SubHead>
                  <LoopFlow />
                  <p className="vvu-label mt-3 text-[8px] leading-relaxed text-[rgba(244,244,245,0.4)]">
                    The loop closes at MAIN — the operator stays in the field; the office work happens inside the loop.
                  </p>
                </div>
              </Panel>
            </Section>

            {/* ── SW · OPS_SWEEP_30M spec ─────────────────────────────── */}
            <Section id="sweep" label="OPS_SWEEP_30M — the eight sweep domains">
              <SectionHead code="SW" title="OPS_SWEEP_30M" sub={`${SWEEP_CADENCE} · ${totals.sweepDomains} domains`} />
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                {SWEEP_DOMAINS.map((domain, i) => (
                  <DomainCard key={domain.code} domain={domain} index={i} />
                ))}
              </div>
              <div className="mt-3">
                <HonestNote label="SCHEDULING CONSTRAINT — NO PRETEND AUTOMATION">{SCHEDULING_CONSTRAINT}</HonestNote>
              </div>
            </Section>

            {/* ── RN · run the sweep ───────────────────────────────────── */}
            <Section id="run" label="Run the sweep — manual today, WORM-receipted every run">
              <SectionHead code="RN" title="RUN THE SWEEP" sub="manual until cron/MCP infrastructure exists" />
              <Panel className="bg-black/40">
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => void runSweep()}
                    disabled={sweepLoading}
                    aria-label="Run the consolidated operations sweep now — eight domains, exception-only verdict, WORM-receipted"
                    className="vvu-label flex min-h-[48px] items-center gap-2.5 rounded border border-black bg-[#c8ff00] px-6 text-[11px] font-bold text-black shadow-[3px_3px_0px_0px_rgba(200,255,0,0.25)] transition-all hover:shadow-[1px_1px_0px_0px_rgba(200,255,0,0.25)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(200,255,0,0.7)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sweepLoading ? (
                      <>
                        <Loader2 aria-hidden className="size-4 animate-spin" />
                        SWEEP RUNNING…
                      </>
                    ) : (
                      <>
                        <Play aria-hidden className="size-4" />
                        RUN SWEEP NOW
                      </>
                    )}
                  </button>
                  <p className="vvu-label min-w-[200px] flex-1 text-[8.5px] leading-relaxed text-[rgba(244,244,245,0.5)]">
                    One consolidated sweep across all {totals.sweepDomains} domains. Manual cadence today — the 30-minute
                    cadence arrives when the operator&rsquo;s cron/MCP infrastructure exists.
                  </p>
                </div>

                {/* fetch failure — honest red, with retry */}
                {sweepError && (
                  <div className="mt-4 rounded-lg border border-[rgba(255,77,95,0.45)] bg-[rgba(255,77,95,0.06)] p-4">
                    <p className="flex items-start gap-2 text-[12px] font-semibold text-[#FF4D5F]" style={{ fontFamily: SANS }}>
                      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                      SWEEP UNREACHABLE — the operations route did not respond.
                    </p>
                    <p className="vvu-label mt-1.5 pl-6 text-[8.5px] leading-relaxed text-[rgba(244,244,245,0.55)]">
                      Nothing is simulated here: if the route is down, this view says so. Retry, or check the rail health
                      in WATCHDOG.
                    </p>
                    <button
                      type="button"
                      onClick={() => void runSweep()}
                      disabled={sweepLoading}
                      aria-label="Retry the operations sweep"
                      className="vvu-label mt-3 ml-6 flex min-h-[44px] items-center gap-2 rounded border border-[rgba(255,77,95,0.45)] bg-[rgba(255,77,95,0.08)] px-4 text-[9px] font-semibold text-[#FF4D5F] transition-colors hover:bg-[rgba(255,77,95,0.15)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,77,95,0.6)]"
                    >
                      <RefreshCw aria-hidden className="size-3.5" />
                      RETRY
                    </button>
                  </div>
                )}

                {/* empty state — before the first run */}
                {!sweepError && !sweepResult && !sweepLoading && (
                  <p
                    className="mt-4 rounded-lg border border-dashed border-white/[0.12] p-4 text-[10px] leading-relaxed text-[rgba(244,244,245,0.45)]"
                    style={{ fontFamily: MONO }}
                  >
                    no sweep run in this session yet — the result renders here and stays in component state (nothing is
                    persisted). every run is WORM-receipted by the backend.
                  </p>
                )}

                {/* run result */}
                {sweepResult && (
                  <div className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
                    {/* verdict + meta */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/[0.06] pb-3">
                      {sweepResult.verdict === 'GREEN' ? (
                        <span
                          className="vvu-label inline-flex items-center gap-2 rounded border px-3 py-1.5 text-[10px] font-bold text-[#c8ff00]"
                          style={{ borderColor: 'rgba(200,255,0,0.5)', background: 'rgba(200,255,0,0.08)' }}
                        >
                          <span aria-hidden className="size-1.5 rounded-full bg-[#c8ff00]" />
                          VERDICT · GREEN
                        </span>
                      ) : (
                        <span
                          className="vvu-label inline-flex items-center gap-2 rounded border px-3 py-1.5 text-[10px] font-bold"
                          style={{ borderColor: 'rgba(255,77,95,0.5)', background: 'linear-gradient(90deg, rgba(245,166,35,0.1), rgba(255,77,95,0.1))' }}
                        >
                          <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-[#FF4D5F]" />
                          <span className="bg-gradient-to-r from-[#F5A623] to-[#FF4D5F] bg-clip-text text-transparent">
                            VERDICT · ACTION REQUIRED
                          </span>
                        </span>
                      )}
                      <span className="vvu-label text-[8.5px] text-[rgba(244,244,245,0.5)]" style={{ fontFamily: MONO }}>
                        <span className="text-[rgba(244,244,245,0.35)]">RAN </span>
                        {sweepResult.ranAt}
                      </span>
                      <span className="vvu-label text-[8.5px] text-[rgba(244,244,245,0.5)]" style={{ fontFamily: MONO }}>
                        <span className="text-[rgba(244,244,245,0.35)]">DURATION </span>
                        {sweepResult.durationMs} ms
                      </span>
                      <span className="vvu-label min-w-0 text-[8.5px] text-[rgba(244,244,245,0.5)]" style={{ fontFamily: MONO }}>
                        <span className="text-[rgba(244,244,245,0.35)]">WORM </span>
                        {sweepResult.wormReceiptId ? (
                          <span className="break-all text-[#3DFFB0]">{sweepResult.wormReceiptId}</span>
                        ) : (
                          <span className="text-[#F5A623]">receipt unavailable — noted by its absence</span>
                        )}
                      </span>
                    </div>
                    <p className="vvu-label mt-2 text-[8px] leading-relaxed text-[rgba(244,244,245,0.4)]">
                      Sweep run WORM-receipted — the sweep is evidence too. The sweep observes, classifies, and reports; it
                      never modifies canonical state.
                    </p>

                    {/* exception block — what a phone would receive */}
                    <div className="mt-3">
                      <SubHead color="#F5A623">Exception block — what your phone receives</SubHead>
                      <div
                        className="rounded-md border border-white/[0.07] bg-black/50 p-3"
                        style={{ fontFamily: MONO }}
                        aria-label="Exception-only notification block"
                      >
                        <p className="text-[11px] font-bold" style={{ color: KIND_COLOR[notifKind] ?? READY }}>
                          {notifKind}
                        </p>
                        {notifBody.map((line, i) => (
                          <p key={`${i}-${line}`} className="mt-1 text-[10.5px] leading-relaxed text-[rgba(244,244,245,0.82)]">
                            {line}
                          </p>
                        ))}
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
                        <p className="vvu-label min-w-0 flex-1 text-[7.5px] leading-relaxed text-[rgba(244,244,245,0.4)]">
                          Exceptions only — never &ldquo;everything is fine&rdquo; noise. No phone channel exists in this
                          build; this block is ready for any channel.
                        </p>
                        <button
                          type="button"
                          onClick={copyExceptionBlock}
                          aria-label="Copy the exception block to the clipboard"
                          className="vvu-label flex min-h-[44px] shrink-0 items-center gap-2 rounded border border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.08)] px-4 text-[9px] font-semibold text-[#C9A84C] transition-colors hover:bg-[rgba(201,168,76,0.16)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(201,168,76,0.6)]"
                        >
                          <ClipboardCopy aria-hidden className="size-3.5" />
                          COPY EXCEPTION BLOCK
                        </button>
                      </div>
                    </div>

                    {/* per-domain results — max-height, custom scrollbar */}
                    <div className="mt-3">
                      <SubHead>Domain results</SubHead>
                      <div
                        tabIndex={0}
                        aria-label={`Sweep results — ${sweepResult.domains.length} domains`}
                        className="max-h-[420px] space-y-0 overflow-y-auto pr-1"
                      >
                        {sweepResult.domains.map((d) => {
                          const chip = RUN_CHIP[d.status];
                          return (
                            <div key={d.n} className="border-b border-white/[0.05] py-2.5 last:border-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="vvu-label text-[8.5px] text-[rgba(244,244,245,0.35)]" style={{ fontFamily: MONO }}>
                                  {String(d.n).padStart(2, '0')}
                                </span>
                                <span className="text-[11px] font-semibold text-[#F4F4F5]" style={{ fontFamily: MONO }}>
                                  {d.code}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-[10px] text-[rgba(244,244,245,0.55)]" style={{ fontFamily: SANS }}>
                                  {d.name}
                                </span>
                                <span
                                  className="vvu-label shrink-0 rounded border px-1.5 py-0.5 text-[7px] font-bold"
                                  style={{ color: chip.color, borderColor: chip.border, background: chip.bg }}
                                >
                                  {d.status}
                                </span>
                                {d.status === 'EXCEPTION' && d.severity && (
                                  <span
                                    className="vvu-label shrink-0 rounded border border-[rgba(255,77,95,0.4)] bg-[rgba(255,77,95,0.07)] px-1.5 py-0.5 text-[7px] font-bold text-[#FF4D5F]"
                                    title="Exception severity — drives the notification kind"
                                  >
                                    {d.severity}
                                  </span>
                                )}
                              </div>
                              <ul className="mt-1 space-y-0.5">
                                {d.lines.map((line, li) => (
                                  <li
                                    key={`${li}-${line}`}
                                    className="flex items-start gap-2 text-[9.5px] leading-snug text-[rgba(244,244,245,0.65)]"
                                    style={{ fontFamily: MONO }}
                                  >
                                    <span aria-hidden className="shrink-0 text-[rgba(244,244,245,0.3)]">
                                      ▸
                                    </span>
                                    <span className="min-w-0 break-words">{line}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </Panel>
            </Section>

            {/* ── FX · exception formats ───────────────────────────────── */}
            <Section id="formats" label="Exception formats — what the phone receives, and only that">
              <SectionHead code="FX" title="EXCEPTION FORMATS" sub={`${totals.exceptionFormats} kinds · exceptions only`} />
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
                {EXCEPTION_FORMATS.map((f, i) => (
                  <motion.div
                    key={f.kind}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '0px 0px -40px 0px' }}
                    transition={{ duration: 0.28, delay: Math.min(i * 0.04, 0.25), ease: 'easeOut' }}
                    className="rounded-lg border border-white/[0.07] bg-black/40 p-3"
                    style={{ fontFamily: MONO }}
                    aria-label={`Exception format ${f.kind}`}
                  >
                    <p className="text-[10px] font-bold" style={{ color: KIND_COLOR[f.kind] }}>
                      &gt; {f.kind}
                    </p>
                    <p className="mt-1.5 text-[10.5px] leading-relaxed text-[rgba(244,244,245,0.78)]">{f.text}</p>
                  </motion.div>
                ))}
              </div>
              <p
                className="mt-3 border-l-2 border-[#C9A84C] pl-3 text-[12px] font-semibold text-[#C9A84C]"
                style={{ fontFamily: SANS }}
              >
                &ldquo;{NOTIFICATION_POLICY}&rdquo;
              </p>
            </Section>

            {/* ── AU · automation authority (the hard rule) ────────────── */}
            <Section id="authority" label="Automation authority — the hard rule">
              <SectionHead code="AU" title="AUTOMATION AUTHORITY" sub="the hard rule · do not skim" />
              <div className="relative overflow-hidden rounded-xl border-2 border-[rgba(201,168,76,0.55)] bg-[rgba(201,168,76,0.05)] p-5 sm:p-7">
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: 'radial-gradient(circle at 88% 0%, rgba(201,168,76,0.1), transparent 55%)',
                  }}
                />
                <span className="vvu-label relative text-[9px] font-bold uppercase tracking-[0.24em] text-[#C9A84C]">
                  The hard rule
                </span>
                <blockquote className="relative mt-3 border-l-2 pl-4" style={{ borderColor: GOLD }}>
                  <p
                    className="text-[18px] font-extrabold leading-[1.25] tracking-tight text-[#C9A84C] sm:text-[23px]"
                    style={{ fontFamily: SANS }}
                  >
                    &ldquo;{AUTOMATION_AUTHORITY}&rdquo;
                  </p>
                </blockquote>
                <p
                  className="relative mt-4 border-t border-[rgba(201,168,76,0.25)] pt-3.5 text-[12px] leading-relaxed text-[rgba(244,244,245,0.7)]"
                  style={{ fontFamily: SANS }}
                >
                  {AUTOMATION_TAIL}
                </p>
              </div>
            </Section>

            {/* ── PC · price card quick reference ───────────────────────── */}
            <Section id="pricecard" label="Price card — the commercial menu v2, quick reference">
              <SectionHead
                code="PC"
                title="PRICE CARD (V2) — QUICK REFERENCE"
                sub={`${totals.priceRows} offerings · every quote cites a row id`}
              />
              <div className="mb-3">
                <HonestNote label="CAVEAT">{PRICE_CARD_CAVEAT}</HonestNote>
              </div>
              <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.015]">
                {PRICE_CARD.map((row) => (
                  <PriceRowCompact key={row.id} row={row} />
                ))}
              </div>
              <p className="vvu-label mt-3 text-[8.5px] leading-relaxed text-[rgba(244,244,245,0.5)]">
                The full menu lives in{' '}
                <a
                  href="#/commercial"
                  className="font-semibold text-[#C9A84C] underline decoration-[rgba(201,168,76,0.4)] underline-offset-2 hover:decoration-[#C9A84C]"
                  aria-label="Open the commercial view — full price card, payment discipline, consent"
                >
                  #/commercial
                </a>{' '}
                — payment discipline, the transition notice, and the consent record spec. Every quote issued from Day 1
                forward cites the price card row id (PC-01…PC-{String(totals.priceRows).padStart(2, '0')}).
              </p>
            </Section>

            {/* ── PL · pilot plays ─────────────────────────────────────── */}
            <Section id="pilots" label="Pilot plays — the four B2B weekend plans, readiness unchecked">
              <SectionHead code="PL" title="PILOT PLAYS" sub={`${totals.pilotPlays} plays · plans, not completed items`} />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {PILOT_PLAYS.map((play, i) => (
                  <motion.article
                    key={play.id}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '0px 0px -40px 0px' }}
                    transition={{ duration: 0.28, delay: Math.min(i * 0.05, 0.25), ease: 'easeOut' }}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
                    aria-label={`Pilot play — ${play.name} — planned, not started`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-[13px] font-semibold leading-tight text-[#F4F4F5]" style={{ fontFamily: SANS }}>
                        {play.name}
                      </h3>
                      <span
                        className="vvu-label shrink-0 rounded border border-[rgba(245,166,35,0.35)] bg-[rgba(245,166,35,0.06)] px-1.5 py-0.5 text-[7px] font-bold text-[#F5A623]"
                        title="A plan on paper — nothing here is done"
                      >
                        PLAN — NOT STARTED
                      </span>
                    </div>
                    <p className="mt-2 text-[10.5px] font-bold text-[#C9A84C]" style={{ fontFamily: MONO }}>
                      {play.priceRow}
                    </p>
                    <div className="mt-3 border-t border-white/[0.06] pt-2.5">
                      <SubHead color="#F5A623">Readiness — planned, not done ({play.readiness.length})</SubHead>
                      <ul className="space-y-1.5">
                        {play.readiness.map((item) => (
                          <li key={item} className="flex items-start gap-2.5">
                            <span
                              aria-hidden
                              className="mt-0.5 size-4 shrink-0 rounded-[3px] border border-[rgba(245,166,35,0.5)]"
                              title="Unchecked — planned, not done"
                            />
                            <span
                              className="text-[10.5px] leading-snug text-[rgba(244,244,245,0.75)]"
                              style={{ fontFamily: SANS }}
                            >
                              {item}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.article>
                ))}
              </div>
              <p className="vvu-label mt-3 border-t border-white/[0.06] pt-3 text-[8.5px] leading-relaxed text-[rgba(244,244,245,0.5)]">
                <span className="font-semibold text-[#C9A84C]">B2B TARGET WINDOW —</span> {B2B_TARGET_WINDOW}
              </p>
            </Section>

            {/* ── CM · compliance pack ─────────────────────────────────── */}
            <Section id="compliance" label="Compliance pack — four DRAFT documents, review required">
              <SectionHead code="CM" title="COMPLIANCE PACK" sub={`${totals.complianceDocs} documents · all DRAFT`} />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {COMPLIANCE_PACK.map((doc, i) => (
                  <motion.article
                    key={doc.id}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '0px 0px -40px 0px' }}
                    transition={{ duration: 0.28, delay: Math.min(i * 0.05, 0.2), ease: 'easeOut' }}
                    className="flex flex-col rounded-xl border border-[rgba(245,166,35,0.22)] bg-white/[0.02] p-4"
                    aria-label={`Compliance document — ${doc.name} — draft, review required`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-[13px] font-semibold leading-tight text-[#F4F4F5]" style={{ fontFamily: SANS }}>
                        {doc.name}
                      </h3>
                      <span
                        className="vvu-label inline-flex shrink-0 animate-pulse items-center gap-1.5 rounded border border-[rgba(245,166,35,0.45)] bg-[rgba(245,166,35,0.1)] px-2 py-1 text-[7.5px] font-bold text-[#F5A623]"
                        title="Not legal advice until the lawyer signs off (manifest L7 — regulatory file review pending)"
                      >
                        <span aria-hidden className="size-1.5 rounded-full bg-[#F5A623]" />
                        DRAFT — REVIEW REQUIRED
                      </span>
                    </div>
                    <p className="mt-2 break-all text-[9px] text-[rgba(244,244,245,0.45)]" style={{ fontFamily: MONO }}>
                      {doc.path}
                    </p>
                    <p
                      className="mt-2 flex-1 text-[10.5px] leading-relaxed text-[rgba(244,244,245,0.7)]"
                      style={{ fontFamily: SANS }}
                    >
                      {doc.purpose}
                    </p>
                  </motion.article>
                ))}
              </div>
              <p className="vvu-label mt-3 border-t border-white/[0.06] pt-3 text-[8.5px] leading-relaxed text-[rgba(244,244,245,0.5)]">
                <span className="font-semibold text-[#F5A623]">NOTE —</span> {COMPLIANCE_PACK_NOTE}
              </p>
            </Section>

            {/* ── derived-count close (honesty footer of the view) ─────── */}
            <p className="vvu-label border-t border-white/[0.06] pb-2 pt-4 text-[8px] leading-relaxed text-[rgba(244,244,245,0.4)]">
              Counts on this page are computed from the ops ledger at render time ({totals.sweepDomains} sweep domains ·{' '}
              {totals.sweepLive} live + {totals.sweepNotInstrumented} not instrumented · {totals.priceRows} price-card
              rows · {totals.pilotPlays} pilot plays · {totals.complianceDocs} compliance drafts). The sweep is manual
              today; no pretend automation exists.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OpsWorkspace;
