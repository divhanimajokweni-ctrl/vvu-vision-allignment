import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/bridge/status — proxy the vault-bridge agent/pairing/receipt
// status so the dashboard can render it without a live socket (initial
// load) — live updates arrive over socket.io (?XTransformPort=3004).
const BRIDGE = 'http://127.0.0.1:3004';

export async function GET() {
  try {
    const res = await fetch(`${BRIDGE}/status`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: `bridge status HTTP ${res.status}` }, { status: 502 });
    }
    return NextResponse.json(await res.json(), { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'vault-bridge unreachable (is mini-service :3004 running?)' },
      { status: 502 },
    );
  }
}
