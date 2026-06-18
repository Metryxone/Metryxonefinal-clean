/**
 * Phase 3 human-intelligence-engine unit tests (pure; no DB).
 *   npx tsx backend/tests/human-intelligence-engine.test.ts
 */
import assert from 'node:assert/strict';
import {
  HUMAN_PACKS, STAKEHOLDERS, EMOTION_TYPES, PROBLEM_VOICES, MIN_PROBLEMS,
  ALIGNMENT_LEXICON, PSYCHOMETRIC_WORDS, VALIDATION_TARGETS,
  checkRealism, isAligned, detectDuplicates, duplicateMembers, scoreLine, packCoverage,
} from '../services/pil/human-intelligence-engine.js';

let passed = 0;
function test(name: string, fn: () => void): void {
  fn(); passed++; console.log(`  ✓ ${name}`);
}

console.log('\nhuman-intelligence-engine');

test('every archetype pack has >=MIN_PROBLEMS problems, all 5 stakeholders, all 5 emotion categories', () => {
  const keys = Object.keys(HUMAN_PACKS);
  assert.ok(keys.length >= 22, `expected >=22 packs, got ${keys.length}`);
  for (const k of keys) {
    const cov = packCoverage(k, HUMAN_PACKS[k]);
    assert.ok(cov.problems_ok, `${k}: only ${cov.problem_count} problems (<${MIN_PROBLEMS})`);
    assert.ok(cov.stakeholders_ok, `${k}: stakeholders ${cov.stakeholders_covered}/5`);
    assert.ok(cov.emotions_ok, `${k}: emotion categories ${cov.emotion_categories_covered}/5`);
  }
});

test('each pack has exactly one narrative per stakeholder type', () => {
  for (const [k, pack] of Object.entries(HUMAN_PACKS)) {
    const seen = pack.stakeholders.map((s) => s.stakeholder);
    assert.equal(seen.length, STAKEHOLDERS.length, `${k}: ${seen.length} stakeholder narratives`);
    assert.equal(new Set(seen).size, STAKEHOLDERS.length, `${k}: duplicate stakeholder`);
  }
});

test('emotion entries use only the 5 canonical types and every type appears', () => {
  for (const [k, pack] of Object.entries(HUMAN_PACKS)) {
    const types = new Set(pack.emotions.map((e) => e.type));
    for (const e of pack.emotions) assert.ok(EMOTION_TYPES.includes(e.type), `${k}: bad emotion type ${e.type}`);
    for (const t of EMOTION_TYPES) assert.ok(types.has(t), `${k}: missing emotion type ${t}`);
  }
});

test('problem voices are within the closed enum', () => {
  for (const [k, pack] of Object.entries(HUMAN_PACKS)) {
    for (const p of pack.problems) assert.ok(PROBLEM_VOICES.includes(p.voice), `${k}: bad voice ${p.voice}`);
  }
});

test('Validator 1 — checkRealism rejects psychometric jargon', () => {
  const bad = checkRealism('My self-efficacy construct shows low percentile on this assessment metric.');
  assert.equal(bad.pass, false);
  assert.ok(bad.jargon.length > 0, 'expected jargon flagged');
  const good = checkRealism('I blank out the moment an exam starts, even when I studied hard.');
  assert.equal(good.pass, true, good.reason);
});

test('Validator 1 — checkRealism enforces natural sentence length (4..45 words)', () => {
  assert.equal(checkRealism('too short').pass, false);
  assert.equal(checkRealism(Array(50).fill('word').join(' ')).pass, false);
});

test('every authored line is jargon-free (zero psychometric words across all packs)', () => {
  for (const [k, pack] of Object.entries(HUMAN_PACKS)) {
    const lines = [
      ...pack.problems.map((p) => p.text),
      ...pack.emotions.map((e) => e.text),
      ...pack.stakeholders.map((s) => s.text),
    ];
    for (const line of lines) {
      const r = checkRealism(line);
      assert.equal(r.jargon.length, 0, `${k}: jargon "${r.jargon.join(',')}" in "${line}"`);
    }
  }
});

test('Validator 2 — isAligned matches single-token, multi-word and hyphenated lexicon entries', () => {
  // sanity: lexicon exists for a representative archetype
  assert.ok(ALIGNMENT_LEXICON.performance_anxiety?.length, 'missing lexicon');
  assert.equal(isAligned('I freeze up before every exam', 'performance_anxiety'), true);
  assert.equal(isAligned('I love painting landscapes on weekends', 'performance_anxiety'), false);
  // unknown archetype → never aligned
  assert.equal(isAligned('anything at all here', '__nonexistent__'), false);
});

test('Validator 3 — detectDuplicates flags identical and near-identical, ignores distinct', () => {
  const dups = detectDuplicates([
    'I freeze up before every exam',
    'I freeze up before every exam',          // identical
    'I freeze up right before each exam',      // near-dup
    'I love hiking with my friends on Sunday', // distinct
  ], 0.6);
  assert.ok(dups.some((d) => d.reason === 'identical'));
  assert.ok(dups.length >= 1);
  const members = duplicateMembers(['a b c d e', 'a b c d e', 'totally different line here']);
  assert.ok(members.size >= 1);
});

test('scoreLine rewards realistic + aligned + distinct lines', () => {
  const q = scoreLine('I freeze up before every exam', 'performance_anxiety', true);
  assert.equal(q.realism, true);
  assert.equal(q.aligned, true);
  assert.equal(q.distinct, true);
  assert.equal(q.score, 5);
});

test('PSYCHOMETRIC_WORDS ban set is substantial', () => {
  assert.ok(PSYCHOMETRIC_WORDS.size >= 30, `ban set too small: ${PSYCHOMETRIC_WORDS.size}`);
});

test('aggregate validators over ALL authored content meet the canon targets (honest)', () => {
  let realismOk = 0, alignedOk = 0, dupCount = 0, total = 0;
  for (const [k, pack] of Object.entries(HUMAN_PACKS)) {
    const groups: string[][] = [
      pack.problems.map((p) => p.text),
      pack.emotions.map((e) => e.text),
      pack.stakeholders.map((s) => s.text),
    ];
    for (const lines of groups) {
      const dm = duplicateMembers(lines, 0.6);
      for (const line of lines) {
        total++;
        if (checkRealism(line).pass) realismOk++;
        if (isAligned(line, k)) alignedOk++;
        if (dm.has(line)) dupCount++;
      }
    }
  }
  const realismRate = realismOk / total;
  const alignRate = alignedOk / total;
  const dupRate = dupCount / total;
  console.log(`    realism=${(realismRate * 100).toFixed(1)}%  alignment=${(alignRate * 100).toFixed(1)}%  dup=${(dupRate * 100).toFixed(1)}%  (n=${total})`);
  assert.ok(realismRate >= VALIDATION_TARGETS.human_realism, `realism ${realismRate} < ${VALIDATION_TARGETS.human_realism}`);
  assert.ok(alignRate >= VALIDATION_TARGETS.archetype_alignment, `alignment ${alignRate} < ${VALIDATION_TARGETS.archetype_alignment}`);
  assert.ok(dupRate <= VALIDATION_TARGETS.duplicate_rate_max, `dup ${dupRate} > ${VALIDATION_TARGETS.duplicate_rate_max}`);
});

console.log(`\n${passed} tests passed\n`);
