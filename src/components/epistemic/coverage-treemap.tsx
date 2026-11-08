"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LayoutGrid,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Cpu,
  Layers,
  TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
interface SharedInvariant {
  name: string;
  count: number;
  domainCount: number;
  severities: string[];
}
interface CoverageData {
  domains: DomainInfo[];
  sharedInvariants: SharedInvariant[];
  totals: Record<string, number>;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "oklch(0.30 0.06 25)",
  high: "oklch(0.30 0.05 80)",
  medium: "oklch(0.28 0.04 40)",
  low: "oklch(0.26 0.02 165)",
};

const SEVERITY_ACCENT: Record<string, string> = {
  critical: "oklch(0.64 0.21 25)",
  high: "oklch(0.80 0.15 80)",
  medium: "oklch(0.70 0.13 40)",
  low: "oklch(0.55 0.01 165)",
};

const DOMAIN_COLORS = [
  "oklch(0.78 0.16 160)",
  "oklch(0.74 0.13 190)",
  "oklch(0.80 0.15 80)",
  "oklch(0.70 0.13 40)",
  "oklch(0.68 0.16 320)",
  "oklch(0.76 0.15 150)",
];

interface TreemapRect {
  x: number;
  y: number;
  w: number;
  h: number;
  domain: DomainInfo;
}

// Simple slice-and-dice treemap layout
function layoutTreemap(domains: DomainInfo[], W: number, H: number): TreemapRect[] {
  const total = domains.reduce((n, d) => n + d.invariantCount, 0) || 1;
  const rects: TreemapRect[] = [];
  let x = 0;
  let y = 0;
  let remainingW = W;
  let remainingH = H;
  let rowHorizontal = true; // alternate axis

  const sorted = [...domains].sort((a, b) => b.invariantCount - a.invariantCount);

  for (const d of sorted) {
    const frac = d.invariantCount / total;
    if (rowHorizontal) {
      const w = Math.max(60, frac * remainingW);
      rects.push({ x, y, w, h: remainingH, domain: d });
      x += w;
      remainingW -= w;
    } else {
      const h = Math.max(50, frac * remainingH);
      rects.push({ x, y, w: remainingW, h, domain: d });
      y += h;
      remainingH -= h;
    }
    // Switch orientation when the remaining aspect ratio inverts
    if (remainingW > 0 && remainingH > 0) {
      const aspect = remainingW / remainingH;
      if ((rowHorizontal && aspect < 1) || (!rowHorizontal && aspect > 1)) {
        rowHorizontal = !rowHorizontal;
      }
    }
  }
  return rects;
}

