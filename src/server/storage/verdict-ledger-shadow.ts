// src/server/storage/verdict-ledger-shadow.ts — R89 · POSTGRES PORT, STAGE 3
// PREP: THE SHADOW-WRITE RECONCILER.
// ─────────────────────────────────────────────────────────────────────────────
// Stage 1 (R87) gave the estate a store contract and a pg impl; stage 2 (R88)
// rehearsed that impl against pg-mem with the real DDL and real rows. What
// the cutover still needs is the migration MACHINERY — and its safest form
// is a shadow: the file store stays canonical, every append is mirrored to
// pg on a best-effort basis, and a REPORT-ONLY reconciler diffs the two on
// demand. Nothing here rewrites history on either side:
//
//   append()  → primary first (canonical; a primary failure propagates —
//               the live ledger must never silently lose a row), then the
//               shadow attempt, whose failure is CAPTURED, never thrown:
//               a shadow outage must not be able to break the live path.
//   read()    → the primary, always. The shadow is never consulted for
//               reads — an operator-facing number cannot depend on the
//               thing being rehearsed.
//   reconcile() → reads BOTH stores and reports the drift classes by name:
//               missing-in-shadow, extra-in-shadow, mismatched-raw. It
//               repairs nothing: auto-repair is a stage-3 POLICY decision
//               that belongs to the operator, not to a module that runs
//               unattended. The report is the evidence; the decision is
//               recorded next to it.
//
// THE JOIN KEY: rows are keyed by `atMs:bootPid` (ms-precision record time ×
// the serving worker's pid). The recorder's 60s per-boot cooldown is the
// de-facto uniqueness guarantee — two rows from one boot inside the same
// millisecond cannot happen while that policy stands. This is exactly why
// the DDL carries NO unique constraint (the store enforces nothing) while
// this reconciler may still assume the pair is unique: the assumption is
// the recorder's policy, documented where it is used, and the mismatch
// class degrades honestly (a collision would surface as extra/missing
// pairs rather than a false PARITY).
//
// Driver note (stage 3's open half): PostgresVerdictLedgerStore takes the
// STRUCTURAL PgClient, so the driver choice (pg vs postgres.js vs bun:sql)
// stays a one-line wiring decision at the call site. The runtime is Bun;
// `pg` remains the conservative default (pooling, prepared statements,
// battle-tested JSONB parsing) — bun:sql can replace it without touching
// this file, which is the point of the structural client.
// ─────────────────────────────────────────────────────────────────────────────

import type { VerdictLedgerRead, VerdictReadingRow } from '@/server/guardian/verdict-ledger';
import type { VerdictLedgerStore } from '@/server/storage/verdict-ledger-store';

/** The reconciler's row identity — recorder-cooldown-unique (see header). */
export interface ShadowRowKey {
  atMs: number;
  bootPid: number;
}

export type ShadowDiffVerdict = 'PARITY' | 'DRIFT' | 'SHADOW-UNAVAILABLE';

export interface ShadowDiffReport {
  /** What the read path actually serves — the canonical count. */
  primaryTotal: number;
  /** What the rehearsal target holds. */
  shadowTotal: number;
  /** In the primary, absent from the shadow: rows a cutover would LOSE. */
  missingInShadow: ShadowRowKey[];
  /** In the shadow, absent from the primary: rows a cutover would INVENT. */
  extraInShadow: ShadowRowKey[];
  /** Same key both sides, different verbatim JSON: a silent rewrite — the
   *  worst class, because a naive count-only check would call it parity. */
  mismatchedRaw: ShadowRowKey[];
  /** The shadow read itself failed — the rehearsal target is down, and the
   *  report says so instead of pretending zero drift. */
  shadowError: string | null;
  verdict: ShadowDiffVerdict;
}

function keyOf(atMs: number, bootPid: number): string {
  return `${atMs}:${bootPid}`;
}

