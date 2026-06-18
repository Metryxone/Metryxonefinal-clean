-- Phase 5 — Governance + Explainability + Enterprise Intelligence
-- READ-ONLY against prior phases. New namespaces: gov_*, p5_*
-- Idempotent.

BEGIN;

-- 1) governance workflows — approval workflow definitions
CREATE TABLE IF NOT EXISTS gov_workflows (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  entity_type     TEXT NOT NULL,            -- ontology_competency | ontology_role | benchmark_methodology | role_dna | weighting_policy
  steps           JSONB NOT NULL,           -- ordered approval steps
  version         TEXT NOT NULL DEFAULT '5.0.0',
  is_current      BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gov_wf_entity ON gov_workflows(entity_type) WHERE is_current;

-- 2) ontology reviews — review/approval per change
CREATE TABLE IF NOT EXISTS gov_ontology_reviews (
  id              TEXT PRIMARY KEY,
  workflow_id     TEXT NOT NULL REFERENCES gov_workflows(id),
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  proposer        TEXT NOT NULL,
  reviewer        TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | escalated
  change_diff     JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale       TEXT,
  proposed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS gov_rev_status ON gov_ontology_reviews(status, proposed_at DESC);

-- 3) methodology versions — central version registry
CREATE TABLE IF NOT EXISTS gov_methodology_versions (
  id              TEXT PRIMARY KEY,
  methodology_name TEXT NOT NULL,           -- ontology | benchmark | weighting | mobility | trajectory | recommendation | explainability
  version         TEXT NOT NULL,
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to        TIMESTAMPTZ,
  is_current      BOOLEAN NOT NULL DEFAULT true,
  change_summary  TEXT,
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  references_doc  TEXT
);
CREATE INDEX IF NOT EXISTS gov_mv_current ON gov_methodology_versions(methodology_name) WHERE is_current;

-- 4) audit framework — centralized cross-domain audit
CREATE TABLE IF NOT EXISTS gov_audit_framework (
  id              BIGSERIAL PRIMARY KEY,
  ts              TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor           TEXT,
  action          TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT,
  domain          TEXT,                     -- ontology | benchmark | mobility | longitudinal | governance | enterprise
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address      TEXT,
  user_agent      TEXT,
  request_id      TEXT,
  outcome         TEXT NOT NULL DEFAULT 'success'
);
CREATE INDEX IF NOT EXISTS gov_audit_ts ON gov_audit_framework(ts DESC);
CREATE INDEX IF NOT EXISTS gov_audit_domain ON gov_audit_framework(domain, ts DESC);

-- 5) explainability logs — per-score explanations
CREATE TABLE IF NOT EXISTS gov_explainability_logs (
  id              TEXT PRIMARY KEY,
  score_type      TEXT NOT NULL,            -- role_alignment | competency_pct | mobility | trajectory | recommendation
  entity_id       TEXT NOT NULL,            -- session/user/role
  score           NUMERIC(7,3),
  contributors    JSONB NOT NULL,           -- top features w/ contribution magnitudes
  weighting_version TEXT NOT NULL,
  methodology_version TEXT NOT NULL,
  cohort_id       TEXT,
  confidence_tier TEXT,
  freshness_days  INTEGER,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gov_expl_score_type ON gov_explainability_logs(score_type, computed_at DESC);
CREATE INDEX IF NOT EXISTS gov_expl_entity ON gov_explainability_logs(entity_id, computed_at DESC);

-- 6) recommendation explanations
CREATE TABLE IF NOT EXISTS gov_recommendation_explanations (
  id              TEXT PRIMARY KEY,
  recommendation_id TEXT NOT NULL,
  category        TEXT NOT NULL,
  basis           JSONB NOT NULL,
  source_signals  JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_band TEXT,
  methodology_version TEXT NOT NULL,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gov_rec_expl_recid ON gov_recommendation_explanations(recommendation_id);

-- 7) workforce intelligence — strategic rollups
CREATE TABLE IF NOT EXISTS p5_workforce_intelligence (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL DEFAULT 'global',
  dimension       TEXT NOT NULL,             -- layer | function | role_family | competency_domain
  metric          TEXT NOT NULL,
  value           NUMERIC(12,3) NOT NULL,
  band            TEXT,
  dimensions      JSONB NOT NULL DEFAULT '{}'::jsonb,
  period          DATE NOT NULL,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS p5_wi_tenant_dim ON p5_workforce_intelligence(tenant_id, dimension, period DESC);

-- 8) succession models — readiness bands (developmental — never hiring)
CREATE TABLE IF NOT EXISTS p5_succession_models (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  target_role_id  TEXT NOT NULL,
  readiness_band  TEXT NOT NULL,             -- developing | progressing | aligned | developmentally_ready
  readiness_score NUMERIC(5,2) NOT NULL,
  contributing_strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  development_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_horizon_months INTEGER,
  language_safe   BOOLEAN NOT NULL DEFAULT true,
  methodology_version TEXT NOT NULL DEFAULT '5.0.0',
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS p5_succ_role ON p5_succession_models(target_role_id, readiness_band);
CREATE INDEX IF NOT EXISTS p5_succ_user ON p5_succession_models(user_id, computed_at DESC);

-- 9) organizational capabilities — capability index per org cell
CREATE TABLE IF NOT EXISTS p5_organizational_capabilities (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL DEFAULT 'global',
  layer_id        TEXT NOT NULL,
  function_id     TEXT,
  competency_id   TEXT NOT NULL,
  capability_index NUMERIC(5,2) NOT NULL,
  maturity_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  gap_indicator   TEXT,                       -- aligned | development_opportunity | strategic_gap
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS p5_oc_tenant ON p5_organizational_capabilities(tenant_id, layer_id);

-- 10) enterprise analytics — top-level dashboard snapshots
CREATE TABLE IF NOT EXISTS p5_enterprise_analytics (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL DEFAULT 'global',
  snapshot_name   TEXT NOT NULL,
  payload         JSONB NOT NULL,
  freshness_days  INTEGER NOT NULL DEFAULT 0,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS p5_ea_tenant ON p5_enterprise_analytics(tenant_id, snapshot_name);

-- rate-limit counters (best-effort, in-DB)
CREATE TABLE IF NOT EXISTS gov_rate_limits (
  bucket          TEXT NOT NULL,
  window_start    TIMESTAMPTZ NOT NULL,
  count           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

COMMIT;
