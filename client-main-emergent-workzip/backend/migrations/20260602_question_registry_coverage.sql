-- CAPADEX Behavioural Coverage Engine — registry coverage columns (2026-06-02).
--
-- Canonical DDL. This repo has NO migration runner; the service bootstraps the
-- identical ALTERs lazily (see backend/services/question-registry-service.ts
-- ensureQuestionRegistrySchema). Keep the two in lockstep.
--
-- Purpose: classify every clarity question into ONE of the 10 behavioural
-- investigation dimensions so per-concern coverage + gaps are auditable. The
-- classification is a deterministic snapshot computed by refreshRegistry from
-- question_type / stage / polarity / stem keywords. coverage_dimension is NULL
-- (never fabricated) when no dimension matches — an honest "uncovered" marker.
--
-- The 10 dimensions:
--   root_cause · trigger · thought_pattern · emotional_state · behavioral_response
--   avoidance · coping_strategy · impact · strength_asset · change_readiness

ALTER TABLE capadex_question_registry
  ADD COLUMN IF NOT EXISTS coverage_dimension  TEXT,          -- primary dimension (NULL = uncovered)
  ADD COLUMN IF NOT EXISTS coverage_dimensions JSONB,         -- all matched dimensions (ranked)
  ADD COLUMN IF NOT EXISTS coverage_method     TEXT,          -- question_type | keyword | polarity | none
  ADD COLUMN IF NOT EXISTS coverage_confidence NUMERIC(5,4);  -- 0..1 classifier certainty (NULL = uncovered)

CREATE INDEX IF NOT EXISTS idx_cqr_coverage_dim ON capadex_question_registry (coverage_dimension);
