// src/lib/proofbridge/governance.ts
// ─────────────────────────────────────────────────────────────────────────────
// GOVERNANCE LEDGER — the control-plane WORM chain (E2E Runner Brief ·
// "Log 1 Clean Build + Rule Wiring + Automatic DH").
//
// The operator's mandate: governance moves from PROSE to LEDGER. Rules are
// not paragraphs in a document — they are SIGNED, HASH-CHAINED events on a
// WORM ledger, and the control plane enforces exactly what the ledger says
// is wired. A rule with no ledger event is not a rule.
//
//   · LEDGER   : append-only SHA-256 hash chain (same engine discipline as
//               the :3004/:3005 receipt chains — genesis constant, prevHash
//               linkage, full-chain verify from genesis, RFC-6962 merkle
//               root over entry hashes, inclusion proofs for any seq).
//   · STATE    : rules / registered devIDs / revocations / DH queue are
//               NEVER stored separately — they are REPLAYED from the ledger
//               (single source of truth; the file is the state).
//   · SCOPES   : the ladder (Log 6) — propose < attest < operate < admin.
//               'admin' is OPERATOR-ONLY and cannot be minted by this build;
//               the registration endpoint refuses it with the honest reason.
//   · DH       : disciplinary hold = revocation + a queued DH event. Events
//               stay status:'queued' (unsigned) until the operator mints the
//               admin devID (operator QR action — the runner must NOT sign
//               on behalf of the operator).
//
// PURE-ish module: the store class does file I/O; everything else is pure so
// the E2E runner independently recomputes chains/roots/proofs from the raw
// governance.json file with the SAME functions (no self-certification).
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { canonicalize } from './jcs';
import { merkleRoot, merkleProof, verifyMerkleProof, type MerkleSibling } from './merkle';

// ─── The scope ladder (Log 6) ────────────────────────────────────────────────

export type Scope = 'propose' | 'attest' | 'operate' | 'admin';

/** Ordered lowest → highest. 'admin' is operator-only (QR mint, not this build). */
export const SCOPE_LADDER: readonly Scope[] = ['propose', 'attest', 'operate', 'admin'];

export function scopeAtLeast(has: Scope, needs: Scope): boolean {
  return SCOPE_LADDER.indexOf(has) >= SCOPE_LADDER.indexOf(needs);
}

export function isScope(s: unknown): s is Scope {
  return typeof s === 'string' && (SCOPE_LADDER as readonly string[]).includes(s);
}

/** Every take type and the scope it requires. Unknown types are rejected. */
export const TAKE_REQUIRED_SCOPE: Record<string, Scope> = {
  'log.baseline': 'attest',      // Log 1 — clean-build baseline
  'rule.wired': 'operate',       // Logs 2–7 — governance rule activation
  'enforcement.test': 'operate', // Phase 3 — negative-test transcript records
  'evidence.close': 'attest',    // Log 8 — evidence pack closure
  'propose.note': 'propose',     // lowest-rung take (the ladder's floor)
  'dh.sign': 'admin',            // DH queue release — OPERATOR ONLY
};

export const GOV_TAKE_TYPES = Object.keys(TAKE_REQUIRED_SCOPE);

// The six governance rules the operator brief wires in Phase 2 (Log ids 2–7;
// Log 1 is the baseline itself, Log 8 the evidence close — neither is a rule).
export const RULES: Record<string, string> = {
  LOG_2: 'VVU-devID Mandatory — all takes carry a signed devID; no ID = no scope',
  LOG_3: 'LogID Ledger Adherence — unsubmitted responses are null and void; only chain-verified takes count',
  LOG_4: 'Automatic DH + Warning — violations trigger immediate disciplinary hold (revocation) and a formal warning',
  LOG_5: 'Session-Identity Enforcement — sessions are not accounts; authority requires valid credentials, not assertions',
  LOG_6: 'Scope Ladder — propose (lowest) through admin (operator-only), enforced at the control plane',
  LOG_7: 'QR-as-Role-Grant — QR is bootstrap only; credentials define scope; expiry/revocation terminates authority',
};

/** Violation classes that trigger AUTOMATIC DH (revocation + queued event)
 *  once LOG_4 wiring is active: the brief pins these to Log 2 / Log 3. */
export function isAutoDhClass(ruleId: string): boolean {
  return ruleId === 'LOG_2' || ruleId === 'LOG_3';
}

// ─── Ledger types ───────────────────────────────────────────────────────────

export const GENESIS_GOV = 'GENESIS-PROOFBRIDGE-GOVERNANCE-20260916-000000000000';

