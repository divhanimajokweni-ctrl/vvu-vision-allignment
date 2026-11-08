'use client';

// src/components/icsh/WormLedger.tsx — 14:35 WORM LEDGER · the ledger IS the
// storage. The on-chain contract, the WORM chain (ICSH + estate-wide sources),
// the ledger.jsonl lines, the standalone auditor, and the export the auditor
// consumes. One line per cycle, markdown vault one node per cycle.

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { LedgerEntry } from '@/types/vvu';
import type { IcshCycleRow, IcshStatus, IcshVerifyResult } from '@/lib/icsh/types';
import { cn } from '@/lib/utils';
import { Chip, Empty, IcshButton, KV, Panel, ago, head8, pad } from './parts';
import { sfx } from './sound';

const PAGE = 120;

export function WormLedgerSurface() {
  const [source, setSource] = useState<'ICSH' | 'ALL'>('ICSH');
  // older-page overlay: the ledger is APPEND-ONLY, so rows fetched with a
  // `before` cursor never go stale and never overlap the sliding first page
  // (its oldest seq only moves forward). No reset effect needed.
  const [olderCycles, setOlderCycles] = useState<IcshCycleRow[]>([]);
  const [audit, setAudit] = useState<IcshVerifyResult | null>(null);

  const statusQ = useQuery({
    queryKey: ['icsh', 'status'],
    queryFn: async (): Promise<IcshStatus> => {
      const r = await fetch('/api/icsh/status');
      if (!r.ok) throw new Error(`status ${r.status}`);
      return (await r.json()) as IcshStatus;
    },
    refetchInterval: 10000,
  });

  const wormQ = useQuery({
    queryKey: ['icsh', 'worm', source],
    queryFn: async (): Promise<LedgerEntry[]> => {
      const r = await fetch(`/api/icsh/ledger?mode=worm&source=${source}&limit=140`);
      if (!r.ok) throw new Error(`worm ${r.status}`);
      const d = (await r.json()) as { entries: LedgerEntry[] };
      return d.entries;
    },
    refetchInterval: 12000,
  });

  const cyclesQ = useQuery({
    queryKey: ['icsh', 'cycles', 'page1', PAGE],
    queryFn: async (): Promise<IcshCycleRow[]> => {
      const r = await fetch(`/api/icsh/ledger?mode=cycles&limit=${PAGE}`);
      if (!r.ok) throw new Error(`cycles ${r.status}`);
      const d = (await r.json()) as { cycles: IcshCycleRow[] };
      return d.cycles;
    },
    refetchInterval: 12000,
  });

  const auditMut = useMutation({
    mutationFn: async (): Promise<IcshVerifyResult> => {
      const r = await fetch('/api/icsh/ledger/verify');
      return (await r.json()) as IcshVerifyResult;
    },
    onSuccess: (d) => {
      setAudit(d);
      if (d.ok) sfx.ok();
      else sfx.err();
    },
  });

  const loadOlder = async () => {
    const list = [...(cyclesQ.data ?? []), ...olderCycles];
    const oldest = list[list.length - 1];
    if (!oldest) return;
    sfx.click();
    const r = await fetch(`/api/icsh/ledger?mode=cycles&limit=${PAGE}&before=${oldest.seq}`);
    if (!r.ok) return;
    const d = (await r.json()) as { cycles: IcshCycleRow[] };
    setOlderCycles((prev) => [...prev, ...d.cycles]);
  };

  const st = statusQ.data ?? null;
  const cycles = [...(cyclesQ.data ?? []), ...olderCycles];
  const hasOlder = cycles.length > 0 && cycles[cycles.length - 1].seq > 1;

  return (
    <div className="space-y-4">
      {/* ── the contract, on chain ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="CONTRACT ON CHAIN · OUR CONTRACT"
          className="lg:col-span-2"
          right={<Chip label="VERSION" value={st?.contract?.version ?? '—'} tone="lime" />}
        >
          {st?.contract ? (
            <div className="space-y-1">
              <KV k="WORM SEQ" v={String(st.contract.seq)} tone="text-[#c8ff00]" />
              <KV k="CONTRACT HASH" v={<span className="break-all text-[9px]">{st.contract.hash}</span>} />
              <KV k="DEPLOYED" v={`${new Date(st.contract.deployedAt).toLocaleString('en-ZA')} · ${ago(st.contract.deployedAt)}`} />
              <KV k="DECLARATION" v="THE LEDGER IS THE STORAGE — APPEND-ONLY · SHA-256 CHAINED" tone="text-[#7dffa8]" />
              <KV k="MEMORY BOUND" v="32 BYTES PER NODE · STORAGE FOOTPRINT FLAT" tone="text-[#7dffa8]" />
              <KV k="JOIN" v="TOTP · RFC 6238 · LOCATE→SCAN→CONSENT→VERIFY→RECEIPT" />
            </div>
          ) : (
            <p className="py-4 text-center text-[9px] tracking-[0.2em] text-[#5f7f68]">LOADING CONTRACT…</p>
          )}
        </Panel>

        <Panel title="AUDITOR · TAKES ONLY THE LEDGER">
          <p className="mb-3 text-[8px] leading-relaxed tracking-[0.12em] text-[#5f7f68]">
            walks the WORM hash chain AND every cycle head, recomputing each preimage — the icsh_verify lineage.
          </p>
          <div className="flex flex-wrap gap-2">
            <IcshButton tone="lime" onClick={() => auditMut.mutate()} disabled={auditMut.isPending}>
              {auditMut.isPending ? 'WALKING CHAIN…' : 'RUN AUDIT'}
            </IcshButton>
            <IcshButton
              onClick={() => {
                sfx.click();
                window.open('/api/icsh/ledger/export', '_blank');
              }}
            >
              EXPORT ledger.jsonl
            </IcshButton>
          </div>
          {audit ? (
            <div
              className={cn(
                'mt-3 border px-3 py-2',
                audit.ok ? 'border-[#1d4d2c] bg-[#04100a]' : 'border-[#4d2018] bg-[#100604]'
              )}
            >
              <p className={cn('text-[9px] font-bold tracking-[0.1em]', audit.ok ? 'text-[#7dffa8]' : 'text-[#ff7a6e]')}>
                {audit.line}
              </p>
              <p className="mt-1 text-[8px] text-[#5f7f68]">checked {new Date(audit.checkedAt).toLocaleTimeString('en-ZA')}</p>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip label="WORM" value={st ? st.wormEntries.toLocaleString() : '—'} />
            <Chip label="ICSH ENTRIES" value={st ? st.icshWormEntries.toLocaleString() : '—'} tone="green" />
            <Chip label="CYCLE LINES" value={st ? st.cycles.toLocaleString() : '—'} tone="lime" />
          </div>
        </Panel>
      </div>

      {/* ── chain + lines ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="WORM CHAIN · APPEND-ONLY"
          bodyClass="p-0"
          right={
            <div className="flex gap-1">
              {(['ICSH', 'ALL'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSource(s);
                    sfx.tick();
                  }}
                  className={cn(
                    'border px-2 py-0.5 text-[8px] font-bold tracking-[0.2em]',
                    source === s ? 'border-[#4d5d12] text-[#c8ff00]' : 'border-[#1d2f22] text-[#5f7f68]'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          }
        >
          <div className="max-h-96 overflow-y-auto icsh-scroll">
            {(wormQ.data ?? []).map((e) => (
              <div key={e.seq} className="border-b border-[#0e1811] px-3 py-2 hover:bg-[#081009]">
                <div className="flex items-baseline gap-2">
                  <span className="text-[9px] tabular-nums text-[#3f5748]">{String(e.seq).padStart(5, '0')}</span>
                  <span
                    className={cn(
                      'text-[9px] font-bold tracking-[0.14em]',
                      e.event === 'CONTRACT_DEPLOYED'
                        ? 'text-[#c8ff00]'
                        : e.event === 'JOIN_COMMITTED'
                          ? 'text-[#7dffa8]'
                          : e.event === 'ORBIT_HEAD_ANCHOR'
                            ? 'text-[#f3e38a]'
                            : 'text-[#9dbda4]'
                    )}
                  >
                    {e.event}
                  </span>
                  <span className="ml-auto text-[8px] text-[#3f5748]">{ago(e.createdAt)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[8px] leading-relaxed text-[#5f7f68]">{e.details}</p>
                <p className="mt-0.5 text-[8px] tabular-nums text-[#3f5748]">{head8(e.hash)}</p>
              </div>
            ))}
            {wormQ.data && wormQ.data.length === 0 ? (
              <p className="px-3 py-6 text-center text-[9px] tracking-[0.2em] text-[#5f7f68]">NO ICSH ENTRIES YET</p>
            ) : null}
          </div>
        </Panel>

        <Panel title="LEDGER.JSONL · ONE LINE PER CYCLE" bodyClass="p-0">
          <div className="max-h-96 overflow-y-auto icsh-scroll">
            {cycles.length === 0 ? (
              <div className="p-3">
                <Empty lines={['NO CYCLE LINES YET', 'run iterations on the COST MATRIX surface (14:38)']} />
              </div>
            ) : (
              cycles.map((c) => (
                <div key={c.seq} className="flex items-baseline gap-2 border-b border-[#0e1811] px-3 py-1.5 font-mono hover:bg-[#081009]">
                  <span className="text-[9px] tabular-nums text-[#3f5748]">{pad(c.cycle)}</span>
                  <span className="text-[8px] tracking-[0.1em] text-[#5f7f68] whitespace-nowrap">{c.viewport}</span>
                  <span className="text-[9px] tabular-nums text-[#7dffa8]">{head8(c.head)}</span>
                  <span className="text-[8px] tabular-nums text-[#3f5748]">k{c.vaultCount}</span>
                  <span
                    className={cn('ml-auto text-[8px] font-bold', c.agreement ? 'text-[#7dffa8]' : 'text-[#ff7a6e]')}
                  >
                    {c.agreement ? 'a:1' : `a:0 d${c.divergentPeers}`}
                  </span>
                </div>
              ))
            )}
            {hasOlder ? (
              <button
                type="button"
                onClick={loadOlder}
                className="w-full border-t border-[#16241a] py-2 text-[8px] tracking-[0.26em] text-[#5f7f68] hover:text-[#7dffa8]"
              >
                ▾ LOAD OLDER LINES
              </button>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
