// src/app/api/proximity/anchor/bundle/route.ts
// THE OFF-BOX BUNDLE EXPOSED — GET exports the anchor ledger as a portable,
// hash-covered bundle (evidence that travels); POST replays a received
// bundle against the live chain (integrity first, then every anchor).

import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { exportAnchorBundle, verifyAnchorBundle } from '@/server/proximity/bundle';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { bundle, fileName } = await exportAnchorBundle(db);
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="${fileName}"`,
      'x-vvu-bundle-hash': bundle.bundleHash,
      'x-vvu-bundle-anchors': String(bundle.anchors.length),
    },
  });
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'request body is not JSON — paste a vvu.anchor-bundle.v1 document' },
      { status: 400 },
    );
  }
  try {
    const { ok, result } = await verifyAnchorBundle(db, raw);
    return NextResponse.json({ ok, result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'bundle verification failed' },
      { status: 500 },
    );
  }
}
