/**
 * Phase 6A — Runtime Intelligence Pipeline resolver tests. Run: `npx tsx`.
 * Covers the pure assembler (hop ordering, resolved flags, caps, degradation)
 * plus a live read-only smoke against a real session that has activated signals.
 */
import assert from 'node:assert';
import { Pool } from 'pg';
import {
  assemblePipeline,
  buildPipelineForSession,
  type PipelineSignal,
  type CapabilityProblem,
} from '../services/pil/pipeline-resolver';
import type { GuidanceBundle, ConcernResolution } from '../services/pil/runtime-guidance-engine';

let passed = 0;
function t(name: string, fn: () => void) {
  try { fn(); console.log('  \u2713', name); passed++; }
  catch (e) { console.log('  \u2717', name); throw e; }
}

const fullResolution: ConcernResolution = {
  concern_id: 'CONCERN_LEA_602', archetype_key: 'performance_anxiety',
  archetype_name: 'Performance Anxiety', method: 'master_pk', confidence: 1,
};

function fullGuidance(): GuidanceBundle {
  return {
    enabled: true, degraded: false, reason: null, stakeholder: 'student',
    resolution: fullResolution,
    archetype: { key: 'performance_anxiety', name: 'Performance Anxiety' },
    human_problems: [{ voice: 'student', problem_statement: 'freezes before exams' }],
    behaviours: [
      { behavior_statement: 'avoids speaking up', behavior_category: 'avoidance' },
      { behavior_statement: 'over-prepares', behavior_category: null },
    ],
    search_intents: [{ intent_type: 'informational', search_phrase: 'how to calm exam nerves' }],
    interventions: [{ intervention_type: 'immediate_actions', intervention_text: 'box breathing' }],
    action_plan: { plan_title: 'Calm', total_days: 30, step_immediate: 'breathe', step_week: null, step_month: null, step_quarter: null } as any,
    growth_pathway: { summary: 'steadier under pressure', stages: null, stage_count: 3 },
  };
}

const signals: PipelineSignal[] = [
  { signal_key: 'perf_anx', signal_type: 'activated', lifecycle_state: 'dominant', severity: 'high', strength: 0.9, confidence: 0.8, evidence_count: 3, description: null },
  { signal_key: 'avoid', signal_type: 'activated', lifecycle_state: 'active', severity: 'moderate', strength: 0.6, confidence: 0.7, evidence_count: 2, description: null },
];
const capProblem: CapabilityProblem = {
  capability_name: 'Perform Under Pressure', problem_name: 'Performance Anxiety',
  confidence_score: 0.8, mapping_reason: 'within-row',
};

