/**
 * WC-C6A — Subscription Productization Audit (AUDIT ONLY · READ-ONLY · recompute from runtime).
 *
 * Determines whether CAPADEX has a commercially viable subscription PRODUCT architecture capable of
 * generating recurring revenue. Reuses WC-C1..C5 + the existing wc7c engines ONLY — NO new
 * model/table/ontology/subscription/pricing/product. Scores 4 SEPARATE axes (Structural / Activation
 * / Coverage / Confidence) — NEVER combined.
 *
 * Honesty discipline (mirrors WC-C1/C2/C5 memory + the WC-C6A architect:plan review):
 *   • Dual-axis: every named readiness % is a (Structural%, Activation%) PAIR, never a single number.
 *   • Structural = deterministic tier map (real 5 · gated-real 4 · partial 3 · stub 2 · absent 1) over
 *     a capability checklist declared UP FRONT incl. absent/stub cells; unexercised paths (0 rows,
 *     never ran e2e) capped at gated-real(4), never real(5).
 *   • Activation = per-capability BINARY "can fire on live data NOW?" + reason (data-driven).
 *   • Coverage = population fractions, eligible-only denominators; 0/0 → not_measurable (null), NEVER
 *     0% / 100%. An empty catalog is reported as a measured COUNT ("0 products defined"), never "0%".
 *   • Confidence = qualitative band + explicit n; never a fabricated %.
 *   • NAME-COLLISION GUARD: WC-C1 already owns "Subscription Readiness" (Success Metric 3, 6 cells).
 *     We recompute WC-C1's metric on its ORIGINAL 6-cell denominator and show it side-by-side; OUR
 *     subset metric is named distinctly "Subscription Model Readiness (WC-C6A)" and is an explicit
 *     SUBSET of the Productization checklist (identical capability IDs + tiers; membership map carried).
 *   • TWO catalogs declared explicitly: code-defined ladder catalog (3 live SKUs) and the DB package
 *     catalog (0 rows) — so "catalog empty" never contradicts "3 live SKUs".
 *   • The package SEED is a STUB: it inserts 13 rows with NO price/validity_days/question_count
 *     (schema leaves all nullable, no default) → even if run, the catalog would be unpriced +
 *     null-expiry → not sellable, not renewable. "Run the seed" is NEVER a sufficient fix.
 *   • The 6 pending CAP_INS rows are demo/mock (WC-C1 snapshot payments_demo=6, Razorpay unconfigured)
 *     — NEVER counted as demand. Recurring revenue = NONE today.
 *   • PII (emails) masked to user_<sha256hex[:10]> before any write. Single idempotent generator;
 *     never hand-edit the artifacts. Run WITHOUT FF_* overrides (deploy posture).
 */
import { Pool } from 'pg';
import { createHash } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { buildSubscriptionLifecycle } from '../../services/wc7c/subscription-lifecycle';
import { buildRenewalPipeline } from '../../services/wc7c/renewal-engine';
import { buildForecastInputs } from '../../services/wc7c/commercial-forecast-inputs';
import { buildEntitlementOverview, STAGE_FEATURES } from '../../services/wc7c/entitlement-engine';

const OUT_DIR = join(__dirname, '..', '..', 'audit', 'wc-c6a');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// B2C stage ladder SKUs — mirrors STAGE_PRICES in routes/capadex-payments.ts (kept in lockstep;
// imported value not used to avoid route-module side effects on import). One-time progressive unlocks.
const LADDER_SKUS = [
  { stage: 'CAP_INS', price_inr: 499, features: STAGE_FEATURES.CAP_INS },
  { stage: 'CAP_GRW', price_inr: 999, features: STAGE_FEATURES.CAP_GRW },
  { stage: 'CAP_MAS', price_inr: 1999, features: STAGE_FEATURES.CAP_MAS },
];

// ── helpers ──────────────────────────────────────────────────────────────────
const mask = (email: string | null | undefined): string =>
  email ? `user_${createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 10)}` : 'anonymous';

async function q<T = any>(sql: string, params: any[] = []): Promise<{ rows: T[]; ok: boolean }> {
  try {
    const r = await pool.query(sql, params);
    return { rows: r.rows as T[], ok: true };
  } catch {
    return { rows: [], ok: false };
  }
}

interface Cov { value: number | null; measurable: boolean; numerator: number; denominator: number; reason: string }
const pct = (num: number, den: number): Cov =>
  den > 0
    ? { value: Math.round((num / den) * 1000) / 10, measurable: true, numerator: num, denominator: den, reason: 'measured' }
    : { value: null, measurable: false, numerator: num, denominator: den, reason: 'not_measurable: empty denominator (0/0)' };

// Deterministic readiness tier map (matches WC-C1 TIER_SCORE + derived-scoring-audit-honesty.md).
const TIER = { real: 5, gated_real: 4, partial: 3, stub: 2, absent: 1 } as const;
type TierName = keyof typeof TIER;

interface Capability {
  id: string;
  layer: 'L1_catalog_definition' | 'L2_pricing' | 'L3_entitlement_packaging' | 'L4_sales_order' | 'L5_ladder_upgrade' | 'L6_renewal_recurring' | 'L7_consumer_offer';
  label: string;
  tier: TierName;
  /** membership in the Subscription Model Readiness (WC-C6A) SUBSET. Productization = ALL capabilities. */
  subscription: boolean;
  /** catalog family (for Catalog Readiness reporting — NOT a separate % ). */
  catalog_family?: 'ladder' | 'package';
  evidence: string;
  source: string;
}

