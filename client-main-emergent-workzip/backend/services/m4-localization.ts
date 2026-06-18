/**
 * Phase 4 — Localization Intelligence Engine (v4.0.0)
 *
 * Adjusts capability/benchmark interpretation by geography + culture:
 *   localized_weight(competency, country) = base_weight × m4_localization_weights.weight
 *                                                       × cultural_modifier(country, competency)
 *   cultural_modifier = 1 + (norm.score − 50) / 200    (clipped to [0.7, 1.3])
 *
 * Read-only — never writes to onto_* / bench_*.
 */
import type { Pool } from 'pg';

export const LOCALIZATION_VERSION = '4.0.0';

const clip = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

const CULTURAL_AFFINITY: Record<string, string> = {
  LEA: 'assertiveness',
  STR: 'long_term',
  COM: 'individualism',
  EIQ: 'indulgence',
  ADP: 'uncertainty',
  TEC: 'long_term',
  COG: 'uncertainty',
};

export function createLocalization(pool: Pool) {
  async function countries() {
    return (await pool.query(`SELECT * FROM m4_countries ORDER BY name`)).rows;
  }

  async function profile(countryId: string) {
    const [c, p, n, exp, lm, w, lp] = await Promise.all([
      pool.query(`SELECT * FROM m4_countries WHERE id = $1`, [countryId]),
      pool.query(`SELECT * FROM m4_country_workforce_profiles WHERE country_id = $1`, [countryId]),
      pool.query(`SELECT * FROM m4_cultural_behavioral_norms WHERE country_id = $1`, [countryId]),
      pool.query(`SELECT * FROM m4_regional_competency_expectations WHERE country_id = $1`, [countryId]),
      pool.query(`SELECT * FROM m4_regional_leadership_models WHERE country_id = $1`, [countryId]),
      pool.query(`SELECT * FROM m4_localization_weights WHERE country_id = $1`, [countryId]),
      pool.query(`SELECT * FROM m4_regional_language_policies WHERE country_id = $1`, [countryId]),
    ]);
    return {
      country: c.rows[0] ?? null,
      workforce_profile: p.rows[0] ?? null,
      cultural_norms: n.rows,
      competency_expectations: exp.rows,
      leadership_model: lm.rows[0] ?? null,
      localization_weights: w.rows,
      language_policy: lp.rows[0] ?? null,
    };
  }

  /**
   * Compute a country-modulated weight vector for a set of competencies.
   * Returns { competency_id: { base, weight, modifier, localized } }
   */
  async function localizedWeights(countryId: string, competencyIds: string[]) {
    const [normsR, weightsR] = await Promise.all([
      pool.query(`SELECT dimension, score FROM m4_cultural_behavioral_norms WHERE country_id = $1`, [countryId]),
      pool.query(`SELECT competency_id, weight FROM m4_localization_weights WHERE country_id = $1`, [countryId]),
    ]);
    const norms = Object.fromEntries(normsR.rows.map((r: any) => [r.dimension, +r.score]));
    const baseW = Object.fromEntries(weightsR.rows.map((r: any) => [r.competency_id, +r.weight]));
    const out: Record<string, { base: number; cultural_modifier: number; localized: number }> = {};
    for (const c of competencyIds) {
      const base = baseW[c] ?? 1.0;
      const dim = CULTURAL_AFFINITY[c];
      const dimScore = dim ? (norms[dim] ?? 50) : 50;
      const mod = clip(1 + (dimScore - 50) / 200, 0.7, 1.3);
      out[c] = { base, cultural_modifier: +mod.toFixed(3), localized: +(base * mod).toFixed(3) };
    }
    return out;
  }

  /** Adapt a raw score against regional expectations (1..5 level → 0..100 anchor). */
  async function adaptScores(countryId: string, scores: Record<string, number>) {
    const expR = await pool.query(
      `SELECT ontology_competency_id AS c, expected_level FROM m4_regional_competency_expectations WHERE country_id = $1`,
      [countryId]);
    const exp = Object.fromEntries(expR.rows.map((r: any) => [r.c, +r.expected_level]));
    const localized = await localizedWeights(countryId, Object.keys(scores));
    const out: Record<string, any> = {};
    for (const [comp, raw] of Object.entries(scores)) {
      const anchor = exp[comp] != null ? Math.round(((exp[comp] - 1) / 4) * 92 + 8) : 70;
      const ratio = raw / anchor;
      const status = ratio >= 1 ? 'meets' : ratio >= 0.9 ? 'approaching' : ratio >= 0.75 ? 'developing' : 'gap';
      out[comp] = {
        raw_score: raw,
        regional_anchor: anchor,
        ratio: +ratio.toFixed(3),
        status,
        weight: localized[comp]?.localized ?? 1.0,
        cultural_modifier: localized[comp]?.cultural_modifier ?? 1.0,
      };
    }
    return out;
  }

  async function languagePolicy(countryId: string) {
    return (await pool.query(`SELECT * FROM m4_regional_language_policies WHERE country_id = $1 LIMIT 1`, [countryId])).rows[0] ?? null;
  }

  return { countries, profile, localizedWeights, adaptScores, languagePolicy };
}
