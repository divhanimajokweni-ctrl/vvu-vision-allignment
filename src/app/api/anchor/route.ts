// src/app/api/anchor/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// STUB ANCHOR RELAY (Task 39 — ProofBridge full-chain integration).
// Stateless. Receives a receipt HASH + wantProof flag; returns a txRef.
// Sees NO user data, retains NO rows, emits NO PII — POPIA-safe by
// construction.
//
// ⚠ THE TARGET IS A DETERMINISTIC STUB — no real chain write happens. Every
// txRef it mints self-declares (`stub:<hash16>`) and the response carries
// `stub: true`, so downstream honesty checks can grep it. Before shipping to
// paying users, replace the stub block below with one of:
//   · L2 tx (Base/Arbitrum) with the hash in calldata
//   · Trillian / CT-style transparency log (append leaf → inclusion proof)
//   · Merkle accumulator (append → root + path)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { hash?: string; wantProof?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  const { hash, wantProof } = body;
  if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) {
    return NextResponse.json({ error: 'hash must be 64-char hex' }, { status: 400 });
  }

  // TODO(Task 39 follow-up): replace with a real anchor target — L2 calldata
  // tx, Trillian/CT leaf append, or Merkle accumulator. Stub is deterministic
  // and collision-safe for verification only.
  const txRef = `stub:${hash.slice(0, 16)}`;

  return NextResponse.json({
    txRef,
    proof: wantProof ? `stub-proof:${hash.slice(0, 16)}` : undefined,
    stub: true,
    note: 'stub anchor — no chain write occurred (replace with L2/Trillian before paying-tier production use)',
  });
}
