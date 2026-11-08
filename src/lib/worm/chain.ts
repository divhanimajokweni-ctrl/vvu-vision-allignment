/**
 * VVU WORM Chain — spec-correct cryptographic receipt spine.
 *
 * Implements the canonical VVU/SEARM receipt chain:
 *   - Canonicalisation: RFC 8785 JCS via `canonicalize`
 *   - source_hash(n) = SHA256( DOMAIN_SOURCE + canonicalize(payload_n) )
 *   - chain_hash(n)  = SHA256( DOMAIN_CHAIN + chain_hash(n-1) + source_hash(n) + seq(n) as uint64 BE )
 *   - genesis        = SHA256( DOMAIN_CHAIN + "GENESIS" )
 *   - Signature:     Ed25519 over source_hash
 *   - Anchoring:     RFC 3161 (advisory; not required for integrity)
 *
 * "Assertion ≠ Evidence. We hand you the receipt and the script to verify it
 *  yourself — and the receipt for absence is as important as the receipt for
 *  presence."
 *
 * SERVER-ONLY. Uses node:crypto for Ed25519. Zero network dependencies.
 */

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";
import canonicalize from "canonicalize";

export const DOMAIN_SOURCE = "VVU-SOURCE-v1";
export const DOMAIN_CHAIN = "VVU-CHAIN-v1";

export const GENESIS = createHash("sha256")
  .update(DOMAIN_CHAIN + "GENESIS")
  .digest("hex");

/** The canonical receipt-type vocabulary (Skill 8 — exact strings). */
export const RECEIPT_TYPES = [
  "TELEMETRY",
  "VITALS",
  "TRANSACTION",
  "UPTIME",
  "ASSET_RECEIPT",
  "ABSENCE_RECEIPT",
  "HEARTBEAT",
  "LEAK_RECEIPT",
  "BREAKER_RECEIPT",
  "FRAUD_RECEIPT",
  "WATER_LOSS_RECEIPT",
  "NODE_UNREACHABLE_RECEIPT",
  "RESET_RECEIPT",
  "TSA_ANCHOR",
] as const;
export type ReceiptType = (typeof RECEIPT_TYPES)[number];

/** Mode tags — every value carries one of these. */
export type Mode = "LIVE" | "SIM" | "DEMO";

export interface ChainEntry {
  seq: number;
  type: ReceiptType;
  timestamp: string;
  source: string;
  reason?: string;
  metrics?: Record<string, number>;
  absent_metrics?: string[];
  absent?: string[];
  asset?: string;
  state?: string;
  mode?: Mode;
  [k: string]: unknown;
  source_hash: string;
  chain_hash: string;
  meta?: {
    signature?: string;
    signed_at?: string;
    device_id?: string;
    sim?: boolean;
    demo?: boolean;
    [k: string]: unknown;
  };
}

export interface Chain {
  genesis: string;
  entries: ChainEntry[];
}

export interface Identity {
  publicKey: string; // base64 SPKI DER
  privateKey: string; // base64 PKCS8 DER (server-only; never serialised to client)
  algorithm: "Ed25519";
  deviceId: string;
}

export interface VerifyResult {
  valid: boolean;
  count: number;
  head: string;
  lastAnchor: { seq: number; timestamp: string } | null;
  errors: { seq: number; reason: string; detail: string }[];
  warnings: string[];
}

/* -------------------------------------------------------------------------- */
/* Hashing primitives                                                          */
/* -------------------------------------------------------------------------- */

function seqToBytes(seq: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(seq));
  return buf;
}

function sha256(...parts: Array<string | Buffer>): string {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest("hex");
}

/**
 * Strip the computed/identity fields from an entry to recover the signed payload.
 * The payload is everything EXCEPT source_hash, chain_hash, seq, and meta.
 */
function payloadOf(entry: ChainEntry): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...entry };
  delete payload.source_hash;
  delete payload.chain_hash;
  delete payload.seq;
  delete payload.meta;
  return payload;
}

export function computeSourceHash(entry: ChainEntry): string {
  const canon = canonicalize(payloadOf(entry));
  if (canon == null) throw new Error("canonicalize returned null — payload not JSON-serialisable");
  return sha256(DOMAIN_SOURCE + canon);
}

