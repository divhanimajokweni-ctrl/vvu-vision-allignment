// src/server/auth.ts
// ─────────────────────────────────────────────────────────────────────────────
// PROTOTYPE_AUTH — subject resolution for the governance entry points.
//
// Next.js Server Actions (and API route handlers) are directly reachable via
// POST — UI visibility proves nothing. EVERY entry point therefore resolves
// the subject from AUTHORITATIVE SERVER STATE on every call, and fails
// closed: an unknown or revoked subject never reaches enforce().
//
// Honest scope of this build: there is no credential layer yet — the subject
// is the registered prototype operator (env GOVERNANCE_OPERATOR_SUBJECT_ID,
// default 'operator.prototype'). Revoking that row makes every entry point
// refuse (the revoked-subject negative path). A real session/credential
// layer slots in HERE and nowhere else.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

import type { PrismaClient } from '@prisma/client';

import { AuthError } from '@/lib/governance-errors';
import { PROTOTYPE_OPERATOR_SUBJECT_ID } from './governance-runtime';

export interface ResolvedSubject {
  id: string;
  status: string;
  role: string;
  authMode: 'PROTOTYPE_AUTH';
}

export async function requireSubject(db: PrismaClient): Promise<ResolvedSubject> {
  const row = await db.governanceSubject.findUnique({ where: { id: PROTOTYPE_OPERATOR_SUBJECT_ID } });
  if (!row) throw new AuthError('SUBJECT_UNKNOWN');
  if (row.status !== 'ACTIVE') throw new AuthError('SUBJECT_REVOKED');
  return { id: row.id, status: row.status, role: row.role, authMode: 'PROTOTYPE_AUTH' };
}
