/**
 * CAPADEX Problem Intelligence Layer (PIL) — Phase 1: Concern Classification.
 *
 * Pure, deterministic, rule-based classifier that assigns every concern in
 * `capadex_concerns_master` to ONE primary category:
 *
 *   Capability · Problem · Behavior · Trait · Outcome · Risk
 *
 * EXTENSION-ONLY: this engine reads the existing concern master and writes ONLY
 * to the new `concern_classification` table. It never mutates existing CAPADEX
 * data (concerns, bridge tags, clarity questions, signals, scoring, reports).
 *
 * Why rule-based (no external AI): the rest of the platform classifies
 * deterministically from curated vocabulary so behaviour is reproducible and
 * auditable. The dominant signal is the LAST word of `concern_category` (the
 * diagnostic taxonomy label), e.g. "… Anxiety" → Problem, "… Fragility" → Risk,
 * "… Dependency" → Trait, "… Avoidance" → Behavior, "… Burnout" → Outcome,
 * "… Management" → Capability. Secondary tokens and the user-facing
 * `display_label` / `concern_cluster` only break ties or rescue rows whose
 * category suffix is unknown. Each classification carries a confidence score
 * (0..1) and a human-readable reasoning string.
 *
 * Honesty over balance: the concern master is overwhelmingly problem-framed, so
 * Problem/Behavior/Trait/Outcome/Risk dominate and Capability is deliberately
 * rare — that is the true shape of the data, not a bug to "balance".
 */

export type Classification =
  | 'Capability'
  | 'Problem'
  | 'Behavior'
  | 'Trait'
  | 'Outcome'
  | 'Risk';

export const CLASSIFICATIONS: Classification[] = [
  'Capability',
  'Problem',
  'Behavior',
  'Trait',
  'Outcome',
  'Risk',
];

export interface ConcernRow {
  concern_id: string;
  display_label?: string | null;
  concern_cluster?: string | null;
  concern_category?: string | null;
  domain?: string | null;
  root_cause_group?: string | null;
}

export interface ClassificationResult {
  concern_id: string;
  concern_name: string;
  classification: Classification;
  confidence_score: number; // 0..1, rounded to 4 dp
  reasoning: string;
}

