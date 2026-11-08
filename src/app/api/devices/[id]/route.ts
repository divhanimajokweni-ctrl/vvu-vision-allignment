import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/devices/[id]
// Fetch a single device with evidence count + 5 most recent evidence records
// + 5 most recent audit events.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const device = await db.device.findUnique({
    where: { id },
    include: {
      _count: { select: { evidence: true } },
      evidence: {
        orderBy: { observedAt: "desc" },
        take: 5,
        select: {
          id: true,
          hash: true,
          verificationState: true,
          tierTag: true,
          subject: true,
          source: true,
          observedAt: true,
          signedAt: true,
        },
      },
    },
  });
  if (!device) {
    return NextResponse.json({ error: "device not found" }, { status: 404 });
  }
  // Pull the most recent audit events across this device's evidence records.
  const auditEvents = await db.auditEvent.findMany({
    where: { evidenceId: { in: device.evidence.map((e) => e.id) } },
    orderBy: { at: "desc" },
    take: 5,
    select: {
      id: true,
      action: true,
      fromState: true,
      toState: true,
      actor: true,
      note: true,
      at: true,
    },
  });
  return NextResponse.json({ device, auditEvents });
}

// PATCH /api/devices/[id]
// Update label, firmwareVersion, status, or pricingBand.
// Status transitions: ACTIVE↔DORMANT, ACTIVE→RETIRED (one-way), DORMANT→RETIRED (one-way).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const existing = await db.device.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "device not found" }, { status: 404 });
  }
  // Status transition validation.
  if (body.status && body.status !== existing.status) {
    const from = existing.status;
    const to = body.status;
    const allowed =
      (from === "ACTIVE" && (to === "DORMANT" || to === "RETIRED")) ||
      (from === "DORMANT" && (to === "ACTIVE" || to === "RETIRED"));
    if (!allowed) {
      return NextResponse.json(
        {
          error: `invalid status transition: ${from} → ${to}. RETIRED is terminal; only ACTIVE↔DORMANT is reversible.`,
        },
        { status: 400 }
      );
    }
  }
  const data: Record<string, unknown> = {};
  if (typeof body.label === "string" && body.label.trim()) data.label = body.label.trim();
  if (body.firmwareVersion !== undefined) data.firmwareVersion = body.firmwareVersion || null;
  if (body.pricingBand !== undefined) data.pricingBand = body.pricingBand || null;
  if (body.status) data.status = body.status;
  const updated = await db.device.update({
    where: { id },
    data,
    include: { _count: { select: { evidence: true } } },
  });
  return NextResponse.json(updated);
}

// DELETE /api/devices/[id]
// Only allowed if the device has 0 evidence records.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const device = await db.device.findUnique({
    where: { id },
    include: { _count: { select: { evidence: true } } },
  });
  if (!device) {
    return NextResponse.json({ error: "device not found" }, { status: 404 });
  }
  if (device._count.evidence > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete device with evidence — retire it instead",
        evidenceCount: device._count.evidence,
      },
      { status: 400 }
    );
  }
  await db.device.delete({ where: { id } });
  return NextResponse.json({ ok: true, id });
}
