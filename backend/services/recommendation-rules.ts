/**
 * Phase 3.9 — Employability Recommendation Rules (curated).
 *
 * recommendation_rules express WHEN a recommendation in RECOMMENDATION_LIBRARY
 * fires, in terms of either a measured onto-domain state or a fired Phase-3.8
 * employability signal. A recommendation is emitted ONLY when its trigger is
 * MEASURED and satisfied. If the trigger is unmeasured (or a signal is
 * indeterminate) the recommendation is WITHHELD (never recommended on absent
 * evidence). A measured-but-unsatisfied trigger is 'not_applicable' (the subject
 * does not need it now) — that honesty is enforced by the engine, not here.
 *
 * Trigger kinds:
 *   - domain_state : a measurable onto-domain whose scaled score is below a band
 *       threshold. 'below_strong' = score < 65 (has development headroom);
 *       'low' = score < 50 (a significant gap warranting a credential/habit).
 *   - signal       : a Phase-3.8 signal that has fired for the subject.
 *
 * Thresholds line up with the shared band definitions and the Phase-3.8 signal
 * thresholds; exported as named constants so engine + tooling read ONE source.
 *
 * Code-defined (not a DB table) to keep flag-OFF byte-identical with zero DDL.
 */

export const RECOMMENDATION_RULES_VERSION = 'phase-3.9';

/** Below-Strong ceiling (development headroom) on the 0..100 scaled score. */
export const REC_BELOW_STRONG_MAX_SCORE = 65;
/** "Low" ceiling (significant gap) on the 0..100 scaled score. */
export const REC_LOW_MAX_SCORE = 50;

export type DomainDirection = 'below_strong' | 'low';

export interface DomainStateTrigger {
  type: 'domain_state';
  onto_domain: string;
  direction: DomainDirection;
}

export interface SignalTrigger {
  type: 'signal';
  signal_id: string;
  status: 'fired';
}

export type RecommendationTrigger = DomainStateTrigger | SignalTrigger;

export type RecommendationPriority = 'high' | 'medium' | 'low';

export interface RecommendationRule {
  recommendation_id: string;
  trigger: RecommendationTrigger;
  /** Baseline priority; the engine may RAISE it from measured severity. */
  base_priority: RecommendationPriority;
  rationale: string;
}

/**
 * Curated firing rules. Every onto_domain is measurable
 * (dom_cognitive/interpersonal/behavioral/functional — dom_strategic is
 * intentionally excluded as it is not measurable). Every signal_id matches a
 * Phase-3.8 signal. Every recommendation_id matches a RECOMMENDATION_LIBRARY entry.
 */
export const RECOMMENDATION_RULES: RecommendationRule[] = [
  // Development — domain below the Strong threshold (has headroom).
  {
    recommendation_id: 'rec_dev_cognitive',
    trigger: { type: 'domain_state', onto_domain: 'dom_cognitive', direction: 'below_strong' },
    base_priority: 'medium',
    rationale: 'Cognitive capability measured below the Strong threshold — development headroom.',
  },
  {
    recommendation_id: 'rec_dev_interpersonal',
    trigger: { type: 'domain_state', onto_domain: 'dom_interpersonal', direction: 'below_strong' },
    base_priority: 'medium',
    rationale: 'Interpersonal & leadership capability measured below the Strong threshold — development headroom.',
  },
  {
    recommendation_id: 'rec_dev_behavioral',
    trigger: { type: 'domain_state', onto_domain: 'dom_behavioral', direction: 'below_strong' },
    base_priority: 'medium',
    rationale: 'Behavioural capability measured below the Strong threshold — development headroom.',
  },
  {
    recommendation_id: 'rec_dev_functional',
    trigger: { type: 'domain_state', onto_domain: 'dom_functional', direction: 'below_strong' },
    base_priority: 'medium',
    rationale: 'Functional & execution capability measured below the Strong threshold — development headroom.',
  },

  // Certification — domain below the Developing threshold (a significant gap).
  {
    recommendation_id: 'rec_cert_functional',
    trigger: { type: 'domain_state', onto_domain: 'dom_functional', direction: 'low' },
    base_priority: 'medium',
    rationale: 'Functional & execution capability measured below the Developing threshold — a credential would close the gap.',
  },
  {
    recommendation_id: 'rec_cert_cognitive',
    trigger: { type: 'domain_state', onto_domain: 'dom_cognitive', direction: 'low' },
    base_priority: 'medium',
    rationale: 'Cognitive capability measured below the Developing threshold — a credential would build depth.',
  },

  // Project — leverage a confirmed strength (positive signal fired).
  {
    recommendation_id: 'rec_proj_innovation',
    trigger: { type: 'signal', signal_id: 'sig_innovation_potential', status: 'fired' },
    base_priority: 'medium',
    rationale: 'Innovation potential fired — a project would convert the strength into demonstrated impact.',
  },

  // Experience — realise a confirmed potential (positive signal fired).
  {
    recommendation_id: 'rec_exp_leadership',
    trigger: { type: 'signal', signal_id: 'sig_leadership_potential', status: 'fired' },
    base_priority: 'medium',
    rationale: 'Leadership potential fired — a team-lead/mentoring experience would realise it.',
  },

  // Behavioral — address a risk (risk signal fired) or a low behavioural domain.
  {
    recommendation_id: 'rec_behav_career_risk',
    trigger: { type: 'signal', signal_id: 'sig_career_risk', status: 'fired' },
    base_priority: 'high',
    rationale: 'Career-risk signal fired — structured adaptability & learning routines address the risk.',
  },
  {
    recommendation_id: 'rec_behav_adaptability',
    trigger: { type: 'domain_state', onto_domain: 'dom_behavioral', direction: 'low' },
    base_priority: 'high',
    rationale: 'Behavioural capability measured below the Developing threshold — adaptability habits would strengthen it.',
  },
];

export function getRecommendationRule(recommendationId: string): RecommendationRule | null {
  return RECOMMENDATION_RULES.find((r) => r.recommendation_id === recommendationId) ?? null;
}
