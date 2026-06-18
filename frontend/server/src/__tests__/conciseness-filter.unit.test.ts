/**
 * Unit tests for applyConcisenessFilter().
 *
 * These tests run directly against the pure function — no live server required.
 * Run with:  node --import tsx/esm --test src/__tests__/conciseness-filter.unit.test.ts
 *
 * Covered cases:
 *   1. Bullet-list path      — intro + first bullet only, remaining bullets stripped
 *   2. Plain paragraph path  — at most 2 sentences returned from a long prose block
 *   3. Header-only intro     — short colon-ended header causes filter to reach into next block
 *   4. Numbered list         — numeric "1." bullets are treated the same as dash bullets
 *   5. Single-sentence input — single sentence is returned unchanged
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyConcisenessFilter } from '../utils/conciseness-filter.js';

// ─── 1. Bullet-list path ──────────────────────────────────────────────────────
test('bullet-list: returns intro line and first bullet only', () => {
  const input = [
    'The LBI assessment covers these domains:',
    '- Emotional Intelligence',
    '- Critical Thinking',
    '- Leadership Potential',
    '- Communication Skills',
  ].join('\n');

  const result = applyConcisenessFilter(input);

  const lines = result.split('\n').filter(l => l.trim().length > 0);
  const bulletRe = /^\s*([-*•]|\d+[.)]) /;
  const bulletCount = lines.filter(l => bulletRe.test(l)).length;

  assert.equal(bulletCount, 1, `should contain exactly one bullet; got:\n${result}`);

  const firstBulletIdx = lines.findIndex(l => bulletRe.test(l));
  assert.ok(firstBulletIdx > 0, `a framing/intro line must appear before the bullet; got:\n${result}`);
  assert.ok(result.includes('Emotional Intelligence'), 'first bullet item must be kept');
  assert.ok(!result.includes('Critical Thinking'), 'second bullet must be stripped');
});

// ─── 2. Plain paragraph path ─────────────────────────────────────────────────
test('plain-paragraph: trims to at most two sentences', () => {
  const input =
    'This is the first sentence. This is the second sentence. ' +
    'This is the third sentence. And here is a fourth one.';

  const result = applyConcisenessFilter(input);

  const sentences = result.match(/[^.!?]+[.!?]+/g) ?? [];
  assert.ok(
    sentences.length <= 2,
    `expected at most 2 sentences; got ${sentences.length}:\n${result}`,
  );
  assert.ok(result.includes('first sentence'), 'first sentence must be preserved');
  assert.ok(!result.includes('third sentence'), 'third sentence must be removed');
});

// ─── 3. Header-only intro edge case ─────────────────────────────────────────
test('header-only intro: reaches into second block for first sentence', () => {
  const intro = 'Key Findings:';
  const secondBlock =
    'Students with high LBI scores outperform their peers significantly. ' +
    'This holds true across all tested age groups and school types.';
  const input = `${intro}\n\n${secondBlock}`;

  const result = applyConcisenessFilter(input);

  assert.ok(result.includes(intro), 'header must be kept');
  assert.ok(result.includes('outperform'), 'first sentence of second block must appear');
  assert.ok(!result.includes('holds true'), 'second sentence of second block must be stripped');
});

// ─── 4. Numbered list ────────────────────────────────────────────────────────
test('numbered-list: treats numeric bullets the same as dash bullets', () => {
  const input = [
    'Follow these steps:',
    '1. Complete the registration form.',
    '2. Upload your academic records.',
    '3. Await confirmation email.',
  ].join('\n');

  const result = applyConcisenessFilter(input);

  const bulletRe = /^\s*([-*•]|\d+[.)]) /m;
  const bulletCountRe = /^\s*([-*•]|\d+[.)]) /gm;
  const bulletCount = (result.match(bulletCountRe) ?? []).length;

  assert.equal(bulletCount, 1, `should retain exactly one numbered bullet; got:\n${result}`);
  assert.ok(result.includes('registration form'), 'first step must be kept');
  assert.ok(!result.includes('academic records'), 'second step must be removed');

  const lines = result.split('\n').filter(l => l.trim().length > 0);
  const firstBulletIdx = lines.findIndex(l => bulletRe.test(l));
  assert.ok(firstBulletIdx > 0, `intro line must precede the numbered bullet; got:\n${result}`);
});

// ─── 5. Single-sentence input ────────────────────────────────────────────────
test('single-sentence: returned unchanged', () => {
  const input = 'The assessment takes approximately 30 minutes to complete.';

  const result = applyConcisenessFilter(input);

  assert.equal(result, input, 'single-sentence input must be returned as-is');
});