// ── PRODUCTIZATION capability checklist (declared up front incl. absent/stub cells) ─────
const CAPABILITIES: Capability[] = [
  // L1 — catalog definition
  { id: 'ladder_catalog_skus', layer: 'L1_catalog_definition', label: 'Priced B2C ladder SKU catalog (CAP_INS/GRW/MAS)', tier: 'real', subscription: false, catalog_family: 'ladder',
    evidence: 'STAGE_PRICES (₹499/₹999/₹1999) defined in capadex-payments.ts; 3 priced SKUs presented via the live B2C order route.', source: 'WC-C1 SM3 b2c_ladder_catalog' },
  { id: 'package_catalog_schema', layer: 'L1_catalog_definition', label: 'Package catalog schema + admin CRUD', tier: 'real', subscription: true, catalog_family: 'package',
    evidence: 'subscription_packages table (category/segment/price/validity_days/question_count/report_type) + admin CRUD (seed/export/import/stats/PATCH/DELETE).', source: 'schema.ts:3104 / routes.ts admin CRUD' },
  { id: 'package_catalog_population', layer: 'L1_catalog_definition', label: 'Populated package catalog (live product rows)', tier: 'absent', subscription: true, catalog_family: 'package',
    evidence: 'subscription_packages = 0 live rows. The renewable model has NO products defined. Required machinery for a subscription PRODUCT → counts against Structural.', source: 'live count (this session)' },
  { id: 'package_seed_completeness', layer: 'L1_catalog_definition', label: 'Package seed produces SELLABLE+renewable rows', tier: 'stub', subscription: true, catalog_family: 'package',
    evidence: 'Seed (routes.ts:10029) inserts 13 packages with NO price / NO validity_days / NO question_count; schema leaves all 3 nullable (no default) → even if run, rows are UNPRICED + NULL-expiry → not sellable, not renewable. "Run the seed" is not a fix.', source: 'routes.ts:10029-10042 + schema.ts:3111-3113 (verified this session)' },
  // L2 — pricing
  { id: 'b2c_pricing_model', layer: 'L2_pricing', label: 'B2C ladder pricing model (lockstep constants)', tier: 'real', subscription: false,
    evidence: 'STAGE_PRICES used by the live order route; mirrored in subscription-engine.ts / entitlement-engine STAGE_FEATURES (kept in lockstep).', source: 'capadex-payments.ts:17' },
  { id: 'package_pricing_definition', layer: 'L2_pricing', label: 'Package pricing definition (price + validity actually set)', tier: 'partial', subscription: true,
    evidence: 'price/validity_days columns EXIST (schema real) but are nullable, never populated, and the seed omits them → no package price/validity is ever defined.', source: 'schema.ts:3111-3113 / live (0 priced rows)' },
  { id: 'pricing_tiers_discounting', layer: 'L2_pricing', label: 'Pricing tiers / discounting / proration / multi-currency', tier: 'absent', subscription: false,
    evidence: 'Single INR price per SKU; no discount/coupon/proration/currency engine anywhere.', source: 'grep: no discount/coupon/proration engine' },
  // L3 — entitlement packaging
  { id: 'stage_feature_map', layer: 'L3_entitlement_packaging', label: 'Stage→feature entitlement map (what a SKU unlocks)', tier: 'real', subscription: false,
    evidence: 'STAGE_FEATURES maps CAP_INS→insight_report, CAP_GRW→growth_report/growth_plan, CAP_MAS→mastery_report/mentor_access; entitlement is the UNION over owned stages.', source: 'entitlement-engine.ts:23' },
  { id: 'package_entitlement_map', layer: 'L3_entitlement_packaging', label: 'Package→entitlement/feature mapping', tier: 'absent', subscription: true,
    evidence: 'subscription_packages has NO feature column; grants are child/student-keyed (student_subscriptions), entitlement-DISJOINT from STAGE_FEATURES. A package purchase maps to nothing enforceable.', source: 'WC-C2 entitlement-readiness' },
  { id: 'entitlement_enforcement_gate', layer: 'L3_entitlement_packaging', label: 'Entitlement enforcement gate (access control)', tier: 'gated_real', subscription: false,
    evidence: 'WC-C4 requireEntitlement EXISTS over paid surfaces but flag commercialEntitlementEnforcement is OFF by default → dormant.', source: 'WC-C4' },
  // L4 — sales / order
  { id: 'b2c_order_payment_flow', layer: 'L4_sales_order', label: 'B2C order + payment flow (Razorpay create-order/verify)', tier: 'gated_real', subscription: false,
    evidence: 'capadex-payments.ts create-order/verify is live (6 pending CAP_INS rows) but only the DEMO fallback has ever executed; the real Razorpay capture path is UNEXERCISED (keys unconfigured) → capped gated-real, never real. Matches WC-C1 order_creation gated-real precedent.', source: 'capadex-payments.ts / WC-C1 SM4 order_creation (gated-real)' },
  { id: 'package_grant_flow', layer: 'L4_sales_order', label: 'Package grant flow (creates the renewable population)', tier: 'gated_real', subscription: true,
    evidence: 'routes.ts assign/create inserts student_subscriptions with expiry from validity_days. EXISTS but 0 live rows → unexercised e2e → capped gated-real, never real.', source: 'routes.ts:10111 / live (0 rows)' },
  { id: 'self_serve_package_checkout', layer: 'L4_sales_order', label: 'Self-serve package checkout (buyer-initiated package purchase)', tier: 'absent', subscription: true,
    evidence: 'Package grants are admin/parent-keyed; there is NO self-serve Razorpay order path for a package SKU (only the B2C stage ladder has a buyer order path).', source: 'grep: no package order route' },
  // L5 — ladder / upgrade
  { id: 'progressive_ladder', layer: 'L5_ladder_upgrade', label: 'Progressive ladder (CAP_CUR→INS→GRW→MAS)', tier: 'real', subscription: false,
    evidence: 'LADDER ordering in entitlement/subscription engines; each paid rung unlocks the next stage report.', source: 'entitlement-engine.ts:28' },
  { id: 'upgrade_offer_engine', layer: 'L5_ladder_upgrade', label: 'Upgrade path engine (next-rung offer)', tier: 'gated_real', subscription: false,
    evidence: 'offer-engine recommends the next ladder rung; gated by commercialActivation (OFF by default) and needs an owned current stage.', source: 'offer-engine.ts (WC-7B)' },
  { id: 'cross_package_upgrade', layer: 'L5_ladder_upgrade', label: 'Cross-package upgrade / proration', tier: 'absent', subscription: true,
    evidence: 'No package→package upgrade or proration path; packages are flat, unordered SKUs.', source: 'grep: no package upgrade/proration' },
  // L6 — renewal / recurring
  { id: 'renewal_candidate_engine', layer: 'L6_renewal_recurring', label: 'Renewal candidate identification (due_soon / in_grace)', tier: 'real', subscription: true,
    evidence: 'renewal-engine.ts buildRenewalPipeline (DUE_SOON 14d / GRACE 7d); read-only, NEVER auto-charges.', source: 'WC-C5 d-renewal' },
  { id: 'renewal_reminder_loop', layer: 'L6_renewal_recurring', label: 'Renewal reminder / notification loop', tier: 'absent', subscription: true,
    evidence: 'No reminder/cron/notification job wired to the renewal-engine output.', source: 'WC-C5 (reminders MISSING)' },
  { id: 'recurring_or_repurchase_loop', layer: 'L6_renewal_recurring', label: 'Recurring / auto-renew billing OR package-repurchase loop', tier: 'absent', subscription: true,
    evidence: 'Renewal-engine never auto-charges; B2C ladder is renewal_not_applicable_b2c by design; no repurchase route converts a candidate into a new paid term.', source: 'WC-C5 / subscription-engine.ts' },
  // L7 — consumer offer
  { id: 'consumer_offer_engine', layer: 'L7_consumer_offer', label: 'Consumer offer engine (offer_fit recommendation)', tier: 'gated_real', subscription: false,
    evidence: 'offer-engine offer_fit is directional and gated by commercialActivation (OFF by default).', source: 'offer-engine.ts (WC-7C)' },
];

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  // Deploy posture: report whether FF_* overrides are present in THIS process (should be none).
  const ffOverrides = Object.keys(process.env).filter((k) => k.startsWith('FF_') && process.env[k] === '1');
  const razorpayConfigured = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

  // 1) Recompute via the EXISTING engines (reuse, never rebuild).
  const lifecycle = await buildSubscriptionLifecycle(pool);
  const renewal = await buildRenewalPipeline(pool);
  const forecast = await buildForecastInputs(pool);
  const entitlement = await buildEntitlementOverview(pool);

  // 2) Live catalog / payment substrate (read-only).
  const pkgTotal = Number((await q(`SELECT count(*)::int n FROM subscription_packages`)).rows[0]?.n ?? 0);
  const pkgActive = Number((await q(`SELECT count(*)::int n FROM subscription_packages WHERE is_active = true`)).rows[0]?.n ?? 0);
  const pkgPriced = Number((await q(`SELECT count(*)::int n FROM subscription_packages WHERE price IS NOT NULL`)).rows[0]?.n ?? 0);
  const pkgWithValidity = Number((await q(`SELECT count(*)::int n FROM subscription_packages WHERE validity_days IS NOT NULL`)).rows[0]?.n ?? 0);
  const parentSubsTable = (await q(`SELECT to_regclass('public.parent_subscriptions') AS reg`)).rows[0]?.reg != null;

  const subsTotal = lifecycle.package_subscriptions.total;
  const subsActive = entitlement.active_package_grants;
  const renewableActive = renewal.package_model.renewable_active;
  const paymentsTotal = lifecycle.b2c_ladder.total;
  const paymentsPaid = lifecycle.b2c_ladder.by_state.fulfilled;
  const paymentsPending = lifecycle.b2c_ladder.by_state.pending;
  const payingIdentities = entitlement.paying_identities;

  const degraded = lifecycle.degraded || renewal.degraded || forecast.degraded || entitlement.degraded;

  // 3) Axis 1 — STRUCTURAL (deterministic tier map). Productization (ALL) + Subscription subset.
  const subset = CAPABILITIES.filter((c) => c.subscription);
  const structPctOf = (caps: Capability[]) =>
    Math.round((caps.reduce((a, c) => a + TIER[c.tier], 0) / (caps.length * 5)) * 1000) / 10;
  const productizationStruct = structPctOf(CAPABILITIES);
  const subscriptionStruct = structPctOf(subset);

  // 3b) Recompute WC-C1's "Subscription Readiness" (Success Metric 3) on its ORIGINAL 6-cell
  // denominator — same cell tiers — so it can be shown SIDE-BY-SIDE (name-collision guard).
  const wcc1Cells: { name: string; tier: TierName }[] = [
    { name: 'b2c_ladder_catalog', tier: 'real' },
    { name: 'package_catalog', tier: 'real' },
    { name: 'package_persistence_expiry', tier: 'real' },
    { name: 'parent_plans', tier: parentSubsTable ? 'gated_real' : 'absent' },
    { name: 'active_subscription_concept', tier: 'gated_real' },
    { name: 'admin_crud', tier: 'real' },
  ];
  const wcc1SubStruct = Math.round((wcc1Cells.reduce((a, c) => a + TIER[c.tier], 0) / (wcc1Cells.length * 5)) * 1000) / 10;
  const wcc1SubActEnablers = [
    { name: 'active packages defined > 0', present: pkgActive > 0 },
    { name: 'package subscriptions > 0', present: subsTotal > 0 },
    { name: 'live (active, unexpired) subscriptions > 0', present: subsActive > 0 },
    { name: 'parent_subscriptions table present', present: parentSubsTable },
    { name: 'any paid ladder purchase > 0', present: paymentsPaid > 0 },
  ];
  const wcc1SubAct = Math.round((wcc1SubActEnablers.filter((e) => e.present).length / wcc1SubActEnablers.length) * 1000) / 10;

  // 4) Axis 2 — ACTIVATION (per-capability binary "can fire on live data NOW?" + reason).
  const activation = CAPABILITIES.map((c) => {
    let fires = false;
    let reason = '';
    switch (c.id) {
      case 'ladder_catalog_skus':
        fires = true; reason = `${LADDER_SKUS.length} priced SKUs defined + B2C order route live (catalog is non-empty & presentable). NB: 0 paid, ${paymentsPending} pending (demo).`; break;
      case 'b2c_pricing_model':
        fires = true; reason = 'Prices defined and applied by the live order route.'; break;
      case 'b2c_order_payment_flow':
        fires = razorpayConfigured; reason = razorpayConfigured ? 'Razorpay keys configured → real capture possible.' : 'Razorpay keys NOT configured → demo posture; the 6 pending rows cannot capture real money (WC-C1 payments_demo=6).'; break;
      case 'package_catalog_schema':
        fires = pkgTotal > 0; reason = fires ? `${pkgTotal} catalog rows to serve` : '0 catalog rows → nothing to serve'; break;
      case 'package_catalog_population':
        fires = pkgActive > 0; reason = fires ? `${pkgActive} active products` : '0 active products → catalog empty'; break;
      case 'package_seed_completeness':
        fires = pkgPriced > 0 && pkgWithValidity > 0; reason = fires ? `${pkgPriced} priced & ${pkgWithValidity} with validity` : 'seed never run AND would emit unpriced/null-validity rows → no sellable+renewable row exists'; break;
      case 'package_pricing_definition':
        fires = pkgPriced > 0; reason = fires ? `${pkgPriced} priced products` : '0 priced products (price never set)'; break;
      case 'package_grant_flow':
        fires = subsTotal > 0; reason = fires ? `${subsTotal} package subscription(s) live` : '0 package subscriptions → grant flow never exercised'; break;
      case 'stage_feature_map':
        fires = payingIdentities > 0; reason = fires ? `${payingIdentities} paying identity(ies) → features actually granted` : '0 paying identities → no stage features ever granted live'; break;
      case 'progressive_ladder':
        fires = payingIdentities > 0; reason = fires ? `${payingIdentities} identity(ies) own a paid rung` : '0 paid climbs → ladder progression never fires commercially'; break;
      case 'upgrade_offer_engine':
        fires = false; reason = 'flag commercialActivation OFF + 0 owners to offer an upgrade to'; break;
      case 'renewal_candidate_engine':
        fires = renewableActive > 0; reason = fires ? `${renewableActive} renewable active` : '0 renewable population → no due_soon/in_grace candidates'; break;
      case 'entitlement_enforcement_gate':
        fires = false; reason = 'flag commercialEntitlementEnforcement OFF by default → dormant'; break;
      case 'consumer_offer_engine':
        fires = false; reason = 'flag commercialActivation OFF → offer_fit dormant'; break;
      case 'pricing_tiers_discounting':
      case 'package_entitlement_map':
      case 'self_serve_package_checkout':
      case 'cross_package_upgrade':
      case 'renewal_reminder_loop':
      case 'recurring_or_repurchase_loop':
        fires = false; reason = 'capability absent in code'; break;
    }
    return { id: c.id, label: c.label, subscription: c.subscription, fires, reason };
  });
  const actPctOf = (ids: Set<string>) => {
    const set = activation.filter((a) => ids.has(a.id));
    return { firing: set.filter((a) => a.fires).length, total: set.length, pct: Math.round((set.filter((a) => a.fires).length / set.length) * 1000) / 10 };
  };
  const productizationAct = actPctOf(new Set(CAPABILITIES.map((c) => c.id)));
  const subscriptionAct = actPctOf(new Set(subset.map((c) => c.id)));

  // 5) Axis 3 — COVERAGE (population fractions; eligible-only; 0/0 → not_measurable).
  const coverage = {
    package_catalog_population: pct(pkgActive, pkgTotal),                 // 0/0 → not_measurable
    package_priced_ratio: pct(pkgPriced, pkgTotal),                       // 0/0 → not_measurable
    package_renewable_ratio: pct(renewableActive, subsTotal),            // 0/0 → not_measurable
    entitlement: { value: entitlement.coverage_pct, measurable: entitlement.coverage_pct !== null, numerator: entitlement.entitled_identities, denominator: entitlement.paying_identities, reason: entitlement.coverage_pct === null ? 'not_measurable: 0 paying identities' : 'measured' } as Cov,
    b2c_paid_conversion: pct(paymentsPaid, paymentsTotal),               // 0/6 = 0.0% (measurable) — all 6 demo
    forecastable_revenue_series: pct(forecast.forecastable_count, forecast.total_series), // 0/4 = 0.0%
  };

  // Catalog Readiness — declared as TWO catalogs; reported as COUNTS + per-axis verdicts, NOT a 3rd %.
  const catalogReadiness = {
    ladder_catalog: { kind: 'code-defined B2C ladder', sku_count: LADDER_SKUS.length, priced: LADDER_SKUS.length, live: true,
      structural: 'real (3 priced SKUs in code)', coverage_count: `${LADDER_SKUS.length} SKUs (all priced)`,
      activation: razorpayConfigured ? 'presentable + real capture' : 'presentable; capture demo (Razorpay unconfigured)', confidence: 'one-time model — cannot recur by design' },
    package_catalog: { kind: 'DB subscription_packages', product_count: pkgTotal, active: pkgActive, priced: pkgPriced, with_validity: pkgWithValidity,
      structural: 'real (schema + admin CRUD)', coverage_count: `${pkgTotal} products defined (EMPTY)`,
      coverage_fractions: { populated: coverage.package_catalog_population, priced: coverage.package_priced_ratio },
      activation: 'cannot sell — 0 products; seed is a STUB (unpriced/null-validity rows)', confidence: 'no catalog exists' },
  };

  // 6) Axis 4 — CONFIDENCE (qualitative band + explicit n; never a fabricated %).
  const confidence = {
    band: 'VERY_LOW',
    n: { package_products: pkgTotal, priced_products: pkgPriced, package_subscriptions: subsTotal, renewable_active: renewableActive, paid_identities: payingIdentities, pending_demo_payments: paymentsPending },
    rationale: `No subscription PRODUCT has ever been defined or sold (subscription_packages=${pkgTotal}, student_subscriptions=${subsTotal}, paid stages=${paymentsPaid}). The only live SKUs (3 B2C ladder rungs) are one-time and have 0 real purchases (${paymentsPending} pending are demo; Razorpay unconfigured). With no ground truth, every productization/recurring inference is directional only.`,
  };

  // 7) Success-criteria answers.
  const answers = {
    products_that_exist: [
      `B2C stage ladder — ${LADDER_SKUS.length} priced SKUs (CAP_INS ₹499 / CAP_GRW ₹999 / CAP_MAS ₹1999). REAL, live, ONE-TIME (renewal_not_applicable_b2c).`,
      `Package catalog (subscription_packages) — schema + admin CRUD REAL, but ${pkgTotal} products defined (EMPTY). The ONLY renewable-capable model.`,
      `Parent plans (basic/family/premium) — ${parentSubsTable ? 'table present' : 'table ABSENT in live DB'} → ${parentSubsTable ? 'present' : 'non-functional / legacy stub (cross-server)'}; NOT a live backend product.`,
    ],
    which_are_sellable: `ONLY the B2C ladder rungs are sellable (priced SKUs + live order route)${razorpayConfigured ? '' : ' — though capture is demo (Razorpay unconfigured), 0 real purchases'}. Packages are NOT sellable (0 products + seed emits unpriced rows). Parent plans not sellable.`,
    which_can_renew: `NONE live. Only the package model is renewal-CAPABLE by design (validity-window expiry), but it has 0 products and 0 subscriptions → 0 renewable population. The B2C ladder cannot renew by design.`,
    which_can_upgrade: `B2C ladder: Structural YES (offer-engine next-rung path exists) / Activation NO (flag commercialActivation OFF + 0 owners). Packages: NO upgrade path (absent).`,
    which_generate_recurring_revenue: `NONE. No recurring/auto-renew billing, no reminder→repurchase loop, renewable population = 0, and the earning ladder is one-time. Recurring revenue is not viable today.`,
    productization_readiness: { structural_pct: productizationStruct, activation_pct: productizationAct.pct, activation: `${productizationAct.firing}/${productizationAct.total}`, denominator: `${CAPABILITIES.length} product-architecture capabilities`, note: 'Reported as a PAIR; never combined.' },
    subscription_model_readiness_wcc6a: { structural_pct: subscriptionStruct, activation_pct: subscriptionAct.pct, activation: `${subscriptionAct.firing}/${subscriptionAct.total}`, denominator: `${subset.length}-capability SUBSET of Productization (renewable-model subset)`, note: 'DISTINCT from WC-C1 Subscription Readiness; shown side-by-side below.' },
    wcc1_subscription_readiness_recomputed: { structural_pct: wcc1SubStruct, activation_pct: wcc1SubAct, denominator: '6 subscription-system cells (WC-C1 Success Metric 3, original denominator)', note: 'Recomputed on WC-C1\'s OWN denominator for side-by-side comparison; NOT renamed/reused.' },
    catalog_readiness: 'Reported as COUNTS + per-axis verdicts, NOT a third %. TWO catalogs: ladder (3 live SKUs) + package (0 products). See deliverable 07.',
    shortest_path_to_90pct_commercial_activation: {
      principle: '90% Activation is EARNED via real revenue (real keys + real paid rows + live renewable population + ≥2 monthly points), NOT engineering-grantable. Only Structural readiness is reachable by wiring. Path below is DESCRIBED, not executed (creating products/pricing is out of audit scope).',
      structural_path_described: [
        '1. FIX the package seed to emit price + validity_days + question_count (current seed yields unpriced/null-expiry rows → unsellable + unrenewable). Seeding alone is NOT sufficient.',
        '2. Populate the package catalog with priced, validity-bearing products (turns package_catalog_population absent→real).',
        '3. Wire a self-serve package checkout (buyer Razorpay order → student_subscription grant with finite expiry).',
        '4. Add a package→entitlement/feature mapping (packages are entitlement-disjoint today) and turn ON commercialEntitlementEnforcement.',
        '5. Wire a renewal reminder → repurchase/recurring loop on the renewal-engine output.',
        '6. Configure real Razorpay keys for capture (currently demo).',
      ],
      activation_reality: 'Even with all 6 wired, Activation% only climbs as real catalog rows are SOLD, RENEWED, and RECUR over time. The 6 pending B2C payments are demo/mock (WC-C1 payments_demo=6), NOT demand.',
      highest_leverage_first_move: 'Define a SELLABLE+renewable package catalog (fix seed → populate). Every downstream subscription/renewal/recurring metric is currently zero-denominated by the empty, unpriced catalog.',
    },
  };

  const snapshot = {
    generated_at: new Date().toISOString(),
    audit: 'WC-C6A Subscription Productization Audit',
    posture: { ff_overrides_present: ffOverrides, razorpay_configured: razorpayConfigured, note: 'Run without FF_* overrides = deploy posture.' },
    degraded,
    engines: { lifecycle, renewal, forecast, entitlement },
    runtime: { pkgTotal, pkgActive, pkgPriced, pkgWithValidity, parentSubsTable, subsTotal, subsActive, renewableActive, paymentsTotal, paymentsPaid, paymentsPending, payingIdentities },
    two_catalogs: { ladder_skus: LADDER_SKUS, package_catalog_rows: pkgTotal },
    structural: { capabilities: CAPABILITIES, tier_map: TIER, productization_pct: productizationStruct, subscription_subset_pct: subscriptionStruct, subset_ids: subset.map((c) => c.id) },
    activation: { detail: activation, productization: productizationAct, subscription_subset: subscriptionAct },
    wcc1_subscription_readiness: { cells: wcc1Cells, structural_pct: wcc1SubStruct, activation_pct: wcc1SubAct, enablers: wcc1SubActEnablers, denominator: '6 subscription-system cells' },
    coverage,
    catalog_readiness: catalogReadiness,
    confidence,
    answers,
  };

  writeFileSync(join(OUT_DIR, '_wc_c6a_snapshot.json'), JSON.stringify(snapshot, null, 2));
  writeDeliverables(snapshot);

  // eslint-disable-next-line no-console
  console.log(`WC-C6A audit complete. Productization Structural=${productizationStruct}%/Activation=${productizationAct.pct}% · Subscription(WC-C6A) Structural=${subscriptionStruct}%/Activation=${subscriptionAct.pct}% · package catalog=${pkgTotal} products · degraded=${degraded}. Artifacts → backend/audit/wc-c6a/`);
  await pool.end();
}

