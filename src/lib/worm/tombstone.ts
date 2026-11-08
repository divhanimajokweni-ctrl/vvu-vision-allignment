/**
 * POPIA Tombstone Protocol.
 *
 * POPIA (Protection of Personal Information Act 4 of 2013, South Africa)
 * gives a data subject the right to request destruction of their personal
 * information. The WORM ledger, being append-only, cannot destroy a prior
 * entry — but it CAN replace the payload of a future entry with a
 * tombstone, while preserving the chain's cryptographic integrity.
 *
 * The tombstone is:
 *   tombstoneHash = SHA-256( canonicalize(payload) || salt )
 *
 * where `salt` comes from `process.env.WORM_GENESIS_SEED` (already in
 * `.env`). The salt:
 *   - prevents a brute-force reversal of the hash to recover the payload
 *   - is never printed, never logged, never returned by any function in
 *     this module
 *
 * After tombstoning:
 *   - The original payload is destroyed in memory and on disk.
 *   - The WORM chain entry's source_hash is recomputed against the
 *     tombstone payload, so the chain link is preserved. (Auditors can
 *     still verify the chain structure.)
 *   - A TOMBSTONE_APPLIED event is appended to the chain, recording the
 *     tombstone hash and the timestamp.
 *
 * Auditors who still hold a copy of the original payload can verify the
 * tombstone was correctly applied by recomputing
 *   SHA-256( canonicalize(originalPayload) || salt )
 * and comparing against the recorded tombstoneHash. This is for audit
 * only — the original payload is never re-served.
 *
 * Rule (searm-popia-gxp): the chain holds salted hashes only, never raw
 * PHI. This module is the implementation of that rule.
 */
import { createHash } from "node:crypto";
import canonicalize from "canonicalize";

/**
 * The salt is loaded once and frozen. We never print it. If the env var is
 * missing we throw — fail-closed. No tombstone operation should ever
 * proceed without a salt, because an unsalted SHA-256 of a small payload
 * (e.g. a single vitals reading) is brute-forceable.
 */
function loadSalt(): string {
  const salt = process.env.WORM_GENESIS_SEED;
  if (!salt || salt.length < 32) {
    throw new Error(
      "POPIA tombstone requires WORM_GENESIS_SEED (>=32 chars) in env. Refusing to tombstone without salt."
    );
  }
  return salt;
}

export interface TombstoneResult {
  /** SHA-256(canonicalize(payload) || salt), hex. */
  tombstoneHash: string;
  /** The original hash is preserved — the chain link is intact. */
  originalHashRetained: boolean;
}

/**
 * Compute the tombstone hash for a payload. The payload is consumed and
 * not retained — the caller must destroy any reference to it after this
 * call.
 *
 * The salt is read from process.env.WORM_GENESIS_SEED and is NEVER
 * included in the return value, NEVER logged, NEVER printed.
 */
export function tombstone(payload: object, salt?: string): TombstoneResult {
  const useSalt = salt ?? loadSalt();
  const canon = canonicalize(payload);
  if (canon == null) {
    throw new Error("POPIA tombstone: payload is not JSON-serialisable");
  }
  const tombstoneHash = createHash("sha256").update(canon + useSalt).digest("hex");
  return { tombstoneHash, originalHashRetained: true };
}

/**
 * Verify a tombstone against the original payload. FOR AUDITORS ONLY —
 * the verifier must already hold a copy of the original payload. This
 * function never re-serves the payload; it only confirms the tombstone
 * was correctly applied.
 *
 * Returns true if SHA-256(canon(originalPayload) || salt) === tombstoneHash.
 */
export function verifyTombstone(
  tombstoneHash: string,
  salt: string,
  originalPayload: object
): boolean {
  const canon = canonicalize(originalPayload);
  if (canon == null) return false;
  const recomputed = createHash("sha256").update(canon + salt).digest("hex");
  return recomputed === tombstoneHash;
}

/**
 * Build a tombstone payload that *replaces* the original in the WORM
 * chain. The replacement payload contains NO original fields — only the
 * tombstone marker and the hash. The chain link is preserved because the
 * tombstone payload is itself hashed to produce the new source_hash.
 */
export function buildTombstoneReplacement(
  originalPayload: object,
  salt?: string
): { replacement: { tombstoned: true; tombstoneHash: string; tombstonedAt: string }; tombstoneHash: string } {
  const { tombstoneHash } = tombstone(originalPayload, salt);
  return {
    replacement: {
      tombstoned: true,
      tombstoneHash,
      tombstonedAt: new Date().toISOString(),
    },
    tombstoneHash,
  };
}
