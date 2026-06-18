-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  MetryxOne Employability Index v2 — Full Hierarchical Design               ║
-- ║                                                                            ║
-- ║  Extends the v1 flat 8-dimension model into a 3-tier hierarchy:            ║
-- ║    Dimension → Subdimension → Competency                                  ║
-- ║  with typed Industry Calibration + Role Calibration tables.               ║
-- ║                                                                            ║
-- ║  Additive — does not alter any existing ei_* table.                       ║
-- ║  All scoring is done by mei-scoring-engine.ts reading from these tables.  ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- ───────────────────────────────────────────────────────────────────────────────
-- MASTER TABLES
-- ───────────────────────────────────────────────────────────────────────────────

-- M1: Dimensions ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mei_dimensions (
  id                SERIAL PRIMARY KEY,
  code              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  short_name        TEXT NOT NULL,
  description       TEXT NOT NULL,
  rationale         TEXT NOT NULL,              -- why this dimension matters
  base_weight       NUMERIC(6,4) NOT NULL,      -- 0..1, all rows must sum to 1.0
  max_points        NUMERIC(6,2) NOT NULL,      -- proportional to base_weight × 100
  icon_key          TEXT,                        -- lucide icon name
  color_hex         TEXT,
  display_order     INTEGER NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- M2: Subdimensions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mei_subdimensions (
  id                SERIAL PRIMARY KEY,
  dimension_id      INTEGER NOT NULL REFERENCES mei_dimensions(id) ON DELETE CASCADE,
  code              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL,
  within_dim_weight NUMERIC(6,4) NOT NULL,      -- weight within parent dimension, sums to 1.0 per dim
  display_order     INTEGER NOT NULL DEFAULT 0,
  data_sources      TEXT[],                      -- which profile fields feed this
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- M3: Competencies (leaf scoring units) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mei_competencies (
  id                SERIAL PRIMARY KEY,
  subdimension_id   INTEGER NOT NULL REFERENCES mei_subdimensions(id) ON DELETE CASCADE,
  code              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL,
  within_sd_weight  NUMERIC(6,4) NOT NULL,      -- weight within parent subdimension
  formula_type      TEXT NOT NULL,              -- count_capped|direct|tier_weighted|percent|keyword_match|conditional|composite
  formula_config    JSONB NOT NULL,             -- formula-specific parameters
  data_field        TEXT,                       -- profile field that feeds this
  max_raw           NUMERIC(8,2) NOT NULL DEFAULT 100,
  is_gated          BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE if 0 when not taken (e.g. assessment)
  gate_condition    TEXT,                        -- e.g. 'assessment_taken'
  display_order     INTEGER NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- M4: Industry Calibration ──────────────────────────────────────────────────────
-- Per-industry multiplier on each dimension's base weight.
-- After applying, weights are re-normalised to sum = 1.0.
CREATE TABLE IF NOT EXISTS mei_industry_calibration (
  id                SERIAL PRIMARY KEY,
  industry_code     TEXT NOT NULL,
  industry_name     TEXT NOT NULL,
  dimension_id      INTEGER NOT NULL REFERENCES mei_dimensions(id) ON DELETE CASCADE,
  multiplier        NUMERIC(6,3) NOT NULL DEFAULT 1.000,
  rationale         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(industry_code, dimension_id)
);
CREATE INDEX IF NOT EXISTS idx_mei_industry_cal ON mei_industry_calibration(industry_code);

-- M5: Role Calibration ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mei_role_calibration (
  id                SERIAL PRIMARY KEY,
  role_level_code   TEXT NOT NULL,             -- entry|junior|mid|senior|manager|director
  role_level_name   TEXT NOT NULL,
  yoe_min           NUMERIC(4,1),              -- years of experience minimum
  yoe_max           NUMERIC(4,1),              -- years of experience maximum (null = unbounded)
  dimension_id      INTEGER NOT NULL REFERENCES mei_dimensions(id) ON DELETE CASCADE,
  multiplier        NUMERIC(6,3) NOT NULL DEFAULT 1.000,
  rationale         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_level_code, dimension_id)
);
CREATE INDEX IF NOT EXISTS idx_mei_role_cal ON mei_role_calibration(role_level_code);

-- M6: Insight Rules (Narrative Engine) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mei_insight_rules (
  id                SERIAL PRIMARY KEY,
  rule_type         TEXT NOT NULL,             -- band|dimension_strength|dimension_gap|composite_insight|action_directive
  trigger_field     TEXT NOT NULL,             -- 'band'|dimension code|subdimension code
  trigger_operator  TEXT NOT NULL,             -- gte|lte|eq|between|any
  trigger_value     JSONB NOT NULL,            -- {min:50,max:74} or "hire_ready" etc.
  narrative_template TEXT NOT NULL,            -- mustache-style {{name}}, {{score}}, {{band}}
  tone              TEXT NOT NULL DEFAULT 'supportive', -- supportive|direct|motivational|cautionary
  audience          TEXT NOT NULL DEFAULT 'candidate',  -- candidate|counselor|employer|parent
  priority          INTEGER NOT NULL DEFAULT 50,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mei_insight_rules_type ON mei_insight_rules(rule_type, trigger_field);

-- M7: Recommendation Master (templates) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mei_recommendation_master (
  id                SERIAL PRIMARY KEY,
  code              TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  action_type       TEXT NOT NULL,             -- take_assessment|add_skills|add_certs|complete_profile|add_projects|get_cert|capadex
  target_dimension  INTEGER REFERENCES mei_dimensions(id),
  target_subdimension INTEGER REFERENCES mei_subdimensions(id),
  estimated_point_gain NUMERIC(5,2),          -- approximate EI point gain
  effort_level      TEXT NOT NULL DEFAULT 'medium', -- low|medium|high
  time_to_complete  TEXT,                      -- e.g. '2 weeks'
  link_path         TEXT,                      -- deep-link inside the app
  prerequisites     TEXT[],
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  display_order     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────────────────────
-- CALCULATION TABLES
-- ───────────────────────────────────────────────────────────────────────────────

-- C1: User MEI Scores (latest) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mei_scores (
  id                SERIAL PRIMARY KEY,
  user_id           TEXT NOT NULL,             -- career_seeker_profiles.id
  composite_score   NUMERIC(6,2) NOT NULL,
  band              TEXT NOT NULL,             -- getting_started|building|career_ready|hire_ready
  confidence        NUMERIC(6,4) NOT NULL DEFAULT 1.0, -- 0..1 data completeness proxy
  industry_code     TEXT,                      -- calibration applied (null=base)
  role_level_code   TEXT,                      -- calibration applied (null=base)
  breakdown         JSONB NOT NULL,            -- {dimensions:[{code,score,subdimensions:[{code,score,competencies:[...]}]}]}
  calibration_trace JSONB,                     -- raw multipliers applied
  data_sources      TEXT[],                    -- which sources contributed
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version           TEXT NOT NULL DEFAULT '2.0',
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_mei_scores_user ON mei_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_mei_scores_band  ON mei_scores(band);

-- C2: Score History (longitudinal snapshots) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS mei_score_history (
  id                SERIAL PRIMARY KEY,
  user_id           TEXT NOT NULL,
  composite_score   NUMERIC(6,2) NOT NULL,
  band              TEXT NOT NULL,
  confidence        NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  industry_code     TEXT,
  role_level_code   TEXT,
  breakdown         JSONB NOT NULL,
  snapshot_trigger  TEXT NOT NULL DEFAULT 'profile_update', -- profile_update|cron|manual|assessment_complete
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version           TEXT NOT NULL DEFAULT '2.0'
);
CREATE INDEX IF NOT EXISTS idx_mei_history_user ON mei_score_history(user_id, computed_at DESC);

-- C3: Competency-level Scores (per-user, per-competency) ─────────────────────────
CREATE TABLE IF NOT EXISTS mei_competency_scores (
  id                SERIAL PRIMARY KEY,
  user_id           TEXT NOT NULL,
  competency_id     INTEGER NOT NULL REFERENCES mei_competencies(id) ON DELETE CASCADE,
  raw_score         NUMERIC(8,4) NOT NULL,     -- 0..max_raw
  normalised_score  NUMERIC(6,4) NOT NULL,     -- 0..1
  trace             JSONB,                     -- formula inputs + intermediates
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, competency_id)
);
CREATE INDEX IF NOT EXISTS idx_mei_comp_scores_user ON mei_competency_scores(user_id);

-- C4: Benchmark Cohorts (aggregated, not individual) ─────────────────────────────
CREATE TABLE IF NOT EXISTS mei_benchmarks (
  id                SERIAL PRIMARY KEY,
  cohort_key        TEXT NOT NULL UNIQUE,      -- '{industry_code}:{role_level_code}:{yoe_band}'
  industry_code     TEXT,
  role_level_code   TEXT,
  yoe_band          TEXT,                      -- '0-2'|'2-5'|'5-10'|'10+'
  sample_size       INTEGER NOT NULL DEFAULT 0,
  p25               NUMERIC(6,2),
  p50               NUMERIC(6,2),
  p75               NUMERIC(6,2),
  p90               NUMERIC(6,2),
  mean              NUMERIC(6,2),
  std_dev           NUMERIC(6,2),
  dimension_p50     JSONB,                     -- per-dimension median scores
  refreshed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mei_benchmarks_cohort ON mei_benchmarks(industry_code, role_level_code);

-- C5: User Recommendations (computed) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mei_user_recommendations (
  id                SERIAL PRIMARY KEY,
  user_id           TEXT NOT NULL,
  recommendation_id INTEGER NOT NULL REFERENCES mei_recommendation_master(id) ON DELETE CASCADE,
  priority_score    NUMERIC(6,4) NOT NULL,     -- impact × (1-effort) × confidence
  point_impact      NUMERIC(5,2),              -- estimated EI points available
  is_actioned       BOOLEAN NOT NULL DEFAULT FALSE,
  actioned_at       TIMESTAMPTZ,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, recommendation_id)
);
CREATE INDEX IF NOT EXISTS idx_mei_user_recs_user ON mei_user_recommendations(user_id, priority_score DESC);

-- C6: Narrative Cache ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mei_narratives (
  id                SERIAL PRIMARY KEY,
  user_id           TEXT NOT NULL,
  audience          TEXT NOT NULL DEFAULT 'candidate',
  band_narrative    TEXT,
  strength_narratives JSONB,                   -- [{dimension_code, text}]
  gap_narratives    JSONB,                     -- [{dimension_code, text}]
  composite_insight TEXT,
  action_directive  TEXT,
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  score_snapshot    NUMERIC(6,2),              -- score when generated (cache invalidation)
  UNIQUE(user_id, audience)
);

-- ───────────────────────────────────────────────────────────────────────────────
-- SEED: DIMENSIONS
-- ───────────────────────────────────────────────────────────────────────────────

INSERT INTO mei_dimensions (code, name, short_name, description, rationale, base_weight, max_points, icon_key, color_hex, display_order) VALUES
('validated_proficiency',    'Validated Proficiency',     'Proficiency',  'Demonstrable, evidence-backed professional capability — assessment scores, technical depth, and issuer-verified credentials.',
 'The single strongest predictor of role performance (Schmidt & Hunter validity ~0.5). Separates claimed competence from validated competence.',
 0.28, 28, 'CheckCircle', '#6366f1', 1),
('professional_experience',  'Professional Experience',   'Experience',   'Depth, seniority, and trajectory of paid professional work across roles and organisations.',
 'Tenure × seniority proxies accountability scope. Career progression signals learning velocity and growth ceiling.',
 0.25, 25, 'Briefcase', '#0ea5e9', 2),
('knowledge_foundation',     'Knowledge Foundation',      'Education',    'Formal education rigour, institution quality, field alignment, and continuous learning activity.',
 'Degree level × institution tier remains a strong proxy for analytical rigour and disciplinary depth, especially at entry–mid career.',
 0.15, 15, 'GraduationCap', '#10b981', 3),
('behavioural_intelligence', 'Behavioural Intelligence',  'Behaviour',    'How the candidate operates interpersonally, adapts, communicates, and leads — validated through CAPADEX, BIOS, and self-report.',
 'Behavioural signals differentiate candidates with equivalent technical profiles. CAPADEX provides a validated, behaviour-specific score beyond soft-skill self-report.',
 0.22, 22, 'Brain', '#f59e0b', 4),
('portfolio_signal',         'Portfolio & Presence',      'Portfolio',    'Demonstrable work (projects, publications, open source), profile completeness, and social proof.',
 'Shifts the conversation from claim to evidence. A strong portfolio accelerates recruiter trust. Profile completeness is a necessary floor condition.',
 0.10, 10, 'FolderOpen', '#8b5cf6', 5)
ON CONFLICT (code) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────────
-- SEED: SUBDIMENSIONS
-- ───────────────────────────────────────────────────────────────────────────────

WITH dims AS (SELECT id, code FROM mei_dimensions)
INSERT INTO mei_subdimensions (dimension_id, code, name, description, within_dim_weight, display_order, data_sources) SELECT
  (SELECT id FROM dims WHERE code='validated_proficiency'), 'assessment_performance', 'Assessment Performance',
  'Scores from validated competency, specialisation, and leadership assessments taken by the candidate.',
  0.45, 1, ARRAY['assessment','capadex_sessions']
UNION ALL SELECT
  (SELECT id FROM dims WHERE code='validated_proficiency'), 'technical_skill_depth', 'Technical Skill Depth',
  'Breadth and depth of technical skills declared and detectable from profile data.',
  0.35, 2, ARRAY['skills','resume']
UNION ALL SELECT
  (SELECT id FROM dims WHERE code='validated_proficiency'), 'credential_credibility', 'Credential Credibility',
  'Issuer-weighted certifications with recency and verification status.',
  0.20, 3, ARRAY['certifications']
UNION ALL SELECT
  (SELECT id FROM dims WHERE code='professional_experience'), 'tenure_seniority', 'Tenure & Seniority',
  'Total experience years weighted by the peak seniority level reached.',
  0.50, 1, ARRAY['work_experience']
UNION ALL SELECT
  (SELECT id FROM dims WHERE code='professional_experience'), 'career_progression', 'Career Progression',
  'Velocity of promotions, growth in responsibility scope, and company scale signals.',
  0.30, 2, ARRAY['work_experience']
UNION ALL SELECT
  (SELECT id FROM dims WHERE code='professional_experience'), 'industry_alignment', 'Industry Alignment',
  'Match between experience industries and the candidate''s target industry, plus cross-industry breadth.',
  0.20, 3, ARRAY['work_experience','profile']
UNION ALL SELECT
  (SELECT id FROM dims WHERE code='knowledge_foundation'), 'degree_rigour', 'Degree Rigour',
  'Degree level (NSQF/EQF aligned) multiplied by institution quality (NIRF/NAAC/QS tier).',
  0.50, 1, ARRAY['education']
UNION ALL SELECT
  (SELECT id FROM dims WHERE code='knowledge_foundation'), 'field_relevance', 'Field Relevance',
  'Alignment between field of study and target role requirements.',
  0.30, 2, ARRAY['education']
UNION ALL SELECT
  (SELECT id FROM dims WHERE code='knowledge_foundation'), 'continuous_learning', 'Continuous Learning',
  'Recent certifications, courses, and learning activity in the past 3 years.',
  0.20, 3, ARRAY['certifications','education']
UNION ALL SELECT
  (SELECT id FROM dims WHERE code='behavioural_intelligence'), 'capadex_profile', 'CAPADEX Profile',
  'Validated behavioural intelligence from the CAPADEX assessment and Career Stage Index (CSI).',
  0.50, 1, ARRAY['capadex','csi']
UNION ALL SELECT
  (SELECT id FROM dims WHERE code='behavioural_intelligence'), 'interpersonal_competence', 'Interpersonal Competence',
  'Communication, collaboration, and leadership readiness signals.',
  0.30, 2, ARRAY['skills','assessments']
UNION ALL SELECT
  (SELECT id FROM dims WHERE code='behavioural_intelligence'), 'adaptive_capacity', 'Adaptive Capacity',
  'Learning agility, industry transitions, and resilience signals.',
  0.20, 3, ARRAY['work_experience','capadex']
UNION ALL SELECT
  (SELECT id FROM dims WHERE code='portfolio_signal'), 'demonstrable_work', 'Demonstrable Work',
  'Projects, portfolio pieces, open-source contributions, and publications.',
  0.40, 1, ARRAY['projects']
UNION ALL SELECT
  (SELECT id FROM dims WHERE code='portfolio_signal'), 'professional_visibility', 'Professional Visibility',
  'Profile completeness, headline quality, summary depth, and online presence.',
  0.35, 2, ARRAY['profile']
UNION ALL SELECT
  (SELECT id FROM dims WHERE code='portfolio_signal'), 'social_proof', 'Social Proof',
  'Endorsements, recommendations, references, and published thought leadership.',
  0.25, 3, ARRAY['profile']
ON CONFLICT (code) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────────
-- SEED: COMPETENCIES (45 leaf nodes)
-- ───────────────────────────────────────────────────────────────────────────────

WITH sds AS (SELECT id, code FROM mei_subdimensions)
INSERT INTO mei_competencies (subdimension_id, code, name, description, within_sd_weight, formula_type, formula_config, data_field, max_raw, is_gated, gate_condition, display_order) SELECT
-- ── SD: assessment_performance ────────────────────────────────────────────────
  (SELECT id FROM sds WHERE code='assessment_performance'), 'core_assessment_score',
  'Core Competency Assessment', 'Primary competency assessment score (0–100) when taken.',
  0.55, 'direct', '{"scale":100,"zero_when_not_taken":true}'::jsonb, 'assessmentScore', 100, TRUE, 'assessment_taken', 1
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='assessment_performance'), 'specialisation_assessment',
  'Specialisation Assessment', 'Domain-specific assessment score, if taken.',
  0.30, 'conditional', '{"condition":"specialisation_taken","scale":100,"default":0}'::jsonb, 'specialisationScore', 100, TRUE, 'specialisation_taken', 2
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='assessment_performance'), 'leadership_assessment',
  'Leadership Assessment', 'Leadership or management assessment score, weighted by seniority level.',
  0.15, 'conditional', '{"condition":"leadership_taken","scale":100,"seniority_gate":"manager"}'::jsonb, 'leadershipScore', 100, FALSE, NULL, 3
-- ── SD: technical_skill_depth ─────────────────────────────────────────────────
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='technical_skill_depth'), 'technical_skill_count',
  'Technical Skill Count', 'Number of validated technical skills (capped at 8; depth beats length).',
  0.50, 'count_capped', '{"cap":8,"points_per_unit":12.5}'::jsonb, 'technical_skills', 100, FALSE, NULL, 1
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='technical_skill_depth'), 'tool_proficiency',
  'Tool & Platform Proficiency', 'Domain tools and platforms listed (capped at 5).',
  0.30, 'count_capped', '{"cap":5,"points_per_unit":20}'::jsonb, 'tools', 100, FALSE, NULL, 2
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='technical_skill_depth'), 'emerging_tech_signal',
  'Emerging Technology Awareness', 'Skills matching an emerging-tech vocabulary (AI/ML, cloud, etc.).',
  0.20, 'keyword_match', '{"vocab_key":"emerging_tech","max_matches":3,"points_per_match":33.3}'::jsonb, 'skills_text', 100, FALSE, NULL, 3
