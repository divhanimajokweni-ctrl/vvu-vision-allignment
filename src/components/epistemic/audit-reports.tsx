"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Download,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Cpu,
  GitBranch,
  KeyRound,
  FileCheck2,
  Printer,
  Copy,
  FileSpreadsheet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { PolicyRow } from "@/lib/types";

interface AuditInvariant {
  name: string;
  severity: string;
  soft: boolean;
  predicate: string;
  message?: string;
}

interface AuditPolicy {
  id: string;
  name: string;
  domain: string | null;
  version: string | null;
  filename: string;
  description: string | null;
  ok: boolean;
  diagnostics: { errors: number; warnings: number };
  invariants: AuditInvariant[];
  shardHealth: {
    total: number;
    healthy: number;
    repairing: number;
    violating: number;
    healthScore: number;
  };
  mergeHistory: {
    total: number;
    applied: number;
    rejected: number;
    successRate: number;
    recent: { status: string; divergence: number; iterations: number; violations: string[]; createdAt: string }[];
  };
  ancestry: {
    proofKind: string | null;
    zkEnabled: boolean;
    totalProofs: number;
    zkProofs: number;
    anchored: number;
  };
  shadowBridge: {
    enabled: boolean;
    takeoverLatencyMs: number | null;
    recentEvents: number;
    authoritative: boolean;
  };
  violations: {
    invariant: string;
    severity: string;
    soft: boolean;
    shardKey: string;
    repaired: boolean;
    driftDelta: number;
    createdAt: string;
  }[];
  wasmFingerprint: string | null;
  compiledAt: string;
}

interface AuditReport {
  generatedAt: string;
  reportId: string;
  scope: string;
  summary: {
    policyCount: number;
    totalShards: number;
    totalInvariants: number;
    totalMerges: number;
    totalViolations: number;
    totalProofs: number;
    zkPolicies: number;
    shadowEnabledPolicies: number;
  };
  policies: AuditPolicy[];
  compliance: {
    formalVerification: boolean;
    zkAnchored: number;
    shadowReady: number;
    zeroUnrepairedCriticalViolations: boolean;
    allShardsHealthy: boolean;
  };
}

