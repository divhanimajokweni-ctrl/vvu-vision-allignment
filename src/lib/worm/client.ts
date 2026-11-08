/**
 * VVU WORM Chain — browser (Web Crypto) client mirror.
 *
 * Used by the control plane's interactive fail-closed demo to build a real
 * SHA-256 hash chain client-side (no Ed25519 signing — that is server-only).
 * The server-side /api/vvu/twin-scenario route holds the Ed25519-signed
 * production chain; this client chain is the interactive doctrine demonstrator.
 *
 * Same spec: DOMAIN_SOURCE / DOMAIN_CHAIN / genesis / source_hash / chain_hash.
 */

import canonicalize from "canonicalize";

export const DOMAIN_SOURCE = "VVU-SOURCE-v1";
export const DOMAIN_CHAIN = "VVU-CHAIN-v1";

export const GENESIS_HEX = (() => {
  // Computed once on module load via Web Crypto; but genesis is a constant —
  // we compute it lazily and cache.
  return "";
})();

let _genesis: string | null = null;

export async function genesisHex(): Promise<string> {
  if (_genesis) return _genesis;
  _genesis = await sha256Hex(DOMAIN_CHAIN + "GENESIS");
  return _genesis;
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function seqToBytes(seq: number): Uint8Array {
  const buf = new Uint8Array(8);
  const v = BigInt(seq);
  buf[0] = Number((v >> 56n) & 255n);
  buf[1] = Number((v >> 48n) & 255n);
  buf[2] = Number((v >> 40n) & 255n);
  buf[3] = Number((v >> 32n) & 255n);
  buf[4] = Number((v >> 24n) & 255n);
  buf[5] = Number((v >> 16n) & 255n);
  buf[6] = Number((v >> 8n) & 255n);
  buf[7] = Number(v & 255n);
  return buf;
}

export async function sha256HexMulti(...parts: Array<string | Uint8Array>): Promise<string> {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = parts.map((p) =>
    typeof p === "string" ? enc.encode(p) : p
  );
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const merged = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    merged.set(c, off);
    off += c.length;
  }
  const buf = await crypto.subtle.digest("SHA-256", merged);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface ClientEntry {
  seq: number;
  type: string;
  timestamp: string;
  source: string;
  reason?: string;
  metrics?: Record<string, number>;
  state?: string;
  mode?: string;
  asset?: string;
  source_hash: string;
  chain_hash: string;
  meta?: Record<string, unknown>;
}

function payloadOf(e: ClientEntry): Record<string, unknown> {
  const p: Record<string, unknown> = { ...e };
  delete p.source_hash;
  delete p.chain_hash;
  delete p.seq;
  delete p.meta;
  return p;
}

export async function computeSourceHash(e: ClientEntry): Promise<string> {
  const canon = canonicalize(payloadOf(e));
  if (!canon) throw new Error("canonicalize failed");
  return sha256Hex(DOMAIN_SOURCE + canon);
}

export async function computeChainHash(e: ClientEntry, prev: string): Promise<string> {
  return sha256HexMulti(DOMAIN_CHAIN + prev + e.source_hash, seqToBytes(e.seq));
}

export interface ClientChain {
  genesis: string;
  entries: ClientEntry[];
}

export async function newClientChain(): Promise<ClientChain> {
  return { genesis: await genesisHex(), entries: [] };
}

export async function appendClient(
  chain: ClientChain,
  partial: Omit<ClientEntry, "seq" | "source_hash" | "chain_hash" | "timestamp"> & { timestamp?: string }
): Promise<ClientEntry> {
  const entry: ClientEntry = {
    seq: chain.entries.length,
    timestamp: partial.timestamp ?? new Date().toISOString(),
    type: partial.type,
    source: partial.source,
    ...(partial.reason ? { reason: partial.reason } : {}),
    ...(partial.metrics ? { metrics: partial.metrics } : {}),
    ...(partial.state ? { state: partial.state } : {}),
    ...(partial.mode ? { mode: partial.mode } : {}),
    ...(partial.asset ? { asset: partial.asset } : {}),
    ...(partial.meta ? { meta: partial.meta } : {}),
    source_hash: "",
    chain_hash: "",
  };
  entry.source_hash = await computeSourceHash(entry);
  const prev = chain.entries.at(-1)?.chain_hash ?? chain.genesis;
  entry.chain_hash = await computeChainHash(entry, prev);
  chain.entries.push(entry);
  return entry;
}

/** Lightweight client verifier: genesis + source_hash + chain_hash recompute. */
export async function verifyClientChain(chain: ClientChain): Promise<{
  valid: boolean;
  count: number;
  head: string;
}> {
  const genesis = await genesisHex();
  if (chain.genesis !== genesis) return { valid: false, count: 0, head: chain.genesis };
  let prev = genesis;
  for (const e of chain.entries) {
    const sh = await computeSourceHash(e);
    if (sh !== e.source_hash) return { valid: false, count: e.seq, head: prev };
    const ch = await computeChainHash(e, prev);
    if (ch !== e.chain_hash) return { valid: false, count: e.seq, head: prev };
    prev = e.chain_hash;
  }
  return { valid: true, count: chain.entries.length, head: prev };
}

export function shortHash(h: string, n = 12): string {
  return h.slice(0, n);
}
