/**
 * Career Builder 2.0 Activation — 98X Gap Closure, Phase 4 (additive, flag-gated, reversible).
 *
 * THE GAP: the Career Graph `cg_user_*` calculation tables are all empty — the platform
 * CONSUMES per-user career intelligence but nothing GENERATES it (no completion hook, no
 * "activate everything for this user" entry point). Every persisting engine already exists:
 *   - computeSkillGaps        → cg_user_skill_gaps
 *   - computeReadiness        → cg_user_role_readiness (+ cg_readiness_history)
 *   - generateRecommendations → cg_user_recommendations
 *   - generateLearningRecs    → cg_user_learning_recs
 * This module is a thin ORCHESTRATOR that COMPOSES those engines for a user (NO new scoring
 * math, NO recomputation) and additionally writes a reversible anchor→target career path.
 *
 * HONESTY / REVERSIBILITY:
 *   - Career-path rows are stamped `source='98x_phase4'` and inserted ON CONFLICT DO NOTHING
 *     so a user-saved path (`source='user_selected'`) is NEVER clobbered.
 *   - The other four tables have no provenance column, so each run records the (user, role_ids)
 *     it processed in the net-new `cg_user_activation_runs` table (lazy ensure-schema on the
 *     WRITE path only — no DDL on existing tables). Rollback deletes exactly those rows.
 *   - Never throws; degrades to a partial summary on any per-role failure.
 *   - GET aggregation is strictly read-only (to_regclass probe, no ensure-schema, no writes).
 */

import type { Pool } from 'pg';
import { computeSkillGaps } from './career-skill-gap-engine';
import { computeReadiness } from './career-readiness-engine';
import type { ReadinessResult } from './career-readiness-engine';
import { generateLearningRecs } from './career-learning-rec-engine';
import { generateRecommendations } from './career-recommendation-engine';
import { buildGraphCache, getRoleById } from './career-graph-engine';
import type { CgRole } from './career-graph-engine';
import { isCareerBuilderActivationEnabled } from '../config/feature-flags';

export const CAREER_BUILDER_ACTIVATION_VERSION = 'cba-1.0.0';
export const ACTIVATION_SOURCE = '98x_phase4';

/** Max direct-neighbour target roles to materialize per activation (mirrors the existing
 *  career-graph recommendations path which slices neighbours to 12). */
const MAX_TARGET_ROLES = 12;

export interface ActivationCounts {
  skill_gaps: number;
  role_readiness: number;
  recommendations: number;
  learning_recs: number;
  career_paths: number;
}

export interface ActivationSummary {
  ok: boolean;
  activated: boolean;
  user_id: string;
  anchor_role_id: number | null;
  anchor_role_title: string | null;
  roles_processed: number[];
  counts: ActivationCounts;
  run_id: number | null;
  source: string;
  degraded: boolean;
  notes: string[];
}

/** Read-only anchor-role resolver. Mirrors `resolveCurrentRoleForUser` in routes/career-graph.ts:
 *  most-recent saved path → profile currentRole → highest-demand active role. Never writes. */
async function resolveAnchorRole(pool: Pool, userId: string): Promise<CgRole | null> {
  // 1. Most-recent saved career path from_role_id
  const pathRes = await pool.query(
    `SELECT from_role_id FROM cg_user_career_path
     WHERE user_id = $1 AND from_role_id IS NOT NULL
     ORDER BY saved_at DESC LIMIT 1`,
    [userId],
  ).catch(() => ({ rows: [] as Array<{ from_role_id: number }> }));
  if (pathRes.rows[0]?.from_role_id) {
    const r = await getRoleById(pool, Number(pathRes.rows[0].from_role_id)).catch(() => null);
    if (r) return r;
  }

  // 2. Profile currentRole title → exact role match
  const profRes = await pool.query(
    `SELECT data->>'currentRole' AS cr FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1`,
    [userId],
  ).catch(() => ({ rows: [] as Array<{ cr: string | null }> }));
  const crTitle = profRes.rows[0]?.cr ?? null;
  if (crTitle) {
    const roleRes = await pool.query(
      `SELECT id FROM cg_roles WHERE LOWER(title) = LOWER($1) AND is_active LIMIT 1`,
      [crTitle],
    ).catch(() => ({ rows: [] as Array<{ id: number }> }));
    if (roleRes.rows[0]) {
      const r = await getRoleById(pool, Number(roleRes.rows[0].id)).catch(() => null);
      if (r) return r;
    }
  }

  // 3. Anchor to the highest-demand active role so generation is never empty.
  const anchorRes = await pool.query(
    `SELECT id FROM cg_roles WHERE is_active ORDER BY demand_score DESC LIMIT 1`,
  ).catch(() => ({ rows: [] as Array<{ id: number }> }));
  if (anchorRes.rows[0]) return getRoleById(pool, Number(anchorRes.rows[0].id)).catch(() => null);
  return null;
}

