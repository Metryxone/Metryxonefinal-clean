-- PHASE 5.9 — Shortlisting Engine.
-- Operator-driven candidate hiring pipeline over employer_candidates for a job.
-- Mirrors the lazy ensurePipelineSchema() in services/shortlisting-engine.ts
-- (no migration runner; this file is the canonical reference for the same DDL).
--
-- candidate_pipeline    — current status per (job, candidate). Status Management.
-- workflow_transitions  — append-only transition history. Workflow Tracking.
--
-- Statuses (operator actions, governed by the in-service workflow_engine FSM):
--   review · shortlist · hold · interview · offer · hire · reject.

CREATE TABLE IF NOT EXISTS candidate_pipeline (
  id            BIGSERIAL PRIMARY KEY,
  employer_id   TEXT,
  job_id        TEXT NOT NULL,
  candidate_id  TEXT NOT NULL,
  status        TEXT NOT NULL,
  stage_order   INT,
  note          TEXT,
  updated_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, candidate_id)
);
CREATE INDEX IF NOT EXISTS idx_candidate_pipeline_job    ON candidate_pipeline (job_id);
CREATE INDEX IF NOT EXISTS idx_candidate_pipeline_status ON candidate_pipeline (job_id, status);

CREATE TABLE IF NOT EXISTS workflow_transitions (
  id            BIGSERIAL PRIMARY KEY,
  pipeline_id   BIGINT,
  employer_id   TEXT,
  job_id        TEXT NOT NULL,
  candidate_id  TEXT NOT NULL,
  from_status   TEXT,
  to_status     TEXT NOT NULL,
  note          TEXT,
  actor         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_job  ON workflow_transitions (job_id);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_cand ON workflow_transitions (job_id, candidate_id);
