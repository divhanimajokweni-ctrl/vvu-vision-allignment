/**
 * Skylantern — Prisma-backed repository.
 *
 * The repository is the ONLY place that touches the database. The service
 * layer above it speaks pure TypeScript (DTOs), so the plugin can be unit-
 * tested or ported to a different storage backend without touching business
 * logic.
 */

import { db } from "@/lib/db";
import type {
  DeviceDTO,
  Domain,
  EvidenceRecordDTO,
  Primitive,
  VerificationState,
  WitnessDTO,
} from "../types";

// ---------------------------------------------------------------------------
// Mappers — DB row -> DTO.
// ---------------------------------------------------------------------------

/** Safely convert a Prisma DateTime field to ISO string. Handles both Date
 *  objects and ISO string values (Prisma + SQLite occasionally returns
 *  strings for DateTime fields depending on the query path). */
function toISO(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  if (value instanceof Date) return value.toISOString();
  // Already an ISO string
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

function mapWitness(w: {
  id: string;
  witnessType: string;
  witnessLabel: string;
  witnessKeyHint: string | null;
  signedAt: Date | string;
}): WitnessDTO {
  return {
    id: w.id,
    witnessType: w.witnessType as WitnessDTO["witnessType"],
    witnessLabel: w.witnessLabel,
    witnessKeyHint: w.witnessKeyHint,
    signedAt: toISO(w.signedAt),
  };
}

export function mapEvidence(
  row: {
    id: string;
    hash: string;
    previousHash: string | null;
    sequence: number;
    tierTag: number;
    verificationState: string;
    observedFact: string;
    derivedEvent: string | null;
    decision: string | null;
    subject: string;
    source: string;
    observedAt: Date | string;
    signedAt: Date | string;
    lat: number;
    lng: number;
    payload: string;
    signature: string;
    createdAt: Date | string;
    device: {
      id: string;
      externalId: string;
      label: string;
      domain: string;
      primitive: string;
    };
    witnesses: Array<{
      id: string;
      witnessType: string;
      witnessLabel: string;
      witnessKeyHint: string | null;
      signedAt: Date | string;
    }>;
  }
): EvidenceRecordDTO {
  return {
    id: row.id,
    hash: row.hash,
    previousHash: row.previousHash,
    sequence: row.sequence,
    tierTag: row.tierTag,
    verificationState: row.verificationState as VerificationState,
    observedFact: JSON.parse(row.observedFact),
    derivedEvent: row.derivedEvent ? JSON.parse(row.derivedEvent) : null,
    decision: row.decision ? JSON.parse(row.decision) : null,
    subject: row.subject,
    source: row.source,
    observedAt: toISO(row.observedAt),
    signedAt: toISO(row.signedAt),
    lat: row.lat,
    lng: row.lng,
    payload: row.payload,
    signature: row.signature,
    createdAt: toISO(row.createdAt),
    device: {
      id: row.device.id,
      externalId: row.device.externalId,
      label: row.device.label,
      domain: row.device.domain as Domain,
      primitive: row.device.primitive as Primitive,
    },
    witnesses: (row.witnesses ?? []).map(mapWitness),
  };
}

// ---------------------------------------------------------------------------
// Device repository.
// ---------------------------------------------------------------------------

export async function findDeviceByExternalId(
  externalId: string
) {
  return db.device.findUnique({ where: { externalId } });
}

export async function listDevices(): Promise<DeviceDTO[]> {
  const rows = await db.device.findMany({
    orderBy: { createdAt: "asc" },
  });
  // Aggregate evidence counts per device in a single query.
  const agg = await db.evidenceRecord.groupBy({
    by: ["deviceId"],
    _count: { _all: true },
  });
  // For latest verification state per device, fetch all evidence ordered
  // by observedAt desc and pick the first per deviceId in JS. Prisma's
  // `distinct` + `orderBy` combo on SQLite requires the orderBy field in
  // the select, which is fragile — this is simpler and just as fast for
  // the demo dataset.
  const latest = await db.evidenceRecord.findMany({
    orderBy: { observedAt: "desc" },
    select: {
      deviceId: true,
      verificationState: true,
      observedAt: true,
    },
  });
  const countByDevice = new Map(
    agg.map((a) => [a.deviceId, a._count._all] as const)
  );
  const stateByDevice = new Map<string, string>();
  for (const row of latest) {
    if (!stateByDevice.has(row.deviceId)) {
      stateByDevice.set(row.deviceId, row.verificationState);
    }
  }
  return rows.map((d) => ({
    id: d.id,
    externalId: d.externalId,
    label: d.label,
    domain: d.domain as Domain,
    primitive: d.primitive as Primitive,
    lat: d.lat,
    lng: d.lng,
    firmwareVersion: d.firmwareVersion,
    hardwareKeyHint: d.hardwareKeyHint,
    status: d.status as DeviceDTO["status"],
    pricingBand: d.pricingBand,
    lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
    evidenceCount: countByDevice.get(d.id) ?? 0,
    latestVerificationState:
      (stateByDevice.get(d.id) as VerificationState | undefined) ?? null,
  }));
}

export async function registerDevice(input: {
  externalId: string;
  label: string;
  domain: Domain;
  primitive: Primitive;
  lat: number;
  lng: number;
  firmwareVersion?: string;
  pricingBand?: string;
}) {
  return db.device.create({
    data: {
      externalId: input.externalId,
      label: input.label,
      domain: input.domain,
      primitive: input.primitive,
      lat: input.lat,
      lng: input.lng,
      firmwareVersion: input.firmwareVersion ?? null,
      hardwareKeyHint: hardwareKeyHintFor(input.externalId),
      pricingBand: input.pricingBand ?? null,
      status: "ACTIVE",
    },
  });
}

function hardwareKeyHintFor(externalId: string): string {
  // Lazy import to avoid a circular dependency in the browser bundle.
  // This file is server-only but Next.js statically analyses imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { hardwareKeyHint } = require("../wormchain");
  return hardwareKeyHint(externalId);
}

// ---------------------------------------------------------------------------
// Evidence repository.
// ---------------------------------------------------------------------------

export async function getChainHead(): Promise<{
  hash: string | null;
  sequence: number;
}> {
  const last = await db.evidenceRecord.findFirst({
    orderBy: { sequence: "desc" },
    select: { hash: true, sequence: true },
  });
  return {
    hash: last?.hash ?? null,
    sequence: last?.sequence ?? 0,
  };
}

export async function findEvidenceByHash(hash: string) {
  return db.evidenceRecord.findUnique({
    where: { hash },
    include: { device: true, witnesses: true },
  });
}

export async function findEvidenceById(id: string) {
  return db.evidenceRecord.findUnique({
    where: { id },
    include: { device: true, witnesses: true },
  });
}

export async function listEvidence(opts?: {
  limit?: number;
  domain?: Domain;
  state?: VerificationState;
  since?: Date;
}): Promise<EvidenceRecordDTO[]> {
  const limit = Math.min(opts?.limit ?? 200, 500);
  const where: Record<string, unknown> = {};
  if (opts?.domain) {
    where.device = { domain: opts.domain };
  }
  if (opts?.state) {
    where.verificationState = opts.state;
  }
  if (opts?.since) {
    where.observedAt = { gte: opts.since };
  }
  const rows = await db.evidenceRecord.findMany({
    where,
    orderBy: { sequence: "desc" },
    take: limit,
    include: { device: true, witnesses: true },
  });
  return rows.map((r) =>
    mapEvidence({
      ...r,
      witnesses: r.witnesses.map(mapWitness),
    })
  );
}

export async function listChain(limit = 50) {
  return db.evidenceRecord.findMany({
    orderBy: { sequence: "desc" },
    take: limit,
    select: {
      hash: true,
      previousHash: true,
      sequence: true,
      verificationState: true,
      tierTag: true,
      subject: true,
      source: true,
      observedAt: true,
      signedAt: true,
    },
  });
}

export async function createEvidenceRow(input: {
  hash: string;
  previousHash: string | null;
  sequence: number;
  tierTag: number;
  verificationState: VerificationState;
  observedFact: string;
  derivedEvent: string | null;
  decision: string | null;
  subject: string;
  source: string;
  observedAt: Date;
  lat: number;
  lng: number;
  payload: string;
  signature: string;
  deviceId: string;
}) {
  return db.evidenceRecord.create({
    data: {
      hash: input.hash,
      previousHash: input.previousHash,
      sequence: input.sequence,
      tierTag: input.tierTag,
      verificationState: input.verificationState,
      observedFact: input.observedFact,
      derivedEvent: input.derivedEvent,
      decision: input.decision,
      subject: input.subject,
      source: input.source,
      observedAt: input.observedAt,
      lat: input.lat,
      lng: input.lng,
      payload: input.payload,
      signature: input.signature,
      deviceId: input.deviceId,
      witnesses: { create: [] },
    },
    include: { device: true, witnesses: true },
  });
}

export async function attachWitnessRow(input: {
  evidenceId: string;
  witnessType: string;
  witnessLabel: string;
  witnessKeyHint: string | null;
}) {
  return db.witness.create({ data: input });
}

export async function elevateVerificationState(
  evidenceId: string,
  toState: VerificationState,
  tierTag?: number
) {
  return db.evidenceRecord.update({
    where: { id: evidenceId },
    data: {
      verificationState: toState,
      ...(tierTag !== undefined ? { tierTag } : {}),
    },
  });
}

export async function recordAudit(input: {
  evidenceId: string;
  action: string;
  fromState: string | null;
  toState: string | null;
  actor: string;
  note?: string | null;
}) {
  return db.auditEvent.create({
    data: { ...input, note: input.note ?? null },
  });
}

export async function listAuditEvents(evidenceId: string) {
  return db.auditEvent.findMany({
    where: { evidenceId },
    orderBy: { at: "asc" },
  });
}

/**
 * Mutate the stored payload of an evidence record (simulating a malicious
 * post-hoc edit). This does NOT touch the hash or signature — that's the
 * point. The next integrity check will recompute the hash from the mutated
 * payload, see it no longer matches the stored hash, and flag TAMPER_DETECTED.
 *
 * Returns the mutated row (with the original hash still stored, so the
 * mismatch is visible).
 */
export async function mutatePayloadForTamperDemo(
  evidenceId: string,
  mutatedPayload: string
) {
  return db.evidenceRecord.update({
    where: { id: evidenceId },
    data: { payload: mutatedPayload },
  });
}

/**
 * Fetch the full chain in ascending sequence order for integrity verification.
 * Returns the minimal fields needed to recompute hashes.
 */
export async function listChainAscending() {
  return db.evidenceRecord.findMany({
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      hash: true,
      previousHash: true,
      sequence: true,
      payload: true,
      signature: true,
      source: true,
      verificationState: true,
      subject: true,
      observedAt: true,
    },
  });
}

