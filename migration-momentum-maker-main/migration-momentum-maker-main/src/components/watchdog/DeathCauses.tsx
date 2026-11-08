"use client";

// src/components/watchdog/DeathCauses.tsx — R116 · THE DEATH-CAUSE LENS,
// the watch R115 named: the journal wrote `port` as the cause of death for
// 22 straight kills — and then the box's own memory scarcity began taking
// its turns (`avail-critical` struck four times, twice back-to-back).
//
//   the census    — every settled death grouped by the journal's own death
//                   reason; stillborn boots excluded and NAMED (never
//                   served, cannot die of a cause this lens measures), the
//                   living boot censored and named
//   the order     — the run decomposition: consecutive same-cause runs
//                   compressed to `rss×3 → port×3 → …`, the record's cause
//                   history at a glance, longest unbroken run per cause
//   the stripline — one tick per death in walk order, colored by cause,
//                   the recent window shaded behind the record's present;
//                   hover any tick for the death's pid, cause, tenure, stamp
//   the strides   — deaths between successive strikes of a cause, over the
//                   house lower-median — small strides mean the cause
//                   strikes in bunches, large strides mean it visits
//   the verdict   — the last CAUSE_RECENT_WINDOW deaths are the record's
//                   present: PORT MONOPOLY (all port) / THE FLOOR TAKES
//                   TURN (a non-port cause holds ≥ 25% of the window,
//                   INCLUSIVE edge — exactly at the line is a turn, not a
//                   visit) / PORT RULES (visits below the call) / TOO FEW
//                   (under 8 settled deaths — the refusal)
//
// THE READ is the engine's own note, verbatim.

import { useCallback, useEffect, useState } from "react";

import {
  CAUSE_MIN_DEATHS,
  CAUSE_RECENT_WINDOW,
  CAUSE_SHARE_CALL,
  CAUSE_WALK_MAX,
  SCARCITY_DEEP_LINE_MB,
  type CauseDrift,
  type CauseTwinWindow,
  type DeathCauseRead,
  type DeathCauseVerdict,
  type LeadershipRead,
  type LeadershipWord,
  type ScarcityLadder,
  type ScarcityVerdict,
} from "@/lib/death-causes";
import { useLaneHome } from "@/hooks/use-lane-home";
import { laneRereadHomeVoice, laneRereadVoice } from "@/lib/watchboard-ledger";

const CYAN = "#00d4e0";
const ROSE = "#e5484d";
const AMBER = "#e0a030";
const SAGE = "#c8ff00";
const GRAY = "#5f6e55";

function causeColor(reason: string): string {
  if (reason === "port") return CYAN;
  if (reason === "avail-critical") return AMBER;
  if (reason === "rss") return ROSE;
  return GRAY;
}

function Chip({
  label,
  tone = "neutral",
  title,
}: {
  label: string;
  tone?: "neutral" | "sage" | "cyan" | "rose" | "amber";
  title?: string;
}) {
  const toneCls =
    tone === "sage"
      ? "border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10"
      : tone === "cyan"
        ? "border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10"
        : tone === "rose"
          ? "border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10"
          : tone === "amber"
            ? "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10"
            : "border-[#3a4530] text-[#c9d4bd] bg-black/30";
  return (
    <span
      className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${toneCls} tabular-nums cursor-help transition-[filter,border-color] duration-150 hover:brightness-125`}
      title={title}
    >
      {label}
    </span>
  );
}

function verdictTone(word: DeathCauseVerdict): "neutral" | "sage" | "cyan" | "rose" | "amber" {
  switch (word) {
    case "PORT MONOPOLY":
      return "cyan";
    case "THE FLOOR TAKES TURN":
      return "amber";
    case "PORT RULES":
      return "sage";
    default:
      return "neutral";
  }
}

function scarcityTone(word: ScarcityVerdict): "neutral" | "sage" | "amber" {
  switch (word) {
    case "THE DEEP BAND IS THE FLOOR'S TURN":
      return "amber";
    case "THE DEEP BAND IS PORT COUNTRY":
      return "sage";
    default:
      return "neutral";
  }
}

function leadershipTone(word: LeadershipWord): "neutral" | "sage" | "amber" {
  switch (word) {
    case "THE PORT HAS NEVER CEDED THE MAJORITY":
      return "sage";
    case "THE FLOOR REIGNS":
    case "THE FLOOR HAS REIGNED":
      return "amber";
    default:
      return "neutral";
  }
}

/** One side of THE TWIN WINDOWS — a feed's own window, its census as
 *  cause-colored chips, its share against the call, its word. */
function TwinLane({ side }: { side: CauseTwinWindow }) {
  return (
    <div
      className="min-w-[180px] flex-1 rounded-sm border border-[#3a4530]/50 bg-black/20 px-1.5 py-1 transition-colors duration-200 hover:border-[#4a5a3e]"
      title={`${side.label}: ${side.deaths} settled death(s) on this feed, the trailing window ${side.window} wide — ${side.census.map((c) => `${c.reason} ${c.n}`).join(" + ") || "empty"} — non-port ${side.nonPort}/${side.window} = ${Math.round(side.share * 1000) / 10}% — the word: ${side.verdict}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="vvu-label text-[6px] font-bold tracking-[0.14em] text-[#5f6e55]">
          {side.label}
        </span>
        <span className="vvu-label text-[6px] text-[#5f6e55] tabular-nums">
          {side.deaths} DEATHS · WIN {side.window}
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1">
        {side.census.map((c) => (
          <span
            key={c.reason}
            className="vvu-label text-[6px] font-bold px-1 py-px rounded-sm border tabular-nums cursor-help transition-[filter,border-color] duration-150 hover:brightness-125"
            style={{
              borderColor: `${causeColor(c.reason)}66`,
              color: causeColor(c.reason),
              background: `${causeColor(c.reason)}14`,
            }}
            title={`${c.reason}: ${c.n} of the window's ${side.window} deaths`}
          >
            {c.reason} ×{c.n}
          </span>
        ))}
        <span
          className="vvu-label text-[6px] text-[#5f6e55] tabular-nums"
          title={`the feed's own non-port share: ${side.nonPort}/${side.window} = ${Math.round(side.share * 1000) / 10}% — against the ${Math.round(CAUSE_SHARE_CALL * 100)}% call`}
        >
          {Math.round(side.share * 1000) / 10}%
        </span>
      </div>
      <div className="mt-0.5">
        <span
          className={`vvu-label text-[6.5px] font-bold px-1 py-px rounded-sm border cursor-help transition-[filter,border-color] duration-150 hover:brightness-125 ${
            side.verdict === "THE FLOOR TAKES TURN"
              ? "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10"
              : side.verdict === "PORT MONOPOLY"
                ? "border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10"
                : side.verdict === "PORT RULES"
                  ? "border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10"
                  : "border-[#3a4530] text-[#c9d4bd] bg-black/30"
          }`}
        >
          {side.verdict}
        </span>
      </div>
    </div>
  );
}

/** THE STRIPLINE — one tick per death, walk order, newest last. The recent
 *  window rides on a shaded band. Ticks compress as the record grows: the
 *  lane is fixed, the record is not. */
