/**
 * CAPADEX Problem Intelligence Layer (PIL) — Phase 1.5: Concern Ontology
 * Normalization (pure, deterministic, rule-based — NO external AI).
 *
 * EXTENSION-ONLY: reads the existing concern master, writes ONLY to the new
 * Phase-1.5 tables. Never mutates existing CAPADEX data.
 *
 * Data reality (discovered in the Phase-1 audit): each concern row carries THREE
 * framings of ONE underlying construct —
 *   • display_label    → capability / goal framing  ("Build Decision Confidence")
 *   • concern_cluster  → deficit-action framing      ("Weak Ability to ...")
 *   • concern_category → deficit-state taxonomy      ("Decision Anxiety")
 * The capability↔problem duality therefore lives WITHIN a single row. Phase 1
 * classified off `concern_category` (deficit suffix) and so over-assigned Problem.
 * Phase 1.5A reclassifies off the NAME's semantics (display_label head noun), and
 * 1.5B pairs that capability with the row's own deficit-state framing.
 */

export type CanonicalType =
  | 'Capability'
  | 'Problem'
  | 'Behavior'
  | 'Trait'
  | 'Outcome'
  | 'Risk';

export const CANONICAL_TYPES: CanonicalType[] = [
  'Capability', 'Problem', 'Behavior', 'Trait', 'Outcome', 'Risk',
];

// ── Vocabulary → type (head-noun signal on the NAME) ─────────────────────────
// Derived from the Phase-1 vocab, with the spec-mandated Phase-1.5 corrections:
//   resilience / adaptability / curiosity / flexibility → Trait (dispositions)
//   readiness / success / achievement                   → Outcome (end-states)
const VOCAB: Record<string, CanonicalType> = {
  // Problem — an experienced deficit / distress / difficulty.
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
  mistrust: 'Problem',

  // Outcome — a result / end-state (incl. spec: readiness / success / achievement).
  burnout: 'Outcome', fatigue: 'Outcome', decline: 'Outcome', collapse: 'Outcome',
  breakdown: 'Outcome', loss: 'Outcome', spillover: 'Outcome', trauma: 'Outcome',
  failure: 'Outcome', deterioration: 'Outcome', stagnation: 'Outcome', drop: 'Outcome',
  exhaustion: 'Outcome', plateau: 'Outcome', dropout: 'Outcome', attrition: 'Outcome',
  regression: 'Outcome', readiness: 'Outcome', success: 'Outcome', achievement: 'Outcome',

  // Risk — susceptibility / potential future harm.
  risk: 'Risk', risks: 'Risk', vulnerability: 'Risk', fragility: 'Risk',
  relapse: 'Risk', threat: 'Risk', susceptibility: 'Risk',

  // Behavior — an observable action pattern.
  avoidance: 'Behavior', reactivity: 'Behavior', resistance: 'Behavior',
  withdrawal: 'Behavior', hesitation: 'Behavior', suppression: 'Behavior',
  procrastination: 'Behavior', distraction: 'Behavior', fragmentation: 'Behavior',
  scrolling: 'Behavior', overthinking: 'Behavior', rumination: 'Behavior',
  defensiveness: 'Behavior', aggression: 'Behavior', disengagement: 'Behavior',
  overcommitment: 'Behavior', comparison: 'Behavior', cramming: 'Behavior',
  multitasking: 'Behavior',

  // Trait — a stable disposition (incl. spec: resilience / adaptability / curiosity).
  dependency: 'Trait', dependence: 'Trait', sensitivity: 'Trait', rigidity: 'Trait',
  perfectionism: 'Trait', impulsivity: 'Trait', introversion: 'Trait',
  neuroticism: 'Trait', stubbornness: 'Trait', timidity: 'Trait', shyness: 'Trait',
  resilience: 'Trait', adaptability: 'Trait', curiosity: 'Trait', flexibility: 'Trait',
  openness: 'Trait', conscientiousness: 'Trait', patience: 'Trait',

  // Capability — a skill / ability / capacity (positively framed).
  management: 'Capability', thinking: 'Capability', skill: 'Capability',
  skills: 'Capability', awareness: 'Capability', clarity: 'Capability',
  literacy: 'Capability', competence: 'Capability', competency: 'Capability',
  mastery: 'Capability', intelligence: 'Capability', mindset: 'Capability',
  communication: 'Capability', leadership: 'Capability', ownership: 'Capability',
  discipline: 'Capability', persistence: 'Capability', confidence: 'Capability',
  expression: 'Capability', stability: 'Capability', regulation: 'Capability',
  autonomy: 'Capability', efficacy: 'Capability', fluency: 'Capability',
  proficiency: 'Capability', effectiveness: 'Capability', capability: 'Capability',
  understanding: 'Capability', reasoning: 'Capability', planning: 'Capability',
  organization: 'Capability', organisation: 'Capability', collaboration: 'Capability',
  creativity: 'Capability', visibility: 'Capability', insight: 'Capability',
};