// ── Vocabulary → category map ────────────────────────────────────────────────
// A single shared dictionary keyed on the (lowercased) head noun of a concern
// label. Used for (a) the dominant last-word match on `concern_category` and
// (b) lower-weight scans of other tokens / the display label. Curated, not
// generated — quality over coverage.
const VOCAB: Record<string, Classification> = {
  // ── Problem: an experienced difficulty / deficit / distress ──────────────
  weakness: 'Problem', weaknesses: 'Problem', anxiety: 'Problem', anxieties: 'Problem',
  deficit: 'Problem', deficits: 'Problem', deficiency: 'Problem', blindness: 'Problem',
  gap: 'Problem', gaps: 'Problem', difficulty: 'Problem', difficulties: 'Problem',
  stress: 'Problem', ambiguity: 'Problem', confusion: 'Problem', 'self-doubt': 'Problem',
  frustration: 'Problem', pressure: 'Problem', dysregulation: 'Problem',
  mismanagement: 'Problem', misalignment: 'Problem', misjudgment: 'Problem',
  disconnect: 'Problem', inconsistency: 'Problem', instability: 'Problem',
  imbalance: 'Problem', conflict: 'Problem', overload: 'Problem', paralysis: 'Problem',
  insecurity: 'Problem', immaturity: 'Problem', helplessness: 'Problem',
  overwhelm: 'Problem', dissonance: 'Problem', doubt: 'Problem', fear: 'Problem',
  fears: 'Problem', block: 'Problem', blockage: 'Problem', struggle: 'Problem',
  illiteracy: 'Problem', unawareness: 'Problem', intolerance: 'Problem',
  friction: 'Problem', strain: 'Problem', distress: 'Problem', worry: 'Problem',
  nervousness: 'Problem', panic: 'Problem', dread: 'Problem', apprehension: 'Problem',
  mistrust: 'Problem', spot: 'Problem', // "blind spot"

  // ── Outcome: a result / consequence / end-state ──────────────────────────
  burnout: 'Outcome', fatigue: 'Outcome', decline: 'Outcome', collapse: 'Outcome',
  breakdown: 'Outcome', loss: 'Outcome', spillover: 'Outcome', trauma: 'Outcome',
  failure: 'Outcome', deterioration: 'Outcome', stagnation: 'Outcome', drop: 'Outcome',
  exhaustion: 'Outcome', plateau: 'Outcome', dropout: 'Outcome', attrition: 'Outcome',
  regression: 'Outcome',

  // ── Risk: susceptibility / potential future harm ─────────────────────────
  risk: 'Risk', risks: 'Risk', vulnerability: 'Risk', fragility: 'Risk',
  relapse: 'Risk', threat: 'Risk', susceptibility: 'Risk',

  // ── Behavior: an observable action pattern ───────────────────────────────
  avoidance: 'Behavior', reactivity: 'Behavior', resistance: 'Behavior',
  withdrawal: 'Behavior', hesitation: 'Behavior', suppression: 'Behavior',
  procrastination: 'Behavior', distraction: 'Behavior', fragmentation: 'Behavior',
  scrolling: 'Behavior', overthinking: 'Behavior', rumination: 'Behavior',
  defensiveness: 'Behavior', aggression: 'Behavior', disengagement: 'Behavior',
  overcommitment: 'Behavior', comparison: 'Behavior',

  // ── Trait: a stable disposition / characteristic ─────────────────────────
  dependency: 'Trait', dependence: 'Trait', sensitivity: 'Trait', rigidity: 'Trait',
  perfectionism: 'Trait', impulsivity: 'Trait', introversion: 'Trait',
  neuroticism: 'Trait', stubbornness: 'Trait', timidity: 'Trait', shyness: 'Trait',

  // ── Capability: a skill / ability / capacity (positively framed) ─────────
  management: 'Capability', thinking: 'Capability', skill: 'Capability',
  skills: 'Capability', awareness: 'Capability', clarity: 'Capability',
  readiness: 'Capability', literacy: 'Capability', competence: 'Capability',
  competency: 'Capability', mastery: 'Capability', intelligence: 'Capability',
  mindset: 'Capability', communication: 'Capability', leadership: 'Capability',
  ownership: 'Capability', discipline: 'Capability', persistence: 'Capability',
  curiosity: 'Capability', adaptability: 'Capability', confidence: 'Capability',
  expression: 'Capability', stability: 'Capability', regulation: 'Capability',
  autonomy: 'Capability', efficacy: 'Capability', fluency: 'Capability',
  proficiency: 'Capability', effectiveness: 'Capability', capability: 'Capability',
  understanding: 'Capability', reasoning: 'Capability', planning: 'Capability',
  organization: 'Capability', organisation: 'Capability', resilience: 'Capability',
  flexibility: 'Capability', collaboration: 'Capability', creativity: 'Capability',
};

// Deterministic tie-break order for argmax: equal scores resolve to Problem
// first (the concern master is problem-oriented), Capability last.
const TIE_ORDER: Classification[] = ['Problem', 'Outcome', 'Risk', 'Behavior', 'Trait', 'Capability'];

// Weights for the additive scoring across signal sources.
const W_CATEGORY_HEAD = 10; // last word of concern_category — the dominant signal
const W_CATEGORY_TOKEN = 3; // any other token of concern_category
const W_LABEL_TOKEN = 1; // token of display_label / concern_cluster (tie-break only)

function normToken(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z-]/g, '').trim();
}

function tokensOf(s?: string | null): string[] {
  if (!s) return [];
  return String(s)
    .split(/\s+/)
    .map(normToken)
    .filter((t) => t.length >= 2);
}

