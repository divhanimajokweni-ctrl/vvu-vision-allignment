import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto/mmr";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

// POST /api/devices/[id]/fingerprint
// Re-verify the device's hardware key fingerprint. Generates a fresh
// hardwareKeyHint (first 8 chars of sha256 of a new random key) and bumps
// lastSeenAt to now. Returns the new hint.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await db.device.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "device not found" }, { status: 404 });
  }
  // Simulate a fresh hardware key attestation: 32 random bytes → pubkey fingerprint.
  const newKey = randomBytes(32).toString("hex");
  const fullFingerprint = sha256(newKey);
  const hint = fullFingerprint.slice(0, 8);
  const updated = await db.device.update({
    where: { id },
    data: {
      hardwareKeyHint: hint,
      lastSeenAt: new Date(),
    },
    select: {
      id: true,
      externalId: true,
      hardwareKeyHint: true,
      lastSeenAt: true,
    },
  });
  return NextResponse.json({
    ok: true,
    hardwareKeyHint: hint,
    lastSeenAt: updated.lastSeenAt,
    deviceId: updated.id,
    externalId: updated.externalId,
    // Full fingerprint is intentionally NOT returned — only the 8-char hint is exposed,
    // mirroring the on-device key custody model.
  });
}
