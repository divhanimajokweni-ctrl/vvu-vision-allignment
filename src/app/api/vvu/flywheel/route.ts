// src/app/api/vvu/flywheel/route.ts — the bridge between the estate and the
// Python core (vvu-trust/runner/vvu_runner.py).
//
//   GET                                    → live status of every on-disk
//                                           flywheel artifact (never throws)
//   POST { action: "cycles"   }            → runner --flywheel --cycles 5 --interval 0.1
//   POST { action: "verify"   }            → runner --verify
//   POST { action: "bootstrap"}            → runner with no args (the
//                                           fresh-machine one-liner)
//
// One runner at a time (module-level busy guard → 409 RUNNER BUSY). python3
// is retried once via /home/z/.venv/bin/python3 on ENOENT.

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getFlywheelStatus } from '@/lib/vvu/pyflywheel';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/** vvu-trust tree — cwd-derived with the absolute sandbox path as fallback. */
const VVU_ROOT = (() => {
  const rel = path.join(process.cwd(), 'vvu-trust');
  try {
    if (fs.existsSync(path.join(rel, 'runner', 'vvu_runner.py'))) return rel;
  } catch {
    /* ignore */
  }
  return '/home/z/my-project/vvu-trust';
})();

const PY_PRIMARY = 'python3';
const PY_FALLBACK = '/home/z/.venv/bin/python3';
const SPAWN_TIMEOUT_MS = 110_000;
const SPAWN_MAX_BUFFER = 2 * 1024 * 1024;

/** module-level busy guard — exactly one runner process at a time */
let running = false;

type PyAction = 'cycles' | 'verify' | 'bootstrap';

interface SpawnOutcome {
  /** non-null when the binary could not be spawned at all (ENOENT, EACCES…) */
  spawnError: string | null;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

function spawnOnce(cmd: string, args: string[]): Promise<SpawnOutcome> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { cwd: VVU_ROOT, timeout: SPAWN_TIMEOUT_MS, maxBuffer: SPAWN_MAX_BUFFER, encoding: 'utf8' },
      (err, stdout, stderr) => {
        const out = typeof stdout === 'string' ? stdout : '';
        const se = typeof stderr === 'string' ? stderr : '';
        if (err) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code === 'ENOENT') {
            resolve({ spawnError: 'ENOENT', exitCode: null, stdout: out, stderr: se });
            return;
          }
          // non-zero exit (err.code is the numeric exit code) or spawn/timeout failure
          const exitCode = typeof code === 'number' ? code : null;
          resolve({
            spawnError: exitCode === null ? String(code ?? err.message) : null,
            exitCode,
            stdout: out,
            stderr: `${se}${se ? '\n' : ''}${err.message}`,
          });
          return;
        }
        resolve({ spawnError: null, exitCode: 0, stdout: out, stderr: se });
      }
    );
  });
}

/** python3, retried once via the venv absolute path on ENOENT. */
async function runPy(args: string[]): Promise<SpawnOutcome> {
  let r = await spawnOnce(PY_PRIMARY, args);
  if (r.spawnError === 'ENOENT') {
    r = await spawnOnce(PY_FALLBACK, args);
    if (r.spawnError === 'ENOENT') {
      return {
        spawnError: 'ENOENT',
        exitCode: null,
        stdout: '',
        stderr: `python3 not found (tried "${PY_PRIMARY}" and "${PY_FALLBACK}")`,
      };
    }
  }
  return r;
}

export async function GET() {
  return NextResponse.json(await getFlywheelStatus());
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const action = (body as { action?: unknown } | null)?.action;
  let args: string[] | null = null;
  if (action === 'cycles') {
    args = ['runner/vvu_runner.py', '--flywheel', '--cycles', '5', '--interval', '0.1'];
  } else if (action === 'verify') {
    args = ['runner/vvu_runner.py', '--verify'];
  } else if (action === 'bootstrap') {
    args = ['runner/vvu_runner.py']; // no args = the fresh-machine one-liner
  }
  if (!args) {
    return NextResponse.json(
      { error: `unknown action ${JSON.stringify(action ?? null)} — expected cycles | verify | bootstrap` },
      { status: 400 }
    );
  }

  if (running) {
    return NextResponse.json({ ok: false, error: 'RUNNER BUSY' }, { status: 409 });
  }
  running = true;
  try {
    const r = await runPy(args);
    return NextResponse.json({
      ok: r.exitCode === 0 && r.spawnError === null,
      exitCode: r.exitCode,
      action,
      stdout: r.stdout.slice(-6000),
      stderr: r.stderr.slice(-2000),
    });
  } finally {
    running = false;
  }
}
