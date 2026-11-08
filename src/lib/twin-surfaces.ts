// src/lib/twin-surfaces.ts — the digital twin surface registry. The single
// source of truth for which surfaces live under the #/twin tab. Each entry
// maps to an artifact in public/twin/<id>.html served via
// /api/vvu/twin-scenario?scenario=<id>.
//
// The registry is the contract between:
//   · the API route           (serves the artifact bytes + facts)
//   · the SurfaceSidebar      (the left rail — pick a surface)
//   · the TileSelector        (the bottom-right icon cluster — quick-flip
//                              between the four tile styles + the engine)
//   · the Geo-Bioteknik badge (engine surface promoted as the estate's own)
//
// Adding a surface: drop the HTML in public/twin/, add the entry here. The
// sidebar + tile selector pick it up automatically; the API route already
// serves any *.html in that folder.

export type TwinTileKind =
  | "photoreal" // Google Maps photo-realistic 3D tiles
  | "openlayers" // OpenLayers OSM standard
  | "dark" // CartoDB Dark Matter (Leaflet)
  | "openmaptiles3d" // OpenMapTiles 3D (MapLibre)
  | "engine" // Geo-Bioteknik Spatial Intelligence engine
  | "canvas"; // The Cape Town wildfire scenario (Canvas 2D)

export type TwinSurface = {
  id: string;
  title: string;
  shortLabel: string; // tile-selector tooltip + sidebar chip
  subtitle: string;
  style: string;
  tileKind: TwinTileKind;
  /** The icon key — see TileSelector.tsx for the icon atlas. */
  icon: "photoreal" | "openlayers" | "dark" | "openmaptiles3d" | "engine" | "canvas" | "wildfire";
  /** Whether the surface is shown by default in the tile selector. */
  pinned: boolean;
  /** Accent color (Tailwind literal, NOT indigo/blue per estate rules). */
  accent: string;
};

export const TWIN_SURFACES: readonly TwinSurface[] = [
  {
    id: "cape_town_wildfire",
    title: "Municipal Twin — Cape Town Wildfire",
    shortLabel: "WILDFIRE",
    subtitle: "Canvas 2D · single file · zero deps · golden-hour scenario",
    style: "Canvas 2D",
    tileKind: "canvas",
    icon: "wildfire",
    pinned: true,
    accent: "#ff5a3d",
  },
  {
    id: "google_photorealistic",
    title: "Digital Twin — Google Photorealistic Tiles",
    shortLabel: "PHOTOREAL",
    subtitle: "Satellite · 3D mesh · MapLibre GL · photo true-color",
    style: "Google Photoreal",
    tileKind: "photoreal",
    icon: "photoreal",
    pinned: true,
    accent: "#4285f4",
  },
  {
    id: "openlayers_tiles",
    title: "Digital Twin — OpenLayers Tiles",
    shortLabel: "OPENLAYERS",
    subtitle: "OSM standard raster · EPSG:3857 · OpenLayers 9.2",
    style: "OpenLayers",
    tileKind: "openlayers",
    icon: "openlayers",
    pinned: true,
    accent: "#58a6ff",
  },
  {
    id: "dark_tiles",
    title: "Digital Twin — Dark Tiles",
    shortLabel: "DARK",
    subtitle: "CartoDB Dark Matter · Leaflet 1.9 · Gqeberha edge",
    style: "Dark Matter",
    tileKind: "dark",
    icon: "dark",
    pinned: true,
    accent: "#a371f7",
  },
  {
    id: "openmaptiles_3d",
    title: "Digital Twin — OpenMapTiles 3D",
    shortLabel: "3D MVT",
    subtitle: "Vector · 3D buildings · MapLibre 4.7 · terrain mesh",
    style: "OpenMapTiles 3D",
    tileKind: "openmaptiles3d",
    icon: "openmaptiles3d",
    pinned: true,
    accent: "#3fb950",
  },
  {
    id: "geo_bioteknik",
    title: "Geo-Bioteknik · Spatial Intelligence",
    shortLabel: "GEO-BIO",
    subtitle: "VVB engine · genomic terrain · living mesh · consequence map",
    style: "Geo-Bioteknik SI",
    tileKind: "engine",
    icon: "engine",
    pinned: true,
    accent: "#52d49a",
  },
  {
    id: "vv-fail-closed",
    title: "VVU Fail-Closed — Empty State / Digital Turn-Off",
    shortLabel: "FAIL-CLOSED",
    subtitle: "15s circuit breaker · absence receipted · no primitives · mobile-first",
    style: "Fail-Closed",
    tileKind: "engine",
    icon: "engine",
    pinned: true,
    accent: "#e5484d",
  },
  {
    id: "isuzu-industrial-twin",
    title: "Industrial Twin Estate — Isuzu D-MAX (consolidated)",
    shortLabel: "ISUZU",
    subtitle: "Single coherent GLB · no primitives · fail-closed · low-RAM",
    style: "Industrial",
    tileKind: "engine",
    icon: "engine",
    pinned: true,
    accent: "#a3e635",
  },
] as const;

export const DEFAULT_TWIN_SURFACE_ID = "cape_town_wildfire";

export function getSurface(id: string | null | undefined): TwinSurface {
  if (!id) return TWIN_SURFACES[0];
  return TWIN_SURFACES.find((s) => s.id === id) ?? TWIN_SURFACES[0];
}
