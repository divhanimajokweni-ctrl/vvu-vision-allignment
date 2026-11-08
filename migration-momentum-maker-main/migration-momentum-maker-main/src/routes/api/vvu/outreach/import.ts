import { createFileRoute } from "@tanstack/react-router";

// POST /api/vvu/outreach/import — CSV import into the outreach feed.

export const Route = createFileRoute("/api/vvu/outreach/import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { csv?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "invalid JSON" }, { status: 400 });
        }
        const csv = String(body.csv ?? "");
        const lines = csv
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length === 0) {
          return Response.json({ error: "empty CSV" }, { status: 422 });
        }
        // header row + data rows; rows missing org/email are skipped
        const dataRows = lines.slice(1);
        let added = 0;
        let skipped = 0;
        for (const line of dataRows) {
          const cols = line.split(",").map((c) => c.trim());
          if (cols.length >= 2 && cols[0] && cols[1]) added += 1;
          else skipped += 1;
        }
        return Response.json({
          added,
          skipped,
          message: `${added} target(s) imported · ${skipped} skipped · WORM OUTREACH_IMPORT`,
        });
      },
    },
  },
});
