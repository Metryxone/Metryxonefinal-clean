-- MX-203 — Enterprise Knowledge Population & Canonical Completion.
-- Additive canonical homes for THREE new expert-authored attribute types. These stay EMPTY
-- until a human approves a draft (mx202b-content-approval.approveContentDraft is the only
-- promotion path). Mirrors backend/services/mx203-content-schema.ts (lazy ensure-schema).
-- Fully reversible: DROP TABLE ... restores byte-identical prior state. No existing table altered.

CREATE TABLE IF NOT EXISTS onto_competency_coaching_guidance (
  id                BIGSERIAL PRIMARY KEY,
  competency_id     TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  proficiency_level INT NOT NULL DEFAULT 0 CHECK (proficiency_level BETWEEN 0 AND 5),
  guidance          TEXT NOT NULL,
  provenance        TEXT NOT NULL DEFAULT 'rule_based',
  source            TEXT NOT NULL DEFAULT 'mx203',
  lifecycle         TEXT NOT NULL DEFAULT 'approved',
  draft_id          BIGINT REFERENCES onto_competency_content_drafts(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_occg_comp ON onto_competency_coaching_guidance (competency_id);

CREATE TABLE IF NOT EXISTS onto_competency_interview_guidance (
  id                BIGSERIAL PRIMARY KEY,
  competency_id     TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  proficiency_level INT NOT NULL DEFAULT 0 CHECK (proficiency_level BETWEEN 0 AND 5),
  guidance          TEXT NOT NULL,
  provenance        TEXT NOT NULL DEFAULT 'rule_based',
  source            TEXT NOT NULL DEFAULT 'mx203',
  lifecycle         TEXT NOT NULL DEFAULT 'approved',
  draft_id          BIGINT REFERENCES onto_competency_content_drafts(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ociv_comp ON onto_competency_interview_guidance (competency_id);

CREATE TABLE IF NOT EXISTS onto_competency_development_activity (
  id                BIGSERIAL PRIMARY KEY,
  competency_id     TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  proficiency_level INT NOT NULL DEFAULT 0 CHECK (proficiency_level BETWEEN 0 AND 5),
  activity          TEXT NOT NULL,
  provenance        TEXT NOT NULL DEFAULT 'rule_based',
  source            TEXT NOT NULL DEFAULT 'mx203',
  lifecycle         TEXT NOT NULL DEFAULT 'approved',
  draft_id          BIGINT REFERENCES onto_competency_content_drafts(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ocda_comp ON onto_competency_development_activity (competency_id);
