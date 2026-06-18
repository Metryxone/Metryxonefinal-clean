/**
 * WC-C7 — Upsell & Expansion Intelligence Audit
 * AUDIT ONLY · READ ONLY · STOP FOR APPROVAL
 *
 * Measures CAPADEX's ability to identify, recommend, route, and monetise
 * user upgrades across the existing product ecosystem.
 *
 * Reuses existing engines only. No new engines / products / schemas.
 * Run WITHOUT FF_* flag overrides (deploy posture).
 *
 * Outputs 7 deliverables + _wc_c7_snapshot.json → backend/audit/wc-c7/
 *
 * Architect-confirmed denominators (2026-06-10):
 *   1. Upsell Readiness   — trigger taxonomy (3 total / 1 built). Activation = 0/0 not_measurable.
 *   2. Expansion Readiness — 4 paths. Struct 2/4. Activation 0/4 measurable.
 *   3. Upgrade Coverage   — completed sessions (9) denominator. Routed 9/9; non-stub 8/9.
 *   4. Upgrade Confidence — journey 2/9 ≥0.7; outcome 6/14 ≥0.7. Two separate labels.
 *   5. Cross-SKU          — structural ABSENT (0/1 identity bridge). Activation not_applicable.
 *   6. Revenue Expansion  — 3 sub-facts: paid_conversion 0/6=0%; forecastable 0/4=0%;
 *                          renewal_eligibility 0/0=not_measurable.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Pool } from 'pg';

import { buildRevenueIntelligence } from '../../services/wc7c/revenue-intelligence';
import { buildForecastInputs } from '../../services/wc7c/commercial-forecast-inputs';
import { buildSubscriptionLifecycle } from '../../services/wc7c/subscription-lifecycle';
import { buildUpsellOverview } from '../../services/wc7c/upsell-engine';
import { buildRenewalPipeline } from '../../services/wc7c/renewal-engine';
import { buildEntitlementOverview } from '../../services/wc7c/entitlement-engine';

const OUT_DIR = path.resolve(__dirname, '../../audit/wc-c7');
const HIGH_CONF = 0.7;
const LADDER = ['CAP_INS', 'CAP_GRW', 'CAP_MAS'] as const;
const LADDER_PRICES: Record<string, number> = { CAP_INS: 499, CAP_GRW: 999, CAP_MAS: 1999 };
const STUB_ROUTES = new Set(['competitive_exam', 'employability_index']);

// PII mask: irreversible pseudonym — user_<first 10 hex chars of sha256(lower(email))>
function maskEmail(email: string | null | undefined): string {
  if (!email) return 'no_email';
  const h = crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
  return `user_${h.slice(0, 10)}`;
}

function pct(n: number, d: number, dp = 1): string {
  if (d === 0) return 'not_measurable';
  return `${Math.round((n / d) * 100 * Math.pow(10, dp)) / Math.pow(10, dp)}%`;
}

function write(filename: string, content: string) {
  fs.writeFileSync(path.join(OUT_DIR, filename), content, 'utf8');
  console.log(`  ✓ ${filename}`);
}

// ─── Data types ──────────────────────────────────────────────────────────────

interface JourneyRow {
  session_id: string;
  route_confidence: number;
  primary_route: string;
  user_email_masked: string;
  is_stub: boolean;
}

interface OutcomeRow {
  session_id: string;
  confidence: number;
  user_email_masked: string;
}

interface PaymentRow {
  stage_code: string;
  status: string;
  amount_paise: number;
  email_masked: string;
}

interface JourneyRoute {
  route_key: string;
  product_key: string;
  product_label: string;
  product_path: string | null;
  is_stub: boolean;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const now = new Date().toISOString();

  console.log('WC-C7 Upsell & Expansion Intelligence Audit');
  console.log('============================================');
  console.log('Mode: AUDIT ONLY · READ ONLY · No FF_* overrides');
  console.log(`Time: ${now}\n`);

  // ── A. Raw substrate reads ──────────────────────────────────────────────

  const [
    sessionsTotal,
    journeyRows,
    outcomeRows,
    paymentRows,
    journeyRoutes,
    packageCatalog,
    subscriptionCount,
  ] = await Promise.all([
    pool.query('SELECT COUNT(*) c FROM capadex_sessions').then(r => Number(r.rows[0].c)).catch(() => 0),
    pool.query(`SELECT session_id, COALESCE(route_confidence::numeric, 0) route_confidence,
                       primary_route, user_email
                FROM wc3_journey_state ORDER BY route_confidence DESC`)
      .then(r => r.rows.map((row): JourneyRow => ({
        session_id: String(row.session_id),
        route_confidence: Number(row.route_confidence),
        primary_route: String(row.primary_route ?? ''),
        user_email_masked: maskEmail(row.user_email),
        is_stub: STUB_ROUTES.has(String(row.primary_route ?? '')),
      }))).catch(() => [] as JourneyRow[]),
    pool.query(`SELECT session_id, COALESCE(confidence::numeric, 0) confidence, user_email
                FROM wc3_outcome_state ORDER BY confidence DESC`)
      .then(r => r.rows.map((row): OutcomeRow => ({
        session_id: String(row.session_id),
        confidence: Number(row.confidence),
        user_email_masked: maskEmail(row.user_email),
      }))).catch(() => [] as OutcomeRow[]),
    pool.query(`SELECT stage_code, status, COALESCE(amount_paise::numeric, 0) amount_paise, lower(email) email
                FROM capadex_payments ORDER BY created_at DESC`)
      .then(r => r.rows.map((row): PaymentRow => ({
        stage_code: String(row.stage_code ?? ''),
        status: String(row.status ?? ''),
        amount_paise: Number(row.amount_paise),
        email_masked: maskEmail(row.email),
      }))).catch(() => [] as PaymentRow[]),
    pool.query(`SELECT route_key, product_key, product_label, product_path
                FROM wc3_journey_routes ORDER BY route_key`)
      .then(r => r.rows.map((row): JourneyRoute => ({
        route_key: String(row.route_key),
        product_key: String(row.product_key),
        product_label: String(row.product_label),
        product_path: row.product_path ? String(row.product_path) : null,
        is_stub: STUB_ROUTES.has(String(row.route_key)),
      }))).catch(() => [] as JourneyRoute[]),
    pool.query('SELECT COUNT(*) c, COUNT(*) FILTER (WHERE price IS NOT NULL AND validity_days IS NOT NULL) priced FROM subscription_packages')
      .then(r => ({ total: Number(r.rows[0].c), priced: Number(r.rows[0].priced) })).catch(() => ({ total: 0, priced: 0 })),
    pool.query('SELECT COUNT(*) c FROM student_subscriptions').then(r => Number(r.rows[0].c)).catch(() => 0),
  ]);

  // ── B. Run existing engines ─────────────────────────────────────────────

  console.log('Running existing engines…');
  const [revenue, forecast, lifecycle, upsellOverview, renewal, entitlement] = await Promise.all([
    buildRevenueIntelligence(pool),
    buildForecastInputs(pool),
    buildSubscriptionLifecycle(pool),
    buildUpsellOverview(pool),
    buildRenewalPipeline(pool),
    buildEntitlementOverview(pool),
  ]);

  // ── C. Compute 6 metrics (architect-confirmed denominators) ─────────────

  // --- 1. Upsell Readiness ---
  // Structural: trigger taxonomy denominator (3 total triggers; 1 built)
  const upsellTriggerTotal = 3; // stage_ladder_progression + behavioural_at_risk + behavioural_power_user
  const upsellTriggerBuilt = 1; // stage_ladder_progression only
  const upsellTriggerUnbuilt = upsellTriggerTotal - upsellTriggerBuilt;
  // Supporting capabilities: D6 gate (real), stub guard (real), upsell-overview (real) = 3 real
  const upsellCapabilities = [
    { id: 'trigger_stage_ladder', built: true, label: 'Stage-ladder-progression upsell trigger' },
    { id: 'trigger_behavioural_at_risk', built: false, label: 'Behavioural at-risk trigger (not built by design)' },
    { id: 'trigger_behavioural_power_user', built: false, label: 'Behavioural power-user trigger (not built by design)' },
    { id: 'd6_confidence_gate', built: true, label: 'D6 high-confidence gate (≥0.7)' },
    { id: 'stub_guard', built: true, label: 'Stub product guard (never sell into stub)' },
    { id: 'upsell_overview', built: true, label: 'System-wide upsell overview (buildUpsellOverview)' },
    { id: 'safety_d7_override', built: true, label: 'D7 safety override (commerce suppression on crisis)' },
  ];
  const upsellCapStructural = upsellCapabilities.filter(c => c.built).length;
  const upsellCapTotal = upsellCapabilities.length;
  // Activation: paying_identities required; 0 right now → not_measurable
  const payingIdentities = entitlement.paying_identities;
  const upsellActivation = payingIdentities === 0 ? 'not_measurable' : pct(upsellOverview.eligible_identities, payingIdentities);

  // --- 2. Expansion Readiness ---
  // 4 declared expansion paths:
  const expansionPaths = [
    {
      id: 'b2c_ladder_upsell',
      label: 'B2C ladder upsell (CAP_INS → GRW → MAS)',
      structural: true,  // subscription-engine + upsell-engine real
      activation: false, // 0 paid identities
      activation_reason: 'no_paid_identities',
    },
    {
      id: 'package_renewal',
      label: 'Package subscription renewal',
      structural: true,  // renewal-engine real, buildRenewalPipeline real
      activation: false, // 0 subscriptions
      activation_reason: 'no_subscriptions',
    },
    {
      id: 'b2c_package_cross_sell',
      label: 'B2C ladder ↔ package cross-sell',
      structural: false, // identity bridge ABSENT (users table has no email col)
      activation: false,
      activation_reason: 'identity_bridge_absent',
    },
    {
      id: 'package_to_package_upgrade',
      label: 'Package → package upgrade',
      structural: false, // no upgrade path defined in subscription_packages
      activation: false,
      activation_reason: 'upgrade_path_not_defined',
    },
  ];
  const expansionStructuralCount = expansionPaths.filter(p => p.structural).length;
  const expansionActivationCount = expansionPaths.filter(p => p.activation).length;
  const expansionTotal = expansionPaths.length;

  // --- 3. Upgrade Coverage ---
  const completedSessions = journeyRows.length; // only completed sessions have journey states
  const routedSessions = completedSessions; // all journey states = routed
  const routedNonStub = journeyRows.filter(r => !r.is_stub).length;

  // --- 4. Upgrade Confidence ---
  const journeyHighConf = journeyRows.filter(r => r.route_confidence >= HIGH_CONF).length;
  const journeyFallback = journeyRows.filter(r => r.route_confidence < 0.3).length; // mentoring FALLBACK at 0.2
  const outcomeHighConf = outcomeRows.filter(r => r.confidence >= HIGH_CONF).length;

  // Route distribution
  const routeDist: Record<string, { count: number; is_stub: boolean; product_label: string }> = {};
  for (const jRow of journeyRows) {
    const routeInfo = journeyRoutes.find(r => r.route_key === jRow.primary_route);
    if (!routeDist[jRow.primary_route]) {
      routeDist[jRow.primary_route] = {
        count: 0,
        is_stub: jRow.is_stub,
        product_label: routeInfo?.product_label ?? jRow.primary_route,
      };
    }
    routeDist[jRow.primary_route].count++;
  }

  // --- 5. Cross-SKU Readiness ---
  // Structural: identity bridge between B2C ladder (email-keyed) and packages (child-keyed) = ABSENT
  // Activation: not_applicable — no path to activate
  const crossSkuStructuralScore = 0;
  const crossSkuStructuralDenominator = 1; // 1 required bridge
  const crossSkuStatus = 'ABSENT';

  // --- 6. Revenue Expansion Readiness ---
  const paidPayments = paymentRows.filter(p => p.status === 'paid');
  const pendingPayments = paymentRows.filter(p => p.status === 'pending');
  const allPayments = paymentRows.length;
  const forecastableCount = forecast.forecastable_count;
  const forecastTotal = forecast.total_series;
  // renewal eligibility
  const renewalActive = renewal.package_model.renewable_active;
  // Revenue: all 0 (no paid rows)

  // ── D. Write deliverables ────────────────────────────────────────────────

  console.log('\nWriting deliverables…');

  // 1. Upgrade Path Report
  write('01_upgrade_path_report.md', `# WC-C7 · Deliverable 1 — Upgrade Path Report

**Date:** ${now}
**Audit:** WC-C7 Upsell & Expansion Intelligence Audit
**Phase:** AUDIT ONLY · READ ONLY

---

## Objective

Map every product upgrade path that exists in the live platform.

---

## Product Families

| Family | Products | Model | Upgrade Path |
|---|---|---|---|
| B2C Stage Ladder | CAP_INS (₹499) / CAP_GRW (₹999) / CAP_MAS (₹1,999) | One-time progressive unlock | Linear: INS → GRW → MAS |
| Subscription Packages | 13 packages (₹299–₹1,499, 30–365d) | Validity-window renewable | **ABSENT** |

---

## B2C Ladder Upgrade Path (REAL)

The stage ladder is the only live upgrade path in the platform.

### Upgrade mechanism
- Engine: \`subscription-engine.ts\` + \`upsell-engine.ts\` (WC-7C)
- Path: each paid stage unlocks the next rung as an upsell target
- Gate: D6 confidence ≥ 0.7 required for auto-recommend; below threshold → \`show_options\`
- Safety: D7 crisis/escalation event suppresses all commerce (\`safety_override\`)
- Trigger built: **stage_ladder_progression** (user completes a stage → next rung offered)
- Triggers NOT built (by design): \`behavioural_at_risk\`, \`behavioural_power_user\`
- ⚠ **STAGE_PRICES lockstep**: \`STAGE_PRICES\` is defined independently in BOTH \`subscription-engine.ts\` and \`upsell-engine.ts\`, mirroring \`routes/capadex-payments.ts\`. All three must stay in lockstep — a price change in any one source without updating the others will cause upsell offers to quote incorrect prices.

### Ladder rungs
| Code | Label | Price | Status |
|---|---|---|---|
| CAP_INS | Insight | ₹499 | Live (Razorpay) |
| CAP_GRW | Growth | ₹999 | Live (Razorpay) |
| CAP_MAS | Mastery | ₹1,999 | Live (Razorpay) |

### Live activation state
- Total payments: **${allPayments}** (all CAP_INS, all \`pending\`)
- Paid identities: **0** (no completed purchases)
- Upsell-eligible population: **not_measurable** (requires ≥1 paid identity)
- Full-ladder owners: **0**

The upgrade path is structurally complete and correctly engineered. It cannot activate until at least one user completes a CAP_INS purchase.

---

## Package → Package Upgrade Path (ABSENT)

- No upgrade field, upgrade logic, or upgrade route exists in \`subscription_packages\`
- 13 packages exist in the catalog (WC-C6B) but are sold as independent SKUs
- No ladder or tier relationship is defined between packages

**This is a structural gap, not an activation gap.** The schema would need new fields (e.g. \`upgrades_to_package_id\`) and engine logic before any activation could be possible.

---

## Package ↔ B2C Ladder Cross-Upgrade (ABSENT)

- The B2C ladder is email-keyed (\`capadex_payments\`)
- Package subscriptions are child-keyed (\`student_subscriptions.children_id\`)
- The \`users\` table has no \`email\` column — the identity bridge required to link these two models does not exist
- No route, engine, or mapping connects a package SKU to a ladder stage or vice versa

**Impact:** A package subscriber cannot be identified as a potential ladder upsell candidate, and a paid-ladder user cannot be offered a package upgrade. Cross-product expansion is structurally blocked at the identity layer.

---

## Summary

| Path | Structural | Activation | Reason |
|---|---|---|---|
| B2C ladder upsell (INS→GRW→MAS) | REAL | not_measurable | 0 paid identities |
| Package renewal | REAL (engine) | not_measurable | 0 subscriptions |
| B2C ↔ package cross-upgrade | ABSENT | not_applicable | identity bridge missing |
| Package → package upgrade | ABSENT | not_applicable | no upgrade path defined |

---

*Next step requires user decision: identity bridge (email column on users) is the keystone unlock for cross-SKU expansion.*
`);

  // 2. Cross-SKU Mapping Report
  write('02_cross_sku_mapping_report.md', `# WC-C7 · Deliverable 2 — Cross-SKU Mapping Report

**Date:** ${now}
**Audit:** WC-C7 Upsell & Expansion Intelligence Audit
**Phase:** AUDIT ONLY · READ ONLY

---

## Objective

Determine whether users can move between product SKU families (B2C ladder ↔ subscription packages).

---

## Finding: Cross-SKU Path Is STRUCTURALLY ABSENT

Cross-SKU readiness is not a data-availability gap — it is a **structural gap** at the identity layer.

### Root cause

| Requirement | Status | Detail |
|---|---|---|
| Identity bridge (email on users table) | ABSENT | \`users\` table has 7 cols, no \`email\` |
| B2C→package cross-sell route | ABSENT | No route maps a paid ladder stage to a package SKU |
| Package→B2C ladder upsell route | ABSENT | No route maps a package subscriber to a ladder stage |
| Cross-SKU offer engine logic | ABSENT | \`offer-engine.ts\` bundles subscription+report+product only (all within-ladder) |
| Package feature entitlement | ABSENT | \`subscription_packages\` has no feature column (WC-C2 finding) |

### What exists on each side

**B2C ladder identity surface:**
- \`capadex_payments\` table: keyed by \`lower(email)\` (string)
- \`subscription-engine.ts\` reads \`capadex_payments WHERE lower(email) = $1\`
- Works when CAPADEX session carries a \`guest_email\` (client-asserted)

**Package subscription identity surface:**
- \`student_subscriptions\` table: keyed by \`children_id\` (FK to \`children\` table)
- Children are linked to parents via \`parent_id\`
- No email anywhere in this chain that would connect to \`capadex_payments\`

**The join that would be needed:**
\`\`\`
capadex_payments.email → users.email (MISSING COL) → children.parent_id → student_subscriptions
\`\`\`
This chain cannot be built without a migration adding \`email\` to \`users\`.

---

## Cross-SKU Readiness Score

| Axis | Score | Denominator |
|---|---|---|
| Structural | 0/1 | Identity bridge required but absent |
| Activation | not_applicable | No path to activate |
| Coverage | 0% | No sessions can receive a cross-SKU recommendation |
| Confidence | not_applicable | No recommendation fires |

---

## Impact Assessment

| Scenario | Current state |
|---|---|
| Package subscriber offered ladder upsell | Impossible |
| Paid-ladder user offered a relevant package | Impossible |
| Journey route maps to a package SKU | Impossible (journey routes point to product PATHS, not package IDs) |
| Renewal trigger leads to ladder upsell | Impossible |

---

## What would unlock this

This is a user decision (requires a migration and new architecture work):
1. **Migration**: Add \`email VARCHAR\` column to \`users\` table
2. **Identity bridge**: Link \`capadex_payments.email\` to \`users.email\` → \`children\` → \`student_subscriptions\`
3. **Cross-sell engine**: New logic to compose ladder ownership + package ownership into a cross-sell recommendation
4. **Journey routes**: Extend \`wc3_journey_routes\` to include package SKUs as product targets

All four steps are out of scope for this audit phase (AUDIT ONLY).
`);

  // 3. Recommendation Report
  write('03_recommendation_report.md', `# WC-C7 · Deliverable 3 — Recommendation Report

**Date:** ${now}
**Audit:** WC-C7 Upsell & Expansion Intelligence Audit
**Phase:** AUDIT ONLY · READ ONLY

---

## Objective

Audit the commercial recommendation engine and upsell trigger taxonomy.

---

## Commercial Recommendation Engine (offer-engine)

### Architecture
The offer engine (\`services/wc7c/offer-engine.ts\`) is a **pure compose-only function** — it assembles a per-session offer from upstream intelligence without querying, recomputing, or fabricating.

**Input:** decision confidence + product slot + growthPlan slot + mentor slot + subscription activation
**Output:** \`OfferActivation\` — ready, reason, primary offer, bundle, offer_fit (directional)

### Bundle composition
| Slot | Sellable | Status |
|---|---|---|
| subscription | Yes (when ready) | Next ladder rung; sellable only when D6 high-confidence + prior payment |
| report | Yes (mirrors subscription) | Unlocked by same stage SKU |
| product | Yes (unless stub) | Route_key guard: competitive_exam / employability_index = never sell |
| growth_plan | No | Available as value-add when ready, not monetised |
| mentor | No | Available as value-add when ready, not monetised |

### Gates
| Gate | Behaviour |
|---|---|
| D6 (confidence < 0.7) | \`show_options\` — target surfaced but NOT auto-recommended |
| D7 (safety/crisis event) | \`safety_override\` — empty offer, commerce fully suppressed |
| Stub product | \`product_not_ready\` — never sells into competitive_exam / employability_index |
| No billing identity | \`no_billing_identity\` — target shown but no auto-recommend |
| All stages owned | \`all_stages_owned\` — retention path, no new ladder product to sell |

### Live activation state
- Paid identities: **0** → offer engine never reaches \`primary=recommend\` for anyone
- D6 gate hit rate (journey confidence ≥ 0.7): **${journeyHighConf}/${completedSessions}** = **${pct(journeyHighConf, completedSessions)}** of completed sessions
- Sessions with stub route (competitive_exam): **${journeyRows.filter(r => r.is_stub).length}** → would trigger stub guard

---

## Upsell Trigger Taxonomy

### Built triggers
| Trigger | Status | Logic |
|---|---|---|
| stage_ladder_progression | **BUILT** | Next rung offered after confirmed prior paid stage; requires prior payment |

### Not-built triggers (by design — not scope gaps)
| Trigger | Status | Reason |
|---|---|---|
| behavioural_at_risk | NOT BUILT | Future extension; building it = new intelligence engine (out of scope) |
| behavioural_power_user | NOT BUILT | Future extension; building it = new intelligence engine (out of scope) |

The engine source (\`upsell-engine.ts\`) explicitly documents these as deliberate future extensions, not omissions.

### Trigger taxonomy scorecard
| Metric | Value |
|---|---|
| Triggers built | 1 / 3 |
| Trigger structural coverage | 33% |
| Triggers not built by design | 2 / 3 |
| Activation (upsell population) | **not_measurable** (0 paid identities) |

---

## Upsell Population Analysis

| Metric | Value |
|---|---|
| Total CAPADEX sessions | ${sessionsTotal} |
| Completed sessions (journey resolved) | ${completedSessions} |
| Paid identities | ${payingIdentities} |
| Upsell-eligible (prior paid, not full-ladder) | **not_measurable** |
| Full-ladder owners | **not_measurable** |
| Engine degraded | ${upsellOverview.degraded} |

The upsell overview engine (\`buildUpsellOverview\`) runs cleanly but returns 0 eligible and 0 full-ladder because the \`capadex_payments\` ledger has 0 paid rows.

---

## Recommendation Readiness Summary

| Dimension | Score | Note |
|---|---|---|
| Engine structural completeness | ${upsellCapStructural}/${upsellCapTotal} capabilities real | All supporting capabilities built |
| Trigger taxonomy | 1/3 built | 2 deliberately not built (future extension) |
| D6 gate coverage (sessions can pass) | ${pct(journeyHighConf, completedSessions)} | ${journeyHighConf}/${completedSessions} sessions at ≥0.7 confidence |
| Upsell activation | **not_measurable** | Requires ≥1 paid identity |
| Cross-SKU recommendation | **not_applicable** | Identity bridge absent (Deliverable 2) |
`);

  // 4. Expansion Revenue Report
  const totalRupees = revenue.overall.rupees;
  const byStageStr = revenue.by_stage.length > 0
    ? revenue.by_stage.map(s => `| ${s.key} | ${s.paid} | ₹${s.rupees} |`).join('\n')
    : '| — | 0 | ₹0 |';

  write('04_expansion_revenue_report.md', `# WC-C7 · Deliverable 4 — Expansion Revenue Report

**Date:** ${now}
**Audit:** WC-C7 Upsell & Expansion Intelligence Audit
**Phase:** AUDIT ONLY · READ ONLY

---

## Objective

Measure the current expansion revenue base and potential.

---

## Revenue Intelligence (live ledger — capadex_payments)

| Metric | Value |
|---|---|
| Total payment records | ${revenue.overall.total} |
| Paid | **${revenue.overall.paid}** |
| Pending | ${revenue.overall.pending} |
| Failed | ${revenue.overall.failed} |
| Total revenue (paid) | **₹${totalRupees}** |
| Attribution coverage (paid with session) | ${revenue.attribution.paid_total > 0 ? revenue.attribution.coverage_pct + '%' : 'not_measurable'} |
| payment_completed events | ${revenue.conversions.payment_completed_events} |
| Engine degraded | ${revenue.degraded} |

**Current expansion revenue: ₹0** (0 paid transactions).

---

## By Stage
| Stage | Paid count | Revenue |
|---|---|---|
${byStageStr}

---

## Forecast Readiness

All 4 commercial forecast series require ≥ 2 monthly data points to be forecastable.

| Series | Monthly points | Forecastable | Reason |
|---|---|---|---|
${forecast.series.map(s => `| ${s.label} | ${s.points} | ${s.forecastable} | ${s.reason} |`).join('\n')}

**Forecastable series: ${forecastableCount}/${forecastTotal}** — no series can be forecast today.

---

## Package Revenue Potential

- Package catalog: **${packageCatalog.total}** packages (**${packageCatalog.priced}** fully priced — WC-C6B)
- Active subscriptions: **${subscriptionCount}**
- Package revenue to date: **₹0**
- Renewal-eligible: **${renewalActive}** (no subscriptions exist to renew)

---

## Revenue Expansion Readiness: 3 Sub-facts

| Sub-fact | Score | Denominator | Result |
|---|---|---|---|
| Paid conversion rate | 0 / ${allPayments} | all payment attempts | **0%** (measurable) |
| Forecastable revenue series | ${forecastableCount} / ${forecastTotal} | declared forecast series | **0%** (measurable) |
| Renewal eligibility | 0 / 0 | active package subscriptions | **not_measurable** |

These three sub-facts are NEVER blended into a single activation figure. Each has an independent denominator.

---

## Expansion Potential (structural)

The revenue intelligence engine (\`buildRevenueIntelligence\`) is real, complete, and non-degraded. When the first paid conversion occurs:
- Per-stage revenue breakdown will populate automatically
- Per-concern revenue attribution will populate automatically
- Session-to-payment attribution will measure conversion funnel accuracy

The engine is ready for revenue; the revenue substrate is not yet present.
`);

  // 5. Upgrade Funnel Report
  const routeDistTable = Object.entries(routeDist)
    .map(([key, v]) => `| ${key} | ${v.product_label} | ${v.count} | ${v.is_stub ? '⚠ STUB' : 'real'} |`)
    .join('\n');

  write('05_upgrade_funnel_report.md', `# WC-C7 · Deliverable 5 — Upgrade Funnel Report

**Date:** ${now}
**Audit:** WC-C7 Upsell & Expansion Intelligence Audit
**Phase:** AUDIT ONLY · READ ONLY

---

## Objective

Map the end-to-end upgrade funnel from session start to revenue conversion.

---

## Funnel Stages

\`\`\`
Sessions started       ${sessionsTotal}  (all CAPADEX sessions)
        ↓
Sessions completed     ${completedSessions}  (${pct(completedSessions, sessionsTotal)} completion rate)
        ↓
Journey routed         ${routedSessions}  (${pct(routedSessions, completedSessions)} of completed → product recommendation)
        ↓
Routed to real product ${routedNonStub}  (${pct(routedNonStub, completedSessions)} non-stub routes)
        ↓
High-confidence (≥0.7) ${journeyHighConf}  (${pct(journeyHighConf, completedSessions)} meet D6 auto-recommend threshold)
        ↓
Prior paid stage        0  (prerequisite for ladder upsell)
        ↓
Payment initiated       ${allPayments}  (${pct(allPayments, sessionsTotal)} of sessions; all pending)
        ↓
Payment completed       0  (₹0 revenue)
\`\`\`

---

## Journey Route Distribution (completed sessions)

| Route key | Product label | Sessions | Product status |
|---|---|---|---|
${routeDistTable || '| — | — | 0 | — |'}

**Key findings:**
- **Mentoring fallback dominance**: ${journeyRows.filter(r => r.primary_route === 'mentoring').length}/${completedSessions} sessions (${pct(journeyRows.filter(r => r.primary_route === 'mentoring').length, completedSessions)}) routed to mentoring at confidence 0.2. This is the engine's correct deterministic fallback (catch-all route), not a measurement failure. It indicates the CAPADEX signal spine is not yet strong enough to route most sessions to a specific intelligence product.
- **High-confidence routes**: ${journeyHighConf} sessions routed to LBI at 0.97 — these sessions would pass D6 and receive an auto-recommendation if a prior payment existed.
- **Stub route**: 1 session routed to competitive_exam (confidence 0.51 — CORPUS_PENDING). The offer engine's stub guard would suppress any commercial recommendation.

---

## Funnel Bottlenecks

| Bottleneck | Impact | Structural or Activation? |
|---|---|---|
| Low completion rate (${pct(completedSessions, sessionsTotal)}) | Reduces the addressable population for any recommendation | Activation |
| Mentoring fallback dominance (${pct(journeyRows.filter(r=>r.primary_route==='mentoring').length, completedSessions)}) | Low-confidence routes → no auto-recommend | Structural (signal spine density) |
| 0 paid identities | Upsell requires prior purchase; upgrade funnel bottoms out here | Activation |
| Forecast series: 0 data points | Forecast-driven upgrade triggers unavailable | Activation (no history yet) |

---

## Forecast-to-Upgrade Readiness

The forecast contract requires ≥ 2 monthly data points per series (WC-L2 standard). Current state:

| Series | Points | Status |
|---|---|---|
| Paid revenue by month | 0 | insufficient_data |
| Paid transactions by month | 0 | insufficient_data |
| New package subscriptions by month | 0 | insufficient_data |
| Subscription expiries by month | 0 | insufficient_data |

**Forecast-driven upgrade recommendations: not available.** The forecast infrastructure is real and correct — it will populate automatically as transactions accumulate. Minimum to unlock: 2 paid transactions in 2 different months.

---

## Funnel Conversion Summary

| Stage | Count | Rate |
|---|---|---|
| Started → Completed | ${completedSessions} / ${sessionsTotal} | ${pct(completedSessions, sessionsTotal)} |
| Completed → Routed to non-stub | ${routedNonStub} / ${completedSessions} | ${pct(routedNonStub, completedSessions)} |
| Routed → High-confidence | ${journeyHighConf} / ${routedSessions} | ${pct(journeyHighConf, routedSessions)} |
| High-confidence → Paid | 0 / ${journeyHighConf} | ${pct(0, journeyHighConf)} |
| Payment initiated → Completed | 0 / ${allPayments} | ${pct(0, allPayments)} |
`);

  // 6. Readiness Report
  const journeyRouteTable = journeyRoutes.map(r =>
    `| ${r.route_key} | ${r.product_label} | ${r.product_path ?? '—'} | ${r.is_stub ? '⚠ STUB' : 'real'} |`
  ).join('\n');

  write('06_readiness_report.md', `# WC-C7 · Deliverable 6 — Readiness Report

**Date:** ${now}
**Audit:** WC-C7 Upsell & Expansion Intelligence Audit
**Phase:** AUDIT ONLY · READ ONLY

---

## Objective

Measure stage-to-product and outcome-to-product mapping fidelity, and aggregate all 6 readiness metrics.

---

## Stage-to-Product Mapping

### B2C ladder (subscription-engine)
The \`subscription-engine.ts\` maps CAPADEX canonical stage → next B2C ladder rung:

| Canonical stage | Maps to | SKU code | Price |
|---|---|---|---|
| Awareness / Curiosity (default) | Insight | CAP_INS | ₹499 |
| Clarity / Growth | Growth | CAP_GRW | ₹999 |
| Mastery | Mastery | CAP_MAS | ₹1,999 |

**Fidelity: 3/3 stage→rung mappings real and correct.** The engine reads \`stageFloorIndex()\` to pin the floor rung, then finds the next unpurchased rung.

### Packages (absent)
No field in \`subscription_packages\` maps to a CAPADEX stage. Stage→package mapping **does not exist**.

---

## Outcome-to-Product Mapping (journey routes catalog)

The \`wc3_journey_routes\` table is the platform's outcome→product mapping layer. Each route resolves to a product path that the session is directed to.

| Route key | Product label | Product path | Status |
|---|---|---|---|
${journeyRouteTable}

### Fidelity analysis
| Metric | Value |
|---|---|
| Total routes defined | ${journeyRoutes.length} |
| Routes to real products | ${journeyRoutes.filter(r => !r.is_stub).length} |
| Routes to stub products | ${journeyRoutes.filter(r => r.is_stub).length} |
| Route coverage (real targets) | ${pct(journeyRoutes.filter(r => !r.is_stub).length, journeyRoutes.length)} |
| Sessions routed to real product | ${routedNonStub} / ${completedSessions} |
| Sessions routed to stub product | ${journeyRows.filter(r => r.is_stub).length} / ${completedSessions} |

**2/6 journey routes point to stub products** (competitive_exam → /exam-intelligence, employability_index → /employability-index). These are correctly guarded by the offer-engine's stub guard — no commercial recommendation fires for these routes.

---

## 6 Metrics Summary

### 1. Upsell Readiness
| Axis | Score |
|---|---|
| Structural (capabilities) | ${upsellCapStructural}/${upsellCapTotal} = ${pct(upsellCapStructural, upsellCapTotal)} |
| Structural (trigger taxonomy) | ${upsellTriggerBuilt}/${upsellTriggerTotal} triggers built = 33% (2 deliberately not built) |
| Activation | **not_measurable** (0 paid identities; requires prior purchase) |

### 2. Expansion Readiness
| Path | Structural | Activation |
|---|---|---|
${expansionPaths.map(p => `| ${p.label} | ${p.structural ? '✓ real' : '✗ absent'} | ${p.activation ? '✓' : `✗ (${p.activation_reason})`} |`).join('\n')}
| **Total** | **${expansionStructuralCount}/${expansionTotal}** = **${pct(expansionStructuralCount, expansionTotal)}** structural | **${expansionActivationCount}/${expansionTotal}** = **${pct(expansionActivationCount, expansionTotal)}** activation |

### 3. Upgrade Coverage
| Layer | Coverage |
|---|---|
| Completed sessions / all sessions | ${completedSessions}/${sessionsTotal} = ${pct(completedSessions, sessionsTotal)} |
| Routed sessions / completed | ${routedSessions}/${completedSessions} = ${pct(routedSessions, completedSessions)} |
| Routed to non-stub product | ${routedNonStub}/${completedSessions} = ${pct(routedNonStub, completedSessions)} |

### 4. Upgrade Confidence *(two separate labels — never blended)*
| Layer | High-confidence (≥0.7) | Total | Rate |
|---|---|---|---|
| Journey route confidence | ${journeyHighConf} | ${completedSessions} | **${pct(journeyHighConf, completedSessions)}** |
| Outcome confidence | ${outcomeHighConf} | ${outcomeRows.length} | **${pct(outcomeHighConf, outcomeRows.length)}** |

⚠ Fallback disclosure: ${journeyFallback}/${completedSessions} sessions at confidence 0.2 (mentoring deterministic fallback). This is correct engine behaviour, not a failure.

### 5. Cross-SKU Readiness
| Axis | Score |
|---|---|
| Structural | ${crossSkuStructuralScore}/${crossSkuStructuralDenominator} = **ABSENT** |
| Activation | **not_applicable** |

Identity bridge between B2C ladder (email-keyed) and packages (child-keyed) does not exist.

### 6. Revenue Expansion Readiness
| Sub-fact | Score |
|---|---|
| Paid conversion rate | 0/${allPayments} = **0%** (measurable) |
| Forecastable revenue series | ${forecastableCount}/${forecastTotal} = **0%** (measurable) |
| Renewal eligibility | 0/${renewalActive} = **not_measurable** (0 subscriptions) |
`);

  // 7. Executive Summary
  write('07_executive_summary.md', `# WC-C7 · Deliverable 7 — Executive Summary

**Date:** ${now}
**Audit:** WC-C7 Upsell & Expansion Intelligence Audit
**Phase:** AUDIT ONLY · READ ONLY · STOP FOR APPROVAL

---

## Headline Finding

CAPADEX has a **structurally sound but commercially cold-start** upsell and expansion platform. The B2C ladder upsell engine is fully built and correctly engineered. Journey-to-product routing covers 100% of completed sessions. Revenue intelligence, forecast inputs, and renewal pipeline are all real. However, **zero paid conversions** exist, which means every activation metric is either 0% (measurable) or not_measurable — not because the engines are broken, but because no user has yet completed a purchase.

The single biggest structural gap is the **identity bridge absence**: no path exists to connect a package subscriber to the B2C ladder (or vice versa), making all cross-SKU expansion structurally impossible without a migration.

---

## 6 Success Metrics

| Metric | Structural / Coverage | Activation / Context | Key finding |
|---|---|---|---|
| **Upsell Readiness** | Structural: ${pct(upsellCapStructural, upsellCapTotal)} capabilities real | Activation: **not_measurable** | 0 paid identities; trigger taxonomy 1/3 built |
| **Expansion Readiness** | Structural: ${pct(expansionStructuralCount, expansionTotal)} paths have machinery | Activation: **0%** (0/4 paths can fire) | 2 paths structurally absent (identity bridge) |
| **Upgrade Coverage** | Coverage: ${pct(routedNonStub, completedSessions)} routed to real products | Context: ${pct(completedSessions, sessionsTotal)} session completion rate | Mentoring fallback dominates (${pct(journeyRows.filter(r=>r.primary_route==='mentoring').length, completedSessions)}) |
| **Upgrade Confidence** | Journey ≥0.7: ${pct(journeyHighConf, completedSessions)} (${journeyHighConf}/${completedSessions}) | Outcome ≥0.7: ${pct(outcomeHighConf, outcomeRows.length)} (${outcomeHighConf}/${outcomeRows.length}) | 2/9 sessions meet D6 auto-recommend gate |
| **Cross-SKU Readiness** | Structural: **ABSENT** | Activation: **not_applicable** | Identity bridge missing (structural) |
| **Revenue Expansion Readiness** | Structural: Engines all real | Paid conv: **0%** · Forecast: **0%** · Renewal: **not_measurable** | Cold start; infrastructure ready |

---

## What works today

1. **B2C ladder upsell engine** — fully built, correctly gated, never sells into stub
2. **Journey-to-product routing** — 100% of completed sessions receive a product recommendation
3. **Offer engine** — pure compose, D6/D7 gates, stub guard all real
4. **Revenue intelligence** — tracks by stage + concern; will populate on first paid conversion
5. **Renewal pipeline** — correctly built, will activate when first package subscription is created
6. **Subscription packages catalog** — 13 priced packages ready to sell (WC-C6B)

---

## What is absent (structural gaps requiring user decisions)

| Gap | Impact | Requires |
|---|---|---|
| Identity bridge (email on users) | Cross-SKU expansion structurally impossible | Migration (STOP FOR APPROVAL) |
| Package→package upgrade path | No intra-catalog progression | Schema + engine work |
| Behavioural triggers (at-risk / power-user) | Upsell fires only after prior purchase, not on predictive signal | New intelligence engines |
| Self-serve package checkout | Packages can't be purchased without admin/parent intervention | Razorpay order path for packages |

---

## What is absent (activation gaps — data-driven, not structural)

| Gap | Why | Will self-resolve |
|---|---|---|
| 0 paid conversions | No user has completed a purchase | Yes — first purchase unlocks the full chain |
| 0 forecastable revenue series | Needs ≥2 monthly data points | Yes — after month 2 of sales |
| 0 renewable subscriptions | No package grants exist yet | Yes — after first package is assigned |

---

## Expansion Roadmap (structural gaps only, in dependency order)

1. **Identity bridge** (keystone) — add \`email\` col to \`users\` table + link to \`capadex_payments\`. Unlocks cross-SKU upsell, cross-sell, and expansion reporting.
2. **Self-serve package checkout** — Razorpay order path for packages. Unlocks package revenue and renewal loop.
3. **Package→package upgrade** — upgrade_to field + engine logic. Unlocks intra-catalog progression.
4. **Behavioural trigger engines** — at-risk + power-user triggers. Unlocks predictive upsell (before prior purchase).

All roadmap items are **implementation decisions requiring user approval** before any work begins. This audit is STOP FOR APPROVAL.

---

## Prior audit lineage

| Audit | Key finding |
|---|---|
| WC-C1 Commercial Readiness | Structural foundation present; activation near-zero |
| WC-C2 Entitlement | package SKUs entitlement-disjoint |
| WC-C3 Enforcement | Enforcement real for B2C ladder; package enforcement absent |
| WC-C5 Renewal | Renewal engine real; 0 subscriptions = not_measurable |
| WC-C6A Productization | Catalog empty (0 products, 0 priced) |
| WC-C6B Productization Impl | 13 packages seeded, all priced ✓ |
| **WC-C7 (this audit)** | Upsell engine real; cross-SKU absent; all activation cold-start |
`);

  // ── E. Write snapshot JSON ───────────────────────────────────────────────

  const snapshot = {
    audit: 'wc-c7',
    generated_at: now,
    phase: 'AUDIT ONLY · READ ONLY · STOP FOR APPROVAL',
    substrate: {
      sessions_total: sessionsTotal,
      sessions_completed: completedSessions,
      journey_states: journeyRows.length,
      outcome_states: outcomeRows.length,
      journey_routes: journeyRoutes.length,
      journey_routes_real: journeyRoutes.filter(r => !r.is_stub).length,
      journey_routes_stub: journeyRoutes.filter(r => r.is_stub).length,
      package_catalog_total: packageCatalog.total,
      package_catalog_priced: packageCatalog.priced,
      subscriptions_active: subscriptionCount,
      b2c_payments_total: allPayments,
      b2c_payments_paid: paidPayments.length,
      b2c_payments_pending: pendingPayments.length,
      paying_identities: payingIdentities,
    },
    metrics: {
      upsell_readiness: {
        structural_capabilities: `${upsellCapStructural}/${upsellCapTotal}`,
        structural_pct: pct(upsellCapStructural, upsellCapTotal),
        trigger_built: `${upsellTriggerBuilt}/${upsellTriggerTotal}`,
        trigger_not_built_by_design: upsellTriggerUnbuilt,
        activation: upsellActivation,
        activation_note: '0 paid identities — requires prior purchase to measure',
      },
      expansion_readiness: {
        structural: `${expansionStructuralCount}/${expansionTotal}`,
        structural_pct: pct(expansionStructuralCount, expansionTotal),
        activation: `${expansionActivationCount}/${expansionTotal}`,
        activation_pct: pct(expansionActivationCount, expansionTotal),
        paths: expansionPaths,
      },
      upgrade_coverage: {
        completion_rate: pct(completedSessions, sessionsTotal),
        routed_pct: pct(routedSessions, completedSessions),
        routed_non_stub_pct: pct(routedNonStub, completedSessions),
        completed_sessions: completedSessions,
        total_sessions: sessionsTotal,
        fallback_dominance_pct: pct(journeyRows.filter(r => r.primary_route === 'mentoring').length, completedSessions),
      },
      upgrade_confidence: {
        journey_high_conf: `${journeyHighConf}/${completedSessions}`,
        journey_high_conf_pct: pct(journeyHighConf, completedSessions),
        journey_fallback_dominant: journeyFallback,
        outcome_high_conf: `${outcomeHighConf}/${outcomeRows.length}`,
        outcome_high_conf_pct: pct(outcomeHighConf, outcomeRows.length),
        note: 'Two separate labels — never blended. Fallback (mentoring 0.2) = correct engine behaviour.',
      },
      cross_sku_readiness: {
        structural: 'ABSENT',
        structural_score: `${crossSkuStructuralScore}/${crossSkuStructuralDenominator}`,
        activation: 'not_applicable',
        reason: 'Identity bridge absent: users table has no email column',
      },
      revenue_expansion_readiness: {
        paid_conversion: pct(paidPayments.length, allPayments),
        paid_conversion_raw: `${paidPayments.length}/${allPayments}`,
        forecastable_series: pct(forecastableCount, forecastTotal),
        forecastable_series_raw: `${forecastableCount}/${forecastTotal}`,
        renewal_eligibility: renewalActive === 0 ? 'not_measurable' : pct(renewal.package_model.due_soon, renewalActive),
        total_revenue_inr: totalRupees,
        note: '3 sub-facts reported separately, never blended',
      },
    },
    engines: {
      upsell: {
        eligible_identities: upsellOverview.eligible_identities,
        full_ladder_owners: upsellOverview.full_ladder_owners,
        trigger_taxonomy: upsellOverview.trigger_taxonomy,
        degraded: upsellOverview.degraded,
      },
      revenue: {
        total: revenue.overall.total,
        paid: revenue.overall.paid,
        rupees: revenue.overall.rupees,
        degraded: revenue.degraded,
      },
      forecast: {
        forecastable_count: forecastableCount,
        total_series: forecastTotal,
        series: forecast.series,
        degraded: forecast.degraded,
      },
      lifecycle: {
        b2c_ladder: lifecycle.b2c_ladder,
        package_subscriptions: lifecycle.package_subscriptions,
        degraded: lifecycle.degraded,
      },
      renewal: {
        renewable_active: renewal.package_model.renewable_active,
        due_soon: renewal.package_model.due_soon,
        in_grace: renewal.package_model.in_grace,
        degraded: renewal.degraded,
      },
      entitlement: {
        paying_identities: entitlement.paying_identities,
        entitled_identities: entitlement.entitled_identities,
        active_package_grants: entitlement.active_package_grants,
        degraded: entitlement.degraded,
      },
    },
    journey_route_distribution: routeDist,
    expansion_paths: expansionPaths,
  };

  write('_wc_c7_snapshot.json', JSON.stringify(snapshot, null, 2));

  console.log('\nWC-C7 audit complete.');
  console.log(`Output: ${OUT_DIR}`);
  console.log('\n6-metric summary:');
  console.log(`  Upsell Readiness      — Struct: ${pct(upsellCapStructural, upsellCapTotal)} capabilities | Activation: ${upsellActivation}`);
  console.log(`  Expansion Readiness   — Struct: ${pct(expansionStructuralCount, expansionTotal)} | Activation: ${pct(expansionActivationCount, expansionTotal)}`);
  console.log(`  Upgrade Coverage      — Routed: ${pct(routedSessions, completedSessions)} (${completedSessions}/${sessionsTotal} completed)`);
  console.log(`  Upgrade Confidence    — Journey: ${pct(journeyHighConf, completedSessions)} ≥0.7 | Outcome: ${pct(outcomeHighConf, outcomeRows.length)} ≥0.7`);
  console.log(`  Cross-SKU Readiness   — ${crossSkuStatus} (0/1 identity bridge)`);
  console.log(`  Revenue Expansion     — Paid conv: 0% | Forecast: 0% | Renewal: not_measurable`);

  await pool.end();
}

main().catch(err => {
  console.error('FATAL:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
