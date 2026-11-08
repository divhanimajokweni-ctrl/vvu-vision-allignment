"use client";

// src/components/watchdog/DeathWindows.tsx — R108 · THE DEATH WINDOWS, the
// dying minute, drawn.
//
// Every panel above this one reads the deaths as NUMBERS or WORDS: the
// ceiling strip plots each kill's peak as a diamond on the guard scale, the
// storm history carries the shapes as dot fills, the box floor reads the
// dips. The record's central finding — sawtooth: crossings inside an
// oscillation, not runaways — has never been SHOWN as the trajectories
// themselves. This panel draws the actual witness windows: per kill, the
// rss curve the kernel struck inside, on one shared MB scale and one shared
// clock (the death stamp at the right edge, every window aligned to it), so
// the cards compare honestly against each other and against the judged
// ceiling band (min→max, shaded) the strip established.
//
//   the curve  — the guardian's last ≤12 passes before death; rss gaps stay
//                gaps (the polyline breaks where a pass carried no reading,
//                never interpolated); the last witnessed point is marked
//                (the final reading before the kill)
//   the dots   — reversals with both legs ≥ the witness engine's own
//                REVERSAL_MIN_DELTA_MB (one calibration, many readers) —
//                the sawtooth's own geometry, drawn where it happens
//   the clock  — stamps that fail to parse never invent time: the window
//                draws index-spaced under the CLOCK·UNSTAMPED chip (sample
//                order is real; the spacing is disclosed as spacing)
//   the refusals — a thin window (one finite rss point) draws its point and
//                names itself THIN; a no-rss window keeps its card, empty
//                and named (the box pressure it did witness is quoted in
//                the arithmetic — never fabricated into a curve)
//
// THE READ is the engine's own note, verbatim.

import { ceilingDistribution } from "@/lib/witness-windows";
import { deathWindows } from "@/lib/death-windows";
import { measureSwings } from "@/lib/sawtooth";
import { parseGuardianStampMs } from "@/components/watchdog/MemoryPressure";
import type { RailProjectionPayload } from "@/lib/operator-projection";
import type { DeathWindowRead } from "@/lib/death-windows";

const SHAPE_CHIP_CLS: Record<string, string> = {
  sawtooth: "border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10",
  climbing: "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10",
  falling: "border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10",
  flat: "border-[#3a4530] text-[#7a8a6e] bg-black/30",
  single: "border-[#3a4530] text-[#7a8a6e] bg-black/30",
  unjudged: "border-[#3a4530] text-[#5f6e55] bg-black/30",
  unknown: "border-[#3a4530] text-[#5f6e55] bg-black/30",
};

const CURVE = "#c8ff00";
const REVERSAL = "#00d4e0";
const EDGE = "#e5484d";
const BAND = "rgba(200,255,0,0.055)";

