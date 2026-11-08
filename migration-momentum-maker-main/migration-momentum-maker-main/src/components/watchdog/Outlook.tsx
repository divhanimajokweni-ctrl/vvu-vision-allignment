"use client";

/**
 * THE OUTLOOK — the forward read (R107). Mounted right after THE THREE
 * DRIFTS: the evidence stack ends in its forecast. Two dials, one per
 * question the operator asks the NEXT hour:
 *
 *  · THE RUNWAY — the living memSeries' own climb, projected to the guard
 *    line. The strip is a runway: left edge = now, ticks every 30 min out
 *    to the 120-min horizon, the bar's end marks where the fit crosses
 *    the guard. A 'tight' fit wears a solid fill; a 'loose' fit keeps the
 *    bar but goes dashed-and-dim — the eta is shown, its confidence is
 *    drawn, never averaged away. A stalled climb renders a hollow strip
 *    with the stall named (no eta is honest when the climb has stopped).
 *
 *  · THE LULL — minutes since the last witnessed kill against the storm
 *    history's own heartbeat median. The bar is the live gap; the tick is
 *    the heartbeat; the shaded zone beyond 1.25× (the SAME calibration
 *    that calls the record's cadence stretching) is where a quiet window
 *    lives. The ceiling re-read's waiting room, drawn.
 *
 * Everything tooltip'd with its arithmetic; the read paragraph is the
 * engine's own note verbatim. Zero polls — the guardian fetch the page
 * already makes feeds both dials.
 */

import { useMemo } from "react";
import {
  outlookRead,
  MIN_RUNWAY_SAMPLES,
  RUNWAY_MIN_RATE_MB_PER_MIN,
  RUNWAY_HORIZON_MIN,
  type OutlookSample,
} from "@/lib/outlook";
import { stormHistory } from "@/lib/storm-history";
import { parseGuardianStamp } from "@/lib/operator-projection";
import type { RailProjectionPayload } from "@/lib/operator-projection";

const ETA_TONE: Record<string, { hex: string; cls: string; label: string }> = {
  short: {
    hex: "#e5484d",
    cls: "border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10",
    label: "RUNWAY SHORT",
  },
  building: {
    hex: "#e0a030",
    cls: "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10",
    label: "RUNWAY BUILDING",
  },
  open: {
    hex: "#00d4e0",
    cls: "border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10",
    label: "RUNWAY OPEN",
  },
};
const ETA_STALLED = {
  hex: "#7a8a6e",
  cls: "border-[#3a4530] text-[#7a8a6e] bg-black/30",
  label: "CLIMB STALLED",
};
const ETA_YOUNG = {
  hex: "#7a8a6e",
  cls: "border-[#3a4530] text-[#7a8a6e] bg-black/30",
  label: "WINDOW YOUNG",
};

const LULL_TONE: Record<string, { hex: string; cls: string; label: string }> = {
  "in-cadence": {
    hex: "#8fbf6a",
    cls: "border-[#5a7a3a]/70 text-[#8fbf6a] bg-[#5a7a3a]/10",
    label: "IN CADENCE",
  },
  stretching: {
    hex: "#e0a030",
    cls: "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10",
    label: "THE LULL — STRETCHING",
  },
  "no-storm": {
    hex: "#7a8a6e",
    cls: "border-[#3a4530] text-[#7a8a6e] bg-black/30",
    label: "NO STORM ON RECORD",
  },
  unjudged: {
    hex: "#7a8a6e",
    cls: "border-[#3a4530] text-[#7a8a6e] bg-black/30",
    label: "LULL UNJUDGED",
  },
};

/** The runway strip. W=520 H=64: a baseline rail, 30-min ticks, the climb
 *  bar to the eta position, the guard flag at the far end of the bar. */
