/**
 * Phase 2 e2e smoke test (engine-level, flag ON).
 * Seeds DEMO approved question templates, walks the full runtime chain against a
 * real blueprint, prints results, then CLEANS UP every demo row. Idempotent.
 *
 *   FF_COMPETENCY_RUNTIME=1 tsx scripts/phase2-runtime-smoke.ts
 */
process.env.FF_COMPETENCY_RUNTIME = '1';

import { Pool } from 'pg';
import {
  generateAssessment, scoreAssessment, getProfile, computeGapAnalysis,
} from '../services/competency-runtime.js';
import { isCompetencyRuntimeEnabled } from '../config/feature-flags.js';

const BLUEPRINT = process.env.SMOKE_BLUEPRINT || 'blueprint_pm';
const SUBJECT = 'demo_phase2_subject@example.com';
const CODES = ['COG', 'COM', 'LEA', 'EXE', 'ADP', 'TEC', 'EIQ'];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const log = (...a: any[]) => console.log(...a);
  log('flag isCompetencyRuntimeEnabled():', isCompetencyRuntimeEnabled());

  try {
    // ---- seed demo approved templates (3 per code) -------------------------
    for (const code of CODES) {
      for (let n = 1; n <= 3; n++) {
        await pool.query(
          `INSERT INTO competency_question_templates (template_key, competency_code, question_type, template_body, status, source)
           VALUES ($1,$2,'likert',$3::jsonb,'approved','seed')
           ON CONFLICT (template_key) DO NOTHING`,
          [`demo_phase2_${code}_${n}`, code, JSON.stringify({ prompt: `Demo ${code} item ${n}` })],
        );
      }
    }
    log('seeded demo templates');

    // ---- 1. GENERATE -------------------------------------------------------
    const gen = await generateAssessment(pool, { blueprintId: BLUEPRINT, subjectId: SUBJECT, total: 14 });
    log('\n=== GENERATE ===');
    log('ok:', gen.ok, 'instance:', gen.instance_id, 'questions:', gen.total_questions);
    log('coverage:', JSON.stringify(gen.coverage, null, 2));
    if (!gen.ok || !gen.instance_id) throw new Error('generate failed: ' + gen.error);

    // ---- 2. SCORE (simulate answers: alternate "Agree"=75 / "Strongly Agree"=100 / "Neutral"=50) ----
    const responses = (gen.questions ?? []).map((q) => ({
      index: q.index,
      selected_index: [3, 4, 2][q.index % 3], // 75 / 100 / 50
    }));
    const scored = await scoreAssessment(pool, { instanceId: gen.instance_id, responses });
    log('\n=== SCORE ===');
    log('answered:', scored.answered, 'overall:', scored.overall_score, 'level:', scored.overall_level, 'measurement:', scored.measurement);
    log('domain_scores:', JSON.stringify(scored.domain_scores, null, 2));

    // ---- 3. PROFILE --------------------------------------------------------
    const prof = await getProfile(pool, SUBJECT);
    log('\n=== PROFILE ===');
    log('measured:', prof.measured, 'overall:', prof.overall_score, 'level:', prof.overall_level, 'history:', prof.history_count);
    log('domains:', prof.domain_scores.map((d) => `${d.onto_domain}=${d.scaled_score}(L${d.level})`).join(', '));

    // ---- 4. GAP ANALYSIS ---------------------------------------------------
    const gap = await computeGapAnalysis(pool, SUBJECT);
    log('\n=== GAP ANALYSIS ===');
    log('measured:', gap.measured, 'total:', gap.total_competencies, 'measurable:', gap.measurable_competencies,
      'unmeasurable:', gap.unmeasurable_competencies, 'coverage%:', gap.coverage_pct, 'blocking:', gap.blocking_gaps);
    for (const g of gap.gaps ?? []) {
      log(`  ${g.competency_name} [${g.onto_domain}] req=${g.required_level} got=${g.measured_level ?? '-'} gap=${g.gap ?? '-'} ${g.severity} ${g.measurement}${g.blocking ? ' BLOCKING' : ''}`);
    }
    log('role_readiness reused:', gap.role_readiness ? `score=${gap.role_readiness.readiness_score} band=${gap.role_readiness.readiness_band}` : 'null (no role profile)');
    log('notes:', JSON.stringify(gap.notes, null, 2));
  } finally {
    // ---- CLEANUP -----------------------------------------------------------
    await pool.query(`DELETE FROM onto_assessment_instances WHERE subject_id = $1`, [SUBJECT]); // cascades responses/scores/profiles
    await pool.query(`DELETE FROM onto_competency_profiles WHERE subject_id = $1`, [SUBJECT]);
    await pool.query(`DELETE FROM competency_question_templates WHERE template_key LIKE 'demo_phase2_%'`);
    console.log('\ncleanup done (demo rows removed)');
    await pool.end();
  }
}
main().catch((e) => { console.error('SMOKE FAILED:', e); process.exit(1); });
