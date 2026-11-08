'use client';

// src/components/spatial/FsmPanel.tsx — collapsible bottom-left FSM console.
// Collapsed: small FSM chip. Expanded: state chip, symbol command buttons,
// transition log (newest first), condensed FSM_TRANSITIONS table.

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { FSM_TRANSITIONS } from '@/lib/vvu-data';
import {
  useFsmLog,
  useFsmState,
  useSendFsmCommand,
  useVvuSocketStore,
} from '@/hooks/use-vvu-socket';
import type { FsmSymbol } from '@/types/vvu';
import { FSM_SYMBOLS, SYMBOL_COLOR, fsmColor } from './spatial-style';

function SymbolButton({ symbol, onSend }: { symbol: FsmSymbol; onSend: (s: FsmSymbol) => void }) {
  const color = SYMBOL_COLOR[symbol];
  return (
    <button
      type="button"
      onClick={() => onSend(symbol)}
      className="vvu-label h-11 min-h-11 px-1 rounded-sm border bg-[rgba(11,15,10,0.85)] text-[8.5px] sm:text-[9.5px] font-bold transition-all hover:brightness-125 active:scale-[0.96] select-none"
      style={{ color, borderColor: `${color}55`, background: `${color}10` }}
      aria-label={`Send FSM symbol ${symbol}`}
      title={`Emit symbol σ = ${symbol}`}
    >
      {symbol}
    </button>
  );
}