-- ── SD: credential_credibility ───────────────────────────────────────────────
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='credential_credibility'), 'professional_certifications',
  'Professional Certifications', 'Issuer-tier-weighted sum of certifications (Top=40pts, Mid=25pts, Generic=10pts).',
  0.60, 'tier_weighted', '{"tiers":{"top":40,"mid":25,"generic":10},"cap":100}'::jsonb, 'certifications', 100, FALSE, NULL, 1
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='credential_credibility'), 'verification_bonus',
  'Credential Verification Bonus', '+50% multiplier on any certification verified via Credly/DigiLocker/API.',
  0.25, 'multiplier_bonus', '{"base_multiplier":1.5,"applies_to":"professional_certifications","gate":"verified"}'::jsonb, 'cert_verified', 100, FALSE, NULL, 2
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='credential_credibility'), 'cert_recency',
  'Certification Recency', 'Bonus for certifications earned in the past 3 years.',
  0.15, 'recency', '{"recent_years":3,"full_credit_years":1,"decay_per_year":0.25}'::jsonb, 'cert_dates', 100, FALSE, NULL, 3
-- ── SD: tenure_seniority ─────────────────────────────────────────────────────
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='tenure_seniority'), 'years_experience',
  'Years of Experience', 'Total professional experience years, saturating at 10 years.',
  0.50, 'count_capped', '{"cap_years":10,"points_at_cap":100}'::jsonb, 'total_months', 100, FALSE, NULL, 1
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='tenure_seniority'), 'peak_seniority',
  'Peak Seniority Level', 'Highest seniority role held (C-suite=100, Junior=35).',
  0.35, 'lookup', '{"mapping":{"c_suite":100,"vp":100,"director":90,"manager":80,"senior":70,"associate":55,"junior":35}}'::jsonb, 'peak_seniority', 100, FALSE, NULL, 2
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='tenure_seniority'), 'role_tenure_quality',
  'Role Tenure Quality', 'Average tenure per role (min 18mo preferred; job-hopping discount).',
  0.15, 'tenure_quality', '{"optimal_months":30,"min_months":6,"discount_per_short_role":0.1}'::jsonb, 'role_tenures', 100, FALSE, NULL, 3