console.log('assemblePipeline — full chain');
t('produces 7 ordered hops, all resolved', () => {
  const r = assemblePipeline({
    sessionId: 'S1', stakeholder: 'student', resolution: fullResolution,
    signals, concernMeta: { concern_id: 'CONCERN_LEA_602', domain: 'Learning', concern_cluster: 'Exams', display_label: 'Exam Performance Anxiety' },
    concernName: 'Performance Anxiety', capabilityProblem: capProblem, guidance: fullGuidance(),
    generatedAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(r.hops.length, 7);
  assert.deepEqual(r.hops.map((h) => h.step), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(r.hops.map((h) => h.key), [
    'response_to_signal', 'signal_to_concern', 'concern_to_capability',
    'capability_to_problem', 'problem_to_behavior', 'behavior_to_archetype',
    'archetype_to_intervention',
  ]);
  assert.ok(r.hops.every((h) => h.resolved), 'all hops resolved');
  assert.equal(r.degraded, false);
  assert.equal(r.generated_at, '2026-01-01T00:00:00.000Z'); // deterministic when provided
});

t('deterministic: same inputs → identical output', () => {
  const a = assemblePipeline({ sessionId: 'S1', stakeholder: 'student', resolution: fullResolution, signals, concernMeta: null, concernName: 'Performance Anxiety', capabilityProblem: capProblem, guidance: fullGuidance(), generatedAt: 'T' });
  const b = assemblePipeline({ sessionId: 'S1', stakeholder: 'student', resolution: fullResolution, signals, concernMeta: null, concernName: 'Performance Anxiety', capabilityProblem: capProblem, guidance: fullGuidance(), generatedAt: 'T' });
  assert.deepEqual(a, b);
});

console.log('assemblePipeline — caps + degradation');
t('signals capped at 8', () => {
  const many: PipelineSignal[] = Array.from({ length: 12 }, (_, i) => ({
    signal_key: `s${i}`, signal_type: 'activated', lifecycle_state: 'active', severity: 'low', strength: 0.5, confidence: 0.5, evidence_count: 1, description: null,
  }));
  const r = assemblePipeline({ sessionId: 'S1', stakeholder: 'student', resolution: fullResolution, signals: many, concernMeta: null, concernName: 'x', capabilityProblem: capProblem, guidance: fullGuidance() });
  const hop1: any = r.hops[0].data;
  assert.equal(hop1.signals.length, 8);   // capped
  assert.equal(hop1.total, 12);           // honest total preserved
});

t('no concern resolved → degraded, front hops only', () => {
  const noConcern: ConcernResolution = { concern_id: null, archetype_key: null, archetype_name: null, method: 'none', confidence: 0 };
  const g: GuidanceBundle = { ...fullGuidance(), degraded: true, reason: 'concern_not_resolved', resolution: noConcern, archetype: null, behaviours: [], interventions: [], action_plan: null, human_problems: [], search_intents: [], growth_pathway: null };
  const r = assemblePipeline({ sessionId: 'S1', stakeholder: 'student', resolution: noConcern, signals, concernMeta: null, concernName: null, capabilityProblem: null, guidance: g });
  assert.equal(r.degraded, true);
  assert.equal(r.reason, 'concern_not_resolved');
  assert.equal(r.hops[0].resolved, true);   // signals still surfaced
  assert.equal(r.hops[1].resolved, false);  // concern unresolved
  assert.equal(r.hops[6].resolved, false);  // no interventions
});

t('partial: concern + behaviours but no capability map → degraded but rich', () => {
  const g = fullGuidance();
  const r = assemblePipeline({ sessionId: 'S1', stakeholder: 'student', resolution: fullResolution, signals, concernMeta: null, concernName: 'Performance Anxiety', capabilityProblem: null, guidance: g });
  assert.equal(r.hops[2].resolved, false);  // no capability
  assert.equal(r.hops[3].resolved, false);  // no problem
  assert.equal(r.hops[4].resolved, true);   // behaviours still present
  assert.equal(r.hops[5].resolved, true);   // archetype still present
  assert.equal(r.degraded, true);           // ANY unresolved hop degrades honestly
  assert.equal(r.reason, 'partial_chain');
});

t('empty signals (broken front hop) → degraded even with full back half', () => {
  const r = assemblePipeline({ sessionId: 'S1', stakeholder: 'student', resolution: fullResolution, signals: [], concernMeta: null, concernName: 'Performance Anxiety', capabilityProblem: capProblem, guidance: fullGuidance() });
  assert.equal(r.hops[0].resolved, false);  // no signals
  assert.equal(r.degraded, true);           // front of chain broken → degraded
});

(async () => {
  console.log('live smoke');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query(
      `SELECT session_id FROM capadex_session_signals WHERE lifecycle_state IS NOT NULL
       GROUP BY session_id ORDER BY count(*) DESC LIMIT 1`,
    );
    if (!rows.length) { console.log('  (no session with signals; skipping live smoke)'); }
    else {
      const sid = String(rows[0].session_id);
      const r = await buildPipelineForSession(pool, sid);
      assert.equal(r.hops.length, 7);
      assert.equal(r.session_id, sid);
      assert.ok(r.hops[0].resolved, 'live session has activated signals');
      const s: any = r.hops[0].data;
      console.log(`    session=${sid.slice(0, 8)} signals=${s.total} degraded=${r.degraded} archetype=${(r.resolution.archetype_name) ?? 'none'}`);
      passed++;
    }
  } finally { await pool.end(); }
  console.log(`\n${passed} assertions passed`);
})().catch((e) => { console.error(e); process.exit(1); });
