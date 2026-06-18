/**
 * CAPADEX Honestly-Orphaned Concern Fallback Insight (Task #20).
 *
 * Design decision (documented — see docs/CAPADEX.md §25):
 *   Concern → Signal seeding (Task #17) deliberately seeds ONLY strong/moderate
 *   Tier-3 mappings; atomic/bridge-tag and orphan/fallback mappings are excluded
 *   so the measured spine never fabricates intelligence. A small set of concerns
 *   therefore resolve to NO seedable mapping and produce an entirely empty spine
 *   (no signals → no composites → no patterns → no interventions). For those
 *   sessions the user previously received nothing measured.
 *
 *   Rather than fabricate signals (which would dishonestly inflate the spine), we
 *   surface ONE conservative, explicitly low-confidence, general-support insight.
 *   It is:
 *     - **read-only** — built purely at the report-insight layer; it is NEVER
 *       persisted, NEVER seeded, and NEVER feeds the activation runtime. It cannot
 *       inflate composites/patterns because it does not touch them at all (they
 *       stay empty for an honestly-orphaned concern).
 *     - **explicitly distinguished** — carries `is_fallback: true`,
 *       `confidence_band: 'low'`, `source: 'general_support'` and a plain-language
 *       disclaimer so the report can render it as clearly NOT measured intelligence.
 *     - **only emitted when the measured spine is empty** — the moment a real
 *       signal/pattern/recommendation exists, the fallback disappears.
 *
 * This module is pure and deterministic (no I/O), mirroring the rest of the
 * read-only explainability layer.
 */

export interface FallbackSuggestion {
  /** Plain-language supportive action — generic and safe, never diagnostic. */
  action: string;
  /** Suggested cadence for the action. */
  timing: string;
}

/**
 * A single supportive insight for an honestly-orphaned concern. Deliberately
 * NOT shaped like an `InsightRecommendation` / `InterventionRow` so it can never
 * be mistaken for, or merged into, measured intelligence.
 */
export interface OrphanFallbackInsight {
  /** Always true — lets every consumer branch on "this is not measured". */
  is_fallback: true;
  /** Coarse band only — we never imply a measured numeric confidence. */
  confidence_band: 'low';
  /** Provenance marker — general supportive guidance, not concern-specific. */
  source: 'general_support';
  title: string;
  message: string;
  /** Explicit, user-facing statement that this is not based on a measured pattern. */
  disclaimer: string;
  suggestions: FallbackSuggestion[];
}

/**
 * Decide whether an honestly-orphaned fallback applies for a session.
 *
 * True only when the measured spine produced nothing the user can act on — no
 * active signals, no behavioural patterns, and no intervention recommendations.
 * This is exactly the "honestly orphaned" condition: the concern resolved to no
 * seedable Tier-3 mapping (or to none at all), so the spine stayed silent.
 */
export function shouldEmitOrphanFallback(spine: {
  signalCount: number;
  patternCount: number;
  recommendationCount: number;
}): boolean {
  return spine.signalCount === 0 && spine.patternCount === 0 && spine.recommendationCount === 0;
}

/** Generic, safe supportive actions — concern-category agnostic, never diagnostic. */
const BASELINE_SUGGESTIONS: FallbackSuggestion[] = [
  {
    action: 'Establish one fixed anchor behaviour you repeat at the same time each day — consistency precedes change.',
    timing: 'Start today',
  },
  {
    action: 'Notice the single most common trigger linked to your concern and reduce one exposure to it for five days.',
    timing: 'Days 1–5',
  },
  {
    action: 'Spend five minutes at day-end on structured reflection — write one thing you noticed about your own pattern.',
    timing: 'Daily',
  },
];

/**
 * Build the single low-confidence supportive fallback insight for an
 * honestly-orphaned concern. Pure and deterministic — the concern name (when
 * present) is used only to personalise the framing copy, never to assert any
 * measured finding.
 */
export function buildOrphanFallbackInsight(concernName: string | null | undefined): OrphanFallbackInsight {
  const concern = String(concernName || '').trim();
  const subject = concern ? `"${concern}"` : 'this concern';

  return {
    is_fallback: true,
    confidence_band: 'low',
    source: 'general_support',
    title: 'General supportive guidance',
    message:
      `We could not detect a specific, measurable behavioural pattern for ${subject} from this session, ` +
      'so no personalised intelligence is shown above. The general, evidence-informed starting points below ' +
      'apply broadly and can help while a fuller picture develops.',
    disclaimer:
      'Low confidence — general guidance only. This is not based on a measured behavioural pattern from your responses.',
    suggestions: BASELINE_SUGGESTIONS,
  };
}
