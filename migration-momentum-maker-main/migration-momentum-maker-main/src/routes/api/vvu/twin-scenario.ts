import { createFileRoute } from "@tanstack/react-router";
import html0 from "../../../../public/twin/cape_town_wildfire.html?raw";
import html1 from "../../../../public/twin/dark_tiles.html?raw";
import html2 from "../../../../public/twin/geo_bioteknik.html?raw";
import html3 from "../../../../public/twin/google_photorealistic.html?raw";
import html4 from "../../../../public/twin/openlayers_tiles.html?raw";
import html5 from "../../../../public/twin/openmaptiles_3d.html?raw";

const SURFACE_META = {
  cape_town_wildfire: {
    title: "Municipal Twin — Cape Town Wildfire",
    subtitle: "Canvas 2D · single file · zero deps · golden-hour scenario",
    style: "Canvas 2D",
    tileKind: "canvas",
  },
  google_photorealistic: {
    title: "Digital Twin — Google Photorealistic Tiles",
    subtitle: "Satellite · 3D mesh · MapLibre GL · photo true-color",
    style: "Google Photoreal",
    tileKind: "photoreal",
  },
  openlayers_tiles: {
    title: "Digital Twin — OpenLayers Tiles",
    subtitle: "OSM standard raster · EPSG:3857 · OpenLayers 9.2",
    style: "OpenLayers",
    tileKind: "openlayers",
  },
  dark_tiles: {
    title: "Digital Twin — Dark Tiles",
    subtitle: "CartoDB Dark Matter · Leaflet 1.9 · Gqeberha edge",
    style: "Dark Matter",
    tileKind: "dark",
  },
  openmaptiles_3d: {
    title: "Digital Twin — OpenMapTiles 3D",
    subtitle: "Vector · 3D buildings · MapLibre 4.7 · terrain mesh",
    style: "OpenMapTiles 3D",
    tileKind: "openmaptiles3d",
  },
  geo_bioteknik: {
    title: "Geo-Bioteknik · Spatial Intelligence",
    subtitle: "VVB engine · genomic terrain · living mesh · consequence map",
    style: "Geo-Bioteknik SI",
    tileKind: "engine",
  },
};

const html: Record<string, string> = {
  cape_town_wildfire: html0,
  dark_tiles: html1,
  geo_bioteknik: html2,
  google_photorealistic: html3,
  openlayers_tiles: html4,
  openmaptiles_3d: html5,
};
const facts: Record<string, { md5: string; bytes: number; mtime: string }> = {
  cape_town_wildfire: {
    md5: "0872178c9db3e281ac6343e2fde9aad8",
    bytes: 22256,
    mtime: "2026-11-01T17:35:51.858946Z",
  },
  dark_tiles: {
    md5: "b9c9d5557ad4d7c3c7939c059e7b2132",
    bytes: 9910,
    mtime: "2026-11-01T17:35:51.858779Z",
  },
  geo_bioteknik: {
    md5: "209d443bd73883ca77e2482c6bfde568",
    bytes: 14244,
    mtime: "2026-11-01T17:35:51.860509Z",
  },
  google_photorealistic: {
    md5: "f8e3c624fddea3e3e180272aa536ae00",
    bytes: 11302,
    mtime: "2026-11-01T17:35:51.860721Z",
  },
  openlayers_tiles: {
    md5: "7842729c9a9e4e72a6486caa923950da",
    bytes: 9804,
    mtime: "2026-11-01T17:35:51.858128Z",
  },
  openmaptiles_3d: {
    md5: "c865c79eaca1ee9591af60b3238b04e0",
    bytes: 10662,
    mtime: "2026-11-01T17:35:51.859883Z",
  },
};
const metadata: Record<
  string,
  { title: string; subtitle: string; style: string; tileKind: string }
> = SURFACE_META;
function surfaces() {
  return Object.keys(html).map((id) => ({
    id,
    ...metadata[id],
    path: `public/twin/${id}.html`,
    ...facts[id],
  }));
}
export const Route = createFileRoute("/api/vvu/twin-scenario")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams,
          servedAt = new Date().toISOString();
        if (q.get("list") === "1") return Response.json({ surfaces: surfaces(), servedAt });
        const id = q.get("scenario") ?? "cape_town_wildfire";
        if (!/^[\w.-]+$/.test(id))
          return Response.json({ error: "INVALID_SCENARIO_ID" }, { status: 400 });
        if (!Object.hasOwn(html, id))
          return Response.json(
            { error: `SCENARIO_NOT_FOUND: ${id}`, available: Object.keys(html) },
            { status: 404 },
          );
        if (q.get("meta") === "1")
          return Response.json({
            id,
            ...facts[id],
            path: `public/twin/${id}.html`,
            ...metadata[id],
            servedAt,
            honesty: "SEED DATA · NOT LIVE",
          });
        return new Response(html[id], {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "X-Artifact-Md5": facts[id].md5,
            "X-Artifact-Bytes": String(facts[id].bytes),
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
