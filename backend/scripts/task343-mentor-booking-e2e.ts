/**
 * TASK #343 — Mentor booking happy path regression (isolated flag-ON backend instance).
 *
 * Task #269 confirmed the mentor card + booking happy path MANUALLY, but there was no
 * automated guard. Because `ecosystemCommunity` defaults OFF (byte-identical incl. schema),
 * a change to the shared auth/CSRF middleware, the mentor query, or the booking insert could
 * silently break this flow without anyone noticing. This harness makes the happy path honest.
 *
 * Per the journey-tail-completion memory pattern, the flag defaults OFF and is deliberately
 * absent from the shared Backend API :8080 workflow (dev stays byte-identical-OFF). So instead
 * of flipping the shared workflow, this harness spawns its OWN isolated backend instances on
 * private ports:
 *   - a flag-OFF instance → asserts GET /api/ecosystem/mentors 503s (byte-identical OFF), then
 *   - a flag-ON  instance (FF_ECOSYSTEM_COMMUNITY=1) → drives the REAL running Express server
 *     exactly as a browser would (session-auth + signed double-submit CSRF), proving the
 *     happy path end-to-end:
 *       1. seed an @example.com ACTIVE mentor_profiles row,
 *       2. register + auto-login a job seeker,
 *       3. GET /api/ecosystem/mentors — the seeded mentor's REAL card is returned, with NO
 *          fabricated match/fit percentage attached (mentors are a directory, not a match),
 *       4. POST /api/ecosystem/mentors/:id/book — 200 ok,
 *       5. a real `mentor_bookings` row is persisted for (mentor, seeker).
 *   Also proves 404 on booking a non-existent mentor (no ghost bookings).
 *
 * Honesty notes:
 *   - The harness spawns/kills its own instances; the shared :8080 workflow is never touched
 *     and prod stays OFF.
 *   - Every artifact is @example.com / e2e-prefixed and removed on exit (mentor_profiles,
 *     mentor_bookings, users). Cleanup runs even on failure.
 *   - The harness is ALLOWED to fail (non-zero exit) — no number is tuned to force a pass.
 *
 * Run: cd backend && npx tsx scripts/task343-mentor-booking-e2e.ts
 */

import { Pool } from 'pg';
import { spawn, type ChildProcess } from 'child_process';
import net from 'net';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let failures = 0;
let stepNo = 0;
function step(name: string) { stepNo += 1; console.log(`\n[${String(stepNo).padStart(2, '0')}] ${name}`); }
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`     \u2713 ${msg}`);
  else { failures += 1; console.error(`     \u2717 FAIL: ${msg}`); }
}

const RUN = Date.now().toString(36);
const SEEKER_USER = `e2e343_${RUN}`;
const SEEKER_PW = `E2eBook!${RUN}aA9`; // satisfies complexity policy (upper/lower/digit/symbol/len)
const SEEKER_EMAIL = `e2e343.seeker.${RUN}@example.com`;
const MENTOR_EMAIL = `e2e343.mentor.${RUN}@example.com`;

let mentorProfileId = '';
let seekerUserId = '';
const createdBookingIds: string[] = [];

