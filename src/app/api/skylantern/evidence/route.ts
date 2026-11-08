import { NextRequest, NextResponse } from "next/server";
import {
  ConflictError,
  NotFoundError,
  attachWitness,
  getEvidenceList,
  submitEvidence,
} from "@/skylantern/server/service";
import type {
  Domain,
  SubmitEvidenceRequest,
  VerificationState,
} from "@/skylantern/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const domain = params.get("domain") as Domain | null;
  const state = params.get("state") as VerificationState | null;
  const sinceMs = params.get("since");
  const limit = Number(params.get("limit") ?? 200);
  const since = sinceMs ? new Date(Number(sinceMs)) : undefined;
  const list = await getEvidenceList({
    limit,
    domain: domain ?? undefined,
    state: state ?? undefined,
    since,
  });
  return NextResponse.json({ evidence: list, count: list.length });
}

export async function POST(req: NextRequest) {
  let body: SubmitEvidenceRequest;
  try {
    body = (await req.json()) as SubmitEvidenceRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  if (!body.deviceExternalId || !body.observedFact) {
    return NextResponse.json(
      {
        error:
          "deviceExternalId and observedFact are required. observedFact must include {value, unit, primitive, raw}.",
      },
      { status: 400 }
    );
  }
  try {
    const created = await submitEvidence(body);
    return NextResponse.json({ evidence: created }, { status: 201 });
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

export async function PATCH(req: NextRequest) {
  // Attach a second witness to an existing evidence record.
  let body: {
    evidenceId: string;
    witnessType: "WEARABLE" | "GNSS" | "SECOND_DEVICE" | "OPERATOR";
    witnessLabel: string;
    witnessKeyHint?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  if (!body.evidenceId || !body.witnessType || !body.witnessLabel) {
    return NextResponse.json(
      { error: "evidenceId, witnessType, witnessLabel are required." },
      { status: 400 }
    );
  }
  try {
    const updated = await attachWitness(body);
    return NextResponse.json({ evidence: updated });
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
