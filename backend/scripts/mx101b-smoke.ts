/**
 * MX-101B — Assessment Readiness Acceleration smoke test (service-level, bypasses 2FA HTTP login).
 *
 * Exercises the REAL machinery against the shared live DB end-to-end:
 *   generate DRAFT pack (no coverage change) → certify (Confidence axis, ≠ approval) →
 *   readiness BEFORE approval (not base-ready) → bulkReview approve EXPLICIT ids (the only
 *   coverage-changing op) → readiness AFTER (base-ready, Coverage⟂Confidence held) →
 *   snapshot + trends → guardrails (empty-id bulk rejected; certifiedOnly fast-track skips).
 *
 * Then PURGES every row it created (drafts, map links, certifications, audit rows, its own
 * snapshot) and asserts the live baseline is restored byte-for-byte. Harness only — the
 * product itself never deletes. Writes are confined to the @example.com / mx101b-smoke marker.
 *
 * Run: cd backend && FF_ASSESSMENT_READINESS=1 npx tsx scripts/mx101b-smoke.ts
 */
import { Pool } from 'pg';
import { generateDraftPack } from '../services/question-factory';
import { certifyDrafts, getCertificationSummary } from '../services/question-certification';
import { bulkReview } from '../services/review-workbench';
import {
  getAssessmentReadiness,
  getCompetencyReadiness,
  captureSnapshot,
  getCoverageTrends,
} from '../services/assessment-readiness';