function RunwayDial({
  etaMin,
  fit,
  beyond,
  rate,
}: {
  etaMin: number | null;
  fit: "tight" | "loose" | null;
  beyond: boolean;
  rate: number | null;
}) {
  const W = 520;
  const H = 64;
  const PAD_L = 8;
  const PAD_R = 8;
  const innerW = W - PAD_L - PAD_R;
  const railY = 40;
  const stalled = rate != null && rate <= RUNWAY_MIN_RATE_MB_PER_MIN && etaMin == null;
  const young = rate == null;
  const tone = young
    ? ETA_YOUNG
    : stalled
      ? ETA_STALLED
      : etaMin != null
        ? ETA_TONE[etaWordOf(etaMin)]!
        : ETA_YOUNG;
  const etaX =
    etaMin == null
      ? null
      : Math.min(
          PAD_L + (Math.min(etaMin, RUNWAY_HORIZON_MIN) / RUNWAY_HORIZON_MIN) * innerW,
          W - PAD_R,
        );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full [&_rect]:cursor-help [&_circle]:cursor-help [&_line]:cursor-help [&_path]:cursor-help"
      role="img"
      aria-label="the runway dial"
    >
      {/* the horizon ticks — every 30 min out to 120 */}
      {[0, 30, 60, 90, 120].map((m) => {
        const x = PAD_L + (m / RUNWAY_HORIZON_MIN) * innerW;
        return (
          <g key={m}>
            <line x1={x} y1={railY - 5} x2={x} y2={railY + 5} stroke="#3a4530" strokeWidth={1} />
            <text
              x={x}
              y={railY + 16}
              fill="#5a6a52"
              fontSize={8}
              textAnchor="middle"
              fontFamily="monospace"
            >
              {m === 0 ? "NOW" : `+${m}`}
            </text>
          </g>
        );
      })}
      {/* the rail */}
      <line x1={PAD_L} y1={railY} x2={W - PAD_R} y2={railY} stroke="#3a4530" strokeWidth={2} />

      {/* the climb bar — solid when tight, dashed outline when loose */}
      {etaMin != null && etaX != null && (
        <>
          <line
            x1={PAD_L}
            y1={railY}
            x2={etaX}
            y2={railY}
            stroke={tone.hex}
            strokeWidth={4}
            strokeDasharray={fit === "loose" ? "7 5" : undefined}
            opacity={fit === "loose" ? 0.55 : 0.9}
          />
          {/* the guard flag where the fit crosses the line */}
          <g>
            <line
              x1={etaX}
              y1={railY - 12}
              x2={etaX}
              y2={railY + 12}
              stroke={tone.hex}
              strokeWidth={2}
            />
            <text
              x={etaX}
              y={railY - 17}
              fill={tone.hex}
              fontSize={9}
              textAnchor="middle"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {beyond ? `>${RUNWAY_HORIZON_MIN}m` : `${Math.round(etaMin)}m → GUARD`}
            </text>
          </g>
        </>
      )}
      {etaMin == null && (
        <text
          x={W / 2}
          y={railY - 8}
          fill={tone.hex}
          fontSize={9}
          textAnchor="middle"
          fontFamily="monospace"
          fontWeight="bold"
        >
          {young
            ? `WINDOW YOUNG — ${MIN_RUNWAY_SAMPLES} JUDGED SAMPLES NEEDED`
            : `NO ETA — CLIMB STALLED AT ≤ ${RUNWAY_MIN_RATE_MB_PER_MIN} MB/MIN`}
        </text>
      )}

      {/* the far-end guard marker */}
      <line
        x1={W - PAD_R}
        y1={railY - 6}
        x2={W - PAD_R}
        y2={railY + 6}
        stroke="#7a8a6e"
        strokeWidth={1.5}
        strokeDasharray="2 2"
      />
    </svg>
  );
}

function etaWordOf(etaMin: number): string {
  return etaMin <= 30 ? "short" : etaMin <= 90 ? "building" : "open";
}

/** The lull strip: the live gap bar, the heartbeat tick, the shaded
 *  stretching zone beyond 1.25× the heartbeat. */
