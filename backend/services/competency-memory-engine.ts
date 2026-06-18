/**
 * Competency Memory Engine — Phase 5 (additive, shadow-mode).
 *
 * Append-only memory of competency evolution: score deltas, growth velocity,
 * confidence drift, leadership-layer movement, readiness band movement.
 *
 * NEVER mutates upstream scoring tables. Reads `competency_memory_history`
 * to compute deltas; writes new rows on each observation.
 */
import type { Pool } from 'pg';

export const COMPETENCY_MEMORY_VERSION = '5.0.0';

export type MemoryObservation = {
  competencyId: string;
  score?: number;
  confidence?: number;
  leadershipLayer?: string;
  readinessBand?: string;
  origin?: string;
  metadata?: Record<string, unknown>;
};

export type MemoryRecord = MemoryObservation & {
  deltaScore: number;
  deltaConfidence: number;
  growthVelocity: number;
  driftSeverity: 'none' | 'low' | 'moderate' | 'high';
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function driftFromConfidenceDelta(d: number): MemoryRecord['driftSeverity'] {
  const a = Math.abs(d);
  if (a < 0.05) return 'none';
  if (a < 0.15) return 'low';
  if (a < 0.30) return 'moderate';
  return 'high';
}

/** Pure — compute delta + velocity given the previous observation (if any). */
export function diffAgainstPrevious(
  current: MemoryObservation,
  previous: { score?: number; confidence?: number; observed_at?: string | Date } | null,
): MemoryRecord {
  const prevScore = previous?.score ?? current.score ?? 0;
  const prevConf = previous?.confidence ?? current.confidence ?? 0;
  const deltaScore = (current.score ?? prevScore) - prevScore;
  const deltaConfidence = (current.confidence ?? prevConf) - prevConf;
  let growthVelocity = 0;
  if (previous?.observed_at) {
    const prev = previous.observed_at instanceof Date ? previous.observed_at : new Date(previous.observed_at);
    if (!Number.isNaN(prev.getTime())) {
      const days = Math.max(1, (Date.now() - prev.getTime()) / 86_400_000);
      growthVelocity = clamp(deltaScore / days, -10, 10);
    }
  }
  return {
    ...current,
    deltaScore,
    deltaConfidence,
    growthVelocity,
    driftSeverity: driftFromConfidenceDelta(deltaConfidence),
  };
}

async function fetchLatest(pool: Pool, userId: string, competencyId: string) {
  try {
    const r = await pool.query(
      `SELECT score, confidence, observed_at
         FROM competency_memory_history
        WHERE user_id = $1 AND competency_id = $2
        ORDER BY observed_at DESC LIMIT 1`,
      [userId, competencyId],
    );
    return r.rows[0] ?? null;
  } catch {
    return null;
  }
}

/** Record observations as append-only memory rows. */
export async function recordObservations(
  pool: Pool,
  args: { userId: string; observations: MemoryObservation[] },
): Promise<MemoryRecord[]> {
  const out: MemoryRecord[] = [];
  for (const obs of args.observations) {
    const prev = await fetchLatest(pool, args.userId, obs.competencyId);
    const rec = diffAgainstPrevious(obs, prev);
    out.push(rec);
    try {
      await pool.query(
        `INSERT INTO competency_memory_history
           (user_id, competency_id, score, confidence, delta_score, delta_confidence,
            growth_velocity, drift_severity, leadership_layer, readiness_band, origin,
            metadata, engine_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)`,
        [
          args.userId, rec.competencyId, rec.score ?? null, rec.confidence ?? null,
          rec.deltaScore, rec.deltaConfidence, rec.growthVelocity, rec.driftSeverity,
          rec.leadershipLayer ?? null, rec.readinessBand ?? null, rec.origin ?? null,
          JSON.stringify(rec.metadata ?? {}), COMPETENCY_MEMORY_VERSION,
        ],
      );
    } catch (err) {
      console.warn('[competency-memory] persist failed:', (err as Error).message);
    }
  }
  return out;
}

export async function recentMemory(
  pool: Pool,
  userId: string,
  opts: { competencyId?: string; limit?: number } = {},
) {
  const limit = Math.max(1, Math.min(500, opts.limit ?? 100));
  try {
    if (opts.competencyId) {
      const r = await pool.query(
        `SELECT competency_id, score, confidence, delta_score, delta_confidence,
                growth_velocity, drift_severity, leadership_layer, readiness_band,
                origin, observed_at
           FROM competency_memory_history
          WHERE user_id = $1 AND competency_id = $2
          ORDER BY observed_at DESC LIMIT $3`,
        [userId, opts.competencyId, limit],
      );
      return r.rows;
    }
    const r = await pool.query(
      `SELECT competency_id, score, confidence, delta_score, delta_confidence,
              growth_velocity, drift_severity, leadership_layer, readiness_band,
              origin, observed_at
         FROM competency_memory_history
        WHERE user_id = $1
        ORDER BY observed_at DESC LIMIT $2`,
      [userId, limit],
    );
    return r.rows;
  } catch {
    return [];
  }
}

/** Summary used by the orchestrator + UCIP enrichment. */
export async function memorySummary(pool: Pool, userId: string) {
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS total_observations,
              COUNT(DISTINCT competency_id)::int AS competencies_tracked,
              AVG(NULLIF(growth_velocity, 0))::float AS avg_growth_velocity,
              SUM(CASE WHEN drift_severity = 'high' THEN 1 ELSE 0 END)::int AS high_drift_count,
              MAX(observed_at) AS last_observed_at
         FROM competency_memory_history
        WHERE user_id = $1`,
      [userId],
    );
    const row: any = r.rows[0] ?? {};
    return {
      total_observations: Number(row.total_observations ?? 0),
      competencies_tracked: Number(row.competencies_tracked ?? 0),
      avg_growth_velocity: row.avg_growth_velocity == null ? null : Number(row.avg_growth_velocity),
      high_drift_count: Number(row.high_drift_count ?? 0),
      last_observed_at: row.last_observed_at ? (row.last_observed_at.toISOString?.() ?? String(row.last_observed_at)) : null,
    };
  } catch {
    return { total_observations: 0, competencies_tracked: 0, avg_growth_velocity: null, high_drift_count: 0, last_observed_at: null };
  }
}
