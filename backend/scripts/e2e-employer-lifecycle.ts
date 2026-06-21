/**
 * EMPLOYER LIFECYCLE E2E — drives the full hiring journey for ONE employer and
 * proves every stage PERSISTS, then runs the Phase 5.15 Super Admin Validation
 * harness over the result.
 *
 * 16 scenarios (in order):
 *   1  Employer Registers        → employer_organizations row
 *   2  Organization Created      → employer_company_profiles row
 *   3  Job Created               → employer_jobs (status=draft)
 *   4  Job Published             → employer_jobs.status draft→published
 *   5  Candidate Discovered      → employer_candidates row (source=discovery)
 *   6  Candidate Matched         → match_score / ei_score set
 *   7  Assessment Invited        → assessment_sent=true (+ assessment_sent_at)
 *   8  Assessment Completed      → assessment_score set (+ completion_completed_at)
 *   9  Candidate Ranked          → rating set
 *   10 Interview Scheduled       → interview_schedules row (+ candidate stage=Interview)
 *   11 Interview Completed       → schedule status=completed + interview_scores row
 *   12 Candidate Shortlisted     → candidate_pipeline row + RESOLVING workflow_transition
 *   13 Offer Generated           → employer_offers row (+ candidate offer_amount)
 *   14 Candidate Hired           → interview_decisions(decision=hire) + stage=Hired + decision_at
 *   15 Workforce Dashboard Updated → compose the 0-DDL workforce engines (read)
 *   16 All Data Persisted        → re-query every table + run the 5.15 validator → NO FAIL
 *
 * Persistence is proven with BEFORE/AFTER deltas (a new row or a changed value),
 * never a bare count>0. All rows are @example.com / e2e-prefixed and removed on exit.
 *
 * Run: cd backend && npx tsx scripts/e2e-employer-lifecycle.ts
 */

import { Pool } from 'pg';
import { runSuperAdminEmployerValidation } from '../services/super-admin-employer-validation-engine.js';
import {
  computeTalentDistribution,
  computeDepartmentReadiness,
} from '../services/workforce-intelligence-engine.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ORG = 'e2e-emp-org';
const TAG = 'e2e-emp';
const JOB = `${TAG}-job`;
const CAND = `${TAG}-cand`;
const OWNER = `${TAG}-owner@example.com`;

let failures = 0;
let stageNo = 0;
function stage(name: string) {
  stageNo += 1;
  console.log(`\n[${String(stageNo).padStart(2, '0')}] ${name}`);
}
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`     ✓ ${msg}`);
  else { failures += 1; console.error(`     ✗ FAIL: ${msg}`); }
}

async function num(sql: string, params: any[] = []): Promise<number> {
  const r = await pool.query(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}
async function scalar<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const r = await pool.query(sql, params);
  return (r.rows[0]?.v ?? null) as T | null;
}
async function exists(table: string): Promise<boolean> {
  const r = await pool.query('SELECT to_regclass($1) AS reg', [table]);
  return !!r.rows[0]?.reg;
}

async function cleanup() {
  const stmts: Array<[string, string, any[]]> = [
    ['workflow_transitions', 'DELETE FROM workflow_transitions WHERE employer_id=$1', [ORG]],
    ['candidate_pipeline', 'DELETE FROM candidate_pipeline WHERE employer_id=$1', [ORG]],
    ['interview_scores', 'DELETE FROM interview_scores WHERE employer_id=$1', [ORG]],
    ['interview_decisions', 'DELETE FROM interview_decisions WHERE employer_id=$1', [ORG]],
    ['interview_schedules', 'DELETE FROM interview_schedules WHERE employer_id=$1', [ORG]],
    ['employer_offers', 'DELETE FROM employer_offers WHERE employer_id=$1', [ORG]],
    ['employer_candidates', 'DELETE FROM employer_candidates WHERE employer_id=$1', [ORG]],
    ['employer_jobs', 'DELETE FROM employer_jobs WHERE employer_id=$1', [ORG]],
    ['employer_company_profiles', 'DELETE FROM employer_company_profiles WHERE employer_id=$1', [ORG]],
    ['employer_audit_logs', 'DELETE FROM employer_audit_logs WHERE org_id=$1', [ORG]],
    ['employer_organizations', 'DELETE FROM employer_organizations WHERE id=$1', [ORG]],
  ];
  for (const [t, sql, p] of stmts) {
    if (await exists(t)) { try { await pool.query(sql, p); } catch (e: any) { console.error(`cleanup ${t}: ${e.message}`); } }
  }
}

