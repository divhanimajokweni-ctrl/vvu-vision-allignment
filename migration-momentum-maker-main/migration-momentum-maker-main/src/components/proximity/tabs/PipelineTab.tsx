'use client';

// src/components/proximity/tabs/PipelineTab.tsx
// PipelineTab — extracted verbatim from ProximityWorkspace.tsx (R62 lazy split).
// Same bytes, same props; the shell now loads this module only when the tab opens.

import {
  Activity,
  ArrowDown,
  Database,
  Lock,
  RefreshCw,
  RotateCcw,
  Scale,
  ShieldCheck,
  Siren,
  Stamp,
  Undo2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { SUPPRESS_THRESHOLD_MILLI, shortHash, Panel, Metric, SourceChip, VerdictChip, type ChainResponse, type ScanForm } from '../shared';

import {
  riskMilliToDisplay,
  type RecordsPayload,
  type ScanOutcome
} from '@/lib/proximity/types';

function FlowArrow({ active, tone = 'slate' }: { active: boolean; tone?: 'slate' | 'emerald' | 'amber' | 'rose' }) {
  const cls = {
    slate: 'text-slate-600',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
  }[tone];
  return (
    <div className="flex items-center justify-center py-0.5" aria-hidden="true">
      <ArrowDown className={`h-4 w-4 transition-all ${active ? `${cls} scale-110 animate-pulse` : 'text-slate-700'}`} />
    </div>
  );
}

function RuleCard({
  id,
  name,
  expression,
  effect,
  fired,
  firedTone = 'amber',
  extra,
}: {
  id: string;
  name: string;
  expression: string;
  effect: string;
  fired: boolean;
  firedTone?: 'amber' | 'rose' | 'emerald';
  extra?: React.ReactNode;
}) {
  const firedCls =
    firedTone === 'rose'
      ? 'border-rose-800/80 bg-rose-950/30'
      : firedTone === 'amber'
        ? 'border-amber-800/80 bg-amber-950/30'
        : 'border-emerald-800/80 bg-emerald-950/30';
  return (
    <div className={`rounded-lg border px-3 py-2.5 transition-colors ${fired ? firedCls : 'border-slate-800 bg-slate-950/40'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">{id}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">{name}</span>
        </div>
        <VerdictChip verdict={fired ? 'FIRED' : 'PASS'} />
      </div>
      <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-slate-400">
        <span className="text-slate-500">IF </span>
        {expression}
        <span className="text-slate-500"> → </span>
        <span className={fired ? (firedTone === 'amber' ? 'text-amber-300' : 'text-rose-300') : 'text-slate-500'}>{effect}</span>
      </p>
      {extra}
    </div>
  );
}

export default function PipelineTab({
  records,
  chain,
  statusByEvent,
  form,
  setForm,
  enrolled,
  isEnrolled,
  suppressFires,
  dwellFires,
  fireScan,
  busy,
  lastOutcome,
  onVerify,
  onTamper,
  onRestore,
}: {
  records: RecordsPayload | null;
  chain: ChainResponse | null;
  statusByEvent: Map<string, 'OK' | 'BROKEN'>;
  form: ScanForm;
  setForm: React.Dispatch<React.SetStateAction<ScanForm>>;
  enrolled: string[];
  isEnrolled: boolean;
  suppressFires: boolean;
  dwellFires: boolean;
  fireScan: () => Promise<void>;
  busy: string | null;
  lastOutcome: ScanOutcome | null;
  onVerify: () => Promise<void>;
  onTamper: (eventId: string, source: string) => Promise<void>;
  onRestore: (eventId: string) => Promise<void>;
}) {
  const v = chain?.verification ?? null;
  const sealedRows = (chain?.chain ?? []).filter((c) => statusByEvent.get(c.eventId) !== undefined).slice().reverse();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.3fr)_minmax(0,1fr)]">
      {/* ═══ LEFT · OPERATIONAL FLOW — suppression decision ═══ */}
      <div className="flex flex-col gap-4">
        <Panel
          title="Operational flow · pipeline inputs"
          icon={<Activity className="h-3.5 w-3.5" />}
          indicator={suppressFires ? 'SUPPRESS' : 'PASS THROUGH'}
          indicatorTone={suppressFires ? 'amber' : 'emerald'}
        >
          <p className="mb-3 text-[10.5px] leading-relaxed text-slate-500">
            Fire a simulated scan. The rules below light up as the live input would trigger them — the server re-evaluates
            everything; this preview only shows which rule will fire.
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="col-span-2">
              <Label className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">subject_id (enrolled device)</Label>
              <Select value={form.subjectId} onValueChange={(x) => setForm((f) => ({ ...f, subjectId: x }))}>
                <SelectTrigger className="mt-1 h-8 border-slate-800 bg-slate-950/60 font-mono text-xs text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900">
                  {enrolled.map((s) => (
                    <SelectItem key={s} value={s} className="font-mono text-xs">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                distance_cm · DISTANCE
              </Label>
              <Input
                type="number"
                value={form.distanceCm}
                min={1}
                max={10000}
                onChange={(e) => setForm((f) => ({ ...f, distanceCm: Number(e.target.value) }))}
                className="mt-1 h-8 border-slate-800 bg-slate-950/60 font-mono text-xs tabular-nums text-slate-200"
              />
            </div>
            <div>
              <Label className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">rssi_dbm · RSSI</Label>
              <Input
                type="number"
                value={form.rssiDbm}
                min={-100}
                max={-1}
                onChange={(e) => setForm((f) => ({ ...f, rssiDbm: Number(e.target.value) }))}
                className="mt-1 h-8 border-slate-800 bg-slate-950/60 font-mono text-xs tabular-nums text-slate-200"
              />
            </div>
            <div>
              <Label className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">battery_mv · BATTERY</Label>
              <Input
                type="number"
                value={form.batteryMv}
                min={2500}
                max={5000}
                onChange={(e) => setForm((f) => ({ ...f, batteryMv: Number(e.target.value) }))}
                className="mt-1 h-8 border-slate-800 bg-slate-950/60 font-mono text-xs tabular-nums text-slate-200"
              />
            </div>
            <div>
              <Label className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">dwell_ms · DWELL</Label>
              <Input
                type="number"
                value={form.dwellMs}
                min={0}
                max={600000}
                onChange={(e) => setForm((f) => ({ ...f, dwellMs: Number(e.target.value) }))}
                className="mt-1 h-8 border-slate-800 bg-slate-950/60 font-mono text-xs tabular-nums text-slate-200"
              />
            </div>
            <div className="col-span-2">
              <div className="flex items-baseline justify-between">
                <Label className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  risk_milli · RISK SCORE
                </Label>
                <span className="font-mono text-xs tabular-nums text-amber-300">
                  {form.riskMilli} milli ≡ RISK {riskMilliToDisplay(form.riskMilli)}
                </span>
              </div>
              <div className="relative mt-2.5">
                <Slider
                  value={[form.riskMilli]}
                  min={0}
                  max={1000}
                  step={1}
                  onValueChange={([x]) => setForm((f) => ({ ...f, riskMilli: x }))}
                />
                {/* the threshold IS on the track — spec: thresholds render as thresholds */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0"
                  style={{ left: `${(SUPPRESS_THRESHOLD_MILLI / 1000) * 100}%` }}
                >
                  <div className={`absolute inset-y-0 -left-px w-0.5 transition-colors ${form.riskMilli > SUPPRESS_THRESHOLD_MILLI ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]' : 'bg-amber-600/60'}`} />
                  <span className="absolute -top-4.5 left-1 -translate-x-1/2 whitespace-nowrap font-mono text-[8px] font-bold uppercase tracking-wider text-amber-500/90">
                    ▸ suppress
                  </span>
                </div>
              </div>
              <div className="mt-1 flex justify-between font-mono text-[9px] text-slate-600">
                <span>0 milli · RISK 0.000</span>
                <span className={form.riskMilli > SUPPRESS_THRESHOLD_MILLI ? 'font-bold text-amber-400' : ''}>
                  threshold 820 milli · RISK 0.820
                </span>
                <span>1000 milli · RISK 1.000</span>
              </div>
            </div>
          </div>

          <Button
            onClick={() => void fireScan()}
            disabled={busy === 'scan'}
            className="mt-3.5 w-full border border-cyan-900/70 bg-cyan-950/60 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-200 hover:bg-cyan-900/50"
          >
            {busy === 'scan' ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Zap />}
            <span className="ml-1.5">fire scan through the pipeline</span>
          </Button>
        </Panel>

        <Panel title="Active processing rules" icon={<Siren className="h-3.5 w-3.5" />} indicator={suppressFires ? 'RULE FIRED' : 'ARMED'} indicatorTone={suppressFires ? 'amber' : 'slate'}>
          <div className="flex flex-col">
            <FlowArrow active tone="slate" />
            <RuleCard
              id="G1"
              name="contract pass"
              expression="scan ≡ vvu.proximity.scan.v1 (integer-only, closed-world)"
              effect="ACCEPT INPUT"
              fired={false}
              firedTone="emerald"
              extra={<p className="mt-1 font-mono text-[9.5px] text-slate-600">the kernel rejected distance_m (float) — the contract was corrected, the canonicalizer was NOT widened</p>}
            />
            <FlowArrow active={isEnrolled} tone={isEnrolled ? 'emerald' : 'rose'} />
            <RuleCard
              id="G2"
              name="enrolment gate"
              expression={`subject_id '${form.subjectId}' ∈ enrolled set`}
              effect={isEnrolled ? 'ALLOW → SEAL' : 'REFUSE · NEVER SEALED'}
              fired={!isEnrolled}
              firedTone="rose"
            />
            <FlowArrow active={suppressFires} tone={suppressFires ? 'amber' : 'emerald'} />
            <RuleCard
              id="R3"
              name="suppression decision"
              expression={`risk_milli ${form.riskMilli} (RISK ${riskMilliToDisplay(form.riskMilli)}) > 820 (RISK 0.820)`}
              effect="SUPPRESS ACTION"
              fired={suppressFires}
            />
            <FlowArrow active={dwellFires} tone={dwellFires ? 'amber' : 'slate'} />
            <RuleCard
              id="R4"
              name="extended dwell"
              expression={`dwell_ms ${form.dwellMs} (${(form.dwellMs / 1000).toFixed(1)} s DWELL) > 30000 ms (30.0 s)`}
              effect="FLAG EXTENDED_DWELL"
              fired={dwellFires}
            />
            <FlowArrow active tone="slate" />
            <div className="rounded-lg border border-violet-900/60 bg-violet-950/20 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stamp className="h-3.5 w-3.5 text-violet-300" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-200">seal · one kernel, reused</span>
                </div>
                <span className="font-mono text-[9.5px] text-violet-400">VVU-WORM-v1</span>
              </div>
              <p className="mt-1 font-mono text-[10px] leading-relaxed text-slate-500">
                JCS canonical bytes → sha256(domain‖0x00‖bytes‖0x00‖prev) → worm_seal_index. No second hasher — the pilot&apos;s
                chain and the estate&apos;s chain are the same chain.
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {/* ═══ CENTER · STATE LEDGER — the immutable centre column ═══ */}
      <div className="flex flex-col gap-4">
        <Panel
          title="State ledger · append-only sequence"
          icon={<Database className="h-3.5 w-3.5" />}
          indicator={v?.valid === false ? `BROKEN · ${v.brokenAt}` : v?.valid ? `VALID · ${v.records} SEALED` : '…'}
          indicatorTone={v?.valid === false ? 'rose' : v?.valid ? 'emerald' : 'slate'}
          actions={
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
          }
        >
          {v?.valid === false && (
            <div className="mb-3 rounded-lg border border-rose-900/70 bg-rose-950/40 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Siren className="h-3.5 w-3.5 text-rose-300" />
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-rose-300">
                  chain broken at {v.brokenAt}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] leading-relaxed text-rose-200/70">{v.reason}</p>
            </div>
          )}
          {v?.valid && (
            <div className="mb-3 grid grid-cols-3 gap-2">
              <Metric value={String(v.records)} unit="records" label="sealed on stream" tone="emerald" />
              <Metric value={v.checkedInMs.toString()} unit="ms" label="verify duration" tone="cyan" />
              <Metric value={shortHash(v.headHash, 10)} unit="head" label={`head @ pos ${v.headPosition}`} tone="cyan" />
            </div>
          )}
          <div className="max-h-[430px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-800">
            {sealedRows.length === 0 ? (
              <Skeleton className="h-24 w-full bg-slate-900/60" />
            ) : (
              <ol className="relative space-y-1.5 border-l border-slate-800 pl-4">
                {sealedRows.map((row) => {
                  const status = statusByEvent.get(row.eventId) ?? 'OK';
                  const broken = status === 'BROKEN';
                  return (
                    <li key={row.eventId} className="relative">
                      <span
                        className={`absolute -left-[21px] top-2.5 h-2 w-2 rounded-full border ${
                          broken ? 'border-rose-500 bg-rose-500' : 'border-emerald-600 bg-emerald-950'
                        }`}
                      />
                      <div
                        className={`rounded-lg border px-3 py-2 ${
                          broken ? 'border-rose-900/80 bg-rose-950/30' : 'border-slate-800 bg-slate-950/40'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-mono text-[10px] font-bold text-slate-500">#{row.position}</span>
                          <SourceChip source={row.source} />
                          <span className="font-mono text-[10px] text-slate-400">{row.subjectId}</span>
                          <span className="ml-auto font-mono text-[9.5px] text-slate-600">{row.sealedAtUtc}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[9.5px] text-slate-500">
                          <span>
                            <span className="text-slate-600">dist </span>
                            {chain?.chain.find((c) => c.eventId === row.eventId)
                              ? (() => {
                                  try {
                                    return `${(JSON.parse(row.canonicalBytes).payload as { distance_cm: number }).distance_cm} cm`;
                                  } catch {
                                    return '—';
                                  }
                                })()
                              : '—'}
                          </span>
                          <span>
                            <span className="text-slate-600">hash </span>
                            <span className={broken ? 'text-rose-300' : 'text-cyan-300'}>{shortHash(row.recordHash, 10)}</span>
                          </span>
                          {broken ? <VerdictChip verdict="BROKEN" /> : <VerdictChip verdict="OK" />}
                        </div>
                        {row.source === 'simulator' && (
                          <div className="mt-1.5 flex gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy === `tamper:${row.eventId}` || busy === `restore:${row.eventId}`}
                              onClick={() => void onTamper(row.eventId, row.source)}
                              className="h-6 border-rose-900/60 bg-rose-950/30 px-2 font-mono text-[9px] font-bold uppercase tracking-wider text-rose-300 hover:bg-rose-900/40"
                            >
                              {busy === `tamper:${row.eventId}` ? <RefreshCw className="mr-1 h-2.5 w-2.5 animate-spin" /> : <Undo2 className="mr-1 h-2.5 w-2.5" />}
                              rewrite stored bytes
                            </Button>
                            {broken && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy === `restore:${row.eventId}`}
                                onClick={() => void onRestore(row.eventId)}
                                className="h-6 border-emerald-900/60 bg-emerald-950/30 px-2 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-300 hover:bg-emerald-900/40"
                              >
                                <RotateCcw className="mr-1 h-2.5 w-2.5" /> restore
                              </Button>
                            )}
                          </div>
                        )}
                        {row.source === 'production' && (
                          <p className="mt-1.5 font-mono text-[9px] uppercase tracking-wider text-violet-400/80">
                            <Lock className="mr-1 inline h-2.5 w-2.5" />
                            production source — never mutable (boundary enforced in code, not a flag)
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </Panel>
      </div>

      {/* ═══ RIGHT · GOVERNANCE EVALUATOR — the rules layer ═══ */}
      <div className="flex flex-col gap-4">
        <Panel
          title="Governance evaluator · latest passes"
          icon={<Scale className="h-3.5 w-3.5" />}
          indicator={lastOutcome ? lastOutcome.gate.decision : 'AWAITING SCAN'}
          indicatorTone={lastOutcome?.gate.decision === 'ALLOW' ? 'emerald' : lastOutcome ? 'rose' : 'slate'}
        >
          {!lastOutcome ? (
            <p className="text-[10.5px] leading-relaxed text-slate-500">
              Fire a scan on the left — every evaluation pass (contract, enrolment, suppression) returns here with its
              explicit verdict.
            </p>
          ) : (
            <div className="space-y-1.5">
              {lastOutcome.passes.map((p) => (
                <div key={p.rule} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">{p.rule}</span>
                    <VerdictChip verdict={p.verdict} />
                  </div>
                  <p className="mt-1 font-mono text-[10px] leading-relaxed text-slate-500">{p.detail}</p>
                </div>
              ))}
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">record layer</span>
                  <VerdictChip verdict={lastOutcome.sealed ? 'SEALED' : 'REFUSED'} />
                </div>
                <p className="mt-1 font-mono text-[10px] text-slate-500">
                  {lastOutcome.sealed
                    ? `sealed at position #${lastOutcome.seal?.position} · action ${lastOutcome.action}`
                    : `never sealed — ${lastOutcome.gate.reason}`}
                </p>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Allowed vs refused · all-time" icon={<Scale className="h-3.5 w-3.5" />} indicator="GATE LEDGER" indicatorTone="cyan">
          {records ? (
            <div className="grid grid-cols-2 gap-2">
              <Metric value={String(records.counts.allowed)} unit="allowed" label="passed the gate · sealed" tone="emerald" />
              <Metric value={String(records.counts.refused)} unit="refused" label="turned away · never sealed" tone="rose" />
              <Metric value={String(records.counts.suppressed)} unit="suppressed" label="action suppressed · evidence kept" tone="amber" />
              <Metric value={String(records.counts.sealed)} unit="sealed" label="records on the chain" tone="cyan" />
            </div>
          ) : (
            <Skeleton className="h-24 w-full bg-slate-900/60" />
          )}
          <p className="mt-2.5 font-mono text-[9.5px] leading-relaxed text-slate-600">
            refused scans are recorded in the decision log but never sealed — the gate sits before the sealer.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function Zap() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14h7l-2 8 11-12h-7l2-8z" />
    </svg>
  );
}

// ─── TAB 2 · LEDGER (the past) ──────────────────────────────────────────────

