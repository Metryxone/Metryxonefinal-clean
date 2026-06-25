import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const q = async (label: string, sql: string) => {
    try { const r = await pool.query(sql); console.log(`\n## ${label}`); console.log(JSON.stringify(r.rows.slice(0, 12), null, 2)); }
    catch (e: any) { console.log(`\n## ${label}\nERR ${e.message}`); }
  };
  try {
    // Role/industry linkage in TEXT space
    await q('distinct role_id in onto_role_competency_profiles', `SELECT DISTINCT role_id FROM onto_role_competency_profiles`);
    await q('roles tables present', `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name LIKE '%role%' OR table_name LIKE '%onet%') ORDER BY 1`);
    await q('onto_roles columns', `SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='onto_roles' ORDER BY ordinal_position`);
    await q('ont_roles columns', `SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='ont_roles' ORDER BY ordinal_position`);
    // O*NET name-bridge feasibility: onto canonical_name vs ont_competencies.name
    await q('O*NET exact name-match count', `SELECT count(*)::int n FROM onto_competencies o JOIN ont_competencies e ON lower(trim(o.canonical_name))=lower(trim(e.name)) WHERE o.deprecated IS NOT TRUE`);
    await q('O*NET sample matches', `SELECT o.id, o.canonical_name, e.code, e.external_ref FROM onto_competencies o JOIN ont_competencies e ON lower(trim(o.canonical_name))=lower(trim(e.name)) WHERE o.deprecated IS NOT TRUE LIMIT 8`);
    // Learning resources: skill_key overlap with competency slug/name
    await q('cg_skill_resource_map skill_key sample', `SELECT DISTINCT skill_key FROM cg_skill_resource_map LIMIT 12`);
    await q('learning-resource slug overlap count', `SELECT count(DISTINCT o.id)::int n FROM onto_competencies o JOIN cg_skill_resource_map m ON lower(trim(m.skill_key))=lower(trim(o.slug)) OR lower(trim(m.skill_key))=lower(trim(o.canonical_name)) WHERE o.deprecated IS NOT TRUE`);
    // Certifications: role_id space overlap
    await q('rr_certifications role_id sample', `SELECT DISTINCT role_id FROM rr_certifications LIMIT 12`);
    await q('cert role_id ∩ role profiles', `SELECT count(*)::int n FROM (SELECT DISTINCT role_id FROM rr_certifications) c JOIN (SELECT DISTINCT role_id FROM onto_role_competency_profiles) p ON c.role_id=p.role_id`);
    // Indicators: how many competencies have ANY indicator, and level spread
    await q('competencies with >=1 indicator', `SELECT count(DISTINCT competency_id)::int n FROM onto_indicators`);
    await q('competencies with indicators spanning >=2 levels', `SELECT count(*)::int n FROM (SELECT competency_id FROM onto_indicators GROUP BY competency_id HAVING count(DISTINCT proficiency_level)>=2) t`);
    // scoring_metadata / benchmark_metadata shape (assessment strategy)
    await q('scoring_metadata sample', `SELECT id, scoring_metadata FROM onto_competencies WHERE scoring_metadata::text <> '{}' LIMIT 2`);
    await q('benchmark_metadata empty count', `SELECT count(*)::int n FROM onto_competencies WHERE benchmark_metadata::text = '{}' OR benchmark_metadata IS NULL`);
    await q('role_relevance empty count', `SELECT count(*)::int n FROM onto_competencies WHERE role_relevance::text = '{}' OR role_relevance IS NULL`);
  } finally { await pool.end(); }
}
main().catch((e) => { console.error('FAILED', e); process.exit(1); });
