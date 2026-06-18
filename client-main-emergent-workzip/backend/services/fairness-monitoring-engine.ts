/**
 * Phase 5 — Fairness & Bias Monitoring.
 *
 * Persistent fairness test suites + result history per surface/attribute/metric.
 * Supports three metrics out of the box:
 *   • disparate_impact_ratio (selection_rate_A / selection_rate_B); pass if >= threshold
 *   • mean_score_gap (|mean_A - mean_B|); pass if <= threshold
 *   • selection_rate_gap (|sel_A - sel_B|); pass if <= threshold
 *
 * Engine is pure-function for computation; DB helpers persist.
 */

import type { Pool } from 'pg';
import { randomUUID } from 'crypto';

export const FAIRNESS_MONITORING_VERSION = '5.0.0';

export type FairnessMetric = 'disparate_impact_ratio' | 'mean_score_gap' | 'selection_rate_gap';

export interface GroupSample {
  group_label: string;
  scores: number[];                                  // raw scores in [0,100]
  selection_threshold?: number;                      // default 65 — "selected" if score >= threshold
}

export interface FairnessTestInput {
  metric: FairnessMetric;
  group_a: GroupSample;
  group_b: GroupSample;
  threshold: number;
}

export interface FairnessTestOutput {
  metric: FairnessMetric;
  group_a: string; group_b: string;
  metric_value: number;
  threshold: number;
  passed: boolean;
  sample_size_a: number; sample_size_b: number;
  detail: Record<string, unknown>;
}

const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const round = (x: number, p = 4) => Math.round(x * 10 ** p) / 10 ** p;

export function computeFairness(input: FairnessTestInput): FairnessTestOutput {
  const { metric, group_a: a, group_b: b, threshold } = input;
  const thresholdA = a.selection_threshold ?? 65;
  const thresholdB = b.selection_threshold ?? 65;
  const selA = a.scores.length ? a.scores.filter(s => s >= thresholdA).length / a.scores.length : 0;
  const selB = b.scores.length ? b.scores.filter(s => s >= thresholdB).length / b.scores.length : 0;
  const meanA = mean(a.scores);
  const meanB = mean(b.scores);

  let metricValue = 0;
  let passed = false;
  const detail: Record<string, unknown> = { selection_rate_a: round(selA), selection_rate_b: round(selB),
                                            mean_a: round(meanA), mean_b: round(meanB) };

  // Hard guard: if either group has no samples, OR both have zero selected
  // candidates, fairness is mathematically undefined. We fail closed rather
  // than silently asserting "fair" (architect-flagged data-integrity issue).
  const insufficientData =
    a.scores.length === 0 || b.scores.length === 0 ||
    (metric === 'disparate_impact_ratio' && selA === 0 && selB === 0);

  if (insufficientData) {
    detail.insufficient_data = true;
    detail.note = 'Group sample size 0 (or both selection rates 0) — fairness undefined.';
    return {
      metric, group_a: a.group_label, group_b: b.group_label,
      metric_value: NaN,
      threshold: round(threshold),
      passed: false,
      sample_size_a: a.scores.length, sample_size_b: b.scores.length,
      detail,
    };
  }

  switch (metric) {
    case 'disparate_impact_ratio': {
      const num = Math.min(selA, selB);
      const den = Math.max(selA, selB);
      metricValue = den === 0 ? 0 : num / den;
      passed = metricValue >= threshold;
      break;
    }
    case 'mean_score_gap': {
      metricValue = Math.abs(meanA - meanB);
      passed = metricValue <= threshold;
      break;
    }
    case 'selection_rate_gap': {
      metricValue = Math.abs(selA - selB);
      passed = metricValue <= threshold;
      break;
    }
  }

  return {
    metric, group_a: a.group_label, group_b: b.group_label,
    metric_value: round(metricValue),
    threshold: round(threshold),
    passed,
    sample_size_a: a.scores.length, sample_size_b: b.scores.length,
    detail,
  };
}

// ── DB-backed ──────────────────────────────────────────────────────────────

export async function listSuites(pool: Pool) {
  const { rows } = await pool.query(
    `SELECT id, suite_name, description, protected_attributes, metric_set, thresholds, active, created_at
       FROM wos_fairness_suites WHERE active = TRUE ORDER BY created_at DESC`);
  return rows;
}

export async function createSuite(pool: Pool, args: {
  suite_name: string; description?: string;
  protected_attributes: string[]; metric_set: FairnessMetric[];
  thresholds: Record<string, number>;
}): Promise<{ id: string }> {
  const id = `fair_${randomUUID().slice(0, 10)}`;
  await pool.query(
    `INSERT INTO wos_fairness_suites
       (id, suite_name, description, protected_attributes, metric_set, thresholds)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, args.suite_name, args.description ?? null,
     JSON.stringify(args.protected_attributes),
     JSON.stringify(args.metric_set),
     JSON.stringify(args.thresholds)]);
  return { id };
}

export async function recordResult(pool: Pool, args: {
  suite_id: string; surface: string; attribute: string;
  result: FairnessTestOutput;
}): Promise<{ id: number }> {
  const r = args.result;
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO wos_fairness_results
       (suite_id, surface, attribute, metric, group_a, group_b, metric_value,
        threshold, passed, sample_size_a, sample_size_b, details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id`,
    [args.suite_id, args.surface, args.attribute, r.metric,
     r.group_a, r.group_b, r.metric_value, r.threshold, r.passed,
     r.sample_size_a, r.sample_size_b, JSON.stringify(r.detail)]);
  return { id: Number(rows[0].id) };
}

