// src/server/consent-store.ts — operator consent per (subject, action,
// policy epoch). The evaluator demands a row at the CURRENT epoch; nothing
// here ever fabricates or refreshes consent on an action's behalf.
import 'server-only';

import type { Prisma } from '@prisma/client';

type DbLike = Prisma.TransactionClient;

export async function findConsent(db: DbLike, subjectId: string, actionId: string) {
  // latest epoch on record for this pair — the evaluator compares epochs
  const rows = await db.governanceConsent.findMany({
    where: { subjectId, actionId },
    orderBy: { policyEpoch: 'desc' },
    take: 1,
  });
  return rows[0] ?? null;
}

export async function grantConsent(db: DbLike, subjectId: string, actionId: string, policyEpoch: number): Promise<void> {
  await db.governanceConsent.upsert({
    where: { subjectId_actionId_policyEpoch: { subjectId, actionId, policyEpoch } },
    create: { subjectId, actionId, policyEpoch },
    update: { grantedAt: new Date() },
  });
}
