// R110 — THE LATENCY LEDGER: the estate's own log, read as a record.
//
// Every panel in the evidence stack reads the memory storm; none read the
// REQUEST side — what the estate's serving actually costs. The dev log
// carries one line per served request (the tee -a append that survives
// every respawn), and no engine has ever parsed it systematically. This
// engine turns a bounded window of those lines into the estate's
// request-side ledger: per route, the request count, the status census,
// and the latency distribution (p50 / p95 / max) with the compile-vs-render
// split the dev server itself reports.
//
//   THE WINDOW: a line-count window, NOT a clock window — dev log lines
//   carry no timestamps, so the ledger discloses "last N lines" and never
//   pretends otherwise. The route owns the tail cut; the engine reads
//   verbatim what it is given.
//
//   THE GRAMMAR: `METHOD PATH STATUS in Nms (compile: N(µs|ms), render:
//   Nms)` — the dev server's own shape. Compile reads µs on fast passes
//   and ms on slow ones; both convert to ms (µs ÷ 1000, full precision,
//   rounded once at the edge). A request line without the paren part is
//   still a request — it lands in the NO SPLIT lane (latency counted,
//   split unknown, never interpolated).
//
//   THE NORMALIZATION: the query string is stripped (a poll with ?limit=40
//   is the same route's cost); nothing else is invented — no numeric
//   segment collapsing, no path rewrites. The route census is the log's
//   own vocabulary.
//
//   THE HONESTY: non-200 statuses are COUNTED AND NAMED (an external probe
//   hitting :3000 with transform headers is part of the estate's life);
//   `▲ Next.js` boot banners in the window are counted as RESPAWNS (the
//   dev server's own restarts, visible in the log); lines that parse as
//   nothing are counted as context (compile banners, startup noise) —
//   nothing is dropped silently.
//
// Pure: no I/O, no clock, no re-derivation. The route reads the file and
// hands over lines; the ledger does the rest.

/** The bounded window the route serves — the last N lines of dev.log. */
export const LATENCY_WINDOW_LINES = 4000;

const REQUEST_RE =
  /^\s*(GET|POST|HEAD|PUT|DELETE|PATCH)\s+(\S+)\s+(\d{3})\s+in\s+(\d+)ms(?:\s+\(compile:\s+(\d+)(µs|ms),\s+render:\s+(\d+)ms\))?\s*$/;

const BOOT_BANNER_RE = /▲\s*Next\.js/;

export interface RouteRead {
  /** Normalized route path (query stripped) — the log's own vocabulary. */
  route: string;
  /** The method of the LAST matching line (GET/POST/HEAD dominate per
   *  route; a route served two ways reads as two entries, one per method
   *  — the log's own grain, not a merge the engine invented). */
  method: string;
  requests: number;
  /** status → count, verbatim from the log (200 / 404 / …). */
  statuses: Record<string, number>;
  /** Non-200 total for this entry (0 for the healthy). */
  nonOk: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  meanMs: number;
  /** Median compile ms — null when NO line in the entry carried a split. */
  compileMedianMs: number | null;
  /** Median render ms — null when NO line carried a split. */
  renderMedianMs: number | null;
  /** Lines in this entry that carried no compile/render paren (NO SPLIT). */
  noSplit: number;
  /** The last matching line's verbatim text — the freshest evidence. */
  lastLine: string;
}

