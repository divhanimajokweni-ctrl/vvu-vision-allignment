import { createFileRoute } from "@tanstack/react-router";
import { buildBootLedger } from "@/lib/boot-ledger";
import { deathCauseRead } from "@/lib/death-causes";
import { simulatedBoots } from "./boot-ledger";

export const Route = createFileRoute("/api/estate/death-causes")({
  server: {
    handlers: {
      GET: async () => {
        const ledger = buildBootLedger(simulatedBoots(), {
          nowMs: Date.now(),
          currentDevPid: 4124,
        });
        return Response.json(
          { ok: true, read: deathCauseRead(ledger.boots, { witnessed: [] }) },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
