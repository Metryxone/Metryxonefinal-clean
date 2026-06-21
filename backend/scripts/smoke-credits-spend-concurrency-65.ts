/**
 * Task #25 — Credits balance HTTP-LEVEL concurrency regression (self-cleaning, @example.com only).
 *
 * The "credits" business dimension is a CONSUMABLE BALANCE backed by the append-only credit ledger
 * (comm_credit_ledger) — distinct from the usage-event quota path (comm_usage_events). It is drawn
 * down via `POST /api/commercial/metering/credits/spend`, which FAILS CLOSED (402) on insufficient
 * balance. The credit ledger's writer (applyCredit) serializes on a per-customer row lock so the
 * derived balance (SUM credit − debit) is read-then-written atomically.
 *
 * The usage-event path has an HTTP concurrency storm test (smoke-usage-metering-concurrency-65.ts),
 * but the credits path had NO regression proving that N simultaneous spend requests against the SAME
 * customer balance cannot overdraw it (the classic read-then-write race). This closes that gap.
 *
 * It STARTS a real Backend API (FF_COMMERCIAL_USAGE_METERING=1 — the credits/spend route is gated by
 * the same `commercialUsageMetering` flag), logs in as a super-admin, seeds a customer with a balance
 * SMALLER than the total about to be requested, and fires N parallel AUTHENTICATED spend POSTs. It
 * asserts:
 *
 *   A. Single-customer overdraw storm: RACERS parallel spends of SPEND paise against a balance of
 *      START paise (START < RACERS×SPEND) → exactly floor(START/SPEND) succeed (201), the rest are
 *      refused with the FAIL-CLOSED status (402, insufficient_balance), the final balance never goes
 *      negative, no ledger row snapshots a negative balance_after, and the debits sum to NO MORE than
 *      the starting balance.
 *   B. Two customers racing together in ONE storm: the per-customer row lock must hold each balance
 *      independently — no cross-contamination, each capped at its own starting balance.
 *
 * Identity note: the spend route meters the SERVER-authenticated principal; a client-supplied email is
 * honoured ONLY for a super-admin (acting-on-behalf). We authenticate as a super-admin and pass the
 * customer identity via the `email` override — the only authenticated HTTP path that can spend for a
 * chosen identity.
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

const PORT = 8100;
const BASE = `http://127.0.0.1:${PORT}`;

// Super-admin operator (authenticated principal) + the wallet identities (override targets).
const ADMIN_EMAIL = 'credits-http-admin@example.com';
const ADMIN_PASSWORD = 'credits-concurrency-test-65';
const ID_A = 'credits-http-storm-a@example.com';
const ID_B = 'credits-http-storm-b@example.com';
const ALL_EMAILS = [ADMIN_EMAIL, ID_A, ID_B];

const START_A = 1000;   // seeded balance for A (paise)
const START_B = 700;    // seeded balance for B (paise)
const SPEND = 100;      // each spend draws this many paise
const RACERS = 15;      // parallel spend requests per storm (15×100 = 1500 > either balance)

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

async function customerIdFor(email: string): Promise<string | null> {
  return pool
    .query(`SELECT id FROM comm_customers WHERE lower(email) = lower($1)`, [email])
    .then((r) => (r.rows[0] ? String(r.rows[0].id) : null))
    .catch(() => null);
}

async function cleanup() {
  for (const email of [ID_A, ID_B]) {
    const cid = await customerIdFor(email);
    if (cid) {
      await pool.query(`DELETE FROM comm_credit_ledger WHERE customer_id = $1`, [cid]).catch(() => {});
      await pool.query(`DELETE FROM comm_customers WHERE id = $1`, [cid]).catch(() => {});
    }
  }
  await pool.query(`DELETE FROM mfa_codes WHERE lower(email) = lower($1)`, [ADMIN_EMAIL]).catch(() => {});
  await pool.query(`DELETE FROM users WHERE lower(username) = lower($1)`, [ADMIN_EMAIL]).catch(() => {});
}

async function seed() {
  // Super-admin operator (passport local strategy authenticates by username).
  await pool.query(
    `INSERT INTO users (username, password, full_name, role, roles, email)
     VALUES ($1, $2, 'Credits HTTP Admin', 'super_admin', ARRAY['super_admin']::text[], $1)`,
    [ADMIN_EMAIL, await hashPassword(ADMIN_PASSWORD)],
  );

  // A customer per wallet, each seeded with a starting credit balance (one append-only credit entry).
  for (const [email, start] of [[ID_A, START_A], [ID_B, START_B]] as const) {
    const cust = await pool.query(
      `INSERT INTO comm_customers (email, name, segment) VALUES ($1,'Task 25','career_builder')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [email],
    );
    const cid = String(cust.rows[0].id);
    await pool.query(
      `INSERT INTO comm_credit_ledger (customer_id, entry_type, amount_paise, currency, reason, balance_after_paise)
       VALUES ($1,'credit',$2,'INR','task25_seed',$2)`,
      [cid, start],
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
      const res = await fetch(`${BASE}/api/commercial/metering/credits/balance`);
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
async function postSpend(cookie: string, email: string, amount: number): Promise<PostOutcome> {
  try {
    const res = await fetch(`${BASE}/api/commercial/metering/credits/spend`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ email, amount, reason: 'task25_storm' }),
    });
    const body = await res.json().catch(() => ({} as any));
    return { status: res.status, reason: body?.error ?? body?.reason };
  } catch (e: any) {
    return { status: -1, reason: `fetch_error:${e?.message ?? 'unknown'}` };
  }
}

async function balanceFor(cid: string): Promise<number> {
  const r = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount_paise ELSE -amount_paise END), 0)::int AS bal
       FROM comm_credit_ledger WHERE customer_id = $1`,
    [cid],
  );
  return r.rows[0].bal;
}

async function debitSum(cid: string): Promise<number> {
  const r = await pool.query(
    `SELECT COALESCE(SUM(amount_paise), 0)::int AS s FROM comm_credit_ledger WHERE customer_id = $1 AND entry_type='debit'`,
    [cid],
  );
  return r.rows[0].s;
}

async function minBalanceAfter(cid: string): Promise<number> {
  const r = await pool.query(
    `SELECT COALESCE(MIN(balance_after_paise), 0)::int AS m FROM comm_credit_ledger WHERE customer_id = $1`,
    [cid],
  );
  return r.rows[0].m;
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

  // Sanity: unauthenticated spend is rejected by the route guard (proves auth is wired).
  const anon = await fetch(`${BASE}/api/commercial/metering/credits/spend`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: ID_A, amount: SPEND }),
  });
  ok('unauthenticated POST /credits/spend → 401 (auth guard active)', anon.status === 401, anon.status);

  const cidA = (await customerIdFor(ID_A))!;
  const cidB = (await customerIdFor(ID_B))!;
  ok('both wallet customers seeded', !!cidA && !!cidB);

  // ── A. single-customer overdraw storm ────────────────────────────────────────────────────────
  const expectedSuccessA = Math.floor(START_A / SPEND); // exactly this many spends can clear
  console.log(`\n[A] credits overdraw storm — ${RACERS} parallel spends of ${SPEND} against balance ${START_A}`);
  const aResults = await Promise.all(
    Array.from({ length: RACERS }, () => postSpend(cookie, ID_A, SPEND)),
  );
  const a201 = aResults.filter((r) => r.status === 201).length;
  const a402 = aResults.filter((r) => r.status === 402).length;
  const aOther = aResults.filter((r) => r.status !== 201 && r.status !== 402);
  ok('no request errored / returned an unexpected status', aOther.length === 0, aOther);
  ok(`exactly ${expectedSuccessA} spends returned 201`, a201 === expectedSuccessA, { a201, a402 });
  ok(`remaining ${RACERS - expectedSuccessA} spends returned 402 (fail-closed)`, a402 === RACERS - expectedSuccessA, { a201, a402 });
  ok('every 402 cited insufficient_balance', aResults.filter((r) => r.status === 402).every((r) => r.reason === 'insufficient_balance'),
    aResults.filter((r) => r.status === 402).map((r) => r.reason));
  const aBal = await balanceFor(cidA);
  ok('balance never went negative (final >= 0)', aBal >= 0, { aBal });
  ok('final balance == start − (successful spends × SPEND)', aBal === START_A - expectedSuccessA * SPEND, { aBal });
  const aDebits = await debitSum(cidA);
  ok('debits sum to NO MORE than the starting balance', aDebits <= START_A, { aDebits, START_A });
  ok(`debits sum == ${expectedSuccessA * SPEND} (exactly the cleared spends)`, aDebits === expectedSuccessA * SPEND, { aDebits });
  const aMin = await minBalanceAfter(cidA);
  ok('no ledger row snapshotted a negative balance_after', aMin >= 0, { aMin });

  // ── B. two customers racing together in ONE storm ────────────────────────────────────────────
  // Reset A's wallet so both customers start fresh, then race their overdraw storms interleaved. The
  // per-customer row lock must hold each balance independently — no cross-contamination.
  console.log(`\n[B] two-customer storm — A(balance ${START_A}) and B(balance ${START_B}) racing together`);
  await pool.query(`DELETE FROM comm_credit_ledger WHERE customer_id = $1`, [cidA]);
  await pool.query(
    `INSERT INTO comm_credit_ledger (customer_id, entry_type, amount_paise, currency, reason, balance_after_paise)
     VALUES ($1,'credit',$2,'INR','task25_seed',$2)`,
    [cidA, START_A],
  );
  const expectedSuccessB = Math.floor(START_B / SPEND);
  const mixed: { email: string; cid: string }[] = [];
  for (let i = 0; i < RACERS; i++) mixed.push({ email: ID_A, cid: cidA });
  for (let i = 0; i < RACERS; i++) mixed.push({ email: ID_B, cid: cidB });
  for (let i = mixed.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [mixed[i], mixed[j]] = [mixed[j], mixed[i]]; }
  const bResults = await Promise.all(mixed.map((m) => postSpend(cookie, m.email, SPEND)));
  const bBad = bResults.filter((r) => r.status !== 201 && r.status !== 402);
  ok('no request errored / returned an unexpected status', bBad.length === 0, bBad);
  const balA = await balanceFor(cidA);
  const balB = await balanceFor(cidB);
  const debA = await debitSum(cidA);
  const debB = await debitSum(cidB);
  ok('A balance never negative + capped to its own wallet', balA >= 0 && debA <= START_A, { balA, debA });
  ok('B balance never negative + capped to its own wallet (no cross-contamination)', balB >= 0 && debB <= START_B, { balB, debB });
  ok(`A cleared exactly ${expectedSuccessA} spends`, debA === expectedSuccessA * SPEND, { debA });
  ok(`B cleared exactly ${expectedSuccessB} spends`, debB === expectedSuccessB * SPEND, { debB });

  await cleanup();
  stopServer();
  await pool.end();
  console.log(`\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 ${pass} passed, ${fail} failed \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
  process.exit(fail === 0 ? 0 : 1);
}

async function fatal(e: unknown) {
  console.error('CREDITS CONCURRENCY HTTP SMOKE FATAL', e);
  await cleanup().catch(() => {});
  stopServer();
  await pool.end().catch(() => {});
  process.exit(1);
}

process.on('SIGINT', () => { stopServer(); process.exit(1); });
process.on('SIGTERM', () => { stopServer(); process.exit(1); });

main().catch(fatal);
