/**
 * /backend/services/capadex-report-synthesis.ts
 *
 * Pure synthesis layer for the CAPADEX clarity report. Combines the explicit
 * questionnaire score with implicit BIOS behavioural signals
 * (capadex_signal_profiles + capadex_linguistic_signals + the
 * rapid_answer_pattern signal from capadex_session_signals) into a single
 * developmental archetype envelope.
 *
 * LANGUAGE POLICY: outputs are developmental signals only. No diagnostic,
 * clinical, or hiring/suitability language.
 *
 * All functions are pure and side-effect free so the route can call them
 * defensively — when BIOS rows are absent every field falls back to null/empty
 * and the report renders explicit content unchanged.
 */

export interface BehaviouralSignalInput {
  emotionalLoad: number;      // 0..100
  cognitiveLoad: number;      // 0..100
  engagementScore: number;    // 0..100
  volatilityScore: number;    // 0..1
  rapidAnswer: boolean;       // rapid_answer_pattern triggered (>50% answers <800ms)
  absolutismScore: number;    // 0..1 (linguistic)
}

export interface BehaviouralEnvelope {
  emotional_load: number;
  cognitive_load: number;
  engagement_score: number;
  volatility_score: number;
  rapid_answer: boolean;
  has_profile: boolean;
}

export interface LinguisticEnvelope {
  absolutism_score: number;
  intensity_score: number;
  certainty_score: number;
  has_linguistic: boolean;
}

export interface ArchetypePayload {
  key: 'over_indexed_optimization_strain'
     | 'potential_social_desirability_bias'
     | 'authentic_structural_growth_matrix';
  label: string;
  summary: string;
  tone: 'caution' | 'observe' | 'positive';
}

/**
 * Pure synthesis evaluator. Returns the single dominant developmental
 * archetype for the (score, behavioural signals) combination, or null when no
 * archetype matches or no behavioural data is present.
 *
 * Precedence (high-friction first, so a high score with high load is not
 * mis-read as a rapid ceiling-effect):
 *   1. Over-Indexed Optimization Strain  — score >= 80 AND (cognitive or emotional load > 70)
 *   2. Potential Social Desirability Bias — score >= 85 AND rapid_answer pattern
 *   3. Authentic Structural Growth Matrix — score <  50 AND low volatility
 */
export function synthesizeArchetype(
  score: number,
  signals: BehaviouralSignalInput | null,
): ArchetypePayload | null {
  if (!signals) return null;

  const { cognitiveLoad, emotionalLoad, volatilityScore, rapidAnswer } = signals;

  if (score >= 80 && (cognitiveLoad > 70 || emotionalLoad > 70)) {
    return {
      key: 'over_indexed_optimization_strain',
      label: 'Over-indexed optimisation strain',
      tone: 'caution',
      summary:
        'Your answers landed strongly, but the behavioural signals suggest they came with high mental effort — a sign of overthinking rather than ease. The growth opportunity here is building the same results with less friction.',
    };
  }

  if (score >= 85 && rapidAnswer) {
    return {
      key: 'potential_social_desirability_bias',
      label: 'Fast, consistently high responses',
      tone: 'observe',
      summary:
        'Your responses were both very high and answered quickly. This can reflect genuine confidence, or a tendency to gravitate toward the most favourable option. Revisiting a few areas more slowly can sharpen the picture.',
    };
  }

  if (score < 50 && volatilityScore <= 0.30) {
    return {
      key: 'authentic_structural_growth_matrix',
      label: 'Steady, authentic baseline',
      tone: 'positive',
      summary:
        'Your responses were steady and consistent throughout. This calm, low-variability baseline is an excellent starting point — it means guidance can begin immediately on solid, honest ground.',
    };
  }

  return null;
}

/** Build the behavioural envelope shape returned on the report payload. */
export function buildBehaviouralEnvelope(
  signals: BehaviouralSignalInput | null,
): BehaviouralEnvelope | null {
  if (!signals) return null;
  return {
    emotional_load: signals.emotionalLoad,
    cognitive_load: signals.cognitiveLoad,
    engagement_score: signals.engagementScore,
    volatility_score: signals.volatilityScore,
    rapid_answer: signals.rapidAnswer,
    has_profile: true,
  };
}
