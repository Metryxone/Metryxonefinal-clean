/**
 * CAPADEX Problem Intelligence Layer (PIL) — Phase 2: Archetype Intelligence Engine
 * (pure, deterministic, rule-based — NO external AI).
 *
 * Discovers the SMALLEST MEANINGFUL SET of stable human-development archetypes that
 * explain the whole CAPADEX ecosystem. An archetype is a developmental construct that
 * binds a cluster of related Capabilities + Problem-states + observable Behaviors.
 *
 * EXTENSION-ONLY: reads ONLY the Phase-1.5/1.6 extension tables and writes ONLY the
 * new Phase-2 tables. Never mutates existing CAPADEX/Phase-1/1.5/1.6 data.
 *
 * METHOD (hybrid, deterministic): a CURATED library of archetype anchors — each with a
 * construct-token signature AND an expected primary behavior category — is matched
 * against a RELATIONSHIP-GROUNDED match text per concern (concern name + its
 * capability/problem framing + its observable behavior categories). Assignment is NOT
 * "raw concern names alone": behavior-category alignment is a required, scored signal
 * wherever behaviors exist. A concern with no token anchor in any archetype is FLAGGED
 * as unmatched (never force-fit). Pure bottom-up clustering is deliberately avoided —
 * Phase 1.5 showed it collapses into one giant "Emotional" supercluster.
 *
 * HONESTY MODEL: low coverage / weak coherence are real findings surfaced by the
 * validation layer and the unmatched-review table, never tuned away.
 */

// ── Behavior categories (must mirror Phase 1.6) ──────────────────────────────
export type BehaviorCategory =
  | 'Academic' | 'Career' | 'Social' | 'Emotional'
  | 'Cognitive' | 'Leadership' | 'Self-Management' | 'Learning';
export const BEHAVIOR_CATEGORIES: BehaviorCategory[] = [
  'Academic', 'Career', 'Social', 'Emotional',
  'Cognitive', 'Leadership', 'Self-Management', 'Learning',
];

// ── Archetype anchor library ─────────────────────────────────────────────────
// Each archetype is a developmental construct. `tokens` are the construct tokens that
// anchor a concern to the archetype; `primaryCategory` is the behavior category we
// expect its members to express most — used as a required alignment signal so the
// archetype emerges from Capability+Problem+Behavior relationships, not names alone.
export interface ArchetypeAnchor {
  key: string;
  name: string;
  definition: string;
  primaryCategory: BehaviorCategory;
  tokens: string[];
  stageNote: string;
}

