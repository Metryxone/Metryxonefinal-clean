/**
 * Phase 6B stakeholder-summary-engine — pure builder tests (no DB).
 * Run: npx tsx backend/tests/stakeholder-summary-engine.test.ts
 */
import assert from 'node:assert';
import {
  buildStudentSummary,
  buildParentSummary,
  buildCounselorSummary,
  assembleExplainability,
  isStakeholderLens,
  type StakeholderSummary,
} from '../services/pil/stakeholder-summary-engine';
import type { GuidanceBundle } from '../services/pil/runtime-guidance-engine';
import type { PipelineResult, PipelineHop } from '../services/pil/pipeline-resolver';
import type { StrengthProfile } from '../services/strength-discovery-engine';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
function guidance(over: Partial<GuidanceBundle> = {}): GuidanceBundle {
  return {
    enabled: true,
    degraded: false,
    reason: null,
    stakeholder: 'student',
    resolution: { concern_id: 'CONCERN_COM_65', archetype_key: 'performance_anxiety', archetype_name: 'Performance Anxiety', method: 'master_pk', confidence: 0.9 },
    archetype: { key: 'performance_anxiety', name: 'Performance Anxiety' },
    human_problems: [{ voice: 'student', problem_statement: 'I freeze before presentations.' }],
    behaviours: [{ behavior_statement: 'Avoids speaking up in groups.', behavior_category: 'social' }],
    search_intents: [{ intent_type: 'how_to', search_phrase: 'manage presentation nerves' }],
    interventions: [
      { type: 'immediate_actions', text: 'Try a 2-minute breathing reset.' },
      { type: 'habit_building', text: 'Practise one small talk daily.' },
    ],
    action_plan: { plan_title: 'Calm Under Pressure', step_immediate: 'Breathe before you speak.', step_week: 'Rehearse aloud 3x.', step_month: 'Volunteer for one presentation.', step_quarter: 'Lead a group session.', total_days: 90 },
    growth_pathway: { summary: 'You can grow into a confident communicator.', stages: null, stage_count: 4 },
    ...over,
  };
}

function hop(over: Partial<PipelineHop> & { key: PipelineHop['key'] }): PipelineHop {
  return { step: 1, label: 'x', resolved: true, summary: 's', data: null, ...over };
}

function pipeline(over: Partial<PipelineResult> = {}): PipelineResult {
  const hops: PipelineHop[] = [
    hop({ step: 1, key: 'response_to_signal', label: 'Response → Signal', data: { signals: [
      { signal_key: 'emotional_overload', signal_type: 'emotional', lifecycle_state: 'dominant', severity: 'high', strength: 0.8, confidence: 0.9, evidence_count: 3, description: 'Emotional overload detected.' },
      { signal_key: 'GENERAL_CONCERN', signal_type: 'general', lifecycle_state: 'active', severity: 'low', strength: 0.2, confidence: 0.3, evidence_count: 1, description: 'general' },
    ], total: 2 } }),
    hop({ step: 2, key: 'signal_to_concern', label: 'Signal → Concern', data: { concern_id: 'CONCERN_COM_65', concern_label: 'Anxiety & Overthinking' } }),
    hop({ step: 3, key: 'concern_to_capability', label: 'Concern → Capability' }),
    hop({ step: 4, key: 'capability_to_problem', label: 'Capability → Problem' }),
    hop({ step: 5, key: 'problem_to_behavior', label: 'Problem → Behavior' }),
    hop({ step: 6, key: 'behavior_to_archetype', label: 'Behavior → Archetype' }),
    hop({ step: 7, key: 'archetype_to_intervention', label: 'Archetype → Intervention' }),
  ];
  return {
    enabled: true, degraded: false, reason: null, session_id: 'sess-1',
    generated_at: '2026-06-03T00:00:00.000Z', stakeholder: 'student',
    resolution: { concern_id: 'CONCERN_COM_65', archetype_key: 'performance_anxiety', archetype_name: 'Performance Anxiety', method: 'master_pk', confidence: 0.9 },
    hops, ...over,
  };
}

function strengths(items: string[] = []): StrengthProfile {
  return {
    generated_at: '2026-06-03T00:00:00.000Z',
    scope: { email: 'x@y.z', session_id: 'sess-1' },
    strengths: items.map((l) => ({ label: l, evidence: `${l} evidence`, source: 'csi_positive_factors' as const, confidence: 0.8 })),
    resilience: [], coping: [], success_patterns: [], sources: items.length ? ['csi_positive_factors'] : [],
  };
}

const titles = (s: StakeholderSummary) => s.sections.map((x) => x.title);

// ── Student ──────────────────────────────────────────────────────────────────
test('student: 6 ordered sections', () => {
  const s = buildStudentSummary(guidance(), pipeline());
  assert.deepStrictEqual(titles(s), ['Top Archetypes', 'Key Problems', 'Emotional Indicators', 'Immediate Actions', '7-Day Actions', 'Growth Opportunities']);
});

test('student: emotional indicators drop GENERAL_CONCERN', () => {
  const s = buildStudentSummary(guidance(), pipeline());
  const sec = s.sections.find((x) => x.key === 'emotional_indicators')!;
  assert.strictEqual(sec.items.length, 1);
  assert.match(sec.items[0].label!, /Emotional Overload/);
});

test('student: deterministic (same input → same output)', () => {
  const a = JSON.stringify(buildStudentSummary(guidance(), pipeline()));
  const b = JSON.stringify(buildStudentSummary(guidance(), pipeline()));
  assert.strictEqual(a, b);
});

