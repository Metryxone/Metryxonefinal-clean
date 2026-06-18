-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 5 — Employability Knowledge Graph
-- ═══════════════════════════════════════════════════════════════════════════
-- Adds knowledge-graph edges, occupation intelligence, skill graph,
-- market intelligence, trajectory/role-fit storage, and calibration
-- foundation. Builds on Phase 2 canonical tables (institutions, skills,
-- qualifications, certifications, occupations) and Phase 4 ruleset/version
-- infrastructure.
--
-- Constraints honored:
--   - Additive only (no destructive changes to existing tables/data)
--   - Every edge carries source_authority + evidence_ref + confidence
--   - Every recommendation/forecast pins the version quad (Phase 4)
--   - All scoring deterministic — no opaque ML
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Generic typed knowledge-graph edges ────────────────────────────────
-- A single normalised edge table over all canonical entities. Each row
-- captures one relationship with its evidence so the UI can render
-- "why this connection exists".
CREATE TABLE IF NOT EXISTS kg_edges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_type       TEXT NOT NULL CHECK (from_type IN ('institution','qualification','certification','skill','occupation','employer','role_family')),
  from_id         UUID NOT NULL,
  to_type         TEXT NOT NULL CHECK (to_type   IN ('institution','qualification','certification','skill','occupation','employer','role_family')),
  to_id           UUID NOT NULL,
  edge_type       TEXT NOT NULL,
    -- vocabulary: qualifies_for | taught_at | requires_skill | recommends_skill
    -- transferable_to | prerequisite_of | progresses_to | accredits | employs_for
    -- certifies_skill | adjacent_to | member_of_family
  weight          NUMERIC(5,4) NOT NULL DEFAULT 0.5000 CHECK (weight >= 0 AND weight <= 1),
  confidence      NUMERIC(4,3) NOT NULL DEFAULT 0.700 CHECK (confidence >= 0 AND confidence <= 1),
  source_authority TEXT,                     -- e.g. 'ESCO','O*NET','curated','MetryxOne'
  source_url      TEXT,
  evidence_ref    JSONB NOT NULL DEFAULT '{}'::jsonb,
  dataset_version TEXT,                      -- pins the dataset snapshot the edge was derived from
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (from_type, from_id, to_type, to_id, edge_type)
);
CREATE INDEX IF NOT EXISTS idx_kg_from ON kg_edges (from_type, from_id, edge_type) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_kg_to   ON kg_edges (to_type,   to_id,   edge_type) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_kg_type ON kg_edges (edge_type) WHERE is_active;

-- ── 2) Occupation intelligence ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_families (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,                  -- e.g. 'product', 'data', 'engineering'
  name            TEXT NOT NULL,
  description     TEXT,
  parent_family_id UUID REFERENCES role_families(id) ON DELETE SET NULL,
  source_authority TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS occupation_role_family (
  occupation_id   UUID NOT NULL REFERENCES occupations(id) ON DELETE CASCADE,
  role_family_id  UUID NOT NULL REFERENCES role_families(id) ON DELETE CASCADE,
  PRIMARY KEY (occupation_id, role_family_id)
);

CREATE TABLE IF NOT EXISTS occupation_skills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occupation_id   UUID NOT NULL REFERENCES occupations(id) ON DELETE CASCADE,
  skill_id        UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  importance      TEXT NOT NULL CHECK (importance IN ('essential','important','optional')),
  proficiency_level INT NOT NULL DEFAULT 3 CHECK (proficiency_level BETWEEN 1 AND 5),
  weight          NUMERIC(4,3) NOT NULL DEFAULT 1.000 CHECK (weight >= 0 AND weight <= 5),
  source          TEXT NOT NULL DEFAULT 'curated' CHECK (source IN ('esco','onet','curated','inferred')),
  source_authority TEXT,
  source_url      TEXT,
  evidence_ref    JSONB NOT NULL DEFAULT '{}'::jsonb,
  dataset_version TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (occupation_id, skill_id)
);
CREATE INDEX IF NOT EXISTS idx_occ_skills_occ   ON occupation_skills (occupation_id);
CREATE INDEX IF NOT EXISTS idx_occ_skills_skill ON occupation_skills (skill_id);
CREATE INDEX IF NOT EXISTS idx_occ_skills_imp   ON occupation_skills (occupation_id, importance);

