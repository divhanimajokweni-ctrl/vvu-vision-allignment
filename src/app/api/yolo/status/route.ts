import { NextResponse } from 'next/server';
import { YOLO_SPEC, type YoloStatusResponse } from '@/lib/vvu-gis';

// GET /api/yolo/status — SYS.03 YOLO EDGE AI status snapshot.
// Detection model truth (V8 NANO, 25R tracked, 14 critical alerts, >95%
// confidence, ~22 ms process time) with the threat level escalated when the
// live edge FSM is in a critical state (LEAK_ACTIVE / FAIL_CLOSED), and a
// small bounded process-time jitter so the LIVE readout breathes.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TELEMETRY_STATE_URL = 'http://127.0.0.1:3003/state';

interface SimStateShape {
  fsmState?: string;
}

async function fetchSimState(): Promise<SimStateShape | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(TELEMETRY_STATE_URL, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as SimStateShape;
  } catch {
    return null;
  }
}

export async function GET() {
  const sim = await fetchSimState();
  const online = sim !== null;
  const critical = sim?.fsmState === 'LEAK_ACTIVE' || sim?.fsmState === 'FAIL_CLOSED';

  // bounded deterministic jitter 20–24 ms around the 22 ms spec baseline
  const jitter = Math.floor((Date.now() / 1000) % 5);
  const processTimeMs = YOLO_SPEC.processTimeMs - 2 + jitter;

  const body: YoloStatusResponse = {
    detection: YOLO_SPEC.detection,
    tracked: YOLO_SPEC.tracked,
    alerts: YOLO_SPEC.alerts,
    model: YOLO_SPEC.model,
    confidence: YOLO_SPEC.confidence,
    process_time_ms: processTimeMs,
    threat: critical ? 'CRITICAL' : YOLO_SPEC.threat,
    engine: online ? 'ONLINE' : 'OFFLINE',
    ts: new Date().toISOString(),
  };
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
