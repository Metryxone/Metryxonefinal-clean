-- =====================================================================
-- Role DNA Runtime (Phase 2) — additive, append-only.
-- Flags: roleDNARuntimeEnabled / functionalCompetencySeeding /
--        contextualCompetencyResolution (all default OFF).
-- Namespace: role_dna_*, role_functional_*, role_behavioral_*,
--            role_cognitive_*, role_leadership_*, role_execution_*,
--            role_contextual_*, role_competency_seed_logs.
-- All NEW tables; no existing table modified.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Master role DNA profiles (append-only by dna_version) ------------
CREATE TABLE IF NOT EXISTS role_dna_master_profiles (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         TEXT         NOT NULL,
  role_title      TEXT         NOT NULL,
  industry_id     TEXT,
  layer_id        TEXT,
  dna_version     TEXT         NOT NULL DEFAULT '2.0.0',
  dna             JSONB        NOT NULL DEFAULT '{}'::jsonb,
  source          TEXT,
  generated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rdmp_role_time ON role_dna_master_profiles(role_id, generated_at DESC);

-- 2) Functional competencies per role (append-only by version) --------
CREATE TABLE IF NOT EXISTS role_functional_competencies (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         TEXT         NOT NULL,
  competency_id   TEXT         NOT NULL,
  competency_name TEXT         NOT NULL,
  bucket          TEXT         NOT NULL,        -- 'mandatory' | 'supporting' | 'adjacent' | 'emerging'
  priority        TEXT,                         -- 'critical' | 'high' | 'medium' | 'low'
  weight          NUMERIC(5,3),
  evidence_required BOOLEAN    NOT NULL DEFAULT FALSE,
  confidence_threshold NUMERIC(4,3),
  version         INTEGER      NOT NULL DEFAULT 1,
  recorded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rfc_role_time ON role_functional_competencies(role_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_rfc_role_bucket ON role_functional_competencies(role_id, bucket);

-- 3) Behavioral competencies per role ---------------------------------
CREATE TABLE IF NOT EXISTS role_behavioral_competencies (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         TEXT         NOT NULL,
  competency_id   TEXT         NOT NULL,
  competency_name TEXT         NOT NULL,
  priority        TEXT,
  weight          NUMERIC(5,3),
  rationale       TEXT,
  recorded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rbc_role_time ON role_behavioral_competencies(role_id, recorded_at DESC);

-- 4) Cognitive expectations per role ----------------------------------
CREATE TABLE IF NOT EXISTS role_cognitive_expectations (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         TEXT         NOT NULL,
  ability_id      TEXT         NOT NULL,
  ability_name    TEXT         NOT NULL,
  expected_level  NUMERIC(5,2),
  weight          NUMERIC(5,3),
  recorded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rce_role_time ON role_cognitive_expectations(role_id, recorded_at DESC);

-- 5) Leadership expectations per role ---------------------------------
CREATE TABLE IF NOT EXISTS role_leadership_expectations (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         TEXT         NOT NULL,
  expectation_key TEXT         NOT NULL,
  expectation_label TEXT       NOT NULL,
  priority        TEXT,
  weight          NUMERIC(5,3),
  scope           TEXT,                          -- 'team' | 'department' | 'function' | 'org'
  recorded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rle_role_time ON role_leadership_expectations(role_id, recorded_at DESC);

-- 6) Execution profiles per role --------------------------------------
CREATE TABLE IF NOT EXISTS role_execution_profiles (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         TEXT         NOT NULL,
  expectation_key TEXT         NOT NULL,
  expectation_label TEXT       NOT NULL,
  weight          NUMERIC(5,3),
  recorded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rep_role_time ON role_execution_profiles(role_id, recorded_at DESC);

-- 7) Contextual weights — modifier overlays applied at runtime --------
CREATE TABLE IF NOT EXISTS role_contextual_weights (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         TEXT         NOT NULL,
  context_axis    TEXT         NOT NULL,        -- 'industry' | 'org_maturity' | 'org_layer' | 'career_stage' | 'experience_years' | 'work_arrangement' | 'leadership_scope'
  context_value   TEXT         NOT NULL,
  competency_id   TEXT,                         -- null = applies to whole DNA
  weight_modifier NUMERIC(5,3) NOT NULL,        -- multiplicative; 1.000 = no change
  rationale       TEXT,
  recorded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rcw_role_axis ON role_contextual_weights(role_id, context_axis, context_value);

-- 8) Seed logs (append-only audit) ------------------------------------
CREATE TABLE IF NOT EXISTS role_competency_seed_logs (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         TEXT,
  correlation_id  UUID,
  operation       TEXT         NOT NULL,        -- 'resolve' | 'seed' | 'cache_invalidate'
  status          TEXT         NOT NULL,        -- 'success' | 'partial' | 'failed'
  shadow_mode     BOOLEAN      NOT NULL DEFAULT TRUE,
  duration_ms     INTEGER,
  inputs          JSONB        DEFAULT '{}'::jsonb,
  outputs         JSONB        DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rcsl_role_time ON role_competency_seed_logs(role_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_rcsl_corr ON role_competency_seed_logs(correlation_id);
