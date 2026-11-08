"use client";

import {
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  NavigationControl,
  ScaleControl,
  LngLatBounds,
  setWorkerUrl,
  type FillExtrusionLayerSpecification,
  type SkySpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { skylanternConfig } from "../config";
import { jitter } from "../lib/geo";
import type { EvidenceRecordDTO } from "../types";
import { verificationColor } from "../lib/format";
import { useSkylanternStore } from "../hooks/useSkylanternStore";

// Configure the maplibre-gl worker URL once at module load. Next.js Turbopack
// doesn't resolve maplibre's default `import.meta.url`-based worker path, so
// we ship the worker file from /public and point to it explicitly.
if (typeof window !== "undefined") {
  try {
    setWorkerUrl("/maplibre-gl-worker.mjs");
  } catch {
    // already set — ignore
  }
}

interface SkylanternMapProps {
  evidence: EvidenceRecordDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * The digital twin's geographic canvas.
 *
 *   - maplibre-gl vector basemap (OpenFreeMap "liberty" by default — free, no
 *     API key; the canonical maptiler-3d-gl-style.json is used when the host
 *     provides a MAPTILER_KEY).
 *   - 3D buildings via a fill-extrusion layer overlaid on the building
 *     source-layer (mirrors the maptiler-3d-gl-style `building-3d` recipe).
 *   - Sky lanterns rendered as maplibre-gl markers at each evidence record's
 *     geo coordinates. Color encodes verification state. The head-of-chain
 *     lantern is bigger and pulses. Selected lantern carries a ring.
 */
export function SkylanternMap({ evidence, selectedId, onSelect }: SkylanternMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, MapLibreMarker>>(new Map());
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  const { devices } = useSkylanternStore();

  // ---- init map once ----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: skylanternConfig.mapStyleUrl,
      center: skylanternConfig.mapCenter,
      zoom: skylanternConfig.mapZoom,
      pitch: skylanternConfig.mapPitch,
      bearing: skylanternConfig.mapBearing,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      add3DBuildings(map);
      addAtmosphere(map);
    });

    map.addControl(
      new NavigationControl({
        visualizePitch: true,
        showZoom: true,
        showCompass: true,
      }),
      "top-right"
    );
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---- fit to data on first device arrival ----
  const hasFittedRef = useRef(false);
  useEffect(() => {
    if (!mapRef.current || devices.length === 0 || hasFittedRef.current) return;
    const map = mapRef.current;
    if (!map.isStyleLoaded()) {
      map.once("idle", () => {
        const bounds = new LngLatBounds();
        devices.forEach((d) => bounds.extend([d.lng, d.lat]));
        try {
          map.fitBounds(bounds, { padding: 100, maxZoom: 14.5 });
          hasFittedRef.current = true;
        } catch {
          // ignore
        }
      });
      return;
    }
    const bounds = new LngLatBounds();
    devices.forEach((d) => bounds.extend([d.lng, d.lat]));
    try {
      map.fitBounds(bounds, { padding: 100, maxZoom: 14.5 });
      hasFittedRef.current = true;
    } catch {
      // ignore
    }
  }, [devices]);

  // ---- sync lantern markers ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const ready = () => {
      syncMarkers(
        map,
        evidence,
        selectedId,
        onSelectRef.current,
        markersRef.current
      );
    };
    if (map.isStyleLoaded()) {
      ready();
    } else {
      map.once("idle", ready);
    }
  }, [evidence, selectedId]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full bg-slate-950"
      />
      {/* Vignette so the map blends into the dark dashboard chrome */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(2,6,23,0.55)_100%)]" />
      <MapLegend />
      {/* Crosshair / scanline aesthetic */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:48px_48px]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3D buildings — mirrors the maptiler-3d-gl-style `building-3d` fill-extrusion
// recipe (slide 1 image, layer id `building-3d` in style.json).
// ---------------------------------------------------------------------------

