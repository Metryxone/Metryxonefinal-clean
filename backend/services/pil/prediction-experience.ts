// ─────────────────────────────────────────────────────────────────────────────
// CAPADEX Phase 9 — Predictive & Outcome Intelligence (stakeholder experience layer)
//
// Composes the pure prediction engine into the stakeholder-facing shapes:
//   • Student      — Future Risks · Growth Opportunities · Recommended Priorities · Expected Outcomes
//   • Counselor    — Priority Students · Risk Clusters · Intervention Impact Forecasts (cohort)
//   • Institution  — Cohort Readiness · Trend Analysis · Development Forecasting (cohort)
//
// Read-only · deterministic · never-throws. Cohort views aggregate per-session
// predictions; nothing is fabricated — empty cohorts yield honest empty surfaces.
// ─────────────────────────────────────────────────────────────────────────────
import type { Pool } from 'pg';
import {
  buildPredictionsForSession,
  DIMENSIONS,
  type Dimension,
  type SubjectPrediction,
  type ReadinessBand,
} from './prediction-engine';

const round = (n: number, d = 4) => {
  const p = 10 ** d;
  return Math.round(n * p) / p;
};
const COHORT_CAP = 200;

// ── Student ──────────────────────────────────────────────────────────────────
export interface StudentPrediction {
  enabled: true;
  stakeholder: 'student';
  session_id: string;
  generated_at: string;
  degraded: boolean;
  future_risks: SubjectPrediction['future_risks'];
  growth_opportunities: SubjectPrediction['growth_opportunities'];
  recommended_priorities: SubjectPrediction['recommended_priorities'];
  expected_outcomes: SubjectPrediction['expected_outcomes'];
  readiness: SubjectPrediction['readiness'];
  explainability: SubjectPrediction['explainability'];
}

export async function buildStudentPrediction(pool: Pool, sessionId: string): Promise<StudentPrediction> {
  const p = await buildPredictionsForSession(pool, sessionId);
  return {
    enabled: true,
    stakeholder: 'student',
    session_id: sessionId,
    generated_at: p.generated_at,
    degraded: p.degraded,
    future_risks: p.future_risks,
    growth_opportunities: p.growth_opportunities,
    recommended_priorities: p.recommended_priorities,
    expected_outcomes: p.expected_outcomes,
    readiness: p.readiness,
    explainability: p.explainability,
  };
}

// ── Counselor (cohort) ───────────────────────────────────────────────────────
export interface PriorityStudent {
  session_id: string;
  concern_label: string | null;
  at_risk_dimensions: Dimension[];
  lowest_readiness: number;
  active_risk_count: number;
  top_risk: string | null;
  degraded: boolean;
}
export interface RiskCluster {
  dimension: Dimension;
  at_risk_count: number;
  mean_readiness: number;
  share: number; // of cohort
  sessions: string[];
}
export interface InterventionImpactForecast {
  construct: string;
  title: string;
  reach: number;                 // sessions where it applies
  mean_predicted_reduction: number;
  total_predicted_reduction: number;
}
export interface CounselorPrediction {
  enabled: true;
  stakeholder: 'counselor';
  generated_at: string;
  cohort_size: number;
  evaluated: number;
  degraded_sessions: number;
  priority_students: PriorityStudent[];
  risk_clusters: RiskCluster[];
  intervention_impact_forecasts: InterventionImpactForecast[];
}

async function loadCohort(pool: Pool, sessionIds: string[]): Promise<SubjectPrediction[]> {
  const ids = sessionIds.slice(0, COHORT_CAP);
  const out: SubjectPrediction[] = [];
  for (const id of ids) {
    try { out.push(await buildPredictionsForSession(pool, id)); } catch { /* skip unreadable */ }
  }
  return out;
}

export async function buildCounselorPrediction(pool: Pool, sessionIds: string[]): Promise<CounselorPrediction> {
  const cohort = await loadCohort(pool, sessionIds);
  const generatedAt = new Date().toISOString();

  const priority: PriorityStudent[] = cohort.map((p) => {
    const atRisk = p.readiness.filter((r) => r.band === 'at_risk').map((r) => r.dimension);
    const lowest = p.readiness.reduce((m, r) => Math.min(m, r.score), 1);
    return {
      session_id: p.subject_id,
      concern_label: p.concern_label,
      at_risk_dimensions: atRisk,
      lowest_readiness: round(lowest),
      active_risk_count: p.future_risks.length,
      top_risk: p.future_risks[0]?.label ?? null,
      degraded: p.degraded,
    };
  }).sort((a, b) =>
    a.lowest_readiness - b.lowest_readiness ||
    b.active_risk_count - a.active_risk_count ||
    a.session_id.localeCompare(b.session_id),
  );

  const clusters: RiskCluster[] = DIMENSIONS.map((dim) => {
    const atRisk = cohort.filter((p) => p.readiness.find((r) => r.dimension === dim)?.band === 'at_risk');
    const scores = cohort.map((p) => p.readiness.find((r) => r.dimension === dim)?.score ?? 0.5);
    const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return {
      dimension: dim,
      at_risk_count: atRisk.length,
      mean_readiness: round(mean),
      share: cohort.length ? round(atRisk.length / cohort.length) : 0,
      sessions: atRisk.map((p) => p.subject_id),
    };
  }).sort((a, b) => b.at_risk_count - a.at_risk_count || a.dimension.localeCompare(b.dimension));

  // Forecast intervention impact aggregated by construct across the cohort.
  const byConstruct = new Map<string, { title: string; reach: number; total: number }>();
  for (const p of cohort) {
    for (const im of p.intervention_impact) {
      const key = im.construct || im.key;
      const cur = byConstruct.get(key) ?? { title: im.title, reach: 0, total: 0 };
      cur.reach += 1;
      cur.total += im.predicted_reduction;
      byConstruct.set(key, cur);
    }
  }
  const forecasts: InterventionImpactForecast[] = [...byConstruct.entries()].map(([construct, v]) => ({
    construct,
    title: v.title,
    reach: v.reach,
    mean_predicted_reduction: round(v.reach ? v.total / v.reach : 0),
    total_predicted_reduction: round(v.total),
  })).sort((a, b) => b.total_predicted_reduction - a.total_predicted_reduction || a.construct.localeCompare(b.construct));

  return {
    enabled: true,
    stakeholder: 'counselor',
    generated_at: generatedAt,
    cohort_size: sessionIds.length,
    evaluated: cohort.length,
    degraded_sessions: cohort.filter((p) => p.degraded).length,
    priority_students: priority,
    risk_clusters: clusters,
    intervention_impact_forecasts: forecasts,
  };
}

