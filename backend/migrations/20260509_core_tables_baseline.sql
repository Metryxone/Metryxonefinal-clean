-- ============================================================
-- Baseline DDL for core tables that pre-date the migration runner.
-- These tables were created by an early Drizzle push from
-- backend/shared/schema.ts before the SQL migration system existed.
-- All statements are non-destructive CREATE TABLE IF NOT EXISTS —
-- safe to apply against an existing DB.
--
-- IMPORTANT: The DDL below reflects the ACTUAL live table columns
-- as they exist in the database (confirmed 2026-05-09 via introspection).
-- They match backend/shared/schema.ts, NOT frontend/server/src/db/schema.ts.
-- The frontend/server schema has aspirational column additions that have
-- NOT yet been applied to the live DB (see DATABASE_INVENTORY.md §Schema Drift).
-- ============================================================

-- ── users ─────────────────────────────────────────────────────
-- Live table: 7 columns — matches backend/shared/schema.ts exactly.
-- frontend/server/src/db/schema.ts has a 15-column version (mobile, email,
-- passwordHash, isActive, isVerified, profilePicture, metadata, platformId, updatedAt)
-- that has NOT been applied to the live DB yet. See DATABASE_INVENTORY.md.
CREATE TABLE IF NOT EXISTS users (
  id          varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  username    text UNIQUE,
  password    text,
  full_name   text,
  role        text NOT NULL DEFAULT 'parent',
  roles       text[] NOT NULL DEFAULT '{"parent"}',
  created_at  timestamp NOT NULL DEFAULT now()
);

-- ── children ──────────────────────────────────────────────────
-- Live table: many columns, created by Drizzle push from backend/shared/schema.ts
-- then extended. Exact live column set confirmed 2026-05-09.
CREATE TABLE IF NOT EXISTS children (
  id                        varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  parent_id                 varchar REFERENCES users(id),
  student_user_id           varchar REFERENCES users(id),
  name                      text NOT NULL,
  age                       integer,
  grade                     text,
  class_section             text,
  school_name               text,
  roll_number               text,
  gender                    text,
  date_of_birth             date,
  blood_group               text,
  primary_language          text,
  education_board           text,
  city                      text,
  state                     text,
  special_needs             text,
  study_hours               text,
  favorite_subjects         text[]  DEFAULT '{}',
  weak_subjects             text[]  DEFAULT '{}',
  learning_style            text,
  career_interest           text,
  relationship              text,
  school_type               text,
  medium_of_instruction     text,
  extracurricular           text,
  emergency_contact         text,
  medical_conditions        text,
  lbi_consent               boolean NOT NULL DEFAULT false,
  data_collection_consent   boolean NOT NULL DEFAULT false,
  dpdp_consent              boolean NOT NULL DEFAULT false,
  development_acknowledgment boolean NOT NULL DEFAULT false,
  progress_sharing_consent  boolean NOT NULL DEFAULT false,
  consent_date              timestamp,
  consent_revoked_date      timestamp,
  created_at                timestamp NOT NULL DEFAULT now(),
  updated_at                timestamp NOT NULL DEFAULT now()
);

-- ── subscription_packages ─────────────────────────────────────
-- Live table: 14 columns — matches backend/shared/schema.ts (minimal version).
-- frontend/server/src/db/schema.ts has a 30-column version (subcategory, priceMax,
-- offerLabel, couponCode, highlights, billingType, reportConfig jsonb, etc.)
-- that has NOT been applied to the live DB yet. See DATABASE_INVENTORY.md.
CREATE TABLE IF NOT EXISTS subscription_packages (
  id              varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  category        text NOT NULL,
  student_segment text NOT NULL,
  product_name    text NOT NULL,
  is_recommended  boolean NOT NULL DEFAULT false,
  domains_covered text[]  NOT NULL DEFAULT '{}',
  price           real,
  validity_days   integer,
  question_count  integer,
  report_type     text,
  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamp NOT NULL DEFAULT now(),
  updated_at      timestamp NOT NULL DEFAULT now()
);

-- ── student_subscriptions ─────────────────────────────────────
-- Live table: 11 columns — matches backend/shared/schema.ts.
-- frontend/server/src/db/schema.ts has a different column set
-- (institutionId, notes, startDate, targetAgeBand, assignedBy, updatedAt)
-- that has NOT been applied to the live DB yet.
CREATE TABLE IF NOT EXISTS student_subscriptions (
  id                       varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  child_id                 varchar REFERENCES children(id) ON DELETE CASCADE,
  student_id               varchar,
  package_id               varchar NOT NULL REFERENCES subscription_packages(id) ON DELETE RESTRICT,
  purchase_date            timestamp NOT NULL DEFAULT now(),
  expiry_date              timestamp,
  status                   text NOT NULL DEFAULT 'active',
  assessment_completed_at  timestamp,
  report_generated_at      timestamp,
  payment_transaction_id   varchar,
  created_at               timestamp NOT NULL DEFAULT now()
);

-- ── lbi_questions_legacy ─────────────────────────────────────
-- Safe DROP guard: only drops the table if it exists AND contains 0 rows.
-- The Drizzle table definition is commented out in backend/shared/schema.ts.
-- Uses dynamic SQL (EXECUTE) for the row count so the query is not parsed
-- at block-compilation time — safe on DBs where the table does not exist.
-- Row count confirmed 0 in production 2026-05-09; table was dropped then.
DO $$
DECLARE
  v_count bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lbi_questions_legacy'
  ) THEN
    EXECUTE 'SELECT COUNT(*) FROM lbi_questions_legacy' INTO v_count;
    IF v_count = 0 THEN
      DROP TABLE lbi_questions_legacy;
      RAISE NOTICE 'lbi_questions_legacy dropped (was empty).';
    ELSE
      RAISE NOTICE 'lbi_questions_legacy skipped (% rows present).', v_count;
    END IF;
  ELSE
    RAISE NOTICE 'lbi_questions_legacy does not exist — nothing to drop.';
  END IF;
END $$;

-- ── lbi_sessions ─────────────────────────────────────────────
-- Live table: 6 columns — matches backend/shared/schema.ts (institute model:
-- assessment_id + student_id). The CONSUMER model (child_id + module_id) is
-- defined in frontend/server/src/db/schema.ts but NOT YET APPLIED to the live DB.
-- lbi_assessment_sessions (raw SQL in backend/routes.ts) is a SEPARATE institute table.
CREATE TABLE IF NOT EXISTS lbi_sessions (
  id             varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  assessment_id  varchar NOT NULL REFERENCES lbi_assessments(id) ON DELETE CASCADE,
  student_id     varchar NOT NULL REFERENCES students(id)        ON DELETE CASCADE,
  status         text    NOT NULL DEFAULT 'Not Started',
  started_at     timestamp,
  completed_at   timestamp
);
