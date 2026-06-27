/**
 * TASK #274 — Block students from overwriting each other's tracker data (LIVE HTTP E2E).
 *
 * Task #272 added a headless regression (`backend/tests/launchpad-dashboard-privacy.test.ts`)
 * proving PUT/GET /api/launchpad-dashboard/tracker keys BOTH the read and the UPDATE on the
 * session principal — but against a STUB pool on a throwaway Express app with a STUB
 * requireAuth. That locks the unit-level guarantee yet never exercises the surface end-to-end
 * with two REAL authenticated sessions over the live HTTP stack (cookies, CSRF, real Postgres).
 *
 * This harness closes that gap. It drives the REAL running Backend API server (localhost:8080)
 * exactly as a browser would — through the live session-auth + CSRF middleware + real DB — with
 * TWO independent student sessions (A and B), and proves the IDOR cannot happen at the live
 * layer (an auth-middleware regression or a proxy rewrite the stub harness cannot see WOULD be
 * caught here):
 *
 *   1. Student A saves campus-drive / project / checklist tracker data
 *      (PUT /api/launchpad-dashboard/tracker) into A's OWN
 *      career_seeker_profiles.data.fresherHub, and reads it back (GET) as A.
 *   2. Student B — authenticated as B — calls GET /tracker while PASSING A's id in the
 *      query AND body. The response subject is B (never A), and B sees B's OWN (empty)
 *      tracker, NOT A's drives.
 *   3. Student B calls PUT /tracker with DIFFERENT data while again passing A's id in the
 *      query AND body. The response subject is B; B's row is overwritten with B's data and
 *      — verified DIRECTLY against Postgres — A's fresherHub is byte-for-byte UNCHANGED.
 *   4. A re-reads its tracker (GET as A) and still sees A's original data: B never read or
 *      mutated A's row even when supplying A's id.
 *
 * Honesty notes:
 *   - Both accounts use @example.com so they are purgeable from the shared dev/prod DB; the
 *     harness self-cleans (profiles + users) on exit even on failure.
 *   - Requires the launchpadDashboard flag ON in the running server (FF_LAUNCHPAD_DASHBOARD=1).
 *     If the route 503s, the harness reports the flag is OFF and exits non-zero with guidance
 *     (it never fabricates a pass).
 *   - No engine output is fabricated: the tracker payloads are synthetic; the DB assertions
 *     read the live rows the live route wrote.
 *
 * Run:  cd backend && FF_LAUNCHPAD_DASHBOARD=1 npx tsx scripts/task274-tracker-privacy-e2e.ts
 * (The Backend API workflow must be running on :8080 with FF_LAUNCHPAD_DASHBOARD=1 so the
 *  /tracker routes are enabled.)
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
const PW = `E2eTrack!${RUN}aA9`; // satisfies complexity policy (upper/lower/digit/symbol/len)
// Both demo students use @example.com so they are purgeable from the shared DB.
const EMAIL_A = `e2e274.studentA.${RUN}@example.com`;
const EMAIL_B = `e2e274.studentB.${RUN}@example.com`;

let userIdA = '';
let userIdB = '';

async function cleanup() {
  try {
    for (const id of [userIdA, userIdB]) {
      if (!id) continue;
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
  //     fresher/student persona the launchpad tracker exists for.
  const r = await session.api('POST', '/api/register', {
    username: email, email, password: PW, fullName: 'E2E 274 Student', role: 'job_seeker',
  });
  const userId = String(r.json?.id ?? '');
  if (r.status !== 200 || !userId) throw new Error(`register failed for ${email}: ${r.status} ${JSON.stringify(r.json)}`);
  if (!session.jar.get('mx.sid')) throw new Error(`no session cookie after register for ${email}`);
  // 2 — create the seeker's career profile row (PUT /tracker 409s without one).
  const init = await session.api('POST', '/api/cv/init-profile', {});
  if (init.status !== 200) throw new Error(`init-profile failed for ${email}: ${init.status} ${JSON.stringify(init.json)}`);
  return { session, userId };
}

async function readFresherHubFromDb(userId: string): Promise<any> {
  const r = await pool.query(`SELECT data FROM career_seeker_profiles WHERE user_id=$1`, [userId]);
  const data = r.rows[0]?.data ?? null;
  return (data && typeof data === 'object') ? (data.fresherHub ?? null) : null;
}

async function main() {
  console.log('TASK #274 — student-vs-student tracker privacy E2E (live HTTP path)');
  console.log(`base=${BASE}  run=${RUN}\n`);
  await cleanup();

  // Pre-flight: confirm the flag is ON (route enabled) BEFORE registering anything.
  step('Pre-flight: launchpadDashboard flag must be ON');
  {
    const probe = await makeSession().api('GET', '/api/launchpad-dashboard/enabled');
    assert(probe.status === 200, `GET /enabled reachable (status ${probe.status})`);
    if (probe.json?.enabled !== true) {
      console.error('\n     ✗ FAIL: launchpadDashboard flag is OFF — the /tracker route 503s.');
      console.error('       Re-run with the Backend API workflow started with FF_LAUNCHPAD_DASHBOARD=1.');
      failures += 1;
      return;
    }
    assert(true, 'launchpadDashboard flag is ON (tracker route enabled)');
  }

  // Register two independent student sessions.
  step('Register two real student sessions (A and B, both @example.com)');
  const A = await registerStudent(EMAIL_A); userIdA = A.userId;
  const B = await registerStudent(EMAIL_B); userIdB = B.userId;
  assert(!!userIdA && !!userIdB && userIdA !== userIdB, `two distinct users created (A=${userIdA.slice(0, 8)}…, B=${userIdB.slice(0, 8)}…)`);

  // Student A's own tracker payload — drives / projects / checklist.
  const A_DATA = {
    drives: [{ company: 'A-Corp', role: 'SDE', stage: 'applied' }, { company: 'A-Labs', role: 'Analyst', stage: 'shortlisted' }],
    projects: [{ title: 'A-Project Portfolio', link: 'https://example.com/a' }],
    checklist: { resume: true, linkedin: true },
  };

  step('Student A saves tracker data (PUT /tracker as A)');
  {
    const r = await A.session.api('PUT', '/api/launchpad-dashboard/tracker', A_DATA);
    assert(r.status === 200 && r.json?.ok === true, `PUT /tracker as A succeeded (status ${r.status})`);
    assert(r.json?.subject === userIdA, `saved subject is A's own id (got ${r.json?.subject})`);
    assert(r.json?.saved?.drives === 2 && r.json?.saved?.projects === 1, `A persisted 2 drives + 1 project (${JSON.stringify(r.json?.saved)})`);
  }

  step('Student A reads its tracker back (GET /tracker as A)');
  {
    const r = await A.session.api('GET', '/api/launchpad-dashboard/tracker');
    assert(r.status === 200 && r.json?.subject === userIdA, `GET /tracker as A → subject A (status ${r.status})`);
    assert(Array.isArray(r.json?.drives) && r.json.drives.length === 2, `A sees its 2 drives`);
    assert(r.json?.drives?.[0]?.company === 'A-Corp', `A's first drive is A-Corp`);
  }

  // Snapshot A's row straight from Postgres as the integrity baseline.
  const aHubBefore = await readFresherHubFromDb(userIdA);
  assert(Array.isArray(aHubBefore?.drives) && aHubBefore.drives.length === 2, `DB baseline: A's fresherHub has 2 drives`);

  step("Student B reads with A's id in query AND body (GET /tracker as B) — must NOT see A's data");
  {
    const r = await B.session.api(
      'GET',
      `/api/launchpad-dashboard/tracker?id=${userIdA}&user_id=${userIdA}&subject=${userIdA}`,
    );
    assert(r.status === 200 && r.json?.ok === true, `GET /tracker as B succeeded (status ${r.status})`);
    assert(r.json?.subject === userIdB, `subject is B's OWN id, NOT A's (got ${r.json?.subject})`);
    assert(r.json?.subject !== userIdA, `B did NOT receive A's subject`);
    // B's tracker is empty (B never saved) — and crucially does NOT contain A's drives.
    const drives = Array.isArray(r.json?.drives) ? r.json.drives : [];
    assert(drives.length === 0, `B sees its OWN empty tracker (0 drives), NOT A's (got ${drives.length})`);
    assert(!drives.some((d: any) => d?.company === 'A-Corp'), `A's "A-Corp" drive did NOT leak to B`);
  }

  // Student B's DIFFERENT tracker payload (the would-be overwrite).
  const B_DATA = {
    drives: [{ company: 'B-Corp', role: 'PM', stage: 'applied' }],
    projects: [{ title: 'B-Project', link: 'https://example.com/b' }],
    checklist: { resume: false },
  };

  step("Student B writes with A's id in query AND body (PUT /tracker as B) — must NOT touch A's row");
  {
    const r = await B.session.api(
      'PUT',
      `/api/launchpad-dashboard/tracker?id=${userIdA}&user_id=${userIdA}&subject=${userIdA}`,
      { ...B_DATA, id: userIdA, user_id: userIdA, subject: userIdA },
    );
    assert(r.status === 200 && r.json?.ok === true, `PUT /tracker as B succeeded (status ${r.status})`);
    assert(r.json?.subject === userIdB, `write subject is B's OWN id, NOT A's (got ${r.json?.subject})`);
    assert(r.json?.subject !== userIdA, `B's write did NOT target A's subject`);
  }

  step('Verify DIRECTLY against Postgres: A\'s row is byte-for-byte UNCHANGED');
  {
    const aHubAfter = await readFresherHubFromDb(userIdA);
    assert(JSON.stringify(aHubAfter) === JSON.stringify(aHubBefore), `A's fresherHub is identical to the pre-attack baseline`);
    assert(Array.isArray(aHubAfter?.drives) && aHubAfter.drives.length === 2, `A still has its 2 drives`);
    assert(aHubAfter?.drives?.[0]?.company === 'A-Corp', `A's drive is still A-Corp (NOT overwritten with B-Corp)`);
    assert(!aHubAfter?.drives?.some((d: any) => d?.company === 'B-Corp'), `B's "B-Corp" never reached A's row`);

    // And B's OWN row got B's data — the write landed where it should.
    const bHubAfter = await readFresherHubFromDb(userIdB);
    assert(bHubAfter?.drives?.[0]?.company === 'B-Corp', `B's own row holds B's data (B-Corp)`);
    assert(bHubAfter?.drives?.length === 1, `B's own row has exactly B's 1 drive`);
  }

  step('Student A re-reads its tracker (GET /tracker as A) — still its original data');
  {
    const r = await A.session.api('GET', '/api/launchpad-dashboard/tracker');
    assert(r.status === 200 && r.json?.subject === userIdA, `GET /tracker as A → subject A (status ${r.status})`);
    assert(r.json?.drives?.length === 2 && r.json?.drives?.[0]?.company === 'A-Corp', `A still sees its original 2 drives (A-Corp first)`);
    assert(!r.json?.drives?.some((d: any) => d?.company === 'B-Corp'), `B's attempted overwrite is invisible to A`);
  }

  console.log(`\n${failures === 0
    ? '✅ ALL CHECKS PASSED — over the live HTTP stack, student B cannot read or overwrite student A\'s tracker even when supplying A\'s id'
    : `❌ ${failures} CHECK(S) FAILED`}`);
}

main()
  .catch((e) => { console.error('E2E ERROR:', e); failures += 1; })
  .finally(async () => {
    await cleanup();
    await pool.end();
    process.exit(failures === 0 ? 0 : 1);
  });
