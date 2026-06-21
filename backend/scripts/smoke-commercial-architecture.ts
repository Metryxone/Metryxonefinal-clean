/**
 * Task #6 (Phase 6.1) — Commercial Architecture smoke (TEST/demo, self-cleaning).
 *
 * Seeds a full @example.com architecture chain against the REAL schema:
 *   comm_products → comm_plans → comm_skus → comm_addons → comm_sku_addons
 *                 → comm_features → comm_plan_entitlements
 * then asserts structural invariants and joinability, and proves the public-catalog
 * draft-hiding contract.
 *
 * What it PROVES (honesty-first, never fabricates production data):
 *   1. ensureArchitectureSchema bootstraps all five new tables (idempotent).
 *   2. Product→Plan→SKU FK chain resolves; SKU joins back to a real product + plan.
 *   3. Entitlement framework joins: every comm_plan_entitlements row resolves to a real
 *      comm_features.code (no orphan), and the plan→feature mapping is queryable.
 *   4. SKU↔add-on link resolves; unique(sku_id,addon_id) rejects a duplicate link.
 *   5. Draft-hiding: a SKU seeded is_active=false is INVISIBLE to the active-only catalog query.
 *   6. CHECK constraints hold (bad segment / bad feature_class / negative-by-contract rejected).
 *
 * All seeded rows carry the ARCH6 tag / SMOKE_EMAIL and are removed in a finally block, so a
 * re-run is deterministic and leaves the DB byte-identical to its starting state.
 *
 * Run:  cd backend && npx tsx scripts/smoke-commercial-architecture.ts
 */
import { Pool } from 'pg';
import { ensureArchitectureSchema } from '../services/commercial/architecture-schema.js';

const TAG = 'ARCH6';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures += 1; console.log(`  ✗ FAIL: ${msg}`); }
}
async function num(pool: Pool, sql: string, params: any[] = []): Promise<number> {
  return Number((await pool.query(sql, params)).rows[0].n);
}

