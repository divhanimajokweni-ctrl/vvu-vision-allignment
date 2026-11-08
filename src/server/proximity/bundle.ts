// src/server/proximity/bundle.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE ANCHOR BUNDLE — off-box v0: evidence that travels.
//
// The local heads file (proximity-heads.jsonl) is still ON the box it anchors.
// If the box dies or its disk is the thing being rewritten, the anchors die
// with it. Object storage / HSM heads are the real phase-two answer; until the
// estate has them, the bundle is the off-box step an operator can take TODAY:
//
//   EXPORT  → one self-describing JSON file: every anchor entry + the chain
//             state at export time + a sha256 over all of it. Carry it
//             anywhere — email, USB, another machine, a printed QR if it
//             comes to that. The file format is the object-storage format.
//   VERIFY  → replay a received bundle against ANY live chain: check the
//             bundle's own hash first (tamper-evident bundle), then every
//             anchor inside it (OK / DRIFT / MISSING — the same replay the
//             local ledger runs).
//
// Rules:
//   · the bundle hash is computed over a FIXED key order — recomputable on
//     any machine with any JSON tooling, no library lock-in;
//   · a tampered bundle is reported, never silently accepted — the integrity
//     verdict and the anchor replay are two separate, both-visible checks;
//   · exporting refuses nothing (a bundle is a copy, not a claim) — but the
//     chain state it records is whatever the walker saw at export time,
//     including BROKEN. The receiver will see it.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

import { createHash } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

import {
  formatUtc,
  PROXIMITY_STREAM_ID,
  type AnchorBundle,
  type AnchorEntry,
  type BundleVerifyResult,
  type BundleVerifyRow,
} from '@/lib/proximity/types';
import { readHeadEntries } from './anchor';

const BUNDLE_FORMAT = 'vvu.anchor-bundle.v1' as const;

/**
 * Canonical stringify — recursively sorts object keys so the sha256 is
 * reproducible across machines and JSON tooling. Arrays keep their order.
 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}

function bundleHashOf(bundle: Omit<AnchorBundle, 'bundleHash'>): string {
  return createHash('sha256').update(canonicalize(bundle)).digest('hex');
}

/** Export the current anchor ledger as a portable, hash-covered bundle. */
export async function exportAnchorBundle(dbi: PrismaClient): Promise<{ bundle: AnchorBundle; fileName: string }> {
  const anchors: AnchorEntry[] = await readHeadEntries();

  const seals = await dbi.wormSealIndex.findMany({
    where: { streamId: PROXIMITY_STREAM_ID },
    orderBy: { position: 'asc' },
    select: { position: true, recordHash: true },
  });
  const last = seals[seals.length - 1] ?? null;

  const withoutHash: Omit<AnchorBundle, 'bundleHash'> = {
    format: BUNDLE_FORMAT,
    exportedAtUtc: formatUtc(Date.now()),
    streamId: PROXIMITY_STREAM_ID,
    algorithm: 'VVU-WORM-v1',
    chain: {
      records: seals.length,
      headPosition: last ? Number(last.position) : null,
      headHash: last ? last.recordHash : null,
    },
    anchors,
  };
  const bundle: AnchorBundle = { ...withoutHash, bundleHash: bundleHashOf(withoutHash) };

  const stamp = bundle.exportedAtUtc.replace(/[^0-9]/g, '').slice(0, 12); // YYYYMMDDHHMM
  return { bundle, fileName: `vvu-anchor-bundle-${stamp}.json` };
}

/**
 * Replay a received bundle against the LIVE chain. Two separate checks, both
 * surfaced: (1) the bundle's own integrity — recompute the hash over its
 * contents; (2) every anchor inside it, replayed like the local ledger.
 */
