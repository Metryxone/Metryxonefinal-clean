/** MX-202B — confirm schema facts I depend on before writing migrations. READ-ONLY. */
import { Pool } from 'pg';
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const cols = async (t: string) => {
      const r = await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [t]);
      console.log(`\n${t}:`, r.rows.length ? r.rows.map((x: any) => `${x.column_name}:${x.data_type}`).join(', ') : '(absent)');
    };
    for (const t of ['onto_competencies', 'onto_indicators', 'onto_proficiency_levels',
      'onto_competency_versions', 'onto_audit_logs', 'role_dna_governance', 'onet_crosswalk_decisions',
      'onto_competency_onet_crosswalk', 'onto_domains', 'onto_families']) {
      await cols(t);
    }
    // global proficiency descriptors
    const pl = await pool.query(`SELECT * FROM onto_proficiency_levels ORDER BY 1 LIMIT 6`).catch((e) => ({ rows: [{ err: e.message }] }));
    console.log('\nproficiency_levels sample:', JSON.stringify(pl.rows, null, 2));
    // sample competency row
    const c = await pool.query(`SELECT id, canonical_name, slug, scientific_type, domain_id, family_id, left(definition,80) def FROM onto_competencies WHERE deprecated IS NOT TRUE LIMIT 3`);
    console.log('\ncompetency sample:', JSON.stringify(c.rows, null, 2));
    // domains + families sample for mapping derivation
    const d = await pool.query(`SELECT * FROM onto_domains LIMIT 6`).catch((e) => ({ rows: [{ err: e.message }] }));
    console.log('\ndomains:', JSON.stringify(d.rows, null, 2));
  } finally { await pool.end(); }
}
main().catch((e) => { console.error('FAILED', e); process.exit(1); });
