'use client';

// src/components/analytics/FinancialScenarios.tsx — Appendix G scenarios:
// recharts contribution bar chart, comparison table (HBK highlighted) and the
// interactive churn lab stress-testing Scenario III (FAIL_CLOSED > 40% churn).

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SCENARIOS } from '@/lib/vvu-data';
import { cn } from '@/lib/utils';
import { Chip, SectionHeader, fmtRand } from './shared';

const SHORT_NAMES: Record<string, string> = {
  baseline: 'BASELINE',
  hbk: 'HBK MK-II',
  downside: 'DOWNSIDE',
};

const BAR_COLORS: Record<string, string> = {
  baseline: '#8fb35a',
  hbk: '#c8ff00',
  downside: '#e5484d',
};

const CHURN_FAIL_THRESHOLD = 40;

interface ChartRow {
  id: string;
  name: string;
  contribution: number;
}

const chartData: ChartRow[] = SCENARIOS.map((s) => ({ id: s.id, name: SHORT_NAMES[s.id] ?? s.name, contribution: s.contribution }));

interface TooltipItem {
  name?: string;
  value?: number | string;
  payload?: ChartRow;
}

function ScenarioTooltip({ active, payload }: { active?: boolean; payload?: TooltipItem[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="vvu-panel-solid px-3 py-2" style={{ background: 'rgba(11,15,10,0.96)' }}>
      <div className="vvu-label text-[9px] font-bold text-[#f3e38a]">{row.name}</div>
      <div className="text-[11px] text-[#c9d4bd] mt-1">
        OPERATING CONTRIBUTION <b className="text-[#c8ff00] tabular-nums">{fmtRand(row.contribution)}</b>/mo
      </div>
    </div>
  );
}

function StateChip({ state }: { state: string }) {
  const fail = state === 'FAIL_CLOSED';
  return (
    <span
      className={cn(
        'vvu-label text-[9px] px-2 py-1 rounded border whitespace-nowrap',
        fail ? 'border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10' : 'border-[#8fb35a]/50 text-[#8fb35a]'
      )}
    >
      {fail ? 'FAIL_CLOSED' : state}
    </span>
  );
}

function ChurnLab() {
  const [churn, setChurn] = useState(0);
  const base = SCENARIOS[0];
  const fail = churn > CHURN_FAIL_THRESHOLD;
  const contribution = Math.max(0, Math.round((base.mrr - base.infraCost) * (1 - churn / 100)));

  return (
    <div className="vvu-panel-solid p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="vvu-label text-[10px] font-bold text-[#f3e38a]">CHURN LAB · SCENARIO III STRESS TEST</span>
        <span className={cn('vvu-label text-[10px] font-bold tabular-nums', fail ? 'text-[#e5484d]' : 'text-[#c8ff00]')}>CHURN {churn}%</span>
      </div>

      <div className="py-3">
        <Slider value={[churn]} onValueChange={(vals) => setChurn(vals[0] ?? 0)} min={0} max={60} step={1} aria-label="monthly churn percentage" />
        <div className="flex justify-between mt-2 vvu-label text-[8px] text-[#7a8a6e]">
          <span>0%</span>
          <span>20%</span>
          <span className="text-[#e5484d] font-bold">40% · FAIL_CLOSED</span>
          <span>60%</span>
        </div>
      </div>

      <div className="bg-[#060806] border border-[rgba(107,138,64,0.25)] rounded p-3 text-[10px] sm:text-[11px] leading-relaxed overflow-x-auto">
        <div className="vvu-label text-[9px] text-[#7a8a6e] tabular-nums">
          OPERATING CONTRIBUTION = (MRR − INFRA − THERMAL PENALTY) × (1 − CHURN)
        </div>
        <div className="text-[#c9d4bd] mt-1.5 whitespace-nowrap">
          = ({fmtRand(base.mrr)} − {fmtRand(base.infraCost)} − <span className="text-[#7a8a6e]">R0 THERMAL</span>) × (1 −{' '}
          {(churn / 100).toFixed(2)}) ={' '}
          <b className={fail ? 'text-[#e5484d]' : 'text-[#c8ff00]'}>{fmtRand(contribution)}</b>
          <span className="text-[#7a8a6e]"> /mo</span>
        </div>
      </div>

      {fail && (
        <div
          className="mt-3 p-3 rounded border flex items-start gap-2"
          style={{ borderColor: 'rgba(229,72,77,0.5)', background: 'rgba(229,72,77,0.06)' }}
          role="alert"
        >
          <AlertTriangle className="size-4 text-[#e5484d] shrink-0 mt-0.5" aria-hidden />
          <div>
            <div className="vvu-label text-[10px] font-bold text-[#e5484d]">FAIL_CLOSED · SCENARIO III</div>
            <p className="text-[10px] text-[#e5484d]/85 mt-1 leading-relaxed">
              Stop shipping data, preserve the Trust, prevent a POPIA breach. Churn above 40% collapses the automaton.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function FinancialScenarios({ num }: { num?: string }) {
  return (
    <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="financial scenarios">
      <SectionHeader
        num={num}
        title="FINANCIAL SCENARIOS"
        kicker="APPENDIX G · CHAPTER 5 · CONTRIBUTION MATH"
        right={<Chip tone="sage">10× ARR VALUATION</Chip>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* left: contribution bar chart */}
        <div className="vvu-panel-solid p-3.5 min-w-0">
          <div className="vvu-label text-[9px] text-[#7a8a6e] mb-3">OPERATING CONTRIBUTION PER SCENARIO (R/mo)</div>
          <div className="h-[220px] w-full" role="img" aria-label="bar chart of operating contribution per scenario: baseline R32,000, HBK MK-II R46,250, downside R0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(107,138,64,0.12)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#7a8a6e', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(107,138,64,0.3)' }}
                  tickLine={false}
                  dy={6}
                />
                <YAxis
                  tick={{ fill: '#7a8a6e', fontSize: 10 }}
                  tickFormatter={(value: number) => `R${(value / 1000).toFixed(0)}k`}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip content={<ScenarioTooltip />} cursor={{ fill: 'rgba(107,138,64,0.07)' }} />
                <Bar dataKey="contribution" radius={[3, 3, 0, 0]} maxBarSize={64} isAnimationActive>
                  {chartData.map((row) => (
                    <Cell key={row.id} fill={BAR_COLORS[row.id] ?? '#8fb35a'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* right: comparison table */}
        <div className="overflow-x-auto -mx-1 px-1 min-w-0">
          <Table className="text-[11px]">
            <TableHeader>
              <TableRow className="border-[rgba(107,138,64,0.25)] hover:bg-transparent">
                <TableHead className="vvu-label text-[9px] text-[#7a8a6e] py-2">SCENARIO</TableHead>
                <TableHead className="vvu-label text-[9px] text-[#7a8a6e] py-2 text-right">MRR</TableHead>
                <TableHead className="vvu-label text-[9px] text-[#7a8a6e] py-2 text-right">INFRA COST</TableHead>
                <TableHead className="vvu-label text-[9px] text-[#7a8a6e] py-2 text-right">CONTRIBUTION</TableHead>
                <TableHead className="vvu-label text-[9px] text-[#7a8a6e] py-2 text-right">VALUATION</TableHead>
                <TableHead className="vvu-label text-[9px] text-[#7a8a6e] py-2">STATE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SCENARIOS.map((s, i) => (
                <TableRow
                  key={s.id}
                  className={cn(
                    'border-[rgba(107,138,64,0.15)] hover:bg-[rgba(107,138,64,0.09)]',
                    s.id === 'hbk' && 'bg-[#6b8a40]/10 border-[rgba(107,138,64,0.35)]',
                    i % 2 === 1 && s.id !== 'hbk' && 'bg-[rgba(107,138,64,0.05)]'
                  )}
                >
                  <TableCell className="py-2.5 align-top">
                    <div className="text-[#c9d4bd] font-semibold whitespace-nowrap">{SHORT_NAMES[s.id] ?? s.name}</div>
                    <div className="text-[9px] text-[#7a8a6e] max-w-[280px] leading-snug mt-0.5 normal-case">{s.note}</div>
                  </TableCell>
                  <TableCell className="py-2.5 align-top text-right tabular-nums text-[#c9d4bd]">{fmtRand(s.mrr)}</TableCell>
                  <TableCell className="py-2.5 align-top text-right tabular-nums text-[#7a8a6e]">−{fmtRand(s.infraCost)}</TableCell>
                  <TableCell
                    className={cn(
                      'py-2.5 align-top text-right tabular-nums font-bold',
                      s.state === 'FAIL_CLOSED' ? 'text-[#e5484d]' : 'text-[#c8ff00]'
                    )}
                  >
                    {fmtRand(s.contribution)}
                  </TableCell>
                  <TableCell className="py-2.5 align-top text-right tabular-nums text-[#f3e38a]">{fmtRand(s.valuation)}</TableCell>
                  <TableCell className="py-2.5 align-top">
                    <StateChip state={s.state} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="mt-4">
        <ChurnLab />
      </div>
    </section>
  );
}

export default FinancialScenarios;
