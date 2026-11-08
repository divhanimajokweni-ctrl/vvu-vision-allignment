'use client';

// src/components/trust/TrustWorkspace.tsx — Task 37-5b. The twelfth
// projection (#/trust): VVU-TRUST · Community Compute Pool. Clean-slate
// build of the operator's four pasted source artifacts as one view:
//   ONBOARDING — the 8-bit micro-city game (TrustOnboarding);
//   PITCH      — PITCH_ONEPAGER.md verbatim;
//   TERMS      — stokvel_terms_v0.md verbatim (8 sections);
//   MANIFEST   — the three-valued tree + rule + live WORM receipts + the
//               smoke sweep (run_all → one consolidated receipt);
//   POOL       — the stokvel pool simulator (TrustPoolSim).
// Chassis pattern (Task 36): absolute inset-0 overflow-y-auto — footer
// stays pinned, content scrolls inside main.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, CircuitBoard, FileCheck2, FlaskConical, ScrollText, ShieldCheck, Users } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrustOnboarding } from '@/components/trust/TrustOnboarding';
import { TrustPoolSim } from '@/components/trust/TrustPoolSim';
import { useSendWormLog } from '@/hooks/use-vvu-socket';
import {
  TRUST_PITCH,
  TRUST_STATUS_LABELS,
  TRUST_STATUS_RULE,
  TRUST_TERMS,
  TRUST_MANIFEST_TREE,
  type TrustStatus,
} from '@/lib/trust-data';
import type { LedgerEntry } from '@/types/vvu';

interface TrustApi {
  ok: boolean;
  receipts: LedgerEntry[];
  chain: { count: number; chainValid: boolean; lastHash: string | null };
  programComplete: boolean;
  programLevels: number;
  smoke: LedgerEntry | null;
}

const STATUS_STYLE: Record<TrustStatus, string> = {
  SOURCED: 'border-[rgba(255,179,0,0.45)] bg-[rgba(255,179,0,0.08)] text-[#ffb300]',
  "SPEC'd": 'border-[#2a3a46] bg-[#0b141c] text-[#8fa3b0]',
  VERIFIED: 'border-[rgba(200,255,0,0.5)] bg-[rgba(200,255,0,0.08)] text-[#c8ff00]',
};

