/**
 * Task #158 E2E — cross-user isolation proof for precise competency scores.
 *
 * The Task #144 E2E proves an authenticated candidate sees THEIR precise scores
 * and that an UNauthenticated request is rejected (401). It does NOT prove that a
 * DIFFERENT authenticated candidate cannot read the first candidate's scores.
 *
 * GET /api/competency/precise-scores derives the subject server-side from the
 * SESSION (no :userId param), so isolation SHOULD hold by construction — this
 * test locks that in end-to-end against the real HTTP surface, catching any
 * future IDOR regression (e.g. a :userId param being added, or the resolver
 * reading an attacker-controlled field):
 *
 *   1. Registers candidate A over HTTP (POST /api/register), keeps A's cookie.
 *   2. A submits a real competency assessment (mapped CRA codes → precise scores).
 *   3. Confirms A, with A's OWN cookie, sees A's 3 precise scores (data exists).
 *   4. Registers candidate B over HTTP (separate session/cookie).
 *   5. Asserts B, with B's OWN cookie, sees NONE of A's scores
 *      (hasPrecise=false / precise=[] for B — resolved to B's own empty ledger).
 *   6. Asserts an unauthenticated request is still rejected (401) — control.
 *
 * Self-cleaning: both candidates are @example.com and EVERY row created is
 * DELETEd (users, cra_profiles, cra_scores, onto_competency_score_runs) before
 * AND after the run, so re-runs are idempotent and dev/prod share no residue.
 *
 * Requires the competencyRuntime flag ON (FF_COMPETENCY_RUNTIME=1 — the Backend
 * API workflow already sets it). With the flag OFF the precise field is omitted
 * and { enabled:false } is returned; this test asserts the flag-ON behaviour.
 *
 * Run: npx tsx backend/scripts/task158-e2e-precise-scores-isolation.ts
 *      (optional: SMOKE_BASE=http://localhost:8080)
 */
import { Pool } from 'pg';

const BASE = process.env.SMOKE_BASE || 'http://localhost:8080';
const EMAIL_A = 'task158-e2e-a@example.com';
const EMAIL_B = 'task158-e2e-b@example.com';
const PASSWORD = 'Task158!e2e-pw';

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

async function cleanupOne(pool: Pool, email: string) {
  // onto ledger is keyed by EMAIL; cra_* keyed by user id; remove all of them.
  await pool.query(`DELETE FROM onto_competency_score_runs WHERE subject_id = $1`, [email]).catch(() => {});
  const u = await pool
    .query<{ id: string }>(`SELECT id FROM users WHERE username = $1`, [email])
    .catch(() => ({ rows: [] as { id: string }[] }));
  for (const row of u.rows) {
    await pool.query(`DELETE FROM cra_scores WHERE user_id = $1`, [row.id]).catch(() => {});
    await pool.query(`DELETE FROM cra_profiles WHERE user_id = $1`, [row.id]).catch(() => {});
  }
  await pool.query(`DELETE FROM users WHERE username = $1`, [email]).catch(() => {});
}

async function cleanup(pool: Pool) {
  await cleanupOne(pool, EMAIL_A);
  await cleanupOne(pool, EMAIL_B);
}

