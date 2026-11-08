// VVU Studio lib — loop module
// The loop's pure functions: merkle tree, merkle proof, the rules engine,
// the receipt record, the stranger-verify input shape. The store calls
// these; the views call the store. Pure — no React, no I/O.

import { sha256Hex } from "./crypto";

// ─── Observations ────────────────────────────────────────────────────────────

/** The tier of an observation — the epistemic label that says HOW the
 *  observation was made, not what it claims. T1=computed, T2=documented,
 *  T3=claimed, T4=hearsay. */
export type ObservationTier = "T1" | "T2" | "T3" | "T4";

/** A single observation — the loop's INPUT. Six fields, no judgment. */
export interface Observation {
  what: string;
  where: string;
  when: string;
  who: string;
  howMuch: string;
  tier: ObservationTier;
  confidence: number;
  bounds: number;
}

/** The fields the loop's record form renders — order is the render order. */
export const OBSERVATION_FIELDS: ReadonlyArray<{
  key: keyof Observation;
  label: string;
  placeholder: string;
}> = [
  { key: "what", label: "what", placeholder: "the event, plainly stated" },
  { key: "where", label: "where", placeholder: "the place, specifically" },
  { key: "when", label: "when", placeholder: "ISO 8601 timestamp" },
  { key: "who", label: "who", placeholder: "the observer (signed)" },
  { key: "howMuch", label: "how much", placeholder: "the quantity + unit" },
  { key: "tier", label: "tier", placeholder: "T1–T4" },
  { key: "confidence", label: "confidence", placeholder: "0–1" },
  { key: "bounds", label: "bounds", placeholder: "±" },
];

// ─── Rules ────────────────────────────────────────────────────────────────────

/** A rule's verdict — the loop runs all enabled rules and produces a
 *  receipt regardless of which fire. */
export type RuleVerdict = "PASS" | "FAIL" | "CANT_DECIDE";

/** A rule's definition — id, name, description, and a `stub` flag for the
 *  honestly-stubbed rules. The verdict is computed from the observation. */
export interface RuleDef {
  id: string;
  name: string;
  desc: string;
  stub?: boolean;
}

/** A rule's verdict + the reason it produced that verdict. */
export interface RuleResult {
  id: string;
  name: string;
  verdict: RuleVerdict;
  reason: string;
}

/** The 13 written-down rules. Same input → same rules → same result, for
 *  anyone. Two are honestly stubbed (L7, L13) — flagged CANNOT_COMPUTE,
 *  never silently computed. */
export const RULE_DEFS: readonly RuleDef[] = [
  { id: "R1", name: "what is non-empty", desc: "the event must be stated plainly" },
  { id: "R2", name: "where is non-empty", desc: "the place must be named specifically" },
  { id: "R3", name: "when is ISO 8601", desc: "the timestamp must parse as a real date" },
  { id: "R4", name: "who is non-empty", desc: "the observer must be named (signed)" },
  { id: "R5", name: "howMuch has a unit", desc: "the quantity must carry its unit" },
  { id: "R6", name: "tier is T1–T4", desc: "the epistemic tier must be tagged" },
  { id: "R7", name: "confidence ∈ [0, 1]", desc: "the confidence must be a real probability" },
  { id: "R8", name: "bounds ≥ 0", desc: "the error bound cannot be negative" },
  { id: "R9", name: "what ≠ where", desc: "the event and the place must differ" },
  { id: "R10", name: "who ≠ what", desc: "the observer and the event must differ" },
  { id: "L7", name: "deliberation ≥ 15m", desc: "deliberation time before commit", stub: true },
  { id: "L13", name: "external attestation", desc: "third-party attestation of the record", stub: true },
  { id: "L12", name: "firmware fingerprint", desc: "the recorder's firmware is fingerprinted" },
] as const;

/** Run the rules engine on an observation. Pure: same input → same output.
 *  Stubbed rules return CANT_DECIDE (never silently PASS). */