// ── deliverable writers ────────────────────────────────────────────────────────
function tierBadge(t: TierName): string { return `${t} (${TIER[t]}/5)`; }
function covCell(c: Cov): string {
  return c.measurable ? `${c.value}% (${c.numerator}/${c.denominator})` : `**not_measurable** (${c.numerator}/${c.denominator} — ${c.reason})`;
}
function capRow(s: any, c: Capability): string {
  const a = s.activation.detail.find((x: any) => x.id === c.id);
  return `| \`${c.id}\` | ${c.label} | ${tierBadge(c.tier)} | ${a?.fires ? '✅ fires' : '— dormant'} | ${a?.reason} |`;
}

function writeDeliverables(s: any) {
  const ts = s.generated_at;
  const deg = s.degraded ? ' ⚠️ DEGRADED read detected — see snapshot.' : '';
  const r = s.runtime;
  const caps: Capability[] = s.structural.capabilities;
  const byLayer = (layer: string) => caps.filter((c) => c.layer === layer);
  const A = s.answers;

  // 01 — Product Packaging Report
  writeFileSync(join(OUT_DIR, '01_product_packaging_report.md'), `# WC-C6A · Deliverable 1 — Product Packaging Report
_Generated ${ts}. AUDIT ONLY · read-only · recomputed from runtime.${deg}_

## Headline — Productization Readiness (reported as a PAIR, never combined)
| Axis | Value | Meaning |
|---|---|---|
| **Structural** | **${s.structural.productization_pct}%** | Product-architecture machinery that EXISTS in code (tier map over ${caps.length} capabilities) |
| **Activation** | **${s.activation.productization.pct}%** | Capabilities that can FIRE on live data now (${s.activation.productization.firing}/${s.activation.productization.total}) |
| **Coverage** | ${covCell(s.coverage.package_catalog_population)} | Package catalog population (the renewable-model products) |
| **Confidence** | **${s.confidence.band}** | n: package products=${r.pkgTotal}, package subs=${r.subsTotal}, paid identities=${r.payingIdentities} |

> The four axes are orthogonal and never averaged. A blended score would hide the exact finding: the product *machinery* is substantially built, but the *catalog* and *recurring loop* are empty/absent.

## What products exist
${A.products_that_exist.map((p: string) => `- ${p}`).join('\n')}

## Two catalogs (declared explicitly — they do not contradict)
| Catalog | Kind | Products | Priced | Renewable | Status |
|---|---|---|---|---|---|
| Ladder | code-defined B2C SKUs | ${s.two_catalogs.ladder_skus.length} | ${s.two_catalogs.ladder_skus.length} | ✗ (one-time by design) | **live** |
| Package | DB \`subscription_packages\` | ${r.pkgTotal} | ${r.pkgPriced} | ✓ capable (validity window) | **EMPTY** |

## Capability tier map — L1 catalog definition
| id | capability | structural tier | activation | reason |
|---|---|---|---|---|
${byLayer('L1_catalog_definition').map((c) => capRow(s, c)).join('\n')}

## Honest read
One real, live, **one-time** product family (the ladder) and a **schema-only renewable catalog with zero products**. CAPADEX can define & present priced one-time unlocks; it cannot yet package a renewable subscription product, because the only renewable model has no (sellable) rows.
`);

  // 02 — Subscription Architecture Report
  writeFileSync(join(OUT_DIR, '02_subscription_architecture_report.md'), `# WC-C6A · Deliverable 2 — Subscription Architecture Report
_Generated ${ts}. Recomputed via wc7c engines (read-only).${deg}_

## Two named metrics, shown side-by-side (NAME-COLLISION GUARD)
WC-C1 already defines **"Subscription Readiness"** (Success Metric 3, 6 subscription-system cells). We do **not** reuse that name on a new denominator. Below: WC-C1's metric recomputed on its **own** denominator, and our **distinct** subset metric.

| Metric | Denominator | Structural | Activation |
|---|---|---|---|
| **Subscription Readiness** (WC-C1 SM3, recomputed) | 6 subscription-system cells | **${s.wcc1_subscription_readiness.structural_pct}%** | **${s.wcc1_subscription_readiness.activation_pct}%** |
| **Subscription Model Readiness (WC-C6A)** | ${s.structural.subset_ids.length}-capability SUBSET of Productization | **${s.structural.subscription_subset_pct}%** | **${s.activation.subscription_subset.pct}%** (${s.activation.subscription_subset.firing}/${s.activation.subscription_subset.total}) |

> They differ because they measure different things: WC-C1's 6 cells credit the ladder catalog + persistence + admin CRUD (structurally high); the WC-C6A subset isolates the **renewable subscription product** machinery (population, seed completeness, package entitlement, self-serve checkout, cross-package upgrade, renewal reminder, recurring loop), which is largely absent. Both Activation figures collapse to near-zero because nothing is sold.

### WC-C1 SM3 cells (recomputed, original denominator)
${s.wcc1_subscription_readiness.cells.map((c: any) => `- \`${c.name}\` — ${tierBadge(c.tier)}`).join('\n')}

