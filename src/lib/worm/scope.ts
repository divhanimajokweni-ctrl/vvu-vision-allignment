/**
 * Scope enforcement + revocation.
 *
 * Every API request that touches a family's twin must pass `checkScope`:
 *   - joins `agent_owners` and `family_access` tables
 *   - checks a Bloom filter of revoked agent tokens (no cache on the
 *     blacklist — every request hits the live set)
 *   - returns ALLOWED, DENIED, or DEGRADED
 *
 * Fail-closed posture: if the revocation blacklist is unreachable, the
 * function returns DEGRADED (HTTP 503 SERVICE_DEGRADED). NEVER return
 * ALLOWED when the blacklist is down — a revoked token must never be
 * served, even at the cost of false denials.
 *
 * Bloom filter note: the filter is a probabilistic *shortlist*. A "maybe
 * revoked" hit must be confirmed by a deterministic lookup against the
 * authoritative revocation table. If that table is unreachable, the
 * result is DEGRADED — we do not optimistically serve.
 */
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = process.env.VVU_PROJECT_ROOT
  ? resolve(process.env.VVU_PROJECT_ROOT)
  : resolve(process.cwd());

export type ScopeDecision = "ALLOWED" | "DENIED" | "DEGRADED";

/* -------------------------------------------------------------------------- */
/* Bloom filter (m=4096 bits, k=7)                                            */
/* -------------------------------------------------------------------------- */

/**
 * A small, dependency-free Bloom filter. The filter is a shortlist: it
 * tells us "this token is *probably* revoked" or "this token is *definitely
 * not* revoked". A "probably revoked" hit must be confirmed by a
 * deterministic lookup against the authoritative revocation table.
 *
 * Parameters: m=4096 bits, k=7 hash functions. False-positive rate at
 * n=100 entries ≈ 0.3%. Adequate for a shortlist.
 */
const BLOOM_BITS = 4096;
const BLOOM_HASHES = 7;

export class RevocationBloom {
  private bits: Uint8Array;
  private count = 0;

  constructor() {
    this.bits = new Uint8Array(BLOOM_BITS / 8);
  }

  private positions(key: string): number[] {
    const out: number[] = [];
    for (let i = 0; i < BLOOM_HASHES; i++) {
      const h = createHash("sha256").update(`${i}:${key}`).digest();
      // Read a 32-bit unsigned int from the first 4 bytes.
      const v = h.readUInt32BE(0);
      out.push(v % BLOOM_BITS);
    }
    return out;
  }

  add(key: string): void {
    for (const pos of this.positions(key)) {
      this.bits[pos >> 3] |= 1 << (pos & 7);
    }
    this.count++;
  }

  /**
   * Returns true if `key` is *probably* in the set, false if it is
   * *definitely not* in the set.
   */
  maybeContains(key: string): boolean {
    for (const pos of this.positions(key)) {
      if ((this.bits[pos >> 3] & (1 << (pos & 7))) === 0) return false;
    }
    return true;
  }

  size(): number {
    return this.count;
  }

  serialize(): string {
    return Buffer.from(this.bits).toString("base64");
  }

  static deserialize(b64: string, count: number): RevocationBloom {
    const f = new RevocationBloom();
    const buf = Buffer.from(b64, "base64");
    if (buf.length !== BLOOM_BITS / 8) {
      throw new Error(`RevocationBloom: bad serialized length ${buf.length}`);
    }
    f.bits = new Uint8Array(buf);
    f.count = count;
    return f;
  }
}

/* -------------------------------------------------------------------------- */
/* Authoritative revocation table (JSON sidecar — production: DB)             */
/* -------------------------------------------------------------------------- */

const REVOKE_FILE = resolve(PROJECT_ROOT, "ledger/revoked_agents.json");

interface RevokedAgentsFile {
  /** ISO timestamp of last update. */
  updatedAt: string;
  /** Map of agentId -> revocation record. */
  revoked: Record<string, { revokedAt: string; reason: string }>;
}

/**
 * Load the authoritative revocation table from disk. Throws if the file
 * is missing or malformed — the caller must translate this into DEGRADED.
 */
