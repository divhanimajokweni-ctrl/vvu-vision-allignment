// src/server/actuator-registry.ts
// ─────────────────────────────────────────────────────────────────────────────
// The actuator registry and the ONE registered test actuator of the SIL
// vertical slice: `wetted.pump_pulse` — a software-in-the-loop pump pulse.
//
// The registered actuator does NOT trust its caller:
//   · execute(permit) re-verifies the Ed25519 signature against the pinned
//     keyring (a direct call with a fabricated/expired/tampered permit fails
//     — this is the direct-actuator-bypass negative path),
//   · the permit record must be in state SIGNED in the database,
//   · the action id must match the registration,
//   · every transition is a conditional CAS so a replayed or racing execute
//     cannot skip a rung.
//
// The side effect is a durable SIMULATED row (ActuatorEffect) — never a
// physical output (CONTROLLED_BENCH gate, not this build).
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

import type { Prisma } from '@prisma/client';

import { verifyPermitDetailed, type PermitKeyring } from '@/lib/permit-crypto';
import type { Actuator, ExecutionPermit, RegisteredActionDef } from '@/lib/governance-protocol';
import { ActuatorError } from '@/lib/governance-errors';
import { appendGovernanceWormEvent } from './worm-store';
import { markActuatorConfirmed, markActuatorStarted } from './permit-store';

type DbLike = Prisma.TransactionClient;

export const RELEASE_TAG_GOVERNANCE = 'governance-prototype-v0';

/** The single registered actuator of the slice. */
export const TEST_ACTUATOR: RegisteredActionDef = {
  id: 'wetted.pump_pulse',
  displayName: 'WETTED-LOOP PUMP PULSE · SIM',
  riskClass: 'ACTUATE',
  requiresConsent: true,
  hazardIds: ['hz-wetted-pump-pulse-01'],
  harmBenefit: {
    // Prototype assessment for the simulated pulse: low harm (no physical
    // output), real benefit (the SIL execution proof itself).
    harm: 2,
    benefit: 6,
    assessedAt: '2026-09-23T00:00:00.000Z',
  },
  description:
    'Software-in-the-loop test actuator: issues one simulated 250 ms pump pulse on the wetted loop and records the effect durably. No physical output is connected (CONTROLLED_BENCH gate, not this build).',
  effectKind: 'SIM_PUMP_PULSE',
  simulated: true,
};

const REGISTRY: ReadonlyMap<string, RegisteredActionDef> = new Map([[TEST_ACTUATOR.id, TEST_ACTUATOR]]);

export function getActionRegistration(actionId: string): RegisteredActionDef | null {
  return REGISTRY.get(actionId) ?? null;
}

export function listRegisteredActions(): RegisteredActionDef[] {
  return [...REGISTRY.values()];
}

/** The concrete simulated actuator — bound to the db + pinned keyring. */
class SimPumpPulseActuator implements Actuator {
  readonly actionId = TEST_ACTUATOR.id;

  constructor(
    private readonly db: DbLike,
    private readonly keyring: PermitKeyring
  ) {}

  async execute(permit: ExecutionPermit): Promise<{ effectId: string; effect: string }> {
    // 1 · the permit must be FOR this actuator
    if (!permit || permit.actionId !== this.actionId) {
      throw new ActuatorError('PERMIT_ACTION_MISMATCH');
    }
    // 2 · independent verification — the pinned keyring, canonical bytes
    const verified = verifyPermitDetailed(permit, this.keyring);
    if (!verified.valid) {
      throw new ActuatorError(verified.reasonCode ?? 'PERMIT_INVALID');
    }
    // 3 · the permit record must exist and be SIGNED (durable state check)
    const record = await this.db.governancePermit.findUnique({ where: { permitId: permit.permitId } });
    if (!record) throw new ActuatorError('PERMIT_RECORD_MISSING');
    if (record.state !== 'SIGNED') throw new ActuatorError(`PERMIT_STATE_${record.state}`);

    // 4 · durable start marker (crash window between nonce consumption and
    //     the effect becomes visible as ACTUATOR_STARTED without CONFIRMED)
    await markActuatorStarted(this.db, permit.permitId);

    // 5 · the side effect (simulated, durable)
    const effect = `SIM_PUMP_PULSE:pulse_ms=250;permit=${permit.permitId};nonce=${permit.actionNonce}`;
    const row = await this.db.actuatorEffect.create({
      data: {
        permitId: permit.permitId,
        actionId: permit.actionId,
        subjectId: permit.subjectId,
        effect,
      },
    });

    // 6 · confirmation + GOVERNANCE_EXECUTED on the chain
    await markActuatorConfirmed(this.db, permit.permitId);
    await appendGovernanceWormEvent(this.db, {
      type: 'GOVERNANCE_EXECUTED',
      actionId: permit.actionId,
      subjectId: permit.subjectId,
      permitId: permit.permitId,
      payload: {
        effectId: row.id,
        effect,
        actionNonce: permit.actionNonce,
        policyEpoch: permit.policyEpoch,
      },
      observedAt: new Date().toISOString(),
    });

    return { effectId: row.id, effect };
  }
}

export function resolveActuator(db: DbLike, keyring: PermitKeyring, actionId: string): Actuator | null {
  if (!REGISTRY.has(actionId)) return null;
  return new SimPumpPulseActuator(db, keyring);
}
