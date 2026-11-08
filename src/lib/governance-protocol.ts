// src/lib/governance-protocol.ts
// ─────────────────────────────────────────────────────────────────────────────
// GOVERNANCE KERNEL — pure protocol layer (Round 56, software-in-the-loop).
//
// Everything in this file is PURE: no imports of server state, no I/O, no
// wall-clock reads. The evaluator is TOTAL — malformed inputs are REFUSED
// with a reason code, never thrown. The same functions run inside the Next
// server, inside the negative-path suite, and (in principle) inside an
// independent verifier, which is the point: the rule is the code.
//
// Milestone (falsifiable): "A registered actuator cannot execute unless it
// receives a valid, signed, unexpired, single-use permit whose action,
// subject, policy epoch, evidence manifest, and nonce all match
// authoritative state."
//
// Release ladder: PROTOTYPE → SIL_CANDIDATE → SIL_PASS → CONTROLLED_BENCH →
// PHYSICAL_PILOT. This code ships the SIL kernel. No ISO 26262 compliance
// is claimed; the correct claim is: the system contains an auditable
// safety-assessment interface that refuses unmapped assessments.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Reason codes (the evaluator's complete refusal vocabulary) ────────────

export type ReasonCode =
  | 'MALFORMED_TIME'
  | 'SUBJECT_REVOKED'
  | 'SUBJECT_UNKNOWN'
  | 'ACTION_NOT_GOVERNED'
  | 'POLICY_EPOCH_STALE'
  | 'ACTION_IN_FLIGHT'
  | 'ACTION_DUPLICATE'
  | 'EVIDENCE_MANIFEST_MISSING'
  | 'EVIDENCE_MANIFEST_MISMATCH'
  | 'HAZARD_UNMITIGATED'
  | 'ASIL_UNMAPPED'
  | 'CONSENT_MISSING'
  | 'CONSENT_SUBJECT_MISMATCH'
  | 'CONSENT_ACTION_MISMATCH'
  | 'CONSENT_EPOCH_STALE'
  | 'HARM_BENEFIT_STALE'
  | 'HARM_BENEFIT_NOT_SATISFIED';

// ─── Input state shapes (loaded authoritatively by the runtime) ────────────

export type SubjectStatus = 'ACTIVE' | 'REVOKED' | 'UNKNOWN';

export interface SubjectState {
  id: string;
  status: SubjectStatus;
}

export type RiskClass = 'SENSE' | 'ACTUATE' | 'MAINTAIN';

export interface ActionState {
  id: string;
  registered: boolean;
  riskClass: RiskClass | null;
}

export type HazardStatus = 'MITIGATED' | 'UNMITIGATED' | 'UNKNOWN';

/** SEC — the three inputs of the ISO 26262 hazard-analysis method. */
export interface HazardState {
  id: string;
  status: HazardStatus;
  severity: string;          // 'S1' | 'S2' | 'S3'
  exposure: string;          // 'E1' … 'E4'
  controllability: string;   // 'C1' … 'C3'
}

export interface ConsentState {
  subjectId: string;
  actionId: string;
  policyEpoch: number;
}

export interface ContextState {
  /** the epoch the evaluation runs under */
  policyEpoch: number;
  /** the epoch current in the authoritative policy state */
  currentPolicyEpoch: number;
  /** hash of the authoritative evidence this decision is bound to */
  evidenceManifestHash: string;
  /** hash the requester presented (null = bind authoritative, no claim) */
  providedEvidenceManifestHash: string | null;
  /** TRUE while a permit for this action is outstanding (unexpired RESERVED
   *  nonce) or mid-ladder (AUTHORIZED_UNSIGNED/SIGNED/ACTUATOR_STARTED) —
   *  duplicate concurrent requests refuse here, exactly-once per intent. */
  actionInFlight: boolean;
  /** when THIS request entered the system (ISO) — captured by the entry
   *  point before any await; the duplicate check compares it to
   *  lastConfirmedAt. */
  requestArrivedAt: string;
  /** when the most recent execution of this action confirmed (ISO, null if
   *  never). An execution that confirms AFTER a request arrived marks that
   *  request as a concurrent duplicate → ACTION_DUPLICATE. */
  lastConfirmedAt: string | null;
  now: string; // ISO timestamp of the evaluation instant
}

export interface HarmBenefitState {
  harm: number;
  benefit: number;
  assessedAt: string; // ISO
}

