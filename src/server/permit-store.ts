// src/server/permit-store.ts
// ─────────────────────────────────────────────────────────────────────────────
// Permit record transitions. Every state change is a CONDITIONAL updateMany
// (compare-and-swap on the expected prior state) — a transition that "should
// have happened" either changes exactly one row or throws, so the record can
// never silently skip a rung of the ladder:
//
//   AUTHORIZED_UNSIGNED → SIGNED → ACTUATOR_STARTED → ACTUATOR_CONFIRMED
//   AUTHORIZED_UNSIGNED | SIGNED → ABORTED (signing/recovery failure)
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

import type { Prisma } from '@prisma/client';

import type { WormEventAppendInput } from '@/lib/governance-protocol';

type DbLike = Prisma.TransactionClient;

export interface PermitRecordInput {
  permitId: string;
  actionId: string;
  actionNonce: string;
  subjectId: string;
  policyEpoch: number;
  evidenceManifestHash: string;
  governanceEventId: string;
  issuedAt: string;
  expiresAt: string;
}

export async function createPermitRecord(db: DbLike, record: PermitRecordInput): Promise<void> {
  await db.governancePermit.create({
    data: {
      ...record,
      issuedAt: new Date(record.issuedAt),
      expiresAt: new Date(record.expiresAt),
      state: 'AUTHORIZED_UNSIGNED',
    },
  });
}

function cas(
  db: DbLike,
  where: Prisma.GovernancePermitWhereInput,
  data: Prisma.XOR<Prisma.GovernancePermitUpdateInput, Prisma.GovernancePermitUncheckedUpdateInput>
): Promise<number> {
  return db.governancePermit.updateMany({ where, data }).then((r) => r.count);
}

export async function markPermitSigned(db: DbLike, permitId: string, signature: string, keyId: string): Promise<void> {
  const n = await cas(db, { permitId, state: 'AUTHORIZED_UNSIGNED' }, {
    state: 'SIGNED',
    signature,
    keyId,
    signedAt: new Date(),
  });
  if (n !== 1) throw new Error(`PERMIT_STATE_UNEXPECTED:markPermitSigned:${permitId}`);
}

export async function markActuatorStarted(db: DbLike, permitId: string): Promise<void> {
  const n = await cas(db, { permitId, state: 'SIGNED' }, {
    state: 'ACTUATOR_STARTED',
    startedAt: new Date(),
  });
  if (n !== 1) throw new Error(`PERMIT_STATE_UNEXPECTED:markActuatorStarted:${permitId}`);
}

export async function markActuatorConfirmed(db: DbLike, permitId: string): Promise<void> {
  const n = await cas(db, { permitId, state: 'ACTUATOR_STARTED' }, {
    state: 'ACTUATOR_CONFIRMED',
    confirmedAt: new Date(),
  });
  if (n !== 1) throw new Error(`PERMIT_STATE_UNEXPECTED:markActuatorConfirmed:${permitId}`);
}

export async function markPermitAborted(db: DbLike, permitId: string, reason: string): Promise<void> {
  const n = await cas(db, { permitId, state: { in: ['AUTHORIZED_UNSIGNED', 'SIGNED'] } }, {
    state: 'ABORTED',
    abortedAt: new Date(),
    abortedReason: reason.slice(0, 512),
  });
  if (n !== 1) throw new Error(`PERMIT_STATE_UNEXPECTED:markPermitAborted:${permitId}`);
}

export async function getPermitByPermitId(db: DbLike, permitId: string) {
  return db.governancePermit.findUnique({ where: { permitId } });
}

export async function listRecentPermits(db: DbLike, take = 8) {
  return db.governancePermit.findMany({ orderBy: { issuedAt: 'desc' }, take });
}

export async function listRecentGovernanceEvents(db: DbLike, take = 12) {
  return db.governanceWormEvent.findMany({ orderBy: { seq: 'desc' }, take });
}

export type WormAppend = (input: WormEventAppendInput) => Promise<{ seq: number; eventId: string; hash: string }>;
