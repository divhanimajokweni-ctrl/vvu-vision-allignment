// src/app/api/proximity/webhook/route.ts
// OUT-OF-BAND DISPATCH EXPOSED — GET returns the config state, the delivery
// log and the sink inbox count; POST drives it (set | clear | test).

import { NextResponse } from 'next/server';

import {
  clearWebhookConfig,
  dismissRetry,
  dispatchWebhook,
  retryNow,
  setWebhookConfig,
  webhookStatus,
} from '@/server/proximity/webhook';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = await webhookStatus();
  return NextResponse.json({ ok: true, status });
}

export async function POST(request: Request) {
  let body: { action?: string; url?: string; secret?: string; alarmSeq?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* empty body treated as test */
  }
  const action = body.action ?? 'test';

  try {
    if (action === 'set') {
      if (!body.url || typeof body.url !== 'string') {
        return NextResponse.json({ ok: false, error: 'set requires a url' }, { status: 400 });
      }
      try {
        await setWebhookConfig(body.url, typeof body.secret === 'string' ? body.secret : '');
      } catch (e) {
        return NextResponse.json(
          { ok: false, error: e instanceof Error ? e.message : 'invalid webhook url' },
          { status: 400 },
        );
      }
      const status = await webhookStatus();
      return NextResponse.json({
        ok: true,
        detail: `dispatch configured · ${status.config.targetHost} · secret ${status.config.secretSet ? 'SET' : 'NOT SET'} — re-read on every dispatch, no restart needed`,
        status,
      });
    }

    if (action === 'clear') {
      await clearWebhookConfig();
      const status = await webhookStatus();
      return NextResponse.json({
        ok: true,
        detail: 'dispatch cleared — alarms stay on the local rail only (skipped counter keeps counting)',
        status,
      });
    }

    if (action === 'test') {
      const delivery = await dispatchWebhook({
        kind: 'TEST',
        mode: 'test',
        alarmSeq: null,
        raisedAtUtc: new Date().toISOString(),
        streamId: 'proximity.gqeberha.v1',
        brokenAt: null,
        reason: 'operator test dispatch — proves the path, raises nothing on the alarm rail',
        lastGoodPosition: null,
        lastGoodHash: null,
        sender: 'vvu-estate/proximity-operator',
      });
      const status = await webhookStatus();
      if (!delivery) {
        return NextResponse.json({
          ok: false,
          detail: 'no webhook configured — nothing was sent and nothing was logged; set a target first',
          status,
        });
      }
      return NextResponse.json({
        ok: delivery.ok,
        detail: delivery.ok
          ? `test delivered · ${delivery.targetHost} answered ${delivery.statusCode} in ${delivery.latencyMs} ms${delivery.signatureSent ? ' · HMAC-signed' : ''}`
          : `test FAILED · ${delivery.error ?? 'unknown'} — the attempt is on the delivery log either way`,
        delivery,
        status,
      });
    }

    if (action === 'retry-now') {
      const seq = Number(body.alarmSeq);
      if (!Number.isInteger(seq) || seq <= 0) {
        return NextResponse.json({ ok: false, error: 'retry-now requires an integer alarmSeq' }, { status: 400 });
      }
      const row = await retryNow(seq);
      const status = await webhookStatus();
      if (!row) {
        return NextResponse.json(
          { ok: false, error: `no pending retry row for alarm #${seq}`, status },
          { status: 404 },
        );
      }
      return NextResponse.json({
        ok: true,
        detail:
          row.state === 'resolved'
            ? `alarm #${seq} delivered on retry ${row.attempts} · HTTP ${row.deliveredStatusCode} — queue row closed`
            : row.state === 'given-up'
              ? `alarm #${seq} given up after retry ${row.attempts} — the gap stays visible`
              : `alarm #${seq} still failing — next attempt ${row.nextAttemptUtc}`,
        retry: row,
        status,
      });
    }

    if (action === 'dismiss-retry') {
      const seq = Number(body.alarmSeq);
      if (!Number.isInteger(seq) || seq <= 0) {
        return NextResponse.json({ ok: false, error: 'dismiss-retry requires an integer alarmSeq' }, { status: 400 });
      }
      const row = await dismissRetry(seq);
      const status = await webhookStatus();
      if (!row) {
        return NextResponse.json(
          { ok: false, error: `no pending retry row for alarm #${seq}`, status },
          { status: 404 },
        );
      }
      return NextResponse.json({
        ok: true,
        detail: `alarm #${seq} retired by operator — the row stays as history`,
        retry: row,
        status,
      });
    }

    return NextResponse.json(
      { ok: false, error: `unknown action '${action}' — set | clear | test | retry-now | dismiss-retry` },
      { status: 400 },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'webhook action failed' },
      { status: 500 },
    );
  }
}
