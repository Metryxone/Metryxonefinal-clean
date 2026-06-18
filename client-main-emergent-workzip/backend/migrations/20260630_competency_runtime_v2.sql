-- =====================================================================
-- Competency Runtime V2 — additive foundation for contextual,
-- ontology-driven competency intelligence.
--
-- Strictly additive. Does not touch onto_*, bench_*, mobility_*,
-- m3_*, m4_*, m5_*, wos_*, cra_*, p4_*, or existing competency tables.
-- Safe to re-run (all CREATE statements use IF NOT EXISTS).
-- =====================================================================

-- ── 1) Runtime context (per assessment session) ─────────────────────
-- NOTE: industry_id / function_id / sub_function_id / role_id / layer_id /
-- complexity_model_id are TEXT because the V2 runtime accepts BOTH semantic
-- tokens ("ai_ml", "leadership", "startup") AND real UUIDs from the
-- ontology. The runtime gracefully degrades when no UUID match is found.
CREATE TABLE IF NOT EXISTS competency_runtime_contexts (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               BIGINT       NOT NULL,
  industry_id           TEXT,
  function_id           TEXT,
  sub_function_id       TEXT,
  role_id               TEXT,
  layer_id              TEXT,
  complexity_model_id   TEXT,
  geography             TEXT,
  org_maturity          TEXT,
  team_scale            TEXT,
  seniority_band        TEXT,
  assessment_mode       TEXT,
  runtime_version       TEXT         NOT NULL DEFAULT '2.0.0',
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crc_user     ON competency_runtime_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_crc_role     ON competency_runtime_contexts(role_id);
CREATE INDEX IF NOT EXISTS idx_crc_industry ON competency_runtime_contexts(industry_id);

-- ── 2) Role DNA Profiles V2 (contextual DNA models) ─────────────────
CREATE TABLE IF NOT EXISTS role_dna_profiles_v2 (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id               TEXT         NOT NULL,
  industry_id           TEXT,
  layer_id              TEXT,
  complexity_model_id   TEXT,
  dna_name              TEXT,
  dna_description       TEXT,
  dna_version           TEXT         NOT NULL DEFAULT '2.0.0',
  readiness_model       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  behavioral_model      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  technical_model       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  leadership_model      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  strategic_model       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  execution_model       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  default_weightings    JSONB        NOT NULL DEFAULT '{}'::jsonb,
  expected_levels       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  confidence_model      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  metadata              JSONB        NOT NULL DEFAULT '{}'::jsonb,
  is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_role_dna_role     ON role_dna_profiles_v2(role_id);
CREATE INDEX IF NOT EXISTS idx_role_dna_layer    ON role_dna_profiles_v2(layer_id);
CREATE INDEX IF NOT EXISTS idx_role_dna_industry ON role_dna_profiles_v2(industry_id);

-- ── 3) Runtime Weights (per resolved DNA) ───────────────────────────
CREATE TABLE IF NOT EXISTS competency_runtime_weights (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  role_dna_id           UUID,
  competency_id         TEXT,
  competency_code       TEXT,
  importance_weight     NUMERIC(5,2),
  expected_level        NUMERIC(5,2),
  minimum_threshold     NUMERIC(5,2),
  growth_priority       NUMERIC(5,2),
  criticality           TEXT,
  weighting_reason      TEXT,
  weighting_context     JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_runtime_weights_role_dna  ON competency_runtime_weights(role_dna_id);
CREATE INDEX IF NOT EXISTS idx_runtime_weights_competency ON competency_runtime_weights(competency_id);

-- ── 4) Context Modifiers (industry / layer / complexity / etc.) ─────
CREATE TABLE IF NOT EXISTS competency_context_modifiers (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_type         TEXT         NOT NULL,
  modifier_name         TEXT         NOT NULL,
  modifier_target       TEXT,
  modifier_effect       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  adjustment_weight     NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  active                BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(modifier_type, modifier_name)
);
CREATE INDEX IF NOT EXISTS idx_ccm_type   ON competency_context_modifiers(modifier_type);
CREATE INDEX IF NOT EXISTS idx_ccm_active ON competency_context_modifiers(active) WHERE active = TRUE;

