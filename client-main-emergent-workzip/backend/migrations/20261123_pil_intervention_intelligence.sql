-- CAPADEX PIL — Phase 5: Intervention Intelligence Layer (canonical schema).
--
-- Strictly ADDITIVE. Reads existing PIL tables read-only (archetype_library,
-- human_problem_library); writes ONLY the five NEW tables below. ALL are
-- `pil_`-prefixed: a CAPADEX runtime table `intervention_library` ALREADY EXISTS
-- (migration 20260509_intervention_engine.sql), so the whole Phase-5 set is
-- namespaced to avoid collision — the only deviation from the spec's literal names.
--
-- This file is the canonical mirror of the lazy ensureSchema() bootstrap in
-- backend/scripts/pil/run-intervention-intelligence.ts (there is no migration
-- runner; the runner is idempotent and self-creates these on first run).
--
-- 660 interventions = 22 archetypes × 5 stakeholders × 6 intervention types.
-- Each links archetype_id + problem_id + stakeholder_type + intervention_type
-- (NO orphans). Quality scores (1:1) carry five honest 1–5 scores; outcomes (1:1)
-- carry the expected outcome / success / progress copy + deterministic confidence
-- and risk-reduction PROJECTIONS. Growth pathways + action-plan templates are the
-- per archetype × stakeholder rollups.

-- ── 1) intervention library ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pil_intervention_library (
  intervention_id   SERIAL PRIMARY KEY,
  archetype_id      INTEGER NOT NULL,
  archetype_key     TEXT NOT NULL,
  archetype_name    TEXT NOT NULL DEFAULT '',
  problem_id        INTEGER NOT NULL,
  stakeholder_type  TEXT NOT NULL CHECK (stakeholder_type IN ('student','parent','teacher','counselor','professional')),
  intervention_type TEXT NOT NULL CHECK (intervention_type IN ('immediate_actions','seven_day','thirty_day','ninety_day','habit','skill_building')),
  intervention_text TEXT NOT NULL,
  realism_pass      BOOLEAN NOT NULL DEFAULT true,
  aligned           BOOLEAN NOT NULL DEFAULT true,
  is_duplicate      BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (archetype_key, stakeholder_type, intervention_type)
);
CREATE INDEX IF NOT EXISTS idx_pil_int_archetype   ON pil_intervention_library(archetype_key);
CREATE INDEX IF NOT EXISTS idx_pil_int_stakeholder ON pil_intervention_library(stakeholder_type);
CREATE INDEX IF NOT EXISTS idx_pil_int_type        ON pil_intervention_library(intervention_type);
CREATE INDEX IF NOT EXISTS idx_pil_int_problem     ON pil_intervention_library(problem_id);

-- ── 2) quality scores (1:1) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pil_intervention_quality_scores (
  score_id              SERIAL PRIMARY KEY,
  intervention_id       INTEGER NOT NULL REFERENCES pil_intervention_library(intervention_id) ON DELETE CASCADE,
  archetype_key         TEXT NOT NULL,
  stakeholder_type      TEXT NOT NULL,
  intervention_type     TEXT NOT NULL,
  practicality          SMALLINT NOT NULL CHECK (practicality BETWEEN 1 AND 5),
  actionability         SMALLINT NOT NULL CHECK (actionability BETWEEN 1 AND 5),
  outcome_clarity       SMALLINT NOT NULL CHECK (outcome_clarity BETWEEN 1 AND 5),
  stakeholder_relevance SMALLINT NOT NULL CHECK (stakeholder_relevance BETWEEN 1 AND 5),
  archetype_alignment   SMALLINT NOT NULL CHECK (archetype_alignment BETWEEN 1 AND 5),
  composite             NUMERIC(4,2) NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (intervention_id)
);
CREATE INDEX IF NOT EXISTS idx_pil_iqs_archetype ON pil_intervention_quality_scores(archetype_key);

-- ── 3) outcomes (1:1) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pil_intervention_outcomes (
  outcome_id            SERIAL PRIMARY KEY,
  intervention_id       INTEGER NOT NULL REFERENCES pil_intervention_library(intervention_id) ON DELETE CASCADE,
  archetype_key         TEXT NOT NULL,
  stakeholder_type      TEXT NOT NULL,
  intervention_type     TEXT NOT NULL,
  expected_outcome      TEXT NOT NULL,
  success_indicator     TEXT NOT NULL,
  progress_indicator    TEXT NOT NULL,
  -- deterministic PROJECTIONS (time-horizon × honest quality), NOT measured:
  confidence_impact     NUMERIC(5,4) NOT NULL DEFAULT 0,
  risk_reduction_impact NUMERIC(5,4) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (intervention_id)
);
CREATE INDEX IF NOT EXISTS idx_pil_iout_archetype ON pil_intervention_outcomes(archetype_key);

-- ── 4) growth pathways (archetype × stakeholder developmental arc) ────────────
CREATE TABLE IF NOT EXISTS pil_growth_pathways (
  pathway_id            SERIAL PRIMARY KEY,
  pathway_key           TEXT NOT NULL,
  archetype_id          INTEGER NOT NULL,
  archetype_key         TEXT NOT NULL,
  archetype_name        TEXT NOT NULL DEFAULT '',
  stakeholder_type      TEXT NOT NULL,
  problem_id            INTEGER NOT NULL,
  stage_count           SMALLINT NOT NULL DEFAULT 0,
  complete              BOOLEAN NOT NULL DEFAULT false,
  stages                JSONB NOT NULL DEFAULT '[]'::jsonb,
  avg_composite         NUMERIC(4,2) NOT NULL DEFAULT 0,
  avg_confidence_impact NUMERIC(5,4) NOT NULL DEFAULT 0,
  avg_risk_reduction    NUMERIC(5,4) NOT NULL DEFAULT 0,
  summary               TEXT NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pathway_key)
);
CREATE INDEX IF NOT EXISTS idx_pil_path_archetype ON pil_growth_pathways(archetype_key);

-- ── 5) action-plan templates (copy-ready time-boxed plan) ─────────────────────
CREATE TABLE IF NOT EXISTS pil_action_plan_templates (
  template_id      SERIAL PRIMARY KEY,
  template_key     TEXT NOT NULL,
  archetype_id     INTEGER NOT NULL,
  archetype_key    TEXT NOT NULL,
  archetype_name   TEXT NOT NULL DEFAULT '',
  stakeholder_type TEXT NOT NULL,
  problem_id       INTEGER NOT NULL,
  plan_title       TEXT NOT NULL,
  step_immediate   TEXT NOT NULL DEFAULT '',
  step_week        TEXT NOT NULL DEFAULT '',
  step_month       TEXT NOT NULL DEFAULT '',
  step_quarter     TEXT NOT NULL DEFAULT '',
  total_days       SMALLINT NOT NULL DEFAULT 90,
  avg_composite    NUMERIC(4,2) NOT NULL DEFAULT 0,
  is_duplicate     BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_key)
);
CREATE INDEX IF NOT EXISTS idx_pil_plan_archetype ON pil_action_plan_templates(archetype_key);
