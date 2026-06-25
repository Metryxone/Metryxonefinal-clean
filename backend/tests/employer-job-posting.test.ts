/**
 * Employer Job Posting — schema-drift regression guard (Task #173)
 *
 * Posting a job via the employer portal (POST /api/employer/jobs) once broke
 * with HTTP 500 because the shared `employer_jobs` table was missing the
 * descriptive columns the INSERT writes (work_mode / experience / salary). The
 * table is created/owned by SEVERAL modules with DIVERGENT shapes (recruiter-
 * postings, MX-103W projection, the native portal authoring path), so a future
 * schema drift could silently break job creation again. See
 * `.agents/memory/employer-job-store-projection.md`.
 *
 * This test exercises the REAL route against the REAL dev/prod DB so it fails
 * loudly whenever the INSERT column set and the live `employer_jobs` schema
 * disagree:
 *   1. Static guard — parse the exact column list out of the `INSERT INTO
 *      employer_jobs (...)` statement in employer-portal.ts and assert every
 *      one of those columns exists in the live table (after lazy ensureSchema
 *      has run). A column added to the INSERT but not to ensureSchema is caught
 *      here even if no row is ever written.
 *   2. End-to-end — register a throwaway @example.com employer, POST a job
 *      (asserts 201), then GET the jobs list and assert the created job reads
 *      back with salary / workMode / experience / type intact (the INSERT itself
 *      throws 500 against a drifted table, so a real drift fails this too).
 *
 * All test data uses @example.com and is cleaned up afterwards (shared dev/prod
 * DB — see runtime-activation-traps.md).
 *
 * Run with:  cd backend && npx tsx tests/employer-job-posting.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { createServer, type Server } from 'node:http';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { Pool } from 'pg';

import { registerEmployerPortalRoutes, ensureSchema } from '../routes/employer-portal';

// ── Minimal test runner (matches the repo's other tsx test files) ──────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];
function test(label: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  \u2713  ${label}`); passed++; })
    .catch((err: any) => {
      console.error(`  \u2717  ${label}`);
      console.error(`     ${err?.message ?? err}`);
      failed++;
      failures.push(label);
    });
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_EMAIL = `task173.employer.${Date.now()}@example.com`;

/**
 * Parse the column list out of the literal `INSERT INTO employer_jobs (...)`
 * statement in the route source so this guard stays in lock-step with the code
 * automatically — no hand-maintained duplicate list to drift.
 */
