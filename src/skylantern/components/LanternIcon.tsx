"use client";

import { motion } from "framer-motion";
import type { VerificationState } from "../types";
import { verificationColor } from "../lib/format";

interface LanternIconProps {
  state: VerificationState;
  size?: number;
  /** Show the verification label badge beneath the lantern. */
  showLabel?: boolean;
  /** Pulse animation for the head-of-chain lantern. */
  pulse?: boolean;
}

/**
 * The reusable sky-lantern SVG. Used in the map marker, the drawer header,
 * the chain inspector, and the KPI bar.
 */
export function LanternIcon({
  state,
  size = 28,
  showLabel = false,
  pulse = false,
}: LanternIconProps) {
  const color = verificationColor(state);
  return (
    <div className="flex flex-col items-center gap-1">
      <motion.svg
        width={size}
        height={size * 1.4}
        viewBox="0 0 24 34"
        initial={false}
        animate={
          pulse
            ? { y: [0, -2, 0], scale: [1, 1.08, 1] }
            : { y: [0, -1, 0] }
        }
        transition={{
          duration: pulse ? 1.4 : 3.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {/* flame */}
        <ellipse
          cx="12"
          cy="6"
          rx="2.2"
          ry="3.6"
          fill={color}
          opacity="0.85"
        />
        <ellipse
          cx="12"
          cy="5"
          rx="1.1"
          ry="2.1"
          fill="#fff7ed"
          opacity="0.9"
        />
        {/* top ring */}
        <rect x="9" y="9.5" width="6" height="1.2" rx="0.6" fill={color} />
        {/* lantern body */}
        <path
          d="M5 11 H19 V20 Q19 24 12 25 Q5 24 5 20 Z"
          fill={color}
          opacity="0.22"
          stroke={color}
          strokeWidth="1.2"
        />
        {/* vertical strut */}
        <line
          x1="12"
          y1="11"
          x2="12"
          y2="25"
          stroke={color}
          strokeWidth="0.6"
          opacity="0.7"
        />
        {/* base ring */}
        <rect x="8.5" y="25" width="7" height="1.2" rx="0.6" fill={color} />
        {/* tether */}
        <line
          x1="12"
          y1="26.2"
          x2="12"
          y2="32"
          stroke={color}
          strokeWidth="0.6"
          strokeDasharray="1 1.6"
          opacity="0.6"
        />
      </motion.svg>
      {showLabel && (
        <span
          className="text-[9px] font-mono uppercase tracking-wider"
          style={{ color }}
        >
          {state === "CANDIDATE"
            ? "Cand"
            : state === "VERIFIED"
            ? "Ver"
            : state === "TAMPER_DETECTED"
            ? "Tamper"
            : "Arch"}
        </span>
      )}
    </div>
  );
}
