import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedWorkspaceIfEmpty } from "@/lib/workspace/seed";

export const dynamic = "force-dynamic";

// GET /api/devices
// Returns all registered devices with their evidence counts.
// Query params: ?domain=WATER, ?status=ACTIVE, ?q=search (matches externalId/label)
export async function GET(req: Request) {
  await seedWorkspaceIfEmpty();
  const url = new URL(req.url);
  const domain = url.searchParams.get("domain");
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q");
  const where: Record<string, unknown> = {};
  if (domain) where.domain = domain;
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { externalId: { contains: q } },
      { label: { contains: q } },
    ];
  }
  const devices = await db.device.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { evidence: true } } },
  });
  return NextResponse.json({ devices, total: devices.length });
}

// POST /api/devices
// Register a new device. Body: { externalId, label, domain, primitive, lat, lng, firmwareVersion, hardwareKeyHint, pricingBand }
export async function POST(req: Request) {
  await seedWorkspaceIfEmpty();
  const body = await req.json().catch(() => null);
  if (!body || !body.externalId || !body.label) {
    return NextResponse.json(
      { error: "externalId and label required" },
      { status: 400 }
    );
  }
  try {
    const device = await db.device.create({
      data: {
        externalId: body.externalId,
        label: body.label,
        domain: body.domain || "WATER",
        primitive: body.primitive || "STATE",
        lat: Number(body.lat) || 0,
        lng: Number(body.lng) || 0,
        firmwareVersion: body.firmwareVersion || null,
        hardwareKeyHint: body.hardwareKeyHint || null,
        pricingBand: body.pricingBand || null,
        status: "ACTIVE",
      },
      include: { _count: { select: { evidence: true } } },
    });
    return NextResponse.json(device);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
