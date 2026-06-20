/**
 * Phase 3.8 — Employability Signal Rules (curated).
 *
 * signal_rules express WHEN a signal in SIGNAL_LIBRARY fires, in terms of the
 * measured strength/weakness of specific competencies. A rule is a conjunction
 * (AND) of conditions; a signal fires ONLY when every condition is satisfied by
 * a measured score. If any contributing competency is unmeasured the signal is
 * reported as indeterminate (never fired on partial evidence) — that honesty is
 * enforced by the engine, not here.
 *
 * Direction:
 *   - 'strong' : the competency is measured at or above the Strong threshold.
 *   - 'low'    : the competency is measured below the Developing threshold.
 *
 * Thresholds are expressed on the 0..100 scaled score so they line up with the
 * shared band definitions (Strong >= 65, Developing >= 50). They are exported as
 * named constants so the engine and any tooling read ONE source of truth.
 *
 * Code-defined (not a DB table) to keep flag-OFF byte-identical with zero DDL.
 */

export const SIGNAL_RULES_VERSION = 'phase-3.8';

/** Strong band floor (Strong/Excellent) on the 0..100 scaled score. */
export const SIGNAL_STRONG_MIN_SCORE = 65;
/** "Low" ceiling (below Developing -> Emerging/Early) on the 0..100 scaled score. */
export const SIGNAL_LOW_MAX_SCORE = 50;

export type SignalDirection = 'strong' | 'low';

export interface SignalCondition {
  competency_id: string;
  direction: SignalDirection;
}

export interface SignalRule {
  signal_id: string;
  conditions: SignalCondition[]; // conjunction (all must be satisfied)
  rationale: string;
}

/**
 * Curated firing rules. Every competency_id is verified to exist in
 * onto_competencies. Every signal_id matches a SIGNAL_LIBRARY entry.
 */
export const SIGNAL_RULES: SignalRule[] = [
  {
    signal_id: 'sig_leadership_potential',
    conditions: [
      { competency_id: 'comp_communication', direction: 'strong' },
      { competency_id: 'comp_collaboration', direction: 'strong' },
      { competency_id: 'comp_leadership', direction: 'strong' },
    ],
    rationale:
      'Strong Communication + Strong Collaboration + Strong Leadership together indicate leadership potential.',
  },
  {
    signal_id: 'sig_innovation_potential',
    conditions: [
      { competency_id: 'comp_problem_solving', direction: 'strong' },
      { competency_id: 'comp_systems_thinking', direction: 'strong' },
    ],
    rationale:
      'Strong Problem-Solving + Strong Systems Thinking together indicate innovation potential.',
  },
  {
    signal_id: 'sig_career_risk',
    conditions: [
      { competency_id: 'comp_adaptability', direction: 'low' },
      { competency_id: 'comp_learning_agility', direction: 'low' },
    ],
    rationale:
      'Low Adaptability + Low Learning Agility together flag a career risk to support.',
  },
];

export function getSignalRule(signalId: string): SignalRule | null {
  return SIGNAL_RULES.find((r) => r.signal_id === signalId) ?? null;
}
