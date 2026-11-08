import { NextResponse } from 'next/server';
import { readCiState } from '@/lib/vvu/ci-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/vvu/ci-state — Android APK CI validation state (disk-canonical
// JSON behind it; see src/lib/vvu/ci-state.ts). Always 200 with { ok } —
// the panel renders the degraded branch when ok is false.

export async function GET() {
  const payload = await readCiState();
  return NextResponse.json(payload, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
