-- MX-302E — Campus Placement & Company Intelligence (net-new substrate).
--
-- Strictly additive + flag-gated (campusPlacement / FF_CAMPUS_PLACEMENT, default OFF).
-- These tables are created ONLY on the flag-ON path (the route handlers call
-- ensureCampusPlacementSchema after flagGate passes). With the flag OFF the DDL
-- is never reached, so the database is byte-identical to legacy.
--
-- Honesty / isolation contracts encoded here:
--   - Company / drive / internship / graduate-program / calendar rows are
--     TENANT-SCOPED via tenant_id (NULL = platform-global / curated). Student
--     reads only return published/active rows.
--   - Student personal rows (campus_applications, offers, campus_student_profiles)
--     are USER-SCOPED via user_id (varchar, mirrors users.id).
--   - CTC / stipend money columns are NULLABLE — null ≠ 0. A missing figure is
--     never stored as 0 and never fabricated.
--   - Eligibility criteria are explicit columns; a NULL criterion means
--     "no constraint" and an absent student field means "insufficient data"
--     (evaluated in the engine, never silently passed).

-- ── Companies (anchor entity for the Company Explorer) ──────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT,
  industry      TEXT,
  website       TEXT,
  description   TEXT,
  hq_location   TEXT,
  size_band     TEXT,                       -- e.g. startup / mid / large / enterprise
  tenant_id     TEXT,                       -- owning tenant; NULL = platform-global
  created_by    TEXT,
  status        TEXT DEFAULT 'active',      -- active / archived
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_companies_tenant ON companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug) WHERE slug IS NOT NULL;

-- ── Campus drives (recruitment events at a company) ─────────────────────────
CREATE TABLE IF NOT EXISTS campus_drives (
  id                     TEXT PRIMARY KEY,
  company_id             TEXT REFERENCES companies(id) ON DELETE CASCADE,
  title                  TEXT NOT NULL,
  role_title             TEXT,
  drive_type             TEXT DEFAULT 'full_time',  -- full_time / internship / ppo
  location               TEXT,
  work_mode              TEXT,                       -- onsite / remote / hybrid
  ctc_min                NUMERIC(14,2),              -- nullable: null ≠ 0
  ctc_max                NUMERIC(14,2),
  stipend                NUMERIC(14,2),              -- for internship drives
  currency               TEXT DEFAULT 'INR',
  positions              INTEGER,
  drive_date             DATE,
  registration_deadline  DATE,
  description            TEXT,
  -- explicit eligibility criteria (NULL = no constraint)
  eligibility_cgpa       NUMERIC(4,2),
  eligibility_branches   JSONB,                      -- array of branch strings
  eligibility_max_backlogs INTEGER,
  eligibility_batch_years  JSONB,                    -- array of int years
  tenant_id              TEXT,
  created_by             TEXT,
  status                 TEXT DEFAULT 'draft',       -- draft / published / closed
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drives_company ON campus_drives(company_id);
CREATE INDEX IF NOT EXISTS idx_drives_tenant ON campus_drives(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drives_status ON campus_drives(status);
CREATE INDEX IF NOT EXISTS idx_drives_date ON campus_drives(drive_date);

-- ── Internship marketplace ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS internships (
  id              TEXT PRIMARY KEY,
  company_id      TEXT REFERENCES companies(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  domain          TEXT,
  location        TEXT,
  work_mode       TEXT,
  stipend_min     NUMERIC(14,2),
  stipend_max     NUMERIC(14,2),
  currency        TEXT DEFAULT 'INR',
  duration_months INTEGER,
  ppo_available   BOOLEAN DEFAULT false,      -- pre-placement offer possible
  positions       INTEGER,
  apply_deadline  DATE,
  description      TEXT,
  tenant_id       TEXT,
  created_by      TEXT,
  status          TEXT DEFAULT 'active',       -- active / closed
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_internships_company ON internships(company_id);
CREATE INDEX IF NOT EXISTS idx_internships_tenant ON internships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_internships_status ON internships(status);

-- ── Graduate programs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS graduate_programs (
  id              TEXT PRIMARY KEY,
  company_id      TEXT REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  program_type    TEXT,                        -- GET / management-trainee / leadership
  domain          TEXT,
  location        TEXT,
  duration_months INTEGER,
  ctc_min         NUMERIC(14,2),
  ctc_max         NUMERIC(14,2),
  currency        TEXT DEFAULT 'INR',
  eligibility     TEXT,
  intake          INTEGER,
  apply_deadline  DATE,
  description     TEXT,
  tenant_id       TEXT,
  created_by      TEXT,
  status          TEXT DEFAULT 'active',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gradprog_company ON graduate_programs(company_id);
CREATE INDEX IF NOT EXISTS idx_gradprog_tenant ON graduate_programs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gradprog_status ON graduate_programs(status);

-- ── Placement calendar (events; can reference a drive/internship/program) ───
CREATE TABLE IF NOT EXISTS placement_calendar (
  id            TEXT PRIMARY KEY,
  company_id    TEXT REFERENCES companies(id) ON DELETE CASCADE,
  drive_id      TEXT,
  internship_id TEXT,
  program_id    TEXT,
  event_type    TEXT DEFAULT 'drive',          -- drive / deadline / test / interview / info_session
  title         TEXT NOT NULL,
  event_date    DATE,
  event_time    TEXT,
  location      TEXT,
  description   TEXT,
  tenant_id     TEXT,
  created_by    TEXT,
  status        TEXT DEFAULT 'scheduled',
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_tenant ON placement_calendar(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON placement_calendar(event_date);

-- ── Student application tracker (replaces device-local FresherHub store) ─────
CREATE TABLE IF NOT EXISTS campus_applications (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  target_type   TEXT DEFAULT 'drive',          -- drive / internship / graduate_program / external
  target_id     TEXT,                          -- nullable for manually-tracked external companies
  company_name  TEXT,                          -- denormalised snapshot for display
  role_title    TEXT,
  status        TEXT DEFAULT 'interested',     -- interested / applied / shortlisted / test / interview / offer / rejected / withdrawn
  applied_at    DATE,
  notes         TEXT,
  source        TEXT DEFAULT 'manual',         -- manual / imported
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campus_apps_user ON campus_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_campus_apps_status ON campus_applications(status);

-- ── Offers (real student-recorded offers — drives package analytics) ────────
CREATE TABLE IF NOT EXISTS offers (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  application_id TEXT,
  company_name   TEXT,
  role_title     TEXT,
  offer_type     TEXT DEFAULT 'full_time',     -- full_time / internship / ppo
  ctc            NUMERIC(14,2),                -- nullable: null ≠ 0
  currency       TEXT DEFAULT 'INR',
  location       TEXT,
  offer_date     DATE,
  joining_date   DATE,
  status         TEXT DEFAULT 'received',      -- received / accepted / declined / deferred
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_offers_user ON offers(user_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);

-- ── Student placement profile (eligibility inputs) ──────────────────────────
CREATE TABLE IF NOT EXISTS campus_student_profiles (
  user_id      TEXT PRIMARY KEY,
  cgpa         NUMERIC(4,2),
  branch       TEXT,
  backlogs     INTEGER,
  batch_year   INTEGER,
  tenth_pct    NUMERIC(5,2),
  twelfth_pct  NUMERIC(5,2),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
