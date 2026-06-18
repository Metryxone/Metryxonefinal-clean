-- ─── Conversational Quality Engine — Phase 2 S11 ──────────────────────────
-- Stores per-session quality snapshots tracking 8 quality dimensions,
-- composite scores, and active runtime directives.

CREATE TABLE IF NOT EXISTS conversational_quality_snapshots (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id               TEXT NOT NULL,

  -- 8 quality dimensions (0-100, higher = better)
  -- runtime_friction and user_fatigue are stored raw (higher = worse)
  -- and inverted only in composite calculation
  conversational_coherence  NUMERIC(5,2) NOT NULL DEFAULT 50,
  engagement_quality        NUMERIC(5,2) NOT NULL DEFAULT 50,
  emotional_safety          NUMERIC(5,2) NOT NULL DEFAULT 80,
  conversational_smoothness NUMERIC(5,2) NOT NULL DEFAULT 50,
  adaptive_effectiveness    NUMERIC(5,2) NOT NULL DEFAULT 50,
  evidence_quality          NUMERIC(5,2) NOT NULL DEFAULT 50,
  runtime_friction          NUMERIC(5,2) NOT NULL DEFAULT 20,
  user_fatigue              NUMERIC(5,2) NOT NULL DEFAULT 20,

  -- Composite / derived scores (0-100)
  overall_quality_score     NUMERIC(5,2) NOT NULL DEFAULT 50,
  adaptation_quality        NUMERIC(5,2) NOT NULL DEFAULT 50,
  orchestration_quality     NUMERIC(5,2) NOT NULL DEFAULT 50,
  emotional_safety_score    NUMERIC(5,2) NOT NULL DEFAULT 80,

  -- Active runtime directives as JSONB array of strings
  -- e.g. ["slow_pacing","prevent_escalation"]
  active_directives         JSONB NOT NULL DEFAULT '[]',
  directive_count           INTEGER NOT NULL DEFAULT 0,

  -- Session context at time of evaluation
  question_count            INTEGER NOT NULL DEFAULT 0,
  tenant_id                 TEXT,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cqs_session_id   ON conversational_quality_snapshots (session_id);
CREATE INDEX IF NOT EXISTS idx_cqs_created_at   ON conversational_quality_snapshots (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cqs_overall_score ON conversational_quality_snapshots (overall_quality_score);
CREATE INDEX IF NOT EXISTS idx_cqs_directive_count ON conversational_quality_snapshots (directive_count) WHERE directive_count > 0;

-- ─── Feature flag ────────────────────────────────────────────────────────────
INSERT INTO feature_flags (flag_key, enabled, label, phase)
VALUES ('conversational_quality', false, 'Conversational Quality Engine', 'phase2')
ON CONFLICT (flag_key) DO NOTHING;
