-- PHASE 5.8 — Candidate Comparison Engine
-- Canonical DDL mirroring the lazy ensureComparisonSchema() in
-- services/candidate-comparison-engine.ts (no migration runner — kept in lockstep).
-- Additive + flag-gated (candidateComparison / FF_CANDIDATE_COMPARISON). The lazy
-- ensure runs ONLY on the POST/write path; GET reads use a to_regclass probe and
-- never run DDL.

CREATE TABLE IF NOT EXISTS comparison_dashboard (
  id            BIGSERIAL PRIMARY KEY,
  employer_id   TEXT,
  job_id        TEXT NOT NULL,
  name          TEXT,
  candidate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  snapshot      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comparison_dashboard_job ON comparison_dashboard (job_id);

CREATE TABLE IF NOT EXISTS comparison_reports (
  id            BIGSERIAL PRIMARY KEY,
  dashboard_id  BIGINT,
  employer_id   TEXT,
  job_id        TEXT NOT NULL,
  candidate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  format        TEXT NOT NULL DEFAULT 'json',
  report        JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comparison_reports_job       ON comparison_reports (job_id);
CREATE INDEX IF NOT EXISTS idx_comparison_reports_dashboard ON comparison_reports (dashboard_id);