export function computeChainHash(entry: ChainEntry, prevHash: string): string {
  return sha256(DOMAIN_CHAIN + prevHash + entry.source_hash, seqToBytes(entry.seq));
}

/* -------------------------------------------------------------------------- */
/* Identity (Ed25519)                                                          */
/* -------------------------------------------------------------------------- */

export function generateIdentity(deviceId = "vvu-control-plane"): Identity {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKey: publicKey.export({ format: "der", type: "spki" }).toString("base64"),
    privateKey: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
    algorithm: "Ed25519",
    deviceId,
  };
}

function loadPrivateKey(identity: Identity): KeyObject {
  return createPrivateKey({
    key: Buffer.from(identity.privateKey, "base64"),
    format: "der",
    type: "pkcs8",
  });
}
function loadPublicKey(b64: string): KeyObject {
  return createPublicKey({ key: Buffer.from(b64, "base64"), format: "der", type: "spki" });
}

/* -------------------------------------------------------------------------- */
/* Chain operations                                                            */
/* -------------------------------------------------------------------------- */

export function createChain(): Chain {
  return { genesis: GENESIS, entries: [] };
}

export interface AppendInput {
  type: ReceiptType;
  source: string;
  reason?: string;
  metrics?: Record<string, number>;
  absent_metrics?: string[];
  absent?: string[];
  asset?: string;
  state?: string;
  mode?: Mode;
  timestamp?: string;
  deviceId?: string;
  extra?: Record<string, unknown>;
}

/**
 * Append a signed entry to the chain. Mutates `chain` and returns the new entry.
 */
export function appendEntry(chain: Chain, identity: Identity, input: AppendInput): ChainEntry {
  const seq = chain.entries.length;
  const timestamp = input.timestamp ?? new Date().toISOString();

  const entry = {
    seq,
    type: input.type,
    timestamp,
    source: input.source,
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.metrics ? { metrics: input.metrics } : {}),
    ...(input.absent_metrics ? { absent_metrics: input.absent_metrics } : {}),
    ...(input.absent ? { absent: input.absent } : {}),
    ...(input.asset ? { asset: input.asset } : {}),
    ...(input.state ? { state: input.state } : {}),
    ...(input.mode ? { mode: input.mode } : {}),
    ...(input.extra ?? {}),
    source_hash: "",
    chain_hash: "",
  } as ChainEntry;

  entry.source_hash = computeSourceHash(entry);
  const prev = chain.entries.at(-1)?.chain_hash ?? GENESIS;
  entry.chain_hash = computeChainHash(entry, prev);

  const sig = sign(null, Buffer.from(entry.source_hash, "hex"), loadPrivateKey(identity));
  entry.meta = {
    signature: sig.toString("base64"),
    signed_at: new Date().toISOString(),
    device_id: input.deviceId ?? identity.deviceId,
    ...(input.mode === "SIM" ? { sim: true } : {}),
    ...(input.mode === "DEMO" ? { demo: true } : {}),
  };

  chain.entries.push(entry);
  return entry;
}

/* -------------------------------------------------------------------------- */
/* Verifier (the canonical reference)                                          */
/* -------------------------------------------------------------------------- */

const FAIL_MODES = {
  GENESIS_MISMATCH: "Genesis hash does not match VVU-CHAIN-v1 domain",
  SEQ_GAP: "Sequence continuity broken — entry deleted or reordered",
  SOURCE_HASH_MISMATCH: "Payload was altered after signing",
  CHAIN_LINK_BROKEN: "Foreign entry spliced in — link does not match predecessor",
  SIG_INVALID: "Ed25519 signature does not verify against device key",
  ANCHOR_HASH_MISMATCH: "TSA anchor does not point at the chain head",
} as const;

