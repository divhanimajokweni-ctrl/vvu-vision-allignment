// src/server/storage/verdict-ledger-pg.ts — R87 · POSTGRES PORT, STAGE 1:
// the pg-shaped store impl, written against a STRUCTURAL client so it
// type-checks today (no driver installed in the sandbox) and runs unchanged
// against `pg`, `postgres.js` or `bun:sql` in stage 2.
// ─────────────────────────────────────────────────────────────────────────────
// The contract (verdict-ledger-store.ts) is enforced here: append = one
// INSERT, read = one SELECT ordered newest-first, corrupt = 0 (pg refuses
// malformed rows at the door — the file store's corrupt count has no pg
// equivalent, and the stage-2 reconciler must explain the difference).
// PG_COLUMNS is the single source the drift test (r87_pg_schema_contract)
// holds against the DDL — add a column there AND here or the test fails.
// ─────────────────────────────────────────────────────────────────────────────

import type { VerdictLedgerRead, VerdictReadingRow } from '@/server/guardian/verdict-ledger';
import type { VerdictLedgerStore } from '@/server/storage/verdict-ledger-store';

/** The typed columns the pg store reads/writes. `raw` carries the row
 *  verbatim, so this list may lag the row type without losing evidence —
 *  but it may NEVER name a column the schema does not declare (the drift
 *  test proves it). */
export const PG_COLUMNS = [
  'at',
  'at_ms',
  'boot_pid',
  'dev_tree_pid',
  'uptime_sec',
  'boot_start_utc',
  'window_only',
  'climb_mb',
  'requests',
  'req_per_min',
  'mb_per_1k',
  'kind',
  'tone',
  'known_self_pct',
  'residual_req',
  'profile_next_key',
  'profile_next_count',
  'routes_tracked',
  'raw',
] as const;

/** Minimal structural surface every candidate driver can expose. */
export interface PgClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const COOLDOWN_MS = 60_000; // same constant the file-era read echoes

/** Row → typed column values. The mapping is EXPLICIT (no spread, no
 *  Object.entries) so a renamed field fails compilation, not the data. */
function rowToParams(row: VerdictReadingRow): unknown[] {
  return [
    row.at,
    row.atMs,
    row.bootPid,
    row.devTreePid,
    row.uptimeSec,
    row.bootStartUtc,
    row.windowOnly,
    row.climbMb,
    row.requests,
    row.reqPerMin,
    row.mbPer1k,
    row.kind,
    row.tone,
    row.knownSelfPct,
    row.residualReq,
    row.profileNextKey,
    row.profileNextCount,
    row.routesTracked,
    JSON.stringify(row),
  ];
}

/** db row → ledger row. The verbatim `raw` column wins for every field the
 *  typed columns also carry — the JSONB is the row of record. */
function dbRowToRow(db: Record<string, unknown>): VerdictReadingRow {
  return (typeof db.raw === 'string' ? JSON.parse(db.raw) : db.raw) as VerdictReadingRow;
}

export class PostgresVerdictLedgerStore implements VerdictLedgerStore {
  readonly kind = 'postgres' as const;

  constructor(
    private readonly client: PgClient,
    private readonly table = 'verdict_readings',
  ) {}

  async append(row: VerdictReadingRow): Promise<void> {
    const cols = PG_COLUMNS.join(', ');
    const placeholders = PG_COLUMNS.map((_, i) => `$${i + 1}`).join(', ');
    await this.client.query(
      `INSERT INTO ${this.table} (${cols}) VALUES (${placeholders})`,
      rowToParams(row),
    );
  }

  async read(): Promise<VerdictLedgerRead> {
    const res = await this.client.query(
      `SELECT raw FROM ${this.table} ORDER BY at_ms DESC, id DESC`,
    );
    const rows = res.rows.map(dbRowToRow);
    return {
      present: true,
      rows, // newest first — the contract's read order
      total: rows.length,
      corrupt: 0, // pg parses on write; malformed rows are refused, not stored
      cooldownMs: COOLDOWN_MS,
    };
  }
}
