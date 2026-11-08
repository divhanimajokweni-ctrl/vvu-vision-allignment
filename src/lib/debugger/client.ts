/**
 * Server-side collector. I5: observation must never break the observed —
 * every method swallows its own failures. The queue is bounded and lossy
 * under pressure; losing evidence is honest, fabricating it is not.
 */
import { randomUUID } from 'node:crypto';
import type { CollectorEvent } from './types';

const BASE = process.env.DEBUGGER_URL ?? 'http://127.0.0.1:3098';
const APP = process.env.DEBUGGER_APP_ID ?? 'vvu-web';

class DebuggerClient {
  private sessionId: string | null = null;
  private queue: CollectorEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inflight = false;

  get activeSession() { return this.sessionId; }

  bind(sessionId: string) { this.sessionId = sessionId; void this.flush(); }
  unbind() { this.sessionId = null; }

  capture(ev: CollectorEvent) {
    if (!this.sessionId) {
      if (ev.level === 'error') this.captureAmbient(ev);
      return;
    }
    this.queue.push({ ...ev, source: ev.source || APP });
    if (this.queue.length > 1000) this.queue.splice(0, this.queue.length - 1000);
    if (this.timer === null) {
      this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, 300);
    }
  }

  captureAmbient(ev: CollectorEvent) {
    const body = JSON.stringify({ events: [{ ...ev, source: ev.source || APP }] });
    try { void fetch(`${BASE}/ambient/events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body }).catch(() => {}); }
    catch {}
  }

  async flush() {
    if (this.inflight || !this.sessionId || this.queue.length === 0) return;
    this.inflight = true;
    const batch = this.queue.splice(0, 200);
    try {
      const r = await fetch(`${BASE}/session/${this.sessionId}/events`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ events: batch }), signal: AbortSignal.timeout(3000),
      });
      if (r.ok) {
        const j = await r.json().catch(() => null);
        if (j && Array.isArray(j.rejected) && (j.rejected as string[]).some((e) => e === 'session-closed' || e === 'not-found')) {
          this.sessionId = null;
        }
      } else if (r.status === 404) { this.sessionId = null; }
    } catch {}
    finally {
      this.inflight = false;
      if (this.queue.length && this.sessionId) void this.flush();
    }
  }
}

export const debuggerClient = new DebuggerClient();

export async function withSpan<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  const spanId = randomUUID();
  const t0 = performance.now();
  debuggerClient.capture({ type: 'span', level: 'debug', source: APP, message: `${name} begin`, spanId, data: { phase: 'begin', name } });
  try {
    const result = await fn();
    debuggerClient.capture({ type: 'span', level: 'info', source: APP, message: `${name} end`, spanId, data: { phase: 'end', name, durationMs: Math.round((performance.now() - t0) * 100) / 100 } });
    return result;
  } catch (err) {
    debuggerClient.capture({ type: 'span', level: 'error', source: APP, message: `${name} failed`, spanId, data: { phase: 'end', name, durationMs: Math.round((performance.now() - t0) * 100) / 100, error: String(err) } });
    throw err;
  }
}

export function captureHttp(req: Request, status: number, durationMs: number) {
  const path = new URL(req.url).pathname;
  debuggerClient.capture({ type: 'http', level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info', source: 'next', message: `${req.method} ${path} → ${status}`, data: { method: req.method, path, status, durationMs: Math.round(durationMs * 100) / 100 } });
}
