// src/server/safegrid/reconciler.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE RECONCILER — VVU's self-healing backstop. Runs every 60 seconds.
//
// Finds inbox rows where status IN ('received','sealing','seal_failed')
//   AND received_at < now() - interval '60 seconds'      (the spec
// predicate; threshold configurable for the acceptance suite), and for
// each:
//
//   1. Look up worm_seal_index by event_id.
//   2. Seal exists → inbox status='sealed' + sealed_at + seal_ref.
//      DO NOT RE-APPEND. (Recovery point 7: a crash after the WORM append
//      but before the inbox update is repaired with the existing seal.)
//   3. No seal → attempt appendIfAbsent and update state.
//   4. Persistent failure → seal_attempts + 1, status='seal_failed',
//      keep the row eligible for the next pass. Failures never delete
//      evidence and never mark anything terminal.
//
// The reconciler is idempotent by construction: it only ever seals via
// appendIfAbsent (event_id PK backstop) or repairs from an existing seal.
// Running it twice, or racing it against an ingest, cannot produce a
// duplicate seal.
//
// Interval + threshold = SPEC (60 s each; must be measured in the pilot).
// ─────────────────────────────────────────────────────────────────────────────

import type { PrismaClient } from '@prisma/client';

import { appendIfAbsent } from './worm-chain';
import type { SafegridInbox } from '@prisma/client';

export const RECONCILE_INTERVAL_MS = Number(process.env.SAFEGRID_RECONCILE_INTERVAL_MS ?? 60_000); // SPEC
export const RECONCILE_THRESHOLD_MS = Number(process.env.SAFEGRID_RECONCILE_THRESHOLD_MS ?? 60_000); // SPEC

export interface ReconcileSummary {
  inspected: number;
  sealedFromExisting: number; // repaired WITHOUT re-append
  sealedByAppend: number; // appendIfAbsent actually appended
  stillFailing: number;
  errors: string[];
}

function sealRefOf(seal: { streamId: string; position: bigint }): string {
  return `${seal.streamId}#${seal.position}`;
}

/** One pass. Never throws for per-row failures — they become summary
 * entries (the next pass retries). */
export async function reconcilePass(
  db: PrismaClient,
  opts: { olderThanMs?: number } = {},
): Promise<ReconcileSummary> {
  const olderThanMs = opts.olderThanMs ?? RECONCILE_THRESHOLD_MS;
  const cutoff = new Date(Date.now() - olderThanMs);
  const summary: ReconcileSummary = {
    inspected: 0,
    sealedFromExisting: 0,
    sealedByAppend: 0,
    stillFailing: 0,
    errors: [],
  };

  const stuck: SafegridInbox[] = await db.safegridInbox.findMany({
    where: {
      status: { in: ['received', 'sealing', 'seal_failed'] },
      receivedAt: { lt: cutoff },
    },
    orderBy: { receivedAt: 'asc' }, // oldest first (fairness; not an ordering fact)
    take: 100,
  });
  summary.inspected = stuck.length;

  for (const row of stuck) {
    try {
      const existingSeal = await db.wormSealIndex.findUnique({ where: { eventId: row.eventId } });
      if (existingSeal) {
        // A seal already exists (crash between append and inbox update) —
        // repair the inbox row from it. NEVER re-append.
        await db.safegridInbox.update({
          where: { id: row.id },
          data: {
            status: 'sealed',
            sealedAt: new Date(),
            sealRef: sealRefOf(existingSeal),
            lastSealError: null,
            leaseUntil: null,
          },
        });
        summary.sealedFromExisting++;
        continue;
      }
      const append = await appendIfAbsent(db, {
        eventId: row.eventId,
        eventType: row.eventType,
        payload: JSON.parse(row.payload) as Record<string, unknown>,
        streamId: row.streamId,
      });
      await db.safegridInbox.update({
        where: { id: row.id },
        data: {
          status: 'sealed',
          sealedAt: new Date(),
          sealRef: sealRefOf(append.seal),
          lastSealError: null,
          leaseUntil: null,
        },
      });
      summary.sealedByAppend += append.status === 'appended' ? 1 : 0;
      if (append.status === 'existing') summary.sealedFromExisting++;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      summary.stillFailing++;
      summary.errors.push(`${row.eventId}: ${message}`);
      await db.safegridInbox
        .update({
          where: { id: row.id },
          data: {
            status: 'seal_failed',
            sealAttempts: { increment: 1 },
            lastSealError: message,
            leaseUntil: null,
          },
        })
        .catch(() => undefined); // row may have been sealed concurrently — fine
    }
  }
  return summary;
}
