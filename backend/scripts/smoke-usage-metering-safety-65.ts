/**
 * Phase 6.5 — Usage Metering SAFETY regressions (self-cleaning, @example.com only).
 *
 * Two contracts that the manual smoke test does not exercise as standalone regressions:
 *
 *  A. CONCURRENCY / fail-closed overrun: N writers racing the SAME identity+usage_type past a declared
 *     quota must NOT overrun. The advisory-lock transaction in recordUsage serializes the pre-check and
 *     the insert, so exactly `limit` writes are recorded and the rest are refused — never `limit + k`.
 *     A naive read-then-insert would let multiple racers pass the pre-check and overshoot.
 *
 *  B. READ-NEVER-WRITES on absent substrate: the read paths (checkQuota / checkCreditDimension) must
 *     probe with to_regclass and degrade to an honest empty state when the metering tables are absent —
 *     WITHOUT throwing and WITHOUT issuing any DDL/mutation (no lazy ensure-schema on a read). We assert
 *     this with a spy db that reports the tables missing and records every SQL statement it sees, then
 *     fail if any statement is a CREATE/ALTER/DROP/INSERT/UPDATE/DELETE/TRUNCATE.
 *
 * All test data is keyed by *@example.com and deleted at the end (and on failure). Never touches real
 * identities.
 */
import pg from 'pg';
import { recordUsage, checkQuota, checkCreditDimension, resolveCustomerId } from '../services/commercial/metering-engine';
import { ensureMeteringSchema } from '../services/commercial/metering-schema';
import { ensureCommercialSchema } from '../services/commercial/catalog-schema';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const EMAIL = 'usage-metering-safety@example.com';
const PRODUCT_ID = '00000000-0000-0000-0000-0000000065cc';
const PLAN_ID = '00000000-0000-0000-0000-0000000065dd';
const QUOTA = 3;
const RACERS = 10;

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : ''); }
};

async function cleanup() {
  await pool.query(`DELETE FROM comm_usage_events WHERE lower(email) = lower($1)`, [EMAIL]).catch(() => {});
  const cid = await resolveCustomerId(pool, EMAIL).catch(() => null);
  if (cid) {
    await pool.query(`DELETE FROM comm_subscriptions WHERE customer_id = $1`, [cid]).catch(() => {});
    await pool.query(`DELETE FROM comm_customers WHERE id = $1`, [cid]).catch(() => {});
  }
  await pool.query(`DELETE FROM comm_plans WHERE id = $1`, [PLAN_ID]).catch(() => {});
  await pool.query(`DELETE FROM comm_products WHERE id = $1`, [PRODUCT_ID]).catch(() => {});
}

