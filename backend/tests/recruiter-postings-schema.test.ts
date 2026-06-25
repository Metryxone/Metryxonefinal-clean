/**
 * Recruiter Postings — schema-drift regression guard (Task #174)
 *
 * `employer_jobs` is created and written by SEVERAL modules with DIVERGENT
 * column shapes (employer-portal authoring path, MX-103W projection, and this
 * recruiter-postings module). Task #173 guarded the employer-portal authoring
 * path (POST /api/employer/jobs). This is the sibling guard for the recruiter
 * read path (GET /api/career/recruiter-postings), which:
 *   - lazily CREATEs `employer_jobs` with its OWN fallback shape, and
 *   - SELECTs a fixed column list out of it.
 *
 * The recruiter route is EXTRA dangerous on drift: its handler catches any
 * error and returns `{ postings: [], note: 'no_data' }` (graceful fallback so
 * the candidate UI never breaks). So a schema drift does NOT surface as a 500 —
 * it SILENTLY hides every posting. A simple "did it 200?" check would miss it.
 * See `.agents/memory/employer-job-store-projection.md`.
 *
 * This test exercises the REAL route against the REAL dev/prod DB so it fails
 * loudly whenever the recruiter SELECT column set and the live `employer_jobs`
 * schema disagree:
 *   1. Static guard — parse the exact column list out of the `SELECT ... FROM
 *      employer_jobs` statement in recruiter-postings.ts and assert every one of
 *      those columns exists in the live table (after lazy ensureTable has run).
 *      A column the SELECT reads but the live table lacks is caught here even if
 *      no row is ever written.
 *   2. End-to-end round-trip — INSERT an @example.com active job using exactly
 *      the recruiter SELECT column set (so a missing column throws "column does
 *      not exist" right here), then GET /api/career/recruiter-postings and assert
 *      the created job reads back with its fields intact. If a future drift makes
 *      the SELECT throw, the handler swallows it and returns [], so the row would
 *      NOT appear — which fails this assertion loudly instead of silently.
 *
 * All test data uses @example.com and is cleaned up afterwards (shared dev/prod
 * DB — see runtime-activation-traps.md).
 *
 * Run with:  cd backend && npx tsx tests/recruiter-postings-schema.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { createServer, type Server } from 'node:http';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { Pool } from 'pg';

import { registerRecruiterPostingsRoutes } from '../routes/recruiter-postings';

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
const TEST_EMAIL = `task174.recruiter.${Date.now()}@example.com`;
const TEST_JOB_ID = `task174-job-${Date.now()}`;

/**
 * Parse the column list out of the literal `SELECT ... FROM employer_jobs`
 * statement in the route source so this guard stays in lock-step with the code
 * automatically — no hand-maintained duplicate list to drift.
 */
