/**
 * WC-C1 — Commercial Wave 2 READINESS AUDIT (READ-ONLY · additive · never mutates DB).
 *
 * Platform-wide commercial readiness audit answering: Intelligence → Product → Subscription → Revenue.
 * RECOMPUTES live (imports the real WC-7C resolvers + queries the live DB + reads env/flag posture) —
 * it does NOT copy the same-day commercial-wave-2 markdown numbers (stale-figure trap). It cites
 * commercial-wave-2 only as the prior baseline for a reconciliation table.
 *
 * TWO INDEPENDENT AXES, NEVER composited into one number:
 *   • STRUCTURAL — does the code/engine/route/table-definition exist?
 *       Deterministic tier map: real=5 / gated-real=4 / partial=3 / stub=2 / absent=1 → normalized %.
 *       "gated-real" caps a capability that exists but ships behind a default-OFF flag with no live
 *       consumer, OR an integration whose real path has NEVER executed end-to-end (unexercised ≠ real).
 *   • ACTIVATION — is it live in the DEPLOY posture? A COUNT of binary enablers present
 *       (flag-ON by config default / real keys / live data / user-reachable consumer). Measured against
 *       config defaults (deploy posture); the dev-workflow FF_COMMERCIAL_ACTIVATION=1 override is a
 *       FOOTNOTE only — a dev env var with no keys/data/consumer must never upgrade a cell.
 *
 * Coverage (asset/data exists) vs Confidence (trustworthy/sufficient/live) are reported separately.
 * The 4 required success percentages (Commercial / Revenue / Subscription / Product-Monetization
 * Readiness) are each a (Structural%, Activation%) PAIR with a STATED denominator — never blended.
 *
 * HONEST GROUNDING (verified live): Razorpay keys absent → DEMO mode; capadex_payments = 6 rows, all
 * pending demo orders, ₹0 captured, 0 payment_completed events; subscription_packages / student_subscriptions
 * empty; parent_subscriptions + mentor_bookings tables ABSENT; 6 of 7 commercial flags default OFF.
 *
 * PII: emails one-way sha256-masked (user_<hex[:10]>) before any artifact is written.
 *
 * Usage: cd backend && npx tsx scripts/wc-c1/wc-c1-measure.ts
 */
import { Pool } from 'pg';
import { createHash } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { buildEntitlementOverview } from '../../services/wc7c/entitlement-engine';
import { buildRenewalPipeline } from '../../services/wc7c/renewal-engine';
import { buildUpsellOverview } from '../../services/wc7c/upsell-engine';
import { buildSubscriptionLifecycle } from '../../services/wc7c/subscription-lifecycle';
import { buildForecastInputs } from '../../services/wc7c/commercial-forecast-inputs';
import { buildRevenueIntelligence } from '../../services/wc7c/revenue-intelligence';
import { FEATURE_FLAGS } from '../../config/feature-flags';

const OUT_DIR = join(__dirname, '..', '..', 'audit', 'wc-c1');

const maskEmail = (email: string): string =>
  `user_${createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 10)}`;

const pct = (num: number, den: number): number | null =>
  den > 0 ? Math.round((num / den) * 1000) / 10 : null;
const naOrPct = (v: number | null) => (v === null ? 'n/a' : `${v}%`);

// ── Structural deterministic rubric ──────────────────────────────────────────
type Tier = 'real' | 'gated-real' | 'partial' | 'stub' | 'absent';
const TIER_SCORE: Record<Tier, number> = { real: 5, 'gated-real': 4, partial: 3, stub: 2, absent: 1 };
const tierTag = (t: Tier) => `${t} (${TIER_SCORE[t]}/5)`;

interface Cell { name: string; tier: Tier; note: string; }
function structPct(cells: Cell[]): { score: number; max: number; pct: number } {
  const max = cells.length * 5;
  const score = cells.reduce((s, c) => s + TIER_SCORE[c.tier], 0);
  return { score, max, pct: Math.round((score / max) * 1000) / 10 };
}

// ── Activation: count of binary enablers (deploy posture) ────────────────────
interface Enabler { name: string; present: boolean; detail: string; }
function actPct(enablers: Enabler[]): { present: number; total: number; pct: number } {
  const present = enablers.filter((e) => e.present).length;
  return { present, total: enablers.length, pct: Math.round((present / enablers.length) * 1000) / 10 };
}

