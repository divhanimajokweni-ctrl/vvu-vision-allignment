import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateEpd, type PolicyNode } from "@/lib/epd";

// GET /api/dependencies — compute policy dependency relationships.
// Two policies are "related" if they share: domain, shard key, an invariant
// name, a repair strategy, or ancestry proof kind. Returns nodes + edges
// with the relationship type and strength.
export async function GET() {
  const policies = await db.policy.findMany();
  const nodes: PolicyNode[] = [];
  const policyMeta: { id: string; name: string; domain: string | null; node: PolicyNode }[] = [];

  for (const p of policies) {
    const result = validateEpd(p.source);
    const node = result.ast?.policies[0];
    if (node) {
      nodes.push(node);
      policyMeta.push({ id: p.id, name: p.name, domain: p.domain, node });
    }
  }

  interface Edge {
    from: string;
    to: string;
    fromName: string;
    toName: string;
    type: "shared_domain" | "shared_invariant" | "shared_shard_key" | "shared_repair" | "shared_ancestry";
    strength: number;
    detail: string;
  }

  const edges: Edge[] = [];
  const edgeMap = new Map<string, Edge>();

  for (let i = 0; i < policyMeta.length; i++) {
    for (let j = i + 1; j < policyMeta.length; j++) {
      const a = policyMeta[i];
      const b = policyMeta[j];
      const key = `${a.id}->${b.id}`;

      // Shared domain
      if (a.domain && b.domain && a.domain === b.domain) {
        edgeMap.set(`${key}:domain`, {
          from: a.id, to: b.id, fromName: a.name, toName: b.name,
          type: "shared_domain", strength: 3, detail: `domain: ${a.domain}`,
        });
      }

      // Shared invariant names
      const aInvNames = new Set(a.node.invariants.map((inv) => inv.name));
      const bInvNames = new Set(b.node.invariants.map((inv) => inv.name));
      const sharedInv = [...aInvNames].filter((n) => bInvNames.has(n));
      if (sharedInv.length > 0) {
        edgeMap.set(`${key}:invariant`, {
          from: a.id, to: b.id, fromName: a.name, toName: b.name,
          type: "shared_invariant", strength: 2 + sharedInv.length,
          detail: `${sharedInv.length} shared: ${sharedInv.slice(0, 3).join(", ")}`,
        });
      }

      // Shared shard key
      if (a.node.shard && b.node.shard && a.node.shard.key === b.node.shard.key) {
        edgeMap.set(`${key}:shard`, {
          from: a.id, to: b.id, fromName: a.name, toName: b.name,
          type: "shared_shard_key", strength: 2, detail: `shard key: ${a.node.shard.key}`,
        });
      }

      // Shared repair strategy
      if (a.node.onViolation && b.node.onViolation && a.node.onViolation.strategy === b.node.onViolation.strategy) {
        edgeMap.set(`${key}:repair`, {
          from: a.id, to: b.id, fromName: a.name, toName: b.name,
          type: "shared_repair", strength: 1, detail: `repair: ${a.node.onViolation.strategy}`,
        });
      }

      // Shared ancestry proof kind
      if (a.node.ancestry && b.node.ancestry && a.node.ancestry.proof === b.node.ancestry.proof) {
        edgeMap.set(`${key}:ancestry`, {
          from: a.id, to: b.id, fromName: a.name, toName: b.name,
          type: "shared_ancestry", strength: 1, detail: `proof: ${a.node.ancestry.proof}`,
        });
      }
    }
  }

  // Merge edges between the same pair (keep strongest)
  const mergedEdges: Edge[] = [];
  const pairEdges = new Map<string, Edge[]>();
  for (const e of edgeMap.values()) {
    const pairKey = `${e.from}->${e.to}`;
    if (!pairEdges.has(pairKey)) pairEdges.set(pairKey, []);
    pairEdges.get(pairKey)!.push(e);
  }
  for (const [pairKey, es] of pairEdges) {
    if (es.length === 1) {
      mergedEdges.push(es[0]);
    } else {
      // Combine: use the strongest type, sum strength, combine details
      const strongest = es.sort((a, b) => b.strength - a.strength)[0];
      mergedEdges.push({
        ...strongest,
        strength: es.reduce((n, e) => n + e.strength, 0),
        detail: es.map((e) => e.detail).join(" · "),
      });
    }
  }

  // Build node summaries with degree
  const nodeDegrees = new Map<string, number>();
  for (const e of mergedEdges) {
    nodeDegrees.set(e.from, (nodeDegrees.get(e.from) ?? 0) + 1);
    nodeDegrees.set(e.to, (nodeDegrees.get(e.to) ?? 0) + 1);
  }

  const graphNodes = policyMeta.map((p) => ({
    id: p.id,
    name: p.name,
    domain: p.domain,
    invariantCount: p.node.invariants.length,
    zkEnabled: p.node.ancestry?.zk ?? false,
    shadowEnabled: p.node.shadowBridge?.enabled ?? false,
    shardKey: p.node.shard?.key ?? null,
    degree: nodeDegrees.get(p.id) ?? 0,
    invariantNames: p.node.invariants.map((i) => i.name),
  }));

  return NextResponse.json({
    nodes: graphNodes,
    edges: mergedEdges,
    totals: {
      nodes: graphNodes.length,
      edges: mergedEdges.length,
      connected: graphNodes.filter((n) => n.degree > 0).length,
      isolated: graphNodes.filter((n) => n.degree === 0).length,
    },
  });
}