CREATE TABLE IF NOT EXISTS occupation_pathways (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_occupation_id UUID NOT NULL REFERENCES occupations(id) ON DELETE CASCADE,
  to_occupation_id   UUID NOT NULL REFERENCES occupations(id) ON DELETE CASCADE,
  transition_type TEXT NOT NULL CHECK (transition_type IN ('progression','lateral','pivot','specialisation')),
  typical_years_min NUMERIC(4,1),
  typical_years_max NUMERIC(4,1),
  common_gaps     JSONB NOT NULL DEFAULT '[]'::jsonb,    -- ["leadership","system_design",...]
  source_authority TEXT,
  evidence_ref    JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pathway_self_loop CHECK (from_occupation_id <> to_occupation_id),
  UNIQUE (from_occupation_id, to_occupation_id, transition_type)
);

-- ── 3) Market intelligence ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_demand_models (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occupation_id   UUID NOT NULL REFERENCES occupations(id) ON DELETE CASCADE,
  region          TEXT NOT NULL DEFAULT 'IN',            -- ISO country / region
  demand_score    NUMERIC(5,2) NOT NULL CHECK (demand_score BETWEEN 0 AND 100),
  salary_min      NUMERIC(12,2),
  salary_max      NUMERIC(12,2),
  salary_currency TEXT DEFAULT 'INR',
  salary_period   TEXT DEFAULT 'annual' CHECK (salary_period IN ('hourly','monthly','annual')),
  future_relevance_score NUMERIC(5,2) NOT NULL CHECK (future_relevance_score BETWEEN 0 AND 100),
  automation_risk_score  NUMERIC(5,2) NOT NULL CHECK (automation_risk_score  BETWEEN 0 AND 100),
  hiring_trend    TEXT NOT NULL CHECK (hiring_trend IN ('rising','stable','declining','volatile')),
  source_authority TEXT,
  source_url      TEXT,
  evidence_ref    JSONB NOT NULL DEFAULT '{}'::jsonb,
  dataset_version TEXT NOT NULL,
  snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (occupation_id, region, dataset_version)
);
CREATE INDEX IF NOT EXISTS idx_market_occ_region ON market_demand_models (occupation_id, region) WHERE is_active;

-- ── 4) Skill graph (adjacency + inferred + proficiency) ───────────────────
CREATE TABLE IF NOT EXISTS skill_adjacency (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_skill_id   UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  to_skill_id     UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  similarity      NUMERIC(4,3) NOT NULL CHECK (similarity BETWEEN 0 AND 1),
  transferability NUMERIC(4,3) NOT NULL DEFAULT 0.500 CHECK (transferability BETWEEN 0 AND 1),
  basis           TEXT NOT NULL CHECK (basis IN ('esco_shares_concept','co_required_in_occupation','inferred_from_curriculum','curated','onet_related')),
  source_authority TEXT,
  evidence_ref    JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT adjacency_self_loop CHECK (from_skill_id <> to_skill_id),
  UNIQUE (from_skill_id, to_skill_id, basis)
);
CREATE INDEX IF NOT EXISTS idx_adj_from ON skill_adjacency (from_skill_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_adj_to   ON skill_adjacency (to_skill_id)   WHERE is_active;

CREATE TABLE IF NOT EXISTS inferred_skills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_skill_id  UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,  -- the declared one
  inferred_skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,  -- the implied one
  inference_basis TEXT NOT NULL,                                            -- "next.js implies react"
  confidence      NUMERIC(4,3) NOT NULL DEFAULT 0.800 CHECK (confidence BETWEEN 0 AND 1),
  source_authority TEXT,
  evidence_ref    JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inferred_self_loop CHECK (subject_skill_id <> inferred_skill_id),
  UNIQUE (subject_skill_id, inferred_skill_id)
);
CREATE INDEX IF NOT EXISTS idx_inf_subject ON inferred_skills (subject_skill_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS skill_proficiency_levels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id        UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level           INT NOT NULL CHECK (level BETWEEN 1 AND 5),
  descriptor      TEXT NOT NULL,                                            -- 'Beginner','Intermediate','Advanced',...
  indicators      JSONB NOT NULL DEFAULT '[]'::jsonb,                       -- behavioural indicators
  evidence_ref    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (skill_id, level)
);

