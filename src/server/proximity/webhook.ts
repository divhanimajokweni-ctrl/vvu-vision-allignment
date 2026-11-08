// src/server/proximity/webhook.ts
// ─────────────────────────────────────────────────────────────────────────────
// OUT-OF-BAND DISPATCH — alarms that leave the box.
//
// The alarm rail (proximity-alarms.jsonl) is durable ON THIS BOX. But if the
// box itself is what dies — or what is being tampered with — the rail keeps
// its evidence and nobody ever HEARS the alarm. Out-of-band dispatch closes
// that gap: every alarm raised by the sentinel is also POSTed, signed, to a
// configured webhook endpoint, and every attempt (ok or failed) lands on an
// append-only delivery log:
//
//   vvu-trust/chains/proximity-webhook-deliveries.jsonl
//
// DISCIPLINE, stated:
//   · dispatch NEVER blocks or fails the sentinel — raiseAlarm fires it
//     fire-and-forget; a dead webhook endpoint cannot silence the rail;
//   · the delivery log is append-only — attempts are evidence of what the
//     operator could and could not know, and when;
//   · the full URL is NEVER logged (it can carry secrets in its query) —
//     only scheme-omitted host:port;
//   · payloads are signed with HMAC-SHA256 (X-VVU-Alarm-Signature +
//     X-VVU-Alarm-Timestamp) when a secret is configured — a receiver can
//     drop unsigned or badly-signed calls;
//   · configuration comes from env (PROXIMITY_ALARM_WEBHOOK_URL/_SECRET,
//     takes precedence) or vvu-trust/chains/webhook-config.json — the file
//     is re-read on every dispatch/status so no restart is needed;
//   · alarms raised while unconfigured are counted as SKIPPED — the honest
//     gap is a number, not a shrug.
//
// The webhook is a NOTIFICATION rail, not evidence storage: the JSONL rail
// on this box remains the evidence of record.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

import { createHmac } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  formatUtc,
  type WebhookConfigSource,
  type WebhookConfigState,
  type WebhookDelivery,
  type WebhookInboxRow,
  type WebhookRetry,
  type WebhookRetryPolicy,
  type WebhookStatus,
} from '@/lib/proximity/types';

// NOTE: paths are defined here, NOT imported from watchdog.ts — the sentinel
// imports dispatchWebhook from this module, so an import back would create a
// cycle whose module-level const evaluation order is TDZ-fragile.
const CHAINS_DIR = path.join(process.cwd(), 'vvu-trust', 'chains');
const DELIVERIES_PATH = path.join(CHAINS_DIR, 'proximity-webhook-deliveries.jsonl');
const CONFIG_PATH = path.join(CHAINS_DIR, 'webhook-config.json');
const INBOX_PATH = path.join(CHAINS_DIR, 'proximity-webhook-inbox.jsonl');

const TIMEOUT_MS = 4_000;
const DELIVERY_VIEW_CAP = 40;
const RETRY_VIEW_CAP = 20;

// RETRY + BACKOFF — a failed alarm delivery is not a shrug, it is a queue.
// Policy: 3 re-attempts at 30s / 2m / 8m backoff, then the row is GIVEN UP
// and stays visible as the honest gap. Every re-attempt lands on the same
// append-only delivery log (mode 'retry', attempt N) — evidence either way.
export const RETRY_POLICY: WebhookRetryPolicy = {
  maxRetries: 3,
  backoffSeconds: [30, 120, 480],
  tickSeconds: 15,
};
const RETRIES_PATH = path.join(CHAINS_DIR, 'proximity-webhook-retries.jsonl');
export { RETRIES_PATH };

interface WebhookGlobal {
  proximityWebhookDeliveries?: WebhookDelivery[] | null; // lazily loaded from disk
  proximityWebhookSeq?: number;
  proximityWebhookSkipped?: number;
  proximityWebhookRetries?: WebhookRetry[] | null; // lazily loaded from disk
  proximityWebhookRetryTimer?: ReturnType<typeof setInterval>;
  proximityWebhookRetryGen?: number;
  proximityWebhookRetrying?: boolean; // re-entrancy guard for the tick
}

const g = globalThis as unknown as WebhookGlobal;

// ─── configuration (env wins, file is hot-reloaded) ─────────────────────────

interface WebhookConfig {
  url: string;
  secret: string;
  source: WebhookConfigSource;
}

