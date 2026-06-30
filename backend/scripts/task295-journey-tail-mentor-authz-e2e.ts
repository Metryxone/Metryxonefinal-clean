/**
 * TASK #295 — A mentor cannot write into an UNRELATED person's coaching thread (LIVE HTTP E2E).
 *
 * Task #293 (Journey Tail Completion) added the mentor/coach engagement tail
 * (POST /api/journey-tail/mentor/engagements). Its participant-integrity guard — an
 * engagement is the tail of a REAL match (a mentor_bookings row), never a cold message —
 * was unit-tested at the helper level (scripts/task293-journey-tail-validate.ts exercises
 * the exported seekerHasBooking false→true). What was MISSING was an end-to-end HTTP test
 * that logs in as a real mentor and proves the LIVE route rejects an attempt to post an
 * engagement for a seeker the mentor has no booking with — the same way the employer
 * harnesses drive the authenticated session + CSRF surface.
 *
 * This harness closes that gap. Because `journeyTailCompletion` defaults OFF (and is NOT in
 * the Backend API workflow command, to keep dev byte-identical-OFF), it does NOT touch the
 * running :8080 server. Instead it spawns its OWN backend instance on an isolated port with
 * FF_JOURNEY_TAIL_COMPLETION=1, drives it exactly as a browser would (session-auth + CSRF +
 * real Postgres), and tears the instance down on exit.
 *
 * What it proves (the task's "Done looks like"):
 *   1. NEGATIVE (the core gap): a mentor posting an engagement for an UNRELATED seeker_id
 *      (no mentor_bookings row) is rejected 403 not_a_participant.
 *   2. POSITIVE: the same mentor posting for a seeker they ACTUALLY booked succeeds (200).
 *   3. A mentor self-note (no seeker_id) is allowed (200) — the guard only fires on a named mentee.
 *   4. Cross-direction: a seeker (no mentor profile) posting against a mentor they never
 *      booked is rejected 403 no_mentor_booking — bilateral integrity, not mentor-only.
 *
 * Honesty notes:
 *   - All accounts use @example.com and all rows are jt295-/@example.com-prefixed so they are
 *     purgeable from the shared dev/prod DB; the harness self-cleans on exit even on failure.
 *   - Nothing is fabricated: the booking substrate is inserted as real mentor_bookings rows and
 *     the rejections are produced by the LIVE route's own guard, not by the test.
 *
 * Run:  cd backend && npx tsx scripts/task295-journey-tail-mentor-authz-e2e.ts
 * (No workflow prerequisite — the harness boots its own flag-ON instance.)
 */

import { Pool } from 'pg';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const TEST_PORT = Number(process.env.E2E_PORT ?? 8395);
const BASE = `http://localhost:${TEST_PORT}`;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let failures = 0;
let stepNo = 0;
function step(name: string) { stepNo += 1; console.log(`\n[${String(stepNo).padStart(2, '0')}] ${name}`); }
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`     ✓ ${msg}`);
  else { failures += 1; console.error(`     ✗ FAIL: ${msg}`); }
}

// ── A cookie jar + CSRF-aware fetch, scoped to ONE session. ──────────────────
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
const PW = `E2eJt295!${RUN}aA9`; // satisfies complexity policy (upper/lower/digit/symbol/len)
const MENTOR_EMAIL = `jt295.mentor.${RUN}@example.com`;
const SEEKER_EMAIL = `jt295.seeker.${RUN}@example.com`;
const BOOKED_SEEKER_ID = `jt295-booked-${RUN}`;       // has a booking with our mentor
const UNRELATED_SEEKER_ID = `jt295-unrelated-${RUN}`; // has NO booking — the abuse target

let mentorUserId = '';
let seekerUserId = '';
let mentorProfileId = '';
let server: ChildProcess | null = null;

