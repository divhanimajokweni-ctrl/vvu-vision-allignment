// src/server/proximity/pipeline.ts
// ─────────────────────────────────────────────────────────────────────────────
// STEPS 2+3 — INGEST WITH GOVERNANCE GATE, THEN SEAL.
//
// One seal kernel for the whole estate: this pipeline does NOT fork a
// second hasher. appendIfAbsent + the canonical kernel (domain separation,
// JCS, stored-bytes rule) are reused VERBATIM from the SafeGrid rail; the
// proximity stream is just a new streamId in worm_seal_index. Same
// canonicalizer, same domain separation, same linking rule — when the
// pilot scales, nothing about the sealer changes.
//
// THE GATE (before the sealer — refused scans never touch the chain):
//   G1 CONTRACT   — validateScan (integer-only, closed-world)
//   G2 ENROLMENT  — subject_id must be enrolled
// On ALLOW, the decision pass (recorded with the record, sealed as the
// raw observation — evidence is the scan, decisions are the gate):
//   R3 SUPPRESS_ACTION — IF risk_milli > 820 (RISK > 0.820) → SUPPRESS
//   R4 EXTENDED_DWELL  — IF dwell_ms > 30000 (DWELL > 30.0 s) → flag
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

import { appendIfAbsent } from '@/server/safegrid/worm-chain';
import {
  ContractViolationError,
  utcNowRfc3339,
  validateScan,
  type ScanInput,
} from '@/server/proximity/contract';
import {
  PROXIMITY_EVENT_TYPE,
  PROXIMITY_STREAM_ID,
  formatUtc,
  type RecordsPayload,
  type ScanOutcome,
  type ScanPass,
} from '@/lib/proximity/types';

export const ENROLLED_SUBJECTS = ['vvu-003', 'vvu-017', 'vvu-042', 'vvu-108'] as const;

/** The suppression threshold — the example rule, in the contract's units. */
export const SUPPRESS_RISK_THRESHOLD_MILLI = 820; // RISK > 0.820 → SUPPRESS ACTION
export const EXTENDED_DWELL_THRESHOLD_MS = 30000; // DWELL > 30.0 s → flag

export class GateRefusedError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'GateRefusedError';
  }
}

function newEventId(source: string): string {
  return `prox.${source}.${Date.now().toString(36)}.${randomUUID().slice(0, 8)}`;
}

/** The governance gate + decision pass, evaluated on a VALIDATED scan. */
function evaluateGate(scan: ScanInput): {
  gate: { decision: 'ALLOW' | 'REFUSE'; reason: string };
  passes: ScanPass[];
  action: 'PASS_THROUGH' | 'SUPPRESS' | 'NONE';
  rulesFired: string[];
} {
  const passes: ScanPass[] = [];
  const rulesFired: string[] = [];

  // G2 ENROLMENT (G1 CONTRACT already passed — validateScan ran first).
  const enrolled = (ENROLLED_SUBJECTS as readonly string[]).includes(scan.subject_id);
  passes.push({
    rule: 'ENROLMENT',
    verdict: enrolled ? 'PASS' : 'REFUSED',
    detail: enrolled
      ? `subject ${scan.subject_id} is enrolled`
      : `subject ${scan.subject_id} is NOT enrolled — refused at the gate, never sealed`,
  });
  if (!enrolled) {
    return { gate: { decision: 'REFUSE', reason: 'UNKNOWN_SUBJECT' }, passes, action: 'NONE', rulesFired };
  }

  // Decision pass — R3 (the suppression rule) and R4 (advisory flag).
  const suppress = scan.risk_milli > SUPPRESS_RISK_THRESHOLD_MILLI;
  passes.push({
    rule: 'SUPPRESS_ACTION',
    verdict: suppress ? 'FIRED' : 'PASS',
    detail: suppress
      ? `risk_milli ${scan.risk_milli} (${(scan.risk_milli / 1000).toFixed(3)} RISK) > 820 (0.820 RISK) → SUPPRESS ACTION`
      : `risk_milli ${scan.risk_milli} (${(scan.risk_milli / 1000).toFixed(3)} RISK) ≤ 820 threshold → PASS THROUGH`,
  });
  if (suppress) rulesFired.push('SUPPRESS_ACTION');

  const extendedDwell = scan.dwell_ms > EXTENDED_DWELL_THRESHOLD_MS;
  passes.push({
    rule: 'EXTENDED_DWELL',
    verdict: extendedDwell ? 'FIRED' : 'PASS',
    detail: extendedDwell
      ? `dwell_ms ${scan.dwell_ms} (${(scan.dwell_ms / 1000).toFixed(1)} s DWELL) > 30000 ms (30.0 s) → extended-dwell flag`
      : `dwell_ms ${scan.dwell_ms} (${(scan.dwell_ms / 1000).toFixed(1)} s DWELL) ≤ 30000 ms threshold`,
  });
  if (extendedDwell) rulesFired.push('EXTENDED_DWELL');

  return { gate: { decision: 'ALLOW', reason: 'CONTRACT_OK·ENROLLED' }, passes, action: suppress ? 'SUPPRESS' : 'PASS_THROUGH', rulesFired };
}

