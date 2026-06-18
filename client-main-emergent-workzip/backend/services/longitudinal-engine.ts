/**
 * Phase 4 — Longitudinal Intelligence Engine.
 *
 * Reads p4_competency_history (append-only). Derives:
 *   - development velocity per competency
 *   - growth trajectory bands (conservative — never asserts hiring/promotion)
 *   - capability maturity transitions
 *
 * All projections are presented as RANGES with confidence bands.
 * Language policy: developmental readiness / trajectory indicators only.
 */
import type { Pool } from 'pg';

export const LONGITUDINAL_VERSION = '4.0.0';
export const TRAJECTORY_VERSION = '4.0.0';

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();
const cached = async <T>(k: string, get: () => Promise<T>): Promise<T> => {
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const v = await get();
  cache.set(k, { at: Date.now(), value: v });
  return v;
};

export interface HistoryPoint { captured_at: string; score: number; source: string; session_id: string | null }
export interface CompetencyHistory {
  competency_id: string;
  canonical_name: string;
  points: HistoryPoint[];
  current: number | null;
  baseline: number | null;
  observation_count: number;
}

export async function getUserHistory(pool: Pool, userId: string, competencyId?: string): Promise<CompetencyHistory[]> {
  return cached(`p4:hist:${userId}:${competencyId ?? '*'}`, async () => {
    const { rows } = await pool.query<{
      competency_id: string; canonical_name: string; captured_at: string;
      score: string; source: string; session_id: string | null;
    }>(`
      SELECT h.competency_id, c.canonical_name, h.captured_at,
             h.score::text AS score, h.source, h.session_id
        FROM p4_competency_history h
        JOIN onto_competencies c ON c.id = h.competency_id
       WHERE h.user_id = $1
         AND ($2::text IS NULL OR h.competency_id = $2)
       ORDER BY h.competency_id, h.captured_at ASC
    `, [userId, competencyId ?? null]);

    const byComp = new Map<string, CompetencyHistory>();
    for (const r of rows) {
      let agg = byComp.get(r.competency_id);
      if (!agg) {
        agg = { competency_id: r.competency_id, canonical_name: r.canonical_name,
                points: [], current: null, baseline: null, observation_count: 0 };
        byComp.set(r.competency_id, agg);
      }
      agg.points.push({ captured_at: r.captured_at, score: parseFloat(r.score),
                        source: r.source, session_id: r.session_id });
    }
    for (const agg of byComp.values()) {
      agg.observation_count = agg.points.length;
      if (agg.points.length) {
        agg.baseline = agg.points[0].score;
        agg.current = agg.points[agg.points.length - 1].score;
      }
    }
    return Array.from(byComp.values());
  });
}

// ---- velocity --------------------------------------------------------------

export interface VelocityResult {
  competency_id: string;
  canonical_name: string;
  period_start: string;
  period_end: string;
  start_score: number;
  end_score: number;
  delta_score: number;
  velocity_pts_per_30d: number;
  trend: 'accelerating' | 'steady' | 'plateau' | 'declining' | 'insufficient_data';
  momentum_score: number;
  consistency: number;
  sample_count: number;
}

