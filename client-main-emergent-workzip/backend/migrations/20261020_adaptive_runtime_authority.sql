-- Phase 5 — Adaptive Runtime Authority + Intelligence Fusion + Contextual Scoring.
-- All tables are append-only audit / shadow surfaces. Never replace upstream
-- (user_competency_scores, cra_scores, ucip_*, etc.) Idempotent.

-- Per-fusion-run audit log: which sources contributed, weights, dispersion.
CREATE TABLE IF NOT EXISTS competency_fusion_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL,
  correlation_id    UUID NOT NULL,
  competency_id     TEXT NOT NULL,
  fused_score       NUMERIC(6,3),
  fused_confidence  NUMERIC(5,4),
  evidence_count    INTEGER NOT NULL DEFAULT 0,
  source_coverage   JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_weights    JSONB NOT NULL DEFAULT '{}'::jsonb,
  dispersion        NUMERIC(5,4),
  engine_version    TEXT NOT NULL,
  shadow_mode       BOOLEAN NOT NULL DEFAULT TRUE,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cfl_user_idx ON competency_fusion_logs (user_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS cfl_corr_idx ON competency_fusion_logs (correlation_id);

-- Per-competency confidence calibration audit: which signals drove the
-- confidence number (evidence diversity, decay, benchmark reliability, etc.).
CREATE TABLE IF NOT EXISTS confidence_calibration_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT NOT NULL,
  competency_id       TEXT NOT NULL,
  confidence          NUMERIC(5,4) NOT NULL,
  evidence_count      INTEGER NOT NULL DEFAULT 0,
  evidence_diversity  NUMERIC(5,4),
  source_coverage     JSONB NOT NULL DEFAULT '[]'::jsonb,
  decay_factor        NUMERIC(5,4),
  benchmark_confidence NUMERIC(5,4),
  last_validated_at   TIMESTAMPTZ,
  components          JSONB NOT NULL DEFAULT '{}'::jsonb,
  engine_version      TEXT NOT NULL,
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ccl_user_comp_idx ON confidence_calibration_logs (user_id, competency_id, computed_at DESC);

-- Per-user contextual scoring snapshot (one row per (user, correlation_id)).
CREATE TABLE IF NOT EXISTS contextual_scoring_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT NOT NULL,
  correlation_id      UUID NOT NULL,
  context_signature   TEXT,
  scored_competencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  overall_score       NUMERIC(6,3),
  overall_confidence  NUMERIC(5,4),
  authority_stage     TEXT NOT NULL DEFAULT 'shadow',
  engine_version      TEXT NOT NULL,
  shadow_mode         BOOLEAN NOT NULL DEFAULT TRUE,
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS csp_user_idx ON contextual_scoring_profiles (user_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS csp_corr_idx ON contextual_scoring_profiles (correlation_id);

-- Narrative library — append-only per (user, narrative_kind).
CREATE TABLE IF NOT EXISTS intelligence_narratives (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  narrative_kind  TEXT NOT NULL,
  headline        TEXT,
  body            TEXT,
  evidence_refs   JSONB NOT NULL DEFAULT '[]'::jsonb,
  language_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  engine_version  TEXT NOT NULL,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS inar_user_idx ON intelligence_narratives (user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS inar_kind_idx ON intelligence_narratives (user_id, narrative_kind, generated_at DESC);

-- Continuous competency memory — per (user, competency) per observation point.
CREATE TABLE IF NOT EXISTS competency_memory_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  competency_id   TEXT NOT NULL,
  score           NUMERIC(6,3),
  confidence      NUMERIC(5,4),
  delta_score     NUMERIC(6,3),
  delta_confidence NUMERIC(5,4),
  growth_velocity NUMERIC(6,3),
  drift_severity  TEXT,
  leadership_layer TEXT,
  readiness_band  TEXT,
  origin          TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  engine_version  TEXT NOT NULL,
  observed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cmh_user_comp_idx ON competency_memory_history (user_id, competency_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS cmh_user_obs_idx  ON competency_memory_history (user_id, observed_at DESC);

-- Runtime-authority migration ledger (stages 1..5).
CREATE TABLE IF NOT EXISTS runtime_authority_transitions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT,
  scope             TEXT NOT NULL DEFAULT 'global',
  from_stage        TEXT,
  to_stage          TEXT NOT NULL,
  trigger           TEXT,
  diff_summary      JSONB NOT NULL DEFAULT '{}'::jsonb,
  shadow_mode       BOOLEAN NOT NULL DEFAULT TRUE,
  engine_version    TEXT NOT NULL,
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rat_scope_idx ON runtime_authority_transitions (scope, occurred_at DESC);
CREATE INDEX IF NOT EXISTS rat_user_idx  ON runtime_authority_transitions (user_id, occurred_at DESC);
