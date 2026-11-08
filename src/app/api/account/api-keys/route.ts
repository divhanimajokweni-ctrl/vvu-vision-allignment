import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { seedWorkspaceIfEmpty } from "@/lib/workspace/seed";
import { sha256 } from "@/lib/crypto/mmr";

export const dynamic = "force-dynamic";

// POST /api/account/api-keys — create a new api key.
// Body: { label, scopes }
// Generates `vvu_live_` + 12 random hex chars; stores sha256(plaintext) as keyHash,
// returns the plaintext ONCE in the response (never retrievable again).
export async function POST(req: NextRequest) {
  await seedWorkspaceIfEmpty();
  const body = await req.json().catch(() => ({}));
  const label: string = (body.label ?? "New API key").toString().slice(0, 80);
  const scopes: string = (body.scopes ?? "read").toString().slice(0, 60);

  const user = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) return NextResponse.json({ error: "no user" }, { status: 404 });

  // Generate plaintext key: vvu_live_ + 12 random hex chars
  const randHex = Array.from(randomBytes(6))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const plaintext = `vvu_live_${randHex}`;
  const keyHint = plaintext.slice(0, 9); // "vvu_live_"
  const keyHash = sha256(plaintext);

  const created = await db.apiKey.create({
    data: {
      userId: user.id,
      label,
      keyHint,
      keyHash,
      scopes,
      lastUsedAt: null,
    },
  });

  // Return the plaintext ONE TIME only — never retrievable again.
  return NextResponse.json({
    ok: true,
    apiKey: {
      id: created.id,
      label: created.label,
      keyHint: created.keyHint,
      scopes: created.scopes,
      createdAt: created.createdAt,
    },
    // ⚠️ Plaintext — only ever returned at creation time.
    plaintext,
  });
}
