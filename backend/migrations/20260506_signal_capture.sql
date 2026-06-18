-- CAPADEX Behavioural Signal Capture tables
-- Based on STEP 2 BEHAVIOURAL SIGNAL CAPTURE: Ultimate Unified Behavioural Intelligence Architecture

CREATE TABLE IF NOT EXISTS capadex_session_signals (
  id               SERIAL PRIMARY KEY,
  session_id       VARCHAR(255) NOT NULL,
  item_id          INTEGER,
  signal_type      VARCHAR(50)  NOT NULL,
  signal_key       VARCHAR(100) NOT NULL,
  signal_value     JSONB        DEFAULT '{}',
  weight           DECIMAL(4,2) DEFAULT 1.0,
  severity         VARCHAR(20)  DEFAULT 'minimal',
  confidence       DECIMAL(3,2) DEFAULT 0.80,
  description      TEXT,
  captured_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_css_session   ON capadex_session_signals(session_id);
CREATE INDEX IF NOT EXISTS idx_css_type      ON capadex_session_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_css_severity  ON capadex_session_signals(severity);

CREATE TABLE IF NOT EXISTS capadex_signal_profiles (
  id                     SERIAL PRIMARY KEY,
  session_id             VARCHAR(255) UNIQUE NOT NULL,
  user_id                INTEGER,
  concern_name           VARCHAR(500),
  stage_code             VARCHAR(50),
  persona                VARCHAR(100),
  emotional_load         DECIMAL(5,2) DEFAULT 0,
  cognitive_load         DECIMAL(5,2) DEFAULT 0,
  engagement_score       DECIMAL(5,2) DEFAULT 50,
  risk_score             DECIMAL(5,2) DEFAULT 0,
  composite_intensity    DECIMAL(5,2) DEFAULT 0,
  dominant_signals       JSONB DEFAULT '[]',
  early_warnings         JSONB DEFAULT '[]',
  growth_indicators      JSONB DEFAULT '[]',
  hidden_patterns        JSONB DEFAULT '[]',
  persona_signals        JSONB DEFAULT '{}',
  linguistic_summary     JSONB DEFAULT '{}',
  behavioural_flags      JSONB DEFAULT '[]',
  reliability_score      DECIMAL(3,2) DEFAULT 0.80,
  volatility_score       DECIMAL(3,2) DEFAULT 0.00,
  severity_level         VARCHAR(20)  DEFAULT 'minimal',
  signal_count           INTEGER      DEFAULT 0,
  intervention_priority  VARCHAR(20)  DEFAULT 'standard',
  generated_at           TIMESTAMPTZ  DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_csp_session   ON capadex_signal_profiles(session_id);
CREATE INDEX IF NOT EXISTS idx_csp_severity  ON capadex_signal_profiles(severity_level);
CREATE INDEX IF NOT EXISTS idx_csp_priority  ON capadex_signal_profiles(intervention_priority);

CREATE TABLE IF NOT EXISTS capadex_linguistic_signals (
  id                       SERIAL PRIMARY KEY,
  session_id               VARCHAR(255) NOT NULL,
  concern_text             TEXT,
  detected_patterns        JSONB DEFAULT '[]',
  emotional_vocabulary     JSONB DEFAULT '[]',
  intensity_score          DECIMAL(3,2) DEFAULT 0.50,
  certainty_score          DECIMAL(3,2) DEFAULT 0.50,
  absolutism_score         DECIMAL(3,2) DEFAULT 0.00,
  helplessness_indicators  JSONB DEFAULT '[]',
  fatigue_markers          JSONB DEFAULT '[]',
  anxiety_markers          JSONB DEFAULT '[]',
  raw_word_count           INTEGER      DEFAULT 0,
  detected_at              TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cls_session ON capadex_linguistic_signals(session_id);
