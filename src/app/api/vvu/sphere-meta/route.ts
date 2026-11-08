import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/vvu/sphere-meta?meta=1 — Task 47 · disk-computed integrity facts
// for the trust-sphere artifact. Same discipline as the Municipal Twin
// (twin-scenario route): the md5 + byte count are COMPUTED FROM DISK on
// every request — never hardcoded, so the surface cannot lie about what is
// being served. The artifact itself is served statically from
// /vvu-trust/surfaces/trust-sphere/trust-sphere.html; this route is the
// provenance oracle the SphereFrame strip renders.

const ARTIFACT = path.join(
  process.cwd(),
  'public',
  'vvu-trust',
  'surfaces',
  'trust-sphere',
  'trust-sphere.html',
);

async function facts() {
  const buf = await readFile(ARTIFACT);
  const md5 = createHash('md5').update(buf).digest('hex');
  const sha256 = createHash('sha256').update(buf).digest('hex');
  return { md5, sha256, bytes: buf.byteLength, path: ARTIFACT };
}

export async function GET() {
  try {
    const f = await facts();
    return NextResponse.json(
      {
        md5: f.md5,
        sha256: f.sha256,
        bytes: f.bytes,
        file: 'trust-sphere.html',
        servedAt: new Date().toISOString(),
        computedFrom: 'disk',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'artifact read failed' },
      { status: 500 },
    );
  }
}
