"use client";

// src/components/watchdog/LatencyLedger.tsx — R110 · THE LATENCY LEDGER,
// the estate's request side, finally read.
//
// Every panel above reads the memory storm — what the estate COSTS. This
// reads what the estate SERVES: the dev log's own request lines (the
// tee -a append that survives every respawn), parsed through the shared
// latency-ledger engine into per-route counts, status censuses, and
// latency distributions with the compile-vs-render split the dev server
// itself reports.
//
//   the window  — a LINE-COUNT window, never a clock window: the log
//                 carries no timestamps and the chip says so; the last
//                 4000 lines are the honest span
//   the table   — the hot list (top routes by requests), each row the
//                 route's census and distribution; focusable rows with
//                 the full arithmetic in the tooltip
//   the 404s    — non-200 statuses are COUNTED AND NAMED (external
//                 transform-header probes are part of the estate's life)
//                 — never averaged into a green share
//   the respawns— ▲ Next.js boot banners inside the window: the dev
//                 server's own restarts, visible in the log
//
// THE READ is the engine's own note, verbatim.

import { useCallback, useEffect, useState } from "react";

import { useLaneHome } from "@/hooks/use-lane-home";
import type { LatencyLedgerRead, RouteRead } from "@/lib/latency-ledger";
import { laneRereadHomeVoice, laneRereadVoice } from "@/lib/watchboard-ledger";

const SAGE = "#c8ff00";
const CYAN = "#00d4e0";
const ROSE = "#e5484d";
const AMBER = "#e0a030";

function fmt(v: number | null): string {
  return v == null ? "—" : `${Math.round(v * 10) / 10}`;
}

function statusTone(statuses: Record<string, number>): { cls: string; label: string } | null {
  const nonOk = Object.entries(statuses).filter(([s]) => s !== "200");
  if (nonOk.length === 0) return null;
  return {
    cls: "border-[#e5484d]/60 text-[#e5484d] bg-[#e5484d]/10",
    label: nonOk
      .sort((a, b) => b[1] - a[1])
      .map(([s, n]) => `${n}×${s}`)
      .join(" "),
  };
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
      className={`vvu-label text-[7px] font-bold px-1 py-px rounded-sm border ${toneCls} tabular-nums cursor-help transition-[filter,border-color] hover:brightness-125`}
      title={title}
    >
      {label}
    </span>
  );
}

