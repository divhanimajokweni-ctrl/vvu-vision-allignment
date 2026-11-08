/**
 * VisualState contract — the read-only interface between VVU application state
 * and a visual figure. The figure displays; it never decides.
 *
 * Ported from anatomy-vvu-integration, rebuilt for this project.
 */

export type AuthoritativeStatus =
  | "READY"
  | "BLOCKED_MISSING_INPUT"
  | "INCONCLUSIVE"
  | "PROVEN"
  | "FAILED"
  | "UNKNOWN";

export type DataMode = "live" | "replay" | "simulation";

export interface EvidenceReference {
  id: string;
  label: string;
  kind: "observation" | "verification" | "provenance" | "artifact";
  href?: string;
}

export interface VisualState {
  entityId: string;
  entityLabel: string;
  authoritativeStatus: AuthoritativeStatus;
  statusReason: string;
  mode: DataMode;
  observedAt?: string;
  sourceStatus: "available" | "stale" | "missing" | "unknown";
  values: Record<string, { value: number | string | boolean; unit?: string }>;
  missingInputs: string[];
  evidence: EvidenceReference[];
}

export type FigureIntent =
  | { type: "open-evidence"; evidenceId: string }
  | { type: "select-component"; componentId: string }
  | { type: "request-refresh"; entityId: string };
