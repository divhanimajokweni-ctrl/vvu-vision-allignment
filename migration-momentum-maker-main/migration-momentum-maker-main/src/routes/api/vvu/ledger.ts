import { createFileRoute } from "@tanstack/react-router";

import type { LedgerEntry } from "@/types/vvu";
const entries: LedgerEntry[] = [];
const epoch = Date.now() - 96 * 60000;
let queue: Promise<unknown> = Promise.resolve();
async function digest(value: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
async function append(
  source: string,
  event: string,
  details: string,
  at = new Date().toISOString(),
) {
  const seq = entries.length + 1,
    prevHash = entries.at(-1)?.hash ?? "GENESIS-20260901";
  const hash = await digest(`${prevHash}|${seq}|${source}|${event}|${details}`);
  const row: LedgerEntry = {
    id: `sim-worm-${seq}`,
    seq,
    source,
    event,
    details,
    prevHash,
    hash,
    createdAt: at,
  };
  entries.push(row);
  return row;
}
const ready = (async () => {
  for (let i = 0; i < 96; i++)
    await append(
      i % 4 === 0 ? "MANIFEST" : i % 4 === 1 ? "TELEMETRY" : i % 4 === 2 ? "SUPPORT" : "CARD_SYNC",
      i % 4 === 0
        ? "MANIFEST_VERIFIED"
        : i % 4 === 1
          ? "STEADY_STATE_CONFIRMED"
          : i % 4 === 2
            ? "SUPPORT_LEDGER_COMMIT"
            : "CARD_CAPTURES_SYNCED",
      JSON.stringify({ simulated: true, cycle: i + 1 }),
      new Date(epoch + i * 60000).toISOString(),
    );
})();
export async function simulatedLedger() {
  await ready;
  return entries.slice();
}
export function appendSimulatedEvent(source: string, event: string, details: string) {
  const result = queue.then(async () => {
    await ready;
    return append(source, event, details);
  });
  queue = result.catch(() => undefined);
  return result;
}
export const Route = createFileRoute("/api/vvu/ledger")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams;
        const n = parseInt(q.get("limit") || "50");
        if (!Number.isFinite(n))
          return Response.json({ error: "Error: Invalid limit" }, { status: 500 });
        const all = await simulatedLedger();
        const before = q.get("before") ? parseInt(q.get("before") || "", 10) : null;
        const rows = all.filter(
          (r) =>
            (!q.get("source") || r.source === q.get("source")) &&
            (before == null || !Number.isFinite(before) || r.seq < before),
        );
        const newestFirst = rows.slice().reverse().slice(0, Math.max(0, n));
        return Response.json({
          count: all.length,
          chainValid: true,
          lastHash: all.at(-1)?.hash ?? null,
          breakAt: null,
          entries: newestFirst,
        });
      },
      POST: async ({ request }) => {
        try {
          const b = await request.json();
          if (!b.event) return Response.json({ error: "missing event field" }, { status: 400 });
          const e = await appendSimulatedEvent(
            b.source || "telemetry-service",
            b.event,
            typeof b.details === "string" ? b.details : JSON.stringify(b.details ?? {}),
          );
          return Response.json({ ok: true, id: e.id, seq: e.seq, hash: e.hash.slice(0, 16) + "…" });
        } catch (e) {
          return Response.json({ error: String(e) }, { status: 500 });
        }
      },
    },
  },
});
