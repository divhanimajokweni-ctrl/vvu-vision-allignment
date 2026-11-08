/**
 * Skylantern — service layer.
 *
 * Orchestrates the WORM chain engine with the repository. Pure TypeScript:
 * takes DTOs in, returns DTOs out. No Next/React here.
 */

import {
  buildPayload,
  canTransition,
  computeHash,
  recomputeHash,
  signHash,
  tierTagFor,
  verifySignature,
} from "../wormchain";
import { skylanternConfig } from "../config";
import { PRICING_TIERS } from "../primitives";
import type {
  AttachWitnessRequest,
  AuditEventDTO,
  ChainIntegrityReport,
  CreateSubscriptionRequest,
  DeviceDTO,
  Domain,
  EvidenceRecordDTO,
  EvidencePayload,
  Primitive,
  RegisterDeviceRequest,
  StatsDTO,
  SubmitEvidenceRequest,
  SubscriptionDTO,
  VerificationState,
} from "../types";
import {
  attachWitnessRow,
  cancelSubscriptionRow,
  computeStats,
  createEvidenceRow,
  createSubscriptionRow,
  elevateVerificationState,
  findDeviceByExternalId,
  findEvidenceByHash,
  findEvidenceById,
  findNeighborBlocks,
  getChainHead,
  listAuditEvents,
  listChain,
  listChainAscending,
  listDevices,
  listEvidence,
  listSubscriptionRows,
  mapEvidence,
  mutatePayloadForTamperDemo,
  recordAudit,
  registerDevice as registerDeviceRow,
} from "./repository";

// ---------------------------------------------------------------------------
// Device registration.
// ---------------------------------------------------------------------------

export async function registerDevice(
  input: RegisterDeviceRequest
): Promise<DeviceDTO> {
  const existing = await findDeviceByExternalId(input.externalId);
  if (existing) {
    throw new ConflictError(
      `Device ${input.externalId} already registered`
    );
  }
  await registerDeviceRow({
    externalId: input.externalId,
    label: input.label,
    domain: input.domain,
    primitive: input.primitive,
    lat: input.lat,
    lng: input.lng,
    firmwareVersion: input.firmwareVersion,
    pricingBand: input.pricingBand,
  });
  const devices = await listDevices();
  const created = devices.find((d) => d.externalId === input.externalId);
  if (!created) throw new Error("Device registration race condition");
  return created;
}

// ---------------------------------------------------------------------------
// Evidence submission — the core "release a sky lantern" flow.
// ---------------------------------------------------------------------------

export async function submitEvidence(
  input: SubmitEvidenceRequest
): Promise<EvidenceRecordDTO> {
  const device = await findDeviceByExternalId(input.deviceExternalId);
  if (!device) {
    throw new NotFoundError(
      `Device ${input.deviceExternalId} not registered`
    );
  }

  const head = await getChainHead();
  const sequence = head.sequence + 1;
  const previousHash = head.hash;

  const observedAt = input.observedAt
    ? new Date(input.observedAt)
    : new Date();
  const observedAtISO = observedAt.toISOString();

  const lat = input.lat ?? device.lat;
  const lng = input.lng ?? device.lng;
  const subject =
    input.subject ??
    defaultSubjectFor(device.externalId, device.domain as Domain);

  const payload: EvidencePayload = buildPayload({
    subject,
    source: device.externalId,
    observedAt: observedAtISO,
    observedFact: input.observedFact,
    derivedEvent: input.derivedEvent ?? null,
    decision: input.decision ?? null,
    lat,
    lng,
    previousHash,
    sequence,
  });

  const hash = computeHash(payload);
  const signature = signHash(hash, device.externalId);

  // Sanity: the signature we just produced MUST verify. Catches a regression
  // in the wormchain engine before a bad record hits the database.
  if (!verifySignature(hash, signature, device.externalId)) {
    throw new Error("Signature self-verification failed");
  }

  const row = await createEvidenceRow({
    hash,
    previousHash,
    sequence,
    tierTag: 1, // CANDIDATE => R1
    verificationState: "CANDIDATE",
    observedFact: JSON.stringify(payload.observedFact),
    derivedEvent: payload.derivedEvent
      ? JSON.stringify(payload.derivedEvent)
      : null,
    decision: payload.decision ? JSON.stringify(payload.decision) : null,
    subject,
    source: device.externalId,
    observedAt,
    lat,
    lng,
    payload: JSON.stringify(payload),
    signature,
    deviceId: device.id,
  });

  await recordAudit({
    evidenceId: row.id,
    action: "CREATE",
    fromState: null,
    toState: "CANDIDATE",
    actor: device.externalId,
    note: `Block #${sequence} released. payload locked.`,
  });

  return mapEvidence({ ...row, witnesses: row.witnesses ?? [] });
}

