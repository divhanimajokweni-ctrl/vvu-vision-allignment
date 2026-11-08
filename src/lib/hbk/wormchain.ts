/**
 * WORM (Write-Once-Read-Many) hash-chained evidence log.
 * Ported from hbk-mk2-code worm-nest, rebuilt to use our existing SHA-256.
 * Each event's hash = SHA-256(previousHash || canonical payload).
 * Tamper-evident: any mutation breaks the chain.
 */

import { sha256 } from "@/lib/crypto/mmr";
import type { WORMEvent, VerificationState, TierTag } from "./types";

export interface WORMPayload {
  subject: string;
  source: string;
  tier: TierTag;
  verificationState: VerificationState;
  data: Record<string, unknown>;
  observedAt: string;
}

/**
 * Create a new WORM event chained to the previous one.
 * The hash is SHA-256(prevHash + canonical JSON of the payload).
 */
export function createWORMEvent(
  payload: WORMPayload,
  previousHash: string | null,
): WORMEvent {
  const canonical = canonicalize(payload);
  const hashInput = (previousHash ?? "genesis") + canonical;
  const hash = sha256(hashInput);
  const wormHead = hash;

  return {
    id: `worm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    hash,
    previousHash,
    wormHead,
    subject: payload.subject,
    source: payload.source,
    tier: payload.tier,
    verificationState: payload.verificationState,
    payload: canonical,
    observedAt: payload.observedAt,
  };
}

/**
 * Verify a WORM chain — re-walks from genesis, re-computing every hash.
 * Returns { valid, brokenAt, tamperedEvents }.
 */
export function verifyWORMChain(events: WORMEvent[]): {
  valid: boolean;
  brokenAt: number | null;
  tamperedEvents: string[];
} {
  const tampered: string[] = [];
  let prevHash: string | null = null;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.previousHash !== prevHash) {
      return { valid: false, brokenAt: i, tamperedEvents: tampered };
    }
    const expectedHash = sha256((prevHash ?? "genesis") + ev.payload);
    if (ev.hash !== expectedHash) {
      tampered.push(ev.id);
    }
    prevHash = ev.hash;
  }

  return { valid: tampered.length === 0, brokenAt: null, tamperedEvents: tampered };
}

/**
 * Canonical JSON serialization — deterministic key ordering.
 * Ensures the same payload always produces the same hash.
 */
function canonicalize(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalize).join(",") + "]";
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize((obj as Record<string, unknown>)[k])).join(",") + "}";
}

/**
 * Evidence Integrity Score (EIS) — weighted multi-modal fusion.
 * EIS = w1*pressure_deviation + w2*flow_anomaly + w3*acoustic_threshold
 * Capped at 100, with SCADA ceiling flag.
 */
export function computeEIS(
  pressure_m: number,
  baseline_pressure_m: number,
  flow_lps: number,
  acoustic_db: number,
): { eis: number; w1: number; w2: number; w3: number; scadaCeiling: boolean; modalityCount: number } {
  const w1 = Math.abs(pressure_m - baseline_pressure_m) / baseline_pressure_m;
  const w2 = flow_lps > 200 ? (flow_lps - 200) / 100 : 0;
  const w3 = acoustic_db > 55 ? (acoustic_db - 55) / 10 : 0;
  const raw = w1 * 40 + w2 * 35 + w3 * 25;
  const eis = Math.min(100, Math.round(raw * 10) / 10);
  const scadaCeiling = acoustic_db > 60 || pressure_m < baseline_pressure_m * 0.8;
  const modalityCount = [w1, w2, w3].filter((w) => w > 0).length;
  return { eis, w1: Math.round(w1 * 100) / 100, w2: Math.round(w2 * 100) / 100, w3: Math.round(w3 * 100) / 100, scadaCeiling, modalityCount };
}
