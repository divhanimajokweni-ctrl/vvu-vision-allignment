import { createFileRoute } from "@tanstack/react-router";

// GET /api/guardian — the daemon's own report, recreated as a feed. In the
// source deployment this read vvu-trust/guardian/status.json + bounces.jsonl
// off disk; here the same payload shape is simulated coherently.

interface GuardianBounceRow {
  at: string;
  reason: string;
  drill?: boolean;
  port?: number;
  rssKb?: number | null;
  guardKb?: number;
  oldPid?: number | null;
  newPid?: number | null;
  downtimeMs?: number | null;
  availKb?: number | null;
  ok?: boolean;
  evidence?: { path?: string; truncated?: boolean; lines?: string[]; error?: string } | null;
  memWitness?: Array<{ t: string; rssKb: number | null; availKb: number | null }> | null;
}

const utcLabel = (d: Date): string => d.toISOString().replace("T", " ").slice(0, 19) + " UTC";

export const Route = createFileRoute("/api/guardian")({
  server: {
    handlers: {
      GET: async () => {
        const now = Date.now();
        const startedAt = new Date(now - 6 * 3600_000);
        const uptimeSec = Math.floor((now - startedAt.getTime()) / 1000);

        // 90-sample bounded memory-pressure series (oldest first), warm plateau.
        const memSeries: Array<{ t: string; rssKb: number | null; availKb: number | null }> = [];
        let rss = 1_420_000;
        for (let i = 0; i < 90; i++) {
          rss += 2_400 + Math.round((Math.sin(i / 9) + Math.random() - 0.5) * 18_000);
          const avail = Math.max(
            600_000,
            2_150_000 - (rss - 1_400_000) * 0.55 + Math.round((Math.random() - 0.5) * 40_000),
          );
          memSeries.push({
            t: utcLabel(new Date(now - (90 - i) * 20_000)),
            rssKb: rss,
            availKb: avail,
          });
        }

        const bounceRows: GuardianBounceRow[] = [
          {
            at: utcLabel(new Date(now - 5.4 * 3600_000)),
            reason: "rss-over-guard",
            port: 3000,
            rssKb: 2_458_000,
            guardKb: 2_457_600,
            oldPid: 1204,
            newPid: 1310,
            downtimeMs: 21_400,
            availKb: 640_000,
            ok: true,
            evidence: {
              path: ".next/trace",
              truncated: true,
              lines: ["vmrss peak 2458MB", "killed by guardian rail"],
            },
            memWitness: memSeries.slice(-12).map((s) => ({ ...s })),
          },
          {
            at: utcLabel(new Date(now - 3.1 * 3600_000)),
            reason: "port-down",
            port: 3000,
            rssKb: null,
            guardKb: 2_457_600,
            oldPid: 1310,
            newPid: 1442,
            downtimeMs: 24_900,
            availKb: 780_000,
            ok: true,
          },
          {
            at: utcLabel(new Date(now - 0.9 * 3600_000)),
            reason: "drill",
            drill: true,
            port: 3999,
            ok: true,
            oldPid: null,
            newPid: null,
            downtimeMs: null,
          },
        ].map((r) => r as GuardianBounceRow);

        const realSaves = bounceRows.filter((r) => !r.drill);
        const downtimes = realSaves.map((r) => r.downtimeMs ?? 0).filter((v) => v > 0);

        const payload = {
          present: true,
          guardianAlive: true,
          stale: false,
          guardian: {
            guardianPid: 908,
            guardianFilePid: 908,
            startedAtUtc: utcLabel(startedAt),
            intervalSec: 20,
            guardMb: 2400,
            availFloorMb: 600,
            devPid: 4100,
            devPidAlive: true,
            nextServerPid: 4188,
            rssKb: memSeries[memSeries.length - 1]?.rssKb ?? null,
            hwmKb: 1_930_000,
            boxAvailKb: memSeries[memSeries.length - 1]?.availKb ?? null,
            portOk: true,
            duplicateDetected: false,
            consecutiveOver: 0,
            consecutiveDead: 0,
            consecutiveLow: 0,
            consecutiveCrit: 0,
            availCriticalMb: 300,
            bounces: realSaves.length,
            lastAction: "PASS · healthy",
            lastBounceAtUtc: realSaves[realSaves.length - 1]?.at ?? null,
            lastPassAtUtc: utcLabel(new Date(now - 8_000)),
            schedule: {
              enabled: false,
              at: null,
              minRssMb: 2100,
              lastFiredDateUtc: null,
              lastFiredAtUtc: null,
            },
            memSeries,
            autoPair: {
              enabled: true,
              openerDueUtc: new Date(now + 4 * 60_000).toISOString(),
              secondDueUtc: new Date(now + 64 * 60_000).toISOString(),
              workerPid: null,
            },
          },
          bounces: bounceRows,
          journalRowsTotal: 47,
          drills: {
            count: 11,
            landed: 11,
            last: {
              at: utcLabel(new Date(now - 0.9 * 3600_000)),
              reason: "drill",
              drill: true,
              port: 3999,
              ok: true,
            },
          },
          resilience: {
            count: realSaves.length + 29,
            spanHours: 41.7,
            totalDowntimeMs: downtimes.reduce((a, b) => a + b, 0) + 512_300,
            meanMs: 22_800,
            medianMs: 21_400,
            longestMs: 41_200,
            longestAt: utcLabel(new Date(now - 27.3 * 3600_000)),
            slowLandings: 4,
            byReason: { "rss-over-guard": 19, "port-down": 7, "manual-restart": 4 },
            witnessRows: 26,
            mtbfMin: 87.4,
            availabilityPct: 99.42,
            longestCalmMin: 214.6,
            longestCalmFrom: utcLabel(new Date(now - 30.2 * 3600_000)),
            longestCalmTo: utcLabel(new Date(now - 26.6 * 3600_000)),
            stormMin: 8.2,
            currentCalmMin: 53.6,
            calmPercentile: 74,
            cadence: "cooling" as const,
            intervalSeries: [
              {
                from: utcLabel(new Date(now - 5.4 * 3600_000)),
                to: utcLabel(new Date(now - 3.1 * 3600_000)),
                min: 138,
              },
              {
                from: utcLabel(new Date(now - 3.1 * 3600_000)),
                to: utcLabel(new Date(now - 0.9 * 3600_000)),
                min: 132,
              },
            ],
            downtimeSeries: bounceRows
              .filter((r) => !r.drill && (r.downtimeMs ?? 0) > 0)
              .map((r) => ({ at: r.at, ms: r.downtimeMs ?? 0, reason: r.reason })),
          },
          railProjection: null,
          plateau: {
            baselineMb: Math.round((memSeries[memSeries.length - 1]?.rssKb ?? 1_800_000) / 1024),
            headroomMb:
              2400 - Math.round((memSeries[memSeries.length - 1]?.rssKb ?? 1_800_000) / 1024),
            driftMb: 18,
            samples: 90,
            since: memSeries[0]?.t ?? null,
            until: memSeries[memSeries.length - 1]?.t ?? null,
          },
          uptimeSec,
        };

        return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
