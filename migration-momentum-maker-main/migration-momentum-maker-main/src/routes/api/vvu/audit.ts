import { createFileRoute } from "@tanstack/react-router";

interface AuditRow {
  id: string;
  tenantId: string;
  actor: string;
  action: string;
  fromState: string | null;
  toState: string | null;
  symbol: string | null;
  reason: string | null;
  metadata: string | null;
  createdAt: string;
}
export function simulatedAudits(): AuditRow[] {
  const now = Math.floor(Date.now() / 60000) * 60000;
  return Array.from({ length: 50 }, (_, i) => ({
    id: `sim-audit-${50 - i}`,
    tenantId: "e1002324-0000-0000-0000-000000000001",
    actor: "simulated-guardian",
    action: "STATE_TRANSITION",
    fromState: i % 3 === 0 ? "PAIRING_BLE" : "STEADY_STATE_LOCKED",
    toState: i % 3 === 0 ? "TOTP_VERIFICATION" : "STEADY_STATE_LOCKED",
    symbol: i % 3 === 0 ? "CHAL" : "CLICK",
    reason: i % 3 === 0 ? "Challenge accepted" : "Periodic steady-state verification",
    metadata: JSON.stringify({ simulated: true, nodeId: `VVU-${(i % 3) + 1}` }),
    createdAt: new Date(now - i * 120000).toISOString(),
  }));
}
export const Route = createFileRoute("/api/vvu/audit")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const n = parseInt(new URL(request.url).searchParams.get("limit") || "50");
        if (!Number.isFinite(n))
          return Response.json({ error: "Error: Invalid limit" }, { status: 500 });
        const audits = simulatedAudits().slice(0, Math.max(0, n));
        return Response.json({ total: simulatedAudits().length, entries: audits });
      },
    },
  },
});
