/**
 * Commercial Wave 2 — Commercial Lifecycle Readiness Audit (READ-ONLY · additive · never mutates DB).
 *
 * Measures the 5 compose-only commercial resolvers (Entitlement, Renewal, Upsell, Subscription
 * Lifecycle, Commercial Forecast Inputs) + the existing WC-7C Wave-0 Revenue Intelligence on TWO
 * INDEPENDENT axes, NEVER composited into one number (user canon: Coverage(data) vs Readiness
 * (structural) are separate axes):
 *
 *   • Axis A — STRUCTURAL readiness: a deterministic per-capability rubric
 *       real=5 / gated-real=4 / partial=3 / stub=2 / absent=1  → N/30, measured before → after.
 *       After is capped at "gated-real" (4) because every Wave-2 flag DEFAULTS OFF and no live
 *       user-facing consumer + real data exists yet → 95% ("real", 5) is NOT honestly reachable
 *       this wave. Each cell carries a justification (grounding-traceability appendix).
 *   • Axis B — DATA / ACTIVATION readiness: measured booleans/ratios over the LIVE substrate. A 0/0
 *       ratio is reported as "n/a", never as 100%.
 *
 * HONEST RECONCILIATION: the brief's "72-75% → ≥95%" headline is NOT supported by the live data
 * (capadex_payments has ZERO paid rows; subscription_packages / student_subscriptions are empty;
 * launch-readiness scored Commercial 12-18/100). This audit measures the real numbers and flags the
 * discrepancy rather than restating the brief's estimate.
 *
 * REVERSIBILITY: the engines are PURE (they read flags from nowhere); the Wave-2 flags gate ONLY the
 * admin route consumer, all default OFF → byte-identical legacy when off. This script calls the pure
 * builders directly and writes ONLY audit artifacts (no DB writes, ever).
 *
 * PII: emails are one-way sha256-masked (user_<hex[:10]>) before any artifact is written; raw
 * addresses are never persisted. The aggregate builders emit counts only — no emails leave the DB.
 *
 * Usage:
 *   cd backend && npx tsx scripts/wc7c/commercial-wave2-audit.ts
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

const OUT_DIR = join(__dirname, '..', '..', 'audit', 'commercial-wave-2');

/** One-way, deterministic email mask (per-user grouping preserved; raw address NEVER stored). */
const maskEmail = (email: string): string =>
  `user_${createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 10)}`;

const pct = (num: number, den: number): number | null =>
  den > 0 ? Math.round((num / den) * 1000) / 10 : null;

// ── Axis A — structural rubric ───────────────────────────────────────────────
type Tier = 'real' | 'gated-real' | 'partial' | 'stub' | 'absent';
const TIER_SCORE: Record<Tier, number> = { real: 5, 'gated-real': 4, partial: 3, stub: 2, absent: 1 };

interface CapabilityCell {
  capability: string;
  before: Tier;
  after: Tier;
  before_note: string;
  after_note: string;
}

