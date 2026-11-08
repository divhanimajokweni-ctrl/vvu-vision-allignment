/**
 * Plugin Hook System — the Canonical pattern.
 * Plugins register callbacks at defined hook points.
 * Hooks fire synchronously before/after the operation.
 *
 * Hook points:
 * - boot: fired once when the system starts
 * - store.commit: fired before any audit log entry is committed
 * - evidence.intake: fired when new evidence is created
 * - evidence.stage: fired when evidence advances stage
 * - evidence.tamper: fired when a sealed record is edited
 * - shard.migrate: fired when a shard is rebalanced
 * - invariant.violation: fired when an invariant is breached
 * - alert.raise: fired when an alert is raised
 * - audit.flush: fired when the audit log is exported
 */

export type HookPoint =
  | "boot"
  | "store.commit"
  | "evidence.intake"
  | "evidence.stage"
  | "evidence.tamper"
  | "shard.migrate"
  | "invariant.violation"
  | "alert.raise"
  | "audit.flush";

export interface Plugin {
  id: string;
  name: string;
  version: string;
  hook: HookPoint;
  state: "enabled" | "disabled";
  desc: string;
  callback: (payload: unknown) => void | Promise<void>;
}

class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  private hooks: Map<HookPoint, Plugin[]> = new Map();
  private booted = false;

  /** Register a plugin. */
  register(plugin: Omit<Plugin, "state"> & { state?: "enabled" | "disabled" }): void {
    const full: Plugin = {
      ...plugin,
      state: plugin.state ?? "enabled",
    };
    this.plugins.set(plugin.id, full);

    if (full.state === "enabled") {
      this.addToHook(full);
    }
  }

  /** Unregister a plugin. */
  unregister(id: string): void {
    const plugin = this.plugins.get(id);
    if (plugin) {
      this.removeFromHook(plugin);
      this.plugins.delete(id);
    }
  }

  /** Enable a plugin. */
  enable(id: string): void {
    const plugin = this.plugins.get(id);
    if (plugin && plugin.state === "disabled") {
      plugin.state = "enabled";
      this.addToHook(plugin);
    }
  }

  /** Disable a plugin. */
  disable(id: string): void {
    const plugin = this.plugins.get(id);
    if (plugin && plugin.state === "enabled") {
      plugin.state = "disabled";
      this.removeFromHook(plugin);
    }
  }

  /** Fire a hook — calls all enabled plugins registered at this point. */
  async fire(hook: HookPoint, payload: unknown): Promise<void> {
    const plugins = this.hooks.get(hook) ?? [];
    for (const plugin of plugins) {
      try {
        await plugin.callback(payload);
      } catch (e) {
        console.error(`[plugin:${plugin.id}] hook ${hook} error:`, e);
      }
    }
  }

  /** Fire a hook synchronously (for hooks that must complete before the operation). */
  fireSync(hook: HookPoint, payload: unknown): void {
    const plugins = this.hooks.get(hook) ?? [];
    for (const plugin of plugins) {
      try {
        plugin.callback(payload);
      } catch (e) {
        console.error(`[plugin:${plugin.id}] hook ${hook} error:`, e);
      }
    }
  }

  /** Get all registered plugins. */
  getAll(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /** Get a plugin by ID. */
  get(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }

  /** Boot all plugins (fires the boot hook once). */
  boot(): void {
    if (this.booted) return;
    this.booted = true;
    this.fireSync("boot", { timestamp: Date.now() });
  }

  /** Get plugin count. */
  get count(): number {
    return this.plugins.size;
  }

  private addToHook(plugin: Plugin): void {
    if (!this.hooks.has(plugin.hook)) {
      this.hooks.set(plugin.hook, []);
    }
    this.hooks.get(plugin.hook)!.push(plugin);
  }

  private removeFromHook(plugin: Plugin): void {
    const arr = this.hooks.get(plugin.hook);
    if (arr) {
      const idx = arr.indexOf(plugin);
      if (idx >= 0) arr.splice(idx, 1);
    }
  }
}

// Singleton
let globalRegistry: PluginRegistry | null = null;

export function getPluginRegistry(): PluginRegistry {
  if (!globalRegistry) {
    globalRegistry = new PluginRegistry();
  }
  return globalRegistry;
}

// ── Built-in plugins (registered at boot) ───────────────────────────────────

export function registerBuiltinPlugins(): void {
  const registry = getPluginRegistry();

  // Evidence logger — logs all evidence operations
  registry.register({
    id: "plg-evidence-logger",
    name: "Evidence Logger",
    version: "1.0.0",
    hook: "evidence.intake",
    desc: "Logs all evidence intake operations to the audit log",
    callback: (payload) => {
      console.log("[plugin:evidence-logger] intake:", payload);
    },
  });

  // Violation alerter — raises alerts on invariant violations
  registry.register({
    id: "plg-violation-alerter",
    name: "Violation Alerter",
    version: "1.0.0",
    hook: "invariant.violation",
    desc: "Raises real-time alerts when invariants are violated",
    callback: (payload) => {
      console.log("[plugin:violation-alerter] ALERT:", payload);
    },
  });

  // Tamper detector — flags sealed evidence edits
  registry.register({
    id: "plg-tamper-detector",
    name: "Tamper Detector",
    version: "1.0.0",
    hook: "evidence.tamper",
    desc: "Detects and flags tampering of sealed evidence records",
    callback: (payload) => {
      console.warn("[plugin:tamper-detector] TAMPER DETECTED:", payload);
    },
  });

  // Audit flush hook — fires when the audit log is exported
  registry.register({
    id: "plg-audit-flush",
    name: "Audit Flush",
    version: "1.0.0",
    hook: "audit.flush",
    desc: "Handles audit log export and snapshot creation",
    callback: (payload) => {
      console.log("[plugin:audit-flush] flushing:", payload);
    },
  });

  registry.boot();
}
