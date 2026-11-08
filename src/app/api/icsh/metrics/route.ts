// GET /api/icsh/metrics — THE COST MATRIX: measured throughput, measured
// bytes-per-unit, projected monthly volumes at two cadences, ZAR estimates
// with every assumption on the surface.
import { NextResponse } from 'next/server';
import { getIcshMetrics } from '@/lib/icsh/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const metrics = await getIcshMetrics();
    return NextResponse.json(metrics);
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
