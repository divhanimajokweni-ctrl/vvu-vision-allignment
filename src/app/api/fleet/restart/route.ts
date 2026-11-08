// src/app/api/fleet/restart/route.ts — R76 · FLEET OPS — the guarded restart.
// ─────────────────────────────────────────────────────────────────────────────
// The board showed the fleet (R75); this route lets the console LAND one.
// The discipline is the guardian's own, executed by
// .zscripts/mini_service_restart.py (which IMPORTS guardian.py's
// kill_tree/port_ok — one implementation of the bounce discipline):
// identify by cwd → kill tree → REQUIRE port free → daemonize the
// registry's exact command → wait for the registry's healthy answer.
//
// Guards, in order:
//   1. :3000 is REFUSED before anything is touched — the guardian owns
//      that surface; the console may not bounce it (use the drill, or let
//      the rails work).
//   2. ONE restart at a time across the whole console (module-level
//      in-flight flag, self-expiring after 120s so a crashed run can never
//      wedge the fleet forever).
//   3. A service restarted less than 60s ago is refused (the last journal
//      row is the truth) — no thrash.
//   4. Everything is journaled to vvu-trust/fleet/actions.jsonl — the
//      FOURTH append-only evidence ledger — whether the restart lands or
//      fails; the chronicle reads it as the FLEET class. A refused request
//      is not journaled (nothing happened).
//
// The response reports the helper's result verbatim — the UI shows the
// truth, not a wish.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { FLEET_REGISTRY, FLEET_JOURNAL, ROOT } from '@/server/fleet/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HELPER = join(ROOT, '.zscripts', 'mini_service_restart.py');
const HELPER_TIMEOUT_MS = 90_000; // helper's own budgets: 10s kill + 10s port + 30s boot + slack
const INFLIGHT_TTL_MS = 120_000;
const RESTART_COOLDOWN_MS = 60_000;

const execFileP = promisify(execFile);

// Module-level in-flight flag — one console restart at a time. Self-expires
// so a crashed handler can never wedge the fleet (the module dies with the
// dev server anyway, but 120s bounds even a wedged same-process case).
let inFlightSince = 0;

interface JournalRow {
  at: string;
  action: 'restart';
  port: number;
  name: string;
  trigger: 'console';
  oldPid: number | null;
  newPid: number | null;
  downtimeMs: number | null;
  httpStatus: number | null;
  ok: boolean;
  error: string | null;
}

function utcStamp(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
}

function lastRestartFor(port: number): JournalRow | null {
  try {
    if (!existsSync(FLEET_JOURNAL)) return null;
    const rows = readFileSync(FLEET_JOURNAL, 'utf8')
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line) as JournalRow;
        } catch {
          return null;
        }
      })
      .filter((r): r is JournalRow => r !== null);
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      if (r && r.action === 'restart' && r.port === port) return r;
    }
  } catch {
    // unreadable journal = no KNOWN recent restart — the cooldown guard
    // degrades honestly to "allowed" rather than blocking forever
  }
  return null;
}

function journal(row: JournalRow): void {
  mkdirSync(dirname(FLEET_JOURNAL), { recursive: true });
  // JSON.stringify's default output is already compact — one line per row,
  // same shape as every other append-only ledger in the estate.
  appendFileSync(FLEET_JOURNAL, JSON.stringify(row) + '\n');
}

function refused(reason: string, detail: string, status: number) {
  return NextResponse.json({ ok: false, refused: true, reason, detail }, { status });
}

