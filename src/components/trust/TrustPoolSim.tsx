'use client';

// src/components/trust/TrustPoolSim.tsx — Task 37-5a. The stokvel pool
// simulator: an interactive working of the pitch's business model
// ("pools R1,000 each — ten neighbours, ten thousand rand") and the terms'
// mechanics (§2 shares, §4 hardship deferral, §5 idle earnings, §6 pro-rata
// exit). Deterministic client-side math via projectPool() in trust-data.ts.
// Every figure the operator does not set is labelled; the only two anchors
// taken from the source docs are R1,000/member and the R10,000 machine.
// ILLUSTRATIVE — NOT FINANCIAL ADVICE.

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BadgeIndianRupee, Coins, HandCoins, Hourglass, Landmark, Scale, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { TRUST_POOL_DEFAULTS, projectPool } from '@/lib/trust-data';

const fmt = (n: number) => `R${Math.round(n).toLocaleString('en-US')}`;

interface Props {
  onReceipt?: () => void;
}

export function TrustPoolSim({ onReceipt }: Props) {
  const [members, setMembers] = useState<number>(TRUST_POOL_DEFAULTS.members);
  const [contribution, setContribution] = useState<number>(TRUST_POOL_DEFAULTS.contribution);
  const [machineCost, setMachineCost] = useState<number>(TRUST_POOL_DEFAULTS.machineCost);
  const [fee, setFee] = useState<number>(TRUST_POOL_DEFAULTS.orchestrationFee);
  const [idleRate, setIdleRate] = useState<number>(TRUST_POOL_DEFAULTS.idleRate);
  const [idleHours, setIdleHours] = useState<number>(TRUST_POOL_DEFAULTS.idleHoursPerDay);
  const [idleDays, setIdleDays] = useState<number>(TRUST_POOL_DEFAULTS.idleDaysPerMonth);
  const [upkeep, setUpkeep] = useState<number>(TRUST_POOL_DEFAULTS.upkeepPerMonth);
  const [deferred, setDeferred] = useState<number>(0);
  const [recording, setRecording] = useState(false);

  const r = useMemo(
    () =>
      projectPool({
        members,
        contribution,
        machineCost,
        orchestrationFee: fee,
        idleRate,
        idleHoursPerDay: idleHours,
        idleDaysPerMonth: idleDays,
        upkeepPerMonth: upkeep,
        horizonMonths: 12,
        deferredMembers: deferred,
      }),
    [members, contribution, machineCost, fee, idleRate, idleHours, idleDays, upkeep, deferred]
  );

  const record = () => {
    setRecording(true);
    const summary = `pool ${fmt(r.poolCollected)} of ${fmt(r.poolTotalIfAllPaid)} · ${members} members × ${fmt(contribution)} · machine ${fmt(machineCost)}${fee ? ` + fee ${fmt(fee)}` : ''} · surplus ${fmt(r.surplus)} · idle ${fmt(r.idleIncomePerMonth)}/mo net ${fmt(r.netGrowthPerMonth)}/mo · break-even ${r.breakEvenMonths ?? '—'} mo · deferrals ${deferred}`;
    fetch('/api/vvu/trust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'SIM_RECORDED', payload: { summary } }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('bad status'))))
      .then(() => {
        toast.success('SIMULATION RECORDED', {
          description: 'TRUST_SIM_RECORDED receipt appended to the WORM ledger',
        });
        onReceipt?.();
      })
      .catch(() => {
        toast.error('RECORD FAILED', { description: 'Could not reach /api/vvu/trust' });
      })
      .finally(() => setRecording(false));
  };

  const shortfallActive = deferred > 0;

  return (
    <div className="space-y-3">
      {/* disclosure */}
      <div className="rounded-md border border-[rgba(200,255,0,0.25)] bg-[rgba(200,255,0,0.04)] p-2.5">
        <p className="text-[10px] leading-relaxed text-[#9aa88c]">
          <b className="text-[#c8ff00]">ILLUSTRATIVE — NOT FINANCIAL ADVICE.</b> Only two anchors
          come from the source docs: R1,000 per member and the R10,000 machine ask. Every other
          figure is yours to set. Share math follows terms §2, hardship §4, idle earnings §5,
          pro-rata exit §6 (stokvel_terms_v0.md).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi icon={<Users className="h-3.5 w-3.5" />} label="Pool collected" value={fmt(r.poolCollected)} sub={`${r.payingMembers} paying members`} />
        <Kpi icon={<Landmark className="h-3.5 w-3.5" />} label="Upfront cost" value={fmt(r.upfrontCost)} sub={`machine ${fmt(machineCost)}${fee ? ' + fee' : ''}`} />
        <Kpi
          icon={<Coins className="h-3.5 w-3.5" />}
          label={r.surplus >= 0 ? 'Surplus day one' : 'Funding gap'}
          value={fmt(Math.abs(r.surplus))}
          sub={r.surplus >= 0 ? 'left in pool after purchase' : 'gap to close before purchase'}
          tone={r.surplus >= 0 ? 'good' : 'bad'}
        />
        <Kpi icon={<Scale className="h-3.5 w-3.5" />} label="Member share" value={`${r.sharePct.toFixed(1)}%`} sub="each · equal shares (§2)" />
        <Kpi icon={<Hourglass className="h-3.5 w-3.5" />} label="Idle income" value={`${fmt(r.idleIncomePerMonth)}/mo`} sub={`${idleHours}h × ${idleDays}d × ${fmt(idleRate)}/h`} />
        <Kpi
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Net pool growth"
          value={`${fmt(r.netGrowthPerMonth)}/mo`}
          sub={`after upkeep ${fmt(upkeep)}`}
          tone={r.netGrowthPerMonth >= 0 ? 'good' : 'bad'}
        />
        <Kpi
          icon={<HandCoins className="h-3.5 w-3.5" />}
          label="Break-even"
          value={r.breakEvenMonths === null ? 'never' : r.breakEvenMonths === 0 ? 'day one' : `${r.breakEvenMonths} mo`}
          sub="idle income covers the gap"
          tone={r.breakEvenMonths === null ? 'bad' : 'good'}
        />
        <Kpi icon={<BadgeIndianRupee className="h-3.5 w-3.5" />} label="Pro-rata exit (12 mo)" value={fmt(r.proRataExit)} sub="one member, after 12 months (§6)" />
      </div>

      {/* 12-month projection */}
      <div className="rounded-md border border-[#213040] bg-[#08131c] p-3">
        <div className="flex items-center justify-between">
          <b className="vvu-label text-[8px] text-[#7f95a5]">Pool value · 12-month projection</b>
          <span className="font-mono text-[9px] text-[#7f95a5]">
            start {fmt(r.surplus)} → month 12 {fmt(r.months[r.months.length - 1]?.poolValue ?? r.surplus)}
          </span>
        </div>
        <div className="mt-2 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={r.months} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="trustPoolFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c8ff00" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#c8ff00" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#152430" strokeDasharray="2 4" />
              <XAxis dataKey="month" tick={{ fill: '#7f95a5', fontSize: 9 }} stroke="#213040" />
              <YAxis tick={{ fill: '#7f95a5', fontSize: 9 }} stroke="#213040" tickFormatter={(v: number) => `R${(v / 1000).toFixed(0)}k`} width={38} />
              <Tooltip
                contentStyle={{ background: '#050c13', border: '1px solid #214050', borderRadius: 6, fontSize: 10 }}
                labelStyle={{ color: '#7f95a5' }}
                formatter={(v) => [fmt(Number(v ?? 0)), 'pool value']}
                labelFormatter={(l) => `month ${l}`}
              />
              <Area type="monotone" dataKey="poolValue" stroke="#c8ff00" strokeWidth={2} fill="url(#trustPoolFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* hardship deferral */}
      <div className={`rounded-md border p-3 ${shortfallActive ? 'border-[rgba(255,179,0,0.4)] bg-[rgba(255,179,0,0.04)]' : 'border-[#213040] bg-[#08131c]'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <b className="vvu-label text-[8px] text-[#7f95a5]">Hardship deferral vote (terms §4)</b>
          <span className="text-[9px] text-[#7f95a5]">
            {deferred} of {members} members deferred · deferral is not a penalty
          </span>
        </div>
        <Slider
          value={[deferred]}
          min={0}
          max={Math.max(0, members - 1)}
          step={1}
          onValueChange={(v) => setDeferred(v[0] ?? 0)}
          aria-label="Deferred members"
          className="mt-3"
        />
        {shortfallActive && (
          <div className="mt-2 grid grid-cols-1 gap-2 text-[10px] sm:grid-cols-3">
            <div className="rounded-sm border border-[#2a3a46] bg-[#0b141c] p-2">
              <div className="text-[#7f95a5]">Shortfall this season</div>
              <div className="font-mono text-[12px] font-bold text-[#ffb300]">{fmt(r.shortfall)}</div>
            </div>
            <div className="rounded-sm border border-[#2a3a46] bg-[#0b141c] p-2">
              <div className="text-[#7f95a5]">Top-up per paying member</div>
              <div className="font-mono text-[12px] font-bold text-[#e8f0d8]">{fmt(r.perMemberTopUp)}</div>
            </div>
            <div className="rounded-sm border border-[#2a3a46] bg-[#0b141c] p-2">
              <div className="text-[#7f95a5]">Deferred members keep</div>
              <div className="font-mono text-[12px] font-bold text-[#e8f0d8]">{r.sharePct.toFixed(1)}% share</div>
            </div>
          </div>
        )}
      </div>

      {/* inputs */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-md border border-[#213040] bg-[#08131c] p-3">
          <b className="vvu-label text-[8px] text-[#7f95a5]">The pool (pitch anchors)</b>
          <SliderRow label="Members" value={members} min={4} max={20} step={1} onChange={setMembers} display={`${members}`} />
          <SliderRow label="Contribution per member" value={contribution} min={250} max={5000} step={50} onChange={setContribution} display={fmt(contribution)} hint="source doc anchor: R1,000" />
          <SliderRow label="Machine cost" value={machineCost} min={5000} max={25000} step={500} onChange={setMachineCost} display={fmt(machineCost)} hint="source doc anchor: R10,000" />
          <SliderRow label="Orchestration fee (paid once)" value={fee} min={0} max={5000} step={100} onChange={setFee} display={fmt(fee)} hint="no figure published — set yours" />
        </div>
        <div className="rounded-md border border-[#213040] bg-[#08131c] p-3">
          <b className="vvu-label text-[8px] text-[#7f95a5]">Idle capacity (terms §5)</b>
          <SliderRow label="Rental rate" value={idleRate} min={0} max={30} step={1} onChange={setIdleRate} display={`${fmt(idleRate)}/h`} hint="illustrative" />
          <SliderRow label="Quiet hours per day" value={idleHours} min={0} max={16} step={1} onChange={setIdleHours} display={`${idleHours} h`} hint="e.g. 22:00–06:00" />
          <SliderRow label="Days per month" value={idleDays} min={0} max={30} step={1} onChange={setIdleDays} display={`${idleDays} d`} />
          <SliderRow label="Upkeep per month" value={upkeep} min={0} max={1000} step={20} onChange={setUpkeep} display={fmt(upkeep)} hint="electricity + airtime reserve" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#213040] bg-[#08131c] p-3">
        <p className="text-[10px] text-[#7f95a5]">
          Recording writes a deterministic summary of these exact figures as a WORM receipt.
        </p>
        <Button
          type="button"
          onClick={record}
          disabled={recording}
          className="h-11 border border-[#c8ff00] bg-[#c8ff00] px-4 text-[10px] font-bold text-black hover:bg-[#d9ff4d] active:scale-[0.98]"
        >
          {recording ? 'RECORDING…' : 'RECORD SIMULATION → WORM'}
        </Button>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: 'good' | 'bad';
}) {
  return (
    <div className="min-w-0 rounded-md border border-[#213040] bg-[#08131c] p-2.5">
      <div className="flex items-center gap-1.5 text-[#7f95a5]">
        {icon}
        <span className="vvu-label truncate text-[7.5px]">{label}</span>
      </div>
      <div
        className={`mt-1 font-mono text-[15px] font-bold leading-none ${
          tone === 'good' ? 'text-[#c8ff00]' : tone === 'bad' ? 'text-[#ff5d5d]' : 'text-[#e8f0d8]'
        }`}
      >
        {value}
      </div>
      <div className="mt-1 truncate text-[9px] text-[#7f95a5]" title={sub}>
        {sub}
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
  hint?: string;
}) {
  return (
    <div className="mt-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[10px] text-[#c4d2dc]">{label}</label>
        <span className="font-mono text-[11px] font-bold text-[#e8f0d8]">{display}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0] ?? value)}
        aria-label={label}
        className="mt-1.5"
      />
      {hint && <div className="mt-0.5 text-[8.5px] text-[#5d7061]">{hint}</div>}
    </div>
  );
}
