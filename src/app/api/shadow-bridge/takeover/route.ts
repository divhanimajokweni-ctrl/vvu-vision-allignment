import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/shadow-bridge/takeover — simulate the shadow bridge taking authority
// Body: { policyId }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { policyId } = body as { policyId?: string };
  if (!policyId) return NextResponse.json({ error: "policyId required" }, { status: 400 });
  const policy = await db.policy.findUnique({ where: { id: policyId } });
  if (!policy) return NextResponse.json({ error: "policy not found" }, { status: 404 });
  if (!policy.shadowEnabled) {
    return NextResponse.json(
      { error: "shadow bridge not enabled for this policy" },
      { status: 400 },
    );
  }

  const shard = await db.shard.findFirst({ where: { policyId } });
  const liveState = shard ? JSON.parse(shard.state) : {};
  const shadowState = { ...liveState, takeover_applied: true, shadow_authority: true };

  const event = await db.shadowEvent.create({
    data: {
      policyId,
      kind: "takeover",
      summary: `Shadow bridge assumed authority (latency ${policy.takeoverLatencyMs ?? 250}ms)`,
      liveState: JSON.stringify(liveState),
      shadowState: JSON.stringify(shadowState),
      divergence: 0,
      authoritative: true,
    },
  });

  return NextResponse.json({ ok: true, event });
}
