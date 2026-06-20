-- PHASE 4.9 — Career Passport Foundation: append-only passport snapshots.
--
-- Additive + flag-gated. This DDL is reached ONLY behind the
-- `careerPassportFoundation` flag (env FF_CAREER_PASSPORT_FOUNDATION, default
-- OFF) via the explicit POST /api/career-passport/:subject/snapshot path. A
-- lazy `ensureCareerPassportSnapshotSchema()` (passport-generator.ts) mirrors
-- this file exactly (no migration runner). Flag-OFF => this table is never
-- created and every /api/career-passport/* route returns 503 (byte-identical).
--
-- Distinct from the EXISTING Career Passport subsystem (cp_* tables, flag
-- `careerPassport`, /api/passport/*). This is a read-only COMPOSITION snapshot
-- of already-computed engine outputs (competency / EI / readiness / etc.),
-- NOT the user-editable cp_* portfolio.
--
-- Append-only: each POST inserts ONE row; rows are never mutated in place.

CREATE TABLE IF NOT EXISTS career_passport_snapshots (
  id                    BIGSERIAL PRIMARY KEY,
  subject_id            TEXT NOT NULL,
  sections_total        INTEGER NOT NULL DEFAULT 0,
  sections_present      INTEGER NOT NULL DEFAULT 0,
  coverage_pct          NUMERIC,
  measurable            BOOLEAN NOT NULL DEFAULT FALSE,
  competency_present    BOOLEAN NOT NULL DEFAULT FALSE,
  ei_present            BOOLEAN NOT NULL DEFAULT FALSE,
  career_profile_present BOOLEAN NOT NULL DEFAULT FALSE,
  readiness_present     BOOLEAN NOT NULL DEFAULT FALSE,
  achievements_count    INTEGER NOT NULL DEFAULT 0,
  journey_events        INTEGER NOT NULL DEFAULT 0,
  snapshot              JSONB NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_passport_snapshots_subject
  ON career_passport_snapshots (subject_id, created_at DESC);