export const ARCHETYPES: ArchetypeAnchor[] = [
  // ── Emotional core ─────────────────────────────────────────────────────────
  {
    key: 'performance_anxiety',
    name: 'Performance Anxiety & Pressure Response',
    definition: 'Heightened anxiety, fear and physiological stress when performance is evaluated or stakes are high.',
    primaryCategory: 'Emotional',
    tokens: ['anxiety', 'anxious', 'nervous', 'nervousness', 'fear', 'afraid', 'panic', 'pressure', 'stress', 'stressed', 'tension', 'phobia', 'jitters', 'overthinking', 'worry', 'worried', 'dread'],
    stageNote: 'Manifests around evaluation events (tests/exams/interviews/reviews).',
  },
  {
    key: 'confidence_self_efficacy',
    name: 'Confidence & Self-Efficacy',
    definition: 'Belief in one\u2019s own ability to act, decide and succeed; self-worth and self-assurance.',
    primaryCategory: 'Emotional',
    tokens: ['confidence', 'confident', 'self-confidence', 'self-belief', 'self-esteem', 'esteem', 'self-worth', 'self-doubt', 'doubt', 'insecurity', 'insecure', 'assurance', 'efficacy', 'belief'],
    stageNote: 'Often defined relative to a setback ("confidence after failure").',
  },
  {
    key: 'resilience_recovery',
    name: 'Resilience & Failure Recovery',
    definition: 'Capacity to absorb setbacks, recover from failure and persist through adversity.',
    primaryCategory: 'Emotional',
    tokens: ['resilience', 'resilient', 'failure', 'failures', 'setback', 'setbacks', 'recovery', 'recover', 'bounce', 'rejection', 'rejected', 'perseverance', 'persistence', 'persist', 'grit', 'adversity', 'giving-up'],
    stageNote: 'Triggered by repeated failure, rejection or loss.',
  },
  {
    key: 'emotional_regulation',
    name: 'Emotional Regulation & Coping',
    definition: 'Managing mood, frustration, overwhelm and emotional reactivity under load.',
    primaryCategory: 'Emotional',
    tokens: ['emotional', 'emotion', 'emotions', 'regulation', 'mood', 'frustration', 'frustrated', 'anger', 'angry', 'overwhelm', 'overwhelmed', 'coping', 'cope', 'irritability', 'reactivity', 'meltdown', 'burnout', 'exhaustion'],
    stageNote: 'Cuts across stress events; the regulation skill itself, not the trigger.',
  },
  {
    key: 'identity_self_awareness',
    name: 'Identity & Self-Awareness',
    definition: 'Clarity of values, purpose, direction and an accurate sense of self.',
    primaryCategory: 'Emotional',
    tokens: ['identity', 'self-awareness', 'awareness', 'values', 'purpose', 'direction', 'meaning', 'authenticity', 'self-image', 'self-perception', 'self-concept', 'belonging-self'],
    stageNote: 'Sharpens at transitions (school\u2192career, role changes).',
  },
  {
    key: 'expectations_pressure',
    name: 'Expectations & External Pressure',
    definition: 'Strain from comparison, validation-seeking and expectations imposed by family, peers or society.',
    primaryCategory: 'Emotional',
    tokens: ['expectations', 'expectation', 'comparison', 'compared', 'validation', 'approval', 'judgment', 'judgement', 'parental', 'family-pressure', 'societal', 'peer-pressure', 'reputation', 'image', 'standards'],
    stageNote: 'External locus; distinct from internally-generated anxiety.',
  },

  // ── Self-Management core ─────────────────────────────────────────────────────
  {
    key: 'time_self_discipline',
    name: 'Time Management & Self-Discipline',
    definition: 'Planning, prioritising, meeting deadlines and sustaining disciplined routines.',
    primaryCategory: 'Self-Management',
    tokens: ['time', 'deadline', 'deadlines', 'procrastination', 'procrastinate', 'discipline', 'self-discipline', 'planning', 'plan', 'scheduling', 'schedule', 'prioritization', 'priorities', 'organization', 'organisation', 'punctuality', 'consistency', 'accountability'],
    stageNote: 'Observable as missed deadlines / last-minute work.',
  },
  {
    key: 'motivation_drive',
    name: 'Motivation & Drive',
    definition: 'Energy, initiative and sustained engagement toward goals and routine demands.',
    primaryCategory: 'Self-Management',
    tokens: ['motivation', 'motivated', 'drive', 'initiative', 'engagement', 'engaged', 'interest', 'enthusiasm', 'energy', 'proactive', 'ambition', 'goal', 'goals', 'effort', 'commitment', 'ownership'],
    stageNote: 'Low drive shows as disengagement on routine tasks.',
  },
  {
    key: 'focus_attention',
    name: 'Focus & Attention Regulation',
    definition: 'Sustaining concentration and resisting distraction during deep work.',
    primaryCategory: 'Self-Management',
    tokens: ['focus', 'attention', 'concentration', 'distraction', 'distracted', 'distractibility', 'mindfulness', 'absorption', 'multitasking', 'scattered'],
    stageNote: 'Manifests as task-switching / phone-checking.',
  },
  {
    key: 'adaptability_change',
    name: 'Adaptability & Change Navigation',
    definition: 'Flexibility, comfort with ambiguity and effective navigation of change and transitions.',
    primaryCategory: 'Self-Management',
    tokens: ['adaptability', 'adaptable', 'adapt', 'flexibility', 'flexible', 'change', 'transition', 'uncertainty', 'uncertain', 'ambiguity', 'ambiguous', 'unpredictable', 'novelty', 'agility'],
    stageNote: 'Tested by new environments, roles or rules.',
  },

  // ── Cognitive core ───────────────────────────────────────────────────────────
  {
    key: 'critical_reflective_thinking',
    name: 'Critical & Reflective Thinking',
    definition: 'Reasoning, analysis, reflection and metacognition about one\u2019s own thinking.',
    primaryCategory: 'Cognitive',
    tokens: ['thinking', 'reasoning', 'analysis', 'analytical', 'reflection', 'reflective', 'critical', 'metacognition', 'logic', 'logical', 'evaluation', 'interpretation', 'synthesis', 'insight', 'questioning', 'problem-solving', 'solving', 'self-reflection', 'self-evaluation', 'self-assessment'],
    stageNote: 'Higher-order cognition; distinct from rote learning.',
  },
  {
    key: 'decision_judgment',
    name: 'Decision-Making & Judgment',
    definition: 'Making timely, sound choices and exercising judgment under constraints.',
    primaryCategory: 'Cognitive',
    tokens: ['decision', 'decisions', 'decision-making', 'choice', 'choices', 'judgment', 'judgement', 'indecision', 'indecisive', 'prioritisation', 'tradeoff', 'trade-off', 'discernment', 'deciding'],
    stageNote: 'Observable as hesitation / second-guessing choices.',
  },
  {
    key: 'curiosity_innovation',
    name: 'Curiosity & Innovation',
    definition: 'Exploration, creativity, experimentation and the generation of new ideas.',
    primaryCategory: 'Cognitive',
    tokens: ['curiosity', 'curious', 'creativity', 'creative', 'innovation', 'innovative', 'exploration', 'experimentation', 'experiment', 'imagination', 'ideation', 'inventive', 'originality', 'inquiry'],
    stageNote: 'Generative cognition; distinct from evaluative thinking.',
  },

  // ── Learning core ────────────────────────────────────────────────────────────
  {
    key: 'learning_comprehension',
    name: 'Learning & Comprehension',
    definition: 'Acquiring, understanding, retaining and integrating knowledge and concepts.',
    primaryCategory: 'Learning',
    tokens: ['learning', 'learn', 'comprehension', 'understanding', 'understand', 'conceptual', 'concept', 'concepts', 'retention', 'memory', 'memorization', 'study', 'studying', 'note-taking', 'notes', 'note-making', 'self-learning', 'self-study', 'revision', 'reading', 'vocabulary', 'integration', 'grasp'],
    stageNote: 'Knowledge acquisition; the study/comprehension loop.',
  },

  // ── Academic core ────────────────────────────────────────────────────────────
  {
    key: 'academic_achievement',
    name: 'Academic Achievement & Exam Performance',
    definition: 'Performance on academic tasks, exams, grades and subject mastery.',
    primaryCategory: 'Academic',
    tokens: ['academic', 'academics', 'exam', 'exams', 'examination', 'grade', 'grades', 'marks', 'score', 'scores', 'subject', 'subjects', 'syllabus', 'curriculum', 'classroom', 'homework', 'assignment', 'assignments', 'coursework', 'gpa', 'results'],
    stageNote: 'Outcome-side of schooling; distinct from the learning process.',
  },

  // ── Career core ──────────────────────────────────────────────────────────────
  {
    key: 'career_professional_growth',
    name: 'Career Growth & Professional Identity',
    definition: 'Professional advancement, role clarity, workplace performance and career direction.',
    primaryCategory: 'Career',
    tokens: ['career', 'professional', 'profession', 'job', 'work', 'workplace', 'promotion', 'advancement', 'role', 'growth', 'performance-review', 'corporate', 'industry', 'employability', 'executive', 'productivity', 'workload'],
    stageNote: 'Workplace context; the professional growth arc.',
  },
  {
    key: 'networking_relationships',
    name: 'Networking & Relationship Building',
    definition: 'Building, maintaining and leveraging professional relationships and mentorship.',
    primaryCategory: 'Career',
    tokens: ['network', 'networking', 'networks', 'mentorship', 'mentor', 'mentoring', 'connections', 'relationship-building', 'rapport', 'stakeholder', 'alliances', 'sponsorship', 'contacts'],
    stageNote: 'Relational capital; distinct from internal social belonging.',
  },

  // ── Leadership core ──────────────────────────────────────────────────────────
  {
    key: 'leadership_influence',
    name: 'Leadership & Influence',
    definition: 'Directing, influencing, delegating and inspiring others toward shared goals.',
    primaryCategory: 'Leadership',
    tokens: ['leadership', 'leader', 'leading', 'influence', 'influencing', 'delegation', 'delegate', 'authority', 'vision', 'strategic', 'strategy', 'management', 'managing', 'executive-presence', 'empowerment', 'accountability-others', 'direction-others'],
    stageNote: 'Influence over others; distinct from self-management.',
  },
  {
    key: 'negotiation_advocacy',
    name: 'Negotiation & Advocacy',
    definition: 'Asserting needs, negotiating, advocating for oneself and handling conflict.',
    primaryCategory: 'Leadership',
    tokens: ['negotiation', 'negotiate', 'salary', 'advocacy', 'advocate', 'assertiveness', 'assertive', 'conflict', 'persuasion', 'persuade', 'boundaries', 'standing-up', 'bargaining', 'dispute'],
    stageNote: 'Assertive influence in adversarial contexts.',
  },

  // ── Social core ──────────────────────────────────────────────────────────────
  {
    key: 'communication_expression',
    name: 'Communication & Expression',
    definition: 'Articulating ideas clearly through speaking, writing and presentation.',
    primaryCategory: 'Social',
    tokens: ['communication', 'communicate', 'articulation', 'articulate', 'expression', 'expressing', 'presentation', 'presenting', 'speaking', 'public-speaking', 'writing', 'verbal', 'clarity-expression', 'listening', 'feedback-giving'],
    stageNote: 'Outward expression; observable in presentations/discussions.',
  },
  {
    key: 'social_connection_belonging',
    name: 'Social Connection & Belonging',
    definition: 'Forming friendships, fitting in, and the experience of belonging or isolation.',
    primaryCategory: 'Social',
    tokens: ['social', 'peer', 'peers', 'friendship', 'friends', 'belonging', 'isolation', 'isolated', 'loneliness', 'lonely', 'inclusion', 'acceptance', 'shyness', 'shy', 'withdrawn', 'relationships', 'fitting-in'],
    stageNote: 'Inward relational need; distinct from professional networking.',
  },
  {
    key: 'collaboration_teamwork',
    name: 'Collaboration & Teamwork',
    definition: 'Working effectively within groups: cooperation, participation and shared ownership.',
    primaryCategory: 'Social',
    tokens: ['collaboration', 'collaborate', 'teamwork', 'team', 'cooperation', 'cooperative', 'group', 'groups', 'participation', 'participate', 'contribution', 'coordination', 'collective', 'partnership'],
    stageNote: 'Group task context; distinct from one-to-one connection.',
  },
];

