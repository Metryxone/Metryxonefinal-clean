-- ============================================================
-- MetryxOne — Reference Intelligence Foundation (Phase 1 of EI)
-- Migration: 20260520_reference_intelligence.sql
--
-- Canonical reference data for Employability Index:
--   institutions, qualifications, certifications, skills, occupations
-- + aliases, rankings, accreditations, provenance & admin audit
--
-- All keyword/heuristic logic in the EI scoring engine continues to work
-- unchanged. This migration ONLY adds new tables. No existing column
-- is altered, no existing data is touched.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Provenance ───────────────────────────────────────────────
-- Every classification / ranking / accreditation row carries a
-- provenance pointer so the EI breakdown can cite its source.
CREATE TABLE IF NOT EXISTS provenance_records (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type           TEXT NOT NULL,            -- 'institution' | 'qualification' | 'certification' | 'skill' | 'occupation' | 'ranking' | 'accreditation'
  entity_id             UUID,
  source_authority      TEXT NOT NULL,            -- 'UGC' | 'AICTE' | 'NIRF' | 'NAAC' | 'NBA' | 'QS' | 'THE' | 'ARWU' | 'ESCO' | 'ONET' | 'NSDC' | 'CREDLY' | 'DIGILOCKER' | 'ICAI' | ...
  source_url            TEXT,
  source_snapshot_date  DATE,
  extracted_value       JSONB,                    -- raw payload from source for audit
  confidence_score      NUMERIC(4,3) DEFAULT 1.000 CHECK (confidence_score BETWEEN 0 AND 1),
  last_verified_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provenance_entity        ON provenance_records(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_provenance_authority     ON provenance_records(source_authority);
CREATE INDEX IF NOT EXISTS idx_provenance_verified_at   ON provenance_records(last_verified_at DESC);

-- ── Admin Audit Logs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_admin_audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id   TEXT,
  admin_email     TEXT,
  action_type     TEXT NOT NULL,                  -- 'create' | 'update' | 'delete' | 'merge' | 'override_tier' | 'seed' | 'bulk_import' | 'resolve_review'
  entity_type     TEXT NOT NULL,                  -- 'institution' | 'qualification' | ...
  entity_id       UUID,
  previous_value  JSONB,
  new_value       JSONB,
  reason          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ref_audit_entity   ON ref_admin_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ref_audit_admin    ON ref_admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_ref_audit_created  ON ref_admin_audit_logs(created_at DESC);

-- ── Institutions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS institutions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_name        TEXT NOT NULL,
  short_name            TEXT,
  institution_type      TEXT,                     -- 'university' | 'engineering_college' | 'business_school' | 'medical_college' | 'law_school' | 'iit' | 'iim' | 'nit' | 'iiit' | 'school' | 'board' | 'professional_body' | 'other'
  country_code          TEXT DEFAULT 'IN',        -- ISO-2
  state                 TEXT,
  city                  TEXT,
  established_year      INTEGER,
  website               TEXT,
  tier_computed         SMALLINT,                 -- 1 | 2 | 3 derived from rankings/accreditations
  tier_basis            JSONB,                    -- explainability: {"nirf":4,"naac":"A++","qs":172}
  tier_overridden       BOOLEAN DEFAULT FALSE,
  tier_override_reason  TEXT,
  is_active             BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (canonical_name, country_code)
);
CREATE INDEX IF NOT EXISTS idx_institutions_name_trgm
  ON institutions USING gin (canonical_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_institutions_short_trgm
  ON institutions USING gin (short_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_institutions_type       ON institutions(institution_type);
CREATE INDEX IF NOT EXISTS idx_institutions_country    ON institutions(country_code);
CREATE INDEX IF NOT EXISTS idx_institutions_tier       ON institutions(tier_computed);
CREATE INDEX IF NOT EXISTS idx_institutions_active     ON institutions(is_active);

CREATE TABLE IF NOT EXISTS institution_aliases (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id    UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  alias_name        TEXT NOT NULL,
  alias_type        TEXT DEFAULT 'common',        -- 'common' | 'abbreviation' | 'former_name' | 'misspelling' | 'local_language'
  confidence_score  NUMERIC(4,3) DEFAULT 1.000,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (institution_id, alias_name)
);
CREATE INDEX IF NOT EXISTS idx_inst_aliases_inst       ON institution_aliases(institution_id);
CREATE INDEX IF NOT EXISTS idx_inst_aliases_name_trgm
  ON institution_aliases USING gin (alias_name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS institution_rankings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id      UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  ranking_source      TEXT NOT NULL,              -- 'NIRF' | 'QS' | 'THE' | 'ARWU' | 'FT'
  ranking_category    TEXT,                       -- 'Overall' | 'Engineering' | 'Management' | 'Medical' | 'Law' | 'University' | 'College'
  ranking_year        INTEGER NOT NULL,
  ranking_value       INTEGER,                    -- rank position; lower is better
  ranking_percentile  NUMERIC(5,2),               -- 0..100, higher is better
  source_url          TEXT,
  provenance_id       UUID REFERENCES provenance_records(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (institution_id, ranking_source, ranking_category, ranking_year)
);
CREATE INDEX IF NOT EXISTS idx_inst_rankings_inst      ON institution_rankings(institution_id);
CREATE INDEX IF NOT EXISTS idx_inst_rankings_src_year  ON institution_rankings(ranking_source, ranking_year DESC);

CREATE TABLE IF NOT EXISTS institution_accreditations (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id           UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  accreditation_authority  TEXT NOT NULL,         -- 'UGC' | 'AICTE' | 'NAAC' | 'NBA' | 'NMC' | 'BCI' | 'ICAR' | 'PCI' | 'COA' | 'INC'
  accreditation_grade      TEXT,                  -- 'A++' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'Recognised' | 'Approved' | 'Deemed'
  valid_from               DATE,
  valid_until              DATE,
  source_url               TEXT,
  provenance_id            UUID REFERENCES provenance_records(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (institution_id, accreditation_authority, valid_from)
);
CREATE INDEX IF NOT EXISTS idx_inst_accred_inst        ON institution_accreditations(institution_id);
CREATE INDEX IF NOT EXISTS idx_inst_accred_authority   ON institution_accreditations(accreditation_authority);

-- ── Qualifications (degrees) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS qualifications (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_name        TEXT NOT NULL,             -- 'Bachelor of Technology' | 'Master of Business Administration'
  short_name            TEXT,                      -- 'B.Tech' | 'MBA'
  qualification_type    TEXT NOT NULL,             -- 'doctorate' | 'masters' | 'bachelors' | 'diploma' | 'certificate' | 'school'
  nsqf_level            SMALLINT CHECK (nsqf_level BETWEEN 1 AND 10),  -- India NSQF
  eqf_level             SMALLINT CHECK (eqf_level BETWEEN 1 AND 8),    -- EU EQF
  regulator             TEXT,                      -- 'UGC' | 'AICTE' | 'NMC' | 'BCI' | 'ICAI' | 'NCTE' | 'COA' | 'PCI'
  field_of_study        TEXT,                      -- broad field
  duration_months       INTEGER,
  qualification_weight  NUMERIC(4,3) DEFAULT 0.65, -- multiplier used by EI scoring (0..1)
  is_active             BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (canonical_name)
);
CREATE INDEX IF NOT EXISTS idx_qual_name_trgm   ON qualifications USING gin (canonical_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_qual_short_trgm  ON qualifications USING gin (short_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_qual_type        ON qualifications(qualification_type);

CREATE TABLE IF NOT EXISTS qualification_aliases (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qualification_id  UUID NOT NULL REFERENCES qualifications(id) ON DELETE CASCADE,
  alias_name        TEXT NOT NULL,
  alias_type        TEXT DEFAULT 'common',
  confidence_score  NUMERIC(4,3) DEFAULT 1.000,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (qualification_id, alias_name)
);
CREATE INDEX IF NOT EXISTS idx_qual_aliases_qual       ON qualification_aliases(qualification_id);
CREATE INDEX IF NOT EXISTS idx_qual_aliases_name_trgm
  ON qualification_aliases USING gin (alias_name gin_trgm_ops);

-- ── Certifications ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certifications (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_name              TEXT NOT NULL,
  short_name                  TEXT,
  issuer_name                 TEXT NOT NULL,
  issuer_category             TEXT,                 -- 'cloud' | 'project_mgmt' | 'finance' | 'security' | 'hr' | 'analytics' | 'design' | 'dev' | 'data' | 'sales' | 'service_mgmt' | 'professional_body' | 'mooc' | 'other'
  market_recognition_score    NUMERIC(4,3) DEFAULT 0.500,  -- 0..1
  technical_depth_score       NUMERIC(4,3) DEFAULT 0.500,  -- 0..1
  tier                        TEXT DEFAULT 'mid',          -- 'top' | 'mid' | 'generic'  (computed)
  verification_supported      BOOLEAN DEFAULT FALSE,       -- can be verified via Credly/issuer API
  verification_method         TEXT,                        -- 'credly' | 'accredible' | 'issuer_api' | 'public_registry' | 'manual' | NULL
  verification_url            TEXT,
  validity_period_months      INTEGER,                     -- NULL = lifetime
  is_active                   BOOLEAN DEFAULT TRUE,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (canonical_name, issuer_name)
);
CREATE INDEX IF NOT EXISTS idx_certs_name_trgm    ON certifications USING gin (canonical_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_certs_issuer_trgm  ON certifications USING gin (issuer_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_certs_tier         ON certifications(tier);
CREATE INDEX IF NOT EXISTS idx_certs_category     ON certifications(issuer_category);

CREATE TABLE IF NOT EXISTS certification_aliases (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certification_id  UUID NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  alias_name        TEXT NOT NULL,
  alias_type        TEXT DEFAULT 'common',
  confidence_score  NUMERIC(4,3) DEFAULT 1.000,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (certification_id, alias_name)
);
CREATE INDEX IF NOT EXISTS idx_cert_aliases_cert      ON certification_aliases(certification_id);
CREATE INDEX IF NOT EXISTS idx_cert_aliases_name_trgm
  ON certification_aliases USING gin (alias_name gin_trgm_ops);

-- ── Skills ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skills (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_name           TEXT NOT NULL,
  skill_category           TEXT NOT NULL,         -- 'technical' | 'soft' | 'tool' | 'language' | 'domain'
  parent_skill_id          UUID REFERENCES skills(id) ON DELETE SET NULL,
  esco_uri                 TEXT,
  onet_code                TEXT,
  nsqf_code                TEXT,
  market_demand_score      NUMERIC(4,3) DEFAULT 0.500,
  future_relevance_score   NUMERIC(4,3) DEFAULT 0.500,
  is_active                BOOLEAN DEFAULT TRUE,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (canonical_name, skill_category)
);
CREATE INDEX IF NOT EXISTS idx_skills_name_trgm    ON skills USING gin (canonical_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_skills_category     ON skills(skill_category);
CREATE INDEX IF NOT EXISTS idx_skills_parent       ON skills(parent_skill_id);
CREATE INDEX IF NOT EXISTS idx_skills_esco         ON skills(esco_uri);

CREATE TABLE IF NOT EXISTS skill_aliases (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  skill_id          UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  alias_name        TEXT NOT NULL,
  alias_type        TEXT DEFAULT 'common',
  confidence_score  NUMERIC(4,3) DEFAULT 1.000,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (skill_id, alias_name)
);
CREATE INDEX IF NOT EXISTS idx_skill_aliases_skill      ON skill_aliases(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_aliases_name_trgm
  ON skill_aliases USING gin (alias_name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS skill_relationships (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_skill_id     UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  child_skill_id      UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  relationship_type   TEXT NOT NULL DEFAULT 'subskill',  -- 'subskill' | 'broader' | 'narrower' | 'related' | 'prerequisite' | 'tool_of'
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (parent_skill_id, child_skill_id, relationship_type),
  CHECK (parent_skill_id <> child_skill_id)
);
CREATE INDEX IF NOT EXISTS idx_skill_rel_parent  ON skill_relationships(parent_skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_rel_child   ON skill_relationships(child_skill_id);

-- ── Occupations ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS occupations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_title   TEXT NOT NULL,
  role_family       TEXT,                          -- 'engineering' | 'product' | 'data' | 'design' | 'finance' | 'hr' | 'sales' | 'marketing' | 'operations' | 'legal' | 'medical' | 'education' | 'consulting'
  seniority_level   TEXT,                          -- 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'manager' | 'director' | 'vp' | 'c_suite'
  seniority_weight  NUMERIC(4,3) DEFAULT 0.550,    -- EI multiplier used in experience scoring
  esco_code         TEXT,
  onet_code         TEXT,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (canonical_title)
);
CREATE INDEX IF NOT EXISTS idx_occ_title_trgm   ON occupations USING gin (canonical_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_occ_family       ON occupations(role_family);
CREATE INDEX IF NOT EXISTS idx_occ_seniority    ON occupations(seniority_level);

-- ── Review Queue (auto-detected unknown entities from user input) ─
CREATE TABLE IF NOT EXISTS ref_review_queue (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type     TEXT NOT NULL,                  -- 'institution' | 'qualification' | 'certification' | 'skill' | 'occupation'
  submitted_name  TEXT NOT NULL,
  context         JSONB,                          -- where it came from (user_id, profile section, etc.)
  suggested_match_id  UUID,                       -- closest fuzzy match
  suggested_match_score NUMERIC(4,3),
  status          TEXT DEFAULT 'pending',         -- 'pending' | 'merged' | 'created' | 'rejected'
  resolved_by     TEXT,
  resolved_at     TIMESTAMPTZ,
  resolution_note TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_queue_status      ON ref_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_review_queue_entity      ON ref_review_queue(entity_type);
CREATE INDEX IF NOT EXISTS idx_review_queue_created     ON ref_review_queue(created_at DESC);