function emptyScores(): Record<Classification, number> {
  return { Capability: 0, Problem: 0, Behavior: 0, Trait: 0, Outcome: 0, Risk: 0 };
}

/**
 * Pure classifier. Deterministic for a given row. Never throws.
 */
export function classifyConcern(row: ConcernRow): ClassificationResult {
  const concern_name =
    (row.display_label && row.display_label.trim()) ||
    (row.concern_cluster && row.concern_cluster.trim()) ||
    (row.concern_category && row.concern_category.trim()) ||
    row.concern_id;

  const scores = emptyScores();
  const signals: string[] = [];

  const catTokens = tokensOf(row.concern_category);
  let headHitCat: Classification | null = null;

  // 1. Dominant signal: the head (last) word of concern_category.
  if (catTokens.length > 0) {
    const head = catTokens[catTokens.length - 1];
    const cat = VOCAB[head];
    if (cat) {
      scores[cat] += W_CATEGORY_HEAD;
      headHitCat = cat;
      signals.push(`concern_category ends in "${head}" → ${cat}`);
    }
  }

  // 2. Remaining concern_category tokens (qualifiers).
  const headIdx = catTokens.length - 1;
  catTokens.forEach((t, i) => {
    if (i === headIdx) return;
    const cat = VOCAB[t];
    if (cat) {
      scores[cat] += W_CATEGORY_TOKEN;
      signals.push(`category token "${t}" → ${cat}`);
    }
  });

  // 3. display_label + concern_cluster tokens (low weight, tie-break / rescue).
  const labelTokens = [...tokensOf(row.display_label), ...tokensOf(row.concern_cluster)];
  const labelSeen = new Set<string>();
  for (const t of labelTokens) {
    if (labelSeen.has(t)) continue;
    labelSeen.add(t);
    const cat = VOCAB[t];
    if (cat) {
      scores[cat] += W_LABEL_TOKEN;
      signals.push(`label cue "${t}" → ${cat}`);
    }
  }

  // 4. Pick the winner. Deterministic tie-break PREFERS Problem (the master is
  //    problem-oriented), then the remaining categories in canonical order —
  //    never let an ambiguous tie default to Capability.
  let topCat: Classification = 'Problem';
  let topScore = -1;
  let secondScore = 0;
  for (const c of TIE_ORDER) {
    if (scores[c] > topScore) {
      secondScore = topScore < 0 ? 0 : topScore;
      topScore = scores[c];
      topCat = c;
    } else if (scores[c] > secondScore) {
      secondScore = scores[c];
    }
  }

  // 5. No signal at all → default to Problem (the master is problem-oriented).
  if (topScore <= 0) {
    return {
      concern_id: row.concern_id,
      concern_name,
      classification: 'Problem',
      confidence_score: 0.4,
      reasoning:
        'No explicit category signal in concern_category or label; defaulted to Problem (the CAPADEX concern master is problem-oriented).',
    };
  }

  // 6. Confidence: anchored on signal strength, reduced for close calls.
  let base: number;
  if (headHitCat === topCat) base = 0.92;
  else if (topScore >= W_CATEGORY_TOKEN) base = 0.7;
  else base = 0.55;

  const margin = topScore > 0 ? (topScore - secondScore) / topScore : 1;
  if (margin < 0.25) base -= 0.12;

  const confidence = Math.max(0.3, Math.min(0.97, Math.round(base * 10000) / 10000));

  return {
    concern_id: row.concern_id,
    concern_name,
    classification: topCat,
    confidence_score: confidence,
    reasoning: signals.join('; '),
  };
}

/** Count classifications across a result set, in canonical category order. */
export function summarize(results: ClassificationResult[]): Record<Classification, number> {
  const counts = emptyScores();
  for (const r of results) counts[r.classification] += 1;
  return counts;
}