/** Net-new provenance table — lazy ensure on the WRITE path only. No DDL on existing tables.
 *  `rec_role_ids` records the role_ids of recommendation rows ACTUALLY written by this run
 *  (a delta snapshot) because generateRecommendations reaches 2–3 hops BEYOND the direct
 *  neighbours in `processed_role_ids`; rollback must delete those too. */
async function ensureProvenanceSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cg_user_activation_runs (
      id                 SERIAL PRIMARY KEY,
      user_id            TEXT        NOT NULL,
      source             TEXT        NOT NULL DEFAULT '${ACTIVATION_SOURCE}',
      anchor_role_id     INT,
      processed_role_ids INT[]       NOT NULL DEFAULT '{}',
      rec_role_ids       INT[]       NOT NULL DEFAULT '{}',
      counts             JSONB       NOT NULL DEFAULT '{}',
      status             TEXT        NOT NULL DEFAULT 'completed',
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Idempotent for tables created by an earlier build that predates rec_role_ids.
  await pool.query(
    `ALTER TABLE cg_user_activation_runs ADD COLUMN IF NOT EXISTS rec_role_ids INT[] NOT NULL DEFAULT '{}'`,
  ).catch(() => {});
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_cg_user_activation_runs_user ON cg_user_activation_runs(user_id)`,
  ).catch(() => {});
}

/** Snapshot the set of role_ids that currently have a recommendation row for this user. */
async function recRoleIdSet(pool: Pool, userId: string): Promise<Set<number>> {
  const r = await pool.query(
    `SELECT role_id FROM cg_user_recommendations WHERE user_id=$1`, [userId],
  ).catch(() => ({ rows: [] as Array<{ role_id: number }> }));
  return new Set(r.rows.map(x => Number(x.role_id)).filter(Number.isFinite));
}

/**
 * Activate Career Builder for a user: compose the existing persisting engines across the
 * user's anchor role + its direct target roles, then write a reversible anchor→target path.
 * Fire-and-forget safe — never throws.
 */
export async function activateCareerBuilder(pool: Pool, userId: string): Promise<ActivationSummary> {
  const notes: string[] = [];
  const summary: ActivationSummary = {
    ok: true, activated: false, user_id: userId,
    anchor_role_id: null, anchor_role_title: null, roles_processed: [],
    counts: { skill_gaps: 0, role_readiness: 0, recommendations: 0, learning_recs: 0, career_paths: 0 },
    run_id: null, source: ACTIVATION_SOURCE, degraded: false, notes,
  };

  try {
    const anchor = await resolveAnchorRole(pool, userId);
    if (!anchor) {
      summary.degraded = true;
      notes.push('no_anchor_role_resolved (cg_roles empty?)');
      return summary;
    }
    summary.anchor_role_id = anchor.id;
    summary.anchor_role_title = anchor.title;

    const g = await buildGraphCache(pool);
    const neighbours = g.adjacency.get(anchor.id) ?? [];
    const targetIds = neighbours.slice(0, MAX_TARGET_ROLES).map(e => e.to_role_id);
    // Always include the anchor role itself so the user sees their own readiness/gaps.
    const roleSet = [anchor.id, ...targetIds.filter(id => id !== anchor.id)];

    const readinessMap = new Map<number, ReadinessResult>();
    const processed: number[] = [];

    for (const roleId of roleSet) {
      try {
        // computeSkillGaps persists cg_user_skill_gaps; computeReadiness persists
        // cg_user_role_readiness; generateLearningRecs persists cg_user_learning_recs.
        const gap = await computeSkillGaps(pool, userId, roleId);
        const readiness = await computeReadiness(pool, userId, roleId, gap);
        readinessMap.set(roleId, readiness);
        await generateLearningRecs(pool, userId, roleId, gap.gaps);
        processed.push(roleId);
      } catch {
        summary.degraded = true;
        notes.push(`role_${roleId}_failed`);
      }
    }

    // generateRecommendations persists cg_user_recommendations 2–3 hops BEYOND the direct
    // neighbours, so snapshot the role_id set before/after to capture exactly the rows this
    // run added (delta) — rollback must delete those too, not just processed_role_ids.
    const recBefore = await recRoleIdSet(pool, userId);
    try {
      await generateRecommendations(pool, userId, anchor, g, readinessMap);
    } catch {
      summary.degraded = true;
      notes.push('recommendations_failed');
    }
    const recAfter = await recRoleIdSet(pool, userId);
    const newRecRoleIds = [...recAfter].filter(id => !recBefore.has(id));

    // Reversible career path(s): anchor → each direct target, stamped source='98x_phase4'.
    // ON CONFLICT DO NOTHING never clobbers a user-saved (source='user_selected') path.
    let pathsWritten = 0;
    for (const edge of neighbours.slice(0, MAX_TARGET_ROLES)) {
      if (edge.to_role_id === anchor.id) continue;
      const ins = await pool.query(
        `INSERT INTO cg_user_career_path(user_id, from_role_id, to_role_id, path_role_ids, total_months, source)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT(user_id, to_role_id) DO NOTHING`,
        [userId, anchor.id, edge.to_role_id, [anchor.id, edge.to_role_id],
         edge.avg_months_transition ?? null, ACTIVATION_SOURCE],
      ).catch(() => ({ rowCount: 0 }));
      pathsWritten += ins.rowCount ?? 0;
    }

    // Recommendations are counted over the role_ids this run actually ADDED (net-new delta);
    // pre-existing rec rows the engine merely refreshed are not attributed to this run.
    const counts = await countUserRows(pool, userId, processed, newRecRoleIds);
    summary.counts = { ...counts, career_paths: pathsWritten };
    summary.roles_processed = processed;
    summary.activated = processed.length > 0;

    // Record provenance for precise rollback.
    try {
      await ensureProvenanceSchema(pool);
      const runRes = await pool.query(
        `INSERT INTO cg_user_activation_runs(user_id, source, anchor_role_id, processed_role_ids, rec_role_ids, counts, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [userId, ACTIVATION_SOURCE, anchor.id, processed, newRecRoleIds,
         JSON.stringify(summary.counts), summary.degraded ? 'completed_degraded' : 'completed'],
      );
      summary.run_id = Number(runRes.rows[0]?.id ?? null) || null;
    } catch {
      summary.degraded = true;
      notes.push('provenance_record_failed');
    }

    return summary;
  } catch (err) {
    summary.ok = false;
    summary.degraded = true;
    notes.push(`activation_error:${(err as Error).message}`);
    return summary;
  }
}