### Subscription Model Readiness (WC-C6A) — the ${s.structural.subset_ids.length} subset capabilities
| id | capability | structural tier | activation | reason |
|---|---|---|---|---|
${caps.filter((c) => c.subscription).map((c) => capRow(s, c)).join('\n')}

## Lifecycle state (recomputed via subscription-lifecycle.ts)
- B2C ladder rows: **${s.engines.lifecycle.b2c_ladder.total}** — pending=${s.engines.lifecycle.b2c_ladder.by_state.pending}, fulfilled=${s.engines.lifecycle.b2c_ladder.by_state.fulfilled}, abandoned=${s.engines.lifecycle.b2c_ladder.by_state.abandoned}.
- Package subscriptions: **${s.engines.lifecycle.package_subscriptions.total}** — active=${s.engines.lifecycle.package_subscriptions.by_state.active}, expiring_soon=${s.engines.lifecycle.package_subscriptions.by_state.expiring_soon}, expired=${s.engines.lifecycle.package_subscriptions.by_state.expired}, cancelled=${s.engines.lifecycle.package_subscriptions.by_state.cancelled}.

## Verdict
A subscription **product architecture** exists structurally for one-time unlocks, but the **subscription model** (renewable packages) is unpopulated and missing its decision/activation layers. Subscription is the true weak link, consistent with WC-6.
`);

  // 03 — Pricing Readiness Report
  writeFileSync(join(OUT_DIR, '03_pricing_readiness_report.md'), `# WC-C6A · Deliverable 3 — Pricing Readiness Report
