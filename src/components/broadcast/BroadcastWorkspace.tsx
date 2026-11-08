'use client';

// src/components/broadcast/BroadcastWorkspace.tsx — ROUND 31/32 · thirteenth projection
// #/broadcast — BROADCAST & CREATOR LAYER (corrected canonical).
//
//   · The review verdict — the operator's three corrections, applied
//   · INVARIANT ZERO — the broadcast system is never part of the
//     evidence-producing system (pinned BEFORE episode_brief_template.md
//     and host_rotation_spec.md are written)
//   · The anchor pipeline — event → local chain → signed checkpoint →
//     external anchor → public verification (display ≠ anchor)
//   · Composed-feed mock with a PINNED evidence footer + a live
//     circuit-breaker demo (EVIDENCE INVALID / BROADCAST HALTED)
//   · Adapter capability contracts — per-platform, honest verification
//     status, no universal claims
//   · NINE canonical documents (tablet spec, subscription ledger, gift
//     program, influencer licence, challenge format, live routing arch,
//     creator agreement + ROUND 32: episode brief + host rotation, written
//     on the operator's word behind the pinned invariant) — expandable,
//     COPY = markdown
//   · Written-this-round ledger — the two artifacts' provenance record
//
// Every COPY and the circuit-breaker trip are WORM-logged (clipboard →
// toast → ledger → audit table) like every other projection.

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Anchor,
  BadgeCheck,
  ClipboardList,
  Copy,
  FileCheck2,
  FileSignature,
  FileText,
  Gift,
  Gavel,
  Mic,
  Network,
  Radio,
  Receipt,
  ShieldCheck,
  Tablet,
  Tv,
  Zap,
} from 'lucide-react';
import { Chip, SectionHeader, SectionReveal } from '@/components/analytics/shared';
import { useSendWormLog } from '@/hooks/use-vvu-socket';
import { cn } from '@/lib/utils';
import {
  ADAPTER_CONTRACTS,
  ADAPTER_RULE,
  ANCHOR_NOTE,
  ANCHOR_PIPELINE,
  BROADCAST_DOCS,
  BROADCAST_PROVENANCE,
  CORRECTIONS,
  INVARIANT_MARKDOWN,
  INVARIANT_ZERO,
  WRITTEN_NOTE,
  WRITTEN_THIS_ROUND,
  docMarkdown,
  type BroadcastDoc,
  type DocBlock,
} from '@/lib/broadcast-data';

// ─── Section nav ─────────────────────────────────────────────────────────────

type SectionId =
  | 'verdict'
  | 'tablet'
  | 'ledger'
  | 'gift'
  | 'licence'
  | 'format'
  | 'routing'
  | 'agreement'
  | 'brief'
  | 'rotation'
  | 'written';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'verdict', label: 'REVIEW VERDICT' },
  { id: 'tablet', label: 'PRO TABLET' },
  { id: 'ledger', label: 'SUB LEDGER' },
  { id: 'gift', label: 'B2B GIFTS' },
  { id: 'licence', label: 'LICENCE' },
  { id: 'format', label: 'FORMAT' },
  { id: 'routing', label: 'ROUTING + ADAPTERS' },
  { id: 'agreement', label: 'AGREEMENT' },
  { id: 'brief', label: 'EPISODE BRIEF' },
  { id: 'rotation', label: 'HOST ROTATION' },
  { id: 'written', label: 'WRITTEN · THIS ROUND' },
];

const DOC_ICON: Record<string, typeof Tablet> = {
  tablet: Tablet,
  ledger: Receipt,
  gift: Gift,
  licence: BadgeCheck,
  format: Tv,
  routing: Network,
  agreement: FileSignature,
  episode_brief: ClipboardList,
  host_rotation: Mic,
};

// ─── Doc block renderer (canonical text → SCADA panels) ─────────────────────

const CALLOUT_TONE: Record<'crimson' | 'lime' | 'amber' | 'teal', string> = {
  crimson: 'border-[rgba(229,72,77,0.45)] bg-[rgba(229,72,77,0.05)]',
  lime: 'border-[rgba(200,255,0,0.4)] bg-[rgba(200,255,0,0.045)]',
  amber: 'border-[rgba(224,160,48,0.45)] bg-[rgba(224,160,48,0.05)]',
  teal: 'border-[rgba(46,168,160,0.45)] bg-[rgba(46,168,160,0.05)]',
};

