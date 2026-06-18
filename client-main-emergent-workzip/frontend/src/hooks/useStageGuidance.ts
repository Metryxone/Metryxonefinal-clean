/**
 * useStageGuidance — Phase 1 micro-accurate guidance hook.
 *
 * Calls GET /api/career/stage-guidance and exposes the typed payload to the
 * Career Builder dashboard. Designed to fail gracefully — when the API
 * returns `static_fallback_used: true`, the consumer should render its static
 * `STAGE_GUIDANCE` content as the fallback.
 *
 * No external deps (no react-query) — keeps the bundle small and matches
 * existing Career Builder fetch patterns.
 */

import { useEffect, useRef, useState } from 'react';

export type GuidanceTrend = 'accelerating' | 'stabilizing' | 'flat' | 'declining';
export type ConfidenceTier = 'A' | 'B' | 'C' | 'D';
export type CohortTier = ConfidenceTier | 'provisional';

export interface StageGuidanceResponse {
  ok: boolean;
  version: string;
  elapsed_ms?: number;
  static_fallback_used: boolean;
  fallback_reason?: string;

  target_role: { id: string; name: string; family: string | null } | null;
  overall_gap: {
    current_ei: number;
    target_ei: number;
    gap_points: number;
    confidence_interval: { min: number; max: number };
  } | null;
  reliability: {
    composite_reliability: number;
    quality_tier: ConfidenceTier;
    contradictions_pct: number;
    completion_pct: number;
  } | null;
  gap_decomposition: Array<{
    competency_id: string;
    competency_name: string;
    user_score: number;
    cohort_p50: number | null;
    target_anchor: number;
    gap_pts: number;
    weighted_gap: number;
    percentile: number | null;
    weight: number;
    confidence_tier: CohortTier;
    trend: GuidanceTrend;
    velocity_30d: number;
  }>;
  ranked_steps: Array<{
    id: string;
    title: string;
    category: string;
    dimension: 'competency' | 'technical_skill' | 'certification' | 'education' |
               'functional_skill' | 'tool' | 'domain_expertise';
    competency_id: string;
    projected_ei_lift: number;
    confidence_interval: { min: number; max: number };
    confidence_tier: ConfidenceTier;
    effort_hours: number;
    roi_score: number;
    rationale: string;
    why_recommended: string[];
    behavioural_indicators: string[];
    importance?: 'critical' | 'required' | 'preferred' | 'nice_to_have';
    cta: { label: string; route: string };
  }>;
  requirement_summary?: Record<
    'technical_skill' | 'certification' | 'education' | 'functional_skill' | 'tool' | 'domain_expertise',
    { total: number; satisfied: number; missing: number; coverage: number }
  > & { total_missing_ei?: number };
  requirements_by_dimension?: Record<
    'technical_skill' | 'certification' | 'education' | 'functional_skill' | 'tool' | 'domain_expertise',
    Array<{
      dimension: string;
      item_name: string;
      item_meta?: Record<string, string | number | null>;
      importance: 'critical' | 'required' | 'preferred' | 'nice_to_have';
      ei_impact: number;
      effort_hours: number;
      weight: number;
      evidence_hint?: string | null;
      rationale: string;
    }>
  >;
  adjacent_offramp: {
    role_id: string;
    role_name: string;
    current_gap: number;
    projected_gap: number;
    switchability: number;
  } | null;
  explainability: {
    methodology_version: string;
    weighting_policy?: string;
    cohort_size?: number;
    cohort_tier?: string;
    data_sources: string[];
    ranking_formula: string;
    language_policy: { allowed: string[]; disallowed: string[] };
    generated_at: string;
  };
}

export interface UseStageGuidanceArgs {
  sessionId: string | null | undefined;
  targetRoleId?: string;
  userId?: string;
  /** When true, server is allowed to synthesise demo scores + reliability.
   *  Use ONLY until real user-score / response-data plumbing exists. */
  demo?: boolean;
  enabled?: boolean;
}

export interface UseStageGuidanceResult {
  data: StageGuidanceResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const inflight = new Map<string, Promise<StageGuidanceResponse>>();

function buildKey(a: UseStageGuidanceArgs): string {
  return [a.sessionId ?? '', a.targetRoleId ?? '', a.userId ?? '', a.demo ? '1' : '0'].join('|');
}

async function fetchGuidance(a: UseStageGuidanceArgs): Promise<StageGuidanceResponse> {
  const params = new URLSearchParams();
  if (a.sessionId)    params.set('session_id', a.sessionId);
  if (a.targetRoleId) params.set('target_role_id', a.targetRoleId);
  if (a.userId)       params.set('user_id', a.userId);
  if (a.demo)         params.set('demo', 'true');
  const url = `/api/career/stage-guidance?${params.toString()}`;
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`stage_guidance_http_${r.status}`);
  return r.json() as Promise<StageGuidanceResponse>;
}

export function useStageGuidance(args: UseStageGuidanceArgs): UseStageGuidanceResult {
  const { sessionId, enabled = true } = args;
  const [data,    setData]    = useState<StageGuidanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [tick,    setTick]    = useState(0);
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!enabled) return;
    if (!sessionId) { setData(null); return; }

    setLoading(true);
    setError(null);
    const key = buildKey(args);
    const promise = inflight.get(key) ?? fetchGuidance(args);
    inflight.set(key, promise);

    promise
      .then(p => {
        if (!mounted.current) return;
        setData(p);
        // Phase 1 telemetry — non-blocking; never fails the render
        try {
          window.dispatchEvent(new CustomEvent('mx-telemetry', {
            detail: {
              event: p.static_fallback_used ? 'guidance.fallback_used' : 'guidance.rendered',
              session_id: sessionId,
              target_role_id: p.target_role?.id ?? null,
              ranked_steps_count: p.ranked_steps?.length ?? 0,
              cohort_tier: p.explainability?.cohort_tier ?? null,
              reliability_tier: p.reliability?.quality_tier ?? null,
              elapsed_ms: p.elapsed_ms ?? null,
            },
          }));
        } catch { /* swallow telemetry errors */ }
      })
      .catch((e: Error) => {
        if (!mounted.current) return;
        setError(e.message);
        try {
          window.dispatchEvent(new CustomEvent('mx-telemetry', {
            detail: { event: 'guidance.error', session_id: sessionId, error: e.message },
          }));
        } catch { /* */ }
      })
      .finally(() => {
        inflight.delete(key);
        if (mounted.current) setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, args.targetRoleId, args.userId, args.demo, enabled, tick]);

  return { data, loading, error, refetch: () => setTick(t => t + 1) };
}