async function main() {
  await ensureMeteringSchema(pool);
  await ensureCommercialSchema(pool);
  await cleanup();

  // ── Set up an identity with an ACTIVE subscription declaring a quota for `assessments` = QUOTA ──────
  await pool.query(
    `INSERT INTO comm_products (id, code, name, segment) VALUES ($1,'safety_65_product','Safety 6.5 Product','career_builder')
     ON CONFLICT (id) DO NOTHING`,
    [PRODUCT_ID],
  );
  await pool.query(
    `INSERT INTO comm_plans (id, product_id, code, name, billing_interval, price_paise, currency, metadata)
     VALUES ($1,$2,'safety_65_plan','Safety 6.5 Plan','monthly',0,'INR',$3::jsonb)
     ON CONFLICT (id) DO UPDATE SET metadata = EXCLUDED.metadata`,
    [PLAN_ID, PRODUCT_ID, JSON.stringify({ quotas: { assessments: QUOTA } })],
  );
  const cust = await pool.query(
    `INSERT INTO comm_customers (email, name, segment) VALUES ($1,'Safety 6.5','career_builder')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [EMAIL],
  );
  const customerId = String(cust.rows[0].id);
  await pool.query(
    `INSERT INTO comm_subscriptions (customer_id, plan_id, status, current_period_start, current_period_end)
     VALUES ($1,$2,'active', date_trunc('month', now()), now() + interval '20 days')`,
    [customerId, PLAN_ID],
  );

  // ── A. CONCURRENCY: fire RACERS parallel quantity=1 writes at a quota of QUOTA ──────────────────────
  console.log(`\n[A] concurrency overrun regression (${RACERS} racers, quota = ${QUOTA})`);
  const results = await Promise.all(
    Array.from({ length: RACERS }, () =>
      recordUsage(pool, { email: EMAIL, usageType: 'assessments', quantity: 1 })
        .then((r) => ({ recorded: r.recorded, reason: r.quota.reason }))
        .catch((e) => ({ recorded: false, reason: `error:${e?.message ?? 'unknown'}` })),
    ),
  );
  const recordedCount = results.filter((r) => r.recorded).length;
  const refusedCount = results.filter((r) => !r.recorded).length;
  const errored = results.filter((r) => String(r.reason).startsWith('error:'));
  ok('no writer errored under contention', errored.length === 0, errored);
  ok(`exactly ${QUOTA} writes recorded (no overrun)`, recordedCount === QUOTA, { recordedCount, refusedCount });
  ok(`remaining ${RACERS - QUOTA} writes refused (fail-closed)`, refusedCount === RACERS - QUOTA, { recordedCount, refusedCount });
  ok('every refusal cited quota_exceeded', results.filter((r) => !r.recorded).every((r) => r.reason === 'quota_exceeded'),
    results.filter((r) => !r.recorded).map((r) => r.reason));

  // The ledger itself must hold exactly QUOTA events — the authoritative no-overrun proof.
  const counted = await checkQuota(pool, EMAIL, 'assessments');
  ok(`ledger count === ${QUOTA} after the storm (no overrun in DB)`, counted.used === QUOTA, counted);
  ok('quota now at/over cap (allowed=false)', counted.allowed === false, counted);
  const rowCount = await pool.query(
    `SELECT COUNT(*)::int AS n FROM comm_usage_events WHERE lower(email) = lower($1) AND usage_type = 'assessments'`,
    [EMAIL],
  );
  ok(`raw event rows === ${QUOTA}`, rowCount.rows[0].n === QUOTA, rowCount.rows[0]);

  // ── B. READ-NEVER-WRITES on absent substrate (no DDL / no mutation on the read path) ───────────────
  console.log('\n[B] read-only honest empty state when metering tables are absent');
  const seen: string[] = [];
  const MUTATION = /\b(create|alter|drop|insert|update|delete|truncate)\b/i;
  // Spy db: every probe reports the tables missing; every other read returns empty. It records SQL so
  // we can prove the read path issued no DDL/mutation.
  const absentDb = {
    query: async (sql: string) => {
      seen.push(sql);
      if (/to_regclass/i.test(sql)) {
        // resolveQuotaWindow probes one oid; checkCreditDimension probes customers + ledger.
        return { rows: [{ oid: null, customers: null, ledger: null }] };
      }
      return { rows: [] };
    },
  } as any;

  let threw = false;
  let q: any = null;
  try { q = await checkQuota(absentDb, EMAIL, 'assessments'); } catch { threw = true; }
  ok('checkQuota on absent substrate does not throw (non-500)', threw === false, q);
  ok('checkQuota → honest empty (limit null, used 0, no_active_subscription)',
    q?.limit === null && q?.used === 0 && q?.allowed === true && q?.reason === 'no_active_subscription', q);

  let credThrew = false;
  let cred: any = null;
  try { cred = await checkCreditDimension(absentDb, EMAIL); } catch { credThrew = true; }
  ok('checkCreditDimension on absent substrate does not throw', credThrew === false, cred);
  ok('checkCreditDimension → honest no_substrate, balance 0',
    cred?.reason === 'no_substrate' && cred?.balance === 0, cred);

  const mutations = seen.filter((s) => MUTATION.test(s));
  ok('read path issued NO DDL/mutation (GET-never-writes)', mutations.length === 0, mutations);
  ok('read path did issue to_regclass probe(s)', seen.some((s) => /to_regclass/i.test(s)), seen.length);

  await cleanup();
  await pool.end();
  console.log(`\n──────── ${pass} passed, ${fail} failed ────────`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('SAFETY SMOKE FATAL', e);
  await cleanup().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(1);
});