function selectColumnsFromSource(): string[] {
  const src = readFileSync(
    pathResolve(__dirname, '../routes/recruiter-postings.ts'),
    'utf8',
  );
  const m = src.match(/SELECT\s+([\s\S]*?)\s+FROM employer_jobs/i);
  assert.ok(m, 'could not locate the SELECT ... FROM employer_jobs statement in recruiter-postings.ts');
  return m![1]
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('\n  \u26a0  DATABASE_URL not set — skipping recruiter-postings DB test.\n');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  let server: Server | undefined;

  try {
    // ── Throwaway app: stub auth, then register the REAL recruiter route. ──────
    const app: Express = express();
    app.use(express.json());
    const passthroughAuth = (req: any, _res: Response, next: NextFunction) => {
      req.user = { id: TEST_EMAIL, account_type: 'parent', username: TEST_EMAIL, role: 'parent' };
      req.isAuthenticated = () => true;
      next();
    };
    registerRecruiterPostingsRoutes(app, pool, passthroughAuth);

    server = createServer(app);
    await new Promise<void>((r) => server!.listen(0, r));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const base = `http://127.0.0.1:${port}`;

    // ── Hit the route once so its lazy ensureTable runs against the live DB. ────
    await fetch(`${base}/api/career/recruiter-postings`).catch(() => {});

    const cols = selectColumnsFromSource();

    // ── 1. Static guard: every SELECT column must exist in the live table. ─────
    await test('every recruiter SELECT employer_jobs column exists in the live schema', async () => {
      assert.ok(cols.includes('title'), 'sanity: SELECT should read title');
      assert.ok(cols.includes('work_mode'), 'sanity: SELECT should read work_mode');
      assert.ok(cols.includes('experience'), 'sanity: SELECT should read experience');
      assert.ok(cols.includes('salary'), 'sanity: SELECT should read salary');
      const live = await pool.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_name = 'employer_jobs'`,
      );
      const liveCols = new Set(live.rows.map((r: any) => r.column_name));
      const missing = cols.filter((c) => !liveCols.has(c));
      assert.deepEqual(
        missing,
        [],
        `recruiter SELECT reads columns absent from the live employer_jobs table: ${missing.join(', ')}. ` +
        `ensureTable in recruiter-postings.ts (or the owning module) must provide these columns.`,
      );
    });

    // ── 2. Create path: INSERT using exactly the recruiter SELECT column set. ──
    //     A column the recruiter expects but the live table lacks throws
    //     "column ... does not exist" right here — a loud, unambiguous failure.
    await test('inserting an employer_jobs row with the recruiter column set succeeds', async () => {
      const insertCols = ['id', 'employer_id', 'status', ...cols.filter((c) => c !== 'id' && c !== 'created_at')];
      const values: Record<string, any> = {
        id: TEST_JOB_ID,
        employer_id: TEST_EMAIL,
        status: 'active',
        title: 'Task174 Recruiter Posting',
        department: 'Engineering',
        location: 'Remote',
        type: 'Full-time',
        work_mode: 'Remote',
        experience: '5-8 years',
        salary: '20-30 LPA',
        description: 'Recruiter schema-guard test job',
        skills: JSON.stringify(['typescript', 'postgres']),
        requirements: JSON.stringify(['ownership']),
        ei_min_score: 60,
      };
      const placeholders = insertCols.map((_, i) => `$${i + 1}`);
      const params = insertCols.map((c) => values[c]);
      await pool.query(
        `INSERT INTO employer_jobs (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')})`,
        params,
      );
    });

    // ── 3. Read-back: GET the route, the inserted job must surface (not be
    //     silently swallowed by the graceful no_data fallback). ────────────────
    await test('GET /api/career/recruiter-postings returns the inserted job with fields intact', async () => {
      const res = await fetch(`${base}/api/career/recruiter-postings`);
      assert.equal(res.status, 200, `expected 200, got ${res.status}`);
      const body = await res.json();
      assert.equal(body.success, true, 'response should report success');
      assert.notEqual(
        body.note,
        'no_data',
        'route returned the no_data fallback — the SELECT likely threw (schema drift) and was swallowed',
      );
      assert.ok(Array.isArray(body.postings), 'postings should be an array');
      const job = body.postings.find((j: any) => j._id === TEST_JOB_ID);
      assert.ok(job, 'the inserted job should appear in the recruiter postings list');
      assert.equal(job.title, 'Task174 Recruiter Posting', 'title should round-trip');
      assert.equal(job.type, 'Full-time', 'type should round-trip');
      assert.equal(job.workMode, 'Remote', 'workMode should round-trip');
      assert.equal(job.experience, '5-8 years', 'experience should round-trip');
      assert.equal(job.salary, '20-30 LPA', 'salary should round-trip');
      assert.equal(job.eiMinScore, 60, 'eiMinScore should round-trip');
    });
  } finally {
    // ── Cleanup (shared dev/prod DB — leave no @example.com residue). ─────────
    await pool.query(`DELETE FROM employer_jobs WHERE id = $1 OR employer_id = $2`, [TEST_JOB_ID, TEST_EMAIL]).catch(() => {});
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
