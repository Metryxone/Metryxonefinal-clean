/**
 * Phase 2.2 e2e smoke — Question Blueprint Engine (flag ON).
 *
 * The competency question bank is empty, so this inserts ONE demo bank question,
 * maps it (Question → Competency + Micro + Difficulty + Type), reads the pool
 * (Competency → Question Pool), derives + authors a question blueprint, validates
 * good/bad inputs, exercises the micro-mismatch + invalid-type guards, then
 * DELETES every demo row. Idempotent.
 *
 *   FF_COMPETENCY_RUNTIME=1 tsx scripts/phase2_2-question-blueprint-smoke.ts
 */
process.env.FF_COMPETENCY_RUNTIME = '1';

import { Pool } from 'pg';
import {
  ensureQuestionBlueprintSchema, getDifficultyFramework, validateQuestionType,
  mapQuestion, getQuestionMapping, getQuestionPool,
  buildQuestionBlueprint, getQuestionBlueprint, validateQuestionBlueprintInput,
} from '../services/question-blueprint.js';
import { isCompetencyRuntimeEnabled } from '../config/feature-flags.js';

const COMP = 'comp_communication';           // exists; has hierarchy children
const DEMO_KEY = 'demo_p22_q1';

function assert(cond: any, msg: string) { if (!cond) throw new Error('ASSERT FAILED: ' + msg); }

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const log = (...a: any[]) => console.log(...a);
  log('flag isCompetencyRuntimeEnabled():', isCompetencyRuntimeEnabled());
  let demoId = '';

  try {
    await ensureQuestionBlueprintSchema(pool);

    // ---- 1. Framework + supported types ------------------------------------
    const fw = await getDifficultyFramework(pool);
    log('\n=== FRAMEWORK ===');
    log('difficulty levels:', fw.difficulty_levels.map((d) => d.level_key).join(', '));
    log('question types:', fw.question_types.map((t) => t.key).join(', '));
    assert(fw.difficulty_levels.length === 5, '5 difficulty levels seeded');
    assert(fw.question_types.length === 7, '7 supported question types');
    assert(validateQuestionType('sjt').key === 'situational_judgment', 'sjt alias -> situational_judgment');
    assert(validateQuestionType('banana').valid === false, 'banana is not a valid type');

    // ---- 2. Insert a DEMO bank question ------------------------------------
    const ins = await pool.query(
      `INSERT INTO competency_question_templates
         (template_key, competency_code, question_type, template_body, difficulty_band, status, source)
       VALUES ($1,'COM','likert', $2::jsonb, 'medium', 'approved', 'seed')
       ON CONFLICT (template_key) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [DEMO_KEY, JSON.stringify({ stem: 'DEMO p2.2 smoke question', options: [{ label: 'A', score: 0 }, { label: 'B', score: 100 }] })],
    );
    demoId = ins.rows[0].id;
    log('\n=== DEMO QUESTION ===', demoId);

    // micro id for "Active Listening" (child of comp_communication)
    const micro = await pool.query(
      `SELECT id, micro_label FROM onto_competency_hierarchy WHERE parent_competency_id = $1 ORDER BY id LIMIT 1`,
      [COMP],
    );
    const microId = Number(micro.rows[0].id);
    log('micro:', microId, micro.rows[0].micro_label);

    // ---- 3. MAP question -> competency (+micro, inherit difficulty/type) ----
    const mapped = await mapQuestion(pool, { questionId: demoId, competencyId: COMP, microCompetencyId: microId });
    log('\n=== MAP ===');
    log('ok:', mapped.ok, JSON.stringify((mapped as any).mapping));
    assert(mapped.ok, 'mapping succeeds');
    assert((mapped as any).mapping.difficulty_level === 'medium', 'inherited difficulty medium');
    assert((mapped as any).mapping.question_type === 'likert', 'inherited type likert');

    // canonical bare edge synced
    const synced = await pool.query(
      `SELECT 1 FROM onto_competency_question_map WHERE competency_id = $1 AND question_id = $2`, [COMP, demoId],
    );
    assert(synced.rowCount === 1, 'onto_competency_question_map synced');

    // ---- 4. Guard: micro that belongs to a DIFFERENT competency ------------
    const otherMicro = await pool.query(
      `SELECT id FROM onto_competency_hierarchy WHERE parent_competency_id <> $1 ORDER BY id LIMIT 1`, [COMP],
    );
    const mismatch = await mapQuestion(pool, { questionId: demoId, competencyId: COMP, microCompetencyId: Number(otherMicro.rows[0].id) });
    log('\n=== GUARD micro mismatch ===', JSON.stringify(mismatch));
    assert(!mismatch.ok && (mismatch as any).error === 'micro_competency_mismatch', 'micro mismatch rejected');

    // ---- 5. Guard: invalid type / difficulty ------------------------------
    const badType = await mapQuestion(pool, { questionId: demoId, competencyId: COMP, questionType: 'banana' });
    assert(!badType.ok && (badType as any).error === 'invalid_question_type', 'invalid type rejected');
    const badDiff = await mapQuestion(pool, { questionId: demoId, competencyId: COMP, difficultyLevel: 'impossible' });
    assert(!badDiff.ok && (badDiff as any).error === 'invalid_difficulty', 'invalid difficulty rejected');
    log('\n=== GUARDS type/difficulty rejected OK ===');

    // ---- 6. Question → Competency Pool -------------------------------------
    const pl = await getQuestionPool(pool, COMP);
    log('\n=== POOL ===');
    log('pool_size:', pl.pool_size, 'by_difficulty:', JSON.stringify(pl.by_difficulty), 'by_type:', JSON.stringify(pl.by_type));
    assert(pl.pool_size === 1, 'pool has 1 question');
    assert(pl.by_difficulty.medium === 1 && pl.by_type.likert === 1, 'pool grouped correctly');

    // ---- 7. Read mapping ---------------------------------------------------
    const qm = await getQuestionMapping(pool, demoId);
    assert(qm.question_found && qm.mappings.length === 1, 'question mapping readable');

    // ---- 8. DERIVE blueprint (descriptive mirror of actual pool) ----------
    const derived = await buildQuestionBlueprint(pool, COMP);
    log('\n=== BLUEPRINT (derived) ===');
    log('ok:', derived.ok, 'source:', (derived as any).source, 'pool_target:', (derived as any).pool_target);
    log('coverage:', JSON.stringify((derived as any).coverage));
    assert(derived.ok && (derived as any).source === 'derived' && (derived as any).pool_target === 1, 'derived mirrors pool');

    // ---- 9. AUTHOR blueprint (target 10) — coverage shows shortfall -------
    const authored = await buildQuestionBlueprint(pool, COMP, {
      poolTarget: 10,
      difficultyDistribution: { foundational: 2, easy: 2, medium: 3, hard: 2, expert: 1 },
      typeDistribution: { likert: 4, situational_judgment: 3, behavioral: 3 },
    });
    log('\n=== BLUEPRINT (authored) ===');
    log('ok:', authored.ok, 'source:', (authored as any).source);
    log('coverage:', JSON.stringify((authored as any).coverage));
    assert(authored.ok && (authored as any).source === 'authored', 'authored blueprint persisted');
    assert((authored as any).coverage.pool_actual === 1 && (authored as any).coverage.pool_target === 10, 'honest actual vs target');

    // ---- 10. VALIDATE good vs bad -----------------------------------------
    log('\n=== VALIDATE ===');
    const good = validateQuestionBlueprintInput({ pool_target: 5, difficulty_distribution: { medium: 5 }, type_distribution: { likert: 5 } });
    log('good ->', JSON.stringify(good.validation));
    assert(good.validation.valid, 'good blueprint valid');
    const bad = validateQuestionBlueprintInput({ pool_target: 5, difficulty_distribution: { nope: 2 }, type_distribution: { banana: 1 } });
    log('bad  ->', JSON.stringify(bad.validation));
    assert(!bad.validation.valid, 'bad keys rejected');

    // author with invalid distribution must NOT persist
    const rejected = await buildQuestionBlueprint(pool, COMP, { poolTarget: 3, difficultyDistribution: { nope: 3 } });
    assert(!rejected.ok && (rejected as any).error === 'invalid_blueprint', 'invalid author rejected');

    // ---- 11. READ BACK blueprint ------------------------------------------
    const rb = await getQuestionBlueprint(pool, COMP);
    log('\n=== READ BACK ===', 'exists:', rb.exists, 'pool_target:', rb.pool_target, 'source:', rb.source);
    assert(rb.exists && rb.pool_target === 10, 'authored blueprint read back (last write wins)');

    // ---- 12. 404-style guards ---------------------------------------------
    const noComp = await getQuestionPool(pool, 'comp_does_not_exist');
    assert(!noComp.competency_found, 'unknown competency -> not found');
    const noQ = await getQuestionMapping(pool, '00000000-0000-0000-0000-000000000000');
    assert(!noQ.question_found, 'unknown question -> not found');

    log('\n*** PHASE 2.2 SMOKE PASS ***');
  } finally {
    // CASCADE from the demo question removes its mapping + onto_competency_question_map rows.
    if (demoId) await pool.query(`DELETE FROM competency_question_templates WHERE id = $1`, [demoId]);
    await pool.query(`DELETE FROM onto_question_blueprints WHERE competency_id = $1`, [COMP]);
    console.log('cleanup done (demo question + blueprint removed)');
    await pool.end();
  }
}
main().catch((e) => { console.error('SMOKE FAILED:', e); process.exit(1); });
