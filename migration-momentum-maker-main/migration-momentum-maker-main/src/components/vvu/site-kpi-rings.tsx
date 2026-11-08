"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VVU_SITES, type VvuSite } from "@/lib/vvu-sites";
import { cn } from "@/lib/utils";

interface SiteKpiRingsProps {
  currentSiteSlug: string;
  onSelectSite?: (slug: string) => void;
}

interface RingDatum {
  label: string;
  value: number; // 0..1
  display: string; // human-readable
  color: string;
}

function Ring({ d, color }: { d: RingDatum; color: string }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, d.value)));
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#1a2436" strokeWidth="4" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 36 36)"
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
        <text
          x="36"
          y="40"
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: "11px", fontWeight: "bold" }}
        >
          {d.display}
        </text>
      </svg>
      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{d.label}</span>
    </div>
  );
}

export function SiteKpiRings({ currentSiteSlug, onSelectSite }: SiteKpiRingsProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Site KPI Rings</h3>
        <span className="text-[10px] text-muted-foreground">live per-site integrity snapshot</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {VVU_SITES.map((site: VvuSite) => {
          const active = site.slug === currentSiteSlug;
          const accent = site.accent;
          // Mock per-site KPI values
          const kpiData: RingDatum[] = [
            {
              label: "integrity",
              value: active ? 1.0 : 0.96 + (site.slug.charCodeAt(0) % 4) / 100,
              display: active ? "100%" : "96%",
              color: "#c8ff00",
            },
            {
              label: "uptime",
              value: active ? 0.998 : 0.985,
              display: active ? "99.8%" : "98.5%",
              color: "#22c55e",
            },
            {
              label: "WORM",
              value: active ? 15 / 15 : 14 / 15,
              display: active ? "15/15" : "14/15",
              color: "#a78bfa",
            },
          ];
          return (
            <Card
              key={site.slug}
              className={cn(
                "border-border vvu-card-surface p-3 cursor-pointer transition-all",
                active
                  ? "border-lime-600/60 shadow-[0_0_0_1px_rgba(200,255,0,0.2)]"
                  : "hover:border-lime-700/50",
              )}
              onClick={() => onSelectSite?.(site.slug)}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: accent, boxShadow: active ? `0 0 6px ${accent}` : "none" }}
                />
                <span className="text-xs font-semibold text-foreground truncate">{site.name}</span>
                {active && (
                  <Badge
                    variant="outline"
                    className="ml-auto text-[9px] font-mono border-lime-700 bg-lime-950/50 text-lime-300"
                  >
                    ACTIVE
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-around">
                {kpiData.map((d) => (
                  <Ring key={d.label} d={d} color={accent} />
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">{site.region}</span>
                <span className="font-mono text-muted-foreground">
                  {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
