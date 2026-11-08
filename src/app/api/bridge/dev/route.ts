import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/bridge/dev — proxy devID registration (proof-of-possession,
// signed by the key being registered). Raw-body passthrough, same reasons
// as /api/bridge/take.
const BRIDGE = 'http://127.0.0.1:3004';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const res = await fetch(`${BRIDGE}/api/bridge/dev`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      cache: 'no-store',
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'vault-bridge unreachable (is mini-service :3004 running?)' },
      { status: 502 },
    );
  }
}