-- ── 5) Resolution History (audit trail) ─────────────────────────────
CREATE TABLE IF NOT EXISTS competency_resolution_history (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               BIGINT,
  runtime_context_id    UUID,
  resolved_role_dna_id  UUID,
  resolution_inputs     JSONB        NOT NULL DEFAULT '{}'::jsonb,
  resolution_outputs    JSONB        NOT NULL DEFAULT '{}'::jsonb,
  confidence_score      NUMERIC(5,2),
  explainability        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crh_user    ON competency_resolution_history(user_id);
CREATE INDEX IF NOT EXISTS idx_crh_context ON competency_resolution_history(runtime_context_id);
CREATE INDEX IF NOT EXISTS idx_crh_dna     ON competency_resolution_history(resolved_role_dna_id);

-- =====================================================================
-- Seed: context modifiers (idempotent via UNIQUE(modifier_type, name))
-- modifier_effect is a JSONB envelope:
--   {
--     "weight_multipliers": { "<competency_code>": <factor>, ... },
--     "expected_level_delta": { "<competency_code>": <delta>, ... },
--     "intensity_delta": <number>           -- adjusts assessment intensity
--   }
-- =====================================================================
INSERT INTO competency_context_modifiers (modifier_type, modifier_name, modifier_target, modifier_effect, adjustment_weight)
VALUES
  ('org_maturity', 'startup',     'org_maturity:startup',
    '{"weight_multipliers":{"ADP":1.25,"EXE":1.20,"COG":1.10},"expected_level_delta":{"ADP":5,"EXE":5},"intensity_delta":-0.05}'::jsonb, 1.10),

  ('org_maturity', 'enterprise',  'org_maturity:enterprise',
    '{"weight_multipliers":{"LEA":1.15,"COM":1.10,"EXE":1.05},"expected_level_delta":{"LEA":4,"COM":3},"intensity_delta":0.05}'::jsonb, 1.05),

  ('industry',     'regulated',   'industry:regulated',
    '{"weight_multipliers":{"COG":1.10,"EIQ":1.05},"expected_level_delta":{"COG":3},"intensity_delta":0.08}'::jsonb, 1.08),

  ('industry',     'healthcare',  'industry:healthcare',
    '{"weight_multipliers":{"EIQ":1.20,"COM":1.15,"COG":1.05},"expected_level_delta":{"EIQ":5,"COM":4},"intensity_delta":0.05}'::jsonb, 1.10),

  ('industry',     'ai_ml',       'industry:ai_ml',
    '{"weight_multipliers":{"TEC":1.30,"COG":1.20,"ADP":1.10},"expected_level_delta":{"TEC":6,"COG":5},"intensity_delta":0.05}'::jsonb, 1.15),

  ('layer',        'leadership',  'layer:leadership',
    '{"weight_multipliers":{"LEA":1.30,"COM":1.20,"EIQ":1.10},"expected_level_delta":{"LEA":8,"COM":5},"intensity_delta":0.05}'::jsonb, 1.15),

  ('layer',        'executive',   'layer:executive',
    '{"weight_multipliers":{"LEA":1.40,"COM":1.25,"COG":1.15,"EIQ":1.15},"expected_level_delta":{"LEA":12,"COM":8,"COG":5},"intensity_delta":0.10}'::jsonb, 1.20),

  ('layer',        'managerial',  'layer:managerial',
    '{"weight_multipliers":{"LEA":1.20,"EXE":1.15,"COM":1.10},"expected_level_delta":{"LEA":6,"EXE":4},"intensity_delta":0.03}'::jsonb, 1.10),

  ('layer',        'specialist',  'layer:specialist',
    '{"weight_multipliers":{"TEC":1.25,"COG":1.10,"ADP":1.05},"expected_level_delta":{"TEC":6,"COG":3},"intensity_delta":0.00}'::jsonb, 1.10)
ON CONFLICT (modifier_type, modifier_name) DO NOTHING;
