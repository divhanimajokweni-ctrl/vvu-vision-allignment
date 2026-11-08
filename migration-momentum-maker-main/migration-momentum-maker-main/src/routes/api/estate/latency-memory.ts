import { createFileRoute } from "@tanstack/react-router";
import { latencyMemoryRead, snapshotFromLedger } from "@/lib/latency-memory";
import { simulatedLatency } from "./latency";

export const Route = createFileRoute("/api/estate/latency-memory")({
  server: {
    handlers: {
      GET: async () => {
        const now = Math.floor(Date.now() / 30000) * 30000;
        const store = Array.from({ length: 24 }, (_, i) =>
          snapshotFromLedger(simulatedLatency(i % 7), now - (23 - i) * 30000),
        );
        return Response.json(
          {
            ok: true,
            memory: latencyMemoryRead(store),
            appended: true,
            persisted: false,
            storeReset: false,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
