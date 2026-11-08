import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/bridge/take — proxy the control-plane take endpoint (:3004).
// The dashboard origin exposes the same path the E2E runner brief names:
// /api/bridge/take. JCS-signed payloads only — this proxy passes the body
// through untouched and never inspects, augments or signs anything (Log 5:
// sessions/headers grant nothing; the control plane reads credentials only).
const BRIDGE = 'http://127.0.0.1:3004';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text(); // raw passthrough — byte-exact body
    const res = await fetch(`${BRIDGE}/api/bridge/take`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      cache: 'no-store',
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'vault-bridge unreachable (is mini-service :3004 running?)' },
      { status: 502 },
    );
  }
}