/** Count generated rows (used in the activation summary). Recommendations reach beyond the
 *  processed roles, so they are counted over `recRoleIds` — the net-new rec role_ids this run
 *  actually added (a before/after delta), consistent with rollback's net-new-only scope. */
async function countUserRows(
  pool: Pool, userId: string, roleIds: number[], recRoleIds: number[],
): Promise<Omit<ActivationCounts, 'career_paths'>> {
  const ids = roleIds.length ? roleIds : [-1];
  const recIds = recRoleIds.length ? recRoleIds : [-1];
  const q = async (table: string, scope: number[]): Promise<number> => {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n FROM ${table} WHERE user_id=$1 AND role_id = ANY($2::int[])`,
      [userId, scope],
    ).catch(() => ({ rows: [{ n: 0 }] }));
    return Number(r.rows[0]?.n ?? 0);
  };
  const [skill_gaps, role_readiness, recommendations, learning_recs] = await Promise.all([
    q('cg_user_skill_gaps', ids), q('cg_user_role_readiness', ids),
    q('cg_user_recommendations', recIds), q('cg_user_learning_recs', ids),
  ]);
  return { skill_gaps, role_readiness, recommendations, learning_recs };
}

export interface IntelligenceSnapshot {
  ok: boolean;
  user_id: string;
  available: boolean;
  anchor_role_id: number | null;
  last_run: { id: number; created_at: string; status: string; counts: ActivationCounts } | null;
  skill_gaps: unknown[];
  role_readiness: unknown[];
  recommendations: unknown[];
  learning_recs: unknown[];
  career_paths: unknown[];
  counts: ActivationCounts;
  degraded: boolean;
  notes: string[];
}

/** Read-only aggregation of a user's generated career intelligence. to_regclass probe,
 *  NO ensure-schema, NO writes — safe on every GET. */
export async function getCareerBuilderIntelligence(pool: Pool, userId: string): Promise<IntelligenceSnapshot> {
  const notes: string[] = [];
  const snap: IntelligenceSnapshot = {
    ok: true, user_id: userId, available: false, anchor_role_id: null, last_run: null,
    skill_gaps: [], role_readiness: [], recommendations: [], learning_recs: [], career_paths: [],
    counts: { skill_gaps: 0, role_readiness: 0, recommendations: 0, learning_recs: 0, career_paths: 0 },
    degraded: false, notes,
  };

  const present = async (table: string): Promise<boolean> => {
    const r = await pool.query(`SELECT to_regclass($1) AS reg`, [table]).catch(() => ({ rows: [{ reg: null }] }));
    return Boolean(r.rows[0]?.reg);
  };

  try {
    const tablesPresent = await Promise.all([
      present('cg_user_skill_gaps'), present('cg_user_role_readiness'),
      present('cg_user_recommendations'), present('cg_user_learning_recs'),
      present('cg_user_career_path'),
    ]);
    if (!tablesPresent.every(Boolean)) {
      snap.degraded = true;
      notes.push('cg_user_* tables not all present');
      return snap;
    }

    const readRows = async (sql: string): Promise<unknown[]> => {
      const r = await pool.query(sql, [userId]).catch(() => ({ rows: [] as unknown[] }));
      return r.rows as unknown[];
    };

    snap.skill_gaps = await readRows(
      `SELECT role_id, skill_key, skill_label, user_level, required_level, gap_delta, gap_severity, importance
       FROM cg_user_skill_gaps WHERE user_id=$1 ORDER BY role_id, gap_delta DESC`);
    snap.role_readiness = await readRows(
      `SELECT role_id, readiness_score, readiness_band, eta_months, skill_score, experience_score,
              behaviour_score, credential_score, market_score, confidence, top_blockers, computed_at
       FROM cg_user_role_readiness WHERE user_id=$1 ORDER BY readiness_score DESC`);
    snap.recommendations = await readRows(
      `SELECT role_id, segment, rec_score, readiness_score, market_score, salary_delta_pct,
              transition_prob, behaviour_fit, generated_at
       FROM cg_user_recommendations WHERE user_id=$1 ORDER BY rec_score DESC`);
    snap.learning_recs = await readRows(
      `SELECT role_id, resource_id, skill_key, relevance_score, is_actioned, generated_at
       FROM cg_user_learning_recs WHERE user_id=$1 ORDER BY relevance_score DESC`);
    snap.career_paths = await readRows(
      `SELECT from_role_id, to_role_id, path_role_ids, total_months, source, saved_at
       FROM cg_user_career_path WHERE user_id=$1 ORDER BY saved_at DESC`);

    snap.counts = {
      skill_gaps: snap.skill_gaps.length,
      role_readiness: snap.role_readiness.length,
      recommendations: snap.recommendations.length,
      learning_recs: snap.learning_recs.length,
      career_paths: snap.career_paths.length,
    };
    snap.available =
      snap.counts.skill_gaps + snap.counts.role_readiness + snap.counts.recommendations +
      snap.counts.learning_recs + snap.counts.career_paths > 0;

    // Last activation run (if the provenance table exists).
    if (await present('cg_user_activation_runs')) {
      const runR = await pool.query(
        `SELECT id, created_at, status, counts, anchor_role_id
         FROM cg_user_activation_runs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,
        [userId],
      ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
      const row = runR.rows[0];
      if (row) {
        snap.anchor_role_id = row.anchor_role_id != null ? Number(row.anchor_role_id) : null;
        snap.last_run = {
          id: Number(row.id),
          created_at: String(row.created_at),
          status: String(row.status),
          counts: row.counts as ActivationCounts,
        };
      }
    }

    return snap;
  } catch (err) {
    snap.degraded = true;
    notes.push(`read_error:${(err as Error).message}`);
    return snap;
  }
}