export interface GovernanceInput {
  subject: SubjectState;
  action: ActionState;
  hazards: HazardState[];
  consent: ConsentState | null;
  context: ContextState;
  harmBenefit: HarmBenefitState;
  observedAt: string; // ISO
}

// ─── Verdict ────────────────────────────────────────────────────────────────

export interface CheckLog {
  check: string;
  outcome: 'PASS' | 'REFUSED';
  detail: string;
}

export interface GovernanceVerdict {
  allowed: boolean;
  reasonCode?: ReasonCode;
  reason?: string;
  checks: CheckLog[];
}

export function refuse(code: ReasonCode, check: string, reason: string, checks: CheckLog[]): GovernanceVerdict {
  checks.push({ check, outcome: 'REFUSED', detail: reason });
  return { allowed: false, reasonCode: code, reason, checks };
}

function pass(check: string, detail: string, checks: CheckLog[]): void {
  checks.push({ check, outcome: 'PASS', detail });
}

/** ISO-8601 parseability. The evaluator refuses (never throws) on garbage. */
export function isValidIso(s: unknown): s is string {
  return typeof s === 'string' && s.length > 0 && !Number.isNaN(Date.parse(s));
}

// ─── ASIL — the reviewed table, entered as a table, never a scoring function ─

export type AssuranceLevel = 'QM' | 'A' | 'B' | 'C' | 'D';

/**
 * APPROVED_ASIL_TABLE — ISO 26262-3:2018 Table 4 (ASIL determination),
 * entered as a reviewed LOOKUP TABLE per the adopted method. Severity (S1–S3)
 * × Exposure (E1–E4) × Controllability (C1–C3) → QM/A/B/C/D.
 *
 * HONEST LIMIT: this table was transcribed from the published method's
 * standard reproduction and MUST be re-verified against the standard text
 * before any safety claim is made from it. Anything outside the table
 * derives to 'UNMAPPED', and the evaluator REFUSES on UNMAPPED — a fabricated
 * scoring function would be worse than an explicit refusal (false precision).
 * No ISO 26262 compliance is claimed by this implementation.
 */
export const APPROVED_ASIL_TABLE: Readonly<Record<string, AssuranceLevel>> = (() => {
  const t: Record<string, AssuranceLevel> = {};
  const put = (s: string, e: string, levels: [AssuranceLevel, AssuranceLevel, AssuranceLevel]) => {
    t[`${s}:${e}:C1`] = levels[0];
    t[`${s}:${e}:C2`] = levels[1];
    t[`${s}:${e}:C3`] = levels[2];
  };
  // Severity S1 — light/severe injuries, low exposure → controllability easy
  put('S1', 'E1', ['QM', 'QM', 'QM']);
  put('S1', 'E2', ['QM', 'QM', 'QM']);
  put('S1', 'E3', ['QM', 'QM', 'A']);
  put('S1', 'E4', ['QM', 'A', 'B']);
  // Severity S2 — severe/survivable injuries
  put('S2', 'E1', ['QM', 'QM', 'QM']);
  put('S2', 'E2', ['QM', 'QM', 'A']);
  put('S2', 'E3', ['QM', 'A', 'B']);
  put('S2', 'E4', ['A', 'B', 'C']);
  // Severity S3 — life-threatening/fatal
  put('S3', 'E1', ['QM', 'QM', 'A']);
  put('S3', 'E2', ['QM', 'A', 'B']);
  put('S3', 'E3', ['A', 'B', 'C']);
  put('S3', 'E4', ['B', 'C', 'D']);
  return Object.freeze(t);
})();

export type SEC = Pick<HazardState, 'severity' | 'exposure' | 'controllability'>;

/**
 * Derive the ASIL for a hazard's SEC triple. Pure table lookup — the ONLY
 * path to an assurance level. Unknown/unreviewed triples are 'UNMAPPED'.
 */
export function deriveASIL(input: SEC): AssuranceLevel | 'UNMAPPED' {
  const key = `${input.severity}:${input.exposure}:${input.controllability}`;
  return APPROVED_ASIL_TABLE[key] ?? 'UNMAPPED';
}

// ─── The evaluator (total, ordered, deterministic reason codes) ────────────

