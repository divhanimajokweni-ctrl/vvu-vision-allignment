/**
 * Skylantern — shared type contract for the plugin.
 *
 * "One Primitive. Immutable Evidence. Honest Limits."
 *
 * These types are the ONLY coupling between the Skylantern plugin and a host
 * Next.js stack. They are intentionally framework-agnostic so the plugin can
 * be lifted into any TypeScript project without dragging React or Next into
 * the data layer.
 */

export type Domain = "WATER" | "CELLPHONE" | "VEHICLE";

export type Primitive =
  | "MOTION"
  | "PROXIMITY"
  | "STATE"
  | "IDENTITY"
  | "LOCATION"
  | "ENVIRONMENT";

export type DeviceStatus = "ACTIVE" | "DORMANT" | "RETIRED";

/**
 * Verification state machine. The ONLY mutable field on an evidence record.
 *
 *   CANDIDATE -+-► VERIFIED         (second witness attached, court-grade R2)
 *              +---► TAMPER_DETECTED  (integrity check failed)
 *   VERIFIED  ----► TAMPER_DETECTED  (re-verification failed)
 *
 * Never silently downgraded. Never silently deleted.
 */
export type VerificationState =
  | "CANDIDATE"
  | "VERIFIED"
  | "TAMPER_DETECTED"
  | "ARCHIVED";

export type WitnessType =
  | "WEARABLE"
  | "GNSS"
  | "SECOND_DEVICE"
  | "OPERATOR";

/** The three observation levels. MUST NOT collapse. */
export interface ObservedFact {
  value: number | string | boolean;
  unit: string;
  primitive: Primitive;
  /** Raw sensor reading before any inference. The only absolute truth. */
  raw: string;
}

export interface DerivedEvent {
  /** What the software inferred, e.g. "Leak-Candidate Flagged". */
  inference: string;
  /** Always labeled with the firmware version that made the inference. */
  firmwareVersion: string;
}

export interface Decision {
  action: string;
  status: "EXECUTED" | "RECOMMENDED" | "REFUSED";
}

export interface EvidenceRecordDTO {
  id: string;
  hash: string;
  previousHash: string | null;
  sequence: number;
  tierTag: number;
  verificationState: VerificationState;
  observedFact: ObservedFact;
  derivedEvent: DerivedEvent | null;
  decision: Decision | null;
  subject: string;
  source: string;
  observedAt: string;
  signedAt: string;
  lat: number;
  lng: number;
  payload: string;
  signature: string;
  device: {
    id: string;
    externalId: string;
    label: string;
    domain: Domain;
    primitive: Primitive;
  };
  witnesses: WitnessDTO[];
  createdAt: string;
}

export interface WitnessDTO {
  id: string;
  witnessType: WitnessType;
  witnessLabel: string;
  witnessKeyHint: string | null;
  signedAt: string;
}

export interface AuditEventDTO {
  id: string;
  action: string;
  fromState: string | null;
  toState: string | null;
  actor: string;
  note: string | null;
  at: string;
}

export interface ChainIntegrityReport {
  totalBlocks: number;
  verified: number;
  tampered: number;
  tamperedBlocks: Array<{
    sequence: number;
    hash: string;
    recomputedHash: string;
    subject: string;
    source: string;
  }>;
  chainHeadSequence: number;
  allLinksValid: boolean;
  checkedAt: string;
}

export interface ProofBundle {
  evidence: EvidenceRecordDTO;
  audit: AuditEventDTO[];
  neighbors: {
    previous: {
      sequence: number | null;
      hash: string | null;
      subject: string | null;
      observedAt: string | null;
      verificationState: string | null;
    } | null;
    next: {
      sequence: number | null;
      hash: string | null;
      previousHash: string | null;
      subject: string | null;
      observedAt: string | null;
      verificationState: string | null;
    } | null;
  };
  integrity: {
    recomputedHash: string;
    matchesStoredHash: boolean;
    signatureValid: boolean;
  };
  generatedAt: string;
  schemaVersion: string;
}

