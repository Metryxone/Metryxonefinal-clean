-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Phase 4 — Configurable Scientific EI Engine                         ║
-- ║                                                                       ║
-- ║  Moves every hardcoded EI weight/cap/multiplier/threshold/formula     ║
-- ║  into a versioned, auditable ruleset that admins can preview, swap,   ║
-- ║  rollback, and compare without code changes.                          ║
-- ║                                                                       ║
-- ║  Seeds a default ruleset (v1.0.0) whose values reproduce the          ║
-- ║  current scoring byte-for-byte so the refactor is observably          ║
-- ║  back-compatible.                                                     ║
-- ║                                                                       ║
-- ║  Design principles:                                                   ║
-- ║   - Deterministic. No ML. Every output traceable.                     ║
-- ║   - Explainable. ei_calculation_logs records every dimension's        ║
-- ║     inputs, formula, intermediate values, and contribution.           ║
-- ║   - Reproducible. Every calculation pinned to version triple          ║
-- ║     (ruleset, taxonomy, institution_dataset, confidence_model).       ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1) ei_rulesets ────────────────────────────────────────────
-- One row per published ruleset version. The active ruleset is the most
-- recent row with status='active'. Old rulesets are retained forever for
-- historical reproducibility.
CREATE TABLE IF NOT EXISTS ei_rulesets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version          TEXT NOT NULL UNIQUE,                     -- semver e.g. '1.0.0'
  name             TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'draft',            -- draft|active|deprecated|archived
  is_default       BOOLEAN NOT NULL DEFAULT FALSE,           -- the seed ruleset
  -- ALL knobs live here. Schema is documented inline below.
  -- Anyone reading this column should be able to predict the score from the inputs.
  config           JSONB NOT NULL,
  -- Pinned dependency versions at publication time (denormalised for snapshots)
  taxonomy_version            TEXT,
  institution_dataset_version TEXT,
  confidence_model_version    TEXT,
  -- Governance
  created_by       TEXT,
  approved_by      TEXT,
  approved_at      TIMESTAMPTZ,
  activated_at     TIMESTAMPTZ,
  deprecated_at    TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rulesets_status  ON ei_rulesets(status);
CREATE INDEX IF NOT EXISTS idx_rulesets_active  ON ei_rulesets(activated_at DESC) WHERE status = 'active';

-- ── 2) ei_dimension_rules ─────────────────────────────────────
-- Per-ruleset dimension breakdown. One row per dimension (completeness,
-- technical, soft, experience, certifications, projects, institution_bonus,
-- qualification_bonus). Lets admins tweak a single dimension without
-- republishing the whole ruleset (creates a new draft revision).
CREATE TABLE IF NOT EXISTS ei_dimension_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_id      UUID NOT NULL REFERENCES ei_rulesets(id) ON DELETE CASCADE,
  dimension_key   TEXT NOT NULL,                             -- e.g. 'technical'
  display_name    TEXT NOT NULL,
  weight          NUMERIC(6,3) NOT NULL,                     -- contribution cap (e.g. 20 for technical)
  formula_type    TEXT NOT NULL,                             -- 'count_linear'|'weighted_sum'|'percent'|'evidence_only'
  formula_config  JSONB NOT NULL,                            -- per-formula params
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  display_order   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ruleset_id, dimension_key)
);
CREATE INDEX IF NOT EXISTS idx_dimrules_ruleset ON ei_dimension_rules(ruleset_id);

-- ── 3) ei_weight_versions ─────────────────────────────────────
-- Lightweight ledger that snapshots {dimension → weight} for every published
-- ruleset. Cheap to query for "weight evolution over time" analytics.
CREATE TABLE IF NOT EXISTS ei_weight_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_id      UUID NOT NULL REFERENCES ei_rulesets(id) ON DELETE CASCADE,
  ruleset_version TEXT NOT NULL,
  weights         JSONB NOT NULL,                            -- {completeness:45, technical:20, ...}
  total_cap       NUMERIC(6,2) NOT NULL,
  band_thresholds JSONB NOT NULL,                            -- {Excellent:80, Strong:65, ...}
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_weightver_ruleset ON ei_weight_versions(ruleset_id);

