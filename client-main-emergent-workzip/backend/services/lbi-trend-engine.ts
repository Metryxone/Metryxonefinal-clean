/**
 * LBI Trend Engine  (W3)
 *
 * Derives per-dimension behavior trends and overall learning trends
 * from lbi_score_history. Writes to lbi_behavior_trends + lbi_learning_trends.
 *
 * Additive · read-only from history · never-throws.
 * Minimum 2 snapshots required for any trend; 1 snapshot yields "early_stage".
 */

import pg from 'pg';

export const DIMENSIONS = [
  'consistency_score',
  'persistence_score',
  'attention_score',
  'adaptability_score',
  'velocity_score',
] as const;

export const DIMENSION_LABELS: Record<string, string> = {
  consistency_score:  'Consistency',
  persistence_score:  'Persistence',
  attention_score:    'Attention',
  adaptability_score: 'Adaptability',
  velocity_score:     'Velocity',
};

export type TrendDirection = 'improving' | 'stable' | 'declining' | 'insufficient_data';
export type EngagementArc  = 'accelerating' | 'plateauing' | 'declining' | 'early_stage';

export interface BehaviorTrend {
  dimension: string;
  dimension_label: string;
  current_score: number | null;
  previous_score: number | null;
  delta: number | null;
  direction: TrendDirection;
  velocity_per_day: number | null;
  snapshots_analyzed: number;
  computed_at: string;
}

export interface LearningTrend {
  overall_direction: TrendDirection;
  sessions_30d: number;
  avg_weekly_improvement: number | null;
  peak_dimension: string | null;
  peak_dimension_label: string | null;
  weak_dimension: string | null;
  weak_dimension_label: string | null;
  engagement_arc: EngagementArc;
  snapshots_analyzed: number;
  computed_at: string;
}

// ── Schema ────────────────────────────────────────────────────────────────────

let schemaReady = false;

async function ensureSchema(pool: pg.Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lbi_behavior_trends (
      id               SERIAL PRIMARY KEY,
      user_email       TEXT    NOT NULL,
      dimension        TEXT    NOT NULL,
      current_score    NUMERIC(5,2),
      previous_score   NUMERIC(5,2),
      delta            NUMERIC(5,2),
      direction        TEXT    DEFAULT 'insufficient_data',
      velocity_per_day NUMERIC(7,4),
      snapshots_analyzed INTEGER DEFAULT 0,
      computed_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_email, dimension)
    );
    CREATE TABLE IF NOT EXISTS lbi_learning_trends (
      id                     SERIAL PRIMARY KEY,
      user_email             TEXT NOT NULL UNIQUE,
      overall_direction      TEXT DEFAULT 'insufficient_data',
      sessions_30d           INTEGER DEFAULT 0,
      avg_weekly_improvement NUMERIC(5,2),
      peak_dimension         TEXT,
      weak_dimension         TEXT,
      engagement_arc         TEXT DEFAULT 'early_stage',
      snapshots_analyzed     INTEGER DEFAULT 0,
      computed_at            TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  schemaReady = true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function directionFromDelta(delta: number): TrendDirection {
  if (delta >=  3) return 'improving';
  if (delta <= -3) return 'declining';
  return 'stable';
}

function computeEngagementArc(snapshots: any[]): EngagementArc {
  if (snapshots.length < 2) return 'early_stage';
  const scores = snapshots
    .map(s => s.overall_lbi != null ? Number(s.overall_lbi) : null)
    .filter((v): v is number => v != null);
  if (scores.length < 3) return 'early_stage';
  const mid = Math.floor(scores.length / 2);
  // snapshots are newest-first, so scores[0] is current
  const firstHalf = scores[mid] - scores[scores.length - 1]; // oldest→mid change
  const secondHalf = scores[0] - scores[mid];                // mid→current change
  if (secondHalf > firstHalf + 2) return 'accelerating';
  if (secondHalf < firstHalf - 2) return scores[0] > scores[scores.length - 1] ? 'plateauing' : 'declining';
  return 'plateauing';
}

function daysBetween(a: string | Date, b: string | Date): number {
  return Math.max(
    0.5,
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)
  );
}

// ── Compute & Persist ─────────────────────────────────────────────────────────

