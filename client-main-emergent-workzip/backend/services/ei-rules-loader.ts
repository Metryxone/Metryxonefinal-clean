/**
 * EI Rules Loader — Phase 4
 *
 * Loads the active EI ruleset from `ei_rulesets`, caches it in-memory (with
 * a short TTL so admin activations propagate within seconds), and exposes
 * helpers to fetch a specific historical ruleset (for snapshot reproduction
 * and admin compare).
 *
 * If no active ruleset is found in the DB (e.g. migration hasn't run yet),
 * we fall back to a BAKED default that mirrors the v1.0.0 seed exactly,
 * so the engine always has a deterministic input.
 */

import type { Pool } from 'pg';

export interface EIRulesetConfig {
  total_cap: number;
  bands: Record<string, number>;                       // {label: min_score}
  dimensions: Record<string, EIDimensionConfig>;
  rounding: { breakdown_decimals: number; final_decimals: number };
}

export interface EIDimensionConfig {
  enabled: boolean;
  weight:  number;
  formula: 'percent' | 'count_linear' | 'weighted_sum_skills' | 'weighted_sum_certs' | 'evidence_only';
  params:  Record<string, any>;
}

export interface LoadedRuleset {
  id:                          string | null;
  version:                     string;
  config:                      EIRulesetConfig;
  taxonomy_version:            string | null;
  institution_dataset_version: string | null;
  confidence_model_version:    string | null;
  loaded_at:                   number;
  from_db:                     boolean;
}

const CACHE_TTL_MS = 30_000;
let cached: LoadedRuleset | null = null;

// ── Baked default — kept identical to migrations/20260521_ei_rules_engine.sql seed ──
export const BAKED_DEFAULT_RULESET: LoadedRuleset = {
  id: null,
  version: '1.0.0',
  taxonomy_version: 'phase2.0',
  institution_dataset_version: 'phase2.0',
  confidence_model_version: '1.0',
  loaded_at: 0,
  from_db: false,
  config: {
    total_cap: 99,
    bands: { Excellent: 80, Strong: 65, Good: 50, Developing: 35, Starter: 0 },
    rounding: { breakdown_decimals: 1, final_decimals: 0 },
    dimensions: {
      completeness:        { enabled: true, weight: 45, formula: 'percent',              params: { multiplier: 0.45, cap: 45 } },
      technical:           { enabled: true, weight: 20, formula: 'weighted_sum_skills',  params: { base_per_skill: 2.5, unresolved_credit_factor: 0.5, demand_weight_floor: 0.5, demand_weight_span: 0.5, confidence_floor: 0.5, cap: 20 } },
      soft:                { enabled: true, weight: 10, formula: 'count_linear',         params: { per_unit: 1.5, cap: 10 } },
      experience:          { enabled: true, weight: 15, formula: 'count_linear',         params: { per_unit: 5,   cap: 15 } },
      certifications:      { enabled: true, weight:  6, formula: 'weighted_sum_certs',   params: { tier_weights: { tier_1: 2.5, tier_2: 1.75, tier_3: 1.0, unverified: 0.5 }, unresolved_credit: 0.5, confidence_floor: 0.5, cap: 6 } },
      projects:            { enabled: true, weight:  6, formula: 'count_linear',         params: { per_unit: 1.5, cap: 6 } },
      institution_bonus:   { enabled: true, weight:  0, formula: 'evidence_only',        params: {} },
      qualification_bonus: { enabled: true, weight:  0, formula: 'evidence_only',        params: {} },
    },
  },
};

export async function getActiveRuleset(pool: Pool, opts: { skipCache?: boolean } = {}): Promise<LoadedRuleset> {
  if (!opts.skipCache && cached && (Date.now() - cached.loaded_at) < CACHE_TTL_MS) return cached;
  try {
    const r = await pool.query(
      `SELECT id, version, config, taxonomy_version, institution_dataset_version, confidence_model_version
         FROM ei_rulesets
        WHERE status = 'active'
        ORDER BY activated_at DESC NULLS LAST, created_at DESC
        LIMIT 1`,
    );
    if (r.rowCount) {
      const row = r.rows[0];
      cached = {
        id: row.id,
        version: row.version,
        config: row.config,
        taxonomy_version: row.taxonomy_version,
        institution_dataset_version: row.institution_dataset_version,
        confidence_model_version: row.confidence_model_version,
        loaded_at: Date.now(),
        from_db: true,
      };
      return cached;
    }
  } catch (e) {
    console.warn('[ei-rules] DB load failed, using baked default:', (e as Error).message);
  }
  // Fallback — never let the engine starve
  return { ...BAKED_DEFAULT_RULESET, loaded_at: Date.now() };
}

export async function getRulesetByVersion(pool: Pool, version: string): Promise<LoadedRuleset | null> {
  try {
    const r = await pool.query(
      `SELECT id, version, config, taxonomy_version, institution_dataset_version, confidence_model_version
         FROM ei_rulesets WHERE version=$1 LIMIT 1`, [version],
    );
    if (!r.rowCount) return null;
    const row = r.rows[0];
    return {
      id: row.id, version: row.version, config: row.config,
      taxonomy_version: row.taxonomy_version,
      institution_dataset_version: row.institution_dataset_version,
      confidence_model_version: row.confidence_model_version,
      loaded_at: Date.now(), from_db: true,
    };
  } catch { return null; }
}

export function invalidateRulesetCache() { cached = null; }
