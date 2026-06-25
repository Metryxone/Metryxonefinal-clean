import { Pool } from 'pg';

const TABLES = [
  'onto_competencies','onto_indicators','onto_proficiency_levels','onto_role_competency_profiles',
  'onto_competency_master_ext','onto_families','onto_functions','onto_domains',
  'ont_competencies','ont_industries','onto_industries','cg_skill_resource_map','rr_certifications',
  'map_industry_competency','map_competency_proficiency','map_competency_learning_path','map_role_competency',
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const cols = await pool.query(
      `SELECT table_name, column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name = ANY($1)
       ORDER BY table_name, ordinal_position`, [TABLES]);
    const byTable: Record<string, string[]> = {};
    for (const r of cols.rows) (byTable[r.table_name] ||= []).push(`${r.column_name}:${r.data_type}${r.is_nullable === 'NO' ? '!' : ''}`);
    for (const t of TABLES) {
      let count = 'n/a';
      if (byTable[t]) { try { const c = await pool.query(`SELECT count(*)::int n FROM ${t}`); count = String(c.rows[0].n); } catch { count = 'ERR'; } }
      console.log(`\n== ${t} (rows=${count}) ==`);
      console.log(byTable[t] ? byTable[t].join(', ') : '  (NOT FOUND)');
    }
    // Sample existing real content shapes
    console.log('\n\n### SAMPLE onto_indicators (3) ###');
    try { const s = await pool.query('SELECT * FROM onto_indicators LIMIT 3'); console.log(JSON.stringify(s.rows, null, 2)); } catch (e: any) { console.log('ERR', e.message); }
    console.log('\n### SAMPLE onto_proficiency_levels (6) ###');
    try { const s = await pool.query('SELECT * FROM onto_proficiency_levels ORDER BY 1 LIMIT 6'); console.log(JSON.stringify(s.rows, null, 2)); } catch (e: any) { console.log('ERR', e.message); }
    console.log('\n### SAMPLE onto_competencies (1) ###');
    try { const s = await pool.query('SELECT * FROM onto_competencies LIMIT 1'); console.log(JSON.stringify(s.rows, null, 2)); } catch (e: any) { console.log('ERR', e.message); }
    console.log('\n### SAMPLE onto_role_competency_profiles (2) ###');
    try { const s = await pool.query('SELECT * FROM onto_role_competency_profiles LIMIT 2'); console.log(JSON.stringify(s.rows, null, 2)); } catch (e: any) { console.log('ERR', e.message); }
  } finally { await pool.end(); }
}
main().catch((e) => { console.error('FAILED', e); process.exit(1); });