/**
 * evaluate — the governance decision function. Checks run in a FIXED order so
 * a refusal's reason code is deterministic for a given input:
 *
 *   time → subject → action → policy epoch → evidence manifest →
 *   hazard status → hazard ASIL → consent → harm-benefit
 *
 * A rule failure beyond this layer is rendered physical by the caller (the
 * diagnostics projection); here the contract is only allow/refuse + why.
 */
export function evaluate(input: GovernanceInput): GovernanceVerdict {
  const checks: CheckLog[] = [];

  // 1 · time — all clock references must be valid ISO strings
  if (
    !isValidIso(input?.observedAt) ||
    !isValidIso(input?.context?.now) ||
    !isValidIso(input?.context?.requestArrivedAt) ||
    (input?.context?.lastConfirmedAt != null && !isValidIso(input.context.lastConfirmedAt))
  ) {
    return refuse('MALFORMED_TIME', 'time', 'observedAt/context.now/requestArrivedAt/lastConfirmedAt is not a valid ISO timestamp', checks);
  }
  pass('time', `observedAt=${input.observedAt}`, checks);

  // 2 · subject — only an ACTIVE registered subject may act
  if (input.subject?.status === 'REVOKED') {
    return refuse('SUBJECT_REVOKED', 'subject', `subject ${input.subject.id ?? '?'} is revoked`, checks);
  }
  if (input.subject?.status !== 'ACTIVE') {
    return refuse('SUBJECT_UNKNOWN', 'subject', `subject ${input.subject?.id ?? '?'} is not registered ACTIVE`, checks);
  }
  pass('subject', `subject=${input.subject.id} ACTIVE`, checks);

  // 3 · action — only a registered ACTUATE-class action is governable here
  if (!input.action?.registered || input.action?.riskClass !== 'ACTUATE') {
    return refuse('ACTION_NOT_GOVERNED', 'action', `action ${input.action?.id ?? '?'} is not a registered ACTUATE action`, checks);
  }
  pass('action', `action=${input.action.id} registered ACTUATE`, checks);

  // 4 · policy epoch — the evaluation epoch must be the current epoch
  if (input.context.policyEpoch !== input.context.currentPolicyEpoch) {
    return refuse('POLICY_EPOCH_STALE', 'policy_epoch', `evaluation epoch ${input.context.policyEpoch} ≠ current epoch ${input.context.currentPolicyEpoch}`, checks);
  }
  pass('policy_epoch', `epoch=${input.context.policyEpoch}`, checks);

  // 4b · action single-flight — no second permit while one is in flight
  //      (outstanding unexpired nonce, or a permit still climbing the ladder)
  if (input.context.actionInFlight) {
    return refuse(
      'ACTION_IN_FLIGHT',
      'action_single_flight',
      'a permit for this action is already outstanding or executing',
      checks
    );
  }
  pass('action_single_flight', 'no permit in flight', checks);

  // 4c · duplicate detection — an execution that CONFIRMED after this
  //     request ARRIVED means this request is a concurrent duplicate of an
  //     intent already served (exactly-once per intent; a deliberate later
  //     request arrives after the last confirm and is allowed).
  if (
    input.context.lastConfirmedAt !== null &&
    Date.parse(input.context.lastConfirmedAt) > Date.parse(input.context.requestArrivedAt)
  ) {
    return refuse(
      'ACTION_DUPLICATE',
      'action_duplicate',
      `an execution of this action confirmed at ${input.context.lastConfirmedAt}, after this request arrived at ${input.context.requestArrivedAt}`,
      checks
    );
  }
  pass('action_duplicate', 'no execution confirmed since arrival', checks);

  // 5 · evidence manifest — the decision binds a manifest; a presented hash
  //     must equal the authoritative one
  if (!input.context.evidenceManifestHash) {
    return refuse('EVIDENCE_MANIFEST_MISSING', 'evidence_manifest', 'no authoritative evidence manifest bound', checks);
  }
  if (input.context.providedEvidenceManifestHash !== null && input.context.providedEvidenceManifestHash !== input.context.evidenceManifestHash) {
    return refuse('EVIDENCE_MANIFEST_MISMATCH', 'evidence_manifest', `presented manifest ${input.context.providedEvidenceManifestHash} ≠ authoritative ${input.context.evidenceManifestHash}`, checks);
  }
  pass('evidence_manifest', `bound ${input.context.evidenceManifestHash.slice(0, 16)}…`, checks);

  // 6 · hazards — every linked hazard mitigated, every ASIL mapped
  const hazards = Array.isArray(input.hazards) ? input.hazards : [];
  const unmitigated = hazards.find((h) => h.status !== 'MITIGATED');
  if (unmitigated) {
    return refuse('HAZARD_UNMITIGATED', 'hazard_status', `hazard ${unmitigated.id} is ${unmitigated.status}`, checks);
  }
  const unmapped = hazards.find((h) => deriveASIL(h) === 'UNMAPPED');
  if (unmapped) {
    return refuse(
      'ASIL_UNMAPPED',
      'hazard_asil',
      `hazard ${unmapped.id} SEC ${unmapped.severity}:${unmapped.exposure}:${unmapped.controllability} is not mapped by the approved method`,
      checks
    );
  }
  pass('hazard_status', hazards.length ? hazards.map((h) => `${h.id}:${h.status}:${deriveASIL(h)}`).join(' ') : 'no linked hazards', checks);

  // 7 · consent — present, for this subject, this action, this epoch
  if (!input.consent) {
    return refuse('CONSENT_MISSING', 'consent', `no consent on record for ${input.subject.id} → ${input.action.id}`, checks);
  }
  if (input.consent.subjectId !== input.subject.id) {
    return refuse('CONSENT_SUBJECT_MISMATCH', 'consent', `consent subject ${input.consent.subjectId} ≠ acting subject ${input.subject.id}`, checks);
  }
  if (input.consent.actionId !== input.action.id) {
    return refuse('CONSENT_ACTION_MISMATCH', 'consent', `consent action ${input.consent.actionId} ≠ requested action ${input.action.id}`, checks);
  }
  if (input.consent.policyEpoch !== input.context.currentPolicyEpoch) {
    return refuse('CONSENT_EPOCH_STALE', 'consent', `consent epoch ${input.consent.policyEpoch} ≠ current epoch ${input.context.currentPolicyEpoch}`, checks);
  }
  pass('consent', `consent ${input.consent.subjectId} → ${input.consent.actionId} @epoch ${input.consent.policyEpoch}`, checks);

  // 8 · harm-benefit — a parseable assessment where benefit exceeds harm
  if (!isValidIso(input.harmBenefit?.assessedAt)) {
    return refuse('HARM_BENEFIT_STALE', 'harm_benefit', 'harm-benefit assessment timestamp is malformed', checks);
  }
  if (!(typeof input.harmBenefit.benefit === 'number' && typeof input.harmBenefit.harm === 'number') || !(input.harmBenefit.benefit > input.harmBenefit.harm)) {
    return refuse('HARM_BENEFIT_NOT_SATISFIED', 'harm_benefit', `benefit ${input.harmBenefit?.benefit} does not exceed harm ${input.harmBenefit?.harm}`, checks);
  }
  pass('harm_benefit', `benefit ${input.harmBenefit.benefit} > harm ${input.harmBenefit.harm} (assessed ${input.harmBenefit.assessedAt})`, checks);

  return { allowed: true, checks };
}

