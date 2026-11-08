// src/app/api/integrity/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// TASK 40 §4 — runner-integrity endpoint for the :3000 Next.js surface.
//
// The two bridge mini-services (:3004/:3005) report runningHash vs diskHash
// of their single entry file. Next.js dev compiles routes on demand, so this
// route fingerprints a REPRESENTATIVE SET of first-party source files:
//
//   runningHash — sha256 over the file set as captured when THIS module was
//                 (re)compiled by the dev server (module-load time)
//   diskHash    — sha256 over the same set read fresh from disk at REQUEST
//                 time
//   match:false → the running module is stale vs disk → FAIL CLOSED.
//
// The go-live runner (tests/go-live/run-golive.ts) independently recomputes
// the disk hashes and cross-checks BOTH values (no self-certification: the
// runner does its own hashing — the route cannot lie about the disk).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

// ── R66 · server footprint ─────────────────────────────────────────────────
// The OOM pattern (R61/R64 worklog: the kernel killed next-server at ~1.6GB
// anon-RSS on this 3.9GB box) made memory a FIRST-CLASS integrity fact. The
// numbers below are read from /proc/self/status — the SAME VmRSS/VmHWM the
// kernel's OOM killer weighs — not from a self-reported heap estimate.
// VmHWM is the high-water mark since process start: even if RSS later drops,
// the peak proves how close the process has come to the guard.

// OOM guard threshold in MB. R73 — SINGLE SOURCE OF TRUTH: the ENFORCING
// value is the guardian's own --rss-guard-mb, which it publishes every pass
// in vvu-trust/guardian/status.json (guardMb). This route now READS that
// file at request time (guardSource: "guardian") so the displayed guard can
// never drift from the enforced one — R73 raised the enforced guard 2100 →
// 2400 (the guard decision, from the plateau scope's own data: warm cycles
// climb +758MB/boot and were crossing 2100 from below every ~70-90min) and
// a stale display constant here would have kept telling the operator 2100.
// Fallbacks: VVU_OOM_GUARD_MB env ("env"), then 2400 ("default"). The RSS
// rail's job is RUNAWAY growth, not the warm steady state — the box-pressure
// rail (MemAvailable floor) in .zscripts/guardian.py models the real kernel
// OOM kills.
const OOM_GUARD_FALLBACK_MB = 2400;
const GUARDIAN_STATUS_PATH = join(process.cwd(), 'vvu-trust', 'guardian', 'status.json');

function enforcedGuardMb(): { mb: number; source: 'guardian' | 'env' | 'default' } {
  try {
    const st = JSON.parse(readFileSync(GUARDIAN_STATUS_PATH, 'utf8')) as { guardMb?: unknown };
    if (typeof st.guardMb === 'number' && Number.isFinite(st.guardMb) && st.guardMb >= 256) {
      return { mb: st.guardMb, source: 'guardian' };
    }
  } catch {
    // status absent/unreadable (guardian not armed yet) — fall through
  }
  const raw = Number(process.env.VVU_OOM_GUARD_MB ?? '');
  if (Number.isFinite(raw) && raw >= 256) return { mb: raw, source: 'env' };
  return { mb: OOM_GUARD_FALLBACK_MB, source: 'default' };
}

function readProcSelfStatus(): { vmRssKb: number | null; vmHwmKb: number | null } {
  try {
    const text = readFileSync('/proc/self/status', 'utf8');
    const rss = Number(/^VmRSS:\s+(\d+) kB/m.exec(text)?.[1] ?? NaN);
    const hwm = Number(/^VmHWM:\s+(\d+) kB/m.exec(text)?.[1] ?? NaN);
    return {
      vmRssKb: Number.isFinite(rss) ? rss : null,
      vmHwmKb: Number.isFinite(hwm) ? hwm : null,
    };
  } catch {
    // Non-Linux or hardened sandbox: the gauge degrades honestly to nulls.
    return { vmRssKb: null, vmHwmKb: null };
  }
}

