/**
 * Talent Matching — job-title → curated Role-DNA crosswalk integration test.
 *
 * Task #99: a NORMALLY-POSTED job (created through the canonical job-posting flow,
 * which writes `job_postings`) must be matchable against candidates WITHOUT a
 * hardcoded role id. This test creates real jobs via `createJob` (job-posting-
 * engine) and then drives `rankCandidatesForJob` end-to-end, asserting:
 *   • a job whose title resolves crosswalks to a curated role and reports
 *     job_source='job_postings' (proves the canonical substrate is read, not just
 *     the legacy employer_jobs table);
 *   • a job whose title has no defensible curated match ABSTAINS (resolved:false,
 *     zero candidates, role_id:null) — never fabricates;
 *   • a non-existent job id is not_found.
 *
 * Real-DB integration test (uses DATABASE_URL). It creates and then deletes its
 * own job_postings rows; it is skipped when the curated Role-DNA substrate is not
 * present so it never produces a false failure on a bare database.
 *
 * Run with:  cd backend && npx tsx --test tests/talent-matching-job-crosswalk.test.ts
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';

import { createJob } from '../services/job-posting-engine';
import { rankCandidatesForJob } from '../services/talent-matching-engine';
import { getMatchableCuratedRoles } from '../services/role-title-crosswalk';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const createdJobIds: string[] = [];
let actorId: string | null = null;
let beTitle: string | null = null; // a title that resolves to a curated role
let substrateReady = false;

before(async () => {
  // Need a real users.id (createdBy is a valid FK) and at least one curated role
  // carrying an active competency profile to crosswalk against.
  const u = await pool.query(`SELECT id FROM users ORDER BY created_at NULLS LAST LIMIT 1`).catch(() => null);
  actorId = u?.rows?.[0]?.id ?? null;

  const roles = await getMatchableCuratedRoles(pool);
  // Use the exact title of a real curated role so the resolution is deterministic.
  beTitle = roles.length > 0 ? roles[0].title : null;

  substrateReady = Boolean(actorId && beTitle);
});

after(async () => {
  if (createdJobIds.length > 0) {
    // Remove audit rows first (FK), then the job rows.
    await pool
      .query(`DELETE FROM job_approval_logs WHERE job_id = ANY($1::text[])`, [createdJobIds])
      .catch(() => null);
    await pool.query(`DELETE FROM job_postings WHERE id = ANY($1::text[])`, [createdJobIds]).catch(() => null);
  }
  await pool.end();
});

test('a normally-posted job with a resolvable title crosswalks to a curated role', async (t) => {
  if (!substrateReady) {
    t.skip('no users / curated Role-DNA profiles present — cannot run integration test');
    return;
  }

  const created = await createJob(pool, { id: actorId!, role: 'super_admin' } as any, { title: beTitle });
  assert.equal(created.ok, true, 'createJob should succeed');
  const jobId = (created as any).data.id as string;
  createdJobIds.push(jobId);

  const res = await rankCandidatesForJob(pool, jobId);
  assert.equal(res.ok, true);
  const d = (res as any).data;
  assert.equal(d.job_id, jobId);
  assert.equal(d.job_source, 'job_postings', 'must read the canonical posting substrate');
  assert.equal(d.role_title_input, beTitle, 'input title comes from the posted job');
  assert.equal(d.resolved, true, 'an exact curated title must resolve');
  assert.ok(d.role_id, 'a resolved job carries a curated role_id');
  // Coverage ⟂ Confidence: crosswalk confidence and the role's profile coverage
  // are SEPARATE fields, never composited.
  assert.ok(d.role_crosswalk.resolved.confidence_pct > 0);
  assert.ok(d.role_crosswalk.resolved.competency_count >= 1);
  assert.equal(d.role_crosswalk.resolved.estimated, false, 'an exact title hit is not estimated');
});

test('a job whose title has no curated match ABSTAINS (never fabricates)', async (t) => {
  if (!substrateReady) {
    t.skip('no users / curated Role-DNA profiles present — cannot run integration test');
    return;
  }

  // A title with no defensible distinctive overlap with any curated role.
  const created = await createJob(pool, { id: actorId!, role: 'super_admin' } as any, {
    title: 'Registered Nurse Practitioner',
  });
  assert.equal(created.ok, true);
  const jobId = (created as any).data.id as string;
  createdJobIds.push(jobId);

  const res = await rankCandidatesForJob(pool, jobId);
  assert.equal(res.ok, true);
  const d = (res as any).data;
  assert.equal(d.resolved, false, 'no defensible match → abstain');
  assert.equal(d.role_id, null);
  assert.equal(d.measurable, false);
  assert.deepEqual(d.candidates, [], 'abstain ranks zero candidates, never a guess');
  assert.equal(d.role_crosswalk.resolved, null);
});

test('a non-existent job id is not_found', async (t) => {
  if (!substrateReady) {
    t.skip('no users / curated Role-DNA profiles present — cannot run integration test');
    return;
  }
  const res = await rankCandidatesForJob(pool, 'no-such-job-id-xyz');
  assert.equal(res.ok, false);
  assert.equal((res as any).code, 'not_found');
});