-- ── SD: career_progression ───────────────────────────────────────────────────
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='career_progression'), 'promotion_velocity',
  'Promotion Velocity', 'Number of seniority-level increases per 3 years of career.',
  0.45, 'velocity', '{"window_years":3,"max_promotions_per_window":2}'::jsonb, 'seniority_history', 100, FALSE, NULL, 1
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='career_progression'), 'responsibility_growth',
  'Responsibility Growth', 'Upward slope of seniority levels over time.',
  0.35, 'slope', '{"method":"seniority_regression"}'::jsonb, 'seniority_history', 100, FALSE, NULL, 2
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='career_progression'), 'company_scale_signal',
  'Company Scale Signal', 'Evidence of having operated at significant scale (Tier 1 employer).',
  0.20, 'tier_weighted', '{"tiers":{"tier1":100,"tier2":65,"tier3":35},"cap":100}'::jsonb, 'employers', 100, FALSE, NULL, 3
-- ── SD: industry_alignment ───────────────────────────────────────────────────
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='industry_alignment'), 'target_industry_match',
  'Target Industry Match', 'Proportion of experience years in the candidate''s target industry.',
  0.55, 'percent', '{"field":"target_industry_years_pct","scale":100}'::jsonb, 'industry_years', 100, FALSE, NULL, 1
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='industry_alignment'), 'cross_industry_breadth',
  'Cross-Industry Breadth', 'Number of distinct industries worked in (breadth bonus, capped at 4).',
  0.25, 'count_capped', '{"cap":4,"points_per_unit":25}'::jsonb, 'unique_industries', 100, FALSE, NULL, 2
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='industry_alignment'), 'domain_depth_signal',
  'Domain Depth Signal', 'Years in target industry domain relative to total experience.',
  0.20, 'ratio', '{"numerator":"target_domain_years","denominator":"total_years","scale":100}'::jsonb, 'industry_years', 100, FALSE, NULL, 3
