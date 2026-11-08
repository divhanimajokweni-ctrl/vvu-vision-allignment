-- src/server/storage/verdict-readings.schema.sql — R87 · POSTGRES PORT, STAGE 1:
-- the verdict readings ledger's DDL.
-- ────────────────────────────────────────────────────────────────────────────
-- Design rules (each one guards an estate honesty property):
--   * raw JSONB holds the row VERBATIM — if a future row gains a field the
--     typed columns do not cover, the evidence still survives byte-exact.
--     The typed columns exist for the QUERIES the estate actually runs
--     (boot grouping, wall-clock ordering, band arithmetic), not to re-model
--     the row.
--   * NO UPDATE / NO DELETE paths are granted by this schema's design: the
--     only writes are INSERT (append) and SELECT (read). There is no
--     unique constraint on (boot_pid, at_ms) — two readings may share a
--     second, and the cooldown is the recorder's policy, not the store's.
--   * dev_tree_pid is NULL for pre-R86 rows — that null is HISTORY (the
--     provenance field did not exist), not missing data. Never backfill.
--   * corrupt lines (file era) have no pg equivalent — pg parses on write,
--     so a corrupt row is refused at the door. The reconciler (stage 2) is
--     where file-corrupt counts and pg refusals must be explained together.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS verdict_readings (
  id                BIGSERIAL PRIMARY KEY,
  at                TEXT        NOT NULL,              -- "YYYY-MM-DD HH:MM:SS UTC" display form, verbatim
  at_ms             BIGINT      NOT NULL,              -- epoch ms; the wall-clock curve's x
  boot_pid          INTEGER     NOT NULL,              -- serving worker pid (process.pid)
  dev_tree_pid      INTEGER,                           -- tree-root pid (bounces.jsonl namespace); NULL = pre-R86
  uptime_sec        DOUBLE PRECISION NOT NULL,
  boot_start_utc    TEXT,                              -- the journal's boot boundary the climb was cut at
  window_only       BOOLEAN     NOT NULL DEFAULT FALSE,
  climb_mb          DOUBLE PRECISION NOT NULL,
  requests          BIGINT      NOT NULL,
  req_per_min       DOUBLE PRECISION,
  mb_per_1k         DOUBLE PRECISION,                  -- NULL = FLAT-tier row (no ratio, by design)
  kind              TEXT        NOT NULL,              -- VerdictKind (see src/lib/verdict-tiers.ts)
  tone              TEXT        NOT NULL,              -- VerdictTone
  known_self_pct    DOUBLE PRECISION,
  residual_req      BIGINT,
  profile_next_key  TEXT,
  profile_next_count BIGINT,
  routes_tracked    INTEGER,
  raw               JSONB       NOT NULL               -- the row verbatim — the migration's honesty anchor
);

-- The estate's two real access patterns, and nothing speculative:
--   1. newest-first reads (the strip, the curve, the ledger GET)
--   2. per-boot chronological grouping (computeSettles / calibration)
CREATE INDEX IF NOT EXISTS verdict_readings_at_ms_idx    ON verdict_readings (at_ms DESC);
CREATE INDEX IF NOT EXISTS verdict_readings_boot_idx     ON verdict_readings (boot_pid, at_ms);
