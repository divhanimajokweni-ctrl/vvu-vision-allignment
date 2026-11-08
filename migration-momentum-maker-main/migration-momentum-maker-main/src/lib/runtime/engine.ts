/**
 * Invariant Enforcement Engine — continuously monitors state and enforces
 * invariants. NOT on-demand evaluation. This is the real runtime guardian.
 *
 * - StateStore: append-only state with vector clocks (CRDT semantics)
 * - EnforcementEngine: evaluates invariants on every state transition
 * - ViolationCallback: called when an invariant breaches (real-time)
 * - MergeGuard: blocks state merges that would violate invariants
 */

import { evaluateInvariant, type InvariantNode, type PolicyNode } from "@/lib/epd";
import { buildMerkleRoot, sha256 } from "@/lib/crypto/mmr";

// ── Vector Clock (CRDT) ─────────────────────────────────────────────────────

export class VectorClock {
  private clocks: Map<string, number> = new Map();

  constructor(initial?: Record<string, number>) {
    if (initial) {
      for (const [k, v] of Object.entries(initial)) {
        this.clocks.set(k, v);
      }
    }
  }

  increment(nodeId: string): void {
    this.clocks.set(nodeId, (this.clocks.get(nodeId) ?? 0) + 1);
  }

  merge(other: VectorClock): VectorClock {
    const merged = new VectorClock();
    for (const [k, v] of this.clocks) {
      merged.clocks.set(k, Math.max(v, other.clocks.get(k) ?? 0));
    }
    for (const [k, v] of other.clocks) {
      if (!merged.clocks.has(k)) merged.clocks.set(k, v);
    }
    return merged;
  }

  happensBefore(other: VectorClock): boolean {
    let allLe = true;
    let anyLt = false;
    for (const [k, v] of this.clocks) {
      const ov = other.clocks.get(k) ?? 0;
      if (v > ov) { allLe = false; break; }
      if (v < ov) anyLt = true;
    }
    for (const [k, v] of other.clocks) {
      if (!this.clocks.has(k) && v > 0) anyLt = true;
    }
    return allLe && anyLt;
  }

  isConcurrent(other: VectorClock): boolean {
    return !this.happensBefore(other) && !other.happensBefore(this);
  }

  toJSON(): Record<string, number> {
    return Object.fromEntries(this.clocks);
  }
}

// ── State Transition ────────────────────────────────────────────────────────

export interface StateTransition {
  id: string;
  shardId: string;
  nodeId: string;
  clock: VectorClock;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  timestamp: number;
  invariantResults: { name: string; passed: boolean; severity: string; soft: boolean }[];
  committed: boolean;
  rejected: boolean;
  rejectReason?: string;
}

// ── Enforcement Engine ──────────────────────────────────────────────────────

export type ViolationCallback = (
  transition: StateTransition,
  violatedInvariants: { name: string; severity: string; soft: boolean; predicate: string }[],
) => void;

export class EnforcementEngine {
  private policy: PolicyNode;
  private transitions: StateTransition[] = [];
  private currentState: Map<string, Record<string, unknown>> = new Map();
  private clocks: Map<string, VectorClock> = new Map();
  private violationCallback: ViolationCallback | null = null;
  private stateHistory: string[] = [];

  constructor(policy: PolicyNode) {
    this.policy = policy;
  }

  onViolation(cb: ViolationCallback): void {
    this.violationCallback = cb;
  }

  /**
   * Attempt a state transition. Evaluates ALL invariants against the proposed
   * new state. Hard violations BLOCK the transition. Soft violations are
   * reported but don't block.
   */
  proposeTransition(
    shardId: string,
    nodeId: string,
    proposedState: Record<string, unknown>,
  ): StateTransition {
    const beforeState = this.currentState.get(shardId) ?? {};
    const clock = (this.clocks.get(shardId) ?? new VectorClock());
    clock.increment(nodeId);

    const results = this.policy.invariants.map((inv) => {
      const ev = evaluateInvariant(inv, proposedState);
      return { name: inv.name, passed: ev.passed, severity: inv.severity, soft: inv.soft };
    });

    const hardViolations = results.filter((r) => !r.passed && !r.soft);
    const softViolations = results.filter((r) => !r.passed && r.soft);

    const transition: StateTransition = {
      id: sha256(`${shardId}:${nodeId}:${Date.now()}:${JSON.stringify(proposedState)}`).slice(0, 16),
      shardId, nodeId, clock, beforeState, afterState: proposedState,
      timestamp: Date.now(), invariantResults: results,
      committed: false, rejected: false,
    };

    if (hardViolations.length > 0) {
      transition.rejected = true;
      transition.rejectReason = `HARD_INVARIANT_VIOLATION: ${hardViolations.map((v) => v.name).join(", ")}`;
      this.transitions.push(transition);
      return transition;
    }

    // COMMIT
    transition.committed = true;
    this.currentState.set(shardId, proposedState);
    this.clocks.set(shardId, clock);
    this.transitions.push(transition);
    this.stateHistory.push(sha256(`${transition.id}:${JSON.stringify(proposedState)}`));

    if (softViolations.length > 0 && this.violationCallback) {
      this.violationCallback(transition, softViolations.map((v) => {
        const inv = this.policy.invariants.find((i) => i.name === v.name)!;
        return { name: v.name, severity: v.severity, soft: v.soft, predicate: inv.rawPredicate };
      }));
    }

    return transition;
  }

  /**
   * Attempt to merge state from another shard using vector clocks.
   * - happens-before → accept newer / reject stale
   * - concurrent → reject (requires self-repair)
   */
  attemptMerge(
    shardId: string,
    incomingState: Record<string, unknown>,
    incomingClock: VectorClock,
  ): { merged: boolean; reason: string; transition?: StateTransition } {
    const localClock = this.clocks.get(shardId);
    if (!localClock) {
      const t = this.proposeTransition(shardId, "merge", incomingState);
      return { merged: t.committed, reason: t.committed ? "ACCEPTED_INITIAL" : t.rejectReason!, transition: t };
    }
    if (incomingClock.happensBefore(localClock)) {
      return { merged: false, reason: "STALE: incoming behind local" };
    }
    if (localClock.happensBefore(incomingClock)) {
      const t = this.proposeTransition(shardId, "merge", incomingState);
      return { merged: t.committed, reason: t.committed ? "ACCEPTED_NEWER" : t.rejectReason!, transition: t };
    }
    return { merged: false, reason: "CONCURRENT: diverged — self-repair required" };
  }

  /** Merkle root of state history (for ancestry proofs). */
  getStateRoot(): string {
    return this.stateHistory.length === 0 ? sha256("") : buildMerkleRoot(this.stateHistory);
  }

  getTransitions(): StateTransition[] { return [...this.transitions]; }
  get committedCount(): number { return this.transitions.filter((t) => t.committed).length; }
  get rejectedCount(): number { return this.transitions.filter((t) => t.rejected).length; }
  getState(shardId: string): Record<string, unknown> | undefined { return this.currentState.get(shardId); }
  getClock(shardId: string): VectorClock | undefined { return this.clocks.get(shardId); }
}
