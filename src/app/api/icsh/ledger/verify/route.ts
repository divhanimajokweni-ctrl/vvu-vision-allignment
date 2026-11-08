// GET /api/icsh/ledger/verify — the standalone auditor (icsh_verify.py
// lineage). Walks the WORM hash chain AND the cycle-head chain, recomputing
// every preimage. Returns the one-line verdict, nothing else needed.
import { NextResponse } from 'next/server';
import { verifyIcshLedger } from '@/lib/icsh/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await verifyIcshLedger();
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, line: `AUDITOR ERROR: ${String(e instanceof Error ? e.message : e)}` },
      { status: 500 }
    );
  }
}
