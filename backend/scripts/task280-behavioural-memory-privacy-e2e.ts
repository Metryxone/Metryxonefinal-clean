/**
 * TASK #280 — Make sure students can't peek at each other's behavioural memory (LIVE HTTP E2E).
 *
 * Tasks #277 and #279 added live two-student IDOR regressions for the career-seeker surfaces
 * that write `career_seeker_profiles` (resume/profile/jobs/goals and the Leadership/Executive
 * Studio trackers under `data.studio`). The DB-backed behavioural-memory surface
 * (`backend/routes/behavioural-memory.ts`) is ANOTHER per-student store. It resolves the subject
 * server-side via `resolveEffectiveUserId` (path param on GET, body field on POST) and had no live
 * two-session regression, so an auth-middleware or proxy-rewrite regression upstream of it would
 * go uncaught for the behavioural-memory rows. This harness closes that gap.
 *
 * Surfaces covered (all under /api/career/, all requireAuth, NOT flag-gated):
 *   - POST /api/career/behavioural-memory/snapshot   (writes career_memory_snapshots
 *       + capadex_behavioural_memory; subject from body userId/user_id, default = principal)
 *   - GET  /api/career/behavioural-memory/:userId    (reads snapshots + growth; subject = :userId)
 *   - GET  /api/career/behavior-profile/:userId      (read-only behaviour profile; subject = :userId)
 *   - GET  /api/career/behavior-graph/:userId        (read-only behaviour graph; subject = :userId)
 *   - GET  /api/career/next-actions/:userId          (read-only next actions; subject = :userId)
 *
 * It drives the REAL running Backend API server (localhost:8080) exactly as a browser would —
 * through the live session-auth + CSRF middleware + real Postgres — with TWO independent student
 * sessions (A and B), and proves at the live layer that:
 *
 *   1. Student A writes a behavioural-memory snapshot into A's OWN history.
 *   2. Student B (authenticated as B), even when supplying A's id in the GET path or smuggling A's
 *      id into the POST body (id/user_id/userId), can NEITHER read A's behavioural memory NOR write
 *      into A's history — every cross-user attempt is rejected 403 forbidden_cross_user. Verified
 *      DIRECTLY against Postgres: A's snapshot/time-series rows stay byte-for-byte unchanged.
 *   3. Student B's own GET returns B's data (or honest-empty), never A's (no cross-read).
 *   4. Student A re-reads its behavioural memory and still sees its original snapshot.
 *
 * Honesty notes:
 *   - These routes are NOT flag-gated (registered unconditionally in routes.ts), so there is no
 *     feature flag to set. The harness still proves the routes are LIVE (a 404/503 fails it loudly
 *     rather than silently passing). The "exits non-zero if a required flag is OFF" requirement is
 *     therefore satisfied vacuously — there is no required flag — but route reachability IS asserted.
 *   - Both accounts use @example.com so they are purgeable from the shared dev/prod DB; the harness
 *     self-cleans (behavioural rows + profiles + users) on exit even on failure.
 *   - No engine output is fabricated: the snapshot payload is synthetic; DB assertions read the live
 *     rows the live routes wrote.
 *
 * Run:  cd backend && npx tsx scripts/task280-behavioural-memory-privacy-e2e.ts
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
const PW = `E2eStud!${RUN}aA9`; // satisfies complexity policy (upper/lower/digit/symbol/len)
// Both demo students use @example.com so they are purgeable from the shared DB.
const EMAIL_A = `e2e280.studentA.${RUN}@example.com`;
const EMAIL_B = `e2e280.studentB.${RUN}@example.com`;

let userIdA = '';
let userIdB = '';

async function cleanup() {
  try {
    for (const id of [userIdA, userIdB]) {
      if (!id) continue;
      await pool.query(`DELETE FROM capadex_behavioural_memory WHERE user_id=$1`, [id]).catch(() => {});
      await pool.query(`DELETE FROM career_memory_snapshots WHERE user_id=$1`, [id]).catch(() => {});
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
    username: email, email, password: PW, fullName: 'E2E 280 Student', role: 'job_seeker',
  });
  const userId = String(r.json?.id ?? '');
  if (r.status !== 200 || !userId) throw new Error(`register failed for ${email}: ${r.status} ${JSON.stringify(r.json)}`);
  if (!session.jar.get('mx.sid')) throw new Error(`no session cookie after register for ${email}`);
  return { session, userId };
}

// Read A's behavioural-memory footprint straight from Postgres as the integrity baseline.
async function readBehaviouralFootprint(userId: string): Promise<{ snapshots: number; series: number; firstStage: string | null }> {
  const snaps = await pool.query(`SELECT current_stage FROM career_memory_snapshots WHERE user_id=$1 ORDER BY snapshot_at ASC`, [userId]);
  const series = await pool.query(`SELECT COUNT(*)::int AS n FROM capadex_behavioural_memory WHERE user_id=$1`, [userId]);
  return {
    snapshots: snaps.rowCount ?? 0,
    series: series.rows[0]?.n ?? 0,
    firstStage: snaps.rows[0]?.current_stage ?? null,
  };
}

async function main() {
  console.log('TASK #280 — student-vs-student behavioural-memory privacy E2E (live HTTP path)');
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

  // ── Route-liveness honesty: behavioural-memory is NOT flag-gated. Prove the ──
  //    route is LIVE (a 404/503 would mean the surface vanished — fail loudly,
  //    do NOT silently pass). A's own read should be 200.
  step('Confirm behavioural-memory routes are LIVE (own read must not 404/503)');
  {
    const probe = await A.session.api('GET', `/api/career/behavioural-memory/${encodeURIComponent(userIdA)}`);
    if (probe.status === 404 || probe.status === 503) {
      failures += 1;
      console.error(`     ✗ FAIL: GET /api/career/behavioural-memory/:userId → ${probe.status} (route not live).`);
      return;
    }
    assert(probe.status === 200 && probe.json?.ok === true, `behavioural-memory read route is live for self (status ${probe.status})`);
  }

  // ── Student A writes its OWN behavioural-memory snapshot. ───────────────────
  const A_SNAPSHOT = {
    ei_score: 71,
    current_stage: 'A-confidential-stage',
    target_role: 'A Confidential Role',
    transition_probability: 0.42,
    core_bottleneck: 'A-confidential-bottleneck',
    market_readiness: 63,
    interview_readiness: 58,
    signals: [
      { key: 'a_signal_focus', label: 'A confidential focus signal', strength: 0.66, confidence: 0.8, status: 'active' },
    ],
    patterns: [
      { key: 'a_pattern_resilience', label: 'A confidential resilience pattern', confidence: 0.7, status: 'active' },
    ],
    interventions: [
      { key: 'a_intervention_coach', label: 'A confidential coaching intervention', confidence: 0.6, status: 'suggested' },
    ],
    outcomes: [
      { key: 'a_outcome_offer', label: 'A confidential outcome', strength: 0.5, confidence: 0.5, status: 'projected' },
    ],
  };

  step('Student A saves a behavioural-memory snapshot (POST /snapshot as A)');
  {
    const r = await A.session.api('POST', '/api/career/behavioural-memory/snapshot', A_SNAPSHOT);
    assert(r.status === 201 && r.json?.ok === true, `POST snapshot as A succeeded (status ${r.status})`);
    assert(!!r.json?.snapshot_id, `A received a snapshot_id`);
  }

  // Snapshot A's behavioural footprint straight from Postgres as the integrity baseline.
  const aBefore = await readBehaviouralFootprint(userIdA);
  assert(aBefore.snapshots === 1, `DB baseline: A has exactly 1 snapshot row`);
  assert(aBefore.series === 4, `DB baseline: A has 4 time-series rows (signal/pattern/intervention/outcome)`);
  assert(aBefore.firstStage === 'A-confidential-stage', `DB baseline: A's snapshot holds A's confidential stage`);

  // ── ATTACK 1: B reads A's behavioural memory by putting A's id in the path. ─
  step("Student B reads A's behavioural memory by id (GET /behavioural-memory/:A as B) — must 403, no leak");
  {
    const r = await B.session.api('GET', `/api/career/behavioural-memory/${encodeURIComponent(userIdA)}`);
    assert(r.status === 403, `GET A's behavioural memory as B → 403 (got ${r.status})`);
    assert(r.json?.error === 'forbidden_cross_user', `error is forbidden_cross_user (got ${JSON.stringify(r.json?.error)})`);
    assert(!JSON.stringify(r.json ?? {}).includes('A-confidential'), `A's confidential data did NOT leak in the response body`);
  }

  // ── ATTACK 2: B reads A's behaviour-profile / behaviour-graph / next-actions. ─
  step("Student B reads A's behaviour-profile/graph/next-actions by id — each must 403, no leak");
  for (const surface of ['behavior-profile', 'behavior-graph', 'next-actions']) {
    const r = await B.session.api('GET', `/api/career/${surface}/${encodeURIComponent(userIdA)}`);
    assert(r.status === 403, `GET A's ${surface} as B → 403 (got ${r.status})`);
    assert(r.json?.error === 'forbidden_cross_user', `${surface}: error is forbidden_cross_user`);
  }

  // ── ATTACK 3: B writes a snapshot while smuggling A's id into the body. ─────
  //    Every id alias (id/user_id/userId) carries A's id; the route resolves the
  //    subject from the session principal, so a non-admin cross-user write must be
  //    rejected 403 — it must NOT land on A's row, and must NOT silently land on B's.
  step("Student B writes a snapshot with A's id smuggled in body (POST /snapshot as B) — must 403");
  {
    const r = await B.session.api('POST', '/api/career/behavioural-memory/snapshot', {
      id: userIdA, user_id: userIdA, userId: userIdA,
      ei_score: 1, current_stage: 'B-injected-stage', target_role: 'B Injected Role',
      signals: [{ key: 'b_inject_signal', label: 'B injected signal', strength: 0.99, confidence: 0.99, status: 'active' }],
      patterns: [{ key: 'b_inject_pattern', label: 'B injected pattern', confidence: 0.99, status: 'active' }],
    });
    assert(r.status === 403, `POST snapshot with A's id as B → 403 (got ${r.status})`);
    assert(r.json?.error === 'forbidden_cross_user', `error is forbidden_cross_user (got ${JSON.stringify(r.json?.error)})`);
  }

  // ── INTEGRITY: A's behavioural footprint is byte-for-byte unchanged. ────────
  step("Verify DIRECTLY against Postgres: A's behavioural memory is UNCHANGED after B's attacks");
  {
    const aAfter = await readBehaviouralFootprint(userIdA);
    assert(aAfter.snapshots === aBefore.snapshots, `A still has exactly ${aBefore.snapshots} snapshot row (no injected snapshot)`);
    assert(aAfter.series === aBefore.series, `A still has exactly ${aBefore.series} time-series rows (no injected series)`);
    assert(aAfter.firstStage === 'A-confidential-stage', `A's snapshot stage is still A's (not "B-injected-stage")`);

    const injected = await pool.query(
      `SELECT COUNT(*)::int AS n FROM capadex_behavioural_memory WHERE user_id=$1 AND entry_key LIKE 'b_inject%'`,
      [userIdA],
    );
    assert((injected.rows[0]?.n ?? 0) === 0, `no "b_inject*" time-series rows landed under A's user_id`);
  }

  // ── B's own surfaces return B's data (honest-empty), never A's. ─────────────
  step("Student B reads its OWN behavioural memory (GET /behavioural-memory/:B as B) — B's, never A's");
  {
    const r = await B.session.api('GET', `/api/career/behavioural-memory/${encodeURIComponent(userIdB)}`);
    assert(r.status === 200 && r.json?.ok === true, `GET own behavioural memory as B → 200 (got ${r.status})`);
    assert(r.json?.user_id === userIdB, `response is scoped to B's user_id`);
    assert(r.json?.snapshot_count === 0, `B has 0 snapshots (B never successfully wrote one) — honest-empty`);
    assert(!JSON.stringify(r.json ?? {}).includes('A-confidential'), `A's confidential data did NOT leak into B's own read`);
  }

  // ── A re-reads its behavioural memory over the live path and still sees its data.
  step('Student A re-reads its behavioural memory (GET /behavioural-memory/:A as A) — still its original snapshot');
  {
    const r = await A.session.api('GET', `/api/career/behavioural-memory/${encodeURIComponent(userIdA)}`);
    assert(r.status === 200 && r.json?.ok === true, `GET own behavioural memory as A → 200 (got ${r.status})`);
    assert(r.json?.snapshot_count === 1, `A still has its 1 snapshot`);
    assert(r.json?.snapshots?.[0]?.current_stage === 'A-confidential-stage', `A still reads its own confidential stage`);
  }

  console.log(`\n${failures === 0
    ? '✅ ALL CHECKS PASSED — over the live HTTP stack, student B can neither read nor overwrite student A\'s behavioural memory even when supplying A\'s id'
    : `❌ ${failures} CHECK(S) FAILED`}`);
}

main()
  .catch((e) => { console.error('E2E ERROR:', e); failures += 1; })
  .finally(async () => {
    await cleanup();
    await pool.end();
    process.exit(failures === 0 ? 0 : 1);
  });
