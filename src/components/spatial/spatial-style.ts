// src/components/spatial/spatial-style.ts — shared SCADA colour maps for the
// spatial projection (FSM states / symbols). Hex strings for canvas + CSS use.

import type { FsmState, FsmSymbol } from '@/types/vvu';

export const FSM_COLOR: Record<FsmState, string> = {
  DISCONNECTED: '#7a8a6e',
  PAIRING_BLE: '#e0a030',
  TOTP_VERIFICATION: '#e0a030',
  STEADY_STATE_LOCKED: '#c8ff00',
  LEAK_ACTIVE: '#e5484d',
  THERMAL_THROTTLE: '#e0a030',
  FAIL_CLOSED: '#e5484d',
};

export function fsmColor(state: FsmState | null | undefined): string {
  return FSM_COLOR[state ?? 'DISCONNECTED'] ?? '#7a8a6e';
}

export const SYMBOL_COLOR: Record<FsmSymbol, string> = {
  INIT: '#8fb35a',
  CHAL: '#f3e38a',
  TOTP_OK: '#c8ff00',
  CLICK: '#e5484d',
  CLEAR: '#2ea8a0',
  WARN: '#e0a030',
  CRIT: '#e5484d',
  RESET: '#8fb35a',
};

export const FSM_SYMBOLS: FsmSymbol[] = [
  'INIT',
  'CHAL',
  'TOTP_OK',
  'CLICK',
  'CLEAR',
  'WARN',
  'CRIT',
  'RESET',
];

export const SAGE = '#6b8a40';
export const SAGE_BRIGHT = '#8fb35a';
export const OCHRE = '#f3e38a';
export const LIME = '#c8ff00';
export const CRIMSON = '#e5484d';
export const AMBER = '#e0a030';
export const TEAL = '#2ea8a0';
export const DIM = '#7a8a6e';
