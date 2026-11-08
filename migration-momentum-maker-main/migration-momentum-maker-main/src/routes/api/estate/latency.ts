import { createFileRoute } from "@tanstack/react-router";
import { latencyLedger } from "@/lib/latency-ledger";

export function simulatedLatency(step = 0) {
  return latencyLedger(
    Array.from({ length: 180 }, (_, i) => {
      const render = 24 + ((i * 17 + step * 7) % 120);
      const compile = i % 17 === 0 ? 280 : 3;
      return `GET ${["/", "/api/vvu/analytics", "/api/vvu/ledger", "/api/estate/watchboard"][i % 4]} 200 in ${render + compile}ms (compile: ${compile}ms, render: ${render}ms)`;
    }),
  );
}
export const Route = createFileRoute("/api/estate/latency")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { ok: true, ledger: simulatedLatency(Math.floor(Date.now() / 30000) % 7) },
          { headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