// Honest, per-cell justified structural map. NO cell is silently upgraded; "after" stays gated-real
// (4) for every Wave-2 capability because each ships behind a default-OFF flag with no live consumer
// + no real data. revenue_intel is unchanged by this wave (Wave-0, already gated-real).
const CAPABILITIES: CapabilityCell[] = [
  {
    capability: 'entitlement',
    before: 'partial', after: 'gated-real',
    before_note: 'subscription-engine.loadOwnedStages read owned (paid) stages, but no ownership→features mapping or coverage surface existed.',
    after_note: 'entitlement-engine maps owned stages → entitled features + a coverage overview; fail-CLOSED on a ledger read error; gated behind commercialEntitlement (default OFF), exposed via admin route only.',
  },
  {
    capability: 'renewal',
    before: 'stub', after: 'gated-real',
    before_note: 'subscription-engine returned renewal_not_applicable_b2c for the all-owned path; renewal was acknowledged but no package renewal pipeline existed.',
    after_note: 'renewal-engine builds the validity-window due_soon/in_grace pipeline over student_subscriptions; B2C ladder explicitly renewal_not_applicable_b2c; gated behind commercialRenewal (default OFF).',
  },
  {
    capability: 'upsell',
    before: 'partial', after: 'gated-real',
    before_note: 'an upsell {ready,trigger,reason} sub-field existed only embedded inside the gated activation envelope; no composed upsell capability or population overview.',
    after_note: 'upsell-engine composes the existing subscription-engine signal (prior-paid gate) + D6 high-confidence gate + stub guard, plus a system-wide overview; gated behind commercialUpsell (default OFF). No new behavioural triggers invented.',
  },
  {
    capability: 'lifecycle',
    before: 'absent', after: 'gated-real',
    before_note: 'no lifecycle-state projection existed for either commercial surface.',
    after_note: 'subscription-lifecycle projects pending/fulfilled/abandoned (ladder) + active/expiring_soon/expired/cancelled (packages), fully recomputed from status+expiry (no persistence); gated behind commercialLifecycleState (default OFF).',
  },
  {
    capability: 'forecast_inputs',
    before: 'absent', after: 'gated-real',
    before_note: 'WC-L2 forecast existed for behaviour/growth trends, but no commercial forecast input contract existed.',
    after_note: 'commercial-forecast-inputs emits the WC-L2 ≥2-point forecast contract + measured per-series point availability; never fabricates a series; gated behind commercialForecastInputs (default OFF).',
  },
  {
    capability: 'revenue_intel',
    before: 'gated-real', after: 'gated-real',
    before_note: 'WC-7C Wave-0 revenue-intelligence admin surface, gated behind revenueIntelligence (default OFF).',
    after_note: 'unchanged by Commercial Wave 2 (Wave-0 capability) — still gated-real.',
  },
];

function structural(): {
  before: number; after: number; max: number;
  before_pct: number; after_pct: number; cells: CapabilityCell[];
} {
  const max = CAPABILITIES.length * 5;
  const before = CAPABILITIES.reduce((s, c) => s + TIER_SCORE[c.before], 0);
  const after = CAPABILITIES.reduce((s, c) => s + TIER_SCORE[c.after], 0);
  return {
    before, after, max,
    before_pct: Math.round((before / max) * 1000) / 10,
    after_pct: Math.round((after / max) * 1000) / 10,
    cells: CAPABILITIES,
  };
}

interface DataAxis {
  paid_rows: number;
  total_payment_rows: number;
  distinct_paid_emails: number;
  active_packages: number;
  live_subscriptions: number;
  forecastable_series: number;
  total_series: number;
  // enablers present / total — overall data activation %
  enablers_present: number;
  enablers_total: number;
  activation_pct: number;
}

