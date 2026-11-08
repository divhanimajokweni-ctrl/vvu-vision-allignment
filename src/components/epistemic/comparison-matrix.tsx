"use client";

import { useMemo, useState } from "react";
import {
  Grid3x3,
  GitBranch,
  CheckCircle2,
  XCircle,
  Minus,
  Plus,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Cpu,
  KeyRound,
  Layers,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  SAMPLE_POLICIES,
  validateEpd,
  type PolicyNode,
  type InvariantNode,
} from "@/lib/epd";

type Severity = "critical" | "high" | "medium" | "low";

interface PolicySummary {
  name: string;
  filename: string;
  domain: string;
  node: PolicyNode;
  invariants: Map<string, InvariantNode>; // by invariant name
  invariantNames: string[];
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "text-violating",
  high: "text-repairing",
  medium: "text-quarantined",
  low: "text-muted-foreground",
};

const SEVERITY_BG: Record<Severity, string> = {
  critical: "bg-violating/15 border-violating/30",
  high: "bg-repairing/15 border-repairing/30",
  medium: "bg-quarantined/15 border-quarantined/30",
  low: "bg-muted/20 border-border/40",
};

function buildSummary(filename: string): PolicySummary | null {
  const sample = SAMPLE_POLICIES.find((s) => s.filename === filename);
  if (!sample) return null;
  const result = validateEpd(sample.source);
  const node = result.ast?.policies[0];
  if (!node) return null;
  const invMap = new Map<string, InvariantNode>();
  for (const inv of node.invariants) {
    invMap.set(inv.name, inv);
  }
  return {
    name: node.name,
    filename: sample.filename,
    domain: node.domain ?? "general",
    node,
    invariants: invMap,
    invariantNames: node.invariants.map((i) => i.name),
  };
}

