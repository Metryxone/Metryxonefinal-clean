-- CSI (Career Stage Index) Tables
-- Composite behavioral intelligence score derived from CAPADEX session history

CREATE TABLE IF NOT EXISTS csi_profiles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email       text NOT NULL,
  user_id          uuid REFERENCES capadex_users(id) ON DELETE SET NULL,
  csi_score        numeric NOT NULL DEFAULT 0,
  csi_stage        text NOT NULL DEFAULT 'Forming',
  csi_stage_color  text NOT NULL DEFAULT '#6B7280',
  positive_factors jsonb DEFAULT '[]',
  negative_factors jsonb DEFAULT '[]',
  domain_scores    jsonb DEFAULT '{}',
  sessions_count   integer DEFAULT 0,
  highest_stage    text,
  primary_concern  text,
  participant_name text,
  calculated_at    timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (user_email)
);
CREATE INDEX IF NOT EXISTS idx_csi_profiles_email ON csi_profiles(user_email);
CREATE INDEX IF NOT EXISTS idx_csi_profiles_stage ON csi_profiles(csi_stage);
CREATE INDEX IF NOT EXISTS idx_csi_profiles_score ON csi_profiles(csi_score DESC);

CREATE TABLE IF NOT EXISTS csi_trajectory (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  text NOT NULL,
  csi_score   numeric NOT NULL,
  csi_stage   text NOT NULL,
  trigger     text DEFAULT 'session_complete',
  session_id  uuid REFERENCES capadex_sessions(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_csi_trajectory_email   ON csi_trajectory(user_email);
CREATE INDEX IF NOT EXISTS idx_csi_trajectory_created ON csi_trajectory(created_at DESC);

CREATE TABLE IF NOT EXISTS csi_domain_weights (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_name text NOT NULL UNIQUE,
  weight      numeric NOT NULL DEFAULT 1.0,
  category    text DEFAULT 'behavioral',
  is_active   boolean DEFAULT true,
  updated_at  timestamptz DEFAULT now()
);
