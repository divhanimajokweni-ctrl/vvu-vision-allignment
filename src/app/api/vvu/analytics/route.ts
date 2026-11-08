import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { seedSovereignDb, getDbStats } from '@/lib/vvu-seed';
import { seedLedger, verifyChain } from '@/lib/vvu-ledger';
import { computeVotingLedger, GATE_DEFS } from '@/lib/vvu-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/vvu/analytics
// Seeds the sovereign DB + WORM ledger (idempotent) and returns the full
// analyst summary: certified trust gates, live MOI voting ledger, WORM state.
export async function GET() {
  try {
    await seedSovereignDb();
    await seedLedger();

    const gateRows = await db.trustGateState.findMany({ orderBy: { gateId: 'asc' } });
    const certified = new Set(gateRows.filter((g) => g.status === 'CERTIFIED').map((g) => g.gateId));
    const voting = computeVotingLedger(certified);

    const [chain, telemetryCount, auditCount, steadyNodes] = await Promise.all([
      verifyChain(),
      db.telemetryLog.count(),
      db.auditLog.count(),
      db.telemetryLog.count({ where: { systemState: 'STEADY_STATE_LOCKED' } }),
    ]);

    const gates = GATE_DEFS.map((def) => {
      const row = gateRows.find((g) => g.gateId === def.gateId);
      return {
        gateId: def.gateId,
        title: def.title,
        requirement: def.requirement,
        certification: def.certification,
        beneficiary: def.beneficiary,
        shares: def.shares,
        status: row?.status === 'CERTIFIED' ? 'CERTIFIED' : 'PENDING',
        certifiedAt: row?.certifiedAt ? row.certifiedAt.toISOString() : null,
        certHash: row?.certHash ?? null,
      };
    });

    return NextResponse.json({
      gates,
      voting,
      worm: { count: chain.count, chainValid: chain.chainValid, lastHash: chain.lastHash },
      telemetryCount,
      auditCount,
      steadyNodes,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
