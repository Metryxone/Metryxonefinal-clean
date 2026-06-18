/**
 * WC-C5 — Renewal Intelligence Audit (AUDIT ONLY · READ-ONLY · recompute from runtime).
 *
 * Determines whether CAPADEX has enough intelligence/history/behavioural/engagement/commercial
 * signal to support subscription RENEWALS and recurring revenue. Reuses WC-L0→WC-C4 + the existing
 * wc7c engines ONLY — NO new model/table/ontology/subscription/pricing. Scores 4 SEPARATE axes
 * (Structural / Activation / Coverage / Confidence) — NEVER combined.
 *
 * Honesty discipline (mirrors WC-C1 / derived-scoring memory + the WC-C5 architect:plan review):
 *   • Dual-axis: Structural% & Activation% are a PAIR, never a single number.
 *   • Structural = deterministic tier map (real 5 · gated-real 4 · partial 3 · stub 2 · absent 1)
 *     over a capability checklist declared UP FRONT incl. the absent items; unexercised path
 *     (0 rows, never ran e2e) capped at gated-real(4), never real(5).
 *   • Activation = per-capability BINARY "can fire on live renewal data NOW?" + reason.
 *   • Coverage = population fractions with eligible-only denominators; 0/0 → not_measurable (null),
 *     NEVER 0% or 100%. `degraded` (read failure) is propagated, never reported as measured-zero.
 *   • Confidence = qualitative band with explicit n — never a fabricated percentage.
 *   • Behavioural substrate (wcl0) is kept OUT of every commercial percentage; behaviour-dim
 *     coverage appears ONLY in Renewal Signal Coverage, explicitly labelled behavioural.
 *   • The single highest-volume identity (≥10 sessions) is reported WITH and WITHOUT (dual view);
 *     "likely test" is unverified and never silently dropped.
 *   • PII (emails) masked to user_<sha256hex[:10]> before any write. Single idempotent generator;
 *     never hand-edit the artifacts.
 */
import { Pool } from 'pg';
import { createHash } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { buildSubscriptionLifecycle } from '../../services/wc7c/subscription-lifecycle';
import { buildRenewalPipeline } from '../../services/wc7c/renewal-engine';
import { buildForecastInputs } from '../../services/wc7c/commercial-forecast-inputs';
import { buildEntitlementOverview } from '../../services/wc7c/entitlement-engine';

const OUT_DIR = join(__dirname, '..', '..', 'audit', 'wc-c5');
const HEAVY_USER_THRESHOLD = 10; // a single identity with ≥10 sessions is reported as a dual-view outlier

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

const pct = (num: number, den: number): { value: number | null; measurable: boolean; numerator: number; denominator: number; reason: string } =>
  den > 0
    ? { value: Math.round((num / den) * 1000) / 10, measurable: true, numerator: num, denominator: den, reason: 'measured' }
    : { value: null, measurable: false, numerator: num, denominator: den, reason: 'not_measurable: empty denominator (0/0)' };

// Deterministic readiness tier map (derived-scoring-audit-honesty.md).
const TIER = { real: 5, gated_real: 4, partial: 3, stub: 2, absent: 1 } as const;
type TierName = keyof typeof TIER;

interface Capability {
  id: string;
  stage: 'A_substrate_lifecycle' | 'B_identification_signal' | 'C_decision_scoring' | 'D_activation';
  label: string;
  tier: TierName;
  evidence: string;
  source: string; // grounding traceability → prior audit / file
}