-- ── 4) ei_snapshot_versions ───────────────────────────────────
-- Nightly per-user EI snapshots. The longitudinal table behind trajectory
-- charts. Every snapshot is pinned to all version dependencies so the
-- score is reproducible even after rulesets evolve.
CREATE TABLE IF NOT EXISTS ei_snapshot_versions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     TEXT NOT NULL,
  snapshot_date               DATE NOT NULL,
  -- Scores
  capability_score            INTEGER NOT NULL,
  trusted_score               INTEGER,
  trust_score                 INTEGER,
  trust_multiplier            NUMERIC(5,3),
  band                        TEXT,
  -- Full breakdown for time-series charts
  breakdown                   JSONB NOT NULL,
  -- Profile snapshot (denormalised — minimal, just what's needed to recompute)
  profile_hash                TEXT,                          -- sha256 of resolved profile inputs
  resolved_profile            JSONB,                         -- the ResolverOutput at time of snapshot
  -- Versioning quad
  ei_version                  TEXT NOT NULL DEFAULT '4.0',
  ruleset_version             TEXT NOT NULL,
  taxonomy_version            TEXT,
  institution_dataset_version TEXT,
  confidence_model_version    TEXT,
  -- Confidence
  profile_confidence_score    INTEGER,
  evidence_quality_score      INTEGER,
  uncertainty_flags           JSONB,                         -- array of {flag, severity, basis}
  -- Source
  source                      TEXT NOT NULL DEFAULT 'nightly', -- nightly|on_demand|admin_recompute
  computation_ms              INTEGER,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_snapver_user_date ON ei_snapshot_versions(user_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapver_ruleset   ON ei_snapshot_versions(ruleset_version);

-- ── 5) ei_calculation_logs ────────────────────────────────────
-- Per-calculation traceability ledger. One row per /api/ei/resolve call
-- (or admin recompute). Stores every dimension's inputs, formula, intermediate
-- values, and contribution so support / governance can audit "why did this
-- user score X". Retained for the regulatory window.
CREATE TABLE IF NOT EXISTS ei_calculation_logs (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     TEXT,                          -- nullable (anonymous resolves OK)
  request_id                  TEXT,                          -- correlates to api log line
  -- Scores
  capability_score            INTEGER NOT NULL,
  trusted_score               INTEGER,
  band                        TEXT,
  -- Versioning quad
  ei_version                  TEXT NOT NULL,
  ruleset_id                  UUID REFERENCES ei_rulesets(id),
  ruleset_version             TEXT NOT NULL,
  taxonomy_version            TEXT,
  institution_dataset_version TEXT,
  confidence_model_version    TEXT,
  -- Traceability payload
  dimensions                  JSONB NOT NULL,                -- array of {key, inputs, formula, intermediate, contribution}
  evidence_refs               JSONB,                         -- canonical_ids referenced
  provenance_refs             JSONB,                         -- ref_provenance ids
  trust_adjustments           JSONB,                         -- {applied:bool, multiplier, components_used}
  normalization_details       JSONB,                         -- clamps applied, unit conversions
  confidence                  JSONB,                         -- {profile, evidence_quality, flags}
  -- Source
  source                      TEXT NOT NULL DEFAULT 'resolve', -- resolve|snapshot|admin
  computation_ms              INTEGER,
  fallback_used               BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calclog_user_time ON ei_calculation_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calclog_ruleset   ON ei_calculation_logs(ruleset_id);
CREATE INDEX IF NOT EXISTS idx_calclog_created   ON ei_calculation_logs(created_at DESC);

-- ── 6) ei_confidence_models ───────────────────────────────────
-- Configurable confidence-scoring model (also versioned). Confidence is
-- intentionally a rules-based composite of explainable signals — never an
-- opaque ML score.
CREATE TABLE IF NOT EXISTS ei_confidence_models (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version         TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft',             -- draft|active|deprecated
  config          JSONB NOT NULL,                            -- weights for each confidence dimension
  uncertainty_rules JSONB,                                    -- rule list that flips uncertainty flags
  notes           TEXT,
  created_by      TEXT,
  approved_by     TEXT,
  activated_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_confmodel_status ON ei_confidence_models(status);

-- ── 7) Audit table for governance changes ─────────────────────
-- Tracks every state change (activate/deactivate/rollback) so the
-- compliance team has a complete chain of custody on scoring policy.
CREATE TABLE IF NOT EXISTS ei_governance_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_id  UUID REFERENCES ei_rulesets(id),
  event_type  TEXT NOT NULL,                                 -- created|activated|deprecated|rolled_back|previewed|compared
  actor_id    TEXT,
  actor_email TEXT,
  before_state JSONB,
  after_state  JSONB,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_govevent_ruleset ON ei_governance_events(ruleset_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- SEED: Default ruleset v1.0.0 (back-compat snapshot of current logic)
-- ══════════════════════════════════════════════════════════════
-- The config block below MUST mirror the constants in services/ei-engine.ts
-- exactly. Any deviation will change live scores. Refactor verification
-- runs assert that loading this ruleset reproduces existing scores
-- byte-for-byte for a set of golden profiles.

INSERT INTO ei_rulesets (version, name, description, status, is_default, config,
  taxonomy_version, institution_dataset_version, confidence_model_version,
  created_by, approved_by, approved_at, activated_at, notes)
VALUES (
  '1.0.0',
  'MetryxOne Default EI (Phase 2/3 parity)',
  'Initial published ruleset. Reproduces the hardcoded EI scoring from Phase 2/3 byte-for-byte. Use as the baseline for all A/B comparisons and rollbacks.',
  'active', TRUE,
  jsonb_build_object(
    'total_cap', 99,
    'bands', jsonb_build_object(
      'Excellent',   80,
      'Strong',      65,
      'Good',        50,
      'Developing',  35,
      'Starter',      0
    ),
    'dimensions', jsonb_build_object(
      'completeness', jsonb_build_object(
        'enabled', true, 'weight', 45, 'formula', 'percent',
        'params', jsonb_build_object('multiplier', 0.45, 'cap', 45)
      ),
      'technical', jsonb_build_object(
        'enabled', true, 'weight', 20, 'formula', 'weighted_sum_skills',
        'params', jsonb_build_object(
          'base_per_skill', 2.5,
          'unresolved_credit_factor', 0.5,
          'demand_weight_floor', 0.5,
          'demand_weight_span',  0.5,
          'confidence_floor', 0.5,
          'cap', 20
        )
      ),
      'soft', jsonb_build_object(
        'enabled', true, 'weight', 10, 'formula', 'count_linear',
        'params', jsonb_build_object('per_unit', 1.5, 'cap', 10)
      ),
      'experience', jsonb_build_object(
        'enabled', true, 'weight', 15, 'formula', 'count_linear',
        'params', jsonb_build_object('per_unit', 5, 'cap', 15)
      ),
      'certifications', jsonb_build_object(
        'enabled', true, 'weight', 6, 'formula', 'weighted_sum_certs',
        'params', jsonb_build_object(
          'tier_weights', jsonb_build_object(
            'tier_1', 2.5, 'tier_2', 1.75, 'tier_3', 1.0, 'unverified', 0.5
          ),
          'unresolved_credit', 0.5,
          'confidence_floor', 0.5,
          'cap', 6
        )
      ),
      'projects', jsonb_build_object(
        'enabled', true, 'weight', 6, 'formula', 'count_linear',
        'params', jsonb_build_object('per_unit', 1.5, 'cap', 6)
      ),
      'institution_bonus', jsonb_build_object(
        'enabled', true, 'weight', 0, 'formula', 'evidence_only', 'params', jsonb_build_object()
      ),
      'qualification_bonus', jsonb_build_object(
        'enabled', true, 'weight', 0, 'formula', 'evidence_only', 'params', jsonb_build_object()
      )
    ),
    'rounding', jsonb_build_object('breakdown_decimals', 1, 'final_decimals', 0)
  ),
  'phase2.0', 'phase2.0', '1.0',
  'system', 'system', NOW(), NOW(),
  'Seed — preserves current scoring exactly. Do not edit; create a new draft to evolve.'
)
ON CONFLICT (version) DO NOTHING;

-- Seed default confidence model v1.0
INSERT INTO ei_confidence_models (version, name, status, config, uncertainty_rules, created_by, approved_by, activated_at, notes)
VALUES (
  '1.0',
  'Profile Confidence v1 (resolver + evidence)',
  'active',
  jsonb_build_object(
    'profile_confidence', jsonb_build_object(
      'source', 'resolver',
      'note', 'mirrors ResolverOutput.profile_confidence_score for back-compat'
    ),
    'evidence_quality', jsonb_build_object(
      'institution_matched_pts', 20,
      'qualification_matched_pts', 15,
      'per_matched_skill_pts', 2,
      'per_matched_cert_pts', 3,
      'per_verified_credential_pts', 10,
      'per_provenance_ref_pts', 1,
      'cap', 100
    )
  ),
  jsonb_build_array(
    jsonb_build_object('flag', 'institution_unresolved', 'severity', 'medium',
      'basis', 'No canonical institution match — relying on free-text claim'),
    jsonb_build_object('flag', 'low_skill_coverage', 'severity', 'low',
      'basis', 'Fewer than 3 resolved technical skills'),
    jsonb_build_object('flag', 'all_self_declared', 'severity', 'high',
      'basis', 'No verified credentials present'),
    jsonb_build_object('flag', 'stale_snapshot', 'severity', 'low',
      'basis', 'Last snapshot older than 30 days'),
    jsonb_build_object('flag', 'confidence_volatility', 'severity', 'medium',
      'basis', 'Profile confidence varied >20 pts in last 7 days')
  ),
  'system', 'system', NOW(),
  'Seed confidence model. Adjustable via /api/admin/ei/confidence-models.'
)
ON CONFLICT (version) DO NOTHING;

-- Seed dimension rule rows + weight snapshot for the default ruleset
DO $$
DECLARE rs_id UUID;
BEGIN
  SELECT id INTO rs_id FROM ei_rulesets WHERE version = '1.0.0';
  IF rs_id IS NULL THEN RETURN; END IF;

  INSERT INTO ei_dimension_rules (ruleset_id, dimension_key, display_name, weight, formula_type, formula_config, display_order)
  VALUES
    (rs_id, 'completeness',        'Profile Completeness',  45, 'percent',              jsonb_build_object('multiplier', 0.45, 'cap', 45),                                                                                                                                                                                                              1),
    (rs_id, 'technical',           'Technical Skills',      20, 'weighted_sum_skills',  jsonb_build_object('base_per_skill', 2.5, 'unresolved_credit_factor', 0.5, 'demand_weight_floor', 0.5, 'demand_weight_span', 0.5, 'confidence_floor', 0.5, 'cap', 20),                                                                                          2),
    (rs_id, 'soft',                'Soft Skills',           10, 'count_linear',         jsonb_build_object('per_unit', 1.5, 'cap', 10),                                                                                                                                                                                                                3),
    (rs_id, 'experience',          'Experience',            15, 'count_linear',         jsonb_build_object('per_unit', 5, 'cap', 15),                                                                                                                                                                                                                 4),
    (rs_id, 'certifications',      'Certifications',         6, 'weighted_sum_certs',   jsonb_build_object('tier_weights', jsonb_build_object('tier_1', 2.5, 'tier_2', 1.75, 'tier_3', 1.0, 'unverified', 0.5), 'unresolved_credit', 0.5, 'confidence_floor', 0.5, 'cap', 6),                                                                          5),
    (rs_id, 'projects',            'Projects',               6, 'count_linear',         jsonb_build_object('per_unit', 1.5, 'cap', 6),                                                                                                                                                                                                                6),
    (rs_id, 'institution_bonus',   'Institution Tier',       0, 'evidence_only',        jsonb_build_object(),                                                                                                                                                                                                                                          7),
    (rs_id, 'qualification_bonus', 'Qualification Tier',     0, 'evidence_only',        jsonb_build_object(),                                                                                                                                                                                                                                          8)
  ON CONFLICT (ruleset_id, dimension_key) DO NOTHING;

  INSERT INTO ei_weight_versions (ruleset_id, ruleset_version, weights, total_cap, band_thresholds)
  VALUES (
    rs_id, '1.0.0',
    jsonb_build_object('completeness', 45, 'technical', 20, 'soft', 10, 'experience', 15, 'certifications', 6, 'projects', 6),
    99,
    jsonb_build_object('Excellent', 80, 'Strong', 65, 'Good', 50, 'Developing', 35, 'Starter', 0)
  );

  INSERT INTO ei_governance_events (ruleset_id, event_type, actor_id, actor_email, after_state, notes)
  VALUES (rs_id, 'activated', 'system', 'system@metryx.one',
    jsonb_build_object('version', '1.0.0', 'status', 'active'),
    'Initial seed activation — Phase 4 parity baseline.');
END $$;
