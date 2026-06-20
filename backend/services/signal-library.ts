/**
 * Phase 3.8 — Employability Signal Library (curated catalog).
 *
 * The signal_library is the CURATED set of higher-order employability signals
 * that can be derived by COMBINING measured competency strengths/weaknesses
 * (e.g. Strong Communication + Strong Collaboration + Strong Leadership ->
 * "Leadership Potential"). It is intentionally code-defined (not a DB table) so
 * that flag-OFF stays byte-identical with ZERO DDL, exactly like every other
 * Phase-3.x engine in this chain.
 *
 * A signal is a developmental SIGNAL only — never a hiring/promotion/placement
 * verdict. Each signal carries a polarity so the consumer can distinguish a
 * positive potential indicator from a risk indicator. The firing conditions for
 * a signal live in `signal-rules.ts`; this file is the human-readable catalog.
 */

export const SIGNAL_LIBRARY_VERSION = 'phase-3.8';

export type SignalPolarity = 'positive' | 'risk';

export interface SignalDefinition {
  signal_id: string;
  name: string;
  description: string;
  polarity: SignalPolarity;
  category: string;
}

/**
 * The curated signal catalog. Order is the display/priority order.
 * Every signal here MUST have a matching rule in SIGNAL_RULES, and every
 * competency a rule references MUST exist in onto_competencies (verified live).
 */
export const SIGNAL_LIBRARY: SignalDefinition[] = [
  {
    signal_id: 'sig_leadership_potential',
    name: 'Leadership Potential',
    description:
      'Strength across Communication, Collaboration and Leadership together — a developmental indicator of leadership potential, not a promotion verdict.',
    polarity: 'positive',
    category: 'leadership',
  },
  {
    signal_id: 'sig_innovation_potential',
    name: 'Innovation Potential',
    description:
      'Strength in Problem-Solving combined with Systems Thinking — a developmental indicator of innovation potential.',
    polarity: 'positive',
    category: 'innovation',
  },
  {
    signal_id: 'sig_career_risk',
    name: 'Career Risk Signal',
    description:
      'Low Adaptability combined with low Learning Agility — a developmental risk signal that flags an area to support, never a judgement of the person.',
    polarity: 'risk',
    category: 'risk',
  },
];

export function getSignalDefinition(signalId: string): SignalDefinition | null {
  return SIGNAL_LIBRARY.find((s) => s.signal_id === signalId) ?? null;
}
