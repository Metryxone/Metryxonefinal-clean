-- Phase 7 — Validation Loop: unified realized-outcome intake (front-half).
-- Records realized hiring / performance / promotion / retention outcomes against an
-- assessment subject, plus the decision-time prediction snapshot so the EXISTING
-- calibration engine (buildCalibrationModel) can train on (predicted, outcome) pairs.
--
-- Honesty contract:
--   * is_demo = true rows are synthetic illustrations of the loop and are ALWAYS
--     EXCLUDED from evidence-backed / realized calibration claims.
--   * No empirical accuracy is claimed until >= 30 realized (non-demo) binary outcomes
--     that carry a decision-time prediction accrue (platform k_min = 30). Until then the
--     loop is STRUCTURALLY ready, not empirically validated, and predictions stay abstained.
--   * No outcome is ever fabricated; absence of outcomes is reported as absence, never as 0% accuracy.

CREATE TABLE IF NOT EXISTS validation_loop_outcomes (
  id                         BIGSERIAL PRIMARY KEY,
  subject_email              TEXT        NOT NULL,
  subject_user_id            TEXT,
  assessment_ref             TEXT,              -- capadex_session_id / assessment id the outcome validates
  -- hiring | performance | promotion | retention
  outcome_type               TEXT        NOT NULL,
  -- binary (outcome_value 0/1) | continuous (outcome_value = measured delta)
  outcome_kind               TEXT        NOT NULL DEFAULT 'binary',
  outcome_value              NUMERIC     NOT NULL,
  -- decision-time prediction snapshot (0..1) the realized outcome validates; NULL when none was recorded
  predicted_prob_at_decision NUMERIC,
  predicted_basis            TEXT,              -- engine/source that produced the prediction
  decision_at                TIMESTAMPTZ,
  observed_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- provenance: manual | outcome_hook | backfill | demo_seed
  source                     TEXT        NOT NULL DEFAULT 'manual',
  is_demo                    BOOLEAN     NOT NULL DEFAULT false,
  ref_id                     TEXT,              -- idempotency key (e.g. originating decision id)
  detail                     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vlo_type    ON validation_loop_outcomes (outcome_type);
CREATE INDEX IF NOT EXISTS idx_vlo_subject ON validation_loop_outcomes (subject_email);
CREATE INDEX IF NOT EXISTS idx_vlo_is_demo ON validation_loop_outcomes (is_demo);

-- Idempotent capture: one outcome per (type, ref_id) when a ref_id is supplied.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vlo_type_ref
  ON validation_loop_outcomes (outcome_type, ref_id)
  WHERE ref_id IS NOT NULL;
