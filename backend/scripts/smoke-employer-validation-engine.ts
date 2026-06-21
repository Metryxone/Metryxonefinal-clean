/**
 * PHASE 5.15 smoke — Super Admin Validation engine.
 *
 * Proves the honesty/invariant harness end-to-end against SELF-SEEDED data:
 *   - GOOD employer (clean rows) → 14 areas present, NO FAILs, honest measurable flags.
 *   - BAD employer (injected violations) → specific FAIL checks fire
 *     (out-of-bounds match_score, score > max_score, orphan workflow transition).
 *   - Notifications compose: nothing dispatched (delivered=false) + no candidate PII.
 *   - Determinism: two calls on identical DB state are byte-identical (sans generated_at).
 *   - GET-never-writes: pg_class table count + per-table row counts unchanged across a run.
 *   - flag-OFF: the HTTP routes 503 before any DB touch.
 * All seed rows are @example.com / smoke-prefixed and removed on exit (even on failure).
 *
 * Run: cd backend && npx tsx scripts/smoke-employer-validation-engine.ts
 */

import { Pool } from 'pg';
import {
  runSuperAdminEmployerValidation,
  type EmployerValidationResult,
  type ValidationArea,
} from '../services/super-admin-employer-validation-engine.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const GOOD = 'smoke515-good-org';
const BAD = 'smoke515-bad-org';
const TAG = 'smoke515';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    failures += 1;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

function areaOf(r: EmployerValidationResult, id: string): ValidationArea | undefined {
  return r.areas.find((a) => a.id === id);
}
function checkStatus(a: ValidationArea | undefined, checkId: string): string | undefined {
  return a?.checks.find((c) => c.id === checkId)?.status;
}

async function exists(table: string): Promise<boolean> {
  const r = await pool.query('SELECT to_regclass($1) AS reg', [table]);
  return !!r.rows[0]?.reg;
}

async function cleanup() {
  // Order: children before parents; ignore tables absent in this environment.
  const stmts: Array<[string, string, any[]]> = [
    ['workflow_transitions', 'DELETE FROM workflow_transitions WHERE employer_id = ANY($1)', [[GOOD, BAD]]],
    ['candidate_pipeline', 'DELETE FROM candidate_pipeline WHERE employer_id = ANY($1)', [[GOOD, BAD]]],
    ['interview_scores', 'DELETE FROM interview_scores WHERE employer_id = ANY($1)', [[GOOD, BAD]]],
    ['interview_decisions', 'DELETE FROM interview_decisions WHERE employer_id = ANY($1)', [[GOOD, BAD]]],
    ['interview_schedules', 'DELETE FROM interview_schedules WHERE employer_id = ANY($1)', [[GOOD, BAD]]],
    ['employer_offers', 'DELETE FROM employer_offers WHERE employer_id = ANY($1)', [[GOOD, BAD]]],
    ['employer_candidates', 'DELETE FROM employer_candidates WHERE employer_id = ANY($1)', [[GOOD, BAD]]],
    ['employer_jobs', 'DELETE FROM employer_jobs WHERE employer_id = ANY($1)', [[GOOD, BAD]]],
    ['employer_company_profiles', 'DELETE FROM employer_company_profiles WHERE employer_id = ANY($1)', [[GOOD, BAD]]],
    ['employer_audit_logs', "DELETE FROM employer_audit_logs WHERE org_id = ANY($1) OR id LIKE $2", [[GOOD, BAD], `${TAG}%`]],
    ['employer_organizations', 'DELETE FROM employer_organizations WHERE id = ANY($1)', [[GOOD, BAD]]],
  ];
  for (const [table, sql, params] of stmts) {
    if (await exists(table)) {
      try { await pool.query(sql, params); } catch (e: any) { console.error(`cleanup ${table}: ${e.message}`); }
    }
  }
}

