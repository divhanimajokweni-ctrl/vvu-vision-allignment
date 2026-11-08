import { createFileRoute } from "@tanstack/react-router";

// GET /api/field/status — the field-onboard rail status (feed recreation).

export const Route = createFileRoute("/api/field/status")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json(
          {
            ok: true,
            node: "VVU-FIELD-ONBOARD",
            protocol: "proofbridge/v1+field",
            agentOnline: true,
            agent: {
              deviceId: "field-tab-m55",
              name: "Field onboard · Galaxy Tab M55",
              lastSeenAgoMs: 4_000,
            },
            pairedDevices: 1,
            viewerCount: 1,
            pairing: { active: false },
            receipts: { count: 5, root: "feed-field-root", verified: true },
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
