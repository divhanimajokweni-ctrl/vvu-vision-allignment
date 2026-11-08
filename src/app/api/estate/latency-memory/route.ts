// src/app/api/estate/latency-memory/route.ts — R114 · THE LATENCY MEMORY's
// read side.
// ─────────────────────────────────────────────────────────────────────────────
//   GET → read the dev log tail → the shared latency-ledger engine (R110's
//   own parse, zero re-derivation) → distill a snapshot → append it to the
//   bounded memory store (.zscripts/latency-memory.json) with the
//   same-window refusal (reads closer than LATENCY_MEMORY_MIN_GAP_MS to the
//   last are the SAME frame and change nothing) → return the memory read.
//
// Honesty rules:
//   - READ-ONLY on the log (never rotates, never trims); the ONLY write is
//     the memory store itself, atomic (tmp + rename), and only when a
//     snapshot was actually appended.
//   - A corrupt store resets to empty and SAYS SO (storeReset: true) —
//     it never silently pretends the old memory is still there.
//   - A missing log is ok:false with the REAL error string — no invented
//     empty read, no fake snapshot.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { readFileSync, existsSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { latencyLedger, LATENCY_WINDOW_LINES } from '@/lib/latency-ledger';
import {
  appendSnapshot,
  latencyMemoryRead,
  snapshotFromLedger,
  type LatencySnapshot,
} from '@/lib/latency-memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROOT = process.cwd();
const DEV_LOG_PATH = join(ROOT, 'dev.log');
const STORE_PATH = join(ROOT, '.zscripts', 'latency-memory.json');
const STORE_TMP_PATH = join(ROOT, '.zscripts', 'latency-memory.json.tmp');

function loadStore(): { store: Array<LatencySnapshot>; reset: boolean } {
  try {
    if (!existsSync(STORE_PATH)) return { store: [], reset: false };
    const raw = readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { store: [], reset: true };
    return { store: parsed as Array<LatencySnapshot>, reset: false };
  } catch {
    return { store: [], reset: true };
  }
}

export async function GET() {
  try {
    if (!existsSync(DEV_LOG_PATH)) {
      return NextResponse.json(
        { ok: false, error: 'dev.log does not exist — the memory refuses to invent a read' },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const raw = readFileSync(DEV_LOG_PATH, 'utf8');
    const lines = raw.split('\n');
    const window = lines.slice(-LATENCY_WINDOW_LINES);
    const ledger = latencyLedger(window);

    const loaded = loadStore();
    const { store, appended } = appendSnapshot(
      loaded.store,
      snapshotFromLedger(ledger, Date.now()),
    );

    let persisted = false;
    if (appended) {
      try {
        mkdirSync(join(ROOT, '.zscripts'), { recursive: true });
        writeFileSync(STORE_TMP_PATH, JSON.stringify(store), 'utf8');
        renameSync(STORE_TMP_PATH, STORE_PATH);
        persisted = true;
      } catch {
        persisted = false;
      }
    }

    const memory = latencyMemoryRead(store);
    return NextResponse.json(
      { ok: true, memory, appended, persisted, storeReset: loaded.reset },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: true, empty: true, error: 'unavailable' },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
