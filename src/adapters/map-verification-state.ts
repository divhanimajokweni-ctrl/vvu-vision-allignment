/**
 * Display-state adapter — pure presentation mapping.
 * Never use this to verify evidence. It only maps for display.
 */

import type { AuthoritativeStatus } from "../contracts/visual-state";

export type DisplayState = "ready" | "blocked" | "inconclusive" | "proven" | "failed" | "unknown";

export function toDisplayState(status: AuthoritativeStatus): DisplayState {
  switch (status) {
    case "READY": return "ready";
    case "BLOCKED_MISSING_INPUT": return "blocked";
    case "INCONCLUSIVE": return "inconclusive";
    case "PROVEN": return "proven";
    case "FAILED": return "failed";
    default: return "unknown";
  }
}

export const DISPLAY_META: Record<DisplayState, { color: string; label: string; description: string }> = {
  ready: { color: "var(--acc)", label: "READY", description: "Inputs present; verification pending" },
  blocked: { color: "var(--bad)", label: "BLOCKED", description: "Required corroboration absent" },
  inconclusive: { color: "var(--warn)", label: "INCONCLUSIVE", description: "Evidence does not resolve the claim" },
  proven: { color: "var(--acc)", label: "PROVEN", description: "Authoritative verifier returned PROVEN" },
  failed: { color: "var(--bad)", label: "FAILED", description: "Verification failed" },
  unknown: { color: "var(--dim)", label: "UNKNOWN", description: "State not yet determined" },
};
