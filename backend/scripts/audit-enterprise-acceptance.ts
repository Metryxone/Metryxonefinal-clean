/**
 * Evidence gatherer for the Enterprise Acceptance PASS/FAIL audit (read-only).
 * Regenerates every live count cited in
 *   backend/audit/98x-gap-closure/enterprise_acceptance_report.md
 * Run: npx tsx scripts/audit-enterprise-acceptance.ts
 * No data is mutated.
 */
import { Pool } from 'pg';

const p = new Pool({ connectionString: process.env.DATABASE_URL });

async function q(label: string, sql: string) {
  try {
    const r = await p.query(sql);
    console.log(label + ': ' + JSON.stringify(r.rows.length === 1 ? r.rows[0] : r.rows));
  } catch (e) {
    console.log(label + ': ERR ' + (e as Error).message);
  }
}
async function tExists(name: string): Promise<boolean> {
  try { const r = await p.query('SELECT to_regclass($1) reg', [name]); return !!r.rows[0]?.reg; }
  catch { return false; }
}

async function main() {
  console.log('### 1. ROLE RESOLUTION');
  await q('industries', 'SELECT COUNT(*)::int n, COUNT(*) FILTER (WHERE is_active)::int act FROM ont_industries');
  await q('functions', 'SELECT COUNT(*)::int n, COUNT(*) FILTER (WHERE is_cross_industry)::int xind FROM ont_functions');
  await q('departments', 'SELECT COUNT(*)::int n FROM ont_departments');
  await q('role_families', 'SELECT COUNT(*)::int n FROM ont_role_families');
  await q('roles', 'SELECT COUNT(*)::int n, COUNT(*) FILTER (WHERE is_active)::int act, COUNT(*) FILTER (WHERE is_leadership)::int lead FROM ont_roles');
  await q('orphan_roles_no_family', 'SELECT COUNT(*)::int n FROM ont_roles r WHERE r.role_family_id IS NULL OR NOT EXISTS(SELECT 1 FROM ont_role_families f WHERE f.id=r.role_family_id)');
  await q('orphan_families_no_dept', 'SELECT COUNT(*)::int n FROM ont_role_families f WHERE f.department_id IS NULL OR NOT EXISTS(SELECT 1 FROM ont_departments d WHERE d.id=f.department_id)');
  await q('orphan_depts_no_func', 'SELECT COUNT(*)::int n FROM ont_departments d WHERE d.function_id IS NULL OR NOT EXISTS(SELECT 1 FROM ont_functions fn WHERE fn.id=d.function_id)');
  await q('functions_has_industry_fk_col', "SELECT COUNT(*)::int n FROM information_schema.columns WHERE table_name='ont_functions' AND column_name ILIKE '%industry_id%'");
  await q('full_chain_resolvable (role->family->dept->func)', 'SELECT COUNT(*)::int n FROM ont_roles r JOIN ont_role_families f ON f.id=r.role_family_id JOIN ont_departments d ON d.id=f.department_id JOIN ont_functions fn ON fn.id=d.function_id');
  await q('roles_with_competency_links', 'SELECT COUNT(DISTINCT role_id)::int n FROM map_role_competency WHERE is_active');
  await q('roles_no_dna', 'SELECT COUNT(*)::int n FROM ont_roles r WHERE NOT EXISTS(SELECT 1 FROM map_role_competency m WHERE m.role_id=r.id AND m.is_active)');

  console.log('### 2. ROLE DNA / INHERITANCE');
  await q('snapshots', 'SELECT COUNT(*)::int n, COUNT(*) FILTER (WHERE curated_precedence)::int curated, ROUND(AVG(confidence)::numeric,3) avgconf FROM role_dna_expansion_snapshots');
  await q('snapshot_bands', 'SELECT confidence_band, COUNT(*)::int n FROM role_dna_expansion_snapshots GROUP BY confidence_band ORDER BY n DESC');
  await q('mrc_inheritance_nulls', 'SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE weight IS NULL)::int null_weight, COUNT(*) FILTER (WHERE target_proficiency IS NULL)::int null_target, COUNT(*) FILTER (WHERE min_proficiency IS NULL)::int null_min, COUNT(*) FILTER (WHERE importance_tier IS NULL)::int null_tier FROM map_role_competency WHERE is_active');
  await q('dna_benchmark_available', "SELECT (dna->'benchmark'->>'available') avail, COUNT(*)::int n FROM role_dna_expansion_snapshots GROUP BY 1");
  await q('dna_competency_types', "SELECT req->>'competencyType' ctype, COUNT(*)::int n FROM role_dna_expansion_snapshots s, jsonb_array_elements(s.dna->'requirements') req GROUP BY 1 ORDER BY n DESC");
  await q('genome_scientific_types', 'SELECT scientific_type, COUNT(*)::int n FROM onto_competencies GROUP BY scientific_type ORDER BY n DESC');

  console.log('### 3. O*NET INTELLIGENCE');
  await q('map_role_competency', 'SELECT COUNT(*)::int n, COUNT(DISTINCT role_id)::int roles, COUNT(DISTINCT competency_id)::int comps FROM map_role_competency');
  await q('curated_onto_role_bridge', 'SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE ont_role_id IS NOT NULL)::int resolved FROM map_ont_onto_role');
  await q('benchmarks', 'SELECT COUNT(*)::int n FROM ti_role_benchmarks');
  await q('validated_crosswalks (snapshots w/ confidence)', 'SELECT COUNT(*)::int n FROM role_dna_expansion_snapshots WHERE confidence IS NOT NULL');

  console.log('### 4-5. QUESTION GENERATION');
  await q('question_templates', 'SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE status=\'approved\')::int approved FROM competency_question_templates');
  await q('q_orphans', "SELECT COUNT(*) FILTER (WHERE competency_code IS NULL OR competency_code='')::int no_comp, COUNT(*) FILTER (WHERE difficulty_band IS NULL)::int no_diff, COUNT(*) FILTER (WHERE question_type IS NULL)::int no_type FROM competency_question_templates");
  await q('q_by_type', 'SELECT question_type, COUNT(*)::int n FROM competency_question_templates GROUP BY question_type ORDER BY n DESC');

  console.log('### 7. SCORING LEDGERS');
  if (await tExists('onto_competency_score_runs')) await q('score_runs', 'SELECT COUNT(*)::int n, COUNT(DISTINCT subject_id)::int subjects FROM onto_competency_score_runs');
  if (await tExists('onto_competency_profiles')) await q('competency_profiles', 'SELECT COUNT(*)::int n, COUNT(DISTINCT subject_id)::int subjects FROM onto_competency_profiles');

  console.log('### 8-10. CAREER BUILDER / PASSPORT');
  for (const t of ['career_seeker_profiles', 'cg_user_recommendations', 'career_recommendation_history', 'career_passport_snapshots']) {
    if (await tExists(t)) await q(t, `SELECT COUNT(*)::int n FROM ${t}`); else console.log(t + ': ABSENT');
  }

  console.log('### 11. VALIDATION LOOP (realized outcomes)');
  for (const t of ['career_outcomes', 'hiring_outcomes', 'interview_outcomes', 'tig_calibration', 'ti_outcome_predictions', 'wc3_outcome_state', 'pil_intervention_outcomes']) {
    if (await tExists(t)) await q(t, `SELECT COUNT(*)::int n FROM ${t}`); else console.log(t + ': ABSENT');
  }

  console.log('### 12. ENTERPRISE SCALE');
  if (await tExists('tenants')) await q('tenants', 'SELECT COUNT(*)::int n FROM tenants');
  for (const t of ['employer_candidates', 'employer_jobs']) {
    if (await tExists(t)) await q(t, `SELECT COUNT(*)::int n FROM ${t}`); else console.log(t + ': ABSENT');
  }

  await p.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
