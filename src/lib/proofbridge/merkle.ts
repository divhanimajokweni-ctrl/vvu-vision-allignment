// src/lib/proofbridge/merkle.ts
// ─────────────────────────────────────────────────────────────────────────────
// MERKLE ACCUMULATOR over the receipt chain (Task 40 — §3 Receipt Anchor).
//
// The hybrid anchor direction, implemented honestly:
//
//   LOCAL  : the append-only SHA-256 hash chain (already operational since
//            Task 36 — receipts.json, verified from genesis on every load).
//   EXTERNAL: PERIODIC anchoring of the MERKLE ROOT of the whole chain to an
//            external relay (src/app/api/anchor). The relay sees the ROOT
//            HASH ONLY — never rows, never payloads, never PII (POPIA §7).
//
// Math (RFC 6962 tree-hash style, the CT-log standard):
//   · leaves      = receipt hashes (already sha256 outputs — used directly)
//   · odd level   = last node duplicated (no domain separation needed since
//                   every node is exactly 32 bytes of sha256 output)
//   · root        = single remaining node; empty chain → sha256('') identity
//
// This module is PURE (no I/O) so the same code runs in:
//   · mini-services/vault-bridge (:3004) + vvu-field-onboard (:3005)
//   · tests/go-life runner (independent recomputation — §11 no self-cert:
//     the runner recomputes the root from the raw receipts JSON with the
//     same pure function and cross-checks the service's claim)
//   · any third party holding the receipts.json file (independent audit)
//
// ⚠ EXTERNAL TARGET STATUS: the relay endpoint (/api/anchor) is a STUB —
// it mints `stub:<hash16>` txRefs and does NOT write to a real chain
// (Base/Arbitrum L2 / Trillian CT log swap is the operator decision).
// Merkle math here is REAL and independently verifiable; the external
// leg is honestly labelled until that swap happens.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';

export const MERKLE_EMPTY_ROOT = createHash('sha256').update('').digest('hex');

function h(a: string, b: string): string {
  return createHash('sha256').update(Buffer.concat([Buffer.from(a, 'hex'), Buffer.from(b, 'hex')])).digest('hex');
}

export function isHex64(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
}

/** Merkle root over an ordered list of receipt hashes (RFC-6962 tree hash). */
export function merkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return MERKLE_EMPTY_ROOT;
  let level = hashes.slice();
  while (level.length > 1) {
    if (level.length % 2 === 1) level.push(level[level.length - 1]); // duplicate last (odd)
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(h(level[i], level[i + 1]));
    level = next;
  }
  return level[0];
}

/** Inclusion proof (audit path) for leaf index i. Each sibling carries its
 *  position: left=true means the sibling sits LEFT of the current node (the
 *  current node is the right child) — sha256 concat is order-sensitive. */
export interface MerkleSibling { hash: string; left: boolean }

export function merkleProof(hashes: string[], index: number): { root: string; siblings: MerkleSibling[] } | null {
  if (index < 0 || index >= hashes.length) return null;
  const siblings: MerkleSibling[] = [];
  let level = hashes.slice();
  let i = index;
  while (level.length > 1) {
    if (level.length % 2 === 1) level.push(level[level.length - 1]);
    const isRightChild = i % 2 === 1;
    const sib = isRightChild ? level[i - 1] : level[i + 1];
    siblings.push({ hash: sib, left: isRightChild });
    const next: string[] = [];
    for (let k = 0; k < level.length; k += 2) next.push(h(level[k], level[k + 1]));
    level = next;
    i = Math.floor(i / 2);
  }
  return { root: level[0], siblings };
}

/** Verify an inclusion proof — the independent-auditor entry point. */
export function verifyMerkleProof(leaf: string, siblings: MerkleSibling[], root: string): boolean {
  if (!isHex64(leaf) || !isHex64(root)) return false;
  let cur = leaf;
  for (const s of siblings) {
    if (!isHex64(s.hash)) return false;
    cur = s.left ? h(s.hash, cur) : h(cur, s.hash);
  }
  return cur === root;
}
