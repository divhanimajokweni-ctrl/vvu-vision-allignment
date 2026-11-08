import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { GQEBERHA_TENANT_ID } from '@/lib/vvu-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/vvu/audit?limit=30 — most recent audit-log entries (RLS-scoped).
export async function GET(req: NextRequest) {
  const limit = Math.min(100, Number(req.nextUrl.searchParams.get('limit') ?? '30'));
  try {
    const entries = await db.auditLog.findMany({
      where: { tenantId: GQEBERHA_TENANT_ID },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return NextResponse.json({
      total: entries.length,
      entries: entries.map((e) => ({
        id: e.id,
        actor: e.actor,
        action: e.action,
        fromState: e.fromState,
        toState: e.toState,
        symbol: e.symbol,
        reason: e.reason,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/vvu/audit — append-only audit entry (RLS-scoped).
export async function POST(req: NextRequest) {
  let body: {
    actor?: string;
    action?: string;
    fromState?: string;
    toState?: string;
    symbol?: string;
    reason?: string;
    metadata?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.action || !body.actor) {
    return NextResponse.json(
      { success: false, message: 'Missing required fields: actor, action' },
      { status: 422 }
    );
  }
  try {
    const entry = await db.auditLog.create({
      data: {
        tenantId: GQEBERHA_TENANT_ID,
        actor: body.actor.slice(0, 40),
        action: body.action.slice(0, 80),
        fromState: body.fromState?.slice(0, 40),
        toState: body.toState?.slice(0, 40),
        symbol: body.symbol?.slice(0, 20),
        reason: body.reason?.slice(0, 300),
        metadata: body.metadata?.slice(0, 400),
      },
    });
    return NextResponse.json({ success: true, id: entry.id, createdAt: entry.createdAt.toISOString() });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
