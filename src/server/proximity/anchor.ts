// src/server/proximity/anchor.ts
// ─────────────────────────────────────────────────────────────────────────────
// EXTERNAL HEAD ANCHORING — phase-two v0, honest about what it is.
//
// The honest limit (in the brief, said out loud): the walker is
// tamper-EVIDENT against byte alteration and linkage breaks, but a full-file
// rewrite that re-links the whole chain consistently would verify clean.
// Anchoring is the answer: periodically pin (position, record_hash) pairs
// OUTSIDE the database, then replay those pins against the live chain.
// A rewritten history drifts from its anchors.
//
// This v0 stores anchors in a local append-only JSONL file:
//
//   vvu-trust/chains/proximity-heads.jsonl
//
// — the same role object storage or an HSM-signed head plays in phase two,
// minus the off-box guarantee. NOTHING about the entry format changes when
// the store moves: each line is already (seq, anchoredAtUtc, position,
// headHash, algorithm, streamId). Rules the kernel enforces:
//
//   · a BROKEN chain is never anchored (refused, fail-closed);
//   · anchoring the same head twice is idempotent (already-anchored);
//   · the file is append-only — anchors are never edited or removed;
//   · DRIFT is reported, never auto-"fixed" — an anchor disagreement is
//     evidence, and evidence does not get overwritten by the thing it
//     is evidence against.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { PrismaClient } from '@prisma/client';

import {
  formatUtc,
  PROXIMITY_STREAM_ID,
  type AnchorEntry,
  type AnchorLedger,
  type AnchorVerifyRow,
} from '@/lib/proximity/types';
import { verifyProximityChain } from './verify';

export const HEADS_PATH = path.join(process.cwd(), 'vvu-trust', 'chains', 'proximity-heads.jsonl');

export class AnchorRefusedError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AnchorRefusedError';
  }
}

async function readHeads(): Promise<AnchorEntry[]> {
  try {
    const text = await readFile(HEADS_PATH, 'utf8');
    const heads: AnchorEntry[] = [];
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        heads.push(JSON.parse(trimmed) as AnchorEntry);
      } catch {
        /* torn final line — skipped */
      }
    }
    heads.sort((a, b) => a.seq - b.seq);
    return heads;
  } catch {
    return [];
  }
}

/** The raw (unverified) anchor entries, oldest first — the bundle exporter reads these. */
export function readHeadEntries(): Promise<AnchorEntry[]> {
  return readHeads();
}

/**
 * Anchor the current (VERIFIED VALID) chain head. Refuses to anchor a
 * broken chain — an anchor is a claim that the past was correct, and the
 * kernel does not make claims it has not checked.
 */
export async function anchorNow(
  dbi: PrismaClient,
  note = '',
): Promise<{ anchored: boolean; alreadyAnchored: boolean; anchor: AnchorEntry | null; reason: string | null }> {
  const verification = await verifyProximityChain(dbi);
  if (!verification.valid || verification.headHash === null || verification.headPosition === null) {
    return {
      anchored: false,
      alreadyAnchored: false,
      anchor: null,
      reason: verification.brokenAt
        ? `ANCHOR_REFUSED_BROKEN_CHAIN — the walker reports ${verification.brokenAt}; fix or restore before anchoring`
        : 'ANCHOR_REFUSED_EMPTY_CHAIN — nothing to anchor yet',
    };
  }

  const existing = await readHeads();
  const last = existing[existing.length - 1] ?? null;
  if (last && last.headHash === verification.headHash && last.headPosition === verification.headPosition) {
    return { anchored: false, alreadyAnchored: true, anchor: last, reason: 'head already anchored (idempotent)' };
  }

  const anchor: AnchorEntry = {
    seq: existing.length + 1,
    anchoredAtUtc: formatUtc(Date.now()),
    headPosition: verification.headPosition,
    headHash: verification.headHash,
    algorithm: 'VVU-WORM-v1',
    streamId: PROXIMITY_STREAM_ID,
    note: note.slice(0, 120),
  };
  await mkdir(path.dirname(HEADS_PATH), { recursive: true });
  await appendFile(HEADS_PATH, `${JSON.stringify(anchor)}\n`, 'utf8');
  return { anchored: true, alreadyAnchored: false, anchor, reason: null };
}

/**
 * Replay every anchor against the LIVE chain. OK = the record hash at that
 * position still matches the pin. DRIFT = it does not — history was
 * rewritten after the anchor was taken. MISSING = the position is gone —
 * records were removed. This is the check the walker alone cannot do.
 */
export async function anchorLedger(dbi: PrismaClient): Promise<AnchorLedger> {
  const heads = await readHeads();
  const seals = await dbi.wormSealIndex.findMany({
    where: { streamId: PROXIMITY_STREAM_ID },
    orderBy: { position: 'asc' },
    select: { position: true, recordHash: true },
  });
  const byPosition = new Map(seals.map((s) => [Number(s.position), s.recordHash]));
  const chainLength = seals.length;

  const rows: AnchorVerifyRow[] = heads.map((h) => {
    const live = byPosition.get(h.headPosition);
    const status: AnchorVerifyRow['status'] =
      live === undefined ? 'MISSING' : live === h.headHash ? 'OK' : 'DRIFT';
    return { ...h, status };
  });
  rows.reverse(); // newest first — the rail reads top-down

  const okCount = rows.filter((r) => r.status === 'OK').length;
  const driftCount = rows.filter((r) => r.status === 'DRIFT').length;
  const missingCount = rows.filter((r) => r.status === 'MISSING').length;

  return {
    anchors: rows,
    okCount,
    driftCount,
    missingCount,
    coveragePercent: chainLength === 0 ? null : Math.round((okCount / chainLength) * 100),
    chainLength,
    continuity: rows.length === 0 ? 'EMPTY' : driftCount + missingCount > 0 ? 'DRIFT' : 'VALID',
    storePath: 'vvu-trust/chains/proximity-heads.jsonl',
    nowUtc: formatUtc(Date.now()),
  };
}
