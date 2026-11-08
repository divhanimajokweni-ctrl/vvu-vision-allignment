import { NextRequest, NextResponse } from 'next/server';
import { debuggerClient } from '@/lib/debugger/client';

const BASE = process.env.DEBUGGER_URL ?? 'http://127.0.0.1:3098';

async function proxy(path: string, init?: RequestInit) {
  try {
    const r = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(4000),
    });
    const body = await r.text();
    return new NextResponse(body, { status: r.status, headers: { 'content-type': 'application/json' } });
  } catch {
    return NextResponse.json(
      { ok: false, reason: 'debugger-unreachable', hint: 'start the debugger service on :3098' },
      { status: 503 },
    );
  }
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const op = p.get('op') ?? 'sessions';
  const id = p.get('id') ?? '';
  switch (op) {
    case 'status':  return proxy('/healthz');
    case 'session': return proxy(`/session/${encodeURIComponent(id)}${p.get('afterSeq') ? `?afterSeq=${p.get('afterSeq')}` : ''}`);
    case 'verify':  return proxy(`/session/${encodeURIComponent(id)}/verify`);
    case 'replay':  return proxy(`/session/${encodeURIComponent(id)}/replay`);
    default:        return proxy('/sessions');
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  switch (body.op) {
    case 'start': return proxy('/session/start', { method: 'POST', body: JSON.stringify(body.payload ?? {}) });
    case 'close': return proxy(`/session/${encodeURIComponent(body.id)}/close`, { method: 'POST', body: JSON.stringify(body.payload ?? {}) });
    case 'diff':  return proxy('/diff', { method: 'POST', body: JSON.stringify(body.payload ?? {}) });
    case 'bind':   debuggerClient.bind(body.id);  return NextResponse.json({ ok: true, bound: body.id });
    case 'unbind': debuggerClient.unbind();       return NextResponse.json({ ok: true });
    default: return NextResponse.json({ ok: false, reason: 'unknown-op' }, { status: 400 });
  }
}
