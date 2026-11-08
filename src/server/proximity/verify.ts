// src/server/proximity/verify.ts
// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — VERIFY: walk the proximity stream and pinpoint the break.
//
// The stored-bytes rule, enforced: the verifier re-hashes the STORED
// canonical bytes (sha256(bytes) == canonical_event_hash), recomputes
// record_hash over the stored bytes + stored previous hash, and checks
// linkage + position arithmetic. It NEVER re-serializes the payload — a
// JSON library upgrade cannot make history stop verifying.
//
// Unlike the estate-wide verifyChain (first break only, all streams),
// this walker returns a PER-RECORD status so the demo can light up the
// exact sealed row that broke: "BROKEN at proximity#3".
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

import type { PrismaClient, WormSealIndex } from '@prisma/client';

import {
  GENESIS_PREVIOUS_RECORD_HASH,
  canonicalEventBytes,
  canonicalEventHashOf,
  recordHashOf,
} from '@/server/safegrid/canonical';
import { WORM_ALGORITHM } from '@/lib/safegrid/types';
import {
  PROXIMITY_STREAM_ID,
  formatUtc,
  type ChainRecordView,
  type PerRecordVerify,
  type ProximityVerifyResult,
} from '@/lib/proximity/types';

function checkSeal(seal: WormSealIndex, expectedPosition: bigint, previousRecordHash: string): string | null {
  if (seal.algorithm !== WORM_ALGORITHM) return `algorithm is not ${WORM_ALGORITHM}`;
  if (seal.position !== expectedPosition) {
    return `position ${seal.position} != expected ${expectedPosition} (append order must be gapless)`;
  }
  // THE STORED-BYTES RULE — the tamper detector.
  if (canonicalEventHashOf(seal.canonicalBytes) !== seal.canonicalEventHash) {
    return 'canonical bytes do not match their stored digest (bytes altered after seal)';
  }
  let parsed: { event_id?: unknown; event_type?: unknown; payload?: unknown; previous_record_hash?: unknown };
  try {
    parsed = JSON.parse(seal.canonicalBytes);
  } catch {
    return 'stored canonical bytes are not valid JSON';
  }
  if (typeof parsed.event_id !== 'string' || parsed.event_id !== seal.eventId) {
    return 'stored bytes event_id does not match the seal row';
  }
  if (typeof parsed.event_type !== 'string' || parsed.event_type.length === 0) {
    return 'stored bytes event_type missing/invalid';
  }
  if (
    typeof parsed.previous_record_hash !== 'string' ||
    parsed.previous_record_hash !== seal.previousRecordHash
  ) {
    return 'stored bytes previous_record_hash does not match the seal row';
  }
  if (typeof parsed.payload !== 'object' || parsed.payload === null || Array.isArray(parsed.payload)) {
    return 'stored bytes payload is not an object';
  }
  if (seal.previousRecordHash !== previousRecordHash) {
    return 'previous_record_hash does not link to the stream predecessor';
  }
  if (seal.recordHash !== recordHashOf(seal.canonicalBytes, seal.previousRecordHash)) {
    return 'record_hash does not verify over the stored bytes';
  }
  return null;
}

/** Full proximity-stream verification with per-record status. */
export async function verifyProximityChain(db: PrismaClient): Promise<ProximityVerifyResult> {
  const t0 = Date.now();
  const seals = await db.wormSealIndex.findMany({
    where: { streamId: PROXIMITY_STREAM_ID },
    orderBy: { position: 'asc' },
  });

  const perRecord: PerRecordVerify[] = [];
  let brokenAt: string | null = null;
  let reason: string | null = null;
  let expectedPosition = BigInt(1);
  let previousRecordHash = GENESIS_PREVIOUS_RECORD_HASH;
  let lastSeal: WormSealIndex | null = null;

  for (const seal of seals) {
    const fault = checkSeal(seal, expectedPosition, previousRecordHash);
    const where = `proximity#${seal.position}`;
    perRecord.push({
      position: Number(seal.position),
      eventId: seal.eventId,
      status: fault ? 'BROKEN' : 'OK',
      reason: fault,
    });
    if (fault && brokenAt === null) {
      brokenAt = where;
      reason = fault;
    }
    expectedPosition += BigInt(1);
    previousRecordHash = seal.recordHash; // linkage carries the RECORDED hash forward
    lastSeal = seal;
  }

  return {
    streamId: PROXIMITY_STREAM_ID,
    valid: brokenAt === null,
    records: seals.length,
    headHash: lastSeal?.recordHash ?? null,
    headPosition: lastSeal ? Number(lastSeal.position) : null,
    brokenAt,
    reason,
    perRecord,
    checkedAtUtc: formatUtc(Date.now()),
    checkedInMs: Date.now() - t0,
  };
}

/** Chain rows (joined with the record row for source/subject display). */
export async function listChain(db: PrismaClient): Promise<ChainRecordView[]> {
  const seals = await db.wormSealIndex.findMany({
    where: { streamId: PROXIMITY_STREAM_ID },
    orderBy: { position: 'asc' },
  });
  const ids = seals.map((s) => s.eventId);
  const rows = await db.proximityRecord.findMany({ where: { eventId: { in: ids } } });
  const byId = new Map(rows.map((r) => [r.eventId, r]));
  return seals.map((s) => {
    const r = byId.get(s.eventId);
    return {
      eventId: s.eventId,
      position: s.position.toString(),
      recordHash: s.recordHash,
      previousRecordHash: s.previousRecordHash,
      canonicalEventHash: s.canonicalEventHash,
      canonicalBytes: s.canonicalBytes,
      sealedAtUtc: formatUtc(s.sealedAt),
      algorithm: s.algorithm,
      source: r?.source ?? 'unknown',
      subjectId: r?.subjectId ?? 'unknown',
    };
  });
}

/** Detect whether a seal's stored bytes still match their digest. */
export function sealDigestOk(seal: { canonicalBytes: string; canonicalEventHash: string }): boolean {
  return canonicalEventHashOf(seal.canonicalBytes) === seal.canonicalEventHash;
}