// ── Per-instance cookie jar + CSRF-aware fetch (mirrors the SPA's signed double-submit) ──
function makeClient(base: string) {
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
    const res = await fetch(`${base}${path}`, {
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
  return { api, jar };
}

// ── Reserve a free ephemeral port (avoids fixed-port collisions with leftover/
//    concurrent instances — a stale process on a hardcoded port would make waitReady
//    poll a STRANGER that later resets the connection mid-test → ECONNRESET flakiness).
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '0.0.0.0', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

type Instance = { child: ChildProcess; port: number; bindFailed: boolean; exited: boolean };

// ── Spawn an isolated backend instance on its own port with the given extra env ──
function spawnBackend(port: number, extraEnv: Record<string, string>): Instance {
  const child = spawn('npx', ['tsx', 'index.ts'], {
    cwd: process.cwd(), // scripts are run from backend/ (cd backend && npx tsx scripts/...)
    env: { ...process.env, PORT: String(port), NODE_ENV: 'development', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const inst: Instance = { child, port, bindFailed: false, exited: false };
  const watch = (t: string) => { if (/EADDRINUSE|address already in use/i.test(t)) inst.bindFailed = true; };
  child.stdout?.on('data', (d) => { const t = String(d).trim(); if (t) { console.log(`   [:${port}] ${t}`); watch(t); } });
  child.stderr?.on('data', (d) => { const t = String(d).trim(); if (t) { console.error(`   [:${port}!] ${t}`); watch(t); } });
  child.once('exit', () => { inst.exited = true; });
  return inst;
}

// ── Poll a generic-always-200 endpoint until the process is serving requests.
//    Aborts loudly if the child failed to bind (EADDRINUSE) or exited, so the test
//    never silently proceeds against a stranger process. ──
async function waitReady(inst: Instance, timeoutMs = 90000): Promise<boolean> {
  const base = `http://localhost:${inst.port}`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (inst.bindFailed) { console.error(`   [:${inst.port}] port bind FAILED (EADDRINUSE) — aborting`); return false; }
    if (inst.exited) { console.error(`   [:${inst.port}] process exited before becoming ready — aborting`); return false; }
    try {
      const res = await fetch(`${base}/api/csrf-token`, { redirect: 'manual' });
      if (res.status === 200) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function killChild(inst: Instance | null): Promise<void> {
  return new Promise((resolve) => {
    const child = inst?.child;
    if (!child || child.exitCode != null) return resolve();
    child.once('exit', () => resolve());
    child.kill('SIGKILL');
    setTimeout(resolve, 3000);
  });
}

async function cleanup() {
  try {
    if (createdBookingIds.length) {
      await pool.query('DELETE FROM mentor_bookings WHERE id = ANY($1)', [createdBookingIds]).catch(() => {});
    }
    if (mentorProfileId) {
      await pool.query('DELETE FROM mentor_bookings WHERE mentor_profile_id = $1', [mentorProfileId]).catch(() => {});
      await pool.query('DELETE FROM mentor_profiles WHERE id = $1', [mentorProfileId]).catch(() => {});
    }
    if (seekerUserId) {
      await pool.query('DELETE FROM mentor_bookings WHERE seeker_id = $1', [seekerUserId]).catch(() => {});
      await pool.query('DELETE FROM users WHERE id = $1', [seekerUserId]).catch(() => {});
    }
  } catch (e: any) { console.error('cleanup error:', e?.message ?? e); }
}

async function main() {
  console.log('TASK #343 — mentor booking happy path regression (isolated flag-ON instance)');
  console.log(`run=${RUN}\n`);
  await cleanup();

  // Seed the mentor substrate up-front (shared DB) so BOTH instances read the same row.
  // mentor_bookings is lazily created by ecosystem-community in prod; ensure it in a fresh dev DB.
  step('Seed an @example.com ACTIVE mentor_profiles row + ensure mentor_bookings exists');
  {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mentor_bookings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        mentor_profile_id varchar NOT NULL, seeker_id varchar NOT NULL,
        seeker_name text, seeker_email text, topic text, preferred_slot text, message text,
        status text NOT NULL DEFAULT 'requested',
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    const ins = await pool.query(
      `INSERT INTO mentor_profiles (mentor_code, full_name, email, bio, specializations, status)
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id`,
      [`E2E343-${RUN}`, 'E2E 343 Mentor', MENTOR_EMAIL, 'E2E test mentor', ['Career Guidance']],
    );
    mentorProfileId = String(ins.rows[0].id);
    assert(!!mentorProfileId, `active mentor_profiles row created (id ${mentorProfileId})`);
  }

  let offInst: Instance | null = null;
  let onInst: Instance | null = null;
  try {
    // ══════════════════════════════════════════════════════════════════════════
    // PART A — FLAG OFF: the surface is byte-identical-OFF (503 before any work)
    // ══════════════════════════════════════════════════════════════════════════
    step('Boot isolated backend with ecosystemCommunity OFF');
    let offReady = false;
    {
      const offPort = await getFreePort();
      offInst = spawnBackend(offPort, { FF_ECOSYSTEM_COMMUNITY: '0' });
      offReady = await waitReady(offInst);
      assert(offReady, `flag-OFF instance is serving on :${offPort}`);
    }
    if (offReady && offInst) {
      step('FLAG OFF: GET /api/ecosystem/mentors → expect 503 (byte-identical-OFF)');
      const off = makeClient(`http://localhost:${offInst.port}`);
      const r = await off.api('GET', '/api/ecosystem/mentors');
      assert(r.status === 503, `GET /api/ecosystem/mentors returns 503 when the flag is OFF (got ${r.status})`);
    }
    await killChild(offInst); offInst = null;

    // ══════════════════════════════════════════════════════════════════════════
    // PART B — FLAG ON: mentor card renders + booking happy path persists
    // ══════════════════════════════════════════════════════════════════════════
    step('Boot isolated backend with ecosystemCommunity ON (FF_ECOSYSTEM_COMMUNITY=1)');
    const onPort = await getFreePort();
    {
      onInst = spawnBackend(onPort, { FF_ECOSYSTEM_COMMUNITY: '1' });
      const ready = await waitReady(onInst);
      assert(ready, `flag-ON instance is serving on :${onPort}`);
      if (!ready) { console.error('  ✗ flag-ON instance never became ready — aborting'); failures += 1; return; }
    }
    const on = makeClient(`http://localhost:${onPort}`);

    step('Confirm the gated surface is ON');
    {
      const r = await on.api('GET', '/api/ecosystem/enabled');
      if (r.status === 503) { console.error('  ✗ ecosystemCommunity still OFF on the ON instance — aborting'); failures += 1; return; }
      assert(r.status === 200 && r.json?.enabled === true, `GET /api/ecosystem/enabled → enabled (status ${r.status})`);
    }

    step('Bootstrap CSRF token');
    {
      const r = await on.api('GET', '/api/csrf-token');
      assert(r.status === 200 && !!on.jar.get('mx.csrf'), `GET /api/csrf-token issued mx.csrf cookie (status ${r.status})`);
    }

    step('Register + auto-login a throwaway job seeker');
    {
      const r = await on.api('POST', '/api/register', {
        username: SEEKER_USER, password: SEEKER_PW, fullName: 'E2E 343 Seeker',
        role: 'job_seeker', email: SEEKER_EMAIL,
      });
      seekerUserId = String(r.json?.id ?? '');
      assert(r.status === 200 && !!seekerUserId, `POST /api/register created job seeker + session (status ${r.status})`);
      assert(!!on.jar.get('mx.sid'), `session cookie mx.sid present after register`);
    }

    step('GET /api/ecosystem/mentors → seeded mentor card returned with NO fabricated match %');
    {
      const r = await on.api('GET', '/api/ecosystem/mentors');
      assert(r.status === 200 && r.json?.ok === true && Array.isArray(r.json?.mentors), `200 with mentors[] (status ${r.status})`);
      const card = (r.json?.mentors ?? []).find((m: any) => String(m.id) === mentorProfileId);
      assert(!!card, `the seeded @example.com active mentor's real card is present in the listing`);
      if (card) {
        assert(card.name === 'E2E 343 Mentor', `card carries the REAL mentor name (got ${JSON.stringify(card.name)})`);
        // Mentors are a DIRECTORY, not a match — assert no fabricated match/fit percentage leaked onto the card.
        const fabricatedKeys = Object.keys(card).filter((k) => /match|fit|score.*pct|match_pct/i.test(k));
        assert(fabricatedKeys.length === 0, `no fabricated match/fit % field on the mentor card (offending keys: ${JSON.stringify(fabricatedKeys)})`);
      }
    }

    step('NEGATIVE: booking a non-existent mentor → 404 (no ghost bookings)');
    {
      const r = await on.api('POST', '/api/ecosystem/mentors/00000000-0000-0000-0000-000000000000/book', { topic: 'ghost' });
      assert(r.status === 404 && r.json?.error === 'mentor_not_found_or_inactive', `404 mentor_not_found_or_inactive (got ${r.status} ${JSON.stringify(r.json)})`);
    }

    step('POST /api/ecosystem/mentors/:id/book → 200 ok');
    {
      const r = await on.api('POST', `/api/ecosystem/mentors/${mentorProfileId}/book`, {
        topic: 'Career transition', preferred_slot: 'Weekday evenings', message: 'e2e343 booking',
      });
      assert(r.status === 200 && r.json?.ok === true && !!r.json?.booking?.id, `booking accepted with 200 + id (status ${r.status})`);
      if (r.json?.booking?.id) createdBookingIds.push(String(r.json.booking.id));
    }

    step('Assert a real mentor_bookings row was persisted for (mentor, seeker)');
    {
      const row = await pool.query(
        `SELECT id, seeker_id, seeker_email, topic, status FROM mentor_bookings WHERE mentor_profile_id=$1 AND seeker_id=$2`,
        [mentorProfileId, seekerUserId],
      );
      assert(row.rowCount === 1, `exactly one mentor_bookings row persisted (n=${row.rowCount})`);
      if (row.rowCount === 1) {
        assert(row.rows[0].topic === 'Career transition', `booking topic persisted (got ${JSON.stringify(row.rows[0].topic)})`);
        assert(String(row.rows[0].seeker_id) === seekerUserId, `booking seeker_id is the acting seeker (no impersonation)`);
      }
    }

    step('GET /api/ecosystem/mentor-bookings → the seeker sees their own booking');
    {
      const r = await on.api('GET', '/api/ecosystem/mentor-bookings');
      const found = (r.json?.bookings ?? []).some((b: any) => String(b.mentor_profile_id) === mentorProfileId);
      assert(r.status === 200 && found, `seeker's booking is listed back (status ${r.status})`);
    }
  } finally {
    await killChild(offInst);
    await killChild(onInst);
  }

  console.log(`\n${failures === 0
    ? '✅ ALL CHECKS PASSED — flag-OFF 503 byte-identical; flag-ON mentor card renders (no fabricated match %) and booking persists a real mentor_bookings row'
    : `❌ ${failures} CHECK(S) FAILED`}`);
}

main()
  .catch((e) => { console.error('E2E ERROR:', e); failures += 1; })
  .finally(async () => {
    await cleanup();
    await pool.end();
    process.exit(failures === 0 ? 0 : 1);
  });
