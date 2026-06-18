-- SA-100X schema-drift elimination
-- Creates Drizzle-defined tables that are absent from the live DB and cause 500s
-- when storage/route handlers query them. All idempotent (IF NOT EXISTS).
-- Column definitions mirror backend/shared/schema.ts exactly.

CREATE TABLE IF NOT EXISTS platform_settings (
  id            varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key   text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  setting_type  text NOT NULL DEFAULT 'string',
  category      text NOT NULL DEFAULT 'general',
  description   text,
  updated_by    varchar,
  created_at    timestamp NOT NULL DEFAULT now(),
  updated_at    timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_templates (
  id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  subject     text NOT NULL,
  grade       text NOT NULL,
  description text,
  duration    integer NOT NULL DEFAULT 60,
  total_marks integer NOT NULL DEFAULT 100,
  difficulty  text NOT NULL DEFAULT 'Medium',
  category    text NOT NULL DEFAULT 'Academic',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS education_boards (
  id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  board_code  text NOT NULL UNIQUE,
  board_name  text NOT NULL,
  description text,
  country     text NOT NULL DEFAULT 'India',
  status      text NOT NULL DEFAULT 'Active',
  created_at  timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_packages (
  id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  category        text NOT NULL,
  student_segment text NOT NULL,
  product_name    text NOT NULL,
  is_recommended  boolean NOT NULL DEFAULT false,
  domains_covered text[] NOT NULL DEFAULT '{}'::text[],
  price           real,
  validity_days   integer,
  question_count  integer,
  report_type     text,
  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamp NOT NULL DEFAULT now(),
  updated_at      timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id    varchar NOT NULL,
  sender_id       varchar,
  type            text NOT NULL DEFAULT 'fyi',
  category        text NOT NULL DEFAULT 'general',
  title           text NOT NULL,
  message         text NOT NULL,
  action_url      text,
  action_label    text,
  priority        text NOT NULL DEFAULT 'normal',
  is_read         boolean NOT NULL DEFAULT false,
  is_acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_at timestamp,
  is_email_sent   boolean NOT NULL DEFAULT false,
  email_sent_at   timestamp,
  metadata        text,
  expires_at      timestamp,
  created_at      timestamp NOT NULL DEFAULT now()
);

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
