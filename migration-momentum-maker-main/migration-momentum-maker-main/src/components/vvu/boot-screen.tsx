"use client";

import { useState, useEffect } from "react";
import { BorromeanLogo } from "./borromean-logo";

const BOOT_STAGES = [
  "Mounting NVMe WORM store (/dev/nvme0n1)",
  "Loading ATECC608B secure-element keyslots",
  "Verifying HBK Mk-II firmware SHA-256 (15-file manifest)",
  "Initialising 8S4P LiFePO4 power management (614 Wh)",
  "Calibrating DN300 SANS 1123 PN16 flange torque (154.7 Nm)",
  "Starting 7-state VVU FSM (DISCONNECTED → STEADY_STATE_LOCKED)",
  "Sealing sovereign-DB WORM ledger (Design Freeze Level 1)",
  "Establishing Borromean trust topology",
];

export function BootScreen({ onDone }: { onDone?: () => void }) {
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => {
        const np = p + 4;
        const ns = Math.min(BOOT_STAGES.length - 1, Math.floor(np / (100 / BOOT_STAGES.length)));
        setStage(ns);
        if (np >= 100) {
          clearInterval(t);
          setDone(true);
          setTimeout(() => onDone?.(), 600);
          return 100;
        }
        return np;
      });
    }, 60);
    return () => clearInterval(t);
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center vvu-surface-deeper transition-opacity duration-500 ${
        done ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="mb-8 animate-pulse">
        <BorromeanLogo size={140} />
      </div>

      <h1 className="mb-1 text-2xl font-bold tracking-tight text-lime-400">
        VVU · Validation Dashboard
      </h1>
      <p className="mb-8 text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Venture Vision Ubuntu · Hash is Proof
      </p>

      <div className="w-80 max-w-[80vw]">
        <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-lime-500 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
          <span className="truncate pr-2">{BOOT_STAGES[stage]}</span>
          <span className="shrink-0">{progress}%</span>
        </div>
      </div>

      <p className="mt-12 text-[10px] text-muted-foreground/60">
        CIPC 2026/259053/07 · B-BBEE Level 1 · 135%
      </p>
    </div>
  );
}
