/**
 * Phase 1.6 behavior-intelligence-engine unit tests (pure; no DB).
 *   npx tsx backend/tests/behavior-intelligence-engine.test.ts
 */
import assert from 'node:assert/strict';
import {
  generateBehaviors, scoreQuality, expandStatement, detectDuplicates,
  inferCategory, mappingConfidence, explainabilityReadiness,
  BEHAVIOR_CATEGORIES, BEHAVIOR_FRAMES, SEVERITIES, AGE_BANDS, QUALITY_REJECT_BELOW,
  type GeneratedBehavior,
} from '../services/pil/behavior-intelligence-engine.js';

let passed = 0;
function test(name: string, fn: () => void): void {
  fn(); passed++; console.log(`  ✓ ${name}`);
}

console.log('\nbehavior-intelligence-engine');

test('curated frame library is substantial and free of duplicate ids', () => {
  assert.ok(BEHAVIOR_FRAMES.length >= 60, `expected >=60 curated frames, got ${BEHAVIOR_FRAMES.length}`);
  const ids = new Set(BEHAVIOR_FRAMES.map((f) => f.id));
  assert.equal(ids.size, BEHAVIOR_FRAMES.length, 'duplicate frame ids');
  assert.ok(BEHAVIOR_FRAMES.every((f) => f.tokens.length > 0 && f.action.length > 0));
});

test('generateBehaviors yields 3-5 observable behaviors for a matched concern', () => {
  const b = generateBehaviors({ concern_id: 'X', concern_name: 'Weak Time Management and Deadline Discipline' });
  assert.ok(b.length >= 3 && b.length <= 5, `got ${b.length}`);
  assert.ok(b.some((x) => x.source === 'curated'));
  assert.ok(b.every((x) => x.statement.length > 0));
});

test('unmatched concern still gets >=3 but as generic_fallback (honest weak coverage)', () => {
  const b = generateBehaviors({ concern_id: 'Y', concern_name: 'Zzqq Nonsense Construct' });
  assert.ok(b.length >= 3);
  assert.ok(b.every((x) => x.source === 'generic_fallback'));
});

test('curated behaviors pass quality gate; generic fallbacks are rejected (<15)', () => {
  const curated: GeneratedBehavior = { statement: 'misses work projects deadlines', category: 'Self-Management', frame_id: 'time_deadline', source: 'curated' };
  const generic: GeneratedBehavior = { statement: 'needs reminders to complete work projects', category: 'Self-Management', frame_id: 'generic', source: 'generic_fallback' };
  assert.equal(scoreQuality(curated, true).accepted, true);
  assert.equal(scoreQuality(generic, true).accepted, false);
});

test('quality sub-scores are all within 1..5 and reject threshold is 15', () => {
  const q = scoreQuality({ statement: 'avoids speaking up in school', category: 'Social', frame_id: 'comm_quiet', source: 'curated' }, true);
  for (const v of [q.observability, q.human_realism, q.distinctiveness, q.actionability]) {
    assert.ok(v >= 1 && v <= 5);
  }
  assert.equal(q.total, q.observability + q.human_realism + q.distinctiveness + q.actionability);
  assert.equal(QUALITY_REJECT_BELOW, 15);
});

test('expandStatement applies severity adverb and age-appropriate slot', () => {
  const young = expandStatement('misses {task} deadlines', 'Mild', '10-13');
  const adult = expandStatement('misses {task} deadlines', 'Significant', '26-40');
  assert.equal(young, 'Occasionally misses homework deadlines');
  assert.equal(adult, 'Consistently misses work projects deadlines');
  assert.notEqual(young, adult);
});

test('every severity × age band produces a distinct, resolved statement', () => {
  for (const sev of SEVERITIES) for (const age of AGE_BANDS) {
    const s = expandStatement('avoids the hardest {task}', sev, age);
    assert.ok(!s.includes('{'), `unresolved slot in: ${s}`);
  }
});

test('detectDuplicates flags identical and near-identical statements', () => {
  const dups = detectDuplicates([
    'misses homework deadlines',
    'misses homework deadlines',
    'avoids speaking up in class',
  ]);
  assert.ok(dups.some((d) => d.reason === 'identical'));
});

test('inferCategory routes tokens to one of the 8 categories', () => {
  assert.equal(inferCategory(['exam', 'study']), 'Academic');
  assert.equal(inferCategory(['anxiety', 'fear']), 'Emotional');
  assert.ok(BEHAVIOR_CATEGORIES.includes(inferCategory([])));
});

test('mappingConfidence stays within [0.1, 0.99]', () => {
  const lo = mappingConfidence(scoreQuality({ statement: 'x', category: 'Social', frame_id: 'g', source: 'generic_fallback' }, false), 0, 'generic_fallback');
  const hi = mappingConfidence(scoreQuality({ statement: 'avoids speaking up in school', category: 'Social', frame_id: 'comm_quiet', source: 'curated' }, true), 1, 'curated');
  assert.ok(lo >= 0.1 && lo <= 0.99);
  assert.ok(hi >= 0.1 && hi <= 0.99 && hi > lo);
});

test('explainabilityReadiness is 0..100 and monotonic in coverage', () => {
  const low = explainabilityReadiness({ concernsTotal: 100, concernsWithBehaviors: 10, capabilitiesMapped: 1, capabilitiesTotal: 10, problemsMapped: 1, problemsTotal: 10, avgQualityNorm: 0.2 });
  const high = explainabilityReadiness({ concernsTotal: 100, concernsWithBehaviors: 90, capabilitiesMapped: 9, capabilitiesTotal: 10, problemsMapped: 9, problemsTotal: 10, avgQualityNorm: 0.9 });
  assert.ok(low >= 0 && low <= 100);
  assert.ok(high >= 0 && high <= 100 && high > low);
});

console.log(`\n${passed} passed\n`);
