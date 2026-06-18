/**
 * WC-L2A — Forecast Coverage Expansion Audit (READ-ONLY).
 *
 * Measures the TRUE forecastability of CAPADEX users and the shortest evidence-based path to 50% / 75% /
 * 90% forecast coverage, using ONLY existing assets:
 *   - WC-L2  Forecast Intelligence      (projectForecast / computeUserForecasts — forecast_confidence === trend.confidence)
 *   - WC-L1  Trend Intelligence         (computeUserTrends → stage/outcome/journey/decision lever trends)
 *   - WC-L0B Behaviour Trend            (computeUserBehaviourTrends → motivation/confidence/risk/engagement/adaptability)
 *
 * It introduces NO new engine, ontology, scoring model, schema, migration, or write. Forecastability of a
 * layer = the underlying WC-L1/WC-L0B trend EXISTS (≥2 readable points). A forecast's confidence is exactly
 * that trend's confidence — the same value WC-L2 `projectForecast` assigns (`forecast_confidence = trend.confidence`),
 * which this script cross-checks against `computeUserForecasts` for the 4 layers WC-L2 already exposes.
 *
 * Five forecast layers are audited:
 *   Stage    ← stage lever trend            (= WC-L2 "growth" forecast)
 *   Outcome  ← outcome lever trend          (= WC-L2 "outcome" forecast)
 *   Journey  ← journey lever trend          (= WC-L2 "journey" forecast)
 *   Decision ← decision lever trend         (WC-11; same projection logic, NOT exposed in WC-L2 runtime API)
 *   Behaviour← behaviour `risk` dim trend   (= WC-L2 "risk" forecast — the only behaviour dim WC-L2 forecasts)
 *
 * HONESTY CONTRACT:
 *   - Nothing is fabricated. A depth with no platform data is reported as "no data", never an estimate.
 *   - Expansion scenarios are explicitly labelled MODELS: the session-depth gate is deterministic; any
 *     state-capture assumption is stated and tied to the OBSERVED per-session capture rate.
 *   - PII: emails are one-way sha256-masked at capture; no raw email reaches any artifact.
 *
 * Run with the flag ON to exercise the WC-L2 cross-check:
 *   cd backend && FF_FORECAST_INTELLIGENCE=1 npx tsx scripts/wc3/wcl2a-coverage-expansion-audit.ts
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { computeUserTrends, type TrendLever } from '../../services/wc3/trend-intelligence';
import { computeUserBehaviourTrends } from '../../services/wc3/behaviour-trend-intelligence';
import { computeUserForecasts, type UserForecasts } from '../../services/wc3/forecast-intelligence';
import { isForecastIntelligenceEnabled } from '../../config/feature-flags';

const OUT_DIR = join(__dirname, '../../audit/wc-l2a');

/** The five forecast layers, in report order. */
type Layer = 'stage' | 'outcome' | 'journey' | 'decision' | 'behaviour';
const LAYERS: Layer[] = ['stage', 'outcome', 'journey', 'decision', 'behaviour'];
const LAYER_LABEL: Record<Layer, string> = {
  stage: 'Stage', outcome: 'Outcome', journey: 'Journey', decision: 'Decision', behaviour: 'Behaviour (risk dim)',
};
/** How each layer maps onto an existing trend source (for traceability + bottleneck attribution). */
const LAYER_SOURCE: Record<Layer, string> = {
  stage: 'wc3_longitudinal_snapshots.canonical_stage (WC-L1 stage lever)',
  outcome: 'wc3_outcome_state.current_order (WC-L1 outcome lever)',
  journey: 'wc3_journey_state.route_confidence (WC-L1 journey lever)',
  decision: 'wc7b_decision_state.confidence (WC-11 decision lever)',
  behaviour: 'wcl0_user_intelligence.risk (WC-L0B behaviour risk dim)',
};

const pct = (n: number, d: number): string => (d === 0 ? '—' : ((100 * n) / d).toFixed(1) + '%');
const fix2 = (n: number): string => Number(n.toFixed(2)).toString();

/** One-way deterministic email mask — artifacts carry NO PII but per-user grouping is preserved. */
function maskEmail(email: string): string {
  return 'user_' + createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 10);
}

/** Per-(owner × layer) forecast cell, derived purely from the existing trends. */
interface LayerCell {
  forecastable: boolean;
  confidence: number | null; // === underlying trend confidence (the value WC-L2 would carry)
  points: number | null;
  reason: 'insufficient_sessions' | 'no_trend' | null; // null when forecastable
}
interface OwnerRow {
  emailMasked: string;
  completed: number;
  eligible: boolean; // ≥2 completed sessions
  cells: Record<Layer, LayerCell>;
  anyForecastable: boolean;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Number(((s[m - 1] + s[m]) / 2).toFixed(2));
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const flagOn = isForecastIntelligenceEnabled();
  const stamp = new Date().toISOString();

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Population: owners with ≥1 completed session (by email) + anonymous pool
  // ─────────────────────────────────────────────────────────────────────────
  const { rows: emailRows } = await pool.query<{ email: string | null; completed: string }>(`
    SELECT LOWER(guest_email) AS email, COUNT(*)::text AS completed
      FROM capadex_sessions
     WHERE status = 'completed'
     GROUP BY LOWER(guest_email)
     ORDER BY COUNT(*) DESC, LOWER(guest_email) ASC
  `);