export function verifyChain(chain: Chain, publicKeyB64?: string): VerifyResult {
  const errors: VerifyResult["errors"] = [];
  const warnings: string[] = [];

  if (chain.genesis !== GENESIS) {
    errors.push({ seq: 0, reason: "GENESIS_MISMATCH", detail: FAIL_MODES.GENESIS_MISMATCH });
    return { valid: false, count: 0, head: chain.genesis, lastAnchor: null, errors, warnings };
  }

  const publicKey = publicKeyB64 ? loadPublicKey(publicKeyB64) : undefined;
  let expectedPrev = GENESIS;
  let expectedSeq = 0;
  let lastAnchor: VerifyResult["lastAnchor"] = null;

  for (const entry of chain.entries) {
    if (entry.seq !== expectedSeq) {
      errors.push({
        seq: entry.seq,
        reason: "SEQ_GAP",
        detail: `Expected seq ${expectedSeq}, got ${entry.seq}`,
      });
      return { valid: false, count: expectedSeq, head: expectedPrev, lastAnchor, errors, warnings };
    }

    const recomputedSource = computeSourceHash(entry);
    if (recomputedSource !== entry.source_hash) {
      errors.push({
        seq: entry.seq,
        reason: "SOURCE_HASH_MISMATCH",
        detail: FAIL_MODES.SOURCE_HASH_MISMATCH,
      });
      return { valid: false, count: expectedSeq, head: expectedPrev, lastAnchor, errors, warnings };
    }

    const recomputedChain = computeChainHash(entry, expectedPrev);
    if (recomputedChain !== entry.chain_hash) {
      errors.push({
        seq: entry.seq,
        reason: "CHAIN_LINK_BROKEN",
        detail: FAIL_MODES.CHAIN_LINK_BROKEN,
      });
      return { valid: false, count: expectedSeq, head: expectedPrev, lastAnchor, errors, warnings };
    }

    if (publicKey && entry.meta?.signature) {
      const ok = verify(
        null,
        Buffer.from(entry.source_hash, "hex"),
        publicKey,
        Buffer.from(entry.meta.signature, "base64")
      );
      if (!ok) {
        errors.push({ seq: entry.seq, reason: "SIG_INVALID", detail: FAIL_MODES.SIG_INVALID });
        return { valid: false, count: expectedSeq, head: expectedPrev, lastAnchor, errors, warnings };
      }
    }

    if (entry.type === "TSA_ANCHOR") {
      const anchored = (entry as unknown as { anchored_chain_hash?: string }).anchored_chain_hash;
      if (anchored !== expectedPrev) {
        errors.push({
          seq: entry.seq,
          reason: "ANCHOR_HASH_MISMATCH",
          detail: FAIL_MODES.ANCHOR_HASH_MISMATCH,
        });
        return { valid: false, count: expectedSeq, head: expectedPrev, lastAnchor, errors, warnings };
      }
      lastAnchor = { seq: entry.seq, timestamp: entry.timestamp };
    }

    if (expectedSeq > 0) {
      const prev = chain.entries[expectedSeq - 1];
      const gap = new Date(entry.timestamp).getTime() - new Date(prev.timestamp).getTime();
      if (gap > 5 * 60 * 1000) {
        warnings.push(
          `⚠ GAP: ${Math.round(gap / 60000)} min between seq ${prev.seq} and ${entry.seq}`
        );
      }
    }

    expectedPrev = entry.chain_hash;
    expectedSeq++;
  }

  if (lastAnchor) {
    const age = Date.now() - new Date(lastAnchor.timestamp).getTime();
    if (age > 48 * 3600 * 1000) {
      warnings.push(`⚠ STALE ANCHOR: last TSA anchor is ${Math.round(age / 3600000)}h old`);
    }
  } else {
    warnings.push("⚠ NO TSA ANCHOR: chain is not externally anchored (advisory)");
  }

  return {
    valid: errors.length === 0,
    count: expectedSeq,
    head: expectedPrev,
    lastAnchor,
    errors,
    warnings,
  };
}

/* -------------------------------------------------------------------------- */
/* Public-facing serialisation (no private key ever leaves the server)         */
/* -------------------------------------------------------------------------- */

export function publicIdentity(identity: Identity) {
  return { publicKey: identity.publicKey, algorithm: identity.algorithm, deviceId: identity.deviceId };
}

/** A safe, client-ready view of a chain entry (drops nothing — entries are public). */
export function entryToPublic(entry: ChainEntry) {
  return entry;
}
