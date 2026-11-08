"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { NMBM_SPATIAL_NODES, type NodeSpatialMarker, type PhysicalObservationVector } from "@/lib/hbk/types";

if (typeof window !== "undefined") {
  try { setWorkerUrl("/maplibre-gl-worker.mjs"); } catch {}
}

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const SATELLITE_STYLE = {
  version: 8,
  sources: {
    "esri-satellite": {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256, attribution: "© Esri", maxzoom: 19,
    },
    "esri-labels": {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256, maxzoom: 19,
    },
  },
  layers: [
    { id: "satellite", type: "raster", source: "esri-satellite" },
    { id: "labels", type: "raster", source: "esri-labels" },
  ],
};

const STATUS_COLORS: Record<string, string> = {
  ONLINE: "#c8ff00",
  WARNING: "#f3e38a",
  CRITICAL: "#e5484d",
  FAIL_CLOSED: "#e5484d",
};

export function CityTwin3DViewport() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, MapLibreMarker>>(new Map());
  const [useSatellite, setUseSatellite] = useState(false);
  const [selectedNode, setSelectedNode] = useState<NodeSpatialMarker>(NMBM_SPATIAL_NODES[0]);
  const [currentVector, setCurrentVector] = useState<PhysicalObservationVector>(NMBM_SPATIAL_NODES[0].metrics);
  const [isSimulatingReplay, setIsSimulatingReplay] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentVector((prev) => ({
        ...prev,
        timestamp: new Date().toISOString(),
        flow_lps: Number((prev.flow_lps + (Math.random() * 0.8 - 0.4)).toFixed(2)),
        pressure_m: Number((prev.pressure_m + (Math.random() * 0.2 - 0.1)).toFixed(2)),
        acoustic_db: Number((prev.acoustic_db + (Math.random() * 0.5 - 0.25)).toFixed(2)),
      }));
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: (useSatellite ? SATELLITE_STYLE : MAP_STYLE) as never,
      center: [25.6022, -33.9608],
      zoom: 14,
      pitch: 45,
      bearing: -17.5,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl(), "top-right");
    map.addControl(new ScaleControl(), "bottom-left");

    map.on("load", () => {
      if (!useSatellite) {
        try {
          const layers = map.getStyle()?.layers || [];
          const labelLayer = layers.find((l) => l.type === "symbol" && (l.layout as { visibility?: string })?.visibility !== "none");
          map.addLayer({
            id: "3d-buildings",
            source: "openmaptiles",
            "source-layer": "building",
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": ["case", ["has", "colour"], ["get", "colour"], "hsl(80, 30%, 35%)"],
              "fill-extrusion-height": ["get", "render_height"],
              "fill-extrusion-base": ["get", "render_min_height"],
              "fill-extrusion-opacity": 0.7,
              "fill-extrusion-vertical-gradient": true,
            },
          } as never, labelLayer?.id);
        } catch {}
      }
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [useSatellite]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const existing = markersRef.current;
    const seen = new Set<string>();

    for (const node of NMBM_SPATIAL_NODES) {
      seen.add(node.id);
      const color = STATUS_COLORS[node.status] ?? "#7a8a6e";
      const isSelected = selectedNode.id === node.id;
      const size = isSelected ? 24 : 16;

      let marker = existing.get(node.id);
      if (!marker) {
        const el = document.createElement("div");
        el.style.cursor = "pointer";
        el.innerHTML = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #060806;box-shadow:0 0 14px ${color};transition:all 0.3s;position:relative;">
          ${node.status !== "ONLINE" ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:1.5px solid ${color};animation:epistemic-pulse 1.5s infinite;"></div>` : ""}
        </div>`;
        el.addEventListener("click", () => { setSelectedNode(node); setCurrentVector(node.metrics); });
        marker = new MapLibreMarker({ element: el, anchor: "center" }).setLngLat(node.coordinates);
        marker.addTo(map);
        existing.set(node.id, marker);
      } else {
        const el = marker.getElement();
        el.innerHTML = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #060806;box-shadow:0 0 14px ${color};transition:all 0.3s;position:relative;">
          ${node.status !== "ONLINE" ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:1.5px solid ${color};animation:epistemic-pulse 1.5s infinite;"></div>` : ""}
        </div>`;
      }
    }

    for (const [id, marker] of existing) {
      if (!seen.has(id)) { marker.remove(); existing.delete(id); }
    }
  }, [selectedNode]);

  return (
    <section className="space-y-4">
      <Card className="bg-card/60 backdrop-blur border-border/60 p-4 relative overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-vvu-lime/30 bg-vvu-lime/10 shrink-0" style={{ borderColor: "rgba(200,255,0,0.3)", background: "rgba(200,255,0,0.1)" }}>
            <span style={{ color: "var(--vvu-lime)", fontSize: "20px" }}>◈</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold flex items-center gap-2">
              CityTwin3D / SEARM1
              <Badge variant="outline" className="text-[9px]" style={{ borderColor: "rgba(200,255,0,0.3)", color: "var(--vvu-lime)" }}>
                DMA-7 NMBM · Gqeberha
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real maplibre-gl tiles · 3D building extrusions · live telemetry · WORM chain
            </p>
          </div>
          <Badge variant="outline" className="text-[9px]" style={{ borderColor: "rgba(200,255,0,0.3)", color: "var(--vvu-lime)" }}>
            EIS v1.0 VERIFIED
          </Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Real map */}
        <Card className="lg:col-span-2 bg-card/60 backdrop-blur border-border/60 p-0 relative overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-border/60">
            <span className="text-xs font-semibold" style={{ color: "var(--vvu-lime)" }}>3D Viewport</span>
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={() => setUseSatellite(!useSatellite)} className={cn("flex items-center gap-1 rounded border px-2 py-1 text-[10px] transition-colors", useSatellite ? "border-vvu-lime/30 bg-vvu-lime/10" : "border-border/60 text-muted-foreground")} style={useSatellite ? { color: "var(--vvu-lime)" } : {}}>
                {useSatellite ? "🛰 Satellite" : "🗺 Vector"}
              </button>
              <button onClick={() => setIsSimulatingReplay(!isSimulatingReplay)} className={cn("flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold transition-colors", isSimulatingReplay ? "bg-violating text-white" : "")} style={!isSimulatingReplay ? { background: "var(--vvu-lime)", color: "var(--vvu-bg)" } : {}}>
                {isSimulatingReplay ? "STOP REPLAY" : "SCADA REPLAY"}
              </button>
            </div>
          </div>
          <div ref={containerRef} style={{ width: "100%", height: "450px" }} />
        </Card>

        {/* Telemetry + node details */}
        <div className="space-y-3">
          <Card className="bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-20" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/60">
                <span style={{ color: "var(--vvu-lime)" }}>⚡</span>
                <span className="text-xs font-bold" style={{ color: "var(--vvu-lime)" }}>Physical Observation Vector O_t</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-background/40 p-2 rounded border border-border/40">
                  <span className="text-[10px] text-muted-foreground block">FLOW (F)</span>
                  <span className="text-base font-bold">{currentVector.flow_lps} <span className="text-xs text-muted-foreground">L/s</span></span>
                </div>
                <div className="bg-background/40 p-2 rounded border border-border/40">
                  <span className="text-[10px] text-muted-foreground block">PRESSURE (P)</span>
                  <span className="text-base font-bold">{currentVector.pressure_m} <span className="text-xs text-muted-foreground">mH₂O</span></span>
                </div>
                <div className="bg-background/40 p-2 rounded border border-border/40">
                  <span className="text-[10px] text-muted-foreground block">ACOUSTIC (A)</span>
                  <span className="text-base font-bold" style={{ color: "var(--vvu-ochre)" }}>{currentVector.acoustic_db} <span className="text-xs text-muted-foreground">dB</span></span>
                </div>
                <div className="bg-background/40 p-2 rounded border border-border/40">
                  <span className="text-[10px] text-muted-foreground block">TEMP (T)</span>
                  <span className="text-base font-bold">{currentVector.temperature_c} <span className="text-xs text-muted-foreground">°C</span></span>
                </div>
              </div>
              <div className="bg-background/60 p-2 rounded border border-border/40 text-[11px] flex justify-between items-center mt-2">
                <span className="text-muted-foreground">🔒 WORM HEAD:</span>
                <span className="font-mono font-bold truncate max-w-[160px]" style={{ color: "var(--vvu-lime)" }}>{currentVector.worm_head_hash}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">Quality:</span>
                <Badge variant="outline" className={cn("text-[9px]", currentVector.quality_flag === "VALID" ? "" : "")} style={currentVector.quality_flag === "VALID" ? { borderColor: "rgba(200,255,0,0.3)", color: "var(--vvu-lime)" } : { borderColor: "rgba(243,227,138,0.3)", color: "var(--vvu-ochre)" }}>
                  {currentVector.quality_flag}
                </Badge>
              </div>
            </div>
          </Card>

          <Card className="bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-20" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/60">
                <span style={{ color: "var(--vvu-lime)" }}>📡</span>
                <span className="text-xs font-bold">NODE: {selectedNode.id}</span>
                <Badge variant="outline" className={cn("text-[9px] ml-auto")} style={{ borderColor: `${STATUS_COLORS[selectedNode.status]}40`, color: STATUS_COLORS[selectedNode.status] }}>
                  {selectedNode.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{selectedNode.name}</p>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-muted-foreground">GPS:</span><span className="font-mono">[{selectedNode.coordinates[0]}, {selectedNode.coordinates[1]}]</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Elevation:</span><span>{selectedNode.elevation_m} m AMSL</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Type:</span><span style={{ color: "var(--vvu-lime)" }} className="font-bold">{selectedNode.type}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Baseline P:</span><span>{selectedNode.metrics.baseline_pressure_m} mH₂O</span></div>
              </div>
            </div>
          </Card>

          <Card className="bg-card/60 backdrop-blur border-border/60 p-3 relative overflow-hidden">
            <div className="bg-grid-fine absolute inset-0 opacity-20" />
            <div className="relative">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Spatial nodes</div>
              <div className="space-y-1">
                {NMBM_SPATIAL_NODES.map((node) => (
                  <button key={node.id} onClick={() => { setSelectedNode(node); setCurrentVector(node.metrics); }} className={cn("flex w-full items-center gap-2 rounded border px-2 py-1.5 text-[11px] transition-colors", selectedNode.id === node.id ? "border-vvu-lime/30 bg-vvu-lime/5" : "border-border/40 hover:border-border")} style={selectedNode.id === node.id ? { borderColor: "rgba(200,255,0,0.3)" } : {}}>
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: STATUS_COLORS[node.status] }} />
                    <span className="font-mono truncate">{node.id}</span>
                    <span className="text-muted-foreground truncate ml-auto">{node.name.slice(0, 20)}</span>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