-- ── SD: degree_rigour ────────────────────────────────────────────────────────
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='degree_rigour'), 'degree_level_score',
  'Degree Level', 'Academic qualification level mapped to NSQF/EQF scale (PhD=100, Other=30).',
  0.45, 'lookup', '{"mapping":{"phd":100,"masters":85,"bachelors":65,"diploma":40,"other":30}}'::jsonb, 'highest_degree', 100, FALSE, NULL, 1
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='degree_rigour'), 'institution_quality',
  'Institution Quality', 'NIRF/NAAC/QS-derived institution tier (Tier1=100, Tier2=75, Tier3=50).',
  0.40, 'lookup', '{"mapping":{"tier1":100,"tier2":75,"tier3":50,"unknown":30}}'::jsonb, 'best_institution_tier', 100, FALSE, NULL, 2
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='degree_rigour'), 'programme_credibility',
  'Programme Accreditation', 'NBA/ABET programme-level accreditation bonus.',
  0.15, 'boolean_bonus', '{"bonus_if_true":100,"default":0}'::jsonb, 'programme_accredited', 100, FALSE, NULL, 3
-- ── SD: field_relevance ──────────────────────────────────────────────────────
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='field_relevance'), 'field_target_alignment',
  'Field-Role Alignment', 'How closely the field of study maps to the target role category.',
  0.60, 'lookup', '{"mapping":{"exact":100,"adjacent":70,"transferable":45,"unrelated":20}}'::jsonb, 'field_alignment', 100, FALSE, NULL, 1
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='field_relevance'), 'multidisciplinary_signal',
  'Multidisciplinary Signal', 'Bonus for holding qualifications in multiple complementary fields.',
  0.25, 'boolean_bonus', '{"bonus_if_true":80,"default":0}'::jsonb, 'multi_field', 100, FALSE, NULL, 2
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='field_relevance'), 'postgrad_specialisation',
  'Postgraduate Specialisation', 'Bonus for postgraduate qualification aligned to target role.',
  0.15, 'conditional', '{"condition":"has_postgrad","aligned_bonus":100,"unaligned_bonus":40}'::jsonb, 'postgrad_field', 100, FALSE, NULL, 3
-- ── SD: continuous_learning ──────────────────────────────────────────────────
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='continuous_learning'), 'recent_certifications',
  'Recent Certifications (3yr)', 'Certifications earned in the past 36 months.',
  0.50, 'count_capped', '{"window_months":36,"cap":3,"points_per_unit":33.3}'::jsonb, 'cert_dates', 100, FALSE, NULL, 1
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='continuous_learning'), 'course_completion',
  'Course Completions', 'Online/in-person courses completed (MOOCs, workshops, etc.).',
  0.30, 'count_capped', '{"cap":5,"points_per_unit":20}'::jsonb, 'courses', 100, FALSE, NULL, 2
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='continuous_learning'), 'learning_velocity',
  'Learning Velocity', 'Credentials earned per year averaged over the past 3 years.',
  0.20, 'velocity', '{"window_years":3,"optimal_per_year":2}'::jsonb, 'cert_history', 100, FALSE, NULL, 3
-- ── SD: capadex_profile ──────────────────────────────────────────────────────
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='capadex_profile'), 'capadex_score',
  'CAPADEX Behavioural Score', 'Validated CAPADEX behavioural intelligence assessment score.',
  0.60, 'direct', '{"scale":100,"zero_when_not_taken":true}'::jsonb, 'capadex_score', 100, TRUE, 'capadex_taken', 1
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='capadex_profile'), 'csi_score',
  'Career Stage Index (CSI)', 'Career Stage Index from BIOS — composite of motivation, confidence, engagement.',
  0.30, 'direct', '{"scale":100,"default_when_absent":0}'::jsonb, 'csi_score', 100, FALSE, NULL, 2
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='capadex_profile'), 'behavioural_consistency',
  'Behavioural Consistency', 'Consistency of behavioural signals across multiple CAPADEX sessions.',
  0.10, 'conditional', '{"condition":"multi_session","consistency_measure":"signal_variance_inverse"}'::jsonb, 'session_count', 100, FALSE, NULL, 3
-- ── SD: interpersonal_competence ─────────────────────────────────────────────
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='interpersonal_competence'), 'soft_skills_breadth',
  'Soft Skills Breadth', 'Number of soft/interpersonal skills declared (capped at 5).',
  0.45, 'count_capped', '{"cap":5,"points_per_unit":20}'::jsonb, 'soft_skills', 100, FALSE, NULL, 1
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='interpersonal_competence'), 'communication_signal',
  'Communication Signal', 'Communication-related keywords and assessment sub-scores.',
  0.35, 'keyword_match', '{"vocab_key":"communication","max_matches":4,"points_per_match":25}'::jsonb, 'soft_skills_text', 100, FALSE, NULL, 2
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='interpersonal_competence'), 'collaboration_signal',
  'Collaboration & Teamwork', 'Teamwork/collaboration signals from skills, endorsements, and assessment.',
  0.20, 'composite', '{"sources":["collaboration_keywords","endorsement_count"],"weights":[0.6,0.4]}'::jsonb, 'soft_skills_text', 100, FALSE, NULL, 3
-- ── SD: adaptive_capacity ────────────────────────────────────────────────────
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='adaptive_capacity'), 'industry_transitions',
  'Industry Transitions', 'Successful cross-industry career moves — signals adaptability.',
  0.35, 'count_capped', '{"cap":3,"points_per_unit":33.3}'::jsonb, 'industry_transitions', 100, FALSE, NULL, 1
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='adaptive_capacity'), 'skill_update_recency',
  'Skill Update Recency', 'Skills added or updated in the past 12 months.',
  0.35, 'recency', '{"window_months":12,"full_credit_months":6}'::jsonb, 'skill_updated_at', 100, FALSE, NULL, 2
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='adaptive_capacity'), 'learning_agility_composite',
  'Learning Agility Composite', 'Blend of continuous learning score and CAPADEX curiosity/openness signals.',
  0.30, 'composite', '{"sources":["recent_certifications","capadex_curiosity"],"weights":[0.5,0.5]}'::jsonb, 'combined', 100, FALSE, NULL, 3
