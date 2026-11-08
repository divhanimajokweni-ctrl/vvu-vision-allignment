// src/server/worm-store.ts
// ─────────────────────────────────────────────────────────────────────────────
// The governance kernel's append-only event chain. SHA-256 hash chain with
// the same discipline as the estate's WormEvent ledger (genesis constant →
// prevHash linkage → full-chain verify by re-hashing), kept on its OWN table
// so governance events append inside the issuance transaction.
//
// hash = sha256( JSON.stringify([eventId, type, actionId, subjectId,
//          permitId, canonicalPayload, prevHash, observedAt]) )
//
// The chain verifies by re-hashing every row in seq order — no self-trust:
// verifyGovernanceChain recomputes from the rows themselves.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

import { createHash, randomUUID } from 'node:crypto';

import type { Prisma } from '@prisma/client';

import {
  stableStringify,
  type WormEventAppendInput,
  type WormEventReceipt,
} from '@/lib/governance-protocol';

type DbLike = Prisma.TransactionClient;

export const GENESIS_GOVERNANCE_KERNEL = 'GENESIS-GOVERNANCE-KERNEL-20260923-000000000000';

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

/** The hash preimage — fixed field order, canonical payload. */
export function wormEventPreimage(fields: {
  eventId: string;
  type: string;
  actionId: string | null;
  subjectId: string | null;
  permitId: string | null;
  payloadCanonical: string;
  prevHash: string;
  observedAt: string;
}): string {
  return JSON.stringify([
    fields.eventId,
    fields.type,
    fields.actionId,
    fields.subjectId,
    fields.permitId,
    fields.payloadCanonical,
    fields.prevHash,
    fields.observedAt,
  ]);
}

export async function appendGovernanceWormEvent(db: DbLike, input: WormEventAppendInput): Promise<WormEventReceipt> {
  const last = await db.governanceWormEvent.findFirst({ orderBy: { seq: 'desc' }, select: { hash: true } });
  const prevHash = last?.hash ?? GENESIS_GOVERNANCE_KERNEL;
  const eventId = input.eventId ?? randomUUID();
  const observedAt = input.observedAt;
  const payloadCanonical = stableStringify(input.payload ?? {});
  const hash = sha256Hex(
    wormEventPreimage({
      eventId,
      type: input.type,
      actionId: input.actionId ?? null,
      subjectId: input.subjectId ?? null,
      permitId: input.permitId ?? null,
      payloadCanonical,
      prevHash,
      observedAt,
    })
  );

  const row = await db.governanceWormEvent.create({
    data: {
      eventId,
      type: input.type,
      actionId: input.actionId ?? null,
      subjectId: input.subjectId ?? null,
      permitId: input.permitId ?? null,
      payload: payloadCanonical,
      prevHash,
      hash,
      observedAt: new Date(observedAt),
    },
  });

  return { seq: row.seq, eventId, hash, prevHash };
}

export interface GovernanceChainVerification {
  valid: boolean;
  count: number;
  headHash: string; // genesis when empty
  firstBadSeq: number | null;
}

/** Re-hash the WHOLE chain from the rows themselves. The invariants are
 *  hash linkage (each prevHash = the previous row's hash, genesis first)
 *  and STRICTLY MONOTONIC seq — not seq === index+1, because SQLite's
 *  AUTOINCREMENT counter survives row deletion (a wipe + re-append is a
 *  fresh chain, not a broken one; tampering with history always breaks it). */
export async function verifyGovernanceChain(db: DbLike): Promise<GovernanceChainVerification> {
  const rows = await db.governanceWormEvent.findMany({ orderBy: { seq: 'asc' } });
  let prev = GENESIS_GOVERNANCE_KERNEL;
  let prevSeq = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const expected = sha256Hex(
      wormEventPreimage({
        eventId: row.eventId,
        type: row.type,
        actionId: row.actionId,
        subjectId: row.subjectId,
        permitId: row.permitId,
        payloadCanonical: row.payload,
        prevHash: row.prevHash,
        observedAt: row.observedAt.toISOString(),
      })
    );
    if (row.prevHash !== prev || row.hash !== expected || row.seq <= prevSeq) {
      return { valid: false, count: rows.length, headHash: prev, firstBadSeq: row.seq };
    }
    prev = row.hash;
    prevSeq = row.seq;
  }
  return { valid: true, count: rows.length, headHash: prev, firstBadSeq: null };
}
