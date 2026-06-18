/**
 * Atomic Bridge Resolver — connect NEGATIVE catch-all atomic signals to concerns.
 *
 * Context / why this exists:
 *   `capadex_atomic_signals.relational_bridge_tag` is the column that joins an
 *   atomic signal to a concern bucket in `capadex_concerns_master`. Historically
 *   ~65% of atomic rows carried the catch-all `GENERAL_CONCERN`. The honest
 *   reason for most of that is that the atomic catalogue is overwhelmingly made of
 *   POSITIVE capability signals (strengths) which have NO specific *concern* to
 *   attach to — concerns are problems people seek help for. Those positive signals
 *   are CORRECTLY left as GENERAL_CONCERN and are out of scope here.
 *
 *   This resolver targets ONLY the NEGATIVE (`signal_category='negative'`) catch-all
 *   atomic signals — the subset where a real concern connection can legitimately
 *   exist. Resolution is at the FAMILY level: each atomic family is a single,
 *   coherent behavioural theme (e.g. `procrastination_signals`), so a hand-verified
 *   family → concern-bridge-tag crosswalk is far more defensible than per-row keyword
 *   guessing. This mirrors the codebase's existing "hand-verified override constant"
 *   pattern (see `bridge-tag-resolver.ts` ORPHAN_BRIDGE_TAG_FALLBACK).
 *
 * Guardrails (no fabricated intelligence):
 *   - Map a family ONLY when its theme maps to a master concern bucket with
 *     near-synonym clarity. Genuinely ambiguous families, pure cognitive-capability
 *     families, and ethics/character families (which are not help-seeking concerns)
 *     are deliberately FLAGGED for human review, never force-assigned.
 *   - Every target tag MUST be a real `relational_bridge_tag` in
 *     `capadex_concerns_master` (validated by the apply script before any write).
 *   - This changes ONLY the additive concern→signal map + audit/stats surfaces.
 *     Live assessment scoring keys off `atomic_signal_id` (omega-x), not the bridge
 *     tag, so runtime behaviour is unchanged.
 */

export const GENERAL_CONCERN_TAG = 'GENERAL_CONCERN';

/**
 * Explicit home for POSITIVE capability signals. These are strengths — they have
 * no specific *concern* to attach to, so leaving them in the GENERAL_CONCERN
 * catch-all made them look like an "unmapped gap" when they are actually
 * correctly-classified strengths. Routing them here is accurate (driven purely by
 * `signal_category='positive'`), keeps strengths OUT of the concern-diagnosis
 * fallback pool, and lets the ontology panel show every signal as deliberately
 * classified (concern · strength · review) rather than a misleading leftover.
 */
export const STRENGTH_SIGNAL_TAG = 'STRENGTH_SIGNAL';

/**
 * Hand-verified family → master concern bridge-tag crosswalk.
 * Keys are `capadex_atomic_signals.family_name`; values are
 * `capadex_concerns_master.relational_bridge_tag` (verified to exist at apply time).
 * Only families with an unambiguous concern theme appear here.
 */
