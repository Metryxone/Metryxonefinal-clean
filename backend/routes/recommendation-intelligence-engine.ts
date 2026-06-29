/**
 * MX-800 Phase 2.8 — Recommendation Intelligence Engine: admin routes.
 *
 * Flag-gated by `recommendationIntelligenceEngine` (default OFF). With the flag OFF every route returns
 * 503 BEFORE any auth/DB touch and the lazy ensure-schema is never reached → byte-identical legacy
 * behaviour incl. schema. `/enabled` is a persona-agnostic probe; `/feature-flag` is the super-admin UI
 * gate (res.ok).
 *
 * Reads are GET-never-writes (compose a READ-ONLY view over the EXISTING recommendation / opportunity /
 * intervention / optimization tables + the prior intelligence-tier summaries; engines are READ for
 * existence, never invoked; no recommendation is generated; nothing is decided, executed, or automated).
 * The ONLY write paths are POST /discover, POST /register, POST /audit/capture (ensure-schema inside the
 * service). Literal sub-paths are registered BEFORE the `:uid` param handlers.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isRecommendationIntelligenceEngineEnabled } from '../config/feature-flags';
import {
  getRecommendationCatalog, getActionIntelligence, getOpportunityIntelligence,
  getPrioritizationIntelligence, getPrescriptiveIntelligence, getRecommendationValidation,
  getRecommendationMetrics, getRecommendationSummary, explainRecommendation, getRecommendationRegistry,
  getRecommendationCapability, discoverRecommendations, registerRecommendationCapability,
  captureRecommendationSnapshot, getRecommendationSnapshots, getRecommendationDrift,
} from '../services/recommendation-intelligence-engine';

export function registerRecommendationIntelligenceEngineRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/recommendation-intelligence';
  const actorOf = (req: Request) => (req as any).user?.id ?? (req as any).session?.userId ?? null;
  const str = (v: unknown) => (v == null ? null : String(v));

  // Persona-agnostic flag probe (no auth) so the admin UI can hide the tab when OFF.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isRecommendationIntelligenceEngineEnabled() });
  });

  // Gate ALL remaining routes on the flag FIRST (503 before any auth/DB touch when OFF).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isRecommendationIntelligenceEngineEnabled()) {
      return res.status(503).json({ ok: false, error: 'recommendation_intelligence_disabled' });
    }
    next();
  };

  app.get(`${BASE}/feature-flag`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });

  // ---- reads (GET-never-writes) ----
  app.get(`${BASE}/summary`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getRecommendationSummary(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/catalog`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getRecommendationCatalog(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/action`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getActionIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/opportunity`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getOpportunityIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/prioritization`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getPrioritizationIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/prescriptive`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getPrescriptiveIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/validation`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getRecommendationValidation(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/metrics`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getRecommendationMetrics(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getRecommendationRegistry(pool)); } catch (e) { next(e); }
  });

  // ---- audit (drift) ----
  app.get(`${BASE}/audit/drift`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getRecommendationDrift(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/audit/snapshots`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      res.json(await getRecommendationSnapshots(pool, { limit: Number.isFinite(limit as number) ? limit : undefined }));
    } catch (e) { next(e); }
  });

  // ---- write paths (lazy ensure-schema lives inside the service) ----
  app.post(`${BASE}/discover`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await discoverRecommendations(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/register`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await registerRecommendationCapability(pool, req.body ?? {}, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/audit/capture`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await captureRecommendationSnapshot(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });

  // ---- per-capability reads (literal segment + param; registered LAST) ----
  app.get(`${BASE}/explain/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await explainRecommendation(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getRecommendationCapability(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
}
