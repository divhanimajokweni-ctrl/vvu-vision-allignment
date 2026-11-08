"use client";

// src/components/watchdog/LatencyMemory.tsx — R114 · THE LATENCY MEMORY,
// the latency ledger remembered — the machine that answers R110's standing
// question.
//
// R110 read the estate's request side; its handover left one question
// open: is the heavy route's p95 COMPILE-COLD (a one-time compile cost) or
// STEADY-HEAVY (a finding for the operator)? One window cannot answer it.
// This panel reads the MEMORY — a bounded store of ledger snapshots, one
// per read (same-window reads refused), each carrying the window's shape,
// the estate percentiles, the respawn count, and the hot top-8's p95s.
//
//   the quiet read — a snapshot whose window carries ZERO ▲ Next.js boot
//                    banners; the record's own vocabulary for "no recompile
//                    storm here", never a wall-time claim
//   the verdict   — the route's p95 in quiet reads vs noisy reads, over
//                    the house lower-median: COMPILE-COLD (collapses to ≤
//                    half without compiles) / STEADY-HEAVY (keeps ≥ 3/4,
//                    or ≥ 2× the estate's own quiet p95 with no noisy
//                    history — the strongest form) / MIXED (between the
//                    lines) / CALM (quiet-only and not heavy) / TOO FEW
//                    (the quiet hour has not arrived — the refusal)
//   the sparkline — the estate's p95 and each tracked route's p95 across
//                    snapshots; sage dots are quiet reads, cyan-stroked
//                    dots noisy; gaps are honest (a route that fell out of
//                    the hot list is skipped, never interpolated)
//
// THE READ is the engine's own note, verbatim.

import { useCallback, useEffect, useState } from "react";

import { useLaneHome } from "@/hooks/use-lane-home";

import type { LatencyMemoryRead, LatencyVerdict } from "@/lib/latency-memory";
import { laneRereadHomeVoice, laneRereadVoice } from "@/lib/watchboard-ledger";

