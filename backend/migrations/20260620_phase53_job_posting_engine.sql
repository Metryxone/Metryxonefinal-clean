-- PHASE 5.3 — Job Posting Engine (additive, reversible).
--
-- The lifecycle/approval spine already exists (job_postings + job_approval_logs +
-- job_distributions, created by the drizzle baseline). Phase 5.3 adds ONLY:
--   1. a `visibility` column on job_postings (Job Visibility Controls),
--   2. supporting indexes for the engine's list/lookup paths, and
--   3. a unique (job_id, channel) index on job_distributions so the management
--      engine can upsert channel distributions idempotently.
-- No table is created or dropped here; no data is seeded. Fully additive — flag-OFF
-- behaviour is byte-identical (the engine routes 503 before any DB touch).
--
-- Reverse: ALTER TABLE job_postings DROP COLUMN IF EXISTS visibility;
--          DROP INDEX IF EXISTS idx_job_postings_status, idx_job_postings_visibility,
--          idx_job_approval_logs_job_id, uq_job_distributions_job_channel;

ALTER TABLE job_postings
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';
  -- visibility: 'private' (default — not externally listed), 'internal', 'public'

CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings (status);
CREATE INDEX IF NOT EXISTS idx_job_postings_visibility ON job_postings (visibility);
CREATE INDEX IF NOT EXISTS idx_job_approval_logs_job_id ON job_approval_logs (job_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_distributions_job_channel ON job_distributions (job_id, channel);
