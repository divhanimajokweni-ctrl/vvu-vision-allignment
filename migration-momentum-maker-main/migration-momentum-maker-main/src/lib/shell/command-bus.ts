/* VVU SHELL CLIENT — §2 command bus.
 *
 * Routes UiCommands from the shell (hotkeys, palette, toolbar buttons) to
 * the target environment's handler. Global commands (no target) are routed
 * to the 'global' subscriber, which the orchestrator uses to drive layout
 * changes (UNIFY/SPLIT/WORKSPACE/TOGGLE) and the import/export port.
 *
 * Maintains a bounded command log (last 100) for debugging — never for
 * replay. The log is intentionally NOT an audit trail (that is the
 * debugger's WORM chain at :3098); it is a developer-facing ring buffer.
 */

import type { EnvironmentId, Scope, UiCommand } from './types';

/** A per-scope command handler. */
export type CommandHandler = (command: UiCommand) => void;

/** A single entry in the bounded command log. */
export interface CommandLogEntry {
  command: UiCommand;
  /** Where the command was routed (environment id, 'global', or null if unrouted). */
  routedTo: Scope | null;
  /** ISO timestamp of dispatch. */
  dispatchedAt: string;
}

const MAX_LOG = 100;

/**
 * CommandBus — shell → environment dispatch with a bounded debug log.
 * Use getCommandBus() to obtain the process-wide singleton.
 */
export class CommandBus {
  private handlers = new Map<Scope, CommandHandler>();
  private log: CommandLogEntry[] = [];

  /**
   * Registers a handler for a scope (an environment id or 'global').
   * Re-registering the same scope replaces the prior handler.
   */
  subscribe(scope: Scope, handler: CommandHandler): () => void {
    this.handlers.set(scope, handler);
    return () => {
      // Only unsubscribe if the same handler is still registered.
      if (this.handlers.get(scope) === handler) {
        this.handlers.delete(scope);
      }
    };
  }

  /** Removes the handler for a scope. */
  unsubscribe(scope: Scope): void {
    this.handlers.delete(scope);
  }

  /**
   * Dispatches a command. Routes by target: if `command.target` is set,
   * the matching environment handler is invoked; otherwise the 'global'
   * handler is invoked. Unrouted commands (no handler) are still logged
   * so the orchestrator can detect wiring gaps in dev.
   */
  dispatch(command: UiCommand): void {
    const routedTo: Scope | null = command.target ?? 'global';
    const handler = routedTo ? this.handlers.get(routedTo) : undefined;
    this.appendLog({ command, routedTo, dispatchedAt: new Date().toISOString() });
    if (handler) {
      try {
        handler(command);
      } catch (err) {
        // A handler throwing must not break the bus. Log + rethrow-free.
        // The orchestrator's error boundary will surface runtime errors.
        console.error(
          `[shell.command-bus] handler for ${routedTo} threw on ${command.command}`,
          err,
        );
      }
    }
  }

  /** Returns a defensive copy of the bounded command log (newest last). */
  getLog(): CommandLogEntry[] {
    return this.log.slice();
  }

  /** Clears the command log. */
  clearLog(): void {
    this.log.length = 0;
  }

  /** Returns the list of scopes with a registered handler. */
  subscribedScopes(): Scope[] {
    return Array.from(this.handlers.keys());
  }

  /** Appends an entry, evicting the oldest once over MAX_LOG. */
  private appendLog(entry: CommandLogEntry): void {
    this.log.push(entry);
    while (this.log.length > MAX_LOG) this.log.shift();
  }
}

/* ---------- singleton ---------- */

let singleton: CommandBus | null = null;

/** Process-wide CommandBus singleton. Lazily constructed (SSR-safe). */
export function getCommandBus(): CommandBus {
  if (!singleton) singleton = new CommandBus();
  return singleton;
}

/** Convenience: the set of environment ids the bus considers valid targets. */
export const VALID_ENVIRONMENTS: readonly EnvironmentId[] = [
  'forge',
  'bench',
  'fire',
  'field',
  'press',
] as const;
