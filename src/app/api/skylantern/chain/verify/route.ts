import { NextResponse } from "next/server";
import { verifyChainIntegrity } from "@/skylantern/server/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/skylantern/chain/verify
 *
 * Walks the entire WORM chain in ascending sequence order, recomputes every
 * hash from the stored payload, and flags any block where the recomputed hash
 * no longer matches the stored hash.
 *
 * This is the "court-grade" check a municipal auditor runs before accepting
 * a Proof Bundle. Returns a full integrity report.
 */
export async function POST() {
  const report = await verifyChainIntegrity();
  return NextResponse.json({ report });
}
