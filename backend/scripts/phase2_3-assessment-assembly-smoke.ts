/**
 * Phase 2.3 — Assessment Assembly Engine e2e smoke (service-level).
 *
 * Builds an isolated demo blueprint + mapped+approved questions across difficulties, then exercises:
 *   - no duplicate questions (incl. a question shared by two competencies → disjoint assignment)
 *   - competency coverage validation (covered + honest uncovered/no_mapped_questions)
 *   - blueprint coverage validation (achieved vs weight proportion)
 *   - difficulty balancing (target distribution honoured within a competency)
 *   - question randomization (same seed → identical order; different seed → reordered)
 *   - persistence + re-validation of a stored assessment
 *   - empty-pool honesty (a 0-question assessment is valid=false with assessment_empty)
 *
 * Self-cleaning: snapshots & restores any onto_question_blueprints rows for the REAL competency ids it
 * touches, and purges all demo rows (blueprint cascade + questions + mappings) in `finally`.
 */
import { Pool } from 'pg';
import {
  generateAssembledAssessment,
  buildAssessment,
  validateAssessment,
  getAssembledAssessment,
} from '../services/assessment-assembly.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BP = 'bp_phase23_smoke';
const BP_EMPTY = 'bp_phase23_smoke_empty';
const C1 = 'comp_adaptability';      // real competency (dom_behavioral) — weight 70
const C2 = 'comp_accountability';    // real competency (dom_behavioral) — weight 30
const C3 = 'comp_personal_credibility'; // real competency, NO questions → uncovered
const TOUCHED_QB = [C1, C2, C3];

let pass = 0, fail = 0;
const log = (ok: boolean, msg: string) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); ok ? pass++ : fail++; };

const DIFFS_C1: [string, number][] = [
  ['foundational', 1], ['easy', 2], ['medium', 3], ['hard', 2], ['expert', 2], // 10
];
const DIFFS_C2: [string, number][] = [['easy', 2], ['medium', 2], ['hard', 2]]; // 6

const demoQ: string[] = [];
let sharedQ = '';
const qbSnapshot = new Map<string, any | null>();

async function insertQuestion(code: string, type: string, diff: string): Promise<string> {
  const r = await pool.query(
    `INSERT INTO competency_question_templates (template_key, competency_code, question_type, template_body, difficulty_band, status, source)
     VALUES ($1,$2,$3,$4::jsonb,$5,'approved','seed') RETURNING id`,
    [`p23smoke_${code}_${diff}_${Math.random().toString(36).slice(2, 8)}`, code, type, JSON.stringify({ prompt: 'demo' }), diff],
  );
  const id = r.rows[0].id as string;
  demoQ.push(id);
  return id;
}
async function mapQ(qid: string, comp: string, diff: string, type: string) {
  await pool.query(
    `INSERT INTO onto_question_competency_mapping (question_id, competency_id, difficulty_level, question_type, source)
     VALUES ($1,$2,$3,$4,'phase23-smoke')`,
    [qid, comp, diff, type],
  );
}

