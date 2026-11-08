import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/estate/watchboard")({
  server: {
    handlers: { GET: async () => Response.json({ snapshot: null, ok: true, watches: [] }) },
  },
});
