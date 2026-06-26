/**
 * MX-301 — Precise per-competency activation for the demo candidate (Sarah Johnson).
 *
 * GOAL (additive · reversible · honest): give the MX-301 demo candidate GENUINE
 * precise per-competency proficiency so the two remaining employer hiring surfaces
 * light up with real measured data (never fabricated):
 *   - Candidate Match  (talent-matching-engine) — reads employer_candidates.competency_profile
 *   - Competency Match (employer-competency-match, onto genome vs Role DNA) — org-scoped route
 *
 * HOW (all data flows through the REAL scoring pipeline — nothing hand-authored):
 *   1. generateAssessment(mx301_blueprint) → a real runtime instance over the 6 role_pm
 *      competencies (comp_*-tagged, curated bank).
 *   2. Answer each served question with its AUTHORED correct option (Sarah is a designed
 *      strong senior-PM persona). scoreAssessment() then produces PRECISE per-competency
 *      scores via onto_competency_question_map and persists them to onto_competency_score_runs.
 *   3. Project her UNIFIED competency-granularity scores (resolveUnifiedCompetencyProfile —
 *      read-only) into employer_candidates.competency_profile, keyed by competency_id. This
 *      is a faithful surfacing of her measured ledger, never an invented level.
 *   4. Align the demo candidate row + demo job to the elevated (super-admin) org so the
 *      org-scoped competency-match route resolves them in the validation harness session.
 *
 * REVERSIBLE: `--rollback` restores employer_id to 'mx301_employer', nulls the projected
 * competency_profile, and removes the runtime_competency_map score-run rows this script wrote.
 * All touched rows remain mx301-tagged, so the main demo teardown still purges them too.
 *
 * Run from backend/:  npx tsx scripts/mx301-precise-competency-seed.ts [--rollback]
 */
import pg from 'pg';
import { generateAssessment, scoreAssessment } from '../services/competency-runtime';
import { resolveUnifiedCompetencyProfile } from '../services/competency-intelligence-contracts';

const SUBJECT = 'sarah.johnson.mx301@example.com';
// The persona-experience harness probes this job id (MX301D_JOB_ID / default
// 'mx301d-probe-job') for the employer Competency Match tab — NOT 'mx301_demo_job'.
const PROBE_JOB_ID = process.env.MX301D_JOB_ID ?? 'mx301d-probe-job';
// Title must resolve to the role_pm Role DNA genome (generateRoleDNA keys on the
// job TITLE, not matched_role_id) so the match has real requirements to score against.
const PROBE_JOB_TITLE = 'Senior Product Manager';
const DEMO_EMPLOYER_TAG = 'mx301_employer';
const BLUEPRINT_ID = 'mx301_blueprint';
const ROLE_ID = 'role_pm';
const RUN_SOURCE = 'runtime_competency_map';

async function resolveElevatedOrgId(pool: pg.Pool): Promise<string> {
  const r = await pool.query(
    `SELECT id FROM users WHERE role = 'super_admin' AND email = 'support@metryxone.com' LIMIT 1`,
  );
  const id = r.rows[0]?.id;
  if (!id) throw new Error('super-admin (support@metryxone.com) not found — cannot scope demo rows.');
  return String(id);
}

async function rollback(pool: pg.Pool): Promise<void> {
  console.log('Rolling back MX-301 precise-competency activation…');
  const c = await pool.query(
    `UPDATE employer_candidates SET employer_id = $1, competency_profile = NULL WHERE id = $2`,
    [DEMO_EMPLOYER_TAG, SUBJECT],
  );
  // The probe job is net-new (this script created it) → remove it entirely on rollback.
  const j = await pool.query(`DELETE FROM employer_jobs WHERE id = $1`, [PROBE_JOB_ID]);
  const runs = await pool.query(
    `DELETE FROM onto_competency_score_runs WHERE subject_id = $1 AND source = $2`,
    [SUBJECT, RUN_SOURCE],
  );
  console.log(
    `  candidate restored=${c.rowCount}, probe-job removed=${j.rowCount}, runtime score-runs purged=${runs.rowCount}`,
  );
}

