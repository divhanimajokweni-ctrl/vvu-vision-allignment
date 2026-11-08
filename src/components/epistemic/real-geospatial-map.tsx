"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  NavigationControl,
  ScaleControl,
  Popup,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Configure worker once
if (typeof window !== "undefined") {
  try { setWorkerUrl("/maplibre-gl-worker.mjs"); } catch {}
}

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
// Satellite overlay via ESRI (free, no key needed)
const SATELLITE_STYLE = {
  version: 8,
  sources: {
    "esri-satellite": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "© Esri",
      maxzoom: 19,
    },
    "esri-labels": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    { id: "satellite", type: "raster", source: "esri-satellite" },
    { id: "labels", type: "raster", source: "esri-labels" },
  ],
};

// Shard positions (real lat/lng from our spatial.ts)
const SHARD_LOCATIONS = [
  { id: "europe-west", label: "Western Europe", lat: 50.11, lng: 8.68, status: "healthy", policy: "grid_frequency_stability" },
  { id: "europe-north", label: "Northern Europe", lat: 59.33, lng: 18.07, status: "violating", policy: "grid_frequency_stability" },
  { id: "na-east", label: "NA East", lat: 40.71, lng: -74.01, status: "repairing", policy: "fleet_safety_envelope" },
  { id: "na-west", label: "NA West", lat: 37.77, lng: -122.42, status: "healthy", policy: "fleet_safety_envelope" },
  { id: "apac-south", label: "APAC South", lat: 1.35, lng: 103.82, status: "healthy", policy: "cold_chain_integrity" },
  { id: "apac-east", label: "APAC East", lat: 35.68, lng: 139.69, status: "healthy", policy: "cold_chain_integrity" },
  { id: "za-ec", label: "Eastern Cape (Gqeberha)", lat: -33.96, lng: 25.60, status: "healthy", policy: "water_treatment_safety" },
  { id: "za-wc", label: "Western Cape", lat: -33.92, lng: 18.42, status: "healthy", policy: "water_treatment_safety" },
  { id: "za-gp", label: "Gauteng", lat: -26.20, lng: 28.05, status: "repairing", policy: "financial_ledger_integrity" },
  { id: "za-lp", label: "Limpopo", lat: -23.90, lng: 29.45, status: "healthy", policy: "financial_ledger_integrity" },
];

const STATUS_COLORS: Record<string, string> = {
  healthy: "#c8ff00",
  repairing: "#f3e38a",
  violating: "#e5484d",
};

interface RealGeospatialMapProps {
  satellite?: boolean;
  height?: number;
}

export function RealGeospatialMap({ satellite = false, height = 400 }: RealGeospatialMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, MapLibreMarker>>(new Map());
  const [useSatellite, setUseSatellite] = useState(satellite);
  const [selectedShard, setSelectedShard] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: (useSatellite ? SATELLITE_STYLE : MAP_STYLE) as never,
      center: [20, -15],
      zoom: 1.5,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(new NavigationControl(), "top-right");
    map.addControl(new ScaleControl(), "bottom-left");

    map.on("load", () => {
      // Add 3D buildings if using the liberty style
      if (!useSatellite) {
        try {
          const layers = map.getStyle()?.layers || [];
          const labelLayer = layers.find(
            (l) => l.type === "symbol" && (l.layout as { visibility?: string })?.visibility !== "none",
          );
          map.addLayer(
            {
              id: "3d-buildings",
              source: "openmaptiles",
              "source-layer": "building",
              type: "fill-extrusion",
              minzoom: 14,
              paint: {
                "fill-extrusion-color": [
                  "case",
                  ["has", "colour"],
                  ["get", "colour"],
                  "hsl(80, 30%, 35%)",
                ],
                "fill-extrusion-height": ["get", "render_height"],
                "fill-extrusion-base": ["get", "render_min_height"],
                "fill-extrusion-opacity": 0.65,
                "fill-extrusion-vertical-gradient": true,
              },
            } as never,
            labelLayer?.id,
          );
        } catch {
          // OpenFreeMap may already include 3D buildings
        }
      }
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [useSatellite]);

  // Sync markers
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const existing = markersRef.current;
    const seen = new Set<string>();

    for (const shard of SHARD_LOCATIONS) {
      seen.add(shard.id);
      const color = STATUS_COLORS[shard.status] ?? "#7a8a6e";
      const isSelected = selectedShard === shard.id;

      let marker = existing.get(shard.id);
      if (!marker) {
        const el = document.createElement("div");
        el.style.cursor = "pointer";
        el.innerHTML = `<div style="width:${isSelected ? 20 : 14}px;height:${isSelected ? 20 : 14}px;border-radius:50%;background:${color};border:2px solid #060806;box-shadow:0 0 12px ${color};transition:all 0.3s;"></div>`;
        el.addEventListener("click", () => setSelectedShard(shard.id));
        marker = new MapLibreMarker({ element: el, anchor: "center" }).setLngLat([shard.lng, shard.lat]);
        marker.addTo(map);
        existing.set(shard.id, marker);
      } else {
        const el = marker.getElement();
        el.innerHTML = `<div style="width:${isSelected ? 20 : 14}px;height:${isSelected ? 20 : 14}px;border-radius:50%;background:${color};border:2px solid #060806;box-shadow:0 0 12px ${color};transition:all 0.3s;"></div>`;
      }
    }

    // Remove markers no longer in the list
    for (const [id, marker] of existing) {
      if (!seen.has(id)) {
        marker.remove();
        existing.delete(id);
      }
    }
  }, [selectedShard]);

  const toggleSatellite = () => {
    setUseSatellite((s) => !s);
  };

  return (
    <Card className="bg-card/60 backdrop-blur border-border/60 p-0 relative overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-border/60">
        <span className="text-xs font-semibold" style={{ color: "var(--vvu-lime)" }}>Geospatial Topology</span>
        <Badge variant="outline" className="text-[9px] border-vvu-sage/30" style={{ color: "var(--vvu-sage-bright)" }}>
          {SHARD_LOCATIONS.length} shards · real tiles
        </Badge>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={toggleSatellite}
            className={cn(
              "flex items-center gap-1 rounded border px-2 py-1 text-[10px] transition-colors",
              useSatellite
                ? "border-vvu-lime/30 bg-vvu-lime/10"
                : "border-border/60 text-muted-foreground",
            )}
            style={useSatellite ? { color: "var(--vvu-lime)" } : {}}
          >
            {useSatellite ? "🛰 Satellite" : "🗺 Vector"}
          </button>
        </div>
      </div>
      <div ref={containerRef} style={{ width: "100%", height: `${height}px` }} />
      {selectedShard && (
        <div className="absolute bottom-3 left-3 z-10 bg-background/90 backdrop-blur border border-border/60 rounded-lg p-3 max-w-xs">
          {(() => {
            const s = SHARD_LOCATIONS.find((x) => x.id === selectedShard);
            if (!s) return null;
            const color = STATUS_COLORS[s.status];
            return (
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                  <span className="font-bold">{s.label}</span>
                </div>
                <div className="text-muted-foreground font-mono text-[10px]">{s.id}</div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">status:</span>
                  <span style={{ color }}>{s.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">policy:</span>
                  <span className="font-mono text-[10px]">{s.policy}</span>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {s.lat.toFixed(4)}°, {s.lng.toFixed(4)}°
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </Card>
  );
}
