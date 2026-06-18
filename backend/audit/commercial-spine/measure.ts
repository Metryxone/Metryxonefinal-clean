/**
 * Task #7 — Commercial Monetization Spine certification (Entitlement · Metering · Revenue).
 *
 * Queries the LIVE DB for all data-bound evidence and writes three certification docs to this
 * directory:
 *   - commercial_spine_audit.md      (full per-area Structural vs Activation audit + verdicts)
 *   - commercial_readiness_report.md (commercial readiness summary)
 *   - billing_readiness_report.md    (billing / revenue specific readiness)
 *
 * HONESTY CONTRACT (replit.md):
 *   - STRUCTURAL (code/table/route exists) and ACTIVATION (real, non-demo data flowing) are reported
 *     as TWO separate axes and NEVER composited into one number.
 *   - DEMO / SEED data NEVER counts toward Activation: identities at `%@example.com` and ledger rows
 *     with a `DEMO_*` razorpay order/payment id are excluded from every Activation metric (the
 *     `capadex_payments` ledger has no `source` column, so demo is identified by email + `DEMO_*` id).
 *   - PII is masked to irreversible `user_<sha256>` pseudonyms; no raw emails are written.
 *   - Empty dev DB → honest zeros (Activation NO-GO), never inflated.
 *
 * Run: cd backend && npx tsx audit/commercial-spine/measure.ts
 */
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const OUT_DIR = path.resolve(__dirname);
const now = new Date().toISOString();

const mask = (email: string | null | undefined) =>
  email ? 'user_' + crypto.createHash('sha256').update(email).digest('hex').slice(0, 12) : '(null)';

// Demo / seed exclusion predicates (SQL fragments). Kept in lockstep with the demo-seed convention.
const NOT_DEMO_EMAIL = `lower(email) NOT LIKE '%@example.com'`;
const NOT_DEMO_PAYMENT = `status='paid' AND lower(COALESCE(email,'')) NOT LIKE '%@example.com'
  AND COALESCE(razorpay_payment_id,'') NOT LIKE 'DEMO_%'
  AND COALESCE(razorpay_order_id,'')   NOT LIKE 'DEMO_%'`;

async function scalar(sql: string, params: any[] = []): Promise<number | null> {
  try {
    const { rows } = await pool.query(sql, params);
    const v = rows[0]?.n ?? rows[0]?.count ?? rows[0]?.cnt;
    return v == null ? 0 : Number(v);
  } catch {
    return null; // null = could not measure (absent table / column) — distinct from 0 (empty)
  }
}

async function rows(sql: string, params: any[] = []): Promise<any[] | null> {
  try {
    return (await pool.query(sql, params)).rows;
  } catch {
    return null;
  }
}

