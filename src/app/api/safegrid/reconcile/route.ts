// src/app/api/safegrid/reconcile/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// MANUAL RECONCILE PASS — operator + acceptance-suite surface over the
// same core the 60-second worker runs (src/server/safegrid/reconciler.ts).
//
// POST /api/safegrid/reconcile?olderThanMs=0
//   · default olderThanMs = 60 000 (the spec predicate);
//     ?olderThanMs=0 forces the pass over every non-terminal row (admin
//     action for the workspace demo — disclosed, it is the same pass with
//     a tighter threshold).
//   NEVER re-appends: a row whose seal already exists is repaired from
//   the existing seal; appendIfAbsent's event_id PK backstops the rest.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { reconcilePass } from '@/server/safegrid/reconciler';
import { reconcilerWorkerStatus, startReconcilerWorker } from '@/server/safegrid/worker';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  startReconcilerWorker();
  const url = new URL(request.url);
  const raw = url.searchParams.get('olderThanMs');
  let olderThanMs: number | undefined;
  if (raw !== null) {
    const n = Number(raw);
    if (!Number.isSafeInteger(n) || n < 0) {
      return NextResponse.json({ ok: false, error: 'olderThanMs must be a safe integer >= 0' }, { status: 400 });
    }
    olderThanMs = n;
  }
  const summary = await reconcilePass(db, { olderThanMs });
  return NextResponse.json({ ok: true, summary, worker: reconcilerWorkerStatus() });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, worker: reconcilerWorkerStatus() });
}
