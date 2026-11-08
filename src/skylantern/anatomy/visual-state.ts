/**
 * Anatomy × VVU — Visual State Model
 *
 * The contract between Skylantern's verification engine (the WORM chain) and
 * the Anatomy renderer. This is the ONLY data the renderer is allowed to see.
 *
 * CRITICAL CONSTRAINT:
 *   The renderer must NEVER promote an epistemic state. If the verification
 *   engine says BLOCKED_MISSING_INPUT, the visual interlock must remain
 *   disengaged — even if the animation "looks" like it should engage.
 *
 *   The visual state is a REPRESENTATION of the authoritative state, not an
 *   alternative decision-making engine.
 *
 * Mapping Skylantern → VisualState:
 *   CANDIDATE        → BLOCKED_MISSING_INPUT (single witness, R1)
 *   VERIFIED         → PROVEN (second witness attached, R2, court-grade)
 *   TAMPER_DETECTED  → BLOCKED_INDEPENDENCE (integrity check failed)
 *   ARCHIVED         → RELEASED (frozen, no further transitions)
 */

// ---------------------------------------------------------------------------
// Verification status constants — mirror Skylantern's verification states.
// ---------------------------------------------------------------------------

export const VERIFICATION_STATUS = {
  READY: "READY",
  BLOCKED_MISSING_INPUT: "BLOCKED_MISSING_INPUT",
  BLOCKED_INDEPENDENCE: "BLOCKED_INDEPENDENCE",
  INCONCLUSIVE: "INCONCLUSIVE",
  PROVEN: "PROVEN",
  RELEASED: "RELEASED",
} as const;

export type VerificationStatus =
  (typeof VERIFICATION_STATUS)[keyof typeof VERIFICATION_STATUS];

// ---------------------------------------------------------------------------
// Source status constants — state of each evidence source.
// ---------------------------------------------------------------------------

export const SOURCE_STATUS = {
  PENDING: "PENDING",
  AVAILABLE: "AVAILABLE",
  INVALID: "INVALID",
  INDEPENDENT: "INDEPENDENT",
} as const;

export type SourceStatus =
  (typeof SOURCE_STATUS)[keyof typeof SOURCE_STATUS];

// ---------------------------------------------------------------------------
// Render mode — distinguishes live telemetry from simulation/replay.
// ---------------------------------------------------------------------------

export const RENDER_MODE = {
  LIVE: "LIVE",
  SIMULATION: "SIMULATION",
  REPLAY: "REPLAY",
} as const;

export type RenderMode = (typeof RENDER_MODE)[keyof typeof RENDER_MODE];

// ---------------------------------------------------------------------------
// VisualState — the full state object passed to the renderer.
// ---------------------------------------------------------------------------

export interface EvidenceSource {
  id: string;
  label: string;
  status: SourceStatus;
  /** Reading value (if numeric). */
  reading?: number | string;
  unit?: string;
  /** When this source was received. */
  receivedAt?: string;
}

export interface VerificationResult {
  status: VerificationStatus;
  /** 0–100 confidence score (purely visual — derived from tier tag). */
  confidence: number;
  /** Why verification is blocked, if applicable. */
  blockedReason: string | null;
  /** Human-readable summary of the evidence. */
  evidenceSummary: string;
  /** The tier tag (R1 = single witness, R2 = court-grade). */
  tierTag: number;
}

export interface VisualState {
  /** Unique identifier for this visualisation instance. */
  id: string;
  /** Visualisation type (e.g. "evidence-instrument"). */
  type: string;
  /** Current rendering mode. */
  mode: RenderMode;
  /** High-level system status. */
  system: {
    status: string;
    health: "OK" | "DEGRADED" | "FAULT";
  };
  /** The authoritative verification result. */
  verification: VerificationResult;
  /** Array of evidence sources and their states. */
  sources: EvidenceSource[];
  /** Timeline of events (for REPLAY mode). */
  events: VisualEvent[];
  /** Additional context. */
  metadata: {
    timestamp: string;
    version: string;
    /** The Skylantern block sequence number this state represents. */
    blockSequence?: number;
    /** The Skylantern evidence record ID. */
    evidenceId?: string;
  };
}

