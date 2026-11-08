// src/lib/card-captures.ts — Field OS Card capture store (file-backed).
//
// The card is an offline HTML app: it captures contacts in the field, queues
// them locally, and syncs them to this endpoint when a connection exists.
// The store is an append-only JSONL file with a SHA-256 hash chain — the same
// law as the WORM ledger (src/lib/vvu-ledger.ts), but local-file-backed so
// the sync route works today without a Prisma model push.
//
// File: db/card-captures.jsonl — untracked runtime state (R161 law).
// Idempotency: capture `id` is the key. Re-syncing an already-accepted
// capture returns it in accepted[] with duplicate:true so the phone can
// safely drop it from its queue. Nothing is ever written twice.

import { createHash } from 'crypto';
import { appendFile, mkdir, readFile } from 'fs/promises';
import path from 'path';
import { z } from 'zod';

export const CAPTURE_SCHEMA = 'vvu.card-capture.v1';
export const CARD_GENESIS_HASH = 'CARD-GENESIS-20260930-00000000000000000000000000';

// Deployment pinning (CARD-SYNC.md rev 3): the IVE sync endpoint (card
// contract) SHARES this store with the main app — a server started from
// another directory sets VVU_CARD_CAPTURES_DIR to this repo's db/ so both
// endpoints write ONE chain. Default (unset) is unchanged: process.cwd()/db.
const DB_DIR = process.env.VVU_CARD_CAPTURES_DIR
  ? path.resolve(process.env.VVU_CARD_CAPTURES_DIR)
  : path.join(process.cwd(), 'db');
const CAPTURES_FILE = path.join(DB_DIR, 'card-captures.jsonl');

export type CardCaptureKind = 'CONTACT' | 'NOTE' | 'REFERRAL';

const CAPTURE_KINDS: readonly CardCaptureKind[] = ['CONTACT', 'NOTE', 'REFERRAL'];

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

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function recordHash(rec: Omit<CardCaptureRecord, 'hash'>): string {
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
  return sha256(parts.join('|'));
}

// ─── per-capture validation (fail-closed per item, not per batch) ───────────

const rawCaptureSchema = z.object({
  id: z.string().trim().min(1, 'id is required').max(80, 'id longer than 80 chars'),
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
  basis: z.enum(['LEGITIMATE_INTEREST_FIRST_CONTACT', 'NONE']).optional(),
});

function validateRawCapture(
  raw: unknown
): { ok: true; v: z.infer<typeof rawCaptureSchema> & { kind: CardCaptureKind } } | { ok: false; id: string | null; reason: string } {
  const parsed = rawCaptureSchema.safeParse(raw);
  if (!parsed.success) {
    const id =
      typeof raw === 'object' && raw !== null && typeof (raw as { id?: unknown }).id === 'string'
        ? (raw as { id: string }).id
        : null;
    return { ok: false, id, reason: parsed.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ') };
  }
  const v = parsed.data;
  if (!v.name && !v.phone && !v.email && !v.linkedin) {
    return { ok: false, id: v.id, reason: 'capture needs at least one contact field (name, phone, email or linkedin)' };
  }
  if (v.capturedAt && Number.isNaN(Date.parse(v.capturedAt))) {
    return { ok: false, id: v.id, reason: 'capturedAt is not a valid ISO-8601 timestamp' };
  }
  if (v.captured_at && Number.isNaN(Date.parse(v.captured_at))) {
    return { ok: false, id: v.id, reason: 'captured_at is not a valid ISO-8601 timestamp' };
  }
  const kind: CardCaptureKind = v.kind && (CAPTURE_KINDS as readonly string[]).includes(v.kind) ? (v.kind as CardCaptureKind) : 'CONTACT';
  return { ok: true, v: { ...v, kind } };
}

// ─── store IO ───────────────────────────────────────────────────────────────

export async function readAllRecords(): Promise<CardCaptureRecord[]> {
  let text: string;
  try {
    text = await readFile(CAPTURES_FILE, 'utf8');
  } catch {
    return []; // no file yet → empty store
  }
  const records: CardCaptureRecord[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      records.push(JSON.parse(line) as CardCaptureRecord);
    } catch {
      throw new Error(`db/card-captures.jsonl: corrupt JSON at line ${i + 1}`);
    }
  }
  return records;
}

