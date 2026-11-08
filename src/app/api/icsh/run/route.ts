// POST /api/icsh/run — run the 11-beat ICSH unified loop for N cycles
// (kilocode zoom-sim, deployed). Every figure in the response is measured at
// run time. Runs are serialized (run lock) so cycle ranges never overlap.
import { NextResponse } from 'next/server';
import { runIcshCycles, withRunLock } from '@/lib/icsh/engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { cycles?: number; runner?: string };
    const cycles = Number(body.cycles);
    if (!Number.isInteger(cycles) || cycles < 1 || cycles > 10000) {
      return NextResponse.json({ error: 'CYCLES must be an integer 1–10000' }, { status: 400 });
    }
    const runner = typeof body.runner === 'string' ? body.runner : 'OPERATOR';
    const result = await withRunLock(() => runIcshCycles(cycles, runner));
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
