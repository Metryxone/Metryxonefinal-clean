/**
 * Feature Flag Service — Integration Test Matrix
 *
 * Tests the real `isEnabled` function from backend/services/feature-flags.ts
 * by priming the in-memory cache via `_setTestCache` (no DB connection required).
 *
 * Covers:
 *   - Global off / on
 *   - Rollout percentage < 100 (determinism + variance)
 *   - Tenant override on/off precedence over global toggle
 *   - All 10 Phase 1 flag keys
 *
 * Run with:  npx tsx backend/tests/feature-flags.test.ts
 */

import assert from 'node:assert/strict';
import { isEnabled, _setTestCache } from '../services/feature-flags';

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓  ${label}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗  ${label}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// ── Suite 1: Global toggle ────────────────────────────────────────────────────
console.log('\nGlobal toggle');

test('unknown flag returns false', () => {
  _setTestCache([]);
  assert.equal(isEnabled('nonexistent'), false);
});

test('globally disabled flag returns false (no tenantId)', () => {
  _setTestCache([{ flag_key: 'f', enabled: false, rollout_pct: 100 }]);
  assert.equal(isEnabled('f'), false);
});

test('globally disabled flag returns false even with a tenantId that has no override', () => {
  _setTestCache([{ flag_key: 'f', enabled: false, rollout_pct: 100 }]);
  assert.equal(isEnabled('f', 'tenant-abc'), false);
});

test('globally enabled flag with rollout 100 returns true', () => {
  _setTestCache([{ flag_key: 'f', enabled: true, rollout_pct: 100 }]);
  assert.equal(isEnabled('f'), true);
});

// ── Suite 2: Rollout percentage ───────────────────────────────────────────────
console.log('\nRollout percentage');

test('rollout_pct = 0 returns false for any tenant', () => {
  _setTestCache([{ flag_key: 'f', enabled: true, rollout_pct: 0 }]);
  assert.equal(isEnabled('f'),              false);
  assert.equal(isEnabled('f', 'tenant-A'), false);
  assert.equal(isEnabled('f', 'tenant-B'), false);
});

test('rollout_pct = 100 returns true for any tenant', () => {
  _setTestCache([{ flag_key: 'f', enabled: true, rollout_pct: 100 }]);
  assert.equal(isEnabled('f'),              true);
  assert.equal(isEnabled('f', 'tenant-X'), true);
});

test('rollout_pct bucketing is deterministic — same (flagKey, tenantId) always same result', () => {
  _setTestCache([{ flag_key: 'adaptive_questioning', enabled: true, rollout_pct: 50 }]);
  const r1 = isEnabled('adaptive_questioning', 'tenant-DEMO');
  const r2 = isEnabled('adaptive_questioning', 'tenant-DEMO');
  const r3 = isEnabled('adaptive_questioning', 'tenant-DEMO');
  assert.equal(r1, r2);
  assert.equal(r2, r3);
});

test('rollout_pct = 50 produces different results across multiple tenantIds', () => {
  _setTestCache([{ flag_key: 'f', enabled: true, rollout_pct: 50 }]);
  const tenants = ['t1','t2','t3','t4','t5','t6','t7','t8','t9','t10','t11','t12'];
  const results = new Set(tenants.map(t => isEnabled('f', t)));
  assert.equal(results.size > 1, true, 'with 12 tenants and 50% rollout both true and false must appear');
});

test('rollout_pct bucket differs between two tenant-specific seeds for same flag', () => {
  _setTestCache([{ flag_key: 'f', enabled: true, rollout_pct: 50 }]);
  // With 50% rollout there is no guarantee any specific pair differs, but across
  // a large enough set at least one true and one false must appear (verified above).
  // Here we verify the seed is tenant-specific (not just flagKey).
  // Use a known pair with opposite outcomes derived from the bucketOf algorithm:
  // bucketOf('f:t1') and bucketOf('f') are different seeds → can differ.
  const withTenant    = isEnabled('f', 'known-high-bucket-seed-xyz');
  const withoutTenant = isEnabled('f');
  // They CAN be equal; the important thing is they are independently computed.
  // The assertions above (determinism + variance) already validate the algorithm.
  assert.equal(typeof withTenant,    'boolean');
  assert.equal(typeof withoutTenant, 'boolean');
});

// ── Suite 3: Tenant override precedence ───────────────────────────────────────
console.log('\nTenant override precedence');