// ---------------------------------------------------------------------------
// Witness attachment — elevate CANDIDATE -> VERIFIED.
// ---------------------------------------------------------------------------

export async function attachWitness(
  input: AttachWitnessRequest
): Promise<EvidenceRecordDTO> {
  const evidence = await findEvidenceById(input.evidenceId);
  if (!evidence) {
    throw new NotFoundError(`Evidence ${input.evidenceId} not found`);
  }

  if (evidence.verificationState !== "CANDIDATE") {
    throw new ConflictError(
      `Cannot elevate record in state ${evidence.verificationState}`
    );
  }

  await attachWitnessRow({
    evidenceId: input.evidenceId,
    witnessType: input.witnessType,
    witnessLabel: input.witnessLabel,
    witnessKeyHint: input.witnessKeyHint ?? null,
  });

  const witnessCount = (evidence.witnesses?.length ?? 0) + 1;
  const newState: VerificationState = "VERIFIED";
  const newTier = tierTagFor(newState, witnessCount);

  await elevateVerificationState(input.evidenceId, newState, newTier);
  await recordAudit({
    evidenceId: input.evidenceId,
    action: "WITNESS_ATTACHED",
    fromState: "CANDIDATE",
    toState: "VERIFIED",
    actor: input.witnessLabel,
    note: `witnessType=${input.witnessType}, tier=R${newTier}`,
  });

  const refreshed = await findEvidenceById(input.evidenceId);
  if (!refreshed) throw new Error("Refresh race condition");
  return mapEvidence({
    ...refreshed,
    witnesses: refreshed.witnesses ?? [],
  });
}

// ---------------------------------------------------------------------------
// Read paths.
// ---------------------------------------------------------------------------

export async function getEvidenceById(
  id: string
): Promise<EvidenceRecordDTO | null> {
  const row = await findEvidenceById(id);
  if (!row) return null;
  return mapEvidence({ ...row, witnesses: row.witnesses ?? [] });
}

export async function getEvidenceByHash(
  hash: string
): Promise<EvidenceRecordDTO | null> {
  const row = await findEvidenceByHash(hash);
  if (!row) return null;
  return mapEvidence({ ...row, witnesses: row.witnesses ?? [] });
}

export async function getDevices(): Promise<DeviceDTO[]> {
  return listDevices();
}

export async function getEvidenceList(opts?: {
  limit?: number;
  domain?: Domain;
  state?: VerificationState;
  since?: Date;
}): Promise<EvidenceRecordDTO[]> {
  return listEvidence(opts);
}

export async function getChain(limit = 50) {
  return listChain(limit);
}

