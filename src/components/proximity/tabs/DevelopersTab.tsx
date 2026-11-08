'use client';

// src/components/proximity/tabs/DevelopersTab.tsx
// DevelopersTab — extracted verbatim from ProximityWorkspace.tsx (R62 lazy split).
// Same bytes, same props; the shell now loads this module only when the tab opens.

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Ban,
  Copy,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { Panel, VerdictChip } from '../shared';

import {
  type ContractAuditResult
} from '@/lib/proximity/types';

function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group flex items-center gap-1.5">
      <code className="flex-1 overflow-x-auto whitespace-pre rounded border border-slate-800 bg-black/50 px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-emerald-200/80 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-800">
        {text}
      </code>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          void navigator.clipboard?.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
          toast.success('COPIED');
        }}
        className="h-7 shrink-0 border-slate-700 bg-slate-950/60 px-2 text-slate-400 hover:text-cyan-200"
        aria-label="copy command"
      >
        <Copy className={`h-3 w-3 ${copied ? 'text-emerald-300' : ''}`} />
      </Button>
    </div>
  );
}

export default function DevelopersTab({ audit }: { audit: { ok: boolean; audit: ContractAuditResult } | null }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Panel
        title="Contract audit · integer-only, unit-suffixed"
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
        indicator={audit ? (audit.ok ? 'AUDIT PASS' : 'AUDIT FAIL') : 'RUNNING…'}
        indicatorTone={audit ? (audit.ok ? 'emerald' : 'rose') : 'slate'}
      >
        {!audit ? (
          <Skeleton className="h-40 w-full bg-slate-900/60" />
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-slate-800">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
                    <th className="px-2.5 py-1.5 font-semibold">field</th>
                    <th className="px-2.5 py-1.5 font-semibold">kind</th>
                    <th className="px-2.5 py-1.5 font-semibold">unit</th>
                    <th className="px-2.5 py-1.5 font-semibold">range</th>
                    <th className="px-2.5 py-1.5 font-semibold">audit</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.audit.fields.map((f) => (
                    <tr key={f.field} className="border-b border-slate-800/60 font-mono text-[10px]">
                      <td className="px-2.5 py-1.5 text-slate-200">{f.field}</td>
                      <td className="px-2.5 py-1.5 text-slate-500">{f.kind}</td>
                      <td className="px-2.5 py-1.5 text-cyan-300">{f.unit ?? '—'}</td>
                      <td className="px-2.5 py-1.5 text-slate-500">{f.range}</td>
                      <td className="px-2.5 py-1.5">
                        <VerdictChip verdict={f.numericOk ? 'PASS' : 'BROKEN'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2.5 space-y-1.5">
              <div className={`rounded-lg border px-3 py-2 ${audit.audit.floatRejectionProbe.verdict === 'PASS' ? 'border-emerald-900/60 bg-emerald-950/20' : 'border-rose-900/60 bg-rose-950/30'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300">float rejection probe</span>
                  <VerdictChip verdict={audit.audit.floatRejectionProbe.verdict} />
                </div>
                <p className="mt-1 font-mono text-[9.5px] leading-relaxed text-slate-500">
                  input <span className="text-amber-300">{audit.audit.floatRejectionProbe.input}</span> → {audit.audit.floatRejectionProbe.detail}
                </p>
              </div>
              <div className={`rounded-lg border px-3 py-2 ${audit.audit.boundary.probe?.refusedWith.startsWith('403') ? 'border-emerald-900/60 bg-emerald-950/20' : 'border-rose-900/60 bg-rose-950/30'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300">simulator / production boundary</span>
                  <VerdictChip verdict={audit.audit.boundary.probe?.refusedWith.startsWith('403') ? 'PASS' : 'BROKEN'} />
                </div>
                <p className="mt-1 font-mono text-[9.5px] leading-relaxed text-slate-500">
                  {audit.audit.boundary.mechanism}
                </p>
                {audit.audit.boundary.probe && (
                  <p className="mt-1 font-mono text-[9.5px] text-slate-400">
                    live probe on <span className="text-violet-300">{audit.audit.boundary.probe.eventId.slice(0, 28)}…</span> (
                    {audit.audit.boundary.probe.source}) → <span className="text-rose-300">{audit.audit.boundary.probe.refusedWith}</span>
                  </p>
                )}
              </div>
              <p className="font-mono text-[9px] text-slate-600">checked {audit.audit.checkedAtUtc}</p>
            </div>
          </>
        )}
      </Panel>

      <div className="flex flex-col gap-4">
        <Panel title="API explorer · the four steps over HTTP" icon={<Terminal className="h-3.5 w-3.5" />} indicator="LOCAL · NO CLOUD" indicatorTone="violet">
          <div className="space-y-2.5">
            {[
              {
                step: 'STEP 2+3 · ingest one scan (contract → gate → seal)',
                cmd: `curl -X POST http://localhost:3000/api/proximity/scan -H 'content-type: application/json' -d '{"subject_id":"vvu-042","source":"simulator","distance_cm":45,"rssi_dbm":-52,"battery_mv":3720,"dwell_ms":12500,"risk_milli":871,"occurred_at":"2026-11-03T22:14:07.123Z"}'`,
              },
              {
                step: 'STEP 1 AUDIT · post the rejected float draft (expect 400)',
                cmd: `curl -X POST http://localhost:3000/api/proximity/scan -H 'content-type: application/json' -d '{"subject_id":"vvu-042","source":"simulator","distance_m":0.45,"rssi_dbm":-58,"battery_mv":3720,"dwell_ms":12500,"risk_milli":214,"occurred_at":"2026-11-03T22:14:07.123Z"}'`,
              },
              { step: 'STEP 4 · verify the chain from stored bytes', cmd: 'curl -X POST http://localhost:3000/api/proximity/verify' },
              { step: 'THE ONE BUTTON · rewrite a sealed simulator record (expect the chain to break at it)', cmd: `curl -X POST http://localhost:3000/api/proximity/tamper -H 'content-type: application/json' -d '{"eventId":"<simulator-event-id>"}'` },
              { step: 'the boundary · the same call on a production record (expect 403 PRODUCTION_IMMUTABLE)', cmd: `curl -X POST http://localhost:3000/api/proximity/tamper -H 'content-type: application/json' -d '{"eventId":"<production-event-id>"}'` },
              { step: 'restore the tampered bytes (rebuild from the untampered row)', cmd: `curl -X POST http://localhost:3000/api/proximity/restore -H 'content-type: application/json' -d '{"eventId":"<simulator-event-id>"}'` },
              { step: 'the pre-send audit (contract + boundary, executed live)', cmd: 'curl http://localhost:3000/api/proximity/audit' },
              { step: 'OFF-BOX · export the anchor ledger as a hash-covered bundle (evidence that travels)', cmd: 'curl -OJ http://localhost:3000/api/proximity/anchor/bundle' },
              { step: 'OFF-BOX · replay a received bundle against the live chain (hash first, then every anchor)', cmd: `curl -X POST http://localhost:3000/api/proximity/anchor/bundle -H 'content-type: application/json' --data @vvu-anchor-bundle-<stamp>.json` },
              { step: 'OUT-OF-BAND · the dispatch state (config, delivery log, sink inbox)', cmd: 'curl http://localhost:3000/api/proximity/webhook' },
              { step: 'OUT-OF-BAND · point the dispatcher at a receiver (env PROXIMITY_ALARM_WEBHOOK_URL wins over this file)', cmd: `curl -X POST http://localhost:3000/api/proximity/webhook -H 'content-type: application/json' -d '{"action":"set","url":"http://127.0.0.1:3000/api/proximity/webhook-sink","secret":"<hmac-secret>"}'` },
              { step: 'OUT-OF-BAND · a signed test dispatch (nothing is raised on the alarm rail)', cmd: `curl -X POST http://localhost:3000/api/proximity/webhook -H 'content-type: application/json' -d '{"action":"test"}'` },
              { step: 'RETRY QUEUE · force the next backoff attempt for a queued alarm now', cmd: `curl -X POST http://localhost:3000/api/proximity/webhook -H 'content-type: application/json' -d '{"action":"retry-now","alarmSeq":<seq>}'` },
              { step: 'RETRY QUEUE · retire a row the operator has decided is dead (stays as history)', cmd: `curl -X POST http://localhost:3000/api/proximity/webhook -H 'content-type: application/json' -d '{"action":"dismiss-retry","alarmSeq":<seq>}'` },
              { step: 'the sentinel (pass history + alarm rail + scheduler state)', cmd: 'curl http://localhost:3000/api/proximity/watchdog' },
            ].map((x) => (
              <div key={x.step}>
                <p className="mb-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-500">{x.step}</p>
                <CopyLine text={x.cmd} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Honest limits · what this is and is not" icon={<Ban className="h-3.5 w-3.5" />} indicator="READ BEFORE PILOT" indicatorTone="amber">
          <ul className="space-y-1.5 font-mono text-[10px] leading-relaxed text-slate-400">
            <li>
              <span className="text-amber-300">tamper-evident, not tam-proof.</span> The demo rewrites stored bytes and the
              chain pinpoints the break — a full-file rewrite (bytes + digests + linkage together) is not yet detected.
              Phase two: daily head-hash anchoring to immutable storage + HSM-signed chain heads.
            </li>
            <li>
              <span className="text-amber-300">SQLite, single process.</span> The event_id PK + (stream, position) UNIQUE
              backstops concurrent sealing; a two-instance deployment wants the pilot&apos;s Postgres port.
            </li>
            <li>
              <span className="text-amber-300">timestamps are informational.</span> Chain order is worm_seal_index.position
              — append order, never arrival order, never time.
            </li>
            <li>
              <span className="text-emerald-300">the boundary is code.</span> Production sources are never mutable — the
              tamper path reads the stored source column and refuses. No flag exists to get wrong.
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

// ─── TAB 4 · WATCHDOG (the sentinel) ────────────────────────────────────────
// Continuous verification + the tamper alarm rail + external head anchors.
// Layering, stated on the surface: the stored-bytes rule catches byte
// tamper; the sentinel makes verification continuous and alarms on disk;
// the anchors catch the full-file rewrite that re-links everything — the
// one attack the walker alone cannot see.

