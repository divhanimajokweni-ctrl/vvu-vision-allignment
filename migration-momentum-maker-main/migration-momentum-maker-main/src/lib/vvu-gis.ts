// src/lib/vvu-gis.ts — City Digital Twin GIS bench spec (SYS.02 / SYS.03).
// Single source of truth shared by the backend status routes
// (/api/gis/status, /api/yolo/status) and the HUD panels so the picture spec
// can never drift between server and client.
//
// Spec source: wa_image_8183522056652419501 (SYS.02 GIS SPATIAL TRUTH
// [ALIGNED] · SYS.03 YOLO EDGE AI [ACTIVE]) with NYC demo coords converted
// to the South African pilot anchors:
//   PE / Gqeberha  -33.9608,  25.6022  → S33°57'38" E25°36'07"
//   JHB / Vanderbijlpark corridor -26.137, 27.921 → S26°08'13" E27°55'16"

export type GisLayerId = "L1" | "L2" | "L3" | "L4" | "L5";

export interface GisLayerDef {
  id: GisLayerId;
  name: string;
  detail: string;
}

/** The 5 ACTIVE bench layers (picture spec). */
export const GIS_LAYERS: readonly GisLayerDef[] = [
  { id: "L1", name: "INFRA", detail: "DN300 pipeline mains + N01–N06 node pods" },
  { id: "L2", name: "FLOW", detail: "live hydraulic flow dashes along mains" },
  { id: "L3", name: "POWER", detail: "catenary feed lines + substation pulse" },
  { id: "L4", name: "YOLO", detail: "25R edge-ai tracked objects on roads" },
  { id: "L5", name: "THREAT", detail: "critical-alert heatmap overlay" },
] as const;

export const ALL_GIS_LAYERS: ReadonlySet<GisLayerId> = new Set(GIS_LAYERS.map((l) => l.id));

// ── SYS.02 · GIS SPATIAL TRUTH ──────────────────────────────────────────────

export const GIS_SPEC = {
  mapSync: true,
  /** Baseline active layer count (all five on). */
  layers: 5,
  accuracy: 99.9,
  updateRt: "LIVE",
  source: "GEO_GRID",
  engineOnline: "ONLINE",
  engineOffline: "OFFLINE",
} as const;

export const GIS_ANCHORS = {
  pe: {
    city: "GQEBERHA · PE PILOT",
    lat: -33.9608,
    lon: 25.6022,
    dms: `S33°57'38" E25°36'07"`,
  },
  jhb: {
    city: "JHB CORRIDOR · VANDERBIJLPARK",
    lat: -26.137,
    lon: 27.921,
    dms: `S26°08'13" E27°55'16"`,
  },
} as const;

/** Compact DMS string used by the API response (PE pilot primary anchor). */
export const GIS_COORDS_PRIMARY = GIS_ANCHORS.pe.dms;

// ── SYS.03 · YOLO EDGE AI ───────────────────────────────────────────────────

export const YOLO_SPEC = {
  detection: "ON",
  tracked: 25,
  alerts: 14,
  model: "V8_NANO",
  modelLabel: "V8 NANO",
  confidence: 0.95,
  confidenceLabel: ">95%",
  processTimeMs: 22,
  threat: "ELEVATED",
} as const;

// ── API response contracts ──────────────────────────────────────────────────

export interface GisStatusResponse {
  map_sync: boolean;
  layers: number;
  accuracy: number;
  coords: string;
  source: string;
  engine: string;
  update_rt: string;
  anchors: {
    pe: { city: string; lat: number; lon: number; dms: string };
    jhb: { city: string; lat: number; lon: number; dms: string };
  };
  ts: string;
}

export interface YoloStatusResponse {
  detection: string;
  tracked: number;
  alerts: number;
  model: string;
  confidence: number;
  process_time_ms: number;
  threat: string;
  engine: string;
  ts: string;
}

// ── EDGE-cold fallback telemetry (N01–N06 city node cards) ──────────────────

/** Spec fallbacks shown on the city node cards when the EDGE link is cold. */
export const EDGE_COLD_FALLBACK = {
  flowLps: 12.4,
  levelM: 42.3,
  tempC: 46.4,
} as const;

/** N01–N06 are the nodes embedded ON the city pipelines (of the 12-node rig). */
export const CITY_NODE_IDS = ["N01", "N02", "N03", "N04", "N05", "N06"] as const;
export type CityNodeId = (typeof CITY_NODE_IDS)[number];
