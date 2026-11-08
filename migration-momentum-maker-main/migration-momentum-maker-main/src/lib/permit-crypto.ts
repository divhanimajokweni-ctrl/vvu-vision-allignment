// src/lib/permit-crypto.ts
// ─────────────────────────────────────────────────────────────────────────────
// PERMIT CRYPTOGRAPHY — real Ed25519 signing/verification over canonical
// payloads, via node:crypto (server-only boundary).
//
//   · SIGN   : sign(null, canonicalPermitPayload(payload), privateKey)
//              → base64url. Ed25519 signs the exact message bytes.
//   · VERIFY : reconstruct the canonical payload (minus signature/algorithm),
//              verify(null, message, publicKey, signature) against the
//              ORIGINAL message — property order can never change the bytes.
//   · KEYS   : Ed25519 keypair from env (PEM or single-line base64 of a PEM).
//              The verifier PINS the accepted key id — a permit signed under
//              any other key id is rejected before the signature is even
//              checked (accepting a request-supplied key would defeat the
//              trust model). Key rotation = new key id; old permits fail
//              PERMIT_KEY_ID_MISMATCH, by design.
//   · PROD   : replace env-held private keys with a KMS/HSM-backed signer
//              before CONTROLLED_BENCH. The interface is already shaped for
//              it (loadPermitKeyring is the only place that touches PEMs).
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  type KeyObject,
} from 'node:crypto';

import {
  canonicalPermitPayload,
  type ExecutionPermit,
  type PermitPayload,
  type PermitVerifyResult,
} from './governance-protocol';

export interface PermitKeyring {
  keyId: string;
  privateKey: KeyObject;
  publicKey: KeyObject;
}

/** Accept a full PEM or a single-line base64 of a PEM (the .env-friendly
 *  form — dotenv treats literal newlines as fragile). */
function normalizePem(raw: string, label: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes('\n')) return trimmed;
  try {
    return Buffer.from(trimmed, 'base64').toString('utf8');
  } catch {
    throw new Error(`GOVERNANCE_KEY_MALFORMED:${label}`);
  }
}

/** Stable key id from the public key — sha256(SPKI DER), first 16 hex. */
export function fingerprintKeyId(publicKey: KeyObject): string {
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return `ed25519-${createHash('sha256').update(der).digest('hex').slice(0, 16)}`;
}

/** Generate a fresh keypair (scripts/governance-keys.ts and the test suite). */
export function generatePermitKeyring(): PermitKeyring {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return { keyId: fingerprintKeyId(publicKey), privateKey, publicKey };
}

/**
 * Load the deployment keyring from GOVERNANCE_PRIVATE_KEY_PEM /
 * GOVERNANCE_PUBLIC_KEY_PEM / GOVERNANCE_KEY_ID. FAILS CLOSED when any of
 * the three is missing — a misconfigured deployment must never issue permits.
 */
export function loadPermitKeyring(): PermitKeyring {
  const privateKeyPem = process.env.GOVERNANCE_PRIVATE_KEY_PEM;
  const publicKeyPem = process.env.GOVERNANCE_PUBLIC_KEY_PEM;
  const keyId = process.env.GOVERNANCE_KEY_ID;

  if (!privateKeyPem || !publicKeyPem || !keyId) {
    throw new Error('GOVERNANCE_SIGNING_KEY_NOT_CONFIGURED');
  }

  let privateKey: KeyObject;
  let publicKey: KeyObject;
  try {
    privateKey = createPrivateKey(normalizePem(privateKeyPem, 'PRIVATE'));
    publicKey = createPublicKey(normalizePem(publicKeyPem, 'PUBLIC'));
  } catch (error) {
    throw new Error(`GOVERNANCE_SIGNING_KEY_NOT_CONFIGURED:${(error as Error).message}`);
  }

  if (privateKey.asymmetricKeyType !== 'ed25519' || publicKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('GOVERNANCE_SIGNING_KEY_NOT_ED25519');
  }

  return { keyId, privateKey, publicKey };
}

/** Sign exactly the canonical payload. Refuses a payload whose keyId is not
 *  this keyring's (a permit can never claim a different signing key). */
export function signPermitPayload(payload: PermitPayload, keyring: PermitKeyring): ExecutionPermit {
  if (payload.keyId !== keyring.keyId) {
    throw new Error('PERMIT_KEY_ID_MISMATCH');
  }

  const message = canonicalPermitPayload(payload);
  const signature = sign(null, Buffer.from(message, 'utf8'), keyring.privateKey).toString('base64url');

  return { ...payload, algorithm: 'Ed25519', signature };
}

function isoValid(s: unknown): s is string {
  return typeof s === 'string' && s.length > 0 && !Number.isNaN(Date.parse(s));
}

/** Boolean verification (the spec-shaped wrapper). */
export function verifyPermit(permit: ExecutionPermit, keyring: PermitKeyring): boolean {
  return verifyPermitDetailed(permit, keyring).valid;
}

/**
 * Detailed verification with reason codes. Order:
 *   algorithm → key pinning → shape/expiry → signature (canonical bytes).
 */
export function verifyPermitDetailed(
  permit: ExecutionPermit,
  keyring: PermitKeyring,
  nowIso?: string
): PermitVerifyResult {
  if (!permit || typeof permit !== 'object') return { valid: false, reasonCode: 'PERMIT_MALFORMED' };
  if (permit.algorithm !== 'Ed25519') return { valid: false, reasonCode: 'PERMIT_ALGORITHM' };
  if (permit.keyId !== keyring.keyId) return { valid: false, reasonCode: 'PERMIT_KEY_ID_MISMATCH' };

  const required: Array<keyof PermitPayload> = [
    'permitId', 'actionId', 'actionNonce', 'subjectId', 'policyEpoch',
    'evidenceManifestHash', 'governanceEventId', 'issuedAt', 'expiresAt', 'keyId',
  ];
  for (const key of required) {
    const v = permit[key];
    if (typeof v !== 'string' && typeof v !== 'number') return { valid: false, reasonCode: 'PERMIT_MALFORMED' };
    if (typeof v === 'string' && v.length === 0) return { valid: false, reasonCode: 'PERMIT_MALFORMED' };
  }
  if (!isoValid(permit.issuedAt) || !isoValid(permit.expiresAt)) {
    return { valid: false, reasonCode: 'PERMIT_MALFORMED' };
  }

  const now = isoValid(nowIso) ? nowIso : new Date().toISOString();
  if (Date.parse(permit.expiresAt) <= Date.parse(now)) {
    return { valid: false, reasonCode: 'PERMIT_EXPIRED' };
  }

  const { signature, algorithm: _alg, ...payload } = permit;
  if (typeof signature !== 'string' || signature.length === 0) {
    return { valid: false, reasonCode: 'PERMIT_SIGNATURE_INVALID' };
  }

  const message = canonicalPermitPayload(payload as PermitPayload);
  let ok = false;
  try {
    ok = verify(null, Buffer.from(message, 'utf8'), keyring.publicKey, Buffer.from(signature, 'base64url'));
  } catch {
    ok = false;
  }
  return ok ? { valid: true } : { valid: false, reasonCode: 'PERMIT_SIGNATURE_INVALID' };
}