export interface LatencyLedgerRead {
  /** The line-count window the ledger was given (disclosed, not a clock). */
  windowLines: number;
  /** Total non-empty lines handed in. */
  linesIn: number;
  /** Lines parsed as requests. */
  parsed: number;
  /** Non-empty lines that parsed as nothing (compile banners, noise). */
  contextLines: number;
  /** `▲ Next.js` boot banners inside the window — the dev server's own
   *  restarts, visible in the log. */
  respawns: number;
  /** Distinct route entries (method × normalized path). */
  routeCount: number;
  /** Total requests across all entries. */
  totalRequests: number;
  /** status → count across the whole window. */
  statuses: Record<string, number>;
  nonOkTotal: number;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
  /** Of the lines carrying BOTH compile and render, the share of the
   *  summed latency that is compile (0–100, one decimal). Null below 2
   *  split lines — a share of one sample is not a share. */
  compileSharePct: number | null;
  /** Requests whose line carried no compile/render paren. */
  noSplitTotal: number;
  /** Route entries sorted by requests desc, then p95 desc (the hot list). */
  routes: RouteRead[];
  /** The entry with the highest p95 (the heavy list's head), null when no
   *  requests parsed. */
  heaviest: RouteRead | null;
  /** The engine's own one-liner — THE READ shows it verbatim. */
  note: string;
}

function percentile(sorted: Array<number>, p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)] as number;
}

function median(sorted: Array<number>): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

interface Entry {
  route: string;
  method: string;
  requests: number;
  statuses: Record<string, number>;
  nonOk: number;
  latencies: Array<number>;
  compile: Array<number>;
  render: Array<number>;
  noSplit: number;
  lastLine: string;
}

function finalize(e: Entry): RouteRead {
  const sorted = [...e.latencies].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return {
    route: e.route,
    method: e.method,
    requests: e.requests,
    statuses: e.statuses,
    nonOk: e.nonOk,
    p50Ms: round1(percentile(sorted, 50) as number),
    p95Ms: round1(percentile(sorted, 95) as number),
    maxMs: round1(sorted[sorted.length - 1] as number),
    meanMs: round1(mean),
    compileMedianMs: e.compile.length > 0 ? round1(median(e.compile) as number) : null,
    renderMedianMs: e.render.length > 0 ? round1(median(e.render) as number) : null,
    noSplit: e.noSplit,
    lastLine: e.lastLine,
  };
}

/** THE LATENCY LEDGER — raw log lines in, the request-side record out. */
export function latencyLedger(lines: Array<string>): LatencyLedgerRead {
  const given = (lines ?? []).filter((l) => typeof l === "string");
  const nonEmpty = given.filter((l) => l.trim().length > 0);

  const byKey = new Map<string, Entry>();
  const statuses: Record<string, number> = {};
  const allLatencies: Array<number> = [];
  const splitLines: Array<{ total: number; compile: number; render: number }> = [];
  let noSplitTotal = 0;
  let respawns = 0;
  let contextLines = 0;
  let parsed = 0;

  for (const line of nonEmpty) {
    if (BOOT_BANNER_RE.test(line)) {
      respawns++;
      contextLines++;
      continue;
    }
    const m = REQUEST_RE.exec(line);
    if (!m) {
      contextLines++;
      continue;
    }
    parsed++;
    const method = m[1] as string;
    const rawPath = m[2] as string;
    const status = m[3] as string;
    const latency = Number(m[4]);
    const route = rawPath.replace(/\?.*$/, "");
    const key = `${method} ${route}`;

    statuses[status] = (statuses[status] ?? 0) + 1;
    allLatencies.push(latency);

    let e = byKey.get(key);
    if (!e) {
      e = {
        route,
        method,
        requests: 0,
        statuses: {},
        nonOk: 0,
        latencies: [],
        compile: [],
        render: [],
        noSplit: 0,
        lastLine: line.trim(),
      };
      byKey.set(key, e);
    }
    e.requests++;
    e.statuses[status] = (e.statuses[status] ?? 0) + 1;
    if (status !== "200") e.nonOk++;
    e.latencies.push(latency);
    e.lastLine = line.trim();
    if (m[5] != null && m[6] != null && m[7] != null) {
      const compileMs = m[6] === "µs" ? Number(m[5]) / 1000 : Number(m[5]);
      const renderMs = Number(m[7]);
      e.compile.push(compileMs);
      e.render.push(renderMs);
      splitLines.push({ total: latency, compile: compileMs, render: renderMs });
    } else {
      e.noSplit++;
      noSplitTotal++;
    }
  }

  const routes = [...byKey.values()].map(finalize).sort((a, b) => {
    if (b.requests !== a.requests) return b.requests - a.requests;
    return b.p95Ms - a.p95Ms;
  });

  const allSorted = [...allLatencies].sort((a, b) => a - b);
  const nonOkTotal = Object.entries(statuses)
    .filter(([s]) => s !== "200")
    .reduce((a, [, n]) => a + n, 0);

  let compileSharePct: number | null = null;
  if (splitLines.length >= 2) {
    const tot = splitLines.reduce((a, s) => a + s.total, 0);
    const comp = splitLines.reduce((a, s) => a + s.compile, 0);
    compileSharePct = tot > 0 ? round1((comp / tot) * 100) : null;
  }

  const heaviest =
    routes.length > 0
      ? routes.reduce((a, r) => (r.p95Ms > a.p95Ms ? r : a), routes[0] as RouteRead)
      : null;

  const note = buildNote({
    windowLines: given.length,
    linesIn: nonEmpty.length,
    parsed,
    contextLines,
    respawns,
    routeCount: routes.length,
    totalRequests: allLatencies.length,
    statuses,
    nonOkTotal,
    p50Ms: percentile(allSorted, 50),
    p95Ms: percentile(allSorted, 95),
    maxMs: percentile(allSorted, 100),
    compileSharePct,
    noSplitTotal,
    heaviest: heaviest
      ? { label: `${heaviest.method} ${heaviest.route}`, p95Ms: heaviest.p95Ms }
      : null,
  });

  return {
    windowLines: given.length,
    linesIn: nonEmpty.length,
    parsed,
    contextLines,
    respawns,
    routeCount: routes.length,
    totalRequests: allLatencies.length,
    statuses,
    nonOkTotal,
    p50Ms: percentile(allSorted, 50),
    p95Ms: percentile(allSorted, 95),
    maxMs: percentile(allSorted, 100),
    compileSharePct,
    noSplitTotal,
    routes,
    heaviest,
    note,
  };
}

