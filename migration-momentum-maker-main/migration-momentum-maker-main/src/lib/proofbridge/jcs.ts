// src/lib/proofbridge/jcs.ts
// ─────────────────────────────────────────────────────────────────────────────
// JCS — JSON Canonical Signature (E2E Runner Brief · Log 1 Clean Build).
//
// The ledger-enforced regime needs SIGNED takes: the runner signs a payload,
// the control plane re-canonicalizes the SAME payload and verifies the
// Ed25519 signature over the canonical bytes. Two sides, one deterministic
// serialization — that is the whole point of canonicalization.
//
// CANONICALIZATION — RFC 8785 (JCS) SUBSET, honestly labelled:
//   · object keys sorted by UTF-16 code unit order (ECMAScript default sort)
//   · no insignificant whitespace
//   · strings serialized exactly as ECMAScript JSON.stringify (matches
//     RFC 8785 for every string without lone surrogates; lone surrogates are
//     REJECTED here — RFC 8785 errors on them too)
//   · numbers: ONLY safe integers (Number.isSafeInteger) are accepted.
//     RFC 8785 full float rules (ES6 number-to-string, incl. -0) are NOT
//     implemented — governance payloads are integers and ISO strings by
//     construction. A non-integer number THROWS (fail closed) rather than
//     risking a cross-runtime serialization disagreement.
//   · undefined / functions / symbols / BigInt → THROW (not representable)
//
// SIGNATURES — Ed25519 via node:crypto (stdlib — hostile-dependency policy:
// nothing new was installed). Keys persist as base64 DER (SPKI public /
// PKCS8 private). The devID is DERIVED from the public key:
//     dev_<sha256(spki)[:16]>
// so a devID cannot be asserted — it can only be computed from the key that
// signs. No ID = no scope (Log 2) is enforced by the control plane, not here.
// ─────────────────────────────────────────────────────────────────────────────

import {
  createHash,
  generateKeyPairSync,
  sign as nodeSign,
  verify as nodeVerify,
} from 'node:crypto';

// ─── Canonicalization (RFC 8785 subset) ─────────────────────────────────────

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function assertSafeString(s: string): void {
  if (LONE_SURROGATE.test(s)) {
    throw new Error('JCS: string contains a lone surrogate (RFC 8785 errors on these)');
  }
}

function canon(value: unknown, out: string[]): void {
  if (value === null) { out.push('null'); return; }
  if (typeof value === 'boolean') { out.push(value ? 'true' : 'false'); return; }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('JCS: non-finite number rejected');
    if (!Number.isSafeInteger(value)) {
      throw new Error('JCS: non-safe-integer number rejected (payloads are integers by construction)');
    }
    out.push(String(value)); // ES number serialization for safe integers == RFC 8785
    return;
  }
  if (typeof value === 'string') { assertSafeString(value); out.push(JSON.stringify(value)); return; }
  if (Array.isArray(value)) {
    out.push('[');
    for (let i = 0; i < value.length; i++) {
      if (i > 0) out.push(',');
      const v = value[i];
      if (v === undefined) { out.push('null'); continue; } // JSON array hole semantics
      canon(v, out);
    }
    out.push(']');
    return;
  }
  if (typeof value === 'object') {
    out.push('{');
    // Object.keys order is insertion order; RFC 8785 sorts by UTF-16 code
    // units — the default Array#sort comparator on JS strings does exactly
    // that. undefined-valued properties are dropped (JSON semantics).
    const keys = Object.keys(value as Record<string, unknown>)
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .sort();
    for (let i = 0; i < keys.length; i++) {
      if (i > 0) out.push(',');
      assertSafeString(keys[i]);
      out.push(JSON.stringify(keys[i]), ':');
      canon((value as Record<string, unknown>)[keys[i]], out);
    }
    out.push('}');
    return;
  }
  // undefined / symbol / function / bigint
  throw new Error(`JCS: value of type '${typeof value}' is not representable in canonical JSON`);
}

/** RFC 8785-subset canonical JSON (see module header for the exact subset). */
export function canonicalize(value: unknown): string {
  const out: string[] = [];
  canon(value, out);
  return out.join('');
}

// ─── Ed25519 (node:crypto stdlib — no new dependency) ────────────────────────

export interface Ed25519KeyPair {
  publicKey: string; // SPKI, base64 DER
  privateKey: string; // PKCS8, base64 DER
  devId: string;
}

export function devIdFromPublicKey(publicKeySpkiB64: string): string {
  return 'dev_' + createHash('sha256').update(publicKeySpkiB64, 'utf8').digest('hex').slice(0, 16);
}

export function generateEd25519(): Ed25519KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pub = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const priv = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
  return { publicKey: pub, privateKey: priv, devId: devIdFromPublicKey(pub) };
}

function privKey(b64: string) {
  return { key: Buffer.from(b64, 'base64'), format: 'der' as const, type: 'pkcs8' as const };
}
function pubKey(b64: string) {
  return { key: Buffer.from(b64, 'base64'), format: 'der' as const, type: 'spki' as const };
}

/** Sign the JCS-canonical form of `payload` — returns the canonical bytes and
 *  the base64 Ed25519 signature over them. */
export function signJcs(
  privateKeyPkcs8B64: string,
  payload: unknown,
): { jcs: string; signature: string } {
  const jcs = canonicalize(payload);
  const signature = nodeSign(null, Buffer.from(jcs, 'utf8'), privKey(privateKeyPkcs8B64)).toString('base64');
  return { jcs, signature };
}

/** Verify a base64 Ed25519 signature over the RE-CANONICALIZED payload.
 *  Any structural problem (non-canonicalizable payload, bad key, bad sig)
 *  returns false — never throws to the caller. */
export function verifyJcs(
  publicKeySpkiB64: string,
  payload: unknown,
  signatureB64: string,
): boolean {
  try {
    if (typeof publicKeySpkiB64 !== 'string' || typeof signatureB64 !== 'string') return false;
    const jcs = canonicalize(payload);
    return nodeVerify(
      null,
      Buffer.from(jcs, 'utf8'),
      pubKey(publicKeySpkiB64),
      Buffer.from(signatureB64, 'base64'),
    );
  } catch {
    return false; // fail closed — a malformed take is an unverified take
  }
}