export async function readWebhookConfig(): Promise<WebhookConfig | null> {
  const envUrl = process.env.PROXIMITY_ALARM_WEBHOOK_URL?.trim();
  if (envUrl) {
    return {
      url: envUrl,
      secret: process.env.PROXIMITY_ALARM_WEBHOOK_SECRET?.trim() ?? '',
      source: 'env',
    };
  }
  try {
    const text = await readFile(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(text) as { url?: string; secret?: string };
    if (parsed?.url && typeof parsed.url === 'string') {
      return { url: parsed.url, secret: typeof parsed.secret === 'string' ? parsed.secret : '', source: 'file' };
    }
  } catch {
    /* no config file — unconfigured */
  }
  return null;
}

/** Operator action: write the config file (no restart needed — re-read per dispatch). */
export async function setWebhookConfig(url: string, secret: string): Promise<void> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('only http/https webhook URLs are accepted');
  }
  await mkdir(CHAINS_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, `${JSON.stringify({ url, secret }, null, 2)}\n`, 'utf8');
}

export async function clearWebhookConfig(): Promise<void> {
  try {
    await writeFile(CONFIG_PATH, `${JSON.stringify({ url: '', secret: '' }, null, 2)}\n`, 'utf8');
  } catch {
    /* nothing to clear */
  }
}

function hostOnly(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '(unparseable)';
  }
}

// ─── the delivery log (append-only JSONL) ───────────────────────────────────

async function loadDeliveries(): Promise<WebhookDelivery[]> {
  if (g.proximityWebhookDeliveries) return g.proximityWebhookDeliveries;
  try {
    const text = await readFile(DELIVERIES_PATH, 'utf8');
    const deliveries: WebhookDelivery[] = [];
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        deliveries.push(JSON.parse(trimmed) as WebhookDelivery);
      } catch {
        /* torn final line — skipped */
      }
    }
    deliveries.sort((a, b) => b.seq - a.seq);
    g.proximityWebhookDeliveries = deliveries;
    g.proximityWebhookSeq = deliveries.reduce((max, d) => Math.max(max, d.seq), 0);
    return deliveries;
  } catch {
    g.proximityWebhookDeliveries = [];
    g.proximityWebhookSeq = 0;
    return g.proximityWebhookDeliveries;
  }
}

async function logDelivery(row: Omit<WebhookDelivery, 'seq'>): Promise<WebhookDelivery> {
  const deliveries = await loadDeliveries();
  const seq = (g.proximityWebhookSeq ?? 0) + 1;
  const full: WebhookDelivery = { ...row, seq };
  await mkdir(CHAINS_DIR, { recursive: true });
  await appendFile(DELIVERIES_PATH, `${JSON.stringify(full)}\n`, 'utf8');
  deliveries.unshift(full);
  g.proximityWebhookSeq = seq;
  return full;
}

// ─── dispatch ───────────────────────────────────────────────────────────────

export interface WebhookPayload {
  kind: string; // 'CHAIN_BROKEN' | 'CHAIN_SHORTENED' | 'TEST'
  mode: 'alarm' | 'test';
  alarmSeq: number | null;
  raisedAtUtc: string;
  streamId: string;
  brokenAt: string | null;
  reason: string | null;
  lastGoodPosition: number | null;
  lastGoodHash: string | null;
  sender: string;
}

/**
 * The sink route imports this to know where the inbox lives (single source of
 * truth without a watchdog import cycle).
 */
export { INBOX_PATH };

/**
 * One dispatch attempt. Returns the logged delivery; when unconfigured,
 * bumps the honest skipped counter and returns null. NEVER throws — a
 * dispatch problem must never become a sentinel problem.
 */