export async function verifyAnchorBundle(
  dbi: PrismaClient,
  raw: unknown,
): Promise<{ ok: boolean; result: BundleVerifyResult }> {
  const checkedAtUtc = formatUtc(Date.now());

  // ── shape check ───────────────────────────────────────────────────────────
  const b = raw as Partial<AnchorBundle> | null;
  if (
    !b ||
    typeof b !== 'object' ||
    b.format !== BUNDLE_FORMAT ||
    !Array.isArray(b.anchors) ||
    typeof b.bundleHash !== 'string'
  ) {
    return {
      ok: false,
      result: {
        bundleIntegrity: 'MALFORMED',
        integrityDetail:
          'not a vvu.anchor-bundle.v1 document — format field missing/wrong, anchors not an array, or bundleHash absent',
        formatOk: false,
        streamOk: false,
        exportedAtUtc: null,
        bundleAnchorCount: Array.isArray(b?.anchors) ? b.anchors.length : 0,
        rows: [],
        okCount: 0,
        driftCount: 0,
        missingCount: 0,
        verdict: 'REFUSED — the file is not an anchor bundle; nothing was replayed.',
        checkedAtUtc,
      },
    };
  }

  // ── integrity check (recompute over everything except the hash itself) ────
  const { bundleHash, ...rest } = b as AnchorBundle;
  let recomputed: string;
  try {
    recomputed = bundleHashOf(rest as Omit<AnchorBundle, 'bundleHash'>);
  } catch {
    return {
      ok: false,
      result: {
        bundleIntegrity: 'MALFORMED',
        integrityDetail: 'bundle contents are not canonicalizable JSON — cannot recompute the hash',
        formatOk: true,
        streamOk: b.streamId === PROXIMITY_STREAM_ID,
        exportedAtUtc: typeof b.exportedAtUtc === 'string' ? b.exportedAtUtc : null,
        bundleAnchorCount: b.anchors.length,
        rows: [],
        okCount: 0,
        driftCount: 0,
        missingCount: 0,
        verdict: 'REFUSED — the bundle cannot be hash-checked.',
        checkedAtUtc,
      },
    };
  }
  if (recomputed !== bundleHash) {
    return {
      ok: false,
      result: {
        bundleIntegrity: 'TAMPERED',
        integrityDetail: `recomputed sha256 ${recomputed.slice(0, 16)}… does not match the bundle's stated ${bundleHash.slice(0, 16)}… — the file was altered after export`,
        formatOk: true,
        streamOk: b.streamId === PROXIMITY_STREAM_ID,
        exportedAtUtc: typeof b.exportedAtUtc === 'string' ? b.exportedAtUtc : null,
        bundleAnchorCount: b.anchors.length,
        rows: [],
        okCount: 0,
        driftCount: 0,
        missingCount: 0,
        verdict: 'REFUSED — the bundle fails its own hash; its anchors are not evidence of anything.',
        checkedAtUtc,
      },
    };
  }

  // ── replay every anchor against the live chain ────────────────────────────
  const seals = await dbi.wormSealIndex.findMany({
    where: { streamId: PROXIMITY_STREAM_ID },
    orderBy: { position: 'asc' },
    select: { position: true, recordHash: true },
  });
  const byPosition = new Map(seals.map((s) => [Number(s.position), s.recordHash]));

  const entries = (b.anchors as AnchorEntry[])
    .filter((a) => a && typeof a === 'object' && typeof a.headPosition === 'number' && typeof a.headHash === 'string')
    .sort((x, y) => x.seq - y.seq);

  const rows: BundleVerifyRow[] = entries.map((a) => {
    const live = byPosition.get(a.headPosition);
    const status: BundleVerifyRow['status'] =
      live === undefined ? 'MISSING' : live === a.headHash ? 'OK' : 'DRIFT';
    return { ...a, status };
  });
  rows.reverse(); // newest first — the UI reads top-down

  const okCount = rows.filter((r) => r.status === 'OK').length;
  const driftCount = rows.filter((r) => r.status === 'DRIFT').length;
  const missingCount = rows.filter((r) => r.status === 'MISSING').length;

  const verdict =
    rows.length === 0
      ? 'INTACT but EMPTY — the bundle carries no anchors to replay.'
      : driftCount + missingCount > 0
        ? `DISPUTE — the live chain disagrees with ${driftCount + missingCount} of ${rows.length} anchors from a bundle exported ${b.exportedAtUtc ?? 'at an unknown time'}.`
        : `HOLDS — all ${okCount} anchors in the bundle match the live chain exactly.`;

  return {
    ok: true,
    result: {
      bundleIntegrity: 'INTACT',
      integrityDetail: `sha256 verified over ${b.anchors.length} anchors + chain context`,
      formatOk: true,
      streamOk: b.streamId === PROXIMITY_STREAM_ID,
      exportedAtUtc: typeof b.exportedAtUtc === 'string' ? b.exportedAtUtc : null,
      bundleAnchorCount: b.anchors.length,
      rows,
      okCount,
      driftCount,
      missingCount,
      verdict,
      checkedAtUtc,
    },
  };
}
