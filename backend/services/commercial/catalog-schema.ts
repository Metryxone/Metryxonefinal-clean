/**
 * Task #5 — Commercial Runtime Spine · lazy ensure-schema.
 *
 * Mirrors migration `migrations/20260601_commercial_spine.sql` EXACTLY. There is no migration
 * runner in this project (see replit.md "canonical migration + lazy ensure-schema"); this is the
 * runtime bootstrap. Idempotent (CREATE TABLE IF NOT EXISTS) — safe to call repeatedly.
 *
 * ADDITIVE ONLY: `comm_*` namespace, alongside (never touching) the existing B2C stage ladder
 * (capadex_payments) and legacy subscription_packages / student_subscriptions.
 */
import type { Pool } from 'pg';

let schemaPromise: Promise<void> | null = null;

async function createSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comm_products (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code        TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      segment     TEXT NOT NULL DEFAULT 'career_builder'
        CHECK (segment IN ('career_builder','employer','institution','enterprise','government')),
      description TEXT,
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      metadata    JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comm_plans (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id       UUID NOT NULL REFERENCES comm_products(id) ON DELETE CASCADE,
      code             TEXT NOT NULL UNIQUE,
      name             TEXT NOT NULL,
      billing_interval TEXT NOT NULL DEFAULT 'monthly'
        CHECK (billing_interval IN ('one_time','trial','monthly','quarterly','annual')),
      interval_count   INTEGER NOT NULL DEFAULT 1,
      price_paise      INTEGER NOT NULL DEFAULT 0,
      currency         TEXT NOT NULL DEFAULT 'INR',
      trial_days       INTEGER NOT NULL DEFAULT 0,
      razorpay_plan_id TEXT,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order       INTEGER NOT NULL DEFAULT 0,
      metadata         JSONB,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comm_bundles (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code               TEXT NOT NULL UNIQUE,
      name               TEXT NOT NULL,
      description        TEXT,
      price_paise        INTEGER,
      currency           TEXT NOT NULL DEFAULT 'INR',
      is_active          BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order         INTEGER NOT NULL DEFAULT 0,
      metadata           JSONB,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comm_bundle_items (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bundle_id  UUID NOT NULL REFERENCES comm_bundles(id) ON DELETE CASCADE,
      plan_id    UUID NOT NULL REFERENCES comm_plans(id)   ON DELETE CASCADE,
      quantity   INTEGER NOT NULL DEFAULT 1,
      UNIQUE (bundle_id, plan_id)
    );

    CREATE TABLE IF NOT EXISTS comm_promotions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code        TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      description TEXT,
      starts_at   TIMESTAMPTZ,
      ends_at     TIMESTAMPTZ,
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      metadata    JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comm_coupons (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code             TEXT NOT NULL UNIQUE,
      description      TEXT,
      discount_type    TEXT NOT NULL DEFAULT 'percent'
        CHECK (discount_type IN ('percent','flat')),
      discount_value   INTEGER NOT NULL DEFAULT 0,
      currency         TEXT NOT NULL DEFAULT 'INR',
      min_amount_paise INTEGER NOT NULL DEFAULT 0,
      max_discount_paise INTEGER,
      max_redemptions  INTEGER,
      redeemed_count   INTEGER NOT NULL DEFAULT 0,
      applies_to       JSONB,
      starts_at        TIMESTAMPTZ,
      ends_at          TIMESTAMPTZ,
      promotion_id     UUID REFERENCES comm_promotions(id) ON DELETE SET NULL,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      metadata         JSONB,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comm_discount_rules (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code        TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      rule_type   TEXT NOT NULL DEFAULT 'segment'
        CHECK (rule_type IN ('first_time','volume','segment','seasonal')),
      config      JSONB,
      priority    INTEGER NOT NULL DEFAULT 0,
      starts_at   TIMESTAMPTZ,
      ends_at     TIMESTAMPTZ,
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      metadata    JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comm_customers (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email      TEXT NOT NULL UNIQUE,
      name       TEXT,
      phone      TEXT,
      segment    TEXT NOT NULL DEFAULT 'career_builder'
        CHECK (segment IN ('career_builder','employer','institution','enterprise','government')),
      user_id    TEXT,
      razorpay_customer_id TEXT,
      metadata   JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comm_subscriptions (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id         UUID NOT NULL REFERENCES comm_customers(id) ON DELETE CASCADE,
      plan_id             UUID REFERENCES comm_plans(id)   ON DELETE SET NULL,
      bundle_id           UUID REFERENCES comm_bundles(id) ON DELETE SET NULL,
      segment             TEXT NOT NULL DEFAULT 'career_builder'
        CHECK (segment IN ('career_builder','employer','institution','enterprise','government')),
      status              TEXT NOT NULL DEFAULT 'trial'
        CHECK (status IN ('trial','active','past_due','cancelled','expired')),
      billing_interval    TEXT NOT NULL DEFAULT 'monthly'
        CHECK (billing_interval IN ('one_time','trial','monthly','quarterly','annual')),
      current_period_start TIMESTAMPTZ,
      current_period_end   TIMESTAMPTZ,
      trial_end            TIMESTAMPTZ,
      cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
      razorpay_subscription_id TEXT,
      started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      cancelled_at        TIMESTAMPTZ,
      metadata            JSONB,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comm_subscription_events (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subscription_id UUID NOT NULL REFERENCES comm_subscriptions(id) ON DELETE CASCADE,
      customer_id     UUID NOT NULL REFERENCES comm_customers(id)     ON DELETE CASCADE,
      event_type      TEXT NOT NULL
        CHECK (event_type IN ('created','trial_started','activated','renewed','upgraded',
                              'downgraded','cancelled','expired','payment_succeeded','payment_failed')),
      from_status     TEXT,
      to_status       TEXT,
      from_plan_id    UUID,
      to_plan_id      UUID,
      amount_paise    INTEGER,
      metadata        JSONB,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comm_idempotency_keys (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      idempotency_key TEXT NOT NULL UNIQUE,
      scope           TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'completed'
        CHECK (status IN ('completed','failed')),
      response        JSONB,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS comm_payment_links (
      id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id            UUID REFERENCES comm_customers(id)     ON DELETE SET NULL,
      plan_id                UUID REFERENCES comm_plans(id)         ON DELETE SET NULL,
      subscription_id        UUID REFERENCES comm_subscriptions(id) ON DELETE SET NULL,
      email                  TEXT,
      amount_paise           INTEGER NOT NULL,
      currency               TEXT NOT NULL DEFAULT 'INR',
      razorpay_payment_link_id TEXT,
      short_url              TEXT,
      reference_id           TEXT,
      status                 TEXT NOT NULL DEFAULT 'created'
        CHECK (status IN ('created','paid','cancelled','expired')),
      metadata               JSONB,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- ── Payment Engine (Phase 6.3) — subscription refund ledger + customer credit wallet ──
    -- comm_subscriptions carry no refund ledger; comm_refunds is the append-only refund evidence
    -- (a refund is a financial event, NOT a lifecycle status change — no comm_subscription_events row).
    CREATE TABLE IF NOT EXISTS comm_refunds (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subscription_id     UUID NOT NULL REFERENCES comm_subscriptions(id) ON DELETE CASCADE,
      customer_id         UUID NOT NULL REFERENCES comm_customers(id)     ON DELETE CASCADE,
      amount_paise        INTEGER NOT NULL CHECK (amount_paise > 0),
      currency            TEXT NOT NULL DEFAULT 'INR',
      reason              TEXT,
      status              TEXT NOT NULL DEFAULT 'processed'
        CHECK (status IN ('processed','pending','failed')),
      razorpay_payment_id TEXT,
      razorpay_refund_id  TEXT,
      is_demo             BOOLEAN NOT NULL DEFAULT FALSE,
      metadata            JSONB,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Append-only customer credit wallet. Balance is DERIVED (SUM of credit − debit); never a stored
    -- mutable column. Each row snapshots balance_after_paise for an auditable running ledger.
    CREATE TABLE IF NOT EXISTS comm_credit_ledger (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id         UUID NOT NULL REFERENCES comm_customers(id) ON DELETE CASCADE,
      entry_type          TEXT NOT NULL CHECK (entry_type IN ('credit','debit')),
      amount_paise        INTEGER NOT NULL CHECK (amount_paise > 0),
      currency            TEXT NOT NULL DEFAULT 'INR',
      reason              TEXT,
      ref_type            TEXT,
      ref_id              TEXT,
      balance_after_paise INTEGER NOT NULL,
      metadata            JSONB,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_comm_refunds_sub            ON comm_refunds(subscription_id);
    CREATE INDEX IF NOT EXISTS idx_comm_refunds_customer       ON comm_refunds(customer_id);
    CREATE INDEX IF NOT EXISTS idx_comm_credit_ledger_customer ON comm_credit_ledger(customer_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_comm_products_segment        ON comm_products(segment);
    CREATE INDEX IF NOT EXISTS idx_comm_plans_product           ON comm_plans(product_id);
    CREATE INDEX IF NOT EXISTS idx_comm_bundle_items_bundle     ON comm_bundle_items(bundle_id);
    CREATE INDEX IF NOT EXISTS idx_comm_coupons_active          ON comm_coupons(is_active);
    CREATE INDEX IF NOT EXISTS idx_comm_customers_email         ON comm_customers(email);
    CREATE INDEX IF NOT EXISTS idx_comm_subscriptions_customer  ON comm_subscriptions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_comm_subscriptions_status    ON comm_subscriptions(status);
    CREATE INDEX IF NOT EXISTS idx_comm_sub_events_sub          ON comm_subscription_events(subscription_id);
    CREATE INDEX IF NOT EXISTS idx_comm_payment_links_customer  ON comm_payment_links(customer_id);
  `);
}

/** Idempotent, single-flight schema bootstrap. Safe to await on every request. */
export function ensureCommercialSchema(pool: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = createSchema(pool).catch((err) => {
      // Reset so a transient failure can be retried on the next request (don't cache the rejection).
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}
