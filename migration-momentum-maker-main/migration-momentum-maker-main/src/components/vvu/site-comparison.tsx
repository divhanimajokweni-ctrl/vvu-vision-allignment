"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VVU_SITES, type VvuSite } from "@/lib/vvu-sites";
import { SANS_CELERITY_BOUNDS, APU_THERMAL_BOUNDS } from "@/lib/vvu-telemetry";
import { cn } from "@/lib/utils";

interface SiteComparisonProps {
  currentSiteSlug: string;
  onSelectSite?: (slug: string) => void;
}

// Mock per-site current metrics (in production these would come from the WS service)
function getSiteMetrics(slug: string) {
  // Deterministic pseudo-random based on slug
  const seed = slug.charCodeAt(0) + slug.charCodeAt(1);
  const r = (off: number) => (Math.sin(seed * 0.7 + off) + 1) / 2;

  const profiles: Record<
    string,
    { flowMin: number; flowMax: number; pressureMin: number; pressureMax: number; apuBase: number }
  > = {
    gqeberha: { flowMin: 8, flowMax: 22, pressureMin: 18, pressureMax: 38, apuBase: 38 },
    mogalakwena: { flowMin: 15, flowMax: 35, pressureMin: 28, pressureMax: 55, apuBase: 48 },
    marikana: { flowMin: 18, flowMax: 40, pressureMin: 32, pressureMax: 60, apuBase: 52 },
  };
  const p = profiles[slug] ?? profiles.gqeberha;

  const flow = p.flowMin + r(0) * (p.flowMax - p.flowMin);
  const pressure = p.pressureMin + r(2) * (p.pressureMax - p.pressureMin);
  const apu = p.apuBase + r(4) * 16;
  const celerity = 600 + Math.sqrt(pressure) * 18 + Math.sqrt(flow) * 6;
  const eis = apu >= 85 ? 25 : apu >= 65 ? 75 : 100;

  return {
    flow: Math.round(flow * 10) / 10,
    pressure: Math.round(pressure * 10) / 10,
    apu: Math.round(apu * 10) / 10,
    celerity: Math.round(celerity),
    eis,
    invariantOk: apu < 85,
    state:
      apu >= 85 ? "FAIL_CLOSED_LOCKDOWN" : apu >= 65 ? "THERMAL_THROTTLE" : "STEADY_STATE_LOCKED",
  };
}

