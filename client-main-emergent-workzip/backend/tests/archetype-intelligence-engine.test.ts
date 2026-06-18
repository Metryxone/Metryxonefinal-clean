/**
 * CAPADEX PIL — Phase 2 archetype engine tests (pure, no DB). Run:
 *   npx tsx backend/tests/archetype-intelligence-engine.test.ts
 */
import assert from 'node:assert/strict';
import {
  ARCHETYPES, ARCHETYPE_COUNT, BEHAVIOR_CATEGORIES, normToks, buildMatchTokens,
  dominantBehaviorCategory, scoreArchetype, assignArchetype, similarityCapture,
  classifyValidation, discoveryReadiness, balanceScore, summarizeAssignments,
  effectiveBehavior, classifyWeakReason, recommendStabilization, groundingCeiling, pickLeakTarget,
  DISTINCT_LEAK_THRESHOLD, MIN_MEMBERS,
  ASSIGN_MIN_TOKEN_MATCHES, type ConcernContext,
} from '../services/pil/archetype-intelligence-engine.js';

function ctx(over: Partial<ConcernContext>): ConcernContext {
  return {
    concernId: over.concernId ?? 'x', concernName: over.concernName ?? 'x',
    canonicalType: over.canonicalType ?? 'Capability',
    behaviorCounts: over.behaviorCounts ?? {},
    propagatedBehaviorCounts: over.propagatedBehaviorCounts,
  };
}

let pass = 0;
function test(name: string, fn: () => void): void {
  try { fn(); pass++; console.log(`  \u2713 ${name}`); }
  catch (e) { console.error(`  \u2717 ${name}\n`, e); process.exit(1); }
}

console.log('\narchetype-intelligence-engine');

test('archetype set is small, meaningful and has unique keys + valid categories', () => {
  assert.ok(ARCHETYPE_COUNT >= 12 && ARCHETYPE_COUNT <= 40, `got ${ARCHETYPE_COUNT}`);
  const keys = new Set(ARCHETYPES.map((a) => a.key));
  assert.equal(keys.size, ARCHETYPES.length, 'duplicate archetype keys');
  for (const a of ARCHETYPES) {
    assert.ok(a.tokens.length > 0 && a.name.length > 0 && a.definition.length > 0);
    assert.ok(BEHAVIOR_CATEGORIES.includes(a.primaryCategory), `bad category ${a.primaryCategory}`);
  }
});

test('every behavior category is represented by at least one archetype', () => {
  const covered = new Set(ARCHETYPES.map((a) => a.primaryCategory));
  for (const c of BEHAVIOR_CATEGORIES) assert.ok(covered.has(c), `category ${c} has no archetype`);
});

test('normToks lowercases, splits and drops scaffolding/stopwords', () => {
  const t = normToks('Difficulty Managing Time and Deadlines');
  assert.ok(t.includes('time'));
  assert.ok(t.includes('deadlines'));
  assert.ok(!t.includes('difficulty'));
  assert.ok(!t.includes('managing'));
  assert.ok(!t.includes('and'));
});

test('buildMatchTokens fuses capability + problem + reason framing (not name alone)', () => {
  const ctx: ConcernContext = {
    concernId: 'X', concernName: 'Retention Ability', canonicalType: 'Problem',
    capabilityName: 'Knowledge Retention', problemName: 'Weak Memory Recall',
    mappingReason: 'comprehension and study integration', behaviorCounts: {},
  };
  const toks = buildMatchTokens(ctx);
  assert.ok(toks.includes('retention'));
  assert.ok(toks.includes('memory') || toks.includes('recall'));
  assert.ok(toks.includes('comprehension'));
});

test('dominantBehaviorCategory returns the max, null when ungrounded', () => {
  assert.equal(dominantBehaviorCategory({ concernId: 'a', concernName: '', canonicalType: '', behaviorCounts: { Emotional: 5, Cognitive: 2 } }), 'Emotional');
  assert.equal(dominantBehaviorCategory({ concernId: 'b', concernName: '', canonicalType: '', behaviorCounts: {} }), null);
});

