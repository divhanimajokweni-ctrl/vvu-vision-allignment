import { createFileRoute } from "@tanstack/react-router";

// GET /api/bridge/status — the vault-bridge rail status (feed recreation).
// Mirrors the payload the paired-device agent published from :3004.

export const Route = createFileRoute("/api/bridge/status")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json(
          {
            ok: true,
            agentOnline: true,
            agent: {
              deviceId: "obsidian-pixel-7a",
              name: "Obsidian vault · Pixel 7a",
              lastSeenAgoMs: 4_000,
            },
            pairedDevices: 1,
            viewerCount: 1,
            pairing: { active: false },
            receipts: { count: 12, root: "feed-bridge-root", verified: true },
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
