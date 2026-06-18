-- =====================================================================
-- Workforce OS V2 — additive depth on top of Phase 5 wos_*
-- Flag: workforceOSV2 (default ON; FF_WORKFORCE_OS_V2=false)
-- Namespace: wos_v2_*  (NEVER touches existing wos_* tables)
-- 6 new domain tables, one per V2 capability.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Market forecasting --------------------------------------------------
CREATE TABLE IF NOT EXISTS wos_v2_market_forecasts (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       INTEGER,
  signal_key      TEXT         NOT NULL,
  horizon_weeks   INTEGER      NOT NULL DEFAULT 12,
  trend           TEXT         NOT NULL,                -- 'accelerating' | 'stable' | 'cooling'
  current_value   NUMERIC(8,3),
  projected_value NUMERIC(8,3),
  delta_per_week  NUMERIC(8,3),
  confidence      NUMERIC(4,3) NOT NULL DEFAULT 0.6,
  payload         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  computed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wos_v2_forecasts ON wos_v2_market_forecasts(tenant_id, signal_key, computed_at);

-- 2) Workforce scenarios -------------------------------------------------
CREATE TABLE IF NOT EXISTS wos_v2_scenarios (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       INTEGER,
  scenario_name   TEXT         NOT NULL,
  inputs          JSONB        NOT NULL,
  outcomes        JSONB        NOT NULL,
  notes           TEXT,
  created_by      BIGINT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wos_v2_scenarios ON wos_v2_scenarios(tenant_id, created_at);

-- 3) Fairness drift monitoring ------------------------------------------
CREATE TABLE IF NOT EXISTS wos_v2_fairness_drift (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       INTEGER,
  suite_key       TEXT         NOT NULL,
  group_label     TEXT         NOT NULL,
  metric          TEXT         NOT NULL,           -- 'disparate_impact' | 'tpr_gap' | 'fpr_gap' etc.
  baseline_value  NUMERIC(6,3),
  current_value   NUMERIC(6,3),
  delta           NUMERIC(6,3),
  z_score         NUMERIC(6,3),
  is_significant  BOOLEAN      NOT NULL DEFAULT FALSE,
  observed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wos_v2_drift ON wos_v2_fairness_drift(tenant_id, suite_key, observed_at);

-- 4) Dispute SLA / escalation policy ------------------------------------
CREATE TABLE IF NOT EXISTS wos_v2_dispute_sla (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         INTEGER,
  dispute_type      TEXT         NOT NULL DEFAULT 'default',
  triage_hours      INTEGER      NOT NULL DEFAULT 24,
  resolve_hours     INTEGER      NOT NULL DEFAULT 120,
  escalation_chain  JSONB        NOT NULL DEFAULT '[]'::jsonb,
  active            BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, dispute_type)
);

-- 5) ABAC policy layer (attribute-based) --------------------------------
CREATE TABLE IF NOT EXISTS wos_v2_abac_policies (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       INTEGER,
  policy_key      TEXT         NOT NULL,
  resource        TEXT         NOT NULL,                 -- e.g. 'fairness:suite'
  action          TEXT         NOT NULL,                 -- e.g. 'read' | 'compute'
  condition_expr  JSONB        NOT NULL DEFAULT '{}'::jsonb,
  effect          TEXT         NOT NULL DEFAULT 'allow',  -- 'allow' | 'deny'
  priority        INTEGER      NOT NULL DEFAULT 100,
  active          BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, policy_key)
);
CREATE INDEX IF NOT EXISTS idx_wos_v2_abac ON wos_v2_abac_policies(tenant_id, resource, active);

-- 6) Learning ROI attribution + cohort longitudinal ---------------------
CREATE TABLE IF NOT EXISTS wos_v2_learning_attribution (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            INTEGER,
  intervention_key     TEXT         NOT NULL,
  cohort_label         TEXT         NOT NULL,
  cohort_size          INTEGER      NOT NULL DEFAULT 0,
  pre_score_mean       NUMERIC(6,2),
  post_score_mean      NUMERIC(6,2),
  delta_mean           NUMERIC(6,2),
  delta_sigma          NUMERIC(6,3),
  attribution_share    NUMERIC(4,3),
  cohen_d              NUMERIC(5,3),
  observation_weeks    INTEGER      NOT NULL DEFAULT 12,
  payload              JSONB        NOT NULL DEFAULT '{}'::jsonb,
  computed_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wos_v2_attribution ON wos_v2_learning_attribution(tenant_id, intervention_key, computed_at);

-- Seed: default SLA + ABAC sample
INSERT INTO wos_v2_dispute_sla (tenant_id, dispute_type, triage_hours, resolve_hours, escalation_chain)
VALUES (NULL, 'default', 24, 120, '["ops_lead","compliance_lead","exec_sponsor"]'::jsonb)
ON CONFLICT (tenant_id, dispute_type) DO NOTHING;

INSERT INTO wos_v2_abac_policies (tenant_id, policy_key, resource, action, condition_expr, effect, priority)
VALUES
  (NULL, 'allow_compliance_fairness_read', 'fairness:suite', 'read',
   '{"any": [{"attr":"role","op":"in","values":["compliance_lead","ops_lead"]}]}'::jsonb, 'allow', 50),
  (NULL, 'deny_export_pii', 'workforce:profile', 'export',
   '{"any": [{"attr":"contains_pii","op":"eq","values":[true]}]}'::jsonb, 'deny', 10)
ON CONFLICT (tenant_id, policy_key) DO NOTHING;