// ── Institution (cohort) ─────────────────────────────────────────────────────
export interface CohortReadinessRow {
  dimension: Dimension;
  mean_current: number;
  mean_expected: number;
  mean_uplift: number;
  band_distribution: Record<ReadinessBand, number>;
}
export interface DevelopmentForecast {
  dimension: Dimension;
  current_on_track_share: number;
  expected_on_track_share: number;
  projected_improvement_share: number;
}
export interface InstitutionPrediction {
  enabled: true;
  stakeholder: 'institution';
  generated_at: string;
  cohort_size: number;
  evaluated: number;
  degraded_sessions: number;
  cohort_readiness: CohortReadinessRow[];
  trend_analysis: {
    mean_chain_completeness: number;
    mean_explainability: number;
    dominant_risk_dimension: Dimension | null;
    note: string;
  };
  development_forecasting: DevelopmentForecast[];
}

export async function buildInstitutionPrediction(pool: Pool, sessionIds: string[]): Promise<InstitutionPrediction> {
  const cohort = await loadCohort(pool, sessionIds);
  const generatedAt = new Date().toISOString();
  const n = cohort.length;

  const cohortReadiness: CohortReadinessRow[] = DIMENSIONS.map((dim) => {
    const rows = cohort.map((p) => p.readiness.find((r) => r.dimension === dim)).filter(Boolean) as SubjectPrediction['readiness'];
    const dist: Record<ReadinessBand, number> = { on_track: 0, developing: 0, at_risk: 0 };
    let cur = 0, exp = 0, up = 0;
    for (const r of rows) {
      dist[r.band] += 1;
      cur += r.score; exp += r.expected_outcome.score; up += r.expected_outcome.uplift;
    }
    const m = rows.length || 1;
    return {
      dimension: dim,
      mean_current: round(cur / m),
      mean_expected: round(exp / m),
      mean_uplift: round(up / m),
      band_distribution: dist,
    };
  });

  const meanChain = n ? cohort.reduce((a, p) => a + p.explainability.chain_completeness, 0) / n : 0;
  const meanExpl = n ? cohort.reduce((a, p) => a + p.explainability.score, 0) / n : 0;
  const dominantRisk = [...cohortReadiness].sort((a, b) =>
    (b.band_distribution.at_risk) - (a.band_distribution.at_risk))[0];

  const forecasting: DevelopmentForecast[] = cohortReadiness.map((row) => {
    const onTrackNow = n ? row.band_distribution.on_track / n : 0;
    // Sessions whose EXPECTED band reaches on_track.
    const expOnTrack = cohort.filter((p) => p.readiness.find((r) => r.dimension === row.dimension)?.expected_outcome.band === 'on_track').length;
    const improving = cohort.filter((p) => {
      const r = p.readiness.find((x) => x.dimension === row.dimension);
      return r && r.expected_outcome.uplift > 0;
    }).length;
    return {
      dimension: row.dimension,
      current_on_track_share: round(onTrackNow),
      expected_on_track_share: round(n ? expOnTrack / n : 0),
      projected_improvement_share: round(n ? improving / n : 0),
    };
  });

  return {
    enabled: true,
    stakeholder: 'institution',
    generated_at: generatedAt,
    cohort_size: sessionIds.length,
    evaluated: n,
    degraded_sessions: cohort.filter((p) => p.degraded).length,
    cohort_readiness: cohortReadiness,
    trend_analysis: {
      mean_chain_completeness: round(meanChain),
      mean_explainability: round(meanExpl),
      dominant_risk_dimension: dominantRisk && dominantRisk.band_distribution.at_risk > 0 ? dominantRisk.dimension : null,
      note: n === 0
        ? 'No readable sessions in cohort — nothing to trend (honest empty).'
        : `Aggregated over ${n} session(s); trend is cross-sectional (no longitudinal series yet).`,
    },
    development_forecasting: forecasting,
  };
}
