import { NextRequest, NextResponse } from "next/server";
import { getAuditTimeline } from "@/skylantern/server/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/skylantern/evidence/[id]/audit
 *
 * Returns the full audit timeline for an evidence record — every state
 * transition from CREATE through WITNESS_ATTACHED / TAMPER_FLAGGED / ARCHIVED.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const events = await getAuditTimeline(id);
  return NextResponse.json({ events, count: events.length });
}