export async function computeAndPersistTrends(
  email: string,
  pool: pg.Pool
): Promise<void> {
  try {
    await ensureSchema(pool);
    const client = await pool.connect();
    try {
      const histRes = await client.query(
        `SELECT consistency_score, persistence_score, attention_score,
                adaptability_score, velocity_score, overall_lbi,
                sessions_analyzed, calculated_at
         FROM lbi_score_history
         WHERE user_email = $1
         ORDER BY calculated_at DESC
         LIMIT 10`,
        [email]
      );
      const snaps = histRes.rows;
      if (snaps.length < 1) return;

      // ── Per-dimension behavior trends ──────────────────────────────────────
      for (const dim of DIMENSIONS) {
        const cur  = snaps[0]?.[dim] != null ? Number(snaps[0][dim])  : null;
        const prev = snaps[1]?.[dim] != null ? Number(snaps[1][dim])  : null;
        const delta = (cur != null && prev != null) ? cur - prev : null;
        const direction: TrendDirection = delta != null ? directionFromDelta(delta) : 'insufficient_data';

        let velPerDay: number | null = null;
        if (delta != null && snaps.length >= 2) {
          const days = daysBetween(snaps[1].calculated_at, snaps[0].calculated_at);
          velPerDay = delta / days;
        }

        await client.query(`
          INSERT INTO lbi_behavior_trends
            (user_email, dimension, current_score, previous_score, delta,
             direction, velocity_per_day, snapshots_analyzed, computed_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
          ON CONFLICT (user_email, dimension) DO UPDATE SET
            current_score=$3, previous_score=$4, delta=$5,
            direction=$6, velocity_per_day=$7, snapshots_analyzed=$8, computed_at=NOW()
        `, [email, dim, cur, prev, delta, direction, velPerDay, snaps.length]);
      }

      // ── Overall learning trend ─────────────────────────────────────────────
      const cur0  = snaps[0]?.overall_lbi != null ? Number(snaps[0].overall_lbi)  : null;
      const prev0 = snaps[1]?.overall_lbi != null ? Number(snaps[1].overall_lbi)  : null;
      const overallDelta = cur0 != null && prev0 != null ? cur0 - prev0 : null;
      const overallDir: TrendDirection = overallDelta != null ? directionFromDelta(overallDelta) : 'insufficient_data';
      const arc = computeEngagementArc(snaps);

      const s30Res = await client.query(
        `SELECT COUNT(*) AS n FROM capadex_sessions
         WHERE guest_email=$1 AND created_at > NOW() - INTERVAL '30 days'`,
        [email]
      );
      const sessions30d = Number(s30Res.rows[0]?.n ?? 0);

      let avgWeekly: number | null = null;
      if (snaps.length >= 2 && cur0 != null) {
        const oldest = snaps[snaps.length - 1];
        const totalDelta = cur0 - Number(oldest.overall_lbi ?? cur0);
        const weeks = Math.max(0.5, daysBetween(oldest.calculated_at, snaps[0].calculated_at) / 7);
        avgWeekly = totalDelta / weeks;
      }

      const dimScores = DIMENSIONS
        .map(d => ({ d, v: snaps[0]?.[d] != null ? Number(snaps[0][d]) : null }))
        .filter((x): x is { d: string; v: number } => x.v != null);
      const peakDim = dimScores.length > 0 ? dimScores.reduce((a, b) => a.v >= b.v ? a : b).d : null;
      const weakDim = dimScores.length > 0 ? dimScores.reduce((a, b) => a.v <= b.v ? a : b).d : null;

      await client.query(`
        INSERT INTO lbi_learning_trends
          (user_email, overall_direction, sessions_30d, avg_weekly_improvement,
           peak_dimension, weak_dimension, engagement_arc, snapshots_analyzed, computed_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
        ON CONFLICT (user_email) DO UPDATE SET
          overall_direction=$2, sessions_30d=$3, avg_weekly_improvement=$4,
          peak_dimension=$5, weak_dimension=$6, engagement_arc=$7,
          snapshots_analyzed=$8, computed_at=NOW()
      `, [email, overallDir, sessions30d, avgWeekly, peakDim, weakDim, arc, snaps.length]);

    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[lbi-trend] computeAndPersistTrends error:', err);
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getTrends(
  email: string,
  pool: pg.Pool
): Promise<{ behavior_trends: BehaviorTrend[]; learning_trend: LearningTrend | null; computed_at: string }> {
  try {
    await ensureSchema(pool);
    const client = await pool.connect();
    try {
      const [btRes, ltRes] = await Promise.all([
        client.query(
          `SELECT dimension, current_score, previous_score, delta,
                  direction, velocity_per_day, snapshots_analyzed, computed_at
           FROM lbi_behavior_trends WHERE user_email=$1 ORDER BY dimension`,
          [email]
        ),
        client.query(
          `SELECT * FROM lbi_learning_trends WHERE user_email=$1 LIMIT 1`,
          [email]
        ),
      ]);

      const bt: BehaviorTrend[] = btRes.rows.map(r => ({
        dimension:        r.dimension,
        dimension_label:  DIMENSION_LABELS[r.dimension] ?? r.dimension,
        current_score:    r.current_score  != null ? Number(r.current_score)  : null,
        previous_score:   r.previous_score != null ? Number(r.previous_score) : null,
        delta:            r.delta          != null ? Number(r.delta)          : null,
        direction:        r.direction as TrendDirection,
        velocity_per_day: r.velocity_per_day != null ? Number(r.velocity_per_day) : null,
        snapshots_analyzed: Number(r.snapshots_analyzed ?? 0),
        computed_at: r.computed_at instanceof Date ? r.computed_at.toISOString() : String(r.computed_at),
      }));

      const lt = ltRes.rows[0] ? {
        overall_direction:      ltRes.rows[0].overall_direction as TrendDirection,
        sessions_30d:           Number(ltRes.rows[0].sessions_30d ?? 0),
        avg_weekly_improvement: ltRes.rows[0].avg_weekly_improvement != null ? Number(ltRes.rows[0].avg_weekly_improvement) : null,
        peak_dimension:         ltRes.rows[0].peak_dimension ?? null,
        peak_dimension_label:   ltRes.rows[0].peak_dimension ? (DIMENSION_LABELS[ltRes.rows[0].peak_dimension] ?? ltRes.rows[0].peak_dimension) : null,
        weak_dimension:         ltRes.rows[0].weak_dimension ?? null,
        weak_dimension_label:   ltRes.rows[0].weak_dimension ? (DIMENSION_LABELS[ltRes.rows[0].weak_dimension] ?? ltRes.rows[0].weak_dimension) : null,
        engagement_arc:         ltRes.rows[0].engagement_arc as EngagementArc,
        snapshots_analyzed:     Number(ltRes.rows[0].snapshots_analyzed ?? 0),
        computed_at: ltRes.rows[0].computed_at instanceof Date ? ltRes.rows[0].computed_at.toISOString() : String(ltRes.rows[0].computed_at),
      } : null;

      return { behavior_trends: bt, learning_trend: lt, computed_at: new Date().toISOString() };
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[lbi-trend] getTrends error:', err);
    return { behavior_trends: [], learning_trend: null, computed_at: new Date().toISOString() };
  }
}
