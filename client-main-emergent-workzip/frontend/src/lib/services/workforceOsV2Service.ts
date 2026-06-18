/**
 * Workforce OS V2 — client service. Returns null on failure (never throws).
 */
async function safeJson<T>(p: Promise<Response>): Promise<T | null> {
  try { const r = await p; if (!r.ok) return null; return (await r.json()) as T; } catch { return null; }
}

const J = { 'Content-Type': 'application/json' };

export const workforceOsV2 = {
  async isEnabled(): Promise<boolean> {
    const r = await safeJson<{ feature_flag?: { workforceOSV2?: boolean } }>(fetch('/api/wos/v2/feature-flag'));
    return r?.feature_flag?.workforceOSV2 === true;
  },
  async marketForecast(body: { signalKey: string; horizonWeeks?: number; history?: Array<{ value: number; observed_at?: string }>; tenantId?: number }) {
    return safeJson<{ forecast: { trend: string; current_value: number; projected_value: number; delta_per_week: number; confidence: number; horizon_weeks: number; rationale?: string }; history_points: number }>(
      fetch('/api/wos/v2/market/forecast', { method: 'POST', credentials: 'include', headers: J, body: JSON.stringify(body) }),
    );
  },
  async simulate(body: { scenarioName?: string; baseline: { headcount: number; attritionAnnual?: number; hiringPerQuarter?: number; skillCoverage?: number }; knobs?: { attritionShockPct?: number; hiringScalePct?: number; upskillProgramLift?: number; horizonQuarters?: number }; tenantId?: number }) {
    return safeJson<{ scenario_id: string | null; outcome: { projected_headcount: number; projected_skill_coverage: number; projected_gap_pct: number; cumulative_attritions: number; cumulative_hires: number; risk_band: string; rationale: string; horizon_quarters: number } }>(
      fetch('/api/wos/v2/predictive/simulate', { method: 'POST', credentials: 'include', headers: J, body: JSON.stringify(body) }),
    );
  },
  async fairnessDrift(body: { suiteKey?: string; groupLabel?: string; metric: string; baseline: number; current: number; baselineN: number; currentN: number; tenantId?: number }) {
    return safeJson<{ drift: { delta: number; z_score: number; is_significant: boolean; rationale: string; baseline_value: number; current_value: number } }>(
      fetch('/api/wos/v2/fairness/drift', { method: 'POST', credentials: 'include', headers: J, body: JSON.stringify(body) }),
    );
  },
  async abacEvaluate(body: { resource: string; action: string; attributes: Record<string, unknown>; tenantId?: number }) {
    return safeJson<{ decision: { effect: 'allow' | 'deny'; matched_policy: string | null; rationale: string; evaluated: Array<{ policy_key: string; matched: boolean; effect: string }> }; policy_count: number }>(
      fetch('/api/wos/v2/rbac/abac/evaluate', { method: 'POST', credentials: 'include', headers: J, body: JSON.stringify(body) }),
    );
  },
  async attribution(body: { interventionKey: string; cohortLabel?: string; observations: Array<{ pre: number; post: number }>; baselineDelta?: number; observationWeeks?: number; tenantId?: number }) {
    return safeJson<{ attribution: { cohort_size: number; delta_mean: number; delta_sigma: number; cohen_d: number; attribution_share: number; rationale: string } }>(
      fetch('/api/wos/v2/learning/attribution', { method: 'POST', credentials: 'include', headers: J, body: JSON.stringify(body) }),
    );
  },
};