-- ── SD: demonstrable_work ────────────────────────────────────────────────────
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='demonstrable_work'), 'project_count',
  'Projects & Portfolio', 'Documented projects with description (capped at 4).',
  0.55, 'count_capped', '{"cap":4,"points_per_unit":25}'::jsonb, 'projects', 100, FALSE, NULL, 1
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='demonstrable_work'), 'publication_signal',
  'Publications & Thought Leadership', 'Articles, papers, blog posts, or conference talks.',
  0.25, 'count_capped', '{"cap":3,"points_per_unit":33.3}'::jsonb, 'publications', 100, FALSE, NULL, 2
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='demonstrable_work'), 'open_source_signal',
  'Open Source & Public Contributions', 'GitHub profile, open-source repos, or public portfolio links.',
  0.20, 'boolean_bonus', '{"bonus_if_true":100,"default":0}'::jsonb, 'has_github', 100, FALSE, NULL, 3
-- ── SD: professional_visibility ──────────────────────────────────────────────
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='professional_visibility'), 'profile_completeness',
  'Profile Completeness', 'Percentage of core profile fields filled (name, headline, summary, photo).',
  0.55, 'percent', '{"field":"profile_fill_pct","scale":100}'::jsonb, 'profile_fill_pct', 100, FALSE, NULL, 1
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='professional_visibility'), 'headline_quality',
  'Headline & Summary Quality', 'Presence and quality of a professional headline and summary statement.',
  0.30, 'text_quality', '{"fields":["headline","summary"],"min_length_headline":20,"min_length_summary":100}'::jsonb, 'profile_text', 100, FALSE, NULL, 2
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='professional_visibility'), 'online_presence',
  'Online Presence Links', 'LinkedIn, personal website, portfolio URL — signals professional identity.',
  0.15, 'count_capped', '{"cap":3,"points_per_unit":33.3}'::jsonb, 'profile_links', 100, FALSE, NULL, 3
-- ── SD: social_proof ─────────────────────────────────────────────────────────
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='social_proof'), 'recommendations_received',
  'Recommendations Received', 'Written recommendations from managers or colleagues.',
  0.50, 'count_capped', '{"cap":4,"points_per_unit":25}'::jsonb, 'recommendations', 100, FALSE, NULL, 1
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='social_proof'), 'endorsement_signal',
  'Endorsements & References', 'Skill endorsements or references named on profile.',
  0.30, 'count_capped', '{"cap":5,"points_per_unit":20}'::jsonb, 'endorsements', 100, FALSE, NULL, 2
UNION ALL SELECT
  (SELECT id FROM sds WHERE code='social_proof'), 'awards_recognition',
  'Awards & Recognition', 'Documented awards, honours, or formal recognition.',
  0.20, 'count_capped', '{"cap":3,"points_per_unit":33.3}'::jsonb, 'awards', 100, FALSE, NULL, 3
ON CONFLICT (code) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────────
-- SEED: INDUSTRY CALIBRATION (10 industries × 5 dimensions)
-- ───────────────────────────────────────────────────────────────────────────────
-- Multiplier > 1.0 = upweight this dimension for this industry
-- Multiplier < 1.0 = downweight
-- Engine re-normalises so calibrated weights still sum to 1.0

WITH dims AS (SELECT id, code FROM mei_dimensions)
INSERT INTO mei_industry_calibration (industry_code, industry_name, dimension_id, multiplier, rationale) SELECT
-- Technology
  'technology','Technology & Software', (SELECT id FROM dims WHERE code='validated_proficiency'), 1.35, 'Technical depth is the primary differentiator in tech hiring'
