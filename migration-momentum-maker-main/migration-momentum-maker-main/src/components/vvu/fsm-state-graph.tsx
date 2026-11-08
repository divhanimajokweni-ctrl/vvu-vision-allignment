"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FSM_STATES,
  FSM_TRANSITIONS,
  STATE_META,
  type VvuFsmController,
  type VvuSymbol,
  type VvuSystemState,
} from "@/lib/vvu-fsm-controller";
import { cn } from "@/lib/utils";

interface FsmStateGraphProps {
  controller: VvuFsmController;
  currentState: VvuSystemState;
  onDispatch?: (sym: VvuSymbol) => void;
}

// Layout: each state has a fixed (x, y) position on a 600x400 SVG canvas
// Arranged in a meaningful flow:
//   DISCONNECTED (top-left) → PAIRING_BLE → TOTP_VERIFICATION
//   TOTP_VERIFICATION → STEADY_STATE_LOCKED (center hub)
//   STEADY_STATE_LOCKED ↔ LEAK_SIMULATION_ACTIVE (right)
//   STEADY_STATE_LOCKED → THERMAL_THROTTLE (bottom)
//   LEAK_SIMULATION_ACTIVE → THERMAL_THROTTLE
//   THERMAL_THROTTLE → FAIL_CLOSED_LOCKDOWN (bottom-left)
//   FAIL_CLOSED_LOCKDOWN → STEADY_STATE_LOCKED (RESET - long arrow)
const STATE_POSITIONS: Record<VvuSystemState, { x: number; y: number }> = {
  DISCONNECTED: { x: 90, y: 60 },
  PAIRING_BLE: { x: 260, y: 60 },
  TOTP_VERIFICATION: { x: 430, y: 60 },
  STEADY_STATE_LOCKED: { x: 430, y: 210 },
  LEAK_SIMULATION_ACTIVE: { x: 560, y: 210 },
  THERMAL_THROTTLE: { x: 260, y: 340 },
  FAIL_CLOSED_LOCKDOWN: { x: 90, y: 340 },
};

const W = 660;
const H = 400;
const NODE_R = 42;

