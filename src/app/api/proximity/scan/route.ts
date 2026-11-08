// src/app/api/proximity/scan/route.ts
// STEP 1+2+3 EXPOSED — POST one scan: contract → governance gate → seal.
// Contract violations are 400 (fail closed, nothing inferred); gate
// refusals are 200 with the refusal RECORDED but not sealed — the gate is
// a decision, not an error.

import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { ingestScan } from '@/server/proximity/pipeline';
import { ContractViolationError } from '@/server/proximity/contract';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'BAD_JSON', detail: 'request body must be JSON' },
      { status: 400 },
    );
  }
  try {
    const outcome = await ingestScan(db, body);
    return NextResponse.json({ ok: true, outcome });
  } catch (e) {
    if (e instanceof ContractViolationError) {
      return NextResponse.json(
        { ok: false, error: e.code, detail: e.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: 'INGEST_FAILED', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
