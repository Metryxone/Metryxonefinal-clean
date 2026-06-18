/**
 * CAPADEX Behavioural Signal Classifier
 * Step 2: Behavioural Signal Capture — Ultimate Unified Architecture
 *
 * Implements: signal taxonomy, weighting engine, severity engine,
 * cross-signal correlation, early warning detection, growth intelligence
 */

export interface QuestionTiming {
  response_time_ms: number;
  hesitation_ms?: number;
  answer_changed: boolean;
  response_value: number;
}

export interface CapturedSignal {
  signal_type: string;
  signal_key: string;
  signal_value: Record<string, unknown>;
  weight: number;
  severity: string;
  confidence: number;
  description: string;
}

export interface EarlyWarning {
  type: string;
  severity: string;
  description: string;
  confidence: number;
}

export interface GrowthIndicator {
  indicator: string;
  strength: string;
  evidence: string;
}

export interface LinguisticAnalysis {
  absolutism_score: number;
  helplessness_indicators: string[];
  fatigue_markers: string[];
  anxiety_markers: string[];
  emotional_vocabulary: string[];
  intensity_score: number;
  certainty_score: number;
  detected_patterns: string[];
}

export interface SignalProfile {
  emotional_load: number;
  cognitive_load: number;
  engagement_score: number;
  risk_score: number;
  composite_intensity: number;
  dominant_signals: CapturedSignal[];
  early_warnings: EarlyWarning[];
  growth_indicators: GrowthIndicator[];
  hidden_patterns: string[];
  reliability_score: number;
  volatility_score: number;
  severity_level: string;
  signal_count: number;
  intervention_priority: string;
  persona_signals: Record<string, unknown>;
  linguistic_summary: LinguisticAnalysis | Record<string, unknown>;
  behavioural_flags: string[];
}

// ── Severity levels ───────────────────────────────────────────────────────────
const SEVERITY_LEVELS = ['minimal', 'mild', 'moderate', 'elevated', 'severe', 'critical'];

function maxSeverity(a: string, b: string): string {
  return SEVERITY_LEVELS.indexOf(a) >= SEVERITY_LEVELS.indexOf(b) ? a : b;
}

function severityFromScore(score: number): string {
  if (score >= 80) return 'critical';
  if (score >= 65) return 'severe';
  if (score >= 50) return 'elevated';
  if (score >= 35) return 'moderate';
  if (score >= 20) return 'mild';
  return 'minimal';
}

// ── Linguistic Signal Analysis ────────────────────────────────────────────────
const ABSOLUTIST_WORDS = ['always', 'never', 'everyone', 'no one', 'nobody', 'nothing', 'everything', 'impossible', 'can\'t ever', 'will never', 'totally', 'completely', 'absolutely'];
const HELPLESSNESS_WORDS = ['can\'t', 'cannot', 'fail', 'failing', 'hopeless', 'pointless', 'worthless', 'useless', 'give up', 'giving up', 'no use', 'what\'s the point', 'doesn\'t matter', 'don\'t care anymore'];
const FATIGUE_WORDS = ['tired', 'exhausted', 'burnout', 'burnt out', 'drained', 'depleted', 'worn out', 'no energy', 'fatigue', 'weary', 'empty', 'wiped out'];
const ANXIETY_WORDS = ['anxious', 'anxiety', 'nervous', 'scared', 'panic', 'panicking', 'worried', 'worry', 'fear', 'dread', 'stress', 'stressed', 'overwhelming', 'overwhelmed', 'terrified', 'afraid'];
const CONFUSION_WORDS = ['confused', 'lost', 'don\'t know', 'unsure', 'no idea', 'blank', 'clueless', 'can\'t think'];
const INTENSITY_AMPLIFIERS = ['very', 'so', 'really', 'extremely', 'incredibly', 'absolutely', 'completely', 'totally', 'severely'];

