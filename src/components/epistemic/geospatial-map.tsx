"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe2, Layers, Radio, Zap, Maximize2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface GeoMarker {
  id: string;
  region: string;
  regionLabel: string;
  nodeId: string;
  policyName: string;
  status: "healthy" | "repairing" | "violating";
  lat: number;
  lng: number;
  x: number;
  y: number;
  peerCount: number;
  mmrRoot: string;
  invariantOk: number;
  invariantFail: number;
  hasGeo: boolean;
}

interface GeoRegion {
  id: string;
  label: string;
  lat: number;
  lng: number;
  x: number;
  y: number;
  polygon: { x: number; y: number }[];
  shardCount: number;
  healthyCount: number;
  violatingCount: number;
  timezone: string;
}

interface GeoLink {
  from: string;
  to: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  distanceKm: number;
  type: "gossip" | "merge";
}

interface GeoData {
  width: number;
  height: number;
  markers: GeoMarker[];
  regions: GeoRegion[];
  links: GeoLink[];
  summary: {
    totalShards: number;
    geoShards: number;
    totalRegions: number;
    totalLinks: number;
    mergeLinks: number;
    avgLinkDistanceKm: number;
  };
}

const STATUS_COLOR: Record<string, string> = {
  healthy: "oklch(0.78 0.16 160)",
  repairing: "oklch(0.80 0.15 80)",
  violating: "oklch(0.64 0.21 25)",
};

// Simplified world map continent outlines (lat/lng → projected)
// This is a very low-poly world map for spatial context
const CONTINENT_OUTLINES: [number, number][][] = [
  // North America (rough)
  [[70, -170], [70, -50], [50, -55], [25, -80], [15, -90], [25, -110], [50, -130], [60, -165], [70, -170]],
  // South America
  [[10, -80], [10, -50], [-20, -40], [-55, -70], [-20, -75], [10, -80]],
  // Europe
  [[70, -10], [70, 40], [55, 40], [35, 25], [36, -10], [50, -10], [70, -10]],
  // Africa
  [[35, -15], [35, 35], [10, 45], [-35, 20], [-30, 10], [10, -15], [35, -15]],
  // Asia
  [[70, 40], [70, 180], [45, 140], [20, 110], [10, 95], [25, 60], [35, 40], [70, 40]],
  // Australia
  [[-10, 115], [-10, 155], [-40, 145], [-35, 115], [-10, 115]],
];

