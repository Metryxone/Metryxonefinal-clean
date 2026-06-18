-- Phase 1 Step 2 (Ontology Reverse-Weighting prerequisite).
-- Snapshots the ontology bucket on each response row at write time, so the
-- per-bucket scoring refactor in `/api/capadex/session/:id/complete` can group
-- responses by the bucket they MEASURED (not the session's primary anchor).
--
-- Sourcing at /respond time (rather than join-at-score-time) gives an immutable
-- audit shape: retroactive ontology edits (admins promoting/demoting
-- adaptive_ontology_edges, or renaming bucket keys) NEVER silently rescore old
-- sessions — historical responses keep the bucket that was canonical when the
-- user answered.
--
-- Nullable on purpose: the live single-mean scoring path treats NULL bucket the
-- same as "session primary anchor" → the safeguard fallback path is unchanged.
-- Pre-migration rows stay NULL (no backfill — no historical bucket signal exists).

ALTER TABLE capadex_responses
  ADD COLUMN IF NOT EXISTS concern_bucket VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_capadex_responses_concern_bucket
  ON capadex_responses (session_id, concern_bucket);
