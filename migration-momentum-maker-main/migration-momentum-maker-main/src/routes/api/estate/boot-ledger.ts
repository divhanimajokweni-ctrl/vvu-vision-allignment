import { createFileRoute } from "@tanstack/react-router";
import { buildBootLedger } from "@/lib/boot-ledger";

export function simulatedBoots(now = Date.now()) {
  return Array.from({ length: 25 }, (_, i) => ({
    at: new Date(now - (25 - i) * 3600000).toISOString(),
    reason: i === 0 ? "startup" : i % 5 === 0 ? "rss-guard" : i % 3 === 0 ? "port-down" : "manual",
    ok: true,
    oldPid: 4100 + i - 1,
    newPid: 4100 + i,
    drill: false,
    port: 3000,
  }));
}
export const Route = createFileRoute("/api/estate/boot-ledger")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          {
            ok: true,
            ledger: buildBootLedger(simulatedBoots(), { nowMs: Date.now(), currentDevPid: 4124 }),
          },
          { headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