function LullDial({
  gapMin,
  medianMin,
  multiple,
}: {
  gapMin: number | null;
  medianMin: number | null;
  multiple: number | null;
}) {
  const W = 520;
  const H = 64;
  const PAD_L = 8;
  const PAD_R = 8;
  const innerW = W - PAD_L - PAD_R;
  const railY = 40;
  const scaleMax = Math.max(gapMin ?? 0, medianMin != null ? medianMin * 2 : 0, 30);
  const gapX = gapMin == null ? null : PAD_L + (Math.min(gapMin, scaleMax) / scaleMax) * innerW;
  const medX =
    medianMin == null ? null : PAD_L + (Math.min(medianMin, scaleMax) / scaleMax) * innerW;
  const stretchFrom = medianMin != null ? medianMin * 1.25 : null;
  const stretchX =
    stretchFrom == null ? null : PAD_L + (Math.min(stretchFrom, scaleMax) / scaleMax) * innerW;
  const stretching = multiple != null && multiple >= 1.25;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full [&_rect]:cursor-help [&_circle]:cursor-help [&_line]:cursor-help [&_path]:cursor-help"
      role="img"
      aria-label="the lull dial"
    >
      {/* the stretching zone — where a quiet window lives */}
      {stretchX != null && (
        <rect
          x={stretchX}
          y={railY - 8}
          width={Math.max(W - PAD_R - stretchX, 0)}
          height={16}
          fill="#e0a030"
          opacity={0.12}
        />
      )}
      {/* the rail */}
      <line x1={PAD_L} y1={railY} x2={W - PAD_R} y2={railY} stroke="#3a4530" strokeWidth={2} />
      {/* the live gap bar */}
      {gapX != null && (
        <line
          x1={PAD_L}
          y1={railY}
          x2={gapX}
          y2={railY}
          stroke={stretching ? "#e0a030" : "#8fbf6a"}
          strokeWidth={4}
          opacity={0.9}
        />
      )}
      {/* the heartbeat tick */}
      {medX != null && (
        <g>
          <line
            x1={medX}
            y1={railY - 10}
            x2={medX}
            y2={railY + 10}
            stroke="#00d4e0"
            strokeWidth={2}
          />
          <text
            x={medX}
            y={railY + 22}
            fill="#00d4e0"
            fontSize={8}
            textAnchor="middle"
            fontFamily="monospace"
          >
            HEARTBEAT {medianMin}m
          </text>
        </g>
      )}
      {gapMin == null && (
        <text
          x={W / 2}
          y={railY - 8}
          fill="#7a8a6e"
          fontSize={9}
          textAnchor="middle"
          fontFamily="monospace"
          fontWeight="bold"
        >
          NO JUDGED GAP
        </text>
      )}
      {gapX != null && (
        <text
          x={gapX}
          y={railY - 10}
          fill={stretching ? "#e0a030" : "#8fbf6a"}
          fontSize={9}
          textAnchor="middle"
          fontFamily="monospace"
          fontWeight="bold"
        >
          {gapMin}m{multiple != null ? ` · ${multiple}×` : ""}
        </text>
      )}
    </svg>
  );
}

