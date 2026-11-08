import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/miner?policyId=... — list mined invariant candidates
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const policyId = searchParams.get("policyId");
  const mined = await db.minedInvariant.findMany({
    where: policyId ? { policyId } : undefined,
    include: { policy: { select: { name: true } } },
    orderBy: { confidence: "desc" },
    take: 40,
  });
  return NextResponse.json({ mined });
}

// PATCH /api/miner — accept/reject a mined invariant
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id, accepted } = body as { id?: string; accepted?: boolean };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const updated = await db.minedInvariant.update({
    where: { id },
    data: { accepted: accepted ?? false },
  });
  return NextResponse.json({ mined: updated });
}