// Leading action verbs / gerunds → the NAME describes a capability ("to do X").
const ACTION_VERBS = new Set([
  'build', 'building', 'develop', 'developing', 'manage', 'managing', 'handle',
  'handling', 'detect', 'detecting', 'measure', 'measuring', 'balance', 'balancing',
  'solve', 'solving', 'navigate', 'navigating', 'maintain', 'maintaining', 'improve',
  'improving', 'evaluate', 'evaluating', 'create', 'creating', 'ensure', 'ensuring',
  'monitor', 'monitoring', 'lead', 'leading', 'express', 'expressing', 'communicate',
  'communicating', 'prioritize', 'prioritizing', 'adapt', 'adapting', 'strengthen',
  'strengthening', 'leverage', 'drive', 'driving', 'design', 'designing', 'plan',
  'planning', 'organize', 'organizing', 'collaborate', 'collaborating', 'apply',
  'applying', 'interpret', 'interpreting', 'identify', 'identifying',
]);

const POSITIVE_WORDS = new Set([
  'strong', 'effective', 'healthy', 'confident', 'clear', 'ready', 'capable',
  'skilled', 'proactive', 'positive', 'balanced', 'consistent', 'resilient',
  'adaptive', 'curious', 'disciplined', 'motivated', 'empowered',
]);
const NEGATIVE_WORDS = new Set([
  'weak', 'poor', 'low', 'lack', 'lacking', 'limited', 'inadequate', 'insufficient',
  'excessive', 'difficulty', 'difficult', 'unable', 'inability', 'struggling',
  'fear', 'anxious', 'stressed', 'confused', 'overwhelmed', 'fragile', 'unstable',
]);
// Distress nouns that, when they LEAD a name ("Anxiety About …", "Fear of …"),
// make the construct problem-framed regardless of a trailing outcome/capability noun.
const DISTRESS_LEAD = new Set([
  'anxiety', 'fear', 'stress', 'worry', 'uncertainty', 'doubt', 'insecurity',
  'dread', 'panic', 'distress', 'apprehension', 'overwhelm', 'frustration',
]);

// Pure-scaffolding tokens dropped when building the topical construct key, so that
// different framings of the same construct still overlap. We deliberately KEEP
// topical nouns (communication, career, resilience, …) — only structural framing
// words are stripped.
const KEY_STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'and', 'or', 'for', 'with', 'your', 'you',
  'my', 'their', 'his', 'her', 'its', 'on', 'at', 'by', 'across', 'during', 'within',
  'into', 'under', 'over', 'between', 'through', 'after', 'before', 'about', 'is',
  'are', 'be', 'being', 'becoming', 'having', 'more', 'less', 'early', 'late', 'new',
  'own', 'real', 'long', 'short', 'term', 'multi', 'year', 'years', 'when', 'while',
  'as', 'too', 'very', 'this', 'that', 'these', 'those', 'highly', 'simultaneously',
  'constructively', 'effectively', 'consistently', 'properly',
]);
// Structural framing words (state/skill scaffolding + polarity + population nouns)
// dropped from keys so only TOPICAL nouns drive construct similarity. Topical
// type-nouns (communication, resilience, career, …) are deliberately NOT dropped.
const KEY_DROP = new Set<string>([
  'skill', 'skills', 'skillset', 'ability', 'abilities', 'weak', 'poor', 'low',
  'strong', 'lack', 'lacking', 'limited', 'inadequate', 'insufficient', 'excessive',
  'difficulty', 'difficulties', 'deficit', 'weakness', 'gap', 'gaps', 'blindness',
  // population / scope nouns — not the construct itself.
  'student', 'students', 'faculty', 'teacher', 'teachers', 'institutional',
  'institution', 'institutionally', 'organizational', 'organisational', 'school',
  'schools', 'people', 'others', 'child', 'children', 'parents', 'employees',
  ...ACTION_VERBS,
]);

// Generic tokens that make poor family NAMES (state/scaffolding) — skipped when
// naming a family unless every member token is generic.
export const FAMILY_NAME_STOPWORDS = new Set<string>([
  'confidence', 'fear', 'fears', 'problem', 'self', 'personal', 'holistic',
  'general', 'managing', 'multiple', 'high', 'anxiety', 'stress', 'doubt',
  'pressure', 'awareness', 'clarity', 'readiness', 'understanding',
]);

export function tokenize(s?: string | null): string[] {
  if (!s) return [];
  return String(s).toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
}

