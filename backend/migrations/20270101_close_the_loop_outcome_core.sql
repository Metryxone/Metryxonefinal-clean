-- Task #292 — Close-the-Loop Outcome Core (additive, flag-gated `closeTheLoop`).
--
-- These three tables are the WRITE substrate of the close-the-loop spine. They are created
-- ONLY by the lazy ensure-schema on a flag-ON write path; when the flag is OFF the ensure-schema
-- is never reached, so OFF is byte-identical incl. schema (no table is created).
--
-- Honesty contract carried in the schema:
--   - Realized outcomes are ATTRIBUTED to a product capability (`capability_key`) and a CAPADEX
--     lifecycle stage (`lifecycle_stage`) — the attribution dimension the legacy
--     validation_loop_outcomes intake lacks. The binary types additionally bridge into
--     validation_loop_outcomes so the existing calibration surfaces stay connected (no parallel math).
--   - `is_demo` rows (@example.com / explicit) are recorded but EXCLUDED from every realized/evidence
--     figure by the composer. They are never deleted.
--   - Idempotent on (outcome_type, ref_id) / (trigger, ref_id) so re-processing a decision is safe.
--   - A prediction is stored ONLY when finite in [0,1]; else NULL (Coverage-only, never a fake pair).

CREATE TABLE IF NOT EXISTS close_the_loop_outcomes (
  id                          BIGSERIAL PRIMARY KEY,
  subject_email               TEXT        NOT NULL,
  subject_user_id             TEXT,
  capability_key              TEXT        NOT NULL,
  lifecycle_stage             TEXT,                                  -- CAP_CUR/CAP_INS/CAP_GRW/CAP_MAS or NULL
  outcome_type                TEXT        NOT NULL,                  -- hiring/performance/promotion/retention/career/learning
  outcome_kind                TEXT        NOT NULL DEFAULT 'binary', -- binary | continuous
  outcome_value               DOUBLE PRECISION NOT NULL,
  predicted_prob_at_decision  DOUBLE PRECISION,                     -- [0,1] or NULL
  predicted_basis             TEXT,
  decision_at                 TIMESTAMPTZ,
  observed_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  source                      TEXT        NOT NULL DEFAULT 'manual',
  is_demo                     BOOLEAN     NOT NULL DEFAULT false,
  ref_id                      TEXT,
  detail                      JSONB       NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_ctl_outcomes_type_ref
  ON close_the_loop_outcomes (outcome_type, ref_id) WHERE ref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_ctl_outcomes_capability ON close_the_loop_outcomes (capability_key);
CREATE INDEX IF NOT EXISTS ix_ctl_outcomes_stage      ON close_the_loop_outcomes (lifecycle_stage);
CREATE INDEX IF NOT EXISTS ix_ctl_outcomes_demo       ON close_the_loop_outcomes (is_demo);
CREATE INDEX IF NOT EXISTS ix_ctl_outcomes_observed   ON close_the_loop_outcomes (observed_at);

CREATE TABLE IF NOT EXISTS close_the_loop_remeasurements (
  id                    BIGSERIAL PRIMARY KEY,
  subject_email         TEXT        NOT NULL,
  subject_user_id       TEXT,
  capability_key        TEXT        NOT NULL,
  assessment_ref        TEXT,
  trigger               TEXT        NOT NULL,                  -- exit | continuous | progress
  baseline_score        DOUBLE PRECISION,
  remeasured_score      DOUBLE PRECISION,
  delta                 DOUBLE PRECISION,
  lifecycle_stage_from  TEXT,
  lifecycle_stage_to    TEXT,
  observed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  source                TEXT        NOT NULL DEFAULT 'manual',
  is_demo               BOOLEAN     NOT NULL DEFAULT false,
  ref_id                TEXT,
  detail                JSONB       NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_ctl_remeas_trigger_ref
  ON close_the_loop_remeasurements (trigger, ref_id) WHERE ref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_ctl_remeas_capability ON close_the_loop_remeasurements (capability_key);
CREATE INDEX IF NOT EXISTS ix_ctl_remeas_trigger    ON close_the_loop_remeasurements (trigger);
CREATE INDEX IF NOT EXISTS ix_ctl_remeas_demo       ON close_the_loop_remeasurements (is_demo);
CREATE INDEX IF NOT EXISTS ix_ctl_remeas_observed   ON close_the_loop_remeasurements (observed_at);

-- Append-only KPI capture (the ONLY way KPI values persist; GETs never write).
CREATE TABLE IF NOT EXISTS close_the_loop_kpi_snapshots (
  id           BIGSERIAL PRIMARY KEY,
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_by  TEXT,
  snapshot     JSONB       NOT NULL,
  summary      JSONB       NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_ctl_kpi_snapshots_captured ON close_the_loop_kpi_snapshots (captured_at);
