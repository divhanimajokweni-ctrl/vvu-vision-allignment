"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import type { VvuSystemState } from "@/lib/vvu-telemetry";

interface FsmEventToastProps {
  currentState: string;
  wsConnected: boolean;
  tamperedCount: number;
  lastTelemetryTick: number | undefined;
}

const STATE_TITLES: Record<string, string> = {
  DISCONNECTED: "HBK Disconnected",
  PAIRING_BLE: "BLE Pairing Started",
  TOTP_VERIFICATION: "TOTP Verification",
  STEADY_STATE_LOCKED: "Steady State Locked",
  LEAK_SIMULATION_ACTIVE: "⚠ Leak Simulation Active",
  THERMAL_THROTTLE: "⚠ Thermal Throttle",
  FAIL_CLOSED_LOCKDOWN: "🚨 FAIL-CLOSED LOCKDOWN",
};

const STATE_DESCRIPTIONS: Record<string, string> = {
  DISCONNECTED: "HBK Mk-II offline. Awaiting operator INIT.",
  PAIRING_BLE: "BLE pairing handshake in progress.",
  TOTP_VERIFICATION: "Time-based one-time password challenge.",
  STEADY_STATE_LOCKED: "Nominal. InvariantOk = true. WORM chain active.",
  LEAK_SIMULATION_ACTIVE: "FAVAD leak detected. Operator drill in progress.",
  THERMAL_THROTTLE: "APU temp ≥ 65°C. Throttled. InvariantOk still true.",
  FAIL_CLOSED_LOCKDOWN: "APU temp ≥ 85°C. Authorised RESET required.",
};

const STATE_VARIANTS: Record<string, "default" | "success" | "destructive"> = {
  DISCONNECTED: "default",
  PAIRING_BLE: "default",
  TOTP_VERIFICATION: "default",
  STEADY_STATE_LOCKED: "success",
  LEAK_SIMULATION_ACTIVE: "destructive",
  THERMAL_THROTTLE: "destructive",
  FAIL_CLOSED_LOCKDOWN: "destructive",
};

/**
 * Watches FSM state changes + tamper alerts and fires toast notifications.
 * Mount this component once in the page — it has no UI of its own.
 */
export function FsmEventToaster({
  currentState,
  wsConnected,
  tamperedCount,
  lastTelemetryTick,
}: FsmEventToastProps) {
  const { toast } = useToast();
  const prevStateRef = useRef<string>(currentState);
  const prevTamperedRef = useRef<number>(tamperedCount);
  const prevWsConnectedRef = useRef<boolean>(wsConnected);

  // FSM state change toast
  useEffect(() => {
    if (prevStateRef.current === currentState) return;
    const prevState = prevStateRef.current;
    prevStateRef.current = currentState;

    // Don't toast on initial mount
    if (prevState === currentState) return;

    const variant = STATE_VARIANTS[currentState] ?? "default";
    toast({
      title: STATE_TITLES[currentState] ?? `State: ${currentState}`,
      description: `${STATE_DESCRIPTIONS[currentState] ?? ""} (from ${prevState.replace(/_/g, " ")})`,
      variant: variant === "destructive" ? "destructive" : "default",
      duration: variant === "destructive" ? 8000 : 4000,
    });
  }, [currentState, toast]);

  // Tamper alert toast
  useEffect(() => {
    if (prevTamperedRef.current === tamperedCount) return;
    const prev = prevTamperedRef.current;
    prevTamperedRef.current = tamperedCount;

    if (tamperedCount > prev) {
      toast({
        title: "🚨 WORM Tamper Detected",
        description: `${tamperedCount} ledger entr${tamperedCount === 1 ? "y" : "ies"} flagged as tampered. Auto-restore in 10s.`,
        variant: "destructive",
        duration: 10000,
      });
    } else if (tamperedCount < prev && tamperedCount === 0) {
      toast({
        title: "✓ Tamper Alert Cleared",
        description: "All ledger entries verified. WORM chain integrity restored.",
        variant: "default",
        duration: 4000,
      });
    }
  }, [tamperedCount, toast]);

  // WebSocket connection change toast
  useEffect(() => {
    if (prevWsConnectedRef.current === wsConnected) return;
    const prev = prevWsConnectedRef.current;
    prevWsConnectedRef.current = wsConnected;

    // Don't toast on initial mount
    if (prev === wsConnected) return;

    if (wsConnected) {
      toast({
        title: "WebSocket Connected",
        description: "Real-time telemetry push active on :3003",
        variant: "default",
        duration: 3000,
      });
    } else {
      toast({
        title: "WebSocket Disconnected",
        description: "Falling back to REST polling. Reconnecting…",
        variant: "destructive",
        duration: 5000,
      });
    }
  }, [wsConnected, toast]);

  return null; // No UI — just side effects
}
