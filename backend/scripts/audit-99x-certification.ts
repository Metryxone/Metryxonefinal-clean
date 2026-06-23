/**
 * MX-99X Enterprise Competency Certification — reproducible read-only evidence.
 * Regenerates every live count cited in backend/audit/99x-certification/*.md
 * Run: npx tsx scripts/audit-99x-certification.ts
 * No data is mutated (SELECT / to_regclass only).
 */
import { Pool } from 'pg';
const p = new Pool({ connectionString: process.env.DATABASE_URL });
async function q(label: string, sql: string) {
  try { const r = await p.query(sql); console.log(label + ': ' + JSON.stringify(r.rows.length === 1 ? r.rows[0] : r.rows)); }
  catch (e) { console.log(label + ': ERR ' + (e as Error).message); }
}
async function main() {
  console.log('=== §1/§12 SCALE & RESOLUTION ===');
  await q('scale', `SELECT (SELECT COUNT(*)::int FROM ont_industries) industries,(SELECT COUNT(*)::int FROM ont_functions) functions,(SELECT COUNT(*)::int FROM ont_departments) departments,(SELECT COUNT(*)::int FROM ont_role_families) families,(SELECT COUNT(*)::int FROM ont_roles) roles,(SELECT COUNT(*)::int FROM tenants) tenants`);
  await q('functions_industry_fk', `SELECT COUNT(*)::int n FROM information_schema.columns WHERE table_name='ont_functions' AND column_name ILIKE '%industry_id%'`);
  await q('orphans', `SELECT (SELECT COUNT(*)::int FROM ont_roles r WHERE r.role_family_id IS NULL OR NOT EXISTS(SELECT 1 FROM ont_role_families f WHERE f.id=r.role_family_id)) orphan_roles,(SELECT COUNT(*)::int FROM ont_role_families f WHERE f.department_id IS NULL OR NOT EXISTS(SELECT 1 FROM ont_departments d WHERE d.id=f.department_id)) orphan_families,(SELECT COUNT(*)::int FROM ont_departments d WHERE d.function_id IS NULL OR NOT EXISTS(SELECT 1 FROM ont_functions fn WHERE fn.id=d.function_id)) orphan_depts`);

  console.log('=== §2 ROLE DNA ===');
  await q('snapshots', `SELECT COUNT(*)::int rows, COUNT(DISTINCT role_code)::int roles, ROUND(AVG(confidence)::numeric,3) avgconf, COUNT(*) FILTER (WHERE confidence_band='high')::int high FROM role_dna_expansion_snapshots`);
  await q('inheritance', `SELECT COUNT(*)::int rows, COUNT(DISTINCT role_id)::int roles, COUNT(*) FILTER (WHERE weight IS NULL)::int null_weight, COUNT(*) FILTER (WHERE min_proficiency IS NULL)::int null_min, COUNT(*) FILTER (WHERE target_proficiency IS NULL)::int null_target FROM map_role_competency WHERE is_active`);
  await q('comp_per_role', `SELECT MIN(c)::int min,ROUND(AVG(c),1) avg,MAX(c)::int max FROM (SELECT role_id,COUNT(*) c FROM map_role_competency WHERE is_active GROUP BY role_id) t`);
  await q('dup_pairs', `SELECT COUNT(*)::int n FROM (SELECT role_id,competency_id,COUNT(*) c FROM map_role_competency WHERE is_active GROUP BY role_id,competency_id HAVING COUNT(*)>1) t`);
  await q('roles_no_links', `SELECT COUNT(*)::int n FROM ont_roles r WHERE NOT EXISTS(SELECT 1 FROM map_role_competency m WHERE m.role_id=r.id AND m.is_active)`);
  await q('dna_benchmark_available', `SELECT (dna->'benchmark'->>'available') avail, COUNT(*)::int n FROM role_dna_expansion_snapshots GROUP BY 1`);
  await q('role_benchmarks', `SELECT COUNT(*)::int n FROM ti_role_benchmarks`);

  console.log('=== §3 O*NET CROSSWALK ===');
  await q('map_role_competency', `SELECT COUNT(*)::int rows, COUNT(DISTINCT role_id)::int roles, COUNT(DISTINCT competency_id)::int comps FROM map_role_competency`);
  await q('map_ont_onto_role', `SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE ont_role_id IS NOT NULL)::int resolved, COUNT(*) FILTER (WHERE verified)::int verified FROM map_ont_onto_role`);

  console.log('=== §4 ASSESSMENT ===');
  await q('question_templates', `SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE status='approved')::int approved, COUNT(DISTINCT competency_code)::int distinct_comps FROM competency_question_templates`);
  await q('q_orphans', `SELECT COUNT(*) FILTER (WHERE competency_code IS NULL OR competency_code='')::int no_comp, COUNT(*) FILTER (WHERE difficulty_band IS NULL)::int no_diff, COUNT(*) FILTER (WHERE question_type IS NULL)::int no_type FROM competency_question_templates`);
  await q('question_map', `SELECT COUNT(*)::int rows, COUNT(DISTINCT competency_id)::int comps FROM onto_competency_question_map`);

  console.log('=== §6 NORMALIZATION (5 types) ===');
  await q('type_map_coverage', `SELECT (SELECT COUNT(*)::int FROM onto_competencies) genome, (SELECT COUNT(DISTINCT competency_id)::int FROM onto_competency_type_map) mapped, (SELECT COUNT(*) FILTER (WHERE needs_review)::int FROM onto_competency_type_map) needs_review`);
  await q('type_distribution', `SELECT type_key, COUNT(*)::int n FROM onto_competency_type_map GROUP BY type_key ORDER BY n DESC`);

  console.log('=== §7 SCORING ===');
  await q('ledgers', `SELECT (SELECT COUNT(*)::int FROM onto_competency_score_runs) score_runs, (SELECT COUNT(DISTINCT subject_id)::int FROM onto_competency_score_runs) run_subjects, (SELECT COUNT(*)::int FROM onto_competency_profiles) profiles, (SELECT COUNT(DISTINCT subject_id)::int FROM onto_competency_profiles) profile_subjects`);

  console.log('=== §8/§9/§10 CAREER / EMPLOYER / OUTCOMES ===');
  await q('career_passport', `SELECT (SELECT COUNT(*)::int FROM career_seeker_profiles) seekers, (SELECT COUNT(*)::int FROM cg_user_recommendations) recs, (SELECT COUNT(*)::int FROM career_passport_snapshots) passports`);
  await q('employer', `SELECT (SELECT COUNT(*)::int FROM employer_candidates) candidates, (SELECT COUNT(*)::int FROM employer_jobs) jobs`);
  await q('outcomes', `SELECT (SELECT COUNT(*)::int FROM career_outcomes) career_outcomes,(SELECT COUNT(*)::int FROM hiring_outcomes) hiring_outcomes,(SELECT COUNT(*)::int FROM interview_outcomes) interview_outcomes,(SELECT COUNT(*)::int FROM tig_calibration) tig_calibration,(SELECT COUNT(*)::int FROM ti_outcome_predictions) ti_outcome_predictions`);
  await p.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
