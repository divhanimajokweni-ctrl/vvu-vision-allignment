"use client";

// src/components/twin/TwinWorkspace.tsx — the digital twin tab (#/twin).
// The estate's municipal-twin surface is now a SURFACE REGISTRY: every
// tile style + the Geo-Bioteknik Spatial Intelligence engine lives under
// this one tab, picked from the left rail (SurfaceSidebar) or the
// bottom-right icon cluster (TileSelector).
//
//   · LEFT RAIL  — full registry, every surface listed (sidebar)
//   · VIEWPORT   — the selected surface renders byte-for-byte in an
//                  iframe (the artifact is the source; this view does not
//                  fork it, does not restyle it, does not inject into it)
//   · TILE SELECTOR — the bottom-right cluster of icons, each one a tile
//                  style (or the engine). Quick-flip between Google
//                  photo-realistic / OpenLayers / Dark / OpenMapTiles 3D /
//                  Geo-Bioteknik SI.
//   · PROVENANCE RAIL — disk-canonical path + bytes + md5 (computed from
//                  disk on every request), the SEED DATA · NOT LIVE
//                  honesty chip, the WORM LEDGER PIN, OPEN STANDALONE.
//
// Every view entry, surface switch, and standalone open is WORM-logged.

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, FileCode2, Layers } from "lucide-react";
import { useSendWormLog } from "@/hooks/use-vvu-socket";
import { WormLedgerPin } from "./components/WormLedgerPin";
import { SurfaceSidebar } from "./components/SurfaceSidebar";
import { TileSelector } from "./components/TileSelector";
import {
  DEFAULT_TWIN_SURFACE_ID,
  TWIN_SURFACES,
  getSurface,
  type TwinSurface,
} from "@/lib/twin-surfaces";
import "./components/WormLedgerPin.css";

const STORAGE_KEY = "vvu.twin.surface";
const SCENARIO_URL = (id: string) => `/api/vvu/twin-scenario?scenario=${id}`;

type ScenarioMeta = {
  id: string;
  path: string;
  bytes: number;
  title: string;
  subtitle: string;
  style: string;
  tileKind: string;
  mtime: string;
  md5: string;
};

async function fetchScenarioMeta(id: string): Promise<ScenarioMeta> {
  const res = await fetch(`${SCENARIO_URL(id)}&meta=1`);
  if (!res.ok) throw new Error(`scenario meta HTTP ${res.status}`);
  return res.json() as Promise<ScenarioMeta>;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
}

function readStoredSurfaceId(): string {
  if (typeof window === "undefined") return DEFAULT_TWIN_SURFACE_ID;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && TWIN_SURFACES.some((s) => s.id === raw)) return raw;
  } catch {
    /* storage blocked — silent */
  }
  return DEFAULT_TWIN_SURFACE_ID;
}

function writeStoredSurfaceId(id: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* storage blocked — silent */
  }
}