test('scoreArchetype rewards token overlap and adds behavior-alignment bonus', () => {
  const anxiety = ARCHETYPES.find((a) => a.key === 'performance_anxiety')!;
  const noBeh = scoreArchetype(['exam', 'anxiety', 'fear'], null, anxiety);
  const withBeh = scoreArchetype(['exam', 'anxiety', 'fear'], 'Emotional', anxiety);
  assert.ok(noBeh.tokenMatches >= 2);
  assert.ok(withBeh.score > noBeh.score, 'behavior alignment should raise score');
  assert.ok(withBeh.behaviorAligned);
  const zero = scoreArchetype(['quantum', 'photon'], null, anxiety);
  assert.equal(zero.tokenMatches, 0);
  assert.equal(zero.score, 0);
});

test('assignArchetype routes a clear anxiety concern to performance_anxiety', () => {
  const a = assignArchetype({ concernId: 'q', concernName: 'Exam Anxiety Impacting Outcomes', canonicalType: 'Problem', behaviorCounts: { Emotional: 4 } });
  assert.equal(a.archetypeKey, 'performance_anxiety');
  assert.equal(a.method, 'signature+behavior');
  assert.equal(a.grounding, 'direct_cpb'); // first-hand behaviors → direct grounding
  assert.ok(a.score > 0);
});

test('grounding is direct_cpb when only capability/problem framing exists (no behaviors)', () => {
  const a = assignArchetype({ concernId: 'q2', concernName: 'Exam Anxiety', canonicalType: 'Problem', hasDirectCapabilityProblem: true, behaviorCounts: {} });
  assert.equal(a.grounding, 'direct_cpb');
});

test('grounding is propagated when only relationship-neighbour behaviors exist', () => {
  const a = assignArchetype({ concernId: 'q3', concernName: 'Exam Anxiety', canonicalType: 'Problem', behaviorCounts: {}, propagatedBehaviorCounts: { Emotional: 3 } });
  assert.equal(a.archetypeKey, 'performance_anxiety');
  assert.equal(a.grounding, 'propagated');
});

test('grounding is name_only when no relationship evidence exists', () => {
  const a = assignArchetype({ concernId: 'q4', concernName: 'Exam Anxiety', canonicalType: 'Problem', behaviorCounts: {} });
  assert.equal(a.grounding, 'name_only');
});

test('assignArchetype flags an anchorless concern as unmatched (never force-fit)', () => {
  const a = assignArchetype({ concernId: 'z', concernName: 'Zzxq Wibble Frobnicate', canonicalType: 'Problem', behaviorCounts: {} });
  assert.equal(a.archetypeKey, null);
  assert.equal(a.method, 'unmatched');
  assert.ok(a.tokenMatches < ASSIGN_MIN_TOKEN_MATCHES);
  assert.equal(a.score, 0);
});

test('behavior alignment alone (no token) never forces an assignment', () => {
  // dominant Emotional but a name with no archetype token → unmatched, not Emotional bucket
  const a = assignArchetype({ concernId: 'z2', concernName: 'Xylophone Penguin', canonicalType: 'Problem', behaviorCounts: { Emotional: 9 } });
  assert.equal(a.archetypeKey, null);
});

test('a behavior-only (0-token) candidate never steals the slot from a real token anchor', () => {
  // "Writing Skills" has a genuine token anchor in communication_expression (`writing`,
  // Social primary). Its dominant behavior is Academic → academic_achievement aligns but
  // has ZERO tokens here. Pre-fix the behavior-only candidate (0 tokens, +0.3) outranked
  // the token-anchored one (0.28) and the concern was wrongly flagged unmatched.
  const a = assignArchetype({ concernId: 'ws', concernName: 'Writing Skills', canonicalType: 'Capability', behaviorCounts: { Academic: 6 } });
  assert.equal(a.archetypeKey, 'communication_expression', 'token anchor must win over behavior-only candidate');
  assert.ok(a.tokenMatches >= 1, 'assignment must be token-anchored');
  // direct, behavior-only candidate must score nothing (no token → no bonus)
  const academic = ARCHETYPES.find((x) => x.key === 'academic_achievement')!;
  const behaviorOnly = scoreArchetype(['writing'], 'Academic', academic);
  assert.equal(behaviorOnly.tokenMatches, 0);
  assert.equal(behaviorOnly.score, 0, 'behavior bonus must require a token anchor');
});