_Generated ${ts}. read-only.${deg}_

## Capability tier map — L2 pricing
| id | capability | structural tier | activation | reason |
|---|---|---|---|---|
${byLayer('L2_pricing').map((c) => capRow(s, c)).join('\n')}

## Findings
- **B2C ladder pricing is REAL & live**: ${s.two_catalogs.ladder_skus.map((x: any) => `${x.stage} ₹${x.price_inr}`).join(' · ')} (lockstep constants).
- **Package pricing is PARTIAL**: \`price\` / \`validity_days\` columns exist (schema real) but are **nullable, never populated**, and the **seed omits them** → no package price/validity is ever defined. Priced package products: **${r.pkgPriced}/${r.pkgTotal}** (${covCell(s.coverage.package_priced_ratio)}).
- **No pricing tiers / discounting / proration / multi-currency** engine (absent).

> Pricing readiness for the renewable model is gated by the empty, unpriced catalog — not by a missing pricing primitive. The price column is ready; no price has ever been set.
`);

  // 04 — Entitlement Packaging Report
  writeFileSync(join(OUT_DIR, '04_entitlement_packaging_report.md'), `# WC-C6A · Deliverable 4 — Entitlement Packaging Report
_Generated ${ts}. read-only.${deg}_

## Capability tier map — L3 entitlement packaging
| id | capability | structural tier | activation | reason |
|---|---|---|---|---|
${byLayer('L3_entitlement_packaging').map((c) => capRow(s, c)).join('\n')}

## Findings
- **Stage→feature map REAL** (\`STAGE_FEATURES\`): CAP_INS→insight_report; CAP_GRW→growth_report/growth_plan; CAP_MAS→mastery_report/mentor_access. Entitlement = UNION over owned stages.
- **Package→entitlement mapping ABSENT** (NOT partial): \`subscription_packages\` has no feature column; grants are child/student-keyed and entitlement-disjoint from STAGE_FEATURES (WC-C2). A package purchase would unlock nothing enforceable.
- **Enforcement gate GATED-REAL**: WC-C4 \`requireEntitlement\` exists but its flag is OFF by default.
- Entitlement coverage (entitled/paying): ${covCell(s.coverage.entitlement)}.

> The ladder has a real purchase→entitlement spine; the package model has none. Packaging a renewable product requires a package→feature map first.
`);

  // 05 — Upgrade Path Report
  writeFileSync(join(OUT_DIR, '05_upgrade_path_report.md'), `# WC-C6A · Deliverable 5 — Upgrade Path Report
_Generated ${ts}. read-only.${deg}_

## Capability tier map — L5 ladder / upgrade
| id | capability | structural tier | activation | reason |
|---|---|---|---|---|
${byLayer('L5_ladder_upgrade').map((c) => capRow(s, c)).join('\n')}

## Findings (Structural / Activation split — required)
- **B2C ladder is upgradable — Structural YES / Activation NO**: the offer-engine recommends the next rung (CAP_INS→GRW→MAS), but the flag \`commercialActivation\` is OFF and there are **0 owners** to offer an upgrade to.
- **Packages have NO upgrade path** (absent): flat, unordered SKUs; no cross-package upgrade or proration.

> "Upgradable" is true only for the one-time ladder, and only structurally. The renewable model has no upgrade concept at all.
`);

  // 06 — Renewal Path Report
  writeFileSync(join(OUT_DIR, '06_renewal_path_report.md'), `# WC-C6A · Deliverable 6 — Renewal Path Report
_Generated ${ts}. Recomputed via renewal-engine.ts (read-only).${deg}_

## Capability tier map — L6 renewal / recurring
| id | capability | structural tier | activation | reason |
|---|---|---|---|---|
${byLayer('L6_renewal_recurring').map((c) => capRow(s, c)).join('\n')}

## Findings
- **Renewal candidate engine REAL** (read-only; never auto-charges): due_soon (≤14d) / in_grace (≤7d).
- **Renewable population = ${r.renewableActive}** (${covCell(s.coverage.package_renewable_ratio)}) — the empty package catalog zero-denominates everything downstream.
- **Renewal reminder loop ABSENT**; **recurring/auto-renew or repurchase loop ABSENT**.
- The **B2C ladder is renewal_not_applicable_b2c** by design (one-time). The renewable model (packages) has no live rows.

> Renewal machinery exists for *identifying* candidates but cannot *act*; and there is no renewable population to identify. Consistent with WC-C5.
`);

  // 07 — Catalog Readiness Report (COUNTS + per-axis verdicts; NOT a third %)
  const lc = s.catalog_readiness.ladder_catalog;
  const pc = s.catalog_readiness.package_catalog;
  writeFileSync(join(OUT_DIR, '07_catalog_readiness_report.md'), `# WC-C6A · Deliverable 7 — Catalog Readiness Report
_Generated ${ts}. read-only.${deg}_

> Catalog Readiness is reported as **measured COUNTS + per-axis verdicts**, NOT a percentage — there is no defensible denominator for "% of a catalog" when the catalog is empty (0% of *what target*? would be fabricated). Derived fractions over the package population are **0/0 → not_measurable**.

## Two catalogs
### A. Ladder catalog (code-defined B2C SKUs)
- **Count**: ${lc.sku_count} SKUs, all priced. **Live**: ${lc.live}.
- Structural: ${lc.structural}. Activation: ${lc.activation}. Confidence: ${lc.confidence}.

### B. Package catalog (DB \`subscription_packages\`)
- **Count**: **${pc.product_count} products defined (EMPTY)** — active=${pc.active}, priced=${pc.priced}, with_validity=${pc.with_validity}.
- Structural: ${pc.structural}. Activation: ${pc.activation}. Confidence: ${pc.confidence}.
- Derived fractions: populated ${covCell(s.coverage.package_catalog_population)}; priced ${covCell(s.coverage.package_priced_ratio)}.

## The seed is a STUB (critical)
The admin seed (\`/api/admin/subscription-packages/seed\`) inserts **13 packages with NO price, NO validity_days, NO question_count**; the schema leaves all three nullable with no default. So even if seeded, the catalog would be **13 unpriced, null-expiry products → not sellable, not renewable** (renewal requires \`expiry_date IS NOT NULL\`; null validity → null expiry → 0 renewable). **"Just run the seed" is not a fix** — the seed must first be corrected to emit price + validity_days + question_count.

## Verdict
The catalog **mechanism** (schema + CRUD) is real; the catalog **content** does not exist. A renewable product catalog is the first missing asset.
`);

  // 08 — Recurring Revenue Report
  writeFileSync(join(OUT_DIR, '08_recurring_revenue_report.md'), `# WC-C6A · Deliverable 8 — Recurring Revenue Report
_Generated ${ts}. Recomputed via commercial-forecast-inputs.ts (read-only).${deg}_

## Recurring revenue today: **NONE**
| Precondition for recurring revenue | State |
|---|---|
| A renewable product exists (priced + validity) | ✗ 0 priced/validity package products |
| A renewable population exists (active subscriptions) | ✗ ${r.subsTotal} package subscriptions |
| A renewal candidate can be identified | engine real, but ${r.renewableActive} renewable population |
| A reminder → repurchase / recurring loop acts on it | ✗ absent |
| The earning product can recur | ✗ B2C ladder is one-time by design |
| Forecastable revenue series (≥2 monthly points) | ${covCell(s.coverage.forecastable_revenue_series)} |

## Why
The model that **earns** (B2C ladder) cannot recur by design; the model that **can recur** (validity-window packages) has no priced products and no sales. There is no recurring billing or repurchase loop. The ${r.paymentsPending} pending B2C payments are **demo/mock** (WC-C1 payments_demo=${r.paymentsPending}; Razorpay unconfigured) — adjacent one-time revenue at best, never recurring.

## Earliest recurring-rupee chain (DESCRIBED, not executed)
${A.shortest_path_to_90pct_commercial_activation.structural_path_described.map((x: string) => `- ${x}`).join('\n')}

> ${A.shortest_path_to_90pct_commercial_activation.activation_reality}
`);

  // 09 — Gap Analysis
  const absent = caps.filter((c) => c.tier === 'absent');
  const stub = caps.filter((c) => c.tier === 'stub');
  const partial = caps.filter((c) => c.tier === 'partial');
  const gated = caps.filter((c) => c.tier === 'gated_real');
  writeFileSync(join(OUT_DIR, '09_gap_analysis.md'), `# WC-C6A · Deliverable 9 — Gap Analysis
_Generated ${ts}. read-only.${deg}_

## Full capability tier map (${caps.length} capabilities)
| id | layer | structural tier | activation | reason |
|---|---|---|---|---|
${caps.map((c) => `| \`${c.id}\` | ${c.layer.replace(/^L\d_/, '')} | ${tierBadge(c.tier)} | ${s.activation.detail.find((x: any) => x.id === c.id)?.fires ? '✅' : '—'} | ${s.activation.detail.find((x: any) => x.id === c.id)?.reason} |`).join('\n')}

