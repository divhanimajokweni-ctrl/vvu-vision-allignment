// src/app/api/guardian/drill/route.ts — R68 · drill-from-console (R67 priority #4).
// ─────────────────────────────────────────────────────────────────────────────
// The guardian self-test existed only as a shell command (`guardian.py
// --drill`). This route gives the operator the same proof from the console:
// it runs THE EXACT drill binary as a child process and returns its JSON
// summary. The bounce machinery, the five assertions and the journal row are
// all guardian.py's own — this route only arms, executes and reports.
//
// Safety rails (a drill spawns real processes — never casual):
//   · GUARDIAN MUST BE ARMED, ALIVE AND FRESH — no drill over an unwatched
//     surface (the drill asserts :3000 untouched, but only a live guardian
//     catches an unrelated crash DURING the drill).
//   · NO DRILL DURING A REAL BOUNCE — lastAction starting with "bounce"
//     within 2× the interval means the guardian is mid-landing; the drill's
//     realUntouched assertion would also lie.
//   · NO DRILL ON A DUPLICATE next-server — R56 class is operator-decision
//     territory; do not add moving parts.
//   · NO DRILL UNDER BOX PRESSURE — MemAvailable below 450MB: the drill's
//     throwaway victims add a small transient footprint; refuse while the
//     box is anywhere near the guardian's own 300MB floor.
//   · ONE DRILL AT A TIME — module lock + lockfile (O_EXCL). A stale lock
//     older than 3 minutes is broken honestly (a killed dev server can
//     leave one behind); a live one refuses with 409.
//   · HARD TIMEOUT — 120s, ~10× the observed drill duration. On timeout the
//     child is killed and the route best-effort kills the drill victim named
//     by drill-victim.pid, reporting honestly either way.
//
// READ-ONLY over the estate: this route never touches dev.pid, never kills
// anything on :3000, never writes to the guardian's own state files.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { existsSync, openSync, closeSync, readFileSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROOT = process.cwd();
const STATUS_PATH = join(ROOT, 'vvu-trust', 'guardian', 'status.json');
const JOURNAL_PATH = join(ROOT, 'vvu-trust', 'guardian', 'bounces.jsonl');
const LOCK_PATH = join(ROOT, '.zscripts', 'guardian-drill.lock');
const VICTIM_PIDFILE = join(ROOT, '.zscripts', 'drill-victim.pid');
const DRILL_TIMEOUT_MS = 120_000;
const LOCK_STALE_MS = 180_000;
const MIN_BOX_AVAIL_KB = 450 * 1024; // refuse a drill under 450MB box headroom
const REAL_BOUNCE_QUIET_MS = 10 * 60 * 1000; // R69: no drills within 10min of a REAL bounce

// One drill per dev-server process — plus the lockfile for every other path.
let drillInFlight = false;
let lastStdout = ''; // diagnostics only — surfaces in the no-summary error response

interface DrillSummary {
  drill: 'PASS' | 'FAIL';
  port?: number;
  assertions?: {
    bouncedOk: boolean;
    pidChanged: boolean;
    portServes: boolean;
    cleanedUp: boolean;
    realUntouched: boolean;
  };
  victimPids?: { old: number | null; new: number | null };
  downtimeMs?: number | null;
  rowError?: string | null;
  error?: string;
  journalRow?: Record<string, unknown>;
}

