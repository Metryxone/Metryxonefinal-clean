/**
 * Predictive Intelligence V2 routes (additive, feature-flagged).
 * Mount: /api/v2/predictive ; flag: predictiveIntelligenceV2.
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  predictReadiness, predictBurnoutRisk, predictLeadershipEmergence,
  predictPromotionProximity, predictSkillDecay,
  persistReadiness, persistBurnout, persistLeadership, persistPromotion,
  PREDICTIVE_ENGINE_VERSION,
} from '../services/predictive-competency-engine';
import { forecastCompetency, persistForecast, FORECASTING_ENGINE_VERSION } from '../services/competency-forecasting-engine';
import { persistSimulation, WORKFORCE_SIM_V2_VERSION } from '../services/workforce-simulation-v2';
import { runScenario, SCENARIO_ENGINE_VERSION } from '../services/scenario-modeling-engine';
import { isPredictiveIntelligenceV2Enabled } from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = { PREDICTIVE_ENGINE_VERSION, FORECASTING_ENGINE_VERSION, WORKFORCE_SIM_V2_VERSION, SCENARIO_ENGINE_VERSION };
const LANGUAGE_POLICY = {
  allowed: ['readiness probability', 'developmental forecast', 'risk band', 'projected level', 'scenario outcome'],
  disallowed: ['hiring recommendation', 'promotion ranking', 'individual suitability prediction', 'pass/fail verdict'],
  inference_mode: 'heuristic' as const,
};

function envelope<T extends object>(p: T) { return { ok: true, ...p, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: { predictiveIntelligenceV2: isPredictiveIntelligenceV2Enabled() } }; }
function errorEnvelope(error: string, extra: Record<string, unknown> = {}) { return { ok: false, error, ...extra, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: { predictiveIntelligenceV2: isPredictiveIntelligenceV2Enabled() } }; }
function requireFlag(_req: Request, res: Response, next: NextFunction) { if (!isPredictiveIntelligenceV2Enabled()) return res.status(503).json(errorEnvelope('predictiveIntelligenceV2 disabled')); next(); }
function authUserId(req: Request): string | null {
  const u = (req as Request & { user?: { id?: number | string } }).user;
  if (!u || u.id == null) return null;
  return String(u.id);
}

export function registerPredictiveIntelligenceV2(opts: { app: Express; pool: Pool; requireAuth: RequireAuth }) {
  const { app, pool, requireAuth } = opts;

  app.get('/api/v2/predictive/feature-flag', (_req, res) => res.json(envelope({})));
  app.get('/api/v2/predictive/_meta/versions', (_req, res) => res.json(envelope({})));

  app.get('/api/v2/predictive/readiness', requireAuth, requireFlag, async (req, res) => {
    try {
      const auth = authUserId(req); if (auth == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const userId = req.query.userId ? String(req.query.userId) : auth;
      if (userId !== auth) return res.status(403).json(errorEnvelope('forbidden'));
      const scores: Record<string, number> = {};
      for (const k of ['COG','COM','LEA','EXE','ADP','TEC','EIQ']) {
        const v = req.query[k]; if (v != null) scores[k] = Number(v);
      }
      const targetRole = req.query.targetRole ? String(req.query.targetRole) : undefined;
      const tenureMonths = req.query.tenureMonths ? Number(req.query.tenureMonths) : undefined;
      const r = predictReadiness({ userId, scores, targetRole, tenureMonths });
      persistReadiness(pool, r).catch(() => {});
      res.json(envelope({ readiness: r }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  app.get('/api/v2/predictive/burnout-risk', requireAuth, requireFlag, async (req, res) => {
    try {
      const auth = authUserId(req); if (auth == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const userId = req.query.userId ? String(req.query.userId) : auth;
      if (userId !== auth) return res.status(403).json(errorEnvelope('forbidden'));
      const result = predictBurnoutRisk({
        userId,
        weeklyHours: req.query.weeklyHours ? Number(req.query.weeklyHours) : undefined,
        recentTrendDelta: req.query.recentTrendDelta ? Number(req.query.recentTrendDelta) : undefined,
        supportSignal: req.query.supportSignal ? Number(req.query.supportSignal) : undefined,
        tenureMonths: req.query.tenureMonths ? Number(req.query.tenureMonths) : undefined,
      });
      persistBurnout(pool, result).catch(() => {});
      res.json(envelope({ burnout: result }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  app.get('/api/v2/predictive/leadership', requireAuth, requireFlag, async (req, res) => {
    try {
      const auth = authUserId(req); if (auth == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const userId = req.query.userId ? String(req.query.userId) : auth;
      if (userId !== auth) return res.status(403).json(errorEnvelope('forbidden'));
      const scores: Record<string, number> = {};
      for (const k of ['COG','COM','LEA','EXE','ADP','TEC','EIQ']) {
        const v = req.query[k]; if (v != null) scores[k] = Number(v);
      }
      const result = predictLeadershipEmergence({
        userId, scores,
        teamSize: req.query.teamSize ? Number(req.query.teamSize) : undefined,
        mentorshipCount: req.query.mentorshipCount ? Number(req.query.mentorshipCount) : undefined,
      });
      persistLeadership(pool, result).catch(() => {});
      res.json(envelope({ leadership: result }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  app.get('/api/v2/predictive/forecast', requireAuth, requireFlag, async (req, res) => {
    try {
      const auth = authUserId(req); if (auth == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const userId = req.query.userId ? String(req.query.userId) : auth;
      if (userId !== auth) return res.status(403).json(errorEnvelope('forbidden'));
      const competencyKey = String(req.query.competency ?? 'TEC');
      const currentLevel = Number(req.query.currentLevel ?? 50);
      const horizonMonths = Math.max(1, Math.min(24, Number(req.query.horizonMonths ?? 6)));
      const historyDeltas = typeof req.query.history === 'string' ? req.query.history.split(',').map(Number).filter(Number.isFinite) : undefined;
      const interventionBoost = req.query.interventionBoost ? Number(req.query.interventionBoost) : undefined;
      const f = forecastCompetency({ userId, competencyKey, currentLevel, horizonMonths, historyDeltas, interventionBoost });
      persistForecast(pool, f).catch(() => {});
      // Also include promotion proximity + decay for the same user/competency (lightweight)
      const promotion = predictPromotionProximity({ userId, currentStage: String(req.query.currentStage ?? 'ic'), nextStage: String(req.query.nextStage ?? 'ic_senior'), readinessProbability: currentLevel / 100, tenureMonths: req.query.tenureMonths ? Number(req.query.tenureMonths) : undefined });
      persistPromotion(pool, promotion).catch(() => {});
      const decay = predictSkillDecay({ userId, competencyKey, currentLevel, monthsSinceLastUse: Number(req.query.monthsSinceLastUse ?? 0) });
      res.json(envelope({ forecast: f, promotion, decay }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  app.post('/api/v2/predictive/simulate', requireAuth, requireFlag, async (req, res) => {
    try {
      const auth = authUserId(req); if (auth == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const scenarioKey = String(req.body?.scenarioKey ?? `sim_${Date.now()}`);
      const scenarioType = String(req.body?.scenarioType ?? 'what_if') as Parameters<typeof runScenario>[0]['scenarioType'];
      const baseline = req.body?.baseline ?? {};
      const options = req.body?.options ?? {};
      const result = runScenario({ scenarioKey, scenarioType, baseline, options });
      if (result && 'baseline' in result && 'projected' in result) {
        persistSimulation(pool, auth, result as Parameters<typeof persistSimulation>[2]).catch(() => {});
      }
      res.json(envelope({ simulation: result }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });
}