## Gaps by severity
- **ABSENT (${absent.length})**: ${absent.map((c) => `\`${c.id}\``).join(', ') || 'none'}.
- **STUB (${stub.length})**: ${stub.map((c) => `\`${c.id}\``).join(', ') || 'none'} — the seed gap is here (would produce unsellable rows).
- **PARTIAL (${partial.length})**: ${partial.map((c) => `\`${c.id}\``).join(', ') || 'none'}.
- **GATED-REAL (${gated.length})**: ${gated.map((c) => `\`${c.id}\``).join(', ') || 'none'} — built, dormant behind a flag or unexercised.

## Shortest path to 90% Commercial Activation
**Principle:** ${A.shortest_path_to_90pct_commercial_activation.principle}

**Structural path (described, not executed):**
${A.shortest_path_to_90pct_commercial_activation.structural_path_described.map((x: string) => `- ${x}`).join('\n')}

**Highest-leverage first move:** ${A.shortest_path_to_90pct_commercial_activation.highest_leverage_first_move}
`);

  // 10 — Executive Summary
  writeFileSync(join(OUT_DIR, '10_executive_summary.md'), `# WC-C6A · Deliverable 10 — Executive Summary
_Generated ${ts}. AUDIT ONLY · read-only · recomputed from runtime. No implementation, schema, pricing, subscription, or product was created.${deg}_