export function Outlook({
  witnessed,
  memSeries,
  guardMb,
  bootSinceMs,
}: {
  /** The rail projection's witnessed deaths (R116: ALL causes, journal
   *  order — the record's whole rhythm) — the lull's
   *  last-kill stamp and the heartbeat's source rows. */
  witnessed: RailProjectionPayload["witnessed"] | null | undefined;
  /** The guardian's living memSeries — the runway's raw window. */
  memSeries: Array<OutlookSample> | null | undefined;
  /** The live guard line (MB). */
  guardMb: number | null | undefined;
  /** The current boot's first stamp (ms) — the last bounce's time. The
   *  runway forecasts THIS boot only; pre-bounce samples stay in the
   *  living series but do not forecast the boot that replaced the dead. */
  bootSinceMs: number | null | undefined;
}) {
  const read = useMemo(() => {
    const kills = (witnessed ?? []).filter(
      (k) => k && typeof k.atMs === "number" && Number.isFinite(k.atMs),
    );
    const lastKillAtMs = kills.length > 0 ? Math.max(...kills.map((k) => k.atMs as number)) : null;
    const storm =
      kills.length >= 2
        ? stormHistory(kills.map((k) => ({ at: k.at, atMs: k.atMs, maxRssMb: k.maxRssMb })))
        : null;
    return outlookRead({
      samples: memSeries ?? null,
      guardMb: guardMb ?? null,
      nowMs: Date.now(),
      lastKillAtMs,
      heartbeatMedianMin: storm?.medianIntervalMin ?? null,
      bootSinceMs:
        typeof bootSinceMs === "number" && Number.isFinite(bootSinceMs) ? bootSinceMs : null,
    });
    // recompute on each render cycle the data changes — Date.now() rides along
  }, [witnessed, memSeries, guardMb, bootSinceMs]);

  if (!memSeries || memSeries.length === 0) return null;
  const etaTone =
    read.etaMin != null
      ? ETA_TONE[etaWordOf(read.etaMin)]!
      : read.climbRateMbPerMin == null
        ? ETA_YOUNG
        : ETA_STALLED;
  const lullTone = LULL_TONE[read.lullRead] ?? LULL_TONE.unjudged!;

  return (
    <div
      data-testid="outlook"
      className="mt-1.5 border border-[#3a4530]/60 rounded-sm bg-black/20 p-2.5 transition-colors duration-200 hover:border-[#4a5a3e]"
      title="THE OUTLOOK — the forward read. Every other panel reads the record backward; this one projects the living window to the guard line and reads the live gap against the record's own heartbeat. Zero new polls — the guardian fetch the page already makes feeds both dials."
    >
      <p className="vvu-label text-[7.5px] font-bold tracking-[0.22em] text-[#e0a030]/80 inline-flex flex-wrap items-center gap-1.5">
        THE OUTLOOK · WHAT THE NEXT HOUR OWES
        <span
          className={`inline-flex items-center border rounded-sm px-1 py-px text-[6.5px] tracking-[0.18em] ${etaTone.cls}`}
          title={
            read.etaMin != null
              ? `eta ~${read.etaMin} min to the ${guardMb ?? "—"} MB guard — headroom ${read.headroomMb} MB at ${read.climbRateMbPerMin} MB/min (R² ${read.climbR2}, ${read.climbFit})${read.etaBeyondHorizon ? ` — beyond the ${RUNWAY_HORIZON_MIN}-min horizon, drawn at the far edge` : ""}`
              : read.climbRateMbPerMin == null
                ? `window too young: ${read.runwayJudged} judged samples of ${MIN_RUNWAY_SAMPLES} needed — no climb rate, no eta (counted, never imputed)`
                : `climb ${read.climbRateMbPerMin} MB/min is at or below the ${RUNWAY_MIN_RATE_MB_PER_MIN} MB/min floor — the climb reads STALLED and a stalled climb gets no eta (a negative-time projection is a lie)`
          }
        >
          {etaTone.label}
          {read.etaMin != null ? ` · ~${Math.round(read.etaMin)} MIN` : ""}
        </span>
        <span
          className={`inline-flex items-center border rounded-sm px-1 py-px text-[6.5px] tracking-[0.18em] ${lullTone.cls}`}
          title={
            read.gapSinceKillMin != null && read.lullMultiple != null
              ? `${read.gapSinceKillMin} min since the last witnessed kill vs a ${read.heartbeatMedianMin}-min heartbeat median = ${read.lullMultiple}× — stretching at ≥ 1.25× (the SAME CADENCE_STRETCH_RATIO that reads the record's own cadence)`
              : read.lullRead === "no-storm"
                ? "no witnessed kill in the record — the lull dial has no storm to measure against"
                : "the live gap cannot be judged honestly (clock skew or no heartbeat median yet)"
          }
        >
          {lullTone.label}
          {read.lullMultiple != null ? ` · ${read.lullMultiple}×` : ""}
        </span>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
        <div title="THE RUNWAY: the memSeries' own OLS climb projected to the guard line. Ticks every 30 min out to the 120-min horizon; the bar ends where the fit crosses the guard. Solid = tight fit (R² ≥ 0.5, the shared call gate); dashed-dim = loose — the eta is shown, its confidence is drawn.">
          <p className="vvu-label text-[6.5px] tracking-[0.2em] text-[#7a8a6e] mb-1">
            THE RUNWAY · THIS BOOT&apos;S CLIMB TO THE {guardMb ?? "—"} MB GUARD
          </p>
          <RunwayDial
            etaMin={read.etaMin}
            fit={read.climbFit}
            beyond={read.etaBeyondHorizon}
            rate={read.climbRateMbPerMin}
          />
          <p
            className="vvu-label text-[6.5px] text-[#5a6a52] mt-1"
            title="the window's own arithmetic"
          >
            {read.runwayJudged}/{read.samplesOffered} samples judged · span{" "}
            {read.windowSpanMin ?? "—"} min · rss {read.currentRssMb ?? "—"} MB · headroom{" "}
            {read.headroomMb ?? "—"} MB · rate{" "}
            {read.climbRateMbPerMin != null
              ? `${read.climbRateMbPerMin >= 0 ? "+" : ""}${read.climbRateMbPerMin} MB/min`
              : "—"}{" "}
            · R² {read.climbR2 ?? "—"} ({read.climbFit ?? "—"})
          </p>
        </div>
        <div title="THE LULL: minutes since the last witnessed kill, against the storm history's own heartbeat median. The shaded zone begins at 1.25× the heartbeat — the SAME CADENCE_STRETCH_RATIO that calls the record's cadence stretching. A live gap inside that zone is the quiet window the ceiling re-read has been waiting for.">
          <p className="vvu-label text-[6.5px] tracking-[0.2em] text-[#7a8a6e] mb-1">
            THE LULL · LIVE GAP VS THE RECORD&apos;S HEARTBEAT
          </p>
          <LullDial
            gapMin={read.gapSinceKillMin}
            medianMin={read.heartbeatMedianMin}
            multiple={read.lullMultiple}
          />
          <p
            className="vvu-label text-[6.5px] text-[#5a6a52] mt-1"
            title="the gap's own arithmetic"
          >
            gap {read.gapSinceKillMin ?? "—"} min · heartbeat {read.heartbeatMedianMin ?? "—"} min ·
            multiple {read.lullMultiple ?? "—"}× · read {read.lullRead}
          </p>
        </div>
      </div>

      <p
        className="vvu-label text-[7px] text-[#7a8a6e] leading-relaxed mt-2"
        title="the engine's own note, arithmetic included — verbatim, never paraphrased"
      >
        THE READ · {read.note}
      </p>
    </div>
  );
}