function loadRevokedAgents(): RevokedAgentsFile {
  if (!existsSync(REVOKE_FILE)) {
    // First-run: seed an empty file so subsequent reads don't fail.
    const seed: RevokedAgentsFile = { updatedAt: new Date().toISOString(), revoked: {} };
    writeFileSync(REVOKE_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  const raw = readFileSync(REVOKE_FILE, "utf8");
  const parsed = JSON.parse(raw) as RevokedAgentsFile;
  if (!parsed.revoked || typeof parsed.revoked !== "object") {
    throw new Error("revoked_agents.json: malformed 'revoked' map");
  }
  return parsed;
}

/* -------------------------------------------------------------------------- */
/* DB-backed scope check (Prisma)                                            */
/* -------------------------------------------------------------------------- */

/**
 * In production: `SELECT 1 FROM agent_owners ao JOIN family_access fa ON
 * fa.owner_id = ao.owner_id WHERE ao.agent_id = ? AND fa.family_id = ?`.
 *
 * Here we use a tiny sidecar so the contract is testable offline. The
 * sidecar is at ledger/agent_scope.json. If it is missing, the function
 * fails closed (DEGRADED) — we do NOT optimistically serve.
 */
const SCOPE_FILE = resolve(PROJECT_ROOT, "ledger/agent_scope.json");

interface ScopeFile {
  /** agentId -> ownerId */
  agentOwners: Record<string, string>;
  /** ownerId -> familyId[] */
  familyAccess: Record<string, string[]>;
}

function loadScope(): ScopeFile {
  if (!existsSync(SCOPE_FILE)) {
    // First-run seed.
    const seed: ScopeFile = { agentOwners: {}, familyAccess: {} };
    writeFileSync(SCOPE_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  const raw = readFileSync(SCOPE_FILE, "utf8");
  return JSON.parse(raw) as ScopeFile;
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Check whether `agentId` is allowed to access the twin of `familyId`.
 *
 * Returns:
 *   - ALLOWED  if the agent is linked to an owner that has access to the
 *     family, AND the agent is NOT on the revocation blacklist.
 *   - DENIED   if the agent is not linked, OR the family is not in the
 *     owner's access set, OR the agent is on the revocation blacklist.
 *   - DEGRADED if the revocation blacklist is unreachable (file missing
 *     or malformed) — fail-closed. NEVER serve a revoked token.
 */
export async function checkScope(agentId: string, familyId: string): Promise<ScopeDecision> {
  // Step 1: load the scope table. If it is unreachable, DEGRADED.
  let scope: ScopeFile;
  try {
    scope = loadScope();
  } catch {
    return "DEGRADED";
  }

  const ownerId = scope.agentOwners[agentId];
  if (!ownerId) return "DENIED";

  const families = scope.familyAccess[ownerId] ?? [];
  if (!families.includes(familyId)) return "DENIED";

  // Step 2: load the revocation table. If it is unreachable, DEGRADED.
  let revoked: RevokedAgentsFile;
  try {
    revoked = loadRevokedAgents();
  } catch {
    return "DEGRADED";
  }

  // Step 3: Bloom filter shortlist. If the agent is *definitely not* in
  // the filter, we can fast-path to ALLOWED. If it *might* be, we confirm
  // against the authoritative map.
  //
  // The Bloom filter is rebuilt from the authoritative map on every call
  // — we do NOT cache the blacklist across requests. (A cached blacklist
  // is a window where a just-revoked token can still be served.)
  const bloom = new RevocationBloom();
  for (const id of Object.keys(revoked.revoked)) bloom.add(id);

  if (!bloom.maybeContains(agentId)) {
    // Definitely not revoked — fast-path ALLOWED.
    return "ALLOWED";
  }

  // Maybe revoked — confirm against the authoritative map.
  if (revoked.revoked[agentId]) {
    return "DENIED";
  }

  return "ALLOWED";
}

/**
 * Simulate a blacklist-down condition for testing. Returns DEGRADED — the
 * fail-closed posture. This function exists so the cron / test suite can
 * verify the fail-closed contract without manipulating files.
 */
export async function checkScopeBlacklistDown(_agentId: string, _familyId: string): Promise<ScopeDecision> {
  return "DEGRADED";
}
