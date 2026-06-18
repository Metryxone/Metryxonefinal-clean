/**
 * Phase 1 Enhancement — Contextual Expectation Engine
 *
 * Computes dynamic expected competency scores per the spec formula:
 *
 *   Expected Score =
 *     Base Role Weight (median anchor from gro_role_competency_expectations)
 *     × Industry Modifier
 *     × Layer Modifier
 *     × Function Modifier
 *     × Geography Modifier
 *     × Organizational Complexity Modifier
 *
 * Backward-compatible:
 *   - does NOT touch existing weighting-engine.ts
 *   - does NOT mutate `role_weights`, `competency_scores`, `bench_*`
 *   - operates exclusively over `gro_*` tables
 *
 * Output payload is suitable to be wrapped by explainability-engine.wrap().
 */
import type { Pool } from 'pg';
import { createContextualWeightEngine, type ContextTuple } from './contextual-weight-engine';

export const EXPECTATION_ENGINE_VERSION = '1.0.0';

export interface ExpectationRow {
  competency_id: string;
  base_minimum: number; base_median: number; base_maximum: number;
  expected_min: number; expected_median: number; expected_max: number;
  criticality_weight: number;
  percentile_distribution: { p10: number|null; p25: number|null; p50: number|null; p75: number|null; p90: number|null; p99: number|null };
  contextual_multiplier: number;
  multiplier_raw: number;
  multiplier_clamped: boolean;
  score_clamped: boolean;
  contributors: Array<{ source: string; multiplier: number; rationale: string | null }>;
}

export interface ExpectationReport {
  role_id: string;
  context: ContextTuple;
  rows: ExpectationRow[];
  methodology: { version: string; formula: string };
}

const FORMULA =
  'expected = base × industry × layer × function × geography × complexity (each missing modifier defaults 1.0; combined clamped 0.5..1.75)';

export function createExpectationEngine(pool: Pool) {
  const ctxEngine = createContextualWeightEngine(pool);

  async function expectationsFor(roleId: string, ctx: ContextTuple): Promise<ExpectationReport> {
    const { rows: baseRows } = await pool.query(
      `SELECT competency_id, minimum_score, median_score, maximum_score, criticality_weight,
              p10, p25, p50, p75, p90, p99
       FROM gro_role_competency_expectations
       WHERE role_id = $1 AND deleted_at IS NULL
       ORDER BY criticality_weight DESC NULLS LAST`,
      [roleId],
    );

    const compIds = baseRows.map(r => r.competency_id);
    const resolutions = await ctxEngine.resolveAll(ctx, compIds);
    const resByComp = new Map(resolutions.map(r => [r.competency_id, r]));

    const rows: ExpectationRow[] = baseRows.map(b => {
      const r = resByComp.get(b.competency_id)!;
      const m = r.combined;
      const rawMul = r.industry * r.layer * r.function * r.geography * r.complexity;
      const multiplierClamped = rawMul !== m;
      // Compute raw + clamped scores; flag if any score saturated at 100 (loss of differentiation signal).
      const raw = {
        min:    Number(b.minimum_score) * m,
        median: Number(b.median_score)  * m,
        max:    Number(b.maximum_score) * m,
      };
      const clip = (v: number) => Math.min(100, Math.max(0, Math.round(v * 10) / 10));
      const expectedMin = clip(raw.min), expectedMed = clip(raw.median), expectedMax = clip(raw.max);
      const scoreSaturated =
        (raw.min    > 100 || raw.min    < 0) ||
        (raw.median > 100 || raw.median < 0) ||
        (raw.max    > 100 || raw.max    < 0);
      return {
        competency_id: b.competency_id,
        base_minimum: Number(b.minimum_score),
        base_median:  Number(b.median_score),
        base_maximum: Number(b.maximum_score),
        expected_min:    expectedMin,
        expected_median: expectedMed,
        expected_max:    expectedMax,
        criticality_weight: Number(b.criticality_weight),
        percentile_distribution: {
          p10: b.p10 != null ? Number(b.p10) : null,
          p25: b.p25 != null ? Number(b.p25) : null,
          p50: b.p50 != null ? Number(b.p50) : null,
          p75: b.p75 != null ? Number(b.p75) : null,
          p90: b.p90 != null ? Number(b.p90) : null,
          p99: b.p99 != null ? Number(b.p99) : null,
        },
        contextual_multiplier: m,
        contributors: r.contributors,
        // Transparency flags — surfaced in UI/explainability so saturation is never silent
        multiplier_raw: +rawMul.toFixed(4),
        multiplier_clamped: multiplierClamped,
        score_clamped: scoreSaturated,
      } as ExpectationRow;
    });

    return {
      role_id: roleId,
      context: ctx,
      rows,
      methodology: { version: EXPECTATION_ENGINE_VERSION, formula: FORMULA },
    };
  }

  /** Compare user scores to expected → returns gap analysis using contextual expectations. */
  async function gapVsExpectations(roleId: string, ctx: ContextTuple, userScores: Record<string, number>) {
    const report = await expectationsFor(roleId, ctx);
    return {
      ...report,
      gaps: report.rows.map(r => {
        const actual = Number(userScores[r.competency_id] ?? 0);
        const gap = +(r.expected_median - actual).toFixed(2);
        const severity = gap <= 0 ? 'meets'
                       : gap <= 5  ? 'low'
                       : gap <= 12 ? 'medium'
                       : gap <= 20 ? 'high' : 'critical';
        return {
          competency_id: r.competency_id,
          actual, expected_median: r.expected_median,
          gap_pts: gap, severity,
          criticality_weight: r.criticality_weight,
          weighted_gap: +(Math.max(0, gap) * r.criticality_weight).toFixed(2),
        };
      }).sort((a, b) => b.weighted_gap - a.weighted_gap),
    };
  }

  return { expectationsFor, gapVsExpectations };
}
