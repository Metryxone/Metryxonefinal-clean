-- CAPADEX Problem Intelligence Layer (PIL) — Phase 1: Concern Classification.
--
-- EXTENSION-ONLY. Adds a single new table that classifies every concern in
-- `capadex_concerns_master` into one primary category. Touches no existing
-- CAPADEX data. Canonical mirror of the lazy CREATE TABLE IF NOT EXISTS the
-- runner (`backend/scripts/pil/run-concern-classification.ts`) applies, so the
-- script self-bootstraps whether or not this migration has run.

CREATE TABLE IF NOT EXISTS concern_classification (
  id               SERIAL PRIMARY KEY,
  concern_id       TEXT NOT NULL,
  concern_name     TEXT NOT NULL,
  classification   TEXT NOT NULL
    CHECK (classification IN ('Capability','Problem','Behavior','Trait','Outcome','Risk')),
  confidence_score NUMERIC(5,4) NOT NULL
    CHECK (confidence_score >= 0 AND confidence_score <= 1),
  reasoning        TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One classification row per concern → enables idempotent upsert re-runs.
CREATE UNIQUE INDEX IF NOT EXISTS concern_classification_concern_id_key
  ON concern_classification (concern_id);

CREATE INDEX IF NOT EXISTS concern_classification_classification_idx
  ON concern_classification (classification);