// ─── Permits — payload, canonical serialization, execution shape ───────────

/** Exactly what gets signed. Flat, fully bound: action, subject, policy
 *  epoch, evidence manifest, nonce, governance event, key id, time window. */
export interface PermitPayload {
  permitId: string;
  actionId: string;
  actionNonce: string;
  subjectId: string;
  policyEpoch: number;
  evidenceManifestHash: string;
  governanceEventId: string;
  issuedAt: string;  // ISO
  expiresAt: string; // ISO
  keyId: string;
}

export interface ExecutionPermit extends PermitPayload {
  algorithm: 'Ed25519';
  /** base64url Ed25519 signature over canonicalPermitPayload(payload) */
  signature: string;
}

/**
 * Deterministic serialization for signing — sorted keys, recursively, so two
 * structurally equal payloads with different property ORDER produce the same
 * bytes. Never sign a JSON.stringify whose key order can vary.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`;
}

/** The exact bytes an Ed25519 key signs / verifies for a permit. */
export function canonicalPermitPayload(payload: PermitPayload): string {
  return stableStringify(payload);
}

// ─── Runtime contracts (implemented server-side; pure interfaces here) ─────

export interface NonceReservationInput {
  actionId: string;
  nonce: string;
  expiresAt: string; // ISO
  permitId?: string;
}

export type NonceReserveResult = 'RESERVED' | 'ALREADY_EXISTS';

export type NonceConsumeResult =
  | 'CONSUMED'
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'ALREADY_CONSUMED'
  | 'ABORTED';