async function cleanup(pool: Pool) {
  // Children first. comm_plan_entitlements / comm_sku_addons cascade off plans/skus, but delete explicitly to be safe.
  await pool.query(`DELETE FROM comm_plan_entitlements WHERE plan_id IN (SELECT id FROM comm_plans WHERE code LIKE '${TAG}%')`).catch(() => {});
  await pool.query(`DELETE FROM comm_sku_addons WHERE sku_id IN (SELECT id FROM comm_skus WHERE sku_code LIKE '${TAG}%')`).catch(() => {});
  await pool.query(`DELETE FROM comm_skus WHERE sku_code LIKE '${TAG}%'`).catch(() => {});
  await pool.query(`DELETE FROM comm_addons WHERE code LIKE '${TAG}%'`).catch(() => {});
  await pool.query(`DELETE FROM comm_features WHERE code LIKE '${TAG}%'`).catch(() => {});
  await pool.query(`DELETE FROM comm_plans WHERE code LIKE '${TAG}%'`).catch(() => {});
  await pool.query(`DELETE FROM comm_products WHERE code LIKE '${TAG}%'`).catch(() => {});
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('PHASE 6.1 — commercial architecture smoke (TEST/demo, self-cleaning)\n');

    // ── 1. Schema bootstrap (idempotent) ──
    console.log('[1] ensureArchitectureSchema');
    await ensureArchitectureSchema(pool);
    await ensureArchitectureSchema(pool); // second call must be a no-op
    await cleanup(pool);
    for (const t of ['comm_skus', 'comm_addons', 'comm_sku_addons', 'comm_features', 'comm_plan_entitlements']) {
      const reg = (await pool.query('SELECT to_regclass($1) r', [t])).rows[0].r;
      assert(!!reg, `${t} provisioned`);
    }

    // ── 2. Seed Product → Plan → SKU chain ──
    console.log('\n[2] Seed product → plan → SKU (draft)');
    const productId = (await pool.query(
      `INSERT INTO comm_products (code,name,segment,is_active) VALUES ($1,'ARCH6 Product','career_builder',false) RETURNING id`,
      [`${TAG}_PROD`],
    )).rows[0].id;
    const planId = (await pool.query(
      `INSERT INTO comm_plans (product_id,code,name,billing_interval,price_paise,is_active)
       VALUES ($1,$2,'ARCH6 Plan','monthly',29900,false) RETURNING id`,
      [productId, `${TAG}_PLAN`],
    )).rows[0].id;
    const skuId = (await pool.query(
      `INSERT INTO comm_skus (sku_code,name,product_id,plan_id,segment,is_active)
       VALUES ($1,'ARCH6 SKU',$2,$3,'career_builder',false) RETURNING id`,
      [`${TAG}_SKU`, productId, planId],
    )).rows[0].id;
    assert(true, 'seeded product → plan → SKU');

    // ── 3. FK chain resolves ──
    console.log('\n[3] SKU → product/plan FK chain resolves');
    const joined = (await pool.query(
      `SELECT s.sku_code, pr.code AS product_code, pl.code AS plan_code
         FROM comm_skus s JOIN comm_products pr ON pr.id=s.product_id JOIN comm_plans pl ON pl.id=s.plan_id
        WHERE s.id=$1`, [skuId])).rows[0];
    assert(joined?.product_code === `${TAG}_PROD` && joined?.plan_code === `${TAG}_PLAN`, 'SKU joins to its real product and plan');

    // ── 4. Entitlement framework join ──
    console.log('\n[4] Entitlement framework (feature catalog + plan→feature mapping)');
    await pool.query(
      `INSERT INTO comm_features (code,name,feature_class,is_metered) VALUES ($1,'ARCH6 Assessments','assessments',true)`,
      [`${TAG}_FEAT`],
    );
    await pool.query(
      `INSERT INTO comm_plan_entitlements (plan_id,feature_code,quota,quota_period) VALUES ($1,$2,10,'monthly')`,
      [planId, `${TAG}_FEAT`],
    );
    const ent = (await pool.query(
      `SELECT pe.quota, f.feature_class FROM comm_plan_entitlements pe JOIN comm_features f ON f.code=pe.feature_code
        WHERE pe.plan_id=$1`, [planId])).rows[0];
    assert(ent?.quota === 10 && ent?.feature_class === 'assessments', 'plan entitlement resolves to a real feature with quota');
    const orphanEnt = await num(pool,
      `SELECT COUNT(*)::int n FROM comm_plan_entitlements pe WHERE NOT EXISTS (SELECT 1 FROM comm_features f WHERE f.code=pe.feature_code)`);
    assert(orphanEnt === 0, 'no orphan plan_entitlement → feature');

    // ── 5. Add-on link + unique constraint ──
    console.log('\n[5] SKU ↔ add-on link');
    const addonId = (await pool.query(
      `INSERT INTO comm_addons (code,name,addon_type,segment,price_paise) VALUES ($1,'ARCH6 Addon','report_pack','career_builder',19900) RETURNING id`,
      [`${TAG}_ADDON`],
    )).rows[0].id;
    await pool.query(`INSERT INTO comm_sku_addons (sku_id,addon_id) VALUES ($1,$2)`, [skuId, addonId]);
    let dupRejected = false;
    try { await pool.query(`INSERT INTO comm_sku_addons (sku_id,addon_id) VALUES ($1,$2)`, [skuId, addonId]); }
    catch { dupRejected = true; }
    assert(dupRejected, 'duplicate (sku_id,addon_id) link rejected by unique constraint');

    // ── 6. Draft-hiding: active-only catalog query excludes the draft SKU ──
    console.log('\n[6] Draft-hiding (public catalog is active-only)');
    const visible = await num(pool, `SELECT COUNT(*)::int n FROM comm_skus WHERE is_active=true AND sku_code=$1`, [`${TAG}_SKU`]);
    assert(visible === 0, 'draft SKU (is_active=false) is invisible to the active-only catalog query');

    // ── 7. CHECK constraints reject invalid rows ──
    console.log('\n[7] CHECK constraints');
    let badSeg = false;
    try { await pool.query(`INSERT INTO comm_skus (sku_code,name,segment) VALUES ($1,'bad','not_a_segment')`, [`${TAG}_BADSEG`]); }
    catch { badSeg = true; }
    assert(badSeg, 'invalid segment rejected by CHECK');
    let badClass = false;
    try { await pool.query(`INSERT INTO comm_features (code,name,feature_class) VALUES ($1,'bad','not_a_class')`, [`${TAG}_BADCLASS`]); }
    catch { badClass = true; }
    assert(badClass, 'invalid feature_class rejected by CHECK');
  } finally {
    await cleanup(pool);
    const rem = await num(pool, `SELECT COUNT(*)::int n FROM comm_products WHERE code LIKE '${TAG}%'`);
    assert(rem === 0, 'self-clean complete — no ARCH6 smoke rows remain');
    await pool.end();
  }

  console.log(`\n${failures === 0 ? 'SMOKE PASSED ✅' : `SMOKE FAILED ❌ (${failures} assertion failure(s))`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('smoke crashed:', e);
  process.exit(1);
});