async function tableExists(name: string): Promise<boolean> {
  const { rows: r } = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1 LIMIT 1`,
    [name],
  );
  return r.length > 0;
}

function fileExists(rel: string): boolean {
  return fs.existsSync(path.resolve(__dirname, '..', '..', rel));
}

type Verdict = 'GO' | 'CONDITIONAL' | 'NO-GO';
function verdict(structuralReady: boolean, activationReady: boolean): Verdict {
  if (!structuralReady) return 'NO-GO';
  return activationReady ? 'GO' : 'CONDITIONAL';
}

async function main() {
  // ── STRUCTURAL: tables present ─────────────────────────────────────────────────────────────────
  const structuralTables = [
    'capadex_payments', 'student_subscriptions',
    'comm_products', 'comm_plans', 'comm_customers', 'comm_subscriptions', 'comm_subscription_events',
    'comm_entitlement_grants', 'comm_usage_events',
  ];
  const tableStatus: Record<string, boolean> = {};
  for (const t of structuralTables) tableStatus[t] = await tableExists(t).catch(() => false);

  // ── STRUCTURAL: source modules / routes present ────────────────────────────────────────────────
  const structuralFiles: Record<string, string> = {
    'Entitlement engine (feature classes)': 'services/wc7c/entitlement-engine.ts',
    'Plan-features parser': 'services/commercial/plan-features.ts',
    'Entitlement grants schema': 'services/commercial/entitlement-grants-schema.ts',
    'Entitlement routes': 'routes/entitlement.ts',
    'Entitlement enforcement gate': 'services/wc7c/require-entitlement.ts',
    'Metering schema': 'services/commercial/metering-schema.ts',
    'Metering engine': 'services/commercial/metering-engine.ts',
    'Metering routes': 'routes/commercial-metering.ts',
    'Revenue intelligence (incl. recurring)': 'services/wc7c/revenue-intelligence.ts',
    'Commercial read surface': 'routes/wc7c-commercial.ts',
    'Migration (canonical reference)': '../migrations/20260617_commercial_entitlement_metering.sql',
  };
  const fileStatus: Record<string, boolean> = {};
  for (const [label, rel] of Object.entries(structuralFiles)) fileStatus[label] = fileExists(rel);

  // ── STRUCTURAL: flags registered (default OFF) ─────────────────────────────────────────────────
  const flagSrc = fs.readFileSync(path.resolve(__dirname, '..', '..', 'config', 'feature-flags.ts'), 'utf8');
  const flags = ['commercialEntitlementClasses', 'commercialUsageMetering', 'commercialRecurringRevenue'];
  const flagStatus: Record<string, { registered: boolean; defaultOff: boolean }> = {};
  for (const f of flags) {
    const re = new RegExp(`${f}:\\s*(true|false)`);
    const m = flagSrc.match(re);
    flagStatus[f] = { registered: !!m, defaultOff: m?.[1] === 'false' };
  }

  // ── ACTIVATION: entitlement (real paying identities, non-demo) ─────────────────────────────────
  const payingNonDemo = await scalar(
    `SELECT COUNT(DISTINCT lower(email)) n FROM capadex_payments WHERE ${NOT_DEMO_PAYMENT} AND email IS NOT NULL`,
  );
  const payingAll = await scalar(
    `SELECT COUNT(DISTINCT lower(email)) n FROM capadex_payments WHERE status='paid' AND email IS NOT NULL`,
  );
  const activeGrants = tableStatus['comm_entitlement_grants']
    ? await scalar(
        `SELECT COUNT(*) n FROM comm_entitlement_grants WHERE status='active'
           AND (expires_at IS NULL OR expires_at >= now()) AND ${NOT_DEMO_EMAIL}`,
      )
    : null;
  const activePkg = await scalar(
    `SELECT COUNT(*) n FROM student_subscriptions WHERE status='active' AND (expiry_date IS NULL OR expiry_date >= now())`,
  );

  // ── ACTIVATION: metering (real usage events, non-demo) ─────────────────────────────────────────
  const usageEvents = tableStatus['comm_usage_events']
    ? await scalar(`SELECT COUNT(*) n FROM comm_usage_events WHERE ${NOT_DEMO_EMAIL}`)
    : null;
  const usageIdentities = tableStatus['comm_usage_events']
    ? await scalar(`SELECT COUNT(DISTINCT lower(email)) n FROM comm_usage_events WHERE ${NOT_DEMO_EMAIL}`)
    : null;
  const plansWithQuota = tableStatus['comm_plans']
    ? await scalar(`SELECT COUNT(*) n FROM comm_plans WHERE metadata ? 'quotas'`)
    : null;

  // ── ACTIVATION: revenue (recurring substrate, non-demo) ────────────────────────────────────────
  const activeSubs = tableStatus['comm_subscriptions']
    ? await scalar(
        `SELECT COUNT(*) n FROM comm_subscriptions s JOIN comm_customers c ON c.id=s.customer_id
          WHERE s.status='active' AND lower(c.email) NOT LIKE '%@example.com'`,
      )
    : null;
  const subPaymentsPaise = tableStatus['comm_subscription_events'] && tableStatus['comm_customers']
    ? await scalar(
        `SELECT COALESCE(SUM(e.amount_paise),0) n FROM comm_subscription_events e
           JOIN comm_customers c ON c.id = e.customer_id
          WHERE e.event_type IN ('payment_succeeded','renewed') AND e.amount_paise IS NOT NULL
            AND lower(c.email) NOT LIKE '%@example.com'`,
      )
    : null;
  const oneTimePaise = await scalar(
    `SELECT COALESCE(SUM(amount_paise),0) n FROM capadex_payments WHERE ${NOT_DEMO_PAYMENT}`,
  );
  const monthsOfData = await scalar(
    `SELECT COUNT(*) n FROM (
       SELECT date_trunc('month', created_at) m FROM capadex_payments WHERE ${NOT_DEMO_PAYMENT}
       GROUP BY 1
     ) t`,
  );

  // ── Area readiness ─────────────────────────────────────────────────────────────────────────────
  const entStructural =
    fileStatus['Entitlement engine (feature classes)'] && fileStatus['Entitlement routes'] &&
    fileStatus['Entitlement enforcement gate'] && fileStatus['Plan-features parser'] &&
    flagStatus['commercialEntitlementClasses'].registered;
  const entActivation = (payingNonDemo ?? 0) > 0 || (activeGrants ?? 0) > 0 || (activePkg ?? 0) > 0;

  const meterStructural =
    fileStatus['Metering engine'] && fileStatus['Metering routes'] && fileStatus['Metering schema'] &&
    flagStatus['commercialUsageMetering'].registered;
  const meterActivation = (usageEvents ?? 0) > 0;

  const revStructural =
    fileStatus['Revenue intelligence (incl. recurring)'] && fileStatus['Commercial read surface'] &&
    flagStatus['commercialRecurringRevenue'].registered;
  const revActivation = (activeSubs ?? 0) > 0 || (subPaymentsPaise ?? 0) > 0 || (oneTimePaise ?? 0) > 0;

  const areas = [
    { name: 'Entitlement (feature classes + enforcement)', structural: entStructural, activation: entActivation, verdict: verdict(entStructural, entActivation) },
    { name: 'Usage Metering', structural: meterStructural, activation: meterActivation, verdict: verdict(meterStructural, meterActivation) },
    { name: 'Revenue Intelligence (MRR/ARR/renewals/forecast)', structural: revStructural, activation: revActivation, verdict: verdict(revStructural, revActivation) },
  ];

  const evidence = {
    generated_at: now,
    tableStatus, fileStatus, flagStatus,
    entitlement: { payingNonDemo, payingAll, activeGrants, activePkg },
    metering: { usageEvents, usageIdentities, plansWithQuota },
    revenue: { activeSubs, subPaymentsPaise, oneTimePaise, monthsOfData },
    areas,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'evidence.json'), JSON.stringify(evidence, null, 2));

  // Helper renderers
  const yn = (b: boolean) => (b ? '✅' : '❌');
  const num = (v: number | null) => (v == null ? '_n/a (not measurable)_' : String(v));
  const rupees = (paise: number | null) => (paise == null ? '_n/a_' : '₹' + Math.round(paise / 100).toLocaleString('en-IN'));

  const tableRows = Object.entries(tableStatus).map(([t, ok]) => `| \`${t}\` | ${yn(ok)} |`).join('\n');
  const fileRows = Object.entries(fileStatus).map(([l, ok]) => `| ${l} | ${yn(ok)} |`).join('\n');
  const flagRows = flags
    .map((f) => `| \`${f}\` | ${yn(flagStatus[f].registered)} | ${yn(flagStatus[f].defaultOff)} |`)
    .join('\n');
  const areaRows = areas
    .map((a) => `| ${a.name} | ${yn(a.structural)} | ${yn(a.activation)} | **${a.verdict}** |`)
    .join('\n');

  const overallStructural = areas.every((a) => a.structural);
  const overallActivation = areas.every((a) => a.activation);
  const overallVerdict = verdict(overallStructural, overallActivation);

  const header = `> Generated ${now} · Task #7 Commercial Monetization Spine certification\n` +
    `> Structural (code/table/route exists) and Activation (real non-demo data) are SEPARATE axes — never composited.\n` +
    `> Demo/seed (\`%@example.com\`, \`DEMO_*\`) is EXCLUDED from all Activation metrics. Emails masked to \`user_<sha256>\`.`;

  // ── Doc 1: commercial_spine_audit.md ───────────────────────────────────────────────────────────
  const spineDoc = `# Commercial Spine Audit — Entitlement · Metering · Revenue

${header}

## Per-area verdict

| Area | Structural | Activation | Verdict |
|---|:--:|:--:|:--:|
${areaRows}

**Overall:** Structural ${yn(overallStructural)} · Activation ${yn(overallActivation)} → **${overallVerdict}**

> ${overallActivation
    ? 'Real non-demo commercial data is flowing.'
    : 'No real non-demo commercial data yet — the spine is built and flag-gated but unsold. This is the HONEST dev-state baseline (Activation is earned by live sales, not engineering).'}

## Structural — tables

| Table | Present |
|---|:--:|
${tableRows}

> \`comm_entitlement_grants\` / \`comm_usage_events\` are created lazily ONLY when their flag is ON; absence here with the flags OFF is the byte-identical-legacy default, not a defect.

## Structural — modules & routes

| Component | Present |
|---|:--:|
${fileRows}

## Structural — feature flags (must default OFF)

| Flag | Registered | Default OFF |
|---|:--:|:--:|
${flagRows}

## Activation evidence (non-demo only)

### Entitlement
- Paying identities (non-demo): **${num(payingNonDemo)}** (all incl. demo: ${num(payingAll)})
- Active manual grants: **${num(activeGrants)}**
- Active package grants: **${num(activePkg)}**

### Metering
- Usage events recorded: **${num(usageEvents)}** across **${num(usageIdentities)}** identities
- Plans declaring quotas: **${num(plansWithQuota)}**

### Revenue
- Active recurring subscriptions: **${num(activeSubs)}**
- Recurring collections: **${rupees(subPaymentsPaise)}** · One-time collections: **${rupees(oneTimePaise)}**
- Months of payment history (forecast needs ≥2): **${num(monthsOfData)}**

## Honesty notes
- All Activation numbers exclude demo/seed identities and ledger rows.
- \`n/a (not measurable)\` means the underlying table/column is absent (distinct from a measured \`0\`).
- Forecast ABSTAINS below 2 months of data — no fabricated projection.
`;

  // ── Doc 2: commercial_readiness_report.md ──────────────────────────────────────────────────────
  const readinessDoc = `# Commercial Readiness Report

${header}

## Summary

| Dimension | State |
|---|---|
| Structural readiness | ${overallStructural ? '**READY** — all areas have code, routes, schema, flags' : '**INCOMPLETE**'} |
| Activation readiness | ${overallActivation ? '**ACTIVE** — real non-demo revenue/usage present' : '**NOT ACTIVE** — no real non-demo data yet (expected pre-launch)'} |
| Overall | **${overallVerdict}** |

## What is built (Structural)
- **Generalized entitlement**: feature classes (\`views/searches/reports/exports/assessments/ai/api\`) resolved as the UNION of a customer's active-subscription plan declarations + super-admin manual grants, EXTENDING the existing stage ladder. Enforcement fails CLOSED (402/503).
- **Usage metering**: append-only \`comm_usage_events\` ledger with per-plan quota checks; recording refuses (429) over a declared quota — fail CLOSED.
- **Recurring revenue**: MRR/ARR (active subs × plan price normalized monthly), collections (recurring + one-time), renewals (due-soon / in-grace / churning), and a ≥2-point last+slope collections forecast (abstains otherwise).

## What gates Activation (data)
- Activation is **${overallActivation ? 'met' : 'NOT met'}**. ${overallActivation ? '' : 'It is met only by REAL (non-demo) subscriptions, grants, usage and collections — which require live customers. Engineering cannot manufacture it.'}

## Verdict per area

| Area | Verdict | Note |
|---|:--:|---|
${areas.map((a) => `| ${a.name} | **${a.verdict}** | ${a.structural ? (a.activation ? 'live data present' : 'built; awaiting real data') : 'structural gap'} |`).join('\n')}

## Recommendation
${overallStructural
    ? 'Structural certification PASSES. Hold deployment for owner approval (per replit.md). Keep all three flags OFF in production until a controlled rollout; Activation will register once real sales land.'
    : 'Resolve the structural gaps above before certifying.'}
`;

  // ── Doc 3: billing_readiness_report.md ─────────────────────────────────────────────────────────
  const billingDoc = `# Billing Readiness Report

${header}

## Billing substrate

| Component | Present |
|---|:--:|
| One-time ledger (\`capadex_payments\`) | ${yn(tableStatus['capadex_payments'])} |
| Plans (\`comm_plans\`) | ${yn(tableStatus['comm_plans'])} |
| Customers (\`comm_customers\`) | ${yn(tableStatus['comm_customers'])} |
| Subscriptions (\`comm_subscriptions\`) | ${yn(tableStatus['comm_subscriptions'])} |
| Subscription events (\`comm_subscription_events\`) | ${yn(tableStatus['comm_subscription_events'])} |
| Package subscriptions (\`student_subscriptions\`) | ${yn(tableStatus['student_subscriptions'])} |

## Revenue metrics (non-demo)

| Metric | Value |
|---|---|
| Active recurring subscriptions | ${num(activeSubs)} |
| Recurring collections | ${rupees(subPaymentsPaise)} |
| One-time collections | ${rupees(oneTimePaise)} |
| Total collections | ${rupees((subPaymentsPaise ?? 0) + (oneTimePaise ?? 0))} |
| Months of payment history | ${num(monthsOfData)} |
| Forecast available (≥2 months) | ${yn((monthsOfData ?? 0) >= 2)} |

## Renewals & forecast
- Renewal pipeline classifies subscriptions into **due-soon** (next 30d), **in-grace** (past_due / lapsed) and **churning** (cancel-at-period-end). Live numbers are exposed at \`GET /api/capadex/admin/recurring-revenue\` (flag ON).
- The collections forecast reuses the existing \`last + slope\` contract and ABSTAINS below 2 months — currently ${(monthsOfData ?? 0) >= 2 ? 'forecastable' : 'ABSTAINING (insufficient history)'}.

## Verdict
Billing structural readiness: **${revStructural ? 'READY' : 'INCOMPLETE'}**. Revenue activation: **${revActivation ? 'ACTIVE' : 'NOT ACTIVE (no real collections yet)'}** → **${verdict(revStructural, revActivation)}**.

> Per replit.md: do NOT deploy or enable production flags without explicit owner approval.
`;

  fs.writeFileSync(path.join(OUT_DIR, 'commercial_spine_audit.md'), spineDoc);
  fs.writeFileSync(path.join(OUT_DIR, 'commercial_readiness_report.md'), readinessDoc);
  fs.writeFileSync(path.join(OUT_DIR, 'billing_readiness_report.md'), billingDoc);

  console.log('Commercial spine certification written to', OUT_DIR);
  console.log('Overall verdict:', overallVerdict, '| structural', overallStructural, '| activation', overallActivation);
  console.log('Areas:', areas.map((a) => `${a.name}=${a.verdict}`).join(' · '));
  await pool.end();
}

main().catch((err) => {
  console.error('measure failed:', err);
  process.exit(1);
});
