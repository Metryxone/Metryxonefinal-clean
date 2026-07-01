/**
 * TASK #342 — Mentor can see and respond to incoming session requests (FULL HTTP PATH).
 *
 * A seeker who books a mentor writes a `mentor_bookings` row (status 'requested'). Before this task
 * there was no surface for the mentor to view/accept/decline it. This harness drives the REAL running
 * Express server (localhost:8080) as a browser would (session-auth + signed double-submit CSRF,
 * mirroring task295) and proves the loop end-to-end behind the `ecosystemCommunity` flag:
 *   READ      — a logged-in mentor GETs /api/ecosystem/mentor/incoming-bookings and sees the pending
 *               request(s) addressed to THEIR mentor_profiles row (is_mentor:true, counts correct).
 *   ACCEPT    — POST /api/ecosystem/mentor-bookings/:id/respond {decision:'accept'} → 200, status
 *               becomes 'confirmed' (persisted).
 *   DECLINE   — a second request declined → 200, status 'declined'.
 *   IDOR      — a DIFFERENT mentor cannot respond to the first mentor's booking → 404 booking_not_found,
 *               and the row's status is UNCHANGED (the guard is real, not an unrelated failure).
 *   SEEKER    — the seeker's existing /api/ecosystem/mentor-bookings reflects the updated status.
 *
 * Honesty notes:
 *   - Requires the live Backend API on :8080 with `ecosystemCommunity` ON (FF_ECOSYSTEM_COMMUNITY=1).
 *     If OFF the route 503s; the harness detects this and aborts loudly rather than passing.
 *   - Every artifact is @example.com / e2e-prefixed and removed on exit (users, mentor_profiles,
 *     mentor_bookings). The harness is ALLOWED to fail (non-zero exit) — no number is tuned.
 *
 * Run: cd backend && FF_ECOSYSTEM_COMMUNITY=1 npx tsx scripts/task342-mentor-incoming-bookings-e2e.ts
 */

import { Pool } from 'pg';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let failures = 0;
let stepNo = 0;
function step(name: string) { stepNo += 1; console.log(`\n[${String(stepNo).padStart(2, '0')}] ${name}`); }
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`     \u2713 ${msg}`);
  else { failures += 1; console.error(`     \u2717 FAIL: ${msg}`); }
}

