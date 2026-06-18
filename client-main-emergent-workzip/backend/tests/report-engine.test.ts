/**
 * CAPADEX Phase 6C — report engines (section / explainability / builder) pure tests.
 * Run: npx tsx backend/tests/report-engine.test.ts
 */
import assert from 'node:assert';
import type { GuidanceBundle } from '../services/pil/runtime-guidance-engine';
import type { PipelineResult, PipelineHop } from '../services/pil/pipeline-resolver';
import type { StrengthProfile } from '../services/strength-discovery-engine';
import {
  buildStudentSummary,
  buildParentSummary,
  buildCounselorSummary,
} from '../services/pil/stakeholder-summary-engine';
import {
  buildStudentReportSections,
  buildParentReportSections,
  buildCounselorReportSections,
} from '../services/pil/report-section-engine';
import { attachExplainability } from '../services/pil/report-explainability-engine';
import { computeReadiness, assembleInstitutionReport } from '../services/pil/report-builder';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
function guidance(over: Partial<GuidanceBundle> = {}): GuidanceBundle {
  return {
    enabled: true, degraded: false, reason: null, stakeholder: 'student',
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
    growth_pathway: { summary: 'Builds steady public-speaking confidence.' },
    ...over,
  } as GuidanceBundle;
}

function hop(step: number, key: PipelineHop['key'], resolved: boolean, data: unknown = {}): PipelineHop {
  const labels: Record<string, string> = {
    response_to_signal: 'Response → Signal', signal_to_concern: 'Signal → Concern',
    concern_to_capability: 'Concern → Capability', capability_to_problem: 'Capability → Problem',
    problem_to_behavior: 'Problem → Behavior', behavior_to_archetype: 'Behavior → Archetype',
    archetype_to_intervention: 'Archetype → Intervention',
  };
  return { step, key, label: labels[key], resolved, summary: `${labels[key]} ${resolved ? 'resolved' : 'unresolved'}`, data };
}

function pipeline(over: Partial<PipelineResult> = {}, allResolved = true): PipelineResult {
  return {
    enabled: true, degraded: !allResolved, reason: allResolved ? null : 'partial_chain',
    session_id: 's-1', generated_at: '2026-06-03T00:00:00.000Z',
    stakeholder: 'student' as never,
    resolution: { concern_id: 'CONCERN_COM_65', archetype_key: 'performance_anxiety', archetype_name: 'Performance Anxiety', method: 'master_pk', confidence: 0.9 } as never,
    hops: [
      hop(1, 'response_to_signal', true, { signals: [
        { signal_key: 'fear_of_failure', signal_type: 'emotional', lifecycle_state: 'active', severity: 'high', strength: 0.8, confidence: 0.9, evidence_count: 3, description: 'Fear of failing in front of others.' },
        { signal_key: 'avoidance', signal_type: 'behavioural', lifecycle_state: 'suppressed', severity: 'moderate', strength: 0.5, confidence: 0.7, evidence_count: 2, description: 'Avoids exposure situations.' },
      ] }),
      hop(2, 'signal_to_concern', true, { concern_label: 'Long-Term Career Anxiety' }),
      hop(3, 'concern_to_capability', allResolved, {}),
      hop(4, 'capability_to_problem', allResolved, {}),
      hop(5, 'problem_to_behavior', allResolved, {}),
      hop(6, 'behavior_to_archetype', true, {}),
      hop(7, 'archetype_to_intervention', true, {}),
    ],
    ...over,
  };
}

function strengths(over: Partial<StrengthProfile> = {}): StrengthProfile {
  return {
    generated_at: '2026-06-03T00:00:00.000Z',
    scope: { email: null, session_id: 's-1' },
    strengths: [{ label: 'Consistent effort', evidence: 'High persistence factor', source: 'csi_positive_factors', confidence: 0.82 }],
    resilience: [{ label: 'Recovers after setbacks', evidence: 'Longitudinal resilience trend', source: 'longitudinal_resilience', confidence: 0.7 }],
    coping: [], success_patterns: [], sources: ['csi_positive_factors', 'longitudinal_resilience'],
    ...over,
  };
}

// ── Section-engine tests ─────────────────────────────────────────────────────
const STUDENT_KEYS = ['strengths', 'growth_areas', 'top_archetypes', 'emotional_indicators', 'immediate_actions', 'seven_day_plan', 'development_roadmap'];
const PARENT_KEYS = ['child_strengths', 'development_opportunities', 'home_support_actions', 'suggested_conversations', 'parent_guidance'];
const COUNSELOR_KEYS = ['priority_risks', 'priority_interventions', 'follow_up_recommendations', 'monitoring_guidance'];

