"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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

interface TestCase {
  id: string;
  invariantName: string;
  severity: string;
  soft: boolean;
  description: string;
  state: Record<string, unknown>;
  expectedPass: boolean;
  actualPass: boolean;
  actualValue?: string;
  status: "pass" | "fail" | "error";
  durationMs: number;
}

interface TestSuiteResult {
  policyId: string;
  policyName: string;
  total: number;
  passed: number;
  failed: number;
  errored: number;
  passRate: number;
  durationMs: number;
  cases: TestCase[];
  generatedAt: string;
}

const STATUS_META: Record<
  TestCase["status"],
  { icon: typeof CheckCircle2; color: string; bg: string; border: string; label: string }
> = {
  pass: { icon: CheckCircle2, color: "text-verified", bg: "bg-verified/10", border: "border-verified/30", label: "PASS" },
  fail: { icon: XCircle, color: "text-violating", bg: "bg-violating/10", border: "border-violating/30", label: "FAIL" },
  error: { icon: AlertTriangle, color: "text-repairing", bg: "bg-repairing/10", border: "border-repairing/30", label: "ERROR" },
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-violating",
  high: "text-repairing",
  medium: "text-quarantined",
  low: "text-muted-foreground",
};

export function TestSuiteSection() {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [policyId, setPolicyId] = useState<string>("");
  const [result, setResult] = useState<TestSuiteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "pass" | "fail" | "error">("all");

  useEffect(() => {
    fetch("/api/policies")
      .then((r) => r.json())
      .then((d) => {
        setPolicies(d.policies ?? []);
        if (d.policies?.[0]) setPolicyId(d.policies[0].id);
      })
      .catch(() => {});
  }, []);

  const run = useCallback(async () => {
    if (!policyId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/test-suite?policyId=${policyId}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: TestSuiteResult = await r.json();
      setResult(d);
      setExpanded(new Set());
      toast({
        title: "Test suite complete",
        description: `${d.passed}/${d.total} passed · ${d.passRate}% pass rate`,
      });
    } catch (e) {
      toast({ title: "Test suite failed", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [policyId, toast]);

  useEffect(() => {
    if (policyId) run();
  }, [run]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredCases = result
    ? result.cases.filter((c) => filter === "all" || c.status === filter)
    : [];

  return (
    <section className="space-y-4">
      {/* Header */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-verified/30 bg-verified/10 shrink-0">
            <FlaskConical className="h-5 w-5 text-verified" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold flex items-center gap-2">
              Invariant Test Suite
              {result && (
                <Badge variant="outline" className="text-[9px] font-mono border-border/60">
                  {result.total} cases
                </Badge>
              )}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Auto-generate test cases against each invariant — nominal, boundary, and violation states — then run them live.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={policyId} onValueChange={setPolicyId}>
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue placeholder="Select policy" />
              </SelectTrigger>
              <SelectContent>
                {policies.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8 bg-verified/90 hover:bg-verified text-primary-foreground"
              onClick={run}
              disabled={loading}
            >
              {loading ? (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 mr-1.5" />
              )}
              Run suite
            </Button>
          </div>
        </div>
      </Card>

      {loading && !result ? (
        <Skeleton className="h-64 w-full" />
      ) : result ? (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <SummaryCard label="Total" value={result.total} icon={FlaskConical} />
            <SummaryCard label="Passed" value={result.passed} icon={CheckCircle2} accent="verified" />
            <SummaryCard label="Failed" value={result.failed} icon={XCircle} accent="violating" />
            <SummaryCard label="Errors" value={result.errored} icon={AlertTriangle} accent="repairing" />
            <Card className="bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
              <div className="bg-grid-fine absolute inset-0 opacity-20" />
              <div className="relative">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Pass rate</div>
                <div className={cn(
                  "text-xl font-semibold tabular-nums mt-0.5",
                  result.passRate >= 80 ? "text-verified" : result.passRate >= 50 ? "text-repairing" : "text-violating",
                )}>
                  {result.passRate}%
                </div>
                <Progress
                  value={result.passRate}
                  className={cn(
                    "h-1 mt-1.5",
                    result.passRate >= 80 ? "[&>div]:bg-verified" : result.passRate >= 50 ? "[&>div]:bg-repairing" : "[&>div]:bg-violating",
                  )}
                />
                <div className="text-[9px] text-muted-foreground mt-1 font-mono">
                  {result.durationMs}ms
                </div>
              </div>
            </Card>
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground mr-1">filter:</span>
            {(["all", "pass", "fail", "error"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors",
                  filter === f
                    ? f === "pass"
                      ? "border-verified/40 bg-verified/10 text-verified"
                      : f === "fail"
                        ? "border-violating/40 bg-violating/10 text-violating"
                        : f === "error"
                          ? "border-repairing/40 bg-repairing/10 text-repairing"
                          : "border-border bg-muted/40 text-foreground"
                    : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {f}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">
              {filteredCases.length} of {result.cases.length} shown
            </span>
          </div>

          {/* Test cases */}
          <Card className="bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-20" />
            <div className="relative space-y-1.5">
              {filteredCases.map((tc) => {
                const m = STATUS_META[tc.status];
                const Icon = m.icon;
                const isExpanded = expanded.has(tc.id);
                return (
                  <div
                    key={tc.id}
                    className={cn("rounded-md border", m.border, m.bg)}
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpand(tc.id)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <Icon className={cn("h-4 w-4 shrink-0", m.color)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-medium">{tc.invariantName}</span>
                          <span className={cn("text-[9px] uppercase font-semibold", SEVERITY_COLOR[tc.severity])}>
                            {tc.severity}
                          </span>
                          {tc.soft && (
                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-quarantined/30 text-quarantined">
                              soft
                            </Badge>
                          )}
                          <span className={cn("text-[9px] uppercase font-bold ml-1", m.color)}>
                            {m.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">{tc.description}</div>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {tc.durationMs}ms
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-border/40 px-2.5 py-2 space-y-1.5 bg-background/30">
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-muted-foreground">Expected: </span>
                            <span className={cn("font-mono font-medium", tc.expectedPass ? "text-verified" : "text-violating")}>
                              {tc.expectedPass ? "pass" : "fail"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Actual: </span>
                            <span className={cn("font-mono font-medium", tc.actualPass ? "text-verified" : "text-violating")}>
                              {tc.actualPass ? "pass" : "fail"}
                            </span>
                          </div>
                        </div>
                        {tc.actualValue && (
                          <div className="text-[11px]">
                            <span className="text-muted-foreground">Value: </span>
                            <span className="font-mono text-foreground">{tc.actualValue}</span>
                          </div>
                        )}
                        <div>
                          <div className="text-[10px] text-muted-foreground mb-0.5">Test state:</div>
                          <pre className="codeblock rounded border border-border/40 bg-background/60 p-1.5 text-[10px] overflow-x-auto">
                            {JSON.stringify(tc.state, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredCases.length === 0 && (
                <p className="text-sm text-muted-foreground italic py-4 text-center">
                  No test cases match the filter.
                </p>
              )}
            </div>
          </Card>
        </>
      ) : (
        <Card className="bg-card/60 border-dashed border-border/60 p-8 text-center">
          <FlaskConical className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">Select a policy and run the suite.</p>
        </Card>
      )}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof CheckCircle2;
  accent?: "verified" | "violating" | "repairing";
}) {
  const color =
    accent === "verified"
      ? "text-verified"
      : accent === "violating"
        ? "text-violating"
        : accent === "repairing"
          ? "text-repairing"
          : "text-foreground";
  return (
    <Card className="bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
      <div className="bg-grid-fine absolute inset-0 opacity-20" />
      <div className="relative flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-md bg-background/60 flex items-center justify-center shrink-0">
          <Icon className={cn("h-4 w-4", color)} />
        </div>
        <div>
          <div className={cn("text-xl font-semibold tabular-nums leading-none", color)}>{value}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</div>
        </div>
      </div>
    </Card>
  );
}
