/**
 * Task #136 smoke — end-to-end proof that completing the candidate CRA
 * assessment yields a competency-granularity onto_competency_score_runs row
 * that resolveUnifiedCompetencyProfile surfaces (→ Precise Competency Scores).
 *
 * Self-cleaning: uses a @example.com subject and DELETEs its rows at the end.
 * Run: FF_COMPETENCY_RUNTIME=1 tsx scripts/task136-smoke.ts
 */
import { Pool } from 'pg';
import { resolveUnifiedCompetencyProfile } from '../services/competency-intelligence-contracts.js';

const SUBJECT = 'task136-smoke@example.com';
const CRA_CODE_TO_COMP: Record<string, string> = {
  COG01: 'comp_critical_thinking',
  COG02: 'comp_problem_solving',
  COG04: 'comp_decision_making',
  COM02: 'comp_written_communication',
  COM04: 'comp_active_listening',
  LEA01: 'comp_team_leadership',
  EXE01: 'comp_project_management',
  EXE02: 'comp_accountability',
  ADP01: 'comp_learning_agility',
  ADP02: 'comp_resilience',
  EIQ01: 'comp_self_awareness',
  EIQ05: 'comp_conflict_resolution',
  // Task #143 curated synonym matches (mirror production crosswalk).
  COG03: 'comp_analytical_thinking',
  ADP03: 'comp_innovation',
  EIQ02: 'comp_emotional_regulation',
  TEC01: 'comp_technical_competence',
  LEA03: 'comp_coaching',
};
const PROFICIENCY_LABELS: Record<number, string> = {
  1: 'Awareness', 2: 'Basic Application', 3: 'Independent Application',
  4: 'Advanced Application', 5: 'Expert / Strategic Application',
};
const scoreToLevel = (s: number) => (s >= 80 ? 5 : s >= 60 ? 4 : s >= 40 ? 3 : s >= 20 ? 2 : 1);

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let failures = 0;
  const assert = (cond: boolean, msg: string) => {
    console.log(`${cond ? 'PASS' : 'FAIL'} — ${msg}`);
    if (!cond) failures++;
  };
  try {
    await pool.query(`DELETE FROM onto_competency_score_runs WHERE subject_id = $1`, [SUBJECT]);

    // Simulate the validated CRA submission (mix of mapped + unmapped codes).
    const measured = [
      { code: 'COG01', raw: 82 }, // -> comp_critical_thinking (level 5)
      { code: 'COG02', raw: 55 }, // -> comp_problem_solving    (level 3)
      { code: 'EIQ05', raw: 30 }, // -> comp_conflict_resolution(level 2)
      { code: 'COM01', raw: 90 }, // UNMAPPED (Verbal Communication) -> omitted
      { code: 'TEC02', raw: 70 }, // UNMAPPED (Digital Fluency)      -> omitted
    ];

    // Mirror writeCandidatePreciseRun exactly.
    const byComp = new Map<string, number>();
    for (const m of measured) { const c = CRA_CODE_TO_COMP[m.code]; if (c) byComp.set(c, m.raw); }
    const ids = [...byComp.keys()];
    const nameRes = await pool.query<{ id: string; canonical_name: string }>(
      `SELECT id, canonical_name FROM onto_competencies WHERE id = ANY($1::text[])`, [ids]);
    const nameById = new Map(nameRes.rows.map((r) => [r.id, r.canonical_name]));
    const runComps: any[] = [];
    for (const [cid, raw] of byComp) {
      const name = nameById.get(cid); if (!name) continue;
      const score = Math.round(raw * 10) / 10; const level = scoreToLevel(score);
      runComps.push({
        competency_id: cid, competency_name: name, normalized_score: score,
        normalization_basis: 'cra_option_score', level,
        level_label: PROFICIENCY_LABELS[level] ?? null, level_status: 'measured',
        item_count: 1, measurement: 'precise',
      });
    }
    const overall = Math.round((runComps.reduce((s, c) => s + c.normalized_score, 0) / runComps.length) * 10) / 10;
    await pool.query(
      `INSERT INTO onto_competency_score_runs
         (assessment_id, blueprint_id, subject_id, total_questions, scored_questions,
          competency_scores, overall, normalization, status, source)
       VALUES (NULL, NULL, $1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, 'scored', 'candidate_cra_crosswalk')`,
      [SUBJECT, measured.length, runComps.length, JSON.stringify(runComps),
       JSON.stringify({ overall_score: overall, overall_level: scoreToLevel(overall), competencies_scored: runComps.length, measurement: 'precise' }),
       JSON.stringify({ basis: 'cra_option_score' })]);

    assert(runComps.length === 3, `3 mapped competencies written (got ${runComps.length}); 2 unmapped omitted (no fabrication)`);

    // The READ path the candidate sees.
    const unified = await resolveUnifiedCompetencyProfile(pool, SUBJECT);
    const precise = unified.scores.filter((s) => s.granularity === 'competency' && s.score != null);
    assert(unified.resolved, 'resolver resolved the subject');
    assert(precise.length === 3, `precise-scores surfaces 3 competency-granularity scores (got ${precise.length})`);
    const ct = precise.find((s) => s.key === 'comp_critical_thinking');
    assert(!!ct && ct.score === 82 && ct.level === 5 && ct.levelLabel === 'Expert / Strategic Application',
      `comp_critical_thinking = 82 / level 5 / Expert label (got ${ct?.score}/${ct?.level}/${ct?.levelLabel})`);
    assert(!precise.some((s) => s.key === 'COM01' || s.key === 'TEC02'),
      'unmapped CRA codes never appear as precise scores');
    assert(unified.overallScore === overall, `overall surfaced (${unified.overallScore})`);
  } finally {
    await pool.query(`DELETE FROM onto_competency_score_runs WHERE subject_id = $1`, [SUBJECT]).catch(() => {});
    await pool.end();
  }
  console.log(failures === 0 ? '\nSMOKE: ALL PASS' : `\nSMOKE: ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