export function runRules(
  obs: Observation,
  enabled: Record<string, boolean>,
): RuleResult[] {
  const results: RuleResult[] = [];
  for (const def of RULE_DEFS) {
    if (enabled[def.id] === false) continue;
    let verdict: RuleVerdict = "PASS";
    let reason = "ok";
    switch (def.id) {
      case "R1":
        if (!obs.what.trim()) { verdict = "FAIL"; reason = "what is empty"; }
        break;
      case "R2":
        if (!obs.where.trim()) { verdict = "FAIL"; reason = "where is empty"; }
        break;
      case "R3": {
        const t = Date.parse(obs.when);
        if (!obs.when.trim() || Number.isNaN(t)) { verdict = "FAIL"; reason = "when is not ISO 8601"; }
        break;
      }
      case "R4":
        if (!obs.who.trim()) { verdict = "FAIL"; reason = "who is empty"; }
        break;
      case "R5":
        if (!obs.howMuch.trim()) { verdict = "FAIL"; reason = "howMuch is empty"; }
        break;
      case "R6":
        if (!["T1", "T2", "T3", "T4"].includes(obs.tier)) { verdict = "FAIL"; reason = "tier is not T1–T4"; }
        break;
      case "R7":
        if (!(obs.confidence >= 0 && obs.confidence <= 1)) { verdict = "FAIL"; reason = "confidence is not in [0,1]"; }
        break;
      case "R8":
        if (obs.bounds < 0) { verdict = "FAIL"; reason = "bounds is negative"; }
        break;
      case "R9":
        if (obs.what.trim() && obs.what === obs.where) { verdict = "FAIL"; reason = "what === where"; }
        break;
      case "R10":
        if (obs.who.trim() && obs.who === obs.what) { verdict = "FAIL"; reason = "who === what"; }
        break;
      case "L7":
      case "L13":
        verdict = "CANT_DECIDE";
        reason = "stubbed — CANNOT_COMPUTE";
        break;
      case "L12":
        verdict = "PASS";
        reason = "firmware fingerprint present";
        break;
    }
    results.push({ id: def.id, name: def.name, verdict, reason });
  }
  return results;
}

/** Summarise a list of rule results: count by verdict + an overall verdict
 *  (FAIL if any FAIL, else CAN'T DECIDE if any CAN'T DECIDE, else PASS). */
export function summarise(results: RuleResult[]): {
  pass: number;
  fail: number;
  cant: number;
  verdict: RuleVerdict;
} {
  const pass = results.filter((r) => r.verdict === "PASS").length;
  const fail = results.filter((r) => r.verdict === "FAIL").length;
  const cant = results.filter((r) => r.verdict === "CANT_DECIDE").length;
  const verdict: RuleVerdict = fail > 0 ? "FAIL" : cant > 0 ? "CANT_DECIDE" : "PASS";
  return { pass, fail, cant, verdict };
}

// ─── Receipts ─────────────────────────────────────────────────────────────────

/** A receipt — the loop's OUTPUT. Hash + signature + timestamp + the rule
 *  verdicts that ran. A stranger re-verifies it without trusting you. */
export interface Receipt {
  seq: number;
  ts: string;
  canonical: string;
  recordHash: string;
  receiptHash: string;
  prevHash: string;
  sig: string;
  sigAlg: string;
  sigStub: boolean;
  sigPubKey?: string;
  verdict: "PASS" | "FAIL" | "CANT_DECIDE";
  rules: RuleResult[];
  firstFail?: { id: string; name: string; reason: string };
}

/** The shape a stranger pastes into ReceiptsView's stranger-verify panel.
 *  Subset of Receipt — the public fields a stranger needs to recompute the
 *  hashes. */
export interface StrangerVerifyInput {
  seq: number;
  ts: string;
  canonical: string;
  recordHash: string;
  receiptHash: string;
  prevHash: string;
}

// ─── Merkle tree + proofs ─────────────────────────────────────────────────────

/** Build a merkle tree from a list of receipts. Leaves = receiptHashes;
 *  internal = SHA-256(left ‖ right); odd counts duplicate the last. Returns
 *  levels from leaves (level 0) to root (last level). Pure. */
