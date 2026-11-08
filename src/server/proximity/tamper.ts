// src/server/proximity/tamper.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE TAMPER DEMO — rewrite the STORED BYTES of a sealed record, then let
// the verifier pinpoint the break.
//
// THE BOUNDARY IS CODE, NOT A FLAG. tamperSealedRecord reads the record's
// `source` COLUMN from the database and refuses anything that is not
// 'simulator' with PRODUCTION_IMMUTABLE. There is no runtime switch to
// mis-set, no env var to leak, no flag whose bug becomes a hole in the
// demo: production sources are never mutable — only the simulator
// partition is demoable. The refusal is also PROBED live by the audit
// endpoint against the first production record it finds.
//
// WHAT IS REWRITTEN: worm_seal_index.canonical_bytes — the exact JCS bytes
// hashed at seal time. The digest (canonical_event_hash) is NOT touched,
// so the mismatch is exactly what the stored-bytes rule detects: the
// verifier re-hashes the stored bytes and they no longer match the digest
// recorded at seal time. BROKEN at proximity#N.
//
// RESTORE rebuilds the original bytes from the untampered proximity
// record row (the source of truth for the scan values) — recomputed
// through the same canonicalizer, and asserted byte-identical to a
// freshly canonicalized preimage before the write. Restore is honest:
// the chain returns to VALID because the bytes are the bytes that were
// sealed, not because the verifier was told to look away.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

import type { PrismaClient } from '@prisma/client';

import { canonicalEventBytes, canonicalEventHashOf } from '@/server/safegrid/canonical';
import { PROXIMITY_EVENT_TYPE } from '@/lib/proximity/types';

export class BoundaryViolationError extends Error {
  code = 'PRODUCTION_IMMUTABLE';
  constructor(eventId: string, source: string) {
    super(
      `record ${eventId} has source='${source}' — production sources are never mutable; ` +
        'only the simulator partition is demoable (boundary enforced in code, not a flag)',
    );
    this.name = 'BoundaryViolationError';
  }
}

export class TamperError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'TamperError';
  }
}

async function loadSealed(db: PrismaClient, eventId: string) {
  const record = await db.proximityRecord.findUnique({ where: { eventId } });
  if (!record) throw new TamperError('NOT_FOUND', `no proximity record ${eventId}`);
  // ─── THE CODE-ENFORCED BOUNDARY ───────────────────────────────────────────
  // A stored column, read at tamper time. No flag anywhere in this file.
  if (record.source !== 'simulator') throw new BoundaryViolationError(eventId, record.source);
  const seal = await db.wormSealIndex.findUnique({ where: { eventId } });
  if (!seal) throw new TamperError('NOT_SEALED', `record ${eventId} is not sealed`);
  return { record, seal };
}

/** Detect tampering WITHOUT trusting anything but the bytes + the digest. */
export async function isSealTampered(db: PrismaClient, eventId: string): Promise<boolean> {
  const seal = await db.wormSealIndex.findUnique({ where: { eventId } });
  if (!seal) return false;
  return canonicalEventHashOf(seal.canonicalBytes) !== seal.canonicalEventHash;
}

/**
 * Rewrite the stored canonical bytes of a SEALED SIMULATOR record: flip
 * distance_cm to a different value directly inside the stored bytes. This
 * is the demo's one button — the database-equivalent of an attacker
 * editing evidence in place.
 */
export async function tamperSealedRecord(
  db: PrismaClient,
  eventId: string,
): Promise<{ eventId: string; fieldAltered: string; fromValue: number; toValue: number; note: string }> {
  const { seal } = await loadSealed(db, eventId);
  if (await isSealTampered(db, eventId)) {
    throw new TamperError('ALREADY_TAMPERED', `record ${eventId} is already tampered — restore it first`);
  }

  let parsed: {
    payload?: { distance_cm?: unknown };
  };
  try {
    parsed = JSON.parse(seal.canonicalBytes);
  } catch {
    throw new TamperError('BAD_BYTES', 'stored bytes are not JSON');
  }
  const from = parsed.payload?.distance_cm;
  if (typeof from !== 'number' || !Number.isSafeInteger(from)) {
    throw new TamperError('BAD_FIELD', 'distance_cm missing from stored bytes');
  }
  const to = from === 12 ? 7 : 12; // a different integer — never the same value

  const bytes = JSON.parse(seal.canonicalBytes) as { payload: { distance_cm: number } };
  bytes.payload.distance_cm = to;
  // JSON.parse preserves key insertion order; JCS keys are sorted, so the
  // re-stringified bytes keep the canonical layout — only the VALUE moved.
  const tamperedBytes = JSON.stringify(bytes);
  if (tamperedBytes === seal.canonicalBytes) {
    throw new TamperError('NO_OP', 'rewrite produced identical bytes — refusing a no-op tamper');
  }

  await db.wormSealIndex.update({
    where: { eventId },
    data: { canonicalBytes: tamperedBytes },
  });
  return {
    eventId,
    fieldAltered: 'distance_cm',
    fromValue: from,
    toValue: to,
    note: `stored canonical bytes rewritten in place — distance_cm ${from} cm → ${to} cm; the seal digest still records the ORIGINAL bytes, so verification will break at this exact record`,
  };
}

/**
 * Restore: rebuild the original bytes from the untampered record row.
 * Fail-closed: if the rebuilt bytes' digest does not match the seal's
 * recorded canonical_event_hash, the row itself disagrees with the seal
 * and restore refuses (that would be a corrupted record, not a demo).
 */
export async function restoreSealedRecord(
  db: PrismaClient,
  eventId: string,
): Promise<{ eventId: string; restored: true; note: string }> {
  const { record, seal } = await loadSealed(db, eventId);
  const rebuilt = canonicalEventBytes({
    event_id: record.eventId,
    event_type: PROXIMITY_EVENT_TYPE,
    payload: {
      battery_mv: record.batteryMv,
      distance_cm: record.distanceCm,
      dwell_ms: record.dwellMs,
      occurred_at: record.occurredAt,
      risk_milli: record.riskMilli,
      rssi_dbm: record.rssiDbm,
      source: record.source,
      subject_id: record.subjectId,
    },
    previous_record_hash: seal.previousRecordHash,
  });
  const digest = canonicalEventHashOf(rebuilt);
  if (digest !== seal.canonicalEventHash) {
    throw new TamperError(
      'RECORD_ROW_DISAGREES',
      'rebuilt bytes do not match the seal digest — the record row itself disagrees with the seal; refusing to paper over a real corruption',
    );
  }
  await db.wormSealIndex.update({ where: { eventId }, data: { canonicalBytes: rebuilt } });
  return {
    eventId,
    restored: true,
    note: 'bytes rebuilt from the untampered record row through the same canonicalizer — digest matches, chain returns to VALID',
  };
}
