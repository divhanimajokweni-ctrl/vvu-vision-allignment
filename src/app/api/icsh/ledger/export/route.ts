// GET /api/icsh/ledger/export — download ledger.jsonl (every cycle line,
// ascending, plus the on-chain anchors). The auditor takes only this file.
import { exportLedgerJsonl } from '@/lib/icsh/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const jsonl = await exportLedgerJsonl();
    return new Response(jsonl, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-disposition': 'attachment; filename="ledger.jsonl"',
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    return new Response(String(e instanceof Error ? e.message : e), { status: 500 });
  }
}