export async function dispatchWebhook(payload: WebhookPayload): Promise<WebhookDelivery | null> {
  try {
    const config = await readWebhookConfig();
    if (!config) {
      if (payload.mode === 'alarm') {
        g.proximityWebhookSkipped = (g.proximityWebhookSkipped ?? 0) + 1;
      }
      return null;
    }

    const body = JSON.stringify(payload);
    const signatureSent = config.secret.length > 0;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-vvu-alarm-timestamp': String(Date.now()),
    };
    if (signatureSent) {
      const mac = createHmac('sha256', config.secret).update(`${headers['x-vvu-alarm-timestamp']}.${body}`).digest('hex');
      headers['x-vvu-alarm-signature'] = `sha256=${mac}`;
    }

    const t0 = Date.now();
    let ok = false;
    let statusCode: number | null = null;
    let error: string | null = null;
    try {
      const res = await fetch(config.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: 'no-store',
      });
      statusCode = res.status;
      ok = res.ok;
      if (!res.ok) error = `endpoint answered HTTP ${res.status}`;
    } catch (e) {
      error = e instanceof Error ? e.message.slice(0, 160) : 'dispatch failed';
    }
    const latencyMs = Date.now() - t0;

    const delivery = await logDelivery({
      alarmSeq: payload.alarmSeq,
      mode: payload.mode,
      kind: payload.kind,
      attemptedAtUtc: formatUtc(Date.now()),
      targetHost: hostOnly(config.url),
      ok,
      statusCode,
      latencyMs,
      error,
      signatureSent,
    });

    // RETRY BOOKKEEPING — alarms only. A failed delivery becomes a durable
    // queue row; a later success (including an out-of-order one) closes it.
    if (payload.mode === 'alarm' && payload.alarmSeq !== null) {
      if (ok) {
        await resolveRetry(payload.alarmSeq, statusCode);
      } else {
        await enqueueRetry(body, payload.alarmSeq, payload.kind, error ?? 'unknown dispatch failure');
      }
    }

    return delivery;
  } catch (e) {
    // The dispatcher logs its own failure as a failed attempt when possible;
    // if even that is impossible, swallow — the sentinel comes first.
    console.error('[proximity-webhook] dispatch error:', e);
    return null;
  }
}

// ─── the retry queue (durable, JSONL — a failed delivery is a debt) ─────────

async function loadRetries(): Promise<WebhookRetry[]> {
  if (g.proximityWebhookRetries) return g.proximityWebhookRetries;
  try {
    const text = await readFile(RETRIES_PATH, 'utf8');
    const rows: WebhookRetry[] = [];
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        rows.push(JSON.parse(trimmed) as WebhookRetry);
      } catch {
        /* torn final line — skipped */
      }
    }
    rows.sort((a, b) => b.alarmSeq - a.alarmSeq);
    g.proximityWebhookRetries = rows;
    return rows;
  } catch {
    g.proximityWebhookRetries = [];
    return g.proximityWebhookRetries;
  }
}

async function persistRetries(rows: WebhookRetry[]): Promise<void> {
  await mkdir(CHAINS_DIR, { recursive: true });
  await writeFile(RETRIES_PATH, rows.map((r) => `${JSON.stringify(r)}\n`).join(''), 'utf8');
}

async function saveRetries(rows: WebhookRetry[]): Promise<WebhookRetry[]> {
  rows.sort((a, b) => b.alarmSeq - a.alarmSeq);
  g.proximityWebhookRetries = rows;
  await persistRetries(rows);
  return rows;
}

/** A failed ALARM delivery enters (or refreshes) the queue. */
async function enqueueRetry(payloadJson: string, alarmSeq: number, kind: string, error: string): Promise<void> {
  const rows = await loadRetries();
  const existing = rows.find((r) => r.alarmSeq === alarmSeq);
  if (existing && existing.state === 'pending') {
    existing.lastError = error;
    existing.lastAttemptAtUtc = formatUtc(Date.now());
    await saveRetries(rows);
    return;
  }
  if (existing) {
    // resolved or given-up rows stay as history; a re-failure of the same seq
    // can only happen if the rail itself was rebuilt — start a fresh row
    rows.splice(rows.indexOf(existing), 1);
  }
  rows.push({
    alarmSeq,
    kind,
    state: 'pending',
    attempts: 0,
    firstFailedAtUtc: formatUtc(Date.now()),
    lastAttemptAtUtc: formatUtc(Date.now()),
    nextAttemptUtc: formatUtc(Date.now() + RETRY_POLICY.backoffSeconds[0] * 1000),
    lastError: error,
    resolvedAtUtc: null,
    deliveredStatusCode: null,
    payload: payloadJson,
  });
  await saveRetries(rows);
}

/** A delivered alarm closes its queue row (out-of-order successes included). */
async function resolveRetry(alarmSeq: number, statusCode: number | null): Promise<void> {
  const rows = await loadRetries();
  const row = rows.find((r) => r.alarmSeq === alarmSeq);
  if (!row || row.state !== 'pending') return;
  row.state = 'resolved';
  row.resolvedAtUtc = formatUtc(Date.now());
  row.deliveredStatusCode = statusCode;
  row.nextAttemptUtc = null;
  row.lastError = null;
  await saveRetries(rows);
}