// Static guard: keep the discovered set small and meaningful.
export const ARCHETYPE_COUNT = ARCHETYPES.length;

// ── Tokenisation ─────────────────────────────────────────────────────────────
const STOPWORDS = new Set([
  'a', 'an', 'and', 'the', 'of', 'to', 'in', 'on', 'for', 'with', 'at', 'by', 'from',
  'about', 'as', 'into', 'or', 'but', 'is', 'are', 'be', 'being', 'been', 'when', 'while',
  'during', 'after', 'before', 'over', 'under', 'their', 'them', 'they', 'this', 'that',
  'these', 'those', 'it', 'its', 'his', 'her', 'your', 'you', 'our', 'who', 'which',
  'how', 'what', 'not', 'no', 'do', 'does', 'having', 'have', 'has',
  // PIL scaffolding tokens that falsely bridge unrelated constructs (per Phase 1.5)
  'difficulty', 'difficulties', 'weak', 'weakness', 'poor', 'lack', 'lacking', 'ability',
  'abilities', 'skill', 'skills', 'issue', 'issues', 'problem', 'problems', 'managing',
  'handling', 'dealing', 'struggle', 'struggling', 'struggles', 'improving', 'improve',
  'building', 'build', 'develop', 'developing', 'support', 'supporting', 'better',
  'students', 'student', 'people', 'someone', 'self',
]);

