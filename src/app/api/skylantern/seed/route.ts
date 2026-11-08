import { NextResponse } from "next/server";
import { seedSkylantern } from "@/skylantern/server/seed";

export const dynamic = "force-dynamic";

/**
 * POST /api/skylantern/seed
 * Idempotently seeds the demo dataset (3 pilot domains across Johannesburg CBD).
 */
export async function POST() {
  const result = await seedSkylantern();
  return NextResponse.json(result);
}
