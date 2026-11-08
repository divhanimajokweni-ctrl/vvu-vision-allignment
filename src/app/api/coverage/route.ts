import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateEpd, type PolicyNode } from "@/lib/epd";

// GET /api/coverage — invariant coverage analysis across all policies.
// Returns a treemap-ready structure: each domain → policies → invariants,
// with severity counts, soft/hard split, and ZK/shadow coverage.
export async function GET() {
  const policies = await db.policy.findMany();

  interface InvariantInfo {
    name: string;
    severity: string;
    soft: boolean;
    predicate: string;
  }
  interface PolicyInfo {
    id: string;
    name: string;
    invariantCount: number;
    hardCount: number;
    softCount: number;
    zkEnabled: boolean;
    shadowEnabled: boolean;
    invariants: InvariantInfo[];
  }
  interface DomainInfo {
    domain: string;
    policyCount: number;
    invariantCount: number;
    hardCount: number;
    softCount: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    zkCount: number;
    shadowCount: number;
    policies: PolicyInfo[];
  }

  const domainMap = new Map<string, DomainInfo>();

  for (const p of policies) {
    const result = validateEpd(p.source);
    const node = result.ast?.policies[0] as PolicyNode | undefined;
    if (!node) continue;
    const domain = p.domain ?? "general";

    const invInfos: InvariantInfo[] = node.invariants.map((inv) => ({
      name: inv.name,
      severity: inv.severity,
      soft: inv.soft,
      predicate: inv.rawPredicate,
    }));
    const hardCount = invInfos.filter((i) => !i.soft).length;
    const softCount = invInfos.filter((i) => i.soft).length;

    const policyInfo: PolicyInfo = {
      id: p.id,
      name: p.name,
      invariantCount: invInfos.length,
      hardCount,
      softCount,
      zkEnabled: p.zkEnabled,
      shadowEnabled: p.shadowEnabled,
      invariants: invInfos,
    };

    if (!domainMap.has(domain)) {
      domainMap.set(domain, {
        domain,
        policyCount: 0,
        invariantCount: 0,
        hardCount: 0,
        softCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        zkCount: 0,
        shadowCount: 0,
        policies: [],
      });
    }
    const d = domainMap.get(domain)!;
    d.policies.push(policyInfo);
    d.policyCount++;
    d.invariantCount += invInfos.length;
    d.hardCount += hardCount;
    d.softCount += softCount;
    d.criticalCount += invInfos.filter((i) => i.severity === "critical").length;
    d.highCount += invInfos.filter((i) => i.severity === "high").length;
    d.mediumCount += invInfos.filter((i) => i.severity === "medium").length;
    d.lowCount += invInfos.filter((i) => i.severity === "low").length;
    d.zkCount += p.zkEnabled ? 1 : 0;
    d.shadowCount += p.shadowEnabled ? 1 : 0;
  }

  const domains = Array.from(domainMap.values()).sort(
    (a, b) => b.invariantCount - a.invariantCount,
  );

  // Aggregate invariant name frequency (which invariants appear across multiple policies)
  const nameFreq = new Map<string, { count: number; domains: Set<string>; severities: Set<string> }>();
  for (const d of domains) {
    for (const p of d.policies) {
      for (const inv of p.invariants) {
        if (!nameFreq.has(inv.name)) {
          nameFreq.set(inv.name, { count: 0, domains: new Set(), severities: new Set() });
        }
        const f = nameFreq.get(inv.name)!;
        f.count++;
        f.domains.add(d.domain);
        f.severities.add(inv.severity);
      }
    }
  }
  const sharedInvariants = Array.from(nameFreq.entries())
    .filter(([, f]) => f.count > 1)
    .map(([name, f]) => ({
      name,
      count: f.count,
      domainCount: f.domains.size,
      severities: Array.from(f.severities),
    }))
    .sort((a, b) => b.count - a.count);

  const totals = {
    domains: domains.length,
    policies: policies.length,
    invariants: domains.reduce((n, d) => n + d.invariantCount, 0),
    hard: domains.reduce((n, d) => n + d.hardCount, 0),
    soft: domains.reduce((n, d) => n + d.softCount, 0),
    critical: domains.reduce((n, d) => n + d.criticalCount, 0),
    high: domains.reduce((n, d) => n + d.highCount, 0),
    medium: domains.reduce((n, d) => n + d.mediumCount, 0),
    low: domains.reduce((n, d) => n + d.lowCount, 0),
    zk: domains.reduce((n, d) => n + d.zkCount, 0),
    shadow: domains.reduce((n, d) => n + d.shadowCount, 0),
    shared: sharedInvariants.length,
  };

  return NextResponse.json({ domains, sharedInvariants, totals });
}
