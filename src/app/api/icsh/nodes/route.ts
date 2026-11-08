import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { db } = await import('@/lib/db');
    const nodes = await db.icshNode.findMany({ take: 50, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ nodes, count: nodes.length });
  } catch {
    return NextResponse.json({ nodes: [], count: 0 });
  }
}
