-- =====================================================================
-- Phase 1 — Global Ontology + Role Intelligence Enhancement
-- Enhancement-only. New tables namespaced `gro_*` to avoid collision with
-- existing `onto_*` (Phase 1 Ontology), `bench_*`, `mobility_*`, `p4_*`, `p5_*`.
-- All tables: soft-deletable, versioned, audit-traceable.
-- Idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- =====================================================================

-- ---------- 1. GLOBAL INDUSTRY ONTOLOGY ----------
CREATE TABLE IF NOT EXISTS gro_industry_families (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  display_order   INT DEFAULT 0,
  version         INT DEFAULT 1,
  provenance      JSONB DEFAULT '{}'::jsonb,
  is_active       BOOLEAN DEFAULT true,
  deleted_at      TIMESTAMP,
  created_at      TIMESTAMP DEFAULT now(),
  updated_at      TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gro_industries (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  code                TEXT,
  industry_family_id  TEXT REFERENCES gro_industry_families(id),
  naics_code          TEXT,
  isco_code           TEXT,
  onto_industry_id    TEXT,  -- soft link to existing onto_industries.id for backward compat
  description         TEXT,
  display_order       INT DEFAULT 0,
  version             INT DEFAULT 1,
  provenance          JSONB DEFAULT '{}'::jsonb,
  is_active           BOOLEAN DEFAULT true,
  deleted_at          TIMESTAMP,
  created_at          TIMESTAMP DEFAULT now(),
  updated_at          TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gro_industries_family ON gro_industries(industry_family_id);
CREATE INDEX IF NOT EXISTS idx_gro_industries_active ON gro_industries(is_active) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS gro_industry_geographies (
  id              TEXT PRIMARY KEY,
  industry_id     TEXT NOT NULL REFERENCES gro_industries(id),
  geography_code  TEXT NOT NULL,    -- 'IN','US','EU','GLOBAL', ISO 3166 etc.
  geography_name  TEXT NOT NULL,
  prevalence      NUMERIC(4,3),     -- 0..1 share of industry in geography
  version         INT DEFAULT 1,
  deleted_at      TIMESTAMP,
  created_at      TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gro_industry_geo_ind ON gro_industry_geographies(industry_id);

CREATE TABLE IF NOT EXISTS gro_industry_complexity_profiles (
  id                TEXT PRIMARY KEY,
  industry_id       TEXT NOT NULL REFERENCES gro_industries(id),
  complexity_level  INT NOT NULL CHECK (complexity_level BETWEEN 1 AND 5),
  scale_band        TEXT,            -- 'micro' | 'small' | 'mid' | 'large' | 'enterprise'
  technical_depth   NUMERIC(3,2),
  regulatory_load   NUMERIC(3,2),
  pace_of_change    NUMERIC(3,2),
  version           INT DEFAULT 1,
  deleted_at        TIMESTAMP,
  created_at        TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gro_industry_aliases (
  id              TEXT PRIMARY KEY,
  industry_id     TEXT NOT NULL REFERENCES gro_industries(id),
  alias           TEXT NOT NULL,
  source          TEXT,    -- 'user' | 'naics' | 'isco' | 'linkedin' | 'admin'
  deleted_at      TIMESTAMP,
  created_at      TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gro_industry_alias_lc ON gro_industry_aliases(LOWER(alias)) WHERE deleted_at IS NULL;

-- ---------- 2. BUSINESS FUNCTION TAXONOMY ----------
CREATE TABLE IF NOT EXISTS gro_function_families (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  display_order   INT DEFAULT 0,
  version         INT DEFAULT 1,
  deleted_at      TIMESTAMP,
  created_at      TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gro_business_functions (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  function_family_id  TEXT REFERENCES gro_function_families(id),
  description         TEXT,
  onto_function_id    TEXT,           -- soft link to existing onto_functions.id
  display_order       INT DEFAULT 0,
  version             INT DEFAULT 1,
  provenance          JSONB DEFAULT '{}'::jsonb,
  is_active           BOOLEAN DEFAULT true,
  deleted_at          TIMESTAMP,
  created_at          TIMESTAMP DEFAULT now(),
  updated_at          TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gro_funcs_family ON gro_business_functions(function_family_id);

CREATE TABLE IF NOT EXISTS gro_function_aliases (
  id           TEXT PRIMARY KEY,
  function_id  TEXT NOT NULL REFERENCES gro_business_functions(id),
  alias        TEXT NOT NULL,
  source       TEXT,
  deleted_at   TIMESTAMP,
  created_at   TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gro_fn_alias_lc ON gro_function_aliases(LOWER(alias)) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS gro_function_role_mappings (
  id            TEXT PRIMARY KEY,
  function_id   TEXT NOT NULL REFERENCES gro_business_functions(id),
  role_id       TEXT NOT NULL,            -- references gro_canonical_roles.id (FK below after table exists)
  relevance     NUMERIC(3,2) DEFAULT 1.0, -- 0..1
  deleted_at    TIMESTAMP,
  created_at    TIMESTAMP DEFAULT now()
);

-- ---------- 3. ROLE LAYER INTELLIGENCE ----------
CREATE TABLE IF NOT EXISTS gro_role_layers (
  id              TEXT PRIMARY KEY,
  layer_code      TEXT NOT NULL UNIQUE,    -- EXEC | MGR | LEAD | STRAT (+ extensible)
  layer_name      TEXT NOT NULL,
  description     TEXT,
  ordinal         INT NOT NULL,            -- 1..n for layering rank
  onto_layer_id   TEXT,                    -- soft link to existing onto_organisational_layers.id
  version         INT DEFAULT 1,
  deleted_at      TIMESTAMP,
  created_at      TIMESTAMP DEFAULT now()
);

-- ---------- 4. GLOBAL ROLE FAMILY ARCHITECTURE ----------
CREATE TABLE IF NOT EXISTS gro_role_families (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  description        TEXT,
  function_id        TEXT REFERENCES gro_business_functions(id),
  onto_family_id     TEXT,                 -- soft link to existing onto_role_families.id
  display_order      INT DEFAULT 0,
  version            INT DEFAULT 1,
  deleted_at         TIMESTAMP,
  created_at         TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gro_rfam_fn ON gro_role_families(function_id);

CREATE TABLE IF NOT EXISTS gro_role_family_paths (
  id              TEXT PRIMARY KEY,
  family_id       TEXT NOT NULL REFERENCES gro_role_families(id),
  path_name       TEXT NOT NULL,           -- 'IC' | 'Manager' | 'Architect'
  description     TEXT,
  display_order   INT DEFAULT 0,
  deleted_at      TIMESTAMP,
  created_at      TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gro_canonical_roles (
  id                  TEXT PRIMARY KEY,
  title               TEXT NOT NULL,
  family_id           TEXT NOT NULL REFERENCES gro_role_families(id),
  layer_id            TEXT REFERENCES gro_role_layers(id),
  path_id             TEXT REFERENCES gro_role_family_paths(id),
  seniority_band      TEXT,                 -- entry|junior|mid|senior|lead|staff|principal|director|vp|c-level
  experience_min      NUMERIC(4,1),
  experience_max      NUMERIC(4,1),
  onto_role_id        TEXT,                 -- soft link to existing onto_roles.id
  description         TEXT,
  display_order       INT DEFAULT 0,
  version             INT DEFAULT 1,
  provenance          JSONB DEFAULT '{}'::jsonb,
  is_active           BOOLEAN DEFAULT true,
  deleted_at          TIMESTAMP,
  created_at          TIMESTAMP DEFAULT now(),
  updated_at          TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gro_roles_family ON gro_canonical_roles(family_id);
CREATE INDEX IF NOT EXISTS idx_gro_roles_layer  ON gro_canonical_roles(layer_id);
CREATE INDEX IF NOT EXISTS idx_gro_roles_active ON gro_canonical_roles(is_active) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS gro_role_aliases (
  id             TEXT PRIMARY KEY,
  role_id        TEXT NOT NULL REFERENCES gro_canonical_roles(id),
  alias          TEXT NOT NULL,
  source         TEXT,
  deleted_at     TIMESTAMP,
  created_at     TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gro_role_alias_lc ON gro_role_aliases(LOWER(alias)) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS gro_role_hierarchy (
  id              TEXT PRIMARY KEY,
  role_id         TEXT NOT NULL REFERENCES gro_canonical_roles(id),
  parent_role_id  TEXT REFERENCES gro_canonical_roles(id),
  depth           INT NOT NULL,
  deleted_at      TIMESTAMP,
  created_at      TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gro_hier_role  ON gro_role_hierarchy(role_id);
CREATE INDEX IF NOT EXISTS idx_gro_hier_parent ON gro_role_hierarchy(parent_role_id);

-- ---------- 5. COMPETENCY CLASSIFICATION ENHANCEMENT ----------
-- Best-effort, idempotent: add columns only if the target table exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'competencies') THEN
    BEGIN ALTER TABLE competencies ADD COLUMN IF NOT EXISTS competency_type      TEXT; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER TABLE competencies ADD COLUMN IF NOT EXISTS competency_cluster   TEXT; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER TABLE competencies ADD COLUMN IF NOT EXISTS competency_dimension TEXT; EXCEPTION WHEN others THEN NULL; END;
    BEGIN ALTER TABLE competencies ADD COLUMN IF NOT EXISTS is_universal         BOOLEAN DEFAULT true; EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;

-- ---------- 6. CONTEXTUAL EXPECTATION ENGINE (modifiers) ----------
CREATE TABLE IF NOT EXISTS gro_industry_modifiers (
  id              TEXT PRIMARY KEY,
  industry_id     TEXT NOT NULL REFERENCES gro_industries(id),
  competency_id   TEXT NOT NULL,
  multiplier      NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  rationale       TEXT,
  version         INT DEFAULT 1,
  deleted_at      TIMESTAMP,
  created_at      TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gro_imod ON gro_industry_modifiers(industry_id, competency_id);

CREATE TABLE IF NOT EXISTS gro_layer_modifiers (
  id              TEXT PRIMARY KEY,
  layer_id        TEXT NOT NULL REFERENCES gro_role_layers(id),
  competency_id   TEXT NOT NULL,
  multiplier      NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  rationale       TEXT,
  version         INT DEFAULT 1,
  deleted_at      TIMESTAMP,
  created_at      TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gro_function_modifiers (
  id              TEXT PRIMARY KEY,
  function_id     TEXT NOT NULL REFERENCES gro_business_functions(id),
  competency_id   TEXT NOT NULL,
  multiplier      NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  rationale       TEXT,
  version         INT DEFAULT 1,
  deleted_at      TIMESTAMP,
  created_at      TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gro_organizational_complexity_modifiers (
  id                  TEXT PRIMARY KEY,
  complexity_level    INT NOT NULL CHECK (complexity_level BETWEEN 1 AND 5),
  competency_id       TEXT NOT NULL,
  multiplier          NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  rationale           TEXT,
  version             INT DEFAULT 1,
  deleted_at          TIMESTAMP,
  created_at          TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gro_geography_modifiers (
  id              TEXT PRIMARY KEY,
  geography_code  TEXT NOT NULL,
  competency_id   TEXT NOT NULL,
  multiplier      NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  rationale       TEXT,
  version         INT DEFAULT 1,
  deleted_at      TIMESTAMP,
  created_at      TIMESTAMP DEFAULT now()
);

-- ---------- 7. GLOBAL ROLE EXPECTATION MATRIX ----------
CREATE TABLE IF NOT EXISTS gro_role_competency_expectations (
  id                    TEXT PRIMARY KEY,
  role_id               TEXT NOT NULL REFERENCES gro_canonical_roles(id),
  competency_id         TEXT NOT NULL,
  minimum_score         NUMERIC(5,2) NOT NULL,
  median_score          NUMERIC(5,2) NOT NULL,
  maximum_score         NUMERIC(5,2) NOT NULL,
  criticality_weight    NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  benchmark_percentile  NUMERIC(5,2),
  -- 8. min/median/max benchmark distribution (P10..P99)
  p10                   NUMERIC(5,2),
  p25                   NUMERIC(5,2),
  p50                   NUMERIC(5,2),
  p75                   NUMERIC(5,2),
  p90                   NUMERIC(5,2),
  p99                   NUMERIC(5,2),
  version               INT DEFAULT 1,
  provenance            JSONB DEFAULT '{}'::jsonb,
  deleted_at            TIMESTAMP,
  created_at            TIMESTAMP DEFAULT now(),
  updated_at            TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gro_rce_role ON gro_role_competency_expectations(role_id);
CREATE INDEX IF NOT EXISTS idx_gro_rce_comp ON gro_role_competency_expectations(competency_id);

CREATE TABLE IF NOT EXISTS gro_role_competency_thresholds (
  id              TEXT PRIMARY KEY,
  role_id         TEXT NOT NULL REFERENCES gro_canonical_roles(id),
  competency_id   TEXT NOT NULL,
  threshold_name  TEXT NOT NULL,      -- 'entry'|'expected'|'aspirational'|'mastery'
  threshold_value NUMERIC(5,2) NOT NULL,
  version         INT DEFAULT 1,
  deleted_at      TIMESTAMP,
  created_at      TIMESTAMP DEFAULT now()
);

-- ---------- 13. GRAPH ARCHITECTURE PREPARATION (Neo4j staging) ----------
CREATE TABLE IF NOT EXISTS gro_competency_relationship_staging (
  id                  TEXT PRIMARY KEY,
  src_competency_id   TEXT NOT NULL,
  dst_competency_id   TEXT NOT NULL,
  relation_type       TEXT NOT NULL,  -- 'prerequisite'|'compounds'|'transfers_to'|'replaces'
  strength            NUMERIC(3,2),
  version             INT DEFAULT 1,
  deleted_at          TIMESTAMP,
  created_at          TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gro_role_relationship_staging (
  id              TEXT PRIMARY KEY,
  src_role_id     TEXT NOT NULL REFERENCES gro_canonical_roles(id),
  dst_role_id     TEXT NOT NULL REFERENCES gro_canonical_roles(id),
  relation_type   TEXT NOT NULL,      -- 'promotes_to'|'lateral_to'|'reports_to'|'precedes'
  strength        NUMERIC(3,2),
  version         INT DEFAULT 1,
  deleted_at      TIMESTAMP,
  created_at      TIMESTAMP DEFAULT now()
);

-- ---------- 15. GOVERNANCE: audit + versions ----------
CREATE TABLE IF NOT EXISTS gro_audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  request_id      TEXT,
  actor_id        TEXT,
  domain          TEXT NOT NULL,         -- 'industry'|'function'|'role'|'expectation'|...
  entity_id       TEXT,
  action          TEXT NOT NULL,         -- 'read'|'create'|'update'|'delete'|'restore'
  payload         JSONB DEFAULT '{}'::jsonb,
  k_check_passed  BOOLEAN,
  created_at      TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gro_audit_domain ON gro_audit_logs(domain, created_at DESC);

CREATE TABLE IF NOT EXISTS gro_versions (
  id              TEXT PRIMARY KEY,
  component       TEXT NOT NULL,         -- 'global_ontology'|'expectation_engine'|'role_engine'
  version         TEXT NOT NULL,
  notes           TEXT,
  is_current      BOOLEAN DEFAULT false,
  created_at      TIMESTAMP DEFAULT now()
);

-- =====================================================================
-- SEED DATA
-- =====================================================================
INSERT INTO gro_versions (id, component, version, notes, is_current) VALUES
  ('v_global_ontology_100',    'global_ontology',    '1.0.0', 'Initial Phase 1 enhancement', true),
  ('v_expectation_engine_100', 'expectation_engine', '1.0.0', 'Contextual modifier formula', true),
  ('v_role_engine_100',        'role_engine',        '1.0.0', 'Canonical role + family + layer', true)
ON CONFLICT (id) DO NOTHING;

-- Industry families
INSERT INTO gro_industry_families (id, name, display_order) VALUES
  ('if_tech',         'Technology & Digital', 1),
  ('if_finance',      'Financial Services',   2),
  ('if_healthcare',   'Healthcare & Life Sciences', 3),
  ('if_industrial',   'Industrial & Manufacturing', 4),
  ('if_consumer',     'Consumer & Retail',    5),
  ('if_public',       'Public Sector & Education', 6),
  ('if_energy',       'Energy & Resources',   7),
  ('if_services',     'Professional Services',8)
ON CONFLICT (id) DO NOTHING;

INSERT INTO gro_industries (id, name, industry_family_id, naics_code, isco_code, display_order) VALUES
  ('ind_software',     'Software & Internet',     'if_tech',       '5112', '25', 1),
  ('ind_ites',         'IT Services & Consulting','if_tech',       '5415', '25', 2),
  ('ind_banking',      'Banking & Capital Markets','if_finance',   '5221', '24', 3),
  ('ind_insurance',    'Insurance',               'if_finance',    '5241', '24', 4),
  ('ind_pharma',       'Pharma & Biotech',        'if_healthcare', '3254', '21', 5),
  ('ind_healthcare',   'Hospitals & Healthcare',  'if_healthcare', '6221', '22', 6),
  ('ind_manufacturing','Manufacturing',           'if_industrial', '31',   '81', 7),
  ('ind_automotive',   'Automotive',              'if_industrial', '3361', '81', 8),
  ('ind_retail',       'Retail & E-commerce',     'if_consumer',   '4451', '52', 9),
  ('ind_fmcg',         'Consumer Goods (FMCG)',   'if_consumer',   '3119', '13', 10),
  ('ind_govt',         'Government',              'if_public',     '92',   '11', 11),
  ('ind_education',    'Education',               'if_public',     '61',   '23', 12),
  ('ind_energy',       'Energy & Utilities',      'if_energy',     '22',   '31', 13),
  ('ind_consulting',   'Management Consulting',   'if_services',   '5416', '24', 14),
  ('ind_media',        'Media & Entertainment',   'if_tech',       '5151', '26', 15)
ON CONFLICT (id) DO NOTHING;

INSERT INTO gro_industry_geographies (id, industry_id, geography_code, geography_name, prevalence) VALUES
  ('ig_sw_in', 'ind_software', 'IN',     'India',         0.30),
  ('ig_sw_us', 'ind_software', 'US',     'United States', 0.40),
  ('ig_sw_eu', 'ind_software', 'EU',     'Europe',        0.20),
  ('ig_sw_gl', 'ind_software', 'GLOBAL', 'Global',        1.00),
  ('ig_bk_in', 'ind_banking',  'IN',     'India',         0.25),
  ('ig_bk_us', 'ind_banking',  'US',     'United States', 0.35),
  ('ig_bk_gl', 'ind_banking',  'GLOBAL', 'Global',        1.00),
  ('ig_mf_in', 'ind_manufacturing', 'IN','India',         0.30),
  ('ig_mf_gl', 'ind_manufacturing', 'GLOBAL','Global',    1.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO gro_industry_complexity_profiles (id, industry_id, complexity_level, scale_band, technical_depth, regulatory_load, pace_of_change) VALUES
  ('icp_sw_3', 'ind_software',      3, 'mid',        0.90, 0.40, 0.95),
  ('icp_sw_5', 'ind_software',      5, 'enterprise', 0.95, 0.60, 0.90),
  ('icp_bk_4', 'ind_banking',       4, 'large',      0.70, 0.95, 0.40),
  ('icp_ph_4', 'ind_pharma',        4, 'large',      0.95, 0.95, 0.50),
  ('icp_mf_3', 'ind_manufacturing', 3, 'mid',        0.70, 0.60, 0.40),
  ('icp_rt_3', 'ind_retail',        3, 'mid',        0.40, 0.40, 0.70)
ON CONFLICT (id) DO NOTHING;

INSERT INTO gro_industry_aliases (id, industry_id, alias, source) VALUES
  ('ia_sw_1', 'ind_software',     'tech',                  'user'),
  ('ia_sw_2', 'ind_software',     'saas',                  'user'),
  ('ia_sw_3', 'ind_software',     'software development',  'naics'),
  ('ia_it_1', 'ind_ites',         'it consulting',         'user'),
  ('ia_it_2', 'ind_ites',         'system integration',    'user'),
  ('ia_bk_1', 'ind_banking',      'bfsi',                  'user'),
  ('ia_bk_2', 'ind_banking',      'investment banking',    'user'),
  ('ia_ph_1', 'ind_pharma',       'pharmaceuticals',       'isco'),
  ('ia_ph_2', 'ind_pharma',       'biotech',               'user'),
  ('ia_rt_1', 'ind_retail',       'ecommerce',             'user'),
  ('ia_rt_2', 'ind_retail',       'd2c',                   'user'),
  ('ia_mf_1', 'ind_manufacturing','factory',               'user'),
  ('ia_mf_2', 'ind_manufacturing','industrial production', 'naics')
ON CONFLICT (id) DO NOTHING;

-- Function families + business functions
INSERT INTO gro_function_families (id, name, display_order) VALUES
  ('ff_people',  'People & Org',        1),
  ('ff_money',   'Finance & Strategy',  2),
  ('ff_build',   'Build & Engineering', 3),
  ('ff_grow',    'Growth & Commercial', 4),
  ('ff_run',     'Run & Operations',    5),
  ('ff_risk',    'Risk & Compliance',   6),
  ('ff_intel',   'Data & Intelligence', 7)
ON CONFLICT (id) DO NOTHING;

INSERT INTO gro_business_functions (id, name, function_family_id, display_order) VALUES
  ('fn_hr',          'Human Resources',  'ff_people', 1),
  ('fn_finance',     'Finance',          'ff_money',  2),
  ('fn_eng',         'Engineering',      'ff_build',  3),
  ('fn_sales',       'Sales',            'ff_grow',   4),
  ('fn_ops',         'Operations',       'ff_run',    5),
  ('fn_product',     'Product',          'ff_build',  6),
  ('fn_marketing',   'Marketing',        'ff_grow',   7),
  ('fn_supply',      'Supply Chain',     'ff_run',    8),
  ('fn_legal',       'Legal',            'ff_risk',   9),
  ('fn_security',    'Cybersecurity',    'ff_risk',   10),
  ('fn_data',        'Data & Analytics', 'ff_intel',  11)
ON CONFLICT (id) DO NOTHING;

INSERT INTO gro_function_aliases (id, function_id, alias, source) VALUES
  ('fa_hr_1',   'fn_hr',       'people ops',           'user'),
  ('fa_hr_2',   'fn_hr',       'talent',               'user'),
  ('fa_fin_1',  'fn_finance',  'controlling',          'user'),
  ('fa_fin_2',  'fn_finance',  'fp&a',                 'user'),
  ('fa_eng_1',  'fn_eng',      'r&d',                  'user'),
  ('fa_eng_2',  'fn_eng',      'software engineering', 'user'),
  ('fa_sl_1',   'fn_sales',    'business development', 'user'),
  ('fa_mk_1',   'fn_marketing','growth',               'user'),
  ('fa_op_1',   'fn_ops',      'operations management','user'),
  ('fa_pd_1',   'fn_product',  'pm',                   'user'),
  ('fa_da_1',   'fn_data',     'data science',         'user'),
  ('fa_sec_1',  'fn_security', 'infosec',              'user'),
  ('fa_sc_1',   'fn_supply',   'logistics',            'user')
ON CONFLICT (id) DO NOTHING;

-- Role layers (4 canonical layers per spec, + IC as ordinal 0 anchor for completeness)
INSERT INTO gro_role_layers (id, layer_code, layer_name, description, ordinal) VALUES
  ('rl_ic',    'IC',    'Individual Contributor', 'Hands-on execution; no people accountability', 1),
  ('rl_lead',  'LEAD',  'Leadership',             'Team/tech lead; influence without formal authority',  2),
  ('rl_mgr',   'MGR',   'Managerial',             'People manager; first-line through middle management', 3),
  ('rl_strat', 'STRAT', 'Strategic',              'Director / senior manager; multi-team & cross-function', 4),
  ('rl_exec',  'EXEC',  'Executive',              'VP / C-level; enterprise stewardship', 5)
ON CONFLICT (id) DO NOTHING;

-- Role families + paths + canonical roles (Engineering example chain from spec)
INSERT INTO gro_role_families (id, name, function_id, display_order) VALUES
  ('rf_sw_eng',  'Software Engineering', 'fn_eng',     1),
  ('rf_data',    'Data & Analytics',     'fn_data',    2),
  ('rf_product', 'Product Management',   'fn_product', 3),
  ('rf_sales',   'Sales',                'fn_sales',   4),
  ('rf_hr',      'HR Business Partner',  'fn_hr',      5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO gro_role_family_paths (id, family_id, path_name, display_order) VALUES
  ('rp_sw_ic',  'rf_sw_eng', 'IC',         1),
  ('rp_sw_mgr', 'rf_sw_eng', 'Manager',    2),
  ('rp_sw_arc', 'rf_sw_eng', 'Architect',  3),
  ('rp_data_ic','rf_data',   'IC',         1),
  ('rp_pm_ic',  'rf_product','IC',         1),
  ('rp_sl_ic',  'rf_sales',  'IC',         1),
  ('rp_hr_ic',  'rf_hr',     'IC',         1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO gro_canonical_roles (id, title, family_id, layer_id, path_id, seniority_band, experience_min, experience_max, description) VALUES
  ('cr_sw_engineer',  'Engineer',             'rf_sw_eng', 'rl_ic',    'rp_sw_ic',  'junior', 0, 3,  'Builds and ships features under guidance'),
  ('cr_sw_sr',        'Senior Engineer',      'rf_sw_eng', 'rl_ic',    'rp_sw_ic',  'mid',    3, 6,  'Owns features end-to-end; mentors juniors'),
  ('cr_sw_lead',      'Lead Engineer',        'rf_sw_eng', 'rl_lead',  'rp_sw_ic',  'senior', 6, 10, 'Tech lead for a team; cross-cutting design'),
  ('cr_sw_arch',      'Architect',            'rf_sw_eng', 'rl_strat', 'rp_sw_arc', 'staff',  8, 14, 'System architecture across teams'),
  ('cr_sw_engmgr',    'Engineering Manager',  'rf_sw_eng', 'rl_mgr',   'rp_sw_mgr', 'senior', 7, 12, 'People manager for an eng team'),
  ('cr_sw_cto',       'CTO',                  'rf_sw_eng', 'rl_exec',  'rp_sw_mgr', 'c-level',12, 30,'Enterprise technology stewardship'),
  ('cr_data_eng',     'Data Engineer',        'rf_data',   'rl_ic',    'rp_data_ic','mid',    2, 6,  'Builds data pipelines and platforms'),
  ('cr_data_sci',     'Data Scientist',       'rf_data',   'rl_ic',    'rp_data_ic','mid',    2, 6,  'Statistical modelling + ML'),
  ('cr_pm',           'Product Manager',      'rf_product','rl_ic',    'rp_pm_ic',  'mid',    2, 6,  'Discovers + delivers product outcomes'),
  ('cr_pm_sr',        'Senior Product Manager','rf_product','rl_lead', 'rp_pm_ic',  'senior', 5, 10, 'Owns area roadmap + portfolio trade-offs'),
  ('cr_ae',           'Account Executive',    'rf_sales',  'rl_ic',    'rp_sl_ic',  'mid',    2, 6,  'Mid-market sales cycle'),
  ('cr_hrbp',         'HR Business Partner',  'rf_hr',     'rl_lead',  'rp_hr_ic',  'senior', 5, 12, 'Strategic HR for a business unit')
ON CONFLICT (id) DO NOTHING;

INSERT INTO gro_role_aliases (id, role_id, alias, source) VALUES
  ('ra_sw1', 'cr_sw_engineer', 'software engineer',        'user'),
  ('ra_sw2', 'cr_sw_engineer', 'sde i',                    'user'),
  ('ra_sw3', 'cr_sw_engineer', 'junior developer',         'user'),
  ('ra_sw4', 'cr_sw_sr',       'senior software engineer', 'user'),
  ('ra_sw5', 'cr_sw_sr',       'sde ii',                   'user'),
  ('ra_sw6', 'cr_sw_lead',     'tech lead',                'user'),
  ('ra_sw7', 'cr_sw_lead',     'staff engineer',           'user'),
  ('ra_sw8', 'cr_sw_arch',     'solution architect',       'user'),
  ('ra_sw9', 'cr_sw_engmgr',   'em',                       'user'),
  ('ra_pm1', 'cr_pm',          'pm',                       'user'),
  ('ra_pm2', 'cr_pm_sr',       'spm',                      'user'),
  ('ra_de1', 'cr_data_eng',    'data platform engineer',   'user'),
  ('ra_ds1', 'cr_data_sci',    'ml engineer',              'user'),
  ('ra_sl1', 'cr_ae',          'sales executive',          'user')
ON CONFLICT (id) DO NOTHING;

INSERT INTO gro_role_hierarchy (id, role_id, parent_role_id, depth) VALUES
  ('rh_sr_eng',   'cr_sw_sr',     'cr_sw_engineer', 1),
  ('rh_lead_sr',  'cr_sw_lead',   'cr_sw_sr',       2),
  ('rh_arch_lead','cr_sw_arch',   'cr_sw_lead',     3),
  ('rh_em_lead',  'cr_sw_engmgr', 'cr_sw_lead',     3),
  ('rh_cto_em',   'cr_sw_cto',    'cr_sw_engmgr',   4),
  ('rh_spm_pm',   'cr_pm_sr',     'cr_pm',          1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO gro_function_role_mappings (id, function_id, role_id, relevance) VALUES
  ('frm_eng_engineer','fn_eng',     'cr_sw_engineer', 1.00),
  ('frm_eng_sr',      'fn_eng',     'cr_sw_sr',       1.00),
  ('frm_eng_lead',    'fn_eng',     'cr_sw_lead',     1.00),
  ('frm_eng_arch',    'fn_eng',     'cr_sw_arch',     1.00),
  ('frm_eng_em',      'fn_eng',     'cr_sw_engmgr',   1.00),
  ('frm_eng_cto',     'fn_eng',     'cr_sw_cto',      1.00),
  ('frm_data_de',     'fn_data',    'cr_data_eng',    1.00),
  ('frm_data_ds',     'fn_data',    'cr_data_sci',    1.00),
  ('frm_pd_pm',       'fn_product', 'cr_pm',          1.00),
  ('frm_pd_spm',      'fn_product', 'cr_pm_sr',       1.00),
  ('frm_sl_ae',       'fn_sales',   'cr_ae',          1.00),
  ('frm_hr_hrbp',     'fn_hr',      'cr_hrbp',        1.00)
ON CONFLICT (id) DO NOTHING;

-- Modifiers — only a representative seed (engines will multiplicatively combine missing rows as 1.000)
-- Competency IDs reference the 7-domain codes from the existing assessment scoring (COG, COM, LEA, EXE, ADP, TEC, EIQ)
INSERT INTO gro_industry_modifiers (id, industry_id, competency_id, multiplier, rationale) VALUES
  ('im_sw_tec',  'ind_software',      'TEC', 1.20, 'Software industry weights technical depth more heavily'),
  ('im_sw_adp',  'ind_software',      'ADP', 1.10, 'Rapid pace of change rewards adaptability'),
  ('im_bk_eiq',  'ind_banking',       'EIQ', 1.05, 'Regulatory environment rewards judgement + composure'),
  ('im_bk_exe',  'ind_banking',       'EXE', 1.10, 'Tight control culture rewards delivery discipline'),
  ('im_ph_cog',  'ind_pharma',        'COG', 1.15, 'Scientific rigour weights analytical capacity'),
  ('im_rt_com',  'ind_retail',        'COM', 1.10, 'Customer-facing surface area rewards communication'),
  ('im_mf_exe',  'ind_manufacturing', 'EXE', 1.10, 'Operational excellence is a defining trait')
ON CONFLICT (id) DO NOTHING;

INSERT INTO gro_layer_modifiers (id, layer_id, competency_id, multiplier, rationale) VALUES
  ('lm_ic_tec',    'rl_ic',    'TEC', 1.15, 'IC roles rewarded primarily on craft'),
  ('lm_ic_lea',    'rl_ic',    'LEA', 0.85, 'Leadership weighted less for IC'),
  ('lm_lead_com',  'rl_lead',  'COM', 1.10, 'Leads rely on persuasion + clarity'),
  ('lm_mgr_lea',   'rl_mgr',   'LEA', 1.20, 'Managerial role rewards people leadership'),
  ('lm_mgr_eiq',   'rl_mgr',   'EIQ', 1.10, 'Manager judgement under ambiguity'),
  ('lm_strat_cog', 'rl_strat', 'COG', 1.15, 'Strategic role rewards systems thinking'),
  ('lm_strat_lea', 'rl_strat', 'LEA', 1.25, 'Director-level leadership weight'),
  ('lm_exec_lea',  'rl_exec',  'LEA', 1.35, 'C-level enterprise leadership'),
  ('lm_exec_cog',  'rl_exec',  'COG', 1.20, 'Executive judgement + vision'),
  ('lm_exec_tec',  'rl_exec',  'TEC', 0.80, 'Pure technical weight reduces at exec layer')
ON CONFLICT (id) DO NOTHING;

INSERT INTO gro_function_modifiers (id, function_id, competency_id, multiplier, rationale) VALUES
  ('fm_eng_tec',  'fn_eng',     'TEC', 1.20, 'Engineering function rewards technical mastery'),
  ('fm_data_cog', 'fn_data',    'COG', 1.15, 'Data function rewards analytical depth'),
  ('fm_sl_com',   'fn_sales',   'COM', 1.20, 'Sales function rewards communication + influence'),
  ('fm_pd_eiq',   'fn_product', 'EIQ', 1.10, 'Product function rewards stakeholder judgement'),
  ('fm_pd_cog',   'fn_product', 'COG', 1.10, 'Product function rewards prioritisation'),
  ('fm_hr_eiq',   'fn_hr',      'EIQ', 1.20, 'HR rewards emotional intelligence'),
  ('fm_ops_exe',  'fn_ops',     'EXE', 1.15, 'Operations rewards delivery discipline')
ON CONFLICT (id) DO NOTHING;

INSERT INTO gro_organizational_complexity_modifiers (id, complexity_level, competency_id, multiplier, rationale) VALUES
  ('ocm_5_cog', 5, 'COG', 1.10, 'Highly complex orgs reward systems thinking'),
  ('ocm_5_lea', 5, 'LEA', 1.15, 'Highly complex orgs reward influence'),
  ('ocm_5_adp', 5, 'ADP', 1.10, 'Highly complex orgs reward adaptability'),
  ('ocm_4_lea', 4, 'LEA', 1.10, 'Large orgs reward influence'),
  ('ocm_3_exe', 3, 'EXE', 1.05, 'Mid-size orgs reward delivery discipline'),
  ('ocm_1_tec', 1, 'TEC', 1.15, 'Micro orgs reward broad technical capability'),
  ('ocm_1_exe', 1, 'EXE', 1.10, 'Micro orgs reward execution autonomy')
ON CONFLICT (id) DO NOTHING;

INSERT INTO gro_geography_modifiers (id, geography_code, competency_id, multiplier, rationale) VALUES
  ('gm_us_com',  'US',     'COM', 1.05, 'US business culture weights direct communication'),
  ('gm_eu_eiq',  'EU',     'EIQ', 1.05, 'European context weights stakeholder navigation'),
  ('gm_in_exe',  'IN',     'EXE', 1.05, 'Indian context weights delivery discipline at scale'),
  ('gm_gl_adp',  'GLOBAL', 'ADP', 1.05, 'Globally-distributed roles reward adaptability')
ON CONFLICT (id) DO NOTHING;

-- Role expectation matrix — seeded for the engineering chain (other roles inherit defaults)
INSERT INTO gro_role_competency_expectations
  (id, role_id, competency_id, minimum_score, median_score, maximum_score, criticality_weight, benchmark_percentile, p10, p25, p50, p75, p90, p99) VALUES
  -- Software Engineer (junior IC)
  ('rce_eng_tec', 'cr_sw_engineer', 'TEC', 50, 65, 85, 1.30, 50,  45, 55, 65, 72, 80, 90),
  ('rce_eng_cog', 'cr_sw_engineer', 'COG', 45, 60, 80, 1.10, 50,  40, 52, 60, 68, 76, 88),
  ('rce_eng_exe', 'cr_sw_engineer', 'EXE', 50, 62, 80, 1.10, 50,  42, 55, 62, 70, 78, 88),
  ('rce_eng_com', 'cr_sw_engineer', 'COM', 40, 55, 75, 0.90, 50,  35, 48, 55, 62, 70, 82),
  ('rce_eng_adp', 'cr_sw_engineer', 'ADP', 45, 58, 78, 0.95, 50,  40, 52, 58, 65, 73, 85),
  ('rce_eng_lea', 'cr_sw_engineer', 'LEA', 30, 45, 65, 0.60, 50,  25, 38, 45, 52, 60, 75),
  ('rce_eng_eiq', 'cr_sw_engineer', 'EIQ', 40, 55, 75, 0.90, 50,  35, 48, 55, 62, 70, 82),
  -- Senior Engineer
  ('rce_sr_tec',  'cr_sw_sr', 'TEC', 60, 75, 90, 1.30, 60, 55, 68, 75, 82, 88, 95),
  ('rce_sr_cog',  'cr_sw_sr', 'COG', 55, 70, 88, 1.15, 60, 50, 63, 70, 77, 84, 92),
  ('rce_sr_exe',  'cr_sw_sr', 'EXE', 60, 72, 88, 1.15, 60, 55, 65, 72, 79, 85, 93),
  ('rce_sr_com',  'cr_sw_sr', 'COM', 50, 65, 82, 1.00, 55, 45, 58, 65, 72, 78, 88),
  ('rce_sr_adp',  'cr_sw_sr', 'ADP', 55, 68, 85, 1.05, 55, 50, 62, 68, 75, 80, 90),
  ('rce_sr_lea',  'cr_sw_sr', 'LEA', 45, 58, 78, 0.85, 50, 40, 52, 58, 65, 72, 84),
  ('rce_sr_eiq',  'cr_sw_sr', 'EIQ', 50, 65, 82, 1.00, 55, 45, 58, 65, 72, 78, 88),
  -- Engineering Manager (managerial layer)
  ('rce_em_lea',  'cr_sw_engmgr', 'LEA', 65, 78, 92, 1.40, 65, 60, 72, 78, 84, 90, 96),
  ('rce_em_eiq',  'cr_sw_engmgr', 'EIQ', 60, 75, 90, 1.25, 65, 55, 68, 75, 82, 87, 94),
  ('rce_em_com',  'cr_sw_engmgr', 'COM', 65, 78, 90, 1.20, 65, 58, 72, 78, 83, 88, 94),
  ('rce_em_cog',  'cr_sw_engmgr', 'COG', 60, 72, 88, 1.10, 60, 55, 65, 72, 79, 84, 92),
  ('rce_em_exe',  'cr_sw_engmgr', 'EXE', 65, 78, 92, 1.20, 65, 60, 72, 78, 84, 90, 96),
  ('rce_em_adp',  'cr_sw_engmgr', 'ADP', 60, 72, 88, 1.05, 60, 55, 65, 72, 79, 84, 92),
  ('rce_em_tec',  'cr_sw_engmgr', 'TEC', 55, 68, 85, 0.90, 55, 50, 62, 68, 75, 80, 90)
ON CONFLICT (id) DO NOTHING;

INSERT INTO gro_role_competency_thresholds (id, role_id, competency_id, threshold_name, threshold_value) VALUES
  ('rt_eng_tec_e',  'cr_sw_engineer', 'TEC', 'entry',         50),
  ('rt_eng_tec_x',  'cr_sw_engineer', 'TEC', 'expected',      65),
  ('rt_eng_tec_a',  'cr_sw_engineer', 'TEC', 'aspirational',  78),
  ('rt_eng_tec_m',  'cr_sw_engineer', 'TEC', 'mastery',       88),
  ('rt_em_lea_e',   'cr_sw_engmgr',   'LEA', 'entry',         65),
  ('rt_em_lea_x',   'cr_sw_engmgr',   'LEA', 'expected',      78),
  ('rt_em_lea_a',   'cr_sw_engmgr',   'LEA', 'aspirational',  88),
  ('rt_em_lea_m',   'cr_sw_engmgr',   'LEA', 'mastery',       94)
ON CONFLICT (id) DO NOTHING;

-- Soft-link existing onto_* rows to the new gro_* where ID names align
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='onto_industries') THEN
    UPDATE gro_industries SET onto_industry_id = id WHERE onto_industry_id IS NULL
      AND EXISTS (SELECT 1 FROM onto_industries oi WHERE oi.id = gro_industries.id);
  END IF;
END $$;