export function CoverageTreemapSection() {
  const [data, setData] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredDomain, setHoveredDomain] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/coverage");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: CoverageData = await r.json();
      setData(d);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const W = 760;
  const H = 380;
  const rects = layoutTreemap(data.domains, W, H);
  const selected = data.domains.find((d) => d.domain === selectedDomain);
  const hovered = data.domains.find((d) => d.domain === hoveredDomain);

  return (
    <section className="space-y-4">
      {/* Header */}
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-verified/30 bg-verified/10 shrink-0">
            <LayoutGrid className="h-5 w-5 text-verified" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold flex items-center gap-2">
              Invariant Coverage Treemap
              <Badge variant="outline" className="border-verified/30 bg-verified/10 text-verified text-[9px] font-mono">
                {data.totals.domains} domains · {data.totals.invariants} invariants
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Area = invariant count. Color = domain. Shade = severity mix. Spot coverage gaps and concentration.
            </p>
          </div>
        </div>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <StatCard label="Domains" value={data.totals.domains} icon={Layers} />
        <StatCard label="Policies" value={data.totals.policies} icon={ShieldCheck} />
        <StatCard label="Hard" value={data.totals.hard} icon={AlertTriangle} accent="violating" />
        <StatCard label="Soft" value={data.totals.soft} icon={TrendingUp} accent="quarantined" />
        <StatCard label="ZK" value={data.totals.zk} icon={Lock} accent="verified" />
        <StatCard label="Shadow" value={data.totals.shadow} icon={Cpu} accent="repairing" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Treemap */}
        <Card className="lg:col-span-3 bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
          <div className="bg-grid-fine absolute inset-0 opacity-20" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <LayoutGrid className="h-3.5 w-3.5 text-verified" />
              <span className="text-xs font-semibold">Coverage map</span>
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                click a tile to inspect · hover to highlight
              </span>
            </div>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full block"
              style={{ aspectRatio: `${W} / ${H}` }}
              role="img"
              aria-label="Invariant coverage treemap"
            >
              {rects.map((r, i) => {
                const dom = r.domain;
                const colorIdx = i % DOMAIN_COLORS.length;
                const baseColor = DOMAIN_COLORS[colorIdx];
                const isHovered = hoveredDomain === dom.domain;
                const isSelected = selectedDomain === dom.domain;
                const criticalFrac = dom.criticalCount / Math.max(1, dom.invariantCount);
                // Darker fill for higher critical ratio
                const lightness = 0.30 - criticalFrac * 0.08;

                return (
                  <g
                    key={dom.domain}
                    transform={`translate(${r.x},${r.y})`}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoveredDomain(dom.domain)}
                    onMouseLeave={() => setHoveredDomain(null)}
                    onClick={() => setSelectedDomain(isSelected ? null : dom.domain)}
                  >
                    <rect
                      width={Math.max(0, r.w - 2)}
                      height={Math.max(0, r.h - 2)}
                      rx={4}
                      fill={baseColor}
                      fillOpacity={isSelected ? 0.35 : isHovered ? 0.28 : 0.18}
                      stroke={baseColor}
                      strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5}
                      strokeOpacity={isSelected ? 1 : 0.7}
                    />
                    {/* Severity bar at bottom */}
                    {r.h > 50 && (
                      <g transform={`translate(0, ${Math.max(0, r.h - 10)})`}>
                        {(() => {
                          const total = dom.invariantCount || 1;
                          let xOff = 4;
                          const barW = Math.max(0, r.w - 8);
                          const segs: { color: string; frac: number }[] = [
                            { color: "oklch(0.64 0.21 25)", frac: dom.criticalCount / total },
                            { color: "oklch(0.80 0.15 80)", frac: dom.highCount / total },
                            { color: "oklch(0.70 0.13 40)", frac: dom.mediumCount / total },
                            { color: "oklch(0.55 0.01 165)", frac: dom.lowCount / total },
                          ];
                          return segs.map((s, j) => {
                            const sw = s.frac * barW;
                            const el = (
                              <rect
                                key={j}
                                x={xOff}
                                y={0}
                                width={Math.max(0, sw)}
                                height={3}
                                rx={1}
                                fill={s.color}
                                fillOpacity={0.8}
                              />
                            );
                            xOff += sw;
                            return el;
                          });
                        })()}
                      </g>
                    )}
                    {/* Domain label */}
                    {r.w > 80 && r.h > 50 && (
                      <text
                        x={8}
                        y={20}
                        fontSize={11}
                        fontWeight={600}
                        fill={baseColor}
                        fillOpacity={0.95}
                        fontFamily="var(--font-geist-mono), monospace"
                        style={{ pointerEvents: "none" }}
                      >
                        {dom.domain.length > 16 ? dom.domain.slice(0, 14) + "…" : dom.domain}
                      </text>
                    )}
                    {/* Count */}
                    {r.w > 80 && r.h > 70 && (
                      <text
                        x={8}
                        y={38}
                        fontSize={18}
                        fontWeight={700}
                        fill="oklch(0.90 0.01 165)"
                        fontFamily="var(--font-geist-sans), sans-serif"
                        style={{ pointerEvents: "none" }}
                      >
                        {dom.invariantCount}
                      </text>
                    )}
                    {/* Sub label */}
                    {r.w > 100 && r.h > 90 && (
                      <text
                        x={8}
                        y={52}
                        fontSize={8}
                        fill="oklch(0.60 0.01 165)"
                        fontFamily="var(--font-geist-mono), monospace"
                        style={{ pointerEvents: "none" }}
                      >
                        {dom.policyCount} polic{dom.policyCount === 1 ? "y" : "ies"} · {dom.hardCount} hard · {dom.softCount} soft
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Severity legend */}
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ backgroundColor: "oklch(0.64 0.21 25)" }} /> critical</span>
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ backgroundColor: "oklch(0.80 0.15 80)" }} /> high</span>
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ backgroundColor: "oklch(0.70 0.13 40)" }} /> medium</span>
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ backgroundColor: "oklch(0.55 0.01 165)" }} /> low</span>
              <span className="ml-auto italic">bar = severity mix</span>
            </div>
          </div>
        </Card>

        {/* Side panel */}
        <div className="space-y-3">
          {selected ? (
            <Card className="bg-card/60 backdrop-blur border-verified/30 p-3 relative overflow-hidden">
              <div className="bg-grid-fine absolute inset-0 opacity-20" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="h-3.5 w-3.5 text-verified" />
                  <span className="text-xs font-semibold truncate">{selected.domain}</span>
                </div>
                <div className="space-y-1 text-[11px] mb-2">
                  <Row label="policies" value={String(selected.policyCount)} />
                  <Row label="invariants" value={String(selected.invariantCount)} />
                  <Row label="hard / soft" value={`${selected.hardCount} / ${selected.softCount}`} />
                  <Row label="ZK / shadow" value={`${selected.zkCount} / ${selected.shadowCount}`} />
                </div>
                <div className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1">
                  Policies in this domain
                </div>
                <div className="space-y-1 max-h-[180px] overflow-y-auto">
                  {selected.policies.map((p) => (
                    <div key={p.id} className="rounded border border-border/40 bg-background/40 px-2 py-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-medium truncate flex-1">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{p.invariantCount}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {p.zkEnabled && <Lock className="h-2.5 w-2.5 text-verified" />}
                        {p.shadowEnabled && <Cpu className="h-2.5 w-2.5 text-repairing" />}
                        <div className="flex gap-0.5 ml-auto">
                          {p.invariants.map((inv, j) => (
                            <span
                              key={j}
                              className="h-2 w-2 rounded-sm"
                              style={{ backgroundColor: SEVERITY_ACCENT[inv.severity] ?? "oklch(0.5 0 0)" }}
                              title={`${inv.name}: ${inv.severity}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ) : hovered ? (
            <Card className="bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
              <div className="bg-grid-fine absolute inset-0 opacity-20" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="h-3.5 w-3.5 text-repairing" />
                  <span className="text-xs font-semibold truncate">{hovered.domain}</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <Row label="policies" value={String(hovered.policyCount)} />
                  <Row label="invariants" value={String(hovered.invariantCount)} />
                  <Row label="critical" value={String(hovered.criticalCount)} />
                  <Row label="high" value={String(hovered.highCount)} />
                  <Row label="medium" value={String(hovered.mediumCount)} />
                  <Row label="low" value={String(hovered.lowCount)} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 italic">click to inspect policies</p>
              </div>
            </Card>
          ) : (
            <Card className="bg-card/60 backdrop-blur border-dashed border-border/60 p-4 text-center">
              <LayoutGrid className="mx-auto h-6 w-6 text-muted-foreground/30" />
              <p className="mt-1 text-[11px] text-muted-foreground">Hover or click a tile</p>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof Layers;
  accent?: "verified" | "violating" | "repairing" | "quarantined";
}) {
  const color =
    accent === "verified" ? "text-verified"
    : accent === "violating" ? "text-violating"
    : accent === "repairing" ? "text-repairing"
    : accent === "quarantined" ? "text-quarantined"
    : "text-foreground";
  return (
    <Card className="bg-card/60 backdrop-blur border-border/60 p-2.5 relative overflow-hidden">
      <div className="bg-grid-fine absolute inset-0 opacity-20" />
      <div className="relative flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5", color)} />
        <div>
          <div className={cn("text-base font-semibold tabular-nums leading-none", color)}>{value}</div>
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</div>
        </div>
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