test('student report sections — exact spec keys in order', () => {
  const secs = buildStudentReportSections(buildStudentSummary(guidance(), pipeline()), strengths());
  assert.deepStrictEqual(secs.map((s) => s.key), STUDENT_KEYS);
});

test('parent report sections — exact spec keys in order', () => {
  const secs = buildParentReportSections(buildParentSummary(guidance(), pipeline(), strengths()), guidance());
  assert.deepStrictEqual(secs.map((s) => s.key), PARENT_KEYS);
});

test('counselor report sections — exact spec keys in order', () => {
  const secs = buildCounselorReportSections(buildCounselorSummary(guidance(), pipeline()));
  assert.deepStrictEqual(secs.map((s) => s.key), COUNSELOR_KEYS);
});

test('student Strengths come from strength profile, carry self_trace', () => {
  const secs = buildStudentReportSections(buildStudentSummary(guidance(), pipeline()), strengths());
  const str = secs.find((s) => s.key === 'strengths')!;
  assert.ok(str.items.length >= 2, 'has strength rows');
  assert.ok(str.items.every((i) => i.self_trace && i.self_trace.length), 'every strength carries a self_trace');
});

test('empty strengths → honest note, never fabricated', () => {
  const empty = strengths({ strengths: [], resilience: [], coping: [], success_patterns: [], sources: [] });
  const secs = buildStudentReportSections(buildStudentSummary(guidance(), pipeline()), empty);
  const str = secs.find((s) => s.key === 'strengths')!;
  assert.strictEqual(str.items.length, 0);
  assert.ok(str.note && /no strength/i.test(str.note));
});

test('counselor Priority Risks exclude suppressed lifecycle (canon)', () => {
  const secs = buildCounselorReportSections(buildCounselorSummary(guidance(), pipeline()));
  const risks = secs.find((s) => s.key === 'priority_risks')!;
  const labels = risks.items.map((i) => (i.label || '').toLowerCase());
  assert.ok(labels.some((l) => l.includes('fear')), 'active signal surfaced');
  assert.ok(!labels.some((l) => l.includes('avoidance')), 'suppressed signal excluded');
});

// ── Explainability-engine tests ──────────────────────────────────────────────
test('fully-resolved pipeline → 100% explainability coverage', () => {
  const secs = buildStudentReportSections(buildStudentSummary(guidance(), pipeline()), strengths());
  const { explainability } = attachExplainability(secs, pipeline().hops);
  assert.strictEqual(explainability.coverage, 1);
  assert.ok(explainability.fully_traceable);
  assert.ok(explainability.total_statements > 0);
});

test('every surfaced statement has ≥1 trace node', () => {
  const secs = buildCounselorReportSections(buildCounselorSummary(guidance(), pipeline()));
  const { sections } = attachExplainability(secs, pipeline().hops);
  for (const s of sections) for (const it of s.items) assert.ok(it.trace.length > 0, `${s.key} item traced`);
});

test('intervention statements trace the full 8-node chain', () => {
  const secs = buildStudentReportSections(buildStudentSummary(guidance(), pipeline()), strengths());
  const { sections } = attachExplainability(secs, pipeline().hops);
  const imm = sections.find((s) => s.key === 'immediate_actions')!;
  assert.ok(imm.items.length > 0);
  assert.strictEqual(imm.items[0].trace.length, 7, 'all 7 hops resolved → full chain');
});

test('degraded chain → traces never include unresolved hops; coverage honest', () => {
  const p = pipeline({}, false); // hops 3,4,5 unresolved
  const resolvedKeys = new Set(p.hops.filter((h) => h.resolved).map((h) => h.key));
  const secs = buildStudentReportSections(buildStudentSummary(guidance(), p), strengths());
  const { explainability, sections } = attachExplainability(secs, p.hops);
  assert.ok(explainability.coverage > 0 && explainability.coverage <= 1);
  // No statement may cite a hop that did not resolve (no fabricated lineage).
  for (const s of sections) for (const it of s.items) {
    for (const t of it.trace) {
      if (t.key === 'signal_to_strength') continue; // strength self-trace (off-chain)
      assert.ok(resolvedKeys.has(t.key), `${s.key} cites only resolved hops`);
    }
  }
  // An intervention statement (anchor step 7) traces only the resolved subset (1,2,6,7).
  const imm = sections.find((s) => s.key === 'immediate_actions')!;
  if (imm.items.length) assert.strictEqual(imm.items[0].trace.length, 4);
});

