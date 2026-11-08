"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VVU_SITES, type VvuSite } from "@/lib/vvu-sites";

interface SiteSelectorProps {
  current: string;
  onChange: (slug: string) => void;
}

export function SiteSelector({ current, onChange }: SiteSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {VVU_SITES.map((s: VvuSite) => {
        const active = s.slug === current;
        return (
          <Button
            key={s.slug}
            variant={active ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(s.slug)}
            className={cn(
              "group relative overflow-hidden",
              active ? "border-2 text-foreground" : "hover:bg-accent",
            )}
            style={
              active ? { borderColor: s.accent, color: s.accent, background: s.accentSoft } : {}
            }
          >
            <span
              className="mr-2 inline-block h-2 w-2 rounded-full"
              style={{ background: s.accent }}
            />
            <span className="font-medium">{s.name.split(" ")[0]}</span>
            <span className="ml-1 text-[10px] opacity-70 hidden sm:inline">· {s.region}</span>
            <span className="ml-2 text-[10px] opacity-60 hidden sm:inline">
              {s.nodes.length} nodes
            </span>
          </Button>
        );
      })}
    </div>
  );
}

interface SpatialTwinProps {
  site: VvuSite;
  selectedNodeId?: string;
  onSelectNode?: (id: string) => void;
  currentState?: string;
}

/**
 * CSS 3D terrain-twin — wireframe look, no heavy Three.js dep.
 * Renders the site's node pins on a perspective grid.
 */
export function SpatialTwin({
  site,
  selectedNodeId,
  onSelectNode,
  currentState = "STEADY_STATE_LOCKED",
}: SpatialTwinProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const accent = site.accent;

  return (
    <div className="relative h-[340px] w-full overflow-hidden rounded-lg border border-border vvu-surface-deep">
      {/* perspective grid floor */}
      <div className="absolute inset-0" style={{ perspective: "600px" }}>
        <div
          className="absolute inset-x-0 bottom-0 h-3/4"
          style={{
            transform: "rotateX(55deg)",
            transformOrigin: "bottom",
            backgroundImage: `
              linear-gradient(to right, ${accent}22 1px, transparent 1px),
              linear-gradient(to bottom, ${accent}22 1px, transparent 1px)
            `,
            backgroundSize: "32px 32px",
            maskImage: "linear-gradient(to top, black, transparent)",
            WebkitMaskImage: "linear-gradient(to top, black, transparent)",
          }}
        />
      </div>

      {/* horizon glow */}
      <div
        className="absolute inset-x-0 top-1/3 h-px"
        style={{ background: `linear-gradient(to right, transparent, ${accent}88, transparent)` }}
      />

      {/* site title overlay */}
      <div className="absolute left-3 top-3 z-10">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Site</div>
        <div className="font-mono text-sm" style={{ color: accent }}>
          {site.name}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)} · {site.altitudeM} m
        </div>
      </div>

      <div className="absolute right-3 top-3 z-10 text-right">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">State</div>
        <div className="font-mono text-sm text-lime-400">{currentState.replace(/_/g, " ")}</div>
      </div>

      {/* nodes */}
      <div className="absolute inset-0 grid grid-cols-12 grid-rows-12 gap-0">
        {site.nodes.map((n) => {
          const col = Math.max(1, Math.min(12, Math.round((n.x / 100) * 12) + 1));
          const row = Math.max(1, Math.min(12, Math.round((n.y / 100) * 12) + 1));
          const isSel = selectedNodeId === n.id;
          const isHov = hovered === n.id;
          return (
            <div
              key={n.id}
              className="relative flex items-start justify-start"
              style={{ gridColumn: col, gridRow: row }}
            >
              <button
                onClick={() => onSelectNode?.(n.id)}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                className="group relative -ml-1.5 -mt-1.5 flex flex-col items-center"
                aria-label={`${n.componentName} — ${n.functionalRole}`}
              >
                <span
                  className="relative flex h-3 w-3 items-center justify-center"
                  style={{ filter: isSel || isHov ? `drop-shadow(0 0 6px ${accent})` : "none" }}
                >
                  <span
                    className="absolute h-3 w-3 rounded-full opacity-30 animate-ping"
                    style={{ background: accent, animationDuration: "2.5s" }}
                  />
                  <span
                    className="relative h-2.5 w-2.5 rounded-full border"
                    style={{
                      background: isSel ? accent : `${accent}33`,
                      borderColor: accent,
                      boxShadow: isSel ? `0 0 8px ${accent}` : "none",
                    }}
                  />
                </span>
                <span
                  className="absolute left-4 top-0 whitespace-nowrap font-mono text-[10px]"
                  style={{ color: isSel || isHov ? accent : "#94a3b8" }}
                >
                  {n.id}
                </span>
                {(isSel || isHov) && (
                  <span className="absolute left-4 top-4 whitespace-nowrap rounded bg-background/90 px-1.5 py-0.5 text-[10px] text-foreground">
                    {n.componentName}
                    <span className="ml-1 text-muted-foreground">· {n.functionalRole}</span>
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* legend */}
      <div className="absolute bottom-2 right-3 z-10 flex items-center gap-3 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
          PIN
        </span>
        <span className="flex items-center gap-1">
          <span
            className="h-1.5 w-1.5 rounded-full border"
            style={{ borderColor: accent, background: accent }}
          />
          SELECTED
        </span>
      </div>
    </div>
  );
}
