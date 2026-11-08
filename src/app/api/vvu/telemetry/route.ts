import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateTelemetry, TelemetryPayload } from '@/lib/vvu-telemetry';
import { appendWormEvent } from '@/lib/vvu-ledger';
import { GQEBERHA_TENANT_ID } from '@/lib/vvu-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/vvu/telemetry — ingestEdgeTelemetry
// Validates against SANS hydraulic invariants + APU thermal thresholds,
// persists to telemetry_logs (RLS-scoped tenant), appends a WORM event on
// FSM state changes, and returns the validation result.
export async function POST(req: NextRequest) {
  let body: TelemetryPayload;
  try {
    body = (await req.json()) as TelemetryPayload;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.nodeId || typeof body.flowRate !== 'number' || typeof body.apuTemperature !== 'number') {
    return NextResponse.json(
      { success: false, message: 'Missing required fields: nodeId, flowRate, apuTemperature' },
      { status: 422 }
    );
  }

  const result = validateTelemetry(body);

  try {
    const log = await db.telemetryLog.create({
      data: {
        tenantId: body.tenantId || GQEBERHA_TENANT_ID,
        nodeId: body.nodeId,
        flowRate: body.flowRate,
        pressureHead: body.pressureHead ?? 0,
        acousticAbnormal: body.acousticAbnormal ?? false,
        apuTemperature: body.apuTemperature,
        systemState: result.state,
        estimatedCelerity: result.estimatedCelerity,
        invariantOk: result.invariantOk,
      },
    });

    // WORM-bind FSM state transitions coming from the edge.
    if (result.state !== 'STEADY_STATE_LOCKED') {
      await appendWormEvent({
        source: 'TELEMETRY',
        event: `INGEST_${result.state}`,
        details: `node ${body.nodeId} · flow ${body.flowRate.toFixed(1)} L/s · head ${(body.pressureHead ?? 0).toFixed(1)} m · ${result.invariantOk ? 'invariants OK' : 'INVARIANT VIOLATION'} · celerity ${result.estimatedCelerity} m/s`,
      });
    }

    return NextResponse.json({ ...result, logId: log.id, persisted: true }, { status: result.success ? 200 : 422 });
  } catch (e) {
    // DB unavailable — fall back to in-memory result
    return NextResponse.json(
      { ...result, persisted: false, dbError: e instanceof Error ? e.message : 'Unknown' },
      { status: result.success ? 200 : 422 }
    );
  }
}

// GET /api/vvu/telemetry?limit=60 — recent persisted telemetry logs
export async function GET(req: NextRequest) {
  const limit = Math.min(200, Number(req.nextUrl.searchParams.get('limit') ?? '60'));
  try {
    const logs = await db.telemetryLog.findMany({
      where: { tenantId: GQEBERHA_TENANT_ID },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return NextResponse.json({
      total: logs.length,
      logs: logs.map((l) => ({
        id: l.id,
        nodeId: l.nodeId,
        flowRate: l.flowRate,
        pressureHead: l.pressureHead,
        acousticAbnormal: l.acousticAbnormal,
        apuTemperature: l.apuTemperature,
        systemState: l.systemState,
        estimatedCelerity: l.estimatedCelerity,
        invariantOk: l.invariantOk,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
