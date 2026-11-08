import { NextResponse } from "next/server";
import { getChain } from "@/skylantern/server/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const blocks = await getChain(60);
  return NextResponse.json({ blocks, count: blocks.length });
}
