# Digital Twin Surfaces · VVU Estate

> The estate's `#/twin` tab is now a **surface registry** — every tile style
> and the Geo-Bioteknik Spatial Intelligence engine lives under one tab,
> picked from the left rail (`SurfaceSidebar`) or the bottom-right icon
> cluster (`TileSelector`).

## The six surfaces

| id                      | style            | tile kind      | engine                                                       |
| ----------------------- | ---------------- | -------------- | ------------------------------------------------------------ |
| `cape_town_wildfire`    | Canvas 2D        | canvas         | single-file, zero-deps golden-hour scenario                  |
| `google_photorealistic` | Google Photoreal | photoreal      | MapLibre GL · satellite + 3D mesh                            |
| `openlayers_tiles`      | OpenLayers       | openlayers     | OpenLayers 9.2 · OSM standard raster                         |
| `dark_tiles`            | Dark Matter      | dark           | Leaflet 1.9 · CartoDB Dark All                               |
| `openmaptiles_3d`       | OpenMapTiles 3D  | openmaptiles3d | MapLibre 4.7 · vector + 3D building extrusions               |
| `geo_bioteknik`         | Geo-Bioteknik SI | engine         | VVB-SI 2.7 · genomic terrain + living mesh + consequence map |

## Files in this bundle

```
twin-surfaces/
├── README.md                          ← this file
├── cape_town_wildfire.html            ← the original municipal twin
├── google_photorealistic.html         ← Google Maps photo-realistic 3D tiles
├── openlayers_tiles.html              ← OpenLayers OSM standard raster
├── dark_tiles.html                    ← CartoDB Dark Matter (Leaflet)
├── openmaptiles_3d.html               ← OpenMapTiles 3D (MapLibre)
└── geo_bioteknik.html                 ← Geo-Bioteknik Spatial Intelligence engine
```

## Each surface is byte-for-byte standalone

Drop any of these files in a browser — they render without the dashboard.
The estate's `#/twin` tab frames each as a browser tab would: the artifact
is the source; the view does not fork it, does not restyle it, does not
inject into it.

## The bottom-right tile selector

Five icons, each a tile style (or the estate's own engine):

- **PHOTOREAL** — Google Maps photo-realistic 3D tiles
- **OPENLAYERS** — OpenLayers OSM standard raster
- **DARK** — CartoDB Dark Matter (subdued basemap)
- **3D MVT** — OpenMapTiles 3D (vector + extrude)
- **GEO-BIO** — Geo-Bioteknik Spatial Intelligence engine

Click an icon to flip the surface. Each switch is WORM-logged
(`TILE_SWITCH · OPERATOR · surface=…`).

## Honesty

Every surface carries:

- a **disk-canonical** provenance rail (path + bytes + md5, computed from
  disk on every request — never hardcoded)
- a **SEED DATA · NOT LIVE** honesty chip (the mesh dots / devices are
  seeded positions, not live member devices — the live wiring is the named
  next artifact)
- a **WORM LEDGER PIN** (Option 1: runtime toggle of the artifact's own
  WORM strip via `iframe.contentDocument` — the artifact bytes stay
  untouched)
- an **OPEN STANDALONE** button (the drop-it-in-a-browser path,
  WORM-logged)

## Integration

The `#/twin` tab uses:

- **API**: `GET /api/vvu/twin-scenario?list=1` (registry)
  `GET /api/vvu/twin-scenario?scenario=<id>` (artifact)
  `GET /api/vvu/twin-scenario?scenario=<id>&meta=1` (facts)
- **Registry**: `src/lib/twin-surfaces.ts` (the single source of truth)
- **Sidebar**: `src/components/twin/components/SurfaceSidebar.tsx`
- **Tile selector**: `src/components/twin/components/TileSelector.tsx`
- **Workspace**: `src/components/twin/TwinWorkspace.tsx`

Adding a surface: drop the HTML in `public/twin/`, add the entry in
`src/lib/twin-surfaces.ts`. The sidebar + tile selector pick it up
automatically; the API route already serves any `*.html` in that folder.

© VVU Foundation · TRUST THROUGH TRANSPARENT CYCLES
