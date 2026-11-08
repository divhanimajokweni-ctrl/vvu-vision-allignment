"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Gauge,
  Timer,
  TrendingUp,
  TrendingDown,
  Radio,
  Zap,
  Minus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Bucket {
  t: number;
  mergeThroughput: number;
  repairLatencyMs: number;
  invariantPassRate: number;
  gossipDelayMs: number;
  zkProofRate: number;
}

interface MetricsData {
  range: string;
  bucketCount: number;
  buckets: Bucket[];
  deltas: Record<string, number>;
  current: Bucket;
  aggregates: {
    avgThroughput: number;
    avgLatency: number;
    avgPassRate: number;
    p95Latency: number;
    maxGossip: number;
  };
  grounding: Record<string, number>;
}

const RANGES = [
  { id: "1h", label: "1h" },
  { id: "6h", label: "6h" },
  { id: "24h", label: "24h" },
];

export function PerformanceMetricsSection() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("6h");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/metrics?range=${range}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: MetricsData = await r.json();
      setData(d);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { current, deltas, aggregates, grounding } = data;

  return (
    <section className="space-y-4">
      {/* Header */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-verified/30 bg-verified/10 shrink-0">
            <Activity className="h-5 w-5 text-verified" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold flex items-center gap-2">
              Performance Metrics
              <Badge variant="outline" className="border-verified/30 bg-verified/10 text-verified text-[9px] font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-verified animate-epistemic-pulse mr-1" />
                live · 15s
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real-time throughput, latency, invariant pass rate, and gossip propagation — grounded in live runtime state.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={cn(
                  "rounded px-2.5 py-1 text-[11px] font-mono transition-colors",
                  range === r.id
                    ? "bg-verified/15 text-verified"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          label="Merge throughput"
          value={current.mergeThroughput.toString()}
          unit="/min"
          delta={deltas.mergeThroughput}
          icon={Zap}
          accent="verified"
          invertDelta={false}
        />
        <KpiCard
          label="Repair latency"
          value={current.repairLatencyMs.toString()}
          unit="ms"
          delta={deltas.repairLatencyMs}
          icon={Timer}
          accent="repairing"
          invertDelta
        />
        <KpiCard
          label="Invariant pass"
          value={current.invariantPassRate.toFixed(1)}
          unit="%"
          delta={deltas.invariantPassRate}
          icon={Gauge}
          accent="verified"
          invertDelta={false}
        />
        <KpiCard
          label="Gossip delay"
          value={current.gossipDelayMs.toString()}
          unit="ms"
          delta={deltas.gossipDelayMs}
          icon={Radio}
          accent="quarantined"
          invertDelta
        />
        <KpiCard
          label="ZK proof rate"
          value={current.zkProofRate.toFixed(1)}
          unit="%"
          delta={deltas.zkProofRate}
          icon={TrendingUp}
          accent="verified"
          invertDelta={false}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MetricChart
          title="Merge throughput"
          unit="/min"
          buckets={data.buckets}
          field="mergeThroughput"
          color="oklch(0.78 0.16 160)"
          avg={aggregates.avgThroughput}
          icon={Zap}
        />
        <MetricChart
          title="Repair latency"
          unit="ms"
          buckets={data.buckets}
          field="repairLatencyMs"
          color="oklch(0.80 0.15 80)"
          avg={aggregates.avgLatency}
          p95={aggregates.p95Latency}
          icon={Timer}
        />
        <MetricChart
          title="Invariant pass rate"
          unit="%"
          buckets={data.buckets}
          field="invariantPassRate"
          color="oklch(0.74 0.13 190)"
          avg={aggregates.avgPassRate}
          icon={Gauge}
        />
        <MetricChart
          title="Gossip propagation delay"
          unit="ms"
          buckets={data.buckets}
          field="gossipDelayMs"
          color="oklch(0.70 0.13 40)"
          avg={aggregates.maxGossip / 2}
          icon={Radio}
        />
      </div>

      {/* Grounding + aggregates */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid-fine absolute inset-0 opacity-20" />
        <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <GroundStat label="Merges" value={grounding.totalMerges} sub={`${grounding.appliedMerges} applied`} />
          <GroundStat label="Success rate" value={`${grounding.successRate}%`} sub="merge" />
          <GroundStat label="Shards" value={grounding.totalShards} sub={`${grounding.healthyShards} healthy`} />
          <GroundStat label="Health" value={`${grounding.healthRate}%`} sub={`${grounding.violatingShards} violating`} />
          <GroundStat label="Proofs" value={grounding.totalProofs} sub={`${grounding.zkProofs} ZK`} />
          <GroundStat label="Violations" value={grounding.totalViolations} sub={`${grounding.policies} policies`} />
        </div>
      </Card>
    </section>
  );
}

function KpiCard({
  label,
  value,
  unit,
  delta,
  icon: Icon,
  accent,
  invertDelta,
}: {
  label: string;
  value: string;
  unit: string;
  delta: number;
  icon: typeof Zap;
  accent: "verified" | "repairing" | "quarantined";
  invertDelta: boolean;
}) {
  const color =
    accent === "verified" ? "text-verified" : accent === "repairing" ? "text-repairing" : "text-quarantined";
  // For invertDelta metrics (latency, delay), a decrease is good.
  const isGoodDelta = invertDelta ? delta < 0 : delta > 0;
  const isNeutral = Math.abs(delta) < 0.05 || delta === 0;
  const deltaColor = isNeutral ? "text-muted-foreground" : isGoodDelta ? "text-verified" : "text-violating";
  const DeltaIcon = isNeutral ? Minus : isGoodDelta ? TrendingDown : TrendingUp;
  const deltaLabel = isNeutral ? "flat" : `${delta > 0 ? "+" : ""}${delta.toFixed(delta < 10 ? 1 : 0)}`;

  return (
    <Card className="bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
      <div className="bg-grid-fine absolute inset-0 opacity-20" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
          <Icon className={cn("h-3.5 w-3.5", color)} />
        </div>
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className={cn("text-xl font-semibold tabular-nums leading-none", color)}>{value}</span>
          <span className="text-[10px] text-muted-foreground">{unit}</span>
        </div>
        <div className={cn("mt-1 flex items-center gap-1 text-[10px] font-mono", deltaColor)}>
          <DeltaIcon className="h-2.5 w-2.5" />
          {deltaLabel}
          <span className="text-muted-foreground/60 ml-0.5">prev</span>
        </div>
      </div>
    </Card>
  );
}

function MetricChart({
  title,
  unit,
  buckets,
  field,
  color,
  avg,
  p95,
  icon: Icon,
}: {
  title: string;
  unit: string;
  buckets: Bucket[];
  field: keyof Bucket;
  color: string;
  avg: number;
  p95?: number;
  icon: typeof Zap;
}) {
  const W = 480;
  const H = 160;
  const padX = 8;
  const padY = 16;
  const values = buckets.map((b) => b[field] as number);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, avg * 1.3, 1);
  const range = max - min || 1;

  const points = buckets.map((b, i) => {
    const x = padX + (i / (buckets.length - 1)) * (W - padX * 2);
    const v = b[field] as number;
    const y = H - padY - ((v - min) / range) * (H - padY * 2);
    return { x, y, v };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)},${H - padY} L ${points[0].x.toFixed(1)},${H - padY} Z`;
  const avgY = H - padY - ((avg - min) / range) * (H - padY * 2);

  return (
    <Card className="bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
      <div className="bg-grid-fine absolute inset-0 opacity-20" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-3.5 w-3.5" style={{ color }} />
          <span className="text-xs font-semibold">{title}</span>
          <Badge variant="outline" className="text-[9px] font-mono border-border/60 ml-auto">
            avg {avg.toFixed(avg < 10 ? 1 : 0)}{unit}
          </Badge>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ aspectRatio: `${W} / ${H}` }}>
          {/* grid lines */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={padX}
              y1={padY + f * (H - padY * 2)}
              x2={W - padX}
              y2={padY + f * (H - padY * 2)}
              stroke="oklch(0.34 0.014 165)"
              strokeWidth={0.5}
              strokeOpacity={0.3}
            />
          ))}
          {/* avg line */}
          <line
            x1={padX}
            y1={avgY}
            x2={W - padX}
            y2={avgY}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="3 2"
            strokeOpacity={0.5}
          />
          <text x={W - padX - 2} y={avgY - 3} textAnchor="end" fontSize={7} fill={color} fillOpacity={0.7} fontFamily="monospace">
            avg
          </text>
          {/* p95 line */}
          {p95 !== undefined && (
            <>
              <line
                x1={padX}
                y1={H - padY - ((p95 - min) / range) * (H - padY * 2)}
                x2={W - padX}
                y2={H - padY - ((p95 - min) / range) * (H - padY * 2)}
                stroke="oklch(0.64 0.21 25)"
                strokeWidth={1}
                strokeDasharray="2 2"
                strokeOpacity={0.4}
              />
              <text
                x={padX + 2}
                y={H - padY - ((p95 - min) / range) * (H - padY * 2) - 3}
                fontSize={7}
                fill="oklch(0.64 0.21 25)"
                fillOpacity={0.7}
                fontFamily="monospace"
              >
                p95
              </text>
            </>
          )}
          {/* area + line */}
          <path d={areaPath} fill={color} fillOpacity={0.12} />
          <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          {/* last point */}
          {points.length > 0 && (
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r={2.5}
              fill={color}
              className="animate-epistemic-pulse"
            />
          )}
        </svg>
        <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono mt-0.5">
          <span>{new Date(buckets[0].t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          <span>now</span>
        </div>
      </div>
    </Card>
  );
}

function GroundStat({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-background/40 px-2 py-1.5 text-center">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums leading-none mt-1">{value}</div>
      <div className="text-[9px] text-muted-foreground font-mono mt-0.5">{sub}</div>
    </div>
  );
}