function hhmm(atMs: number | null): string {
  if (atMs == null) return "--:--";
  const d = new Date(atMs);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function fmt1(v: number | null): string {
  return v == null ? "—" : `${Math.round(v * 10) / 10}`;
}

function fmtClimb(v: number | null): string {
  return v == null ? "—" : `${v >= 0 ? "+" : ""}${Math.round(v * 10) / 10}`;
}

/** one card's SVG geometry — computed once per panel render from the SHARED
 *  domain so every card compares against the same MB scale. */
function cardGeometry(all: Array<DeathWindowRead>) {
  const drawable = all.filter((w) => w.drawKind === "curve");
  const rssVals = drawable.flatMap((w) =>
    w.points.map((p) => p.rssMb).filter((v): v is number => v != null),
  );
  const pad = 28;
  const lo = rssVals.length > 0 ? Math.min(...rssVals) - pad : 1700;
  const hi = rssVals.length > 0 ? Math.max(...rssVals) + pad : 2300;
  const dts = drawable
    .filter((w) => !w.clockSpaced && w.points.length > 0)
    .map((w) => w.points[0]!.dtSec)
    .filter((v): v is number => v != null);
  const minDt = dts.length > 0 ? Math.min(...dts) : -240;
  return { lo, hi, minDt };
}

export function DeathWindows({ projection }: { projection: RailProjectionPayload }) {
  const { witnessed, witnessWindows, scenarios, meta } = projection;
  if (!witnessed || witnessed.length === 0) return null;

  const read = deathWindows(
    witnessed.map((k) => ({
      at: k.at,
      atMs: typeof k.atMs === "number" && Number.isFinite(k.atMs) ? k.atMs : null,
      witness: Array.isArray(k.witness) ? k.witness : [],
    })),
    witnessWindows ?? [],
    parseGuardianStampMs,
  );

  const guardLevels = (scenarios ?? [])
    .filter((s) => s.kind === "guard")
    .map((s) => s.levelMb)
    .sort((a, b) => a - b);
  const ceiling = ceilingDistribution(witnessed, witnessWindows ?? [], guardLevels, meta.guardMb);

  const W = 168;
  const H = 64;
  const padL = 7;
  const padR = 11;
  const padT = 9;
  const padB = 7;
  const { lo, hi, minDt } = cardGeometry(read.windows);
  const span = hi - lo || 1;
  const tSpan = 0 - minDt || 1;
  const yMb = (v: number) => padT + (1 - (v - lo) / span) * (H - padT - padB);
  const xTime = (dt: number) => padL + ((dt - minDt) / tSpan) * (W - padL - padR);

  const bandLo = ceiling.minCeilingMb;
  const bandHi = ceiling.maxCeilingMb;
  const bandTop = bandHi != null ? yMb(bandHi) : null;
  const bandBot = bandLo != null ? yMb(bandLo) : null;

  return (
    <div
      className="mt-1.5 rounded-sm border border-[#3a4530]/60 bg-black/20 p-2 transition-colors duration-200 hover:border-[#4a5a3e]"
      data-testid="death-windows"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p
          className="vvu-label text-[7.5px] font-bold tracking-[0.18em] text-[#7a8a6e]"
          title={`each witnessed kill's actual dying minute — the guardian's last ≤12 passes before death drawn as the rss trajectory the kernel struck inside, all cards on one shared MB scale (${Math.round(lo)}→${Math.round(hi)} MB) and one shared clock (the death stamp at every card's right edge). The shaded band is the judged ceiling cluster (${fmt1(bandLo)}→${fmt1(bandHi)} MB — the same band the ceiling strip plots as diamonds). Cyan dots mark reversals with both legs ≥ 5 MB — the sawtooth's own geometry. A broken curve is a pass with no rss reading (counted, never interpolated); CLOCK·UNSTAMPED names windows drawing by sample order because a stamp failed to parse; THIN and NO RSS name the honest refusals. The loop check is NOT re-derived here — the scenarios grid owns it.`}
        >
          THE DEATH WINDOWS · THE DYING MINUTE, DRAWN
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <span
            className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#3a4530] text-[#c9d4bd] bg-black/30 tabular-nums"
            title={`${read.windows.length} witnessed kills in the record — every one keeps its card here, including the refusals`}
          >
            {read.windows.length} WINDOWS
          </span>
          <span
            className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10 tabular-nums"
            title={`${read.drawable} windows draw full curves (≥2 finite rss samples); ${read.thin} thin (a single point); ${read.noRss} without rss (kept, named, never fabricated)`}
          >
            {read.drawable} CURVES
          </span>
          {Object.entries(read.shapesCensus)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([kind, n]) => (
              <span
                key={`shape-${kind}`}
                className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border tabular-nums ${SHAPE_CHIP_CLS[kind] ?? SHAPE_CHIP_CLS.unknown}`}
                title={`${n} window${n === 1 ? "" : "s"} classified ${kind.toUpperCase()} by the witness engine (R98) — the word and the drawn curve come from the same arithmetic`}
              >
                {n} {kind.toUpperCase()}
              </span>
            ))}
          {read.reversalsMedian != null && (
            <span
              className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10 tabular-nums"
              title={`median qualifying reversals across the windows that can carry them (both legs ≥ 5 MB) — the oscillation's own count`}
            >
              REV·MED {read.reversalsMedian}
            </span>
          )}
          {bandLo != null && bandHi != null && (
            <span
              className="vvu-label text-[7px] font-bold px-1 py-px rounded-sm border border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10 tabular-nums"
              title={`the judged ceiling cluster — ${ceiling.judged} witnessed kills' in-window peaks span ${fmt1(bandLo)}→${fmt1(bandHi)} MB (median ${fmt1(ceiling.medianCeilingMb)}). Every card shades this band; a curve inside it died in-band, the storm's own finding`}
            >
              BAND {fmt1(bandLo)}→{fmt1(bandHi)}
            </span>
          )}
        </div>
      </div>

      {/* the small multiples — shared scale, death edge aligned */}
      <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
        {read.windows.map((w) => {
          const shapeKey = w.shapeKind ?? "unknown";
          const shapeCls = SHAPE_CHIP_CLS[shapeKey] ?? SHAPE_CHIP_CLS.unknown;
          // R109 — this card's certified swings, keyed by pivot index
          const cardSwings = measureSwings(w);
          const swingByPivot = new Map(cardSwings.map((s) => [s.pivotIdx, s]));
          const cardBreath =
            cardSwings.length > 0 ? Math.max(...cardSwings.map((s) => s.swingMb)) : null;
          const ceilingDashes =
            w.maxRssMb != null && w.drawKind === "curve" ? (
              <line
                x1={padL}
                x2={W - padR}
                y1={yMb(w.maxRssMb)}
                y2={yMb(w.maxRssMb)}
                stroke={EDGE}
                strokeOpacity={0.45}
                strokeWidth={0.7}
                strokeDasharray="2 2"
              />
            ) : null;
          const tooltip = `KILL #${w.index + 1} · ${w.at} UTC — shape ${w.shapeKind?.toUpperCase() ?? "UNKNOWN"} · draw ${w.drawKind.toUpperCase()}${w.clockSpaced ? " · CLOCK·UNSTAMPED (index-spaced — a stamp failed to parse)" : ""} · ${w.samples} passes witnessed, ${w.rssSamples} with rss · window ${fmt1(w.minRssMb)}→${fmt1(w.maxRssMb)} MB · climb ${fmtClimb(w.climbMb)} (max − first) · reversals ${w.reversals ?? "—"} · span ${w.spanSec != null ? `${Math.round(w.spanSec)}s` : "no clock"} · deepest avail ${fmt1(w.minAvailMb)} MB`;
          return (
            <div
              key={`dw-${w.at}`}
              className={`rounded-sm border bg-black/20 px-1 py-1 outline-none transition-colors duration-150 hover:border-[#6b8a40]/50 focus-visible:border-[#c8ff00]/60 ${w.drawKind === "curve" ? "border-[#3a4530]/70" : "border-dashed border-[#3a4530]/70"}`}
              title={tooltip}
              tabIndex={0}
              aria-label={tooltip}
            >
              <div className="flex items-center gap-1">
                <span className="vvu-label text-[7px] font-bold text-[#7a8a6e] tabular-nums">
                  #{String(w.index + 1).padStart(2, "0")} · {hhmm(w.atMs)}Z
                </span>
                <span
                  className={`vvu-label text-[6.5px] font-bold px-1 py-px rounded-sm border ${shapeCls} tabular-nums`}
                >
                  {shapeKey.toUpperCase()}
                </span>
                {w.clockSpaced && w.drawKind === "curve" && (
                  <span className="vvu-label text-[6.5px] font-bold px-1 py-px rounded-sm border border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10">
                    CLOCK·UNSTAMPED
                  </span>
                )}
              </div>
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="mt-0.5 w-full"
                role="img"
                aria-label={tooltip}
              >
                {bandTop != null && bandBot != null && (
                  <rect
                    x={padL}
                    y={bandTop}
                    width={W - padL - padR}
                    height={Math.max(1, bandBot - bandTop)}
                    fill={BAND}
                  >
                    <title>{`judged ceiling cluster ${fmt1(bandLo)}→${fmt1(bandHi)} MB — ${ceiling.judged} witnessed kills`}</title>
                  </rect>
                )}
                {ceilingDashes}
                {w.drawKind === "curve" && !w.clockSpaced && (
                  <line
                    x1={xTime(0)}
                    x2={xTime(0)}
                    y1={padT - 3}
                    y2={H - padB}
                    stroke={EDGE}
                    strokeOpacity={0.5}
                    strokeWidth={0.8}
                  >
                    <title>{`the kill stamp (${hhmm(w.atMs)} UTC) — every clocked window ends here`}</title>
                  </line>
                )}
                {w.drawKind === "curve" &&
                  (() => {
                    const xOf = (i: number) =>
                      w.clockSpaced
                        ? padL +
                          (w.points.length === 1
                            ? 0
                            : (i / (w.points.length - 1)) * (W - padL - padR))
                        : w.points[i]!.dtSec != null
                          ? xTime(w.points[i]!.dtSec as number)
                          : null;
                    const segs: Array<Array<{ x: number; y: number }>> = [];
                    let cur: Array<{ x: number; y: number }> = [];
                    w.points.forEach((p, i) => {
                      const x = xOf(i);
                      if (p.rssMb != null && x != null) {
                        cur.push({ x, y: yMb(p.rssMb) });
                      } else if (cur.length > 0) {
                        segs.push(cur);
                        cur = [];
                      }
                    });
                    if (cur.length > 0) segs.push(cur);
                    const lastFinite = (() => {
                      for (let i = w.points.length - 1; i >= 0; i--) {
                        const x = xOf(i);
                        if (w.points[i]!.rssMb != null && x != null)
                          return { i, x, y: yMb(w.points[i]!.rssMb as number) };
                      }
                      return null;
                    })();
                    return (
                      <g>
                        {segs.map((seg, si) => (
                          <polyline
                            key={`seg-${si}`}
                            points={seg.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                            fill="none"
                            stroke={CURVE}
                            strokeWidth={1.2}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            opacity={0.9}
                          />
                        ))}
                        {w.reversalIdx.map((i) => {
                          const x = xOf(i);
                          const sw = swingByPivot.get(i);
                          return x != null ? (
                            <circle
                              key={`rev-${i}`}
                              cx={x}
                              cy={yMb(w.points[i]!.rssMb as number)}
                              r={2.1}
                              fill={REVERSAL}
                              opacity={0.95}
                            >
                              <title>
                                {sw
                                  ? `certified reversal — the breath through this pivot: rise ${sw.riseMb >= 0 ? "+" : ""}${sw.riseMb} + fall ${sw.fallMb >= 0 ? "+" : ""}${sw.fallMb} = swing ${sw.swingMb} MB`
                                  : "certified reversal"}
                              </title>
                            </circle>
                          ) : null;
                        })}
                        {lastFinite && (
                          <circle
                            cx={lastFinite.x}
                            cy={lastFinite.y}
                            r={1.6}
                            fill={EDGE}
                            opacity={0.9}
                          >
                            <title>{`the last witnessed reading before death: ${fmt1(w.lastRssMb)} MB`}</title>
                          </circle>
                        )}
                      </g>
                    );
                  })()}
                {w.drawKind === "thin" &&
                  (() => {
                    const idx = w.points.findIndex((p) => p.rssMb != null);
                    const p = w.points[idx]!;
                    const rss = p.rssMb as number;
                    const x = w.clockSpaced ? W / 2 : p.dtSec != null ? xTime(p.dtSec) : W / 2;
                    const y = yMb(rss);
                    return (
                      <g>
                        <rect
                          x={x - 2.2}
                          y={y - 2.2}
                          width={4.4}
                          height={4.4}
                          fill={CURVE}
                          transform={`rotate(45 ${x} ${y})`}
                        >
                          <title>{`THIN — the window's only finite rss reading: ${fmt1(p.rssMb)} MB. A single point is not a trajectory; the card stays, named.`}</title>
                        </rect>
                      </g>
                    );
                  })()}
                {w.drawKind === "no-rss" && (
                  <g>
                    <text
                      x={W / 2}
                      y={H / 2 - 2}
                      textAnchor="middle"
                      className="vvu-label"
                      fontSize={7}
                      fill="#5f6e55"
                    >
                      NO RSS WINDOW
                    </text>
                    <text
                      x={W / 2}
                      y={H / 2 + 8}
                      textAnchor="middle"
                      className="vvu-label"
                      fontSize={6.5}
                      fill="#5f6e55"
                    >
                      {w.samples} passes · avail {fmt1(w.minAvailMb)} MB
                    </text>
                  </g>
                )}
              </svg>
              <div
                className="vvu-label text-[6.5px] text-[#5f6e55] tabular-nums truncate"
                title={tooltip}
              >
                {w.drawKind === "curve"
                  ? `peak ${fmt1(w.maxRssMb)} · climb ${fmtClimb(w.climbMb)} · rev ${w.reversals ?? "—"}${cardBreath != null ? ` · breath ${fmt1(cardBreath)} MB` : ""} · ${w.rssSamples}p${w.spanSec != null ? ` · ${(w.spanSec / 60).toFixed(1)}m` : ""}`
                  : w.drawKind === "thin"
                    ? `single point ${fmt1(w.maxRssMb)} · ${w.samples}p · avail ${fmt1(w.minAvailMb)}`
                    : `${w.samples}p · avail ${fmt1(w.minAvailMb)} · no rss`}
              </div>
            </div>
          );
        })}
      </div>

      <p
        className="vvu-label mt-1.5 text-[7px] leading-relaxed text-[#7a8a6e]"
        data-testid="death-windows-read"
      >
        <span className="font-bold text-[#00d4e0]">THE READ · </span>
        {read.note}
      </p>
    </div>
  );
}