export const NEGATIVE_FAMILY_BRIDGE_MAP: Record<string, string> = {
  // ── Confidence · self-worth · identity ───────────────────────────────
  self_worth_signals:          'SELF_WORTH',
  identity_confusion_signals:  'IDENTITY_CONFLICT',
  authenticity_signals:        'IDENTITY_CONFLICT',     // social masking / internal-external identity gap
  approval_seeking_signals:    'CONFIDENCE_SELF',       // validation dependence ↔ self-confidence

  // ── Social · emotional (interpersonal) ───────────────────────────────
  social_withdrawal_signals:   'SOCIAL_EMOTIONAL',
  belonging_signals:           'SOCIAL_EMOTIONAL',
  peer_comparison_signals:     'SOCIAL_EMOTIONAL',
  judgment_fear_signals:       'SOCIAL_EMOTIONAL',
  visibility_anxiety_signals:  'SOCIAL_EMOTIONAL',
  influence_sensitivity_signals: 'SOCIAL_EMOTIONAL',

  // ── Communication ────────────────────────────────────────────────────
  communication_anxiety_signals: 'COMMUNICATION_EXPRESSION',
  public_speaking_signals:       'COMMUNICATION_EXPRESSION',
  speaking_confidence_signals:   'COMMUNICATION_EXPRESSION',
  verbal_fluency_signals:        'COMMUNICATION_EXPRESSION',

  // ── Motivation ───────────────────────────────────────────────────────
  motivational_volatility_signals: 'MOTIVATION_VALUES',
  reward_dependency_signals:       'MOTIVATION_VALUES',
  disengagement_signals:           'MOTIVATION_VALUES',

  // ── Discipline · execution · habits ──────────────────────────────────
  procrastination_signals:     'DISCIPLINE_HABITS',
  task_completion_signals:     'DISCIPLINE_HABITS',
  deadline_management_signals: 'DISCIPLINE_HABITS',
  deadline_response_signals:   'DISCIPLINE_HABITS',
  prioritization_signals:      'DISCIPLINE_HABITS',
  execution_breakdown_signals: 'DISCIPLINE_HABITS',

  // ── Decision ─────────────────────────────────────────────────────────
  indecision_signals:           'DECISION_ANXIETY',
  overthinking_decision_signals:'DECISION_ANXIETY',
  dependency_decision_signals:  'DECISION_INDEPENDENCE',

  // ── Behavioural regulation / impulse / avoidance ─────────────────────
  impulsive_behavior_signals:   'BEHAVIORAL_REGULATION',
  impulsive_decision_signals:   'BEHAVIORAL_REGULATION',
  behavioral_resistance_signals:'BEHAVIORAL_REGULATION',
  self_regulation_signals:      'SELF_REGULATION',
  avoidance_signals:            'ADJUSTMENT_COPING',
  risk_avoidance_signals:       'EXPLORATION_INHIBITION',

  // ── Wellbeing · lifestyle ────────────────────────────────────────────
  burnout_signals:             'LIFESTYLE_PRESSURE',
  burnout_prevention_signals:  'LIFESTYLE_PRESSURE',
  fatigue_signals:             'LIFESTYLE_PRESSURE',
  energy_regulation_signals:   'LIFESTYLE_PRESSURE',
  sleep_health_signals:        'LIFESTYLE_PRESSURE',
  work_life_balance_signals:   'LIFESTYLE_PRESSURE',
  mental_wellbeing_signals:    'EMOTIONAL_WELLBEING',

  // ── Emotional regulation · recovery ──────────────────────────────────
  stress_reactivity_signals:   'EMOTIONAL_REGULATION',
  emotional_decision_signals:  'EMOTIONAL_REGULATION',
  crisis_response_signals:     'ADJUSTMENT_COPING',
  relapse_risk_signals:        'RECOVERY_BEHAVIOR',

  // ── Performance ──────────────────────────────────────────────────────
  performance_pressure_signals:'PERFORMANCE_RESILIENCE',
  competitive_stress_signals:  'PERFORMANCE_RESILIENCE',
  overthinking_signals:        'THINKING_QUALITY',

  // ── Learning · skill · feedback · future · dependency ────────────────
  skill_gap_signals:           'SKILL_DEVELOPMENT',
  feedback_response_signals:   'FEEDBACK_ADAPTATION',
  future_orientation_signals:  'FUTURE_ORIENTATION',
  dependency_behavior_signals: 'INDEPENDENCE_DEVELOPMENT',
};

/** All distinct bridge tags this resolver can ever assign. */
export const RESOLVER_TARGET_TAGS: ReadonlySet<string> = new Set(
  Object.values(NEGATIVE_FAMILY_BRIDGE_MAP),
);

export type ResolutionRoute = 'family_curated' | 'flagged_review';

export interface AtomicBridgeResolution {
  family: string;
  resolved_tag: string | null; // null ⇒ stays GENERAL_CONCERN, needs human review
  route: ResolutionRoute;
}

/**
 * Resolve a NEGATIVE catch-all atomic signal's family to a concern bridge tag.
 * Pure + deterministic. Unmapped families are flagged, never guessed.
 */
export function resolveNegativeAtomicBridge(familyName: string): AtomicBridgeResolution {
  const family = (familyName ?? '').trim();
  const tag = NEGATIVE_FAMILY_BRIDGE_MAP[family];
  if (tag) return { family, resolved_tag: tag, route: 'family_curated' };
  return { family, resolved_tag: null, route: 'flagged_review' };
}
