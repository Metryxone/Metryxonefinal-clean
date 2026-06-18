-- Contradiction Intelligence Engine — Phase 1 S5
-- Stores detected contradiction events from within CAPADEX assessment sessions.
-- Used by the contradiction engine to track, analyse, and resolve inconsistencies
-- in response patterns. All events are internal intelligence signals only.

CREATE TABLE IF NOT EXISTS contradiction_events (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              TEXT        NOT NULL,
  contradiction_type      TEXT        NOT NULL
    CHECK (contradiction_type IN (
      'score_reversal',
      'emotional_masking',
      'self_perception_bias',
      'defensive_answering'
    )),
  severity                TEXT        NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  affected_hypothesis_ids JSONB       NOT NULL DEFAULT '[]',
  response_ids            JSONB       NOT NULL DEFAULT '[]',
  description             TEXT        NOT NULL,
  recommended_action      TEXT        NOT NULL,
  resolved                BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contradiction_events_session
  ON contradiction_events (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contradiction_events_type
  ON contradiction_events (contradiction_type);

CREATE INDEX IF NOT EXISTS idx_contradiction_events_unresolved
  ON contradiction_events (resolved, created_at DESC);
