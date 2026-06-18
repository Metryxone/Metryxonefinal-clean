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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comm_usage_events (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email           TEXT NOT NULL,
      subscription_id UUID,
      usage_type      TEXT NOT NULL
        CHECK (usage_type IN ('views','searches','unlocks','assessments','downloads','exports','api')),
      quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      metadata        JSONB,
      occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_comm_usage_email      ON comm_usage_events(lower(email));
    CREATE INDEX IF NOT EXISTS idx_comm_usage_type       ON comm_usage_events(usage_type);
    CREATE INDEX IF NOT EXISTS idx_comm_usage_occurred   ON comm_usage_events(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_comm_usage_email_type ON comm_usage_events(lower(email), usage_type);
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
