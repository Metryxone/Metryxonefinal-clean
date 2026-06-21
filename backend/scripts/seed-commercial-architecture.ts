/**
 * Task #6 (Phase 6.1) — Commercial Architecture seed (DRAFT / inactive examples).
 *
 * Seeds representative catalog DATA for the five customer segments, demonstrating the full
 * structure: Product → Plan → SKU → Add-ons → Entitlements (feature framework).
 *
 *   Student      → comm_products(career_builder)  "Student Career Builder"
 *   Institution  → comm_products(institution)     "Institution License"
 *   Employer     → comm_products(employer)         "Employer Hiring Suite"
 *   Assessment   → comm_products(career_builder)  "Assessment Pack"
 *   Enterprise   → comm_products(enterprise)       "Enterprise Platform"
 *
 * HONESTY / SAFETY CONTRACT:
 *   • Products / plans / SKUs / add-ons are seeded is_active=FALSE (DRAFT) with metadata
 *     {demo:true,draft:true}: NOTHING is sellable until an operator explicitly activates it.
 *     The public /catalog endpoint (is_active=true only) therefore returns EMPTY after this seed.
 *   • The Entitlement FRAMEWORK (comm_features = the seven FEATURE_CLASSES + named features) is
 *     seeded is_active=TRUE — it is reusable vocabulary, not a sellable product.
 *   • Idempotent (ON CONFLICT) — safe to re-run; updates draft rows in place.
 *   • Bypasses the feature flag (explicit operator action) but calls the architecture ensure-schema
 *     directly so the tables exist regardless of flag state.
 *
 * Run:  cd backend && npx tsx scripts/seed-commercial-architecture.ts
 */
import { Pool } from 'pg';
import { ensureArchitectureSchema } from '../services/commercial/architecture-schema.js';

