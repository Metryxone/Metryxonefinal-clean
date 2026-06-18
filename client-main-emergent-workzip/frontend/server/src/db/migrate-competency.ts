import { pool } from './client.js';

const COMPETENCY_ALTER_MIGRATIONS = [
  `ALTER TABLE competency_benchmarks ADD COLUMN IF NOT EXISTS industry VARCHAR(100) NOT NULL DEFAULT 'Technology'`,
  `DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'competency_benchmarks_role_career_stage_competency_id_key') THEN
      ALTER TABLE competency_benchmarks DROP CONSTRAINT competency_benchmarks_role_career_stage_competency_id_key;
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cb_role_industry_stage_key') THEN
      ALTER TABLE competency_benchmarks ADD CONSTRAINT cb_role_industry_stage_key UNIQUE (role, career_stage, industry, competency_id);
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'competency_interventions_comp_gaplevel_key') THEN
      ALTER TABLE competency_interventions ADD CONSTRAINT competency_interventions_comp_gaplevel_key UNIQUE (competency_id, gap_level);
    END IF;
  END $$`,
];

const COMPETENCY_TABLES = [
  `CREATE TABLE IF NOT EXISTS competency_domains (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code        VARCHAR(20) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS competencies (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    domain_id     TEXT NOT NULL REFERENCES competency_domains(id) ON DELETE CASCADE,
    code          VARCHAR(30) UNIQUE NOT NULL,
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    adjacency     JSONB NOT NULL DEFAULT '[]',
    sort_order    INTEGER NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_competencies_domain ON competencies(domain_id)`,

  `CREATE TABLE IF NOT EXISTS career_profiles (
    id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_job_role   VARCHAR(255),
    target_job_role    VARCHAR(255),
    industry           VARCHAR(100),
    career_stage       VARCHAR(50) DEFAULT 'mid',
    experience_years   INTEGER DEFAULT 0,
    metadata           JSONB NOT NULL DEFAULT '{}',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_career_profiles_user ON career_profiles(user_id)`,

  `CREATE TABLE IF NOT EXISTS competency_scores (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    profile_id      TEXT NOT NULL REFERENCES career_profiles(id) ON DELETE CASCADE,
    competency_id   TEXT NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
    raw_score       NUMERIC(5,2) NOT NULL DEFAULT 0,
    confidence      NUMERIC(5,2) NOT NULL DEFAULT 1,
    final_score     NUMERIC(5,2) NOT NULL DEFAULT 0,
    source          VARCHAR(50) DEFAULT 'assessment',
    assessed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, competency_id)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_comp_scores_profile ON competency_scores(profile_id)`,

  `CREATE TABLE IF NOT EXISTS role_weights (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    role            VARCHAR(255) NOT NULL,
    career_stage    VARCHAR(50) NOT NULL,
    competency_id   TEXT NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
    weight          NUMERIC(5,4) NOT NULL DEFAULT 1,
    UNIQUE(role, career_stage, competency_id)
  )`,

  `CREATE TABLE IF NOT EXISTS competency_benchmarks (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    role            VARCHAR(255) NOT NULL,
    career_stage    VARCHAR(50) NOT NULL,
    competency_id   TEXT NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
    mean            NUMERIC(5,2) NOT NULL DEFAULT 50,
    median          NUMERIC(5,2) NOT NULL DEFAULT 50,
    std_dev         NUMERIC(5,2) NOT NULL DEFAULT 10,
    p25             NUMERIC(5,2) NOT NULL DEFAULT 40,
    p75             NUMERIC(5,2) NOT NULL DEFAULT 65,
    p90             NUMERIC(5,2) NOT NULL DEFAULT 75,
    sample_size     INTEGER NOT NULL DEFAULT 100,
    UNIQUE(role, career_stage, competency_id)
  )`,

  `CREATE TABLE IF NOT EXISTS competency_interventions (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    competency_id   TEXT NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
    gap_level       VARCHAR(20) NOT NULL DEFAULT 'medium',
    type            VARCHAR(30) NOT NULL DEFAULT 'course',
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    provider        VARCHAR(100),
    duration_weeks  INTEGER DEFAULT 4,
    url             TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_interventions_competency ON competency_interventions(competency_id)`,

  `CREATE TABLE IF NOT EXISTS job_requirements (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    job_title       VARCHAR(255) NOT NULL,
    industry        VARCHAR(100),
    competency_id   TEXT NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
    min_score       NUMERIC(5,2) NOT NULL DEFAULT 60,
    preferred_score NUMERIC(5,2) NOT NULL DEFAULT 75,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];

export async function runCompetencyMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    for (const sql of COMPETENCY_TABLES) {
      await client.query(sql);
    }
    for (const sql of COMPETENCY_ALTER_MIGRATIONS) {
      await client.query(sql);
    }
    console.log('[Competency] DB tables ready.');
  } catch (err) {
    console.error('[Competency] Migration error:', err);
    throw err;
  } finally {
    client.release();
  }
}
