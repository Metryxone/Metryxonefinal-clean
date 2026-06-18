-- CAPADEX Enterprise Intelligence Tables
-- Implements: Recommendations, Risk Intelligence, Interventions,
--             Gamification, User Profiles, Audit Events, Consent

-- ─── User Extended Profiles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capadex_user_profiles (
  user_id          uuid PRIMARY KEY REFERENCES capadex_users(id) ON DELETE CASCADE,
  persona          text,
  age              integer,
  age_band         text,
  grade            text,
  institution      text,
  city             text,
  state            text,
  primary_concern  text,
  concerns_history text[] DEFAULT '{}',
  notification_prefs jsonb DEFAULT '{"email":true,"whatsapp":false}',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- ─── Recommendations ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capadex_recommendations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES capadex_users(id) ON DELETE CASCADE,
  session_id       uuid REFERENCES capadex_sessions(id) ON DELETE CASCADE,
  concern_name     text NOT NULL,
  stage_code       text NOT NULL,
  score            numeric,
  score_level      text,
  category         text NOT NULL, -- digital, academic, emotional, behavioural, social, general
  title            text NOT NULL,
  description      text,
  action_items     jsonb DEFAULT '[]',
  priority         integer DEFAULT 2, -- 1=high, 2=medium, 3=low
  status           text DEFAULT 'active', -- active, acknowledged, completed, dismissed
  acknowledged_at  timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_capadex_recs_user    ON capadex_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_capadex_recs_session ON capadex_recommendations(session_id);
CREATE INDEX IF NOT EXISTS idx_capadex_recs_status  ON capadex_recommendations(status);

-- ─── Risk Flags ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capadex_risk_flags (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES capadex_users(id) ON DELETE CASCADE,
  session_id       uuid REFERENCES capadex_sessions(id) ON DELETE CASCADE,
  concern_name     text,
  risk_type        text NOT NULL, -- low_score, pattern, escalation, multi_concern
  severity         text NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  description      text,
  auto_detected    boolean DEFAULT true,
  resolved         boolean DEFAULT false,
  resolved_by      text,
  resolved_at      timestamptz,
  resolution_notes text,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_capadex_risk_user     ON capadex_risk_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_capadex_risk_severity ON capadex_risk_flags(severity);
CREATE INDEX IF NOT EXISTS idx_capadex_risk_resolved ON capadex_risk_flags(resolved);

-- ─── Interventions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capadex_interventions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES capadex_users(id) ON DELETE CASCADE,
  risk_flag_id      uuid REFERENCES capadex_risk_flags(id) ON DELETE SET NULL,
  concern_name      text NOT NULL,
  intervention_type text NOT NULL, -- study_coaching, emotional_support, behavioural_therapy, digital_wellness, parent_guidance, career_guidance
  title             text NOT NULL,
  description       text,
  assigned_to       text,
  status            text DEFAULT 'pending', -- pending, active, completed, cancelled
  priority          text DEFAULT 'medium', -- low, medium, high, critical
  started_at        timestamptz,
  due_at            timestamptz,
  completed_at      timestamptz,
  outcome_notes     text,
  outcome_score     integer,
  created_by        text NOT NULL DEFAULT 'system',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_capadex_int_user   ON capadex_interventions(user_id);
CREATE INDEX IF NOT EXISTS idx_capadex_int_status ON capadex_interventions(status);

-- ─── Gamification ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capadex_gamification (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES capadex_users(id) ON DELETE CASCADE,
  total_xp     integer DEFAULT 0,
  level        integer DEFAULT 1,
  streak_days  integer DEFAULT 0,
  last_active  date,
  badges       jsonb DEFAULT '[]',
  milestones   jsonb DEFAULT '[]',
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_capadex_gam_user ON capadex_gamification(user_id);

-- ─── Audit Events ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capadex_audit_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text NOT NULL,
  user_id     uuid,
  session_id  uuid,
  actor       text DEFAULT 'system',
  payload     jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_capadex_audit_type    ON capadex_audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_capadex_audit_user    ON capadex_audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_capadex_audit_created ON capadex_audit_events(created_at DESC);

-- ─── Consent Records ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capadex_consent_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES capadex_users(id) ON DELETE CASCADE,
  guest_email     text,
  consent_type    text NOT NULL, -- assessment, data_processing, marketing, parent_minor
  consented       boolean NOT NULL DEFAULT true,
  ip_address      text,
  user_agent      text,
  consent_version text DEFAULT '1.0',
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_capadex_consent_user ON capadex_consent_records(user_id);

-- ─── Session metadata enrichment ─────────────────────────────────────────────
ALTER TABLE capadex_sessions ADD COLUMN IF NOT EXISTS persona       text;
ALTER TABLE capadex_sessions ADD COLUMN IF NOT EXISTS ip_address    text;
ALTER TABLE capadex_sessions ADD COLUMN IF NOT EXISTS device_type   text;
ALTER TABLE capadex_sessions ADD COLUMN IF NOT EXISTS referrer      text;
ALTER TABLE capadex_sessions ADD COLUMN IF NOT EXISTS time_taken_s  integer;
