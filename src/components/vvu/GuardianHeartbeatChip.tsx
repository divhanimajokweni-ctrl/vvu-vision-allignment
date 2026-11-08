"use client";

// src/components/vvu/GuardianHeartbeatChip.tsx — the guardian save
// heartbeat chip. Renders a compact status line showing how long since
// the last guardian save, tinted by the RSS-vs-guard zone.
// NULL-SAFE: data can be null on first render. Single guard point:
//   const d = data ?? { present: false };

import { useEffect, useState } from "react";
import { HeartPulse } from "lucide-react";
import { toast } from "sonner";
import { useHashRoute } from "@/hooks/use-hash-route";
import {
  GUARDIAN_ZONE_COLOR,
  guardianAgoCompact,
  guardianAgoLabel,
  guardianZone,
  type GuardianHeartbeatData,
  type GuardianZone,
} from "@/hooks/use-guardian-heartbeat";

const ZONE_BORDER: Record<string, string> = {
  lime: "rgba(107, 138, 64, 0.45)",
  amber: "rgba(224, 160, 48, 0.55)",
  rose: "rgba(229, 72, 77, 0.6)",
  dim: "rgba(107, 138, 64, 0.25)",
};

export function GuardianHeartbeatChip({
  data,
  isError,
}: {
  data: GuardianHeartbeatData | undefined | null;
  isError: boolean;
}) {
  const [, setView] = useHashRoute();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  // SINGLE GUARD POINT — all downstream code uses d., never data.
  const d = data ?? { present: false };

  if (isError) {
    return (
      <span
        className="vvu-label inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border border-[rgba(229,72,77,0.5)] text-[#e5484d] text-[8px] cursor-default select-none"
        title="GUARDIAN ERROR — the /api/guardian endpoint returned an error. Check the server logs."
      >
        <HeartPulse className="w-3 h-3 animate-pulse" aria-hidden="true" />
        <span className="hidden md:inline">GUARDIAN ERR</span>
        <span className="md:hidden">⚠</span>
      </span>
    );
  }

  if (!d.present) {
    return (
      <span
        className="vvu-label inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border border-[rgba(107,138,64,0.25)] text-[#7a8a6e] text-[8px] cursor-default select-none"
        title={`GUARDIAN OFF — no status file. The header will not pretend. Arm it with:\n${"python3 .zscripts/daemonize.py -- python3 .zscripts/guardian.py"}`}
      >
        <HeartPulse className="w-3 h-3" aria-hidden="true" />
        <span className="hidden md:inline">GUARDIAN OFF</span>
        <span className="md:hidden">⏻ OFF</span>
      </span>
    );
  }

  // d is guaranteed non-null + present from here on
  const g = d.guardian;
  const rssMb = g?.rssKb != null ? Math.round(g.rssKb / 1024) : null;
  const zone: GuardianZone = d.stale || d.guardianAlive === false ? "rose" : guardianZone(rssMb, g?.guardMb ?? null);
  const color = GUARDIAN_ZONE_COLOR[zone];
  const ago = guardianAgoLabel(g?.lastBounceAtUtc ?? null, now);
  const agoCompact = guardianAgoCompact(g?.lastBounceAtUtc ?? null, now);
  const stale = d.stale === true || d.guardianAlive === false;
  const plateau = d.plateau;
  const drift = plateau?.driftMb ?? null;

  return (
    <button
      type="button"
      onClick={() => setView("watchdog")}
      className="vvu-label inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border text-[8px] cursor-pointer select-none transition-colors hover:brightness-110"
      style={{
        borderColor: ZONE_BORDER[zone] ?? ZONE_BORDER.dim,
        color: stale ? "#e5484d" : color,
      }}
      title={`GUARDIAN · ${ago}\nRSS: ${rssMb != null ? rssMb + " MB" : "—"} / Guard: ${g?.guardMb != null ? g.guardMb + " MB" : "—"}\nZone: ${zone}${drift != null ? "\nDrift: " + drift + " MB" : ""}`}
    >
      <HeartPulse
        className={"w-3 h-3 " + (stale ? "animate-pulse" : "")}
        aria-hidden="true"
      />
      <span className="hidden md:inline">{stale ? "STALE" : "SAVE"} {ago.toUpperCase()}</span>
      <span className="md:hidden">{stale ? "⚠ " : ""}{agoCompact}</span>
    </button>
  );
}
