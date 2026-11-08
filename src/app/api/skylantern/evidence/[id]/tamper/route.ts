import { NextRequest, NextResponse } from "next/server";
import {
  ConflictError,
  NotFoundError,
  simulateTamper,
} from "@/skylantern/server/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/skylantern/evidence/[id]/tamper
 *
 * Simulates a malicious post-hoc edit of an evidence record's payload.
 * The stored payload is mutated WITHOUT updating the hash or signature.
 * The record is then flagged as TAMPER_DETECTED — proving the chain catches
 * the edit rather than silently absorbing it.
 *
 * Body (optional):
 *   { field?: "value" | "raw", newValue?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { field?: "value" | "raw"; newValue?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — use defaults
  }
  try {
    const evidence = await simulateTamper(id, body);
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