function StrikeLine({ read, w, h }: { read: DeathCauseRead; w: number; h: number }) {
  const n = read.deathsList.length;
  const pad = 2;
  const laneW = w - pad * 2;
  const slot = n > 0 ? laneW / n : laneW;
  const tickW = Math.max(1, Math.min(5, slot - 1));
  const x = (i: number) => pad + i * slot;
  const tickH = h - 4;
  const winFrom = n - read.window;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="death cause stripline, one tick per settled death in walk order"
      data-testid="death-causes-stripline"
      className="[&_rect]:cursor-help"
    >
      {n > 0 && winFrom >= 0 && winFrom <= n && (
        <rect
          x={x(winFrom) - 0.5}
          y={0.5}
          width={Math.max(1, x(n - 1) + tickW - x(winFrom) + 1)}
          height={h - 1}
          fill="#6b8a40"
          opacity={0.14}
        >
          <title>{`the recent window: the last ${read.window} settled deaths — the record's present`}</title>
        </rect>
      )}
      {read.deathsList.map((d) => (
        <rect
          key={d.index}
          x={x(d.index)}
          y={2}
          width={tickW}
          height={tickH}
          fill={causeColor(d.reason)}
          opacity={d.index >= winFrom ? 0.95 : 0.55}
        >
          <title>{`death #${d.index + 1} · pid ${d.pid} · ${d.reason} · tenure ${Math.round(d.tenureMin * 100) / 100} min${d.deathAt ? ` · died ${d.deathAt}` : ""}${d.index >= winFrom ? " · inside the window" : ""}`}</title>
        </rect>
      ))}
    </svg>
  );
}

function fmtMin(x: number | null): string {
  return x === null ? "—" : `${Math.round(x * 100) / 100}`;
}

/** THE DRIFT LANE — R118's risk #1, instrumented (R119): the non-port share
 *  traced death by death. The walk forecasts the instrument's FUTURE under
 *  the all-port null; this lane shows its PAST as it actually happened.
 *  One bar per death (bar height = the trailing window's non-port share at
 *  that death), amber where the window read THE FLOOR TAKES TURN, dimmed
 *  in the pre-verdict zone (under CAUSE_MIN_DEATHS — the word refuses
 *  there), the 25% call and the 50% leadership line drawn as dashed rules
 *  at their own heights. Hover any bar for the death's own census. */
function DriftLane({
  drift,
  windowSize,
  w,
  h,
}: {
  drift: CauseDrift;
  /** The read's current window size — the last `windowSize` points are the
   *  deaths whose windows compose the verdict riding today (shaded band). */
  windowSize: number;
  w: number;
  h: number;
}) {
  const pts = drift.points;
  const n = pts.length;
  const pad = 2;
  const laneW = w - pad * 2;
  const slot = n > 0 ? laneW / n : laneW;
  const barW = Math.max(1, Math.min(8, slot - 1));
  const padT = 2;
  const padB = 2;
  const x = (i: number) => pad + i * slot; // i is the 0-based point index
  const y = (share: number) => h - padB - share * (h - padT - padB);
  const newest = n > 0 ? pts[n - 1]! : null;
  // The pre-verdict zone covers deaths 1 .. CAUSE_MIN_DEATHS-1 (0-based
  // point indices 0 .. CAUSE_MIN_DEATHS-2).
  const preVerdictW = Math.min(Math.max(0, CAUSE_MIN_DEATHS - 1), n) * slot;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="cause drift lane, one bar per settled death showing the trailing window's non-port share"
      data-testid="death-causes-drift-lane"
      className="[&_rect]:cursor-help"
    >
      {preVerdictW > 0 && (
        <rect x={pad} y={0.5} width={preVerdictW} height={h - 1} fill="#3a4530" opacity={0.25}>
          <title>{`the pre-verdict zone: deaths #1–#${CAUSE_MIN_DEATHS - 1} — under ${CAUSE_MIN_DEATHS} settled deaths the verdict refuses, so these windows carry no word (drawn dimmed, not hidden)`}</title>
        </rect>
      )}
      {windowSize > 0 && n > windowSize && (
        <rect
          x={x(n - windowSize)}
          y={0.5}
          width={Math.max(1, w - pad - x(n - windowSize))}
          height={h - 1}
          fill="#6b8a40"
          opacity={0.12}
        >
          <title>{`the current window's membership: the last ${windowSize} deaths — the points whose trailing windows are still alive in the verdict's arithmetic`}</title>
        </rect>
      )}
      {n >= CAUSE_MIN_DEATHS && (
        <line
          x1={pad + Math.min(CAUSE_MIN_DEATHS - 1, n) * slot}
          x2={pad + Math.min(CAUSE_MIN_DEATHS - 1, n) * slot}
          y1={0.5}
          y2={h - 0.5}
          stroke={GRAY}
          strokeWidth={0.6}
          strokeDasharray="2 2"
          opacity={0.7}
        >
          <title>{`death #${CAUSE_MIN_DEATHS} — the verdict's first breath: the first window large enough for the lens to speak`}</title>
        </line>
      )}
      {/* the 50% leadership line — past it the floor out-numbers the port */}
      <line
        x1={1}
        x2={w - 1}
        y1={y(0.5)}
        y2={y(0.5)}
        stroke={ROSE}
        strokeWidth={0.75}
        strokeDasharray="3 3"
        opacity={0.75}
      >
        <title>{`the 50% leadership line — a window whose non-port share rides past it is a window where the box's scarcity OUT-NUMBERS the port: the floor's era question answered yes, for that window`}</title>
      </line>
      {/* the 25% call line — the turn's own edge */}
      <line
        x1={1}
        x2={w - 1}
        y1={y(CAUSE_SHARE_CALL)}
        y2={y(CAUSE_SHARE_CALL)}
        stroke={AMBER}
        strokeWidth={0.75}
        strokeDasharray="1.5 2.5"
        opacity={0.8}
      >
        <title>{`the ${Math.round(CAUSE_SHARE_CALL * 100)}% call (INCLUSIVE edge — at the line is a turn, not a visit); bars at or over it are windows that read THE FLOOR TAKES TURN`}</title>
      </line>
      {pts.map((p, i) => {
        const turn = p.verdictAt === "THE FLOOR TAKES TURN";
        const preVerdict = p.verdictAt === "TOO FEW";
        const fill = turn ? AMBER : preVerdict ? "#3a4530" : GRAY;
        const barH = Math.max(1, h - padB - y(p.share));
        return (
          <rect
            key={p.deathIndex}
            x={x(i) + (slot - barW) / 2}
            y={y(p.share)}
            width={barW}
            height={barH}
            fill={fill}
            opacity={preVerdict ? 0.5 : turn ? 0.95 : 0.75}
          >
            <title>{`death #${p.deathIndex} · window ${p.window} · non-port ${p.nonPort}/${p.window} = ${Math.round(p.share * 1000) / 10}%${p.leads ? " · PAST THE 50% LEADERSHIP LINE — the floor leads this window" : ""} · the word then: ${p.verdictAt}`}</title>
          </rect>
        );
      })}
      {newest && (
        <rect
          x={x(n - 1) + (slot - barW) / 2 - 1}
          y={y(newest.share) - 1}
          width={barW + 2}
          height={Math.max(2, h - padB - y(newest.share)) + 1}
          fill="none"
          stroke={SAGE}
          strokeWidth={0.8}
          opacity={0.9}
        >
          <title>{`the newest point — death #${newest.deathIndex}: the window the verdict reads today (${newest.nonPort}/${newest.window} = ${Math.round(newest.share * 1000) / 10}%)`}</title>
        </rect>
      )}
    </svg>
  );
}

