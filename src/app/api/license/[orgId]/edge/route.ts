/**
 * @license
 * VVU EARTH TECH ⚙ - Edge-rendered signed license URL
 * Copyright (c) 2026 Venture Vision Ubuntu
 *
 * LICENSE: Apache-2.0 (Open Source) OR Commercial (Enterprise)
 * See LICENSE and COMMERCIAL_LICENSE.md for details.
 *
 * BPB-inspired pattern (NO proxy code adopted — only the pattern):
 *   One signed URL per licensee. The URL renders a per-org license bundle
 *   on demand. Revocation = key rotation: when the issuer rotates the
 *   Ed25519 keypair, every previously-issued signature stops verifying
 *   and the edge URL begins returning the new publicKeyPem. No DB
 *   mutation needed, no per-client state.
 *
 * GET /api/license/:orgId/edge
 *   - Reads keys/sample-licenses.json
 *   - Returns a client-grade bundle: tier, features, expiry countdown,
 *     signed payload + signature + publicKeyPem, verification recipe,
 *     and the client compatibility matrix.
 *   - Cache-Control: public, max-age=300, stale-while-revalidate=600
 *     (5 min fresh, 10 min stale — a licensee can curl this on boot).
 *
 * This endpoint is the edge-rendered signed license URL. A licensee can
 * curl it once and verify their own license offline — without trusting
 * the server, the network, or the CDN.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import {
  TIER_PRICING,
  type LicensePayload,
  type LicenseTier,
} from "@/lib/vvu/license-schema-shared";

export const dynamic = "force-dynamic";

interface SampleLicenseFile {
  publicKeyPem: string;
  licenses: Record<string, { payload: LicensePayload; signature: string }>;
}

/** Client-component version compatibility matrix (mirrors docs/CLIENT-MATRIX.md). */
const CLIENT_MATRIX: Record<string, string> = {
  "epd-cli": "1.0.0+",
  "event-bus": "1.0.0+",
  "worm-nest": "1.0.0+",
  dashboard: "1.4.0+",
};

/** Verification recipe — every licensee follows the same 6 steps. */
const VERIFICATION_STEPS: readonly string[] = [
  "1. Hash the canonical JSON of the payload (sorted keys, no whitespace)",
  "2. Base64-decode the signature",
  "3. Verify with Ed25519 over the public key",
  "4. Check expiresAt is in the future",
  "5. Check features ⊆ TIER_FEATURES[tier]",
  "6. (Optional) Check hardwareFingerprint matches the host",
];

function loadSampleLicenses(): SampleLicenseFile | null {
  try {
    const licensesPath = join(process.cwd(), "keys", "sample-licenses.json");
    const raw = readFileSync(licensesPath, "utf-8");
    return JSON.parse(raw) as SampleLicenseFile;
  } catch {
    return null;
  }
}

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return 0;
  const delta = ms - Date.now();
  return delta < 0 ? 0 : Math.floor(delta / (1000 * 60 * 60 * 24));
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const data = loadSampleLicenses();
  if (!data) {
    return NextResponse.json(
      { error: "license-data-not-found", orgId },
      { status: 404 },
    );
  }

  const entry = data.licenses[orgId];
  if (!entry) {
    return NextResponse.json(
      { error: "license-not-found", orgId },
      { status: 404 },
    );
  }

  const payload = entry.payload;
  const tier = payload.tier as LicenseTier;
  const pricing = TIER_PRICING[tier];

  const bundle = {
    orgId,
    // Canonical LicensePayload fields (needed for offline signature
    // verification — the verify endpoint extracts exactly these from
    // the spread bundle):
    licenseId: payload.licenseId,
    organizationId: payload.organizationId,
    tier,
    tierLabel: pricing?.label ?? null,
    organizationName: payload.organizationName,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    daysUntilExpiry: daysUntil(payload.expiresAt),
    features: payload.features,
    maxNodes: payload.maxNodes,
    region: payload.region,
    hardwareFingerprint: payload.hardwareFingerprint ?? null,
    // REA plugin fields (BPB-inspired feature flag + consent log).
    // The consentLog is hash-chained — clients can verify integrity with
    // hashConsent(target, timestamp, granted) === entry.signature.
    REA_ENABLED: payload.REA_ENABLED === true,
    consentLog: payload.consentLog ?? [],
    consentBypass: tier === "GOVERNANCE",
    signature: entry.signature,
    signatureAlgorithm: "Ed25519",
    publicKeyPem: data.publicKeyPem,
    verificationSteps: VERIFICATION_STEPS,
    clientMatrix: CLIENT_MATRIX,
  };

  return NextResponse.json(bundle, {
    headers: {
      "Cache-Control":
        "public, max-age=300, stale-while-revalidate=600",
      // Help clients understand revocation semantics
      "X-License-Revocation": "key-rotation",
      "X-License-Signature-Algorithm": "Ed25519",
    },
  });
}
