"use client";

// src/components/vvu/GuardianHeartbeatChip.tsx — R71 · the guardian's
// heartbeat as fixed-header chrome. R70 handoff priority #2: "a 'last
// guardian save' fact on the dashboard header so a fresh pid is never a
// surprise."
//
// WHAT THE CHIP SAYS (all of it honest, none of it cosmetic):
//   · PID      — the next-server pid the guardian currently watches. THE
//                fact R70 asked for: a pid the operator doesn't recognize
//                is the guardian's save, not a mystery.
//   · SAVE ago — time since lastBounceAtUtc. A fresh journal (no real
//                saves yet) reads NO SAVES YET — clean, not an error.
//   · gauge    — a 44px RSS-vs-guard micro-gauge (fill = rss/(guard×1.15),
//                tick at the guard line, ghost tick at the HWM) so the
//                distance to the bounce line is visible without leaving
//                the current surface.
//
// THE TOAST (the "never a surprise" part): when the polled pid CHANGES
// while this header is alive, the estate announces the save — old → new
// pid, the journal's downtime for that save, the running total. Stable
// toast id 'guardian-save' (Round 11 replace-don't-stack convention).
//
// HONESTY RULES (inherited from /api/guardian's own contract):
//   present:false  → GUARDIAN OFF (dim), arm command in the tooltip.
//   stale / dead   → STALE (rose) — a dead guardian must be visible.
//   zone amber/rose→ the chip and the header's signature edge tint with
//                    the gauge (the header edge tells the truth too).
//
// Click-through: the chip is a real button — it navigates to #/watchdog,
// where the full gauge, journal and drill console live.