async function seedGood() {
  await pool.query(
    `INSERT INTO employer_organizations (id, name, owner_id, plan, approval_threshold, max_sessions, verified, created_at)
     VALUES ($1,$2,$3,'pro',70,100,true,now()) ON CONFLICT (id) DO NOTHING`,
    [GOOD, 'Smoke Good Co (example.com)', `${TAG}-owner@example.com`],
  );
  await pool.query(
    `INSERT INTO employer_company_profiles (id, employer_id, name, verified, created_at)
     VALUES ($1,$2,'Smoke Good Co',true,now()) ON CONFLICT (id) DO NOTHING`,
    [`${TAG}-cp-good`, GOOD],
  );
  await pool.query(
    `INSERT INTO employer_jobs (id, employer_id, title, status, salary_min, salary_max, application_count, quota, created_at)
     VALUES ($1,$2,'Engineer','published',1000,2000,3,5,now()) ON CONFLICT (id) DO NOTHING`,
    [`${TAG}-job-good`, GOOD],
  );
  await pool.query(
    `INSERT INTO employer_candidates (id, employer_id, job_id, name, email, match_score, ei_score, assessment_score, assessment_sent, stage, created_at)
     VALUES ($1,$2,$3,'Pat Candidate','pat.smoke515@example.com',82,75,68,true,'Interview',now()) ON CONFLICT (id) DO NOTHING`,
    [`${TAG}-cand-good`, GOOD, `${TAG}-job-good`],
  );
  // pipeline + a RESOLVING transition
  const pipe = await pool.query(
    `INSERT INTO candidate_pipeline (employer_id, job_id, candidate_id, status, stage_order, created_at, updated_at)
     VALUES ($1,$2,$3,'interview',3,now(),now()) RETURNING id`,
    [GOOD, `${TAG}-job-good`, `${TAG}-cand-good`],
  );
  const pipeId = pipe.rows[0].id;
  await pool.query(
    `INSERT INTO workflow_transitions (pipeline_id, employer_id, job_id, candidate_id, from_status, to_status, actor, created_at)
     VALUES ($1,$2,$3,$4,'shortlist','interview','smoke',now())`,
    [pipeId, GOOD, `${TAG}-job-good`, `${TAG}-cand-good`],
  );
  // interview schedule + valid score
  const iv = await pool.query(
    `INSERT INTO interview_schedules (employer_id, job_id, candidate_id, round_name, round_seq, mode, status, duration_mins, panelists, created_at, updated_at)
     VALUES ($1,$2,$3,'R1',1,'remote','scheduled',60,'[]'::jsonb,now(),now()) RETURNING id`,
    [GOOD, `${TAG}-job-good`, `${TAG}-cand-good`],
  );
  await pool.query(
    `INSERT INTO interview_scores (interview_id, employer_id, job_id, candidate_id, panelist, criterion, score, max_score, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'panelist','overall',7,10,now(),now())`,
    [iv.rows[0].id, GOOD, `${TAG}-job-good`, `${TAG}-cand-good`],
  );
  await pool.query(
    `INSERT INTO interview_decisions (employer_id, job_id, candidate_id, interview_id, decision, created_at)
     VALUES ($1,$2,$3,$4,'hire',now())`,
    [GOOD, `${TAG}-job-good`, `${TAG}-cand-good`, iv.rows[0].id],
  );
  await pool.query(
    `INSERT INTO employer_offers (id, employer_id, candidate_id, job_id, ctc_fixed, ctc_variable, ctc_bonus, total_ctc, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,1000,200,100,1300,'sent',now(),now()) ON CONFLICT (id) DO NOTHING`,
    [`${TAG}-offer-good`, GOOD, `${TAG}-cand-good`, `${TAG}-job-good`],
  );
  if (await exists('employer_audit_logs')) {
    await pool.query(
      `INSERT INTO employer_audit_logs (id, org_id, user_id, action, resource_type, status, risk_score, created_at)
       VALUES ($1,$2,$3,'view','job','ok',10,now()) ON CONFLICT (id) DO NOTHING`,
      [`${TAG}-audit-good`, GOOD, `${TAG}-owner@example.com`],
    );
  }
}