/** One re-attempt for a queued alarm. Shared by the ticker and RETRY NOW. */
async function attemptQueuedRetry(row: WebhookRetry, attemptNo: number): Promise<void> {
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(row.payload) as WebhookPayload;
  } catch {
    row.state = 'given-up';
    row.nextAttemptUtc = null;
    row.lastError = 'stored payload unparseable — row retired';
    const rows = await loadRetries();
    await saveRetries(rows);
    return;
  }
  const config = await readWebhookConfig();
  if (!config) {
    // unconfigured mid-retry: honest pause, not a failure — try again next tick
    row.nextAttemptUtc = formatUtc(Date.now() + RETRY_POLICY.tickSeconds * 1000);
    const rows = await loadRetries();
    await saveRetries(rows);
    return;
  }

  const body = JSON.stringify(payload);
  const signatureSent = config.secret.length > 0;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-vvu-alarm-timestamp': String(Date.now()),
    'x-vvu-alarm-retry-attempt': String(attemptNo),
  };
  if (signatureSent) {
    const mac = createHmac('sha256', config.secret).update(`${headers['x-vvu-alarm-timestamp']}.${body}`).digest('hex');
    headers['x-vvu-alarm-signature'] = `sha256=${mac}`;
  }

  const t0 = Date.now();
  let ok = false;
  let statusCode: number | null = null;
  let error: string | null = null;
  try {
    const res = await fetch(config.url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    statusCode = res.status;
    ok = res.ok;
    if (!res.ok) error = `endpoint answered HTTP ${res.status}`;
  } catch (e) {
    error = e instanceof Error ? e.message.slice(0, 160) : 'retry dispatch failed';
  }
  const latencyMs = Date.now() - t0;

  await logDelivery({
    alarmSeq: payload.alarmSeq,
    mode: 'retry',
    kind: payload.kind,
    attemptedAtUtc: formatUtc(Date.now()),
    targetHost: hostOnly(config.url),
    ok,
    statusCode,
    latencyMs,
    error,
    signatureSent,
    attempt: attemptNo,
  });

  const rows = await loadRetries();
  const current = rows.find((r) => r.alarmSeq === row.alarmSeq);
  if (!current || current.state !== 'pending') return; // resolved elsewhere meanwhile
  current.attempts = attemptNo;
  current.lastAttemptAtUtc = formatUtc(Date.now());
  if (ok) {
    current.state = 'resolved';
    current.resolvedAtUtc = formatUtc(Date.now());
    current.deliveredStatusCode = statusCode;
    current.nextAttemptUtc = null;
    current.lastError = null;
  } else if (attemptNo >= RETRY_POLICY.maxRetries) {
    current.state = 'given-up';
    current.nextAttemptUtc = null;
    current.lastError = error;
  } else {
    current.lastError = error;
    current.nextAttemptUtc = formatUtc(Date.now() + RETRY_POLICY.backoffSeconds[attemptNo] * 1000);
  }
  await saveRetries(rows);
}

/** The retry ticker: every tick, attempt every pending row whose time has come. */
async function retryTick(): Promise<void> {
  if (g.proximityWebhookRetrying) return; // one tick at a time
  g.proximityWebhookRetrying = true;
  try {
    const rows = await loadRetries();
    const now = Date.now();
    const due = rows.filter(
      (r) => r.state === 'pending' && r.nextAttemptUtc && Date.parse(r.nextAttemptUtc) <= now,
    );
    for (const row of due) {
      try {
        await attemptQueuedRetry(row, row.attempts + 1);
      } catch (e) {
        console.error('[proximity-webhook] retry attempt failed:', e);
      }
    }
  } finally {
    g.proximityWebhookRetrying = false;
  }
}

/** Boot hook (instrumentation.ts) — the generation-stamped estate pattern. */
const RETRY_GEN = 1;
export function startProximityRetryTicker(): { started: boolean; tickSeconds: number } {
  if (g.proximityWebhookRetryTimer && g.proximityWebhookRetryGen === RETRY_GEN) {
    return { started: false, tickSeconds: RETRY_POLICY.tickSeconds };
  }
  if (g.proximityWebhookRetryTimer) clearInterval(g.proximityWebhookRetryTimer);
  const timer = setInterval(() => {
    void retryTick().catch((e) => console.error('[proximity-webhook] retry tick failed:', e));
  }, RETRY_POLICY.tickSeconds * 1000);
  timer.unref?.();
  g.proximityWebhookRetryTimer = timer;
  g.proximityWebhookRetryGen = RETRY_GEN;
  return { started: true, tickSeconds: RETRY_POLICY.tickSeconds };
}

