"use client";

// src/components/spatial/NodeInspector.tsx — physical node detail card.
// Tap a rig node in the 3D mesh → this panel shows the sovereign-DB physical
// spec (ENU mm coords, material grade, diameter, assembly torque — Appendix C.2)
// fused with the LIVE telemetry frame for that node (flow, head, acoustic, APU).

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crosshair, Pin, X } from "lucide-react";
import { useFrame, useVvuSocketStore } from "@/hooks/use-vvu-socket";
import { PHYSICAL_NODES, THERMAL } from "@/lib/vvu-data";
import type { TelemetryFrame } from "@/types/vvu";
import { cn } from "@/lib/utils";

interface NodeInspectorProps {
  nodeId: string | null;
  onClose: () => void;
  /** Task 11-b — flips the sticky pin (survives route switches). */
  onTogglePin: () => void;
}

function SpecRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="vvu-label text-[7.5px] text-[#7a8a6e] shrink-0">{label}</span>
      <span
        className={cn(
          "text-[10px] text-[#c9d4bd] text-right truncate",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function LiveRow({
  label,
  value,
  hot,
}: {
  label: string;
  value: string;
  hot?: "amber" | "crimson" | "ok";
}) {
  const color =
    hot === "crimson"
      ? "text-[#e5484d]"
      : hot === "amber"
        ? "text-[#e0a030]"
        : hot === "ok"
          ? "text-[#c8ff00]"
          : "text-[#c9d4bd]";
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="vvu-label text-[7.5px] text-[#7a8a6e] shrink-0">
        <span
          className={cn("inline-block w-1 h-1 rounded-full mr-1 align-middle", hot && "vvu-pulse")}
          style={{
            background: hot === "crimson" ? "#e5484d" : hot === "amber" ? "#e0a030" : "#8fb35a",
          }}
          aria-hidden
        />
        {label}
      </span>
      <span className={cn("text-[10.5px] font-bold font-mono tabular-nums text-right", color)}>
        {value}
      </span>
    </div>
  );
}

// ── Task 9-b: live history sparklines ─────────────────────────────────────────
// Rolling per-metric history for the inspected node (~60s at the 1.5s cadence,
// 40 samples). Lives inside a component keyed by nodeId (remounts on node
// change) so the history resets by construction — no effect-body setState.
const HIST_N = 40;

interface NodeHistory {
  fin: number[];
  pr: number[];
  tp: number[];
}

function useNodeHistory(nodeId: string): NodeHistory {
  const [hist, setHist] = useState<NodeHistory>({ fin: [], pr: [], tp: [] });
  useEffect(() => {
    const push = (f: TelemetryFrame) => {
      const nd = f.nodes.find((x) => x.nodeId === nodeId);
      if (!nd) return;
      setHist((h) => ({
        fin: [...h.fin.slice(-(HIST_N - 1)), nd.flowRate],
        pr: [...h.pr.slice(-(HIST_N - 1)), nd.pressureHead],
        tp: [...h.tp.slice(-(HIST_N - 1)), nd.apuTemperature],
      }));
    };
    const unsub = useVvuSocketStore.subscribe((state, prev) => {
      if (state.frame && state.frame !== prev.frame) push(state.frame);
    });
    return unsub;
  }, [nodeId]);
  return hist;
}

/** Compact bar sparkline (static, reduced-motion safe). `max` scales the bars;
 *  the newest bar takes `lastColor` (metric hot color), history is sage with
 *  a fade-in ramp. Empty state renders a dim flat track. */
function MiniSpark({
  values,
  max,
  lastColor,
  label,
}: {
  values: number[];
  max: number;
  lastColor: string;
  label: string;
}) {
  const n = values.length;
  return (
    <div className="flex items-center gap-1.5 mt-[1px] mb-0.5" aria-hidden="true">
      <span className="vvu-label text-[5.5px] text-[#5a6a4e] w-[22px] shrink-0 tracking-[0.14em]">
        {label}
      </span>
      <div className="flex items-end gap-[1.5px] h-2 flex-1 min-w-0 overflow-hidden">
        {n === 0 ? (
          <div className="w-full h-[3px] rounded-[1px] bg-[rgba(107,138,64,0.14)]" />
        ) : (
          values.map((v, i) => {
            const hp = Math.min(1, Math.max(0.06, v / max));
            const isLast = i === n - 1;
            return (
              <div
                key={i}
                className="flex-1 min-w-[1.5px] max-w-[3px] rounded-[1px]"
                style={{
                  height: `${Math.max(8, hp * 100)}%`,
                  background: isLast ? lastColor : "#6b8a40",
                  opacity: isLast ? 1 : 0.3 + (0.5 * (i + 1)) / n,
                }}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

/** Live telemetry block extracted so the history hook lives inside the
 *  nodeId-keyed aside (remount → fresh history). */
function LiveTelemetryBlock({ nodeId }: { nodeId: string }) {
  const frame = useFrame();
  const live = frame?.nodes.find((n) => n.nodeId === nodeId);
  const hist = useNodeHistory(nodeId);
  const isWetted = nodeId === "N02" || nodeId === "N03" || nodeId === "N04" || nodeId === "N12";
  const tempHot: "amber" | "crimson" | "ok" | undefined =
    live === undefined
      ? undefined
      : live.apuTemperature >= THERMAL.critC
        ? "crimson"
        : live.apuTemperature >= THERMAL.warnC
          ? "amber"
          : "ok";
  const tempColor = tempHot === "crimson" ? "#e5484d" : tempHot === "amber" ? "#e0a030" : "#c8ff00";

  return (
    <div className="rounded border border-[rgba(107,138,64,0.22)] bg-[rgba(6,8,6,0.55)] px-2 py-1.5 mb-2">
      <div className="vvu-label text-[7px] text-[#8fb35a] mb-0.5 flex items-center justify-between">
        <span>LIVE TELEMETRY</span>
        <span
          className={cn(
            "inline-flex items-center gap-1",
            hist.fin.length + hist.tp.length > 0 && "",
          )}
        >
          {hist.tp.length > 0 && (
            <span className="text-[5.5px] text-[#5a6a4e] tracking-[0.12em]">60s</span>
          )}
          <span
            className={cn("inline-block w-1 h-1 rounded-full", live ? "vvu-pulse" : "")}
            style={{ background: live ? "#c8ff00" : "#7a8a6e" }}
            aria-hidden
          />
        </span>
      </div>
      {live ? (
        <>
          {isWetted && (
            <>
              <LiveRow label="FLOW" value={`${live.flowRate.toFixed(1)} L/s`} />
              <MiniSpark values={hist.fin} max={100} lastColor="#c8ff00" label="HIST" />
            </>
          )}
          {isWetted && (
            <>
              <LiveRow label="PRESSURE HEAD" value={`${live.pressureHead.toFixed(1)} m`} />
              <MiniSpark values={hist.pr} max={120} lastColor="#c8ff00" label="HIST" />
            </>
          )}
          {isWetted && (
            <LiveRow
              label="ACOUSTIC"
              value={live.acousticAbnormal ? "ANOMALY" : "OK"}
              hot={live.acousticAbnormal ? "crimson" : "ok"}
            />
          )}
          <LiveRow
            label={nodeId === "N05" ? "APU DIE TEMP" : "TEMP"}
            value={`${live.apuTemperature.toFixed(1)} °C`}
            hot={tempHot}
          />
          <MiniSpark values={hist.tp} max={100} lastColor={tempColor} label="HIST" />
        </>
      ) : (
        <div className="vvu-label text-[8px] text-[#7a8a6e] py-1">AWAITING TELEMETRY…</div>
      )}
    </div>
  );
}

export function NodeInspector({ nodeId, onClose, onTogglePin }: NodeInspectorProps) {
  const def = nodeId ? PHYSICAL_NODES.find((n) => n.nodeId === nodeId) : undefined;
  // Task 11-b — sticky pin flag from the store (module scope, survives unmount).
  const pinned = useVvuSocketStore((s) => s.inspectPinned);

  // Esc dismisses the inspector (standard dialog behaviour). If a stacked
  // overlay dialog is open (command palette / shortcut help), it owns Esc
  // first — the inspector stays put so one Escape closes one layer.
  useEffect(() => {
    if (!nodeId) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      if (document.querySelector('[data-slot="dialog-content"], [data-vvu="command-palette"]'))
        return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nodeId, onClose]);

  return (
    <AnimatePresence>
      {def && (
        <motion.aside
          key={def.nodeId}
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 14 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="absolute top-[108px] sm:top-[96px] right-2 sm:right-3 z-20 w-[206px] sm:w-[280px] vvu-panel backdrop-blur-md p-3 vvu-enter"
          role="dialog"
          aria-label={`Node ${def.nodeId} inspector`}
        >
          {/* header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Crosshair className="size-3 text-[#c8ff00] shrink-0" aria-hidden />
                <span className="vvu-label text-[10px] font-bold text-[#c8ff00]">{def.nodeId}</span>
                <span className="vvu-label text-[8px] text-[#7a8a6e]">· SPEC + LIVE</span>
                {pinned && (
                  <span
                    className="vvu-label text-[7px] font-bold text-[#c8ff00] rounded-[3px] px-1 py-px border border-[rgba(200,255,0,0.35)] bg-[rgba(200,255,0,0.07)] shrink-0"
                    title="Selection survives the spatial ↔ analytics view switch"
                  >
                    PINNED
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#f3e38a] font-bold truncate mt-0.5">{def.name}</div>
              <div className="vvu-label text-[7px] text-[#7a8a6e] truncate">{def.role}</div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {/* Task 11-b — pin toggle: sticky selection across view switches.
                  Pinned = lime + rotated glyph (the classic "stuck" affordance). */}
              <button
                type="button"
                onClick={onTogglePin}
                aria-pressed={pinned}
                aria-label={
                  pinned ? "unpin node selection" : "pin node selection across view switches"
                }
                title={
                  pinned
                    ? "PINNED — selection survives the spatial ↔ analytics switch"
                    : "PIN — keep this node selected across view switches"
                }
                className={cn(
                  "min-h-[44px] min-w-[44px] -my-2 flex items-center justify-center rounded-[4px] transition-colors",
                  pinned ? "text-[#c8ff00]" : "text-[#7a8a6e] hover:text-[#c9d4bd]",
                )}
              >
                <Pin
                  className={cn(
                    "size-3.5 transition-transform duration-150",
                    pinned && "rotate-45",
                  )}
                  aria-hidden
                />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="close node inspector"
                className="shrink-0 min-h-[44px] min-w-[44px] -my-2 -mr-1.5 flex items-center justify-center text-[#7a8a6e] hover:text-[#e5484d] transition-colors"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>

          {/* live telemetry block (Task 9-b: + 60s history sparklines —
              keyed by def.nodeId above, so switching nodes resets history) */}
          <LiveTelemetryBlock nodeId={def.nodeId} />

          {/* physical spec block (Appendix C.2 sovereign schema) */}
          <div className="rounded border border-[rgba(107,138,64,0.22)] bg-[rgba(6,8,6,0.55)] px-2 py-1.5">
            <div className="vvu-label text-[7px] text-[#8fb35a] mb-0.5">PHYSICAL SPEC · ENU MM</div>
            <SpecRow label="X · EAST" value={`${def.xMm.toLocaleString("en-ZA")} mm`} />
            <SpecRow label="Y · NORTH" value={`${def.yMm.toLocaleString("en-ZA")} mm`} />
            <SpecRow label="Z · UP" value={`${def.zMm.toLocaleString("en-ZA")} mm`} />
            {def.materialGrade && (
              <SpecRow label="MATERIAL" value={def.materialGrade} mono={false} />
            )}
            {def.diameterMm !== undefined && (
              <SpecRow label="OD" value={`${def.diameterMm.toFixed(1)} mm`} />
            )}
            {def.assemblyTorqueNm !== undefined && (
              <SpecRow label="ASSY TORQUE" value={`${def.assemblyTorqueNm.toFixed(1)} N·m`} />
            )}
          </div>

          {/* Task 11-c — provenance footer: wraps (no truncate) — this is a
              verification surface; the RLS predicate must be readable in
              full, not hidden behind an ellipsis. */}
          <div className="vvu-label text-[6.5px] text-[#7a8a6e] mt-1.5 leading-[1.6] break-words">
            SOVEREIGN DB · physical_nodes · RLS vvu.current_tenant_id
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export default NodeInspector;
