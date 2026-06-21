/**
 * Task #19 — Usage Metering HTTP-LEVEL concurrency regression (self-cleaning, @example.com only).
 *
 * The engine-level regression (smoke-usage-metering-safety-65.ts) proves the advisory-lock
 * transaction in recordUsage holds the fail-closed quota when many writers race the SAME identity +
 * usage_type. It calls recordUsage() directly, so it CANNOT see the HTTP path: the route's auth guard,
 * the `commercialUsageMetering` flag gate, identity resolution (server principal / super-admin
 * override), the 429 mapping for an over-quota refusal, or middleware regressions.
 *
 * This regression closes that gap. It STARTS a real Backend API (FF_COMMERCIAL_USAGE_METERING=1),
 * logs in as a super-admin, and fires N parallel AUTHENTICATED POSTs to
 * `POST /api/commercial/metering/record` past a declared quota — then asserts the HTTP layer returns
 * 429 for every overflow and the comm_usage_events ledger never overruns. It covers:
 *
 *   A. period_count dimension (assessments): RACERS parallel quantity=1 POSTs at a quota of QUOTA →
 *      exactly QUOTA succeed (201), the rest are refused (429), ledger holds exactly QUOTA rows.
 *   B. level dimension (storage): a quota is an ABSOLUTE ceiling (latest reading), so under-ceiling
 *      readings succeed (201) and over-ceiling readings are refused (429) concurrently — and the
 *      ledger never records a reading above the ceiling.
 *   C. mixed identities + types in ONE storm: two identities and two usage_types race together; the
 *      per-(identity,type) advisory lock must hold each quota independently with no cross-contamination.
 *
 * Identity note: the record route meters the SERVER-authenticated principal; a client-supplied email
 * is honoured ONLY for a super-admin (acting-on-behalf). The deserialized session user carries no
 * email, so we authenticate as a super-admin and pass the metered identity via the `email` override —
 * the only authenticated HTTP path that can meter a chosen identity.
 *
 * All test data is keyed by *@example.com and deleted at the end (and on failure / on signal). Never
 * touches real identities. Spawns the API on a private PORT so it never collides with a running
 * workflow; the shared dev DB is written only under @example.com and purged.
 */
import pg from 'pg';
import { spawn, type ChildProcess } from 'child_process';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const scryptAsync = promisify(scrypt);

const PORT = 8099;
const BASE = `http://127.0.0.1:${PORT}`;

// Super-admin operator (authenticated principal) + the metered identities (override targets).
const ADMIN_EMAIL = 'usage-http-admin@example.com';
const ADMIN_PASSWORD = 'concurrency-test-65';
const ID_A = 'usage-http-storm-a@example.com';
const ID_B = 'usage-http-storm-b@example.com';
const ALL_EMAILS = [ADMIN_EMAIL, ID_A, ID_B];

const PRODUCT_ID = '00000000-0000-0000-0000-0000000019cc';
const PLAN_ID = '00000000-0000-0000-0000-0000000019dd';

const ASSESS_QUOTA = 3;   // period_count cap
const STORAGE_CAP = 5;    // level ceiling
const RACERS = 12;        // parallel requests per storm

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) { pass++; console.log(`  \u2713 ${name}`); }
  else { fail++; console.log(`  \u2717 ${name}`, detail !== undefined ? JSON.stringify(detail) : ''); }
};

// Hash a password in the SAME scrypt format the auth layer expects (hex.salt).
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

async function cleanup() {
  for (const email of ALL_EMAILS) {
    await pool.query(`DELETE FROM comm_usage_events WHERE lower(email) = lower($1)`, [email]).catch(() => {});
    const cid = await pool
      .query(`SELECT id FROM comm_customers WHERE lower(email) = lower($1)`, [email])
      .then((r) => (r.rows[0] ? String(r.rows[0].id) : null))
      .catch(() => null);
    if (cid) {
      await pool.query(`DELETE FROM comm_subscriptions WHERE customer_id = $1`, [cid]).catch(() => {});
      await pool.query(`DELETE FROM comm_customers WHERE id = $1`, [cid]).catch(() => {});
    }
  }
  await pool.query(`DELETE FROM mfa_codes WHERE lower(email) = lower($1)`, [ADMIN_EMAIL]).catch(() => {});
  await pool.query(`DELETE FROM users WHERE lower(username) = lower($1)`, [ADMIN_EMAIL]).catch(() => {});
  await pool.query(`DELETE FROM comm_plans WHERE id = $1`, [PLAN_ID]).catch(() => {});
  await pool.query(`DELETE FROM comm_products WHERE id = $1`, [PRODUCT_ID]).catch(() => {});
}

