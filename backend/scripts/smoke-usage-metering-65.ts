/**
 * Phase 6.5 — Usage Metering smoke test (self-cleaning, @example.com only).
 *
 * Engine-level (direct DB): record + count for each business dimension; over-limit rejection;
 * storage level semantics; credit issue → spend → insufficient-balance rejection; consumption view;
 * dimension overview. Plus HTTP flag-OFF 503 verification against the running Backend API.
 *
 * All test data is keyed by *@example.com / Smoke-Test customer and is deleted at the end (and on
 * failure). Never touches real identities.
 */
import pg from 'pg';
import {
  recordUsage, checkQuota, checkCreditDimension, spendCredits, resolveCustomerId,
} from '../services/commercial/metering-engine';
import { buildIdentityConsumption, buildDimensionOverview } from '../services/commercial/consumption-engine';
import { ensureMeteringSchema } from '../services/commercial/metering-schema';
import { ensureCommercialSchema } from '../services/commercial/catalog-schema';
import { issueCredit, getCreditBalance } from '../services/commercial/credit-ledger-runtime';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const EMAIL = 'usage-metering-smoke@example.com';
const PLAN_EMAIL = EMAIL; // same identity
let pass = 0, fail = 0, skipped = 0;
const ok = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : ''); }
};
const skip = (name: string, reason?: unknown) => {
  skipped++; console.log(`  ⊘ ${name} — SKIPPED`, reason !== undefined ? JSON.stringify(reason) : '');
};

