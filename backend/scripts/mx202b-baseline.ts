/**
 * MX-202B — Baseline probe (READ-ONLY). Measures the TRUE current implementation state across
 * everything MX-202B's success criteria touch, so the completion plan is grounded in reality,
 * not assumption. No writes, no DDL.
 */
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const q = async (sql: string, args: any[] = []) => {
      try { const r = await pool.query(sql, args); return r; } catch (e: any) { return { rows: [{ err: e.message }], rowCount: -1 } as any; }
    };
    const n = async (sql: string, args: any[] = []): Promise<number | null> => {
      try { const r = await pool.query(sql, args); const v = r.rows[0]?.n; return v == null ? null : Number(v); }
      catch { return null; }
    };
    const exists = async (t: string): Promise<boolean> => {
      const r = await q(`SELECT to_regclass($1) AS x`, [t]);
      return !!r.rows[0]?.x;
    };

    console.log('=== MX-202B BASELINE (read-only) ===\n');

    // 1. Genome size + native attribute coverage
    const total = await n(`SELECT count(*)::int n FROM onto_competencies WHERE deprecated IS NOT TRUE`);
    console.log('Genome (onto_competencies active):', total);

    const cov = await q(`
      SELECT
        count(*) FILTER (WHERE definition IS NOT NULL AND definition <> '')::int def,
        count(*) FILTER (WHERE domain_id IS NOT NULL)::int dom,
        count(*) FILTER (WHERE family_id IS NOT NULL)::int fam,
        count(*) FILTER (WHERE scientific_type IS NOT NULL)::int sci,
        count(*) FILTER (WHERE scoring_metadata::text NOT IN ('null','{}','[]'))::int scoring,
        count(*) FILTER (WHERE benchmark_metadata::text NOT IN ('null','{}','[]'))::int bench
      FROM onto_competencies WHERE deprecated IS NOT TRUE`);
    console.log('Native coverage:', cov.rows[0]);

    const ind = await q(`
      SELECT count(DISTINCT competency_id)::int comps,
             count(*)::int rows,
             count(DISTINCT competency_id) FILTER (WHERE lv >= 2)::int comps_2lvl
      FROM (SELECT competency_id, count(DISTINCT proficiency_level) lv FROM onto_indicators GROUP BY competency_id) t`);
    console.log('Indicators:', ind.rows[0]);

    const dna = await n(`SELECT count(DISTINCT competency_id)::int n FROM onto_role_competency_profiles WHERE active IS TRUE`);
    console.log('Role DNA (distinct comps in onto_role_competency_profiles active):', dna);

    // 2. Candidate canonical-home tables (presence + row counts)
    const tables = [
      'onto_competencies', 'onto_indicators', 'onto_proficiency_levels', 'onto_competency_master_ext',
      'onto_role_competency_profiles', 'onto_families', 'onto_domains', 'onto_competency_type_map',
      'onto_competency_question_map', 'competency_question_templates',
      'onto_competency_onet_crosswalk', 'onto_competency_resource_map', 'onto_competency_certification_map',
      'map_competency_proficiency', 'map_industry_competency', 'map_competency_learning_path',
      'map_role_competency',
      // governed-draft / governance / approval / audit candidates:
      'onto_competency_evidence', 'onto_competency_learning_outcomes', 'onto_competency_function_map',
      'onto_competency_industry_map', 'onto_competency_department_map',
      'qf_question_packs', 'qf_generation_runs', 'question_factory_runs',
      'onto_governance_decisions', 'onto_crosswalk_decisions', 'role_dna_governance_decisions',
      'onto_competency_draft_content', 'onto_competency_content_versions', 'onto_competency_audit',
    ];
    console.log('\n=== table presence / row counts ===');
    for (const t of tables) {
      if (await exists(t)) {
        const c = await n(`SELECT count(*)::int n FROM ${t}`);
        console.log(`  ${t.padEnd(42)} EXISTS  rows=${c}`);
      } else {
        console.log(`  ${t.padEnd(42)} (absent)`);
      }
    }

    // 3. Question factory draft coverage (assessment-ready via governed drafts)
    if (await exists('competency_question_templates')) {
      const cols = await q(`SELECT column_name FROM information_schema.columns WHERE table_name='competency_question_templates' ORDER BY ordinal_position`);
      console.log('\ncompetency_question_templates columns:', cols.rows.map((r: any) => r.column_name).join(', '));
      const byStatus = await q(`SELECT status, count(*)::int n FROM competency_question_templates GROUP BY status ORDER BY n DESC`);
      console.log('templates by status:', byStatus.rows);
      const qrs = await q(`SELECT quality_review_status, count(*)::int n FROM competency_question_templates GROUP BY quality_review_status ORDER BY n DESC`).catch(() => ({ rows: [] }));
      console.log('templates by quality_review_status:', qrs.rows);
    }
    if (await exists('onto_competency_question_map')) {
      const mapCov = await n(`SELECT count(DISTINCT competency_id)::int n FROM onto_competency_question_map`);
      console.log('onto_competency_question_map distinct competencies:', mapCov);
      const activeCov = await n(`SELECT count(DISTINCT competency_id)::int n FROM onto_competency_question_map WHERE active IS TRUE`);
      console.log('onto_competency_question_map distinct ACTIVE competencies:', activeCov);
    }

    // 4. master_ext eligibility coverage
    if (await exists('onto_competency_master_ext')) {
      const elig = await q(`
        SELECT
          count(*) FILTER (WHERE assessment_eligible IS TRUE)::int assess,
          count(*) FILTER (WHERE employer_eligible IS TRUE)::int employer,
          count(*) FILTER (WHERE career_builder_eligible IS TRUE)::int career,
          count(*) FILTER (WHERE ei_eligible IS TRUE)::int ei,
          count(*) FILTER (WHERE learning_eligible IS TRUE)::int learning,
          count(*) FILTER (WHERE future_ready_eligible IS TRUE)::int future,
          count(*)::int rows
        FROM onto_competency_master_ext`);
      console.log('\nmaster_ext eligibility:', elig.rows[0]);
    }

    console.log('\n=== END BASELINE ===');
  } finally {
    await pool.end();
  }
}
main().catch((e) => { console.error('FAILED', e); process.exit(1); });