async function seed() {
  // Super-admin operator (passport local strategy authenticates by username).
  await pool.query(
    `INSERT INTO users (username, password, full_name, role, roles, email)
     VALUES ($1, $2, 'Usage HTTP Admin', 'super_admin', ARRAY['super_admin']::text[], $1)`,
    [ADMIN_EMAIL, await hashPassword(ADMIN_PASSWORD)],
  );

  // A plan that DECLARES both quotas; both metered identities subscribe to it.
  await pool.query(
    `INSERT INTO comm_products (id, code, name, segment)
     VALUES ($1,'task19_product','Task 19 Product','career_builder')
     ON CONFLICT (id) DO NOTHING`,
    [PRODUCT_ID],
  );
  await pool.query(
    `INSERT INTO comm_plans (id, product_id, code, name, billing_interval, price_paise, currency, metadata)
     VALUES ($1,$2,'task19_plan','Task 19 Plan','monthly',0,'INR',$3::jsonb)
     ON CONFLICT (id) DO UPDATE SET metadata = EXCLUDED.metadata`,
    [PLAN_ID, PRODUCT_ID, JSON.stringify({ quotas: { assessments: ASSESS_QUOTA, storage: STORAGE_CAP } })],
  );

  for (const email of [ID_A, ID_B]) {
    const cust = await pool.query(
      `INSERT INTO comm_customers (email, name, segment) VALUES ($1,'Task 19','career_builder')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [email],
    );
    await pool.query(
      `INSERT INTO comm_subscriptions (customer_id, plan_id, status, current_period_start, current_period_end)
       VALUES ($1,$2,'active', date_trunc('month', now()), now() + interval '20 days')`,
      [String(cust.rows[0].id), PLAN_ID],
    );
  }
}

// ── Backend API lifecycle ───────────────────────────────────────────────────────────────────────
let server: ChildProcess | null = null;

function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server = spawn('npx', ['tsx', 'index.ts'], {
      cwd: process.cwd(), // validation cmd runs from backend/
      env: {
        ...process.env,
        PORT: String(PORT),
        NODE_ENV: 'development',         // dev → super-admin MFA bypass available
        ZOHO_EMAIL: '',                  // no email delivery → MFA bypassed in dev login
        FF_COMMERCIAL_USAGE_METERING: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let settled = false;
    const onData = (b: Buffer) => {
      const s = b.toString();
      if (!settled && /Server listening/i.test(s)) { settled = true; resolve(); }
    };
    server.stdout?.on('data', onData);
    server.stderr?.on('data', (b: Buffer) => { if (/Server listening/i.test(b.toString())) { if (!settled) { settled = true; resolve(); } } });
    server.on('exit', (code) => { if (!settled) { settled = true; reject(new Error(`server exited early (code ${code})`)); } });
    setTimeout(() => { if (!settled) { settled = true; reject(new Error('server start timeout')); } }, 90_000);
  });
}

async function waitForReady(): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      // Unauthenticated probe of an auth-guarded route → 401 once the server is serving.
      const res = await fetch(`${BASE}/api/commercial/metering/check?usage_type=assessments`);
      if (res.status === 401 || res.status === 503 || res.status === 400) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server did not become ready');
}

function stopServer() {
  if (server && !server.killed) {
    server.kill('SIGTERM');
    setTimeout(() => { if (server && !server.killed) server.kill('SIGKILL'); }, 2000);
  }
}

// ── Auth helpers ──────────────────────────────────────────────────────────────────────────────
function pickSetCookie(res: Response): string | null {
  const getter = (res.headers as any).getSetCookie?.bind(res.headers);
  const list: string[] = getter ? getter() : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie') as string] : []);
  const sid = list.map((c) => c.split(';')[0]).find((c) => c.startsWith('connect.sid='));
  return sid ?? (list[0] ? list[0].split(';')[0] : null);
}

async function loginSuperAdmin(): Promise<string> {
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  let cookie = pickSetCookie(res);
  const body = await res.json().catch(() => ({} as any));
  // Robustness: if the dev MFA bypass is NOT active (ZOHO configured), complete the MFA challenge by
  // reading the emitted code straight from the DB (no email delivery in this harness).
  if (body?.mfaRequired && body?.attemptToken) {
    const { rows } = await pool.query(
      `SELECT code FROM mfa_codes WHERE attempt_token = $1 AND used = false ORDER BY created_at DESC LIMIT 1`,
      [body.attemptToken],
    );
    const code = rows[0]?.code;
    const vres = await fetch(`${BASE}/api/admin/mfa/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({ code, attemptToken: body.attemptToken }),
    });
    cookie = pickSetCookie(vres) ?? cookie;
  }
  if (!cookie) throw new Error('login did not yield a session cookie');
  return cookie;
}

