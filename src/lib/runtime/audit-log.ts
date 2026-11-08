/**
 * Append-Only Audit Log — the Canonical pattern.
 * Every mutation is logged BEFORE it is applied. Replay the log = reconstruct state.
 * This is NOT a database table. It's an append-only event stream with SHA-256 chaining.
 *
 * Architecture:
 * - Each entry chains to the previous via hash(prevHash + entry)
 * - Entries are immutable once written
 * - The log can be exported/imported as a portable JSON snapshot
 * - Replay(log) → reconstructed state
 */

import { sha256 } from "@/lib/crypto/mmr";

export interface AuditEntry {
  seq: number;
  timestamp: number;
  action: string;        // e.g. "entity.update", "evidence.intake", "policy.compile"
  collection: string;    // e.g. "entities", "evidence", "policies"
  recordId: string;      // the affected record's ID
  before: unknown;       // state before mutation (null for creates)
  after: unknown;        // state after mutation (null for deletes)
  actor: string;         // who/what initiated the mutation
  prevHash: string;      // hash of the previous entry (chain)
  entryHash: string;     // hash of this entry (prevHash + action + collection + recordId + after + timestamp)
}

export class AuditLog {
  private entries: AuditEntry[] = [];
  private listeners: ((entry: AuditEntry) => void)[] = [];

  /** Append a mutation to the log. Returns the entry. */
  append(
    action: string,
    collection: string,
    recordId: string,
    before: unknown,
    after: unknown,
    actor: string = "system",
  ): AuditEntry {
    const seq = this.entries.length;
    const prevHash = seq > 0 ? this.entries[seq - 1].entryHash : sha256("genesis");
    const timestamp = Date.now();

    const entryHash = sha256(
      prevHash + action + collection + recordId + JSON.stringify(after) + timestamp,
    );

    const entry: AuditEntry = {
      seq,
      timestamp,
      action,
      collection,
      recordId,
      before: before ?? null,
      after: after ?? null,
      actor,
      prevHash,
      entryHash,
    };

    this.entries.push(entry);
    this.listeners.forEach((fn) => fn(entry));
    return entry;
  }

  /** Verify the chain integrity — every entry's prevHash must match the previous entry's entryHash. */
  verify(): { valid: boolean; brokenAt: number | null } {
    for (let i = 1; i < this.entries.length; i++) {
      if (this.entries[i].prevHash !== this.entries[i - 1].entryHash) {
        return { valid: false, brokenAt: i };
      }
    }
    return { valid: true, brokenAt: null };
  }

  /** Replay the log to reconstruct state. Returns a Map<collection, Map<recordId, record>>. */
  replay(): Map<string, Map<string, unknown>> {
    const state = new Map<string, Map<string, unknown>>();

    for (const entry of this.entries) {
      if (!state.has(entry.collection)) {
        state.set(entry.collection, new Map());
      }
      const col = state.get(entry.collection)!;

      if (entry.action.endsWith(".delete") || entry.action.endsWith(".remove")) {
        col.delete(entry.recordId);
      } else if (entry.after !== null) {
        col.set(entry.recordId, entry.after);
      }
    }

    return state;
  }

  /** Get all entries (newest first for display). */
  getAll(): AuditEntry[] {
    return [...this.entries].reverse();
  }

  /** Get entries for a specific collection. */
  getByCollection(collection: string): AuditEntry[] {
    return this.entries.filter((e) => e.collection === collection);
  }

  /** Get the current head hash (for verification/anchoring). */
  getHeadHash(): string {
    return this.entries.length > 0
      ? this.entries[this.entries.length - 1].entryHash
      : sha256("genesis");
  }

  /** Get entry count. */
  get length(): number {
    return this.entries.length;
  }

  /** Subscribe to new entries (for real-time UI updates). */
  onAppend(fn: (entry: AuditEntry) => void): void {
    this.listeners.push(fn);
  }

  /** Export the full log as a portable JSON snapshot. */
  export(): { exported: string; headHash: string; entries: AuditEntry[] } {
    return {
      exported: new Date().toISOString(),
      headHash: this.getHeadHash(),
      entries: this.entries,
    };
  }

  /** Import a log snapshot (replaces current log). */
  import(snapshot: { entries: AuditEntry[] }): void {
    this.entries = snapshot.entries;
  }

  /** Reset to empty. */
  reset(): void {
    this.entries = [];
  }
}

// Singleton instance — the project-wide audit log
let globalAuditLog: AuditLog | null = null;

export function getAuditLog(): AuditLog {
  if (!globalAuditLog) {
    globalAuditLog = new AuditLog();
  }
  return globalAuditLog;
}
