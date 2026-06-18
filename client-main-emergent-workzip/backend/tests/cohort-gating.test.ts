/**
 * Cohort Normalisation & k-Anonymity Gating — unit tests
 *
 * Run with:  npx tsx backend/tests/cohort-gating.test.ts
 *
 * Pure tests (no DB) cover normalisation + gate arithmetic. A handful of
 * mocked-pool tests verify countCohort / countCohortHistory degrade safely
 * on missing pool / query failure.
 */

import assert from 'node:assert/strict';
import {
  resolveCohort, normaliseAgeBand, normalisePersonaTrack,
  applyKAnonymity, countCohort, countCohortHistory,
  K_MIN, K_VERIFIED, AGE_BANDS,
} from '../services/cohort-gating';
import type { Pool } from 'pg';

let passed = 0; let failed = 0;
function test(label: string, fn: () => void | Promise<void>) {
  const run = async () => {
    try { await fn(); console.log(`  ✓  ${label}`); passed++; }
    catch (err) { console.error(`  ✗  ${label}`); console.error(err); failed++; }
  };
  pending.push(run());
}
const pending: Promise<void>[] = [];

console.log('\n── Cohort Normalisation & k-Anonymity ──────────────────────────────────');

// ── 1. Age band normalisation ────────────────────────────────────────────────
test('explicit canonical band passes through', () => {
  assert.equal(normaliseAgeBand('17-24', null), '17-24');
  assert.equal(normaliseAgeBand('45+',   null), '45+');
});

test('unicode dash variants normalise to ASCII band', () => {
  assert.equal(normaliseAgeBand('17\u201324', null), '17-24'); // en-dash
  assert.equal(normaliseAgeBand('24\u201445', null), '24-45'); // em-dash
});

test('numeric age maps to correct band', () => {
  assert.equal(normaliseAgeBand(null, 10), '6-14');
  assert.equal(normaliseAgeBand(null, 15), '14-17');
  assert.equal(normaliseAgeBand(null, 20), '17-24');
  assert.equal(normaliseAgeBand(null, 34), '24-45');
  assert.equal(normaliseAgeBand(null, 65), '45+');
});

test('empty input falls back to default (24-45)', () => {
  assert.equal(normaliseAgeBand(null, null), '24-45');
  assert.equal(normaliseAgeBand(undefined, undefined), '24-45');
});

test('non-canonical band string degrades to age-based fallback', () => {
  assert.equal(normaliseAgeBand('21-32', 28), '24-45');
  assert.equal(normaliseAgeBand('garbage', 15), '14-17');
});

test('AGE_BANDS list is the canonical 5 from replit.md IntroPhase', () => {
  assert.deepEqual([...AGE_BANDS], ['6-14', '14-17', '17-24', '24-45', '45+']);
});

// ── 2. Persona track normalisation ───────────────────────────────────────────
test('macro tracks pass through verbatim', () => {
  assert.equal(normalisePersonaTrack('learner'),      'learner');
  assert.equal(normalisePersonaTrack('professional'), 'professional');
  assert.equal(normalisePersonaTrack('proxy'),        'proxy');
});

test('sub-personas collapse to macro track', () => {
  assert.equal(normalisePersonaTrack('mid_career_professional'), 'professional');
  assert.equal(normalisePersonaTrack('campus_student'),          'learner');
  assert.equal(normalisePersonaTrack('parent'),                  'proxy');
});

test('whitespace + hyphens normalise before lookup', () => {
  assert.equal(normalisePersonaTrack(' Mid-Career-Professional '), 'professional');
});

test('unknown persona degrades to professional default', () => {
  assert.equal(normalisePersonaTrack('alien_persona'), 'professional');
  assert.equal(normalisePersonaTrack(null), 'professional');
});

test('resolveCohort composes age band + persona track', () => {
  assert.deepEqual(
    resolveCohort({ age: 32, persona: 'mid_career_professional' }),
    { age_band: '24-45', persona_track: 'professional' },
  );
  assert.deepEqual(
    resolveCohort({ age_band: '14-17', persona: 'campus_student' }),
    { age_band: '14-17', persona_track: 'learner' },
  );
});

// ── 3. k-Anonymity gate arithmetic ───────────────────────────────────────────
test('Rule A — n < K_MIN → masked, benchmarks become null', () => {
  const r = applyKAnonymity(0, { p50: 60 });
  assert.equal(r.cohort_status, 'masked');
  assert.equal(r.benchmarks, null);
  assert.equal(r.trend_available, false);
  assert.ok(/locked/i.test(r.privacy_notice));

  const r29 = applyKAnonymity(29, { p50: 60 });
  assert.equal(r29.cohort_status, 'masked');
  assert.equal(r29.benchmarks, null);
});

test('Rule B — K_MIN ≤ n < K_VERIFIED → provisional, benchmarks pass through with exact n', () => {
  const r = applyKAnonymity(50, { p50: 60 });
  assert.equal(r.cohort_status, 'provisional');
  assert.deepEqual(r.benchmarks, { p50: 60 });
  assert.equal(r.n, 50);
  assert.ok(/n=50/.test(r.privacy_notice));
  assert.equal(r.trend_available, false); // provisional cohorts never enable trend

  const rEdge = applyKAnonymity(99, { p50: 60 });
  assert.equal(rEdge.cohort_status, 'provisional');
});