// ── Per-session cookie jar + CSRF-aware fetch (mirrors the SPA's signed double-submit) ──
function makeClient() {
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
      method, headers,
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
const PW = `E2eMntr!${RUN}aA9`; // satisfies complexity policy (upper/lower/digit/symbol/len)

const MENTOR_A = { user: `e2e342a_${RUN}`, email: `e2e342.mentorA.${RUN}@example.com`, name: 'E2E 342 Mentor A' };
const MENTOR_B = { user: `e2e342b_${RUN}`, email: `e2e342.mentorB.${RUN}@example.com`, name: 'E2E 342 Mentor B' };
const SEEKER = { user: `e2e342s_${RUN}`, email: `e2e342.seeker.${RUN}@example.com`, name: 'E2E 342 Seeker' };

const ids = { mentorAUser: '', mentorBUser: '', seekerUser: '', mentorAProfile: '', mentorBProfile: '' };
const bookingIds: string[] = [];

async function cleanup() {
  try {
    for (const pid of [ids.mentorAProfile, ids.mentorBProfile]) {
      if (pid) {
        await pool.query('DELETE FROM mentor_bookings WHERE mentor_profile_id = $1', [pid]).catch(() => {});
        await pool.query('DELETE FROM mentor_profiles WHERE id = $1', [pid]).catch(() => {});
      }
    }
    if (bookingIds.length) await pool.query('DELETE FROM mentor_bookings WHERE id = ANY($1)', [bookingIds]).catch(() => {});
    for (const uid of [ids.mentorAUser, ids.mentorBUser, ids.seekerUser]) {
      if (uid) await pool.query('DELETE FROM users WHERE id = $1', [uid]).catch(() => {});
    }
  } catch (e: any) { console.error('cleanup error:', e?.message ?? e); }
}

async function registerMentor(c: ReturnType<typeof makeClient>, m: typeof MENTOR_A): Promise<string> {
  await c.api('GET', '/api/csrf-token');
  const r = await c.api('POST', '/api/register', { username: m.user, password: PW, fullName: m.name, role: 'mentor', email: m.email });
  return String(r.json?.id ?? '');
}

async function main() {
  console.log('TASK #342 — mentor sees & responds to incoming session requests (full HTTP path)');
  console.log(`base=${BASE}  run=${RUN}\n`);
  await cleanup();

  const cA = makeClient();

  // 0 — confirm the gated surface is ON (the whole test is meaningless if the route 503s)
  step('Confirm ecosystemCommunity flag is ON');
  {
    const r = await cA.api('GET', '/api/ecosystem/enabled');
    if (r.status === 503) {
      console.error('\n  ✗ ecosystemCommunity is OFF (route 503). Set FF_ECOSYSTEM_COMMUNITY=1 and re-run.');
      failures += 1;
      return;
    }
    assert(r.status === 200 && r.json?.enabled === true, `GET /api/ecosystem/enabled → enabled (status ${r.status})`);
  }

  // 1 — register mentor A (auto-login → session)
  step('Register + auto-login mentor A');
  ids.mentorAUser = await registerMentor(cA, MENTOR_A);
  assert(!!ids.mentorAUser && !!cA.jar.get('mx.sid'), `mentor A registered with session (id ${ids.mentorAUser})`);

  // 2 — register mentor B (separate client/session — the IDOR attacker)
  step('Register + auto-login mentor B (unrelated)');
  const cB = makeClient();
  ids.mentorBUser = await registerMentor(cB, MENTOR_B);
  assert(!!ids.mentorBUser && !!cB.jar.get('mx.sid'), `mentor B registered with session (id ${ids.mentorBUser})`);

  // 3 — register a seeker (their session reads /mentor-bookings)
  step('Register + auto-login seeker');
  const cS = makeClient();
  await cS.api('GET', '/api/csrf-token');
  {
    const r = await cS.api('POST', '/api/register', { username: SEEKER.user, password: PW, fullName: SEEKER.name, role: 'user', email: SEEKER.email });
    ids.seekerUser = String(r.json?.id ?? '');
  }
  assert(!!ids.seekerUser && !!cS.jar.get('mx.sid'), `seeker registered with session (id ${ids.seekerUser})`);

  // 4 — provision real mentor_profiles rows keyed by user_id (registration alone doesn't create one)
  step('Provision real mentor_profiles rows for A and B');
  {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mentor_bookings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        mentor_profile_id varchar NOT NULL, seeker_id varchar NOT NULL,
        seeker_name text, seeker_email text, topic text, preferred_slot text, message text,
        status text NOT NULL DEFAULT 'requested',
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    const a = await pool.query(
      `INSERT INTO mentor_profiles (user_id, mentor_code, full_name, email, status) VALUES ($1,$2,$3,$4,'active') RETURNING id`,
      [ids.mentorAUser, `E2E342A-${RUN}`, MENTOR_A.name, MENTOR_A.email]);
    ids.mentorAProfile = String(a.rows[0].id);
    const b = await pool.query(
      `INSERT INTO mentor_profiles (user_id, mentor_code, full_name, email, status) VALUES ($1,$2,$3,$4,'active') RETURNING id`,
      [ids.mentorBUser, `E2E342B-${RUN}`, MENTOR_B.name, MENTOR_B.email]);
    ids.mentorBProfile = String(b.rows[0].id);
    assert(!!ids.mentorAProfile && !!ids.mentorBProfile, `mentor_profiles created (A ${ids.mentorAProfile}, B ${ids.mentorBProfile})`);
  }

  // 5 — seed two 'requested' bookings from the seeker → mentor A (as the booking flow would)
  step('Seed two pending requests seeker → mentor A');
  {
    const ins = await pool.query(
      `INSERT INTO mentor_bookings (mentor_profile_id, seeker_id, seeker_name, seeker_email, topic, status)
       VALUES ($1,$2,$3,$4,'Resume review','requested'), ($1,$2,$3,$4,'Mock interview','requested') RETURNING id`,
      [ids.mentorAProfile, ids.seekerUser, SEEKER.name, SEEKER.email]);
    for (const row of ins.rows) bookingIds.push(String(row.id));
    assert(bookingIds.length === 2, `two pending bookings seeded (n=${bookingIds.length})`);
  }

  // 6 — READ: mentor A sees both pending requests, is_mentor:true, counts correct
  step('READ: mentor A GET /incoming-bookings → sees pending requests');
  let firstId = '', secondId = '';
  {
    const r = await cA.api('GET', '/api/ecosystem/mentor/incoming-bookings');
    assert(r.status === 200 && r.json?.is_mentor === true, `is_mentor true (status ${r.status})`);
    const mine = (r.json?.bookings || []).filter((b: any) => bookingIds.includes(String(b.id)));
    assert(mine.length === 2, `both seeded bookings visible to mentor A (n=${mine.length})`);
    assert(Number(r.json?.counts?.requested) >= 2, `requested count >= 2 (got ${r.json?.counts?.requested})`);
    firstId = String(mine[0]?.id ?? bookingIds[0]);
    secondId = String(mine.find((b: any) => String(b.id) !== firstId)?.id ?? bookingIds[1]);
  }

  // 7 — IDOR: mentor B cannot respond to mentor A's booking → 404, status unchanged
  step('IDOR: mentor B responds to mentor A\'s booking → expect 404 booking_not_found + unchanged');
  {
    const r = await cB.api('POST', `/api/ecosystem/mentor-bookings/${firstId}/respond`, { decision: 'accept' });
    assert(r.status === 404 && r.json?.error === 'booking_not_found', `rejected 404 booking_not_found (got ${r.status} ${JSON.stringify(r.json)})`);
    const chk = await pool.query('SELECT status FROM mentor_bookings WHERE id = $1', [firstId]);
    assert(chk.rows[0]?.status === 'requested', `status still 'requested' after IDOR attempt (got ${chk.rows[0]?.status})`);
  }

  // 8 — ACCEPT: mentor A confirms the first request → 200 + status confirmed
  step('ACCEPT: mentor A confirms first request → expect 200 + status confirmed');
  {
    const r = await cA.api('POST', `/api/ecosystem/mentor-bookings/${firstId}/respond`, { decision: 'accept' });
    assert(r.status === 200 && r.json?.booking?.status === 'confirmed', `accepted → confirmed (status ${r.status}, booking.status ${r.json?.booking?.status})`);
    const chk = await pool.query('SELECT status FROM mentor_bookings WHERE id = $1', [firstId]);
    assert(chk.rows[0]?.status === 'confirmed', `persisted status confirmed (got ${chk.rows[0]?.status})`);
  }

  // 9 — DECLINE: mentor A declines the second request → 200 + status declined
  step('DECLINE: mentor A declines second request → expect 200 + status declined');
  {
    const r = await cA.api('POST', `/api/ecosystem/mentor-bookings/${secondId}/respond`, { decision: 'decline' });
    assert(r.status === 200 && r.json?.booking?.status === 'declined', `declined (status ${r.status}, booking.status ${r.json?.booking?.status})`);
    const chk = await pool.query('SELECT status FROM mentor_bookings WHERE id = $1', [secondId]);
    assert(chk.rows[0]?.status === 'declined', `persisted status declined (got ${chk.rows[0]?.status})`);
  }

  // 10 — SEEKER: the seeker's existing surface reflects the updated statuses
  step('SEEKER: GET /api/ecosystem/mentor-bookings reflects confirmed + declined');
  {
    const r = await cS.api('GET', '/api/ecosystem/mentor-bookings');
    const rows = (r.json?.bookings || r.json?.rows || (Array.isArray(r.json) ? r.json : [])) as any[];
    const byId = new Map(rows.map((b: any) => [String(b.id), b.status]));
    assert(r.status === 200, `seeker read ok (status ${r.status})`);
    assert(byId.get(firstId) === 'confirmed', `seeker sees first booking confirmed (got ${byId.get(firstId)})`);
    assert(byId.get(secondId) === 'declined', `seeker sees second booking declined (got ${byId.get(secondId)})`);
  }

  console.log(`\n${failures === 0
    ? '✅ ALL CHECKS PASSED — mentor sees incoming requests, accept/decline persists, IDOR is closed (404), and the seeker sees the updated status'
    : `❌ ${failures} CHECK(S) FAILED`}`);
}

main()
  .catch((e) => { console.error('E2E ERROR:', e); failures += 1; })
  .finally(async () => {
    await cleanup();
    await pool.end();
    process.exit(failures === 0 ? 0 : 1);
  });