export interface GovActor {
  devId: string;   // devID of the signer, or the system actor label
  label: string;   // honest human label
  scope: string;   // registry scope at take time ('system' for control plane)
}

export interface GovEntry {
  seq: number;
  ts: string; // ISO
  actor: GovActor;
  type: string; // 'log.baseline' | 'rule.wired' | 'dev.registered' | 'violation' | 'dh.queued' | 'evidence.close' | 'enforcement.test' | 'propose.note'
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export interface GovDevRecord {
  devId: string;
  publicKey: string; // SPKI base64 — the credential the devID is derived from
  label: string;
  scope: Scope;
  registeredAt: string;
  expiresAt: number | null; // epoch ms — null = no expiry
}

export interface GovDhEvent {
  id: string;
  devId: string | null;
  ruleId: string;
  reason: string;
  at: string;
  status: string; // 'queued — ...' until the operator admin devID signs the release
}

export interface GovRuleState {
  ruleId: string;
  wiredAt: string;
  entrySeq: number;
  actorDevId: string;
}

export interface GovState {
  rules: Map<string, GovRuleState>;
  devs: Map<string, GovDevRecord>;
  revoked: Set<string>;
  dhQueue: GovDhEvent[];
  /** canonical payload hashes of take-origin entries (replay detection) */
  seenPayloads: Set<string>;
}

/** Hash input — everything except the hash itself, in a fixed field order. */
export function canonicalGovEntry(e: Omit<GovEntry, 'hash'>): string {
  return JSON.stringify([e.seq, e.ts, e.actor.devId, e.actor.label, e.actor.scope, e.type, canonicalize(e.payload)]);
}

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

// Entry types that originate from a SIGNED take (used for replay detection).
const TAKE_ORIGIN_TYPES = new Set(['log.baseline', 'rule.wired', 'evidence.close', 'propose.note', 'enforcement.test']);

/** Replay the WHOLE ledger into state. The file is the truth — no side state. */
export function replayState(entries: GovEntry[]): GovState {
  const rules = new Map<string, GovRuleState>();
  const devs = new Map<string, GovDevRecord>();
  const revoked = new Set<string>();
  const dhQueue: GovDhEvent[] = [];
  const seenPayloads = new Set<string>();

  for (const e of entries) {
    const p = e.payload;
    if (e.type === 'rule.wired' && typeof p.ruleId === 'string') {
      rules.set(p.ruleId, { ruleId: p.ruleId, wiredAt: e.ts, entrySeq: e.seq, actorDevId: e.actor.devId });
    } else if (e.type === 'dev.registered' && typeof p.devId === 'string' && typeof p.publicKey === 'string') {
      devs.set(p.devId, {
        devId: p.devId,
        publicKey: p.publicKey,
        label: typeof p.label === 'string' ? p.label : 'unnamed',
        scope: isScope(p.scope) ? p.scope : 'propose', // unrecognized degrades DOWN, never up
        registeredAt: typeof p.registeredAt === 'string' ? p.registeredAt : e.ts,
        expiresAt: typeof p.expiresAt === 'number' ? p.expiresAt : null,
      });
    } else if (e.type === 'violation' && typeof p.ruleId === 'string') {
      // Automatic DH (Log 4): LOG_2/LOG_3 violations with an identified devID
      // revoke immediately. The revocation is replayed from the ledger —
      // there is no separate revocation list to tamper with.
      if (isAutoDhClass(p.ruleId) && typeof p.devId === 'string' && p.devId) {
        revoked.add(p.devId);
      }
    } else if (e.type === 'dh.queued' && typeof p.id === 'string') {
      dhQueue.push({
        id: p.id,
        devId: typeof p.devId === 'string' ? p.devId : null,
        ruleId: typeof p.ruleId === 'string' ? p.ruleId : 'UNKNOWN',
        reason: typeof p.reason === 'string' ? p.reason : '',
        at: e.ts,
        status: typeof p.status === 'string' ? p.status : 'queued',
      });
    }
    if (TAKE_ORIGIN_TYPES.has(e.type)) {
      seenPayloads.add(sha256Hex(canonicalize(p)));
    }
  }
  return { rules, devs, revoked, dhQueue, seenPayloads };
}

export interface GovVerifyResult {
  valid: boolean;
  checked: number;
  firstBadIndex: number;
  root: string; // head hash (empty chain → genesis)
  merkleRoot: string;
}

export function verifyGovChain(entries: GovEntry[]): GovVerifyResult {
  let prev = GENESIS_GOV;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    let expected: string;
    try {
      expected = sha256Hex(canonicalGovEntry({ seq: e.seq, ts: e.ts, actor: e.actor, type: e.type, payload: e.payload, prevHash: e.prevHash }));
    } catch {
      expected = '<uncanonicalizable>';
    }
    if (e.prevHash !== prev || e.seq !== i + 1 || e.hash !== expected) {
      return { valid: false, checked: i, firstBadIndex: i, root: prev, merkleRoot: merkleRoot(entries.map((x) => x.hash)) };
    }
    prev = e.hash;
  }
  return { valid: true, checked: entries.length, firstBadIndex: -1, root: prev, merkleRoot: merkleRoot(entries.map((x) => x.hash)) };
}

