// src/lib/proximity/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// PROXIMITY RECORD LAYER — shared contracts (client-safe, no server imports).
//
// The four-step pipeline:
//   1. CONTRACT      — vvu.proximity.scan.v1, integer-only, unit-suffixed
//   2. GOVERNANCE    — explicit ALLOW/REFUSE gate + suppression decision
//   3. SEAL          — the estate's WormSealIndex kernel on its own stream
//   4. VERIFY        — re-hash the STORED bytes, pinpoint the break
//
// DATA PRESENTATION (docs/DATA_PRESENTATION_SPEC.md):
//   · every numeric value carries its unit AND its meaning — 821 is never
//     rendered bare; it is "821 milli · RISK 0.821"
//   · every timestamp is rendered "YYYY-MM-DD HH:MM:SS UTC" — one clock,
//     the server cluster clock, no local timezone ever displayed
//   · every feature block is atomic — one primary system indicator per
//     card, so blocks survive grid reflows unchanged
// ─────────────────────────────────────────────────────────────────────────────

export const PROXIMITY_EVENT_TYPE = 'vvu.proximity.scan.v1';
export const PROXIMITY_STREAM_ID = 'proximity.gqeberha.v1';

/** RISK display: milli-integer 821 ≡ 0.821 (three decimals, always). */
export function riskMilliToDisplay(milli: number): string {
  return (milli / 1000).toFixed(3);
}

