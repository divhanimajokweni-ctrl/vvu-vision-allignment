// src/app/api/proximity/verify/route.ts
// STEP 4 EXPOSED — run the walker. POST (an operator action) and GET
// (a poll) both return the per-record verification with the break point.

import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { verifyProximityChain } from '@/server/proximity/verify';

export const dynamic = 'force-dynamic';

export async function runVerify(): Promise<NextResponse> {
  const verification = await verifyProximityChain(db);
  return NextResponse.json({ ok: verification.valid, verification });
}

export const GET = runVerify;
export const POST = runVerify;
