// GET /api/icsh/ledger — the ledger as storage, paged.
//   ?mode=worm&source=ICSH|ALL&limit=…   → WORM chain entries (newest first)
//   ?mode=cycles&limit=…&before=seq      → ledger.jsonl lines (newest first)
//   ?mode=runs&limit=…                   → measured run history
import { NextResponse } from 'next/server';
import { getLedgerEntries, getLedgerEntriesBySource } from '@/lib/vvu-ledger';
import { listCycles, listRunStats } from '@/lib/icsh/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get('mode') ?? 'worm';
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit')) || 100));

    if (mode === 'cycles') {
      const beforeRaw = url.searchParams.get('before');
      const before = beforeRaw !== null ? Number(beforeRaw) : undefined;
      const cycles = await listCycles(limit, Number.isFinite(before) ? before : undefined);
      return NextResponse.json({ mode, cycles });
    }
    if (mode === 'runs') {
      const runs = await listRunStats(limit);
      return NextResponse.json({ mode, runs });
    }
    const source = (url.searchParams.get('source') ?? 'ICSH').toUpperCase();
    const entries = source === 'ALL' ? await getLedgerEntries(limit) : await getLedgerEntriesBySource('ICSH', limit);
    return NextResponse.json({ mode: 'worm', source, entries });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
