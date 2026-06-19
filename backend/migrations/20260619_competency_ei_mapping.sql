-- ============================================================================
-- Phase 3.2 — Competency → Employability-Intelligence (EI) Dimension Mapping
-- ============================================================================
-- STRICTLY ADDITIVE · READ-ONLY COMPOSITION · NEVER FABRICATES.
--
-- Introduces the mapping + rule layer that turns the Phase-2 competency scores
-- into employability "readiness" dimensions (Communication Readiness, Workplace
-- Readiness, Problem-Solving Readiness, Leadership Readiness, Future Readiness …).
--
-- Three deliverables (one table each):
--   1. dimension_weight_rules       — the EI-dimension registry + each dimension's
--                                     roll-up weight in the overall employability view.
--   2. competency_ei_mapping        — the edges: which competency feeds which
--                                     dimension, and its relative contribution weight.
--   3. dimension_calculation_rules  — HOW each dimension score is computed
--                                     (aggregation method, coverage gate, confidence cap, bands).
--
-- There is no migration runner in this project; the canonical schema is mirrored
-- by a lazy ensure*Schema() in services/competency-ei-dimensions.ts and is only
-- ever created when the `competencyEi` flag is ON (flag-OFF => byte-identical
-- legacy: no DDL, no read, no write). This file is the canonical reference.
-- ============================================================================

-- 1. EI dimension registry + roll-up weights -------------------------------------
CREATE TABLE IF NOT EXISTS dimension_weight_rules (
  ei_dimension_id   VARCHAR(80)  PRIMARY KEY,           -- e.g. 'dim_communication_readiness'
  dimension_name    VARCHAR(160) NOT NULL,              -- 'Communication Readiness'
  description       TEXT         NOT NULL DEFAULT '',
  rollup_weight     NUMERIC(6,2) NOT NULL DEFAULT 1.0,  -- weight in the overall employability roll-up
  min_coverage_pct  NUMERIC(6,2) NOT NULL DEFAULT 0,    -- min mapped-competency coverage to report a measured score
  display_order     INTEGER      NOT NULL DEFAULT 0,
  active            BOOLEAN      NOT NULL DEFAULT true,
  version           VARCHAR(40)  NOT NULL DEFAULT 'cei-dim-w1',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_dwr_rollup   CHECK (rollup_weight >= 0),
  CONSTRAINT chk_dwr_coverage CHECK (min_coverage_pct >= 0 AND min_coverage_pct <= 100)
);

-- 2. Competency -> EI dimension edges --------------------------------------------
CREATE TABLE IF NOT EXISTS competency_ei_mapping (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id       VARCHAR(120) NOT NULL,             -- onto_competencies.id (text)
  ei_dimension_id     VARCHAR(80)  NOT NULL,             -- dimension_weight_rules.ei_dimension_id
  contribution_weight NUMERIC(6,2) NOT NULL DEFAULT 1.0, -- relative weight within the dimension
  rationale           TEXT         NOT NULL DEFAULT '',
  source              VARCHAR(40)  NOT NULL DEFAULT 'seed', -- seed | manual
  active              BOOLEAN      NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_cem_weight CHECK (contribution_weight >= 0),
  CONSTRAINT uq_cem UNIQUE (competency_id, ei_dimension_id)
);
CREATE INDEX IF NOT EXISTS idx_cem_dimension  ON competency_ei_mapping (ei_dimension_id);
CREATE INDEX IF NOT EXISTS idx_cem_competency ON competency_ei_mapping (competency_id);

-- 3. Per-dimension calculation rules ---------------------------------------------
CREATE TABLE IF NOT EXISTS dimension_calculation_rules (
  ei_dimension_id             VARCHAR(80) PRIMARY KEY,                       -- dimension_weight_rules.ei_dimension_id
  aggregation_method          VARCHAR(40) NOT NULL DEFAULT 'weighted_mean',  -- weighted_mean | mean | min
  score_source                VARCHAR(40) NOT NULL DEFAULT 'domain_proxy',   -- domain_proxy | precise_then_proxy
  min_components              INTEGER      NOT NULL DEFAULT 1,               -- min measured competencies to emit a score
  domain_proxy_confidence_cap NUMERIC(6,2) NOT NULL DEFAULT 60,             -- caps confidence while measurement is a proxy
  band_thresholds             JSONB        NOT NULL DEFAULT '{"excellent":80,"strong":65,"developing":50,"emerging":35}'::jsonb,
  normalization               VARCHAR(40)  NOT NULL DEFAULT 'none',
  version                     VARCHAR(40)  NOT NULL DEFAULT 'cei-dim-calc-v1',
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_dcr_min CHECK (min_components >= 1),
  CONSTRAINT chk_dcr_cap CHECK (domain_proxy_confidence_cap >= 0 AND domain_proxy_confidence_cap <= 100)
);
