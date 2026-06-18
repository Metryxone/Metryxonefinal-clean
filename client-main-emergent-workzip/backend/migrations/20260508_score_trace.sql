-- Phase 0 S3: add score_trace JSONB to capadex_sessions and csi_profiles
ALTER TABLE capadex_sessions
  ADD COLUMN IF NOT EXISTS score_trace JSONB;

ALTER TABLE csi_profiles
  ADD COLUMN IF NOT EXISTS score_trace JSONB;

-- index for fast JSONB reads by admin UI
CREATE INDEX IF NOT EXISTS idx_capadex_sessions_score_trace
  ON capadex_sessions USING GIN (score_trace)
  WHERE score_trace IS NOT NULL;

-- Add score_trace to lbi_scores
ALTER TABLE lbi_scores
  ADD COLUMN IF NOT EXISTS score_trace JSONB;

-- Add score_trace to spe_scores
ALTER TABLE spe_scores
  ADD COLUMN IF NOT EXISTS score_trace JSONB;
