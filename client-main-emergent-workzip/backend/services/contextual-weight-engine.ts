/**
 * Phase 1 Enhancement — Contextual Weight Engine
 *
 * Resolves multiplicative contextual modifiers per competency, given a
 * (role, industry, layer, function, geography, complexity) context tuple.
 * Missing modifier rows default to 1.000 (neutral) — never explodes the score.
 *
 * Backward-compatible: does NOT mutate existing weighting-engine.ts.
 * Designed to be CONSUMED by `expectation-engine.ts`.
 */
import type { Pool } from 'pg';

export const CONTEXTUAL_WEIGHT_ENGINE_VERSION = '1.0.0';

export interface ContextTuple {
  industry_id?: string;
  layer_id?: string;
  function_id?: string;
  geography_code?: string;
  complexity_level?: number;
}

export interface ModifierResolution {
  competency_id: string;
  industry: number; layer: number; function: number; geography: number; complexity: number;
  combined: number;
  contributors: Array<{ source: string; multiplier: number; rationale: string | null }>;
}

const SAFE_MIN = 0.50;
const SAFE_MAX = 1.75;
const clamp = (v: number) => Math.min(SAFE_MAX, Math.max(SAFE_MIN, v));

export function createContextualWeightEngine(pool: Pool) {
  /** Resolve all five modifier sources for a set of competencies in a single round-trip. */
  async function resolveAll(ctx: ContextTuple, competencyIds: string[]): Promise<ModifierResolution[]> {
    if (!competencyIds.length) return [];
    const empty = Promise.resolve({ rows: [] as any[] });

    const [im, lm, fm, gm, om] = await Promise.all([
      ctx.industry_id
        ? pool.query(`SELECT competency_id, multiplier, rationale FROM gro_industry_modifiers
                      WHERE industry_id = $1 AND competency_id = ANY($2) AND deleted_at IS NULL`,
                     [ctx.industry_id, competencyIds]) : empty,
      ctx.layer_id
        ? pool.query(`SELECT competency_id, multiplier, rationale FROM gro_layer_modifiers
                      WHERE layer_id = $1 AND competency_id = ANY($2) AND deleted_at IS NULL`,
                     [ctx.layer_id, competencyIds]) : empty,
      ctx.function_id
        ? pool.query(`SELECT competency_id, multiplier, rationale FROM gro_function_modifiers
                      WHERE function_id = $1 AND competency_id = ANY($2) AND deleted_at IS NULL`,
                     [ctx.function_id, competencyIds]) : empty,
      ctx.geography_code
        ? pool.query(`SELECT competency_id, multiplier, rationale FROM gro_geography_modifiers
                      WHERE geography_code = $1 AND competency_id = ANY($2) AND deleted_at IS NULL`,
                     [ctx.geography_code, competencyIds]) : empty,
      ctx.complexity_level != null
        ? pool.query(`SELECT competency_id, multiplier, rationale FROM gro_organizational_complexity_modifiers
                      WHERE complexity_level = $1 AND competency_id = ANY($2) AND deleted_at IS NULL`,
                     [ctx.complexity_level, competencyIds]) : empty,
    ]);

    const idx = (rows: any[]) => new Map(rows.map(r => [r.competency_id, { m: Number(r.multiplier), rat: r.rationale ?? null }]));
    const I = idx(im.rows); const L = idx(lm.rows); const F = idx(fm.rows); const G = idx(gm.rows); const O = idx(om.rows);

    return competencyIds.map(cid => {
      const get = (m: Map<string, any>, src: string) => {
        const r = m.get(cid);
        return r ? { v: r.m, src, rat: r.rat } : { v: 1.0, src, rat: null };
      };
      const i = get(I, 'industry');
      const l = get(L, 'layer');
      const f = get(F, 'function');
      const g = get(G, 'geography');
      const o = get(O, 'complexity');
      const combined = clamp(i.v * l.v * f.v * g.v * o.v);
      const contributors = [i, l, f, g, o]
        .filter(x => x.v !== 1.0)
        .map(x => ({ source: x.src, multiplier: x.v, rationale: x.rat }));
      return {
        competency_id: cid,
        industry: i.v, layer: l.v, function: f.v, geography: g.v, complexity: o.v,
        combined, contributors,
      };
    });
  }

  return { resolveAll, SAFE_MIN, SAFE_MAX };
}
