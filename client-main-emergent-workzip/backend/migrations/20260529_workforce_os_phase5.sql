-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 5 — Workforce OS expansion
-- ═══════════════════════════════════════════════════════════════════════════
-- Six net-new domains layered on top of existing gov_*/p5_*/tenants:
--   1. Market intelligence persistence (job demand, salary, AI disruption,
--      emerging roles, macro trends)
--   2. Predictive workforce signals (skill obsolescence, workforce risk,
--      role emergence, AI exposure)
--   3. Fairness & bias monitoring (test suites + results)
--   4. Dispute / human override workflow
--   5. RBAC (roles + permissions + role assignments, tenant-scoped)
--   6. Learning ROI (intervention → org-level financial signal)
-- All tables namespaced wos_*. Read-only against earlier phases.
-- Language policy: developmental signals, conservative forecasts, no
-- promotion / hiring assertions.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Market Intelligence ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wos_market_signals (
  id              BIGSERIAL PRIMARY KEY,
  signal_type     TEXT NOT NULL CHECK (signal_type IN
                    ('job_demand','salary_shift','ai_disruption','emerging_role','macro_trend')),
  role_id         TEXT REFERENCES onto_roles(id) ON DELETE CASCADE,
  competency_id   TEXT REFERENCES onto_competencies(id) ON DELETE CASCADE,
  industry_id     TEXT REFERENCES onto_industries(id) ON DELETE CASCADE,
  geography       TEXT,                           -- 'global' | country/region code
  metric_value    NUMERIC(12,4) NOT NULL,
  metric_unit     TEXT,                           -- 'index', 'pct_change', 'usd', etc.
  direction       TEXT CHECK (direction IN ('up','down','flat','volatile')),
  source          TEXT NOT NULL DEFAULT 'seed',   -- 'seed' | 'ingest:<provider>'
  confidence      NUMERIC(4,3) DEFAULT 0.5,       -- [0,1]
  captured_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  context         JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_wos_market_type ON wos_market_signals(signal_type, captured_at DESC);
CREATE INDEX IF NOT EXISTS ix_wos_market_role ON wos_market_signals(role_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS ix_wos_market_comp ON wos_market_signals(competency_id, captured_at DESC);

-- ── 2. Predictive Workforce ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wos_skill_obsolescence (
  id                   BIGSERIAL PRIMARY KEY,
  competency_id        TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  obsolescence_score   NUMERIC(5,4) NOT NULL,            -- [0,1]
  horizon_months       INT NOT NULL DEFAULT 24,
  drivers              JSONB DEFAULT '[]'::jsonb,        -- ['ai_automation','platform_shift', …]
  confidence_tier      TEXT CHECK (confidence_tier IN ('A','B','C','D','provisional')) DEFAULT 'provisional',
  evidence_count       INT DEFAULT 0,
  recommended_pivot    TEXT,                              -- comp_id to migrate toward
  captured_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_wos_obs_comp ON wos_skill_obsolescence(competency_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS wos_workforce_risk (
  id              BIGSERIAL PRIMARY KEY,
  tenant_id       INT REFERENCES tenants(id) ON DELETE CASCADE,
  scope_type      TEXT NOT NULL CHECK (scope_type IN ('org','function','role_family','layer','role')),
  scope_ref       TEXT,                                   -- function_id / role_family_id / layer_id / role_id
  risk_type       TEXT NOT NULL CHECK (risk_type IN
                    ('attrition_pressure','capability_gap','succession_thin','ai_exposure','market_drift')),
  risk_score      NUMERIC(5,4) NOT NULL,                  -- [0,1]
  severity        TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  drivers         JSONB DEFAULT '[]'::jsonb,
  recommended_actions JSONB DEFAULT '[]'::jsonb,
  horizon_months  INT DEFAULT 12,
  captured_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_wos_risk_tenant ON wos_workforce_risk(tenant_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS ix_wos_risk_type ON wos_workforce_risk(risk_type, severity);

CREATE TABLE IF NOT EXISTS wos_role_emergence (
  id                  BIGSERIAL PRIMARY KEY,
  emerging_role_name  TEXT NOT NULL,
  base_role_id        TEXT REFERENCES onto_roles(id) ON DELETE SET NULL,
  industry_id         TEXT REFERENCES onto_industries(id) ON DELETE SET NULL,
  emergence_score     NUMERIC(5,4) NOT NULL,              -- [0,1]
  composite_competencies JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{competency_id, weight}, …]
  signals             JSONB DEFAULT '[]'::jsonb,          -- supporting market signals
  first_observed_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  captured_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_wos_emerg_industry ON wos_role_emergence(industry_id);

CREATE TABLE IF NOT EXISTS wos_ai_exposure (
  id                  BIGSERIAL PRIMARY KEY,
  scope_type          TEXT NOT NULL CHECK (scope_type IN ('competency','role')),
  scope_ref           TEXT NOT NULL,                       -- competency_id or role_id
  exposure_score      NUMERIC(5,4) NOT NULL,               -- [0,1] higher = more exposure
  augmentation_score  NUMERIC(5,4) NOT NULL,               -- complement: AI assists vs replaces
  net_disruption      NUMERIC(6,4) GENERATED ALWAYS AS (exposure_score - augmentation_score) STORED,
  recommended_focus   TEXT,                                -- developmental hint
  captured_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_wos_aiexp_scope ON wos_ai_exposure(scope_type, scope_ref);

-- ── 3. Fairness & Bias Monitoring ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wos_fairness_suites (
  id              TEXT PRIMARY KEY,
  suite_name      TEXT NOT NULL,
  description     TEXT,
  protected_attributes JSONB NOT NULL DEFAULT '[]'::jsonb, -- ['gender','age_band','geography', …]
  metric_set      JSONB NOT NULL DEFAULT '[]'::jsonb,      -- ['demographic_parity','equal_opportunity', …]
  thresholds      JSONB NOT NULL DEFAULT '{}'::jsonb,      -- {disparate_impact_min:0.8, …}
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wos_fairness_results (
  id              BIGSERIAL PRIMARY KEY,
  suite_id        TEXT NOT NULL REFERENCES wos_fairness_suites(id) ON DELETE CASCADE,
  surface         TEXT NOT NULL,                            -- 'benchmark','mobility','recommendations',etc
  attribute       TEXT NOT NULL,                            -- protected attribute under test
  metric          TEXT NOT NULL,                            -- 'disparate_impact_ratio', etc.
  group_a         TEXT NOT NULL,
  group_b         TEXT NOT NULL,
  metric_value    NUMERIC(8,4) NOT NULL,
  threshold       NUMERIC(8,4),
  passed          BOOLEAN NOT NULL,
  sample_size_a   INT, sample_size_b   INT,
  details         JSONB DEFAULT '{}'::jsonb,
  measured_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_wos_fair_suite ON wos_fairness_results(suite_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS ix_wos_fair_passed ON wos_fairness_results(passed, surface);

-- ── 4. Disputes & Human Override ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wos_disputes (
  id              TEXT PRIMARY KEY,
  user_id         TEXT,
  tenant_id       INT REFERENCES tenants(id) ON DELETE SET NULL,
  subject_type    TEXT NOT NULL CHECK (subject_type IN
                    ('recommendation','benchmark_score','mobility_score','assessment_result','intervention')),
  subject_ref     TEXT NOT NULL,
  reason_code     TEXT NOT NULL CHECK (reason_code IN
                    ('inaccurate','unfair','privacy','irrelevant','other')),
  description     TEXT,
  status          TEXT NOT NULL CHECK (status IN
                    ('open','in_review','resolved_upheld','resolved_overturned','withdrawn')) DEFAULT 'open',
  resolution      TEXT,
  reviewer_id     TEXT,
  override_applied BOOLEAN DEFAULT FALSE,
  override_payload JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_wos_disp_status ON wos_disputes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_wos_disp_user ON wos_disputes(user_id);
CREATE INDEX IF NOT EXISTS ix_wos_disp_tenant ON wos_disputes(tenant_id, status);

CREATE TABLE IF NOT EXISTS wos_human_overrides (
  id              BIGSERIAL PRIMARY KEY,
  dispute_id      TEXT REFERENCES wos_disputes(id) ON DELETE SET NULL,
  subject_type    TEXT NOT NULL,
  subject_ref     TEXT NOT NULL,
  field_path      TEXT NOT NULL,                            -- dot-path of overridden field
  prior_value     JSONB,
  new_value       JSONB,
  reviewer_id     TEXT NOT NULL,
  justification   TEXT NOT NULL,
  expires_at      TIMESTAMPTZ,
  active          BOOLEAN DEFAULT TRUE,
  applied_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_wos_over_subject ON wos_human_overrides(subject_type, subject_ref, active);

-- ── 5. RBAC + Tenant Isolation ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wos_roles (
  id              TEXT PRIMARY KEY,
  role_name       TEXT NOT NULL,
  description     TEXT,
  is_system       BOOLEAN DEFAULT FALSE,                    -- platform-defined vs tenant-defined
  permissions     JSONB NOT NULL DEFAULT '[]'::jsonb,       -- e.g. ['enterprise:read','governance:write']
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wos_role_assignments (
  id              BIGSERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL,
  role_id         TEXT NOT NULL REFERENCES wos_roles(id) ON DELETE CASCADE,
  tenant_id       INT REFERENCES tenants(id) ON DELETE CASCADE,    -- NULL = platform-wide
  granted_by      TEXT,
  granted_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  active          BOOLEAN DEFAULT TRUE,
  UNIQUE (user_id, role_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS ix_wos_assign_user ON wos_role_assignments(user_id, active);
CREATE INDEX IF NOT EXISTS ix_wos_assign_tenant ON wos_role_assignments(tenant_id, active);

-- ── 6. Learning ROI ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wos_learning_roi (
  id                  BIGSERIAL PRIMARY KEY,
  tenant_id           INT REFERENCES tenants(id) ON DELETE CASCADE,
  intervention_id     TEXT REFERENCES learn_interventions(id) ON DELETE CASCADE,
  cohort_size         INT NOT NULL,
  completion_rate     NUMERIC(5,4),
  mean_competency_delta NUMERIC(6,3),
  mean_ei_delta       NUMERIC(6,3),
  capability_uplift   NUMERIC(6,3),                       -- aggregated capability index move
  estimated_capacity_gain_hours NUMERIC(10,2),            -- conservative productivity proxy
  estimated_retention_lift_pct  NUMERIC(5,2),             -- developmental signal, not promise
  total_program_cost  NUMERIC(12,2),
  roi_index           NUMERIC(8,4),                       -- capability_uplift / log(1+cost)
  confidence_tier     TEXT CHECK (confidence_tier IN ('A','B','C','D','provisional')) DEFAULT 'provisional',
  computed_at         TIMESTAMPTZ DEFAULT NOW(),
  context             JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_wos_roi_tenant ON wos_learning_roi(tenant_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS ix_wos_roi_intervention ON wos_learning_roi(intervention_id);

-- ── 7. Workforce OS audit log ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wos_audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  user_id         TEXT,
  tenant_id       INT REFERENCES tenants(id) ON DELETE SET NULL,
  endpoint        TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('ok','fallback','error','denied')),
  request_id      TEXT,
  detail          JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_wos_audit_ep ON wos_audit_logs(endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_wos_audit_user ON wos_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_wos_audit_tenant ON wos_audit_logs(tenant_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- Seed data
-- ═══════════════════════════════════════════════════════════════════════════

-- Additional tenant types (universities, skilling, agency) for multi-tenant
INSERT INTO tenants (tenant_code, tenant_name, tenant_type, contact_email, subscription_tier, max_users)
VALUES
  ('MTRX_UNI',    'MetryxOne University Demo',      'university',   'uni@metryx.one',    'pro',        500),
  ('MTRX_SKILL',  'MetryxOne Skilling Demo',        'skilling',     'skill@metryx.one',  'pro',        500),
  ('MTRX_AGENCY', 'MetryxOne Workforce Agency',     'agency',       'agency@metryx.one', 'enterprise', 2000)
ON CONFLICT (tenant_code) DO NOTHING;

-- ── Market signals — broad coverage across types ──
INSERT INTO wos_market_signals
  (signal_type, role_id, competency_id, industry_id, geography, metric_value, metric_unit, direction, source, confidence, captured_at)
SELECT 'job_demand',
       (SELECT id FROM onto_roles ORDER BY id LIMIT 1 OFFSET (i % GREATEST(1,(SELECT COUNT(*) FROM onto_roles)))),
       NULL,
       (SELECT id FROM onto_industries ORDER BY id LIMIT 1 OFFSET (i % GREATEST(1,(SELECT COUNT(*) FROM onto_industries)))),
       'global',
       100 + (i * 7) % 50,
       'index',
       CASE WHEN i % 3 = 0 THEN 'up' WHEN i % 3 = 1 THEN 'flat' ELSE 'down' END,
       'seed', 0.65, CURRENT_DATE - (i || ' days')::interval
FROM generate_series(0, 9) i;

INSERT INTO wos_market_signals
  (signal_type, role_id, competency_id, industry_id, geography, metric_value, metric_unit, direction, source, confidence)
SELECT 'salary_shift', r.id, NULL, NULL, 'global',
       3.5 + (random() * 5),    -- pct change
       'pct_change', 'up', 'seed', 0.55
FROM (SELECT id FROM onto_roles LIMIT 5) r;

INSERT INTO wos_market_signals
  (signal_type, role_id, competency_id, industry_id, geography, metric_value, metric_unit, direction, source, confidence, context)
SELECT 'ai_disruption', NULL, c.id, NULL, 'global',
       0.30 + (random() * 0.40),
       'exposure_score', 'up', 'seed', 0.70,
       jsonb_build_object('automation_layer','task','window_months',24)
FROM (SELECT id FROM onto_competencies LIMIT 8) c;

INSERT INTO wos_market_signals
  (signal_type, role_id, competency_id, industry_id, geography, metric_value, metric_unit, direction, source, confidence, context)
VALUES
  ('emerging_role', NULL, NULL, NULL, 'global', 1, 'count', 'up', 'seed', 0.55,
   '{"role_name":"AI Product Operator","composite_of":["comp_business_acumen","comp_data_analytics"]}'::jsonb),
  ('emerging_role', NULL, NULL, NULL, 'global', 1, 'count', 'up', 'seed', 0.55,
   '{"role_name":"Behavioural Insights Lead","composite_of":["comp_data_analytics","comp_strategic_thinking"]}'::jsonb),
  ('macro_trend',   NULL, NULL, NULL, 'global', 4.2, 'pct_change', 'up', 'seed', 0.60,
   '{"trend":"hybrid_work","headline":"Hybrid work adoption stable above 60%"}'::jsonb),
  ('macro_trend',   NULL, NULL, NULL, 'global', -1.1, 'pct_change', 'down', 'seed', 0.55,
   '{"trend":"voluntary_attrition","headline":"Voluntary attrition cooling globally"}'::jsonb);

-- ── Skill obsolescence forecasts (derived from competencies) ──
INSERT INTO wos_skill_obsolescence
  (competency_id, obsolescence_score, horizon_months, drivers, confidence_tier, evidence_count, recommended_pivot)
SELECT c.id,
       0.15 + (abs(hashtext(c.id)) % 70) / 100.0,
       24,
       jsonb_build_array('ai_automation','platform_shift'),
       'C',
       12 + (abs(hashtext(c.id)) % 20),
       NULL
FROM onto_competencies c;

-- ── Workforce risk snapshots (one per tenant, several risk types) ──
INSERT INTO wos_workforce_risk
  (tenant_id, scope_type, scope_ref, risk_type, risk_score, severity, drivers, recommended_actions, horizon_months)
SELECT t.id, 'org', NULL, rt,
       0.25 + random() * 0.55,
       CASE WHEN random() < 0.25 THEN 'critical'
            WHEN random() < 0.55 THEN 'high'
            WHEN random() < 0.80 THEN 'medium'
            ELSE 'low' END,
       jsonb_build_array('thin_succession','market_drift'),
       jsonb_build_array(jsonb_build_object('action','accelerate_cohort_dev','priority','high')),
       12
FROM tenants t
CROSS JOIN (VALUES ('attrition_pressure'),('capability_gap'),('succession_thin'),
                   ('ai_exposure'),('market_drift')) AS r(rt);

-- ── Role emergence ──
INSERT INTO wos_role_emergence
  (emerging_role_name, base_role_id, industry_id, emergence_score, composite_competencies, signals)
SELECT 'AI Product Operator',
       (SELECT id FROM onto_roles LIMIT 1), (SELECT id FROM onto_industries LIMIT 1),
       0.72,
       jsonb_build_array(
         jsonb_build_object('competency_id',(SELECT id FROM onto_competencies LIMIT 1 OFFSET 0), 'weight',0.4),
         jsonb_build_object('competency_id',(SELECT id FROM onto_competencies LIMIT 1 OFFSET 1), 'weight',0.35),
         jsonb_build_object('competency_id',(SELECT id FROM onto_competencies LIMIT 1 OFFSET 2), 'weight',0.25)
       ),
       jsonb_build_array('job_demand_up','ai_disruption_high')
WHERE EXISTS (SELECT 1 FROM onto_competencies)
UNION ALL
SELECT 'Behavioural Insights Lead',
       (SELECT id FROM onto_roles LIMIT 1 OFFSET 1),
       (SELECT id FROM onto_industries LIMIT 1 OFFSET 0),
       0.61,
       jsonb_build_array(
         jsonb_build_object('competency_id',(SELECT id FROM onto_competencies LIMIT 1 OFFSET 3),'weight',0.5),
         jsonb_build_object('competency_id',(SELECT id FROM onto_competencies LIMIT 1 OFFSET 4),'weight',0.5)
       ),
       jsonb_build_array('macro_trend_hybrid','emerging_role')
WHERE (SELECT COUNT(*) FROM onto_competencies) >= 5;

-- ── AI exposure (per competency) ──
INSERT INTO wos_ai_exposure (scope_type, scope_ref, exposure_score, augmentation_score, recommended_focus)
SELECT 'competency', c.id,
       0.20 + (abs(hashtext(c.id)) % 70) / 100.0,
       0.30 + (abs(hashtext(c.id || '_aug')) % 60) / 100.0,
       'Lean into uniquely human applications of this capability.'
FROM onto_competencies c;

INSERT INTO wos_ai_exposure (scope_type, scope_ref, exposure_score, augmentation_score, recommended_focus)
SELECT 'role', r.id,
       0.25 + (abs(hashtext(r.id)) % 60) / 100.0,
       0.40 + (abs(hashtext(r.id || '_aug')) % 50) / 100.0,
       'Pair human judgment with AI-augmented workflows.'
FROM onto_roles r;

-- ── Fairness suites + sample results ──
INSERT INTO wos_fairness_suites (id, suite_name, description, protected_attributes, metric_set, thresholds)
VALUES
  ('fair_baseline', 'Baseline fairness suite',
   'Quarterly fairness checks across protected attributes for benchmark + mobility surfaces.',
   '["gender","age_band","geography"]'::jsonb,
   '["disparate_impact_ratio","mean_score_gap","selection_rate_gap"]'::jsonb,
   '{"disparate_impact_min":0.8,"mean_score_gap_max":5.0,"selection_rate_gap_max":0.1}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO wos_fairness_results
  (suite_id, surface, attribute, metric, group_a, group_b, metric_value, threshold, passed, sample_size_a, sample_size_b, details)
VALUES
  ('fair_baseline','benchmark','gender','disparate_impact_ratio','female','male',0.91,0.80,TRUE,420,612,
   '{"surface":"role_alignment","window":"Q1 2026"}'::jsonb),
  ('fair_baseline','benchmark','age_band','mean_score_gap','25-34','45-54',2.7,5.0,TRUE,380,310,
   '{"window":"Q1 2026"}'::jsonb),
  ('fair_baseline','mobility','geography','disparate_impact_ratio','tier1','tier2_3',0.74,0.80,FALSE,510,720,
   '{"recommendation":"Investigate cohort sampling; consider rebalanced features"}'::jsonb),
  ('fair_baseline','recommendations','gender','selection_rate_gap','female','male',0.06,0.10,TRUE,800,950,
   '{"window":"Q1 2026"}'::jsonb);

-- ── Sample disputes (one open, one in_review, one resolved) ──
INSERT INTO wos_disputes (id, user_id, tenant_id, subject_type, subject_ref, reason_code, description, status)
VALUES
  ('disp_demo_001','demo_user_alpha',1,'recommendation','crec_sample_1','inaccurate',
   'Recommendation does not reflect my completed coaching module.','open'),
  ('disp_demo_002','demo_user_beta', 1,'benchmark_score','bench_sample_2','unfair',
   'Cohort sampling appears skewed by geography.','in_review'),
  ('disp_demo_003','demo_user_gamma',1,'mobility_score','mob_sample_3','irrelevant',
   'Target role suggested is not aligned with stated aspiration.','resolved_upheld')
ON CONFLICT (id) DO NOTHING;

INSERT INTO wos_human_overrides (dispute_id, subject_type, subject_ref, field_path, prior_value, new_value, reviewer_id, justification)
VALUES
  ('disp_demo_003','mobility_score','mob_sample_3','target_role_id',
   '"role_orig"'::jsonb,'"role_corrected"'::jsonb,
   'reviewer_lead_01','User aspiration changed in last quarterly review; corrected target role to match.');

-- ── RBAC seed (system roles + permissions) ──
INSERT INTO wos_roles (id, role_name, description, is_system, permissions) VALUES
  ('role_platform_admin','Platform Admin','Full platform-wide access.',TRUE,
   '["platform:*","governance:*","enterprise:*","wos:*"]'::jsonb),
  ('role_tenant_admin','Tenant Admin','Full access within their tenant.',TRUE,
   '["tenant:*","enterprise:read","enterprise:write","wos:read","wos:write","disputes:resolve","overrides:apply"]'::jsonb),
  ('role_workforce_analyst','Workforce Analyst','Read-only analytics + market intelligence.',TRUE,
   '["enterprise:read","wos:read","market:read","predictive:read","fairness:read"]'::jsonb),
  ('role_governance_reviewer','Governance Reviewer','Reviews disputes + fairness + methodology changes.',TRUE,
   '["governance:read","governance:review","disputes:resolve","fairness:read","overrides:apply"]'::jsonb),
  ('role_end_user','End User','Standard learner / user.',TRUE,
   '["self:read","self:write","disputes:file"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── Learning ROI sample rows ──
INSERT INTO wos_learning_roi
  (tenant_id, intervention_id, cohort_size, completion_rate, mean_competency_delta, mean_ei_delta,
   capability_uplift, estimated_capacity_gain_hours, estimated_retention_lift_pct,
   total_program_cost, roi_index, confidence_tier)
SELECT t.id, i.id,
       40 + (random()*60)::int,
       0.55 + random()*0.35,
       3.5 + random()*4,
       2.5 + random()*3,
       4.2 + random()*3,
       (40 + random()*60) * 12,        -- ~hours per learner * cohort
       1.2 + random()*2.3,
       8000 + random()*22000,
       (4.2 + random()*3) / GREATEST(1, ln(1 + (8000 + random()*22000))),
       'C'
FROM tenants t
JOIN LATERAL (SELECT id FROM learn_interventions ORDER BY id LIMIT 3) i ON TRUE
WHERE t.tenant_code IN ('MTRX_DEMO','MTRX_UNI','MTRX_AGENCY');
