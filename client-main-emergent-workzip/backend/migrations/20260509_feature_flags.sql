-- Feature Flag System — Phase 1 S2
-- Per-flag global toggles, rollout percentages, and per-tenant overrides

CREATE TABLE IF NOT EXISTS feature_flags (
  flag_key    TEXT PRIMARY KEY,
  label       TEXT        NOT NULL,
  description TEXT,
  enabled     BOOLEAN     NOT NULL DEFAULT FALSE,
  rollout_pct INT         NOT NULL DEFAULT 100 CHECK (rollout_pct BETWEEN 0 AND 100),
  phase       TEXT        NOT NULL DEFAULT 'phase1',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_flag_tenant_overrides (
  flag_key   TEXT        NOT NULL REFERENCES feature_flags(flag_key) ON DELETE CASCADE,
  tenant_id  TEXT        NOT NULL,
  enabled    BOOLEAN     NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (flag_key, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_fft_overrides_flag ON feature_flag_tenant_overrides(flag_key);

-- Seed the 10 Phase 1 flags (all disabled by default)
INSERT INTO feature_flags (flag_key, label, description, enabled, rollout_pct, phase) VALUES
  ('adaptive_questioning',    'Adaptive Questioning',       'Dynamically selects the next question based on prior responses and cognitive state',      FALSE, 100, 'phase1'),
  ('contradiction_detection', 'Contradiction Detection',    'Detects and surfaces contradictory response patterns within an assessment session',       FALSE, 100, 'phase1'),
  ('signal_intelligence',     'Signal Intelligence',        'Captures behavioural timing and linguistic signals during assessment for BIOS STEP 2',    FALSE, 100, 'phase1'),
  ('dynamic_reporting',       'Dynamic Reporting',          'Generates personalised narrative reports driven by live cognitive runtime state',          FALSE, 100, 'phase1'),
  ('interventions',           'Intervention Engine',        'Triggers personalised learning and wellbeing interventions post-assessment',               FALSE, 100, 'phase1'),
  ('longitudinal_memory',     'Longitudinal Memory',        'Builds cross-session behavioural memory and developmental trajectory models',              FALSE, 100, 'phase1'),
  ('cognitive_load_engine',   'Cognitive Load Engine',      'Real-time estimation of cognitive fatigue and overload during assessment',                 FALSE, 100, 'phase1'),
  ('hypothesis_engine',       'Hypothesis Engine',          'Generates and validates behavioural construct hypotheses as assessment progresses',        FALSE, 100, 'phase1'),
  ('confidence_engine',       'Confidence Engine',          'Assigns confidence and uncertainty scores to construct-level measurements',                FALSE, 100, 'phase1'),
  ('websocket_runtime',       'WebSocket Runtime Sync',     'Real-time bidirectional sync of cognitive runtime state between client and server',       FALSE, 100, 'phase1')
ON CONFLICT (flag_key) DO NOTHING;
