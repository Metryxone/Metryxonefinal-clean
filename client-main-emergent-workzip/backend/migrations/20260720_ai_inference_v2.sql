-- =====================================================================
-- AI Inference V2 — heuristic competency inference + conversational
-- assessment + behavioural reasoning. Additive; flag: aiInferenceV2.
-- Namespace: ai_*, *_inference_*, *_signal_analysis,
-- conversational_*, portfolio_*, github_*, linkedin_*.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Sources catalog (one row per (user_id, source_type))
CREATE TABLE IF NOT EXISTS competency_inference_sources (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       BIGINT       NOT NULL,
  source_type   TEXT         NOT NULL,        -- 'resume' | 'linkedin' | 'github' | 'portfolio' | 'conversation'
  source_ref    TEXT,                          -- external id / URL / session id
  raw_payload   JSONB        NOT NULL DEFAULT '{}'::jsonb,
  parsed_meta   JSONB        DEFAULT '{}'::jsonb,
  ingested_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, source_type, source_ref)
);
CREATE INDEX IF NOT EXISTS idx_cis_user ON competency_inference_sources(user_id, ingested_at DESC);

-- 2) Inferred competencies (per source × competency)
CREATE TABLE IF NOT EXISTS ai_inferred_competencies (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        BIGINT       NOT NULL,
  source_id      UUID         REFERENCES competency_inference_sources(id) ON DELETE CASCADE,
  competency_key TEXT         NOT NULL,         -- canonical 7-domain: COG/COM/LEA/EXE/ADP/TEC/EIQ
  inferred_level NUMERIC(5,2) NOT NULL,         -- 0..100
  confidence     NUMERIC(4,3) NOT NULL,         -- 0..1
  evidence       JSONB        NOT NULL DEFAULT '[]'::jsonb,
  computed_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aic_user_comp ON ai_inferred_competencies(user_id, competency_key, computed_at DESC);

-- 3) Behavioural inference profile (per user)
CREATE TABLE IF NOT EXISTS behavioral_inference_profiles (
  user_id        BIGINT       PRIMARY KEY,
  signals        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  leadership_signal NUMERIC(4,3),
  communication_signal NUMERIC(4,3),
  execution_signal NUMERIC(4,3),
  consistency_signal NUMERIC(4,3),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 4) Conversational assessment sessions
CREATE TABLE IF NOT EXISTS conversational_assessment_sessions (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        BIGINT       NOT NULL,
  state          TEXT         NOT NULL DEFAULT 'open',  -- 'open'|'closed'|'escalated'
  turns          JSONB        NOT NULL DEFAULT '[]'::jsonb,
  detected_competencies JSONB NOT NULL DEFAULT '{}'::jsonb,
  contradiction_count INTEGER NOT NULL DEFAULT 0,
  quality_score  NUMERIC(5,2),
  started_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  closed_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cas_user ON conversational_assessment_sessions(user_id, started_at DESC);

-- 5) AI reasoning chains (explainability)
CREATE TABLE IF NOT EXISTS ai_reasoning_chains (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        BIGINT       NOT NULL,
  scope          TEXT         NOT NULL,        -- 'inference' | 'conversation' | 'reasoning'
  competency_key TEXT,
  reasoning      JSONB        NOT NULL,        -- {why, evidence, alternatives, caveats}
  confidence     NUMERIC(4,3),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_arc_user ON ai_reasoning_chains(user_id, created_at DESC);

-- 6) Source-specific signal analyses (append-only history)
CREATE TABLE IF NOT EXISTS portfolio_signal_analysis (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        BIGINT       NOT NULL,
  source_id      UUID         REFERENCES competency_inference_sources(id) ON DELETE CASCADE,
  signals        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  analyzed_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS github_signal_analysis (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        BIGINT       NOT NULL,
  source_id      UUID         REFERENCES competency_inference_sources(id) ON DELETE CASCADE,
  repo_count     INTEGER,
  primary_languages JSONB,
  complexity_score NUMERIC(5,2),
  collaboration_score NUMERIC(5,2),
  signals        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  analyzed_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS linkedin_signal_analysis (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        BIGINT       NOT NULL,
  source_id      UUID         REFERENCES competency_inference_sources(id) ON DELETE CASCADE,
  position_count INTEGER,
  total_years    NUMERIC(5,2),
  leadership_years NUMERIC(5,2),
  progression_score NUMERIC(5,2),
  signals        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  analyzed_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 7) Inference confidence calibration models (seeded)
CREATE TABLE IF NOT EXISTS inference_confidence_models (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key     TEXT         NOT NULL UNIQUE,
  source_type   TEXT         NOT NULL,
  base_weight   NUMERIC(4,3) NOT NULL,        -- relative trust per source
  recency_decay NUMERIC(4,3) NOT NULL,
  notes         TEXT
);

-- 8) AI assessment memory (per-user, lightweight working memory)
CREATE TABLE IF NOT EXISTS ai_assessment_memory (
  user_id       BIGINT       PRIMARY KEY,
  memory        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seeds: source confidence weights
INSERT INTO inference_confidence_models (model_key, source_type, base_weight, recency_decay, notes) VALUES
  ('resume_v1',       'resume',       0.65, 0.05, 'Self-reported; moderate trust.'),
  ('linkedin_v1',     'linkedin',     0.70, 0.04, 'Self-reported but public; moderate trust.'),
  ('github_v1',       'github',       0.85, 0.03, 'Behaviour artefacts; high trust.'),
  ('portfolio_v1',    'portfolio',    0.75, 0.04, 'Curated; moderately high trust.'),
  ('conversation_v1', 'conversation', 0.60, 0.06, 'In-session probe; trust scales with depth.')
ON CONFLICT (model_key) DO NOTHING;