function MetricBar({
  value,
  min,
  max,
  unit,
  color,
}: {
  value: number;
  min: number;
  max: number;
  unit: string;
  color: string;
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{unit}</span>
        <span className="font-mono text-[11px] font-bold" style={{ color }}>
          {value.toFixed(unit === "a" ? 0 : 1)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function SiteComparison({ currentSiteSlug, onSelectSite }: SiteComparisonProps) {
  const sites = VVU_SITES;

  const comparison = useMemo(
    () =>
      sites.map((s) => ({
        site: s,
        metrics: getSiteMetrics(s.slug),
      })),
    [sites],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Site Comparison</h3>
          <p className="text-[10px] text-muted-foreground">
            Side-by-side real-time metrics from all 3 South-African sites
          </p>
        </div>
        <Badge
          variant="outline"
          className="font-mono text-[9px] border-lime-700 bg-lime-950/40 text-lime-300"
        >
          {sites.length} sites · live
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {comparison.map(({ site, metrics }) => {
          const isActive = site.slug === currentSiteSlug;
          return (
            <Card
              key={site.slug}
              className={cn(
                "border p-3 cursor-pointer transition-all vvu-glow-hover",
                isActive
                  ? "border-lime-600/60 shadow-[0_0_0_1px_rgba(200,255,0,0.2)]"
                  : "border-border hover:border-lime-700/40",
              )}
              onClick={() => onSelectSite?.(site.slug)}
            >
              {/* Site header */}
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                  style={{
                    background: site.accent,
                    boxShadow: isActive ? `0 0 6px ${site.accent}` : "none",
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">{site.name}</div>
                  <div className="text-[9px] text-muted-foreground">{site.region}</div>
                </div>
                {isActive && (
                  <Badge
                    variant="outline"
                    className="text-[8px] font-mono border-lime-700 bg-lime-950/50 text-lime-300 shrink-0"
                  >
                    ACTIVE
                  </Badge>
                )}
              </div>

              {/* State badge */}
              <div className="mb-3 flex items-center justify-between">
                <Badge
                  variant="outline"
                  className={cn(
                    "font-mono text-[9px]",
                    metrics.state === "STEADY_STATE_LOCKED" &&
                      "border-lime-700 bg-lime-950/50 text-lime-300",
                    metrics.state === "THERMAL_THROTTLE" &&
                      "border-orange-700 bg-orange-950/50 text-orange-300",
                    metrics.state === "FAIL_CLOSED_LOCKDOWN" &&
                      "border-red-700 bg-red-950/50 text-red-300 vvu-pulse-alert",
                  )}
                >
                  <span
                    className={cn(
                      "mr-1 inline-block h-1.5 w-1.5 rounded-full vvu-status-dot",
                      metrics.state === "STEADY_STATE_LOCKED"
                        ? "bg-lime-400"
                        : metrics.state === "THERMAL_THROTTLE"
                          ? "bg-orange-400"
                          : "bg-red-400",
                    )}
                  />
                  {metrics.state.replace(/_/g, " ")}
                </Badge>
                <span className="text-[9px] font-mono text-muted-foreground">
                  EIS {metrics.eis}%
                </span>
              </div>

              {/* Metrics */}
              <div className="space-y-2">
                <MetricBar value={metrics.flow} min={0} max={45} unit="Q (L/s)" color="#38bdf8" />
                <MetricBar value={metrics.pressure} min={0} max={65} unit="H (m)" color="#c8ff00" />
                <MetricBar
                  value={metrics.celerity}
                  min={SANS_CELERITY_BOUNDS.min}
                  max={SANS_CELERITY_BOUNDS.max}
                  unit="a (m/s)"
                  color="#a78bfa"
                />
                <MetricBar
                  value={metrics.apu}
                  min={20}
                  max={100}
                  unit="T (°C)"
                  color={metrics.apu >= 85 ? "#ef4444" : metrics.apu >= 65 ? "#ff8a00" : "#22c55e"}
                />
              </div>

              {/* Footer */}
              <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[9px] text-muted-foreground">
                <span className="font-mono">
                  {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                </span>
                <span className="font-mono">
                  {site.nodes.length} nodes · {site.slug === "mogalakwena" ? "DN100" : "DN300"}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Summary comparison table */}
      <Card className="border-border vvu-card-surface p-3 overflow-x-auto">
        <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Comparison Matrix</h4>
        <table className="w-full font-mono text-[10px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-2 py-1 font-semibold text-muted-foreground">Metric</th>
              {comparison.map(({ site }) => (
                <th
                  key={site.slug}
                  className="px-2 py-1 font-semibold text-muted-foreground text-right"
                >
                  {site.name.split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: "Flow (L/s)", key: "flow", format: (v: number) => v.toFixed(1) },
              { label: "Pressure (m)", key: "pressure", format: (v: number) => v.toFixed(1) },
              { label: "Celerity (m/s)", key: "celerity", format: (v: number) => v.toFixed(0) },
              { label: "APU Temp (°C)", key: "apu", format: (v: number) => v.toFixed(1) },
              { label: "EIS %", key: "eis", format: (v: number) => `${v}%` },
            ].map((row) => (
              <tr key={row.key} className="border-b border-border/30">
                <td className="px-2 py-1 text-muted-foreground">{row.label}</td>
                {comparison.map(({ site, metrics }) => {
const v = (metrics as Record<string, number>)[row.key];
                  const isMax =
                    v === Math.max(...comparison.map((c) => (c.metrics as Record<string, number>)[row.key]));
                  const isMin =
                    v === Math.min(...comparison.map((c) => (c.metrics as Record<string, number>)[row.key]));
                  return (
                    <td
                      key={site.slug}
                      className={cn(
                        "px-2 py-1 text-right",
                        isMax && "text-lime-400 font-bold",
                        isMin && !isMax && "text-red-400",
                        !isMax && !isMin && "text-foreground",
                      )}
                    >
                      {row.format(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
