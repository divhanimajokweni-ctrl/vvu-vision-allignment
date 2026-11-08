import { NextResponse } from "next/server";
import { getStats } from "@/skylantern/server/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const stats = await getStats();
  return NextResponse.json({ stats });
}