// ── STRUCTURAL capability checklist (declared up front, incl. absent cells) ─────
const CAPABILITIES: Capability[] = [
  // A — substrate & lifecycle
  { id: 'expiry_validity_tracking', stage: 'A_substrate_lifecycle', label: 'Expiry / validity-window tracking', tier: 'real',
    evidence: 'student_subscriptions.{purchase_date,expiry_date,status} present; subscription_packages.validity_days defines the window.', source: 'schema (WC-C1 §subscription)' },
  { id: 'lifecycle_state_classifier', stage: 'A_substrate_lifecycle', label: 'Lifecycle state classifier (active/expiring_soon/expired/cancelled)', tier: 'real',
    evidence: 'subscription-lifecycle.ts buildSubscriptionLifecycle — deterministic, fully recomputable from status+expiry_date.', source: 'WC-C1 d03/commercial-wave-2' },
  { id: 'package_sales_flow', stage: 'A_substrate_lifecycle', label: 'Package-subscription sales flow (creates the renewable population)', tier: 'gated_real',
    evidence: 'routes.ts package-purchase inserts studentSubscriptions (storage.ts). EXISTS but 0 live rows → unexercised e2e → capped at gated-real, never real.', source: 'WC-C1 commercial-readiness memory (unexercised=unverified)' },
  // B — renewal identification & signal inputs
  { id: 'renewal_candidate_engine', stage: 'B_identification_signal', label: 'Renewal candidate identification (due_soon / in_grace)', tier: 'real',
    evidence: 'renewal-engine.ts buildRenewalPipeline — deterministic (DUE_SOON 14d / GRACE 7d); read-only, NEVER auto-charges.', source: 'WC-C1 d07' },
  { id: 'behaviour_signal_engine', stage: 'B_identification_signal', label: 'Behaviour signal engine (WC-L0 trend inputs)', tier: 'real',
    evidence: 'behaviour-trend-intelligence.ts computes motivation/confidence/risk/engagement/adaptability slopes. Engine exists; its DATA coverage is the Coverage axis, not Structural.', source: 'WC-L0 / WC-L0b' },
  { id: 'longitudinal_value_engine', stage: 'B_identification_signal', label: 'Longitudinal value engine (WC-L1 recurring constructs)', tier: 'real',
    evidence: 'longitudinal-memory.ts recurring_constructs over ≥2 sessions; trend-intelligence.ts session-over-session progression.', source: 'WC-L1' },
  { id: 'forecast_input_contract', stage: 'B_identification_signal', label: 'Commercial forecast input contract (revenue / expiries series)', tier: 'real',
    evidence: 'commercial-forecast-inputs.ts buildForecastInputs measures 4 monthly series vs WC-L2 ≥2-point eligibility; never fabricates a series.', source: 'WC-C1 d09 / WC-L2' },
  // C — renewal decision / scoring
  { id: 'renewal_scoring_composition', stage: 'C_decision_scoring', label: 'Renewal scoring / propensity composition (fuses behaviour+longitudinal+engagement → renewal likelihood)', tier: 'absent',
    evidence: 'No engine composes the WC-L0/L1/engagement signals into a per-identity renewal propensity. Scope item 9 makes this required machinery → counts against Structural.', source: 'grep: no renewal-score/propensity engine' },
  { id: 'retention_cohort_analysis', stage: 'C_decision_scoring', label: 'Commercial retention / churn cohort analysis', tier: 'absent',
    evidence: 'No commercial retention/churn cohort engine. (RIE/benchmark "retention" hits are behavioural intervention, not commercial renewal.)', source: 'grep: no commercial retention engine' },
  // D — renewal activation
  { id: 'entitlement_enforcement_gate', stage: 'D_activation', label: 'Entitlement enforcement gate (renewal-aware access control)', tier: 'gated_real',
    evidence: 'WC-C4 requireEntitlement EXISTS over 14 paid surfaces but flag commercialEntitlementEnforcement is OFF by default → dormant.', source: 'WC-C4' },
  { id: 'renewal_reminder_loop', stage: 'D_activation', label: 'Renewal reminder / notification loop', tier: 'absent',
    evidence: 'renewal candidates surfaced read-only via routes/wc7c-commercial.ts; NO reminder/cron/notification job wired to the renewal-engine output.', source: 'grep: no reminder/cron wired; WC-C1 d07 "reminders MISSING"' },
  { id: 'recurring_or_repurchase_loop', stage: 'D_activation', label: 'Recurring / auto-renew billing OR package-repurchase loop', tier: 'absent',
    evidence: 'renewal-engine NEVER auto-charges; B2C ladder is renewal_not_applicable_b2c by design; no package-repurchase route converts a due_soon/in_grace candidate into a new paid term.', source: 'renewal-engine.ts / subscription-engine.ts; grep: no auto-renew' },
];

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  // 1) Recompute via the EXISTING engines (reuse, never rebuild).
  const lifecycle = await buildSubscriptionLifecycle(pool);
  const renewal = await buildRenewalPipeline(pool);
  const forecast = await buildForecastInputs(pool);
  const entitlement = await buildEntitlementOverview(pool);

  // 2) Recompute renewal-signal coverage data directly from the live substrate.
  const sessByStatus = await q(`SELECT status, count(*)::int n FROM capadex_sessions GROUP BY status`);
  const totalSessions = sessByStatus.rows.reduce((a, r) => a + Number(r.n), 0);

  // Repeat engagement per identity (email). Dual view: full vs excluding the ≥10-session outlier.
  const perEmail = await q<{ e: string; cnt: number }>(
    `SELECT lower(guest_email) e, count(*)::int cnt FROM capadex_sessions WHERE guest_email IS NOT NULL GROUP BY 1`,
  );
  const identities = perEmail.rows.length;
  const repeatIdentities = perEmail.rows.filter((r) => Number(r.cnt) >= 2).length;
  const heavyIdentities = perEmail.rows.filter((r) => Number(r.cnt) >= HEAVY_USER_THRESHOLD).length;
  const identitiesExHeavy = identities - heavyIdentities;
  const repeatExHeavy = perEmail.rows.filter((r) => Number(r.cnt) >= 2 && Number(r.cnt) < HEAVY_USER_THRESHOLD).length;
  const engagementHistogram = perEmail.rows
    .reduce((acc, r) => { acc[r.cnt] = (acc[r.cnt] ?? 0) + 1; return acc; }, {} as Record<number, number>);

  // Paid / subscribed cohort (commercial retention denominators).
  const paidIdentities = entitlement.paying_identities;
  const renewableActive = renewal.package_model.renewable_active;
  // Paid identities that ALSO return (≥2 sessions) — the only behaviour/longitudinal evidence that is
  // RENEWAL-relevant. Data-driven so a re-run after first sales does not understate activation.
  const paidEmails = (await q<{ e: string }>(
    `SELECT DISTINCT lower(email) e FROM capadex_payments WHERE status='paid' AND email IS NOT NULL`,
  )).rows.map((r) => r.e);
  const paidRepeatIdentities = perEmail.rows.filter((r) => paidEmails.includes(r.e) && Number(r.cnt) >= 2).length;

  // Behavioural substrate — wcl0 behaviour-dim coverage (LABELLED behavioural; excluded from all commercial %).
  const wcl0Count = (await q(`SELECT count(*)::int n FROM wcl0_user_intelligence`)).rows[0]?.n ?? 0;
  const wcl0Cols = (await q<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='wcl0_user_intelligence'`,
  )).rows.map((r) => r.column_name);
  const BEHAVIOUR_DIMS = ['motivation', 'confidence', 'risk', 'engagement', 'adaptability'];
  const presentDims = BEHAVIOUR_DIMS.filter((d) => wcl0Cols.includes(d));
  const dimCoverage: { dim: string; non_null: number; total: number; cov: ReturnType<typeof pct> }[] = [];
  for (const d of presentDims) {
    const nn = (await q(`SELECT count(*)::int n FROM wcl0_user_intelligence WHERE "${d}" IS NOT NULL`)).rows[0]?.n ?? 0;
    dimCoverage.push({ dim: d, non_null: Number(nn), total: Number(wcl0Count), cov: pct(Number(nn), Number(wcl0Count)) });
  }

  const degraded = lifecycle.degraded || renewal.degraded || forecast.degraded || entitlement.degraded || !sessByStatus.ok || !perEmail.ok;

  // 3) Axis 1 — STRUCTURAL (deterministic tier map; PAIR with Activation, never combined).
  const tierSum = CAPABILITIES.reduce((a, c) => a + TIER[c.tier], 0);
  const structuralPct = Math.round((tierSum / (CAPABILITIES.length * 5)) * 1000) / 10;

  // 4) Axis 2 — ACTIVATION (per-capability binary "can fire on live renewal data NOW?" + reason).
  const activation = CAPABILITIES.map((c) => {
    let fires = false;
    let reason = '';
    switch (c.id) {
      case 'expiry_validity_tracking':
      case 'lifecycle_state_classifier':
      case 'package_sales_flow':
        fires = lifecycle.package_subscriptions.total > 0;
        reason = fires ? `${lifecycle.package_subscriptions.total} package subscription(s) live` : '0 package subscriptions → nothing to track/classify/sell-against';
        break;
      case 'renewal_candidate_engine':
        fires = renewableActive > 0;
        reason = fires ? `${renewableActive} renewable active` : '0 renewable population → no due_soon/in_grace candidates';
        break;
      case 'behaviour_signal_engine':
      case 'longitudinal_value_engine':
        fires = paidRepeatIdentities > 0;
        reason = fires
          ? `${paidRepeatIdentities} paid identity(ies) with ≥2 sessions → renewal-relevant trend available`
          : `${repeatIdentities}/${identities} identities have ≥2 sessions, but ${paidRepeatIdentities} PAID identities do → no RENEWAL-relevant trend`;
        break;
      case 'forecast_input_contract':
        fires = forecast.forecastable_count > 0;
        reason = fires ? `${forecast.forecastable_count}/${forecast.total_series} series forecastable` : `0/${forecast.total_series} series reach ≥${forecast.min_points} monthly points`;
        break;
      case 'renewal_scoring_composition':
      case 'retention_cohort_analysis':
        fires = false; reason = 'capability absent in code'; break;
      case 'entitlement_enforcement_gate':
        fires = false; reason = 'flag commercialEntitlementEnforcement OFF by default → dormant'; break;
      case 'renewal_reminder_loop':
      case 'recurring_or_repurchase_loop':
        fires = false; reason = 'capability absent in code'; break;
    }
    return { id: c.id, label: c.label, fires, reason };
  });
  const activationFiring = activation.filter((a) => a.fires).length;
  const activationPct = Math.round((activationFiring / activation.length) * 1000) / 10;

  // 5) Axis 3 — COVERAGE (population fractions; eligible-only denominators; 0/0 → not_measurable).
  const coverage = {
    renewable_population: pct(renewableActive, lifecycle.package_subscriptions.total),       // 0/0 → not_measurable
    renewal_candidate: pct(renewal.package_model.due_soon + renewal.package_model.in_grace, renewableActive), // 0/0 → not_measurable
    forecastable_series: pct(forecast.forecastable_count, forecast.total_series),            // 0/4 = 0.0% (measurable)
    entitlement: { value: entitlement.coverage_pct, measurable: entitlement.coverage_pct !== null, numerator: entitlement.entitled_identities, denominator: entitlement.paying_identities, reason: entitlement.coverage_pct === null ? 'not_measurable: 0 paying identities' : 'measured' },
    // behavioural / engagement — LABELLED, excluded from commercial coverage headline
    behavioural_repeat_full: pct(repeatIdentities, identities),                              // 2/5
    behavioural_repeat_ex_outlier: pct(repeatExHeavy, identitiesExHeavy),                    // excl ≥10-session identity
  };

  // 6) Axis 4 — CONFIDENCE (qualitative band + explicit n; never a fabricated %).
  const confidence = {
    band: 'VERY_LOW',
    n: { paid_identities: paidIdentities, package_subscriptions: lifecycle.package_subscriptions.total, renewable_active: renewableActive, repeat_identities: repeatIdentities, heavy_identities_ge10: heavyIdentities, total_identities: identities },
    rationale: 'Zero renewal events have ever occurred (0 paid stages, 0 package subscriptions, 0 renewable population). With no ground truth and n(repeat)=' + repeatIdentities + '/' + identities + ' (' + heavyIdentities + ' a ≥10-session outlier, unverified as test), any renewal/retention inference is unvalidated and directional only.',
  };

  // 7) Success-criteria answers.
  const answers = {
    renewal_readiness: { structural_pct: structuralPct, activation_pct: activationPct, note: 'Reported as a PAIR. Never combined.' },
    renewal_coverage_pct: coverage.renewable_population, // not_measurable (0 renewable population)
    renewal_signal_coverage: {
      over_renewable_population: 'not_measurable (renewable population = 0)',
      forecastable_series_pct: coverage.forecastable_series,
      behavioural_engagement_repeat_full_pct: coverage.behavioural_repeat_full,
      behavioural_engagement_repeat_ex_outlier_pct: coverage.behavioural_repeat_ex_outlier,
    },
    retention_readiness: {
      commercial: 'not_measurable (0 paid/subscribed returning cohort)',
      behavioural_repeat_full_pct: coverage.behavioural_repeat_full,
      behavioural_repeat_ex_outlier_pct: coverage.behavioural_repeat_ex_outlier,
    },
    earliest_recurring_revenue_viability_chain: [
      '1. First PACKAGE sale → an active student_subscription with a finite expiry_date (B2C ladder cannot renew by design).',
      '2. One validity window elapses → renewal-engine surfaces due_soon (≤14d) / in_grace (≤7d) candidates.',
      '3. ≥2 monthly points accrue per series → commercial-forecast-inputs flips a series to forecastable.',
      '4. ≥2 sessions per PAID identity → behaviour/longitudinal continuity becomes renewal-relevant.',
      '5. A reminder→repurchase (or recurring) loop is wired → a candidate can be ACTED on as revenue.',
      'NB: the 6 pending B2C payments are the nearest revenue lever but are one-time (adjacent to renewal, not recurring).',
    ],
    missing_for_90pct: {
      structural: '90% Structural is reachable by ENGINEERING: wire the 3 absent cells (renewal scoring composition, renewal reminder loop, recurring/repurchase loop) and exercise the package sales flow e2e (gated-real→real).',
      activation: '90% Activation CANNOT be granted by an audit or engineering pass — it is a function of real package subscriptions sold and renewed over time (live renewable population, forecastable series, acted-on candidates).',
    },
    highest_leverage_intervention: 'Establish a RENEWABLE POPULATION first — sell package subscriptions (the only model with renewal semantics; the earning B2C ladder is renewal_not_applicable by design). Every downstream renewal signal/score/forecast/retention metric is currently zero-denominated by the empty substrate. The reminder→repurchase loop is the necessary SECOND step — worthless without a population. Sequencing: population, then activation loop.',
  };

  const snapshot = {
    generated_at: new Date().toISOString(),
    audit: 'WC-C5 Renewal Intelligence Audit',
    degraded,
    engines: { lifecycle, renewal, forecast, entitlement },
    runtime: { totalSessions, sessionsByStatus: sessByStatus.rows, identities, repeatIdentities, heavyIdentities, paidRepeatIdentities, engagementHistogram, paidIdentities, renewableActive, wcl0Count, dimCoverage },
    structural: { capabilities: CAPABILITIES, tier_map: TIER, structural_pct: structuralPct },
    activation: { detail: activation, firing: activationFiring, total: activation.length, activation_pct: activationPct },
    coverage,
    confidence,
    answers,
  };

  writeFileSync(join(OUT_DIR, '_wc_c5_snapshot.json'), JSON.stringify(snapshot, null, 2));

  // 8) Deliverables.
  writeDeliverables(snapshot);

  // eslint-disable-next-line no-console
  console.log(`WC-C5 audit complete. Structural=${structuralPct}% · Activation=${activationPct}% · degraded=${degraded}. Artifacts → backend/audit/wc-c5/`);
  await pool.end();
}

// ── deliverable writers ────────────────────────────────────────────────────────
function tierBadge(t: TierName): string { return `${t} (${TIER[t]}/5)`; }
function covCell(c: { value: number | null; measurable: boolean; numerator: number; denominator: number; reason: string }): string {
  return c.measurable ? `${c.value}% (${c.numerator}/${c.denominator})` : `**not_measurable** (${c.numerator}/${c.denominator} — ${c.reason})`;
}

function writeDeliverables(s: any) {
  const ts = s.generated_at;
  const deg = s.degraded ? ' ⚠️ DEGRADED read detected — see snapshot.' : '';

  // 01 — Renewal Readiness Report
  writeFileSync(join(OUT_DIR, '01_renewal_readiness_report.md'), `# WC-C5 · Deliverable 1 — Renewal Readiness Report
_Generated ${ts}. AUDIT ONLY · read-only · recomputed from runtime.${deg}_

## Headline — reported as a PAIR (never combined)
| Axis | Value | What it means |
|---|---|---|
| **Structural Readiness** | **${s.structural.structural_pct}%** | Renewal machinery that EXISTS in code (deterministic tier map over ${s.structural.capabilities.length} capabilities) |
| **Activation Readiness** | **${s.activation.activation_pct}%** | Renewal machinery that can FIRE on live renewal data now (${s.activation.firing}/${s.activation.total}) |
| **Coverage** | ${covCell(s.coverage.renewable_population)} | Renewable population the signals span |
| **Confidence** | **${s.confidence.band}** | Trustworthiness given n (paid=${s.confidence.n.paid_identities}, subs=${s.confidence.n.package_subscriptions}, repeat=${s.confidence.n.repeat_identities}/${s.confidence.n.total_identities}) |

> These four are **orthogonal** and are never averaged into one score. A blended number would hide exactly the gap this audit exists to find: the machinery is largely built but dormant and unsold.

## The honest renewal picture
Renewal machinery is **partially present** (lifecycle classifier, renewal candidate engine, forecast input contract, entitlement resolver/gate, package sales flow) but the **decision** layer (renewal scoring, retention cohort) and the **activation** layer (reminder loop, recurring/repurchase) are **absent**, and the renewable **data substrate is empty** (0 package subscriptions, 0 paid stages, ${s.runtime.renewableActive} renewable population).

The deepest structural finding: **the model that EARNS (B2C stage ladder) cannot renew by design (\`renewal_not_applicable_b2c\`), while the model that CAN renew (validity-window packages) has no live sales.** Recurring revenue is therefore not viable until a renewable population exists AND a reminder→repurchase loop is wired.

## Reconciliation with WC-C1 deliverable 7
WC-C1's renewal report called renewal "**structurally complete**" while its own Capabilities section listed reminders **MISSING** — a latent overclaim. WC-C5 corrects this: renewal is structurally **PARTIAL** (${s.structural.structural_pct}%), because reminders, recurring/repurchase, retention, and renewal scoring are all absent capabilities, not present ones. The recomputed resolver figures (renewable_active=${s.runtime.renewableActive}, due_soon=${s.engines.renewal.package_model.due_soon}, in_grace=${s.engines.renewal.package_model.in_grace}) are consistent.
`);

  // 02 — Subscription Lifecycle Report
  const lc = s.engines.lifecycle;
  writeFileSync(join(OUT_DIR, '02_subscription_lifecycle_report.md'), `# WC-C5 · Deliverable 2 — Subscription Lifecycle Report
_Generated ${ts}. Recomputed via subscription-lifecycle.ts (read-only).${deg}_

## Two commercial surfaces
| Surface | Table | Renewal semantics |
|---|---|---|
| B2C stage ladder | \`capadex_payments\` | **renewal_not_applicable_b2c** — one-time progressive unlocks; a paid rung is permanently fulfilled |
| Package subscriptions | \`student_subscriptions\` | **renewable** — validity-window (\`expiry_date\`); the ONLY model with a renewal concept |

## B2C ladder state (live, recomputed)
- Total rows: **${lc.b2c_ladder.total}** — pending=${lc.b2c_ladder.by_state.pending}, fulfilled(paid)=${lc.b2c_ladder.by_state.fulfilled}, abandoned(failed)=${lc.b2c_ladder.by_state.abandoned}.

## Package subscription state (live, recomputed)
- Total rows: **${lc.package_subscriptions.total}** — active=${lc.package_subscriptions.by_state.active}, expiring_soon=${lc.package_subscriptions.by_state.expiring_soon}, expired=${lc.package_subscriptions.by_state.expired}, cancelled=${lc.package_subscriptions.by_state.cancelled} (window=${lc.expiring_soon_window_days}d).

## Lifecycle capability
- **EXISTS & deterministic** (real, 5/5): \`classifySubscriptionState\` / \`classifyLadderState\` recompute states from \`status\`+\`expiry_date\` with no persistence.
- **Empty substrate**: 0 package subscriptions → the renewable lifecycle has **no rows to transition**. The classifier is correct; it simply has nothing to classify.
`);

  // 03 — Renewal Signal Coverage Report
  const dimRows = s.runtime.dimCoverage.map((d: any) => `| ${d.dim} | ${covCell(d.cov)} |`).join('\n') || '| _(no behaviour dim columns resolved)_ | not_measurable |';
  writeFileSync(join(OUT_DIR, '03_renewal_signal_coverage_report.md'), `# WC-C5 · Deliverable 3 — Renewal Signal Coverage Report
_Generated ${ts}. Coverage = population fractions; eligible-only denominators; 0/0 → not_measurable.${deg}_

## Renewal signal coverage over the RENEWABLE population
The renewable population is **${s.runtime.renewableActive}** (active subscriptions with finite expiry). Every renewal signal measured over that population is therefore **not_measurable (0/0)** — there is no eligible denominator. This is the honest core: we cannot have renewal signal about subscriptions that do not exist.

| Renewal signal (over renewable population) | Coverage |
|---|---|
| Renewable population | ${covCell(s.coverage.renewable_population)} |
| Renewal candidates (due_soon+in_grace) | ${covCell(s.coverage.renewal_candidate)} |
| Forecastable commercial series | ${covCell(s.coverage.forecastable_series)} |
| Entitlement (entitled/paying) | ${covCell(s.coverage.entitlement)} |

## Behavioural / engagement signal coverage (LABELLED — NOT a commercial metric)
These describe the general session population, not the (empty) paid/renewable population, and are kept out of every commercial percentage. Reported as a dual view (full vs excluding the single ≥${HEAVY_USER_THRESHOLD}-session identity, which is unverified as a test account).

| Signal | Full | Excl. ≥${HEAVY_USER_THRESHOLD}-session outlier |
|---|---|---|
| Repeat-identity rate (≥2 sessions) | ${covCell(s.coverage.behavioural_repeat_full)} | ${covCell(s.coverage.behavioural_repeat_ex_outlier)} |

### Behaviour-dim coverage (wcl0_user_intelligence, ${s.runtime.wcl0Count} rows)
| Behaviour dim | Non-null coverage |
|---|---|
${dimRows}

> None of the repeat identities are paid or subscribed, so this behavioural continuity does **not** currently translate into renewal signal — it is potential, not realised.
`);

  // 04 — Renewal Scoring Feasibility Report
  writeFileSync(join(OUT_DIR, '04_renewal_scoring_feasibility_report.md'), `# WC-C5 · Deliverable 4 — Renewal Scoring Feasibility Report
_Generated ${ts}. Can a renewal/propensity score be computed today? Read-only.${deg}_

## Inputs a renewal score would consume — availability
| Input | Engine (exists?) | Live data? |
|---|---|---|
| Behaviour trend (motivation/engagement/…) | behaviour-trend-intelligence.ts ✓ | thin — ${s.runtime.repeatIdentities}/${s.runtime.identities} identities ≥2 sessions, **0 paid** |
| Longitudinal value (recurring constructs) | longitudinal-memory.ts ✓ | thin — needs ≥2 sessions/identity |
| Engagement / retention recency | recomputable from sessions ✓ | ${s.runtime.identities} identities, ${s.runtime.repeatIdentities} returning |
| Forecast contribution (expiries/revenue) | commercial-forecast-inputs.ts ✓ | ${s.engines.forecast.forecastable_count}/${s.engines.forecast.total_series} series forecastable |
| Renewable population (expiry windows) | renewal-engine.ts ✓ | **0** renewable active |

## Feasibility verdict
- **Structural feasibility: PARTIAL.** The input engines exist, but **no composition engine** fuses them into a per-identity renewal propensity (\`renewal_scoring_composition\` = absent, 1/5). Scope item 9's machinery is missing.
- **Data feasibility: NO.** Even if the composition existed, it would have **0 renewable identities** to score and **0 historical renewal events** to calibrate against. A score produced now would be fabricated, not measured.
- **Honest conclusion:** renewal scoring is buildable from existing inputs **once a renewable population and renewal-event history exist** — not before. Building the scorer first would produce a confident-looking but groundless number.
`);

  // 05 — Renewal Activation Report
  const actRows = s.activation.detail.map((a: any) => `| ${a.label} | ${a.fires ? '✅ fires' : '❌ no'} | ${a.reason} |`).join('\n');
  writeFileSync(join(OUT_DIR, '05_renewal_activation_report.md'), `# WC-C5 · Deliverable 5 — Renewal Activation Report
_Generated ${ts}. Activation = per-capability BINARY "can fire on live renewal data NOW?"${deg}_

## Activation Readiness = ${s.activation.activation_pct}% (${s.activation.firing}/${s.activation.total} capabilities can fire)
| Capability | Fires now? | Reason |
|---|---|---|
${actRows}

## Why activation is ${s.activation.activation_pct}%
Activation Readiness is a function of **real subscriptions sold and renewed over time** — it cannot be granted by an audit or an engineering pass. With 0 package subscriptions and 0 renewable population, no renewal capability has anything to act on. Wiring the absent capabilities raises **Structural** readiness; it cannot raise Activation until a renewable population exists.

## The activation gap, concretely
1. **No renewable population** — the package sales flow exists but has never been exercised (0 rows).
2. **No reminder loop** — renewal candidates are surfaced read-only on an admin route; nothing notifies a user or admin to act.
3. **No recurring/repurchase loop** — there is no mechanism to convert a due_soon/in_grace candidate into a new paid term (and the B2C ladder is renewal_not_applicable by design).
`);

  // 06 — Commercial Retention Report
  writeFileSync(join(OUT_DIR, '06_commercial_retention_report.md'), `# WC-C5 · Deliverable 6 — Commercial Retention Report
_Generated ${ts}. Retention measured separately for commercial vs behavioural; never combined.${deg}_

## Commercial retention (paid / subscribed cohort)
- Paying identities: **${s.runtime.paidIdentities}**. Active package subscriptions: **${s.engines.lifecycle.package_subscriptions.total}**.
- **Retention Readiness (commercial): not_measurable** — there is no paid/subscribed returning cohort to measure retention or churn over. A retention rate computed over 0 paid identities would be fabricated.

## Behavioural retention (general session population — LABELLED, not commercial)
- Distinct identities: **${s.runtime.identities}**; returning (≥2 sessions): **${s.runtime.repeatIdentities}** → ${covCell(s.coverage.behavioural_repeat_full)}.
- Excluding the single ≥${HEAVY_USER_THRESHOLD}-session identity (unverified test): ${covCell(s.coverage.behavioural_repeat_ex_outlier)}.
- Session engagement histogram (sessions→#identities): ${JSON.stringify(s.runtime.engagementHistogram)}.

## Honest note
Behavioural repeat engagement is **not** commercial retention: none of the returning identities are paid or subscribed. It signals that some users return, which is a precondition for retention, but it does not constitute recurring-revenue retention.
`);

  // 07 — Coverage Gap Analysis
  const grounding = s.structural.capabilities.map((c: any) => `| ${c.id} | ${c.stage} | ${tierBadge(c.tier)} | ${c.source} |`).join('\n');
  writeFileSync(join(OUT_DIR, '07_coverage_gap_analysis.md'), `# WC-C5 · Deliverable 7 — Coverage Gap Analysis
_Generated ${ts}. What is missing, and which axis each gap belongs to.${deg}_

## Structural capability checklist (deterministic tier map · grounding traceability)
| Capability | Pipeline stage | Tier | Grounding source |
|---|---|---|---|
${grounding}

**Structural Readiness = mean(tier)/5 = ${s.structural.structural_pct}%.**

## Gaps by axis (never combined)
### Structural gaps (closable by engineering)
- \`renewal_scoring_composition\` — absent. Compose existing WC-L0/L1/engagement inputs into a per-identity renewal propensity.
- \`renewal_reminder_loop\` — absent. Wire a reminder/notification job to the existing renewal-engine candidate output.
- \`recurring_or_repurchase_loop\` — absent. A package-repurchase path (or recurring billing) converting a candidate into a new paid term.
- \`package_sales_flow\` / \`entitlement_enforcement_gate\` — gated-real. Exercise the sales flow e2e and enable enforcement to move toward real.

### Activation gaps (NOT closable by engineering — require real revenue over time)
- 0 renewable population, 0 forecastable series, 0 renewal events. These resolve only as real package subscriptions are sold and renewed.

### Coverage gaps
- Every renewal-population coverage is **not_measurable (0/0)**; behavioural repeat coverage is ${covCell(s.coverage.behavioural_repeat_full)} but does not translate to renewal coverage (0 paid).

### Confidence gap
- Band **${s.confidence.band}** — no renewal ground truth exists; any inference is directional.

## What is missing to reach 90% Renewal Readiness
- **90% Structural** (reachable by engineering): ${s.answers.missing_for_90pct.structural}
- **90% Activation** (NOT reachable by audit/engineering): ${s.answers.missing_for_90pct.activation}
`);

  // 08 — Executive Summary
  writeFileSync(join(OUT_DIR, '08_executive_summary.md'), `# WC-C5 · Deliverable 8 — Executive Summary
_Generated ${ts}. WC-C5 Renewal Intelligence Audit — AUDIT ONLY · read-only · recomputed from runtime.${deg}_

## Question
Does CAPADEX currently possess enough intelligence, history, behavioural evidence, engagement signal, and commercial signal to support subscription **renewals** and **recurring revenue**?

## Answer (4 separate axes — never combined)
| Axis | Result |
|---|---|
| **Structural Readiness** | **${s.structural.structural_pct}%** — most renewal parts exist; decision (scoring/retention) + activation (reminder/recurring) layers are absent |
| **Activation Readiness** | **${s.activation.activation_pct}%** — nothing can fire: 0 renewable population, 0 forecastable series, 0 renewal events |
| **Coverage** | renewable population ${covCell(s.coverage.renewable_population)}; renewal coverage **not_measurable** |
| **Confidence** | **${s.confidence.band}** — no renewal ground truth (paid=${s.confidence.n.paid_identities}, subs=${s.confidence.n.package_subscriptions}) |

## Success criteria
- **Current Renewal Readiness:** Structural **${s.structural.structural_pct}%** / Activation **${s.activation.activation_pct}%** (pair, not blended).
- **Current Renewal Coverage:** **not_measurable** — renewable population = ${s.runtime.renewableActive} (0/0).
- **Current Renewal Signal Coverage:** **not_measurable** over the renewable population; forecastable series ${covCell(s.coverage.forecastable_series)}; behavioural/engagement repeat ${covCell(s.coverage.behavioural_repeat_full)} (labelled, not commercial).
- **Current Retention Readiness:** commercial **not_measurable** (0 paid cohort); behavioural repeat ${covCell(s.coverage.behavioural_repeat_full)}.
- **Earliest point recurring revenue becomes viable:** a precondition CHAIN, not a date —
${s.answers.earliest_recurring_revenue_viability_chain.map((x: string) => '   - ' + x).join('\n')}
- **What is missing to reach 90% Renewal Readiness:**
   - Structural: ${s.answers.missing_for_90pct.structural}
   - Activation: ${s.answers.missing_for_90pct.activation}
- **Highest-leverage intervention:** ${s.answers.highest_leverage_intervention}

## Bottom line
The renewal **engines are real but dormant over an empty substrate**, and two activation layers (reminders, recurring/repurchase) plus the decision layer (scoring, retention) do not exist. The single structural truth that frames everything: **the model that earns cannot renew, and the model that can renew has no sales.** Recurring revenue becomes viable only after a renewable population is established (highest-leverage intervention) and a reminder→repurchase loop is wired. No implementation, schema change, or deployment was performed.
`);
}

main().catch(async (e) => {
  // eslint-disable-next-line no-console
  console.error('WC-C5 audit failed:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
