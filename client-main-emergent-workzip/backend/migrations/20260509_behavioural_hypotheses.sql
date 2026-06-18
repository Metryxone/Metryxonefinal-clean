-- Phase 1 S3: Behavioural Hypothesis Engine
-- Creates behavioural_hypotheses table for per-session weighted hypothesis tracking.

CREATE TABLE IF NOT EXISTS behavioural_hypotheses (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id             text        NOT NULL,
  construct_key          text        NOT NULL,
  label                  text        NOT NULL,
  confidence             numeric(5,3) NOT NULL DEFAULT 0.5
                           CHECK (confidence >= 0 AND confidence <= 1),
  uncertainty            numeric(5,3) NOT NULL DEFAULT 0.5
                           CHECK (uncertainty >= 0 AND uncertainty <= 1),
  evidence_sources       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  lifecycle_state        text        NOT NULL DEFAULT 'active'
                           CHECK (lifecycle_state IN
                             ('active','weakened','suspended','archived','reactivated')),
  explainability_context jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bh_session_id   ON behavioural_hypotheses(session_id);
CREATE INDEX IF NOT EXISTS idx_bh_construct    ON behavioural_hypotheses(construct_key);
CREATE INDEX IF NOT EXISTS idx_bh_lifecycle    ON behavioural_hypotheses(lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_bh_session_lc   ON behavioural_hypotheses(session_id, lifecycle_state);
