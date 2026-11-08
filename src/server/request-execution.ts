// src/server/request-execution.ts
// ─────────────────────────────────────────────────────────────────────────────
// The authenticated server entry point's core (the spec's executeAction,
// shaped so the negative-path suite drives the SAME path with chosen
// subjects). Every call repeats authorization — this is directly reachable
// over POST, so nothing is ever inferred from the page that rendered a
// button.
//
// Flow: registry gate → enforce() (evaluate + durable allow + sign) →
// executeWithPermit() (independent verify + atomic nonce consume + actuator).
// Every refusal on the execution path is SEALED as a durable audit event.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { enforce } from '@/lib/enforcement';
import {
  ActuatorError,
  AuthError,
  GovernanceViolationError,
  NonceError,
  PermitInvalidError,
  PermitIssuanceError,
} from '@/lib/governance-errors';
import type { CheckLog, ExecutionPermit, GovernanceRuntime } from '@/lib/governance-protocol';
import { executeWithPermit } from './execute-with-permit';

export const ExecuteActionInput = z.object({
  actionId: z.string().min(1).max(128),
  /** hex sha256 — when presented it MUST equal the authoritative manifest */
  evidenceManifestHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/, 'evidenceManifestHash must be a lowercase hex sha256')
    .optional(),
});

export type ExecuteActionInput = z.infer<typeof ExecuteActionInput>;

export interface PublicPermitView {
  permitId: string;
  actionId: string;
  actionNonce: string;
  subjectId: string;
  policyEpoch: number;
  evidenceManifestHash: string;
  governanceEventId: string;
  issuedAt: string;
  expiresAt: string;
  keyId: string;
  algorithm: string;
  signature: string;
}

export type ExecutionOutcome =
  | {
      status: 'EXECUTED';
      actionId: string;
      subjectId: string;
      permit: PublicPermitView;
      effectId: string;
      effect: string;
      governanceEventId: string;
    }
  | {
      status: 'REFUSED';
      actionId: string;
      subjectId: string | null;
      reasonCode: string;
      reason: string | null;
      checks?: CheckLog[];
      sealedEventSeq: number | null;
      sealedEventId: string | null;
    }
  | {
      status: 'ERROR';
      actionId: string;
      subjectId: string | null;
      reasonCode: string;
      detail?: string;
    };

function publicPermit(permit: ExecutionPermit): PublicPermitView {
  const { algorithm, signature, ...payload } = permit;
  return {
    ...payload,
    algorithm,
    signature,
  };
}

export async function requestExecution(
  runtime: GovernanceRuntime,
  db: PrismaClient,
  subjectId: string,
  input: ExecuteActionInput
): Promise<ExecutionOutcome> {
  const actionId = input.actionId;
  // Arrival is captured BEFORE any await — the duplicate check compares it
  // to the last execution's confirm time.
  const arrivedAt = new Date().toISOString();

  // Registry gate — a precondition, not a governance evaluation (per the
  // spec's executeAction): unregistered actions never reach enforce().
  const registration = runtime.getActionRegistration(actionId);
  if (!registration || registration.riskClass !== 'ACTUATE') {
    return {
      status: 'REFUSED',
      actionId,
      subjectId,
      reasonCode: 'ACTION_NOT_REGISTERED',
      reason: `${actionId} is not a registered ACTUATE action`,
      sealedEventSeq: null,
      sealedEventId: null,
    };
  }

  const actuator = await runtime.resolveActuator(actionId);
  if (!actuator) {
    return {
      status: 'REFUSED',
      actionId,
      subjectId,
      reasonCode: 'ACTION_NOT_REGISTERED',
      reason: 'registered action has no bound actuator',
      sealedEventSeq: null,
      sealedEventId: null,
    };
  }

  // The WHOLE request path (issuance + execution) is serialized per action:
  // a queued duplicate only starts after the winner completes, so its
  // duplicate check evaluates the winner's FINAL state — deterministically
  // exactly-once per concurrent intent (ACTION_IN_FLIGHT or ACTION_DUPLICATE).
  return runtime.executionSection(actionId, async (): Promise<ExecutionOutcome> => {
    // Governance: evaluate + durable allow + sign.
    let permit: ExecutionPermit;
    try {
      permit = await enforce(runtime, subjectId, actionId, {
        providedEvidenceManifestHash: input.evidenceManifestHash ?? null,
        requestArrivedAt: arrivedAt,
      });
    } catch (error) {
      if (error instanceof GovernanceViolationError) {
        return {
          status: 'REFUSED',
          actionId,
          subjectId,
          reasonCode: error.verdict.reasonCode ?? 'UNKNOWN',
          reason: error.verdict.reason ?? null,
          checks: error.verdict.checks,
          sealedEventSeq: error.sealedEventSeq,
          sealedEventId: error.sealedEventId,
        };
      }
      if (error instanceof PermitIssuanceError) {
        // The permit is ABORTED and its nonce is dead — auditable, never usable.
        return {
          status: 'ERROR',
          actionId,
          subjectId,
          reasonCode: 'PERMIT_ISSUANCE_FAILED',
          detail: `permit ${error.permitId} aborted after signing failure: ${error.cause}`,
        };
      }
      return {
        status: 'ERROR',
        actionId,
        subjectId,
        reasonCode: 'ENFORCEMENT_FAILURE',
        detail: (error as Error).message,
      };
    }

    // Independent verification + single-use claim + actuator.
    try {
      const result = await executeWithPermit(actuator, permit, runtime.permitVerifier, runtime.nonceStore);
      return {
        status: 'EXECUTED',
        actionId,
        subjectId,
        permit: publicPermit(permit),
        effectId: result.effectId,
        effect: result.effect,
        governanceEventId: permit.governanceEventId,
      };
    } catch (error) {
      // Replay / mismatch / expiry / state refusals — sealed as audit events.
      const reasonCode =
        error instanceof NonceError
          ? `NONCE_${error.result}`
          : error instanceof PermitInvalidError
            ? error.reasonCode
            : error instanceof ActuatorError
              ? error.reasonCode
              : 'EXECUTION_FAILURE';

      let sealedEventSeq: number | null = null;
      let sealedEventId: string | null = null;
      let reasonText = reasonCode;
      try {
        const sealed = await runtime.transaction(async (tx) =>
          tx.appendWormEvent({
            type: 'GOVERNANCE_REFUSAL',
            actionId,
            subjectId,
            permitId: permit.permitId,
            payload: {
              phase: 'EXECUTION',
              reasonCode,
              actionNonce: permit.actionNonce,
              detail: (error as Error).message,
            },
            observedAt: new Date().toISOString(),
          })
        );
        sealedEventSeq = sealed.seq;
        sealedEventId = sealed.eventId;
        reasonText = `${reasonCode} — sealed event #${sealed.seq}`;
      } catch {
        // Sealing failure is surfaced, never swallowed into a success.
        reasonText = `${reasonCode} — WARNING: refusal could not be sealed`;
      }

      return {
        status: 'REFUSED',
        actionId,
        subjectId,
        reasonCode,
        reason: reasonText,
        sealedEventSeq,
        sealedEventId,
      };
    }
  });
}

/** Map an AuthError to the outcome shape (used by the API route). */
export function authRefusal(error: AuthError, actionId: string): ExecutionOutcome {
  return {
    status: 'REFUSED',
    actionId,
    subjectId: null,
    reasonCode: error.reasonCode,
    reason: `subject resolution failed closed: ${error.reasonCode}`,
    sealedEventSeq: null,
    sealedEventId: null,
  };
}
