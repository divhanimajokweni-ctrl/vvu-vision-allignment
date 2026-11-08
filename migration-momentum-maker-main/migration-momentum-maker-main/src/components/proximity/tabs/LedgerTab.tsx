'use client';

// src/components/proximity/tabs/LedgerTab.tsx
// LedgerTab — extracted verbatim from ProximityWorkspace.tsx (R62 lazy split).
// Same bytes, same props; the shell now loads this module only when the tab opens.

import {
  Boxes,
  ChevronRight,
  Database,
  FileJson,
  Lock,
  RefreshCw,
  ShieldCheck,
  Siren,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

import { shortHash, Panel, SourceChip, VerdictChip, type ChainResponse } from '../shared';

export default function LedgerTab({
  chain,
  statusByEvent,
  busy,
  bytesOpen,
  setBytesOpen,
  onVerify,
  onTamper,
  onRestore,
}: {
  chain: ChainResponse | null;
  statusByEvent: Map<string, 'OK' | 'BROKEN'>;
  busy: string | null;
  bytesOpen: string | null;
  setBytesOpen: (v: string | null) => void;
  onVerify: () => Promise<void>;
  onTamper: (eventId: string, source: string) => Promise<void>;
  onRestore: (eventId: string) => Promise<void>;
}) {
  const v = chain?.verification ?? null;
  return (
    <Panel
      title="State ledger · the sealed stream (authoritative order: position)"
      icon={<Database className="h-3.5 w-3.5" />}
      indicator={v?.valid === false ? `BROKEN · ${v.brokenAt}` : v?.valid ? `VALID` : '…'}
      indicatorTone={v?.valid === false ? 'rose' : 'emerald'}
      actions={
        <div className="flex items-center gap-1.5 font-mono text-[9.5px] text-slate-500">
          <span className="hidden sm:inline">checked {v?.checkedAtUtc ?? '—'} · {v?.checkedInMs ?? '—'} ms</span>
          <Button
            onClick={() => void onVerify()}
            disabled={busy === 'verify'}
            size="sm"
            variant="outline"
            className="h-7 border-slate-700 bg-slate-950/60 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300 hover:border-cyan-800 hover:text-cyan-200"
          >
            {busy === 'verify' ? <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> : <ShieldCheck className="mr-1 h-3 w-3" />}
            run verify
          </Button>
        </div>
      }
    >
      {v?.valid === false && (
        <div className="mb-3 rounded-lg border border-rose-900/70 bg-rose-950/40 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Siren className="h-3.5 w-3.5 text-rose-300" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-rose-300">chain broken at {v.brokenAt}</span>
          </div>
          <p className="mt-1 font-mono text-[10px] leading-relaxed text-rose-200/70">{v.reason}</p>
          <p className="mt-1 font-mono text-[9.5px] text-rose-200/50">
            every record AFTER the break still carries its recorded linkage — but the bytes no longer match the digest
            recorded at seal time. The stored-bytes rule is what detected this.
          </p>
        </div>
      )}
      <div className="max-h-[620px] overflow-auto rounded-lg border border-slate-800 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-800">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
            <tr className="border-b border-slate-800 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
              <th className="px-3 py-2 font-semibold">pos</th>
              <th className="px-3 py-2 font-semibold">event id</th>
              <th className="px-3 py-2 font-semibold">src</th>
              <th className="px-3 py-2 font-semibold">record hash</th>
              <th className="px-3 py-2 font-semibold">prev hash</th>
              <th className="px-3 py-2 font-semibold">sealed at</th>
              <th className="px-3 py-2 font-semibold">status</th>
              <th className="px-3 py-2 font-semibold">tamper demo</th>
            </tr>
          </thead>
          <tbody>
            {(chain?.chain ?? []).map((row) => {
              const status = statusByEvent.get(row.eventId) ?? 'OK';
              const broken = status === 'BROKEN';
              return (
                <tr key={row.eventId} className={`border-b border-slate-800/60 font-mono text-[10px] ${broken ? 'bg-rose-950/20' : 'hover:bg-slate-900/40'}`}>
                  <td className="px-3 py-2 font-bold text-slate-400">#{row.position}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => setBytesOpen(bytesOpen === row.eventId ? null : row.eventId)} className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200">
                      <FileJson className="h-3 w-3" />
                      {row.eventId.slice(0, 24)}…
                      <ChevronRight className={`h-3 w-3 transition-transform ${bytesOpen === row.eventId ? 'rotate-90' : ''}`} />
                    </button>
                  </td>
                  <td className="px-3 py-2"><SourceChip source={row.source} /></td>
                  <td className="px-3 py-2"><span className={broken ? 'text-rose-300' : 'text-slate-300'}>{shortHash(row.recordHash, 12)}</span></td>
                  <td className="px-3 py-2 text-slate-500">{shortHash(row.previousRecordHash, 8)}</td>
                  <td className="px-3 py-2 text-slate-500">{row.sealedAtUtc}</td>
                  <td className="px-3 py-2"><VerdictChip verdict={status} /></td>
                  <td className="px-3 py-2">
                    {row.source === 'simulator' ? (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === `tamper:${row.eventId}` || busy === `restore:${row.eventId}` || broken}
                          onClick={() => void onTamper(row.eventId, row.source)}
                          className="h-6 border-rose-900/60 bg-rose-950/30 px-2 text-[9px] font-bold uppercase tracking-wider text-rose-300 hover:bg-rose-900/40"
                        >
                          rewrite
                        </Button>
                        {broken && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === `restore:${row.eventId}`}
                            onClick={() => void onRestore(row.eventId)}
                            className="h-6 border-emerald-900/60 bg-emerald-950/30 px-2 text-[9px] font-bold uppercase tracking-wider text-emerald-300 hover:bg-emerald-900/40"
                          >
                            restore
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-violet-400/80">
                        <Lock className="h-2.5 w-2.5" /> immutable
                      </span>
                    )}
                  </td>
                  {bytesOpen === row.eventId && (
                    <td colSpan={8} className="border-t border-slate-800/60 bg-slate-950/70 px-3 py-2">
                      <div className="mb-1 flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                        <Boxes className="h-3 w-3" /> stored canonical bytes (the EXACT bytes hashed at seal time — verifiers hash THESE, never a re-serialization)
                      </div>
                      <pre className="max-h-44 overflow-auto rounded border border-slate-800 bg-black/50 p-2.5 text-[10px] leading-relaxed text-emerald-200/80 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-800">
                        {JSON.stringify(JSON.parse(row.canonicalBytes), null, 2)}
                      </pre>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[9.5px] text-slate-500">
                        <span>digest <span className="text-cyan-300">{shortHash(row.canonicalEventHash, 16)}</span></span>
                        <span>algorithm <span className="text-violet-300">{row.algorithm}</span></span>
                        <span>subject <span className="text-slate-300">{row.subjectId}</span></span>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {(chain?.chain ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center font-mono text-[10px] text-slate-600">
                  no sealed records yet — fire a scan on the PIPELINE tab
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ─── TAB 3 · GOVERNANCE (the rules layer) ───────────────────────────────────

