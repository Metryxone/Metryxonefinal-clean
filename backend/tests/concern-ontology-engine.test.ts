/**
 * Tests for the PIL Phase-1.5 ontology engine (pure, no IO).
 *   npx tsx backend/tests/concern-ontology-engine.test.ts
 */
import assert from 'node:assert/strict';
import {
  classifyTypeSemantic, deriveCanonicalEntity, polarity, constructKey, jaccard,
  similarPairs, connectedComponents, deriveWithinRowMapping, summarizeTypes,
  type KeyedItem,
} from '../services/pil/concern-ontology-engine.js';

let passed = 0;
function t(name: string, fn: () => void): void {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('classifyTypeSemantic — spec examples');
const T = (name: string, want: string) => assert.equal(classifyTypeSemantic(name).type, want, `${name} → ${want}`);

t('capabilities classify as Capability', () => {
  T('Career Direction Clarity', 'Capability');
  T('Communication Skills', 'Capability');
  T('Decision-Making Skills', 'Capability');
  T('Academic Planning Skills', 'Capability');
  T('Self-Directed Learning Skills', 'Capability');
  T('Presentation Skills', 'Capability');
  T('Emotional Stability', 'Capability');
});
t('problem states classify as Problem', () => {
  T('Career Ambiguity', 'Problem');
  T('Decision Anxiety', 'Problem');
  T('Communication Difficulty', 'Problem');
  T('Academic Confusion', 'Problem');
  T('Self-Learning Deficit', 'Problem');
  T('Presentation Anxiety', 'Problem');
  T('Emotional Instability', 'Problem');
});
t('behaviors classify as Behavior', () => {
  T('Procrastination', 'Behavior');
  T('Avoidance', 'Behavior');
  T('Excessive Comparison', 'Behavior');
});
t('traits classify as Trait (spec: resilience/adaptability/curiosity)', () => {
  T('Curiosity', 'Trait');
  T('Resilience', 'Trait');
  T('Adaptability', 'Trait');
});
t('outcomes classify as Outcome (spec: burnout/success/readiness)', () => {
  T('Burnout', 'Outcome');
  T('Academic Success', 'Outcome');
  T('Career Readiness', 'Outcome');
});
t('risks classify as Risk', () => {
  T('Burnout Risk', 'Risk');
  T('Career Misalignment Risk', 'Risk');
});
t('leading action verbs imply Capability', () => {
  T('Evaluate Skill Relevance Across Industries', 'Capability');
  T('Balancing Multiple Subjects Simultaneously', 'Capability');
  T('Build Cross-Domain Problem-Solving Confidence', 'Capability');
});
t('real display_labels with state heads keep their state type', () => {
  T('Mock Test Anxiety', 'Problem');
  T('Emotional Burnout During Multi-Year Transitions', 'Outcome');
});
t('distress-leading subjects stay Problem despite trailing outcome/capability nouns', () => {
  T('Anxiety About Future Stability', 'Problem');
  T('Anxiety About Future Success', 'Problem');
  T('Fear of Failure', 'Problem');
  T('Uncertainty About Career Readiness', 'Problem');
});

console.log('polarity');
t('polarity reads pos/neg/neutral', () => {
  assert.equal(polarity('Strong Communication Skills'), 'positive');
  assert.equal(polarity('Weak Communication Deficit'), 'negative');
});

console.log('constructKey + jaccard');
t('different framings of one construct overlap', () => {
  const a = constructKey('Communication Skills').set;
  const b = constructKey('Communication Difficulty').set;
  assert.ok(jaccard(a, b) >= 0.45, `expected overlap, got ${jaccard(a, b)}`);
});
t('unrelated constructs do not overlap', () => {
  const a = constructKey('Career Direction Clarity').set;
  const b = constructKey('Sleep Hygiene Habits').set;
  assert.equal(jaccard(a, b), 0);
});
t('scaffolding/verbs stripped, topical nouns kept', () => {
  const k = constructKey('Build Long-Term Emotional Resilience');
  assert.ok(k.set.has('emotional') && k.set.has('resilience'));
  assert.ok(!k.set.has('build') && !k.set.has('long'));
});

console.log('similarPairs + connectedComponents');
t('similar items pair and cluster; unrelated stay apart', () => {
  const items: KeyedItem[] = [
    { id: 'A', set: constructKey('Career Direction Clarity').set },
    { id: 'B', set: constructKey('Career Direction Ambiguity').set },
    { id: 'C', set: constructKey('Sleep Hygiene Habits').set },
  ];
  const pairs = similarPairs(items, 0.45);
  assert.ok(pairs.some((p) => (p.a === 'A' && p.b === 'B') || (p.a === 'B' && p.b === 'A')));
  assert.ok(!pairs.some((p) => p.a === 'C' || p.b === 'C'));
  const comps = connectedComponents(['A', 'B', 'C'], pairs).filter((g) => g.length >= 2);
  assert.equal(comps.length, 1);
  assert.equal(comps[0].sort().join(','), 'A,B');
});

console.log('deriveWithinRowMapping (1.5B)');
t('capability display_label + deficit category → mapping', () => {
  const m = deriveWithinRowMapping({
    concern_id: 'X1',
    display_label: 'Self-Directed Learning Skills',
    concern_cluster: 'Weak Self-Directed Learning',
    concern_category: 'Self-Learning Deficit',
  });
  assert.ok(m);
  assert.equal(m!.capability_concern_id, 'X1');
  assert.equal(m!.problem_concern_id, 'X1');
  assert.ok(m!.confidence_score > 0 && m!.confidence_score <= 1);
});
t('non-capability display_label → no mapping', () => {
  const m = deriveWithinRowMapping({
    concern_id: 'X2', display_label: 'Mock Test Anxiety',
    concern_cluster: null, concern_category: 'Mock Test Stress',
  });
  assert.equal(m, null);
});

console.log('deriveCanonicalEntity + summarizeTypes');
t('canonical entity is trimmed title case', () => {
  assert.equal(deriveCanonicalEntity('  career   direction clarity '), 'Career Direction Clarity');
});
t('summarizeTypes counts', () => {
  const c = summarizeTypes(['Capability', 'Capability', 'Problem']);
  assert.equal(c.Capability, 2);
  assert.equal(c.Problem, 1);
});

console.log(`\nAll ${passed} test groups passed.`);
