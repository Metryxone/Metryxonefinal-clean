/**
 * Task #28 — Credit-ISSUE HTTP-LEVEL concurrency regression (self-cleaning, @example.com only).
 *
 * Task #25 proved the credit ledger cannot be OVER-DRAWN under a storm of parallel spends (debits).
 * This closes the symmetric gap on the WRITE that ADDS value: `issueCredit` in
 * backend/services/commercial/credit-ledger-runtime.ts — the serialized writer behind the
 * refund-to-credit / goodwill-credit flows, reached over HTTP via
 * `POST /api/commercial/admin/customers/:id/credit/issue` (gated by `commercialSubscriptions`).
 *
 * issueCredit serializes on the per-customer row lock (SELECT ... FOR UPDATE on comm_customers) so it
 * reads the derived balance (SUM credit − debit) and writes the new `balance_after_paise` snapshot
 * atomically. If that lock failed to hold, two simultaneous credit-issue requests for the SAME
 * customer (e.g. a retried refund webhook) could each read the SAME prior balance and write
 * INCONSISTENT running-balance snapshots — the SUM would still be right (every entry is positive) but
 * the audit's `balance_after_paise` trail would be corrupted: two rows claiming the same running
 * balance, or a snapshot that doesn't equal prior + its own amount.
 *
 * It STARTS a real Backend API (FF_COMMERCIAL_SUBSCRIPTIONS=1 — the admin credit/issue route is gated
 * by the `commercialSubscriptions` flag), logs in as a super-admin, seeds an empty-wallet customer,
 * and fires N parallel AUTHENTICATED credit-issue POSTs (with DISTINCT amounts so the running-balance
 * snapshots are order-sensitive). It asserts:
 *
 *   A. Single-customer issue storm: every request succeeds (201); the derived balance equals the SUM
 *      of issued amounts; the ledger has exactly N credit rows; every `balance_after_paise` snapshot is
 *      DISTINCT (no two rows claim the same running balance); and the snapshots form a valid serialized
 *      chain — sorted ascending with 0 prepended, the consecutive deltas are a PERMUTATION of the
 *      requested amounts (i.e. each snapshot == prior + exactly one issued amount, consistent with
 *      append order), with the final snapshot equal to the derived balance.
 *   B. Two customers racing together in ONE storm: the per-customer row lock holds each wallet
 *      independently — no cross-contamination; each customer's snapshots form their own valid chain and
 *      each derived balance equals only that customer's issued total.
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

const PORT = 8101;
const BASE = `http://127.0.0.1:${PORT}`;

const ADMIN_EMAIL = 'credits-issue-admin@example.com';
const ADMIN_PASSWORD = 'credits-issue-concurrency-test-28';
const ID_A = 'credits-issue-storm-a@example.com';
const ID_B = 'credits-issue-storm-b@example.com';

// Distinct amounts (paise) so the running-balance snapshots are order-sensitive — a race that reads a
// stale prior balance would produce a snapshot chain whose deltas no longer match the issued amounts.
const AMOUNTS_A = [100, 250, 175, 500, 325, 410, 60, 740, 215, 905, 130, 670];
const AMOUNTS_B = [200, 350, 90, 615, 480, 145, 730, 55];

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) { pass++; console.log(`  \u2713 ${name}`); }
  else { fail++; console.log(`  \u2717 ${name}`, detail !== undefined ? JSON.stringify(detail) : ''); }
};

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
  await pool.query(
    `INSERT INTO users (username, password, full_name, role, roles, email)
     VALUES ($1, $2, 'Credits Issue Admin', 'super_admin', ARRAY['super_admin']::text[], $1)`,
    [ADMIN_EMAIL, await hashPassword(ADMIN_PASSWORD)],
  );
  // Empty-wallet customers (no seed ledger rows — the storm is the only writer).
  for (const email of [ID_A, ID_B]) {
    await pool.query(
      `INSERT INTO comm_customers (email, name, segment) VALUES ($1,'Task 28','career_builder')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name`,
      [email],
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
        FF_COMMERCIAL_SUBSCRIPTIONS: '1',
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
      // Unauthenticated probe of an auth-guarded route → 401/403/503 once the server is serving.
      const res = await fetch(`${BASE}/api/commercial/admin/customers`);
      if ([401, 403, 503, 400].includes(res.status)) return;
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
async function postIssue(cookie: string, cid: string, amount: number): Promise<PostOutcome> {
  try {
    const res = await fetch(`${BASE}/api/commercial/admin/customers/${cid}/credit/issue`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ amount_paise: amount, reason: 'task28_storm', ref_type: 'refund', ref_id: 'task28' }),
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

/** All balance_after snapshots for a customer (ascending — the order is irrelevant to the chain check). */
async function snapshots(cid: string): Promise<number[]> {
  const r = await pool.query(
    `SELECT balance_after_paise::int AS b FROM comm_credit_ledger
       WHERE customer_id = $1 AND entry_type = 'credit' ORDER BY balance_after_paise ASC`,
    [cid],
  );
  return r.rows.map((x: any) => x.b);
}

const sortedEq = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort((x, y) => x - y).every((v, i) => v === [...b].sort((x, y) => x - y)[i]);

/**
 * A correctly-serialized append-only credit chain: snapshots ascending, all DISTINCT, and with 0
 * prepended the consecutive deltas are a PERMUTATION of the issued amounts (each snapshot == prior +
 * exactly one issued amount). Returns the failing reason or null when the chain is valid.
 */