async function registerUser(email: string): Promise<{ session: ReturnType<typeof makeSession>; userId: string }> {
  const session = makeSession();
  const csrf = await session.api('GET', '/api/csrf-token');
  if (csrf.status !== 200 || !session.jar.get('mx.csrf')) {
    throw new Error(`CSRF bootstrap failed for ${email}: status ${csrf.status}`);
  }
  let r = await session.api('POST', '/api/register', {
    username: email, email, password: PW, fullName: 'JT295 E2E', role: 'job_seeker',
  });
  // The always-on auth rate limiter is a real security control with NO test bypass; honour
  // its retry_after on a 429 rather than failing (a throttle is not an authz finding).
  for (let attempt = 0; attempt < 5 && r.status === 429; attempt += 1) {
    const waitS = Math.min(70, Math.max(2, Number(r.json?.retry_after_seconds ?? 15) + 1));
    console.log(`     … register for ${email} rate-limited (429); waiting ${waitS}s (attempt ${attempt + 1}/5)`);
    await new Promise((res) => setTimeout(res, waitS * 1000));
    r = await session.api('POST', '/api/register', {
      username: email, email, password: PW, fullName: 'JT295 E2E', role: 'job_seeker',
    });
  }
  if (r.status !== 200 && r.status !== 201) throw new Error(`register ${email} failed: ${r.status} ${JSON.stringify(r.json)}`);
  const row = await pool.query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [email]);
  if (!row.rowCount) throw new Error(`could not resolve user id for ${email}`);
  return { session, userId: String(row.rows[0].id) };
}

async function waitForReady(timeoutMs = 60000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      // /enabled is flagGate-first: 200 {enabled:true} only when the flag is ON and the
      // server is up — a perfect combined readiness + flag-state probe.
      const res = await fetch(`${BASE}/api/journey-tail/enabled`);
      if (res.status === 200) {
        const j: any = await res.json().catch(() => null);
        if (j?.enabled === true) return;
      }
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 750));
  }
  throw new Error('flag-ON backend instance did not become ready in time');
}

async function cleanup() {
  try {
    if (mentorProfileId) {
      await pool.query(`DELETE FROM jt_mentor_engagements WHERE mentor_profile_id = $1`, [mentorProfileId]).catch(() => {});
      await pool.query(`DELETE FROM mentor_bookings WHERE mentor_profile_id = $1`, [mentorProfileId]).catch(() => {});
      await pool.query(`DELETE FROM mentor_profiles WHERE id = $1`, [mentorProfileId]).catch(() => {});
    }
    for (const id of [mentorUserId, seekerUserId]) {
      if (id) await pool.query(`DELETE FROM users WHERE id = $1`, [id]).catch(() => {});
    }
    await pool.query(`DELETE FROM users WHERE username = ANY($1)`, [[MENTOR_EMAIL, SEEKER_EMAIL]]).catch(() => {});
  } catch (e: any) { console.error('cleanup error:', e?.message ?? e); }
}

function stopServer() {
  if (server && !server.killed) {
    // SIGKILL avoids any graceful-shutdown signal trap hanging the harness.
    try { server.kill('SIGKILL'); } catch { /* already gone */ }
  }
}

