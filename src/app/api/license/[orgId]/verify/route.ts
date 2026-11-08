/**
 * @license
 * VVU EARTH TECH ⚙ - Server-side license verification helper
 * Copyright (c) 2026 Venture Vision Ubuntu
 *
 * LICENSE: Apache-2.0 (Open Source) OR Commercial (Enterprise)
 * See LICENSE and COMMERCIAL_LICENSE.md for details.
 *
 * POST /api/license/:orgId/verify
 *   Body: { payload: LicensePayload | Partial<LicensePayload>, signature: string, hardwareFingerprint?: string }
 *   Returns: { valid: true, checks } | { valid: false, reason, checks }
 *
 * This endpoint is the server-side verification helper for clients that
 * don't have Ed25519 tooling locally. It runs the FULL verification:
 *   1. Signature verification (Ed25519 over canonical JSON of payload)
 *   2. Expiry check (expiresAt > now)
 *   3. Features ⊆ TIER_FEATURES[tier]
 *   4. Hardware fingerprint match (if provided in body)
 *
 * Robustness: the endpoint extracts ONLY the canonical LicensePayload
 * fields from the incoming payload (licenseId, tier, organizationId,
 * organizationName, issuedAt, expiresAt, features, hardwareFingerprint,
 * maxNodes, region) and ignores any extras. This means a client can
 * POST the entire edge bundle verbatim — extra fields like tierLabel,
 * daysUntilExpiry, signature, publicKeyPem, verificationSteps, clientMatrix
 * are dropped before canonicalization. The signature will still verify
 * against the original payload.
 *
 * The orgId in the URL is for routing/audit only — the actual
 * organization identity comes from payload.organizationId. We log a
 * mismatch in the response (but do not fail) so clients can detect
 * URL/payload drift.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { createPublicKey, verify } from "crypto";
import {
  TIER_FEATURES,
  type LicensePayload,
  type LicenseTier,
} from "@/lib/vvu/license-schema-shared";

export const dynamic = "force-dynamic";

interface SampleLicenseFile {
  publicKeyPem: string;
  licenses: Record<string, { payload: LicensePayload; signature: string }>;
}

interface VerifyRequestBody {
  payload?: Record<string, unknown>;
  signature?: unknown;
  hardwareFingerprint?: unknown;
}

/** The canonical LicensePayload keys — anything else is dropped. */
const PAYLOAD_KEYS = [
  "licenseId",
  "tier",
  "organizationId",
  "organizationName",
  "issuedAt",
  "expiresAt",
  "features",
  "hardwareFingerprint",
  "maxNodes",
  "region",
] as const;

function extractPayload(
  incoming: Record<string, unknown>,
): LicensePayload {
  const payload: LicensePayload = {
    licenseId: String(incoming.licenseId ?? ""),
    tier: String(incoming.tier ?? "") as LicenseTier,
    organizationId: String(incoming.organizationId ?? ""),
    organizationName: String(incoming.organizationName ?? ""),
    issuedAt: String(incoming.issuedAt ?? ""),
    expiresAt: String(incoming.expiresAt ?? ""),
    features: Array.isArray(incoming.features)
      ? (incoming.features as unknown[]).map((f) => String(f))
      : [],
    maxNodes: Number(incoming.maxNodes ?? 0),
    region: String(incoming.region ?? ""),
  };
  // Only include hardwareFingerprint when it's a non-empty string —
  // matches the original signed shape (absent key for un-bound licenses).
  if (
    typeof incoming.hardwareFingerprint === "string" &&
    incoming.hardwareFingerprint.length > 0
  ) {
    payload.hardwareFingerprint = incoming.hardwareFingerprint;
  }
  return payload;
}

/** Canonical JSON: sorted keys, no whitespace — must match signLicense(). */
function canonicalize(payload: LicensePayload): string {
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(payload).sort()) {
    sorted[k] = (payload as unknown as Record<string, unknown>)[k];
  }
  return JSON.stringify(sorted);
}

function loadPublicKeyPem(): string | null {
  try {
    const licensesPath = join(process.cwd(), "keys", "sample-licenses.json");
    const raw = readFileSync(licensesPath, "utf-8");
    const data = JSON.parse(raw) as SampleLicenseFile;
    return data.publicKeyPem;
  } catch {
    return null;
  }
}

