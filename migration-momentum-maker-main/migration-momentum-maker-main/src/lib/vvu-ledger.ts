// src/lib/vvu-ledger.ts — WORM (Write Once Read Many) append-only ledger with
// SHA-256 hash chain. Seeded with the 19 master assets of the release manifest.

import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { RELEASE_MANIFEST, RELEASE_TAG } from '@/lib/vvu-data';
import type { LedgerEntry } from '@/types/vvu';

export const GENESIS_HASH = 'GENESIS-20260901-0000000000000000000000000000000000';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Deterministic manifest hash: SHA-256 over filename + release tag + contents role. */
export function manifestHash(filename: string): string {
  return sha256(`${RELEASE_TAG}|${filename}|${RELEASE_MANIFEST.find((m) => m.filename === filename)?.role ?? 'MASTER_ASSET'}`);
}

export interface AppendInput {
  source: string;
  event: string;
  details?: string;
}

/** Append a WORM event. Hash = SHA-256(prevHash + seq + source + event + details + ts).
 *
 * Task 7-a: seq is computed via read-tip → create. Concurrent POSTs (telemetry
 * flush + UI actions) can race on the unique seq constraint (P2002). On that
 * error we re-read the chain tip, recompute seq/prevHash/hash and retry — the
 * event lands on the next free seq instead of being dropped by the queue.
 */
export async function appendWormEvent(input: AppendInput): Promise<LedgerEntry> {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; ; attempt++) {
    const last = await db.wormEvent.findFirst({ orderBy: { seq: 'desc' } });
    const seq = (last?.seq ?? 0) + 1;
    const prevHash = last?.hash ?? GENESIS_HASH;
    const createdAt = new Date();
    const hash = sha256(`${prevHash}|${seq}|${input.source}|${input.event}|${input.details ?? ''}|${createdAt.toISOString()}`);
    try {
      const row = await db.wormEvent.create({
        data: {
          seq,
          source: input.source,
          event: input.event,
          details: input.details ?? null,
          prevHash,
          hash,
          createdAt,
        },
      });
      return serialize(row);
    } catch (e) {
      const code = (e as { code?: string }).code;
      // P2002 = unique-constraint race on `seq` → re-read tip, retry with next seq.
      if (code === 'P2002' && attempt < MAX_ATTEMPTS) continue;
      throw e;
    }
  }
}

type WormRow = {
  id: string;
  seq: number;
  source: string;
  event: string;
  details: string | null;
  prevHash: string;
  hash: string;
  createdAt: Date;
};

function serialize(e: WormRow): LedgerEntry {
  return {
    id: e.id,
    seq: e.seq,
    source: e.source,
    event: e.event,
    details: e.details,
    prevHash: e.prevHash,
    hash: e.hash,
    createdAt: e.createdAt.toISOString(),
  };
}

export async function getLedgerEntries(limit = 200): Promise<LedgerEntry[]> {
  const rows = await db.wormEvent.findMany({ orderBy: { seq: 'desc' }, take: limit });
  return rows.map(serialize);
}

/** Task 7-a — cursor pagination: entries with seq strictly below `before`,
 *  newest first. Lets the UI page backwards through the chain without the
 *  500-row single-fetch cap. */
export async function getLedgerEntriesBefore(before: number, limit = 50): Promise<LedgerEntry[]> {
  const rows = await db.wormEvent.findMany({
    where: { seq: { lt: before } },
    orderBy: { seq: 'desc' },
    take: limit,
  });
  return rows.map(serialize);
}

/** Entries filtered by source (e.g. MANIFEST) — newest first, capped. */
export async function getLedgerEntriesBySource(source: string, limit = 100): Promise<LedgerEntry[]> {
  const rows = await db.wormEvent.findMany({
    where: { source },
    orderBy: { seq: 'desc' },
    take: Math.min(500, limit),
  });
  return rows.map(serialize);
}

/** Recompute the chain over the full ledger (ascending) to prove integrity. */
export async function verifyChain(): Promise<{ count: number; chainValid: boolean; lastHash: string | null; breakAt: number | null }> {
  const rows = await db.wormEvent.findMany({ orderBy: { seq: 'asc' } });
  let prev = GENESIS_HASH;
  for (const r of rows) {
    const expect = sha256(`${prev}|${r.seq}|${r.source}|${r.event}|${r.details ?? ''}|${r.createdAt.toISOString()}`);
    if (r.prevHash !== prev || r.hash !== expect) {
      return { count: rows.length, chainValid: false, lastHash: rows[rows.length - 1]?.hash ?? null, breakAt: r.seq };
    }
    prev = r.hash;
  }
  return { count: rows.length, chainValid: true, lastHash: rows[rows.length - 1]?.hash ?? null, breakAt: null };
}

/** Idempotent seed: register the 19 master asset hashes (one-time). */
export async function seedLedger(): Promise<{ created: number; total: number; seeded: boolean }> {
  const existing = await db.wormEvent.count({ where: { source: 'MANIFEST' } });
  if (existing > 0) {
    return { created: 0, total: await db.wormEvent.count(), seeded: false };
  }
  let created = 0;
  for (const m of RELEASE_MANIFEST) {
    await appendWormEvent({
      source: 'MANIFEST',
      event: 'RELEASE_HASH_REGISTERED',
      details: `${m.filename} · ${m.role} · ${manifestHash(m.filename).slice(0, 16)}… · ${RELEASE_TAG}`,
    });
    created++;
  }
  return { created, total: await db.wormEvent.count(), seeded: true };
}
