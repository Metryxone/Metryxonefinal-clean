/**
 * Competency Intelligence Profile Engine V2 — aggregates the unified
 * intelligence state for a user from existing modules (read-only).
 * Does NOT modify any source modules; reads from their tables / APIs.
 */
import type { Pool } from 'pg';

export const PROFILE_ENGINE_VERSION = '4.0.0';

export type IntelligenceLayerStatus = 'ok' | 'empty' | 'unavailable';

export type LayerEnvelope<T = unknown> = {
  status: IntelligenceLayerStatus;
  data: T | null;
  source: string;
};

export type UnifiedProfile = {
  user_id: number;
  competency_dna: LayerEnvelope;
  contextual_scores: LayerEnvelope;
  benchmark: LayerEnvelope;
  mobility: LayerEnvelope;
  workforce_readiness: LayerEnvelope;
  trajectory: LayerEnvelope;
  predictive: LayerEnvelope;
  lineage: Array<{ source: string; step: string; ok: boolean; at: string }>;
  computed_at: string;
};

async function safeFirst<T>(pool: Pool, sql: string, params: unknown[], source: string, lineage: UnifiedProfile['lineage']): Promise<LayerEnvelope<T>> {
  try {
    const r = await pool.query(sql, params);
    const ok = (r.rowCount ?? 0) > 0;
    lineage.push({ source, step: 'query', ok, at: new Date().toISOString() });
    return { status: ok ? 'ok' : 'empty', data: ok ? (r.rows[0] as T) : null, source };
  } catch (err) {
    lineage.push({ source, step: 'query', ok: false, at: new Date().toISOString() });
    return { status: 'unavailable', data: null, source };
  }
}

async function safeAll<T>(pool: Pool, sql: string, params: unknown[], source: string, lineage: UnifiedProfile['lineage']): Promise<LayerEnvelope<T[]>> {
  try {
    const r = await pool.query(sql, params);
    const ok = (r.rowCount ?? 0) > 0;
    lineage.push({ source, step: 'query', ok, at: new Date().toISOString() });
    return { status: ok ? 'ok' : 'empty', data: ok ? (r.rows as T[]) : null, source };
  } catch {
    lineage.push({ source, step: 'query', ok: false, at: new Date().toISOString() });
    return { status: 'unavailable', data: null, source };
  }
}

export async function buildProfile(pool: Pool, userId: number): Promise<UnifiedProfile> {
  const lineage: UnifiedProfile['lineage'] = [];
  // Run all aggregations in parallel; each is independently fault-tolerant.
  const [dna, ctx, bench, mob, wf, traj, pred] = await Promise.all([
    safeFirst(pool,
      `SELECT user_id, role_id, resolved_weights, confidence, computed_at
       FROM competency_runtime_weights WHERE user_id = $1 ORDER BY computed_at DESC LIMIT 1`,
      [userId], 'competency_runtime_weights', lineage),
    safeAll(pool,
      `SELECT competency_id, raw_score, contextual_score, percentile, confidence_tier, computed_at
       FROM competency_percentile_distributions_v2 WHERE user_id = $1
       ORDER BY computed_at DESC LIMIT 50`,
      [userId], 'competency_percentile_distributions_v2', lineage),
    safeFirst(pool,
      `SELECT user_id, cohort_id, overall_percentile, sample_size, computed_at
       FROM contextual_benchmark_cohorts WHERE user_id = $1 ORDER BY computed_at DESC LIMIT 1`,
      [userId], 'contextual_benchmark_cohorts', lineage),
    safeAll(pool,
      `SELECT from_role_id, to_role_id, transition_score, readiness_band
       FROM mobility_role_transitions WHERE user_id = $1
       ORDER BY transition_score DESC LIMIT 10`,
      [userId], 'mobility_role_transitions', lineage),
    safeFirst(pool,
      `SELECT user_id, readiness_score, readiness_band, computed_at
       FROM competency_readiness_models WHERE user_id = $1 ORDER BY computed_at DESC LIMIT 1`,
      [userId], 'competency_readiness_models', lineage),
    safeAll(pool,
      `SELECT competency_id, slope, velocity_band, observation_weeks
       FROM competency_growth_velocity WHERE user_id = $1
       ORDER BY observation_weeks DESC LIMIT 10`,
      [userId], 'competency_growth_velocity', lineage),
    safeFirst(pool,
      `SELECT user_id, model_key, prediction, confidence, computed_at
       FROM p4_predictions WHERE user_id = $1 ORDER BY computed_at DESC LIMIT 1`,
      [userId], 'p4_predictions', lineage),
  ]);

  return {
    user_id: userId,
    competency_dna: dna,
    contextual_scores: ctx,
    benchmark: bench,
    mobility: mob,
    workforce_readiness: wf,
    trajectory: traj,
    predictive: pred,
    lineage,
    computed_at: new Date().toISOString(),
  };
}

export async function persistProfile(pool: Pool, profile: UnifiedProfile): Promise<void> {
  await pool.query(
    `INSERT INTO competency_intelligence_profiles (user_id, profile, lineage, version, computed_at)
     VALUES ($1, $2::jsonb, $3::jsonb, 1, NOW())
     ON CONFLICT (user_id) DO UPDATE SET profile = EXCLUDED.profile, lineage = EXCLUDED.lineage, version = competency_intelligence_profiles.version + 1, computed_at = NOW()`,
    [profile.user_id, JSON.stringify(profile), JSON.stringify(profile.lineage)],
  );
  await pool.query(
    `INSERT INTO intelligence_snapshots_v2 (user_id, snapshot, trigger_event)
     VALUES ($1, $2::jsonb, $3)`,
    [profile.user_id, JSON.stringify(profile), 'profile_rebuild'],
  );
}

export async function getLatestProfile(pool: Pool, userId: number): Promise<{ profile: UnifiedProfile; version: number; computed_at: string } | null> {
  try {
    const r = await pool.query<{ profile: UnifiedProfile; version: number; computed_at: string }>(
      `SELECT profile, version, computed_at FROM competency_intelligence_profiles WHERE user_id = $1`,
      [userId],
    );
    if (!r.rowCount) return null;
    return r.rows[0];
  } catch {
    return null;
  }
}
