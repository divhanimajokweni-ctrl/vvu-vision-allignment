import { createFileRoute } from "@tanstack/react-router";

// POST /api/vvu/outreach/send — consent-gated, dry-run-first send (feed
// recreation). resendConfigured=false in the feed, so real sends are refused
// with 501 exactly like the source without a Resend key.

interface SendBody {
  targetIds?: string[];
  dryRun?: boolean;
}

export const Route = createFileRoute("/api/vvu/outreach/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: SendBody;
        try {
          body = (await request.json()) as SendBody;
        } catch {
          return Response.json({ error: "invalid JSON" }, { status: 400 });
        }

        const ids = Array.isArray(body.targetIds) ? body.targetIds : [];
        const dryRun = body.dryRun !== false;

        if (!dryRun) {
          return Response.json(
            {
              error: "REAL SENDS REFUSED — resendConfigured=false in this environment; use dryRun",
            },
            { status: 501 },
          );
        }

        const previews = ids.map((id, i) => ({
          org: `Target ${id}`,
          email: `${id}@example.co.za`,
          subject: "VVU — the evidence your next audit asks for",
          html: `<p>Preview ${i + 1} of ${ids.length} — template render only (dry-run).</p>`,
        }));

        return Response.json({
          dryRun: true,
          previews,
          results: ids.map((id) => ({
            org: `Target ${id}`,
            email: `${id}@example.co.za`,
            status: "DRY_RUN" as const,
          })),
          blocked: 0,
          sent: 0,
          failed: 0,
        });
      },
    },
  },
});