async function activate(pool: pg.Pool): Promise<void> {
  const orgId = await resolveElevatedOrgId(pool);

  // Guard: the demo candidate must already exist (provisioned by the demo seeder /
  // e2e). We ENRICH it — never invent the candidate here. (The probe job is created
  // below; it is a harness fixture, not real adoption data.)
  const exists = await pool.query(
    `SELECT 1 AS cand FROM employer_candidates WHERE id = $1`,
    [SUBJECT],
  );
  if (!exists.rows[0]?.cand) throw new Error(`employer_candidates row ${SUBJECT} missing — run the MX-301 demo seeder/e2e first.`);

  // ── 1. Generate a real assessment over the role_pm competencies ─────────────
  const gen: any = await generateAssessment(pool, {
    blueprintId: BLUEPRINT_ID,
    subjectId: SUBJECT,
    total: 40,
    roleId: ROLE_ID,
  });
  if (!gen.ok) throw new Error(`generateAssessment failed: ${gen.error}`);
  const questions: any[] = Array.isArray(gen.questions) ? gen.questions : [];
  console.log(`Generated assessment ${gen.instance_id}: ${questions.length} questions.`);
  if (questions.length === 0) throw new Error('generated assessment is empty — no approved questions to score.');

  // ── 2. Answer each question with its highest-scoring (authored-correct) option ─
  // The option scores come straight from deriveOptions (authored correct answer = 100).
  // Picking the max is a genuine strong-candidate response; scoring is done by the real
  // scorer, not by us.
  const responses = questions.map((q) => {
    const opts: any[] = Array.isArray(q.options) ? q.options : [];
    let bestIdx = 0;
    let bestScore = -Infinity;
    opts.forEach((o, i) => {
      const s = Number(o?.score);
      if (Number.isFinite(s) && s > bestScore) { bestScore = s; bestIdx = i; }
    });
    return { index: Number(q.index), selected_index: bestIdx };
  });

  const scored: any = await scoreAssessment(pool, { instanceId: gen.instance_id, responses });
  if (!scored.ok) throw new Error(`scoreAssessment failed: ${scored.error}`);
  const compScores: any[] = Array.isArray(scored.competency_scores) ? scored.competency_scores : [];
  console.log(
    `Scored: measurement=${scored.measurement}, overall=${scored.overall_score}, ` +
      `precise competencies=${compScores.length}` +
      (compScores.length ? ` (${compScores.map((c) => `${c.competency_id}=${c.scaled_score}`).join(', ')})` : ''),
  );
  if (compScores.length === 0) {
    throw new Error('no precise per-competency scores produced — onto_competency_question_map may be empty for this blueprint.');
  }

  // ── 3. Project her UNIFIED competency-granularity scores into competency_profile ─
  const unified = await resolveUnifiedCompetencyProfile(pool, SUBJECT);
  const profile: Record<string, number> = {};
  for (const s of unified.scores) {
    if (s.granularity === 'competency' && typeof s.score === 'number' && Number.isFinite(s.score)) {
      profile[s.key] = s.score; // 0..100; talent-engine coerceLevel divides by 20
    }
  }
  const projectedKeys = Object.keys(profile);
  if (projectedKeys.length === 0) throw new Error('unified profile surfaced no competency-granularity scores to project.');
  console.log(`Projecting ${projectedKeys.length} measured competency scores into competency_profile.`);

  // ── 4. Persist projection + align demo rows to the elevated org ─────────────
  await pool.query(
    `UPDATE employer_candidates SET competency_profile = $1::jsonb, email = $2, employer_id = $3 WHERE id = $2`,
    [JSON.stringify(profile), SUBJECT, orgId],
  );
  // Probe job that the persona-experience harness actually queries (org-scoped so
  // resolveScoped finds it under the elevated session). Title → role_pm Role DNA.
  await pool.query(
    `INSERT INTO employer_jobs (id, employer_id, title, status)
       VALUES ($1, $2, $3, 'open')
     ON CONFLICT (id) DO UPDATE SET employer_id = EXCLUDED.employer_id, title = EXCLUDED.title`,
    [PROBE_JOB_ID, orgId, PROBE_JOB_TITLE],
  );
  // Defensive cleanup: an earlier iteration scoped mx301_demo_job to the elevated org;
  // restore it to the demo employer tag so this script owns ONLY the probe job + candidate.
  await pool.query(
    `UPDATE employer_jobs SET employer_id = $1 WHERE id = 'mx301_demo_job' AND employer_id = $2`,
    [DEMO_EMPLOYER_TAG, orgId],
  );
  console.log(`Candidate + probe job (${PROBE_JOB_ID}) scoped to elevated org ${orgId.slice(0, 8)}… ; competency_profile populated.`);
  console.log('\nMX-301 precise-competency activation complete.');
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    if (process.argv.includes('--rollback')) {
      await rollback(pool);
    } else {
      await activate(pool);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
