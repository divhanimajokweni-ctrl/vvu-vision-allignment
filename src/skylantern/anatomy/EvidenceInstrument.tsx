"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import type { VisualState, VerificationStatus } from "./visual-state";
import { VERIFICATION_STATUS, RENDER_MODE } from "./visual-state";

interface EvidenceInstrumentProps {
  state: VisualState;
  onComponentSelect?: (componentId: string) => void;
}

const STATUS_CONFIG: Record<
  VerificationStatus,
  {
    label: string;
    color: string;
    glowColor: string;
    indicatorAngle: number; // angle of the final indicator needle
    interlockEngaged: boolean;
    releaseBlocked: boolean;
    carriagePosition: number; // 0 = disengaged, 1 = engaged
  }
> = {
  READY: {
    label: "READY",
    color: "#64748b",
    glowColor: "#64748b40",
    indicatorAngle: -60,
    interlockEngaged: false,
    releaseBlocked: true,
    carriagePosition: 0,
  },
  BLOCKED_MISSING_INPUT: {
    label: "BLOCKED · MISSING INPUT",
    color: "#f59e0b",
    glowColor: "#f59e0b60",
    indicatorAngle: -30,
    interlockEngaged: false,
    releaseBlocked: true,
    carriagePosition: 0.5,
  },
  BLOCKED_INDEPENDENCE: {
    label: "BLOCKED · INDEPENDENCE",
    color: "#ef4444",
    glowColor: "#ef444460",
    indicatorAngle: 180,
    interlockEngaged: false,
    releaseBlocked: true,
    carriagePosition: 1,
  },
  INCONCLUSIVE: {
    label: "INCONCLUSIVE",
    color: "#a855f7",
    glowColor: "#a855f760",
    indicatorAngle: 90,
    interlockEngaged: false,
    releaseBlocked: true,
    carriagePosition: 0.5,
  },
  PROVEN: {
    label: "PROVEN",
    color: "#10b981",
    glowColor: "#10b98160",
    indicatorAngle: 0,
    interlockEngaged: true,
    releaseBlocked: false,
    carriagePosition: 1,
  },
  RELEASED: {
    label: "RELEASED",
    color: "#6b7280",
    glowColor: "#6b728040",
    indicatorAngle: 0,
    interlockEngaged: true,
    releaseBlocked: false,
    carriagePosition: 1,
  },
};

/**
 * EvidenceInstrument — an isometric SVG precision instrument that physically
 * represents the Skylantern verification pipeline.
 *
 * The instrument has 5 mechanical stages, each driven by the VisualState:
 *
 *   1. INPUT CARRIAGE     — moves into position when evidence is received
 *   2. SOURCE SELECTOR    — rotates to identify which source produced the reading
 *   3. INTERLOCK          — engages only when independence requirement is met (R2)
 *   4. FINAL INDICATOR    — a dial needle that points to the verification result
 *   5. RELEASE LEVER      — physically blocked unless verification is PROVEN
 *
 * CRITICAL: Every visual element's state is derived from `state.verification.status`.
 * The component NEVER computes its own verification result. If the state says
 * BLOCKED, the interlock stays disengaged — even if the user clicks it.
 *
 * "The system establishes what is true, the evidence explains why the system
 * believes it, and the visualisation makes both inspectable."
 */
