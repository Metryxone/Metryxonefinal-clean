/**
 * Task #29 — Credit-ISSUE idempotency regression (self-cleaning, @example.com only).
 *
 * Task #28 proved the per-customer row lock keeps the running-balance audit trail consistent under a
 * storm of parallel credit-issues. But serialization is NOT dedup: two retried refund webhooks (same
 * gateway refund id) would each append a SEPARATE, valid credit entry — DOUBLING the store value.
 *
 * This closes that gap. `issueCredit` (backend/services/commercial/credit-ledger-runtime.ts), reached
 * over HTTP via `POST /api/commercial/admin/customers/:id/credit/issue` (gated by
 * `commercialSubscriptions`), now dedups on a caller-supplied idempotency key (Idempotency-Key header
 * or body.idempotency_key) OR on the refund identity (body.dedupe_by_ref + ref_type/ref_id). The
 * dedup runs INSIDE the held per-customer lock and is backed by a partial unique index on
 * (customer_id, idempotency_key).
 *
 * It STARTS a real Backend API (FF_COMMERCIAL_SUBSCRIPTIONS=1), logs in as a super-admin, seeds an
 * empty-wallet customer, and asserts:
 *
 *   A. Same logical refund-to-credit fired TWICE with the SAME Idempotency-Key → exactly ONE credit
 *      row; the second response is 200 deduped:true; balance == one grant (never doubled).
 *   B. A STORM of N parallel issues with the SAME key → still exactly ONE credit row.
 *   C. The ref-based opt-in path (dedupe_by_ref:true + same ref_type/ref_id) → exactly ONE credit row.
 *   D. CONTROL — existing key-less callers are byte-identical: two issues with the SAME ref but NO key
 *      and NO dedupe flag → TWO credit rows (unchanged append-only behaviour).
 *   E. Distinct keys → distinct credit rows (dedup is per-key, not a global suppressor).
 *
 * All test data is keyed by *@example.com and deleted at the end (and on failure / on signal). Spawns
 * the API on a private PORT; the shared dev DB is written only under @example.com and purged.
 */
import pg from 'pg';
import { spawn, type ChildProcess } from 'child_process';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const scryptAsync = promisify(scrypt);

const PORT = 8102;
const BASE = `http://127.0.0.1:${PORT}`;

const ADMIN_EMAIL = 'credits-idem-admin@example.com';
const ADMIN_PASSWORD = 'credits-issue-idempotency-test-29';
const ID_A = 'credits-idem-wallet-a@example.com';

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
  const cid = await customerIdFor(ID_A);
  if (cid) {
    await pool.query(`DELETE FROM comm_credit_ledger WHERE customer_id = $1`, [cid]).catch(() => {});
    await pool.query(`DELETE FROM comm_customers WHERE id = $1`, [cid]).catch(() => {});
  }
  await pool.query(`DELETE FROM mfa_codes WHERE lower(email) = lower($1)`, [ADMIN_EMAIL]).catch(() => {});
  await pool.query(`DELETE FROM users WHERE lower(username) = lower($1)`, [ADMIN_EMAIL]).catch(() => {});
}

async function seed() {
  await pool.query(
    `INSERT INTO users (username, password, full_name, role, roles, email)
     VALUES ($1, $2, 'Credits Idem Admin', 'super_admin', ARRAY['super_admin']::text[], $1)`,
    [ADMIN_EMAIL, await hashPassword(ADMIN_PASSWORD)],
  );
  await pool.query(
    `INSERT INTO comm_customers (email, name, segment) VALUES ($1,'Task 29','career_builder')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name`,
    [ID_A],
  );
}

// ── Backend API lifecycle ───────────────────────────────────────────────────────────────────────
let server: ChildProcess | null = null;

function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server = spawn('npx', ['tsx', 'index.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(PORT),
        NODE_ENV: 'development',
        ZOHO_EMAIL: '',
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

interface PostOutcome { status: number; deduped?: boolean; reason?: string }
async function postIssue(
  cookie: string, cid: string, amount: number,
  opts: { idemKey?: string; body?: Record<string, unknown> } = {},
): Promise<PostOutcome> {
  try {
    const res = await fetch(`${BASE}/api/commercial/admin/customers/${cid}/credit/issue`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie,
        ...(opts.idemKey ? { 'Idempotency-Key': opts.idemKey } : {}),
      },
      body: JSON.stringify({ amount_paise: amount, reason: 'task29', ...(opts.body ?? {}) }),
    });
    const body = await res.json().catch(() => ({} as any));
    return { status: res.status, deduped: body?.deduped, reason: body?.error ?? body?.reason };
  } catch (e: any) {
    return { status: -1, reason: `fetch_error:${e?.message ?? 'unknown'}` };
  }
}

async function creditRowCount(cid: string): Promise<number> {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM comm_credit_ledger WHERE customer_id = $1 AND entry_type = 'credit'`,
    [cid],
  );
  return r.rows[0].n;
}

async function balanceFor(cid: string): Promise<number> {
  const r = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount_paise ELSE -amount_paise END), 0)::int AS bal
       FROM comm_credit_ledger WHERE customer_id = $1`,
    [cid],
  );
  return r.rows[0].bal;
}

