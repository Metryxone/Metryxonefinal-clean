/**
 * MX-101X — Question Factory smoke test (service-level, bypasses the 2FA HTTP login).
 *
 * Exercises the real service against the live DB: schema ensure → generate DRAFT pack →
 * assert drafts created with map link INACTIVE (no coverage change) → approve one → assert
 * status=approved + map active=true (coverage +1) → reject one → retire one → coverage report.
 * Cleans up ALL rows it created so the shared bank returns to baseline (test harness only —
 * the product itself never deletes).
 *
 * Run: cd backend && npx tsx scripts/smoke-question-factory.ts
 */
import { Pool } from 'pg';
import {
  ensureQuestionFactorySchema,
  generateDraftPack,
  reviewQuestion,
  retireQuestion,
  getFactoryCoverage,
} from '../services/question-factory';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let fail = 0;
const ok = (cond: boolean, msg: string) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fail++; };

async function approvedActiveCount(competencyId: string): Promise<number> {
  const r = await pool.query(
    `SELECT COUNT(*)::int c FROM onto_competency_question_map m
     JOIN competency_question_templates t ON t.id=m.question_id
     WHERE m.competency_id=$1 AND m.active AND t.status='approved'`, [competencyId]);
  return Number(r.rows[0]?.c ?? 0);
}

async function run() {
  await ensureQuestionFactorySchema(pool);

  // Pick a genome competency that currently has NO factory drafts.
  const comp = (await pool.query(
    `SELECT id, canonical_name FROM onto_competencies WHERE deprecated IS NOT TRUE ORDER BY id LIMIT 1`)).rows[0];
  ok(!!comp, `picked genome competency ${comp?.id} (${comp?.canonical_name})`);
  const cid = comp.id as string;

  const before = await approvedActiveCount(cid);
  console.log(`baseline approved+active for ${cid}: ${before}`);

  // GENERATE
  const gen = await generateDraftPack(pool, { competencyId: cid, createdBy: 'smoke@example.com' });
  ok(gen.ok && gen.generated >= 4, `generated ${gen.ok ? gen.generated : 0} drafts (>=4)`);
  const ids: string[] = (gen as any).ids || [];

  // All generated rows must be DRAFT + pending_review + template_generated + map INACTIVE.
  const chk = await pool.query(
    `SELECT t.id, t.status, t.provenance, t.quality_review_status, t.confidence_score, m.active
     FROM competency_question_templates t
     LEFT JOIN onto_competency_question_map m ON m.question_id=t.id
     WHERE t.id = ANY($1::uuid[])`, [ids]);
  const rows = chk.rows;
  ok(rows.every(r => r.status === 'draft'), 'all generated rows status=draft');
  ok(rows.every(r => r.quality_review_status === 'pending_review'), 'all generated rows quality_review_status=pending_review');
  ok(rows.every(r => r.provenance === 'template_generated'), 'all generated rows provenance=template_generated');
  ok(rows.every(r => r.active === false), 'all generated map links INACTIVE (no coverage leak)');
  ok(rows.every(r => Number(r.confidence_score) > 0 && Number(r.confidence_score) < 1), 'confidence scores in (0,1)');

  const afterGen = await approvedActiveCount(cid);
  ok(afterGen === before, `coverage UNCHANGED after generation (${before} -> ${afterGen})`);

  // APPROVE the whole pack → coverage should rise by the pack size.
  for (const id of ids) {
    const a = await reviewQuestion(pool, id, 'approve', 'smoke@example.com');
    ok(a.ok && (a as any).row?.status === 'approved' && (a as any).row?.quality_review_status === 'approved', `approved ${id.slice(0, 8)}`);
  }
  const afterApprove = await approvedActiveCount(cid);
  ok(afterApprove === before + ids.length, `coverage rose by pack size after approval (${before} -> ${afterApprove})`);

  // RETIRE one → quality_review_status=retired, status drops to draft (constraint-safe), map inactive (coverage -1).
  const ret = await retireQuestion(pool, ids[0], 'smoke@example.com');
  ok(ret.ok && (ret as any).row?.quality_review_status === 'retired' && (ret as any).row?.status === 'draft', 'retire marks retired + leaves bank (never deletes)');
  const afterRetire = await approvedActiveCount(cid);
  ok(afterRetire === afterApprove - 1, `coverage drops by 1 after retire (${afterApprove} -> ${afterRetire})`);

  // Coverage report sanity.
  const cov = await getFactoryCoverage(pool);
  ok((cov as any).ok && (cov as any).genome_competencies >= 400, `coverage report: ${ (cov as any).genome_competencies } genome competencies`);
  ok(!!(cov as any).live_coverage && !!(cov as any).pipeline, 'coverage separates live vs pipeline');

  // CLEANUP — remove every row this smoke test created (harness only).
  await pool.query(`DELETE FROM onto_competency_question_map WHERE question_id = ANY($1::uuid[])`, [ids]);
  await pool.query(`DELETE FROM competency_question_templates WHERE id = ANY($1::uuid[])`, [ids]);
  await pool.query(`DELETE FROM question_factory_batches WHERE created_by='smoke@example.com'`);
  const afterClean = await approvedActiveCount(cid);
  ok(afterClean === before, `cleanup restored baseline (${before} -> ${afterClean})`);

  console.log(`\n${fail === 0 ? 'ALL PASS' : fail + ' FAILED'}`);
  await pool.end();
  process.exit(fail === 0 ? 0 : 1);
}
run().catch(async (e) => { console.error('SMOKE ERROR', e); try { await pool.end(); } catch {} process.exit(1); });
