import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/bridge/receipts — the vault-bridge receipt chain tail (and, with
// ?verify=1, a full chain recompute from genesis — the tamper check).
const BRIDGE = 'http://127.0.0.1:3004';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const verify = url.searchParams.get('verify') === '1';
  try {
    const res = await fetch(`${BRIDGE}/receipts${verify ? '/verify' : ''}`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: `bridge receipts HTTP ${res.status}` }, { status: 502 });
    }
    return NextResponse.json(await res.json(), { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'vault-bridge unreachable (is mini-service :3004 running?)' },
      { status: 502 },
    );
  }
}