interface PostOutcome { status: number; reason?: string }
async function postRecord(cookie: string, email: string, usageType: string, quantity: number): Promise<PostOutcome> {
  try {
    const res = await fetch(`${BASE}/api/commercial/metering/record`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ email, usage_type: usageType, quantity }),
    });
    const body = await res.json().catch(() => ({} as any));
    return { status: res.status, reason: body?.error ?? body?.quota?.reason };
  } catch (e: any) {
    return { status: -1, reason: `fetch_error:${e?.message ?? 'unknown'}` };
  }
}

async function ledgerCount(email: string, usageType: string): Promise<number> {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM comm_usage_events WHERE lower(email) = lower($1) AND usage_type = $2`,
    [email, usageType],
  );
  return r.rows[0].n;
}

async function main() {
  await cleanup();
  await seed();

  console.log(`\n[boot] starting Backend API on :${PORT} with FF_COMMERCIAL_USAGE_METERING=1`);
  await startServer();
  await waitForReady();
  console.log('[boot] Backend API ready');

  const cookie = await loginSuperAdmin();
  ok('super-admin authenticated (session cookie issued)', !!cookie);

  // Sanity: unauthenticated record is rejected by the route guard (proves auth is wired).
  const anon = await fetch(`${BASE}/api/commercial/metering/record`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: ID_A, usage_type: 'assessments', quantity: 1 }),
  });
  ok('unauthenticated POST /record → 401 (auth guard active)', anon.status === 401, anon.status);

  // ── A. period_count storm (assessments) ─────────────────────────────────────────────────────
  console.log(`\n[A] HTTP period_count storm — ${RACERS} parallel POSTs at quota ${ASSESS_QUOTA} (assessments)`);
  const aResults = await Promise.all(
    Array.from({ length: RACERS }, () => postRecord(cookie, ID_A, 'assessments', 1)),
  );
  const a201 = aResults.filter((r) => r.status === 201).length;
  const a429 = aResults.filter((r) => r.status === 429).length;
  const aOther = aResults.filter((r) => r.status !== 201 && r.status !== 429);
  ok('no request errored / returned an unexpected status', aOther.length === 0, aOther);
  ok(`exactly ${ASSESS_QUOTA} POSTs returned 201`, a201 === ASSESS_QUOTA, { a201, a429 });
  ok(`remaining ${RACERS - ASSESS_QUOTA} POSTs returned 429`, a429 === RACERS - ASSESS_QUOTA, { a201, a429 });
  ok('every 429 cited quota_exceeded', aResults.filter((r) => r.status === 429).every((r) => r.reason === 'quota_exceeded'),
    aResults.filter((r) => r.status === 429).map((r) => r.reason));
  const aLedger = await ledgerCount(ID_A, 'assessments');
  ok(`ledger holds exactly ${ASSESS_QUOTA} rows (no overrun via HTTP)`, aLedger === ASSESS_QUOTA, { aLedger });

  // ── B. level storm (storage) ────────────────────────────────────────────────────────────────
  // A `level` quota is an absolute ceiling: a reading <= cap is allowed, a reading > cap refused.
  // Half the storm writes UNDER the ceiling (must 201), half writes OVER it (must 429), all racing.
  console.log(`\n[B] HTTP level storm — ${RACERS} parallel POSTs at ceiling ${STORAGE_CAP} (storage)`);
  const under = STORAGE_CAP - 1; // <= cap → allowed
  const over = STORAGE_CAP + 5;  // >  cap → refused
  const bSpec = Array.from({ length: RACERS }, (_unused, i) => (i % 2 === 0 ? under : over));
  const expectedUnder = bSpec.filter((q) => q <= STORAGE_CAP).length;
  const expectedOver = bSpec.filter((q) => q > STORAGE_CAP).length;
  const bResults = await Promise.all(bSpec.map((q) => postRecord(cookie, ID_B, 'storage', q)));
  const b201 = bResults.filter((r) => r.status === 201).length;
  const b429 = bResults.filter((r) => r.status === 429).length;
  const bOther = bResults.filter((r) => r.status !== 201 && r.status !== 429);
  ok('no request errored / returned an unexpected status', bOther.length === 0, bOther);
  ok(`under-ceiling readings all 201 (count ${expectedUnder})`, b201 === expectedUnder, { b201, expectedUnder });
  ok(`over-ceiling readings all 429 (count ${expectedOver})`, b429 === expectedOver, { b429, expectedOver });
  ok('every 429 cited quota_exceeded', bResults.filter((r) => r.status === 429).every((r) => r.reason === 'quota_exceeded'),
    bResults.filter((r) => r.status === 429).map((r) => r.reason));
  const bMax = await pool.query(
    `SELECT COALESCE(MAX(quantity), 0)::int AS m FROM comm_usage_events WHERE lower(email) = lower($1) AND usage_type = 'storage'`,
    [ID_B],
  );
  ok(`ledger never recorded a reading above the ceiling (max <= ${STORAGE_CAP})`, bMax.rows[0].m <= STORAGE_CAP, bMax.rows[0]);
  const bLedger = await ledgerCount(ID_B, 'storage');
  ok(`ledger holds exactly the ${expectedUnder} allowed readings`, bLedger === expectedUnder, { bLedger, expectedUnder });

  // ── C. mixed identities + types in ONE storm ────────────────────────────────────────────────
  // Reset the spent quotas so each (identity,type) starts fresh, then race them all together. The
  // per-(identity,type) advisory lock must hold each cap independently — no cross-contamination.
  console.log(`\n[C] HTTP mixed storm — two identities \u00d7 two types racing together`);
  await pool.query(`DELETE FROM comm_usage_events WHERE lower(email) IN (lower($1), lower($2))`, [ID_A, ID_B]);
  const mixed: { email: string; type: string; q: number }[] = [];
  for (let i = 0; i < RACERS; i++) mixed.push({ email: ID_A, type: 'assessments', q: 1 });
  for (let i = 0; i < RACERS; i++) mixed.push({ email: ID_B, type: 'assessments', q: 1 });
  for (let i = 0; i < RACERS; i++) mixed.push({ email: ID_A, type: 'storage', q: over }); // all over ceiling
  // shuffle so the storm interleaves identities/types
  for (let i = mixed.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [mixed[i], mixed[j]] = [mixed[j], mixed[i]]; }
  const cResults = await Promise.all(mixed.map((m) => postRecord(cookie, m.email, m.type, m.q)));
  const cBad = cResults.filter((r) => r.status !== 201 && r.status !== 429);
  ok('no request errored / returned an unexpected status', cBad.length === 0, cBad);
  const aAssessLedger = await ledgerCount(ID_A, 'assessments');
  const bAssessLedger = await ledgerCount(ID_B, 'assessments');
  const aStorageLedger = await ledgerCount(ID_A, 'storage');
  ok(`identity A assessments capped at ${ASSESS_QUOTA} (independent lock)`, aAssessLedger === ASSESS_QUOTA, { aAssessLedger });
  ok(`identity B assessments capped at ${ASSESS_QUOTA} (no cross-contamination)`, bAssessLedger === ASSESS_QUOTA, { bAssessLedger });
  ok('identity A over-ceiling storage all refused (0 rows)', aStorageLedger === 0, { aStorageLedger });

  await cleanup();
  stopServer();
  await pool.end();
  console.log(`\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 ${pass} passed, ${fail} failed \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
  process.exit(fail === 0 ? 0 : 1);
}

async function fatal(e: unknown) {
  console.error('CONCURRENCY HTTP SMOKE FATAL', e);
  await cleanup().catch(() => {});
  stopServer();
  await pool.end().catch(() => {});
  process.exit(1);
}

process.on('SIGINT', () => { stopServer(); process.exit(1); });
process.on('SIGTERM', () => { stopServer(); process.exit(1); });

main().catch(fatal);