function chainViolation(snaps: number[], amounts: number[]): string | null {
  if (snaps.length !== amounts.length) return `row count ${snaps.length} != issued ${amounts.length}`;
  const distinct = new Set(snaps);
  if (distinct.size !== snaps.length) return 'duplicate balance_after snapshot (two rows claim the same running balance)';
  const deltas: number[] = [];
  let prev = 0;
  for (const s of snaps) { deltas.push(s - prev); prev = s; }
  if (!sortedEq(deltas, amounts)) return `snapshot deltas ${JSON.stringify(deltas)} are not a permutation of issued amounts ${JSON.stringify(amounts)}`;
  return null;
}

async function main() {
  await cleanup();
  await seed();

  console.log(`\n[boot] starting Backend API on :${PORT} with FF_COMMERCIAL_SUBSCRIPTIONS=1`);
  await startServer();
  await waitForReady();
  console.log('[boot] Backend API ready');

  const cookie = await loginSuperAdmin();
  ok('super-admin authenticated (session cookie issued)', !!cookie);

  const cidA = (await customerIdFor(ID_A))!;
  const cidB = (await customerIdFor(ID_B))!;
  ok('both wallet customers seeded', !!cidA && !!cidB);

  // Sanity: unauthenticated issue is rejected by the route guard (proves auth is wired).
  const anon = await fetch(`${BASE}/api/commercial/admin/customers/${cidA}/credit/issue`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount_paise: 100 }),
  });
  ok('unauthenticated POST /credit/issue → 401/403 (auth guard active)', anon.status === 401 || anon.status === 403, anon.status);

  // ── A. single-customer issue storm ───────────────────────────────────────────────────────────
  const totalA = AMOUNTS_A.reduce((s, x) => s + x, 0);
  console.log(`\n[A] credit-issue storm — ${AMOUNTS_A.length} parallel issues (Σ=${totalA}) against an empty wallet`);
  const aResults = await Promise.all(AMOUNTS_A.map((amt) => postIssue(cookie, cidA, amt)));
  const a201 = aResults.filter((r) => r.status === 201).length;
  const aBad = aResults.filter((r) => r.status !== 201);
  ok('every credit-issue returned 201 (no errors)', aBad.length === 0, aBad);
  ok(`exactly ${AMOUNTS_A.length} issues returned 201`, a201 === AMOUNTS_A.length, { a201 });

  const aBal = await balanceFor(cidA);
  ok('derived balance == SUM of issued amounts', aBal === totalA, { aBal, totalA });

  const aSnaps = await snapshots(cidA);
  ok(`ledger has exactly ${AMOUNTS_A.length} credit rows`, aSnaps.length === AMOUNTS_A.length, { rows: aSnaps.length });
  ok('all balance_after snapshots are DISTINCT (no two rows claim the same running balance)',
    new Set(aSnaps).size === aSnaps.length, { aSnaps });
  const aViol = chainViolation(aSnaps, AMOUNTS_A);
  ok('snapshots form a valid serialized chain (deltas == permutation of issued amounts)', aViol === null, aViol);
  ok('final (max) snapshot equals the derived balance', Math.max(...aSnaps) === aBal, { max: Math.max(...aSnaps), aBal });

  // ── B. two customers racing together in ONE storm ────────────────────────────────────────────
  // The per-customer row lock must keep each wallet's chain independent — no cross-contamination.
  console.log(`\n[B] two-customer storm — A (${AMOUNTS_A.length} issues) and B (${AMOUNTS_B.length} issues) racing together`);
  await pool.query(`DELETE FROM comm_credit_ledger WHERE customer_id = $1`, [cidA]);
  const totalB = AMOUNTS_B.reduce((s, x) => s + x, 0);
  const mixed: { cid: string; amount: number }[] = [
    ...AMOUNTS_A.map((amount) => ({ cid: cidA, amount })),
    ...AMOUNTS_B.map((amount) => ({ cid: cidB, amount })),
  ];
  for (let i = mixed.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [mixed[i], mixed[j]] = [mixed[j], mixed[i]]; }
  const bResults = await Promise.all(mixed.map((m) => postIssue(cookie, m.cid, m.amount)));
  ok('no request errored / returned an unexpected status', bResults.every((r) => r.status === 201), bResults.filter((r) => r.status !== 201));

  const balA = await balanceFor(cidA);
  const balB = await balanceFor(cidB);
  ok('A derived balance == only A\u2019s issued total (no cross-contamination)', balA === totalA, { balA, totalA });
  ok('B derived balance == only B\u2019s issued total (no cross-contamination)', balB === totalB, { balB, totalB });
  const aViol2 = chainViolation(await snapshots(cidA), AMOUNTS_A);
  const bViol2 = chainViolation(await snapshots(cidB), AMOUNTS_B);
  ok('A snapshots form a valid serialized chain under the mixed storm', aViol2 === null, aViol2);
  ok('B snapshots form a valid serialized chain under the mixed storm', bViol2 === null, bViol2);

  await cleanup();
  stopServer();
  await pool.end();
  console.log(`\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 ${pass} passed, ${fail} failed \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
  process.exit(fail === 0 ? 0 : 1);
}

async function fatal(e: unknown) {
  console.error('CREDITS ISSUE CONCURRENCY HTTP SMOKE FATAL', e);
  await cleanup().catch(() => {});
  stopServer();
  await pool.end().catch(() => {});
  process.exit(1);
}

async function onSignal() {
  await cleanup().catch(() => {});
  stopServer();
  await pool.end().catch(() => {});
  process.exit(1);
}
process.on('SIGINT', () => { void onSignal(); });
process.on('SIGTERM', () => { void onSignal(); });

main().catch(fatal);