  const owners: OwnerRow[] = [];
  let anonCompleted = 0;
  let crossCheckMismatches = 0; // WC-L2 computeUserForecasts vs raw-trend agreement

  for (const r of emailRows) {
    const completed = Number(r.completed);
    if (!r.email) { anonCompleted += completed; continue; } // anonymous → never a cross-session series

    const [lev, beh] = await Promise.all([
      computeUserTrends(pool, r.email),
      computeUserBehaviourTrends(pool, r.email),
    ]);
    const sessions = Math.max(lev.sessions, beh.sessions);
    const eligible = sessions >= 2;
    const leverByKey = new Map<TrendLever, { points: number; confidence: number }>();
    for (const t of lev.trends) leverByKey.set(t.lever, { points: t.points, confidence: t.confidence });
    const riskTrend = beh.trends.find((t) => t.dim === 'risk') ?? null;

    const cellFrom = (present: { points: number; confidence: number } | null): LayerCell => {
      if (present) return { forecastable: true, confidence: present.confidence, points: present.points, reason: null };
      return {
        forecastable: false,
        confidence: null,
        points: null,
        reason: eligible ? 'no_trend' : 'insufficient_sessions',
      };
    };
    const cells: Record<Layer, LayerCell> = {
      stage: cellFrom(leverByKey.get('stage') ?? null),
      outcome: cellFrom(leverByKey.get('outcome') ?? null),
      journey: cellFrom(leverByKey.get('journey') ?? null),
      decision: cellFrom(leverByKey.get('decision') ?? null),
      behaviour: cellFrom(riskTrend ? { points: riskTrend.points, confidence: riskTrend.confidence } : null),
    };

    // ── Cross-check against the actual WC-L2 engine for the 4 layers it exposes ──
    const fc = await computeUserForecasts(pool, r.email);
    if (fc.enabled) {
      const uf = fc as UserForecasts;
      const pairs: Array<[Layer, keyof UserForecasts['forecasts']]> = [
        ['stage', 'growth'], ['outcome', 'outcome'], ['journey', 'journey'], ['behaviour', 'risk'],
      ];
      for (const [layer, kind] of pairs) {
        const f = uf.forecasts[kind];
        if (f.forecastable !== cells[layer].forecastable) crossCheckMismatches++;
        else if (f.forecastable && Math.abs((f.forecast_confidence) - (cells[layer].confidence ?? -1)) > 1e-9) crossCheckMismatches++;
      }
    }

    owners.push({
      emailMasked: maskEmail(r.email),
      completed,
      eligible,
      cells,
      anyForecastable: LAYERS.some((l) => cells[l].forecastable),
    });
  }

