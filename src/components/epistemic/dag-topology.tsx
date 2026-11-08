"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Network,
  Boxes,
  Activity,
  Users,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Cpu,
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { PolicyRow, ShardRow, ShardStatus } from "@/lib/types";
import { StatusDot, Hash, SeverityBadge } from "./primitives";
import { ShardRebalancePanel } from "./shard-rebalance";
import { InteractiveDagGraph } from "./interactive-graph";
import { RealGeospatialMap } from "./real-geospatial-map";

const POLL_MS = 10_000;

const STATUS_BORDER: Record<ShardStatus, string> = {
  healthy: "border-verified/30",
  repairing: "border-repairing/30",
  violating: "border-violating/30",
};
const STATUS_GLOW: Record<ShardStatus, string> = {
  healthy: "",
  repairing: "glow-repairing",
  violating: "glow-violating",
};
const STATUS_TEXT: Record<ShardStatus, string> = {
  healthy: "text-verified",
  repairing: "text-repairing",
  violating: "text-violating",
};

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

/** A tiny "peer link" hint — dots representing a node's peers in the DAG. */
function PeerLinks({ count, status }: { count: number; status: ShardStatus }) {
  const dots = Math.max(1, Math.min(count, 6));
  return (
    <div className="flex items-center gap-1">
      <Users className="h-3 w-3 text-muted-foreground" />
      <div className="flex items-center gap-0.5">
        {Array.from({ length: dots }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 w-1 rounded-full",
              status === "violating"
                ? "bg-violating/60"
                : status === "repairing"
                  ? "bg-repairing/60"
                  : "bg-verified/50",
            )}
          />
        ))}
        {count > 6 && <span className="text-[10px] text-muted-foreground">+{count - 6}</span>}
      </div>
      <span className="text-[10px] text-muted-foreground font-mono">{count}</span>
    </div>
  );
}

/** A lightweight decorative connector row suggesting the DAG mesh. */
function MeshHint() {
  return (
    <div className="relative flex h-6 items-center justify-center overflow-hidden">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[repeating-linear-gradient(90deg,oklch(0.78_0.16_160/0.25)_0,oklch(0.78_0.16_160/0.25)_2px,transparent_2px,transparent_6px)]" />
      {Array.from({ length: 11 }).map((_, i) => (
        <span
          key={i}
          className="relative mx-2 h-1 w-1 rounded-full bg-verified/40"
          style={{ opacity: 0.3 + (i % 3) * 0.25 }}
        />
      ))}
    </div>
  );
}