/**
 * Ingest one scan through the full pipeline. Refused scans are RECORDED
 * (decision log) but never sealed. Allowed scans seal through the estate's
 * appendIfAbsent — the same kernel, a new stream.
 */
export async function ingestScan(db: PrismaClient, body: unknown): Promise<ScanOutcome> {
  // STEP 1 — CONTRACT (throws ContractViolationError → HTTP 400).
  const scan = validateScan(body);

  // STEP 2 — GOVERNANCE GATE.
  const evaluation = evaluateGate(scan);
  const eventId = newEventId(scan.source);

  if (evaluation.gate.decision === 'REFUSE') {
    await db.proximityRecord.create({
      data: {
        eventId,
        source: scan.source,
        subjectId: scan.subject_id,
        distanceCm: scan.distance_cm,
        rssiDbm: scan.rssi_dbm,
        batteryMv: scan.battery_mv,
        dwellMs: scan.dwell_ms,
        riskMilli: scan.risk_milli,
        occurredAt: scan.occurred_at,
        gateDecision: 'REFUSE',
        gateReason: evaluation.gate.reason,
        action: 'NONE',
        rulesFired: JSON.stringify(evaluation.rulesFired),
        sealRef: null, // never sealed — the gate did its job
      },
    });
    return {
      eventId,
      source: scan.source,
      gate: evaluation.gate,
      passes: evaluation.passes,
      action: 'NONE',
      rulesFired: evaluation.rulesFired,
      sealed: false,
      occurredAt: scan.occurred_at,
      ingestedAtUtc: formatUtc(Date.now()),
    };
  }

  // STEP 3 — SEAL through the estate's kernel (appendIfAbsent, own stream).
  const payload: Record<string, unknown> = {
    battery_mv: scan.battery_mv,
    distance_cm: scan.distance_cm,
    dwell_ms: scan.dwell_ms,
    occurred_at: scan.occurred_at,
    risk_milli: scan.risk_milli,
    rssi_dbm: scan.rssi_dbm,
    source: scan.source,
    subject_id: scan.subject_id,
  };
  const append = await appendIfAbsent(db, {
    eventId,
    eventType: PROXIMITY_EVENT_TYPE,
    payload,
    streamId: PROXIMITY_STREAM_ID,
  });

  await db.proximityRecord.create({
    data: {
      eventId,
      source: scan.source,
      subjectId: scan.subject_id,
      distanceCm: scan.distance_cm,
      rssiDbm: scan.rssi_dbm,
      batteryMv: scan.battery_mv,
      dwellMs: scan.dwell_ms,
      riskMilli: scan.risk_milli,
      occurredAt: scan.occurred_at,
      gateDecision: 'ALLOW',
      gateReason: evaluation.gate.reason,
      action: evaluation.action,
      rulesFired: JSON.stringify(evaluation.rulesFired),
      sealRef: append.seal.eventId,
    },
  });

  return {
    eventId,
    source: scan.source,
    gate: evaluation.gate,
    passes: evaluation.passes,
    action: evaluation.action,
    rulesFired: evaluation.rulesFired,
    sealed: true,
    seal: {
      position: append.seal.position.toString(),
      recordHash: append.seal.recordHash,
      previousRecordHash: append.seal.previousRecordHash,
      canonicalEventHash: append.seal.canonicalEventHash,
      canonicalBytes: append.seal.canonicalBytes,
      algorithm: append.seal.algorithm,
    },
    occurredAt: scan.occurred_at,
    ingestedAtUtc: formatUtc(Date.now()),
  };
}

