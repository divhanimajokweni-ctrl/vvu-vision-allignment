import { createFileRoute } from "@tanstack/react-router";

// GET/POST /api/guardian/verdict-ledger — the verdict readings ledger (feed
// recreation). GET returns the recorded readings newest-first; POST records
// one reading with the source's 60s cooldown (409 while cooling down).

interface VerdictReadingRow {
  at: string;
  atMs: number;
  bootPid: number;
  devTreePid?: number | null;
  uptimeSec: number;
  bootStartUtc: string | null;
  windowOnly: boolean;
  climbMb: number;
  requests: number;
  reqPerMin: number | null;
  mbPer1k: number | null;
  kind:
    | "no-plateau"
    | "no-climb"
    | "no-counter"
    | "flat"
    | "too-few"
    | "not-tracked"
    | "mixed"
    | "tracked";
  tone: "dim" | "lime" | "cyan" | "amber" | "rose";
  via?: "operator" | "auto-guardian";
  knownSelfPct: number | null;
  residualReq: number | null;
  profileNextKey: string | null;
  profileNextCount: number | null;
  routesTracked: number | null;
}

const COOLDOWN_MS = 60_000;

const bootStart = Date.now() - 5_200_000;
const bootPid = 4100;

function buildRow(
  offsetMin: number,
  kind: VerdictReadingRow["kind"],
  tone: VerdictReadingRow["tone"],
): VerdictReadingRow {
  const atMs = Date.now() - offsetMin * 60_000;
  return {
    at: new Date(atMs).toISOString(),
    atMs,
    bootPid,
    devTreePid: 4100,
    uptimeSec: Math.floor((atMs - bootStart) / 1000),
    bootStartUtc: new Date(bootStart).toISOString(),
    windowOnly: false,
    climbMb: kind === "flat" ? 6 : 96,
    requests: 18_400,
    reqPerMin: 212,
    mbPer1k: kind === "flat" ? null : kind === "tracked" ? 33.2 : 5.2,
    kind,
    tone,
    via: "auto-guardian",
    knownSelfPct: 71,
    residualReq: 1_204,
    profileNextKey: "GET /api/guardian/plateau-history",
    profileNextCount: 3_420,
    routesTracked: 12,
  };
}

let rows: VerdictReadingRow[] = [
  buildRow(214, "mixed", "amber"),
  buildRow(142, "tracked", "rose"),
  buildRow(64, "flat", "lime"),
];
let lastPostAt = 0;
let ledgerTotal = 47;

export const Route = createFileRoute("/api/guardian/verdict-ledger")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json(
          {
            ok: true,
            ledger: {
              present: true,
              rows,
              total: ledgerTotal,
              corrupt: 0,
              cooldownMs: COOLDOWN_MS,
            },
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
      POST: async () => {
        const now = Date.now();
        const since = now - lastPostAt;
        if (lastPostAt && since < COOLDOWN_MS) {
          return Response.json(
            {
              ok: false,
              error: "cooldown",
              lastRowAt: rows[0]?.at ?? null,
              retryableAfterSec: Math.ceil((COOLDOWN_MS - since) / 1000),
            },
            { status: 409, headers: { "Cache-Control": "no-store" } },
          );
        }
        lastPostAt = now;
        const row = buildRow(0, "flat", "lime");
        rows = [row, ...rows].slice(0, 200);
        ledgerTotal += 1;
        return Response.json(
          { ok: true, row, ledgerTotal },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
