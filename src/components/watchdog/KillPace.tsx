'use client';

// src/components/watchdog/KillPace.tsx — R118 · THE QUICKENING LENS,
// R117's risk #1 instrumented: four kills landed in 77 minutes and the
// question stood uninstrumented — is the storm's kill cadence COMPRESSING,
// HOLDING, or STRETCHING?
//
//   the gaps     — consecutive witnessed-death intervals, all causes (the
//                  R116 feed); skewed pairs skipped, as the era card skips
//   the window   — the last 6 gaps are the record's present pace; their
//                  house lower-median against the heartbeat (storm
//                  history's full-median interval, the same calibration
//                  the eras card rides) gives the verdict:
//                  QUICKENING ≤ 75% · STEADY between · STRETCHING ≥ 1.25
//                  (the lull dial's own CADENCE_STRETCH_RATIO, not a new
//                  line) · TOO FEW (under 4 honest gaps)
//   the streak   — trailing consecutive kills inside the heartbeat: the
//                  compress's own depth ("a fifth kill inside the
//                  heartbeat" is this counter reaching five)
//   the strip    — the last 24 gaps as bars, amber inside the heartbeat,
//                  cyan past the lull line, sage between; the heartbeat
//                  and the lull line drawn as dashed rules at their own
//                  heights; hover any bar for the gap's stamps and the
//                  cause that closed it
//   the rolling  — kills in the last hour / 3h / 6h from the panel's own
//                  clock (ticking every 30s)
//   the clock    — minutes since the newest death against the window's
//                  median: the live dial. It names ELAPSED vs EXPECTED,
//                  never when the next death comes.
//
// THE READ is the engine's own note, verbatim.

import { useEffect, useMemo, useState } from 'react';

import type { RailProjectionPayload } from '@/lib/operator-projection';
import { stormHistory, CADENCE_STRETCH_RATIO } from '@/lib/storm-history';
import {
  killPaceRead,
  PACE_DRIFT_BAND,
  PACE_QUICKEN_RATIO,
  PACE_STREAK_SUB_VERDICT,
  type KillPaceVerdict,
  type PaceGap,
} from '@/lib/kill-pace';

const SAGE = '#c8ff00';
const CYAN = '#00d4e0';
const AMBER = '#e0a030';
const GRAY = '#5f6e55';