export function normToks(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// ── Per-concern relationship context ─────────────────────────────────────────
// Built by the runner from the extension tables, then handed to the pure assigner.
export interface ConcernContext {
  concernId: string;
  concernName: string;
  canonicalType: string;
  // Capability/problem framing for this concern (from capability_problem_map).
  capabilityName?: string;
  problemName?: string;
  mappingReason?: string;
  // True when this concern has a direct row in capability_problem_map (i.e. it carries
  // first-hand Capability+Problem framing, not just a name).
  hasDirectCapabilityProblem?: boolean;
  // Observable-behavior categories this concern DIRECTLY expresses (from the behavior
  // map), with counts. Empty when the concern has no first-hand behavioral grounding.
  behaviorCounts: Partial<Record<BehaviorCategory, number>>;
  // Behavior categories INHERITED from relationship neighbours (construct_similarity_map
  // + concern_families co-members that are themselves directly grounded). Lets a concern
  // with no first-hand behaviors still be grounded in the relationship graph rather than
  // its name alone. Empty when no grounded neighbour exists.
  propagatedBehaviorCounts?: Partial<Record<BehaviorCategory, number>>;
}

// How a concern's assignment was grounded — surfaced for honesty/auditing.
//   direct_cpb : has first-hand Capability/Problem framing or direct behaviors
//   propagated : grounded via relationship-graph neighbours' behaviors
//   name_only  : no relationship signal available — matched on concern text alone
export type GroundingSource = 'direct_cpb' | 'propagated' | 'name_only';

// The match text deliberately fuses Capability + Problem + Behavior framing so that
// assignment can never be "raw concern names alone".
export function buildMatchTokens(ctx: ConcernContext): string[] {
  const parts = [ctx.concernName, ctx.capabilityName, ctx.problemName, ctx.mappingReason]
    .filter(Boolean)
    .join(' ');
  return normToks(parts);
}

function dominantOf(counts?: Partial<Record<BehaviorCategory, number>>): BehaviorCategory | null {
  if (!counts) return null;
  let best: BehaviorCategory | null = null;
  let bestN = 0;
  for (const cat of BEHAVIOR_CATEGORIES) {
    const n = counts[cat] ?? 0;
    if (n > bestN) { bestN = n; best = cat; }
  }
  return bestN > 0 ? best : null;
}

// Direct first-hand dominant behavior category (null when ungrounded).
export function dominantBehaviorCategory(ctx: ConcernContext): BehaviorCategory | null {
  return dominantOf(ctx.behaviorCounts);
}

// Effective dominant + how it was grounded: direct behaviors win over propagated ones;
// propagated behaviors win over nothing. Lets a concern with no first-hand behaviors
// still earn a behavior-alignment signal from its relationship neighbours.
export function effectiveBehavior(ctx: ConcernContext): { dominant: BehaviorCategory | null; grounding: GroundingSource } {
  const direct = dominantOf(ctx.behaviorCounts);
  if (direct != null || ctx.hasDirectCapabilityProblem) {
    return { dominant: direct, grounding: 'direct_cpb' };
  }
  const prop = dominantOf(ctx.propagatedBehaviorCounts);
  if (prop != null) return { dominant: prop, grounding: 'propagated' };
  return { dominant: null, grounding: 'name_only' };
}

// ── Scoring & assignment ─────────────────────────────────────────────────────
export interface ArchetypeScore {
  key: string;
  tokenMatches: number;
  tokenScore: number;     // token overlap, normalised 0..1
  behaviorAligned: boolean;
  score: number;          // combined 0..1
}

const TOKEN_WEIGHT = 0.7;
const BEHAVIOR_WEIGHT = 0.3;
// A concern with no token anchor at all is never force-fit.
export const ASSIGN_MIN_TOKEN_MATCHES = 1;
export const ASSIGN_MIN_SCORE = 0.18;

export function scoreArchetype(
  matchTokens: string[],
  dominant: BehaviorCategory | null,
  arch: ArchetypeAnchor,
): ArchetypeScore {
  const tokenSet = new Set(matchTokens);
  let matches = 0;
  for (const t of arch.tokens) if (tokenSet.has(t)) matches++;
  // Normalise by a soft cap so a 1-token anchor still scores meaningfully but more
  // matches still win. (matches / (matches + k)) is monotonic and bounded.
  const tokenScore = matches === 0 ? 0 : matches / (matches + 1.5);
  const behaviorAligned = dominant != null && dominant === arch.primaryCategory;
  // The behavior-alignment bonus is an AMPLIFIER on a token anchor, never a standalone
  // score: with zero token matches it must contribute nothing. Otherwise a behavior-only
  // candidate (0 tokens, +0.3) could outrank a legitimately token-anchored candidate
  // (e.g. "Writing Skills"→communication via `writing`, 0.28) and steal the "best" slot —
  // and because that winner has no token, the concern is then wrongly flagged unmatched.
  const score = TOKEN_WEIGHT * tokenScore + (behaviorAligned && matches > 0 ? BEHAVIOR_WEIGHT : 0);
  return { key: arch.key, tokenMatches: matches, tokenScore, behaviorAligned, score };
}

export interface Assignment {
  concernId: string;
  archetypeKey: string | null;
  score: number;
  tokenMatches: number;
  // 'human_override' is set ONLY by the Phase-2.2 governance layer (never by the
  // deterministic assignArchetype below) — it records a human reviewer decision.
  method: 'signature' | 'signature+behavior' | 'unmatched' | 'human_override';
  grounding: GroundingSource; // how the concern was grounded (honesty/audit)
  bestScore: number;       // best score even if unmatched (for the review table)
  bestArchetypeKey: string; // best candidate even if rejected
}

export function assignArchetype(ctx: ConcernContext): Assignment {
  const matchTokens = buildMatchTokens(ctx);
  // Effective behavior signal fuses direct + relationship-propagated grounding, so the
  // alignment bonus is never name-only when relationship evidence exists.
  const { dominant, grounding } = effectiveBehavior(ctx);
  let best: ArchetypeScore | null = null;
  for (let i = 0; i < ARCHETYPES.length; i++) {
    const s = scoreArchetype(matchTokens, dominant, ARCHETYPES[i]);
    if (
      best == null ||
      s.score > best.score ||
      // deterministic tiebreak: more token matches, then earlier array index
      (s.score === best.score && s.tokenMatches > best.tokenMatches)
    ) {
      best = s;
    }
  }
  const b = best as ArchetypeScore;
  const accepted = b.tokenMatches >= ASSIGN_MIN_TOKEN_MATCHES && b.score >= ASSIGN_MIN_SCORE;
  if (!accepted) {
    return {
      concernId: ctx.concernId, archetypeKey: null, score: 0, tokenMatches: b.tokenMatches,
      method: 'unmatched', grounding, bestScore: round4(b.score), bestArchetypeKey: b.key,
    };
  }
  // `grounding` reflects the relationship evidence the concern HAS (direct C/P framing,
  // propagated neighbour behaviors, or none) independent of whether the alignment bonus
  // fired; `method` reflects whether the behavior signal actually changed the pick.
  return {
    concernId: ctx.concernId,
    archetypeKey: b.key,
    score: round4(b.score),
    tokenMatches: b.tokenMatches,
    method: b.behaviorAligned ? 'signature+behavior' : 'signature',
    grounding,
    bestScore: round4(b.score),
    bestArchetypeKey: b.key,
  };
}

// ── Validation ───────────────────────────────────────────────────────────────
export type ValidationStatus = 'strong' | 'moderate' | 'weak';

export interface ArchetypeValidation {
  key: string;
  memberCount: number;
  capabilityCount: number;
  problemCount: number;
  behaviorGroundedCount: number; // members that actually carry behaviors
  coherence: number;             // 0..1 — share of members whose dominant behavior
                                 //        category == archetype primary category
  distinctiveness: number;       // 0..1 — 1 - leakage of its members' similar pairs
                                 //        into OTHER archetypes
  status: ValidationStatus;
}

/**
 * Similarity capture: of all construct_similarity_map pairs whose BOTH ends are
 * assigned, the fraction landing in the SAME archetype. High = the partition respects
 * the bottom-up similarity signal. A real, honest cross-check of a top-down library.
 */
export function similarityCapture(
  similarPairs: Array<[string, string]>,
  assignOf: Map<string, string | null>,
): { evaluated: number; captured: number; ratio: number } {
  let evaluated = 0;
  let captured = 0;
  for (const [a, b] of similarPairs) {
    const aa = assignOf.get(a);
    const bb = assignOf.get(b);
    if (aa == null || bb == null) continue;
    evaluated++;
    if (aa === bb) captured++;
  }
  return { evaluated, captured, ratio: evaluated === 0 ? 0 : round4(captured / evaluated) };
}

export function classifyValidation(coherence: number, memberCount: number): ValidationStatus {
  if (memberCount < 5) return 'weak';
  if (coherence >= 0.6) return 'strong';
  if (coherence >= 0.35) return 'moderate';
  return 'weak';
}

// ── Phase 2.3 — honest stabilization classifiers (pure) ──────────────────────
// Why a separate "reason" axis: a weak archetype can be weak for structurally DIFFERENT
// reasons that demand OPPOSITE human actions. Lumping them as "weak" hides the action.
export type WeakReason =
  | 'low_distinctiveness'         // leaks into another archetype → MERGE / RETIRE candidate
  | 'missing_behavioral_evidence' // well-formed + distinct but hollow → AUTHOR evidence
  | 'underpopulated'              // too few members to validate → MERGE / review
  | null;                         // not weak / healthy

// Distinctiveness at/below this share = its members' similarity pairs leak more OUT than
// stay IN → the archetype is not pulling its own weight as a distinct cluster.
export const DISTINCT_LEAK_THRESHOLD = 0.5;
export const MIN_MEMBERS = 5;

/**
 * Why an archetype is weak — drives whether the honest fix is a MERGE (leakage) or new
 * AUTHORED behavioral evidence (hollow). Only classifies genuinely-weak archetypes; a
 * strong/moderate one returns null. underpopulated takes priority (can't validate at all);
 * then leakage (structurally undifferentiated); else missing evidence (hollow-but-sound).
 */
export function classifyWeakReason(input: {
  status: ValidationStatus;
  memberCount: number;
  distinctiveness: number;
}): WeakReason {
  if (input.status !== 'weak') return null;
  if (input.memberCount < MIN_MEMBERS) return 'underpopulated';
  if (input.distinctiveness <= DISTINCT_LEAK_THRESHOLD) return 'low_distinctiveness';
  return 'missing_behavioral_evidence';
}

/**
 * Deterministic argmax over a leak-count map: the archetype this one's external similarity
 * pairs MOST land in. Ties broken by lexicographically-smallest key so the recommendation is
 * STABLE across runs regardless of SQL row order. Empty map → null (no leakage signal).
 */
export function pickLeakTarget(counts: Map<string, number>): string | null {
  let bestKey: string | null = null; let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN || (n === bestN && bestKey !== null && k < bestKey)) { bestN = n; bestKey = k; }
  }
  return bestKey;
}

