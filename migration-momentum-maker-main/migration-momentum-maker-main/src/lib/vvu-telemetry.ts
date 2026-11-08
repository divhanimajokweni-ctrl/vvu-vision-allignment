// src/lib/vvu-telemetry.ts — Telemetry payload validation against physical
// invariants (Joukowsky celerity bounds, APU thermal thresholds).

import { THERMAL, HYDRAULIC_INVARIANTS } from "@/lib/vvu-data";
import type { FsmState } from "@/types/vvu";

// ── Physical invariant bounds (exported for the UI panels + state route) ──
// SANS-celerity safe harbour for DN100 ductile-iron mains.
export const SANS_CELERITY_BOUNDS = { min: 600, max: 1480 };
// APU thermal thresholds (nominal / throttle / fail-closed).
export const APU_THERMAL_BOUNDS = {
  nominal: 28,
  throttle: 65,
  failClosed: 85,
};
// FAVAD exponent N1 safe harbour.
export const FAVAD_EXPONENT_BOUNDS = { min: 0.5, max: 1.5 };
// Factor of safety (hydraulic structural).
export const FACTOR_OF_SAFETY_BOUNDS = { min: 1.5, max: 3.0 };

export interface TelemetryPayload {
  nodeId: string;
  flowRate: number; // L/s
  pressureHead: number; // m
  acousticAbnormal: boolean;
  apuTemperature: number; // °C
  tenantId?: string;
  timestamp?: number; // epoch ms
}

export interface TelemetryResult {
  success: boolean;
  state: FsmState;
  invariantOk: boolean;
  estimatedCelerity: number;
  message: string;
}

const celerityBounds = HYDRAULIC_INVARIANTS.find((i) => i.parameter === "Wave Celerity")!;

/** Rough Joukowsky-style celerity estimate from pressure head & pipe class. */
export function estimateCelerity(pressureHead: number, flowRate: number): number {
  const g = 9.81;
  const bulkModulusFactor = 0.35 + Math.min(0.4, Math.abs(flowRate) / 200);
  return Math.round(Math.sqrt(Math.max(1, pressureHead) * g * 1480 * bulkModulusFactor));
}

export function validateTelemetry(payload: TelemetryPayload): TelemetryResult {
  const celerity = estimateCelerity(payload.pressureHead, payload.flowRate);

  // 1. Wave celerity invariant (SANS hydraulic safe harbour)
  const celerityOk =
    celerity >= (celerityBounds.minValue ?? 0) && celerity <= (celerityBounds.maxValue ?? Infinity);

  // 2. Thermal boundaries
  const t = payload.apuTemperature;
  let state: FsmState = "STEADY_STATE_LOCKED";
  if (t >= THERMAL.critC) state = "FAIL_CLOSED";
  else if (t >= THERMAL.warnC) state = "THERMAL_THROTTLE";
  else if (payload.acousticAbnormal) state = "LEAK_ACTIVE";

  const thermalOk = t < THERMAL.critC;

  if (!celerityOk) {
    return {
      success: false,
      state,
      invariantOk: false,
      estimatedCelerity: celerity,
      message: `REJECTED · wave celerity ${celerity} m/s outside safe harbour [${celerityBounds.minValue}, ${celerityBounds.maxValue}] m/s`,
    };
  }
  if (!thermalOk) {
    return {
      success: false,
      state,
      invariantOk: false,
      estimatedCelerity: celerity,
      message: `REJECTED · APU temperature ${t.toFixed(1)}°C ≥ critical ${THERMAL.critC}°C → FAIL_CLOSED_LOCKDOWN`,
    };
  }
  return {
    success: true,
    state,
    invariantOk: true,
    estimatedCelerity: celerity,
    message: `ACCEPTED · celerity ${celerity} m/s in bounds · thermal ${t.toFixed(1)}°C OK · WORM-bound`,
  };
}

// Re-homed: the FSM state union (source declared it in the telemetry type set).
export type VvuSystemState =
  | "DISCONNECTED"
  | "PAIRING_BLE"
  | "TOTP_VERIFICATION"
  | "STEADY_STATE_LOCKED"
  | "LEAK_SIMULATION_ACTIVE"
  | "THERMAL_THROTTLE"
  | "FAIL_CLOSED_LOCKDOWN";
