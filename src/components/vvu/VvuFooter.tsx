'use client';

// src/components/vvu/VvuFooter.tsx — sticky bottom bar (Appendix K.3).
// Live FSM · WORM chain-tip hash · steady hours · MOI chips on the right;
// identity + compliance line on the left. Chips share the header's bordered
// SCADA style so the top and bottom chrome read as one system.

import { useFsmState, useFrame, useWormChain, useConnected } from '@/hooks/use-vvu-socket';
import { FOOTER, MOI } from '@/lib/vvu-data';

export function VvuFooter() {
  const fsm = useFsmState();
  const frame = useFrame();
  const worm = useWormChain();
  const connected = useConnected();
  const customers = frame?.metrics.customers ?? 0;
  const steadyHours = frame?.metrics.steadyStateHours ?? null;

  // Chain tip = newest in-memory WORM event hash (first 10 hex chars).
  const tip = worm.length ? worm[worm.length - 1].hash.slice(0, 10) : null;
  const tipSeq = worm.length ? worm[worm.length - 1].seq : null;

  return (
    <footer className="relative z-30 mt-auto border-t border-[rgba(107,138,64,0.25)] bg-[rgba(6,8,6,0.96)] backdrop-blur-sm overflow-hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-4 px-3 sm:px-4 py-1.5 sm:py-2 min-w-0">
        {/* identity + shortcut help trigger ("?" keycap — touch entry point).
            The text block bottom-aligns against the 44px button on phones so
            the fixed lime route toggle (right, bottom 4.75rem) clears it. */}
        <div className="flex items-end gap-2 min-w-0 max-w-full w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              // ShortcutHelp (src/components/vvu/ShortcutHelp.tsx) listens for
              // this event — the reliable entry point on touch devices.
              window.dispatchEvent(new Event('vvu:open-shortcuts'));
            }}
            aria-label="Open keyboard shortcut help"
            title="Keyboard shortcuts (?)"
            className="shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] rounded-sm border border-[rgba(243,227,138,0.3)] bg-[rgba(243,227,138,0.05)] hover:bg-[rgba(243,227,138,0.12)] hover:border-[rgba(243,227,138,0.55)] active:scale-[0.96] transition-all select-none"
          >
            <span className="vvu-kbd" aria-hidden>
              ?
            </span>
          </button>
          <div className="min-w-0 overflow-hidden">
            <div className="vvu-label text-[9px] text-[#8fb35a] truncate">{FOOTER.line1}</div>
            <div className="vvu-label text-[8px] text-[#7a8a6e] truncate">
              {FOOTER.founder} · {FOOTER.contact} · {FOOTER.copyright}
            </div>
          </div>
        </div>
        <div className="vvu-label text-[8px] sm:text-[8.5px] flex flex-wrap items-center gap-1.5 sm:gap-2 justify-start sm:justify-end min-w-0 max-w-full">
          <span className="px-1.5 py-0.5 rounded-sm border border-[rgba(107,138,64,0.25)] truncate max-w-[11rem] sm:max-w-none">
            <span className="text-[#7a8a6e]">FSM:</span> <span className="text-[#f3e38a]">{fsm ?? '—'}</span>
          </span>
          <span
            className={`px-1.5 py-0.5 rounded-sm border tabular-nums ${
              connected
                ? 'border-[rgba(200,255,0,0.3)] text-[#c8ff00]'
                : 'border-[rgba(229,72,77,0.45)] text-[#e5484d]'
            }`}
            title="In-memory WORM chain — events buffered this session"
          >
            WORM {tipSeq !== null ? `#${tipSeq}` : '—'}
          </span>
          {tip && (
            <span
              className="px-1.5 py-0.5 rounded-sm border border-[rgba(107,138,64,0.25)] tabular-nums truncate max-w-[9rem]"
              title={`Chain tip SHA-256 (seq ${tipSeq}) — append-only, no overwrite, no delete`}
            >
              <span className="text-[#7a8a6e]">SHA</span> <span className="text-[#8fb35a]">{tip}</span>
            </span>
          )}
          {steadyHours !== null && (
            <span
              className="px-1.5 py-0.5 rounded-sm border border-[rgba(46,168,160,0.3)] text-[#2ea8a0] tabular-nums hidden xs:inline"
              title="Steady-state accrual — Gate 3C condition ≥72h"
            >
              {steadyHours.toFixed(1)}h
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded-sm border border-[rgba(200,255,0,0.25)] truncate">
            <span className="text-[#7a8a6e]">MOI:</span> <span className="text-[#c8ff00]">{MOI.terminalPct}%</span>
          </span>
          <span className="px-1.5 py-0.5 rounded-sm border border-[rgba(107,138,64,0.25)] hidden md:inline">
            <span className="text-[#7a8a6e]">NODES:</span> <span className="text-[#8fb35a]">{customers} cust</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