export function analyzeLinguisticSignals(text: string): LinguisticAnalysis {
  if (!text) {
    return {
      absolutism_score: 0, helplessness_indicators: [], fatigue_markers: [],
      anxiety_markers: [], emotional_vocabulary: [], intensity_score: 0.5,
      certainty_score: 0.5, detected_patterns: [],
    };
  }

  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);

  const helplessness = HELPLESSNESS_WORDS.filter(w => lower.includes(w));
  const fatigue      = FATIGUE_WORDS.filter(w => lower.includes(w));
  const anxiety      = ANXIETY_WORDS.filter(w => lower.includes(w));
  const absolutism   = ABSOLUTIST_WORDS.filter(w => lower.includes(w));
  const confusion    = CONFUSION_WORDS.filter(w => lower.includes(w));
  const amplifiers   = INTENSITY_AMPLIFIERS.filter(w => lower.includes(w));

  const absolutismScore = Math.min(1, absolutism.length / 3);
  const intensityScore  = Math.min(1, 0.4 + amplifiers.length * 0.12 + (helplessness.length + fatigue.length + anxiety.length) * 0.05);
  const certaintyScore  = Math.max(0, 1 - absolutismScore - confusion.length * 0.1);

  const emotionalVocab = [...new Set([...helplessness, ...fatigue, ...anxiety, ...confusion])];

  const patterns: string[] = [];
  if (absolutism.length >= 2) patterns.push('absolutist_thinking');
  if (helplessness.length >= 1) patterns.push('learned_helplessness');
  if (fatigue.length >= 1) patterns.push('fatigue_indicators');
  if (anxiety.length >= 1) patterns.push('anxiety_indicators');
  if (confusion.length >= 1) patterns.push('confusion_indicators');
  if (intensityScore > 0.7) patterns.push('high_emotional_intensity');

  return {
    absolutism_score: parseFloat(absolutismScore.toFixed(2)),
    helplessness_indicators: helplessness,
    fatigue_markers: fatigue,
    anxiety_markers: anxiety,
    emotional_vocabulary: emotionalVocab,
    intensity_score: parseFloat(intensityScore.toFixed(2)),
    certainty_score: parseFloat(certaintyScore.toFixed(2)),
    detected_patterns: patterns,
  };
}

// ── Timing Signal Classification ─────────────────────────────────────────────
function classifyTimingSignal(itemId: string, timing: QuestionTiming): CapturedSignal[] {
  const signals: CapturedSignal[] = [];
  const rt = timing.response_time_ms;

  if (rt < 800) {
    signals.push({
      signal_type: 'implicit',
      signal_key: 'rapid_answer',
      signal_value: { item_id: itemId, response_time_ms: rt, response_value: timing.response_value },
      weight: 1.5,
      severity: 'mild',
      confidence: 0.75,
      description: `Rapid response (${rt}ms) — possible impulsivity or disengagement`,
    });
  } else if (rt >= 8000 && rt < 15000) {
    signals.push({
      signal_type: 'implicit',
      signal_key: 'hesitation',
      signal_value: { item_id: itemId, response_time_ms: rt, response_value: timing.response_value },
      weight: 2.0,
      severity: 'moderate',
      confidence: 0.82,
      description: `Significant hesitation (${(rt / 1000).toFixed(1)}s) — possible anxiety or uncertainty`,
    });
  } else if (rt >= 15000) {
    signals.push({
      signal_type: 'implicit',
      signal_key: 'prolonged_hesitation',
      signal_value: { item_id: itemId, response_time_ms: rt, response_value: timing.response_value },
      weight: 2.5,
      severity: 'elevated',
      confidence: 0.85,
      description: `Prolonged hesitation (${(rt / 1000).toFixed(1)}s) — cognitive overload or severe anxiety`,
    });
  }

  if (timing.answer_changed) {
    signals.push({
      signal_type: 'implicit',
      signal_key: 'answer_changed',
      signal_value: { item_id: itemId, final_value: timing.response_value },
      weight: 1.5,
      severity: 'mild',
      confidence: 0.78,
      description: 'Answer revised — low confidence or internal conflict',
    });
  }

  return signals;
}

