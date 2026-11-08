// src/app/api/vvu/twin-docs/route.ts — Round 32 · twin surface documents.
// Serves the canonical vvu-trust/surfaces/twin/ markdown straight from disk
// (the repo file IS the single source — the app renders, it does not fork).
// Static whitelist only: no path traversal, no directory listing.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

const DOCS: Record<string, string> = {
  env_sync: 'surfaces/twin/ENVIRONMENTAL_STATE_SYNC.md',
  twin_viewer: 'surfaces/twin/TWIN_VIEWER_SPEC.md',
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('doc') ?? '';
  const rel = DOCS[id];
  if (!rel) {
    return NextResponse.json({ error: 'unknown doc id' }, { status: 404 });
  }
  try {
    const markdown = await readFile(path.join(process.cwd(), 'vvu-trust', rel), 'utf8');
    return NextResponse.json(
      { id, path: `vvu-trust/${rel}`, bytes: markdown.length, markdown },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'doc unreadable on disk' }, { status: 500 });
  }
}