function add3DBuildings(map: MapLibreMap) {
  if (!skylanternConfig.enable3DBuildings) return;
  const layers = map.getStyle()?.layers ?? [];
  // Find the first symbol layer so we can insert 3D buildings underneath it.
  let labelLayerId: string | undefined;
  for (const l of layers) {
    if (l.type === "symbol" && l.layout && (l.layout as { "text-field"?: unknown })["text-field"]) {
      labelLayerId = l.id;
      break;
    }
  }
  const id = "skylantern-3d-buildings";
  if (map.getLayer(id)) return;
  try {
    map.addLayer(
      {
        id,
        source: "openmaptiles",
        "source-layer": "building",
        type: "fill-extrusion",
        minzoom: 13,
        filter: ["all", ["!", ["has", "hide_3d"]], ["==", ["geometry-type"], "Polygon"]],
        paint: {
          "fill-extrusion-base": {
            property: "render_min_height",
            type: "identity",
          },
          "fill-extrusion-height": {
            property: "render_height",
            type: "identity",
          },
          "fill-extrusion-color": [
            "case",
            ["has", "colour"],
            ["get", "colour"],
            "hsl(39, 41%, 78%)",
          ],
          "fill-extrusion-opacity": 0.78,
          "fill-extrusion-vertical-gradient": true,
        },
      } as FillExtrusionLayerSpecification,
      labelLayerId
    );
  } catch (e) {
    // OpenFreeMap "liberty" may already include 3d buildings; ignore if duplicate.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[skylantern] 3d buildings layer not added", e);
    }
  }
}

function addAtmosphere(map: MapLibreMap) {
  // Soft atmospheric haze — matches the dusk sky-lantern mood.
  try {
    map.setSky({
      "sky-color": "#0b1220",
      "horizon-color": "#1e293b",
      "fog-color": "#0f172a",
      "fog-ground-blend": 0.5,
      "sky-horizon-blend": 0.5,
    } as SkySpecification);
  } catch {
    // Sky API is optional; some style versions don't support it.
  }
}

// ---------------------------------------------------------------------------
// Marker sync — diff the existing markers against the evidence list.
// ---------------------------------------------------------------------------

function syncMarkers(
  map: MapLibreMap,
  evidence: EvidenceRecordDTO[],
  selectedId: string | null,
  onSelect: (id: string) => void,
  store: Map<string, MapLibreMarker>
) {
  const existing = store;
  const seen = new Set<string>();

  const maxSeq = evidence.reduce(
    (m, e) => Math.max(m, e.sequence),
    0
  );

  for (const ev of evidence) {
    seen.add(ev.id);
    const [lng, lat] = jitter(ev.lng, ev.lat, ev.sequence, 0.0006);
    const isHead = ev.sequence === maxSeq;
    const isSelected = ev.id === selectedId;

    let marker = existing.get(ev.id);
    if (!marker) {
      const el = buildLanternElement(ev, isHead, isSelected, () =>
        onSelect(ev.id)
      );
      marker = new MapLibreMarker({
        element: el,
        anchor: "bottom",
      }).setLngLat([lng, lat]);
      marker.addTo(map);
      existing.set(ev.id, marker);
    } else {
      marker.setLngLat([lng, lat]);
      const next = buildLanternElement(ev, isHead, isSelected, () =>
        onSelect(ev.id)
      );
      marker.getElement().replaceWith(next);
    }
  }

  // Remove markers for evidence that's no longer in the list.
  for (const [id, marker] of existing) {
    if (!seen.has(id)) {
      marker.remove();
      existing.delete(id);
    }
  }
}