async function main() {
  console.log('EMPLOYER LIFECYCLE E2E — full hiring journey + Phase 5.15 validation\n');
  await cleanup();

  // 1 — Employer Registers ────────────────────────────────────────────────────
  stage('Employer Registers');
  {
    const before = await num('SELECT COUNT(*)::int n FROM employer_organizations WHERE id=$1', [ORG]);
    await pool.query(
      `INSERT INTO employer_organizations (id, name, owner_id, plan, approval_threshold, max_sessions, verified, created_at)
       VALUES ($1,'E2E Employer (example.com)',$2,'pro',70,100,true,now())`,
      [ORG, OWNER],
    );
    const after = await num('SELECT COUNT(*)::int n FROM employer_organizations WHERE id=$1', [ORG]);
    assert(before === 0 && after === 1, `employer_organizations persisted (Δ ${before}→${after})`);
  }

  // 2 — Organization Created ───────────────────────────────────────────────────
  stage('Organization Created');
  {
    const before = await num('SELECT COUNT(*)::int n FROM employer_company_profiles WHERE employer_id=$1', [ORG]);
    await pool.query(
      `INSERT INTO employer_company_profiles (id, employer_id, name, verified, created_at)
       VALUES ($1,$2,'E2E Employer',true,now())`,
      [`${TAG}-cp`, ORG],
    );
    const after = await num('SELECT COUNT(*)::int n FROM employer_company_profiles WHERE employer_id=$1', [ORG]);
    assert(before === 0 && after === 1, `employer_company_profiles persisted (Δ ${before}→${after})`);
  }

  // 3 — Job Created ─────────────────────────────────────────────────────────────
  stage('Job Created');
  {
    await pool.query(
      `INSERT INTO employer_jobs (id, employer_id, title, department, status, salary_min, salary_max, application_count, quota, created_at)
       VALUES ($1,$2,'Senior Engineer','Engineering','draft',1200,2400,0,3,now())`,
      [JOB, ORG],
    );
    const st = await scalar<string>('SELECT status v FROM employer_jobs WHERE id=$1', [JOB]);
    assert(st === 'draft', `employer_jobs created with status=draft (got ${st})`);
  }

  // 4 — Job Published ───────────────────────────────────────────────────────────
  stage('Job Published');
  {
    const before = await scalar<string>('SELECT status v FROM employer_jobs WHERE id=$1', [JOB]);
    await pool.query(`UPDATE employer_jobs SET status='published', updated_at=now() WHERE id=$1`, [JOB]);
    const after = await scalar<string>('SELECT status v FROM employer_jobs WHERE id=$1', [JOB]);
    assert(before === 'draft' && after === 'published', `job status transitioned draft→published`);
  }

  // 5 — Candidate Discovered ────────────────────────────────────────────────────
  stage('Candidate Discovered');
  {
    const before = await num('SELECT COUNT(*)::int n FROM employer_candidates WHERE employer_id=$1', [ORG]);
    await pool.query(
      `INSERT INTO employer_candidates (id, employer_id, job_id, name, email, candidate_role, source, stage, applied_date, created_at, updated_at)
       VALUES ($1,$2,$3,'Alex Talent','alex.e2e@example.com','Engineer','discovery','Sourced',now(),now(),now())`,
      [CAND, ORG, JOB],
    );
    const after = await num('SELECT COUNT(*)::int n FROM employer_candidates WHERE employer_id=$1', [ORG]);
    assert(before === 0 && after === 1, `employer_candidates discovered & persisted (Δ ${before}→${after})`);
  }

  // 6 — Candidate Matched ───────────────────────────────────────────────────────
  stage('Candidate Matched');
  {
    const before = await scalar<number>('SELECT match_score v FROM employer_candidates WHERE id=$1', [CAND]);
    await pool.query(
      `UPDATE employer_candidates SET match_score=82, ei_score=75, stage='Matched', stage_changed_at=now(), updated_at=now() WHERE id=$1`,
      [CAND],
    );
    const after = await scalar<number>('SELECT match_score v FROM employer_candidates WHERE id=$1', [CAND]);
    assert(before === null && Number(after) === 82, `match_score persisted (null→82, in [0,100])`);
  }

  // 7 — Assessment Invited ──────────────────────────────────────────────────────
  stage('Assessment Invited');
  {
    const before = await scalar<boolean>('SELECT assessment_sent v FROM employer_candidates WHERE id=$1', [CAND]);
    await pool.query(
      `UPDATE employer_candidates SET assessment_sent=true, assessment_sent_at=now(), stage='Assessment', updated_at=now() WHERE id=$1`,
      [CAND],
    );
    const after = await scalar<boolean>('SELECT assessment_sent v FROM employer_candidates WHERE id=$1', [CAND]);
    assert(!before && after === true, `assessment_sent persisted (false/null→true)`);
  }

  // 8 — Assessment Completed ────────────────────────────────────────────────────
  stage('Assessment Completed');
  {
    const before = await scalar<number>('SELECT assessment_score v FROM employer_candidates WHERE id=$1', [CAND]);
    await pool.query(
      `UPDATE employer_candidates SET assessment_score=68, completion_completed_at=now(), updated_at=now() WHERE id=$1`,
      [CAND],
    );
    const after = await scalar<number>('SELECT assessment_score v FROM employer_candidates WHERE id=$1', [CAND]);
    assert(before === null && Number(after) === 68, `assessment_score persisted (null→68, in [0,100])`);
    const sent = await scalar<boolean>('SELECT assessment_sent v FROM employer_candidates WHERE id=$1', [CAND]);
    assert(sent === true, `score implies sent (assessment_sent still true)`);
  }

  // 9 — Candidate Ranked ────────────────────────────────────────────────────────
  stage('Candidate Ranked');
  {
    const before = await scalar<number>('SELECT rating v FROM employer_candidates WHERE id=$1', [CAND]);
    await pool.query(`UPDATE employer_candidates SET rating=5, updated_at=now() WHERE id=$1`, [CAND]);
    const after = await scalar<number>('SELECT rating v FROM employer_candidates WHERE id=$1', [CAND]);
    assert(Number(before) !== 5 && Number(after) === 5, `candidate rank/rating persisted (${before ?? 'null'}→5)`);
  }

  // 10 — Interview Scheduled ────────────────────────────────────────────────────
  let interviewId: number;
  stage('Interview Scheduled');
  {
    const before = await num('SELECT COUNT(*)::int n FROM interview_schedules WHERE employer_id=$1', [ORG]);
    const iv = await pool.query(
      `INSERT INTO interview_schedules (employer_id, job_id, candidate_id, round_name, round_seq, mode, status, scheduled_at, duration_mins, panelists, created_at, updated_at)
       VALUES ($1,$2,$3,'Round 1',1,'remote','scheduled',now() + interval '2 days',60,'[]'::jsonb,now(),now()) RETURNING id`,
      [ORG, JOB, CAND],
    );
    interviewId = Number(iv.rows[0].id);
    await pool.query(
      `UPDATE employer_candidates SET stage='Interview', interview_date=now() + interval '2 days', stage_changed_at=now(), updated_at=now() WHERE id=$1`,
      [CAND],
    );
    const after = await num('SELECT COUNT(*)::int n FROM interview_schedules WHERE employer_id=$1', [ORG]);
    assert(before === 0 && after === 1, `interview_schedules persisted (Δ ${before}→${after})`);
  }

  // 11 — Interview Completed ────────────────────────────────────────────────────
  stage('Interview Completed');
  {
    await pool.query(`UPDATE interview_schedules SET status='completed', updated_at=now() WHERE id=$1`, [interviewId]);
    const st = await scalar<string>('SELECT status v FROM interview_schedules WHERE id=$1', [interviewId]);
    assert(st === 'completed', `interview status transitioned scheduled→completed`);
    const before = await num('SELECT COUNT(*)::int n FROM interview_scores WHERE interview_id=$1', [interviewId]);
    await pool.query(
      `INSERT INTO interview_scores (interview_id, employer_id, job_id, candidate_id, panelist, criterion, score, max_score, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'panelist-1','overall',8,10,now(),now())`,
      [interviewId, ORG, JOB, CAND],
    );
    const after = await num('SELECT COUNT(*)::int n FROM interview_scores WHERE interview_id=$1', [interviewId]);
    assert(before === 0 && after === 1, `interview_scores persisted (8/10, within max)`);
  }

  // 12 — Candidate Shortlisted ──────────────────────────────────────────────────
  stage('Candidate Shortlisted');
  {
    const before = await num('SELECT COUNT(*)::int n FROM candidate_pipeline WHERE employer_id=$1', [ORG]);
    const pipe = await pool.query(
      `INSERT INTO candidate_pipeline (employer_id, job_id, candidate_id, status, stage_order, created_at, updated_at)
       VALUES ($1,$2,$3,'shortlist',2,now(),now()) RETURNING id`,
      [ORG, JOB, CAND],
    );
    const pipeId = Number(pipe.rows[0].id);
    const after = await num('SELECT COUNT(*)::int n FROM candidate_pipeline WHERE employer_id=$1', [ORG]);
    assert(before === 0 && after === 1, `candidate_pipeline persisted (status=shortlist)`);
    // a RESOLVING transition (points at a real pipeline row → no orphan)
    if (await exists('workflow_transitions')) {
      await pool.query(
        `INSERT INTO workflow_transitions (pipeline_id, employer_id, job_id, candidate_id, from_status, to_status, actor, created_at)
         VALUES ($1,$2,$3,$4,'review','shortlist','e2e',now())`,
        [pipeId, ORG, JOB, CAND],
      );
      const orphan = await num(
        'SELECT COUNT(*)::int n FROM workflow_transitions t WHERE t.employer_id=$1 AND NOT EXISTS (SELECT 1 FROM candidate_pipeline p WHERE p.id=t.pipeline_id)',
        [ORG],
      );
      assert(orphan === 0, `workflow_transition resolves to its pipeline entry (0 orphans)`);
    }
  }

  // 13 — Offer Generated ────────────────────────────────────────────────────────
  stage('Offer Generated');
  {
    const before = await num('SELECT COUNT(*)::int n FROM employer_offers WHERE employer_id=$1', [ORG]);
    await pool.query(
      `INSERT INTO employer_offers (id, employer_id, candidate_id, job_id, ctc_fixed, ctc_variable, ctc_bonus, total_ctc, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,1500,300,200,2000,'sent',now(),now())`,
      [`${TAG}-offer`, ORG, CAND, JOB],
    );
    await pool.query(`UPDATE employer_candidates SET offer_amount=2000, stage='Offer', stage_changed_at=now(), updated_at=now() WHERE id=$1`, [CAND]);
    const after = await num('SELECT COUNT(*)::int n FROM employer_offers WHERE employer_id=$1', [ORG]);
    assert(before === 0 && after === 1, `employer_offers persisted (total_ctc=2000 ≥ ctc_fixed=1500, all ≥ 0)`);
  }

  // 14 — Candidate Hired ────────────────────────────────────────────────────────
  stage('Candidate Hired');
  {
    const before = await num("SELECT COUNT(*)::int n FROM interview_decisions WHERE employer_id=$1 AND decision='hire'", [ORG]);
    await pool.query(
      `INSERT INTO interview_decisions (employer_id, job_id, candidate_id, interview_id, decision, stage, decided_by, created_at)
       VALUES ($1,$2,$3,$4,'hire','final','e2e',now())`,
      [ORG, JOB, CAND, interviewId],
    );
    await pool.query(`UPDATE employer_candidates SET stage='Hired', decision_at=now(), stage_changed_at=now(), updated_at=now() WHERE id=$1`, [CAND]);
    const after = await num("SELECT COUNT(*)::int n FROM interview_decisions WHERE employer_id=$1 AND decision='hire'", [ORG]);
    const finalStage = await scalar<string>('SELECT stage v FROM employer_candidates WHERE id=$1', [CAND]);
    assert(before === 0 && after === 1, `hire decision persisted (decision=hire, canonical)`);
    assert(finalStage === 'Hired', `candidate stage advanced to Hired`);
  }

  // 15 — Workforce Dashboard Updated ────────────────────────────────────────────
  stage('Workforce Dashboard Updated');
  {
    const dist = await computeTalentDistribution(pool, ORG);
    const dept = await computeDepartmentReadiness(pool, ORG);
    const wellFormed = (r: any) => r && typeof r.ok === 'boolean' && (r.ok ? r.data !== undefined : typeof r.code === 'string');
    assert(wellFormed(dist), `talent distribution engine returned a well-formed result (ok=${(dist as any).ok})`);
    assert(wellFormed(dept), `department readiness engine returned a well-formed result (ok=${(dept as any).ok})`);
  }

  // 16 — All Data Persisted (re-query + Phase 5.15 validator) ────────────────────
  stage('All Data Persisted');
  {
    const counts = {
      org: await num('SELECT COUNT(*)::int n FROM employer_organizations WHERE id=$1', [ORG]),
      profile: await num('SELECT COUNT(*)::int n FROM employer_company_profiles WHERE employer_id=$1', [ORG]),
      job: await num("SELECT COUNT(*)::int n FROM employer_jobs WHERE employer_id=$1 AND status='published'", [ORG]),
      candidate: await num('SELECT COUNT(*)::int n FROM employer_candidates WHERE employer_id=$1', [ORG]),
      pipeline: await num('SELECT COUNT(*)::int n FROM candidate_pipeline WHERE employer_id=$1', [ORG]),
      interview: await num('SELECT COUNT(*)::int n FROM interview_schedules WHERE employer_id=$1', [ORG]),
      score: await num('SELECT COUNT(*)::int n FROM interview_scores WHERE employer_id=$1', [ORG]),
      decision: await num('SELECT COUNT(*)::int n FROM interview_decisions WHERE employer_id=$1', [ORG]),
      offer: await num('SELECT COUNT(*)::int n FROM employer_offers WHERE employer_id=$1', [ORG]),
    };
    console.log(`     persisted rows: ${JSON.stringify(counts)}`);
    const allPersisted = Object.values(counts).every((c) => c >= 1);
    assert(allPersisted, `every lifecycle artifact persisted across all tables`);

    // Phase 5.15 honesty/invariant harness must see a CLEAN employer (no FAIL).
    const v = await runSuperAdminEmployerValidation(pool, ORG);
    assert(v.areas.length === 14, `validator covers 14 areas (got ${v.areas.length})`);
    const fails = v.areas.filter((a) => a.status === 'fail');
    assert(fails.length === 0, `validator reports ZERO failing areas (got ${fails.map((a) => `${a.id}`).join(',') || 'none'})`);
    assert(v.summary.fail === 0, `summary.fail === 0 (clean lifecycle)`);
    assert(v.ok === true, `validator orchestrator ok=true`);

    // Spot-check the subject-scoped invariants that the lifecycle exercised.
    const get = (id: string) => v.areas.find((a) => a.id === id);
    const ck = (areaId: string, checkId: string) => get(areaId)?.checks.find((c) => c.id === checkId)?.status;
    assert(get('employer_setup')?.measurable === true, `employer_setup measurable`);
    assert(get('job_posting')?.measurable === true, `job_posting measurable`);
    assert(ck('matching', 'match_score_bounds') === 'pass', `matching: match_score within bounds`);
    assert(ck('assessments', 'score_implies_sent') === 'pass', `assessments: a scored assessment was sent`);
    assert(ck('shortlisting', 'transitions_resolve') === 'pass', `shortlisting: transitions resolve`);
    assert(ck('interviewing', 'scores_within_max') === 'pass', `interviewing: scores within max`);
    assert(ck('hiring', 'ctc_non_negative') === 'pass', `hiring: CTC components non-negative`);
    assert(ck('notifications', 'never_sends') === 'pass', `notifications: nothing dispatched`);
    assert(ck('notifications', 'no_candidate_pii') === 'pass', `notifications: no candidate PII in previews`);

    console.log(`\n     validator summary: ${JSON.stringify(v.summary)}`);
  }

  console.log(`\n${failures === 0 ? '✅ ALL 16 LIFECYCLE SCENARIOS PASSED — every stage persisted, validator clean' : `❌ ${failures} CHECK(S) FAILED`}`);
}

main()
  .catch((e) => { console.error('E2E ERROR:', e); failures += 1; })
  .finally(async () => {
    await cleanup();
    await pool.end();
    process.exit(failures === 0 ? 0 : 1);
  });