export interface VisualEvent {
  id: string;
  action: string;
  at: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// Factory + update functions.
// ---------------------------------------------------------------------------

export function createVisualState(
  id: string,
  type: string,
  mode: RenderMode = RENDER_MODE.LIVE
): VisualState {
  return {
    id,
    type,
    mode,
    system: {
      status: "IDLE",
      health: "OK",
    },
    verification: {
      status: VERIFICATION_STATUS.READY,
      confidence: 0,
      blockedReason: null,
      evidenceSummary: "Awaiting inputs…",
      tierTag: 1,
    },
    sources: [],
    events: [],
    metadata: {
      timestamp: new Date().toISOString(),
      version: "anatomy-vvu/v1",
    },
  };
}

/**
 * Map a Skylantern EvidenceRecordDTO to a VisualState. This is the critical
 * translation function — it converts the authoritative verification state
 * into the visual state the renderer is allowed to see.
 *
 * THIS IS THE ONLY PLACE where Skylantern state becomes Anatomy state.
 * The renderer never reads EvidenceRecordDTO directly.
 */
export function fromEvidenceRecord(
  evidence: {
    id: string;
    sequence: number;
    verificationState: string;
    tierTag: number;
    subject: string;
    source: string;
    observedAt: string;
    observedFact: {
      value: number | string | boolean;
      unit: string;
      primitive: string;
      raw: string;
    };
    witnesses: Array<{
      id: string;
      witnessType: string;
      witnessLabel: string;
      witnessKeyHint: string | null;
      signedAt: string;
    }>;
  },
  auditEvents?: VisualEvent[]
): VisualState {
  const state = createVisualState(
    `evidence-${evidence.id}`,
    "evidence-instrument",
    RENDER_MODE.LIVE
  );

  // Map verification state — the CRITICAL translation.
  const { status, confidence, blockedReason } = mapVerificationState(
    evidence.verificationState,
    evidence.witnesses.length
  );

  state.verification = {
    status,
    confidence,
    blockedReason,
    evidenceSummary: buildEvidenceSummary(evidence),
    tierTag: evidence.tierTag,
  };

  // Map the primary source (the signing device).
  state.sources = [
    {
      id: "primary",
      label: evidence.source,
      status: SOURCE_STATUS.AVAILABLE,
      reading: evidence.observedFact.value as string | number,
      unit: evidence.observedFact.unit,
      receivedAt: evidence.observedAt,
    },
    // Map witnesses as additional independent sources.
    ...evidence.witnesses.map((w, idx) => ({
      id: `witness-${idx}`,
      label: w.witnessLabel,
      status: SOURCE_STATUS.INDEPENDENT,
      receivedAt: w.signedAt,
    })),
  ];

  // System health.
  state.system = {
    status: evidence.verificationState,
    health:
      evidence.verificationState === "TAMPER_DETECTED"
        ? "FAULT"
        : evidence.verificationState === "ARCHIVED"
        ? "OK"
        : "OK",
  };

  // Metadata.
  state.metadata.blockSequence = evidence.sequence;
  state.metadata.evidenceId = evidence.id;
  state.metadata.timestamp = new Date().toISOString();

  // Audit events for replay.
  if (auditEvents) {
    state.events = auditEvents;
  }

  return state;
}

function mapVerificationState(
  skylanternState: string,
  witnessCount: number
): {
  status: VerificationStatus;
  confidence: number;
  blockedReason: string | null;
} {
  switch (skylanternState) {
    case "CANDIDATE":
      return {
        status: VERIFICATION_STATUS.BLOCKED_MISSING_INPUT,
        confidence: 25,
        blockedReason:
          "Single-witness record (R1). Court-grade eligibility requires a second independent witness (R2).",
      };
    case "VERIFIED":
      return {
        status: VERIFICATION_STATUS.PROVEN,
        confidence: 100,
        blockedReason: null,
      };
    case "TAMPER_DETECTED":
      return {
        status: VERIFICATION_STATUS.BLOCKED_INDEPENDENCE,
        confidence: 0,
        blockedReason:
          "Integrity check failed. Recomputed hash no longer matches stored hash. The chain proves the record was altered post-hoc.",
      };
    case "ARCHIVED":
      return {
        status: VERIFICATION_STATUS.RELEASED,
        confidence: 100,
        blockedReason: null,
      };
    default:
      return {
        status: VERIFICATION_STATUS.INCONCLUSIVE,
        confidence: 0,
        blockedReason: `Unknown verification state: ${skylanternState}`,
      };
  }
}

function buildEvidenceSummary(evidence: {
  subject: string;
  source: string;
  observedFact: { value: number | string | boolean; unit: string; primitive: string };
  witnesses: unknown[];
}): string {
  const witnessNote =
    evidence.witnesses.length > 0
      ? ` · ${evidence.witnesses.length} witness(es)`
      : " · single-witness";
  return `${evidence.subject}: ${evidence.observedFact.value} ${evidence.observedFact.unit} (${evidence.observedFact.primitive})${witnessNote}`;
}

// ---------------------------------------------------------------------------
// Validation.
// ---------------------------------------------------------------------------

export function validateVisualState(state: VisualState): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!state.id) errors.push("Missing ID");
  if (!state.type) errors.push("Missing type");
  const validStatuses = Object.values(VERIFICATION_STATUS);
  if (!validStatuses.includes(state.verification.status)) {
    errors.push(`Invalid verification status: ${state.verification.status}`);
  }
  const validModes = Object.values(RENDER_MODE);
  if (!validModes.includes(state.mode)) {
    errors.push(`Invalid rendering mode: ${state.mode}`);
  }
  return { isValid: errors.length === 0, errors };
}
