// src/server/safegrid/worm-chain.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE WORM CHAIN — appendIfAbsent + full verification.
//
// appendIfAbsent is ATOMIC against the worm_seal_index PRIMARY KEY on
// event_id: if a seal already exists for the event, the existing seal
// reference is returned WITHOUT appending a new chain entry. This is the
// correctness backstop against concurrent duplicate sealing — two racing
// appends for the same event produce exactly one chain record, and the
// loser deterministically learns the winner's seal.
//
// POSITION (§1.3, the ordering decision): assigned HERE, by the append
// operation, monotonically per stream — the only field that establishes
// chain order. Append order is authoritative; arrival order, decision
// creation order and every timestamp are NOT.
//
// GENESIS: the first record of a stream hashes previous_record_hash =
// 64 zeros (canonical.ts). Each subsequent record hashes its stream
// predecessor's record_hash — hash linkage is PER STREAM.
//
// SQLite notes (DISCLOSED): no Postgres in this sandbox. Concurrency is
// resolved by (a) SQLite's serialized writers, (b) the event_id PK and
// (stream_id, position) UNIQUE constraints, and (c) a bounded retry loop
// for Prisma P2034 write-conflict / unique-violation races. Under this
// estate's single-process dev topology the retries are belt-and-braces;
// the acceptance suite still exercises them with real concurrent calls.
//
// verifyChain NEVER re-serializes a payload: it re-hashes the STORED
// canonical bytes (§3's stored-bytes rule) and checks linkage, position
// arithmetic and canonical form.
// ─────────────────────────────────────────────────────────────────────────────

import type { PrismaClient, WormSealIndex } from '@prisma/client';
import { Prisma } from '@prisma/client';

import {
  GENESIS_PREVIOUS_RECORD_HASH,
  canonicalEventBytes,
  canonicalEventHashOf,
  recordHashOf,
} from './canonical';
import { WORM_ALGORITHM } from '@/lib/safegrid/types';
import type { ChainVerifyResult } from '@/lib/safegrid/types';

export interface AppendInput {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  streamId: string;
}

export type AppendOutcome =
  | { status: 'appended'; seal: WormSealIndex }
  | { status: 'existing'; seal: WormSealIndex };

const MAX_APPEND_RETRIES = 8;

/**
 * In-process append serialization (the Round-56 executionSection
 * discipline): Prisma interactive transactions over one SQLite file
 * contend for the connection pool AND the write lock; under a concurrent
 * burst they can deadlock into P2028/P1008 timeouts. The chain append is
 * a short critical section, so one async mutex PER PrismaClient instance
 * serializes it deterministically in-process. Cross-instance (two app
 * processes) correctness does NOT rely on this mutex — the event_id
 * PRIMARY KEY and (stream_id, position) UNIQUE constraint are the
 * authoritative backstops, with the retry loop below resolving races.
 */
const appendLocks = new WeakMap<object, Promise<unknown>>();

async function withAppendLock(db: object, fn: () => Promise<AppendOutcome>): Promise<AppendOutcome> {
  const tail = appendLocks.get(db) ?? Promise.resolve();
  const run = tail.then(fn, fn); // previous outcome is irrelevant; chain regardless
  appendLocks.set(db, run.catch(() => undefined)); // never let a rejection break the chain
  return run;
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

function isRetryableRace(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return e.code === 'P2002' || e.code === 'P2034' || e.code === 'P2028';
}

/** Build the seal row for (event, previous seal in stream). Pure.
 * (BigInt() calls instead of literals — the repo tsconfig targets ES2017.) */
function buildSeal(input: AppendInput, previous: WormSealIndex | null): WormSealIndex {
  const previousRecordHash = previous ? previous.recordHash : GENESIS_PREVIOUS_RECORD_HASH;
  const position = (previous ? previous.position : BigInt(0)) + BigInt(1);
  const canonical = canonicalEventBytes({
    event_id: input.eventId,
    event_type: input.eventType,
    payload: input.payload,
    previous_record_hash: previousRecordHash,
  });
  return {
    eventId: input.eventId,
    streamId: input.streamId,
    position,
    recordHash: recordHashOf(canonical, previousRecordHash),
    previousRecordHash,
    canonicalEventHash: canonicalEventHashOf(canonical),
    canonicalBytes: canonical, // THE SEALED BYTES — stored, never recomputed at verify time
    sealedAt: new Date(), // informational
    algorithm: WORM_ALGORITHM,
  };
}

/**
 * Append-if-absent. Returns 'existing' (with the winning seal) when a seal
 * for event_id already exists — never appends a second chain entry for the
 * same event. Retries bounded; any other error propagates (fail closed).
 */
export async function appendIfAbsent(db: PrismaClient, input: AppendInput): Promise<AppendOutcome> {
  return withAppendLock(db, async () => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < MAX_APPEND_RETRIES; attempt++) {
      try {
        return await db.$transaction(async (tx) => {
          // 1. Absent check — the primary-key backstop, first and fast.
          const existing = await tx.wormSealIndex.findUnique({ where: { eventId: input.eventId } });
          if (existing) return { status: 'existing' as const, seal: existing };

          // 2. Stream tail — position + previous hash (chain semantics).
          const previous = await tx.wormSealIndex.findFirst({
            where: { streamId: input.streamId },
            orderBy: { position: 'desc' },
          });

          // 3. Canonical bytes + hashes (§3), then the insert.
          const seal = buildSeal(input, previous);
          try {
            const created = await tx.wormSealIndex.create({ data: seal });
            return { status: 'appended' as const, seal: created };
          } catch (e) {
            if (isUniqueViolation(e)) {
              // event_id PK → concurrent duplicate won: return the winner.
              // (stream_id, position) → concurrent append of a DIFFERENT
              // event in the same stream won the tail: bubble up so the
              // outer loop re-reads the new tail and retries.
              const winner = await tx.wormSealIndex.findUnique({ where: { eventId: input.eventId } });
              if (winner) return { status: 'existing' as const, seal: winner };
            }
            throw e;
          }
        });
      } catch (e) {
        lastError = e;
        if (isRetryableRace(e)) {
          // A racing writer changed the tail or the row underneath us —
          // retry the whole read-modify-append.
          continue;
        }
        throw e;
      }
    }
    throw new Error(
      `worm-chain: appendIfAbsent exhausted ${MAX_APPEND_RETRIES} retries (last error: ${String(lastError)})`,
    );
  });
}

