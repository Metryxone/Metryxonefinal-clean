/**
 * Phase 2.4 — Competency Scoring Engine e2e smoke.
 *
 * Exercises the full chain Question -> Raw Score -> Competency Score ->
 * Normalized Score -> Level via BOTH the pure deliverable functions and the
 * DB-resolving orchestrator (scoreAssessmentRun), then verifies persistence/read.
 *
 * Self-contained: seeds isolated demo competency-mapped+approved questions across
 * difficulties (source='phase24-smoke'), runs scoring, and purges all demo rows
 * (questions + mappings + score runs) in `finally`. Reuses real competency ids.
 */
import { Pool } from 'pg';
import {
  deriveRawScore,
  computeCompetencyScores,
  normalizeScore,
  calculateCompetencyLevel,
  scoreToLevelBand,
  scoreAssessmentRun,
  getScoreRun,
  COHORT_K_MIN,
  type ScoredItem,
} from '../services/competency-scoring.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const C1 = 'comp_adaptability';   // real competency
const C2 = 'comp_accountability'; // real competency

let pass = 0, fail = 0;
const log = (ok: boolean, msg: string) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };
const approx = (a: number, b: number, eps = 0.05) => Math.abs(a - b) <= eps;

const demoQ: string[] = [];

async function insertQuestion(type: string, diff: string, body: any): Promise<string> {
  const r = await pool.query(
    `INSERT INTO competency_question_templates (template_key, competency_code, question_type, template_body, difficulty_band, status, source)
     VALUES ($1,$2,$3,$4::jsonb,$5,'approved','seed') RETURNING id`,
    [`p24smoke_${diff}_${Math.random().toString(36).slice(2, 8)}`, 'COG', type, JSON.stringify(body), diff],
  );
  const id = r.rows[0].id as string;
  demoQ.push(id);
  return id;
}
async function mapQ(qid: string, comp: string, diff: string, type: string) {
  await pool.query(
    `INSERT INTO onto_question_competency_mapping (question_id, competency_id, difficulty_level, question_type, source)
     VALUES ($1,$2,$3,$4,'phase24-smoke')`,
    [qid, comp, diff, type],
  );
}

async function cleanup() {
  await pool.query(`DELETE FROM onto_competency_score_runs WHERE source='phase24-smoke'`);
  await pool.query(`DELETE FROM onto_question_competency_mapping WHERE source='phase24-smoke'`);
  if (demoQ.length) await pool.query(`DELETE FROM competency_question_templates WHERE id = ANY($1::uuid[])`, [demoQ]);
}

