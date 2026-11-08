"use client";

// src/components/watchdog/MemoryPressure.tsx — R93 · THE KERNEL RACE, VISIBLE.
// R94 · THE KILL MARKS — the journal's own saves drawn INTO the race.
//
// PlateauScope (R72) draws the RSS sawtooth from the pass LOG (2h window).
// What it cannot show is the OTHER side of the race the estate is actually
// running: box MemAvailable — the number the kernel OOM-killer acts on —
// sagging WHILE next-server's RSS climbs. R90 proved the deaths: the kernel
// shoots between guardian passes once avail is deep (193MB at 19:39:21 →
// tree dead at 19:39:41). This panel draws BOTH series together from the
// R93 memSeries ring buffer (the guardian's own /proc reads, ≤90 samples ≈
// 30 min at the 20s pass, riding the status.json the page already fetches):
//
//   top    — next-server RSS (lime), the OOM guard line (rose dashed) and
//            the boot's own VmHWM (amber tick line — the high-water mark
//            the kernel remembers even after GC)
//   bottom — box MemAvailable (cyan), the 2-pass floor (300MB, amber
//            dashed) and the R91 deep-critical rail (150MB, rose dashed —
//            the one-pass line)
//
// R94 adds the third actor: REAL SAVES from the journal (bounce rows,
// drills excluded) whose timestamp falls inside the series window are drawn
// as rose kill-marks on BOTH lanes — R93's standing ask ("watch memory
// pressure across a full bounce") becomes a standing surface: when a save
// lands, the lanes show the pressure it landed INTO, not a number on a
// separate panel. A tick is evidence, not decoration: its tooltip carries
// the row's reason, landing verdict and downtime.
//
// HONESTY: the series lives in the guardian's memory — a re-arm resets it
// (arm-span scope, disclosed on the surface; the journal is the durable
// record). Pre-R93 status files carry no memSeries key: the panel says so
// instead of inventing. Dead passes (no RSS) leave gaps, never fabrications.
// A young series (<2 points) refuses to draw. Marks outside the window are
// not stretched to fit — they simply did not happen here. READ-ONLY: this
// draws, it never writes.

import { useMemo } from "react";

export interface MemSeriesPoint {
  t: string;
  rssKb: number | null;
  availKb: number | null;
}

/** R94 — one journal save, pre-filtered by the caller (drills excluded). */
export interface BounceMark {
  atMs: number;
  reason: string;
  ok: boolean;
  drill: boolean;
  downtimeMs?: number | null;
}

interface MemoryPressureProps {
  present: boolean;
  series?: Array<MemSeriesPoint>;
  guardMb?: number;
  availFloorMb?: number;
  availCriticalMb?: number;
  rssKb?: number | null;
  hwmKb?: number | null;
  boxAvailKb?: number | null;
  bounceMarks?: Array<BounceMark>;
}

// Fixed coordinate space per lane (same trick as PlateauScope:
// preserveAspectRatio="none" + non-scaling strokes keep it responsive).
const W = 1000;
const H = 64;

function kbToMb(kb: number | null | undefined): number | null {
  return typeof kb === "number" && Number.isFinite(kb) ? Math.round(kb / 1024) : null;
}

function hhmmss(at: string | null | undefined): string {
  return at && at.length >= 19 ? at.slice(11, 19) : "—";
}

/** Parse the guardian's own UTC stamp ("%Y-%m-%d %H:%M:%S UTC") to ms —
 *  the same grammar the server uses; the client never re-guesses. */
