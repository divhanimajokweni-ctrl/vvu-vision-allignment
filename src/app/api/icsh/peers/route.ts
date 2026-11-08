// GET  /api/icsh/peers — the 25-peer registry with live simulated gossip heads.
// POST /api/icsh/peers — ensure/reseed the registry (peers_seed.py lineage).
import { NextResponse } from 'next/server';
import { ensurePeers, listPeers } from '@/lib/icsh/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const peers = await listPeers();
    return NextResponse.json({ peers });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { count?: number };
    const count = Math.max(1, Math.min(100, Number(body.count) || 25));
    const total = await ensurePeers(count);
    const peers = await listPeers();
    return NextResponse.json({ ok: true, total, peers });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
