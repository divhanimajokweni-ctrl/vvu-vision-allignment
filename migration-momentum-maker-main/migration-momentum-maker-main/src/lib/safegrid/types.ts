// src/lib/safegrid/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// SAFEGRID PIPELINE — shared contract types (client-safe: no server-only
// imports; imported by the API routes, the server modules, the tests and
// the #/safegrid workspace).
//
// Ordering contract (§1, REPORTED — binding): the WORM chain's append
// order is the authoritative order for the stream. The event payload
// carries NO `sequence` field; `local_decision_id` (when present) is
// SafeGrid-local insertion order, diagnostic only. No timestamp in this
// pipeline establishes order.
// ─────────────────────────────────────────────────────────────────────────────

export const WORM_ALGORITHM = 'VVU-WORM-v1';
export const SAFEGRID_EVENT_TYPE = 'safegrid.decision.v1';
export const SAFEGRID_CONSUMER = 'vvu';

/** The POST envelope SafeGrid's relay sends to /api/safegrid/inbox. */
export interface SafegridEnvelope {
  consumer_name: string;
  event_id: string;
  event_type: string;
  stream_id: string; // declared scope: stream_id = tenant_id (enforced)
  payload: Record<string, unknown>;
}

export type InboxStatus = 'received' | 'sealing' | 'sealed' | 'seal_failed';
export type OutboxState = 'pending' | 'processing' | 'delivered' | 'failed';

export interface InboxRowView {
  id: string;
  consumerName: string;
  eventId: string;
  eventType: string;
  streamId: string;
  status: InboxStatus;
  receivedAt: string;
  sealAttempts: number;
  lastSealError: string | null;
  sealedAt: string | null;
  sealRef: string | null;
}

export interface SealRowView {
  eventId: string;
  streamId: string;
  position: string; // BigInt → string for JSON transport
  recordHash: string;
  previousRecordHash: string;
  canonicalEventHash: string;
  sealedAt: string;
  algorithm: string;
}

export interface ChainVerifyResult {
  valid: boolean;
  streams: number;
  records: number;
  brokenAt: string | null;
  reason: string | null;
  checkedInMs: number;
}