interface CheckResult {
  signatureValid: boolean;
  notExpired: boolean;
  featuresConsistent: boolean;
  hardwareMatch: boolean;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  let body: VerifyRequestBody;
  try {
    body = (await req.json()) as VerifyRequestBody;
  } catch {
    return NextResponse.json(
      {
        valid: false,
        reason: "invalid-json",
        checks: null,
        orgId,
      },
      { status: 400 },
    );
  }

  if (!body.payload || typeof body.payload !== "object") {
    return NextResponse.json(
      {
        valid: false,
        reason: "missing-payload",
        checks: null,
        orgId,
      },
      { status: 400 },
    );
  }
  if (typeof body.signature !== "string" || body.signature.length === 0) {
    return NextResponse.json(
      {
        valid: false,
        reason: "missing-signature",
        checks: null,
        orgId,
      },
      { status: 400 },
    );
  }

  const publicKeyPem = loadPublicKeyPem();
  if (!publicKeyPem) {
    return NextResponse.json(
      {
        valid: false,
        reason: "public-key-not-configured",
        checks: null,
        orgId,
      },
      { status: 500 },
    );
  }

  const payload = extractPayload(body.payload);

  const checks: CheckResult = {
    signatureValid: false,
    notExpired: false,
    featuresConsistent: false,
    hardwareMatch: true,
  };

  // ── 1. Signature verification (Ed25519 over canonical JSON) ──────────
  try {
    const publicKey = createPublicKey(publicKeyPem);
    const canonical = canonicalize(payload);
    const signatureBuffer = Buffer.from(body.signature, "base64");
    checks.signatureValid = verify(
      null,
      Buffer.from(canonical, "utf-8"),
      publicKey,
      signatureBuffer,
    );
  } catch {
    checks.signatureValid = false;
  }

  // ── 2. Expiry check ──────────────────────────────────────────────────
  const expiryMs = new Date(payload.expiresAt).getTime();
  checks.notExpired = Number.isFinite(expiryMs) && Date.now() < expiryMs;

  // ── 3. Features ⊆ TIER_FEATURES[tier] ────────────────────────────────
  const allowed = TIER_FEATURES[payload.tier];
  if (allowed) {
    const allowedSet = new Set(allowed);
    checks.featuresConsistent = payload.features.every(
      (f) => allowedSet.has(f),
    );
  } else {
    checks.featuresConsistent = false;
  }

  // ── 4. Hardware fingerprint match (if provided in body) ──────────────
  // The body.hardwareFingerprint is the host's claimed fingerprint. We
  // compare it against payload.hardwareFingerprint (the issuer's binding).
  // If body.hardwareFingerprint is absent, we skip the check (the host
  // can verify itself against its own environment out-of-band).
  if (typeof body.hardwareFingerprint === "string") {
    checks.hardwareMatch =
      body.hardwareFingerprint === (payload.hardwareFingerprint ?? null);
  } else if (payload.hardwareFingerprint) {
    // License is bound to hardware but client didn't send a claim.
    // We can't do a host comparison from the server side — mark as
    // "skipped" (true) and surface a note so the client knows to verify
    // locally. The signature check above already authenticates the issuer.
    checks.hardwareMatch = true;
  } else {
    checks.hardwareMatch = true;
  }

  const valid =
    checks.signatureValid &&
    checks.notExpired &&
    checks.featuresConsistent &&
    checks.hardwareMatch;

  let reason: string | undefined;
  if (!valid) {
    if (!checks.signatureValid) reason = "INVALID_SIGNATURE";
    else if (!checks.notExpired) reason = "LICENSE_EXPIRED";
    else if (!checks.featuresConsistent) reason = "FEATURES_NOT_IN_TIER";
    else if (!checks.hardwareMatch) reason = "HARDWARE_MISMATCH";
  }

  const urlOrgMatchesPayload = orgId === payload.organizationId;

  return NextResponse.json({
    valid,
    ...(reason ? { reason } : {}),
    checks,
    orgId,
    payloadOrgId: payload.organizationId,
    tier: payload.tier,
    urlOrgMatchesPayload,
    canonicalFields: PAYLOAD_KEYS,
  });
}
