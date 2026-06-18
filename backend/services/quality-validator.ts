/**
 * AI Quality Validation System
 *
 * Automatically evaluates every OMEGA-X report across five quality dimensions
 * before delivery — ensuring scientific integrity, psychological safety, and
 * narrative coherence on every report.
 *
 * Dimensions:
 *   narrative_quality     — coherence, non-repetition, length adequacy
 *   scientific_quality    — score/level consistency, calibration alignment
 *   safety_quality        — shame language, deterministic phrasing, diagnosis risk
 *   intervention_quality  — feasibility, specificity, actionability
 *   readability_score     — cognitive load, sentence complexity, jargon density
 *
 * Output: QualityValidationResult — an overall gate (pass/review/fail) plus
 * per-dimension scores (0–100) and flagged issues.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type QualityGate = 'pass' | 'review' | 'fail';

export interface QualityDimension {
  score: number;          // 0–100
  issues: string[];       // human-readable flags
}

export interface QualityValidationResult {
  gate: QualityGate;
  overall_score: number;  // 0–100 weighted composite
  narrative_quality: QualityDimension;
  scientific_quality: QualityDimension;
  safety_quality: QualityDimension;
  intervention_quality: QualityDimension;
  readability_score: QualityDimension;
  summary: string;
  validated_at: string;
}

// ─── Shame / shame-induction phrases ─────────────────────────────────────────

const SHAME_PATTERNS = [
  /\byou (are|were) (lazy|weak|broken|damaged|defective|hopeless|worthless|stupid|pathetic)\b/i,
  /\bnever going to (change|improve|get better)\b/i,
  /\bcharacter flaw\b/i,
  /\bwillpower failure\b/i,
  /\byou should (be ashamed|feel guilty)\b/i,
];

// Deterministic / diagnostic phrasing
const DETERMINISTIC_PATTERNS = [
  /\byou (have|suffer from|are diagnosed with|are suffering from)\s+(adhd|anxiety disorder|depression|ocd|bipolar|schizophrenia|autism|ptsd)\b/i,
  /\bdiagnosis\b/i,
  /\bclinically (depressed|anxious|disordered)\b/i,
  /\byou will (never|always|definitely)\b/i,
  /\b(impossible|irreversible|permanent)\s+(to change|damage|condition)\b/i,
];

// Fear amplification
const FEAR_PATTERNS = [
  /\byou are (at serious risk|in danger|headed for (disaster|breakdown|collapse))\b/i,
  /\bif you (don't|do not) (act|change|seek help) (now|immediately|urgently)\b/i,
  /\bextremely dangerous\b/i,
  /\bcrisis situation\b/i,
];

// ─── Jargon words (inflate cognitive load) ───────────────────────────────────

const JARGON_WORDS = [
  'psychopathology', 'neurobehavioural', 'metacognitive', 'somatosensory',
  'neuroplasticity', 'epigenetic', 'phenomenological', 'hermeneutic',
  'epistemological', 'psychophysiological',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function avgSentenceLength(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 3);
  if (sentences.length === 0) return 0;
  const words = sentences.map(s => countWords(s));
  return words.reduce((a, b) => a + b, 0) / words.length;
}

function repetitionRatio(texts: string[]): number {
  if (texts.length === 0) return 0;
  const words = texts.join(' ').toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  const repeated = Object.values(freq).filter(c => c > 2).length;
  return repeated / Object.keys(freq).length;
}

// ─── Dimension validators ─────────────────────────────────────────────────────

function validateNarrativeQuality(texts: string[]): QualityDimension {
  const issues: string[] = [];
  const combined = texts.join(' ');
  const wc = countWords(combined);

  let score = 100;

  if (wc < 80) {
    issues.push(`Report narrative is too brief (${wc} words — minimum 80 recommended).`);
    score -= 25;
  }
  if (wc > 2000) {
    issues.push('Report narrative may be too long — risk of cognitive overload.');
    score -= 10;
  }

  const rep = repetitionRatio(texts);
  if (rep > 0.35) {
    issues.push(`High word repetition detected (${Math.round(rep * 100)}% repeated words) — narrative may feel monotonous.`);
    score -= 20;
  }

  // Check for coherence markers — absence of transitional language
  const hasTransitions = /\b(however|therefore|because|as a result|this means|which means|importantly|specifically|in other words)\b/i.test(combined);
  if (!hasTransitions && wc > 150) {
    issues.push('Narrative lacks transitional language — may feel fragmented.');
    score -= 10;
  }

  // All sections present check
  if (texts.filter(t => t.trim().length > 20).length < 2) {
    issues.push('Fewer than 2 meaningful narrative sections detected.');
    score -= 15;
  }

  return { score: Math.max(0, score), issues };
}

function validateScientificQuality(
  score: number,
  scoreLevel: string,
  subdomainCount: number,
  calibrationReliability: number,
  calibrationPercentile: number,
): QualityDimension {
  const issues: string[] = [];
  let dim = 100;

  // Score/level consistency
  const expectedLevel =
    score >= 80 ? 'Advanced' :
    score >= 65 ? 'Proficient' :
    score >= 40 ? 'Developing' : 'Emerging';

  if (expectedLevel !== scoreLevel) {
    issues.push(`Score–level mismatch: score ${score} maps to "${expectedLevel}" but report uses "${scoreLevel}".`);
    dim -= 30;
  }

  // Insufficient data
  if (subdomainCount === 0) {
    issues.push('No subdomain data — report is based on overall score only.');
    dim -= 15;
  } else if (subdomainCount < 3) {
    issues.push(`Only ${subdomainCount} subdomain(s) assessed — low domain coverage.`);
    dim -= 10;
  }

  // Reliability
  if (calibrationReliability < 0.5) {
    issues.push(`Low response reliability (${Math.round(calibrationReliability * 100)}%) — inferences may be unreliable.`);
    dim -= 20;
  }

  // Percentile sanity
  if (calibrationPercentile < 1 || calibrationPercentile > 99) {
    issues.push(`Percentile value (${calibrationPercentile}) is out of expected range.`);
    dim -= 10;
  }

  return { score: Math.max(0, dim), issues };
}

function validateSafetyQuality(texts: string[]): QualityDimension {
  const combined = texts.join(' ');
  const issues: string[] = [];
  let dim = 100;

  for (const pattern of SHAME_PATTERNS) {
    if (pattern.test(combined)) {
      issues.push('Shame-inducing language detected.');
      dim -= 30;
      break;
    }
  }

  for (const pattern of DETERMINISTIC_PATTERNS) {
    if (pattern.test(combined)) {
      issues.push('Deterministic or diagnostic phrasing detected — avoid clinical diagnosis language.');
      dim -= 25;
      break;
    }
  }

  for (const pattern of FEAR_PATTERNS) {
    if (pattern.test(combined)) {
      issues.push('Fear-amplifying language detected.');
      dim -= 20;
      break;
    }
  }

  // Check for normalisation language (should be present)
  const hasNormalisation = /\b(common|normal|many people|not alone|understandable|makes sense|natural)\b/i.test(combined);
  if (!hasNormalisation) {
    issues.push('No normalisation language detected — consider adding reassurance framing.');
    dim -= 10;
  }

  return { score: Math.max(0, dim), issues };
}

function validateInterventionQuality(interventions: Array<{ action: string; type?: string; why?: string }>): QualityDimension {
  const issues: string[] = [];
  let dim = 100;

  if (interventions.length === 0) {
    issues.push('No interventions provided.');
    dim -= 40;
    return { score: 0, issues };
  }

  if (interventions.length > 8) {
    issues.push(`Too many interventions (${interventions.length}) — risk of recommendation fatigue.`);
    dim -= 15;
  }

  const tooVague = interventions.filter(i => countWords(i.action) < 5);
  if (tooVague.length > 0) {
    issues.push(`${tooVague.length} intervention(s) are too brief to be actionable (< 5 words).`);
    dim -= 10 * tooVague.length;
  }

  const withRationale = interventions.filter(i => i.why && i.why.trim().length > 10);
  if (withRationale.length < interventions.length * 0.5) {
    issues.push('Less than 50% of interventions include a rationale (why it works).');
    dim -= 15;
  }

  const types = new Set(interventions.map(i => i.type).filter(Boolean));
  if (types.size === 1) {
    issues.push('All interventions are the same type — consider diversifying across behavioural, cognitive, and environmental.');
    dim -= 10;
  }

  return { score: Math.max(0, dim), issues };
}

function validateReadability(texts: string[]): QualityDimension {
  const combined = texts.join(' ');
  const issues: string[] = [];
  let dim = 100;

  const avgSL = avgSentenceLength(combined);
  if (avgSL > 30) {
    issues.push(`Average sentence length is ${Math.round(avgSL)} words — may be hard to read (target: < 25).`);
    dim -= 20;
  }

  const jargonFound = JARGON_WORDS.filter(w => combined.toLowerCase().includes(w));
  if (jargonFound.length > 0) {
    issues.push(`High-complexity jargon detected: ${jargonFound.slice(0, 3).join(', ')}.`);
    dim -= 10 * Math.min(jargonFound.length, 4);
  }

  const wc = countWords(combined);
  const longSentences = combined.split(/[.!?]+/).filter(s => countWords(s) > 40).length;
  if (longSentences > 2) {
    issues.push(`${longSentences} sentences exceed 40 words — consider breaking them up.`);
    dim -= 15;
  }

  // Grade-level proxy: words > 12 chars (Flesch-Kincaid proxy)
  const allWords = combined.toLowerCase().split(/\s+/).filter(Boolean);
  const hardWords = allWords.filter(w => w.replace(/[^a-z]/g, '').length > 12).length;
  const hardRatio = allWords.length > 0 ? hardWords / allWords.length : 0;
  if (hardRatio > 0.12) {
    issues.push(`${Math.round(hardRatio * 100)}% of words are complex (>12 chars) — simplify for accessibility.`);
    dim -= 10;
  }

  // Ignore word count in readability for very short texts
  if (wc > 50 && avgSL < 8) {
    issues.push('Sentences are very short — narrative may feel choppy or abrupt.');
    dim -= 8;
  }

  return { score: Math.max(0, dim), issues };
}

// ─── Master validator ─────────────────────────────────────────────────────────

export interface ValidatorInput {
  narrative_texts: string[];
  score: number;
  score_level: string;
  subdomain_count: number;
  calibration_reliability: number;
  calibration_percentile: number;
  interventions: Array<{ action: string; type?: string; why?: string }>;
}

export function validateReportQuality(input: ValidatorInput): QualityValidationResult {
  const nq = validateNarrativeQuality(input.narrative_texts);
  const sq = validateScientificQuality(
    input.score,
    input.score_level,
    input.subdomain_count,
    input.calibration_reliability,
    input.calibration_percentile,
  );
  const sfq = validateSafetyQuality(input.narrative_texts);
  const iq  = validateInterventionQuality(input.interventions);
  const rq  = validateReadability(input.narrative_texts);

  // Weighted composite: safety and scientific quality are highest priority
  const overall = Math.round(
    sfq.score  * 0.30 +
    sq.score   * 0.25 +
    nq.score   * 0.20 +
    iq.score   * 0.15 +
    rq.score   * 0.10,
  );

  const gate: QualityGate =
    sfq.score < 60                            ? 'fail'   :  // safety failure always fails
    overall >= 75 && sfq.issues.length === 0  ? 'pass'   :
    overall >= 50                             ? 'review' :
    'fail';

  const allIssues = [
    ...sfq.issues,
    ...sq.issues,
    ...nq.issues,
    ...iq.issues,
    ...rq.issues,
  ];

  const summary =
    gate === 'pass'   ? `Report passed all quality checks (score: ${overall}/100).` :
    gate === 'review' ? `Report requires review — ${allIssues.length} issue(s) detected (score: ${overall}/100).` :
    `Report failed quality gate — ${allIssues.length} critical issue(s) detected (score: ${overall}/100).`;

  return {
    gate,
    overall_score: overall,
    narrative_quality: nq,
    scientific_quality: sq,
    safety_quality: sfq,
    intervention_quality: iq,
    readability_score: rq,
    summary,
    validated_at: new Date().toISOString(),
  };
}
