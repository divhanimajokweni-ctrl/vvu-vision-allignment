// src/server/nonce-store.ts
// ─────────────────────────────────────────────────────────────────────────────
// Durable nonce store. The single-use guarantee is the DATABASE's uniqueness
// constraint + a compare-and-swap update — never an in-memory map:
//
//   · RESERVE : INSERT (actionId, actionNonce) — PK collision = ALREADY_EXISTS
//   · CONSUME : conditional UPDATE ... WHERE state='RESERVED' AND expiresAt>now
//               exactly one of N concurrent consumers wins the row.
//
// Every function accepts a Prisma client OR transaction client, so reserve()
// composes inside the issuance transaction while consume() runs standalone at
// execution time.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

import type { Prisma } from '@prisma/client';

import type {
  NonceConsumeInput,
  NonceConsumeResult,
  NonceReservationInput,
  NonceReserveResult,
  NonceStore,
} from '@/lib/governance-protocol';

type DbLike = Prisma.TransactionClient;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

export async function reserveNonce(db: DbLike, input: NonceReservationInput): Promise<NonceReserveResult> {
  try {
    await db.governanceNonce.create({
      data: {
        actionId: input.actionId,
        actionNonce: input.nonce,
        state: 'RESERVED',
        expiresAt: new Date(input.expiresAt),
        reservedAt: new Date(),
        permitId: input.permitId ?? null,
      },
    });
    return 'RESERVED';
  } catch (error) {
    if (isUniqueViolation(error)) return 'ALREADY_EXISTS';
    throw error;
  }
}

export async function consumeNonce(db: DbLike, input: NonceConsumeInput): Promise<NonceConsumeResult> {
  const now = new Date(input.now);

  // Atomic claim: only a live RESERVED row can transition to CONSUMED.
  const claimed = await db.governanceNonce.updateMany({
    where: {
      actionId: input.actionId,
      actionNonce: input.nonce,
      state: 'RESERVED',
      expiresAt: { gt: now },
    },
    data: { state: 'CONSUMED', consumedAt: now },
  });
  if (claimed.count === 1) return 'CONSUMED';

  const row = await db.governanceNonce.findUnique({
    where: { actionId_actionNonce: { actionId: input.actionId, actionNonce: input.nonce } },
  });
  if (!row) return 'NOT_FOUND';
  if (row.state === 'CONSUMED') return 'ALREADY_CONSUMED';
  if (row.state === 'ABORTED') return 'ABORTED';
  return 'EXPIRED'; // RESERVED but past its expiry
}

/** Abort a nonce (issuance failure) — it stays permanently unusable. */
export async function abortNonce(db: DbLike, actionId: string, nonce: string): Promise<void> {
  await db.governanceNonce.updateMany({
    where: { actionId, actionNonce: nonce, state: 'RESERVED' },
    data: { state: 'ABORTED' },
  });
}

/** Spec-shaped store object bound to one client. */
export function createNonceStore(db: DbLike): NonceStore {
  return {
    reserve: (input) => reserveNonce(db, input),
    consume: (input) => consumeNonce(db, input),
  };
}