export interface NonceConsumeInput {
  actionId: string;
  nonce: string;
  now: string; // ISO
}

/** Durable nonce store — the single-use guarantee lives here. */
export interface NonceStore {
  reserve(input: NonceReservationInput): Promise<NonceReserveResult>;
  consume(input: NonceConsumeInput): Promise<NonceConsumeResult>;
}

export interface PermitVerifyResult {
  valid: boolean;
  reasonCode?: string; // PERMIT_ALGORITHM | PERMIT_KEY_ID_MISMATCH | PERMIT_EXPIRED | PERMIT_SIGNATURE_INVALID | PERMIT_MALFORMED
}

/** Independent verifier — pinned key id, canonical payload, expiry-aware. */
export interface PermitVerifier {
  verify(permit: ExecutionPermit, nowIso?: string): PermitVerifyResult;
}

export interface WormEventAppendInput {
  type: 'GOVERNANCE_ALLOW' | 'GOVERNANCE_REFUSAL' | 'GOVERNANCE_EXECUTED' | 'PERMIT_ABORTED';
  eventId?: string;
  actionId?: string | null;
  subjectId?: string | null;
  permitId?: string | null;
  payload: Record<string, unknown>;
  observedAt: string; // ISO
}

export interface WormEventReceipt {
  seq: number;
  eventId: string;
  hash: string;
  prevHash: string;
}

/** The transactional boundary inside enforce(): reserve + seal + record. */
export interface GovernanceTx {
  reserveNonce(input: NonceReservationInput): Promise<NonceReserveResult>;
  appendWormEvent(input: WormEventAppendInput): Promise<WormEventReceipt>;
  createPermitRecord(record: {
    permitId: string;
    actionId: string;
    actionNonce: string;
    subjectId: string;
    policyEpoch: number;
    evidenceManifestHash: string;
    governanceEventId: string;
    issuedAt: string;
    expiresAt: string;
  }): Promise<void>;
}

/** The actuator contract. execute() re-verifies the permit itself — a direct
 *  call without a valid permit must fail (defense in depth, not trust). */
export interface Actuator {
  readonly actionId: string;
  execute(permit: ExecutionPermit): Promise<{ effectId: string; effect: string }>;
}

/** Registered actuator metadata (the registry's authoritative definition). */
export interface RegisteredActionDef {
  id: string;
  displayName: string;
  riskClass: RiskClass;
  requiresConsent: boolean;
  hazardIds: string[];
  harmBenefit: HarmBenefitState;
  description: string;
  effectKind: string;
  simulated: boolean;
}

/** What enforce() needs from the host. Implemented by the server runtime. */
export interface GovernanceRuntime {
  readonly permitTtlMs: number;
  readonly permitKeyId: string;
  readonly nonceStore: NonceStore;
  readonly permitVerifier: PermitVerifier;
  getActionRegistration(actionId: string): RegisteredActionDef | null;
  loadAuthoritativeContext(
    subjectId: string,
    actionId: string,
    opts?: { providedEvidenceManifestHash?: string | null; requestArrivedAt?: string }
  ): Promise<GovernanceInput>;
  /** Serializes issuance per action (in-process): the in-flight check +
   *  reserve must be atomic or two concurrent duplicate requests could both
   *  see "no permit in flight". Cross-process safety relies on SQLite's
   *  single-writer behaviour (disclosed limitation of the SIL slice). */
  issuanceSection<T>(actionId: string, fn: () => Promise<T>): Promise<T>;
  /** Serializes the WHOLE request path per action (issuance + execution):
   *  a queued duplicate request only starts after the winner completes, so
   *  the duplicate check (lastConfirmedAt vs requestArrivedAt) is evaluated
   *  against the winner's FINAL state — deterministically exactly-once per
   *  concurrent intent. */
  executionSection<T>(actionId: string, fn: () => Promise<T>): Promise<T>;
  transaction<T>(fn: (tx: GovernanceTx) => Promise<T>): Promise<T>;
  signPermit(payload: PermitPayload): Promise<ExecutionPermit>;
  markPermitSigned(permitId: string, signature: string, keyId: string): Promise<void>;
  /** permit → ABORTED, nonce → ABORTED, PERMIT_ABORTED sealed on the chain */
  abortPermit(permitId: string, reason: string): Promise<void>;
  resolveActuator(actionId: string): Promise<Actuator | null>;
}
