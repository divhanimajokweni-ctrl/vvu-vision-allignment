import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appendWormEvent } from '@/lib/vvu-ledger';
import { computeVotingLedger, GQEBERHA_TENANT_ID, GATE_DEFS } from '@/lib/vvu-data';
import { seedSovereignDb } from '@/lib/vvu-seed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIM_STATE_URL = 'http://127.0.0.1:3003/state';
const GATE_SHARES: Record<string, number> = { '3A': 10000, '3B': 40000, '3C': 59100 };
const GATE_DEFS_LOOKUPS: Record<string, (typeof GATE_DEFS)[number]> = Object.fromEntries(
  GATE_DEFS.map((g) => [g.gateId, g])
);

interface SimGateProgress {
  id: string;
  conditionsMet: boolean;
}

/** Ask the telemetry mini-service whether the gate's simulated conditions hold. */
async function fetchSimConditions(): Promise<{ online: boolean; gates?: SimGateProgress[] }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(SIM_STATE_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { online: false };
    const data = (await res.json()) as { gateProgress?: SimGateProgress[] };
    return { online: true, gates: data.gateProgress };
  } catch {
    return { online: false };
  }
}

// POST /api/vvu/gates { gate: '3A' | '3B' | '3C' }
// Certifies a trust gate: checks sim conditions (if service is online),
// persists the unlock, appends a WORM event + audit log entry, returns the
// updated voting ledger.
export async function POST(req: NextRequest) {
  let body: { gate?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const gate = body.gate ?? '';
  if (!GATE_SHARES[gate]) {
    return NextResponse.json(
      { success: false, message: 'Unknown gate. Expected 3A, 3B or 3C.' },
      { status: 422 }
    );
  }

  try {
    await seedSovereignDb();

    const row = await db.trustGateState.findFirst({ where: { gateId: gate } });
    if (row?.status === 'CERTIFIED') {
      return NextResponse.json(
        { success: false, message: `Gate ${gate} already certified (WORM-immutable).` },
        { status: 409 }
      );
    }

    // Check live sim conditions when the telemetry service is reachable.
    const sim = await fetchSimConditions();
    let conditionsVerified: 'VERIFIED' | 'UNVERIFIED' | 'NOT_MET' = 'UNVERIFIED';
    if (sim.online && sim.gates) {
      const g = sim.gates.find((x) => x.id === gate);
      if (g && g.conditionsMet === false) {
        return NextResponse.json(
          {
            success: false,
            message: `Gate ${gate} conditions not met yet — watch the live progress in the Trust Gates panel.`,
          },
          { status: 422 }
        );
      }
      if (g && g.conditionsMet === true) conditionsVerified = 'VERIFIED';
    }

    const def = GATE_DEFS_LOOKUPS[gate];
    const worm = await appendWormEvent({
      source: 'GATE_CERT',
      event: `GATE_${gate}_CERTIFIED`,
      details: `${def.title} · +${GATE_SHARES[gate].toLocaleString('en-ZA')} Class B → ${def.beneficiary} · certification: ${def.certification} · conditions ${conditionsVerified}`,
    });

    await db.trustGateState.update({
      where: { gateId: gate },
      data: { status: 'CERTIFIED', certifiedAt: new Date(), certifiedBy: 'FOUNDER', certHash: worm.hash },
    });

    await db.auditLog.create({
      data: {
        tenantId: GQEBERHA_TENANT_ID,
        actor: 'FOUNDER',
        action: `GATE_${gate}_CERTIFIED`,
        fromState: 'STEADY_STATE_LOCKED',
        toState: 'STEADY_STATE_LOCKED',
        symbol: 'CERT',
        reason: `${def.title} · SHA ${worm.hash.slice(0, 16)}…`,
        metadata: JSON.stringify({ shares: GATE_SHARES[gate], beneficiary: def.beneficiary }),
      },
    });

    const gateRows = await db.trustGateState.findMany();
    const certified = new Set(gateRows.filter((g) => g.status === 'CERTIFIED').map((g) => g.gateId));

    return NextResponse.json({
      success: true,
      gate,
      shares: GATE_SHARES[gate],
      certHash: worm.hash,
      conditionsVerified,
      voting: computeVotingLedger(certified),
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
