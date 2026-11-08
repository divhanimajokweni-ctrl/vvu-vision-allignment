// src/app/api/vvu/fleet-docs/route.ts — Round 33 · fleet + blog documents.
// Serves the canonical vvu-trust/fleet/*.md and the published blog post
// straight from disk (the repo file IS the single source — the app renders,
// it does not fork). Also serves the blog hero image bytes.
// Static whitelist only: no path traversal, no directory listing.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

const DOCS: Record<string, string> = {
  mesh_spec: 'fleet/DEVICE_MESH_SPEC.md',
  discovery: 'fleet/DEVICE_DISCOVERY_PROTOCOL.md',
  consent: 'fleet/UNIFIED_CONSENT_MODEL.md',
  onboarding: 'fleet/ONBOARDING_FLOW.md',
  pipeline_catalog: 'fleet/PIPELINE_CATALOG.md',
  pipeline_engine: 'fleet/PIPELINE_ENGINE_SPEC.md',
  blog_post: 'blog/2026-09-20-four-smart-purchases-one-mesh.md',
};

const ASSETS: Record<string, { rel: string; type: string }> = {
  hero: { rel: 'blog/assets/hero-four-smart-purchases.jpg', type: 'image/jpeg' },
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const doc = url.searchParams.get('doc') ?? '';
  const asset = url.searchParams.get('asset') ?? '';

  if (asset) {
    const a = ASSETS[asset];
    if (!a) {
      return NextResponse.json({ error: 'unknown asset id' }, { status: 404 });
    }
    try {
      const bytes = await readFile(path.join(process.cwd(), 'vvu-trust', a.rel));
      return new NextResponse(new Uint8Array(bytes), {
        headers: { 'content-type': a.type, 'cache-control': 'no-store' },
      });
    } catch {
      return NextResponse.json({ error: 'asset unreadable on disk' }, { status: 500 });
    }
  }

  const rel = DOCS[doc];
  if (!rel) {
    return NextResponse.json({ error: 'unknown doc id' }, { status: 404 });
  }
  try {
    const markdown = await readFile(path.join(process.cwd(), 'vvu-trust', rel), 'utf8');
    return NextResponse.json(
      { id: doc, path: `vvu-trust/${rel}`, bytes: markdown.length, markdown },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'doc unreadable on disk' }, { status: 500 });
  }
}