/**
 * Read-only stabilization RECOMMENDATION for human governance — NEVER auto-applied.
 *   low_distinctiveness / underpopulated + a known leakage target → `merge:<target>`
 *   missing_behavioral_evidence (hollow, distinct)               → `author_behavioral_evidence`
 *   underpopulated with no leakage target                         → `review_underpopulated`
 *   healthy                                                       → `none`
 * The merge target is the archetype this one's similarity pairs MOST leak into (derived,
 * never hardcoded), so the suggestion follows the real bottom-up signal.
 */
export function recommendStabilization(reason: WeakReason, leakageTarget: string | null): string {
  if (reason === 'low_distinctiveness') return leakageTarget ? `merge:${leakageTarget}` : 'review_low_distinctiveness';
  if (reason === 'underpopulated') return leakageTarget ? `merge:${leakageTarget}` : 'review_underpopulated';
  if (reason === 'missing_behavioral_evidence') return 'author_behavioral_evidence';
  return 'none';
}

/**
 * Structural grounding CEILING for a member set: the share that have ANY relationship path
 * to behavioral evidence (direct framing/behavior OR propagated from neighbours) — i.e. the
 * MAX grounding achievable without fabricating evidence. When achieved grounding == ceiling,
 * the system is at its honest data ceiling and the remaining gap needs human-authored
 * behavioral evidence, not more propagation.
 */