function boxMemory(): { totalMb: number; availMb: number | null } {
  const totalMb = Math.round(os.totalmem() / 1024 / 1024);
  try {
    const text = readFileSync('/proc/meminfo', 'utf8');
    const availKb = Number(/^MemAvailable:\s+(\d+) kB/m.exec(text)?.[1] ?? NaN);
    return {
      totalMb,
      availMb: Number.isFinite(availKb) ? Math.round(availKb / 1024) : null,
    };
  } catch {
    return { totalMb, availMb: null };
  }
}

function footprintPayload() {
  const { vmRssKb, vmHwmKb } = readProcSelfStatus();
  const mem = process.memoryUsage();
  const box = boxMemory();
  // One-clock discipline: emit the estate's "YYYY-MM-DD HH:MM:SS UTC" shape
  // so the UI can display it without re-parsing into the viewer's timezone.
  const stampUtc = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  return {
    pid: process.pid,
    // Kernel-reported resident set + peak (the OOM killer's own numbers).
    rssKb: vmRssKb,
    hwmKb: vmHwmKb,
    // JS-heap view (subset of the resident set) for the honest breakdown.
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    externalMb: Math.round(mem.external / 1024 / 1024),
    arrayBuffersMb: Math.round((mem.arrayBuffers ?? 0) / 1024 / 1024),
    // R73 — read fresh at request time: the guardian may re-arm with a new
    // guard between module compiles; the display must never outlive it.
    ...(() => {
      const g = enforcedGuardMb();
      return { guardMb: g.mb, guardSource: g.source };
    })(),
    boxTotalMb: box.totalMb,
    boxAvailMb: box.availMb,
    sampledAtUtc: stampUtc,
  };
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fingerprinted first-party files (relative to repo root). Chosen to cover
// the app shell + the hash router + this route itself.
const WATCHED = [
  'src/app/page.tsx',
  'src/app/layout.tsx',
  'src/hooks/use-hash-route.ts',
  'src/components/WorkspaceToggle.tsx',
  'src/app/api/integrity/route.ts',
];

function repoRoot(): string {
  // Next dev (Turbopack) compiles routes into a virtual context where
  // import.meta.url does NOT map back to the source tree (verified Task 40:
  // fileURLToPath gave <missing> for every watched file). The dev server
  // runs from the project root, so process.cwd() is the honest anchor.
  return process.cwd();
}

function hashSet(paths: string[]): { hash: string; files: number; bytes: number; perFile: Record<string, string> } {
  const h = createHash('sha256');
  let files = 0;
  let bytes = 0;
  const perFile: Record<string, string> = {};
  for (const rel of paths) {
    const abs = join(repoRoot(), rel);
    try {
      const buf = readFileSync(abs);
      h.update(rel);
      h.update(buf);
      perFile[rel] = createHash('sha256').update(buf).digest('hex');
      files += 1;
      bytes += buf.length;
    } catch {
      h.update(rel);
      h.update('<missing>');
      perFile[rel] = '<missing>';
    }
  }
  return { hash: h.digest('hex'), files, bytes, perFile };
}

// Captured at module compile time — the "running artifact" fingerprint.
const RUNNING = hashSet(WATCHED);
const COMPILED_AT = new Date().toISOString();

export async function GET() {
  const disk = hashSet(WATCHED);
  return NextResponse.json(
    {
      ok: true,
      service: 'proofbridge-next-dashboard',
      port: 3000,
      watchedFiles: WATCHED,
      runningHash: RUNNING.hash,
      diskHash: disk.hash,
      runningPerFile: RUNNING.perFile,
      diskPerFile: disk.perFile,
      match: disk.hash === RUNNING.hash,
      compiledAt: COMPILED_AT,
      uptimeSec: Math.round(process.uptime()),
      runtime: `node ${process.version}`,
      runtimeName: 'next-dev',
      footprint: footprintPayload(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
