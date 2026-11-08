'use client';

// src/components/icsh/CityTwin.tsx — 14:32 CITY TWIN · local ingestion & physics.
// Every figure is the REAL last cycle from the ledger (IcshCycle.line carries
// the sensor frame + inferred state). No cycle yet → the honest empty state.

import type { IcshStatus } from '@/lib/icsh/types';
import { ICSH_BEATS } from '@/lib/icsh/contract';
import { cn } from '@/lib/utils';
import { Chip, Empty, KV, Panel, head8 } from './parts';

const BEAT_NOTES: Record<string, string> = {
  INGEST: 'sensor frame → estate telemetry',
  INFER: 'closed-form physics: sensors → state',
  LOG: 'beat log line (this cycle only)',
  SYNC: '32-byte gossip across 25 peers',
  COMPARE: 'quorum ≥ 18 of 25',
  FOLD: 'district head = sha256(peer heads)',
  MINT: 'markdown neural node → vault',
  SHIP: 'WORM envelope seal (anchor per run)',
  WIPE: 'working memory → 32 bytes flat',
  RETRIEVE: 'ledger-as-storage read-back check',
  WATCHDOG: 'per-cycle time budget guard',
};

function SensorCard({ label, value, unit, pct, warn }: { label: string; value: string; unit: string; pct: number; warn?: boolean }) {
  return (
    <div className={cn('border bg-[#060b08] p-3', warn ? 'border-[#4d4418]' : 'border-[#16241a]')}>
      <p className="text-[8px] tracking-[0.26em] text-[#5f7f68]">{label}</p>
      <p className={cn('mt-1.5 text-[19px] font-black tabular-nums leading-none', warn ? 'text-[#f3e38a] icsh-glow' : 'text-[#7dffa8] icsh-glow')}>
        {value}
        <span className="ml-1 text-[9px] font-normal text-[#5f7f68]">{unit}</span>
      </p>
      <div className="mt-2 h-1 w-full bg-[#0d1810]">
        <div className={cn('h-full', warn ? 'bg-[#f3e38a]' : 'bg-[#3d8f5f]')} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}

const STATE_TONE: Record<string, string> = {
  NOMINAL: 'border-[#1d4d2c] bg-[#04100a] text-[#7dffa8]',
  PRESSURE_DROP: 'border-[#4d4418] bg-[#0f0d04] text-[#f3e38a]',
  LOW_FLOW: 'border-[#4d4418] bg-[#0f0d04] text-[#f3e38a]',
  TURBIDITY_ALERT: 'border-[#4d2018] bg-[#100604] text-[#ff7a6e]',
};

export function CityTwinSurface({ status }: { status: IcshStatus | null }) {
  const lc = status?.lastCycle ?? null;

  if (!status || !lc) {
    return (
      <div className="space-y-4">
        <Empty
          lines={[
            'INSUFFICIENT DATA — THE TWIN HAS NO CYCLES YET',
            'run the 11-beat loop on the COST MATRIX surface (14:38) — physics lands here per cycle',
          ]}
        />
        <Panel title="THE 11 BEATS (ARMED)">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {ICSH_BEATS.map((b, i) => (
              <div key={b} className="flex items-baseline gap-2 border-b border-dashed border-[#142019] py-1.5">
                <span className="text-[8px] text-[#3f5748] tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[10px] font-bold tracking-[0.18em] text-[#7dffa8]">{b}</span>
                <span className="ml-auto text-[8px] text-[#5f7f68]">{BEAT_NOTES[b]}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  const s = lc.sensors;
  const state = lc.state;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip label="VIEWPORT" value={lc.viewport} tone="lime" />
        <span className={cn('border px-2.5 py-1 text-[10px] font-black tracking-[0.24em]', STATE_TONE[state] ?? STATE_TONE.NOMINAL)}>
          {state}
        </span>
        <Chip label="CYCLE" value={`#${lc.cycle.toLocaleString()}`} />
        <Chip label="HEAD" value={head8(lc.head)} />
        <Chip label="CYCLE TIME" value={`${lc.durationMs.toFixed(3)} ms`} tone="amber" />
        <Chip label="DISTRICT HEAD" value={head8(lc.districtHead)} className="hidden md:flex" />
      </div>

      {s ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <SensorCard label="PRESSURE" value={s.pressureBar.toFixed(2)} unit="bar" pct={((s.pressureBar - 2.3) / 0.9) * 100} warn={state === 'PRESSURE_DROP'} />
          <SensorCard label="FLOW" value={s.flowLps.toFixed(1)} unit="L/s" pct={((s.flowLps - 10) / 10) * 100} warn={state === 'LOW_FLOW'} />
          <SensorCard label="PH" value={s.ph.toFixed(1)} unit="pH" pct={((s.ph - 6.5) / 1.2) * 100} />
          <SensorCard label="TURBIDITY" value={s.turbidityNtu.toFixed(1)} unit="NTU" pct={(s.turbidityNtu / 1.8) * 100} warn={state === 'TURBIDITY_ALERT'} />
          <SensorCard label="STORAGE LEVEL" value={String(s.levelPct)} unit="%" pct={s.levelPct} />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* pipe schematic — Forest Hill estate */}
        <Panel title="FOREST HILL ESTATE · PIPE SCHEMATIC" className="lg:col-span-3">
          <svg viewBox="0 0 520 190" className="w-full" role="img" aria-label="estate pipe schematic">
            {/* pipes */}
            <line x1="40" y1="95" x2="480" y2="95" stroke="#1d3325" strokeWidth="6" />
            <line x1="40" y1="95" x2="480" y2="95" stroke={state === 'NOMINAL' ? '#3d8f5f' : '#8f7f3d'} strokeWidth="2" className="icsh-flow" />
            {[
              { x: 60, label: 'INTAKE' },
              { x: 170, label: 'TREATMENT' },
              { x: 300, label: 'STORAGE' },
              { x: 430, label: 'ESTATE GRID' },
            ].map((n) => (
              <g key={n.label}>
                <rect x={n.x - 8} y={72} width="16" height="46" fill="#060b08" stroke="#3d5c47" strokeWidth="1.5" />
                <circle cx={n.x} cy={95} r="4" fill="#7dffa8" className="icsh-blink" />
                <text x={n.x} y={140} textAnchor="middle" fontSize="8" fill="#5f7f68" letterSpacing="2" fontFamily="monospace">
                  {n.label}
                </text>
              </g>
            ))}
            {/* sensor taps */}
            {[100, 230, 360, 470].map((x) => (
              <g key={x}>
                <line x1={x} y1={95} x2={x} y2={48} stroke="#2c4433" strokeWidth="1" />
                <circle cx={x} cy={44} r="3.5" fill="none" stroke="#7dffa8" strokeWidth="1.2" />
                <text x={x} y={32} textAnchor="middle" fontSize="7" fill="#3f5748" fontFamily="monospace">S{x}</text>
              </g>
            ))}
            <text x="20" y="20" fontSize="8" fill="#3f5748" fontFamily="monospace" letterSpacing="2">
              14:32 · LOCAL PHYSICS · INGEST → INFER
            </text>
            <text x="500" y="20" textAnchor="end" fontSize="8" fill="#7dffa8" fontFamily="monospace">
              {state}
            </text>
          </svg>
        </Panel>

        <Panel title="LAST CYCLE · KEYLINE" className="lg:col-span-2">
          <KV k="CYCLE" v={`#${lc.cycle.toLocaleString()}`} />
          <KV k="VIEWPORT" v={lc.viewport} />
          <KV k="STATE (INFER)" v={state} tone={state === 'NOMINAL' ? 'text-[#7dffa8]' : 'text-[#f3e38a]'} />
          <KV k="PEERS REACHABLE" v={`${lc.peersReachable}/25`} />
          <KV
            k="AGREEMENT"
            v={lc.agreement ? 'QUORUM HELD' : `DRIFT · ${lc.divergentPeers} DIVERGENT`}
            tone={lc.agreement ? 'text-[#7dffa8]' : 'text-[#ff7a6e]'}
          />
          <KV k="ORBIT HEAD" v={head8(lc.head)} />
          <KV k="LEDGER LINES" v={status.cycles.toLocaleString()} tone="text-[#c8ff00]" />
          <KV k="SEEN" v={new Date(lc.at).toLocaleTimeString('en-ZA')} />
        </Panel>
      </div>

      <Panel title="THE 11 BEATS (EVERY CYCLE, IN ORDER)">
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {ICSH_BEATS.map((b, i) => (
            <div key={b} className="flex items-baseline gap-2 border-b border-dashed border-[#142019] py-1.5">
              <span className="text-[8px] tabular-nums text-[#3f5748]">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-[10px] font-bold tracking-[0.18em] text-[#7dffa8]">{b}</span>
              <span className="ml-auto text-[8px] text-[#5f7f68]">{BEAT_NOTES[b]}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
