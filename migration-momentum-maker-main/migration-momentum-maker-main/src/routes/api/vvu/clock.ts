import { createFileRoute } from "@tanstack/react-router";
import { appendSimulatedEvent } from "./ledger";

let clock = {
  revision: 1,
  current_utc: new Date().toISOString(),
  last_written_by: "production-dashboard",
  last_written_at_utc: new Date().toISOString(),
};
export const Route = createFileRoute("/api/vvu/clock")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ ok: true, ...clock }, { headers: { "cache-control": "no-store" } }),
      POST: async ({ request }) => {
        const b = await request.json().catch(() => null);
        if (
          !b ||
          typeof b.by !== "string" ||
          !["dev-spreadsheet", "production-dashboard"].includes(b.by)
        )
          return Response.json(
            { ok: false, error: 'expected { by: "dev-spreadsheet" | "production-dashboard" }' },
            { status: 400 },
          );
        const now = new Date().toISOString();
        clock = {
          ...clock,
          revision: clock.revision + 1,
          current_utc: now,
          last_written_by: b.by,
          last_written_at_utc: now,
        };
        const e = await appendSimulatedEvent(
          "CLOCK",
          "CLOCK_ADVANCED",
          JSON.stringify({
            by: b.by,
            from_revision: clock.revision - 1,
            to_revision: clock.revision,
            at: now,
          }),
        );
        return Response.json({ ok: true, worm_id: e.id, ...clock });
      },
    },
  },
});