function insertColumnsFromSource(): string[] {
  const src = readFileSync(
    pathResolve(__dirname, '../routes/employer-portal.ts'),
    'utf8',
  );
  const m = src.match(/INSERT INTO employer_jobs\s*\(([^)]*)\)/i);
  assert.ok(m, 'could not locate the INSERT INTO employer_jobs (...) statement in employer-portal.ts');
  return m![1]
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('\n  \u26a0  DATABASE_URL not set — skipping employer-job-posting DB test.\n');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  let userId = '';
  let server: Server | undefined;

  try {
    // ── Seed a throwaway employer user (@example.com, cleaned up below). ───────
    const ins = await pool.query(
      `INSERT INTO users (username, password, email, account_type, role)
       VALUES ($1, 'x', $1, 'employer', 'parent')
       RETURNING id`,
      [TEST_EMAIL],
    );
    userId = ins.rows[0].id;

    // ── Throwaway app: inject the seeded employer onto every request, then
    //    register the REAL employer routes (gate middleware + all handlers). ──
    const app: Express = express();
    app.use(express.json());
    app.use((req: any, _res: Response, next: NextFunction) => {
      req.user = { id: userId, account_type: 'employer', username: TEST_EMAIL, role: 'parent' };
      req.isAuthenticated = () => true;
      next();
    });
    const passthroughAuth = (_req: Request, _res: Response, next: NextFunction) => next();
    registerEmployerPortalRoutes(app, pool, passthroughAuth);

    server = createServer(app);
    await new Promise<void>((r) => server!.listen(0, r));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const base = `http://127.0.0.1:${port}`;

    // ── 1. Static guard: every INSERT column must exist in the live table. ────
    await test('every INSERT INTO employer_jobs column exists in the live schema', async () => {
      await ensureSchema(pool); // lazy ALTERs that reconcile the divergent table
      const cols = insertColumnsFromSource();
      assert.ok(cols.includes('work_mode'), 'sanity: INSERT should write work_mode');
      assert.ok(cols.includes('experience'), 'sanity: INSERT should write experience');
      assert.ok(cols.includes('salary'), 'sanity: INSERT should write salary');
      const live = await pool.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_name = 'employer_jobs'`,
      );
      const liveCols = new Set(live.rows.map((r: any) => r.column_name));
      const missing = cols.filter((c) => !liveCols.has(c));
      assert.deepEqual(
        missing,
        [],
        `INSERT writes columns absent from the live employer_jobs table: ${missing.join(', ')}. ` +
        `ensureSchema in employer-portal.ts must ADD COLUMN IF NOT EXISTS for these.`,
      );
    });

    // ── 2. End-to-end: POST a job, assert 201 + fields echoed back. ───────────
    let createdJobId = '';
    const jobPayload = {
      title: 'Task173 Backend Engineer',
      department: 'Engineering',
      location: 'Remote',
      type: 'Full-time',
      workMode: 'Remote',
      experience: '5-8 years',
      salary: '20-30 LPA',
      description: 'Regression-guard test job',
      skills: ['typescript', 'postgres'],
      eiMinScore: 60,
    };

    await test('POST /api/employer/jobs returns 201 with descriptive fields intact', async () => {
      const res = await fetch(`${base}/api/employer/jobs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(jobPayload),
      });
      const body = await res.json().catch(() => ({}));
      assert.equal(res.status, 201, `expected 201, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.job?._id, 'response should carry the created job id');
      createdJobId = body.job._id;
      assert.equal(body.job.salary, jobPayload.salary, 'salary should round-trip');
      assert.equal(body.job.workMode, jobPayload.workMode, 'workMode should round-trip');
      assert.equal(body.job.experience, jobPayload.experience, 'experience should round-trip');
      assert.equal(body.job.type, jobPayload.type, 'type should round-trip');
    });

    // ── 3. Read-back: GET the list, the created job persists with fields. ─────
    await test('GET /api/employer/jobs reads the created job back with salary/workMode/experience', async () => {
      const res = await fetch(`${base}/api/employer/jobs`, {
        method: 'GET',
        headers: { 'content-type': 'application/json' },
      });
      assert.equal(res.status, 200, `expected 200, got ${res.status}`);
      const jobs = await res.json();
      assert.ok(Array.isArray(jobs), 'jobs list should be an array');
      const job = jobs.find((j: any) => j._id === createdJobId);
      assert.ok(job, 'the created job should appear in the employer jobs list');
      assert.equal(job.salary, jobPayload.salary, 'persisted salary should match');
      assert.equal(job.workMode, jobPayload.workMode, 'persisted workMode should match');
      assert.equal(job.experience, jobPayload.experience, 'persisted experience should match');
      assert.equal(job.type, jobPayload.type, 'persisted type should match');
    });
  } finally {
    // ── Cleanup (shared dev/prod DB — leave no @example.com residue). ─────────
    if (userId) {
      await pool.query(`DELETE FROM employer_jobs WHERE employer_id = $1`, [userId]).catch(() => {});
      await pool.query(`DELETE FROM employer_members WHERE org_id = $1 OR user_id = $1`, [userId]).catch(() => {});
      await pool.query(`DELETE FROM employer_organizations WHERE id = $1 OR owner_id = $1`, [userId]).catch(() => {});
      await pool.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => {});
    }
    if (server) await new Promise<void>((r) => server!.close(() => r()));
    await pool.end().catch(() => {});
  }

  console.log(`\n  ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error(`\n  FAILED: ${failures.join(', ')}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
