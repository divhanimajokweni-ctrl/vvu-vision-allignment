import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { seedWorkspaceIfEmpty } from "@/lib/workspace/seed";
import { sha256 } from "@/lib/crypto/mmr";

export const dynamic = "force-dynamic";

// GET /api/account — current user profile + org + sessions + apiKeys + recent activity
export async function GET() {
  await seedWorkspaceIfEmpty();
  const user = await db.user.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      settings: true,
      sessions: { orderBy: { lastSeenAt: "desc" } },
      apiKeys: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!user) return NextResponse.json({ error: "no user" }, { status: 404 });

  // Recent account activity (last 3 invoices + aggregate policy counts)
  const recentInvoices = await db.invoice.findMany({
    orderBy: { issuedAt: "desc" },
    take: 3,
  });

  const [policyCount, mergeCount, evidenceCount] = await Promise.all([
    db.policy.count(),
    db.mergeProposal.count(),
    db.evidenceRecord.count(),
  ]);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarColor: user.avatarColor,
      role: user.role,
      orgName: user.orgName,
      orgTier: user.orgTier,
      publicKey: user.publicKey,
      keyFingerprint: user.keyFingerprint,
      bio: user.bio,
      title: user.title,
      location: user.location,
      timezone: user.timezone,
      locale: user.locale,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    },
    settings: user.settings,
    sessions: user.sessions.map((s) => ({
      id: s.id,
      label: s.label,
      userAgent: s.userAgent,
      lastSeenAt: s.lastSeenAt,
      createdAt: s.createdAt,
      revokedAt: s.revokedAt,
    })),
    apiKeys: user.apiKeys.map((k) => ({
      id: k.id,
      label: k.label,
      keyHint: k.keyHint,
      scopes: k.scopes,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
      revokedAt: k.revokedAt,
      createdAt: k.createdAt,
    })),
    activity: {
      policies: policyCount,
      merges: mergeCount,
      evidence: evidenceCount,
      recentInvoices: recentInvoices.map((i) => ({
        number: i.number,
        totalZAR: i.totalZAR,
        status: i.status,
        issuedAt: i.issuedAt,
      })),
    },
  });
}

// PATCH /api/account — update profile fields, optionally rotate Ed25519 key
export async function PATCH(req: Request) {
  await seedWorkspaceIfEmpty();
  const body = await req.json();
  const allowed = [
    "displayName",
    "bio",
    "title",
    "location",
    "timezone",
    "locale",
    "avatarColor",
    "orgName",
  ];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) data[k] = body[k];

  // Rotate Ed25519 key (founder action)
  if (body.rotateKey === true) {
    // Generate a fresh 32-byte hex key (note: real Ed25519 keygen would use a curve lib).
    // Used here as a deterministic-shape placeholder that still flows through sha256 for fingerprinting.
    const pub = Array.from(randomBytes(32))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    data.publicKey = pub;
    data.keyFingerprint = sha256(pub).slice(0, 16);
  }

  const user = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) return NextResponse.json({ error: "no user" }, { status: 404 });
  const updated = await db.user.update({ where: { id: user.id }, data });
  return NextResponse.json({ ok: true, user: updated });
}
