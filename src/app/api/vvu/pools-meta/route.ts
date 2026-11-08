// src/app/api/vvu/pools-meta/route.ts — Winter Pools surface metadata.
// Serves the provenance strip for the #/pools projection: the 8-file
// contract's on-disk census (path, bytes, sha256) read straight from
// public/pools/. Static whitelist only — no path traversal, no directory
// listing (same contract as twin-scenario / twin-docs / fleet-docs).
//
//   GET /api/vvu/pools-meta
//     → JSON { files: [{ path, bytes, sha256 }], totalBytes, count }

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

const FILES = [
  'pools/pools.css',
  'pools/wildfire/cape_town_wildfire.html',
  'pools/wildfire/wildfire-view.css',
  'pools/wildfire/wildfire-state.js',
  'pools/wildfire/wildfire-mesh-client.js',
  'pools/wildfire/wildfire-layers.js',
  'pools/wildfire/wildfire-evidence.js',
  'pools/wildfire/wildfire-sw.js',
];

const BASE = path.join(process.cwd(), 'public');

export async function GET() {
  try {
    const files = await Promise.all(
      FILES.map(async (rel) => {
        const abs = path.join(BASE, rel);
        const buf = await readFile(abs);
        const s = await stat(abs);
        return {
          path: `public/${rel}`,
          bytes: buf.byteLength,
          sha256: createHash('sha256').update(buf).digest('hex').slice(0, 16),
          mtime: s.mtime.toISOString(),
        };
      })
    );
    return NextResponse.json(
      {
        count: files.length,
        totalBytes: files.reduce((n, f) => n + f.bytes, 0),
        files,
      },
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch {
    return NextResponse.json({ error: 'pools surface unreadable on disk' }, { status: 500 });
  }
}
