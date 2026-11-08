/**
 * Visual State Model for Anatomy × VVU Integration
 *
 * The contract between VVU·IVE/ProofBridge and the Anatomy renderer.
 * The visual layer NEVER decides — it displays authoritative state only.
 *
 * CRITICAL FIX (per architectural review): provenanceRef is REQUIRED for
 * PROVEN/RELEASED status. The renderer cannot display PROVEN without
 * cryptographic proof traceable to a signed record in VVU·IVE.
 *
 * @license Apache-2.0
 */

// Verification Status Constants — the 6-state visual vocabulary
export const VERIFICATION_STATUS = {
  READY: "READY",
  BLOCKED_MISSING_INPUT: "BLOCKED_MISSING_INPUT",
  BLOCKED_INDEPENDENCE: "BLOCKED_INDEPENDENCE",
  INCONCLUSIVE: "INCONCLUSIVE",
  PROVEN: "PROVEN",
  RELEASED: "RELEASED",
} as const;

// Source Status Constants
export const SOURCE_STATUS = {
  PENDING: "PENDING",
  AVAILABLE: "AVAILABLE",
  INVALID: "INVALID",
  INDEPENDENT: "INDEPENDENT",
} as const;

// Mode Constants
export const RENDER_MODE = {
  LIVE: "LIVE",
  SIMULATION: "SIMULATION",
  REPLAY: "REPLAY",
} as const;

export type VerificationStatus = typeof VERIFICATION_STATUS[keyof typeof VERIFICATION_STATUS];
export type SourceStatus = typeof SOURCE_STATUS[keyof typeof SOURCE_STATUS];
export type RenderMode = typeof RENDER_MODE[keyof typeof RENDER_MODE];

export interface EvidenceSource {
  id: string;
  label: string;
  status: SourceStatus;
  weight: number;
  content?: string;
}

export interface VerificationResult {
  status: VerificationStatus;
  confidence: number;
  blockedReason: string | null;
  /** REQUIRED for PROVEN/RELEASED — hash/reference to signed record in VVU·IVE.
   * The adapter rejects PROVEN/RELEASED without this field. */
  provenanceRef: string | null;
  evidenceSummary: string;
}

export interface SystemStatus {
  status: string;
  health: string;
}

export interface VisualState {
  id: string;
  type: string;
  mode: RenderMode;
  system: SystemStatus;
  verification: VerificationResult;
  sources: EvidenceSource[];
  events: Array<{ timestamp: string; type: string; detail: string }>;
  metadata: {
    timestamp: string;
    version: string;
  };
}

/**
 * Creates a default VisualState object
 */
export function createVisualState(
  id: string,
  type: string,
  mode: RenderMode = RENDER_MODE.LIVE,
): VisualState {
  return {
    id,
    type,
    mode,
    system: { status: "IDLE", health: "OK" },
    verification: {
      status: VERIFICATION_STATUS.READY,
      confidence: 0,
      blockedReason: null,
      provenanceRef: null,
      evidenceSummary: "Awaiting inputs...",
    },
    sources: [],
    events: [],
    metadata: {
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    },
  };
}

/**
 * Updates the verification state based on authoritative results.
 * NEVER raises status — only restates what the authority says.
 */
export function updateVerificationState(
  state: VisualState,
  verificationResult: Partial<VerificationResult> & {
    status?: VerificationStatus;
    sources?: EvidenceSource[];
  },
): VisualState {
  return {
    ...state,
    verification: {
      status: verificationResult.status ?? state.verification.status,
      confidence: verificationResult.confidence ?? state.verification.confidence,
      blockedReason: verificationResult.blockedReason ?? state.verification.blockedReason,
      provenanceRef: verificationResult.provenanceRef ?? state.verification.provenanceRef,
      evidenceSummary: verificationResult.evidenceSummary ?? state.verification.evidenceSummary,
    },
    sources: verificationResult.sources
      ? (verificationResult.sources as EvidenceSource[])
      : state.sources,
    metadata: {
      ...state.metadata,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Validates the visual state before rendering.
 *
 * CRITICAL: PROVEN/RELEASED WITHOUT provenanceRef = INVALID.
 * The renderer MUST NOT display PROVEN without cryptographic proof.
 */
export function validateVisualState(state: VisualState): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!state.id) errors.push("Missing ID");
  if (!state.type) errors.push("Missing type");

  if (!Object.values(VERIFICATION_STATUS).includes(state.verification.status)) {
    errors.push(`Invalid verification status: ${state.verification.status}`);
  }

  if (!Object.values(RENDER_MODE).includes(state.mode)) {
    errors.push(`Invalid rendering mode: ${state.mode}`);
  }

  // THE GATE: PROVEN/RELEASED requires provenanceRef
  if (
    (state.verification.status === VERIFICATION_STATUS.PROVEN ||
      state.verification.status === VERIFICATION_STATUS.RELEASED) &&
    !state.verification.provenanceRef
  ) {
    errors.push(
      `${state.verification.status} requires provenanceRef (cryptographic proof)`,
    );
  }

  // INDEPENDENCE CHECK: PROVEN/RELEASED requires at least one INDEPENDENT source
  if (
    (state.verification.status === VERIFICATION_STATUS.PROVEN ||
      state.verification.status === VERIFICATION_STATUS.RELEASED) &&
    !state.sources.some((s) => s.status === SOURCE_STATUS.INDEPENDENT)
  ) {
    errors.push(
      `${state.verification.status} requires at least one INDEPENDENT source`,
    );
  }

  return { isValid: errors.length === 0, errors };
}
