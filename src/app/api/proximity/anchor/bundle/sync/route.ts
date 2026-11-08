// src/app/api/proximity/anchor/bundle/sync/route.ts — R69 · the off-box push.
// ─────────────────────────────────────────────────────────────────────────────
//   GET   → sync state: configured target (or the env contract to set one),
//           last attempt, history tail, journal size.
//   POST  → run the sync job NOW: manifest → copy/PUT → re-verify → journal.
//
// Honesty rules: TARGET=none refuses with UNCONFIGURED (nothing faked);
// the file target is labeled STAGED + "REHEARSAL ONLY — same box"; the s3
// target is the real off-box push and its first run will honestly report
// whatever a real endpoint says (the path ships untested until then).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';

import { runSync, syncStatus } from '@/server/proximity/sync';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(
      { ok: true, ...syncStatus() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'sync status failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function POST() {
  try {
    const result = await runSync();
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'sync dispatch failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