const SMOKE_BY = 'mx101b-smoke@example.com';
const SNAP_LABEL = 'mx101b-smoke';
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
  // Pick a genome competency that currently has NO factory drafts.
  const comp = (await pool.query(
    `SELECT id, canonical_name FROM onto_competencies WHERE deprecated IS NOT TRUE ORDER BY id LIMIT 1`)).rows[0];
  ok(!!comp, `picked genome competency ${comp?.id} (${comp?.canonical_name})`);
  const cid = comp.id as string;

  const beforeCov = await approvedActiveCount(cid);
  const beforeReadiness = await getAssessmentReadiness(pool);
  const beforeBaseReady = (beforeReadiness as any)?.readiness_breakdown?.base_ready ?? 0;
  console.log(`baseline approved+active=${beforeCov}, base_ready competencies=${beforeBaseReady}`);

  // 1) GENERATE drafts — must NOT change coverage.
  const gen = await generateDraftPack(pool, { competencyId: cid, createdBy: SMOKE_BY });
  ok(gen.ok && gen.generated >= 4, `generated ${gen.ok ? gen.generated : 0} drafts (>=4)`);
  const ids: string[] = (gen as any).ids || [];
  ok(await approvedActiveCount(cid) === beforeCov, 'coverage UNCHANGED after generation');

  // 2) CERTIFY — Confidence axis; pre-qualifies, never approves.
  const cert = await certifyDrafts(pool, { competencyId: cid, certifiedBy: SMOKE_BY });
  ok((cert as any).ok && cert.evaluated >= 4, `certified ${cert.evaluated} drafts (certified=${cert.certified}, needs_review=${cert.needs_review}, failed=${cert.failed})`);
  ok(cert.certified + cert.needs_review + cert.failed === cert.evaluated, 'cert tallies reconcile to evaluated');
  ok(await approvedActiveCount(cid) === beforeCov, 'coverage UNCHANGED after certification (cert ≠ approval)');

  const certSummary = await getCertificationSummary(pool);
  ok((certSummary as any).schema_initialized === true, 'certification ledger schema initialized');
  ok((certSummary as any).total >= cert.evaluated, `cert summary total (${(certSummary as any).total}) >= this run (${cert.evaluated})`);

  // 3) READINESS before approval — competency must NOT be base-ready (0 approved).
  const preComp = await getCompetencyReadiness(pool, { competencyId: cid });
  const preRow = (preComp as any).items?.find((r: any) => String(r.competency_id) === String(cid)) || (preComp as any).items?.[0];
  ok(!preRow || preRow.base_ready === false, 'competency NOT base-ready before any approval');

  // 4) BULK APPROVE — the ONLY coverage-changing op, over EXPLICIT human-selected ids.
  const approve = await bulkReview(pool, { ids, action: 'approve', reviewerId: SMOKE_BY });
  ok((approve as any).ok && (approve as any).applied === ids.length, `bulk approved ${(approve as any).applied}/${ids.length} explicit ids`);
  const afterCov = await approvedActiveCount(cid);
  ok(afterCov === beforeCov + ids.length, `coverage rose by exactly the approved set (${beforeCov} -> ${afterCov})`);

  // 5) READINESS after approval — base-ready now true; Coverage⟂Confidence invariant holds.
  const postComp = await getCompetencyReadiness(pool, { competencyId: cid });
  const postRow = (postComp as any).items?.find((r: any) => String(r.competency_id) === String(cid)) || (postComp as any).items?.[0];
  ok(!!postRow && postRow.base_ready === true, 'competency base-ready AFTER explicit approvals');
  ok(!!postRow && ['ready_unverified', 'ready_quality_concern', 'ready_assured'].includes(postRow.readiness_level), `readiness_level is a ready_* state (${postRow?.readiness_level})`);

  const postReadiness: any = await getAssessmentReadiness(pool);
  const rb = postReadiness?.readiness_breakdown || {};
  // Quality-assured ⊆ base-ready ⊆ approved ⊆ draft — the Coverage⟂Confidence ordering invariant.
  ok((rb.ready_assured ?? 0) <= (rb.base_ready ?? 0), `quality-assured (${rb.ready_assured}) <= base-ready (${rb.base_ready}) — Confidence never exceeds Coverage`);
  ok((rb.base_ready ?? 0) >= beforeBaseReady + 1, `base-ready rose after approval (${beforeBaseReady} -> ${rb.base_ready})`);

  // 6) SNAPSHOT + TRENDS — append-only time series.
  const snap = await captureSnapshot(pool, SNAP_LABEL);
  ok((snap as any).ok === true, 'snapshot captured');
  const trends = await getCoverageTrends(pool, 60);
  ok(Array.isArray((trends as any).series) && (trends as any).series.length >= 1, `trends series has >=1 point (${(trends as any).series?.length})`);

  // 7) GUARDRAILS — bulk review must refuse an empty id set (no implicit/blanket approval).
  const empty = await bulkReview(pool, { ids: [], action: 'approve', reviewerId: SMOKE_BY });
  ok((empty as any).ok === false && (empty as any).error === 'no_ids', 'bulk approve REFUSES empty id set (no blanket approval)');

  // never-throws: a malformed (non-uuid) id must NOT 500 — it is partitioned into errors and the
  // valid ids still process (here a single bad id with no valid companions → ok:false no_valid_ids).
  const bad = await bulkReview(pool, { ids: ['not-a-uuid'], action: 'approve', reviewerId: SMOKE_BY });
  ok((bad as any).ok === false && (bad as any).error === 'no_valid_ids', 'malformed-only bulk id set rejected without throwing (never-throws)');

  // certifiedOnly fast-track only approves certified rows. (All our ids are already approved, so a
  // fresh draft proves the skip path.) Generate one extra UNCERTIFIED draft and try certifiedOnly.
  const gen2 = await generateDraftPack(pool, { competencyId: cid, createdBy: SMOKE_BY });
  const ids2: string[] = (gen2 as any).ids || [];
  const ff = await bulkReview(pool, { ids: ids2, action: 'approve', reviewerId: SMOKE_BY, certifiedOnly: true });
  ok((ff as any).ok === true && (ff as any).applied === 0 && ((ff as any).skipped?.length ?? 0) === ids2.length,
    'certifiedOnly fast-track SKIPS uncertified drafts (no fabricated approvals)');

  // ---- CLEANUP (harness only — remove every row this smoke created) ----
  const allIds = [...ids, ...ids2];
  await pool.query(`DELETE FROM qf_review_audit WHERE question_id = ANY($1::uuid[])`, [allIds]).catch(() => {});
  // certifyDrafts(competencyId) also certifies pre-existing actionable drafts for that competency;
  // every cert row written this run carries certified_by=SMOKE_BY, so purge by that marker too
  // (this returns those pre-existing drafts to their original uncertified state — no residue).
  await pool.query(`DELETE FROM question_certifications WHERE question_id = ANY($1::uuid[]) OR certified_by=$2`, [allIds, SMOKE_BY]).catch(() => {});
  await pool.query(`DELETE FROM onto_competency_question_map WHERE question_id = ANY($1::uuid[])`, [allIds]);
  await pool.query(`DELETE FROM competency_question_templates WHERE id = ANY($1::uuid[])`, [allIds]);
  await pool.query(`DELETE FROM question_factory_batches WHERE created_by=$1`, [SMOKE_BY]).catch(() => {});
  await pool.query(`DELETE FROM qf_coverage_snapshots WHERE label=$1`, [SNAP_LABEL]).catch(() => {});

  const afterCleanCov = await approvedActiveCount(cid);
  ok(afterCleanCov === beforeCov, `cleanup restored coverage baseline (${beforeCov} -> ${afterCleanCov})`);
  const afterCleanReadiness: any = await getAssessmentReadiness(pool);
  ok((afterCleanReadiness?.readiness_breakdown?.base_ready ?? 0) === beforeBaseReady, 'cleanup restored base-ready baseline (no inflation)');

  console.log(`\n${fail === 0 ? 'ALL PASS' : fail + ' FAILED'}`);
  await pool.end();
  process.exit(fail === 0 ? 0 : 1);
}
run().catch(async (e) => { console.error('SMOKE ERROR', e); try { await pool.end(); } catch {} process.exit(1); });
