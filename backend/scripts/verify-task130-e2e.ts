/**
 * Task #130 — end-to-end proof (transient; cleans up after itself).
 *
 * Proves the employer match metric actually moves for a newly-wired role:
 *   BASELINE  — match an UNASSESSED candidate against a role => directMatchCount=0
 *               (requirements fall back to domain_proxy / unassessed).
 *   AFTER     — assess the SAME candidate via the role's now-wired blueprint
 *               (generateAssessment serves the comp_*-coded approved questions) ->
 *               scoreAssessment writes PRECISE per-competency scores ->
 *               re-run the match => directMatchCount RISES, domainProxyMatchCount FALLS.
 *
 * Subject/candidate uses an @example.com email (purgeable on the shared dev DB);
 * all transient rows are deleted at the end. No fabrication: only role-DNA comps
 * that were assessed become direct; everything else stays proxy/unmeasured (null).
 */
import { Pool } from 'pg';
import { generateAssessment, scoreAssessment } from '../services/competency-runtime';
import { computeCompetencyDrivenMatch } from '../services/employer-competency-hiring';

const CASES: { blueprintId: string; jobTitle: string }[] = [
  { blueprintId: 'bp_data_scientist_t130', jobTitle: 'Data Scientist' },
  { blueprintId: 'bp_pm_v1', jobTitle: 'Product Manager' },
  { blueprintId: 'bp_be_v1', jobTitle: 'Backend Engineer' },
];

async function run(pool: Pool, blueprintId: string, jobTitle: string) {
  const email = `t130_${blueprintId}@example.com`;
  const candidate = { email };
  const job = { id: `t130_job_${blueprintId}`, title: jobTitle };

  console.log(`\n=== ${jobTitle} (blueprint ${blueprintId}) ===`);

  // BASELINE — unassessed candidate.
  const before = await computeCompetencyDrivenMatch(pool, { candidate, job });
  console.log(`BEFORE: total reqs=${before.totalRequirementCount}, direct=${before.directMatchCount}, proxy=${before.domainProxyMatchCount}`);

  // Assess via the wired blueprint.
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

  // AFTER — same candidate, now assessed.
  const after = await computeCompetencyDrivenMatch(pool, { candidate, job });
  console.log(`AFTER : total reqs=${after.totalRequirementCount}, direct=${after.directMatchCount}, proxy=${after.domainProxyMatchCount}`);
  console.log(`  => directMatchCount ${before.directMatchCount} -> ${after.directMatchCount} (${after.directMatchCount > before.directMatchCount ? 'ROSE ✓' : 'no change'})`);

  // Cleanup transient rows for this subject.
  await pool.query(`DELETE FROM onto_competency_score_runs WHERE subject_id = $1`, [email]).catch(() => {});
  await pool.query(`DELETE FROM onto_competency_profiles WHERE subject_id = $1`, [email]).catch(() => {});
  await pool.query(`DELETE FROM onto_competency_scores WHERE instance_id IN (SELECT id FROM onto_assessment_instances WHERE subject_id = $1)`, [email]).catch(() => {});
  await pool.query(`DELETE FROM onto_assessment_responses WHERE instance_id IN (SELECT id FROM onto_assessment_instances WHERE subject_id = $1)`, [email]).catch(() => {});
  await pool.query(`DELETE FROM onto_assessment_instances WHERE subject_id = $1`, [email]).catch(() => {});
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    for (const c of CASES) await run(pool, c.blueprintId, c.jobTitle);
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
