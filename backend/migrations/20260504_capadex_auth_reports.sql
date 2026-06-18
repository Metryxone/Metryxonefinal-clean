-- CAPADEX user accounts, OTPs, and reports
CREATE TABLE IF NOT EXISTS capadex_users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL DEFAULT '',
  email          text NOT NULL UNIQUE,
  phone          text NOT NULL DEFAULT '',
  password_hash  text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS capadex_users_email_idx ON capadex_users(LOWER(email));

CREATE TABLE IF NOT EXISTS capadex_otps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  code       text NOT NULL,
  expires_at timestamptz NOT NULL,
  used       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS capadex_otps_email_idx ON capadex_otps(LOWER(email));

CREATE TABLE IF NOT EXISTS capadex_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES capadex_users(id) ON DELETE SET NULL,
  session_id   uuid REFERENCES capadex_sessions(id) ON DELETE SET NULL,
  concern_name text NOT NULL,
  stage_code   text NOT NULL,
  score        numeric,
  score_level  text,
  insight      text,
  participant_name text,
  participant_age  integer,
  subdomains   jsonb DEFAULT '[]'::jsonb,
  report_data  jsonb DEFAULT '{}'::jsonb,
  email_sent   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS capadex_reports_user_idx    ON capadex_reports(user_id);
CREATE INDEX IF NOT EXISTS capadex_reports_session_idx ON capadex_reports(session_id);
CREATE INDEX IF NOT EXISTS capadex_reports_email_idx   ON capadex_reports(user_id, stage_code);
