/**
 * CAPADEX Behavioural Dimension Signal Classifier (Task #22 — richer signal capture).
 *
 * WHY THIS EXISTS
 * ──────────────
 * The composite/pattern intelligence layer needs ≥2 co-active atomic signals per
 * session (`ABSOLUTE_MIN_COUNT = 2` in `composite-signal-engine.ts`).  The legacy
 * evidence extractor keys an item's answer evidence ONLY on the session/item
 * *concern bucket*, so all ~10 items in a session collapse to a SINGLE concern
 * signal → composites/patterns can never form → the "Patterns" tab is always empty.
 *
 * THE GENUINE, NON-FABRICATED SECOND (AND THIRD …) SIGNAL
 * ──────────────────────────────────────────────────────
 * Every `sdi_items` row carries an authored, per-item behavioural facet:
 * `dimension` / `subdomain_code` (e.g. "Stress Reactivity", "Emotional
 * Regulation", "Avoidance", "Rumination", "Resilience", "Confidence Building")
 * plus a `polarity` ('(+)' coping-framed / '(-)' concern-framed).  These are REAL
 * authored metadata — not invented.  A user's answer on that item is genuine
 * evidence about that specific behavioural facet, and its *polarity-adjusted
 * distress* is the honest concern-diagnostic strength for that facet.
 *
 * This module is a PURE, deterministic classifier that maps an item's
 * dimension/subdomain text onto a canonical ontology concern-signal token
 * (drawn from the live `capadex_signals` cluster vocabulary) and computes the
 * polarity-adjusted distress.  It is faithful first — composite formation is a
 * *consequence* of two genuinely-distressed facets landing in the same ontology
 * cluster, never something the mapping is contorted to force.
 *
 * HONESTY GUARANTEES (do not weaken):
 *   - No fabrication.  A dimension that has no faithful semantic match returns
 *     `null` (honest UNCLASSIFIED → no signal emitted).
 *   - Polarity-correct.  '(+)' (coping-framed) distress = (MAX − value)/(MAX − 1);
 *     '(-)' (concern-framed) distress = (value − 1)/(MAX − 1).  Matches the
 *     `computeItemScore` polarity convention (`isPositive = !polarity.includes('-')`).
 *   - Concern-diagnostic only.  Signals describe concerns, never strengths — a
 *     low-distress answer (healthy coping) emits nothing.
 *   - Canonical-token only.  We only emit tokens that exist in the ontology
 *     cluster vocabulary, so a faithful match can actually participate in a
 *     composite (an off-ontology token would be dead weight).
 */

/** Likert ceiling used to normalise an answer value into a 0..1 distress. */
const LIKERT_MAX = 5;

/**
 * Ordered keyword → canonical-token rules (first match wins). Ordered
 * most-specific-first so a narrow facet (e.g. "future") is not swallowed by a
 * broader sibling (e.g. "career"). Every target token appears in a
 * `hidden_pattern_contribution` cluster in `capadex_signals` (see
 * `capadex-signals-seeder.ts`), so a match can co-form a composite.
 */