function buildNote(a: {
  windowLines: number;
  linesIn: number;
  parsed: number;
  contextLines: number;
  respawns: number;
  routeCount: number;
  totalRequests: number;
  statuses: Record<string, number>;
  nonOkTotal: number;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
  compileSharePct: number | null;
  noSplitTotal: number;
  heaviest: { label: string; p95Ms: number } | null;
}): string {
  if (a.linesIn === 0) {
    return "the window is empty — the ledger reads nothing because the log gave it nothing";
  }
  const parts: string[] = [];
  parts.push(
    `${a.parsed} requests parsed across ${a.routeCount} routes in a ${a.windowLines}-line window (a line-count window, not a clock — the log carries no timestamps)`,
  );
  if (a.totalRequests > 0 && a.p50Ms != null && a.p95Ms != null && a.maxMs != null) {
    parts.push(`latency p50 ${a.p50Ms} / p95 ${a.p95Ms} / max ${a.maxMs} ms`);
  }
  const statusWords = Object.entries(a.statuses)
    .sort((x, y) => y[1] - x[1])
    .map(([s, n]) => `${n}×${s}`)
    .join(" · ");
  parts.push(`statuses ${statusWords || "none"}`);
  if (a.nonOkTotal > 0) {
    parts.push(`${a.nonOkTotal} non-200 — named in the table, never averaged away`);
  }
  if (a.heaviest) {
    parts.push(`heaviest p95 ${a.heaviest.label} at ${a.heaviest.p95Ms} ms`);
  }
  if (a.compileSharePct != null) {
    parts.push(`compile is ${a.compileSharePct}% of measured latency`);
  }
  if (a.noSplitTotal > 0) {
    parts.push(
      `${a.noSplitTotal} line(s) without a compile/render split — counted, not interpolated`,
    );
  }
  if (a.respawns > 0) {
    parts.push(`${a.respawns} dev-server respawn(s) inside the window`);
  }
  parts.push(`${a.contextLines} context line(s) (banners, compiles) counted honestly`);
  return parts.join("; ");
}