function pidAlive(pid: number | null): boolean {
  if (!pid || !Number.isFinite(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function parseUtc(label: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC$/.exec(String(label).trim());
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

function refuse(reason: string, detail: string) {
  return NextResponse.json(
    { ok: false, refused: true, reason, detail },
    { status: 409, headers: { 'Cache-Control': 'no-store' } },
  );
}

/** Extract guardian.py's summary JSON from a stdout that also carries log lines.
 *  The summary is printed with indent=1 — but guardian.py logs
 *  "[ts] DRILL end verdict=…" AFTER it, so a naive JSON.parse of the tail
 *  fails. Brace-match (string-aware) from the summary's opening '{' instead. */
function parseSummary(stdout: string): DrillSummary | null {
  const start = stdout.indexOf('{\n');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < stdout.length; i++) {
    const ch = stdout[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return null;
  try {
    return JSON.parse(stdout.slice(start, end)) as DrillSummary;
  } catch {
    return null;
  }
}

/** Best-effort cleanup if the child was killed mid-drill: kill the victim
 *  named by the scratch pidfile. Never touches anything else. */
function cleanupVictimBestEffort(): { pid: number | null; killed: boolean } {
  try {
    const pid = Number(readFileSync(VICTIM_PIDFILE, 'utf8').trim());
    if (!Number.isFinite(pid) || pid <= 0 || !pidAlive(pid)) return { pid: null, killed: false };
    try {
      process.kill(pid, 'SIGKILL');
      return { pid, killed: true };
    } catch {
      return { pid, killed: false };
    }
  } catch {
    return { pid: null, killed: false };
  }
}

export async function POST() {
  // ── lock: one drill at a time, across processes ──────────────────────────
  if (drillInFlight) {
    return refuse('already-running', 'a drill is already in flight from this console — wait for it to land');
  }
  try {
    // O_EXCL create — fails if the lock exists.
    closeSync(openSync(LOCK_PATH, 'wx'));
  } catch {
    // Lock exists — is it stale?
    try {
      const age = Date.now() - statSync(LOCK_PATH).mtimeMs;
      if (age > LOCK_STALE_MS) {
        unlinkSync(LOCK_PATH);
        try {
          closeSync(openSync(LOCK_PATH, 'wx'));
        } catch {
          return refuse('lock-contention', 'a fresh drill lock appeared while breaking the stale one');
        }
      } else {
        return refuse(
          'lock-held',
          `another drill holds the lock (age ${Math.round(age / 1000)}s) — a killed console can leave a lock for up to 3 minutes`,
        );
      }
    } catch {
      return refuse('lock-unreadable', 'the drill lock could not be read');
    }
  }

  try {
    // ── pre-flight refusals — every one is an honest 409 ────────────────────
    if (!existsSync(STATUS_PATH)) {
      return refuse('guardian-off', 'no guardian status file — the surface is unwatched; arm the guardian first');
    }
    let status: Record<string, unknown> | null = null;
    try {
      status = JSON.parse(readFileSync(STATUS_PATH, 'utf8')) as Record<string, unknown>;
    } catch {
      return refuse('status-unreadable', 'guardian status.json exists but cannot be parsed');
    }

    const guardianPid = Number(status.guardianPid ?? 0);
    if (!pidAlive(guardianPid)) {
      return refuse('guardian-dead', `the guardian process (pid ${guardianPid || '?'}) is not running — arm it first`);
    }
    const intervalSec = Number(status.intervalSec ?? 20);
    const lastPassMs = parseUtc(String(status.lastPassAtUtc ?? ''));
    if (!Number.isFinite(lastPassMs) || Date.now() - lastPassMs > 3 * intervalSec * 1000) {
      return refuse('guardian-stale', 'the guardian has not completed a pass within 3× its interval — fix the watcher before drilling');
    }
    if (status.duplicateDetected === true) {
      return refuse('duplicate-next-server', 'a duplicate next-server is detected (R56 class) — operator decision territory; no drills while ambiguous');
    }
    const lastAction = String(status.lastAction ?? 'monitor');
    const lastBounceMs = status.lastBounceAtUtc ? parseUtc(String(status.lastBounceAtUtc)) : NaN;
    if (lastAction.startsWith('bounce') && Number.isFinite(lastBounceMs) && Date.now() - lastBounceMs < 2 * intervalSec * 1000) {
      return refuse('bounce-in-flight', `the guardian is mid-landing a real bounce (${lastAction}) — drill after it settles`);
    }
    const availKb = Number(status.boxAvailKb ?? 0);
    if (Number.isFinite(availKb) && availKb > 0 && availKb < MIN_BOX_AVAIL_KB) {
      return refuse(
        'box-pressure',
        `box MemAvailable is ${Math.round(availKb / 1024)}MB — a drill adds transient processes; refuse under 450MB`,
      );
    }
    // R69 — drill scheduling guard: a REAL bounce means a BRAND-NEW dev
    // server still warming up; a drill's transient load during that window
    // is exactly what the quiet period exists to avoid. Drill rows are
    // ignored — they never touched the real surface.
    if (existsSync(JOURNAL_PATH)) {
      try {
        const rows = readFileSync(JOURNAL_PATH, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            try {
              return JSON.parse(line) as { at?: string; drill?: boolean; reason?: string };
            } catch {
              return null;
            }
          })
          .filter((r): r is { at?: string; drill?: boolean; reason?: string } => r !== null);
        const lastReal = rows.filter((r) => r.drill !== true).pop(); // journal is chronological
        if (lastReal?.at) {
          const ageMs = Date.now() - parseUtc(lastReal.at);
          if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < REAL_BOUNCE_QUIET_MS) {
            return refuse(
              'recent-real-bounce',
              `a real bounce (${lastReal.reason ?? '?'}) landed ${Math.round(ageMs / 1000)}s ago — the fresh surface is still warming; drill after ${REAL_BOUNCE_QUIET_MS / 60000} quiet minutes`,
            );
          }
        }
      } catch {
        /* journal unreadable — the other rails still apply */
      }
    }

    // ── run the drill — the exact binary, its exact machinery ───────────────
    drillInFlight = true;
    lastStdout = '';
    let summary: DrillSummary | null = null;
    let childError: string | null = null;
    try {
      const result = await new Promise<{ stdout: string }>((resolve, reject) => {
        execFile(
          'python3',
          [join(ROOT, '.zscripts', 'guardian.py'), '--drill', '--drill-port', '3999'],
          { timeout: DRILL_TIMEOUT_MS, encoding: 'utf8', windowsHide: true, cwd: ROOT, maxBuffer: 4 * 1024 * 1024 },
          (err, stdout) => {
            lastStdout = String(stdout ?? '');
            if (err) reject(Object.assign(err as Error, { stdout: lastStdout }));
            else resolve({ stdout: lastStdout });
          },
        );
      });
      summary = parseSummary(result.stdout);
    } catch (e) {
      const err = e as Error & { stdout?: string; killed?: boolean };
      childError = err.killed
        ? `drill timed out after ${DRILL_TIMEOUT_MS / 1000}s and was killed`
        : `drill process failed: ${err.message}`;
      if (err.stdout) summary = parseSummary(err.stdout);
      if (err.killed) {
        // The child died mid-drill — best-effort the victim so the drill
        // still leaves nothing behind.
        const c = cleanupVictimBestEffort();
        childError += c.killed ? ` (victim ${c.pid} killed best-effort)` : ' (no live victim found to clean)';
      }
    } finally {
      drillInFlight = false;
      try {
        unlinkSync(LOCK_PATH);
      } catch {
        /* lock already gone — fine */
      }
    }

    if (!summary) {
      return NextResponse.json(
        {
          ok: false,
          error: childError ?? 'guardian.py produced no parsable drill summary',
          hint: 'check .zscripts/guardian.log and run the drill by hand: python3 .zscripts/guardian.py --drill',
          stdoutPreview: lastStdout ? lastStdout.slice(-600) : '(empty)',
        },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const verdict = summary.drill === 'PASS';
    return NextResponse.json(
      {
        ok: verdict,
        verdict: summary.drill,
        summary,
        childError,
        atUtc: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    // Release the lock on ANY escape path — a leaked lock would block every
    // future drill for 3 minutes.
    drillInFlight = false;
    try {
      unlinkSync(LOCK_PATH);
    } catch {
      /* already gone */
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'drill dispatch failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