const CALLOUT_TEXT: Record<'crimson' | 'lime' | 'amber' | 'teal', string> = {
  crimson: 'text-[#e5484d]',
  lime: 'text-[#c8ff00]',
  amber: 'text-[#e0a030]',
  teal: 'text-[#2ea8a0]',
};

function DocBlockView({ block }: { block: DocBlock }) {
  switch (block.kind) {
    case 'h':
      return (
        <h4 className="vvu-label text-[9px] text-[#c8ff00] tracking-[0.15em] pt-1.5 flex items-center gap-2">
          <span aria-hidden className="inline-block w-1.5 h-1.5 bg-[#c8ff00]/70 rounded-[1px] shrink-0" />
          {block.text}
        </h4>
      );
    case 'p':
      return <p className="vvu-label text-[8.5px] leading-relaxed text-[#c9d4bd]">{block.text}</p>;
    case 'list':
      return (
        <ul className="space-y-1.5 min-w-0">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="vvu-label text-[8px] leading-relaxed text-[#c9d4bd] border-l-2 border-[rgba(143,179,90,0.35)] pl-2.5 break-words"
            >
              {item}
            </li>
          ))}
        </ul>
      );
    case 'pre':
      return (
        <div className="overflow-x-auto rounded-sm border border-[rgba(107,138,64,0.25)] bg-[#040604]">
          <pre className="font-mono text-[7px] sm:text-[7.5px] leading-[1.5] text-[#a9c49a] p-2.5 whitespace-pre">
            {block.text}
          </pre>
        </div>
      );
    case 'callout':
      return (
        <div className={cn('rounded-sm border p-2.5 sm:p-3', CALLOUT_TONE[block.tone])}>
          <p className={cn('vvu-label text-[8px] leading-relaxed', CALLOUT_TEXT[block.tone])}>{block.text}</p>
        </div>
      );
    case 'table':
      return (
        <div className="space-y-1.5 min-w-0">
          <div className="overflow-x-auto rounded-sm border border-[rgba(107,138,64,0.25)]">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr>
                  {block.head.map((h, i) => (
                    <th
                      key={i}
                      className="vvu-label text-[7px] text-[#8fb35a] bg-[rgba(107,138,64,0.08)] border-b border-[rgba(107,138,64,0.35)] px-2 py-1.5 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri} className="even:bg-[rgba(107,138,64,0.03)]">
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="vvu-label text-[7.5px] leading-relaxed text-[#c9d4bd] border-b border-[rgba(107,138,64,0.12)] px-2 py-1.5 align-top"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption && <p className="vvu-label text-[7px] leading-relaxed text-[#7a8a6e]">{block.caption}</p>}
        </div>
      );
    default:
      return null;
  }
}

// ─── The workspace ──────────────────────────────────────────────────────────

