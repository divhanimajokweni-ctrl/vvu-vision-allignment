"use client";

// src/components/spatial/CityHudPanels.tsx — the SYS.02 / SYS.03 HUD boxes
// that sit over (overlay variant, spatial view) or beside (inline variant,
// analytics bench section) the CityGisBench scene. Content follows the
// wa_image_8183522056652419501 spec exactly:
//
//   SYS.02 · GIS SPATIAL TRUTH [ALIGNED] — STATUS MAP_SYNC (green pulse),
//   LAYERS 5 ACTIVE, ACCURACY 99.9%, UPDATE RT LIVE, COORDS (PE pilot DMS +
//   JHB corridor), DATA_SOURCE GEO_GRID, plus the 5 layer toggle chips.
//
//   SYS.03 · YOLO EDGE AI [ACTIVE] — DETECTION_ON, OBJECTS TRACKED 25R,
//   ALERTS 14 CRITICAL, MODEL V8 NANO, CONFIDENCE >95%, PROCESS TIME 22MS,
//   THREAT LEVEL ELEVATED, ENGINE [ONLINE].
//
//   YOLO ALERT FEED (Round 13) — a live cycling feed of the 14 CRITICAL
//   detections (road ref · object class · confidence · ts), one new alert
//   every ~7 s, newest row flagged — the SYS.03 ALERTS readout made visible.
//
//   NODE ARRAY — the N01–N06 city cards with the EDGE-cold fallbacks
//   (12.4 L/s · 42.3 m · 46.4°C) swapping to live telemetry per frame; the
//   row of the currently inspected node carries a lime accent bar.
//
//   Round 27 — 📌 PINNED RAIL (the user's pinned-rail package): the overlay
//   column grows a rail head (VENTURE VISION UBUNTU + 📌 PINNED toggle).
//   Unpinned, the rail collapses to a slim left-edge tab so the city canvas
//   goes full-screen; phones start COLLAPSED (full-screen city/map, the
//   user's “collapse on mobile so the map goes full-screen” request). The
//   choice persists (pb_city_rail_pinned) and every toggle is WORM-logged
//   (RAIL_PIN · OPERATOR).
//
// Status values come from /api/gis/status + /api/yolo/status (5 s poll) with
// spec-constant fallbacks so the panels never render empty.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Pin } from "lucide-react";
import {
  CITY_NODE_IDS,
  EDGE_COLD_FALLBACK,
  GIS_ANCHORS,
  GIS_LAYERS,
  GIS_SPEC,
  YOLO_SPEC,
  type GisLayerId,
  type GisStatusResponse,
  type YoloStatusResponse,
} from "@/lib/vvu-gis";
import {
  useFrame,
  useGisLayers,
  useSendWormLog,
  useSetInspectNode,
  useToggleGisLayer,
  useVvuSocketStore,
  useWormChain,
} from "@/hooks/use-vvu-socket";
import { cn } from "@/lib/utils";

// ── micro rows ───────────────────────────────────────────────────────────────

function HeaderAccent({ tone = "lime" }: { tone?: "lime" | "amber" }) {
  // 2px gradient top bar — echoes the boxed HUD look of the spec image;
  // static background only (reduced-motion safe).
  return (
    <div
      aria-hidden="true"
      className="absolute top-0 left-0 right-0 h-[2px] rounded-t-sm"
      style={{
        background:
          tone === "lime"
            ? "linear-gradient(90deg, rgba(200,255,0,0.55), rgba(200,255,0,0.12) 55%, transparent)"
            : "linear-gradient(90deg, rgba(224,160,48,0.55), rgba(224,160,48,0.12) 55%, transparent)",
      }}
    />
  );
}

function StatusRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 leading-tight">
      <span className="vvu-label text-[6px] sm:text-[7px] text-[#7a8a6e] whitespace-nowrap">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-[7px] sm:text-[8px] font-bold tabular-nums text-right",
          valueClass ?? "text-[#c9d4bd]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function HeaderChip({
  children,
  tone = "lime",
}: {
  children: ReactNode;
  tone?: "lime" | "amber" | "dim";
}) {
  const styles =
    tone === "lime"
      ? "text-[#c8ff00] border-[rgba(200,255,0,0.4)]"
      : tone === "amber"
        ? "text-[#e0a030] border-[rgba(224,160,48,0.45)]"
        : "text-[#7a8a6e] border-[rgba(122,138,110,0.35)]";
  return (
    <span
      className={cn(
        "vvu-label text-[5.5px] sm:text-[6.5px] font-bold px-1 py-[1px] rounded-sm border whitespace-nowrap",
        styles,
      )}
    >
      {children}
    </span>
  );
}

