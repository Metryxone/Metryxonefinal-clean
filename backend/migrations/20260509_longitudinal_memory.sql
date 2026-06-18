-- S8: Longitudinal Memory Engine
-- Tables for cross-session behavioural memory: one summary row per user +
-- an event log of detected patterns (drift, burnout, recovery, growth).

CREATE TABLE IF NOT EXISTS longitudinal_patterns (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email       TEXT        NOT NULL,
  memory           JSONB       NOT NULL DEFAULT '{}',
  session_count    INTEGER     NOT NULL DEFAULT 0,
  first_seen       TIMESTAMPTZ,
  last_seen        TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_email)
);

CREATE TABLE IF NOT EXISTS longitudinal_pattern_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email       TEXT        NOT NULL,
  event_type       TEXT        NOT NULL CHECK (event_type IN (
                     'recurring_construct', 'behavioural_drift',
                     'burnout_period', 'resilience_recovery', 'growth_pattern'
                   )),
  construct_key    TEXT,
  severity         TEXT        NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high','critical')),
  description      TEXT        NOT NULL,
  detected_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decay_after_days INTEGER     NOT NULL DEFAULT 90,
  is_stale         BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_long_patterns_email
  ON longitudinal_patterns(user_email);

CREATE INDEX IF NOT EXISTS idx_long_pattern_events_email
  ON longitudinal_pattern_events(user_email);

CREATE INDEX IF NOT EXISTS idx_long_pattern_events_type
  ON longitudinal_pattern_events(event_type);

CREATE INDEX IF NOT EXISTS idx_long_pattern_events_detected
  ON longitudinal_pattern_events(detected_at DESC);
