import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateEpd, mmrRoot, type PolicyNode } from "@/lib/epd";

// GET /api/federation — multi-organization epistemic:// federation view.
// Synthesizes federated peers (organizations) from the policy domains, each
// reconciling their shards via the epistemic:// protocol. Illustrates the
// "competing organizations reconciling their operational realities" vision.
export async function GET() {
  const policies = await db.policy.findMany({
    include: {
      shards: { take: 12 },
      proofs: { take: 3, orderBy: { createdAt: "desc" } },
    },
  });

  // Group policies by domain → each domain is a federated organization
  const orgs = new Map<string, typeof policies>();
  for (const p of policies) {
    const domain = p.domain ?? "general";
    if (!orgs.has(domain)) orgs.set(domain, [] as typeof policies);
    orgs.get(domain)!.push(p);
  }

  const orgNames: Record<string, string> = {
    smart_grid: "GridCo Europe",
    public_health: "Health Federation",
    autonomous_vehicles: "FleetOps Alliance",
    supply_chain: "ColdChain Logistics",
    finance: "Ledger Trust",
    water_utility: "Aqua Municipality",
    general: "General Org",
  };

  const federation = Array.from(orgs.entries()).map(([domain, pols], idx) => {
    const name = orgNames[domain] ?? `${domain} org`;
    const shardCount = pols.reduce((n, p) => n + p.shards.length, 0);
    const zkCount = pols.reduce((n, p) => n + (p.zkEnabled ? 1 : 0), 0);
    const allProofs = pols.flatMap((p) => p.proofs);
    const root = mmrRoot([
      domain,
      name,
      String(pols.length),
      String(shardCount),
    ]);
    return {
      id: `org-${idx}`,
      domain,
      name,
      policyCount: pols.length,
      shardCount,
      zkPolicies: zkCount,
      rootHash: root,
      anchored: allProofs.filter((p) => p.anchored).length,
      totalProofs: allProofs.length,
      handshake: `epistemic://${domain}/${root.slice(0, 8)}`,
      trustLevel:
        zkCount > 0 && allProofs.length > 0
          ? "verifiable"
          : allProofs.length > 0
            ? "anchored"
            : "unverified",
      policies: pols.map((p) => ({
        id: p.id,
        name: p.name,
        invariantCount: p.invariantCount,
        shadowEnabled: p.shadowEnabled,
        zkEnabled: p.zkEnabled,
        shardCount: p.shards.length,
        proofKind: p.proofKind,
      })),
    };
  });

  // Cross-org reconciliation channels: pairs of orgs that share a policy
  // invariant space (here we simulate by pairing adjacent orgs).
  const channels: {
    from: string;
    to: string;
    fromName: string;
    toName: string;
    kind: "zk_merge" | "mmr_reconcile" | "gossip_sync";
    status: "verified" | "negotiating" | "drift";
    rootHash: string;
  }[] = [];
  for (let i = 0; i < federation.length; i++) {
    for (let j = i + 1; j < federation.length && j < i + 2; j++) {
      const a = federation[i];
      const b = federation[j];
      const bothZk = a.zkPolicies > 0 && b.zkPolicies > 0;
      channels.push({
        from: a.id,
        to: b.id,
        fromName: a.name,
        toName: b.name,
        kind: bothZk ? "zk_merge" : "mmr_reconcile",
        status:
          a.trustLevel === "verifiable" && b.trustLevel === "verifiable"
            ? "verified"
            : a.trustLevel === "unverified" || b.trustLevel === "unverified"
              ? "negotiating"
              : "drift",
        rootHash: mmrRoot([a.rootHash, b.rootHash]),
      });
    }
  }

  return NextResponse.json({
    federation,
    channels,
    totals: {
      organizations: federation.length,
      policies: policies.length,
      channels: channels.length,
      zkOrgs: federation.filter((o) => o.zkPolicies > 0).length,
      globalRoot: mmrRoot(federation.map((o) => o.rootHash)),
    },
  });
}

// POST /api/federation — simulate a cross-org reconciliation handshake
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { fromDomain, toDomain } = body as { fromDomain?: string; toDomain?: string };
  if (!fromDomain || !toDomain) {
    return NextResponse.json({ error: "fromDomain and toDomain required" }, { status: 400 });
  }
  const fromPolicy = await db.policy.findFirst({ where: { domain: fromDomain } });
  const toPolicy = await db.policy.findFirst({ where: { domain: toDomain } });
  if (!fromPolicy || !toPolicy) {
    return NextResponse.json({ error: "org policies not found" }, { status: 404 });
  }
  // Simulate a ZK reconciliation: both orgs prove their MMR roots match on
  // shared invariants without revealing raw state.
  const zk = fromPolicy.zkEnabled && toPolicy.zkEnabled;
  const result = {
    ok: true,
    kind: zk ? "zk_merge" : "mmr_reconcile",
    from: { domain: fromDomain, name: fromPolicy.name, root: mmrRoot([fromPolicy.name, fromDomain]) },
    to: { domain: toDomain, name: toPolicy.name, root: mmrRoot([toPolicy.name, toDomain]) },
    reconciledRoot: mmrRoot([fromPolicy.name, toPolicy.name, Date.now().toString()]),
    zkProof: zk ? `zk:stark:${Math.random().toString(16).slice(2, 18)}` : null,
    privacy: zk ? "state delta proven, raw data hidden" : "MMR ancestry verified",
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json({ reconciliation: result });
}