-- ── 5) Role-fit + trajectory persistence ──────────────────────────────────
CREATE TABLE IF NOT EXISTS role_fit_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT,                                                     -- nullable for anonymous previews
  request_id      TEXT,
  occupation_id   UUID NOT NULL REFERENCES occupations(id) ON DELETE CASCADE,
  fit_score       NUMERIC(5,2) NOT NULL CHECK (fit_score BETWEEN 0 AND 100),
  skill_match_score        NUMERIC(5,2) NOT NULL DEFAULT 0,
  qualification_match_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  certification_match_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  experience_match_score    NUMERIC(5,2) NOT NULL DEFAULT 0,
  market_fit_score         NUMERIC(5,2) NOT NULL DEFAULT 0,
  band            TEXT NOT NULL,                                            -- 'Strong','Stretch','Aspiration','Misaligned'
  matched_skills     JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_essential  JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_important  JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations    JSONB NOT NULL DEFAULT '[]'::jsonb,
  trace              JSONB NOT NULL DEFAULT '[]'::jsonb,                    -- per-dimension trace
  ei_version      TEXT NOT NULL DEFAULT '4.0',
  ruleset_version TEXT,
  occupation_dataset_version TEXT,
  computation_ms  INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rfs_user_occ ON role_fit_scores (user_id, occupation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rfs_occ_score ON role_fit_scores (occupation_id, fit_score DESC);

CREATE TABLE IF NOT EXISTS trajectory_forecasts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  target_occupation_id UUID REFERENCES occupations(id) ON DELETE SET NULL,
  current_ei_score NUMERIC(5,2) NOT NULL,
  projected_ei_score NUMERIC(5,2) NOT NULL,
  time_horizon_months INT NOT NULL CHECK (time_horizon_months BETWEEN 1 AND 60),
  milestones      JSONB NOT NULL DEFAULT '[]'::jsonb,                        -- [{month, action, evidence_ref, expected_delta}]
  blocker_skills  JSONB NOT NULL DEFAULT '[]'::jsonb,                        -- [{skill_id, importance, impact_score}]
  high_impact_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  trace           JSONB NOT NULL DEFAULT '[]'::jsonb,
  ei_version      TEXT NOT NULL DEFAULT '4.0',
  ruleset_version TEXT,
  occupation_dataset_version TEXT,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_traj_user ON trajectory_forecasts (user_id, generated_at DESC);

-- ── 6) Calibration foundation (storage only — no scoring uses these yet) ─
CREATE TABLE IF NOT EXISTS recruiter_interactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  recruiter_id_hash TEXT NOT NULL,                                          -- pseudonymised
  occupation_id   UUID REFERENCES occupations(id) ON DELETE SET NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('view','shortlist','message','interview_invite','reject','offer')),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ri_user ON recruiter_interactions (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ri_occ  ON recruiter_interactions (occupation_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS interview_outcomes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  occupation_id   UUID REFERENCES occupations(id) ON DELETE SET NULL,
  employer_id_hash TEXT,
  stage           TEXT NOT NULL CHECK (stage IN ('screen','technical','onsite','final','offer')),
  outcome         TEXT NOT NULL CHECK (outcome IN ('progressed','rejected','offered','declined','accepted','withdrew')),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_io_user ON interview_outcomes (user_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS hiring_outcomes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  occupation_id   UUID REFERENCES occupations(id) ON DELETE SET NULL,
  employer_id_hash TEXT,
  hired_at        TIMESTAMPTZ NOT NULL,
  salary_offered  NUMERIC(12,2),
  salary_currency TEXT DEFAULT 'INR',
  source          TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ho_user ON hiring_outcomes (user_id);

CREATE TABLE IF NOT EXISTS weight_calibration_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_version TEXT NOT NULL,
  occupation_id   UUID REFERENCES occupations(id) ON DELETE SET NULL,
  sample_size     INT NOT NULL DEFAULT 0,
  optimization_method TEXT NOT NULL DEFAULT 'deterministic_grid',           -- never 'opaque_ml' — explicit
  before_weights  JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposed_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied         BOOLEAN NOT NULL DEFAULT FALSE,
  applied_at      TIMESTAMPTZ,
  applied_by      TEXT,                                                     -- governance: who applied
  notes           TEXT,
  run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA (curated minimum viable — extensible via admin endpoints)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Role families ─────────────────────────────────────────────────────────
INSERT INTO role_families (code, name, description, source_authority) VALUES
  ('product','Product Management','Roles centred on product strategy, discovery, and delivery','curated'),
  ('data','Data & Analytics','Roles centred on data engineering, analysis, and ML','curated'),
  ('engineering','Software Engineering','Software development roles across backend, frontend, full-stack','curated'),
  ('design','Design & UX','Product, UX, visual, and research design roles','curated'),
  ('marketing','Marketing & Growth','Growth, marketing, content, and brand roles','curated'),
  ('operations','Operations & PM','Programme/project management and business operations','curated'),
  ('finance','Finance','Finance, FP&A, and treasury roles','curated'),
  ('hr','People & HR','HR, talent acquisition, and L&D roles','curated'),
  ('sales','Sales','Sales, account, and customer-success roles','curated'),
  ('consulting','Consulting','Strategy and management consulting roles','curated')
ON CONFLICT (code) DO NOTHING;

-- Map existing occupations → role families (uses canonical_title to find ids)
INSERT INTO occupation_role_family (occupation_id, role_family_id)
SELECT o.id, rf.id
FROM occupations o
JOIN role_families rf ON rf.code = o.role_family
WHERE o.role_family IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── Occupation → Skill mappings (curated; explicit importance + evidence) ─
-- Helper: lookup function inline via WITH clause; we insert with explicit names.
-- Each occupation_skill carries evidence_ref so the UI can render provenance.

-- Senior Product Manager
INSERT INTO occupation_skills (occupation_id, skill_id, importance, proficiency_level, weight, source, source_authority, evidence_ref, dataset_version)
SELECT o.id, s.id, v.importance, v.prof, v.weight, 'curated', 'MetryxOne Curation Board v1', jsonb_build_object('rationale', v.note), 'phase5.0'
FROM occupations o
CROSS JOIN LATERAL (
  VALUES
    ('Product Strategy'::text,   'essential'::text, 5, 2.0, 'Core PM responsibility'),
    ('User Research',            'essential', 4, 1.6, 'Discovery foundation'),
    ('Data Analysis',            'essential', 4, 1.5, 'Metric-driven decisions'),
    ('Stakeholder Management',   'essential', 4, 1.5, 'Cross-functional leadership'),
    ('SQL',                      'important', 3, 1.0, 'Self-serve analytics'),
    ('A/B Testing',              'important', 3, 1.0, 'Experiment design')
) v(skill_name, importance, prof, weight, note)
JOIN skills s ON s.canonical_name = v.skill_name
WHERE o.canonical_title = 'Senior Product Manager'
ON CONFLICT (occupation_id, skill_id) DO NOTHING;

-- Data Scientist
INSERT INTO occupation_skills (occupation_id, skill_id, importance, proficiency_level, weight, source, source_authority, evidence_ref, dataset_version)
SELECT o.id, s.id, v.importance, v.prof, v.weight, 'curated', 'MetryxOne Curation Board v1', jsonb_build_object('rationale', v.note), 'phase5.0'
FROM occupations o
CROSS JOIN LATERAL (
  VALUES
    ('Python'::text,        'essential'::text, 4, 2.0, 'Primary modelling language'),
    ('SQL',                 'essential', 4, 1.8, 'Data extraction & transformation'),
    ('Machine Learning',    'essential', 4, 2.0, 'Model development'),
    ('Statistics',          'essential', 4, 1.8, 'Inferential foundation'),
    ('Data Analysis',       'essential', 4, 1.5, 'Exploratory analysis'),
    ('TensorFlow',          'important', 3, 1.0, 'Common DL framework'),
    ('PyTorch',             'important', 3, 1.0, 'Common DL framework')
) v(skill_name, importance, prof, weight, note)
JOIN skills s ON s.canonical_name = v.skill_name
WHERE o.canonical_title = 'Data Scientist'
ON CONFLICT (occupation_id, skill_id) DO NOTHING;

-- Senior Data Scientist (inherits + adds leadership)
INSERT INTO occupation_skills (occupation_id, skill_id, importance, proficiency_level, weight, source, source_authority, evidence_ref, dataset_version)
SELECT o.id, s.id, v.importance, v.prof, v.weight, 'curated', 'MetryxOne Curation Board v1', jsonb_build_object('rationale', v.note), 'phase5.0'
FROM occupations o
CROSS JOIN LATERAL (
  VALUES
    ('Python'::text,        'essential'::text, 5, 2.0, 'Primary modelling language'),
    ('SQL',                 'essential', 4, 1.5, 'Self-serve data work'),
    ('Machine Learning',    'essential', 5, 2.2, 'Lead model development'),
    ('Statistics',          'essential', 5, 1.8, 'Rigorous inference'),
    ('Stakeholder Management','essential',4, 1.5, 'Senior cross-functional work'),
    ('TensorFlow',          'important', 4, 1.2, 'Production DL'),
    ('PyTorch',             'important', 4, 1.2, 'Production DL')
) v(skill_name, importance, prof, weight, note)
JOIN skills s ON s.canonical_name = v.skill_name
WHERE o.canonical_title = 'Senior Data Scientist'
ON CONFLICT (occupation_id, skill_id) DO NOTHING;

-- Generic engineering pattern — applies to Software Engineer / Senior SWE if present
INSERT INTO occupation_skills (occupation_id, skill_id, importance, proficiency_level, weight, source, source_authority, evidence_ref, dataset_version)
SELECT o.id, s.id, v.importance, v.prof, v.weight, 'curated', 'MetryxOne Curation Board v1', jsonb_build_object('rationale', v.note), 'phase5.0'
FROM occupations o
CROSS JOIN LATERAL (
  VALUES
    ('Python'::text,    'important'::text, 3, 1.0, 'Common server language'),
    ('Java',            'important', 3, 1.0, 'Common server language'),
    ('TypeScript',      'important', 3, 1.0, 'Modern web stack'),
    ('SQL',             'essential', 3, 1.2, 'Persistence baseline'),
    ('Git',             'essential', 3, 1.0, 'Version control baseline'),
    ('System Design',   'essential', 3, 1.5, 'Architecture fundamentals')
) v(skill_name, importance, prof, weight, note)
JOIN skills s ON s.canonical_name = v.skill_name
WHERE o.role_family = 'engineering'
ON CONFLICT (occupation_id, skill_id) DO NOTHING;

-- ── Occupation pathways (progression / lateral) ───────────────────────────
INSERT INTO occupation_pathways (from_occupation_id, to_occupation_id, transition_type, typical_years_min, typical_years_max, common_gaps, source_authority, evidence_ref)
SELECT f.id, t.id, 'progression', 3, 5,
       '["strategic_thinking","executive_communication","portfolio_management"]'::jsonb,
       'MetryxOne Curation Board v1',
       jsonb_build_object('rationale','Standard PM progression based on industry observation')
FROM occupations f, occupations t
WHERE f.canonical_title = 'Senior Product Manager' AND t.canonical_title = 'Director of Product'
ON CONFLICT DO NOTHING;

INSERT INTO occupation_pathways (from_occupation_id, to_occupation_id, transition_type, typical_years_min, typical_years_max, common_gaps, source_authority, evidence_ref)
SELECT f.id, t.id, 'progression', 4, 7,
       '["org_design","p_and_l_ownership","board_communication"]'::jsonb,
       'MetryxOne Curation Board v1',
       jsonb_build_object('rationale','Director → CPO transition')
FROM occupations f, occupations t
WHERE f.canonical_title = 'Director of Product' AND t.canonical_title = 'Chief Product Officer'
ON CONFLICT DO NOTHING;

INSERT INTO occupation_pathways (from_occupation_id, to_occupation_id, transition_type, typical_years_min, typical_years_max, common_gaps, source_authority, evidence_ref)
SELECT f.id, t.id, 'progression', 2, 4,
       '["ml_systems","mentoring","cross_functional_communication"]'::jsonb,
       'MetryxOne Curation Board v1',
       jsonb_build_object('rationale','DS → Senior DS progression')
FROM occupations f, occupations t
WHERE f.canonical_title = 'Data Scientist' AND t.canonical_title = 'Senior Data Scientist'
ON CONFLICT DO NOTHING;

-- ── Market demand models (curated baseline; replace with live data via admin) ─
INSERT INTO market_demand_models (occupation_id, region, demand_score, salary_min, salary_max, salary_currency, future_relevance_score, automation_risk_score, hiring_trend, source_authority, evidence_ref, dataset_version)
SELECT o.id, 'IN', v.demand, v.smin, v.smax, 'INR', v.future_rel, v.auto_risk, v.trend, 'MetryxOne Market Intelligence v1', jsonb_build_object('basis','Curated baseline from public salary surveys'), 'phase5.0'
FROM occupations o
CROSS JOIN LATERAL (
  VALUES
    ('Senior Product Manager'::text, 82.0, 3500000, 6500000, 88.0, 22.0, 'rising'::text),
    ('Director of Product',          78.0, 6500000, 12000000, 85.0, 18.0, 'stable'),
    ('Chief Product Officer',        70.0, 12000000, 25000000, 82.0, 15.0, 'stable'),
    ('Data Scientist',               90.0, 2200000, 4500000, 92.0, 28.0, 'rising'),
    ('Senior Data Scientist',        88.0, 4500000, 8500000, 90.0, 25.0, 'rising')
) v(title, demand, smin, smax, future_rel, auto_risk, trend)
WHERE o.canonical_title = v.title
ON CONFLICT (occupation_id, region, dataset_version) DO NOTHING;

-- ── Skill adjacency (curated transferability edges) ───────────────────────
INSERT INTO skill_adjacency (from_skill_id, to_skill_id, similarity, transferability, basis, source_authority, evidence_ref)
SELECT a.id, b.id, v.sim, v.trans, 'curated', 'MetryxOne Curation Board v1', jsonb_build_object('rationale', v.note)
FROM (VALUES
  ('TypeScript', 'JavaScript', 0.95, 0.95, 'Superset relationship'),
  ('JavaScript', 'TypeScript', 0.85, 0.90, 'Superset relationship'),
  ('Python',     'Java',       0.55, 0.60, 'Both general-purpose OOP languages'),
  ('Java',       'C#',         0.80, 0.85, 'Very similar syntax and ecosystem'),
  ('TensorFlow', 'PyTorch',    0.85, 0.85, 'Both major DL frameworks'),
  ('PyTorch',    'TensorFlow', 0.85, 0.85, 'Both major DL frameworks'),
  ('SQL',        'Data Analysis', 0.70, 0.75, 'SQL is the core data tool'),
  ('Machine Learning', 'Statistics', 0.75, 0.70, 'Statistical foundation for ML')
) v(from_name, to_name, sim, trans, note)
JOIN skills a ON a.canonical_name = v.from_name
JOIN skills b ON b.canonical_name = v.to_name
WHERE a.id <> b.id
ON CONFLICT (from_skill_id, to_skill_id, basis) DO NOTHING;

-- ── Inferred skills (declared → implied) ──────────────────────────────────
INSERT INTO inferred_skills (subject_skill_id, inferred_skill_id, inference_basis, confidence, source_authority, evidence_ref)
SELECT a.id, b.id, v.basis, v.conf, 'MetryxOne Curation Board v1', jsonb_build_object('rationale', v.basis)
FROM (VALUES
  ('TensorFlow', 'Machine Learning', 'TensorFlow is an ML framework — implies ML literacy', 0.90),
  ('PyTorch',    'Machine Learning', 'PyTorch is an ML framework — implies ML literacy', 0.90),
  ('TensorFlow', 'Python',           'TensorFlow is primarily used from Python',          0.85),
  ('PyTorch',    'Python',           'PyTorch is primarily used from Python',             0.85)
) v(subject_name, inferred_name, basis, conf)
JOIN skills a ON a.canonical_name = v.subject_name
JOIN skills b ON b.canonical_name = v.inferred_name
ON CONFLICT (subject_skill_id, inferred_skill_id) DO NOTHING;

-- ── Generic skill proficiency level descriptors (level 1..5) ──────────────
-- One-off seed across all skills with a uniform rubric.
INSERT INTO skill_proficiency_levels (skill_id, level, descriptor, indicators)
SELECT s.id, l.level, l.descriptor, l.indicators::jsonb
FROM skills s
CROSS JOIN (VALUES
  (1, 'Aware',         '["Recognises terminology","Can describe at a high level"]'),
  (2, 'Beginner',      '["Has applied with guidance","Can complete simple tasks"]'),
  (3, 'Intermediate',  '["Applies independently","Resolves routine problems"]'),
  (4, 'Advanced',      '["Designs solutions","Mentors others","Handles edge cases"]'),
  (5, 'Expert',        '["Recognised authority","Shapes practice across teams","Publishes/teaches"]')
) l(level, descriptor, indicators)
ON CONFLICT (skill_id, level) DO NOTHING;

-- ── KG edges derived from occupation_skills (so traversal works uniformly) ─
-- requires_skill edge per essential occupation_skill; recommends_skill for important.
INSERT INTO kg_edges (from_type, from_id, to_type, to_id, edge_type, weight, confidence, source_authority, evidence_ref, dataset_version)
SELECT 'occupation', os.occupation_id, 'skill', os.skill_id,
       CASE os.importance WHEN 'essential' THEN 'requires_skill' ELSE 'recommends_skill' END,
       LEAST(1.0, os.weight / 2.5),
       0.900,
       os.source_authority,
       os.evidence_ref,
       os.dataset_version
FROM occupation_skills os
ON CONFLICT (from_type, from_id, to_type, to_id, edge_type) DO NOTHING;

-- progresses_to edges from occupation_pathways
INSERT INTO kg_edges (from_type, from_id, to_type, to_id, edge_type, weight, confidence, source_authority, evidence_ref)
SELECT 'occupation', op.from_occupation_id, 'occupation', op.to_occupation_id,
       'progresses_to', 0.8000, 0.850,
       op.source_authority, op.evidence_ref
FROM occupation_pathways op
ON CONFLICT (from_type, from_id, to_type, to_id, edge_type) DO NOTHING;

-- adjacent_to edges from skill_adjacency
INSERT INTO kg_edges (from_type, from_id, to_type, to_id, edge_type, weight, confidence, source_authority, evidence_ref)
SELECT 'skill', sa.from_skill_id, 'skill', sa.to_skill_id,
       'adjacent_to', sa.transferability, sa.similarity,
       sa.source_authority, sa.evidence_ref
FROM skill_adjacency sa
ON CONFLICT (from_type, from_id, to_type, to_id, edge_type) DO NOTHING;

-- ── Done ──────────────────────────────────────────────────────────────────