export function AuditReportsSection() {
  const { toast } = useToast();
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [scopePolicy, setScopePolicy] = useState<string>("all");
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = scopePolicy !== "all" ? `?policyId=${scopePolicy}` : "";
      const r = await fetch(`/api/audit${qs}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: AuditReport = await r.json();
      setReport(d);
      setExpandedPolicy(d.policies[0]?.id ?? null);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [scopePolicy]);

  useEffect(() => {
    fetch("/api/policies")
      .then((r) => r.json())
      .then((d) => setPolicies(d.policies ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const downloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.reportId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Report downloaded", description: `${report.reportId}.json` });
  };

  const copyReport = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      toast({ title: "Report copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const downloadCsv = () => {
    if (!report) return;
    const rows: string[][] = [
      ["Policy", "Domain", "Version", "Invariants", "Shards", "Shard Health %", "Merges Applied", "Merges Rejected", "Violations", "ZK Proofs", "Total Proofs", "Shadow Enabled", "Wasm Fingerprint", "Compiled At"],
    ];
    for (const p of report.policies) {
      rows.push([
        p.name,
        p.domain ?? "",
        p.version ?? "",
        String(p.invariants.length),
        String(p.shardHealth.total),
        String(p.shardHealth.healthScore),
        String(p.mergeHistory.applied),
        String(p.mergeHistory.rejected),
        String(p.violations.length),
        String(p.ancestry.zkProofs),
        String(p.ancestry.totalProofs),
        String(p.shadowBridge.enabled),
        p.wasmFingerprint ?? "",
        new Date(p.compiledAt).toISOString(),
      ]);
    }
    const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.reportId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported", description: `${report.reportId}.csv` });
  };

  const printReport = () => {
    window.print();
  };

  if (loading || !report) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const complianceItems = [
    {
      label: "Formal verification",
      passed: report.compliance.formalVerification,
      detail: "All policies parse & validate",
      icon: FileCheck2,
    },
    {
      label: "ZK-anchored policies",
      passed: report.compliance.zkAnchored > 0,
      detail: `${report.compliance.zkAnchored} policies with ZK proofs`,
      icon: Lock,
    },
    {
      label: "Shadow-ready",
      passed: report.compliance.shadowReady > 0,
      detail: `${report.compliance.shadowReady} policies with shadow bridge`,
      icon: Cpu,
    },
    {
      label: "No unrepaired critical violations",
      passed: report.compliance.zeroUnrepairedCriticalViolations,
      detail: report.compliance.zeroUnrepairedCriticalViolations
        ? "All critical violations repaired"
        : "Unrepaired critical violations exist",
      icon: AlertTriangle,
    },
    {
      label: "All shards healthy",
      passed: report.compliance.allShardsHealthy,
      detail: report.compliance.allShardsHealthy
        ? "Every shard satisfies its invariants"
        : "Some shards are repairing/violating",
      icon: ShieldCheck,
    },
  ];

  return (
    <section className="space-y-4">
      {/* Header */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-verified/30 bg-verified/10 shrink-0">
            <FileText className="h-5 w-5 text-verified" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold flex items-center gap-2">
              Audit Reports
              <Badge variant="outline" className="border-verified/30 bg-verified/10 text-verified text-[9px] font-mono">
                {report.reportId}
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Exportable compliance report — regulators can remotely audit the possible futures of the system without touching the live runtime.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={scopePolicy} onValueChange={setScopePolicy}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All policies (global)</SelectItem>
                {policies.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8" onClick={copyReport}>
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={downloadCsv}>
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> CSV
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={printReport}>
              <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
            </Button>
            <Button size="sm" className="h-8 bg-verified/90 hover:bg-verified text-primary-foreground" onClick={downloadJson}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> JSON
            </Button>
          </div>
        </div>
      </Card>

      {/* Compliance signals */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid-fine absolute inset-0 opacity-20" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="h-4 w-4 text-verified" />
            <h3 className="text-sm font-semibold">Compliance signals</h3>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">
              generated {new Date(report.generatedAt).toLocaleString()}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {complianceItems.map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.label}
                  className={cn(
                    "rounded-md border p-2.5",
                    c.passed
                      ? "border-verified/30 bg-verified/5"
                      : "border-violating/30 bg-violating/5",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn("h-3.5 w-3.5", c.passed ? "text-verified" : "text-violating")} />
                    {c.passed ? (
                      <CheckCircle2 className="h-3 w-3 text-verified ml-auto" />
                    ) : (
                      <XCircle className="h-3 w-3 text-violating ml-auto" />
                    )}
                  </div>
                  <p className={cn("text-[11px] font-medium mt-1.5", c.passed ? "text-verified" : "text-violating")}>
                    {c.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{c.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <SummaryStat icon={GitBranch} label="Policies" value={report.summary.policyCount} />
        <SummaryStat icon={Cpu} label="Shards" value={report.summary.totalShards} />
        <SummaryStat icon={FileCheck2} label="Invariants" value={report.summary.totalInvariants} />
        <SummaryStat icon={GitBranch} label="Merges" value={report.summary.totalMerges} />
        <SummaryStat icon={AlertTriangle} label="Violations" value={report.summary.totalViolations} accent="violating" />
        <SummaryStat icon={KeyRound} label="Proofs" value={report.summary.totalProofs} />
        <SummaryStat icon={Lock} label="ZK policies" value={report.summary.zkPolicies} accent="verified" />
        <SummaryStat icon={Cpu} label="Shadow" value={report.summary.shadowEnabledPolicies} accent="repairing" />
      </div>

      {/* Per-policy report cards */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <FileText className="h-4 w-4 text-repairing" />
          <span className="text-sm font-semibold">Policy audit trail</span>
          <span className="text-xs text-muted-foreground">· {report.policies.length} policies</span>
        </div>
        <div className="space-y-2">
          {report.policies.map((p) => (
            <PolicyAuditCard
              key={p.id}
              policy={p}
              expanded={expandedPolicy === p.id}
              onToggle={() => setExpandedPolicy(expandedPolicy === p.id ? null : p.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PolicyAuditCard({
  policy,
  expanded,
  onToggle,
}: {
  policy: AuditPolicy;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className={cn("bg-card/60 backdrop-blur border p-0 relative overflow-hidden transition-colors", expanded ? "border-verified/30" : "border-border/60")}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className={cn("h-7 w-7 rounded-md flex items-center justify-center shrink-0", policy.ok ? "bg-verified/10 text-verified" : "bg-violating/10 text-violating")}>
            {policy.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
          </div>
          <span className="text-sm font-medium">{policy.name}</span>
          {policy.domain && (
            <Badge variant="outline" className="text-[9px] font-mono border-border/60">
              {policy.domain}
            </Badge>
          )}
          {policy.version && (
            <span className="text-[10px] text-muted-foreground font-mono">v{policy.version}</span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <Badge variant="outline" className={cn("text-[9px]", policy.shardHealth.healthScore >= 85 ? "border-verified/30 bg-verified/10 text-verified" : policy.shardHealth.healthScore >= 60 ? "border-repairing/30 bg-repairing/10 text-repairing" : "border-violating/30 bg-violating/10 text-violating")}>
              {policy.shardHealth.healthScore}% health
            </Badge>
            {policy.ancestry.zkEnabled && (
              <Badge variant="outline" className="text-[9px] border-verified/30 bg-verified/10 text-verified">
                <Lock className="h-2.5 w-2.5 mr-0.5" /> ZK
              </Badge>
            )}
            {policy.shadowBridge.enabled && (
              <Badge variant="outline" className="text-[9px] border-repairing/30 bg-repairing/10 text-repairing">
                <Cpu className="h-2.5 w-2.5 mr-0.5" /> shadow
              </Badge>
            )}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border/60 p-3 space-y-3 bg-muted/10">
          {/* Description */}
          {policy.description && (
            <p className="text-xs text-muted-foreground italic">{policy.description}</p>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatBox label="Shards" value={`${policy.shardHealth.healthy}/${policy.shardHealth.total} healthy`} accent={policy.shardHealth.violating > 0 ? "violating" : "verified"} />
            <StatBox label="Merges" value={`${policy.mergeHistory.applied}/${policy.mergeHistory.total} applied`} accent={policy.mergeHistory.rejected > 0 ? "repairing" : "verified"} />
            <StatBox label="Proofs" value={`${policy.ancestry.zkProofs}/${policy.ancestry.totalProofs} ZK`} accent="verified" />
            <StatBox label="Violations" value={String(policy.violations.length)} accent={policy.violations.length > 0 ? "violating" : "verified"} />
          </div>

          {/* Invariants */}
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Compiled invariants ({policy.invariants.length})</div>
            <div className="space-y-1">
              {policy.invariants.map((inv) => (
                <div key={inv.name} className="flex items-center gap-2 rounded border border-border/40 bg-background/40 px-2 py-1">
                  <span className={cn("h-1.5 w-1.5 rounded-full", inv.severity === "critical" ? "bg-violating" : inv.severity === "high" ? "bg-repairing" : "bg-quarantined")} />
                  <span className="font-mono text-[11px] font-medium">{inv.name}</span>
                  <span className="text-[9px] uppercase text-muted-foreground">{inv.severity}{inv.soft && " · soft"}</span>
                  <span className="font-mono text-[10px] text-muted-foreground truncate ml-auto">{inv.predicate}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Violations */}
          {policy.violations.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Drift violations ({policy.violations.length})</div>
              <div className="space-y-1 max-h-[140px] overflow-y-auto">
                {policy.violations.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border border-border/40 bg-background/40 px-2 py-1 text-[11px]">
                    <span className={cn("h-1.5 w-1.5 rounded-full", v.severity === "critical" ? "bg-violating" : v.severity === "high" ? "bg-repairing" : "bg-quarantined")} />
                    <span className="font-mono">{v.invariant}</span>
                    <span className="text-muted-foreground">· {v.shardKey}</span>
                    {v.repaired ? (
                      <Badge variant="outline" className="text-[9px] border-verified/30 bg-verified/10 text-verified ml-auto">repaired</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] border-violating/30 bg-violating/10 text-violating ml-auto">unrepaired</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <Separator className="bg-border/40" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span>wasm fingerprint: {policy.wasmFingerprint ?? "—"}</span>
            <span>compiled: {new Date(policy.compiledAt).toLocaleDateString()}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof GitBranch;
  label: string;
  value: number;
  accent?: "verified" | "repairing" | "violating";
}) {
  const color =
    accent === "verified"
      ? "text-verified"
      : accent === "repairing"
        ? "text-repairing"
        : accent === "violating"
          ? "text-violating"
          : "text-foreground";
  return (
    <Card className="bg-card/60 backdrop-blur border-border/60 p-2.5 relative overflow-hidden">
      <div className="bg-grid-fine absolute inset-0 opacity-20" />
      <div className="relative">
        <Icon className={cn("h-3.5 w-3.5", color)} />
        <div className={cn("text-lg font-semibold tabular-nums leading-none mt-1", color)}>{value}</div>
        <div className="text-[9px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</div>
      </div>
    </Card>
  );
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "verified" | "repairing" | "violating";
}) {
  const color =
    accent === "verified" ? "text-verified" : accent === "repairing" ? "text-repairing" : "text-violating";
  return (
    <div className="rounded border border-border/40 bg-background/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-xs font-mono font-medium mt-0.5", color)}>{value}</div>
    </div>
  );
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
