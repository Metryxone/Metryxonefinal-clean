-- PHASE 5.10 — Interview Intelligence.
-- Operator-driven interview scheduling, feedback, scoring, evaluation, panel reviews,
-- and decision tracking over employer_jobs/employer_candidates for a job.
-- Mirrors the lazy ensure-schemas in:
--   services/interview-engine.ts          (ensureInterviewSchema)
--   services/interview-feedback-engine.ts (ensureFeedbackSchema)
--   services/evaluation-engine.ts         (ensureScoreSchema)
-- (no migration runner; this file is the canonical reference for the same DDL).
--
-- interview_schedules  — one row per scheduled interview (Interview Scheduling).
-- interview_decisions  — append-only operator decision log (Decision Tracking).
-- interview_feedback   — one row per interview+panelist, upsert (Interview Feedback / Panel Reviews).
-- interview_scores     — one row per interview+panelist+criterion, upsert (Interview Scoring / Evaluation).
--
-- All operator-recorded ground truth. The engines record/aggregate human inputs and
-- enforce valid interview-lifecycle transitions — they make NO algorithmic verdict.

CREATE TABLE IF NOT EXISTS interview_schedules (
  id            BIGSERIAL PRIMARY KEY,
  employer_id   TEXT,
  job_id        TEXT NOT NULL,
  candidate_id  TEXT NOT NULL,
  round_name    TEXT,
  round_seq     INT,
  mode          TEXT,
  scheduled_at  TIMESTAMPTZ,
  duration_mins INT,
  location      TEXT,
  panelists     JSONB NOT NULL DEFAULT '[]'::jsonb,
  status        TEXT NOT NULL DEFAULT 'scheduled',
  note          TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_interview_schedules_job  ON interview_schedules (job_id);
CREATE INDEX IF NOT EXISTS idx_interview_schedules_cand ON interview_schedules (job_id, candidate_id);
CREATE INDEX IF NOT EXISTS idx_interview_schedules_stat ON interview_schedules (job_id, status);

CREATE TABLE IF NOT EXISTS interview_decisions (
  id            BIGSERIAL PRIMARY KEY,
  employer_id   TEXT,
  job_id        TEXT NOT NULL,
  candidate_id  TEXT NOT NULL,
  interview_id  BIGINT,
  decision      TEXT NOT NULL,
  stage         TEXT,
  rationale     TEXT,
  decided_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_interview_decisions_cand ON interview_decisions (job_id, candidate_id);

CREATE TABLE IF NOT EXISTS interview_feedback (
  id             BIGSERIAL PRIMARY KEY,
  interview_id   BIGINT NOT NULL,
  employer_id    TEXT,
  job_id         TEXT NOT NULL,
  candidate_id   TEXT NOT NULL,
  panelist       TEXT NOT NULL,
  recommendation TEXT,
  strengths      TEXT,
  concerns       TEXT,
  comments       TEXT,
  submitted_by   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (interview_id, panelist)
);
CREATE INDEX IF NOT EXISTS idx_interview_feedback_iv   ON interview_feedback (interview_id);
CREATE INDEX IF NOT EXISTS idx_interview_feedback_cand ON interview_feedback (job_id, candidate_id);

CREATE TABLE IF NOT EXISTS interview_scores (
  id            BIGSERIAL PRIMARY KEY,
  interview_id  BIGINT NOT NULL,
  employer_id   TEXT,
  job_id        TEXT NOT NULL,
  candidate_id  TEXT NOT NULL,
  panelist      TEXT NOT NULL,
  criterion     TEXT NOT NULL,
  score         NUMERIC NOT NULL,
  max_score     NUMERIC NOT NULL DEFAULT 5,
  comments      TEXT,
  scored_by     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (interview_id, panelist, criterion)
);
CREATE INDEX IF NOT EXISTS idx_interview_scores_iv   ON interview_scores (interview_id);
CREATE INDEX IF NOT EXISTS idx_interview_scores_cand ON interview_scores (job_id, candidate_id);
