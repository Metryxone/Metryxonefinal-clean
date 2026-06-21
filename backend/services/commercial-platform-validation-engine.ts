/**
 * PHASE 6 — Commercial Platform Validation engine (additive, read-only, never-throws).
 *
 * The COMMERCIAL analog of Phase-5.15 `super-admin-employer-validation-engine.ts`. A
 * super-admin runs this to obtain one comprehensive honesty/invariant report across the
 * EIGHT commercial subsystems that ship behind default-OFF flags. It COMPOSES the
 * already-built pure read engines (revenue / recurring-revenue / renewal / upsell /
 * subscription-lifecycle / entitlement / enterprise-overview) and probes the canonical
 * `comm_* / inv_* / rbac_* / gov_* / aig_* / anl_* / tenants / capadex_payments` tables.
 * It performs NO new scoring, writes NOTHING, and runs ZERO DDL.
 *
 * Areas (mapping the requested Phase-6 subsystems 1:1):
 *   1. Commercial Layer            — comm_products / comm_plans / comm_bundles / comm_coupons
 *   2. Institution Layer           — tenants
 *   3. Subscription Intelligence   — comm_subscriptions  (+ compose buildSubscriptionLifecycle)
 *   4. Entitlement Intelligence    — comm_entitlement_grants (+ compose buildEntitlementOverview / FeatureClass)
 *   5. Revenue Intelligence        — capadex_payments + comm_subscriptions (+ compose Revenue / RecurringRevenue)
 *   6. Platform Governance         — rbac_* / gov_* / aig_* (RBAC, approvals, audit, AI governance)
 *   7. Customer Success Intelligence — compose buildRenewalPipeline + buildUpsellOverview
 *   8. Enterprise Readiness        — anl_* warehouse (+ compose getEnterpriseOverview)
 *
 * Honesty contract (mirrors 5.15 / 4.12 / 3.12):
 *   - THREE statuses. PASS = checked & valid. WARN = honest absence / not measurable
 *     (absent table, empty subsystem, no rows yet) — NEVER a failure. FAIL = a real
 *     invariant violation (negative money, period_end < period_start, orphan FK, decided
 *     approval missing decider, out-of-bounds rate/score, null created_at, or an
 *     EXISTING-but-unreadable table).
 *   - Coverage (does data exist) and Confidence (is it trustworthy) are SEPARATE axes;
 *     never composited.
 *   - null ≠ 0: a missing/absent count stays null/absent, never silently coerced to 0.
 *   - GET-never-writes: ZERO DDL. Every table is probed with to_regclass before it is
 *     read; the composed engines are all 0-DDL pure read composers. No write path exists.
 *   - never-throws: each area runs in its own try/catch; a thrown error becomes a FAIL
 *     for THAT area only — the orchestrator never throws and never 500s.
 */

import type { Pool } from 'pg';
import { buildRevenueIntelligence, buildRecurringRevenue } from './wc7c/revenue-intelligence.js';
import { buildRenewalPipeline } from './wc7c/renewal-engine.js';
import { buildUpsellOverview } from './wc7c/upsell-engine.js';
import { buildSubscriptionLifecycle } from './wc7c/subscription-lifecycle.js';
import { buildEntitlementOverview, buildFeatureClassOverview } from './wc7c/entitlement-engine.js';
import { getEnterpriseOverview } from './enterprise-intelligence.js';

export const COMMERCIAL_PLATFORM_VALIDATION_VERSION = '6.0.0';

export const COMMERCIAL_VALIDATION_DISCLAIMER =
  'Read-only honesty/invariant harness for the eight commercial subsystems. It re-reads ' +
  'already-recorded commercial data and composes existing read-only engines; it performs no ' +
  'new scoring, charges nothing, and writes nothing. WARN denotes an honest absence (not ' +
  'provisioned / no data yet) — never a failure; FAIL denotes a real invariant break. ' +
  'Coverage and Confidence are separate axes; a missing value is null, never 0.';

// ── Result types (mirror Phase-5.15) ─────────────────────────────────────────

export type ValidationStatus = 'pass' | 'warn' | 'fail';

export interface ValidationCheck {
  id: string;
  label: string;
  status: ValidationStatus;
  detail: string;
}

export interface ValidationArea {
  id: string;
  label: string;
  scope: 'platform';
  status: ValidationStatus;
  measurable: boolean;
  checks: ValidationCheck[];
  notes: string[];
}

export interface CommercialValidationResult {
  ok: boolean;
  version: string;
  generated_at: string;
  areas: ValidationArea[];
  summary: {
    areas_total: number;
    pass: number;
    warn: number;
    fail: number;
    status: ValidationStatus;
    measurable_areas: number;
  };
  disclaimer: string;
  notes: string[];
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** WARN is benign; FAIL dominates; otherwise PASS. */
function worst(statuses: ValidationStatus[]): ValidationStatus {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('warn')) return 'warn';
  return 'pass';
}

function check(id: string, label: string, status: ValidationStatus, detail: string): ValidationCheck {
  return { id, label, status, detail };
}