export function groundingCeiling(members: ConcernContext[]): number {
  if (members.length === 0) return 0;
  let withPath = 0;
  for (const ctx of members) if (effectiveBehavior(ctx).grounding !== 'name_only') withPath++;
  return Math.round((withPath / members.length) * 10000) / 10000;
}

/**
 * Discovery readiness 0..100 — a single honest headline of how well the archetype set
 * explains the ecosystem. Weighted: coverage 25, relationship grounding 25 (share of
 * assignments backed by direct OR propagated Capability+Problem+Behavior evidence, not
 * the concern name alone), similarity capture 20, mean coherence 20, balance 10
 * (penalises one giant archetype swallowing everything). Relationship grounding is a
 * first-class term so name-only assignments honestly DEPRESS the score.
 */
export function discoveryReadiness(input: {
  coverage: number;              // assigned / total, 0..1
  relationshipGrounding: number; // (direct + propagated) / assigned, 0..1
  similarityCapture: number;     // 0..1
  meanCoherence: number;         // 0..1
  balance: number;               // 0..1 (1 = perfectly even, 0 = one archetype has all)
}): number {
  const v = 25 * clamp01(input.coverage)
    + 25 * clamp01(input.relationshipGrounding)
    + 20 * clamp01(input.similarityCapture)
    + 20 * clamp01(input.meanCoherence)
    + 10 * clamp01(input.balance);
  return Math.round(v * 10) / 10;
}

