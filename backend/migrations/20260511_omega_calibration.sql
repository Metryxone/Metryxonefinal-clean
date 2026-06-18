-- OMEGA-X Psychometric Calibration tables

CREATE TABLE IF NOT EXISTS omega_cohort_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concern_category TEXT NOT NULL,
  stage_code TEXT NOT NULL,
  subdomain_name TEXT,
  n_samples INTEGER DEFAULT 0,
  mean_score NUMERIC(6,2),
  std_dev NUMERIC(6,2),
  p10 NUMERIC(6,2),
  p25 NUMERIC(6,2),
  p50 NUMERIC(6,2),
  p75 NUMERIC(6,2),
  p90 NUMERIC(6,2),
  last_computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(concern_category, stage_code, subdomain_name)
);

CREATE TABLE IF NOT EXISTS omega_calibration_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE,
  user_email TEXT,
  overall_z_score NUMERIC(6,3),
  overall_percentile INTEGER,
  confidence_interval_low NUMERIC(6,2),
  confidence_interval_high NUMERIC(6,2),
  reliability_score NUMERIC(4,3),
  response_consistency NUMERIC(4,3),
  subdomain_calibration JSONB DEFAULT '{}',
  cohort_label TEXT,
  uniqueness_score NUMERIC(4,3),
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_omega_cohort_category ON omega_cohort_stats(concern_category, stage_code);
CREATE INDEX IF NOT EXISTS idx_omega_calib_session ON omega_calibration_profiles(session_id);
