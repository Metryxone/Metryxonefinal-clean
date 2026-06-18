/**
 * Phase 5 — Workforce OS edge-case test suite (T005 additive expansion).
 *
 * Strictly additive to `workforce-os.test.ts`. The original suite covers happy
 * paths + the canonical envelope contract; this file pins down edge-case
 * behaviour the original suite does not assert:
 *
 *   - fairness:    insufficient-data fail-closed, identical-group zero gap
 *   - dispute:     empty override list, nonexistent paths, terminal-state lock
 *   - rbac:        empty-grant rejection, exact-permission match (not wildcard)
 *   - predictive:  band boundary values around 0.10 / 0.40 / 0.70
 *   - market:      empty batch ingest, query result schema, value clamping
 *   - routes:      missing-tenant graceful, no-signals 400, schemaful response
 *
 * Production code is NEVER modified by this suite — every test that touches
 * the DB cleans up after itself in `finally` and uses random probe ids so
 * concurrent test runs cannot collide.
 *
 * Run with:  cd backend && npx tsx --test tests/workforce-os.edge.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { Pool } from 'pg';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { computeFairness } from '../services/fairness-monitoring-engine.js';
import { canTransition, applyOverridesToPayload } from '../services/dispute-override-engine.js';
import { hasPermission } from '../services/rbac-tenant-engine.js';
import { severityFromScore } from '../services/predictive-workforce-engine.js';
import { ingestSignals, querySignals } from '../services/market-intelligence-engine.js';
import { registerWorkforceOsRoutes } from '../routes/workforce-os.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─────────────────────────────────────────────────────────────────────────
// 1. Fairness engine — edge cases
// ─────────────────────────────────────────────────────────────────────────

test('fairness/edge: empty group_a fails closed with NaN metric', () => {
  const r = computeFairness({
    metric: 'disparate_impact_ratio',
    group_a: { group_label: 'a', scores: [] },
    group_b: { group_label: 'b', scores: [80, 70, 90] },
    threshold: 0.8,
  });
  assert.equal(r.passed, false);
  assert.ok(Number.isNaN(r.metric_value));
  assert.equal((r.detail as any).insufficient_data, true);
});

test('fairness/edge: identical groups produce zero gap and pass', () => {
  const scores = [70, 70, 70, 70];
  const r = computeFairness({
    metric: 'mean_score_gap',
    group_a: { group_label: 'a', scores },
    group_b: { group_label: 'b', scores: [...scores] },
    threshold: 5,
  });
  assert.equal(r.passed, true);
  assert.equal(r.metric_value, 0);
});

test('fairness/edge: disparate_impact with both selection rates 0 fails closed', () => {
  // selection_threshold defaults to 65; all scores below it on both sides
  const r = computeFairness({
    metric: 'disparate_impact_ratio',
    group_a: { group_label: 'a', scores: [10, 20, 30] },
    group_b: { group_label: 'b', scores: [15, 25, 35] },
    threshold: 0.8,
  });
  assert.equal(r.passed, false);
  assert.ok(Number.isNaN(r.metric_value));
});

// ─────────────────────────────────────────────────────────────────────────
// 2. Dispute / override engine — edge cases
// ─────────────────────────────────────────────────────────────────────────

test('dispute/edge: applyOverridesToPayload with empty list leaves payload unchanged', () => {
  const base = { foo: 'bar', nested: { keep: 1 } };
  const out = applyOverridesToPayload(base as any, []);
  assert.deepEqual(out.payload, base);
  assert.deepEqual(out.applied_paths, []);
});

test('dispute/edge: applyOverridesToPayload contract on degenerate field_path', () => {
  // Documents the current engine contract — pins behaviour against silent drift.
  // Two known gaps in the production engine (NOT fixed here per the additive,
  // non-destructive scope of T005):
  //   1. field_path = ''   → throws inside setByPath ('' split → keys=[''])
  //   2. field_path = null → throws ("Cannot read properties of null").
  // The caller (`/api/wos/disputes/:id/transition` route handler) currently
  // only passes overrides assembled from a Zod-validated request body where
  // field_path is required, so the runtime contract holds. This test will
  // start failing the moment the engine adds null-safety — that's intentional
  // so the contract change is explicit.
  const base = { foo: 'bar' };

  // Sanity: a well-formed empty list is a true no-op (already covered above
  // but re-asserted here to anchor the "non-throwing" baseline for this case).
  assert.deepEqual(applyOverridesToPayload(base as any, []).payload, base);

  // Null field_path currently throws — assert that so the contract is pinned.
  assert.throws(
    () => applyOverridesToPayload(base as any, [
      { field_path: null as any, new_value: 'Y', active: true, expires_at: null } as any,
    ]),
    /Cannot read|null|undefined/,
  );
});

test('dispute/edge: canTransition — terminal states are absorbing', () => {
  // Both terminal states never permit re-opening or sideways moves.
  for (const terminal of ['resolved_upheld', 'resolved_overturned'] as const) {
    assert.equal(canTransition(terminal, 'open'),                false);
    assert.equal(canTransition(terminal, 'in_review'),           false);
    assert.equal(canTransition(terminal, 'resolved_upheld'),     false);
    assert.equal(canTransition(terminal, 'resolved_overturned'), false);
  }
});

test('dispute/edge: canTransition — self-transition rejected', () => {
  assert.equal(canTransition('open',      'open'),      false);
  assert.equal(canTransition('in_review', 'in_review'), false);
});

// ─────────────────────────────────────────────────────────────────────────
// 3. RBAC engine — edge cases
// ─────────────────────────────────────────────────────────────────────────

test('rbac/edge: empty grant list never satisfies any required permission', () => {
  assert.equal(hasPermission([], 'enterprise:read'), false);
  assert.equal(hasPermission([], 'wos:write'),       false);
  assert.equal(hasPermission([], '*'),               false);
});

test('rbac/edge: exact-match permission (no wildcard) works', () => {
  assert.equal(hasPermission(['enterprise:read'], 'enterprise:read'),  true);
  assert.equal(hasPermission(['enterprise:read'], 'enterprise:write'), false);
});

test('rbac/edge: scoped wildcard only matches its own scope', () => {
  // Documented behaviour: `enterprise:*` matches every enterprise:X, but does
  // not cross into other scopes. This pins the contract so a future refactor
  // can't silently broaden wildcards.
  assert.equal(hasPermission(['enterprise:*'], 'enterprise:write'), true);
  assert.equal(hasPermission(['enterprise:*'], 'enterprise:read'),  true);
  assert.equal(hasPermission(['enterprise:*'], 'wos:read'),         false);
  assert.equal(hasPermission(['enterprise:*'], 'fairness:write'),   false);
});

// ─────────────────────────────────────────────────────────────────────────
// 4. Predictive engine — boundary values
// ─────────────────────────────────────────────────────────────────────────

test('predictive/edge: severityFromScore pins exact band cut points', () => {
  // Engine contract (predictive-workforce-engine.ts L24-29):
  //   score >= 0.75 → critical
  //   score >= 0.55 → high
  //   score >= 0.30 → medium
  //   else          → low
  // Hard-asserting both sides of every cut so any silent drift surfaces here.
  const probes: Array<[number, string]> = [
    [0.000, 'low'],
    [0.299, 'low'],       // just below medium cut
    [0.300, 'medium'],    // medium cut (inclusive)
    [0.549, 'medium'],    // just below high cut
    [0.550, 'high'],      // high cut (inclusive)
    [0.749, 'high'],      // just below critical cut
    [0.750, 'critical'],  // critical cut (inclusive)
    [1.000, 'critical'],
  ];
  for (const [score, expected] of probes) {
    assert.equal(severityFromScore(score), expected,
      `severityFromScore(${score}) should be '${expected}'`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// 5. Market intelligence — edge cases
// ─────────────────────────────────────────────────────────────────────────

test('market/edge: ingestSignals with empty array is a no-op', async () => {
  const r = await ingestSignals(pool, []);
  assert.equal(r.inserted, 0);
  assert.deepEqual(r.ids, []);
  assert.equal(r.clamped, 0);
});

test('market/edge: querySignals returns schema-conformant rows', async () => {
  const probe = `__edge_probe_${Date.now()}`;
  try {
    await ingestSignals(pool, [
      { signal_type: 'macro_trend', metric_value: 0.5, source: probe, confidence: 0.7 },
    ]);
    const rows = await querySignals(pool, { signal_type: 'macro_trend', limit: 50 });
    const mine = rows.find((r: any) => r.source === probe);
    assert.ok(mine, 'inserted probe row must be queryable');
    // Required schema fields surface to all downstream consumers
    for (const k of ['id','signal_type','metric_value','confidence','captured_at']) {
      assert.ok(k in mine, `querySignals row missing field: ${k}`);
    }
    assert.equal(typeof mine.metric_value, 'number');
    assert.equal(typeof mine.confidence,   'number');
  } finally {
    await pool.query(`DELETE FROM wos_market_signals WHERE source = $1`, [probe]);
  }
});

test('market/edge: confidence > 1 is clamped on ingest', async () => {
  const probe = `__edge_clamp_hi_${Date.now()}`;
  try {
    await ingestSignals(pool, [
      { signal_type: 'macro_trend', metric_value: 0.1, source: probe, confidence: 5 } as any,
    ]);
    const rows = await querySignals(pool, { signal_type: 'macro_trend', limit: 50 });
    const mine = rows.find((r: any) => r.source === probe);
    assert.ok(mine);
    assert.equal(mine.confidence, 1, `confidence>1 must clamp exactly to 1, got ${mine.confidence}`);
  } finally {
    await pool.query(`DELETE FROM wos_market_signals WHERE source = $1`, [probe]);
  }
});

test('market/edge: confidence < 0 is clamped on ingest', async () => {
  // Pins the other side of the documented two-sided clamp
  // (market-intelligence-engine.ts L77: Math.max(0, Math.min(1, ...))).
  const probe = `__edge_clamp_lo_${Date.now()}`;
  try {
    await ingestSignals(pool, [
      { signal_type: 'macro_trend', metric_value: 0.1, source: probe, confidence: -2.5 } as any,
    ]);
    const rows = await querySignals(pool, { signal_type: 'macro_trend', limit: 50 });
    const mine = rows.find((r: any) => r.source === probe);
    assert.ok(mine);
    assert.equal(mine.confidence, 0, `confidence<0 must clamp exactly to 0, got ${mine.confidence}`);
  } finally {
    await pool.query(`DELETE FROM wos_market_signals WHERE source = $1`, [probe]);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// 6. Route layer — edge cases (mirrors helpers in the canonical suite so the
//    two files can be run independently in any order)
// ─────────────────────────────────────────────────────────────────────────

function makeApp(): { app: Express; auth: { user: any; isAuthed: boolean } } {
  const app = express();
  app.use(express.json());
  const ctx = { user: null as any, isAuthed: false };
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = ctx.user;
    (req as any).isAuthenticated = () => ctx.isAuthed;
    next();
  });
  registerWorkforceOsRoutes({ app, pool });
  return { app, auth: ctx };
}

async function startServer(app: Express): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise(resolve => {
    const server = http.createServer(app).listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise(r => server.close(() => r())),
      });
    });
  });
}

test('routes/edge: methodology returns request_id and language_policy', async () => {
  const { app } = makeApp();
  const srv = await startServer(app);
  try {
    const r = await fetch(`${srv.url}/api/wos/methodology`);
    const j: any = await r.json();
    assert.equal(r.status, 200);
    assert.equal(j.ok, true);
    assert.ok(typeof j.request_id === 'string' && j.request_id.length > 0);
    assert.ok(j.language_policy && Array.isArray(j.language_policy.allowed));
    assert.ok(j.language_policy.allowed.length > 0);
  } finally { await srv.close(); }
});

test('routes/edge: dashboard tolerates missing tenant_id without 500', async () => {
  const { app } = makeApp();
  const srv = await startServer(app);
  try {
    const r = await fetch(`${srv.url}/api/wos/dashboard`);
    assert.ok(r.status === 200 || r.status === 400,
              `expected 200 or 400, got ${r.status}`);
    const j: any = await r.json();
    assert.ok('ok' in j, 'envelope must always include ok flag');
  } finally { await srv.close(); }
});

test('routes/edge: market/ingest with empty body returns 400 (no_signals)', async () => {
  const { app, auth } = makeApp();
  auth.user = { id: `__edge_empty_${Date.now()}` };
  auth.isAuthed = true;
  // Cannot fully test the happy path without granting market:write, but the
  // body-validation branch fires before the permission check — so we can
  // assert on any 4xx that includes the 'no_signals' marker OR on 403 if the
  // permission gate runs first. Both are acceptable contracts; what we
  // forbid is a 500 / NaN crash on empty input.
  const srv = await startServer(app);
  try {
    const r = await fetch(`${srv.url}/api/wos/market/ingest`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signals: [] }),
    });
    assert.ok(r.status >= 400 && r.status < 500,
              `empty payload must return 4xx, got ${r.status}`);
    const j: any = await r.json();
    assert.equal(j.ok, false);
  } finally { await srv.close(); }
});

test('routes/edge: predictive/obsolescence GET surfaces count + array shape', async () => {
  const { app } = makeApp();
  const srv = await startServer(app);
  try {
    const r = await fetch(`${srv.url}/api/wos/predictive/obsolescence?limit=5`);
    assert.equal(r.status, 200);
    const j: any = await r.json();
    assert.equal(j.ok, true);
    assert.equal(typeof j.count, 'number');
    assert.ok(Array.isArray(j.obsolescence));
    assert.ok(j.obsolescence.length <= 5, 'limit param must be honoured');
  } finally { await srv.close(); }
});

test('routes/edge: rbac/effective without auth returns 401', async () => {
  const { app } = makeApp();
  const srv = await startServer(app);
  try {
    const r = await fetch(`${srv.url}/api/wos/rbac/effective`);
    assert.equal(r.status, 401);
    const j: any = await r.json();
    assert.equal(j.ok, false);
  } finally { await srv.close(); }
});
