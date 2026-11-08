import { createFileRoute } from "@tanstack/react-router";

// GET /api/integrity — runner integrity report (feed recreation of the
// source's disk-fingerprint route). The watched file set and hashes are
// simulated; runningHash === diskHash because the feed is the artifact.

const WATCHED = [
  "src/routes/index.tsx",
  "src/lib/vvu-sim.ts",
  "src/lib/bridge-feed.ts",
  "src/hooks/use-vvu-socket.ts",
  "src/components/workspaces/registry.tsx",
];

function fakeHash(seed: string): string {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h1 ^= seed.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  let out = "";
  let x = h1;
  while (out.length < 64) {
    x = Math.imul(x ^ (x >>> 13), 0x5bd1e995) >>> 0;
    out += x.toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
}

const perFile = Object.fromEntries(WATCHED.map((rel) => [rel, fakeHash(rel)]));
const combined = fakeHash(WATCHED.join("|"));
const compiledAt = new Date(Date.now() - 7_200_000).toISOString();

export const Route = createFileRoute("/api/integrity")({
  server: {
    handlers: {
      GET: async () => {
        const now = Date.now();
        return Response.json(
          {
            ok: true,
            service: "proofbridge-next-dashboard",
            port: 3000,
            watchedFiles: WATCHED,
            runningHash: combined,
            diskHash: combined,
            runningPerFile: perFile,
            diskPerFile: perFile,
            match: true,
            compiledAt,
            uptimeSec: Math.floor((now - Date.parse(compiledAt)) / 1000),
            runtime: "edge",
            runtimeName: "tanstack-start",
            footprint: {
              rssKb: 1_812_000,
              hwmKb: 1_930_000,
              guardMb: 2400,
              guardSource: "guardian",
              boxAvailKb: 1_240_000,
            },
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
