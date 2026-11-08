// src/app/api/proximity/records/route.ts
// The decision log: every scan (ALLOWED sealed + REFUSED unsealed), with
// labeled counts. Seeds the demo baseline on first read so the workspace
// always has the production partition (immutable) + simulator partition
// (demoable) + one refused scan to show the gate.

import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { listRecords, seedDemoData } from '@/server/proximity/pipeline';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  await seedDemoData(db);
  const payload = await listRecords(db);
  return NextResponse.json({ ok: true, ...payload });
}
