/**
 * mx301-demo-candidate.ts — MX-301 demonstration candidate provisioning (reversible).
 *
 * Provisions ONE realistic, fully purgeable demonstration candidate — Sarah Johnson,
 * Senior Product Manager (Technology, 8 yrs, MBA, Bangalore) — so the full enterprise
 * journey (mx301-e2e.ts) can be demonstrated end-to-end.
 *
 *   Run:      npx tsx backend/scripts/mx301-demo-candidate.ts
 *   Rollback: npx tsx backend/scripts/mx301-demo-candidate.ts --rollback
 *
 * Honesty / safety:
 *   - The candidate's UNIVERSAL id is her email `sarah.johnson.mx301@example.com`.
 *     Every engine in this platform keys the subject off this one id (competency
 *     subject_id, career_seeker_profiles.user_id, users.id, and the employer-match
 *     candidate.email resolver), so there is no identity-space mismatch.
 *   - Every row carries `mx301` in its key → trivially purgeable on the shared DB.
 *     Re-running purges the prior candidate first, so it is idempotent.
 *   - Sarah's COMPETENCY SCORES are demonstration INPUT data (a candidate's answers),
 *     seeded into the canonical runtime ledger `onto_competency_profiles` exactly the
 *     way the existing demo-cohort seeder does. This is NOT fabricating platform
 *     capability — every downstream calculation (readiness, EI, gap, roadmap, match,
 *     passport, …) then executes for REAL on top of this input.
 *   - It ALSO drives the real scorer `scoreAssessmentRun` against whatever approved
 *     question→competency mappings exist, to PROVE the scoring transaction executes.
 *     If the live bank is sparse the scorer honestly scores few/none — reported, never
 *     inflated.
 *   - Reuses existing engines only (resolveRoleEndToEnd, scoreAssessmentRun). No new
 *     engine, no rebuilt service.
 */
import { pathToFileURL } from 'url';

import pg from 'pg';

import { resolveRoleEndToEnd } from '../services/role-auto-resolution.js';
import { scoreAssessmentRun } from '../services/competency-scoring.js';

const { Pool } = pg;

export const MX301_SUBJECT = 'sarah.johnson.mx301@example.com';
export const MX301_TAG = 'mx301';
const ROLE_TITLE = 'Senior Product Manager';

// Realistic, demonstrable competency profile for a strong senior PM.
const DOMAINS = [
  { code: 'dom_cognitive', label: 'Cognitive Capabilities', score: 82 },
  { code: 'dom_behavioral', label: 'Behavioral Capabilities', score: 78 },
  { code: 'dom_interpersonal', label: 'Interpersonal & Leadership', score: 84 },
  { code: 'dom_functional', label: 'Functional & Execution', score: 74 },
  { code: 'dom_strategic', label: 'Strategic & Organizational', score: 69 },
];

function levelFromScore(s: number) {
  return s >= 85 ? 5 : s >= 70 ? 4 : s >= 55 ? 3 : s >= 40 ? 2 : 1;
}

// Tables that may hold rows keyed to the demo candidate, with the column(s) that
// carry the id. Rollback probes each (to_regclass) and deletes mx301-tagged rows.
const PURGE_TARGETS: { table: string; cols: string[] }[] = [
  { table: 'onto_competency_profiles', cols: ['subject_id'] },
  { table: 'onto_competency_score_runs', cols: ['subject_id'] },
  { table: 'onto_assessment_instances', cols: ['subject_id'] },
  { table: 'competency_forecasts', cols: ['user_id'] },
  { table: 'p4_development_velocity', cols: ['user_id', 'id'] },
  { table: 'career_match_history', cols: ['subject_id', 'user_id'] },
  { table: 'career_readiness_history', cols: ['subject_id', 'user_id'] },
  { table: 'career_gap_history', cols: ['subject_id', 'user_id'] },
  { table: 'career_roadmap_history', cols: ['subject_id', 'user_id'] },
  { table: 'career_development_history', cols: ['subject_id', 'user_id'] },
  { table: 'career_passport_history', cols: ['subject_id', 'user_id'] },
  { table: 'career_signal_history', cols: ['subject_id', 'user_id'] },
  { table: 'career_progression_history', cols: ['subject_id', 'user_id'] },
  { table: 'growth_tracking', cols: ['subject_id', 'user_id'] },
  { table: 'career_history', cols: ['subject_id', 'user_id'] },
  { table: 'role_resolution_decisions', cols: ['subject_id'] },
  { table: 'career_seeker_profiles', cols: ['user_id'] },
  { table: 'users', cols: ['id', 'email', 'username'] },
];

