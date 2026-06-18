/**
 * Behavioural Coverage Engine — CAPADEX (2026-06-02).
 *
 * CAPADEX is a behavioural INVESTIGATION, not a questionnaire. A complete
 * investigation of any concern probes 10 behavioural dimensions:
 *
 *   root_cause          — where the concern originates / underlying driver
 *   trigger             — situations / contexts that set it off
 *   thought_pattern     — internal cognition, self-talk, beliefs
 *   emotional_state     — the felt emotional experience
 *   behavioral_response — what the person actually DOES in response
 *   avoidance           — avoidance / escape / procrastination mechanisms
 *   coping_strategy     — how the person manages / regulates / recovers
 *   impact              — consequences on life / work / relationships
 *   strength_asset      — existing strengths, resilience, positive capacity
 *   change_readiness    — willingness / motivation / goals to change
 *
 * This engine does two pure things:
 *   • classifyDimension(question)  — deterministically tag ONE clarity question
 *     to its primary dimension (+ ranked secondary matches), from question_type
 *     / stage / polarity / stem keywords. Returns dimension=null when nothing
 *     matches — an honest "uncovered" marker, NEVER a fabricated default.
 *   • buildConcernCoverage(pool)   — read-only: for every concern, which of the
 *     10 dimensions its available questions cover, and which are GAPS.
 *
 * Honesty contract: a question with no recognisable dimension is left
 * unclassified (null) so a genuinely-ambiguous item is distinguishable from a
 * confidently-tagged one. Coverage gaps are reported, never papered over.
 */
import type { Pool } from 'pg';

