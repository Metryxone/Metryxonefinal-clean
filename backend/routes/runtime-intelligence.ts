/**
 * MX-800 Phase 2.4 — Runtime Intelligence Engine: admin routes.
 *
 * Flag-gated by `runtimeIntelligenceEngine` (default OFF). With the flag OFF every route returns
 * 503 BEFORE any auth/DB touch and the lazy ensure-schema is never reached → byte-identical legacy
 * behaviour incl. schema. `/enabled` is a persona-agnostic probe; `/feature-flag` is the super-admin
 * UI gate (res.ok).
 *
 * Reads are GET-never-writes (compose the existing health-aggregator monitor + live process/OS/pg
 * measurements + the runtime registry). The ONLY write paths are POST /discover, POST /register,
 * POST /audit/capture (ensure-schema inside the service). Literal sub-paths are registered BEFORE the
 * `:uid` param handlers.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isRuntimeIntelligenceEngineEnabled } from '../config/feature-flags';
import {
  discoverRuntime, getRuntimeRegistry, getRuntimeComponent, registerRuntimeComponent,
  getApplicationHealth, getPerformanceIntelligence, getServiceIntelligence, getObservabilityIntelligence,
  getResourceIntelligence, getRuntimeReasoning, explainRuntimeComponent, getRuntimeValidation,
  getRuntimeMetrics, getRuntimeSummary, captureRuntimeSnapshot, getRuntimeSnapshots, getRuntimeDrift,
} from '../services/runtime-intelligence';

export function registerRuntimeIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/runtime-intelligence';
  const actorOf = (req: Request) => (req as any).user?.id ?? (req as any).session?.userId ?? null;
  const str = (v: unknown) => (v == null ? null : String(v));

  // Persona-agnostic flag probe (no auth) so the admin UI can hide the tab when OFF.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isRuntimeIntelligenceEngineEnabled() });
  });

  // Gate ALL remaining routes on the flag FIRST (503 before any auth/DB touch when OFF).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isRuntimeIntelligenceEngineEnabled()) {
      return res.status(503).json({ ok: false, error: 'runtime_intelligence_disabled' });
    }
    next();
  };

  app.get(`${BASE}/feature-flag`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });

  // ---- reads (GET-never-writes) ----
  app.get(`${BASE}/summary`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getRuntimeSummary(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getRuntimeRegistry(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/application-health`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getApplicationHealth(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/performance`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getPerformanceIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/service`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getServiceIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/observability`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getObservabilityIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/resource`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getResourceIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/reasoning`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getRuntimeReasoning(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/validation`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getRuntimeValidation(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/metrics`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getRuntimeMetrics(pool)); } catch (e) { next(e); }
  });

  // ---- audit (drift) ----
  app.get(`${BASE}/audit/drift`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getRuntimeDrift(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/audit/snapshots`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      res.json(await getRuntimeSnapshots(pool, { limit: Number.isFinite(limit as number) ? limit : undefined }));
    } catch (e) { next(e); }
  });

  // ---- write paths (lazy ensure-schema lives inside the service) ----
  app.post(`${BASE}/discover`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await discoverRuntime(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/register`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await registerRuntimeComponent(pool, req.body ?? {}, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/audit/capture`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await captureRuntimeSnapshot(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });

  // ---- per-component reads (literal segment + param; registered LAST) ----
  app.get(`${BASE}/explain/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await explainRuntimeComponent(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getRuntimeComponent(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
}
