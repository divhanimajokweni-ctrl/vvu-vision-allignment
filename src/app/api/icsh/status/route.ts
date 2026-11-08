import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { getIcshStatus } = await import('@/lib/icsh/engine');
    const status = await getIcshStatus();
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({
      head: null,
      ledgerCount: 0,
      peerCount: 0,
      nodeCount: 0,
      runCount: 0,
      contractRef: null,
      throughput: 0,
      online: false,
    });
  }
}