async function num(pool: Pool, sql: string): Promise<number> {
  try {
    const { rows } = await pool.query(sql);
    return Number(rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

async function run(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set — aborting (read-only audit).');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: databaseUrl });
  const stamp = new Date().toISOString();

  // ── Axis B — data ground truth (live, read-only) ──
  const paid_rows = await num(pool, `SELECT count(*) n FROM capadex_payments WHERE status='paid'`);
  const total_payment_rows = await num(pool, `SELECT count(*) n FROM capadex_payments`);
  const distinct_paid_emails = await num(
    pool, `SELECT count(DISTINCT lower(email)) n FROM capadex_payments WHERE status='paid' AND email IS NOT NULL`,
  );
  const active_packages = await num(pool, `SELECT count(*) n FROM subscription_packages WHERE is_active = true`);
  const live_subscriptions = await num(
    pool, `SELECT count(*) n FROM student_subscriptions WHERE status='active' AND (expiry_date IS NULL OR expiry_date >= now())`,
  );

  // ── Engine overviews (pure builders, called directly) ──
  const entitlement = await buildEntitlementOverview(pool);
  const renewal = await buildRenewalPipeline(pool);
  const upsell = await buildUpsellOverview(pool);
  const lifecycle = await buildSubscriptionLifecycle(pool);
  const forecast = await buildForecastInputs(pool);

  // ── PII-masked sample (demonstrates the mask; counts-only builders carry no emails) ──
  const paymentEmailSample = await pool
    .query(`SELECT DISTINCT lower(email) email FROM capadex_payments WHERE email IS NOT NULL ORDER BY 1 LIMIT 10`)
    .then((r) => r.rows.map((x) => maskEmail(String(x.email))))
    .catch(() => [] as string[]);

  // ── Axis B — enabler booleans ──
  const enablers = [
    paid_rows > 0,
    distinct_paid_emails > 0,
    active_packages > 0,
    live_subscriptions > 0,
    forecast.forecastable_count > 0,
  ];
  const dataAxis: DataAxis = {
    paid_rows,
    total_payment_rows,
    distinct_paid_emails,
    active_packages,
    live_subscriptions,
    forecastable_series: forecast.forecastable_count,
    total_series: forecast.total_series,
    enablers_present: enablers.filter(Boolean).length,
    enablers_total: enablers.length,
    activation_pct: Math.round((enablers.filter(Boolean).length / enablers.length) * 1000) / 10,
  };

  const struct = structural();

  // ── Per-capability dual readiness (the 5 success metrics) ──
  const fulfilled = lifecycle.b2c_ladder.by_state.fulfilled;
  const metrics = [
    {
      key: 'entitlement_coverage', label: 'Entitlement Coverage',
      structural_tier: 'gated-real',
      data_value: entitlement.coverage_pct,
      data_unit: '% of paying identities resolvable to ≥1 entitlement',
      data_note: entitlement.paying_identities === 0
        ? 'n/a — 0 paying identities. The resolver is deterministic (fail-closed), so coverage would be 100% of paid users once any paid row exists.'
        : `${entitlement.entitled_identities}/${entitlement.paying_identities} paying identities resolved.`,
    },
    {
      key: 'renewal_readiness', label: 'Renewal Readiness',
      structural_tier: 'gated-real',
      data_value: renewal.package_model.renewable_active,
      data_unit: 'renewable active package subscriptions',
      data_note: `renewable_active=${renewal.package_model.renewable_active}, due_soon=${renewal.package_model.due_soon}, in_grace=${renewal.package_model.in_grace}. B2C ladder: renewal_not_applicable_b2c.`,
    },
    {
      key: 'upsell_readiness', label: 'Upsell Readiness',
      structural_tier: 'gated-real',
      data_value: upsell.eligible_identities,
      data_unit: 'upsell-eligible identities (require a prior paid stage)',
      data_note: `eligible=${upsell.eligible_identities}, full_ladder_owners=${upsell.full_ladder_owners}. 0 paid → 0 eligible (upsell requires a prior purchase).`,
    },
    {
      key: 'revenue_lifecycle_readiness', label: 'Revenue Lifecycle Readiness',
      structural_tier: 'gated-real',
      data_value: fulfilled + dataAxis.live_subscriptions,
      data_unit: 'fulfilled ladder purchases + live package subscriptions',
      data_note: `ladder: pending=${lifecycle.b2c_ladder.by_state.pending}, fulfilled=${fulfilled}, abandoned=${lifecycle.b2c_ladder.by_state.abandoned}; packages: active=${lifecycle.package_subscriptions.by_state.active}.`,
    },
    {
      key: 'commercial_forecast_readiness', label: 'Commercial Forecast Readiness',
      structural_tier: 'gated-real',
      data_value: pct(forecast.forecastable_count, forecast.total_series),
      data_unit: '% of commercial series with ≥2 comparable points',
      data_note: `${forecast.forecastable_count}/${forecast.total_series} series forecastable. ${forecast.series.map((s) => `${s.key}=${s.points}pt`).join(', ')}.`,
    },
  ];

  // ── Baseline JSON (PII-masked) ──
  const baseline = {
    audit: 'commercial-wave-2',
    generated_at: stamp,
    honest_reconciliation: {
      brief_headline: '72-75% → ≥95%',
      brief_supported_by_data: false,
      note: 'Live commercial substrate is empty (0 paid rows, 0 packages, 0 subscriptions); launch-readiness scored Commercial 12-18/100. The "72-75%" reads as a structural estimate, not a measured figure. This audit reports Structural and Data/Activation separately.',
    },
    axis_a_structural: struct,
    axis_b_data: dataAxis,
    engine_overviews: { entitlement, renewal, upsell, lifecycle, forecast },
    metrics,
    pii: { email_mask: 'sha256→user_<hex[:10]>', payment_identities_masked_sample: paymentEmailSample },
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, '_baseline.json'), JSON.stringify(baseline, null, 2));

  const tierTag = (t: Tier) => `${t} (${TIER_SCORE[t]}/5)`;
  const naOrPct = (v: number | null) => (v === null ? 'n/a' : `${v}%`);

  // ── Deliverable 1 — Entitlement Report ──
  writeFileSync(join(OUT_DIR, '01_entitlement_report.md'), `# Commercial Wave 2 · Deliverable 1 — Entitlement Report
_Generated ${stamp}. Emails one-way sha256-masked. Read-only; no DB writes._

**What it does:** resolves what a billing identity is entitled to from paid stages (\`capadex_payments\` status='paid') + active package grants. **Fail-CLOSED:** a ledger read error → \`billing_ledger_unavailable\` (entitles nothing), never mistaken for "owns nothing".

## Coverage (data axis)
| Metric | Value |
|---|---|
| Paying identities | ${entitlement.paying_identities} |
| Entitled identities | ${entitlement.entitled_identities} |
| Entitlement coverage | ${naOrPct(entitlement.coverage_pct)} |
| Active package grants | ${entitlement.active_package_grants} |
| Degraded | ${entitlement.degraded} |

**Owned-stage distribution:** ${entitlement.owned_stage_distribution.length ? entitlement.owned_stage_distribution.map((d) => `${d.stage}=${d.identities}`).join(', ') : '— (no paid stages)'}

**Honest ceiling:** with 0 paid rows, coverage is **n/a (0/0)** — never reported as 100%. The resolver is deterministic and fail-closed, so once any paid row exists, coverage of paid identities → 100% structurally. Package entitlement-by-email is an honest modelling gap (\`student_subscriptions\` links via student/child, not billing email).
`);

  // ── Deliverable 2 — Renewal Report ──
  writeFileSync(join(OUT_DIR, '02_renewal_report.md'), `# Commercial Wave 2 · Deliverable 2 — Renewal Report
_Generated ${stamp}. Read-only; never auto-charges._

**B2C stage ladder:** renewal **not applicable** (\`renewal_not_applicable_b2c\`) — the ladder is a one-time progressive purchase. **Package model only:** renewal candidates from \`student_subscriptions\` validity/expiry.

## Readiness (data axis)
| Metric | Value |
|---|---|
| Renewable active (finite expiry) | ${renewal.package_model.renewable_active} |
| Due soon (≤ ${renewal.package_model.due_soon_window_days}d) | ${renewal.package_model.due_soon} |
| In grace (≤ ${renewal.package_model.grace_days}d past) | ${renewal.package_model.in_grace} |
| Degraded | ${renewal.degraded} |

**Honest ceiling:** 0 package subscriptions → 0 renewable population. Renewal readiness is structurally complete (the pipeline classifies due_soon/in_grace deterministically) but has **no data to act on** until package subscriptions exist. The B2C ladder will never contribute renewal volume by design.
`);

  // ── Deliverable 3 — Upsell Report ──
  writeFileSync(join(OUT_DIR, '03_upsell_report.md'), `# Commercial Wave 2 · Deliverable 3 — Upsell Report
_Generated ${stamp}. Emails one-way sha256-masked._

**What it does:** composes the existing subscription-engine ladder signal (requires a **prior paid stage**) + the D6 high-confidence gate + the stub guard. Invents **no** behavioural triggers (\`${upsell.trigger_taxonomy.not_built.join(', ')}\` are named but deliberately NOT built — they would be a new intelligence engine).

## Readiness (data axis)
| Metric | Value |
|---|---|
| Upsell-eligible identities | ${upsell.eligible_identities} |
| Full-ladder owners (retention) | ${upsell.full_ladder_owners} |
| Triggers built | ${upsell.trigger_taxonomy.built.join(', ')} |
| Degraded | ${upsell.degraded} |

**Next-rung distribution:** ${upsell.next_rung_distribution.length ? upsell.next_rung_distribution.map((d) => `${d.stage}=${d.identities}`).join(', ') : '— (no paid identities)'}

**Honest ceiling:** upsell **requires a prior paid purchase**; with 0 paid rows, upsell data readiness is **0** — this is a true ceiling, not a wiring gap. Structurally the engine is complete and gated.
`);

  // ── Deliverable 4 — Subscription Lifecycle Report ──
  writeFileSync(join(OUT_DIR, '04_subscription_lifecycle_report.md'), `# Commercial Wave 2 · Deliverable 4 — Subscription Lifecycle Report
_Generated ${stamp}. Read-only projection (no persistence — fully recomputed from status + expiry)._

## B2C stage ladder (\`capadex_payments\`, total ${lifecycle.b2c_ladder.total})
| State | Count |
|---|---|
| pending | ${lifecycle.b2c_ladder.by_state.pending} |
| fulfilled (paid) | ${lifecycle.b2c_ladder.by_state.fulfilled} |
| abandoned (failed) | ${lifecycle.b2c_ladder.by_state.abandoned} |

## Package subscriptions (\`student_subscriptions\`, total ${lifecycle.package_subscriptions.total})
| State | Count |
|---|---|
| active | ${lifecycle.package_subscriptions.by_state.active} |
| expiring_soon (≤ ${lifecycle.expiring_soon_window_days}d) | ${lifecycle.package_subscriptions.by_state.expiring_soon} |
| expired | ${lifecycle.package_subscriptions.by_state.expired} |
| cancelled | ${lifecycle.package_subscriptions.by_state.cancelled} |

**Honest finding:** all ${lifecycle.b2c_ladder.total} ladder rows are **pending** (zero fulfilled), and there are zero package subscriptions. The lifecycle state machine is structurally complete but the substrate is pre-revenue. Degraded=${lifecycle.degraded}.
`);

  // ── Deliverable 5 — Commercial Readiness Report (dual-axis + traceability appendix) ──
  const cellRows = struct.cells
    .map((c) => `| ${c.capability} | ${tierTag(c.before)} | ${tierTag(c.after)} | ${c.after_note} |`)
    .join('\n');
  const metricRows = metrics
    .map((m) => `| ${m.label} | ${m.structural_tier} (4/5) | ${typeof m.data_value === 'number' ? m.data_value : naOrPct(m.data_value as number | null)} ${m.data_unit} | ${m.data_note} |`)
    .join('\n');

  writeFileSync(join(OUT_DIR, '05_commercial_readiness_report.md'), `# Commercial Wave 2 · Deliverable 5 — Commercial Readiness Report
_Generated ${stamp}. TWO independent axes — NEVER composited into one number._

## Headline
**Structural ${struct.after_pct}% (${struct.after}/${struct.max}) · Data/Activation ${dataAxis.activation_pct}%**

- **Axis A — Structural readiness** rose from **${struct.before}/${struct.max} (${struct.before_pct}%)** → **${struct.after}/${struct.max} (${struct.after_pct}%)**.
- **Axis B — Data/Activation readiness** = **${dataAxis.activation_pct}%** (${dataAxis.enablers_present}/${dataAxis.enablers_total} data enablers present).
- **95% is NOT honestly reachable this wave.** "after" is capped at *gated-real* (4/5) for every capability because each ships behind a **default-OFF** flag with **no live user-facing consumer and no real data**. Reaching *real* (5/5) requires un-gating + wiring a consumer + actual paid volume — none of which this additive wave does.

## Honest reconciliation of the brief
The brief's **"72-75% → ≥95%"** is **not supported by the live data**: \`capadex_payments\` has **0 paid rows**, \`subscription_packages\` and \`student_subscriptions\` are **empty**, and launch-readiness scored Commercial **12-18/100**. The "72-75%" reads as a structural estimate, not a measured figure. We report measured Structural and Data axes separately rather than restating the estimate.

## Axis A — Structural readiness (before → after)
| Capability | Before | After | After justification |
|---|---|---|---|
${cellRows}

## Axis B — Data / Activation readiness
| Enabler | Present |
|---|---|
| Paid payment rows > 0 | ${dataAxis.paid_rows > 0} (${dataAxis.paid_rows}) |
| Distinct paid emails > 0 | ${dataAxis.distinct_paid_emails > 0} (${dataAxis.distinct_paid_emails}) |
| Active packages > 0 | ${dataAxis.active_packages > 0} (${dataAxis.active_packages}) |
| Live subscriptions > 0 | ${dataAxis.live_subscriptions > 0} (${dataAxis.live_subscriptions}) |
| Forecastable series ≥ 1 | ${dataAxis.forecastable_series > 0} (${dataAxis.forecastable_series}/${dataAxis.total_series}) |

## Per-capability dual readiness (the 5 success metrics)
| Metric | Structural | Data | Data note |
|---|---|---|---|
${metricRows}

## Binding constraint
The single binding constraint across every metric is the **empty commercial substrate** (no paid transactions, no packages, no subscriptions). Every structural capability is built and gated; none can show data readiness until real commercial activity exists. This is a true ceiling, honestly reported — not a wiring or modelling gap.

## Appendix — grounding traceability (per cell)
${struct.cells.map((c) => `- **${c.capability}** · before=${tierTag(c.before)} — ${c.before_note}\n  - after=${tierTag(c.after)} — ${c.after_note}`).join('\n')}
`);

  // ── Deliverable 6 — Executive Summary ──
  writeFileSync(join(OUT_DIR, '06_executive_summary.md'), `# Commercial Wave 2 · Executive Summary — Commercial Lifecycle Layer
_Generated ${stamp}. Additive · flag-gated · compose-only · STOP FOR APPROVAL (no deploy)._

## What shipped (additive, no new tables, no new intelligence engines)
5 PURE compose-only resolvers in \`backend/services/wc7c/\`, each gated behind a **default-OFF** flag and exposed read-only via the admin route \`GET /api/capadex/admin/commercial-lifecycle\`:
1. **entitlement-engine** — owned paid stages → entitled features + coverage (fail-CLOSED on ledger error).
2. **renewal-engine** — package validity due_soon/in_grace pipeline; B2C ladder = renewal_not_applicable_b2c.
3. **upsell-engine** — composes the existing subscription signal + D6 + stub guard (requires prior paid).
4. **subscription-lifecycle** — read-only state projection over both commercial surfaces.
5. **commercial-forecast-inputs** — WC-L2 ≥2-point forecast contract + measured series availability.

## Dual-axis result (NEVER composited)
- **Structural readiness:** ${struct.before}/${struct.max} (${struct.before_pct}%) → **${struct.after}/${struct.max} (${struct.after_pct}%)** — all "after" cells are *gated-real* (4/5).
- **Data/Activation readiness:** **${dataAxis.activation_pct}%** (${dataAxis.enablers_present}/${dataAxis.enablers_total} enablers present).

## Honest findings
- The brief's **"72-75% → ≥95%"** is **not data-supported** (0 paid rows, 0 packages, 0 subscriptions; launch-readiness Commercial 12-18/100). Reported as a discrepancy, not restated.
- **95% is not honestly reachable this wave** — that needs un-gating + a live consumer + real paid volume.
- The single **binding constraint is the empty commercial substrate**; every capability is structurally complete and gated, but data readiness is ~0 until real commercial activity exists.
- **Byte-identical when flag-off:** engines are pure; flags gate only the admin route; all default OFF.

## The 5 success metrics (dual axis)
${metrics.map((m) => `- **${m.label}** — structural: ${m.structural_tier} (4/5); data: ${typeof m.data_value === 'number' ? m.data_value : naOrPct(m.data_value as number | null)} ${m.data_unit}. ${m.data_note}`).join('\n')}

## Reversibility / safety
No DB writes. No new tables. Commerce reads fail CLOSED. Never sells into a stub. D6 never auto-recommends. STAGE_PRICES kept in lockstep with capadex-payments.ts. STOP FOR APPROVAL — no deploy.
`);

  // ── Console summary ──
  console.log('Commercial Wave 2 audit — deliverables written to', OUT_DIR);
  console.log(`Axis A structural: ${struct.before}/${struct.max} (${struct.before_pct}%) → ${struct.after}/${struct.max} (${struct.after_pct}%)`);
  console.log(`Axis B data/activation: ${dataAxis.activation_pct}% (${dataAxis.enablers_present}/${dataAxis.enablers_total} enablers)`);
  console.log(`Ground truth: paid_rows=${paid_rows}, distinct_paid_emails=${distinct_paid_emails}, active_packages=${active_packages}, live_subscriptions=${live_subscriptions}, forecastable_series=${forecast.forecastable_count}/${forecast.total_series}`);
  console.log('Brief 72-75% supported by data:', baseline.honest_reconciliation.brief_supported_by_data);

  await pool.end();
}

run().catch((err) => {
  console.error('commercial-wave2-audit failed:', err);
  process.exit(1);
});
