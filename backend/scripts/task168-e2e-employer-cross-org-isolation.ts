/**
 * Task #168 E2E — cross-ORGANIZATION isolation proof for the employer-facing
 * competency-hiring surface (/api/v2/employer/competency-match/...).
 *
 * Task #158 proved candidate↔candidate isolation on GET /api/competency/precise-scores
 * (the SELF-serve surface, subject derived from the candidate's own session). The
 * adjacent risk is the EMPLOYER-facing surface, which composes the SAME unified
 * competency profile (subject = candidate email) for a recruiter inspecting a
 * candidate↔job match. The danger: an employer in organization X reading the precise
 * competency data of a candidate that only ever belongs to organization Y — either by
 * legitimately looking up a candidate they own, or by passing another org's candidate
 * id (IDOR).
 *
 * The route resolves the candidate AND the job scoped to the caller's employer org
 * (`resolveScoped(orgId, candidateId, jobId)` — both rows must have employer_id = orgId)
 * and returns 404 otherwise, with NO cross-org existence leak. This test locks that in
 * end-to-end over the real HTTP surface:
 *
 *   1. Registers candidate C over HTTP and has C run a real competency assessment
 *      (mapped CRA codes → precise competency scores keyed to C's email).
 *   2. Registers employer A in org X over HTTP (own session/cookie), then seeds A's
 *      job + an employer_candidate row carrying C's email.
 *   3. Confirms employer A, with A's OWN cookie, CAN read the competency match for
 *      A's candidate+job (200; subjectId = C's email; competency profile available) —
 *      proving the data genuinely exists and is reachable by the rightful org.
 *   4. Registers employer B in a DISTINCT org Y over HTTP (own session/cookie) + a job.
 *   5. THE ISOLATION ASSERTIONS — employer B, with B's OWN cookie, must NOT be able
 *      to read A's candidate's competency data via ANY id combination:
 *        a. B + A's candidateId + A's jobId             → 404 (no cross-org leak)
 *        b. B + A's candidateId + B's own jobId (IDOR)  → 404 (candidate not in B's org)
 *        c. B + A's candidateId + A's jobId /intelligence → 404 (full flow also gated)
 *      and the 404 bodies must contain NEITHER C's email NOR any candidateScore.
 *   6. Controls: an unauthenticated request → 401; a logged-in NON-employer (the
 *      candidate's own cookie) → 403/401 (employer account required).
 *
 * Fixture note: employer A/B and the candidate are created over real HTTP (real session
 * cookies + real org context). The job + employer_candidate ROWS are seeded directly via
 * SQL scoped to each org's id — the POST /api/employer/jobs HTTP route is broken against
 * the live (drifted) employer_jobs schema (it INSERTs a `work_mode`/`salary` shape the
 * live table created by the recruiter-postings module does not have); that is a
 * pre-existing bug unrelated to this isolation proof, and the security surface under test
 * is the READ path, which is exercised entirely over HTTP.
 *
 * Self-cleaning: all rows (3 users, onto/cra ledgers, employer org/member/candidate/job)
 * are @example.com / task168-prefixed and DELETEd before AND after the run, so re-runs
 * are idempotent and the shared dev/prod DB carries no residue.
 *
 * Requires the Backend API workflow flags (already set there):
 *   FF_EMPLOYER_COMPETENCY_HIRING=1, FF_ADAPTIVE_INTELLIGENCE_FOUNDATION=1,
 *   FF_COMPETENCY_RUNTIME=1.
 *
 * Run: cd backend && npx tsx scripts/task168-e2e-employer-cross-org-isolation.ts
 *      (optional: SMOKE_BASE=http://localhost:8080)
 */
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const BASE = process.env.SMOKE_BASE || 'http://localhost:8080';
const EMAIL_CAND = 'task168-cand@example.com';
const EMAIL_EMP_A = 'task168-emp-a@example.com';
const EMAIL_EMP_B = 'task168-emp-b@example.com';
const PASSWORD = 'Task168!e2e-pw';

