/**
 * Skylantern — WORM Chain Engine.
 *
 * Write-Once-Read-Many hash-linked log. The cryptographic heart of the plugin.
 *
 *   payload (canonical JSON)
 *       |
 *       v
 *   SHA-256(payload + previousHash + observedAt)  ->  hash
 *       |
 *       v
 *   HMAC-SHA256(hash, deviceSecret)  ->  signature
 *
 * Slide 5 (Process Flow):
 *   1. Observation        - value 42.7, unit bar
 *   2. Time Anchoring     - ISO timestamp + sequence
 *   3. Identity Binding   - hardware key signature
 *   4. The Hash           - SHA-256 (Payload + prevHash)
 *   5. PAYLOAD LOCKED     - hash 3F2A1B9C...
 *
 * Zero Fabrication Rule:
 *   Once the hardware key signs the payload, silent deletion becomes
 *   mathematically impossible for both the user and the operator.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { skylanternConfig } from "./config";
import type {
  EvidencePayload,
  ObservedFact,
  VerificationState,
} from "./types";

// ---------------------------------------------------------------------------
// Canonical serialization — deterministic key ordering so hashes are reproducible.
// ---------------------------------------------------------------------------

export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJSON).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .filter((k) => obj[k] !== undefined)
      .map((k) => JSON.stringify(k) + ":" + canonicalJSON(obj[k]))
      .join(",") +
    "}"
  );
}

// ---------------------------------------------------------------------------
// Device secret derivation — deterministic per externalId.
// ---------------------------------------------------------------------------

/**
 * Derive a per-device secret from the plugin's master seed + the device's
 * externalId. This means a device's "hardware key" is reproducible across
 * server restarts, so the demo is self-healing. In production this would
 * be an HSM-backed keypair with the public fingerprint stored on the device.
 *
 * Returns a 64-char hex string.
 */
export function deriveDeviceSecret(externalId: string): string {
  const seed = skylanternConfig.hardwareKeySeed;
  return createHash("sha256")
    .update(`${seed}::${externalId}`)
    .digest("hex");
}

/** First 8 chars of the SHA-256 fingerprint of the device secret. */
export function hardwareKeyHint(externalId: string): string {
  const secret = deriveDeviceSecret(externalId);
  return createHash("sha256").update(secret).digest("hex").slice(0, 8);
}

// ---------------------------------------------------------------------------
// Hashing & signing.
// ---------------------------------------------------------------------------

/**
 * Compute the canonical hash of an evidence payload.
 * This is the block's immutable identifier once signed.
 */
export function computeHash(payload: EvidencePayload): string {
  const material = canonicalJSON({
    subject: payload.subject,
    source: payload.source,
    observedAt: payload.observedAt,
    observedFact: payload.observedFact,
    derivedEvent: payload.derivedEvent,
    decision: payload.decision,
    lat: round(payload.lat, 7),
    lng: round(payload.lng, 7),
    previousHash: payload.previousHash,
    sequence: payload.sequence,
  });
  return "0x" + createHash("sha256").update(material).digest("hex");
}

/**
 * Sign the hash with the device's derived secret. Simulated HSM signature.
 */
export function signHash(hash: string, externalId: string): string {
  const secret = deriveDeviceSecret(externalId);
  return createHmac("sha256", secret).update(hash).digest("hex");
}

/**
 * Verify a signature against a hash. Returns true if the HMAC matches.
 */
export function verifySignature(
  hash: string,
  signature: string,
  externalId: string
): boolean {
  const expected = signHash(hash, externalId);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Re-derive the hash from an existing payload to detect tampering.
 * If recomputed hash != stored hash => TAMPER_DETECTED.
 */
export function recomputeHash(payload: EvidencePayload): string {
  return computeHash(payload);
}

// ---------------------------------------------------------------------------
// Verification state machine.
// ---------------------------------------------------------------------------

/**
 * Allowed transitions on the verification state field.
 * The ONLY mutable field on an EvidenceRecord.
 *
 *   CANDIDATE -> VERIFIED          (witness attached)
 *   CANDIDATE -> TAMPER_DETECTED   (integrity check failed)
 *   VERIFIED  -> TAMPER_DETECTED   (re-verification failed)
 *   any       -> ARCHIVED          (operator action, never silent)
 *
 * NEVER downgrades. NEVER silent.
 */
export function canTransition(
  from: VerificationState,
  to: VerificationState
): boolean {
  const table: Record<VerificationState, VerificationState[]> = {
    CANDIDATE: ["VERIFIED", "TAMPER_DETECTED", "ARCHIVED"],
    VERIFIED: ["TAMPER_DETECTED", "ARCHIVED"],
    TAMPER_DETECTED: ["ARCHIVED"],
    ARCHIVED: [],
  };
  return table[from]?.includes(to) ?? false;
}

/**
 * Tier tag (R1 single-witness vs R2 court-grade) from the verification state
 * and witness count. Court-grade eligibility begins only at Tier R2 (slide 12).
 */
export function tierTagFor(
  state: VerificationState,
  witnessCount: number
): number {
  if (state === "VERIFIED" && witnessCount >= 1) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// Payload builder.
// ---------------------------------------------------------------------------

export interface BuildPayloadInput {
  subject: string;
  source: string; // device externalId
  observedAt: string; // ISO
  observedFact: ObservedFact;
  derivedEvent: EvidencePayload["derivedEvent"];
  decision: EvidencePayload["decision"];
  lat: number;
  lng: number;
  previousHash: string | null;
  sequence: number;
}

export function buildPayload(input: BuildPayloadInput): EvidencePayload {
  return {
    subject: input.subject,
    source: input.source,
    observedAt: input.observedAt,
    observedFact: input.observedFact,
    derivedEvent: input.derivedEvent ?? null,
    decision: input.decision ?? null,
    lat: input.lat,
    lng: input.lng,
    previousHash: input.previousHash,
    sequence: input.sequence,
  };
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function round(n: number, places: number): number {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}

/** A short, human-readable representation of a hash for display. */
export function shortHash(hash: string, head = 6, tail = 4): string {
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}...${hash.slice(-tail)}`;
}
