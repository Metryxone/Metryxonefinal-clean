-- Phase 3.4 — EI Profile History (candidate Employability Profile snapshots).
-- Append-only point-in-time captures of buildEiProfile() output. Mirrored by the
-- lazy ensureEiProfileHistorySchema() in services/ei-profile-history.ts (no
-- migration runner — the lazy ensure-schema is the live path; this file is the
-- canonical reference). Additive / reversible: drop the table → unchanged.

CREATE TABLE IF NOT EXISTS ei_profile_snapshots (
  id                SERIAL PRIMARY KEY,
  subject_id        VARCHAR(160) NOT NULL,
  role_id           VARCHAR(160),
  measurable        BOOLEAN      NOT NULL DEFAULT false,
  ei_score          NUMERIC(6,2),
  ei_band           VARCHAR(40),
  coverage_pct      NUMERIC(6,2),
  confidence_score  NUMERIC(6,2),
  confidence_band   VARCHAR(20),
  strength_count    INT          NOT NULL DEFAULT 0,
  development_count INT          NOT NULL DEFAULT 0,
  risk_count        INT          NOT NULL DEFAULT 0,
  growth_level      VARCHAR(20),
  engine_version    VARCHAR(40)  NOT NULL,
  profile           JSONB        NOT NULL,
  captured_by       VARCHAR(160),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eips_subject ON ei_profile_snapshots (subject_id, created_at DESC);
