/**
 * Task #7 — Usage metering ledger · lazy ensure-schema.
 *
 * Mirrors migration `migrations/20260617_commercial_entitlement_metering.sql` (the comm_usage_events
 * portion) EXACTLY. No migration runner — this is the runtime bootstrap. Idempotent.
 *
 * ADDITIVE ONLY: created ONLY when `commercialUsageMetering` is ON (the route gates the call), so with
 * the flag OFF this table never exists → byte-identical legacy schema.
 *
 * An append-only event ledger: one row per metered action. Quotas are evaluated by COUNTing rows in
 * the current billing period (see metering-engine.ts) — we never mutate or pre-aggregate, so the
 * ledger stays auditable.
 */
import type { Pool } from 'pg';

let schemaPromise: Promise<void> | null = null;

async function createSchema(pool: Pool): Promise<void> {
  // Fresh DBs get the full Phase 6.5 vocabulary in the CHECK. Existing DBs created with the original
  // 7-type CHECK are widened idempotently by the DO-block below (CREATE TABLE IF NOT EXISTS is a no-op
  // there). The DO-block only ALTERs when the new vocabulary is not yet present, so it is cheap after
  // the first run and never drops/recreates the constraint on every request.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comm_usage_events (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email           TEXT NOT NULL,
      subscription_id UUID,
      usage_type      TEXT NOT NULL
        CHECK (usage_type IN ('views','searches','unlocks','assessments','downloads','exports','api',
                              'candidates','jobs','employers','institutions','storage')),
      quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      metadata        JSONB,
      occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_comm_usage_email      ON comm_usage_events(lower(email));
    CREATE INDEX IF NOT EXISTS idx_comm_usage_type       ON comm_usage_events(usage_type);
    CREATE INDEX IF NOT EXISTS idx_comm_usage_occurred   ON comm_usage_events(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_comm_usage_email_type ON comm_usage_events(lower(email), usage_type);

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'comm_usage_events'::regclass
           AND conname  = 'comm_usage_events_usage_type_check'
           AND pg_get_constraintdef(oid) LIKE '%institutions%'
      ) THEN
        ALTER TABLE comm_usage_events DROP CONSTRAINT IF EXISTS comm_usage_events_usage_type_check;
        ALTER TABLE comm_usage_events ADD CONSTRAINT comm_usage_events_usage_type_check
          CHECK (usage_type IN ('views','searches','unlocks','assessments','downloads','exports','api',
                                'candidates','jobs','employers','institutions','storage'));
      END IF;
    END $$;

    -- Per-identity quota OVERRIDES: a limit that applies to ONE identity for a usage type regardless of
    -- their plan, taking precedence over any plan-declared quota in resolveQuotaWindow. Keyed uniquely by
    -- (lower(email), usage_type) so an upsert replaces the standing override. Absent row = no override
    -- (the identity falls back to their plan quota). Created only when metering is ON → byte-identical OFF.
    CREATE TABLE IF NOT EXISTS comm_usage_overrides (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email       TEXT NOT NULL,
      usage_type  TEXT NOT NULL
        CHECK (usage_type IN ('views','searches','unlocks','assessments','downloads','exports','api',
                              'candidates','jobs','employers','institutions','storage')),
      limit_value INTEGER NOT NULL CHECK (limit_value >= 0),
      note        TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_usage_overrides_identity
      ON comm_usage_overrides (lower(email), usage_type);
  `);
}

/** Idempotent, single-flight schema bootstrap. Safe to await on every request. */
export function ensureMeteringSchema(pool: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = createSchema(pool).catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}
