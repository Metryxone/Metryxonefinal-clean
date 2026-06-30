/**
 * TASK #295 — Mentor cannot write into an UNRELATED person's coaching thread (FULL HTTP PATH).
 *
 * Task #293 added participant-integrity to POST /api/journey-tail/mentor/engagements: a mentor may
 * only post an engagement against a seeker who actually BOOKED them (a real `mentor_bookings` row).
 * That guard (`seekerHasBooking`) was unit-tested at the helper level in
 * `scripts/task293-journey-tail-validate.ts` (false → true after a booking), but the LIVE authenticated
 * HTTP path — real mentor session → CSRF → POST with a stranger's seeker_id → 403 — was never exercised.
 *
 * This harness closes that gap by driving the REAL running Express server (localhost:8080) exactly as a
 * browser would (session-auth + signed double-submit CSRF, mirroring the employer e2e harness) and proving:
 *   NEGATIVE — a logged-in mentor posting an engagement for a seeker they have NO booking with is
 *              rejected 403 `not_a_participant` (the IDOR is closed end-to-end).
 *   POSITIVE — once a real `mentor_bookings` row links that mentor↔seeker, the SAME POST succeeds (200)
 *              and persists exactly one engagement (proving the 403 was the guard, not an unrelated failure).
 *   SCOPE    — a mentor self-note (no seeker_id) is still allowed (200) — the guard doesn't over-block.
 *
 * Honesty notes:
 *   - Requires the live Backend API on :8080 with `journeyTailCompletion` ON (FF_JOURNEY_TAIL_COMPLETION=1).
 *     If the flag is OFF the route 503s; the harness detects this and aborts loudly rather than passing.
 *   - Every artifact is @example.com / e2e-prefixed and removed on exit (user, mentor_profiles,
 *     mentor_bookings, jt_mentor_engagements). The engagement row is is_demo=true (stays out of counts).
 *   - The harness is ALLOWED to fail (non-zero exit) — no number is tuned to force a pass.
 *
 * Run: cd backend && npx tsx scripts/task295-mentor-engagement-authz-e2e.ts
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

// ── Minimal cookie jar + CSRF-aware fetch (mirrors the SPA's signed double-submit) ──
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

const RUN = Date.now().toString(36);
const USER = `e2e295_${RUN}`;
const PW = `E2eMntr!${RUN}aA9`; // satisfies complexity policy (upper/lower/digit/symbol/len)
const MENTOR_EMAIL = `e2e295.mentor.${RUN}@example.com`; // @example.com artifact (engagements are cleaned by id)
const UNRELATED_SEEKER = `e2e295-unrelated-seeker-${RUN}`; // NO booking with our mentor
const BOOKED_SEEKER = `e2e295-booked-seeker-${RUN}`;       // gets a real mentor_bookings row

let userId = '';
let mentorProfileId = '';
const createdEngIds: string[] = [];

async function cleanup() {
  try {
    if (createdEngIds.length) {
      await pool.query('DELETE FROM jt_mentor_engagements WHERE id = ANY($1)', [createdEngIds]).catch(() => {});
    }
    if (mentorProfileId) {
      await pool.query('DELETE FROM jt_mentor_engagements WHERE mentor_profile_id = $1', [mentorProfileId]).catch(() => {});
      await pool.query('DELETE FROM mentor_bookings WHERE mentor_profile_id = $1', [mentorProfileId]).catch(() => {});
      await pool.query('DELETE FROM mentor_profiles WHERE id = $1', [mentorProfileId]).catch(() => {});
    }
    if (userId) {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {});
    }
  } catch (e: any) { console.error('cleanup error:', e?.message ?? e); }
}

async function main() {
  console.log('TASK #295 — mentor cannot post into an unrelated seeker\'s coaching thread (full HTTP path)');
  console.log(`base=${BASE}  run=${RUN}\n`);
  await cleanup();

  // 0 — confirm the gated surface is ON (the whole test is meaningless if the route 503s)
  step('Confirm journeyTailCompletion flag is ON');
  {
    const r = await api('GET', '/api/journey-tail/enabled');
    if (r.status === 503) {
      console.error('\n  ✗ journeyTailCompletion is OFF (route 503). Set FF_JOURNEY_TAIL_COMPLETION=1 on the');
      console.error('    Backend API workflow/env and restart, then re-run this harness.');
      failures += 1;
      return;
    }
    assert(r.status === 200 && r.json?.enabled === true, `GET /api/journey-tail/enabled → enabled (status ${r.status})`);
  }

  // 1 — bootstrap CSRF cookie/token
  step('Bootstrap CSRF token');
  {
    const r = await api('GET', '/api/csrf-token');
    assert(r.status === 200 && !!jar.get('mx.csrf'), `GET /api/csrf-token issued mx.csrf cookie (status ${r.status})`);
  }

  // 2 — register a throwaway MENTOR user (auto-logs in → sets mx.sid session cookie)
  step('Register + auto-login throwaway mentor user');
  {
    const r = await api('POST', '/api/register', {
      username: USER, password: PW, fullName: 'E2E 295 Mentor', role: 'mentor', email: MENTOR_EMAIL,
    });
    userId = String(r.json?.id ?? '');
    assert(r.status === 200 && !!userId, `POST /api/register created mentor user + session (status ${r.status})`);
    assert(!!jar.get('mx.sid'), `session cookie mx.sid present after register`);
  }

  // 3 — make this user a REAL mentor: a mentor_profiles row keyed by user_id (registration alone
  //     does not create one; actorMentorProfileId() resolves the route's mentor identity from it).
  step('Provision real mentor_profiles row (user_id → mentor_profile_id) + ensure mentor_bookings exists');
  {
    // mentor_bookings is lazily created by ecosystem-community in prod; ensure it in a fresh dev DB.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mentor_bookings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        mentor_profile_id varchar NOT NULL, seeker_id varchar NOT NULL,
        seeker_name text, seeker_email text, topic text, preferred_slot text, message text,
        status text NOT NULL DEFAULT 'requested',
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    const ins = await pool.query(
      `INSERT INTO mentor_profiles (user_id, mentor_code, full_name, email, status)
       VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
      [userId, `E2E295-${RUN}`, 'E2E 295 Mentor', MENTOR_EMAIL],
    );
    mentorProfileId = String(ins.rows[0].id);
    assert(!!mentorProfileId, `mentor_profiles row created (id ${mentorProfileId})`);
  }

  // 4 — NEGATIVE: mentor posts an engagement for an UNRELATED seeker (no booking) → 403 not_a_participant
  step('NEGATIVE: post engagement for an unrelated seeker (no booking) → expect 403 not_a_participant');
  {
    const r = await api('POST', '/api/journey-tail/mentor/engagements', {
      mentor_profile_id: mentorProfileId, seeker_id: UNRELATED_SEEKER,
      kind: 'check_in', note: 'should be rejected — no booking relationship',
    });
    assert(r.status === 403, `POST rejected with 403 (got ${r.status})`);
    assert(r.json?.error === 'not_a_participant', `error is not_a_participant (got ${JSON.stringify(r.json)})`);
    // Belt-and-braces: no engagement row leaked into the unrelated seeker's thread.
    const leaked = await pool.query(
      `SELECT COUNT(*)::int n FROM jt_mentor_engagements WHERE mentor_profile_id=$1 AND seeker_id=$2`,
      [mentorProfileId, UNRELATED_SEEKER],
    );
    assert(Number(leaked.rows[0].n) === 0, `no engagement persisted for the unrelated seeker (n=${leaked.rows[0].n})`);
  }

  // 5 — POSITIVE: with a real mentor_bookings link, the SAME post succeeds (200) and persists one row
  step('POSITIVE: real booking exists → post engagement → expect 200 + one persisted row');
  {
    await pool.query(
      `INSERT INTO mentor_bookings (mentor_profile_id, seeker_id, status) VALUES ($1, $2, 'requested')`,
      [mentorProfileId, BOOKED_SEEKER],
    );
    const r = await api('POST', '/api/journey-tail/mentor/engagements', {
      mentor_profile_id: mentorProfileId, seeker_id: BOOKED_SEEKER,
      kind: 'next_session_goal', note: 'real coaching note', next_goal: 'practice 30m/day',
    });
    assert(r.status === 200 && r.json?.ok === true && !!r.json?.id, `POST accepted with 200 + id (status ${r.status}, id ${r.json?.id})`);
    if (r.json?.id) createdEngIds.push(String(r.json.id));
    const row = await pool.query(
      `SELECT author_role, author_id FROM jt_mentor_engagements WHERE mentor_profile_id=$1 AND seeker_id=$2`,
      [mentorProfileId, BOOKED_SEEKER],
    );
    assert(row.rowCount === 1, `exactly one engagement persisted for the booked seeker (n=${row.rowCount})`);
    if (row.rowCount === 1) {
      assert(row.rows[0].author_role === 'mentor', `author_role recorded as mentor (got ${row.rows[0].author_role})`);
      assert(String(row.rows[0].author_id) === userId, `author_id is the acting mentor's user id (no impersonation)`);
    }
  }

  // 6 — SCOPE: a mentor self-note (no seeker_id) is allowed — the guard doesn't over-block
  step('SCOPE: mentor self-note (no seeker_id) → expect 200 (guard scoped to named seekers only)');
  {
    const r = await api('POST', '/api/journey-tail/mentor/engagements', {
      mentor_profile_id: mentorProfileId, kind: 'check_in', note: 'private mentor self-note',
    });
    assert(r.status === 200 && r.json?.ok === true && !!r.json?.id, `self-note accepted with 200 + id (status ${r.status})`);
    if (r.json?.id) createdEngIds.push(String(r.json.id));
  }

  console.log(`\n${failures === 0
    ? '✅ ALL CHECKS PASSED — the live route rejects a mentor writing into an unrelated seeker\'s thread (403), accepts it only after a real booking (200), and still allows mentor self-notes'
    : `❌ ${failures} CHECK(S) FAILED`}`);
}

main()
  .catch((e) => { console.error('E2E ERROR:', e); failures += 1; })
  .finally(async () => {
    await cleanup();
    await pool.end();
    process.exit(failures === 0 ? 0 : 1);
  });
