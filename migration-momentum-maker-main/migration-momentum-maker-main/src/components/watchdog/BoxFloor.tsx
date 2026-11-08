"use client";

// src/components/watchdog/BoxFloor.tsx — R105 · THE BOX FLOOR, the storm's
// other axis.
//
// The ceiling strip (R100) reads where the BOOT died — peak rss on the guard
// menu's scale. This panel is its twin on the BOX's own axis: each witnessed
// kill's deepest MemAvailable (the box's standing when the kernel struck) on
// the floor menu's scale. Since the 02:00Z double strike the record holds a
// death only THIS axis can explain — boot 8835 died at 1816 MB, below the
// ceiling band, because the BOX ran out — so the two strips belong side by
// side: the boot's geography and the box's, one storm, two geographies.
//
// Grammar (the ceiling strip's, mirrored): shaded dip cluster, the median
// centerline, floor lines toned by how they read (lime = crossed by EVERY
// judged kill, amber = SOME, dim rose = never crossed in-window), diamonds
// in three lanes, the OLS drift dashed amber when it clears ±10 MB/kill.
// The loop verdicts stay the scenarios grid's — a kill-time dip is where
// the box stood, not what would loop.

import { boxFloorRead } from "@/lib/box-floor";
import type { RailProjectionPayload } from "@/lib/operator-projection";

const FLOOR_CHIP_CLS: Record<string, string> = {
  "below-all": "border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10",
  some: "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10",
  never: "border-[#e5484d]/40 text-[#e5484d]/80 bg-black/30",
};

const DRIFT_CHIP: Record<string, { label: string; cls: string }> = {
  rising: { label: "RISING", cls: "border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10" },
  settling: { label: "SETTLING", cls: "border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10" },
  flat: { label: "FLAT", cls: "border-[#3a4530] text-[#7a8a6e] bg-black/30" },
};