export function LatencyLedger() {
  const [read, setRead] = useState<LatencyLedgerRead | null>(null);
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
        const res = await fetch("/api/estate/latency", { cache: "no-store" });
        const body = await res.json();
        if (res.ok && body?.ok) {
          setRead(body.ledger as LatencyLedgerRead);
          setError(null);
          if (announce) announceHome();
        } else {
          setError(String(body?.error ?? `HTTP ${res.status}`));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "latency ledger fetch failed");
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

  const rows: Array<RouteRead> = read ? read.routes.slice(0, 8) : [];
  const nonOkRoutes: Array<RouteRead> = read
    ? read.routes.filter((r) => r.nonOk > 0).slice(0, 6)
    : [];

  return (
    <div
      className="mt-1.5 rounded-sm border border-[#3a4530]/60 bg-black/20 p-2 transition-colors duration-200 hover:border-[#4a5a3e]"
      data-testid="latency-ledger"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p
          className="vvu-label text-[7.5px] font-bold tracking-[0.18em] text-[#7a8a6e]"
          title={`the estate's request side, read from the dev log's own request lines (the tee -a append that survives every respawn). The window is a LINE-COUNT window — last ${read?.windowLines ?? 4000} lines — never a clock window: the log carries no timestamps and the ledger discloses that instead of inventing one. Per route: the request count, the status census, the latency distribution (nearest-rank p50/p95/max) and the compile-vs-render split the dev server itself reports (µs converted, full precision, rounded once at the edge). Routes keep the log's own method × path grain — a query string strips, nothing else is normalized. Non-200s are counted and named; boot banners count as respawns; context lines are counted, never dropped silently.`}
        >
          THE LATENCY LEDGER · WHAT SERVING COSTS
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {read && (
            <>
              <Chip
                label={`${read.windowLines} LINE WINDOW`}
                title={`the last ${read.windowLines} lines of dev.log — a line-count window, not a clock window (the log carries no timestamps); ${read.linesIn} non-empty, ${read.contextLines} context (banners/compiles), ${read.parsed} request lines parsed`}
              />
              <Chip
                tone="sage"
                label={`${read.totalRequests} REQUESTS`}
                title={`${read.totalRequests} requests across ${read.routeCount} route entries (method × path grain)`}
              />
              <Chip
                tone="cyan"
                label={`P50 ${fmt(read.p50Ms)} · P95 ${fmt(read.p95Ms)} MS`}
                title={`whole-window latency: p50 ${fmt(read.p50Ms)} ms · p95 ${fmt(read.p95Ms)} ms · max ${fmt(read.maxMs)} ms (nearest-rank percentiles)`}
              />
              {read.nonOkTotal > 0 ? (
                <Chip
                  tone="rose"
                  label={`${read.nonOkTotal} NON-200`}
                  title={`${read.nonOkTotal} non-200 responses in the window — ${Object.entries(
                    read.statuses,
                  )
                    .filter(([s]) => s !== "200")
                    .map(([s, n]) => `${n}×${s}`)
                    .join(", ")} — named in the table below, never averaged into a green share`}
                />
              ) : (
                <Chip
                  tone="sage"
                  label="ALL 200"
                  title="every request in the window returned 200"
                />
              )}
              {read.compileSharePct != null && (
                <Chip
                  tone="amber"
                  label={`COMPILE ${read.compileSharePct}%`}
                  title={`of the latency measured on split lines, ${read.compileSharePct}% is compile time (the dev server's own report; ${read.noSplitTotal} line(s) without a split counted in the NO SPLIT lane)`}
                />
              )}
              {read.respawns > 0 && (
                <Chip
                  label={`${read.respawns} RESPAWN${read.respawns === 1 ? "" : "S"}`}
                  title={`${read.respawns} ▲ Next.js boot banner(s) inside the window — the dev server's own restarts, visible in the log`}
                />
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => void refetch(true)}
            disabled={busy}
            aria-busy={busy}
            aria-label={laneRereadVoice("the log tail", busy)}
            className={`vvu-label text-[7px] font-bold px-1.5 py-px rounded-sm border bg-black/30 transition-colors duration-150 disabled:opacity-50 outline-none ${justRead && !busy ? "border-[#c8ff00]/60 text-[#c8ff00] shadow-[0_0_6px_rgba(200,255,0,0.3)]" : busy ? "border-[#e0a030]/60 text-[#e0a030]" : "border-[#3a4530] text-[#c9d4bd] hover:border-[#6b8a40]/60 hover:text-[#c8ff00] focus-visible:border-[#c8ff00]"}`}
            title="re-read the log tail now — the ledger also re-reads itself every 60s (the log is append-only; a re-read is cheap and honest). R182 · THE LANES' VOICES: the button's state rides its aria — the offer and the in-flight read, heard without hovering; the read in flight wears the amber. R183 · THE LANES' RETURN: a clicked read that lands speaks its home line once — the lane's own arrival stamp in the house's UTC voice — and wears the lime for 2.6s; the unasked passes (mount, the 60s self-read) and a failed read stay silent — the completion belongs to the click."
          >
            {busy ? "READING…" : "REREAD"}
          </button>
          <span aria-live="polite" className="sr-only">
            {justRead && !busy && homeAt ? laneRereadHomeVoice("the log tail", homeAt) : ""}
          </span>
        </div>
      </div>

      {error && (
        <p
          className="vvu-label mt-1.5 text-[7px] text-[#e5484d]"
          data-testid="latency-ledger-error"
        >
          THE LOG IS UNREADABLE · {error} — the ledger refuses to invent a window
        </p>
      )}

      {read && (
        <>
          <div className="mt-1.5 overflow-x-auto" data-testid="latency-ledger-table">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="vvu-label text-[6.5px] font-bold tracking-[0.14em] text-[#5f6e55]">
                  <th className="text-left py-0.5 pr-2 font-bold">ROUTE</th>
                  <th className="text-right py-0.5 px-2 font-bold">N</th>
                  <th className="text-right py-0.5 px-2 font-bold">P50</th>
                  <th className="text-right py-0.5 px-2 font-bold">P95</th>
                  <th
                    className="text-left py-0.5 px-2 font-bold"
                    title="each route's p95 against the window's heaviest p95 — the heaviest row's bar is amber, the rest cyan; width is the share, the number is the truth"
                  >
                    P95 BAR
                  </th>
                  <th className="text-right py-0.5 px-2 font-bold">MAX</th>
                  <th className="text-right py-0.5 px-2 font-bold">COMPILE·MED</th>
                  <th className="text-right py-0.5 pl-2 font-bold">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const maxP95 = Math.max(1, ...rows.map((r) => r.p95Ms));
                  return rows.map((r) => {
                    const tone = statusTone(r.statuses);
                    const heavy =
                      read.heaviest != null &&
                      r.route === read.heaviest.route &&
                      r.method === read.heaviest.method;
                    const tooltip = `${r.method} ${r.route} — ${r.requests} request(s): ${Object.entries(
                      r.statuses,
                    )
                      .map(([s, n]) => `${n}×${s}`)
                      .join(
                        ", ",
                      )} · latency p50 ${r.p50Ms} / p95 ${r.p95Ms} / max ${r.maxMs} (mean ${r.meanMs}) ms · compile median ${r.compileMedianMs != null ? `${r.compileMedianMs} ms` : "NO SPLIT"} · render median ${r.renderMedianMs != null ? `${r.renderMedianMs} ms` : "NO SPLIT"}${r.noSplit > 0 ? ` · ${r.noSplit} line(s) without a split` : ""}${heavy ? " · THE HEAVIEST P95 IN THE WINDOW" : ""} · last line: ${r.lastLine}`;
                    return (
                      <tr
                        key={`${r.method}-${r.route}`}
                        tabIndex={0}
                        title={tooltip}
                        aria-label={tooltip}
                        className={`vvu-label text-[7.5px] text-[#c9d4bd] tabular-nums outline-none transition-colors duration-150 hover:bg-[#6b8a40]/5 focus-visible:bg-[#6b8a40]/10 ${heavy ? "bg-[#e0a030]/5" : ""}`}
                      >
                        <td
                          className="py-0.5 pr-2 font-mono text-left truncate max-w-[220px]"
                          title={r.route}
                        >
                          {heavy && <span className="text-[#e0a030] mr-1">▲</span>}
                          <span className="text-[#7a8a6e]">{r.method}</span> {r.route}
                        </td>
                        <td className="text-right py-0.5 px-2">{r.requests}</td>
                        <td className="text-right py-0.5 px-2">{r.p50Ms}</td>
                        <td
                          className="text-right py-0.5 px-2"
                          style={{ color: heavy ? AMBER : undefined }}
                        >
                          {r.p95Ms}
                        </td>
                        <td
                          className="py-0.5 px-2"
                          title={`p95 ${r.p95Ms} ms against the window's heaviest ${maxP95} ms — ${Math.round((r.p95Ms / maxP95) * 100)}% of the bar`}
                        >
                          <span className="inline-block w-[44px] h-[5px] bg-black/40 rounded-sm overflow-hidden align-middle">
                            <span
                              className="block h-full rounded-sm transition-all duration-300"
                              style={{
                                width: `${Math.max(2, Math.round((r.p95Ms / maxP95) * 100))}%`,
                                backgroundColor: heavy ? AMBER : CYAN,
                                opacity: heavy ? 0.95 : 0.65,
                              }}
                            />
                          </span>
                        </td>
                        <td className="text-right py-0.5 px-2 text-[#7a8a6e]">{r.maxMs}</td>
                        <td
                          className="text-right py-0.5 px-2"
                          style={{ color: r.compileMedianMs != null ? SAGE : undefined }}
                        >
                          {r.compileMedianMs != null ? r.compileMedianMs : "—"}
                        </td>
                        <td className="py-0.5 pl-2 text-right whitespace-nowrap">
                          {tone ? (
                            <span
                              className={`vvu-label text-[6.5px] font-bold px-1 py-px rounded-sm border ${tone.cls}`}
                            >
                              {tone.label}
                            </span>
                          ) : (
                            <span
                              className="text-[#6b8a40]"
                              title="every request on this route returned 200"
                            >
                              200
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          {nonOkRoutes.length > 0 && (
            <p
              className="vvu-label mt-1 text-[6.5px] text-[#e5484d] tabular-nums"
              title="the non-200 routes, named — external probes hitting :3000 with transform headers are part of the estate's life; the ledger counts them and names them instead of hiding them in a green share"
            >
              NON-200 · {nonOkRoutes.map((r) => `${r.method} ${r.route} (${r.nonOk})`).join(" · ")}
            </p>
          )}

          <p
            className="vvu-label mt-1.5 text-[7px] leading-relaxed text-[#7a8a6e]"
            data-testid="latency-ledger-read"
          >
            <span className="font-bold" style={{ color: CYAN }}>
              THE READ ·{" "}
            </span>
            {read.note}
          </p>
        </>
      )}
    </div>
  );
}