// ── Pattern Signals from Response Values ─────────────────────────────────────
function classifyResponsePatterns(timings: Record<string, QuestionTiming>): CapturedSignal[] {
  const signals: CapturedSignal[] = [];
  const values = Object.values(timings).map(t => t.response_value).filter(v => v != null);
  if (values.length < 2) return signals;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  if (mean <= 2.0) {
    signals.push({
      signal_type: 'emotional',
      signal_key: 'persistent_low_scoring',
      signal_value: { mean: parseFloat(mean.toFixed(2)), std_dev: parseFloat(stdDev.toFixed(2)), item_count: values.length },
      weight: 2.5,
      severity: mean <= 1.5 ? 'severe' : 'elevated',
      confidence: 0.88,
      description: `Consistently low responses (mean ${mean.toFixed(1)}/5) — emotional distress or burnout indicators`,
    });
  } else if (mean >= 4.3) {
    signals.push({
      signal_type: 'cognitive',
      signal_key: 'high_response_pattern',
      signal_value: { mean: parseFloat(mean.toFixed(2)), std_dev: parseFloat(stdDev.toFixed(2)), item_count: values.length },
      weight: 1.0,
      severity: 'minimal',
      confidence: 0.70,
      description: `Consistently high responses (mean ${mean.toFixed(1)}/5) — strong confidence or possible social desirability bias`,
    });
  }

  if (stdDev > 1.4) {
    signals.push({
      signal_type: 'cognitive',
      signal_key: 'response_volatility',
      signal_value: { std_dev: parseFloat(stdDev.toFixed(2)), mean: parseFloat(mean.toFixed(2)) },
      weight: 2.0,
      severity: stdDev > 2.0 ? 'elevated' : 'moderate',
      confidence: 0.80,
      description: `High response volatility (σ=${stdDev.toFixed(2)}) — cognitive instability or inconsistent self-perception`,
    });
  }

  const rapidCount = Object.values(timings).filter(t => t.response_time_ms < 800).length;
  const totalQ = Object.keys(timings).length;
  if (totalQ > 0 && rapidCount / totalQ > 0.5) {
    signals.push({
      signal_type: 'cognitive',
      signal_key: 'rapid_answer_pattern',
      signal_value: { rapid_count: rapidCount, total: totalQ, ratio: parseFloat((rapidCount / totalQ).toFixed(2)) },
      weight: 2.0,
      severity: 'moderate',
      confidence: 0.82,
      description: `${rapidCount}/${totalQ} questions answered rapidly — impulsivity pattern or disengagement`,
    });
  }

  const changedCount = Object.values(timings).filter(t => t.answer_changed).length;
  if (changedCount >= 3) {
    signals.push({
      signal_type: 'implicit',
      signal_key: 'frequent_answer_changes',
      signal_value: { changed_count: changedCount, total: totalQ },
      weight: 1.8,
      severity: 'moderate',
      confidence: 0.80,
      description: `${changedCount} answers revised — pervasive low confidence or internal conflict`,
    });
  }

  return signals;
}

