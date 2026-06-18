/**
 * Strength Discovery Engine — focused tests (npx tsx backend/tests/strength-discovery-engine.test.ts)
 *
 * Proves the engine: (1) is empty-safe with no email, (2) maps CSI positive_factors
 * → strengths, (3) maps longitudinal resilience/growth, and crucially (4) can emit a
 * NON-EMPTY success_patterns from an improving behavioural_drift — the bug the
 * architect caught (the previous recurring_constructs source was always empty).
 *
 * Uses a tiny in-process fake Pool + a monkeypatched buildMemory so it runs with no DB.
 */

import assert from 'node:assert';
import Module from 'node:module';

// ── Stub buildMemory before importing the engine (engine imports it eagerly) ──
const memModulePath = require.resolve('../services/longitudinal-memory');
let fakeMemory: any = null;
const realLoad = (Module as any)._load;
(Module as any)._load = function (request: string, parent: any, isMain: boolean) {
  if (parent && request.includes('longitudinal-memory')) {
    return { buildMemory: async () => fakeMemory };
  }
  return realLoad.call(this, request, parent, isMain);
};

const { discoverStrengths } = require('../services/strength-discovery-engine');

// ── Minimal fake Pool ──
function makePool(opts: { csiPositive?: any[]; sessionEmail?: string | null }) {
  return {
    async query(sql: string, _params?: any[]) {
      if (/FROM csi_profiles/i.test(sql)) {
        return { rows: opts.csiPositive ? [{ positive_factors: opts.csiPositive }] : [] };
      }
      if (/FROM capadex_sessions/i.test(sql)) {
        return { rows: opts.sessionEmail ? [{ guest_email: opts.sessionEmail }] : [] };
      }
      return { rows: [] };
    },
  } as any;
}

const emptyMemory = {
  recurring_constructs: [], behavioural_drift: null, burnout_periods: [],
  resilience_recoveries: [], growth_patterns: [], session_count: 0,
  first_seen: null, last_seen: null,
};

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { console.error(`  ✗ ${name}\n    ${e?.message}`); process.exitCode = 1; }
}

(async () => {
  console.log('strength-discovery-engine');

  await test('empty-safe: no scope → all empty, sources:[]', async () => {
    fakeMemory = emptyMemory;
    const p = await discoverStrengths(makePool({}), '');
    assert.deepEqual(p.strengths, []);
    assert.deepEqual(p.success_patterns, []);
    assert.deepEqual(p.sources, []);
    assert.equal(p.scope.email, null);
  });

  await test('CSI positive_factors (≥65) → strengths; <65 dropped', async () => {
    fakeMemory = emptyMemory;
    const p = await discoverStrengths(
      makePool({ csiPositive: [
        { factor: 'Resilience', score: 80, domain: 'Coping' },
        { factor: 'Low one', score: 50, domain: 'X' },
      ] }),
      'user@x.com',
    );
    assert.equal(p.strengths.length, 1);
    assert.equal(p.strengths[0].label, 'Resilience');
    assert.equal(p.strengths[0].source, 'csi_positive_factors');
    assert.equal(p.strengths[0].confidence, 0.8);
    assert.ok(p.sources.includes('csi_positive_factors'));
  });

  await test('resilience_recoveries → resilience; growth_patterns → coping', async () => {
    fakeMemory = {
      ...emptyMemory,
      resilience_recoveries: [{ detected_at: '2026-01-01T00:00:00Z', low_score: 30, high_score: 55, rebound_points: 25, concern_name: 'Burnout', decay_after_days: 90 }],
      growth_patterns: [{ detected_at: '2026-02-01T00:00:00Z', starting_score: 40, current_score: 70, improvement: 30, sessions_span: 3, concern_name: 'Focus', decay_after_days: 90 }],
    };
    const p = await discoverStrengths(makePool({ csiPositive: [] }), 'user@x.com');
    assert.equal(p.resilience.length, 1);
    assert.equal(p.resilience[0].source, 'longitudinal_resilience');
    assert.equal(p.coping.length, 1);
    assert.equal(p.coping[0].source, 'longitudinal_growth');
  });

  await test('REGRESSION: improving behavioural_drift → NON-EMPTY success_patterns', async () => {
    fakeMemory = {
      ...emptyMemory,
      behavioural_drift: { direction: 'improving', slope: 5, confidence: 'high', first_csi: 40, last_csi: 72 },
    };
    const p = await discoverStrengths(makePool({ csiPositive: [] }), 'user@x.com');
    assert.equal(p.success_patterns.length, 1, 'success_patterns must not be empty for improving drift');
    assert.equal(p.success_patterns[0].source, 'longitudinal_behavioural_drift');
    assert.equal(p.success_patterns[0].confidence, 0.9);
    assert.ok(p.sources.includes('longitudinal_behavioural_drift'));
  });

  await test('declining behavioural_drift → empty success_patterns (honest)', async () => {
    fakeMemory = { ...emptyMemory, behavioural_drift: { direction: 'declining', slope: -5, confidence: 'high', first_csi: 70, last_csi: 40 } };
    const p = await discoverStrengths(makePool({ csiPositive: [] }), 'user@x.com');
    assert.deepEqual(p.success_patterns, []);
  });

  await test('session UUID scope resolves to email via capadex_sessions', async () => {
    fakeMemory = emptyMemory;
    const p = await discoverStrengths(
      makePool({ sessionEmail: 'mapped@x.com', csiPositive: [{ factor: 'F', score: 90, domain: 'D' }] }),
      '11111111-1111-1111-1111-111111111111',
    );
    assert.equal(p.scope.email, 'mapped@x.com');
    assert.equal(p.scope.session_id, '11111111-1111-1111-1111-111111111111');
    assert.equal(p.strengths.length, 1);
  });

  console.log(`\n${passed} passed`);
})();