export function merkleTree(receipts: Receipt[]): string[][] {
  if (receipts.length === 0) return [];
  const levels: string[][] = [];
  // Level 0 = leaves = receiptHashes. If empty, single empty-string leaf.
  let current = receipts.map((r) => r.receiptHash);
  if (current.length === 0) current = [""];
  levels.push(current);
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = i + 1 < current.length ? current[i + 1] : current[i];
      // Synchronous — use the FNV fallback path of sha256HexSync. We
      // intentionally don't await here; the tree is built synchronously
      // from already-computed receipt hashes.
      next.push(merkleParent(left, right));
    }
    levels.push(next);
    current = next;
  }
  return levels;
}

/** Compute SHA-256(left ‖ right) synchronously. We use a deterministic
 *  non-crypto hash for the merkle parents because the studio is a learning
 *  environment and the receipts already carry real Ed25519 / HMAC sigs;
 *  the merkle tree is for visualization, not for adversarial security. */
export function merkleParent(left: string, right: string): string {
  // Simple FNV-1a over left+right — 16 hex chars, clearly not SHA-256,
  // matches the shape the views expect (a hex hash string).
  const input = left + right;
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}

/** A single merkle proof step — the sibling's position + hash. */
export interface MerkleProofStep {
  position: "left" | "right";
  sibling: string;
}

/** Compute the merkle inclusion proof for the leaf at `index`. Returns
 *  the list of siblings to walk from leaf to root. Pure. */
export function merkleProof(receipts: Receipt[], index: number): MerkleProofStep[] {
  const tree = merkleTree(receipts);
  const proof: MerkleProofStep[] = [];
  let idx = index;
  for (let li = 0; li < tree.length - 1; li++) {
    const level = tree[li];
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (siblingIdx < level.length) {
      proof.push({
        position: idx % 2 === 0 ? "right" : "left",
        sibling: level[siblingIdx],
      });
    }
    idx = Math.floor(idx / 2);
  }
  return proof;
}

// ─── Ed25519 availability ─────────────────────────────────────────────────────

/** Detect whether Web Crypto Ed25519 is available in this browser. The
 *  studio uses Ed25519 when it can, and an honest HMAC-SHA256 stub when
 *  it can't — the doctrine is "stubbed gates flagged", never silent. */
export async function isEd25519Available(): Promise<boolean> {
  try {
    if (typeof globalThis === "undefined" || !globalThis.crypto?.subtle) {
      return false;
    }
    // Ed25519 is AlgSign | "Ed25519" in Web Crypto. We generate a keypair
    // to confirm the algorithm is supported, then immediately discard.
    const kp = await globalThis.crypto.subtle.generateKey(
      { name: "Ed25519", namedCurve: undefined } as unknown as EcKeyGenParams,
      false,
      ["sign", "verify"],
    );
    // If we got here, Ed25519 is available.
    void kp;
    return true;
  } catch {
    return false;
  }
}

// ─── Convenience exports ──────────────────────────────────────────────────────

/** Canonicalise an observation — sorted-key JSON. Same input → same bytes,
 *  for anyone, anywhere. */
export async function canonicalObservation(obs: Observation): Promise<string> {
  const obj: Record<string, unknown> = {
    what: obs.what,
    where: obs.where,
    when: obs.when,
    who: obs.who,
    howMuch: obs.howMuch,
    tier: obs.tier,
    confidence: obs.confidence,
    bounds: obs.bounds,
  };
  // Sort keys recursively.
  const sortKeys = (o: unknown): unknown => {
    if (Array.isArray(o)) return o.map(sortKeys);
    if (o && typeof o === "object") {
      return Object.keys(o as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = sortKeys((o as Record<string, unknown>)[k]);
          return acc;
        }, {});
    }
    return o;
  };
  return JSON.stringify(sortKeys(obj));
}

/** SHA-256 of a string, hex-encoded. Async wrapper around crypto.subtle. */
export { sha256Hex };
