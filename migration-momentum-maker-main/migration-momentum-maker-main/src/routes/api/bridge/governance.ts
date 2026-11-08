import { createFileRoute } from "@tanstack/react-router";

// GET /api/bridge/governance — the vault-bridge control-plane ledger (feed
// recreation of the :3004 proxy). Hash-linked entries, six wired rules, DH
// queue and registered devices.

interface GovernanceRule {
  ruleId: string;
  wiredAt: string;
  entrySeq: number;
  actorDevId: string;
}

interface GovernanceDhQueueItem {
  id: string;
  devId: string;
  ruleId: string;
  reason: string;
  at: string;
  status: string;
}

interface GovernanceDev {
  devId: string;
  label: string;
  scope: string;
  registeredAt: string;
  expiresAt: string | null;
  revoked: boolean;
}

const GENESIS = "GOV-GENESIS-20260901-0000000000000000000000000000000000";

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

const now = Date.now();
const iso = (agoMin: number) => new Date(now - agoMin * 60_000).toISOString();

const head = fakeHash("gov-head-" + iso(12));
const merkleRoot = fakeHash("gov-merkle-" + iso(12));

export const Route = createFileRoute("/api/bridge/governance")({
  server: {
    handlers: {
      GET: async () => {
        const rules: GovernanceRule[] = ["LOG_2", "LOG_3", "LOG_4", "LOG_5", "LOG_6", "LOG_7"].map(
          (ruleId, i) => ({
            ruleId,
            wiredAt: iso(8_000 - i * 140),
            entrySeq: 12 + i,
            actorDevId: "obsidian-pixel-7a",
          }),
        );

        const dhQueue: GovernanceDhQueueItem[] = [
          {
            id: "dh-041",
            devId: "field-tab-m55",
            ruleId: "LOG_4",
            reason: "session key rotation due",
            at: iso(38),
            status: "PENDING",
          },
        ];

        const devs: GovernanceDev[] = [
          {
            devId: "obsidian-pixel-7a",
            label: "Obsidian vault · Pixel 7a",
            scope: "vault:read+write",
            registeredAt: iso(12_000),
            expiresAt: null,
            revoked: false,
          },
          {
            devId: "field-tab-m55",
            label: "Field onboard · Galaxy Tab M55",
            scope: "field-store:read+write",
            registeredAt: iso(9_600),
            expiresAt: iso(-52_560),
            revoked: false,
          },
        ];

        return Response.json(
          {
            genesis: GENESIS,
            count: 18,
            head,
            chainValid: true,
            merkleRoot,
            rules,
            dhQueue,
            dhQueuePending: dhQueue.length,
            revoked: [],
            devs,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
