/**
 * Phase 5 — Explainability Engine.
 *
 * For any composite score, decompose it into:
 *   - contributing competencies/features (with magnitude)
 *   - weighting logic + version
 *   - cohort + confidence
 *   - methodology versions used
 *   - freshness indicators
 *   - human-readable rationale
 *
 * Every API in Phase 5 attaches an _explainability block via `wrap()`.
 */
import type { Pool } from 'pg';

export const EXPLAINABILITY_VERSION = '5.0.0';

export interface Contributor {
  feature_id: string;
  feature_label: string;
  contribution: number;            // signed magnitude
  weight: number;
  value: number;
  band?: string;
}

export interface ExplainabilityEnvelope {
  score_type: string;
  score: number | null;
  contributors: Contributor[];
  weighting: { policy_version: string; modifiers?: Record<string, unknown> };
  methodology: { versions: Record<string, string> };
  cohort?: { id: string; n: number; confidence_tier: string };
  freshness_days: number | null;
  generated_at: string;
  rationale: string;
  language_policy: {
    allowed: string[];
    disallowed: string[];
  };
}

const LANGUAGE_POLICY = {
  allowed: ['developmental readiness', 'capability proximity', 'alignment indicator',
            'development opportunity', 'capability evolution', 'trajectory indicator'],
  disallowed: ['hiring prediction', 'promotion guarantee', 'employment prediction',
               'suitable candidate', 'likely to get hired'],
};

/** Wrap any payload with an explainability envelope. */
export function wrap<T extends object>(payload: T, env: Partial<ExplainabilityEnvelope> & {
  score_type: string;
}): T & { _explainability: ExplainabilityEnvelope } {
  const envelope: ExplainabilityEnvelope = {
    score_type: env.score_type,
    score: env.score ?? null,
    contributors: env.contributors ?? [],
    weighting: env.weighting ?? { policy_version: 'unknown' },
    methodology: env.methodology ?? { versions: {} },
    cohort: env.cohort,
    freshness_days: env.freshness_days ?? null,
    generated_at: new Date().toISOString(),
    rationale: env.rationale ?? '',
    language_policy: LANGUAGE_POLICY,
  };
  return { ...payload, _explainability: envelope };
}

/** Persist an explainability snapshot. */
export async function logExplanation(pool: Pool, params: {
  score_type: string; entity_id: string; score?: number;
  contributors: Contributor[]; weighting_version: string;
  methodology_version: string; cohort_id?: string;
  confidence_tier?: string; freshness_days?: number;
}): Promise<void> {
  const id = `ex_${params.score_type}_${params.entity_id}_${Date.now()}`;
  await pool.query(
    `INSERT INTO gov_explainability_logs
     (id, score_type, entity_id, score, contributors, weighting_version,
      methodology_version, cohort_id, confidence_tier, freshness_days)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)`,
    [id, params.score_type, params.entity_id, params.score ?? null,
     JSON.stringify(params.contributors), params.weighting_version,
     params.methodology_version, params.cohort_id ?? null,
     params.confidence_tier ?? null, params.freshness_days ?? null]);
}

/** Fetch current methodology versions registered with governance. */
export async function currentMethodologies(pool: Pool): Promise<Record<string, string>> {
  const { rows } = await pool.query<{ methodology_name: string; version: string }>(
    `SELECT methodology_name, version
       FROM gov_methodology_versions
      WHERE is_current
      ORDER BY methodology_name`);
  const out: Record<string, string> = {};
  for (const r of rows) out[r.methodology_name] = r.version;
  return out;
}

/** Pure helper: build contributor list from competency weights × user scores. */
export function decomposeWeightedComposite(
  vector: { competency_id: string; canonical_name: string; weight: number }[],
  userScores: Record<string, number>,
): Contributor[] {
  let totalW = 0;
  for (const v of vector) totalW += v.weight;
  if (totalW === 0) return [];
  const contribs: Contributor[] = vector.map(v => {
    const val = userScores[v.competency_id] ?? 0;
    const normW = v.weight / totalW;
    return {
      feature_id: v.competency_id,
      feature_label: v.canonical_name,
      weight: Math.round(normW * 1000) / 1000,
      value: val,
      contribution: Math.round(normW * val * 100) / 100,
      band: val >= 75 ? 'strength' : val >= 55 ? 'aligned'
            : val >= 40 ? 'development' : 'gap',
    };
  });
  return contribs.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
}

/** Heuristic rationale generator that respects language policy. */
export function buildRationale(scoreType: string, score: number, top: Contributor[]): string {
  const tops = top.slice(0, 3).map(c => `${c.feature_label} (${c.band})`).join(', ');
  if (scoreType === 'role_alignment') {
    return `Developmental readiness indicator of ${score.toFixed(1)} is anchored by ${tops}. ` +
           `This is a capability proximity signal, not a hiring or promotion prediction.`;
  }
  if (scoreType === 'mobility') {
    return `Mobility composite of ${score.toFixed(1)} reflects overlap, transferability and gap-coverage. ` +
           `Top contributors: ${tops}. Use this as a development opportunity indicator.`;
  }
  if (scoreType === 'trajectory') {
    return `Trajectory indicator is presented as a conservative range with confidence band; ` +
           `top influences: ${tops}.`;
  }
  return `Score ${score.toFixed(1)} is decomposed across contributing competencies; top: ${tops}.`;
}