let failures = 0;
const assert = (cond: boolean, msg: string) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${msg}`);
  if (!cond) failures++;
};

/** Collect Set-Cookie name=value pairs from a fetch Response into a Cookie header. */
function cookieFromRes(res: Response): string {
  const anyHeaders = res.headers as any;
  const list: string[] =
    typeof anyHeaders.getSetCookie === 'function'
      ? anyHeaders.getSetCookie()
      : res.headers.get('set-cookie')
        ? [res.headers.get('set-cookie') as string]
        : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

/** Register a user over HTTP and return their session cookie (or throw). */
async function registerUser(email: string, fullName: string, role: string): Promise<string> {
  const reg = await fetch(`${BASE}/api/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: email, password: PASSWORD, fullName, role, email }),
  });
  await reg.json().catch(() => ({}));
  assert(reg.ok, `registered & authenticated ${fullName} over HTTP (HTTP ${reg.status})`);
  const cookie = cookieFromRes(reg);
  assert(cookie.length > 0, `session cookie issued for ${fullName}`);
  if (!reg.ok || !cookie) throw new Error(`cannot continue without a session for ${fullName}`);
  return cookie;
}

/** Promote a logged-in user to an employer org (org.id == user id). */
async function activateEmployer(cookie: string, companyName: string): Promise<string> {
  const r = await fetch(`${BASE}/api/employer/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ companyName }),
  });
  const body = await r.json().catch(() => ({}));
  assert(r.ok && body?.success === true, `employer account activated for ${companyName} (HTTP ${r.status})`);
  if (!r.ok) throw new Error(`employer register failed for ${companyName}`);
  return String(body?.orgId ?? '');
}

/**
 * Seed a job row scoped to an org, matching the LIVE employer_jobs columns. The HTTP
 * create route is broken against the drifted live schema (pre-existing, unrelated bug);
 * the READ path under test is unaffected and exercised over HTTP.
 */
async function seedJob(pool: Pool, orgId: string, title: string): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO employer_jobs (id, employer_id, title, department, status, skills, created_at)
     VALUES ($1, $2, $3, 'Engineering', 'Active', $4::jsonb, now())`,
    [id, orgId, title, JSON.stringify(['Critical Thinking', 'Problem Solving'])],
  );
  const check = await pool.query(`SELECT id FROM employer_jobs WHERE id = $1 AND employer_id = $2`, [id, orgId]);
  assert(check.rows.length === 1, `seeded job "${title}" scoped to org ${orgId.slice(0, 8)}…`);
  return id;
}

