// src/lib/enforcement.ts
// ─────────────────────────────────────────────────────────────────────────────
// ENFORCE — the permit issuance path. The required invariant:
//
//   permit ⇒ allow event durable ∧ nonce reserved ∧ manifest bound ∧
//            policy epoch current
//
// A permit is NEVER generated merely because evaluate() returned
// allowed:true. The allow event and the nonce reservation are durable FIRST,
// inside one transaction, and only then is the (already-created) permit
// record signed:
//
//   BEGIN TRANSACTION
//     load current policy epoch (pre-transaction, read-only)
//     evaluate authoritative context            (pure)
//     reserve nonce
//     append GOVERNANCE_ALLOW
//     create permit record (AUTHORIZED_UNSIGNED)
//   COMMIT
//   sign permit
//   mark permit SIGNED
//
// If signing fails, the permit record becomes ABORTED and the reserved nonce
// remains permanently unusable — a crash can never produce an executable
// capability with no corresponding audit record.
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto';

import { GovernanceViolationError, NonceError, PermitIssuanceError } from './governance-errors';
import { evaluate, type ExecutionPermit, type GovernanceRuntime } from './governance-protocol';

export interface EnforceOptions {
  /** hash the requester presented; null/undefined = bind the authoritative
   *  manifest (no claim made). A presented hash must match or the request
   *  is refused EVIDENCE_MANIFEST_MISMATCH. */
  providedEvidenceManifestHash?: string | null;
  /** when the calling request entered the system (ISO) — captured by the
   *  entry point BEFORE any await. Used by the duplicate check: an
   *  execution that confirms after this instant marks the request as a
   *  concurrent duplicate (ACTION_DUPLICATE). Defaults to load-time now. */
  requestArrivedAt?: string;
}

/**
 * Evaluate the authoritative context for (subject, action) and — only when
 * every check passes durably — issue a signed single-use permit.
 */
export async function enforce(
  runtime: GovernanceRuntime,
  subjectId: string,
  actionId: string,
  opts: EnforceOptions = {}
): Promise<ExecutionPermit> {
  // Issuance is serialized per action (in-process): the in-flight check and
  // the reserve must be atomic, or two concurrent duplicate requests could
  // both observe "no permit in flight" and both execute.
  return runtime.issuanceSection(actionId, async () => {
    const input = await runtime.loadAuthoritativeContext(subjectId, actionId, {
      providedEvidenceManifestHash: opts.providedEvidenceManifestHash ?? null,
      requestArrivedAt: opts.requestArrivedAt,
    });

    const verdict = evaluate(input);

    if (!verdict.allowed) {
      // Seal the refusal FIRST — the audit record outlives the request.
      const sealed = await runtime.transaction(async (tx) =>
        tx.appendWormEvent({
          type: 'GOVERNANCE_REFUSAL',
          actionId,
          subjectId,
          payload: {
            reasonCode: verdict.reasonCode,
            reason: verdict.reason,
            checks: verdict.checks,
            policyEpoch: input.context.currentPolicyEpoch,
            evidenceManifestHash: input.context.evidenceManifestHash,
          },
          observedAt: input.observedAt,
        })
      );
      throw new GovernanceViolationError(verdict, { seq: sealed.seq, eventId: sealed.eventId });
    }

    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + runtime.permitTtlMs).toISOString();
    const actionNonce = randomUUID();
    const permitId = randomUUID();
    const allowEventId = randomUUID();

    // ── the transactional persistence boundary ─────────────────────────────
    await runtime.transaction(async (tx) => {
      const reserved = await tx.reserveNonce({
        actionId,
        nonce: actionNonce,
        expiresAt,
        permitId,
      });
      if (reserved !== 'RESERVED') {
        throw new NonceError(reserved); // rolls the transaction back
      }

      await tx.appendWormEvent({
        type: 'GOVERNANCE_ALLOW',
        eventId: allowEventId,
        actionId,
        subjectId,
        permitId,
        payload: {
          actionNonce,
          policyEpoch: input.context.policyEpoch,
          evidenceManifestHash: input.context.evidenceManifestHash,
          verdict,
        },
        observedAt: issuedAt,
      });

      await tx.createPermitRecord({
        permitId,
        actionId,
        actionNonce,
        subjectId,
        policyEpoch: input.context.policyEpoch,
        evidenceManifestHash: input.context.evidenceManifestHash,
        governanceEventId: allowEventId,
        issuedAt,
        expiresAt,
      });
    });
    // ── COMMITTED: allow event durable, nonce reserved, permit bound ───────

    // Signing happens AFTER the transaction. Until it succeeds the permit is
    // AUTHORIZED_UNSIGNED — structurally present, never executable.
    let permit: ExecutionPermit;
    try {
      permit = await runtime.signPermit({
        permitId,
        actionId,
        actionNonce,
        subjectId,
        policyEpoch: input.context.policyEpoch,
        evidenceManifestHash: input.context.evidenceManifestHash,
        governanceEventId: allowEventId,
        issuedAt,
        expiresAt,
        keyId: runtime.permitKeyId,
      });
      await runtime.markPermitSigned(permitId, permit.signature, runtime.permitKeyId);
    } catch (error) {
      // The permit must not be usable: ABORT the record, kill the nonce.
      await runtime.abortPermit(permitId, `SIGNING_FAILED:${(error as Error).message}`);
      throw new PermitIssuanceError(permitId, (error as Error).message);
    }

    return permit;
  });
}
