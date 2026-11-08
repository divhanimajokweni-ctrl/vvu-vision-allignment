import { NextRequest, NextResponse } from 'next/server';
import { appendWormEvent, getLedgerEntries, getLedgerEntriesBefore, getLedgerEntriesBySource, seedLedger, verifyChain } from '@/lib/vvu-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/vvu/ledger?limit=100&source=MANIFEST&before=<seq>
// Seeds the manifest (idempotent), returns WORM entries + chain integrity.
// Optional source filter (e.g. source=MANIFEST → the 19 release assets).
// Task 7-a: `before` = cursor (seq) for backwards pagination — returns entries
// with seq < before, so the UI can page through the full chain 50 at a time.
export async function GET(req: NextRequest) {
  try {
    await seedLedger();
    const limit = Math.min(500, Number(req.nextUrl.searchParams.get('limit') ?? '100'));
    const source = req.nextUrl.searchParams.get('source');
    const beforeRaw = Number(req.nextUrl.searchParams.get('before') ?? '');
    const before = Number.isFinite(beforeRaw) && beforeRaw > 0 ? beforeRaw : null;
    let entries;
    if (before !== null) {
      entries = await getLedgerEntriesBefore(before, limit);
    } else if (source) {
      entries = await getLedgerEntriesBySource(source, limit);
    } else {
      entries = await getLedgerEntries(limit);
    }
    const chain = await verifyChain();
    return NextResponse.json({ ...chain, entries });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/vvu/ledger { source, event, details }
// Append-only WORM write. Hash-chained to the previous entry.
export async function POST(req: NextRequest) {
  let body: { source?: string; event?: string; details?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.source || !body.event) {
    return NextResponse.json(
      { success: false, message: 'Missing required fields: source, event' },
      { status: 422 }
    );
  }
  try {
    const entry = await appendWormEvent({
      source: body.source.slice(0, 40),
      event: body.event.slice(0, 80),
      details: body.details?.slice(0, 400),
    });
    return NextResponse.json({ success: true, entry });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
