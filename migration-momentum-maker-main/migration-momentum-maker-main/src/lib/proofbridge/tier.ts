// src/lib/proofbridge/tier.ts
// ─────────────────────────────────────────────────────────────────────────────
// POPIA boundary in code (Task 39 — ProofBridge full-chain integration).
//
//   anon       — nothing ever leaves the device-side chain: no anchor, no
//                proof, no off-device retention. Default for EVERY device
//                until a paying/enterprise tier is explicitly assigned.
//   paying     — receipt HASH anchors to the shared ledger (never the row,
//                never the payload), 365-day retention.
//   enterprise — hash anchor + ZK inclusion attestation (stub this round),
//                2555-day retention.
//
// The guard below is deliberately SHALLOW (top-level keys only): it is a
// transit boundary for the receipt payload, not a deep PII scanner. Known
// caveat, accepted by design: a legit read result whose top-level JSON
// happens to carry a key named e.g. `name` will fail CLOSED for retention
// tiers — block first, allow only by redesign.
// ─────────────────────────────────────────────────────────────────────────────

export type Tier = 'anon' | 'paying' | 'enterprise';

export interface TierPolicy {
  anchorsHash: boolean;
  emitsZkProof: boolean;
  retentionDays: number | null; // null = never retained off-device
}

export const TIER_POLICY: Record<Tier, TierPolicy> = {
  anon:       { anchorsHash: false, emitsZkProof: false, retentionDays: null },
  paying:     { anchorsHash: true,  emitsZkProof: false, retentionDays: 365 },
  enterprise: { anchorsHash: true,  emitsZkProof: true,  retentionDays: 2555 },
};

export function shouldAnchor(tier: Tier): boolean {
  return TIER_POLICY[tier].anchorsHash;
}

export function shouldProve(tier: Tier): boolean {
  return TIER_POLICY[tier].emitsZkProof;
}

// POPIA keys that must never cross the receipt boundary for retention tiers.
// Exported (E2E Log 1 brief) so the control plane applies the SAME list to
// governance take payloads — one boundary definition, not two.
export const PII_KEYS = ['email', 'phone', 'name', 'address', 'idNumber', 'accountNumber'];

export function assertNoPII(payload: unknown, tier: Tier): void {
  // anon receipts never anchor and are never retained off-device, so the
  // transit boundary only arms for retention tiers (paying/enterprise).
  if (tier === 'anon') return;
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return;
  for (const k of Object.keys(payload as Record<string, unknown>)) {
    if (PII_KEYS.includes(k)) {
      throw new Error(`POPIA violation: tier '${tier}' attempted to transit PII field '${k}'`);
    }
  }
}
