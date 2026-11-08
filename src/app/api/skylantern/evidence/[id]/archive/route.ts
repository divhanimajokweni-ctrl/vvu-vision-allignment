import { NextRequest, NextResponse } from "next/server";
import {
  ConflictError,
  NotFoundError,
  archiveEvidence,
} from "@/skylantern/server/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/skylantern/evidence/[id]/archive
 *
 * Transitions a TAMPER_DETECTED record to ARCHIVED — the only allowed exit
 * from the tampered state. Completes the verification state machine:
 *   CANDIDATE → VERIFIED → TAMPER_DETECTED → ARCHIVED
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const evidence = await archiveEvidence(id);
    return NextResponse.json({ evidence });
  } catch (e) {
    if (e instanceof NotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    if (e instanceof ConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