/** Recompute the chain over the full store (ascending) to prove integrity. */
export function verifyRecordsChain(records: CardCaptureRecord[]): boolean {
  let prev = CARD_GENESIS_HASH;
  let expectedSeq = 1;
  for (const rec of records) {
    const { hash, ...rest } = rec;
    if (rec.seq !== expectedSeq || rec.prevHash !== prev || hash !== recordHash(rest)) {
      return false;
    }
    prev = hash;
    expectedSeq++;
  }
  return true;
}

export function getStatus(records: CardCaptureRecord[]): CapturesStatus {
  const last = records[records.length - 1] ?? null;
  return {
    schema: CAPTURE_SCHEMA,
    count: records.length,
    head: last?.hash ?? null,
    lastReceivedAtUtc: last?.receivedAtUtc ?? null,
    chainValid: verifyRecordsChain(records),
  };
}

// ─── append (serialized: one batch at a time per process) ───────────────────

let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(job, job);
  writeQueue = run.catch(() => {});
  return run;
}

export async function appendBatch(
  cardId: string | null,
  raws: unknown[]
): Promise<CapturesSyncResult> {
  return enqueue(async () => {
    const records = await readAllRecords();
    const accepted: AcceptedCapture[] = [];
    const rejected: RejectedCapture[] = [];
    const byId = new Map<string, CardCaptureRecord>();
    for (const rec of records) byId.set(rec.id, rec);

    let seq = records.length;
    let prevHash = records[records.length - 1]?.hash ?? CARD_GENESIS_HASH;
    const newLines: string[] = [];
    const receivedAtUtc = new Date().toISOString();

    for (const raw of raws) {
      const checked = validateRawCapture(raw);
      if (!checked.ok) {
        rejected.push({ id: checked.id, reason: checked.reason });
        continue;
      }
      const existing = byId.get(checked.v.id);
      if (existing) {
        // Idempotent ack: already in the chain — the phone may drop it.
        accepted.push({ id: existing.id, seq: existing.seq, duplicate: true, receivedAtUtc: existing.receivedAtUtc });
        continue;
      }
      const draft: Omit<CardCaptureRecord, 'hash'> = {
        schema: CAPTURE_SCHEMA,
        seq: seq + 1,
        id: checked.v.id,
        cardId,
        kind: checked.v.kind,
        name: checked.v.name || null,
        phone: checked.v.phone || null,
        email: checked.v.email || null,
        linkedin: checked.v.linkedin || null,
        note: checked.v.note || null,
        capturedAt: checked.v.capturedAt || null,
        captured_at: checked.v.captured_at || null,
        company: checked.v.company || null,
        cipc_reg: checked.v.cipc_reg || null,
        basis: checked.v.basis || null,
        receivedAtUtc,
        prevHash,
      };
      const hash = recordHash(draft);
      const rec: CardCaptureRecord = { ...draft, hash };
      newLines.push(JSON.stringify(rec));
      byId.set(rec.id, rec);
      accepted.push({ id: rec.id, seq: rec.seq, duplicate: false, receivedAtUtc: rec.receivedAtUtc });
      seq = rec.seq;
      prevHash = hash;
    }

    if (newLines.length > 0) {
      await mkdir(DB_DIR, { recursive: true });
      await appendFile(CAPTURES_FILE, newLines.map((l) => `${l}\n`).join(''), 'utf8');
    }

    const finalRecords = await readAllRecords();
    return {
      accepted,
      rejected,
      count: finalRecords.length,
      head: finalRecords[finalRecords.length - 1]?.hash ?? null,
      chainValid: verifyRecordsChain(finalRecords),
    };
  });
}
