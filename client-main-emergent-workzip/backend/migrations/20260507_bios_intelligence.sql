-- METRYXONE BIOS Intelligence Layer
-- New tables: behavioural_signals, signal_patterns, signal_history,
-- lbi_scores, developmental_trajectory, tenants
-- Plus psychometric columns on items tables

-- ─── Tenants ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  tenant_code TEXT UNIQUE NOT NULL,
  tenant_name TEXT NOT NULL,
  tenant_type TEXT NOT NULL DEFAULT 'school',
  contact_email TEXT,
  subscription_tier TEXT DEFAULT 'basic',
  max_users INT DEFAULT 100,
  active_users INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── Behavioural Signals (comprehensive 13-type taxonomy) ──────────────────
CREATE TABLE IF NOT EXISTS behavioural_signals (
  id SERIAL PRIMARY KEY,
  session_id TEXT,
  user_email TEXT,
  signal_type TEXT NOT NULL,
  signal_category TEXT,
  signal_source TEXT DEFAULT 'assessment',
  signal_value JSONB DEFAULT '{}',
  confidence_score FLOAT DEFAULT 0.5,
  severity_level TEXT DEFAULT 'low',
  contextual_weight FLOAT DEFAULT 1.0,
  captured_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bsig_user ON behavioural_signals(user_email);
CREATE INDEX IF NOT EXISTS idx_bsig_type ON behavioural_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_bsig_session ON behavioural_signals(session_id);

-- ─── Signal Patterns (cross-signal correlations) ──────────────────────────
CREATE TABLE IF NOT EXISTS signal_patterns (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  pattern_type TEXT NOT NULL,
  correlated_signals JSONB DEFAULT '[]',
  risk_level TEXT DEFAULT 'low',
  confidence FLOAT DEFAULT 0.5,
  detected_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spat_user ON signal_patterns(user_email);

-- ─── Signal History (periodic snapshots) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS signal_history (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  signal_snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shist_user ON signal_history(user_email);

-- ─── LBI Scores (Learning Behavior Index per user) ────────────────────────
CREATE TABLE IF NOT EXISTS lbi_scores (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  consistency_score FLOAT DEFAULT 0,
  persistence_score FLOAT DEFAULT 0,
  attention_score FLOAT DEFAULT 0,
  adaptability_score FLOAT DEFAULT 0,
  velocity_score FLOAT DEFAULT 0,
  overall_lbi FLOAT DEFAULT 0,
  learning_style TEXT DEFAULT 'exploratory',
  sessions_analyzed INT DEFAULT 0,
  calculated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_email)
);

-- ─── Developmental Trajectory ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS developmental_trajectory (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  trajectory_type TEXT NOT NULL,
  trend_direction TEXT NOT NULL,
  confidence FLOAT DEFAULT 0,
  signals_basis JSONB DEFAULT '[]',
  detected_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dtraj_user ON developmental_trajectory(user_email);

-- ─── Psychometric columns on assessment items ─────────────────────────────
ALTER TABLE sdi_items
  ADD COLUMN IF NOT EXISTS discrimination_index FLOAT DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS psychometric_confidence FLOAT DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS validity_score FLOAT DEFAULT 0.5;

ALTER TABLE short_assessment_questions
  ADD COLUMN IF NOT EXISTS discrimination_index FLOAT DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS psychometric_confidence FLOAT DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS validity_score FLOAT DEFAULT 0.5;

-- ─── Seed default tenant ──────────────────────────────────────────────────
INSERT INTO tenants (tenant_code, tenant_name, tenant_type, contact_email, subscription_tier, max_users)
VALUES ('MTRX_DEMO', 'MetryxOne Demo School', 'school', 'admin@metryx.one', 'enterprise', 9999)
ON CONFLICT (tenant_code) DO NOTHING;
