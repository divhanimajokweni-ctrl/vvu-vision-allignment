// src/server/safegrid/canonical.ts
// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL HASHING CONTRACT — §3 of the ordering integration.
//
//   domain     = "VVU-WORM-v1"          (ASCII)
//   separator  = 0x00
//   canonical  = JCS(event_fields)      (RFC 8785 canonical JSON)
//   payload    = domain || 0x00 || canonical || 0x00 || hex_bytes(previous_record_hash)
//
//   record_hash := SHA-256(payload)
//
// event_fields = { event_id, event_type, payload, previous_record_hash }.
//
// THE STORED-BYTES RULE (the whole point): the canonical bytes hashed by
// the sealer are STORED on the seal (worm_seal_index.canonical_bytes) and
// any future verifier hashes THOSE bytes. NEVER hash a re-serialization of
// the payload at verify time — a JSON library upgrade can change the bytes
// for the same logical event, and then history would stop verifying.
// Verification therefore: sha256(stored_bytes) == canonical_event_hash,
// plus record_hash recomputed from stored_bytes + stored previous hash.
//
// JCS implementation: the estate's vetted in-tree RFC 8785 subset
// (src/lib/proofbridge/jcs.ts — used since the E2E runner brief for
// Ed25519 signing; PINNED by being estate-local code with its subset
// constraints labeled in-file: UTF-16 key sort, no whitespace, strings
// exactly as ECMAScript JSON.stringify, lone surrogates REJECTED, numbers
// SAFE INTEGERS ONLY — anything else fails closed). Pipeline payloads are
// integers/strings/booleans by construction, and ingest RE-CANONICALIZES
// every payload before accepting it, so a non-representable number is
// refused at the boundary (HTTP 400), never sealed.
//
// Timestamps: RFC 3339 with Z, millisecond precision — enforced at ingest
// for payload.occurred_at. Informational only; nothing orders by them.
//
// Genesis: the first record of each stream hashes previous_record_hash =
// 64 ASCII zeros (REPORTED — operator-decided, keeps every preimage in
// hex form so the domain-separated layout is unambiguous).
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';

import { canonicalize } from '@/lib/proofbridge/jcs';
import { WORM_ALGORITHM } from '@/lib/safegrid/types';

export const GENESIS_PREVIOUS_RECORD_HASH = '0'.repeat(64);

export interface CanonicalEventFields {
  event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  previous_record_hash: string;
}

/** JCS(event_fields) — the canonical bytes. Throws (fail closed) on any
 * value RFC 8785 + the estate subset cannot represent (floats, lone
 * surrogates, undefined, symbols, bigints). */
export function canonicalEventBytes(fields: CanonicalEventFields): string {
  return canonicalize({
    event_id: fields.event_id,
    event_type: fields.event_type,
    payload: fields.payload,
    previous_record_hash: fields.previous_record_hash,
  });
}

/** domain || 0x00 || canonical || 0x00 || hex_bytes(previous_record_hash) */
export function recordPreimage(canonical: string, previousRecordHashHex: string): Buffer {
  return Buffer.concat([
    Buffer.from(WORM_ALGORITHM, 'ascii'),
    Buffer.from([0x00]),
    Buffer.from(canonical, 'utf8'),
    Buffer.from([0x00]),
    Buffer.from(previousRecordHashHex, 'ascii'),
  ]);
}

/** record_hash := SHA-256(preimage). Computed over the EXACT canonical
 * bytes passed in — callers hand it the stored bytes at verify time. */
export function recordHashOf(canonical: string, previousRecordHashHex: string): string {
  return createHash('sha256').update(recordPreimage(canonical, previousRecordHashHex)).digest('hex');
}

/** sha256(canonical_bytes) — the tamper-evident digest of the stored
 * bytes themselves (independent of the previous-hash linkage). */
export function canonicalEventHashOf(canonical: string): string {
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/** RFC 3339 UTC millisecond precision (§3). Informational-only fields,
 * but the FORMAT is part of the contract so byte-level reproduction is
 * deterministic across producers. */
export const RFC3339_MS_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
