// src/server/governance-runtime.ts
// ─────────────────────────────────────────────────────────────────────────────
// The authoritative runtime — composes the durable stores, the pinned
// keyring, the registry and the policy epoch into the GovernanceRuntime the
// pure enforce() function drives. Factory form (createGovernanceRuntime) is
// dependency-injected so the negative-path suite runs the SAME code against
// a real test database; the app singleton (getGovernanceRuntime) binds the
// estate db + the env keyring.
//
// Issuance concurrency: issuanceSection() serializes the load→evaluate→
// reserve→seal→record section per action IN-PROCESS. The in-flight check
// and the reserve are therefore atomic; cross-process duplicate issuance
// relies on SQLite's single-writer behaviour (an honest limitation of the
// SIL slice, restated in the worklog).
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

import type { Prisma, PrismaClient } from '@prisma/client';

import { db as appDb } from '@/lib/db';
import type {
  Actuator,
  ConsentState,
  ContextState,
  ExecutionPermit,
  GovernanceInput,
  GovernanceRuntime,
  GovernanceTx,
  HazardState,
  NonceStore,
  PermitPayload,
  PermitVerifier,
  RegisteredActionDef,
  SubjectStatus,
} from '@/lib/governance-protocol';
import { loadPermitKeyring, signPermitPayload, verifyPermitDetailed, type PermitKeyring } from '@/lib/permit-crypto';
import { grantConsent } from './consent-store';
import { listHazardsForAction, upsertHazard } from './hazard-store';
import { abortNonce, createNonceStore, reserveNonce } from './nonce-store';
import {
  createPermitRecord,
  markPermitAborted,
  markPermitSigned,
} from './permit-store';
import { appendGovernanceWormEvent, sha256Hex } from './worm-store';
import {
  getActionRegistration,
  resolveActuator,
  TEST_ACTUATOR,
} from './actuator-registry';
import { stableStringify } from '@/lib/governance-protocol';

export const PROTOTYPE_OPERATOR_SUBJECT_ID =
  process.env.GOVERNANCE_OPERATOR_SUBJECT_ID ?? 'operator.prototype';

export const DEFAULT_PERMIT_TTL_MS = Number(process.env.GOVERNANCE_PERMIT_TTL_MS ?? 120_000);

/** In-flight = an unexpired RESERVED nonce, or a NON-EXPIRED permit still
 *  climbing the ladder (AUTHORIZED_UNSIGNED/SIGNED/ACTUATOR_STARTED — a
 *  stuck ACTUATOR_STARTED blocks until an operator recovery decision, by
 *  design; an expired SIGNED permit self-clears like an expired nonce).
 *  Duplicate concurrent requests refuse on this (ACTION_IN_FLIGHT). */
async function isActionInFlight(db: Prisma.TransactionClient, actionId: string, now: Date): Promise<boolean> {
  const outstanding = await db.governanceNonce.findFirst({
    where: { actionId, state: 'RESERVED', expiresAt: { gt: now } },
    select: { actionNonce: true },
  });
  if (outstanding) return true;
  const climbing = await db.governancePermit.findFirst({
    where: {
      actionId,
      state: { in: ['AUTHORIZED_UNSIGNED', 'SIGNED', 'ACTUATOR_STARTED'] },
      expiresAt: { gt: now },
    },
    select: { permitId: true },
  });
  return climbing !== null;
}

/** Deterministic evidence manifest — the hash of the exact authoritative
 *  state the decision was made under. The permit binds this; a requester
 *  may present their own hash, which must equal it. */
function computeEvidenceManifestHash(parts: {
  subjectId: string;
  actionId: string;
  policyEpoch: number;
  hazards: HazardState[];
  consent: ConsentState | null;
  harmBenefit: { harm: number; benefit: number; assessedAt: string };
}): string {
  return sha256Hex(
    stableStringify({
      subjectId: parts.subjectId,
      actionId: parts.actionId,
      policyEpoch: parts.policyEpoch,
      hazards: parts.hazards
        .map((h) => [h.id, h.status, h.severity, h.exposure, h.controllability])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      consent: parts.consent,
      harmBenefit: parts.harmBenefit,
    })
  );
}

/** Promise-chain mutex: serializes sections per key, in-process. A prior
 *  failure never deadlocks the queue (fn runs on both settle paths). */
function runSectioned<T>(locks: Map<string, Promise<unknown>>, key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const done = run.catch(() => {});
  locks.set(key, done);
  void done.then(() => {
    if (locks.get(key) === done) locks.delete(key);
  });
  return run;
}

