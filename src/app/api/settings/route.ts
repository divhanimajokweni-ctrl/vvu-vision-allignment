import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedWorkspaceIfEmpty } from "@/lib/workspace/seed";

export const dynamic = "force-dynamic";

// GET /api/settings — fetch the founder user's settings (create default if missing)
export async function GET() {
  await seedWorkspaceIfEmpty();
  const user = await db.user.findFirst({
    orderBy: { createdAt: "asc" },
    include: { settings: true },
  });
  if (!user) return NextResponse.json({ error: "no user" }, { status: 404 });
  if (!user.settings) {
    const s = await db.userSettings.create({ data: { userId: user.id } });
    return NextResponse.json(s);
  }
  return NextResponse.json(user.settings);
}

// PATCH /api/settings — partial update of the founder's UserSettings row
export async function PATCH(req: Request) {
  await seedWorkspaceIfEmpty();
  const body = await req.json();
  const user = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) return NextResponse.json({ error: "no user" }, { status: 404 });
  const allowed = [
    "theme",
    "accentColor",
    "density",
    "fontSize",
    "sidebarCollapsed",
    "defaultDomain",
    "defaultShardStrategy",
    "emailNotifications",
    "inAppNotifications",
    "slackWebhook",
    "alertOnViolations",
    "alertOnMerges",
    "alertOnShadowTakeover",
    "alertOnMinedInvariants",
    "telemetryOptIn",
    "errorReportingOptIn",
    "dataRetentionDays",
  ];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) data[k] = body[k];
  const updated = await db.userSettings.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data } as never,
  });
  return NextResponse.json(updated);
}
