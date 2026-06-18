import type { Pool } from 'pg';

export async function ensureCareerPassportSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cp_passport (
      id           SERIAL PRIMARY KEY,
      user_id      VARCHAR(60) NOT NULL UNIQUE,
      display_name VARCHAR(200),
      headline     VARCHAR(400),
      bio          TEXT,
      section_visibility JSONB DEFAULT '{}',
      share_scores BOOLEAN DEFAULT false,
      completeness_score SMALLINT DEFAULT 0,
      strength_score     SMALLINT DEFAULT 0,
      integrity_version  INTEGER DEFAULT 1,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cp_competencies (
      id           SERIAL PRIMARY KEY,
      passport_id  INTEGER NOT NULL REFERENCES cp_passport(id) ON DELETE CASCADE,
      skill_name   VARCHAR(200) NOT NULL,
      category     VARCHAR(100),
      proficiency_level VARCHAR(50) DEFAULT 'intermediate',
      proficiency_score SMALLINT,
      source       VARCHAR(60) DEFAULT 'manual',
      source_ref   VARCHAR(200),
      is_verified  BOOLEAN DEFAULT false,
      verification_status VARCHAR(40) DEFAULT 'self_declared',
      verified_by  VARCHAR(200),
      verified_at  TIMESTAMPTZ,
      evidence_url VARCHAR(500),
      is_visible   BOOLEAN DEFAULT true,
      added_at     TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cp_assessments (
      id                SERIAL PRIMARY KEY,
      passport_id       INTEGER NOT NULL REFERENCES cp_passport(id) ON DELETE CASCADE,
      assessment_type   VARCHAR(60) NOT NULL,
      provider          VARCHAR(200) DEFAULT 'MetryxOne',
      title             VARCHAR(300),
      score             NUMERIC(5,2),
      band              VARCHAR(60),
      percentile        SMALLINT,
      raw_ref           VARCHAR(200),
      completed_at      TIMESTAMPTZ,
      is_visible        BOOLEAN DEFAULT true,
      platform_verified BOOLEAN DEFAULT false,
      integrity_hash    VARCHAR(100)
    );

    CREATE TABLE IF NOT EXISTS cp_projects (
      id          SERIAL PRIMARY KEY,
      passport_id INTEGER NOT NULL REFERENCES cp_passport(id) ON DELETE CASCADE,
      title       VARCHAR(300) NOT NULL,
      description TEXT,
      outcomes    TEXT,
      skills_used TEXT[],
      role        VARCHAR(200),
      org         VARCHAR(200),
      url         VARCHAR(500),
      start_date  DATE,
      end_date    DATE,
      is_current  BOOLEAN DEFAULT false,
      is_highlighted BOOLEAN DEFAULT false,
      is_visible  BOOLEAN DEFAULT true,
      sort_order  SMALLINT DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cp_achievements (
      id          SERIAL PRIMARY KEY,
      passport_id INTEGER NOT NULL REFERENCES cp_passport(id) ON DELETE CASCADE,
      category    VARCHAR(60) DEFAULT 'milestone',
      title       VARCHAR(300) NOT NULL,
      issuer      VARCHAR(200),
      issued_at   DATE,
      description TEXT,
      evidence_url VARCHAR(500),
      is_visible  BOOLEAN DEFAULT true,
      is_verified BOOLEAN DEFAULT false,
      verification_status VARCHAR(40) DEFAULT 'self_declared',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cp_certifications (
      id           SERIAL PRIMARY KEY,
      passport_id  INTEGER NOT NULL REFERENCES cp_passport(id) ON DELETE CASCADE,
      title        VARCHAR(300) NOT NULL,
      issuer       VARCHAR(200) NOT NULL,
      credential_id VARCHAR(200),
      issued_at    DATE,
      expires_at   DATE,
      credential_url VARCHAR(500),
      skills_covered TEXT[],
      is_visible   BOOLEAN DEFAULT true,
      is_verified  BOOLEAN DEFAULT false,
      verification_status VARCHAR(40) DEFAULT 'self_declared',
      verified_at  TIMESTAMPTZ,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cp_experience (
      id              SERIAL PRIMARY KEY,
      passport_id     INTEGER NOT NULL REFERENCES cp_passport(id) ON DELETE CASCADE,
      org             VARCHAR(300) NOT NULL,
      role            VARCHAR(300) NOT NULL,
      employment_type VARCHAR(60) DEFAULT 'full_time',
      start_date      DATE NOT NULL,
      end_date        DATE,
      is_current      BOOLEAN DEFAULT false,
      description     TEXT,
      skills_used     TEXT[],
      achievements    TEXT[],
      is_visible      BOOLEAN DEFAULT true,
      sort_order      SMALLINT DEFAULT 0,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cp_learning_history (
      id            SERIAL PRIMARY KEY,
      passport_id   INTEGER NOT NULL REFERENCES cp_passport(id) ON DELETE CASCADE,
      activity_type VARCHAR(60) DEFAULT 'course',
      title         VARCHAR(300) NOT NULL,
      provider      VARCHAR(200),
      completed_at  TIMESTAMPTZ,
      hours         NUMERIC(6,1),
      skills        TEXT[],
      certificate_url VARCHAR(500),
      is_visible    BOOLEAN DEFAULT true,
      source        VARCHAR(40) DEFAULT 'manual',
      source_ref    VARCHAR(200),
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cp_career_goals (
      id          SERIAL PRIMARY KEY,
      passport_id INTEGER NOT NULL REFERENCES cp_passport(id) ON DELETE CASCADE,
      goal_type   VARCHAR(60) DEFAULT 'role',
      title       VARCHAR(300) NOT NULL,
      description TEXT,
      target_date DATE,
      status      VARCHAR(40) DEFAULT 'active',
      milestones  JSONB DEFAULT '[]',
      is_visible  BOOLEAN DEFAULT false,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cp_readiness_scores (
      id              SERIAL PRIMARY KEY,
      passport_id     INTEGER NOT NULL REFERENCES cp_passport(id) ON DELETE CASCADE,
      score_type      VARCHAR(60) NOT NULL,
      score           NUMERIC(5,2) NOT NULL,
      band            VARCHAR(60),
      confidence      NUMERIC(4,3),
      computed_at     TIMESTAMPTZ NOT NULL,
      source_system   VARCHAR(60) DEFAULT 'metryx',
      source_ref      VARCHAR(200),
      is_visible      BOOLEAN DEFAULT true,
      platform_verified BOOLEAN DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS cp_share_tokens (
      id          SERIAL PRIMARY KEY,
      passport_id INTEGER NOT NULL REFERENCES cp_passport(id) ON DELETE CASCADE,
      token       VARCHAR(64) NOT NULL UNIQUE,
      sections    TEXT[],
      label       VARCHAR(200),
      expires_at  TIMESTAMPTZ,
      view_count  INTEGER DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      revoked_at  TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS cp_verification_requests (
      id             SERIAL PRIMARY KEY,
      passport_id    INTEGER NOT NULL REFERENCES cp_passport(id) ON DELETE CASCADE,
      item_type      VARCHAR(40) NOT NULL,
      item_id        INTEGER NOT NULL,
      verifier_email VARCHAR(200) NOT NULL,
      verifier_name  VARCHAR(200),
      verifier_org   VARCHAR(200),
      status         VARCHAR(40) DEFAULT 'pending',
      token          VARCHAR(64) NOT NULL UNIQUE,
      requested_at   TIMESTAMPTZ DEFAULT NOW(),
      verified_at    TIMESTAMPTZ,
      declined_at    TIMESTAMPTZ,
      expires_at     TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days',
      notes          TEXT
    );
  `).catch(() => null);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_cp_competencies_passport ON cp_competencies(passport_id);
    CREATE INDEX IF NOT EXISTS idx_cp_assessments_passport  ON cp_assessments(passport_id);
    CREATE INDEX IF NOT EXISTS idx_cp_experience_passport   ON cp_experience(passport_id);
    CREATE INDEX IF NOT EXISTS idx_cp_scores_passport       ON cp_readiness_scores(passport_id, score_type);
    CREATE INDEX IF NOT EXISTS idx_cp_share_token           ON cp_share_tokens(token) WHERE revoked_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_cp_verify_token          ON cp_verification_requests(token);
  `).catch(() => null);
}

// ── Completeness weights ────────────────────────────────────────────────────
// Experience 20, Assessments 20, Competencies 15, Scores 10, Certifications 10,
// Projects 10, Goals 5, Achievements 5, Learning 5 — total 100
export async function computePassportCompleteness(
  passportId: number,
  pool: Pool,
): Promise<{ completeness: number; strength: number; section_counts: Record<string, number> }> {
  type RowType = { section: string; cnt: string };
  const queries: Promise<RowType>[] = [
    pool.query<RowType>(`SELECT 'experience'     AS section, COUNT(*)::text AS cnt FROM cp_experience      WHERE passport_id=$1`, [passportId]).then(r => r.rows[0] ?? { section:'experience',     cnt:'0' }),
    pool.query<RowType>(`SELECT 'competencies'   AS section, COUNT(*)::text AS cnt FROM cp_competencies   WHERE passport_id=$1`, [passportId]).then(r => r.rows[0] ?? { section:'competencies',   cnt:'0' }),
    pool.query<RowType>(`SELECT 'assessments'    AS section, COUNT(*)::text AS cnt FROM cp_assessments    WHERE passport_id=$1`, [passportId]).then(r => r.rows[0] ?? { section:'assessments',    cnt:'0' }),
    pool.query<RowType>(`SELECT 'certifications' AS section, COUNT(*)::text AS cnt FROM cp_certifications WHERE passport_id=$1`, [passportId]).then(r => r.rows[0] ?? { section:'certifications', cnt:'0' }),
    pool.query<RowType>(`SELECT 'projects'       AS section, COUNT(*)::text AS cnt FROM cp_projects       WHERE passport_id=$1`, [passportId]).then(r => r.rows[0] ?? { section:'projects',       cnt:'0' }),
    pool.query<RowType>(`SELECT 'achievements'   AS section, COUNT(*)::text AS cnt FROM cp_achievements   WHERE passport_id=$1`, [passportId]).then(r => r.rows[0] ?? { section:'achievements',   cnt:'0' }),
    pool.query<RowType>(`SELECT 'learning'       AS section, COUNT(*)::text AS cnt FROM cp_learning_history WHERE passport_id=$1`, [passportId]).then(r => r.rows[0] ?? { section:'learning', cnt:'0' }),
    pool.query<RowType>(`SELECT 'goals'          AS section, COUNT(*)::text AS cnt FROM cp_career_goals   WHERE passport_id=$1`, [passportId]).then(r => r.rows[0] ?? { section:'goals',          cnt:'0' }),
    pool.query<RowType>(`SELECT 'scores'         AS section, COUNT(*)::text AS cnt FROM cp_readiness_scores WHERE passport_id=$1`, [passportId]).then(r => r.rows[0] ?? { section:'scores',      cnt:'0' }),
  ];

  const results = await Promise.all(queries);
  const counts: Record<string, number> = {};
  for (const r of results) counts[r.section] = Number(r.cnt);

  const exp  = counts.experience     ?? 0;
  const comp = counts.competencies   ?? 0;
  const asmt = counts.assessments    ?? 0;
  const cert = counts.certifications ?? 0;
  const proj = counts.projects       ?? 0;
  const ach  = counts.achievements   ?? 0;
  const lrn  = counts.learning       ?? 0;
  const gls  = counts.goals          ?? 0;
  const sc   = counts.scores         ?? 0;

  const completeness = Math.round(
    (exp > 0 ? 20 : 0) +
    (asmt > 0 ? 20 : 0) +
    (comp >= 5 ? 15 : comp >= 2 ? 10 : comp >= 1 ? 5 : 0) +
    (sc > 0 ? 10 : 0) +
    (cert > 0 ? 10 : 0) +
    (proj > 0 ? 10 : 0) +
    (gls > 0 ? 5 : 0) +
    (ach > 0 ? 5 : 0) +
    (lrn > 0 ? 5 : 0),
  );

  // Strength: verification rate + platform verified assessments + breadth
  let verifiedCount = 0; let totalItems = 0;
  for (const [sec, cnt] of Object.entries(counts)) {
    if (sec === 'scores') continue;
    totalItems += cnt;
  }
  try {
    const { rows: vRows } = await pool.query<{ cnt: string }>(
      `SELECT (
         SELECT COUNT(*) FROM cp_competencies   WHERE passport_id=$1 AND is_verified=true) +
        (SELECT COUNT(*) FROM cp_certifications WHERE passport_id=$1 AND is_verified=true) +
        (SELECT COUNT(*) FROM cp_achievements   WHERE passport_id=$1 AND is_verified=true) +
        (SELECT COUNT(*) FROM cp_assessments    WHERE passport_id=$1 AND platform_verified=true) AS cnt`,
      [passportId],
    );
    verifiedCount = Number(vRows[0]?.cnt ?? 0);
  } catch { /* skip */ }

  const verificationRate = totalItems > 0 ? verifiedCount / totalItems : 0;
  const breadth = Object.values(counts).filter(v => v > 0).length;
  const strength = Math.round(verificationRate * 40 + (breadth / 9) * 30 + (completeness / 100) * 30);

  return { completeness, strength, section_counts: counts };
}