function Chip({
  label,
  tone = 'neutral',
  title,
}: {
  label: string;
  tone?: 'neutral' | 'sage' | 'cyan' | 'amber';
  title?: string;
}) {
  const toneCls =
    tone === 'sage'
      ? 'border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10'
      : tone === 'cyan'
        ? 'border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10'
        : tone === 'amber'
          ? 'border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10'
          : 'border-[#3a4530] text-[#c9d4bd] bg-black/30';
  return (
    <span className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${toneCls} tabular-nums cursor-help transition-[filter,border-color] duration-150 hover:brightness-125`} title={title}>
      {label}
    </span>
  );
}

function verdictTone(word: KillPaceVerdict): 'neutral' | 'sage' | 'cyan' | 'amber' {
  switch (word) {
    case 'QUICKENING':
      return 'amber';
    case 'STRETCHING':
      return 'cyan';
    case 'STEADY':
      return 'sage';
    default:
      return 'neutral';
  }
}

/** THE STRIP — the last N gaps as vertical bars on one minute scale. The
 *  heartbeat and the lull line ride as dashed rules at their own heights;
 *  a bar's color is where it stands against them. */
function GapStrip({
  gaps,
  heartbeat,
  lullLine,
  w,
  h,
}: {
  gaps: PaceGap[];
  heartbeat: number | null;
  lullLine: number | null;
  w: number;
  h: number;
}) {
  const shown = gaps.slice(-24);
  const scaleMax = Math.max(
    ...shown.map((g) => g.gapMin),
    heartbeat ?? 0,
    lullLine ?? 0,
    1,
  );
  const padT = 3;
  const padB = 3;
  const laneW = w - 2;
  const slot = shown.length > 0 ? laneW / shown.length : laneW;
  const barW = Math.max(1.5, Math.min(14, slot - 2));
  const y = (v: number) => h - padB - (v / scaleMax) * (h - padT - padB);

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="kill gap strip, one bar per recent gap on one minute scale"
      data-testid="kill-pace-strip"
      className="[&_rect]:cursor-help [&_line]:cursor-help"
    >
      {lullLine != null && (
        <line
          x1={1}
          x2={w - 1}
          y1={y(lullLine)}
          y2={y(lullLine)}
          stroke={CYAN}
          strokeWidth={0.75}
          strokeDasharray="3 3"
          opacity={0.7}
        >
          <title>{`the lull line ${lullLine.toFixed(2)} min — heartbeat × ${CADENCE_STRETCH_RATIO} (the era card's own carve line); bars past it are lulls`}</title>
        </line>
      )}
      {heartbeat != null && (
        <>
          {/* The heartbeat's interior — the compress zone, shaded so the
              amber bars visibly live INSIDE something (R119 styling). */}
          <rect
            x={1}
            y={y(heartbeat)}
            width={w - 2}
            height={Math.max(0, h - padB - y(heartbeat))}
            fill={AMBER}
            opacity={0.055}
          >
            <title>{`the heartbeat's interior — every gap in this shaded band landed faster than the record's median breath (${heartbeat.toFixed(2)} min); the compress lives here`}</title>
          </rect>
          <line
            x1={1}
            x2={w - 1}
            y1={y(heartbeat)}
            y2={y(heartbeat)}
            stroke={AMBER}
            strokeWidth={0.75}
            strokeDasharray="1.5 2.5"
            opacity={0.8}
          >
            <title>{`the heartbeat ${heartbeat.toFixed(2)} min — bars under it landed inside the heartbeat (the compress)`}</title>
          </line>
        </>
      )}
      {shown.map((g, i) => {
        const inside = heartbeat != null && g.gapMin < heartbeat;
        const past = lullLine != null && g.gapMin >= lullLine;
        const fill = inside ? AMBER : past ? CYAN : GRAY;
        return (
          <rect
            key={g.index}
            x={1 + i * slot + (slot - barW) / 2}
            y={y(g.gapMin)}
            width={barW}
            height={Math.max(1, h - padB - y(g.gapMin))}
            fill={fill}
            opacity={0.9}
          >
            <title>{`gap #${g.index} · ${Math.round(g.gapMin * 100) / 100} min · ${g.fromAt} → ${g.toAt} · closed by the ${g.cause} death${inside ? ' · inside the heartbeat' : ''}${past ? ' · past the lull line' : ''}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export function KillPace({ projection }: { projection: RailProjectionPayload }) {
  // The panel's own clock — the rolling spans and the dial are live
  // arithmetic, re-derived every 30s (the engine stays pure; the clock is
  // handed in).
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    // The first stamp rides a timer callback (async — the panel paints
    // null for one frame), so the clock is handed to the engine the same
    // way every house panel hands state to itself: from a callback, never
    // synchronously inside the effect body.
    const first = setTimeout(() => setNowMs(Date.now()), 0);
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  const read = useMemo(() => {
    const deaths = projection.witnessedDeaths ?? projection.witnessed;
    if (!deaths || deaths.length === 0 || nowMs == null) return null;
    const storm = stormHistory(deaths.map((k) => ({ at: k.at, atMs: k.atMs, maxRssMb: k.maxRssMb })));
    return killPaceRead(
      deaths.map((d) => ({
        at: d.at,
        atMs: d.atMs,
        cause: (d as { cause?: string }).cause ?? 'unknown',
      })),
      { heartbeatMin: storm.medianIntervalMin, nowMs },
    );
  }, [projection, nowMs]);

  if (!read) return null;

  const lullLine = read.heartbeatMin != null ? read.heartbeatMin * CADENCE_STRETCH_RATIO : null;
  const clockPct = read.clockRatio != null ? Math.round(read.clockRatio * 100) : null;

  return (
    <div className="mt-1.5 rounded-sm border border-[#3a4530]/60 bg-black/20 p-2 transition-colors duration-200 hover:border-[#4a5a3e]" data-testid="kill-pace">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p
          className="vvu-label text-[7.5px] font-bold tracking-[0.18em] text-[#7a8a6e] cursor-help"
          title={`R117's risk #1, instrumented: four kills landed in 77 minutes and the pace question stood open. THE LENS reads the witnessed-death gaps (all causes — the R116 feed): the last ${'6'} gaps are the record's present pace, their house lower-median against the heartbeat (storm history's full-median interval) gives the verdict — QUICKENING at ≤ ${PACE_QUICKEN_RATIO * 100}% of the line (inclusive edge), STRETCHING at ≥ ${CADENCE_STRETCH_RATIO}× (the lull dial's own CADENCE_STRETCH_RATIO — the era card's carve line, not a new one), STEADY between, TOO FEW under ${'4'} honest gaps. When the heartbeat is unreadable the line falls back to the record's own full gap median, said out loud. The streak counts trailing kills inside the heartbeat — the compress's depth. R119's SUB-VERDICT: when the verdict is STEADY and the streak reaches ${PACE_STREAK_SUB_VERDICT} (the fifth kill inside the heartbeat, R117's named count), a second word speaks — COMPRESSING UNDERNEATH — the median grammar and the streak grammar disagreeing out loud, neither overriding the other. The rolling table counts kills in the last hour/3h/6h. THE CLOCK names elapsed vs expected — it never forecasts a death; the pace reads the record's past, the future is nobody's to read.`}
        >
          THE QUICKENING LENS · THE PACE OF THE STORM
        </p>
        <div className={`ml-auto flex flex-wrap items-center gap-1 ${read.subVerdict ? 'border-l-2 border-[#e0a030]/70 pl-1.5' : ''}`}>
          <Chip
            tone={read.verdict === 'TOO FEW' ? 'neutral' : verdictTone(read.verdict)}
            label={read.verdict}
            title={read.verdictReason}
          />
          {read.subVerdict && (
            <Chip
              tone="amber"
              label={read.subVerdict}
              title={`THE SUB-VERDICT (R118's risk #2, R119 instrumented) — ${read.subVerdictReason}. The verdict stays STEADY: the median grammar keeps its word, the streak grammar rides beside it — a compound read, not an override.`}
            />
          )}
          {read.insideStreak != null && read.insideStreak >= 1 && (
            <Chip
              tone="amber"
              label={`${read.insideStreak} INSIDE`}
              title={`the compress streak: ${read.insideStreak} trailing consecutive gap(s) strictly inside the ${read.heartbeatMin?.toFixed(2)}-min heartbeat — every one landed faster than the record's median breath`}
            />
          )}
          {read.windowMedianMin != null && (
            <Chip
              label={`WINDOW ${read.windowGaps.length} · MED ${Math.round(read.windowMedianMin * 100) / 100}′`}
              title={`the last ${read.windowGaps.length} honest gap(s), house lower-median ${read.windowMedianMin.toFixed(2)} min — the record's present pace${read.ratio != null ? `; ${Math.round(read.ratio * 100)}% of the ${read.lineMin.toFixed(2)}-min line` : ''}`}
            />
          )}
          {read.windowDrift != null && read.windowDriftPct != null && read.priorWindowMedianMin != null && (
            <Chip
              tone={read.windowDrift === 'FALLING' ? 'amber' : read.windowDrift === 'RISING' ? 'cyan' : 'neutral'}
              label={`DRIFT ${read.windowDrift === 'FALLING' ? '↓' : read.windowDrift === 'RISING' ? '↑' : '→'} ${Math.round(Math.abs(read.windowDriftPct) * 100)}%`}
              title={`THE WINDOW'S DRIFT (R127): this window's median ${read.windowMedianMin?.toFixed(2)}′ against the prior window's ${read.priorWindowMedianMin.toFixed(2)}′ — the motion said, not implied. The verdict compares the window to the line; the drift compares the windows to each other. A falling window drags the lines that follow it (the lull line moves with the heartbeat — a moving line re-carves the eras). The ±${PACE_DRIFT_BAND * 100}% band reads STEADY (exclusive at exactly ±${PACE_DRIFT_BAND * 100}%).`}
            />
          )}
          {read.sinceLastMin != null && (
            <Chip
              tone={clockPct != null && clockPct >= 100 ? 'cyan' : 'neutral'}
              label={`CLOCK ${read.sinceLastMin.toFixed(1)}′ (${clockPct ?? '—'}%)`}
              title={`the live dial: ${read.sinceLastMin.toFixed(1)} min since the newest death — ${clockPct ?? '—'}% of the window's ${read.windowMedianMin?.toFixed(2)}-min median${clockPct != null && clockPct >= 100 ? ' — past the window\'s own breath: the quiet is deeper than the storm\'s present pace (elapsed, never a forecast)' : ' (elapsed, never a forecast)'}`}
            />
          )}
          <Chip
            label={`${read.deaths} DEATHS`}
            title={`${read.deaths} witnessed deaths (all causes) feed the lens; ${read.gaps.length} honest consecutive-interval gap(s) survive the skew skip`}
          />
        </div>
      </div>

      {read.gaps.length > 0 && (
        <div className="mt-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="vvu-label text-[6.5px] font-bold tracking-[0.14em] text-[#5f6e55]">
              THE GAPS · LAST {Math.min(24, read.gaps.length)} OF {read.gaps.length}
            </span>
            <span className="vvu-label text-[6.5px] text-[#5f6e55]" title="bar colors are where each gap stands against the two rules: amber under the heartbeat (the compress), cyan past the lull line (a lull), sage between">
              <span style={{ color: AMBER }}>■</span> inside the heartbeat ·{' '}
              <span style={{ color: GRAY }}>■</span> between ·{' '}
              <span style={{ color: CYAN }}>■</span> past the lull line
            </span>
          </div>
          <div className="mt-0.5 overflow-x-auto">
            <GapStrip
              gaps={read.gaps}
              heartbeat={read.heartbeatMin}
              lullLine={lullLine}
              w={560}
              h={54}
            />
          </div>
          <span className="vvu-label text-[6px] text-[#5f6e55]">
            oldest → newest · amber dashed = the heartbeat {read.heartbeatMin?.toFixed(2) ?? '—'}′ · cyan dashed = the lull line{' '}
            {lullLine != null ? `${lullLine.toFixed(2)}′` : '—'} (heartbeat × {CADENCE_STRETCH_RATIO})
          </span>
        </div>
      )}

      <div className="mt-1 overflow-x-auto" data-testid="kill-pace-table">
        <table className="w-full min-w-[420px] border-collapse">
          <thead>
            <tr className="vvu-label text-[6.5px] font-bold tracking-[0.14em] text-[#5f6e55]">
              <th className="text-left py-0.5 pr-2 font-bold">ROLLING SPAN</th>
              <th className="text-right py-0.5 px-2 font-bold">KILLS</th>
              <th className="text-right py-0.5 px-2 font-bold">PER HOUR</th>
              <th className="text-left py-0.5 pl-2 font-bold">READ</th>
            </tr>
          </thead>
          <tbody>
            {read.rolling.map((s) => (
              <tr
                key={s.labelMin}
                tabIndex={0}
                title={`rolling pace: ${s.kills} witnessed death(s) in the last ${s.labelMin} minutes ending at the panel's own clock — ${s.perHour} kills/hour. The span rides the clock: the counts move between kills.`}
                aria-label={`rolling ${s.labelMin} minutes pace row`}
                className="vvu-label text-[7.5px] text-[#c9d4bd] tabular-nums outline-none transition-colors duration-150 hover:bg-[#6b8a40]/5 focus-visible:bg-[#6b8a40]/10"
              >
                <td className="py-0.5 pr-2 text-left whitespace-nowrap font-bold">
                  LAST {s.labelMin >= 60 ? `${s.labelMin / 60} H` : `${s.labelMin} MIN`}
                </td>
                <td className="text-right py-0.5 px-2">{s.kills}</td>
                <td className="text-right py-0.5 px-2">{s.perHour}</td>
                <td className="py-0.5 pl-2 text-left whitespace-nowrap text-[#5f6e55]">
                  {s.kills === 0
                    ? 'no death in the span'
                    : s.kills === 1
                      ? 'a single strike'
                      : 'a multi-kill span — the quickening watch reads the gaps strip'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {read.deaths > 0 && (
        <p className="vvu-label mt-1.5 text-[7px] leading-relaxed text-[#7a8a6e]" data-testid="kill-pace-read">
          <span className="font-bold" style={{ color: AMBER }}>THE READ · </span>
          {read.note}
        </p>
      )}
    </div>
  );
}
