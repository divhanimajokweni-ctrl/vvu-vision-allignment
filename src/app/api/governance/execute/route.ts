// src/app/api/governance/execute/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/governance/execute — the authenticated governance entry point.
//
// Route handlers are directly callable over POST exactly like Server
// Actions: authentication (PROTOTYPE_AUTH subject resolution, fail-closed)
// and authorization (registry gate + enforce()) run INSIDE this handler on
// every call — never inferred from the page that rendered the button.
//
//   200 { status: 'EXECUTED', permit, effectId, governanceEventId }
//   400 { status: 'ERROR', reasonCode: 'MALFORMED_REQUEST' }
//   401/403 { status: 'REFUSED', reasonCode, sealedEventSeq… }   (sealed)
//   500 { status: 'ERROR', reasonCode }                          (fail-closed)
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { AuthError } from '@/lib/governance-errors';
import { requireSubject } from '@/server/auth';
import {
  ensureAppGovernanceSeed,
  getGovernanceRuntime,
  PROTOTYPE_OPERATOR_SUBJECT_ID,
} from '@/server/governance-runtime';
import {
  authRefusal,
  ExecuteActionInput,
  requestExecution,
} from '@/server/request-execution';

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: 'ERROR', actionId: null, reasonCode: 'MALFORMED_REQUEST', detail: 'body is not JSON' },
      { status: 400 }
    );
  }

  const parsed = ExecuteActionInput.safeParse(body);
  if (!parsed.success) {
    const rawActionId =
      typeof body === 'object' && body !== null && 'actionId' in body
        ? String((body as { actionId: unknown }).actionId)
        : null;
    return NextResponse.json(
      {
        status: 'ERROR',
        actionId: rawActionId,
        reasonCode: 'MALFORMED_REQUEST',
        detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      },
      { status: 400 }
    );
  }

  // Authentication — fail closed, every call.
  let subjectId: string;
  try {
    const subject = await requireSubject(db);
    subjectId = subject.id;
  } catch (error) {
    if (error instanceof AuthError) {
      const status = error.reasonCode === 'SUBJECT_UNKNOWN' ? 401 : 403;
      return NextResponse.json(authRefusal(error, parsed.data.actionId), { status });
    }
    return NextResponse.json(
      { status: 'ERROR', actionId: parsed.data.actionId, reasonCode: 'AUTH_RESOLUTION_FAILURE' },
      { status: 500 }
    );
  }

  // Seed the prototype's authoritative state (idempotent).
  await ensureAppGovernanceSeed();

  // Runtime — fails closed when the signing keyring is not configured.
  let runtime;
  try {
    runtime = getGovernanceRuntime();
  } catch (error) {
    return NextResponse.json(
      {
        status: 'ERROR',
        actionId: parsed.data.actionId,
        subjectId,
        reasonCode: 'GOVERNANCE_SIGNING_KEY_NOT_CONFIGURED',
        detail: (error as Error).message,
      },
      { status: 500 }
    );
  }

  const outcome = await requestExecution(runtime, db, subjectId, parsed.data);

  const status = outcome.status === 'EXECUTED' ? 200 : outcome.status === 'REFUSED' ? 403 : 500;
  return NextResponse.json(
    { ...outcome, authMode: 'PROTOTYPE_AUTH' as const, operatorSubject: PROTOTYPE_OPERATOR_SUBJECT_ID },
    { status }
  );
}
