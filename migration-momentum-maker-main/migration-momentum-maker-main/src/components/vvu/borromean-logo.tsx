"use client";

import { cn } from "@/lib/utils";

interface BorromeanLogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
  showProofBridgeDot?: boolean;
}

/**
 * The Borromean Three Rings — VVU brand mark.
 * Top = Venture (burnt orange #C46D1A)
 * Bottom-Left = Ubuntu (olive #6B8A40)
 * Bottom-Right = Vision (cream #F3E38A)
 * Center dot = ProofBridge (#FFFAC2)
 *
 * Borromean topology: pulling one ring breaks all three — interdependence.
 */
export function BorromeanLogo({
  size = 96,
  className,
  animated = true,
  showProofBridgeDot = true,
}: BorromeanLogoProps) {
  const c = size / 2;
  const r = size * 0.18;
  const ringStroke = size * 0.06;
  const off = size * 0.2;

  // Triangle formation (NOT concentric — Borromean)
  const top = { x: c, y: c - off };
  const bl = { x: c - off * 0.866, y: c + off * 0.5 };
  const br = { x: c + off * 0.866, y: c + off * 0.5 };
  const center = { x: c, y: c + off * 0.1 };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("select-none", animated && "transition-transform", className)}
      role="img"
      aria-label="VVU Borromean Three Rings — Venture, Ubuntu, Vision joined at ProofBridge"
    >
      <defs>
        <radialGradient id="ring-glow-v" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#C46D1A" stopOpacity="1" />
          <stop offset="70%" stopColor="#C46D1A" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#5a3000" stopOpacity="1" />
        </radialGradient>
        <radialGradient id="ring-glow-u" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8ab055" stopOpacity="1" />
          <stop offset="70%" stopColor="#6B8A40" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#2a3a14" stopOpacity="1" />
        </radialGradient>
        <radialGradient id="ring-glow-i" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff7c4" stopOpacity="1" />
          <stop offset="70%" stopColor="#F3E38A" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#6a5f30" stopOpacity="1" />
        </radialGradient>
        <radialGradient id="proof-bridge-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="60%" stopColor="#FFFAC2" stopOpacity="1" />
          <stop offset="100%" stopColor="#9a8a3a" stopOpacity="0.8" />
        </radialGradient>
      </defs>

      {animated && (
        <style>{`
          .ring-v { transform-origin: ${top.x}px ${top.y}px; animation: ring-breathe-v 4s ease-in-out infinite; }
          .ring-u { transform-origin: ${bl.x}px ${bl.y}px; animation: ring-breathe-u 4s ease-in-out infinite 0.4s; }
          .ring-i { transform-origin: ${br.x}px ${br.y}px; animation: ring-breathe-i 4s ease-in-out infinite 0.8s; }
          .proof-dot { transform-origin: ${center.x}px ${center.y}px; animation: proof-pulse 2.4s ease-in-out infinite; }
          @keyframes ring-breathe-v { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
          @keyframes ring-breathe-u { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
          @keyframes ring-breathe-i { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
          @keyframes proof-pulse { 0%,100%{transform:scale(1);opacity:.95} 50%{transform:scale(1.18);opacity:1} }
        `}</style>
      )}

      {/* Top ring — Venture */}
      <circle
        className="ring-v"
        cx={top.x}
        cy={top.y}
        r={r}
        fill="none"
        stroke="url(#ring-glow-v)"
        strokeWidth={ringStroke}
      />
      <circle cx={top.x} cy={top.y} r={r} fill="#C46D1A" fillOpacity="0.08" />

      {/* Bottom-Left ring — Ubuntu */}
      <circle
        className="ring-u"
        cx={bl.x}
        cy={bl.y}
        r={r}
        fill="none"
        stroke="url(#ring-glow-u)"
        strokeWidth={ringStroke}
      />
      <circle cx={bl.x} cy={bl.y} r={r} fill="#6B8A40" fillOpacity="0.08" />

      {/* Bottom-Right ring — Vision */}
      <circle
        className="ring-i"
        cx={br.x}
        cy={br.y}
        r={r}
        fill="none"
        stroke="url(#ring-glow-i)"
        strokeWidth={ringStroke}
      />
      <circle cx={br.x} cy={br.y} r={r} fill="#F3E38A" fillOpacity="0.10" />

      {showProofBridgeDot && (
        <circle
          className="proof-dot"
          cx={center.x}
          cy={center.y}
          r={r * 0.22}
          fill="url(#proof-bridge-glow)"
        />
      )}
    </svg>
  );
}

/** Compact horizontal lockup for header/footer use */
export function BorromeanLockup({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <BorromeanLogo size={size} />
      <div className="flex flex-col leading-tight">
        <span className="text-xs font-bold tracking-tight" style={{ color: "#c8ff00" }}>
          VVU
        </span>
        <span className="text-[9px] text-muted-foreground tracking-wide">
          Venture · Ubuntu · Vision
        </span>
      </div>
    </div>
  );
}
