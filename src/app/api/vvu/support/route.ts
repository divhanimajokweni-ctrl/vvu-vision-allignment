import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { appendWormEvent } from '@/lib/vvu-ledger';
import {
  CONTRIBUTION_TYPES,
  FUNDING_FSM,
  MK1_ALLOCATION,
  PAYMENT_METHODS,
  PAYMENT_STATES,
  SUPPORT_HONESTY,
  composeReceipt,
  gatewayReference,
  newContributionId,
  receiptHash,
  receiptId,
  blockId,
  transitionAllowed,
  webhookSignature,
} from '@/lib/support-funding';
import type {
  ContributionType,
  FundingActionResult,
  FundingContributionRow,
  FundingProgress,
  FundingSupportResponse,
  PaymentMethod,
  PaymentState,
} from '@/types/vvu';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// /api/vvu/support — Round 29 SUPPORT & FUNDING endpoint (local reference
// engine of architecture v1.5.2).
//   GET  → progress gauge + contributions ledger + FSM matrix + honesty table.
//   POST → the DFA transitions, one call per σ:
//            { action: 'initiate', ... }   IDLE/none  → INITIATED
//            { action: 'gateway_open', id } INITIATED → PENDING_SETTLEMENT
//            { action: 'settle', id }       PENDING_SETTLEMENT → VERIFIED_SETTLED
//            { action: 'ledger_commit', id } VERIFIED_SETTLED → LEDGER_LOCKED
//            { action: 'receipt', id }      → composed receipt text (no state change)
//         Every transition is WORM-logged (source SUPPORT). Illegal transitions
//         are rejected with 409 — the DFA is server-authoritative.

type Row = {
  id: string;
  contributionId: string;
  contributorName: string;
  contributorEmail: string;
  institutionAffiliation: string;
  contributionType: string;
  amountZar: number;
  allocatedTarget: string;
  paymentMethod: string;
  gatewayReference: string | null;
  sha256ReceiptHash: string | null;
  paymentState: string;
  receiptId: string | null;
  blockId: string | null;
  wormSeq: number | null;
  createdAt: Date;
  updatedAt: Date;
};

