'use client';

// src/components/proximity/tabs/GovernanceTab.tsx
// GovernanceTab — extracted verbatim from ProximityWorkspace.tsx (R62 lazy split).
// Same bytes, same props; the shell now loads this module only when the tab opens.

import {
  Scale,
  Stamp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import { Panel, SourceChip, VerdictChip } from '../shared';

import {
  riskMilliToDisplay,
  type ProximityRecordView,
  type RecordsPayload,
  type ScanOutcome
} from '@/lib/proximity/types';

export default function GovernanceTab({ records, lastOutcome }: { records: RecordsPayload | null; lastOutcome: ScanOutcome | null }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Panel title="The rules layer · gate + decision passes" icon={<Scale className="h-3.5 w-3.5" />} indicator="POLICY SET" indicatorTone="cyan">
        <div className="space-y-1.5">
          {[
            {
              id: 'G1',
              layer: 'GATE',
              expr: 'scan ≡ vvu.proximity.scan.v1 · every numeric field a safe integer, unit in name, closed-world',
              effect: 'violation → REFUSE (HTTP 400, never sealed)',
              tone: 'emerald' as const,
            },
            {
              id: 'G2',
              layer: 'GATE',
              expr: "subject_id ∈ { vvu-003, vvu-017, vvu-042, vvu-108 } (enrolled devices)",
              effect: 'unknown subject → REFUSE (recorded, never sealed)',
              tone: 'emerald' as const,
            },
            {
              id: 'R3',
              layer: 'DECISION',
              expr: 'risk_milli > 820 (RISK SCORE > 0.820)',
              effect: 'SUPPRESS ACTION — evidence sealed, action suppressed',
              tone: 'amber' as const,
            },
            {
              id: 'R4',
              layer: 'DECISION',
              expr: 'dwell_ms > 30000 (DWELL TIME > 30.0 s)',
              effect: 'FLAG EXTENDED_DWELL (advisory)',
              tone: 'amber' as const,
            },
          ].map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold text-slate-500">{r.id}</span>
                <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-wider ${r.tone === 'amber' ? 'border-amber-900/70 bg-amber-950/40 text-amber-300' : 'border-emerald-900/70 bg-emerald-950/40 text-emerald-300'}`}>
                  {r.layer}
                </Badge>
              </div>
              <p className="mt-1 font-mono text-[10.5px] leading-relaxed text-slate-400">{r.expr}</p>
              <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                <span className="text-slate-600">effect → </span>
                {r.effect}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2.5 font-mono text-[9.5px] leading-relaxed text-slate-600">
          the gate sits BEFORE the sealer: refused scans never touch the chain. The decision pass runs on allowed scans and
          is recorded with the record — evidence is the scan, decisions are the gate.
        </p>
      </Panel>

      <Panel
        title="Evaluation ledger · every pass, allowed & refused"
        icon={<Stamp className="h-3.5 w-3.5" />}
        indicator={records ? `${records.counts.allowed} ALLOW / ${records.counts.refused} REFUSE` : '…'}
        indicatorTone="slate"
      >
        <div className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-800">
          {(records?.records ?? []).map((r: ProximityRecordView) => (
            <div
              key={r.eventId}
              className={`rounded-lg border px-3 py-2 ${
                r.gateDecision === 'REFUSE' ? 'border-rose-950/60 bg-rose-950/20' : 'border-slate-800 bg-slate-950/40'
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <VerdictChip verdict={r.gateDecision} />
                <SourceChip source={r.source} />
                <span className="font-mono text-[10px] text-slate-400">{r.subjectId}</span>
                <span className="ml-auto font-mono text-[9px] text-slate-600">{r.ingestedAtUtc}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[9.5px] text-slate-500">
                <span><span className="text-slate-600">risk </span>{r.riskMilli} milli · RISK {riskMilliToDisplay(r.riskMilli)}</span>
                <span><span className="text-slate-600">dist </span>{r.distanceCm} cm</span>
                <span><span className="text-slate-600">dwell </span>{r.dwellMs} ms · {(r.dwellMs / 1000).toFixed(1)} s</span>
                {r.gateDecision === 'REFUSE' ? (
                  <span className="text-rose-300">reason {r.gateReason}</span>
                ) : (
                  <span className={r.action === 'SUPPRESS' ? 'text-amber-300' : 'text-emerald-300'}>action {r.action}</span>
                )}
                <span className="text-slate-600">{r.sealRef ? 'sealed' : 'unsealed'}</span>
              </div>
            </div>
          ))}
          {(records?.records ?? []).length === 0 && (
            <Skeleton className="h-24 w-full bg-slate-900/60" />
          )}
        </div>
        {lastOutcome && (
          <p className="mt-2 font-mono text-[9.5px] text-slate-600">
            latest scan: {lastOutcome.eventId.slice(0, 30)}… · gate {lastOutcome.gate.decision} · action {lastOutcome.action}
          </p>
        )}
      </Panel>
    </div>
  );
}

// ─── TAB 4 · DEVELOPERS (the system core) ───────────────────────────────────