const RULES: Array<[RegExp, string]> = [
  // ── Stress / capacity family (burnout_cluster · collapse_cluster) ──────────
  // Overwhelm / energy collapse / burnout.
  [/overwhelm|burnout|exhaust|depletion|overload|energy (depletion|management|leadership|leak)/, 'emotional_overload'],
  // Acute stress reactivity, pressure, anticipatory dread, triggers.
  [/stress reactiv|pressure|anticipat|dread|panic|tension|trigger/, 'stress_reactivity'],
  // Resilience / recovery capacity.
  [/resilien|recover|bounce ?back/, 'low_resilience'],

  // ── Regulation family (stress_regulation_cluster) ─────────────────────────
  // Emotional & self regulation, composure, grounding, somatic awareness.
  [/emotional regulation|self.?regulation|self.?compassion|self.?talk|composure|grounding|breathing|body (awareness|signal)/, 'emotional_regulation'],
  // General stress management / coping literacy / reframing.
  [/stress (manage|literacy|reframing|reframe|insight)|coping|reframing|reframe/, 'stress_management'],

  // ── Cognitive family (cognitive_avoidance_cluster) ────────────────────────
  // Rumination / overthinking / cognitive control / focus.
  [/rumination|overthink|thought (insight|awareness|pattern)|cognitive|focus|concentrat|mental (block|noise)/, 'cognitive_blocking'],

  // ── Execution family (execution_breakdown_cluster) ────────────────────────
  // Procrastination / task initiation / follow-through / discipline.
  [/procrastin|task initiation|hardest first|follow.?through|consistency|routine|accountab|prioriti|preparation|study plan|prevention|discipline/, 'procrastination_pattern'],

  // ── Avoidance / disengagement (cognitive_avoidance · disengagement) ───────
  [/avoid|disengage|disconnect|escape/, 'avoidance_behavior'],
  // Motivation / engagement decline.
  [/motivation|engagement|momentum|drive/, 'motivation_decline'],

  // ── Self-worth family (instability_cluster) ───────────────────────────────
  [/perfectionism|fear of failure|fear insight|fear/, 'fear_of_failure'],
  [/confidence|self.?efficacy|self.?worth|self.?belief|self.?esteem/, 'confidence_instability'],

  // ── Social family (isolation_cluster · identity_dependency_cluster) ───────
  [/communicat/, 'communication_hesitation'],
  [/rejection|judg(e|ment)/, 'fear_of_rejection'],
  [/social comparison|comparison|peer/, 'peer_comparison'],
  [/support seeking|help seeking|isolation|loneliness|connection|boundary|boundaries|withdraw/, 'social_withdrawal'],

  // ── Career / identity family (career_stress · career_paralysis) ──────────
  [/placement|employab|internship/, 'placement_anxiety'],
  [/future|uncertain/, 'future_uncertainty'],
  [/identity/, 'identity_confusion'],
  [/career|goal setting|values alignment|direction|purpose|aspiration/, 'career_confusion'],
];

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * Map an item's behavioural-facet text to a canonical ontology concern-signal
 * token. Returns `null` when no faithful match exists (honest UNCLASSIFIED).
 */
export function classifyDimensionToken(
  dimension: string | null | undefined,
  subdomain: string | null | undefined,
): string | null {
  const text = `${dimension ?? ''} ${subdomain ?? ''}`.toLowerCase().trim();
  if (!text) return null;
  for (const [re, token] of RULES) {
    if (re.test(text)) return token;
  }
  return null;
}

/**
 * Polarity-adjusted distress in 0..1 for one answer. '(+)' coping-framed items
 * invert (low agreement = high distress); '(-)' concern-framed items do not.
 */
export function dimensionDistress(value: number, polarity: string | null | undefined): number {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  const isPositive = !String(polarity ?? '(+)').includes('-');
  const distress = isPositive
    ? (LIKERT_MAX - v) / (LIKERT_MAX - 1)
    : (v - 1) / (LIKERT_MAX - 1);
  return clamp01(distress);
}

export interface DimensionSignal {
  /** Canonical ontology token (also the evidence_key / signal_key). */
  token: string;
  /** Polarity-adjusted distress in 0..1 (the evidence strength). */
  strength: number;
}

/**
 * Classify one item into a genuine dimension concern-signal, or `null`.
 *
 * Emits ONLY when (a) the dimension maps to a canonical ontology token AND
 * (b) the polarity-adjusted distress is at least `minDistress` (candidate-level
 * or higher) — so a healthy/coping answer never manufactures a concern signal.
 */
export function classifyDimensionSignal(
  args: {
    dimension?: string | null;
    subdomain?: string | null;
    polarity?: string | null;
    value: number;
  },
  minDistress = 0.2,
): DimensionSignal | null {
  const token = classifyDimensionToken(args.dimension, args.subdomain);
  if (!token) return null;
  const strength = dimensionDistress(args.value, args.polarity);
  if (strength < minDistress) return null;
  return { token, strength };
}