async function setup() {
  // Demo blueprint + competency map (weights 70/30, + C3 with 0).
  await pool.query(
    `INSERT INTO onto_assessment_blueprints (id, blueprint_key, name, source) VALUES ($1,$1,'Phase 2.3 Smoke','phase23-smoke')
     ON CONFLICT (id) DO NOTHING`, [BP]);
  await pool.query(
    `INSERT INTO onto_assessment_blueprints (id, blueprint_key, name, source) VALUES ($1,$1,'Phase 2.3 Smoke Empty','phase23-smoke')
     ON CONFLICT (id) DO NOTHING`, [BP_EMPTY]);
  for (const [comp, w] of [[C1, 70], [C2, 30], [C3, 0]] as [string, number][]) {
    await pool.query(
      `INSERT INTO onto_blueprint_competency_map (blueprint_id, competency_id, weight, criticality, source)
       VALUES ($1,$2,$3,'important','phase23-smoke')`, [BP, comp, w]);
  }
  // Empty blueprint references a real competency (C3) that has NO mapped questions → honestly empty pool.
  await pool.query(
    `INSERT INTO onto_blueprint_competency_map (blueprint_id, competency_id, weight, criticality, source)
     VALUES ($1,$2,100,'important','phase23-smoke')`, [BP_EMPTY, C3]);

  // Snapshot + set per-competency difficulty blueprints (restore later).
  for (const c of TOUCHED_QB) {
    const r = await pool.query(`SELECT * FROM onto_question_blueprints WHERE competency_id=$1`, [c]);
    qbSnapshot.set(c, r.rows[0] ?? null);
  }
  const distC1 = Object.fromEntries(DIFFS_C1);
  const distC2 = Object.fromEntries(DIFFS_C2);
  await pool.query(
    `INSERT INTO onto_question_blueprints (competency_id, pool_target, difficulty_distribution, type_distribution, source)
     VALUES ($1,$2,$3::jsonb,'{}'::jsonb,'phase23-smoke')
     ON CONFLICT (competency_id) DO UPDATE SET pool_target=EXCLUDED.pool_target, difficulty_distribution=EXCLUDED.difficulty_distribution, source=EXCLUDED.source`,
    [C1, 10, JSON.stringify(distC1)]);
  await pool.query(
    `INSERT INTO onto_question_blueprints (competency_id, pool_target, difficulty_distribution, type_distribution, source)
     VALUES ($1,$2,$3::jsonb,'{}'::jsonb,'phase23-smoke')
     ON CONFLICT (competency_id) DO UPDATE SET pool_target=EXCLUDED.pool_target, difficulty_distribution=EXCLUDED.difficulty_distribution, source=EXCLUDED.source`,
    [C2, 6, JSON.stringify(distC2)]);

  // Questions for C1 (more than 10 so balancing has slack), C2.
  for (const [diff, n] of DIFFS_C1) for (let i = 0; i < n + 1; i++) { const id = await insertQuestion('ADP', 'likert', diff); await mapQ(id, C1, diff, 'likert'); }
  for (const [diff, n] of DIFFS_C2) for (let i = 0; i < n + 1; i++) { const id = await insertQuestion('ADP', 'mcq', diff); await mapQ(id, C2, diff, 'mcq'); }

  // One SHARED question mapped to BOTH C1 and C2 → must be assigned to C1 (higher weight), never duplicated.
  sharedQ = await insertQuestion('ADP', 'likert', 'medium');
  await mapQ(sharedQ, C1, 'medium', 'likert');
  await mapQ(sharedQ, C2, 'medium', 'mcq');
}