export function BroadcastWorkspace() {
  const sendWormLog = useSendWormLog();
  const [activeSection, setActiveSection] = useState<SectionId>('verdict');
  const [openDoc, setOpenDoc] = useState<string | null>('tablet');
  const [halted, setHalted] = useState(false);

  // View entry is WORM-logged like every projection (append-only, no silent views).
  useEffect(() => {
    sendWormLog('VIEW_MODE', 'BROADCAST', '#/broadcast opened — 7 corrected canonical docs · INVARIANT ZERO pinned');
  }, [sendWormLog]);

  const copyText = useCallback(
    (text: string, label: string, kind: string) => {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          toast.success(`COPIED — ${label}`, { description: 'WORM COPY event appended to ledger' });
          sendWormLog('BROADCAST_COPY', 'OPERATOR', `${kind}: ${label} → clipboard`);
          fetch('/api/vvu/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              actor: 'OPERATOR',
              action: 'BROADCAST_COPY',
              fromState: 'BROADCAST_VIEW',
              toState: 'BROADCAST_VIEW',
              symbol: 'COPY',
              reason: `${kind}: ${label}`,
            }),
          }).catch(() => {
            /* offline — audit is best-effort */
          });
        })
        .catch(() => {
          toast.error('CLIPBOARD BLOCKED', { description: 'Browser denied clipboard access' });
        });
    },
    [sendWormLog]
  );

  const tripBreaker = useCallback(() => {
    const next = !halted;
    setHalted(next);
    sendWormLog(
      next ? 'BROADCAST_BREAKER_TRIP' : 'BROADCAST_BREAKER_RESET',
      'BROADCAST',
      next
        ? 'evidence circuit breaker TRIPPED — broadcast displays EVIDENCE INVALID / BROADCAST HALTED (invariant demo)'
        : 'evidence circuit breaker RESET — chain verify PASS, broadcast resumes (invariant demo)'
    );
    if (next) {
      toast.error('EVIDENCE INVALID — BROADCAST HALTED', {
        description: 'The show stops rather than lie. The underlying run continues and remains verifiable.',
      });
    } else {
      toast.success('CHAIN VERIFY PASS — BROADCAST RESUMED', {
        description: 'WORM BROADCAST_BREAKER event appended to ledger',
      });
    }
  }, [halted, sendWormLog]);

  const jump = (id: SectionId) => {
    setActiveSection(id);
    document.getElementById(`broadcast-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="absolute inset-0 overflow-y-auto vvu-scroll">
      <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-5 pb-28">
        {/* ── header ─────────────────────────────────────────────────────── */}
        <SectionHeader
          num="13"
          title="BROADCAST & CREATOR LAYER"
          kicker="ROUND 31 · THIRTEENTH PROJECTION · CANONICAL AFTER CORRECTIONS"
          right={
            <div className="flex flex-wrap gap-1.5">
              <Chip tone="crimson">INVARIANT ZERO · PINNED</Chip>
              <Chip tone="sage">7 DOCS · CORRECTED CANONICAL</Chip>
            </div>
          }
        />

        {/* section nav — touch-friendly chips */}
        <nav
          aria-label="Broadcast sections"
          className="flex flex-wrap gap-1.5 sticky top-0 z-20 -mx-1 px-1 py-2 bg-[#060806]/95 backdrop-blur-sm border-b border-[rgba(107,138,64,0.2)]"
        >
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => jump(s.id)}
              aria-current={activeSection === s.id ? 'true' : undefined}
              className={cn(
                'vvu-label text-[8px] sm:text-[9px] px-2.5 py-2 min-h-[36px] rounded-sm border transition-all select-none',
                activeSection === s.id
                  ? 'border-[rgba(200,255,0,0.55)] text-[#c8ff00] bg-[rgba(200,255,0,0.06)]'
                  : 'border-[rgba(107,138,64,0.3)] text-[#7a8a6e] hover:border-[rgba(200,255,0,0.35)] hover:text-[#c8ff00]'
              )}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* ── provenance + review verdict ────────────────────────────────── */}
        <section id="broadcast-verdict" aria-label="Review verdict" className="space-y-3 scroll-mt-20">
          <SectionReveal>
            <div className="p-4 sm:p-5 vvu-panel-solid">
              <div className="flex items-start gap-3">
                <Gavel className="w-4 h-4 mt-0.5 shrink-0 text-[#f3e38a]" aria-hidden />
                <div className="space-y-2 min-w-0">
                  <div className="vvu-label text-[10px] text-[#f3e38a] tracking-[0.2em]">
                    {BROADCAST_PROVENANCE.headline}
                  </div>
                  <p className="vvu-label text-[9px] sm:text-[10px] leading-relaxed text-[#c9d4bd]">
                    {BROADCAST_PROVENANCE.body}
                  </p>
                </div>
              </div>
            </div>
          </SectionReveal>

          {/* the three corrections — WAS → NOW → WHY */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {CORRECTIONS.map((c) => (
              <SectionReveal key={c.id}>
                <article className="vvu-panel-solid p-4 space-y-2.5 min-w-0 flex flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <span className="vvu-label text-[9px] text-[#c8ff00] tracking-[0.18em]">
                      CORRECTION {String(c.id).padStart(2, '0')}
                    </span>
                    <Chip tone="crimson">APPLIED</Chip>
                  </div>
                  <div className="vvu-label text-[7px] text-[#8fb35a] tracking-wide border-b border-[rgba(107,138,64,0.2)] pb-1.5 break-words">
                    {c.target}
                  </div>
                  <div className="rounded-sm border border-[rgba(229,72,77,0.35)] bg-[rgba(229,72,77,0.04)] p-2.5">
                    <div className="vvu-label text-[7px] text-[#e5484d] mb-1 tracking-[0.15em]">WAS</div>
                    <p className="vvu-label text-[7.5px] leading-relaxed text-[#c9d4bd]">{c.was}</p>
                  </div>
                  <div className="rounded-sm border border-[rgba(200,255,0,0.35)] bg-[rgba(200,255,0,0.04)] p-2.5">
                    <div className="vvu-label text-[7px] text-[#c8ff00] mb-1 tracking-[0.15em]">NOW</div>
                    <p className="vvu-label text-[7.5px] leading-relaxed text-[#c9d4bd]">{c.now}</p>
                  </div>
                  <p className="vvu-label text-[7px] leading-relaxed text-[#7a8a6e] mt-auto">
                    <span className="text-[#f3e38a]">WHY — </span>
                    {c.why}
                  </p>
                </article>
              </SectionReveal>
            ))}
          </div>
        </section>

        {/* ── INVARIANT ZERO — pinned ────────────────────────────────────── */}
        <section aria-label="Invariant Zero" className="space-y-3">
          <SectionReveal featured>
            <div className="p-4 sm:p-5 border-2 border-[rgba(200,255,0,0.5)] bg-[rgba(200,255,0,0.03)] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-[#c8ff00]" aria-hidden />
                  <span className="vvu-label text-[10px] sm:text-[11px] text-[#c8ff00] tracking-[0.2em]">
                    {INVARIANT_ZERO.code} — PINNED
                  </span>
                </div>
                <button
                  onClick={() => copyText(INVARIANT_MARKDOWN, 'INVARIANT ZERO', 'INVARIANT')}
                  className="vvu-label text-[8px] min-h-[36px] px-3 rounded-sm border border-[rgba(200,255,0,0.45)] text-[#c8ff00] hover:bg-[rgba(200,255,0,0.07)] transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Copy className="w-3 h-3" aria-hidden /> COPY INVARIANT
                </button>
              </div>

              <p className="vvu-label text-[10px] sm:text-[12px] leading-relaxed text-[#f3e38a] font-bold">
                {INVARIANT_ZERO.title}
              </p>
              <p className="vvu-label text-[9px] leading-relaxed text-[#c8ff00]">{INVARIANT_ZERO.rule}</p>

              {/* the chain — evidence-producing side vs show side */}
              <div className="flex flex-wrap items-stretch gap-1.5">
                {INVARIANT_ZERO.chain.map((node, i) => (
                  <div key={node.name} className="flex items-center gap-1.5 min-w-0">
                    <div
                      className={cn(
                        'vvu-label rounded-sm border px-2.5 py-2 text-[7px] sm:text-[7.5px] leading-tight min-w-0',
                        i <= 2
                          ? 'border-[rgba(46,168,160,0.5)] text-[#2ea8a0] bg-[rgba(46,168,160,0.05)]'
                          : 'border-[rgba(143,179,90,0.4)] text-[#8fb35a] bg-[rgba(143,179,90,0.05)]'
                      )}
                    >
                      <div className="tracking-[0.08em]">{node.name}</div>
                      <div className="text-[6.5px] text-[#7a8a6e] mt-0.5">{node.role}</div>
                    </div>
                    {i < INVARIANT_ZERO.chain.length - 1 && (
                      <span aria-hidden className="vvu-label text-[#7a8a6e] shrink-0">
                        {i === 2 ? '═▶' : '─▶'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p className="vvu-label text-[7px] text-[#7a8a6e] leading-relaxed">
                TEAL = EVIDENCE-PRODUCING SIDE · SAGE = SHOW SIDE. The runtime produces the proof; the broadcast
                only shows it.
              </p>

              {/* failure independence — both directions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {INVARIANT_ZERO.failures.map((f) => (
                  <div
                    key={f.fail}
                    className="rounded-sm border border-[rgba(107,138,64,0.35)] bg-[#0b0f0a] p-3 space-y-1.5 min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="vvu-label text-[8px] text-[#e5484d] tracking-wide">{f.fail}</span>
                      <span className="vvu-label text-[6.5px] text-[#7a8a6e] border border-[rgba(107,138,64,0.3)] rounded-sm px-1.5 py-0.5 whitespace-nowrap">
                        {f.direction}
                      </span>
                    </div>
                    <p className="vvu-label text-[7.5px] leading-relaxed text-[#c9d4bd]">{f.response}</p>
                  </div>
                ))}
              </div>

              <p className="vvu-label text-[7.5px] leading-relaxed text-[#f3e38a] border-l-2 border-[rgba(243,227,138,0.45)] pl-2.5">
                PRECEDENCE — {INVARIANT_ZERO.precedence}
              </p>
            </div>
          </SectionReveal>
        </section>

        {/* ── anchor pipeline ───────────────────────────────────────────── */}
        <section aria-label="Anchor pipeline" className="space-y-3">
          <SectionReveal>
            <div className="vvu-panel-solid p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center gap-2">
                <Anchor className="w-3.5 h-3.5 text-[#2ea8a0]" aria-hidden />
                <span className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em]">
                  ANCHOR PIPELINE — THE STRONGER VERIFICATION PATH
                </span>
              </div>
              <ol className="flex flex-wrap items-stretch gap-1.5">
                {ANCHOR_PIPELINE.map((s, i) => (
                  <li key={s.stage} className="flex items-center gap-1.5 min-w-0">
                    <div className="vvu-label rounded-sm border border-[rgba(46,168,160,0.4)] bg-[rgba(46,168,160,0.04)] px-2.5 py-2 min-w-0 max-w-[11rem]">
                      <div className="text-[7.5px] text-[#2ea8a0] tabular-nums">
                        {String(i + 1).padStart(2, '0')} · {s.stage}
                      </div>
                      <div className="text-[6.5px] text-[#7a8a6e] leading-snug mt-0.5">{s.note}</div>
                    </div>
                    {i < ANCHOR_PIPELINE.length - 1 && (
                      <span aria-hidden className="text-[#2ea8a0] text-[9px] shrink-0">
                        ▸
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              <div className="rounded-sm border border-[rgba(46,168,160,0.45)] bg-[rgba(46,168,160,0.05)] p-2.5">
                <p className="vvu-label text-[8px] leading-relaxed text-[#2ea8a0]">
                  <span className="text-[#f3e38a]">DISPLAY ≠ ANCHOR — </span>
                  {ANCHOR_NOTE}
                </p>
              </div>
            </div>
          </SectionReveal>
        </section>

        {/* ── composed feed mock + pinned evidence footer + breaker ──────── */}
        <section aria-label="Composed feed mock" className="space-y-3">
          <SectionReveal featured>
            <div className="p-4 sm:p-5 vvu-panel-solid space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Radio className="w-3.5 h-3.5 text-[#c8ff00]" aria-hidden />
                  <span className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em]">
                    COMPOSED FEED — ONE SHOW · MANY DESTINATIONS
                  </span>
                </div>
                <Chip tone="dim">MOCK · INVARIANT DEMO</Chip>
              </div>

              {/* the frame */}
              <div className="rounded-sm border border-[rgba(107,138,64,0.4)] bg-[#040604] overflow-hidden">
                {/* frame top bar */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[rgba(107,138,64,0.3)] bg-[rgba(107,138,64,0.06)]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="vvu-label text-[7px] px-1.5 py-0.5 rounded-sm border border-[rgba(229,72,77,0.5)] text-[#e5484d] shrink-0">
                      ● LIVE
                    </span>
                    <span className="vvu-label text-[7px] text-[#c9d4bd] truncate">
                      VVU CHALLENGE — EPISODE 01 · &quot;KEEP THE COLD CHAIN ALIVE WITH NO GRID&quot;
                    </span>
                  </div>
                  <span className="vvu-label text-[6.5px] text-[#7a8a6e] shrink-0 hidden sm:inline">
                    TREND: LOAD-SHEDDING STAGE 6
                  </span>
                </div>

                {/* tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 p-1">
                  <div className="aspect-video rounded-sm border border-[rgba(107,138,64,0.3)] bg-[#090d09] flex items-center justify-center p-2 min-w-0">
                    <span className="vvu-label text-[7px] text-[#7a8a6e] text-center leading-relaxed">
                      CREATOR 1
                      <br />
                      CAM
                    </span>
                  </div>
                  <div className="aspect-video rounded-sm border border-[rgba(46,168,160,0.4)] bg-[#060a09] flex flex-col items-center justify-center p-2 min-w-0">
                    <span className="vvu-label text-[7px] text-[#2ea8a0] text-center leading-relaxed">
                      SYSTEM TELEMETRY
                      <br />
                      LIVE OVERLAY
                    </span>
                    <span className="vvu-label text-[6px] text-[#7a8a6e] mt-1 tabular-nums">FSM · FLOW · °C</span>
                  </div>
                  <div className="aspect-video rounded-sm border border-[rgba(107,138,64,0.3)] bg-[#090d09] flex items-center justify-center p-2 min-w-0 col-span-2 sm:col-span-1">
                    <span className="vvu-label text-[7px] text-[#7a8a6e] text-center leading-relaxed">
                      CREATOR 2
                      <br />
                      CAM
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-3 rounded-sm border border-[rgba(243,227,138,0.3)] bg-[#0a0a06] px-2.5 py-2 overflow-hidden">
                    <div className="vvu-label text-[6.5px] text-[#f3e38a] whitespace-nowrap overflow-hidden text-ellipsis">
                      LIVE JOURNAL TICKER (CHAINED) · 14:02:11 GATE2:APPROVE · 14:02:14 MCP:TOOL_CALL · 14:03:02
                      SIS:HOLD · 14:04:47 LLM:LOCAL_ANSWER · 14:05:19 VOTE:CAST · 14:06:03
                      JOURNAL:CHECKPOINT_SIGNED · 14:06:05 ANCHOR:PUBLISHED ·…
                    </div>
                  </div>
                </div>

                {/* PINNED evidence footer strip — bottom edge of the frame */}
                <div
                  className={cn(
                    'px-3 py-2 border-t-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1',
                    halted
                      ? 'border-[rgba(229,72,77,0.7)] bg-[rgba(229,72,77,0.08)]'
                      : 'border-[rgba(200,255,0,0.5)] bg-[rgba(200,255,0,0.045)]'
                  )}
                  role="status"
                  aria-live="polite"
                >
                  {halted ? (
                    <span className="vvu-label text-[8px] sm:text-[9px] text-[#e5484d] font-bold tracking-[0.18em] vvu-blink">
                      ⚠ EVIDENCE INVALID — BROADCAST HALTED
                    </span>
                  ) : (
                    <span className="vvu-label text-[7px] sm:text-[8px] text-[#c8ff00] tabular-nums truncate min-w-0">
                      WORM HEAD: 8F43B2A1…C9A1 · TIER: T1 · EVENTS: 14,203
                    </span>
                  )}
                  <span
                    className={cn(
                      'vvu-label text-[6.5px] tabular-nums shrink-0',
                      halted ? 'text-[#e5484d]' : 'text-[#2ea8a0]'
                    )}
                  >
                    {halted ? 'CHAIN VERIFY: FAIL · ABORT LOGGED' : 'ANCHOR: ✓ CHECKPOINT 14:06:05 · SIGNED'}
                  </span>
                </div>
              </div>

              {/* breaker controls */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={tripBreaker}
                  aria-pressed={halted}
                  className={cn(
                    'vvu-label text-[8.5px] min-h-[44px] px-4 rounded-sm border transition-all flex items-center gap-2 select-none',
                    halted
                      ? 'border-[rgba(46,168,160,0.5)] text-[#2ea8a0] hover:bg-[rgba(46,168,160,0.08)]'
                      : 'border-[rgba(229,72,77,0.55)] text-[#e5484d] hover:bg-[rgba(229,72,77,0.08)] active:scale-[0.97]'
                  )}
                >
                  <Zap className="w-3.5 h-3.5" aria-hidden />
                  {halted ? 'RESET BREAKER — RESUME BROADCAST' : 'TRIP EVIDENCE CIRCUIT BREAKER'}
                </button>
                <p className="vvu-label text-[7px] leading-relaxed text-[#7a8a6e] max-w-md">
                  INVARIANT DEMO — tripping the breaker shows what the broadcast does when chain verify fails: it
                  stops and says so on air. The underlying run continues and remains verifiable. Every trip/reset
                  is WORM-logged.
                </p>
              </div>
            </div>
          </SectionReveal>
        </section>

        {/* ── adapter capability contracts ───────────────────────────────── */}
        <section id="broadcast-routing" aria-label="Live routing and adapter contracts" className="space-y-3 scroll-mt-20">
          <div className="vvu-panel-solid">
            <div className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Network className="w-3.5 h-3.5 text-[#e0a030]" aria-hidden />
                  <span className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em]">
                    ADAPTER CAPABILITY CONTRACTS
                  </span>
                </div>
                <Chip tone="amber">REPLACES THE UNIVERSAL SCOPES TABLE</Chip>
              </div>
              <div className="overflow-x-auto rounded-sm border border-[rgba(107,138,64,0.25)]">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr>
                      {['Platform', 'Claimed capability', 'Verification status', 'Ship condition'].map((h) => (
                        <th
                          key={h}
                          className="vvu-label text-[7px] text-[#8fb35a] bg-[rgba(107,138,64,0.08)] border-b border-[rgba(107,138,64,0.35)] px-2 py-1.5 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ADAPTER_CONTRACTS.map((a) => (
                      <tr key={a.platform} className="even:bg-[rgba(107,138,64,0.03)]">
                        <td className="vvu-label text-[8px] text-[#f3e38a] border-b border-[rgba(107,138,64,0.12)] px-2 py-2 align-top whitespace-nowrap">
                          {a.platform}
                        </td>
                        <td className="vvu-label text-[7.5px] leading-relaxed text-[#c9d4bd] border-b border-[rgba(107,138,64,0.12)] px-2 py-2 align-top">
                          {a.capability}
                        </td>
                        <td className="vvu-label text-[7px] border-b border-[rgba(107,138,64,0.12)] px-2 py-2 align-top">
                          <span
                            className={cn(
                              'inline-block px-1.5 py-0.5 rounded-sm border whitespace-nowrap',
                              a.status === 'AVAILABILITY UNCONFIRMED'
                                ? 'border-[rgba(229,72,77,0.5)] text-[#e5484d]'
                                : 'border-[rgba(224,160,48,0.5)] text-[#e0a030]'
                            )}
                          >
                            {a.status}
                          </span>
                        </td>
                        <td className="vvu-label text-[7px] leading-relaxed text-[#7a8a6e] border-b border-[rgba(107,138,64,0.12)] px-2 py-2 align-top">
                          {a.shipCondition}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-sm border border-[rgba(224,160,48,0.45)] bg-[rgba(224,160,48,0.05)] p-2.5">
                <p className="vvu-label text-[8px] leading-relaxed text-[#e0a030]">{ADAPTER_RULE}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── the seven documents ────────────────────────────────────────── */}
        {BROADCAST_DOCS.map((doc) => (
          <DocCard
            key={doc.id}
            doc={doc}
            open={openDoc === doc.id}
            onToggle={() => setOpenDoc(openDoc === doc.id ? null : doc.id)}
            onCopy={() => copyText(docMarkdown(doc), doc.title, 'BROADCAST_DOC')}
          />
        ))}

        {/* ── written this round (the operator's word, received) ──────── */}
        <section id="broadcast-written" aria-label="Written this round" className="space-y-3 scroll-mt-20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileCheck2 className="w-3.5 h-3.5 text-[#c8ff00]" aria-hidden />
              <span className="vvu-label text-[10px] sm:text-[11px] text-[#f3e38a] tracking-[0.2em]">
                WRITTEN THIS ROUND — ON THE OPERATOR&apos;S WORD
              </span>
            </div>
            <Chip tone="lime">BEHIND PINNED INVARIANT ZERO</Chip>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {WRITTEN_THIS_ROUND.map((w) => (
              <div key={w.name} className="vvu-panel-solid p-4 space-y-2 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="vvu-label text-[9px] text-[#f3e38a] break-all">{w.name}</span>
                  <span className="vvu-label text-[6.5px] px-1.5 py-0.5 rounded-sm border border-[rgba(200,255,0,0.4)] text-[#c8ff00] whitespace-nowrap">
                    {w.status}
                  </span>
                </div>
                <p className="vvu-label text-[7px] text-[#8fb35a] break-all">{w.path}</p>
                <p className="vvu-label text-[8px] leading-relaxed text-[#c9d4bd]">{w.note}</p>
              </div>
            ))}
          </div>
          <p className="vvu-label text-[7.5px] leading-relaxed text-[#7a8a6e]">{WRITTEN_NOTE}</p>
        </section>

        {/* ── footer note ────────────────────────────────────────────────── */}
        <div className="flex items-start gap-2.5">
          <BadgeCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#8fb35a]" aria-hidden />
          <p className="vvu-label text-[7.5px] leading-relaxed text-[#7a8a6e]">
            Every COPY and every circuit-breaker trip on this projection is WORM-logged (clipboard → toast → ledger
            → audit table). The nine documents above are canonical — the seven AFTER the operator&apos;s three
            corrections, the episode brief and host rotation written this round on the operator&apos;s word behind the
            pinned invariant; adapter capability rows carry their own verification status and no live-platform
            capability is claimed until its contract is verified with a logged receipt.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Document card ───────────────────────────────────────────────────────────

function DocCard({
  doc,
  open,
  onToggle,
  onCopy,
}: {
  doc: BroadcastDoc;
  open: boolean;
  onToggle: () => void;
  onCopy: () => void;
}) {
  const Icon = DOC_ICON[doc.id] ?? FileText;
  return (
    <article id={`broadcast-${doc.id}`} className="vvu-panel-solid min-w-0 scroll-mt-20">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-3 p-3.5 text-left hover:bg-[rgba(107,138,64,0.06)] transition-colors"
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <Icon className="w-4 h-4 mt-0.5 shrink-0 text-[#8fb35a]" aria-hidden />
          <div className="min-w-0 space-y-1">
            <div className="vvu-label text-[7px] text-[#7a8a6e] tracking-wide break-all">{doc.path}</div>
            <div className="vvu-label text-[9.5px] text-[#f3e38a] leading-snug">{doc.title}</div>
            <div className="vvu-label text-[7.5px] text-[#7a8a6e] leading-relaxed">{doc.subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          {doc.corrected && (
            <span className="vvu-label text-[6.5px] px-1.5 py-0.5 rounded-sm border border-[rgba(229,72,77,0.45)] text-[#e5484d] whitespace-nowrap hidden sm:inline">
              CORRECTED
            </span>
          )}
          <span className="vvu-label text-[6.5px] px-1.5 py-0.5 rounded-sm border border-[rgba(143,179,90,0.4)] text-[#8fb35a] whitespace-nowrap hidden sm:inline">
            {doc.status}
          </span>
          <span className={cn('vvu-label text-[8px] text-[#7a8a6e] shrink-0', open && 'text-[#c8ff00]')}>
            {open ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t border-[rgba(107,138,64,0.2)] pt-3">
          {doc.correctionNote && (
            <p className="vvu-label text-[7px] leading-relaxed text-[#e0a030] border-l-2 border-[rgba(224,160,48,0.5)] pl-2.5">
              {doc.correctionNote}
            </p>
          )}
          {doc.blocks.map((block, i) => (
            <DocBlockView key={i} block={block} />
          ))}
          <div className="flex items-center justify-between gap-2 flex-wrap border-t border-[rgba(107,138,64,0.15)] pt-3">
            <span className="vvu-label text-[7px] text-[#7a8a6e]">
              CANONICAL TEXT · COPY RETURNS TRUE CASE (NOT THE UPPER-CASED RENDER)
            </span>
            <button
              onClick={onCopy}
              className="vvu-label text-[8px] min-h-[36px] px-3 rounded-sm border border-[rgba(107,138,64,0.35)] text-[#c9d4bd] hover:border-[rgba(200,255,0,0.5)] hover:text-[#c8ff00] transition-all flex items-center gap-1.5"
            >
              <Copy className="w-3 h-3" aria-hidden /> COPY MARKDOWN
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