async function resetLedger(cid: string) {
  await pool.query(`DELETE FROM comm_credit_ledger WHERE customer_id = $1`, [cid]);
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
  const cid = (await customerIdFor(ID_A))!;
  ok('wallet customer seeded', !!cid);

  // ── A. same refund-to-credit fired TWICE with the SAME Idempotency-Key ──────────────────────────
  await resetLedger(cid);
  const key = 'refund:rzp_refund_task29_AAA';
  console.log('\n[A] same Idempotency-Key, fired twice (sequential)');
  const a1 = await postIssue(cookie, cid, 500, { idemKey: key });
  const a2 = await postIssue(cookie, cid, 500, { idemKey: key });
  ok('first issue → 201 (fresh grant)', a1.status === 201 && a1.deduped === false, a1);
  ok('second issue → 200 deduped:true (replayed, not a new resource)', a2.status === 200 && a2.deduped === true, a2);
  ok('exactly ONE credit row exists', (await creditRowCount(cid)) === 1, { n: await creditRowCount(cid) });
  ok('balance == a single grant (never doubled)', (await balanceFor(cid)) === 500, { bal: await balanceFor(cid) });

  // ── B. STORM of N parallel issues with the SAME key ─────────────────────────────────────────────
  await resetLedger(cid);
  const stormKey = 'refund:rzp_refund_task29_STORM';
  console.log('\n[B] same Idempotency-Key, 12 parallel issues (storm)');
  const storm = await Promise.all(Array.from({ length: 12 }, () => postIssue(cookie, cid, 750, { idemKey: stormKey })));
  const created = storm.filter((r) => r.status === 201);
  ok('every storm request returned 200 or 201 (no errors)', storm.every((r) => r.status === 200 || r.status === 201), storm.filter((r) => r.status !== 200 && r.status !== 201));
  ok('at most ONE request created a fresh row (201)', created.length <= 1, { created: created.length });
  ok('exactly ONE credit row after the storm', (await creditRowCount(cid)) === 1, { n: await creditRowCount(cid) });
  ok('balance == a single grant after the storm', (await balanceFor(cid)) === 750, { bal: await balanceFor(cid) });

  // ── C. ref-based opt-in dedup (dedupe_by_ref + same ref_type/ref_id) ────────────────────────────
  await resetLedger(cid);
  console.log('\n[C] dedupe_by_ref opt-in, same ref fired twice');
  const refBody = { ref_type: 'refund', ref_id: 'rzp_refund_task29_REF', dedupe_by_ref: true };
  const c1 = await postIssue(cookie, cid, 300, { body: refBody });
  const c2 = await postIssue(cookie, cid, 300, { body: refBody });
  ok('first ref-dedup issue → 201', c1.status === 201 && c1.deduped === false, c1);
  ok('second ref-dedup issue → 200 deduped:true', c2.status === 200 && c2.deduped === true, c2);
  ok('exactly ONE credit row (ref-based dedup)', (await creditRowCount(cid)) === 1, { n: await creditRowCount(cid) });

  // ── D. CONTROL — existing key-less callers unchanged (same ref, NO key, NO flag → TWO rows) ──────
  await resetLedger(cid);
  console.log('\n[D] CONTROL: same ref but NO key / NO dedupe flag → append-only unchanged');
  const ctrlBody = { ref_type: 'refund', ref_id: 'rzp_refund_task29_CTRL' };
  const d1 = await postIssue(cookie, cid, 200, { body: ctrlBody });
  const d2 = await postIssue(cookie, cid, 200, { body: ctrlBody });
  ok('both key-less issues → 201 (no dedup)', d1.status === 201 && d2.status === 201, { d1, d2 });
  ok('TWO credit rows exist (byte-identical legacy behaviour)', (await creditRowCount(cid)) === 2, { n: await creditRowCount(cid) });
  ok('balance == both grants', (await balanceFor(cid)) === 400, { bal: await balanceFor(cid) });

  // ── E. distinct keys → distinct rows (dedup is per-key, not a global suppressor) ─────────────────
  await resetLedger(cid);
  console.log('\n[E] distinct keys → distinct rows');
  const e1 = await postIssue(cookie, cid, 100, { idemKey: 'refund:rzp_task29_E1' });
  const e2 = await postIssue(cookie, cid, 100, { idemKey: 'refund:rzp_task29_E2' });
  ok('both distinct-key issues → 201', e1.status === 201 && e2.status === 201, { e1, e2 });
  ok('TWO credit rows exist (distinct keys not suppressed)', (await creditRowCount(cid)) === 2, { n: await creditRowCount(cid) });

  await cleanup();
  stopServer();
  await pool.end();
  console.log(`\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 ${pass} passed, ${fail} failed \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
  process.exit(fail === 0 ? 0 : 1);
}

async function fatal(e: unknown) {
  console.error('CREDITS ISSUE IDEMPOTENCY SMOKE FATAL', e);
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
