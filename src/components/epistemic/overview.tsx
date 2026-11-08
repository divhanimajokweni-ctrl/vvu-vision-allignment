"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  GitBranch,
  ShieldCheck,
  Network,
  Boxes,
  KeyRound,
  Cpu,
  TrendingUp,
  AlertTriangle,
  Wrench,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import type { StatsResponse } from "@/lib/types";
import { StatusPill, Hash } from "./primitives";

export function OverviewSection({ onJump }: { onJump: (id: string) => void }) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/stats")
        .then((r) => r.json())
        .then((d) => alive && (setStats(d), setLoading(false)))
        .catch(() => alive && setLoading(false));
    load();
    const t = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 rounded-lg bg-card/40 animate-pulse" />
        ))}
      </div>
    );
  }

  const healthScore = stats.shardHealth.healthScore;
  const healthStatus =
    healthScore >= 85 ? "healthy" : healthScore >= 60 ? "repairing" : "violating";

  const kpis = [
    {
      label: "Epistemic Health",
      value: `${healthScore}%`,
      sub: `${stats.shardHealth.healthy} ok · ${stats.shardHealth.repairing} fix · ${stats.shardHealth.violating} bad`,
      icon: ShieldCheck,
      status: healthStatus,
    },
    {
      label: "Policies",
      value: String(stats.counts.policies),
      sub: `${stats.counts.shards} shards`,
      icon: GitBranch,
    },
    {
      label: "Merge Success",
      value: `${stats.mergeHealth.successRate}%`,
      sub: `${stats.mergeHealth.applied} applied · ${stats.mergeHealth.rejected} rejected`,
      icon: Wrench,
    },
    {
      label: "Anchored Proofs",
      value: `${stats.ancestry.anchoredRate}%`,
      sub: `${stats.ancestry.zkProofs}/${stats.ancestry.totalProofs} ZK`,
      icon: KeyRound,
    },
  ];

  return (
    <div className="space-y-5">
      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card
              key={k.label}
              className="relative overflow-hidden bg-card/60 backdrop-blur border-border/60 p-4"
            >
              <div className="bg-grid-fine absolute inset-0 opacity-30" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    {k.label}
                  </span>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-2 flex items-end gap-2 flex-wrap">
                  <span className="text-3xl font-semibold tabular-nums leading-none">{k.value}</span>
                  {"status" in k && k.status && (
                    <StatusPill status={k.status as "healthy" | "repairing" | "violating"} />
                  )}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground leading-tight">{k.sub}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Inventory + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 bg-card/60 backdrop-blur border-border/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Boxes className="h-4 w-4 text-verified" />
            <h3 className="text-sm font-semibold">Runtime Inventory</h3>
          </div>
          <div className="space-y-2.5">
            <InvRow icon={GitBranch} label="Policies" value={stats.counts.policies} hint="compiled .epd" />
            <InvRow icon={Network} label="Shards" value={stats.counts.shards} hint="state-space partitions" />
            <InvRow icon={GitBranch} label="Merge proposals" value={stats.counts.merges} hint="cross-shard" />
            <InvRow icon={KeyRound} label="Ancestry proofs" value={stats.counts.proofs} hint="MMR + ZK" />
            <InvRow icon={AlertTriangle} label="Drift violations" value={stats.counts.violations} hint="miner feed" />
            <InvRow icon={Cpu} label="Shadow events" value={stats.counts.shadowEvents} hint="twin telemetry" />
            <InvRow icon={Sparkles} label="Mined invariants" value={stats.counts.mined} hint="AI candidates" />
          </div>
        </Card>

        <Card className="lg:col-span-2 bg-card/60 backdrop-blur border-border/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-repairing" />
            <h3 className="text-sm font-semibold">Live Epistemic Activity</h3>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">refresh 8s</span>
          </div>
          <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1">
            {stats.activity.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">No recent activity.</p>
            )}
            {stats.activity.map((a, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-md border border-border/40 bg-background/40 px-3 py-2 hover:border-border transition-colors"
              >
                <div
                  className={
                    "mt-0.5 h-6 w-6 shrink-0 rounded-md flex items-center justify-center " +
                    (a.kind === "merge"
                      ? "bg-verified/10 text-verified"
                      : "bg-repairing/10 text-repairing")
                  }
                >
                  {a.kind === "merge" ? (
                    <GitBranch className="h-3.5 w-3.5" />
                  ) : (
                    <Cpu className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <span className="ml-auto text-[10px] text-muted-foreground font-mono shrink-0">
                      {new Date(a.at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate font-mono">{a.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Capability map */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-verified" />
          <h3 className="text-sm font-semibold">Capability Map</h3>
          <span className="ml-auto text-[10px] text-muted-foreground font-mono">epistemic://</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { id: "studio", label: "Policy DSL Studio", icon: GitBranch, hint: ".epd → enforcers" },
            { id: "templates", label: "Template Library", icon: TrendingUp, hint: "create from template" },
            { id: "topology", label: "DAG Shard Topology", icon: Network, hint: "invariant-aware sharding" },
            { id: "dependencies", label: "Dependency Graph", icon: TrendingUp, hint: "policy relations" },
            { id: "coverage", label: "Coverage Treemap", icon: TrendingUp, hint: "invariant coverage" },
            { id: "merges", label: "Self-Repairing Merges", icon: Wrench, hint: "least-divergent correction" },
            { id: "shadow", label: "Shadow Bridge", icon: Cpu, hint: "digital-twin takeover" },
            { id: "proofs", label: "MMR Ancestry Proofs", icon: KeyRound, hint: "ZK verifiable history" },
            { id: "zkcircuit", label: "ZK Proof Circuit", icon: TrendingUp, hint: "SNARK constraints" },
            { id: "miner", label: "Invariant Miner", icon: Sparkles, hint: "AI-mined candidates" },
            { id: "timeline", label: "Replay Timeline", icon: TrendingUp, hint: "event scrubber" },
            { id: "diff", label: "Policy Diff", icon: TrendingUp, hint: "compare .epd" },
            { id: "matrix", label: "Comparison Matrix", icon: TrendingUp, hint: "multi-policy matrix" },
            { id: "tests", label: "Test Suite", icon: TrendingUp, hint: "run invariant tests" },
            { id: "metrics", label: "Performance Metrics", icon: TrendingUp, hint: "live charts" },
            { id: "versions", label: "Policy Versioning", icon: TrendingUp, hint: "revision history" },
            { id: "audit", label: "Audit Reports", icon: TrendingUp, hint: "compliance export" },
            { id: "cli", label: "CLI Terminal", icon: Cpu, hint: "validate .epd files" },
            { id: "federation", label: "epistemic:// Federation", icon: TrendingUp, hint: "multi-org reconciliation" },
            { id: "overview", label: "Runtime Overview", icon: ShieldCheck, hint: "this dashboard" },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                onClick={() => onJump(c.id)}
                className="group text-left rounded-lg border border-border/50 bg-background/40 p-3 hover:border-verified/40 hover:bg-verified/5 transition-all"
              >
                <Icon className="h-4 w-4 text-muted-foreground group-hover:text-verified transition-colors" />
                <p className="mt-2 text-sm font-medium">{c.label}</p>
                <p className="text-[11px] text-muted-foreground font-mono">{c.hint}</p>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function InvRow({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-7 w-7 rounded-md bg-background/60 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{label}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{hint}</p>
      </div>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}