/** Register a candidate over HTTP and return their session cookie (or throw). */
async function registerCandidate(email: string, fullName: string): Promise<string> {
  const reg = await fetch(`${BASE}/api/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: email,
      password: PASSWORD,
      fullName,
      role: 'career_seeker',
      email,
    }),
  });
  await reg.json().catch(() => ({}));
  assert(reg.ok, `registered & authenticated ${fullName} over HTTP (HTTP ${reg.status})`);
  const cookie = cookieFromRes(reg);
  assert(cookie.length > 0, `session cookie issued for ${fullName}`);
  if (!reg.ok || !cookie) throw new Error(`cannot continue without an authenticated session for ${fullName}`);
  return cookie;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await cleanup(pool); // start from a clean slate (idempotent re-runs)

    // 1) Authenticate candidate A. username == email so the server resolves the
    //    onto-ledger subject (email) directly from A's session.
    const cookieA = await registerCandidate(EMAIL_A, 'Task158 Candidate A');

    // 2) A submits a real competency assessment. Mapped CRA codes only, so all
    //    three become precise competency-granularity scores keyed to A's email.
    const scores = [
      { competencyCode: 'COG01', rawScore: 82, confidence: 0.9 }, // -> comp_critical_thinking  (level 5)
      { competencyCode: 'COG02', rawScore: 55, confidence: 0.8 }, // -> comp_problem_solving     (level 3)
      { competencyCode: 'EIQ05', rawScore: 30, confidence: 0.7 }, // -> comp_conflict_resolution (level 2)
    ];
    const run = await fetch(`${BASE}/api/competency/run-assessment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookieA },
      body: JSON.stringify({ scores }),
    });
    const runBody = await run.json().catch(() => ({}));
    assert(run.ok, `A: POST run-assessment accepted over HTTP (HTTP ${run.status})`);
    assert(
      runBody?.data?.precise?.written === true && runBody?.data?.precise?.competencies === 3,
      `A: precise-run bridge wrote 3 mapped competencies (got written=${runBody?.data?.precise?.written}, n=${runBody?.data?.precise?.competencies})`,
    );

    // 3) A, with A's OWN cookie, sees A's 3 precise scores — proves the data
    //    genuinely exists (so a later empty B is real isolation, not just "no
    //    data anywhere").
    const psA = await fetch(`${BASE}/api/competency/precise-scores`, { headers: { cookie: cookieA } });
    const psABody = await psA.json().catch(() => ({}));
    assert(psA.ok, `A: GET precise-scores returned over HTTP (HTTP ${psA.status})`);
    assert(psABody?.enabled === true, 'A: precise-scores enabled (competencyRuntime flag ON)');
    assert(psABody?.resolved === true, 'A: resolver resolved A\u2019s authenticated session subject');
    assert(psABody?.hasPrecise === true, 'A: hasPrecise=true (A sees their own scores)');
    const preciseA: any[] = Array.isArray(psABody?.precise) ? psABody.precise : [];
    assert(preciseA.length === 3, `A: sees exactly 3 precise scores (got ${preciseA.length})`);
    const aCodes = new Set(preciseA.map((s) => s.code));
    assert(
      aCodes.has('comp_critical_thinking') && aCodes.has('comp_problem_solving') && aCodes.has('comp_conflict_resolution'),
      'A: sees the three competencies A measured',
    );

    // 4) Register candidate B as a completely separate session. B has NEVER
    //    submitted an assessment.
    const cookieB = await registerCandidate(EMAIL_B, 'Task158 Candidate B');
    assert(cookieA !== cookieB, 'A and B hold distinct session cookies');

    // 5) THE ISOLATION ASSERTION — B, logged in with B's OWN cookie, must see
    //    NONE of A's scores. The subject is derived from B's session server-side
    //    (no :userId param), so B resolves to B's own (empty) ledger.
    const psB = await fetch(`${BASE}/api/competency/precise-scores`, { headers: { cookie: cookieB } });
    const psBBody = await psB.json().catch(() => ({}));
    assert(psB.ok, `B: GET precise-scores returned over HTTP (HTTP ${psB.status})`);
    assert(psBBody?.enabled === true, 'B: precise-scores enabled (competencyRuntime flag ON)');
    // resolved reflects whether B has their OWN competency run/profile (== !!run
    // || !!profile). B never submitted an assessment, so an HONEST resolved=false
    // here is exactly the proof of isolation: B's session resolves to B's own
    // (empty) ledger, NOT to A's data.
    assert(psBBody?.resolved === false, 'B: resolver resolved to B\u2019s OWN (empty) ledger, not A\u2019s data (resolved=false)');
    assert(psBBody?.hasPrecise === false, 'B: hasPrecise=false (B has no precise scores of their own)');
    const preciseB: any[] = Array.isArray(psBBody?.precise) ? psBBody.precise : [];
    assert(preciseB.length === 0, `B: precise is EMPTY (got ${preciseB.length})`);

    // Cross-user leak guard: NONE of A's competency codes appear in B's payload.
    const leaked = preciseB.filter((s) => aCodes.has(s.code));
    assert(
      leaked.length === 0,
      `B: sees NONE of A\u2019s competency scores (leaked ${leaked.length}: ${leaked.map((s) => s.code).join(', ')})`,
    );

    // 6) Control: an unauthenticated request is still rejected outright.
    const anon = await fetch(`${BASE}/api/competency/precise-scores`);
    assert(anon.status === 401, `unauthenticated request is rejected (HTTP ${anon.status})`);
  } finally {
    await cleanup(pool);
    await pool.end();
  }

  console.log(failures === 0 ? '\nE2E ISOLATION: ALL PASS' : `\nE2E ISOLATION: ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
