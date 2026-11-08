// GET /api/icsh/session/tick — the phone-grid heartbeat: every onboarded
// phone with the code Google Authenticator would show right now (computed
// server-side from the on-chain secret), live session counts and the WORM
// chain tip. Idempotently seeds the demo worker cohort on first open (each
// member through the REAL joinSetup path → ENROLMENT_OPEN on chain).
import { NextResponse } from 'next/server';
import { sessionTick } from '@/lib/icsh/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await sessionTick());
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
