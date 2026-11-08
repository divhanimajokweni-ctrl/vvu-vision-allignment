"use client";

// src/components/watchdog/StormHistory.tsx — R103 · THE STORM HISTORY, the
// record's heartbeat and the band's migration.
//
// The ceiling strip (R100) froze the dead in MB space — diamonds floating
// on the guard menu's scale with no when. This panel gives the same
// witnessed kills their time axis back, two charts on one frame:
//
//   THE DRIFT — ceiling vs kill sequence, the band's migration through the
//   storm: dots in the witness windows' own shape fills, the OLS trend
//   dashed amber when it clears the ±10 MB/kill calibration, the halves'
//   medians as the two numbers the trend line must answer to.
//
//   THE HEARTBEAT — the gap between consecutive witnessed kills as bars:
//   sage inside the record's own spread, the freshest beat highlighted,
//   a double strike (two kills inside 2 min) in rose — disclosed, never
//   averaged away.
//
// The cadence read is the heartbeat's verdict (steady / quickening /
// stretching at the recent-vs-full median ratio); the drift read is the
// band's (rising / settling / flat at ±10 MB/kill). Both are storm-window
// reads — the note says so on its face, because nine kills inside ~3 hours
// cannot testify about the quiet regime the storm interrupted.

import { ceilingDistribution } from "@/lib/witness-windows";
import { stormHistory } from "@/lib/storm-history";
import type { RailProjectionPayload } from "@/lib/operator-projection";

const SHAPE_FILL: Record<string, string> = {
  sawtooth: "#e0a030",
  climbing: "#e5484d",
  falling: "#00d4e0",
  flat: "#7a8a6e",
  single: "#5f6e55",
  unjudged: "#5f6e55",
};

const DRIFT_CHIP: Record<string, { label: string; cls: string }> = {
  rising: { label: "RISING", cls: "border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10" },
  settling: { label: "SETTLING", cls: "border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10" },
  flat: { label: "FLAT", cls: "border-[#3a4530] text-[#7a8a6e] bg-black/30" },
};

const CADENCE_CHIP: Record<string, { label: string; cls: string }> = {
  steady: { label: "CADENCE STEADY", cls: "border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10" },
  quickening: {
    label: "CADENCE QUICKENING",
    cls: "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10",
  },
  stretching: {
    label: "CADENCE STRETCHING",
    cls: "border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10",
  },
};

