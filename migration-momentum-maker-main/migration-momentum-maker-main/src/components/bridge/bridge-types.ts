// src/components/bridge/bridge-types.ts — shared contracts for the device
// rails (#/bridge vault bridge and #/field field onboard). Mirrors the source
// mini-service payloads so the feeds keep the same event shapes.

export interface BridgeStatus {
  ok: boolean;
  agentOnline: boolean;
  agent: { deviceId: string; name: string; lastSeenAgoMs: number } | null;
  pairedDevices: number;
  viewerCount: number;
  pairing: { active: boolean };
  receipts: { count: number; root: string; verified: boolean };
}

export interface FieldStatus extends BridgeStatus {
  node: string;
  protocol: string;
}

export interface Receipt {
  seq: number;
  ts: string;
  actor: string;
  op: string;
  target: string;
  ok: boolean;
  sha256: string;
  prevHash: string;
  hash: string;
}

export interface VaultResult {
  commandId: string | null;
  op: "list" | "read" | "search" | "write" | string;
  ok: boolean;
  data?: unknown;
  error?: string;
  elapsedMs?: number;
  receipt?: Receipt;
}

export interface SearchResult {
  path: string;
  line: number;
  snippet: string;
}

export interface PairInit {
  pairingId: string;
  token: string;
  qrPayload: string;
  qrDataUrl: string;
  expiresAt: string;
  /** Field rail extras (nonce bootstrap window, node identity). */
  qrExpiresAt?: string;
  nonce?: string;
  node?: string;
  protocol?: string;
  qrJson?: { endpoint: string; nonce: string; expiry: number; node: string; protocol: string };
}
