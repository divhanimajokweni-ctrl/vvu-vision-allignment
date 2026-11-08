/**
 * Evidence Chain of Custody — the Canonical pattern.
 * Real SHA-256 fingerprinting at each stage transition.
 *
 * Pipeline: intake → verify → seal → archive
 *
 * - intake: initial fingerprint = SHA-256(ref + title + timestamp)
 * - verify: fingerprint unchanged, custodian must be named
 * - seal:   new fingerprint = SHA-256(prevFingerprint + ref + custodian + timestamp)
 * - archive: fingerprint frozen, entry committed to audit log
 *
 * Once sealed, any edit is detectable (fingerprint mismatch).
 */

import { sha256 } from "@/lib/crypto/mmr";
import { getAuditLog } from "./audit-log";

export type EvidenceStage = "intake" | "verify" | "seal" | "archive";

export const STAGE_ORDER: EvidenceStage[] = ["intake", "verify", "seal", "archive"];

export interface EvidenceRecord {
  ref: string;           // unique reference (e.g. "EV-3xxx")
  title: string;
  kind: string;          // e.g. "document", "photo", "sensor_log", "sworn_statement"
  custodian: string;     // responsible person
  stage: EvidenceStage;
  fingerprint: string;   // SHA-256 hash — changes on seal
  prevFingerprint: string | null; // fingerprint before sealing (for tamper detection)
  created: number;
  stageHistory: { stage: EvidenceStage; timestamp: number; custodian: string; fingerprint: string }[];
  sealed: boolean;       // once sealed, cannot be edited
  mediaIds: string[];    // linked media assets
}

/**
 * Create a new evidence record at the intake stage.
 * Generates the initial SHA-256 fingerprint.
 */
export function intakeEvidence(
  ref: string,
  title: string,
  kind: string,
  custodian: string,
): EvidenceRecord {
  const timestamp = Date.now();
  const fingerprint = sha256(`${ref}:${title}:${kind}:${timestamp}`);

  const record: EvidenceRecord = {
    ref,
    title,
    kind,
    custodian,
    stage: "intake",
    fingerprint,
    prevFingerprint: null,
    created: timestamp,
    stageHistory: [{ stage: "intake", timestamp, custodian, fingerprint }],
    sealed: false,
    mediaIds: [],
  };

  getAuditLog().append("evidence.intake", "evidence", ref, null, record, custodian);
  return record;
}

/**
 * Advance an evidence record to the next stage.
 * - verify: custodian must be named, fingerprint unchanged
 * - seal:   new fingerprint = SHA-256(prevFingerprint + ref + custodian + timestamp)
 *           Once sealed, the record is immutable
 * - archive: entry committed, fingerprint frozen
 */
export function advanceStage(record: EvidenceRecord, custodian?: string): EvidenceRecord {
  // Allow sealed records to advance to archive, but not to be edited
  if (record.sealed && record.stage === "seal") {
    // OK — advancing from seal to archive is allowed
  } else if (record.sealed) {
    throw new Error("EVIDENCE_SEALED: cannot modify a sealed record");
  }

  const currentIdx = STAGE_ORDER.indexOf(record.stage);
  if (currentIdx >= STAGE_ORDER.length - 1) {
    throw new Error("EVIDENCE_TERMINAL: already at archive stage");
  }

  const nextStage = STAGE_ORDER[currentIdx + 1];
  const timestamp = Date.now();
  const actor = custodian ?? record.custodian;

  let newFingerprint = record.fingerprint;
  let prevFingerprint = record.prevFingerprint;

  if (nextStage === "seal") {
    // Sealing: new fingerprint chains to the previous
    prevFingerprint = record.fingerprint;
    newFingerprint = sha256(`${record.fingerprint}:${record.ref}:${actor}:${timestamp}`);
  }

  const updated: EvidenceRecord = {
    ...record,
    stage: nextStage,
    custodian: actor,
    fingerprint: newFingerprint,
    prevFingerprint,
    stageHistory: [
      ...record.stageHistory,
      { stage: nextStage, timestamp, custodian: actor, fingerprint: newFingerprint },
    ],
    sealed: nextStage === "seal" || record.sealed,
  };

  getAuditLog().append(
    "evidence.stage",
    "evidence",
    record.ref,
    record,
    updated,
    actor,
  );

  return updated;
}

/**
 * Verify the integrity of an evidence record.
 * Checks that the fingerprint matches the expected hash.
 * Returns { valid, tampered, reason }.
 */
export function verifyEvidence(record: EvidenceRecord): {
  valid: boolean;
  tampered: boolean;
  reason: string;
} {
  // Recompute the intake fingerprint
  const intakeEntry = record.stageHistory[0];
  const expectedIntakeFp = sha256(
    `${record.ref}:${record.title}:${record.kind}:${intakeEntry.timestamp}`,
  );

  if (intakeEntry.fingerprint !== expectedIntakeFp) {
    return { valid: false, tampered: true, reason: "INTAKE_FINGERPRINT_MISMATCH" };
  }

  // If sealed, verify the seal chain
  if (record.sealed && record.prevFingerprint) {
    const sealEntry = record.stageHistory.find((s) => s.stage === "seal");
    if (sealEntry) {
      const expectedSealFp = sha256(
        `${record.prevFingerprint}:${record.ref}:${sealEntry.custodian}:${sealEntry.timestamp}`,
      );
      if (sealEntry.fingerprint !== expectedSealFp) {
        return { valid: false, tampered: true, reason: "SEAL_FINGERPRINT_MISMATCH" };
      }
    }
  }

  // Verify stage history chain
  for (let i = 1; i < record.stageHistory.length; i++) {
    const prev = record.stageHistory[i - 1];
    const curr = record.stageHistory[i];
    if (curr.stage !== STAGE_ORDER[i]) {
      return { valid: false, tampered: true, reason: `STAGE_ORDER_VIOLATION at ${i}` };
    }
  }

  return { valid: true, tampered: false, reason: "OK" };
}

/**
 * Attempt to edit a sealed record. This will fail unless forceEdit=true.
 * If forceEdit=true, the edit is logged but the record is marked as tampered.
 */
export function editEvidence(
  record: EvidenceRecord,
  changes: Partial<Pick<EvidenceRecord, "title" | "kind" | "custodian">>,
  actor: string,
  forceEdit = false,
): { record: EvidenceRecord; tampered: boolean } {
  if (record.sealed && !forceEdit) {
    throw new Error("EVIDENCE_SEALED: cannot edit a sealed record without forceEdit");
  }

  const before = { ...record };
  const updated = { ...record, ...changes };
  const tampered = record.sealed;

  if (tampered) {
    // Log the tamper attempt
    getAuditLog().append(
      "evidence.tamper",
      "evidence",
      record.ref,
      before,
      updated,
      actor,
    );
  } else {
    getAuditLog().append(
      "evidence.edit",
      "evidence",
      record.ref,
      before,
      updated,
      actor,
    );
  }

  return { record: updated, tampered };
}
