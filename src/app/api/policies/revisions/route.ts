import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateEpd } from "@/lib/epd";

// GET /api/policies/revisions?policyId=... — list all revisions for a policy
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const policyId = searchParams.get("policyId");
  if (!policyId) {
    return NextResponse.json({ error: "policyId required" }, { status: 400 });
  }
  const revisions = await db.policyRevision.findMany({
    where: { policyId },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      wasmFingerprint: true,
      invariantCount: true,
      changeSummary: true,
      author: true,
      createdAt: true,
    },
  });
  const policy = await db.policy.findUnique({
    where: { id: policyId },
    select: { name: true, source: true, wasmFingerprint: true, invariantCount: true, updatedAt: true },
  });
  return NextResponse.json({ revisions, policy });
}

// POST /api/policies/revisions — snapshot the current policy source as a new revision
// Body: { policyId, changeSummary?, author? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { policyId, changeSummary, author } = body as {
    policyId?: string;
    changeSummary?: string;
    author?: string;
  };
  if (!policyId) {
    return NextResponse.json({ error: "policyId required" }, { status: 400 });
  }
  const policy = await db.policy.findUnique({ where: { id: policyId } });
  if (!policy) {
    return NextResponse.json({ error: "policy not found" }, { status: 404 });
  }
  // Determine the next version number
  const lastRev = await db.policyRevision.findFirst({
    where: { policyId },
    orderBy: { version: "desc" },
  });
  const nextVersion = (lastRev?.version ?? 0) + 1;

  const result = validateEpd(policy.source);
  const rev = await db.policyRevision.create({
    data: {
      policyId,
      version: nextVersion,
      source: policy.source,
      wasmFingerprint: result.compiledEnforcer?.invariantFingerprints[0]?.hash ?? null,
      invariantCount: policy.invariantCount,
      changeSummary: changeSummary ?? `Revision ${nextVersion}`,
      author: author ?? "system",
    },
  });
  return NextResponse.json({ revision: rev });
}

// PATCH /api/policies/revisions — restore a policy to a previous revision
// Body: { revisionId }
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { revisionId } = body as { revisionId?: string };
  if (!revisionId) {
    return NextResponse.json({ error: "revisionId required" }, { status: 400 });
  }
  const rev = await db.policyRevision.findUnique({ where: { id: revisionId } });
  if (!rev) {
    return NextResponse.json({ error: "revision not found" }, { status: 404 });
  }
  const result = validateEpd(rev.source);
  if (!result.ok) {
    return NextResponse.json(
      { error: "revision source is invalid", diagnostics: result.diagnostics },
      { status: 400 },
    );
  }
  // Restore the policy source from this revision
  const updated = await db.policy.update({
    where: { id: rev.policyId },
    data: {
      source: rev.source,
      wasmFingerprint: rev.wasmFingerprint,
      invariantCount: rev.invariantCount,
      errorCount: result.diagnostics.filter((d) => d.level === "error").length,
      warningCount: result.diagnostics.filter((d) => d.level === "warning").length,
    },
  });
  return NextResponse.json({ policy: updated, restoredFrom: rev });
}