export function BoxFloor({ projection }: { projection: RailProjectionPayload }) {
  const { witnessed, scenarios } = projection;
  if (!witnessed || witnessed.length === 0) return null;

  const floorLevels = scenarios
    .filter((s) => s.kind === "floor")
    .map((s) => s.levelMb)
    .sort((a, b) => a - b);
  const r = boxFloorRead(
    witnessed.map((k) => ({ at: k.at, atMs: k.atMs, minAvailMb: k.minAvailMb })),
    floorLevels,
  );
  if (r.judged === 0) return null; // no kill saw the box — the read waits, honestly empty

  // ── chart frame: the dips on the floor menu's own MB scale. The frame
  // spans the menu + the in-frame dips; a dip beyond it (kill 2's 2719.3 —
  // a 2-sample window that caught the box DURING BOOT RECOVERY, not a
  // death dip) gets an edge marker and its true value in the tooltip —
  // disclosed, never scaled away, never allowed to squeeze the geography
  // the floor menu lives on. ──
  const W = 520;
  const H = 64;
  const pad = 12;
  const frameHi = Math.ceil((Math.max(...floorLevels) + 40) / 50) * 50;
  const lo = Math.floor((Math.min(r.deepestMb ?? 0, ...floorLevels) - 40) / 50) * 50;
  const hi = Math.max(frameHi, Math.ceil((Math.min(r.shallowestMb ?? 0, frameHi) + 40) / 50) * 50);
  const span = hi - lo || 1;
  const x = (v: number) => pad + ((v - lo) / span) * (W - 2 * pad);

  const inFrameShallow = Math.min(r.shallowestMb ?? hi, hi);
  const bandLo = x(r.deepestMb ?? lo);
  const bandHi = x(inFrameShallow);
  const medX = r.medianMinAvailMb != null ? x(r.medianMinAvailMb) : null;
  const laneY = (i: number) => 22 + (i % 3) * 9;
  const hhmm = (ms: number | null) => (ms != null ? new Date(ms).toISOString().slice(11, 19) : "—");

  // the halves' medians — the drift's honest drawable in MB space (both are
  // values on this axis; the OLS lives in seq space and stays in the chips)
  const halvesLine =
    r.firstHalfMedianMb != null && r.secondHalfMedianMb != null
      ? { v0: r.firstHalfMedianMb, v1: r.secondHalfMedianMb }
      : null;

  const dblBySeq = new Set(r.doubleStrikeBeats.map((d) => d.to));

  return (
    <div
      className="mt-1.5 space-y-1"
      data-testid="box-floor"
      title="R105 — THE BOX FLOOR: the ceiling strip's twin on the box's own axis. Each witnessed kill's deepest MemAvailable inside its witness window (the box's standing when the kernel struck) on the floor menu's MB scale. The shaded band is the dip cluster; the amber centerline is the median; floor lines are toned by how they read: lime = crossed by EVERY judged kill, amber = SOME, dim rose = never crossed in-window (the grid's BLIND). The OLS drift (dashed amber when it clears ±10 MB/kill) asks whether the box is dying shallower or deeper kill after kill. A kill-time dip is WHERE THE BOX STOOD — the loop verdicts stay the scenarios grid's. Since the 02:00Z double strike this axis is the only one that explains boot 8835's death (1816 MB, below the ceiling band — the box ran out)."
    >
      <p className="vvu-label text-[7.5px] font-bold tracking-[0.18em] text-[#7a8a6e]">
        THE BOX FLOOR · WHERE THE BOX STOOD WHEN IT DIED
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full [&_rect]:cursor-help [&_circle]:cursor-help [&_line]:cursor-help [&_path]:cursor-help"
        role="img"
        aria-label={`box floor: ${r.judged} witnessed dips span ${r.deepestMb} to ${r.shallowestMb} MB, median ${r.medianMinAvailMb} MB`}
      >
        {/* the dip cluster band */}
        <rect
          x={bandLo}
          y={12}
          width={Math.max(1, bandHi - bandLo)}
          height={40}
          fill="#00d4e0"
          opacity={0.07}
        />
        {/* floor level lines */}
        {r.levels.map((l) => (
          <g key={`bf-${l.levelMb}`}>
            <line
              x1={x(l.levelMb)}
              y1={8}
              x2={x(l.levelMb)}
              y2={56}
              stroke={
                l.verdict === "below-all" ? "#7ae04a" : l.verdict === "some" ? "#e0a030" : "#e5484d"
              }
              strokeWidth={1}
              opacity={l.verdict === "never" ? 0.3 : 0.55}
              strokeDasharray="3 3"
            />
            <title>{`FLOOR ${l.levelMb} · ${l.verdict === "below-all" ? `crossed on ALL ${l.judged} judged kills` : l.verdict === "some" ? `crossed on ${l.crossed}/${l.judged} judged kills` : `never crossed in-window (${l.crossed}/${l.judged}) — the grid's BLIND`}`}</title>
          </g>
        ))}
        {/* the median centerline */}
        {medX != null && (
          <line
            x1={medX}
            y1={12}
            x2={medX}
            y2={52}
            stroke="#00d4e0"
            strokeWidth={1}
            opacity={0.5}
          />
        )}
        {/* the halves' medians — where the storm's first half died vs its last */}
        {halvesLine && (
          <line
            x1={x(halvesLine.v0)}
            y1={10}
            x2={x(halvesLine.v1)}
            y2={54}
            stroke="#e0a030"
            strokeWidth={1.25}
            opacity={0.75}
            strokeDasharray="4 3"
          >
            <title>{`THE HALVES — the storm's first half died at a ${r.firstHalfMedianMb ?? "—"} MB median dip, its last half ${r.secondHalfMedianMb ?? "—"} MB (${r.secondHalfMedianMb != null && r.firstHalfMedianMb != null ? (r.secondHalfMedianMb - r.firstHalfMedianMb >= 0 ? "+" : "") + Math.round((r.secondHalfMedianMb - r.firstHalfMedianMb) * 10) / 10 : "—"} MB). The OLS floor drift (${r.floorDriftMbPerKill != null && r.floorDriftMbPerKill > 0 ? "+" : ""}${r.floorDriftMbPerKill ?? "—"} MB/kill, R² ${r.floorDriftR2 ?? "—"}) lives in sequence space — its read is in the chips.`}</title>
          </line>
        )}
        {/* the kill diamonds — three lanes so same-height dips separate */}
        {r.kills.map((k, i) => {
          if (k.minAvailMb == null) return null; // honest absence — no dip, no marker
          const dbl = dblBySeq.has(k.seq);
          const beyond = k.minAvailMb > hi;
          const cx = beyond ? x(hi) - 2 : x(k.minAvailMb);
          const cy = laneY(i);
          return (
            <g key={`bf-${k.at}`} className="cursor-help">
              <path
                d={`M ${cx} ${cy - 3.4} L ${cx + 3.4} ${cy} L ${cx} ${cy + 3.4} L ${cx - 3.4} ${cy} Z`}
                fill={beyond ? "transparent" : dbl ? "#e5484d" : "#5fb8c4"}
                stroke={beyond ? "#5fb8c4" : "black"}
                strokeWidth={beyond ? 1 : 0.5}
              />
              <title>
                {`KILL ${hhmm(k.atMs)} UTC — box dipped to ${k.minAvailMb} MB${beyond ? " · BEYOND THE FRAME — this window saw the box fat (a young boot's recovery, not a death dip)" : ""} · crossed ${k.crossedFloorsMb.join("/") || "none"} ·${dbl ? " DOUBLE STRIKE (the previous kill landed <2 min before)" : ""}`}
              </title>
            </g>
          );
        })}
      </svg>

      {/* the frame anchors — the two numbers the eye needs to read the band */}
      <div className="flex items-center justify-between -mt-0.5">
        <span
          className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#00d4e0]/40 text-[#00d4e0]/90 bg-black/30 tabular-nums cursor-help transition-[filter,border-color] hover:brightness-125"
          title={`the deepest box dip on record: ${r.deepestMb} MB — the left edge of the stress band. Below every floor at/above this line, the box was giving out.`}
        >
          DEEPEST {r.deepestMb ?? "—"} MB
        </span>
        <span
          className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#3a4530] text-[#7a8a6e] bg-black/30 tabular-nums cursor-help transition-[filter,border-color] hover:brightness-125"
          title={`the shallowest death-time dip: ${r.shallowestMb} MB — the right edge of the stress band (kill 2's 2-sample recovery window saw the box fat; disclosed in its diamond's tooltip, edge-marked beyond the frame when it overshoots the menu's scale).`}
        >
          SHALLOWEST {r.shallowestMb ?? "—"} MB
        </span>
      </div>

      {/* the legend — HTML chips, 390px-safe */}
      <div className="flex flex-wrap items-center gap-1">
        {r.levels.map((l) => (
          <span
            key={`bf-leg-${l.levelMb}`}
            className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${FLOOR_CHIP_CLS[l.verdict]} tabular-nums`}
            title={`floor ${l.levelMb} MB vs the dip cluster: ${l.verdict === "below-all" ? `at/above every dip — the box crossed under it on ALL ${l.judged} judged kills` : l.verdict === "some" ? "inside the stress — crossed on SOME kills only" : "above every dip — never crossed in-window (the grid reads it BLIND)"}`}
          >
            {l.levelMb}
            {l.verdict === "below-all" ? " ↑ALL" : l.verdict === "some" ? " ±SOME" : " ↑NEVER"}
          </span>
        ))}
        {r.floorDriftRead != null && r.floorDriftMbPerKill != null && (
          <span
            className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${DRIFT_CHIP[r.floorDriftRead].cls} tabular-nums`}
            title={`OLS of the death-time box dip vs kill sequence: ${r.floorDriftMbPerKill > 0 ? "+" : ""}${r.floorDriftMbPerKill} MB/kill (R² ${r.floorDriftR2}) over ${r.judged} judged dips — ±10 MB/kill is the first calibration, the same sensitivity the ceiling drift uses`}
          >
            FLOOR DRIFT {r.floorDriftMbPerKill > 0 ? "+" : ""}
            {r.floorDriftMbPerKill} MB/KILL · {DRIFT_CHIP[r.floorDriftRead].label}
          </span>
        )}
        {r.doubleStrike && (
          <span
            className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#e5484d]/50 text-[#e5484d] bg-[#e5484d]/5"
            title={`the double strikes, disclosed rather than averaged away: ${r.doubleStrikeBeats.map((d) => `kills ${d.from}→${d.to} (${d.gapMin} min)`).join(", ")}`}
          >
            {r.doubleStrikeBeats.length} DOUBLE STRIKE{r.doubleStrikeBeats.length === 1 ? "" : "S"}
          </span>
        )}
      </div>

      {/* THE READ — the engine's own sentence */}
      <p className="text-[9px] leading-relaxed text-[#c9d4bd] rounded-sm border border-[#3a4530]/60 bg-black/20 px-2 py-1">
        {r.note}
      </p>
    </div>
  );
}
