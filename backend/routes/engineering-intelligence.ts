/**
 * MX-800 Phase 2.3 — Engineering Intelligence Engine: admin routes.
 *
 * Flag-gated by `engineeringIntelligence` (default OFF). With the flag OFF every route returns
 * 503 BEFORE any auth/DB touch and the lazy ensure-schema is never reached → byte-identical legacy
 * behaviour incl. schema. `/enabled` is a persona-agnostic probe; `/feature-flag` is the super-admin
 * UI gate (res.ok).
 *
 * Reads are GET-never-writes (compose existing 1.39/1.40 measured getters + the engineering registry).
 * The ONLY write paths are POST /discover, POST /register, POST /audit/capture (ensure-schema inside
 * the service). Literal sub-paths are registered BEFORE the `:uid` param handlers.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isEngineeringIntelligenceEnabled } from '../config/feature-flags';
import {
  discoverEngineering, getEngineeringRegistry, getEngineeringEntity, registerEngineeringEntity,
  getCodeIntelligence, getArchitectureIntelligence, getDependencyIntelligence, getQualityIntelligence,
  getEngineeringReasoning, explainEngineeringEntity, getEngineeringValidation, getEngineeringMetrics,
  getEngineeringSummary, captureEngineeringSnapshot, getEngineeringSnapshots, getEngineeringDrift,
} from '../services/engineering-intelligence';

export function registerEngineeringIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/engineering-intelligence';
  const actorOf = (req: Request) => (req as any).user?.id ?? (req as any).session?.userId ?? null;
  const str = (v: unknown) => (v == null ? null : String(v));

  // Persona-agnostic flag probe (no auth) so the admin UI can hide the tab when OFF.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isEngineeringIntelligenceEnabled() });
  });

  // Gate ALL remaining routes on the flag FIRST (503 before any auth/DB touch when OFF).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isEngineeringIntelligenceEnabled()) {
      return res.status(503).json({ ok: false, error: 'engineering_intelligence_disabled' });
    }
    next();
  };

  app.get(`${BASE}/feature-flag`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });

  // ---- reads (GET-never-writes) ----
  app.get(`${BASE}/summary`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEngineeringSummary(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEngineeringRegistry(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/code`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getCodeIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/architecture`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getArchitectureIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/dependencies`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getDependencyIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/quality`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getQualityIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/reasoning`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEngineeringReasoning(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/validation`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEngineeringValidation(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/metrics`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEngineeringMetrics(pool)); } catch (e) { next(e); }
  });

  // ---- audit (drift) ----
  app.get(`${BASE}/audit/drift`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEngineeringDrift(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/audit/snapshots`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      res.json(await getEngineeringSnapshots(pool, { limit: Number.isFinite(limit as number) ? limit : undefined }));
    } catch (e) { next(e); }
  });

  // ---- write paths (lazy ensure-schema lives inside the service) ----
  app.post(`${BASE}/discover`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await discoverEngineering(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/register`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await registerEngineeringEntity(pool, req.body ?? {}, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/audit/capture`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await captureEngineeringSnapshot(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });

  // ---- per-entity reads (literal segment + param; registered LAST) ----
  app.get(`${BASE}/explain/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await explainEngineeringEntity(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getEngineeringEntity(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
}