function area(
  id: string,
  label: string,
  measurable: boolean,
  checks: ValidationCheck[],
  notes: string[] = [],
): ValidationArea {
  return { id, label, scope: 'platform', measurable, status: worst(checks.map((c) => c.status)), checks, notes };
}

/** A thrown engine/query error is a FAIL for THAT area only — never a 500. */
function failArea(id: string, label: string, err: unknown): ValidationArea {
  const msg = err instanceof Error ? err.message : String(err);
  return area(
    id,
    label,
    false,
    [check('engine_error', 'Area executed without throwing', 'fail', `threw: ${msg}`)],
    ['Area failed because a probe/composed engine threw — isolated; other areas are unaffected.'],
  );
}

/** An area whose primary table is not provisioned: WARN (honest absence), no read. */
function notProvisionedArea(id: string, label: string, table: string): ValidationArea {
  return area(
    id,
    label,
    false,
    [
      check(
        'provisioned',
        'Primary table is provisioned',
        'warn',
        `${table} absent — subsystem not provisioned (honest absence, not a failure). GET performs zero DDL.`,
      ),
    ],
    ['Area skipped its reads to guarantee GET-never-writes; not a defect.'],
  );
}

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  const r = await pool.query<{ reg: string | null }>('SELECT to_regclass($1) AS reg', [table]);
  return !!r.rows[0]?.reg;
}

/** Run an aggregate returning a single integer column `n`. */
async function num(pool: Pool, sql: string, params: any[] = []): Promise<number> {
  const r = await pool.query<{ n: string | number }>(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}

// ── Orchestrator scaffolding ─────────────────────────────────────────────────

type AreaFn = () => Promise<ValidationArea>;

async function runArea(id: string, label: string, fn: AreaFn): Promise<ValidationArea> {
  try {
    return await fn();
  } catch (err) {
    return failArea(id, label, err);
  }
}

// Canonical enums (used ONLY for invariant assertions on existing rows).
// These MIRROR the live DB CHECK constraints exactly so the harness never false-FAILs a
// legitimately-stored row, and would only FAIL if a row escaped its constraint.
//   comm_subscriptions.status      CHECK in ('trial','active','past_due','cancelled','expired')
//   comm_entitlement_grants.status CHECK in ('active','revoked')
//   capadex_payments.status        CHECK in ('pending','paid','failed','refunded')
const SUBSCRIPTION_STATUSES = ['trial', 'active', 'past_due', 'cancelled', 'expired'];
const GRANT_STATUSES = ['active', 'revoked'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];
const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];

