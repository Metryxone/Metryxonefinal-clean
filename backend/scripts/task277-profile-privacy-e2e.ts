/**
 * TASK #277 — Block students from overwriting each other's resume/profile data (LIVE HTTP E2E).
 *
 * Task #274 added a live two-session HTTP e2e proving student B cannot read or overwrite
 * student A's launchpad tracker (career_seeker_profiles.data.fresherHub) even when supplying
 * A's id. But the SAME career_seeker_profiles row — plus the sibling career_seeker_jobs /
 * career_seeker_goals rows — is written by the other self-only career-seeker surfaces:
 *
 *   - POST /api/cv/save-profile   (resume/profile JSONB; subject = sessionUser(req))
 *   - POST /api/cv/init-profile   (skeleton profile seed; subject = sessionUser(req))
 *   - GET  /api/cv/profile/:userId / PUT /api/cv/profile/:userId (resolveUserId guard)
 *   - GET/POST/PUT/DELETE /api/cv/jobs(/:id|/:userId)   (saved jobs)
 *   - GET/POST/PUT/DELETE /api/cv/goals(/:id|/:userId)  (career goals)
 *
 * Those surfaces resolve the subject server-side (session principal, never a client-supplied
 * id) but had NO live two-student IDOR regression — so an auth-middleware regression or a
 * proxy rewrite upstream of them would go uncaught. This harness closes that gap.
 *
 * It drives the REAL running Backend API server (localhost:8080) exactly as a browser would —
 * through the live session-auth + CSRF middleware + real Postgres — with TWO independent
 * student sessions (A and B), and proves at the live layer that:
 *
 *   1. Student A saves resume/profile data, a saved job and a goal into A's OWN rows.
 *   2. Student B (authenticated as B) cannot READ A's profile/jobs/goals even when passing
 *      A's id in the URL param (GET /:userId → 403) — B's id is the only subject.
 *   3. Student B cannot OVERWRITE A's profile via the param routes (PUT /:userId → 403) nor
 *      via the self-only POST routes (save-profile / init-profile resolve to B's row, never
 *      A's, even when A's id is smuggled into the body) — verified DIRECTLY against Postgres:
 *      A's row stays byte-for-byte unchanged while B's own row receives B's data.
 *   4. Student B cannot mutate A's saved job / goal rows (PUT /jobs/:id, /goals/:id are
 *      scoped to the session user → 404 for A's row ids), and A's rows are unchanged.
 *   5. A re-reads everything and still sees its original data.
 *
 * Honesty notes:
 *   - Both accounts use @example.com so they are purgeable from the shared dev/prod DB; the
 *     harness self-cleans (profiles + jobs + goals + users) on exit even on failure.
 *   - These cv routes are NOT flag-gated (only the studio/experience routes are), so no
 *     feature flag is required for this harness to exercise them.
 *   - No engine output is fabricated: payloads are synthetic; DB assertions read the live
 *     rows the live routes wrote.
 *
 * Run:  cd backend && npx tsx scripts/task277-profile-privacy-e2e.ts
 * (The Backend API workflow must be running on :8080.)
 */

import { Pool } from 'pg';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let failures = 0;
let stepNo = 0;
function step(name: string) { stepNo += 1; console.log(`\n[${String(stepNo).padStart(2, '0')}] ${name}`); }
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`     ✓ ${msg}`);
  else { failures += 1; console.error(`     ✗ FAIL: ${msg}`); }
}

// ── A cookie jar + CSRF-aware fetch, scoped to ONE session (one student). ────
//    Each student gets its OWN jar so the two sessions never share cookies.
function makeSession() {
  const jar = new Map<string, string>();
  function applySetCookie(res: Response) {
    const raw = (res.headers as any).getSetCookie?.() as string[] | undefined;
    const list = raw && raw.length ? raw : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')!] : []);
    for (const c of list) {
      const first = c.split(';')[0];
      const eq = first.indexOf('=');
      if (eq > 0) jar.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
    }
  }
  function cookieHeader(): string {
    return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }
  async function api(method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const ck = cookieHeader();
    if (ck) headers['Cookie'] = ck;
    const csrf = jar.get('mx.csrf');
    if (csrf && method !== 'GET') headers['x-csrf-token'] = decodeURIComponent(csrf);
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    applySetCookie(res);
    let json: any = null;
    const text = await res.text();
    if (text) { try { json = JSON.parse(text); } catch { json = text; } }
    return { status: res.status, json };
  }
  return { jar, api };
}

