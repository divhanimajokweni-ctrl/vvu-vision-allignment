// src/server/execute-with-permit.ts
// ─────────────────────────────────────────────────────────────────────────────
// Independent actuator verification. The actuator's execution path verifies
// the permit and consumes its nonce INDEPENDENTLY of the issuance path:
//
//   1. the permit must be FOR this actuator (PERMIT_ACTION_MISMATCH),
//   2. the signature must verify against the pinned keyring
//      (algorithm → key id → shape/expiry → canonical bytes),
//   3. the nonce must atomically consume — exactly one of N concurrent
//      consumers wins; the rest receive NONCE_ALREADY_CONSUMED / EXPIRED /
//      ABORTED / NOT_FOUND and refuse.
//
// Only after all three does the actuator run. The duplicate-request race is
// explicit: two concurrent consumers may both verify the signature, but only
// one can consume the nonce.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

import { ActuatorError, NonceError, PermitInvalidError } from '@/lib/governance-errors';
import type { Actuator, ExecutionPermit, NonceStore, PermitVerifier } from '@/lib/governance-protocol';

export async function executeWithPermit(
  actuator: Actuator,
  permit: ExecutionPermit,
  verifier: PermitVerifier,
  nonceStore: NonceStore
): Promise<{ effectId: string; effect: string }> {
  // 1 · the permit is for this actuator
  if (!permit || permit.actionId !== actuator.actionId) {
    throw new ActuatorError('PERMIT_ACTION_MISMATCH');
  }

  // 2 · independent verification (pinned key, canonical bytes, expiry)
  const verified = await verifier.verify(permit);
  if (!verified.valid) {
    throw new PermitInvalidError(verified.reasonCode ?? 'PERMIT_INVALID');
  }

  // 3 · atomic single-use claim — the exactly-once gate
  const consumed = await nonceStore.consume({
    actionId: permit.actionId,
    nonce: permit.actionNonce,
    now: new Date().toISOString(),
  });
  if (consumed !== 'CONSUMED') {
    throw new NonceError(consumed);
  }

  // 4 · the (self-re-verifying) actuator runs
  return actuator.execute(permit);
}