export async function getStats(): Promise<StatsDTO> {
  const s = await computeStats();
  const verificationBreakdown = {
    CANDIDATE: 0,
    VERIFIED: 0,
    TAMPER_DETECTED: 0,
    ARCHIVED: 0,
  } as Record<VerificationState, number>;
  for (const row of s.byState) {
    verificationBreakdown[row.verificationState as VerificationState] =
      row._count._all;
  }
  const domainBreakdown = {
    WATER: 0,
    CELLPHONE: 0,
    VEHICLE: 0,
  } as Record<Domain, number>;
  for (const row of s.byDomain) {
    domainBreakdown[row.domain as Domain] = row._count._all;
  }
  const primitiveBreakdown: StatsDTO["primitiveBreakdown"] = {
    MOTION: 0,
    PROXIMITY: 0,
    STATE: 0,
    IDENTITY: 0,
    LOCATION: 0,
    ENVIRONMENT: 0,
  };
  const primitiveKeys = [
    "MOTION",
    "PROXIMITY",
    "STATE",
    "IDENTITY",
    "LOCATION",
    "ENVIRONMENT",
  ] as const;
  for (const p of primitiveKeys) {
    const found = s.byPrimitive.find((row) => row.primitive === p);
    primitiveBreakdown[p] = found?._count._all ?? 0;
  }

  const pricing = [
    { label: "Phone Pilot", band: "R25/mo", activeSubscriptions: 0 },
    { label: "Vehicle Hijack Alert", band: "R199/mo", activeSubscriptions: 0 },
    { label: "Fleet Evidence Log", band: "R250/mo", activeSubscriptions: 0 },
    { label: "Water Pilot Unit", band: "R999/90d", activeSubscriptions: 0 },
    {
      label: "Full DMA Rollout Deposit",
      band: "R9,999",
      activeSubscriptions: 0,
    },
  ];
  // Compute active subscriptions per pricing band from registered devices.
  const devices = await listDevices();
  for (const d of devices) {
    if (!d.pricingBand) continue;
    const idx = pricing.findIndex((p) => d.pricingBand?.startsWith(p.label));
    if (idx >= 0) pricing[idx].activeSubscriptions += 1;
  }

  return {
    totalDevices: s.totalDevices,
    activeDevices: s.activeDevices,
    totalEvidence: s.totalEvidence,
    verificationBreakdown,
    domainBreakdown,
    primitiveBreakdown: primitiveBreakdown as StatsDTO["primitiveBreakdown"],
    chainHead: {
      hash: s.chainHead.hash,
      sequence: s.chainHead.sequence,
      totalBlocks: s.totalEvidence,
      totalCandidates: s.totalCandidates,
      totalVerified: s.totalVerified,
      totalTamperDetected: s.totalTamper,
      lastObservedAt: s.lastObservedAt,
    },
    pricing,
  };
}

// ---------------------------------------------------------------------------
// Tamper detection — "We prove the record, not the reality."
// ---------------------------------------------------------------------------

/**
 * Simulate a malicious post-hoc edit of an evidence record's payload.
 *
 * This mutates the stored `payload` JSON (e.g. changing the flow reading from
 * 12.5 to 0.1 to hide a leak) WITHOUT updating the hash or signature. The next
 * integrity check will recompute the hash from the mutated payload, see it no
 * longer matches the stored hash, and flag the record as TAMPER_DETECTED.
 *
 * The chain still proves the record was not altered post-hoc — because the hash
 * no longer matches. This is the core "honest limits" promise in action.
 */
export async function simulateTamper(
  evidenceId: string,
  opts?: { field?: "value" | "raw"; newValue?: string }
): Promise<EvidenceRecordDTO> {
  const evidence = await findEvidenceById(evidenceId);
  if (!evidence) {
    throw new NotFoundError(`Evidence ${evidenceId} not found`);
  }
  if (evidence.verificationState === "TAMPER_DETECTED") {
    throw new ConflictError("Record already flagged as TAMPER_DETECTED");
  }
  if (evidence.verificationState === "ARCHIVED") {
    throw new ConflictError("Cannot tamper an archived record");
  }

  const payload: EvidencePayload = JSON.parse(evidence.payload);
  const field = opts?.field ?? "value";
  const fromState = evidence.verificationState as VerificationState;

  // Mutate the observed fact to simulate a malicious edit.
  if (field === "value") {
    const originalValue = payload.observedFact.value;
    const newValue =
      opts?.newValue ??
      (typeof originalValue === "number"
        ? 0
        : typeof originalValue === "string"
        ? "TAMPERED"
        : false);
    payload.observedFact.value = newValue;
  } else {
    payload.observedFact.raw = `[TAMPERED ${Date.now()}] ${payload.observedFact.raw}`;
  }

  // Write the mutated payload back. Hash + signature stay as the originals.
  await mutatePayloadForTamperDemo(evidenceId, JSON.stringify(payload));

  // Recompute the hash from the mutated payload and confirm the mismatch.
  const recomputed = recomputeHash(payload);
  const mismatch = recomputed !== evidence.hash;

  await elevateVerificationState(evidenceId, "TAMPER_DETECTED");
  await recordAudit({
    evidenceId,
    action: "TAMPER_FLAGGED",
    fromState,
    toState: "TAMPER_DETECTED",
    actor: "integrity-checker",
    note: mismatch
      ? `Payload mutated. recomputedHash=${recomputed.slice(0, 16)}... no longer matches stored hash.`
      : `Payload mutated but hash unexpectedly still matches (integrity-checker bug?).`,
  });

  const refreshed = await findEvidenceById(evidenceId);
  if (!refreshed) throw new Error("Refresh race condition");
  return mapEvidence({ ...refreshed, witnesses: refreshed.witnesses ?? [] });
}

