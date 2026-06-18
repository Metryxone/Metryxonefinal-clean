/**
 * UCIP Orchestration Adapter — Phase 1.
 *
 * Safe execution wrapper. Every intelligence fetch returns a SafeResult so
 * a missing table or failing engine never crashes UCIP generation.
 *
 * READ-ONLY: this adapter NEVER writes to upstream tables. It reads from the
 * tables that existing engines populate (V1 + V2). It does NOT import or call
 * those engines directly — that would create cycles and risk mutations.
 *
 * Scope: ONLY tables that are genuinely user-keyed. Catalog/cohort/role-keyed
 * V2 tables (e.g. competency_runtime_weights, role_dna_profiles_v2,
 * contextual_benchmark_cohorts, competency_readiness_models,
 * competency_percentile_distributions_v2, mobility_role_transitions) are
 * **not** queried per-user here — they are role/cohort/catalog data, not
 * user profile data. Role context for a user is derived via cra_profiles.
 */
import type { Pool } from 'pg';

export const UCIP_ADAPTER_VERSION = '1.0.1';

export type SafeResult<T = any> = {
  ok: boolean;
  source: string;
  data?: T;
  error?: string;
  duration_ms: number;
};

async function safeQuery<T = any>(
  pool: Pool, source: string, sql: string, params: any[], pickFirst = false,
): Promise<SafeResult<T>> {
  const start = Date.now();
  try {
    const r = await pool.query(sql, params);
    const data = pickFirst ? (r.rows[0] as T) : (r.rows as unknown as T);
    return { ok: true, source, data, duration_ms: Date.now() - start };
  } catch (err) {
    return { ok: false, source, error: (err as Error).message, duration_ms: Date.now() - start };
  }
}

/** All fetch helpers tolerate missing tables / empty results. */
export const ucipFetch = {
  /** V1 competency runtime scores (cra_scores). */
  craScores: (pool: Pool, userId: string) => safeQuery(
    pool, 'cra_scores',
    `SELECT user_id, competency_code, raw_score, confidence, created_at
       FROM cra_scores WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 200`,
    [userId], false,
  ),

  /** V1 profile (cra_profiles) — gives us role context. */
  craProfile: (pool: Pool, userId: string) => safeQuery(
    pool, 'cra_profiles',
    `SELECT user_id, current_role_label, target_role_label, industry,
            career_stage, org_layer, org_maturity, experience_years,
            team_size_band, work_arrangement, tenure_months, updated_at
       FROM cra_profiles WHERE user_id = $1
       ORDER BY updated_at DESC LIMIT 1`,
    [userId], true,
  ),

  /** Longitudinal history (P4). */
  trajectory: (pool: Pool, userId: string) => safeQuery(
    pool, 'p4_competency_history',
    `SELECT competency_id, score, source, captured_at
       FROM p4_competency_history WHERE user_id = $1
       ORDER BY captured_at DESC LIMIT 200`,
    [userId], false,
  ),

  /** AI-inferred competencies (Phase 5 heuristic). user_id is BIGINT — cast. */
  aiInferred: (pool: Pool, userId: string) => safeQuery(
    pool, 'ai_inferred_competencies',
    `SELECT competency_key, inferred_level, confidence, evidence, computed_at
       FROM ai_inferred_competencies WHERE user_id::text = $1
       ORDER BY confidence DESC, computed_at DESC LIMIT 50`,
    [userId], false,
  ),

  /** Assessment snapshots bridge. */
  assessmentSnapshots: (pool: Pool, userId: string) => safeQuery(
    pool, 'user_assessment_snapshots',
    `SELECT id, role_id, assessment_version, source, composite_score,
            n_competencies, reliability, taken_at, metadata
       FROM user_assessment_snapshots WHERE user_id = $1
       ORDER BY taken_at DESC LIMIT 10`,
    [userId], false,
  ),

  /** Per-user competency scores bridge. */
  userCompetencyScores: (pool: Pool, userId: string) => safeQuery(
    pool, 'user_competency_scores',
    `SELECT competency_id, score, reliability, source, snapshot_id, assessed_at
       FROM user_competency_scores WHERE user_id = $1
       ORDER BY assessed_at DESC LIMIT 200`,
    [userId], false,
  ),
};

export type UcipSourceMap = Record<keyof typeof ucipFetch, SafeResult>;

export async function fetchAllSources(pool: Pool, userId: string): Promise<UcipSourceMap> {
  const keys = Object.keys(ucipFetch) as (keyof typeof ucipFetch)[];
  const results = await Promise.all(keys.map((k) => ucipFetch[k](pool, userId)));
  const map = {} as UcipSourceMap;
  keys.forEach((k, i) => { map[k] = results[i]; });
  return map;
}

export function summariseHealth(map: UcipSourceMap): { ok: number; failed: number; empty: number; total: number; per_source: Record<string, { ok: boolean; rows?: number; error?: string }> } {
  const per: Record<string, { ok: boolean; rows?: number; error?: string }> = {};
  let ok = 0, failed = 0, empty = 0;
  for (const [k, r] of Object.entries(map)) {
    if (!r.ok) { failed++; per[k] = { ok: false, error: r.error }; continue; }
    const rows = Array.isArray(r.data) ? r.data.length : (r.data ? 1 : 0);
    if (rows === 0) empty++; else ok++;
    per[k] = { ok: true, rows };
  }
  return { ok, failed, empty, total: Object.keys(map).length, per_source: per };
}
