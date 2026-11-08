"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Pickaxe,
  Check,
  X,
  TrendingUp,
  Activity,
  Brain,
  BarChart3,
  ShieldCheck,
  AlertTriangle,
  Clock,
  RotateCw,
  Gauge,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { PolicyRow, MinedInvariantRow, Severity, StatsResponse } from "@/lib/types";
import { StatusPill, SeverityBadge } from "./primitives";

const POLL_MS = 12_000;

interface DriftSummary {
  total: number;
  byInvariant: Record<string, number>;
  bySeverity: Record<string, number>;
  byPolicy: Record<string, number>;
  sampleFields: string[];
}

function fmtRelative(iso: string | null | undefined): string {
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

function isStatistical(rationale: string): boolean {
  return rationale.trim().toLowerCase().startsWith("statistical");
}

/** Confidence meter — color shifts with confidence band. */
function ConfidenceMeter({
  confidence,
  accepted,
}: {
  confidence: number;
  accepted: boolean;
}) {
  const pct = Math.round(confidence * 100);
  const band =
    confidence >= 0.8 ? "verified" : confidence >= 0.6 ? "repairing" : "muted";
  const barColor =
    band === "verified"
      ? "bg-verified"
      : band === "repairing"
        ? "bg-repairing"
        : "bg-muted-foreground/60";
  const textColor =
    band === "verified"
      ? "text-verified"
      : band === "repairing"
        ? "text-repairing"
        : "text-muted-foreground";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="uppercase tracking-wide text-muted-foreground">confidence</span>
        <span className={cn("font-mono tabular-nums", textColor, accepted && "text-verified")}>
          {pct}%
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
        <div
          className={cn("h-full rounded-full transition-all", barColor, accepted && "bg-verified")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CandidateCard({
  candidate,
  policyName,
  onAccept,
  onReject,
  busy,
}: {
  candidate: MinedInvariantRow;
  policyName: string;
  onAccept: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const statistical = isStatistical(candidate.rationale);
  return (
    <Card
      className={cn(
        "bg-card/60 backdrop-blur border-border/60 p-3.5 relative overflow-hidden transition-colors",
        candidate.accepted ? "border-verified/30 glow-verified" : "hover:border-border",
      )}
    >
      <div className="bg-grid-fine absolute inset-0 opacity-20 pointer-events-none" />
      <div className="relative space-y-2.5">
        {/* Header: badges + timestamp */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <SeverityBadge severity={candidate.severity as Severity} />
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] gap-0.5",
                statistical
                  ? "border-repairing/30 bg-repairing/10 text-repairing"
                  : "border-verified/30 bg-verified/10 text-verified",
              )}
            >
              {statistical ? (
                <>
                  <BarChart3 className="h-2.5 w-2.5" /> statistical
                </>
              ) : (
                <>
                  <Sparkles className="h-2.5 w-2.5" /> AI-mined
                </>
              )}
            </Badge>
            {candidate.accepted && <StatusPill status="verified" label="Hardened" />}
          </div>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {fmtRelative(candidate.createdAt)}
          </span>
        </div>

        {/* Predicate (prominent mono code block) */}
        <pre className="codeblock rounded-md border border-border/60 bg-background/60 p-2.5 text-verified overflow-x-auto">
{candidate.predicate}
        </pre>

        {/* Rationale */}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {candidate.rationale}
        </p>

        {/* Confidence meter */}
        <ConfidenceMeter confidence={candidate.confidence} accepted={candidate.accepted} />

        <Separator className="bg-border/40" />

        {/* Footer: policy + actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              <span className="font-mono">{policyName}</span>
            </span>
          </div>
          {candidate.accepted ? (
            <Badge variant="outline" className="border-verified/30 bg-verified/10 text-verified text-[10px] gap-0.5">
              <Check className="h-2.5 w-2.5" /> hardened into enforcer
            </Badge>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={onReject}
                disabled={busy}
                className="h-7 border-violating/40 bg-violating/10 text-violating hover:bg-violating/20 px-2"
              >
                <X className="h-3 w-3" />
                Reject
              </Button>
              <Button
                size="sm"
                onClick={onAccept}
                disabled={busy}
                className="h-7 border border-verified/40 bg-verified/15 text-verified hover:bg-verified/25 px-2.5"
                variant="outline"
              >
                <Check className="h-3 w-3" />
                Accept
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function InvariantMinerSection() {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [mined, setMined] = useState<MinedInvariantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [filterPolicyId, setFilterPolicyId] = useState<string>("all");
  const [mining, setMining] = useState(false);
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [driftSummary, setDriftSummary] = useState<DriftSummary | null>(null);
  const [llmUsed, setLlmUsed] = useState<boolean | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);

  const policyMap = useMemo(() => {
    const m: Record<string, PolicyRow> = {};
    for (const p of policies) m[p.id] = p;
    return m;
  }, [policies]);

  const policyName = (id: string | null, fallback?: string | null) =>
    fallback ?? (id ? policyMap[id]?.name ?? "global" : "global");

  // Load policies once.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/policies")
      .then((r) => r.json())
      .then((d: { policies: PolicyRow[] }) => {
        if (cancelled) return;
        setPolicies(d.policies ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Load stats for drift telemetry panel.
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/stats")
        .then((r) => r.json())
        .then((d: StatsResponse) => {
          if (cancelled) return;
          setStats(d);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const loadMined = useCallback(async () => {
    try {
      const url =
        filterPolicyId && filterPolicyId !== "all"
          ? `/api/miner?policyId=${encodeURIComponent(filterPolicyId)}`
          : "/api/miner";
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: { mined: MinedInvariantRow[] } = await r.json();
      setMined(d.mined ?? []);
      setFetchError(false);
    } catch {
      // The /api/miner GET route currently 500s (Prisma include mismatch on a
      // model with no policy relation). Keep whatever we have rather than
      // blanking the list — mining will repopulate. Surface a subtle flag.
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [filterPolicyId]);

  useEffect(() => {
    setLoading(true);
    loadMined();
    const t = setInterval(loadMined, POLL_MS);
    return () => clearInterval(t);
  }, [loadMined]);

  const mine = useCallback(async () => {
    setMining(true);
    try {
      const body: { policyId?: string; useLLM: boolean } = { useLLM: true };
      if (filterPolicyId && filterPolicyId !== "all") body.policyId = filterPolicyId;
      const r = await fetch("/api/miner/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: { mined: MinedInvariantRow[]; llmUsed: boolean; driftSummary: DriftSummary } =
        await r.json();
      const fresh = d.mined ?? [];
      setLlmUsed(d.llmUsed);
      setDriftSummary(d.driftSummary ?? null);
      setMined((prev) => {
        // Merge: prepend new candidates, dedupe by id.
        const seen = new Set(prev.map((m) => m.id));
        const merged = [...fresh.filter((m) => !seen.has(m.id)), ...prev];
        return merged.sort((a, b) => b.confidence - a.confidence);
      });
      setFetchError(false);
      toast({
        title: `Mined ${fresh.length} candidate${fresh.length === 1 ? "" : "s"}`,
        description: d.llmUsed
          ? "LLM augmented the statistical drift baseline."
          : "Statistical fallback only (LLM unavailable).",
      });
    } catch (e) {
      toast({
        title: "Mining failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setMining(false);
    }
  }, [filterPolicyId, toast]);

  const patch = useCallback(
    async (id: string, accepted: boolean) => {
      setPatchingId(id);
      try {
        const r = await fetch("/api/miner", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, accepted }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d: { mined: MinedInvariantRow } = await r.json();
        setMined((prev) =>
          prev
            .map((m) => (m.id === id ? { ...m, ...d.mined } : m))
            .sort((a, b) => b.confidence - a.confidence),
        );
        toast({
          title: accepted ? "Invariant hardened" : "Candidate rejected",
          description: accepted
            ? "Accepted invariants compile into verified enforcers."
            : "Rejected — will not be promoted to an enforcer.",
        });
      } catch (e) {
        toast({
          title: "Update failed",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setPatchingId(null);
      }
    },
    [toast],
  );

  // Sort by confidence desc (defensive — API may already sort).
  const sortedMined = useMemo(
    () => [...mined].sort((a, b) => b.confidence - a.confidence),
    [mined],
  );

  // Top-violated invariants from drift summary (or stats.drift as fallback so
  // the panel is populated on first load, before mining runs).
  const topViolated = useMemo(() => {
    if (driftSummary) {
      return Object.entries(driftSummary.byInvariant)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    }
    return stats?.drift?.topViolated ?? ([] as [string, number][]);
  }, [driftSummary, stats]);

  const totalViolations = stats?.drift?.total ?? stats?.counts.violations ?? driftSummary?.total ?? 0;

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-verified/30 bg-verified/10 glow-verified">
          <Sparkles className="h-4.5 w-4.5 text-verified" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">AI-Augmented Invariant Miner</h2>
          <p className="text-xs text-muted-foreground max-w-2xl">
            The epistemic DAG becomes self-improving. LLMs propose candidate invariants from
            historical drift; humans accept/reject; accepted invariants harden into verified enforcers.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* LEFT — drift telemetry (1/3) */}
        <div className="space-y-3">
          <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-30" />
            <div className="relative space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-violating" />
                  <span className="text-sm font-semibold text-foreground">Drift telemetry</span>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    totalViolations > 0
                      ? "border-violating/30 bg-violating/10 text-violating"
                      : "border-verified/30 bg-verified/10 text-verified",
                  )}
                >
                  {totalViolations} violation{totalViolations === 1 ? "" : "s"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border/60 bg-background/40 p-2.5">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <Gauge className="h-3 w-3" /> health
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 font-mono text-lg tabular-nums",
                      (stats?.shardHealth.healthScore ?? 100) >= 85
                        ? "text-verified"
                        : (stats?.shardHealth.healthScore ?? 100) >= 60
                          ? "text-repairing"
                          : "text-violating",
                    )}
                  >
                    {stats ? `${stats.shardHealth.healthScore}%` : "—"}
                  </div>
                </div>
                <div className="rounded-md border border-border/60 bg-background/40 p-2.5">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <Brain className="h-3 w-3" /> llm
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 font-mono text-lg",
                      llmUsed === null
                        ? "text-muted-foreground"
                        : llmUsed
                          ? "text-verified"
                          : "text-repairing",
                    )}
                  >
                    {llmUsed === null ? "—" : llmUsed ? "active" : "fallback"}
                  </div>
                </div>
              </div>

              <Separator className="bg-border/40" />

              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <TrendingUp className="h-3 w-3" /> most-violated invariants
                </div>
                {topViolated.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/70">
                    No drift data yet — run the miner to populate.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {topViolated.map(([name, count]) => {
                      const max = topViolated[0]?.[1] ?? 1;
                      return (
                        <div key={name} className="space-y-0.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono text-foreground truncate">{name}</span>
                            <span className="font-mono text-muted-foreground tabular-nums">{count}×</span>
                          </div>
                          <div className="h-1 w-full overflow-hidden rounded-full bg-muted/40">
                            <div
                              className="h-full rounded-full bg-violating/70"
                              style={{ width: `${(count / max) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Educational note */}
          <Card className="bg-card/60 backdrop-blur border-quarantined/30 p-3.5 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-20" />
            <div className="relative space-y-1.5">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-quarantined" />
                <span className="text-xs font-semibold text-foreground">Mining pipeline</span>
              </div>
              <ol className="space-y-1 text-[10.5px] text-muted-foreground">
                <li><span className="text-verified font-mono">1.</span> Drift telemetry collected from invariant violations.</li>
                <li><span className="text-verified font-mono">2.</span> LLM proposes grounded candidate predicates.</li>
                <li><span className="text-verified font-mono">3.</span> Human accepts → compiles to WASM enforcer.</li>
                <li><span className="text-verified font-mono">4.</span> Hardened invariants close the feedback loop.</li>
              </ol>
            </div>
          </Card>
        </div>

        {/* RIGHT — controls + candidate list (2/3) */}
        <div className="space-y-3 lg:col-span-2">
          {/* Control row */}
          <Card className="bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-20" />
            <div className="relative flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">policy</span>
                <Select value={filterPolicyId} onValueChange={setFilterPolicyId}>
                  <SelectTrigger className="h-8 w-[200px] bg-card/60 text-xs">
                    <SelectValue placeholder="All policies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All policies</SelectItem>
                    {policies.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={mine}
                disabled={mining}
                className="ml-auto bg-verified/15 border border-verified/40 text-verified hover:bg-verified/25"
                variant="outline"
              >
                {mining ? (
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Pickaxe className="h-3.5 w-3.5" />
                )}
                {mining ? "Mining…" : "Mine candidates"}
              </Button>
              {driftSummary && (
                <Badge variant="outline" className="border-border/60 text-[10px] gap-1">
                  <BarChart3 className="h-2.5 w-2.5" />
                  {driftSummary.total} drift points
                </Badge>
              )}
            </div>
            {fetchError && (
              <div className="relative mt-2 flex items-center gap-1.5 text-[10px] text-repairing">
                <AlertTriangle className="h-3 w-3" />
                Live list sync unavailable — mining still works. Showing last-known candidates.
              </div>
            )}
          </Card>

          {/* Candidate list */}
          {loading && mined.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-lg bg-muted/40" />
              ))}
            </div>
          ) : sortedMined.length === 0 ? (
            <Card className="bg-card/60 border-dashed border-border/60 p-8 text-center">
              <Pickaxe className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">No candidate invariants yet.</p>
              <p className="text-xs text-muted-foreground/70">
                Run <span className="font-mono text-verified">Mine candidates</span> to propose from drift.
              </p>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {sortedMined.map((c) => (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  policyName={policyName(c.policyId, c.policy?.name)}
                  onAccept={() => patch(c.id, true)}
                  onReject={() => patch(c.id, false)}
                  busy={patchingId === c.id}
                />
              ))}
            </div>
          )}

          {/* Footer count */}
          {sortedMined.length > 0 && (
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1 font-mono">
                <Clock className="h-3 w-3" />
                {sortedMined.length} candidate{sortedMined.length === 1 ? "" : "s"} ·{" "}
                {sortedMined.filter((m) => m.accepted).length} hardened
              </span>
              <span className="font-mono">sorted by confidence ↓</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