// ── Linguistic → CapturedSignal ───────────────────────────────────────────────
function linguisticToSignals(ling: LinguisticAnalysis): CapturedSignal[] {
  const signals: CapturedSignal[] = [];

  if (ling.absolutism_score > 0.15) {
    signals.push({
      signal_type: 'linguistic',
      signal_key: 'absolutist_thinking',
      signal_value: { score: ling.absolutism_score, words: ling.helplessness_indicators.slice(0, 5) },
      weight: 2.0,
      severity: ling.absolutism_score > 0.5 ? 'elevated' : 'moderate',
      confidence: 0.85,
      description: 'Absolutist language detected — possible cognitive distortion or extreme thinking patterns',
    });
  }

  if (ling.helplessness_indicators.length > 0) {
    signals.push({
      signal_type: 'emotional',
      signal_key: 'learned_helplessness',
      signal_value: { indicators: ling.helplessness_indicators },
      weight: 2.5,
      severity: ling.helplessness_indicators.length >= 2 ? 'severe' : 'elevated',
      confidence: 0.88,
      description: `Helplessness language (${ling.helplessness_indicators.join(', ')}) — possible learned helplessness or emotional fatigue`,
    });
  }

  if (ling.fatigue_markers.length > 0) {
    signals.push({
      signal_type: 'emotional',
      signal_key: 'fatigue_indicators',
      signal_value: { markers: ling.fatigue_markers },
      weight: 2.5,
      severity: ling.fatigue_markers.length >= 2 ? 'severe' : 'elevated',
      confidence: 0.87,
      description: `Fatigue language (${ling.fatigue_markers.join(', ')}) — burnout or emotional exhaustion indicators`,
    });
  }

  if (ling.anxiety_markers.length > 0) {
    signals.push({
      signal_type: 'emotional',
      signal_key: 'anxiety_indicators',
      signal_value: { markers: ling.anxiety_markers },
      weight: 2.2,
      severity: ling.anxiety_markers.length >= 2 ? 'elevated' : 'moderate',
      confidence: 0.86,
      description: `Anxiety language (${ling.anxiety_markers.join(', ')}) — stress and anxiety indicators`,
    });
  }

  if (ling.intensity_score > 0.7) {
    signals.push({
      signal_type: 'linguistic',
      signal_key: 'high_emotional_intensity',
      signal_value: { intensity_score: ling.intensity_score },
      weight: 1.5,
      severity: 'moderate',
      confidence: 0.75,
      description: 'High emotional intensity in language — significant emotional load present',
    });
  }

  return signals;
}

// ── Dimension Score Calculation ───────────────────────────────────────────────
function calcDimensions(signals: CapturedSignal[]): { emotional_load: number; cognitive_load: number; engagement_score: number; risk_score: number } {
  const MAX_EMOTIONAL = 25;
  const MAX_COGNITIVE = 20;

  const emotionalKeys = new Set(['learned_helplessness', 'fatigue_indicators', 'anxiety_indicators', 'persistent_low_scoring', 'high_emotional_intensity']);
  const cognitiveKeys = new Set(['hesitation', 'prolonged_hesitation', 'response_volatility', 'rapid_answer_pattern', 'absolutist_thinking', 'confusion_indicators']);
  const engagementNegKeys = new Set(['rapid_answer', 'rapid_answer_pattern', 'answer_changed', 'frequent_answer_changes']);

  let emotionalRaw = 0, cognitiveRaw = 0, engagementNeg = 0, riskRaw = 0;

  for (const sig of signals) {
    const w = sig.weight;
    const sev = SEVERITY_LEVELS.indexOf(sig.severity) + 1;
    const contribution = w * sev;

    if (emotionalKeys.has(sig.signal_key)) emotionalRaw += contribution;
    if (cognitiveKeys.has(sig.signal_key)) cognitiveRaw += contribution;
    if (engagementNegKeys.has(sig.signal_key)) engagementNeg += contribution;
    if (sig.severity === 'severe' || sig.severity === 'critical') riskRaw += w * 2;
    else if (sig.severity === 'elevated') riskRaw += w;
  }

  const emotional_load   = Math.min(100, Math.round((emotionalRaw / MAX_EMOTIONAL) * 100));
  const cognitive_load   = Math.min(100, Math.round((cognitiveRaw / MAX_COGNITIVE) * 100));
  const engagement_score = Math.max(0, Math.min(100, 85 - Math.round((engagementNeg / 10) * 100)));
  const risk_score       = Math.min(100, Math.round((riskRaw / 15) * 100));

  return { emotional_load, cognitive_load, engagement_score, risk_score };
}

