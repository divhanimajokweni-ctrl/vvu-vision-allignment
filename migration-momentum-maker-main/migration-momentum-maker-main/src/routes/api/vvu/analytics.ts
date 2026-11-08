import { createFileRoute } from "@tanstack/react-router";
import type { AnalyticsSummary, GateRecord } from "@/types/vvu";
import { GATE_DEFS, computeVotingLedger } from "@/lib/vvu-data";
import { simulatedLedger } from "./ledger";

export const Route = createFileRoute("/api/vvu/analytics")({
  server: {
    handlers: {
      GET: async () => {
        const rows = await simulatedLedger();
        const gates: GateRecord[] = GATE_DEFS.map((d) => ({
          ...d,
          status: "PENDING",
          certifiedAt: null,
          certHash: null,
        }));
        const payload: AnalyticsSummary = {
          gates,
          voting: computeVotingLedger(new Set()),
          worm: { count: rows.length, chainValid: true, lastHash: rows.at(-1)?.hash ?? null },
          telemetryCount: 720,
          auditCount: 50,
          steadyNodes: 3,
        };
        return Response.json(payload);
      },
    },
  },
});
