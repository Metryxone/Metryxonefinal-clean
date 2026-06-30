/**
 * CAPADEX 3.0 Phase 1.2 (G-M3) — adaptive_question_bank persona seed.
 *
 * Fills the curation pipeline gap: the `adaptive_question_bank` table had NO
 * campus / jobseeker / teacher rows for admins to curate. This script seeds a
 * small, genuinely-authored set of Likert items for those personas.
 *
 * SAFETY / HONESTY CONTRACT
 *   - Rows are inserted as status='draft'. The runtime consumer
 *     (`pickQuestionsFromDB`) serves ONLY status='approved' rows, so this seed
 *     is byte-identical at runtime — questions reach live assessments ONLY after
 *     a human promotes them to 'approved' via the admin CMS (the existing
 *     draft→approved workflow). Promotion/serving is gated by the adaptive
 *     questioning activation flags, NOT by personaModelAlignment.
 *   - Idempotent: a UNIQUE (concern_bucket, persona, question_text) index backs
 *     ON CONFLICT DO NOTHING, so re-runs insert nothing new.
 *   - CREATE TABLE IF NOT EXISTS mirrors the columns used by
 *     routes/capadex-questions.ts (the admin CRUD surface).
 *
 * Run (dev): cd backend && npx tsx scripts/seed-adaptive-question-bank-personas.ts
 */
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// concern_bucket values are real runtime rulesKeys (PATTERNS keys in
// capadex-concern-intelligence.ts) so promoted rows are immediately routable.
type Seed = { concern_bucket: string; persona: string; question_text: string; age_min: number | null; age_max: number | null };

const SEEDS: Seed[] = [
  // ── campus (college students) ─────────────────────────────────────────────
  { concern_bucket: 'career',  persona: 'campus', question_text: 'I have a clear sense of which career direction fits me after college.', age_min: 17, age_max: 24 },
  { concern_bucket: 'career',  persona: 'campus', question_text: 'I can map the skills I am building on campus to the roles I want.', age_min: 17, age_max: 24 },
  { concern_bucket: 'career',  persona: 'campus', question_text: 'I feel confident making decisions about internships and placements.', age_min: 17, age_max: 24 },
  { concern_bucket: 'general', persona: 'campus', question_text: 'I manage academic pressure without it overwhelming my daily routine.', age_min: 17, age_max: 24 },
  { concern_bucket: 'general', persona: 'campus', question_text: 'I stay focused on long-term goals even when campus life is distracting.', age_min: 17, age_max: 24 },

  // ── jobseeker (active job search / transition) ────────────────────────────
  { concern_bucket: 'career',  persona: 'jobseeker', question_text: 'I have a clear, prioritised plan for my current job search.', age_min: 18, age_max: 60 },
  { concern_bucket: 'career',  persona: 'jobseeker', question_text: 'I can articulate my professional identity and strengths to employers.', age_min: 18, age_max: 60 },
  { concern_bucket: 'career',  persona: 'jobseeker', question_text: 'I know which skill gaps to close to reach my target role.', age_min: 18, age_max: 60 },
  { concern_bucket: 'general', persona: 'jobseeker', question_text: 'I keep my motivation steady through rejections and slow responses.', age_min: 18, age_max: 60 },
  { concern_bucket: 'general', persona: 'jobseeker', question_text: 'I manage the uncertainty of a career change without it stalling me.', age_min: 18, age_max: 60 },

  // ── teacher / educator / counsellor (proxy lens) ──────────────────────────
  { concern_bucket: 'career',  persona: 'teacher', question_text: 'I can help students connect their strengths to suitable career paths.', age_min: 22, age_max: 70 },
  { concern_bucket: 'career',  persona: 'teacher', question_text: 'I have the resources I need to guide students through career decisions.', age_min: 22, age_max: 70 },
  { concern_bucket: 'general', persona: 'teacher', question_text: 'I can recognise when a student is struggling beyond academics.', age_min: 22, age_max: 70 },
  { concern_bucket: 'general', persona: 'teacher', question_text: 'I feel equipped to support students through exam-related stress.', age_min: 22, age_max: 70 },
  { concern_bucket: 'general', persona: 'teacher', question_text: 'I can tailor my guidance to the individual needs of each student.', age_min: 22, age_max: 70 },
];

async function main() {
  // Fresh-create path mirrors the admin CRUD contract in
  // routes/capadex-questions.ts (status restricted to draft|approved|rejected|
  // archived). IF NOT EXISTS means a pre-existing table (e.g. prod) is left
  // untouched — we deliberately do NOT ALTER an existing table's schema.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS adaptive_question_bank (
      id             SERIAL PRIMARY KEY,
      concern_bucket TEXT NOT NULL,
      persona        TEXT NOT NULL,
      question_text  TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','approved','rejected','archived')),
      age_min        INTEGER,
      age_max        INTEGER,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS adaptive_question_bank_natural_uq
      ON adaptive_question_bank (concern_bucket, persona, question_text)`);

  let inserted = 0;
  for (const s of SEEDS) {
    const rs = await pool.query(
      `INSERT INTO adaptive_question_bank (concern_bucket, persona, question_text, status, age_min, age_max)
       VALUES ($1, $2, $3, 'draft', $4, $5)
       ON CONFLICT (concern_bucket, persona, question_text) DO NOTHING`,
      [s.concern_bucket, s.persona, s.question_text, s.age_min, s.age_max],
    );
    inserted += rs.rowCount ?? 0;
  }

  const dist = await pool.query<{ persona: string; status: string; n: string }>(
    `SELECT persona, status, COUNT(*)::text AS n FROM adaptive_question_bank GROUP BY 1,2 ORDER BY 1,2`,
  );
  console.log(`[seed-adaptive-question-bank-personas] inserted ${inserted} new draft row(s) (idempotent).`);
  console.log('[seed-adaptive-question-bank-personas] distribution:', JSON.stringify(dist.rows));
  console.log('[seed-adaptive-question-bank-personas] NOTE: rows are DRAFT — not served until a human promotes to approved (adaptive flags gate serving).');
}

main()
  .catch((e) => { console.error('[seed-adaptive-question-bank-personas] FAILED:', e); process.exitCode = 1; })
  .finally(() => pool.end());
