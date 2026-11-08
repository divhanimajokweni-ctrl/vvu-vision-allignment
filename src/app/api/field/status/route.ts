import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/field/status — proxy the vvu-field-onboard agent/pairing/receipt
// status so the dashboard can render it without a live socket (initial
// load) — live updates arrive over socket.io (?XTransformPort=3005).
const FIELD = 'http://127.0.0.1:3005';

export async function GET() {
  try {
    const res = await fetch(`${FIELD}/status`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: `field status HTTP ${res.status}` }, { status: 502 });
    }
    return NextResponse.json(await res.json(), { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'vvu-field-onboard unreachable (is mini-service :3005 running?)' },
      { status: 502 },
    );
  }
}
