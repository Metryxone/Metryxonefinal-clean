-- =====================================================================
-- Phase 3 — Contextual Scoring & Intelligent Benchmarking V2
-- Flag: contextualScoringV2 (default ON; FF_CONTEXTUAL_SCORING_V2=false)
--
-- 8 net-new tables, all additive. Namespaced under `cs_*` (contextual
-- scoring) / `cb_*` (contextual benchmark) to avoid collisions with
-- existing `bench_*`, `onto_*`, `m3_*`, etc. Re-runnable.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Normative context registry --------------------------------------------
CREATE TABLE IF NOT EXISTS competency_norm_contexts (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  context_key           TEXT         NOT NULL UNIQUE,
  role_id               TEXT,
  layer                 TEXT,
  industry              TEXT,
  geography             TEXT,
  org_maturity          TEXT,
  team_scale            TEXT,
  seniority_band        TEXT,
  experience_band       TEXT,
  metadata              JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_norm_ctx_lookup ON competency_norm_contexts(role_id, layer, industry);

-- 2) Dynamic cohorts (peer groups) -----------------------------------------
CREATE TABLE IF NOT EXISTS contextual_benchmark_cohorts (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_key            TEXT         NOT NULL UNIQUE,
  context_id            UUID         REFERENCES competency_norm_contexts(id) ON DELETE CASCADE,
  cohort_label          TEXT         NOT NULL,
  sample_size           INTEGER      NOT NULL DEFAULT 0,
  k_min                 INTEGER      NOT NULL DEFAULT 30,
  similarity_threshold  NUMERIC(4,3) NOT NULL DEFAULT 0.700,
  formed_from           JSONB        NOT NULL DEFAULT '[]'::jsonb,
  is_provisional        BOOLEAN      NOT NULL DEFAULT TRUE,
  computed_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cohort_ctx ON contextual_benchmark_cohorts(context_id, is_provisional);

-- 3) Per-competency percentile distributions -------------------------------
CREATE TABLE IF NOT EXISTS competency_percentile_distributions_v2 (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id             UUID         REFERENCES contextual_benchmark_cohorts(id) ON DELETE CASCADE,
  competency_code       TEXT         NOT NULL,
  sample_size           INTEGER      NOT NULL DEFAULT 0,
  p10                   NUMERIC(5,2),
  p25                   NUMERIC(5,2),
  p50                   NUMERIC(5,2),
  p75                   NUMERIC(5,2),
  p90                   NUMERIC(5,2),
  mean_value            NUMERIC(5,2),
  std_value             NUMERIC(5,2),
  confidence_interval   JSONB        NOT NULL DEFAULT '{}'::jsonb,
  computed_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pct_dist_lookup ON competency_percentile_distributions_v2(cohort_id, competency_code);

-- 4) Readiness models (thresholds per role x competency) -------------------
CREATE TABLE IF NOT EXISTS competency_readiness_models (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key             TEXT         NOT NULL UNIQUE,
  role_id               TEXT,
  layer                 TEXT,
  competency_code       TEXT         NOT NULL,
  threshold_emerging    NUMERIC(5,2) NOT NULL DEFAULT 40,
  threshold_developing  NUMERIC(5,2) NOT NULL DEFAULT 60,
  threshold_proficient  NUMERIC(5,2) NOT NULL DEFAULT 75,
  threshold_expert      NUMERIC(5,2) NOT NULL DEFAULT 88,
  model_version         TEXT         NOT NULL DEFAULT '3.0.0',
  metadata              JSONB        NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_readiness_lookup ON competency_readiness_models(role_id, layer, competency_code);

-- 5) Per-user growth velocity (longitudinal) -------------------------------
CREATE TABLE IF NOT EXISTS competency_growth_velocity (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               BIGINT       NOT NULL,
  competency_code       TEXT         NOT NULL,
  observation_window    TEXT         NOT NULL DEFAULT '90d',
  delta_score           NUMERIC(6,2),
  delta_per_week        NUMERIC(6,3),
  trajectory            TEXT,            -- 'improving' | 'stable' | 'declining'
  observations          INTEGER      NOT NULL DEFAULT 0,
  computed_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_velocity_user ON competency_growth_velocity(user_id, competency_code);

-- 6) Per-user, per-competency confidence profile ---------------------------
CREATE TABLE IF NOT EXISTS competency_confidence_profiles (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               BIGINT       NOT NULL,
  competency_code       TEXT         NOT NULL,
  raw_confidence        NUMERIC(4,3),
  stabilized_confidence NUMERIC(4,3),
  evidence_count        INTEGER      NOT NULL DEFAULT 0,
  variance              NUMERIC(6,3),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, competency_code)
);

-- 7) Reliability history (rolling SE / test-retest) ------------------------
CREATE TABLE IF NOT EXISTS competency_reliability_history (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               BIGINT       NOT NULL,
  competency_code       TEXT         NOT NULL,
  reliability_score     NUMERIC(4,3),
  standard_error        NUMERIC(6,3),
  test_count            INTEGER      NOT NULL DEFAULT 0,
  payload               JSONB        NOT NULL DEFAULT '{}'::jsonb,
  observed_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rel_hist_user ON competency_reliability_history(user_id, competency_code, observed_at);

-- 8) Per-request explainability log ---------------------------------------
CREATE TABLE IF NOT EXISTS scoring_explainability_v2 (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               BIGINT,
  competency_code       TEXT,
  endpoint              TEXT,
  log_type              TEXT         NOT NULL,
  rationale             TEXT         NOT NULL,
  payload               JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_score_explain_user ON scoring_explainability_v2(user_id, competency_code, created_at);

-- ── Seed: baseline readiness models for canonical 7-domain ───────────────
INSERT INTO competency_readiness_models (model_key, role_id, layer, competency_code, threshold_emerging, threshold_developing, threshold_proficient, threshold_expert)
VALUES
  ('rm_global_COG', NULL, NULL, 'COG', 40, 60, 75, 88),
  ('rm_global_COM', NULL, NULL, 'COM', 42, 62, 76, 88),
  ('rm_global_LEA', NULL, NULL, 'LEA', 45, 65, 78, 90),
  ('rm_global_EXE', NULL, NULL, 'EXE', 42, 62, 76, 88),
  ('rm_global_ADP', NULL, NULL, 'ADP', 40, 58, 74, 87),
  ('rm_global_TEC', NULL, NULL, 'TEC', 42, 62, 76, 89),
  ('rm_global_EIQ', NULL, NULL, 'EIQ', 40, 60, 75, 87),
  ('rm_lead_LEA',   NULL, 'leadership', 'LEA', 55, 70, 82, 92),
  ('rm_exec_EXE',   NULL, 'executive',  'EXE', 60, 74, 84, 93)
ON CONFLICT (model_key) DO NOTHING;

-- Seed: a global cohort placeholder so distribution endpoints have a target
INSERT INTO competency_norm_contexts (context_key, role_id, layer, industry, geography, org_maturity, team_scale, seniority_band, experience_band)
VALUES ('ctx_global_any', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (context_key) DO NOTHING;