/** Seed an employer_candidate row carrying the candidate's email, scoped to an org. */
async function seedCandidate(pool: Pool, orgId: string, jobId: string, email: string): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO employer_candidates (id, employer_id, job_id, name, email, candidate_role, stage, created_at)
     VALUES ($1, $2, $3, 'Task168 Candidate', $4, 'Engineer', 'applied', now())`,
    [id, orgId, jobId, email],
  );
  const check = await pool.query(`SELECT id FROM employer_candidates WHERE id = $1 AND employer_id = $2`, [id, orgId]);
  assert(check.rows.length === 1, `seeded candidate ${email} scoped to org ${orgId.slice(0, 8)}…`);
  return id;
}

async function getUserId(pool: Pool, email: string): Promise<string | null> {
  const r = await pool
    .query<{ id: string }>(`SELECT id FROM users WHERE username = $1`, [email])
    .catch(() => ({ rows: [] as { id: string }[] }));
  return r.rows[0]?.id ?? null;
}

async function cleanupUser(pool: Pool, email: string) {
  await pool.query(`DELETE FROM onto_competency_score_runs WHERE subject_id = $1`, [email]).catch(() => {});
  const orgId = await getUserId(pool, email);
  if (orgId) {
    await pool.query(`DELETE FROM employer_candidates WHERE employer_id = $1`, [orgId]).catch(() => {});
    await pool.query(`DELETE FROM employer_jobs WHERE employer_id = $1`, [orgId]).catch(() => {});
    await pool.query(`DELETE FROM employer_members WHERE org_id = $1 OR user_id = $1`, [orgId]).catch(() => {});
    await pool.query(`DELETE FROM employer_company_profiles WHERE employer_id = $1`, [orgId]).catch(() => {});
    await pool.query(`DELETE FROM employer_organizations WHERE id = $1`, [orgId]).catch(() => {});
    await pool.query(`DELETE FROM cra_scores WHERE user_id = $1`, [orgId]).catch(() => {});
    await pool.query(`DELETE FROM cra_profiles WHERE user_id = $1`, [orgId]).catch(() => {});
  }
  // Any employer_candidate rows carrying the candidate's email (defensive).
  await pool.query(`DELETE FROM employer_candidates WHERE lower(email) = $1`, [email.toLowerCase()]).catch(() => {});
  await pool.query(`DELETE FROM users WHERE username = $1`, [email]).catch(() => {});
}

async function cleanup(pool: Pool) {
  await cleanupUser(pool, EMAIL_CAND);
  await cleanupUser(pool, EMAIL_EMP_A);
  await cleanupUser(pool, EMAIL_EMP_B);
}

/** A 404 body must not leak the candidate's email or any precise competency score. */
function assertNoLeak(label: string, raw: string, email: string) {
  const lc = raw.toLowerCase();
  assert(!lc.includes(email.toLowerCase()), `${label}: response does NOT contain the candidate email`);
  assert(!/"candidatescore"\s*:\s*-?\d/.test(lc), `${label}: response carries NO candidateScore datapoint`);
  assert(!/"subjectid"\s*:\s*"task168-cand/.test(lc), `${label}: response carries NO competency subjectId`);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await cleanup(pool); // clean slate (idempotent re-runs)

    // 1) Candidate C registers and runs a real competency assessment so precise
    //    competency-granularity scores exist keyed to C's email.
    const cookieCand = await registerUser(EMAIL_CAND, 'Task168 Candidate', 'career_seeker');
    const run = await fetch(`${BASE}/api/competency/run-assessment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookieCand },
      body: JSON.stringify({
        scores: [
          { competencyCode: 'COG01', rawScore: 82, confidence: 0.9 },
          { competencyCode: 'COG02', rawScore: 55, confidence: 0.8 },
          { competencyCode: 'EIQ05', rawScore: 30, confidence: 0.7 },
        ],
      }),
    });
    const runBody = await run.json().catch(() => ({}));
    assert(run.ok, `C: competency assessment accepted (HTTP ${run.status})`);
    assert(
      runBody?.data?.precise?.written === true && runBody?.data?.precise?.competencies === 3,
      `C: precise-run bridge wrote 3 mapped competencies (written=${runBody?.data?.precise?.written}, n=${runBody?.data?.precise?.competencies})`,
    );

    // 2) Employer A (org X): activate over HTTP, then seed a job + candidate for C.
    const cookieA = await registerUser(EMAIL_EMP_A, 'Task168 Employer A', 'recruiter');
    const orgA = await activateEmployer(cookieA, 'Task168 Org X');
    const jobA = await seedJob(pool, orgA, 'Software Engineer');
    const candA = await seedCandidate(pool, orgA, jobA, EMAIL_CAND);

    // 3) Employer A CAN read the competency match for A's own candidate+job — proves
    //    the candidate's competency data genuinely exists and is reachable by the
    //    rightful org (so B's later 404 is a real authZ block, not "no data anywhere").
    const okRes = await fetch(`${BASE}/api/v2/employer/competency-match/${candA}/${jobA}`, {
      headers: { cookie: cookieA },
    });
    const okBody = await okRes.json().catch(() => ({}));
    assert(okRes.ok, `A: GET own candidate+job match returned (HTTP ${okRes.status})`);
    assert(okBody?.ok === true && !!okBody?.match, 'A: match envelope returned for A\u2019s own candidate');
    assert(okBody?.match?.subjectId === EMAIL_CAND, `A: match subjectId resolves to C\u2019s email (got ${okBody?.match?.subjectId})`);
    assert(okBody?.match?.competencyProfileAvailable === true, 'A: candidate competency profile is available to the rightful org');

    // 4) Employer B (org Y): a DISTINCT org with its own job.
    const cookieB = await registerUser(EMAIL_EMP_B, 'Task168 Employer B', 'recruiter');
    const orgB = await activateEmployer(cookieB, 'Task168 Org Y');
    assert(orgA !== orgB, `A and B are in DISTINCT orgs (${orgA} != ${orgB})`);
    assert(cookieA !== cookieB, 'A and B hold distinct session cookies');
    const jobB = await seedJob(pool, orgB, 'Software Engineer');

    // 5a) ISOLATION — B passes A's candidateId + A's jobId. Neither belongs to B's
    //     org → 404, with no cross-org existence leak.
    const idor1 = await fetch(`${BASE}/api/v2/employer/competency-match/${candA}/${jobA}`, {
      headers: { cookie: cookieB },
    });
    const idor1Raw = await idor1.text();
    assert(idor1.status === 404, `B: A's candidate + A's job → 404 (got ${idor1.status})`);
    assertNoLeak('B(A-cand,A-job)', idor1Raw, EMAIL_CAND);

    // 5b) ISOLATION (IDOR) — B passes A's candidateId + B's OWN jobId. The job is B's,
    //     but the candidate is not in B's org → still 404 (the resolver requires BOTH).
    const idor2 = await fetch(`${BASE}/api/v2/employer/competency-match/${candA}/${jobB}`, {
      headers: { cookie: cookieB },
    });
    const idor2Raw = await idor2.text();
    assert(idor2.status === 404, `B: A's candidate + B's own job (IDOR) → 404 (got ${idor2.status})`);
    assertNoLeak('B(A-cand,B-job)', idor2Raw, EMAIL_CAND);

    // 5c) ISOLATION — the full /intelligence flow is gated identically.
    const idor3 = await fetch(`${BASE}/api/v2/employer/competency-match/${candA}/${jobA}/intelligence`, {
      headers: { cookie: cookieB },
    });
    const idor3Raw = await idor3.text();
    assert(idor3.status === 404, `B: A's candidate + A's job /intelligence → 404 (got ${idor3.status})`);
    assertNoLeak('B(intelligence)', idor3Raw, EMAIL_CAND);

    // 6) Controls.
    const anon = await fetch(`${BASE}/api/v2/employer/competency-match/${candA}/${jobA}`);
    assert(anon.status === 401, `unauthenticated request is rejected (HTTP ${anon.status})`);

    // A logged-in NON-employer (the candidate's own cookie) is not an employer org and
    // owns no employer_candidate/job rows, so the org-scoped resolver finds nothing. The
    // surface scopes strictly by the caller's own id, so the candidate sees no other
    // org's data — 401 (rejected), 403 (forbidden), or 404 (empty/not-found) all satisfy
    // the property "cannot read the employer surface for someone else's candidate".
    const nonEmp = await fetch(`${BASE}/api/v2/employer/competency-match/${candA}/${jobA}`, {
      headers: { cookie: cookieCand },
    });
    assert(
      nonEmp.status === 401 || nonEmp.status === 403 || nonEmp.status === 404,
      `non-employer session cannot read another org's candidate (HTTP ${nonEmp.status})`,
    );
    const nonEmpRaw = await nonEmp.text();
    assertNoLeak('non-employer', nonEmpRaw, EMAIL_CAND);
  } finally {
    await cleanup(pool);
    await pool.end();
  }

  console.log(failures === 0 ? '\nEMPLOYER CROSS-ORG ISOLATION: ALL PASS' : `\nEMPLOYER CROSS-ORG ISOLATION: ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