/** R123 — THE LEADERSHIP LENS's lane. THE DRIFT's binarization, drawn on
 *  the SAME points: one cell per death, amber where the trailing window
 *  rode PAST the 50% leadership line (the floor out-numbered the port),
 *  slate where it did not, dimmed in the pre-verdict zone. The reigns —
 *  maximal runs of leading windows — are underlined beneath the lane so a
 *  reign reads as one held stretch, not a scatter of lit cells. */
function ReignLane({
  drift,
  leadership,
  w = 560,
  h = 40,
}: {
  drift: CauseDrift;
  leadership: LeadershipRead;
  w?: number;
  h?: number;
}) {
  const pts = drift.points;
  const n = pts.length;
  const pad = 2;
  const laneW = w - pad * 2;
  const slot = n > 0 ? laneW / n : laneW;
  const barW = Math.max(1, Math.min(8, slot - 1));
  const underlineY = h - 4;
  const x = (i: number) => pad + i * slot;
  const preVerdictW = Math.min(Math.max(0, CAUSE_MIN_DEATHS - 1), n) * slot;
  const newestEligible = pts.length > 0 ? pts[pts.length - 1]! : null;
  const newestIsEligible = newestEligible != null && newestEligible.verdictAt !== "TOO FEW";

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="leadership lane, one cell per settled death: amber where the trailing window's non-port share rode past the 50% leadership line"
      data-testid="death-causes-leadership-lane"
      className="[&_rect]:cursor-help"
    >
      {preVerdictW > 0 && (
        <rect x={pad} y={0.5} width={preVerdictW} height={h - 6} fill="#3a4530" opacity={0.25}>
          <title>{`the pre-verdict zone: deaths #1–#${CAUSE_MIN_DEATHS - 1} — a window under ${CAUSE_MIN_DEATHS} deaths is arithmetic trivia, not the era question's answer (the drift's own peak rule, cut again)`}</title>
        </rect>
      )}
      {pts.map((p, i) => {
        const eligible = p.verdictAt !== "TOO FEW";
        const fill = !eligible ? "#3a4530" : p.leads ? AMBER : GRAY;
        const opacity = !eligible ? 0.35 : p.leads ? 0.95 : 0.5;
        const cellH = h - 7;
        return (
          <rect
            key={p.deathIndex}
            x={x(i) + (slot - barW) / 2}
            y={2}
            width={barW}
            height={cellH}
            fill={fill}
            opacity={opacity}
          >
            <title>{`death #${p.deathIndex} · window ${p.window} · non-port ${p.nonPort}/${p.window} = ${Math.round(p.share * 1000) / 10}%${p.leads ? " · PAST THE 50% LEADERSHIP LINE — a leading window" : eligible ? " — the port leads this window" : " — pre-verdict (drawn dimmed, never counted)"}`}</title>
          </rect>
        );
      })}
      {leadership.reigns.map((r) => {
        const x0 = x(r.fromDeath - 1);
        const x1 = x(r.toDeath - 1) + barW;
        return (
          <g key={`reign-${r.index}`}>
            <rect
              x={x0}
              y={underlineY}
              width={Math.max(2, x1 - x0)}
              height={2.5}
              fill={AMBER}
              opacity={0.9}
            >
              <title>{`reign #${r.index}: ${r.length} consecutive leading window(s), death #${r.fromDeath} → #${r.toDeath}, peak ${Math.round(r.peakShare * 1000) / 10}% — the floor HOLDING the majority, not visiting it`}</title>
            </rect>
          </g>
        );
      })}
      {newestIsEligible && newestEligible && (
        <rect
          x={x(n - 1) + (slot - barW) / 2 - 1}
          y={1}
          width={barW + 2}
          height={h - 7}
          fill="none"
          stroke={SAGE}
          strokeWidth={0.8}
          opacity={0.9}
        >
          <title>{`the newest eligible window — death #${newestEligible.deathIndex}: ${newestEligible.nonPort}/${newestEligible.window} = ${Math.round(newestEligible.share * 1000) / 10}% ${newestEligible.leads ? "— THE FLOOR REIGNS NOW" : "— the port still leads"}`}</title>
        </rect>
      )}
    </svg>
  );
}

/** R121 — THE SCARCITY LADDER's lane. One bar per judged witnessed death,
 *  ranked deepest-first (rank 1 on the left), bar height = the dying
 *  window's own minAvail — so the SHORTEST bars are the deepest scarcity,
 *  and the deep band hugs the floor as a shaded strip under the dashed
 *  deep line. Amber bars are avail-critical (dimmed above the line — the
 *  outlier is drawn, never hidden); slate bars are everything else. */
