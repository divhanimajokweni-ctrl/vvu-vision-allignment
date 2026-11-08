// POST /api/icsh/session/login — the worker types their 6-digit code into
// the PWA: REAL TOTP verify (HMAC-SHA1 · RFC 6238 · ±1 step) server-side,
// then a 15-minute session is minted (SESSION_MINTED on the WORM chain). A
// PENDING node's first successful login also completes its join
// (JOIN_COMMITTED). Rejections are LOGIN_REJECTED events — nothing minted.
import { NextResponse } from 'next/server';
import { sessionLogin } from '@/lib/icsh/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { nodeId?: string; code?: string };
    if (!body.nodeId) return NextResponse.json({ error: 'nodeId required' }, { status: 400 });
    const outcome = await sessionLogin(String(body.nodeId), String(body.code ?? ''));
    return NextResponse.json(outcome, { status: outcome.ok ? 200 : outcome.status });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
