// src/app/api/proximity/anchor/bundle/sync/audit/route.ts — R74 · the mirror audit.
// ─────────────────────────────────────────────────────────────────────────────
//   GET → independently re-read the configured mirror and cross-check it
//         against the vault and the manifest, returning per-file verdicts.
//
//   R79 — the audit now rides BOTH transports:
//     · file target → auditMirror()   re-hashes the staging mirror from disk
//     · s3 target   → auditS3Mirror() HEADs every key (signed SigV4), re-reads
//                     every object's bytes, cross-checks the manifest
//   Read-only by design on BOTH paths: an audit is a reading, not an event —
//   no writes, no journal row, nothing appended. Honest refusals:
//   UNCONFIGURED (no target), UNSUPPORTED (unroutable target kind),
//   EMPTY (no snapshots yet), UNREACHABLE (s3 endpoint would not answer).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';

import { auditMirror, auditS3Mirror, syncConfig } from '@/server/proximity/sync';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cfg = syncConfig();
    const audit = cfg.target === 's3' && cfg.configured ? await auditS3Mirror() : auditMirror();
    return NextResponse.json(
      { ok: audit.ok, audit },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'mirror audit failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