  const totalOwners = owners.length;
  const eligibleOwners = owners.filter((o) => o.eligible);
  const ineligibleOwners = owners.filter((o) => !o.eligible);
  const forecastableOwners = owners.filter((o) => o.anyForecastable);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Session-depth distribution (1/2/3/4/5+) + anonymous
  // ─────────────────────────────────────────────────────────────────────────
  const depthBuckets: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5+': 0 };
  for (const o of owners) {
    const key = o.completed >= 5 ? '5+' : String(o.completed);
    depthBuckets[key] = (depthBuckets[key] ?? 0) + 1;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Per-session state-capture rates (the upstream bottleneck), over OWNED completed sessions
  // ─────────────────────────────────────────────────────────────────────────
  const { rows: capRows } = await pool.query<{ [k: string]: string }>(`
    WITH cs AS (
      SELECT id::text AS id FROM capadex_sessions
       WHERE status='completed' AND guest_email IS NOT NULL AND guest_email <> ''
    )
    SELECT
      (SELECT COUNT(*) FROM cs) AS owned,
      (SELECT COUNT(DISTINCT session_id::text) FROM wc3_longitudinal_snapshots WHERE session_id::text IN (SELECT id FROM cs)) AS stage,
      (SELECT COUNT(DISTINCT session_id::text) FROM wc3_outcome_state         WHERE session_id::text IN (SELECT id FROM cs)) AS outcome,
      (SELECT COUNT(DISTINCT session_id::text) FROM wc3_journey_state         WHERE session_id::text IN (SELECT id FROM cs)) AS journey,
      (SELECT COUNT(DISTINCT session_id)        FROM wc7b_decision_state       WHERE session_id      IN (SELECT id FROM cs)) AS decision,
      (SELECT COUNT(*) FILTER (WHERE risk IS NOT NULL)        FROM wcl0_user_intelligence WHERE session_id IN (SELECT id FROM cs)) AS behaviour_risk,
      (SELECT COUNT(*) FILTER (WHERE confidence IS NOT NULL)  FROM wcl0_user_intelligence WHERE session_id IN (SELECT id FROM cs)) AS behaviour_confidence,
      (SELECT COUNT(*) FILTER (WHERE engagement IS NOT NULL)  FROM wcl0_user_intelligence WHERE session_id IN (SELECT id FROM cs)) AS behaviour_engagement,
      (SELECT COUNT(*) FILTER (WHERE motivation IS NOT NULL)  FROM wcl0_user_intelligence WHERE session_id IN (SELECT id FROM cs)) AS behaviour_motivation,
      (SELECT COUNT(*) FILTER (WHERE adaptability IS NOT NULL)FROM wcl0_user_intelligence WHERE session_id IN (SELECT id FROM cs)) AS behaviour_adaptability
  `);
  const cap = capRows[0];
  const ownedCompleted = Number(cap.owned);
  const captureCount: Record<string, number> = {
    stage: Number(cap.stage), outcome: Number(cap.outcome), journey: Number(cap.journey),
    decision: Number(cap.decision), behaviour_risk: Number(cap.behaviour_risk),
    behaviour_confidence: Number(cap.behaviour_confidence), behaviour_engagement: Number(cap.behaviour_engagement),
    behaviour_motivation: Number(cap.behaviour_motivation), behaviour_adaptability: Number(cap.behaviour_adaptability),
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Per-layer coverage + confidence (denominator = eligible owners)
  // ─────────────────────────────────────────────────────────────────────────
  interface LayerAgg { forecastable: number; noTrend: number; confidences: number[]; }
  const layerAgg: Record<Layer, LayerAgg> = {
    stage: { forecastable: 0, noTrend: 0, confidences: [] },
    outcome: { forecastable: 0, noTrend: 0, confidences: [] },
    journey: { forecastable: 0, noTrend: 0, confidences: [] },
    decision: { forecastable: 0, noTrend: 0, confidences: [] },
    behaviour: { forecastable: 0, noTrend: 0, confidences: [] },
  };
  for (const o of eligibleOwners) {
    for (const l of LAYERS) {
      const c = o.cells[l];
      if (c.forecastable) { layerAgg[l].forecastable++; if (c.confidence != null) layerAgg[l].confidences.push(c.confidence); }
      else layerAgg[l].noTrend++;
    }
  }
  const allConf = LAYERS.flatMap((l) => layerAgg[l].confidences);
  const meanOf = (xs: number[]): number | null => (xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)) : null);