async function main() {
  // ============================================================
  // PART A — pure deliverable functions (no DB)
  // ============================================================

  // --- deriveRawScore (Question -> Raw Score) ---
  log(deriveRawScore({ raw_score: 73 }, {}) === 73, 'deriveRawScore: explicit raw_score passthrough');
  log(deriveRawScore({ raw_score: 250 }, {}) === 100, 'deriveRawScore: explicit raw_score clamped to 100');
  log(deriveRawScore({ correct: true }, {}) === 100 && deriveRawScore({ correct: false }, {}) === 0, 'deriveRawScore: correct boolean -> 100/0');
  log(deriveRawScore({ selected_index: 4 }, { question_type: 'likert' }) === 100, 'deriveRawScore: Likert top index -> 100');
  log(deriveRawScore({ selected_index: 2 }, { question_type: 'likert' }) === 50, 'deriveRawScore: Likert middle -> 50');
  log(deriveRawScore({ selected_index: 0 }, { question_type: 'mcq', options: ['a', 'b', 'c'], best_option: 0 }) === 100, 'deriveRawScore: MCQ best -> 100');
  log(deriveRawScore({ selected_index: 1 }, { question_type: 'mcq', options: ['a', 'b', 'c'], best_option: 0 }) === 60, 'deriveRawScore: MCQ adjacent -> 60');
  log(deriveRawScore({ selected_index: 2 }, { question_type: 'mcq', options: ['a', 'b', 'c'], best_option: 0 }) === 20, 'deriveRawScore: MCQ distant -> 20');
  // Regression: CANONICAL Phase 2.2 type keys must be best-answer scored (NOT Likert ladder).
  log(deriveRawScore({ selected_index: 0 }, { question_type: 'multiple_choice', options: ['a', 'b', 'c'], best_option: 0 }) === 100, 'deriveRawScore: canonical multiple_choice best -> 100 (not Likert)');
  log(deriveRawScore({ selected_index: 1 }, { question_type: 'situational_judgment', options: ['a', 'b', 'c'], best_option: 0 }) === 60, 'deriveRawScore: canonical situational_judgment adjacent -> 60');
  log(deriveRawScore({ selected_index: 2 }, { question_type: 'scenario_based', options: ['a', 'b', 'c'], best_option: 0 }) === 20, 'deriveRawScore: canonical scenario_based distant -> 20');
  log(deriveRawScore({ selected_index: 2 }, { question_type: 'case_study', options: ['a', 'b', 'c', 'd'], best_option: 0 }) === 20, 'deriveRawScore: canonical case_study best-answer scored');
  // Likert canonical key stays on the rating ladder.
  log(deriveRawScore({ selected_index: 1 }, { question_type: 'likert', options: ['a', 'b', 'c'], best_option: 0 }) === 25, 'deriveRawScore: canonical likert stays on ladder (index 1 -> 25)');
  log(deriveRawScore({}, {}) === null, 'deriveRawScore: nothing scoreable -> null');

  // --- computeCompetencyScores (Raw -> Competency, difficulty-weighted) ---
  // C1: one expert (w=5) correct=100, one foundational (w=1) wrong=0.
  // achieved = 5*100 + 1*0 = 500 ; max = 5*100 + 1*100 = 600 ; weighted% = 83.3 (vs naive mean 50).
  const itemsA: ScoredItem[] = [
    { competency_id: C1, difficulty_level: 'expert', raw_score: 100 },
    { competency_id: C1, difficulty_level: 'foundational', raw_score: 0 },
    { competency_id: C2, difficulty_level: 'medium', raw_score: 40 },
  ];
  const cs = computeCompetencyScores(itemsA);
  const csC1 = cs.find((c) => c.competency_id === C1)!;
  const csC2 = cs.find((c) => c.competency_id === C2)!;
  log(cs.length === 2 && cs[0].competency_id <= cs[1].competency_id, 'computeCompetencyScores: groups per competency, sorted');
  log(csC1.achieved_points === 500 && csC1.max_points === 600, 'computeCompetencyScores: difficulty-weighted achieved/max (500/600)');
  log(csC1.raw_mean === 50, 'computeCompetencyScores: raw_mean is simple mean (50) — distinct from weighted');
  log(csC1.item_count === 2 && csC1.difficulty_breakdown.expert === 1 && csC1.difficulty_breakdown.foundational === 1, 'computeCompetencyScores: item_count + difficulty_breakdown');

  // --- normalizeScore (Competency -> Normalized) ---
  const nA = normalizeScore(500, 600);
  log(approx(nA.normalized!, 83.3) && nA.basis === 'difficulty_weighted_percent', 'normalizeScore: default difficulty-weighted percent (83.3)');
  const nMax = normalizeScore(0, 0);
  log(nMax.normalized === null && nMax.basis === 'unmeasurable', 'normalizeScore: no items -> null / unmeasurable');
  const nCohort = normalizeScore(500, 600, { cohort: { mean: 50, sd: 10, n: COHORT_K_MIN } }); // z=(83.3-50)/10=3.33 -> T=83.3
  log(nCohort.basis === 'cohort_referenced' && nCohort.normalized! > 80 && nCohort.weighted_percent! > 80, 'normalizeScore: cohort-referenced T-score when n>=k & sd>0');
  const nLowK = normalizeScore(500, 600, { cohort: { mean: 50, sd: 10, n: COHORT_K_MIN - 1 } });
  log(nLowK.basis === 'difficulty_weighted_percent' && nLowK.note === 'cohort_ignored_below_k_or_invalid', 'normalizeScore: cohort below k_min ignored (honest note), NEVER fabricated');
  const nBadSd = normalizeScore(500, 600, { cohort: { mean: 50, sd: 0, n: 100 } });
  log(nBadSd.basis === 'difficulty_weighted_percent', 'normalizeScore: sd<=0 cohort rejected');

  // --- calculateCompetencyLevel (Normalized -> Level) ---
  log(scoreToLevelBand(80) === 5 && scoreToLevelBand(60) === 4 && scoreToLevelBand(40) === 3 && scoreToLevelBand(20) === 2 && scoreToLevelBand(19.9) === 1, 'scoreToLevelBand: bands 80/60/40/20 (mirror Phase 2)');
  log(calculateCompetencyLevel(83.3).level === 5 && calculateCompetencyLevel(83.3).status === 'measured', 'calculateCompetencyLevel: 83.3 -> level 5 measured');
  const lvlNull = calculateCompetencyLevel(null);
  log(lvlNull.level === null && lvlNull.status === 'unmeasurable', 'calculateCompetencyLevel: null normalized -> null level (never floored to 1)');
  log(calculateCompetencyLevel(70, { 4: 'Custom Advanced' }).label === 'Custom Advanced', 'calculateCompetencyLevel: prefers supplied proficiency labels');

  // ============================================================
  // PART B — DB-resolving orchestrator + persistence
  // ============================================================
  // Seed: C1 with one expert + one foundational question; C2 with one medium MCQ.
  const qExpert = await insertQuestion('likert', 'expert', { prompt: 'demo' });
  const qFound = await insertQuestion('likert', 'foundational', { prompt: 'demo' });
  const qMcq = await insertQuestion('mcq', 'medium', { prompt: 'demo', options: ['a', 'b', 'c', 'd'], best_option: 0 });
  await mapQ(qExpert, C1, 'expert', 'likert');
  await mapQ(qFound, C1, 'foundational', 'likert');
  await mapQ(qMcq, C2, 'medium', 'mcq');

  // Responses resolved purely by question_id (competency/difficulty/options from DB mapping).
  const run = await scoreAssessmentRun(pool, {
    responses: [
      { question_id: qExpert, selected_index: 4 },   // Likert top -> 100, w=5
      { question_id: qFound, selected_index: 0 },     // Likert bottom -> 0,  w=1
      { question_id: qMcq, selected_index: 0 },        // MCQ best -> 100, w=3
    ],
    subject_id: 'p24-smoke-subject',
    source: 'phase24-smoke',
  });
  log(run.status === 'scored' && run.scored_questions === 3, 'orchestrator: DB-resolved chain scored 3 responses');
  const rC1 = run.competency_scores.find((c) => c.competency_id === C1)!;
  const rC2 = run.competency_scores.find((c) => c.competency_id === C2)!;
  log(!!rC1 && approx(rC1.normalized_score!, 83.3) && rC1.level === 5, 'orchestrator: C1 difficulty-weighted normalized 83.3 -> level 5');
  log(rC1.competency_name != null, 'orchestrator: competency_name resolved from onto_competencies');
  log(!!rC2 && rC2.normalized_score === 100 && rC2.level === 5, 'orchestrator: C2 single MCQ-best -> 100 -> level 5');
  log(rC1.level_label != null && rC2.level_label != null, 'orchestrator: level_label populated (proficiency labels or fallback)');
  log(run.overall.normalized_score != null && run.overall.level != null && run.overall.competencies_scored === 2, 'orchestrator: overall item-weighted normalized + level over 2 competencies');

  // Persistence + read
  log(run.run_id != null, 'persistence: run_id returned (persisted)');
  const stored = run.run_id ? await getScoreRun(pool, run.run_id) : null;
  log(!!stored && (stored as any).status === 'scored' && Array.isArray((stored as any).competency_scores), 'persistence: getScoreRun returns stored run');
  log(!!stored && Number((stored as any).scored_questions) === 3, 'persistence: stored scored_questions matches');

  // Preview (persist:false) must NOT write a row
  const preview = await scoreAssessmentRun(pool, {
    responses: [{ question_id: qMcq, selected_index: 0 }],
    persist: false, source: 'phase24-smoke',
  });
  log(preview.status === 'scored' && preview.run_id === null, 'preview: persist=false computes but does NOT persist (run_id null)');

  // Empty / unmapped -> honest scoring_empty (never fabricated)
  const empty = await scoreAssessmentRun(pool, {
    responses: [{ question_id: '00000000-0000-0000-0000-000000000000', selected_index: 2 }],
    persist: false, source: 'phase24-smoke',
  });
  log(empty.status === 'scoring_empty' && empty.competency_scores.length === 0 && empty.overall.normalized_score === null, 'empty: unmapped question -> scoring_empty, null overall (honest)');

  const emptyNoResp = await scoreAssessmentRun(pool, { responses: [], persist: false });
  log(emptyNoResp.status === 'scoring_empty' && emptyNoResp.total_questions === 0, 'empty: zero responses -> scoring_empty');

  // Inline items (no DB) also score — competency/difficulty/raw provided directly
  const inline = await scoreAssessmentRun(pool, {
    responses: [
      { competency_id: C1, difficulty_level: 'hard', raw_score: 100 },
      { competency_id: C1, difficulty_level: 'easy', raw_score: 0 },
    ],
    persist: false, source: 'phase24-smoke',
  });
  const inlC1 = inline.competency_scores.find((c) => c.competency_id === C1);
  // hard w=4 *100 + easy w=2 *0 = 400 ; max = (4+2)*100 = 600 -> 66.7 -> level 4
  log(!!inlC1 && approx(inlC1!.normalized_score!, 66.7) && inlC1!.level === 4, 'inline: provided competency/difficulty/raw scored (66.7 -> level 4)');

  // Cohort path through orchestrator
  const cohortRun = await scoreAssessmentRun(pool, {
    responses: [{ competency_id: C1, difficulty_level: 'medium', raw_score: 80 }],
    cohorts: { [C1]: { mean: 50, sd: 10, n: 40 } },
    persist: false, source: 'phase24-smoke',
  });
  const cohC1 = cohortRun.competency_scores.find((c) => c.competency_id === C1);
  log(!!cohC1 && cohC1!.normalization_basis === 'cohort_referenced', 'orchestrator: cohort-referenced normalization applied when real cohort supplied');

  // Regression (cross-phase): a question stored with the CANONICAL Phase 2.2 type
  // key 'multiple_choice' must be best-answer scored via DB resolution, NOT Likert.
  const qCanon = await insertQuestion('multiple_choice', 'medium', { prompt: 'demo', options: ['a', 'b', 'c', 'd'], best_option: 0 });
  await mapQ(qCanon, C2, 'medium', 'multiple_choice');
  const canonRun = await scoreAssessmentRun(pool, {
    responses: [{ question_id: qCanon, selected_index: 1 }], // adjacent -> 60 (best-answer), NOT 25 (Likert)
    persist: false, source: 'phase24-smoke',
  });
  const canonC2 = canonRun.competency_scores.find((c) => c.competency_id === C2);
  log(!!canonC2 && canonC2!.raw_mean === 60, 'orchestrator: canonical multiple_choice DB-resolved -> best-answer 60 (not Likert 25)');

  console.log(`\n${pass}/${pass + fail} PASS  (${fail} fail)`);
  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((e) => { console.error('SMOKE ERROR', e); process.exitCode = 1; })
  .finally(async () => { await cleanup().catch((e) => console.error('cleanup error', e)); await pool.end(); });
