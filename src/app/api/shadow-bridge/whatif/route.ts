import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateEpd, evaluateInvariant, type PolicyNode, mmrRoot } from "@/lib/epd";

// POST /api/shadow-bridge/whatif — replay historical state with modified invariants
// Body: { policyId, stateDelta?, predicateOverride? }
//   stateDelta: partial state to overlay
//   predicateOverride: { invariantName: newPredicateRaw }  (replays with new rule)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { policyId, stateDelta, predicateOverride } = body as {
    policyId?: string;
    stateDelta?: Record<string, unknown>;
    predicateOverride?: Record<string, string>;
  };
  if (!policyId) return NextResponse.json({ error: "policyId required" }, { status: 400 });
  const policy = await db.policy.findUnique({ where: { id: policyId } });
  if (!policy) return NextResponse.json({ error: "policy not found" }, { status: 404 });

  const result = validateEpd(policy.source);
  const node = result.ast?.policies[0] as PolicyNode | undefined;
  if (!node) return NextResponse.json({ error: "parse failed" }, { status: 500 });

  const shard = await db.shard.findFirst({ where: { policyId } });
  const base = shard ? JSON.parse(shard.state) : {};
  const replayed = { ...base, ...(stateDelta ?? {}) };

  // Build a modified policy with overridden predicates (raw re-parse)
  const modifiedNode: PolicyNode = {
    ...node,
    invariants: node.invariants.map((inv) =>
      predicateOverride && predicateOverride[inv.name]
        ? { ...inv, rawPredicate: predicateOverride[inv.name] }
        : inv,
    ),
  };

  const evaluations = modifiedNode.invariants.map((inv) =>
    evaluateInvariant(inv, replayed),
  );

  const event = await db.shadowEvent.create({
    data: {
      policyId,
      kind: "whatif",
      summary: `What-if replay${predicateOverride ? " (modified invariants)" : ""}${
        stateDelta ? " (state delta)" : ""
      }`,
      liveState: JSON.stringify(base),
      shadowState: JSON.stringify(replayed),
      divergence: evaluations.filter((e) => !e.passed).length,
    },
  });

  return NextResponse.json({
    ok: true,
    event,
    replayed,
    evaluations,
    mmrRoot: mmrRoot([JSON.stringify(replayed), policy.name]),
  });
}
