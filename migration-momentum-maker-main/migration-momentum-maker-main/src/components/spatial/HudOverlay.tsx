"use client";

// src/components/spatial/HudOverlay.tsx — floating SCADA HUD over the 3D/2D
// scene: verification headline, stat chips, live gauges (sparkline bars),
// FSM state banner. Root is pointer-events-none; interactive children opt in.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useFsmLog, useFrame, useVvuSocketStore } from "@/hooks/use-vvu-socket";
import { PHYSICAL_NODES, THERMAL } from "@/lib/vvu-data";
import type { AnalyticsSummary, TelemetryFrame } from "@/types/vvu";
import { fsmColor } from "./spatial-style";
import { PyNetChip } from "./PyNetChip";

interface HudOverlayProps {
  fps: number | null;
  drawCalls: number | null;
  /** Round 12 (city GIS bench): drop the gauge column to the mobile-style
   *  bottom strip at ALL viewport sizes, freeing the left edge for the
   *  SYS.02 / SYS.03 / NODE ARRAY bench panels. */
  gaugesBottom?: boolean;
}

// ── sparkline gauge ──────────────────────────────────────────────────────────

interface GaugeProps {
  label: string;
  value: number | null;
  unit: string;
  max: number;
  bars: number[];
  valueColor?: string;
  marks?: Array<{ pct: number; color: string }>;
}

