/**
 * PHASE 5.10 — Interview Intelligence smoke test.
 *
 * Run: cd backend && FF_INTERVIEW_INTELLIGENCE=1 npx tsx scripts/smoke-interview-intelligence.ts
 *
 * Exercises all three engines over a REAL @example.com substrate:
 *   1. interview lifecycle FSM (pure) — statuses/transitions/entry/terminal.
 *   2. GET-never-writes — pg_class snapshot around the READ paths proves ZERO DDL.
 *   3. interview_engine — Scheduling (+ bad mode / IDOR rejects), lifecycle status
 *      (scheduled->completed, terminal/same-status/unknown conflicts), atomic
 *      concurrency, Decision Tracking (append-only + interview-scope IDOR).
 *   4. interview_feedback_engine — Feedback upsert + Panel Reviews (distribution,
 *      coverage vs recorded panel, modal recommendation incl. tie => null).
 *   5. evaluation_engine — Scoring (range guard + upsert) + Evaluation (per-criterion
 *      mean, overall normalized mean, coverage; candidate eval across interviews).
 *   6. interviewSummary — by_status / by_decision / coverage; provenance operator_recorded.
 *   7. HTTP flag-OFF 503 on the running server.
 *
 * Fail-safe harness + completeness guard. Self-cleans all seeded rows.
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import {
  getInterviewWorkflow,
  canTransitionInterview,
  isValidInterviewStatus,
  isValidMode,
  isValidDecision,
  scheduleInterview,
  updateInterviewStatus,
  recordDecision,
  getInterview,
  listInterviews,
  getDecisionHistory,
  interviewSummary,
  INTERVIEW_STATUSES,
} from '../services/interview-engine';
import {
  submitFeedback,
  getInterviewFeedback,
  getCandidateFeedback,
  panelReview,
} from '../services/interview-feedback-engine';
import {
  recordScore,
  getScores,
  evaluationSummary,
  candidateEvaluation,
} from '../services/evaluation-engine';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) { passed++; console.log(`  PASS ${name}`); }
  else { failed++; console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}
const D = (r: any) => (r as any).data;

const EMPLOYER = randomUUID();
const EMPLOYER_EMAIL = `iv-smoke-${EMPLOYER}@example.com`;
const JOB_ID = `job_iv_smoke_${EMPLOYER.slice(0, 8)}`;
const OTHER_JOB_ID = `job_iv_smoke_other_${EMPLOYER.slice(0, 8)}`;
const EMPTY_JOB_ID = `job_iv_smoke_empty_${EMPLOYER.slice(0, 8)}`; // a job with ZERO candidates
const CAND_A = `cand_iv_A_${EMPLOYER.slice(0, 8)}`;
const CAND_B = `cand_iv_B_${EMPLOYER.slice(0, 8)}`;
const CAND_X = `cand_iv_X_${EMPLOYER.slice(0, 8)}`; // belongs to OTHER_JOB
const CAND_U = `cand_iv_U_${EMPLOYER.slice(0, 8)}`; // unbound (null job_id)

async function run(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('\n=== PHASE 5.10 — Interview Intelligence smoke ===\n');

    // ── seed real substrate ───────────────────────────────────────────────────
    await pool.query(
      `INSERT INTO users (id, username, password, email, account_type)
       VALUES ($1, $2, $3, $2, 'employer') ON CONFLICT (id) DO NOTHING`,
      [EMPLOYER, EMPLOYER_EMAIL, 'x'],
    );
    await pool.query(
      `INSERT INTO employer_jobs (id, employer_id, title, status)
       VALUES ($1,$2,'Backend Engineer','open'), ($3,$2,'QA Engineer','open'), ($4,$2,'Empty Role','open')
       ON CONFLICT (id) DO NOTHING`,
      [JOB_ID, EMPLOYER, OTHER_JOB_ID, EMPTY_JOB_ID],
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
    await seedCand(CAND_U, null, 'Uma');

    // ── 1. interview lifecycle FSM (pure) ──────────────────────────────────────
    console.log('— interview lifecycle FSM —');
    const wf = getInterviewWorkflow();
    check('5 canonical statuses', wf.statuses.length === 5 && INTERVIEW_STATUSES.length === 5);
    check('entry status = scheduled', wf.entry_status === 'scheduled');
    check('completed is terminal', wf.statuses.find((s) => s.status === 'completed')!.is_terminal === true);
    check('cancelled is terminal', wf.statuses.find((s) => s.status === 'cancelled')!.is_terminal === true);
    check('scheduled -> completed ok', canTransitionInterview('scheduled', 'completed') === true);
    check('completed -> scheduled blocked (terminal)', canTransitionInterview('completed', 'scheduled') === false);
    check('scheduled -> scheduled same-status blocked', canTransitionInterview('scheduled', 'scheduled') === false);
    check('no_show -> rescheduled ok', canTransitionInterview('no_show', 'rescheduled') === true);
    check('modes = onsite,remote,phone', wf.modes.join(',') === 'onsite,remote,phone');
    check('decision_types = advance,hold,reject,hire', wf.decision_types.join(',') === 'advance,hold,reject,hire');
    check('isValidMode/isValidDecision/isValidInterviewStatus reject junk',
      isValidMode('zoom') === false && isValidMode('remote') === true &&
      isValidDecision('maybe') === false && isValidDecision('hire') === true &&
      isValidInterviewStatus('pending') === false && isValidInterviewStatus('scheduled') === true);

    // ── 2. GET-never-writes guard — BEFORE any write (tables absent) ───────────
    console.log('— GET-never-writes guard —');
    const relCount = async (): Promise<number> =>
      Number((await pool.query(`SELECT count(*)::int AS n FROM pg_class WHERE relkind IN ('r','i')`)).rows[0].n);
    const relBefore = await relCount();
    await listInterviews(pool, JOB_ID);
    await interviewSummary(pool, JOB_ID);
    await getDecisionHistory(pool, JOB_ID, CAND_A);
    await getInterview(pool, '999999');
    await getInterviewFeedback(pool, '999999');
    await getCandidateFeedback(pool, JOB_ID, CAND_A);
    await panelReview(pool, '999999');
    await getScores(pool, '999999');
    await evaluationSummary(pool, '999999');
    await candidateEvaluation(pool, JOB_ID, CAND_A);
    check('READ paths created ZERO relations (GET-never-writes)', (await relCount()) === relBefore);

    // ── 3a. Interview Scheduling ───────────────────────────────────────────────
    console.log('— Interview Scheduling —');
    const schA1 = await scheduleInterview(pool, {
      jobId: JOB_ID, candidateId: CAND_A, roundName: 'Technical 1', roundSeq: 1,
      mode: 'remote', panelists: ['p1', 'p2', 'p3'], actor: EMPLOYER_EMAIL,
    });
    check('schedule A1 ok, BIGSERIAL id string', schA1.ok && typeof D(schA1).id === 'string' && Number.isFinite(Number(D(schA1).id)));
    check('schedule A1 status=scheduled, panel size 3', schA1.ok && D(schA1).status === 'scheduled' && D(schA1).panelists.length === 3);
    check('schedule carries operator disclaimer (NOT a verdict)', schA1.ok && /NOT generate any algorithmic/i.test(D(schA1).disclaimer));
    const IV_A1 = schA1.ok ? D(schA1).id : '0';
    const schA2 = await scheduleInterview(pool, { jobId: JOB_ID, candidateId: CAND_A, roundName: 'Technical 2', roundSeq: 2, mode: 'onsite', actor: EMPLOYER_EMAIL });
    const IV_A2 = schA2.ok ? D(schA2).id : '0';
    check('schedule A2 ok (second round)', schA2.ok && D(schA2).status === 'scheduled');
    const schB1 = await scheduleInterview(pool, { jobId: JOB_ID, candidateId: CAND_B, roundName: 'Screen', mode: 'phone', panelists: ['p1'], actor: EMPLOYER_EMAIL });
    const IV_B1 = schB1.ok ? D(schB1).id : '0';
    check('schedule B1 ok', schB1.ok);
    const badMode = await scheduleInterview(pool, { jobId: JOB_ID, candidateId: CAND_A, mode: 'zoom', actor: EMPLOYER_EMAIL });
    check('bad mode -> invalid_input', !badMode.ok && (badMode as any).code === 'invalid_input');

    // ── 3b. Scheduling IDOR ────────────────────────────────────────────────────
    console.log('— Scheduling job-scope (IDOR) —');
    const idorX = await scheduleInterview(pool, { jobId: JOB_ID, candidateId: CAND_X, actor: EMPLOYER_EMAIL });
    check('cross-job candidate NON-actionable (invalid_input)', !idorX.ok && (idorX as any).code === 'invalid_input');
    const idorU = await scheduleInterview(pool, { jobId: JOB_ID, candidateId: CAND_U, actor: EMPLOYER_EMAIL });
    check('unbound (null job_id) candidate NON-actionable', !idorU.ok && (idorU as any).code === 'invalid_input');
    const noCand = await scheduleInterview(pool, { jobId: JOB_ID, candidateId: 'ghost', actor: EMPLOYER_EMAIL });
    check('missing candidate -> not_found', !noCand.ok && (noCand as any).code === 'not_found');

    // ── 3c. lifecycle status (atomic write) ────────────────────────────────────
    console.log('— Interview lifecycle status —');
    const compA1 = await updateInterviewStatus(pool, { interviewId: IV_A1, status: 'completed', actor: EMPLOYER_EMAIL });
    check('A1 scheduled -> completed ok, previous_status', compA1.ok && D(compA1).status === 'completed' && D(compA1).previous_status === 'scheduled');
    const termA1 = await updateInterviewStatus(pool, { interviewId: IV_A1, status: 'scheduled', actor: EMPLOYER_EMAIL });
    check('A1 completed -> scheduled blocked (terminal conflict)', !termA1.ok && (termA1 as any).code === 'conflict');
    const sameA1 = await updateInterviewStatus(pool, { interviewId: IV_A1, status: 'completed', actor: EMPLOYER_EMAIL });
    check('A1 same-status (completed->completed) conflict', !sameA1.ok && (sameA1 as any).code === 'conflict');
    const junkSt = await updateInterviewStatus(pool, { interviewId: IV_A1, status: 'pending', actor: EMPLOYER_EMAIL });
    check('unknown status -> invalid_input', !junkSt.ok && (junkSt as any).code === 'invalid_input');
    const ghostSt = await updateInterviewStatus(pool, { interviewId: '99999999', status: 'completed', actor: EMPLOYER_EMAIL });
    check('status on missing interview -> not_found', !ghostSt.ok && (ghostSt as any).code === 'not_found');

    // ── 3d. concurrency (atomic lifecycle) ─────────────────────────────────────
    console.log('— concurrency (atomic lifecycle) —');
    const schD = await scheduleInterview(pool, { jobId: JOB_ID, candidateId: CAND_B, roundName: 'Onsite', mode: 'onsite', actor: EMPLOYER_EMAIL });
    const IV_D = schD.ok ? D(schD).id : '0';
    const race = await Promise.all([
      updateInterviewStatus(pool, { interviewId: IV_D, status: 'completed', actor: EMPLOYER_EMAIL }),
      updateInterviewStatus(pool, { interviewId: IV_D, status: 'completed', actor: EMPLOYER_EMAIL }),
      updateInterviewStatus(pool, { interviewId: IV_D, status: 'completed', actor: EMPLOYER_EMAIL }),
    ]);
    check('parallel status change: exactly one succeeds', race.filter((r) => r.ok).length === 1);
    const dNow = await getInterview(pool, IV_D);
    check('raced interview is completed', dNow.ok && D(dNow).status === 'completed');

    // ── 3e. Decision Tracking (append-only + interview-scope IDOR) ─────────────
    console.log('— Decision Tracking —');
    const dec1 = await recordDecision(pool, { jobId: JOB_ID, candidateId: CAND_A, decision: 'advance', interviewId: IV_A1, rationale: 'strong round 1', actor: EMPLOYER_EMAIL });
    check('record decision advance ok, interview_id linked', dec1.ok && D(dec1).decision === 'advance' && D(dec1).interview_id === IV_A1);
    const dec2 = await recordDecision(pool, { jobId: JOB_ID, candidateId: CAND_A, decision: 'hire', actor: EMPLOYER_EMAIL });
    check('record decision hire ok (no interview ref)', dec2.ok && D(dec2).decision === 'hire' && D(dec2).interview_id === null);
    const badDec = await recordDecision(pool, { jobId: JOB_ID, candidateId: CAND_A, decision: 'promote', actor: EMPLOYER_EMAIL });
    check('unknown decision -> invalid_input', !badDec.ok && (badDec as any).code === 'invalid_input');
    const idorDec = await recordDecision(pool, { jobId: JOB_ID, candidateId: CAND_A, decision: 'advance', interviewId: IV_B1, actor: EMPLOYER_EMAIL });
    check('decision citing another candidate\'s interview -> invalid_input (IDOR)', !idorDec.ok && (idorDec as any).code === 'invalid_input');
    const decHist = await getDecisionHistory(pool, JOB_ID, CAND_A);
    check('decision history append-only = 2 (rejected not recorded)', decHist.ok && D(decHist).count === 2);

    // ── 4. Feedback + Panel Reviews ────────────────────────────────────────────
    console.log('— Interview Feedback + Panel Reviews —');
    const fb1 = await submitFeedback(pool, { interviewId: IV_A1, panelist: 'p1', recommendation: 'strong_yes', strengths: 'system design', actor: EMPLOYER_EMAIL });
    check('submit feedback p1 strong_yes ok', fb1.ok && D(fb1).recommendation === 'strong_yes');
    const fb1u = await submitFeedback(pool, { interviewId: IV_A1, panelist: 'p1', recommendation: 'yes', comments: 'revised', actor: EMPLOYER_EMAIL });
    check('feedback upsert (p1 revised) ok', fb1u.ok && D(fb1u).recommendation === 'yes');
    await submitFeedback(pool, { interviewId: IV_A1, panelist: 'p2', recommendation: 'strong_yes', actor: EMPLOYER_EMAIL });
    const fbList = await getInterviewFeedback(pool, IV_A1);
    check('feedback list = 2 distinct panelists (upsert, not appended)', fbList.ok && D(fbList).count === 2);
    const badRec = await submitFeedback(pool, { interviewId: IV_A1, panelist: 'p3', recommendation: 'lgtm', actor: EMPLOYER_EMAIL });
    check('bad recommendation -> invalid_input', !badRec.ok && (badRec as any).code === 'invalid_input');
    const fbGhost = await submitFeedback(pool, { interviewId: '99999999', panelist: 'p1', recommendation: 'yes' });
    check('feedback on missing interview -> not_found', !fbGhost.ok && (fbGhost as any).code === 'not_found');

    // panel review: p1=yes, p2=strong_yes -> tie => modal null; coverage 2/3
    const pr1 = await panelReview(pool, IV_A1);
    check('panel review panel_size 3, submitted 2, coverage 66.7', pr1.ok && D(pr1).panel_size === 3 && D(pr1).submitted === 2 && D(pr1).coverage_pct === 66.7);
    check('panel review tie -> modal_recommendation null', pr1.ok && D(pr1).modal_recommendation === null);
    check('panel review provenance operator_recorded (NOT a verdict)', pr1.ok && D(pr1).provenance === 'operator_recorded');
    // add p3 strong_yes -> strong_yes:2, yes:1 -> modal strong_yes; coverage 100
    await submitFeedback(pool, { interviewId: IV_A1, panelist: 'p3', recommendation: 'strong_yes', actor: EMPLOYER_EMAIL });
    const pr2 = await panelReview(pool, IV_A1);
    check('panel review after p3: coverage 100, modal strong_yes', pr2.ok && D(pr2).coverage_pct === 100 && D(pr2).modal_recommendation === 'strong_yes');
    check('panel review distribution strong_yes=2, yes=1', pr2.ok && D(pr2).distribution.strong_yes === 2 && D(pr2).distribution.yes === 1);
    const candFb = await getCandidateFeedback(pool, JOB_ID, CAND_A);
    check('candidate feedback aggregates all 3 panelists', candFb.ok && D(candFb).count === 3);

    // ── 5. Scoring + Evaluation ────────────────────────────────────────────────
    console.log('— Interview Scoring + Evaluation —');
    const sc1 = await recordScore(pool, { interviewId: IV_A1, panelist: 'p1', criterion: 'technical', score: 4, maxScore: 5, actor: EMPLOYER_EMAIL });
    check('record score p1 technical 4/5 ok', sc1.ok && D(sc1).score === 4 && D(sc1).max_score === 5);
    const scOob = await recordScore(pool, { interviewId: IV_A1, panelist: 'p1', criterion: 'technical', score: 6, maxScore: 5 });
    check('out-of-range score -> invalid_input', !scOob.ok && (scOob as any).code === 'invalid_input');
    const scUp = await recordScore(pool, { interviewId: IV_A1, panelist: 'p1', criterion: 'technical', score: 4, maxScore: 5, actor: EMPLOYER_EMAIL });
    check('score upsert (same criterion) ok', scUp.ok && D(scUp).score === 4);
    await recordScore(pool, { interviewId: IV_A1, panelist: 'p2', criterion: 'technical', score: 5, maxScore: 5, actor: EMPLOYER_EMAIL });
    await recordScore(pool, { interviewId: IV_A1, panelist: 'p1', criterion: 'communication', score: 3, maxScore: 5, actor: EMPLOYER_EMAIL });
    const scGhost = await recordScore(pool, { interviewId: '99999999', panelist: 'p1', criterion: 'technical', score: 4 });
    check('score on missing interview -> not_found', !scGhost.ok && (scGhost as any).code === 'not_found');
    const scList = await getScores(pool, IV_A1);
    check('scores list = 3 (technical x2 + communication x1, upsert)', scList.ok && D(scList).count === 3);

    const evalA1 = await evaluationSummary(pool, IV_A1);
    // technical: (80+100)/2 = 90 ; communication: 60 ; overall: (80+100+60)/3 = 80
    check('eval technical mean 90 (2 scores)', evalA1.ok && D(evalA1).criteria.find((c: any) => c.criterion === 'technical')!.mean_pct === 90);
    check('eval communication mean 60 (1 score)', evalA1.ok && D(evalA1).criteria.find((c: any) => c.criterion === 'communication')!.mean_pct === 60);
    check('eval overall_mean_pct 80, distinct_panelists 2', evalA1.ok && D(evalA1).overall_mean_pct === 80 && D(evalA1).distinct_panelists === 2);
    check('eval provenance operator_recorded (NOT a verdict)', evalA1.ok && D(evalA1).provenance === 'operator_recorded');

    // candidate eval across interviews: add a score on IV_A2, then aggregate.
    await recordScore(pool, { interviewId: IV_A2, panelist: 'p1', criterion: 'technical', score: 4, maxScore: 5, actor: EMPLOYER_EMAIL });
    const candEval = await candidateEvaluation(pool, JOB_ID, CAND_A);
    // technical: 80,100,80 -> 86.7 ; communication 60 ; overall (80+100+60+80)/4 = 80
    check('candidate eval spans 2 interviews', candEval.ok && D(candEval).interviews_scored === 2);
    check('candidate eval technical mean 86.7', candEval.ok && D(candEval).criteria.find((c: any) => c.criterion === 'technical')!.mean_pct === 86.7);
    check('candidate eval overall_mean_pct 80', candEval.ok && D(candEval).overall_mean_pct === 80);

    // ── reads ──────────────────────────────────────────────────────────────────
    console.log('— Reads —');
    const getA1 = await getInterview(pool, IV_A1);
    check('get interview A1 -> completed', getA1.ok && D(getA1).status === 'completed');
    const listAll = await listInterviews(pool, JOB_ID);
    check('list interviews = 4 (A1,A2,B1,D)', listAll.ok && D(listAll).count === 4);
    const listSched = await listInterviews(pool, JOB_ID, { status: 'scheduled' });
    check('list filtered status=scheduled = 2 (A2,B1)', listSched.ok && D(listSched).count === 2);
    const listCandA = await listInterviews(pool, JOB_ID, { candidateId: CAND_A });
    check('list filtered candidateId=A = 2 (A1,A2)', listCandA.ok && D(listCandA).count === 2);

    // ── 6. Summary ─────────────────────────────────────────────────────────────
    console.log('— Summary —');
    const sum = await interviewSummary(pool, JOB_ID);
    check('summary total_interviews 4', sum.ok && D(sum).total_interviews === 4);
    check('summary by_status completed 2, scheduled 2', sum.ok && D(sum).by_status.completed === 2 && D(sum).by_status.scheduled === 2);
    check('summary candidates_interviewed 2, total_candidates 2, coverage 100', sum.ok && D(sum).candidates_interviewed === 2 && D(sum).total_candidates === 2 && D(sum).coverage_pct === 100);
    check('summary by_decision advance 1, hire 1', sum.ok && D(sum).by_decision.advance === 1 && D(sum).by_decision.hire === 1);
    check('summary provenance operator_recorded', sum.ok && D(sum).provenance === 'operator_recorded');
    // Honesty axis: a job with ZERO candidates has an empty denominator -> coverage null, NOT 0.
    const sumEmpty = await interviewSummary(pool, EMPTY_JOB_ID);
    check('empty-pool coverage_pct is null (unmeasured, NOT 0)', sumEmpty.ok && D(sumEmpty).total_candidates === 0 && D(sumEmpty).coverage_pct === null);

    // ── GET-never-writes AFTER writes ──────────────────────────────────────────
    const relMid = await relCount();
    await listInterviews(pool, JOB_ID);
    await interviewSummary(pool, JOB_ID);
    await panelReview(pool, IV_A1);
    await evaluationSummary(pool, IV_A1);
    await candidateEvaluation(pool, JOB_ID, CAND_A);
    check('reads after writes STILL create ZERO relations', (await relCount()) === relMid);

    // ── 7. HTTP flag gate (server flag OFF) ────────────────────────────────────
    console.log('— HTTP flag gate (server flag OFF) —');
    const httpBase = process.env.SMOKE_BASE_URL ?? 'http://localhost:8080';
    try {
      const r1 = await fetch(`${httpBase}/api/interview-intelligence/_meta/status`);
      check('HTTP /_meta/status flag-gated 503', r1.status === 503, `got ${r1.status}`);
      const r2 = await fetch(`${httpBase}/api/interview-intelligence/job/${encodeURIComponent(JOB_ID)}/summary`);
      check('HTTP /job/:id/summary flag-gated 503', r2.status === 503, `got ${r2.status}`);
      const r3 = await fetch(`${httpBase}/api/interview-intelligence/interview/1`);
      check('HTTP /interview/:id flag-gated 503', r3.status === 503, `got ${r3.status}`);
    } catch (e: any) {
      check('HTTP reachable', false, e?.message ?? 'fetch failed');
    }

    // Completeness guard.
    const EXPECTED_CHECKS = 70;
    check(`all ${EXPECTED_CHECKS} checks executed (no section skipped by exception)`, passed + failed === EXPECTED_CHECKS, `ran ${passed + failed}`);
  } catch (e: any) {
    failed++;
    console.log(`  FAIL smoke threw before completion — ${e?.message ?? e}`);
  } finally {
    await pool.query(`DELETE FROM interview_scores    WHERE job_id IN ($1,$2)`, [JOB_ID, OTHER_JOB_ID]).catch(() => {});
    await pool.query(`DELETE FROM interview_feedback   WHERE job_id IN ($1,$2)`, [JOB_ID, OTHER_JOB_ID]).catch(() => {});
    await pool.query(`DELETE FROM interview_decisions  WHERE job_id IN ($1,$2)`, [JOB_ID, OTHER_JOB_ID]).catch(() => {});
    await pool.query(`DELETE FROM interview_schedules  WHERE job_id IN ($1,$2)`, [JOB_ID, OTHER_JOB_ID]).catch(() => {});
    await pool.query(`DELETE FROM employer_candidates  WHERE id = ANY($1)`, [[CAND_A, CAND_B, CAND_X, CAND_U]]).catch(() => {});
    await pool.query(`DELETE FROM employer_jobs        WHERE id IN ($1,$2,$3)`, [JOB_ID, OTHER_JOB_ID, EMPTY_JOB_ID]).catch(() => {});
    await pool.query(`DELETE FROM users                WHERE id = $1`, [EMPLOYER]).catch(() => {});
    console.log('  cleanup: removed demo scores/feedback/decisions/schedules/candidates/jobs/users rows');
    await pool.end();
    console.log(`\nResult: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

run();
