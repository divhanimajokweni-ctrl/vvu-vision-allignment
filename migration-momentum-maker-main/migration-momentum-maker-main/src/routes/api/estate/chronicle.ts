import { createFileRoute } from "@tanstack/react-router";

// GET /api/estate/chronicle — the unified evidence timeline (feed recreation
// of the source's three-ledger stitch). Events carry the ChronicleEvent
// contract the watchdog surface renders (id · at · atMs · cls · tone · title
// · detail · meta), plus totals, sources and the verdict calibration block.

type ChronicleClass = "save" | "drill" | "snapshot" | "sync" | "fleet" | "verdict";
type ChronicleTone = "ok" | "warn" | "fail";

interface ChronicleEvent {
  id: string;
  at: string | null;
  atMs: number;
  cls: ChronicleClass;
  tone: ChronicleTone;
  title: string;
  detail: string | null;
  meta: Array<{ k: string; v: string }>;
  toneLabel?: string;
}

const utcLabel = (ms: number): string =>
  new Date(ms).toISOString().replace("T", " ").slice(0, 19) + " UTC";

export const Route = createFileRoute("/api/estate/chronicle")({
  server: {
    handlers: {
      GET: async () => {
        const now = Date.now();
        const ev = (
          id: string,
          agoMin: number,
          cls: ChronicleClass,
          tone: ChronicleTone,
          title: string,
          detail: string | null,
          meta: Array<{ k: string; v: string }>,
          toneLabel?: string,
        ): ChronicleEvent => ({
          id,
          at: utcLabel(now - agoMin * 60_000),
          atMs: now - agoMin * 60_000,
          cls,
          tone,
          title,
          detail,
          meta,
          ...(toneLabel ? { toneLabel } : {}),
        });

        const events: ChronicleEvent[] = [
          ev(
            "ch-014",
            18,
            "verdict",
            "ok",
            "VERDICT READING · FLAT",
            "climb 6 MB over 18,400 requests — the boot's climb collapsed into noise",
            [
              { k: "boot", v: "4100" },
              { k: "mbPer1k", v: "—" },
              { k: "via", v: "auto-guardian" },
            ],
          ),
          ev(
            "ch-013",
            54,
            "save",
            "ok",
            "GUARDIAN SAVE · port-down",
            "oldPid 1310 → newPid 1442 · downtime 24.9s",
            [
              { k: "port", v: "3000" },
              { k: "downtime", v: "24.9s" },
            ],
          ),
          ev(
            "ch-012",
            186,
            "drill",
            "ok",
            "DRILL CONTROL · readiness probe",
            "drill landing on scratch port 3999 — journal row recorded",
            [
              { k: "port", v: "3999" },
              { k: "result", v: "PASSED" },
            ],
          ),
          ev(
            "ch-011",
            322,
            "verdict",
            "warn",
            "VERDICT READING · MIXED",
            "33.2 MB per 1k — request-attributed climb with compile churn in the mix",
            [
              { k: "boot", v: "4100" },
              { k: "mbPer1k", v: "33.2" },
            ],
            "MIXED",
          ),
          ev(
            "ch-010",
            415,
            "sync",
            "ok",
            "CARD CAPTURES SYNCED",
            "field device sync cycle 96 · simulated feed",
            [
              { k: "batch", v: "96" },
              { k: "records", v: "184" },
            ],
          ),
          ev(
            "ch-009",
            690,
            "save",
            "ok",
            "GUARDIAN SAVE · rss-over-guard",
            "oldPid 1204 → newPid 1310 · downtime 21.4s · witness captured",
            [
              { k: "port", v: "3000" },
              { k: "rss", v: "2458MB" },
              { k: "downtime", v: "21.4s" },
            ],
          ),
          ev(
            "ch-008",
            1_140,
            "snapshot",
            "ok",
            "VAULT LEDGER SNAPSHOT",
            "vault-index.jsonl head advanced · chain valid",
            [
              { k: "entries", v: "12" },
              { k: "root", v: "feed-bridge-root" },
            ],
          ),
          ev(
            "ch-007",
            1_620,
            "fleet",
            "ok",
            "FLEET RESTART · mesh-demo",
            "operator console restart · port 3007",
            [
              { k: "port", v: "3007" },
              { k: "trigger", v: "console" },
            ],
          ),
          ev(
            "ch-006",
            2_010,
            "verdict",
            "fail",
            "VERDICT READING · TRACKED",
            "96 MB climb over 18.4k requests — request-attributed leak profile",
            [
              { k: "boot", v: "4100" },
              { k: "mbPer1k", v: "33.2" },
            ],
            "TRACKED",
          ),
          ev("ch-005", 2_640, "sync", "ok", "CARD CAPTURES SYNCED", "field device sync cycle 90", [
            { k: "batch", v: "90" },
            { k: "records", v: "172" },
          ]),
          ev(
            "ch-004",
            3_300,
            "drill",
            "fail",
            "DRILL CONTROL · readiness probe",
            "drill refused — port 3999 already bound",
            [
              { k: "port", v: "3999" },
              { k: "result", v: "FAILED" },
            ],
          ),
          ev(
            "ch-003",
            4_100,
            "save",
            "ok",
            "GUARDIAN SAVE · rss-over-guard",
            "oldPid 986 → newPid 1204",
            [
              { k: "port", v: "3000" },
              { k: "downtime", v: "19.8s" },
            ],
          ),
          ev(
            "ch-002",
            5_400,
            "snapshot",
            "ok",
            "VAULT LEDGER SNAPSHOT",
            "vault-index.jsonl head advanced",
            [{ k: "entries", v: "9" }],
          ),
          ev(
            "ch-001",
            6_100,
            "fleet",
            "warn",
            "FLEET RESTART · refused",
            "restart refused — cooldown active",
            [
              { k: "port", v: "3006" },
              { k: "reason", v: "cooldown" },
            ],
            "REFUSED",
          ),
        ];

        const count = (cls: ChronicleClass) => events.filter((e) => e.cls === cls).length;

        return Response.json(
          {
            generatedAtUtc: utcLabel(now),
            events,
            totals: {
              all: 47,
              save: 30,
              drill: 11,
              snapshot: 12,
              sync: 9,
              fleet: 3,
              verdict: 4,
              failed: count("drill") - 1,
              warned: 1,
            },
            sources: [
              {
                id: "guardian",
                file: "vvu-trust/guardian/bounces.jsonl",
                present: true,
                rows: 47,
                corrupt: 0,
              },
              { id: "vault", file: "vault-index.jsonl", present: true, rows: 12, corrupt: 0 },
              { id: "sync", file: "sync-journal.jsonl", present: true, rows: 9, corrupt: 0 },
              { id: "fleet", file: "fleet-restarts.jsonl", present: true, rows: 3, corrupt: 0 },
              {
                id: "verdict",
                file: "vvu-trust/verdict/readings.jsonl",
                present: true,
                rows: 4,
                corrupt: 0,
              },
            ],
            calibration: {
              bandLo: 16,
              bandHi: 32,
              boots: 3,
              settledBoots: 2,
              settledInBand: 1,
              perBoot: [
                {
                  pid: 4100,
                  readings: 2,
                  first: now - 3.7 * 3600_000,
                  last: now - 0.3 * 3600_000,
                  settlePct: 50,
                  inBand: false,
                  treePid: 4100,
                  ended: null,
                },
                {
                  pid: 1442,
                  readings: 1,
                  first: now - 4.2 * 3600_000,
                  last: null,
                  settlePct: null,
                  inBand: false,
                  treePid: 1442,
                  ended: {
                    reason: "rss-over-guard",
                    label: "SAVE",
                    at: utcLabel(now - 4.0 * 3600_000),
                    downtimeMs: 21_400,
                  },
                },
                {
                  pid: 1310,
                  readings: 1,
                  first: now - 2.2 * 3600_000,
                  last: null,
                  settlePct: null,
                  inBand: false,
                  treePid: 1310,
                  ended: {
                    reason: "port-down",
                    label: "SAVE",
                    at: utcLabel(now - 0.9 * 3600_000),
                    downtimeMs: 24_900,
                  },
                },
              ],
              latest: {
                at: utcLabel(now - 18 * 60_000),
                bootPid: 4100,
                devTreePid: 4100,
                kind: "flat",
                mbPer1k: null,
              },
              saves: {
                total: 30,
                byReason: { "rss-over-guard": 19, "port-down": 7, "manual-restart": 4 },
              },
            },
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