export async function findNeighborBlocks(sequence: number) {
  const [prev, next, current] = await Promise.all([
    db.evidenceRecord.findFirst({
      where: { sequence: sequence - 1 },
      select: {
        hash: true,
        sequence: true,
        subject: true,
        source: true,
        observedAt: true,
        verificationState: true,
      },
    }),
    db.evidenceRecord.findFirst({
      where: { sequence: sequence + 1 },
      select: {
        hash: true,
        previousHash: true,
        sequence: true,
        subject: true,
        source: true,
        observedAt: true,
        verificationState: true,
      },
    }),
    db.evidenceRecord.findFirst({
      where: { sequence },
      include: { device: true, witnesses: true },
    }),
  ]);
  return { prev, next, current };
}

// ---------------------------------------------------------------------------
// Subscriptions — commercial tier signups (slide 13).
// ---------------------------------------------------------------------------

export async function createSubscriptionRow(input: {
  tierKey: string;
  tierLabel: string;
  priceZAR: number;
  cadence: string;
  customerName: string;
  customerEmail: string;
  deviceExternalId: string | null;
}) {
  return db.subscription.create({ data: input });
}

export async function listSubscriptionRows() {
  return db.subscription.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function cancelSubscriptionRow(id: string) {
  return db.subscription.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Stats.
// ---------------------------------------------------------------------------

export async function computeStats() {
  const [devices, evidence, head, byState, byDomain, byPrimitive] =
    await Promise.all([
      db.device.count(),
      db.evidenceRecord.count(),
      getChainHead(),
      db.evidenceRecord.groupBy({
        by: ["verificationState"],
        _count: { _all: true },
      }),
      db.device.groupBy({
        by: ["domain"],
        _count: { _all: true },
      }),
      db.device.groupBy({
        by: ["primitive"],
        _count: { _all: true },
      }),
    ]);

  const activeDevices = await db.device.count({
    where: { status: "ACTIVE" },
  });
  const totalCandidates = byState.find(
    (s) => s.verificationState === "CANDIDATE"
  )?._count._all ?? 0;
  const totalVerified = byState.find(
    (s) => s.verificationState === "VERIFIED"
  )?._count._all ?? 0;
  const totalTamper = byState.find(
    (s) => s.verificationState === "TAMPER_DETECTED"
  )?._count._all ?? 0;

  const lastObserved = await db.evidenceRecord.findFirst({
    orderBy: { observedAt: "desc" },
    select: { observedAt: true },
  });

  return {
    totalDevices: devices,
    activeDevices,
    totalEvidence: evidence,
    byState,
    byDomain,
    byPrimitive,
    chainHead: head,
    totalCandidates,
    totalVerified,
    totalTamper: totalTamper,
    lastObservedAt: lastObserved?.observedAt.toISOString() ?? null,
  };
}
