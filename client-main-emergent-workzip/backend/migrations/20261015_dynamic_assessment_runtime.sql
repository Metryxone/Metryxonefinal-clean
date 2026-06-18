-- Phase 4 — Dynamic Question Generation + Cognitive Runtime (additive, shadow-mode).
-- Strictly append-only. Never mutates existing assessment tables.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- One row per adaptive runtime session (independent of V1 assessment sessions).
CREATE TABLE IF NOT EXISTS dynamic_question_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  blueprint_id    UUID,
  role_context    JSONB DEFAULT '{}'::jsonb,
  cognitive_seed  JSONB DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'open',
  shadow_mode     BOOLEAN NOT NULL DEFAULT TRUE,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS dqs_user_idx ON dynamic_question_sessions (user_id, started_at DESC);

-- Each emitted question (one row per question generation event).
CREATE TABLE IF NOT EXISTS dynamic_question_generations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES dynamic_question_sessions(id) ON DELETE CASCADE,
  question_index      INTEGER NOT NULL,
  competency_id       TEXT NOT NULL,
  question_type       TEXT NOT NULL,
  depth_level         INTEGER NOT NULL DEFAULT 1,
  generator_version   TEXT NOT NULL,
  prompt              TEXT NOT NULL,
  context_snapshot    JSONB DEFAULT '{}'::jsonb,
  rationale           JSONB DEFAULT '{}'::jsonb,
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dqg_session_idx ON dynamic_question_generations (session_id, question_index);
CREATE INDEX IF NOT EXISTS dqg_competency_idx ON dynamic_question_generations (competency_id);

-- Each adaptive branch decision (depth escalation, contradiction probe, etc.).
CREATE TABLE IF NOT EXISTS adaptive_question_branches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES dynamic_question_sessions(id) ON DELETE CASCADE,
  from_question_id UUID REFERENCES dynamic_question_generations(id) ON DELETE SET NULL,
  policy          TEXT NOT NULL,
  reason_code     TEXT NOT NULL,
  decision        JSONB NOT NULL DEFAULT '{}'::jsonb,
  engine_version  TEXT NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS aqb_session_idx ON adaptive_question_branches (session_id, occurred_at DESC);

-- Per-user cognitive profile snapshot (append-only history).
CREATE TABLE IF NOT EXISTS cognitive_runtime_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL,
  session_id       UUID REFERENCES dynamic_question_sessions(id) ON DELETE CASCADE,
  signals          JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence       NUMERIC(5,4),
  sample_size      INTEGER NOT NULL DEFAULT 0,
  engine_version   TEXT NOT NULL,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS crp_user_idx ON cognitive_runtime_profiles (user_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS crp_session_idx ON cognitive_runtime_profiles (session_id);

-- Detected contradictions (audit-only; never feeds scoring).
CREATE TABLE IF NOT EXISTS behavioral_contradiction_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT NOT NULL,
  session_id          UUID REFERENCES dynamic_question_sessions(id) ON DELETE CASCADE,
  contradiction_type  TEXT NOT NULL,
  severity            TEXT NOT NULL DEFAULT 'low',
  competencies        JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence            JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale           TEXT,
  engine_version      TEXT NOT NULL,
  detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bcl_user_idx ON behavioral_contradiction_logs (user_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS bcl_session_idx ON behavioral_contradiction_logs (session_id);

-- Per-question context signals used to compose the prompt (audit).
CREATE TABLE IF NOT EXISTS question_context_signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     UUID NOT NULL REFERENCES dynamic_question_generations(id) ON DELETE CASCADE,
  signal_type     TEXT NOT NULL,
  signal_payload  JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS qcs_question_idx ON question_context_signals (question_id);
CREATE INDEX IF NOT EXISTS qcs_type_idx ON question_context_signals (signal_type);