export function EvidenceInstrument({
  state,
  onComponentSelect,
}: EvidenceInstrumentProps) {
  const config = STATUS_CONFIG[state.verification.status] ?? STATUS_CONFIG.READY;
  const isLive = state.mode === RENDER_MODE.LIVE;
  const isSimulation = state.mode === RENDER_MODE.SIMULATION;
  const isReplay = state.mode === RENDER_MODE.REPLAY;

  const sourceCount = state.sources.length;
  const independentCount = state.sources.filter(
    (s) => s.status === "INDEPENDENT"
  ).length;

  return (
    <div className="relative flex flex-col items-center">
      {/* Mode badge — distinguishes LIVE telemetry from SIMULATION/REPLAY */}
      <div className="mb-3 flex items-center gap-2">
        <ModeBadge mode={state.mode} />
        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
          {config.label}
        </span>
      </div>

      {/* The instrument — isometric SVG */}
      <svg
        viewBox="0 0 400 300"
        className="w-full max-w-md"
        style={{ filter: `drop-shadow(0 4px 12px ${config.glowColor})` }}
      >
        <defs>
          {/* Isometric grid */}
          <pattern
            id="iso-grid"
            width="20"
            height="11.55"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 0 0 L 10 5.77 L 20 0 M 10 5.77 L 10 17.32"
              stroke="rgba(148,163,184,0.08)"
              strokeWidth="0.5"
              fill="none"
            />
          </pattern>
          {/* Metal gradient */}
          <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="50%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="metal-light" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <radialGradient id="dial-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={config.color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={config.color} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background grid */}
        <rect width="400" height="300" fill="url(#iso-grid)" />

        {/* Base plate — the verification boundary */}
        <IsometricPlate x={200} y={220} w={320} h={40} color="#1e293b" />
        <text
          x={200}
          y={262}
          textAnchor="middle"
          className="font-mono"
          fill="#475569"
          fontSize="8"
          letterSpacing="2"
        >
          VERIFICATION BOUNDARY
        </text>

        {/* Stage 1: Input carriage (slides in from left) */}
        <InputCarriage
          engaged={config.carriagePosition}
          color={config.color}
          sourceCount={sourceCount}
          onSelect={() => onComponentSelect?.("input-carriage")}
        />

        {/* Stage 2: Source selector (rotates) */}
        <SourceSelector
          rotation={sourceCount > 0 ? (360 / Math.max(sourceCount, 1)) : 0}
          color={config.color}
          sourceCount={sourceCount}
          onSelect={() => onComponentSelect?.("source-selector")}
        />

        {/* Stage 3: Interlock (engages only when R2) */}
        <Interlock
          engaged={config.interlockEngaged}
          color={config.color}
          tierTag={state.verification.tierTag}
          onSelect={() => onComponentSelect?.("interlock")}
        />

        {/* Stage 4: Final indicator dial */}
        <IndicatorDial
          angle={config.indicatorAngle}
          color={config.color}
          status={state.verification.status}
          confidence={state.verification.confidence}
          onSelect={() => onComponentSelect?.("indicator")}
        />

        {/* Stage 5: Release lever (blocked unless PROVEN) */}
        <ReleaseLever
          blocked={config.releaseBlocked}
          color={config.color}
          onSelect={() => onComponentSelect?.("release-lever")}
        />

        {/* Connection conduits between stages */}
        <Conduit
          x1={70}
          y1={150}
          x2={130}
          y2={150}
          active={config.carriagePosition > 0}
          color={config.color}
        />
        <Conduit
          x1={170}
          y1={150}
          x2={210}
          y2={150}
          active={config.interlockEngaged}
          color={config.color}
        />
        <Conduit
          x1={250}
          y1={150}
          x2={290}
          y2={150}
          active={!config.releaseBlocked}
          color={config.color}
        />
      </svg>

      {/* Readout panel — the raw state, always visible for inspection */}
      <div className="mt-4 w-full max-w-md space-y-2">
        <ReadoutRow
          label="Status"
          value={config.label}
          color={config.color}
        />
        <ReadoutRow
          label="Tier"
          value={`R${state.verification.tierTag} ${
            state.verification.tierTag >= 2 ? "· court-grade" : "· single-witness"
          }`}
        />
        <ReadoutRow
          label="Confidence"
          value={`${state.verification.confidence}%`}
        />
        <ReadoutRow
          label="Sources"
          value={`${sourceCount} total · ${independentCount} independent`}
        />
        {state.verification.blockedReason && (
          <div className="rounded-md border border-amber-900/40 bg-amber-950/20 p-2 text-[10px] text-amber-200/90">
            <span className="font-mono uppercase tracking-wider text-amber-400">
              Blocked:{" "}
            </span>
            {state.verification.blockedReason}
          </div>
        )}
        <div className="rounded-md border border-slate-800 bg-slate-900/40 p-2 text-[10px] text-slate-400">
          <span className="font-mono uppercase tracking-wider text-slate-500">
            Evidence:{" "}
          </span>
          {state.verification.evidenceSummary}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Isometric primitives — inspired by Anatomy's kit/iso-kit.mjs principles.
// ---------------------------------------------------------------------------

function IsometricPlate({
  x,
  y,
  w,
  h,
  color,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}) {
  return (
    <g>
      {/* Top face */}
      <polygon
        points={`${x - w / 2},${y} ${x},${y - h / 2} ${x + w / 2},${y} ${x},${y + h / 2}`}
        fill={color}
        stroke="rgba(148,163,184,0.2)"
        strokeWidth="1"
      />
    </g>
  );
}

function InputCarriage({
  engaged,
  color,
  sourceCount,
  onSelect,
}: {
  engaged: number;
  color: string;
  sourceCount: number;
  onSelect: () => void;
}) {
  // Carriage slides from x=20 (disengaged) to x=60 (engaged)
  const x = 20 + engaged * 40;
  return (
    <g onClick={onSelect} style={{ cursor: "pointer" }}>
      <title>Input Carriage — evidence intake</title>
      {/* Rail */}
      <line x1="20" y1="150" x2="70" y2="150" stroke="#334155" strokeWidth="2" />
      {/* Carriage body */}
      <motion.rect
        initial={{ x: 20 }}
        animate={{ x }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        y="135"
        width="30"
        height="30"
        rx="3"
        fill="url(#metal)"
        stroke={color}
        strokeWidth={sourceCount > 0 ? 1.5 : 0.5}
        strokeOpacity={sourceCount > 0 ? 1 : 0.3}
      />
      {/* Indicator light */}
      <motion.circle
        initial={{ cx: 35, opacity: 0.3 }}
        animate={{ cx: x + 15, opacity: sourceCount > 0 ? 1 : 0.3 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        cy="150"
        r="4"
        fill={sourceCount > 0 ? color : "#475569"}
      />
      {/* Label */}
      <text x={35} y={185} textAnchor="middle" fill="#64748b" fontSize="7" className="font-mono">
        INTAKE
      </text>
    </g>
  );
}

function SourceSelector({
  rotation,
  color,
  sourceCount,
  onSelect,
}: {
  rotation: number;
  color: string;
  sourceCount: number;
  onSelect: () => void;
}) {
  return (
    <g onClick={onSelect} style={{ cursor: "pointer" }}>
      <title>Source Selector — identifies which source produced the reading</title>
      {/* Hub */}
      <circle cx="150" cy="150" r="18" fill="url(#metal)" stroke="#475569" strokeWidth="1" />
      {/* Rotating arm */}
      <motion.g
        initial={{ rotate: 0 }}
        animate={{ rotate: rotation }}
        transition={{ type: "spring", stiffness: 150, damping: 20 }}
        style={{ transformOrigin: "150px 150px" }}
      >
        <line x1="150" y1="150" x2="150" y2="135" stroke={color} strokeWidth="2" />
        <circle cx="150" cy="132" r="3" fill={sourceCount > 0 ? color : "#475569"} />
      </motion.g>
      {/* Tick marks for each source */}
      {Array.from({ length: Math.max(sourceCount, 1) }).map((_, i) => {
        const angle = (360 / Math.max(sourceCount, 1)) * i;
        const rad = (angle - 90) * (Math.PI / 180);
        const tx = 150 + Math.cos(rad) * 22;
        const ty = 150 + Math.sin(rad) * 22;
        return (
          <circle key={i} cx={tx} cy={ty} r="1.5" fill="#475569" />
        );
      })}
      {/* Label */}
      <text x={150} y={185} textAnchor="middle" fill="#64748b" fontSize="7" className="font-mono">
        SOURCE
      </text>
    </g>
  );
}

function Interlock({
  engaged,
  color,
  tierTag,
  onSelect,
}: {
  engaged: boolean;
  color: string;
  tierTag: number;
  onSelect: () => void;
}) {
  return (
    <g onClick={onSelect} style={{ cursor: "pointer" }}>
      <title>
        Interlock — {engaged ? "ENGAGED (R2, independence satisfied)" : "DISENGAGED (R1, single witness)"}
      </title>
      {/* Mounting bracket */}
      <rect x="198" y="135" width="14" height="30" fill="url(#metal-light)" rx="2" />
      {/* The interlock pin — slides down when engaged */}
      <motion.rect
        initial={{ y: 135 }}
        animate={{ y: engaged ? 142 : 135 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        x="201"
        width="8"
        height="14"
        rx="2"
        fill={engaged ? color : "#64748b"}
        stroke={engaged ? color : "#475569"}
        strokeWidth="0.5"
      />
      {/* R1/R2 badge */}
      <text x={205} y={130} textAnchor="middle" fill={engaged ? color : "#475569"} fontSize="8" className="font-mono" fontWeight="bold">
        R{tierTag}
      </text>
      {/* Label */}
      <text x={205} y={185} textAnchor="middle" fill="#64748b" fontSize="7" className="font-mono">
        INTERLOCK
      </text>
    </g>
  );
}

function IndicatorDial({
  angle,
  color,
  status,
  confidence,
  onSelect,
}: {
  angle: number;
  color: string;
  status: VerificationStatus;
  confidence: number;
  onSelect: () => void;
}) {
  return (
    <g onClick={onSelect} style={{ cursor: "pointer" }}>
      <title>Final Indicator — verification result</title>
      {/* Glow */}
      <circle cx="230" cy="150" r="28" fill="url(#dial-glow)" />
      {/* Dial face */}
      <circle cx="230" cy="150" r="22" fill="#0f172a" stroke={color} strokeWidth="1.5" />
      {/* Tick marks */}
      {[-60, -30, 0, 30, 60, 90, 120, 150, 180].map((tickAngle) => {
        const rad = (tickAngle - 90) * (Math.PI / 180);
        const x1 = 230 + Math.cos(rad) * 18;
        const y1 = 150 + Math.sin(rad) * 18;
        const x2 = 230 + Math.cos(rad) * 22;
        const y2 = 150 + Math.sin(rad) * 22;
        return (
          <line
            key={tickAngle}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#475569"
            strokeWidth="1"
          />
        );
      })}
      {/* Needle */}
      <motion.line
        initial={{ rotate: -60 }}
        animate={{ rotate: angle }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        style={{ transformOrigin: "230px 150px" }}
        x1="230"
        y1="150"
        x2="230"
        y2="132"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Center pin */}
      <circle cx="230" cy="150" r="3" fill={color} />
      {/* Status text in dial */}
      <text x="230" y="175" textAnchor="middle" fill={color} fontSize="6" className="font-mono" fontWeight="bold">
        {status}
      </text>
      {/* Label */}
      <text x={230} y={185} textAnchor="middle" fill="#64748b" fontSize="7" className="font-mono">
        VERDICT
      </text>
    </g>
  );
}

function ReleaseLever({
  blocked,
  color,
  onSelect,
}: {
  blocked: boolean;
  color: string;
  onSelect: () => void;
}) {
  return (
    <g onClick={onSelect} style={{ cursor: "pointer" }}>
      <title>Release Lever — {blocked ? "BLOCKED (verification not proven)" : "ENGAGED (released)"}</title>
      {/* Mounting */}
      <rect x="318" y="135" width="6" height="30" fill="url(#metal)" rx="1" />
      {/* Lever arm — blocked = up, released = down */}
      <motion.rect
        initial={{ rotate: 0 }}
        animate={{ rotate: blocked ? -25 : 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 22 }}
        style={{ transformOrigin: "321px 150px" }}
        x="318"
        y="146"
        width="40"
        height="8"
        rx="3"
        fill={blocked ? "#475569" : color}
        stroke={blocked ? "#475569" : color}
        strokeWidth="0.5"
      />
      {/* Physical stop — visible when blocked */}
      {blocked && (
        <rect x="345" y="142" width="3" height="16" fill="#ef4444" opacity="0.6" rx="1" />
      )}
      {/* Label */}
      <text x={325} y={185} textAnchor="middle" fill="#64748b" fontSize="7" className="font-mono">
        RELEASE
      </text>
    </g>
  );
}

function Conduit({
  x1,
  y1,
  x2,
  y2,
  active,
  color,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active: boolean;
  color: string;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={active ? color : "#1e293b"}
      strokeWidth={active ? 2 : 1}
      strokeDasharray={active ? "0" : "3 3"}
      opacity={active ? 0.8 : 0.3}
    />
  );
}

// ---------------------------------------------------------------------------
// Readout + mode badge.
// ---------------------------------------------------------------------------

function ReadoutRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="font-mono uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span
        className="font-mono font-medium"
        style={{ color: color ?? "#cbd5e1" }}
      >
        {value}
      </span>
    </div>
  );
}

function ModeBadge({ mode }: { mode: VisualState["mode"] }) {
  const config = {
    LIVE: { color: "#10b981", label: "LIVE", icon: "●" },
    SIMULATION: { color: "#f59e0b", label: "SIM", icon: "◇" },
    REPLAY: { color: "#a855f7", label: "REPLAY", icon: "↻" },
  }[mode];
  return (
    <span
      className="flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider"
      style={{
        color: config.color,
        borderColor: `${config.color}40`,
        backgroundColor: `${config.color}15`,
      }}
    >
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
}