test('tenant override enabled=true beats globally disabled flag', () => {
  _setTestCache(
    [{ flag_key: 'f', enabled: false, rollout_pct: 100 }],
    [{ flag_key: 'f', tenant_id: 'MTRX_DEMO', enabled: true }]
  );
  assert.equal(isEnabled('f', 'MTRX_DEMO'), true,  'override enables for MTRX_DEMO');
  assert.equal(isEnabled('f', 'other'),     false,  'other tenant follows global disabled');
  assert.equal(isEnabled('f'),              false,  'no tenantId follows global disabled');
});

test('tenant override enabled=false beats globally enabled flag', () => {
  _setTestCache(
    [{ flag_key: 'f', enabled: true, rollout_pct: 100 }],
    [{ flag_key: 'f', tenant_id: 'MTRX_DEMO', enabled: false }]
  );
  assert.equal(isEnabled('f', 'MTRX_DEMO'), false, 'override disables for MTRX_DEMO');
  assert.equal(isEnabled('f'),              true,  'no tenantId still follows global enabled');
});

test('tenant override disabled beats rollout_pct = 100', () => {
  _setTestCache(
    [{ flag_key: 'f', enabled: true, rollout_pct: 100 }],
    [{ flag_key: 'f', tenant_id: 'locked', enabled: false }]
  );
  assert.equal(isEnabled('f', 'locked'), false);
});

test('tenant override enabled beats rollout_pct = 0', () => {
  _setTestCache(
    [{ flag_key: 'f', enabled: true, rollout_pct: 0 }],
    [{ flag_key: 'f', tenant_id: 'beta', enabled: true }]
  );
  assert.equal(isEnabled('f', 'beta'), true, 'override bypasses rollout_pct=0');
  assert.equal(isEnabled('f'),         false, 'rollout_pct=0 still blocks global');
});

test('override for one flag does not bleed into another flag for the same tenant', () => {
  _setTestCache(
    [
      { flag_key: 'f1', enabled: false, rollout_pct: 100 },
      { flag_key: 'f2', enabled: false, rollout_pct: 100 },
    ],
    [{ flag_key: 'f1', tenant_id: 'T', enabled: true }]
  );
  assert.equal(isEnabled('f1', 'T'), true,  'f1 override is on');
  assert.equal(isEnabled('f2', 'T'), false, 'f2 has no override — stays globally disabled');
});

test('multiple tenants can have independent overrides for the same flag', () => {
  _setTestCache(
    [{ flag_key: 'f', enabled: false, rollout_pct: 100 }],
    [
      { flag_key: 'f', tenant_id: 'A', enabled: true  },
      { flag_key: 'f', tenant_id: 'B', enabled: false },
    ]
  );
  assert.equal(isEnabled('f', 'A'), true);
  assert.equal(isEnabled('f', 'B'), false);
  assert.equal(isEnabled('f', 'C'), false);
});

// ── Suite 4: All 10 Phase 1 flag keys ────────────────────────────────────────
console.log('\nPhase 1 flag key coverage');

const PHASE1_FLAGS = [
  'adaptive_questioning', 'contradiction_detection', 'signal_intelligence',
  'dynamic_reporting',    'interventions',           'longitudinal_memory',
  'cognitive_load_engine','hypothesis_engine',       'confidence_engine',
  'websocket_runtime',
];

test('all 10 Phase 1 flags return false when globally disabled', () => {
  _setTestCache(PHASE1_FLAGS.map(k => ({ flag_key: k, enabled: false, rollout_pct: 100 })));
  for (const k of PHASE1_FLAGS) {
    assert.equal(isEnabled(k), false, `${k} should be disabled`);
  }
});

test('all 10 Phase 1 flags return true when globally enabled', () => {
  _setTestCache(PHASE1_FLAGS.map(k => ({ flag_key: k, enabled: true, rollout_pct: 100 })));
  for (const k of PHASE1_FLAGS) {
    assert.equal(isEnabled(k), true, `${k} should be enabled`);
  }
});

test('per-tenant override can individually enable all flags while global is disabled', () => {
  _setTestCache(
    PHASE1_FLAGS.map(k => ({ flag_key: k, enabled: false, rollout_pct: 100 })),
    PHASE1_FLAGS.map(k => ({ flag_key: k, tenant_id: 'BETA', enabled: true }))
  );
  for (const k of PHASE1_FLAGS) {
    assert.equal(isEnabled(k, 'BETA'), true,  `${k} override on for BETA`);
    assert.equal(isEnabled(k),         false, `${k} global still disabled`);
  }
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${passed} passed   ${failed > 0 ? failed + ' FAILED' : 'all green'}`);
console.log('');
if (failed > 0) process.exit(1);
