import { createFileRoute } from "@tanstack/react-router";

let cycles = 24;
const beats = [
  "LOG",
  "SYNC",
  "WIPE",
  "COMPARE",
  "INGEST",
  "INFER",
  "MINT",
  "SHIP",
  "WIPE",
  "RETRIEVE",
  "WATCHDOG",
];
function head(n: number) {
  return n.toString(16).padStart(64, "0");
}
function status() {
  const now = Date.now();
  const history = Array.from({ length: cycles }, (_, i) => ({
    cycle: i + 1,
    ts: (now - (cycles - i) * 30000) / 1000,
    seed_head: head(i + 1),
    network_head: head(i + 1),
    mint_head: head(i + 1),
    agreement: true,
    peers_reachable: 25,
    bucket: i % 5,
    beats: beats.length,
    vault_count: i + 1,
    ms: 92 + ((i * 13) % 28),
  }));
  const bytes = new TextEncoder().encode(
    history.map((x) => JSON.stringify(x) + "\n").join(""),
  ).length;
  return {
    ok: true,
    at: new Date(now).toISOString(),
    beats,
    ledger: {
      exists: true,
      lines: history.length,
      bytes,
      meanLineBytes: bytes / history.length,
      history,
      last: history.at(-1) ?? null,
    },
    seed: { exists: true, bytes: 32 },
    peers: { exists: true, count: 25, first: "sim-peer-01" },
    vault: {
      exists: true,
      count: cycles,
      last: `cycle_${String(cycles).padStart(5, "0")}.md`,
      dir: "simulated/Watchdog",
    },
    chain: {
      exists: true,
      entries: cycles,
      head: head(cycles),
      lastEntry: { name: "WATCHDOG", ts: now / 1000 },
    },
    receipt: {
      exists: true,
      receipt: "SIMULATED_BOOTSTRAP",
      tier: "LOCAL_REF",
      steps: beats.length,
      n_probes_changed: 4,
      before_head: head(0),
      after_head: head(cycles),
      probes: { seed: "present", peers: "25 reachable", ledger: "valid", vault: "available" },
    },
  };
}
export const Route = createFileRoute("/api/vvu/flywheel")({
  server: {
    handlers: {
      GET: async () => Response.json(status()),
      POST: async ({ request }) => {
        let b: unknown;
        try {
          b = await request.json();
        } catch {
          return Response.json({ error: "invalid JSON body" }, { status: 400 });
        }
        const action = (b as { action?: unknown } | null)?.action;
        if (action !== "cycles" && action !== "verify" && action !== "bootstrap")
          return Response.json(
            {
              error: `unknown action ${JSON.stringify(action ?? null)} — expected cycles | verify | bootstrap`,
            },
            { status: 400 },
          );
        if (action === "cycles") cycles += 5;
        return Response.json({
          ok: true,
          exitCode: 0,
          action,
          stdout: `SIMULATED ${action}: ${cycles} cycles; chain valid; 25 peers reachable. No Python process executed.`,
          stderr: "",
        });
      },
    },
  },
});
