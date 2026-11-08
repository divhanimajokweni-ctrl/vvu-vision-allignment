"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GitMerge,
  Wrench,
  Play,
  RotateCw,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  KeyRound,
  Clock,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { PolicyRow, MergeRow } from "@/lib/types";
import { StatusPill, Hash, SeverityBadge } from "./primitives";

const POLL_MS = 10_000;
const DEFAULT_PROPOSED = `{
  "frequency": 50.6,
  "thermal_headroom": 6,
  "generation": [420, 380, 510, 290, 600, 470],
  "load": [410, 375, 500, 285, 590, 460],
  "losses": 12
}`;

interface AppliedRepair {
  field: string;
  from: unknown;
  to: unknown;
}
interface RepairResult {
  ok: boolean;
  repairedState: Record<string, unknown> | null;
  violations: string[];
  divergence: number;
  iterations: number;
  applied: AppliedRepair[];
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtVal(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Visualize a single applied repair: field: from → to */
function AppliedDiff({ repair }: { repair: AppliedRepair }) {
  const delta =
    typeof repair.from === "number" && typeof repair.to === "number"
      ? repair.to - repair.from
      : null;
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-muted/20 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-foreground">{repair.field}</span>
        {delta !== null && (
          <Badge
            variant="outline"
            className={cn(
              "border-border/60 font-mono text-[10px]",
              delta > 0 ? "text-verified" : delta < 0 ? "text-repairing" : "text-muted-foreground",
            )}
          >
            {delta > 0 ? "+" : ""}
            {delta.toFixed(3)}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="font-mono text-violating line-through/60 decoration-violating/50">
          {fmtVal(repair.from)}
        </span>
        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="font-mono text-verified">{fmtVal(repair.to)}</span>
      </div>
    </div>
  );
}

function RepairVisualization({
  repair,
  mergeId,
  onRerun,
  rerunning,
}: {
  repair: RepairResult;
  mergeId?: string;
  onRerun?: () => void;
  rerunning?: boolean;
}) {
  return (
    <Card
      className={cn(
        "bg-card/60 backdrop-blur border p-4 relative overflow-hidden",
        repair.ok ? "border-verified/30" : "border-violating/30",
        repair.ok ? "glow-verified" : "glow-violating",
      )}
    >
      <div className="bg-grid-fine absolute inset-0 opacity-20" />
      <div className="relative space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wrench className={cn("h-4 w-4", repair.ok ? "text-verified" : "text-violating")} />
            <span className="text-sm font-semibold text-foreground">Self-repair result</span>
          </div>
          <StatusPill status={repair.ok ? "applied" : "rejected"} label={repair.ok ? "Repaired" : "Unresolved"} />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border border-border/60 bg-muted/20 p-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Divergence</div>
            <div className="mt-0.5 font-mono text-sm text-foreground">
              {repair.divergence.toFixed(4)}
            </div>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 p-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Iterations</div>
            <div className="mt-0.5 font-mono text-sm text-foreground">{repair.iterations}</div>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 p-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Applied</div>
            <div className="mt-0.5 font-mono text-sm text-foreground">{repair.applied.length}</div>
          </div>
        </div>

        {repair.applied.length > 0 && (
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              Field transformations
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {repair.applied.map((a, i) => (
                <AppliedDiff key={`${a.field}-${i}`} repair={a} />
              ))}
            </div>
          </div>
        )}

        {repair.violations.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-violating">
              <AlertTriangle className="h-3 w-3" />
              Unresolved violations ({repair.violations.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {repair.violations.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 rounded border border-violating/40 bg-violating/10 px-2 py-0.5 text-[11px] font-mono text-violating"
                >
                  <XCircle className="h-3 w-3" />
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}

        {mergeId && onRerun && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRerun}
            disabled={rerunning}
            className="w-full border-border/60 bg-card/40"
          >
            <RotateCw className={cn("h-3.5 w-3.5", rerunning && "animate-spin")} />
            {rerunning ? "Re-running…" : "Re-run repair"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function MergeItem({
  merge,
  defaultOpen,
}: {
  merge: MergeRow;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card
        className={cn(
          "bg-card/60 backdrop-blur border-border/60 p-0 relative overflow-hidden transition-colors",
          open && "border-verified/30",
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="relative w-full text-left p-3 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {open ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="truncate text-sm font-medium text-foreground">
                    {merge.policy.name}
                  </span>
                  <StatusPill status={merge.status} />
                </div>
                <div className="mt-1 flex items-center gap-1.5 pl-6 text-[11px] text-muted-foreground">
                  <span className="font-mono">{merge.sourceShardName}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-mono">{merge.targetShard}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[10px] text-muted-foreground">{fmtRelative(merge.createdAt)}</span>
                {merge.zkProof && (
                  <Badge variant="outline" className="border-verified/30 bg-verified/10 text-verified text-[10px]">
                    <KeyRound className="h-2.5 w-2.5" /> ZK
                  </Badge>
                )}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3 pl-6 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="uppercase tracking-wide">div</span>
                <span className="font-mono text-foreground">{merge.divergence.toFixed(3)}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="uppercase tracking-wide">iters</span>
                <span className="font-mono text-foreground">{merge.iterations}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="uppercase tracking-wide">mmr</span>
                <Hash value={merge.mmrProof} length={10} />
              </span>
              {merge.violations.length > 0 && (
                <span className="flex items-center gap-1 text-violating">
                  <XCircle className="h-2.5 w-2.5" />
                  {merge.violations.length} violation{merge.violations.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border/60 p-3 space-y-3 bg-muted/10">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Proposed state
                </div>
                <pre className="codeblock max-h-64 overflow-y-auto epistemic-scroll rounded-md border border-border/60 bg-background/60 p-2.5 text-[11px] leading-relaxed text-foreground/90">
{JSON.stringify(merge.proposedState, null, 2)}
                </pre>
              </div>
              <div>
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Repaired state {merge.repairedState ? "" : "(none)"}
                </div>
                <pre className="codeblock max-h-64 overflow-y-auto epistemic-scroll rounded-md border border-border/60 bg-background/60 p-2.5 text-[11px] leading-relaxed text-foreground/90">
{merge.repairedState ? JSON.stringify(merge.repairedState, null, 2) : "— no repair applied —"}
                </pre>
              </div>
            </div>
            {merge.violations.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-violating">
                  Violations
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {merge.violations.map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1 rounded border border-violating/40 bg-violating/10 px-2 py-0.5 text-[11px] font-mono text-violating"
                    >
                      <XCircle className="h-3 w-3" />
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(merge.createdAt).toLocaleString()}
              </span>
              {merge.zkProof && (
                <span className="flex items-center gap-1 font-mono text-verified">
                  <KeyRound className="h-3 w-3" />
                  {merge.zkProof}
                </span>
              )}
              <span className="font-mono">merge id: {merge.id}</span>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function MergeReconciliationSection() {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [merges, setMerges] = useState<MergeRow[]>([]);
  const [loadingMerges, setLoadingMerges] = useState(true);

  // Composer state.
  const [policyId, setPolicyId] = useState<string>("");
  const [proposedText, setProposedText] = useState(DEFAULT_PROPOSED);
  const [submitting, setSubmitting] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [lastResult, setLastResult] = useState<{
    mergeId: string;
    repair: RepairResult;
  } | null>(null);

  // Load policies once.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/policies")
      .then((r) => r.json())
      .then((d: { policies: PolicyRow[] }) => {
        if (cancelled) return;
        const ps = d.policies ?? [];
        setPolicies(ps);
        if (ps.length > 0 && !policyId) setPolicyId(ps[0].id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMerges = useCallback(async () => {
    try {
      const r = await fetch("/api/merges");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: { merges: MergeRow[] } = await r.json();
      setMerges(d.merges ?? []);
    } catch (e) {
      toast({
        title: "Failed to load merges",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoadingMerges(false);
    }
  }, [toast]);

  useEffect(() => {
    loadMerges();
    const t = setInterval(loadMerges, POLL_MS);
    return () => clearInterval(t);
  }, [loadMerges]);

  const runRepair = useCallback(async () => {
    if (!policyId) {
      toast({ title: "Select a policy first", variant: "destructive" });
      return;
    }
    let proposed: Record<string, unknown>;
    try {
      proposed = JSON.parse(proposedText);
    } catch (e) {
      toast({
        title: "Invalid JSON",
        description: e instanceof Error ? e.message : "Parse error",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/merges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId,
          sourceShardName: "manual",
          targetShard: "default",
          proposedState: proposed,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const mergeId: string = d.merge?.id;
      const repair: RepairResult = d.repair;
      setLastResult({ mergeId, repair });
      toast({
        title: repair.ok ? "Self-repair succeeded" : "Self-repair unresolved",
        description: repair.ok
          ? `Applied ${repair.applied.length} field fix(es) · divergence ${repair.divergence.toFixed(3)}`
          : `${repair.violations.length} invariant(s) still violating`,
        variant: repair.ok ? "default" : "destructive",
      });
      loadMerges();
    } catch (e) {
      toast({
        title: "Repair request failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }, [policyId, proposedText, toast, loadMerges]);

  const rerun = useCallback(async () => {
    if (!lastResult?.mergeId) return;
    setRerunning(true);
    try {
      const r = await fetch("/api/merges/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mergeId: lastResult.mergeId }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const repair: RepairResult = d.repair;
      setLastResult((prev) => (prev ? { ...prev, repair } : prev));
      toast({
        title: repair.ok ? "Re-run succeeded" : "Re-run unresolved",
        description: `divergence ${repair.divergence.toFixed(3)} · ${repair.applied.length} applied`,
        variant: repair.ok ? "default" : "destructive",
      });
      loadMerges();
    } catch (e) {
      toast({
        title: "Re-run failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRerunning(false);
    }
  }, [lastResult, toast, loadMerges]);

  const recentMerges = useMemo(() => merges.slice(0, 12), [merges]);

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-repairing/30 bg-repairing/10">
          <GitMerge className="h-4.5 w-4.5 text-repairing" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Self-Repairing Merge Reconciliation</h2>
          <p className="text-xs text-muted-foreground">
            Propose a state merge · invariant enforcer self-heals to least-divergent fix
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* LEFT — existing merges */}
        <div className="space-y-3">
          <Card className="bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-20" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Recent proposals</span>
                <Badge variant="outline" className="border-border/60 text-[10px]">
                  {merges.length}
                </Badge>
              </div>
              <span className="text-[10px] text-muted-foreground">click to expand</span>
            </div>
          </Card>

          {loadingMerges ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg bg-muted/40" />
              ))}
            </div>
          ) : recentMerges.length === 0 ? (
            <Card className="bg-card/60 border-border/60 p-8 text-center">
              <Wrench className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No merge proposals yet.</p>
              <p className="text-xs text-muted-foreground/70">
                Use the composer to propose one →
              </p>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[640px] overflow-y-auto epistemic-scroll pr-1">
              {recentMerges.map((m) => (
                <MergeItem key={m.id} merge={m} />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — composer */}
        <div className="space-y-3">
          <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-20" />
            <div className="relative space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-repairing" />
                  <span className="text-sm font-semibold text-foreground">Propose merge</span>
                </div>
                <Badge variant="outline" className="border-repairing/30 bg-repairing/10 text-repairing text-[10px]">
                  self_repair
                </Badge>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Target policy
                </label>
                <Select value={policyId} onValueChange={setPolicyId}>
                  <SelectTrigger className="bg-card/60">
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
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Proposed state (JSON)
                </label>
                <Textarea
                  value={proposedText}
                  onChange={(e) => setProposedText(e.target.value)}
                  className="font-mono text-xs bg-background/60 min-h-[180px] epistemic-scroll"
                  spellCheck={false}
                />
                <p className="text-[10px] text-muted-foreground">
                  Prefilled with a violating example — <span className="font-mono">frequency:50.6</span> breaches{" "}
                  <span className="font-mono">freq_bounds [49.8, 50.2]</span>.
                </p>
              </div>

              <Button
                onClick={runRepair}
                disabled={submitting || !policyId}
                className="w-full bg-repairing/15 border border-repairing/40 text-repairing hover:bg-repairing/25"
                variant="outline"
              >
                {submitting ? (
                  <RotateCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {submitting ? "Running self-repair…" : "Run self-repair"}
              </Button>
            </div>
          </Card>

          {lastResult ? (
            <RepairVisualization
              repair={lastResult.repair}
              mergeId={lastResult.mergeId}
              onRerun={rerun}
              rerunning={rerunning}
            />
          ) : (
            <Card className="bg-card/40 border-dashed border-border/60 p-6 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">
                No repair run yet — propose a merge to see the diff.
              </p>
              <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-verified" />
                <span>passed</span>
                <XCircle className="h-3 w-3 text-violating" />
                <span>violated</span>
              </div>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