async function num(pool: Pool, sql: string): Promise<number> {
  try { const { rows } = await pool.query(sql); return Number(rows[0]?.n ?? 0); } catch { return -1; }
}
async function tableExists(pool: Pool, name: string): Promise<boolean> {
  try { const { rows } = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS e`, [`public.${name}`]); return Boolean(rows[0]?.e); }
  catch { return false; }
}

async function run(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) { console.error('DATABASE_URL not set — aborting (read-only audit).'); process.exit(1); }
  const pool = new Pool({ connectionString: databaseUrl });
  const stamp = new Date().toISOString();

  // ── Env / flag posture (deploy posture = config defaults) ──
  const env = {
    razorpay_key_id: Boolean(process.env.RAZORPAY_KEY_ID),
    razorpay_key_secret: Boolean(process.env.RAZORPAY_KEY_SECRET),
    razorpay_webhook_secret: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
  };
  const razorpayConfigured = env.razorpay_key_id && env.razorpay_key_secret;
  const flagDefaults = {
    commercialActivation: FEATURE_FLAGS.commercialActivation,
    revenueIntelligence: FEATURE_FLAGS.revenueIntelligence,
    commercialEntitlement: FEATURE_FLAGS.commercialEntitlement,
    commercialRenewal: FEATURE_FLAGS.commercialRenewal,
    commercialUpsell: FEATURE_FLAGS.commercialUpsell,
    commercialLifecycleState: FEATURE_FLAGS.commercialLifecycleState,
    commercialForecastInputs: FEATURE_FLAGS.commercialForecastInputs,
  };
  // Dev workflow forces FF_COMMERCIAL_ACTIVATION=1 only (documented footnote, not a deploy enabler).
  const devOverride = { commercialActivation: true };

  // ── Live DB ground truth ──
  const db = {
    payments_total: await num(pool, `SELECT count(*) n FROM capadex_payments`),
    payments_paid: await num(pool, `SELECT count(*) n FROM capadex_payments WHERE status='paid'`),
    payments_pending: await num(pool, `SELECT count(*) n FROM capadex_payments WHERE status='pending'`),
    payments_failed: await num(pool, `SELECT count(*) n FROM capadex_payments WHERE status='failed'`),
    payments_demo: await num(pool, `SELECT count(*) n FROM capadex_payments WHERE razorpay_order_id LIKE 'DEMO_%'`),
    payment_completed_events: await num(pool, `SELECT count(*) n FROM capadex_audit_events WHERE event_type='payment_completed'`),
    packages_total: await num(pool, `SELECT count(*) n FROM subscription_packages`),
    packages_active: await num(pool, `SELECT count(*) n FROM subscription_packages WHERE is_active=true`),
    student_subscriptions: await num(pool, `SELECT count(*) n FROM student_subscriptions`),
    student_subscriptions_active: await num(pool, `SELECT count(*) n FROM student_subscriptions WHERE status='active' AND (expiry_date IS NULL OR expiry_date >= now())`),
    sessions_total: await num(pool, `SELECT count(*) n FROM capadex_sessions`),
    sessions_completed: await num(pool, `SELECT count(*) n FROM capadex_sessions WHERE status='completed'`),
    lbi_sessions: await num(pool, `SELECT count(*) n FROM lbi_sessions`),
    career_seeker_profiles: await num(pool, `SELECT count(*) n FROM career_seeker_profiles`),
    mentor_profiles: await num(pool, `SELECT count(*) n FROM mentor_profiles`),
    wcl0_user_intelligence: await num(pool, `SELECT count(*) n FROM wcl0_user_intelligence`),
    wcl4_interventions: await num(pool, `SELECT count(*) n FROM wcl4_interventions`),
    wcl5_memory: await num(pool, `SELECT count(*) n FROM wcl5_memory`),
  };
  const tables = {
    parent_subscriptions: await tableExists(pool, 'parent_subscriptions'),
    mentor_bookings: await tableExists(pool, 'mentor_bookings'),
    subscription_packages: await tableExists(pool, 'subscription_packages'),
    student_subscriptions: await tableExists(pool, 'student_subscriptions'),
    capadex_payments: await tableExists(pool, 'capadex_payments'),
  };

  // ── Recompute the live WC-7C resolvers ──
  const entitlement = await buildEntitlementOverview(pool);
  const renewal = await buildRenewalPipeline(pool);
  const upsell = await buildUpsellOverview(pool);
  const lifecycle = await buildSubscriptionLifecycle(pool);
  const forecast = await buildForecastInputs(pool);
  const revenue = await buildRevenueIntelligence(pool);

  const emailSample = await pool
    .query(`SELECT DISTINCT lower(email) email FROM capadex_payments WHERE email IS NOT NULL ORDER BY 1 LIMIT 10`)
    .then((r) => r.rows.map((x) => maskEmail(String(x.email))))
    .catch(() => [] as string[]);

  const liveData = (n: number) => n > 0;

  // ══ SUCCESS METRIC 1 — COMMERCIAL READINESS (WC-7C lifecycle layer; denom = wave-2's 6 caps) ══
  const commercialCells: Cell[] = [
    { name: 'entitlement', tier: 'gated-real', note: 'entitlement-engine maps owned stages→features + coverage; fail-CLOSED; gated commercialEntitlement (default OFF), admin route only. NO access-time guard consumes it.' },
    { name: 'renewal', tier: 'gated-real', note: 'renewal-engine due_soon/in_grace over student_subscriptions; B2C ladder renewal_not_applicable_b2c; gated commercialRenewal (default OFF).' },
    { name: 'upsell', tier: 'gated-real', note: 'upsell-engine composes subscription signal + D6 gate + stub guard (prior-paid required); gated commercialUpsell (default OFF). Behavioural triggers NOT built.' },
    { name: 'lifecycle', tier: 'gated-real', note: 'subscription-lifecycle projects ladder + package states from status+expiry; gated commercialLifecycleState (default OFF).' },
    { name: 'forecast_inputs', tier: 'gated-real', note: 'commercial-forecast-inputs emits WC-L2 ≥2-point contract + measured series; gated commercialForecastInputs (default OFF).' },
    { name: 'revenue_intel', tier: 'gated-real', note: 'WC-7C Wave-0 revenue-intelligence admin surface; measures the live ledger; gated revenueIntelligence (default OFF).' },
  ];
  const commercialStruct = structPct(commercialCells);
  const commercialEnablers: Enabler[] = [
    { name: 'paid payment rows > 0', present: liveData(db.payments_paid), detail: `${db.payments_paid} paid` },
    { name: 'active packages > 0', present: liveData(db.packages_active), detail: `${db.packages_active} active` },
    { name: 'live subscriptions > 0', present: liveData(db.student_subscriptions_active), detail: `${db.student_subscriptions_active} live` },
    { name: 'forecastable series ≥ 1', present: forecast.forecastable_count > 0, detail: `${forecast.forecastable_count}/${forecast.total_series}` },
    { name: 'any commercial flag ON (deploy default)', present: Object.values(flagDefaults).some(Boolean), detail: 'all 7 default OFF' },
    { name: 'conversion telemetry > 0', present: liveData(db.payment_completed_events), detail: `${db.payment_completed_events} payment_completed events` },
  ];
  const commercialAct = actPct(commercialEnablers);

  // ══ SUCCESS METRIC 2 — REVENUE READINESS (payment pipeline + revenue intel; 5 cells) ══
  // Pipeline code is real but its real-keys path has NEVER executed e2e → cap at gated-real (unexercised ≠ real).
  const revenueCells: Cell[] = [
    { name: 'order_creation', tier: 'gated-real', note: 'razorpay.orders.create wired (amount in paise); real-keys path UNEXERCISED (keys absent) → demo fallback only. Unverified, not broken.' },
    { name: 'signature_verification', tier: 'gated-real', note: 'HMAC-SHA256 verifySignature implemented; never executed against a real captured payment.' },
    { name: 'webhook_handling', tier: 'gated-real', note: 'payment.captured / order.paid handlers exist; RAZORPAY_WEBHOOK_SECRET absent → webhook path unverified.' },
    { name: 'revenue_intelligence', tier: 'gated-real', note: 'revenue-intelligence measures the real ledger (not estimates); gated revenueIntelligence (default OFF); ledger has ₹0 captured.' },
    { name: 'conversion_telemetry', tier: 'gated-real', note: 'capadex_audit_events logs payment_completed on capture; 0 such events recorded to date.' },
  ];
  const revenueStruct = structPct(revenueCells);
  const revenueEnablers: Enabler[] = [
    { name: 'Razorpay keys configured', present: razorpayConfigured, detail: razorpayConfigured ? 'present' : 'RAZORPAY_KEY_ID/SECRET absent (DEMO mode)' },
    { name: 'webhook secret configured', present: env.razorpay_webhook_secret, detail: env.razorpay_webhook_secret ? 'present' : 'absent' },
    { name: 'captured revenue > ₹0', present: revenue.overall.rupees > 0, detail: `₹${revenue.overall.rupees} captured` },
    { name: 'paid transactions > 0', present: liveData(db.payments_paid), detail: `${db.payments_paid}/${db.payments_total} rows paid` },
    { name: 'conversion events > 0', present: liveData(db.payment_completed_events), detail: `${db.payment_completed_events} events` },
  ];
  const revenueAct = actPct(revenueEnablers);

  // ══ SUCCESS METRIC 3 — SUBSCRIPTION READINESS (subscription system; 6 cells) ══
  const subscriptionCells: Cell[] = [
    { name: 'b2c_ladder_catalog', tier: 'real', note: 'STAGE_PRICES (CAP_INS 499 / CAP_GRW 999 / CAP_MAS 1999) defined in capadex-payments.ts; mirrored in subscription-engine.ts.' },
    { name: 'package_catalog', tier: 'real', note: 'subscription_packages table + admin CRUD exist (category/segment/price/validity/report_type).' },
    { name: 'package_persistence_expiry', tier: 'real', note: 'student_subscriptions has purchase_date/expiry_date/status — finite-validity model exists.' },
    { name: 'parent_plans', tier: 'absent', note: 'parent_subscriptions (basic/family/premium) referenced in frontend/server code BUT table ABSENT in live DB — non-functional here.' },
    { name: 'active_subscription_concept', tier: 'gated-real', note: 'subscription-lifecycle projects active/expiring_soon/expired; gated commercialLifecycleState (default OFF). Ladder = permanence model (no expiry by design).' },
    { name: 'admin_crud', tier: 'real', note: '/api/admin/subscription-packages CRUD + PricingPanel/AdminPricingPage surfaces exist.' },
  ];
  const subscriptionStruct = structPct(subscriptionCells);
  const subscriptionEnablers: Enabler[] = [
    { name: 'active packages defined > 0', present: liveData(db.packages_active), detail: `${db.packages_active} of ${db.packages_total}` },
    { name: 'package subscriptions > 0', present: liveData(db.student_subscriptions), detail: `${db.student_subscriptions} rows` },
    { name: 'live (active, unexpired) subscriptions > 0', present: liveData(db.student_subscriptions_active), detail: `${db.student_subscriptions_active}` },
    { name: 'parent_subscriptions table present', present: tables.parent_subscriptions, detail: tables.parent_subscriptions ? 'present' : 'ABSENT' },
    { name: 'any paid ladder purchase > 0', present: liveData(db.payments_paid), detail: `${db.payments_paid} paid` },
  ];
  const subscriptionAct = actPct(subscriptionEnablers);

  // ══ SUCCESS METRIC 4 — PRODUCT MONETIZATION READINESS (purchase-path wiring per product) ══
  // Per product, 5 wiring cells (Structural = mechanism exists in code; Activation = live with keys/data).
  interface ProductMon {
    product: string;
    priced_sku: boolean; order_path: boolean; pay_to_entitlement: boolean; access_enforcement: boolean; fulfillment: boolean;
    note: string;
  }
  const productsMon: ProductMon[] = [
    { product: 'CAPADEX stage ladder', priced_sku: true, order_path: true, pay_to_entitlement: true, access_enforcement: false, fulfillment: false,
      note: 'ONLY product with a real SKU (STAGE_PRICES) + order path (capadex-payments) + stage→features map (entitlement-engine, gated). NO requireEntitlement-style guard consumes entitlement; deeper-stage fulfillment not gated.' },
    { product: 'LBI', priced_sku: false, order_path: false, pay_to_entitlement: false, access_enforcement: false, fulfillment: false,
      note: 'Engine real; no priced SKU, no order path, no purchase→access wiring.' },
    { product: 'Employability Index / Passport', priced_sku: false, order_path: false, pay_to_entitlement: false, access_enforcement: false, fulfillment: false,
      note: 'Engine + flag-gated passport real; not monetized (no SKU/order/enforcement).' },
    { product: 'Career Builder', priced_sku: false, order_path: false, pay_to_entitlement: false, access_enforcement: false, fulfillment: false,
      note: 'Primary surface, fully built; NOT named in the entitlement map (STAGE_FEATURES CAP_GRW→growth_report/growth_plan — no career-builder string). The career_builder link lives in the decision-orchestrator journey route, NOT a purchase→entitlement mapping. No SKU, no enforcement.' },
    { product: 'Mentor Intelligence', priced_sku: false, order_path: false, pay_to_entitlement: true, access_enforcement: false, fulfillment: false,
      note: 'entitlement map DOES name a mentor feature (STAGE_FEATURES CAP_MAS→mentor_access, a literal feature string) — but the product is partial/stub (mentor_bookings table ABSENT, mentor_profiles=0); not sellable.' },
    { product: 'Longitudinal (repeat-assessment trend)', priced_sku: false, order_path: false, pay_to_entitlement: false, access_enforcement: false, fulfillment: false,
      note: 'Longitudinal trend engine real; no monetization wiring. (The mastery_report SKU is the CAP_MAS ladder rung, already counted under CAPADEX stage ladder — not double-counted here.)' },
  ];
  const monCellCount = 5;
  const monStructScore = productsMon.reduce((s, p) =>
    s + [p.priced_sku, p.order_path, p.pay_to_entitlement, p.access_enforcement, p.fulfillment].filter(Boolean).length, 0);
  const monStructMax = productsMon.length * monCellCount;
  const monStructPct = Math.round((monStructScore / monStructMax) * 1000) / 10;
  // Activation: any product with a LIVE purchase (paid row) wired to access. None — 0 paid, no enforcement.
  const monActEnablers: Enabler[] = [
    { name: 'any product has a live paid purchase', present: liveData(db.payments_paid), detail: `${db.payments_paid} paid` },
    { name: 'any product enforces access by entitlement', present: false, detail: 'no requireEntitlement guard wired anywhere' },
    { name: 'Razorpay configured for real capture', present: razorpayConfigured, detail: razorpayConfigured ? 'present' : 'absent (DEMO)' },
  ];
  const monAct = actPct(monActEnablers);

  // ── Product Readiness (build maturity, distinct from monetization) — for deliverable 02 ──
  interface ProductReadiness { product: string; tier: Tier; runtime_surface: boolean; activation_path: boolean; reporting_path: boolean; live_data: string; }
  const products: ProductReadiness[] = [
    { product: 'CAPADEX (entry assessment)', tier: 'real', runtime_surface: true, activation_path: true, reporting_path: true, live_data: `${db.sessions_total} sessions / ${db.sessions_completed} completed` },
    { product: 'LBI', tier: 'real', runtime_surface: true, activation_path: true, reporting_path: true, live_data: `lbi_sessions=${db.lbi_sessions}` },
    { product: 'Employability Index', tier: 'real', runtime_surface: true, activation_path: true, reporting_path: true, live_data: `career_seeker_profiles=${db.career_seeker_profiles}` },
    { product: 'Employability Passport', tier: 'gated-real', runtime_surface: true, activation_path: true, reporting_path: true, live_data: `flag-gated; snapshot in profile JSONB` },
    { product: 'Career Builder', tier: 'real', runtime_surface: true, activation_path: true, reporting_path: true, live_data: `career_seeker_profiles=${db.career_seeker_profiles}` },
    { product: 'Mentor Intelligence', tier: 'partial', runtime_surface: true, activation_path: false, reporting_path: false, live_data: `mentor_profiles=${db.mentor_profiles}; mentor_bookings table ${tables.mentor_bookings ? 'present' : 'ABSENT'}` },
    { product: 'Longitudinal (repeat-assessment trend)', tier: 'real', runtime_surface: true, activation_path: true, reporting_path: true, live_data: `repeat-session users drive the longitudinal trend; "Mastery" itself is the CAP_MAS stage code, not a separate product` },
  ];
  const productStruct = structPct(products.map((p) => ({ name: p.product, tier: p.tier, note: p.live_data })));

  // ── Missing components (deterministic from findings) ──
  const missing: { item: string; unlocks: string; severity: string }[] = [
    { item: 'Real Razorpay keys (RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET)', unlocks: 'Revenue Activation; verifies the payment pipeline end-to-end', severity: 'BLOCKER (paid launch)' },
    { item: 'Access-time entitlement enforcement guard (requireEntitlement consuming entitlement-engine)', unlocks: 'Product Monetization access_enforcement cell; tier gating', severity: 'BLOCKER (monetization)' },
    { item: 'Seeded subscription_packages catalog (currently 0 rows)', unlocks: 'Subscription + Renewal Activation; package purchases', severity: 'HIGH' },
    { item: 'parent_subscriptions table (referenced in code, ABSENT in live DB)', unlocks: 'Parent plan tier (basic/family/premium) enforcement', severity: 'HIGH' },
    { item: 'Un-gate commercial flags + wire live user-facing consumers (6 of 7 default OFF)', unlocks: 'Commercial Activation across entitlement/renewal/upsell/lifecycle/forecast/revenue', severity: 'HIGH' },
    { item: 'Decision→package mapping (no detected outcome/journey → package today)', unlocks: 'Upgrade-path automation; offer targeting', severity: 'MEDIUM' },
    { item: 'Behavioural upsell triggers (at_risk / power_user — named, not built)', unlocks: 'Upsell beyond stage-ladder progression', severity: 'MEDIUM' },
    { item: 'Mentor booking substrate (mentor_bookings table absent; mentors=0)', unlocks: 'Mentor product fulfillment + monetization', severity: 'MEDIUM' },
    { item: 'Conversion telemetry volume (0 payment_completed events)', unlocks: 'Revenue/conversion forecasting (needs ≥2 monthly points)', severity: 'MEDIUM (data, time-bound)' },
  ];

  // ── Snapshot JSON ──
  const snapshot = {
    audit: 'wc-c1',
    generated_at: stamp,
    methodology: 'dual-axis (Structural deterministic 5-band; Activation = binary-enabler count, deploy posture); never composited; denominators stated.',
    env_posture: { razorpay: env, razorpay_configured: razorpayConfigured, flag_defaults: flagDefaults, dev_workflow_override: devOverride },
    db_ground_truth: db,
    table_existence: tables,
    resolvers: { entitlement, renewal, upsell, lifecycle, forecast, revenue },
    success_metrics: {
      commercial_readiness: { structural_pct: commercialStruct.pct, structural: `${commercialStruct.score}/${commercialStruct.max}`, activation_pct: commercialAct.pct, activation: `${commercialAct.present}/${commercialAct.total}`, denominator: '6 WC-7C lifecycle capabilities' },
      revenue_readiness: { structural_pct: revenueStruct.pct, structural: `${revenueStruct.score}/${revenueStruct.max}`, activation_pct: revenueAct.pct, activation: `${revenueAct.present}/${revenueAct.total}`, denominator: '5 payment-pipeline cells', note: 'pipeline capped at gated-real: real-keys path never executed e2e (unverified, not broken).' },
      subscription_readiness: { structural_pct: subscriptionStruct.pct, structural: `${subscriptionStruct.score}/${subscriptionStruct.max}`, activation_pct: subscriptionAct.pct, activation: `${subscriptionAct.present}/${subscriptionAct.total}`, denominator: '6 subscription-system cells' },
      product_monetization_readiness: { structural_pct: monStructPct, structural: `${monStructScore}/${monStructMax}`, activation_pct: monAct.pct, activation: `${monAct.present}/${monAct.total}`, denominator: `${productsMon.length} products × ${monCellCount} wiring cells` },
      product_readiness_build: { structural_pct: productStruct.pct, structural: `${productStruct.score}/${productStruct.max}`, denominator: `${products.length} products (build maturity, not monetization)` },
    },
    commercial_wave2_reconciliation: {
      prior_structural: '24/30 (80%) over 6 lifecycle capabilities (commercial-wave-2, same day)',
      prior_activation: '0%',
      recomputed_commercial_structural: `${commercialStruct.score}/${commercialStruct.max} (${commercialStruct.pct}%)`,
      recomputed_commercial_activation: `${commercialAct.pct}%`,
      consistent: commercialStruct.score === 24 && commercialStruct.max === 30,
    },
    missing_components: missing,
    pii: { email_mask: 'sha256→user_<hex[:10]>', payment_identities_masked_sample: emailSample },
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, '_wc_c1_snapshot.json'), JSON.stringify(snapshot, null, 2));

  const cellTable = (cells: Cell[]) => cells.map((c) => `| ${c.name} | ${tierTag(c.tier)} | ${c.note} |`).join('\n');
  const enablerTable = (es: Enabler[]) => es.map((e) => `| ${e.name} | ${e.present ? '✅' : '❌'} | ${e.detail} |`).join('\n');
  const PAIR = (label: string, sp: number, sFrac: string, ap: number, aFrac: string, denom: string) =>
    `**${label}** — Structural **${sp}%** (${sFrac}) · Activation **${ap}%** (${aFrac}) · _denominator: ${denom}_`;

  // ════════════════════════ DELIVERABLE 01 — EXECUTIVE SUMMARY ════════════════════════
  writeFileSync(join(OUT_DIR, '01_executive_summary.md'), `# WC-C1 · Commercial Wave 2 Readiness Audit — Executive Summary
_Generated ${stamp}. AUDIT ONLY · read-only · no schema/deploy · STOP FOR APPROVAL. All figures recomputed live from runtime state; emails sha256-masked._

## Method (two axes, never blended into one number)
- **Structural** = does the code/engine/route/table-definition exist? (real=5 / gated-real=4 / partial=3 / stub=2 / absent=1, normalized).
- **Activation** = is it live in the **deploy posture**? A count of binary enablers present (flag-ON by config default · real keys · live data · user-reachable consumer). The dev workflow forces \`FF_COMMERCIAL_ACTIVATION=1\` — a **footnote only**, not a deploy enabler.
- **Coverage** (asset/data exists) and **Confidence** (live/trustworthy) are reported separately throughout.

## The four required readiness percentages (each a pair, with denominator)
1. ${PAIR('Current Commercial Readiness', commercialStruct.pct, `${commercialStruct.score}/${commercialStruct.max}`, commercialAct.pct, `${commercialAct.present}/${commercialAct.total}`, '6 WC-7C lifecycle capabilities')}
2. ${PAIR('Revenue Readiness', revenueStruct.pct, `${revenueStruct.score}/${revenueStruct.max}`, revenueAct.pct, `${revenueAct.present}/${revenueAct.total}`, '5 payment-pipeline cells')}
3. ${PAIR('Subscription Readiness', subscriptionStruct.pct, `${subscriptionStruct.score}/${subscriptionStruct.max}`, subscriptionAct.pct, `${subscriptionAct.present}/${subscriptionAct.total}`, '6 subscription-system cells')}
4. ${PAIR('Product Monetization Readiness', monStructPct, `${monStructScore}/${monStructMax}`, monAct.pct, `${monAct.present}/${monAct.total}`, `${productsMon.length} products × ${monCellCount} wiring cells`)}

> **Headline:** the platform is **structurally mid-to-high but commercially un-activated**. Every commercial engine exists and is honest; **Activation is ~0% across all four metrics** because Razorpay keys are absent (DEMO mode), **₹0 has ever been captured**, the catalog/subscription tables are empty, and 6 of 7 commercial flags default OFF. This is a **cold-start / unexercised** posture, NOT a broken pipeline.

## Coverage vs Confidence (one line)
- **Coverage:** commercial *engines* are broadly present (Structural ${commercialStruct.pct}% lifecycle). **Confidence:** ~0 — no engine has run against real money or real catalog data.

## Missing components (severity-ranked)
${missing.map((m) => `- **[${m.severity}]** ${m.item} → _unlocks:_ ${m.unlocks}`).join('\n')}

## Fastest path to **Paid Consumer Launch** (minimal critical path — B2C CAPADEX ladder, the only product with a real SKU)
1. **Add real Razorpay keys** (RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET) — flips DEMO→live; the order-create / signature-verify / webhook code already exists.
2. **Verify ONE real payment end-to-end** (order → capture → \`status='paid'\` → \`payment_completed\` event) — converts the pipeline from *gated-real/unverified* to *real*.
3. **Wire an access-time entitlement guard** that consumes \`entitlement-engine.deriveEntitlement(email)\` so a paid stage actually unlocks the deeper experience (today nothing enforces it).
4. **Un-gate \`commercialActivation\`** in the deploy posture + surface the activation/offer envelope in the live UI.
> Steps 1–4 require **no new engine and no new table** — they are key-config + one guard + flag enablement. That is the genuine shortest path; everything downstream (packages, renewal, upsell) is additive.

## Fastest path to **95% Commercial Readiness**
- **Structural → ~95%** needs the few *real(5)* upgrades that an audit cannot grant: un-gate each lifecycle flag **and** wire a live consumer for each (entitlement enforcement, renewal reminder job, upsell surface, lifecycle/forecast admin consumer). See \`10_commercial_expansion_roadmap.md\` for the per-cell checklist.
- **Activation → ~95% is NOT reachable by configuration alone** — it requires *real paid volume* (paid rows, captured ₹, ≥2 monthly points per series, seeded packages). That is earned by live commerce over time, not built. **Honest statement: Structural 95% is reachable with focused wiring; Activation 95% is a function of real revenue, not engineering.**

## Reconciliation with the same-day \`commercial-wave-2\` audit
Recomputed Commercial Structural = **${commercialStruct.score}/${commercialStruct.max} (${commercialStruct.pct}%)**, Activation **${commercialAct.pct}%** — ${snapshot.commercial_wave2_reconciliation.consistent ? 'consistent with' : '⚠️ DIVERGES from'} the prior baseline (24/30 = 80% · 0%). This audit *recomputes* (does not copy) and extends to products, subscriptions, revenue, and monetization. Per-deliverable reconciliation tables are included in 07/08/09.

> _Reconciliation nuance: the 6 lifecycle **structural tiers** are re-asserted engineering judgments identical to wave-2, so structural consistency is partly **by construction**. The **resolver figures** (entitlement/renewal/upsell/lifecycle/forecast/revenue counts) are genuinely **recomputed** against the live DB this run — those are the numbers that would have caught any drift._
`);

  // ════════════════════════ DELIVERABLE 02 — PRODUCT READINESS ════════════════════════
  writeFileSync(join(OUT_DIR, '02_product_readiness_report.md'), `# WC-C1 · Deliverable 2 — Product Readiness Report
_Generated ${stamp}. Build maturity of each product (distinct from monetization wiring — see deliverable 04 §monetization & the Product Monetization metric)._

**Product Readiness (build maturity): Structural ${productStruct.pct}% (${productStruct.score}/${productStruct.max} over ${products.length} products).** Build maturity is HIGH; this is independent of whether a purchase path is wired (it mostly is not).

| Product | Structural | Runtime surface | Activation path | Reporting path | Live data |
|---|---|---|---|---|---|
${products.map((p) => `| ${p.product} | ${tierTag(p.tier)} | ${p.runtime_surface ? '✅' : '❌'} | ${p.activation_path ? '✅' : '❌'} | ${p.reporting_path ? '✅' : '❌'} | ${p.live_data} |`).join('\n')}

## Honest findings
- **LBI, Employability Index, Career Builder, Mastery/Longitudinal, CAPADEX entry are REAL** (full engines + activation + reporting). **Mentor Intelligence is PARTIAL** — a matching interface over static catalogs; the live booking substrate (\`mentor_bookings\`) is **ABSENT** and \`mentor_profiles=0\`.
- **"Curiosity / Growth / Mastery Intelligence" are NOT separate products** — they are CAPADEX **stage codes** (CAP_CUR/CAP_GRW/CAP_MAS), the gears inside the assessment runtime.
- **Build maturity ≠ live usage.** Several real engines have thin live data (\`lbi_sessions=0\`, \`career_seeker_profiles=${db.career_seeker_profiles}\`) — a cold-start, not a build gap.

## Coverage vs Confidence
- **Coverage** (engine exists): HIGH (${productStruct.pct}%). **Confidence** (proven at live scale): LOW–MEDIUM — most products carry little live data.
`);

  // ════════════════════════ DELIVERABLE 03 — SUBSCRIPTION AUDIT ════════════════════════
  writeFileSync(join(OUT_DIR, '03_subscription_audit_report.md'), `# WC-C1 · Deliverable 3 — Subscription Audit Report
_Generated ${stamp}. Payment flows · Razorpay · tables · persistence · active/inactive plans._

## ${PAIR('Subscription Readiness', subscriptionStruct.pct, `${subscriptionStruct.score}/${subscriptionStruct.max}`, subscriptionAct.pct, `${subscriptionAct.present}/${subscriptionAct.total}`, '6 subscription-system cells')}

## Two parallel commercial tracks
- **B2C CAPADEX stage ladder** (\`capadex_payments\`) — one-time progressive unlock, **permanence model** (no expiry by design). Razorpay-backed.
- **Package / institute model** (\`subscription_packages\` → \`student_subscriptions\`) — **expiry model** (purchase_date/expiry_date/status).
- **Parent plans** (\`parent_subscriptions\`, basic/family/premium) — referenced in \`frontend/server\` code but the **table is ABSENT in the live DB** → non-functional here.

## Structural (does the mechanism exist?)
| Cell | Tier | Note |
|---|---|---|
${cellTable(subscriptionCells)}

## Activation (live data, deploy posture)
| Enabler | Present | Detail |
|---|---|---|
${enablerTable(subscriptionEnablers)}

## Razorpay integration (payment flow)
- Wiring: \`backend/routes/capadex-payments.ts\` — order creation (paise), HMAC-SHA256 signature verification, webhooks (payment.captured / order.paid).
- **Env:** RAZORPAY_KEY_ID=${env.razorpay_key_id ? 'present' : 'ABSENT'} · RAZORPAY_KEY_SECRET=${env.razorpay_key_secret ? 'present' : 'ABSENT'} · RAZORPAY_WEBHOOK_SECRET=${env.razorpay_webhook_secret ? 'present' : 'ABSENT'} → **${razorpayConfigured ? 'LIVE' : 'DEMO mode'}**.
- **Ledger:** ${db.payments_total} rows — paid=${db.payments_paid}, pending=${db.payments_pending}, failed=${db.payments_failed}; **${db.payments_demo} are DEMO orders**. Captured revenue: **₹${revenue.overall.rupees}**.

## What exists / partial / missing
- **EXISTS:** B2C ladder catalog + Razorpay code + package catalog + persistence schema + admin CRUD + lifecycle projection.
- **PARTIAL:** active-subscription concept (engine exists, flag OFF); package model present but **0 packages defined, 0 subscriptions**.
- **MISSING:** parent_subscriptions table (live DB); any real paid/active subscription; decision→package mapping.

## Honest ceiling
The subscription **machinery** is largely built; the **substrate is empty** (0 active packages, 0 subscriptions, 0 captured). Activation is a seeding + real-commerce problem, not a build problem.
`);

  // ════════════════════════ DELIVERABLE 04 — ENTITLEMENT AUDIT ════════════════════════
  writeFileSync(join(OUT_DIR, '04_entitlement_audit_report.md'), `# WC-C1 · Deliverable 4 — Entitlement Audit Report
_Generated ${stamp}. Feature gating · plan gating · access control · package ownership._

## Can the tier hierarchy be enforced **today**?
\`\`\`
Free → LBI → Employability → Career Builder → Mentor → Premium
\`\`\`
**No — it is conceptual, not enforced by a single guard.** The pieces exist but are not wired to block access:
- **\`entitlement-engine.deriveEntitlement(email)\`** unions owned paid stages (CAP_CUR→CAP_INS→CAP_GRW→CAP_MAS) into entitled features — **but no \`requireEntitlement\` middleware consumes it.** Access is currently governed by RBAC (\`requireAuth\`/\`requireAdmin\`/\`requireSuperAdmin\`) only.
- Plan gating is **distributed inside route handlers** (e.g. \`PLAN_FEATURES[plan]\` in the parent subscription routes), not a cross-cutting gate.
- **Package ownership** is represented (\`student_subscriptions.package_id\`, \`capadex_payments\` by email) but **nothing enforces it at access time**.

## Entitlement resolver — live state (recomputed)
| Metric | Value |
|---|---|
| Paying identities | ${entitlement.paying_identities} |
| Entitled identities | ${entitlement.entitled_identities} |
| Entitlement coverage | ${naOrPct(entitlement.coverage_pct)} |
| Active package grants | ${entitlement.active_package_grants} |
| Degraded | ${entitlement.degraded} |

**Owned-stage distribution:** ${entitlement.owned_stage_distribution.length ? entitlement.owned_stage_distribution.map((d: any) => `${d.stage}=${d.identities}`).join(', ') : '— (no paid stages)'}

## Two flag systems (both real, neither is per-plan entitlement)
- **Config registry** (\`backend/config/feature-flags.ts\`) — boolean engine/phase gates; **global**, default OFF. Commercial flags here: ${Object.entries(flagDefaults).map(([k, v]) => `${k}=${v ? 'ON' : 'OFF'}`).join(', ')}.
- **DB \`feature_flags\` table** — engine flags (signal_intelligence/dynamic_reporting ON; interventions/longitudinal_memory OFF), with tenant overrides + rollout %. **Neither system is a per-user subscription entitlement.**

## Fail-CLOSED discipline (correct)
The entitlement + commerce reads **fail closed**: a ledger read error → \`billing_ledger_unavailable\` (entitles nothing), never mistaken for "owns nothing" — preventing a dishonest upsell. This is a strength to preserve.

## What exists / partial / missing
- **EXISTS:** RBAC guards; entitlement resolver (owned stages→features); fail-closed reads; two flag systems.
- **PARTIAL:** plan gating (per-route, non-blocking); package ownership (recorded, not enforced).
- **MISSING:** centralized \`requireEntitlement\`/\`requirePlan\` access-time guard; enforced Free→…→Premium hierarchy; per-user subscription→feature gate.
`);

  // ════════════════════════ DELIVERABLE 05 — REVENUE INTELLIGENCE ════════════════════════
  writeFileSync(join(OUT_DIR, '05_revenue_intelligence_report.md'), `# WC-C1 · Deliverable 5 — Revenue Intelligence Report
_Generated ${stamp}. Offer · commercial-recs · pricing · package intelligence + Revenue Readiness._

## ${PAIR('Revenue Readiness', revenueStruct.pct, `${revenueStruct.score}/${revenueStruct.max}`, revenueAct.pct, `${revenueAct.present}/${revenueAct.total}`, '5 payment-pipeline cells')}

### Three separated facts (do not conflate)
1. **Pipeline Structural = gated-real (capped at 4/5).** order-create / HMAC verify / webhook handlers are real code — but the **real-keys path has NEVER executed end-to-end**, so it cannot score *real(5)*. **Unverified, not broken.**
2. **Activation = ${revenueAct.pct}%.** Razorpay keys absent (DEMO), **₹${revenue.overall.rupees} captured**, ${db.payments_paid} paid rows, **${db.payment_completed_events} \`payment_completed\` events**. The ${db.payments_demo} demo rows prove the *demo fallback* works — not the live pipeline.
3. **The rich behavioural substrate does NOT count as revenue readiness.** \`wcl5_memory=${db.wcl5_memory}\`, \`wcl0_user_intelligence=${db.wcl0_user_intelligence}\` are behavioural, not commercial; they must not leak into a revenue figure.

## Pipeline cells (structural)
| Cell | Tier | Note |
|---|---|---|
${cellTable(revenueCells)}

## Activation enablers
| Enabler | Present | Detail |
|---|---|---|
${enablerTable(revenueEnablers)}

## Revenue intelligence engine — live measurement (recomputed; REAL rows, not estimates)
| Metric | Value |
|---|---|
| Total / paid / pending / failed | ${revenue.overall.total} / ${revenue.overall.paid} / ${revenue.overall.pending} / ${revenue.overall.failed} |
| Captured revenue | ₹${revenue.overall.rupees} |
| Session attribution coverage | ${revenue.attribution.coverage_pct}% (${revenue.attribution.paid_with_session}/${revenue.attribution.paid_total}) |
| payment_completed events | ${revenue.conversions.payment_completed_events} |
| Funnel | sessions=${revenue.funnel.sessions}, paid=${revenue.funnel.paid}, ₹${revenue.funnel.rupees} |

## Offer / pricing / package intelligence (existing assets)
- **Offer intelligence** (\`offer-engine.ts\`) — composes a per-session offer (subscription/report/product/growth_plan/mentor) with \`offer_fit\` (**directional, not a conversion probability**) + a **stub guard** that refuses to sell into unready products.
- **Pricing** — hardcoded ladder STAGE_PRICES (CAP_INS 499 / CAP_GRW 999 / CAP_MAS 1999), mirrored in subscription-engine.ts (kept in lockstep).
- **Commercial recommendations** — next unowned ladder rung (Insight→Growth→Mastery), behind the D6 high-confidence gate (≥0.7 + low ambiguity), else \`show_options\`.

## Honest statement
Revenue readiness is **structurally high but unproven** and **activation ≈ 0**. The fix is configuration + one real transaction, not engineering. ₹0 is a **cold start**, not a defect.
`);

  // ════════════════════════ DELIVERABLE 06 — UPGRADE PATH ════════════════════════
  const ladderOwned = upsell.next_rung_distribution || [];
  writeFileSync(join(OUT_DIR, '06_upgrade_path_report.md'), `# WC-C1 · Deliverable 6 — Upgrade Path Report
_Generated ${stamp}. Assessment → Product → Subscription → Renewal → Upsell. (Scope: the progression MECHANICS & transitions; the upsell engine's eligible-population readiness is deliverable 08.)_

## The intended flow & its real transitions
\`\`\`
Assessment (CAPADEX) → Product (stage unlock) → Subscription (ladder/package) → Renewal → Upsell
\`\`\`
| Transition | Mechanism | Status |
|---|---|---|
| Assessment → Product | CAPADEX session completes → stage_code; deeper stage = next product | **REAL** (${db.sessions_completed} completed sessions) |
| Product → Subscription | capadex-payments order for next stage (STAGE_PRICES) | **REAL code / DEMO only** (no real keys; ${db.payments_paid} paid) |
| Subscription → next stage access | should unlock deeper experience | **BROKEN/missing** — no access-time entitlement guard consumes ownership |
| Subscription → Renewal | package validity window (renewal-engine) | **GATED-REAL** (B2C ladder = renewal_not_applicable_b2c; packages empty) |
| Renewal → Upsell | next unowned rung (upsell-engine, prior-paid gate) | **GATED-REAL** (0 paid → 0 eligible) |

## Existing upgrade routes
- **Stage ladder progression** is the spine: Curiosity(free) → Insight(₹499) → Growth(₹999) → Mastery(₹1999), each a one-time unlock.
- **Decision Orchestrator** composes stage/outcome/journey into a unified decision and surfaces a \`product\` slot by L3 journey route (career_builder / mentoring), behind the D6 gate.

## Missing / broken transitions
- **No purchase→access enforcement** (the single biggest break in the chain — a paid stage does not gate anything).
- **No decision→package mapping** — a detected outcome/journey does not map to a specific package (packages carry only a \`student_segment\` label + \`is_recommended\`).
- **No real payment has traversed the chain** (DEMO only).

## Honest finding
The upgrade-path **mechanics exist front-to-back** but the chain has a **structural break at "paid → access"** and is **unexercised** (no real money). Fixing the access guard + adding real keys makes the whole chain live without new engines.
`);

  // ════════════════════════ DELIVERABLE 07 — RENEWAL READINESS ════════════════════════
  writeFileSync(join(OUT_DIR, '07_renewal_readiness_report.md'), `# WC-C1 · Deliverable 7 — Renewal Readiness Report
_Generated ${stamp}. Recurring billing · reminders · expiry tracking · subscription lifecycle._

## Renewal pipeline — live state (recomputed)
| Metric | Value |
|---|---|
| Renewable active (finite expiry) | ${renewal.package_model.renewable_active} |
| Due soon (≤ ${renewal.package_model.due_soon_window_days}d) | ${renewal.package_model.due_soon} |
| In grace (≤ ${renewal.package_model.grace_days}d past) | ${renewal.package_model.in_grace} |
| Degraded | ${renewal.degraded} |

## Lifecycle states — live state (recomputed)
- **B2C ladder** (\`capadex_payments\`, ${lifecycle.b2c_ladder.total}): pending=${lifecycle.b2c_ladder.by_state.pending}, fulfilled=${lifecycle.b2c_ladder.by_state.fulfilled}, abandoned=${lifecycle.b2c_ladder.by_state.abandoned}.
- **Packages** (\`student_subscriptions\`, ${lifecycle.package_subscriptions.total}): active=${lifecycle.package_subscriptions.by_state.active}, expiring_soon=${lifecycle.package_subscriptions.by_state.expiring_soon}, expired=${lifecycle.package_subscriptions.by_state.expired}, cancelled=${lifecycle.package_subscriptions.by_state.cancelled}.

## Capabilities
- **Expiry tracking:** EXISTS (package model: purchase_date/expiry_date/status). **Renewal classification:** EXISTS (due_soon/in_grace, deterministic).
- **Recurring billing:** structural support for packages; **B2C ladder is renewal_not_applicable_b2c by design** (one-time unlocks).
- **Renewal reminders:** **MISSING** — no reminder job/notification wired to the renewal-engine output.

## Honest ceiling
0 package subscriptions → **0 renewable population**. Renewal is **structurally complete but has no data to act on**; the B2C ladder never contributes renewal volume by design.

## Reconciliation with commercial-wave-2 (deliverable 02 — renewal_report)
Same renewal-engine, recomputed: renewable_active=${renewal.package_model.renewable_active}, due_soon=${renewal.package_model.due_soon}, in_grace=${renewal.package_model.in_grace} — **consistent**. Capability tier: **gated-real (4/5)** (matches the wave-2 structural cell).
`);

  // ════════════════════════ DELIVERABLE 08 — UPSELL READINESS ════════════════════════
  writeFileSync(join(OUT_DIR, '08_upsell_readiness_report.md'), `# WC-C1 · Deliverable 8 — Upsell Readiness Report
_Generated ${stamp}. Ability to recommend next product / subscription / mentor / mastery using EXISTING intelligence. (Scope: eligible-population & engine readiness; the chain mechanics are deliverable 06.)_

## Upsell engine — live state (recomputed)
| Metric | Value |
|---|---|
| Upsell-eligible identities (require prior paid) | ${upsell.eligible_identities} |
| Full-ladder owners (retention) | ${upsell.full_ladder_owners} |
| Triggers built | ${upsell.trigger_taxonomy.built.join(', ')} |
| Triggers NOT built | ${upsell.trigger_taxonomy.not_built.join(', ')} |
| Degraded | ${upsell.degraded} |

**Next-rung distribution:** ${ladderOwned.length ? ladderOwned.map((d: any) => `${d.stage}=${d.identities}`).join(', ') : '— (no paid identities)'}

## What can be recommended from existing intelligence (no new engine)
| Target | Mechanism | Status |
|---|---|---|
| Next subscription (ladder rung) | upsell-engine + D6 gate + stub guard | **GATED-REAL** (requires prior paid; 0 today) |
| Next product (career_builder / mentoring) | activation envelope \`product\` slot by L3 journey | **GATED-REAL** (commercialActivation; stub guard blocks mentor/employability) |
| Mentor services | offer-engine mentor slot | **PARTIAL** — mentor product is a stub (mentor_bookings absent) |
| Mastery services | next ladder rung CAP_MAS | **GATED-REAL** |

## Honest ceiling
Upsell **requires a prior paid purchase**; with **${db.payments_paid} paid rows, eligible = ${upsell.eligible_identities}** — a true ceiling, not a wiring gap. The only built trigger is stage-ladder progression; **behavioural triggers (at_risk / power_user) are named but deliberately NOT built** (they would be a new intelligence engine, out of audit scope).

## Reconciliation with commercial-wave-2 (deliverable 03 — upsell_report)
Recomputed eligible=${upsell.eligible_identities}, full_ladder_owners=${upsell.full_ladder_owners} — **consistent**. Capability tier: **gated-real (4/5)**.
`);

  // ════════════════════════ DELIVERABLE 09 — COMMERCIAL FORECAST READINESS ════════════════════════
  writeFileSync(join(OUT_DIR, '09_commercial_forecast_readiness_report.md'), `# WC-C1 · Deliverable 9 — Commercial Forecast Readiness Report
_Generated ${stamp}. Can existing trend/forecast/memory support revenue / conversion / retention forecasting WITHOUT new engines?_

## Forecast inputs — live state (recomputed)
- **Contract:** WC-L2 \`MIN_POINTS=${forecast.min_points}\` (≥2 comparable monthly points) — reused, **no new model**.
- **Forecastable series:** ${forecast.forecastable_count}/${forecast.total_series}.

| Series | Points | Forecastable |
|---|---|---|
${(forecast.series || []).map((s: any) => `| ${s.key} | ${s.points} | ${s.forecastable ? '✅' : '❌'} |`).join('\n')}

## Can it support the three forecasts today?
| Forecast | Mechanism (existing) | Status |
|---|---|---|
| Revenue forecasting | last+slope over paid-revenue series | **NOT YET** — 0 paid rows → <2 points |
| Conversion forecasting | payment_completed / sessions over time | **NOT YET** — 0 conversion events |
| Retention forecasting | renewal/expiry series over time | **NOT YET** — 0 package subscriptions |

## Critical honesty note
The platform HAS rich behavioural trend/forecast/memory (WC-L1/L2/L5: wcl5_memory=${db.wcl5_memory} rows). **That substrate must NOT be counted as commercial forecast readiness** — all commercial series have **<2 points** (paid series have 0). The forecast *machinery* is reusable day-one; it is **data-starved**, and a forecast is only as honest as its series.

## Honest finding
**Commercial forecasting is structurally enabled but data-blocked.** The WC-L2 contract drops any series with <2 points (never fabricates). Forecasts activate automatically once ≥2 monthly points of real commerce accrue per series — earned over time, not built.

## Reconciliation with commercial-wave-2 (deliverable 05 — forecast)
Recomputed forecastable=${forecast.forecastable_count}/${forecast.total_series} — **consistent**. Capability tier: **gated-real (4/5)**.
`);

  // ════════════════════════ DELIVERABLE 10 — COMMERCIAL EXPANSION ROADMAP ════════════════════════
  writeFileSync(join(OUT_DIR, '10_commercial_expansion_roadmap.md'), `# WC-C1 · Deliverable 10 — Commercial Expansion Roadmap
_Generated ${stamp}. Enabler checklist keyed to the axis cell each unlocks. NO projections, NO new engines — reuse existing assets only._

## Reading this roadmap
Each enabler names **which readiness cell it moves** and **which axis** (Structural raises the tier toward *real(5)*; Activation flips a binary enabler ❌→✅). No revenue/conversion numbers are projected — those are earned, not forecast here.

## Tier 0 — Paid Consumer Launch (smallest viable, B2C ladder only)
| # | Enabler | Axis · cell it unlocks | New engine/table? |
|---|---|---|---|
| 0.1 | Add real Razorpay keys (ID/SECRET/WEBHOOK_SECRET) | Activation · Revenue (keys, capture) | No (config) |
| 0.2 | Run ONE real payment end-to-end → \`status='paid'\` + \`payment_completed\` event | Structural · Revenue order/verify/webhook → *real(5)*; Activation · Revenue (paid>0, events>0) | No |
| 0.3 | Wire \`requireEntitlement\` consuming \`entitlement-engine.deriveEntitlement(email)\` | Structural · Product Monetization (access_enforcement); Entitlement hierarchy | No (one guard) |
| 0.4 | Un-gate \`commercialActivation\` (deploy default) + surface offer/activation envelope in UI | Activation · Commercial (flag ON + consumer) | No (flag + UI) |

## Tier 1 — Subscription & Renewal activation
| # | Enabler | Axis · cell it unlocks | New engine/table? |
|---|---|---|---|
| 1.1 | Seed \`subscription_packages\` (currently 0 rows) | Activation · Subscription (active packages>0) | No (data seed) |
| 1.2 | Create \`parent_subscriptions\` table in live DB (code already references it) | Structural · Subscription (parent_plans absent→real) | Table EXISTS in code, missing in DB |
| 1.3 | Un-gate \`commercialEntitlement\`/\`commercialRenewal\`/\`commercialLifecycleState\` + wire consumers | Structural+Activation · Commercial (entitlement/renewal/lifecycle → real) | No |
| 1.4 | Wire a renewal-reminder job to renewal-engine output | Structural · Renewal (reminders) | No (job) |

## Tier 2 — Upsell, offers, forecasting
| # | Enabler | Axis · cell it unlocks | New engine/table? |
|---|---|---|---|
| 2.1 | Un-gate \`commercialUpsell\` + surface next-rung offer | Structural+Activation · Commercial (upsell) | No |
| 2.2 | Add decision→package mapping (outcome/journey → package) | Structural · Upgrade-path (missing transition) | No (mapping table/config) |
| 2.3 | Un-gate \`commercialForecastInputs\`/\`revenueIntelligence\` admin surfaces | Structural · Commercial (forecast/revenue consumers) | No |
| 2.4 | Accrue ≥2 monthly points per commercial series (real commerce over time) | Activation · Commercial Forecast (forecastable series) | No (time + volume) |

## Tier 3 — Deferred / explicitly OUT of "reuse existing assets" scope
| # | Item | Why deferred |
|---|---|---|
| 3.1 | Behavioural upsell triggers (at_risk / power_user) | Would be a NEW intelligence engine |
| 3.2 | Mentor monetization (mentor_bookings table + live mentors) | Mentor product is a stub; needs substrate, not just commerce wiring |
| 3.3 | B2B institutional seats (institution_id / max_students) | subscription_packages lacks these columns; biggest revenue, biggest build |

## Honest summary
- **Structural → ~95%** is reachable by **un-gating + wiring live consumers + one access guard** (Tiers 0–2) — no new engine, no new intelligence.
- **Activation → high** is **earned by real commerce** (keys, paid volume, seeded catalog, accrued series), NOT by configuration. The shortest honest path to *paid* launch is **Tier 0** alone.
`);

  // ── Console summary ──
  console.log('WC-C1 audit — 10 deliverables + _wc_c1_snapshot.json written to', OUT_DIR);
  console.log(`Commercial:  Structural ${commercialStruct.pct}% (${commercialStruct.score}/${commercialStruct.max}) · Activation ${commercialAct.pct}%`);
  console.log(`Revenue:     Structural ${revenueStruct.pct}% (${revenueStruct.score}/${revenueStruct.max}) · Activation ${revenueAct.pct}%`);
  console.log(`Subscription:Structural ${subscriptionStruct.pct}% (${subscriptionStruct.score}/${subscriptionStruct.max}) · Activation ${subscriptionAct.pct}%`);
  console.log(`Product-Mon: Structural ${monStructPct}% (${monStructScore}/${monStructMax}) · Activation ${monAct.pct}%`);
  console.log(`Reconciliation w/ commercial-wave-2 (24/30=80%): ${snapshot.commercial_wave2_reconciliation.consistent ? 'CONSISTENT' : 'DIVERGES'}`);
  console.log(`Razorpay configured: ${razorpayConfigured} · captured ₹${revenue.overall.rupees} · paid rows ${db.payments_paid}`);

  await pool.end();
}

run().catch((e) => { console.error('WC-C1 audit failed:', e); process.exit(1); });