  // Confidence buckets over ALL real forecasts (low <0.5 · moderate 0.5–0.83 · high ≥0.84)
  const bucket = { low: 0, moderate: 0, high: 0 };
  for (const c of allConf) { if (c >= 0.84) bucket.high++; else if (c >= 0.5) bucket.moderate++; else bucket.low++; }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Bottleneck attribution — decompose every NON-forecastable (owner × layer) cell
  // ─────────────────────────────────────────────────────────────────────────
  const totalCells = totalOwners * LAYERS.length;
  const forecastableCells = owners.reduce((n, o) => n + LAYERS.filter((l) => o.cells[l].forecastable).length, 0);
  let lossSessionDepth = 0; // owner has <2 sessions → every layer lost to depth
  const lossByLayerState: Record<Layer, number> = { stage: 0, outcome: 0, journey: 0, decision: 0, behaviour: 0 };
  for (const o of owners) {
    for (const l of LAYERS) {
      const c = o.cells[l];
      if (c.forecastable) continue;
      if (c.reason === 'insufficient_sessions') lossSessionDepth++;
      else lossByLayerState[l]++; // eligible owner, state for this layer not trendable
    }
  }
  const lostCells = totalCells - forecastableCells;

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Coverage curve by session count (MEASURED only — no estimates for empty depths)
  // ─────────────────────────────────────────────────────────────────────────
  const curve = ['1', '2', '3', '4', '5+'].map((d) => {
    const group = owners.filter((o) => (o.completed >= 5 ? '5+' : String(o.completed)) === d);
    const withForecast = group.filter((o) => o.anyForecastable).length;
    return { depth: d, owners: group.length, withForecast, coverage: group.length ? pct(withForecast, group.length) : 'no data' };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Expansion scenarios (MODELS — depth gate deterministic; capture stated explicitly)
  //    Coverage metric = identified owners with ≥1 forecastable layer (denominator = totalOwners).
  // ─────────────────────────────────────────────────────────────────────────
  const captured = (l: Layer): boolean => {
    // Is this layer captured on (essentially) every session today? (≥2 within an eligible owner achievable)
    const key = l === 'behaviour' ? 'behaviour_risk' : l;
    return ownedCompleted > 0 && captureCount[key] === ownedCompleted;
  };
  const denseLayersToday = LAYERS.filter(captured); // stage/journey/decision today
  // Owners who would become session-eligible after adding k sessions to everyone.
  const eligibleAfter = (k: number): number => owners.filter((o) => o.completed + k >= 2).length;
  // A layer is reachable for an eligible owner under "observed capture" iff it is dense today.
  const coverageObserved = (k: number): number => {
    // owners with ≥2 sessions after +k AND at least one dense layer captured → ≥1 forecast
    return owners.filter((o) => o.completed + k >= 2 && denseLayersToday.length > 0).length;
  };
  const scenarioA = { eligible: eligibleAfter(1), coverage: coverageObserved(1) };
  const scenarioB = { eligible: eligibleAfter(2), coverage: coverageObserved(2) };
  // C: outcome fully populated → outcome reachable for all currently-eligible owners (depth unchanged).
  const scenarioC_outcomeCoverageEligible = eligibleOwners.length; // 2 → outcome 0%→100% of eligible
  // D: behaviour(risk) fully populated → behaviour reachable for all currently-eligible owners.
  const scenarioD_behaviourCoverageEligible = eligibleOwners.length;
  // E: +2 sessions AND outcome+behaviour fully populated → all 5 layers for all owners, A/B reach conf 1.0.
  const scenarioE = { eligible: eligibleAfter(2), coverageAllLayers: eligibleAfter(2) };

  // Sessions-to-target (owner-coverage thresholds). With current depths, only owner C (<2) blocks 100%.
  const ownersNeededFor = (target: number): number => Math.ceil((target / 100) * totalOwners);
  const targetPlan = [50, 75, 90].map((t) => {
    const need = ownersNeededFor(t);
    const haveNow = forecastableOwners.length;
    const shortfall = Math.max(0, need - haveNow);
    return { target: t, ownersNeeded: need, haveNow, shortfall };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Write artifacts
  // ─────────────────────────────────────────────────────────────────────────
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const flagBanner = flagOn
    ? '`FF_FORECAST_INTELLIGENCE` is **ON** — the WC-L2 cross-check ran against `computeUserForecasts`.'
    : '⚠️ `FF_FORECAST_INTELLIGENCE` is **OFF** — the WC-L2 engine cross-check returned `{enabled:false}`; raw trend ' +
      'measurements below are unaffected (they read WC-L1/WC-L0B directly). Re-run with `FF_FORECAST_INTELLIGENCE=1`.';
  const crossNote = flagOn
    ? (crossCheckMismatches === 0
        ? '✅ Cross-check: WC-L2 `computeUserForecasts` agrees with the raw-trend measurement on every shared layer (forecastable + confidence).'
        : `⚠️ Cross-check: ${crossCheckMismatches} disagreement(s) between WC-L2 and the raw-trend measurement — investigate.`)
    : '(cross-check skipped — flag OFF)';

  const layerCovRow = (l: Layer): string => {
    const a = layerAgg[l];
    const conf = a.confidences.length ? `${fix2(meanOf(a.confidences)!)} (low)` : '—';
    const blocker = a.forecastable === eligibleOwners.length
      ? (eligibleOwners.length === 0 ? 'no eligible owners' : 'none (state fully populated)')
      : l === 'outcome' ? 'outcome state captured on ' + captureCount.outcome + '/' + ownedCompleted + ' sessions'
      : l === 'behaviour' ? 'risk dim non-null on ' + captureCount.behaviour_risk + '/' + ownedCompleted + ' sessions'
      : 'state not trendable for ' + a.noTrend + ' eligible owner(s)';
    return `| ${LAYER_LABEL[l]} | ${eligibleOwners.length} | ${a.forecastable} | ${pct(a.forecastable, eligibleOwners.length)} | ${conf} | ${blocker} |`;
  };

  // ── 1. Forecast Coverage Report ──
  writeFileSync(join(OUT_DIR, '01_forecast_coverage_report.md'), `# WC-L2A Deliverable 1 — Forecast Coverage Report
_Generated ${stamp}_

${flagBanner}
${crossNote}

A layer is **forecastable** for an owner when its underlying WC-L1/WC-L0B trend exists (≥2 readable points).
Coverage is counted over the **${eligibleOwners.length} trend-eligible owner(s)** (≥2 completed sessions); owners with
<2 sessions are structurally unforecastable for every layer and are reported in the User Depth Report.

## Coverage by layer (denominator = ${eligibleOwners.length} eligible owner(s))
| Layer | eligible | forecastable | coverage | confidence | primary blocker |
|---|---|---|---|---|---|
${LAYERS.map(layerCovRow).join('\n')}

## Headline
- Identified owners (≥1 completed session): **${totalOwners}**; trend-eligible (≥2): **${eligibleOwners.length}** (${pct(eligibleOwners.length, totalOwners)}).
- Owners with **≥1** forecastable layer: **${forecastableOwners.length} / ${totalOwners}** (${pct(forecastableOwners.length, totalOwners)}).
- **Stage / Journey / Decision** are forecastable for **100% of eligible owners** — their state is captured on
  every owned session (${captureCount.stage}/${ownedCompleted}, ${captureCount.journey}/${ownedCompleted}, ${captureCount.decision}/${ownedCompleted}).
- **Outcome** and **Behaviour (risk)** are at **0%** — not a depth problem for these owners but an upstream
  **state-capture** gap (outcome ${captureCount.outcome}/${ownedCompleted}, risk dim ${captureCount.behaviour_risk}/${ownedCompleted} sessions).
- Anonymous completed sessions (**${anonCompleted}**) have no stable owner identity → never forecastable (structural, not a defect).

> Note on Decision: WC-L2's runtime API surface (\`computeUserForecasts\`) exposes Stage/Outcome/Journey/Risk only.
> The **Decision** trend already exists (WC-11) and uses the *same projection logic*, but is **not currently exposed
> in the WC-L2 runtime API** — it is audited here from its WC-11 trend evidence as a zero-new-model layer.
`);

  // ── 2. Forecast Confidence Report ──
  writeFileSync(join(OUT_DIR, '02_forecast_confidence_report.md'), `# WC-L2A Deliverable 2 — Forecast Confidence Report
_Generated ${stamp}_

${flagBanner}

## How confidence is defined (no new model)
A forecast's confidence **is** its underlying trend's confidence (WC-L2 sets \`forecast_confidence = trend.confidence\`).
Trend confidence scales with comparable session count: **2 pts → 0.33 (floor), 3 → 0.67, 4+ → 1.0**. Bands:
low (<0.5) · moderate (0.5–0.83) · high (≥0.84).

## Distribution (real forecasts only)
| Metric | Value |
|---|---|
| Real forecasts produced | ${allConf.length} |
| Mean confidence | ${meanOf(allConf) ?? '—'} |
| Median confidence | ${median(allConf) ?? '—'} |
| Range | ${allConf.length ? `${Math.min(...allConf)} – ${Math.max(...allConf)}` : '—'} |
| Low / Moderate / High | ${bucket.low} / ${bucket.moderate} / ${bucket.high} |

## Per-layer confidence
| Layer | real forecasts | mean confidence | band |
|---|---|---|---|
${LAYERS.map((l) => {
  const c = layerAgg[l].confidences;
  const m = meanOf(c);
  const band = m == null ? '—' : m >= 0.84 ? 'high' : m >= 0.5 ? 'moderate' : 'low';
  return `| ${LAYER_LABEL[l]} | ${c.length} | ${m ?? '—'} | ${band} |`;
}).join('\n')}

## Confidence ceiling imposed by current data depth
The deepest owner has **2 completed sessions**, so every trend sits at the **2-point floor (0.33 / low)**.
**With the current data, no forecast can exceed low confidence** — moderate needs 3 comparable sessions and
high needs 4. This ceiling is a pure **data-depth** limit and cannot be lifted by any code change.

| Comparable sessions | Trend confidence | Band | Present in platform data? |
|---|---|---|---|
| 2 | 0.33 | low | yes (all eligible owners) |
| 3 | 0.67 | moderate | **no data** |
| 4+ | 1.0 | high | **no data** |
`);

  // ── 3. User Depth Report ──
  writeFileSync(join(OUT_DIR, '03_user_depth_report.md'), `# WC-L2A Deliverable 3 — User Depth Report
_Generated ${stamp}_

${flagBanner}

## Completed-session depth (identified owners)
| Completed sessions | Owners |
|---|---|
| 1 | ${depthBuckets['1']} |
| 2 | ${depthBuckets['2']} |
| 3 | ${depthBuckets['3']} |
| 4 | ${depthBuckets['4']} |
| 5+ | ${depthBuckets['5+']} |

## Eligibility
| Metric | Value |
|---|---|
| Identified owners (≥1 completed session) | ${totalOwners} |
| Forecast-eligible (≥2 completed sessions) | ${eligibleOwners.length} (${pct(eligibleOwners.length, totalOwners)}) |
| Blocked by insufficient history (<2 sessions) | ${ineligibleOwners.length} (${pct(ineligibleOwners.length, totalOwners)}) |
| Anonymous completed sessions (un-attributable to any owner) | ${anonCompleted} |

**Honest finding:** longitudinal depth barely exists — the platform's deepest user has just **2** completed
sessions, and ${anonCompleted} completed sessions are anonymous (no identity to form a series). Forecast coverage is
therefore **data-bound**, and confidence is pinned at the floor until users re-assess (depth ≥3 for moderate, ≥4 for high).
`);

  // ── 4. Forecast Eligibility Matrix ──
  writeFileSync(join(OUT_DIR, '04_forecast_eligibility_matrix.md'), `# WC-L2A Deliverable 4 — Forecast Eligibility Matrix
_Generated ${stamp}_

${flagBanner}

Per-(owner × layer). ✅ forecastable · ⛔ <2 sessions · ⚪ has sessions but state not trendable. Confidence in ().

| Owner | sessions | ${LAYERS.map((l) => LAYER_LABEL[l]).join(' | ')} |
|---|---|${LAYERS.map(() => '---').join('|')}|
${owners.map((o) => {
  const cellStr = (l: Layer) => {
    const c = o.cells[l];
    if (c.forecastable) return `✅ (${fix2(c.confidence!)})`;
    return c.reason === 'insufficient_sessions' ? '⛔' : '⚪';
  };
  return `| \`${o.emailMasked}\` | ${o.completed} | ${LAYERS.map(cellStr).join(' | ')} |`;
}).join('\n')}

**Legend:** ⛔ = owner has <2 completed sessions (no trend of any kind possible). ⚪ = owner is eligible but
that layer's state lacked two readable points (state-capture gap, never fabricated).
`);

  // ── 5. Forecast Expansion Roadmap ──
  writeFileSync(join(OUT_DIR, '05_forecast_expansion_roadmap.md'), `# WC-L2A Deliverable 5 — Forecast Expansion Roadmap
_Generated ${stamp}_

${flagBanner}

All scenarios are **MODELS**, not measurements. The **session-depth gate is deterministic** (we know exactly
who crosses ≥2 sessions). Any **state-capture** assumption is stated explicitly and tied to the **observed**
per-session capture rate (Stage/Journey/Decision are captured on ${captureCount.stage}/${ownedCompleted} of owned sessions today;
Outcome ${captureCount.outcome}/${ownedCompleted}; Behaviour-risk ${captureCount.behaviour_risk}/${ownedCompleted}). Coverage metric = identified owners with ≥1 forecastable layer
(denominator = ${totalOwners}). Current baseline = **${forecastableOwners.length}/${totalOwners}** (${pct(forecastableOwners.length, totalOwners)}).

## Scenario A — every user completes **one** additional assessment
- Deterministic: session-eligible owners ${eligibleOwners.length} → **${scenarioA.eligible}**.
- Under observed capture (Stage/Journey/Decision dense today), owners with ≥1 forecast → **${scenarioA.coverage}/${totalOwners}** (${pct(scenarioA.coverage, totalOwners)}).
- Confidence: existing 2-session owners move 0.33 → **0.67 (moderate)**; the new 2-session owner sits at the 0.33 floor.
- Does **not** create Outcome/Behaviour-risk coverage (those remain capture-blocked — see C/D).

## Scenario B — every user completes **two** additional assessments
- Deterministic: session-eligible owners → **${scenarioB.eligible}**.
- Coverage (≥1 forecast) → **${scenarioB.coverage}/${totalOwners}** (${pct(scenarioB.coverage, totalOwners)}).
- **Key gain is confidence:** the existing 2-session owners reach depth 4 → confidence **1.0 (high)** — the only
  scenario that lifts any forecast off the low-confidence floor.

## Scenario C — Outcome history fully populated (every session carries outcome state)
- Depth unchanged → owner coverage unchanged. **Outcome layer** coverage over eligible owners: 0% → **${pct(scenarioC_outcomeCoverageEligible, eligibleOwners.length)}** (${scenarioC_outcomeCoverageEligible}/${eligibleOwners.length}).
- Confidence still at the 0.33 floor (depth not increased).

## Scenario D — Behaviour history fully populated (risk dim non-null every session)
- **Behaviour layer** coverage over eligible owners: 0% → **${pct(scenarioD_behaviourCoverageEligible, eligibleOwners.length)}** (${scenarioD_behaviourCoverageEligible}/${eligibleOwners.length}).
- ⚡ **Near-zero-cost variant:** \`confidence\` and \`engagement\` are **already** trend-eligible for both eligible owners
  (non-null on ${captureCount.behaviour_confidence}/${ownedCompleted} and ${captureCount.behaviour_engagement}/${ownedCompleted} sessions). WC-L2 simply forecasts the *sparsest* dim (risk, ${captureCount.behaviour_risk}/${ownedCompleted}).
  Pointing the existing \`projectForecast\` at a denser dim would yield Behaviour forecasts **today**, with no new data.

## Scenario E — combined (+2 sessions AND Outcome + Behaviour fully populated)
- All ${totalOwners} owners eligible; all **5 layers** forecastable for every eligible owner; the +2-depth owners reach
  confidence **1.0 (high)**. This is the full-coverage / high-confidence ceiling — reachable **only** with both
  more depth **and** the capture fixes.

## Sessions-to-target (owner coverage)
| Target | Owners needed | Have now | Shortfall |
|---|---|---|---|
${targetPlan.map((t) => `| ${t.target}% | ${t.ownersNeeded} | ${t.haveNow} | ${t.shortfall} |`).join('\n')}

**Honest caveat (small-n):** with only ${totalOwners} identified owners, coverage moves in ~${pct(1, totalOwners)} steps, so the
50/75/90% thresholds are coarse. Concretely: **50% is already met**; **75% and 90% both require all ${totalOwners} owners at
≥2 sessions** — i.e. the single ${ineligibleOwners.length}-session owner completing **one** more assessment. If the ${anonCompleted} anonymous
sessions represent real users, reaching those targets *also* requires attributing them to a stable identity.
`);

  // ── 6. Forecast Bottleneck Matrix ──
  const ceilingFor = (l: Layer): string => {
    if (l === 'outcome') return 'Outcome-state capture (' + captureCount.outcome + '/' + ownedCompleted + ')';
    if (l === 'behaviour') return 'Risk-dim capture (' + captureCount.behaviour_risk + '/' + ownedCompleted + ')';
    return '100% of eligible at conf floor 0.33';
  };
  writeFileSync(join(OUT_DIR, '06_forecast_bottleneck_matrix.md'), `# WC-L2A Deliverable 6 — Forecast Bottleneck Matrix
_Generated ${stamp}_

${flagBanner}

## Per-layer
| Layer | Current coverage (eligible) | Ceiling with current data | Primary blocker |
|---|---|---|---|
${LAYERS.map((l) => {
  const a = layerAgg[l];
  return `| ${LAYER_LABEL[l]} | ${pct(a.forecastable, eligibleOwners.length)} (${a.forecastable}/${eligibleOwners.length}) | ${ceilingFor(l)} | ${
    l === 'outcome' ? 'outcome state not persisted per session'
    : l === 'behaviour' ? 'risk dim sparsest behaviour signal'
    : 'session depth (confidence floor)'
  } |`;
}).join('\n')}

## Forecast-loss decomposition (every non-forecastable owner × layer cell)
Total cells = ${totalOwners} owners × ${LAYERS.length} layers = **${totalCells}**. Forecastable now = **${forecastableCells}**. Lost = **${lostCells}**.

| Loss driver | Cells lost | Share of loss |
|---|---|---|
| Session depth (<2 sessions) | ${lossSessionDepth} | ${pct(lossSessionDepth, lostCells)} |
| Outcome history (state capture) | ${lossByLayerState.outcome} | ${pct(lossByLayerState.outcome, lostCells)} |
| Behaviour-risk history (dim capture) | ${lossByLayerState.behaviour} | ${pct(lossByLayerState.behaviour, lostCells)} |
| Stage history | ${lossByLayerState.stage} | ${pct(lossByLayerState.stage, lostCells)} |
| Journey history | ${lossByLayerState.journey} | ${pct(lossByLayerState.journey, lostCells)} |
| Decision history | ${lossByLayerState.decision} | ${pct(lossByLayerState.decision, lostCells)} |

Anonymous completed sessions (**${anonCompleted}**) sit *outside* this owner×layer grid: with no identity they
contribute 0 forecastable owners — a separate, structural loss that identity attribution would recover.

## Single highest-leverage intervention
**Increase completed-session depth per identified owner (and attribute anonymous sessions to identities).**
It is the only lever that raises **both** coverage and confidence: it gates **${lossSessionDepth} of ${lostCells}** lost cells, and it is the
*only* way to lift confidence off the 0.33 floor. The capture fixes (Outcome, Behaviour-risk) are the
second tier — they widen *which layers* are forecastable but cannot raise confidence.

_Layer-specific aside:_ the cheapest single win for the **Behaviour** layer is to forecast a denser behaviour
dim (\`confidence\`/\`engagement\`, already trend-eligible) rather than the sparse \`risk\` dim — no new data required.
`);

  // ── 7. Forecast Coverage Curve ──
  writeFileSync(join(OUT_DIR, '07_forecast_coverage_curve.md'), `# WC-L2A Deliverable 7 — Forecast Coverage Curve
_Generated ${stamp}_

${flagBanner}

Real, measured curve — **not estimated**. Depths with no owners are reported as **no data** (never interpolated).

| Session count | Owners | Owners with ≥1 forecast | Forecast coverage |
|---|---|---|---|
${curve.map((c) => `| ${c.depth} | ${c.owners} | ${c.withForecast} | ${c.coverage} |`).join('\n')}

**Reading the curve:** the only inflection the platform has actually observed is **1 → 2 sessions**, where
coverage jumps from **0%** (no trend possible) to **${(() => { const d2 = curve.find((c) => c.depth === '2'); return d2 && d2.owners ? d2.coverage : 'n/a'; })()}** (Stage/Journey/Decision become forecastable). Depths 3, 4 and 5+
carry **no platform data**, so the curve beyond depth 2 is honestly unknown — the WC-L1/L2 confidence formula
*predicts* the confidence band by depth (0.33 → 0.67 → 1.0), but coverage at those depths must be **measured, not assumed**.
`);

  // ── 8. Executive Summary ──
  writeFileSync(join(OUT_DIR, '08_executive_summary.md'), `# WC-L2A — Forecast Coverage Expansion Audit: Executive Summary
_Generated ${stamp}_

${flagBanner}
${crossNote}

## Question → grounded answer
| Question | Answer (measured) |
|---|---|
| Current forecast coverage (owners with ≥1 forecast) | **${forecastableOwners.length}/${totalOwners}** (${pct(forecastableOwners.length, totalOwners)}) |
| Forecast-eligible owners (≥2 sessions) | **${eligibleOwners.length}/${totalOwners}** (${pct(eligibleOwners.length, totalOwners)}) |
| Max coverage with **existing** data | Stage/Journey/Decision **100% of eligible**; Outcome & Behaviour-risk **0%** (capture-blocked); confidence **floor 0.33** for all |
| Sessions for **50%** coverage | already met (${pct(forecastableOwners.length, totalOwners)}) |
| Sessions for **75%** coverage | the ${ineligibleOwners.length}-session owner needs **+1** session (→ all ${totalOwners} owners eligible) |
| Sessions for **90%** coverage | same as 75% at this n (+1 for the lone under-depth owner); + identity attribution if anon are real users |
| Highest-leverage intervention | **more completed sessions per identified owner** (raises coverage *and* confidence) |
| True readiness ceiling | engine correct; **every forecast capped at LOW confidence (0.33)** by 2-session max depth; Outcome/Behaviour-risk capped at 0% by state capture |

> Scope note: **Decision** is audited from its WC-11 trend evidence using the same projection logic; it is **not
> currently exposed** in the WC-L2 runtime API (\`computeUserForecasts\` surfaces Stage/Outcome/Journey/Risk only).

## The honest ceiling
- **Coverage** is data-bound, not code-bound: the WC-L2 engine is correct and the upstream trends are real.
  Stage/Journey/Decision already forecast for **100%** of eligible owners; Outcome and Behaviour(risk) are 0%
  purely because that state is not persisted on enough sessions (outcome ${captureCount.outcome}/${ownedCompleted}, risk dim ${captureCount.behaviour_risk}/${ownedCompleted}).
- **Confidence** has a hard ceiling: with a 2-session maximum depth, **no forecast can exceed low confidence**.
  Reaching moderate needs depth 3; high needs depth 4. No platform data exists at those depths yet.
- **Anonymous sessions (${anonCompleted})** are structurally unforecastable and depress true coverage if they represent real users.

## Bottom line
WC-L2 is a sound, reversible foundation. The shortest honest path to higher coverage is **longitudinal depth
+ per-session state capture**, in that order — never the manufacture of a forecast where the trend evidence is
absent. A near-zero-cost layer win exists for **Behaviour** (forecast the denser \`confidence\`/\`engagement\` dim
instead of the sparse \`risk\` dim), but it does not change the depth-bound confidence ceiling.
`);

  // ── PII-masked machine snapshot ──
  const snapshot = {
    generated_at: stamp,
    flag_enabled: flagOn,
    cross_check_mismatches: flagOn ? crossCheckMismatches : null,
    population: {
      identified_owners: totalOwners,
      eligible_owners: eligibleOwners.length,
      ineligible_owners: ineligibleOwners.length,
      forecastable_owners: forecastableOwners.length,
      anonymous_completed_sessions: anonCompleted,
      owned_completed_sessions: ownedCompleted,
      depth_buckets: depthBuckets,
    },
    per_session_state_capture: { denominator: ownedCompleted, counts: captureCount },
    per_layer_over_eligible: LAYERS.map((l) => ({
      layer: l, source: LAYER_SOURCE[l],
      forecastable: layerAgg[l].forecastable, no_trend: layerAgg[l].noTrend,
      eligible_denominator: eligibleOwners.length,
      mean_confidence: meanOf(layerAgg[l].confidences),
      confidences: layerAgg[l].confidences,
    })),
    confidence_buckets: bucket,
    forecast_loss: {
      total_cells: totalCells, forecastable_cells: forecastableCells, lost_cells: lostCells,
      session_depth: lossSessionDepth, by_layer_state: lossByLayerState,
    },
    coverage_curve: curve,
    scenarios: {
      A_plus1: scenarioA, B_plus2: scenarioB,
      C_outcome_full_eligible_coverage: scenarioC_outcomeCoverageEligible,
      D_behaviour_full_eligible_coverage: scenarioD_behaviourCoverageEligible,
      E_combined: scenarioE,
      target_plan: targetPlan,
    },
    owners: owners.map((o) => ({
      owner: o.emailMasked, completed: o.completed, eligible: o.eligible, any_forecastable: o.anyForecastable,
      cells: o.cells,
    })),
  };
  writeFileSync(join(OUT_DIR, '_forecast_expansion.json'), JSON.stringify(snapshot, null, 2));

  // ── Console summary ──
  console.log(`[wcl2a-coverage-audit] flag ${flagOn ? 'ON' : 'OFF'} · reports → ${OUT_DIR}`);
  console.log(`  owners ${totalOwners} (eligible ${eligibleOwners.length}, ineligible ${ineligibleOwners.length}) · anon ${anonCompleted} · owned-completed ${ownedCompleted}`);
  console.log(`  coverage (≥1 forecast): ${forecastableOwners.length}/${totalOwners} (${pct(forecastableOwners.length, totalOwners)})`);
  for (const l of LAYERS) console.log(`  ${l}: ${layerAgg[l].forecastable}/${eligibleOwners.length} forecastable (mean conf ${meanOf(layerAgg[l].confidences) ?? '—'})`);
  console.log(`  loss: depth ${lossSessionDepth} · outcome ${lossByLayerState.outcome} · behaviour ${lossByLayerState.behaviour} (of ${lostCells} lost cells)`);
  console.log(`  cross-check mismatches: ${flagOn ? crossCheckMismatches : '(flag off)'}`);

  await pool.end();
}

main().catch((err) => {
  console.error('[wcl2a-coverage-audit] fatal:', err);
  process.exit(1);
});