export function FsmStateGraph({ controller, currentState, onDispatch }: FsmStateGraphProps) {
  const [hoveredState, setHoveredState] = useState<VvuSystemState | null>(null);
  const [hoveredTrans, setHoveredTrans] = useState<number | null>(null);

  const available = controller.availableSymbols();

  // Build edge paths with curved arrows
  const edges = useMemo(() => {
    return FSM_TRANSITIONS.map((t, i) => {
      const from = STATE_POSITIONS[t.from];
      const to = STATE_POSITIONS[t.to];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / dist;
      const uy = dy / dist;

      // Start and end points on the node circle border
      const sx = from.x + ux * NODE_R;
      const sy = from.y + uy * NODE_R;
      const ex = to.x - ux * (NODE_R + 8); // leave room for arrowhead
      const ey = to.y - uy * (NODE_R + 8);

      // Curve offset for bidirectional edges (same from→to pair in reverse)
      const hasReverse = FSM_TRANSITIONS.some((t2) => t2.from === t.to && t2.to === t.from);
      const curveOffset = hasReverse ? 22 : 0;

      // Perpendicular vector for curve
      const px = -uy;
      const py = ux;
      const mx = (sx + ex) / 2 + px * curveOffset;
      const my = (sy + ey) / 2 + py * curveOffset;

      // Special case: FAIL_CLOSED_LOCKDOWN → STEADY_STATE_LOCKED is a long curved arrow
      const isLongReturn = t.from === "FAIL_CLOSED_LOCKDOWN" && t.to === "STEADY_STATE_LOCKED";

      let pathD: string;
      if (isLongReturn) {
        // Big curve going up and right
        pathD = `M ${sx} ${sy} C ${sx + 60} ${sy - 80}, ${ex - 60} ${ey - 80}, ${ex} ${ey}`;
      } else if (curveOffset > 0) {
        pathD = `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`;
      } else {
        pathD = `M ${sx} ${sy} L ${ex} ${ey}`;
      }

      // Label position at midpoint
      const labelX = isLongReturn ? (sx + ex) / 2 : mx;
      const labelY = isLongReturn ? Math.min(sy, ey) - 50 : my;

      return {
        ...t,
        i,
        pathD,
        labelX,
        labelY,
        sx,
        sy,
        ex,
        ey,
        isAvailable: t.from === currentState,
      };
    });
  }, [currentState]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">VVU FSM State-Machine Graph</h3>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>7 states · 11 transitions · 9 symbols</span>
        </div>
      </div>

      <Card className="border-border vvu-surface-deep p-2 vvu-scanlines overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: 400 }}>
          <defs>
            {/* Arrowhead markers — one per state color */}
            {FSM_STATES.map((s) => {
              const color = STATE_META[s].color;
              return (
                <marker
                  key={s}
                  id={`arrow-${s}`}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={color} opacity="0.8" />
                </marker>
              );
            })}
            {/* Glow filter for current state */}
            <filter id="fsm-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Grid pattern */}
            <pattern id="fsm-grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1a2436" strokeWidth="0.5" />
            </pattern>
          </defs>

          {/* Background grid */}
          <rect width={W} height={H} fill="url(#fsm-grid)" opacity="0.4" />

          {/* Draw edges (transitions) */}
          {edges.map((e) => {
            const fromColor = STATE_META[e.from].color;
            const isHovered = hoveredTrans === e.i;
            const isAvailable = e.from === currentState;
            const opacity = isAvailable ? 0.9 : isHovered ? 0.7 : 0.3;
            const strokeWidth = isAvailable || isHovered ? 2 : 1.2;

            return (
              <g key={e.i}>
                <path
                  d={e.pathD}
                  fill="none"
                  stroke={fromColor}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  markerEnd={`url(#arrow-${e.from})`}
                  strokeDasharray={isAvailable ? "none" : "4 3"}
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredTrans(e.i)}
                  onMouseLeave={() => setHoveredTrans(null)}
                />
                {/* Transition label */}
                <g
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredTrans(e.i)}
                  onMouseLeave={() => setHoveredTrans(null)}
                >
                  <rect
                    x={e.labelX - 22}
                    y={e.labelY - 8}
                    width="44"
                    height="14"
                    rx="3"
                    fill="#06080c"
                    stroke={isAvailable || isHovered ? fromColor : "#334155"}
                    strokeWidth="0.5"
                    opacity={isAvailable || isHovered ? 1 : 0.7}
                  />
                  <text
                    x={e.labelX}
                    y={e.labelY + 2}
                    textAnchor="middle"
                    className="font-mono"
                    style={{
                      fontSize: "8px",
                      fontWeight: "bold",
                      fill: isAvailable || isHovered ? fromColor : "#64748b",
                    }}
                  >
                    {e.symbol}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Draw state nodes */}
          {FSM_STATES.map((s) => {
            const pos = STATE_POSITIONS[s];
            const meta = STATE_META[s];
            const isCurrent = s === currentState;
            const isHovered = hoveredState === s;
            const isAvailable = available.some((sym) =>
              FSM_TRANSITIONS.some((t) => t.from === s && t.symbol === sym),
            );

            return (
              <g
                key={s}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredState(s)}
                onMouseLeave={() => setHoveredState(null)}
                onClick={() => {
                  // If this state has available transitions, dispatch the first one
                  if (isCurrent && available.length > 0 && onDispatch) {
                    onDispatch(available[0]);
                  }
                }}
              >
                {/* Outer glow ring for current state */}
                {isCurrent && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={NODE_R + 6}
                    fill="none"
                    stroke={meta.color}
                    strokeWidth="1"
                    strokeOpacity="0.4"
                    filter="url(#fsm-glow)"
                  >
                    <animate
                      attributeName="r"
                      values={`${NODE_R + 4};${NODE_R + 8};${NODE_R + 4}`}
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="stroke-opacity"
                      values="0.2;0.5;0.2"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Node circle */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={NODE_R}
                  fill={isCurrent ? meta.bg : "#0a0f18"}
                  stroke={meta.color}
                  strokeWidth={isCurrent ? 2.5 : isHovered ? 2 : 1.2}
                  strokeOpacity={isCurrent ? 1 : isHovered ? 0.8 : 0.5}
                />

                {/* Inner dot for current state */}
                {isCurrent && (
                  <circle cx={pos.x} cy={pos.y} r={5} fill={meta.color}>
                    <animate
                      attributeName="opacity"
                      values="1;0.4;1"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* State label (abbreviated) */}
                <text
                  x={pos.x}
                  y={pos.y - 4}
                  textAnchor="middle"
                  style={{
                    fontSize: "8px",
                    fontWeight: "bold",
                    fill: isCurrent ? meta.color : "#cbd5e1",
                  }}
                >
                  {s.split("_")[0]}
                </text>
                <text
                  x={pos.x}
                  y={pos.y + 6}
                  textAnchor="middle"
                  style={{
                    fontSize: "7px",
                    fill: isCurrent ? meta.color : "#94a3b8",
                  }}
                >
                  {s.split("_").slice(1).join("_").length > 10
                    ? s.split("_").slice(1).join("_").slice(0, 10) + "…"
                    : s.split("_").slice(1).join("_")}
                </text>

                {/* Available indicator */}
                {isCurrent && available.length > 0 && (
                  <circle cx={pos.x + NODE_R - 8} cy={pos.y - NODE_R + 8} r={4} fill="#c8ff00">
                    <animate
                      attributeName="opacity"
                      values="1;0.3;1"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </g>
            );
          })}

          {/* Hover tooltip for state */}
          {hoveredState && (
            <g>
              {(() => {
                const pos = STATE_POSITIONS[hoveredState];
                const meta = STATE_META[hoveredState];
                const tw = 200;
                const th = 50;
                const tx = Math.min(W - tw - 4, pos.x + NODE_R + 8);
                const ty = Math.max(4, pos.y - th / 2);
                return (
                  <>
                    <rect
                      x={tx}
                      y={ty}
                      width={tw}
                      height={th}
                      rx="4"
                      fill="#06080c"
                      stroke={meta.color}
                      strokeWidth="0.5"
                      opacity="0.95"
                    />
                    <text
                      x={tx + 6}
                      y={ty + 12}
                      style={{ fontSize: "8px", fontWeight: "bold", fill: meta.color }}
                    >
                      {hoveredState.replace(/_/g, " ")}
                    </text>
                    <text x={tx + 6} y={ty + 24} style={{ fontSize: "7px", fill: "#94a3b8" }}>
                      {meta.description.slice(0, 38)}…
                    </text>
                    <text x={tx + 6} y={ty + 36} style={{ fontSize: "7px", fill: "#64748b" }}>
                      {hoveredState === currentState
                        ? "● CURRENT — click to dispatch"
                        : "click to inspect"}
                    </text>
                  </>
                );
              })()}
            </g>
          )}
        </svg>
      </Card>

      {/* Dispatch buttons for available transitions */}
      {available.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Dispatchable from {currentState.replace(/_/g, " ")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {available.map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                className="h-7 gap-1 font-mono text-[10px] border-lime-700/60 bg-lime-950/30 text-lime-300 hover:bg-lime-950 hover:text-lime-200"
                onClick={() => onDispatch?.(s)}
              >
                {s}
                <span className="text-muted-foreground">
                  →{" "}
                  {FSM_TRANSITIONS.find(
                    (t) => t.from === currentState && t.symbol === s,
                  )?.to.replace(/_/g, " ")}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Recent transitions */}
      {controller.history().length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
            Recent transitions
          </div>
          <div className="max-h-20 overflow-y-auto rounded border border-border vvu-surface-deep font-mono text-[10px]">
            {controller
              .history()
              .slice(-6)
              .reverse()
              .map((e, i) => (
                <div key={i} className="px-2 py-0.5 border-b border-border/40 last:border-0">
                  <span className="text-muted-foreground">
                    {new Date(e.at).toLocaleTimeString()}
                  </span>{" "}
                  <span className="text-amber-400">{e.symbol}</span>{" "}
                  <span className="text-foreground">{e.from.replace(/_/g, " ")}</span>{" "}
                  <span className="text-muted-foreground">→</span>{" "}
                  <span className="text-lime-400">{e.to.replace(/_/g, " ")}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap text-[9px] text-muted-foreground">
        {FSM_STATES.map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: STATE_META[s].color }}
            />
            {s.split("_")[0]}
          </span>
        ))}
        <span className="ml-auto">solid = available · dashed = inactive</span>
      </div>
    </div>
  );
}