async function columnExists(pool: pg.Pool, table: string, col: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 LIMIT 1`,
    [table, col],
  );
  return (r.rowCount ?? 0) > 0;
}

async function tableExists(pool: pg.Pool, table: string): Promise<boolean> {
  const r = await pool.query(`SELECT to_regclass($1) AS reg`, [table]);
  return r.rows[0]?.reg != null;
}

async function rollback(pool: pg.Pool): Promise<number> {
  let total = 0;
  for (const t of PURGE_TARGETS) {
    if (!(await tableExists(pool, t.table))) continue;
    for (const col of t.cols) {
      if (!(await columnExists(pool, t.table, col))) continue;
      try {
        const r = await pool.query(`DELETE FROM ${t.table} WHERE ${col}::text LIKE $1`, [`%${MX301_TAG}%`]);
        if (r.rowCount) {
          total += r.rowCount;
          console.log(`  purged ${r.rowCount} from ${t.table}.${col}`);
        }
      } catch (e: any) {
        console.log(`  [skip] ${t.table}.${col}: ${String(e?.message ?? e).slice(0, 80)}`);
      }
    }
  }
  return total;
}

async function provision(pool: pg.Pool) {
  // Idempotent: purge any prior copy first.
  console.log('Purging any prior MX-301 demo candidate…');
  await rollback(pool);

  // ── Stage: Registration ──────────────────────────────────────────────────
  await pool.query(
    `INSERT INTO users (id, username, password, full_name, role, roles, email, account_type, created_at)
     VALUES ($1::text, $1::text, $2, $3, 'career_seeker', ARRAY['career_seeker'], $1::text, 'individual', now())
     ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email`,
    [MX301_SUBJECT, '!mx301-demo-login-disabled', 'Sarah Johnson'],
  );

  const profileData = {
    name: 'Sarah Johnson',
    headline: 'Senior Product Manager',
    current_role: ROLE_TITLE,
    target_role: 'Director of Product',
    industry: 'Technology',
    experience_years: 8,
    education: 'MBA',
    location: 'Bangalore, India',
    summary:
      'Senior Product Manager with 8 years across B2B SaaS, leading cross-functional teams and ' +
      'data-driven product strategy. MBA. Seeking director-level product leadership.',
    skills: ['Product Strategy', 'Roadmapping', 'Stakeholder Management', 'Analytics', 'Team Leadership'],
    demo: true,
    demo_program: 'MX-301',
  };
  await pool.query(
    `INSERT INTO career_seeker_profiles (user_id, data, completeness, created_at, updated_at)
     VALUES ($1, $2::jsonb, 85, now(), now())
     ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, completeness = EXCLUDED.completeness, updated_at = now()`,
    [MX301_SUBJECT, JSON.stringify(profileData)],
  );
  console.log('Registration: users + career_seeker_profiles created.');

  // ── Stage: Role selection + automatic Role DNA resolution ────────────────
  let roleId = ROLE_TITLE;
  try {
    const res: any = await resolveRoleEndToEnd(pool, { title: ROLE_TITLE });
    roleId = res?.role?.role_id ?? res?.role?.id ?? res?.resolution?.role_id ?? ROLE_TITLE;
    console.log(`Role DNA resolution: "${ROLE_TITLE}" → role_id=${roleId} (resolved=${!!res?.resolved ?? 'n/a'}).`);
  } catch (e: any) {
    console.log(`Role DNA resolution: fell back to title (${String(e?.message ?? e).slice(0, 80)}).`);
  }

  // ── Stage: Real scorer execution (proof the scoring transaction runs) ─────
  try {
    const q = await pool.query(
      `SELECT m.question_id, t.template_body
         FROM onto_question_competency_mapping m
         JOIN competency_question_templates t ON t.id = m.question_id AND t.status = 'approved'
        WHERE m.active = true
        LIMIT 30`,
    );
    const responses = q.rows.map((row: any) => {
      const body = row.template_body && typeof row.template_body === 'object' ? row.template_body : {};
      const best = Number.isFinite(Number(body.best_option)) ? Number(body.best_option) : null;
      return { question_id: String(row.question_id), selected_index: best != null ? best : 3 };
    });
    const scored: any = await scoreAssessmentRun(pool, {
      responses,
      subject_id: MX301_SUBJECT,
      persist: true,
      source: 'mx301_demo',
    });
    console.log(
      `Real scorer executed: status=${scored?.status}, scored_questions=${scored?.scored_questions}/${scored?.total_questions} ` +
        `(honest — limited by approved question→competency mappings in the live bank).`,
    );
  } catch (e: any) {
    console.log(`Real scorer: ${String(e?.message ?? e).slice(0, 120)}`);
  }

  // ── Stage: Seed the canonical runtime competency profile (candidate input) ─
  const profile = DOMAINS.map((d) => ({
    label: d.label,
    level: levelFromScore(d.score),
    onto_domain: d.code,
    scaled_score: d.score,
    question_count: 6,
  }));
  const overall = Math.round(profile.reduce((s, p) => s + p.scaled_score, 0) / profile.length);

  const inst = await pool.query<{ id: string }>(
    `INSERT INTO onto_assessment_instances
       (blueprint_id, role_id, subject_id, status, total_questions, coverage, source)
     VALUES ($1, $2, $3, 'scored', $4, $5::jsonb, 'mx301_demo')
     RETURNING id`,
    [
      'mx301_blueprint',
      roleId,
      MX301_SUBJECT,
      profile.reduce((s, p) => s + p.question_count, 0),
      JSON.stringify({ source: 'mx301_demo', domains_measured: profile.length }),
    ],
  );
  await pool.query(
    `INSERT INTO onto_competency_profiles
       (subject_id, instance_id, blueprint_id, role_id, overall_score, overall_level, profile, coverage, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, now())`,
    [
      MX301_SUBJECT,
      inst.rows[0].id,
      'mx301_blueprint',
      roleId,
      overall,
      levelFromScore(overall),
      JSON.stringify(profile),
      JSON.stringify({ source: 'mx301_demo', domains_measured: profile.length }),
    ],
  );
  console.log(`Competency profile seeded: overall_score=${overall}, ${profile.length} domains.`);
  console.log(`\nMX-301 demo candidate ready: ${MX301_SUBJECT}`);
  console.log('Drive the journey: npx tsx backend/scripts/mx301-e2e.ts');
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  const isRollback = process.argv.includes('--rollback');
  try {
    if (isRollback) {
      console.log('MX-301 demo candidate ROLLBACK…');
      const n = await rollback(pool);
      console.log(`Rollback complete: ${n} rows removed.`);
    } else {
      await provision(pool);
    }
  } finally {
    await pool.end();
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
