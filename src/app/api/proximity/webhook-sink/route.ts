// src/app/api/proximity/webhook-sink/route.ts
// THE LOOPBACK DEMO SINK — a receiver-side view, honest about what it is.
//
// The estate needs a reachable webhook endpoint to prove the dispatch path
// end-to-end. Pointing PROXIMITY_ALARM_WEBHOOK_URL at a third-party service
// from a sandbox is neither reproducible nor honest, so the estate ships its
// own minimal receiver: POST here → the signature is checked against the
// CURRENTLY configured secret → the event lands on an append-only inbox
// JSONL (proximity-webhook-inbox.jsonl) → HTTP 200.
//
// This is a DEMO RECEIVER on the same box — it proves transport, signing,
// delivery logging and latency. It is NOT out-of-band in the adversarial
// sense (the box that raises the alarm also receives it); the docs say so
// out loud. The real out-of-band story is the same payload POSTed to a
// receiver the operator controls elsewhere — the format is identical.

import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';

import {
  INBOX_PATH,
  recordInboxRow,
  verifyIncomingSignature,
} from '@/server/proximity/webhook';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const rawBody = await request.text();
  let parsed: {
    kind?: string;
    mode?: string;
    alarmSeq?: number | null;
    sender?: string | null;
  } = {};
  try {
    parsed = JSON.parse(rawBody) as typeof parsed;
  } catch {
    return NextResponse.json({ received: false, error: 'body is not JSON' }, { status: 400 });
  }

  const signatureValid = await verifyIncomingSignature(
    request.headers.get('x-vvu-alarm-timestamp'),
    request.headers.get('x-vvu-alarm-signature'),
    rawBody,
  );

  const seq = await recordInboxRow({
    receivedAtUtc: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    kind: parsed.kind ?? 'UNKNOWN',
    alarmSeq: typeof parsed.alarmSeq === 'number' ? parsed.alarmSeq : null,
    signatureValid,
    sender: parsed.sender ?? null,
  });

  return NextResponse.json({ received: true, seq, signatureValid });
}

/** Receiver-side view: the last rows on the inbox (newest first). */
export async function GET() {
  try {
    const text = await readFile(INBOX_PATH, 'utf8');
    const rows = text
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as Record<string, unknown>)
      .reverse()
      .slice(0, 10);
    return NextResponse.json({ ok: true, count: rows.length, rows });
  } catch {
    return NextResponse.json({ ok: true, count: 0, rows: [] });
  }
}
