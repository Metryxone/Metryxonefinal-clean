-- ============================================================================
-- Task #6 (Phase 6.1) — Commercial Architecture (SKU layer · Add-ons · Entitlement Framework)
-- ----------------------------------------------------------------------------
-- ADDITIVE ONLY. Net-new tables in the EXISTING `comm_*` namespace. EXTENDS the
-- Task #5 commercial spine (migrations/20260601_commercial_spine.sql) — it does
-- NOT touch the spine tables, the B2C stage ladder (capadex_payments), or the
-- legacy subscription_packages / student_subscriptions.
--
-- Structure:  Product (comm_products) → Plan (comm_plans)
--                → SKU (comm_skus, a sellable stock-keeping unit = product + plan)
--                → Add-ons (comm_addons, linked via comm_sku_addons)
--                → Entitlements (comm_features + comm_plan_entitlements)
--                → Usage (existing comm_usage_events)
--
-- The Entitlement Framework promotes the code-only feature vocabulary in
-- services/commercial/plan-features.ts (FEATURE_CLASSES) to first-class catalog
-- DATA: comm_features = the named-feature catalog; comm_plan_entitlements = the
-- explicit plan→feature(+quota) mapping (previously only declared in
-- comm_plans.metadata JSONB; that path stays valid and is unioned at read time).
--
-- Mirrored EXACTLY by services/commercial/architecture-schema.ts
-- ensureArchitectureSchema(). All prices in PAISE (integer), currency default INR.
-- ============================================================================

-- ── SKU layer (sku_master) ───────────────────────────────────────────────────
-- A SKU is a sellable stock-keeping unit: a product paired with a pricing plan.
-- price_paise NULL → inherit the plan's price (no override).
CREATE TABLE IF NOT EXISTS comm_skus (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_code    TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  product_id  UUID REFERENCES comm_products(id) ON DELETE CASCADE,
  plan_id     UUID REFERENCES comm_plans(id)    ON DELETE SET NULL,
  segment     TEXT NOT NULL DEFAULT 'career_builder'
    CHECK (segment IN ('career_builder','employer','institution','enterprise','government')),
  price_paise INTEGER,                 -- NULL → inherit member plan price
  currency    TEXT NOT NULL DEFAULT 'INR',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Add-ons ──────────────────────────────────────────────────────────────────
-- An optional purchasable extra. metadata MAY declare {feature_classes,quotas}
-- (parsed by the SAME plan-features.ts parser) so an add-on can grant entitlements.
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

-- A SKU may bundle (is_included=true) or merely offer (is_included=false) add-ons.
CREATE TABLE IF NOT EXISTS comm_sku_addons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id      UUID NOT NULL REFERENCES comm_skus(id)   ON DELETE CASCADE,
  addon_id    UUID NOT NULL REFERENCES comm_addons(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 1,
  is_included BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (sku_id, addon_id)
);

-- ── Entitlement Framework ─────────────────────────────────────────────────────
-- The named-feature catalog. feature_class (when set) maps to one of the seven
-- canonical FEATURE_CLASSES (plan-features.ts); NULL → a named feature outside the
-- metered classes. is_metered marks features tracked via comm_usage_events.
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

-- Explicit plan → feature(+quota) grant. quota NULL → unlimited.
CREATE TABLE IF NOT EXISTS comm_plan_entitlements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      UUID NOT NULL REFERENCES comm_plans(id)      ON DELETE CASCADE,
  feature_code TEXT NOT NULL REFERENCES comm_features(code) ON DELETE CASCADE,
  quota        INTEGER,               -- NULL → unlimited
  quota_period TEXT NOT NULL DEFAULT 'monthly'
    CHECK (quota_period IN ('one_time','trial','monthly','quarterly','annual')),
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, feature_code)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_comm_skus_product         ON comm_skus(product_id);
CREATE INDEX IF NOT EXISTS idx_comm_skus_plan            ON comm_skus(plan_id);
CREATE INDEX IF NOT EXISTS idx_comm_skus_segment         ON comm_skus(segment);
CREATE INDEX IF NOT EXISTS idx_comm_addons_segment       ON comm_addons(segment);
CREATE INDEX IF NOT EXISTS idx_comm_sku_addons_sku       ON comm_sku_addons(sku_id);
CREATE INDEX IF NOT EXISTS idx_comm_features_class       ON comm_features(feature_class);
CREATE INDEX IF NOT EXISTS idx_comm_plan_entitlements_plan ON comm_plan_entitlements(plan_id);
