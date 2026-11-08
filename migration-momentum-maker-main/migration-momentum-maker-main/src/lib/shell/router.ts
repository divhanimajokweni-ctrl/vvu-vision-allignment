/* VVU SHELL CLIENT — §4 router (environment routing + mount state).
 *
 * Owns the single source of truth for which environments are mounted, which
 * is active, which are pinned, and whether the workspace is unified or
 * split. Emits immutable state snapshots via a subscribe/notify pattern so
 * the orchestrator's React tree can re-render on every transition.
 *
 * The router has NO knowledge of workers, hotkeys, or the command bus — it
 * is a pure state machine. The orchestrator wires UiCommands → router
 * methods (e.g. a FOCUS command becomes router.switch(target)).
 */

import {
  ENVIRONMENT_ORDER,
  type EnvironmentId,
  type EnvironmentManifest,
  type LayoutMode,
  type RouterState,
} from './types';

type RouterListener = (state: RouterState) => void;

/**
 * Router — mount state machine for the Five Environments.
 * Use getRouter() to obtain the process-wide singleton.
 */
export class Router {
  private manifests = new Map<EnvironmentId, EnvironmentManifest>();
  private order: EnvironmentId[] = [];
  private active: EnvironmentId | null = null;
  private pinned = new Set<EnvironmentId>();
  private layout: LayoutMode = 'unified';
  private listeners = new Set<RouterListener>();

  /** Registers an environment manifest. Idempotent on manifest.id. */
  mount(manifest: EnvironmentManifest): void {
    if (!this.manifests.has(manifest.id)) {
      this.manifests.set(manifest.id, manifest);
      // Preserve canonical ENVIRONMENT_ORDER for the mounted list so cycle()
      // and the orchestrator's nav render in a stable, predictable order.
      this.order = ENVIRONMENT_ORDER.filter((id) => this.manifests.has(id));
    } else {
      // Replace the manifest but keep position.
      this.manifests.set(manifest.id, manifest);
    }
    // First mount becomes active by default.
    if (this.active === null) this.active = manifest.id;
    this.notify();
  }

  /** Removes an environment. Clears active/pinned if it was set. */
  unmount(envId: EnvironmentId): void {
    if (!this.manifests.has(envId)) return;
    this.manifests.delete(envId);
    this.order = ENVIRONMENT_ORDER.filter((id) => this.manifests.has(id));
    this.pinned.delete(envId);
    if (this.active === envId) {
      this.active = this.order.length ? this.order[0] : null;
    }
    this.notify();
  }

  /** Focuses an environment. No-op if not mounted. */
  switch(envId: EnvironmentId): void {
    if (!this.manifests.has(envId)) return;
    if (this.active === envId) return;
    this.active = envId;
    this.notify();
  }

  /** Pins an environment so it stays visible in split layout. */
  pin(envId: EnvironmentId): void {
    if (!this.manifests.has(envId)) return;
    if (this.pinned.has(envId)) return;
    this.pinned.add(envId);
    this.notify();
  }

  /** Removes a pin. */
  unpin(envId: EnvironmentId): void {
    if (!this.pinned.has(envId)) return;
    this.pinned.delete(envId);
    this.notify();
  }

  /** Toggles pin state for an environment. Returns the new pin state. */
  togglePin(envId: EnvironmentId): boolean {
    if (this.pinned.has(envId)) {
      this.unpin(envId);
      return false;
    }
    this.pin(envId);
    return true;
  }

  /** Sets the workspace to a single unified pane. */
  unify(): void {
    if (this.layout === 'unified') return;
    this.layout = 'unified';
    this.notify();
  }

  /** Sets the workspace to split panes (pinned + active). */
  split(): void {
    if (this.layout === 'split') return;
    this.layout = 'split';
    this.notify();
  }

  /** Toggles the layout between unified and split. Returns the new layout. */
  toggleLayout(): LayoutMode {
    if (this.layout === 'unified') this.split();
    else this.unify();
    return this.layout;
  }

  /**
   * Cycles the active environment to the next mounted environment (wrapping).
   * No-op if fewer than two environments are mounted.
   */
  cycle(): void {
    if (this.order.length < 2) return;
    const idx = this.active ? this.order.indexOf(this.active) : -1;
    const next = this.order[(idx + 1) % this.order.length];
    this.switch(next);
  }

  /** Returns the manifest for an environment, or undefined if unmounted. */
  manifest(envId: EnvironmentId): EnvironmentManifest | undefined {
    return this.manifests.get(envId);
  }

  /** True if an environment is mounted. */
  isMounted(envId: EnvironmentId): boolean {
    return this.manifests.has(envId);
  }

  /** True if an environment is pinned. */
  isPinned(envId: EnvironmentId): boolean {
    return this.pinned.has(envId);
  }

  /** The current active environment id (or null). */
  getActive(): EnvironmentId | null {
    return this.active;
  }

  /** The current layout mode. */
  getLayout(): LayoutMode {
    return this.layout;
  }

  /** Returns a defensive snapshot of the current router state. */
  getState(): RouterState {
    return {
      mounted: this.order.slice(),
      active: this.active,
      pinned: Array.from(this.pinned),
      layout: this.layout,
    };
  }

  /**
   * Subscribes to state changes. The listener is called immediately with
   * the current state, then on every transition. Returns an unsubscribe.
   */
  subscribe(listener: RouterListener): () => void {
    this.listeners.add(listener);
    // Immediate callback so new subscribers hydrate without waiting.
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Notifies every listener with a fresh snapshot. */
  private notify(): void {
    const snapshot = this.getState();
    for (const l of this.listeners) {
      try {
        l(snapshot);
      } catch (err) {
        console.error('[shell.router] listener threw', err);
      }
    }
  }
}

/* ---------- singleton ---------- */

let singleton: Router | null = null;

/** Process-wide Router singleton. Lazily constructed (SSR-safe). */
export function getRouter(): Router {
  if (!singleton) singleton = new Router();
  return singleton;
}