// ─── Store (file-backed, append-only) ────────────────────────────────────────

export class GovernanceStore {
  private entries: GovEntry[] = [];
  private state: GovState = replayState([]);
  readonly file: string;

  constructor(file: string) {
    this.file = file;
    try {
      if (existsSync(file)) {
        const parsed = JSON.parse(readFileSync(file, 'utf8')) as { genesis?: string; entries?: GovEntry[] };
        if (Array.isArray(parsed.entries) && verifyGovChain(parsed.entries).valid) {
          this.entries = parsed.entries;
          console.log(`[governance] loaded ${this.entries.length} entries (chain VALID)`);
        } else {
          console.error('[governance] persisted ledger FAILED verify — starting fresh (kept as governance.json.corrupt)');
          try { writeFileSync(`${file}.corrupt`, readFileSync(file)); } catch { /* ignore */ }
          this.entries = [];
        }
      }
    } catch {
      this.entries = [];
    }
    this.state = replayState(this.entries);
  }

  get count(): number { return this.entries.length; }
  get head(): string { return this.entries.length ? this.entries[this.entries.length - 1].hash : GENESIS_GOV; }
  get snapshot(): GovState { return this.state; }

  entryAt(seq: number): GovEntry | null {
    return seq >= 1 && seq <= this.entries.length ? this.entries[seq - 1] : null;
  }

  /** Append — the ONLY mutation. Computes the hash, persists, replays state. */
  append(type: string, actor: GovActor, payload: Record<string, unknown>): GovEntry {
    const body = {
      seq: this.entries.length + 1,
      ts: new Date().toISOString(),
      actor,
      type,
      payload,
      prevHash: this.head,
    };
    const entry: GovEntry = { ...body, hash: sha256Hex(canonicalGovEntry(body)) };
    this.entries.push(entry);
    try {
      writeFileSync(this.file, JSON.stringify({ genesis: GENESIS_GOV, entries: this.entries }, null, 1));
    } catch {
      /* persistence failure is non-fatal — ledger stays in memory (receipt chains use the same policy) */
    }
    this.state = replayState(this.entries);
    return entry;
  }

  verify(): GovVerifyResult {
    return verifyGovChain(this.entries);
  }

  merkleRoot(): string {
    return merkleRoot(this.entries.map((e) => e.hash));
  }

  proofFor(seq: number): { siblings: MerkleSibling[]; root: string } | null {
    const p = merkleProof(this.entries.map((e) => e.hash), seq - 1);
    return p ? { siblings: p.siblings, root: p.root } : null;
  }

  /** Independent verification of one entry against the ledger root. */
  proveEntry(seq: number, leafHash: string): { ok: boolean; root: string } {
    const p = this.proofFor(seq);
    if (!p) return { ok: false, root: this.merkleRoot() };
    return { ok: verifyMerkleProof(leafHash, p.siblings, p.root), root: p.root };
  }

  /** Public snapshot for /api/bridge/governance (registry metadata only —
   *  public KEYS are included because they are public credentials; private
   *  keys never exist server-side). */
  publicSnapshot() {
    const v = this.verify();
    return {
      genesis: GENESIS_GOV,
      count: this.entries.length,
      head: this.head,
      chainValid: v.valid,
      merkleRoot: this.merkleRoot(),
      rules: [...this.state.rules.values()],
      dhQueue: this.state.dhQueue,
      dhQueuePending: this.state.dhQueue.filter((d) => d.status.startsWith('queued')).length,
      revoked: [...this.state.revoked],
      devs: [...this.state.devs.values()].map((d) => ({
        devId: d.devId,
        label: d.label,
        scope: d.scope,
        registeredAt: d.registeredAt,
        expiresAt: d.expiresAt,
        revoked: this.state.revoked.has(d.devId),
      })),
    };
  }
}
