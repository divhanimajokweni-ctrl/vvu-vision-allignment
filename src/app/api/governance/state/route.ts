// src/app/api/governance/state/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/governance/state — the read-only view for the #/governance panel:
// keyring status, policy epoch, registered actuators (with hazards/ASIL/
// consent), recent chain events, recent permits, chain verification.
//
// This route is DISPLAY-ONLY and fail-open on the keyring (a misconfigured
// keyring must still show the panel + the honest NOT CONFIGURED state);
// execution remains fail-closed in /execute.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { deriveASIL } from '@/lib/governance-protocol';
import { loadPermitKeyring } from '@/lib/permit-crypto';
import type { GovernanceActuatorView } from '@/components/governance/GovernanceGate';
import {
  DEFAULT_PERMIT_TTL_MS,
  ensureAppGovernanceSeed,
  PROTOTYPE_OPERATOR_SUBJECT_ID,
} from '@/server/governance-runtime';
import { listRegisteredActions, RELEASE_TAG_GOVERNANCE } from '@/server/actuator-registry';
import { listHazardsForAction } from '@/server/hazard-store';
import { listRecentGovernanceEvents, listRecentPermits } from '@/server/permit-store';
import { verifyGovernanceChain } from '@/server/worm-store';

export async function GET(): Promise<NextResponse> {
  await ensureAppGovernanceSeed();

  let keyring: { configured: boolean; keyId: string | null; error: string | null };
  try {
    const k = loadPermitKeyring();
    keyring = { configured: true, keyId: k.keyId, error: null };
  } catch (error) {
    keyring = { configured: false, keyId: null, error: (error as Error).message };
  }

  const policy = await db.governancePolicyState.findUnique({ where: { id: 'policy' } });
  const subject = await db.governanceSubject.findUnique({ where: { id: PROTOTYPE_OPERATOR_SUBJECT_ID } });

  const actuators: GovernanceActuatorView[] = [];
  for (const def of listRegisteredActions()) {
    const hazards = await listHazardsForAction(db, def.id);
    const consent = await db.governanceConsent.findFirst({
      where: { subjectId: PROTOTYPE_OPERATOR_SUBJECT_ID, actionId: def.id },
      orderBy: { policyEpoch: 'desc' },
    });
    actuators.push({
      id: def.id,
      displayName: def.displayName,
      riskClass: def.riskClass,
      requiresConsent: def.requiresConsent,
      simulated: def.simulated,
      effectKind: def.effectKind,
      description: def.description,
      harmBenefit: def.harmBenefit,
      hazards: hazards.map((h) => ({
        id: h.id,
        status: h.status,
        severity: h.severity,
        exposure: h.exposure,
        controllability: h.controllability,
        asil: deriveASIL(h),
      })),
      consent: consent
        ? { policyEpoch: consent.policyEpoch, grantedAt: consent.grantedAt.toISOString() }
        : null,
    });
  }

  const events = await listRecentGovernanceEvents(db, 14);
  const permits = await listRecentPermits(db, 8);
  const chain = await verifyGovernanceChain(db);
  const effects = await db.actuatorEffect.count();

  return NextResponse.json(
    {
      tag: RELEASE_TAG_GOVERNANCE,
      releaseLadder: ['PROTOTYPE', 'SIL_CANDIDATE', 'SIL_PASS', 'CONTROLLED_BENCH', 'PHYSICAL_PILOT'],
      releaseStage: 'SIL_CANDIDATE',
      keyring: { ...keyring, algorithm: 'Ed25519', pinned: true },
      policyEpoch: policy?.epoch ?? 1,
      permitTtlMs: DEFAULT_PERMIT_TTL_MS,
      operatorSubject: {
        id: PROTOTYPE_OPERATOR_SUBJECT_ID,
        status: subject?.status ?? 'UNKNOWN',
        authMode: 'PROTOTYPE_AUTH',
      },
      actuators,
      effects,
      chain: {
        valid: chain.valid,
        count: chain.count,
        headHash: chain.headHash,
        firstBadSeq: chain.firstBadSeq,
      },
      recentEvents: events.map((e) => ({
        seq: e.seq,
        type: e.type,
        actionId: e.actionId,
        subjectId: e.subjectId,
        permitId: e.permitId,
        observedAt: e.observedAt.toISOString(),
        hash: e.hash.slice(0, 16),
        prevHash: e.prevHash.slice(0, 16),
      })),
      recentPermits: permits.map((p) => ({
        permitId: p.permitId,
        actionId: p.actionId,
        subjectId: p.subjectId,
        state: p.state,
        policyEpoch: p.policyEpoch,
        issuedAt: p.issuedAt.toISOString(),
        expiresAt: p.expiresAt.toISOString(),
        keyId: p.keyId,
        signaturePrefix: p.signature ? p.signature.slice(0, 20) : null,
        abortedReason: p.abortedReason,
      })),
      negativePathSuite: {
        command: 'bun test --conditions=react-server ./tests/governance',
        groups: ['evaluator', 'permit', 'nonce', 'enforcement', 'recovery'],
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
