/**
 * LBI Longitudinal Engine  (W8)
 *
 * Computes a per-user trajectory snapshot from lbi_score_history.
 * Classifies trajectory as: improving · stable · declining · insufficient_data
 *
 * Additive · never-throws.
 */

import pg from 'pg';

export type Trajectory = 'improving' | 'stable' | 'declining' | 'insufficient_data';
export type TrajectoryConfidence = 'high' | 'medium' | 'low';

export interface LongitudinalSnapshot {
  email: string;
  trajectory: Trajectory;
  trajectory_confidence: TrajectoryConfidence;
  weeks_tracked: number;
  start_lbi: number | null;
  current_lbi: number | null;
  total_change: number | null;
  change_rate: number | null;          // points per week
  strongest_gain_dimension: string | null;
  most_needs_work_dimension: string | null;
  snapshots_count: number;
  computed_at: string;
}

const DIMENSIONS = [
  'consistency_score', 'persistence_score', 'attention_score',
  'adaptability_score', 'velocity_score',
] as const;

const DIM_LABELS: Record<string, string> = {
  consistency_score: 'Consistency', persistence_score: 'Persistence',
  attention_score: 'Attention',     adaptability_score: 'Adaptability',
  velocity_score: 'Velocity',
};

// ── Schema ────────────────────────────────────────────────────────────────────

let schemaReady = false;

