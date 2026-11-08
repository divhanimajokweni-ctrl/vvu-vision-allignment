'use client';

// src/components/analytics/RoadmapDfa.tsx — 5-Gate DFA roadmap (Chapter 4):
// Gate 0–1 FSA → Gate 2–3 PDA → Gate 4 LBA → Gate 5 TM as a connected
// timeline (horizontal on desktop, vertical on mobile) with automaton chips
// and state chips (CERTIFIED / IN_PROGRESS / PENDING).

import { ROADMAP_GATES } from '@/lib/vvu-data';
import { cn } from '@/lib/utils';
import { Chip, SectionHeader } from './shared';

const AUTOMATON_CLASS: Record<string, string> = {
  FSA: 'border-[#8fb35a]/50 text-[#8fb35a]',
  PDA: 'border-[#f3e38a]/50 text-[#f3e38a]',
  LBA: 'border-[#2ea8a0]/50 text-[#2ea8a0]',
  TM: 'border-[#c8ff00]/50 text-[#c8ff00]',
};

const AUTOMATON_DOT: Record<string, string> = {
  FSA: '#8fb35a',
  PDA: '#f3e38a',
  LBA: '#2ea8a0',
  TM: '#c8ff00',
};

const STATE_CLASS: Record<string, string> = {
  CERTIFIED: 'bg-[#c8ff00] text-[#060806] border-[#c8ff00]',
  IN_PROGRESS: 'border-[#e0a030]/60 text-[#e0a030] animate-pulse',
  PENDING: 'border-[rgba(107,138,64,0.35)] text-[#7a8a6e]',
};

function automatonClass(automaton: string): string {
  return AUTOMATON_CLASS[automaton] ?? 'border-[rgba(107,138,64,0.35)] text-[#7a8a6e]';
}

function automatonDot(automaton: string): string {
  return AUTOMATON_DOT[automaton] ?? '#7a8a6e';
}

function stateClass(state: string): string {
  return STATE_CLASS[state] ?? STATE_CLASS.PENDING;
}

export function RoadmapDfa({ num }: { num?: string }) {
  return (
    <section className="vvu-panel vvu-enter p-4 sm:p-5" aria-label="5-Gate DFA roadmap">
      <SectionHeader
        num={num}
        title="5-GATE ROADMAP DFA"
        kicker="CHAPTER 4 · FSA → PDA → LBA → TM"
        right={<Chip tone="ochre">δ: CERTIFICATION ARTIFACTS</Chip>}
      />

      <div className="relative grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-5">
        {/* horizontal connector (desktop) */}
        <div
          aria-hidden
          className="hidden md:block absolute top-[6px] left-1 right-1 h-[2px]"
          style={{ background: 'linear-gradient(90deg, rgba(143,179,90,0.55), rgba(243,227,138,0.4), rgba(46,168,160,0.4), rgba(200,255,0,0.5))' }}
        />
        {/* vertical connector (mobile) */}
        <div
          aria-hidden
          className="md:hidden absolute left-[6px] top-2 bottom-2 w-[2px]"
          style={{ background: 'linear-gradient(180deg, rgba(143,179,90,0.55), rgba(200,255,0,0.5))' }}
        />

        {ROADMAP_GATES.map((g) => {
          const dotColor = automatonDot(g.automaton);
          const certified = g.state === 'CERTIFIED';
          return (
            <div key={g.gate} className="relative pl-7 md:pl-0">
              <span
                aria-hidden
                className={cn(
                  'absolute left-0 top-0.5 md:static md:top-auto md:mb-2.5 block w-3.5 h-3.5 rounded-full border-2',
                  g.state === 'IN_PROGRESS' && 'animate-pulse'
                )}
                style={{ borderColor: dotColor, background: certified ? dotColor : '#060806' }}
              />
              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                <span className={cn('vvu-label text-[9px] font-bold px-2 py-0.5 rounded border', automatonClass(g.automaton))}>
                  {g.automaton}
                </span>
                <span className="vvu-label text-[9px] text-[#7a8a6e]">{g.gate}</span>
              </div>
              <h3 className="text-[13px] font-bold text-[#c9d4bd] mb-1.5">{g.title}</h3>
              <span className={cn('vvu-label text-[8px] font-bold px-2 py-0.5 rounded border inline-block mb-1.5', stateClass(g.state))}>
                {g.state}
              </span>
              <p className="text-[10px] text-[#7a8a6e] leading-relaxed">{g.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-3 border-t border-[rgba(107,138,64,0.25)]">
        <p className="vvu-label text-[8px] sm:text-[9px] text-[#7a8a6e] leading-relaxed break-words">
          {
            'Q = {DISCONNECTED → PAIRING_BLE → TOTP_VERIFICATION → STEADY_STATE_LOCKED → LEAK_ACTIVE → THERMAL_THROTTLE → FAIL_CLOSED} · δ REQUIRES CERTIFICATION ARTIFACT'
          }
        </p>
      </div>
    </section>
  );
}

export default RoadmapDfa;