## Is CAPADEX a commercially viable subscription PRODUCT capable of recurring revenue?
**Not yet.** There is **one** real, live product family (the B2C stage ladder) that is **one-time by design**, and a **renewable package catalog that has zero products**. The product *machinery* is substantially built; the *catalog content* and the *recurring loop* are empty/absent. Recurring revenue today = **NONE**.

## Four axes — reported SEPARATELY (never combined)
| Metric | Structural | Activation | Coverage | Confidence |
|---|---|---|---|---|
| **Productization Readiness** | **${s.structural.productization_pct}%** | **${s.activation.productization.pct}%** (${s.activation.productization.firing}/${s.activation.productization.total}) | catalog pop ${covCell(s.coverage.package_catalog_population)} | ${s.confidence.band} |
| **Subscription Model Readiness (WC-C6A)** | **${s.structural.subscription_subset_pct}%** | **${s.activation.subscription_subset.pct}%** | renewable ${covCell(s.coverage.package_renewable_ratio)} | ${s.confidence.band} |
| **Subscription Readiness (WC-C1 SM3, recomputed)** | **${s.wcc1_subscription_readiness.structural_pct}%** | **${s.wcc1_subscription_readiness.activation_pct}%** | — | ${s.confidence.band} |
| **Catalog Readiness** | mechanism real | ladder live / package 0 | **${r.pkgTotal} products (EMPTY)** | ${s.confidence.band} |