export interface RollbackResult {
  ok: boolean;
  user_id: string;
  deleted: {
    skill_gaps: number;
    role_readiness: number;
    recommendations: number;
    learning_recs: number;
    career_paths: number;
    readiness_history: number;
    runs: number;
  };
  role_ids: number[];
  notes: string[];
}

/**
 * Reverse a Career Builder activation for a user. Deletes exactly the rows generated by
 * activation: cache rows scoped to the role_ids recorded across this user's provenance runs,
 * and career-path rows stamped source='98x_phase4' (user-saved paths are preserved). Content
 * tables are never touched. Idempotent.
 */
export async function rollbackCareerBuilderActivation(pool: Pool, userId: string): Promise<RollbackResult> {
  const notes: string[] = [];
  const result: RollbackResult = {
    ok: true, user_id: userId,
    deleted: { skill_gaps: 0, role_readiness: 0, recommendations: 0, learning_recs: 0, career_paths: 0, readiness_history: 0, runs: 0 },
    role_ids: [], notes,
  };

  try {
    // Union of all role_ids this user's activation runs processed, plus the recommendation
    // role_ids each run actually added (recs reach 2–3 hops beyond the processed neighbours).
    let roleIds: number[] = [];
    let recRoleIds: number[] = [];
    const hasRuns = await pool.query(`SELECT to_regclass('cg_user_activation_runs') AS reg`)
      .then(r => Boolean(r.rows[0]?.reg)).catch(() => false);
    if (hasRuns) {
      const r = await pool.query(
        `SELECT DISTINCT unnest(processed_role_ids) AS rid
         FROM cg_user_activation_runs WHERE user_id=$1 AND source=$2`,
        [userId, ACTIVATION_SOURCE],
      ).catch(() => ({ rows: [] as Array<{ rid: number }> }));
      roleIds = r.rows.map(x => Number(x.rid)).filter(Number.isFinite);
      const rr = await pool.query(
        `SELECT DISTINCT unnest(rec_role_ids) AS rid
         FROM cg_user_activation_runs WHERE user_id=$1 AND source=$2`,
        [userId, ACTIVATION_SOURCE],
      ).catch(() => ({ rows: [] as Array<{ rid: number }> }));
      recRoleIds = rr.rows.map(x => Number(x.rid)).filter(Number.isFinite);
    } else {
      notes.push('no provenance table — nothing recorded to roll back');
    }
    result.role_ids = roleIds;

    const ids = roleIds.length ? roleIds : [-1];
    // Recommendations: delete ONLY the net-new rows this run added (per-run rec_role_ids,
    // captured as a before/after delta at activation time). Pre-existing rec rows — even for
    // processed roles — are PRESERVED. Rollback semantics are "remove net-new rows"; rows the
    // engine merely refreshed in place are not restored to their prior values (documented).
    const recIds = recRoleIds.length ? recRoleIds : [-1];
    const del = async (sql: string, params: unknown[]): Promise<number> => {
      const r = await pool.query(sql, params).catch(() => ({ rowCount: 0 }));
      return r.rowCount ?? 0;
    };

    if (recRoleIds.length) {
      result.deleted.recommendations = await del(
        `DELETE FROM cg_user_recommendations WHERE user_id=$1 AND role_id = ANY($2::int[])`, [userId, recIds]);
    }
    if (roleIds.length) {
      result.deleted.skill_gaps = await del(
        `DELETE FROM cg_user_skill_gaps WHERE user_id=$1 AND role_id = ANY($2::int[])`, [userId, ids]);
      result.deleted.role_readiness = await del(
        `DELETE FROM cg_user_role_readiness WHERE user_id=$1 AND role_id = ANY($2::int[])`, [userId, ids]);
      result.deleted.learning_recs = await del(
        `DELETE FROM cg_user_learning_recs WHERE user_id=$1 AND role_id = ANY($2::int[])`, [userId, ids]);
      result.deleted.readiness_history = await del(
        `DELETE FROM cg_readiness_history WHERE user_id=$1 AND role_id = ANY($2::int[])`, [userId, ids]);
    }

    // Career-path rows are self-identifying via source — preserve user_selected.
    result.deleted.career_paths = await del(
      `DELETE FROM cg_user_career_path WHERE user_id=$1 AND source=$2`, [userId, ACTIVATION_SOURCE]);

    if (hasRuns) {
      result.deleted.runs = await del(
        `DELETE FROM cg_user_activation_runs WHERE user_id=$1 AND source=$2`, [userId, ACTIVATION_SOURCE]);
    }

    return result;
  } catch (err) {
    result.ok = false;
    notes.push(`rollback_error:${(err as Error).message}`);
    return result;
  }
}

/**
 * Flag-gated, never-throws completion hook. Given an assessment completion email, resolves a
 * REAL career user (career_seeker_profiles is keyed by user_id; some deployments key it by
 * email, others store email in the data JSONB) and activates only when one is found. No flag,
 * no email, or no matching career user → no-op (byte-identical legacy behaviour). Honest: never
 * fabricates a user id, never bridges the CAPADEX guest identity onto a non-existent career user.
 */
export async function maybeActivateCareerBuilderOnCompletion(pool: Pool, email: string | null): Promise<void> {
  try {
    if (!isCareerBuilderActivationEnabled()) return;
    if (!email) return;
    const r = await pool.query(
      `SELECT user_id FROM career_seeker_profiles
       WHERE LOWER(user_id) = LOWER($1) OR LOWER(data->>'email') = LOWER($1)
       LIMIT 1`,
      [email],
    ).catch(() => ({ rows: [] as Array<{ user_id: string }> }));
    const userId = r.rows[0]?.user_id;
    if (!userId) return; // no matching career user — honest no-op
    await activateCareerBuilder(pool, userId);
  } catch {
    // never-throws: a completion hook must never break the assessment write path
  }
}
