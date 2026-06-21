/**
 * Task #6 (Phase 6.1) — Commercial Architecture · lazy ensure-schema.
 *
 * Mirrors migration `migrations/20260621_commercial_architecture.sql` EXACTLY. There is no
 * migration runner in this project (see replit.md "canonical migration + lazy ensure-schema");
 * this is the runtime bootstrap. Idempotent (CREATE TABLE IF NOT EXISTS) — safe to call repeatedly.
 *
 * ADDITIVE ONLY: net-new tables in the EXISTING `comm_*` namespace. Runs the Task #5 spine
 * ensure-schema FIRST (the new tables FK into comm_products / comm_plans), then creates the SKU
 * layer, add-ons, and the entitlement framework. Never touches spine tables, the B2C stage ladder,
 * or the legacy subscription tables.
 */
import type { Pool } from 'pg';
import { ensureCommercialSchema } from './catalog-schema.js';

let schemaPromise: Promise<void> | null = null;

async function createSchema(pool: Pool): Promise<void> {
  // FK targets (comm_products / comm_plans) must exist first.
  await ensureCommercialSchema(pool);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS comm_skus (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sku_code    TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      product_id  UUID REFERENCES comm_products(id) ON DELETE CASCADE,
      plan_id     UUID REFERENCES comm_plans(id)    ON DELETE SET NULL,
      segment     TEXT NOT NULL DEFAULT 'career_builder'
        CHECK (segment IN ('career_builder','employer','institution','enterprise','government')),
      price_paise INTEGER,
      currency    TEXT NOT NULL DEFAULT 'INR',
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      metadata    JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comm_addons (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code             TEXT NOT NULL UNIQUE,
      name             TEXT NOT NULL,
      addon_type       TEXT NOT NULL DEFAULT 'feature_unlock'
        CHECK (addon_type IN ('feature_unlock','report_pack','seat_pack','usage_pack','support')),
      segment          TEXT NOT NULL DEFAULT 'career_builder'
        CHECK (segment IN ('career_builder','employer','institution','enterprise','government')),
      price_paise      INTEGER NOT NULL DEFAULT 0,
      currency         TEXT NOT NULL DEFAULT 'INR',
      billing_interval TEXT NOT NULL DEFAULT 'one_time'
        CHECK (billing_interval IN ('one_time','trial','monthly','quarterly','annual')),
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order       INTEGER NOT NULL DEFAULT 0,
      metadata         JSONB,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comm_sku_addons (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sku_id      UUID NOT NULL REFERENCES comm_skus(id)   ON DELETE CASCADE,
      addon_id    UUID NOT NULL REFERENCES comm_addons(id) ON DELETE CASCADE,
      quantity    INTEGER NOT NULL DEFAULT 1,
      is_included BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE (sku_id, addon_id)
    );

    CREATE TABLE IF NOT EXISTS comm_features (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code          TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      feature_class TEXT
        CHECK (feature_class IS NULL OR feature_class IN ('views','searches','reports','exports','assessments','ai','api')),
      description   TEXT,
      is_metered    BOOLEAN NOT NULL DEFAULT FALSE,
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      metadata      JSONB,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comm_plan_entitlements (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_id      UUID NOT NULL REFERENCES comm_plans(id)      ON DELETE CASCADE,
      feature_code TEXT NOT NULL REFERENCES comm_features(code) ON DELETE CASCADE,
      quota        INTEGER,
      quota_period TEXT NOT NULL DEFAULT 'monthly'
        CHECK (quota_period IN ('one_time','trial','monthly','quarterly','annual')),
      metadata     JSONB,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (plan_id, feature_code)
    );

    CREATE INDEX IF NOT EXISTS idx_comm_skus_product           ON comm_skus(product_id);
    CREATE INDEX IF NOT EXISTS idx_comm_skus_plan              ON comm_skus(plan_id);
    CREATE INDEX IF NOT EXISTS idx_comm_skus_segment           ON comm_skus(segment);
    CREATE INDEX IF NOT EXISTS idx_comm_addons_segment         ON comm_addons(segment);
    CREATE INDEX IF NOT EXISTS idx_comm_sku_addons_sku         ON comm_sku_addons(sku_id);
    CREATE INDEX IF NOT EXISTS idx_comm_features_class         ON comm_features(feature_class);
    CREATE INDEX IF NOT EXISTS idx_comm_plan_entitlements_plan ON comm_plan_entitlements(plan_id);
  `);
}

/** Idempotent, single-flight schema bootstrap. Safe to await on every request. */
export function ensureArchitectureSchema(pool: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = createSchema(pool).catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}
