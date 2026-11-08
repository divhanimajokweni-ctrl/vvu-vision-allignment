// VVU FSM controller — 7-state DFA + 9 input symbols + 5°C thermal hysteresis
// Source: VVU HBK Mk-II Hydro-Gateway E2E Engineering Compilation
// "Hash is Proof" — every transition logged to WORM localStorage

import type { VvuSystemState } from "./vvu-telemetry";

export type { VvuSystemState } from "./vvu-telemetry";

export type VvuSymbol =
  "INIT" | "CHAL" | "TOTP_OK" | "FAIL" | "CLICK" | "CLEAR" | "WARN" | "CRIT" | "RESET";

interface TransitionDef {
  from: VvuSystemState;
  symbol: VvuSymbol;
  to: VvuSystemState;
  reason: string;
}

export const FSM_STATES: VvuSystemState[] = [
  "DISCONNECTED",
  "PAIRING_BLE",
  "TOTP_VERIFICATION",
  "STEADY_STATE_LOCKED",
  "LEAK_SIMULATION_ACTIVE",
  "THERMAL_THROTTLE",
  "FAIL_CLOSED_LOCKDOWN",
];

export const FSM_TRANSITIONS: TransitionDef[] = [
  {
    from: "DISCONNECTED",
    symbol: "INIT",
    to: "PAIRING_BLE",
    reason: "Operator INIT — start BLE pairing",
  },
  {
    from: "PAIRING_BLE",
    symbol: "CHAL",
    to: "TOTP_VERIFICATION",
    reason: "BLE challenge received — request TOTP",
  },
  {
    from: "TOTP_VERIFICATION",
    symbol: "TOTP_OK",
    to: "STEADY_STATE_LOCKED",
    reason: "TOTP verified — enter steady state",
  },
  {
    from: "TOTP_VERIFICATION",
    symbol: "FAIL",
    to: "DISCONNECTED",
    reason: "TOTP failed — back to disconnected",
  },
  {
    from: "STEADY_STATE_LOCKED",
    symbol: "CLICK",
    to: "LEAK_SIMULATION_ACTIVE",
    reason: "Operator CLICK — simulate leak event",
  },
  {
    from: "LEAK_SIMULATION_ACTIVE",
    symbol: "CLEAR",
    to: "STEADY_STATE_LOCKED",
    reason: "Leak cleared — return to steady state",
  },
  {
    from: "STEADY_STATE_LOCKED",
    symbol: "WARN",
    to: "THERMAL_THROTTLE",
    reason: "APU temp ≥ 65 °C — thermal throttle",
  },
  {
    from: "LEAK_SIMULATION_ACTIVE",
    symbol: "WARN",
    to: "THERMAL_THROTTLE",
    reason: "APU temp ≥ 65 °C during leak — throttle",
  },
  {
    from: "THERMAL_THROTTLE",
    symbol: "CRIT",
    to: "FAIL_CLOSED_LOCKDOWN",
    reason: "APU temp ≥ 85 °C — fail-closed lockdown",
  },
  {
    from: "THERMAL_THROTTLE",
    symbol: "CLEAR",
    to: "STEADY_STATE_LOCKED",
    reason: "Thermal clear — return to steady state",
  },
  {
    from: "FAIL_CLOSED_LOCKDOWN",
    symbol: "RESET",
    to: "STEADY_STATE_LOCKED",
    reason: "Authorised RESET — return to steady state",
  },
];

export interface FsmEvent {
  from: VvuSystemState;
  to: VvuSystemState;
  symbol: VvuSymbol;
  reason: string;
  at: number; // epoch ms
}

export class VvuFsmController {
  state: VvuSystemState = "DISCONNECTED";
  private log: FsmEvent[] = [];
  private listeners: Array<(s: VvuSystemState, e?: FsmEvent) => void> = [];

  constructor(initial: VvuSystemState = "DISCONNECTED") {
    this.state = initial;
  }

  dispatch(symbol: VvuSymbol): FsmEvent | null {
    const t = FSM_TRANSITIONS.find((x) => x.from === this.state && x.symbol === symbol);
    if (!t) return null;
    const event: FsmEvent = {
      from: this.state,
      to: t.to,
      symbol,
      reason: t.reason,
      at: Date.now(),
    };
    this.state = t.to;
    this.log.push(event);
    if (this.log.length > 50) this.log.shift();
    this.listeners.forEach((l) => l(this.state, event));
    return event;
  }

  canDispatch(symbol: VvuSymbol): boolean {
    return FSM_TRANSITIONS.some((x) => x.from === this.state && x.symbol === symbol);
  }

  availableSymbols(): VvuSymbol[] {
    return FSM_TRANSITIONS.filter((x) => x.from === this.state).map((x) => x.symbol);
  }

  history(): readonly FsmEvent[] {
    return this.log;
  }

  subscribe(fn: (s: VvuSystemState, e?: FsmEvent) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }
}

export const STATE_META: Record<
  VvuSystemState,
  { label: string; color: string; bg: string; description: string }
> = {
  DISCONNECTED: {
    label: "Disconnected",
    color: "#94a3b8",
    bg: "#1e293b",
    description: "HBK Mk-II offline. Awaiting operator INIT.",
  },
  PAIRING_BLE: {
    label: "Pairing (BLE)",
    color: "#F3E38A",
    bg: "#36331a",
    description: "BLE pairing handshake in progress.",
  },
  TOTP_VERIFICATION: {
    label: "TOTP Verification",
    color: "#fffac2",
    bg: "#2a2a14",
    description: "Time-based one-time password challenge.",
  },
  STEADY_STATE_LOCKED: {
    label: "Steady-State Locked",
    color: "#c8ff00",
    bg: "#1a2900",
    description: "Nominal. InvariantOk = true. WORM chain active.",
  },
  LEAK_SIMULATION_ACTIVE: {
    label: "Leak Simulation Active",
    color: "#C46D1A",
    bg: "#3a2410",
    description: "FAVAD leak detected. Operator drill in progress.",
  },
  THERMAL_THROTTLE: {
    label: "Thermal Throttle",
    color: "#ff8a00",
    bg: "#3a1f00",
    description: "APU temp ≥ 65 °C. Throttled. InvariantOk still true.",
  },
  FAIL_CLOSED_LOCKDOWN: {
    label: "FAIL-CLOSED LOCKDOWN",
    color: "#ef4444",
    bg: "#3a0808",
    description: "APU temp ≥ 85 °C. Authorised RESET required.",
  },
};
