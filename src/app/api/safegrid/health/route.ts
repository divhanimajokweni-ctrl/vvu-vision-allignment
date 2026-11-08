// src/app/api/safegrid/health/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// VVU DELIVERY HEALTH — SafeGrid's prober target (mini-services/safegrid/
// src/vvu-health.ts). Reports the consumer-side backlog (unsealed inbox
// rows) that feeds the §4 predicate's degraded/unavailable transitions:
//
//   · HTTP 200 always (the process is alive) with { backlog }
//   · backlog counts rows NOT in terminal 'sealed' state — the delivery
//     lag SafeGrid's policy reasons about. Fail-closed on the SafeGrid
//     side: no answer / bad body ⇒ 'unavailable'.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { startReconcilerWorker, reconcilerWorkerStatus } from '@/server/safegrid/worker';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  startReconcilerWorker();
  const [nonTerminal, sealed, streams] = await Promise.all([
    db.safegridInbox.count({ where: { status: { not: 'sealed' } } }),
    db.safegridInbox.count({ where: { status: 'sealed' } }),
    db.wormSealIndex.groupBy({ by: ['streamId'] }),
  ]);
  return NextResponse.json({
    ok: true,
    service: 'vvu-safegrid-consumer',
    backlog: nonTerminal,
    sealed,
    streams: streams.length,
    reconciler: reconcilerWorkerStatus(),
    checkedAt: new Date().toISOString(),
  });
}