function StatusBadge({ status }: { status: TrustStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 font-mono text-[8.5px] font-bold ${STATUS_STYLE[status]}`}
    >
      {status}
    </span>
  );
}

export function TrustWorkspace() {
  const sendWormLog = useSendWormLog();
  const [api, setApi] = useState<TrustApi | null>(null);
  const [runLog, setRunLog] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [filter, setFilter] = useState<'ALL' | TrustStatus | 'INTEGRATED'>('ALL');

  const refresh = useCallback(() => {
    fetch('/api/vvu/trust', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: TrustApi | null) => d && setApi(d))
      .catch(() => {
        /* offline — receipts panel shows placeholder */
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const copyDoc = useCallback(
    (doc: string, text: string) => {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          toast.success(`COPIED — ${doc}`, {
            description: 'TRUST_DOC_COPIED receipt appended to the WORM ledger',
          });
          sendWormLog('TRUST_DOC_COPIED', 'TRUST', doc);
          fetch('/api/vvu/trust', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'DOC_COPIED', payload: { doc } }),
          })
            .then(() => refresh())
            .catch(() => undefined);
        })
        .catch(() => {
          toast.error('COPY FAILED', { description: 'Clipboard unavailable in this context' });
        });
    },
    [refresh, sendWormLog]
  );

  const pitchMarkdown = useMemo(() => {
    const s: string[] = [`# ${TRUST_PITCH.product}`, '', `**${TRUST_PITCH.tagline}**`, ''];
    for (const sec of TRUST_PITCH.sections) {
      s.push(`## ${sec.heading}`, '');
      for (const p of sec.paras) s.push(p, '');
      for (const it of sec.items) {
        s.push(it.text ? `**${it.lead}** ${it.text}` : `**${it.lead}**`, '');
      }
    }
    s.push('---', `*${TRUST_PITCH.footnote}*`);
    return s.join('\n');
  }, []);

  const termsMarkdown = useMemo(
    () =>
      ['# Community Compute Pool — Terms', '', ...TRUST_TERMS.flatMap((t) => [`## ${t.n}. ${t.heading}`, '', ...t.paras.map((p) => p + '')])].join(
        '\n'
      ),
    []
  );

  const runSweep = useCallback(() => {
    setSweeping(true);
    fetch('/api/vvu/trust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'SMOKE_SWEEP' }),
    })
      .then((r) => r.json())
      .then((d: { success: boolean; runLog?: string; allOk?: boolean; error?: string }) => {
        if (!d.success) throw new Error(d.error ?? 'sweep failed');
        setRunLog(d.runLog ?? null);
        toast.success(d.allOk ? 'SMOKE SWEEP PASSED — exit 0' : 'SMOKE SWEEP FAILED — exit 1', {
          description: 'One consolidated TRUST_SMOKE_SWEEP receipt in the WORM ledger',
        });
        refresh();
      })
      .catch(() => {
        toast.error('SWEEP FAILED', { description: 'Could not reach /api/vvu/trust' });
      })
      .finally(() => setSweeping(false));
  }, [refresh]);

  // manifest groups (folder → entries), with the dynamic VERIFIED promotion
  // for surfaces/index.html when a PROGRAM_COMPLETE receipt exists.
  const groups = useMemo(() => {
    const promoted = api?.programComplete === true;
    const entries = TRUST_MANIFEST_TREE.map((e) => {
      if (e.promotesOn === 'PROGRAM_COMPLETE' && promoted) {
        const receipt = api?.receipts.find((x) => x.event === 'TRUST_PROGRAM_COMPLETE');
        return {
          ...e,
          status: 'VERIFIED' as TrustStatus,
          note: `${e.note ?? ''} · Receipt: WORM #${receipt?.seq ?? '?'} (${(receipt?.hash ?? '').slice(0, 12)}…)`.trim(),
        };
      }
      return e;
    });
    const map = new Map<string, typeof entries>();
    for (const e of entries) {
      const folder = e.path.includes('/') ? e.path.split('/')[0] : '(root)';
      const list = map.get(folder) ?? [];
      list.push(e);
      map.set(folder, list);
    }
    return [...map.entries()];
  }, [api]);

  const visibleGroups = useMemo(
    () =>
      groups
        .map(([folder, list]) => [
          folder,
          list.filter((e) =>
            filter === 'ALL'
              ? true
              : filter === 'INTEGRATED'
                ? e.integratedHere === true
                : e.status === filter
          ),
        ] as [string, typeof TRUST_MANIFEST_TREE])
        .filter(([, list]) => list.length > 0),
    [groups, filter]
  );

  const chainChip = api
    ? `${api.chain.chainValid ? 'VALID' : 'BROKEN'} · ${api.chain.count} events · tip ${(api.chain.lastHash ?? '').slice(0, 10)}`
    : 'loading…';

  return (
    <div className="absolute inset-0 overflow-y-auto">
      {/* pb-28: clears the fixed lime route toggle (bottom-right, ~4.75rem)
          so bottom-row controls are never covered on any viewport. */}
      <div className="mx-auto w-full max-w-6xl space-y-3 px-3 pb-28 pt-4 sm:px-4">
        {/* header */}
        <div className="rounded-md border border-[#2a3a46] bg-[#08131c] p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#c8ff00]" />
                <h1 className="vvu-label text-[13px] font-bold tracking-[0.2em] text-[#e8f0d8]">
                  VVU-TRUST · COMMUNITY COMPUTE POOL
                </h1>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-[#8fa3b0]">
                A machine a community owns together · Understand → Build → Test → Verify · four
                operator-supplied source artifacts, statuses never collapsed.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-sm border border-[rgba(200,255,0,0.3)] bg-[rgba(200,255,0,0.05)] px-2 py-1 font-mono text-[8.5px] text-[#c8ff00]">
                <ShieldCheck className="h-3 w-3" /> WORM {chainChip}
              </span>
              <span className="inline-flex items-center gap-1 rounded-sm border border-[#2a3a46] bg-[#0b141c] px-2 py-1 font-mono text-[8.5px] text-[#8fa3b0]">
                PROGRAM {api?.programComplete ? 'COMPLETE' : `${api?.programLevels ?? 0}/12 RECEIPTS`}
              </span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="onboarding" className="w-full">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-md border border-[#2a3a46] bg-[#050c13] p-1">
            <TabsTrigger value="onboarding" className="gap-1.5 px-3 py-2 text-[9px] data-[state=active]:bg-[#12301f]">
              <CircuitBoard className="h-3.5 w-3.5" /> ONBOARDING
            </TabsTrigger>
            <TabsTrigger value="pitch" className="gap-1.5 px-3 py-2 text-[9px] data-[state=active]:bg-[#12301f]">
              <BookOpen className="h-3.5 w-3.5" /> PITCH
            </TabsTrigger>
            <TabsTrigger value="terms" className="gap-1.5 px-3 py-2 text-[9px] data-[state=active]:bg-[#12301f]">
              <ScrollText className="h-3.5 w-3.5" /> TERMS
            </TabsTrigger>
            <TabsTrigger value="manifest" className="gap-1.5 px-3 py-2 text-[9px] data-[state=active]:bg-[#12301f]">
              <FlaskConical className="h-3.5 w-3.5" /> MANIFEST
            </TabsTrigger>
            <TabsTrigger value="pool" className="gap-1.5 px-3 py-2 text-[9px] data-[state=active]:bg-[#12301f]">
              <Users className="h-3.5 w-3.5" /> POOL SIM
            </TabsTrigger>
          </TabsList>

          {/* ── ONBOARDING ── */}
          <TabsContent value="onboarding" className="mt-3">
            <TrustOnboarding onReceipt={refresh} />
          </TabsContent>

          {/* ── PITCH ── */}
          <TabsContent value="pitch" className="mt-3">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#2a3a46] bg-[#08131c] p-3">
                <span className="font-mono text-[9px] text-[#7f95a5]">
                  PITCH_ONEPAGER.md · rendered verbatim · SPEC&apos;d
                </span>
                <Button
                  type="button"
                  onClick={() => copyDoc('PITCH_ONEPAGER.md', pitchMarkdown)}
                  className="h-10 border border-[#c8ff00] bg-[#c8ff00] px-4 text-[10px] font-bold text-black hover:bg-[#d9ff4d] active:scale-[0.98]"
                >
                  COPY FULL PITCH
                </Button>
              </div>
              <article className="rounded-md border border-[#2a3a46] bg-[#07111b] p-4 sm:p-6">
                <header className="border-b border-[#1c2a22] pb-4">
                  <h2 className="text-2xl font-bold text-white">{TRUST_PITCH.product}</h2>
                  <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-[#c8ff00]">
                    {TRUST_PITCH.tagline}
                  </p>
                </header>
                {TRUST_PITCH.sections.map((sec) => (
                  <section key={sec.id} className="mt-5" aria-labelledby={`pitch-${sec.id}`}>
                    <h3 id={`pitch-${sec.id}`} className="vvu-label text-[10px] tracking-[0.18em] text-[#8fa3b0]">
                      {sec.heading}
                    </h3>
                    <div className="mt-2 space-y-2.5">
                      {sec.paras.map((p, i) => (
                        <p key={i} className="max-w-3xl text-[12px] leading-relaxed text-[#c4d2dc]">
                          {p}
                        </p>
                      ))}
                      {sec.items.map((it, i) => (
                        <p key={i} className="max-w-3xl text-[12px] leading-relaxed text-[#c4d2dc]">
                          <strong className="text-[#e8f0d8]">{it.lead}</strong>{' '}
                          <span>{it.text}</span>
                        </p>
                      ))}
                    </div>
                  </section>
                ))}
                <footer className="mt-6 border-t border-[#1c2a22] pt-4">
                  <p className="text-[10px] italic text-[#7f95a5]">{TRUST_PITCH.footnote}</p>
                </footer>
              </article>
            </div>
          </TabsContent>

          {/* ── TERMS ── */}
          <TabsContent value="terms" className="mt-3">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#2a3a46] bg-[#08131c] p-3">
                <span className="font-mono text-[9px] text-[#7f95a5]">
                  stokvel_terms_v0.md · 8 sections · rendered verbatim · SPEC&apos;d
                </span>
                <Button
                  type="button"
                  onClick={() => copyDoc('stokvel_terms_v0.md', termsMarkdown)}
                  className="h-10 border border-[#c8ff00] bg-[#c8ff00] px-4 text-[10px] font-bold text-black hover:bg-[#d9ff4d] active:scale-[0.98]"
                >
                  COPY TERMS
                </Button>
              </div>
              <Accordion type="multiple" defaultValue={['t-1']} className="rounded-md border border-[#2a3a46] bg-[#07111b] px-4">
                {TRUST_TERMS.map((t) => (
                  <AccordionItem key={t.n} value={`t-${t.n}`} className="border-[#1c2a22]">
                    <AccordionTrigger className="py-3 text-left hover:no-underline">
                      <span className="flex items-baseline gap-2.5">
                        <span className="font-mono text-[10px] text-[#c8ff00]">§{t.n}</span>
                        <span className="text-[12px] font-bold text-[#e8f0d8]">{t.heading}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      {t.paras.map((p, i) => (
                        <p key={i} className="max-w-3xl text-[11.5px] leading-relaxed text-[#c4d2dc]">
                          {p}
                        </p>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </TabsContent>

          {/* ── MANIFEST ── */}
          <TabsContent value="manifest" className="mt-3 space-y-3">
            {/* the rule */}
            <div className="rounded-md border border-[rgba(200,255,0,0.3)] bg-[rgba(200,255,0,0.04)] p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-[#c8ff00]" />
                <b className="vvu-label text-[10px] tracking-[0.18em] text-[#c8ff00]">THE RULE</b>
              </div>
              <p className="mt-2 text-[11px] italic leading-relaxed text-[#c4d2dc]">
                “{TRUST_STATUS_RULE}”
              </p>
              <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                {TRUST_STATUS_LABELS.map((l) => (
                  <div key={l.label} className="flex items-start gap-2 rounded-sm border border-[#2a3a46] bg-[#0b141c] p-2">
                    <StatusBadge status={l.label} />
                    <span className="text-[9.5px] leading-snug text-[#8fa3b0]">{l.meaning}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* smoke sweep */}
            <div className="rounded-md border border-[#2a3a46] bg-[#08131c] p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <b className="vvu-label text-[9px] tracking-[0.18em] text-[#8fa3b0]">
                    SMOKE SWEEP · run_all → one receipt
                  </b>
                  <p className="mt-1 text-[10px] text-[#7f95a5]">
                    Chains WORM-chain verification + first-party trust-file fingerprints and writes
                    a single consolidated run-log receipt.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={runSweep}
                  disabled={sweeping}
                  className="h-10 border border-[#c8ff00] bg-[#c8ff00] px-4 text-[10px] font-bold text-black hover:bg-[#d9ff4d] active:scale-[0.98]"
                >
                  {sweeping ? 'SWEEPING…' : 'RUN SMOKE SWEEP'}
                </Button>
              </div>
              {(runLog ?? api?.smoke?.details) && (
                <pre className="mt-3 max-h-52 overflow-auto rounded-sm border border-[#213040] bg-[#050c13] p-3 font-mono text-[9px] leading-relaxed text-[#9ab8a4] [scrollbar-width:thin]">
                  {runLog ?? `latest receipt · ${api?.smoke?.details}`}
                </pre>
              )}
            </div>

            {/* filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(['ALL', 'SOURCED', "SPEC'd", 'VERIFIED', 'INTEGRATED'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`min-h-[34px] rounded-sm border px-2.5 font-mono text-[9px] font-bold transition-all active:scale-[0.97] ${
                    filter === f
                      ? 'border-[#c8ff00] bg-[#c8ff0014] text-[#c8ff00]'
                      : 'border-[#2a3a46] bg-[#0b141c] text-[#8fa3b0] hover:text-[#c4d2dc]'
                  }`}
                >
                  {f}
                </button>
              ))}
              <span className="ml-1 font-mono text-[9px] text-[#5d7061]">
                {TRUST_MANIFEST_TREE.length} entries
              </span>
            </div>

            {/* tree */}
            <div className="space-y-2.5">
              {visibleGroups.map(([folder, list]) => (
                <div key={folder} className="rounded-md border border-[#2a3a46] bg-[#08131c]">
                  <div className="border-b border-[#1c2a22] px-3 py-2 font-mono text-[9.5px] font-bold text-[#7f95a5]">
                    {folder === '(root)' ? 'vvu-trust/ · root' : `vvu-trust/${folder}/`}
                  </div>
                  <ul className="divide-y divide-[#12202a]">
                    {list.map((e) => (
                      <li key={e.path} className="flex flex-wrap items-center gap-2 px-3 py-2 hover:bg-[#0b141c]">
                        <StatusBadge status={e.status} />
                        <span className="min-w-0 break-all font-mono text-[10.5px] text-[#c4d2dc]">
                          {e.path}
                        </span>
                        {e.integratedHere && (
                          <span className="shrink-0 rounded-sm border border-[rgba(0,229,255,0.4)] bg-[rgba(0,229,255,0.06)] px-1.5 py-0.5 font-mono text-[8px] font-bold text-[#00e5ff]">
                            INTEGRATED HERE
                          </span>
                        )}
                        {e.note && (
                          <span className="w-full text-[9px] leading-snug text-[#5d7061]">{e.note}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* receipts */}
            <div className="rounded-md border border-[#2a3a46] bg-[#08131c] p-3">
              <b className="vvu-label text-[9px] tracking-[0.18em] text-[#8fa3b0]">
                TRUST receipts · WORM chain
              </b>
              <div className="mt-2 max-h-72 space-y-1 overflow-y-auto [scrollbar-width:thin]">
                {api?.receipts.length ? (
                  api.receipts.slice(0, 20).map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-sm border border-[#152430] bg-[#050c13] px-2 py-1.5"
                    >
                      <span className="font-mono text-[9px] text-[#5d7061]">#{r.seq}</span>
                      <span
                        className={`font-mono text-[9px] font-bold ${
                          r.event === 'TRUST_PROGRAM_COMPLETE'
                            ? 'text-[#c8ff00]'
                            : r.event === 'TRUST_SMOKE_SWEEP'
                              ? 'text-[#00e5ff]'
                              : 'text-[#9aa88c]'
                        }`}
                      >
                        {r.event}
                      </span>
                      <span className="min-w-0 flex-1 break-all text-[9.5px] text-[#8fa3b0]">{r.details}</span>
                      <span className="font-mono text-[8.5px] text-[#5d7061]" title={r.hash}>
                        {r.hash.slice(0, 12)}…
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-[#5d7061]">
                    No TRUST receipts yet — complete an onboarding level or run the smoke sweep.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── POOL ── */}
          <TabsContent value="pool" className="mt-3">
            <TrustPoolSim onReceipt={refresh} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
