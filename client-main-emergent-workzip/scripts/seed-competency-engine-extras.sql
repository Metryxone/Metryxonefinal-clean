-- /app/scripts/seed-competency-engine-extras.sql
-- Adds the MISSING pieces per Career Intelligence Platform spec:
--   §10 Benchmark Engine — cohorts table
--   §14 Version Control   — competency_versions table
--   §2  Competency tag    — adds `tag` column to competencies
-- Idempotent.

BEGIN;

-- ─── §2: tag column on competencies ──────────────────────────────────────
ALTER TABLE competencies
  ADD COLUMN IF NOT EXISTS tag TEXT NOT NULL DEFAULT 'behavioral';
-- Backfill: copy competency_type into tag if tag is still 'behavioral' default
UPDATE competencies SET tag = competency_type WHERE tag = 'behavioral' AND competency_type IS NOT NULL;

-- ─── §10: cohorts table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cohorts (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  role_code       TEXT,                                   -- nullable: cohort can span all roles
  role_name       TEXT,
  experience_min  INTEGER NOT NULL DEFAULT 0,             -- years
  experience_max  INTEGER NOT NULL DEFAULT 99,
  location        TEXT,                                   -- e.g., "India", "Global", "APAC"
  industry        TEXT,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cohorts_role ON cohorts(role_code);
CREATE INDEX IF NOT EXISTS idx_cohorts_active ON cohorts(is_active);

-- Sensible default cohorts (Super Admin can edit/delete)
INSERT INTO cohorts (name, role_code, role_name, experience_min, experience_max, location, industry, notes) VALUES
  ('Fresher Engineers — Global',     'SDE',  'Software Engineer', 0, 1,  'Global', 'Tech',         'Entry-level software engineers, all locations'),
  ('Junior Engineers — India',       'SDE',  'Software Engineer', 1, 3,  'India',  'Tech',         '1–3 yrs experience SDEs in India'),
  ('Mid-level Engineers — Global',   'SDE',  'Software Engineer', 3, 7,  'Global', 'Tech',         '3–7 yrs experience'),
  ('Senior Engineers — Global',      'SDE',  'Software Engineer', 7, 15, 'Global', 'Tech',         '7–15 yrs experience'),
  ('Junior PMs — Global',            'PM',   'Product Manager',   0, 2,  'Global', 'Tech',         'APM and PM-1 cohort'),
  ('Senior PMs — Global',            'PM',   'Product Manager',   5, 15, 'Global', 'Tech',         'Senior + Group PM cohort'),
  ('Data Analysts — India',          'DA',   'Data Analyst',      0, 3,  'India',  'Data',         'Junior data analysts in India'),
  ('Sales BDR — APAC',               'SALES','Sales / BD',        0, 2,  'APAC',   'Sales',        'BDR/SDR cohort APAC'),
  ('Senior Sales — Global',          'SALES','Sales / BD',        5, 20, 'Global', 'Sales',        'Senior AEs and sales leadership')
ON CONFLICT DO NOTHING;

-- ─── §14: competency_versions table ──────────────────────────────────────
-- Captures snapshots of competency framework changes for audit + rollback
CREATE TABLE IF NOT EXISTS competency_versions (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  version         INTEGER NOT NULL,
  label           TEXT,                                   -- e.g. "Q1 2025 launch"
  notes           TEXT,
  changed_by      VARCHAR,                                -- user id
  change_summary  JSONB NOT NULL DEFAULT '{}'::jsonb,     -- {added: 5, modified: 3, removed: 1}
  snapshot        JSONB,                                  -- full snapshot for rollback
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_versions_created ON competency_versions(created_at DESC);

-- Initial version row
INSERT INTO competency_versions (version, label, notes, change_summary)
SELECT 1, 'v1.0 — Initial framework launch', 'Auto-created baseline', jsonb_build_object(
  'domains', (SELECT count(*) FROM competency_domains),
  'competencies', (SELECT count(*) FROM competencies),
  'stage_norms', (SELECT count(*) FROM stage_competency_norms),
  'role_weights', (SELECT count(*) FROM role_competency_weights)
)
WHERE NOT EXISTS (SELECT 1 FROM competency_versions WHERE version = 1);

COMMIT;
