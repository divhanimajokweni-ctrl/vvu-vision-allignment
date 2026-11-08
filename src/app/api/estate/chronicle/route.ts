import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sources: Record<string, unknown> = {};

    // Guardian bounces
    const bouncesPath = join(process.cwd(), 'vvu-trust', 'guardian', 'bounces.jsonl');
    if (existsSync(bouncesPath)) {
      const lines = readFileSync(bouncesPath, 'utf-8').trim().split('\n').filter(Boolean);
      sources.guardian = { present: true, rows: lines.length };
    } else {
      sources.guardian = { present: false, rows: 0 };
    }

    // Fleet actions
    const fleetPath = join(process.cwd(), 'vvu-trust', 'fleet', 'actions.jsonl');
    if (existsSync(fleetPath)) {
      const lines = readFileSync(fleetPath, 'utf-8').trim().split('\n').filter(Boolean);
      sources.fleet = { present: true, rows: lines.length };
    } else {
      sources.fleet = { present: false, rows: 0 };
    }

    // Verdict readings
    const verdictPath = join(process.cwd(), 'vvu-trust', 'verdict', 'readings.jsonl');
    if (existsSync(verdictPath)) {
      const lines = readFileSync(verdictPath, 'utf-8').trim().split('\n').filter(Boolean);
      sources.verdict = { present: true, rows: lines.length };
    } else {
      sources.verdict = { present: false, rows: 0 };
    }

    return NextResponse.json({
      ok: true,
      empty: true,
      sources,
      records: [],
      count: 0,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({
      ok: true,
      empty: true,
      sources: {},
      records: [],
      count: 0,
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