function buildLanternElement(
  ev: EvidenceRecordDTO,
  isHead: boolean,
  isSelected: boolean,
  onClick: () => void
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "skylantern-marker";
  wrap.style.position = "relative";
  wrap.style.cursor = "pointer";
  wrap.style.transform = "translateZ(0)";
  wrap.style.willChange = "transform";
  wrap.dataset.evidenceId = ev.id;
  wrap.dataset.state = ev.verificationState;

  const size = isHead ? 56 : 40;
  const color = verificationColor(ev.verificationState);

  // Glow
  const glow = document.createElement("div");
  glow.style.position = "absolute";
  glow.style.inset = `-${size * 0.3}px`;
  glow.style.borderRadius = "50%";
  glow.style.background = `radial-gradient(circle, ${color}66 0%, transparent 70%)`;
  glow.style.filter = "blur(8px)";
  glow.style.animation = "skylantern-pulse 2.4s ease-in-out infinite";
  wrap.appendChild(glow);

  // Body — CSS paper lantern
  const body = document.createElement("div");
  body.style.position = "relative";
  body.style.width = `${size}px`;
  body.style.height = `${size * 1.5}px`;
  body.style.animation = `skylantern-bob ${isHead ? 2.2 : 3.4}s ease-in-out infinite`;
  body.style.animationDelay = `${(ev.sequence % 7) * 0.2}s`;

  body.innerHTML = `
    <svg width="${size}" height="${size * 1.5}" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lantern-grad-${ev.id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="1"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0.55"/>
        </linearGradient>
      </defs>
      <ellipse cx="12" cy="6" rx="2.2" ry="3.4" fill="${color}" opacity="0.92"/>
      <ellipse cx="12" cy="5" rx="1" ry="2" fill="#fff7ed" opacity="0.95"/>
      <rect x="9" y="9" width="6" height="1.1" rx="0.5" fill="${color}"/>
      <path d="M5 11 H19 V20 Q19 24 12 25 Q5 24 5 20 Z" fill="url(#lantern-grad-${ev.id})" stroke="${color}" stroke-width="1.1"/>
      <line x1="12" y1="11" x2="12" y2="25" stroke="${color}" stroke-width="0.5" opacity="0.7"/>
      <rect x="8.5" y="25" width="7" height="1.1" rx="0.5" fill="${color}"/>
      <line x1="12" y1="26" x2="12" y2="33" stroke="${color}" stroke-width="0.5" stroke-dasharray="1 1.4" opacity="0.6"/>
    </svg>
  `;
  wrap.appendChild(body);

  // Selection ring
  if (isSelected) {
    const ring = document.createElement("div");
    ring.style.position = "absolute";
    ring.style.left = "50%";
    ring.style.top = `${size * 0.45}px`;
    ring.style.transform = "translateX(-50%)";
    ring.style.width = `${size * 1.4}px`;
    ring.style.height = `${size * 1.4}px`;
    ring.style.border = `1.5px solid ${color}`;
    ring.style.borderRadius = "50%";
    ring.style.boxShadow = `0 0 12px ${color}`;
    ring.style.animation = "skylantern-ring 1.8s ease-in-out infinite";
    wrap.appendChild(ring);
  }

  // Head-of-chain sequence badge
  if (isHead) {
    const badge = document.createElement("div");
    badge.style.position = "absolute";
    badge.style.top = "-4px";
    badge.style.left = "50%";
    badge.style.transform = "translateX(-50%)";
    badge.style.background = color;
    badge.style.color = "#0b1220";
    badge.style.fontSize = "9px";
    badge.style.fontWeight = "700";
    badge.style.fontFamily = "ui-monospace, monospace";
    badge.style.padding = "1px 6px";
    badge.style.borderRadius = "999px";
    badge.style.letterSpacing = "0.08em";
    badge.style.boxShadow = `0 0 8px ${color}`;
    badge.textContent = `#${ev.sequence} HEAD`;
    wrap.appendChild(badge);
  }

  wrap.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });

  return wrap;
}

function MapLegend() {
  const legend: { state: EvidenceRecordDTO["verificationState"]; label: string }[] = [
    { state: "CANDIDATE", label: "Candidate · awaiting corroboration" },
    { state: "VERIFIED", label: "Verified · court-grade R2" },
    { state: "TAMPER_DETECTED", label: "Tamper Detected · never silent" },
    { state: "ARCHIVED", label: "Archived" },
  ];
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-col gap-1 rounded-md border border-slate-700/60 bg-slate-950/70 px-3 py-2 backdrop-blur">
      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
        Verification States
      </div>
      {legend.map((l) => (
        <div key={l.state} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: verificationColor(l.state) }}
          />
          <span className="text-[11px] text-slate-300">{l.label}</span>
        </div>
      ))}
    </div>
  );
}

// Marker CSS lives in globals.css; this portal keeps it scoped visually to the map.
export function SkylanternMapStyles() {
  if (typeof document === "undefined") return null;
  return createPortal(<></>, document.head);
}