export function polarity(name?: string | null): 'positive' | 'negative' | 'neutral' {
  const t = tokenize(name);
  let pos = 0, neg = 0;
  for (const w of t) {
    if (NEGATIVE_WORDS.has(w) || VOCAB[w] === 'Problem') neg++;
    else if (POSITIVE_WORDS.has(w) || VOCAB[w] === 'Capability') pos++;
  }
  if (neg > pos) return 'negative';
  if (pos > neg) return 'positive';
  return 'neutral';
}

export interface TypeResult {
  type: CanonicalType;
  confidence: number; // 0..1, 4dp
  reasoning: string;
}

/**
 * 1.5A — classify a concern by the SEMANTIC meaning of its NAME (not the
 * deficit-framed concern_category). Deterministic cascade; never throws.
 */
export function classifyTypeSemantic(name?: string | null): TypeResult {
  const toks = tokenize(name);
  const has = (set: Set<string>) => toks.some((w) => set.has(w));
  const round = (n: number) => Math.round(n * 10000) / 10000;

  if (toks.length === 0) {
    return { type: 'Problem', confidence: 0.4, reasoning: 'empty name; defaulted to Problem' };
  }
  const head = toks[toks.length - 1];

  // 1. Explicit Risk anywhere wins.
  if (toks.some((w) => VOCAB[w] === 'Risk')) {
    return { type: 'Risk', confidence: 0.9, reasoning: `risk cue "${toks.find((w) => VOCAB[w] === 'Risk')}"` };
  }
  // 1b. Distress-LEADING subject ("Anxiety About …", "Fear of …") is problem-framed.
  //     Guarded before the Outcome/head cascade so a trailing outcome/capability token
  //     (e.g. "…Future Success", "…Stability") can't flip an obviously distressed name.
  if (DISTRESS_LEAD.has(toks[0])) {
    return { type: 'Problem', confidence: 0.82, reasoning: `distress-leading subject "${toks[0]}" → Problem` };
  }
  // 2. Explicit Outcome end-state anywhere (burnout, decline, readiness, success…).
  const outTok = toks.find((w) => VOCAB[w] === 'Outcome');
  if (outTok) return { type: 'Outcome', confidence: 0.85, reasoning: `outcome cue "${outTok}"` };
  // 3. Head-noun mapping — the dominant signal.
  if (VOCAB[head]) {
    return { type: VOCAB[head], confidence: 0.85, reasoning: `name head "${head}" → ${VOCAB[head]}` };
  }
  // 4. Behavior / Trait cue anywhere.
  const behTok = toks.find((w) => VOCAB[w] === 'Behavior');
  if (behTok) return { type: 'Behavior', confidence: 0.8, reasoning: `behavior cue "${behTok}"` };
  const trTok = toks.find((w) => VOCAB[w] === 'Trait');
  if (trTok) return { type: 'Trait', confidence: 0.8, reasoning: `trait cue "${trTok}"` };
  // 5. Problem cue anywhere.
  const probTok = toks.find((w) => VOCAB[w] === 'Problem');
  if (probTok) return { type: 'Problem', confidence: 0.78, reasoning: `problem cue "${probTok}"` };
  // 6. Capability cue OR a leading action verb ("to do X" = a capability).
  const capTok = toks.find((w) => VOCAB[w] === 'Capability');
  if (capTok) return { type: 'Capability', confidence: 0.75, reasoning: `capability cue "${capTok}"` };
  if (ACTION_VERBS.has(toks[0])) {
    return { type: 'Capability', confidence: 0.7, reasoning: `leading action verb "${toks[0]}" → capability` };
  }
  // 7. Polarity fallback.
  const pol = polarity(name);
  if (pol === 'negative') return { type: 'Problem', confidence: round(0.55), reasoning: 'negative polarity, no explicit cue' };
  if (pol === 'positive') return { type: 'Capability', confidence: round(0.55), reasoning: 'positive polarity, no explicit cue' };
  return { type: 'Problem', confidence: 0.45, reasoning: 'no semantic cue; defaulted to Problem' };
}

