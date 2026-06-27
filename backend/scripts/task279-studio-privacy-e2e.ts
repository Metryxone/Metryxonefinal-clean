/**
 * TASK #279 — Keep students' Leadership/Executive Studio trackers private (LIVE HTTP E2E).
 *
 * Task #277 added a live two-student IDOR e2e for the resume/profile, saved jobs and goals
 * surfaces that write `career_seeker_profiles`. But the SAME row is ALSO written by the
 * Leadership/Executive Studio routes under `data.studio`:
 *
 *   - GET /api/career/studio-data   (read the studio trackers; subject = sessionUser(req))
 *   - PUT /api/career/studio-data   (deep-merge team/stakeholders/priorities/board)
 *
 * Those routes resolve the subject server-side (the session principal — there is NO
 * client-supplied id param), and they are flag-gated (`careerLaunchpad`). They had no
 * live two-session regression, so an auth-middleware regression upstream of them would go
 * uncaught for the studio trackers. This harness closes that gap.
 *
 * It drives the REAL running Backend API server (localhost:8080) exactly as a browser would —
 * through the live session-auth + CSRF middleware + real Postgres — with TWO independent
 * student sessions (A and B), and proves at the live layer that:
 *
 *   1. Student A saves studio trackers (leadership team/stakeholders + executive
 *      priorities/board) into A's OWN row under data.studio.
 *   2. Student B (authenticated as B), even when smuggling A's id into the PUT body
 *      (id/user_id/userId), can only write B's OWN row — never A's. Verified DIRECTLY
 *      against Postgres: A's data.studio stays byte-for-byte unchanged while B's own row
 *      receives B's studio data.
 *   3. Student B's GET /api/career/studio-data returns B's data, never A's (no cross-read).
 *   4. Student A re-reads its studio trackers and still sees its original data.
 *
 * Honesty notes:
 *   - These routes are flag-gated (careerLaunchpad). The harness needs FF_CAREER_LAUNCHPAD=1
 *     on the live server (set in .replit [env]). If the routes 503 (flag OFF) the harness
 *     reports it honestly and exits NON-ZERO — it does not silently pass.
 *   - Both accounts use @example.com so they are purgeable from the shared dev/prod DB; the
 *     harness self-cleans (profiles + users) on exit even on failure.
 *   - No engine output is fabricated: payloads are synthetic; DB assertions read the live
 *     rows the live routes wrote.
 *
 * Run:  cd backend && npx tsx scripts/task279-studio-privacy-e2e.ts
 * (The Backend API workflow must be running on :8080 with FF_CAREER_LAUNCHPAD=1.)
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
const PW = `E2eStud!${RUN}aA9`; // satisfies complexity policy (upper/lower/digit/symbol/len)
// Both demo students use @example.com so they are purgeable from the shared DB.
const EMAIL_A = `e2e279.studentA.${RUN}@example.com`;
const EMAIL_B = `e2e279.studentB.${RUN}@example.com`;

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
  // 1 — register (auto-logs in → sets mx.sid session cookie).
  const r = await session.api('POST', '/api/register', {
    username: email, email, password: PW, fullName: 'E2E 279 Student', role: 'job_seeker',
  });
  const userId = String(r.json?.id ?? '');
  if (r.status !== 200 || !userId) throw new Error(`register failed for ${email}: ${r.status} ${JSON.stringify(r.json)}`);
  if (!session.jar.get('mx.sid')) throw new Error(`no session cookie after register for ${email}`);
  // 2 — create the seeker's career profile row (the studio tracker lives under data.studio).
  const init = await session.api('POST', '/api/cv/init-profile', {});
  if (init.status !== 200) throw new Error(`init-profile failed for ${email}: ${init.status} ${JSON.stringify(init.json)}`);
  return { session, userId };
}

async function readStudioFromDb(userId: string): Promise<any> {
  const r = await pool.query(`SELECT data FROM career_seeker_profiles WHERE user_id=$1`, [userId]);
  return r.rows[0]?.data?.studio ?? null;
}

async function main() {
  console.log('TASK #279 — student-vs-student Leadership/Executive Studio tracker privacy E2E (live HTTP path)');
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

  // ── Flag-gate honesty: the studio routes are careerLaunchpad-gated. If they ──
  //    503 the flag is OFF — report honestly and fail (do NOT silently pass).
  step('Confirm careerLaunchpad flag is ON (studio routes must not 503)');
  {
    const probe = await A.session.api('GET', '/api/career/studio-data');
    if (probe.status === 503) {
      failures += 1;
      console.error('     ✗ FAIL: GET /api/career/studio-data → 503 (careerLaunchpad flag OFF).');
      console.error('       Set FF_CAREER_LAUNCHPAD=1 on the Backend API workflow and re-run.');
      return;
    }
    assert(probe.status === 200 && probe.json?.enabled === true, `studio-data route is live (status ${probe.status}, enabled=${probe.json?.enabled})`);
  }

  // ── Student A populates its OWN studio trackers. ───────────────────────────
  const A_STUDIO = {
    leadership: {
      team: [
        { name: 'Aisha Report', role: 'Senior Engineer', focus: 'A-confidential delivery focus', status: 'Thriving' },
      ],
      stakeholders: [
        { name: 'A Stakeholder', relationship: 'Sponsor', influence: 'High', alignment: 'Aligned' },
      ],
    },
    executive: {
      priorities: [
        { title: 'A Strategic Priority', objective: 'A-confidential objective', horizon: 'This Year', health: 'On Track', progress: 42 },
      ],
      board: [
        { name: 'A Board Member', role: 'Chair', type: 'Board Member' },
      ],
    },
  };

  step('Student A saves its studio trackers (PUT /api/career/studio-data as A)');
  {
    const r = await A.session.api('PUT', '/api/career/studio-data', A_STUDIO);
    assert(r.status === 200 && r.json?.success === true, `PUT studio-data as A succeeded (status ${r.status})`);
    assert(r.json?.leadership?.team?.[0]?.name === 'Aisha Report', `A's leadership team persisted`);
    assert(r.json?.executive?.priorities?.[0]?.title === 'A Strategic Priority', `A's executive priorities persisted`);
  }

  // Snapshot A's studio bucket straight from Postgres as the integrity baseline.
  const aStudioBefore = await readStudioFromDb(userIdA);
  assert(aStudioBefore?.leadership?.team?.[0]?.name === 'Aisha Report', `DB baseline: A's data.studio holds A's leadership team`);
  assert(aStudioBefore?.executive?.board?.[0]?.name === 'A Board Member', `DB baseline: A's data.studio holds A's board`);

  // ── ATTACK: B saves studio data while smuggling A's id into the body. ───────
  //    The route resolves the subject from the session principal only, so this
  //    must land on B's OWN row — never A's.
  step("Student B saves studio data with A's id smuggled in body (PUT /api/career/studio-data as B) — must land on B's row");
  {
    const r = await B.session.api('PUT', '/api/career/studio-data', {
      id: userIdA, user_id: userIdA, userId: userIdA,
      leadership: {
        team: [{ name: 'Bilal Report', role: 'B Engineer', focus: 'B focus', status: 'Steady' }],
        stakeholders: [{ name: 'B Stakeholder', relationship: 'Peer', influence: 'Medium', alignment: 'Neutral' }],
      },
      executive: {
        priorities: [{ title: 'B Priority', objective: 'B objective', horizon: 'This Quarter', health: 'At Risk', progress: 10 }],
        board: [{ name: 'B Board Member', role: 'Advisor', type: 'Advisor' }],
      },
    });
    assert(r.status === 200 && r.json?.success === true, `PUT studio-data as B succeeded (status ${r.status})`);
    assert(r.json?.leadership?.team?.[0]?.name === 'Bilal Report', `B's PUT returned B's own data`);
  }

  // ── B reads its studio data over the live path — must be B's, never A's. ────
  step("Student B reads studio data (GET /api/career/studio-data as B) — must be B's, never A's");
  {
    const r = await B.session.api('GET', '/api/career/studio-data');
    assert(r.status === 200, `GET studio-data as B → 200 (got ${r.status})`);
    assert(r.json?.leadership?.team?.[0]?.name === 'Bilal Report', `B reads B's leadership team`);
    assert(!JSON.stringify(r.json ?? {}).includes('Aisha Report'), `A's leadership team did NOT leak to B`);
    assert(!JSON.stringify(r.json ?? {}).includes('A Strategic Priority'), `A's executive priority did NOT leak to B`);
  }

  // ── INTEGRITY: A's data.studio is byte-for-byte unchanged after B's attack. ─
  step("Verify DIRECTLY against Postgres: A's data.studio is UNCHANGED; B's own row got B's data");
  {
    const aStudioAfter = await readStudioFromDb(userIdA);
    assert(JSON.stringify(aStudioAfter) === JSON.stringify(aStudioBefore), `A's data.studio is identical to the pre-attack baseline`);
    assert(aStudioAfter?.leadership?.team?.[0]?.name === 'Aisha Report', `A's leadership team is still A's (not "Bilal Report")`);
    assert(aStudioAfter?.executive?.priorities?.[0]?.title === 'A Strategic Priority', `A's priority is still A's (not "B Priority")`);

    const bStudioAfter = await readStudioFromDb(userIdB);
    assert(bStudioAfter?.leadership?.team?.[0]?.name === 'Bilal Report', `B's own data.studio holds B's data`);
    assert(bStudioAfter?.executive?.board?.[0]?.name === 'B Board Member', `B's own data.studio holds B's board`);
  }

  // ── A re-reads its studio trackers over the live path and still sees its data.
  step('Student A re-reads its studio data (GET /api/career/studio-data as A) — still its original data');
  {
    const r = await A.session.api('GET', '/api/career/studio-data');
    assert(r.status === 200, `GET studio-data as A → 200 (got ${r.status})`);
    assert(r.json?.leadership?.team?.[0]?.name === 'Aisha Report', `A still reads its own leadership team`);
    assert(r.json?.executive?.priorities?.[0]?.title === 'A Strategic Priority', `A still reads its own executive priority`);
  }

  console.log(`\n${failures === 0
    ? '✅ ALL CHECKS PASSED — over the live HTTP stack, student B cannot read or overwrite student A\'s Leadership/Executive Studio trackers even when smuggling A\'s id'
    : `❌ ${failures} CHECK(S) FAILED`}`);
}

main()
  .catch((e) => { console.error('E2E ERROR:', e); failures += 1; })
  .finally(async () => {
    await cleanup();
    await pool.end();
    process.exit(failures === 0 ? 0 : 1);
  });
