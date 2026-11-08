'use client';

// src/components/receipts/ReceiptsWorkspace.tsx — Task 41 · #/receipts
// RECEIPTS · CROSS-RAIL CHAIN — the chain explorer for both bridge rails.
//
//   * Segmented rail switcher BRIDGE :3004 / FIELD :3005 (lime active).
//   * TanStack Query polls the selected rail's receipt tail every 5s.
//   * Chain summary from the rail's own /status (merkle root excerpt,
//     verified flag, anchored count / anchor status).
//   * VERIFY CHAIN recomputes the full chain from genesis (?verify=1) —
//     green banner on valid, red with the REAL reason on failure.
//   * Rail unreachable → honest red error card. Never an empty table
//     pretending to be fine.

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cable, Link2, Loader2, Radio, ShieldAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ── API contracts (mirror of the two rails' engines) ─────────────────────────

interface ReceiptItem {
  seq: number;
  ts: string;
  actor: string;
  op: string;
  target?: string;
  ok: boolean;
  hash: string;
  tier?: string;
}

interface ReceiptsResponse {
  count: number;
  receipts: ReceiptItem[];
  root?: string;
  error?: string;
}

interface VerifyResponse {
  valid: boolean;
  checked: number;
  firstBadIndex: number;
  anchorStatus?: string;
  error?: string;
}

interface RailStatus {
  ok: boolean;
  node?: string;
  receipts?: {
    count: number;
    root?: string;
    verified?: boolean;
    merkleRoot?: string;
    anchored?: number;
  };
  merkleAnchor?: { root: string; at: string; txRef: string; relay: string };
}

interface RailConfig {
  key: 'bridge' | 'field';
  label: string;
  port: number;
  receiptsPath: string;
  statusPath: string;
}

const RAILS: readonly RailConfig[] = [
  { key: 'bridge', label: 'BRIDGE', port: 3004, receiptsPath: '/api/bridge/receipts', statusPath: '/api/bridge/status' },
  { key: 'field', label: 'FIELD', port: 3005, receiptsPath: '/api/field/receipts', statusPath: '/api/field/status' },
] as const;

// ── helpers ─────────────────────────────────────────────────────────────────

function hmst(iso: string): string {
  const d = new Date(iso);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

function stamp(iso: string): string {
  const d = new Date(iso);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

const TIER_CLASS: Record<string, string> = {
  anon: 'border-[rgba(107,138,64,0.35)] text-[#7a8a6e]',
  paying: 'border-[#2ea8a0]/50 text-[#2ea8a0]',
  enterprise: 'border-[#e0a030]/50 text-[#e0a030]',
};

// ── component ───────────────────────────────────────────────────────────────

export function ReceiptsWorkspace() {
  const [railKey, setRailKey] = useState<'bridge' | 'field'>('bridge');
  const rail = RAILS.find((r) => r.key === railKey) ?? RAILS[0];

  const [verify, setVerify] = useState<{ busy: boolean; valid?: boolean; checked?: number; reason?: string; at?: string }>({
    busy: false,
  });

  const receiptsQuery = useQuery<ReceiptsResponse, Error>({
    queryKey: ['receipts-explorer', rail.key],
    queryFn: async () => {
      const res = await fetch(rail.receiptsPath, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${rail.label} RAIL HTTP ${res.status}`);
      const data = (await res.json()) as ReceiptsResponse;
      if (data.error) throw new Error(data.error);
      return data;
    },
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    staleTime: 2_500,
  });

  const statusQuery = useQuery<RailStatus, Error>({
    queryKey: ['receipts-explorer-status', rail.key],
    queryFn: async () => {
      const res = await fetch(rail.statusPath, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${rail.label} STATUS HTTP ${res.status}`);
      return (await res.json()) as RailStatus;
    },
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });

  function switchRail(next: 'bridge' | 'field') {
    if (next === railKey) return;
    setRailKey(next);
    setVerify({ busy: false }); // verdicts are per-rail — reset on switch
  }

  async function doVerify() {
    setVerify({ busy: true });
    try {
      const res = await fetch(`${rail.receiptsPath}?verify=1`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`verify HTTP ${res.status}`);
      const data = (await res.json()) as VerifyResponse;
      if (data.error) throw new Error(data.error);
      if (data.valid) {
        setVerify({ busy: false, valid: true, checked: data.checked, at: new Date().toISOString() });
        toast(`${rail.label} CHAIN VALID`, { description: `checked ${data.checked} receipts from genesis` });
      } else {
        const reason = `chain broken at index ${data.firstBadIndex} (checked ${data.checked})`;
        setVerify({ busy: false, valid: false, checked: data.checked, reason, at: new Date().toISOString() });
        toast.error(`${rail.label} CHAIN BROKEN`, { description: reason });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setVerify({ busy: false, valid: false, reason: msg, at: new Date().toISOString() });
      toast.error(`${rail.label} VERIFY FAILED`, { description: msg });
    }
  }

  const receipts = receiptsQuery.data;

  /* Task 47 — the keyboard layer's Ctrl+V (VERIFY) verb lands here: the
     action event marks itself handled and runs the SAME genesis verify the
     on-screen button runs. No parallel implementation, no duplication. */
  useEffect(() => {
    const onAction = (e: Event) => {
      const detail = (e as CustomEvent<{ action: string; handled: boolean }>).detail;
      if (!detail || detail.action !== 'verify') return;
      detail.handled = true;
      void doVerify();
    };
    window.addEventListener('vvu:action', onAction);
    return () => window.removeEventListener('vvu:action', onAction);
  }, []);
  const status = statusQuery.data;
  const rows = receipts?.receipts ? [...receipts.receipts].reverse() : []; // newest first

  return (
    <div className="absolute inset-0 overflow-y-auto vvu-grid-bg" role="region" aria-label="Cross-rail receipt chain explorer">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 pb-28 pt-6 space-y-5">
        {/* ── title block ── */}
        <section className="vvu-panel-solid p-4 sm:p-6" aria-labelledby="receipts-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="vvu-label text-[10px] text-[#c8ff00] border border-[#c8ff00]/40 px-2 py-0.5">
                  TASK 41 · CROSS-RAIL CHAIN
                </span>
                <span className="vvu-label text-[9px] px-2 py-0.5 rounded border border-[rgba(107,138,64,0.35)] text-[#7a8a6e]">
                  SHA-256 · GENESIS → TIP
                </span>
              </div>
              <h1 id="receipts-title" className="vvu-label text-xl sm:text-2xl font-bold text-[#f3e38a] tracking-[0.18em] mt-2">
                RECEIPTS · CROSS-RAIL CHAIN
              </h1>
              <p className="vvu-label text-[9px] sm:text-[10px] text-[#7a8a6e] mt-1 max-w-2xl leading-relaxed">
                SHA-256 HASH-CHAINED RECEIPTS · GENESIS → TIP
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => void doVerify()}
                disabled={verify.busy}
                className="min-h-[44px] vvu-label text-[10px] font-bold border-[#6b8a40]/50 text-[#c9d4bd] hover:bg-[#8fb35a]/10 hover:text-[#c8ff00]"
              >
                {verify.busy ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <ShieldCheck className="size-3.5" aria-hidden />
                )}
                VERIFY CHAIN
              </Button>
              <p className="vvu-label text-[8px] text-[#7a8a6e] flex items-center gap-1">
                <Radio className="size-3" aria-hidden /> POLL 5S · TAIL 100
              </p>
            </div>
          </div>
        </section>

        {/* ── rail switcher + chain summary ── */}
        <section className="vvu-panel p-4 sm:p-6" aria-labelledby="receipts-summary-h">
          <div className="flex items-center gap-1.5 mb-3 px-0.5">
            <span className="inline-block size-1.5 bg-[#c8ff00]" aria-hidden />
            <h2 id="receipts-summary-h" className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e]">
              RAIL · CHAIN SUMMARY
            </h2>
          </div>

          {/* segmented control */}
          <div
            role="tablist"
            aria-label="Receipt rail"
            className="inline-flex rounded-sm border border-[rgba(107,138,64,0.35)] overflow-hidden mb-4"
          >
            {RAILS.map((r) => {
              const active = r.key === railKey;
              return (
                <button
                  key={r.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => switchRail(r.key)}
                  className={`vvu-label text-[9px] sm:text-[10px] font-bold px-4 min-h-[44px] min-w-[132px] transition-colors ${
                    active
                      ? 'bg-[#c8ff00]/15 text-[#c8ff00] border-b-2 border-[#c8ff00]'
                      : 'text-[#7a8a6e] hover:text-[#c9d4bd] hover:bg-[rgba(107,138,64,0.12)]'
                  }`}
                >
                  {r.label} :{r.port}
                </button>
              );
            })}
          </div>

          {receiptsQuery.isPending || statusQuery.isPending ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryCell label="CHAIN COUNT" value={receipts ? String(receipts.count) : '—'} tone="lime" />
              <SummaryCell
                label="TAIL SHOWN"
                value={receipts ? String(receipts.receipts.length) : '—'}
              />
              <SummaryCell
                label="MERKLE ROOT"
                value={status?.receipts?.merkleRoot ? `${status.receipts.merkleRoot.slice(0, 14)}…` : '—'}
                mono
                title={status?.receipts?.merkleRoot}
              />
              <SummaryCell
                label="CHAIN STATE"
                value={
                  status?.receipts?.verified === true
                    ? 'VALID (STATUS)'
                    : status?.receipts?.verified === false
                      ? 'UNVERIFIED (STATUS)'
                      : '—'
                }
                tone={status?.receipts?.verified === false ? 'red' : 'dim'}
              />
              {typeof status?.receipts?.anchored === 'number' && (
                <SummaryCell label="ANCHORED" value={`${status.receipts.anchored} (STUB RELAY)`} tone="amber" />
              )}
              {status?.merkleAnchor?.txRef && (
                <SummaryCell label="LAST ANCHOR TX" value={status.merkleAnchor.txRef} mono title={status.merkleAnchor.at} />
              )}
            </div>
          )}
        </section>

        {/* ── verify banner ── */}
        {verify.valid === true && (
          <div
            className="vvu-panel-solid p-3.5 flex flex-wrap items-center gap-2.5 border-[#c8ff00]/40 bg-[#c8ff00]/5"
            role="status"
          >
            <ShieldCheck className="size-4 text-[#c8ff00]" aria-hidden />
            <span className="vvu-label text-[10px] font-bold text-[#c8ff00]">
              CHAIN VALID · CHECKED {verify.checked} FROM GENESIS
            </span>
            <span className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums ml-auto">
              {verify.at ? stamp(verify.at) : ''} · {rail.label} :{rail.port}
            </span>
          </div>
        )}
        {verify.valid === false && (
          <div className="vvu-panel-solid p-3.5 flex flex-wrap items-center gap-2.5 border-[#e5484d]/50 bg-[#e5484d]/5" role="alert">
            <ShieldAlert className="size-4 text-[#e5484d]" aria-hidden />
            <span className="vvu-label text-[10px] font-bold text-[#e5484d]">CHAIN VERIFICATION FAILED</span>
            <span className="font-mono text-[9px] text-[#e5484d] break-all min-w-0">{verify.reason}</span>
          </div>
        )}

        {/* ── receipt table ── */}
        <section className="vvu-panel p-4 sm:p-6" aria-labelledby="receipts-table-h">
          <div className="flex items-center gap-1.5 mb-3 px-0.5">
            <span className="inline-block size-1.5 bg-[#f3e38a]" aria-hidden />
            <h2 id="receipts-table-h" className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e]">
              RECEIPT TAIL · NEWEST FIRST · {rail.label} :{rail.port}
            </h2>
          </div>

          {receiptsQuery.isError ? (
            <div
              className="w-full p-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border bg-black/30"
              style={{ borderColor: 'rgba(229,72,77,0.4)' }}
              role="alert"
            >
              <div className="min-w-0">
                <p className="vvu-label text-[10px] text-[#e5484d] font-bold">
                  {rail.label} RAIL UNREACHABLE — RECEIPTS UNAVAILABLE
                </p>
                <p className="font-mono text-[9px] text-[#e5484d] break-all mt-1">{receiptsQuery.error.message}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void receiptsQuery.refetch()}
                className="min-h-[44px] vvu-label text-[10px] font-bold border-[#e5484d]/50 text-[#e5484d] hover:bg-[#e5484d]/10"
              >
                RETRY RAIL
              </Button>
            </div>
          ) : receiptsQuery.isPending ? (
            <div className="max-h-[60vh] overflow-y-auto rounded border border-[#6b8a40]/30 bg-black/30 space-y-1.5 p-2.5">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="max-h-[60vh] overflow-y-auto rounded border border-[#6b8a40]/30 bg-black/30 p-4">
              <p className="vvu-label text-[9px] text-[#7a8a6e]">NO RECEIPTS — the chain is at genesis</p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto overflow-x-auto rounded border border-[#6b8a40]/30 bg-black/30">
              <table className="w-full font-mono text-[9px] min-w-[560px]">
                <thead className="sticky top-0 bg-[#0b0f0a]">
                  <tr className="vvu-label text-[8px] text-[#7a8a6e] text-left">
                    <th scope="col" className="px-2 py-1.5">SEQ</th>
                    <th scope="col" className="px-2 py-1.5">TIME</th>
                    <th scope="col" className="px-2 py-1.5">ACTOR/LABEL</th>
                    <th scope="col" className="px-2 py-1.5">OP</th>
                    <th scope="col" className="px-2 py-1.5">TIER</th>
                    <th scope="col" className="px-2 py-1.5">HASH</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.seq} className="border-t border-[#6b8a40]/15">
                      <td className="px-2 py-1.5 text-[#7a8a6e] tabular-nums">{r.seq}</td>
                      <td className="px-2 py-1.5 text-[#7a8a6e] tabular-nums">{hmst(r.ts)}</td>
                      <td className="px-2 py-1.5 text-[#c9d4bd] truncate max-w-32" title={r.actor}>{r.actor}</td>
                      <td className="px-2 py-1.5">
                        <span className={r.ok ? 'text-[#c8ff00]' : 'text-[#e5484d]'}>{r.op}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        {r.tier ? (
                          <span
                            className={`vvu-label text-[8px] px-1.5 py-0.5 rounded border ${
                              TIER_CLASS[r.tier] ?? TIER_CLASS.anon
                            }`}
                          >
                            {r.tier}
                          </span>
                        ) : (
                          <span className="text-[#7a8a6e]">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-[#7a8a6e]" title={r.hash}>{r.hash.slice(0, 14)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="vvu-label text-[8px] text-[#7a8a6e] flex items-center gap-1.5 px-0.5">
          <Link2 className="size-3" aria-hidden />
          EVERY ROW hash = SHA-256(canonical fields + prevHash) · TAMPER IN ANY FIELD BREAKS THE CHAIN
          <Cable className="size-3" aria-hidden />
        </p>
      </div>
    </div>
  );
}

// ── small local atom ────────────────────────────────────────────────────────

function SummaryCell({
  label,
  value,
  tone = 'dim',
  mono = false,
  title,
}: {
  label: string;
  value: string;
  tone?: 'dim' | 'lime' | 'red' | 'amber';
  mono?: boolean;
  title?: string;
}) {
  return (
    <div className="rounded-sm border border-[#6b8a40]/30 bg-black/30 p-3 min-w-0" title={title}>
      <p className="vvu-label text-[8px] text-[#7a8a6e] truncate">{label}</p>
      <p
        className={`mt-1 truncate tabular-nums ${
          mono ? 'font-mono text-[10px]' : 'vvu-label text-[10px] tracking-[0.1em]'
        } ${
          tone === 'lime'
            ? 'text-[#c8ff00]'
            : tone === 'red'
              ? 'text-[#e5484d]'
              : tone === 'amber'
                ? 'text-[#e0a030]'
                : 'text-[#c9d4bd]'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