// ── 1.5C — canonical entity (cleaned, title-cased construct name) ─────────────
export function deriveCanonicalEntity(name?: string | null): string {
  const raw = (name ?? '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  return raw
    .split(' ')
    .map((w) => (w.length <= 2 && w === w.toLowerCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

// ── Construct key (topical token set) — backbone of 1.5B/D/E ──────────────────
export function constructKey(...names: (string | null | undefined)[]): {
  set: Set<string>;
  ordered: string[];
} {
  const ordered: string[] = [];
  const set = new Set<string>();
  for (const name of names) {
    for (const t of tokenize(name)) {
      if (KEY_STOPWORDS.has(t) || KEY_DROP.has(t)) continue;
      if (!set.has(t)) { set.add(t); ordered.push(t); }
    }
  }
  return { set, ordered };
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// ── 1.5B — within-row capability↔problem pairing ─────────────────────────────
export interface CapProblemMapping {
  capability_concern_id: string;
  capability_name: string;
  problem_concern_id: string;
  problem_name: string;
  confidence_score: number;
  mapping_reason: string;
}

/**
 * If the row's NAME (display_label) reads as a Capability but its deficit framing
 * (concern_category / cluster) reads as a Problem-state, emit the pairing. Returns
 * null when there is no genuine capability↔problem duality.
 */
export function deriveWithinRowMapping(row: {
  concern_id: string;
  display_label?: string | null;
  concern_cluster?: string | null;
  concern_category?: string | null;
}): CapProblemMapping | null {
  const capName = (row.display_label && row.display_label.trim())
    || (row.concern_cluster && row.concern_cluster.trim()) || '';
  if (!capName) return null;
  const capType = classifyTypeSemantic(capName);
  if (capType.type !== 'Capability') return null;

  const deficitName = (row.concern_category && row.concern_category.trim())
    || (row.concern_cluster && row.concern_cluster.trim()) || '';
  if (!deficitName) return null;
  const defType = classifyTypeSemantic(deficitName);
  if (defType.type !== 'Problem') return null;

  const overlap = jaccard(constructKey(capName).set, constructKey(deficitName).set);
  return {
    capability_concern_id: row.concern_id,
    capability_name: deriveCanonicalEntity(capName),
    problem_concern_id: row.concern_id,
    problem_name: deriveCanonicalEntity(deficitName),
    confidence_score: Math.round(Math.min(0.97, 0.7 + overlap * 0.3) * 10000) / 10000,
    mapping_reason: `display_label is a capability ("${capName}") whose concern_category is a deficit-state ("${deficitName}"); topical overlap ${overlap.toFixed(2)}`,
  };
}

// ── 1.5D/E — similarity graph (inverted index → candidate pairs) ──────────────
export interface KeyedItem { id: string; set: Set<string> }
export interface SimPair { a: string; b: string; score: number }

/**
 * Generate candidate pairs via an inverted index (only concerns sharing ≥1 topical
 * token are compared), then keep pairs with Jaccard ≥ threshold. `postingCap`
 * skips ultra-common tokens for candidate generation to avoid quadratic blow-up
 * (they are still counted inside the Jaccard set).
 */
export function similarPairs(
  items: KeyedItem[],
  threshold: number,
  opts: { postingCap?: number; minShared?: number } = {},
): SimPair[] {
  const postingCap = opts.postingCap ?? 150;
  // Require ≥ minShared overlapping topical tokens. This suppresses single-token
  // "hub" keys (e.g. {emotional}) that would otherwise chain unrelated concerns
  // into one giant connected component.
  const minShared = opts.minShared ?? 1;
  const postings = new Map<string, number[]>();
  items.forEach((it, idx) => {
    for (const tok of it.set) {
      let arr = postings.get(tok);
      if (!arr) { arr = []; postings.set(tok, arr); }
      arr.push(idx);
    }
  });
  const seen = new Set<string>();
  const pairs: SimPair[] = [];
  for (const arr of postings.values()) {
    if (arr.length < 2 || arr.length > postingCap) continue;
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const x = arr[i], y = arr[j];
        const key = x < y ? `${x}|${y}` : `${y}|${x}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const a = items[x].set, b = items[y].set;
        let inter = 0;
        for (const t of a) if (b.has(t)) inter++;
        if (inter < minShared) continue;
        const score = inter / (a.size + b.size - inter);
        if (score >= threshold) pairs.push({ a: items[x].id, b: items[y].id, score: Math.round(score * 10000) / 10000 });
      }
    }
  }
  return pairs;
}

/** Union-find connected components over similarity edges. */
export function connectedComponents(ids: string[], edges: { a: string; b: string }[]): string[][] {
  const parent = new Map<string, string>();
  ids.forEach((id) => parent.set(id, id));
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    while (parent.get(x) !== r) { const n = parent.get(x)!; parent.set(x, r); x = n; }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const e of edges) { if (parent.has(e.a) && parent.has(e.b)) union(e.a, e.b); }
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const r = find(id);
    let g = groups.get(r);
    if (!g) { g = []; groups.set(r, g); }
    g.push(id);
  }
  return [...groups.values()];
}

export function summarizeTypes(types: CanonicalType[]): Record<CanonicalType, number> {
  const c: Record<CanonicalType, number> = { Capability: 0, Problem: 0, Behavior: 0, Trait: 0, Outcome: 0, Risk: 0 };
  for (const t of types) c[t]++;
  return c;
}
