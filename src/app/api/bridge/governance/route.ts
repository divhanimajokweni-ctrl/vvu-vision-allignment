import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/bridge/governance            — governance ledger state (rules wired,
//                                         DH queue, revocations, registry, roots)
// GET /api/bridge/governance?verify=1   — full chain verify from genesis
// GET /api/bridge/governance?entry=<seq> — one entry + merkle inclusion proof
// Read-only proxy to the control plane (:3004).
const BRIDGE = 'http://127.0.0.1:3004';

export async function GET(req: NextRequest) {
  try {
    const verify = req.nextUrl.searchParams.get('verify');
    const entry = req.nextUrl.searchParams.get('entry');
    const target = verify
      ? `${BRIDGE}/api/bridge/governance/verify`
      : entry
        ? `${BRIDGE}/api/bridge/governance/entry/${encodeURIComponent(entry)}`
        : `${BRIDGE}/api/bridge/governance`;
    const res = await fetch(target, { cache: 'no-store' });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'vault-bridge unreachable (is mini-service :3004 running?)' },
      { status: 502 },
    );
  }
}