test('newly-added construct vocabulary anchors problem-solving / self-* concerns', () => {
  const ps = assignArchetype({ concernId: 'ps', concernName: 'Problem-Solving Skills', canonicalType: 'Capability', behaviorCounts: {} });
  assert.equal(ps.archetypeKey, 'critical_reflective_thinking');
  const sl = assignArchetype({ concernId: 'sl', concernName: 'Self-Learning Habits', canonicalType: 'Capability', behaviorCounts: {} });
  assert.equal(sl.archetypeKey, 'learning_comprehension');
});

test('similarityCapture counts only pairs with both ends assigned', () => {
  const assignOf = new Map<string, string | null>([['a', 'k1'], ['b', 'k1'], ['c', 'k2'], ['d', null]]);
  const r = similarityCapture([['a', 'b'], ['a', 'c'], ['a', 'd']], assignOf);
  assert.equal(r.evaluated, 2);  // a-d skipped (d unassigned)
  assert.equal(r.captured, 1);   // a-b same archetype
  assert.equal(r.ratio, 0.5);
});

test('classifyValidation: small groups weak, high coherence strong', () => {
  assert.equal(classifyValidation(0.9, 3), 'weak');     // too few members
  assert.equal(classifyValidation(0.7, 50), 'strong');
  assert.equal(classifyValidation(0.4, 50), 'moderate');
  assert.equal(classifyValidation(0.1, 50), 'weak');
});

test('balanceScore: even split ~1, one-bucket-dominant ~0', () => {
  assert.ok(balanceScore([10, 10, 10, 10]) > 0.99);
  assert.ok(balanceScore([100, 1, 1, 1]) < 0.2);
  assert.equal(balanceScore([5]), 0);
});

test('discoveryReadiness is 0..100 and monotonic in coverage', () => {
  const lo = discoveryReadiness({ coverage: 0.2, relationshipGrounding: 0.5, similarityCapture: 0.3, meanCoherence: 0.3, balance: 0.5 });
  const hi = discoveryReadiness({ coverage: 0.9, relationshipGrounding: 0.5, similarityCapture: 0.3, meanCoherence: 0.3, balance: 0.5 });
  assert.ok(hi > lo);
  assert.ok(lo >= 0 && hi <= 100);
});

test('discoveryReadiness rises with relationship grounding (name-only honestly depresses it)', () => {
  const nameOnly = discoveryReadiness({ coverage: 0.8, relationshipGrounding: 0.2, similarityCapture: 0.5, meanCoherence: 0.5, balance: 0.9 });
  const grounded = discoveryReadiness({ coverage: 0.8, relationshipGrounding: 0.9, similarityCapture: 0.5, meanCoherence: 0.5, balance: 0.9 });
  assert.ok(grounded > nameOnly);
});

test('summarizeAssignments tallies coverage and per-archetype counts', () => {
  const s = summarizeAssignments([
    { concernId: '1', archetypeKey: 'performance_anxiety', score: 0.5, tokenMatches: 2, method: 'signature', grounding: 'direct_cpb', bestScore: 0.5, bestArchetypeKey: 'performance_anxiety' },
    { concernId: '2', archetypeKey: null, score: 0, tokenMatches: 0, method: 'unmatched', grounding: 'name_only', bestScore: 0, bestArchetypeKey: 'x' },
  ]);
  assert.equal(s.total, 2);
  assert.equal(s.assigned, 1);
  assert.equal(s.unmatched, 1);
  assert.equal(s.coverage, 0.5);
  assert.equal(s.perArchetype['performance_anxiety'], 1);
});

