/**
 * Dynamic Cohort Engine (Phase 3 V2).
 *
 * Forms peer cohorts on the fly. K-anonymity floor (default 30). When a
 * tight cohort can't reach k_min, broadens dimensions (drop geography →
 * drop industry → drop layer) and flags provisional.
 */
import type { Pool } from 'pg';
import { contextKey, upsertNormContext, type NormContext } from './contextual-norm-engine';

export const DYNAMIC_COHORT_VERSION = '3.0.0';
export const K_MIN_DEFAULT = 30;

export type CohortEnvelope = {
  cohort_id: string;
  context_id: string;
  cohort_label: string;
  sample_size: number;
  is_provisional: boolean;
  similarity_threshold: number;
  formed_from: string[];
  rationale: string;
};

const BROADENING_LAYERS: Array<keyof NormContext> = [
  'geography', 'org_maturity', 'team_scale', 'industry', 'layer', 'experience_band',
];

export async function generateCohort(pool: Pool, ctx: NormContext, kMin = K_MIN_DEFAULT): Promise<CohortEnvelope> {
  let current: NormContext = { ...ctx };
  const dropped: string[] = [];
  let sampleSize = await countMembers(pool, current);
  let label = labelFor(current);
  let provisional = sampleSize < kMin;

  let depth = 0;
  while (provisional && depth < BROADENING_LAYERS.length) {
    const key = BROADENING_LAYERS[depth];
    if (current[key]) {
      dropped.push(String(key));
      current = { ...current, [key]: null };
      sampleSize = await countMembers(pool, current);
      label = labelFor(current);
      provisional = sampleSize < kMin;
    }
    depth++;
  }

  const contextId = await upsertNormContext(pool, current);
  const cohortKey = `cohort:${contextKey(current)}`;
  const ins = await pool.query<{ id: string }>(
    `INSERT INTO contextual_benchmark_cohorts
       (cohort_key, context_id, cohort_label, sample_size, k_min, similarity_threshold, formed_from, is_provisional)
     VALUES ($1, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8)
     ON CONFLICT (cohort_key) DO UPDATE
       SET sample_size = EXCLUDED.sample_size,
           is_provisional = EXCLUDED.is_provisional,
           computed_at = NOW()
     RETURNING id`,
    [cohortKey, contextId, label, sampleSize, kMin, 0.7, JSON.stringify(dropped), provisional],
  );

  return {
    cohort_id: ins.rows[0].id,
    context_id: contextId,
    cohort_label: label,
    sample_size: sampleSize,
    is_provisional: provisional,
    similarity_threshold: 0.7,
    formed_from: dropped,
    rationale: provisional
      ? `Tight cohort below k_min=${kMin}; broadened by dropping [${dropped.join(', ') || 'none'}] → n=${sampleSize}. Flagged provisional.`
      : `Cohort meets k_min=${kMin} with n=${sampleSize}; no broadening required.`,
  };
}

function labelFor(c: NormContext): string {
  const parts: string[] = [];
  if (c.role_id)         parts.push(`role=${c.role_id}`);
  if (c.layer)           parts.push(`layer=${c.layer}`);
  if (c.industry)        parts.push(`industry=${c.industry}`);
  if (c.geography)       parts.push(`geo=${c.geography}`);
  if (c.org_maturity)    parts.push(`org=${c.org_maturity}`);
  if (c.team_scale)      parts.push(`team=${c.team_scale}`);
  if (c.seniority_band)  parts.push(`sen=${c.seniority_band}`);
  if (c.experience_band) parts.push(`exp=${c.experience_band}`);
  return parts.length ? parts.join(' | ') : 'global';
}

/**
 * Cohort member counter. Best-effort: reads `cra_scores` (legacy Phase 1)
 * filtered by joining `cra_profiles` (if present). Returns 0 on any error
 * so cohort logic gracefully falls through to provisional state.
 */
async function countMembers(pool: Pool, c: NormContext): Promise<number> {
  try {
    const where: string[] = [];
    const args: unknown[] = [];
    const push = (col: string, val: unknown, op = '=') => {
      args.push(val);
      where.push(`${col} ${op} $${args.length}`);
    };
    if (c.role_id)         push('p.target_role', c.role_id);
    if (c.industry)        push('p.industry', c.industry);
    // Profile metadata extras live in the JSON `payload` column when present;
    // we filter via JSONB containment for additional dimensions so cohort
    // broadening reflects real sample-size changes, not nominal ones.
    if (c.layer)           { args.push(c.layer);          where.push(`(p.career_stage ILIKE '%' || $${args.length} || '%' OR COALESCE(p.payload->>'layer','') = $${args.length})`); }
    if (c.geography)       { args.push(c.geography);      where.push(`COALESCE(p.payload->>'geography','') = $${args.length}`); }
    if (c.org_maturity)    { args.push(c.org_maturity);   where.push(`COALESCE(p.payload->>'org_maturity','') = $${args.length}`); }
    if (c.team_scale)      { args.push(c.team_scale);     where.push(`COALESCE(p.payload->>'team_scale','') = $${args.length}`); }
    if (c.seniority_band)  { args.push(c.seniority_band); where.push(`COALESCE(p.career_stage, p.payload->>'seniority_band','') ILIKE '%' || $${args.length} || '%'`); }
    if (c.experience_band) { args.push(c.experience_band); where.push(`COALESCE(p.payload->>'experience_band','') = $${args.length}`); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `SELECT COUNT(DISTINCT p.user_id) AS n FROM cra_profiles p ${w}`;
    const r = await pool.query<{ n: string }>(sql, args);
    return Number(r.rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}
