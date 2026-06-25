/**
 * Task #138 — end-to-end proof (transient; cleans up after itself).
 *
 * Proves that adding ADDITIONAL genome competencies (beyond the 33 role-DNA comps)
 * to the bridge-reachable roles' DNA + blueprints actually moves the employer
 * match metric:
 *   BASELINE — match an UNASSESSED candidate against a role => directMatchCount=0.
 *   AFTER    — assess the SAME candidate via the role's wired blueprint
 *              (generateAssessment serves the comp_*-coded approved questions) ->
 *              scoreAssessment writes PRECISE per-competency scores ->
 *              re-run match => directMatchCount RISES.
 *
 * It also reports WHICH of the Task #138 competencies became direct matches, so the
 * rise is attributable to the new (beyond-the-33) competencies, not fabrication.
 *
 * Subject/candidate uses an @example.com email (purgeable on the shared dev DB);
 * all transient rows are deleted at the end.
 */
import { Pool } from 'pg';
import { generateAssessment, scoreAssessment } from '../services/competency-runtime';
import { computeCompetencyDrivenMatch } from '../services/employer-competency-hiring';

// The 14 competencies introduced by Task #138 (beyond the 33 role-DNA comps).
const T138_COMPS = new Set<string>([
  'comp_customer_focus', 'comp_commercial_awareness', 'comp_negotiation', 'comp_creativity', 'comp_change_management',
  'comp_developing_people', 'comp_delegation', 'comp_constructive_feedback', 'comp_empathy',
  'comp_financial_acumen', 'comp_enterprise_risk_management', 'comp_balanced_judgment', 'comp_conceptual_thinking', 'comp_ethical_decision_making',
]);

const CASES: { blueprintId: string; jobTitle: string }[] = [
  { blueprintId: 'bp_pm_v1', jobTitle: 'Product Manager' },
  { blueprintId: 'bp_eng_manager_t138', jobTitle: 'Engineering Manager' },
  { blueprintId: 'bp_credit_analyst_t138', jobTitle: 'Credit Analyst' },
];

async function run(pool: Pool, blueprintId: string, jobTitle: string) {
  const email = `t138_${blueprintId}@example.com`;
  const candidate = { email };
  const job = { id: `t138_job_${blueprintId}`, title: jobTitle };

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
  const preciseT138 = precise.filter((c: any) => T138_COMPS.has(c.competency_id));
  console.log(`  assessed: ${gen.total_questions} qs -> ${precise.length} PRECISE comp scores (${preciseT138.length} are Task #138 comps)`);

  // AFTER — same candidate, now assessed.
  const after = await computeCompetencyDrivenMatch(pool, { candidate, job });
  console.log(`AFTER : total reqs=${after.totalRequirementCount}, direct=${after.directMatchCount}, proxy=${after.domainProxyMatchCount}`);

  // Which Task #138 comps are now counted as DIRECT matches?
  const directT138 = (after.requirements ?? [])
    .filter((d: any) => d.matchVia === 'direct_competency' && T138_COMPS.has(d.code))
    .map((d: any) => d.code);

  const rose = after.directMatchCount > before.directMatchCount;
  console.log(`  => directMatchCount ${before.directMatchCount} -> ${after.directMatchCount} (${rose ? 'ROSE ✓' : 'no change'})`);
  if (directT138.length > 0) console.log(`  Task #138 comps now DIRECT: [${directT138.join(', ')}]`);

  // Cleanup transient rows for this subject.
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
      const r = await run(pool, c.blueprintId, c.jobTitle);
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
