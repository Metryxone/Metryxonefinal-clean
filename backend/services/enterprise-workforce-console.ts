/**
 * MX-100X PHASE 9 — Enterprise Workforce Intelligence Console (read-only composer).
 *
 * A PURE, READ-ONLY composition layer that wires the ALREADY-BUILT engines into ONE
 * enterprise console with 7 views:
 *   1. skill-gap            — org skill gaps (M5) + competency obsolescence (predictive Phase 5)
 *   2. succession           — succession summary / candidates / critical roles / bench (M5)
 *   3. internal-mobility    — DERIVED from succession candidates' mobility_alignment (no dedicated
 *                             population exists → provenance-stamped, honest)
 *   4. workforce-planning   — stored scenario library + transformation scenarios + a measurable
 *                             capability projection (M5 sim); abstains when no real capability rows
 *   5. talent-risk          — workforce risk (predictive) + strategic risks (M5) + AI exposure
 *   6. talent-forecasting   — longitudinal TRENDS over risk / obsolescence / market-signal snapshots
 *                             (>=2 points required) + emerging roles (forward indicator)
 *   7. readiness-forecasting— per-subject readiness TRENDS (career_readiness_history, >=2 points) +
 *                             enterprise readiness snapshot (M5)
 *
 * CANON (strict):
 *   - COMPOSE NEVER RECOMPUTE: calls only the existing engines' READ paths + read-only snapshot
 *     SELECTs. Recomputes nothing, writes nothing, runs NO DDL (no ensure-schema). GET-only.
 *   - HONEST DEGRADATION: every direct read is to_regclass-probed; missing table/data → abstain
 *     with a reason. Unmeasured → null, NEVER fabricated 0.
 *   - FORECASTS ABSTAIN: a longitudinal trend needs >= MIN_TREND_POINTS (2) readable points or it
 *     reports abstained:true and emits NO trend (no fabricated slope).
 *   - K-ANONYMITY: cohort-level aggregates across distinct people are SUPPRESSED below K_MIN (30).
 *   - NEVER THROWS: every engine call is wrapped; a failure degrades that view, never the request.
 *   - DEVELOPMENTAL SIGNALS ONLY: NOT hiring / promotion / suitability predictions.
 *
 * Distinct from Phase 5.12 `workforce-intelligence-*` (employer-scoped). This is enterprise/org-wide.
 */
import type { Pool } from 'pg';
import {
  listObsolescence,
  listWorkforceRisk,
  aiExposure,
  listEmergingRoles,
} from './predictive-workforce-engine';
import { createWorkforceIntelligence } from './m5-workforce-intelligence';
import { createSuccessionEngine } from './m5-succession';
import { createWorkforceSimulation } from './m5-workforce-simulation';
import { createExecutiveIntelligence } from './m5-executive-intelligence';
import {
  leastSquaresSlope,
  directionOf,
  type TrendDirection,
} from './wc3/longitudinal-consumption';

export const ENTERPRISE_WORKFORCE_CONSOLE_VERSION = '9.0.0';
export const DEFAULT_ORG_ID = 'demo_org';

/** A longitudinal trend needs at least this many readable points or it abstains. */
export const MIN_TREND_POINTS = 2;
/** Cohort aggregates across distinct people are suppressed below this. */
export const K_MIN = 30;

export const ENTERPRISE_WORKFORCE_DISCLAIMER =
  'Enterprise workforce intelligence is a DEVELOPMENTAL / planning signal composed from already-computed ' +
  'predictive-workforce and enterprise (M5) engine outputs. It is NOT a hiring, promotion, or suitability ' +
  'prediction. Coverage (data exists) and Confidence (trustworthy/sufficient) are reported separately; ' +
  'unmeasured signals abstain (null), never fabricated as 0. Cohort aggregates are suppressed below k=30.';

export type ViewProvenance = {
  engines: string[];
  tables: string[];
  notes?: string[];
};

export interface ConsoleView<T = unknown> {
  view: string;
  available: boolean;
  abstained: boolean;
  reason: string | null;
  provenance: ViewProvenance;
  data: T;
}