// ── Parent ───────────────────────────────────────────────────────────────────
test('parent: 4 ordered sections', () => {
  const s = buildParentSummary(guidance(), pipeline(), strengths(['Curiosity']));
  assert.deepStrictEqual(titles(s), ['Child Strengths', 'Growth Areas', 'Home Support Actions', 'Intervention Suggestions']);
});

test('parent: strengths sourced ONLY from strength profile', () => {
  const s = buildParentSummary(guidance(), pipeline(), strengths(['Curiosity', 'Persistence']));
  const sec = s.sections.find((x) => x.key === 'child_strengths')!;
  assert.deepStrictEqual(sec.items.map((i) => i.text), ['Curiosity', 'Persistence']);
});

test('parent: empty strengths → honest note, never fabricated from signals', () => {
  const s = buildParentSummary(guidance(), pipeline(), null);
  const sec = s.sections.find((x) => x.key === 'child_strengths')!;
  assert.strictEqual(sec.items.length, 0);
  assert.ok(sec.note && sec.note.length > 0);
  // canon: no signal label (e.g. "Emotional Overload") leaks into strengths
  assert.ok(!JSON.stringify(sec).includes('Emotional'));
});

// ── Counselor ────────────────────────────────────────────────────────────────
test('counselor: 4 ordered sections', () => {
  const s = buildCounselorSummary(guidance(), pipeline());
  assert.deepStrictEqual(titles(s), ['Priority Risks', 'Priority Interventions', 'Recommended Follow-Ups', 'Progress Monitoring']);
});

test('counselor: priority risks severity-ranked high first', () => {
  const s = buildCounselorSummary(guidance(), pipeline());
  const sec = s.sections.find((x) => x.key === 'priority_risks')!;
  assert.strictEqual(sec.items[0].severity, 'high');
});

test('counselor: priority risks exclude suppressed/non-actionable lifecycle states', () => {
  const p = pipeline({
    hops: pipeline().hops.map((h) =>
      h.key === 'response_to_signal'
        ? hop({ step: 1, key: 'response_to_signal', label: 'Response → Signal', data: { signals: [
            { signal_key: 'emotional_overload', signal_type: 'emotional', lifecycle_state: 'dominant', severity: 'high', strength: 0.8, confidence: 0.9, evidence_count: 3, description: 'Emotional overload detected.' },
            { signal_key: 'avoidance_pattern', signal_type: 'behavioral', lifecycle_state: 'active', severity: 'moderate', strength: 0.5, confidence: 0.7, evidence_count: 2, description: 'Avoidance pattern.' },
            { signal_key: 'suppressed_doubt', signal_type: 'cognitive', lifecycle_state: 'suppressed', severity: 'high', strength: 0.9, confidence: 0.9, evidence_count: 4, description: 'Suppressed by contradiction.' },
            { signal_key: 'weak_focus', signal_type: 'cognitive', lifecycle_state: 'weakened', severity: 'high', strength: 0.9, confidence: 0.9, evidence_count: 4, description: 'Weakened.' },
            { signal_key: 'no_state', signal_type: 'cognitive', lifecycle_state: null, severity: 'high', strength: 0.9, confidence: 0.9, evidence_count: 4, description: 'Missing lifecycle.' },
          ], total: 5 } })
        : h),
  });
  const s = buildCounselorSummary(guidance(), p);
  const sec = s.sections.find((x) => x.key === 'priority_risks')!;
  const labels = sec.items.map((i) => i.label);
  assert.strictEqual(sec.items.length, 2, 'only active/dominant signals are risks');
  assert.ok(labels.some((l) => /Emotional Overload/.test(l!)));
  assert.ok(labels.some((l) => /Avoidance Pattern/.test(l!)));
  // canon: suppressed/weakened/missing-lifecycle high-severity rows must NOT surface
  assert.ok(!JSON.stringify(sec).includes('Suppressed'));
  assert.ok(!JSON.stringify(sec).includes('Weakened'));
  assert.ok(!JSON.stringify(sec).includes('Missing lifecycle'));
});

// ── Explainability ───────────────────────────────────────────────────────────
test('explainability: every recommendation has a non-empty why chain', () => {
  const e = assembleExplainability(guidance(), pipeline());
  assert.ok(e.recommendations.length > 0);
  for (const r of e.recommendations) assert.ok(r.why.length > 0, 'recommendation missing why');
  assert.strictEqual(e.lineage.length, 7);
});

test('explainability: why only contains resolved hops', () => {
  const p = pipeline();
  p.hops[2].resolved = false; // concern_to_capability unresolved
  const e = assembleExplainability(guidance(), p);
  const steps = e.recommendations[0].why.map((w) => w.step);
  assert.ok(!steps.includes(3));
});

// ── Degradation ──────────────────────────────────────────────────────────────
test('degraded guidance propagates; sections still present with notes', () => {
  const g = guidance({ degraded: true, reason: 'concern_not_resolved', archetype: null, human_problems: [], behaviours: [], interventions: [], action_plan: null, growth_pathway: null });
  const s = buildStudentSummary(g, pipeline({ degraded: true, reason: 'concern_not_resolved' }));
  assert.strictEqual(s.degraded, true);
  assert.strictEqual(s.sections.length, 6);
  assert.ok(s.sections.every((sec) => sec.items.length > 0 || (sec.note && sec.note.length > 0)));
});

// ── Guard ────────────────────────────────────────────────────────────────────
test('isStakeholderLens guard', () => {
  assert.ok(isStakeholderLens('student') && isStakeholderLens('parent') && isStakeholderLens('counselor'));
  assert.ok(!isStakeholderLens('teacher') && !isStakeholderLens('') && !isStakeholderLens(null));
});

console.log(`\n${passed} assertions/tests passed.`);
