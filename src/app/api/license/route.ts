import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { LicenseValidator } from "@/lib/vvu/license-server";
import {
  TIER_FEATURES,
  TIER_PRICING,
  ALL_FEATURES,
  type LicenseTier,
} from "@/lib/vvu/license-schema-shared";
import type { ValidationResult } from "@/lib/vvu/license-server";

// GET /api/license — list all sample licenses with validation status
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestedOrg = searchParams.get("org");

  try {
    const licensesPath = join(process.cwd(), "keys", "sample-licenses.json");
    const raw = readFileSync(licensesPath, "utf-8");
    const data = JSON.parse(raw) as {
      publicKeyPem: string;
      licenses: Record<string, { payload: unknown; signature: string }>;
    };

    const validator = new LicenseValidator(data.publicKeyPem);
    const results: Array<{
      orgId: string;
      payload: unknown;
      signature: string;
      validation: ValidationResult;
      tierInfo: {
        tier: LicenseTier;
        pricing: { monthly: number; currency: string; label: string };
        allowedFeatures: string[];
        allFeatures: string[];
      };
    }> = [];
    const edgeUrls: Record<string, string> = {};

    for (const [orgId, lic] of Object.entries(data.licenses)) {
      if (requestedOrg && orgId !== requestedOrg) continue;
      const validation = validator.validate(lic as never);
      const tier = (lic.payload as { tier: LicenseTier }).tier;
      // BPB-inspired pattern: one signed edge URL per licensee.
      // See src/app/api/license/[orgId]/edge/route.ts for the renderer.
      edgeUrls[orgId] = `/api/license/${encodeURIComponent(orgId)}/edge`;
      results.push({
        orgId,
        payload: lic.payload,
        signature: lic.signature.slice(0, 24) + "…",
        validation,
        tierInfo: {
          tier,
          pricing: TIER_PRICING[tier],
          allowedFeatures: TIER_FEATURES[tier],
          allFeatures: ALL_FEATURES,
        },
      });
    }

    return NextResponse.json({
      publicKeyPem: data.publicKeyPem,
      licenses: results,
      // One edge-rendered signed license URL per orgId — a licensee can
      // curl this to get everything needed to verify its own license
      // offline (signature + publicKeyPem + verification recipe + matrix).
      edgeUrls,
      tiers: Object.entries(TIER_PRICING).map(([tier, pricing]) => ({
        tier,
        ...pricing,
        features: TIER_FEATURES[tier as LicenseTier],
      })),
      allFeatures: ALL_FEATURES,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "License data not found", detail: (e as Error).message },
      { status: 500 },
    );
  }
}