export const COVERAGE_DIMENSIONS = [
  'root_cause',
  'trigger',
  'thought_pattern',
  'emotional_state',
  'behavioral_response',
  'avoidance',
  'coping_strategy',
  'impact',
  'strength_asset',
  'change_readiness',
] as const;
export type CoverageDimension = (typeof COVERAGE_DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<CoverageDimension, string> = {
  root_cause: 'Root Cause',
  trigger: 'Trigger',
  thought_pattern: 'Internal Thought Pattern',
  emotional_state: 'Emotional State',
  behavioral_response: 'Behavioral Response',
  avoidance: 'Avoidance Mechanism',
  coping_strategy: 'Coping Strategy',
  impact: 'Impact',
  strength_asset: 'Strength Asset',
  change_readiness: 'Change Readiness',
};

export type CoverageMethod = 'question_type' | 'keyword' | 'polarity' | 'none';

export interface CoverageClassification {
  dimension: CoverageDimension | null;
  dimensions: CoverageDimension[]; // ranked, primary first; [] when none
  method: CoverageMethod;
  confidence: number | null; // 0..1; null when dimension is null
}

export interface CoverageQuestionInput {
  question?: string | null;
  question_type?: string | null;
  stage?: string | null;
  narrative_style?: string | null;
  polarity?: string | null;
}

// ───────────────────────── question_type → dimension ───────────────────────
// question_type is the authored taxonomy and the strongest single signal. These
// map the real values present in capadex_clarity_questions onto dimensions. The
// generic 'clarity' type is deliberately ABSENT — it carries no dimension on its
// own and is resolved by stem keywords / polarity instead.
const QUESTION_TYPE_MAP: Record<string, CoverageDimension> = {
  coping: 'coping_strategy',
  readiness: 'change_readiness',
  'future-oriented': 'change_readiness',
  severity: 'impact',
  integration: 'impact',
  behavior: 'behavioral_response',
  behavioral: 'behavioral_response',
  emotional: 'emotional_state',
  cognitive: 'thought_pattern',
  awareness: 'thought_pattern',
  'self-awareness': 'thought_pattern',
  'self-perception': 'thought_pattern',
  perception: 'thought_pattern',
  situational: 'trigger',
  'social-contextual': 'trigger',
  social: 'trigger',
  hopeful: 'strength_asset',
  hope: 'strength_asset',
};

// Confidence assigned when question_type cleanly resolves a dimension. High,
// because this is the authored classification — but below 1.0 so a keyword
// corroboration can still nudge ranking.
const QUESTION_TYPE_CONFIDENCE = 0.85;

// ─────────────────────────── stem keyword rules ────────────────────────────
// Each dimension carries phrase/token cues matched (whole-word) against the
// lowercased stem. Multi-word phrases score higher than single tokens. These
// resolve the ambiguous 'clarity' type AND surface SECONDARY dimensions a typed
// question also touches. Curated, not generated.
const DIMENSION_KEYWORDS: Record<CoverageDimension, string[]> = {
  root_cause: [
    'root cause', 'underlying', 'where does', 'where did', 'comes from', 'stems from',
    'because of', 'due to', 'origin', 'started when', 'began when', 'reason behind',
    'upbringing', 'childhood', 'growing up', 'deep down', 'core belief',
  ],
  trigger: [
    'trigger', 'triggers', 'set off', 'sets off', 'happens when', 'situation', 'situations',
    'in the moment', 'right before', 'leading up', 'when you', 'circumstance', 'context',
    'environment', 'around people', 'under pressure', 'deadline',
  ],
  thought_pattern: [
    'think', 'thoughts', 'thought', 'tell yourself', 'self-talk', 'inner voice', 'believe',
    'belief', 'assume', 'expect', 'imagine', 'interpret', 'ruminate', 'overthink',
    'in your mind', 'mentally', 'mindset', 'perceive',
  ],
  emotional_state: [
    'feel', 'feeling', 'feelings', 'emotion', 'emotional', 'anxious', 'anxiety', 'afraid',
    'fear', 'scared', 'nervous', 'worried', 'sad', 'angry', 'frustrated', 'overwhelmed',
    'stressed', 'mood', 'upset', 'guilt', 'shame', 'lonely',
  ],
  behavioral_response: [
    'do you do', 'react', 'reaction', 'respond', 'behave', 'behaviour', 'behavior',
    'take action', 'end up', 'tend to', 'what do you', 'how do you act', 'lash out',
    'speak up', 'shut down', 'freeze',
  ],
  avoidance: [
    'avoid', 'avoidance', 'avoiding', 'escape', 'procrastinate', 'procrastination',
    'put off', 'putting off', 'delay', 'withdraw', 'stay away', 'skip', 'distract yourself',
    'run away', 'back out', 'make excuses', 'steer clear',
  ],
  coping_strategy: [
    'cope', 'coping', 'manage', 'handle', 'deal with', 'strategy', 'strategies',
    'calm yourself', 'calm down', 'regulate', 'recover', 'soothe', 'relax', 'bounce back',
    'get through', 'work through', 'self-care',
  ],
  impact: [
    'impact', 'affect', 'affects', 'consequence', 'interfere', 'gets in the way',
    'holds you back', 'cost you', 'toll', 'result in', 'outcome', 'how much does',
    'performance suffer', 'relationships suffer', 'productivity', 'how often does it stop',
  ],
  strength_asset: [
    'strength', 'good at', 'confident', 'proud', 'enjoy', 'thrive', 'best at', 'succeed',
    'success', 'capable', 'resilient', 'resilience', 'able to', 'skilled', 'strong at',
    'come naturally', 'positive', 'what works',
  ],
  change_readiness: [
    'change', 'ready', 'willing', 'want to', 'motivated', 'motivation', 'goal', 'commit',
    'improve', 'work on', 'open to', 'plan to', 'intend', 'readiness', 'take the first step',
    'prepared to', 'how important is it to you',
  ],
};

// Pre-compiled whole-word matchers per keyword to avoid per-call regex churn.
const KEYWORD_MATCHERS: Array<{ dim: CoverageDimension; phrase: string; weight: number; re: RegExp }> = [];
for (const dim of COVERAGE_DIMENSIONS) {
  for (const phrase of DIMENSION_KEYWORDS[dim]) {
    const multi = phrase.includes(' ');
    const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    KEYWORD_MATCHERS.push({
      dim,
      phrase,
      weight: multi ? 2 : 1,
      re: new RegExp(`(?:^|[^a-z])${esc}(?:$|[^a-z])`, 'i'),
    });
  }
}

function normType(t?: string | null): string {
  return (t || '').toLowerCase().trim();
}

/**
 * Deterministically classify one clarity question to its primary behavioural
 * dimension (+ ranked secondaries). Resolution order:
 *   1. question_type taxonomy (authored, strongest) — sets the primary.
 *   2. stem keyword scoring — resolves ambiguous types AND adds secondaries.
 *   3. positive polarity → strength_asset, when nothing else matched.
 * Returns dimension=null / method='none' when no rule fires (honest uncovered).
 */
export function classifyDimension(q: CoverageQuestionInput): CoverageClassification {
  const stem = (q.question || '').toLowerCase();

  // Keyword scores (used both for ambiguous types and for secondary ranking).
  const kwScore = new Map<CoverageDimension, number>();
  for (const m of KEYWORD_MATCHERS) {
    if (m.re.test(stem)) kwScore.set(m.dim, (kwScore.get(m.dim) || 0) + m.weight);
  }
  const rankedKeywords = [...kwScore.entries()]
    .sort((a, b) => b[1] - a[1] || COVERAGE_DIMENSIONS.indexOf(a[0]) - COVERAGE_DIMENSIONS.indexOf(b[0]))
    .map(([d]) => d);

  const typeDim = QUESTION_TYPE_MAP[normType(q.question_type)] ?? null;

  // 1. Authored question_type wins the primary slot when present.
  if (typeDim) {
    const secondaries = rankedKeywords.filter((d) => d !== typeDim);
    // A corroborating keyword hit on the same dimension lifts confidence.
    const corroborated = kwScore.has(typeDim);
    return {
      dimension: typeDim,
      dimensions: [typeDim, ...secondaries],
      method: 'question_type',
      confidence: round4(Math.min(0.95, QUESTION_TYPE_CONFIDENCE + (corroborated ? 0.08 : 0))),
    };
  }

  // 2. No typed dimension (e.g. 'clarity') → strongest keyword wins.
  if (rankedKeywords.length > 0) {
    const top = rankedKeywords[0];
    const topScore = kwScore.get(top) || 0;
    // Confidence scales with cue strength but stays modest vs authored types.
    const confidence = round4(Math.min(0.8, 0.45 + 0.12 * topScore));
    return { dimension: top, dimensions: rankedKeywords, method: 'keyword', confidence };
  }

  // 3. Positive-polarity fallback: a positively-worded item with no other cue is
  //    most likely probing an existing strength/asset.
  if ((q.polarity || '').toLowerCase().trim() === 'positive') {
    return { dimension: 'strength_asset', dimensions: ['strength_asset'], method: 'polarity', confidence: 0.4 };
  }

  // 4. Honest uncovered.
  return { dimension: null, dimensions: [], method: 'none', confidence: null };
}

// ─────────────────────── concern coverage (read-only) ──────────────────────

export interface DimensionCoverage {
  dimension: CoverageDimension;
  label: string;
  question_count: number;   // questions tagged to this dimension for the concern
  covered: boolean;
}

export interface ConcernCoverage {
  concern_id: string;
  concern: string | null;
  master_bridge_tag: string | null;
  total_questions: number;
  classified_questions: number;       // tagged with any dimension
  unclassified_questions: number;     // honest: no dimension matched
  covered_count: number;              // of 10 dimensions
  coverage_ratio: number;             // covered_count / 10
  dimensions: DimensionCoverage[];    // all 10, covered flag each
  gaps: CoverageDimension[];          // dimensions with zero questions
}

export interface CoverageStats {
  generated_at: string;
  total_questions: number;
  classified_questions: number;
  unclassified_questions: number;
  total_concerns: number;
  fully_covered_concerns: number;      // all 10 dimensions present
  avg_coverage_ratio: number | null;
  dimension_distribution: Record<CoverageDimension, number>; // primary-dim question counts
  method_distribution: Record<CoverageMethod, number>;
}

export interface CoverageReport {
  generated_at: string;
  stats: CoverageStats;
  concerns: ConcernCoverage[];
}

interface ClarityCoverageRow {
  question_id: string;
  concern_id: string | null;
  concern: string | null;
  master_bridge_tag: string | null;
  question: string | null;
  question_type: string | null;
  stage: string | null;
  narrative_style: string | null;
  polarity: string | null;
}

const COVERAGE_CONCERN_CAP = 1000; // UI triage surface, not a full dump

/**
 * Read-only coverage analyser. Classifies every clarity question on the fly and
 * groups by concern to report which of the 10 dimensions are covered and which
 * are gaps. Pure SELECT over capadex_clarity_questions — no writes, no new
 * tables. Concerns missing a concern_id are grouped under their bridge tag so
 * coverage is still computable.
 */
export async function buildCoverageReport(pool: Pool): Promise<CoverageReport> {
  const generatedAt = new Date().toISOString();
  const { rows } = await pool.query<ClarityCoverageRow>(`
    SELECT question_id, concern_id, concern, master_bridge_tag,
           question, question_type, stage, narrative_style, polarity
      FROM capadex_clarity_questions
     WHERE question_id IS NOT NULL AND TRIM(question_id) <> ''
  `);

  const dimensionDistribution = emptyDimCounts();
  const methodDistribution: Record<CoverageMethod, number> = {
    question_type: 0, keyword: 0, polarity: 0, none: 0,
  };
  let classified = 0;

  // group key → concern bucket
  interface Bucket {
    concern_id: string;
    concern: string | null;
    master_bridge_tag: string | null;
    total: number;
    classifiedCount: number;
    perDim: Record<CoverageDimension, number>;
  }
  const buckets = new Map<string, Bucket>();

  for (const r of rows) {
    const cls = classifyDimension(r);
    methodDistribution[cls.method]++;
    if (cls.dimension) { classified++; dimensionDistribution[cls.dimension]++; }

    const key = (r.concern_id && r.concern_id.trim())
      || (r.master_bridge_tag && `tag:${r.master_bridge_tag}`)
      || '__ungrouped__';
    let b = buckets.get(key);
    if (!b) {
      b = {
        concern_id: (r.concern_id && r.concern_id.trim()) || key,
        concern: r.concern,
        master_bridge_tag: r.master_bridge_tag,
        total: 0,
        classifiedCount: 0,
        perDim: emptyDimCounts(),
      };
      buckets.set(key, b);
    }
    b.total++;
    if (cls.dimension) { b.classifiedCount++; b.perDim[cls.dimension]++; }
    if (!b.concern && r.concern) b.concern = r.concern;
  }

  const concerns: ConcernCoverage[] = [];
  let fullyCovered = 0;
  let ratioSum = 0;

  for (const b of buckets.values()) {
    const dims: DimensionCoverage[] = COVERAGE_DIMENSIONS.map((d) => ({
      dimension: d,
      label: DIMENSION_LABELS[d],
      question_count: b.perDim[d],
      covered: b.perDim[d] > 0,
    }));
    const coveredCount = dims.filter((d) => d.covered).length;
    const gaps = dims.filter((d) => !d.covered).map((d) => d.dimension);
    const ratio = round4(coveredCount / COVERAGE_DIMENSIONS.length);
    if (coveredCount === COVERAGE_DIMENSIONS.length) fullyCovered++;
    ratioSum += ratio;
    concerns.push({
      concern_id: b.concern_id,
      concern: b.concern,
      master_bridge_tag: b.master_bridge_tag,
      total_questions: b.total,
      classified_questions: b.classifiedCount,
      unclassified_questions: b.total - b.classifiedCount,
      covered_count: coveredCount,
      coverage_ratio: ratio,
      dimensions: dims,
      gaps,
    });
  }

  // Worst-covered first — the triage order a curator wants.
  concerns.sort((a, b) =>
    a.coverage_ratio - b.coverage_ratio || b.total_questions - a.total_questions);

  const stats: CoverageStats = {
    generated_at: generatedAt,
    total_questions: rows.length,
    classified_questions: classified,
    unclassified_questions: rows.length - classified,
    total_concerns: buckets.size,
    fully_covered_concerns: fullyCovered,
    avg_coverage_ratio: buckets.size ? round4(ratioSum / buckets.size) : null,
    dimension_distribution: dimensionDistribution,
    method_distribution: methodDistribution,
  };

  return {
    generated_at: generatedAt,
    stats,
    concerns: concerns.slice(0, COVERAGE_CONCERN_CAP),
  };
}

// ───────────────────────────── util ────────────────────────────────────────

function emptyDimCounts(): Record<CoverageDimension, number> {
  const o = {} as Record<CoverageDimension, number>;
  for (const d of COVERAGE_DIMENSIONS) o[d] = 0;
  return o;
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
