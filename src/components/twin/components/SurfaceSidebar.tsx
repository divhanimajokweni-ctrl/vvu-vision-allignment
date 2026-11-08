"use client";

// src/components/twin/components/SurfaceSidebar.tsx — the digital twin
// surface selector (left rail of the #/twin tab). Lists every surface in
// the registry — the original Canvas 2D wildfire scenario, the four tile
// styles (Google photorealistic, OpenLayers, Dark, OpenMapTiles 3D) and
// the Geo-Bioteknik Spatial Intelligence engine. The active surface is
// WORM-logged on every switch (no silent projections).

import { useEffect } from "react";
import { useSendWormLog } from "@/hooks/use-vvu-socket";
import { TWIN_SURFACES, type TwinSurface } from "@/lib/twin-surfaces";

type Props = {
  activeId: string;
  onSelect: (surface: TwinSurface) => void;
};

export function SurfaceSidebar({ activeId, onSelect }: Props) {
  const sendWormLog = useSendWormLog();

  // Whenever the active surface changes (sidebar OR tile selector), emit a
  // VIEW_MODE WORM receipt. The tile selector and the sidebar both call
  // onSelect; this is the single chokepoint that logs the switch.
  useEffect(() => {
    sendWormLog(
      "VIEW_MODE",
      "TWIN",
      `#/twin surface=${activeId} · projection switched via sidebar/tile-selector`,
    );
  }, [activeId, sendWormLog]);

  const handleSelect = (surface: TwinSurface) => {
    if (surface.id === activeId) return;
    onSelect(surface);
  };

  return (
    <nav
      aria-label="Digital twin surfaces"
      className="flex w-[148px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-[#1f3a4a] bg-[rgba(5,10,18,0.94)] p-2"
    >
      <div className="vvu-label mt-1 mb-1 text-[7.5px] tracking-[1.6px] text-[#7f95a5]">
        DIGITAL TWIN SURFACES
      </div>
      {TWIN_SURFACES.map((surface) => {
        const isActive = surface.id === activeId;
        return (
          <button
            key={surface.id}
            type="button"
            onClick={() => handleSelect(surface)}
            aria-current={isActive ? "true" : undefined}
            title={surface.subtitle}
            className="group flex items-center gap-2 rounded-sm border border-transparent px-1.5 py-1.5 text-left transition-all hover:border-[#1f3a4a] hover:bg-[rgba(127,149,165,0.04)]"
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-[2px] border transition-all"
              style={{
                background: isActive ? surface.accent : "transparent",
                borderColor: isActive ? surface.accent : "#7f95a5",
                boxShadow: isActive ? `0 0 6px ${surface.accent}` : "none",
              }}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span
                className={`vvu-label truncate text-[8.5px] tracking-[0.8px] transition-colors ${
                  isActive ? "text-[#e0e6ed]" : "text-[#7f95a5] group-hover:text-[#a0b0bf]"
                }`}
              >
                {surface.shortLabel}
              </span>
              <span className="vvu-label truncate text-[6.5px] tracking-[0.6px] text-[#4a5744]">
                {surface.style}
              </span>
            </span>
          </button>
        );
      })}
      <div className="mt-auto border-t border-[#1f3a4a] pt-2 text-[7px] leading-[1.8] text-[#7f95a5]">
        <b className="font-normal text-[#e0e6ed]">SURFACES · {TWIN_SURFACES.length}</b>
        <br />
        TILE STYLES · 4
        <br />
        ENGINE · 1
        <br />
        CANVAS · 1
        <br />
        <span className="text-[#f2b84b]">SEED · NOT LIVE</span>
      </div>
    </nav>
  );
}
