// POST /api/icsh/session/revoke — retire one session ({ sessionId }) or all
// active sessions ({ all: true }). Every revocation is a SESSION_REVOKED
// event on the WORM chain (POPIA right-to-revoke, honoured).
import { NextResponse } from 'next/server';
import { sessionRevoke, sessionRevokeAll } from '@/lib/icsh/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { sessionId?: string; all?: boolean };
    if (body.all) {
      const out = await sessionRevokeAll();
      return NextResponse.json({ ok: true, revoked: out.revoked });
    }
    if (!body.sessionId) return NextResponse.json({ error: 'sessionId or all required' }, { status: 400 });
    const out = await sessionRevoke(String(body.sessionId));
    return NextResponse.json(out, { status: out.ok ? 200 : 409 });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
