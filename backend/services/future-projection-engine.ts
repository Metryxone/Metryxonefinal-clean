/**
 * PHASE 4.8 — Future Projection Engine.
 *
 * A pure, read-only, never-throws layer that COMPOSES the already-built
 * longitudinal trend engine (competency-runtime → computeProfileTrends, which
 * itself reuses the WC-L2 least-squares slope) to project each measured onto-
 * domain LEVEL forward — "if your current growth trajectory continues N more
 * re-assessments, your levels would be …" — and then feeds those projected
 * levels into the Career Simulation engine to answer "…and these roles would
 * become available."
 *
 * Honesty contract (non-negotiable):
 *   - A projection is ONLY a `last + slope × periods` extrapolation of an
 *     ALREADY-COMPUTED trend (no new model, no curve fitting beyond the existing
 *     least-squares slope). It NEVER fabricates a forward level.
 *   - Trendability is data-bound: a domain needs >= 2 measured snapshots to have
 *     a slope. With < 2 observations a domain is honestly `projectable:false`
 *     (projected_level null) — never extrapolated from a single point.
 *   - Projected levels are clamped to the real 1–5 scale and clearly labelled as
 *     a PROJECTION (a trajectory estimate), never measured attainment.
 *   - Read-only & never-throws: the trend source is guarded; ZERO DDL on the read
 *     path (computeProfileTrends' ensure is gated by the simulation context probe
 *     in the route layer / the simulation engine it composes).
 *   - Outputs are DEVELOPMENTAL SIGNALS ONLY — never hiring/promotion predictions.
 */

import type { Pool } from 'pg';
import {
  computeProfileTrends,
  MEASURABLE_ONTO_DOMAINS,
  ONTO_DOMAIN_LABEL,
  type MetricTrend,
} from './competency-runtime.js';
import { leastSquaresSlope, directionOf } from './wc3/longitudinal-consumption.js';
import { competencyRuntimeReady } from './career-gap-engine.js';
import {
  buildCareerSimulation,
  type CareerSimulationEnvelope,
  type SimChange,
} from './career-simulation-engine.js';

export const FUTURE_PROJECTION_VERSION = '4.8.0';

/** Default forward horizon (number of additional re-assessment periods). */
export const DEFAULT_PERIODS = 2;

export interface DomainProjection {
  onto_domain: string;
  label: string;
  n_observed: number;
  latest_level: number | null;
  latest_score: number | null;
  level_slope_per_period: number | null;
  score_slope_per_period: number | null;
  projected_level: number | null;
  projected_score: number | null;
  direction: string;
  projectable: boolean;
  basis: string;
}

export interface FutureProjectionResult {
  ok: boolean;
  subject_id: string;
  version: string;
  generated_at: string;
  periods: number;
  snapshots: number;
  measurable: boolean;
  domains: DomainProjection[];
  /** Projectable domains only -> projected level (consumed by the simulation). */
  projected_levels: Record<string, number>;
  source_versions: Record<string, string>;
  notes: string[];
}