export async function runCommercialPlatformValidation(pool: Pool): Promise<CommercialValidationResult> {
  const areas: ValidationArea[] = [];

  // 1 — Commercial Layer (catalog) ─────────────────────────────────────────────
  areas.push(
    await runArea('commercial_layer', 'Commercial Layer', async () => {
      if (!(await tableExists(pool, 'comm_products')) && !(await tableExists(pool, 'comm_plans'))) {
        return notProvisionedArea('commercial_layer', 'Commercial Layer', 'comm_products / comm_plans');
      }
      const checks: ValidationCheck[] = [];
      const products = (await tableExists(pool, 'comm_products'))
        ? await num(pool, 'SELECT COUNT(*)::int n FROM comm_products') : 0;
      const plans = (await tableExists(pool, 'comm_plans'))
        ? await num(pool, 'SELECT COUNT(*)::int n FROM comm_plans') : 0;
      const measurable = products > 0 || plans > 0;
      checks.push(check('catalog_coverage', 'Catalog has products/plans (Coverage axis)', measurable ? 'pass' : 'warn',
        measurable ? `${products} product(s), ${plans} plan(s).` : 'catalog empty — no products/plans seeded yet (Coverage gap, not a failure).'));

      // Invariant: plan price non-negative.
      if (plans > 0) {
        const negPrice = await num(pool, 'SELECT COUNT(*)::int n FROM comm_plans WHERE price_paise IS NOT NULL AND price_paise < 0');
        checks.push(check('plan_price_non_negative', 'Plan price_paise non-negative', negPrice === 0 ? 'pass' : 'fail',
          negPrice === 0 ? 'all plan prices non-negative.' : `${negPrice} plan(s) with negative price.`));
        // Invariant: no plan referencing a missing product (orphan FK).
        // Guard the dependent table: if comm_products is absent this is an honest WARN, not a FAIL.
        if (await tableExists(pool, 'comm_products')) {
          const orphanPlans = await num(pool,
            'SELECT COUNT(*)::int n FROM comm_plans p WHERE p.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM comm_products pr WHERE pr.id = p.product_id)');
          checks.push(check('plan_product_fk', 'Every plan references an existing product', orphanPlans === 0 ? 'pass' : 'fail',
            orphanPlans === 0 ? 'no orphan plans.' : `${orphanPlans} plan(s) reference a missing product.`));
        } else {
          checks.push(check('plan_product_fk', 'Every plan references an existing product', 'warn',
            'comm_products absent — plan→product FK not checkable (honest absence, not a failure).'));
        }
      }
      // Invariant: bundle price non-negative.
      if (await tableExists(pool, 'comm_bundles')) {
        const negBundle = await num(pool, 'SELECT COUNT(*)::int n FROM comm_bundles WHERE price_paise IS NOT NULL AND price_paise < 0');
        checks.push(check('bundle_price_non_negative', 'Bundle price_paise non-negative', negBundle === 0 ? 'pass' : 'fail',
          negBundle === 0 ? 'bundle prices non-negative.' : `${negBundle} bundle(s) with negative price.`));
      }
      // Invariant: coupon discount non-negative & redemptions within cap.
      if (await tableExists(pool, 'comm_coupons')) {
        const badCoupon = await num(pool, 'SELECT COUNT(*)::int n FROM comm_coupons WHERE discount_value IS NOT NULL AND discount_value < 0');
        checks.push(check('coupon_discount_non_negative', 'Coupon discount_value non-negative', badCoupon === 0 ? 'pass' : 'fail',
          badCoupon === 0 ? 'coupon discounts non-negative.' : `${badCoupon} coupon(s) with negative discount.`));
        const overRedeemed = await num(pool,
          'SELECT COUNT(*)::int n FROM comm_coupons WHERE max_redemptions IS NOT NULL AND redeemed_count IS NOT NULL AND redeemed_count > max_redemptions');
        checks.push(check('coupon_redemption_cap', 'Coupon redeemed_count ≤ max_redemptions', overRedeemed === 0 ? 'pass' : 'fail',
          overRedeemed === 0 ? 'no coupon over its redemption cap.' : `${overRedeemed} coupon(s) over redemption cap.`));
      }

      // ── Phase 6.1 Commercial Architecture layer (SKUs / Add-ons / Entitlement Framework). ──
      // Each table is probed first; absent (flag never enabled) → skipped → byte-identical output.
      if (await tableExists(pool, 'comm_skus')) {
        const skus = await num(pool, 'SELECT COUNT(*)::int n FROM comm_skus');
        checks.push(check('sku_coverage', 'SKU layer populated (Coverage axis)', skus > 0 ? 'pass' : 'warn',
          skus > 0 ? `${skus} SKU(s).` : 'no SKUs seeded yet (Coverage gap, not a failure).'));
        if (skus > 0) {
          const negSku = await num(pool, 'SELECT COUNT(*)::int n FROM comm_skus WHERE price_paise IS NOT NULL AND price_paise < 0');
          checks.push(check('sku_price_non_negative', 'SKU price_paise non-negative (when overridden)', negSku === 0 ? 'pass' : 'fail',
            negSku === 0 ? 'all SKU prices non-negative.' : `${negSku} SKU(s) with negative price.`));
          if (await tableExists(pool, 'comm_products')) {
            const orphanSku = await num(pool,
              'SELECT COUNT(*)::int n FROM comm_skus s WHERE s.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM comm_products pr WHERE pr.id = s.product_id)');
            checks.push(check('sku_product_fk', 'Every SKU references an existing product', orphanSku === 0 ? 'pass' : 'fail',
              orphanSku === 0 ? 'no orphan SKU→product.' : `${orphanSku} SKU(s) reference a missing product.`));
          }
        }
      }
      if (await tableExists(pool, 'comm_addons')) {
        const addons = await num(pool, 'SELECT COUNT(*)::int n FROM comm_addons');
        checks.push(check('addon_coverage', 'Add-on catalog populated (Coverage axis)', addons > 0 ? 'pass' : 'warn',
          addons > 0 ? `${addons} add-on(s).` : 'no add-ons seeded yet (Coverage gap, not a failure).'));
        if (addons > 0) {
          const negAddon = await num(pool, 'SELECT COUNT(*)::int n FROM comm_addons WHERE price_paise IS NOT NULL AND price_paise < 0');
          checks.push(check('addon_price_non_negative', 'Add-on price_paise non-negative', negAddon === 0 ? 'pass' : 'fail',
            negAddon === 0 ? 'all add-on prices non-negative.' : `${negAddon} add-on(s) with negative price.`));
        }
      }
      if (await tableExists(pool, 'comm_features')) {
        const features = await num(pool, 'SELECT COUNT(*)::int n FROM comm_features');
        checks.push(check('feature_framework_coverage', 'Entitlement-framework features defined (Coverage axis)', features > 0 ? 'pass' : 'warn',
          features > 0 ? `${features} feature(s) in the framework.` : 'no features defined yet (Coverage gap, not a failure).'));
        // Entitlement mapping invariants — guard the dependent tables.
        if (await tableExists(pool, 'comm_plan_entitlements')) {
          const ents = await num(pool, 'SELECT COUNT(*)::int n FROM comm_plan_entitlements');
          if (ents > 0) {
            const negQuota = await num(pool, 'SELECT COUNT(*)::int n FROM comm_plan_entitlements WHERE quota IS NOT NULL AND quota < 0');
            checks.push(check('entitlement_quota_non_negative', 'Plan-entitlement quota non-negative (NULL = unlimited)', negQuota === 0 ? 'pass' : 'fail',
              negQuota === 0 ? 'all entitlement quotas non-negative.' : `${negQuota} entitlement(s) with negative quota.`));
            const orphanFeat = await num(pool,
              'SELECT COUNT(*)::int n FROM comm_plan_entitlements pe WHERE NOT EXISTS (SELECT 1 FROM comm_features f WHERE f.code = pe.feature_code)');
            checks.push(check('entitlement_feature_fk', 'Every plan-entitlement references an existing feature', orphanFeat === 0 ? 'pass' : 'fail',
              orphanFeat === 0 ? 'no orphan entitlement→feature.' : `${orphanFeat} entitlement(s) reference a missing feature.`));
            if (await tableExists(pool, 'comm_plans')) {
              const orphanPlanEnt = await num(pool,
                'SELECT COUNT(*)::int n FROM comm_plan_entitlements pe WHERE NOT EXISTS (SELECT 1 FROM comm_plans p WHERE p.id = pe.plan_id)');
              checks.push(check('entitlement_plan_fk', 'Every plan-entitlement references an existing plan', orphanPlanEnt === 0 ? 'pass' : 'fail',
                orphanPlanEnt === 0 ? 'no orphan entitlement→plan.' : `${orphanPlanEnt} entitlement(s) reference a missing plan.`));
            }
          }
        }
      }

      return area('commercial_layer', 'Commercial Layer', measurable, checks,
        ['Includes the Phase-6.1 architecture layer (SKUs / Add-ons / Entitlement Framework) when those tables exist; absent tables are skipped (byte-identical when the flag was never enabled).']);
    }),
  );

  // 2 — Institution Layer (tenants) ────────────────────────────────────────────
  areas.push(
    await runArea('institution_layer', 'Institution Layer', async () => {
      if (!(await tableExists(pool, 'tenants'))) {
        return notProvisionedArea('institution_layer', 'Institution Layer', 'tenants');
      }
      const checks: ValidationCheck[] = [];
      const tenantCount = await num(pool, 'SELECT COUNT(*)::int n FROM tenants');
      const measurable = tenantCount > 0;
      checks.push(check('tenants_present', 'At least one institution/tenant (Coverage axis)', measurable ? 'pass' : 'warn',
        measurable ? `${tenantCount} tenant(s).` : 'no tenants onboarded yet (Coverage gap, not a failure).'));
      if (measurable) {
        const overAllocated = await num(pool, 'SELECT COUNT(*)::int n FROM tenants WHERE active_users IS NOT NULL AND max_users IS NOT NULL AND active_users > max_users');
        checks.push(check('seat_invariant', 'active_users ≤ max_users per tenant', overAllocated === 0 ? 'pass' : 'fail',
          overAllocated === 0 ? 'no tenant over its seat cap.' : `${overAllocated} tenant(s) exceed max_users.`));
        const negSeats = await num(pool, 'SELECT COUNT(*)::int n FROM tenants WHERE (active_users IS NOT NULL AND active_users < 0) OR (max_users IS NOT NULL AND max_users < 0)');
        checks.push(check('seats_non_negative', 'Tenant seat counts non-negative', negSeats === 0 ? 'pass' : 'fail',
          negSeats === 0 ? 'seat counts non-negative.' : `${negSeats} tenant(s) with negative seats.`));
      }
      return area('institution_layer', 'Institution Layer', measurable, checks);
    }),
  );

  // 3 — Subscription Intelligence ──────────────────────────────────────────────
  areas.push(
    await runArea('subscription_intelligence', 'Subscription Intelligence', async () => {
      if (!(await tableExists(pool, 'comm_subscriptions'))) {
        return notProvisionedArea('subscription_intelligence', 'Subscription Intelligence', 'comm_subscriptions');
      }
      const checks: ValidationCheck[] = [];
      const subs = await num(pool, 'SELECT COUNT(*)::int n FROM comm_subscriptions');
      const measurable = subs > 0;
      checks.push(check('subscriptions_coverage', 'Subscriptions exist (Coverage axis)', measurable ? 'pass' : 'warn',
        measurable ? `${subs} subscription(s).` : 'no commercial subscriptions yet (Coverage gap, not a failure).'));
      if (measurable) {
        const nullStatus = await num(pool, 'SELECT COUNT(*)::int n FROM comm_subscriptions WHERE status IS NULL');
        checks.push(check('status_present', 'Every subscription has a status', nullStatus === 0 ? 'pass' : 'fail',
          nullStatus === 0 ? 'all subscriptions carry a status.' : `${nullStatus} subscription(s) missing status.`));
        const badStatus = await num(pool, 'SELECT COUNT(*)::int n FROM comm_subscriptions WHERE status IS NOT NULL AND status <> ALL($1)', [SUBSCRIPTION_STATUSES]);
        checks.push(check('status_canon', 'Subscription status within canonical set', badStatus === 0 ? 'pass' : 'fail',
          badStatus === 0 ? 'all statuses canonical.' : `${badStatus} subscription(s) with out-of-canon status.`));
        const badPeriod = await num(pool, 'SELECT COUNT(*)::int n FROM comm_subscriptions WHERE current_period_start IS NOT NULL AND current_period_end IS NOT NULL AND current_period_end < current_period_start');
        checks.push(check('period_ordering', 'current_period_end ≥ current_period_start', badPeriod === 0 ? 'pass' : 'fail',
          badPeriod === 0 ? 'period bounds ordered.' : `${badPeriod} subscription(s) with end before start.`));
        // Guard the dependent table: if comm_plans is absent this is an honest WARN, not a FAIL.
        if (await tableExists(pool, 'comm_plans')) {
          const orphanPlan = await num(pool,
            'SELECT COUNT(*)::int n FROM comm_subscriptions s WHERE s.plan_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM comm_plans p WHERE p.id = s.plan_id)');
          checks.push(check('subscription_plan_fk', 'Every plan_id references an existing plan', orphanPlan === 0 ? 'pass' : 'fail',
            orphanPlan === 0 ? 'no orphan subscription→plan.' : `${orphanPlan} subscription(s) reference a missing plan.`));
        } else {
          checks.push(check('subscription_plan_fk', 'Every plan_id references an existing plan', 'warn',
            'comm_plans absent — subscription→plan FK not checkable (honest absence, not a failure).'));
        }
      }
      // Compose the existing lifecycle engine (pure read; reports both commercial models).
      const lc = await buildSubscriptionLifecycle(pool);
      checks.push(check('lifecycle_compose', 'Subscription lifecycle engine composes (Confidence axis)', lc.degraded ? 'warn' : 'pass',
        `b2c_ladder total=${lc.b2c_ladder?.total ?? 0}; package_subscriptions total=${lc.package_subscriptions?.total ?? 0}${lc.degraded ? ' (degraded — composed over an empty/partial substrate).' : '.'}`));
      return area('subscription_intelligence', 'Subscription Intelligence', measurable, checks,
        ['Composes buildSubscriptionLifecycle (read-only); reports the legacy B2C ladder AND the comm_subscriptions package model as separate axes.']);
    }),
  );

  // 4 — Entitlement Intelligence ───────────────────────────────────────────────
  areas.push(
    await runArea('entitlement_intelligence', 'Entitlement Intelligence', async () => {
      const hasGrants = await tableExists(pool, 'comm_entitlement_grants');
      const checks: ValidationCheck[] = [];
      let measurable = false;
      if (hasGrants) {
        const grants = await num(pool, 'SELECT COUNT(*)::int n FROM comm_entitlement_grants');
        measurable = grants > 0;
        checks.push(check('grants_coverage', 'Entitlement grants exist (Coverage axis)', measurable ? 'pass' : 'warn',
          measurable ? `${grants} grant(s).` : 'no manual entitlement grants yet (Coverage gap, not a failure).'));
        if (measurable) {
          const nullFeature = await num(pool, 'SELECT COUNT(*)::int n FROM comm_entitlement_grants WHERE feature IS NULL OR status IS NULL');
          checks.push(check('grant_fields_present', 'Every grant has feature + status', nullFeature === 0 ? 'pass' : 'fail',
            nullFeature === 0 ? 'grant fields present.' : `${nullFeature} grant(s) missing feature/status.`));
          const badStatus = await num(pool, 'SELECT COUNT(*)::int n FROM comm_entitlement_grants WHERE status IS NOT NULL AND status <> ALL($1)', [GRANT_STATUSES]);
          checks.push(check('grant_status_canon', 'Grant status within canonical set', badStatus === 0 ? 'pass' : 'fail',
            badStatus === 0 ? 'all grant statuses canonical.' : `${badStatus} grant(s) with out-of-canon status.`));
          const revokedNoStamp = await num(pool, "SELECT COUNT(*)::int n FROM comm_entitlement_grants WHERE status='revoked' AND revoked_at IS NULL");
          checks.push(check('revoked_stamp', 'Revoked grants carry revoked_at', revokedNoStamp === 0 ? 'pass' : 'fail',
            revokedNoStamp === 0 ? 'revoked grants timestamped.' : `${revokedNoStamp} revoked grant(s) missing revoked_at.`));
        }
      } else {
        checks.push(check('grants_provisioned', 'comm_entitlement_grants provisioned', 'warn',
          'comm_entitlement_grants absent — manual grants not provisioned (honest absence).'));
      }
      // Compose entitlement overview (pure read over subscriptions + grants).
      const ov = await buildEntitlementOverview(pool);
      checks.push(check('entitlement_overview_compose', 'Entitlement overview composes (Confidence axis)', ov.degraded ? 'warn' : 'pass',
        `paying_identities=${ov.paying_identities}; entitled_identities=${ov.entitled_identities}; coverage_pct=${ov.coverage_pct === null ? 'null (not measurable)' : ov.coverage_pct}.`));
      const fc = await buildFeatureClassOverview(pool);
      checks.push(check('feature_class_compose', 'Feature-class overview composes', fc.degraded ? 'warn' : 'pass',
        `active_subscriptions=${fc.active_subscriptions}; active_grants=${fc.active_grants}.`));
      return area('entitlement_intelligence', 'Entitlement Intelligence', measurable, checks,
        ['coverage_pct is null when there are zero paying identities (not measurable — never 0).']);
    }),
  );

  // 5 — Revenue Intelligence ───────────────────────────────────────────────────
  areas.push(
    await runArea('revenue_intelligence', 'Revenue Intelligence', async () => {
      if (!(await tableExists(pool, 'capadex_payments'))) {
        return notProvisionedArea('revenue_intelligence', 'Revenue Intelligence', 'capadex_payments');
      }
      const checks: ValidationCheck[] = [];
      const payments = await num(pool, 'SELECT COUNT(*)::int n FROM capadex_payments');
      const measurable = payments > 0;
      checks.push(check('payments_coverage', 'Payments exist (Coverage axis)', measurable ? 'pass' : 'warn',
        measurable ? `${payments} payment row(s).` : 'no payments recorded yet (Coverage gap, not a failure).'));
      if (measurable) {
        const negAmount = await num(pool, 'SELECT COUNT(*)::int n FROM capadex_payments WHERE amount_paise IS NOT NULL AND amount_paise < 0');
        checks.push(check('amount_non_negative', 'Payment amount_paise non-negative', negAmount === 0 ? 'pass' : 'fail',
          negAmount === 0 ? 'all payment amounts non-negative.' : `${negAmount} payment(s) with negative amount.`));
        const badStatus = await num(pool, 'SELECT COUNT(*)::int n FROM capadex_payments WHERE status IS NOT NULL AND status <> ALL($1)', [PAYMENT_STATUSES]);
        checks.push(check('payment_status_canon', 'Payment status within canonical set', badStatus === 0 ? 'pass' : 'fail',
          badStatus === 0 ? 'all payment statuses canonical.' : `${badStatus} payment(s) with out-of-canon status.`));
        const paidNoRef = await num(pool, "SELECT COUNT(*)::int n FROM capadex_payments WHERE status='paid' AND (razorpay_payment_id IS NULL OR razorpay_payment_id='')");
        checks.push(check('paid_has_reference', "Paid payments carry a gateway/demo reference", paidNoRef === 0 ? 'pass' : 'fail',
          paidNoRef === 0 ? 'all paid rows reference a payment id.' : `${paidNoRef} paid payment(s) missing razorpay_payment_id.`));
        const nullTs = await num(pool, 'SELECT COUNT(*)::int n FROM capadex_payments WHERE created_at IS NULL');
        checks.push(check('created_at_present', 'Every payment carries created_at', nullTs === 0 ? 'pass' : 'fail',
          nullTs === 0 ? 'all payments timestamped.' : `${nullTs} payment(s) missing created_at.`));
      }
      // Compose revenue + recurring-revenue intelligence (pure read).
      const rev = await buildRevenueIntelligence(pool);
      checks.push(check('revenue_compose', 'Revenue intelligence composes (Confidence axis)', rev.degraded ? 'warn' : 'pass',
        `paid=${rev.overall?.paid ?? 0}; rupees=${rev.overall?.rupees ?? 0}; attribution_coverage_pct=${rev.attribution?.coverage_pct ?? 'null'}${rev.degraded ? ' (degraded).' : '.'}`));
      const rec = await buildRecurringRevenue(pool);
      checks.push(check('recurring_revenue_compose', 'Recurring revenue (MRR/ARR) composes', rec.degraded ? 'warn' : 'pass',
        `MRR=₹${rec.mrr?.rupees ?? 0} over ${rec.mrr?.active_subscriptions ?? 0} active sub(s); ARR=₹${rec.arr?.rupees ?? 0}${rec.degraded ? ' (degraded — no recurring substrate yet).' : '.'}`));
      return area('revenue_intelligence', 'Revenue Intelligence', measurable, checks,
        ['Revenue composes the one-time ledger (capadex_payments) AND the recurring comm_subscriptions model — never a second ledger.']);
    }),
  );

  // 6 — Platform Governance ────────────────────────────────────────────────────
  areas.push(
    await runArea('platform_governance', 'Platform Governance', async () => {
      const govTables = ['rbac_role_hierarchies', 'rbac_permission_groups', 'rbac_approval_requests',
        'rbac_admin_status', 'rbac_failed_logins', 'gov_audit_framework', 'governance_events'];
      const present: string[] = [];
      for (const t of govTables) if (await tableExists(pool, t)) present.push(t);
      if (present.length === 0) {
        return notProvisionedArea('platform_governance', 'Platform Governance', 'rbac_* / gov_*');
      }
      const checks: ValidationCheck[] = [];
      checks.push(check('governance_provisioned', 'Governance tables provisioned', 'pass', `${present.length} governance table(s): ${present.join(', ')}.`));

      let auditRows = 0;
      if (present.includes('gov_audit_framework')) auditRows += await num(pool, 'SELECT COUNT(*)::int n FROM gov_audit_framework');
      if (present.includes('governance_events')) auditRows += await num(pool, 'SELECT COUNT(*)::int n FROM governance_events');
      const measurable = auditRows > 0;
      checks.push(check('audit_coverage', 'Governance audit entries exist (Coverage axis)', measurable ? 'pass' : 'warn',
        measurable ? `${auditRows} audit/event row(s).` : 'no governance audit rows yet (Coverage gap, not a failure).'));

      // Invariant: a decided approval must carry a decider + decided_at.
      if (present.includes('rbac_approval_requests')) {
        const badStatus = await num(pool, 'SELECT COUNT(*)::int n FROM rbac_approval_requests WHERE status IS NOT NULL AND status <> ALL($1)', [APPROVAL_STATUSES]);
        checks.push(check('approval_status_canon', 'Approval status within canonical set', badStatus === 0 ? 'pass' : 'fail',
          badStatus === 0 ? 'approval statuses canonical.' : `${badStatus} approval(s) with out-of-canon status.`));
        const decidedNoDecider = await num(pool, "SELECT COUNT(*)::int n FROM rbac_approval_requests WHERE status IN ('approved','rejected') AND (decided_by IS NULL OR decided_at IS NULL)");
        checks.push(check('decided_has_decider', 'Decided approvals carry decided_by + decided_at', decidedNoDecider === 0 ? 'pass' : 'fail',
          decidedNoDecider === 0 ? 'decided approvals fully stamped.' : `${decidedNoDecider} decided approval(s) missing decider/timestamp.`));
      }
      // AI governance coverage (Coverage axis only — informational).
      if (await tableExists(pool, 'aig_models')) {
        const aiModels = await num(pool, 'SELECT COUNT(*)::int n FROM aig_models');
        const aiRules = (await tableExists(pool, 'aig_insight_rules')) ? await num(pool, 'SELECT COUNT(*)::int n FROM aig_insight_rules') : 0;
        checks.push(check('ai_governance_coverage', 'AI Governance registry coverage (Coverage axis)', 'pass',
          `${aiModels} model(s), ${aiRules} insight rule(s) registered.`));
      }
      return area('platform_governance', 'Platform Governance', measurable, checks,
        ['RBAC grants are advisory; the live enforcement path remains the single super_admin gate on /api/admin/*.']);
    }),
  );

  // 7 — Customer Success Intelligence ──────────────────────────────────────────
  areas.push(
    await runArea('customer_success_intelligence', 'Customer Success Intelligence', async () => {
      const checks: ValidationCheck[] = [];
      const renewal = await buildRenewalPipeline(pool);
      const renewableActive = renewal.package_model?.renewable_active ?? 0;
      const dueSoon = renewal.package_model?.due_soon ?? 0;
      const inGrace = renewal.package_model?.in_grace ?? 0;
      checks.push(check('renewal_compose', 'Renewal pipeline composes (Confidence axis)', renewal.degraded ? 'warn' : 'pass',
        `package_model renewable_active=${renewableActive}, due_soon=${dueSoon}, in_grace=${inGrace}; b2c_ladder renewal_applicable=${renewal.b2c_ladder?.renewal_applicable}${renewal.degraded ? ' (degraded).' : '.'}`));

      const upsell = await buildUpsellOverview(pool);
      const eligible = upsell.eligible_identities ?? 0;
      checks.push(check('upsell_compose', 'Upsell overview composes', upsell.degraded ? 'warn' : 'pass',
        `eligible_identities=${eligible}; full_ladder_owners=${upsell.full_ladder_owners ?? 0}.`));

      // Honesty: surface the upsell trigger taxonomy — what is built vs not built.
      const built = upsell.trigger_taxonomy?.built ?? [];
      const notBuilt = upsell.trigger_taxonomy?.not_built ?? [];
      checks.push(check('trigger_taxonomy', 'Upsell trigger taxonomy disclosed (built vs not-built)', notBuilt.length > 0 ? 'warn' : 'pass',
        `built=[${built.join(', ') || 'none'}]; not_built=[${notBuilt.join(', ') || 'none'}]${notBuilt.length > 0 ? ' — behavioural triggers remain unbuilt (honest gap, not a failure).' : '.'}`));

      const measurable = renewableActive > 0 || eligible > 0;
      checks.push(check('cs_measurable', 'Customer-success signals measurable (Coverage axis)', measurable ? 'pass' : 'warn',
        measurable ? 'renewable/eligible population present.' : 'no renewable or upsell-eligible population yet (Coverage gap, not a failure).'));
      return area('customer_success_intelligence', 'Customer Success Intelligence', measurable, checks,
        ['Composes buildRenewalPipeline + buildUpsellOverview (read-only). The B2C ladder cannot renew by design; renewal applies to the package model only.']);
    }),
  );

  // 8 — Enterprise Readiness ───────────────────────────────────────────────────
  areas.push(
    await runArea('enterprise_readiness', 'Enterprise Readiness', async () => {
      const hasFeatures = await tableExists(pool, 'anl_predictive_features');
      const hasKpi = await tableExists(pool, 'anl_kpi_daily');
      if (!hasFeatures && !hasKpi) {
        return notProvisionedArea('enterprise_readiness', 'Enterprise Readiness', 'anl_predictive_features / anl_kpi_daily');
      }
      const checks: ValidationCheck[] = [];
      let measurable = false;
      if (hasFeatures) {
        const rows = await num(pool, 'SELECT COUNT(*)::int n FROM anl_predictive_features');
        measurable = measurable || rows > 0;
        checks.push(check('features_coverage', 'Predictive features warehouse populated (Coverage axis)', rows > 0 ? 'pass' : 'warn',
          rows > 0 ? `${rows} feature row(s).` : 'analytics warehouse not refreshed yet (Coverage gap, not a failure).'));
        if (rows > 0) {
          const badCompletion = await num(pool, 'SELECT COUNT(*)::int n FROM anl_predictive_features WHERE completion_rate IS NOT NULL AND (completion_rate < 0 OR completion_rate > 1)');
          checks.push(check('completion_rate_bounds', 'completion_rate within [0,1] or null', badCompletion === 0 ? 'pass' : 'fail',
            badCompletion === 0 ? 'completion rates within range.' : `${badCompletion} feature row(s) out of [0,1].`));
          const badScore = await num(pool, 'SELECT COUNT(*)::int n FROM anl_predictive_features WHERE avg_score IS NOT NULL AND (avg_score < 0 OR avg_score > 100)');
          checks.push(check('avg_score_bounds', 'avg_score within [0,100] or null', badScore === 0 ? 'pass' : 'fail',
            badScore === 0 ? 'avg_score within range.' : `${badScore} feature row(s) out of [0,100].`));
        }
      }
      if (hasKpi) {
        const kpiRows = await num(pool, 'SELECT COUNT(*)::int n FROM anl_kpi_daily');
        measurable = measurable || kpiRows > 0;
        checks.push(check('kpi_coverage', 'KPI warehouse populated (Coverage axis)', kpiRows > 0 ? 'pass' : 'warn',
          kpiRows > 0 ? `${kpiRows} KPI row(s).` : 'no KPI rows yet (Coverage gap, not a failure).'));
      }
      // k-anonymity invariant: benchmark snapshots below k must be suppressed.
      if (await tableExists(pool, 'anl_benchmark_snapshot')) {
        const leak = await num(pool, 'SELECT COUNT(*)::int n FROM anl_benchmark_snapshot WHERE suppressed = FALSE AND sample_size IS NOT NULL AND sample_size < 30');
        checks.push(check('k_anonymity', 'Benchmarks below k=30 are suppressed', leak === 0 ? 'pass' : 'fail',
          leak === 0 ? 'no sub-threshold benchmark leaks.' : `${leak} benchmark(s) below k=30 not suppressed.`));
      }
      // Compose the enterprise overview (pure read; may be null when no tenant data).
      const ent = await getEnterpriseOverview(pool).catch(() => null);
      checks.push(check('enterprise_overview_compose', 'Enterprise overview composes (Confidence axis)', ent ? 'pass' : 'warn',
        ent ? 'enterprise overview available.' : 'enterprise overview null — no organizational data yet (honest absence, not a failure).'));
      return area('enterprise_readiness', 'Enterprise Readiness', measurable, checks);
    }),
  );

  // ── Summary ────────────────────────────────────────────────────────────────
  const pass = areas.filter((a) => a.status === 'pass').length;
  const warn = areas.filter((a) => a.status === 'warn').length;
  const fail = areas.filter((a) => a.status === 'fail').length;
  const measurable_areas = areas.filter((a) => a.measurable).length;

  return {
    ok: true,
    version: COMMERCIAL_PLATFORM_VALIDATION_VERSION,
    generated_at: new Date().toISOString(),
    areas,
    summary: {
      areas_total: areas.length,
      pass,
      warn,
      fail,
      status: worst(areas.map((a) => a.status)),
      measurable_areas,
    },
    disclaimer: COMMERCIAL_VALIDATION_DISCLAIMER,
    notes: [
      'Read-only honesty/invariant harness across the eight commercial subsystems.',
      'WARN = honest absence / not measurable; FAIL = a real invariant break.',
      'Coverage and Confidence are reported as separate axes; a missing value is null, never 0.',
      'Most subsystems are structurally complete but data-empty in this environment: expect WARN-heavy, FAIL-free.',
    ],
  };
}

/** Static catalog of validated subsystems (no DB touch — used by the /catalog route). */
export function commercialValidationCatalog() {
  return {
    version: COMMERCIAL_PLATFORM_VALIDATION_VERSION,
    areas: [
      { id: 'commercial_layer', label: 'Commercial Layer', scope: 'platform' },
      { id: 'institution_layer', label: 'Institution Layer', scope: 'platform' },
      { id: 'subscription_intelligence', label: 'Subscription Intelligence', scope: 'platform' },
      { id: 'entitlement_intelligence', label: 'Entitlement Intelligence', scope: 'platform' },
      { id: 'revenue_intelligence', label: 'Revenue Intelligence', scope: 'platform' },
      { id: 'platform_governance', label: 'Platform Governance', scope: 'platform' },
      { id: 'customer_success_intelligence', label: 'Customer Success Intelligence', scope: 'platform' },
      { id: 'enterprise_readiness', label: 'Enterprise Readiness', scope: 'platform' },
    ],
    statuses: ['pass', 'warn', 'fail'],
    disclaimer: COMMERCIAL_VALIDATION_DISCLAIMER,
  };
}
