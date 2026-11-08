// src/server/fleet/registry.ts — R76 · the fleet's single source of truth.
// ─────────────────────────────────────────────────────────────────────────────
// R75 built the fleet board with an inline registry; R76 extracts it here
// and completes it with the fields OPERATIONS need: how each service is
// spawned (cwd + exact command + log path — every row verified live from
// /proc/<pid>/cwd and /proc/<pid>/cmdline on 2026-09-24), whether it may
// be restarted from the console at all, and what its healthy root answer
// is. ONE registry serves both the probe (GET /api/fleet) and the
// guarded restart (POST /api/fleet/restart) so display and enforcement
// cannot drift — the same lesson R73's integrity fix taught.
//
// Honesty rules:
//   - :3000 is the guardian's domain: restartable:false, and the restart
//     route refuses it BEFORE touching anything.
//   - The expectation numbers come from each service's own source, not
//     from a port scan (a scan would silently bless whatever answers).
//   - Adding a mini-service means adding a row HERE — the registry is the
//     honesty anchor, deliberately not a port scan (R75 risk #5).
// ─────────────────────────────────────────────────────────────────────────────

import { join } from 'node:path';

export const ROOT = process.cwd();

export interface FleetService {
  port: number;
  name: string;
  service: string;
  role: string;
  kind: 'surface' | 'http' | 'api-only';
  expectedRootStatus: number;
  note: string | null;
  /** exact spawn command — verified from /proc/<pid>/cmdline */
  spawnCmd: string[];
  /** exact working directory — ALSO the process identifier (every
      mini-service runs as plain "bun", the cwd is what disambiguates) */
  spawnCwd: string;
  /** daemonize --log target (append — the existing per-service logs) */
  spawnLog: string;
  /** :3000 is the guardian's — the console may not bounce it */
  restartable: boolean;
}

export const FLEET_REGISTRY: FleetService[] = [
  {
    port: 3000,
    name: 'ESTATE SURFACE',
    service: 'vvu-estate dev (Next.js)',
    role: 'the dashboard you are reading — the guardian watches this one',
    kind: 'surface',
    expectedRootStatus: 200,
    note: null,
    spawnCmd: ['bun', 'run', 'dev'],
    spawnCwd: ROOT,
    spawnLog: '/dev/null',
    restartable: false,
  },
  {
    port: 3003,
    name: 'TELEMETRY SERVICE',
    service: 'vvu-telemetry-service',
    role: 'VVU edge telemetry sim (socket.io · Gqeberha node)',
    kind: 'api-only',
    expectedRootStatus: 404,
    note: 'pure API — root 404 is the designed answer (socket.io path + /healthz)',
    spawnCmd: ['bun', '--hot', 'index.ts'],
    spawnCwd: join(ROOT, 'mini-services', 'telemetry-service'),
    spawnLog: join(ROOT, '.zscripts', 'mini-service-telemetry-service.log'),
    restartable: true,
  },
  {
    port: 3004,
    name: 'VAULT-BRIDGE',
    service: 'proofbridge-vault-bridge',
    role: 'receipt pairing + vault relay for the field agent',
    kind: 'http',
    expectedRootStatus: 200,
    note: null,
    spawnCmd: ['bun', '--hot', 'index.ts'],
    spawnCwd: join(ROOT, 'mini-services', 'vault-bridge'),
    spawnLog: join(ROOT, '.zscripts', 'mini-service-vault-bridge.log'),
    restartable: true,
  },
  {
    port: 3005,
    name: 'FIELD-ONBOARD',
    service: 'proofbridge-vvu-field-onboard',
    role: 'field onboarding + device pairing (socket.io)',
    kind: 'http',
    expectedRootStatus: 200,
    note: null,
    spawnCmd: ['bun', '--hot', 'index.ts'],
    spawnCwd: join(ROOT, 'mini-services', 'vvu-field-onboard'),
    spawnLog: join(ROOT, '.zscripts', 'mini-service-vvu-field-onboard.log'),
    restartable: true,
  },
  {
    port: 3006,
    name: 'WILDFIRE-MESH',
    service: 'wildfire-mesh',
    role: 'simulated field mesh with a local SHA256 chain',
    kind: 'http',
    expectedRootStatus: 200,
    note: null,
    spawnCmd: ['bun', '--hot', 'index.ts'],
    spawnCwd: join(ROOT, 'mini-services', 'wildfire-mesh'),
    spawnLog: join(ROOT, '.zscripts', 'mini-service-wildfire-mesh.log'),
    restartable: true,
  },
  {
    port: 3007,
    name: 'MESH-DEMO',
    service: 'mesh-demo',
    role: 'mesh demo dashboard (join / crosscheck)',
    kind: 'http',
    expectedRootStatus: 200,
    note: null,
    spawnCmd: ['bun', '--hot', 'index.ts'],
    spawnCwd: join(ROOT, 'mini-services', 'mesh-demo'),
    spawnLog: join(ROOT, '.zscripts', 'mini-service-mesh-demo.log'),
    restartable: true,
  },
  {
    port: 3008,
    name: 'SAFEGRID API',
    service: 'safegrid-api-server (Express)',
    role: 'safety policy grid API + health relay',
    kind: 'api-only',
    expectedRootStatus: 404,
    note: 'pure API — root 404 is the designed answer (/health + JSON routes)',
    spawnCmd: ['bun', '--hot', 'src/index.ts'],
    spawnCwd: join(ROOT, 'mini-services', 'safegrid'),
    spawnLog: join(ROOT, '.zscripts', 'mini-service-safegrid.log'),
    restartable: true,
  },
];

/** The fourth append-only evidence ledger (R76): one line per console
    fleet action. The chronicle reads it as the FLEET class. */
export const FLEET_JOURNAL = join(ROOT, 'vvu-trust', 'fleet', 'actions.jsonl');
