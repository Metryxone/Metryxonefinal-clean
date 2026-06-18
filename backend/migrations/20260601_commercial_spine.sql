-- ============================================================================
-- Task #5 — Commercial Runtime Spine (catalog · subscriptions · Razorpay test)
-- ----------------------------------------------------------------------------
-- ADDITIVE ONLY. New `comm_*` namespace. Does NOT touch the existing B2C stage
-- ladder (capadex_payments) or the legacy subscription_packages /
-- student_subscriptions tables — it runs alongside them.
--
-- Mirrored exactly by services/commercial/catalog-schema.ts ensureCommercialSchema().
-- All prices stored in PAISE (integer), currency default INR — matches the
-- existing capadex_payments.amount_paise convention.
-- ============================================================================

-- ── Catalog ─────────────────────────────────────────────────────────────────

-- A sellable product, scoped to one of the five business segments.
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

-- A pricing plan for a product (trial / one_time / monthly / quarterly / annual).
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

-- A bundle groups one or more plans, optionally at an override price.
CREATE TABLE IF NOT EXISTS comm_bundles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  description        TEXT,
  price_paise        INTEGER,          -- NULL → sum of member plan prices
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

-- A promotion is an optional campaign container that coupons can belong to.
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

-- A coupon is a user-entered code that yields a percent or flat discount.
CREATE TABLE IF NOT EXISTS comm_coupons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT NOT NULL UNIQUE,            -- stored upper-cased; matched case-insensitively
  description      TEXT,
  discount_type    TEXT NOT NULL DEFAULT 'percent'
    CHECK (discount_type IN ('percent','flat')),
  discount_value   INTEGER NOT NULL DEFAULT 0,      -- percent: 0-100 ; flat: paise
  currency         TEXT NOT NULL DEFAULT 'INR',
  min_amount_paise INTEGER NOT NULL DEFAULT 0,
  max_discount_paise INTEGER,                       -- caps a percent discount; NULL → uncapped
  max_redemptions  INTEGER,                         -- NULL → unlimited
  redeemed_count   INTEGER NOT NULL DEFAULT 0,
  applies_to       JSONB,                           -- {segments?:[], product_codes?:[], plan_codes?:[]}
  starts_at        TIMESTAMPTZ,
  ends_at          TIMESTAMPTZ,
  promotion_id     UUID REFERENCES comm_promotions(id) ON DELETE SET NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- An automatic discount rule (not code-entered) — e.g. first-time / volume / segment.
CREATE TABLE IF NOT EXISTS comm_discount_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  rule_type   TEXT NOT NULL DEFAULT 'segment'
    CHECK (rule_type IN ('first_time','volume','segment','seasonal')),
  config      JSONB,                                -- rule-specific params (threshold, percent, etc.)
  priority    INTEGER NOT NULL DEFAULT 0,
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Customers + Subscription lifecycle ───────────────────────────────────────

-- A customer record. EMAIL is the stable identity key (bridges the existing
-- email-keyed capadex_payments / capadex_sessions). user_id is an optional link
-- to the auth user; never coerced across id spaces.
CREATE TABLE IF NOT EXISTS comm_customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,                  -- stored lower-cased
  name       TEXT,
  phone      TEXT,
  segment    TEXT NOT NULL DEFAULT 'career_builder'
    CHECK (segment IN ('career_builder','employer','institution','enterprise','government')),
  user_id    TEXT,                                  -- optional auth-user link (TEXT, never numeric-coerced)
  razorpay_customer_id TEXT,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A subscription instance. A customer may hold many across segments.
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

-- APPEND-ONLY lifecycle event log. One row per transition — never mutated in place.
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

-- ── Razorpay TEST hardening ──────────────────────────────────────────────────

-- Exactly-once guard for verify + webhook. The unique key is the natural request
-- identifier (razorpay event id / `${scope}:${order_id}`). A repeat key returns the
-- stored response instead of re-running the side effect.
CREATE TABLE IF NOT EXISTS comm_idempotency_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  scope           TEXT NOT NULL,                    -- 'verify' | 'webhook' | ...
  status          TEXT NOT NULL DEFAULT 'completed' -- 'completed' | 'failed'
    CHECK (status IN ('completed','failed')),
  response        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Razorpay payment links issued for a plan / subscription.
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

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_comm_products_segment        ON comm_products(segment);
CREATE INDEX IF NOT EXISTS idx_comm_plans_product           ON comm_plans(product_id);
CREATE INDEX IF NOT EXISTS idx_comm_bundle_items_bundle     ON comm_bundle_items(bundle_id);
CREATE INDEX IF NOT EXISTS idx_comm_coupons_active          ON comm_coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_comm_customers_email         ON comm_customers(email);
CREATE INDEX IF NOT EXISTS idx_comm_subscriptions_customer  ON comm_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_comm_subscriptions_status    ON comm_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_comm_sub_events_sub          ON comm_subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_comm_payment_links_customer  ON comm_payment_links(customer_id);