export interface CreateRuntimeOptions {
  db: PrismaClient;
  keyring: PermitKeyring;
  ttlMs?: number;
}

export class GovernanceRuntimeImpl implements GovernanceRuntime {
  readonly permitTtlMs: number;
  readonly permitKeyId: string;
  readonly nonceStore: NonceStore;
  readonly permitVerifier: PermitVerifier;
  private readonly locks = new Map<string, Promise<unknown>>();
  private readonly executionLocks = new Map<string, Promise<unknown>>();

  constructor(
    private readonly db: PrismaClient,
    private readonly keyring: PermitKeyring,
    ttlMs: number
  ) {
    this.permitTtlMs = ttlMs;
    this.permitKeyId = keyring.keyId;
    this.nonceStore = createNonceStore(db);
    this.permitVerifier = {
      verify: (permit: ExecutionPermit, nowIso?: string) => verifyPermitDetailed(permit, keyring, nowIso),
    };
  }

  getActionRegistration(actionId: string): RegisteredActionDef | null {
    return getActionRegistration(actionId);
  }

  async loadAuthoritativeContext(
    subjectId: string,
    actionId: string,
    opts?: { providedEvidenceManifestHash?: string | null; requestArrivedAt?: string }
  ): Promise<GovernanceInput> {
    const now = new Date();
    const nowIso = now.toISOString();

    const subjectRow = await this.db.governanceSubject.findUnique({ where: { id: subjectId } });
    const def = getActionRegistration(actionId);
    const hazardRows = def ? await listHazardsForAction(this.db, actionId) : [];
    const consentRow = def ? await this.db.governanceConsent.findFirst({
      where: { subjectId, actionId },
      orderBy: { policyEpoch: 'desc' },
    }) : null;
    const policyRow = await this.db.governancePolicyState.findUnique({ where: { id: 'policy' } });
    const policyEpoch = policyRow?.epoch ?? 1;
    const lastConfirmed = def ? await this.db.governancePermit.findFirst({
      where: { actionId, state: 'ACTUATOR_CONFIRMED', confirmedAt: { not: null } },
      orderBy: { confirmedAt: 'desc' },
      select: { confirmedAt: true },
    }) : null;

    const subject = {
      id: subjectRow?.id ?? subjectId,
      status: (subjectRow?.status as SubjectStatus | undefined) ?? 'UNKNOWN',
    };
    const action = { id: actionId, registered: def !== null, riskClass: def?.riskClass ?? null };
    const hazards: HazardState[] = hazardRows.map((h) => ({
      id: h.id,
      status: h.status as HazardState['status'],
      severity: h.severity,
      exposure: h.exposure,
      controllability: h.controllability,
    }));
    const consent: ConsentState | null = consentRow
      ? { subjectId: consentRow.subjectId, actionId: consentRow.actionId, policyEpoch: consentRow.policyEpoch }
      : null;
    const harmBenefit = def?.harmBenefit ?? { harm: 0, benefit: 0, assessedAt: '' };
    const actionInFlight = def ? await isActionInFlight(this.db, actionId, now) : false;

    const evidenceManifestHash = computeEvidenceManifestHash({
      subjectId,
      actionId,
      policyEpoch,
      hazards,
      consent,
      harmBenefit,
    });

    const context: ContextState = {
      policyEpoch,
      currentPolicyEpoch: policyEpoch,
      evidenceManifestHash,
      providedEvidenceManifestHash: opts?.providedEvidenceManifestHash ?? null,
      actionInFlight,
      requestArrivedAt: opts?.requestArrivedAt ?? nowIso,
      lastConfirmedAt: lastConfirmed?.confirmedAt ? lastConfirmed.confirmedAt.toISOString() : null,
      now: nowIso,
    };

    return { subject, action, hazards, consent, context, harmBenefit, observedAt: nowIso };
  }

  issuanceSection<T>(actionId: string, fn: () => Promise<T>): Promise<T> {
    return runSectioned(this.locks, actionId, fn);
  }

  executionSection<T>(actionId: string, fn: () => Promise<T>): Promise<T> {
    return runSectioned(this.executionLocks, actionId, fn);
  }

  async transaction<T>(fn: (tx: GovernanceTx) => Promise<T>): Promise<T> {
    return this.db.$transaction(async (prismaTx: Prisma.TransactionClient) => {
      const tx: GovernanceTx = {
        reserveNonce: (input) => reserveNonce(prismaTx, input),
        appendWormEvent: (input) => appendGovernanceWormEvent(prismaTx, input),
        createPermitRecord: (record) => createPermitRecord(prismaTx, record),
      };
      return fn(tx);
    });
  }

