import { NextResponse } from 'next/server';
import { z } from 'zod';
import { appendWormEvent } from '@/lib/vvu-ledger';
import { appendBatch, CAPTURE_SCHEMA, getStatus, readAllRecords } from '@/lib/card-captures';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// /api/vvu/captures/sync — Field OS Card sync endpoint.
//   POST → sync a batch of queued captures from the card. Idempotent by
//          capture id: re-sending an already-accepted capture returns it in
//          accepted[] with duplicate:true so the phone can drop it from its
//          offline queue. Invalid captures are named in rejected[] with a
//          reason — the rest of the batch still lands (partial accept is the
//          honest contract).
//   GET  → real status from the real store: count, chain head, integrity.

const syncBodySchema = z.object({
  cardId: z.string().trim().max(60).optional(),
  captures: z
    .array(z.record(z.string(), z.unknown()))
    .min(1, 'captures must be a non-empty array')
    .max(200, 'captures batch larger than 200 — split the sync'),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = syncBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: 'VALIDATION_FAILED',
        issues: parsed.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`),
      },
      { status: 422 }
    );
  }
  const cardId = parsed.data.cardId ?? null;
  try {
    const result = await appendBatch(cardId, parsed.data.captures);

    // WORM bridge: every sync batch is also a row in the main WORM ledger
    // (the alert → receipt evidence chain). Best-effort — a bridge failure
    // does not undo an accepted sync; it is reported, not hidden.
    let worm: { bridged: boolean; seq?: number };
    try {
      const entry = await appendWormEvent({
        source: 'CARD_SYNC',
        event: 'CARD_CAPTURES_SYNCED',
        details: `card=${cardId ?? 'anonymous'} · accepted=${result.accepted.length} (new ${
          result.accepted.filter((a) => !a.duplicate).length
        }, dup ${result.accepted.filter((a) => a.duplicate).length}) · rejected=${result.rejected.length} · head=${result.head?.slice(0, 16) ?? 'none'}…`,
      });
      worm = { bridged: true, seq: entry.seq };
    } catch {
      worm = { bridged: false };
    }

    return NextResponse.json({ success: true, schema: CAPTURE_SCHEMA, ...result, worm });
  } catch (e) {
    return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const records = await readAllRecords();
    const status = getStatus(records);
    // Additive, backwards-compatible: ?recent=N appends the newest N stored
    // captures (capped at 20) for display surfaces. Omit the param and the
    // response is exactly the documented status shape.
    const recentRaw = Number(new URL(request.url).searchParams.get('recent') ?? '0');
    const recent = Number.isFinite(recentRaw) && recentRaw > 0 ? Math.min(20, Math.floor(recentRaw)) : 0;
    const recentRecords = recent > 0 ? records.slice(-recent).reverse() : [];
    return NextResponse.json({
      success: true,
      ...status,
      ...(recent > 0 ? { recent: recentRecords } : {}),
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