export function parseGuardianStampMs(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC$/.exec(t.trim());
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

/** One lane: fit the value series (plus the threshold lines it must show)
 *  into a fixed y-range, then build the polyline path. Null values break
 *  the path — a gap is drawn as a gap, honestly. Also returns the AREA
 *  path (R94): the same segments closed to the lane floor for the gradient
 *  fill, one closed sub-path per contiguous segment so gaps stay gaps. */
function laneGeometry(values: Array<number | null>, thresholds: Array<number | null>) {
  const present = values.filter((v): v is number => v != null);
  if (present.length < 2) return null;
  const bounds = [...present, ...thresholds.filter((t): t is number => t != null)];
  const rawMin = Math.min(...bounds);
  const rawMax = Math.max(...bounds);
  const pad = Math.max(24, (rawMax - rawMin) * 0.08);
  const yMin = Math.max(0, rawMin - pad);
  const yMax = rawMax + pad;
  const xOf = (i: number) => (i / (values.length - 1)) * W;
  const yOf = (v: number) => H - ((v - yMin) / (yMax - yMin)) * H;
  // Build the path with gaps: consecutive non-null values connect; a null
  // starts a new M command.
  let path = "";
  const segments: Array<{ x0: number; x1: number; pts: Array<[number, number]> }> = [];
  let started = false;
  let cur: Array<[number, number]> = [];
  values.forEach((v, i) => {
    if (v == null) {
      if (cur.length > 0) segments.push({ x0: cur[0][0], x1: cur[cur.length - 1][0], pts: cur });
      cur = [];
      started = false;
      return;
    }
    path += `${started ? "L" : "M"}${xOf(i).toFixed(2)},${yOf(v).toFixed(2)} `;
    cur.push([xOf(i), yOf(v)]);
    started = true;
  });
  if (cur.length > 0) segments.push({ x0: cur[0][0], x1: cur[cur.length - 1][0], pts: cur });
  // Area path: close each segment to the lane floor (gradient fill dies at
  // gaps, exactly where the line dies).
  let area = "";
  for (const seg of segments) {
    if (seg.pts.length < 2) continue;
    area += `M${seg.pts[0][0].toFixed(2)},${seg.pts[0][1].toFixed(2)} `;
    for (const [x, y] of seg.pts.slice(1)) area += `L${x.toFixed(2)},${y.toFixed(2)} `;
    area += `L${seg.x1.toFixed(2)},${H} L${seg.x0.toFixed(2)},${H} Z `;
  }
  return { xOf, yOf, path, area, yMin, yMax, n: values.length };
}

export function MemoryPressure({
  present,
  series,
  guardMb,
  availFloorMb,
  availCriticalMb,
  rssKb,
  hwmKb,
  boxAvailKb,
  bounceMarks,
}: MemoryPressureProps) {
  const points = series ?? [];

  const rssGeom = useMemo(
    () =>
      laneGeometry(
        points.map((p) => kbToMb(p.rssKb)),
        [guardMb ?? null, kbToMb(hwmKb)],
      ),
    [points, guardMb, hwmKb],
  );
  const availGeom = useMemo(
    () =>
      laneGeometry(
        points.map((p) => kbToMb(p.availKb)),
        [availFloorMb ?? null, availCriticalMb ?? null],
      ),
    [points, availFloorMb, availCriticalMb],
  );

  // R94 — the kill marks: journal saves (drills excluded by the caller)
  // whose stamp falls INSIDE the series window, positioned by time. A mark
  // outside the window did not happen here — it is never stretched in.
  const marks = useMemo(() => {
    if (points.length < 2) return [];
    const t0 = parseGuardianStampMs(points[0]?.t);
    const t1 = parseGuardianStampMs(points[points.length - 1]?.t);
    if (t0 == null || t1 == null || t1 <= t0) return [];
    return (bounceMarks ?? [])
      .filter((m) => Number.isFinite(m.atMs) && m.atMs >= t0 && m.atMs <= t1)
      .map((m) => ({ ...m, x: ((m.atMs - t0) / (t1 - t0)) * W }));
  }, [points, bounceMarks]);

  if (!present) return null;

  const since = points.length > 0 ? points[0]?.t : null;
  const until = points.length > 0 ? points[points.length - 1]?.t : null;
  const spanMin =
    points.length >= 2 ? Math.max(1, Math.round(((points.length - 1) * 20) / 60)) : null;

  // R94 — the lanes' own honest ranges (present values only), for the
  // header read: what this window actually contained.
  const rssVals = points.map((p) => kbToMb(p.rssKb)).filter((v): v is number => v != null);
  const availVals = points.map((p) => kbToMb(p.availKb)).filter((v): v is number => v != null);
  const rssRange = rssVals.length >= 2 ? `${Math.min(...rssVals)}–${Math.max(...rssVals)}` : null;
  const availRange =
    availVals.length >= 2 ? `${Math.min(...availVals)}–${Math.max(...availVals)}` : null;

  return (
    <div
      className="rounded-sm border border-[#00d4e0]/20 bg-black/25 px-2.5 py-2 transition-colors duration-200 hover:border-[#4a5a3e]"
      data-testid="memory-pressure"
      title="the R93 memory-pressure series — the guardian's own /proc reads, one sample per 20s pass, ≤90 samples (~30 min) riding status.json. Top lane: next-server RSS against the OOM guard and the boot's high-water mark. Bottom lane: box MemAvailable against the 2-pass floor and the R91 one-pass deep rail — the number the kernel actually kills on. R94 kill-marks: real journal saves inside the window are the rose verticals. The series lives in the guardian's memory: a re-arm resets it (arm-span scope); the journal is the durable record."
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="vvu-label text-[8px] font-bold tracking-[0.22em] text-[#7a8a6e]">
          MEMORY PRESSURE · RSS × BOX AVAIL — THE RACE BOTH SIDES RUN
        </p>
        <p className="vvu-label text-[8px] text-[#7a8a6e] tabular-nums">
          {points.length} SAMPLES · ~{spanMin ?? "—"} MIN
          {since && until ? ` · ${hhmmss(since)} → ${hhmmss(until)} UTC` : ""}
          {marks.length > 0 ? (
            <span className="text-[#e5484d]">
              {" "}
              · {marks.length} SAVE{marks.length === 1 ? "" : "S"} IN WINDOW
            </span>
          ) : (
            " · 0 SAVES IN WINDOW"
          )}
        </p>
      </div>

      {points.length < 2 || !rssGeom || !availGeom ? (
        <p className="mt-2 vvu-label text-[9px] text-[#7a8a6e] border border-dashed border-[#3a4530] rounded-sm px-3 py-3 text-center">
          {series === undefined
            ? "NO SERIES — THIS GUARDIAN PREDATES R93 (RE-ARM TO START ONE). THE JOURNAL REMAINS THE DURABLE RECORD."
            : `${points.length} SAMPLE${points.length === 1 ? "" : "S"} ON RECORD — THE LANES WILL NOT DRAW FROM ONE POINT. THEY FILL AS THE GUARDIAN PASSES.`}
        </p>
      ) : (
        <>
          <svg width="0" height="0" className="absolute" aria-hidden>
            <defs>
              <linearGradient id="mpRssFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c8ff00" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#c8ff00" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="mpAvailFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00d4e0" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#00d4e0" stopOpacity={0} />
              </linearGradient>
            </defs>
          </svg>

          {/* RSS lane */}
          <div className="mt-1.5">
            <div className="flex items-center justify-between">
              <span className="vvu-label text-[7.5px] tracking-[0.18em] text-[#7a8a6e]">
                NEXT-SERVER RSS
                {rssRange ? (
                  <span className="ml-1.5 text-[#5f6e55] normal-case">· RANGE {rssRange} MB</span>
                ) : null}
              </span>
              <span className="font-mono text-[9px] text-[#c8ff00] tabular-nums">
                {kbToMb(rssKb) ?? "—"} MB
                {hwmKb != null ? (
                  <span className="text-[#e0a030]"> · HWM {kbToMb(hwmKb)}</span>
                ) : null}
              </span>
            </div>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="w-full h-[64px] block [&_circle]:cursor-help [&_line]:cursor-help [&_rect]:cursor-help"
              role="img"
              aria-label={`Next-server RSS across ${rssGeom.n} guardian passes, guard line at ${guardMb ?? "unknown"} MB${marks.length > 0 ? `, ${marks.length} journal save${marks.length === 1 ? "" : "s"} marked in window` : ", no journal saves in window"}`}
            >
              {/* R94 — the over-guard band: where 2 consecutive passes fire the rss rail */}
              {guardMb != null && (
                <rect
                  x={0}
                  y={0}
                  width={W}
                  height={Math.max(0, rssGeom.yOf(guardMb))}
                  fill="#e5484d"
                  opacity={0.05}
                />
              )}
              <path d={rssGeom.area} fill="url(#mpRssFill)" stroke="none" />
              {guardMb != null && (
                <line
                  x1={0}
                  x2={W}
                  y1={rssGeom.yOf(guardMb)}
                  y2={rssGeom.yOf(guardMb)}
                  stroke="#e5484d"
                  strokeWidth={1}
                  strokeDasharray="6 5"
                  vectorEffect="non-scaling-stroke"
                  opacity={0.75}
                />
              )}
              {hwmKb != null && kbToMb(hwmKb) != null && (
                <line
                  x1={0}
                  x2={W}
                  y1={rssGeom.yOf(kbToMb(hwmKb) as number)}
                  y2={rssGeom.yOf(kbToMb(hwmKb) as number)}
                  stroke="#e0a030"
                  strokeWidth={1}
                  strokeDasharray="2 6"
                  vectorEffect="non-scaling-stroke"
                  opacity={0.55}
                />
              )}
              {/* R94 — kill marks: one vertical per real save in window */}
              {marks.map((m, i) => (
                <g key={`rss-mark-${i}`} pointerEvents="none">
                  <line
                    x1={m.x}
                    x2={m.x}
                    y1={0}
                    y2={H}
                    stroke="#e5484d"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                    opacity={0.8}
                  />
                  <circle
                    cx={m.x}
                    cy={3}
                    r={2.2}
                    fill="#e5484d"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              ))}
              <path
                d={rssGeom.path}
                fill="none"
                stroke="#c8ff00"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {/* R94 — the live sample: the newest RSS reading */}
              {(() => {
                const last = points.length > 0 ? kbToMb(points[points.length - 1]?.rssKb) : null;
                return last != null ? (
                  <g>
                    <circle cx={W} cy={rssGeom.yOf(last)} r={4} fill="#c8ff00" opacity={0.25} />
                    <circle cx={W} cy={rssGeom.yOf(last)} r={2} fill="#c8ff00" />
                  </g>
                ) : null;
              })()}
            </svg>
          </div>

          {/* AVAIL lane */}
          <div className="mt-1">
            <div className="flex items-center justify-between">
              <span className="vvu-label text-[7.5px] tracking-[0.18em] text-[#7a8a6e]">
                BOX MEMAVAILABLE
                {availRange ? (
                  <span className="ml-1.5 text-[#5f6e55] normal-case">· RANGE {availRange} MB</span>
                ) : null}
              </span>
              <span
                className={`font-mono text-[9px] tabular-nums ${
                  (kbToMb(boxAvailKb) ?? Infinity) < (availCriticalMb ?? 150)
                    ? "text-[#e5484d]"
                    : (kbToMb(boxAvailKb) ?? Infinity) < (availFloorMb ?? 300)
                      ? "text-[#e0a030]"
                      : "text-[#00d4e0]"
                }`}
              >
                {kbToMb(boxAvailKb) ?? "—"} MB
              </span>
            </div>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="w-full h-[64px] block [&_circle]:cursor-help [&_line]:cursor-help [&_rect]:cursor-help"
              role="img"
              aria-label={`Box MemAvailable across ${availGeom.n} guardian passes, floor at ${availFloorMb ?? "unknown"} MB, deep rail at ${availCriticalMb ?? "unknown"} MB${marks.length > 0 ? `, ${marks.length} journal save${marks.length === 1 ? "" : "s"} marked in window` : ", no journal saves in window"}`}
            >
              {/* R94 — the kernel's zone: under the deep rail is where the
                  OOM killer acts between passes (the R90 case study) */}
              {availCriticalMb != null && (
                <rect
                  x={0}
                  y={Math.min(H, availGeom.yOf(availCriticalMb))}
                  width={W}
                  height={Math.max(0, H - Math.min(H, availGeom.yOf(availCriticalMb)))}
                  fill="#e5484d"
                  opacity={0.09}
                />
              )}
              <path d={availGeom.area} fill="url(#mpAvailFill)" stroke="none" />
              {availFloorMb != null && (
                <line
                  x1={0}
                  x2={W}
                  y1={availGeom.yOf(availFloorMb)}
                  y2={availGeom.yOf(availFloorMb)}
                  stroke="#e0a030"
                  strokeWidth={1}
                  strokeDasharray="6 5"
                  vectorEffect="non-scaling-stroke"
                  opacity={0.7}
                />
              )}
              {availCriticalMb != null && (
                <line
                  x1={0}
                  x2={W}
                  y1={availGeom.yOf(availCriticalMb)}
                  y2={availGeom.yOf(availCriticalMb)}
                  stroke="#e5484d"
                  strokeWidth={1}
                  strokeDasharray="2 4"
                  vectorEffect="non-scaling-stroke"
                  opacity={0.85}
                />
              )}
              {marks.map((m, i) => (
                <g key={`avail-mark-${i}`} pointerEvents="none">
                  <line
                    x1={m.x}
                    x2={m.x}
                    y1={0}
                    y2={H}
                    stroke="#e5484d"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                    opacity={0.8}
                  />
                  <circle
                    cx={m.x}
                    cy={3}
                    r={2.2}
                    fill="#e5484d"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              ))}
              <path
                d={availGeom.path}
                fill="none"
                stroke="#00d4e0"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {/* R94 — the live sample: the newest avail reading */}
              {(() => {
                const last = points.length > 0 ? kbToMb(points[points.length - 1]?.availKb) : null;
                return last != null ? (
                  <g>
                    <circle cx={W} cy={availGeom.yOf(last)} r={4} fill="#00d4e0" opacity={0.25} />
                    <circle cx={W} cy={availGeom.yOf(last)} r={2} fill="#00d4e0" />
                  </g>
                ) : null;
              })()}
            </svg>
          </div>

          {/* R94 — the kill-mark readout: what each in-window save landed into */}
          {marks.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {marks.map((m, i) => (
                <p
                  key={`mark-readout-${i}`}
                  className="vvu-label text-[8px] text-[#b8c9a0] leading-relaxed"
                  title="a journal save inside this series window — the lanes show the pressure it landed INTO; the row itself lives in the bounce journal below"
                >
                  <span className="text-[#e5484d] font-bold">◆ SAVE</span>{" "}
                  <span className="tabular-nums">
                    {new Date(m.atMs).toISOString().slice(11, 19)} UTC
                  </span>{" "}
                  · {m.reason.toUpperCase()} · {m.ok ? "LANDED" : "FAILED"}
                  {m.downtimeMs != null ? ` · DOWNTIME ${(m.downtimeMs / 1000).toFixed(1)}S` : ""}
                </p>
              ))}
            </div>
          )}

          {/* legend + the reading */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="vvu-label text-[8px] text-[#7a8a6e]">
              <span
                className="inline-block w-2 border-t border-dashed border-[#e5484d] align-middle mr-1"
                aria-hidden
              />
              GUARD {guardMb ?? "—"}
              <span className="mx-1.5 text-[#3a4530]">|</span>
              <span
                className="inline-block w-2 border-t border-dashed border-[#e0a030] align-middle mr-1"
                aria-hidden
              />
              HWM + FLOOR {availFloorMb ?? "—"}
              <span className="mx-1.5 text-[#3a4530]">|</span>
              <span
                className="inline-block w-2 border-t border-dotted border-[#e5484d] align-middle mr-1"
                aria-hidden
              />
              DEEP RAIL {availCriticalMb ?? "—"} · 1-PASS
              <span className="mx-1.5 text-[#3a4530]">|</span>
              <span
                className="inline-block w-2 border-l border-[#e5484d] align-middle mr-1"
                aria-hidden
              />
              SAVE IN WINDOW (R94)
            </span>
            <span
              className="vvu-label text-[8px] text-[#5f6e55] ml-auto"
              title="the race in one sentence: the RSS line climbing while the avail line sags is the compile-burst doing both at once — the kernel acts on the avail lane, the guardian's rails try to land the boot first"
            >
              RSS CLIMBS WHILE AVAIL SAGS = THE COMPILE BURST, BOTH LANES AT ONCE
            </span>
          </div>
        </>
      )}
    </div>
  );
}
