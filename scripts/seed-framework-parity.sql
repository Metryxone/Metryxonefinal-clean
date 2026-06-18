-- /app/scripts/seed-framework-parity.sql
-- Replicates Professional Competency Framework architecture for LBI & SDI.
-- Adds: clusters, subdomain norms, stage/age-band weights, versions, learning mappings, user responses.
-- Idempotent — safe to re-run.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- LBI BEHAVIOURAL — PARITY TABLES
-- ═══════════════════════════════════════════════════════════════════════

-- §3 Clusters
CREATE TABLE IF NOT EXISTS lbi_clusters (
  id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lbi_cluster_map (
  cluster_id     VARCHAR NOT NULL REFERENCES lbi_clusters(id) ON DELETE CASCADE,
  subdomain_code TEXT NOT NULL REFERENCES lbi_subdomains(subdomain_code) ON DELETE CASCADE,
  PRIMARY KEY (cluster_id, subdomain_code)
);

-- §5 Subdomain Norms (per age band × subdomain)
CREATE TABLE IF NOT EXISTS lbi_subdomain_norms (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  age_band_code   TEXT NOT NULL,
  subdomain_code  TEXT NOT NULL REFERENCES lbi_subdomains(subdomain_code) ON DELETE CASCADE,
  min_score       REAL NOT NULL DEFAULT 0,
  median_score    REAL NOT NULL DEFAULT 50,
  top10_score     REAL NOT NULL DEFAULT 100,
  UNIQUE (age_band_code, subdomain_code)
);
CREATE INDEX IF NOT EXISTS idx_lbi_norms_band ON lbi_subdomain_norms(age_band_code);

-- §6 Age-Band Weights (each subdomain weighted differently per age band)
CREATE TABLE IF NOT EXISTS lbi_age_band_weights (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  age_band_code   TEXT NOT NULL,
  subdomain_code  TEXT NOT NULL REFERENCES lbi_subdomains(subdomain_code) ON DELETE CASCADE,
  weight          REAL NOT NULL DEFAULT 1,
  weight_type     TEXT NOT NULL DEFAULT 'core',  -- core / differentiator / supporting
  UNIQUE (age_band_code, subdomain_code)
);

-- §14 Versions
CREATE TABLE IF NOT EXISTS lbi_versions (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  version         INTEGER NOT NULL,
  label           TEXT,
  notes           TEXT,
  changed_by      VARCHAR,
  change_summary  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);

-- §12 Learning Mappings (IDP)
CREATE TABLE IF NOT EXISTS lbi_learning_mappings (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  subdomain_code  TEXT NOT NULL REFERENCES lbi_subdomains(subdomain_code) ON DELETE CASCADE,
  level           INTEGER NOT NULL DEFAULT 3,
  action_type     TEXT,
  title           TEXT,
  resource_link   TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════
-- SDI — PARITY TABLES (full architecture)
-- ═══════════════════════════════════════════════════════════════════════

-- Stages (school stages: K-12 + UG + Working)
CREATE TABLE IF NOT EXISTS sdi_stages (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_code      TEXT UNIQUE NOT NULL,
  stage_name      TEXT NOT NULL,
  min_grade       INTEGER,                  -- 1, 6, 9, 11, NULL for UG/working
  max_grade       INTEGER,
  description     TEXT,
  display_order   INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- §3 Clusters
CREATE TABLE IF NOT EXISTS sdi_clusters (
  id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sdi_cluster_map (
  cluster_id     VARCHAR NOT NULL REFERENCES sdi_clusters(id) ON DELETE CASCADE,
  subdomain_code TEXT NOT NULL REFERENCES sdi_subdomains(subdomain_code) ON DELETE CASCADE,
  PRIMARY KEY (cluster_id, subdomain_code)
);

-- §5 Subdomain Norms (per stage × subdomain)
CREATE TABLE IF NOT EXISTS sdi_subdomain_norms (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_code      TEXT NOT NULL,
  subdomain_code  TEXT NOT NULL REFERENCES sdi_subdomains(subdomain_code) ON DELETE CASCADE,
  min_score       REAL NOT NULL DEFAULT 0,
  median_score    REAL NOT NULL DEFAULT 50,
  top10_score     REAL NOT NULL DEFAULT 100,
  UNIQUE (stage_code, subdomain_code)
);
CREATE INDEX IF NOT EXISTS idx_sdi_norms_stage ON sdi_subdomain_norms(stage_code);

-- §6 Stage Weights
CREATE TABLE IF NOT EXISTS sdi_stage_weights (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_code      TEXT NOT NULL,
  subdomain_code  TEXT NOT NULL REFERENCES sdi_subdomains(subdomain_code) ON DELETE CASCADE,
  weight          REAL NOT NULL DEFAULT 1,
  weight_type     TEXT NOT NULL DEFAULT 'core',
  UNIQUE (stage_code, subdomain_code)
);

-- §14 Versions
CREATE TABLE IF NOT EXISTS sdi_versions (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  version         INTEGER NOT NULL,
  label           TEXT,
  notes           TEXT,
  changed_by      VARCHAR,
  change_summary  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);

-- §12 Learning Mappings
CREATE TABLE IF NOT EXISTS sdi_learning_mappings (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  subdomain_code  TEXT NOT NULL REFERENCES sdi_subdomains(subdomain_code) ON DELETE CASCADE,
  level           INTEGER NOT NULL DEFAULT 3,
  action_type     TEXT,
  title           TEXT,
  resource_link   TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);

-- User Responses
CREATE TABLE IF NOT EXISTS sdi_user_responses (
  id             VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        VARCHAR NOT NULL,
  item_id        INTEGER NOT NULL REFERENCES sdi_items(id) ON DELETE CASCADE,
  option_id      INTEGER REFERENCES sdi_item_options(id) ON DELETE SET NULL,
  score_obtained REAL,
  time_taken     INTEGER,
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sdi_resp_user ON sdi_user_responses(user_id);

-- ═══════════════════════════════════════════════════════════════════════
-- DEFAULT SEEDS — sensible starting points
-- ═══════════════════════════════════════════════════════════════════════

-- SDI Stages (K-12 + UG + Working)
INSERT INTO sdi_stages (stage_code, stage_name, min_grade, max_grade, description, display_order) VALUES
  ('PRIMARY',  'Primary School',     1,  5,  'Grades 1–5: foundational stage',          1),
  ('MIDDLE',   'Middle School',      6,  8,  'Grades 6–8: identity and exploration',     2),
  ('HIGH',     'High School',        9, 10,  'Grades 9–10: pre-board prep',              3),
  ('SR_HIGH',  'Senior High',       11, 12,  'Grades 11–12: board exam + career',        4),
  ('UG',       'Undergraduate',    NULL, NULL,'College — career readiness',              5),
  ('WORKING',  'Working Professional', NULL, NULL, 'Post-graduation, in workforce',     6)
ON CONFLICT (stage_code) DO UPDATE SET
  stage_name = EXCLUDED.stage_name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

-- LBI subdomain norms (6 age bands × 97 subdomains = 582 rows)
INSERT INTO lbi_subdomain_norms (age_band_code, subdomain_code, min_score, median_score, top10_score)
SELECT b.code, s.subdomain_code,
       CASE b.code WHEN 'AB1' THEN 25 WHEN 'AB2' THEN 30 WHEN 'AB3' THEN 35 WHEN 'AB4' THEN 40 WHEN 'AB5' THEN 45 ELSE 50 END,
       CASE b.code WHEN 'AB1' THEN 50 WHEN 'AB2' THEN 55 WHEN 'AB3' THEN 60 WHEN 'AB4' THEN 65 WHEN 'AB5' THEN 70 ELSE 72 END,
       CASE b.code WHEN 'AB1' THEN 80 WHEN 'AB2' THEN 82 WHEN 'AB3' THEN 85 WHEN 'AB4' THEN 88 WHEN 'AB5' THEN 90 ELSE 92 END
FROM lbi_subdomains s
CROSS JOIN (VALUES ('AB1'),('AB2'),('AB3'),('AB4'),('AB5'),('AB6')) AS b(code)
ON CONFLICT (age_band_code, subdomain_code) DO NOTHING;

-- LBI age band weights (default 1.0 each — Super Admin tunes)
INSERT INTO lbi_age_band_weights (age_band_code, subdomain_code, weight, weight_type)
SELECT b.code, s.subdomain_code, 1.0, 'core'
FROM lbi_subdomains s
CROSS JOIN (VALUES ('AB1'),('AB2'),('AB3'),('AB4'),('AB5'),('AB6')) AS b(code)
ON CONFLICT (age_band_code, subdomain_code) DO NOTHING;

-- LBI v1 baseline
INSERT INTO lbi_versions (version, label, notes, change_summary)
SELECT 1, 'v1.0 — LBI baseline', 'Auto-created with parity migration',
  jsonb_build_object(
    'domains',(SELECT count(*) FROM lbi_domains),
    'subdomains',(SELECT count(*) FROM lbi_subdomains),
    'age_bands',(SELECT count(*) FROM lbi_age_bands),
    'norms',(SELECT count(*) FROM lbi_subdomain_norms),
    'weights',(SELECT count(*) FROM lbi_age_band_weights)
  )
WHERE NOT EXISTS (SELECT 1 FROM lbi_versions WHERE version = 1);

-- SDI subdomain norms (6 stages × 54 subdomains = 324 rows)
INSERT INTO sdi_subdomain_norms (stage_code, subdomain_code, min_score, median_score, top10_score)
SELECT st.stage_code, s.subdomain_code,
       CASE st.stage_code WHEN 'PRIMARY' THEN 25 WHEN 'MIDDLE' THEN 30 WHEN 'HIGH' THEN 35 WHEN 'SR_HIGH' THEN 40 WHEN 'UG' THEN 45 ELSE 50 END,
       CASE st.stage_code WHEN 'PRIMARY' THEN 50 WHEN 'MIDDLE' THEN 55 WHEN 'HIGH' THEN 60 WHEN 'SR_HIGH' THEN 65 WHEN 'UG' THEN 70 ELSE 75 END,
       CASE st.stage_code WHEN 'PRIMARY' THEN 80 WHEN 'MIDDLE' THEN 82 WHEN 'HIGH' THEN 85 WHEN 'SR_HIGH' THEN 88 WHEN 'UG' THEN 90 ELSE 93 END
FROM sdi_subdomains s, sdi_stages st
ON CONFLICT (stage_code, subdomain_code) DO NOTHING;

-- SDI stage weights (default 1.0 each)
INSERT INTO sdi_stage_weights (stage_code, subdomain_code, weight, weight_type)
SELECT st.stage_code, s.subdomain_code, 1.0, 'core'
FROM sdi_subdomains s, sdi_stages st
ON CONFLICT (stage_code, subdomain_code) DO NOTHING;

-- SDI v1 baseline
INSERT INTO sdi_versions (version, label, notes, change_summary)
SELECT 1, 'v1.0 — SDI baseline', 'Auto-created with parity migration',
  jsonb_build_object(
    'domains',(SELECT count(*) FROM sdi_domains),
    'subdomains',(SELECT count(*) FROM sdi_subdomains),
    'stages',(SELECT count(*) FROM sdi_stages),
    'norms',(SELECT count(*) FROM sdi_subdomain_norms),
    'weights',(SELECT count(*) FROM sdi_stage_weights)
  )
WHERE NOT EXISTS (SELECT 1 FROM sdi_versions WHERE version = 1);

COMMIT;
