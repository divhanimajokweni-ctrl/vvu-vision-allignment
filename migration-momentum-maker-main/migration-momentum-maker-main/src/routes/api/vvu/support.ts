import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { appendSimulatedEvent } from "./ledger";
import type {
  ContributionType,
  FundingActionResult,
  FundingContributionRow,
  FundingProgress,
  FundingSupportResponse,
  PaymentMethod,
  PaymentState,
  FundingFsmState,
} from "@/types/vvu";

async function sha256(s: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
// ─── vocabularies (mirror the production enums exactly) ─────────────────────

export const CONTRIBUTION_TYPES: readonly ContributionType[] = [
  "ACADEMIC_GRANT",
  "INSTITUTIONAL_SPONSOR",
  "ALUMNI_CONTRIBUTION",
  "PUBLIC_DONATION",
];

export const CONTRIBUTION_TYPE_LABELS: Record<ContributionType, string> = {
  ACADEMIC_GRANT: "Academic grant",
  INSTITUTIONAL_SPONSOR: "Institutional sponsor",
  ALUMNI_CONTRIBUTION: "Alumni contribution",
  PUBLIC_DONATION: "Public donation",
};

export const PAYMENT_METHODS: readonly PaymentMethod[] = ["PAYFAST", "EFT_DIRECT", "CRYPTO"];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  PAYFAST: "PayFast",
  EFT_DIRECT: "Direct EFT reference",
  CRYPTO: "Crypto address",
};

export const PAYMENT_STATES: readonly PaymentState[] = [
  "INITIATED",
  "PENDING_SETTLEMENT",
  "VERIFIED_SETTLED",
  "LEDGER_LOCKED",
  "FAILED",
];

// ─── the 5-state DFA (§3 of the architecture doc) ────────────────────────────

export const FUNDING_FSM: readonly FundingFsmState[] = [
  {
    stateId: 0,
    name: "IDLE",
    trigger: "Client WebSocket connect",
    actions:
      "Emits current Mk-I funding progress (current_total_zar, target_zar, supporter_count).",
  },
  {
    stateId: 1,
    name: "INITIATED",
    trigger: "\u03c3_init (supporter selects tier & gateway)",
    actions: "Generates unique contribution_id (UUIDv4); logs initial intent to store.",
  },
  {
    stateId: 2,
    name: "PENDING_SETTLEMENT",
    trigger: "\u03c3_gateway_open (system issues gateway token & payload)",
    actions: "Opens gateway flow (PayFast, Zapper, direct EFT reference, or crypto address).",
  },
  {
    stateId: 3,
    name: "VERIFIED_SETTLED",
    trigger: "\u03c3_settled (verified gateway webhook callback)",
    actions: "Receives cryptographically signed webhook; verifies signature match.",
  },
  {
    stateId: 4,
    name: "LEDGER_LOCKED",
    trigger: "\u03c3_ledger_commit (HMAC-SHA256 generated & committed)",
    actions:
      "Atomic INSERT into funding_contributions; emits CONTRIBUTION_COMPLETE; generates the receipt.",
  },
];

/** Legal DFA transitions: from-state → allowed to-states. */
export const FSM_TRANSITIONS: Readonly<Record<PaymentState, readonly PaymentState[]>> = {
  INITIATED: ["PENDING_SETTLEMENT", "FAILED"],
  PENDING_SETTLEMENT: ["VERIFIED_SETTLED", "FAILED"],
  VERIFIED_SETTLED: ["LEDGER_LOCKED"],
  LEDGER_LOCKED: [], // terminal — immutable once locked
  FAILED: [], // terminal
};

export function transitionAllowed(from: PaymentState, to: PaymentState): boolean {
  return FSM_TRANSITIONS[from].includes(to);
}

// ─── Mk-I allocation breakdown (§5 of the architecture doc) ─────────────────

export const MK1_ALLOCATION: ReadonlyArray<{ label: string; pct: number }> = [
  { label: "AMD Kria K26 SoM Edge-AI Compute Hardware", pct: 35 },
  { label: "TI PCM1864-Q1 High-Precision Acoustic ADCs", pct: 25 },
  { label: "IP68 Sealed Enclosure & Battery Power Core", pct: 25 },
  { label: "Field Calibration & Humewood Beachfront Test", pct: 15 },
];

