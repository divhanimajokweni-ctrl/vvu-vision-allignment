import { NextResponse } from 'next/server';
import { seedSovereignDb, getDbStats } from '@/lib/vvu-seed';
import { seedLedger } from '@/lib/vvu-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/vvu/db-stats — seeds the sovereign DB + WORM manifest (idempotent)
// and returns live row counts per table.
export async function GET() {
  try {
    const seedResult = await seedSovereignDb();
    const ledgerResult = await seedLedger();
    const stats = await getDbStats();
    return NextResponse.json({
      ...stats,
      seedResult: {
        tenantCreated: seedResult.tenant.created,
        anchorCreated: seedResult.anchorCreated,
        nodesCreated: seedResult.nodesCreated,
        spoolsCreated: seedResult.spoolsCreated,
        invariantsCreated: seedResult.invariantsCreated,
        gatesCreated: seedResult.gatesCreated,
        ledgerCreated: ledgerResult.created,
        ledgerTotal: ledgerResult.total,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