// ── Early Warning Detection ───────────────────────────────────────────────────
function detectEarlyWarnings(signals: CapturedSignal[], dims: ReturnType<typeof calcDimensions>): EarlyWarning[] {
  const warnings: EarlyWarning[] = [];
  const keys = new Set(signals.map(s => s.signal_key));

  if (dims.emotional_load >= 65 && dims.cognitive_load >= 55) {
    warnings.push({
      type: 'burnout_trajectory_risk',
      severity: dims.emotional_load >= 80 ? 'severe' : 'elevated',
      description: 'Convergence of high emotional load and cognitive load — burnout trajectory indicators present.',
      confidence: 0.82,
    });
  }

  if (keys.has('learned_helplessness') && keys.has('persistent_low_scoring')) {
    warnings.push({
      type: 'helplessness_escalation',
      severity: 'elevated',
      description: 'Helplessness language combined with consistently low self-reported scores — possible emotional collapse risk.',
      confidence: 0.85,
    });
  }

  if (keys.has('anxiety_indicators') && (keys.has('hesitation') || keys.has('prolonged_hesitation'))) {
    warnings.push({
      type: 'anxiety_pattern_detected',
      severity: 'moderate',
      description: 'Anxiety language combined with response hesitation — active anxiety pattern requiring attention.',
      confidence: 0.80,
    });
  }

  if (keys.has('fatigue_indicators') && dims.engagement_score < 40) {
    warnings.push({
      type: 'burnout_disengagement',
      severity: 'elevated',
      description: 'Fatigue indicators with low engagement score — early burnout and withdrawal signal.',
      confidence: 0.83,
    });
  }

  if (keys.has('response_volatility') && keys.has('frequent_answer_changes')) {
    warnings.push({
      type: 'cognitive_instability',
      severity: 'moderate',
      description: 'High response volatility and frequent answer changes — cognitive instability or identity confusion.',
      confidence: 0.75,
    });
  }

  if (keys.has('rapid_answer_pattern') && dims.emotional_load >= 55) {
    warnings.push({
      type: 'emotional_flooding',
      severity: 'moderate',
      description: 'Rapid impulsive responses combined with emotional load — possible emotional flooding or overwhelm.',
      confidence: 0.72,
    });
  }

  return warnings;
}

// ── Growth Indicator Detection ────────────────────────────────────────────────
function detectGrowthIndicators(signals: CapturedSignal[], timings: Record<string, QuestionTiming>): GrowthIndicator[] {
  const indicators: GrowthIndicator[] = [];
  const keys = new Set(signals.map(s => s.signal_key));
  const values = Object.values(timings).map(t => t.response_value).filter(v => v != null);

  if (!keys.has('response_volatility') && values.length >= 4) {
    indicators.push({
      indicator: 'cognitive_stability',
      strength: 'medium',
      evidence: 'Consistent response patterns across questions — stable self-awareness and reflective capacity.',
    });
  }

  const deliberateCount = Object.values(timings).filter(t => t.response_time_ms >= 3000 && t.response_time_ms < 8000).length;
  if (deliberateCount > Object.keys(timings).length * 0.4) {
    indicators.push({
      indicator: 'reflective_engagement',
      strength: 'high',
      evidence: `${deliberateCount} questions answered with deliberate consideration — strong reflective thinking capacity.`,
    });
  }

  if (values.length > 0) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean >= 3.8) {
      indicators.push({
        indicator: 'performance_readiness',
        strength: mean >= 4.2 ? 'high' : 'medium',
        evidence: `Above-average self-reporting (mean ${mean.toFixed(1)}/5) — positive self-assessment and growth readiness.`,
      });
    }
  }

  if (!keys.has('rapid_answer_pattern') && !keys.has('frequent_answer_changes')) {
    indicators.push({
      indicator: 'considered_engagement',
      strength: 'medium',
      evidence: 'Measured response pacing with minimal answer revisions — confident and considered engagement.',
    });
  }

  return indicators;
}