async function seedBad() {
  await pool.query(
    `INSERT INTO employer_organizations (id, name, owner_id, plan, verified, created_at)
     VALUES ($1,$2,$3,'pro',false,now()) ON CONFLICT (id) DO NOTHING`,
    [BAD, 'Smoke Bad Co (example.com)', `${TAG}-badowner@example.com`],
  );
  // out-of-bounds match_score (150) → matching FAIL
  await pool.query(
    `INSERT INTO employer_candidates (id, employer_id, name, email, match_score, ei_score, created_at)
     VALUES ($1,$2,'Bad Cand','bad.smoke515@example.com',150,75,now()) ON CONFLICT (id) DO NOTHING`,
    [`${TAG}-cand-bad`, BAD],
  );
  // pipeline + ORPHAN transition (pipeline_id pointing nowhere) → shortlisting FAIL
  await pool.query(
    `INSERT INTO candidate_pipeline (employer_id, job_id, candidate_id, status, stage_order, created_at, updated_at)
     VALUES ($1,'j','c','review',1,now(),now())`,
    [BAD],
  );
  await pool.query(
    `INSERT INTO workflow_transitions (pipeline_id, employer_id, job_id, candidate_id, from_status, to_status, actor, created_at)
     VALUES (-999999,$1,'j','c','review','shortlist','smoke',now())`,
    [BAD],
  );
  // interview score exceeding max_score → interviewing FAIL
  const iv = await pool.query(
    `INSERT INTO interview_schedules (employer_id, job_id, candidate_id, round_name, round_seq, mode, status, panelists, created_at, updated_at)
     VALUES ($1,'j','c','R1',1,'remote','scheduled','[]'::jsonb,now(),now()) RETURNING id`,
    [BAD],
  );
  await pool.query(
    `INSERT INTO interview_scores (interview_id, employer_id, job_id, candidate_id, panelist, criterion, score, max_score, created_at, updated_at)
     VALUES ($1,$2,'j','c','p','overall',99,10,now(),now())`,
    [iv.rows[0].id, BAD],
  );
}

function stripVolatile(r: EmployerValidationResult): string {
  const clone = JSON.parse(JSON.stringify(r));
  delete clone.generated_at;
  return JSON.stringify(clone);
}

async function snapshotDb() {
  const tables = await pool.query<{ relname: string }>(
    "SELECT relname FROM pg_class WHERE relkind='r' AND relnamespace = 'public'::regnamespace ORDER BY relname",
  );
  const names = tables.rows.map((t) => t.relname);
  const counts: Record<string, number> = {};
  for (const t of names) {
    const c = await pool.query(`SELECT COUNT(*)::int n FROM "${t}"`);
    counts[t] = Number(c.rows[0].n);
  }
  return { tableCount: names.length, counts };
}