async function main() {
  step('Spawn an isolated backend instance with FF_JOURNEY_TAIL_COMPLETION=1');
  const backendDir = dirname(dirname(fileURLToPath(import.meta.url))); // scripts/ -> backend/
  server = spawn('npx', ['tsx', 'index.ts'], {
    cwd: backendDir,
    env: { ...process.env, PORT: String(TEST_PORT), FF_JOURNEY_TAIL_COMPLETION: '1', NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const bootLog: string[] = [];
  server.stdout?.on('data', (d) => bootLog.push(String(d)));
  server.stderr?.on('data', (d) => bootLog.push(String(d)));
  server.on('exit', (code) => { if (code && code !== 0 && failures === 0) console.error(`     server exited early (code ${code})`); });
  try {
    await waitForReady();
    assert(true, `flag-ON instance ready on :${TEST_PORT}`);
  } catch (e: any) {
    console.error('     boot log tail:\n' + bootLog.join('').split('\n').slice(-25).join('\n'));
    throw e;
  }

  step('Provision a mentor (with mentor_profiles) and the booking substrate');
  const mentor = await registerUser(MENTOR_EMAIL);
  mentorUserId = mentor.userId;
  const prof = await pool.query(
    `INSERT INTO mentor_profiles (user_id, mentor_code, full_name, email, status)
     VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
    [mentorUserId, `JT295-${RUN}`, 'JT295 Mentor', MENTOR_EMAIL],
  );
  mentorProfileId = String(prof.rows[0].id);
  assert(!!mentorProfileId, 'mentor_profiles row created and linked to the mentor user');
  // The mentor has a REAL booking with BOOKED_SEEKER_ID only; UNRELATED_SEEKER_ID has none.
  await pool.query(
    `INSERT INTO mentor_bookings (mentor_profile_id, seeker_id, seeker_email, topic, status)
     VALUES ($1, $2, $3, 'JT295 booked topic', 'confirmed')`,
    [mentorProfileId, BOOKED_SEEKER_ID, `booked.${RUN}@example.com`],
  );
  assert(true, 'mentor_bookings row created for the BOOKED seeker only');

  const post = (s: ReturnType<typeof makeSession>, body: unknown) =>
    s.api('POST', '/api/journey-tail/mentor/engagements', body);

  step('NEGATIVE — mentor posts into an UNRELATED person’s thread (the core gap)');
  const neg = await post(mentor.session, {
    mentor_profile_id: mentorProfileId, seeker_id: UNRELATED_SEEKER_ID,
    kind: 'check_in', note: 'should never land',
  });
  assert(neg.status === 403, `rejected with 403 (got ${neg.status})`);
  assert(neg.json?.error === 'not_a_participant', `error == not_a_participant (got ${JSON.stringify(neg.json)})`);
  const leaked = await pool.query(
    `SELECT 1 FROM jt_mentor_engagements WHERE mentor_profile_id=$1 AND seeker_id=$2`,
    [mentorProfileId, UNRELATED_SEEKER_ID],
  );
  assert((leaked.rowCount ?? 0) === 0, 'no jt_mentor_engagements row was written for the unrelated seeker');

  step('POSITIVE — mentor posts for a seeker they actually booked');
  const pos = await post(mentor.session, {
    mentor_profile_id: mentorProfileId, seeker_id: BOOKED_SEEKER_ID,
    kind: 'check_in', note: 'real follow-up', progress: 'on_track', next_goal: 'practice round 2',
  });
  assert(pos.status === 200, `accepted with 200 (got ${pos.status})`);
  assert(pos.json?.ok === true && !!pos.json?.id, `returned an engagement id (got ${JSON.stringify(pos.json)})`);
  const wrote = await pool.query(
    `SELECT 1 FROM jt_mentor_engagements WHERE id=$1 AND mentor_profile_id=$2 AND seeker_id=$3`,
    [pos.json?.id, mentorProfileId, BOOKED_SEEKER_ID],
  );
  assert((wrote.rowCount ?? 0) === 1, 'the engagement row was actually persisted for the booked seeker');

  step('ALLOWED — mentor self-note with no seeker_id (guard only fires on a named mentee)');
  const selfNote = await post(mentor.session, {
    mentor_profile_id: mentorProfileId, kind: 'check_in', note: 'private mentor note',
  });
  assert(selfNote.status === 200 && selfNote.json?.ok === true, `self-note accepted (got ${selfNote.status} ${JSON.stringify(selfNote.json)})`);

  step('CROSS-DIRECTION — a seeker with no booking cannot post against the mentor');
  const seeker = await registerUser(SEEKER_EMAIL);
  seekerUserId = seeker.userId;
  // This caller has no mentor_profiles row → treated as a seeker; seeker_id is forced to the
  // actor server-side, and they never booked this mentor → no_mentor_booking.
  const xdir = await post(seeker.session, {
    mentor_profile_id: mentorProfileId, seeker_id: seekerUserId, kind: 'check_in', note: 'cold message',
  });
  assert(xdir.status === 403, `seeker rejected with 403 (got ${xdir.status})`);
  assert(xdir.json?.error === 'no_mentor_booking', `error == no_mentor_booking (got ${JSON.stringify(xdir.json)})`);
}

main()
  .catch((e) => { failures += 1; console.error('\nFATAL:', e?.message ?? e); })
  .finally(async () => {
    await cleanup();
    stopServer();
    await pool.end().catch(() => {});
    console.log(`\n${failures === 0 ? '✅ PASS' : '❌ FAIL'} — ${failures} failure(s).`);
    // give the SIGKILL a tick to land before the process exits
    setTimeout(() => process.exit(failures === 0 ? 0 : 1), 200);
  });
