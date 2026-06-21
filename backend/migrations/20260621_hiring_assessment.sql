-- PHASE 5.7 — Assessment-Led Hiring (hiring_assessment_engine).
-- Canonical DDL for the two net-new tables. This mirrors the lazy
-- ensureHiringAssessmentSchema() in services/hiring-assessment-engine.ts
-- (there is no migration runner; the lazy ensure-schema is the live path and
-- runs ONLY on the POST write path while the `hiringAssessment` flag is ON, so
-- flag-OFF is byte-identical legacy with zero DDL).
--
-- Contract: additive · flag-gated · compose-never-recompute (the assessment
-- SCORE is composed from existing substrate, never re-scored here) · honesty-first.

-- ── assessment_invites ──────────────────────────────────────────────────────
-- One row per assessment invitation issued to an employer candidate for a job.
-- Lifecycle: invited → in_progress → completed | expired | cancelled. Completion
-- LINKS to an existing score source (onto_competency_score_runs / capadex) — it
-- never fabricates a score.
CREATE TABLE IF NOT EXISTS assessment_invites (
  id                 TEXT PRIMARY KEY,
  employer_id        TEXT,
  job_id             TEXT NOT NULL,
  candidate_id       TEXT NOT NULL,
  candidate_email    TEXT,
  token              TEXT NOT NULL,
  assessment_id      TEXT,
  status             TEXT NOT NULL DEFAULT 'invited'
                       CHECK (status IN ('invited','in_progress','completed','expired','cancelled')),
  invited_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at       TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ,
  score_run_id       UUID,
  capadex_session_id UUID,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_invites_token     ON assessment_invites (token);
CREATE INDEX        IF NOT EXISTS idx_assessment_invites_job       ON assessment_invites (job_id);
CREATE INDEX        IF NOT EXISTS idx_assessment_invites_candidate ON assessment_invites (candidate_id);

-- ── candidate_ranking ───────────────────────────────────────────────────────
-- Append-only snapshot of a developmental assessment ranking for a job. Each
-- snapshotRanking() call writes one run_id group. Scores are nullable when a
-- candidate's assessment is unmeasured (honesty: unmeasured is NEVER scored 0).
-- A ranking is a DEVELOPMENTAL ordering by assessment evidence — NOT a verdict.
CREATE TABLE IF NOT EXISTS candidate_ranking (
  id               BIGSERIAL PRIMARY KEY,
  run_id           TEXT NOT NULL,
  job_id           TEXT NOT NULL,
  candidate_id     TEXT NOT NULL,
  candidate_name   TEXT,
  rank             INTEGER NOT NULL,
  measurable       BOOLEAN NOT NULL DEFAULT false,
  assessment_score NUMERIC,
  composite_score  NUMERIC,
  band             TEXT,
  coverage_pct     NUMERIC,
  confidence_band  TEXT,
  score_source     TEXT,
  detail           JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_candidate_ranking_job ON candidate_ranking (job_id);
CREATE INDEX IF NOT EXISTS idx_candidate_ranking_run ON candidate_ranking (run_id);
