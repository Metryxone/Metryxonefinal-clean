-- =====================================================================
-- UCIP — Unified Competency Intelligence Profile (Phase 1 Foundation)
-- Flag: ucipEnabled (default OFF) + ucipShadowMode (default ON) + adaptiveIntelligenceFoundation (default OFF)
-- Namespace: ucip_*
-- All NEW tables; no existing table touched. Forward-only.
-- user_id is TEXT (UUID) throughout per Phase 1 contract.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Master profile (latest snapshot per user) -------------------------
CREATE TABLE IF NOT EXISTS ucip_profiles (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT         NOT NULL,
  profile_version INTEGER      NOT NULL DEFAULT 1,
  role_dna        JSONB        DEFAULT '{}'::jsonb,
  competency_graph JSONB       DEFAULT '{}'::jsonb,
  cognitive_profile JSONB      DEFAULT '{}'::jsonb,
  behavioral_profile JSONB     DEFAULT '{}'::jsonb,
  confidence_map  JSONB        DEFAULT '{}'::jsonb,
  benchmark_profile JSONB      DEFAULT '{}'::jsonb,
  readiness_profile JSONB      DEFAULT '{}'::jsonb,
  market_signals  JSONB        DEFAULT '{}'::jsonb,
  learning_velocity JSONB      DEFAULT '{}'::jsonb,
  assessment_memory JSONB      DEFAULT '{}'::jsonb,
  orchestration_metadata JSONB DEFAULT '{}'::jsonb,
  source_health   JSONB        DEFAULT '{}'::jsonb,
  computed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ucip_profiles_user ON ucip_profiles(user_id, computed_at DESC);

-- 2) Per-competency state -----------------------------------------------
CREATE TABLE IF NOT EXISTS ucip_competencies (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT         NOT NULL,
  competency_id   TEXT         NOT NULL,
  canonical_name  TEXT         NOT NULL,
  family          TEXT,
  domain          TEXT,
  source          TEXT,
  raw_score       NUMERIC,
  normalized_score NUMERIC,
  confidence      NUMERIC,
  evidence_count  INTEGER      DEFAULT 0,
  computed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ucip_comp_user_canon ON ucip_competencies(user_id, canonical_name);
CREATE INDEX IF NOT EXISTS idx_ucip_comp_user_time ON ucip_competencies(user_id, computed_at DESC);

-- 3) Evidence signals --------------------------------------------------
CREATE TABLE IF NOT EXISTS ucip_evidence_signals (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT         NOT NULL,
  competency_id   TEXT,
  signal_type     TEXT         NOT NULL,         -- 'assessment' | 'resume' | 'github' | 'linkedin' | 'conversation' | 'inference' | ...
  source          TEXT         NOT NULL,
  payload         JSONB        DEFAULT '{}'::jsonb,
  confidence      NUMERIC,
  observed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ucip_evid_user_time ON ucip_evidence_signals(user_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ucip_evid_comp ON ucip_evidence_signals(user_id, competency_id, observed_at DESC);

-- 4) Confidence models per competency ----------------------------------
CREATE TABLE IF NOT EXISTS ucip_confidence_models (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT         NOT NULL,
  competency_id   TEXT         NOT NULL,
  coverage        NUMERIC,
  richness        NUMERIC,
  calibrated_confidence NUMERIC,
  source_breakdown JSONB       DEFAULT '{}'::jsonb,
  computed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ucip_conf_user_comp ON ucip_confidence_models(user_id, competency_id, computed_at DESC);

-- 5) Role snapshot — latest resolved role context per user -------------
CREATE TABLE IF NOT EXISTS ucip_role_snapshots (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT         NOT NULL,
  current_role_title  TEXT,
  target_role_title   TEXT,
  industry        TEXT,
  career_stage    TEXT,
  org_layer       TEXT,
  org_maturity    TEXT,
  role_dna        JSONB        DEFAULT '{}'::jsonb,
  resolved_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ucip_role_user_time ON ucip_role_snapshots(user_id, resolved_at DESC);

-- 6) Cognitive profile -------------------------------------------------
CREATE TABLE IF NOT EXISTS ucip_cognitive_profiles (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT         NOT NULL,
  cognitive_load  JSONB        DEFAULT '{}'::jsonb,
  reasoning_chain JSONB        DEFAULT '{}'::jsonb,
  signal_quality  NUMERIC,
  computed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ucip_cog_user_time ON ucip_cognitive_profiles(user_id, computed_at DESC);

-- 7) Behavioral profile ------------------------------------------------
CREATE TABLE IF NOT EXISTS ucip_behavioral_profiles (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT         NOT NULL,
  behavioural_signals JSONB    DEFAULT '{}'::jsonb,
  drift_indicator TEXT,
  computed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ucip_beh_user_time ON ucip_behavioral_profiles(user_id, computed_at DESC);

-- 8) Assessment memory (append-only history) ---------------------------
CREATE TABLE IF NOT EXISTS ucip_assessment_memory (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT         NOT NULL,
  attempt_run_id  TEXT,
  snapshot        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  recorded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ucip_mem_user_time ON ucip_assessment_memory(user_id, recorded_at DESC);

-- 9) Runtime logs (append-only orchestration audit) --------------------
CREATE TABLE IF NOT EXISTS ucip_runtime_logs (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT,
  correlation_id  UUID,
  operation       TEXT         NOT NULL,        -- 'rebuild' | 'fetch' | 'validate' | ...
  status          TEXT         NOT NULL,        -- 'started' | 'success' | 'partial' | 'failed'
  shadow_mode     BOOLEAN      NOT NULL DEFAULT TRUE,
  duration_ms     INTEGER,
  sources_ok      INTEGER      DEFAULT 0,
  sources_failed  INTEGER      DEFAULT 0,
  validation      JSONB        DEFAULT '{}'::jsonb,
  detail          JSONB        DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ucip_logs_user_time ON ucip_runtime_logs(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ucip_logs_op_time ON ucip_runtime_logs(operation, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ucip_logs_corr ON ucip_runtime_logs(correlation_id);