/** "2026-11-03 22:14:07 UTC" — the estate's single display clock. */
export function formatUtc(ms: number | Date | string): string {
  const d = ms instanceof Date ? ms : new Date(ms);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`
  );
}

export interface ScanPass {
  rule: string; // 'CONTRACT' | 'ENROLMENT' | 'SUPPRESS_ACTION' | 'EXTENDED_DWELL'
  verdict: 'PASS' | 'REFUSED' | 'FIRED';
  detail: string; // precise, labeled — includes units
}

export interface SealReceipt {
  position: string; // BigInt serialized
  recordHash: string;
  previousRecordHash: string;
  canonicalEventHash: string;
  canonicalBytes: string;
  algorithm: string;
}

export interface ScanOutcome {
  eventId: string;
  source: string;
  gate: { decision: 'ALLOW' | 'REFUSE'; reason: string };
  passes: ScanPass[];
  action: 'PASS_THROUGH' | 'SUPPRESS' | 'NONE';
  rulesFired: string[];
  sealed: boolean;
  seal?: SealReceipt;
  occurredAt: string;
  ingestedAtUtc: string;
}

export interface ProximityRecordView {
  eventId: string;
  source: string;
  subjectId: string;
  distanceCm: number;
  rssiDbm: number;
  batteryMv: number;
  dwellMs: number;
  riskMilli: number;
  occurredAt: string;
  gateDecision: string;
  gateReason: string;
  action: string;
  rulesFired: string; // JSON array
  sealRef: string | null;
  ingestedAtUtc: string;
}

export interface ChainRecordView {
  eventId: string;
  position: string;
  recordHash: string;
  previousRecordHash: string;
  canonicalEventHash: string;
  canonicalBytes: string;
  sealedAtUtc: string;
  algorithm: string;
  source: string; // joined from the record row
  subjectId: string;
}

export interface PerRecordVerify {
  position: number;
  eventId: string;
  status: 'OK' | 'BROKEN';
  reason: string | null;
}

export interface ProximityVerifyResult {
  streamId: string;
  valid: boolean;
  records: number;
  headHash: string | null;
  headPosition: number | null;
  brokenAt: string | null; // e.g. "proximity#3"
  reason: string | null;
  perRecord: PerRecordVerify[];
  checkedAtUtc: string;
  checkedInMs: number;
}

export interface ContractFieldAudit {
  field: string;
  kind: 'integer' | 'string' | 'enum' | 'timestamp';
  unit: string | null;
  range: string;
  numericOk: boolean; // integer + unit-suffixed (numeric fields only)
  numericOkReason: string;
}

export interface ContractAuditResult {
  contract: string;
  fields: ContractFieldAudit[];
  floatRejectionProbe: { input: string; accepted: boolean; expected: false; verdict: 'PASS' | 'FAIL'; detail: string };
  boundary: {
    enforcedInCode: boolean;
    mechanism: string;
    productionRecords: number;
    probe: { eventId: string; source: string; refusedWith: string } | null;
  };
  checkedAtUtc: string;
}

export interface RecordsPayload {
  records: ProximityRecordView[];
  counts: {
    total: number;
    sealed: number;
    allowed: number;
    refused: number;
    suppressed: number;
    simulator: number;
    production: number;
  };
  enrolledSubjects: string[];
  generatedAtUtc: string;
}

export interface TamperOutcome {
  ok: boolean;
  eventId: string;
  fieldAltered?: string;
  fromValue?: number;
  toValue?: number;
  note?: string;
  error?: string;
  code?: string;
}

// ─── WATCHDOG — the sentinel (scheduled verification + tamper alarm rail) ──
//
// Layering, stated precisely:
//   · the STORED-BYTES RULE (verify.ts) catches byte tamper at verify time;
//   · the WATCHDOG makes verification CONTINUOUS — a scheduled walker whose
//     VALID→BROKEN transition raises an alarm on an append-only JSONL rail
//     that survives server restarts;
//   · the ANCHOR LEDGER (below) catches what even the walker cannot: a
//     full-file rewrite that re-links the whole chain consistently.

export interface WatchdogPass {
  atUtc: string;
  valid: boolean;
  records: number;
  headPosition: number | null;
  headHash: string | null;
  latencyMs: number;
  brokenAt: string | null;
  reason: string | null;
}

export type WatchdogAlarmKind = 'CHAIN_BROKEN' | 'CHAIN_SHORTENED';

export interface WatchdogAlarm {
  seq: number;
  raisedAtUtc: string;
  kind: WatchdogAlarmKind;
  brokenAt: string | null;
  reason: string | null;
  lastGoodPosition: number | null;
  lastGoodHash: string | null;
}

export interface WatchdogStatus {
  enabled: boolean; // operator toggle (in-memory, per process)
  running: boolean; // timer actually armed
  killSwitch: boolean; // PROXIMITY_WATCHDOG=off at boot
  intervalMs: number;
  passes: WatchdogPass[]; // recent history (bounded)
  totalPasses: number;
  consecutiveValid: number;
  alarms: WatchdogAlarm[]; // newest first — the alarm rail
  alarmCount: number;
  lastSeenHeadPosition: number | null;
  nowUtc: string;
}

// ─── ANCHORS — external head anchoring (phase-two v0, local store) ──────────

export interface AnchorEntry {
  seq: number;
  anchoredAtUtc: string;
  headPosition: number;
  headHash: string;
  algorithm: string;
  streamId: string;
  note: string;
}

/** An anchor replayed against the LIVE chain. DRIFT = history rewritten. */
export interface AnchorVerifyRow extends AnchorEntry {
  status: 'OK' | 'DRIFT' | 'MISSING';
}

export interface AnchorLedger {
  anchors: AnchorVerifyRow[]; // newest first
  okCount: number;
  driftCount: number;
  missingCount: number;
  /** anchored positions ÷ current chain length, percent — coverage of the past */
  coveragePercent: number | null;
  chainLength: number;
  continuity: 'VALID' | 'DRIFT' | 'EMPTY';
  storePath: string; // honesty: where the anchors actually live
  nowUtc: string;
}

// ─── ANCHOR BUNDLE — the off-box v0: anchors that travel by hand ────────────
//
// The local heads file is still ON the box it anchors. Until object storage /
// HSM heads exist, the bundle is the off-box step an operator can actually
// take today: export the ledger as one self-describing, hash-covered JSON
// file, carry it anywhere (email, USB, another machine), and replay it against
// ANY live chain later. A bundle is evidence that travels.

export interface AnchorBundle {
  format: 'vvu.anchor-bundle.v1';
  exportedAtUtc: string;
  streamId: string;
  algorithm: string;
  /** chain state as seen at export time — context for the receiver */
  chain: {
    records: number;
    headPosition: number | null;
    headHash: string | null;
  };
  /** the anchor entries, exactly as they sit in the heads store */
  anchors: AnchorEntry[];
  /** sha256 over the canonical JSON of everything above — tamper-evident bundle */
  bundleHash: string;
}

export interface BundleVerifyRow extends AnchorEntry {
  status: 'OK' | 'DRIFT' | 'MISSING';
}

export interface BundleVerifyResult {
  bundleIntegrity: 'INTACT' | 'TAMPERED' | 'MALFORMED';
  integrityDetail: string;
  formatOk: boolean;
  streamOk: boolean;
  exportedAtUtc: string | null;
  bundleAnchorCount: number;
  rows: BundleVerifyRow[]; // newest first
  okCount: number;
  driftCount: number;
  missingCount: number;
  /** one sentence the operator can repeat out loud */
  verdict: string;
  checkedAtUtc: string;
}

// ─── OUT-OF-BAND DISPATCH — alarms that leave the box ───────────────────────
//
// The alarm rail is durable ON THIS BOX. If the box itself is the thing that
// is compromised (or dies), nobody ever hears the alarm. The dispatch rail
// sends every raised alarm to a configured webhook endpoint, signed, with an
// append-only delivery log. The webhook is a NOTIFICATION rail, not evidence
// storage — the JSONL rail remains the evidence.

export type WebhookConfigSource = 'env' | 'file' | 'none';

export interface WebhookConfigState {
  configured: boolean;
  source: WebhookConfigSource;
  /** host:port only — the full URL could carry a secret in its query */
  targetHost: string | null;
  secretSet: boolean;
  /** seconds the dispatcher waits before giving up on one attempt */
  timeoutSeconds: number;
}

export interface WebhookDelivery {
  seq: number;
  /** which alarm this delivery belongs to; null for operator test sends */
  alarmSeq: number | null;
  /** 'alarm' = the sentinel's first attempt · 'test' = operator probe ·
   *  'retry' = a backoff re-attempt of a previously failed alarm delivery */
  mode: 'alarm' | 'test' | 'retry';
  kind: string;
  attemptedAtUtc: string;
  targetHost: string;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
  signatureSent: boolean;
  /** for mode 'retry': which re-attempt this was (1-based, before the original) */
  attempt?: number;
}

export interface WebhookInboxRow {
  seq: number;
  receivedAtUtc: string;
  kind: string;
  alarmSeq: number | null;
  signatureValid: boolean | null; // null = no secret configured, nothing to check
  sender: string | null;
}

/** One alarm the dispatcher has not (yet) delivered — the durable retry row. */
export interface WebhookRetry {
  alarmSeq: number;
  kind: string;
  state: 'pending' | 'resolved' | 'given-up';
  /** re-attempts made so far (the original failed attempt is attempt zero) */
  attempts: number;
  firstFailedAtUtc: string;
  lastAttemptAtUtc: string | null;
  /** when the ticker will try next — null once resolved / given up */
  nextAttemptUtc: string | null;
  lastError: string | null;
  resolvedAtUtc: string | null;
  deliveredStatusCode: number | null;
  /** the exact payload to re-send — the original alarm verbatim */
  payload: string; // JSON-encoded WebhookPayload (kept raw so the row is self-describing)
}

export interface WebhookRetryPolicy {
  maxRetries: number;
  backoffSeconds: number[];
  tickSeconds: number;
}

export interface WebhookStatus {
  config: WebhookConfigState;
  deliveries: WebhookDelivery[]; // newest first (bounded view)
  totalDeliveries: number;
  okCount: number;
  failCount: number;
  skippedCount: number; // alarms raised while unconfigured — the honest gap
  inboxCount: number; // what the loopback demo sink has received
  lastDelivery: WebhookDelivery | null;
  nowUtc: string;
  retryQueue: WebhookRetry[]; // pending + given-up rows, newest first (bounded view)
  pendingRetryCount: number; // alarms still owed a delivery
  givenUpRetryCount: number; // retries exhausted — the operator must see the gap
  resolvedRetryCount: number; // failed once, later delivered — the loop closed
  retryPolicy: WebhookRetryPolicy;
}
