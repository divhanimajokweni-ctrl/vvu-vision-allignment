// src/server/safegrid/ingest.ts
// ─────────────────────────────────────────────────────────────────────────────
// VVU INGESTION — the /api/safegrid/inbox core.
//
// Two steps, per the contract:
//
//   1. THE ATOMIC UPSERT (spec SQL, verbatim semantics):
//
//      INSERT INTO safegrid_inbox (consumer_name, event_id, event_type,
//                                  payload, status, seal_attempts, ...)
//      VALUES ($1, $2, $3, $4, 'sealing', 1, ...)
//      ON CONFLICT (consumer_name, event_id) DO UPDATE
//        SET status = CASE WHEN safegrid_inbox.status = 'sealed'
//                          THEN 'sealed' ELSE 'sealing' END,
//            seal_attempts = CASE WHEN safegrid_inbox.status = 'sealed'
//                          THEN safegrid_inbox.seal_attempts
//                          ELSE safegrid_inbox.seal_attempts + 1 END
//      RETURNING *;
//
//      (RETURNING is expressed as an immediate read-back inside the same
//      interactive transaction — identical atomicity on Prisma/SQLite,
//      where the whole transaction is serialized.)
//
//      received_at is deliberately NOT updated on conflict: it stays the
//      FIRST arrival, which is what the reconciler's 60-second rule
//      measures against.
//
//   2. If the row came back 'sealed' → DUPLICATE (2xx — the relay marks
//      delivered; duplicate arrival is never treated as terminal without
//      checking seal state). Otherwise appendIfAbsent → on success the
//      inbox row becomes 'sealed' with sealed_at + seal_ref. If
//      appendIfAbsent returns an EXISTING seal (crash between append and
//      inbox update — recovery point 7), the row is repaired with the
//      existing seal's reference and NOTHING is re-appended.
//
// Fail-closed validation happens BEFORE any write: wrong consumer, wrong
// event type, stream scope ≠ tenant_id, a `sequence` field in the payload
// (§1.1 — the contract forbids it), non-canonicalizable payloads, and
// malformed timestamps are all 400s. Nothing is inferred.
// ─────────────────────────────────────────────────────────────────────────────

import type { PrismaClient, SafegridInbox, WormSealIndex } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { RFC3339_MS_Z } from './canonical';
import { appendIfAbsent } from './worm-chain';
import {
  SAFEGRID_CONSUMER,
  SAFEGRID_EVENT_TYPE,
  type SafegridEnvelope,
} from '@/lib/safegrid/types';
import { canonicalize } from '@/lib/proofbridge/jcs';

export class IngestValidationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'IngestValidationError';
  }
}

export class IngestSealError extends Error {
  constructor(message: string, public cause: unknown) {
    super(message);
    this.name = 'IngestSealError';
  }
}

export type IngestOutcome =
  | { outcome: 'sealed'; appended: boolean; inbox: SafegridInbox; seal: WormSealIndex }
  | { outcome: 'duplicate'; inbox: SafegridInbox };

