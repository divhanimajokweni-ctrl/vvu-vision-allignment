import { NextResponse } from 'next/server';
import { GIS_ANCHORS, GIS_COORDS_PRIMARY, GIS_SPEC, type GisStatusResponse } from '@/lib/vvu-gis';

// GET /api/gis/status — SYS.02 GIS SPATIAL TRUTH status snapshot.
// Static spec truth (GEO_GRID alignment is a design invariant — always true),
// with the engine bit derived from the telemetry mini-service health so the
// read-only status endpoint stays honest about the live runtime.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TELEMETRY_HEALTH_URL = 'http://127.0.0.1:3003/healthz';

async function engineOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(TELEMETRY_HEALTH_URL, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  const online = await engineOnline();
  const body: GisStatusResponse = {
    map_sync: GIS_SPEC.mapSync,
    layers: GIS_SPEC.layers,
    accuracy: GIS_SPEC.accuracy,
    coords: GIS_COORDS_PRIMARY,
    source: GIS_SPEC.source,
    engine: online ? GIS_SPEC.engineOnline : GIS_SPEC.engineOffline,
    update_rt: online ? GIS_SPEC.updateRt : 'FROZEN',
    anchors: {
      pe: { ...GIS_ANCHORS.pe },
      jhb: { ...GIS_ANCHORS.jhb },
    },
    ts: new Date().toISOString(),
  };
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
