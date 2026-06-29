/**
 * MX-800 Phase 2.7 — Predictive Intelligence Engine: admin routes.
 *
 * Flag-gated by `predictiveIntelligenceEngine` (default OFF). With the flag OFF every route returns 503
 * BEFORE any auth/DB touch and the lazy ensure-schema is never reached → byte-identical legacy
 * behaviour incl. schema. `/enabled` is a persona-agnostic probe; `/feature-flag` is the super-admin
 * UI gate (res.ok).
 *
 * Reads are GET-never-writes (compose a READ-ONLY view over the EXISTING prediction/forecast/trend/risk
 * tables + the prior intelligence-tier summaries; engines are READ for existence, never invoked; no
 * forecast is generated; production is never modified). The ONLY write paths are POST /discover, POST
 * /register, POST /audit/capture (ensure-schema inside the service). Literal sub-paths are registered
 * BEFORE the `:uid` param handlers.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isPredictiveIntelligenceEngineEnabled } from '../config/feature-flags';
import {
  getPredictionCatalog, getTrendIntelligence, getRiskPrediction, getImpactSimulation,
  getScenarioIntelligence, getPredictionValidation, getPredictionMetrics, getPredictiveSummary,
  explainPrediction, getPredictionRegistry, getPredictionCapability, discoverPredictions,
  registerPredictionCapability, capturePredictiveSnapshot, getPredictiveSnapshots, getPredictiveDrift,
} from '../services/predictive-intelligence-engine';

export function registerPredictiveIntelligenceEngineRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/predictive-intelligence';
  const actorOf = (req: Request) => (req as any).user?.id ?? (req as any).session?.userId ?? null;
  const str = (v: unknown) => (v == null ? null : String(v));

  // Persona-agnostic flag probe (no auth) so the admin UI can hide the tab when OFF.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isPredictiveIntelligenceEngineEnabled() });
  });

  // Gate ALL remaining routes on the flag FIRST (503 before any auth/DB touch when OFF).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isPredictiveIntelligenceEngineEnabled()) {
      return res.status(503).json({ ok: false, error: 'predictive_intelligence_disabled' });
    }
    next();
  };

  app.get(`${BASE}/feature-flag`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });

  // ---- reads (GET-never-writes) ----
  app.get(`${BASE}/summary`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getPredictiveSummary(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/catalog`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getPredictionCatalog(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/trend`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getTrendIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/risk`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getRiskPrediction(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/simulation`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getImpactSimulation(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/scenario`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getScenarioIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/validation`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getPredictionValidation(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/metrics`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getPredictionMetrics(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getPredictionRegistry(pool)); } catch (e) { next(e); }
  });

  // ---- audit (drift) ----
  app.get(`${BASE}/audit/drift`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getPredictiveDrift(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/audit/snapshots`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      res.json(await getPredictiveSnapshots(pool, { limit: Number.isFinite(limit as number) ? limit : undefined }));
    } catch (e) { next(e); }
  });

  // ---- write paths (lazy ensure-schema lives inside the service) ----
  app.post(`${BASE}/discover`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await discoverPredictions(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/register`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await registerPredictionCapability(pool, req.body ?? {}, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/audit/capture`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await capturePredictiveSnapshot(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });

  // ---- per-capability reads (literal segment + param; registered LAST) ----
  app.get(`${BASE}/explain/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await explainPrediction(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getPredictionCapability(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
}