test('explainability of an empty report is vacuously 1', () => {
  const empty = strengths({ strengths: [], resilience: [], coping: [], success_patterns: [], sources: [] });
  const g = guidance({ human_problems: [], behaviours: [], search_intents: [], interventions: [], action_plan: null, growth_pathway: null, archetype: null });
  const secs = buildStudentReportSections(buildStudentSummary(g, pipeline({ hops: [] })), empty);
  const { explainability } = attachExplainability(secs, []);
  assert.strictEqual(explainability.total_statements, 0);
  assert.strictEqual(explainability.coverage, 1);
});

// ── Readiness-score tests ────────────────────────────────────────────────────
test('readiness score is deterministic and in 0..100', () => {
  const secs = buildStudentReportSections(buildStudentSummary(guidance(), pipeline()), strengths());
  const { sections, explainability } = attachExplainability(secs, pipeline().hops);
  const a = computeReadiness(sections, explainability, false);
  const b = computeReadiness(sections, explainability, false);
  assert.deepStrictEqual(a, b);
  assert.ok(a.score >= 0 && a.score <= 100);
  assert.strictEqual(a.band, 'ready');
});

test('degraded data lowers readiness vs resolved', () => {
  const secs = buildStudentReportSections(buildStudentSummary(guidance(), pipeline()), strengths());
  const { sections, explainability } = attachExplainability(secs, pipeline().hops);
  const ready = computeReadiness(sections, explainability, false).score;
  const degraded = computeReadiness(sections, explainability, true).score;
  assert.ok(degraded < ready);
});

test('degraded readiness never overclaims completeness (honest band + note)', () => {
  const secs = buildStudentReportSections(buildStudentSummary(guidance(), pipeline()), strengths());
  const { sections, explainability } = attachExplainability(secs, pipeline().hops);
  const r = computeReadiness(sections, explainability, true);
  assert.notStrictEqual(r.band, 'ready'); // degraded chain can never read "ready"
  assert.ok(!/complete and fully traceable/.test(r.note));
});

// ── Institution (cohort) tests ───────────────────────────────────────────────
function member(id: string, archKey: string) {
  return {
    session_id: id,
    guidance: guidance({ archetype: { key: archKey, name: archKey.replace(/_/g, ' ') } }),
    pipeline: pipeline(),
    strengths: strengths(),
  };
}

test('institution report — exact cohort section keys + counts', () => {
  const r = assembleInstitutionReport([member('a', 'performance_anxiety'), member('b', 'performance_anxiety'), member('c', 'procrastination')]);
  assert.deepStrictEqual(r.sections.map((s) => s.key), ['cohort_strengths', 'cohort_risks', 'archetype_distribution', 'intervention_opportunities']);
  assert.strictEqual(r.cohort_size, 3);
  const dist = r.sections.find((s) => s.key === 'archetype_distribution')!;
  assert.ok(/2 of 3/.test(dist.items[0].label || ''), 'most common archetype ranked first');
});

test('institution aggregation is deterministic', () => {
  const a = assembleInstitutionReport([member('a', 'x'), member('b', 'y')]);
  const b = assembleInstitutionReport([member('a', 'x'), member('b', 'y')]);
  assert.deepStrictEqual(a.sections, b.sections);
  assert.deepStrictEqual(a.session_ids, ['a', 'b']);
});

test('empty cohort degrades with honest notes, never throws', () => {
  const r = assembleInstitutionReport([]);
  assert.strictEqual(r.cohort_size, 0);
  assert.ok(r.degraded);
  assert.ok(r.sections.every((s) => s.items.length === 0 && s.note));
});

// ── Export-shape tests ───────────────────────────────────────────────────────
test('export shapes: api/print/pdf are present and non-recursive', () => {
  const r = assembleInstitutionReport([member('a', 'performance_anxiety')]);
  assert.ok(Array.isArray(r.exports.pdf_ready) && r.exports.pdf_ready.length > 0);
  assert.strictEqual(typeof r.exports.print_ready, 'string');
  assert.ok(r.exports.print_ready.includes('Institution Cohort Report'));
  assert.ok(!('exports' in (r.exports.api_ready as object)), 'api_ready does not embed exports');
  assert.strictEqual(r.exports.pdf_ready[0].type, 'heading');
});

console.log(`\n${passed} passed`);
