// src/server/hazard-store.ts — hazard ledger reads + idempotent seed.
// ASIL is derived in the pure layer (governance-protocol.deriveASIL); this
// store only loads what IS on record. Unmitigated or unmapped hazards
// refuse — the store never "fixes" a hazard.
import 'server-only';

import type { Prisma } from '@prisma/client';

type DbLike = Prisma.TransactionClient;

export async function listHazardsForAction(db: DbLike, actionId: string) {
  return db.governanceHazard.findMany({ where: { actionId } });
}

export async function upsertHazard(
  db: DbLike,
  hazard: {
    id: string;
    actionId: string;
    status: string;
    severity: string;
    exposure: string;
    controllability: string;
    description?: string;
  }
): Promise<void> {
  await db.governanceHazard.upsert({
    where: { id: hazard.id },
    create: hazard,
    update: {
      status: hazard.status,
      severity: hazard.severity,
      exposure: hazard.exposure,
      controllability: hazard.controllability,
      description: hazard.description,
    },
  });
}