/** Fail-closed envelope validation. Throws IngestValidationError (→ 400). */
export function validateEnvelope(body: unknown): SafegridEnvelope {
  if (typeof body !== 'object' || body === null) {
    throw new IngestValidationError('BAD_BODY', 'body must be a JSON object');
  }
  const b = body as Record<string, unknown>;
  const consumerName = b.consumer_name;
  if (consumerName !== SAFEGRID_CONSUMER) {
    throw new IngestValidationError('BAD_CONSUMER', `consumer_name must be '${SAFEGRID_CONSUMER}'`);
  }
  const eventId = b.event_id;
  if (typeof eventId !== 'string' || eventId.length === 0 || eventId.length > 200) {
    throw new IngestValidationError('BAD_EVENT_ID', 'event_id must be a string of 1..200 chars');
  }
  const eventType = b.event_type;
  if (eventType !== SAFEGRID_EVENT_TYPE) {
    throw new IngestValidationError('BAD_EVENT_TYPE', `event_type must be '${SAFEGRID_EVENT_TYPE}'`);
  }
  const payload = b.payload;
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new IngestValidationError('BAD_PAYLOAD', 'payload must be a JSON object');
  }
  const p = payload as Record<string, unknown>;
  if ('sequence' in p) {
    // §1.1: the payload must not carry a claimed global sequence. Enforced
    // at the boundary — the contract violation is refused, not repaired.
    throw new IngestValidationError(
      'SEQUENCE_FIELD_FORBIDDEN',
      'payload must not contain a sequence field — chain order is worm_seal_index.position, assigned by the WORM append',
    );
  }
  const tenantId = p.tenant_id;
  if (typeof tenantId !== 'string' || tenantId.length === 0 || tenantId.length > 200) {
    throw new IngestValidationError('BAD_TENANT', 'payload.tenant_id must be a string of 1..200 chars');
  }
  const streamId = b.stream_id;
  if (typeof streamId !== 'string' || streamId.length === 0) {
    throw new IngestValidationError('BAD_STREAM', 'stream_id must be a non-empty string');
  }
  if (streamId !== tenantId) {
    // §1.5: the stream scope is DECLARED (stream_id = tenant_id). A payload
    // claiming a different scope is refused — scope changes are new stream
    // identifiers, never reinterpretations.
    throw new IngestValidationError(
      'STREAM_SCOPE_MISMATCH',
      `stream_id ('${streamId}') must equal payload.tenant_id ('${tenantId}') — declared stream scope for this pipeline`,
    );
  }
  const occurredAt = p.occurred_at;
  if (typeof occurredAt !== 'string' || !RFC3339_MS_Z.test(occurredAt)) {
    throw new IngestValidationError(
      'BAD_OCCURRED_AT',
      'payload.occurred_at must be RFC 3339 UTC with millisecond precision and Z (e.g. 2026-09-23T12:00:00.000Z)',
    );
  }
  const localDecisionId = p.local_decision_id;
  if (localDecisionId !== undefined &&
      (typeof localDecisionId !== 'number' || !Number.isSafeInteger(localDecisionId) || localDecisionId < 0)) {
    throw new IngestValidationError(
      'BAD_LOCAL_DECISION_ID',
      'payload.local_decision_id must be a safe integer >= 0 (local insertion order — diagnostic only)',
    );
  }
  // §3: the payload must be canonicalizable (JCS subset: safe integers,
  // no lone surrogates...). A non-representable number is refused at the
  // boundary, never sealed.
  try {
    canonicalize(p);
  } catch (e) {
    throw new IngestValidationError(
      'PAYLOAD_NOT_CANONICALIZABLE',
      `payload is not representable in canonical JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  return {
    consumer_name: consumerName,
    event_id: eventId,
    event_type: eventType,
    stream_id: streamId,
    payload: p,
  };
}

function sealRefOf(seal: { streamId: string; position: bigint }): string {
  return `${seal.streamId}#${seal.position}`;
}

/**
 * The inbox core. Step 1: atomic upsert. Step 2: duplicate check →
 * appendIfAbsent → seal-state update. Throws IngestSealError on append
 * failure (→ HTTP 500, relay retries, row stays reconciler-eligible).
 */
export async function ingestEvent(
  db: PrismaClient,
  envelope: SafegridEnvelope,
): Promise<IngestOutcome> {
  // ── Step 1: atomic upsert (spec SQL) + read-back, one transaction ──────
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + 30_000); // informational seal-lease bookkeeping (SPEC: measure in pilot)
  const row = await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO safegrid_inbox
        (id, consumer_name, event_id, event_type, stream_id, payload,
         status, received_at, lease_until, seal_attempts)
      VALUES
        (${crypto.randomUUID()}, ${envelope.consumer_name}, ${envelope.event_id},
         ${envelope.event_type}, ${envelope.stream_id},
         ${JSON.stringify(envelope.payload)},
         'sealing', ${now}, ${leaseUntil}, 1)
      ON CONFLICT (consumer_name, event_id) DO UPDATE SET
        status = CASE WHEN safegrid_inbox.status = 'sealed'
                      THEN 'sealed' ELSE 'sealing' END,
        seal_attempts = CASE WHEN safegrid_inbox.status = 'sealed'
                      THEN safegrid_inbox.seal_attempts
                      ELSE safegrid_inbox.seal_attempts + 1 END,
        lease_until = ${leaseUntil}`;
    return tx.safegridInbox.findUnique({
      where: { consumerName_eventId: { consumerName: envelope.consumer_name, eventId: envelope.event_id } },
    });
  });
  if (!row) {
    // Unreachable unless the upsert+readback raced outside the tx — fail closed.
    throw new IngestSealError('inbox row missing after upsert', null);
  }

  // ── Step 2: duplicate check, then seal ──────────────────────────────────
  if (row.status === 'sealed') {
    // Duplicate arrival WITH a terminal seal — idempotent success.
    return { outcome: 'duplicate', inbox: row };
  }

  try {
    const append = await appendIfAbsent(db, {
      eventId: envelope.event_id,
      eventType: envelope.event_type,
      payload: envelope.payload,
      streamId: envelope.stream_id,
    });
    const updated = await db.safegridInbox.update({
      where: { consumerName_eventId: { consumerName: envelope.consumer_name, eventId: envelope.event_id } },
      data: {
        status: 'sealed',
        sealedAt: new Date(),
        sealRef: sealRefOf(append.seal),
        lastSealError: null,
        leaseUntil: null,
      },
    });
    return { outcome: 'sealed', appended: append.status === 'appended', inbox: updated, seal: append.seal };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.safegridInbox.update({
      where: { consumerName_eventId: { consumerName: envelope.consumer_name, eventId: envelope.event_id } },
      data: { status: 'seal_failed', lastSealError: message, leaseUntil: null },
    }).catch(() => undefined);
    throw new IngestSealError(`sealing failed for ${envelope.event_id}: ${message}`, e);
  }
}

/** Backstop for tests/diagnostics: is a Prisma error a known request error? */
export function isPrismaKnown(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError;
}