UNION ALL SELECT 'technology','Technology & Software', (SELECT id FROM dims WHERE code='professional_experience'), 1.10, 'Experience breadth signals delivery capability'
UNION ALL SELECT 'technology','Technology & Software', (SELECT id FROM dims WHERE code='knowledge_foundation'), 0.75, 'Self-taught paths are well-established; formal education less dominant'
UNION ALL SELECT 'technology','Technology & Software', (SELECT id FROM dims WHERE code='behavioural_intelligence'), 0.90, 'Behavioural signals matter but technical proof takes precedence'
UNION ALL SELECT 'technology','Technology & Software', (SELECT id FROM dims WHERE code='portfolio_signal'), 1.30, 'GitHub/portfolio is a strong shortlisting signal in tech'
-- Finance
UNION ALL SELECT 'finance','Finance & Banking', (SELECT id FROM dims WHERE code='validated_proficiency'), 1.35, 'Certifications (CFA, CA, CPA) carry heavy weight'
UNION ALL SELECT 'finance','Finance & Banking', (SELECT id FROM dims WHERE code='professional_experience'), 1.15, 'Track record in regulated environments is critical'
UNION ALL SELECT 'finance','Finance & Banking', (SELECT id FROM dims WHERE code='knowledge_foundation'), 1.15, 'Top-tier education strongly correlated with finance career entry'
UNION ALL SELECT 'finance','Finance & Banking', (SELECT id FROM dims WHERE code='behavioural_intelligence'), 0.80, 'Regulatory compliance culture de-emphasises behavioural over credential'
UNION ALL SELECT 'finance','Finance & Banking', (SELECT id FROM dims WHERE code='portfolio_signal'), 0.65, 'Discretion norms limit public portfolio'
-- Healthcare
UNION ALL SELECT 'healthcare','Healthcare & Life Sciences', (SELECT id FROM dims WHERE code='validated_proficiency'), 1.15, 'Licensure and clinical skills are table-stakes'
UNION ALL SELECT 'healthcare','Healthcare & Life Sciences', (SELECT id FROM dims WHERE code='professional_experience'), 1.05, 'Clinical hours and supervised practice critical'
UNION ALL SELECT 'healthcare','Healthcare & Life Sciences', (SELECT id FROM dims WHERE code='knowledge_foundation'), 1.40, 'MBBS/MD/nursing degrees are mandatory gatekeepers'
UNION ALL SELECT 'healthcare','Healthcare & Life Sciences', (SELECT id FROM dims WHERE code='behavioural_intelligence'), 1.10, 'Patient empathy and team communication are evidence-based differentiators'
UNION ALL SELECT 'healthcare','Healthcare & Life Sciences', (SELECT id FROM dims WHERE code='portfolio_signal'), 0.65, 'Research publications matter; general portfolio less relevant'
-- Consulting
UNION ALL SELECT 'consulting','Management Consulting', (SELECT id FROM dims WHERE code='validated_proficiency'), 1.20, 'Structured problem-solving and analytical certifications'
UNION ALL SELECT 'consulting','Management Consulting', (SELECT id FROM dims WHERE code='professional_experience'), 1.25, 'Client-facing experience at scale is the core signal'
UNION ALL SELECT 'consulting','Management Consulting', (SELECT id FROM dims WHERE code='knowledge_foundation'), 1.15, 'Top-tier MBA/undergrad strongly correlated with tier-1 firms'
UNION ALL SELECT 'consulting','Management Consulting', (SELECT id FROM dims WHERE code='behavioural_intelligence'), 1.10, 'Communication and stakeholder management are critical'
UNION ALL SELECT 'consulting','Management Consulting', (SELECT id FROM dims WHERE code='portfolio_signal'), 0.70, 'NDA culture limits public case work'
-- Education
UNION ALL SELECT 'education','Education & Academia', (SELECT id FROM dims WHERE code='validated_proficiency'), 0.90, 'Pedagogical certifications matter; general technical depth less critical'
UNION ALL SELECT 'education','Education & Academia', (SELECT id FROM dims WHERE code='professional_experience'), 0.90, 'Teaching experience less seniority-correlated'
UNION ALL SELECT 'education','Education & Academia', (SELECT id FROM dims WHERE code='knowledge_foundation'), 1.40, 'PhD and institutional prestige are primary hiring signals'
UNION ALL SELECT 'education','Education & Academia', (SELECT id FROM dims WHERE code='behavioural_intelligence'), 1.25, 'Communication, empathy, and student-centric behaviour are core'
UNION ALL SELECT 'education','Education & Academia', (SELECT id FROM dims WHERE code='portfolio_signal'), 1.00, 'Publications and open courseware are valuable signals'
-- Manufacturing
UNION ALL SELECT 'manufacturing','Manufacturing & Engineering', (SELECT id FROM dims WHERE code='validated_proficiency'), 1.20, 'Technical credentials and safety certs are critical'
UNION ALL SELECT 'manufacturing','Manufacturing & Engineering', (SELECT id FROM dims WHERE code='professional_experience'), 1.30, 'Operational depth and shift experience highly valued'
UNION ALL SELECT 'manufacturing','Manufacturing & Engineering', (SELECT id FROM dims WHERE code='knowledge_foundation'), 1.05, 'Engineering degree + AICTE accreditation important'
UNION ALL SELECT 'manufacturing','Manufacturing & Engineering', (SELECT id FROM dims WHERE code='behavioural_intelligence'), 0.85, 'Team-work valued; behavioural assessment less standard'
UNION ALL SELECT 'manufacturing','Manufacturing & Engineering', (SELECT id FROM dims WHERE code='portfolio_signal'), 0.75, 'Patent/IP ownership valued but rare'
-- Retail/FMCG
UNION ALL SELECT 'retail_fmcg','Retail & FMCG', (SELECT id FROM dims WHERE code='validated_proficiency'), 0.85, 'Commercial acumen over formal technical depth'
UNION ALL SELECT 'retail_fmcg','Retail & FMCG', (SELECT id FROM dims WHERE code='professional_experience'), 1.20, 'Quota attainment and territory/category management experience'
UNION ALL SELECT 'retail_fmcg','Retail & FMCG', (SELECT id FROM dims WHERE code='knowledge_foundation'), 0.85, 'Education less determinative in frontline retail'
UNION ALL SELECT 'retail_fmcg','Retail & FMCG', (SELECT id FROM dims WHERE code='behavioural_intelligence'), 1.20, 'Customer empathy, energy, and resilience are primary differentiators'
UNION ALL SELECT 'retail_fmcg','Retail & FMCG', (SELECT id FROM dims WHERE code='portfolio_signal'), 0.85, 'Sales metrics more valued than formal portfolio'
-- Media/Creative
UNION ALL SELECT 'media_creative','Media, Design & Creative', (SELECT id FROM dims WHERE code='validated_proficiency'), 0.80, 'Creative output supersedes formal technical credentials'
UNION ALL SELECT 'media_creative','Media, Design & Creative', (SELECT id FROM dims WHERE code='professional_experience'), 0.90, 'Studio/agency credits matter, years less important'
UNION ALL SELECT 'media_creative','Media, Design & Creative', (SELECT id FROM dims WHERE code='knowledge_foundation'), 0.75, 'Portfolio school and apprenticeship paths well-established'
UNION ALL SELECT 'media_creative','Media, Design & Creative', (SELECT id FROM dims WHERE code='behavioural_intelligence'), 1.05, 'Creative collaboration and client-facing behaviour'
UNION ALL SELECT 'media_creative','Media, Design & Creative', (SELECT id FROM dims WHERE code='portfolio_signal'), 1.85, 'Portfolio is the PRIMARY hiring signal in creative roles'
-- Government/PSU
UNION ALL SELECT 'government_psu','Government & Public Sector', (SELECT id FROM dims WHERE code='validated_proficiency'), 0.90, 'Regulatory and procedural competence, not market tech depth'
UNION ALL SELECT 'government_psu','Government & Public Sector', (SELECT id FROM dims WHERE code='professional_experience'), 1.10, 'Hierarchical tenure and posting breadth valued'
UNION ALL SELECT 'government_psu','Government & Public Sector', (SELECT id FROM dims WHERE code='knowledge_foundation'), 1.35, 'UPSC, PSC credentials; institutional prestige strongly weighted'
UNION ALL SELECT 'government_psu','Government & Public Sector', (SELECT id FROM dims WHERE code='behavioural_intelligence'), 0.85, 'Procedure compliance culture; behavioural assessment less prevalent'
UNION ALL SELECT 'government_psu','Government & Public Sector', (SELECT id FROM dims WHERE code='portfolio_signal'), 0.65, 'Public sector confidentiality limits external portfolio'
-- Startup/VC
UNION ALL SELECT 'startup_vc','Startup & Venture', (SELECT id FROM dims WHERE code='validated_proficiency'), 1.10, 'Cross-functional skills and execution speed valued'
UNION ALL SELECT 'startup_vc','Startup & Venture', (SELECT id FROM dims WHERE code='professional_experience'), 0.90, 'Startup track record and early-stage exposure'
UNION ALL SELECT 'startup_vc','Startup & Venture', (SELECT id FROM dims WHERE code='knowledge_foundation'), 0.70, 'Dropout culture and non-linear paths commonplace'
UNION ALL SELECT 'startup_vc','Startup & Venture', (SELECT id FROM dims WHERE code='behavioural_intelligence'), 1.10, 'Hustle, adaptability, and ambiguity tolerance are critical'
UNION ALL SELECT 'startup_vc','Startup & Venture', (SELECT id FROM dims WHERE code='portfolio_signal'), 1.40, 'Side projects, open source, and prior exits are strong signals'
ON CONFLICT (industry_code, dimension_id) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────────
-- SEED: ROLE CALIBRATION (6 levels × 5 dimensions)
-- ───────────────────────────────────────────────────────────────────────────────

WITH dims AS (SELECT id, code FROM mei_dimensions)
INSERT INTO mei_role_calibration (role_level_code, role_level_name, yoe_min, yoe_max, dimension_id, multiplier, rationale) SELECT
-- Entry (0–2 years)
  'entry','Entry Level', 0, 2, (SELECT id FROM dims WHERE code='validated_proficiency'), 1.05, 'Formal credentials are the main differentiator at entry level'