// ── Hidden Pattern Detection ──────────────────────────────────────────────────
function detectHiddenPatterns(signals: CapturedSignal[], ling: LinguisticAnalysis | null): string[] {
  const patterns: string[] = [];
  const keys = new Set(signals.map(s => s.signal_key));

  if (keys.has('high_response_pattern') && ling?.absolutism_score && ling.absolutism_score > 0.2) {
    patterns.push('social_desirability_bias — high scores combined with absolute language may indicate masking');
  }
  if (keys.has('rapid_answer') && keys.has('persistent_low_scoring')) {
    patterns.push('emotional_numbing — quick dismissive answers at low scores suggest emotional shutdown');
  }
  if (ling?.helplessness_indicators.length && keys.has('deliberate_thinking' as string)) {
    patterns.push('masked_distress — careful thinking paired with helplessness language may indicate suppressed suffering');
  }
  if (keys.has('fatigue_indicators') && !keys.has('anxiety_indicators')) {
    patterns.push('silent_burnout — fatigue without expressed anxiety may indicate emotional suppression');
  }

  return patterns;
}

// ── Persona-Specific Signal Enrichment ───────────────────────────────────────
function enrichPersonaSignals(signals: CapturedSignal[], persona: string | null): Record<string, unknown> {
  const keys = new Set(signals.map(s => s.signal_key));
  const result: Record<string, unknown> = { persona };

  if (persona === 'student') {
    result.focus_stability = !keys.has('response_volatility') ? 'stable' : 'unstable';
    result.procrastination_risk = keys.has('rapid_answer_pattern') ? 'elevated' : 'low';
    result.learning_fatigue = keys.has('fatigue_indicators') ? 'detected' : 'not_detected';
    result.resilience = keys.has('persistent_low_scoring') ? 'low' : 'present';
  } else if (persona === 'parent') {
    result.parenting_stress = keys.has('anxiety_indicators') ? 'detected' : 'not_detected';
    result.emotional_concern_load = signals.filter(s => s.signal_type === 'emotional').length;
  } else if (persona === 'professional') {
    result.burnout_risk = keys.has('fatigue_indicators') && keys.has('persistent_low_scoring') ? 'high' : 'low';
    result.productivity_instability = keys.has('response_volatility') ? 'detected' : 'not_detected';
  }

  return result;
}

// ── Reliability & Volatility Scores ──────────────────────────────────────────
function calcReliability(signals: CapturedSignal[], totalQ: number): number {
  if (totalQ === 0) return 0.7;
  const rapid = signals.filter(s => s.signal_key === 'rapid_answer').length;
  const changed = signals.filter(s => s.signal_key === 'answer_changed').length;
  const penalty = (rapid / Math.max(totalQ, 1)) * 0.2 + (changed / Math.max(totalQ, 1)) * 0.1;
  return Math.max(0.4, parseFloat((0.9 - penalty).toFixed(2)));
}

function calcVolatility(signals: CapturedSignal[]): number {
  const volSignals = signals.filter(s => s.signal_key === 'response_volatility' || s.signal_key === 'frequent_answer_changes');
  return Math.min(1, parseFloat((volSignals.length * 0.25).toFixed(2)));
}

// ── Intervention Priority ─────────────────────────────────────────────────────
function calcInterventionPriority(warnings: EarlyWarning[], riskScore: number): string {
  const criticalOrSevere = warnings.filter(w => w.severity === 'severe' || w.severity === 'critical').length;
  if (criticalOrSevere >= 2 || riskScore >= 80) return 'critical';
  if (criticalOrSevere >= 1 || riskScore >= 60) return 'urgent';
  if (warnings.length >= 2 || riskScore >= 40) return 'elevated';
  return 'standard';
}