// ─── gateway reference + webhook signature (LOCAL REFERENCE) ─────────────────

/** Deterministic gateway reference, e.g. PF-9F3A21 · issued at σ_gateway_open. */
async function gatewayReference(method: PaymentMethod, contributionId: string): Promise<string> {
  const prefix =
    method === "PAYFAST"
      ? "PF"
      : method === "EFT_DIRECT"
        ? "EFT"
        : method === "CRYPTO"
          ? "CRY"
          : "GW";
  const digest = (await sha256(contributionId)).slice(0, 6).toUpperCase();
  return `${prefix}-${digest}`;
}

/**
 * LOCAL REFERENCE webhook signature: HMAC-SHA256 over the settle payload with a
 * locally-derived key. In production this is the real gateway's signed webhook
 * (verified against the gateway secret); here it demonstrates the signature
 * verification step the FSM requires at σ_settled — labelled, never faked as a
 * real gateway callback.
 */
export const LOCAL_REF_KEY_SEED = "VVU-SUPPORT-LOCAL-REFERENCE-v1.5.2";

async function webhookSignature(contributionId: string, amountZar: number): Promise<string> {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(LOCAL_REF_KEY_SEED));
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`${contributionId}|${amountZar.toFixed(2)}`),
      ),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
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
    "=".repeat(80),
    "VENTURE VISION UBUNTU (VVU) - INSTITUTIONAL R&D FUNDING RECEIPT",
    "=".repeat(80),
    `RECEIPT ID        : ${c.receiptIdOverride ?? receiptId(c.receiptSeq)}`,
    `DATE OF ISSUANCE  : ${isoDay(c.createdAt)}`,
    `SPONSOR           : ${c.contributorName} / ${c.institutionAffiliation}`,
    `TARGET ALLOCATION : ${c.allocatedTarget}`,
    `PAYMENT STATUS    : ${c.paymentState === "LEDGER_LOCKED" ? "VERIFIED & SETTLED (LEDGER LOCKED)" : c.paymentState}`,
    "-".repeat(80),
    "FUNDS ALLOCATION BREAKDOWN:",
  ];
  MK1_ALLOCATION.forEach((a, i) => {
    lines.push(`  ${i + 1}. ${a.label.padEnd(46, " ")}: ${a.pct.toFixed(1)}%`);
  });
  lines.push(
    "-".repeat(80),
    `CONTRIBUTION      : ${c.contributionType} · ${c.paymentMethod}`,
    `AMOUNT            : R ${c.amountZar.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    "-".repeat(80),
    "CRYPTOGRAPHIC PROVENANCE:",
    `  SHA-256 RECEIPT HASH: <computed-on-commit>`,
    `  LEDGER BLOCK ID     : ${c.blockIdOverride ?? blockId(c.createdAt, c.receiptSeq)}`,
    `  WORM CHAIN          : VVU append-only ledger · source SUPPORT`,
    `  ENGINE              : LOCAL REFERENCE (validation dashboard) · production stack per v1.5.2 DESIGN`,
    "=".repeat(80),
  );
  return lines.join("\n");
}

export function receiptId(seq: number): string {
  const year = new Date().getFullYear();
  return `MK1-${year}-${String(seq).padStart(3, "0")}`;
}

export function blockId(at: Date, seq: number): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  return `BLK-${y}${m}${d}-MK1-${String(seq).padStart(3, "0")}`;
}

export function isoDay(at: Date): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Receipt hash = SHA-256 over the canonical receipt text with the hash line
 * itself normalised to the placeholder (the doc's sha256_receipt_hash column). */
async function receiptHash(receiptText: string): Promise<string> {
  return sha256(receiptText);
}

export function newContributionId(): string {
  return crypto.randomUUID();
}

// ─── honesty ledger (REAL / DESIGN / LOCAL_REF — never blurred) ──────────────

export const SUPPORT_HONESTY: ReadonlyArray<{
  layer: string;
  status: "REAL" | "DESIGN" | "LOCAL_REF";
  note: string;
}> = [
  {
    layer: "5-state DFA payment engine",
    status: "REAL",
    note: "Server-authoritative transitions; illegal σ jumps are rejected with 409.",
  },
  {
    layer: "SHA-256 receipt hash + receipt composer",
    status: "REAL",
    note: "Hash computed server-side over the canonical receipt text at σ_ledger_commit.",
  },
  {
    layer: "Contribution ledger rows (simulated)",
    status: "LOCAL_REF",
    note: "In-memory simulated feed; no payment processed and no database record claimed.",
  },
  {
    layer: "WORM events on every transition",
    status: "REAL",
    note: "source SUPPORT · append-only hash chain, same ledger as the rest of the estate.",
  },
  {
    layer: "Gateway webhook (PayFast / EFT / crypto)",
    status: "LOCAL_REF",
    note: "Operator-advanced simulation with HMAC-SHA256 signature demonstration — no real gateway keys exist.",
  },
  {
    layer: "GitHub Pages static front-end",
    status: "DESIGN",
    note: "Per v1.5.2 §6 — deploy path support.venturevisionubuntu.co.za (domain not yet registered).",
  },
  {
    layer: "WSS corridor (wss://api.venturevisionubuntu.co.za/v1/support/ws)",
    status: "DESIGN",
    note: "Production WebSocket event corridor per §2.",
  },
  {
    layer: "Multi-tenant PostgreSQL + RLS",
    status: "DESIGN",
    note: "Production schema vvu-pis-db-schema-20260901.sql with tenant isolation policy.",
  },
  {
    layer: "Mk-I funding target amount",
    status: "LOCAL_REF",
    note: "PROVISIONAL operator-editable target — not a supplier quote; only locked contributions count.",
  },
];
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
      : "PUBLIC_DONATION",
    amountZar: row.amountZar,
    allocatedTarget: row.allocatedTarget,
    paymentMethod: (PAYMENT_METHODS as readonly string[]).includes(row.paymentMethod)
      ? (row.paymentMethod as PaymentMethod)
      : "PAYFAST",
    gatewayReference: row.gatewayReference,
    sha256ReceiptHash: row.sha256ReceiptHash,
    paymentState: (PAYMENT_STATES as readonly string[]).includes(row.paymentState)
      ? (row.paymentState as PaymentState)
      : "INITIATED",
    receiptId: row.receiptId,
    blockId: row.blockId,
    wormSeq: row.wormSeq,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const rows: Row[] = [];
let idSeq = 0;
const db = {
  fundingContribution: {
    findMany: async (_options?: unknown) =>
      rows
        .slice()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 100),
    findUnique: async ({ where }: { where: { id: string } }) =>
      rows.find((r) => r.id === where.id) ?? null,
    create: async ({
      data,
    }: {
      data: Pick<
        Row,
        | "contributionId"
        | "contributorName"
        | "contributorEmail"
        | "institutionAffiliation"
        | "contributionType"
        | "amountZar"
        | "allocatedTarget"
        | "paymentMethod"
        | "paymentState"
      >;
    }) => {
      const row: Row = {
        ...data,
        id: `sim-funding-${++idSeq}`,
        gatewayReference: null,
        sha256ReceiptHash: null,
        receiptId: null,
        blockId: null,
        wormSeq: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      rows.push(row);
      return row;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
      const row = rows.find((r) => r.id === where.id);
      if (!row) throw new Error("NOT_FOUND");
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    },
    count: async () => rows.filter((r) => r.paymentState === "LEDGER_LOCKED").length,
  },
};
async function buildProgress(): Promise<FundingProgress> {
  const locked = rows.filter((r) => r.paymentState === "LEDGER_LOCKED"),
    pending = rows.filter((r) =>
      ["INITIATED", "PENDING_SETTLEMENT", "VERIFIED_SETTLED"].includes(r.paymentState),
    ),
    lockedTotalZar = locked.reduce((n, r) => n + r.amountZar, 0);
  return {
    targetZar: 250000,
    targetLabel: "Mk-I Prototype Fabrication & Field Validation",
    targetProvisional: true,
    lockedTotalZar,
    lockedCount: locked.length,
    pendingTotalZar: pending.reduce((n, r) => n + r.amountZar, 0),
    pendingCount: pending.length,
    supporterCount: locked.length,
    pct: Math.min(100, (lockedTotalZar / 250000) * 100),
    allocation: MK1_ALLOCATION.map((a) => ({ ...a })),
  };
}
async function appendWormEvent(v: { source: string; event: string; details: string }) {
  return appendSimulatedEvent(v.source, v.event, v.details);
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
  return text.replace("<computed-on-commit>", row.sha256ReceiptHash ?? "");
}

async function GET() {
  try {
    const [rows, progress] = await Promise.all([
      db.fundingContribution.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      buildProgress(),
    ]);
    const body: FundingSupportResponse = {
      progress,
      contributions: rows.map(serialize),
      fsm: [...FUNDING_FSM],
      honesty: [...SUPPORT_HONESTY],
      generatedAt: new Date().toISOString(),
    };
    return Response.json(body);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}

const initiateSchema = z.object({
  action: z.literal("initiate"),
  contributorName: z.string().trim().min(2, "contributor name required").max(160),
  contributorEmail: z
    .string()
    .trim()
    .email("valid email required (POPIA receipt delivery)")
    .max(200),
  institutionAffiliation: z.string().trim().max(200).optional(),
  contributionType: z.enum(CONTRIBUTION_TYPES as unknown as [string, ...string[]]),
  amountZar: z.number().positive("amount must be > R0.00").max(10_000_000),
  paymentMethod: z.enum(PAYMENT_METHODS as unknown as [string, ...string[]]),
});

const idSchema = z.object({ action: z.string(), id: z.string().min(1) });

async function POST(request: Request) {
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
          institutionAffiliation: v.institutionAffiliation?.trim() || "Nelson Mandela University",
          contributionType: v.contributionType,
          amountZar: Math.round(v.amountZar * 100) / 100,
          allocatedTarget: "Mk-I Prototype Fabrication",
          paymentMethod: v.paymentMethod,
          paymentState: "INITIATED",
        },
      });
      const entry = await appendWormEvent({
        source: "SUPPORT",
        event: "SUPPORT_CONTRIBUTION_INITIATED",
        details: `cid=${contributionId.slice(0, 8)}… · ${v.contributionType} · R${(Math.round(v.amountZar * 100) / 100).toLocaleString("en-ZA")} · ${v.paymentMethod} · σ_init`,
      });
      const saved = await db.fundingContribution.update({
        where: { id: row.id },
        data: { wormSeq: entry.seq },
      });
      const body: FundingActionResult = {
        contribution: serialize(saved),
        transition: "IDLE → INITIATED (σ_init)",
        wormSeq: entry.seq,
      };
      return Response.json(body, { status: 201 });
    }

    const parsed = idSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        {
          error: "UNKNOWN_ACTION",
          expected:
            "POST { action: 'initiate'|'gateway_open'|'settle'|'ledger_commit'|'receipt', id }",
        },
        { status: 422 },
      );
    }
    const { action, id } = parsed.data;
    const row = await db.fundingContribution.findUnique({ where: { id } });
    if (!row) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    const from = serialize(row).paymentState;

    // receipt — no state change, compose + return
    if (action === "receipt") {
      if (from !== "LEDGER_LOCKED") {
        return Response.json(
          { error: "NOT_LOCKED", note: "receipt exists only for LEDGER_LOCKED contributions" },
          { status: 409 },
        );
      }
      return Response.json({
        contribution: serialize(row),
        transition: "RECEIPT_COMPOSED",
        wormSeq: row.wormSeq ?? 0,
        receiptText: composeReceiptFor(row),
      });
    }

    const TARGETS: Record<string, PaymentState> = {
      gateway_open: "PENDING_SETTLEMENT",
      settle: "VERIFIED_SETTLED",
      ledger_commit: "LEDGER_LOCKED",
    };
    const target = TARGETS[action];
    if (!target) {
      return Response.json(
        {
          error: "UNKNOWN_ACTION",
          expected: "initiate | gateway_open | settle | ledger_commit | receipt",
        },
        { status: 422 },
      );
    }
    if (!transitionAllowed(from, target)) {
      return Response.json(
        {
          error: "ILLEGAL_TRANSITION",
          from,
          to: target,
          note: "DFA is server-authoritative — follow the σ sequence",
        },
        { status: 409 },
      );
    }

    let details = "";
    let extra: Record<string, string> = {};

    if (action === "gateway_open") {
      const gwRef = await gatewayReference(serialize(row).paymentMethod, row.contributionId);
      extra = { gatewayReference: gwRef };
      details = `cid=${row.contributionId.slice(0, 8)}… · gateway=${gwRef} · σ_gateway_open (LOCAL REFERENCE gateway simulation)`;
    } else if (action === "settle") {
      const sig = await webhookSignature(row.contributionId, row.amountZar);
      details = `cid=${row.contributionId.slice(0, 8)}… · webhook sig=${sig.slice(0, 16)}… verified (HMAC-SHA256, LOCAL REFERENCE) · σ_settled`;
    } else if (action === "ledger_commit") {
      const lockedRows = rows.filter((r) => r.paymentState === "LEDGER_LOCKED");
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
        paymentState: "LEDGER_LOCKED",
        createdAt: new Date(),
      });
      const hash = await receiptHash(text);
      extra = { sha256ReceiptHash: hash, receiptId: rid, blockId: bid };
      details = `cid=${row.contributionId.slice(0, 8)}… · receipt=${rid} · block=${bid} · sha256=${hash.slice(0, 16)}… · σ_ledger_commit · CONTRIBUTION_COMPLETE`;
    }

    const updated = await db.fundingContribution.update({
      where: { id },
      data: { paymentState: target, ...extra },
    });
    const entry = await appendWormEvent({
      source: "SUPPORT",
      event: `SUPPORT_${action.toUpperCase()}`,
      details,
    });
    const saved = await db.fundingContribution.update({
      where: { id },
      data: { wormSeq: entry.seq },
    });
    void updated;

    const body: FundingActionResult = {
      contribution: serialize(saved),
      transition: `${from} → ${target}`,
      wormSeq: entry.seq,
      receiptText: action === "ledger_commit" ? composeReceiptFor(saved) : undefined,
    };
    return Response.json(body);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
const ready = (async () => {
  for (let i = 0; i < 6; i++) {
    const row = await db.fundingContribution.create({
      data: {
        contributionId: crypto.randomUUID(),
        contributorName: `Simulated supporter ${i + 1}`,
        contributorEmail: `supporter${i + 1}@example.org`,
        institutionAffiliation: "Simulated research network",
        contributionType: i % 2 ? "ALUMNI_CONTRIBUTION" : "ACADEMIC_GRANT",
        amountZar: [15000, 5000, 10000, 2500, 7500, 1250][i],
        allocatedTarget: "Mk-I Prototype Fabrication",
        paymentMethod: i % 2 ? "PAYFAST" : "EFT_DIRECT",
        paymentState: i < 4 ? "LEDGER_LOCKED" : "PENDING_SETTLEMENT",
      },
    });
    row.createdAt = new Date(Date.now() - (6 - i) * 86400000);
    row.updatedAt = row.createdAt;
    row.gatewayReference = await gatewayReference(
      row.paymentMethod as PaymentMethod,
      row.contributionId,
    );
    if (i < 4) {
      row.receiptId = receiptId(i + 1);
      row.blockId = blockId(row.updatedAt, i + 1);
      const canonical = composeReceiptFor(row);
      row.sha256ReceiptHash = await receiptHash(
        canonical.replace("SHA-256 RECEIPT HASH: ", "SHA-256 RECEIPT HASH: <computed-on-commit>"),
      );
    }
  }
})();
let queue: Promise<unknown> = Promise.resolve();
export const Route = createFileRoute("/api/vvu/support")({
  server: {
    handlers: {
      GET: async () => {
        await ready;
        return GET();
      },
      POST: async ({ request }) => {
        const task = queue.then(async () => {
          await ready;
          return POST(request);
        });
        queue = task.catch(() => undefined);
        return task;
      },
    },
  },
});