UNION ALL SELECT 'entry','Entry Level', 0, 2, (SELECT id FROM dims WHERE code='professional_experience'), 0.60, 'Limited experience expected; de-weight to avoid penalising recent graduates'
UNION ALL SELECT 'entry','Entry Level', 0, 2, (SELECT id FROM dims WHERE code='knowledge_foundation'), 1.55, 'Education is the primary signal at career start'
UNION ALL SELECT 'entry','Entry Level', 0, 2, (SELECT id FROM dims WHERE code='behavioural_intelligence'), 1.20, 'Coachability and enthusiasm differentiate equally-qualified graduates'
UNION ALL SELECT 'entry','Entry Level', 0, 2, (SELECT id FROM dims WHERE code='portfolio_signal'), 1.30, 'Projects and internship portfolio compensate for lack of experience'
-- Junior (2–4 years)
UNION ALL SELECT 'junior','Junior Professional', 2, 4, (SELECT id FROM dims WHERE code='validated_proficiency'), 1.10, 'Technical depth becoming the primary differentiator'
UNION ALL SELECT 'junior','Junior Professional', 2, 4, (SELECT id FROM dims WHERE code='professional_experience'), 0.85, 'Early-career experience still building; less determinative'
UNION ALL SELECT 'junior','Junior Professional', 2, 4, (SELECT id FROM dims WHERE code='knowledge_foundation'), 1.20, 'Education still relevant; postgrad gaining traction'
UNION ALL SELECT 'junior','Junior Professional', 2, 4, (SELECT id FROM dims WHERE code='behavioural_intelligence'), 1.10, 'Collaboration and communication differentiating at this stage'
UNION ALL SELECT 'junior','Junior Professional', 2, 4, (SELECT id FROM dims WHERE code='portfolio_signal'), 1.10, 'Building evidence base; project quality starts to matter'
-- Mid (4–8 years)
UNION ALL SELECT 'mid','Mid-Level Professional', 4, 8, (SELECT id FROM dims WHERE code='validated_proficiency'), 1.20, 'Technical leadership and specialisation expected'
UNION ALL SELECT 'mid','Mid-Level Professional', 4, 8, (SELECT id FROM dims WHERE code='professional_experience'), 1.10, 'Experience quality and impact becoming central'
UNION ALL SELECT 'mid','Mid-Level Professional', 4, 8, (SELECT id FROM dims WHERE code='knowledge_foundation'), 1.00, 'Education at par; track record starting to supersede'
UNION ALL SELECT 'mid','Mid-Level Professional', 4, 8, (SELECT id FROM dims WHERE code='behavioural_intelligence'), 1.00, 'Behavioural balance; technical+behavioural parity'
UNION ALL SELECT 'mid','Mid-Level Professional', 4, 8, (SELECT id FROM dims WHERE code='portfolio_signal'), 1.00, 'Balanced portfolio expectations'
-- Senior (8–12 years)
UNION ALL SELECT 'senior','Senior Professional', 8, 12, (SELECT id FROM dims WHERE code='validated_proficiency'), 1.20, 'Deep expertise and specialisation at premium'
UNION ALL SELECT 'senior','Senior Professional', 8, 12, (SELECT id FROM dims WHERE code='professional_experience'), 1.20, 'Experience depth and industry impact are critical signals'
UNION ALL SELECT 'senior','Senior Professional', 8, 12, (SELECT id FROM dims WHERE code='knowledge_foundation'), 0.85, 'Track record supersedes education at senior level'
UNION ALL SELECT 'senior','Senior Professional', 8, 12, (SELECT id FROM dims WHERE code='behavioural_intelligence'), 1.00, 'Mentoring and influencing ability increasingly important'
UNION ALL SELECT 'senior','Senior Professional', 8, 12, (SELECT id FROM dims WHERE code='portfolio_signal'), 0.90, 'Thought leadership more valued than project portfolio'
-- Manager/Lead (people manager, typically 6+ years)
UNION ALL SELECT 'manager','Manager / Team Lead', 6, NULL, (SELECT id FROM dims WHERE code='validated_proficiency'), 0.90, 'Technical depth secondary to leadership execution'
UNION ALL SELECT 'manager','Manager / Team Lead', 6, NULL, (SELECT id FROM dims WHERE code='professional_experience'), 1.25, 'People management experience and team outcomes central'
UNION ALL SELECT 'manager','Manager / Team Lead', 6, NULL, (SELECT id FROM dims WHERE code='knowledge_foundation'), 0.80, 'Results track record supersedes educational credentials'
UNION ALL SELECT 'manager','Manager / Team Lead', 6, NULL, (SELECT id FROM dims WHERE code='behavioural_intelligence'), 1.35, 'Leadership, empathy, and conflict-resolution are the differentiators'
UNION ALL SELECT 'manager','Manager / Team Lead', 6, NULL, (SELECT id FROM dims WHERE code='portfolio_signal'), 0.80, 'Strategic deliverables outweigh personal portfolio'
-- Director+ (10+ years, executive)
UNION ALL SELECT 'director','Director & Above', 10, NULL, (SELECT id FROM dims WHERE code='validated_proficiency'), 0.80, 'Domain expertise assumed; breadth and vision are the signals'
UNION ALL SELECT 'director','Director & Above', 10, NULL, (SELECT id FROM dims WHERE code='professional_experience'), 1.30, 'Organisation scope, P&L ownership, and board-level delivery'
UNION ALL SELECT 'director','Director & Above', 10, NULL, (SELECT id FROM dims WHERE code='knowledge_foundation'), 0.75, 'Education at this level is a minor signal; track record dominates'
UNION ALL SELECT 'director','Director & Above', 10, NULL, (SELECT id FROM dims WHERE code='behavioural_intelligence'), 1.40, 'Strategic influence, executive presence, and culture-setting'
UNION ALL SELECT 'director','Director & Above', 10, NULL, (SELECT id FROM dims WHERE code='portfolio_signal'), 0.70, 'Public thought leadership valued; personal portfolio less relevant'
ON CONFLICT (role_level_code, dimension_id) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────────
-- SEED: INSIGHT RULES
-- ───────────────────────────────────────────────────────────────────────────────