  signPermit(payload: PermitPayload): Promise<ExecutionPermit> {
    return Promise.resolve(signPermitPayload(payload, this.keyring));
  }

  async markPermitSigned(permitId: string, signature: string, keyId: string): Promise<void> {
    await markPermitSigned(this.db, permitId, signature, keyId);
  }

  async abortPermit(permitId: string, reason: string): Promise<void> {
    const permit = await this.db.governancePermit.findUnique({ where: { permitId } });
    if (!permit) return;
    await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      await markPermitAborted(tx, permitId, reason);
      await abortNonce(tx, permit.actionId, permit.actionNonce);
      await appendGovernanceWormEvent(tx, {
        type: 'PERMIT_ABORTED',
        actionId: permit.actionId,
        subjectId: permit.subjectId,
        permitId,
        payload: { reason },
        observedAt: new Date().toISOString(),
      });
    });
  }

  async resolveActuator(actionId: string): Promise<Actuator | null> {
    return resolveActuator(this.db, this.keyring, actionId);
  }
}

/**
 * Idempotent seed of the prototype's authoritative state: policy epoch 1,
 * the prototype operator (ACTIVE), the test actuator's hazard (MITIGATED,
 * SEC S1/E2/C1 → QM), and operator consent for the test action at the
 * CURRENT epoch. Tests seed their own states; the app seeds once per boot.
 */
export async function ensureGovernanceSeed(db: PrismaClient): Promise<void> {
  await db.governancePolicyState.upsert({
    where: { id: 'policy' },
    create: { id: 'policy', epoch: 1 },
    update: {},
  });
  await db.governanceSubject.upsert({
    where: { id: PROTOTYPE_OPERATOR_SUBJECT_ID },
    create: { id: PROTOTYPE_OPERATOR_SUBJECT_ID, status: 'ACTIVE', role: 'OPERATOR' },
    update: {},
  });
  await upsertHazard(db, {
    id: TEST_ACTUATOR.hazardIds[0],
    actionId: TEST_ACTUATOR.id,
    status: 'MITIGATED',
    severity: 'S1',
    exposure: 'E2',
    controllability: 'C1',
    description: 'Simulated wetted-loop pump pulse — no physical output connected (SIL slice).',
  });
  const policy = await db.governancePolicyState.findUnique({ where: { id: 'policy' } });
  const epoch = policy?.epoch ?? 1;
  await grantConsent(db, PROTOTYPE_OPERATOR_SUBJECT_ID, TEST_ACTUATOR.id, epoch);
}

// ─── App singleton ──────────────────────────────────────────────────────────

const globalForGovernance = globalThis as unknown as {
  __governanceRuntime?: { db: PrismaClient; runtime: GovernanceRuntimeImpl; seeded: boolean };
};

export function getGovernanceRuntime(): GovernanceRuntimeImpl {
  const entry = globalForGovernance.__governanceRuntime;
  // Capability check, not just identity: an HMR re-evaluation of this module
  // leaves the PREVIOUS class instance cached on globalThis — if the cached
  // runtime lacks a method the current call needs (dev hot-reload), rebuild
  // instead of throwing (same discipline as db.ts's hot schema upgrade).
  if (
    entry &&
    entry.db === appDb &&
    typeof entry.runtime.executionSection === 'function' &&
    typeof entry.runtime.issuanceSection === 'function' &&
    typeof entry.runtime.loadAuthoritativeContext === 'function'
  ) {
    return entry.runtime;
  }
  // Fail closed: no configured keyring → no runtime → no permits, ever.
  const keyring = loadPermitKeyring();
  const runtime = new GovernanceRuntimeImpl(appDb, keyring, DEFAULT_PERMIT_TTL_MS);
  globalForGovernance.__governanceRuntime = { db: appDb, runtime, seeded: entry?.seeded ?? false };
  return runtime;
}

/** Seed-once-per-boot for the app path (routes call this; upserts are
 *  idempotent anyway — the flag only avoids redundant round-trips). */
export async function ensureAppGovernanceSeed(): Promise<void> {
  const entry = globalForGovernance.__governanceRuntime;
  if (entry?.seeded) return;
  await ensureGovernanceSeed(appDb);
  if (entry) entry.seeded = true;
}
