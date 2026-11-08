import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { appendSimulatedEvent } from "../ledger";

const CAPTURE_SCHEMA = "vvu.card-capture.v1";
const CARD_GENESIS_HASH = "CARD-GENESIS-20260930-00000000000000000000000000";
async function sha256(s: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export type CardCaptureKind = "CONTACT" | "NOTE" | "REFERRAL";

const CAPTURE_KINDS: readonly CardCaptureKind[] = ["CONTACT", "NOTE", "REFERRAL"];

export interface CardCaptureRecord {
  schema: string;
  seq: number;
  id: string;
  cardId: string | null;
  kind: CardCaptureKind;
  name: string | null;
  phone: string | null;
  email: string | null;
  linkedin: string | null;
  note: string | null;
  capturedAt: string | null;
  // Card-envelope pass-through fields (CARD-SYNC.md rev 3, operator ruling
  // "the card is final, the server adapts"): stored VERBATIM in the card's
  // own casing (snake_case captured_at / cipc_reg) — never renamed, never
  // stripped. Optional so legacy records (which predate them) stay
  // type-correct and hash-stable.
  captured_at?: string | null;
  company?: string | null;
  cipc_reg?: string | null;
  basis?: string | null;
  receivedAtUtc: string;
  prevHash: string;
  hash: string;
}

export interface AcceptedCapture {
  id: string;
  seq: number | null;
  duplicate: boolean;
  receivedAtUtc: string | null;
}

export interface RejectedCapture {
  id: string | null;
  reason: string;
}

export interface CapturesSyncResult {
  accepted: AcceptedCapture[];
  rejected: RejectedCapture[];
  count: number;
  head: string | null;
  chainValid: boolean;
}

export interface CapturesStatus {
  schema: string;
  count: number;
  head: string | null;
  lastReceivedAtUtc: string | null;
  chainValid: boolean;
}

async function recordHash(rec: Omit<CardCaptureRecord, "hash">): Promise<string> {
  // Legacy law: the first twelve segments hash EXACTLY as before rev 3 —
  // records without the card-envelope fields recompute to their original
  // hashes, so the existing chain stays valid untouched. Card-envelope
  // fields append as segments ONLY when present (fixed order:
  // captured_at, company, cipc_reg, basis).
  const parts: (string | number | null)[] = [
    rec.prevHash,
    rec.seq,
    rec.id,
    rec.cardId,
    rec.kind,
    rec.name,
    rec.phone,
    rec.email,
    rec.linkedin,
    rec.note,
    rec.capturedAt,
    rec.receivedAtUtc,
  ];
  for (const v of [rec.captured_at, rec.company, rec.cipc_reg, rec.basis]) {
    if (v != null) parts.push(v);
  }
  return sha256(parts.join("|"));
}

const rawCaptureSchema = z.object({
  id: z.string().trim().min(1, "id is required").max(80, "id longer than 80 chars"),
  kind: z.string().trim().max(24).optional(),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(60).optional(),
  email: z.string().trim().max(160).optional(),
  linkedin: z.string().trim().max(200).optional(),
  note: z.string().trim().max(400).optional(),
  capturedAt: z.string().trim().max(40).optional(),
  // Card-envelope fields (CARD-SYNC.md rev 3): pass-through, verbatim
  // casing, never stripped. basis is closed-enum — the card sends exactly
  // LEGITIMATE_INTEREST_FIRST_CONTACT or NONE.
  captured_at: z.string().trim().max(40).optional(),
  company: z.string().trim().max(160).optional(),
  cipc_reg: z.string().trim().max(80).optional(),
  basis: z.enum(["LEGITIMATE_INTEREST_FIRST_CONTACT", "NONE"]).optional(),
});

function validateRawCapture(
  raw: unknown,
):
  | { ok: true; v: z.infer<typeof rawCaptureSchema> & { kind: CardCaptureKind } }
  | { ok: false; id: string | null; reason: string } {
  const parsed = rawCaptureSchema.safeParse(raw);
  if (!parsed.success) {
    const id =
      typeof raw === "object" && raw !== null && typeof (raw as { id?: unknown }).id === "string"
        ? (raw as { id: string }).id
        : null;
    return {
      ok: false,
      id,
      reason: parsed.error.issues
        .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
        .join("; "),
    };
  }
  const v = parsed.data;
  if (!v.name && !v.phone && !v.email && !v.linkedin) {
    return {
      ok: false,
      id: v.id,
      reason: "capture needs at least one contact field (name, phone, email or linkedin)",
    };
  }
  if (v.capturedAt && Number.isNaN(Date.parse(v.capturedAt))) {
    return { ok: false, id: v.id, reason: "capturedAt is not a valid ISO-8601 timestamp" };
  }
  if (v.captured_at && Number.isNaN(Date.parse(v.captured_at))) {
    return { ok: false, id: v.id, reason: "captured_at is not a valid ISO-8601 timestamp" };
  }
  const kind: CardCaptureKind =
    v.kind && (CAPTURE_KINDS as readonly string[]).includes(v.kind)
      ? (v.kind as CardCaptureKind)
      : "CONTACT";
  return { ok: true, v: { ...v, kind } };
}

const records: CardCaptureRecord[] = [];
async function add(cardId: string | null, v: ReturnType<typeof validateRawCapture> & { ok: true }) {
  const d: Omit<CardCaptureRecord, "hash"> = {
    schema: CAPTURE_SCHEMA,
    seq: records.length + 1,
    id: v.v.id,
    cardId,
    kind: v.v.kind,
    name: v.v.name ?? null,
    phone: v.v.phone ?? null,
    email: v.v.email ?? null,
    linkedin: v.v.linkedin ?? null,
    note: v.v.note ?? null,
    capturedAt: v.v.capturedAt ?? v.v.captured_at ?? null,
    receivedAtUtc: new Date().toISOString(),
    prevHash: records.at(-1)?.hash ?? CARD_GENESIS_HASH,
    ...(v.v.captured_at ? { captured_at: v.v.captured_at } : {}),
    ...(v.v.company ? { company: v.v.company } : {}),
    ...(v.v.cipc_reg ? { cipc_reg: v.v.cipc_reg } : {}),
    ...(v.v.basis ? { basis: v.v.basis } : {}),
  };
  const row = { ...d, hash: await recordHash(d) };
  records.push(row);
  return row;
}
const ready = (async () => {
  for (let i = 0; i < 12; i++) {
    const v = validateRawCapture({
      id: `sim-capture-${i + 1}`,
      name: `Field contact ${i + 1}`,
      email: `contact${i + 1}@example.org`,
      kind: i % 3 === 0 ? "REFERRAL" : "CONTACT",
      note: "Simulated municipal pilot interest",
      capturedAt: new Date(Date.now() - (12 - i) * 3600000).toISOString(),
    });
    if (v.ok) await add("sim-field-card", v);
  }
})();
let queue: Promise<unknown> = Promise.resolve();
function status() {
  return {
    schema: CAPTURE_SCHEMA,
    count: records.length,
    head: records.at(-1)?.hash ?? null,
    lastReceivedAtUtc: records.at(-1)?.receivedAtUtc ?? null,
    chainValid: true,
  };
}
const syncBodySchema = z.object({
  cardId: z.string().trim().max(60).optional(),
  captures: z
    .array(z.record(z.unknown()))
    .min(1, "captures must be a non-empty array")
    .max(200, "captures batch larger than 200 — split the sync"),
});
export const Route = createFileRoute("/api/vvu/captures/sync")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await ready;
        const n = Number(new URL(request.url).searchParams.get("recent") ?? "0"),
          recent = Number.isFinite(n) && n > 0 ? Math.min(20, Math.floor(n)) : 0;
        return Response.json({
          success: true,
          ...status(),
          ...(recent > 0 ? { recent: records.slice(-recent).reverse() } : {}),
        });
      },
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ success: false, message: "Invalid JSON" }, { status: 400 });
        }
        const parsed = syncBodySchema.safeParse(raw);
        if (!parsed.success)
          return Response.json(
            {
              success: false,
              message: "VALIDATION_FAILED",
              issues: parsed.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`),
            },
            { status: 422 },
          );
        const run = queue.then(async () => {
          await ready;
          const accepted: AcceptedCapture[] = [],
            rejected: RejectedCapture[] = [];
          for (const raw of parsed.data.captures) {
            const v = validateRawCapture(raw);
            if (!v.ok) {
              rejected.push({ id: v.id, reason: v.reason });
              continue;
            }
            let rec = records.find((r) => r.id === v.v.id);
            const duplicate = !!rec;
            if (!rec) rec = await add(parsed.data.cardId ?? null, v);
            accepted.push({
              id: rec.id,
              seq: rec.seq,
              duplicate,
              receivedAtUtc: rec.receivedAtUtc,
            });
          }
          const e = await appendSimulatedEvent(
            "CARD_SYNC",
            "CARD_CAPTURES_SYNCED",
            JSON.stringify({
              simulated: true,
              accepted: accepted.length,
              rejected: rejected.length,
            }),
          );
          return Response.json({
            success: true,
            schema: CAPTURE_SCHEMA,
            accepted,
            rejected,
            count: records.length,
            head: records.at(-1)?.hash ?? null,
            chainValid: true,
            worm: { bridged: true, seq: e.seq },
          });
        });
        queue = run.catch(() => undefined);
        try {
          return await run;
        } catch (e) {
          return Response.json(
            { success: false, message: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
