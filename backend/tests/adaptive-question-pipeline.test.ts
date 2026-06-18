/**
 * Adaptive Questioning — pure engine fixtures (Phase B).
 * Run:  npx tsx backend/tests/adaptive-question-pipeline.test.ts
 *
 * No test runner — plain asserts so it runs anywhere tsx runs.
 */

import assert from 'node:assert';
import {
  buildTraitMap,
  inferQuestionTraits,
  deriveLevels,
  type PriorAnswer,
} from '../services/adaptive/trait-inference';
import { computeInformationGain } from '../services/adaptive/information-gain';
import { classifyDuplicate } from '../services/adaptive/zero-repetition';
import { detectTraitContradictions } from '../services/adaptive/contradiction-pairs';
import { shouldStopInvestigating } from '../services/adaptive/adaptive-length';
import { runAdaptiveSelection } from '../services/adaptive/adaptive-question-pipeline';

let passed = 0;
function ok(name: string, cond: boolean) {
  assert.ok(cond, `FAIL: ${name}`);
  passed++;
  console.log(`  ✓ ${name}`);
}

// ─── trait inference ──────────────────────────────────────────────────────────
console.log('trait-inference');
ok('detects avoidance', inferQuestionTraits('Do you avoid difficult tasks?').includes('avoidance'));
ok('detects perfectionism', inferQuestionTraits('Does work need to be perfect?').includes('perfectionism'));
ok('no traits on neutral stem', inferQuestionTraits('What is your favourite colour?').length === 0);

// ─── derived polarity ─────────────────────────────────────────────────────────
console.log('derived-levels');
{
  // High distress on a self_doubt stem → LOW confidence level.
  const ans: PriorAnswer[] = [{ id: '1', question: 'I doubt my abilities', response_value: 1 }];
  const lv = deriveLevels(buildTraitMap(ans));
  ok('high self_doubt → low confidence', lv.confidence !== null && lv.confidence <= 0.1);
}

// ─── information gain ─────────────────────────────────────────────────────────
console.log('information-gain');
{
  const answered: PriorAnswer[] = [
    { id: 'a', question: 'Do you avoid hard tasks?', response_value: 1 },
    { id: 'b', question: 'Do you procrastinate on work?', response_value: 1 },
    { id: 'c', question: 'Do you delay starting work?', response_value: 1 },
  ];
  const map = buildTraitMap(answered);
  const coveredGain = computeInformationGain({ id: 'x', question: 'Do you avoid challenges?' }, map);
  const freshGain = computeInformationGain({ id: 'y', question: 'Do you feel anxious before exams?' }, map);
  ok('saturated trait → low gain', coveredGain < 0.2);
  ok('fresh trait → high gain', freshGain > 0.8);
  ok('fresh > covered', freshGain > coveredGain);
}

// ─── zero repetition ──────────────────────────────────────────────────────────
console.log('zero-repetition');
{
  const answered: PriorAnswer[] = [{ id: '1', question: 'Do you avoid difficult tasks often?', response_value: 1 }];
  ok('literal id dup', classifyDuplicate({ id: '1', question: 'totally different' }, answered).kind === 'literal');
  ok('semantic dup', classifyDuplicate({ id: '2', question: 'Do you often avoid difficult tasks?' }, answered).kind === 'semantic');
  ok('non-dup passes', classifyDuplicate({ id: '3', question: 'Do you sleep well at night?' }, answered).isDuplicate === false);
}
{
  // signal dup: trait saturated across 3 differently-worded stems
  const answered: PriorAnswer[] = [
    { id: 'a', question: 'Do you avoid hard tasks?', response_value: 1 },
    { id: 'b', question: 'Do you procrastinate on work?', response_value: 1 },
    { id: 'c', question: 'Do you delay starting work?', response_value: 1 },
  ];
  const r = classifyDuplicate({ id: 'd', question: 'Do you dodge challenges?' }, answered);
  ok('signal dup on saturated trait', r.kind === 'signal');
}

