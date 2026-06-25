-- MX-202B — Competency content completion: canonical homes + governed-draft staging.
-- Additive, reversible (all MX-202B rows carry source='mx202b'). Byte-identical OFF:
-- these are NEW tables; no existing reader touches them, and canonical homes stay EMPTY
-- until a human approval promotes a draft. Reuses onto_audit_logs + onto_competency_versions
-- (NO new audit/version engine).

-- ── 1. Governed-draft staging (ONE table for all authorable depth attributes) ──
-- Drafts live here with full lifecycle. Nothing here is "live"; approval promotes into the
-- canonical homes below. proficiency_level 0 = whole-competency (non-level-specific).
CREATE TABLE IF NOT EXISTS onto_competency_content_drafts (
  id               BIGSERIAL PRIMARY KEY,
  competency_id    TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  attribute_type   TEXT NOT NULL,           -- behavioural_indicator | proficiency_anchor | evidence_requirement | learning_outcome | function_map | industry_map | department_map | observable_behaviour | role_relevance
  proficiency_level INT NOT NULL DEFAULT 0 CHECK (proficiency_level BETWEEN 0 AND 5),
  content          JSONB NOT NULL,          -- structured payload
  content_text     TEXT,                    -- human-readable rendering for review
  provenance       TEXT NOT NULL DEFAULT 'rule_based', -- rule_based | onet | ai | sme | imported
  confidence       NUMERIC,                 -- 0..1; NULL = not scored (never coerce to 0)
  confidence_band  TEXT,                    -- low | medium | high
  version          INT NOT NULL DEFAULT 1,
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','in_review','approved','rejected','archived')),
  needs_review     BOOLEAN NOT NULL DEFAULT TRUE,
  generator        TEXT,                    -- e.g. mx202b-rule-v1
  source           TEXT NOT NULL DEFAULT 'mx202b',
  reviewed_by      TEXT,
  reviewed_at      TIMESTAMPTZ,
  review_notes     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_occd_dedup
  ON onto_competency_content_drafts (competency_id, attribute_type, proficiency_level, source);
CREATE INDEX IF NOT EXISTS ix_occd_comp   ON onto_competency_content_drafts (competency_id);
CREATE INDEX IF NOT EXISTS ix_occd_attr   ON onto_competency_content_drafts (attribute_type);
CREATE INDEX IF NOT EXISTS ix_occd_status ON onto_competency_content_drafts (status);

-- ── 2. Canonical homes for previously-absent attributes (hold APPROVED content) ──
CREATE TABLE IF NOT EXISTS onto_competency_evidence (
  id               BIGSERIAL PRIMARY KEY,
  competency_id    TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  proficiency_level INT NOT NULL DEFAULT 0 CHECK (proficiency_level BETWEEN 0 AND 5),
  evidence         TEXT NOT NULL,
  evidence_type    TEXT,                    -- artifact | observation | assessment | attestation
  provenance       TEXT NOT NULL DEFAULT 'rule_based',
  source           TEXT NOT NULL DEFAULT 'mx202b',
  draft_id         BIGINT REFERENCES onto_competency_content_drafts(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_oce_comp ON onto_competency_evidence (competency_id);

CREATE TABLE IF NOT EXISTS onto_competency_learning_outcomes (
  id               BIGSERIAL PRIMARY KEY,
  competency_id    TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  proficiency_level INT NOT NULL DEFAULT 0 CHECK (proficiency_level BETWEEN 0 AND 5),
  outcome          TEXT NOT NULL,
  bloom_level      TEXT,
  provenance       TEXT NOT NULL DEFAULT 'rule_based',
  source           TEXT NOT NULL DEFAULT 'mx202b',
  draft_id         BIGINT REFERENCES onto_competency_content_drafts(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_oclo_comp ON onto_competency_learning_outcomes (competency_id);

CREATE TABLE IF NOT EXISTS onto_competency_function_map (
  id               BIGSERIAL PRIMARY KEY,
  competency_id    TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  function_id      TEXT,
  function_name    TEXT NOT NULL,
  relevance        NUMERIC,
  provenance       TEXT NOT NULL DEFAULT 'rule_based',
  source           TEXT NOT NULL DEFAULT 'mx202b',
  draft_id         BIGINT REFERENCES onto_competency_content_drafts(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ocfm_comp ON onto_competency_function_map (competency_id);

CREATE TABLE IF NOT EXISTS onto_competency_industry_map (
  id               BIGSERIAL PRIMARY KEY,
  competency_id    TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  industry_id      TEXT,
  industry_name    TEXT NOT NULL,
  relevance        NUMERIC,
  provenance       TEXT NOT NULL DEFAULT 'rule_based',
  source           TEXT NOT NULL DEFAULT 'mx202b',
  draft_id         BIGINT REFERENCES onto_competency_content_drafts(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ocim_comp ON onto_competency_industry_map (competency_id);

CREATE TABLE IF NOT EXISTS onto_competency_department_map (
  id               BIGSERIAL PRIMARY KEY,
  competency_id    TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  department_name  TEXT NOT NULL,
  relevance        NUMERIC,
  provenance       TEXT NOT NULL DEFAULT 'rule_based',
  source           TEXT NOT NULL DEFAULT 'mx202b',
  draft_id         BIGINT REFERENCES onto_competency_content_drafts(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ocdm_comp ON onto_competency_department_map (competency_id);

-- ── 3. Controlled Enterprise Activation — Verified lifecycle (additive, reversible) ──
-- Founder directive (MX-202B Controlled Enterprise Activation): source-backed FACTUAL
-- knowledge is governed independently from expert-authored/interpretive knowledge.
--   governance_track = 'factual'         → draft → VERIFIED (deterministic auto-promote, no
--                                           human judgement) for provenance-verified content.
--   governance_track = 'expert_authored' → draft → APPROVED (human gate). Default for ALL
--                                           rule_based/ai/behavioural/evidence/learning content.
-- Nothing auto-promotes unless provenance is source-backed AND attribute is factual-class.
-- Fully reversible (status returns to 'draft'; promoted rows carry lifecycle='verified').
ALTER TABLE onto_competency_content_drafts ADD COLUMN IF NOT EXISTS governance_track TEXT NOT NULL DEFAULT 'expert_authored';
ALTER TABLE onto_competency_content_drafts ADD COLUMN IF NOT EXISTS verified_by TEXT;
ALTER TABLE onto_competency_content_drafts ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE onto_competency_content_drafts DROP CONSTRAINT IF EXISTS onto_competency_content_drafts_status_check;
ALTER TABLE onto_competency_content_drafts ADD CONSTRAINT onto_competency_content_drafts_status_check
  CHECK (status IN ('draft','in_review','verified','approved','rejected','archived'));

-- lifecycle marker on canonical homes: distinguishes HOW a row went live (verified vs approved).
ALTER TABLE onto_competency_evidence          ADD COLUMN IF NOT EXISTS lifecycle TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE onto_competency_learning_outcomes ADD COLUMN IF NOT EXISTS lifecycle TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE onto_competency_function_map      ADD COLUMN IF NOT EXISTS lifecycle TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE onto_competency_industry_map      ADD COLUMN IF NOT EXISTS lifecycle TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE onto_competency_department_map    ADD COLUMN IF NOT EXISTS lifecycle TEXT NOT NULL DEFAULT 'approved';