// ── Phase 2.3 — effectiveBehavior + honest stabilization classifiers ──────────
test('effectiveBehavior: direct beats propagated; propagated beats name_only; empty is name_only', () => {
  assert.deepEqual(effectiveBehavior(ctx({ behaviorCounts: { Leadership: 3 }, propagatedBehaviorCounts: { Social: 9 } })), { dominant: 'Leadership', grounding: 'direct_cpb' });
  assert.deepEqual(effectiveBehavior(ctx({ behaviorCounts: {}, propagatedBehaviorCounts: { Social: 2 } })), { dominant: 'Social', grounding: 'propagated' });
  assert.deepEqual(effectiveBehavior(ctx({ behaviorCounts: {} })), { dominant: null, grounding: 'name_only' });
});

test('groundingCeiling: share with ANY behavior path; name_only depresses it; empty set is 0', () => {
  assert.equal(groundingCeiling([]), 0);
  const members = [
    ctx({ behaviorCounts: { Leadership: 1 } }),          // direct
    ctx({ propagatedBehaviorCounts: { Social: 1 } }),    // propagated
    ctx({ behaviorCounts: {} }),                          // name_only
    ctx({ behaviorCounts: {} }),                          // name_only
  ];
  assert.equal(groundingCeiling(members), 0.5); // 2 of 4 have a path
  assert.equal(groundingCeiling([ctx({ behaviorCounts: {} })]), 0); // all name_only → honest 0
});

test('classifyWeakReason: only weak archetypes classified; reason axis is distinct from status', () => {
  assert.equal(classifyWeakReason({ status: 'strong', memberCount: 50, distinctiveness: 0.1 }), null);
  assert.equal(classifyWeakReason({ status: 'moderate', memberCount: 50, distinctiveness: 0.1 }), null);
  // underpopulated takes priority even if it would also leak
  assert.equal(classifyWeakReason({ status: 'weak', memberCount: MIN_MEMBERS - 1, distinctiveness: 0.0 }), 'underpopulated');
  // distinct enough members but low distinctiveness → leakage / merge candidate
  assert.equal(classifyWeakReason({ status: 'weak', memberCount: 50, distinctiveness: DISTINCT_LEAK_THRESHOLD }), 'low_distinctiveness');
  // populated + distinct but hollow → needs authored behavioral evidence
  assert.equal(classifyWeakReason({ status: 'weak', memberCount: 50, distinctiveness: 0.9 }), 'missing_behavioral_evidence');
});

test('pickLeakTarget: deterministic argmax; ties → lexicographically smallest key; empty → null', () => {
  assert.equal(pickLeakTarget(new Map()), null);
  assert.equal(pickLeakTarget(new Map([['a', 1], ['b', 3], ['c', 2]])), 'b');
  // tie between b(5) and a(5) regardless of insertion order → always 'a'
  assert.equal(pickLeakTarget(new Map([['b', 5], ['a', 5]])), 'a');
  assert.equal(pickLeakTarget(new Map([['a', 5], ['b', 5]])), 'a');
  // three-way tie → smallest key
  assert.equal(pickLeakTarget(new Map([['z', 2], ['m', 2], ['c', 2]])), 'c');
});

test('recommendStabilization: merge names the derived leakage target; hollow → author; healthy → none', () => {
  assert.equal(recommendStabilization('low_distinctiveness', 'leadership_influence'), 'merge:leadership_influence');
  assert.equal(recommendStabilization('low_distinctiveness', null), 'review_low_distinctiveness');
  assert.equal(recommendStabilization('underpopulated', 'leadership_influence'), 'merge:leadership_influence');
  assert.equal(recommendStabilization('underpopulated', null), 'review_underpopulated');
  assert.equal(recommendStabilization('missing_behavioral_evidence', 'anything'), 'author_behavioral_evidence');
  assert.equal(recommendStabilization(null, 'anything'), 'none');
});

console.log(`\n${pass} passed\n`);
