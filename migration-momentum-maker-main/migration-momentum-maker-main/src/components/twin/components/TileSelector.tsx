"use client";

// src/components/twin/components/TileSelector.tsx — the bottom-right tile
// selector cluster. Each icon corresponds to one tile style (or the
// estate's own engine). Clicking an icon flips the #/twin surface to that
// tile style — the iframe reloads byte-for-byte from disk.
//
//   · PHOTOREAL    Google Maps photo-realistic 3D tiles
//   · OPENLAYERS   OpenLayers OSM standard raster
//   · DARK         CartoDB Dark Matter (Leaflet)
//   · 3D MVT       OpenMapTiles 3D (MapLibre + 3D building extrusions)
//   · GEO-BIO      Geo-Bioteknik Spatial Intelligence engine (the estate's own)
//
// The cluster is fixed bottom-right of the workspace (above the footer),
// never overlaps the lime workspace toggle (it sits to its LEFT — see the
// estate's reserved footprint in TwinWorkspace). Each icon is a 44px
// touch target with a tooltip + active halo.

import { useState } from "react";
import { Satellite, Map, Moon, Boxes, Dna, type LucideIcon } from "lucide-react";
import { TWIN_SURFACES, type TwinSurface } from "@/lib/twin-surfaces";

type Props = {
  activeId: string;
  onSelect: (surface: TwinSurface) => void;
};

type IconSpec = {
  key: TwinSurface["icon"];
  label: string;
  hint: string;
  Icon: LucideIcon;
};

const ICON_ATLAS: readonly IconSpec[] = [
  {
    key: "photoreal",
    label: "PHOTOREAL",
    hint: "Google Maps · photo-realistic 3D tiles",
    Icon: Satellite,
  },
  { key: "openlayers", label: "OPENLAYERS", hint: "OpenLayers · OSM standard raster", Icon: Map },
  { key: "dark", label: "DARK", hint: "CartoDB Dark Matter · subdued basemap", Icon: Moon },
  {
    key: "openmaptiles3d",
    label: "3D MVT",
    hint: "OpenMapTiles 3D · vector + extrude",
    Icon: Boxes,
  },
  {
    key: "engine",
    label: "GEO-BIO",
    hint: "Geo-Bioteknik · Spatial Intelligence engine",
    Icon: Dna,
  },
];

export function TileSelector({ activeId, onSelect }: Props) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-40 flex flex-col items-end gap-2 sm:bottom-4 sm:right-4">
      {/* The cluster sits ABOVE the workspace toggle's reserved footprint.
          The estate's lime toggle is at bottom-right (z-60); this cluster
          (z-40) sits ABOVE the iframe but BELOW the toggle, and to the
          LEFT of the toggle (mr-[13rem] on the provenance rail reserves
          the toggle's footprint; this cluster lives inside that reserved
          lane with the rail's other controls). */}
      <div className="pointer-events-auto flex items-end gap-2">
        {/* Collapse handle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Collapse tile selector" : "Expand tile selector"}
          aria-expanded={expanded}
          className="vvu-label inline-flex h-[44px] min-w-[44px] items-center justify-center rounded-md border border-[#1f3a4a] bg-[rgba(5,10,18,0.94)] px-2 text-[8px] tracking-[1.2px] text-[#7f95a5] transition-all hover:border-[#58a6ff] hover:text-[#58a6ff]"
        >
          {expanded ? "◂" : "TILES ▸"}
        </button>
        {expanded && (
          <div
            role="radiogroup"
            aria-label="Map tile style selector"
            className="flex items-center gap-1.5 rounded-md border border-[#1f3a4a] bg-[rgba(5,10,18,0.94)] p-1.5"
          >
            {ICON_ATLAS.map(({ key, label, hint, Icon }) => {
              const surface = TWIN_SURFACES.find((s) => s.icon === key);
              if (!surface) return null;
              const isActive = surface.id === activeId;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  aria-label={`${label} — ${hint}`}
                  title={`${label}\n${hint}`}
                  onClick={() => onSelect(surface)}
                  className="group relative flex h-[44px] w-[44px] flex-col items-center justify-center gap-0.5 rounded-sm border transition-all"
                  style={{
                    borderColor: isActive ? surface.accent : "rgba(127,149,165,0.18)",
                    background: isActive ? `${surface.accent}1a` : "transparent",
                  }}
                >
                  <Icon
                    className="h-4 w-4 transition-all group-hover:scale-110"
                    style={{
                      color: isActive ? surface.accent : "#7f95a5",
                      filter: isActive ? `drop-shadow(0 0 4px ${surface.accent})` : "none",
                    }}
                    aria-hidden="true"
                  />
                  <span
                    className="vvu-label text-[6.5px] tracking-[0.6px] transition-colors"
                    style={{ color: isActive ? surface.accent : "#7f95a5" }}
                  >
                    {label}
                  </span>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
                      style={{ background: surface.accent, boxShadow: `0 0 6px ${surface.accent}` }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