INSERT INTO mei_insight_rules (rule_type, trigger_field, trigger_operator, trigger_value, narrative_template, tone, audience, priority) VALUES
-- Band-level narratives
('band', 'band', 'eq', '"hire_ready"'::jsonb, 'Your Employability Index of {{score}} puts you in the Hire-Ready band — the top tier. Your profile has strong signals across validated proficiency, experience depth, and presence. At this level, velocity matters: prioritise applications, visibility, and interview preparation.', 'direct', 'candidate', 100),
('band', 'band', 'eq', '"career_ready"'::jsonb, 'At {{score}}, you''re Career-Ready — a solid foundation with clear, achievable leverage points. Focus on your top-rated recommendation to move into Hire-Ready range. The gap is often smaller than it looks: {{top_gap_action}} can add the most points.', 'motivational', 'candidate', 100),
('band', 'band', 'eq', '"building"'::jsonb, 'Your score of {{score}} shows a profile in active development — Building. You have real signal here. Your three most impactful next steps are: {{rec_1}}, {{rec_2}}, and {{rec_3}}. Adding validated evidence in your weakest dimension will create the fastest movement.', 'supportive', 'candidate', 100),
('band', 'band', 'eq', '"getting_started"'::jsonb, 'Every profile starts somewhere. Your score of {{score}} reflects limited signal so far — which means your upside is significant. Start with the quick wins: complete your profile, add your top skills, and consider taking the CAPADEX assessment to unlock your behavioural intelligence score.', 'supportive', 'candidate', 100),
-- Dimension strength narratives
('dimension_strength', 'validated_proficiency', 'gte', '75'::jsonb, 'Your Validated Proficiency score of {{dim_score}} is a genuine differentiator. Assessments, skills, and credentials on your profile are well above average for your cohort — this is a strong shortlisting signal.', 'direct', 'candidate', 80),
('dimension_strength', 'professional_experience', 'gte', '75'::jsonb, 'Your Professional Experience depth of {{dim_score}} signals a track record that speaks for itself. The combination of tenure, seniority progression, and industry alignment is compelling.', 'direct', 'candidate', 80),
('dimension_strength', 'behavioural_intelligence', 'gte', '75'::jsonb, 'Your Behavioural Intelligence score of {{dim_score}} is one of your strongest signals. CAPADEX and your interpersonal profile show how you operate — and recruiters at progressive organisations increasingly value this.', 'motivational', 'candidate', 80),
-- Dimension gap narratives
('dimension_gap', 'validated_proficiency', 'lte', '40'::jsonb, 'Validated Proficiency at {{dim_score}} is your biggest opportunity. Taking the competency assessment alone could add up to {{max_gain}} points. Credentials and depth of skills are the fastest levers here.', 'supportive', 'candidate', 90),
('dimension_gap', 'behavioural_intelligence', 'lte', '30'::jsonb, 'Your Behavioural Intelligence score is low primarily because the CAPADEX assessment hasn''t been taken yet. Once taken, this dimension can contribute up to {{max_gain}} points — it''s your single largest available gain.', 'motivational', 'candidate', 90),
('dimension_gap', 'portfolio_signal', 'lte', '40'::jsonb, 'Portfolio & Presence at {{dim_score}} is holding your overall score back. Adding two or three documented projects and completing your profile summary are low-effort, high-impact changes.', 'direct', 'candidate', 85),
-- Counsellor-facing narratives
('band', 'band', 'eq', '"building"'::jsonb, 'Candidate is in the Building band ({{score}}). Primary gaps: {{top_3_gaps}}. Recommended counsellor focus: evidence-building in {{weakest_dimension}}.', 'direct', 'counselor', 100),
-- Composite insights
('composite_insight', 'composite', 'any', '{"type":"assessment_not_taken"}'::jsonb, 'You haven''t taken the CAPADEX assessment yet. This single action unlocks your Behavioural Intelligence dimension and could add up to {{capadex_points}} points to your EI score.', 'motivational', 'candidate', 95),
('composite_insight', 'composite', 'any', '{"type":"profile_incomplete"}'::jsonb, 'Your profile is {{fill_pct}}% complete. Finishing the remaining fields takes under 10 minutes and directly improves your Profile Completeness and Visibility scores.', 'supportive', 'candidate', 85),
('composite_insight', 'composite', 'any', '{"type":"high_exp_low_cred"}'::jsonb, 'Your experience depth is strong but your credentials haven''t kept pace. A relevant certification in your domain would significantly reinforce what your track record already shows.', 'direct', 'candidate', 88)
ON CONFLICT DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────────
-- SEED: RECOMMENDATION MASTER
-- ───────────────────────────────────────────────────────────────────────────────

WITH dims AS (SELECT id, code FROM mei_dimensions),
     sds  AS (SELECT id, code FROM mei_subdimensions)
INSERT INTO mei_recommendation_master (code, title, description, action_type, target_dimension, target_subdimension, estimated_point_gain, effort_level, time_to_complete, link_path, display_order) SELECT
  'take_capadex', 'Complete CAPADEX Assessment', 'The CAPADEX behavioural intelligence assessment is your largest single lever. It unlocks 50% of your Behavioural Intelligence dimension and can move you 8–15 points instantly.',
  'capadex', (SELECT id FROM dims WHERE code='behavioural_intelligence'), (SELECT id FROM sds WHERE code='capadex_profile'),
  12.0, 'low', '35 minutes', '/assessment', 1
UNION ALL SELECT
  'take_competency_assessment', 'Take Competency Assessment', 'The core competency assessment validates your professional skills through a structured evaluation. It contributes up to 45% of your Validated Proficiency dimension.',
  'take_assessment', (SELECT id FROM dims WHERE code='validated_proficiency'), (SELECT id FROM sds WHERE code='assessment_performance'),
  10.0, 'medium', '45–60 minutes', '/career-builder?tab=competency', 2
UNION ALL SELECT
  'add_technical_skills', 'Add Technical Skills (up to 8)', 'Each verified technical skill contributes to your score — up to the cap of 8. If you have fewer than 8, adding more is a quick, direct gain.',
  'add_skills', (SELECT id FROM dims WHERE code='validated_proficiency'), (SELECT id FROM sds WHERE code='technical_skill_depth'),
  5.0, 'low', '15 minutes', '/career-builder?tab=skills', 3
UNION ALL SELECT
  'earn_top_cert', 'Earn a Top-Tier Certification', 'A Tier-1 certification (PMP, CFA, AWS Solutions Architect, etc.) contributes 40 points to the Credential Credibility subdimension — equivalent to 2.2 EI points.',
  'get_cert', (SELECT id FROM dims WHERE code='validated_proficiency'), (SELECT id FROM sds WHERE code='credential_credibility'),
  4.0, 'high', '4–12 weeks', '/career-builder?tab=development', 4
UNION ALL SELECT
  'complete_profile', 'Complete Profile to 100%', 'Unfinished profile fields lower both your Profile Completeness score and recruiter trust. Getting to 100% takes under 15 minutes and is one of the easiest gains available.',
  'complete_profile', (SELECT id FROM dims WHERE code='portfolio_signal'), (SELECT id FROM sds WHERE code='professional_visibility'),
  2.5, 'low', '15 minutes', '/career-builder?tab=profile', 5
UNION ALL SELECT
  'add_projects', 'Document Your Projects', 'Add up to 4 projects with descriptions, outcomes, and links. This is the primary driver of your Demonstrable Work subdimension.',
  'add_projects', (SELECT id FROM dims WHERE code='portfolio_signal'), (SELECT id FROM sds WHERE code='demonstrable_work'),
  2.0, 'low', '20 minutes', '/career-builder?tab=projects', 6
UNION ALL SELECT
  'add_soft_skills', 'Add Interpersonal & Soft Skills', 'Soft skills (up to 5) feed your Interpersonal Competence subdimension. Communication, leadership, and collaboration keywords are the highest-signal picks.',
  'add_skills', (SELECT id FROM dims WHERE code='behavioural_intelligence'), (SELECT id FROM sds WHERE code='interpersonal_competence'),
  1.5, 'low', '10 minutes', '/career-builder?tab=skills', 7
UNION ALL SELECT
  'earn_recent_cert', 'Add a Recent Certification (3yr)', 'Certifications earned in the past 3 years boost your Continuous Learning subdimension. Even a mid-tier online specialisation counts.',
  'get_cert', (SELECT id FROM dims WHERE code='knowledge_foundation'), (SELECT id FROM sds WHERE code='continuous_learning'),
  1.5, 'medium', '2–4 weeks', '/career-builder?tab=development', 8
UNION ALL SELECT
  'add_headline_summary', 'Write a Professional Headline & Summary', 'A compelling headline (20+ chars) and summary (100+ chars) improve your Headline Quality score and signal professional intent to recruiters.',
  'complete_profile', (SELECT id FROM dims WHERE code='portfolio_signal'), (SELECT id FROM sds WHERE code='professional_visibility'),
  1.0, 'low', '20 minutes', '/career-builder?tab=profile', 9
ON CONFLICT (code) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ───────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_mei_competencies_sd  ON mei_competencies(subdimension_id);
CREATE INDEX IF NOT EXISTS idx_mei_subdimensions_dim ON mei_subdimensions(dimension_id);
CREATE INDEX IF NOT EXISTS idx_mei_recs_dim          ON mei_recommendation_master(target_dimension);
CREATE INDEX IF NOT EXISTS idx_mei_narratives_user   ON mei_narratives(user_id);
