/**
 * MX-800 Phase 2.10 — Enterprise Intelligence Platform: admin routes.
 *
 * Flag-gated by `enterpriseIntelligencePlatform` (default OFF). With the flag OFF every route returns 503
 * BEFORE any auth/DB touch and the lazy ensure-schema is never reached → byte-identical legacy behaviour
 * incl. schema. `/enabled` is a persona-agnostic probe; `/feature-flag` is the super-admin UI gate (res.ok).
 *
 * Reads are GET-never-writes (compose a READ-ONLY view over the EXISTING intelligence registries /
 * audit-snapshot trails + the prior intelligence-tier read-only summaries; engines are READ for existence,
 * never invoked / activated; no enterprise state is created; nothing is decided, executed, automated, or
 * modified). The ONLY write paths are POST /discover, POST /register, POST /audit/capture (ensure-schema
 * inside the service). Literal sub-paths are registered BEFORE the `:uid` param handlers.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isEnterpriseIntelligencePlatformEnabled } from '../config/feature-flags';
import {
  getEnterpriseCatalog, getEnterpriseOrchestration, getCrossIntelligenceCorrelation,
  getEnterpriseInsights, getOrganizationalIntelligence, getEnterpriseValidation,
  getEnterpriseMetrics, getExecutiveIntelligence, getEnterpriseSummary, explainEnterprise,
  getEnterpriseRegistry, getEnterpriseCapability, discoverEnterprise, registerEnterpriseCapability,
  captureEnterpriseSnapshot, getEnterpriseSnapshots, getEnterpriseDrift,
} from '../services/enterprise-intelligence-platform';

export function registerEnterpriseIntelligencePlatformRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/enterprise-intelligence';
  const actorOf = (req: Request) => (req as any).user?.id ?? (req as any).session?.userId ?? null;
  const str = (v: unknown) => (v == null ? null : String(v));

  // Persona-agnostic flag probe (no auth) so the admin UI can hide the tab when OFF.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isEnterpriseIntelligencePlatformEnabled() });
  });

  // Gate ALL remaining routes on the flag FIRST (503 before any auth/DB touch when OFF).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isEnterpriseIntelligencePlatformEnabled()) {
      return res.status(503).json({ ok: false, error: 'enterprise_intelligence_platform_disabled' });
    }
    next();
  };

  app.get(`${BASE}/feature-flag`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });

  // ---- reads (GET-never-writes) ----
  app.get(`${BASE}/summary`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEnterpriseSummary(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/catalog`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEnterpriseCatalog(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/orchestration`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEnterpriseOrchestration(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/correlation`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getCrossIntelligenceCorrelation(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/insights`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEnterpriseInsights(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/organizational`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getOrganizationalIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/executive`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getExecutiveIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/validation`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEnterpriseValidation(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/metrics`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEnterpriseMetrics(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEnterpriseRegistry(pool)); } catch (e) { next(e); }
  });

  // ---- audit (drift) ----
  app.get(`${BASE}/audit/drift`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEnterpriseDrift(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/audit/snapshots`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      res.json(await getEnterpriseSnapshots(pool, { limit: Number.isFinite(limit as number) ? limit : undefined }));
    } catch (e) { next(e); }
  });

  // ---- write paths (lazy ensure-schema lives inside the service) ----
  app.post(`${BASE}/discover`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await discoverEnterprise(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/register`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await registerEnterpriseCapability(pool, req.body ?? {}, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/audit/capture`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await captureEnterpriseSnapshot(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });

  // ---- per-capability reads (literal segment + param; registered LAST) ----
  app.get(`${BASE}/explain/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await explainEnterprise(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getEnterpriseCapability(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
}
