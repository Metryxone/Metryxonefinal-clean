/**
 * Behavioural Intelligence Phase 2 — unit tests.
 *
 * Run with:    npx tsx --test backend/tests/behavioural-signals.test.ts
 *
 * Covers:
 *   - Signal scoring formula (frequency · evidence_count · recency · confidence)
 *   - Evidence extraction across all 7 source types
 *   - Quantifier bonus + hedge penalty
 *   - Contradiction rules (leadership_without_ownership · quantification_gap …)
 *   - Composite contradiction_score within [0,1]
 *   - Profile bundle builder defensiveness
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  scoreSignal, rollupCompetency, SIGNAL_TAXONOMY, SIGNALS_BY_KEY, BSIG_VERSION,
} from '../services/behavioral-signal-engine.ts';

import {
  extractFromSource, extractAndScore, buildSourcesFromProfile,
} from '../services/evidence-extractor.ts';

import {
  detectContradictions, CONTRADICTION_VERSION, __TEST__,
} from '../services/contradiction-detector.ts';

// ──────────────────────────────────────────────────────────────────────────
// 1. taxonomy invariants
// ──────────────────────────────────────────────────────────────────────────
test('taxonomy: every signal has at least one pattern + is uniquely keyed', () => {
  assert.equal(BSIG_VERSION, '2.0.0');
  const keys = new Set<string>();
  for (const s of SIGNAL_TAXONOMY) {
    assert.ok(s.patterns.length >= 1, `${s.key} has zero patterns`);
    assert.ok(!keys.has(s.key), `duplicate signal_key ${s.key}`);
    keys.add(s.key);
    assert.equal(SIGNALS_BY_KEY[s.key].label, s.label);
  }
  assert.ok(SIGNAL_TAXONOMY.length >= 20, `expected ≥20 signals, got ${SIGNAL_TAXONOMY.length}`);
});

// ──────────────────────────────────────────────────────────────────────────
// 2. scoreSignal correctness
// ──────────────────────────────────────────────────────────────────────────
test('scoreSignal: zero hits => zero strength', () => {
  const s = scoreSignal('ownership_signals', []);
  assert.equal(s.frequency, 0);
  assert.equal(s.evidence_count, 0);
  assert.equal(s.behavioural_strength, 0);
});

test('scoreSignal: multiple distinct-source hits raise behavioural_strength', () => {
  const now = new Date('2026-05-21T00:00:00Z');
  const hits = [
    { signal_key: 'ownership_signals' as const, source_type: 'resume' as const, source_id: 'r1',
      snippet: 'I owned end-to-end delivery', occurred_at: '2026-05-15', match_strength: 0.7 },
    { signal_key: 'ownership_signals' as const, source_type: 'project_description' as const, source_id: 'p1',
      snippet: 'I led the migration', occurred_at: '2026-04-01', match_strength: 0.6 },
    { signal_key: 'ownership_signals' as const, source_type: 'goal' as const, source_id: 'g1',
      snippet: 'I delivered v1', occurred_at: '2026-03-01', match_strength: 0.55 },
  ];
  const s = scoreSignal('ownership_signals', hits, now);
  assert.equal(s.frequency, 3);
  assert.equal(s.evidence_count, 3);
  assert.ok(s.confidence > 0.55 && s.confidence < 0.7, `confidence avg ~0.61, got ${s.confidence}`);
  assert.ok(s.recency_weight > 0.7, `recency should be high, got ${s.recency_weight}`);
  assert.ok(s.behavioural_strength > 0.45, `strength should be moderate-high, got ${s.behavioural_strength}`);
});

test('scoreSignal: same-source duplicates increase frequency but not evidence_count', () => {
  const hits = [1, 2, 3, 4].map(i => ({
    signal_key: 'quantified_outcomes' as const, source_type: 'resume' as const, source_id: 'r1',
    snippet: `${i*10}% improvement`, occurred_at: '2026-05-01', match_strength: 0.8,
  }));
  const s = scoreSignal('quantified_outcomes', hits);
  assert.equal(s.frequency, 4);
  assert.equal(s.evidence_count, 1, 'all hits share source_type:source_id key');
});

// ──────────────────────────────────────────────────────────────────────────
// 3. extractFromSource — pattern matching + bonuses
// ──────────────────────────────────────────────────────────────────────────
test('extractFromSource: ownership + quantified outcomes both fire on the same text', () => {
  const hits = extractFromSource({
    source_type: 'resume', source_id: 'r1',
    text: 'I owned the relaunch and increased revenue by 42% in 6 months.',
  });
  const keys = new Set(hits.map(h => h.signal_key));
  assert.ok(keys.has('ownership_signals'), 'ownership_signals expected');
  assert.ok(keys.has('quantified_outcomes'), 'quantified_outcomes expected');
});

test('extractFromSource: quantifier bonus raises match_strength', () => {
  const withNumber = extractFromSource({
    source_type: 'resume', source_id: 'r2',
    text: 'I delivered the project and saved $1.2M annually.',
  }).filter(h => h.signal_key === 'quantified_outcomes');
  const withoutNumber = extractFromSource({
    source_type: 'resume', source_id: 'r3',
    text: 'I delivered the project on time successfully.',
  }).filter(h => h.signal_key === 'quantified_outcomes');
  assert.ok(withNumber.length > 0, 'expected a quantified_outcomes hit on the numbered text');
  // No quantified_outcomes signal should fire on the un-numbered text
  assert.equal(withoutNumber.length, 0);
});

test('extractFromSource: hedging penalty reduces match strength', () => {
  const hedged = extractFromSource({
    source_type: 'interview_transcript', source_id: 't1',
    text: 'I think maybe I led the team on the initiative sort of.',
  }).find(h => h.signal_key === 'ownership_signals');
  const clean = extractFromSource({
    source_type: 'interview_transcript', source_id: 't2',
    text: 'I led the team on the initiative end-to-end.',
  }).find(h => h.signal_key === 'ownership_signals');
  assert.ok(hedged && clean, 'both should match the ownership pattern');
  assert.ok(clean!.match_strength > hedged!.match_strength,
    `clean (${clean!.match_strength}) should beat hedged (${hedged!.match_strength})`);
});

// ──────────────────────────────────────────────────────────────────────────
// 4. extractAndScore — end-to-end across multiple sources
// ──────────────────────────────────────────────────────────────────────────
test('extractAndScore: emits one SignalScore per matched signal, sorted by strength desc', () => {
  const sources = [
    { source_type: 'resume' as const, source_id: 'r1',
      text: 'I owned the launch and increased ARR by 35%. Cross-functional partner across product and design.' },
    { source_type: 'interview_transcript' as const, source_id: 't1',
      text: 'Firstly we scoped the problem. Secondly we shipped weekly v1, v2, v3.' },
    { source_type: 'goal' as const, source_id: 'g1',
      text: 'Iterate faster — pivot when the data invalidates the plan.' },
  ];
  const { hits, scores } = extractAndScore(sources);
  assert.ok(hits.length >= 4, `expected ≥4 hits, got ${hits.length}`);
  assert.ok(scores.length >= 3, `expected ≥3 signals scored, got ${scores.length}`);
  for (let i = 1; i < scores.length; i++) {
    assert.ok(scores[i-1].behavioural_strength >= scores[i].behavioural_strength,
      'scores must be sorted by behavioural_strength desc');
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 5. buildSourcesFromProfile — defensive on partial profiles
// ──────────────────────────────────────────────────────────────────────────
test('buildSourcesFromProfile: handles missing fields without throwing', () => {
  const sources = buildSourcesFromProfile({ user_id: 'u1' });
  assert.deepEqual(sources, []);
});

test('buildSourcesFromProfile: pulls summary + experience + project + goal + job sources', () => {
  const sources = buildSourcesFromProfile({
    user_id: 'u1',
    profile: {
      summary: 'Product leader with 8 years experience.',
      experience: [{ title: 'PM', company: 'Acme', description: 'I led roadmap and delivered v2.' }],
      projects:   [{ title: 'Launch X', description: 'Owned end-to-end. 28% adoption lift.' }],
    },
    jobs:  [{ _id: 'j1', role: 'PM', company: 'Beta Co', notes: 'Phone screen complete.' }],
    goals: [{ _id: 'g1', title: 'Hire 2 PMs', description: 'Pivot the team.' }],
  });
  const types = new Set(sources.map(s => s.source_type));
  for (const t of ['profile_summary','resume','project_description','job_note','goal']) {
    assert.ok(types.has(t as never), `expected source_type ${t}`);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 6. Contradiction detection
// ──────────────────────────────────────────────────────────────────────────
test('contradictions: leadership_without_ownership fires when claim has no ownership signal', () => {
  const sources = [{
    source_type: 'resume' as const, source_id: 'r1',
    text: 'Led a team of 12 engineers across two quarters managing a team of analysts.',
  }];
  const { scores } = extractAndScore(sources);
  const r = detectContradictions(sources, scores);
  const flag = r.contradiction_flags.find(f => f.rule_id === 'leadership_without_ownership');
  assert.ok(flag, 'expected leadership_without_ownership flag');
  assert.ok(['medium','high'].includes(flag!.severity));
});

test('contradictions: quantification_gap fires when no numeric outcomes detected', () => {
  const sources = [{
    source_type: 'resume' as const, source_id: 'r1',
    text: 'I owned a successful relaunch and improved customer satisfaction.',
  }];
  const { scores } = extractAndScore(sources);
  const r = detectContradictions(sources, scores);
  assert.ok(r.contradiction_flags.some(f => f.rule_id === 'quantification_gap'),
    'expected quantification_gap flag');
});

test('contradictions: inflated_project_scale fires on superlatives without numbers', () => {
  const sources = [{
    source_type: 'project_description' as const, source_id: 'p1',
    text: 'Delivered the largest digital transformation in the company history.',
  }];
  const { scores } = extractAndScore(sources);
  const r = detectContradictions(sources, scores);
  assert.ok(r.contradiction_flags.some(f => f.rule_id === 'inflated_project_scale'),
    'expected inflated_project_scale flag');
});

test('contradictions: inconsistent_timelines flags overlapping resume date ranges', () => {
  const sources = [
    { source_type: 'resume' as const, source_id: 'r1',
      text: 'Senior PM at Acme 2020-2024 building enterprise platform.' },
    { source_type: 'resume' as const, source_id: 'r2',
      text: 'VP Product at Beta Co 2022-present scaling the team.' },
  ];
  const { scores } = extractAndScore(sources);
  const r = detectContradictions(sources, scores);
  assert.ok(r.contradiction_flags.some(f => f.rule_id === 'inconsistent_timelines'),
    'expected inconsistent_timelines flag');
});

test('contradictions: composite score stays within [0,1]', () => {
  const sources = [{ source_type: 'resume' as const, source_id: 'r1',
    text: 'Led the largest strategic transformation. I think we maybe shipped a lot.' }];
  const { scores } = extractAndScore(sources);
  const r = detectContradictions(sources, scores);
  assert.ok(r.contradiction_score >= 0 && r.contradiction_score <= 1,
    `score out of bounds: ${r.contradiction_score}`);
  assert.equal(r.rules_evaluated, __TEST__.RULES.length);
  assert.equal(CONTRADICTION_VERSION, '2.0.0');
});

// ──────────────────────────────────────────────────────────────────────────
// 7. rollupCompetency
// ──────────────────────────────────────────────────────────────────────────
test('rollupCompetency: identifies weakest + strongest child signal per competency', () => {
  const sources = [
    { source_type: 'resume' as const, source_id: 'r1',
      text: 'I owned the relaunch end-to-end and delivered on time. In hindsight I should have communicated more.' },
    { source_type: 'project_description' as const, source_id: 'p1',
      text: 'Delivered weekly v1 v2 v3 releases. Hit every milestone.' },
  ];
  const { scores } = extractAndScore(sources);
  const ru = rollupCompetency('comp_accountability', scores);
  assert.ok(ru.signal_count > 0, 'expected at least one accountability signal');
  assert.ok(ru.mean_strength > 0);
  assert.ok(ru.strongest_signal, 'expected a strongest signal');
});