export function GeospatialMap() {
  const [data, setData] = useState<GeoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);
  const [showLinks, setShowLinks] = useState(true);
  const [showRegions, setShowRegions] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/geo");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: GeoData = await r.json();
      setData(d);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  if (loading || !data) {
    return <Skeleton className="h-80 w-full" />;
  }

  const W = data.width;
  const H = data.height;

  // Project a lat/lng to x/y
  const proj = (lat: number, lng: number) => ({
    x: ((lng + 180) / 360) * W,
    y: ((90 - lat) / 180) * H,
  });

  return (
    <Card className="bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
      <div className="bg-grid absolute inset-0 opacity-10" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Globe2 className="h-4 w-4 text-verified" />
          <span className="text-sm font-semibold">Geospatial topology</span>
          <Badge variant="outline" className="text-[9px] border-verified/30 bg-verified/10 text-verified font-mono">
            {data.summary.geoShards}/{data.summary.totalShards} geo-located
          </Badge>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowRegions((s) => !s)}
              className={cn(
                "flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] transition-colors",
                showRegions ? "border-verified/30 bg-verified/10 text-verified" : "border-border/60 text-muted-foreground",
              )}
            >
              <Layers className="h-2.5 w-2.5" /> regions
            </button>
            <button
              onClick={() => setShowLinks((s) => !s)}
              className={cn(
                "flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] transition-colors",
                showLinks ? "border-repairing/30 bg-repairing/10 text-repairing" : "border-border/60 text-muted-foreground",
              )}
            >
              <Radio className="h-2.5 w-2.5" /> links
            </button>
          </div>
        </div>

        {/* Map */}
        <div className="rounded-md border border-border/60 bg-background/40 overflow-hidden">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full block"
            style={{ aspectRatio: `${W} / ${H}` }}
            role="img"
            aria-label="Geospatial shard topology map"
          >
            <defs>
              <radialGradient id="marker-glow-healthy" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="oklch(0.78 0.16 160)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="oklch(0.78 0.16 160)" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="marker-glow-violating" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="oklch(0.64 0.21 25)" stopOpacity="0.5" />
                <stop offset="100%" stopColor="oklch(0.64 0.21 25)" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="marker-glow-repairing" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="oklch(0.80 0.15 80)" stopOpacity="0.45" />
                <stop offset="100%" stopColor="oklch(0.80 0.15 80)" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* World map continents (low-poly outlines) */}
            {CONTINENT_OUTLINES.map((outline, i) => {
              const points = outline.map(([lat, lng]) => {
                const p = proj(lat, lng);
                return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
              }).join(" ");
              return (
                <polygon
                  key={`continent-${i}`}
                  points={points}
                  fill="oklch(0.22 0.01 165)"
                  fillOpacity={0.4}
                  stroke="oklch(0.32 0.01 165)"
                  strokeWidth={0.5}
                  strokeOpacity={0.5}
                />
              );
            })}

            {/* Latitude/longitude grid lines */}
            {[...Array(7)].map((_, i) => {
              const lat = 60 - i * 30;
              const y = proj(lat, 0).y;
              return (
                <line key={`lat-${i}`} x1={0} y1={y} x2={W} y2={y}
                  stroke="oklch(0.30 0.01 165)" strokeWidth={0.3} strokeOpacity={0.3} strokeDasharray="2 4" />
              );
            })}
            {[...Array(11)].map((_, i) => {
              const lng = -180 + i * 36;
              const x = proj(0, lng).x;
              return (
                <line key={`lng-${i}`} x1={x} y1={0} x2={x} y2={H}
                  stroke="oklch(0.30 0.01 165)" strokeWidth={0.3} strokeOpacity={0.3} strokeDasharray="2 4" />
              );
            })}

            {/* Region polygons */}
            {showRegions && data.regions.map((r) => {
              const points = r.polygon.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
              const hasViolation = r.violatingCount > 0;
              return (
                <g key={`region-${r.id}`}>
                  <polygon
                    points={points}
                    fill={hasViolation ? "oklch(0.64 0.21 25)" : "oklch(0.78 0.16 160)"}
                    fillOpacity={hasViolation ? 0.08 : 0.05}
                    stroke={hasViolation ? "oklch(0.64 0.21 25)" : "oklch(0.78 0.16 160)"}
                    strokeWidth={0.8}
                    strokeOpacity={0.5}
                    strokeDasharray="3 2"
                  />
                  <text
                    x={r.x}
                    y={r.y - 4}
                    textAnchor="middle"
                    fontSize={7}
                    fill={hasViolation ? "oklch(0.64 0.21 25)" : "oklch(0.78 0.16 160)"}
                    fillOpacity={0.8}
                    fontFamily="var(--font-geist-mono), monospace"
                    fontWeight={600}
                    style={{ pointerEvents: "none" }}
                  >
                    {r.label}
                  </text>
                  <text
                    x={r.x}
                    y={r.y + 6}
                    textAnchor="middle"
                    fontSize={6}
                    fill="oklch(0.55 0.01 165)"
                    fontFamily="var(--font-geist-mono), monospace"
                    style={{ pointerEvents: "none" }}
                  >
                    {r.shardCount} shards · {r.timezone}
                  </text>
                </g>
              );
            })}

            {/* Links (gossip + merge) */}
            {showLinks && data.links.map((l, i) => {
              const isMerge = l.type === "merge";
              return (
                <line
                  key={`link-${i}`}
                  x1={l.fromX}
                  y1={l.fromY}
                  x2={l.toX}
                  y2={l.toY}
                  stroke={isMerge ? "oklch(0.78 0.16 160)" : "oklch(0.42 0.01 165)"}
                  strokeWidth={isMerge ? 0.8 : 0.4}
                  strokeOpacity={isMerge ? 0.35 : 0.15}
                  strokeDasharray={isMerge ? "4 3" : "2 3"}
                />
              );
            })}

            {/* Shard markers */}
            {data.markers.map((m) => {
              const isHovered = hoveredMarker === m.id;
              const color = STATUS_COLOR[m.status];
              const r = isHovered ? 6 : 4;
              return (
                <g
                  key={m.id}
                  transform={`translate(${m.x},${m.y})`}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredMarker(m.id)}
                  onMouseLeave={() => setHoveredMarker(null)}
                >
                  {/* glow */}
                  <circle r={r + 6} fill={`url(#marker-glow-${m.status})`} />
                  {/* marker */}
                  <circle
                    r={r}
                    fill={color}
                    fillOpacity={0.9}
                    stroke={color}
                    strokeWidth={isHovered ? 2 : 1}
                  />
                  {/* pulse for non-healthy */}
                  {m.status !== "healthy" && (
                    <circle r={r + 2} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.5} className="animate-epistemic-pulse" />
                  )}
                  {/* hover tooltip */}
                  {isHovered && (
                    <g transform="translate(8, -16)">
                      <rect x={0} y={-8} width={140} height={36} rx={3} fill="oklch(0.15 0.01 165)" fillOpacity={0.95} stroke="oklch(0.34 0.01 165)" strokeWidth={0.5} />
                      <text x={4} y={3} fontSize={7} fill="oklch(0.90 0.01 165)" fontFamily="monospace" fontWeight={600}>
                        {m.regionLabel}
                      </text>
                      <text x={4} y={12} fontSize={6} fill="oklch(0.60 0.01 165)" fontFamily="monospace">
                        {m.policyName.slice(0, 20)}
                      </text>
                      <text x={4} y={21} fontSize={6} fill={color} fontFamily="monospace">
                        {m.status} · {m.invariantOk}✓ {m.invariantFail}✗ · {m.peerCount}p
                      </text>
                      <text x={4} y={28} fontSize={5.5} fill="oklch(0.50 0.01 165)" fontFamily="monospace">
                        {m.lat.toFixed(2)}, {m.lng.toFixed(2)} · {m.nodeId}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Globe2 className="h-3 w-3 text-verified" />
            {data.summary.totalRegions} regions
          </span>
          <span className="flex items-center gap-1">
            <Radio className="h-3 w-3 text-repairing" />
            {data.summary.totalLinks} links ({data.summary.mergeLinks} merge)
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-quarantined" />
            avg {data.summary.avgLinkDistanceKm.toLocaleString()}km
          </span>
          <span className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR.healthy }} /> healthy</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR.repairing }} /> repairing</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR.violating }} /> violating</span>
          </span>
        </div>
      </div>
    </Card>
  );
}