export async function listResults(pool: Pool, opts: {
  suite_id?: string; surface?: string; passed?: boolean; limit?: number;
} = {}) {
  const where: string[] = []; const params: any[] = [];
  if (opts.suite_id) { params.push(opts.suite_id); where.push(`suite_id = $${params.length}`); }
  if (opts.surface)  { params.push(opts.surface);  where.push(`surface = $${params.length}`); }
  if (opts.passed != null) { params.push(opts.passed); where.push(`passed = $${params.length}`); }
  const limit = Math.max(1, Math.min(opts.limit ?? 200, 1000));
  const { rows } = await pool.query(`
    SELECT id, suite_id, surface, attribute, metric, group_a, group_b,
           metric_value::float AS metric_value, threshold::float AS threshold,
           passed, sample_size_a, sample_size_b, details, measured_at
      FROM wos_fairness_results
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY measured_at DESC, id DESC
     LIMIT ${limit}
  `, params);
  return rows;
}

// ── Gap #1: auto-sample group scores from cra_scores ──────────────────────
//
// Pulls latest cra_scores per (user_id, competency) for two cohorts defined
// by a whitelisted profile attribute. Removes the need for callers to POST
// raw score arrays — fairness can now run against real assessment data.
//
// Attribute is whitelisted (NOT interpolated) to prevent SQL injection.
// Returns insufficient_data envelope as `scores: []` rather than throwing,
// so the downstream computeFairness() insufficient-data guard handles it.
const FAIRNESS_ATTR_WHITELIST: Record<string, string> = {
  industry:           'p.industry',
  career_stage:       'p.career_stage',
  org_layer:          'p.org_layer',
  org_maturity:       'p.org_maturity',
  geography:          'p.geography',
  current_department: 'p.current_department',
  education_level:    'p.education_level',
  age_band:           'p.age_band',
  gender:             'p.gender',
};

export async function sampleCohortScores(pool: Pool, args: {
  attribute: string;
  value_a: string;
  value_b: string;
  competency_code?: string | null;
  tenant_id?: number | null;          // reserved for future cra_profiles.tenant_id scoping
  selection_threshold?: number;
}): Promise<{ group_a: GroupSample; group_b: GroupSample }> {
  const col = FAIRNESS_ATTR_WHITELIST[args.attribute];
  if (!col) {
    return {
      group_a: { group_label: args.value_a ?? 'A', scores: [], selection_threshold: args.selection_threshold },
      group_b: { group_label: args.value_b ?? 'B', scores: [], selection_threshold: args.selection_threshold },
    };
  }
  // Latest score per (user, competency) — DISTINCT ON beats a window for portability.
  const baseSQL = `
    SELECT s.raw_score::float AS score
      FROM (
        SELECT DISTINCT ON (user_id, competency_code) user_id, competency_code, raw_score, created_at
          FROM cra_scores
          ${args.competency_code ? 'WHERE competency_code = $3' : ''}
          ORDER BY user_id, competency_code, created_at DESC
      ) s
      JOIN cra_profiles p ON p.user_id = s.user_id
     WHERE ${col} = $1
  `;
  const safeFetch = async (val: string): Promise<number[]> => {
    if (!val) return [];
    try {
      // When competency_code present, the inner subquery uses $3 (and $2 is unused).
      const p = args.competency_code ? [val, null, args.competency_code] : [val];
      const r = await pool.query<{ score: number }>(baseSQL, p);
      return r.rows.map(x => Number(x.score)).filter(Number.isFinite);
    } catch { return []; }
  };
  const [a, b] = await Promise.all([safeFetch(args.value_a), safeFetch(args.value_b)]);
  return {
    group_a: { group_label: args.value_a, scores: a, selection_threshold: args.selection_threshold },
    group_b: { group_label: args.value_b, scores: b, selection_threshold: args.selection_threshold },
  };
}

export function fairnessAttributeWhitelist(): string[] {
  return Object.keys(FAIRNESS_ATTR_WHITELIST);
}

export async function summary(pool: Pool) {
  const { rows } = await pool.query(`
    SELECT surface,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE passed = TRUE)::int AS passed,
           COUNT(*) FILTER (WHERE passed = FALSE)::int AS failed
      FROM wos_fairness_results
     GROUP BY surface
     ORDER BY surface
  `);
  return rows;
}
