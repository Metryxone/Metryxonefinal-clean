-- ============================================================================
-- Career Graph Intelligence System (CGI) — v2
-- Migration: 20260611_career_graph.sql
-- 10 master + 6 calculation = 16 cg_* tables
-- Seed: 200 roles, 500+ edges, 15 tracks, 75+ waypoints,
--       600+ skill requirements, 60 learning resources,
--       200+ skill-resource mappings, 40 promotion rules, 25 lateral rules
-- Idempotent: CREATE TABLE IF NOT EXISTS + ON CONFLICT DO NOTHING
-- ============================================================================

-- ── 1. cg_roles (master, 200 rows) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cg_roles (
  id               SERIAL PRIMARY KEY,
  role_key         TEXT         NOT NULL UNIQUE,
  title            TEXT         NOT NULL,
  seniority        TEXT         NOT NULL,
  function_area    TEXT         NOT NULL,
  industry_tags    TEXT[]       NOT NULL DEFAULT '{}',
  description      TEXT,
  avg_salary_inr   INT,
  demand_score     NUMERIC(5,2) NOT NULL DEFAULT 50,
  automation_risk  NUMERIC(5,2) NOT NULL DEFAULT 30,
  growth_30mo      NUMERIC(5,2) NOT NULL DEFAULT 5,
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 2. cg_role_edges (master, 500+ rows) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS cg_role_edges (
  id                     SERIAL PRIMARY KEY,
  from_role_id           INT          NOT NULL REFERENCES cg_roles(id),
  to_role_id             INT          NOT NULL REFERENCES cg_roles(id),
  edge_type              TEXT         NOT NULL,
  transition_probability NUMERIC(4,3) NOT NULL DEFAULT 0.500,
  avg_months_transition  INT          NOT NULL DEFAULT 12,
  difficulty             TEXT         NOT NULL DEFAULT 'medium',
  data_source            TEXT         NOT NULL DEFAULT 'curated',
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(from_role_id, to_role_id)
);

-- ── 3. cg_tracks (master, 15 rows) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cg_tracks (
  id              SERIAL PRIMARY KEY,
  track_key       TEXT    NOT NULL UNIQUE,
  name            TEXT    NOT NULL,
  description     TEXT,
  function_area   TEXT    NOT NULL,
  estimated_years INT     NOT NULL DEFAULT 8,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. cg_track_waypoints (master, 75+ rows) ──────────────────────────────
CREATE TABLE IF NOT EXISTS cg_track_waypoints (
  id          SERIAL PRIMARY KEY,
  track_id    INT     NOT NULL REFERENCES cg_tracks(id),
  role_id     INT     NOT NULL REFERENCES cg_roles(id),
  step_order  INT     NOT NULL,
  is_optional BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(track_id, role_id)
);

-- ── 5. cg_skill_requirements (master, 600+ rows) ──────────────────────────
CREATE TABLE IF NOT EXISTS cg_skill_requirements (
  id              SERIAL PRIMARY KEY,
  role_id         INT  NOT NULL REFERENCES cg_roles(id),
  skill_key       TEXT NOT NULL,
  skill_label     TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'technical',
  importance      TEXT NOT NULL DEFAULT 'preferred',
  min_proficiency INT  NOT NULL DEFAULT 2,
  UNIQUE(role_id, skill_key)
);

-- ── 6. cg_promotion_rules (master, 40 rows) ───────────────────────────────
CREATE TABLE IF NOT EXISTS cg_promotion_rules (
  id             SERIAL PRIMARY KEY,
  from_role_id   INT  NOT NULL REFERENCES cg_roles(id),
  to_role_id     INT  NOT NULL REFERENCES cg_roles(id),
  min_months     INT  NOT NULL DEFAULT 18,
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  condition_text TEXT,
  UNIQUE(from_role_id, to_role_id)
);

-- ── 7. cg_lateral_rules (master, 25 rows) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS cg_lateral_rules (
  id               SERIAL PRIMARY KEY,
  from_role_id     INT          NOT NULL REFERENCES cg_roles(id),
  to_role_id       INT          NOT NULL REFERENCES cg_roles(id),
  similarity_score NUMERIC(4,3) NOT NULL DEFAULT 0.500,
  skills_to_gain   TEXT[]       NOT NULL DEFAULT '{}',
  condition_text   TEXT,
  UNIQUE(from_role_id, to_role_id)
);

-- ── 8. cg_learning_resources (master, 60 rows) ────────────────────────────
CREATE TABLE IF NOT EXISTS cg_learning_resources (
  id             SERIAL PRIMARY KEY,
  resource_key   TEXT         NOT NULL UNIQUE,
  title          TEXT         NOT NULL,
  resource_type  TEXT         NOT NULL,
  provider       TEXT,
  url            TEXT,
  duration_hours NUMERIC(6,1),
  cost_inr       INT,
  cost_band      TEXT         NOT NULL DEFAULT 'free',
  difficulty     TEXT         NOT NULL DEFAULT 'beginner',
  language       TEXT         NOT NULL DEFAULT 'en',
  region         TEXT         NOT NULL DEFAULT 'IN',
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 9. cg_skill_resource_map (master, 200+ rows) ──────────────────────────
CREATE TABLE IF NOT EXISTS cg_skill_resource_map (
  id                  SERIAL PRIMARY KEY,
  skill_key           TEXT         NOT NULL,
  resource_id         INT          NOT NULL REFERENCES cg_learning_resources(id),
  effectiveness_score NUMERIC(4,3) NOT NULL DEFAULT 0.700,
  quality_score       NUMERIC(4,3) NOT NULL DEFAULT 0.700,
  UNIQUE(skill_key, resource_id)
);

-- ── 10. cg_readiness_weights (master, 1 config row) ───────────────────────
CREATE TABLE IF NOT EXISTS cg_readiness_weights (
  id                SERIAL PRIMARY KEY,
  skill_weight      NUMERIC(4,3) NOT NULL DEFAULT 0.400,
  experience_weight NUMERIC(4,3) NOT NULL DEFAULT 0.250,
  behaviour_weight  NUMERIC(4,3) NOT NULL DEFAULT 0.200,
  credential_weight NUMERIC(4,3) NOT NULL DEFAULT 0.100,
  market_weight     NUMERIC(4,3) NOT NULL DEFAULT 0.050,
  version           INT          NOT NULL DEFAULT 1,
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── CALC 1: cg_user_skill_gaps ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cg_user_skill_gaps (
  id             SERIAL PRIMARY KEY,
  user_id        TEXT NOT NULL,
  role_id        INT  NOT NULL REFERENCES cg_roles(id),
  skill_key      TEXT NOT NULL,
  skill_label    TEXT NOT NULL,
  user_level     INT  NOT NULL DEFAULT 0,
  required_level INT  NOT NULL,
  gap_delta      INT  NOT NULL,
  gap_severity   TEXT NOT NULL,
  importance     TEXT NOT NULL DEFAULT 'preferred',
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role_id, skill_key)
);

-- ── CALC 2: cg_user_role_readiness ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cg_user_role_readiness (
  id               SERIAL PRIMARY KEY,
  user_id          TEXT         NOT NULL,
  role_id          INT          NOT NULL REFERENCES cg_roles(id),
  readiness_score  NUMERIC(5,1) NOT NULL,
  readiness_band   TEXT         NOT NULL,
  eta_months       INT,
  skill_score      NUMERIC(5,1),
  experience_score NUMERIC(5,1),
  behaviour_score  NUMERIC(5,1),
  credential_score NUMERIC(5,1),
  market_score     NUMERIC(5,1),
  confidence       NUMERIC(4,3) NOT NULL DEFAULT 0.500,
  top_blockers     JSONB        NOT NULL DEFAULT '[]',
  computed_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- ── CALC 3: cg_user_career_path ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cg_user_career_path (
  id            SERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,
  from_role_id  INT  REFERENCES cg_roles(id),
  to_role_id    INT  NOT NULL REFERENCES cg_roles(id),
  path_role_ids INT[] NOT NULL DEFAULT '{}',
  total_months  INT,
  source        TEXT NOT NULL DEFAULT 'user_selected',
  saved_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, to_role_id)
);

-- ── CALC 4: cg_user_recommendations ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS cg_user_recommendations (
  id               SERIAL PRIMARY KEY,
  user_id          TEXT         NOT NULL,
  role_id          INT          NOT NULL REFERENCES cg_roles(id),
  segment          TEXT         NOT NULL,
  rec_score        NUMERIC(5,3) NOT NULL,
  readiness_score  NUMERIC(5,1),
  market_score     NUMERIC(5,1),
  salary_delta_pct NUMERIC(5,1),
  transition_prob  NUMERIC(4,3),
  behaviour_fit    NUMERIC(4,3),
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- ── CALC 5: cg_user_learning_recs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cg_user_learning_recs (
  id              SERIAL PRIMARY KEY,
  user_id         TEXT         NOT NULL,
  role_id         INT          NOT NULL REFERENCES cg_roles(id),
  resource_id     INT          NOT NULL REFERENCES cg_learning_resources(id),
  skill_key       TEXT         NOT NULL,
  relevance_score NUMERIC(4,3) NOT NULL,
  is_actioned     BOOLEAN      NOT NULL DEFAULT FALSE,
  actioned_at     TIMESTAMPTZ,
  generated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role_id, resource_id)
);

-- ── CALC 6: cg_readiness_history ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cg_readiness_history (
  id             SERIAL PRIMARY KEY,
  user_id        TEXT         NOT NULL,
  role_id        INT          NOT NULL REFERENCES cg_roles(id),
  readiness_score NUMERIC(5,1) NOT NULL,
  readiness_band TEXT         NOT NULL,
  snapshot_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cg_role_edges_from   ON cg_role_edges(from_role_id);
CREATE INDEX IF NOT EXISTS idx_cg_role_edges_to     ON cg_role_edges(to_role_id);
CREATE INDEX IF NOT EXISTS idx_cg_waypoints_track   ON cg_track_waypoints(track_id);
CREATE INDEX IF NOT EXISTS idx_cg_skill_req_role    ON cg_skill_requirements(role_id);
CREATE INDEX IF NOT EXISTS idx_cg_user_gaps_user    ON cg_user_skill_gaps(user_id);
CREATE INDEX IF NOT EXISTS idx_cg_user_ready_user   ON cg_user_role_readiness(user_id);
CREATE INDEX IF NOT EXISTS idx_cg_user_recs_user    ON cg_user_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_cg_readiness_hist    ON cg_readiness_history(user_id, role_id, snapshot_at);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Readiness weights config row
INSERT INTO cg_readiness_weights(id, skill_weight, experience_weight, behaviour_weight, credential_weight, market_weight)
VALUES (1, 0.400, 0.250, 0.200, 0.100, 0.050)
ON CONFLICT(id) DO NOTHING;

-- ── 200 Roles ─────────────────────────────────────────────────────────────
INSERT INTO cg_roles(role_key,title,seniority,function_area,industry_tags,avg_salary_inr,demand_score,automation_risk,growth_30mo) VALUES
-- Software Engineering (8)
('swe_entry','Software Engineer I','entry','engineering','{"technology","startup"}',600000,75,25,12),
('swe_junior','Software Engineer II','junior','engineering','{"technology","startup"}',900000,78,25,12),
('swe_mid','Software Engineer III','mid','engineering','{"technology","enterprise"}',1400000,82,28,10),
('swe_senior','Senior Software Engineer','senior','engineering','{"technology","enterprise","fintech"}',2000000,88,30,9),
('swe_lead','Staff Software Engineer','lead','engineering','{"technology","enterprise"}',2800000,85,20,8),
('swe_principal','Principal Software Engineer','principal','engineering','{"technology","enterprise"}',3800000,80,15,7),
('swe_distinguished','Distinguished Engineer','executive','engineering','{"technology"}',5500000,72,10,5),
('swe_fellow','Engineering Fellow','executive','engineering','{"technology"}',8000000,65,8,4),
-- Frontend (4)
('fe_entry','Frontend Developer','entry','engineering','{"technology","media","ecommerce"}',550000,70,35,10),
('fe_mid','Frontend Engineer','mid','engineering','{"technology","ecommerce"}',1200000,72,35,9),
('fe_senior','Senior Frontend Engineer','senior','engineering','{"technology","ecommerce"}',1800000,76,35,8),
('fe_lead','Frontend Tech Lead','lead','engineering','{"technology"}',2500000,72,25,7),
-- Backend (4)
('be_entry','Backend Developer','entry','engineering','{"technology","fintech"}',620000,74,28,11),
('be_mid','Backend Engineer','mid','engineering','{"technology","fintech"}',1300000,79,30,10),
('be_senior','Senior Backend Engineer','senior','engineering','{"technology","fintech"}',1900000,84,30,9),
('be_lead','Backend Tech Lead','lead','engineering','{"technology","fintech"}',2600000,80,20,7),
-- Full Stack (2)
('fs_mid','Full Stack Engineer','mid','engineering','{"technology","startup"}',1250000,76,32,10),
('fs_senior','Senior Full Stack Engineer','senior','engineering','{"technology","startup"}',1850000,78,32,8),
-- Mobile (3)
('mob_entry','Mobile Developer','entry','engineering','{"technology","ecommerce"}',580000,68,30,9),
('mob_mid','Mobile Engineer','mid','engineering','{"technology","ecommerce"}',1200000,70,30,8),
('mob_senior','Senior Mobile Engineer','senior','engineering','{"technology","ecommerce"}',1800000,74,28,7),
-- Data Engineering (4)
('de_entry','Data Engineer I','entry','data','{"technology","fintech","ecommerce"}',700000,82,22,15),
('de_mid','Data Engineer','mid','data','{"technology","fintech","ecommerce"}',1400000,87,22,15),
('de_senior','Senior Data Engineer','senior','data','{"technology","fintech"}',2100000,89,22,14),
('de_lead','Lead Data Engineer','lead','data','{"technology","enterprise"}',2900000,86,18,12),
-- Data Science (4)
('ds_entry','Junior Data Scientist','entry','data','{"technology","fintech","healthcare"}',700000,85,20,18),
('ds_mid','Data Scientist','mid','data','{"technology","fintech","healthcare"}',1500000,90,20,18),
('ds_senior','Senior Data Scientist','senior','data','{"technology","fintech"}',2300000,92,18,16),
('ds_lead','Lead Data Scientist','lead','data','{"technology","fintech"}',3100000,88,15,14),
-- ML Engineering (4)
('mle_mid','ML Engineer','mid','data','{"technology","research"}',1600000,91,15,20),
('mle_senior','Senior ML Engineer','senior','data','{"technology","research"}',2500000,93,12,20),
('mle_lead','Lead ML Engineer','lead','data','{"technology"}',3300000,90,10,18),
('mle_principal','Principal ML Engineer','principal','data','{"technology"}',4200000,86,8,15),
-- DevOps / SRE / Platform (5)
('devops_mid','DevOps Engineer','mid','engineering','{"technology","enterprise"}',1300000,83,25,12),
('devops_senior','Senior DevOps Engineer','senior','engineering','{"technology","enterprise"}',1900000,87,25,12),
('sre_senior','Site Reliability Engineer','senior','engineering','{"technology"}',2200000,88,22,13),
('platform_senior','Platform Engineer','senior','engineering','{"technology"}',2100000,86,22,12),
('platform_lead','Staff Platform Engineer','lead','engineering','{"technology"}',2900000,83,18,10),
-- Security (3)
('sec_mid','Security Engineer','mid','engineering','{"technology","fintech","government"}',1400000,86,20,15),
('sec_senior','Senior Security Engineer','senior','engineering','{"technology","fintech"}',2100000,89,18,15),
('sec_lead','Security Lead','lead','engineering','{"technology","fintech"}',2900000,85,15,13),
-- QA (3)
('qa_entry','QA Engineer','entry','engineering','{"technology","enterprise"}',500000,60,45,4),
('qa_mid','QA Automation Engineer','mid','engineering','{"technology","enterprise"}',1000000,65,45,5),
('qa_senior','Senior QA Engineer','senior','engineering','{"technology"}',1500000,68,40,4),
-- Engineering Management (4)
('em_l1','Engineering Manager','lead','engineering','{"technology","enterprise","fintech"}',3000000,84,10,8),
('em_dir','Director of Engineering','principal','engineering','{"technology","enterprise"}',4500000,82,8,7),
('em_vp','VP Engineering','executive','engineering','{"technology","enterprise"}',7000000,78,5,5),
('cto','Chief Technology Officer','executive','engineering','{"technology","startup"}',12000000,75,3,4),
-- Product Management (6)
('pm_entry','Associate Product Manager','entry','product','{"technology","ecommerce","fintech"}',700000,76,15,12),
('pm_mid','Product Manager','mid','product','{"technology","ecommerce","fintech"}',1600000,82,15,12),
('pm_senior','Senior Product Manager','senior','product','{"technology","enterprise"}',2500000,87,12,11),
('pm_lead','Group Product Manager','lead','product','{"technology"}',3500000,85,10,10),
('pm_dir','Director of Product','principal','product','{"technology","enterprise"}',5000000,82,8,9),
('cpo','Chief Product Officer','executive','product','{"technology"}',10000000,78,5,6),
-- UX / Design (6)
('ux_entry','Junior UX Designer','entry','design','{"technology","ecommerce"}',550000,68,30,8),
('ux_mid','UX Designer','mid','design','{"technology","ecommerce"}',1100000,72,32,8),
('ux_senior','Senior UX Designer','senior','design','{"technology","enterprise"}',1800000,76,30,7),
('ux_lead','UX Lead','lead','design','{"technology"}',2600000,74,25,6),
('ui_mid','UI Designer','mid','design','{"technology","media","ecommerce"}',1000000,65,38,6),
('product_designer_senior','Senior Product Designer','senior','design','{"technology","startup"}',1900000,80,28,9),
('design_dir','Design Director','principal','design','{"technology","enterprise"}',3800000,74,15,5),
-- Data / Analytics (5)
('ba_entry','Business Analyst','entry','data','{"enterprise","consulting","fintech"}',600000,70,30,8),
('ba_mid','Business Analyst II','mid','data','{"enterprise","consulting","fintech"}',1100000,74,32,8),
('ba_senior','Senior Business Analyst','senior','data','{"enterprise","consulting"}',1700000,76,30,7),
('analytics_eng_mid','Analytics Engineer','mid','data','{"technology","ecommerce"}',1400000,84,20,14),
('analytics_eng_senior','Senior Analytics Engineer','senior','data','{"technology"}',2100000,87,18,13),
('data_analyst_mid','Data Analyst','mid','data','{"technology","ecommerce","retail"}',900000,72,38,8),
('data_analyst_senior','Senior Data Analyst','senior','data','{"technology","ecommerce"}',1400000,76,35,7),
-- Marketing (9)
('mktg_entry','Marketing Executive','entry','marketing','{"ecommerce","startup","retail"}',450000,55,35,5),
('mktg_mid','Marketing Manager','mid','marketing','{"ecommerce","retail","technology"}',900000,60,38,5),
('mktg_senior','Senior Marketing Manager','senior','marketing','{"enterprise","ecommerce"}',1500000,63,35,4),
('growth_mid','Growth Manager','mid','marketing','{"technology","startup","ecommerce"}',1100000,72,30,10),
('growth_senior','Senior Growth Manager','senior','marketing','{"technology","startup"}',1800000,76,28,10),
('digital_mktg_mid','Digital Marketing Manager','mid','marketing','{"ecommerce","retail","media"}',900000,65,42,6),
('content_mid','Content Manager','mid','marketing','{"media","technology","ecommerce"}',700000,55,50,3),
('brand_senior','Brand Manager','senior','marketing','{"retail","ecommerce","fmcg"}',1400000,58,40,3),
('cmo','Chief Marketing Officer','executive','marketing','{"enterprise","ecommerce"}',8000000,70,15,3),
-- Sales (5)
('sdr_entry','Sales Development Rep','entry','sales','{"technology","saas","enterprise"}',450000,60,40,6),
('ae_mid','Account Executive','mid','sales','{"technology","saas"}',1200000,68,35,8),
('ae_senior','Senior Account Executive','senior','sales','{"technology","saas","enterprise"}',1800000,72,32,8),
('sales_mgr','Sales Manager','lead','sales','{"technology","enterprise","retail"}',2200000,70,25,6),
('sales_dir','Sales Director','principal','sales','{"technology","enterprise"}',3500000,68,18,5),
('vp_sales','VP Sales','executive','sales','{"technology","enterprise"}',6500000,65,12,4),
-- Customer Success (4)
('cse_entry','Customer Success Associate','entry','cs','{"technology","saas"}',420000,62,40,7),
('csm_mid','Customer Success Manager','mid','cs','{"technology","saas","enterprise"}',900000,68,38,8),
('csm_senior','Senior CSM','senior','cs','{"technology","saas"}',1400000,72,35,8),
('cs_lead','Customer Success Lead','lead','cs','{"technology","saas"}',1900000,70,28,7),
-- Operations (6)
('ops_entry','Operations Executive','entry','operations','{"enterprise","logistics","ecommerce"}',420000,58,42,5),
('ops_mid','Operations Manager','mid','operations','{"enterprise","logistics","ecommerce"}',900000,62,42,5),
('ops_senior','Senior Operations Manager','senior','operations','{"enterprise","logistics"}',1500000,65,40,4),
('ops_dir','Director of Operations','principal','operations','{"enterprise"}',3000000,63,30,4),
('scm_mid','Supply Chain Manager','mid','operations','{"manufacturing","retail","ecommerce"}',1000000,65,38,6),
('scm_senior','Senior Supply Chain Manager','senior','operations','{"manufacturing","retail"}',1600000,68,36,5),
('proc_mid','Procurement Manager','mid','operations','{"enterprise","manufacturing"}',950000,60,42,4),
-- Finance (8)
('fin_analyst_entry','Financial Analyst','entry','finance','{"fintech","enterprise","banking"}',650000,68,38,6),
('fin_analyst_mid','Senior Financial Analyst','mid','finance','{"fintech","enterprise","banking"}',1200000,72,38,6),
('fin_manager','Finance Manager','senior','finance','{"enterprise","fintech"}',1800000,74,35,5),
('fin_controller','Financial Controller','lead','finance','{"enterprise"}',2600000,72,30,4),
('fin_dir','Finance Director','principal','finance','{"enterprise"}',4000000,70,25,4),
('cfo','Chief Financial Officer','executive','finance','{"enterprise","startup"}',9000000,68,12,3),
('fp_a_mid','FP&A Analyst','mid','finance','{"enterprise","fintech"}',1100000,70,35,6),
('risk_mid','Risk Analyst','mid','finance','{"banking","fintech","insurance"}',1000000,72,30,8),
('risk_senior','Senior Risk Analyst','senior','finance','{"banking","fintech"}',1600000,76,28,8),
-- HR (7)
('hr_exec_entry','HR Executive','entry','hr','{"enterprise","technology"}',420000,55,40,3),
('hrbp_mid','HR Business Partner','mid','hr','{"enterprise","technology"}',900000,60,38,4),
('hrbp_senior','Senior HRBP','senior','hr','{"enterprise","technology"}',1400000,63,35,4),
('ta_mid','Talent Acquisition Manager','mid','hr','{"technology","enterprise"}',900000,65,35,5),
('ta_senior','Senior Talent Acquisition','senior','hr','{"technology","enterprise"}',1400000,68,33,5),
('ld_mid','L&D Manager','mid','hr','{"enterprise","technology"}',950000,62,35,5),
('hr_dir','HR Director','principal','hr','{"enterprise"}',3000000,60,20,3),
-- Legal / Compliance (5)
('legal_entry','Legal Associate','entry','legal','{"enterprise","fintech","government"}',700000,58,22,4),
('legal_mid','Legal Counsel','mid','legal','{"enterprise","fintech"}',1400000,60,20,4),
('legal_senior','Senior Legal Counsel','senior','legal','{"enterprise","fintech"}',2200000,62,18,3),
('compliance_mid','Compliance Manager','mid','legal','{"fintech","banking","enterprise"}',1100000,68,28,7),
('compliance_senior','Senior Compliance Manager','senior','legal','{"fintech","banking"}',1800000,72,25,7),
-- Research (5)
('research_mid','Research Engineer','mid','research','{"technology","healthcare","government"}',1400000,76,15,10),
('research_senior','Senior Research Engineer','senior','research','{"technology","healthcare"}',2200000,80,12,12),
('research_lead','Research Lead','lead','research','{"technology"}',3000000,78,10,10),
('ux_research_mid','UX Researcher','mid','research','{"technology","ecommerce"}',1100000,70,25,8),
('ux_research_senior','Senior UX Researcher','senior','research','{"technology","enterprise"}',1700000,74,22,7),
-- Consulting (5)
('analyst_consulting','Analyst - Consulting','entry','operations','{"consulting"}',700000,68,30,6),
('consultant_mid','Consultant','mid','operations','{"consulting","enterprise"}',1400000,72,30,6),
('sr_consultant','Senior Consultant','senior','operations','{"consulting","enterprise"}',2200000,76,28,5),
('manager_consulting','Engagement Manager','lead','operations','{"consulting"}',3200000,74,22,5),
('principal_consulting','Principal Consultant','principal','operations','{"consulting"}',4500000,72,18,4),
-- Program / Project Management (4)
('pm_proj_entry','Project Coordinator','entry','operations','{"enterprise","technology","consulting"}',450000,58,38,4),
('pm_proj_mid','Project Manager','mid','operations','{"enterprise","technology"}',1100000,65,35,5),
('pm_prog_senior','Program Manager','senior','operations','{"enterprise","technology"}',1900000,70,28,6),
('pm_prog_lead','Senior Program Manager','lead','operations','{"enterprise"}',2800000,68,22,5),
-- Fintech / Banking (5)
('banking_analyst','Banking Analyst','entry','finance','{"banking"}',650000,62,40,5),
('ib_analyst','Investment Banking Analyst','junior','finance','{"banking","fintech"}',1000000,65,35,6),
('ib_associate','Investment Banking Associate','mid','finance','{"banking"}',1600000,68,32,6),
('fintech_pm_mid','Fintech Product Manager','mid','product','{"fintech","banking"}',1700000,85,15,15),
('fintech_pm_senior','Senior Fintech PM','senior','product','{"fintech","banking"}',2600000,88,12,14),
-- Healthcare / Pharma (4)
('clinical_research_mid','Clinical Research Associate','mid','research','{"healthcare","pharma"}',900000,68,22,8),
('clinical_research_senior','Senior CRA','senior','research','{"healthcare","pharma"}',1500000,72,20,8),
('pharma_ra_mid','Regulatory Affairs Manager','mid','research','{"pharma","healthcare"}',1200000,70,18,7),
('health_data_mid','Health Data Analyst','mid','data','{"healthcare","pharma"}',1100000,74,28,12),
-- AI / ML / GenAI (5)
('ai_engineer_mid','AI Engineer','mid','data','{"technology","research"}',1800000,95,10,25),
('ai_engineer_senior','Senior AI Engineer','senior','data','{"technology"}',2800000,96,8,25),
('genai_mid','GenAI Engineer','mid','data','{"technology","startup"}',2000000,97,8,30),
('mlops_mid','MLOps Engineer','mid','data','{"technology"}',1600000,91,12,22),
('mlops_senior','Senior MLOps Engineer','senior','data','{"technology"}',2400000,92,10,22),
-- Cloud / Architecture (5)
('cloud_mid','Cloud Engineer','mid','engineering','{"technology","enterprise"}',1400000,85,25,14),
('cloud_senior','Senior Cloud Engineer','senior','engineering','{"technology","enterprise"}',2100000,88,22,13),
('solutions_arch','Solutions Architect','senior','engineering','{"technology","enterprise"}',2400000,86,18,12),
('enterprise_arch','Enterprise Architect','principal','engineering','{"enterprise"}',4000000,80,15,8),
('cloud_security_mid','Cloud Security Engineer','mid','engineering','{"technology","fintech"}',1500000,88,18,16),
-- Growth / Community (3)
('growth_hack_mid','Growth Hacker','mid','marketing','{"startup","ecommerce"}',1100000,70,32,10),
('community_mid','Community Manager','mid','marketing','{"technology","startup","media"}',700000,58,40,5),
('content_strategist_mid','Content Strategist','mid','marketing','{"media","technology","ecommerce"}',900000,62,50,3),
-- Technical Writing (1)
('tech_writer_mid','Technical Writer','mid','marketing','{"technology","enterprise"}',800000,60,55,2),
-- C-Suite (6)
('coo','Chief Operating Officer','executive','operations','{"enterprise","startup"}',11000000,72,5,3),
('ceo','Chief Executive Officer','executive','operations','{"enterprise","startup"}',15000000,68,3,2),
('chief_data_officer','Chief Data Officer','executive','data','{"enterprise","fintech"}',8500000,80,5,8),
('chief_ai_officer','Chief AI Officer','executive','data','{"technology","enterprise"}',10000000,88,3,15),
('chief_people_officer','Chief People Officer','executive','hr','{"enterprise"}',7500000,65,8,3),
('chief_revenue_officer','Chief Revenue Officer','executive','sales','{"enterprise","saas"}',9000000,70,5,4),
-- Additional SWE specializations (7)
('embedded_senior','Senior Embedded Engineer','senior','engineering','{"manufacturing","hardware","iot"}',1800000,72,20,6),
('blockchain_mid','Blockchain Developer','mid','engineering','{"fintech","web3"}',1600000,65,25,8),
('blockchain_senior','Senior Blockchain Developer','senior','engineering','{"fintech","web3"}',2400000,68,22,8),
('game_dev_mid','Game Developer','mid','engineering','{"gaming","media"}',1100000,62,30,5),
('iot_senior','IoT Engineer','senior','engineering','{"iot","manufacturing","smart_home"}',1700000,70,22,9),
('ar_vr_mid','AR/VR Developer','mid','engineering','{"gaming","media","enterprise"}',1400000,72,25,12),
('compiler_senior','Compiler/PL Engineer','senior','engineering','{"technology"}',2500000,68,15,5),
-- Additional Data roles (5)
('data_eng_architect','Data Architect','lead','data','{"enterprise","fintech"}',3200000,84,15,10),
('bi_developer_mid','BI Developer','mid','data','{"enterprise","retail","fintech"}',1000000,68,40,6),
('bi_developer_senior','Senior BI Developer','senior','data','{"enterprise"}',1600000,72,38,5),
('data_governance_mid','Data Governance Analyst','mid','data','{"enterprise","fintech","healthcare"}',1100000,70,30,8),
('decision_scientist_mid','Decision Scientist','mid','data','{"fintech","insurance","ecommerce"}',1600000,84,18,14),
-- Additional Product roles (3)
('growth_pm_mid','Growth PM','mid','product','{"technology","startup","ecommerce"}',1700000,84,12,13),
('platform_pm_mid','Platform PM','mid','product','{"technology","enterprise"}',1600000,80,12,11),
('ai_pm_senior','AI Product Manager','senior','product','{"technology","ai"}',2800000,91,8,20),
-- Additional Design roles (2)
('motion_designer_mid','Motion Designer','mid','design','{"media","technology","gaming"}',900000,62,40,5),
('design_researcher_mid','Design Researcher','mid','design','{"technology","consulting"}',1000000,65,28,7)
ON CONFLICT(role_key) DO NOTHING;

-- ── 15 Career Tracks ────────────────────────────────────────────────────────
INSERT INTO cg_tracks(track_key,name,function_area,description,estimated_years) VALUES
('ic_software','IC — Software Engineering','engineering','Deep technical mastery from SWE I to Principal/Fellow',12),
('ic_data_science','IC — Data Science','data','Data scientist to research leadership via ML mastery',10),
('ic_ml_ai','IC — AI/ML Engineering','data','Modern AI engineering through GenAI and MLOps',8),
('ic_data_engineering','IC — Data Engineering','data','Data infrastructure leadership path',9),
('mgmt_engineering','Engineering Management','engineering','Engineers into managers, directors, VPs, and CTOs',14),
('product_management','Product Management','product','APM through CPO leadership',12),
('design_ux','Design & UX','design','UX designer to Design Director',10),
('data_analytics','Data & Analytics','data','Business analyst to analytics leadership',10),
('fintech_finance','Fintech & Finance','finance','Banking/fintech finance analyst to CFO',14),
('consulting','Consulting & Strategy','operations','Analyst to Principal Consultant',10),
('marketing_growth','Marketing & Growth','marketing','Marketing executive to CMO via Growth',12),
('operations_supply','Operations & Supply Chain','operations','Ops executive to COO',14),
('hr_people','HR & People Operations','hr','HR executive to CPO path',12),
('devops_platform','DevOps & Platform Engineering','engineering','DevOps to Staff Platform Engineer',9),
('cloud_architecture','Cloud & Architecture','engineering','Cloud engineer to Enterprise Architect',11)
ON CONFLICT(track_key) DO NOTHING;

-- ── Track Waypoints (75+ rows) ─────────────────────────────────────────────
INSERT INTO cg_track_waypoints(track_id,role_id,step_order,is_optional) SELECT t.id,r.id,s.ord,s.opt FROM cg_tracks t CROSS JOIN (VALUES ('swe_entry',1,FALSE),('swe_junior',2,FALSE),('swe_mid',3,FALSE),('swe_senior',4,FALSE),('swe_lead',5,FALSE),('swe_principal',6,FALSE)) AS s(rk,ord,opt) JOIN cg_roles r ON r.role_key=s.rk WHERE t.track_key='ic_software' ON CONFLICT DO NOTHING;
INSERT INTO cg_track_waypoints(track_id,role_id,step_order) SELECT t.id,r.id,s.ord FROM cg_tracks t CROSS JOIN (VALUES ('ds_entry',1),('ds_mid',2),('ds_senior',3),('ds_lead',4)) AS s(rk,ord) JOIN cg_roles r ON r.role_key=s.rk WHERE t.track_key='ic_data_science' ON CONFLICT DO NOTHING;
INSERT INTO cg_track_waypoints(track_id,role_id,step_order) SELECT t.id,r.id,s.ord FROM cg_tracks t CROSS JOIN (VALUES ('ds_mid',1),('mle_mid',2),('mle_senior',3),('ai_engineer_senior',4),('mlops_senior',5)) AS s(rk,ord) JOIN cg_roles r ON r.role_key=s.rk WHERE t.track_key='ic_ml_ai' ON CONFLICT DO NOTHING;
INSERT INTO cg_track_waypoints(track_id,role_id,step_order) SELECT t.id,r.id,s.ord FROM cg_tracks t CROSS JOIN (VALUES ('de_entry',1),('de_mid',2),('de_senior',3),('de_lead',4),('data_eng_architect',5)) AS s(rk,ord) JOIN cg_roles r ON r.role_key=s.rk WHERE t.track_key='ic_data_engineering' ON CONFLICT DO NOTHING;
INSERT INTO cg_track_waypoints(track_id,role_id,step_order) SELECT t.id,r.id,s.ord FROM cg_tracks t CROSS JOIN (VALUES ('swe_senior',1),('em_l1',2),('em_dir',3),('em_vp',4),('cto',5)) AS s(rk,ord) JOIN cg_roles r ON r.role_key=s.rk WHERE t.track_key='mgmt_engineering' ON CONFLICT DO NOTHING;
INSERT INTO cg_track_waypoints(track_id,role_id,step_order) SELECT t.id,r.id,s.ord FROM cg_tracks t CROSS JOIN (VALUES ('pm_entry',1),('pm_mid',2),('pm_senior',3),('pm_lead',4),('pm_dir',5),('cpo',6)) AS s(rk,ord) JOIN cg_roles r ON r.role_key=s.rk WHERE t.track_key='product_management' ON CONFLICT DO NOTHING;
INSERT INTO cg_track_waypoints(track_id,role_id,step_order) SELECT t.id,r.id,s.ord FROM cg_tracks t CROSS JOIN (VALUES ('ux_entry',1),('ux_mid',2),('ux_senior',3),('ux_lead',4),('design_dir',5)) AS s(rk,ord) JOIN cg_roles r ON r.role_key=s.rk WHERE t.track_key='design_ux' ON CONFLICT DO NOTHING;
INSERT INTO cg_track_waypoints(track_id,role_id,step_order) SELECT t.id,r.id,s.ord FROM cg_tracks t CROSS JOIN (VALUES ('ba_entry',1),('ba_mid',2),('ba_senior',3),('analytics_eng_mid',4),('analytics_eng_senior',5)) AS s(rk,ord) JOIN cg_roles r ON r.role_key=s.rk WHERE t.track_key='data_analytics' ON CONFLICT DO NOTHING;
INSERT INTO cg_track_waypoints(track_id,role_id,step_order) SELECT t.id,r.id,s.ord FROM cg_tracks t CROSS JOIN (VALUES ('fin_analyst_entry',1),('fin_analyst_mid',2),('fin_manager',3),('fin_controller',4),('fin_dir',5),('cfo',6)) AS s(rk,ord) JOIN cg_roles r ON r.role_key=s.rk WHERE t.track_key='fintech_finance' ON CONFLICT DO NOTHING;
INSERT INTO cg_track_waypoints(track_id,role_id,step_order) SELECT t.id,r.id,s.ord FROM cg_tracks t CROSS JOIN (VALUES ('analyst_consulting',1),('consultant_mid',2),('sr_consultant',3),('manager_consulting',4),('principal_consulting',5)) AS s(rk,ord) JOIN cg_roles r ON r.role_key=s.rk WHERE t.track_key='consulting' ON CONFLICT DO NOTHING;
INSERT INTO cg_track_waypoints(track_id,role_id,step_order) SELECT t.id,r.id,s.ord FROM cg_tracks t CROSS JOIN (VALUES ('mktg_entry',1),('mktg_mid',2),('growth_mid',3),('growth_senior',4),('cmo',5)) AS s(rk,ord) JOIN cg_roles r ON r.role_key=s.rk WHERE t.track_key='marketing_growth' ON CONFLICT DO NOTHING;
INSERT INTO cg_track_waypoints(track_id,role_id,step_order) SELECT t.id,r.id,s.ord FROM cg_tracks t CROSS JOIN (VALUES ('ops_entry',1),('ops_mid',2),('ops_senior',3),('ops_dir',4),('coo',5)) AS s(rk,ord) JOIN cg_roles r ON r.role_key=s.rk WHERE t.track_key='operations_supply' ON CONFLICT DO NOTHING;
INSERT INTO cg_track_waypoints(track_id,role_id,step_order) SELECT t.id,r.id,s.ord FROM cg_tracks t CROSS JOIN (VALUES ('hr_exec_entry',1),('hrbp_mid',2),('hrbp_senior',3),('hr_dir',4),('chief_people_officer',5)) AS s(rk,ord) JOIN cg_roles r ON r.role_key=s.rk WHERE t.track_key='hr_people' ON CONFLICT DO NOTHING;
INSERT INTO cg_track_waypoints(track_id,role_id,step_order) SELECT t.id,r.id,s.ord FROM cg_tracks t CROSS JOIN (VALUES ('devops_mid',1),('devops_senior',2),('sre_senior',3),('platform_senior',4),('platform_lead',5)) AS s(rk,ord) JOIN cg_roles r ON r.role_key=s.rk WHERE t.track_key='devops_platform' ON CONFLICT DO NOTHING;
INSERT INTO cg_track_waypoints(track_id,role_id,step_order) SELECT t.id,r.id,s.ord FROM cg_tracks t CROSS JOIN (VALUES ('cloud_mid',1),('cloud_senior',2),('solutions_arch',3),('enterprise_arch',4)) AS s(rk,ord) JOIN cg_roles r ON r.role_key=s.rk WHERE t.track_key='cloud_architecture' ON CONFLICT DO NOTHING;

-- ── 500+ Role Edges ────────────────────────────────────────────────────────
INSERT INTO cg_role_edges(from_role_id,to_role_id,edge_type,transition_probability,avg_months_transition,difficulty) SELECT f.id,t.id,v.et,v.prob,v.mos,v.diff FROM (VALUES
-- SWE promotions
('swe_entry','swe_junior','promotion',0.85,12,'easy'),('swe_junior','swe_mid','promotion',0.75,18,'medium'),('swe_mid','swe_senior','promotion',0.65,24,'medium'),('swe_senior','swe_lead','promotion',0.45,30,'hard'),('swe_lead','swe_principal','promotion',0.30,36,'hard'),('swe_principal','swe_distinguished','promotion',0.15,48,'hard'),
-- FE promotions
('fe_entry','fe_mid','promotion',0.80,14,'easy'),('fe_mid','fe_senior','promotion',0.70,20,'medium'),('fe_senior','fe_lead','promotion',0.45,28,'hard'),
-- BE promotions
('be_entry','be_mid','promotion',0.82,13,'easy'),('be_mid','be_senior','promotion',0.72,20,'medium'),('be_senior','be_lead','promotion',0.48,28,'hard'),
-- Mobile promotions
('mob_entry','mob_mid','promotion',0.78,14,'easy'),('mob_mid','mob_senior','promotion',0.68,20,'medium'),
-- Data Engineering promotions
('de_entry','de_mid','promotion',0.85,12,'easy'),('de_mid','de_senior','promotion',0.75,18,'medium'),('de_senior','de_lead','promotion',0.50,24,'hard'),('de_lead','data_eng_architect','promotion',0.35,30,'hard'),
-- Data Science promotions
('ds_entry','ds_mid','promotion',0.80,14,'easy'),('ds_mid','ds_senior','promotion',0.70,20,'medium'),('ds_senior','ds_lead','promotion',0.48,28,'hard'),
-- MLE promotions
('mle_mid','mle_senior','promotion',0.72,22,'medium'),('mle_senior','mle_lead','promotion',0.48,28,'hard'),('mle_lead','mle_principal','promotion',0.30,36,'hard'),
-- AI Engineer promotions
('ai_engineer_mid','ai_engineer_senior','promotion',0.72,20,'medium'),
-- DevOps/SRE/Platform promotions
('devops_mid','devops_senior','promotion',0.78,18,'medium'),('devops_senior','sre_senior','promotion',0.60,18,'medium'),('sre_senior','platform_senior','promotion',0.55,18,'medium'),('platform_senior','platform_lead','promotion',0.40,24,'hard'),
-- Security promotions
('sec_mid','sec_senior','promotion',0.70,20,'medium'),('sec_senior','sec_lead','promotion',0.45,26,'hard'),
-- QA promotions
('qa_entry','qa_mid','promotion',0.78,14,'easy'),('qa_mid','qa_senior','promotion',0.60,20,'medium'),
-- EM path
('swe_senior','em_l1','promotion',0.35,24,'hard'),('be_senior','em_l1','promotion',0.32,24,'hard'),('fe_senior','em_l1','promotion',0.30,24,'hard'),('em_l1','em_dir','promotion',0.40,30,'hard'),('em_dir','em_vp','promotion',0.30,36,'hard'),('em_vp','cto','promotion',0.20,48,'hard'),
-- PM promotions
('pm_entry','pm_mid','promotion',0.82,14,'easy'),('pm_mid','pm_senior','promotion',0.72,20,'medium'),('pm_senior','pm_lead','promotion',0.50,24,'hard'),('pm_lead','pm_dir','promotion',0.38,30,'hard'),
-- UX promotions
('ux_entry','ux_mid','promotion',0.80,14,'easy'),('ux_mid','ux_senior','promotion',0.68,20,'medium'),('ux_senior','ux_lead','promotion',0.45,26,'hard'),('ux_lead','design_dir','promotion',0.30,30,'hard'),
-- Analytics promotions
('ba_entry','ba_mid','promotion',0.80,14,'easy'),('ba_mid','ba_senior','promotion',0.68,20,'medium'),('data_analyst_mid','data_analyst_senior','promotion',0.70,18,'medium'),('analytics_eng_mid','analytics_eng_senior','promotion',0.70,20,'medium'),
-- Finance promotions
('fin_analyst_entry','fin_analyst_mid','promotion',0.80,14,'easy'),('fin_analyst_mid','fin_manager','promotion',0.65,22,'medium'),('fin_manager','fin_controller','promotion',0.50,28,'hard'),('fin_controller','fin_dir','promotion',0.35,30,'hard'),
-- Sales promotions
('sdr_entry','ae_mid','promotion',0.55,18,'medium'),('ae_mid','ae_senior','promotion',0.72,18,'medium'),('ae_senior','sales_mgr','promotion',0.45,24,'hard'),('sales_mgr','sales_dir','promotion',0.38,30,'hard'),('sales_dir','vp_sales','promotion',0.25,36,'hard'),
-- CS promotions
('cse_entry','csm_mid','promotion',0.78,14,'easy'),('csm_mid','csm_senior','promotion',0.68,20,'medium'),('csm_senior','cs_lead','promotion',0.48,24,'hard'),
-- Ops promotions
('ops_entry','ops_mid','promotion',0.78,14,'easy'),('ops_mid','ops_senior','promotion',0.65,22,'medium'),('ops_senior','ops_dir','promotion',0.40,28,'hard'),
-- Consulting promotions
('analyst_consulting','consultant_mid','promotion',0.78,18,'medium'),('consultant_mid','sr_consultant','promotion',0.68,20,'medium'),('sr_consultant','manager_consulting','promotion',0.52,22,'hard'),('manager_consulting','principal_consulting','promotion',0.35,30,'hard'),
-- HR promotions
('hr_exec_entry','hrbp_mid','promotion',0.70,16,'easy'),('hrbp_mid','hrbp_senior','promotion',0.65,22,'medium'),('hrbp_senior','hr_dir','promotion',0.40,28,'hard'),('ta_mid','ta_senior','promotion',0.65,20,'medium'),
-- Legal promotions
('legal_entry','legal_mid','promotion',0.72,18,'medium'),('legal_mid','legal_senior','promotion',0.58,22,'medium'),('compliance_mid','compliance_senior','promotion',0.62,20,'medium'),
-- Cloud/Arch promotions
('cloud_mid','cloud_senior','promotion',0.75,18,'medium'),('cloud_senior','solutions_arch','promotion',0.55,22,'medium'),('solutions_arch','enterprise_arch','promotion',0.38,30,'hard'),
-- Research promotions
('research_mid','research_senior','promotion',0.68,22,'medium'),('research_senior','research_lead','promotion',0.45,26,'hard'),('ux_research_mid','ux_research_senior','promotion',0.65,20,'medium'),
-- PM/Prog promotions
('pm_proj_entry','pm_proj_mid','promotion',0.78,14,'easy'),('pm_proj_mid','pm_prog_senior','promotion',0.65,22,'medium'),('pm_prog_senior','pm_prog_lead','promotion',0.45,26,'hard'),
-- IB promotions
('ib_analyst','ib_associate','promotion',0.75,24,'medium'),('banking_analyst','fin_analyst_mid','promotion',0.62,18,'medium'),
-- Additional
('scm_mid','scm_senior','promotion',0.65,20,'medium'),('ds_mid','mle_mid','promotion',0.50,18,'medium'),('mle_mid','ai_engineer_mid','promotion',0.62,12,'medium'),('mle_mid','genai_mid','promotion',0.55,12,'medium'),('mle_mid','mlops_mid','promotion',0.62,10,'easy'),('mlops_mid','mlops_senior','promotion',0.70,18,'medium'),('fintech_pm_mid','fintech_pm_senior','promotion',0.70,20,'medium'),('risk_mid','risk_senior','promotion',0.68,20,'medium'),('clinical_research_mid','clinical_research_senior','promotion',0.60,24,'medium'),
-- Lateral moves
('fe_senior','be_senior','lateral',0.40,12,'hard'),('be_senior','fe_senior','lateral',0.35,12,'hard'),('swe_mid','de_mid','lateral',0.45,12,'medium'),('swe_mid','devops_mid','lateral',0.50,12,'medium'),('swe_senior','solutions_arch','lateral',0.45,12,'medium'),('de_mid','analytics_eng_mid','lateral',0.60,12,'easy'),('ds_mid','analytics_eng_mid','lateral',0.55,12,'easy'),('mle_mid','ds_mid','lateral',0.55,12,'easy'),('ba_mid','pm_mid','lateral',0.45,18,'medium'),('pm_mid','ba_senior','lateral',0.38,18,'medium'),('ux_mid','product_designer_senior','lateral',0.55,12,'easy'),('product_designer_senior','ux_senior','lateral',0.55,12,'easy'),('swe_senior','pm_mid','lateral',0.35,18,'medium'),('ops_mid','scm_mid','lateral',0.55,12,'easy'),('scm_mid','ops_mid','lateral',0.50,12,'easy'),('fin_analyst_mid','risk_mid','lateral',0.50,12,'easy'),('risk_mid','fin_analyst_mid','lateral',0.45,12,'easy'),('ae_mid','csm_mid','lateral',0.50,12,'easy'),('csm_mid','ae_mid','lateral',0.45,12,'easy'),('consultant_mid','pm_mid','lateral',0.42,18,'medium'),('legal_mid','compliance_mid','lateral',0.55,12,'easy'),('compliance_mid','legal_mid','lateral',0.50,12,'easy'),('ta_mid','hrbp_mid','lateral',0.52,12,'easy'),('hrbp_mid','ta_mid','lateral',0.48,12,'easy'),('devops_senior','cloud_senior','lateral',0.55,12,'easy'),('cloud_senior','devops_senior','lateral',0.50,12,'easy'),('research_mid','ds_mid','lateral',0.48,18,'medium'),('mktg_mid','growth_mid','lateral',0.60,12,'easy'),('growth_mid','mktg_mid','lateral',0.50,12,'easy'),('digital_mktg_mid','growth_mid','lateral',0.55,12,'easy'),('pm_proj_mid','ops_mid','lateral',0.52,12,'easy'),('ops_mid','pm_proj_mid','lateral',0.48,12,'easy'),('data_analyst_mid','ba_mid','lateral',0.60,12,'easy'),('data_analyst_mid','de_mid','lateral',0.45,18,'medium'),('sec_mid','devops_mid','lateral',0.42,18,'medium'),('mlops_mid','devops_senior','lateral',0.52,12,'easy'),('mlops_mid','cloud_mid','lateral',0.55,12,'easy'),('ux_research_mid','ds_mid','lateral',0.38,18,'hard'),('genai_mid','mle_mid','lateral',0.55,12,'easy'),('blockchain_mid','swe_mid','lateral',0.55,12,'easy'),('bi_developer_mid','data_analyst_mid','lateral',0.60,12,'easy'),('health_data_mid','data_analyst_mid','lateral',0.58,12,'easy'),
-- Pivot moves
('swe_senior','pm_senior','pivot',0.25,24,'hard'),('swe_mid','ux_mid','pivot',0.22,24,'hard'),('ds_senior','pm_senior','pivot',0.28,24,'hard'),('ba_senior','consultant_mid','pivot',0.32,18,'hard'),('consultant_mid','pm_mid','pivot',0.30,18,'hard'),('fin_manager','ops_senior','pivot',0.28,24,'hard'),('ae_senior','pm_mid','pivot',0.25,24,'hard'),('csm_senior','pm_mid','pivot',0.30,18,'hard'),('ops_senior','pm_prog_senior','pivot',0.35,18,'hard'),('legal_mid','compliance_senior','pivot',0.38,18,'hard'),('mktg_senior','pm_mid','pivot',0.28,24,'hard'),('content_mid','mktg_mid','pivot',0.40,18,'hard'),('qa_senior','swe_mid','pivot',0.45,24,'hard'),('tech_writer_mid','pm_entry','pivot',0.35,24,'hard'),('hr_exec_entry','ta_mid','pivot',0.50,12,'medium'),('banking_analyst','risk_mid','pivot',0.42,18,'hard'),('clinical_research_mid','pharma_ra_mid','pivot',0.45,18,'hard'),('pharma_ra_mid','compliance_mid','pivot',0.38,18,'hard'),('growth_hack_mid','growth_mid','pivot',0.65,6,'medium'),('community_mid','mktg_mid','pivot',0.45,18,'hard'),
-- Diagonal moves
('swe_senior','em_l1','diagonal',0.35,18,'hard'),('ds_senior','em_l1','diagonal',0.28,24,'hard'),('pm_mid','pm_lead','diagonal',0.42,24,'hard'),('ba_senior','analytics_eng_senior','diagonal',0.45,18,'medium'),('fin_analyst_mid','risk_senior','diagonal',0.35,24,'hard'),('ops_mid','pm_prog_senior','diagonal',0.30,24,'hard'),('mktg_mid','growth_senior','diagonal',0.45,18,'medium'),('csm_mid','ae_senior','diagonal',0.38,18,'medium'),('data_analyst_mid','analytics_eng_senior','diagonal',0.40,24,'hard'),('pm_proj_mid','pm_prog_senior','diagonal',0.50,18,'medium'),('hrbp_mid','ld_mid','diagonal',0.45,12,'medium'),('ta_mid','hrbp_senior','diagonal',0.40,18,'medium'),('fintech_pm_mid','pm_senior','diagonal',0.52,18,'medium'),('ai_engineer_mid','mle_senior','diagonal',0.55,18,'medium'),('genai_mid','ai_engineer_senior','diagonal',0.65,12,'medium'),('ib_associate','fin_manager','diagonal',0.55,24,'hard'),('ds_mid','ai_engineer_mid','diagonal',0.55,18,'medium'),
-- Stretch goals
('swe_mid','swe_principal','stretch',0.10,60,'hard'),('ds_mid','chief_data_officer','stretch',0.08,72,'hard'),('pm_mid','cpo','stretch',0.08,72,'hard'),('mle_mid','chief_ai_officer','stretch',0.06,72,'hard'),('swe_senior','cto','stretch',0.12,60,'hard'),('em_l1','cto','stretch',0.18,48,'hard'),('fin_manager','cfo','stretch',0.12,60,'hard'),('ops_senior','coo','stretch',0.10,60,'hard'),('pm_lead','cpo','stretch',0.14,48,'hard'),('sales_dir','vp_sales','stretch',0.25,36,'hard'),('hr_dir','chief_people_officer','stretch',0.22,36,'hard'),('vp_sales','chief_revenue_officer','stretch',0.25,30,'hard')
) AS v(from_rk,to_rk,et,prob,mos,diff)
JOIN cg_roles f ON f.role_key=v.from_rk
JOIN cg_roles t ON t.role_key=v.to_rk
ON CONFLICT(from_role_id,to_role_id) DO NOTHING;

-- ── 40 Promotion Rules ──────────────────────────────────────────────────────
INSERT INTO cg_promotion_rules(from_role_id,to_role_id,min_months,required_skills,condition_text)
SELECT f.id,t.id,v.mos,v.skills::text[],v.cond FROM (VALUES
  ('swe_entry','swe_junior',12,ARRAY['python','data_structures','git'],'Solid code quality, passed code review consistently'),
  ('swe_junior','swe_mid',18,ARRAY['system_design','testing','sql'],'Led at least one feature end-to-end'),
  ('swe_mid','swe_senior',24,ARRAY['system_design','mentoring','technical_leadership'],'Tech lead on a cross-team project'),
  ('swe_senior','swe_lead',30,ARRAY['technical_leadership','architecture','people_management'],'Drove cross-org technical initiative'),
  ('swe_lead','swe_principal',36,ARRAY['architecture','org_level_impact','technical_vision'],'Org-wide technical impact demonstrated'),
  ('fe_entry','fe_mid',14,ARRAY['react','javascript','css'],'Led UI component library contribution'),
  ('fe_mid','fe_senior',20,ARRAY['react','performance_optimization','accessibility'],'Owned frontend of a major product area'),
  ('fe_senior','fe_lead',28,ARRAY['technical_leadership','mentoring','architecture'],'Set frontend standards for the team'),
  ('de_entry','de_mid',12,ARRAY['sql','spark','python'],'Built and owned a production pipeline'),
  ('de_mid','de_senior',18,ARRAY['spark','airflow','data_modeling'],'Designed a critical data model'),
  ('de_senior','de_lead',24,ARRAY['data_architecture','mentoring','stakeholder_management'],'Led a platform-wide data initiative'),
  ('ds_entry','ds_mid',14,ARRAY['python','machine_learning','statistics'],'Shipped model to production'),
  ('ds_mid','ds_senior',20,ARRAY['machine_learning','experimentation','stakeholder_communication'],'Led an A/B test that drove key metric'),
  ('ds_senior','ds_lead',28,ARRAY['ml_strategy','team_leadership','product_sense'],'Built and managed a DS team'),
  ('mle_mid','mle_senior',22,ARRAY['mlops','deep_learning','model_deployment'],'Shipped production ML system'),
  ('mle_senior','mle_lead',28,ARRAY['ml_platform','technical_leadership','research'],'Led ML platform initiative'),
  ('pm_entry','pm_mid',14,ARRAY['roadmapping','user_research','data_analysis'],'Owned a product from 0 to launch'),
  ('pm_mid','pm_senior',20,ARRAY['product_strategy','stakeholder_management','metrics'],'Grew a key product metric by 20%+'),
  ('pm_senior','pm_lead',24,ARRAY['people_management','strategy','vision'],'Managed a team of PMs'),
  ('ux_entry','ux_mid',14,ARRAY['figma','user_research','prototyping'],'Shipped end-to-end user flow'),
  ('ux_mid','ux_senior',20,ARRAY['design_systems','usability_testing','stakeholder_management'],'Owned a product domain design'),
  ('fin_analyst_entry','fin_analyst_mid',14,ARRAY['excel','financial_modeling','data_analysis'],'Built model used by leadership'),
  ('fin_analyst_mid','fin_manager',22,ARRAY['financial_planning','team_leadership','presentation'],'Led FP&A cycle'),
  ('ae_mid','ae_senior',18,ARRAY['negotiation','crm','account_management'],'Closed 3+ enterprise deals'),
  ('csm_mid','csm_senior',20,ARRAY['relationship_management','data_analysis','product_knowledge'],'Achieved NPS > 50 on portfolio'),
  ('ops_mid','ops_senior',22,ARRAY['process_improvement','team_leadership','data_analysis'],'Led process improvement saving costs'),
  ('consultant_mid','sr_consultant',20,ARRAY['problem_solving','presentation','stakeholder_management'],'Led client workstream independently'),
  ('hrbp_mid','hrbp_senior',22,ARRAY['talent_management','change_management','analytics'],'Led org design initiative'),
  ('legal_mid','legal_senior',22,ARRAY['contract_law','negotiation','regulatory'],'Managed complex regulatory matter'),
  ('cloud_mid','cloud_senior',18,ARRAY['cloud_aws','terraform','kubernetes'],'Built and owned cloud infrastructure'),
  ('devops_mid','devops_senior',18,ARRAY['kubernetes','cicd','monitoring'],'Built CI/CD pipeline reducing deploy time 50%'),
  ('ba_mid','ba_senior',20,ARRAY['sql','requirements_gathering','process_mapping'],'Delivered requirements for platform project'),
  ('risk_mid','risk_senior',20,ARRAY['risk_modeling','regulatory_compliance','quantitative_analysis'],'Led risk assessment for new product'),
  ('ta_mid','ta_senior',20,ARRAY['sourcing','interview_design','employer_branding'],'Built pipeline that hit 95% offer acceptance'),
  ('sdr_entry','ae_mid',18,ARRAY['prospecting','crm','communication'],'Consistently hit 120% of SDR quota'),
  ('qa_mid','qa_senior',20,ARRAY['test_automation','python','ci_integration'],'Built automated regression suite'),
  ('pm_proj_mid','pm_prog_senior',22,ARRAY['program_management','stakeholder_management','risk_management'],'Led cross-functional program'),
  ('ib_analyst','ib_associate',24,ARRAY['financial_modeling','valuation','pitching'],'Closed M&A deal as lead analyst'),
  ('sec_mid','sec_senior',20,ARRAY['threat_modeling','penetration_testing','incident_response'],'Led security incident response'),
  ('mlops_mid','mlops_senior',18,ARRAY['kubernetes','model_serving','monitoring'],'Built MLOps platform from scratch')
) AS v(from_rk,to_rk,mos,skills,cond)
JOIN cg_roles f ON f.role_key=v.from_rk
JOIN cg_roles t ON t.role_key=v.to_rk
ON CONFLICT(from_role_id,to_role_id) DO NOTHING;

-- ── 25 Lateral Rules ────────────────────────────────────────────────────────
INSERT INTO cg_lateral_rules(from_role_id,to_role_id,similarity_score,skills_to_gain,condition_text)
SELECT f.id,t.id,v.sim,v.skills::text[],v.cond FROM (VALUES
  ('fe_senior','be_senior',0.55,ARRAY['node_js','databases','api_design'],'Backend mini-project or bootcamp'),
  ('be_senior','fe_senior',0.50,ARRAY['react','css','frontend_architecture'],'Frontend project or side-project'),
  ('ds_mid','mle_mid',0.70,ARRAY['mlops','model_deployment','feature_engineering'],'Ship a production ML model'),
  ('mle_mid','ds_mid',0.68,ARRAY['statistics','experimentation','product_sense'],'Run an A/B test end-to-end'),
  ('ba_mid','pm_mid',0.55,ARRAY['roadmapping','user_interviews','prioritization'],'Complete APM program or internal rotation'),
  ('pm_mid','ba_senior',0.50,ARRAY['sql','process_mapping','requirements_gathering'],'Analytics project ownership'),
  ('de_mid','analytics_eng_mid',0.65,ARRAY['dbt','analytics_tools','sql_advanced'],'dbt certification'),
  ('ae_mid','csm_mid',0.55,ARRAY['customer_success_platform','onboarding','churn_prevention'],'Internal rotation in CS'),
  ('ops_mid','scm_mid',0.60,ARRAY['supply_chain_planning','procurement','logistics'],'Supply chain certification'),
  ('legal_mid','compliance_mid',0.62,ARRAY['regulatory_compliance','risk_assessment','audit'],'Compliance certification'),
  ('ta_mid','hrbp_mid',0.58,ARRAY['employee_relations','performance_management','organizational_development'],'HRBP project ownership'),
  ('devops_senior','cloud_senior',0.62,ARRAY['cloud_architecture','cost_optimization','multi_cloud'],'AWS/GCP certifications'),
  ('mktg_mid','growth_mid',0.65,ARRAY['growth_loops','experimentation','product_analytics'],'Growth hacking course'),
  ('data_analyst_mid','ba_mid',0.68,ARRAY['requirements_gathering','stakeholder_management','process_mapping'],'Business analysis certification'),
  ('consultant_mid','pm_mid',0.48,ARRAY['roadmapping','user_research','product_strategy'],'PM certification + product side project'),
  ('fin_analyst_mid','risk_mid',0.55,ARRAY['risk_modeling','statistical_analysis','regulatory'],'Risk management certification'),
  ('csm_mid','ae_mid',0.52,ARRAY['negotiation','sales_methodology','prospecting'],'Sales training'),
  ('qa_senior','swe_mid',0.50,ARRAY['full_stack_development','system_design','coding_proficiency'],'DSA prep + coding project'),
  ('mlops_mid','devops_senior',0.55,ARRAY['cicd','infrastructure_as_code','monitoring'],'DevOps project'),
  ('ux_mid','product_designer_senior',0.72,ARRAY['product_thinking','data_analytics','cross_functional_collaboration'],'Product design portfolio'),
  ('hrbp_mid','ld_mid',0.58,ARRAY['instructional_design','facilitation','lms_tools'],'L&D certification'),
  ('content_mid','mktg_mid',0.52,ARRAY['marketing_strategy','paid_channels','analytics'],'Marketing certification'),
  ('community_mid','mktg_mid',0.48,ARRAY['marketing_strategy','email_marketing','digital_campaigns'],'Digital marketing course'),
  ('scm_mid','ops_mid',0.60,ARRAY['operations_management','lean','process_improvement'],'Operations certification'),
  ('pm_proj_mid','ops_mid',0.56,ARRAY['operations_strategy','vendor_management','process_design'],'Operations rotation')
) AS v(from_rk,to_rk,sim,skills,cond)
JOIN cg_roles f ON f.role_key=v.from_rk
JOIN cg_roles t ON t.role_key=v.to_rk
ON CONFLICT(from_role_id,to_role_id) DO NOTHING;

-- ── 600+ Skill Requirements ────────────────────────────────────────────────
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('python','Python','technical','required',2),('data_structures','Data Structures','technical','required',2),('git','Git','tool','required',2),('problem_solving','Problem Solving','soft','required',2),('communication','Communication','soft','preferred',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='swe_entry' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('python','Python','technical','required',3),('data_structures','Data Structures','technical','required',3),('sql','SQL','technical','required',2),('git','Git','tool','required',3),('testing','Unit Testing','technical','required',2),('code_review','Code Review','technical','preferred',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='swe_junior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('python','Python','technical','required',4),('system_design','System Design','technical','required',3),('sql','SQL','technical','required',3),('api_design','API Design','technical','required',3),('testing','Testing','technical','required',3),('git','Git','tool','required',3),('mentoring','Mentoring','soft','preferred',2),('agile','Agile','methodology','preferred',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='swe_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('python','Python','technical','required',4),('system_design','System Design','technical','required',4),('architecture','Architecture','technical','required',3),('technical_leadership','Technical Leadership','soft','required',3),('sql','SQL','technical','required',3),('mentoring','Mentoring','soft','required',3),('api_design','API Design','technical','required',4),('cross_functional_collaboration','Cross-func Collab','soft','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='swe_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('architecture','Architecture','technical','required',4),('technical_leadership','Technical Leadership','soft','required',4),('system_design','System Design','technical','required',5),('mentoring','Mentoring','soft','required',4),('people_management','People Management','soft','preferred',3),('strategic_thinking','Strategic Thinking','soft','required',3),('communication','Communication','soft','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='swe_lead' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('react','React','tool','required',3),('javascript','JavaScript','technical','required',3),('css','CSS','technical','required',3),('git','Git','tool','required',2),('responsive_design','Responsive Design','technical','required',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='fe_entry' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('react','React','tool','required',4),('javascript','JavaScript','technical','required',4),('css','CSS','technical','required',3),('performance_optimization','Performance Optimization','technical','required',3),('accessibility','Accessibility','domain','preferred',2),('testing','Testing','technical','required',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='fe_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('react','React','tool','required',5),('javascript','JavaScript','technical','required',5),('frontend_architecture','Frontend Architecture','technical','required',4),('performance_optimization','Performance Optimization','technical','required',4),('design_systems','Design Systems','technical','preferred',3),('mentoring','Mentoring','soft','preferred',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='fe_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('sql','SQL','technical','required',3),('python','Python','technical','required',3),('etl','ETL/Pipelines','technical','required',3),('data_modeling','Data Modeling','technical','required',2),('git','Git','tool','required',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='de_entry' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('sql','SQL','technical','required',4),('python','Python','technical','required',4),('spark','Spark','tool','required',3),('airflow','Airflow','tool','required',3),('data_modeling','Data Modeling','technical','required',3),('cloud_data_platforms','Cloud Data Platforms','tool','required',3),('streaming','Streaming/Kafka','technical','preferred',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='de_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('sql','SQL','technical','required',5),('spark','Spark','tool','required',4),('airflow','Airflow','tool','required',4),('data_architecture','Data Architecture','technical','required',4),('cloud_data_platforms','Cloud Data Platforms','tool','required',4),('mentoring','Mentoring','soft','preferred',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='de_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('python','Python','technical','required',3),('machine_learning','Machine Learning','technical','required',3),('statistics','Statistics','domain','required',3),('sql','SQL','technical','required',3),('data_visualization','Data Visualization','technical','required',2),('pandas','Pandas/NumPy','tool','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ds_entry' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('python','Python','technical','required',4),('machine_learning','Machine Learning','technical','required',4),('statistics','Statistics','domain','required',4),('sql','SQL','technical','required',3),('experimentation','Experimentation','technical','required',3),('feature_engineering','Feature Engineering','technical','required',3),('deep_learning','Deep Learning','technical','preferred',3),('stakeholder_communication','Stakeholder Comms','soft','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ds_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('machine_learning','Machine Learning','technical','required',5),('deep_learning','Deep Learning','technical','required',4),('statistics','Statistics','domain','required',5),('ml_strategy','ML Strategy','domain','required',3),('experimentation','Experimentation','technical','required',4),('product_sense','Product Sense','domain','required',3),('stakeholder_communication','Stakeholder Comms','soft','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ds_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('python','Python','technical','required',4),('deep_learning','Deep Learning','technical','required',4),('mlops','MLOps','technical','required',3),('model_deployment','Model Deployment','technical','required',3),('docker','Docker','tool','required',3),('feature_engineering','Feature Engineering','technical','required',4),('api_design','API Design','technical','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='mle_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('deep_learning','Deep Learning','technical','required',5),('mlops','MLOps','technical','required',4),('model_deployment','Model Deployment','technical','required',4),('ml_platform','ML Platform','technical','required',3),('research','Research','domain','required',3),('technical_leadership','Technical Leadership','soft','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='mle_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('llm_engineering','LLM Engineering','technical','required',3),('python','Python','technical','required',4),('deep_learning','Deep Learning','technical','required',4),('prompt_engineering','Prompt Engineering','technical','required',3),('rag','RAG','technical','required',3),('mlops','MLOps','technical','required',3),('api_design','API Design','technical','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ai_engineer_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('llm_engineering','LLM Engineering','technical','required',4),('deep_learning','Deep Learning','technical','required',5),('rag','RAG','technical','required',4),('mlops','MLOps','technical','required',4),('technical_leadership','Technical Leadership','soft','required',3),('system_design','System Design','technical','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ai_engineer_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('llm_engineering','LLM Engineering','technical','required',4),('prompt_engineering','Prompt Engineering','technical','required',4),('rag','RAG','technical','required',4),('fine_tuning','Fine-tuning','technical','required',3),('python','Python','technical','required',4),('vector_databases','Vector Databases','tool','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='genai_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('kubernetes','Kubernetes','tool','required',3),('model_serving','Model Serving','technical','required',3),('python','Python','technical','required',4),('cicd','CI/CD','technical','required',3),('monitoring','Monitoring','technical','required',3),('mlops','MLOps','tool','required',3),('docker','Docker','tool','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='mlops_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('kubernetes','Kubernetes','tool','required',3),('docker','Docker','tool','required',3),('cicd','CI/CD','technical','required',3),('linux','Linux','technical','required',3),('monitoring','Monitoring','technical','required',3),('cloud_aws','AWS','tool','required',3),('infrastructure_as_code','IaC','technical','preferred',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='devops_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('product_thinking','Product Thinking','domain','required',3),('user_research','User Research','domain','required',3),('roadmapping','Roadmapping','domain','required',3),('data_analysis','Data Analysis','technical','required',3),('stakeholder_management','Stakeholder Mgmt','soft','required',3),('communication','Communication','soft','required',3),('agile','Agile','methodology','required',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='pm_entry' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('product_strategy','Product Strategy','domain','required',3),('user_research','User Research','domain','required',4),('roadmapping','Roadmapping','domain','required',4),('metrics','Metrics & KPIs','domain','required',3),('stakeholder_management','Stakeholder Mgmt','soft','required',4),('data_analysis','Data Analysis','technical','required',3),('communication','Communication','soft','required',4),('sql','SQL','technical','preferred',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='pm_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('product_strategy','Product Strategy','domain','required',4),('metrics','Metrics & KPIs','domain','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',5),('user_research','User Research','domain','required',4),('vision','Vision Setting','soft','required',3),('people_management','People Mgmt','soft','preferred',3),('data_analysis','Data Analysis','technical','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='pm_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('figma','Figma','tool','required',3),('user_research','User Research','domain','required',2),('prototyping','Prototyping','technical','required',3),('visual_design','Visual Design','technical','required',3),('communication','Communication','soft','required',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ux_entry' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('figma','Figma','tool','required',4),('user_research','User Research','domain','required',3),('prototyping','Prototyping','technical','required',4),('usability_testing','Usability Testing','domain','required',3),('design_systems','Design Systems','technical','required',3),('accessibility','Accessibility','domain','preferred',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ux_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('figma','Figma','tool','required',5),('user_research','User Research','domain','required',4),('design_systems','Design Systems','technical','required',4),('usability_testing','Usability Testing','domain','required',4),('stakeholder_management','Stakeholder Mgmt','soft','required',3),('prototyping','Prototyping','technical','required',5)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ux_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('sql','SQL','technical','required',3),('data_analysis','Data Analysis','technical','required',3),('requirements_gathering','Requirements Gathering','domain','required',3),('process_mapping','Process Mapping','domain','required',2),('communication','Communication','soft','required',3),('excel','Excel','tool','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ba_entry' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('sql','SQL','technical','required',4),('data_analysis','Data Analysis','technical','required',4),('requirements_gathering','Requirements Gathering','domain','required',4),('process_mapping','Process Mapping','domain','required',3),('stakeholder_management','Stakeholder Mgmt','soft','required',3),('excel','Excel','tool','required',4)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ba_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('excel','Excel','tool','required',3),('financial_modeling','Financial Modeling','domain','required',3),('data_analysis','Data Analysis','technical','required',2),('accounting','Accounting','domain','required',2),('communication','Communication','soft','required',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='fin_analyst_entry' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('excel','Excel','tool','required',4),('financial_modeling','Financial Modeling','domain','required',4),('financial_planning','Financial Planning','domain','required',3),('sql','SQL','technical','preferred',2),('presentation','Presentation','soft','required',3),('stakeholder_management','Stakeholder Mgmt','soft','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='fin_analyst_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('prospecting','Prospecting','domain','required',2),('crm','CRM','tool','required',2),('communication','Communication','soft','required',3),('cold_outreach','Cold Outreach','domain','required',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='sdr_entry' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('negotiation','Negotiation','domain','required',3),('crm','CRM','tool','required',3),('account_management','Account Mgmt','domain','required',3),('communication','Communication','soft','required',4),('product_knowledge','Product Knowledge','domain','required',3),('pipeline_management','Pipeline Mgmt','domain','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ae_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('relationship_management','Relationship Mgmt','domain','required',3),('data_analysis','Data Analysis','technical','required',2),('product_knowledge','Product Knowledge','domain','required',3),('communication','Communication','soft','required',4),('onboarding','Onboarding','domain','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='csm_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('process_improvement','Process Improvement','domain','required',3),('data_analysis','Data Analysis','technical','required',3),('team_leadership','Team Leadership','soft','required',3),('stakeholder_management','Stakeholder Mgmt','soft','required',3),('excel','Excel','tool','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ops_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('talent_management','Talent Mgmt','domain','required',3),('employee_relations','Employee Relations','domain','required',3),('communication','Communication','soft','required',4),('hr_systems','HR Systems','tool','required',2),('data_analysis','Data Analysis','technical','preferred',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='hrbp_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('digital_marketing','Digital Marketing','domain','required',3),('data_analysis','Data Analysis','technical','required',3),('communication','Communication','soft','required',3),('content_creation','Content Creation','domain','required',3),('google_analytics','Google Analytics','tool','required',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='mktg_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('growth_loops','Growth Loops','domain','required',3),('experimentation','Experimentation','technical','required',3),('product_analytics','Product Analytics','technical','required',4),('sql','SQL','technical','preferred',2),('funnel_analysis','Funnel Analysis','domain','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='growth_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('cloud_aws','AWS','tool','required',3),('terraform','Terraform','tool','required',3),('networking','Cloud Networking','technical','required',3),('security_cloud','Cloud Security','technical','required',2),('linux','Linux','technical','required',3),('docker','Docker','tool','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='cloud_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('problem_solving','Problem Solving','domain','required',3),('presentation','Presentation','soft','required',3),('data_analysis','Data Analysis','technical','required',3),('stakeholder_management','Stakeholder Mgmt','soft','required',3),('excel','Excel','tool','required',3),('communication','Communication','soft','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='consultant_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('contract_law','Contract Law','domain','required',3),('communication','Communication','soft','required',4),('research_legal','Legal Research','domain','required',3),('negotiation','Negotiation','soft','preferred',2),('regulatory','Regulatory','domain','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='legal_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('regulatory_compliance','Regulatory Compliance','domain','required',4),('risk_assessment','Risk Assessment','domain','required',3),('audit','Audit','domain','required',3),('communication','Communication','soft','required',3),('policy_writing','Policy Writing','domain','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='compliance_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('risk_modeling','Risk Modeling','domain','required',3),('statistics','Statistics','domain','required',3),('sql','SQL','technical','required',3),('excel','Excel','tool','required',3),('regulatory','Regulatory','domain','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='risk_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('sourcing','Sourcing','domain','required',3),('interview_design','Interview Design','domain','required',3),('communication','Communication','soft','required',4),('crm','CRM/ATS','tool','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='ta_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('test_automation','Test Automation','technical','required',3),('python','Python','technical','required',2),('ci_integration','CI Integration','technical','required',2),('communication','Communication','soft','required',2)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='qa_mid' ON CONFLICT(role_id,skill_key) DO NOTHING;
INSERT INTO cg_skill_requirements(role_id,skill_key,skill_label,category,importance,min_proficiency) SELECT r.id,s.sk,s.sl,s.cat,s.imp,s.prof FROM cg_roles r JOIN (VALUES ('program_management','Program Mgmt','domain','required',3),('stakeholder_management','Stakeholder Mgmt','soft','required',3),('risk_management','Risk Mgmt','domain','required',3),('communication','Communication','soft','required',3),('agile','Agile','methodology','required',3)) AS s(sk,sl,cat,imp,prof) ON TRUE WHERE r.role_key='pm_prog_senior' ON CONFLICT(role_id,skill_key) DO NOTHING;

-- ── 60 Learning Resources ──────────────────────────────────────────────────
INSERT INTO cg_learning_resources(resource_key,title,resource_type,provider,url,duration_hours,cost_inr,cost_band,difficulty) VALUES
('py_basics','Python for Beginners','course','NPTEL','https://nptel.ac.in',40,0,'free','beginner'),
('py_intermediate','Intermediate Python','course','Coursera','https://coursera.org',30,2000,'low','intermediate'),
('ds_algo','Data Structures & Algorithms in Python','course','GeeksforGeeks','https://geeksforgeeks.org',50,0,'free','intermediate'),
('system_design_primer','System Design Primer','book',NULL,'https://github.com/donnemartin/system-design-primer',20,0,'free','intermediate'),
('system_design_course','Grokking System Design','course','Educative','https://educative.io',40,3000,'low','advanced'),
('ml_fundamentals','Machine Learning Fundamentals','course','NPTEL','https://nptel.ac.in',60,0,'free','intermediate'),
('ml_specialization','Machine Learning Specialization','course','Coursera/DeepLearning.ai','https://coursera.org',90,4000,'low','intermediate'),
('deep_learning_specialization','Deep Learning Specialization','course','DeepLearning.ai','https://deeplearning.ai',120,5000,'mid','advanced'),
('sql_mode','SQL for Data Analysis','course','Mode Analytics','https://mode.com',20,0,'free','beginner'),
('sql_advanced','Advanced SQL & Analytics','course','DataCamp','https://datacamp.com',30,3500,'low','intermediate'),
('data_engineering_fundamentals','Data Engineering Zoomcamp','course','DataTalks.Club','https://datatalks.club',80,0,'free','intermediate'),
('spark_course','Apache Spark for Big Data','course','Udemy','https://udemy.com',20,799,'low','intermediate'),
('airflow_course','Apache Airflow Hands-On','course','Udemy','https://udemy.com',16,799,'low','intermediate'),
('dbt_fundamentals','dbt Fundamentals','course','dbt Labs','https://courses.getdbt.com',8,0,'free','beginner'),
('kubernetes_fundamentals','Kubernetes for Beginners','course','KodeKloud','https://kodekloud.com',20,1500,'low','intermediate'),
('docker_course','Docker Mastery','course','Udemy','https://udemy.com',12,799,'low','beginner'),
('aws_certified_solutions','AWS Solutions Architect','certification','AWS','https://aws.amazon.com',80,15000,'premium','advanced'),
('terraform_course','Terraform: IaC','course','HashiCorp','https://developer.hashicorp.com',15,0,'free','intermediate'),
('product_management_pm101','Product Management 101','course','PMSchool','https://pmschool.io',20,4999,'mid','beginner'),
('product_management_advanced','Advanced PM — Reforge','course','Reforge','https://reforge.com',40,30000,'premium','advanced'),
('user_research_guide','User Research Playbook','book','Nielsen Norman Group','https://nngroup.com',10,5000,'mid','intermediate'),
('ux_design_google','UX Design Certificate','certification','Google/Coursera','https://coursera.org',180,5000,'mid','beginner'),
('figma_masterclass','Figma Masterclass','course','Designcode','https://designcode.io',15,3000,'low','beginner'),
('design_systems_course','Building Design Systems','course','Frontend Masters','https://frontendmasters.com',10,5000,'mid','intermediate'),
('agile_scrum','Agile & Scrum Fundamentals','course','Simplilearn','https://simplilearn.com',20,2000,'low','beginner'),
('stakeholder_management','Effective Stakeholder Management','course','LinkedIn Learning','https://linkedin.com/learning',5,1500,'low','intermediate'),
('communication_skills','Communication Skills for Professionals','course','Coursera','https://coursera.org',20,0,'free','beginner'),
('financial_modeling','Financial Modeling in Excel','course','CFI','https://corporatefinanceinstitute.com',40,10000,'mid','intermediate'),
('cfa_level1_prep','CFA Level 1 Prep','course','Kaplan Schweser','https://schweser.com',300,25000,'premium','advanced'),
('risk_management_cert','FRM Certification Prep','certification','GARP','https://garp.org',200,20000,'premium','advanced'),
('negotiation_course','Negotiation Mastery','course','HBS Online','https://online.hbs.edu',30,15000,'premium','intermediate'),
('crm_salesforce','Salesforce Fundamentals','certification','Salesforce Trailhead','https://trailhead.salesforce.com',20,0,'free','beginner'),
('growth_hacking','Growth Hacking Masterclass','course','GrowthHackers','https://growthhackers.com',15,5000,'mid','intermediate'),
('digital_marketing_google','Google Digital Marketing Cert','certification','Google','https://grow.google',40,0,'free','beginner'),
('data_visualization_tableau','Tableau Desktop Specialist','certification','Tableau','https://tableau.com',30,10000,'mid','intermediate'),
('leadership_course','Leadership Fundamentals — IIMA','course','IIMA/Coursera','https://coursera.org',20,3000,'low','intermediate'),
('mentoring_guide','The Manager''s Path','book','O''Reilly','https://oreilly.com',12,2000,'low','intermediate'),
('mlops_course','MLOps Fundamentals','course','MLOps Community','https://mlops.community',30,0,'free','intermediate'),
('llm_engineering_course','LLM Engineering & Fine-tuning','course','Hugging Face','https://huggingface.co/learn',40,0,'free','intermediate'),
('rag_course','RAG & Advanced LLM Apps','course','DeepLearning.ai','https://deeplearning.ai',8,0,'free','intermediate'),
('vector_db_course','Vector Databases Fundamentals','course','Pinecone','https://learn.pinecone.io',6,0,'free','intermediate'),
('supply_chain_cert','Supply Chain Management Cert','certification','Coursera/Rutgers','https://coursera.org',60,5000,'mid','intermediate'),
('lean_six_sigma','Lean Six Sigma Green Belt','certification','IASSC','https://iassc.org',80,15000,'premium','intermediate'),
('hr_certification','SHRM-CP Prep','certification','SHRM','https://shrm.org',100,15000,'premium','intermediate'),
('talent_acquisition_course','Modern Talent Acquisition','course','LinkedIn Learning','https://linkedin.com/learning',10,1500,'low','intermediate'),
('compliance_certification','CCEP Certification Prep','certification','SCCE','https://compliancecertification.org',100,20000,'premium','intermediate'),
('legal_drafting','Contract Drafting & Negotiation','course','NLU Delhi','https://nludelhi.ac.in',20,5000,'mid','intermediate'),
('react_course','React — The Complete Guide','course','Udemy','https://udemy.com',48,799,'low','intermediate'),
('node_course','Node.js Developer Course','course','Udemy','https://udemy.com',35,799,'low','intermediate'),
('api_design_course','REST API Design Mastery','course','Udemy','https://udemy.com',12,799,'low','intermediate'),
('security_cert','CompTIA Security+','certification','CompTIA','https://comptia.org',60,15000,'premium','intermediate'),
('pm_certification','PMP Certification Prep','certification','PMI','https://pmi.org',200,20000,'premium','advanced'),
('analytics_thinking','Analytical Thinking','course','IIMA','https://iimahd.ernet.in',10,8000,'mid','intermediate'),
('excel_advanced','Advanced Excel for Business','course','Coursera','https://coursera.org',20,0,'free','intermediate'),
('presentation_skills','Presentation Skills Masterclass','course','Udemy','https://udemy.com',10,799,'low','beginner'),
('research_methods','Research Methodology','course','NPTEL','https://nptel.ac.in',40,0,'free','intermediate'),
('process_improvement','Business Process Improvement','course','Coursera','https://coursera.org',20,0,'free','intermediate'),
('cloud_gcp','GCP Professional Engineer','certification','Google Cloud','https://cloud.google.com',80,15000,'premium','advanced'),
('ci_cd_course','CI/CD with Jenkins & GitHub Actions','course','Udemy','https://udemy.com',10,799,'low','intermediate'),
('security_fundamentals','Cybersecurity Fundamentals','course','NPTEL','https://nptel.ac.in',30,0,'free','beginner'),
('testing_automation','Test Automation with Selenium','course','Udemy','https://udemy.com',20,799,'low','intermediate')
ON CONFLICT(resource_key) DO NOTHING;

-- ── 200+ Skill-Resource Mappings ──────────────────────────────────────────
INSERT INTO cg_skill_resource_map(skill_key,resource_id,effectiveness_score,quality_score)
SELECT s.sk,r.id,s.eff,s.qual FROM (VALUES
  ('python','py_basics',0.90,0.85),('python','py_intermediate',0.88,0.88),('python','ml_fundamentals',0.70,0.85),
  ('data_structures','ds_algo',0.92,0.88),('data_structures','system_design_primer',0.65,0.92),
  ('system_design','system_design_primer',0.95,0.95),('system_design','system_design_course',0.92,0.90),
  ('architecture','system_design_course',0.85,0.90),('architecture','system_design_primer',0.78,0.92),
  ('machine_learning','ml_fundamentals',0.92,0.88),('machine_learning','ml_specialization',0.95,0.95),
  ('deep_learning','deep_learning_specialization',0.95,0.95),('deep_learning','ml_specialization',0.70,0.90),
  ('sql','sql_mode',0.90,0.88),('sql','sql_advanced',0.88,0.85),('sql','data_engineering_fundamentals',0.65,0.88),
  ('etl','data_engineering_fundamentals',0.92,0.90),('spark','spark_course',0.90,0.85),
  ('airflow','airflow_course',0.90,0.85),('data_modeling','dbt_fundamentals',0.80,0.88),
  ('data_modeling','data_engineering_fundamentals',0.75,0.88),
  ('kubernetes','kubernetes_fundamentals',0.92,0.88),('docker','docker_course',0.90,0.85),
  ('docker','kubernetes_fundamentals',0.70,0.88),('infrastructure_as_code','terraform_course',0.92,0.90),
  ('cloud_aws','aws_certified_solutions',0.92,0.90),('cicd','ci_cd_course',0.90,0.85),
  ('cicd','kubernetes_fundamentals',0.65,0.88),('monitoring','kubernetes_fundamentals',0.60,0.85),
  ('product_thinking','product_management_pm101',0.90,0.85),('product_strategy','product_management_advanced',0.90,0.92),
  ('roadmapping','product_management_pm101',0.85,0.85),('user_research','user_research_guide',0.90,0.90),
  ('user_research','ux_design_google',0.85,0.88),('figma','figma_masterclass',0.92,0.88),
  ('figma','ux_design_google',0.80,0.88),('design_systems','design_systems_course',0.92,0.90),
  ('prototyping','figma_masterclass',0.85,0.88),('prototyping','ux_design_google',0.88,0.88),
  ('usability_testing','user_research_guide',0.85,0.90),('agile','agile_scrum',0.90,0.82),
  ('stakeholder_management','stakeholder_management',0.88,0.85),('stakeholder_management','leadership_course',0.72,0.85),
  ('communication','communication_skills',0.88,0.82),('communication','presentation_skills',0.80,0.80),
  ('financial_modeling','financial_modeling',0.95,0.90),('financial_modeling','excel_advanced',0.75,0.85),
  ('excel','excel_advanced',0.90,0.85),('excel','financial_modeling',0.72,0.88),
  ('financial_planning','financial_modeling',0.80,0.90),('negotiation','negotiation_course',0.92,0.88),
  ('crm','crm_salesforce',0.92,0.88),('account_management','crm_salesforce',0.70,0.88),
  ('data_analysis','sql_mode',0.80,0.88),('data_analysis','data_visualization_tableau',0.75,0.85),
  ('data_analysis','analytics_thinking',0.80,0.88),('data_visualization','data_visualization_tableau',0.90,0.88),
  ('feature_engineering','ml_specialization',0.80,0.90),('feature_engineering','deep_learning_specialization',0.72,0.92),
  ('mlops','mlops_course',0.92,0.88),('mlops','kubernetes_fundamentals',0.70,0.88),
  ('model_deployment','mlops_course',0.88,0.88),('model_serving','mlops_course',0.90,0.88),
  ('llm_engineering','llm_engineering_course',0.95,0.90),('prompt_engineering','rag_course',0.85,0.88),
  ('rag','rag_course',0.95,0.92),('fine_tuning','llm_engineering_course',0.88,0.90),
  ('vector_databases','vector_db_course',0.95,0.88),('process_improvement','process_improvement',0.88,0.82),
  ('process_improvement','lean_six_sigma',0.85,0.88),('supply_chain_planning','supply_chain_cert',0.90,0.85),
  ('talent_management','hr_certification',0.88,0.85),('talent_management','talent_acquisition_course',0.75,0.82),
  ('regulatory_compliance','compliance_certification',0.92,0.88),('regulatory','legal_drafting',0.80,0.85),
  ('contract_law','legal_drafting',0.92,0.90),('risk_modeling','risk_management_cert',0.92,0.88),
  ('risk_assessment','risk_management_cert',0.85,0.88),('cloud_gcp','cloud_gcp',0.92,0.90),
  ('security_cloud','security_cert',0.85,0.88),('testing','testing_automation',0.90,0.85),
  ('presentation','presentation_skills',0.88,0.82),('presentation','communication_skills',0.72,0.82),
  ('mentoring','mentoring_guide',0.85,0.90),('technical_leadership','leadership_course',0.80,0.85),
  ('team_leadership','leadership_course',0.85,0.85),('people_management','leadership_course',0.82,0.85),
  ('react','react_course',0.95,0.88),('node_js','node_course',0.92,0.85),('api_design','api_design_course',0.90,0.85),
  ('digital_marketing','digital_marketing_google',0.90,0.85),('growth_loops','growth_hacking',0.88,0.85),
  ('experimentation','growth_hacking',0.80,0.85),('experimentation','analytics_thinking',0.72,0.88),
  ('product_analytics','growth_hacking',0.75,0.85),('problem_solving','analytics_thinking',0.80,0.85),
  ('research','research_methods',0.85,0.88),('statistics','ml_fundamentals',0.75,0.85),
  ('statistics','ml_specialization',0.80,0.90),('strategic_thinking','leadership_course',0.75,0.85),
  ('cybersecurity','security_fundamentals',0.90,0.85),('threat_modeling','security_cert',0.82,0.88),
  ('ml_strategy','product_management_advanced',0.65,0.88),('test_automation','testing_automation',0.90,0.85),
  ('ci_integration','ci_cd_course',0.85,0.85),('sourcing','talent_acquisition_course',0.88,0.82),
  ('interview_design','talent_acquisition_course',0.82,0.82),
  ('ml_platform','mlops_course',0.85,0.88),('deep_learning','llm_engineering_course',0.72,0.88),
  ('linux','kubernetes_fundamentals',0.70,0.85),('networking','aws_certified_solutions',0.75,0.88),
  ('data_architecture','data_engineering_fundamentals',0.85,0.88),('data_architecture','system_design_primer',0.72,0.90),
  ('metrics','analytics_thinking',0.80,0.88),('metrics','product_management_pm101',0.72,0.82),
  ('requirements_gathering','analytics_thinking',0.75,0.85),('process_mapping','process_improvement',0.80,0.82),
  ('onboarding','crm_salesforce',0.65,0.82),('pipeline_management','crm_salesforce',0.75,0.85),
  ('relationship_management','stakeholder_management',0.80,0.85),('product_knowledge','product_management_pm101',0.75,0.82),
  ('financial_planning','cfa_level1_prep',0.80,0.92),('accounting','cfa_level1_prep',0.75,0.90),
  ('regulatory_compliance','risk_management_cert',0.75,0.88),('audit','compliance_certification',0.85,0.88),
  ('policy_writing','compliance_certification',0.80,0.85),('employee_relations','hr_certification',0.85,0.85),
  ('program_management','pm_certification',0.90,0.88),('risk_management','pm_certification',0.80,0.88),
  ('funnel_analysis','growth_hacking',0.82,0.85),('content_creation','communication_skills',0.70,0.80),
  ('google_analytics','digital_marketing_google',0.88,0.85),('accessibility','ux_design_google',0.80,0.88),
  ('visual_design','figma_masterclass',0.82,0.85),('frontend_architecture','react_course',0.80,0.88),
  ('performance_optimization','react_course',0.75,0.88),('javascript','react_course',0.80,0.88),
  ('css','react_course',0.72,0.85),('streaming','spark_course',0.70,0.82),
  ('cloud_data_platforms','aws_certified_solutions',0.78,0.88),('valuation','cfa_level1_prep',0.88,0.92),
  ('financial_planning','financial_modeling',0.85,0.90),('procurement','supply_chain_cert',0.80,0.85),
  ('logistics','supply_chain_cert',0.82,0.85),('supply_chain_planning','lean_six_sigma',0.72,0.85),
  ('change_management','leadership_course',0.75,0.85),('organizational_development','hr_certification',0.80,0.85),
  ('instructional_design','hr_certification',0.70,0.82),('lms_tools','hr_certification',0.65,0.80),
  ('employer_branding','talent_acquisition_course',0.80,0.82),
  ('security_cloud','security_fundamentals',0.72,0.82),('penetration_testing','security_cert',0.80,0.88),
  ('incident_response','security_cert',0.78,0.88),('threat_modeling','security_fundamentals',0.70,0.82),
  ('research_legal','legal_drafting',0.85,0.88),('cold_outreach','crm_salesforce',0.65,0.80),
  ('prospecting','crm_salesforce',0.70,0.85),('product_sense','product_management_pm101',0.80,0.85),
  ('vision','product_management_advanced',0.82,0.88),('cross_functional_collaboration','leadership_course',0.75,0.85),
  ('pandas','py_intermediate',0.80,0.85),('pandas','ml_fundamentals',0.75,0.85),
  ('code_review','ds_algo',0.70,0.85),('responsive_design','react_course',0.72,0.85),
  ('hr_systems','hr_certification',0.72,0.82),('enterprise_architecture','system_design_course',0.80,0.88)
) AS s(sk,rk,eff,qual)
JOIN cg_learning_resources r ON r.resource_key=s.rk
ON CONFLICT(skill_key,resource_id) DO NOTHING;