/** THE reconciler. Pure over two reads — it writes to neither store. */
export async function reconcileShadow(
  primary: VerdictLedgerRead,
  shadowResult: { ok: true; read: VerdictLedgerRead } | { ok: false; error: string },
): Promise<ShadowDiffReport> {
  const base: ShadowDiffReport = {
    primaryTotal: primary.total,
    shadowTotal: 0,
    missingInShadow: [],
    extraInShadow: [],
    mismatchedRaw: [],
    shadowError: null,
    verdict: 'PARITY',
  };
  if (!shadowResult.ok) {
    return { ...base, shadowError: shadowResult.error, verdict: 'SHADOW-UNAVAILABLE' };
  }
  const shadow = shadowResult.read;
  base.shadowTotal = shadow.total;

  // Verbatim-JSON maps — the raw row is the row of record on BOTH sides, so
  // the comparison is byte-shaped, not field-shaped: any field drift shows.
  const primaryRows = new Map<string, string>();
  for (const r of primary.rows) primaryRows.set(keyOf(r.atMs, r.bootPid), JSON.stringify(r));
  const shadowRows = new Map<string, string>();
  for (const r of shadow.rows) shadowRows.set(keyOf(r.atMs, r.bootPid), JSON.stringify(r));

  for (const [k, v] of primaryRows) {
    const s = shadowRows.get(k);
    if (s === undefined) {
      const [atMs, bootPid] = k.split(':').map(Number);
      base.missingInShadow.push({ atMs, bootPid });
    } else if (s !== v) {
      const [atMs, bootPid] = k.split(':').map(Number);
      base.mismatchedRaw.push({ atMs, bootPid });
    }
  }
  for (const k of shadowRows.keys()) {
    if (!primaryRows.has(k)) {
      const [atMs, bootPid] = k.split(':').map(Number);
      base.extraInShadow.push({ atMs, bootPid });
    }
  }
  // Deterministic reports: chronological, so a diff reads like the ledger.
  const byKey = (a: ShadowRowKey, b: ShadowRowKey) => a.atMs - b.atMs || a.bootPid - b.bootPid;
  base.missingInShadow.sort(byKey);
  base.extraInShadow.sort(byKey);
  base.mismatchedRaw.sort(byKey);

  base.verdict =
    base.missingInShadow.length > 0 || base.extraInShadow.length > 0 || base.mismatchedRaw.length > 0
      ? 'DRIFT'
      : 'PARITY';
  return base;
}

/** The shadow store — a VerdictLedgerStore whose READ path is the primary's
 *  and whose WRITE path mirrors to the shadow on a best-effort basis. Drop-in
 *  for stage 3's rehearsal: the recorder can hold this handle and the live
 *  behavior is unchanged until cutover decides otherwise. */
export class ShadowLedgerStore implements VerdictLedgerStore {
  private lastShadowError: string | null = null;

  constructor(
    private readonly primary: VerdictLedgerStore,
    private readonly shadow: VerdictLedgerStore,
  ) {}

  /** Provenance follows the PRIMARY — the handle answers as the store the
   *  estate actually trusts; the shadow is an implementation detail. */
  get kind(): VerdictLedgerStore['kind'] {
    return this.primary.kind;
  }

  /** Canonical reads only — the shadow is never consulted (header rule). */
  read(): Promise<VerdictLedgerRead> {
    return this.primary.read();
  }

  /** Primary first (failure propagates — the live ledger never silently
   *  loses a row), then the best-effort mirror (failure captured — the
   *  shadow can never break the live path). */
  async append(row: VerdictReadingRow): Promise<void> {
    await this.primary.append(row);
    try {
      await this.shadow.append(row);
      this.lastShadowError = null;
    } catch (e) {
      this.lastShadowError = e instanceof Error ? e.message : String(e);
    }
  }

  /** The captured mirror failure, for the poller that surfaces shadow health.
   *  Null after a successful append — the LATEST attempt's state, not a
   *  cumulative count (counts belong to the reconciler's report). */
  get shadowError(): string | null {
    return this.lastShadowError;
  }

  /** The report-only diff (header rules: repairs nothing, decides nothing). */
  async reconcile(): Promise<ShadowDiffReport> {
    const primary = await this.primary.read();
    let shadowResult: { ok: true; read: VerdictLedgerRead } | { ok: false; error: string };
    try {
      shadowResult = { ok: true, read: await this.shadow.read() };
    } catch (e) {
      shadowResult = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    return reconcileShadow(primary, shadowResult);
  }
}
