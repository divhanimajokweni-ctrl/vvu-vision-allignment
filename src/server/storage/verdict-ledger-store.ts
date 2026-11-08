// src/server/storage/verdict-ledger-store.ts — R87 · POSTGRES PORT, STAGE 1:
// THE STORAGE CONTRACT.
// ─────────────────────────────────────────────────────────────────────────────
// The Postgres port has been the estate's oldest open item since R69 (two-
// instance deployment needs a store two processes can share — an append-only
// file on one box cannot). This spike lands STAGE 1 of 3 without touching the
// live path:
//
//   stage 1 (THIS) — the contract + a file impl + a pg impl + schema + a
//                    runnable schema↔code drift test. The live ledger keeps
//                    its direct file access (append-only JSONL remains
//                    canonical); the interface is exercised by the contract
//                    test, not by production traffic yet.
//   stage 2        — driver choice (pg vs postgres.js vs bun:sql), a real
//                    server, SHADOW-WRITE: every recorded reading goes to
//                    both stores; a reconciler diffs them on read.
//   stage 3        — cutover: pg becomes canonical, file stays as the
//                    migration input; the guardian/chronicle readers switch
//                    to the store handle they were already given.
//
// WHY A CONTRACT AT ALL: the ledger's honesty rules are few but strict —
// append-only (no updates, no deletes, ever), newest-first reads, corrupt
// lines counted and never hidden, and the row is stored VERBATIM (the store
// invents no numbers and loses no fields). Any impl that cannot keep all
// four is not a ledger store.
// ─────────────────────────────────────────────────────────────────────────────

import type { VerdictLedgerRead, VerdictReadingRow } from '@/server/guardian/verdict-ledger';

export interface VerdictLedgerStore {
  /** Which implementation is answering — provenance for the worklog and the
   *  chronicle's sources block, never shown as a tier. */
  readonly kind: 'file' | 'postgres';
  /** Full read: every row (newest first) + total + corrupt count. The
   *  cooldownMs field is a FILE-era artifact the route still echoes; pg impls
   *  return the same constant so callers cannot tell the stores apart. */
  read(): Promise<VerdictLedgerRead>;
  /** Append ONE row, verbatim, at the tail. No update, no delete, no
   *  reorder — a store that rewrites history is disqualified by contract. */
  append(row: VerdictReadingRow): Promise<void>;
}
