-- ============================================================
-- Phase 3 — Market Intelligence + Evidence Graph + Mobility 2.0
-- Enhancement-only. All tables namespaced m3_*. Soft FK to
-- existing onto_*, sci_*, bench_* via nullable text columns.
-- No destructive changes to existing schema.
-- ============================================================

-- 1. Market Intelligence ----------------------------------------------------
CREATE TABLE IF NOT EXISTS m3_source_registry (
  id           TEXT PRIMARY KEY,
  source_code  TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL,    -- jobs|skills|salary|forecast|standards
  authority    TEXT NOT NULL,
  refresh_freq TEXT,             -- streaming|daily|weekly|monthly|quarterly
  trust_score  NUMERIC(4,3) DEFAULT 0.8,
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m3_market_roles (
  id              TEXT PRIMARY KEY,
  market_title    TEXT NOT NULL,
  industry        TEXT,
  function        TEXT,
  seniority       TEXT,
  source_id       TEXT REFERENCES m3_source_registry(id),
  ontology_role_id TEXT,          -- soft FK → onto_roles
  embedding       REAL[],         -- deterministic 16-dim pseudo-embedding (pgvector-ready)
  observed_count  INT DEFAULT 1,
  first_seen      TIMESTAMPTZ DEFAULT now(),
  last_seen       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_m3_market_roles_onto ON m3_market_roles(ontology_role_id);
CREATE INDEX IF NOT EXISTS idx_m3_market_roles_title ON m3_market_roles(market_title);

CREATE TABLE IF NOT EXISTS m3_market_role_aliases (
  id             TEXT PRIMARY KEY,
  market_role_id TEXT REFERENCES m3_market_roles(id) ON DELETE CASCADE,
  alias_title    TEXT NOT NULL,
  similarity     NUMERIC(4,3) DEFAULT 1.0,
  source_id      TEXT REFERENCES m3_source_registry(id)
);
CREATE INDEX IF NOT EXISTS idx_m3_market_role_aliases ON m3_market_role_aliases(alias_title);

CREATE TABLE IF NOT EXISTS m3_market_competencies (
  id                      TEXT PRIMARY KEY,
  market_skill            TEXT NOT NULL,
  ontology_competency_id  TEXT,   -- soft FK → onto_competencies/sci_*
  embedding               REAL[],
  category                TEXT,
  emerging                BOOLEAN DEFAULT false,
  first_seen              TIMESTAMPTZ DEFAULT now(),
  last_seen               TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_m3_market_competencies_onto ON m3_market_competencies(ontology_competency_id);
CREATE INDEX IF NOT EXISTS idx_m3_market_competencies_skill ON m3_market_competencies(market_skill);

CREATE TABLE IF NOT EXISTS m3_skill_demand (
  id                  TEXT PRIMARY KEY,
  market_competency_id TEXT REFERENCES m3_market_competencies(id) ON DELETE CASCADE,
  geo                 TEXT DEFAULT 'GLOBAL',
  industry            TEXT,
  posting_count       INT DEFAULT 0,
  growth_rate         NUMERIC(6,3),   -- % MoM
  demand_score        NUMERIC(5,2),   -- 0..100
  source_id           TEXT REFERENCES m3_source_registry(id),
  snapshot_date       DATE DEFAULT CURRENT_DATE
);
CREATE INDEX IF NOT EXISTS idx_m3_skill_demand_comp ON m3_skill_demand(market_competency_id);

CREATE TABLE IF NOT EXISTS m3_salary_trends (
  id              TEXT PRIMARY KEY,
  market_role_id  TEXT REFERENCES m3_market_roles(id) ON DELETE CASCADE,
  geo             TEXT DEFAULT 'GLOBAL',
  currency        TEXT DEFAULT 'USD',
  p25             NUMERIC(12,2),
  p50             NUMERIC(12,2),
  p75             NUMERIC(12,2),
  yoy_change      NUMERIC(6,3),
  source_id       TEXT REFERENCES m3_source_registry(id),
  snapshot_date   DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS m3_role_trends (
  id              TEXT PRIMARY KEY,
  market_role_id  TEXT REFERENCES m3_market_roles(id) ON DELETE CASCADE,
  snapshot_date   DATE DEFAULT CURRENT_DATE,
  postings        INT DEFAULT 0,
  applications    INT DEFAULT 0,
  hires           INT DEFAULT 0,
  hiring_velocity NUMERIC(6,3)
);

CREATE TABLE IF NOT EXISTS m3_emerging_competencies (
  id                      TEXT PRIMARY KEY,
  market_competency_id    TEXT REFERENCES m3_market_competencies(id) ON DELETE CASCADE,
  emergence_score         NUMERIC(5,2),
  forecast_horizon_months INT DEFAULT 12,
  evidence                JSONB DEFAULT '{}'::jsonb,
  detected_at             TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m3_industry_demand (
  id            TEXT PRIMARY KEY,
  industry      TEXT NOT NULL,
  role_family   TEXT,
  growth_score  NUMERIC(5,2),
  snapshot_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS m3_geography_demand (
  id            TEXT PRIMARY KEY,
  geo           TEXT NOT NULL,
  role_family   TEXT,
  demand_score  NUMERIC(5,2),
  snapshot_date DATE DEFAULT CURRENT_DATE
);

-- 2. AI Role Normalization --------------------------------------------------
CREATE TABLE IF NOT EXISTS m3_canonical_role_mappings (
  id                 TEXT PRIMARY KEY,
  raw_title          TEXT NOT NULL,
  market_role_id     TEXT REFERENCES m3_market_roles(id),
  ontology_role_id   TEXT,
  similarity         NUMERIC(4,3),
  method             TEXT,         -- embedding|exact|alias|fuzzy
  created_at         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_m3_canonical_role_raw ON m3_canonical_role_mappings(raw_title);

CREATE TABLE IF NOT EXISTS m3_role_similarity_vectors (
  id              TEXT PRIMARY KEY,
  source_role_id  TEXT,            -- m3_market_roles.id OR onto_roles.id
  target_role_id  TEXT,
  similarity      NUMERIC(4,3),
  method          TEXT,
  computed_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m3_role_normalization_history (
  id              TEXT PRIMARY KEY,
  raw_title       TEXT,
  resolved_to     TEXT,
  similarity      NUMERIC(4,3),
  method          TEXT,
  user_session_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m3_semantic_role_clusters (
  id            TEXT PRIMARY KEY,
  cluster_label TEXT,
  centroid      REAL[],
  size          INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 3. Market Demand Scoring --------------------------------------------------
CREATE TABLE IF NOT EXISTS m3_competency_market_scores (
  id                     TEXT PRIMARY KEY,
  ontology_competency_id TEXT NOT NULL,
  hiring_frequency       NUMERIC(5,2),  -- 0..100
  salary_velocity        NUMERIC(5,2),
  industry_growth        NUMERIC(5,2),
  future_relevance       NUMERIC(5,2),
  automation_risk        NUMERIC(5,2),
  market_demand          NUMERIC(5,2),  -- composite
  computed_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_m3_competency_market_scores_comp ON m3_competency_market_scores(ontology_competency_id);

CREATE TABLE IF NOT EXISTS m3_role_market_scores (
  id               TEXT PRIMARY KEY,
  ontology_role_id TEXT NOT NULL,
  hiring_demand    NUMERIC(5,2),
  salary_strength  NUMERIC(5,2),
  growth_trend     NUMERIC(5,2),
  market_score     NUMERIC(5,2),
  computed_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m3_future_skill_forecasts (
  id                     TEXT PRIMARY KEY,
  ontology_competency_id TEXT NOT NULL,
  horizon_months         INT,
  forecast_score         NUMERIC(5,2),
  confidence             NUMERIC(4,3),
  drivers                JSONB DEFAULT '[]'::jsonb,
  computed_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m3_market_velocity_scores (
  id                     TEXT PRIMARY KEY,
  ontology_competency_id TEXT,
  ontology_role_id       TEXT,
  velocity_score         NUMERIC(5,2),  -- direction × magnitude
  trend_direction        TEXT,          -- rising|stable|declining
  computed_at            TIMESTAMPTZ DEFAULT now()
);

-- 4. Evidence Graph ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS m3_evidence_sources (
  id            TEXT PRIMARY KEY,
  source_code   TEXT NOT NULL UNIQUE,
  source_type   TEXT NOT NULL,   -- assessment|cert|project|resume|peer|manager|perf|portfolio|learning
  provider      TEXT,
  trust_weight  NUMERIC(4,3) DEFAULT 0.7,
  verifiable    BOOLEAN DEFAULT false,
  metadata      JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS m3_evidence_nodes (
  id                     TEXT PRIMARY KEY,
  subject_id             TEXT NOT NULL,         -- user/session/entity
  ontology_competency_id TEXT,
  evidence_source_id     TEXT REFERENCES m3_evidence_sources(id),
  evidence_kind          TEXT NOT NULL,         -- mirrors source_type
  evidence_payload       JSONB DEFAULT '{}'::jsonb,
  observed_strength      NUMERIC(4,3),          -- 0..1 raw
  weight                 NUMERIC(4,3),          -- weighted by source trust
  verification_status    TEXT DEFAULT 'unverified', -- unverified|self|peer|verified
  recorded_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_m3_evidence_subject ON m3_evidence_nodes(subject_id);
CREATE INDEX IF NOT EXISTS idx_m3_evidence_comp ON m3_evidence_nodes(ontology_competency_id);

CREATE TABLE IF NOT EXISTS m3_evidence_relationships (
  id           TEXT PRIMARY KEY,
  parent_id    TEXT REFERENCES m3_evidence_nodes(id) ON DELETE CASCADE,
  child_id     TEXT REFERENCES m3_evidence_nodes(id) ON DELETE CASCADE,
  relation     TEXT,                -- supports|contradicts|elaborates
  strength     NUMERIC(4,3)
);

CREATE TABLE IF NOT EXISTS m3_capability_evidence_links (
  id                     TEXT PRIMARY KEY,
  subject_id             TEXT NOT NULL,
  ontology_competency_id TEXT NOT NULL,
  evidence_node_id       TEXT REFERENCES m3_evidence_nodes(id) ON DELETE CASCADE,
  contribution           NUMERIC(4,3)
);
CREATE INDEX IF NOT EXISTS idx_m3_cel_subject_comp ON m3_capability_evidence_links(subject_id, ontology_competency_id);

CREATE TABLE IF NOT EXISTS m3_evidence_confidence_scores (
  id                     TEXT PRIMARY KEY,
  subject_id             TEXT NOT NULL,
  ontology_competency_id TEXT NOT NULL,
  evidence_strength      NUMERIC(4,3),       -- aggregated 0..1
  verification_level     TEXT,               -- weak|moderate|strong|verified
  evidence_count         INT DEFAULT 0,
  computed_at            TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_m3_ecs ON m3_evidence_confidence_scores(subject_id, ontology_competency_id);

-- 5. Career Mobility 2.0 ----------------------------------------------------
CREATE TABLE IF NOT EXISTS m3_role_adjacency (
  id                     TEXT PRIMARY KEY,
  from_ontology_role_id  TEXT NOT NULL,
  to_ontology_role_id    TEXT NOT NULL,
  capability_similarity  NUMERIC(4,3),
  market_adjacency       NUMERIC(4,3),
  adjacency_score        NUMERIC(4,3),
  rationale              TEXT,
  computed_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_m3_role_adj_from ON m3_role_adjacency(from_ontology_role_id);

CREATE TABLE IF NOT EXISTS m3_career_paths (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  family       TEXT,
  steps        JSONB NOT NULL,        -- ordered onto_role ids
  popularity   NUMERIC(5,2) DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m3_transition_probability (
  id                     TEXT PRIMARY KEY,
  from_ontology_role_id  TEXT NOT NULL,
  to_ontology_role_id    TEXT NOT NULL,
  probability            NUMERIC(4,3),
  median_months          INT,
  evidence_basis         TEXT,
  computed_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m3_mobility_clusters (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  members       JSONB NOT NULL,        -- onto_role ids
  centroid      REAL[],
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m3_capability_adjacency_scores (
  id                       TEXT PRIMARY KEY,
  competency_a             TEXT NOT NULL,
  competency_b             TEXT NOT NULL,
  adjacency                NUMERIC(4,3),
  rationale                TEXT
);

-- 6. Dynamic Ontology Evolution ---------------------------------------------
CREATE TABLE IF NOT EXISTS m3_ontology_evolution_events (
  id          TEXT PRIMARY KEY,
  event_type  TEXT NOT NULL,        -- emerging_role|emerging_skill|deprecation|alias_add|version_bump
  target_id   TEXT,
  payload     JSONB DEFAULT '{}'::jsonb,
  approved    BOOLEAN DEFAULT false,
  detected_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m3_emerging_role_candidates (
  id              TEXT PRIMARY KEY,
  raw_title       TEXT NOT NULL,
  observed_count  INT,
  distinct_aliases INT,
  emergence_score NUMERIC(5,2),
  status          TEXT DEFAULT 'candidate', -- candidate|under_review|promoted|rejected
  detected_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m3_emerging_skill_candidates (
  id              TEXT PRIMARY KEY,
  raw_skill       TEXT NOT NULL,
  observed_count  INT,
  emergence_score NUMERIC(5,2),
  status          TEXT DEFAULT 'candidate',
  detected_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m3_deprecated_competencies (
  id                     TEXT PRIMARY KEY,
  ontology_competency_id TEXT NOT NULL,
  reason                 TEXT,
  replacement_id         TEXT,
  deprecated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS m3_ontology_change_audits (
  id          TEXT PRIMARY KEY,
  event_id    TEXT REFERENCES m3_ontology_evolution_events(id),
  actor       TEXT,
  action      TEXT,
  before      JSONB,
  after       JSONB,
  at          TIMESTAMPTZ DEFAULT now()
);

-- 7. Governance / Audit -----------------------------------------------------
CREATE TABLE IF NOT EXISTS m3_audit_logs (
  id           TEXT PRIMARY KEY,
  domain       TEXT NOT NULL,
  action       TEXT NOT NULL,
  subject_id   TEXT,
  payload      JSONB DEFAULT '{}'::jsonb,
  request_id   TEXT,
  ip           TEXT,
  at           TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_m3_audit_domain ON m3_audit_logs(domain);

-- ============================================================
-- SEED
-- ============================================================
INSERT INTO m3_source_registry(id, source_code, name, category, authority, refresh_freq, trust_score) VALUES
  ('msrc_linkedin', 'LINKEDIN_JOBS', 'LinkedIn Jobs',  'jobs',     'LinkedIn',         'daily',    0.85),
  ('msrc_indeed',   'INDEED',        'Indeed Postings','jobs',     'Indeed',           'daily',    0.80),
  ('msrc_onet',     'ONET',          'O*NET',          'standards','U.S. DoL',         'quarterly',0.95),
  ('msrc_esco',     'ESCO',          'ESCO',           'standards','European Union',   'quarterly',0.93),
  ('msrc_oecd',     'OECD',          'OECD Skills',    'forecast', 'OECD',             'quarterly',0.90),
  ('msrc_wef',      'WEF',           'WEF Future of Jobs','forecast','World Economic Forum','yearly',0.88),
  ('msrc_salary',   'SALARY_API',    'Salary Intelligence API','salary','Internal',    'weekly',   0.78)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m3_market_roles(id, market_title, industry, function, seniority, source_id, ontology_role_id, embedding, observed_count) VALUES
  ('mrole_eng_sr',   'Senior Software Engineer',  'Technology', 'Engineering', 'Senior', 'msrc_linkedin', NULL, ARRAY[0.81,0.10,0.22,0.55,0.40,0.30,0.45,0.50,0.10,0.20,0.30,0.60,0.40,0.50,0.20,0.30]::real[], 4200),
  ('mrole_ta_spec',  'Talent Acquisition Specialist','Cross', 'People',      'Mid',    'msrc_linkedin', NULL, ARRAY[0.10,0.78,0.20,0.30,0.65,0.20,0.10,0.40,0.50,0.30,0.20,0.10,0.30,0.20,0.60,0.50]::real[], 2100),
  ('mrole_pm_sr',    'Senior Product Manager',    'Technology', 'Product',     'Senior', 'msrc_linkedin', NULL, ARRAY[0.30,0.20,0.85,0.60,0.50,0.40,0.30,0.55,0.20,0.40,0.50,0.40,0.30,0.45,0.30,0.40]::real[], 1900),
  ('mrole_ds_lead',  'Lead Data Scientist',       'Technology', 'Data',        'Lead',   'msrc_indeed',   NULL, ARRAY[0.20,0.15,0.30,0.90,0.45,0.30,0.40,0.30,0.20,0.25,0.40,0.55,0.30,0.45,0.20,0.30]::real[], 1500),
  ('mrole_cyber_an', 'Cybersecurity Analyst',     'Technology', 'Security',    'Mid',    'msrc_indeed',   NULL, ARRAY[0.40,0.10,0.10,0.30,0.20,0.85,0.30,0.20,0.10,0.15,0.30,0.40,0.20,0.30,0.10,0.20]::real[], 1700)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m3_market_role_aliases(id, market_role_id, alias_title, similarity, source_id) VALUES
  ('mra_ta_1','mrole_ta_spec','Talent Acquisition Partner',0.95,'msrc_linkedin'),
  ('mra_ta_2','mrole_ta_spec','Recruitment Specialist',    0.92,'msrc_linkedin'),
  ('mra_ta_3','mrole_ta_spec','Hiring Consultant',          0.85,'msrc_indeed'),
  ('mra_ta_4','mrole_ta_spec','Talent Partner',             0.88,'msrc_linkedin'),
  ('mra_eng_1','mrole_eng_sr','Sr. Software Developer',     0.94,'msrc_linkedin'),
  ('mra_eng_2','mrole_eng_sr','Senior Backend Engineer',    0.90,'msrc_linkedin'),
  ('mra_pm_1','mrole_pm_sr','Sr Product Manager',           0.97,'msrc_linkedin'),
  ('mra_pm_2','mrole_pm_sr','Senior PM',                    0.93,'msrc_indeed'),
  ('mra_cy_1','mrole_cyber_an','SOC Analyst',               0.82,'msrc_indeed'),
  ('mra_ds_1','mrole_ds_lead','Principal Data Scientist',   0.86,'msrc_linkedin')
ON CONFLICT (id) DO NOTHING;

INSERT INTO m3_market_competencies(id, market_skill, ontology_competency_id, embedding, category, emerging) VALUES
  ('mcomp_python',    'Python Programming',       'TEC', ARRAY[0.90,0.20,0.10,0.30,0.40,0.20,0.10,0.20,0.30,0.20,0.40,0.50,0.30,0.20,0.10,0.20]::real[], 'technical', false),
  ('mcomp_genai',     'Generative AI',            'TEC', ARRAY[0.85,0.30,0.20,0.40,0.50,0.30,0.20,0.30,0.40,0.30,0.50,0.60,0.40,0.30,0.20,0.30]::real[], 'technical', true),
  ('mcomp_leader',    'Leadership',               'LEA', ARRAY[0.20,0.30,0.85,0.40,0.50,0.30,0.40,0.60,0.30,0.40,0.30,0.20,0.30,0.40,0.50,0.30]::real[], 'leadership', false),
  ('mcomp_eq',        'Emotional Intelligence',   'EIQ', ARRAY[0.10,0.40,0.20,0.30,0.85,0.20,0.30,0.40,0.50,0.30,0.20,0.10,0.30,0.20,0.60,0.40]::real[], 'behavioural', false),
  ('mcomp_strat',     'Strategic Thinking',       'STR', ARRAY[0.20,0.30,0.40,0.50,0.30,0.40,0.85,0.30,0.20,0.40,0.50,0.30,0.40,0.30,0.20,0.30]::real[], 'cognitive', false),
  ('mcomp_comm',      'Stakeholder Communication','COM', ARRAY[0.30,0.20,0.40,0.30,0.50,0.20,0.30,0.85,0.40,0.30,0.20,0.30,0.40,0.30,0.50,0.20]::real[], 'behavioural', false),
  ('mcomp_cloud',     'Cloud Architecture',       'TEC', ARRAY[0.80,0.20,0.30,0.40,0.30,0.50,0.20,0.30,0.40,0.30,0.50,0.60,0.40,0.30,0.20,0.30]::real[], 'technical', false),
  ('mcomp_prompt',    'Prompt Engineering',       NULL,  ARRAY[0.70,0.40,0.30,0.50,0.40,0.30,0.20,0.40,0.50,0.30,0.40,0.50,0.30,0.40,0.30,0.20]::real[], 'technical', true),
  ('mcomp_climate',   'Climate Risk Analysis',    NULL,  ARRAY[0.30,0.20,0.40,0.50,0.30,0.20,0.40,0.30,0.20,0.50,0.40,0.30,0.40,0.50,0.30,0.20]::real[], 'analytical', true),
  ('mcomp_adapt',     'Adaptability',             'ADP', ARRAY[0.20,0.30,0.40,0.30,0.50,0.20,0.30,0.40,0.85,0.30,0.20,0.30,0.40,0.30,0.50,0.20]::real[], 'behavioural', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m3_skill_demand(id, market_competency_id, geo, industry, posting_count, growth_rate, demand_score, source_id) VALUES
  ('msd_python_g',  'mcomp_python',  'GLOBAL', 'Technology', 124000, 3.2,  88, 'msrc_linkedin'),
  ('msd_genai_g',   'mcomp_genai',   'GLOBAL', 'Technology',  68000, 22.4, 94, 'msrc_linkedin'),
  ('msd_leader_g',  'mcomp_leader',  'GLOBAL', 'Cross',       96000, 1.1,  76, 'msrc_linkedin'),
  ('msd_eq_g',      'mcomp_eq',      'GLOBAL', 'Cross',       42000, 4.0,  72, 'msrc_indeed'),
  ('msd_strat_g',   'mcomp_strat',   'GLOBAL', 'Cross',       38000, 2.5,  74, 'msrc_indeed'),
  ('msd_comm_g',    'mcomp_comm',    'GLOBAL', 'Cross',       82000, 0.8,  70, 'msrc_indeed'),
  ('msd_cloud_g',   'mcomp_cloud',   'GLOBAL', 'Technology',  71000, 5.2,  85, 'msrc_linkedin'),
  ('msd_prompt_g',  'mcomp_prompt',  'GLOBAL', 'Technology',  18000, 38.7, 92, 'msrc_linkedin'),
  ('msd_climate_g', 'mcomp_climate', 'GLOBAL', 'Finance',      9000, 15.3, 78, 'msrc_indeed'),
  ('msd_adapt_g',   'mcomp_adapt',   'GLOBAL', 'Cross',       54000, 1.7,  68, 'msrc_indeed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO m3_salary_trends(id, market_role_id, geo, currency, p25, p50, p75, yoy_change, source_id) VALUES
  ('msal_eng_us',  'mrole_eng_sr',  'US', 'USD', 145000, 180000, 230000, 4.2,  'msrc_salary'),
  ('msal_pm_us',   'mrole_pm_sr',   'US', 'USD', 155000, 195000, 250000, 3.6,  'msrc_salary'),
  ('msal_ds_us',   'mrole_ds_lead', 'US', 'USD', 175000, 220000, 280000, 5.0,  'msrc_salary'),
  ('msal_ta_us',   'mrole_ta_spec', 'US', 'USD',  85000, 105000, 135000, 2.8,  'msrc_salary'),
  ('msal_cy_us',   'mrole_cyber_an','US', 'USD', 105000, 130000, 165000, 6.1,  'msrc_salary')
ON CONFLICT (id) DO NOTHING;

INSERT INTO m3_role_trends(id, market_role_id, snapshot_date, postings, applications, hires, hiring_velocity) VALUES
  ('mrt_eng_2026q2',  'mrole_eng_sr',  CURRENT_DATE,  4200, 38000, 850, 0.85),
  ('mrt_pm_2026q2',   'mrole_pm_sr',   CURRENT_DATE,  1900, 22000, 410, 0.78),
  ('mrt_ds_2026q2',   'mrole_ds_lead', CURRENT_DATE,  1500, 14000, 280, 0.81),
  ('mrt_ta_2026q2',   'mrole_ta_spec', CURRENT_DATE,  2100, 18000, 420, 0.72),
  ('mrt_cy_2026q2',   'mrole_cyber_an',CURRENT_DATE,  1700, 11000, 320, 0.88)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m3_emerging_competencies(id, market_competency_id, emergence_score, forecast_horizon_months, evidence) VALUES
  ('memc_genai',   'mcomp_genai',   94, 12, '{"drivers":["LLM adoption","copilot tooling","enterprise AI"]}'::jsonb),
  ('memc_prompt',  'mcomp_prompt',  92, 12, '{"drivers":["LLM ubiquity","agentic workflows"]}'::jsonb),
  ('memc_climate', 'mcomp_climate', 78, 24, '{"drivers":["EU CSRD","TCFD","green finance"]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m3_industry_demand(id, industry, role_family, growth_score) VALUES
  ('mind_tech',     'Technology','engineering', 88),
  ('mind_fin_ai',   'Finance',   'data',        82),
  ('mind_green',    'Sustainability','climate',  76),
  ('mind_cyber',    'Security',  'cyber',       84)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m3_geography_demand(id, geo, role_family, demand_score) VALUES
  ('mgeo_us_eng',  'US',    'engineering', 92),
  ('mgeo_eu_eng',  'EU',    'engineering', 84),
  ('mgeo_in_eng',  'IN',    'engineering', 88),
  ('mgeo_us_ds',   'US',    'data',        90),
  ('mgeo_global_cy','GLOBAL','cyber',      87)
ON CONFLICT (id) DO NOTHING;

-- Evidence sources catalogue
INSERT INTO m3_evidence_sources(id, source_code, source_type, provider, trust_weight, verifiable) VALUES
  ('mes_assess',  'CAPADEX_ASSESS',  'assessment', 'MetryxOne',  0.85, true),
  ('mes_cert',    'CERTIFICATION',   'cert',       'External',    0.90, true),
  ('mes_project', 'PROJECT',         'project',    'Self',        0.65, false),
  ('mes_resume',  'RESUME',          'resume',     'Self',        0.55, false),
  ('mes_peer',    'PEER_FEEDBACK',   'peer',       'Internal',    0.70, true),
  ('mes_mgr',     'MANAGER_REVIEW',  'manager',    'Internal',    0.85, true),
  ('mes_perf',    'PERFORMANCE',     'perf',       'Internal',    0.88, true),
  ('mes_port',    'PORTFOLIO',       'portfolio',  'External',    0.72, false),
  ('mes_learn',   'LEARNING_HISTORY','learning',   'Internal',    0.68, true)
ON CONFLICT (id) DO NOTHING;

-- Seed canonical mappings (market_role → ontology_role; nullable target ok)
INSERT INTO m3_canonical_role_mappings(id, raw_title, market_role_id, ontology_role_id, similarity, method) VALUES
  ('mcrm_1','Talent Acquisition Partner','mrole_ta_spec',NULL,0.95,'alias'),
  ('mcrm_2','Sr. Software Developer',    'mrole_eng_sr', NULL,0.94,'alias'),
  ('mcrm_3','Senior PM',                  'mrole_pm_sr', NULL,0.93,'alias'),
  ('mcrm_4','SOC Analyst',                'mrole_cyber_an',NULL,0.82,'alias')
ON CONFLICT (id) DO NOTHING;

-- Career mobility seed (uses ontology role ids if present; else mrole_* fallback)
INSERT INTO m3_role_adjacency(id, from_ontology_role_id, to_ontology_role_id, capability_similarity, market_adjacency, adjacency_score, rationale) VALUES
  ('madj_eng_pm','mrole_eng_sr','mrole_pm_sr',0.62,0.75,0.68,'Shared technical + product strategy adjacency'),
  ('madj_eng_ds','mrole_eng_sr','mrole_ds_lead',0.71,0.80,0.75,'Engineering→data analytics transition'),
  ('madj_pm_ds','mrole_pm_sr','mrole_ds_lead',0.55,0.65,0.60,'Analytics-driven product paths'),
  ('madj_eng_cy','mrole_eng_sr','mrole_cyber_an',0.58,0.70,0.64,'Software→security adjacency'),
  ('madj_ta_pm','mrole_ta_spec','mrole_pm_sr',0.38,0.45,0.41,'People→product is a longer reach')
ON CONFLICT (id) DO NOTHING;

INSERT INTO m3_transition_probability(id, from_ontology_role_id, to_ontology_role_id, probability, median_months, evidence_basis) VALUES
  ('mtp_eng_pm','mrole_eng_sr','mrole_pm_sr',0.42,18,'LinkedIn transitions sample'),
  ('mtp_eng_ds','mrole_eng_sr','mrole_ds_lead',0.36,24,'O*NET adjacent occupations'),
  ('mtp_pm_ds','mrole_pm_sr','mrole_ds_lead',0.21,30,'Cross-role analytics path'),
  ('mtp_eng_cy','mrole_eng_sr','mrole_cyber_an',0.28,20,'Security specialisation path')
ON CONFLICT (id) DO NOTHING;

INSERT INTO m3_career_paths(id, name, family, steps, popularity) VALUES
  ('mcp_eng_arch','Engineering → Architect → CTO','engineering',
     '["mrole_eng_sr","onto_arch","onto_cto"]'::jsonb, 88),
  ('mcp_pm_cpo','Product Manager → VP Product → CPO','product',
     '["mrole_pm_sr","onto_vp_prod","onto_cpo"]'::jsonb, 72),
  ('mcp_ds_chief','Data Scientist → ML Lead → Chief Data Officer','data',
     '["mrole_ds_lead","onto_ml_lead","onto_cdo"]'::jsonb, 65)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m3_capability_adjacency_scores(id, competency_a, competency_b, adjacency, rationale) VALUES
  ('mcas_tec_str','TEC','STR',0.55,'Technical depth bridges to strategic systems thinking'),
  ('mcas_lea_eiq','LEA','EIQ',0.82,'Leadership effectiveness anchored in emotional intelligence'),
  ('mcas_com_lea','COM','LEA',0.78,'Communication is a leadership prerequisite'),
  ('mcas_adp_str','ADP','STR',0.66,'Adaptability supports strategic pivoting'),
  ('mcas_cog_str','COG','STR',0.74,'Cognitive depth bridges to strategy')
ON CONFLICT (id) DO NOTHING;

-- Dynamic ontology evolution seed (open candidates)
INSERT INTO m3_emerging_role_candidates(id, raw_title, observed_count, distinct_aliases, emergence_score, status) VALUES
  ('merc_promptpm','Prompt-Aware Product Manager', 312, 7, 81, 'candidate'),
  ('merc_aiops',   'AI Operations Engineer',      488, 9, 86, 'candidate'),
  ('merc_clmrisk', 'Climate Risk Lead',           198, 5, 74, 'candidate')
ON CONFLICT (id) DO NOTHING;

INSERT INTO m3_emerging_skill_candidates(id, raw_skill, observed_count, emergence_score, status) VALUES
  ('mesc_agent',  'Agent Orchestration',           420, 88, 'candidate'),
  ('mesc_vectdb', 'Vector Database Engineering',   285, 79, 'candidate'),
  ('mesc_aigov',  'AI Governance & Safety',        367, 84, 'candidate')
ON CONFLICT (id) DO NOTHING;

INSERT INTO m3_ontology_evolution_events(id, event_type, target_id, payload) VALUES
  ('moee_1','emerging_skill','mesc_agent',  '{"reason":"38% MoM growth in postings","horizon":"12m"}'::jsonb),
  ('moee_2','emerging_role', 'merc_aiops',  '{"reason":"distinct alias clusters exceeded threshold","aliases":9}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Precomputed market scores for the 5 core competencies + 5 roles (deterministic)
INSERT INTO m3_competency_market_scores(id, ontology_competency_id, hiring_frequency, salary_velocity, industry_growth, future_relevance, automation_risk, market_demand) VALUES
  ('mcms_tec','TEC',88, 70, 86, 92, 40, 79.2),
  ('mcms_lea','LEA',76, 50, 70, 84, 12, 73.6),
  ('mcms_eiq','EIQ',72, 45, 68, 86, 8,  72.6),
  ('mcms_str','STR',74, 55, 72, 88, 14, 75.0),
  ('mcms_com','COM',70, 40, 65, 78, 16, 67.4),
  ('mcms_adp','ADP',68, 38, 64, 82, 10, 68.4),
  ('mcms_cog','COG',71, 42, 66, 80, 18, 68.2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m3_role_market_scores(id, ontology_role_id, hiring_demand, salary_strength, growth_trend, market_score) VALUES
  ('mrms_eng','mrole_eng_sr', 90,82,78,83.3),
  ('mrms_pm', 'mrole_pm_sr',  78,84,72,78.0),
  ('mrms_ds', 'mrole_ds_lead',82,88,80,83.3),
  ('mrms_ta', 'mrole_ta_spec',70,62,58,63.3),
  ('mrms_cy', 'mrole_cyber_an',86,76,84,82.0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m3_future_skill_forecasts(id, ontology_competency_id, horizon_months, forecast_score, confidence, drivers) VALUES
  ('mfsf_tec_12','TEC',12,82,0.78,'["GenAI adoption","cloud-native scale"]'::jsonb),
  ('mfsf_str_24','STR',24,86,0.72,'["enterprise AI strategy"]'::jsonb),
  ('mfsf_eiq_24','EIQ',24,84,0.80,'["hybrid work","human-AI collaboration"]'::jsonb),
  ('mfsf_lea_36','LEA',36,86,0.74,'["distributed leadership"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO m3_market_velocity_scores(id, ontology_competency_id, ontology_role_id, velocity_score, trend_direction) VALUES
  ('mvel_tec',    'TEC', NULL,  6.5, 'rising'),
  ('mvel_eiq',    'EIQ', NULL,  2.0, 'rising'),
  ('mvel_com',    'COM', NULL, -0.5, 'stable'),
  ('mvel_roleds', NULL,'mrole_ds_lead', 7.2, 'rising'),
  ('mvel_roleta', NULL,'mrole_ta_spec', -1.2,'declining')
ON CONFLICT (id) DO NOTHING;

-- Demo evidence nodes for a single subject
INSERT INTO m3_evidence_nodes(id, subject_id, ontology_competency_id, evidence_source_id, evidence_kind, evidence_payload, observed_strength, weight, verification_status) VALUES
  ('men_d_1','demo_user','TEC','mes_assess','assessment','{"summary":"Capadex TEC 78"}'::jsonb,0.78,0.85,'verified'),
  ('men_d_2','demo_user','TEC','mes_cert',  'cert',      '{"summary":"AWS SA-Pro"}'::jsonb,    0.90,0.90,'verified'),
  ('men_d_3','demo_user','LEA','mes_mgr',   'manager',   '{"summary":"Led 6 ICs FY25"}'::jsonb,0.72,0.85,'verified'),
  ('men_d_4','demo_user','EIQ','mes_peer',  'peer',      '{"summary":"360 EI strong"}'::jsonb, 0.68,0.70,'peer'),
  ('men_d_5','demo_user','COM','mes_project','project',  '{"summary":"Cross-org launch"}'::jsonb,0.62,0.65,'self'),
  ('men_d_6','demo_user','STR','mes_perf',  'perf',      '{"summary":"H1 strategy doc"}'::jsonb,0.74,0.88,'verified')
ON CONFLICT (id) DO NOTHING;

INSERT INTO m3_capability_evidence_links(id, subject_id, ontology_competency_id, evidence_node_id, contribution) VALUES
  ('mcel_1','demo_user','TEC','men_d_1',0.45),
  ('mcel_2','demo_user','TEC','men_d_2',0.55),
  ('mcel_3','demo_user','LEA','men_d_3',1.00),
  ('mcel_4','demo_user','EIQ','men_d_4',1.00),
  ('mcel_5','demo_user','COM','men_d_5',1.00),
  ('mcel_6','demo_user','STR','men_d_6',1.00)
ON CONFLICT (id) DO NOTHING;
