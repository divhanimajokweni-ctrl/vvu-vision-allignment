// src/lib/support-funding.ts — Round 29 · SUPPORT & FUNDING endpoint (pure
// module). Implements the VVU PUBLIC SUPPORT & INSTITUTIONAL FUNDING ENDPOINT
// ARCHITECTURE v1.5.2 (2026-09-01, design freeze Level 1) as a LOCAL REFERENCE
// ENGINE on the validation dashboard.
//
// What is REAL here: the 5-state DFA transitions (server-authoritative, only
// legal σ transitions accepted), SHA-256 receipt hashing over the canonical
// receipt, UUIDv4 contribution IDs, the SQLite-backed ledger rows and the WORM
// events on every transition.
//
// What is DESIGN (production spec, NOT running here): the GitHub Pages static
// front-end, the wss:// WebSocket corridor, the multi-tenant PostgreSQL + RLS
// schema, and the real payment gateways (PayFast / EFT / crypto webhooks). The
// "gateway" step in this engine is an operator-advanced local simulation —
// labelled as such everywhere it appears.

import { createHash, createHmac, randomUUID } from 'crypto';
import type {
  ContributionType,
  FundingContributionRow,
  FundingFsmState,
  PaymentMethod,
  PaymentState,
} from '@/types/vvu';

// ─── vocabularies (mirror the production enums exactly) ─────────────────────

export const CONTRIBUTION_TYPES: readonly ContributionType[] = [
  'ACADEMIC_GRANT',
  'INSTITUTIONAL_SPONSOR',
  'ALUMNI_CONTRIBUTION',
  'PUBLIC_DONATION',
];

export const CONTRIBUTION_TYPE_LABELS: Record<ContributionType, string> = {
  ACADEMIC_GRANT: 'Academic grant',
  INSTITUTIONAL_SPONSOR: 'Institutional sponsor',
  ALUMNI_CONTRIBUTION: 'Alumni contribution',
  PUBLIC_DONATION: 'Public donation',
};

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['PAYFAST', 'EFT_DIRECT', 'CRYPTO'];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  PAYFAST: 'PayFast',
  EFT_DIRECT: 'Direct EFT reference',
  CRYPTO: 'Crypto address',
};

export const PAYMENT_STATES: readonly PaymentState[] = [
  'INITIATED',
  'PENDING_SETTLEMENT',
  'VERIFIED_SETTLED',
  'LEDGER_LOCKED',
  'FAILED',
];

// ─── the 5-state DFA (§3 of the architecture doc) ────────────────────────────

export const FUNDING_FSM: readonly FundingFsmState[] = [
  { stateId: 0, name: 'IDLE', trigger: 'Client WebSocket connect', actions: 'Emits current Mk-I funding progress (current_total_zar, target_zar, supporter_count).' },
  { stateId: 1, name: 'INITIATED', trigger: '\u03c3_init (supporter selects tier & gateway)', actions: 'Generates unique contribution_id (UUIDv4); logs initial intent to store.' },
  { stateId: 2, name: 'PENDING_SETTLEMENT', trigger: '\u03c3_gateway_open (system issues gateway token & payload)', actions: 'Opens gateway flow (PayFast, Zapper, direct EFT reference, or crypto address).' },
  { stateId: 3, name: 'VERIFIED_SETTLED', trigger: '\u03c3_settled (verified gateway webhook callback)', actions: 'Receives cryptographically signed webhook; verifies signature match.' },
  { stateId: 4, name: 'LEDGER_LOCKED', trigger: '\u03c3_ledger_commit (HMAC-SHA256 generated & committed)', actions: 'Atomic INSERT into funding_contributions; emits CONTRIBUTION_COMPLETE; generates the receipt.' },
];

/** Legal DFA transitions: from-state → allowed to-states. */
export const FSM_TRANSITIONS: Readonly<Record<PaymentState, readonly PaymentState[]>> = {
  INITIATED: ['PENDING_SETTLEMENT', 'FAILED'],
  PENDING_SETTLEMENT: ['VERIFIED_SETTLED', 'FAILED'],
  VERIFIED_SETTLED: ['LEDGER_LOCKED'],
  LEDGER_LOCKED: [], // terminal — immutable once locked
  FAILED: [], // terminal
};

export function transitionAllowed(from: PaymentState, to: PaymentState): boolean {
  return FSM_TRANSITIONS[from].includes(to);
}

// ─── Mk-I allocation breakdown (§5 of the architecture doc) ─────────────────

export const MK1_ALLOCATION: ReadonlyArray<{ label: string; pct: number }> = [
  { label: 'AMD Kria K26 SoM Edge-AI Compute Hardware', pct: 35 },
  { label: 'TI PCM1864-Q1 High-Precision Acoustic ADCs', pct: 25 },
  { label: 'IP68 Sealed Enclosure & Battery Power Core', pct: 25 },
  { label: 'Field Calibration & Humewood Beachfront Test', pct: 15 },
];

// ─── gateway reference + webhook signature (LOCAL REFERENCE) ─────────────────

/** Deterministic gateway reference, e.g. PF-9F3A21 · issued at σ_gateway_open. */
export function gatewayReference(method: PaymentMethod, contributionId: string): string {
  const prefix =
    method === 'PAYFAST' ? 'PF' : method === 'EFT_DIRECT' ? 'EFT' : method === 'CRYPTO' ? 'CRY' : 'GW';
  const digest = createHash('sha256').update(contributionId).digest('hex').slice(0, 6).toUpperCase();
  return `${prefix}-${digest}`;
}

/**
 * LOCAL REFERENCE webhook signature: HMAC-SHA256 over the settle payload with a
 * locally-derived key. In production this is the real gateway's signed webhook
 * (verified against the gateway secret); here it demonstrates the signature
 * verification step the FSM requires at σ_settled — labelled, never faked as a
 * real gateway callback.
 */
