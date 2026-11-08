"use client";

// src/components/spatial/PyNetChip.tsx — ONE pinned HUD chip pointing the
// Spatial Twin telemetry endpoint at the Python flywheel ledger
// (/tmp/flywheel_icsh/ledger.jsonl, read via /api/vvu/flywheel — 5s poll).
// Operator directive: "Point Spatial Twin telemetry endpoint at ledger.jsonl".
// Styled to match the existing HUD chips; no scene/Three.js code touched.

import { useQuery } from "@tanstack/react-query";
import type { PyFlywheelStatus } from "@/lib/vvu/pyflywheel";

export function PyNetChip() {
  const q = useQuery({
    queryKey: ["pyflywheel"],
    queryFn: async (): Promise<PyFlywheelStatus> => {
      const r = await fetch("/api/vvu/flywheel", { cache: "no-store" });
      if (!r.ok) throw new Error(`flywheel ${r.status}`);
      return (await r.json()) as PyFlywheelStatus;
    },
    refetchInterval: 5000,
    retry: 1,
  });

  const last = q.data?.ledger.last ?? null;
  const netHead = last?.network_head ? last.network_head.slice(0, 8) : "────────";
  const agree = last ? (last.agreement ? "AGREE" : "DIVERGE") : "—";
  const peers = last?.peers_reachable ?? "—";
  const cycle = last?.cycle ?? "—";
  const live = last !== null;
  const agreeColor = !live ? "#7a8a6e" : last.agreement ? "#c8ff00" : "#e5484d";

  return (
    <div
      title={`Python flywheel network head · ledger.jsonl${last ? ` · cycle ${last.cycle} · ${last.agreement ? "agreement" : "DIVERGENCE"} · ${last.peers_reachable} peers reachable` : " · no telemetry yet"}`}
      className="rounded-sm border border-[rgba(107,138,64,0.25)] bg-[rgba(11,15,10,0.78)] backdrop-blur-sm px-2 py-1 max-w-full"
      aria-live="off"
    >
      <span className="vvu-label text-[6.5px] sm:text-[8px] font-mono tracking-[0.08em] whitespace-nowrap">
        <span className="text-[#7a8a6e]">PY-NET </span>
        <span className="text-[#c9d4bd] tabular-nums">{netHead}</span>
        <span className="text-[#7a8a6e]"> · </span>
        <span className="font-bold tabular-nums" style={{ color: agreeColor }}>
          {agree}
        </span>
        <span className="text-[#7a8a6e]"> · </span>
        <span className="text-[#c9d4bd] tabular-nums">{peers}P</span>
        <span className="text-[#7a8a6e]"> · </span>
        <span className="text-[#c9d4bd] tabular-nums">C{cycle}</span>
      </span>
    </div>
  );
}

export default PyNetChip;
