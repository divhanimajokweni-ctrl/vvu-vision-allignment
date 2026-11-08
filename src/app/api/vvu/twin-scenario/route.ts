import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// src/app/api/vvu/twin-scenario/route.ts — serves digital twin surfaces
// from public/twin/*.html and exposes integrity facts. md5 + bytes are
// COMPUTED FROM DISK on every request — never hardcoded.
//
//   GET /api/vvu/twin-scenario?list=1           → registry of all surfaces
//   GET /api/vvu/twin-scenario?scenario=<id>     → artifact HTML
//   GET /api/vvu/twin-scenario?scenario=<id>&meta=1 → { md5, bytes, ... }

const TWIN_DIR = join(process.cwd(), 'public', 'twin');
const DEFAULT_ID = 'cape_town_wildfire';

const SURFACE_META: Record<
  string,
  { title: string; subtitle: string; style: string; tileKind: string }
> = {
  cape_town_wildfire: {
    title: 'Municipal Twin — Cape Town Wildfire',
    subtitle: 'Canvas 2D · single file · zero deps · golden-hour scenario',
    style: 'Canvas 2D',
    tileKind: 'canvas',
  },
  google_photorealistic: {
    title: 'Digital Twin — Google Photorealistic Tiles',
    subtitle: 'Satellite · 3D mesh · MapLibre GL · photo true-color',
    style: 'Google Photoreal',
    tileKind: 'photoreal',
  },
  openlayers_tiles: {
    title: 'Digital Twin — OpenLayers Tiles',
    subtitle: 'OSM standard raster · EPSG:3857 · OpenLayers 9.2',
    style: 'OpenLayers',
    tileKind: 'openlayers',
  },
  dark_tiles: {
    title: 'Digital Twin — Dark Tiles',
    subtitle: 'CartoDB Dark Matter · Leaflet 1.9 · Gqeberha edge',
    style: 'Dark Matter',
    tileKind: 'dark',
  },
  openmaptiles_3d: {
    title: 'Digital Twin — OpenMapTiles 3D',
    subtitle: 'Vector · 3D buildings · MapLibre 4.7 · terrain mesh',
    style: 'OpenMapTiles 3D',
    tileKind: 'openmaptiles3d',
  },
  geo_bioteknik: {
    title: 'Geo-Bioteknik · Spatial Intelligence',
    subtitle: 'VVB engine · genomic terrain · living mesh · consequence map',
    style: 'Geo-Bioteknik SI',
    tileKind: 'engine',
  },
};

function safeId(id: string | null): string {
  if (!id || !/^[\w.-]+$/.test(id)) return DEFAULT_ID;
  return id;
}

function artifactPath(id: string) {
  return join(TWIN_DIR, `${id}.html`);
}

function artifactFacts(id: string) {
  const p = artifactPath(id);
  const buf = readFileSync(p);
  const md5 = createHash('md5').update(buf).digest('hex');
  const mtime = statSync(p).mtime.toISOString();
  return { md5, bytes: buf.byteLength, mtime };
}

function listSurfaces() {
  try {
    return readdirSync(TWIN_DIR)
      .filter((f) => f.endsWith('.html'))
      .map((f) => f.replace(/\.html$/, ''))
      .filter((id) => /^[\w.-]+$/.test(id))
      .map((id) => ({
        id,
        path: `public/twin/${id}.html`,
        ...(SURFACE_META[id] ?? { title: id, subtitle: '', style: 'Unknown', tileKind: 'unknown' }),
        ...artifactFacts(id),
      }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const servedAt = new Date().toISOString();
    if (q.get('list') === '1') {
      return NextResponse.json({ surfaces: listSurfaces(), servedAt });
    }
    const id = safeId(q.get('scenario'));
    const p = artifactPath(id);
    const facts = artifactFacts(id);
    if (q.get('meta') === '1') {
      return NextResponse.json({
        id,
        path: `public/twin/${id}.html`,
        ...(SURFACE_META[id] ?? { title: id, subtitle: '', style: 'Unknown', tileKind: 'unknown' }),
        ...facts,
        servedAt,
        honesty: 'SEED DATA · NOT LIVE',
      });
    }
    const html = readFileSync(p, 'utf-8');
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Artifact-Md5': facts.md5,
        'X-Artifact-Bytes': String(facts.bytes),
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? `ARTIFACT_UNREADABLE: ${e.message}` : 'ARTIFACT_UNREADABLE' },
      { status: 500 }
    );
  }
}
