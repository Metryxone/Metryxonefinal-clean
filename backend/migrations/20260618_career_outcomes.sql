-- Career Builder — First Outcome Evidence Loop
-- Captures REAL observed outcomes per subject and the prior score that preceded them,
-- so a score -> real-outcome -> validated-claim loop can be measured honestly.
--
-- Honesty contract:
--   * is_demo = true rows are synthetic illustrations of the pipeline and are
--     ALWAYS excluded from validated claims by the evidence engine.
--   * No fabricated relationship is ever presented as validated; the engine reports
--     n and confidence and only flips `validated` when real (non-demo) n and
--     significance thresholds are met.

CREATE TABLE IF NOT EXISTS career_outcomes (
  id              BIGSERIAL PRIMARY KEY,
  user_id         TEXT        NOT NULL,
  product         TEXT        NOT NULL DEFAULT 'career_builder',
  -- goal_achieved | ei_lift | role_change | promotion | hire
  outcome_type    TEXT        NOT NULL,
  -- binary (outcome_value 0/1) | continuous (outcome_value = measured delta)
  outcome_kind    TEXT        NOT NULL DEFAULT 'binary',
  outcome_value   NUMERIC     NOT NULL,
  -- prior score that preceded the outcome (the thing we are trying to validate)
  prior_score_type  TEXT,            -- readiness | ei | completeness
  prior_score_value NUMERIC,
  prior_score_at    TIMESTAMPTZ,
  observed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- provenance: goal_completion_hook | backfill | manual | demo_seed
  source          TEXT        NOT NULL DEFAULT 'manual',
  is_demo         BOOLEAN     NOT NULL DEFAULT false,
  ref_id          TEXT,              -- e.g. originating goal id, for idempotency
  detail          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_outcomes_type     ON career_outcomes (outcome_type);
CREATE INDEX IF NOT EXISTS idx_career_outcomes_user     ON career_outcomes (user_id);
CREATE INDEX IF NOT EXISTS idx_career_outcomes_is_demo  ON career_outcomes (is_demo);

-- Idempotent capture: one outcome per (type, ref_id) when a ref_id is supplied
-- (lets the goal-completion hook and backfill run repeatedly without duplicating).
CREATE UNIQUE INDEX IF NOT EXISTS uq_career_outcomes_type_ref
  ON career_outcomes (outcome_type, ref_id)
  WHERE ref_id IS NOT NULL;
