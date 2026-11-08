// GET /api/icsh/session/qr?nodeId=… — pairing card for a PENDING enrolment:
// returns the node's secret + otpauth URI so a REAL phone (Google
// Authenticator) can be paired. Once a node is ACTIVE the secret is never
// re-exposed (409) — a lost phone re-enrols via JOIN METHOD for a fresh
// secret. The phone grid computes its displayed codes from the SAME secret,
// so a paired real phone shows the SAME code as the simulated screen.
import { NextResponse } from 'next/server';
import { sessionQr } from '@/lib/icsh/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const nodeId = new URL(req.url).searchParams.get('nodeId');
    if (!nodeId) return NextResponse.json({ error: 'nodeId required' }, { status: 400 });
    const out = await sessionQr(nodeId);
    return NextResponse.json(out, { status: out.ok ? 200 : out.status });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
