// src/app/api/safegrid/chain/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE WORM SEAL CHAIN — read + verify.
//
// GET /api/safegrid/chain?stream=&limit=  → seals in AUTHORITATIVE order
// (stream, position ascending — worm_seal_index.position IS the stream
// order, §1.3) plus the full-chain verification result computed FROM
// STORED CANONICAL BYTES (never a re-serialization — §3's stored-bytes
// rule). This is the surface the #/safegrid workspace renders.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { verifyChain } from '@/server/safegrid/worm-chain';
import { startReconcilerWorker } from '@/server/safegrid/worker';
import type { SealRowView } from '@/lib/safegrid/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  startReconcilerWorker();
  const url = new URL(request.url);
  const stream = url.searchParams.get('stream');
  const limitRaw = Number(url.searchParams.get('limit') ?? 100);
  const limit = Number.isSafeInteger(limitRaw) && limitRaw > 0 && limitRaw <= 500 ? limitRaw : 100;
  const seals = await db.wormSealIndex.findMany({
    where: stream ? { streamId: stream } : {},
    orderBy: [{ streamId: 'asc' }, { position: 'asc' }], // THE order (append order)
    take: limit,
  });
  const verification = await verifyChain(db);
  const rows: SealRowView[] = seals.map((s) => ({
    eventId: s.eventId,
    streamId: s.streamId,
    position: s.position.toString(),
    recordHash: s.recordHash,
    previousRecordHash: s.previousRecordHash,
    canonicalEventHash: s.canonicalEventHash,
    sealedAt: s.sealedAt.toISOString(),
    algorithm: s.algorithm,
  }));
  return NextResponse.json({ ok: true, seals: rows, verification });
}
