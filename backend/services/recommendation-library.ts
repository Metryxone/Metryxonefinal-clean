/**
 * Phase 3.9 — Employability Recommendation Library (curated catalog).
 *
 * The recommendation_library is the CURATED set of actionable recommendations
 * the platform can surface for a subject, spanning five categories:
 *   - development   : build a capability that has headroom.
 *   - certification : pursue a formal credential to close a significant gap.
 *   - project       : take on work that leverages a confirmed strength.
 *   - experience    : seek a role/exposure that realises a confirmed potential.
 *   - behavioral    : adopt habits/routines to address a risk.
 *
 * Code-defined (not a DB table) so flag-OFF stays byte-identical with ZERO DDL,
 * exactly like the Phase-3.8 signal library and every other engine in the chain.
 * A recommendation is a developmental suggestion only — never a hiring/promotion
 * verdict. WHEN each recommendation fires lives in `recommendation-rules.ts`.
 */

export const RECOMMENDATION_LIBRARY_VERSION = 'phase-3.9';

export type RecommendationCategory =
  | 'development'
  | 'certification'
  | 'project'
  | 'experience'
  | 'behavioral';

export interface RecommendationDefinition {
  recommendation_id: string;
  category: RecommendationCategory;
  title: string;
  description: string;
}

/**
 * The curated recommendation catalog. Order is the display order. Every entry
 * MUST have a matching rule in RECOMMENDATION_RULES, and every trigger a rule
 * references MUST be a measurable onto_domain or a real signal id.
 */
export const RECOMMENDATION_LIBRARY: RecommendationDefinition[] = [
  // ---- Development (build a capability with headroom) ----------------------
  {
    recommendation_id: 'rec_dev_cognitive',
    category: 'development',
    title: 'Strengthen cognitive & analytical capability',
    description:
      'Cognitive capabilities have headroom — focused practice in analysis, reasoning and systems thinking would raise this area.',
  },
  {
    recommendation_id: 'rec_dev_interpersonal',
    category: 'development',
    title: 'Develop interpersonal & leadership capability',
    description:
      'Interpersonal & leadership capabilities have headroom — deliberate practice in communication, collaboration and leading others would raise this area.',
  },
  {
    recommendation_id: 'rec_dev_behavioral',
    category: 'development',
    title: 'Build behavioural capability',
    description:
      'Behavioural capabilities have headroom — building adaptability and problem-solving habits would raise this area.',
  },
  {
    recommendation_id: 'rec_dev_functional',
    category: 'development',
    title: 'Build functional & execution capability',
    description:
      'Functional & execution capabilities have headroom — hands-on practice in role-relevant execution skills would raise this area.',
  },

  // ---- Certification (close a significant gap with a credential) -----------
  {
    recommendation_id: 'rec_cert_functional',
    category: 'certification',
    title: 'Pursue a functional certification',
    description:
      'Functional & execution capability is below the developing threshold — a structured, role-relevant certification would close the gap with recognised evidence.',
  },
  {
    recommendation_id: 'rec_cert_cognitive',
    category: 'certification',
    title: 'Pursue an analytical certification',
    description:
      'Cognitive capability is below the developing threshold — a structured analytical / data certification would build depth with recognised evidence.',
  },

  // ---- Project (leverage a confirmed strength) -----------------------------
  {
    recommendation_id: 'rec_proj_innovation',
    category: 'project',
    title: 'Lead an innovation or improvement project',
    description:
      'Innovation potential is confirmed (strong problem-solving and systems thinking) — leading an improvement project would convert that potential into demonstrated impact.',
  },

  // ---- Experience (realise a confirmed potential) --------------------------
  {
    recommendation_id: 'rec_exp_leadership',
    category: 'experience',
    title: 'Seek a team-lead or mentoring experience',
    description:
      'Leadership potential is confirmed (strong communication, collaboration and leadership) — a team-lead or mentoring assignment would realise that potential through lived experience.',
  },

  // ---- Behavioral (address a risk with habits/routines) --------------------
  {
    recommendation_id: 'rec_behav_career_risk',
    category: 'behavioral',
    title: 'Adopt structured adaptability & learning routines',
    description:
      'A career-risk signal is present (low adaptability and low learning agility) — structured learning routines and adaptability practices would address the risk. A developmental suggestion, never a judgement of the person.',
  },
  {
    recommendation_id: 'rec_behav_adaptability',
    category: 'behavioral',
    title: 'Practise adaptability habits',
    description:
      'Behavioural capability is below the developing threshold — small, regular adaptability and resilience habits would steadily strengthen this area.',
  },
];

export function getRecommendationDefinition(recommendationId: string): RecommendationDefinition | null {
  return RECOMMENDATION_LIBRARY.find((r) => r.recommendation_id === recommendationId) ?? null;
}