export function StormHistory({ projection }: { projection: RailProjectionPayload }) {
  // R116 — the beats and the heartbeat read ALL witnessed deaths (the
  // record's whole rhythm); the ceiling strip joins the same feed with the
  // death-aligned window shapes, so the two charts stay on one frame.
  const witnessed = projection.witnessedDeaths ?? projection.witnessed;
  const deathWindows = projection.witnessDeathWindows ?? projection.witnessWindows;
  if (!witnessed || witnessed.length === 0) return null;

  const h = stormHistory(witnessed.map((k) => ({ at: k.at, atMs: k.atMs, maxRssMb: k.maxRssMb })));
  if (h.beats.length < 2) return null; // one beat is the witness rows' job

  // the shape words join by the `at` stamp — the same arithmetic the ceiling
  // strip draws (one join, zero drift between the two panels' fills)
  const guardLevels = projection.scenarios
    .filter((s) => s.kind === "guard")
    .map((s) => s.levelMb)
    .sort((a, b) => a - b);
  const ceilingPop = ceilingDistribution(
    witnessed.map((k) => ({ at: k.at, atMs: k.atMs, maxRssMb: k.maxRssMb })),
    deathWindows,
    guardLevels,
    projection.meta.guardMb,
  );
  const shapeByAt = new Map<string, string>();
  for (const r of ceilingPop.reads) {
    if (r.shapeKind != null) shapeByAt.set(r.at, r.shapeKind);
  }

  // ── chart frame: top = ceilings vs sequence, bottom = interval bars ──
  const W = 520;
  const TOP_H = 58;
  const GAP_H = 14;
  const BOT_H = 34;
  const H = TOP_H + GAP_H + BOT_H;
  const pad = 12;

  const ceilings = h.beats.filter((b) => b.ceilingMb != null);
  const cVals = ceilings.map((b) => b.ceilingMb!);
  const lo = Math.floor((Math.min(...cVals) - 25) / 50) * 50;
  const hi = Math.ceil((Math.max(...cVals) + 25) / 50) * 50;
  const cSpan = hi - lo || 1;
  const xSeq = (seq: number) => pad + ((seq - 1) / Math.max(1, h.beats.length - 1)) * (W - 2 * pad);
  const yC = (v: number) => 6 + (1 - (v - lo) / cSpan) * (TOP_H - 12);

  // the OLS trend line across the judged span (dashed amber when it reads)
  const trend =
    h.driftMbPerKill != null && ceilings.length >= 2
      ? (() => {
          const xs = ceilings.map((b) => b.seq);
          const ys = ceilings.map((b) => b.ceilingMb!);
          const n = xs.length;
          const mx = xs.reduce((a, b) => a + b, 0) / n;
          const my = ys.reduce((a, b) => a + b, 0) / n;
          let sxx = 0;
          let sxy = 0;
          for (let i = 0; i < n; i++) {
            sxx += (xs[i]! - mx) * (xs[i]! - mx);
            sxy += (xs[i]! - mx) * (ys[i]! - my);
          }
          if (sxx === 0) return null;
          const slope = sxy / sxx;
          const intercept = my - slope * mx;
          return {
            x1: xSeq(xs[0]!),
            y1: yC(slope * xs[0]! + intercept),
            x2: xSeq(xs[n - 1]!),
            y2: yC(slope * xs[n - 1]! + intercept),
          };
        })()
      : null;

  // ── heartbeat bars: one bar per gap, x anchored to the gap's END kill ──
  const maxGap = Math.max(...h.intervalsMin, 1);
  const barW = Math.max(3, (W - 2 * pad) / Math.max(1, h.beats.length - 1) - 4);
  const yBot = TOP_H + GAP_H;
  const bars = h.beats
    .filter((b) => b.gapFromPrevMin != null)
    .map((b) => {
      const g = b.gapFromPrevMin!;
      const isLast = b.seq === h.beats.length;
      const dbl = g < 2;
      const color = dbl ? "#e5484d" : isLast ? "#00d4e0" : "#6b8a40";
      const hPix = Math.max(2, (g / maxGap) * (BOT_H - 8));
      return {
        seq: b.seq,
        g,
        dbl,
        isLast,
        color,
        x: xSeq(b.seq) - barW / 2,
        y: yBot + (BOT_H - 6 - hPix),
        h: hPix,
        label: `GAP ${b.seq - 1}→${b.seq} — ${g} min${dbl ? " · DOUBLE STRIKE" : ""}${isLast ? " · the freshest beat" : ""}`,
      };
    });

  const hhmm = (ms: number | null) => (ms != null ? new Date(ms).toISOString().slice(11, 19) : "—");
  const driftChip = h.driftRead != null ? DRIFT_CHIP[h.driftRead] : null;

  return (
    <div
      className="mt-1.5 space-y-1"
      data-testid="storm-history"
      title="R103 — THE STORM HISTORY: the ceiling strip froze the dead in MB space; this panel gives the witnessed kills their time axis. TOP: each kill's in-window peak rss vs its sequence — the band's migration through the storm (OLS dashed amber when it clears ±10 MB/kill; the halves' medians are the two numbers the trend must answer to). BOTTOM: the gap between consecutive witnessed kills as bars — the storm's heartbeat, the freshest beat cyan, a double strike (two kills inside 2 min) rose. The cadence read compares the recent three gaps against the full witnessed median. Both reads live inside the storm window — neither declares a climate."
    >
      <p className="vvu-label text-[7.5px] font-bold tracking-[0.18em] text-[#7a8a6e]">
        THE STORM HISTORY · THE BEATS &amp; THE DRIFT
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full [&_rect]:cursor-help [&_circle]:cursor-help [&_line]:cursor-help [&_path]:cursor-help"
        role="img"
        aria-label={`storm history: ${h.beats.length} witnessed kills over ${h.spanMin ?? "—"} minutes, drift ${h.driftMbPerKill ?? "—"} MB per kill, median gap ${h.medianIntervalMin ?? "—"} minutes`}
      >
        {/* ── top: the drift — ceiling vs sequence ── */}
        <line
          x1={pad}
          y1={TOP_H - 6}
          x2={W - pad}
          y2={TOP_H - 6}
          stroke="#3a4530"
          strokeWidth={0.75}
          opacity={0.6}
        />
        {trend && (
          <line
            x1={trend.x1}
            y1={trend.y1}
            x2={trend.x2}
            y2={trend.y2}
            stroke="#e0a030"
            strokeWidth={1.25}
            opacity={h.driftRead === "flat" ? 0.35 : 0.75}
            strokeDasharray="4 3"
          >
            <title>{`THE DRIFT — ${h.driftMbPerKill != null && h.driftMbPerKill > 0 ? "+" : ""}${h.driftMbPerKill ?? "—"} MB/kill (R² ${h.driftR2 ?? "—"}) · first half centered ${h.firstHalfMedianMb ?? "—"} MB, last half ${h.secondHalfMedianMb ?? "—"} MB`}</title>
          </line>
        )}
        {h.beats.map((b) =>
          b.ceilingMb == null ? null : (
            <g key={`sh-${b.at}`} className="cursor-help">
              <path
                d={`M ${xSeq(b.seq)} ${yC(b.ceilingMb) - 3.4} L ${xSeq(b.seq) + 3.4} ${yC(b.ceilingMb)} L ${xSeq(b.seq)} ${yC(b.ceilingMb) + 3.4} L ${xSeq(b.seq) - 3.4} ${yC(b.ceilingMb)} Z`}
                fill={SHAPE_FILL[shapeByAt.get(b.at) ?? "unjudged"] ?? SHAPE_FILL.unjudged}
                stroke="black"
                strokeWidth={0.5}
              />
              <title>
                {`KILL ${b.seq} · ${hhmm(b.atMs)} UTC — ceiling ${b.ceilingMb} MB${b.gapFromPrevMin != null ? ` · gap ${b.gapFromPrevMin} min` : ""}`}
              </title>
            </g>
          ),
        )}

        {/* the frame divider */}
        <line
          x1={pad}
          y1={TOP_H + GAP_H / 2}
          x2={W - pad}
          y2={TOP_H + GAP_H / 2}
          stroke="#3a4530"
          strokeWidth={0.5}
          opacity={0.5}
          strokeDasharray="2 3"
        />

        {/* ── bottom: the heartbeat — gap bars ── */}
        {bars.map((b) => (
          <g key={`shb-${b.seq}`} className="cursor-help">
            <rect
              x={b.x}
              y={b.y}
              width={barW}
              height={b.h}
              fill={b.color}
              opacity={b.isLast ? 0.85 : 0.55}
              rx={0.5}
            />
            <title>{b.label}</title>
          </g>
        ))}
      </svg>

      {/* the legend — HTML chips, 390px-safe */}
      <div className="flex flex-wrap items-center gap-1">
        <span
          className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#3a4530] text-[#7a8a6e] bg-black/30 tabular-nums cursor-help transition-[filter,border-color] hover:brightness-125"
          title={`${h.beats.length} witnessed kills across ${h.spanMin ?? "—"} min of storm time (witness era, R94 onward)`}
        >
          {h.beats.length} BEATS · {h.spanMin ?? "—"} MIN
        </span>
        {driftChip && h.driftMbPerKill != null && (
          <span
            className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${driftChip.cls} tabular-nums`}
            title={`OLS of ceiling vs kill sequence: ${h.driftMbPerKill > 0 ? "+" : ""}${h.driftMbPerKill} MB/kill (R² ${h.driftR2}) — first half centered ${h.firstHalfMedianMb ?? "—"} MB, last half ${h.secondHalfMedianMb ?? "—"} MB. ±10 MB/kill is the first calibration; re-read as the record grows.`}
          >
            DRIFT {h.driftMbPerKill > 0 ? "+" : ""}
            {h.driftMbPerKill} MB/KILL · {driftChip.label}
          </span>
        )}
        {h.cadenceRead != null && (
          <span
            className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${CADENCE_CHIP[h.cadenceRead].cls} tabular-nums`}
            title={`recent three gaps median ${h.recentMedianIntervalMin} min against a ${h.medianIntervalMin}-min full witnessed median — the ratio calibrations (×1.25 / ×0.8) are first calibrations, re-read as the record grows`}
          >
            {CADENCE_CHIP[h.cadenceRead].label} · {h.medianIntervalMin}M MED
          </span>
        )}
        {h.doubleStrike && (
          <span
            className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#e5484d]/50 text-[#e5484d] bg-[#e5484d]/5 cursor-help transition-[filter,border-color] hover:brightness-125"
            title={`two witnessed kills inside 2 minutes — the kernel's double strike, disclosed rather than averaged away. On record: ${h.doubleStrikeBeats.map((d) => `kills ${d.from}→${d.to} (${d.gapMin} min)`).join(", ")}.`}
          >
            {h.doubleStrikeCount} DOUBLE STRIKE{h.doubleStrikeCount === 1 ? "" : "S"}
          </span>
        )}
      </div>

      {/* THE READ — the engine's own sentence */}
      <p className="text-[9px] leading-relaxed text-[#c9d4bd] rounded-sm border border-[#3a4530]/60 bg-black/20 px-2 py-1">
        {h.note}
      </p>
    </div>
  );
}
