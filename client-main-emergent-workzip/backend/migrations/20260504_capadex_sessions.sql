-- CAPADEX progressive assessment tables
CREATE TABLE IF NOT EXISTS capadex_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_email  text,
  guest_name   text,
  concern_name text NOT NULL,
  user_age     integer NOT NULL,
  age_band     text NOT NULL,
  stage_code   text NOT NULL,
  stage_index  integer NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'in_progress',
  total_items  integer DEFAULT 0,
  answered_items integer DEFAULT 0,
  score        numeric,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capadex_responses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid NOT NULL REFERENCES capadex_sessions(id) ON DELETE CASCADE,
  item_id        uuid NOT NULL,
  stage_code     text NOT NULL,
  response_value integer NOT NULL,
  raw_score      numeric,
  weighted_score numeric,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (session_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_capadex_sessions_email   ON capadex_sessions(guest_email);
CREATE INDEX IF NOT EXISTS idx_capadex_sessions_concern ON capadex_sessions(concern_name);
CREATE INDEX IF NOT EXISTS idx_capadex_sessions_status  ON capadex_sessions(status);
CREATE INDEX IF NOT EXISTS idx_capadex_responses_session ON capadex_responses(session_id);
