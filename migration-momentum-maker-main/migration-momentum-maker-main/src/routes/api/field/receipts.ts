import { createFileRoute } from "@tanstack/react-router";

// GET /api/field/receipts — the field-onboard receipt tail (feed recreation).
// ?verify=1 walks the chain and returns { valid, checked, root }.

export const Route = createFileRoute("/api/field/receipts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const verify = url.searchParams.get("verify");

        if (verify) {
          return Response.json(
            { valid: true, checked: 5, root: "feed-field-root", count: 5 },
            { headers: { "Cache-Control": "no-store" } },
          );
        }

        return Response.json(
          {
            receipts: [
              {
                seq: 5,
                ts: new Date(Date.now() - 2 * 60_000).toISOString(),
                actor: "DASHBOARD",
                op: "write",
                target: "ProofBridge/Evidence/field_onboard.md",
                ok: true,
                sha256: "feed-simulated",
                prevHash: "feed-prev",
                hash: "feed-field-root",
              },
            ],
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