const RUN = Date.now().toString(36);
const PW = `E2eProf!${RUN}aA9`; // satisfies complexity policy (upper/lower/digit/symbol/len)
// Both demo students use @example.com so they are purgeable from the shared DB.
const EMAIL_A = `e2e277.studentA.${RUN}@example.com`;
const EMAIL_B = `e2e277.studentB.${RUN}@example.com`;

let userIdA = '';
let userIdB = '';

async function cleanup() {
  try {
    for (const id of [userIdA, userIdB]) {
      if (!id) continue;
      await pool.query(`DELETE FROM career_seeker_jobs WHERE user_id=$1`, [id]).catch(() => {});
      await pool.query(`DELETE FROM career_seeker_goals WHERE user_id=$1`, [id]).catch(() => {});
      await pool.query(`DELETE FROM career_seeker_profiles WHERE user_id=$1`, [id]).catch(() => {});
      await pool.query(`DELETE FROM users WHERE id=$1`, [id]).catch(() => {});
    }
    // Belt-and-suspenders: purge any stragglers by the @example.com usernames.
    await pool.query(`DELETE FROM users WHERE username = ANY($1)`, [[EMAIL_A, EMAIL_B]]).catch(() => {});
  } catch (e: any) { console.error('cleanup error:', e?.message ?? e); }
}

async function registerStudent(email: string): Promise<{ session: ReturnType<typeof makeSession>; userId: string }> {
  const session = makeSession();
  // 0 — bootstrap CSRF cookie/token for this session.
  const csrf = await session.api('GET', '/api/csrf-token');
  if (csrf.status !== 200 || !session.jar.get('mx.csrf')) {
    throw new Error(`CSRF bootstrap failed for ${email}: status ${csrf.status}`);
  }
  // 1 — register (auto-logs in → sets mx.sid session cookie). job_seeker is the
  //     student/fresher persona these career-seeker surfaces exist for.
  let r = await session.api('POST', '/api/register', {
    username: email, email, password: PW, fullName: 'E2E 277 Student', role: 'job_seeker',
  });
  // /api/register is protected by the always-on auth rate limiter (a real security
  // control with NO test bypass). When the register window is already partly consumed
  // (e.g. by earlier validation steps on the same IP) a registration can come back 429;
  // honour the server's retry_after and retry rather than failing the privacy check on
  // a throttle (a 429 is never a privacy leak). The limiter stays fully intact.
  for (let attempt = 0; attempt < 5 && r.status === 429; attempt += 1) {
    const waitS = Math.min(70, Math.max(2, Number(r.json?.retry_after_seconds ?? 15) + 1));
    console.log(`     … register for ${email} rate-limited (429); waiting ${waitS}s then retrying (attempt ${attempt + 1}/5)`);
    await new Promise((res) => setTimeout(res, waitS * 1000));
    r = await session.api('POST', '/api/register', {
      username: email, email, password: PW, fullName: 'E2E 277 Student', role: 'job_seeker',
    });
  }
  const userId = String(r.json?.id ?? '');
  if (r.status !== 200 || !userId) throw new Error(`register failed for ${email}: ${r.status} ${JSON.stringify(r.json)}`);
  if (!session.jar.get('mx.sid')) throw new Error(`no session cookie after register for ${email}`);
  // 2 — create the seeker's career profile row.
  const init = await session.api('POST', '/api/cv/init-profile', {});
  if (init.status !== 200) throw new Error(`init-profile failed for ${email}: ${init.status} ${JSON.stringify(init.json)}`);
  return { session, userId };
}

async function readProfileFromDb(userId: string): Promise<any> {
  const r = await pool.query(`SELECT data FROM career_seeker_profiles WHERE user_id=$1`, [userId]);
  return r.rows[0]?.data ?? null;
}
async function readJobsFromDb(userId: string): Promise<any[]> {
  const r = await pool.query(`SELECT id, data, status FROM career_seeker_jobs WHERE user_id=$1 ORDER BY id`, [userId]);
  return r.rows;
}
async function readGoalsFromDb(userId: string): Promise<any[]> {
  const r = await pool.query(`SELECT id, data, completed FROM career_seeker_goals WHERE user_id=$1 ORDER BY id`, [userId]);
  return r.rows;
}

