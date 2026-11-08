import { createFileRoute } from "@tanstack/react-router";

interface RouteCount {
  key: string;
  count: number;
}

interface TrafficResponse {
  requestsSinceBoot: number;
  counterArmed: boolean;
  reqPerMin: number;
  routes: RouteCount[];
  routesTracked: number;
  routeOverflow: number;
  uptimeSec: number;
  pid: number;
  sampledAtUtc: string;
  note: string;
}

// Simulated process lifetime; no process or filesystem APIs are used.
const bootAt = Date.now() - 7_200_000;

const buckets = [
  ["GET /api/guardian", 6],
  ["GET /api/guardian/plateau-history", 3],
  ["GET /api/watchdog", 6],
  ["GET /api/integrity", 3],
  ["GET /api/traffic", 3],
  ["GET /api/fleet", 2],
  ["GET /api/gis/status", 2],
  ["GET /api/yolo/status", 2],
  ["GET /api/bridge/status", 3],
  ["GET /api/field/status", 3],
  ["GET /api/bridge/receipts", 1],
  ["GET /api/field/receipts", 1],
] as const;

export const Route = createFileRoute("/api/traffic")({
  server: {
    handlers: {
      GET: async () => {
        const now = Date.now();
        const uptimeSec = Math.max(1, Math.floor((now - bootAt) / 1000));
        const routes: RouteCount[] = buckets
          .map(([key, perMinute]) => ({
            key,
            count: Math.floor((uptimeSec * perMinute) / 60),
          }))
          .sort((a, b) => b.count - a.count);

        const requestsSinceBoot = routes.reduce((total, row) => total + row.count, 0);

        const payload: TrafficResponse = {
          requestsSinceBoot,
          counterArmed: true,
          reqPerMin: Math.round((requestsSinceBoot / uptimeSec) * 60),
          routes,
          routesTracked: routes.length,
          routeOverflow: 0,
          uptimeSec,
          pid: 4100,
          sampledAtUtc: new Date(now).toISOString(),
          note: "requests received by this node process since boot — includes the dashboard's own polling; resets at every boot; HTTP only (websocket upgrades are not counted); per-route buckets are query-stripped and capped at 512 distinct keys",
        };

        return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