function ShardNodeCard({ shard }: { shard: ShardRow }) {
  const status = shard.invariantStatus;
  return (
    <Card
      className={cn(
        "bg-card/60 backdrop-blur border p-3 relative overflow-hidden transition-shadow",
        STATUS_BORDER[status],
        STATUS_GLOW[status],
      )}
    >
      <div className="bg-grid-fine absolute inset-0 opacity-20" />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StatusDot status={status} />
              <span className="truncate text-sm font-semibold text-foreground">
                {shard.region}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Cpu className="h-3 w-3" />
              <span className="font-mono truncate">{shard.nodeId}</span>
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              status === "healthy"
                ? "border-verified/30 bg-verified/10 text-verified"
                : status === "repairing"
                  ? "border-repairing/30 bg-repairing/10 text-repairing"
                  : "border-violating/30 bg-violating/10 text-violating",
            )}
          >
            {status}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <PeerLinks count={shard.peerCount} status={status} />
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="opacity-70">mmr</span>
            <Hash value={shard.mmrRoot} length={10} />
          </div>
        </div>

        <Separator className="my-2 bg-border/50" />

        <div className="space-y-1">
          {shard.invariantEvals.length === 0 && (
            <div className="text-[11px] text-muted-foreground italic">no invariants</div>
          )}
          {shard.invariantEvals.map((ev) => (
            <div
              key={ev.name}
              className="flex items-center justify-between gap-2 text-[11px]"
            >
              <span className="font-mono text-muted-foreground truncate">{ev.name}</span>
              <div className="flex items-center gap-1.5">
                <SeverityBadge severity={ev.severity} soft={ev.soft} />
                {ev.passed ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-verified" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-violating" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function LegendItem({
  icon: Icon,
  label,
  color,
  border,
  text,
}: {
  icon: typeof CheckCircle2;
  label: string;
  color: string;
  border: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded border",
          color,
          border,
        )}
      >
        <Icon className={cn("h-3 w-3", text)} />
      </span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function SummaryBar({ shards }: { shards: ShardRow[] }) {
  const total = shards.length;
  const healthy = shards.filter((s) => s.invariantStatus === "healthy").length;
  const repairing = shards.filter((s) => s.invariantStatus === "repairing").length;
  const violating = shards.filter((s) => s.invariantStatus === "violating").length;
  const pct = total === 0 ? 0 : Math.round((healthy / total) * 100);
  const barColor =
    pct >= 80 ? "text-verified" : pct >= 50 ? "text-repairing" : "text-violating";
  return (
    <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
      <div className="bg-grid-fine absolute inset-0 opacity-20" />
      <div className="relative grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Total shards
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-foreground font-mono">{total}</span>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Healthy
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-verified font-mono">{healthy}</span>
            <span className="text-xs text-muted-foreground">/ {total}</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Repairing / Violating
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-lg font-semibold text-repairing font-mono">{repairing}</span>
            <span className="text-lg font-semibold text-violating font-mono">{violating}</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Health score
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={cn("text-2xl font-semibold font-mono", barColor)}>{pct}%</span>
          </div>
          <Progress
            value={pct}
            className={cn(
              "mt-1.5 h-1.5",
              pct >= 80 ? "[&>div]:bg-verified" : pct >= 50 ? "[&>div]:bg-repairing" : "[&>div]:bg-violating",
            )}
          />
        </div>
      </div>
    </Card>
  );
}

function ShardTable({ shards }: { shards: ShardRow[] }) {
  return (
    <Card className="bg-card/60 backdrop-blur border-border/60 p-0 relative overflow-hidden">
      <div className="bg-grid-fine absolute inset-0 opacity-10 pointer-events-none" />
      <div className="relative">
        <div className="max-h-96 overflow-y-auto epistemic-scroll">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground">Region</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground">Policy</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground">Node</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground text-right">Peers</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground">MMR root</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wide text-muted-foreground">Last merge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shards.map((s) => (
                <TableRow
                  key={s.id}
                  className="border-border/40 hover:bg-muted/30"
                >
                  <TableCell className="font-medium text-foreground">{s.region}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs text-foreground">{s.policy.name}</span>
                      <span className="text-[10px] text-muted-foreground">{s.policy.domain ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{s.nodeId}</TableCell>
                  <TableCell>
                    <div className={cn("flex items-center gap-1.5", STATUS_TEXT[s.invariantStatus])}>
                      <StatusDot status={s.invariantStatus} />
                      <span className="text-xs capitalize">{s.invariantStatus}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">{s.peerCount}</TableCell>
                  <TableCell><Hash value={s.mmrRoot} length={10} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtRelative(s.lastMergeAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
}

export function DagTopologySection() {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [policyId, setPolicyId] = useState<string>("all");
  const [shards, setShards] = useState<ShardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load policies once.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/policies")
      .then((r) => r.json())
      .then((d: { policies: PolicyRow[] }) => {
        if (!cancelled) setPolicies(d.policies ?? []);
      })
      .catch(() => {
        /* non-fatal */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadShards = useCallback(async () => {
    const url =
      policyId === "all" ? "/api/shards" : `/api/shards?policyId=${encodeURIComponent(policyId)}`;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: { shards: ShardRow[] } = await r.json();
      setShards(d.shards ?? []);
    } catch (e) {
      toast({
        title: "Failed to load shards",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [policyId, toast]);

  useEffect(() => {
    setLoading(true);
    loadShards();
    const t = setInterval(loadShards, POLL_MS);
    return () => clearInterval(t);
  }, [loadShards]);

  const sorted = useMemo(
    () =>
      [...shards].sort((a, b) => {
        const rank: Record<ShardStatus, number> = { violating: 0, repairing: 1, healthy: 2 };
        const r = rank[a.invariantStatus] - rank[b.invariantStatus];
        if (r !== 0) return r;
        return a.region.localeCompare(b.region);
      }),
    [shards],
  );

  return (
    <section className="space-y-4">
      {/* Header / filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-verified/30 bg-verified/10">
            <Network className="h-4.5 w-4.5 text-verified" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">DAG Shard Topology</h2>
            <p className="text-xs text-muted-foreground">
              Live sharded state across regions · MMR-anchored · peer-gossiped
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={policyId} onValueChange={setPolicyId}>
            <SelectTrigger className="w-[220px] bg-card/60">
              <SelectValue placeholder="Filter by policy" />
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
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              loadShards();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-card/60 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            aria-label="Refresh topology"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      <SummaryBar shards={sorted} />

      {/* Geospatial map — REAL maplibre-gl tiles, not fake SVG */}
      <RealGeospatialMap height={420} />

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        <LegendItem
          icon={CheckCircle2}
          label="Healthy — all invariants satisfied"
          color="bg-verified/10"
          border="border-verified/30"
          text="text-verified"
        />
        <LegendItem
          icon={AlertTriangle}
          label="Repairing — self-heal in progress"
          color="bg-repairing/10"
          border="border-repairing/30"
          text="text-repairing"
        />
        <LegendItem
          icon={XCircle}
          label="Violating — invariant breach"
          color="bg-violating/10"
          border="border-violating/30"
          text="text-violating"
        />
      </div>

      {/* Topology grid */}
      <Card className="bg-card/40 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-20 pointer-events-none" />
        <div className="relative">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-verified" />
              <span className="text-sm font-medium text-foreground">Mesh view</span>
              <span className="text-xs text-muted-foreground">
                {sorted.length} node{sorted.length === 1 ? "" : "s"} · dotted links = peer gossip
              </span>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full rounded-lg bg-muted/40" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Boxes className="h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No shards found for this policy.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sorted.map((s) => (
                  <ShardNodeCard key={s.id} shard={s} />
                ))}
              </div>
              <MeshHint />
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="font-mono">DAG</span>
                <ArrowRight className="h-3 w-3" />
                <span>locality-preserving merges</span>
                <ArrowRight className="h-3 w-3" />
                <span className="font-mono">MMR root</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Interactive force-directed graph */}
      {!loading && sorted.length > 0 && <InteractiveDagGraph shards={sorted} />}

      {/* Rebalance + ledger in a two-column layout on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <ShardRebalancePanel onMigrated={loadShards} />
        </div>
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className="text-sm font-medium text-foreground">Shard ledger</span>
            <span className="text-xs text-muted-foreground">· sorted by status severity</span>
          </div>
          {loading ? (
            <Skeleton className="h-64 w-full rounded-lg bg-muted/40" />
          ) : sorted.length === 0 ? (
            <Card className="bg-card/60 border-border/60 p-8 text-center text-sm text-muted-foreground">
              No shards to display.
            </Card>
          ) : (
            <ShardTable shards={sorted} />
          )}
        </div>
      </div>
    </section>
  );
}
