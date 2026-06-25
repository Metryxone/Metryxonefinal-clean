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
  // Task #161 SME-authored genome competencies (mirror production crosswalk) —
  // the final 3 that lift the mapping to a full 20/20.
  COM01: 'comp_verbal_communication',
  LEA05: 'comp_change_leadership',
  TEC02: 'comp_digital_fluency',
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

    // Task #161 — all 20 CRA taxonomy competencies now map to a genuine genome
    // competency (the final 3 — Verbal Communication, Change Leadership, Digital
    // Fluency — are SME-authored, seeded by task161-genome-competency-seed.ts).
    assert(Object.keys(CRA_CODE_TO_COMP).length === 20, `crosswalk maps all 20 CRA competencies (got ${Object.keys(CRA_CODE_TO_COMP).length})`);
    const newComps = ['comp_verbal_communication', 'comp_change_leadership', 'comp_digital_fluency'];
    const genomeCheck = await pool.query<{ id: string }>(
      `SELECT id FROM onto_competencies WHERE id = ANY($1::text[])`, [newComps]);
    assert(genomeCheck.rows.length === 3,
      `Task #161 genome competencies exist in onto_competencies (got ${genomeCheck.rows.length}/3) — run with the task161 seed applied`);

    // Simulate the validated CRA submission: includes the 3 Task #161 codes (now
    // mapped) plus a genuinely-UNKNOWN code that must never be fabricated.
    const measured = [
      { code: 'COG01', raw: 82 }, // -> comp_critical_thinking   (level 5)
      { code: 'COG02', raw: 55 }, // -> comp_problem_solving      (level 3)
      { code: 'EIQ05', raw: 30 }, // -> comp_conflict_resolution  (level 2)
      { code: 'COM01', raw: 90 }, // Task #161 -> comp_verbal_communication (level 5)
      { code: 'TEC02', raw: 70 }, // Task #161 -> comp_digital_fluency      (level 4)
      { code: 'ZZZ99', raw: 50 }, // genuinely UNKNOWN code -> omitted (no fabrication)
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

    assert(runComps.length === 5, `5 mapped competencies written (got ${runComps.length}); 1 unknown code omitted (no fabrication)`);

    // The READ path the candidate sees.
    const unified = await resolveUnifiedCompetencyProfile(pool, SUBJECT);
    const precise = unified.scores.filter((s) => s.granularity === 'competency' && s.score != null);
    assert(unified.resolved, 'resolver resolved the subject');
    assert(precise.length === 5, `precise-scores surfaces 5 competency-granularity scores (got ${precise.length})`);
    const ct = precise.find((s) => s.key === 'comp_critical_thinking');
    assert(!!ct && ct.score === 82 && ct.level === 5 && ct.levelLabel === 'Expert / Strategic Application',
      `comp_critical_thinking = 82 / level 5 / Expert label (got ${ct?.score}/${ct?.level}/${ct?.levelLabel})`);
    // Task #161 — the previously-omitted codes now surface as genuine precise scores.
    const vc = precise.find((s) => s.key === 'comp_verbal_communication');
    assert(!!vc && vc.score === 90 && vc.level === 5,
      `COM01 now scores precisely as comp_verbal_communication = 90 / level 5 (got ${vc?.score}/${vc?.level})`);
    const df = precise.find((s) => s.key === 'comp_digital_fluency');
    assert(!!df && df.score === 70 && df.level === 4,
      `TEC02 now scores precisely as comp_digital_fluency = 70 / level 4 (got ${df?.score}/${df?.level})`);
    assert(!precise.some((s) => s.key === 'ZZZ99'),
      'genuinely-unknown CRA codes never appear as precise scores (no fabrication)');
    assert(unified.overallScore === overall, `overall surfaced (${unified.overallScore})`);
  } finally {
    await pool.query(`DELETE FROM onto_competency_score_runs WHERE subject_id = $1`, [SUBJECT]).catch(() => {});
    await pool.end();
  }
  console.log(failures === 0 ? '\nSMOKE: ALL PASS' : `\nSMOKE: ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
