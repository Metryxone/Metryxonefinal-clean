-- ============================================================
-- BIOS RIE — Recommendation & Intervention Engine Migration
-- All tables include tenant_id for multi-tenant support
-- ============================================================

-- ── Intervention Context (aggregated state snapshot per user/session) ─────
CREATE TABLE IF NOT EXISTS rie_intervention_context (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email            TEXT NOT NULL,
  tenant_id             UUID,
  session_id            UUID,
  behavioural_state     JSONB DEFAULT '{}',
  cognitive_state       JSONB DEFAULT '{}',
  emotional_state       JSONB DEFAULT '{}',
  resilience_state      JSONB DEFAULT '{}',
  risk_profile          JSONB DEFAULT '{}',
  opportunity_profile   JSONB DEFAULT '{}',
  csi_score             NUMERIC DEFAULT 0,
  csi_stage             TEXT DEFAULT 'Forming',
  lbi_score             NUMERIC DEFAULT 0,
  dropout_risk          NUMERIC DEFAULT 0,
  burnout_probability   NUMERIC DEFAULT 0,
  employability_readiness NUMERIC DEFAULT 0,
  leadership_emergence  NUMERIC DEFAULT 0,
  emotional_load        NUMERIC DEFAULT 0,
  cognitive_load        NUMERIC DEFAULT 0,
  engagement_score      NUMERIC DEFAULT 50,
  risk_score            NUMERIC DEFAULT 0,
  composite_intensity   NUMERIC DEFAULT 0,
  crisis_detected       BOOLEAN DEFAULT FALSE,
  crisis_type           TEXT,
  context_version       INTEGER DEFAULT 1,
  computed_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_email)
);
CREATE INDEX IF NOT EXISTS idx_rie_ctx_email    ON rie_intervention_context(user_email);
CREATE INDEX IF NOT EXISTS idx_rie_ctx_risk     ON rie_intervention_context(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_rie_ctx_crisis   ON rie_intervention_context(crisis_detected) WHERE crisis_detected = TRUE;

-- ── RIE Recommendations ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rie_recommendations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email            TEXT NOT NULL,
  tenant_id             UUID,
  session_id            UUID,
  rec_type              TEXT NOT NULL,
  domain                TEXT NOT NULL,
  title                 TEXT NOT NULL,
  rationale             JSONB DEFAULT '[]',
  contributing_signals  JSONB DEFAULT '[]',
  confidence            NUMERIC DEFAULT 0.5,
  timing                TEXT DEFAULT 'immediate',
  intensity             TEXT DEFAULT 'moderate',
  priority              INTEGER DEFAULT 2,
  expected_outcome      TEXT,
  status                TEXT DEFAULT 'active',
  reviewed_by           TEXT,
  reviewed_at           TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rie_rec_email    ON rie_recommendations(user_email);
CREATE INDEX IF NOT EXISTS idx_rie_rec_type     ON rie_recommendations(rec_type);
CREATE INDEX IF NOT EXISTS idx_rie_rec_status   ON rie_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_rie_rec_priority ON rie_recommendations(priority);

-- ── RIE Interventions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rie_interventions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email            TEXT NOT NULL,
  tenant_id             UUID,
  session_id            UUID,
  domain                TEXT NOT NULL,
  intervention_mode     TEXT NOT NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  assigned_to           TEXT,
  escalation_level      TEXT DEFAULT 'none',
  status                TEXT DEFAULT 'pending',
  priority              TEXT DEFAULT 'medium',
  outcome_notes         TEXT,
  failure_reason        TEXT,
  attempt_count         INTEGER DEFAULT 0,
  saturation_detected   BOOLEAN DEFAULT FALSE,
  diminishing_returns   BOOLEAN DEFAULT FALSE,
  started_at            TIMESTAMPTZ,
  due_at                TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rie_int_email    ON rie_interventions(user_email);
CREATE INDEX IF NOT EXISTS idx_rie_int_status   ON rie_interventions(status);
CREATE INDEX IF NOT EXISTS idx_rie_int_esc      ON rie_interventions(escalation_level);

-- ── RIE Intervention Sequences (next-best-action ordering) ────────────────
CREATE TABLE IF NOT EXISTS rie_intervention_sequences (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email            TEXT NOT NULL,
  tenant_id             UUID,
  sequence_step         INTEGER NOT NULL,
  intervention_id       UUID REFERENCES rie_interventions(id) ON DELETE SET NULL,
  action_type           TEXT NOT NULL,
  action_label          TEXT NOT NULL,
  rationale             TEXT,
  status                TEXT DEFAULT 'pending',
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rie_seq_email    ON rie_intervention_sequences(user_email);
CREATE INDEX IF NOT EXISTS idx_rie_seq_step     ON rie_intervention_sequences(user_email, sequence_step);

-- ── RIE Recovery Profiles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rie_recovery_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email            TEXT NOT NULL,
  tenant_id             UUID,
  velocity              NUMERIC DEFAULT 0,
  stability             NUMERIC DEFAULT 0,
  sustainability        NUMERIC DEFAULT 0,
  momentum_score        NUMERIC DEFAULT 0,
  trajectory            TEXT DEFAULT 'unknown',
  collapse_detected     BOOLEAN DEFAULT FALSE,
  fatigue_detected      BOOLEAN DEFAULT FALSE,
  saturation_detected   BOOLEAN DEFAULT FALSE,
  sessions_analyzed     INTEGER DEFAULT 0,
  score_history         JSONB DEFAULT '[]',
  computed_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_email)
);
CREATE INDEX IF NOT EXISTS idx_rie_rec_profile_email ON rie_recovery_profiles(user_email);
CREATE INDEX IF NOT EXISTS idx_rie_rec_profile_traj  ON rie_recovery_profiles(trajectory);

