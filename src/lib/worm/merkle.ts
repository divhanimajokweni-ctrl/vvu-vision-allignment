/**
 * Global Merkle Root Builder.
 *
 * The WORM chain is verifiable on its own (every entry links to the previous
 * one via chain_hash). The Merkle root is an *additional* convenience: it
 * collapses the last 6 hours of entries into a single 32-byte hash that can
 * be anchored to an L2 blockchain (a public, immutable, third-party
 * witness) every 6 hours.
 *
 * Leaf node = source_hash of an entry (already SHA-256).
 * Internal node = SHA-256(left_hex || right_hex) (concatenation of hex
 *   strings, NOT of the raw bytes — this matches the convention used by the
 *   on-chain verifier contract).
 *
 * The tree is built bottom-up. If the number of leaves is odd, the last
 * leaf is promoted unchanged (or, equivalently, duplicated — we duplicate
 * so that every internal node has exactly two children; the choice is
 * documented here so the verifier can reproduce it).
 *
 * After anchoring, the tree is discarded. Only the root is saved. The cron
 * writes worm-anchors/<date>-<hour>.json.
 *
 * Anchoring itself is a [VERIFY] item — `anchorToBlockchain()` logs the
 * anchor intent to the WORM chain (ANCHOR_GLOBAL_MERKLE_ROOT event) but
 * does NOT fabricate a transaction hash. The real L2 anchor lives in a
 * separate signer process that has the wallet key.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const PROJECT_ROOT = process.env.VVU_PROJECT_ROOT
  ? resolve(process.env.VVU_PROJECT_ROOT)
  : resolve(process.cwd());
const LEDGER_SCRIPT = resolve(PROJECT_ROOT, "ledger/event_ledger.py");

/* -------------------------------------------------------------------------- */
/* Hashing                                                                    */
/* -------------------------------------------------------------------------- */

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Internal node: SHA-256 of the concatenation of the two child hex strings.
 * This is the convention used by the on-chain verifier contract.
 */
function hashPair(left: string, right: string): string {
  return sha256Hex(left + right);
}

/* -------------------------------------------------------------------------- */
/* Merkle tree                                                                */
/* -------------------------------------------------------------------------- */

export interface MerkleEntry {
  source_hash: string;
}

export interface MerkleBuildResult {
  root: string;
  tree: string[][];
}

/**
 * Build a Merkle tree from a list of entries. Returns the root and the full
 * tree (levels bottom-up; tree[0] is the leaves, tree[tree.length-1] is
 * [root]).
 *
 * Empty input: root = SHA-256("") (a well-known constant; the verifier
 * treats an empty anchor as "no events in window, root is empty marker").
 */
export function buildMerkleRoot(entries: MerkleEntry[]): MerkleBuildResult {
  if (entries.length === 0) {
    const emptyRoot = sha256Hex("");
    return { root: emptyRoot, tree: [[emptyRoot]] };
  }

  // Leaves: the source_hashes themselves (they are already SHA-256).
  let level = entries.map((e) => e.source_hash);
  const tree: string[][] = [level.slice()];

  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i]; // duplicate last
      next.push(hashPair(left, right));
    }
    tree.push(next.slice());
    level = next;
  }

  return { root: level[0], tree };
}

/**
 * Read all WORM events from the last `sinceHours` hours via the Python
 * ledger bridge, extract their source_hashes, and build the Merkle root.
 *
 * Returns the root, the entry count, and the full tree (the caller may
 * discard the tree after anchoring).
 */
export async function buildMerkleRootFromLedger(
  sinceHours = 6
): Promise<{ root: string; tree: string[][]; entryCount: number }> {
  let stdout: string;
  try {
    stdout = execFileSync(
      "python3",
      [LEDGER_SCRIPT, "query", "--since", `${sinceHours}h`],
      { encoding: "utf8", timeout: 10_000, cwd: PROJECT_ROOT, maxBuffer: 64 * 1024 * 1024 }
    );
  } catch (err) {
    throw new Error(`Merkle build failed to query ledger: ${(err as Error).message}`);
  }

  let parsed: { ok?: boolean; events?: { source_hash?: string }[]; error?: string };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`Merkle build got non-JSON from ledger: ${stdout.slice(0, 200)}`);
  }
  if (!parsed.ok) {
    throw new Error(`Ledger query failed: ${parsed.error ?? "unknown"}`);
  }

  const entries = (parsed.events ?? [])
    .filter((e) => typeof e.source_hash === "string" && e.source_hash.length === 64)
    .map((e) => ({ source_hash: e.source_hash as string }));

  const { root, tree } = buildMerkleRoot(entries);
  return { root, tree, entryCount: entries.length };
}

/* -------------------------------------------------------------------------- */
/* Anchor (stub — [VERIFY] item)                                              */
/* -------------------------------------------------------------------------- */

export interface AnchorResult {
  /** The root hash that was anchored. */
  rootHash: string;
  /** Anchoring intent log — NOT a real transaction hash. */
  intentLoggedAt: string;
  /**
   * A [VERIFY] marker. The real L2 anchoring is performed by a separate
   * signer process with the wallet key. This stub records the intent only.
   */
  status: "ANCHOR_INTENT_LOGGED" | "ANCHOR_FAILED";
  reason?: string;
}

/**
 * Anchor a Merkle root to the L2 blockchain.
 *
 * THIS IS A STUB. The actual anchoring is performed by a separate signer
 * process that has the wallet key and is therefore NOT part of this
 * repository's public code. The stub logs the anchor intent to the WORM
 * chain (ANCHOR_GLOBAL_MERKLE_ROOT event) so an auditor can later
 * correlate the intent log with the on-chain transaction.
 *
 * We never fabricate a transaction hash. If the signer is unreachable, the
 * intent is still recorded; the cron will retry on the next run.
 */
export async function anchorToBlockchain(root: string): Promise<AnchorResult> {
  const intentLoggedAt = new Date().toISOString();
  const payload = JSON.stringify({
    tool: "anchor_global_merkle_root",
    args: { rootHashPrefix: root.slice(0, 16) },
    result_summary: `ANCHOR_INTENT_LOGGED root=${root.slice(0, 16)} at=${intentLoggedAt}`,
  });

  try {
    execFileSync(
      "python3",
      [LEDGER_SCRIPT, "append", "--type", "ANCHOR_GLOBAL_MERKLE_ROOT", "--source", "admin-cubot", "--payload", payload],
      { encoding: "utf8", timeout: 5000, cwd: PROJECT_ROOT }
    );
    return { rootHash: root, intentLoggedAt, status: "ANCHOR_INTENT_LOGGED" };
  } catch (err) {
    // The intent could not be logged — this is a fail-closed condition.
    // The cron operator must investigate.
    return {
      rootHash: root,
      intentLoggedAt,
      status: "ANCHOR_FAILED",
      reason: (err as Error).message,
    };
  }
}