function serialize(row: Row): FundingContributionRow {
  return {
    id: row.id,
    contributionId: row.contributionId,
    contributorName: row.contributorName,
    contributorEmail: row.contributorEmail,
    institutionAffiliation: row.institutionAffiliation,
    contributionType: (CONTRIBUTION_TYPES as readonly string[]).includes(row.contributionType)
      ? (row.contributionType as ContributionType)
      : 'PUBLIC_DONATION',
    amountZar: row.amountZar,
    allocatedTarget: row.allocatedTarget,
    paymentMethod: (PAYMENT_METHODS as readonly string[]).includes(row.paymentMethod)
      ? (row.paymentMethod as PaymentMethod)
      : 'PAYFAST',
    gatewayReference: row.gatewayReference,
    sha256ReceiptHash: row.sha256ReceiptHash,
    paymentState: (PAYMENT_STATES as readonly string[]).includes(row.paymentState)
      ? (row.paymentState as PaymentState)
      : 'INITIATED',
    receiptId: row.receiptId,
    blockId: row.blockId,
    wormSeq: row.wormSeq,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function readConfig() {
  // Singleton config row; the PROVISIONAL default is honest (not a quote).
  let row = await db.fundingConfig.findUnique({ where: { id: 'mk1' } });
  if (!row) {
    row = await db.fundingConfig.create({
      data: { id: 'mk1', targetZar: 250000, targetLabel: 'Mk-I Prototype Fabrication & Field Validation' },
    });
  }
  return row;
}

async function buildProgress(): Promise<FundingProgress> {
  const [config, lockedAgg, lockedCount, pendingAgg, pendingCount] = await Promise.all([
    readConfig(),
    db.fundingContribution.aggregate({ where: { paymentState: 'LEDGER_LOCKED' }, _sum: { amountZar: true } }),
    db.fundingContribution.count({ where: { paymentState: 'LEDGER_LOCKED' } }),
    db.fundingContribution.aggregate({
      where: { paymentState: { in: ['INITIATED', 'PENDING_SETTLEMENT', 'VERIFIED_SETTLED'] } },
      _sum: { amountZar: true },
    }),
    db.fundingContribution.count({
      where: { paymentState: { in: ['INITIATED', 'PENDING_SETTLEMENT', 'VERIFIED_SETTLED'] } },
    }),
  ]);
  const lockedTotalZar = lockedAgg._sum.amountZar ?? 0;
  return {
    targetZar: config.targetZar,
    targetLabel: config.targetLabel,
    targetProvisional: true,
    lockedTotalZar,
    lockedCount,
    pendingTotalZar: pendingAgg._sum.amountZar ?? 0,
    pendingCount,
    supporterCount: lockedCount,
    pct: config.targetZar > 0 ? Math.min(100, (lockedTotalZar / config.targetZar) * 100) : 0,
    allocation: MK1_ALLOCATION.map((a) => ({ label: a.label, pct: a.pct })),
  };
}

/** Compose the receipt text for a LEDGER_LOCKED row (hash line filled in). */
function composeReceiptFor(row: Row): string {
  const text = composeReceipt({
    receiptSeq: 0,
    receiptIdOverride: row.receiptId ?? undefined,
    blockIdOverride: row.blockId ?? undefined,
    contributorName: row.contributorName,
    institutionAffiliation: row.institutionAffiliation,
    contributionType: serialize(row).contributionType,
    amountZar: row.amountZar,
    allocatedTarget: row.allocatedTarget,
    paymentMethod: serialize(row).paymentMethod,
    paymentState: row.paymentState,
    createdAt: row.updatedAt,
  });
  return text.replace('<computed-on-commit>', row.sha256ReceiptHash ?? '');
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const [rows, progress] = await Promise.all([
      db.fundingContribution.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      buildProgress(),
    ]);
    const body: FundingSupportResponse = {
      progress,
      contributions: rows.map(serialize),
      fsm: [...FUNDING_FSM],
      honesty: [...SUPPORT_HONESTY],
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}

// ─── POST (DFA transitions) ──────────────────────────────────────────────────

const initiateSchema = z.object({
  action: z.literal('initiate'),
  contributorName: z.string().trim().min(2, 'contributor name required').max(160),
  contributorEmail: z.string().trim().email('valid email required (POPIA receipt delivery)').max(200),
  institutionAffiliation: z.string().trim().max(200).optional(),
  contributionType: z.enum(CONTRIBUTION_TYPES as unknown as [string, ...string[]]),
  amountZar: z.number().positive('amount must be > R0.00').max(10_000_000),
  paymentMethod: z.enum(PAYMENT_METHODS as unknown as [string, ...string[]]),
});

const idSchema = z.object({ action: z.string(), id: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const raw = (await request.json().catch(() => null)) as unknown;

    // σ_init — IDLE → INITIATED
    const init = initiateSchema.safeParse(raw);
    if (init.success) {
      const v = init.data;
      const contributionId = newContributionId();
      const row = await db.fundingContribution.create({
        data: {
          contributionId,
          contributorName: v.contributorName,
          contributorEmail: v.contributorEmail,
          institutionAffiliation: v.institutionAffiliation?.trim() || 'Nelson Mandela University',
          contributionType: v.contributionType,
          amountZar: Math.round(v.amountZar * 100) / 100,
          allocatedTarget: 'Mk-I Prototype Fabrication',
          paymentMethod: v.paymentMethod,
          paymentState: 'INITIATED',
        },
      });
      const entry = await appendWormEvent({
        source: 'SUPPORT',
        event: 'SUPPORT_CONTRIBUTION_INITIATED',
        details: `cid=${contributionId.slice(0, 8)}… · ${v.contributionType} · R${(Math.round(v.amountZar * 100) / 100).toLocaleString('en-ZA')} · ${v.paymentMethod} · σ_init`,
      });
      const saved = await db.fundingContribution.update({
        where: { id: row.id },
        data: { wormSeq: entry.seq },
      });
      const body: FundingActionResult = {
        contribution: serialize(saved),
        transition: 'IDLE → INITIATED (σ_init)',
        wormSeq: entry.seq,
      };
      return NextResponse.json(body, { status: 201 });
    }

    const parsed = idSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'UNKNOWN_ACTION', expected: "POST { action: 'initiate'|'gateway_open'|'settle'|'ledger_commit'|'receipt', id }" },
        { status: 422 },
      );
    }
    const { action, id } = parsed.data;
    const row = await db.fundingContribution.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    const from = serialize(row).paymentState;

    // receipt — no state change, compose + return
    if (action === 'receipt') {
      if (from !== 'LEDGER_LOCKED') {
        return NextResponse.json({ error: 'NOT_LOCKED', note: 'receipt exists only for LEDGER_LOCKED contributions' }, { status: 409 });
      }
      return NextResponse.json({
        contribution: serialize(row),
        transition: 'RECEIPT_COMPOSED',
        wormSeq: row.wormSeq ?? 0,
        receiptText: composeReceiptFor(row),
      });
    }

    const TARGETS: Record<string, PaymentState> = {
      gateway_open: 'PENDING_SETTLEMENT',
      settle: 'VERIFIED_SETTLED',
      ledger_commit: 'LEDGER_LOCKED',
    };
    const target = TARGETS[action];
    if (!target) {
      return NextResponse.json({ error: 'UNKNOWN_ACTION', expected: 'initiate | gateway_open | settle | ledger_commit | receipt' }, { status: 422 });
    }
    if (!transitionAllowed(from, target)) {
      return NextResponse.json(
        { error: 'ILLEGAL_TRANSITION', from, to: target, note: 'DFA is server-authoritative — follow the σ sequence' },
        { status: 409 },
      );
    }

    let details = '';
    let extra: Record<string, string> = {};

    if (action === 'gateway_open') {
      const gwRef = gatewayReference(serialize(row).paymentMethod, row.contributionId);
      extra = { gatewayReference: gwRef };
      details = `cid=${row.contributionId.slice(0, 8)}… · gateway=${gwRef} · σ_gateway_open (LOCAL REFERENCE gateway simulation)`;
    } else if (action === 'settle') {
      const sig = webhookSignature(row.contributionId, row.amountZar);
      details = `cid=${row.contributionId.slice(0, 8)}… · webhook sig=${sig.slice(0, 16)}… verified (HMAC-SHA256, LOCAL REFERENCE) · σ_settled`;
    } else if (action === 'ledger_commit') {
      const lockedRows = await db.fundingContribution.findMany({
        where: { paymentState: 'LEDGER_LOCKED' },
        orderBy: { updatedAt: 'asc' },
      });
      const seq = lockedRows.length + 1;
      const rid = receiptId(seq);
      const bid = blockId(new Date(), seq);
      // Canonical rule (verifiable by any third party): the receipt hash is
      // SHA-256 over the receipt text with the literal placeholder
      // `<computed-on-commit>` still in the hash line. The displayed receipt
      // substitutes the stored hash; substituting the marker back reproduces
      // the hashed text exactly.
      const text = composeReceipt({
        receiptSeq: seq,
        receiptIdOverride: rid,
        blockIdOverride: bid,
        contributorName: row.contributorName,
        institutionAffiliation: row.institutionAffiliation,
        contributionType: serialize(row).contributionType,
        amountZar: row.amountZar,
        allocatedTarget: row.allocatedTarget,
        paymentMethod: serialize(row).paymentMethod,
        paymentState: 'LEDGER_LOCKED',
        createdAt: new Date(),
      });
      const hash = receiptHash(text);
      extra = { sha256ReceiptHash: hash, receiptId: rid, blockId: bid };
      details = `cid=${row.contributionId.slice(0, 8)}… · receipt=${rid} · block=${bid} · sha256=${hash.slice(0, 16)}… · σ_ledger_commit · CONTRIBUTION_COMPLETE`;
    }

    const updated = await db.fundingContribution.update({ where: { id }, data: { paymentState: target, ...extra } });
    const entry = await appendWormEvent({
      source: 'SUPPORT',
      event: `SUPPORT_${action.toUpperCase()}`,
      details,
    });
    const saved = await db.fundingContribution.update({ where: { id }, data: { wormSeq: entry.seq } });
    void updated;

    const body: FundingActionResult = {
      contribution: serialize(saved),
      transition: `${from} → ${target}`,
      wormSeq: entry.seq,
      receiptText: action === 'ledger_commit' ? composeReceiptFor(saved) : undefined,
    };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