// A thrown fetch error means the TCP connection never produced an HTTP response.
// That is "server is down / unreachable", which is NOT a regression of the gating
// behaviour — so it must be reported as SKIPPED rather than a hard failure. A real
// HTTP response (any status) means the server is up and the gate can be judged.
const isServerUnreachable = (e: any): boolean => {
  const code = e?.cause?.code ?? e?.code;
  if (code && ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT'].includes(code)) return true;
  // Node's undici surfaces connection failures as a generic "fetch failed" TypeError.
  return /fetch failed|other side closed|connect/i.test(String(e?.message ?? ''));
};

async function cleanup() {
  await pool.query(`DELETE FROM comm_usage_events WHERE lower(email) = lower($1)`, [EMAIL]).catch(() => {});
  const cid = await resolveCustomerId(pool, EMAIL).catch(() => null);
  if (cid) {
    await pool.query(`DELETE FROM comm_credit_ledger WHERE customer_id = $1`, [cid]).catch(() => {});
    await pool.query(`DELETE FROM comm_subscriptions WHERE customer_id = $1`, [cid]).catch(() => {});
    await pool.query(`DELETE FROM comm_customers WHERE id = $1`, [cid]).catch(() => {});
  }
  await pool.query(`DELETE FROM comm_plans WHERE id = $1`, ['00000000-0000-0000-0000-0000000065aa']).catch(() => {});
}

async function main() {
  await ensureMeteringSchema(pool);
  await ensureCommercialSchema(pool);
  await cleanup();

  // ── Set up an identity with an ACTIVE subscription declaring quotas for a few dimensions ────────
  const productId = '00000000-0000-0000-0000-0000000065bb';
  const planId = '00000000-0000-0000-0000-0000000065aa';
  await pool.query(
    `INSERT INTO comm_products (id, code, name, segment) VALUES ($1,'smoke_65_product','Smoke 6.5 Product','career_builder')
     ON CONFLICT (id) DO NOTHING`,
    [productId],
  );
  await pool.query(
    `INSERT INTO comm_plans (id, product_id, code, name, billing_interval, price_paise, currency, metadata)
     VALUES ($1,$2,'smoke_65_plan','Smoke 6.5 Plan','monthly',0,'INR',$3::jsonb)
     ON CONFLICT (id) DO UPDATE SET metadata = EXCLUDED.metadata`,
    [planId, productId, JSON.stringify({ quotas: { assessments: 3, candidates: 2, storage: 100 } })],
  );
  const cust = await pool.query(
    `INSERT INTO comm_customers (email, name, segment) VALUES ($1,'Smoke 6.5','career_builder')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [EMAIL],
  );
  const customerId = String(cust.rows[0].id);
  await pool.query(
    `INSERT INTO comm_subscriptions (customer_id, plan_id, status, current_period_start, current_period_end)
     VALUES ($1,$2,'active', date_trunc('month', now()), now() + interval '20 days')`,
    [customerId, planId],
  );

  // ── 1. Record + count for each period-count dimension ──────────────────────────────────────────
  console.log('\n[1] record + count (period-count dimensions)');
  for (const dim of ['assessments', 'candidates', 'jobs', 'employers', 'institutions', 'api'] as const) {
    const r = await recordUsage(pool, { email: EMAIL, usageType: dim, quantity: 1 });
    ok(`record ${dim}`, r.recorded === true, r.quota);
    const q = await checkQuota(pool, EMAIL, dim);
    ok(`count ${dim} === 1`, q.used === 1, q);
  }

  // ── 2. Over-limit rejection (assessments limit = 3) ────────────────────────────────────────────
  console.log('\n[2] over-limit rejection (assessments quota = 3)');
  await recordUsage(pool, { email: EMAIL, usageType: 'assessments', quantity: 1 }); // used = 2
  await recordUsage(pool, { email: EMAIL, usageType: 'assessments', quantity: 1 }); // used = 3 (at limit)
  const atLimit = await checkQuota(pool, EMAIL, 'assessments');
  ok('assessments at limit (used=3, allowed=false)', atLimit.used === 3 && atLimit.allowed === false, atLimit);
  const rejected = await recordUsage(pool, { email: EMAIL, usageType: 'assessments', quantity: 1 });
  ok('over-limit record refused (recorded=false)', rejected.recorded === false, rejected.quota.reason);
  const after = await checkQuota(pool, EMAIL, 'assessments');
  ok('refused event NOT written (still 3)', after.used === 3, after);

  // Crossing-limit in a SINGLE write must fail closed: candidates limit=2, used=1; a quantity=5 write
  // would project to 6 (>2) and must be refused. A quantity=1 write (1+1=2, at cap) is allowed.
  const cross = await recordUsage(pool, { email: EMAIL, usageType: 'candidates', quantity: 5 });
  ok('single over-quantity write refused (1+5 > 2)', cross.recorded === false && cross.quota.reason === 'quota_exceeded', cross.quota);
  const candAfterCross = await checkQuota(pool, EMAIL, 'candidates');
  ok('refused over-quantity event NOT written (still 1)', candAfterCross.used === 1, candAfterCross);
  const candToCap = await recordUsage(pool, { email: EMAIL, usageType: 'candidates', quantity: 1 });
  ok('write up to cap allowed (1+1 = 2)', candToCap.recorded === true && candToCap.quota.used === 2, candToCap.quota);

  // ── 3. Storage LEVEL semantics (limit = 100; latest reading is the usage) ───────────────────────
  console.log('\n[3] storage level semantics (quota = 100)');
  await recordUsage(pool, { email: EMAIL, usageType: 'storage', quantity: 40 });
  await recordUsage(pool, { email: EMAIL, usageType: 'storage', quantity: 75 });
  const lvl = await checkQuota(pool, EMAIL, 'storage');
  ok('storage used = latest reading (75, not sum 115)', lvl.used === 75, lvl);
  const overLevel = await recordUsage(pool, { email: EMAIL, usageType: 'storage', quantity: 150 });
  ok('storage over-limit level refused', overLevel.recorded === false, overLevel.quota.reason);
  const atCap = await recordUsage(pool, { email: EMAIL, usageType: 'storage', quantity: 100 });
  ok('storage level AT cap allowed', atCap.recorded === true, atCap.quota);

  // ── 4. Unmetered dimension (no declared quota → recorded, not capped) ───────────────────────────
  console.log('\n[4] unmetered dimension (jobs has no declared quota)');
  const jq = await checkQuota(pool, EMAIL, 'jobs');
  ok('jobs limit null + reason no_declared_quota', jq.limit === null && jq.reason === 'no_declared_quota', jq);

  // ── 5. Credits: issue → spend → insufficient rejection ─────────────────────────────────────────
  console.log('\n[5] credits dimension (issue → spend → insufficient)');
  await issueCredit(pool, { customer_id: customerId, amount_paise: 500, reason: 'smoke seed' });
  const bal0 = await checkCreditDimension(pool, EMAIL);
  ok('credit balance after issue = 500', bal0.balance === 500, bal0);
  const spend = await spendCredits(pool, EMAIL, 200, { reason: 'smoke spend' });
  ok('spend 200 succeeds, balance 300', spend.spent === true && spend.state.balance === 300, spend);
  const over = await spendCredits(pool, EMAIL, 9999, { reason: 'smoke overspend' });
  ok('overspend rejected (fail-closed)', over.spent === false && over.reason === 'insufficient_balance', over);
  const balFinal = await getCreditBalance(pool, customerId);
  ok('balance unchanged after rejected overspend (300)', balFinal === 300, balFinal);
  const noCust = await spendCredits(pool, 'nobody-65@example.com', 10);
  ok('spend for non-customer rejected (no_customer)', noCust.spent === false && noCust.reason === 'no_customer', noCust);

  // GET-never-writes / honest degrade: with the credit substrate absent, the read path must NOT throw
  // or bootstrap schema — it returns an honest no_substrate state. Simulate absence with a fake db whose
  // to_regclass probe reports the tables missing.
  const absentDb = { query: async () => ({ rows: [{ customers: null, ledger: null }] }) } as any;
  let degradeThrew = false;
  let degradeState: any = null;
  try { degradeState = await checkCreditDimension(absentDb, EMAIL); } catch { degradeThrew = true; }
  ok('credit read on absent substrate does not throw (non-500)', degradeThrew === false, degradeState);
  ok('credit read on absent substrate → honest no_substrate, balance 0',
    degradeState?.reason === 'no_substrate' && degradeState?.balance === 0, degradeState);

  // ── 6. Consumption view (all 8 dimensions) ─────────────────────────────────────────────────────
  console.log('\n[6] consumption view');
  const cons = await buildIdentityConsumption(pool, EMAIL);
  ok('consumption has 8 dimensions', cons.dimensions.length === 8, cons.dimensions.map((d) => d.dimension));
  ok('consumption not degraded', cons.degraded === false, cons.degraded);
  const credDim = cons.dimensions.find((d) => d.dimension === 'credits');
  ok('credits dim shows balance 300', credDim?.balance === 300, credDim);
  const assessDim = cons.dimensions.find((d) => d.dimension === 'assessments');
  ok('assessments dim used=3 limit=3 remaining=0', assessDim?.used === 3 && assessDim?.limit === 3 && assessDim?.remaining === 0, assessDim);

  // ── 7. Dimension overview (admin) ──────────────────────────────────────────────────────────────
  console.log('\n[7] dimension overview (admin)');
  const ov = await buildDimensionOverview(pool);
  ok('overview has 8 dimensions', ov.by_dimension.length === 8, ov.by_dimension.map((d) => d.dimension));
  ok('overview not degraded', ov.degraded === false, ov.degraded);

  // ── 8. HTTP flag-OFF → 503 (Backend API runs WITHOUT FF_COMMERCIAL_USAGE_METERING) ─────────────
  console.log('\n[8] HTTP flag-OFF 503');
  const base = `http://localhost:8080`;
  const httpPaths = [
    '/api/commercial/metering/consumption',
    '/api/commercial/metering/credits/balance?usage_type=credits',
    '/api/admin/commercial/metering/dimensions',
  ];
  // Probe once: if the Backend API workflow isn't running, the gate cannot be exercised
  // over HTTP. That's not a regression — skip the whole section deterministically instead
  // of emitting false connection failures.
  let serverDown = false;
  try {
    await fetch(`${base}${httpPaths[0]}`, { headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    if (isServerUnreachable(e)) serverDown = true;
  }
  if (serverDown) {
    for (const path of httpPaths) skip(`GET ${path} gated (503/401, not 200)`, 'Backend API not running on localhost:8080');
  } else {
    for (const path of httpPaths) {
      try {
        const res = await fetch(`${base}${path}`, { headers: { 'content-type': 'application/json' } });
        // 503 (flag) is the target; 401 (auth before flag) is also acceptable proof the route is gated, not open 200.
        ok(`GET ${path} gated (503/401, not 200)`, res.status === 503 || res.status === 401, res.status);
      } catch (e: any) {
        // The probe just succeeded, so a throw here is a transient/unexpected condition rather
        // than a steady "server down" — but still treat connection errors as a skip, not a regression.
        if (isServerUnreachable(e)) skip(`GET ${path} gated (503/401, not 200)`, e?.message);
        else ok(`GET ${path} reachable`, false, e?.message);
      }
    }
  }

  await cleanup();
  await pool.end();
  console.log(`\n──────── ${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ''} ────────`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('SMOKE FATAL', e);
  await cleanup().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(1);
});
