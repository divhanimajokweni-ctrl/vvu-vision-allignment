/* VVU SHELL CLIENT — §5 worker supervisor.
 *
 * Spawns one Web Worker per environment, postMessages typed envelopes +
 * commands to them, and tears them down on unmount or error. Origin
 * allowlist: SAME-ORIGIN ONLY — a cross-origin worker.src is refused so a
 * hostile manifest cannot exfiltrate envelope data to a third party.
 *
 * SSR + Workers-unavailable fallback: every method is a guarded no-op
 * (returns a structured error) when `typeof Worker === 'undefined'`. The
 * shell must still boot in SSR and in browsers with workers disabled; the
 * orchestrator can degrade to in-thread execution when spawn() reports
 * unavailable.
 */

import type {
  EnvironmentId,
  WorkerInbound,
  WorkerMessageHandler,
  WorkerOutbound,
} from './types';

/** Result of a spawn attempt. */
export type SpawnResult =
  | { ok: true }
  | { ok: false; code: 'WORKERS_UNAVAILABLE' | 'CROSS_ORIGIN' | 'ALREADY_SPAWNED'; reason: string };

interface ManagedWorker {
  worker: Worker;
  handler: WorkerMessageHandler | null;
}

/**
 * WorkerSupervisor — one worker per environment, same-origin only.
 * Use getWorkerSupervisor() for the process-wide singleton.
 */
export class WorkerSupervisor {
  private workers = new Map<EnvironmentId, ManagedWorker>();

  /**
   * Spawns a worker for an environment. The worker src MUST be same-origin
   * (relative URLs resolve against the current origin). Refuses to clobber
   * an already-spawned worker — call terminate() first.
   */
  spawn(envId: EnvironmentId, workerSrc: string, handler?: WorkerMessageHandler): SpawnResult {
    if (typeof Worker === 'undefined') {
      return {
        ok: false,
        code: 'WORKERS_UNAVAILABLE',
        reason: 'Web Workers are unavailable (SSR or disabled). Degrade to in-thread.',
      };
    }
    if (this.workers.has(envId)) {
      return {
        ok: false,
        code: 'ALREADY_SPAWNED',
        reason: `A worker is already spawned for ${envId}. Call terminate() first.`,
      };
    }
    if (!isSameOrigin(workerSrc)) {
      return {
        ok: false,
        code: 'CROSS_ORIGIN',
        reason: `Refusing cross-origin worker src: ${workerSrc}`,
      };
    }
    const kind = this.inferKind(workerSrc);
    let worker: Worker;
    try {
      worker = new Worker(workerSrc, kind === 'module' ? { type: 'module' } : { type: 'classic' });
    } catch (err) {
      return {
        ok: false,
        code: 'WORKERS_UNAVAILABLE',
        reason: `Worker construction failed: ${String(err)}`,
      };
    }
    const managed: ManagedWorker = { worker, handler: handler ?? null };
    // Wire message + error handlers. onmessage routes typed outbound msgs.
    worker.onmessage = (ev: MessageEvent) => {
      const data = ev.data as unknown;
      const msg = coerceOutbound(data);
      if (msg) {
        managed.handler?.(msg);
      }
    };
    worker.onerror = (ev: ErrorEvent) => {
      // A worker that errored is dead weight — terminate + clean up so a
      // subsequent spawn() can retry. Surface to the handler if any.
      console.error(`[shell.worker-supervisor] ${envId} worker error:`, ev.message);
      managed.handler?.({
        type: 'error',
        message: ev.message || 'worker errored',
        code: 'WORKER_ERROR',
      });
      this.terminate(envId);
    };
    worker.onmessageerror = () => {
      managed.handler?.({
        type: 'error',
        message: 'worker posted a non-deserializable message',
        code: 'WORKER_MESSAGE_ERROR',
      });
    };
    this.workers.set(envId, managed);
    return { ok: true };
  }

  /** Terminates + removes the worker for an environment. No-op if absent. */
  terminate(envId: EnvironmentId): void {
    const managed = this.workers.get(envId);
    if (!managed) return;
    try {
      managed.worker.terminate();
    } catch {
      /* ignore — already gone */
    }
    managed.worker.onmessage = null;
    managed.worker.onerror = null;
    managed.worker.onmessageerror = null;
    this.workers.delete(envId);
  }

  /** Terminates every spawned worker (e.g. on shell teardown). */
  terminateAll(): void {
    for (const envId of Array.from(this.workers.keys())) {
      this.terminate(envId);
    }
  }

  /** Posts a typed inbound message to an environment's worker. */
  postMessage(envId: EnvironmentId, message: WorkerInbound): { ok: boolean; reason?: string } {
    const managed = this.workers.get(envId);
    if (!managed) {
      return { ok: false, reason: `no worker spawned for ${envId}` };
    }
    if (typeof Worker === 'undefined') {
      return { ok: false, reason: 'workers unavailable' };
    }
    try {
      managed.worker.postMessage(message);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: `postMessage failed: ${String(err)}` };
    }
  }

  /** Installs/Replaces the outbound-message handler for an environment. */
  onMessage(envId: EnvironmentId, handler: WorkerMessageHandler | null): void {
    const managed = this.workers.get(envId);
    if (managed) managed.handler = handler;
  }

  /** True if a live worker is spawned for the environment. */
  isSpawned(envId: EnvironmentId): boolean {
    return this.workers.has(envId);
  }

  /** The list of environments with a spawned worker. */
  spawnedEnvironments(): EnvironmentId[] {
    return Array.from(this.workers.keys());
  }

  /** Infers worker kind from the src extension (.mjs → module, else classic). */
  private inferKind(workerSrc: string): 'module' | 'classic' {
    return /\.mjs($|\?)/.test(workerSrc) ? 'module' : 'classic';
  }
}

/**
 * Same-origin check. Resolves the src against the current document URL and
 * compares origins. Returns false in SSR (no window) so spawn() refuses.
 */
function isSameOrigin(workerSrc: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(workerSrc, window.location.href);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Coerces an unknown worker message into a typed WorkerOutbound, or null
 * if the shape is unrecognized. Workers are untrusted input — never assume
 * the shape; validate before dispatching.
 */
function coerceOutbound(data: unknown): WorkerOutbound | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as { type?: unknown };
  switch (obj.type) {
    case 'envelope':
    case 'status':
    case 'error':
    case 'pong':
      return data as WorkerOutbound;
    default:
      return null;
  }
}

/* ---------- singleton ---------- */

let singleton: WorkerSupervisor | null = null;

/** Process-wide WorkerSupervisor singleton. Lazily constructed (SSR-safe). */
export function getWorkerSupervisor(): WorkerSupervisor {
  if (!singleton) singleton = new WorkerSupervisor();
  return singleton;
}