import { useEffect, useRef, useState } from "react";
import { HeartPulse } from "lucide-react";
import { toast } from "sonner";
import { useHashRoute } from "@/hooks/use-hash-route";
import {
  GUARDIAN_ZONE_COLOR,
  guardianAgoCompact,
  guardianAgoLabel,
  guardianZone,
  type GuardianHeartbeatData,
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
  data: GuardianHeartbeatData | undefined;
  isError: boolean;
}) {
  const [, setView] = useHashRoute();
  const [now, setNow] = useState<number>(() => Date.now());

  // The ago label must breathe between polls — a 15s tick keeps "SAVE 32M
  // AGO" truthful without touching the network.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  // ── the pid-watch: one ref, one honest announcement per save ──
  const seenPidRef = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    const pid = data?.guardian?.nextServerPid ?? null;
    const prev = seenPidRef.current;
    if (prev !== undefined && prev !== null && pid !== null && pid !== prev) {
      const save = data?.bounces?.find((r) => r.drill !== true);
      const downtime = typeof save?.downtimeMs === "number" ? save.downtimeMs : null;
      toast.success("GUARDIAN SAVE LANDED", {
        id: "guardian-save",
        description:
          `pid ${prev} → ${pid}` +
          (downtime != null ? ` · downtime ${(downtime / 1000).toFixed(1)}s` : "") +
          ` · ${data?.guardian?.bounces ?? "?"} controlled saves this arm` +
          " · the fresh pid is the guardian's work, not a crash",
      });
    }
    seenPidRef.current = pid;
  }, [data]);

  // ── the honest states ──
  if (isError) {
    return (
      <span
        className="vvu-label inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border border-[rgba(229,72,77,0.5)] text-[#e5484d] text-[8px] cursor-default select-none"
        title="GUARDIAN REPORT UNREACHABLE — /api/guardian failed. The heartbeat is honest: it will not fake green."
      >
        <HeartPulse className="w-3 h-3" aria-hidden="true" />
        <span className="hidden md:inline">REPORT UNREACHABLE</span>
        <span className="md:hidden">⏻</span>
      </span>
    );
  }

  if (data === undefined) {
    // First-paint skeleton — deterministic markup (SSR-safe), dims in.
    return (
      <span
        aria-hidden="true"
        className="vvu-label inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border border-[rgba(107,138,64,0.2)] text-[#4a5744] text-[8px] cursor-default select-none animate-pulse"
      >
        <HeartPulse className="w-3 h-3" aria-hidden="true" />
        <span className="hidden md:inline">····</span>
        <span className="md:hidden">··</span>
      </span>
    );
  }

  if (!data.present) {
    return (
      <span
        className="vvu-label inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border border-[rgba(107,138,64,0.25)] text-[#7a8a6e] text-[8px] cursor-default select-none"
        title={`GUARDIAN OFF — no status file. The header will not pretend. Arm it with:\n${data.armCommand ?? "python3 .zscripts/daemonize.py -- python3 .zscripts/guardian.py"}`}
      >
        <HeartPulse className="w-3 h-3" aria-hidden="true" />
        <span className="hidden md:inline">GUARDIAN OFF</span>
        <span className="md:hidden">⏻ OFF</span>
      </span>
    );
  }

  const g = data.guardian;
  if (!g) {
    return (
      <span
        className="vvu-label inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border border-[rgba(107,138,64,0.25)] text-[#7a8a6e] text-[8px] cursor-default select-none"
        title="GUARDIAN REPORT INCOMPLETE — present but no status body."
      >
        <HeartPulse className="w-3 h-3" aria-hidden="true" />
        <span className="hidden md:inline">NO REPORT</span>
        <span className="md:hidden">⏻ ?</span>
      </span>
    );
  }

  const rssMb = g.rssKb != null ? Math.round(g.rssKb / 1024) : null;
  const hwmMb = g.hwmKb != null ? Math.round(g.hwmKb / 1024) : null;
  const zone =
    data.stale || data.guardianAlive === false ? "rose" : guardianZone(rssMb, g.guardMb ?? null);
  const color = GUARDIAN_ZONE_COLOR[zone];
  const ago = guardianAgoLabel(g.lastBounceAtUtc, now);
  const agoCompact = guardianAgoCompact(g.lastBounceAtUtc, now);
  const stale = data.stale === true || data.guardianAlive === false;

  // Gauge geometry — same contract as the watchdog's ServerFootprint gauge:
  // track spans 0 → guard × 1.15 so the guard tick sits INSIDE the track.
  const maxMb = (g.guardMb ?? 0) * 1.15;
  const fillPct =
    rssMb != null && maxMb > 0 ? Math.min(100, Math.max(2, (rssMb / maxMb) * 100)) : 0;
  const tickPct = maxMb > 0 && g.guardMb ? Math.min(100, (g.guardMb / maxMb) * 100) : 100;
  const hwmPct = hwmMb != null && maxMb > 0 ? Math.min(100, (hwmMb / maxMb) * 100) : null;

  const plateau = data.plateau;
  // R71 #4 (closed R72) — the plateau TREND is no longer desktop-tooltip
  // only: touch devices cannot hover a title, so the compact chip shows
  // the direction glyph + magnitude when the drift is past the same +16
  // threshold the watchdog's PLATEAU TREND value uses. A quiet plateau
  // stays quiet on mobile too — no theater.
  const drift = plateau?.driftMb ?? null;
  const driftVisible = !stale && drift != null && Math.abs(drift) > 16;
  const tooltip = [
    `GUARDIAN ${g.mode}${stale ? " · STALE (passes stopped — visible, not silent)" : ""}`,
    `watching pid ${g.nextServerPid ?? "—"} · rss ${rssMb ?? "?"}MB / guard ${g.guardMb ?? "?"}MB`,
    `hwm ${hwmMb ?? "?"}MB${plateau?.baselineMb != null ? ` · plateau ${plateau.baselineMb}MB${plateau.driftMb != null ? ` (trend ${plateau.driftMb > 0 ? "+" : ""}${plateau.driftMb}MB)` : ""}` : ""}`,
    `last save ${g.lastBounceAtUtc ? `${g.lastBounceAtUtc} (${ago ?? "—"})` : "— none this arm"}`,
    `${g.bounces} controlled saves · last pass ${g.lastPassAtUtc}`,
    "click to open the watchdog surface",
  ].join("\n");

  return (
    <button
      type="button"
      onClick={() => setView("watchdog")}
      aria-label={`Guardian heartbeat: ${g.mode}, watching pid ${g.nextServerPid ?? "unknown"}, last save ${ago ?? "none this arm"}${drift != null ? `, plateau trend ${drift > 0 ? "+" : ""}${drift} MB` : ""}. Open watchdog.`}
      title={tooltip}
      className="vvu-label group inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border text-[8px] transition-colors select-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(200,255,0,0.6)] active:scale-[0.97]"
      style={{ borderColor: ZONE_BORDER[zone], color, background: `${color}0d` }}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${stale ? "vvu-blink" : "vvu-pulse"}`}
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <HeartPulse
        className="w-3 h-3 opacity-70 group-hover:opacity-100 transition-opacity"
        aria-hidden="true"
      />

      {/* desktop: the full fact */}
      <span className="hidden md:inline whitespace-nowrap">PID {g.nextServerPid ?? "—"}</span>

      {/* the micro-gauge — RSS vs guard, tick at the cliff edge */}
      <span
        className="hidden md:inline-block relative w-11 h-[3px] rounded-full overflow-visible bg-[rgba(107,138,64,0.25)]"
        aria-hidden="true"
      >
        <span
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${fillPct}%`, backgroundColor: color, opacity: 0.85 }}
        />
        {hwmPct != null && (
          <span
            className="absolute top-[-2px] h-[7px] w-px bg-[rgba(201,212,189,0.4)]"
            style={{ left: `${hwmPct}%` }}
          />
        )}
        <span
          className="absolute top-[-2px] h-[7px] w-px bg-[rgba(229,72,77,0.75)]"
          style={{ left: `${tickPct}%` }}
        />
      </span>

      <span className="hidden md:inline whitespace-nowrap tabular-nums">
        {ago ? `SAVE ${ago}` : "NO SAVES"}
      </span>

      {/* mobile: the compact fact — minutes since the save, plus the plateau
          direction when the drift is past the threshold (touch devices can't
          hover the tooltip; the trend rides the chip itself). */}
      <span className="md:hidden whitespace-nowrap tabular-nums">
        {stale ? "STALE" : (agoCompact ?? "NOSAVE")}
        {driftVisible && (
          <span className={`ml-0.5 font-bold ${drift > 0 ? "text-[#e0a030]" : "opacity-60"}`}>
            {drift > 0 ? "↗" : "↘"}
            {Math.abs(drift)}
          </span>
        )}
      </span>
    </button>
  );
}