export interface SubscriptionDTO {
  id: string;
  tierKey: string;
  tierLabel: string;
  priceZAR: number;
  cadence: string;
  customerName: string;
  customerEmail: string;
  deviceExternalId: string | null;
  status: "ACTIVE" | "CANCELLED" | "TRIALING";
  startDate: string;
  cancelledAt: string | null;
  createdAt: string;
}

export interface CreateSubscriptionRequest {
  tierKey: string;
  customerName: string;
  customerEmail: string;
  deviceExternalId?: string;
}

export interface DeviceDTO {
  id: string;
  externalId: string;
  label: string;
  domain: Domain;
  primitive: Primitive;
  lat: number;
  lng: number;
  firmwareVersion: string | null;
  hardwareKeyHint: string | null;
  status: DeviceStatus;
  pricingBand: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  evidenceCount: number;
  latestVerificationState: VerificationState | null;
}

export interface ChainHeadDTO {
  hash: string | null;
  sequence: number;
  totalBlocks: number;
  totalCandidates: number;
  totalVerified: number;
  totalTamperDetected: number;
  lastObservedAt: string | null;
}

export interface StatsDTO {
  totalDevices: number;
  activeDevices: number;
  totalEvidence: number;
  verificationBreakdown: Record<VerificationState, number>;
  domainBreakdown: Record<Domain, number>;
  primitiveBreakdown: Record<Primitive, number>;
  chainHead: ChainHeadDTO;
  /** Pricing band composition (R9 - R9,999 cap). */
  pricing: {
    label: string;
    band: string;
    activeSubscriptions: number;
  }[];
}

/** The single canonical payload that gets hashed & signed. */
export interface EvidencePayload {
  subject: string;
  source: string;
  observedAt: string;
  observedFact: ObservedFact;
  derivedEvent: DerivedEvent | null;
  decision: Decision | null;
  lat: number;
  lng: number;
  previousHash: string | null;
  sequence: number;
}

/** Submission request for a new sky-lantern release. */
export interface SubmitEvidenceRequest {
  deviceExternalId: string;
  observedFact: ObservedFact;
  derivedEvent?: DerivedEvent | null;
  decision?: Decision | null;
  subject?: string;
  observedAt?: string;
  /** Optional geo override; otherwise the device's registered location is used. */
  lat?: number;
  lng?: number;
}

export interface AttachWitnessRequest {
  evidenceId: string;
  witnessType: WitnessType;
  witnessLabel: string;
  witnessKeyHint?: string;
}

export interface RegisterDeviceRequest {
  externalId: string;
  label: string;
  domain: Domain;
  primitive: Primitive;
  lat: number;
  lng: number;
  firmwareVersion?: string;
  pricingBand?: string;
}

/** Standardisation funnel - 126 sensor types / 15 device classes -> 6 primitives. */
export const PRIMITIVES: Primitive[] = [
  "MOTION",
  "PROXIMITY",
  "STATE",
  "IDENTITY",
  "LOCATION",
  "ENVIRONMENT",
];

export const DOMAINS: Domain[] = ["WATER", "CELLPHONE", "VEHICLE"];

export const VERIFICATION_STATES: VerificationState[] = [
  "CANDIDATE",
  "VERIFIED",
  "TAMPER_DETECTED",
  "ARCHIVED",
];

/** Hex colors used by both the API (for clients w/o CSS) and the map layer. */
export const VERIFICATION_COLORS: Record<VerificationState, string> = {
  CANDIDATE: "#f59e0b", // amber - awaiting corroboration
  VERIFIED: "#10b981", // emerald - court-grade R2
  TAMPER_DETECTED: "#ef4444", // crimson - integrity failure
  ARCHIVED: "#6b7280", // slate grey
};

export const PRIMITIVE_ICONS: Record<Primitive, string> = {
  MOTION: "move",
  PROXIMITY: "radar",
  STATE: "toggle-left",
  IDENTITY: "fingerprint",
  LOCATION: "map-pin",
  ENVIRONMENT: "cloud-sun",
};
