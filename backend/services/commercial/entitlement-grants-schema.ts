/**
 * Task #7 — Manual entitlement grants · lazy ensure-schema.
 *
 * Mirrors migration `migrations/20260617_commercial_entitlement_metering.sql` (the
 * comm_entitlement_grants portion) EXACTLY. There is no migration runner in this project
 * (see replit.md "canonical migration + lazy ensure-schema"); this is the runtime bootstrap.
 * Idempotent (CREATE TABLE IF NOT EXISTS) — safe to call repeatedly.
 *
 * ADDITIVE ONLY: created ONLY when `commercialEntitlementClasses` is ON (the route gates the call),
 * so with the flag OFF this table never exists → byte-identical legacy schema.
 *
 * A grant is a super-admin manual override that UNIONS a feature class onto a billing identity's
 * derived entitlement. It NEVER revokes a ledger-derived entitlement (union model, additive only).
 */
import type { Pool } from 'pg';

let schemaPromise: Promise<void> | null = null;

async function createSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comm_entitlement_grants (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email       TEXT NOT NULL,
      feature     TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','revoked')),
      reason      TEXT,
      granted_by  TEXT,
      expires_at  TIMESTAMPTZ,
      revoked_by  TEXT,
      revoked_at  TIMESTAMPTZ,
      metadata    JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_comm_ent_grants_email  ON comm_entitlement_grants(lower(email));
    CREATE INDEX IF NOT EXISTS idx_comm_ent_grants_status ON comm_entitlement_grants(status);
  `);
}

/** Idempotent, single-flight schema bootstrap. Safe to await on every request. */
export function ensureEntitlementGrantsSchema(pool: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = createSchema(pool).catch((err) => {
      schemaPromise = null; // allow retry on a transient failure (don't cache the rejection)
      throw err;
    });
  }
  return schemaPromise;
}