export async function POST(req: Request) {
  let body: { port?: unknown };
  try {
    body = (await req.json()) as { port?: unknown };
  } catch {
    return refused('bad-request', 'body must be JSON {port}', 400);
  }
  const port = Number(body.port);
  if (!Number.isInteger(port)) {
    return refused('bad-request', 'port must be an integer', 400);
  }

  const svc = FLEET_REGISTRY.find((s) => s.port === port);
  if (!svc) {
    return refused(
      'unknown-port',
      `:${port} is not in the fleet registry — a port scan would bless whatever answers; add the service to src/server/fleet/registry.ts first`,
      404,
    );
  }
  if (!svc.restartable) {
    return refused(
      'guardian-domain',
      ":3000 is the guardian's surface — the console may not bounce it (use the drill control, or let the rails work)",
      403,
    );
  }
  if (inFlightSince && Date.now() - inFlightSince < INFLIGHT_TTL_MS) {
    return refused(
      'restart-in-flight',
      `a fleet restart has been running for ${Math.round((Date.now() - inFlightSince) / 1000)}s — one at a time`,
      409,
    );
  }
  const last = lastRestartFor(port);
  if (last) {
    const atMs = Date.parse((last.at ?? '').replace(' UTC', 'Z').replace(' ', 'T'));
    if (Number.isFinite(atMs) && Date.now() - atMs < RESTART_COOLDOWN_MS) {
      return refused(
        'cooldown',
        `:${port} was restarted ${Math.round((Date.now() - atMs) / 1000)}s ago — 60s cooldown, no thrash`,
        409,
      );
    }
  }

  inFlightSince = Date.now();
  try {
    let stdout = '';
    try {
      const res = await execFileP(
        'python3',
        [
          HELPER,
          '--port', String(svc.port),
          '--expect', String(svc.expectedRootStatus),
          '--cwd', svc.spawnCwd,
          '--cmd', svc.spawnCmd[0] ?? 'bun',
          '--args=' + (svc.spawnCmd.slice(1).join(',') ?? ''),
          '--log', svc.spawnLog,
        ],
        { timeout: HELPER_TIMEOUT_MS, cwd: ROOT, maxBuffer: 1024 * 1024 },
      );
      stdout = res.stdout;
    } catch (e) {
      // execFile throws on non-zero exit — the helper PRINTED its honest
      // JSON result either way; recover it from stdout.
      const err = e as { stdout?: string; message?: string };
      stdout = err.stdout ?? '';
      if (!stdout) {
        const row: JournalRow = {
          at: utcStamp(),
          action: 'restart',
          port: svc.port,
          name: svc.name,
          trigger: 'console',
          oldPid: null,
          newPid: null,
          downtimeMs: null,
          httpStatus: null,
          ok: false,
          error: `helper dispatch failed: ${err.message ?? String(e)}`,
        };
        journal(row);
        return NextResponse.json({ ok: false, refused: false, result: row }, { status: 500 });
      }
    }

    // The helper prints exactly one JSON result line (its stdout may carry
    // the guardian import's import-time silence) — take the LAST parsable
    // line, never a guess from prose.
    let parsed: Record<string, unknown> | null = null;
    for (const line of stdout.split('\n')) {
      const t = line.trim();
      if (!t.startsWith('{')) continue;
      try {
        parsed = JSON.parse(t) as Record<string, unknown>;
      } catch {
        // not the result line
      }
    }
    if (!parsed) {
      const row: JournalRow = {
        at: utcStamp(),
        action: 'restart',
        port: svc.port,
        name: svc.name,
        trigger: 'console',
        oldPid: null,
        newPid: null,
        downtimeMs: null,
        httpStatus: null,
        ok: false,
        error: 'helper produced no parsable result line',
      };
      journal(row);
      return NextResponse.json({ ok: false, refused: false, result: row }, { status: 500 });
    }

    const row: JournalRow = {
      at: utcStamp(),
      action: 'restart',
      port: svc.port,
      name: svc.name,
      trigger: 'console',
      oldPid: (parsed.oldPid as number | null) ?? null,
      newPid: (parsed.newPid as number | null) ?? null,
      downtimeMs: (parsed.downtimeMs as number | null) ?? null,
      httpStatus: (parsed.httpStatus as number | null) ?? null,
      ok: parsed.ok === true,
      error: (parsed.error as string | null) ?? null,
    };
    journal(row);
    return NextResponse.json({ ok: row.ok, refused: false, result: row }, { status: row.ok ? 200 : 500 });
  } finally {
    inFlightSince = 0;
  }
}