function toView(r: {
  eventId: string; source: string; subjectId: string; distanceCm: number; rssiDbm: number;
  batteryMv: number; dwellMs: number; riskMilli: number; occurredAt: string; gateDecision: string;
  gateReason: string; action: string; rulesFired: string; sealRef: string | null; ingestedAt: Date;
}) {
  return {
    eventId: r.eventId,
    source: r.source,
    subjectId: r.subjectId,
    distanceCm: r.distanceCm,
    rssiDbm: r.rssiDbm,
    batteryMv: r.batteryMv,
    dwellMs: r.dwellMs,
    riskMilli: r.riskMilli,
    occurredAt: r.occurredAt,
    gateDecision: r.gateDecision,
    gateReason: r.gateReason,
    action: r.action,
    rulesFired: r.rulesFired,
    sealRef: r.sealRef,
    ingestedAtUtc: formatUtc(r.ingestedAt),
  };
}

/** All records (decision log + sealed) + labeled counts. */
export async function listRecords(db: PrismaClient): Promise<RecordsPayload> {
  const rows = await db.proximityRecord.findMany({ orderBy: { ingestedAt: 'desc' } });
  const records = rows.map(toView);
  return {
    records,
    counts: {
      total: records.length,
      sealed: records.filter((r) => r.sealRef !== null).length,
      allowed: records.filter((r) => r.gateDecision === 'ALLOW').length,
      refused: records.filter((r) => r.gateDecision === 'REFUSE').length,
      suppressed: records.filter((r) => r.action === 'SUPPRESS').length,
      simulator: records.filter((r) => r.source === 'simulator').length,
      production: records.filter((r) => r.source === 'production').length,
    },
    enrolledSubjects: [...ENROLLED_SUBJECTS],
    generatedAtUtc: formatUtc(Date.now()),
  };
}

/**
 * Seed the demo baseline: three PRODUCTION scans (sealed, immutable by
 * construction) + two simulator scans (sealed, the tamper-demo partition)
 * + one refused simulator scan (the gate, visible in the decision log).
 * Deterministic event_ids so re-seeding is idempotent by PK.
 */
export async function seedDemoData(db: PrismaClient): Promise<{ seeded: boolean }> {
  const existing = await db.proximityRecord.count();
  if (existing > 0) return { seeded: false };

  const t = (offsetMs: number) => new Date(Date.now() - offsetMs).toISOString();

  await ingestScan(db, {
    subject_id: 'vvu-003', source: 'production', distance_cm: 412, rssi_dbm: -71,
    battery_mv: 3980, dwell_ms: 4200, risk_milli: 141, occurred_at: t(600_000),
  });
  await ingestScan(db, {
    subject_id: 'vvu-017', source: 'production', distance_cm: 168, rssi_dbm: -64,
    battery_mv: 3760, dwell_ms: 21500, risk_milli: 402, occurred_at: t(480_000),
  });
  await ingestScan(db, {
    subject_id: 'vvu-042', source: 'production', distance_cm: 55, rssi_dbm: -49,
    battery_mv: 4120, dwell_ms: 8800, risk_milli: 903, occurred_at: t(360_000),
  });
  await ingestScan(db, {
    subject_id: 'vvu-042', source: 'simulator', distance_cm: 45, rssi_dbm: -52,
    battery_mv: 3720, dwell_ms: 12500, risk_milli: 214, occurred_at: t(240_000),
  });
  await ingestScan(db, {
    subject_id: 'vvu-017', source: 'simulator', distance_cm: 96, rssi_dbm: -57,
    battery_mv: 3540, dwell_ms: 38200, risk_milli: 655, occurred_at: t(120_000),
  });
  // The gate, demonstrated: an unenrolled subject is REFUSED, never sealed.
  await ingestScan(db, {
    subject_id: 'vvu-999', source: 'simulator', distance_cm: 210, rssi_dbm: -66,
    battery_mv: 3610, dwell_ms: 5400, risk_milli: 320, occurred_at: t(60_000),
  });
  return { seeded: true };
}

export { ContractViolationError, validateScan };
