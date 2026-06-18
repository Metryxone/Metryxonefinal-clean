/**
 * useBehaviouralIntelligence — Phase 2 hook.
 *
 * Calls POST /api/behavioural/diagnose with inline text sources OR
 *       POST /api/behavioural/diagnose/profile with { user_id } when the
 *       caller wants the server to pull from career_seeker_profiles + jobs + goals.
 *
 * Designed to fail gracefully — when no diagnosis is available, returns
 * `{ data: null, error }` so the Stage Guidance panel can skip the section.
 */

import { useEffect, useRef, useState } from 'react';

export type SourceType =
  | 'interview_transcript' | 'simulation' | 'resume' | 'project_description'
  | 'goal' | 'profile_summary' | 'job_note';

export interface BISource { source_type: SourceType; source_id: string; text: string; occurred_at?: string }

export interface SignalScore {
  signal_key: string;
  label: string;
  competency_id: string;
  frequency: number;
  confidence: number;
  evidence_count: number;
  recency_weight: number;
  behavioural_strength: number;
  evidence: Array<{
    signal_key: string;
    source_type: SourceType;
    source_id: string;
    snippet: string;
    occurred_at: string;
    match_strength: number;
  }>;
}

export interface ContradictionFlag {
  rule_id: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  detail: string;
  source_ids?: string[];
  developmental_action?: string;
}

export interface BehaviouralIntelligenceResponse {
  ok: boolean;
  fallback?: boolean;
  fallback_reason?: string;
  taxonomy_version?: string;
  contradiction_version?: string;
  source_count?: number;
  sources_by_type?: Record<string, number>;
  hit_count?: number;
  scores?: SignalScore[];
  rollups?: Array<{
    competency_id: string;
    signal_count: number;
    mean_strength: number;
    weakest_signal: string | null;
    strongest_signal: string | null;
  }>;
  contradictions?: {
    contradiction_score: number;
    contradiction_flags: ContradictionFlag[];
    rules_evaluated: number;
  };
  language_policy?: { allowed: string[]; disallowed: string[] };
  // ── Phase 3: psychometric rigor (merged from /api/psychometrics/infer) ──
  psychometrics?: PsychometricsEnvelope;
  stability?: StabilityEnvelope;
}

export interface ReliabilityBreakdown {
  signal_key: string;
  competency_id: string;
  metric_specificity: number;
  behavioural_density: number;
  external_validation: number;
  consistency: number;
  recency: number;
  contradiction_penalty: number;
  composite_reliability: number;
  excluded_evidence_reason?: string;
}

export interface SignalPosterior {
  signal_key: string;
  competency_id: string;
  alpha: number;
  beta: number;
  probability_mastery: number;       // 0..1
  uncertainty: number;               // 0..1 (sd on probability scale)
  evidence_strength: number;         // n_eff
  confidence_interval: { lower: number; upper: number; level: 0.95 };
  prior_used: { alpha: number; beta: number };
}

export interface CompetencyPosterior {
  competency_id: string;
  signal_count: number;
  probability_mastery: number;
  uncertainty: number;
  evidence_strength: number;
  confidence_interval: { lower: number; upper: number; level: 0.95 };
  contributing_signals: Array<{ signal_key: string; weight: number; probability_mastery: number }>;
}

export interface PsychometricsEnvelope {
  reliability: ReliabilityBreakdown[];
  signal_posteriors: SignalPosterior[];
  competency_posteriors: CompetencyPosterior[];
  excluded_signals: Array<{ signal_key: string; reason: string; composite: number }>;
  methodology_versions?: Record<string, string>;
}

export interface StabilityFlag {
  rule_id: 'temporary_spike' | 'inconsistency' | 'coaching_contamination' | 'behavioural_instability';
  signal_key?: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  detail: string;
  evidence: Record<string, number | string>;
  developmental_action: string;
}

export interface StabilityEnvelope {
  window_days: number;
  signals_analysed: number;
  signals_too_sparse: number;
  stability_index: number;
  flags: StabilityFlag[];
}

export interface UseBIArgs {
  /** Inline sources for ad-hoc diagnosis (preview / mockup mode). */
  sources?: BISource[];
  /** User id — when present, server pulls profile + jobs + goals. */
  userId?: string;
  enabled?: boolean;
}

export interface UseBIResult {
  data: BehaviouralIntelligenceResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

async function fetchDiagnosis(args: UseBIArgs): Promise<BehaviouralIntelligenceResponse> {
  const isProfileMode = !!args.userId && (!args.sources || args.sources.length === 0);
  const url  = isProfileMode ? '/api/behavioural/diagnose/profile' : '/api/behavioural/diagnose';
  const body = isProfileMode ? { user_id: args.userId } : { sources: args.sources ?? [] };
  const r = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`behavioural_http_${r.status}`);
  return r.json() as Promise<BehaviouralIntelligenceResponse>;
}

/** Phase 3 — fetch the Bayesian inference envelope alongside the diagnosis.
 *  Never throws: if psychometrics fails, the diagnosis still renders. */
async function fetchPsychometrics(args: UseBIArgs): Promise<PsychometricsEnvelope | null> {
  try {
    const isProfileMode = !!args.userId && (!args.sources || args.sources.length === 0);
    const url  = isProfileMode ? '/api/psychometrics/infer/profile' : '/api/psychometrics/infer';
    const body = isProfileMode ? {} : { sources: args.sources ?? [] };
    const r = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    const env = await r.json() as PsychometricsEnvelope & { ok?: boolean; fallback?: boolean };
    if (env.fallback || !env.signal_posteriors) return null;
    return {
      reliability: env.reliability ?? [],
      signal_posteriors: env.signal_posteriors,
      competency_posteriors: env.competency_posteriors ?? [],
      excluded_signals: env.excluded_signals ?? [],
      methodology_versions: env.methodology_versions,
    };
  } catch { return null; }
}

/** Phase 3 — fetch longitudinal stability (auth + self only). */
async function fetchStability(userId: string): Promise<StabilityEnvelope | null> {
  try {
    const r = await fetch('/api/psychometrics/stability', { credentials: 'include' });
    if (!r.ok) return null;
    const env = await r.json() as StabilityEnvelope & { ok?: boolean; fallback?: boolean };
    if ((env as { fallback?: boolean }).fallback) return null;
    void userId;
    return {
      window_days: env.window_days,
      signals_analysed: env.signals_analysed,
      signals_too_sparse: env.signals_too_sparse,
      stability_index: env.stability_index,
      flags: env.flags ?? [],
    };
  } catch { return null; }
}

export function useBehaviouralIntelligence(args: UseBIArgs): UseBIResult {
  const { sources, userId, enabled = true } = args;
  const [data,    setData]    = useState<BehaviouralIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [tick,    setTick]    = useState(0);
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!enabled) return;
    const hasInputs = (sources && sources.length > 0) || !!userId;
    if (!hasInputs) { setData(null); return; }

    setLoading(true);
    setError(null);
    Promise.all([
      fetchDiagnosis({ sources, userId }),
      fetchPsychometrics({ sources, userId }),
      userId ? fetchStability(userId) : Promise.resolve(null),
    ])
      .then(([diag, psy, stab]) => {
        if (!mounted.current) return;
        setData({ ...diag,
          psychometrics: psy ?? undefined,
          stability:     stab ?? undefined });
      })
      .catch((e: Error) => { if (mounted.current) setError(e.message); })
      .finally(() => { if (mounted.current) setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(sources ?? []), userId, enabled, tick]);

  return { data, loading, error, refetch: () => setTick(t => t + 1) };
}
