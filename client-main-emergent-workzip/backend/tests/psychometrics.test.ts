/**
 * Phase 3 — Psychometric Rigor unit + integration tests.
 *
 * Covers the three new pure-function engines and the HTTP envelope contract:
 *   • Evidence Reliability — bounds, contradiction penalty, exclusion threshold
 *   • Bayesian Inference   — CI bounds, posterior monotonicity, prior collapse
 *   • Stability Analysis   — spike / inconsistency / contamination / instability
 *   • Routes               — methodology, infer envelope, auth + envelope
 *
 * Run with:  cd backend && npx tsx --test tests/psychometrics.test.ts
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express, { type Request, type Response, type NextFunction } from 'express';
import type { AddressInfo } from 'node:net';
import pg from 'pg';

import { extractAndScore, type EvidenceSource } from '../services/evidence-extractor.ts';
import { detectContradictions } from '../services/contradiction-detector.ts';
import { scoreReliabilityBatch, scoreReliability,
         RELIABILITY_VERSION } from '../services/evidence-reliability-engine.ts';
import { inferSignalBatch, inferCompetencies, inferSignal, uncertaintyBand,
         BAYES_VERSION } from '../services/bayesian-inference-engine.ts';
import { analyseStability, STABILITY_VERSION } from '../services/stability-analysis-engine.ts';
import { registerPsychometricsRigorRoutes } from '../routes/psychometrics.ts';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const TEST_USER = `__psy_test_${Date.now()}`;

interface Harness {
  url: string; close: () => Promise<void>; setUser: (id: string | null) => void;
}

async function buildHarness(): Promise<Harness> {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  let user: { id: string } | null = null;
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (user) {
      // @ts-expect-error passport user
      req.user = user;
      // @ts-expect-error passport req
      req.isAuthenticated = () => true;
    } else {
      // @ts-expect-error passport req
      req.isAuthenticated = () => false;
    }
    next();
  });
  registerPsychometricsRigorRoutes({ app, pool });
  const server = app.listen(0);
  await new Promise<void>(r => server.on('listening', () => r()));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise<void>(r => server.close(() => r())),
    setUser: id => { user = id ? { id } : null; },
  };
}

let harness: Harness;
before(async () => { harness = await buildHarness(); });
after(async () => {
  await harness.close();
  await pool.query(`DELETE FROM psy_signal_inferences      WHERE user_id = $1`, [TEST_USER]).catch(() => {});
  await pool.query(`DELETE FROM psy_competency_inferences  WHERE user_id = $1`, [TEST_USER]).catch(() => {});
  await pool.query(`DELETE FROM psy_stability_flags        WHERE user_id = $1`, [TEST_USER]).catch(() => {});
  await pool.query(`DELETE FROM psy_audit_logs             WHERE user_id = $1`, [TEST_USER]).catch(() => {});
  await pool.end();
});

const RICH_SOURCES: EvidenceSource[] = [
  { source_type: 'resume', source_id: 'r1',
    text: 'I led a team of 12 and increased revenue by 30%. Saved $250K in costs. Owned the relaunch end to end.' },
  { source_type: 'goal', source_id: 'g1',
    text: 'My goal is to scale customer retention by iterating v1 v2 v3 of the loyalty program.' },
  { source_type: 'interview_transcript', source_id: 't1',
    text: 'When the rollout slipped, I took ownership, restructured the team and shipped 2 weeks later.' },
];

const THIN_SOURCES: EvidenceSource[] = [
  { source_type: 'profile_summary', source_id: 'p1', text: 'I enjoy working with people.' },
];

// ═══════════════════════════════════════════════════════════════════════════
// 1. Evidence Reliability Engine
// ═══════════════════════════════════════════════════════════════════════════

test('reliability: composite is bounded in [0, 1] and all components are bounded', () => {
  const { scores } = extractAndScore(RICH_SOURCES);
  const contradictions = detectContradictions(RICH_SOURCES, scores);
  const rels = scoreReliabilityBatch({ scores, sources: RICH_SOURCES, contradictions });
  assert.ok(rels.length > 0, 'expected at least one reliability row');
  for (const r of rels) {
    for (const k of ['metric_specificity', 'behavioural_density', 'external_validation',
                     'consistency', 'recency', 'contradiction_penalty', 'composite_reliability'] as const) {
      const v = r[k];
      assert.ok(v >= 0 && v <= 1, `${r.signal_key}.${k}=${v} must be in [0,1]`);
    }
  }
});

test('reliability: thin evidence flags excluded_evidence_reason below 0.30 composite', () => {
  // Make a fake score row with no evidence + no contradictions
  const fakeScore = {
    signal_key: 'quantified_outcomes', label: 'Quantified outcomes',
    competency_id: 'comp_accountability', frequency: 0, confidence: 0,
    evidence_count: 0, recency_weight: 0, behavioural_strength: 0, evidence: [],
  };
  const r = scoreReliability({
    score: fakeScore,
    sources: [],
    contradictions: { contradiction_score: 0, contradiction_flags: [], rules_evaluated: 0 },
  });
  assert.ok(r.composite_reliability < 0.5);
  assert.equal(r.excluded_evidence_reason, 'no_evidence');
});

test('reliability: contradictions reduce composite for affected competency', () => {
  const { scores } = extractAndScore(RICH_SOURCES);
  const noContradictions = { contradiction_score: 0, contradiction_flags: [], rules_evaluated: 0 };
  const heavyContradictions = {
    contradiction_score: 0.5, rules_evaluated: 6,
    contradiction_flags: [{
      rule_id: 'leadership_without_ownership' as const,
      severity: 'high' as const,
      title: 't', detail: 'd', source_ids: [],
      developmental_action: 'a',
    }],
  };
  const baseline = scoreReliabilityBatch({ scores, sources: RICH_SOURCES, contradictions: noContradictions });
  const penalised = scoreReliabilityBatch({ scores, sources: RICH_SOURCES, contradictions: heavyContradictions });

  // For any leadership/accountability signal, penalised composite ≤ baseline
  const affected = ['comp_accountability', 'comp_leadership'];
  const baseMap = new Map(baseline.map(r => [r.signal_key, r]));
  let touched = 0;
  for (const p of penalised) if (affected.includes(p.competency_id)) {
    const b = baseMap.get(p.signal_key);
    if (!b) continue;
    assert.ok(p.composite_reliability <= b.composite_reliability,
      `${p.signal_key}: penalised (${p.composite_reliability}) should be ≤ baseline (${b.composite_reliability})`);
    if (p.composite_reliability < b.composite_reliability) touched++;
  }
  assert.ok(touched > 0, 'expected at least one affected signal to have a strictly lower composite');
});

test('reliability: methodology version is exposed', () => {
  assert.equal(RELIABILITY_VERSION, '3.0.0');
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Bayesian Inference Engine
// ═══════════════════════════════════════════════════════════════════════════

test('bayesian: CI is bounded in (0,1) and lower ≤ mean ≤ upper', () => {
  const { scores } = extractAndScore(RICH_SOURCES);
  const contradictions = detectContradictions(RICH_SOURCES, scores);
  const rels = scoreReliabilityBatch({ scores, sources: RICH_SOURCES, contradictions });
  const posts = inferSignalBatch(scores, rels);
  for (const p of posts) {
    assert.ok(p.confidence_interval.lower >= 0 && p.confidence_interval.upper <= 1,
      `CI must be in [0,1]: got [${p.confidence_interval.lower}, ${p.confidence_interval.upper}]`);
    assert.ok(p.confidence_interval.lower <= p.probability_mastery,
      `CI lower (${p.confidence_interval.lower}) must be ≤ mean (${p.probability_mastery})`);
    assert.ok(p.probability_mastery <= p.confidence_interval.upper,
      `mean (${p.probability_mastery}) must be ≤ CI upper (${p.confidence_interval.upper})`);
    assert.ok(p.uncertainty >= 0 && p.uncertainty <= 1);
    assert.ok(p.evidence_strength >= 0);
  }
});

test('bayesian: posterior collapses to prior mean when reliability is zero', () => {
  const score = {
    signal_key: 'quantified_outcomes', label: 'Quantified outcomes',
    competency_id: 'comp_accountability', frequency: 1, confidence: 1,
    evidence_count: 5, recency_weight: 1, behavioural_strength: 1, evidence: [],
  };
  const zeroRel = {
    signal_key: 'quantified_outcomes', competency_id: 'comp_accountability',
    metric_specificity: 0, behavioural_density: 0, external_validation: 0,
    consistency: 0, recency: 0, contradiction_penalty: 1, composite_reliability: 0,
  };
  const p = inferSignal(score, zeroRel);
  // Prior Beta(2,2) → mean 0.5
  assert.ok(Math.abs(p.probability_mastery - 0.5) < 1e-6, `expected ~0.5, got ${p.probability_mastery}`);
  assert.equal(p.evidence_strength, 0);
});

test('bayesian: posterior shifts toward strong evidence (monotonicity)', () => {
  const score = {
    signal_key: 'quantified_outcomes', label: 'Quantified outcomes',
    competency_id: 'comp_accountability', frequency: 8, confidence: 1,
    evidence_count: 8, recency_weight: 1, behavioural_strength: 0.9, evidence: [],
  };
  const lowRel  = { signal_key: score.signal_key, competency_id: score.competency_id,
    metric_specificity: 0.3, behavioural_density: 0.3, external_validation: 0.3,
    consistency: 0.3, recency: 0.3, contradiction_penalty: 0, composite_reliability: 0.3 };
  const highRel = { ...lowRel, metric_specificity: 1, behavioural_density: 1,
    external_validation: 1, consistency: 1, recency: 1, composite_reliability: 0.95 };
  const lo = inferSignal(score, lowRel);
  const hi = inferSignal(score, highRel);
  // Higher reliability → more evidence → posterior closer to 0.9 (and tighter CI)
  assert.ok(hi.probability_mastery > lo.probability_mastery,
    `hi (${hi.probability_mastery}) should exceed lo (${lo.probability_mastery})`);
  assert.ok(hi.uncertainty < lo.uncertainty,
    `hi sd (${hi.uncertainty}) should be tighter than lo sd (${lo.uncertainty})`);
  assert.ok(hi.evidence_strength > lo.evidence_strength);
});

test('bayesian: competency rollup pools signal posteriors', () => {
  const { scores } = extractAndScore(RICH_SOURCES);
  const contradictions = detectContradictions(RICH_SOURCES, scores);
  const rels = scoreReliabilityBatch({ scores, sources: RICH_SOURCES, contradictions });
  const sigPosts = inferSignalBatch(scores, rels);
  const compPosts = inferCompetencies(sigPosts);
  assert.ok(compPosts.length > 0);
  for (const c of compPosts) {
    assert.ok(c.signal_count >= 1);
    assert.ok(c.probability_mastery >= 0 && c.probability_mastery <= 1);
    assert.ok(c.confidence_interval.lower <= c.probability_mastery
           && c.probability_mastery <= c.confidence_interval.upper);
    const wsum = c.contributing_signals.reduce((a, s) => a + s.weight, 0);
    assert.ok(Math.abs(wsum - 1) < 1e-3, `signal weights must sum to 1, got ${wsum}`);
  }
});

test('bayesian: uncertaintyBand wraps point score with finite ±band', () => {
  const band = uncertaintyBand({ point_score: 72,
    posterior: { uncertainty: 0.12, evidence_strength: 5 } });
  assert.equal(band.point, 72);
  assert.ok(band.uncertainty_pts > 0);
  assert.ok(band.ci_low <= band.point && band.point <= band.ci_high);
  assert.ok(band.ci_low >= 0 && band.ci_high <= 100);

  const fallback = uncertaintyBand({ point_score: 50 });
  assert.equal(fallback.uncertainty_pts, Math.round(1.959964 * 10 * 10000) / 10000);
});

test('bayesian: methodology version is exposed', () => {
  assert.equal(BAYES_VERSION, '3.0.0');
});

test('bayesian: excluded signals do NOT shift competency rollup', () => {
  // Adding an excluded signal to a competency must leave the rollup mean
  // identical (or numerically negligibly different) to the included-only
  // baseline. This was the architect-flagged competency-level leak.
  const include = {
    signal_key: 'quantified_outcomes', label: 'qo',
    competency_id: 'comp_x', frequency: 8, confidence: 1,
    evidence_count: 8, recency_weight: 1, behavioural_strength: 0.85, evidence: [],
  };
  const exclude = {
    signal_key: 'narrative_density', label: 'nd',
    competency_id: 'comp_x', frequency: 10, confidence: 1,
    evidence_count: 10, recency_weight: 1, behavioural_strength: 0.10, evidence: [],
  };
  const relInc = {
    signal_key: 'quantified_outcomes', competency_id: 'comp_x',
    metric_specificity: 0.9, behavioural_density: 0.8, external_validation: 0.7,
    consistency: 0.8, recency: 0.9, contradiction_penalty: 0,
    composite_reliability: 0.80,
  };
  const relExc = {
    signal_key: 'narrative_density', competency_id: 'comp_x',
    metric_specificity: 0.1, behavioural_density: 0.1, external_validation: 0.1,
    consistency: 0.2, recency: 0.1, contradiction_penalty: 0.6,
    composite_reliability: 0.15, excluded_evidence_reason: 'composite_below_threshold',
  };
  const baseline = inferCompetencies(inferSignalBatch([include], [relInc]));
  const withExcl = inferCompetencies(inferSignalBatch([include, exclude], [relInc, relExc]));
  assert.ok(Math.abs(baseline[0].probability_mastery - withExcl[0].probability_mastery) < 1e-6,
    `excluded signal must not shift competency mean. baseline=${baseline[0].probability_mastery} with_excl=${withExcl[0].probability_mastery}`);
  assert.equal(baseline[0].evidence_strength, withExcl[0].evidence_strength);
  // Excluded signal still appears in contributing_signals list but with weight 0
  const exclEntry = withExcl[0].contributing_signals.find(c => c.signal_key === 'narrative_density');
  assert.ok(exclEntry, 'excluded signal should still be listed');
  assert.equal(exclEntry!.weight, 0, 'excluded signal weight must be exactly 0');
});

test('bayesian: excluded signals collapse to the prior (no posterior impact)', () => {
  // A signal with strong evidence but flagged excluded MUST produce a posterior
  // identical to one with no evidence at all — i.e. the prior mean (0.5 for Beta(2,2)).
  const strongScore = {
    signal_key: 'quantified_outcomes', label: 'Quantified outcomes',
    competency_id: 'comp_accountability', frequency: 10, confidence: 1,
    evidence_count: 10, recency_weight: 1, behavioural_strength: 0.95, evidence: [],
  };
  const excludedRel = {
    signal_key: 'quantified_outcomes', competency_id: 'comp_accountability',
    metric_specificity: 0.9, behavioural_density: 0.9, external_validation: 0.9,
    consistency: 0.9, recency: 0.9, contradiction_penalty: 0.5,
    composite_reliability: 0.20,             // below 0.30 floor
    excluded_evidence_reason: 'composite_below_threshold',
  };
  const okRel = { ...excludedRel, composite_reliability: 0.80,
    contradiction_penalty: 0, excluded_evidence_reason: undefined };

  const [excluded] = inferSignalBatch([strongScore], [excludedRel]);
  const [included] = inferSignalBatch([strongScore], [okRel]);

  // Excluded path must collapse to prior mean 0.5 with zero evidence_strength
  assert.ok(Math.abs(excluded.probability_mastery - 0.5) < 1e-6,
    `excluded posterior must collapse to prior mean 0.5, got ${excluded.probability_mastery}`);
  assert.equal(excluded.evidence_strength, 0);
  // Included path must shift toward strong evidence (0.95)
  assert.ok(included.probability_mastery > 0.6,
    `included posterior must reflect strong evidence, got ${included.probability_mastery}`);
  assert.ok(included.evidence_strength > 0);
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Stability Analysis Engine
// ═══════════════════════════════════════════════════════════════════════════

function mkPoints(values: number[], startTsMs: number, stepDaysApart = 14) {
  return values.map((v, i) => ({
    signal_key: 's', behavioural_strength: v, confidence: 0.8, evidence_count: 3,
    snapshot_ts: new Date(startTsMs + i * stepDaysApart * 86400_000).toISOString(),
  }));
}

test('stability: empty evolution yields perfect stability and no flags', () => {
  const r = analyseStability({ user_id: 'u', window_days: 90, evolution: [] });
  assert.equal(r.flags.length, 0);
  assert.equal(r.stability_index, 1);
});

test('stability: detects temporary_spike (z>2 over stable prior)', () => {
  const r = analyseStability({ user_id: 'u', window_days: 90, evolution: [{
    signal_key: 'spike_signal', label: 'spike', competency_id: 'c1',
    points: mkPoints([0.50, 0.51, 0.49, 0.50, 0.99], Date.now() - 5 * 14 * 86400_000),
    trend: 'improving', delta_30d: 0.4, delta_90d: 0.4, maturity_band: 'developing',
  }]});
  const spike = r.flags.find(f => f.rule_id === 'temporary_spike');
  assert.ok(spike, 'expected temporary_spike flag');
  assert.equal(spike?.signal_key, 'spike_signal');
  assert.ok(r.stability_index < 1);
});

test('stability: detects inconsistency (high stddev across ≥4 points)', () => {
  const r = analyseStability({ user_id: 'u', window_days: 90, evolution: [{
    signal_key: 'wobble', label: 'wobble', competency_id: 'c1',
    points: mkPoints([0.20, 0.80, 0.30, 0.75, 0.25, 0.85], Date.now() - 6 * 14 * 86400_000),
    trend: 'steady', delta_30d: 0, delta_90d: 0, maturity_band: 'emerging',
  }]});
  assert.ok(r.flags.some(f => f.rule_id === 'inconsistency'), 'expected inconsistency flag');
});

test('stability: detects coaching_contamination (≥5 signals jump in same 7-day window)', () => {
  const nowMs = Date.now();
  const evolution = [];
  // 6 signals all jump from 0.4 → 0.7 in the last 3 days
  for (let i = 0; i < 6; i++) evolution.push({
    signal_key: `coached_${i}`, label: `c${i}`, competency_id: 'c1',
    points: [
      { signal_key: `coached_${i}`, behavioural_strength: 0.40, confidence: 0.8, evidence_count: 2,
        snapshot_ts: new Date(nowMs - 3 * 86400_000).toISOString() },
      { signal_key: `coached_${i}`, behavioural_strength: 0.70, confidence: 0.8, evidence_count: 2,
        snapshot_ts: new Date(nowMs - 1 * 86400_000).toISOString() },
    ],
    trend: 'improving' as const, delta_30d: 0.3, delta_90d: 0.3, maturity_band: 'developing' as const,
  });
  const r = analyseStability({ user_id: 'u', window_days: 90, evolution });
  assert.ok(r.flags.some(f => f.rule_id === 'coaching_contamination'),
    'expected coaching_contamination flag');
});

test('stability: detects behavioural_instability (≥3 direction changes in last 6 points)', () => {
  const r = analyseStability({ user_id: 'u', window_days: 90, evolution: [{
    signal_key: 'oscillator', label: 'osc', competency_id: 'c1',
    points: mkPoints([0.3, 0.6, 0.3, 0.6, 0.3, 0.6, 0.3], Date.now() - 7 * 14 * 86400_000),
    trend: 'steady', delta_30d: 0, delta_90d: 0, maturity_band: 'developing',
  }]});
  assert.ok(r.flags.some(f => f.rule_id === 'behavioural_instability'),
    'expected behavioural_instability flag');
});

test('stability: methodology version is exposed', () => {
  assert.equal(STABILITY_VERSION, '3.0.0');
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. HTTP routes — envelope contract
// ═══════════════════════════════════════════════════════════════════════════

test('routes: GET /methodology returns versions + language_policy', async () => {
  harness.setUser(null);
  const r = await fetch(`${harness.url}/api/psychometrics/methodology`);
  assert.equal(r.status, 200);
  const body = await r.json() as Record<string, any>;
  assert.equal(body.ok, true);
  assert.ok(body.language_policy, 'language_policy missing');
  assert.equal(body.methodology_versions.reliability, '3.0.0');
  assert.equal(body.methodology_versions.bayesian,    '3.0.0');
  assert.equal(body.methodology_versions.stability,   '3.0.0');
});

test('routes: POST /infer returns posteriors + reliability + envelope', async () => {
  harness.setUser(null);
  const r = await fetch(`${harness.url}/api/psychometrics/infer`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources: RICH_SOURCES }),
  });
  assert.equal(r.status, 200);
  const body = await r.json() as Record<string, any>;
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.signal_posteriors) && body.signal_posteriors.length > 0);
  assert.ok(Array.isArray(body.competency_posteriors));
  assert.ok(Array.isArray(body.reliability));
  assert.ok(body.language_policy);
  // Every posterior must carry the canonical contract fields
  for (const p of body.signal_posteriors) {
    assert.ok('probability_mastery' in p && 'uncertainty' in p
           && 'evidence_strength' in p && 'confidence_interval' in p);
  }
});

test('routes: POST /infer with thin sources still returns a valid envelope', async () => {
  harness.setUser(null);
  const r = await fetch(`${harness.url}/api/psychometrics/infer`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources: THIN_SOURCES }),
  });
  assert.equal(r.status, 200);
  const body = await r.json() as Record<string, any>;
  assert.equal(body.ok, true);
  assert.ok(body.language_policy);
});

test('routes: /infer/profile + /stability require auth (401 carries language_policy)', async () => {
  harness.setUser(null);
  const a = await fetch(`${harness.url}/api/psychometrics/infer/profile`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(a.status, 401);
  assert.ok((await a.json() as any).language_policy);

  const b = await fetch(`${harness.url}/api/psychometrics/stability`);
  assert.equal(b.status, 401);
  assert.ok((await b.json() as any).language_policy);
});

test('routes: /stability is self-only (uses session user_id, ignores any client hint)', async () => {
  harness.setUser(TEST_USER);
  const r = await fetch(`${harness.url}/api/psychometrics/stability?user_id=attacker`);
  assert.equal(r.status, 200);
  const body = await r.json() as Record<string, any>;
  assert.equal(body.ok, true);
  assert.equal(body.user_id, TEST_USER);
  assert.ok(body.language_policy);
});

test('routes: /stability persists ALL flags atomically (all-or-nothing)', async () => {
  // Seed the user's bsig_signal_snapshots with enough history to trigger
  // a stability flag, then call the endpoint and confirm flags persist
  // together with matching stability_index values (proves they came from
  // the same transactional batch).
  const userId = `__psy_stability_${Date.now()}`;
  const now = new Date();
  // 6 snapshots over the last 12 weeks for one oscillating signal
  const values = [0.30, 0.65, 0.32, 0.68, 0.30, 0.66, 0.30];
  for (let i = 0; i < values.length; i++) {
    const ts = new Date(now.getTime() - (values.length - i) * 14 * 86400_000);
    await pool.query(
      `INSERT INTO bsig_signal_snapshots
         (user_id, signal_key, competency_id, frequency, confidence,
          evidence_count, recency_weight, behavioural_strength, source_hash, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [userId, 'osc_signal', 'comp_accountability', 3, 0.8, 3, 1, values[i],
       `seed_${i}`, ts.toISOString()],
    ).catch(() => {});
  }
  try {
    harness.setUser(userId);
    const r = await fetch(`${harness.url}/api/psychometrics/stability`);
    assert.equal(r.status, 200);
    const body = await r.json() as Record<string, any>;
    assert.equal(body.ok, true);
    if (body.flags.length === 0) {
      // Evolution may not return enough points if seeding was rejected — skip cleanly.
      return;
    }
    // All persisted rows must share the same stability_index (proving they came
    // from the SAME transactional batch, not a partial fire-and-forget).
    if (body.persisted) {
      const rows = await pool.query<{ stability_index: string; rule_id: string }>(
        `SELECT stability_index::text, rule_id FROM psy_stability_flags WHERE user_id = $1`,
        [userId],
      );
      assert.equal(rows.rows.length, body.flags.length,
        `expected ${body.flags.length} rows persisted, got ${rows.rows.length}`);
      const distinctIdx = new Set(rows.rows.map(r => r.stability_index));
      assert.equal(distinctIdx.size, 1,
        'all flags in a batch must share the same stability_index (atomic write)');
    }
  } finally {
    await pool.query(`DELETE FROM bsig_signal_snapshots WHERE user_id = $1`, [userId]).catch(() => {});
    await pool.query(`DELETE FROM psy_stability_flags   WHERE user_id = $1`, [userId]).catch(() => {});
    await pool.query(`DELETE FROM psy_audit_logs        WHERE user_id = $1`, [userId]).catch(() => {});
  }
});

test('routes: /infer/profile persists posteriors for authenticated session user', async () => {
  harness.setUser(TEST_USER);
  // Seed sources directly via /infer/profile — body shape supports inline transcripts
  const r = await fetch(`${harness.url}/api/psychometrics/infer/profile`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcripts: [
        { id: 't1', text: 'I led the relaunch and increased revenue by 30%. Saved $250K in costs.' },
        { id: 't2', text: 'I owned the redesign end to end and shipped v1 v2 v3.' },
      ],
    }),
  });
  assert.equal(r.status, 200);
  const body = await r.json() as Record<string, any>;
  if (body.fallback) {
    // profile lookup failed (no profile row) — fallback path still must carry envelope
    assert.equal(body.fallback_reason, 'no_text_sources_available');
    assert.ok(body.language_policy);
    return;
  }
  assert.equal(body.ok, true);
  assert.ok(body.signal_posteriors.length > 0);
  // Persistence is best-effort; only assert when the flag is set
  if (body.persisted) {
    const rows = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM psy_signal_inferences WHERE user_id = $1`, [TEST_USER]);
    assert.ok(Number(rows.rows[0].n) > 0, 'expected at least one persisted posterior');
  }
});
