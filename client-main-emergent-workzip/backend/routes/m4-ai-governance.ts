/**
 * Phase 4 — AI Governance + Localization + Predictive + Simulation
 *          + Org Risk + Observability routes
 *
 * Mounted at /api/m4/*. Every response wrapped in explainability envelope.
 * Mutating endpoints write to m4_audit_logs.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { wrap } from '../services/explainability-engine';
import { createAIGovernance, AI_GOVERNANCE_VERSION } from '../services/m4-ai-governance';
import { createFairness, FAIRNESS_VERSION } from '../services/m4-fairness';
import { createLocalization, LOCALIZATION_VERSION } from '../services/m4-localization';
import {
  createPredictive,
  PREDICTIVE_VERSION, TRAJECTORY_VERSION, READINESS_VERSION,
  BURNOUT_VERSION, CAPABILITY_FORECAST_VERSION,
} from '../services/m4-predictive';
import { createSimulation, SIMULATION_VERSION } from '../services/m4-simulation';
import { createOrgRisk, ORG_RISK_VERSION } from '../services/m4-org-risk';
import { createObservability, OBSERVABILITY_VERSION } from '../services/m4-observability';

const METHOD_VERSIONS = {
  ai_governance: AI_GOVERNANCE_VERSION,
  fairness: FAIRNESS_VERSION,
  localization: LOCALIZATION_VERSION,
  predictive: PREDICTIVE_VERSION,
  trajectory: TRAJECTORY_VERSION,
  readiness: READINESS_VERSION,
  burnout: BURNOUT_VERSION,
  capability_forecast: CAPABILITY_FORECAST_VERSION,
  simulation: SIMULATION_VERSION,
  org_risk: ORG_RISK_VERSION,
  observability: OBSERVABILITY_VERSION,
};

function parseJson(v: any): any { try { return v ? JSON.parse(String(v)) : null; } catch { return null; } }
function parseScores(v: any): Record<string, number> | null {
  const o = parseJson(v); if (!o || typeof o !== 'object') return null;
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(o)) { const n = Number(val); if (Number.isFinite(n)) out[k] = n; }
  return out;
}

export function registerM4Routes(opts: { app: Express; pool: Pool }) {
  const { app, pool } = opts;
  const gov = createAIGovernance(pool);
  const fair = createFairness(pool);
  const loc = createLocalization(pool);
  const pred = createPredictive(pool);
  const sim = createSimulation(pool);
  const risk = createOrgRisk(pool);
  const obs = createObservability(pool);

  async function audit(domain: string, action: string, subject: string | null, req: Request, payload: any = {}) {
    try {
      const id = `m4a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      await pool.query(
        `INSERT INTO m4_audit_logs(id, domain, action, subject_id, payload, request_id, ip)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, domain, action, subject, JSON.stringify(payload),
         (req.headers['x-request-id'] as string) ?? null, req.ip ?? null]);
    } catch { /* non-blocking */ }
  }

  function guard(handler: (req: Request) => Promise<any>, scoreType: string, rationale: string) {
    return async (req: Request, res: Response) => {
      try {
        const data = await handler(req);
        res.json({ ok: true, ...wrap({ data }, {
          score_type: scoreType, score: null, contributors: [],
          methodology: { versions: METHOD_VERSIONS }, rationale,
        }) });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' });
      }
    };
  }

  // ---- Governance --------------------------------------------------------
  app.get('/api/m4/gov/policies', guard(
    async (req) => gov.policies(req.query.category as string | undefined),
    'm4_gov_policies', 'Active governance policies — language, fairness, explainability, safety, risk.'));

  app.get('/api/m4/gov/models', guard(
    async () => gov.models(),
    'm4_gov_models', 'Registered AI models with version history and risk tiers.'));

  app.get('/api/m4/gov/risk', guard(
    async () => gov.riskClassifications(),
    'm4_gov_risk', 'Per-model risk tier with drivers and applied controls.'));

  app.get('/api/m4/gov/decisions', guard(
    async (req) => gov.decisions({
      subjectId: req.query.subject_id as string | undefined,
      modelId: req.query.model_id as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    }),
    'm4_gov_decisions', 'Recent AI decisions with confidence and fairness status.'));

  app.get('/api/m4/gov/explainability/:decision_id', guard(
    async (req) => gov.explainabilityFor(req.params.decision_id),
    'm4_gov_explainability', 'Explainability envelope + language check for a single decision.'));

  app.get('/api/m4/gov/hallucinations', guard(
    async () => gov.hallucinations(),
    'm4_gov_hallucinations', 'Hallucination flags raised by safety + language checks.'));

  app.get('/api/m4/gov/audit', guard(
    async (req) => gov.auditEvents({
      domain: req.query.domain as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    }),
    'm4_gov_audit', 'AI governance audit trail.'));

  app.post('/api/m4/gov/decision', async (req, res) => {
    try {
      const b = req.body ?? {};
      if (!b.decision_type || !b.rationale) {
        res.status(400).json({ ok: false, error: 'decision_type and rationale required' }); return;
      }
      const result = await gov.logDecision(b);
      await audit('governance', 'log_decision', b.subject_id ?? null, req, { decision_id: result.decision_id, language_check: result.language_check });
      res.json({ ok: true, ...wrap({ data: result }, {
        score_type: 'm4_gov_decision_log', score: null, contributors: [],
        methodology: { versions: METHOD_VERSIONS },
        rationale: 'Decision logged with explainability + safe-language check.',
      }) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  app.post('/api/m4/gov/model/version', async (req, res) => {
    try {
      const b = req.body ?? {};
      if (!b.model_id || !b.version) {
        res.status(400).json({ ok: false, error: 'model_id and version required' }); return;
      }
      const result = await gov.registerVersion(b.model_id, b.version, b.changelog, b.rollback_to);
      await audit('governance', 'register_version', b.model_id, req, b);
      res.json({ ok: true, data: result });
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  app.post('/api/m4/gov/model/rollback', async (req, res) => {
    try {
      const b = req.body ?? {};
      if (!b.model_id || !b.to_version) {
        res.status(400).json({ ok: false, error: 'model_id and to_version required' }); return;
      }
      const result = await gov.rollback(b.model_id, b.to_version);
      await audit('governance', 'rollback', b.model_id, req, b);
      res.json({ ok: true, data: result });
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  // ---- Fairness -----------------------------------------------------------
  app.get('/api/m4/fair/scores', guard(
    async (req) => fair.recentFairness(req.query.limit ? Number(req.query.limit) : 25),
    'm4_fair_scores', 'Most recent fairness evaluations across all models.'));

  app.get('/api/m4/fair/bias', guard(
    async (req) => fair.recentBias(req.query.limit ? Number(req.query.limit) : 25),
    'm4_fair_bias', 'Most recent bias detection runs with drift delta.'));

  app.get('/api/m4/fair/protected-attributes', guard(
    async () => fair.protectedAttributes(),
    'm4_fair_protected', 'Protected attribute policy — excluded / monitored / controlled.'));

  app.get('/api/m4/fair/thresholds/:model_id', guard(
    async (req) => fair.thresholdsFor(req.params.model_id),
    'm4_fair_thresholds', 'Configured warn/fail fairness thresholds per metric.'));

  app.post('/api/m4/fair/run', async (req, res) => {
    try {
      const b = req.body ?? {};
      const modelId = b.model_id ?? 'm4m_pred';
      const samples = Array.isArray(b.samples) && b.samples.length
        ? b.samples
        : fair.demoSamples(b.seed ?? 'demo', b.n ?? 400);
      const threshold = Number(b.threshold ?? 70);
      const reference = b.reference as string | undefined;
      const result = await fair.runFairnessSuite(modelId, samples, threshold, reference);
      await audit('fairness', 'run_suite', null, req, { model_id: modelId, n: samples.length, threshold });
      res.json({ ok: true, ...wrap({ data: result }, {
        score_type: 'm4_fair_run', score: null, contributors: [],
        methodology: { versions: METHOD_VERSIONS },
        rationale: 'Fairness suite: demographic parity, disparate impact, equal opportunity — per-group rates and worst-group delta. Tracks compliance, not individual prediction.',
      }) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  app.post('/api/m4/fair/bias/run', async (req, res) => {
    try {
      const b = req.body ?? {};
      const modelId = b.model_id ?? 'm4m_pred';
      const attr = b.protected_attr ?? 'gender';
      const samples = Array.isArray(b.samples) && b.samples.length
        ? b.samples
        : fair.demoSamples(b.seed ?? 'demo', b.n ?? 400);
      const threshold = Number(b.threshold ?? 70);
      const result = await fair.runBiasDetection(modelId, attr, samples, threshold);
      await audit('fairness', 'run_bias', null, req, { model_id: modelId, attr, n: samples.length });
      res.json({ ok: true, ...wrap({ data: result }, {
        score_type: 'm4_fair_bias_run', score: null, contributors: [],
        methodology: { versions: METHOD_VERSIONS },
        rationale: 'Bias detection: worst-group disparity + drift vs prior evaluation.',
      }) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  // ---- Localization -------------------------------------------------------
  app.get('/api/m4/loc/countries', guard(
    async () => loc.countries(),
    'm4_loc_countries', 'Supported countries with region, language, and labor regime.'));

  app.get('/api/m4/loc/profile/:country_id', guard(
    async (req) => loc.profile(req.params.country_id),
    'm4_loc_profile', 'Country workforce profile + cultural norms + competency expectations + leadership model.'));

  app.get('/api/m4/loc/weights/:country_id', guard(
    async (req) => {
      const ids = String(req.query.competencies ?? '').split(',').filter(Boolean);
      return loc.localizedWeights(req.params.country_id, ids.length ? ids : ['LEA', 'STR', 'COM', 'EIQ', 'ADP', 'TEC', 'COG']);
    },
    'm4_loc_weights', 'Country-modulated competency weights = base × cultural_modifier.'));

  app.get('/api/m4/loc/adapt/:country_id', guard(
    async (req) => {
      const scores = parseScores(req.query.scores) ?? { LEA: 70, STR: 68, COM: 72, EIQ: 71, ADP: 67, TEC: 78 };
      return loc.adaptScores(req.params.country_id, scores);
    },
    'm4_loc_adapt', 'Score adaptation vs. regional expectations — status, ratio, cultural modifier.'));

  app.get('/api/m4/loc/language/:country_id', guard(
    async (req) => loc.languagePolicy(req.params.country_id),
    'm4_loc_language', 'Regional language policy + sensitivities.'));

  // ---- Predictive ---------------------------------------------------------
  app.get('/api/m4/pred/trajectories', guard(
    async (req) => pred.trajectories(String(req.query.subject_id ?? 'demo_user')),
    'm4_pred_trajectories', 'Per-competency velocity + acceleration + classification.'));

  app.get('/api/m4/pred/classify', guard(
    async (req) => pred.classify(String(req.query.subject_id ?? 'demo_user')),
    'm4_pred_classify', 'Trajectory classification per competency.'));

  app.get('/api/m4/pred/future-readiness', guard(
    async (req) => {
      const horizon = Number(req.query.horizon_months ?? 12);
      return pred.futureReadiness(String(req.query.subject_id ?? 'demo_user'), horizon);
    },
    'm4_pred_future_readiness', 'Future capability = current + velocity·h + experience_momentum·h + market·h·0.25 − decay·h; bands widen by (1−consistency).'));

  app.get('/api/m4/pred/readiness-history', guard(
    async (req) => pred.readinessHistory(String(req.query.subject_id ?? 'demo_user')),
    'm4_pred_readiness_history', 'Persisted future-readiness projections across horizons.'));

  app.get('/api/m4/pred/promotion', guard(
    async (req) => pred.promotionPredictions(String(req.query.subject_id ?? 'demo_user')),
    'm4_pred_promotion', 'Promotion readiness (developmental band) per target role — capability alignment, not a hiring or promotion prediction.'));

  app.get('/api/m4/pred/leadership-potential', guard(
    async (req) => pred.leadershipPotential(String(req.query.subject_id ?? 'demo_user')),
    'm4_pred_leadership', 'Leadership emergence band + driver competencies.'));

  app.get('/api/m4/pred/skill-decay', guard(
    async (req) => pred.skillDecay(String(req.query.subject_id ?? 'demo_user')),
    'm4_pred_decay', 'Capability decay rate + half-life + obsolescence horizon.'));

  app.get('/api/m4/pred/future-gaps', guard(
    async (req) => pred.futureGaps(String(req.query.subject_id ?? 'demo_user')),
    'm4_pred_future_gaps', 'Forecast gap-to-required levels per competency.'));

  app.get('/api/m4/pred/trajectory-classifications', guard(
    async () => pred.trajectoryClassifications(),
    'm4_pred_traj_codes', 'Trajectory classification taxonomy.'));

  app.get('/api/m4/pred/burnout', guard(
    async (req) => {
      const sig = parseJson(req.query.signals) ?? undefined;
      return pred.burnoutRisk(String(req.query.subject_id ?? 'demo_user'), sig);
    },
    'm4_pred_burnout', 'Burnout risk indicator from workload + recovery + variance — well-being signal, not diagnosis.'));

  app.post('/api/m4/pred/future-readiness/persist', async (req, res) => {
    try {
      const b = req.body ?? {};
      const result = await pred.persistFutureReadiness(b.subject_id ?? 'demo_user', Number(b.horizon_months ?? 12));
      await audit('predictive', 'persist_future_readiness', b.subject_id ?? null, req, b);
      res.json({ ok: true, data: result });
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  // ---- Simulation ---------------------------------------------------------
  app.get('/api/m4/sim/scenarios', guard(
    async () => sim.scenarios(),
    'm4_sim_scenarios', 'Available what-if scenarios + capability uplift models.'));

  app.get('/api/m4/sim/results', guard(
    async (req) => sim.results(req.query.scenario_id as string | undefined, req.query.subject_id as string | undefined),
    'm4_sim_results', 'Persisted simulation results.'));

  app.post('/api/m4/sim/run', async (req, res) => {
    try {
      const b = req.body ?? {};
      if (!b.scenario) { res.status(400).json({ ok: false, error: 'scenario (id or code) required' }); return; }
      const result = await sim.runScenario(b.scenario, b.subject_id ?? 'demo_user', Number(b.horizon_months ?? 12));
      await audit('simulation', 'run', b.subject_id ?? null, req, { scenario: b.scenario, horizon: b.horizon_months });
      res.json({ ok: true, ...wrap({ data: result }, {
        score_type: 'm4_sim_run', score: result.projected_readiness, contributors: [],
        methodology: { versions: METHOD_VERSIONS },
        rationale: result.rationale,
      }) });
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  // ---- Org Risk -----------------------------------------------------------
  app.get('/api/m4/risk/capabilities', guard(
    async (req) => risk.capabilityRisks(req.query.org_unit as string | undefined),
    'm4_risk_capabilities', 'Org-unit × competency capability risk with coverage drivers.'));

  app.get('/api/m4/risk/succession', guard(
    async (req) => risk.succession(req.query.role_id as string | undefined),
    'm4_risk_succession', 'Successor readiness windows + risk score per role — developmental, not hiring.'));

  app.get('/api/m4/risk/leadership-gaps', guard(
    async (req) => risk.leadershipGaps(req.query.org_unit as string | undefined),
    'm4_risk_leadership_gaps', 'Forecast leadership gap percentage per org unit.'));

  app.get('/api/m4/risk/resilience', guard(
    async (req) => risk.resilience(req.query.org_unit as string | undefined),
    'm4_risk_resilience', 'Workforce resilience = 0.40·redundancy + 0.35·mobility + 0.25·learning_velocity.'));

  app.get('/api/m4/risk/critical', guard(
    async () => risk.criticalRisks(),
    'm4_risk_critical', 'Critical capability risks ranked by criticality × (100 − coverage).'));

  // ---- Observability ------------------------------------------------------
  app.get('/api/m4/obs/accuracy', guard(
    async (req) => obs.accuracy(req.query.model_id as string | undefined),
    'm4_obs_accuracy', 'Forecast accuracy (MAPE + Brier) per model × horizon.'));

  app.get('/api/m4/obs/drift', guard(
    async (req) => obs.drift(req.query.model_id as string | undefined),
    'm4_obs_drift', 'Model drift (PSI by default) vs configured thresholds.'));

  app.get('/api/m4/obs/monitoring', guard(
    async (req) => obs.monitoring(req.query.model_id as string | undefined),
    'm4_obs_monitoring', 'Live prediction-monitoring metrics.'));

  app.get('/api/m4/obs/logs', guard(
    async (req) => obs.recent(req.query.limit ? Number(req.query.limit) : 50),
    'm4_obs_logs', 'Recent AI observability log entries.'));

  app.post('/api/m4/obs/accuracy/record', async (req, res) => {
    try {
      const b = req.body ?? {};
      if (!Array.isArray(b.actual) || !Array.isArray(b.predicted)) {
        res.status(400).json({ ok: false, error: 'actual[] and predicted[] required' }); return;
      }
      const result = await obs.recordAccuracy(b.model_id ?? 'm4m_pred', Number(b.horizon_months ?? 12), b.actual, b.predicted);
      await audit('observability', 'record_accuracy', null, req, { model_id: b.model_id, n: b.actual.length });
      res.json({ ok: true, data: result });
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  app.post('/api/m4/obs/drift/record', async (req, res) => {
    try {
      const b = req.body ?? {};
      if (!Array.isArray(b.expected) || !Array.isArray(b.observed)) {
        res.status(400).json({ ok: false, error: 'expected[] and observed[] required' }); return;
      }
      const result = await obs.recordDrift(b.model_id ?? 'm4m_pred', b.expected, b.observed, b.metric ?? 'psi');
      await audit('observability', 'record_drift', null, req, { model_id: b.model_id, metric: b.metric });
      res.json({ ok: true, data: result });
    } catch (e: any) { res.status(500).json({ ok: false, error: e?.message ?? 'internal_error' }); }
  });

  // ---- Meta ---------------------------------------------------------------
  app.get('/api/m4/_meta/versions', (_req, res) => {
    res.json({ ok: true, data: METHOD_VERSIONS });
  });
}