-- ── RIE Outcomes (intervention outcome tracking) ──────────────────────────
CREATE TABLE IF NOT EXISTS rie_outcomes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email            TEXT NOT NULL,
  tenant_id             UUID,
  intervention_id       UUID REFERENCES rie_interventions(id) ON DELETE CASCADE,
  outcome_type          TEXT NOT NULL,
  score_before          NUMERIC,
  score_after           NUMERIC,
  delta                 NUMERIC,
  success               BOOLEAN DEFAULT FALSE,
  notes                 TEXT,
  recorded_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rie_outcome_intervention ON rie_outcomes(intervention_id);
CREATE INDEX IF NOT EXISTS idx_rie_outcome_email        ON rie_outcomes(user_email);

-- ── RIE Escalations ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rie_escalations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email            TEXT NOT NULL,
  tenant_id             UUID,
  session_id            UUID,
  escalation_type       TEXT NOT NULL,
  severity              TEXT DEFAULT 'medium',
  trigger_reason        TEXT,
  trigger_signals       JSONB DEFAULT '[]',
  requires_counsellor   BOOLEAN DEFAULT FALSE,
  requires_mentor       BOOLEAN DEFAULT FALSE,
  requires_peer_support BOOLEAN DEFAULT FALSE,
  mandatory_human_review BOOLEAN DEFAULT FALSE,
  assigned_to           TEXT,
  assigned_to_name      TEXT,
  status                TEXT DEFAULT 'pending',
  resolution_notes      TEXT,
  resolved_by           TEXT,
  resolved_at           TIMESTAMPTZ,
  acknowledged_at       TIMESTAMPTZ,
  acknowledged_by       TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rie_escalations ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;
ALTER TABLE rie_escalations ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE rie_escalations ADD COLUMN IF NOT EXISTS acknowledged_by TEXT;
CREATE INDEX IF NOT EXISTS idx_rie_esc_email    ON rie_escalations(user_email);
CREATE INDEX IF NOT EXISTS idx_rie_esc_status   ON rie_escalations(status);
CREATE INDEX IF NOT EXISTS idx_rie_esc_sev      ON rie_escalations(severity);
CREATE INDEX IF NOT EXISTS idx_rie_esc_mandatory ON rie_escalations(mandatory_human_review) WHERE mandatory_human_review = TRUE;

-- ── RIE Opportunity Flags ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rie_opportunity_flags (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email            TEXT NOT NULL,
  tenant_id             UUID,
  opportunity_type      TEXT NOT NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  cascade_model         JSONB DEFAULT '[]',
  confidence            NUMERIC DEFAULT 0.5,
  amplification_actions JSONB DEFAULT '[]',
  status                TEXT DEFAULT 'active',
  actioned_by           TEXT,
  actioned_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rie_opp_email    ON rie_opportunity_flags(user_email);
CREATE INDEX IF NOT EXISTS idx_rie_opp_type     ON rie_opportunity_flags(opportunity_type);
CREATE INDEX IF NOT EXISTS idx_rie_opp_status   ON rie_opportunity_flags(status);
