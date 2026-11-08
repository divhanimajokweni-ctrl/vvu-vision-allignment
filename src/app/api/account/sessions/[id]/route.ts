import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedWorkspaceIfEmpty } from "@/lib/workspace/seed";

export const dynamic = "force-dynamic";

// DELETE /api/account/sessions/[id] — revoke a session (set revokedAt to now)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await seedWorkspaceIfEmpty();
  const { id } = await params;
  const existing = await db.userSession.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  await db.userSession.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
