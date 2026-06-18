-- =============================================================================
-- MetryxOne — Complete Competency Ontology Architecture
-- Migration: 20260613_competency_ontology_complete.sql
--
-- Hierarchy:
--   Industry → Function → Department → Role Family → Role
--     → Layer → Competency Cluster → Competency → Micro Competency
--       → Concern → Indicator → Assessment Question
--
-- Table prefixes:
--   ont_   master / entity tables (the nouns of the ontology)
--   map_   mapping / relationship tables (M2M joins + edge weights)
--   ref_   reference / lookup tables (canonical code lists, seeded)
--   ver_   version control tables  (immutable append-only snapshots)
--   lfc_   lifecycle tables         (status transition audit trail)
--   gov_   governance tables        (review schedules, quality gates)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- REFERENCE TABLES  (seeded with canonical values below the DDL)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref_seniority_levels (
  code            VARCHAR(20)   PRIMARY KEY,
  label           VARCHAR(80)   NOT NULL,
  level_order     SMALLINT      NOT NULL,
  is_leadership   BOOLEAN       NOT NULL DEFAULT false,
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  description     TEXT
);

CREATE TABLE IF NOT EXISTS ref_proficiency_levels (
  code            VARCHAR(20)   PRIMARY KEY,
  label           VARCHAR(80)   NOT NULL,
  level_order     SMALLINT      NOT NULL,
  score_band_min  NUMERIC(5,2)  NOT NULL DEFAULT 0,
  score_band_max  NUMERIC(5,2)  NOT NULL DEFAULT 100,
  description     TEXT,
  is_active       BOOLEAN       NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS ref_competency_categories (
  code        VARCHAR(30)   PRIMARY KEY,
  label       VARCHAR(80)   NOT NULL,
  description TEXT,
  color_hex   VARCHAR(7),
  icon_name   VARCHAR(60),
  sort_order  SMALLINT      NOT NULL DEFAULT 0,
  is_active   BOOLEAN       NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS ref_assessment_types (
  code             VARCHAR(30)   PRIMARY KEY,
  label            VARCHAR(80)   NOT NULL,
  description      TEXT,
  default_format   VARCHAR(30),
  is_active        BOOLEAN       NOT NULL DEFAULT true
);

-- Allowed lifecycle transitions per entity_type
-- Engines consult this to validate status changes
CREATE TABLE IF NOT EXISTS ref_lifecycle_transitions (
  id                SERIAL        PRIMARY KEY,
  entity_type       VARCHAR(60)   NOT NULL,
  from_status       VARCHAR(20)   NOT NULL,
  to_status         VARCHAR(20)   NOT NULL,
  requires_approval BOOLEAN       NOT NULL DEFAULT false,
  auto_notify       BOOLEAN       NOT NULL DEFAULT false,
  notes             TEXT,
  UNIQUE (entity_type, from_status, to_status)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MASTER ENTITIES — New (Layers, Clusters, Competencies, Micro Competencies,
--                        Ontology Concerns, Assessment Questions)
-- ─────────────────────────────────────────────────────────────────────────────

-- Layer: sits between Role and Competency Cluster.
-- Represents a thematic classification of competencies within a role
-- (e.g. Foundation, Functional Core, Leadership, Specialist).
CREATE TABLE IF NOT EXISTS ont_layers (
  id                    SERIAL        PRIMARY KEY,
  code                  VARCHAR(30)   NOT NULL UNIQUE,
  name                  VARCHAR(120)  NOT NULL,
  description           TEXT,
  -- proficiency | functional | behavioral | leadership | specialist | threshold
  layer_type            VARCHAR(30)   NOT NULL DEFAULT 'proficiency',
  -- which seniority levels this layer is relevant to (array of ref_seniority_levels.code)
  applies_to_seniority  TEXT[],
  -- weight used when computing role-level competency scores
  scoring_weight        NUMERIC(5,3)  NOT NULL DEFAULT 1.000,
  sort_order            SMALLINT      NOT NULL DEFAULT 0,
  is_active             BOOLEAN       NOT NULL DEFAULT true,
  status                VARCHAR(20)   NOT NULL DEFAULT 'draft',
  version               INTEGER       NOT NULL DEFAULT 1,
  created_by            TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Competency Cluster: a thematic grouping of related Competencies within a Layer
-- (e.g. "Communication & Influence", "Technical Mastery", "Strategic Thinking").
CREATE TABLE IF NOT EXISTS ont_competency_clusters (
  id              SERIAL        PRIMARY KEY,
  code            VARCHAR(30)   NOT NULL UNIQUE,
  name            VARCHAR(150)  NOT NULL,
  description     TEXT,
  -- primary layer this cluster belongs to (may appear in multiple layers via map_layer_cluster)
  layer_id        INTEGER       REFERENCES ont_layers(id) ON DELETE SET NULL,
  -- FK to ref_competency_categories.code
  category        VARCHAR(30),
  icon_name       VARCHAR(60),
  color_hex       VARCHAR(7),
  -- used to compute cluster-level aggregate score
  weight_default  NUMERIC(5,3)  NOT NULL DEFAULT 1.000,
  sort_order      SMALLINT      NOT NULL DEFAULT 0,
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  status          VARCHAR(20)   NOT NULL DEFAULT 'draft',
  version         INTEGER       NOT NULL DEFAULT 1,
  created_by      TEXT,
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Competency: the primary unit of the framework.
-- A named, measurable skill/attribute assigned to one or more Clusters.
CREATE TABLE IF NOT EXISTS ont_competencies (
  id                  SERIAL        PRIMARY KEY,
  code                VARCHAR(40)   NOT NULL UNIQUE,
  name                VARCHAR(180)  NOT NULL,
  description         TEXT,
  -- primary cluster (denormalized FK; precise ordering via map_cluster_competency)
  cluster_id          INTEGER       REFERENCES ont_competency_clusters(id) ON DELETE SET NULL,
  -- FK to ref_competency_categories.code
  category            VARCHAR(30),
  -- core | functional | leadership | specialist | threshold
  competency_type     VARCHAR(30)   NOT NULL DEFAULT 'core',
  -- how this competency is assessed (array of ref_assessment_types.code)
  assessment_methods  TEXT[],
  is_measurable       BOOLEAN       NOT NULL DEFAULT true,
  -- whether this competency is required (threshold) or good-to-have (aspirational)
  is_threshold        BOOLEAN       NOT NULL DEFAULT false,
  -- default weight in cluster aggregate
  weight_default      NUMERIC(5,3)  NOT NULL DEFAULT 1.000,
  -- free-text development advice
  development_guide   TEXT,
  -- link to external framework (e.g. SFIA, O*NET code)
  external_ref        VARCHAR(80),
  sort_order          SMALLINT      NOT NULL DEFAULT 0,
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  status              VARCHAR(20)   NOT NULL DEFAULT 'draft',
  version             INTEGER       NOT NULL DEFAULT 1,
  created_by          TEXT,
  reviewed_at         TIMESTAMPTZ,
  reviewed_by         TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Micro Competency: granular, proficiency-level-specific observable sub-skill.
-- Each Competency × proficiency_level pair may have one or more Micro Competencies.
CREATE TABLE IF NOT EXISTS ont_micro_competencies (
  id                    SERIAL        PRIMARY KEY,
  code                  VARCHAR(50)   NOT NULL UNIQUE,
  name                  VARCHAR(200)  NOT NULL,
  description           TEXT,
  competency_id         INTEGER       NOT NULL REFERENCES ont_competencies(id) ON DELETE RESTRICT,
  -- FK to ref_proficiency_levels.code — which proficiency level this MC targets
  proficiency_level     VARCHAR(20),
  -- what you observe when this micro competency IS present
  observable_behavior   TEXT          NOT NULL,
  -- what you observe when this micro competency IS ABSENT
  absence_indicator     TEXT,
  -- how a practitioner develops this MC
  development_focus     TEXT,
  -- how an assessor should assess this MC
  assessment_hint       TEXT,
  -- IRT difficulty (b parameter) if calibrated
  irt_b                 NUMERIC(6,4),
  sort_order            SMALLINT      NOT NULL DEFAULT 0,
  is_active             BOOLEAN       NOT NULL DEFAULT true,
  status                VARCHAR(20)   NOT NULL DEFAULT 'draft',
  version               INTEGER       NOT NULL DEFAULT 1,
  created_by            TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Ontology Concern: the behavioral / psychological concern that emerges when a
-- Micro Competency is absent or underdeveloped.
-- This is the ONTOLOGY-scoped view of a concern; it bridges to capadex_concerns_master
-- via concern_bridge_tag. It does NOT replace capadex_concerns_master.
CREATE TABLE IF NOT EXISTS ont_concerns (
  id                  SERIAL        PRIMARY KEY,
  code                VARCHAR(40)   NOT NULL UNIQUE,
  name                VARCHAR(200)  NOT NULL,
  description         TEXT,
  -- bridge to capadex_concerns_master.relational_bridge_tag — null if not yet mapped
  concern_bridge_tag  VARCHAR(120),
  -- bridge to capadex_concerns_master.concern_id (if exact match found)
  capadex_concern_id  TEXT,
  -- how severe this concern is when untreated: low | moderate | high | critical
  severity            VARCHAR(20)   NOT NULL DEFAULT 'moderate',
  -- the domain this concern belongs to (mirrors CAPADEX domain field)
  domain              VARCHAR(80),
  -- the behavioral cluster / category (mirrors CAPADEX concern_cluster)
  concern_cluster     VARCHAR(80),
  -- who this concern primarily affects: student | professional | transitioning | all
  primary_persona     VARCHAR(30)   NOT NULL DEFAULT 'all',
  age_min             SMALLINT,
  age_max             SMALLINT,
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  status              VARCHAR(20)   NOT NULL DEFAULT 'draft',
  version             INTEGER       NOT NULL DEFAULT 1,
  created_by          TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ont_concerns_bridge_tag_idx ON ont_concerns(concern_bridge_tag);
CREATE INDEX IF NOT EXISTS ont_concerns_capadex_id_idx ON ont_concerns(capadex_concern_id);

-- Assessment Question: canonical question store for the ontology.
-- Bridges to caf_question_bank (CAF) and capadex_clarity_questions (CAPADEX).
-- A question may be native (authored here) or linked (pulled from another system).
CREATE TABLE IF NOT EXISTS ont_assessment_questions (
  id                    SERIAL        PRIMARY KEY,
  code                  VARCHAR(50)   NOT NULL UNIQUE,
  stem                  TEXT          NOT NULL,
  -- FK to ref_assessment_types.code
  assessment_type       VARCHAR(30)   NOT NULL DEFAULT 'behavioral',
  -- likert_5 | likert_7 | mcq | open_text | situational | rating_scale
  response_format       VARCHAR(30)   NOT NULL DEFAULT 'likert_5',
  -- positive | negative  (polarity of the construct being measured)
  polarity              VARCHAR(10)   NOT NULL DEFAULT 'positive',
  reverse_score         BOOLEAN       NOT NULL DEFAULT false,
  difficulty_tier       VARCHAR(10)   NOT NULL DEFAULT 'medium',
  -- IRT parameters (b = difficulty, a = discrimination, c = guessing)
  irt_b                 NUMERIC(6,4),
  irt_a                 NUMERIC(6,4),
  irt_c                 NUMERIC(6,4),
  time_estimate_secs    SMALLINT      NOT NULL DEFAULT 90,
  instructions          TEXT,
  -- arrays for adaptive routing
  persona_filter        TEXT[],
  age_band_min          SMALLINT,
  age_band_max          SMALLINT,
  -- provenance: 'native' | 'caf' | 'capadex' | 'external'
  source                VARCHAR(20)   NOT NULL DEFAULT 'native',
  -- FK to caf_question_bank.id (if source = 'caf')
  caf_question_id       INTEGER,
  -- FK to capadex_clarity_questions.id (if source = 'capadex')
  clarity_question_id   INTEGER,
  is_anchor_item        BOOLEAN       NOT NULL DEFAULT false,
  is_active             BOOLEAN       NOT NULL DEFAULT true,
  status                VARCHAR(20)   NOT NULL DEFAULT 'draft',
  version               INTEGER       NOT NULL DEFAULT 1,
  created_by            TEXT,
  reviewed_at           TIMESTAMPTZ,
  reviewed_by           TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Options for MCQ / situational questions
CREATE TABLE IF NOT EXISTS ont_question_options (
  id            SERIAL        PRIMARY KEY,
  question_id   INTEGER       NOT NULL REFERENCES ont_assessment_questions(id) ON DELETE CASCADE,
  option_key    VARCHAR(10)   NOT NULL,
  option_text   TEXT          NOT NULL,
  score_value   NUMERIC(6,3)  NOT NULL DEFAULT 0,
  is_correct    BOOLEAN       NOT NULL DEFAULT false,
  sort_order    SMALLINT      NOT NULL DEFAULT 0,
  UNIQUE (question_id, option_key)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MAPPING TABLES  (all M2M or weighted edges)
-- ─────────────────────────────────────────────────────────────────────────────

-- Role ↔ Layer  (a role has multiple layers; a layer may apply to many roles)
CREATE TABLE IF NOT EXISTS map_role_layer (
  id                    SERIAL        PRIMARY KEY,
  role_id               INTEGER       NOT NULL REFERENCES ont_roles(id) ON DELETE CASCADE,
  layer_id              INTEGER       NOT NULL REFERENCES ont_layers(id) ON DELETE CASCADE,
  -- minimum proficiency expected at this role for this layer
  required_proficiency  VARCHAR(20),
  is_mandatory          BOOLEAN       NOT NULL DEFAULT true,
  sort_order            SMALLINT      NOT NULL DEFAULT 0,
  is_active             BOOLEAN       NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (role_id, layer_id)
);

-- Layer ↔ Competency Cluster  (a layer may include multiple clusters; a cluster may appear in multiple layers)
CREATE TABLE IF NOT EXISTS map_layer_cluster (
  id          SERIAL        PRIMARY KEY,
  layer_id    INTEGER       NOT NULL REFERENCES ont_layers(id) ON DELETE CASCADE,
  cluster_id  INTEGER       NOT NULL REFERENCES ont_competency_clusters(id) ON DELETE CASCADE,
  weight      NUMERIC(5,3)  NOT NULL DEFAULT 1.000,
  sort_order  SMALLINT      NOT NULL DEFAULT 0,
  is_active   BOOLEAN       NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (layer_id, cluster_id)
);

-- Competency Cluster ↔ Competency  (ordered, weighted; primary cluster is also FK on ont_competencies)
CREATE TABLE IF NOT EXISTS map_cluster_competency (
  id              SERIAL        PRIMARY KEY,
  cluster_id      INTEGER       NOT NULL REFERENCES ont_competency_clusters(id) ON DELETE CASCADE,
  competency_id   INTEGER       NOT NULL REFERENCES ont_competencies(id) ON DELETE CASCADE,
  weight_override NUMERIC(5,3),
  sort_order      SMALLINT      NOT NULL DEFAULT 0,
  is_primary      BOOLEAN       NOT NULL DEFAULT false,
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (cluster_id, competency_id)
);

-- Role → Competency  (flattened/direct edge; denormalized for fast querying)
-- importance_tier: mandatory | core | supplemental | developmental
CREATE TABLE IF NOT EXISTS map_role_competency (
  id                  SERIAL        PRIMARY KEY,
  role_id             INTEGER       NOT NULL REFERENCES ont_roles(id) ON DELETE CASCADE,
  competency_id       INTEGER       NOT NULL REFERENCES ont_competencies(id) ON DELETE CASCADE,
  importance_tier     VARCHAR(20)   NOT NULL DEFAULT 'core',
  weight              NUMERIC(5,3)  NOT NULL DEFAULT 1.000,
  -- minimum proficiency expected for this role
  min_proficiency     VARCHAR(20),
  -- target proficiency (what excellent looks like)
  target_proficiency  VARCHAR(20),
  -- 'manual' | 'derived' (auto-populated from role→layer→cluster→competency chain)
  source              VARCHAR(20)   NOT NULL DEFAULT 'derived',
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (role_id, competency_id)
);

-- Competency × Proficiency Level metadata
-- Captures per-level evidence examples, score thresholds, and calibration notes
CREATE TABLE IF NOT EXISTS map_competency_proficiency (
  id                    SERIAL        PRIMARY KEY,
  competency_id         INTEGER       NOT NULL REFERENCES ont_competencies(id) ON DELETE CASCADE,
  proficiency_level     VARCHAR(20)   NOT NULL,
  score_band_min        NUMERIC(5,2)  NOT NULL DEFAULT 0,
  score_band_max        NUMERIC(5,2)  NOT NULL DEFAULT 100,
  behavioural_anchors   TEXT[],
  sample_evidence       TEXT[],
  development_actions   TEXT[],
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (competency_id, proficiency_level)
);

-- Micro Competency → Concern  (when MC is absent, THIS concern may emerge)
CREATE TABLE IF NOT EXISTS map_micro_concern (
  id                    SERIAL        PRIMARY KEY,
  micro_competency_id   INTEGER       NOT NULL REFERENCES ont_micro_competencies(id) ON DELETE CASCADE,
  concern_id            INTEGER       NOT NULL REFERENCES ont_concerns(id) ON DELETE CASCADE,
  -- probability that this concern emerges when MC is absent: 0.0–1.0
  emergence_probability NUMERIC(4,3)  NOT NULL DEFAULT 0.500,
  relationship_note     TEXT,
  is_active             BOOLEAN       NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (micro_competency_id, concern_id)
);

-- Concern → Indicator  (explicit mapping with weight)
-- Supplements the bridge_tag-based join in the existing CAPADEX engine
CREATE TABLE IF NOT EXISTS map_concern_indicator (
  id              SERIAL        PRIMARY KEY,
  concern_id      INTEGER       NOT NULL REFERENCES ont_concerns(id) ON DELETE CASCADE,
  indicator_id    INTEGER       NOT NULL REFERENCES ont_indicators(id) ON DELETE CASCADE,
  weight          NUMERIC(4,3)  NOT NULL DEFAULT 0.500,
  is_primary      BOOLEAN       NOT NULL DEFAULT false,
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (concern_id, indicator_id)
);

-- Indicator → Assessment Question  (which question measures this indicator)
CREATE TABLE IF NOT EXISTS map_indicator_question (
  id              SERIAL        PRIMARY KEY,
  indicator_id    INTEGER       NOT NULL REFERENCES ont_indicators(id) ON DELETE CASCADE,
  question_id     INTEGER       NOT NULL REFERENCES ont_assessment_questions(id) ON DELETE CASCADE,
  -- primary measurement, or just correlated
  is_primary      BOOLEAN       NOT NULL DEFAULT false,
  weight          NUMERIC(4,3)  NOT NULL DEFAULT 1.000,
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (indicator_id, question_id)
);

-- Micro Competency → Assessment Question  (direct, bypasses the indicator hop)
CREATE TABLE IF NOT EXISTS map_micro_question (
  id                    SERIAL        PRIMARY KEY,
  micro_competency_id   INTEGER       NOT NULL REFERENCES ont_micro_competencies(id) ON DELETE CASCADE,
  question_id           INTEGER       NOT NULL REFERENCES ont_assessment_questions(id) ON DELETE CASCADE,
  is_primary            BOOLEAN       NOT NULL DEFAULT false,
  weight                NUMERIC(4,3)  NOT NULL DEFAULT 1.000,
  is_active             BOOLEAN       NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (micro_competency_id, question_id)
);

-- Competency ↔ Future Skill  (alignment / relatedness score)
CREATE TABLE IF NOT EXISTS map_competency_future_skill (
  id                SERIAL        PRIMARY KEY,
  competency_id     INTEGER       NOT NULL REFERENCES ont_competencies(id) ON DELETE CASCADE,
  future_skill_id   INTEGER       NOT NULL REFERENCES ont_future_skills(id) ON DELETE CASCADE,
  -- how strongly this competency underpins the future skill: 0.0–1.0
  alignment_score   NUMERIC(4,3)  NOT NULL DEFAULT 0.500,
  relationship_type VARCHAR(30)   NOT NULL DEFAULT 'underpins',
  is_active         BOOLEAN       NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (competency_id, future_skill_id)
);

-- Industry → Competency  (industry-specific importance weighting)
CREATE TABLE IF NOT EXISTS map_industry_competency (
  id                SERIAL        PRIMARY KEY,
  industry_id       INTEGER       NOT NULL REFERENCES ont_industries(id) ON DELETE CASCADE,
  competency_id     INTEGER       NOT NULL REFERENCES ont_competencies(id) ON DELETE CASCADE,
  importance_weight NUMERIC(4,3)  NOT NULL DEFAULT 1.000,
  notes             TEXT,
  is_active         BOOLEAN       NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (industry_id, competency_id)
);

-- Competency → Learning Path  (which learning path develops this competency)
CREATE TABLE IF NOT EXISTS map_competency_learning_path (
  id                  SERIAL        PRIMARY KEY,
  competency_id       INTEGER       NOT NULL REFERENCES ont_competencies(id) ON DELETE CASCADE,
  learning_path_id    INTEGER       NOT NULL REFERENCES ont_learning_paths(id) ON DELETE CASCADE,
  -- primary vehicle or supplemental
  relationship_type   VARCHAR(20)   NOT NULL DEFAULT 'primary',
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (competency_id, learning_path_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- VERSION CONTROL TABLES
-- Immutable append-only; no DELETEs, no UPDATEs.
-- ─────────────────────────────────────────────────────────────────────────────

-- Full entity snapshot captured at EVERY publish event.
-- Enables rollback + "what was version N?" queries.
CREATE TABLE IF NOT EXISTS ver_entity_snapshots (
  id            BIGSERIAL     PRIMARY KEY,
  entity_type   VARCHAR(60)   NOT NULL,
  entity_id     INTEGER       NOT NULL,
  entity_code   VARCHAR(60),
  entity_label  VARCHAR(300),
  version       INTEGER       NOT NULL,
  snapshot_data JSONB         NOT NULL,
  snapshot_hash VARCHAR(64),
  triggered_by  TEXT          NOT NULL,
  snapshot_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ver_entity_snapshots_lookup_idx
  ON ver_entity_snapshots(entity_type, entity_id, version DESC);

-- Field-level change log — every field change recorded separately.
-- enables diff views without comparing full snapshots.
CREATE TABLE IF NOT EXISTS ver_change_history (
  id            BIGSERIAL     PRIMARY KEY,
  entity_type   VARCHAR(60)   NOT NULL,
  entity_id     INTEGER       NOT NULL,
  entity_code   VARCHAR(60),
  field_name    VARCHAR(80)   NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  change_type   VARCHAR(20)   NOT NULL DEFAULT 'update',
  changed_by    TEXT          NOT NULL,
  change_reason TEXT,
  changed_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ver_change_history_entity_idx
  ON ver_change_history(entity_type, entity_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS ver_change_history_field_idx
  ON ver_change_history(entity_type, field_name, changed_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- LIFECYCLE TABLE
-- Records every status transition per entity — immutable audit trail.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lfc_status_events (
  id            BIGSERIAL     PRIMARY KEY,
  entity_type   VARCHAR(60)   NOT NULL,
  entity_id     INTEGER       NOT NULL,
  entity_code   VARCHAR(60),
  entity_label  VARCHAR(300),
  from_status   VARCHAR(20),
  to_status     VARCHAR(20)   NOT NULL,
  triggered_by  TEXT          NOT NULL,
  trigger_note  TEXT,
  approval_id   INTEGER,
  occurred_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS lfc_status_events_entity_idx
  ON lfc_status_events(entity_type, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS lfc_status_events_status_idx
  ON lfc_status_events(to_status, occurred_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- GOVERNANCE TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- Review schedule: how often each entity type must be reviewed.
-- One row per entity_type.
CREATE TABLE IF NOT EXISTS gov_review_schedules (
  id                    SERIAL        PRIMARY KEY,
  entity_type           VARCHAR(60)   NOT NULL UNIQUE,
  review_frequency_days INTEGER       NOT NULL DEFAULT 180,
  last_reviewed_at      TIMESTAMPTZ,
  next_review_due       DATE,
  owner_role            VARCHAR(80),
  review_criteria       TEXT,
  is_active             BOOLEAN       NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Review instance: one record per entity per review event.
CREATE TABLE IF NOT EXISTS gov_review_instances (
  id                SERIAL        PRIMARY KEY,
  entity_type       VARCHAR(60)   NOT NULL,
  entity_id         INTEGER       NOT NULL,
  entity_code       VARCHAR(60),
  -- periodic | triggered | post_incident | compliance
  review_type       VARCHAR(30)   NOT NULL DEFAULT 'periodic',
  reviewer          TEXT,
  -- pass | pass_with_notes | fail | deferred
  outcome           VARCHAR(30),
  findings          TEXT,
  action_required   TEXT,
  due_date          DATE,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS gov_review_instances_entity_idx
  ON gov_review_instances(entity_type, entity_id, created_at DESC);

-- Quality gate rules: machine-checkable validation rules per entity type.
CREATE TABLE IF NOT EXISTS gov_quality_gate_rules (
  id                SERIAL        PRIMARY KEY,
  rule_code         VARCHAR(40)   NOT NULL UNIQUE,
  entity_type       VARCHAR(60)   NOT NULL,
  rule_name         VARCHAR(180)  NOT NULL,
  description       TEXT,
  -- error | warning | info
  severity          VARCHAR(10)   NOT NULL DEFAULT 'warning',
  -- 'sql_count' | 'field_required' | 'enum_check' | 'cardinality' | 'custom'
  check_type        VARCHAR(30)   NOT NULL DEFAULT 'field_required',
  check_config      JSONB,
  is_active         BOOLEAN       NOT NULL DEFAULT true,
  created_by        TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES on mapping tables for join-path performance
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS map_role_layer_role_idx         ON map_role_layer(role_id);
CREATE INDEX IF NOT EXISTS map_role_layer_layer_idx        ON map_role_layer(layer_id);
CREATE INDEX IF NOT EXISTS map_layer_cluster_layer_idx     ON map_layer_cluster(layer_id);
CREATE INDEX IF NOT EXISTS map_layer_cluster_cluster_idx   ON map_layer_cluster(cluster_id);
CREATE INDEX IF NOT EXISTS map_cluster_comp_cluster_idx    ON map_cluster_competency(cluster_id);
CREATE INDEX IF NOT EXISTS map_cluster_comp_comp_idx       ON map_cluster_competency(competency_id);
CREATE INDEX IF NOT EXISTS map_role_comp_role_idx          ON map_role_competency(role_id);
CREATE INDEX IF NOT EXISTS map_role_comp_comp_idx          ON map_role_competency(competency_id);
CREATE INDEX IF NOT EXISTS map_micro_concern_micro_idx     ON map_micro_concern(micro_competency_id);
CREATE INDEX IF NOT EXISTS map_micro_concern_concern_idx   ON map_micro_concern(concern_id);
CREATE INDEX IF NOT EXISTS map_concern_ind_concern_idx     ON map_concern_indicator(concern_id);
CREATE INDEX IF NOT EXISTS map_concern_ind_ind_idx         ON map_concern_indicator(indicator_id);
CREATE INDEX IF NOT EXISTS map_ind_q_ind_idx               ON map_indicator_question(indicator_id);
CREATE INDEX IF NOT EXISTS map_ind_q_q_idx                 ON map_indicator_question(question_id);
CREATE INDEX IF NOT EXISTS map_micro_q_micro_idx           ON map_micro_question(micro_competency_id);
CREATE INDEX IF NOT EXISTS map_micro_q_q_idx               ON map_micro_question(question_id);
CREATE INDEX IF NOT EXISTS ont_micro_comp_comp_id_idx      ON ont_micro_competencies(competency_id);
CREATE INDEX IF NOT EXISTS ont_competencies_cluster_idx    ON ont_competencies(cluster_id);
CREATE INDEX IF NOT EXISTS ont_clusters_layer_idx          ON ont_competency_clusters(layer_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- REFERENCE DATA SEEDS  (idempotent ON CONFLICT DO NOTHING)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO ref_seniority_levels (code, label, level_order, is_leadership) VALUES
  ('intern',      'Intern / Trainee',       1,  false),
  ('junior',      'Junior',                 2,  false),
  ('mid',         'Mid-Level',              3,  false),
  ('senior',      'Senior',                 4,  false),
  ('staff',       'Staff / Lead',           5,  false),
  ('principal',   'Principal',              6,  false),
  ('manager',     'Manager',                7,  true),
  ('senior_mgr',  'Senior Manager',         8,  true),
  ('director',    'Director',               9,  true),
  ('vp',          'Vice President',         10, true),
  ('c_suite',     'C-Suite / Executive',    11, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ref_proficiency_levels (code, label, level_order, score_band_min, score_band_max, description) VALUES
  ('novice',        'Novice',        1,  0,   20,  'Aware of the competency; relies on guidance'),
  ('developing',    'Developing',    2,  20,  40,  'Building skills; requires frequent support'),
  ('intermediate',  'Intermediate',  3,  40,  60,  'Applies independently in routine situations'),
  ('advanced',      'Advanced',      4,  60,  80,  'Applies in complex situations; coaches others'),
  ('expert',        'Expert',        5,  80,  100, 'Recognised authority; shapes the discipline')
ON CONFLICT (code) DO NOTHING;

INSERT INTO ref_competency_categories (code, label, color_hex, sort_order) VALUES
  ('technical',        'Technical',            '#3B82F6', 1),
  ('behavioral',       'Behavioural',          '#10B981', 2),
  ('leadership',       'Leadership',           '#8B5CF6', 3),
  ('domain',           'Domain / Functional',  '#F59E0B', 4),
  ('cross_functional', 'Cross-Functional',     '#EC4899', 5),
  ('cognitive',        'Cognitive',            '#6366F1', 6),
  ('threshold',        'Threshold / Entry',    '#6B7280', 7)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ref_assessment_types (code, label, default_format) VALUES
  ('behavioral',          'Behavioural',              'likert_5'),
  ('technical',           'Technical / Knowledge',    'mcq'),
  ('situational',         'Situational Judgment',     'mcq'),
  ('self_report',         'Self-Report',              'likert_5'),
  ('manager_rating',      'Manager / Observer Rating','rating_scale'),
  ('portfolio',           'Portfolio / Evidence',     'open_text'),
  ('observation',         'Structured Observation',   'rating_scale'),
  ('feedback_360',        '360° Feedback',            'rating_scale'),
  ('knowledge_check',     'Knowledge Check',          'mcq'),
  ('simulation',          'Simulation / Role-Play',   'open_text')
ON CONFLICT (code) DO NOTHING;

-- Lifecycle transitions — global rules applied to ALL standard ont_* entities
-- The application layer enforces these; this table is the governance record.
INSERT INTO ref_lifecycle_transitions (entity_type, from_status, to_status, requires_approval) VALUES
  ('*', 'draft',       'in_review',   false),
  ('*', 'in_review',   'approved',    true),
  ('*', 'in_review',   'draft',       false),
  ('*', 'approved',    'published',   false),
  ('*', 'approved',    'draft',       false),
  ('*', 'published',   'deprecated',  true),
  ('*', 'deprecated',  'archived',    false),
  ('*', 'archived',    'draft',       true)
ON CONFLICT (entity_type, from_status, to_status) DO NOTHING;

-- Default governance review schedules
INSERT INTO gov_review_schedules (entity_type, review_frequency_days, owner_role, review_criteria) VALUES
  ('ont_layers',               365, 'Ontology Architect',   'Validate layer type alignment with framework evolution'),
  ('ont_competency_clusters',  180, 'Competency Lead',      'Check cluster relevance, naming consistency, weight calibration'),
  ('ont_competencies',         180, 'Competency Lead',      'Verify measurability, assessment_methods coverage, development guide quality'),
  ('ont_micro_competencies',   90,  'Assessment Designer',  'Verify observable_behavior specificity, IRT calibration, absence_indicator accuracy'),
  ('ont_concerns',             90,  'Behavioural Analyst',  'Validate CAPADEX bridge tag mapping accuracy, severity calibration'),
  ('ont_assessment_questions', 90,  'Psychometrician',      'IRT stats, bias review, item difficulty distribution'),
  ('ont_indicators',           180, 'Behavioural Analyst',  'Signal coverage, polarity accuracy, weight calibration'),
  ('ont_competencies',         365, 'Framework Governance', 'Annual full-framework audit against industry benchmarks')
ON CONFLICT (entity_type) DO NOTHING;

-- Default quality gate rules
INSERT INTO gov_quality_gate_rules (rule_code, entity_type, rule_name, severity, check_type, check_config) VALUES
  ('COMP_001', 'ont_competencies',      'Competency must have at least one Micro Competency',    'warning', 'cardinality',    '{"min":1,"relation":"ont_micro_competencies","fk":"competency_id"}'),
  ('COMP_002', 'ont_competencies',      'Competency must be assigned to a Cluster',              'error',   'field_required', '{"field":"cluster_id"}'),
  ('COMP_003', 'ont_competencies',      'Published competency must have development_guide',      'warning', 'field_required', '{"field":"development_guide","when_status":"published"}'),
  ('MICRO_001','ont_micro_competencies','Micro competency must declare proficiency_level',       'error',   'field_required', '{"field":"proficiency_level"}'),
  ('MICRO_002','ont_micro_competencies','Micro competency must have observable_behavior text',   'error',   'field_required', '{"field":"observable_behavior"}'),
  ('MICRO_003','ont_micro_competencies','Published micro must link to at least one question',    'warning', 'cardinality',    '{"min":1,"relation":"map_micro_question","fk":"micro_competency_id"}'),
  ('CONC_001', 'ont_concerns',          'Concern must map to at least one Indicator',            'warning', 'cardinality',    '{"min":1,"relation":"map_concern_indicator","fk":"concern_id"}'),
  ('CONC_002', 'ont_concerns',          'Concern should have a CAPADEX bridge_tag',              'warning', 'field_required', '{"field":"concern_bridge_tag"}'),
  ('CLUS_001', 'ont_competency_clusters','Cluster must have at least one Competency assigned',   'warning', 'cardinality',    '{"min":1,"relation":"map_cluster_competency","fk":"cluster_id"}'),
  ('LAYER_001','ont_layers',            'Layer must link to at least one Cluster',               'warning', 'cardinality',    '{"min":1,"relation":"map_layer_cluster","fk":"layer_id"}'),
  ('QUEST_001','ont_assessment_questions','Question must have at least one option if MCQ/SJ',    'warning', 'cardinality',    '{"min":1,"relation":"ont_question_options","fk":"question_id","when_format":"mcq,situational"}'),
  ('IND_001',  'ont_indicators',        'Indicator must link to at least one Question',          'warning', 'cardinality',    '{"min":1,"relation":"map_indicator_question","fk":"indicator_id"}')
ON CONFLICT (rule_code) DO NOTHING;
