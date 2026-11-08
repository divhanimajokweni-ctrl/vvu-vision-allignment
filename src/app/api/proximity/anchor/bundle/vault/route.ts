// src/app/api/proximity/anchor/bundle/vault/route.ts — R68 · the vault side.
// ─────────────────────────────────────────────────────────────────────────────
//   GET               → list snapshots (newest first, capped at 12) + totals
//   GET ?file=<name>  → read ONE stored bundle back (strict filename check)
//   POST              → export the live ledger NOW and file it as a snapshot
//
// The vault stores the SAME vvu.anchor-bundle.v1 objects the export produces
// — the file format IS the object format, so syncing this directory off-box
// later is a plain copy. Every row in the index is hash-covered by the
// bundle it names; verify against the live chain stays the existing
// POST /api/proximity/anchor/bundle (integrity first, then replay).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { listBundleSnapshots, readBundleSnapshot, saveBundleSnapshot, vaultBytes } from '@/server/proximity/bundle-vault';
import { runSync, syncConfig } from '@/server/proximity/sync';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const file = new URL(request.url).searchParams.get('file');
  if (file) {
    const bundle = readBundleSnapshot(file);
    if (!bundle) {
      return NextResponse.json(
        { ok: false, error: `no readable snapshot named ${file} — the name is invalid or the file is gone` },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(bundle, { headers: { 'Cache-Control': 'no-store' } });
  }

  const { total, gone, snapshots } = listBundleSnapshots();
  return NextResponse.json(
    { ok: true, total, gone, bytes: vaultBytes(), snapshots },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST() {
  try {
    const { row, fileName } = await saveBundleSnapshot(db);

    // R74 — AUTO-MIRROR: when the operator sets `autoSync: true` in
    // sync-target.json (file targets only), a fresh snapshot mirrors itself
    // immediately — evidence leaves the vault without waiting for a human
    // click. Non-fatal by contract: a failed mirror NEVER fails the snapshot
    // (the vault write is the primary act; the mirror is a second, retryable
    // one), and the response reports exactly what the mirror did.
    let mirrored: { state: string; detail: string | null } | null = null;
    const cfg = syncConfig();
    if (cfg.configured && cfg.target === 'file' && cfg.autoSync) {
      try {
        const result = await runSync('auto');
        mirrored = { state: result.row.state, detail: result.row.detail };
      } catch (e) {
        mirrored = { state: 'FAILED', detail: e instanceof Error ? e.message : 'auto-mirror crashed (snapshot itself is safe)' };
      }
    }

    return NextResponse.json(
      {
        ok: true,
        fileName,
        row,
        mirrored,
        note: mirrored
          ? `snapshot filed + auto-mirrored (${mirrored.state}) — vvu-trust/bundles/ → ${cfg.detail}`
          : 'snapshot filed — a complete vvu.anchor-bundle.v1 on disk under vvu-trust/bundles/',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'vault snapshot failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
