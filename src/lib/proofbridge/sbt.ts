// src/lib/proofbridge/sbt.ts
// ─────────────────────────────────────────────────────────────────────────────
// SBT LEDGER WIRING — Task 43-f (0x09: "SBT mint not connected to
// VVUIVELedger").
//
// In this estate an SBT (soul-bound token) is a NON-TRANSFERABLE receipt
// artifact with two legs:
//   1. a governance-ledger entry (type 'sbt.mint') on the :3004 control plane
//      — hash-chained, merkle-rooted, inclusion-provable;
//   2. a WORM event on the VVUIVE ledger (WormEvent, source 'PROOFBRIDGE')
//      — the same append-only ledger the whole dashboard receipts through.
//
// Non-transferability is STRUCTURAL, not policy: neither ledger has a
// transfer operation, and both are append-only. The token cannot move
// because no code path can move it. There is also no direct mint action —
// SBTs fire ONLY as the consequence of an accepted 'dh.sign' take (the
// operator-only admin-scope release of a queued disciplinary-hold event).
//
// Like anchor.ts, this client is thin, stateless and backend-to-backend
// (the :3004 bridge cannot resolve a relative URL). It sees metadata only —
// token id, DH event reference, bound devID, ledger roots. No PII.
// ─────────────────────────────────────────────────────────────────────────────

const LEDGER_ENDPOINT =
  process.env.PROOFBRIDGE_SBT_LEDGER_ENDPOINT ??
  process.env.NEXT_PUBLIC_LEDGER_ENDPOINT ??
  'http://127.0.0.1:3000/api/vvu/ledger';

const LEDGER_TIMEOUT_MS = 10_000;

export interface SbtMintInput {
  tokenId: string;
  dhEventId: string;
  boundDev: string | null;
  govSeq: number; // the governance 'sbt.mint' entry seq
  govMerkleRoot: string;
}

export interface SbtLedgerResult {
  wired: boolean;
  wormSeq?: number;
  wormHash?: string;
  reason?: string;
}

/** Append the SBT_MINT WORM event to the VVUIVE ledger. Awaited briefly by
 *  the dh.sign take so the response can carry the wormSeq; a ledger failure
 *  is honest (wired:false + reason) and NEVER fatal to the take — the
 *  governance leg has already landed, the ledger leg is retriable by
 *  re-deriving from the governance entry (the token id is deterministic). */
export async function mintSbtOnVvuiveLedger(input: SbtMintInput): Promise<SbtLedgerResult> {
  const details = JSON.stringify({
    tokenId: input.tokenId,
    dhEventId: input.dhEventId,
    boundDev: input.boundDev,
    govSeq: input.govSeq,
    govMerkleRoot: input.govMerkleRoot,
    class: 'DH_RECEIPT',
    soulBound: 'structural — no transfer operation exists in either ledger',
  });
  try {
    const res = await fetch(LEDGER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'PROOFBRIDGE', event: 'SBT_MINT', details }),
      signal: AbortSignal.timeout(LEDGER_TIMEOUT_MS),
    });
    if (!res.ok) return { wired: false, reason: `http-${res.status}` };
    const data = (await res.json()) as { success?: boolean; entry?: { seq?: number; hash?: string }; message?: string };
    if (!data.success || !data.entry?.seq) return { wired: false, reason: data.message ?? 'ledger refused the append' };
    return { wired: true, wormSeq: data.entry.seq, wormHash: data.entry.hash };
  } catch (e) {
    return { wired: false, reason: e instanceof Error ? e.message : 'unknown' };
  }
}