// ── Composite Intensity ───────────────────────────────────────────────────────
function calcCompositeIntensity(signals: CapturedSignal[]): number {
  const MAX_EXPECTED = 40;
  const raw = signals.reduce((sum, s) => sum + s.weight * (SEVERITY_LEVELS.indexOf(s.severity) + 1), 0);
  return Math.min(100, Math.round((raw / MAX_EXPECTED) * 100));
}

// ── Master Classification Function ───────────────────────────────────────────
export function classifySignals(
  timings: Record<string, QuestionTiming>,
  concernText: string | null,
  persona: string | null,
): { signals: CapturedSignal[]; profile: SignalProfile; linguistic: LinguisticAnalysis | null } {
  const allSignals: CapturedSignal[] = [];

  // 1. Timing signals per question
  for (const [itemId, timing] of Object.entries(timings)) {
    allSignals.push(...classifyTimingSignal(itemId, timing));
  }

  // 2. Pattern signals across responses
  allSignals.push(...classifyResponsePatterns(timings));

  // 3. Linguistic signals from concern text
  let linguistic: LinguisticAnalysis | null = null;
  if (concernText) {
    linguistic = analyzeLinguisticSignals(concernText);
    allSignals.push(...linguisticToSignals(linguistic));
  }

  // 4. Dimension scores
  const dims = calcDimensions(allSignals);

  // 5. Early warnings (cross-signal correlation)
  const earlyWarnings = detectEarlyWarnings(allSignals, dims);

  // 6. Growth indicators
  const growthIndicators = detectGrowthIndicators(allSignals, timings);

  // 7. Hidden patterns
  const hiddenPatterns = detectHiddenPatterns(allSignals, linguistic);

  // 8. Persona enrichment
  const personaSignals = enrichPersonaSignals(allSignals, persona);

  // 9. Meta-signals
  const totalQ = Object.keys(timings).length;
  const reliability = calcReliability(allSignals, totalQ);
  const volatility  = calcVolatility(allSignals);

  // 10. Composite
  const compositeIntensity = calcCompositeIntensity(allSignals);
  const severityLevel      = severityFromScore(Math.max(dims.emotional_load, dims.risk_score, compositeIntensity * 0.7));
  const interventionPrio   = calcInterventionPriority(earlyWarnings, dims.risk_score);

  // Dominant signals: top 6 by weight × severity
  const dominant = [...allSignals]
    .sort((a, b) => (b.weight * (SEVERITY_LEVELS.indexOf(b.severity) + 1)) - (a.weight * (SEVERITY_LEVELS.indexOf(a.severity) + 1)))
    .slice(0, 6);

  const behavioural_flags: string[] = [];
  if (dims.emotional_load > 60) behavioural_flags.push('high_emotional_load');
  if (dims.cognitive_load > 60) behavioural_flags.push('high_cognitive_load');
  if (dims.engagement_score < 40) behavioural_flags.push('low_engagement');
  if (earlyWarnings.length > 0) behavioural_flags.push('early_warning_triggered');
  if (volatility > 0.5) behavioural_flags.push('response_instability');

  const profile: SignalProfile = {
    emotional_load: dims.emotional_load,
    cognitive_load: dims.cognitive_load,
    engagement_score: dims.engagement_score,
    risk_score: dims.risk_score,
    composite_intensity: compositeIntensity,
    dominant_signals: dominant,
    early_warnings: earlyWarnings,
    growth_indicators: growthIndicators,
    hidden_patterns: hiddenPatterns,
    reliability_score: reliability,
    volatility_score: volatility,
    severity_level: severityLevel,
    signal_count: allSignals.length,
    intervention_priority: interventionPrio,
    persona_signals: personaSignals,
    linguistic_summary: linguistic ?? {},
    behavioural_flags,
  };

  return { signals: allSignals, profile, linguistic };
}
