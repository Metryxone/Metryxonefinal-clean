/**
 * Phase 5 — Workforce OS test suite.
 *
 * Covers:
 *  - fairness-monitoring-engine: pure compute (DI ratio, mean gap, selection gap)
 *  - dispute-override-engine: canTransition matrix; applyOverridesToPayload
 *  - rbac-tenant-engine: hasPermission wildcards; assign/effective/revoke roundtrip
 *  - learning-roi-engine: computeRoi returns sane bounded values
 *  - predictive-workforce-engine: severityFromScore; obsolescence + risk listing
 *  - market-intelligence-engine: ingest + query roundtrip
 *  - routes: envelope contract; auth boundary; permission boundary
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { Pool } from 'pg';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  computeFairness, FAIRNESS_MONITORING_VERSION,
} from '../services/fairness-monitoring-engine.js';
import {
  canTransition, applyOverridesToPayload, DISPUTE_OVERRIDE_VERSION,
} from '../services/dispute-override-engine.js';
import {
  hasPermission, hasPermissionScoped, assignRole, effectivePermissions, revokeAssignment, RBAC_TENANT_VERSION,
} from '../services/rbac-tenant-engine.js';
import {
  computeRoi, LEARNING_ROI_VERSION,
} from '../services/learning-roi-engine.js';
import {
  severityFromScore, listObsolescence, listWorkforceRisk, PREDICTIVE_WORKFORCE_VERSION,
} from '../services/predictive-workforce-engine.js';
import {
  ingestSignals, querySignals, MARKET_INTELLIGENCE_VERSION,
} from '../services/market-intelligence-engine.js';
import { registerWorkforceOsRoutes } from '../routes/workforce-os.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─────────────────────────────────────────────────────────────────────────
// 1. Fairness engine — pure compute
// ─────────────────────────────────────────────────────────────────────────

test('fairness: disparate_impact_ratio passes when groups are balanced', () => {
  const r = computeFairness({
    metric: 'disparate_impact_ratio',
    group_a: { group_label: 'female', scores: Array(100).fill(70) },
    group_b: { group_label: 'male',   scores: Array(100).fill(72) },
    threshold: 0.8,
  });
  assert.equal(r.passed, true);
  assert.ok(r.metric_value >= 0.8);
});

test('fairness: disparate_impact_ratio fails when groups are skewed', () => {
  const r = computeFairness({
    metric: 'disparate_impact_ratio',
    group_a: { group_label: 'urban', scores: Array(100).fill(80) },
    group_b: { group_label: 'rural', scores: Array(100).fill(40) },
    threshold: 0.8,
  });
  assert.equal(r.passed, false);
  assert.ok(r.metric_value < 0.8);
});

test('fairness: mean_score_gap returns absolute delta', () => {
  const r = computeFairness({
    metric: 'mean_score_gap',
    group_a: { group_label: 'a', scores: [60, 70, 80] },
    group_b: { group_label: 'b', scores: [50, 55, 60] },
    threshold: 20,
  });
  assert.equal(r.passed, true);
  assert.ok(r.metric_value > 0);
});

test('fairness: selection_rate_gap respects threshold', () => {
  const r = computeFairness({
    metric: 'selection_rate_gap',
    group_a: { group_label: 'a', scores: [80, 80, 80, 80], selection_threshold: 65 },
    group_b: { group_label: 'b', scores: [40, 40, 40, 40], selection_threshold: 65 },
    threshold: 0.1,
  });
  assert.equal(r.passed, false);
  assert.equal(r.metric_value, 1.0);
});

// ─────────────────────────────────────────────────────────────────────────
// 2. Dispute engine — pure
// ─────────────────────────────────────────────────────────────────────────

test('dispute: canTransition enforces lifecycle', () => {
  assert.equal(canTransition('open', 'in_review'), true);
  assert.equal(canTransition('open', 'resolved_upheld'), false);  // must in_review first
  assert.equal(canTransition('in_review', 'resolved_overturned'), true);
  assert.equal(canTransition('resolved_upheld', 'open'), false);  // terminal
});

test('dispute: applyOverridesToPayload patches nested fields and respects expiry', () => {
  const base = { target_role_id: 'orig', meta: { tier: 'B' } };
  const out = applyOverridesToPayload(base as any, [
    { field_path: 'target_role_id', new_value: 'fixed', active: true,  expires_at: null },
    { field_path: 'meta.tier',      new_value: 'A',     active: true,  expires_at: null },
    { field_path: 'meta.label',     new_value: 'IGNORED', active: false, expires_at: null },
    { field_path: 'meta.expired',   new_value: 'NO',    active: true,
      expires_at: new Date(Date.now() - 1000).toISOString() },
  ]);
  assert.equal(out.payload.target_role_id, 'fixed');
  assert.equal((out.payload as any).meta.tier, 'A');
  assert.equal((out.payload as any).meta.label, undefined);
  assert.equal((out.payload as any).meta.expired, undefined);
  assert.deepEqual(out.applied_paths.sort(), ['meta.tier', 'target_role_id'].sort());
});

// ─────────────────────────────────────────────────────────────────────────
// 3. RBAC engine — pure + DB roundtrip
// ─────────────────────────────────────────────────────────────────────────

test('rbac: hasPermission supports wildcards', () => {
  assert.equal(hasPermission(['enterprise:*'], 'enterprise:write'), true);
  assert.equal(hasPermission(['enterprise:read'], 'enterprise:write'), false);
  // Base hasPermission only honours SAME-prefix wildcards; a cross-namespace
  // `platform:*` grant is NOT universal here (that global rule lives in
  // hasPermissionScoped, which treats a platform-wide `platform:*` as god-mode).
  assert.equal(hasPermission(['platform:*'], 'wos:write'), false);
  assert.equal(hasPermissionScoped(['platform:*'], [], 'wos:write'), true);
  assert.equal(hasPermission([], 'anything'), false);
});

test('rbac: assignRole → effectivePermissions → revoke roundtrip', async () => {
  const userId = `__phase5_user_${Date.now()}`;
  try {
    const { id } = await assignRole(pool, {
      user_id: userId, role_id: 'role_workforce_analyst',
      tenant_id: null, granted_by: 'test',
    });
    const eff = await effectivePermissions(pool, userId, null);
    assert.ok(eff.permissions.includes('enterprise:read'));
    assert.ok(eff.permissions.includes('wos:read'));
    await revokeAssignment(pool, id);
    const eff2 = await effectivePermissions(pool, userId, null);
    assert.equal(eff2.permissions.length, 0);
  } finally {
    await pool.query(`DELETE FROM wos_role_assignments WHERE user_id = $1`, [userId]);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// 4. Predictive workforce engine
// ─────────────────────────────────────────────────────────────────────────

test('predictive: severityFromScore bands', () => {
  assert.equal(severityFromScore(0.05), 'low');
  assert.equal(severityFromScore(0.35), 'medium');
  assert.equal(severityFromScore(0.6),  'high');
  assert.equal(severityFromScore(0.9),  'critical');
});

test('predictive: listObsolescence returns sorted rows from seed', async () => {
  const rows = await listObsolescence(pool, { limit: 10 });
  assert.ok(rows.length > 0);
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i - 1].obsolescence_score >= rows[i].obsolescence_score);
  }
});

test('predictive: listWorkforceRisk seeded for demo tenant', async () => {
  const rows = await listWorkforceRisk(pool, { tenant_id: 1, limit: 50 });
  assert.ok(rows.length >= 5);
});

// ─────────────────────────────────────────────────────────────────────────
// 5. Market intelligence engine — ingest + query
// ─────────────────────────────────────────────────────────────────────────

test('market: ingestSignals + querySignals roundtrip', async () => {
  const probe = `__phase5_probe_${Date.now()}`;
  try {
    const res = await ingestSignals(pool, [
      { signal_type: 'macro_trend', metric_value: 1.5, metric_unit: 'pct_change',
        direction: 'up', source: probe, confidence: 0.9 },
    ]);
    assert.equal(res.inserted, 1);
    const all = await querySignals(pool, { signal_type: 'macro_trend', limit: 50 });
    assert.ok(all.some((r: any) => r.source === probe));
  } finally {
    await pool.query(`DELETE FROM wos_market_signals WHERE source = $1`, [probe]);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// 6. Learning ROI engine
// ─────────────────────────────────────────────────────────────────────────

test('roi: computeRoi returns bounded values + confidence tier', async () => {
  const { rows } = await pool.query<{ id: string }>(`SELECT id FROM learn_interventions LIMIT 1`);
  if (!rows.length) {
    // Phase 4 must be applied — skip rather than fail
    return;
  }
  const r = await computeRoi(pool, {
    tenant_id: 1, intervention_id: rows[0].id, cohort_size: 40, total_program_cost: 10000,
  });
  assert.ok(r.completion_rate >= 0 && r.completion_rate <= 1);
  assert.ok(r.estimated_retention_lift_pct >= 0 && r.estimated_retention_lift_pct <= 5);
  assert.ok(['A','B','C','D','provisional'].includes(r.confidence_tier));
  assert.ok(typeof r.language_note === 'string' && r.language_note.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────
// 7. Route layer — envelope + auth/permission boundaries
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

test('routes: methodology envelope is well-formed', async () => {
  const { app } = makeApp();
  const srv = await startServer(app);
  try {
    const r = await fetch(`${srv.url}/api/wos/methodology`);
    assert.equal(r.status, 200);
    const j: any = await r.json();
    assert.equal(j.ok, true);
    assert.equal(j.versions.market_intelligence,  MARKET_INTELLIGENCE_VERSION);
    assert.equal(j.versions.predictive_workforce, PREDICTIVE_WORKFORCE_VERSION);
    assert.equal(j.versions.fairness_monitoring,  FAIRNESS_MONITORING_VERSION);
    assert.equal(j.versions.dispute_override,     DISPUTE_OVERRIDE_VERSION);
    assert.equal(j.versions.rbac_tenant,          RBAC_TENANT_VERSION);
    assert.equal(j.versions.learning_roi,         LEARNING_ROI_VERSION);
    assert.ok(j.language_policy && Array.isArray(j.language_policy.allowed));
    assert.ok(j.request_id);
  } finally { await srv.close(); }
});

test('routes: dashboard returns all six bundles', async () => {
  const { app } = makeApp();
  const srv = await startServer(app);
  try {
    const r = await fetch(`${srv.url}/api/wos/dashboard?tenant_id=1`);
    const j: any = await r.json();
    assert.equal(j.ok, true);
    for (const k of ['workforce_risks','top_obsolete_competencies','ai_exposure_top',
                     'emerging_roles','fairness_summary','open_disputes','recent_roi','macro_trends']) {
      assert.ok(Array.isArray(j[k]) || typeof j[k] === 'object', `missing bundle: ${k}`);
    }
  } finally { await srv.close(); }
});

test('routes: write endpoint blocks unauthenticated', async () => {
  const { app } = makeApp();
  const srv = await startServer(app);
  try {
    const r = await fetch(`${srv.url}/api/wos/market/ingest`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signals: [{ signal_type: 'macro_trend', metric_value: 1 }] }),
    });
    assert.equal(r.status, 401);
    const j: any = await r.json();
    assert.equal(j.ok, false);
    assert.equal(j.error, 'authentication_required');
  } finally { await srv.close(); }
});

test('routes: authed-but-no-permission returns 403', async () => {
  const { app, auth } = makeApp();
  const noPermUser = `__phase5_noperm_${Date.now()}`;
  auth.user = { id: noPermUser }; auth.isAuthed = true;
  const srv = await startServer(app);
  try {
    const r = await fetch(`${srv.url}/api/wos/market/ingest`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signals: [{ signal_type: 'macro_trend', metric_value: 1 }] }),
    });
    assert.equal(r.status, 403);
    const j: any = await r.json();
    assert.equal(j.error, 'forbidden');
  } finally { await srv.close(); }
});

test('routes: authed + permission allows ingest', async () => {
  const { app, auth } = makeApp();
  const adminUser = `__phase5_admin_${Date.now()}`;
  const probe = `__phase5_routeprobe_${Date.now()}`;
  await assignRole(pool, {
    user_id: adminUser, role_id: 'role_platform_admin',
    tenant_id: null, granted_by: 'test',
  });
  auth.user = { id: adminUser }; auth.isAuthed = true;
  const srv = await startServer(app);
  try {
    const r = await fetch(`${srv.url}/api/wos/market/ingest`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signals: [
        { signal_type: 'macro_trend', metric_value: 2.4, source: probe, confidence: 0.8 },
      ] }),
    });
    assert.equal(r.status, 200);
    const j: any = await r.json();
    assert.equal(j.ok, true);
    assert.equal(j.inserted, 1);
  } finally {
    await srv.close();
    await pool.query(`DELETE FROM wos_market_signals WHERE source = $1`, [probe]);
    await pool.query(`DELETE FROM wos_role_assignments WHERE user_id = $1`, [adminUser]);
  }
});

test('routes: file dispute → transition through workflow', async () => {
  const { app, auth } = makeApp();
  const filerUser = `__phase5_filer_${Date.now()}`;
  const reviewerUser = `__phase5_reviewer_${Date.now()}`;
  await assignRole(pool, {
    user_id: reviewerUser, role_id: 'role_governance_reviewer',
    tenant_id: null, granted_by: 'test',
  });
  const srv = await startServer(app);
  try {
    // 1. file as end user
    auth.user = { id: filerUser }; auth.isAuthed = true;
    const fileRes = await fetch(`${srv.url}/api/wos/disputes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject_type: 'recommendation', subject_ref: '__test_rec_1',
        reason_code: 'inaccurate', description: 'test',
      }),
    });
    const fileJ: any = await fileRes.json();
    assert.equal(fileJ.ok, true);
    const disputeId = fileJ.id;

    // 2. invalid transition rejected
    auth.user = { id: reviewerUser };
    const badRes = await fetch(`${srv.url}/api/wos/disputes/${disputeId}/transition`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_status: 'resolved_upheld' }),  // must go via in_review first
    });
    assert.equal(badRes.status, 400);

    // 3. open → in_review
    const t1 = await fetch(`${srv.url}/api/wos/disputes/${disputeId}/transition`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_status: 'in_review' }),
    });
    assert.equal(t1.status, 200);

    // 4. in_review → resolved_overturned with override
    const t2 = await fetch(`${srv.url}/api/wos/disputes/${disputeId}/transition`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_status: 'resolved_overturned', resolution: 'Corrected per user feedback.',
        override: {
          subject_type: 'recommendation', subject_ref: '__test_rec_1',
          field_path: 'priority', prior_value: 'low', new_value: 'medium',
          justification: 'test override',
        },
      }),
    });
    const t2J: any = await t2.json();
    assert.equal(t2.status, 200);
    assert.equal(t2J.ok, true);
    assert.ok(t2J.override_id);
  } finally {
    await srv.close();
    await pool.query(`DELETE FROM wos_human_overrides WHERE reviewer_id = $1`, [reviewerUser]);
    await pool.query(`DELETE FROM wos_disputes WHERE user_id = $1`, [filerUser]);
    await pool.query(`DELETE FROM wos_role_assignments WHERE user_id = $1`, [reviewerUser]);
  }
});

test('routes: rbac/effective reflects assigned roles', async () => {
  const { app, auth } = makeApp();
  const u = `__phase5_eff_${Date.now()}`;
  await assignRole(pool, { user_id: u, role_id: 'role_workforce_analyst',
    tenant_id: null, granted_by: 'test' });
  auth.user = { id: u }; auth.isAuthed = true;
  const srv = await startServer(app);
  try {
    const r = await fetch(`${srv.url}/api/wos/rbac/effective`);
    const j: any = await r.json();
    assert.equal(j.ok, true);
    assert.ok(j.permissions.includes('wos:read'));
    assert.ok(j.roles.includes('role_workforce_analyst'));
  } finally {
    await srv.close();
    await pool.query(`DELETE FROM wos_role_assignments WHERE user_id = $1`, [u]);
  }
});
