-- Phase 3.3 — Employability Scoring Engine · audit ledger
-- ============================================================================
-- Append-only record of each persisted employability scoring run
-- (Tier 1 competency scores → Tier 2 dimension scores → Tier 3 EI score).
-- The full traced artifact is stored in `trace` JSONB for auditability.
--
-- Additive & flag-gated: created lazily by ensureScoringRunSchema() only when
-- FF_COMPETENCY_EI=1 (competencyEi). Flag-OFF performs zero DDL.

CREATE TABLE IF NOT EXISTS employability_scoring_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id            VARCHAR(160) NOT NULL,
  role_id               VARCHAR(160),
  measurable            BOOLEAN NOT NULL DEFAULT false,
  measurement           VARCHAR(40) NOT NULL DEFAULT 'domain_proxy',
  ei_score              NUMERIC(6,2),
  ei_band               VARCHAR(40),
  coverage_pct          NUMERIC(6,2) NOT NULL DEFAULT 0,
  confidence_score      NUMERIC(6,2) NOT NULL DEFAULT 0,
  confidence_band       VARCHAR(40),
  dimensions_total      INTEGER NOT NULL DEFAULT 0,
  dimensions_measurable INTEGER NOT NULL DEFAULT 0,
  scoring_version       VARCHAR(40) NOT NULL,
  weights_version       VARCHAR(40) NOT NULL,
  trace                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT employability_scoring_runs_ei_score_chk
    CHECK (ei_score IS NULL OR (ei_score >= 0 AND ei_score <= 100)),
  CONSTRAINT employability_scoring_runs_coverage_chk
    CHECK (coverage_pct >= 0 AND coverage_pct <= 100),
  CONSTRAINT employability_scoring_runs_confidence_chk
    CHECK (confidence_score >= 0 AND confidence_score <= 100)
);

CREATE INDEX IF NOT EXISTS idx_employability_scoring_runs_subject
  ON employability_scoring_runs (subject_id, created_at DESC);
