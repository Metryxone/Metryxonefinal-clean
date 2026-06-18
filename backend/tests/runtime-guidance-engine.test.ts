/**
 * Phase 6 — runtime-guidance-engine tests. Run: npx tsx tests/runtime-guidance-engine.test.ts
 * Pure-function coverage (stakeholder mapping, token overlap, bundle assembly)
 * plus a best-effort live smoke against the DB if DATABASE_URL is present.
 */
import assert from 'node:assert';
import {
  mapStakeholder,
  pickByTokenOverlap,
  assembleBundle,
  buildGuidanceForSession,
  type ConcernResolution,
} from '../services/pil/runtime-guidance-engine.js';

let passed = 0;
function t(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${(e as Error).message}`); process.exitCode = 1; }
}

console.log('mapStakeholder');
t('relationship parent_child → parent (even if actor persona says professional)', () => {
  assert.equal(mapStakeholder({ actorPersona: 'PROFESSIONAL', relationshipType: 'parent_child' }), 'parent');
});
t('relationship teacher_student → teacher', () => {
  assert.equal(mapStakeholder({ actorPersona: 'SELF', relationshipType: 'teacher_student' }), 'teacher');
});
t('relationship counsellor_client → counselor', () => {
  assert.equal(mapStakeholder({ relationshipType: 'counsellor_client' }), 'counselor');
});
t('rich professional personas → professional', () => {
  for (const p of ['MID_CAREER_PROFESSIONAL', 'CAREER_TRANSITION_PROFESSIONAL', 'JOBSEEKER', 'MANAGER']) {
    assert.equal(mapStakeholder({ actorPersona: p }), 'professional', p);
  }
});
t('rich student personas → student', () => {
  for (const p of ['SCHOOL_STUDENT', 'CAMPUS_STUDENT', 'COLLEGE_STUDENT', 'LEARNER', 'COMPETITIVE_ASPIRANT']) {
    assert.equal(mapStakeholder({ actorPersona: p }), 'student', p);
  }
});
t('no persona + adult age → professional; child age → student; unknown → student', () => {
  assert.equal(mapStakeholder({ actorPersona: '', age: 30 }), 'professional');
  assert.equal(mapStakeholder({ actorPersona: '', age: 15 }), 'student');
  assert.equal(mapStakeholder({ actorPersona: '', age: null }), 'student');
});

console.log('pickByTokenOverlap');
const mapRows = [
  { archetype_key: 'performance_anxiety', concern_id: 'C1', concern_name: 'Exam Performance Anxiety' },
  { archetype_key: 'time_self_discipline', concern_id: 'C2', concern_name: 'Procrastination and Missed Deadlines' },
];
t('strong overlap matches', () => {
  const r = pickByTokenOverlap('exam performance anxiety', mapRows);
  assert.ok(r && r.row.archetype_key === 'performance_anxiety');
  assert.ok(r!.confidence > 0 && r!.confidence <= 0.7);
});
t('weak/no overlap → null (no mis-route)', () => {
  assert.equal(pickByTokenOverlap('work stress', mapRows), null);
  assert.equal(pickByTokenOverlap('', mapRows), null);
  assert.equal(pickByTokenOverlap('the and of', mapRows), null); // all stopwords
});
t('tie-break is deterministic (stable on concern_id, ignores row order)', () => {
  const tied = [
    { archetype_key: 'zeta', concern_id: 'C9', concern_name: 'Exam Performance Anxiety' },
    { archetype_key: 'alpha', concern_id: 'C2', concern_name: 'Exam Performance Anxiety' },
  ];
  const a = pickByTokenOverlap('exam performance anxiety', tied);
  const b = pickByTokenOverlap('exam performance anxiety', [...tied].reverse());
  assert.ok(a && b);
  assert.equal(a!.row.concern_id, 'C2'); // lexicographically smaller concern_id wins
  assert.equal(a!.row.concern_id, b!.row.concern_id); // order-independent
});

console.log('assembleBundle');
const res: ConcernResolution = {
  concern_id: 'C1', archetype_key: 'performance_anxiety',
  archetype_name: 'Performance Anxiety', method: 'master_pk', confidence: 1,
};
t('degraded when no archetype', () => {
  const b = assembleBundle({
    stakeholder: 'student',
    resolution: { concern_id: null, archetype_key: null, archetype_name: null, method: 'none', confidence: 0 },
    humanProblems: [], behaviours: [], searchIntents: [], interventions: [], actionPlan: null, growthPathway: null,
  });
  assert.equal(b.degraded, true);
  assert.equal(b.reason, 'concern_not_resolved');
  assert.equal(b.archetype, null);
});
t('degraded but preserves partial content (no archetype, concern-level behaviours)', () => {
  const b = assembleBundle({
    stakeholder: 'student',
    resolution: { concern_id: 'C1', archetype_key: null, archetype_name: null, method: 'token_overlap', confidence: 0.5 },
    humanProblems: [], searchIntents: [], interventions: [], actionPlan: null, growthPathway: null,
    behaviours: [{ behavior_statement: 'avoids speaking up', behavior_category: null }],
  });
  assert.equal(b.degraded, true);           // no archetype → still degraded
  assert.equal(b.reason, 'concern_not_resolved');
  assert.equal(b.archetype, null);
  assert.equal(b.behaviours.length, 1);     // but partial content is surfaced, not discarded
});
t('degraded when archetype but no content', () => {
  const b = assembleBundle({
    stakeholder: 'student', resolution: res,
    humanProblems: [], behaviours: [], searchIntents: [], interventions: [], actionPlan: null, growthPathway: null,
  });
  assert.equal(b.degraded, true);
  assert.equal(b.reason, 'no_guidance_content');
});
t('caps + voice ordering + one-best-per-type', () => {
  const b = assembleBundle({
    stakeholder: 'professional', resolution: res,
    humanProblems: [
      { voice: 'student', problem_statement: 's1' },
      { voice: 'general', problem_statement: 'g1' },
      { voice: 'professional', problem_statement: 'p1' },
      { voice: 'professional', problem_statement: 'p2' },
      { voice: 'general', problem_statement: 'g2' },
    ],
    behaviours: Array.from({ length: 9 }, (_, i) => ({ behavior_statement: `b${i}`, behavior_category: null })),
    searchIntents: Array.from({ length: 8 }, (_, i) => ({ intent_type: 'informational', search_phrase: `q${i}` })),
    interventions: [
      { intervention_type: 'thirty_day', intervention_text: '30a' },
      { intervention_type: 'immediate_actions', intervention_text: 'now1' },
      { intervention_type: 'immediate_actions', intervention_text: 'now2' },
    ],
    actionPlan: null, growthPathway: null,
  });
  assert.equal(b.degraded, false);
  assert.equal(b.human_problems.length, 4);
  assert.equal(b.human_problems[0].voice, 'professional'); // reader voice first
  assert.equal(b.behaviours.length, 6);
  assert.equal(b.search_intents.length, 5);
  // immediate_actions ordered before thirty_day; only first text kept per type
  assert.deepEqual(b.interventions.map((i) => i.type), ['immediate_actions', 'thirty_day']);
  assert.equal(b.interventions[0].text, 'now1');
});

async function liveSmoke() {
  if (!process.env.DATABASE_URL) { console.log('live smoke: skipped (no DATABASE_URL)'); return; }
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query(
      `SELECT id FROM capadex_sessions WHERE master_concern_pk IS NOT NULL LIMIT 1`,
    );
    console.log('live smoke');
    if (!rows[0]) { console.log('  (no session with master_concern_pk; skipping)'); return; }
    const b = await buildGuidanceForSession(pool, rows[0].id);
    t('live bundle resolves an archetype with content', () => {
      assert.equal(b.enabled, true);
      assert.ok(b.archetype, 'expected an archetype');
      assert.ok(
        b.human_problems.length + b.interventions.length + b.search_intents.length > 0,
        'expected some guidance content',
      );
    });
    console.log(`    archetype=${b.archetype?.key} stakeholder=${b.stakeholder} method=${b.resolution.method} ` +
      `problems=${b.human_problems.length} behaviours=${b.behaviours.length} ` +
      `intents=${b.search_intents.length} interventions=${b.interventions.length} ` +
      `plan=${!!b.action_plan} pathway=${!!b.growth_pathway}`);
  } finally { await pool.end(); }
}

liveSmoke()
  .catch((e) => { console.error('live smoke error:', (e as Error).message); process.exitCode = 1; })
  .finally(() => { console.log(`\n${passed} assertions passed`); });
