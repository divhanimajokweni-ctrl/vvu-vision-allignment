import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateEpd, selfRepair, type PolicyNode } from "@/lib/epd";

// POST /api/merges/repair — re-run self-repair on an existing merge proposal
// Body: { mergeId } OR { policyId, current, proposed }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { mergeId, policyId, current, proposed } = body as {
    mergeId?: string;
    policyId?: string;
    current?: Record<string, unknown>;
    proposed?: Record<string, unknown>;
  };

  let policySource = "";
  let cur: Record<string, unknown> = current ?? {};
  let prop: Record<string, unknown> = proposed ?? {};

  if (mergeId) {
    const merge = await db.mergeProposal.findUnique({
      where: { id: mergeId },
      include: { policy: true },
    });
    if (!merge) return NextResponse.json({ error: "merge not found" }, { status: 404 });
    policySource = merge.policy.source;
    cur = current ?? JSON.parse(merge.proposedState);
    prop = proposed ?? JSON.parse(merge.proposedState);
  } else if (policyId) {
    const policy = await db.policy.findUnique({ where: { id: policyId } });
    if (!policy) return NextResponse.json({ error: "policy not found" }, { status: 404 });
    policySource = policy.source;
    const firstShard = await db.shard.findFirst({ where: { policyId } });
    cur = current ?? (firstShard ? JSON.parse(firstShard.state) : {});
    if (!proposed) return NextResponse.json({ error: "proposed is required" }, { status: 400 });
  } else {
    return NextResponse.json({ error: "mergeId or policyId required" }, { status: 400 });
  }

  const result = validateEpd(policySource);
  const node = result.ast?.policies[0] as PolicyNode | undefined;
  if (!node) return NextResponse.json({ error: "policy parse failed" }, { status: 500 });

  const repair = selfRepair(node, cur, prop);

  if (mergeId) {
    await db.mergeProposal.update({
      where: { id: mergeId },
      data: {
        repairedState: repair.ok ? JSON.stringify(repair.repairedState) : null,
        status: repair.ok ? "applied" : "rejected",
        violations: JSON.stringify(repair.violations),
        divergence: repair.divergence,
        iterations: repair.iterations,
      },
    });
  }

  return NextResponse.json({ repair });
}