// balance = 1 - normalised Herfindahl concentration of member shares.
export function balanceScore(memberCounts: number[]): number {
  const total = memberCounts.reduce((s, n) => s + n, 0);
  const k = memberCounts.length;
  if (total === 0 || k <= 1) return 0;
  const hhi = memberCounts.reduce((s, n) => { const p = n / total; return s + p * p; }, 0);
  const minHhi = 1 / k; // perfectly even
  return clamp01((1 - hhi) / (1 - minHhi));
}

// ── small helpers ────────────────────────────────────────────────────────────
function round4(n: number): number { return Math.round(n * 10000) / 10000; }
function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }

export function summarizeAssignments(assignments: Assignment[]): {
  total: number; assigned: number; unmatched: number; coverage: number;
  perArchetype: Record<string, number>;
} {
  const perArchetype: Record<string, number> = {};
  for (const a of ARCHETYPES) perArchetype[a.key] = 0;
  let assigned = 0;
  for (const x of assignments) {
    if (x.archetypeKey) { assigned++; perArchetype[x.archetypeKey] = (perArchetype[x.archetypeKey] ?? 0) + 1; }
  }
  const total = assignments.length;
  return {
    total, assigned, unmatched: total - assigned,
    coverage: total === 0 ? 0 : round4(assigned / total),
    perArchetype,
  };
}