test('Rule C — n ≥ K_VERIFIED → verified, full disclosure', () => {
  const r = applyKAnonymity(100, { p50: 60 });
  assert.equal(r.cohort_status, 'verified');
  assert.deepEqual(r.benchmarks, { p50: 60 });
  assert.ok(/Verified/i.test(r.privacy_notice));
});

test('boundary at exactly K_MIN flips masked → provisional', () => {
  assert.equal(applyKAnonymity(K_MIN - 1, {}).cohort_status, 'masked');
  assert.equal(applyKAnonymity(K_MIN,     {}).cohort_status, 'provisional');
});

test('boundary at exactly K_VERIFIED flips provisional → verified', () => {
  assert.equal(applyKAnonymity(K_VERIFIED - 1, {}).cohort_status, 'provisional');
  assert.equal(applyKAnonymity(K_VERIFIED,     {}).cohort_status, 'verified');
});

// ── 4. Trend reconciliation (verified ∧ history ≥ K_MIN) ─────────────────────
test('trend_available requires verified cohort AND history ≥ K_MIN', () => {
  assert.equal(applyKAnonymity(120, {}, { historyN: 50 }).trend_available, true);
  assert.equal(applyKAnonymity(120, {}, { historyN: 29 }).trend_available, false);
  assert.equal(applyKAnonymity(50,  {}, { historyN: 50 }).trend_available, false);
  assert.equal(applyKAnonymity(120, {}, {              }).trend_available, false);
});

// ── 5. Output framing — every notice is developmental ────────────────────────
test('non-masked notices include developmental framing', () => {
  assert.ok(/Developmental signal only/i.test(applyKAnonymity(50,  {}).privacy_notice));
  assert.ok(/Developmental signal only/i.test(applyKAnonymity(120, {}).privacy_notice));
});

// ── 6. DB-side degradation (no live DB) ──────────────────────────────────────
test('countCohort(null pool) → 0', async () => {
  const n = await countCohort(null, { age_band: '24-45', persona_track: 'professional' });
  assert.equal(n, 0);
});

test('countCohort tolerates query error → 0 (gate degrades to masked)', async () => {
  const fakePool = { query: async () => { throw new Error('db down'); } } as unknown as Pool;
  const n = await countCohort(fakePool, { age_band: '24-45', persona_track: 'professional' });
  assert.equal(n, 0);
});

test('countCohort sends canonical age_band + persona-track expansion to SQL', async () => {
  let observedParams: unknown[] | null = null;
  const fakePool = {
    query: async (_sql: string, params: unknown[]) => {
      observedParams = params;
      return { rows: [{ n: '42' }] };
    },
  } as unknown as Pool;
  const n = await countCohort(fakePool, { age_band: '24-45', persona_track: 'professional' });
  assert.equal(n, 42);
  assert.equal((observedParams as unknown[])[0], '24-45');
  const personas = (observedParams as unknown[])[1] as string[];
  assert.ok(Array.isArray(personas) && personas.includes('mid_career_professional'));
  assert.ok(personas.includes('senior_professional'));
});

test('countCohortHistory(null pool / no competency) → 0', async () => {
  assert.equal(await countCohortHistory(null, { age_band: '24-45', persona_track: 'professional' }, 'comp_x'), 0);
  const fakePool = { query: async () => { throw new Error('nope'); } } as unknown as Pool;
  assert.equal(await countCohortHistory(fakePool, { age_band: '24-45', persona_track: 'professional' }, null), 0);
});

test('countCohortHistory sends competency_id + age_band + persona expansion in order', async () => {
  let observedSql = '';
  let observedParams: unknown[] | null = null;
  const fakePool = {
    query: async (sql: string, params: unknown[]) => {
      observedSql = sql;
      observedParams = params;
      return { rows: [{ n: '57' }] };
    },
  } as unknown as Pool;
  const n = await countCohortHistory(
    fakePool,
    { age_band: '17-24', persona_track: 'learner' },
    'comp_emotional_regulation',
  );
  assert.equal(n, 57);
  // Must read append-only history table only.
  assert.ok(/FROM\s+p4_competency_history/i.test(observedSql), 'must read p4_competency_history');
  assert.ok(!/INSERT|UPDATE|DELETE/i.test(observedSql), 'must be read-only');
  // Param order: [competencyId, age_band, personas[]]
  assert.equal((observedParams as unknown[])[0], 'comp_emotional_regulation');
  assert.equal((observedParams as unknown[])[1], '17-24');
  const personas = (observedParams as unknown[])[2] as string[];
  assert.ok(Array.isArray(personas) && personas.includes('campus_student'));
  assert.ok(personas.includes('competitive_aspirant'));
});

// ── Run ──────────────────────────────────────────────────────────────────────
void (async () => {
  await Promise.all(pending);
  console.log(`\n  Result: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
