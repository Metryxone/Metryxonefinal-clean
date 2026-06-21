/**
 * PHASE 5.9 — Shortlisting Engine smoke test.
 *
 * Run: cd backend && FF_SHORTLISTING=1 npx tsx scripts/smoke-shortlisting-engine.ts
 *
 * Covers the full pipeline lifecycle over a REAL @example.com substrate:
 *   1. workflow_engine FSM — pure transition/entry validation (canTransition,
 *      getWorkflowDefinition: 7 statuses, funnel order, entry/terminal flags).
 *   2. GET-never-writes — pg_class snapshot around the READ paths proves ZERO DDL
 *      (tables absent until the first POST write).
 *   3. Status Management — add (entry) -> shortlist -> interview -> offer -> hire
 *      forward funnel; each transition recorded; BIGSERIAL id string-coerced.
 *   4. Workflow validation — bad entry (offer as first action) -> conflict;
 *      invalid transition (review -> hire) -> conflict; same-status -> conflict;
 *      unknown status -> invalid_input.
 *   5. Workflow Tracking — append-only history grows by exactly one row per
 *      accepted transition; from/to chain is correct and ordered.
 *   6. Job-scoping (IDOR) — a cross-job candidate AND an unbound (null job_id)
 *      candidate are NON-actionable (invalid_input), never silently pipelined.
 *   7. Summary — funnel counts + Coverage (pipeline penetration); unmeasured denom
 *      stays null, never fabricated 0; provenance = operator_recorded.
 *   8. HTTP flag-OFF 503 on the running server.
 *
 * Fail-safe harness + completeness guard. Self-cleans all seeded rows.
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import {
  canTransition,
  getWorkflowDefinition,
  isValidStatus,
  setPipelineStatus,
  getPipelineEntry,
  listPipeline,
  getPipelineHistory,
  pipelineSummary,
  PIPELINE_STATUSES,
} from '../services/shortlisting-engine';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) { passed++; console.log(`  PASS ${name}`); }
  else { failed++; console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

const EMPLOYER = randomUUID();
const EMPLOYER_EMAIL = `sl-smoke-${EMPLOYER}@example.com`;
const JOB_ID = `job_sl_smoke_${EMPLOYER.slice(0, 8)}`;
const OTHER_JOB_ID = `job_sl_smoke_other_${EMPLOYER.slice(0, 8)}`;
const CAND_A = `cand_sl_A_${EMPLOYER.slice(0, 8)}`;
const CAND_B = `cand_sl_B_${EMPLOYER.slice(0, 8)}`;
const CAND_X = `cand_sl_X_${EMPLOYER.slice(0, 8)}`; // belongs to OTHER_JOB
const CAND_U = `cand_sl_U_${EMPLOYER.slice(0, 8)}`; // unbound (null job_id)
const CAND_C = `cand_sl_C_${EMPLOYER.slice(0, 8)}`; // concurrency test

async function run(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('\n=== PHASE 5.9 — Shortlisting Engine smoke ===\n');

    // ── seed real substrate ───────────────────────────────────────────────────
    await pool.query(
      `INSERT INTO users (id, username, password, email, account_type)
       VALUES ($1, $2, $3, $2, 'employer') ON CONFLICT (id) DO NOTHING`,
      [EMPLOYER, EMPLOYER_EMAIL, 'x'],
    );
    await pool.query(
      `INSERT INTO employer_jobs (id, employer_id, title, status)
       VALUES ($1,$2,'Backend Engineer','open'), ($3,$2,'QA Engineer','open')
       ON CONFLICT (id) DO NOTHING`,
      [JOB_ID, EMPLOYER, OTHER_JOB_ID],
    );
    const seedCand = async (id: string, job: string | null, name: string) => {
      await pool.query(
        `INSERT INTO employer_candidates (id, employer_id, job_id, name, email)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
        [id, EMPLOYER, job, name, `${id}@example.com`],
      );
    };
    await seedCand(CAND_A, JOB_ID, 'Alice');
    await seedCand(CAND_B, JOB_ID, 'Bob');
    await seedCand(CAND_X, OTHER_JOB_ID, 'Xavier');
    await seedCand(CAND_U, null, 'Uma'); // unbound
    await seedCand(CAND_C, JOB_ID, 'Cora'); // concurrency

    // ── 1. workflow_engine FSM (pure) ──────────────────────────────────────────
    console.log('— workflow_engine FSM —');
    const wf = getWorkflowDefinition();
    check('7 canonical statuses', wf.statuses.length === 7 && PIPELINE_STATUSES.length === 7);
    check('funnel order = review,shortlist,interview,offer,hire',
      wf.funnel_order.join(',') === 'review,shortlist,interview,offer,hire');
    check('hire allows only rescind -> reject', wf.statuses.find((s) => s.status === 'hire')!.allowed_next.join(',') === 'reject');
    check('offer is NOT an entry status', wf.entry_statuses.includes('offer' as any) === false);
    check('review IS an entry status', wf.entry_statuses.includes('review' as any) === true);
    check('canTransition(null -> review) entry ok', canTransition(null, 'review') === true);
    check('canTransition(null -> hire) blocked (not entry)', canTransition(null, 'hire') === false);
    check('canTransition(review -> hire) blocked (skip funnel)', canTransition('review', 'hire') === false);
    check('canTransition(offer -> hire) ok', canTransition('offer', 'hire') === true);
    check('canTransition(review -> review) same-status blocked', canTransition('review', 'review') === false);
    check('isValidStatus rejects junk', isValidStatus('maybe') === false && isValidStatus('hire') === true);

    // ── 2. GET-never-writes guard — BEFORE any write (pipeline tables absent) ───
    console.log('— GET-never-writes guard —');
    const relCount = async (): Promise<number> =>
      Number((await pool.query(`SELECT count(*)::int AS n FROM pg_class WHERE relkind IN ('r','i')`)).rows[0].n);
    const relBefore = await relCount();
    await listPipeline(pool, JOB_ID);
    await pipelineSummary(pool, JOB_ID);
    await getPipelineEntry(pool, JOB_ID, CAND_A);
    await getPipelineHistory(pool, JOB_ID, CAND_A);
    const relAfter = await relCount();
    check('READ paths created ZERO relations (GET-never-writes)', relAfter === relBefore, `before ${relBefore}, after ${relAfter}`);

    // ── 3. Status Management — forward funnel ──────────────────────────────────
    console.log('— Status Management (forward funnel) —');
    const add = await setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_A, status: 'review', actor: EMPLOYER_EMAIL });
    check('add A -> review (entry) ok, BIGSERIAL id string', add.ok && typeof (add as any).data.id === 'string' && Number.isFinite(Number((add as any).data.id)));
    check('add returns previous_status null + transitioned', add.ok && (add as any).data.previous_status === null && (add as any).data.transitioned === true);
    check('add carries operator disclaimer (NOT a verdict)', add.ok && /does NOT generate any algorithmic/i.test((add as any).data.disclaimer));
    const t2 = await setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_A, status: 'shortlist', actor: EMPLOYER_EMAIL });
    check('review -> shortlist ok', t2.ok && (t2 as any).data.status === 'shortlist' && (t2 as any).data.previous_status === 'review');
    const t3 = await setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_A, status: 'interview', actor: EMPLOYER_EMAIL });
    check('shortlist -> interview ok (stage_order 3)', t3.ok && (t3 as any).data.status === 'interview' && (t3 as any).data.stage_order === 3);
    const t4 = await setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_A, status: 'offer', actor: EMPLOYER_EMAIL });
    check('interview -> offer ok', t4.ok && (t4 as any).data.status === 'offer');
    const t5 = await setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_A, status: 'hire', actor: EMPLOYER_EMAIL });
    check('offer -> hire ok (stage_order 5)', t5.ok && (t5 as any).data.status === 'hire' && (t5 as any).data.stage_order === 5);

    // Second candidate: review -> reject -> reopen(review)
    await setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_B, status: 'review', actor: EMPLOYER_EMAIL });
    const bReject = await setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_B, status: 'reject', actor: EMPLOYER_EMAIL });
    check('B review -> reject ok (side state, stage_order null)', bReject.ok && (bReject as any).data.status === 'reject' && (bReject as any).data.stage_order === null);
    const bReopen = await setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_B, status: 'review', actor: EMPLOYER_EMAIL });
    check('B reject -> review (reopen) ok', bReopen.ok && (bReopen as any).data.status === 'review');

    // ── 4. Workflow validation ────────────────────────────────────────────────
    console.log('— Workflow validation —');
    const badEntry = await setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_B, status: 'offer', actor: EMPLOYER_EMAIL });
    // CAND_B is currently 'review' -> 'offer' is an invalid transition (conflict)
    check('review -> offer blocked (conflict)', !badEntry.ok && (badEntry as any).code === 'conflict');
    const sameStatus = await setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_A, status: 'hire', actor: EMPLOYER_EMAIL });
    check('same-status (hire -> hire) -> conflict', !sameStatus.ok && (sameStatus as any).code === 'conflict');
    const skip = await setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_B, status: 'hire', actor: EMPLOYER_EMAIL });
    check('review -> hire (skip funnel) -> conflict', !skip.ok && (skip as any).code === 'conflict');
    const junk = await setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_B, status: 'maybe', actor: EMPLOYER_EMAIL });
    check('unknown status -> invalid_input', !junk.ok && (junk as any).code === 'invalid_input');

    // fresh-candidate bad ENTRY: offer as first action
    const freshOffer = await setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_X, status: 'offer', actor: EMPLOYER_EMAIL });
    // CAND_X belongs to OTHER_JOB so this is actually IDOR-blocked first — assert below.

    // ── 6. Job-scoping (IDOR) ──────────────────────────────────────────────────
    console.log('— Job-scoping guard (IDOR) —');
    check('cross-job candidate NON-actionable (invalid_input)', !freshOffer.ok && (freshOffer as any).code === 'invalid_input');
    const idorX = await setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_X, status: 'review', actor: EMPLOYER_EMAIL });
    check('cross-job candidate cannot be added to wrong job', !idorX.ok && (idorX as any).code === 'invalid_input');
    const idorU = await setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_U, status: 'review', actor: EMPLOYER_EMAIL });
    check('unbound (null job_id) candidate NON-actionable', !idorU.ok && (idorU as any).code === 'invalid_input');

    // ── 5. Workflow Tracking (append-only history) ─────────────────────────────
    console.log('— Workflow Tracking (history) —');
    const hist = await getPipelineHistory(pool, JOB_ID, CAND_A);
    check('A history has exactly 5 transitions (append-only)', hist.ok && (hist as any).data.count === 5);
    if (hist.ok) {
      const chain = (hist as any).data.transitions.map((t: any) => `${t.from_status ?? 'new'}>${t.to_status}`).join(',');
      check('A history chain ordered new>review>...>hire',
        chain === 'new>review,review>shortlist,shortlist>interview,interview>offer,offer>hire', chain);
    }
    const histB = await getPipelineHistory(pool, JOB_ID, CAND_B);
    check('B history = 3 (review,reject,review) — rejected transitions NOT recorded', histB.ok && (histB as any).data.count === 3);

    // ── current entry + list reads ─────────────────────────────────────────────
    console.log('— Reads —');
    const entryA = await getPipelineEntry(pool, JOB_ID, CAND_A);
    check('get entry A -> hire', entryA.ok && (entryA as any).data.status === 'hire');
    const list = await listPipeline(pool, JOB_ID);
    check('list pipeline has 2 candidates (A,B)', list.ok && (list as any).data.count === 2);
    const listHire = await listPipeline(pool, JOB_ID, { status: 'hire' });
    check('list filtered by status=hire returns only A', listHire.ok && (listHire as any).data.count === 1 && (listHire as any).data.candidates[0].candidate_id === CAND_A);

    // ── 7. Summary (funnel + coverage) ─────────────────────────────────────────
    console.log('— Summary —');
    const sum = await pipelineSummary(pool, JOB_ID);
    check('summary in_pipeline = 2', sum.ok && (sum as any).data.in_pipeline === 2);
    check('summary total_candidates = 3 (A,B,C bound to job)', sum.ok && (sum as any).data.total_candidates === 3);
    check('summary coverage_pct = 66.7 (2/3)', sum.ok && (sum as any).data.coverage_pct === 66.7);
    check('summary by_status.hire = 1, by_status.review = 1', sum.ok && (sum as any).data.by_status.hire === 1 && (sum as any).data.by_status.review === 1);
    check('summary provenance = operator_recorded', sum.ok && (sum as any).data.provenance === 'operator_recorded');
    check('summary funnel lists 5 ordered stages', sum.ok && (sum as any).data.funnel.length === 5 && (sum as any).data.funnel[0].status === 'review');

    // ── GET-never-writes guard AFTER writes (reads still no DDL) ───────────────
    const relMid = await relCount();
    await listPipeline(pool, JOB_ID);
    await pipelineSummary(pool, JOB_ID);
    await getPipelineHistory(pool, JOB_ID, CAND_A);
    check('reads after writes STILL create ZERO relations', (await relCount()) === relMid);

    // ── 7b. Concurrency: atomic state + append-only history ────────────────────
    console.log('— concurrency (atomic write + history integrity) —');
    // Parallel identical ENTRY inserts: exactly one wins, others conflict; history == 1.
    const entryRace = await Promise.all([
      setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_C, status: 'review', actor: EMPLOYER_EMAIL }),
      setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_C, status: 'review', actor: EMPLOYER_EMAIL }),
      setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_C, status: 'review', actor: EMPLOYER_EMAIL }),
    ]);
    check('parallel entry: exactly one transition succeeds', entryRace.filter((r) => r.ok).length === 1);
    const histC1 = await getPipelineHistory(pool, JOB_ID, CAND_C);
    check('parallel entry: history has exactly one row', histC1.ok && (histC1.data as any).transitions.length === 1);

    // Parallel identical TRANSITIONS on the now-existing row: one wins (review->shortlist),
    // the rest are same-status conflicts; history appends exactly one more row (== 2).
    const moveRace = await Promise.all([
      setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_C, status: 'shortlist', actor: EMPLOYER_EMAIL }),
      setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_C, status: 'shortlist', actor: EMPLOYER_EMAIL }),
      setPipelineStatus(pool, { jobId: JOB_ID, candidateId: CAND_C, status: 'shortlist', actor: EMPLOYER_EMAIL }),
    ]);
    check('parallel transition: exactly one succeeds', moveRace.filter((r) => r.ok).length === 1);
    const histC2 = await getPipelineHistory(pool, JOB_ID, CAND_C);
    check('parallel transition: history appended exactly once (== 2)', histC2.ok && (histC2.data as any).transitions.length === 2);

    // ── 8. HTTP flag gate (server flag OFF) ────────────────────────────────────
    console.log('— HTTP flag gate (server flag OFF) —');
    const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:8080';
    try {
      const r1 = await fetch(`${base}/api/shortlisting-engine/_meta/status`);
      check('HTTP /_meta/status flag-gated 503', r1.status === 503, `got ${r1.status}`);
      const r2 = await fetch(`${base}/api/shortlisting-engine/job/${encodeURIComponent(JOB_ID)}/summary`);
      check('HTTP /job/:id/summary flag-gated 503', r2.status === 503, `got ${r2.status}`);
    } catch (e: any) {
      check('HTTP reachable', false, e?.message ?? 'fetch failed');
    }

    // Completeness guard.
    const EXPECTED_CHECKS = 47;
    check(`all ${EXPECTED_CHECKS} checks executed (no section skipped by exception)`, passed + failed === EXPECTED_CHECKS, `ran ${passed + failed}`);
  } catch (e: any) {
    failed++;
    console.log(`  FAIL smoke threw before completion — ${e?.message ?? e}`);
  } finally {
    await pool.query(`DELETE FROM workflow_transitions WHERE job_id IN ($1,$2)`, [JOB_ID, OTHER_JOB_ID]).catch(() => {});
    await pool.query(`DELETE FROM candidate_pipeline WHERE job_id IN ($1,$2)`, [JOB_ID, OTHER_JOB_ID]).catch(() => {});
    await pool.query(`DELETE FROM employer_candidates WHERE id = ANY($1)`, [[CAND_A, CAND_B, CAND_X, CAND_U, CAND_C]]).catch(() => {});
    await pool.query(`DELETE FROM employer_jobs WHERE id IN ($1,$2)`, [JOB_ID, OTHER_JOB_ID]).catch(() => {});
    await pool.query(`DELETE FROM users WHERE id = $1`, [EMPLOYER]).catch(() => {});
    console.log('  cleanup: removed demo transitions/pipeline/candidates/jobs/users rows');
    await pool.end();
    console.log(`\nResult: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

run();
