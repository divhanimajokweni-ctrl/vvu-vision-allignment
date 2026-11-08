// src/lib/governance-errors.ts
// ─────────────────────────────────────────────────────────────────────────────
// Governance kernel error vocabulary. Typed errors (never string matching at
// call sites) so the API layer maps each class to an honest HTTP status and
// reason code, and the negative-path suite asserts on the class.
// ─────────────────────────────────────────────────────────────────────────────

import type { GovernanceVerdict } from './governance-protocol';

/** The evaluator refused. The refusal was SEALED on the WORM chain first. */
export class GovernanceViolationError extends Error {
  readonly verdict: GovernanceVerdict;
  readonly sealedEventSeq: number | null;
  readonly sealedEventId: string | null;

  constructor(verdict: GovernanceVerdict, sealed?: { seq: number; eventId: string }) {
    super(`GOVERNANCE_REFUSED:${verdict.reasonCode ?? 'UNKNOWN'}`);
    this.name = 'GovernanceViolationError';
    this.verdict = verdict;
    this.sealedEventSeq = sealed?.seq ?? null;
    this.sealedEventId = sealed?.eventId ?? null;
  }
}

/** Permit issuance failed AFTER the transaction (signing / marking signed).
 *  The permit has been aborted and its nonce is permanently unusable. */
export class PermitIssuanceError extends Error {
  readonly permitId: string;
  readonly cause: string;

  constructor(permitId: string, cause: string) {
    super(`PERMIT_ISSUANCE_FAILED:${cause}`);
    this.name = 'PermitIssuanceError';
    this.permitId = permitId;
    this.cause = cause;
  }
}

/** The nonce store refused the single-use claim. */
export class NonceError extends Error {
  readonly result: string; // NOT_FOUND | EXPIRED | ALREADY_CONSUMED | ABORTED | ALREADY_EXISTS

  constructor(result: string) {
    super(`NONCE_${result}`);
    this.name = 'NonceError';
    this.result = result;
  }
}

/** The permit failed independent verification at execution time. */
export class PermitInvalidError extends Error {
  readonly reasonCode: string;

  constructor(reasonCode: string) {
    super(reasonCode.startsWith('PERMIT_') ? reasonCode : `PERMIT_INVALID:${reasonCode}`);
    this.name = 'PermitInvalidError';
    this.reasonCode = reasonCode;
  }
}

/** PROTOTYPE_AUTH failure — subject resolution failed closed. */
export class AuthError extends Error {
  readonly reasonCode: string; // SUBJECT_UNKNOWN | SUBJECT_REVOKED

  constructor(reasonCode: string) {
    super(`AUTH:${reasonCode}`);
    this.name = 'AuthError';
    this.reasonCode = reasonCode;
  }
}

/** The actuator refused outside the permit path (bypass attempt, mismatch,
 *  unexpected permit state — recovery decision required). */
export class ActuatorError extends Error {
  readonly reasonCode: string;

  constructor(reasonCode: string) {
    super(`ACTUATOR:${reasonCode}`);
    this.name = 'ActuatorError';
    this.reasonCode = reasonCode;
  }
}
