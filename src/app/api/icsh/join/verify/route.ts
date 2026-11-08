// POST /api/icsh/join/verify — VERIFY step: check the 6-digit TOTP code, and
// on success commit the join to the WORM chain + mint the receipt (RECEIPT).
import { NextResponse } from 'next/server';
import { joinVerify } from '@/lib/icsh/join';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { nodeId?: string; code?: string };
    if (!body.nodeId) return NextResponse.json({ error: 'nodeId required' }, { status: 400 });
    const outcome = await joinVerify(String(body.nodeId), String(body.code ?? ''));
    return NextResponse.json(
      outcome.ok ? outcome.receipt : { error: outcome.error },
      { status: outcome.ok ? 200 : outcome.status }
    );
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