export function FsmPanel() {
  const [open, setOpen] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const fsm = useFsmState();
  const log = useFsmLog();
  const sendFsmCommand = useSendFsmCommand();
  const fsmError = useVvuSocketStore((s) => s.fsmError);

  // Broadcast expand/collapse so the mobile HUD (HudOverlay) can fade the
  // bottom gauges strip + FSM banner out from behind this console. Same
  // 'vvu:' window-event pattern as 'vvu:open-palette' / 'vvu:set-projection'.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('vvu:fsm-console', { detail: open }));
  }, [open]);

  // Surface FSM service errors as toasts (store clears them on next frame).
  // Stable id 'fsm-rejected' (shared with the palette's analytics mirror) so
  // rapid guard rejections REPLACE this toast instead of stacking a flood.
  useEffect(() => {
    if (fsmError) toast.error('FSM REJECTED', { id: 'fsm-rejected', description: fsmError });
  }, [fsmError]);

  const stateCol = fsmColor(fsm);
  const entries = [...log].slice(-14).reverse();

  const handleSend = (symbol: FsmSymbol) => {
    sendFsmCommand(symbol);
    // Stable id 'fsm-emit' — rapid σ button mashing replaces the toast
    // (content updates + timer resets) instead of stacking a queue flood.
    toast(`σ ${symbol} EMITTED`, {
      id: 'fsm-emit',
      description: 'Edge FSM command dispatched over socket',
    });
  };

  return (
    <div className="absolute left-2 sm:left-3 bottom-9 z-30 vvu-enter">
      <AnimatePresence mode="wait" initial={false}>
        {!open ? (
          <motion.button
            key="chip"
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(true)}
            className="vvu-panel-solid backdrop-blur-sm flex items-center gap-2 h-11 px-3 vvu-label text-[8px] sm:text-[9px] font-bold"
            aria-label="Open FSM control panel"
            aria-expanded={open}
          >
            <span style={{ color: stateCol }}>◈ FSM</span>
            <span className="text-[#7a8a6e] hidden xs:inline sm:inline">{fsm ?? 'BOOT'}</span>
            <span className="text-[#7a8a6e]">▲</span>
          </motion.button>
        ) : (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="vvu-panel backdrop-blur-md w-[min(320px,calc(100vw-1.5rem))] max-h-[60vh] flex flex-col"
            role="region"
            aria-label="FSM control panel"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[rgba(107,138,64,0.22)]">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="vvu-label text-[9px] sm:text-[10px] font-bold px-2 py-1 rounded-sm border truncate"
                  style={{
                    color: stateCol,
                    borderColor: `${stateCol}55`,
                    background: `${stateCol}12`,
                  }}
                  aria-live="polite"
                >
                  {fsm ?? 'DISCONNECTED'}
                </span>
                <span className="vvu-label text-[7px] text-[#7a8a6e] hidden sm:inline">
                  APPENDIX B · DFA-7
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="vvu-label text-[8px] text-[#7a8a6e] hover:text-[#f3e38a] h-9 w-9 min-h-9 flex items-center justify-center rounded-sm border border-[rgba(107,138,64,0.25)] hover:border-[rgba(243,227,138,0.4)] transition-colors"
                aria-label="Collapse FSM panel"
              >
                ▼
              </button>
            </div>

            <div className="overflow-y-auto p-3 space-y-3">
              {/* Command grid */}
              <section aria-label="FSM symbol commands">
                <div className="vvu-label text-[7px] text-[#7a8a6e] mb-1.5">
                  SYMBOL INPUT σ ∈ Σ⁸
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {FSM_SYMBOLS.map((s) => (
                    <SymbolButton key={s} symbol={s} onSend={handleSend} />
                  ))}
                </div>
              </section>

              {/* Transition log */}
              <section aria-label="FSM transition log">
                <div className="vvu-label text-[7px] text-[#7a8a6e] mb-1.5 flex items-center justify-between">
                  <span>TRANSITION LOG · δ</span>
                  <button
                    type="button"
                    onClick={() => setShowTable((v) => !v)}
                    className="text-[#7a8a6e] hover:text-[#f3e38a] px-1.5 py-0.5 rounded-sm border border-[rgba(107,138,64,0.25)] hover:border-[rgba(243,227,138,0.4)] transition-colors"
                    aria-expanded={showTable}
                  >
                    TABLE {showTable ? '▾' : '▸'}
                  </button>
                </div>

                {showTable && (
                  <div className="mb-2 rounded-sm border border-[rgba(107,138,64,0.2)] divide-y divide-[rgba(107,138,64,0.12)]">
                    {FSM_TRANSITIONS.map((t, i) => (
                      <div
                        key={`${t.from}-${t.symbol}-${i}`}
                        className="px-2 py-1 font-mono text-[8px] leading-tight text-[#7a8a6e]"
                      >
                        <span style={{ color: fsmColor(t.from) }}>{t.from}</span>
                        <span className="text-[#7a8a6e]"> —σ·</span>
                        <span style={{ color: SYMBOL_COLOR[t.symbol] }}>{t.symbol}</span>
                        <span className="text-[#7a8a6e]">→ </span>
                        <span style={{ color: fsmColor(t.to) }}>{t.to}</span>
                      </div>
                    ))}
                  </div>
                )}

                {entries.length === 0 ? (
                  <div className="font-mono text-[9px] text-[#7a8a6e] px-1 py-2 vvu-blink">
                    NO TRANSITIONS LOGGED · AWAITING SERVICE
                  </div>
                ) : (
                  <ol className="space-y-0.5">
                    {entries.map((e, i) => (
                      <li
                        key={`${e.ts}-${e.symbol}-${i}`}
                        className="font-mono text-[8.5px] leading-snug text-[#7a8a6e] flex gap-1.5"
                      >
                        <span className="text-[#5a6a50] shrink-0">
                          {new Date(e.ts).toLocaleTimeString('en-ZA', {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                        <span className="min-w-0">
                          <span style={{ color: fsmColor(e.from) }}>{e.from}</span>
                          <span style={{ color: SYMBOL_COLOR[e.symbol] }}> —{e.symbol}→ </span>
                          <span style={{ color: fsmColor(e.to) }}>{e.to}</span>
                          <span className="text-[#5a6a50]"> · {e.reason}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
    </div>
  );
}

export default FsmPanel;
