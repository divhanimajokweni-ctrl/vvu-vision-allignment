// GET /api/icsh/sessions — the active PWA session table: unexpired,
// unrevoked sessions with node context (farm · district · tier) and the
// matched TOTP drift of each mint.
import { NextResponse } from 'next/server';
import { sessionsActive } from '@/lib/icsh/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ sessions: await sessionsActive() });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
