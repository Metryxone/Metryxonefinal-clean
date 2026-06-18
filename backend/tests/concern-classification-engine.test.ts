/**
 * CAPADEX PIL — Phase 1 concern classifier: deterministic unit tests.
 *
 * Locks the guarantees:
 *   1. The head (last) word of concern_category is the dominant signal across
 *      all six categories.
 *   2. A qualifier + capability root resolves to the qualifier's category
 *      ("Accountability Deficit" → Problem, not Capability).
 *   3. Unknown / empty category falls back to Problem with low confidence.
 *   4. Output is always one of the six allowed categories; confidence in [0,1].
 *
 * Pure + in-memory — requires NO live DATABASE_URL.
 *
 * Run with:  npx tsx backend/tests/concern-classification-engine.test.ts
 */
import assert from 'node:assert/strict';
import {
  classifyConcern,
  summarize,
  CLASSIFICATIONS,
  type Classification,
} from '../services/pil/concern-classification-engine';

function expect(category: string, expected: Classification) {
  const r = classifyConcern({ concern_id: 'X', concern_category: category });
  assert.equal(
    r.classification,
    expected,
    `"${category}" → ${r.classification} (expected ${expected}) | ${r.reasoning}`,
  );
  assert.ok(r.confidence_score > 0 && r.confidence_score <= 1, 'confidence in (0,1]');
  assert.ok(CLASSIFICATIONS.includes(r.classification), 'valid category');
}

// 1. Dominant last-word across all six categories.
expect('Comparison Anxiety', 'Problem');
expect('Self-Awareness Gap', 'Problem');
expect('Emotional Trigger Blindness', 'Problem');
expect('Decision Paralysis', 'Problem');
expect('Attention Fragmentation', 'Behavior');
expect('Challenge Avoidance', 'Behavior');
expect('Social Withdrawal', 'Behavior');
expect('Validation Dependency', 'Trait');
expect('Criticism Sensitivity', 'Trait');
expect('Competitive Burnout Risk', 'Risk');
expect('Recovery Fragility', 'Risk');
expect('Stress-Induced Productivity Decline', 'Outcome');
expect('Student Burnout', 'Outcome');
expect('Anger Management', 'Capability');
expect('Enterprise Thinking', 'Capability');

// 2. Qualifier overrides a capability root (deficit-of-a-capability = Problem).
expect('Accountability Deficit', 'Problem');
expect('Confidence Deficit', 'Problem');
expect('Communication Weakness', 'Problem');

// 3. Unknown / empty → Problem default, low confidence.
{
  const r = classifyConcern({ concern_id: 'Y', concern_category: 'Florbex Zindle' });
  assert.equal(r.classification, 'Problem');
  assert.ok(r.confidence_score <= 0.5, 'unknown category → low confidence');
}
{
  const r = classifyConcern({ concern_id: 'Z' });
  assert.equal(r.classification, 'Problem');
  assert.equal(r.confidence_score, 0.4);
}

// 4. display_label rescues a row whose category suffix is unknown.
{
  const r = classifyConcern({
    concern_id: 'L',
    concern_category: 'Mystery Bucket',
    display_label: 'Professional Writing Skills',
  });
  assert.equal(r.classification, 'Capability', `label rescue → ${r.classification}`);
}

// 4b. Score ties resolve to Problem, never Capability (problem-oriented master).
{
  const r = classifyConcern({
    concern_id: 'T',
    concern_category: 'Mystery Bucket',
    display_label: 'Skills Weakness', // skills→Capability(1) vs weakness→Problem(1) tie
  });
  assert.equal(r.classification, 'Problem', `tie should resolve to Problem, got ${r.classification}`);
  assert.ok(r.confidence_score < 0.6, 'ambiguous tie → low confidence');
}

// 5. concern_name prefers display_label.
{
  const r = classifyConcern({
    concern_id: 'N',
    concern_category: 'Exam Anxiety',
    display_label: 'I freeze up during exams',
    concern_cluster: 'Exam Stress',
  });
  assert.equal(r.concern_name, 'I freeze up during exams');
}

// 6. summarize counts correctly.
{
  const results = [
    classifyConcern({ concern_id: 'a', concern_category: 'Exam Anxiety' }),
    classifyConcern({ concern_id: 'b', concern_category: 'Social Withdrawal' }),
    classifyConcern({ concern_id: 'c', concern_category: 'Student Burnout' }),
  ];
  const counts = summarize(results);
  assert.equal(counts.Problem, 1);
  assert.equal(counts.Behavior, 1);
  assert.equal(counts.Outcome, 1);
}

console.log('✓ concern-classification-engine: all assertions passed');