async function main() {
  console.log('TASK #277 — student-vs-student resume/profile/jobs/goals privacy E2E (live HTTP path)');
  console.log(`base=${BASE}  run=${RUN}\n`);
  await cleanup();

  // Pre-flight: confirm the live HTTP stack is reachable.
  step('Pre-flight: Backend API reachable');
  {
    const probe = await makeSession().api('GET', '/api/csrf-token');
    assert(probe.status === 200, `GET /api/csrf-token reachable (status ${probe.status})`);
    if (probe.status !== 200) {
      console.error('\n     ✗ FAIL: Backend API not reachable on :8080. Start the workflow and re-run.');
      return;
    }
  }

  // Register two independent student sessions.
  step('Register two real student sessions (A and B, both @example.com)');
  const A = await registerStudent(EMAIL_A); userIdA = A.userId;
  const B = await registerStudent(EMAIL_B); userIdB = B.userId;
  assert(!!userIdA && !!userIdB && userIdA !== userIdB, `two distinct users created (A=${userIdA.slice(0, 8)}…, B=${userIdB.slice(0, 8)}…)`);

  // ── Student A populates its OWN resume/profile, a saved job, and a goal. ────
  const A_PROFILE = {
    personal: { name: 'Aisha A', email: EMAIL_A, phone: '+10000000001', linkedin: 'https://linkedin.com/in/aisha-a' },
    summary: 'A-student resume summary — confidential to A.',
    skills: { technical: ['python', 'sql'], soft: ['communication'], tools: [], languages: [] },
    education: [{ school: 'A University', degree: 'BSc' }],
    experience: [{ company: 'A-Intern Co', role: 'Intern' }],
    projects: [{ title: 'A Capstone' }],
  };

  step('Student A saves its resume/profile (POST /api/cv/save-profile as A)');
  {
    const r = await A.session.api('POST', '/api/cv/save-profile', { profile: A_PROFILE });
    assert(r.status === 200 && r.json?.success === true, `save-profile as A succeeded (status ${r.status})`);
    assert(r.json?.profile?.summary === A_PROFILE.summary, `A's summary persisted`);
  }

  let aJobId = '';
  step('Student A saves a job (POST /api/cv/jobs as A)');
  {
    const r = await A.session.api('POST', '/api/cv/jobs', { title: 'A Dream Role', company: 'A-Corp', status: 'Saved' });
    aJobId = String(r.json?.job?._id ?? '');
    assert(r.status === 200 && !!aJobId, `A created a job (id=${aJobId.slice(0, 8)}…)`);
    assert(r.json?.job?.company === 'A-Corp', `A's job is A-Corp`);
  }

  let aGoalId = '';
  step('Student A saves a goal (POST /api/cv/goals as A)');
  {
    const r = await A.session.api('POST', '/api/cv/goals', { title: 'A learns system design', completed: false });
    aGoalId = String(r.json?.goal?._id ?? '');
    assert(r.status === 200 && !!aGoalId, `A created a goal (id=${aGoalId.slice(0, 8)}…)`);
  }

  // Snapshot A's rows straight from Postgres as the integrity baseline.
  const aProfileBefore = await readProfileFromDb(userIdA);
  const aJobsBefore = await readJobsFromDb(userIdA);
  const aGoalsBefore = await readGoalsFromDb(userIdA);
  assert(aProfileBefore?.summary === A_PROFILE.summary, `DB baseline: A's profile holds A's summary`);
  assert(aJobsBefore.length === 1 && aJobsBefore[0].data?.company === 'A-Corp', `DB baseline: A has 1 job (A-Corp)`);
  assert(aGoalsBefore.length === 1, `DB baseline: A has 1 goal`);

  // ── POSITIVE CONTROL: A's OWN write must actually exist AND be readable by A ──
  //    over the live path BEFORE we conclude "no cross-user leak". If the store is
  //    empty there is nothing to cross-read, so every IDOR assertion below would
  //    pass VACUOUSLY — fail LOUDLY ("no data exercised") instead of silently passing.
  step('Positive control: A actually wrote data and can read its OWN profile/jobs/goals back (else "no data exercised")');
  {
    const rowsExercised = (aProfileBefore ? 1 : 0) + aJobsBefore.length + aGoalsBefore.length;
    if (rowsExercised === 0) {
      failures += 1;
      console.error('     ✗ FAIL: no data exercised — A\'s profile/jobs/goals store is EMPTY, so the privacy assertions below would pass vacuously. Aborting.');
      return;
    }
    assert(!!aProfileBefore, `positive control: A's profile row exists (write was exercised)`);
    assert(aJobsBefore.length > 0, `positive control: A has ≥1 job row (write was exercised)`);
    assert(aGoalsBefore.length > 0, `positive control: A has ≥1 goal row (write was exercised)`);
    // Read back over the LIVE HTTP path as A — confirms A's own write is visible to A.
    const rp = await A.session.api('GET', `/api/cv/profile/${userIdA}`);
    assert(rp.status === 200 && rp.json?.profile?.summary === A_PROFILE.summary, `positive control: A reads its OWN profile back over HTTP`);
    const rj = await A.session.api('GET', `/api/cv/jobs/${userIdA}`);
    assert(rj.status === 200 && (rj.json?.jobs?.length ?? 0) > 0, `positive control: A reads its OWN job(s) back over HTTP`);
    const rg = await A.session.api('GET', `/api/cv/goals/${userIdA}`);
    assert(rg.status === 200 && (rg.json?.goals?.length ?? 0) > 0, `positive control: A reads its OWN goal(s) back over HTTP`);
  }

  // ── ATTACK 1: B tries to READ A's profile via the :userId param route. ─────
  step("Student B reads A's profile (GET /api/cv/profile/:A as B) — must be 403, never A's data");
  {
    const r = await B.session.api('GET', `/api/cv/profile/${userIdA}`);
    assert(r.status === 403, `GET /api/cv/profile/:A as B → 403 Forbidden (got ${r.status})`);
    assert(!JSON.stringify(r.json ?? {}).includes(A_PROFILE.summary), `A's summary did NOT leak to B`);
  }

  // ── ATTACK 2: B tries to OVERWRITE A's profile via PUT :userId param route. ─
  step("Student B overwrites A's profile (PUT /api/cv/profile/:A as B) — must be 403");
  {
    const r = await B.session.api('PUT', `/api/cv/profile/${userIdA}`, {
      summary: 'HACKED BY B', personal: { name: 'B overwrite' },
    });
    assert(r.status === 403, `PUT /api/cv/profile/:A as B → 403 Forbidden (got ${r.status})`);
  }

  // ── ATTACK 3: B saves a profile via the self-only POST while smuggling A's id. ─
  step("Student B saves a profile with A's id smuggled in body (POST /api/cv/save-profile as B) — must land on B's row");
  {
    const r = await B.session.api('POST', '/api/cv/save-profile', {
      id: userIdA, user_id: userIdA, userId: userIdA,
      profile: { summary: 'B-student summary', personal: { name: 'Bilal B', email: EMAIL_B } },
    });
    assert(r.status === 200 && r.json?.success === true, `save-profile as B succeeded (status ${r.status})`);
    assert(r.json?.profile?.summary === 'B-student summary', `B's save returned B's own data`);
  }

  // ── ATTACK 4: B inits a profile while smuggling A's id (non-destructive anyway). ─
  step("Student B init-profile with A's id smuggled in body (POST /api/cv/init-profile as B) — must not touch A");
  {
    const r = await B.session.api('POST', '/api/cv/init-profile', { id: userIdA, name: 'B overwrite name', email: EMAIL_B });
    assert(r.status === 200, `init-profile as B succeeded (status ${r.status})`);
  }

  // ── ATTACK 5: B tries to READ A's jobs / goals via the :userId param routes. ─
  step("Student B reads A's jobs + goals (GET /api/cv/jobs|goals/:A as B) — must be 403");
  {
    const rj = await B.session.api('GET', `/api/cv/jobs/${userIdA}`);
    assert(rj.status === 403, `GET /api/cv/jobs/:A as B → 403 (got ${rj.status})`);
    assert(!JSON.stringify(rj.json ?? {}).includes('A-Corp'), `A's job did NOT leak to B`);
    const rg = await B.session.api('GET', `/api/cv/goals/${userIdA}`);
    assert(rg.status === 403, `GET /api/cv/goals/:A as B → 403 (got ${rg.status})`);
  }

  // ── ATTACK 6: B tries to MUTATE A's specific job / goal rows by id. ─────────
  step("Student B mutates A's job + goal by id (PUT /api/cv/jobs|goals/:id as B) — must be 404, A's rows untouched");
  {
    const rj = await B.session.api('PUT', `/api/cv/jobs/${aJobId}`, { company: 'HACKED-Corp', status: 'Rejected' });
    assert(rj.status === 404, `PUT /api/cv/jobs/:aJobId as B → 404 (scoped to B's rows; got ${rj.status})`);
    const rg = await B.session.api('PUT', `/api/cv/goals/${aGoalId}`, { title: 'HACKED goal', completed: true });
    assert(rg.status === 404, `PUT /api/cv/goals/:aGoalId as B → 404 (scoped to B's rows; got ${rg.status})`);
    const rjd = await B.session.api('DELETE', `/api/cv/jobs/${aJobId}`);
    assert(rjd.status === 200, `DELETE /api/cv/jobs/:aJobId as B returns 200 but is scoped (no-op on A's row)`);
  }

  // ── INTEGRITY: A's rows are byte-for-byte unchanged after every B attack. ───
  step("Verify DIRECTLY against Postgres: A's profile / job / goal rows are UNCHANGED");
  {
    const aProfileAfter = await readProfileFromDb(userIdA);
    assert(JSON.stringify(aProfileAfter) === JSON.stringify(aProfileBefore), `A's profile row is identical to the pre-attack baseline`);
    assert(aProfileAfter?.summary === A_PROFILE.summary, `A's summary is still A's (not "HACKED BY B"/"B-student summary")`);

    const aJobsAfter = await readJobsFromDb(userIdA);
    assert(aJobsAfter.length === 1, `A still has exactly 1 job (B's DELETE did not remove it)`);
    assert(aJobsAfter[0]?.data?.company === 'A-Corp', `A's job is still A-Corp (not HACKED-Corp)`);
    assert(aJobsAfter[0]?.status !== 'Rejected', `A's job status was not flipped by B`);

    const aGoalsAfter = await readGoalsFromDb(userIdA);
    assert(aGoalsAfter.length === 1, `A still has exactly 1 goal`);
    assert(aGoalsAfter[0]?.data?.title !== 'HACKED goal' && aGoalsAfter[0]?.completed === false, `A's goal is unchanged (not "HACKED goal"/completed)`);

    // And B's OWN profile row got B's data — the self-only write landed where it should.
    const bProfileAfter = await readProfileFromDb(userIdB);
    assert(bProfileAfter?.summary === 'B-student summary', `B's own profile row holds B's data`);
  }

  // ── A re-reads everything over the live path and still sees its data. ───────
  step('Student A re-reads its profile / jobs / goals (GET as A) — still its original data');
  {
    const rp = await A.session.api('GET', `/api/cv/profile/${userIdA}`);
    assert(rp.status === 200 && rp.json?.profile?.summary === A_PROFILE.summary, `A still reads its own summary`);
    const rj = await A.session.api('GET', `/api/cv/jobs/${userIdA}`);
    assert(rj.status === 200 && rj.json?.jobs?.length === 1 && rj.json.jobs[0]?.company === 'A-Corp', `A still reads its A-Corp job`);
    const rg = await A.session.api('GET', `/api/cv/goals/${userIdA}`);
    assert(rg.status === 200 && rg.json?.goals?.length === 1, `A still reads its goal`);
  }

  console.log(`\n${failures === 0
    ? '✅ ALL CHECKS PASSED — over the live HTTP stack, student B cannot read or overwrite student A\'s resume/profile, jobs or goals even when supplying A\'s id'
    : `❌ ${failures} CHECK(S) FAILED`}`);
}

main()
  .catch((e) => { console.error('E2E ERROR:', e); failures += 1; })
  .finally(async () => {
    await cleanup();
    await pool.end();
    process.exit(failures === 0 ? 0 : 1);
  });
