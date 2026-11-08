import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateEpd, evaluateInvariant, mmrRoot, type PolicyNode } from "@/lib/epd";

// GET /api/shards/rebalance — list rebalancing candidates: shards that could
// migrate to a less-loaded node while preserving invariants. Returns the
// current node load distribution and candidate migrations.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const policyId = searchParams.get("policyId");

  const shards = await db.shard.findMany({
    where: policyId ? { policyId } : undefined,
    include: { policy: { select: { name: true, source: true } } },
    orderBy: { region: "asc" },
  });

  // Compute node load (shard count per node)
  const nodeLoad: Record<string, number> = {};
  for (const s of shards) {
    nodeLoad[s.nodeId] = (nodeLoad[s.nodeId] ?? 0) + 1;
  }
  const nodes = Object.entries(nodeLoad)
    .map(([id, load]) => ({ id, load }))
    .sort((a, b) => b.load - a.load);

  // Candidate migrations: from the most-loaded node to the least-loaded node,
  // but only if it preserves all hard invariants.
  const candidates: {
    shardId: string;
    region: string;
    policyName: string;
    fromNode: string;
    toNode: string;
    preservesInvariants: boolean;
    newMmrRoot: string;
  }[] = [];

  if (nodes.length >= 2) {
    const hottest = nodes[0];
    const coolest = nodes[nodes.length - 1];
    if (hottest.load > coolest.load + 1) {
      // Find shards on the hottest node
      const migratable = shards.filter((s) => s.nodeId === hottest.id).slice(0, 4);
      for (const s of migratable) {
        const state = JSON.parse(s.state);
        const result = validateEpd(s.policy.source);
        const node = result.ast?.policies[0] as PolicyNode | undefined;
        let preserves = true;
        if (node) {
          for (const inv of node.invariants) {
            if (!inv.soft) {
              const ev = evaluateInvariant(inv, state);
              if (!ev.passed) {
                preserves = false;
                break;
              }
            }
          }
        }
        candidates.push({
          shardId: s.id,
          region: s.region,
          policyName: s.policy.name,
          fromNode: hottest.id,
          toNode: coolest.id,
          preservesInvariants: preserves,
          newMmrRoot: mmrRoot([s.mmrRoot, coolest.id, Date.now().toString()]),
        });
      }
    }
  }

  return NextResponse.json({
    nodes,
    candidates,
    totalShards: shards.length,
    hottestNode: nodes[0]?.id,
    coolestNode: nodes[nodes.length - 1]?.id,
  });
}

// POST /api/shards/rebalance — execute a shard migration
// Body: { shardId, toNode }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { shardId, toNode } = body as { shardId?: string; toNode?: string };
  if (!shardId || !toNode) {
    return NextResponse.json({ error: "shardId and toNode required" }, { status: 400 });
  }

  const shard = await db.shard.findUnique({
    where: { id: shardId },
    include: { policy: { select: { name: true, source: true } } },
  });
  if (!shard) return NextResponse.json({ error: "shard not found" }, { status: 404 });

  // Verify invariants are preserved after migration (the state doesn't change,
  // only the hosting node — but we re-check to be safe)
  const state = JSON.parse(shard.state);
  const result = validateEpd(shard.policy.source);
  const node = result.ast?.policies[0];
  let preserves = true;
  const violations: string[] = [];
  if (node) {
    for (const inv of node.invariants) {
      if (!inv.soft) {
        const ev = evaluateInvariant(inv, state);
        if (!ev.passed) {
          preserves = false;
          violations.push(inv.name);
        }
      }
    }
  }

  if (!preserves) {
    return NextResponse.json(
      { error: "migration rejected: invariants would be violated", violations },
      { status: 409 },
    );
  }

  const fromNode = shard.nodeId;
  const newMmr = mmrRoot([shard.mmrRoot, toNode, Date.now().toString()]);

  const updated = await db.shard.update({
    where: { id: shardId },
    data: {
      nodeId: toNode,
      mmrRoot: newMmr,
      lastMergeAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    migration: {
      shardId,
      region: shard.region,
      policyName: shard.policy.name,
      fromNode,
      toNode,
      newMmrRoot: newMmr,
      preservesInvariants: true,
    },
  });
}