const SAGE = "#c8ff00";
const CYAN = "#00d4e0";
const ROSE = "#e5484d";
const AMBER = "#e0a030";
const GRAY = "#5f6e55";

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
      className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border cursor-help transition-[filter,border-color] duration-150 hover:brightness-125 ${toneCls} tabular-nums`}
      title={title}
    >
      {label}
    </span>
  );
}

function verdictTone(word: LatencyVerdict["word"]): "neutral" | "sage" | "cyan" | "rose" | "amber" {
  switch (word) {
    case "COMPILE-COLD":
      return "cyan";
    case "STEADY-HEAVY":
      return "rose";
    case "MIXED":
      return "amber";
    case "CALM":
      return "sage";
    default:
      return "neutral";
  }
}

function fmtClock(ms: number): string {
  return new Date(ms).toISOString().slice(11, 19);
}

interface SparkPoint {
  v: number | null;
  quiet: boolean;
  atMs: number;
}

/** The trend sparkline — polyline through consecutive non-null points,
 *  sage-filled dots on quiet reads, stroked dots on noisy, honest gaps. */
function Spark({
  series,
  w,
  h,
  color = CYAN,
}: {
  series: Array<SparkPoint>;
  w: number;
  h: number;
  color?: string;
}) {
  const vals = series.filter((p) => p.v != null).map((p) => p.v as number);
  const max = vals.length > 0 ? Math.max(...vals) : 1;
  const pad = 3;
  const n = series.length;
  const x = (i: number) => (n <= 1 ? w / 2 : pad + (i / (n - 1)) * (w - pad * 2));
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);

  const segs: string[] = [];
  let cur: string[] = [];
  series.forEach((p, i) => {
    if (p.v != null) cur.push(`${x(i).toFixed(1)},${y(p.v).toFixed(1)}`);
    else if (cur.length > 0) {
      segs.push(cur.join(" "));
      cur = [];
    }
  });
  if (cur.length > 0) segs.push(cur.join(" "));

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="p95 trend across snapshots"
      className="[&_circle]:cursor-help"
    >
      {segs.map((s, i) => (
        <polyline key={i} points={s} fill="none" stroke={color} strokeWidth={1} opacity={0.8} />
      ))}
      {series.map((p, i) =>
        p.v == null ? null : (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.v)}
            r={1.7}
            fill={p.quiet ? SAGE : "#0a0f08"}
            stroke={p.quiet ? SAGE : color}
            strokeWidth={1}
          >
            <title>{`${fmtClock(p.atMs)} UTC · p95 ${p.v} ms · ${p.quiet ? "QUIET (no respawn in window)" : "noisy (respawns in window)"}`}</title>
          </circle>
        ),
      )}
    </svg>
  );
}

export function LatencyMemory() {
  const [mem, setMem] = useState<LatencyMemoryRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [storeReset, setStoreReset] = useState(false);

  // R183 · THE LANES' RETURN: the asked read's home-flash state — the
  // R181 idiom, lane-sized (one hook, five lanes). The mount and the
  // 60s self-read never announce; a failed read never reaches the
  // announcement — the completion belongs to the click.
  const { justRead, homeAt, announceHome } = useLaneHome();

  const refetch = useCallback(
    async (announce?: boolean) => {
      setBusy(true);
      try {
        const res = await fetch("/api/estate/latency-memory", { cache: "no-store" });
        const body = await res.json();
        if (res.ok && body?.ok) {
          setMem(body.memory as LatencyMemoryRead);
          setStoreReset(body.storeReset === true);
          setError(null);
          if (announce) announceHome();
        } else {
          setError(String(body?.error ?? `HTTP ${res.status}`));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "latency memory fetch failed");
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

  if (!mem && !error) return null;

  const answered = mem ? mem.tracked.filter((v) => v.word !== "TOO FEW").length : 0;
  // The heaviest route leads the table (it is the R110 question's subject);
  // the rest keep the hot list's own order. Bounded: tracked ≤ 9 by design.
  const trendRows = mem
    ? [
        ...(mem.latestHeaviestLabel
          ? mem.tracked.filter((v) => v.label === mem.latestHeaviestLabel)
          : []),
        ...mem.tracked.filter((v) => v.label !== mem.latestHeaviestLabel),
      ].slice(0, 6)
    : [];
  const trendFor = (label: string) => mem?.trends.find((t) => t.label === label)?.points ?? [];

  return (
    <div
      className="mt-1.5 rounded-sm border border-[#3a4530]/60 bg-black/20 p-2"
      data-testid="latency-memory"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p
          className="vvu-label text-[7.5px] font-bold tracking-[0.18em] text-[#7a8a6e]"
          title={`R110's standing question, answered by the record itself: is the heavy route's p95 COMPILE-COLD (a one-time compile cost a fresh window would not repeat) or STEADY-HEAVY (a finding for the operator to act on)? THE MEMORY is a bounded store of ledger snapshots — one per read (a read closer than 30s to the last is the SAME window and is refused), each carrying the window shape, the estate percentiles, the respawn count, and the hot top-8's p50/p95. A QUIET read is a window with ZERO respawn banners — the log's own vocabulary for no recompile storm, never a wall-time claim. The verdict compares the route's quiet p95 against its noisy p95 over the house lower-median: COMPILE-COLD at ≤ ${"0.5"}×, STEADY-HEAVY at ≥ ${"0.75"}× (or ≥ 2× the estate's own quiet p95 median when noisy history is too thin — heavy with no respawn anywhere near, the strongest form), MIXED between the lines, CALM when quiet-only and not heavy, TOO FEW until the quiet hour arrives. The store holds the last 360 snapshots (≈ 6h at the 60s cadence); trends are sliced to the last 60 points per route.`}
        >
          THE LATENCY MEMORY · THE R110 QUESTION
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {mem && (
            <>
              <Chip
                tone="cyan"
                label={`${mem.snapshots} SNAPSHOT${mem.snapshots === 1 ? "" : "S"}`}
                title={`${mem.snapshots} ledger snapshot(s) in the bounded store (cap 360, ≈ 6h at the 60s cadence). One snapshot per read; a read within 30s of the last is the same window and changes nothing.`}
              />
              {mem.snapshots > 1 && mem.spanMs != null && (
                <Chip
                  label={`SPAN ${(mem.spanMs / 60_000).toFixed(1)} MIN`}
                  title={`newest minus oldest snapshot: ${(mem.spanMs / 1000).toFixed(0)} s — real clock, carried by the snapshots themselves (the ledger's window still invents no clock)`}
                />
              )}
              <Chip
                tone={mem.quietReads > 0 ? "sage" : "neutral"}
                label={`${mem.quietReads} QUIET`}
                title={`${mem.quietReads} of ${mem.snapshots} snapshot(s) are QUIET: a window with zero ▲ Next.js boot banners — no respawn, no forced recompile storm. Quiet is the log's own vocabulary, not a wall-time claim.`}
              />
              {mem.tracked.length > 0 && (
                <Chip
                  tone={answered > 0 ? "cyan" : "neutral"}
                  label={`${answered}/${mem.tracked.length} ANSWERED`}
                  title={`${answered} of ${mem.tracked.length} tracked routes carry a verdict; the rest read TOO FEW — the quiet hour has not arrived. Tracked = the latest frame's hot top-8 plus its heaviest.`}
                />
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => void refetch(true)}
            disabled={busy}
            aria-busy={busy}
            aria-label={laneRereadVoice("the memory", busy)}
            className={`vvu-label text-[7px] font-bold px-1.5 py-px rounded-sm border bg-black/30 transition-colors duration-150 disabled:opacity-50 outline-none ${justRead && !busy ? "border-[#c8ff00]/60 text-[#c8ff00] shadow-[0_0_6px_rgba(200,255,0,0.3)]" : busy ? "border-[#e0a030]/60 text-[#e0a030]" : "border-[#3a4530] text-[#c9d4bd] hover:border-[#6b8a40]/60 hover:text-[#c8ff00] focus-visible:border-[#c8ff00]"}`}
            title="read the memory now — the panel also re-reads every 60s; a read within 30s of the last snapshot is the same window and is refused (disclosed in the response's appended field). R182 · THE LANES' VOICES: the button's state rides its aria — the offer and the in-flight read, heard without hovering; the read in flight wears the amber. R183 · THE LANES' RETURN: a clicked read that lands speaks its home line once — the lane's own arrival stamp in the house's UTC voice — and wears the lime for 2.6s; the unasked passes (mount, the 60s self-read) and a failed read stay silent — the completion belongs to the click."
          >
            {busy ? "READING…" : "REREAD"}
          </button>
          <span aria-live="polite" className="sr-only">
            {justRead && !busy && homeAt ? laneRereadHomeVoice("the memory", homeAt) : ""}
          </span>
        </div>
      </div>

      {error && (
        <p
          className="vvu-label mt-1.5 text-[7px] text-[#e5484d]"
          data-testid="latency-memory-error"
        >
          THE MEMORY IS UNREADABLE · {error} — the memory refuses to invent a read
        </p>
      )}

      {storeReset && (
        <p
          className="vvu-label mt-1.5 text-[7px] text-[#e0a030]"
          data-testid="latency-memory-reset"
        >
          THE STORE RESET — the previous memory file was corrupt, so the memory starts over and says
          so instead of pretending
        </p>
      )}

      {mem && mem.snapshots > 0 && (
        <>
          {/* R118 — THE QUIET HOUR LANE: the ANSWERED chip's countdown, drawn.
              The verdicts need MIN_QUIET_READS quiet reads; the trailing
              streak — consecutive quiet snapshots ending at the newest —
              is how close the record stands. Ticks fill left to right; any
              noisy read resets the streak (trailing means trailing).
              R124 — the ANSWERED state: when the streak reaches the need the
              lane flips sage and names what the record said (the subject's
              word first, the house's distribution after); while it waits,
              THE CHURN CLOCK speaks — the observed banner-exit cadence and
              the honest ETA, an estimate that says so. */}
          <div
            className={`mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm border px-2 py-1 transition-colors duration-200 hover:border-[#4a5a3e] ${
              mem.quietAnswer.answered
                ? "border-[#6b8a40]/50 bg-[#6b8a40]/5"
                : "border-[#3a4530]/40 bg-black/10"
            }`}
            data-testid="latency-memory-quiet-lane"
          >
            <span
              className={`vvu-label text-[6.5px] font-bold tracking-[0.14em] ${
                mem.quietAnswer.answered ? "text-[#c8ff00]" : "text-[#5f6e55]"
              }`}
              title={`THE QUIET HOUR — the R110 answer's own countdown. A verdict needs ${mem.quiet.quietNeeded} quiet reads (windows with zero ▲ Next.js boot banners); the trailing streak counts consecutive quiet snapshots ENDING at the newest — a quiet hour that was interrupted counts only what survives at the record's present end. Ticks fill left to right as the streak grows; any noisy read resets it to zero. The streak counts snapshots, never wall-time.${
                mem.quietAnswer.answered
                  ? ` THE ANSWERED STATE: the hour has arrived — ${mem.quietAnswer.line}`
                  : ""
              }`}
            >
              {mem.quietAnswer.answered
                ? "THE QUIET HOUR · ANSWERED"
                : `THE QUIET HOUR · STREAK ${mem.quiet.quietStreak}/${mem.quiet.quietNeeded}`}
            </span>
            <span
              className="inline-flex items-center gap-1"
              aria-label={`quiet streak ${mem.quiet.quietStreak} of ${mem.quiet.quietNeeded}`}
            >
              {Array.from({ length: mem.quiet.quietNeeded }).map((_, i) => (
                <span
                  key={i}
                  className="inline-block h-[7px] w-[7px] cursor-help rounded-full border transition-colors duration-300"
                  style={{
                    borderColor: i < mem.quiet.quietStreak ? SAGE : GRAY,
                    background: i < mem.quiet.quietStreak ? SAGE : "transparent",
                    boxShadow: i < mem.quiet.quietStreak ? `0 0 4px ${SAGE}55` : "none",
                  }}
                  title={
                    i < mem.quiet.quietStreak
                      ? `quiet read ${i + 1} of the streak — counted`
                      : `quiet read ${i + 1} — not yet; the streak needs ${mem.quiet.quietNeeded - mem.quiet.quietStreak} more`
                  }
                />
              ))}
            </span>
            {mem.quietAnswer.answered ? (
              <>
                {mem.quietAnswer.subjectWord != null ? (
                  <Chip
                    tone={verdictTone(mem.quietAnswer.subjectWord)}
                    label={`SUBJECT SAYS ${mem.quietAnswer.subjectWord}`}
                    title={`the R110 question's subject — ${mem.quietAnswer.subjectLabel}, the latest frame's heaviest route — speaks: ${mem.quietAnswer.subjectWord}. The subject's own quiet p95 medians decided it; the chip rides the same verdict the table shows.`}
                  />
                ) : (
                  <Chip
                    tone="neutral"
                    label="SUBJECT SILENT"
                    title={`the subject ${mem.quietAnswer.subjectLabel ?? "(none in the latest frame)"} carries no verdict yet — TOO FEW quiet reads where it appears in the hot list. The house speaks; the subject's silence is honest.`}
                  />
                )}
                <span
                  className="vvu-label text-[6px] text-[#c9d4bd] tabular-nums"
                  title="the house's word distribution in the severity order — STEADY-HEAVY leads (the operator's call to action), TOO FEW trails (the refusals)"
                >
                  HOUSE · {mem.quietAnswer.words.map((w) => `${w.n} ${w.word}`).join(" · ")}
                </span>
              </>
            ) : (
              <>
                {mem.quiet.liveQuiet ? (
                  <Chip
                    tone="amber"
                    label="LIVE QUIET"
                    title={`the newest window is QUIET right now (0 respawn banners) — the streak is live at the record's newest end, and every further quiet read extends it`}
                  />
                ) : (
                  <Chip
                    label={`NEWEST WINDOW · ${mem.quiet.newestRespawns} RESPAWN${mem.quiet.newestRespawns === 1 ? "" : "S"}`}
                    title={`the newest window carried ${mem.quiet.newestRespawns} ▲ Next.js boot banner(s) — that is why the streak waits; quiet is the log's own vocabulary (a window with zero banners), not a wall-time claim`}
                  />
                )}
                <Chip
                  tone={mem.churn.etaMin != null && mem.churn.etaMin > 0 ? "amber" : "neutral"}
                  label={
                    mem.churn.etaMin != null && mem.churn.etaMin > 0
                      ? `CHURN · ETA ~${Math.round(mem.churn.etaMin)} MIN`
                      : mem.churn.bannersRemaining === 0
                        ? "CHURN · NO BANNER LEFT"
                        : "CHURN · REFUSED"
                  }
                  title={`${mem.churn.line}${
                    mem.churn.etaMin != null && mem.churn.etaMin > 0
                      ? ` — the arithmetic: ${mem.churn.exitsObserved} exits observed across the memory (median gap ~${mem.churn.medianExitGapMin != null ? (Math.round(mem.churn.medianExitGapMin * 10) / 10).toFixed(1) : "—"} min / ~${mem.churn.medianExitGapReads ?? "—"} read(s)), ${mem.churn.bannersRemaining} banner(s) still in the newest window, ETA = remaining × median gap. An estimate from the observed cadence, never a promise — a new respawn (a kill, a manual restart) adds banners and resets it.`
                      : ""
                  }`}
                />
              </>
            )}
            <span className="vvu-label text-[6px] text-[#5f6e55]">
              {mem.quietAnswer.answered
                ? mem.quietAnswer.line
                : mem.quiet.quietStreak >= mem.quiet.quietNeeded
                  ? "the verdicts speak — a noisy read resets the streak"
                  : `${mem.quiet.quietNeeded - mem.quiet.quietStreak} more quiet read(s) and a verdict speaks · any noisy read resets`}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex items-center gap-1.5">
              <span className="vvu-label text-[6.5px] font-bold tracking-[0.14em] text-[#5f6e55]">
                ESTATE P95
              </span>
              <Spark
                series={mem.estateP95Series.map((p) => ({
                  v: p.p95Ms,
                  quiet: p.quiet,
                  atMs: p.atMs,
                }))}
                w={200}
                h={34}
              />
              <span className="vvu-label text-[7px] text-[#c9d4bd] tabular-nums">
                {mem.estateP95Series.length > 0
                  ? `${mem.estateP95Series[mem.estateP95Series.length - 1]!.p95Ms ?? "—"} ms now`
                  : ""}
              </span>
            </div>
            <span
              className="vvu-label text-[6.5px] text-[#5f6e55]"
              title="sage-filled dots are quiet reads (no respawn banner in the window); stroked dots are noisy; the line breaks where a snapshot's p95 is absent — honest gaps, never interpolated"
            >
              ● sage = quiet · ○ stroked = noisy
            </span>
          </div>

          <div className="mt-1 overflow-x-auto" data-testid="latency-memory-table">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="vvu-label text-[6.5px] font-bold tracking-[0.14em] text-[#5f6e55]">
                  <th className="text-left py-0.5 pr-2 font-bold">ROUTE</th>
                  <th className="text-left py-0.5 px-2 font-bold">VERDICT</th>
                  <th className="text-right py-0.5 px-2 font-bold">QUIET·NOISY</th>
                  <th className="text-right py-0.5 px-2 font-bold">Q/NOISY P95</th>
                  <th className="text-left py-0.5 pl-2 font-bold">TREND</th>
                </tr>
              </thead>
              <tbody>
                {trendRows.map((v) => {
                  const pts = trendFor(v.label);
                  const ratioTxt =
                    v.ratio != null
                      ? `${Math.round(v.ratio * 100)}%`
                      : v.quietMedP95 != null &&
                          v.estateQuietMedP95 != null &&
                          v.estateQuietMedP95 > 0
                        ? `${(v.quietMedP95 / v.estateQuietMedP95).toFixed(1)}× estate`
                        : "—";
                  return (
                    <tr
                      key={v.label}
                      tabIndex={0}
                      title={`${v.label} — ${v.word}: ${v.reason} · quiet median p95 ${v.quietMedP95 ?? "—"} ms over ${v.quietCount} quiet read(s) · noisy median p95 ${v.noisyMedP95 ?? "—"} ms over ${v.noisyCount} noisy read(s) · house lower-median throughout · trend: ${pts.length} point(s), gaps honest`}
                      aria-label={`${v.label} verdict ${v.word}`}
                      className="vvu-label text-[7.5px] text-[#c9d4bd] tabular-nums outline-none transition-colors duration-150 hover:bg-[#6b8a40]/5 focus-visible:bg-[#6b8a40]/10"
                    >
                      <td
                        className="py-0.5 pr-2 font-mono text-left truncate max-w-[200px]"
                        title={v.label}
                      >
                        {v.label}
                      </td>
                      <td className="py-0.5 px-2 text-left whitespace-nowrap">
                        <Chip tone={verdictTone(v.word)} label={v.word} title={v.reason} />
                      </td>
                      <td className="text-right py-0.5 px-2">
                        {v.quietCount}·{v.noisyCount}
                      </td>
                      <td className="text-right py-0.5 px-2">
                        {v.quietMedP95 != null ? Math.round(v.quietMedP95 * 10) / 10 : "—"}
                        {" / "}
                        {v.noisyMedP95 != null ? Math.round(v.noisyMedP95 * 10) / 10 : "—"}
                        <span className="text-[#5f6e55] ml-1">({ratioTxt})</span>
                      </td>
                      <td className="py-0.5 pl-2">
                        <Spark
                          series={pts.map((p) => ({ v: p.p95Ms, quiet: p.quiet, atMs: p.atMs }))}
                          w={120}
                          h={18}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {mem.tracked.length > trendRows.length && (
            <p className="vvu-label mt-1 text-[6.5px] text-[#5f6e55] tabular-nums">
              +{mem.tracked.length - trendRows.length} more tracked route(s) — named in THE READ,
              verdicts identical in kind
            </p>
          )}
        </>
      )}

      {mem && (
        <p
          className="vvu-label mt-1.5 text-[7px] leading-relaxed text-[#7a8a6e]"
          data-testid="latency-memory-read"
        >
          <span className="font-bold" style={{ color: CYAN }}>
            THE READ ·{" "}
          </span>
          {mem.note}
        </p>
      )}
    </div>
  );
}
