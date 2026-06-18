/**
 * Contextual Benchmark V2 — client service.
 */

async function safeJson<T>(p: Promise<Response>): Promise<T | null> {
  try { const r = await p; if (!r.ok) return null; return (await r.json()) as T; } catch { return null; }
}

export type V2Cohort = {
  cohort_id?: string; id?: string;
  cohort_label?: string; label?: string;
  sample_size?: number; n?: number;
  is_provisional?: boolean; provisional?: boolean;
  formed_from?: string[];
  rationale?: string;
};

export type V2ContextualResponse = {
  competency: string;
  raw_score: number; expected_level: number;
  scored: { contextual_score: number; confidence: number; reliability: number; growth_adjusted_score: number; rationale: string[] };
  percentile: number;
  readiness: { band: string; probability: number; rationale: string };
  cohort: V2Cohort;
  distribution: { p10: number; p25: number; p50: number; p75: number; p90: number; mean: number; std: number; sample_size: number; source: 'cohort' | 'fallback' };
  explainability: { why_cohort: string; why_percentile: string; why_readiness: string; why_confidence: string };
};

export type V2ReadinessEnvelope = {
  domain: string;
  composite_score: number;
  band: string;
  probability: number;
  contributors: Array<{ competency_code: string; weight: number; contribution: number }>;
  rationale: string;
};

function qs(p: Record<string, string | number | undefined | null>): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(p)) {
    if (v == null || v === '') continue;
    out.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return out.length ? `?${out.join('&')}` : '';
}

export const contextualBenchmarkV2 = {
  async isEnabled(): Promise<boolean> {
    const r = await safeJson<{ feature_flag?: { contextualScoringV2?: boolean } }>(fetch('/api/v2/benchmark/feature-flag'));
    return r?.feature_flag?.contextualScoringV2 === true;
  },

  async contextual(params: { competency: string; raw: number; expected?: number; role?: string; layer?: string; industry?: string; geography?: string; org_maturity?: string; team_scale?: string; seniority?: string; experience?: string; evidence?: number }) {
    return safeJson<V2ContextualResponse>(
      fetch(`/api/v2/benchmark/contextual${qs(params)}`, { credentials: 'include' }),
    );
  },

  async readiness(scores: Record<string, number>, ctx: Record<string, string | undefined> = {}) {
    const scoresStr = Object.entries(scores).map(([k, v]) => `${k}:${v}`).join(',');
    return safeJson<{ readiness: V2ReadinessEnvelope[] }>(
      fetch(`/api/v2/benchmark/readiness${qs({ scores: scoresStr, ...ctx })}`, { credentials: 'include' }),
    );
  },

  async peerCohort(ctx: Record<string, string | undefined>) {
    return safeJson<{ cohort: V2Cohort }>(fetch(`/api/v2/benchmark/peer-cohort${qs(ctx)}`, { credentials: 'include' }));
  },

  async distribution(params: { competency: string } & Record<string, string | undefined>) {
    return safeJson<{ competency: string; distribution: V2ContextualResponse['distribution'] }>(
      fetch(`/api/v2/benchmark/distribution${qs(params)}`, { credentials: 'include' }),
    );
  },
};
