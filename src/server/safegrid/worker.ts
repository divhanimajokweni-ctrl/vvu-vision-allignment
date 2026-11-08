// src/server/safegrid/worker.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE RECONCILER WORKER — a 60-second interval inside the Next.js server
// process. Started by src/instrumentation.ts (server boot) AND lazily by
// the /api/safegrid routes (belt-and-braces for HMR-reloaded processes).
//
// HMR-safety: the interval is registered on globalThis with a generation
// stamp — a hot-reload of this module disposes the previous timer before
// registering a new one, so exactly one reconciler runs per server process
// (same discipline as src/lib/db.ts's client singleton).
//
// SAFEGRID_RECONCILER=off disables the worker (used by the acceptance
// suite, which drives reconcilePass() directly against isolated DBs).
// ─────────────────────────────────────────────────────────────────────────────

import { db } from '@/lib/db';
import { RECONCILE_INTERVAL_MS, reconcilePass } from './reconciler';

interface WorkerGlobal {
  safegridReconcilerTimer?: ReturnType<typeof setInterval>;
  safegridReconcilerGen?: number;
}

const g = globalThis as unknown as WorkerGlobal;
const GENERATION = Date.now();

export function startReconcilerWorker(): { started: boolean; intervalMs: number } {
  if (process.env.SAFEGRID_RECONCILER === 'off') {
    return { started: false, intervalMs: 0 };
  }
  if (g.safegridReconcilerTimer && g.safegridReconcilerGen === GENERATION) {
    return { started: false, intervalMs: RECONCILE_INTERVAL_MS }; // already ours
  }
  if (g.safegridReconcilerTimer) {
    clearInterval(g.safegridReconcilerTimer); // dispose an older generation
  }
  const timer = setInterval(() => {
    void reconcilePass(db)
      .then((s) => {
        if (s.inspected > 0) {
          console.log(
            `[safegrid-reconciler] inspected ${s.inspected} · repaired-from-seal ${s.sealedFromExisting} · sealed-by-append ${s.sealedByAppend} · failing ${s.stillFailing}`,
          );
        }
      })
      .catch((e) => console.error('[safegrid-reconciler] pass failed:', e));
  }, RECONCILE_INTERVAL_MS);
  timer.unref?.();
  g.safegridReconcilerTimer = timer;
  g.safegridReconcilerGen = GENERATION;
  return { started: true, intervalMs: RECONCILE_INTERVAL_MS };
}

export function reconcilerWorkerStatus(): { running: boolean; intervalMs: number } {
  return {
    running: !!g.safegridReconcilerTimer && process.env.SAFEGRID_RECONCILER !== 'off',
    intervalMs: RECONCILE_INTERVAL_MS,
  };
}