function daysBetween(a: string, b: string): number {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

/** Pure: compute velocity for a series of points (chronological). */
export function computeVelocity(points: HistoryPoint[]): Omit<VelocityResult, 'competency_id' | 'canonical_name'> | null {
  if (points.length < 2) return null;
  const first = points[0], last = points[points.length - 1];
  const span = daysBetween(first.captured_at, last.captured_at);
  const delta = last.score - first.score;
  const velocity = (delta / span) * 30;

  // EWMA over per-step deltas for momentum (alpha=0.30)
  const alpha = 0.30;
  let m = 0;
  for (let i = 1; i < points.length; i++) {
    const d = points[i].score - points[i - 1].score;
    m = i === 1 ? d : alpha * d + (1 - alpha) * m;
  }
  const momentum = Math.max(-100, Math.min(100, m * 4));

  // consistency = 1 - normalized stddev of per-step deltas
  const deltas = points.slice(1).map((p, i) => p.score - points[i].score);
  const mean = deltas.reduce((s, x) => s + x, 0) / deltas.length;
  const variance = deltas.reduce((s, x) => s + (x - mean) ** 2, 0) / deltas.length;
  const std = Math.sqrt(variance);
  const consistency = Math.max(0, Math.min(100, 100 - std * 6));

  let trend: VelocityResult['trend'];
  if (Math.abs(velocity) < 0.4) trend = 'plateau';
  else if (velocity >= 0 && momentum > 1.5) trend = 'accelerating';
  else if (velocity > 0) trend = 'steady';
  else trend = 'declining';

  return {
    period_start: first.captured_at,
    period_end: last.captured_at,
    start_score: Math.round(first.score * 100) / 100,
    end_score: Math.round(last.score * 100) / 100,
    delta_score: Math.round(delta * 100) / 100,
    velocity_pts_per_30d: Math.round(velocity * 1000) / 1000,
    trend,
    momentum_score: Math.round(momentum * 100) / 100,
    consistency: Math.round(consistency * 100) / 100,
    sample_count: points.length,
  };
}

export async function getUserVelocity(pool: Pool, userId: string): Promise<VelocityResult[]> {
  const histories = await getUserHistory(pool, userId);
  const out: VelocityResult[] = [];
  for (const h of histories) {
    const v = computeVelocity(h.points);
    if (!v) continue;
    out.push({ competency_id: h.competency_id, canonical_name: h.canonical_name, ...v });
  }
  return out.sort((a, b) => Math.abs(b.velocity_pts_per_30d) - Math.abs(a.velocity_pts_per_30d));
}

// ---- trajectory ------------------------------------------------------------

const CONFIDENCE_BANDS = [
  { min_n: 12, band: 'A' as const },
  { min_n: 8,  band: 'B' as const },
  { min_n: 5,  band: 'C' as const },
  { min_n: 3,  band: 'D' as const },
];
function confidenceBand(n: number): 'A' | 'B' | 'C' | 'D' | 'provisional' {
  for (const c of CONFIDENCE_BANDS) if (n >= c.min_n) return c.band;
  return 'provisional';
}

export interface TrajectoryResult {
  competency_id: string;
  canonical_name: string;
  baseline: number;
  current: number;
  projection_lower: number;
  projection_upper: number;
  horizon_months: number;
  trajectory_type: 'accelerating' | 'steady' | 'plateau' | 'declining' | 'volatile';
  confidence_band: 'A' | 'B' | 'C' | 'D' | 'provisional';
  observation_count: number;
  methodology_version: string;
}

/**
 * Conservative trajectory band: project forward using EWMA-smoothed velocity,
 * widened by (1 - consistency/100) * spread. Never an exact prediction.
 */
export function computeTrajectory(points: HistoryPoint[], horizonMonths = 6): TrajectoryResult | null {
  if (points.length < 2) return null;
  const v = computeVelocity(points)!;
  const baseline = points[0].score;
  const current = points[points.length - 1].score;
  const projCenter = current + v.velocity_pts_per_30d * horizonMonths;

  // band widens with low consistency; minimum ±2 pts
  const widthFactor = Math.max(2, (1 - v.consistency / 100) * 18);
  const lower = Math.max(0, Math.min(100, projCenter - widthFactor));
  const upper = Math.max(0, Math.min(100, projCenter + widthFactor));

  let trajectory_type: TrajectoryResult['trajectory_type'];
  if (v.consistency < 35) trajectory_type = 'volatile';
  else if (v.trend === 'accelerating') trajectory_type = 'accelerating';
  else if (v.trend === 'declining') trajectory_type = 'declining';
  else if (v.trend === 'plateau') trajectory_type = 'plateau';
  else trajectory_type = 'steady';

  return {
    competency_id: '', canonical_name: '',
    baseline: Math.round(baseline * 100) / 100,
    current: Math.round(current * 100) / 100,
    projection_lower: Math.round(lower * 100) / 100,
    projection_upper: Math.round(upper * 100) / 100,
    horizon_months: horizonMonths,
    trajectory_type,
    confidence_band: confidenceBand(points.length),
    observation_count: points.length,
    methodology_version: TRAJECTORY_VERSION,
  };
}

export async function getUserTrajectory(pool: Pool, userId: string, horizonMonths = 6): Promise<TrajectoryResult[]> {
  const hist = await getUserHistory(pool, userId);
  const out: TrajectoryResult[] = [];
  for (const h of hist) {
    const t = computeTrajectory(h.points, horizonMonths);
    if (!t) continue;
    out.push({ ...t, competency_id: h.competency_id, canonical_name: h.canonical_name });
  }
  return out;
}

// ---- maturity tracking -----------------------------------------------------

/** Heuristic level mapping based on score thresholds. */
function scoreToLevel(score: number): number {
  if (score >= 92) return 5;
  if (score >= 80) return 4;
  if (score >= 65) return 3;
  if (score >= 50) return 2;
  return 1;
}

export interface MaturityTransition {
  competency_id: string;
  canonical_name: string;
  current_level: number;
  previous_level: number | null;
  transitions: { from: number | null; to: number; at: string }[];
  stability_index: number;        // 0-100 — fraction of period at current level
  consistency_score: number;      // mirrors velocity consistency
}

export async function getMaturityTracking(pool: Pool, userId: string): Promise<MaturityTransition[]> {
  const hist = await getUserHistory(pool, userId);
  const out: MaturityTransition[] = [];
  for (const h of hist) {
    if (!h.points.length) continue;
    const transitions: MaturityTransition['transitions'] = [];
    let lastLevel: number | null = null;
    for (const p of h.points) {
      const lvl = scoreToLevel(p.score);
      if (lvl !== lastLevel) {
        transitions.push({ from: lastLevel, to: lvl, at: p.captured_at });
        lastLevel = lvl;
      }
    }
    const v = computeVelocity(h.points);
    const stability = transitions.length <= 1 ? 100
      : Math.max(0, 100 - (transitions.length - 1) * 18);
    const currentLevel = scoreToLevel(h.current ?? 0);
    const prevLevel = transitions.length >= 2 ? transitions[transitions.length - 2].to : null;
    out.push({
      competency_id: h.competency_id,
      canonical_name: h.canonical_name,
      current_level: currentLevel,
      previous_level: prevLevel,
      transitions,
      stability_index: stability,
      consistency_score: v?.consistency ?? 0,
    });
  }
  return out;
}

// ---- write helpers ---------------------------------------------------------

export async function recordCompetencyHistory(pool: Pool, params: {
  user_id: string; session_id?: string; competency_id: string;
  score: number; source: string;
}): Promise<void> {
  const id = `ph_${params.user_id}_${params.competency_id}_${Date.now()}`;
  await pool.query(
    `INSERT INTO p4_competency_history (id, user_id, session_id, competency_id, score, source, methodology_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [id, params.user_id, params.session_id ?? null, params.competency_id, params.score,
     params.source, LONGITUDINAL_VERSION]);
}
