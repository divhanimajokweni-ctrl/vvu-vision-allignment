// src/lib/proofbridge/anchor.ts
// ─────────────────────────────────────────────────────────────────────────────
// Thin, stateless anchor relay client (Task 39). Sees receipt HASHES only —
// no rows, no payloads, no PII. Fire-and-forget by design: the UI and the
// bridge never block on anchor confirmation; the chain is correct either way.
//
// ⚠ ANCHOR TARGET IS A STUB. The relay endpoint (src/app/api/anchor/route.ts)
// returns a deterministic stub txRef — NO real chain write happens yet (the
// L2 / Trillian / Merkle-accumulator swap is the follow-up). Every txRef the
// stub mints self-declares (`stub:<hash16>`), and the response carries
// `stub: true`, so downstream honesty checks can grep it.
// ─────────────────────────────────────────────────────────────────────────────

import { shouldAnchor, shouldProve, type Tier } from './tier';

// The production caller today is the :3004 vault-bridge mini-service (Bun),
// where a relative '/api/anchor' URL cannot resolve — the default must be
// absolute, backend-to-backend (the same pattern src/app/api/bridge/* uses
// for http://127.0.0.1:3004). Browser callers can override via
// NEXT_PUBLIC_ANCHOR_ENDPOINT.
const ANCHOR_ENDPOINT =
  process.env.ANCHOR_ENDPOINT ??
  process.env.NEXT_PUBLIC_ANCHOR_ENDPOINT ??
  'http://127.0.0.1:3000/api/anchor';

const ANCHOR_TIMEOUT_MS = 10_000;

export interface AnchorResult {
  anchored: boolean;
  txRef?: string;
  proof?: string; // ZK inclusion attestation (enterprise tier; stub this round)
  reason?: string;
}

export async function anchorReceipt(receiptHash: string, tier: Tier, signal?: AbortSignal): Promise<AnchorResult> {
  if (!shouldAnchor(tier)) {
    return { anchored: false, reason: 'tier-no-anchor' };
  }

  try {
    const res = await fetch(ANCHOR_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash: receiptHash, wantProof: shouldProve(tier) }),
      signal: signal ?? AbortSignal.timeout(ANCHOR_TIMEOUT_MS),
    });
    if (!res.ok) return { anchored: false, reason: `http-${res.status}` };
    const data = (await res.json()) as { txRef?: string; proof?: string };
    return { anchored: true, txRef: data.txRef, proof: data.proof };
  } catch (e) {
    return { anchored: false, reason: e instanceof Error ? e.message : 'unknown' };
  }
}

export function anchorReceiptAsync(receiptHash: string, tier: Tier): void {
  // intentionally not awaited — the UI must never block on the chain
  void anchorReceipt(receiptHash, tier).catch(() => { /* relay-side logging owns failures */ });
}