const DEMO = JSON.stringify({ demo: true, draft: true, source: 'phase-6.1-seed' });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await ensureArchitectureSchema(pool);
    console.log('Phase 6.1 — seeding commercial architecture (DRAFT/inactive examples)\n');

    // ── 1. Entitlement framework: the seven FEATURE_CLASSES + a couple named features (ACTIVE) ──
    const features: Array<[string, string, string | null, boolean, string]> = [
      ['feat_views', 'Profile / Result Views', 'views', true, 'Metered profile and result views'],
      ['feat_searches', 'Searches', 'searches', true, 'Metered candidate / job / role searches'],
      ['feat_reports', 'Reports', 'reports', true, 'Stakeholder report generation'],
      ['feat_exports', 'Exports', 'exports', true, 'PDF / CSV exports'],
      ['feat_assessments', 'Assessments', 'assessments', true, 'CAPADEX / competency assessments'],
      ['feat_ai', 'AI Intelligence', 'ai', true, 'AI-assisted guidance and analysis'],
      ['feat_api', 'API Access', 'api', true, 'Programmatic API access'],
      ['feat_resume_studio', 'Resume Studio', null, false, 'Resume builder (named feature, unmetered)'],
      ['feat_passport_publish', 'Employability Passport Publish', null, false, 'Publish a shareable passport'],
    ];
    for (const [code, name, fc, metered, desc] of features) {
      await pool.query(
        `INSERT INTO comm_features (code,name,feature_class,description,is_metered,is_active,metadata)
         VALUES ($1,$2,$3,$4,$5,true,$6::jsonb)
         ON CONFLICT (code) DO UPDATE SET
           name=EXCLUDED.name, feature_class=EXCLUDED.feature_class, description=EXCLUDED.description,
           is_metered=EXCLUDED.is_metered, updated_at=now()`,
        [code, name, fc, desc, metered, JSON.stringify({ demo: true, source: 'phase-6.1-seed' })],
      );
    }
    console.log(`  ✓ ${features.length} entitlement-framework feature(s) (active vocabulary)`);

    // ── 2. Helper upserts (DRAFT: is_active=false) ──
    async function upProduct(code: string, name: string, segment: string, desc: string): Promise<string> {
      const { rows } = await pool.query(
        `INSERT INTO comm_products (code,name,segment,description,is_active,metadata)
         VALUES ($1,$2,$3,$4,false,$5::jsonb)
         ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, segment=EXCLUDED.segment,
           description=EXCLUDED.description, metadata=EXCLUDED.metadata, updated_at=now()
         RETURNING id`,
        [code, name, segment, desc, DEMO],
      );
      return rows[0].id;
    }
    async function upPlan(productId: string, code: string, name: string, interval: string, pricePaise: number, trialDays = 0): Promise<string> {
      const { rows } = await pool.query(
        `INSERT INTO comm_plans (product_id,code,name,billing_interval,interval_count,price_paise,currency,trial_days,is_active,metadata)
         VALUES ($1,$2,$3,$4,1,$5,'INR',$6,false,$7::jsonb)
         ON CONFLICT (code) DO UPDATE SET product_id=EXCLUDED.product_id, name=EXCLUDED.name,
           billing_interval=EXCLUDED.billing_interval, price_paise=EXCLUDED.price_paise,
           trial_days=EXCLUDED.trial_days, metadata=EXCLUDED.metadata, updated_at=now()
         RETURNING id`,
        [productId, code, name, interval, pricePaise, trialDays, DEMO],
      );
      return rows[0].id;
    }
    async function upSku(code: string, name: string, productId: string, planId: string, segment: string, pricePaise: number | null): Promise<string> {
      const { rows } = await pool.query(
        `INSERT INTO comm_skus (sku_code,name,product_id,plan_id,segment,price_paise,currency,is_active,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,'INR',false,$7::jsonb)
         ON CONFLICT (sku_code) DO UPDATE SET name=EXCLUDED.name, product_id=EXCLUDED.product_id,
           plan_id=EXCLUDED.plan_id, segment=EXCLUDED.segment, price_paise=EXCLUDED.price_paise,
           metadata=EXCLUDED.metadata, updated_at=now()
         RETURNING id`,
        [code, name, productId, planId, segment, pricePaise, DEMO],
      );
      return rows[0].id;
    }
    async function upAddon(code: string, name: string, type: string, segment: string, pricePaise: number, interval: string): Promise<string> {
      const { rows } = await pool.query(
        `INSERT INTO comm_addons (code,name,addon_type,segment,price_paise,currency,billing_interval,is_active,metadata)
         VALUES ($1,$2,$3,$4,$5,'INR',$6,false,$7::jsonb)
         ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, addon_type=EXCLUDED.addon_type,
           segment=EXCLUDED.segment, price_paise=EXCLUDED.price_paise,
           billing_interval=EXCLUDED.billing_interval, metadata=EXCLUDED.metadata, updated_at=now()
         RETURNING id`,
        [code, name, type, segment, pricePaise, interval, DEMO],
      );
      return rows[0].id;
    }
    async function entitle(planId: string, featureCode: string, quota: number | null, period = 'monthly') {
      await pool.query(
        `INSERT INTO comm_plan_entitlements (plan_id,feature_code,quota,quota_period,metadata)
         VALUES ($1,$2,$3,$4,$5::jsonb)
         ON CONFLICT (plan_id,feature_code) DO UPDATE SET quota=EXCLUDED.quota,
           quota_period=EXCLUDED.quota_period, updated_at=now()`,
        [planId, featureCode, quota, period, JSON.stringify({ demo: true })],
      );
    }
    async function linkAddon(skuId: string, addonId: string, included: boolean) {
      await pool.query(
        `INSERT INTO comm_sku_addons (sku_id,addon_id,quantity,is_included)
         VALUES ($1,$2,1,$3) ON CONFLICT (sku_id,addon_id) DO UPDATE SET is_included=EXCLUDED.is_included`,
        [skuId, addonId, included],
      );
    }

    // ── 3. Add-ons (segment-scoped extras) ──
    const addonReportPack = await upAddon('ADDON_REPORT_PACK', 'Report Pack (+10 reports)', 'report_pack', 'career_builder', 19900, 'one_time');
    const addonSeatPack = await upAddon('ADDON_SEAT_PACK', 'Seat Pack (+25 seats)', 'seat_pack', 'institution', 499900, 'annual');
    const addonAiBoost = await upAddon('ADDON_AI_BOOST', 'AI Boost', 'feature_unlock', 'enterprise', 99900, 'monthly');

    // ── 4. Per-segment Product → Plan → SKU → Entitlements ──

    // Student
    {
      const p = await upProduct('PROD_STUDENT_CB', 'Student Career Builder', 'career_builder', 'Career Builder for students');
      const plan = await upPlan(p, 'PLAN_STUDENT_CB_M', 'Student Monthly', 'monthly', 29900, 7); // ₹299
      const sku = await upSku('SKU_STUDENT_CB_M', 'Student Career Builder — Monthly', p, plan, 'career_builder', null);
      await entitle(plan, 'feat_assessments', 10);
      await entitle(plan, 'feat_reports', 5);
      await entitle(plan, 'feat_views', null); // unlimited
      await entitle(plan, 'feat_resume_studio', null);
      await linkAddon(sku, addonReportPack, false); // optional
      console.log('  ✓ Student: product → monthly plan (₹299) → SKU → 4 entitlements (+ optional report pack)');
    }

    // Institution
    {
      const p = await upProduct('PROD_INSTITUTION', 'Institution License', 'institution', 'Institution-wide license');
      const plan = await upPlan(p, 'PLAN_INSTITUTION_A', 'Institution Annual', 'annual', 14999900); // ₹1,49,999
      const sku = await upSku('SKU_INSTITUTION_A', 'Institution License — Annual', p, plan, 'institution', null);
      await entitle(plan, 'feat_assessments', null, 'annual');
      await entitle(plan, 'feat_reports', null, 'annual');
      await entitle(plan, 'feat_exports', null, 'annual');
      await linkAddon(sku, addonSeatPack, false);
      console.log('  ✓ Institution: product → annual plan → SKU → 3 entitlements (+ optional seat pack)');
    }

    // Employer
    {
      const p = await upProduct('PROD_EMPLOYER', 'Employer Hiring Suite', 'employer', 'Hiring intelligence for employers');
      const plan = await upPlan(p, 'PLAN_EMPLOYER_M', 'Employer Monthly', 'monthly', 149900); // ₹1,499
      await upSku('SKU_EMPLOYER_M', 'Employer Hiring Suite — Monthly', p, plan, 'employer', null);
      await entitle(plan, 'feat_searches', 500);
      await entitle(plan, 'feat_views', 2000);
      await entitle(plan, 'feat_exports', 100);
      console.log('  ✓ Employer: product → monthly plan (₹1,499) → SKU → 3 metered entitlements');
    }

    // Assessment
    {
      const p = await upProduct('PROD_ASSESSMENT', 'Assessment Pack', 'career_builder', 'One-time assessment pack');
      const plan = await upPlan(p, 'PLAN_ASSESSMENT_OT', 'Assessment One-Time', 'one_time', 49900); // ₹499
      await upSku('SKU_ASSESSMENT_OT', 'Assessment Pack — One-Time', p, plan, 'career_builder', null);
      await entitle(plan, 'feat_assessments', 3, 'one_time');
      await entitle(plan, 'feat_reports', 3, 'one_time');
      console.log('  ✓ Assessment: product → one-time plan (₹499) → SKU → 2 entitlements');
    }

    // Enterprise
    {
      const p = await upProduct('PROD_ENTERPRISE', 'Enterprise Platform', 'enterprise', 'Full enterprise platform');
      const plan = await upPlan(p, 'PLAN_ENTERPRISE_A', 'Enterprise Annual', 'annual', 99999900); // ₹9,99,999
      const sku = await upSku('SKU_ENTERPRISE_A', 'Enterprise Platform — Annual', p, plan, 'enterprise', null);
      await entitle(plan, 'feat_api', null, 'annual');
      await entitle(plan, 'feat_ai', null, 'annual');
      await entitle(plan, 'feat_assessments', null, 'annual');
      await entitle(plan, 'feat_reports', null, 'annual');
      await entitle(plan, 'feat_exports', null, 'annual');
      await linkAddon(sku, addonAiBoost, true); // included
      console.log('  ✓ Enterprise: product → annual plan → SKU → 5 entitlements (+ included AI Boost)');
    }

    // ── 5. Honest summary ──
    const summary = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM comm_features) AS features,
        (SELECT COUNT(*)::int FROM comm_skus) AS skus,
        (SELECT COUNT(*)::int FROM comm_addons) AS addons,
        (SELECT COUNT(*)::int FROM comm_sku_addons) AS sku_addons,
        (SELECT COUNT(*)::int FROM comm_plan_entitlements) AS entitlements,
        (SELECT COUNT(*)::int FROM comm_skus WHERE is_active=true) AS active_skus
    `);
    const s = summary.rows[0];
    console.log(`\nSeed complete (all products/plans/skus/addons are DRAFT/inactive):`);
    console.log(`  features=${s.features}  skus=${s.skus} (active=${s.active_skus})  addons=${s.addons}  sku_addons=${s.sku_addons}  plan_entitlements=${s.entitlements}`);
    console.log(`  Public /catalog returns EMPTY until an operator activates these drafts.`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('seed crashed:', e);
  process.exit(1);
});