async function main() {
  console.log('PHASE 5.15 smoke — Super Admin Validation engine\n');
  await cleanup();
  await seedGood();
  await seedBad();

  // ── GOOD employer ──────────────────────────────────────────────────────────
  console.log('GOOD employer:');
  const good = await runSuperAdminEmployerValidation(pool, GOOD);
  assert(good.areas.length === 14, `14 areas present (got ${good.areas.length})`);
  assert(good.summary.areas_total === 14, 'summary.areas_total === 14');
  const goodFails = good.areas.filter((a) => a.status === 'fail');
  assert(goodFails.length === 0, `GOOD has NO failing areas (got ${goodFails.map((a) => a.id).join(',') || 'none'})`);
  assert(areaOf(good, 'employer_setup')?.measurable === true, 'employer_setup measurable for GOOD');
  assert(areaOf(good, 'job_posting')?.measurable === true, 'job_posting measurable for GOOD');
  assert(areaOf(good, 'matching')?.measurable === true, 'matching measurable for GOOD');
  assert(checkStatus(areaOf(good, 'matching'), 'match_score_bounds') === 'pass', 'GOOD match_score in bounds');
  assert(checkStatus(areaOf(good, 'interviewing'), 'scores_within_max') === 'pass', 'GOOD interview score within max');
  assert(checkStatus(areaOf(good, 'shortlisting'), 'transitions_resolve') === 'pass', 'GOOD transitions resolve');

  // Notifications: nothing dispatched + no PII (composed 5.14 engine).
  assert(checkStatus(areaOf(good, 'notifications'), 'never_sends') === 'pass', 'GOOD notifications never dispatched');
  assert(checkStatus(areaOf(good, 'notifications'), 'no_candidate_pii') === 'pass', 'GOOD notifications carry no candidate PII');

  // ── BAD employer ───────────────────────────────────────────────────────────
  console.log('\nBAD employer (injected violations):');
  const bad = await runSuperAdminEmployerValidation(pool, BAD);
  assert(bad.areas.length === 14, '14 areas present for BAD');
  assert(checkStatus(areaOf(bad, 'matching'), 'match_score_bounds') === 'fail', 'BAD out-of-bounds match_score → FAIL');
  assert(areaOf(bad, 'matching')?.status === 'fail', 'BAD matching area status === fail');
  assert(checkStatus(areaOf(bad, 'shortlisting'), 'transitions_resolve') === 'fail', 'BAD orphan transition → FAIL');
  assert(checkStatus(areaOf(bad, 'interviewing'), 'scores_within_max') === 'fail', 'BAD score>max → FAIL');
  assert(bad.summary.fail >= 3, `BAD summary.fail ≥ 3 (got ${bad.summary.fail})`);
  assert(bad.ok === true, 'orchestrator never throws (ok=true even with FAILs)');

  // ── Honest absence: a non-existent subject is all WARN, no FAIL ─────────────
  console.log('\nUNKNOWN subject (honest absence):');
  const unknown = await runSuperAdminEmployerValidation(pool, 'smoke515-does-not-exist');
  assert(unknown.areas.length === 14, '14 areas present for unknown subject');
  const subjectAreas = unknown.areas.filter((a) => a.scope === 'subject');
  assert(subjectAreas.every((a) => a.measurable === false), 'all subject areas not measurable for unknown subject');
  assert(unknown.summary.fail === 0, 'unknown subject yields ZERO data-integrity FAILs (honest absence, not failure)');

  // ── Determinism ────────────────────────────────────────────────────────────
  console.log('\nDeterminism:');
  const a = await runSuperAdminEmployerValidation(pool, GOOD);
  const b = await runSuperAdminEmployerValidation(pool, GOOD);
  assert(stripVolatile(a) === stripVolatile(b), 'two GOOD runs are byte-identical (sans generated_at)');

  // ── GET-never-writes ───────────────────────────────────────────────────────
  console.log('\nGET-never-writes:');
  const before = await snapshotDb();
  await runSuperAdminEmployerValidation(pool, GOOD);
  await runSuperAdminEmployerValidation(pool, BAD);
  await runSuperAdminEmployerValidation(pool, 'smoke515-does-not-exist');
  const after = await snapshotDb();
  assert(before.tableCount === after.tableCount, `no tables created (before=${before.tableCount}, after=${after.tableCount})`);
  const changed = Object.keys(after.counts).filter((t) => after.counts[t] !== before.counts[t]);
  assert(changed.length === 0, `no row counts changed (changed: ${changed.join(',') || 'none'})`);

  // ── flag-OFF HTTP 503 ──────────────────────────────────────────────────────
  console.log('\nflag-OFF HTTP:');
  try {
    const res = await fetch('http://localhost:8080/api/employer-validation/_meta/status');
    const body = await res.json().catch(() => ({}));
    assert(res.status === 503 && body?.error === 'feature_disabled', `flag-OFF route 503 feature_disabled (got ${res.status})`);
  } catch (e: any) {
    console.log(`  (skipped HTTP check — server not reachable: ${e.message})`);
  }

  console.log(`\n${failures === 0 ? 'ALL SMOKE CHECKS PASSED' : `${failures} SMOKE CHECK(S) FAILED`}`);
}

main()
  .catch((e) => { console.error('SMOKE ERROR:', e); failures += 1; })
  .finally(async () => {
    await cleanup();
    await pool.end();
    process.exit(failures === 0 ? 0 : 1);
  });