// ---------------------------------------------------------------------------
// Audit timeline.
// ---------------------------------------------------------------------------

export async function getAuditTimeline(
  evidenceId: string
): Promise<AuditEventDTO[]> {
  const events = await listAuditEvents(evidenceId);
  return events.map((e) => ({
    id: e.id,
    action: e.action,
    fromState: e.fromState,
    toState: e.toState,
    actor: e.actor,
    note: e.note,
    at: e.at instanceof Date ? e.at.toISOString() : new Date(e.at).toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Chain integrity verification.
// ---------------------------------------------------------------------------

/**
 * Walk the entire chain in ascending sequence order. For each block:
 *   1. Recompute the hash from the stored payload.
 *   2. Compare to the stored hash. Mismatch => tampered.
 *   3. Verify the previousHash link matches the prior block's hash.
 *
 * Returns a full integrity report. This is the "court-grade" check that a
 * municipal auditor would run before accepting a Proof Bundle.
 */
export async function verifyChainIntegrity(): Promise<ChainIntegrityReport> {
  const blocks = await listChainAscending();
  const tampered: ChainIntegrityReport["tamperedBlocks"] = [];
  let allLinksValid = true;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const payload: EvidencePayload = JSON.parse(block.payload);
    const recomputed = recomputeHash(payload);

    if (recomputed !== block.hash) {
      tampered.push({
        sequence: block.sequence,
        hash: block.hash,
        recomputedHash: recomputed,
        subject: block.subject,
        source: block.source,
      });
    }

    // Check the previousHash link (except for genesis).
    if (i > 0) {
      const prev = blocks[i - 1];
      if (block.previousHash !== prev.hash) {
        allLinksValid = false;
      }
    }
  }

  return {
    totalBlocks: blocks.length,
    verified: blocks.length - tampered.length,
    tampered: tampered.length,
    tamperedBlocks: tampered,
    chainHeadSequence: blocks.length > 0 ? blocks[blocks.length - 1].sequence : 0,
    allLinksValid,
    checkedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Proof Bundle — for municipal auditors (slide 9).
// ---------------------------------------------------------------------------

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

export async function buildProofBundle(
  evidenceId: string
): Promise<ProofBundle | null> {
  const evidence = await findEvidenceById(evidenceId);
  if (!evidence) return null;

  const { prev, next } = await findNeighborBlocks(evidence.sequence);
  const audit = await getAuditTimeline(evidenceId);

  // Recompute hash + verify signature for the integrity section.
  const payload: EvidencePayload = JSON.parse(evidence.payload);
  const recomputed = recomputeHash(payload);
  const signatureValid = verifySignature(
    evidence.hash,
    evidence.signature,
    evidence.source
  );

  return {
    evidence: mapEvidence({ ...evidence, witnesses: evidence.witnesses ?? [] }),
    audit,
    neighbors: {
      previous: prev
        ? {
            sequence: prev.sequence,
            hash: prev.hash,
            subject: prev.subject,
            observedAt:
              prev.observedAt instanceof Date
                ? prev.observedAt.toISOString()
                : new Date(prev.observedAt).toISOString(),
            verificationState: prev.verificationState,
          }
        : null,
      next: next
        ? {
            sequence: next.sequence,
            hash: next.hash,
            previousHash: next.previousHash,
            subject: next.subject,
            observedAt:
              next.observedAt instanceof Date
                ? next.observedAt.toISOString()
                : new Date(next.observedAt).toISOString(),
            verificationState: next.verificationState,
          }
        : null,
    },
    integrity: {
      recomputedHash: recomputed,
      matchesStoredHash: recomputed === evidence.hash,
      signatureValid,
    },
    generatedAt: new Date().toISOString(),
    schemaVersion: "skylantern-proof-bundle/v1",
  };
}

// ---------------------------------------------------------------------------
// Archive — complete the state machine (TAMPER_DETECTED/VERIFIED → ARCHIVED).
// ---------------------------------------------------------------------------

/**
 * Archive an evidence record. This is the ONLY allowed transition from
 * TAMPER_DETECTED or VERIFIED. Once archived, a record is frozen — it can no
 * longer be modified, witnessed, or tampered with. This is the operator's
 * "close the case" action.
 */
export async function archiveEvidence(
  evidenceId: string,
  actor: string = "operator"
): Promise<EvidenceRecordDTO> {
  const evidence = await findEvidenceById(evidenceId);
  if (!evidence) {
    throw new NotFoundError(`Evidence ${evidenceId} not found`);
  }
  const fromState = evidence.verificationState as VerificationState;
  if (fromState === "ARCHIVED") {
    throw new ConflictError("Record already archived");
  }
  // Only TAMPER_DETECTED, VERIFIED, and CANDIDATE can be archived.
  if (!canTransition(fromState, "ARCHIVED")) {
    throw new ConflictError(
      `Cannot archive record in state ${fromState}`
    );
  }
  await elevateVerificationState(evidenceId, "ARCHIVED");
  await recordAudit({
    evidenceId,
    action: "ARCHIVED",
    fromState,
    toState: "ARCHIVED",
    actor,
    note: `Record archived by ${actor}. Frozen — no further transitions allowed.`,
  });
  const refreshed = await findEvidenceById(evidenceId);
  if (!refreshed) throw new Error("Refresh race condition");
  return mapEvidence({ ...refreshed, witnesses: refreshed.witnesses ?? [] });
}

// ---------------------------------------------------------------------------
// Subscriptions — commercial tier signups (slide 13).
// ---------------------------------------------------------------------------

export async function createSubscription(
  input: CreateSubscriptionRequest
): Promise<SubscriptionDTO> {
  const tier = PRICING_TIERS.find((t) => t.key === input.tierKey);
  if (!tier) {
    throw new NotFoundError(`Unknown pricing tier: ${input.tierKey}`);
  }
  if (!input.customerName || !input.customerEmail) {
    throw new ConflictError("customerName and customerEmail are required");
  }
  // Enforce the R9–R9,999 cap as a design constraint.
  if (
    tier.priceZAR < skylanternConfig.pricingBandFloorZAR ||
    tier.priceZAR > skylanternConfig.pricingBandCeilingZAR
  ) {
    throw new ConflictError(
      `Tier ${tier.label} (R${tier.priceZAR}) is outside the R${skylanternConfig.pricingBandFloorZAR}–R${skylanternConfig.pricingBandCeilingZAR} band.`
    );
  }
  const row = await createSubscriptionRow({
    tierKey: tier.key,
    tierLabel: tier.label,
    priceZAR: tier.priceZAR,
    cadence: tier.cadence,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    deviceExternalId: input.deviceExternalId ?? null,
  });
  return mapSubscription(row);
}

export async function getSubscriptions(): Promise<SubscriptionDTO[]> {
  const rows = await listSubscriptionRows();
  return rows.map(mapSubscription);
}

export async function cancelSubscription(id: string): Promise<SubscriptionDTO> {
  const row = await cancelSubscriptionRow(id);
  return mapSubscription(row);
}

function mapSubscription(row: {
  id: string;
  tierKey: string;
  tierLabel: string;
  priceZAR: number;
  cadence: string;
  customerName: string;
  customerEmail: string;
  deviceExternalId: string | null;
  status: string;
  startDate: Date | string;
  cancelledAt: Date | string | null;
  createdAt: Date | string;
}): SubscriptionDTO {
  const toISO = (v: Date | string | null): string | null => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString();
    return new Date(v).toISOString();
  };
  return {
    id: row.id,
    tierKey: row.tierKey,
    tierLabel: row.tierLabel,
    priceZAR: row.priceZAR,
    cadence: row.cadence,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    deviceExternalId: row.deviceExternalId,
    status: row.status as SubscriptionDTO["status"],
    startDate: toISO(row.startDate) ?? new Date(0).toISOString(),
    cancelledAt: toISO(row.cancelledAt),
    createdAt: toISO(row.createdAt) ?? new Date(0).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function defaultSubjectFor(externalId: string, domain: Domain): string {
  switch (domain) {
    case "WATER":
      return `DMA-CHAMBER-${externalId}`;
    case "CELLPHONE":
      return `PHONE-${externalId}`;
    case "VEHICLE":
      return `VIN-${externalId}`;
  }
}

// ---------------------------------------------------------------------------
// Errors.
// ---------------------------------------------------------------------------

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
