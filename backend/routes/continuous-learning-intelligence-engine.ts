/**
 * MX-800 Phase 2.9 — Continuous Learning Intelligence Engine: admin routes.
 *
 * Flag-gated by `continuousLearningIntelligenceEngine` (default OFF). With the flag OFF every route returns
 * 503 BEFORE any auth/DB touch and the lazy ensure-schema is never reached → byte-identical legacy
 * behaviour incl. schema. `/enabled` is a persona-agnostic probe; `/feature-flag` is the super-admin UI
 * gate (res.ok).
 *
 * Reads are GET-never-writes (compose a READ-ONLY view over the EXISTING learning / feedback / experience /
 * adaptive / improvement / organizational-learning tables + the prior intelligence-tier summaries; engines
 * are READ for existence, never invoked; no learning state is created; nothing is adapted, decided,
 * executed, or automated). The ONLY write paths are POST /discover, POST /register, POST /audit/capture
 * (ensure-schema inside the service). Literal sub-paths are registered BEFORE the `:uid` param handlers.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isContinuousLearningIntelligenceEngineEnabled } from '../config/feature-flags';
import {
  getLearningCatalog, getFeedbackIntelligence, getExperienceIntelligence,
  getAdaptiveIntelligence, getContinuousImprovement, getLearningValidation,
  getLearningMetrics, getOrganizationalLearning, getLearningSummary, explainLearning,
  getLearningRegistry, getLearningCapability, discoverLearning, registerLearningCapability,
  captureLearningSnapshot, getLearningSnapshots, getLearningDrift,
} from '../services/continuous-learning-intelligence-engine';

export function registerContinuousLearningIntelligenceEngineRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/continuous-learning-intelligence';
  const actorOf = (req: Request) => (req as any).user?.id ?? (req as any).session?.userId ?? null;
  const str = (v: unknown) => (v == null ? null : String(v));

  // Persona-agnostic flag probe (no auth) so the admin UI can hide the tab when OFF.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isContinuousLearningIntelligenceEngineEnabled() });
  });

  // Gate ALL remaining routes on the flag FIRST (503 before any auth/DB touch when OFF).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isContinuousLearningIntelligenceEngineEnabled()) {
      return res.status(503).json({ ok: false, error: 'continuous_learning_intelligence_disabled' });
    }
    next();
  };

  app.get(`${BASE}/feature-flag`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });

  // ---- reads (GET-never-writes) ----
  app.get(`${BASE}/summary`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getLearningSummary(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/catalog`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getLearningCatalog(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/feedback`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getFeedbackIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/experience`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getExperienceIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/adaptive`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getAdaptiveIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/continuous-improvement`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getContinuousImprovement(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/organizational`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getOrganizationalLearning(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/validation`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getLearningValidation(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/metrics`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getLearningMetrics(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getLearningRegistry(pool)); } catch (e) { next(e); }
  });

  // ---- audit (drift) ----
  app.get(`${BASE}/audit/drift`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getLearningDrift(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/audit/snapshots`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      res.json(await getLearningSnapshots(pool, { limit: Number.isFinite(limit as number) ? limit : undefined }));
    } catch (e) { next(e); }
  });

  // ---- write paths (lazy ensure-schema lives inside the service) ----
  app.post(`${BASE}/discover`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await discoverLearning(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/register`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await registerLearningCapability(pool, req.body ?? {}, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/audit/capture`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await captureLearningSnapshot(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });

  // ---- per-capability reads (literal segment + param; registered LAST) ----
  app.get(`${BASE}/explain/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await explainLearning(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getLearningCapability(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
}