export function ComparisonMatrixSection() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>(() =>
    SAMPLE_POLICIES.slice(0, 3).map((s) => s.filename),
  );

  const summaries = useMemo(
    () => selected.map(buildSummary).filter((s): s is PolicySummary => s !== null),
    [selected],
  );

  // Collect the union of all invariant names across selected policies
  const allInvariantNames = useMemo(() => {
    const set = new Set<string>();
    for (const s of summaries) {
      for (const name of s.invariantNames) set.add(name);
    }
    return Array.from(set).sort((a, b) => {
      // Sort by max severity across policies, then alphabetical
      const aMax = Math.min(
        ...summaries.map((s) => SEVERITY_RANK[(s.invariants.get(a)?.severity ?? "low") as Severity] ?? 4),
      );
      const bMax = Math.min(
        ...summaries.map((s) => SEVERITY_RANK[(s.invariants.get(b)?.severity ?? "low") as Severity] ?? 4),
      );
      if (aMax !== bMax) return aMax - bMax;
      return a.localeCompare(b);
    });
  }, [summaries]);

  const togglePolicy = (filename: string) => {
    setSelected((prev) => {
      if (prev.includes(filename)) {
        if (prev.length <= 2) {
          toast({ title: "Keep at least 2 policies", description: "A comparison needs at least 2 policies.", variant: "destructive" });
          return prev;
        }
        return prev.filter((f) => f !== filename);
      }
      if (prev.length >= 5) {
        toast({ title: "Max 5 policies", description: "Comparison supports up to 5 policies for readability.", variant: "destructive" });
        return prev;
      }
      return [...prev, filename];
    });
  };

  return (
    <section className="space-y-4">
      {/* Header */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-verified/30 bg-verified/10 shrink-0">
            <Grid3x3 className="h-5 w-5 text-verified" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold flex items-center gap-2">
              Policy Comparison Matrix
              <Badge variant="outline" className="border-verified/30 bg-verified/10 text-verified text-[9px] font-mono">
                {summaries.length} policies · {allInvariantNames.length} invariants
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compare multiple policies' invariants side-by-side. Spot coverage gaps, severity mismatches, and shared patterns.
            </p>
          </div>
        </div>
      </Card>

      {/* Policy selector chips */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
        <div className="bg-grid-fine absolute inset-0 opacity-20" />
        <div className="relative">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
            Select policies to compare (2–5)
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {SAMPLE_POLICIES.map((s) => {
              const isActive = selected.includes(s.filename);
              return (
                <button
                  key={s.filename}
                  onClick={() => togglePolicy(s.filename)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                    isActive
                      ? "border-verified/40 bg-verified/10 text-verified"
                      : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground hover:border-border",
                  )}
                >
                  {isActive ? <CheckCircle2 className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  <span className="font-mono truncate max-w-[140px]">{s.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Summary comparison cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {summaries.map((s) => {
          const zk = s.node.ancestry?.zk ?? false;
          const shadow = s.node.shadowBridge?.enabled ?? false;
          const shard = !!s.node.shard;
          const repair = s.node.onViolation?.strategy ?? "—";
          return (
            <Card key={s.filename} className="bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
              <div className="bg-grid-fine absolute inset-0 opacity-20" />
              <div className="relative">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-3.5 w-3.5 text-verified shrink-0" />
                  <span className="text-sm font-semibold truncate">{s.name}</span>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{s.domain}</div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                  <Stat label="invariants" value={String(s.invariantNames.length)} />
                  <Stat label="shard" value={shard ? "yes" : "no"} />
                  <Stat label="repair" value={repair} mono />
                  <Stat label="exports" value={String(s.node.exports.length)} />
                </div>
                <div className="mt-2 flex items-center gap-1 flex-wrap">
                  {zk && (
                    <Badge variant="outline" className="text-[9px] border-verified/30 bg-verified/10 text-verified">
                      <Lock className="h-2.5 w-2.5 mr-0.5" /> ZK
                    </Badge>
                  )}
                  {shadow && (
                    <Badge variant="outline" className="text-[9px] border-repairing/30 bg-repairing/10 text-repairing">
                      <Cpu className="h-2.5 w-2.5 mr-0.5" /> shadow
                    </Badge>
                  )}
                  {shard && (
                    <Badge variant="outline" className="text-[9px] border-border/60">
                      <Layers className="h-2.5 w-2.5 mr-0.5" /> sharded
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Matrix */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid-fine absolute inset-0 opacity-20" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <Grid3x3 className="h-4 w-4 text-repairing" />
            <span className="text-sm font-semibold">Invariant matrix</span>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">
              rows = invariants · cols = policies
            </span>
          </div>

          {allInvariantNames.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-6 text-center">
              Select policies to compare.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/40">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/20">
                    <th className="sticky left-0 z-10 bg-muted/20 px-3 py-2 text-left text-[10px] uppercase tracking-wide text-muted-foreground min-w-[180px]">
                      Invariant
                    </th>
                    {summaries.map((s) => (
                      <th key={s.filename} className="px-3 py-2 text-left min-w-[140px]">
                        <div className="font-mono text-xs font-semibold text-foreground truncate" title={s.name}>
                          {s.name}
                        </div>
                        <div className="font-mono text-[9px] text-muted-foreground truncate">{s.domain}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allInvariantNames.map((invName) => {
                    return (
                      <tr key={invName} className="border-b border-border/40 hover:bg-muted/10">
                        <td className="sticky left-0 z-10 bg-card/60 px-3 py-2">
                          <div className="font-mono text-xs font-medium text-foreground">{invName}</div>
                        </td>
                        {summaries.map((s) => {
                          const inv = s.invariants.get(invName);
                          if (!inv) {
                            return (
                              <td key={`${s.filename}-${invName}`} className="px-3 py-2">
                                <div className="flex items-center gap-1.5 text-muted-foreground/50">
                                  <Minus className="h-3.5 w-3.5" />
                                  <span className="text-[10px]">—</span>
                                </div>
                              </td>
                            );
                          }
                          const sev = inv.severity as Severity;
                          return (
                            <td key={`${s.filename}-${invName}`} className="px-3 py-2">
                              <div className={cn("rounded-md border px-2 py-1", SEVERITY_BG[sev])}>
                                <div className="flex items-center gap-1.5">
                                  <span className={cn("h-1.5 w-1.5 rounded-full", sev === "critical" ? "bg-violating" : sev === "high" ? "bg-repairing" : sev === "medium" ? "bg-quarantined" : "bg-muted-foreground")} />
                                  <span className={cn("text-[10px] font-semibold uppercase", SEVERITY_COLOR[sev])}>
                                    {sev}
                                  </span>
                                  {inv.soft && (
                                    <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-quarantined/30 text-quarantined">
                                      soft
                                    </Badge>
                                  )}
                                </div>
                                <div className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate" title={inv.rawPredicate}>
                                  {inv.rawPredicate}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Coverage analysis */}
          {summaries.length >= 2 && allInvariantNames.length > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <CoverageCard
                title="Shared invariants"
                icon={CheckCircle2}
                count={allInvariantNames.filter((name) => summaries.every((s) => s.invariants.has(name))).length}
                total={allInvariantNames.length}
                accent="verified"
              />
              <CoverageCard
                title="Partial coverage"
                icon={AlertTriangle}
                count={allInvariantNames.filter((name) => {
                  const count = summaries.filter((s) => s.invariants.has(name)).length;
                  return count > 0 && count < summaries.length;
                }).length}
                total={allInvariantNames.length}
                accent="repairing"
              />
              <CoverageCard
                title="Unique to one policy"
                icon={KeyRound}
                count={allInvariantNames.filter((name) => summaries.filter((s) => s.invariants.has(name)).length === 1).length}
                total={allInvariantNames.length}
                accent="quarantined"
              />
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded bg-background/40 px-1.5 py-0.5">
      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("text-[11px] font-medium truncate", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function CoverageCard({
  title,
  icon: Icon,
  count,
  total,
  accent,
}: {
  title: string;
  icon: typeof CheckCircle2;
  count: number;
  total: number;
  accent: "verified" | "repairing" | "quarantined";
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const color = accent === "verified" ? "text-verified" : accent === "repairing" ? "text-repairing" : "text-quarantined";
  const bar = accent === "verified" ? "bg-verified" : accent === "repairing" ? "bg-repairing" : "bg-quarantined";
  return (
    <div className="rounded-md border border-border/40 bg-background/40 p-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", color)} />
        <span className="text-[11px] font-medium">{title}</span>
      </div>
      <div className="mt-1.5 flex items-end gap-2">
        <span className={cn("text-xl font-semibold tabular-nums", color)}>{count}</span>
        <span className="text-[10px] text-muted-foreground mb-0.5">/ {total}</span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground">{pct}%</span>
      </div>
      <div className="mt-1 h-1 w-full rounded-full bg-muted/40 overflow-hidden">
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