/** Operator action: re-attempt a queued alarm right now, policy unchanged. */
export async function retryNow(alarmSeq: number): Promise<WebhookRetry | null> {
  const rows = await loadRetries();
  const row = rows.find((r) => r.alarmSeq === alarmSeq);
  if (!row || row.state !== 'pending') return null;
  await attemptQueuedRetry(row, row.attempts + 1);
  const fresh = (await loadRetries()).find((r) => r.alarmSeq === alarmSeq);
  return fresh ?? null;
}

/** Operator action: retire a row the operator has decided is dead. */
export async function dismissRetry(alarmSeq: number): Promise<WebhookRetry | null> {
  const rows = await loadRetries();
  const row = rows.find((r) => r.alarmSeq === alarmSeq);
  if (!row || row.state !== 'pending') return null;
  row.state = 'given-up';
  row.nextAttemptUtc = null;
  row.lastError = row.lastError ?? 'dismissed by operator';
  await saveRetries(rows);
  return row;
}

// ─── the loopback demo sink (receiver-side view, honest about what it is) ───

export async function recordInboxRow(row: Omit<WebhookInboxRow, 'seq'>): Promise<number> {
  let seq = 1;
  try {
    const text = await readFile(INBOX_PATH, 'utf8');
    for (const line of text.split('\n')) {
      if (line.trim()) seq += 1;
    }
  } catch {
    /* first row */
  }
  await mkdir(CHAINS_DIR, { recursive: true });
  await appendFile(INBOX_PATH, `${JSON.stringify({ ...row, seq })}\n`, 'utf8');
  return seq;
}

export async function inboxCount(): Promise<number> {
  try {
    const text = await readFile(INBOX_PATH, 'utf8');
    return text.split('\n').filter((l) => l.trim()).length;
  } catch {
    return 0;
  }
}

/** Verify an incoming signature against the CURRENTLY configured secret. */
export async function verifyIncomingSignature(
  timestampHeader: string | null,
  signatureHeader: string | null,
  rawBody: string,
): Promise<boolean | null> {
  const config = await readWebhookConfig();
  if (!config || config.secret.length === 0) return null; // nothing to check — receiver says so
  if (!timestampHeader || !signatureHeader?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', config.secret).update(`${timestampHeader}.${rawBody}`).digest('hex');
  return signatureHeader.slice(7) === expected;
}

// ─── status ─────────────────────────────────────────────────────────────────

export async function webhookStatus(): Promise<WebhookStatus> {
  const config = await readWebhookConfig();
  const deliveries = await loadDeliveries();
  const state: WebhookConfigState = config
    ? {
        configured: true,
        source: config.source,
        targetHost: hostOnly(config.url),
        secretSet: config.secret.length > 0,
        timeoutSeconds: TIMEOUT_MS / 1000,
      }
    : {
        configured: false,
        source: 'none',
        targetHost: null,
        secretSet: false,
        timeoutSeconds: TIMEOUT_MS / 1000,
      };

  const total = deliveries.length;
  const okCount = deliveries.filter((d) => d.ok).length;
  const retries = await loadRetries();
  const pending = retries.filter((r) => r.state === 'pending');
  return {
    config: state,
    deliveries: deliveries.slice(0, DELIVERY_VIEW_CAP),
    totalDeliveries: total,
    okCount,
    failCount: total - okCount,
    skippedCount: g.proximityWebhookSkipped ?? 0,
    inboxCount: await inboxCount(),
    lastDelivery: deliveries[0] ?? null,
    nowUtc: formatUtc(Date.now()),
    retryQueue: [...pending, ...retries.filter((r) => r.state !== 'pending')].slice(0, RETRY_VIEW_CAP),
    pendingRetryCount: pending.length,
    givenUpRetryCount: retries.filter((r) => r.state === 'given-up').length,
    resolvedRetryCount: retries.filter((r) => r.state === 'resolved').length,
    retryPolicy: RETRY_POLICY,
  };
}

export { DELIVERIES_PATH, CONFIG_PATH };