/**
 * Full-chain verification FROM STORED BYTES. For every stream, in position
 * order: canonical-bytes digest matches, bytes are still canonical JCS,
 * record_hash = SHA-256(domain‖0x00‖bytes‖0x00‖prev) over the STORED
 * bytes, previous_record_hash links to the stream predecessor (or
 * genesis), position is exactly previous+1, algorithm is pinned. Returns
 * the first breakage fail-closed style (valid:false) — never throws.
 */
export async function verifyChain(db: PrismaClient): Promise<ChainVerifyResult> {
  const t0 = Date.now();
  try {
    const seals = await db.wormSealIndex.findMany({
      orderBy: [{ streamId: 'asc' }, { position: 'asc' }],
    });
    const byStream = new Map<string, WormSealIndex[]>();
    for (const s of seals) {
      const list = byStream.get(s.streamId) ?? [];
      list.push(s);
      byStream.set(s.streamId, list);
    }
    let expectedPosition: bigint | null = null;
    let previous: WormSealIndex | null = null;
    for (const [streamId, list] of byStream) {
      expectedPosition = BigInt(1);
      previous = null;
      for (const seal of list) {
        const where = `${streamId}#${seal.position}`;
        if (seal.algorithm !== WORM_ALGORITHM) {
          return fail(t0, seals.length, byStream.size, where, `algorithm is not ${WORM_ALGORITHM}`);
        }
        if (seal.position !== expectedPosition) {
          return fail(t0, seals.length, byStream.size, where, `position ${seal.position} != expected ${expectedPosition} (append order must be gapless + monotonic per stream)`);
        }
        // Stored-bytes rule: digest the STORED bytes, never re-serialize.
        if (canonicalEventHashOf(seal.canonicalBytes) !== seal.canonicalEventHash) {
          return fail(t0, seals.length, byStream.size, where, 'canonical bytes do not match their stored digest (bytes altered)');
        }
        let parsed: { event_id?: unknown; event_type?: unknown; payload?: unknown; previous_record_hash?: unknown };
        try {
          parsed = JSON.parse(seal.canonicalBytes);
        } catch {
          return fail(t0, seals.length, byStream.size, where, 'stored canonical bytes are not valid JSON');
        }
        // The canonical bytes are SELF-CONTAINED event_fields — the
        // verifier reads event_id / event_type / previous_record_hash from
        // the stored bytes themselves (the seal row deliberately stores no
        // event_type column) and cross-checks identity against the row.
        if (typeof parsed.event_id !== 'string' || parsed.event_id !== seal.eventId) {
          return fail(t0, seals.length, byStream.size, where, 'stored bytes event_id does not match the seal row');
        }
        if (typeof parsed.event_type !== 'string' || parsed.event_type.length === 0) {
          return fail(t0, seals.length, byStream.size, where, 'stored bytes event_type missing/invalid');
        }
        if (typeof parsed.previous_record_hash !== 'string' || parsed.previous_record_hash !== seal.previousRecordHash) {
          return fail(t0, seals.length, byStream.size, where, 'stored bytes previous_record_hash does not match the seal row');
        }
        if (typeof parsed.payload !== 'object' || parsed.payload === null || Array.isArray(parsed.payload)) {
          return fail(t0, seals.length, byStream.size, where, 'stored bytes payload is not an object');
        }
        let reCanonical: string;
        try {
          reCanonical = canonicalEventBytes({
            event_id: parsed.event_id,
            event_type: parsed.event_type,
            payload: parsed.payload as Record<string, unknown>,
            previous_record_hash: parsed.previous_record_hash,
          });
        } catch {
          return fail(t0, seals.length, byStream.size, where, 'stored canonical bytes cannot be re-canonicalized (non-representable value)');
        }
        if (reCanonical !== seal.canonicalBytes) {
          return fail(t0, seals.length, byStream.size, where, 'stored bytes are not in canonical JCS form');
        }
        if (seal.previousRecordHash !== (previous ? previous.recordHash : GENESIS_PREVIOUS_RECORD_HASH)) {
          return fail(t0, seals.length, byStream.size, where, 'previous_record_hash does not link to the stream predecessor');
        }
        if (seal.recordHash !== recordHashOf(seal.canonicalBytes, seal.previousRecordHash)) {
          return fail(t0, seals.length, byStream.size, where, 'record_hash does not verify over the stored bytes');
        }
        expectedPosition += BigInt(1);
        previous = seal;
      }
    }
    return {
      valid: true,
      streams: byStream.size,
      records: seals.length,
      brokenAt: null,
      reason: null,
      checkedInMs: Date.now() - t0,
    };
  } catch (e) {
    return {
      valid: false,
      streams: 0,
      records: 0,
      brokenAt: null,
      reason: e instanceof Error ? e.message : String(e),
      checkedInMs: Date.now() - t0,
    };
  }
}

function fail(
  t0: number,
  records: number,
  streams: number,
  at: string,
  reason: string,
): ChainVerifyResult {
  return { valid: false, streams, records, brokenAt: at, reason, checkedInMs: Date.now() - t0 };
}