// ── status queries ───────────────────────────────────────────────────────────

function useGisStatus() {
  return useQuery<GisStatusResponse>({
    queryKey: ["gis-status"],
    queryFn: async () => {
      const r = await fetch("/api/gis/status");
      if (!r.ok) throw new Error("gis status offline");
      return (await r.json()) as GisStatusResponse;
    },
    refetchInterval: 5_000,
    staleTime: 4_000,
  });
}

function useYoloStatus() {
  return useQuery<YoloStatusResponse>({
    queryKey: ["yolo-status"],
    queryFn: async () => {
      const r = await fetch("/api/yolo/status");
      if (!r.ok) throw new Error("yolo status offline");
      return (await r.json()) as YoloStatusResponse;
    },
    refetchInterval: 5_000,
    staleTime: 4_000,
  });
}

// ── YOLO ALERT FEED (Round 13) ───────────────────────────────────────────────

/** Deterministic PRNG (same family as the bench scene's seed) — keeps the
 *  14 descriptors stable across renders and devices. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 14 CRITICAL alert descriptors (same seed family as the bench
 *  movers — road refs follow the bench road grid, classes are edge-ai labels). */
function alertDescriptors() {
  const rand = mulberry32(1409);
  const roads = [
    "X-RD-40",
    "X-RD-20",
    "Z-RD-00",
    "Z-RD+20",
    "Z-RD+40",
    "MAIN-DN300",
    "B-LAT",
    "C-SVC",
  ];
  const classes = ["VEH", "PED", "CYC", "EQP"];
  return Array.from({ length: YOLO_SPEC.alerts }, (_, i) => ({
    id: i + 1,
    road: roads[Math.floor(rand() * roads.length)],
    cls: classes[Math.floor(rand() * classes.length)],
    conf: 95 + Math.floor(rand() * 5),
  }));
}

interface FeedRow {
  key: number;
  id: number;
  road: string;
  cls: string;
  conf: number;
  ts: string;
}

