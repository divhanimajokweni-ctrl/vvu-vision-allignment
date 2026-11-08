// src/app/api/proximity/audit/route.ts
// THE TWO PRE-SEND CHECKS, executed live:
//   1. CONTRACT AUDIT — every numeric field is a safe integer with its
//      unit in the name; the float probe (distance_m: 0.45) must be
//      refused by the real validator.
//   2. SIMULATOR/PRODUCTION BOUNDARY — enforced in code (a stored column
//      read at tamper time), PROBED against the first production record:
//      the tamper path is exercised for real and must return
//      PRODUCTION_IMMUTABLE.

import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { auditContract } from '@/server/proximity/contract';
import { BoundaryViolationError, tamperSealedRecord } from '@/server/proximity/tamper';
import { formatUtc, type ContractAuditResult } from '@/lib/proximity/types';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const contract = auditContract();

  // Boundary probe — actually attempt the tamper on a production record.
  const production = await db.proximityRecord.findFirst({
    where: { source: 'production', sealRef: { not: null } },
    orderBy: { ingestedAt: 'asc' },
  });
  let probe: ContractAuditResult['boundary']['probe'] = null;
  if (production) {
    try {
      await tamperSealedRecord(db, production.eventId);
      probe = { eventId: production.eventId, source: production.source, refusedWith: 'NOT REFUSED — BOUNDARY BREACH' };
    } catch (e) {
      if (e instanceof BoundaryViolationError) {
        probe = { eventId: production.eventId, source: production.source, refusedWith: `403 ${e.code}` };
      } else {
        probe = { eventId: production.eventId, source: production.source, refusedWith: `refused: ${e instanceof Error ? e.message : String(e)}` };
      }
    }
  }
  const productionCount = await db.proximityRecord.count({ where: { source: 'production' } });

  const audit: ContractAuditResult = {
    contract: 'vvu.proximity.scan.v1',
    fields: contract.fields,
    floatRejectionProbe: contract.floatRejectionProbe,
    boundary: {
      enforcedInCode: true,
      mechanism:
        "tamper reads proximity_records.source from the database and refuses source !== 'simulator' with PRODUCTION_IMMUTABLE — a stored column, not a runtime flag",
      productionRecords: productionCount,
      probe,
    },
    checkedAtUtc: formatUtc(Date.now()),
  };
  const allFieldsOk = audit.fields.every((f) => f.numericOk);
  const ok = allFieldsOk && audit.floatRejectionProbe.verdict === 'PASS' && probe !== null && probe.refusedWith.startsWith('403');
  return NextResponse.json({ ok, audit });
}
