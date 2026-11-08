import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/policies/versions/[id] — fetch a single revision with full source
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rev = await db.policyRevision.findUnique({
    where: { id },
    include: { policy: { select: { name: true, domain: true } } },
  });
  if (!rev) {
    return NextResponse.json({ error: "revision not found" }, { status: 404 });
  }
  return NextResponse.json({ revision: rev });
}