function YoloAlertFeed() {
  const { data: yolo } = useYoloStatus();
  const alerts = yolo?.alerts ?? YOLO_SPEC.alerts;
  const descriptors = useMemo(() => alertDescriptors(), []);
  const [rows, setRows] = useState<FeedRow[]>([]);
  const cursorRef = useRef(0);
  const nextKeyRef = useRef(1);

  // A new alert lands every ~7 s (paused while the tab is hidden): the feed
  // cycles through the 14 CRITICAL descriptors, newest first, max 6 rows.
  useEffect(() => {
    const fire = () => {
      if (document.hidden) return;
      const d = descriptors[cursorRef.current % descriptors.length];
      cursorRef.current = (cursorRef.current + 1) % descriptors.length;
      setRows((r) =>
        [
          {
            key: nextKeyRef.current,
            id: d.id,
            road: d.road,
            cls: d.cls,
            conf: d.conf,
            ts: new Date().toLocaleTimeString("en-GB", { hour12: false }),
          },
          ...r,
        ].slice(0, 6),
      );
      nextKeyRef.current += 1;
    };
    fire(); // prime the feed immediately
    const id = setInterval(fire, 7000);
    return () => clearInterval(id);
  }, [descriptors]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.12, ease: "easeOut" }}
      className="vvu-panel-solid backdrop-blur-sm rounded-sm px-2 py-1.5 relative"
      aria-label="YOLO critical alert feed"
    >
      <HeaderAccent tone="amber" />
      <div className="flex items-center justify-between gap-1">
        <span className="vvu-label text-[6px] sm:text-[7.5px] font-bold text-[#f3e38a] tracking-wide whitespace-nowrap">
          YOLO ALERT FEED
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-[#c8ff00] vvu-pulse"
            aria-hidden="true"
          />
          <span className="vvu-label text-[5px] sm:text-[5.5px] text-[#8fb35a] font-bold tabular-nums">
            {alerts} CRIT
          </span>
        </span>
      </div>

      {/* role=log without a live region: the feed ticks every 7 s, a polite
          live region would narrate each tick — the count above carries the
          summary for assistive tech instead. */}
      <div className="mt-1 space-y-[2px] max-h-[86px] overflow-y-auto" role="log" aria-live="off">
        {rows.length === 0 && (
          <div className="vvu-label text-[5.5px] text-[#7a8a6e] py-1">AWAITING DETECTIONS…</div>
        )}
        {rows.map((row, i) => (
          <div
            key={row.key}
            className={cn(
              "flex items-center gap-1.5 font-mono text-[5.5px] sm:text-[6.5px] font-bold tabular-nums leading-none py-[3px] px-1 rounded-sm",
              i === 0 ? "text-[#e5484d] bg-[rgba(229,72,77,0.08)]" : "text-[#8fa07f]",
            )}
          >
            <span
              className={cn(
                "inline-block w-1 h-1 rounded-full shrink-0",
                i === 0 ? "bg-[#e5484d]" : "bg-[#5f6f54]",
              )}
              aria-hidden="true"
            />
            <span>#{String(row.id).padStart(2, "0")}</span>
            <span className="text-[#c9d4bd]">{row.road}</span>
            <span>{row.cls}</span>
            <span className="ml-auto text-[#8fb35a]">C{row.conf}%</span>
            <span className="text-[#5f6f54]">{row.ts}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── SYS.02 panel ─────────────────────────────────────────────────────────────

function Sys02Panel({
  layers,
  onToggleLayer,
}: {
  layers: ReadonlySet<GisLayerId>;
  onToggleLayer: (id: GisLayerId) => void;
}) {
  const { data: gis } = useGisStatus();
  const mapSync = gis?.map_sync ?? GIS_SPEC.mapSync;
  const updateRt = gis?.update_rt ?? GIS_SPEC.updateRt;
  const engine = gis?.engine ?? GIS_SPEC.engineOnline;
  const activeCount = layers.size;

  // Round 13 — recent GIS_LAYER audit events per layer id, counted from the
  // client-side WORM chain (last 80 events; honest "recent" scope — the full
  // count lives in the ledger filter). Surfaces the audit trail on the chips.
  const wormChain = useWormChain();
  const layerAuditCounts = useMemo(() => {
    const counts: Partial<Record<GisLayerId, number>> = {};
    for (const evt of wormChain) {
      if (evt.event !== "GIS_LAYER") continue;
      const id = evt.details.trim().split(" ")[0];
      if (id === "L1" || id === "L2" || id === "L3" || id === "L4" || id === "L5") {
        counts[id] = (counts[id] ?? 0) + 1;
      }
    }
    return counts;
  }, [wormChain]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
      className="vvu-panel-solid backdrop-blur-sm rounded-sm px-2 py-1.5 relative"
      aria-label="GIS spatial truth status"
    >
      <HeaderAccent tone="lime" />
      <div className="flex items-center justify-between gap-1">
        <span className="vvu-label text-[6.5px] sm:text-[8px] font-bold text-[#f3e38a] tracking-wide whitespace-nowrap">
          SYS.02 · GIS SPATIAL TRUTH
        </span>
        <HeaderChip tone={mapSync ? "lime" : "amber"}>
          {mapSync ? "[ALIGNED]" : "[DRIFT]"}
        </HeaderChip>
      </div>

      <div className="mt-1.5 space-y-[3px]">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-block w-1.5 h-1.5 rounded-full shrink-0",
              mapSync ? "bg-[#c8ff00] vvu-pulse" : "bg-[#e0a030] vvu-blink",
            )}
            aria-hidden="true"
          />
          <span className="vvu-label text-[6px] sm:text-[7px] text-[#8fb35a] font-bold">
            STATUS: MAP_SYNC
          </span>
        </div>
        <StatusRow
          label="LAYERS"
          value={`${activeCount} ACTIVE`}
          valueClass={activeCount === 5 ? "text-[#c8ff00]" : "text-[#e0a030]"}
        />
        <StatusRow label="ACCURACY" value={`${GIS_SPEC.accuracy.toFixed(1)}%`} />
        <StatusRow
          label="UPDATE RT"
          value={updateRt}
          valueClass={updateRt === "LIVE" ? "text-[#8fb35a]" : "text-[#e0a030]"}
        />
        <StatusRow label="DATA_SOURCE" value={GIS_SPEC.source} />
      </div>

      <div className="mt-1.5 pt-1.5 border-t border-[rgba(107,138,64,0.2)] space-y-[3px]">
        <div
          className="font-mono text-[6px] sm:text-[7px] font-bold text-[#c9d4bd] tabular-nums leading-tight"
          title={`WGS84 ${GIS_ANCHORS.pe.lat}, ${GIS_ANCHORS.pe.lon}`}
        >
          {GIS_ANCHORS.pe.dms}
        </div>
        <div className="vvu-label text-[5px] sm:text-[5.5px] text-[#7a8a6e] leading-tight">
          PE PILOT · GQEBERHA CORE
        </div>
        <div
          className="font-mono text-[5.5px] sm:text-[6.5px] text-[#8fa07f] tabular-nums leading-tight"
          title={`WGS84 ${GIS_ANCHORS.jhb.lat}, ${GIS_ANCHORS.jhb.lon}`}
        >
          {GIS_ANCHORS.jhb.dms}
        </div>
        <div className="vvu-label text-[5px] sm:text-[5.5px] text-[#7a8a6e] leading-tight">
          JHB CORRIDOR · SECONDARY
        </div>
      </div>

      {/* 5 layer toggle chips — the L1–L5 ACTIVE set (44px touch targets);
          a corner badge counts that layer's recent GIS_LAYER WORM events */}
      <div
        className="flex flex-wrap gap-1 mt-1.5"
        role="group"
        aria-label="GIS bench layers L1 to L5"
      >
        {GIS_LAYERS.map((l) => {
          const on = layers.has(l.id);
          const audits = layerAuditCounts[l.id] ?? 0;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => onToggleLayer(l.id)}
              aria-pressed={on}
              aria-label={`${l.id} ${l.name} layer — ${l.detail}`}
              title={`${l.id} ${l.name} — ${l.detail}${audits ? ` · ${audits} recent GIS_LAYER audit event${audits > 1 ? "s" : ""}` : ""}`}
              className={cn(
                "relative vvu-label min-h-[44px] min-w-[44px] px-1 rounded-sm border font-bold text-[7px] sm:text-[8px] leading-none transition-all select-none active:scale-[0.97] flex flex-col items-center justify-center gap-0.5",
                on
                  ? "bg-[rgba(200,255,0,0.1)] text-[#c8ff00] border-[rgba(200,255,0,0.35)] shadow-[inset_0_0_0_1px_rgba(200,255,0,0.2),inset_0_2px_6px_rgba(0,0,0,0.45)]"
                  : "text-[#7a8a6e] border-[rgba(107,138,64,0.3)] hover:border-[#8fb35a] hover:text-[#c9d4bd]",
              )}
            >
              {audits > 0 && (
                <span
                  className="absolute -top-[3px] -right-[3px] font-mono text-[5px] font-bold leading-none px-[3px] py-[1px] rounded-full bg-[#060806] border border-[rgba(143,179,90,0.55)] text-[#8fb35a] tabular-nums"
                  aria-hidden="true"
                >
                  {audits}
                </span>
              )}
              <span>{l.id}</span>
              <span className="text-[5.5px] sm:text-[6.5px] font-semibold tracking-wide opacity-80">
                {on ? l.name : "OFF"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-1.5 pt-1 border-t border-[rgba(107,138,64,0.2)]">
        <StatusRow
          label="BENCH ENGINE"
          value={engine}
          valueClass={engine === "ONLINE" ? "text-[#c8ff00]" : "text-[#e0a030]"}
        />
      </div>
    </motion.div>
  );
}

// ── SYS.03 panel ─────────────────────────────────────────────────────────────

function Sys03Panel() {
  const { data: yolo } = useYoloStatus();
  const detection = yolo?.detection ?? YOLO_SPEC.detection;
  const tracked = yolo?.tracked ?? YOLO_SPEC.tracked;
  const alerts = yolo?.alerts ?? YOLO_SPEC.alerts;
  const model = yolo?.model ?? YOLO_SPEC.modelLabel;
  const confidence = yolo?.confidence ?? YOLO_SPEC.confidence;
  const processMs = yolo?.process_time_ms ?? YOLO_SPEC.processTimeMs;
  const threat = yolo?.threat ?? YOLO_SPEC.threat;
  const engine = yolo?.engine ?? GIS_SPEC.engineOnline;
  const detectOn = detection === "ON";

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
      className="vvu-panel-solid backdrop-blur-sm rounded-sm px-2 py-1.5 relative"
      aria-label="YOLO edge AI status"
    >
      <HeaderAccent tone="amber" />
      <div className="flex items-center justify-between gap-1">
        <span className="vvu-label text-[6.5px] sm:text-[8px] font-bold text-[#f3e38a] tracking-wide whitespace-nowrap">
          SYS.03 · YOLO EDGE AI
        </span>
        <HeaderChip tone={detectOn ? "lime" : "dim"}>
          [{detectOn ? "ACTIVE" : "STANDBY"}]
        </HeaderChip>
      </div>

      <div className="mt-1.5 space-y-[3px]">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-block w-1.5 h-1.5 rounded-full shrink-0",
              detectOn ? "bg-[#c8ff00] vvu-pulse" : "bg-[#7a8a6e]",
            )}
            aria-hidden="true"
          />
          <span className="vvu-label text-[6px] sm:text-[7px] text-[#8fb35a] font-bold">
            STATUS: DETECTION_{detectOn ? "ON" : "OFF"}
          </span>
        </div>
        <StatusRow label="OBJECTS TRACKED" value={`${tracked}R`} />
        <StatusRow label="ALERTS" value={`${alerts} CRITICAL`} valueClass="text-[#e5484d]" />
        <StatusRow label="MODEL" value={model} />
        <StatusRow
          label="CONFIDENCE"
          value={`>${Math.round(confidence * 100)}%`}
          valueClass="text-[#8fb35a]"
        />
        <StatusRow label="PROCESS_TIME" value={`${processMs}MS`} />
      </div>

      <div className="mt-1.5 pt-1.5 border-t border-[rgba(107,138,64,0.2)] flex items-center justify-between gap-2">
        <span className="vvu-label text-[6px] sm:text-[7px] text-[#7a8a6e]">THREAT_LEVEL</span>
        <span
          className={cn(
            "vvu-label text-[6px] sm:text-[7px] font-bold px-1.5 py-[1px] rounded-sm border",
            threat === "CRITICAL"
              ? "text-[#e5484d] border-[rgba(229,72,77,0.5)] vvu-blink"
              : threat === "ELEVATED"
                ? "text-[#e0a030] border-[rgba(224,160,48,0.45)]"
                : "text-[#8fb35a] border-[rgba(143,179,90,0.45)]",
          )}
          aria-live="polite"
        >
          {threat}
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        <span
          className={cn(
            "inline-block w-1.5 h-1.5 rounded-full shrink-0",
            engine === "ONLINE" ? "bg-[#c8ff00] vvu-pulse" : "bg-[#e0a030] vvu-blink",
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            "vvu-label text-[6px] sm:text-[7.5px] font-bold",
            engine === "ONLINE" ? "text-[#c8ff00]" : "text-[#e0a030]",
          )}
        >
          ENGINE [ONLINE]
        </span>
      </div>
    </motion.div>
  );
}

// ── NODE ARRAY panel (N01–N06 city cards) ────────────────────────────────────

const NODE_SHORT: Record<string, string> = {
  N01: "MAST",
  N02: "INLET",
  N03: "OUTLET",
  N04: "DN300",
  N05: "EDGE CPU",
  N06: "POWER",
};

function NodeArrayPanel() {
  const frame = useFrame();
  const setInspectNode = useSetInspectNode();
  const sendWormLog = useSendWormLog();
  // Round 13 — the row of the currently inspected node gets the lime accent
  // bar so the card ⇄ inspector link is visible at a glance.
  const inspectNodeId = useVvuSocketStore((s) => s.inspectNodeId);
  const [open, setOpen] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 640px)").matches : false,
  );
  const live = frame !== null;

  const select = (nodeId: string) => {
    setInspectNode(nodeId);
    sendWormLog("NODE_INSPECT", "OPERATOR", `${nodeId} selected from CITY GIS node array`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
      className="vvu-panel-solid backdrop-blur-sm rounded-sm px-1.5 py-1"
      aria-label="City node array N01 to N06"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full min-h-[44px] sm:min-h-[30px] flex items-center justify-between gap-2 px-0.5 select-none"
      >
        <span className="vvu-label text-[6px] sm:text-[7.5px] font-bold text-[#f3e38a] tracking-wide whitespace-nowrap">
          NODE ARRAY · N01–N06
        </span>
        <span className="flex items-center gap-1">
          {!live && (
            <span className="vvu-label text-[5px] sm:text-[5.5px] text-[#e0a030] font-bold vvu-blink">
              EDGE COLD
            </span>
          )}
          {open ? (
            <ChevronDown className="w-3 h-3 text-[#7a8a6e]" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-3 h-3 text-[#7a8a6e]" aria-hidden="true" />
          )}
        </span>
      </button>

      {open && (
        <div className="mt-0.5 space-y-[2px] max-h-[132px] overflow-y-auto" role="list">
          {CITY_NODE_IDS.map((id) => {
            const nd = frame?.nodes.find((x) => x.nodeId === id) ?? null;
            const flow = nd?.flowRate ?? EDGE_COLD_FALLBACK.flowLps;
            const level = nd?.pressureHead ?? EDGE_COLD_FALLBACK.levelM;
            const temp = nd?.apuTemperature ?? EDGE_COLD_FALLBACK.tempC;
            const cold = !nd;
            return (
              <button
                key={id}
                type="button"
                role="listitem"
                onClick={() => select(id)}
                aria-label={`inspect node ${id} ${NODE_SHORT[id]}`}
                aria-current={inspectNodeId === id ? "true" : undefined}
                className={cn(
                  "w-full flex items-center justify-between gap-2 rounded-sm px-1 sm:px-1.5 min-h-[44px] sm:min-h-[32px] border text-left transition-colors border-l-2",
                  inspectNodeId === id
                    ? "border-l-[#c8ff00] border-y-[rgba(200,255,0,0.25)] border-r-[rgba(200,255,0,0.25)] bg-[rgba(200,255,0,0.05)]"
                    : "border-l-transparent border-[rgba(107,138,64,0.18)] hover:border-[rgba(143,179,90,0.55)] hover:border-l-[#8fb35a] hover:bg-[rgba(200,255,0,0.04)]",
                )}
              >
                <span className="flex items-baseline gap-1.5 shrink-0">
                  <span className="font-mono text-[7px] sm:text-[8px] font-bold text-[#f3e38a]">
                    {id}
                  </span>
                  <span className="vvu-label text-[5px] sm:text-[5.5px] text-[#7a8a6e]">
                    {NODE_SHORT[id]}
                  </span>
                </span>
                <span
                  className={cn(
                    "font-mono text-[6px] sm:text-[6.5px] font-bold tabular-nums text-right leading-tight",
                    cold ? "text-[#7a8a6e]" : "text-[#c9d4bd]",
                  )}
                  title={cold ? "EDGE cold — spec fallback telemetry" : "live edge telemetry"}
                >
                  {flow.toFixed(1)} L/s · {level.toFixed(1)} m · {temp.toFixed(1)}°C
                </span>
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ── assembled panels ─────────────────────────────────────────────────────────

export interface CityHudPanelsProps {
  /** 'overlay' floats the stack over the scene (spatial view, left column);
   *  'inline' renders it in document flow (analytics bench section, metro
   *  Gate-4 telemetry rail). */
  variant?: "overlay" | "inline";
}

/** Round 27 — persisted pin state for the city overlay rail. */
const RAIL_PIN_KEY = "pb_city_rail_pinned";

function readInitialPinned(): boolean {
  if (typeof window === "undefined") return true;
  const saved = window.localStorage.getItem(RAIL_PIN_KEY);
  if (saved === "0" || saved === "1") return saved === "1";
  // Phones start collapsed — the city/map owns the full screen; desktops
  // keep the telemetry column pinned (the pre-Round-27 behaviour).
  return window.matchMedia("(min-width: 640px)").matches;
}

export function CityHudPanels({ variant = "overlay" }: CityHudPanelsProps) {
  const layers = useGisLayers();
  const toggleGisLayer = useToggleGisLayer();
  const sendWormLog = useSendWormLog();
  const [pinned, setPinned] = useState<boolean>(readInitialPinned);

  const handleToggleLayer = (id: GisLayerId) => {
    const wasOn = layers.has(id);
    const def = GIS_LAYERS.find((l) => l.id === id);
    toggleGisLayer(id);
    sendWormLog(
      "GIS_LAYER",
      "OPERATOR",
      `${id} ${def?.name ?? ""} · ${wasOn ? "ACTIVE → OFF" : "OFF → ACTIVE"} — bench layers ${wasOn ? layers.size - 1 : layers.size + 1}/5`,
    );
  };

  // Round 27 — 📌 pin toggle: pinned = telemetry column visible; unpinned =
  // collapsed to the left-edge tab so the city canvas is full-screen.
  const togglePin = useCallback(() => {
    const next = !pinned;
    setPinned(next);
    try {
      window.localStorage.setItem(RAIL_PIN_KEY, next ? "1" : "0");
    } catch {
      // private mode — the choice just doesn't persist
    }
    sendWormLog(
      "RAIL_PIN",
      "OPERATOR",
      `SYS.02/SYS.03 bench rail ${next ? "PINNED — telemetry column visible" : "COLLAPSED — city canvas full-screen"}`,
    );
  }, [pinned, sendWormLog]);

  if (variant === "inline") {
    return (
      <div className="flex flex-col gap-2 w-full">
        <Sys02Panel layers={layers} onToggleLayer={handleToggleLayer} />
        <Sys03Panel />
        <YoloAlertFeed />
        <NodeArrayPanel />
      </div>
    );
  }

  // Collapsed rail — one slim tab on the left edge; the city canvas behind
  // it is full-screen (44px+ touch target, vertical label).
  if (!pinned) {
    return (
      <button
        type="button"
        onClick={togglePin}
        aria-label="Pin the telemetry rail — show SYS.02 GIS and SYS.03 YOLO panels"
        title="Pin the telemetry rail"
        className="absolute top-1/2 -translate-y-1/2 left-0 z-20 pointer-events-auto flex flex-col items-center justify-center gap-1 min-h-[88px] min-w-[32px] px-1 rounded-r-sm border border-l-0 border-[rgba(143,179,90,0.45)] bg-[rgba(6,8,6,0.88)] backdrop-blur-sm text-[#8fb35a] hover:text-[#c8ff00] hover:border-[#c8ff00] transition-colors select-none active:scale-[0.97]"
      >
        <Pin className="w-3 h-3" aria-hidden="true" />
        <span className="vvu-label text-[6px] font-bold tracking-[0.2em] [writing-mode:vertical-rl]">
          RAIL
        </span>
      </button>
    );
  }

  return (
    <div className="absolute top-[88px] max-[479px]:top-[80px] left-2 max-[479px]:left-1.5 sm:left-3 z-20 flex flex-col gap-1.5 w-[160px] sm:w-[168px] pointer-events-auto max-h-[calc(100%-250px)] overflow-y-auto">
      {/* Round 27 — rail head: the 📌 pin toggle (user's pinned-rail design) */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="vvu-panel-solid backdrop-blur-sm rounded-sm px-2 py-1.5 relative flex items-center justify-between gap-1.5"
        aria-label="Telemetry rail controls"
      >
        <HeaderAccent />
        <span className="vvu-label text-[5.5px] sm:text-[6.5px] font-bold text-[#f3e38a] tracking-[0.14em] whitespace-nowrap">
          VENTURE VISION UBUNTU
        </span>
        <button
          type="button"
          onClick={togglePin}
          aria-label="Collapse the telemetry rail — city canvas full-screen"
          title="Collapse the rail (city canvas full-screen)"
          className="vvu-label flex items-center gap-1 min-h-[28px] px-1.5 rounded-sm border border-[rgba(143,179,90,0.5)] text-[#8fb35a] hover:text-[#c8ff00] hover:border-[#c8ff00] bg-[rgba(143,179,90,0.08)] transition-colors font-bold text-[5.5px] sm:text-[6.5px] whitespace-nowrap select-none active:scale-[0.97]"
        >
          <Pin className="w-2.5 h-2.5" aria-hidden="true" />
          PINNED
        </button>
      </motion.div>
      <Sys02Panel layers={layers} onToggleLayer={handleToggleLayer} />
      <Sys03Panel />
      <YoloAlertFeed />
      <NodeArrayPanel />
    </div>
  );
}

export default CityHudPanels;
