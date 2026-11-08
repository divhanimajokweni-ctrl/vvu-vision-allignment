// src/lib/proofbridge/receiptProjection.ts
// Pure projection: receipt chain → HUD rows (Task 39). This is the ONLY
// place rows are built — components render, they never assemble. The React
// key is the receipt hash: unique by construction, stable, tamper-evident —
// a duplicate key is impossible without breaking SHA-256.

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
  tier?: 'anon' | 'paying' | 'enterprise';
  anchor?: { anchored: boolean; txRef?: string; proof?: string; reason?: string };
}

export interface HudRow {
  receiptHash: string; // THE key — unique by construction
  seq: number;
  severity: number; // 0–5, drives color
  label: string;
  detail: string;
  ts: string;
  ok: boolean;
  tier: string;
}

const SEVERITY_BY_OP: Record<string, number> = {
  pair: 1,
  auth: 1,
  list: 0,
  read: 0,
  search: 0,
  write: 2,
  events: 3,
  result: 2,
};

export function projectReceiptToRow(r: Receipt): HudRow {
  const sev = r.ok ? (SEVERITY_BY_OP[r.op] ?? 1) : 5;
  return {
    receiptHash: r.hash,
    seq: r.seq,
    severity: sev,
    label: r.op.toUpperCase(),
    detail: r.ok ? r.target : `FAIL · ${r.target}`,
    ts: r.ts,
    ok: r.ok,
    tier: r.tier ?? 'anon',
  };
}

export function projectReceipts(receipts: Receipt[]): HudRow[] {
  // dedupe by hash defensively — a hash SHOULD be unique; this makes it so
  // even if a caller double-appends the same receipt.
  const seen = new Set<string>();
  const out: HudRow[] = [];
  for (const r of receipts) {
    if (seen.has(r.hash)) continue;
    seen.add(r.hash);
    out.push(projectReceiptToRow(r));
  }
  return out;
}