export const LOCAL_REF_KEY_SEED = 'VVU-SUPPORT-LOCAL-REFERENCE-v1.5.2';

export function webhookSignature(contributionId: string, amountZar: number): string {
  const key = createHash('sha256').update(LOCAL_REF_KEY_SEED).digest();
  return createHmac('sha256', key).update(`${contributionId}|${amountZar.toFixed(2)}`).digest('hex');
}

// ─── receipt composer (§5 — SANS-style institutional R&D funding receipt) ────

export type ReceiptContribution = {
  receiptSeq: number; // 1-based locked-order sequence
  /** optional direct override (used when re-composing a stored row) */
  receiptIdOverride?: string;
  blockIdOverride?: string;
  contributorName: string;
  institutionAffiliation: string;
  contributionType: ContributionType;
  amountZar: number;
  allocatedTarget: string;
  paymentMethod: PaymentMethod;
  paymentState: string;
  createdAt: Date;
};

/** Canonical receipt text — SHA-256 over exactly this string is the receipt hash. */
export function composeReceipt(c: ReceiptContribution): string {
  const lines: string[] = [
    '='.repeat(80),
    'VENTURE VISION UBUNTU (VVU) - INSTITUTIONAL R&D FUNDING RECEIPT',
    '='.repeat(80),
    `RECEIPT ID        : ${c.receiptIdOverride ?? receiptId(c.receiptSeq)}`,
    `DATE OF ISSUANCE  : ${isoDay(c.createdAt)}`,
    `SPONSOR           : ${c.contributorName} / ${c.institutionAffiliation}`,
    `TARGET ALLOCATION : ${c.allocatedTarget}`,
    `PAYMENT STATUS    : ${c.paymentState === 'LEDGER_LOCKED' ? 'VERIFIED & SETTLED (LEDGER LOCKED)' : c.paymentState}`,
    '-'.repeat(80),
    'FUNDS ALLOCATION BREAKDOWN:',
  ];
  MK1_ALLOCATION.forEach((a, i) => {
    lines.push(`  ${i + 1}. ${a.label.padEnd(46, ' ')}: ${a.pct.toFixed(1)}%`);
  });
  lines.push(
    '-'.repeat(80),
    `CONTRIBUTION      : ${c.contributionType} · ${c.paymentMethod}`,
    `AMOUNT            : R ${c.amountZar.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    '-' .repeat(80),
    'CRYPTOGRAPHIC PROVENANCE:',
    `  SHA-256 RECEIPT HASH: <computed-on-commit>`,
    `  LEDGER BLOCK ID     : ${c.blockIdOverride ?? blockId(c.createdAt, c.receiptSeq)}`,
    `  WORM CHAIN          : VVU append-only ledger · source SUPPORT`,
    `  ENGINE              : LOCAL REFERENCE (validation dashboard) · production stack per v1.5.2 DESIGN`,
    '='.repeat(80),
  );
  return lines.join('\n');
}

export function receiptId(seq: number): string {
  const year = new Date().getFullYear();
  return `MK1-${year}-${String(seq).padStart(3, '0')}`;
}

export function blockId(at: Date, seq: number): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, '0');
  const d = String(at.getDate()).padStart(2, '0');
  return `BLK-${y}${m}${d}-MK1-${String(seq).padStart(3, '0')}`;
}

export function isoDay(at: Date): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, '0');
  const d = String(at.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Receipt hash = SHA-256 over the canonical receipt text with the hash line
 * itself normalised to the placeholder (the doc's sha256_receipt_hash column). */
export function receiptHash(receiptText: string): string {
  return createHash('sha256').update(receiptText).digest('hex');
}

export function newContributionId(): string {
  return randomUUID();
}

// ─── honesty ledger (REAL / DESIGN / LOCAL_REF — never blurred) ──────────────

export const SUPPORT_HONESTY: ReadonlyArray<{ layer: string; status: 'REAL' | 'DESIGN' | 'LOCAL_REF'; note: string }> = [
  { layer: '5-state DFA payment engine', status: 'REAL', note: 'Server-authoritative transitions; illegal σ jumps are rejected with 409.' },
  { layer: 'SHA-256 receipt hash + receipt composer', status: 'REAL', note: 'Hash computed server-side over the canonical receipt text at σ_ledger_commit.' },
  { layer: 'Contribution ledger rows (SQLite)', status: 'REAL', note: 'funding_contributions mirror table; LEDGER_LOCKED rows are immutable (no legal outgoing transition).' },
  { layer: 'WORM events on every transition', status: 'REAL', note: 'source SUPPORT · append-only hash chain, same ledger as the rest of the estate.' },
  { layer: 'Gateway webhook (PayFast / EFT / crypto)', status: 'LOCAL_REF', note: 'Operator-advanced simulation with HMAC-SHA256 signature demonstration — no real gateway keys exist.' },
  { layer: 'GitHub Pages static front-end', status: 'DESIGN', note: 'Per v1.5.2 §6 — deploy path support.venturevisionubuntu.co.za (domain not yet registered).' },
  { layer: 'WSS corridor (wss://api.venturevisionubuntu.co.za/v1/support/ws)', status: 'DESIGN', note: 'Production WebSocket event corridor per §2.' },
  { layer: 'Multi-tenant PostgreSQL + RLS', status: 'DESIGN', note: 'Production schema vvu-pis-db-schema-20260901.sql with tenant isolation policy.' },
  { layer: 'Mk-I funding target amount', status: 'LOCAL_REF', note: 'PROVISIONAL operator-editable target — not a supplier quote; only locked contributions count.' },
];