interface TrendResult {
  metric: string;
  label: string;
  available: boolean;
  abstained: boolean;
  reason: string | null;
  points: number;
  first: number | null;
  last: number | null;
  delta: number | null;
  slope: number | null;
  direction: TrendDirection | null;
  forecast_next: number | null;
}

// ── small helpers ────────────────────────────────────────────────────────────

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS r', ['public.' + table]);
    return !!r.rows[0]?.r;
  } catch {
    return false;
  }
}

/** Run an engine read; never throw. On failure returns { ok:false, reason }. */
async function safeCall<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; reason: string }> {
  try {
    return { ok: true, value: await fn() };
  } catch (e: any) {
    return { ok: false, reason: `${label} unavailable: ${String(e?.message ?? e).slice(0, 160)}` };
  }
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isArr(x: unknown): x is any[] {
  return Array.isArray(x) && x.length > 0;
}

/**
 * Build a longitudinal trend from an ordered (oldest→newest) numeric series.
 * <2 readable points → abstained:true and NO trend (never fabricates a slope).
 */
function buildTrend(metric: string, label: string, values: number[]): TrendResult {
  const ys = values.filter((v) => Number.isFinite(v));
  if (ys.length < MIN_TREND_POINTS) {
    return {
      metric, label, available: false, abstained: true,
      reason: `insufficient longitudinal history (${ys.length} readable point(s), need >= ${MIN_TREND_POINTS})`,
      points: ys.length, first: null, last: null, delta: null, slope: null,
      direction: null, forecast_next: null,
    };
  }
  const first = ys[0];
  const last = ys[ys.length - 1];
  const slope = leastSquaresSlope(ys);
  return {
    metric, label, available: true, abstained: false, reason: null,
    points: ys.length,
    first: round2(first),
    last: round2(last),
    delta: round2(last - first),
    slope: round2(slope),
    direction: directionOf(slope),
    forecast_next: round2(clamp(last + slope)),
  };
}

/** k-anonymity gate for a cohort-level aggregate across distinct people. */
function kGate<T>(distinctPeople: number, value: T): { suppressed: boolean; reason: string | null; value: T | null } {
  if (distinctPeople < K_MIN) {
    return { suppressed: true, reason: `k-anonymity: cohort n=${distinctPeople} < k_min=${K_MIN}`, value: null };
  }
  return { suppressed: false, reason: null, value };
}

function pickNumber(row: any, keys: string[]): number | null {
  for (const k of keys) {
    const v = row?.[k];
    if (v === null || v === undefined || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// ── view 1: skill-gap ────────────────────────────────────────────────────────

export async function skillGapView(pool: Pool, orgId = DEFAULT_ORG_ID): Promise<ConsoleView> {
  const wfi = createWorkforceIntelligence(pool);
  const gaps = await safeCall('m5.skillGaps', () => wfi.skillGaps(orgId));
  const obs = (await tableExists(pool, 'wos_skill_obsolescence'))
    ? await safeCall('predictive.listObsolescence', () => listObsolescence(pool, { limit: 25 }))
    : ({ ok: false as const, reason: 'wos_skill_obsolescence absent' });

  const orgGaps = gaps.ok && Array.isArray(gaps.value) ? gaps.value : [];
  const obsolescence = obs.ok && Array.isArray(obs.value) ? obs.value : [];
  const available = orgGaps.length > 0 || obsolescence.length > 0;
  const notes: string[] = [];
  if (!gaps.ok) notes.push((gaps as any).reason);
  if (!obs.ok) notes.push((obs as any).reason);

  return {
    view: 'skill-gap',
    available,
    abstained: !available,
    reason: available ? null : 'no organizational skill-gap rows and no obsolescence snapshots',
    provenance: {
      engines: ['m5-workforce-intelligence.skillGaps', 'predictive-workforce-engine.listObsolescence'],
      tables: ['m5_organizational_skill_gaps', 'wos_skill_obsolescence'],
      notes: notes.length ? notes : undefined,
    },
    data: {
      org_id: orgId,
      org_skill_gaps: orgGaps,
      competency_obsolescence: obsolescence,
      coverage: { org_skill_gaps: orgGaps.length, competency_obsolescence: obsolescence.length },
    },
  };
}

// ── view 2: succession ───────────────────────────────────────────────────────

export async function successionView(pool: Pool, orgId = DEFAULT_ORG_ID): Promise<ConsoleView> {
  const succ = createSuccessionEngine(pool);
  const summary = await safeCall('m5.successionSummary', () => succ.successionSummary(orgId));
  const candidates = await safeCall('m5.candidates', () => succ.candidates(orgId));
  const criticalRoles = await safeCall('m5.criticalRoles', () => succ.criticalRoles(orgId));
  const bench = await safeCall('m5.benchStrength', () => succ.benchStrength(orgId));
  const gapRisks = await safeCall('m5.leadershipGapRisks', () => succ.leadershipGapRisks(orgId));

  const cand = candidates.ok && Array.isArray(candidates.value) ? candidates.value : [];
  const crit = criticalRoles.ok && Array.isArray(criticalRoles.value) ? criticalRoles.value : [];
  const benchRows = bench.ok && Array.isArray(bench.value) ? bench.value : [];
  const risks = gapRisks.ok && Array.isArray(gapRisks.value) ? gapRisks.value : [];
  const available = cand.length > 0 || crit.length > 0 || benchRows.length > 0 || risks.length > 0;

  return {
    view: 'succession',
    available,
    abstained: !available,
    reason: available ? null : 'no succession candidates / critical roles / bench / gap-risk rows',
    provenance: {
      engines: ['m5-succession.{successionSummary,candidates,criticalRoles,benchStrength,leadershipGapRisks}'],
      tables: ['m5_succession_candidates', 'm5_critical_role_successors', 'm5_bench_strength_scores', 'm5_leadership_gap_risks'],
    },
    data: {
      org_id: orgId,
      summary: summary.ok ? summary.value : null,
      candidates: cand,
      critical_roles: crit,
      bench_strength: benchRows,
      leadership_gap_risks: risks,
      coverage: { candidates: cand.length, critical_roles: crit.length, bench_strength: benchRows.length, leadership_gap_risks: risks.length },
    },
  };
}

// ── view 3: internal-mobility (DERIVED) ──────────────────────────────────────

export async function mobilityView(pool: Pool, orgId = DEFAULT_ORG_ID): Promise<ConsoleView> {
  const succ = createSuccessionEngine(pool);
  const candidates = await safeCall('m5.candidates', () => succ.candidates(orgId));
  const cand = candidates.ok && Array.isArray(candidates.value) ? candidates.value : [];

  // Derive an internal-mobility readiness row from each succession candidate's mobility_alignment.
  const mobility = cand.map((c: any) => ({
    candidate_id: c.candidate_id ?? c.id ?? null,
    person_ref: c.person_ref ?? c.user_id ?? c.candidate_id ?? null,
    target_role_id: c.target_role_id ?? c.role_id ?? null,
    mobility_alignment: pickNumber(c, ['mobility_alignment']),
    readiness: pickNumber(c, ['readiness_score', 'readiness', 'overall_readiness']),
  }));

  // Cohort aggregate (avg mobility alignment) is k-anon gated across distinct people.
  const distinctPeople = new Set(mobility.map((m) => m.person_ref).filter((x) => x != null)).size;
  const aligns = mobility.map((m) => m.mobility_alignment).filter((v): v is number => Number.isFinite(v as number));
  const rawAvg = aligns.length ? round2(aligns.reduce((a, b) => a + b, 0) / aligns.length) : null;
  const cohortAvg = kGate(distinctPeople, rawAvg);

  const available = mobility.length > 0;
  return {
    view: 'internal-mobility',
    available,
    abstained: !available,
    reason: available ? null : 'no succession candidates to derive internal-mobility readiness from',
    provenance: {
      engines: ['m5-succession.candidates'],
      tables: ['m5_succession_candidates'],
      notes: [
        'No dedicated internal-mobility population exists; mobility readiness is DERIVED from the ' +
        "succession candidates' mobility_alignment dimension (provenance=succession_candidates).",
      ],
    },
    data: {
      org_id: orgId,
      mobility_candidates: mobility,
      cohort_avg_mobility_alignment: cohortAvg.value,
      cohort_suppressed: cohortAvg.suppressed,
      cohort_suppression_reason: cohortAvg.reason,
      distinct_people: distinctPeople,
      coverage: { mobility_candidates: mobility.length },
    },
  };
}

// ── view 4: workforce-planning ───────────────────────────────────────────────

export async function workforcePlanningView(
  pool: Pool,
  orgId = DEFAULT_ORG_ID,
  horizonMonths = 18,
): Promise<ConsoleView> {
  const sim = createWorkforceSimulation(pool);
  const scenarios = await safeCall('m5.scenarios', () => sim.scenarios(orgId));
  const transformation = await safeCall('m5.transformationScenarios', () => sim.transformationScenarios(orgId));

  // Capability projection only when there is >=1 REAL capability row for the org — otherwise the
  // underlying futureForecast falls back to a hardcoded average, which we must NOT surface.
  let capabilityCount = 0;
  if (await tableExists(pool, 'm5_organizational_capabilities')) {
    const c = await safeCall('capabilityCount', () =>
      pool.query('SELECT COUNT(*)::int AS n FROM m5_organizational_capabilities WHERE org_id=$1', [orgId]),
    );
    capabilityCount = c.ok ? Number(c.value.rows[0]?.n ?? 0) : 0;
  }
  let projection: any = null;
  let projectionAbstained = true;
  let projectionReason: string | null = 'no real organizational capability rows → projection abstained';
  if (capabilityCount >= 1) {
    const f = await safeCall('m5.futureForecast', () => sim.futureForecast(orgId, horizonMonths));
    if (f.ok) {
      projection = { ...f.value, capability_rows: capabilityCount };
      projectionAbstained = false;
      projectionReason = null;
    }
  }

  const scn = scenarios.ok && Array.isArray(scenarios.value) ? scenarios.value : [];
  const trans = transformation.ok && Array.isArray(transformation.value) ? transformation.value : [];
  const available = scn.length > 0 || trans.length > 0 || !projectionAbstained;

  return {
    view: 'workforce-planning',
    available,
    abstained: !available,
    reason: available ? null : 'no scenario library, no transformation scenarios, and no measurable capability projection',
    provenance: {
      engines: ['m5-workforce-simulation.{scenarios,transformationScenarios,futureForecast}'],
      tables: ['m5_organizational_simulations', 'm5_workforce_transformation_scenarios', 'm5_organizational_capabilities'],
      notes: [
        'Deterministic what-if simulation (predictive-workforce-v2.simulateScenario) requires an explicit ' +
        'headcount/attrition baseline which the platform does not record — it is NOT auto-run here (no fabricated baseline).',
      ],
    },
    data: {
      org_id: orgId,
      horizon_months: horizonMonths,
      scenario_library: scn,
      transformation_scenarios: trans,
      capability_projection: projection,
      capability_projection_abstained: projectionAbstained,
      capability_projection_reason: projectionReason,
      coverage: { scenario_library: scn.length, transformation_scenarios: trans.length, capability_rows: capabilityCount },
    },
  };
}

// ── view 5: talent-risk ──────────────────────────────────────────────────────

export async function talentRiskView(pool: Pool, orgId = DEFAULT_ORG_ID): Promise<ConsoleView> {
  const exec = createExecutiveIntelligence(pool);
  const workforceRisk = (await tableExists(pool, 'wos_workforce_risk'))
    ? await safeCall('predictive.listWorkforceRisk', () => listWorkforceRisk(pool, { limit: 50 }))
    : ({ ok: false as const, reason: 'wos_workforce_risk absent' });
  const strategicRisks = await safeCall('m5.strategicRisks', () => exec.strategicRisks(orgId));
  const ai = (await tableExists(pool, 'wos_ai_exposure'))
    ? await safeCall('predictive.aiExposure', () => aiExposure(pool, 'all'))
    : ({ ok: false as const, reason: 'wos_ai_exposure absent' });

  const wr = workforceRisk.ok && Array.isArray(workforceRisk.value) ? workforceRisk.value : [];
  const sr = strategicRisks.ok && Array.isArray(strategicRisks.value) ? strategicRisks.value : [];
  const aiRows = ai.ok && Array.isArray(ai.value) ? ai.value.slice(0, 25) : [];
  const available = wr.length > 0 || sr.length > 0 || aiRows.length > 0;
  const notes: string[] = [];
  if (!workforceRisk.ok) notes.push((workforceRisk as any).reason);
  if (!ai.ok) notes.push((ai as any).reason);

  return {
    view: 'talent-risk',
    available,
    abstained: !available,
    reason: available ? null : 'no workforce-risk, strategic-risk, or AI-exposure rows',
    provenance: {
      engines: ['predictive-workforce-engine.{listWorkforceRisk,aiExposure}', 'm5-executive-intelligence.strategicRisks'],
      tables: ['wos_workforce_risk', 'wos_ai_exposure', 'm5_strategic_workforce_risks'],
      notes: notes.length ? notes : undefined,
    },
    data: {
      org_id: orgId,
      workforce_risk: wr,
      strategic_risks: sr,
      ai_exposure: aiRows,
      coverage: { workforce_risk: wr.length, strategic_risks: sr.length, ai_exposure: aiRows.length },
    },
  };
}

// ── view 6: talent-forecasting (TRENDS, >=2 points) ──────────────────────────

async function dailyAvgSeries(pool: Pool, table: string, valueCol: string): Promise<number[]> {
  if (!(await tableExists(pool, table))) return [];
  try {
    const r = await pool.query(
      `SELECT captured_at::date AS d, AVG(${valueCol})::float8 AS v
         FROM ${table}
        WHERE ${valueCol} IS NOT NULL
        GROUP BY captured_at::date
        ORDER BY captured_at::date ASC`,
    );
    return r.rows.map((row: any) => Number(row.v)).filter((n) => Number.isFinite(n));
  } catch {
    return [];
  }
}

export async function talentForecastingView(pool: Pool): Promise<ConsoleView> {
  const riskSeries = await dailyAvgSeries(pool, 'wos_workforce_risk', 'risk_score');
  const obsSeries = await dailyAvgSeries(pool, 'wos_skill_obsolescence', 'obsolescence_score');
  const marketSeries = await dailyAvgSeries(pool, 'wos_market_signals', 'metric_value');

  const riskTrend = buildTrend('workforce_risk', 'Avg workforce risk (per snapshot date)', riskSeries);
  const obsTrend = buildTrend('skill_obsolescence', 'Avg skill obsolescence (per snapshot date)', obsSeries);
  const marketTrend = buildTrend('market_signal', 'Avg market signal value (per snapshot date)', marketSeries);

  const emerging = (await tableExists(pool, 'wos_role_emergence'))
    ? await safeCall('predictive.listEmergingRoles', () => listEmergingRoles(pool))
    : ({ ok: false as const, reason: 'wos_role_emergence absent' });
  const emergingRoles = emerging.ok && Array.isArray(emerging.value) ? emerging.value : [];

  const trends = [riskTrend, obsTrend, marketTrend];
  const anyTrend = trends.some((t) => t.available);
  const available = anyTrend || emergingRoles.length > 0;

  return {
    view: 'talent-forecasting',
    available,
    abstained: !available,
    reason: available ? null : 'no trend has >= 2 longitudinal points and no emerging-role indicators',
    provenance: {
      engines: ['predictive-workforce-engine.listEmergingRoles', 'wc3/longitudinal-consumption.{leastSquaresSlope,directionOf}'],
      tables: ['wos_workforce_risk', 'wos_skill_obsolescence', 'wos_market_signals', 'wos_role_emergence'],
      notes: [
        'Forecasts are least-squares projections over per-date snapshot averages; any series with < 2 ' +
        'points abstains (no fabricated slope). Emerging roles are a forward indicator, not a trend.',
      ],
    },
    data: {
      trends: { workforce_risk: riskTrend, skill_obsolescence: obsTrend, market_signal: marketTrend },
      emerging_roles: emergingRoles,
      coverage: {
        trends_available: trends.filter((t) => t.available).length,
        trends_abstained: trends.filter((t) => t.abstained).length,
        emerging_roles: emergingRoles.length,
      },
    },
  };
}

// ── view 7: readiness-forecasting (TRENDS, >=2 points; k-anon cohort) ─────────

export async function readinessForecastingView(pool: Pool, orgId = DEFAULT_ORG_ID): Promise<ConsoleView> {
  const wfi = createWorkforceIntelligence(pool);
  const enterprise = await safeCall('m5.readiness', () => wfi.readiness(orgId));

  let subjectTrends: Array<{ subject_id: string } & TrendResult> = [];
  let distinctSubjects = 0;
  let cohortLatestAvg: ReturnType<typeof kGate<number | null>> = { suppressed: false, reason: null, value: null };

  if (await tableExists(pool, 'career_readiness_history')) {
    const series = await safeCall('readiness.series', () =>
      pool.query(
        `SELECT subject_id, overall_score, measurable, created_at
           FROM career_readiness_history
          WHERE measurable = true AND overall_score IS NOT NULL
          ORDER BY subject_id ASC, created_at ASC`,
      ),
    );
    if (series.ok) {
      const bySubject = new Map<string, number[]>();
      const latestBySubject = new Map<string, number>();
      for (const row of series.value.rows as any[]) {
        const sid = String(row.subject_id);
        const v = Number(row.overall_score);
        if (!Number.isFinite(v)) continue;
        if (!bySubject.has(sid)) bySubject.set(sid, []);
        bySubject.get(sid)!.push(v);
        latestBySubject.set(sid, v); // ordered asc → last write is newest
      }
      distinctSubjects = bySubject.size;
      subjectTrends = Array.from(bySubject.entries()).map(([sid, vals]) => ({
        subject_id: sid,
        ...buildTrend('readiness', `Readiness trend — ${sid}`, vals),
      }));
      // Cohort latest-readiness average, k-anon gated across distinct subjects.
      const latest = Array.from(latestBySubject.values());
      const rawAvg = latest.length ? round2(latest.reduce((a, b) => a + b, 0) / latest.length) : null;
      cohortLatestAvg = kGate(distinctSubjects, rawAvg);
    }
  }

  const measurableTrends = subjectTrends.filter((t) => t.available).length;
  // HONESTY: m5 readiness() returns { readiness_score: 0, departments: [] } when NO department
  // rows exist — that 0 is a fabricated sentinel, not a measured score. Treat enterprise readiness
  // as measurable ONLY when its source evidence (departments) is non-empty; else surface null.
  const enterpriseDepts = (enterprise.ok && Array.isArray((enterprise.value as any)?.departments))
    ? ((enterprise.value as any).departments as any[]).length
    : 0;
  const enterpriseMeasurable = enterprise.ok && enterprise.value != null && enterpriseDepts > 0;
  const available = measurableTrends > 0 || enterpriseMeasurable;

  return {
    view: 'readiness-forecasting',
    available,
    abstained: !available,
    reason: available ? null : 'no subject has >= 2 readiness points and no enterprise readiness snapshot',
    provenance: {
      engines: ['m5-workforce-intelligence.readiness', 'wc3/longitudinal-consumption.{leastSquaresSlope,directionOf}'],
      tables: ['career_readiness_history', 'm5_department_capability_scores'],
      notes: [
        'Per-subject readiness trends require >= 2 measurable points (else abstain). The cohort-average ' +
        'is k-anonymity suppressed below k=30 distinct subjects.',
      ],
    },
    data: {
      org_id: orgId,
      enterprise_readiness: enterpriseMeasurable ? enterprise.value : null,
      enterprise_readiness_measurable: enterpriseMeasurable,
      subject_trends: subjectTrends,
      distinct_subjects: distinctSubjects,
      cohort_latest_readiness_avg: cohortLatestAvg.value,
      cohort_suppressed: cohortLatestAvg.suppressed,
      cohort_suppression_reason: cohortLatestAvg.reason,
      coverage: { subject_trends_available: measurableTrends, subject_trends_abstained: subjectTrends.length - measurableTrends },
    },
  };
}

// ── overview (folds all 7) ───────────────────────────────────────────────────

export async function consoleOverview(pool: Pool, orgId = DEFAULT_ORG_ID): Promise<{
  engine: string;
  version: string;
  org_id: string;
  generated_at: string;
  views: Record<string, { available: boolean; abstained: boolean; reason: string | null; provenance: ViewProvenance }>;
  summary: { total_views: number; available: number; abstained: number };
  disclaimer: string;
}> {
  const [skillGap, succession, mobility, planning, risk, talentForecast, readinessForecast] = await Promise.all([
    skillGapView(pool, orgId),
    successionView(pool, orgId),
    mobilityView(pool, orgId),
    workforcePlanningView(pool, orgId),
    talentRiskView(pool, orgId),
    talentForecastingView(pool),
    readinessForecastingView(pool, orgId),
  ]);
  const all = [skillGap, succession, mobility, planning, risk, talentForecast, readinessForecast];
  const views: Record<string, any> = {};
  for (const v of all) {
    views[v.view] = { available: v.available, abstained: v.abstained, reason: v.reason, provenance: v.provenance };
  }
  return {
    engine: 'enterprise-workforce-console',
    version: ENTERPRISE_WORKFORCE_CONSOLE_VERSION,
    org_id: orgId,
    generated_at: new Date().toISOString(),
    views,
    summary: {
      total_views: all.length,
      available: all.filter((v) => v.available).length,
      abstained: all.filter((v) => v.abstained).length,
    },
    disclaimer: ENTERPRISE_WORKFORCE_DISCLAIMER,
  };
}

// ── persona-scoped composition (employer aggregate · employee self) ──────────
//
// The console above is SuperAdmin-scoped. Employers and employees cannot reach it.
// These helpers re-use the SAME view functions (compose-never-recompute) but expose
// only what each persona is allowed to see:
//   - EMPLOYER: org-level AGGREGATE developmental views (skill-gap, talent-risk,
//     talent-forecasting). Person-level succession/mobility candidates name
//     individuals and stay SuperAdmin-only — they are EXCLUDED here.
//   - EMPLOYEE: strictly self-scoped (own readiness trend, IDOR-guarded at the route)
//     plus role-general future-readiness signals, disclosed as NOT personalized.

export const EMPLOYER_WORKFORCE_DISCLAIMER =
  'Employer workforce intelligence surfaces ORG-LEVEL AGGREGATE developmental and planning signals ' +
  'only. It is NOT a hiring, promotion, or suitability prediction, and it does NOT name individuals ' +
  '(person-level succession/mobility is SuperAdmin-scoped and excluded). In this environment the data ' +
  'reflects the platform organization, not a pipeline-partitioned view. Coverage and Confidence are ' +
  'reported separately; unmeasured signals abstain (null), cohort aggregates suppressed below k=30.';

export const EMPLOYEE_WORKFORCE_DISCLAIMER =
  'Your workforce outlook is SELF-SCOPED: the readiness trend is YOUR own measurable history only. ' +
  'Future-readiness signals are ROLE-GENERAL market indicators, NOT personalized predictions about you. ' +
  'It is developmental, never an evaluation against peers. Unmeasured signals say "insufficient history", ' +
  'never a fabricated 0; predictive signals are shown as direction + confidence, never "X% likely".';

/** Self-scoped readiness trend for ONE subject (employee). IDOR is enforced at the route. */
export async function subjectReadinessTrendView(pool: Pool, subjectId: string): Promise<ConsoleView> {
  if (!subjectId) {
    return {
      view: 'my-readiness-trend', available: false, abstained: true,
      reason: 'no authenticated subject resolved',
      provenance: { engines: [], tables: ['career_readiness_history'] },
      data: { subject_id: null, trend: null },
    };
  }
  let trend: TrendResult | null = null;
  if (await tableExists(pool, 'career_readiness_history')) {
    const r = await safeCall('readiness.subjectSeries', () =>
      pool.query(
        `SELECT overall_score
           FROM career_readiness_history
          WHERE subject_id = $1 AND measurable = true AND overall_score IS NOT NULL
          ORDER BY created_at ASC`,
        [subjectId],
      ),
    );
    if (r.ok) {
      const vals = (r.value.rows as any[]).map((x) => Number(x.overall_score)).filter((n) => Number.isFinite(n));
      trend = buildTrend('readiness', 'My readiness trend', vals);
    }
  }
  const available = !!trend?.available;
  return {
    view: 'my-readiness-trend',
    available,
    abstained: !available,
    reason: available ? null : (trend?.reason ?? 'no measurable readiness history for this subject'),
    provenance: {
      engines: ['wc3/longitudinal-consumption.{leastSquaresSlope,directionOf}'],
      tables: ['career_readiness_history'],
      notes: ["Self-scoped: only this subject's own measurable readiness points; < 2 points abstains."],
    },
    data: { subject_id: subjectId, trend },
  };
}

/** Employer-safe fold — org-level AGGREGATE developmental views ONLY (no person-level rows). */
export async function employerWorkforceOverview(pool: Pool, orgId = DEFAULT_ORG_ID): Promise<{
  engine: string; version: string; scope: string; org_id: string; generated_at: string;
  views: Record<string, ConsoleView>;
  summary: { total_views: number; available: number; abstained: number };
  notes: string[]; disclaimer: string;
}> {
  const [skillGap, risk, forecast] = await Promise.all([
    skillGapView(pool, orgId),
    talentRiskView(pool, orgId),
    talentForecastingView(pool),
  ]);
  const all = [skillGap, risk, forecast];
  const views: Record<string, ConsoleView> = {};
  for (const v of all) views[v.view] = v;
  return {
    engine: 'employer-workforce',
    version: ENTERPRISE_WORKFORCE_CONSOLE_VERSION,
    scope: 'employer',
    org_id: orgId,
    generated_at: new Date().toISOString(),
    views,
    summary: {
      total_views: all.length,
      available: all.filter((v) => v.available).length,
      abstained: all.filter((v) => v.abstained).length,
    },
    notes: [
      'Employer scope = org-level aggregate developmental signals (skill-gap, talent-risk, ' +
      'talent-forecasting). Person-level succession/mobility candidates are SuperAdmin-scoped and excluded.',
    ],
    disclaimer: EMPLOYER_WORKFORCE_DISCLAIMER,
  };
}

/** Employee-safe fold — self readiness trend + role-general future-readiness (not personalized). */
export async function employeeWorkforceOverview(pool: Pool, subjectId: string): Promise<{
  engine: string; version: string; scope: string; subject_id: string | null; generated_at: string;
  my_readiness_trend: ConsoleView;
  future_readiness: { view: string; available: boolean; abstained: boolean; reason: string | null; provenance: ViewProvenance; personalized: false; data: { emerging_roles: any[]; trends: any } };
  notes: string[]; disclaimer: string;
}> {
  const [trendView, forecast] = await Promise.all([
    subjectReadinessTrendView(pool, subjectId),
    talentForecastingView(pool),
  ]);
  const fd: any = forecast.data ?? {};
  return {
    engine: 'employee-workforce',
    version: ENTERPRISE_WORKFORCE_CONSOLE_VERSION,
    scope: 'employee-self',
    subject_id: subjectId || null,
    generated_at: new Date().toISOString(),
    my_readiness_trend: trendView,
    future_readiness: {
      view: 'future-readiness',
      available: forecast.available,
      abstained: forecast.abstained,
      reason: forecast.reason,
      provenance: forecast.provenance,
      personalized: false,
      data: { emerging_roles: Array.isArray(fd.emerging_roles) ? fd.emerging_roles : [], trends: fd.trends ?? null },
    },
    notes: [
      'Self-scoped: readiness trend is your own measurable history (IDOR-guarded). Future-readiness ' +
      'signals are role-general market indicators, NOT personalized predictions.',
    ],
    disclaimer: EMPLOYEE_WORKFORCE_DISCLAIMER,
  };
}
