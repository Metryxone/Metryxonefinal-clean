/**
 * Task #151 — end-to-end proof (transient; cleans up after itself).
 *
 * Proves that bridging the engineering curated roles (QA / DevOps / Frontend /
 * Full Stack / Software / Senior Software Engineer) to dedicated curated ont_roles
 * (+ authored questions + blueprint wiring) actually moves the employer match
 * metric:
 *   BASELINE — match an UNASSESSED candidate against the role => directMatchCount=0.
 *   AFTER    — assess the SAME candidate via the role's wired blueprint
 *              (generateAssessment serves the comp_*-coded approved questions) ->
 *              scoreAssessment writes PRECISE per-competency scores ->
 *              re-run match => directMatchCount RISES.
 *
 * It also reports WHICH competencies became direct matches, so the rise is
 * attributable to the curated Role DNA, not fabrication.
 *
 * Candidate uses an @example.com email (purgeable on the shared dev DB); all
 * transient rows are deleted at the end.
 */
import { Pool } from 'pg';
import { generateAssessment, scoreAssessment } from '../services/competency-runtime';
import { computeCompetencyDrivenMatch } from '../services/employer-competency-hiring';

const CASES: { roleId: string; jobTitle: string }[] = [
  { roleId: 'role_qa_eng', jobTitle: 'QA Engineer' },
  { roleId: 'role_devops_eng', jobTitle: 'DevOps Engineer' },
  { roleId: 'role_fe_eng', jobTitle: 'Frontend Engineer' },
  { roleId: 'role_fullstack_eng', jobTitle: 'Full Stack Engineer' },
  { roleId: 'role_software_eng', jobTitle: 'Software Engineer' },
  { roleId: 'role_sr_software_eng', jobTitle: 'Senior Software Engineer' },
];

async function resolveBlueprint(pool: Pool, roleId: string): Promise<string | null> {
  const r = await pool.query<{ id: string }>(
    `SELECT id FROM onto_assessment_blueprints
      WHERE source_role_id = $1 ORDER BY (id LIKE 'bp\\_%') DESC, created_at LIMIT 1`,
    [roleId],
  );
  return r.rowCount && r.rowCount > 0 ? r.rows[0].id : null;
}

async function run(pool: Pool, roleId: string, jobTitle: string) {
  const email = `t151_${roleId}@example.com`;
  const candidate = { email };
  const job = { id: `t151_job_${roleId}`, title: jobTitle };

  console.log(`\n=== ${jobTitle} (${roleId}) ===`);

  const blueprintId = await resolveBlueprint(pool, roleId);
  if (!blueprintId) { console.log('  NO blueprint resolved — skipping'); return; }

  const before = await computeCompetencyDrivenMatch(pool, { candidate, job });
  console.log(`BEFORE: total reqs=${before.totalRequirementCount}, direct=${before.directMatchCount}, proxy=${before.domainProxyMatchCount}`);

  const gen = await generateAssessment(pool, { blueprintId, subjectId: email });
  if (!gen.ok) { console.log('  GENERATE FAILED:', gen.error); return; }
  const responses = (gen.questions ?? []).map((q) => {
    let bi = 0, bs = -Infinity;
    q.options.forEach((o, i) => { if (Number(o.score) > bs) { bs = Number(o.score); bi = i; } });
    return { index: q.index, selected_index: bi };
  });
  const scored = await scoreAssessment(pool, { instanceId: gen.instance_id!, subjectId: email, responses });
  if (!scored.ok) { console.log('  SCORE FAILED:', scored.error); return; }
  const precise = (scored.competency_scores ?? []).filter((c: any) => c.measurement === 'precise');
  console.log(`  assessed: ${gen.total_questions} qs -> ${precise.length} PRECISE comp scores`);

  const after = await computeCompetencyDrivenMatch(pool, { candidate, job });
  console.log(`AFTER : total reqs=${after.totalRequirementCount}, direct=${after.directMatchCount}, proxy=${after.domainProxyMatchCount}`);

  const directNow = (after.requirements ?? [])
    .filter((d: any) => d.matchVia === 'direct_competency')
    .map((d: any) => d.code);

  const rose = after.directMatchCount > before.directMatchCount;
  console.log(`  => directMatchCount ${before.directMatchCount} -> ${after.directMatchCount} (${rose ? 'ROSE ✓' : 'no change'})`);
  if (directNow.length > 0) console.log(`  comps now DIRECT: [${directNow.join(', ')}]`);

  await pool.query(`DELETE FROM onto_competency_score_runs WHERE subject_id = $1`, [email]).catch(() => {});
  await pool.query(`DELETE FROM onto_competency_profiles WHERE subject_id = $1`, [email]).catch(() => {});
  await pool.query(`DELETE FROM onto_competency_scores WHERE instance_id IN (SELECT id FROM onto_assessment_instances WHERE subject_id = $1)`, [email]).catch(() => {});
  await pool.query(`DELETE FROM onto_assessment_responses WHERE instance_id IN (SELECT id FROM onto_assessment_instances WHERE subject_id = $1)`, [email]).catch(() => {});
  await pool.query(`DELETE FROM onto_assessment_instances WHERE subject_id = $1`, [email]).catch(() => {});

  return rose;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const results: boolean[] = [];
    for (const c of CASES) {
      const r = await run(pool, c.roleId, c.jobTitle);
      if (r !== undefined) results.push(r);
    }
    console.log('\n' + '='.repeat(60));
    const rose = results.filter(Boolean).length;
    console.log(`SUMMARY: directMatchCount rose for ${rose}/${results.length} bridged roles.`);
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