function LadderLane({
  ladder,
  w = 560,
  h = 96,
}: {
  ladder: ScarcityLadder;
  w?: number;
  h?: number;
}) {
  const rungs = ladder.ladder;
  const n = rungs.length;
  if (n === 0) return null;
  const padB = 3;
  const padT = 8; // headroom for the deep-line label
  const max = Math.max(...rungs.map((d) => d.minAvailMb), ladder.deepLineMb);
  const slot = (w - 2) / n;
  const barW = Math.max(2, Math.min(10, slot - 1.5));
  const y = (v: number) => h - padB - (v / max) * (h - padB - padT);
  const lineY = y(ladder.deepLineMb);
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="the scarcity ladder — witnessed deaths ranked by the depth of their dying window"
      className="[&_rect]:cursor-help"
    >
      {/* the deep band: shaded below the line — the floor's own territory */}
      <rect x={1} y={lineY} width={w - 2} height={h - padB - lineY} fill={AMBER} opacity={0.08}>
        <title>{`the deep band — minAvail ≤ ${ladder.deepLineMb} MB: ${ladder.deepN} death(s) (${ladder.deepAcN} avail-critical · ${ladder.deepPortN} port${ladder.deepOtherN > 0 ? ` · ${ladder.deepOtherN} other` : ""})`}</title>
      </rect>
      <line
        x1={1}
        x2={w - 1}
        y1={lineY}
        y2={lineY}
        stroke={AMBER}
        strokeWidth={0.75}
        strokeDasharray="3 3"
        opacity={0.8}
      >
        <title>{`the deep-scarcity line (${ladder.deepLineMb} MB, first calibration from the record itself — five of six avail-critical strikes sit under 146)`}</title>
      </line>
      <text x={4} y={lineY - 2.5} fontSize={6} fill={AMBER} opacity={0.85} className="vvu-label">
        DEEP LINE {ladder.deepLineMb} MB
      </text>
      {rungs.map((d) => {
        const deep = d.minAvailMb <= ladder.deepLineMb;
        const ac = d.cause === "avail-critical";
        const top = y(d.minAvailMb);
        return (
          <g key={d.rank}>
            <rect
              x={1 + (d.rank - 1) * slot + (slot - barW) / 2}
              y={top}
              width={barW}
              height={Math.max(1, h - padB - top)}
              fill={ac ? AMBER : "#3a4530"}
              opacity={ac ? (deep ? 0.95 : 0.4) : deep ? 0.85 : 0.55}
              className="transition-opacity duration-150"
            >
              <title>{`rank #${d.rank} · ${d.at} · ${d.cause} · minAvail ${d.minAvailMb} MB${d.maxRssMb != null ? ` · maxRss ${d.maxRssMb} MB` : ""}${deep ? " · IN THE DEEP BAND" : ""}`}</title>
            </rect>
            {d.rank === 1 && (
              <rect
                x={1 + (d.rank - 1) * slot + (slot - barW) / 2 - 1}
                y={top - 1}
                width={barW + 2}
                height={Math.max(2, h - padB - top) + 1}
                fill="none"
                stroke={SAGE}
                strokeWidth={0.8}
                opacity={0.9}
              >
                <title>{`the record's deepest scarcity — ${d.minAvailMb} MB, ${d.cause}, ${d.at}`}</title>
              </rect>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function DeathCauses() {
  const [read, setRead] = useState<DeathCauseRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // R183 · THE LANES' RETURN: the asked read's home-flash state — the
  // R181 idiom, lane-sized (one hook, five lanes). The mount and the
  // 60s self-read never announce; a failed read never reaches the
  // announcement — the completion belongs to the click.
  const { justRead, homeAt, announceHome } = useLaneHome();

  const refetch = useCallback(
    async (announce?: boolean) => {
      setBusy(true);
      try {
        const res = await fetch("/api/estate/death-causes", { cache: "no-store" });
        const body = await res.json();
        if (res.ok && body?.ok) {
          setRead(body.read as DeathCauseRead);
          setError(null);
          if (announce) announceHome();
        } else {
          setError(String(body?.error ?? `HTTP ${res.status}`));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "death-cause fetch failed");
      } finally {
        setBusy(false);
      }
    },
    [announceHome],
  );

  useEffect(() => {
    void refetch();
    const t = setInterval(() => void refetch(), 60_000);
    return () => clearInterval(t);
  }, [refetch]);

  if (!read && !error) return null;

  const windowSplit =
    read && read.window > 0
      ? read.causes
          .filter((c) => c.recentN > 0)
          .map((c) => `${c.reason} ${c.recentN}`)
          .join(" · ")
      : "";
  const maxShare = read && read.causes.length ? Math.max(...read.causes.map((c) => c.share)) : 1;

  return (
    <div
      className="mt-1.5 rounded-sm border border-[#3a4530]/60 bg-black/20 p-2"
      data-testid="death-causes"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p
          className="vvu-label text-[7.5px] font-bold tracking-[0.18em] text-[#7a8a6e]"
          title={`R115's risk #1, instrumented: for 22 kills the journal wrote port as the cause of death — then the box's own memory scarcity began taking its turns (avail-critical struck four times, twice back-to-back). THE LENS reads the same bounce journal as THE BOOT LEDGER (one parse, many readers): the census by the journal's own death reason (stillborn excluded and named — never served, cannot die of a cause this lens measures; the living boot censored), the run decomposition of the death order, per-cause strike strides over the house lower-median, and the shift verdict: the last ${"12"} settled deaths are the window — PORT MONOPOLY (all port) / THE FLOOR TAKES TURN (a non-port cause holds ≥ 25% of the window, INCLUSIVE edge) / PORT RULES (visits below the call) / TOO FEW (under 8 settled deaths). R119's DRIFT LANE: the non-port share traced death by death — the walk's mirror, showing the instrument's past as it actually happened, with the 25% call and the 50% leadership line drawn (past 50%, the floor's scarcity out-numbers the port — the floor's era question answered for that window).`}
        >
          THE DEATH-CAUSE LENS · WHO KILLS THE PORT
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {read && (
            <>
              <Chip
                tone="rose"
                label={`${read.deaths} DEATHS`}
                title={`${read.deaths} settled deaths counted (deceased && served). Excluded and named: ${read.stillbornExcluded} stillborn (never served), ${read.livingCensored} living (censored), ${read.unjournaledExcluded} unjournaled (tenure unknown).`}
              />
              <Chip
                label={`${read.causes.length} CAUSES`}
                title={`the journal's own death reasons on the record: ${read.causes.map((c) => `${c.reason} (${c.n})`).join(" · ")}`}
              />
              {windowSplit && (
                <Chip
                  tone="cyan"
                  label={`WINDOW ${read.window} — ${windowSplit}`}
                  title={`the last ${read.window} settled deaths — the record's present: ${windowSplit}`}
                />
              )}
              <Chip
                tone={verdictTone(read.verdict)}
                label={read.verdict}
                title={read.verdictReason}
              />
            </>
          )}
          <button
            type="button"
            onClick={() => void refetch(true)}
            disabled={busy}
            aria-busy={busy}
            aria-label={laneRereadVoice("the lens", busy)}
            className={`vvu-label text-[7px] font-bold px-1.5 py-px rounded-sm border bg-black/30 transition-colors duration-150 disabled:opacity-50 outline-none ${justRead && !busy ? "border-[#c8ff00]/60 text-[#c8ff00] shadow-[0_0_6px_rgba(200,255,0,0.3)]" : busy ? "border-[#e0a030]/60 text-[#e0a030]" : "border-[#3a4530] text-[#c9d4bd] hover:border-[#6b8a40]/60 hover:text-[#c8ff00] focus-visible:border-[#c8ff00]"}`}
            title="read the lens now — the panel also re-reads every 60s; the journal is append-only and the lens reads it fresh, no store in between. R182 · THE LANES' VOICES: the button's state rides its aria — the offer and the in-flight read, heard without hovering; the read in flight wears the amber. R183 · THE LANES' RETURN: a clicked read that lands speaks its home line once — the lane's own arrival stamp in the house's UTC voice — and wears the lime for 2.6s; the unasked passes (mount, the 60s self-read) and a failed read stay silent — the completion belongs to the click."
          >
            {busy ? "READING…" : "REREAD"}
          </button>
          <span aria-live="polite" className="sr-only">
            {justRead && !busy && homeAt ? laneRereadHomeVoice("the lens", homeAt) : ""}
          </span>
        </div>
      </div>

      {error && (
        <p className="vvu-label mt-1.5 text-[7px] text-[#e5484d]" data-testid="death-causes-error">
          THE LENS IS UNREADABLE · {error} — the lens refuses to invent a census
        </p>
      )}

      {read && read.deaths > 0 && (
        <>
          <div className="mt-1.5">
            <div className="flex items-center gap-2">
              <span className="vvu-label text-[6.5px] font-bold tracking-[0.14em] text-[#5f6e55]">
                THE STRIPLINE · ONE TICK PER DEATH
              </span>
              <span
                className="vvu-label text-[6.5px] text-[#5f6e55]"
                title="tick colors are the journal's own death reasons; the shaded band behind the newest ticks is the recent window — the record's present the verdict reads"
              >
                {read.causes.map((c) => (
                  <span key={c.reason} className="ml-1.5 whitespace-nowrap">
                    <span style={{ color: causeColor(c.reason) }}>■</span> {c.reason}
                  </span>
                ))}
              </span>
            </div>
            <div className="mt-0.5 overflow-x-auto">
              <StrikeLine read={read} w={560} h={14} />
            </div>
            <span className="vvu-label text-[6px] text-[#5f6e55]">
              oldest → newest · shaded band = the last {read.window} deaths (the window)
            </span>
          </div>

          <div className="mt-1 overflow-x-auto" data-testid="death-causes-table">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="vvu-label text-[6.5px] font-bold tracking-[0.14em] text-[#5f6e55]">
                  <th className="text-left py-0.5 pr-2 font-bold">CAUSE</th>
                  <th className="text-left py-0.5 px-2 font-bold">DEATHS / SHARE</th>
                  <th className="text-right py-0.5 px-2 font-bold">TENURE MED (MIN–MAX)</th>
                  <th className="text-right py-0.5 px-2 font-bold">IN WINDOW</th>
                  <th className="text-right py-0.5 px-2 font-bold">LONGEST RUN</th>
                  <th className="text-left py-0.5 pl-2 font-bold">STRIDES</th>
                </tr>
              </thead>
              <tbody>
                {read.causes.map((c) => (
                  <tr
                    key={c.reason}
                    tabIndex={0}
                    title={`${c.reason} — ${c.n} deaths, ${Math.round(c.share * 10000) / 100}% of the record · strikes at death #${(c.firstIndex ?? 0) + 1} → #${(c.lastIndex ?? 0) + 1} (${c.firstAt ?? "—"} → ${c.lastAt ?? "—"}) · house lower-median throughout`}
                    aria-label={`${c.reason} cause row`}
                    className="vvu-label text-[7.5px] text-[#c9d4bd] tabular-nums outline-none transition-colors duration-150 hover:bg-[#6b8a40]/5 focus-visible:bg-[#6b8a40]/10"
                  >
                    <td
                      className="py-0.5 pr-2 text-left whitespace-nowrap font-bold"
                      style={{ color: causeColor(c.reason) }}
                    >
                      {c.reason}
                    </td>
                    <td className="py-0.5 px-2 text-left whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span>
                          {c.n} · {Math.round(c.share * 1000) / 10}%
                        </span>
                        <span
                          className="inline-block h-[5px] rounded-sm transition-all duration-300"
                          style={{
                            width: `${Math.max(2, (c.share / (maxShare || 1)) * 64)}px`,
                            background: causeColor(c.reason),
                          }}
                          title={`share bar — ${c.n} of ${read.deaths} deaths (${Math.round(c.share * 10000) / 100}%), scaled against the record's leading cause (${Math.round(maxShare * 1000) / 10}%)`}
                        />
                      </span>
                    </td>
                    <td className="text-right py-0.5 px-2 whitespace-nowrap">
                      {fmtMin(c.medianTenureMin)}
                      <span className="text-[#5f6e55] ml-1">
                        ({fmtMin(c.minTenureMin)}–{fmtMin(c.maxTenureMin)})
                      </span>
                    </td>
                    <td className="text-right py-0.5 px-2">
                      {c.recentN}/{read.window}
                    </td>
                    <td className="text-right py-0.5 px-2">{c.longestRun || "—"}</td>
                    <td className="py-0.5 pl-2 text-left whitespace-nowrap">
                      {c.strides ? (
                        <>
                          {c.strides.join(", ")}
                          <span className="text-[#5f6e55] ml-1">
                            (lower-median {c.medianStride})
                          </span>
                        </>
                      ) : (
                        <span className="text-[#5f6e55]">single strike</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {read.runs.length > 1 && (
            <p
              className="vvu-label mt-1 text-[6.5px] leading-relaxed text-[#7a8a6e]"
              data-testid="death-causes-runs"
            >
              <span className="font-bold text-[#5f6e55]">THE ORDER · </span>
              {read.runs.map((r, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-[#5f6e55]"> → </span>}
                  <span
                    className="font-bold"
                    style={{ color: causeColor(r.reason) }}
                    title={`run of ${r.length} ${r.reason} death(s), deaths #${r.fromIndex + 1} → #${r.toIndex + 1} in walk order`}
                  >
                    {r.reason}×{r.length}
                  </span>
                </span>
              ))}
            </p>
          )}

          {read.verdict !== "TOO FEW" && (
            <div
              className="mt-1.5 rounded-sm border border-[#3a4530]/50 bg-black/20 px-2 py-1.5 transition-colors duration-200 hover:border-[#4a5a3e]"
              data-testid="death-causes-walk"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p
                  className="vvu-label text-[6.5px] font-bold tracking-[0.14em] text-[#5f6e55]"
                  title={`R116's risk #2, instrumented: the verdict sits on the window's own edge, and this walk names how much of it is edge. THE NULL WALK simulates k more deaths (k = 0..${read.sensitivity.steps.length > 1 ? read.sensitivity.steps.length - 1 : "N"} shown), every one port — the record's dominant killer — and recomputes the verdict at each step. It is a forecast of the INSTRUMENT, never of the record: no death is predicted, only how much of today's word survives a return to business as usual. The trajectory strip below is that walk, one chip per simulated death, stopping at the flip (a forecast past its own flip teaches nothing the flip does not).`}
                >
                  THE WALK · IF EVERY FUTURE DEATH IS PORT
                </p>
                <div className="ml-auto flex flex-wrap items-center gap-1">
                  {read.sensitivity.holdsK === null ? (
                    <Chip
                      tone="sage"
                      label={`HOLDS PAST THE ${read.sensitivity.steps.length - 1}-DEATH BOUND`}
                      title={`under the all-port null the verdict still reads ${read.verdict} at every simulated step up to the walk's bound — the turn is not the window's edge, it is the record's own recent history`}
                    />
                  ) : (
                    <>
                      <Chip
                        tone="amber"
                        label={`HOLDS ${read.sensitivity.holdsK} MORE`}
                        title={`under the all-port null, today's verdict ${read.verdict} survives ${read.sensitivity.holdsK} more simulated death(s) before the window's arithmetic moves`}
                      />
                      <Chip
                        tone={read.sensitivity.nextVerdict === "PORT MONOPOLY" ? "cyan" : "sage"}
                        label={`THEN ${read.sensitivity.nextVerdict}`}
                        title={`the word the walk flips to once the window's non-port strikes have aged out — ${read.sensitivity.note}`}
                      />
                    </>
                  )}
                  <Chip
                    label={`WINDOW #${read.sensitivity.windowFromDeath}–#${read.sensitivity.windowToDeath}`}
                    title={`the window's own edge, in 1-based death numbers: death #${read.sensitivity.windowFromDeath} exits first, death #${read.sensitivity.windowToDeath} is the newest`}
                  />
                </div>
              </div>
              <div
                className="mt-1 flex flex-wrap items-center gap-1"
                data-testid="death-causes-walk-strip"
              >
                {read.sensitivity.steps.map((s) => (
                  <span
                    key={s.k}
                    className={`vvu-label text-[6px] font-bold px-1 py-px rounded-sm border tabular-nums cursor-help transition-[filter,border-color] hover:brightness-125 ${
                      s.verdict === "THE FLOOR TAKES TURN"
                        ? "border-[#e0a030]/60 text-[#e0a030] bg-[#e0a030]/10"
                        : s.verdict === "PORT MONOPOLY"
                          ? "border-[#00d4e0]/60 text-[#00d4e0] bg-[#00d4e0]/10"
                          : s.verdict === "PORT RULES"
                            ? "border-[#6b8a40]/60 text-[#c8ff00] bg-[#6b8a40]/10"
                            : "border-[#3a4530] text-[#c9d4bd] bg-black/30"
                    }`}
                    title={`after ${s.k} simulated all-port death(s): the window reads ${s.verdict}${s.k === 0 ? " — today, no simulation" : ""}`}
                  >
                    +{s.k}·
                    {s.verdict === "THE FLOOR TAKES TURN"
                      ? "TURN"
                      : s.verdict === "PORT MONOPOLY"
                        ? "MONOPOLY"
                        : s.verdict === "PORT RULES"
                          ? "RULES"
                          : "TOO FEW"}
                  </span>
                ))}
              </div>
              {read.sensitivity.exits.filter((e) => e.cause !== "port").length > 0 && (
                <p className="vvu-label mt-1 text-[6px] leading-relaxed text-[#7a8a6e]">
                  <span className="font-bold text-[#5f6e55]">THE EXITS · </span>
                  {read.sensitivity.exits
                    .filter((e) => e.cause !== "port")
                    .map((e, i) => (
                      <span key={i}>
                        {i > 0 && <span className="text-[#5f6e55]"> · </span>}
                        <span style={{ color: causeColor(e.cause) }}>
                          {e.cause} pid {e.pid} leaves at death #{e.exitsAtDeath}
                        </span>
                      </span>
                    ))}
                  <span className="text-[#5f6e55]"> — the window's memory of them, dated</span>
                </p>
              )}
            </div>
          )}

          {read.verdict !== "TOO FEW" && read.ascent.challenger && (
            <div
              className="mt-1.5 rounded-sm border border-[#3a4530]/50 bg-black/20 px-2 py-1.5 transition-colors duration-200 hover:border-[#4a5a3e]"
              data-testid="death-causes-ascent"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p
                  className="vvu-label text-[6.5px] font-bold tracking-[0.14em] text-[#5f6e55] cursor-help"
                  title={`R125's instrument — the walk's mirror on the challenger's side. THE NULL WALK simulates every future death port and asks how long today's word HOLDS; THE ASCENT simulates every future death the FLOOR'S (the window's leading non-port cause${read.ascent.challengerFrom === "record" ? " — the window is all port, the record's newest non-port cause stands in" : ""}) and asks how far the record stands from the floor LEADING the window. Where the null walk's share only falls, the ascent's share only rises — a turn can never un-turn under it, so the events to stop at are a word FLIP (a visit record's turn arriving) or the STRICT LEADERSHIP crossing (past 50% — exactly half is a tie, the leadership lens's own line). Both events are computed over the full ${CAUSE_WALK_MAX}-strike bound; the strip draws only to the first (a forecast past its first crossing teaches nothing the crossing does not). Like the walk it forecasts the INSTRUMENT, never the record: no strike is predicted, only how far the window's own arithmetic stands from the line.`}
                >
                  THE ASCENT · IF EVERY FUTURE DEATH IS{" "}
                  {read.ascent.challenger.replace(/-/g, " ").toUpperCase()}
                </p>
                <div className="ml-auto flex flex-wrap items-center gap-1">
                  {read.ascent.leadsK !== null ? (
                    <Chip
                      tone="amber"
                      label={`LEADS AT +${read.ascent.leadsK} · ${Math.round(read.ascent.leadsShare! * 1000) / 10}%`}
                      title={`under the challenger null, the simulated window's non-port OUT-NUMBERS the port at +${read.ascent.leadsK} strike(s) — ${Math.round(read.ascent.leadsShare! * 1000) / 10}% of it, past the strict 50% line. ${read.ascent.note}`}
                    />
                  ) : (
                    <Chip
                      tone="sage"
                      label={`NO LEAD INSIDE THE ${CAUSE_WALK_MAX}-STRIKE BOUND`}
                      title={`the challenger's arithmetic cannot lead the window inside the ascent's bound — said out loud, never implied. ${read.ascent.note}`}
                    />
                  )}
                  {read.ascent.flipK !== null && (
                    <Chip
                      tone="cyan"
                      label={`FLIPS AT +${read.ascent.flipK}`}
                      title={`a visit record's turn arrives: the word flips ${read.verdict} → ${read.ascent.flipWord} at +${read.ascent.flipK} simulated strike(s) — ${read.ascent.note}`}
                    />
                  )}
                  <Chip
                    label={`CHALLENGER · ${read.ascent.challenger.replace(/-/g, " ").toUpperCase()} (${read.ascent.challengerFrom === "record" ? "RECORD" : "WINDOW"})`}
                    title={`the simulated challenger: the window's leading non-port cause${read.ascent.challengerFrom === "record" ? " — the window carries none, the record's newest stands in (said, never silent)" : " (n desc, name asc — the census's own sort)"}`}
                  />
                </div>
              </div>
              <div
                className="mt-1 flex flex-wrap items-center gap-1"
                data-testid="death-causes-ascent-strip"
              >
                {read.ascent.steps.map((s) => (
                  <span
                    key={s.k}
                    className={`vvu-label text-[6px] font-bold px-1 py-px rounded-sm border tabular-nums cursor-help transition-[filter,border-color] hover:brightness-125 ${
                      s.leads
                        ? "border-[#e0a030] text-[#e0a030] bg-[#e0a030]/20"
                        : "border-[#3a4530] text-[#c9d4bd] bg-black/30"
                    }`}
                    title={`after ${s.k} simulated ${read.ascent.challenger} strike(s): the window's non-port share reads ${Math.round(s.share * 1000) / 10}%${s.leads ? " — PAST the strict 50% line, the floor leads this window" : s.share === 0.5 ? " — exactly half: a tie, not a lead (the strict line)" : ""} · the word reads ${s.verdict}`}
                  >
                    +{s.k}·{Math.round(s.share * 100)}%
                  </span>
                ))}
              </div>
              <p className="vvu-label mt-1 text-[6px] leading-relaxed text-[#7a8a6e] cursor-help">
                {read.ascent.note}
              </p>
            </div>
          )}

          {read.drift.points.length > 0 && (
            <div
              className="mt-1.5 rounded-sm border border-[#3a4530]/50 bg-black/20 px-2 py-1.5 transition-colors duration-200 hover:border-[#4a5a3e]"
              data-testid="death-causes-drift"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p
                  className="vvu-label text-[6.5px] font-bold tracking-[0.14em] text-[#5f6e55]"
                  title={`R118's risk #1, instrumented (R119): the floor's era question — is the box's scarcity becoming the LEADING killer? — drawn as the record's own past. THE DRIFT traces the trailing window's non-port share at EVERY death: one bar per death, bar height = the share the call line reads at that point, amber where the window read THE FLOOR TAKES TURN, dimmed in the pre-verdict zone (under ${CAUSE_MIN_DEATHS} deaths — the word refuses there). Two dashed rules ride at their own heights: the ${Math.round(CAUSE_SHARE_CALL * 100)}% call (the turn's edge, INCLUSIVE) and the 50% leadership line (past it, non-port deaths OUT-NUMBER port in the trailing window — the era question answered yes, for that window). The walk forecasts the instrument's future under the null; the drift shows its past — the two together are the full edge picture.`}
                >
                  THE DRIFT · THE NON-PORT SHARE, DEATH BY DEATH
                </p>
                <div className="ml-auto flex flex-wrap items-center gap-1">
                  {read.drift.peak && (
                    <Chip
                      tone="amber"
                      label={`PEAK ${Math.round(read.drift.peak.share * 1000) / 10}% @ #${read.drift.peak.deathIndex}`}
                      title={`the record's highest trailing non-port share: ${Math.round(read.drift.peak.share * 1000) / 10}% of the trailing window, standing at death #${read.drift.peak.deathIndex}`}
                    />
                  )}
                  <Chip
                    label={`${read.drift.turnDeaths} TURN DEATH${read.drift.turnDeaths === 1 ? "" : "S"}`}
                    title={`deaths whose trailing window read THE FLOOR TAKES TURN — the share of the record's own history that has lived under the turn's word`}
                  />
                  {read.drift.lastCrossing != null ? (
                    <Chip
                      tone="cyan"
                      label={`LAST CROSSING #${read.drift.lastCrossing}`}
                      title={`the latest entry into turn territory: the window at death #${read.drift.lastCrossing} read the turn right after one that did not — dated, not implied`}
                    />
                  ) : (
                    <Chip
                      label="NO CROSSING"
                      title="no window has ever ridden the turn on this record — the non-port share has never reached the call"
                    />
                  )}
                </div>
              </div>
              <div className="mt-1 overflow-x-auto">
                <DriftLane drift={read.drift} windowSize={read.window} w={560} h={44} />
              </div>
              <span className="vvu-label text-[6px] text-[#5f6e55]">
                oldest → newest · dimmed zone = pre-verdict (under {CAUSE_MIN_DEATHS} deaths the
                word refuses) · shaded band = the last {read.window} deaths (the current window's
                membership) · amber dashed = the {Math.round(CAUSE_SHARE_CALL * 100)}% call · rose
                dashed = the 50% leadership line (past it the floor leads the killing) · sage
                outline = the newest point
              </span>
            </div>
          )}

          {read.drift.points.length > 0 && read.leadership && (
            <div
              className="mt-1.5 rounded-sm border border-[#3a4530]/50 bg-black/20 px-2 py-1.5 transition-colors duration-200 hover:border-[#4a5a3e]"
              data-testid="death-causes-leadership"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p
                  className="vvu-label text-[6.5px] font-bold tracking-[0.14em] text-[#5f6e55]"
                  title={`R122's open question, instrumented (R123): the verdict's call line (25%, inclusive) reads the floor's VISITS; the drift's leadership line (50%, STRICT) reads the floor's MAJORITY — the era question's stronger form. THE LEADERSHIP LENS is the drift's own binarization, derived from the SAME points (one parse, many readers — the twin's lesson), so it can never disagree with the lane it reads. A REIGN is a maximal run of consecutive leading windows: the floor HOLDING the majority across deaths, not visiting it. The CLOSEST approach says how far the floor has climbed when the answer is no. Eligibility is the drift's own peak rule: a sub-${CAUSE_MIN_DEATHS}-death window at 100% is arithmetic trivia, not the era question's answer.`}
                >
                  THE LEADERSHIP LENS · HAS THE FLOOR EVER OUT-NUMBERED THE PORT?
                </p>
                <div className="ml-auto flex flex-wrap items-center gap-1">
                  <Chip
                    tone={leadershipTone(read.leadership.word)}
                    label={read.leadership.word}
                    title={read.leadership.note}
                  />
                  <Chip
                    label={
                      read.leadership.reigns.length === 0
                        ? "ZERO REIGNS"
                        : `${read.leadership.reigns.length} REIGN${read.leadership.reigns.length === 1 ? "" : "S"}`
                    }
                    title={`reigns = maximal runs of consecutive leading windows — ${read.leadership.leadWindows} leading window(s) across ${read.leadership.eligibleDeaths} eligible on this record`}
                  />
                  {read.leadership.reigningNow ? (
                    <Chip
                      tone="amber"
                      label={`REIGNING NOW · ${read.leadership.longest ? `PEAK ${Math.round(read.leadership.reigns[read.leadership.reigns.length - 1]!.peakShare * 1000) / 10}%` : ""}`}
                      title="the newest eligible window's non-port out-numbers the port — the floor holds the majority as of the record's present"
                    />
                  ) : (
                    read.leadership.longest && (
                      <Chip
                        label={`LONGEST ${read.leadership.longest.length} WIN · #${read.leadership.longest.fromDeath}–#${read.leadership.longest.toDeath}`}
                        title={`the longest reign: ${read.leadership.longest.length} consecutive leading window(s), death #${read.leadership.longest.fromDeath} → #${read.leadership.longest.toDeath}, peak ${Math.round(read.leadership.longest.peakShare * 1000) / 10}% (ties read the earliest)`}
                      />
                    )
                  )}
                  {read.leadership.deathsSinceReign != null && !read.leadership.reigningNow && (
                    <Chip
                      label={`DROUGHT ${read.leadership.deathsSinceReign}`}
                      title={`eligible deaths since the newest reign ended — the drought is dated, not implied`}
                    />
                  )}
                  {read.leadership.closest && (
                    <Chip
                      tone="cyan"
                      label={`CLOSEST ${Math.round(read.leadership.closest.share * 1000) / 10}% @ #${read.leadership.closest.deathIndex}`}
                      title={`the highest share any eligible window has ridden (ties → the earliest) — how far the floor has climbed toward the majority`}
                    />
                  )}
                  <Chip
                    label={`NEEDS ${read.leadership.needInFullWindow}/${CAUSE_RECENT_WINDOW}`}
                    title={`non-port deaths a FULL ${CAUSE_RECENT_WINDOW}-window needs for leadership — PAST half (exactly half is a tie, not a lead: the drift's own strict > rule)`}
                  />
                </div>
              </div>
              <div className="mt-1 overflow-x-auto">
                <ReignLane drift={read.drift} leadership={read.leadership} w={560} h={40} />
              </div>
              <span className="vvu-label text-[6px] text-[#5f6e55]">
                oldest → newest · one cell per death · amber = a leading window (PAST the 50% line —
                the drift lane&apos;s own cells, binarized) · slate = the port leads · dimmed =
                pre-verdict (drawn, never counted) · amber underline = a reign (the run HELD, not
                scattered) · sage outline = the newest eligible window
              </span>
              <p className="vvu-label mt-1 text-[6px] leading-relaxed text-[#7a8a6e]">
                {read.leadership.note}
              </p>
            </div>
          )}

          {read.twin && read.twin.witness && (
            <div
              className="mt-1.5 rounded-sm border border-[#3a4530]/50 bg-black/20 px-2 py-1.5 transition-colors duration-200 hover:border-[#4a5a3e]"
              data-testid="death-causes-twin"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p
                  className="vvu-label text-[6.5px] font-bold tracking-[0.14em] text-[#5f6e55]"
                  title={`R119's risk #2, instrumented (R120): the record has TWO honest feeds. THE LEDGER counts every journaled settled death (the boot ledger's walk — this read's own census). THE WITNESS carries only the kills the guardian sampled with a memory witness window (the 20s-interval feed the rhythm instruments read). THE TWIN applies the SAME window rules to BOTH — the same ${"12"}, the same ${"25"}% call, the same words — so whatever the two reads say differently is the window's own population, named here instead of left mysterious. A thin window refuses the comparison and says so: a word from TOO FEW cannot be compared, only named.`}
                >
                  THE TWIN WINDOWS · THE LEDGER AND THE WITNESS
                </p>
                <div className="ml-auto flex flex-wrap items-center gap-1">
                  {read.twin.agree === null ? (
                    <Chip
                      label="NOT COMPARABLE"
                      title="one side's window is TOO FEW — a thin window cannot be compared, only named (said in the read)"
                    />
                  ) : read.twin.agree ? (
                    <Chip
                      tone="sage"
                      label={`AGREE — ${read.twin.ledger.verdict}`}
                      title={`both feeds read ${read.twin.ledger.verdict} — the word holds across populations (the shares still differ; read them)`}
                    />
                  ) : (
                    <Chip
                      tone="amber"
                      label="DISAGREE"
                      title={`the ledger reads ${read.twin.ledger.verdict}, the witness reads ${read.twin.witness.verdict} — same record, two feeds: the divergence is the window's own population, not a contradiction`}
                    />
                  )}
                </div>
              </div>
              <div className="mt-1 flex flex-wrap items-stretch gap-1.5">
                <TwinLane side={read.twin.ledger} />
                <TwinLane side={read.twin.witness} />
              </div>
              <p className="vvu-label mt-1 text-[6px] leading-relaxed text-[#7a8a6e]">
                {read.twin.note}
              </p>
            </div>
          )}

          {read.scarcity && read.scarcity.judged > 0 && (
            <div
              className="mt-1.5 rounded-sm border border-[#3a4530]/50 bg-black/20 px-2 py-1.5 transition-colors duration-200 hover:border-[#4a5a3e]"
              data-testid="death-causes-scarcity"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p
                  className="vvu-label text-[6.5px] font-bold tracking-[0.14em] text-[#5f6e55]"
                  title={`R121 — the depth question the drift and the twin cannot answer: HOW DEEP was the floor when the floor took its turns? Every witnessed death's dying window carries its own minAvail (the lowest host memory the guardian's 20s sampling saw before the kernel struck). THE LADDER ranks the judged deaths deepest-first — the SHORTEST bars are the deepest scarcity — and draws the deep band at ${SCARCITY_DEEP_LINE_MB} MB (first calibration from the record itself: five of the six avail-critical strikes sit under 146 MB). The band's ac:port ratio against the rest of the record is the condensation the era question reads. An avail-critical strike above the line is drawn dimmed and named in the read — the band is a tendency the record drew, not a law the journal obeys. Rows without a finite avail reading are excluded and named (a depth cannot be read from what was never sampled).`}
                >
                  THE SCARCITY LADDER · THE FLOOR&apos;S DEPTH GAUGE
                </p>
                <div className="ml-auto flex flex-wrap items-center gap-1">
                  <Chip
                    tone={scarcityTone(read.scarcity.verdict)}
                    label={read.scarcity.verdict}
                    title={read.scarcity.verdictReason}
                  />
                  <Chip
                    tone="amber"
                    label={`DEEP BAND ${read.scarcity.deepN} · ${read.scarcity.deepAcN} AC`}
                    title={`deaths at/below the ${read.scarcity.deepLineMb} MB line: ${read.scarcity.deepN} (${read.scarcity.deepAcN} avail-critical · ${read.scarcity.deepPortN} port${read.scarcity.deepOtherN > 0 ? ` · ${read.scarcity.deepOtherN} other` : ""}) — the band is INCLUSIVE (at the line is in the band, the call line's own convention)`}
                  />
                  {read.scarcity.deepestAcMb != null && (
                    <Chip
                      tone="amber"
                      label={`DEEPEST AC ${read.scarcity.deepestAcMb} MB`}
                      title={`the lowest host memory an avail-critical strike ever bottomed at on the witnessed record`}
                    />
                  )}
                  {read.scarcity.deepestPortMb != null && (
                    <Chip
                      label={`DEEPEST PORT ${read.scarcity.deepestPortMb} MB`}
                      title={`the lowest host memory a port kill ever bottomed at on the witnessed record`}
                    />
                  )}
                  {read.scarcity.aboveAcN > 0 && (
                    <Chip
                      label={`${read.scarcity.aboveAcN} AC ABOVE THE LINE`}
                      title={`avail-critical strikes above the ${read.scarcity.deepLineMb} MB line — the band's exceptions, drawn dimmed and named in the read: a tendency, not a law`}
                    />
                  )}
                </div>
              </div>
              <div className="mt-1 overflow-x-auto">
                <LadderLane ladder={read.scarcity} w={560} h={96} />
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="vvu-label text-[6px] text-[#5f6e55]">
                  deepest → shallowest · bar height = the dying window&apos;s own minAvail (shortest
                  = deepest scarcity) · amber = avail-critical (dimmed above the line — the outlier
                  drawn, never hidden) · slate = the rest · shaded floor = the deep band (≤{" "}
                  {read.scarcity.deepLineMb} MB) · sage outline = the record&apos;s deepest scarcity
                </span>
                {read.scarcity.deepAcShare != null && read.scarcity.aboveAcShare != null && (
                  <span
                    className="vvu-label text-[6px] text-[#e0a030] tabular-nums"
                    title={`the condensation: the avail-critical share of deaths below the deep line vs above it — ${Math.round(read.scarcity.deepAcShare * 1000) / 10}% below vs ${Math.round(read.scarcity.aboveAcShare * 1000) / 10}% above`}
                  >
                    THE CONDENSATION · {Math.round(read.scarcity.deepAcShare * 1000) / 10}% BELOW VS{" "}
                    {Math.round(read.scarcity.aboveAcShare * 1000) / 10}% ABOVE
                  </span>
                )}
              </div>
              <p className="vvu-label mt-1 text-[6px] leading-relaxed text-[#7a8a6e]">
                {read.scarcity.note}
              </p>
            </div>
          )}
        </>
      )}

      {read && read.deaths === 0 && (
        <p className="vvu-label mt-1.5 text-[7px] text-[#e0a030]">
          no settled deaths yet — the census waits for the record's first death (the living boot is
          censored, not counted)
        </p>
      )}

      {read && (
        <p
          className="vvu-label mt-1.5 text-[7px] leading-relaxed text-[#7a8a6e]"
          data-testid="death-causes-read"
        >
          <span className="font-bold" style={{ color: AMBER }}>
            THE READ ·{" "}
          </span>
          {read.note}
        </p>
      )}
    </div>
  );
}
