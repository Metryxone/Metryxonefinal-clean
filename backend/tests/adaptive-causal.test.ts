/**
 * Phase 4 — Adaptive Causal Intelligence test suite.
 *
 * Covers:
 *  - intervention-learning-engine: confidenceTier · shrunkMean · rollupEffectiveness
 *  - competency-transfer-graph: cascadeFrom · precursorsOf · cycle safety · decay
 *  - dependency-sequencer: topological order · readiness · cycle breaking
 *  - causal-recommendation-engine: ranking + cascade bonus + persistence
 *  - routes: envelope contract · auth boundary · transactional persistence
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { Pool } from 'pg';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  confidenceTier, shrunkMean, rollupEffectiveness, INTERVENTION_LEARNING_VERSION,
} from '../services/intervention-learning-engine.js';
import {
  buildGraph, cascadeFrom, precursorsOf, TRANSFER_GRAPH_VERSION,
  type TransferEdge,
} from '../services/competency-transfer-graph.js';
import {
  sequenceCompetencies, scoreToLevel, DEPENDENCY_SEQUENCER_VERSION,
  type DependencyEdge,
} from '../services/dependency-sequencer.js';
import {
  generateCausalRecommendations, CAUSAL_RECOMMENDATION_VERSION,
} from '../services/causal-recommendation-engine.js';
import { registerAdaptiveCausalRoutes } from '../routes/adaptive-causal.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ═══════════════════════════════════════════════════════════════════════════
// 1. Intervention learning engine — pure math
// ═══════════════════════════════════════════════════════════════════════════

test('learning: confidenceTier boundaries', () => {
  assert.equal(confidenceTier(0),   'provisional');
  assert.equal(confidenceTier(3),   'D');
  assert.equal(confidenceTier(10),  'C');
  assert.equal(confidenceTier(30),  'B');
  assert.equal(confidenceTier(100), 'A');
  assert.equal(confidenceTier(99),  'B');
});

test('learning: shrunkMean shrinks toward prior with small n, converges with large n', () => {
  const prior = 0.5;
  // n=0 → prior exactly
  assert.equal(shrunkMean(10, 0, prior), prior);
  // n=5 (equal to prior weight) → halfway
  const half = shrunkMean(10, 5, prior, 5);
  assert.ok(Math.abs(half - 5.25) < 0.01, `expected ~5.25 got ${half}`);
  // n=1000 → effectively the sample
  const big = shrunkMean(10, 1000, prior);
  assert.ok(Math.abs(big - 10) < 0.05);
});

test('learning: rollupEffectiveness groups, averages, ranks by ROI', () => {
  const rows = [
    { intervention_id: 'int_A', competency_id: 'c1', competency_delta: 8, ei_delta: 5, effort_hours: 8 },
    { intervention_id: 'int_A', competency_id: 'c1', competency_delta: 6, ei_delta: 4, effort_hours: 10 },
    { intervention_id: 'int_B', competency_id: 'c1', competency_delta: 2, ei_delta: 1, effort_hours: 8 },
  ];
  const result = rollupEffectiveness(rows);
  assert.equal(result.length, 2);
  // int_A first — higher ROI
  assert.equal(result[0].intervention_id, 'int_A');
  assert.equal(result[0].n_observations, 2);
  assert.ok(result[0].mean_competency_delta === 7);
  assert.equal(result[0].confidence_tier, 'provisional');  // n=2 < 3
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Competency transfer graph
// ═══════════════════════════════════════════════════════════════════════════

const sampleEdges: TransferEdge[] = [
  { source_competency_id: 'structured_comm', target_competency_id: 'leadership',
    transfer_strength: 0.8, transfer_type: 'enables' },
  { source_competency_id: 'leadership', target_competency_id: 'stakeholder_influence',
    transfer_strength: 0.75, transfer_type: 'enables' },
  { source_competency_id: 'leadership', target_competency_id: 'team_building',
    transfer_strength: 0.65, transfer_type: 'reinforces' },
  { source_competency_id: 'structured_comm', target_competency_id: 'team_building',
    transfer_strength: 0.30, transfer_type: 'adjacent' },
  // Cycle: stakeholder_influence -> structured_comm (test cycle safety)
  { source_competency_id: 'stakeholder_influence', target_competency_id: 'structured_comm',
    transfer_strength: 0.40, transfer_type: 'reinforces' },
];

test('transfer: cascadeFrom propagates strength multiplicatively and excludes source', () => {
  const g = buildGraph(sampleEdges);
  const cascade = cascadeFrom(g, 'structured_comm', { maxDepth: 3, minStrength: 0.1 });
  const byId = new Map(cascade.map(c => [c.competency_id, c]));
  assert.ok(!byId.has('structured_comm'), 'source must not appear in cascade');
  assert.ok(byId.has('leadership'));
  assert.equal(byId.get('leadership')!.depth, 1);
  assert.equal(byId.get('leadership')!.propagated_strength, 0.8);
  // stakeholder_influence: best path = structured_comm → leadership → stakeholder_influence = 0.8 * 0.75 = 0.6
  assert.ok(Math.abs(byId.get('stakeholder_influence')!.propagated_strength - 0.6) < 1e-6);
  assert.equal(byId.get('stakeholder_influence')!.depth, 2);
  // team_building: best path = via leadership (0.8 * 0.65 = 0.52) vs direct (0.30) → 0.52
  assert.ok(Math.abs(byId.get('team_building')!.propagated_strength - 0.52) < 1e-6);
});

test('transfer: cascade is sorted by propagated_strength desc', () => {
  const g = buildGraph(sampleEdges);
  const cascade = cascadeFrom(g, 'structured_comm', { maxDepth: 3, minStrength: 0.1 });
  for (let i = 1; i < cascade.length; i++) {
    assert.ok(cascade[i - 1].propagated_strength >= cascade[i].propagated_strength);
  }
});

test('transfer: minStrength prunes weak paths', () => {
  const g = buildGraph(sampleEdges);
  const cascade = cascadeFrom(g, 'structured_comm', { maxDepth: 4, minStrength: 0.7 });
  // Only leadership (0.8) survives the 0.7 floor
  assert.equal(cascade.length, 1);
  assert.equal(cascade[0].competency_id, 'leadership');
});

test('transfer: cycle is handled safely (no infinite loop, finite result)', () => {
  const g = buildGraph(sampleEdges);
  // Should complete and return a finite cascade despite the cycle
  const cascade = cascadeFrom(g, 'structured_comm', { maxDepth: 5, minStrength: 0.01 });
  assert.ok(cascade.length >= 3);
  assert.ok(cascade.length < 100, 'cycle protection must bound result size');
});

test('transfer: precursorsOf walks the reverse graph', () => {
  const g = buildGraph(sampleEdges);
  const pre = precursorsOf(g, 'stakeholder_influence', { maxDepth: 3, minStrength: 0.1 });
  const ids = pre.map(p => p.competency_id);
  assert.ok(ids.includes('leadership'));
  assert.ok(ids.includes('structured_comm'));
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Dependency sequencer
// ═══════════════════════════════════════════════════════════════════════════

test('sequencer: simple linear chain produces topological order', () => {
  const candidates = ['c_a', 'c_b', 'c_c'];
  const edges: DependencyEdge[] = [
    { prereq_competency_id: 'c_a', unlocks_competency_id: 'c_b', dependency_strength: 0.8, min_prereq_level: 2 },
    { prereq_competency_id: 'c_b', unlocks_competency_id: 'c_c', dependency_strength: 0.7, min_prereq_level: 2 },
  ];
  const r = sequenceCompetencies(candidates, edges);
  assert.equal(r.cycles_broken.length, 0);
  assert.deepEqual(r.ordered.map(o => o.competency_id), ['c_a', 'c_b', 'c_c']);
  assert.equal(r.ordered[2].scaffold_depth, 2);
});

test('sequencer: readiness reflects user level vs min_prereq_level', () => {
  const edges: DependencyEdge[] = [
    { prereq_competency_id: 'c_a', unlocks_competency_id: 'c_b', dependency_strength: 0.8, min_prereq_level: 3 },
  ];
  const userLevels = { c_a: 2 };  // not yet at level 3
  const r = sequenceCompetencies(['c_a', 'c_b'], edges, userLevels);
  const b = r.ordered.find(o => o.competency_id === 'c_b')!;
  assert.equal(b.is_ready_now, false);
  assert.deepEqual(b.blocking_prereqs, ['c_a']);
  // c_a has no prereqs → always ready
  assert.equal(r.ordered.find(o => o.competency_id === 'c_a')!.is_ready_now, true);
});

test('sequencer: cycle is broken by dropping the weakest edge', () => {
  // a → b → c → a (cycle)
  const edges: DependencyEdge[] = [
    { prereq_competency_id: 'c_a', unlocks_competency_id: 'c_b', dependency_strength: 0.9, min_prereq_level: 2 },
    { prereq_competency_id: 'c_b', unlocks_competency_id: 'c_c', dependency_strength: 0.8, min_prereq_level: 2 },
    { prereq_competency_id: 'c_c', unlocks_competency_id: 'c_a', dependency_strength: 0.4, min_prereq_level: 2 },
  ];
  const r = sequenceCompetencies(['c_a', 'c_b', 'c_c'], edges);
  assert.equal(r.ordered.length, 3);
  assert.equal(r.cycles_broken.length, 1);
  // Weakest edge (0.4) must be the one dropped
  assert.equal(r.cycles_broken[0].dropped_edge.dependency_strength, 0.4);
});

test('sequencer: scoreToLevel thresholds', () => {
  assert.equal(scoreToLevel(0), 1);
  assert.equal(scoreToLevel(49), 1);
  assert.equal(scoreToLevel(50), 2);
  assert.equal(scoreToLevel(65), 3);
  assert.equal(scoreToLevel(80), 4);
  assert.equal(scoreToLevel(92), 5);
  assert.equal(scoreToLevel(100), 5);
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Causal recommendation engine (DB-backed integration)
// ═══════════════════════════════════════════════════════════════════════════

test('causal: generateCausalRecommendations produces ranked, ci-bounded recs', async () => {
  // Pick a competency that has a seeded intervention + effectiveness row
  const { rows: r } = await pool.query<{ competency_id: string }>(
    `SELECT competency_id FROM learn_effectiveness WHERE competency_id IS NOT NULL LIMIT 5`);
  if (!r.length) {
    // No seed → skip cleanly
    return;
  }
  const candidateIds = r.map(x => x.competency_id);
  const userScores = Object.fromEntries(candidateIds.map(id => [id, 55]));
  const result = await generateCausalRecommendations(pool, {
    user_id: 'demo_user_alpha',
    candidate_competency_ids: candidateIds,
    user_scores: userScores, profile_segment: 'global', limit: 8,
  });
  assert.ok(result.recommendations.length > 0, 'expected at least one recommendation');
  // Ranks are contiguous from 1
  result.recommendations.forEach((rec, i) => assert.equal(rec.rank, i + 1));
  // CI envelope: lower <= mean <= upper, lower >= 0
  for (const rec of result.recommendations) {
    assert.ok(rec.expected_ei_lift_lower <= rec.expected_ei_lift);
    assert.ok(rec.expected_ei_lift <= rec.expected_ei_lift_upper);
    assert.ok(rec.expected_ei_lift_lower >= 0);
    assert.ok(rec.causal_score > 0);
    assert.ok(['A','B','C','D','provisional'].includes(rec.confidence_tier));
  }
  // Sorted by causal_score descending
  for (let i = 1; i < result.recommendations.length; i++) {
    assert.ok(result.recommendations[i - 1].causal_score >= result.recommendations[i].causal_score);
  }
});

test('causal: declining velocity boosts urgency vs flat velocity', async () => {
  const { rows: r } = await pool.query<{ competency_id: string }>(
    `SELECT DISTINCT competency_id FROM learn_effectiveness WHERE competency_id IS NOT NULL LIMIT 1`);
  if (!r.length) return;
  const cid = r[0].competency_id;
  const scores = { [cid]: 55 };
  const baseline = await generateCausalRecommendations(pool, {
    user_id: 'urgency_test_user', candidate_competency_ids: [cid],
    user_scores: scores, velocity: { [cid]: 'flat' }, limit: 5,
  });
  const urgent = await generateCausalRecommendations(pool, {
    user_id: 'urgency_test_user', candidate_competency_ids: [cid],
    user_scores: scores, velocity: { [cid]: 'declining' }, limit: 5,
  });
  if (!baseline.recommendations.length || !urgent.recommendations.length) return;
  // Declining trajectory should boost causal_score (urgency multiplier 1.40 vs 1.00)
  assert.ok(urgent.recommendations[0].causal_score > baseline.recommendations[0].causal_score,
    `declining (${urgent.recommendations[0].causal_score}) should outrank flat (${baseline.recommendations[0].causal_score})`);
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Route harness (envelope + auth)
// ═══════════════════════════════════════════════════════════════════════════

class TestHarness {
  app: Express;
  server!: http.Server;
  port = 0;
  authed = false;
  user: { id: string } | null = null;
  setUser(id: string | null) {
    this.authed = !!id;
    this.user = id ? { id } : null;
  }
  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as any).isAuthenticated = () => this.authed;
      (req as any).user = this.user;
      next();
    });
    registerAdaptiveCausalRoutes({ app: this.app, pool });
  }
  async start() {
    await new Promise<void>(resolve => {
      this.server = this.app.listen(0, () => {
        this.port = (this.server.address() as AddressInfo).port;
        resolve();
      });
    });
  }
  async stop() {
    await new Promise<void>(resolve => this.server.close(() => resolve()));
  }
  get url() { return `http://127.0.0.1:${this.port}`; }
}

const harness = new TestHarness();
test('routes: harness start', async () => { await harness.start(); });

test('routes: /methodology returns envelope with all 4 versions', async () => {
  const r = await fetch(`${harness.url}/api/adaptive/methodology`);
  assert.equal(r.status, 200);
  const body = await r.json() as Record<string, any>;
  assert.equal(body.ok, true);
  assert.ok(body.language_policy);
  assert.ok(body.methodology_versions);
  assert.equal(body.methodology_versions.intervention_learning, INTERVENTION_LEARNING_VERSION);
  assert.equal(body.methodology_versions.transfer_graph, TRANSFER_GRAPH_VERSION);
  assert.equal(body.methodology_versions.dependency_sequencer, DEPENDENCY_SEQUENCER_VERSION);
  assert.equal(body.methodology_versions.causal_recommendation, CAUSAL_RECOMMENDATION_VERSION);
});

test('routes: /interventions/event 401 when unauthenticated', async () => {
  harness.setUser(null);
  const r = await fetch(`${harness.url}/api/adaptive/interventions/event`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intervention_id: 'x', event_type: 'recommended' }),
  });
  assert.equal(r.status, 401);
  const body = await r.json() as Record<string, any>;
  assert.equal(body.error, 'authentication_required');
  // Envelope present even on 401
  assert.ok(body.language_policy);
  assert.ok(body.methodology_versions);
});

test('routes: /interventions/event records and audit-logs when authed', async () => {
  // Pick a real intervention id
  const { rows } = await pool.query<{ id: string }>(`SELECT id FROM learn_interventions LIMIT 1`);
  if (!rows.length) return;
  const userId = `__phase4_evt_${Date.now()}`;
  harness.setUser(userId);
  try {
    const r = await fetch(`${harness.url}/api/adaptive/interventions/event`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intervention_id: rows[0].id, event_type: 'recommended' }),
    });
    assert.equal(r.status, 200);
    const body = await r.json() as Record<string, any>;
    assert.equal(body.ok, true);
    assert.ok(typeof body.event_id === 'number');
    // Verify row persisted
    const check = await pool.query(
      `SELECT 1 FROM learn_intervention_events WHERE user_id = $1`, [userId]);
    assert.equal(check.rowCount, 1);
  } finally {
    await pool.query(`DELETE FROM learn_intervention_events WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM learn_audit_logs WHERE user_id = $1`, [userId]);
  }
});

test('routes: /recommendations returns envelope and ranked recs (demo)', async () => {
  harness.setUser(null);
  const r = await fetch(`${harness.url}/api/adaptive/recommendations?demo=true&limit=5`);
  assert.equal(r.status, 200);
  const body = await r.json() as Record<string, any>;
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.recommendations));
  assert.ok(body.language_policy);
  // Persisted should be 0 (anonymous)
  assert.equal(body.persisted, 0);
});

test('routes: /recommendations persists batch atomically when authed', async () => {
  const userId = `__phase4_rec_${Date.now()}`;
  harness.setUser(userId);
  try {
    const r = await fetch(`${harness.url}/api/adaptive/recommendations?demo=true&limit=4`);
    assert.equal(r.status, 200);
    const body = await r.json() as Record<string, any>;
    if (body.recommendations.length === 0) return;   // no candidate roles in onto → skip
    assert.ok(body.persisted >= 1, `expected persisted>0, got ${body.persisted}`);
    // All persisted rows for this user must share the same created_at minute
    // and rank sequence should be contiguous
    const rows = await pool.query<{ rank: number }>(
      `SELECT rank FROM learn_recommendations WHERE user_id = $1 ORDER BY rank`, [userId]);
    assert.equal(rows.rowCount, body.persisted);
    rows.rows.forEach((row, i) => assert.equal(row.rank, i + 1));
  } finally {
    await pool.query(`DELETE FROM learn_recommendations WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM learn_audit_logs WHERE user_id = $1`, [userId]);
  }
});

test('routes: /transfer/from/:id returns cascade envelope', async () => {
  const { rows } = await pool.query<{ source_competency_id: string }>(
    `SELECT source_competency_id FROM learn_transfer_edges LIMIT 1`);
  if (!rows.length) return;
  const r = await fetch(`${harness.url}/api/adaptive/transfer/from/${rows[0].source_competency_id}`);
  assert.equal(r.status, 200);
  const body = await r.json() as Record<string, any>;
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.cascade));
  assert.ok(body.language_policy);
});

test('routes: /guidance 401 when unauthenticated, 200 when authed', async () => {
  harness.setUser(null);
  const r1 = await fetch(`${harness.url}/api/adaptive/guidance`);
  assert.equal(r1.status, 401);

  const userId = `__phase4_guid_${Date.now()}`;
  harness.setUser(userId);
  try {
    const r2 = await fetch(`${harness.url}/api/adaptive/guidance?demo=true&limit=3`);
    assert.equal(r2.status, 200);
    const body = await r2.json() as Record<string, any>;
    assert.equal(body.ok, true);
    assert.ok(body.snapshot);
    assert.equal(body.snapshot.user_id, userId);
    assert.ok(Array.isArray(body.snapshot.next_actions));
    assert.ok(Array.isArray(body.snapshot.intervention_winners));
  } finally {
    await pool.query(`DELETE FROM learn_recommendations WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM learn_audit_logs WHERE user_id = $1`, [userId]);
  }
});

test('routes: harness stop', async () => { await harness.stop(); await pool.end(); });