async function ensureSchema(pool: pg.Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lbi_longitudinal_snapshots (
      id                         SERIAL PRIMARY KEY,
      user_email                 TEXT    NOT NULL UNIQUE,
      trajectory                 TEXT    DEFAULT 'insufficient_data',
      trajectory_confidence      TEXT    DEFAULT 'low',
      weeks_tracked              INTEGER DEFAULT 0,
      start_lbi                  NUMERIC(5,2),
      current_lbi                NUMERIC(5,2),
      total_change               NUMERIC(5,2),
      change_rate                NUMERIC(7,4),
      strongest_gain_dimension   TEXT,
      most_needs_work_dimension  TEXT,
      snapshots_count            INTEGER DEFAULT 0,
      computed_at                TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  schemaReady = true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function classifyTrajectory(change: number, weeks: number): Trajectory {
  const weeklyRate = weeks > 0 ? change / weeks : 0;
  if (weeklyRate >  0.5) return 'improving';
  if (weeklyRate < -0.5) return 'declining';
  return 'stable';
}

function trajectoryConfidence(snapshotCount: number, weeksTracked: number): TrajectoryConfidence {
  if (snapshotCount >= 5 && weeksTracked >= 4) return 'high';
  if (snapshotCount >= 3 && weeksTracked >= 1) return 'medium';
  return 'low';
}

// ── Compute & Persist ─────────────────────────────────────────────────────────

export async function computeAndPersistLongitudinal(
  email: string,
  pool: pg.Pool
): Promise<void> {
  try {
    await ensureSchema(pool);
    const client = await pool.connect();
    try {
      const histRes = await client.query(
        `SELECT consistency_score, persistence_score, attention_score,
                adaptability_score, velocity_score, overall_lbi, calculated_at
         FROM lbi_score_history
         WHERE user_email=$1
         ORDER BY calculated_at ASC`,   // oldest first for trajectory
        [email]
      );
      const snaps = histRes.rows;
      if (snaps.length < 1) return;

      const oldest = snaps[0];
      const newest = snaps[snaps.length - 1];

      const startLbi  = oldest.overall_lbi  != null ? Number(oldest.overall_lbi)  : null;
      const currentLbi = newest.overall_lbi != null ? Number(newest.overall_lbi)  : null;
      const totalChange = startLbi != null && currentLbi != null ? currentLbi - startLbi : null;

      const daySpan = Math.max(
        1,
        (new Date(newest.calculated_at).getTime() - new Date(oldest.calculated_at).getTime())
        / (1000 * 60 * 60 * 24)
      );
      const weeksTracked = Math.round(daySpan / 7);
      const changeRate   = totalChange != null ? totalChange / Math.max(1, weeksTracked) : null;

      const trajectory: Trajectory = totalChange != null
        ? classifyTrajectory(totalChange, weeksTracked)
        : 'insufficient_data';
      const confidence = trajectoryConfidence(snaps.length, weeksTracked);

      // Strongest gain dimension (highest delta oldest→newest)
      let strongestGain: string | null = null;
      let mostNeedsWork: string | null = null;
      let maxGain = -Infinity;
      let minCurrent = Infinity;

      for (const dim of DIMENSIONS) {
        const start   = oldest[dim]  != null ? Number(oldest[dim])  : null;
        const current = newest[dim]  != null ? Number(newest[dim])  : null;
        if (start != null && current != null) {
          const gain = current - start;
          if (gain > maxGain) { maxGain = gain; strongestGain = dim; }
        }
        if (current != null && current < minCurrent) {
          minCurrent = current; mostNeedsWork = dim;
        }
      }

      await client.query(`
        INSERT INTO lbi_longitudinal_snapshots
          (user_email, trajectory, trajectory_confidence, weeks_tracked,
           start_lbi, current_lbi, total_change, change_rate,
           strongest_gain_dimension, most_needs_work_dimension,
           snapshots_count, computed_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
        ON CONFLICT (user_email) DO UPDATE SET
          trajectory=$2, trajectory_confidence=$3, weeks_tracked=$4,
          start_lbi=$5, current_lbi=$6, total_change=$7, change_rate=$8,
          strongest_gain_dimension=$9, most_needs_work_dimension=$10,
          snapshots_count=$11, computed_at=NOW()
      `, [email, trajectory, confidence, weeksTracked, startLbi, currentLbi, totalChange, changeRate, strongestGain, mostNeedsWork, snaps.length]);

    } finally { client.release(); }
  } catch (err) {
    console.error('[lbi-longitudinal] computeAndPersistLongitudinal error:', err);
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getLongitudinal(
  email: string,
  pool: pg.Pool
): Promise<LongitudinalSnapshot & { dimension_labels: Record<string, string> }> {
  const blank = {
    email, trajectory: 'insufficient_data' as Trajectory, trajectory_confidence: 'low' as TrajectoryConfidence,
    weeks_tracked: 0, start_lbi: null, current_lbi: null, total_change: null, change_rate: null,
    strongest_gain_dimension: null, most_needs_work_dimension: null, snapshots_count: 0,
    dimension_labels: DIM_LABELS, computed_at: new Date().toISOString(),
  };
  try {
    await ensureSchema(pool);
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT * FROM lbi_longitudinal_snapshots WHERE user_email=$1 LIMIT 1`, [email]
      );
      if (!res.rows[0]) return blank;
      const r = res.rows[0];
      return {
        email,
        trajectory:               r.trajectory ?? 'insufficient_data',
        trajectory_confidence:    r.trajectory_confidence ?? 'low',
        weeks_tracked:            Number(r.weeks_tracked ?? 0),
        start_lbi:                r.start_lbi  != null ? Number(r.start_lbi)  : null,
        current_lbi:              r.current_lbi != null ? Number(r.current_lbi) : null,
        total_change:             r.total_change != null ? Number(r.total_change) : null,
        change_rate:              r.change_rate  != null ? Number(r.change_rate)  : null,
        strongest_gain_dimension: r.strongest_gain_dimension ?? null,
        most_needs_work_dimension: r.most_needs_work_dimension ?? null,
        snapshots_count:          Number(r.snapshots_count ?? 0),
        dimension_labels:         DIM_LABELS,
        computed_at: r.computed_at instanceof Date ? r.computed_at.toISOString() : String(r.computed_at),
      };
    } finally { client.release(); }
  } catch (err) {
    console.error('[lbi-longitudinal] getLongitudinal error:', err);
    return blank;
  }
}

// ── Admin aggregate ───────────────────────────────────────────────────────────

export async function getLongitudinalAggregates(pool: pg.Pool): Promise<{
  total_tracked: number;
  improving: number;
  stable: number;
  declining: number;
  insufficient_data: number;
  avg_change: number | null;
  avg_weeks: number | null;
}> {
  try {
    await ensureSchema(pool);
    const res = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE trajectory='improving')          AS improving,
        COUNT(*) FILTER (WHERE trajectory='stable')             AS stable,
        COUNT(*) FILTER (WHERE trajectory='declining')          AS declining,
        COUNT(*) FILTER (WHERE trajectory='insufficient_data')  AS insufficient_data,
        ROUND(AVG(total_change)::numeric,1)  AS avg_change,
        ROUND(AVG(weeks_tracked)::numeric,1) AS avg_weeks
      FROM lbi_longitudinal_snapshots
    `);
    const r = res.rows[0];
    return {
      total_tracked:     Number(r.total     ?? 0),
      improving:         Number(r.improving ?? 0),
      stable:            Number(r.stable    ?? 0),
      declining:         Number(r.declining ?? 0),
      insufficient_data: Number(r.insufficient_data ?? 0),
      avg_change:        r.avg_change != null ? Number(r.avg_change) : null,
      avg_weeks:         r.avg_weeks  != null ? Number(r.avg_weeks)  : null,
    };
  } catch (err) {
    console.error('[lbi-longitudinal] aggregates error:', err);
    return { total_tracked: 0, improving: 0, stable: 0, declining: 0, insufficient_data: 0, avg_change: null, avg_weeks: null };
  }
}