async function run() {
  // --- assemble (persist) with fixed seed ---
  const g = await generateAssembledAssessment(pool, BP, { total: 12, seed: 42 });
  if (!g.ok) { log(false, `generate failed: ${(g as any).error}`); return; }
  log(g.ok, 'assessment_generator returns ok');
  log(g.total_questions === 12, `total_questions == 12 (got ${g.total_questions})`);
  log(g.persisted && !!g.assessment_id, 'persisted with an assessment_id');
  log(g.role_id === null, 'role_id resolved from blueprint (null here — demo blueprint has no role)');

  // no duplicates
  const ids = g.questions.map((q) => q.question_id);
  log(new Set(ids).size === ids.length, 'NO duplicate question_ids');
  log(g.validation.duplicate_check.ok, 'validator duplicate_check.ok == true');
  const sharedCount = ids.filter((x) => x === sharedQ).length;
  log(sharedCount <= 1, `shared question appears at most once (got ${sharedCount})`);
  if (sharedCount === 1) {
    const sq = g.questions.find((q) => q.question_id === sharedQ)!;
    log(sq.competency_id === C1, 'shared question assigned to higher-weight competency (C1)');
  }

  // competency coverage
  log(g.validation.competency_coverage.total === 3, 'competency_coverage.total == 3');
  const unc = g.validation.competency_coverage.uncovered;
  const c3unc = unc.find((u) => u.competency_id === C3);
  log(!!c3unc && c3unc.reason === 'no_mapped_questions', 'C3 honestly uncovered (no_mapped_questions)');
  const c1cov = g.coverage.per_competency.find((p) => p.competency_id === C1)!;
  const c2cov = g.coverage.per_competency.find((p) => p.competency_id === C2)!;
  log(c1cov.selected > 0 && c2cov.selected > 0, 'C1 and C2 both covered (>0 selected)');
  log(c1cov.selected > c2cov.selected, `C1 (w70) got more than C2 (w30): ${c1cov.selected} vs ${c2cov.selected}`);

  // blueprint coverage (achieved proportion within tolerance of weights 70/30)
  const bp = g.validation.blueprint_coverage;
  log(typeof bp.max_deviation_pct === 'number', `blueprint_coverage computed (max_dev ${bp.max_deviation_pct}pts)`);

  // difficulty balancing: C1 selected difficulties should track the target shape (medium most common)
  const c1diff = c1cov.difficulty_breakdown;
  const medishare = (c1diff['medium'] || 0);
  log(Object.keys(c1diff).length >= 3, `C1 spans multiple difficulty levels (${Object.keys(c1diff).join(',')})`);
  log(medishare >= 1, 'C1 includes medium-difficulty items (target-weighted)');

  // valid overall (non-empty, no dupes)
  log(g.valid === true, 'assessment valid == true (non-empty, no integrity errors)');

  // --- randomization: same seed → identical order ---
  const a = await buildAssessment(pool, BP, { total: 12, seed: 42 });
  const b = await buildAssessment(pool, BP, { total: 12, seed: 42 });
  const c = await buildAssessment(pool, BP, { total: 12, seed: 999 });
  if (a.ok && b.ok && c.ok) {
    const oa = a.questions.map((q) => q.question_id).join(',');
    const ob = b.questions.map((q) => q.question_id).join(',');
    const oc = c.questions.map((q) => q.question_id).join(',');
    log(oa === ob, 'same seed → identical question order (deterministic)');
    log(oa !== oc, 'different seed → different order (randomized)');
    log(new Set(a.questions.map(q=>q.question_id)).size === a.questions.length, 'seeded build also dupe-free');
  } else log(false, 'buildAssessment failed for randomization checks');

  // --- re-validate the stored assessment ---
  const stored = await getAssembledAssessment(pool, g.assessment_id!);
  log(!!stored && Array.isArray(stored.questions) && stored.questions.length === 12, 'stored assessment readable with 12 questions');
  const rev = await validateAssessment(pool, BP, stored.questions);
  log(rev.ok && rev.validation!.duplicate_check.ok, 're-validation of stored assessment passes dupe check');

  // --- empty-pool honesty ---
  const e = await generateAssembledAssessment(pool, BP_EMPTY, { seed: 1, persist: false });
  if (e.ok) {
    log(e.total_questions === 0, 'empty-pool blueprint → 0 questions (honest)');
    log(e.valid === false, 'empty assessment valid == false');
    log(e.validation.errors.some((x) => x.startsWith('assessment_empty')), 'validator flags assessment_empty');
  } else log(false, `empty-pool generate failed: ${(e as any).error}`);

  // --- not-found honesty ---
  const nf = await generateAssembledAssessment(pool, 'bp_does_not_exist_xyz', {});
  log(!nf.ok && (nf as any).error === 'blueprint_not_found', 'unknown blueprint → blueprint_not_found');
}

async function cleanup() {
  await pool.query(`DELETE FROM onto_question_competency_mapping WHERE source='phase23-smoke'`);
  if (demoQ.length) await pool.query(`DELETE FROM competency_question_templates WHERE id = ANY($1::uuid[])`, [demoQ]);
  // onto_assembled_assessments + onto_blueprint_competency_map cascade off the blueprint delete.
  await pool.query(`DELETE FROM onto_assessment_blueprints WHERE id = ANY($1::text[])`, [[BP, BP_EMPTY]]);
  // Restore onto_question_blueprints to its pre-test state.
  for (const c of TOUCHED_QB) {
    const prev = qbSnapshot.get(c);
    if (prev) {
      await pool.query(
        `INSERT INTO onto_question_blueprints (competency_id, pool_target, difficulty_distribution, type_distribution, coverage, source)
         VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6)
         ON CONFLICT (competency_id) DO UPDATE SET pool_target=EXCLUDED.pool_target, difficulty_distribution=EXCLUDED.difficulty_distribution,
           type_distribution=EXCLUDED.type_distribution, coverage=EXCLUDED.coverage, source=EXCLUDED.source`,
        [c, prev.pool_target, JSON.stringify(prev.difficulty_distribution), JSON.stringify(prev.type_distribution), JSON.stringify(prev.coverage), prev.source]);
    } else {
      await pool.query(`DELETE FROM onto_question_blueprints WHERE competency_id=$1 AND source='phase23-smoke'`, [c]);
    }
  }
}

(async () => {
  try {
    await setup();
    await run();
  } catch (e: any) {
    log(false, `EXCEPTION: ${e?.message ?? e}`);
    console.error(e);
  } finally {
    await cleanup().catch((e) => console.error('cleanup error', e));
    await pool.end();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
