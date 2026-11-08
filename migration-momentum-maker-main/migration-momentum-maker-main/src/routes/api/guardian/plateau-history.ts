import { createFileRoute } from "@tanstack/react-router";

// GET /api/guardian/plateau-history?points=N — the plateau SCOPE: the
// guardian's own pass log as a time series (feed recreation of the source's
// disk-backed read).

interface ScopeSample {
  at: string;
  atMs: number;
  rssMb: number;
  hwmMb: number | null;
  availMb: number | null;
  port: "UP" | "DOWN";
  decision: string;
}

interface ScopeMarker {
  at: string;
  atMs: number;
  reason: string;
  ok: boolean;
  downtimeMs: number | null;
  oldPid: number | null;
  newPid: number | null;
}

const utcLabel = (d: Date): string => d.toISOString().replace("T", " ").slice(0, 19) + " UTC";

export const Route = createFileRoute("/api/guardian/plateau-history")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const rawPoints = Number(url.searchParams.get("points") ?? "");
        const points =
          Number.isFinite(rawPoints) && rawPoints > 0
            ? Math.min(720, Math.max(60, Math.floor(rawPoints)))
            : 360;

        const now = Date.now();
        const intervalSec = 20;
        const samples: ScopeSample[] = [];
        let rssMb = 1330;
        let hwmMb = 1330;
        for (let i = 0; i < points; i++) {
          const drift = 0.55 + Math.sin(i / 45) * 0.25;
          rssMb += drift + (Math.random() - 0.5) * 1.4;
          hwmMb = Math.max(hwmMb, rssMb);
          const down = i === Math.floor(points * 0.42) || i === Math.floor(points * 0.43);
          samples.push({
            at: utcLabel(new Date(now - (points - i) * intervalSec * 1000)),
            atMs: now - (points - i) * intervalSec * 1000,
            rssMb: down ? (rssMb as number) : Math.round(rssMb * 10) / 10,
            hwmMb: Math.round(hwmMb * 10) / 10,
            availMb: down ? null : Math.round((3900 - rssMb) * 10) / 10,
            port: down ? "DOWN" : "UP",
            decision: down ? "RESTART" : "PASS",
          });
        }

        const bounce1 = samples[Math.floor(points * 0.2)];
        const bounce2 = samples[Math.floor(points * 0.42)];
        const markers: ScopeMarker[] = [
          {
            at: bounce1.at,
            atMs: bounce1.atMs,
            reason: "rss-over-guard",
            ok: true,
            downtimeMs: 22_600,
            oldPid: 1204,
            newPid: 1310,
          },
          {
            at: bounce2.at,
            atMs: bounce2.atMs,
            reason: "port-down",
            ok: true,
            downtimeMs: 24_900,
            oldPid: 1310,
            newPid: 1442,
          },
        ];

        const rssVals = samples.filter((s) => s.port === "UP").map((s) => s.rssMb);
        const lastTen = rssVals.slice(-10).sort((a, b) => a - b);
        const baselineMb = Math.round(lastTen[Math.floor(lastTen.length / 2)] ?? rssMb);

        const payload = {
          present: true,
          generatedAtUtc: utcLabel(new Date(now)),
          guardMb: 2400,
          intervalSec,
          requestedPoints: points,
          logGenerations: [
            { path: ".zscripts/guardian.log.1", present: true, lines: 2_880 },
            { path: ".zscripts/guardian.log", present: true, lines: points },
          ],
          window: {
            passes: points,
            downPasses: samples.filter((s) => s.port === "DOWN").length,
            lastDownAt: samples.find((s) => s.port === "DOWN")?.at ?? null,
            otherLines: 6,
            since: samples[0]?.at ?? null,
            until: samples[samples.length - 1]?.at ?? null,
            spanSec: points * intervalSec,
          },
          samples,
          markers,
          stats: {
            firstMb: rssVals[0] ?? null,
            lastMb: rssVals[rssVals.length - 1] ?? null,
            minMb: Math.min(...rssVals),
            maxMb: Math.max(...rssVals),
            climbMb: Math.round((rssVals[rssVals.length - 1] - rssVals[0]) * 10) / 10,
            bootStart: markers[markers.length - 1]?.at ?? null,
            bootComplete: true,
            bootPids: [1442, 4100],
            baselineMb,
          },
        };

        return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
