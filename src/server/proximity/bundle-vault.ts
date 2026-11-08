// src/server/proximity/bundle-vault.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE BUNDLE VAULT — off-box v0.5: snapshots accumulate.
//
// R64's bundle proved the FORMAT (evidence that travels). But an export that
// only exists when someone remembers to click is not an archive — if the box
// dies between exports, the anchors since the last download die with it.
// The vault makes snapshots ACCUMULATE on disk in the same
// `vvu.anchor-bundle.v1` object format: every snapshot is a complete,
// self-verifying bundle; the index (vault-index.jsonl) is append-only.
//
// This is deliberately still ON-box (the same disk the anchors live on) —
// it is the accumulation layer that makes the eventual object-storage sync
// trivial: sync = copy vvu-trust/bundles/ off the box, done. The real
// off-box step remains R67's priority #2.
//
// Rules:
//   · every snapshot file is written COMPLETE (temp file + rename) — a
//     half-written bundle is worse than none;
//   · the index row is appended only AFTER the file is durable;
//   · listing re-verifies the file still exists — an index row whose file
//     was deleted by hand is reported GONE, not faked;
//   · filenames are generated here and validated on read (no traversal).
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only';

import { existsSync, mkdirSync, appendFileSync, writeFileSync, renameSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

import type { PrismaClient } from '@prisma/client';

import type { AnchorBundle } from '@/lib/proximity/types';
import { exportAnchorBundle } from './bundle';

const VAULT_DIR = join(process.cwd(), 'vvu-trust', 'bundles');
const INDEX_PATH = join(VAULT_DIR, 'vault-index.jsonl');
const FILE_RE = /^vvu-anchor-bundle-\d{8}T\d{6}(?:-\d+)?\.json$/;

export interface VaultRow {
  fileName: string;
  bundleHash: string;
  anchors: number;
  headPosition: number | null;
  headHash: string | null;
  exportedAtUtc: string;
  savedAtUtc: string;
  bytes: number;
}

function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  );
}

/** Export the live anchor ledger and write it into the vault as one more
 *  self-verifying snapshot. Returns the index row. */
export async function saveBundleSnapshot(dbi: PrismaClient): Promise<{ row: VaultRow; fileName: string }> {
  const { bundle } = await exportAnchorBundle(dbi);
  mkdirSync(VAULT_DIR, { recursive: true });

  // Unique, collision-safe filename (two snapshots within the same second).
  const base = `vvu-anchor-bundle-${nowStamp()}`;
  let fileName = `${base}.json`;
  for (let n = 2; existsSync(join(VAULT_DIR, fileName)); n++) fileName = `${base}-${n}.json`;

  const tmp = join(VAULT_DIR, `${fileName}.tmp`);
  const dest = join(VAULT_DIR, fileName);
  const text = JSON.stringify(bundle, null, 2);
  writeFileSync(tmp, text, 'utf8');
  renameSync(tmp, dest); // complete file or nothing

  const last = bundle.chain.headPosition;
  const row: VaultRow = {
    fileName,
    bundleHash: bundle.bundleHash,
    anchors: bundle.anchors.length,
    headPosition: last,
    headHash: bundle.chain.headHash,
    exportedAtUtc: bundle.exportedAtUtc,
    savedAtUtc: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
    bytes: Buffer.byteLength(text, 'utf8'),
  };
  appendFileSync(INDEX_PATH, JSON.stringify(row) + '\n', 'utf8');
  return { row, fileName };
}

/** List vault snapshots — newest first, capped; index rows whose file
 *  vanished are counted GONE, never shown as if present. */
export function listBundleSnapshots(cap = 12): { total: number; gone: number; snapshots: VaultRow[] } {
  if (!existsSync(INDEX_PATH)) return { total: 0, gone: 0, snapshots: [] };
  const rows: VaultRow[] = [];
  let gone = 0;
  for (const line of readFileSync(INDEX_PATH, 'utf8').split('\n').filter(Boolean)) {
    try {
      const r = JSON.parse(line) as VaultRow;
      if (!r || typeof r.fileName !== 'string' || !FILE_RE.test(r.fileName)) continue;
      if (!existsSync(join(VAULT_DIR, r.fileName))) {
        gone++;
        continue;
      }
      rows.push(r);
    } catch {
      /* an unparsable index line is skipped — the files speak for themselves */
    }
  }
  rows.reverse(); // newest first
  return { total: rows.length, gone, snapshots: rows.slice(0, cap) };
}

/** Read one snapshot back as a parsed bundle — filename strictly validated
 *  (no traversal), missing file is an honest null. */
export function readBundleSnapshot(fileName: string): AnchorBundle | null {
  if (!FILE_RE.test(fileName)) return null;
  const path = join(VAULT_DIR, fileName);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as AnchorBundle;
  } catch {
    return null;
  }
}

/** Remove one snapshot file + mark the index row gone (used only where the
 *  operator explicitly prunes — not exposed via API yet; kept for tests). */
export function pruneBundleSnapshot(fileName: string): boolean {
  if (!FILE_RE.test(fileName)) return false;
  const path = join(VAULT_DIR, fileName);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}

/** Vault size on disk — one honest number for the UI footer. */
export function vaultBytes(): number | null {
  if (!existsSync(VAULT_DIR)) return 0;
  try {
    let total = 0;
    for (const f of readFileSync(INDEX_PATH, 'utf8').split('\n').filter(Boolean)) {
      try {
        const r = JSON.parse(f) as VaultRow;
        const p = join(VAULT_DIR, r.fileName);
        if (FILE_RE.test(r.fileName) && existsSync(p)) total += statSync(p).size;
      } catch {
        /* skip */
      }
    }
    return total;
  } catch {
    return null;
  }
}