export function TwinWorkspace() {
  const sendWormLog = useSendWormLog();
  // Lazy initializer reads localStorage on the client (the workspace is
  // dynamically imported with ssr:false — no hydration mismatch concern).
  // This avoids the setState-in-effect anti-pattern; the surface is set
  // ONCE during the first render.
  const [surfaceId, setSurfaceId] = useState<string>(() => readStoredSurfaceId());
  // Track the surfaceId whose iframe has finished loading. The loader is
  // shown while `loadedSurfaceId !== surfaceId` — derived state, no
  // setState-in-effect needed (the iframe's key={surfaceId} remounts it on
  // every switch, so onLoad fires fresh for each new artifact).
  const [loadedSurfaceId, setLoadedSurfaceId] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // View entry WORM receipt (the tab itself, not per-surface — per-surface
  // switches are logged by SurfaceSidebar's effect).
  useEffect(() => {
    sendWormLog("VIEW_MODE", "TWIN", `#/twin opened — surface=${surfaceId}`);
  }, [surfaceId, sendWormLog]);

  const surface = getSurface(surfaceId);

  const handleSelect = useCallback(
    (next: TwinSurface) => {
      setSurfaceId(next.id);
      writeStoredSurfaceId(next.id);
      sendWormLog(
        "TILE_SWITCH",
        "OPERATOR",
        `surface=${next.id} · style=${next.style} · tileKind=${next.tileKind}`,
      );
    },
    [sendWormLog],
  );

  const meta = useQuery({
    queryKey: ["twin-scenario-meta", surfaceId],
    queryFn: () => fetchScenarioMeta(surfaceId),
    staleTime: 30_000,
    retry: 1,
  });

  const loaded = loadedSurfaceId === surfaceId;

  const openStandalone = () => {
    sendWormLog(
      "SCENARIO_STANDALONE_OPEN",
      "OPERATOR",
      `${surfaceId} opened standalone (raw document, new tab)`,
    );
    fetch("/api/vvu/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor: "OPERATOR",
        action: "SCENARIO_STANDALONE_OPEN",
        fromState: "TWIN_VIEW",
        toState: "TWIN_VIEW",
        symbol: "OPEN",
        reason: `${surfaceId} opened standalone from #/twin`,
      }),
    }).catch(() => {
      /* offline — audit is best-effort */
    });
    toast.success("SCENARIO · STANDALONE TAB", {
      description: `WORM SCENARIO_STANDALONE_OPEN appended · ${surface.id}`,
    });
    window.open(SCENARIO_URL(surfaceId), "_blank", "noopener");
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0a0e17] text-[#e0e6ed]">
      {/* ── header band — scenario identity + tile-style chips ── */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[#1f3a4a] bg-[rgba(5,10,18,0.94)] px-3">
        <Layers className="h-3.5 w-3.5 shrink-0 text-[#f2b84b]" aria-hidden="true" />
        <span className="vvu-label truncate text-[10px] font-bold tracking-[1.6px] text-[#f2b84b]">
          TWIN · DIGITAL SURFACES
        </span>
        <span
          className="vvu-label truncate rounded-sm border px-2 py-1 text-[8px] transition-colors"
          style={{
            color: surface.accent,
            borderColor: `${surface.accent}66`,
            background: `${surface.accent}0f`,
          }}
        >
          {surface.shortLabel} · {surface.style}
        </span>
        <span className="vvu-label hidden truncate text-[8px] text-[#7f95a5] md:inline">
          {surface.subtitle}
        </span>
        <div className="flex-1" />
        <span className="vvu-label hidden rounded-sm border border-[#1f3a4a] px-2 py-1 text-[8px] text-[#58a6ff] sm:inline">
          {TWIN_SURFACES.length} SURFACES · 4 TILE STYLES · 1 ENGINE
        </span>
        {meta.data && (
          <span className="vvu-label rounded-sm border border-[#1f3a4a] px-2 py-1 text-[8px] text-[#7f95a5]">
            {surface.style} · {formatBytes(meta.data.bytes)}
          </span>
        )}
      </div>

      {/* ── the workspace: sidebar + viewport ── */}
      <div className="relative flex min-h-0 flex-1">
        <SurfaceSidebar activeId={surfaceId} onSelect={handleSelect} />
        <div className="relative min-h-0 flex-1">
          <iframe
            key={surfaceId}
            ref={iframeRef}
            src={SCENARIO_URL(surfaceId)}
            title={surface.title}
            className="absolute inset-0 h-full w-full border-0"
            onLoad={() => setLoadedSurfaceId(surfaceId)}
          />
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0e17]">
              <div className="text-center">
                <div
                  className="vvu-label text-2xl font-bold tracking-[0.3em]"
                  style={{ color: surface.accent }}
                >
                  {surface.shortLabel}
                </div>
                <div className="vvu-label mt-3 animate-pulse text-[9px] text-[#7f95a5]">
                  LOADING {surface.style} FROM DISK…
                </div>
              </div>
            </div>
          )}

          {/* ── the bottom-right tile selector cluster ── */}
          <TileSelector activeId={surfaceId} onSelect={handleSelect} />
        </div>
      </div>

      {/* ── provenance rail — disk-canonical, seed-data honest ── */}
      <div className="flex min-h-[76px] shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#1f3a4a] bg-[rgba(5,10,18,0.94)] px-3 py-2.5">
        <span className="vvu-label inline-flex items-center gap-1.5 text-[8px] text-[#7f95a5]">
          <FileCode2 className="h-3 w-3 shrink-0 text-[#58a6ff]" aria-hidden="true" />
          {meta.data ? (
            <>
              DISK-CANONICAL · {meta.data.path} · {meta.data.bytes.toLocaleString("en-ZA")} B · md5{" "}
              {meta.data.md5.slice(0, 8)}…
            </>
          ) : (
            <>DISK-CANONICAL · public/twin/{surfaceId}.html …</>
          )}
        </span>
        <span
          className="vvu-label rounded-sm border px-2 py-1 text-[8px]"
          style={{
            color: surface.accent,
            borderColor: `${surface.accent}66`,
            background: `${surface.accent}0f`,
          }}
          title="The mesh dots / devices are seeded positions, not live member devices — the operator's own note. The live wiring (pipeline engine → real member devices) is the named next artifact."
        >
          SEED DATA · NOT LIVE — LIVE WIRING IS THE NEXT ARTIFACT
        </span>
        <span className="vvu-label hidden text-[8px] text-[#7f95a5] sm:inline">
          SURFACE: {surface.style} · WORM PIN INSIDE THE FRAME
        </span>
        <div className="ml-auto mr-40 flex items-center gap-2 sm:mr-[13rem]">
          {/* mr-40 / sm:mr-[13rem] — reserves the lime workspace toggle's
              fixed footprint (bottom-right, z-60, widest label
              "◂ MAP_TWIN : OPERATOR" ≈ 190px + margin) so this interactive
              control is never covered by it. The TileSelector cluster
              sits ABOVE the iframe (z-40) and to the LEFT of this lane. */}
          <WormLedgerPin iframeRef={iframeRef} />
          <button
            type="button"
            onClick={openStandalone}
            aria-label="Open the scenario standalone in a new tab"
            className="vvu-label inline-flex min-h-[44px] items-center gap-1.5 rounded-sm border border-[#1f3a4a] bg-[rgba(88,166,255,0.06)] px-3 text-[9px] text-[#58a6ff] transition-all select-none hover:border-[#58a6ff] hover:bg-[rgba(88,166,255,0.12)] active:scale-[0.97]"
          >
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
            OPEN STANDALONE
          </button>
        </div>
      </div>
    </div>
  );
}