// ─── contradiction pairs ──────────────────────────────────────────────────────
console.log('contradiction-pairs');
{
  // high confidence (low self_doubt) + high avoidance
  const ans: PriorAnswer[] = [
    { id: '1', question: 'I doubt my abilities', response_value: 0 },   // self_doubt=0 → confidence high
    { id: '2', question: 'I avoid difficult tasks', response_value: 1 }, // avoidance high
  ];
  const found = detectTraitContradictions(buildTraitMap(ans));
  ok('confidence_avoidance fires', found.some((c) => c.type === 'confidence_avoidance'));
}
{
  // low confidence (high self_doubt) + strong performance (low underperformance)
  const ans: PriorAnswer[] = [
    { id: '1', question: 'I doubt my abilities', response_value: 1 },
    { id: '2', question: 'I fail to deliver good results', response_value: 0 },
  ];
  const found = detectTraitContradictions(buildTraitMap(ans));
  ok('confidence_performance_gap fires', found.some((c) => c.type === 'confidence_performance_gap'));
}
{
  // perfectionism + rapid execution
  const ans: PriorAnswer[] = [
    { id: '1', question: 'My work must be perfect', response_value: 1 },
    { id: '2', question: 'I rush in without thinking', response_value: 1 },
  ];
  const found = detectTraitContradictions(buildTraitMap(ans));
  ok('perfectionism_rapid_execution fires', found.some((c) => c.type === 'perfectionism_rapid_execution'));
}
{
  ok('no contradiction without evidence', detectTraitContradictions(buildTraitMap([])).length === 0);
}

// ─── adaptive length ──────────────────────────────────────────────────────────
console.log('adaptive-length');
{
  const empty = buildTraitMap([]);
  ok('continues below min', shouldStopInvestigating({ answeredCount: 1, bestRemainingGain: 0.9, openContradictions: 0, candidatesRemaining: 5, traitMap: empty }).stop === false);
  ok('stops at max', shouldStopInvestigating({ answeredCount: 10, bestRemainingGain: 0.9, openContradictions: 0, candidatesRemaining: 5, traitMap: empty }).reason === 'max_reached');
  ok('stops when no candidates', shouldStopInvestigating({ answeredCount: 5, bestRemainingGain: 0, openContradictions: 0, candidatesRemaining: 0, traitMap: empty }).reason === 'no_more_questions');
  ok('stops when confident', shouldStopInvestigating({ answeredCount: 5, bestRemainingGain: 0.05, openContradictions: 0, candidatesRemaining: 3, traitMap: empty }).reason === 'confidence_sufficient');
  ok('keeps going for open contradiction', shouldStopInvestigating({ answeredCount: 5, bestRemainingGain: 0.05, openContradictions: 1, candidatesRemaining: 3, traitMap: empty }).stop === false);
}

// ─── pipeline (end to end, pure) ──────────────────────────────────────────────
console.log('pipeline');
{
  const candidates = [
    { id: 'q-avoid', question: 'Do you avoid difficult tasks often?' },
    { id: 'q-dup', question: 'Do you avoid difficult tasks often?' }, // semantic dup of an answer
    { id: 'q-anx', question: 'Do you feel anxious before exams?' },
  ];
  const priorAnswers: PriorAnswer[] = [
    { id: 'seed1', question: 'Do you avoid difficult tasks often?', response_value: 1 },
  ];
  const res = runAdaptiveSelection({ candidates, priorAnswers });
  ok('dup suppressed', res.rejected_questions.some((r) => r.id === 'q-dup'));
  ok('fresh question accepted', res.ordered_questions.some((q) => q.id === 'q-anx'));
  ok('next_question prefers new evidence', res.next_question?.id === 'q-anx');
  ok('not done below min with candidates', res.done === false);
}
{
  // graceful degradation: empty answers, empty pool → done, no throw
  const res = runAdaptiveSelection({ candidates: [], priorAnswers: [] });
  ok('empty pool → done', res.done === true && res.stop_reason === 'no_more_questions');
}

console.log(`\nAll ${passed} adaptive-pipeline assertions passed.`);
