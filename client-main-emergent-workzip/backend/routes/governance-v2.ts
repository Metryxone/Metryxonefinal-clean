/**
 * Governance V2 routes (additive, feature-flagged).
 * Mount: /api/v2/gov ; flag: governanceScienceV2.
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import { buildScoreLineageGraph, persistExplainability, graphSummary, EXPLAINABILITY_GRAPH_VERSION } from '../services/explainability-graph-engine';
import {
  demographicParity, disparateImpact, equalOpportunity, scoringImbalance, persistFairness, FAIRNESS_ENGINE_VERSION,
} from '../services/fairness-governance-engine';
import {
  cronbachAlpha, variance, factorLoading, estimateTheta, irt3PL, persistPsychometricModel, persistValidity, persistReliability,
  PSYCHOMETRIC_ENGINE_VERSION,
} from '../services/psychometric-intelligence-engine';
import {
  applyHumanOverride, recordDecisionAudit, registerModel, listModels, listRecentAudits, AI_GOVERNANCE_VERSION,
} from '../services/ai-governance-v2';
import { isGovernanceScienceV2Enabled } from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = { EXPLAINABILITY_GRAPH_VERSION, FAIRNESS_ENGINE_VERSION, PSYCHOMETRIC_ENGINE_VERSION, AI_GOVERNANCE_VERSION };
const LANGUAGE_POLICY = {
  allowed: ['reliability coefficient', 'validity coefficient', 'fairness audit', 'explainability graph', 'model registry'],
  disallowed: ['hiring recommendation', 'promotion ranking', 'individual suitability prediction', 'pass/fail verdict'],
  inference_mode: 'symbolic' as const,
};
function envelope<T extends object>(p: T) { return { ok: true, ...p, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: { governanceScienceV2: isGovernanceScienceV2Enabled() } }; }
function errorEnvelope(error: string, extra: Record<string, unknown> = {}) { return { ok: false, error, ...extra, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: { governanceScienceV2: isGovernanceScienceV2Enabled() } }; }
function requireFlag(_req: Request, res: Response, next: NextFunction) { if (!isGovernanceScienceV2Enabled()) return res.status(503).json(errorEnvelope('governanceScienceV2 disabled')); next(); }
function authUserId(req: Request): string | null {
  const u = (req as Request & { user?: { id?: number | string } }).user;
  if (!u || u.id == null) return null;
  return String(u.id);
}

export function registerGovernanceV2(opts: { app: Express; pool: Pool; requireAuth: RequireAuth }) {
  const { app, pool, requireAuth } = opts;

  app.get('/api/v2/gov/feature-flag', (_req, res) => res.json(envelope({})));
  app.get('/api/v2/gov/_meta/versions', (_req, res) => res.json(envelope({})));

  // ── Explainability ────────────────────────────────────────────────────
  app.get('/api/v2/gov/explainability', requireAuth, requireFlag, async (req, res) => {
    try {
      const auth = authUserId(req); if (auth == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const userId = req.query.userId ? String(req.query.userId) : auth;
      if (userId !== auth) return res.status(403).json(errorEnvelope('forbidden'));
      const r = await pool.query(`SELECT decision_key, graph, summary, created_at FROM explainability_chains WHERE user_id = $1 ORDER BY created_at DESC LIMIT 25`, [userId]);
      res.json(envelope({ chains: r.rows, count: r.rowCount }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  app.post('/api/v2/gov/explainability/build', requireAuth, requireFlag, async (req, res) => {
    try {
      const auth = authUserId(req); if (auth == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const userId = req.body?.userId != null ? String(req.body.userId) : auth;
      if (userId !== auth) return res.status(403).json(errorEnvelope('forbidden'));
      const decisionKey = String(req.body?.decisionKey ?? `decision_${Date.now()}`);
      const graph = buildScoreLineageGraph({
        userId, decisionKey,
        sources: Array.isArray(req.body?.sources) ? req.body.sources : [],
        competencyScores: Array.isArray(req.body?.competencyScores) ? req.body.competencyScores : [],
        recommendations: Array.isArray(req.body?.recommendations) ? req.body.recommendations : [],
      });
      persistExplainability(pool, userId, decisionKey, graph).catch(() => {});
      res.json(envelope({ graph, summary: graphSummary(graph) }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  // ── Fairness ──────────────────────────────────────────────────────────
  app.get('/api/v2/gov/fairness', requireAuth, requireFlag, async (req, res) => {
    try {
      const cohortKey = req.query.cohort_key ? String(req.query.cohort_key) : null;
      const sql = cohortKey
        ? `SELECT cohort_key, metric, protected_group, reference_group, score, threshold, status, details, evaluated_at FROM fairness_evaluations WHERE cohort_key = $1 ORDER BY evaluated_at DESC LIMIT 50`
        : `SELECT cohort_key, metric, protected_group, reference_group, score, threshold, status, evaluated_at FROM fairness_evaluations ORDER BY evaluated_at DESC LIMIT 50`;
      const r = cohortKey ? await pool.query(sql, [cohortKey]) : await pool.query(sql);
      res.json(envelope({ evaluations: r.rows, count: r.rowCount }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  app.post('/api/v2/gov/fairness/evaluate', requireAuth, requireFlag, async (req, res) => {
    try {
      const cohortKey = String(req.body?.cohortKey ?? `cohort_${Date.now()}`);
      const protectedC = req.body?.protected;
      const referenceC = req.body?.reference;
      if (!protectedC || !referenceC) return res.status(400).json(errorEnvelope('protected + reference cohorts required'));
      const results = [
        demographicParity(protectedC, referenceC),
        disparateImpact(protectedC, referenceC),
        scoringImbalance(protectedC, referenceC),
      ];
      if (typeof req.body?.protectedTPR === 'number' && typeof req.body?.referenceTPR === 'number') {
        results.push(equalOpportunity(req.body.protectedTPR, req.body.referenceTPR, { protected_n: protectedC.total, reference_n: referenceC.total }));
      }
      persistFairness(pool, cohortKey, results).catch(() => {});
      res.json(envelope({ cohort_key: cohortKey, results }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  // ── Psychometrics / Reliability ───────────────────────────────────────
  app.get('/api/v2/gov/psychometrics', requireAuth, requireFlag, async (_req, res) => {
    try {
      const r = await pool.query(`SELECT model_key, competency_key, irt_a, irt_b, irt_c, cronbach_alpha, factor_loading, sample_size, created_at FROM psychometric_models ORDER BY created_at DESC LIMIT 100`);
      const v = await pool.query(`SELECT competency_key, validity_type, coefficient, sample_size, computed_at FROM competency_validity_models ORDER BY computed_at DESC LIMIT 100`);
      res.json(envelope({ models: r.rows, validity: v.rows }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  app.post('/api/v2/gov/psychometrics/compute', requireAuth, requireFlag, async (req, res) => {
    try {
      const competencyKey = String(req.body?.competencyKey ?? 'COG');
      const itemMatrix: number[][] = Array.isArray(req.body?.itemMatrix) ? req.body.itemMatrix : []; // rows = respondents, cols = items
      if (!itemMatrix.length || !itemMatrix[0]?.length) return res.status(400).json(errorEnvelope('itemMatrix required'));
      const k = itemMatrix[0].length;
      const itemVars = Array.from({ length: k }, (_, j) => variance(itemMatrix.map((row) => row[j] ?? 0)));
      const totals = itemMatrix.map((row) => row.reduce((s, x) => s + (x ?? 0), 0));
      const alpha = cronbachAlpha(itemVars, variance(totals));
      const loadings = Array.from({ length: k }, (_, j) => factorLoading(itemMatrix.map((row) => row[j] ?? 0), totals));
      const modelKey = `psycho_${competencyKey}_${Date.now()}`;
      const meanLoading = loadings.reduce((a, b) => a + b, 0) / loadings.length;
      // Atomic persistence — all three rows commit together or none do.
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await persistPsychometricModel(client, { modelKey, competencyKey, alpha, loading: meanLoading, sampleSize: itemMatrix.length });
        await persistReliability(client, competencyKey, 'internal_consistency', alpha, itemMatrix.length);
        await persistValidity(client, competencyKey, 'construct', meanLoading, itemMatrix.length);
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK').catch(() => {});
        throw txErr;
      } finally {
        client.release();
      }
      res.json(envelope({ model_key: modelKey, alpha: Math.round(alpha * 1000) / 1000, mean_loading: Math.round(meanLoading * 1000) / 1000, per_item_loadings: loadings.map((x) => Math.round(x * 1000) / 1000), sample_size: itemMatrix.length }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  app.post('/api/v2/gov/psychometrics/estimate-theta', requireAuth, requireFlag, async (req, res) => {
    try {
      const responses = Array.isArray(req.body?.responses) ? req.body.responses : [];
      if (!responses.length) return res.status(400).json(errorEnvelope('responses required'));
      const theta = estimateTheta(responses);
      // Convert latent theta (-4..4) to a normalised 0..100 proficiency for UI consumption
      const proficiency = Math.round(((theta + 4) / 8) * 1000) / 10;
      const exampleProb = responses.length ? irt3PL(theta, responses[0].a, responses[0].b, responses[0].c) : null;
      res.json(envelope({ theta: Math.round(theta * 1000) / 1000, proficiency, example_p_correct: exampleProb }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  app.get('/api/v2/gov/reliability', requireAuth, requireFlag, async (_req, res) => {
    try {
      const r = await pool.query(`SELECT competency_key, reliability_type, coefficient, sample_size, computed_at FROM reliability_validation_models ORDER BY computed_at DESC LIMIT 100`);
      res.json(envelope({ reliability: r.rows }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  // ── Model registry + audits ───────────────────────────────────────────
  app.get('/api/v2/gov/models', requireAuth, requireFlag, async (_req, res) => {
    try { res.json(envelope({ models: await listModels(pool) })); } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });
  app.post('/api/v2/gov/models/register', requireAuth, requireFlag, async (req, res) => {
    try {
      const modelKey = String(req.body?.modelKey ?? '');
      const version = String(req.body?.version ?? '');
      if (!modelKey || !version) return res.status(400).json(errorEnvelope('modelKey + version required'));
      await registerModel(pool, { modelKey, version, owner: req.body?.owner, status: req.body?.status, metadata: req.body?.metadata });
      res.json(envelope({ registered: true, model_key: modelKey, version }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });
  app.get('/api/v2/gov/audits', requireAuth, requireFlag, async (req, res) => {
    try { res.json(envelope({ audits: await listRecentAudits(pool, Math.min(200, Number(req.query.limit) || 50)) })); } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });
  app.post('/api/v2/gov/audit', requireAuth, requireFlag, async (req, res) => {
    try {
      const auth = authUserId(req); if (auth == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const decisionKey = String(req.body?.decisionKey ?? `decision_${Date.now()}`);
      const policy = await recordDecisionAudit(pool, { decisionKey, userId: auth, inputs: req.body?.inputs ?? {}, outputs: req.body?.outputs ?? {}, reasoning: req.body?.reasoning ?? {} });
      res.json(envelope({ decision_key: decisionKey, policy_check: policy }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  // ── Human override ────────────────────────────────────────────────────
  app.post('/api/v2/gov/override', requireAuth, requireFlag, async (req, res) => {
    try {
      const auth = authUserId(req); if (auth == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const decisionKey = String(req.body?.decisionKey ?? '');
      const userId = req.body?.userId != null ? String(req.body.userId) : '';
      const overrideValue = req.body?.overrideValue;
      const justification = String(req.body?.justification ?? '').trim();
      if (!decisionKey || !userId || overrideValue == null || !justification) return res.status(400).json(errorEnvelope('decisionKey, userId, overrideValue, justification required'));
      // Override workflow: requester (auth) MUST be a superadmin per role-based contract; minimal guard here = require requester is the affected user OR matches an admin flag. For now: only self-override (no admin role plumbed in this slice).
      if (userId !== auth) return res.status(403).json(errorEnvelope('forbidden — only self-override supported in this slice'));
      const r = await applyHumanOverride(pool, { decisionKey, userId, requestedBy: auth, originalValue: req.body?.originalValue ?? null, overrideValue, justification });
      res.json(envelope({ override: r }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });
}
