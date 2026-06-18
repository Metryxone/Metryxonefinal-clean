-- MetryxOne Competency Ontology — Taxonomy Migration
-- Created: 2026-06-10
-- Modules: M01 Industries · M02 Functions · M03 Departments · M04 Role Families + Roles
--          M05 Career Tracks · M07 Competency Levels · M09 Indicators
--          M13 Benchmarks · M14 Career Paths · M15 Learning Paths
--          M16 Future Skills · M17 AI Rules

-- ── M01 Industries ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ont_industries (
  id            SERIAL      PRIMARY KEY,
  code          VARCHAR(30) NOT NULL UNIQUE,
  name          VARCHAR(150) NOT NULL,
  parent_sector VARCHAR(120),
  description   TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  status        VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── M02 Functions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ont_functions (
  id                SERIAL      PRIMARY KEY,
  code              VARCHAR(30) NOT NULL UNIQUE,
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  is_cross_industry BOOLEAN     NOT NULL DEFAULT false,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  status            VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS map_industry_function (
  id            SERIAL  PRIMARY KEY,
  industry_id   INTEGER NOT NULL REFERENCES ont_industries(id) ON DELETE CASCADE,
  function_id   INTEGER NOT NULL REFERENCES ont_functions(id)  ON DELETE CASCADE,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (industry_id, function_id)
);

-- ── M03 Departments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ont_departments (
  id                SERIAL      PRIMARY KEY,
  code              VARCHAR(30) NOT NULL UNIQUE,
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  function_id       INTEGER     REFERENCES ont_functions(id) ON DELETE SET NULL,
  cost_centre_type  VARCHAR(20) CHECK (cost_centre_type IN ('revenue','cost','support','strategic')),
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  status            VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── M04 Role Families ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ont_role_families (
  id                    SERIAL      PRIMARY KEY,
  code                  VARCHAR(30) NOT NULL UNIQUE,
  name                  VARCHAR(150) NOT NULL,
  description           TEXT,
  department_id         INTEGER     REFERENCES ont_departments(id) ON DELETE SET NULL,
  career_track_archetype VARCHAR(30) CHECK (career_track_archetype IN ('ic','management','specialist','cross_functional')),
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  status                VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  sort_order            INTEGER     NOT NULL DEFAULT 0,
  created_by            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── M04 Roles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ont_roles (
  id                   SERIAL      PRIMARY KEY,
  code                 VARCHAR(30) NOT NULL UNIQUE,
  title                VARCHAR(180) NOT NULL,
  role_family_id       INTEGER     REFERENCES ont_role_families(id) ON DELETE SET NULL,
  seniority_level      VARCHAR(20) NOT NULL DEFAULT 'mid' CHECK (seniority_level IN ('intern','junior','mid','senior','lead','principal','manager','sr_manager','director','vp','c_suite')),
  description          TEXT,
  responsibilities     TEXT[],
  min_years_experience SMALLINT    DEFAULT 0,
  is_leadership        BOOLEAN     NOT NULL DEFAULT false,
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  status               VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  sort_order           INTEGER     NOT NULL DEFAULT 0,
  created_by           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── M05 Career Tracks ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ont_career_tracks (
  id            SERIAL      PRIMARY KEY,
  code          VARCHAR(30) NOT NULL UNIQUE,
  name          VARCHAR(150) NOT NULL,
  description   TEXT,
  track_type    VARCHAR(20) NOT NULL DEFAULT 'ic' CHECK (track_type IN ('ic','management','specialist','hybrid')),
  industry_id   INTEGER     REFERENCES ont_industries(id) ON DELETE SET NULL,
  function_id   INTEGER     REFERENCES ont_functions(id)  ON DELETE SET NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  status        VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS map_career_track_role (
  id              SERIAL  PRIMARY KEY,
  career_track_id INTEGER NOT NULL REFERENCES ont_career_tracks(id) ON DELETE CASCADE,
  role_id         INTEGER NOT NULL REFERENCES ont_roles(id) ON DELETE CASCADE,
  level_in_track  SMALLINT NOT NULL DEFAULT 1,
  is_active       BOOLEAN  NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (career_track_id, role_id)
);

-- ── M07 Competency Level Anchors ─────────────────────────────────────────────
-- Proficiency bands with behavioural anchors per competency
CREATE TABLE IF NOT EXISTS ont_competency_level_anchors (
  id                   SERIAL      PRIMARY KEY,
  competency_code      VARCHAR(60) NOT NULL,  -- references competency_library or future ont_competencies
  competency_name      VARCHAR(200) NOT NULL,
  proficiency_level    VARCHAR(20) NOT NULL CHECK (proficiency_level IN ('foundational','developing','proficient','advanced','expert')),
  level_number         SMALLINT    NOT NULL CHECK (level_number BETWEEN 1 AND 5),
  score_band_min       NUMERIC(5,2) NOT NULL DEFAULT 0,
  score_band_max       NUMERIC(5,2) NOT NULL DEFAULT 100,
  behavioural_anchors  TEXT[]      NOT NULL,  -- 3-6 observable anchor statements
  sample_evidence      TEXT[],               -- 2-5 example evidence statements
  learning_actions     TEXT[],               -- 2-5 development actions
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  created_by           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (competency_code, proficiency_level)
);

-- ── M09 Indicators ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ont_indicators (
  id                 SERIAL      PRIMARY KEY,
  code               VARCHAR(60) NOT NULL UNIQUE,
  label              VARCHAR(250) NOT NULL,
  concern_bridge_tag VARCHAR(120) NOT NULL,  -- maps to capadex_concerns_master.relational_bridge_tag
  signal_type        VARCHAR(30) NOT NULL DEFAULT 'behavioural' CHECK (signal_type IN ('behavioural','cognitive','emotional','contextual','relational')),
  polarity           VARCHAR(10) NOT NULL DEFAULT 'negative' CHECK (polarity IN ('positive','negative','neutral')),
  weight             NUMERIC(4,3) NOT NULL DEFAULT 0.500 CHECK (weight BETWEEN 0.001 AND 1.000),
  description        TEXT,
  observable_threshold TEXT,
  is_active          BOOLEAN     NOT NULL DEFAULT true,
  status             VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── M13 Benchmarks ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ont_benchmarks (
  id            SERIAL      PRIMARY KEY,
  code          VARCHAR(30) NOT NULL UNIQUE,
  name          VARCHAR(150) NOT NULL,
  description   TEXT,
  benchmark_type VARCHAR(30) NOT NULL DEFAULT 'role' CHECK (benchmark_type IN ('role','industry','function','seniority','custom')),
  role_id       INTEGER     REFERENCES ont_roles(id) ON DELETE SET NULL,
  industry_id   INTEGER     REFERENCES ont_industries(id) ON DELETE SET NULL,
  function_id   INTEGER     REFERENCES ont_functions(id) ON DELETE SET NULL,
  seniority_level VARCHAR(20),
  sample_size   INTEGER     NOT NULL DEFAULT 0,
  is_suppressed BOOLEAN     NOT NULL DEFAULT false, -- true when sample_size < 30 (k-anonymity)
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  status        VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_k_anonymity CHECK (sample_size = 0 OR sample_size >= 30 OR is_suppressed = true)
);

CREATE TABLE IF NOT EXISTS ont_benchmark_items (
  id              SERIAL      PRIMARY KEY,
  benchmark_id    INTEGER     NOT NULL REFERENCES ont_benchmarks(id) ON DELETE CASCADE,
  competency_code VARCHAR(60) NOT NULL,
  competency_name VARCHAR(200) NOT NULL,
  p25_score       NUMERIC(5,2),
  p50_score       NUMERIC(5,2),
  p75_score       NUMERIC(5,2),
  p90_score       NUMERIC(5,2),
  mean_score      NUMERIC(5,2),
  std_dev         NUMERIC(5,2),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── M14 Career Paths ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ont_career_paths (
  id              SERIAL      PRIMARY KEY,
  code            VARCHAR(30) NOT NULL UNIQUE,
  name            VARCHAR(180) NOT NULL,
  description     TEXT,
  from_role_id    INTEGER     REFERENCES ont_roles(id) ON DELETE SET NULL,
  to_role_id      INTEGER     REFERENCES ont_roles(id) ON DELETE SET NULL,
  path_type       VARCHAR(20) NOT NULL DEFAULT 'linear' CHECK (path_type IN ('linear','lateral','cross_functional','entry','exit')),
  typical_months  SMALLINT,
  difficulty      VARCHAR(10) DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ont_career_path_milestones (
  id              SERIAL  PRIMARY KEY,
  career_path_id  INTEGER NOT NULL REFERENCES ont_career_paths(id) ON DELETE CASCADE,
  step_number     SMALLINT NOT NULL,
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  milestone_type  VARCHAR(30) DEFAULT 'skill' CHECK (milestone_type IN ('skill','experience','certification','project','behaviour','assessment')),
  is_required     BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── M15 Learning Paths (Step-Based Spec) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS ont_learning_paths (
  id              SERIAL      PRIMARY KEY,
  code            VARCHAR(30) NOT NULL UNIQUE,
  name            VARCHAR(180) NOT NULL,
  description     TEXT,
  target_role_id  INTEGER     REFERENCES ont_roles(id) ON DELETE SET NULL,
  competency_codes TEXT[],   -- which competencies this path develops
  duration_weeks  SMALLINT,
  difficulty      VARCHAR(10) DEFAULT 'medium' CHECK (difficulty IN ('beginner','intermediate','advanced')),
  delivery_mode   VARCHAR(20) DEFAULT 'blended' CHECK (delivery_mode IN ('self_paced','instructor_led','blended','coaching')),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ont_learning_path_steps (
  id                SERIAL  PRIMARY KEY,
  learning_path_id  INTEGER NOT NULL REFERENCES ont_learning_paths(id) ON DELETE CASCADE,
  step_number       SMALLINT NOT NULL,
  title             VARCHAR(200) NOT NULL,
  description       TEXT,
  step_type         VARCHAR(30) DEFAULT 'module' CHECK (step_type IN ('module','assessment','project','reflection','coaching','peer_activity')),
  duration_hours    NUMERIC(5,2),
  is_required       BOOLEAN NOT NULL DEFAULT true,
  resources         JSONB,  -- [{ type, title, url }]
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── M16 Future Skills ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ont_future_skills (
  id                SERIAL      PRIMARY KEY,
  code              VARCHAR(40) NOT NULL UNIQUE,
  name              VARCHAR(180) NOT NULL,
  description       TEXT,
  skill_category    VARCHAR(30) NOT NULL DEFAULT 'digital' CHECK (skill_category IN ('digital','ai_ml','green','human','data','leadership','creative','cross_functional')),
  emergence_horizon VARCHAR(20) NOT NULL DEFAULT 'now' CHECK (emergence_horizon IN ('now','1_2_years','3_5_years','5_plus_years')),
  demand_trend      VARCHAR(20) NOT NULL DEFAULT 'growing' CHECK (demand_trend IN ('emerging','growing','stable','declining')),
  relevance_industries TEXT[],  -- array of industry codes
  relevance_functions  TEXT[],  -- array of function codes
  related_competency_codes TEXT[],
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  status            VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── M17 AI Rules ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ont_ai_rules (
  id              SERIAL      PRIMARY KEY,
  code            VARCHAR(40) NOT NULL UNIQUE,
  name            VARCHAR(180) NOT NULL,
  description     TEXT,
  rule_type       VARCHAR(30) NOT NULL DEFAULT 'scoring' CHECK (rule_type IN ('scoring','routing','suppression','language','recommendation','threshold','safety')),
  applies_to      VARCHAR(30) NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all','capadex','lbi','sdi','competency','career','reports','benchmarks')),
  priority        SMALLINT    NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  is_enabled      BOOLEAN     NOT NULL DEFAULT false,  -- off by default, requires approval to enable
  conditions      JSONB,      -- structured condition rules [{field, operator, value}]
  action          JSONB,      -- structured action definition {type, params}
  rationale       TEXT,       -- why this rule exists
  risk_level      VARCHAR(10) NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),
  requires_dual_approval BOOLEAN NOT NULL DEFAULT false,
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','active','suspended','archived')),
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ont_ai_rule_audit_log (
  id          SERIAL      PRIMARY KEY,
  rule_id     INTEGER     NOT NULL REFERENCES ont_ai_rules(id) ON DELETE CASCADE,
  action      VARCHAR(20) NOT NULL CHECK (action IN ('created','updated','enabled','disabled','approved','suspended','archived')),
  changed_by  TEXT        NOT NULL,
  change_note TEXT,
  before_data JSONB,
  after_data  JSONB,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ont_industries_status ON ont_industries(status, is_active);
CREATE INDEX IF NOT EXISTS idx_ont_functions_status  ON ont_functions(status, is_active);
CREATE INDEX IF NOT EXISTS idx_ont_departments_func  ON ont_departments(function_id);
CREATE INDEX IF NOT EXISTS idx_ont_role_families_dept ON ont_role_families(department_id);
CREATE INDEX IF NOT EXISTS idx_ont_roles_family      ON ont_roles(role_family_id);
CREATE INDEX IF NOT EXISTS idx_ont_roles_seniority   ON ont_roles(seniority_level);
CREATE INDEX IF NOT EXISTS idx_ont_career_tracks_ind ON ont_career_tracks(industry_id, function_id);
CREATE INDEX IF NOT EXISTS idx_ont_comp_level_code   ON ont_competency_level_anchors(competency_code);
CREATE INDEX IF NOT EXISTS idx_ont_indicators_bridge ON ont_indicators(concern_bridge_tag);
CREATE INDEX IF NOT EXISTS idx_ont_benchmarks_role   ON ont_benchmarks(role_id);
CREATE INDEX IF NOT EXISTS idx_ont_career_paths_from ON ont_career_paths(from_role_id);
CREATE INDEX IF NOT EXISTS idx_ont_career_paths_to   ON ont_career_paths(to_role_id);
CREATE INDEX IF NOT EXISTS idx_ont_learning_role     ON ont_learning_paths(target_role_id);
CREATE INDEX IF NOT EXISTS idx_ont_future_skills_cat ON ont_future_skills(skill_category, demand_trend);
CREATE INDEX IF NOT EXISTS idx_ont_ai_rules_type     ON ont_ai_rules(rule_type, is_enabled);
