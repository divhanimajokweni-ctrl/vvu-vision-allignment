// POST /api/icsh/join/setup — LOCATE step: validate identity, open enrolment,
// mint a fresh TOTP secret (never shown again in full by public reads).
import { NextResponse } from 'next/server';
import { joinSetup } from '@/lib/icsh/join';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { callsign?: string; farm?: string; district?: string };
    const outcome = await joinSetup(
      String(body.callsign ?? ''),
      String(body.farm ?? ''),
      String(body.district ?? '')
    );
    return NextResponse.json(outcome.ok ? outcome.setup : { error: outcome.error }, { status: outcome.ok ? 200 : outcome.status });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