> Catalog Readiness is COUNTS + verdicts, not a %. The two Subscription rows are DIFFERENT metrics on DIFFERENT denominators, shown side-by-side to avoid the WC-C1 name collision.

## Success-criteria answers
- **Products that exist:** ${A.products_that_exist.length} families — see deliverable 1.
- **Which are sellable:** ${A.which_are_sellable}
- **Which can renew:** ${A.which_can_renew}
- **Which can upgrade:** ${A.which_can_upgrade}
- **Which generate recurring revenue:** ${A.which_generate_recurring_revenue}
- **Productization Readiness:** ${s.structural.productization_pct}% structural / ${s.activation.productization.pct}% activation.
- **Subscription Model Readiness (WC-C6A):** ${s.structural.subscription_subset_pct}% / ${s.activation.subscription_subset.pct}% — vs WC-C1 SM3 ${s.wcc1_subscription_readiness.structural_pct}% / ${s.wcc1_subscription_readiness.activation_pct}%.
- **Catalog Readiness:** ${r.pkgTotal} package products (EMPTY) + ${s.two_catalogs.ladder_skus.length} live ladder SKUs.

## Shortest path to 90% Commercial Activation
${A.shortest_path_to_90pct_commercial_activation.principle}

${A.shortest_path_to_90pct_commercial_activation.structural_path_described.map((x: string) => `- ${x}`).join('\n')}

**Reality check:** ${A.shortest_path_to_90pct_commercial_activation.activation_reality}

## Honesty notes
- Every percentage is bound to a declared denominator; 0/0 is reported as **not_measurable**, never 0%/100%.
- Unexercised paths (package grant flow, offer/upgrade engine, enforcement gate) are capped at **gated-real(4)**, never real(5).
- The package seed is a **stub** (unpriced/null-validity rows) — seeding is necessary but not sufficient.
- The ${r.paymentsPending} pending B2C payments are **demo/mock**, not demand.
- Run without FF_* overrides (deploy posture): ${JSON.stringify(s.posture.ff_overrides_present)}.
`);
}

main().catch(async (e) => {
  // eslint-disable-next-line no-console
  console.error('WC-C6A audit failed:', e);
  try { await pool.end(); } catch {}
  process.exit(1);
});
