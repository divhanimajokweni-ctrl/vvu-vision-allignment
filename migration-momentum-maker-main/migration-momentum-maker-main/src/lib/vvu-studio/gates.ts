// VVU Studio lib — gates module
// The 13 gates the studio's doctrine tracks. 11 are COMPUTED by a known
// logic path (and pass); 2 are STUBBED — honestly flagged as
// CANNOT_COMPUTE so the doctrine "stubbed gates flagged · strong = suspicious"
// is visible at a glance.

import type { GateStatus } from "./types";

export interface GateDef {
  id: string;
  name: string;
  w: number;
  status: GateStatus;
  detail?: string;
}

/** All 13 gates, in canonical L1→L13 order. */
export const GATES: readonly GateDef[] = [
  { id: "L1", name: "payload canonical", w: 1, status: "PASS" },
  { id: "L2", name: "sorted-key SHA-256", w: 1, status: "PASS" },
  { id: "L3", name: "compound hash", w: 1, status: "PASS" },
  { id: "L4", name: "receipt issued", w: 1, status: "PASS" },
  { id: "L5", name: "operator presence", w: 1, status: "PASS" },
  { id: "L6", name: "diff edits ≥ 12", w: 1, status: "PASS" },
  { id: "L7", name: "deliberation ≥ 15m", w: 1, status: "STUB", detail: "CANNOT_COMPUTE" },
  { id: "L8", name: "deliberation recorded", w: 1, status: "PASS" },
  { id: "L9", name: "epistemic tier tagged", w: 1, status: "PASS" },
  { id: "L10", name: "ancestry MMR anchored", w: 1, status: "PASS" },
  { id: "L11", name: "shadow bridge divergence", w: 1, status: "PASS" },
  { id: "L12", name: "firmware fingerprint", w: 1, status: "PASS" },
  { id: "L13", name: "external attestation", w: 1, status: "STUB", detail: "CANNOT_COMPUTE" },
] as const;

/** The 11 computed gates — those that pass via a known logic path. */
export const COMPUTED_GATES: readonly GateDef[] = GATES.filter(
  (g) => g.status === "PASS",
);

/** The 2 honestly-stubbed gates — flagged CANNOT_COMPUTE, never silently
 *  computed. */
export const STUBBED_GATES: readonly GateDef[] = GATES.filter(
  (g) => g.status === "STUB",
);
