// src/app/api/proximity/chain/route.ts
// The sealed stream in AUTHORITATIVE order (position ascending) plus the
// verification result computed from STORED CANONICAL BYTES — never a
// re-serialization. This is the State Ledger's data source.

import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { listChain, verifyProximityChain } from '@/server/proximity/verify';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const [chain, verification] = await Promise.all([listChain(db), verifyProximityChain(db)]);
  return NextResponse.json({ ok: true, chain, verification });
}