function clampLevel(n: number): number {
  return Math.max(1, Math.min(5, Math.round(n)));
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Project one domain trend forward. Pure. */
function projectDomain(trend: MetricTrend, periods: number): DomainProjection {
  // Level series: only snapshots where a level was actually measured.
  const levelSeries = trend.points
    .map((p) => p.level)
    .filter((l): l is number => l != null && Number.isFinite(l));
  const nLevel = levelSeries.length;
  const latestLevel = nLevel >= 1 ? levelSeries[nLevel - 1] : null;
  const levelSlope = nLevel >= 2 ? Math.round(leastSquaresSlope(levelSeries) * 1000) / 1000 : null;

  const projectable = nLevel >= 2 && levelSlope != null && latestLevel != null;
  const projectedLevel = projectable ? clampLevel(latestLevel! + levelSlope! * periods) : null;

  // Score projection (informational only) — reuses the trend's own slope/latest.
  const scoreSlope = trend.slope;
  const projectedScore =
    trend.latest != null && scoreSlope != null
      ? clampScore(trend.latest + scoreSlope * periods)
      : null;

  return {
    onto_domain: trend.key,
    label: ONTO_DOMAIN_LABEL[trend.key] ?? trend.label ?? trend.key,
    n_observed: nLevel,
    latest_level: latestLevel,
    latest_score: trend.latest,
    level_slope_per_period: levelSlope,
    score_slope_per_period: scoreSlope,
    projected_level: projectedLevel,
    projected_score: projectedScore,
    direction: levelSlope != null ? directionOf(levelSlope) : 'insufficient_data',
    projectable,
    basis: projectable
      ? `level projected as latest(${latestLevel}) + slope(${levelSlope}/period) × ${periods} periods, clamped 1–5`
      : `not projectable — only ${nLevel} measured level observation(s) (>= 2 required)`,
  };
}

/** Compute the forward projection for a subject. Read-only & never-throws. */
export async function buildFutureProjection(
  pool: Pool,
  subjectId: string,
  periods = DEFAULT_PERIODS,
): Promise<FutureProjectionResult> {
  const sid = String(subjectId ?? '').trim();
  const p = Math.max(1, Math.min(10, Math.round(Number(periods) || DEFAULT_PERIODS)));
  const notes: string[] = [];

  // GET-never-writes: computeProfileTrends -> ensureCompetencyRuntimeSchema.
  // Probe first; absent => honest empty, no DDL.
  const runtimeReady = await competencyRuntimeReady(pool).catch(() => false);
  if (!runtimeReady) {
    notes.push(
      'Projection not measurable — competency runtime schema is not initialized (read-only; no schema created).',
    );
    return {
      ok: true,
      subject_id: sid,
      version: FUTURE_PROJECTION_VERSION,
      generated_at: new Date().toISOString(),
      periods: p,
      snapshots: 0,
      measurable: false,
      domains: [],
      projected_levels: {},
      source_versions: { future_projection: FUTURE_PROJECTION_VERSION },
      notes,
    };
  }

  const trends = await computeProfileTrends(pool, sid).catch((e) => {
    notes.push(`Trends unavailable: ${e?.message ?? 'error'} (honest empty).`);
    return null;
  });

  const domains: DomainProjection[] = [];
  const projectedLevels: Record<string, number> = {};
  if (trends) {
    for (const t of trends.domains) {
      if (!MEASURABLE_ONTO_DOMAINS.has(t.key)) continue; // only measurable onto-domains
      const proj = projectDomain(t, p);
      domains.push(proj);
      if (proj.projectable && proj.projected_level != null) projectedLevels[t.key] = proj.projected_level;
    }
    domains.sort((a, b) => a.onto_domain.localeCompare(b.onto_domain));
  }

  const snapshots = trends?.snapshots ?? 0;
  const measurable = Object.keys(projectedLevels).length > 0;
  if (snapshots < 2) {
    notes.push(
      `Only ${snapshots} re-assessment snapshot(s) — at least 2 are required to project any trajectory. No forward levels fabricated.`,
    );
  } else if (!measurable) {
    notes.push('No domain had >= 2 measured level observations — nothing projectable (honest).');
  }

  return {
    ok: true,
    subject_id: sid,
    version: FUTURE_PROJECTION_VERSION,
    generated_at: new Date().toISOString(),
    periods: p,
    snapshots,
    measurable,
    domains,
    projected_levels: projectedLevels,
    source_versions: {
      future_projection: FUTURE_PROJECTION_VERSION,
      profile_trends: 'competency-runtime/computeProfileTrends',
    },
    notes,
  };
}

/** Bridge: project levels forward, then run the Career Simulation with those
 *  projected levels as the hypothetical change ("trajectory continues"). */
export interface ProjectionSimulationResult {
  projection: FutureProjectionResult;
  simulation: CareerSimulationEnvelope;
}

export async function simulateFutureTrajectory(
  pool: Pool,
  subjectId: string,
  periods = DEFAULT_PERIODS,
): Promise<ProjectionSimulationResult> {
  const projection = await buildFutureProjection(pool, subjectId, periods);
  const changes: SimChange[] = Object.entries(projection.projected_levels).map(([target, to_level]) => ({
    target,
    to_level,
  }));
  const simulation = await buildCareerSimulation(pool, subjectId, changes, 'trajectory_continues');
  if (!projection.measurable) {
    simulation.notes.push(
      'Trajectory simulation has no projected levels (insufficient longitudinal data) — simulated state equals baseline.',
    );
  }
  return { projection, simulation };
}