function Gauge({ label, value, unit, max, bars, valueColor, marks }: GaugeProps) {
  const pct = value === null ? 0 : Math.min(1, Math.max(0, value / max));
  const fillColor = valueColor ?? "#8fb35a";
  // Static glow on the live fill — lime-critical values get the signature
  // lime halo, other colours a tinted version. Shadow only, no animation,
  // so it is safe under prefers-reduced-motion.
  const fillGlow =
    fillColor.toLowerCase() === "#c8ff00"
      ? "0 0 8px rgba(200,255,0,0.25)"
      : `0 0 8px ${fillColor}66`;
  return (
    <div className="shrink-0 w-[132px] sm:w-full rounded-sm border border-[rgba(107,138,64,0.25)] bg-[rgba(11,15,10,0.78)] backdrop-blur-sm px-2.5 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="vvu-label text-[6.5px] sm:text-[7.5px] text-[#7a8a6e] truncate">
          {label}
        </span>
        <span
          className="font-mono text-[10px] sm:text-[11px] font-bold tabular-nums leading-none"
          style={{ color: valueColor ?? "#c9d4bd" }}
        >
          {value === null ? "——" : value.toFixed(1)}
          <span className="text-[6.5px] text-[#7a8a6e] ml-0.5">{unit}</span>
        </span>
      </div>

      {/* current-value bar with warn/crit marks (2px-class track + glow) */}
      <div className="relative h-2 mt-1 rounded-[1px] bg-[rgba(107,138,64,0.14)] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-[1px] transition-[width] duration-700 ease-out"
          style={{
            width: `${pct * 100}%`,
            background: fillColor,
            boxShadow: fillGlow,
          }}
        />
        {marks?.map((m) => (
          <div
            key={m.pct}
            className="absolute inset-y-0 w-[2px]"
            style={{ left: `${m.pct}%`, background: m.color, opacity: 0.9 }}
          />
        ))}
      </div>

      {/* sparkline history bars */}
      <div className="flex items-end gap-[2px] h-3 mt-1" aria-hidden="true">
        {bars.length === 0
          ? Array.from({ length: 14 }, (_, i) => (
              <div
                key={i}
                className="w-[3px] rounded-[1px] bg-[rgba(107,138,64,0.14)]"
                style={{ height: "8%" }}
              />
            ))
          : bars.map((b, i) => {
              const hp = Math.min(1, Math.max(0, b / max));
              const isLast = i === bars.length - 1;
              const barColor = isLast ? (valueColor ?? "#c8ff00") : "#6b8a40";
              return (
                <div
                  key={i}
                  className="w-[3px] rounded-[1px]"
                  style={{
                    height: `${Math.max(8, hp * 100)}%`,
                    background: barColor,
                    opacity: isLast ? 1 : 0.3 + (0.55 * (i + 1)) / bars.length,
                    // live (newest) history bar: lime-critical values glow
                    boxShadow:
                      isLast && barColor.toLowerCase() === "#c8ff00"
                        ? "0 0 8px rgba(200,255,0,0.25)"
                        : undefined,
                  }}
                />
              );
            })}
      </div>
    </div>
  );
}

// ── stat chip ────────────────────────────────────────────────────────────────

function StatChip({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div
      title={title}
      className="rounded-sm border border-[rgba(107,138,64,0.25)] bg-[rgba(11,15,10,0.78)] backdrop-blur-sm px-1 sm:px-2 py-0.5 min-w-[44px] lg:min-w-[62px] text-center"
    >
      <div className="vvu-label text-[5.5px] sm:text-[7px] lg:text-[8px] text-[#7a8a6e] truncate leading-none">
        {label}
      </div>
      <div className="font-mono text-[9px] sm:text-[13px] lg:text-[15px] font-bold text-[#c9d4bd] tabular-nums truncate leading-none mt-0.5">
        {value}
      </div>
    </div>
  );
}

// ── main overlay ─────────────────────────────────────────────────────────────

interface GaugeHistory {
  fin: number[];
  fout: number[];
  pr: number[];
  tp: number[];
}

/** Rolling gauge history: appends one entry per telemetry frame change
 *  (setState in a store-subscription callback — not in the effect body). */
function useGaugeHistory(): GaugeHistory {
  const [hist, setHist] = useState<GaugeHistory>({ fin: [], fout: [], pr: [], tp: [] });
  useEffect(() => {
    const push = (f: TelemetryFrame) => {
      const nd = (id: string) => f.nodes.find((x) => x.nodeId === id);
      setHist((h) => ({
        fin: [...h.fin.slice(-15), nd("N02")?.flowRate ?? 0],
        fout: [...h.fout.slice(-15), nd("N03")?.flowRate ?? 0],
        pr: [...h.pr.slice(-15), nd("N04")?.pressureHead ?? 0],
        tp: [...h.tp.slice(-15), Math.max(...f.nodes.map((x) => x.apuTemperature))],
      }));
    };
    const unsub = useVvuSocketStore.subscribe((state, prev) => {
      if (state.frame && state.frame !== prev.frame) push(state.frame);
    });
    return unsub;
  }, []);
  return hist;
}

export function HudOverlay({ fps, drawCalls, gaugesBottom = false }: HudOverlayProps) {
  const frame = useFrame();
  const fsmLog = useFsmLog();
  const [nowTick, setNowTick] = useState(() => Date.now());
  const hist = useGaugeHistory();
  const [fsmConsoleOpen, setFsmConsoleOpen] = useState(false);

  // The FSM console (FsmPanel) broadcasts expand/collapse: on phones it
  // covers the bottom gauges strip + FSM banner, so fade them out from
  // behind it instead of letting the two bottom stacks fight (desktop keeps
  // its left-column gauges — no overlap there, nothing changes).
  useEffect(() => {
    const onFsmConsole = (evt: Event) =>
      setFsmConsoleOpen(Boolean((evt as CustomEvent<boolean>).detail));
    window.addEventListener("vvu:fsm-console", onFsmConsole);
    return () => window.removeEventListener("vvu:fsm-console", onFsmConsole);
  }, []);

  // 1s ticker for the FSM "since" counter.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: analytics } = useQuery<AnalyticsSummary>({
    queryKey: ["vvu-analytics"],
    queryFn: async () => {
      const r = await fetch("/api/vvu/analytics");
      if (!r.ok) throw new Error("analytics offline");
      return (await r.json()) as AnalyticsSummary;
    },
    refetchInterval: 30_000,
  });

  const nodes = frame?.nodes ?? [];
  const n02 = nodes.find((x) => x.nodeId === "N02");
  const n03 = nodes.find((x) => x.nodeId === "N03");
  const n04 = nodes.find((x) => x.nodeId === "N04");
  const apuTemp = nodes.length ? Math.max(...nodes.map((x) => x.apuTemperature)) : null;
  const acousticAbnormal = nodes.some((x) => x.acousticAbnormal);
  const invariantOk = frame?.invariantOk ?? null;
  const celerity = frame?.estimatedCelerity ?? null;
  const thermal = frame?.thermalThrottled ?? false;

  const tempColor =
    apuTemp === null
      ? "#c9d4bd"
      : apuTemp >= THERMAL.critC
        ? "#e5484d"
        : apuTemp >= THERMAL.warnC
          ? "#e0a030"
          : "#c9d4bd";

  const fsm = frame?.fsmState ?? null;
  const stateCol = fsmColor(fsm);
  const lastEntry = fsmLog.length ? fsmLog[fsmLog.length - 1] : null;
  const sinceS = lastEntry ? Math.max(0, Math.floor((nowTick - lastEntry.ts) / 1000)) : null;
  const leak = frame?.leak ?? null;
  const leakNode = leak?.nodeId ? PHYSICAL_NODES.find((p) => p.nodeId === leak.nodeId) : null;
  const trustPct = (analytics?.voting.pct ?? 70.66).toFixed(2);

  return (
    <div className="absolute inset-0 z-10 pointer-events-none select-none">
      {/* ── top-left: verification headline ── */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="absolute top-2 left-2 max-[479px]:top-1.5 max-[479px]:left-1.5 sm:top-3 sm:left-3 max-w-[46vw] sm:max-w-[280px] vvu-panel backdrop-blur-sm px-2.5 sm:px-3 py-1.5 sm:py-2"
      >
        <div className="vvu-label text-[8px] sm:text-[11px] font-bold text-[#f3e38a] leading-tight">
          VERIFICATION · REAL-TIME
        </div>
        <div className="vvu-label text-[5.5px] sm:text-[7px] text-[#8fa07f] mt-0.5 truncate">
          ingestEdgeTelemetry · WORM binding · invariants
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className="flex items-center gap-1">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                frame ? "bg-[#c8ff00] vvu-pulse" : "bg-[#e5484d] vvu-blink"
              }`}
            />
            <span className="vvu-label text-[6px] sm:text-[7.5px] text-[#8fb35a]">
              {frame ? "LIVE" : "STALE"}
            </span>
          </span>
          <span className="vvu-label text-[6px] sm:text-[7.5px] text-[#7a8a6e]">1.5s CADENCE</span>
          <span className="vvu-label text-[6px] sm:text-[7.5px] text-[#2ea8a0] tabular-nums">
            a={(celerity ?? 0).toFixed(0)} m/s
          </span>
          <span
            className="vvu-label text-[6px] sm:text-[7.5px] px-1.5 py-[1px] rounded-sm border font-bold"
            style={{
              color: invariantOk === null ? "#7a8a6e" : invariantOk ? "#c8ff00" : "#e5484d",
              borderColor:
                invariantOk === null
                  ? "rgba(122,138,110,0.3)"
                  : invariantOk
                    ? "rgba(200,255,0,0.35)"
                    : "rgba(229,72,77,0.5)",
            }}
            aria-live="polite"
          >
            INV {invariantOk === null ? "——" : invariantOk ? "OK" : "VIOLATION"}
          </span>
        </div>
      </motion.div>

      {/* ── top-right: KPI stat chips — two explicit rows (FPS/AGENTS/TIER over
          TRUST/FILES/SOURCE) with a faint sage divider between them, so the
          value-forward chips read as a KPI grid. Rows are content-width
          (items-end) to keep the top-center projection control clear at mid
          viewports; the stack must also stay above the NodeInspector (top 96px
          sm / 108px mobile). ── */}
      <motion.div
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
        className="absolute top-2 right-2 max-[479px]:top-1.5 max-[479px]:right-1.5 sm:top-3 sm:right-3 flex flex-col items-end gap-1 max-[479px]:gap-1 sm:gap-1.5 max-w-[46vw] sm:max-w-[312px]"
      >
        <div className="flex flex-wrap justify-end gap-1 max-[479px]:gap-1 sm:gap-1.5 sm:pb-1 sm:border-b sm:border-[rgba(107,138,64,0.15)]">
          <StatChip
            label="FPS"
            value={fps === null ? "——" : String(Math.round(fps))}
            title={`draw calls: ${drawCalls ?? "—"}`}
          />
          <StatChip label="AGENTS" value="2" title="VVU-SENTRY · ZOO-VERIFIER" />
          <StatChip label="TIER" value="L1·EIS v1.0" />
        </div>
        <div className="flex flex-wrap justify-end gap-1 max-[479px]:gap-1 sm:gap-1.5">
          <StatChip
            label="TRUST"
            value={`${trustPct}% T`}
            title="MOI weighted voting · terminal 70.66%"
          />
          <StatChip label="FILES" value="19" title="RELEASE_MANIFEST · 19 master assets" />
          <StatChip
            label="SOURCE"
            value="EDGE·GQ"
            title="Gqeberha edge node · WGS84 -33.9608, 25.6022"
          />
        </div>
      </motion.div>

      {/* ── PY-NET chip — Spatial Twin telemetry pointed at the Python
          flywheel ledger.jsonl (operator directive). One pinned chip,
          bottom-right: clear of the NodeInspector (top-right) and the FSM
          banner (sm:right-[260px] reservation); fades on phones only while
          the FSM console covers the bottom edge. ── */}
      <div
        className={`absolute bottom-9 right-2 max-[479px]:right-1.5 sm:right-3 pointer-events-auto transition-opacity duration-150 ${
          fsmConsoleOpen ? "max-[479px]:opacity-0" : ""
        }`}
        aria-hidden={fsmConsoleOpen ? "true" : undefined}
      >
        <PyNetChip />
      </div>

      {/* ── gauges: mobile = horizontal strip above FSM banner; md+ = left
          column (city mode keeps the horizontal strip at every size — the left
          edge belongs to the SYS.02/SYS.03 bench panels).
          Outer div carries the positioning + the fade-out while the FSM console
          is open (framer's inline opacity on the inner would fight a class). ── */}
      <div
        className={`absolute bottom-[156px] max-[479px]:bottom-[148px] left-2 right-2 max-[479px]:left-1.5 max-[479px]:right-1.5 ${
          gaugesBottom ? "" : "sm:bottom-auto sm:right-auto sm:top-[92px] sm:left-3 sm:w-[152px]"
        } pointer-events-auto transition-opacity duration-150 ${
          fsmConsoleOpen ? "max-[479px]:opacity-0 max-[479px]:pointer-events-none" : ""
        }`}
        aria-label="Live telemetry gauges"
        aria-hidden={fsmConsoleOpen ? "true" : undefined}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12, ease: "easeOut" }}
          className={`flex gap-1.5 max-[479px]:gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] ${
            gaugesBottom ? "" : "sm:flex-col sm:gap-3"
          }`}
          style={{ scrollbarWidth: "none" }}
        >
          <Gauge
            label="FLOW IN · N02"
            value={n02?.flowRate ?? null}
            unit="L/s"
            max={100}
            bars={hist.fin}
          />
          <Gauge
            label="FLOW OUT · N03"
            value={n03?.flowRate ?? null}
            unit="L/s"
            max={100}
            bars={hist.fout}
          />
          <Gauge
            label="PRESSURE · N04"
            value={n04?.pressureHead ?? null}
            unit="m"
            max={120}
            bars={hist.pr}
          />
          <Gauge
            label="APU TEMP · MAX"
            value={apuTemp}
            unit="°C"
            max={100}
            bars={hist.tp}
            valueColor={tempColor}
            marks={[
              { pct: THERMAL.warnC, color: "#e0a030" },
              { pct: THERMAL.critC, color: "#e5484d" },
            ]}
          />
          {/* ACOUSTIC — same gauge-row treatment as the rows above (label +
            value header, status bar track) instead of an orphaned badge; no
            sparkline because acoustic is a boolean, not a time series. */}
          <div className="shrink-0 w-[132px] sm:w-full rounded-sm border border-[rgba(107,138,64,0.25)] bg-[rgba(11,15,10,0.78)] backdrop-blur-sm px-2.5 py-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="vvu-label text-[6.5px] sm:text-[7.5px] text-[#7a8a6e] truncate">
                ACOUSTIC
              </span>
              <span
                className="font-mono text-[10px] sm:text-[11px] font-bold tabular-nums leading-none"
                style={{
                  color: nodes.length === 0 ? "#c9d4bd" : acousticAbnormal ? "#e5484d" : "#c8ff00",
                }}
                aria-live="polite"
              >
                {nodes.length === 0 ? "——" : acousticAbnormal ? "ANOMALY" : "OK"}
              </span>
            </div>
            {/* status bar: full lime = all channels nominal, crimson blink =
              abnormal channel; static shadow only (reduced-motion safe). */}
            <div className="relative h-2 mt-1 rounded-[1px] bg-[rgba(107,138,64,0.14)] overflow-hidden">
              {nodes.length > 0 && (
                <div
                  className={`absolute inset-y-0 left-0 rounded-[1px] ${acousticAbnormal ? "vvu-blink" : ""}`}
                  style={{
                    width: "100%",
                    background: acousticAbnormal ? "#e5484d" : "#c8ff00",
                    boxShadow: acousticAbnormal
                      ? "0 0 8px rgba(229,72,77,0.25)"
                      : "0 0 8px rgba(200,255,0,0.25)",
                  }}
                />
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── bottom-center: FSM banner (hidden on phones while the FSM console
          is expanded — the console shows the same state without the pile-up) ── */}
      <div
        className={`absolute bottom-[96px] max-[479px]:bottom-[90px] inset-x-2 max-[479px]:inset-x-1.5 sm:inset-x-auto sm:bottom-9 sm:left-[140px] sm:right-[260px] flex justify-center transition-opacity duration-150 ${
          fsmConsoleOpen ? "max-[479px]:opacity-0 max-[479px]:pointer-events-none" : ""
        }`}
        aria-hidden={fsmConsoleOpen ? "true" : undefined}
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.16, ease: "easeOut" }}
          className="vvu-panel backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 text-center max-w-full"
          aria-live="polite"
        >
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span
              className="vvu-label text-[10px] sm:text-[13px] font-bold tracking-[0.12em]"
              style={{ color: stateCol, textShadow: `0 0 14px ${stateCol}55` }}
            >
              {fsm ?? "AWAITING SERVICE"}
            </span>
            <span className="vvu-label text-[6.5px] sm:text-[8px] text-[#7a8a6e] tabular-nums">
              since {sinceS === null ? "——" : `${sinceS}s`}
            </span>
          </div>
          {leak?.active && leakNode && (
            <div
              className="vvu-label text-[6.5px] sm:text-[8.5px] mt-0.5 font-bold"
              style={{ color: "#e5484d" }}
            >
              <span className="vvu-blink">◉</span> LEAK · {leakNode.nodeId}{" "}
              {leakNode.name.toUpperCase()} · INTENSITY {Math.round((leak.intensity ?? 0) * 100)}%
            </div>
          )}
          {thermal && !leak?.active && (
            <div className="vvu-label text-[6.5px] sm:text-[8.5px] mt-0.5 font-bold text-[#e0a030]">
              ⚠ APU THERMAL THROTTLE · CLK REDUCED · MESH DECIMATED
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default HudOverlay;
