-- Phase 1 Step 1 (Ontology Reverse-Weighting prerequisite).
-- Adds the permanent ontology anchor `primary_construct_key` to capadex_sessions
-- so cross-bucket back-propagation in `/api/capadex/session/:id/complete` has
-- something stable to back-propagate INTO. Nullable on purpose: existing rows
-- predate the column, and the live single-mean scoring path treats NULL as
-- "no ontology anchor → flat scoring" (the same fallback the safeguard uses).

ALTER TABLE capadex_sessions
  ADD COLUMN IF NOT EXISTS primary_construct_key VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_capadex_sessions_construct_key
  ON capadex_sessions (primary_construct_key);
