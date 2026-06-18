-- ============================================================================
-- 4-tier Behavioural Signal Ontology — schema
-- Sources: audited_domains.csv (20) · audited_families.csv (400) ·
--          audited_signals.csv (20) · audited_atomic_signals.csv (15,972)
-- All routing/categorical columns default to 'UNASSIGNED_ROUTING_NODE' so
-- Drizzle/NOT NULL constraints can't crash mid-seed.
-- Idempotent — every CREATE uses IF NOT EXISTS; seed script TRUNCATEs.
-- ============================================================================

-- ─── Tier 1: Domains ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capadex_domains (
  id                          SERIAL PRIMARY KEY,
  domain_id                   TEXT NOT NULL UNIQUE,
  domain_name                 TEXT NOT NULL,
  domain_purpose              TEXT NOT NULL DEFAULT '',
  primary_focus               TEXT NOT NULL DEFAULT '',
  key_behavioral_scope        TEXT NOT NULL DEFAULT '',
  example_signal_families     TEXT NOT NULL DEFAULT '',
  core_risk_areas             TEXT NOT NULL DEFAULT '',
  intervention_orientation    TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  longitudinal_importance     TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  adaptive_runtime_importance TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  relational_bridge_tag       TEXT NOT NULL DEFAULT 'GENERAL_CONCERN',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_capadex_domains_domain_id ON capadex_domains (domain_id);
CREATE INDEX IF NOT EXISTS idx_capadex_domains_bridge    ON capadex_domains (relational_bridge_tag);

-- ─── Tier 2: Families ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capadex_families (
  id                    SERIAL PRIMARY KEY,
  family_id             TEXT NOT NULL UNIQUE,
  domain_id             TEXT NOT NULL,
  domain                TEXT NOT NULL DEFAULT '',  -- denormalised display name
  family_name           TEXT NOT NULL,
  family_purpose        TEXT NOT NULL DEFAULT '',
  key_behavioral_scope  TEXT NOT NULL DEFAULT '',
  relational_bridge_tag TEXT NOT NULL DEFAULT 'GENERAL_CONCERN',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_capadex_families_family_id ON capadex_families (family_id);
CREATE INDEX IF NOT EXISTS idx_capadex_families_domain_id ON capadex_families (domain_id);
CREATE INDEX IF NOT EXISTS idx_capadex_families_bridge    ON capadex_families (relational_bridge_tag);

-- ─── Tier 3: Signals (the 20-signal taxonomy) ──────────────────────────────
CREATE TABLE IF NOT EXISTS capadex_signals (
  id                          SERIAL PRIMARY KEY,
  signal_id                   TEXT NOT NULL UNIQUE,
  signal_name                 TEXT NOT NULL,
  domain                      TEXT NOT NULL DEFAULT '',
  signal_family               TEXT NOT NULL DEFAULT '',
  category                    TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  detection_type              TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  source_types                TEXT NOT NULL DEFAULT '',
  severity_weight             REAL,
  confidence_weight           REAL,
  persistence_weight          REAL,
  volatility                  TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  adaptive_importance         TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  intervention_priority       TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  behavioral_meaning          TEXT NOT NULL DEFAULT '',
  hidden_pattern_contribution TEXT NOT NULL DEFAULT '',
  amplification_rules         TEXT NOT NULL DEFAULT '',
  contradiction_links         TEXT NOT NULL DEFAULT '',
  related_signals             TEXT NOT NULL DEFAULT '',
  recovery_indicator          TEXT NOT NULL DEFAULT '',
  longitudinal_impact         TEXT NOT NULL DEFAULT '',
  risk_mapping                TEXT NOT NULL DEFAULT '',
  relational_bridge_tag       TEXT NOT NULL DEFAULT 'GENERAL_CONCERN',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_capadex_signals_signal_id ON capadex_signals (signal_id);
CREATE INDEX IF NOT EXISTS idx_capadex_signals_bridge    ON capadex_signals (relational_bridge_tag);
CREATE INDEX IF NOT EXISTS idx_capadex_signals_category  ON capadex_signals (category);

-- ─── Tier 4: Atomic Signals (the 15,972-row leaf catalogue) ────────────────
CREATE TABLE IF NOT EXISTS capadex_atomic_signals (
  id                          SERIAL PRIMARY KEY,
  atomic_signal_id            TEXT NOT NULL UNIQUE,
  family_id                   TEXT NOT NULL,
  domain_id                   TEXT NOT NULL,
  domain_name                 TEXT NOT NULL DEFAULT '',
  family_name                 TEXT NOT NULL DEFAULT '',
  atomic_signal_name          TEXT NOT NULL,
  signal_label                TEXT NOT NULL DEFAULT '',
  signal_definition           TEXT NOT NULL DEFAULT '',
  signal_category             TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  detection_type              TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  primary_behavioral_scope    TEXT NOT NULL DEFAULT '',
  secondary_behavioral_scope  TEXT NOT NULL DEFAULT '',
  severity_weight             REAL,
  confidence_weight           REAL,
  persistence_weight          REAL,
  volatility                  TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  adaptive_importance         TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  intervention_priority       TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  emotional_sensitivity       TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  cognitive_load_impact       TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  longitudinal_importance     TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  recovery_indicator          TEXT NOT NULL DEFAULT '',
  hidden_pattern_contribution TEXT NOT NULL DEFAULT '',
  amplification_rules         TEXT NOT NULL DEFAULT '',
  suppression_rules           TEXT NOT NULL DEFAULT '',
  contradiction_links         TEXT NOT NULL DEFAULT '',
  related_signals             TEXT NOT NULL DEFAULT '',
  progression_risk            TEXT NOT NULL DEFAULT '',
  regression_risk             TEXT NOT NULL DEFAULT '',
  risk_mapping                TEXT NOT NULL DEFAULT '',
  intervention_mapping        TEXT NOT NULL DEFAULT '',
  telemetry_sources           TEXT NOT NULL DEFAULT '',
  question_sources            TEXT NOT NULL DEFAULT '',
  runtime_visibility          TEXT NOT NULL DEFAULT '',
  explainability_level        TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  persona_sensitivity         TEXT NOT NULL DEFAULT '',
  cultural_context_fit        TEXT NOT NULL DEFAULT '',
  execution_relevance         TEXT NOT NULL DEFAULT '',
  employability_relevance     TEXT NOT NULL DEFAULT '',
  learning_relevance          TEXT NOT NULL DEFAULT '',
  behavioral_examples         TEXT NOT NULL DEFAULT '',
  signal_status               TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  age_min                     INTEGER NOT NULL DEFAULT 17,
  age_max                     INTEGER NOT NULL DEFAULT 24,
  relational_bridge_tag       TEXT NOT NULL DEFAULT 'GENERAL_CONCERN',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_capadex_atomic_atomic_id ON capadex_atomic_signals (atomic_signal_id);
CREATE INDEX IF NOT EXISTS idx_capadex_atomic_family_id ON capadex_atomic_signals (family_id);
CREATE INDEX IF NOT EXISTS idx_capadex_atomic_domain_id ON capadex_atomic_signals (domain_id);
CREATE INDEX IF NOT EXISTS idx_capadex_atomic_bridge    ON capadex_atomic_signals (relational_bridge_tag);
CREATE INDEX IF NOT EXISTS idx_capadex_atomic_status    ON capadex_atomic_signals (signal_status);
CREATE INDEX IF NOT EXISTS idx_capadex_atomic_category  ON capadex_atomic_signals (signal_category);

-- ─── Foreign keys (created NOT VALID, validated after seed) ────────────────
-- We add as NOT VALID so the constraint can exist before rows are loaded;
-- the seed script repairs 40 FFAM_* typos + drops 3 phantom rows so every
-- family_id/domain_id in atomic resolves cleanly. After bulk insert the
-- seed runs `ALTER TABLE ... VALIDATE CONSTRAINT ...` to lock in referential
-- integrity for all future writes.
DO $$ BEGIN
  ALTER TABLE capadex_families
    ADD CONSTRAINT fk_capadex_families_domain
    FOREIGN KEY (domain_id) REFERENCES capadex_domains(domain_id)
    ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE capadex_atomic_signals
    ADD CONSTRAINT fk_capadex_atomic_family
    FOREIGN KEY (family_id) REFERENCES capadex_families(family_id)
    ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE capadex_atomic_signals
    ADD CONSTRAINT fk_capadex_atomic_domain
    FOREIGN KEY (domain_id) REFERENCES capadex_domains(domain_id)
    ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
