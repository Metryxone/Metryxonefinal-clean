/**
 * MX-800 Phase 2.13 — Enterprise Intelligence Integration Platform: admin routes.
 *
 * Flag-gated by `enterpriseIntelligenceIntegration` (default OFF). With the flag OFF every route returns 503
 * BEFORE any auth/DB touch and the lazy ensure-schema is never reached → byte-identical legacy behaviour
 * incl. schema. `/enabled` is a persona-agnostic probe; `/feature-flag` is the super-admin UI gate (res.ok).
 *
 * Reads are GET-never-writes (compose a READ-ONLY integration view over the EXISTING MX-800 + MX-700
 * intelligence/enterprise/platform services — services are READ for existence + each tier's read-only
 * summary, never invoked / activated; no engine is run, no event emitted, nothing decided). The ONLY write
 * paths are POST /discover, POST /register, POST /audit/capture (ensure-schema inside the service). Literal
 * sub-paths are registered BEFORE the `:uid` param handlers.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isEnterpriseIntelligenceIntegrationEnabled } from '../config/feature-flags';
import {
  getIntegrationCatalog, getCrossIntelligenceIntegration, getEnterpriseServiceComposition,
  getPlatformInteroperability, getEnterpriseCoordination, getIntegrationValidation, getEnterpriseMetrics,
  getIntegrationSummary, explainIntegration, getRegistry, getRegistryEntry,
  discoverIntegration, registerIntegrationService,
  captureIntegrationSnapshot, getIntegrationSnapshots, getIntegrationDrift,
} from '../services/enterprise-intelligence-integration';

export function registerEnterpriseIntelligenceIntegrationRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/enterprise-intelligence-integration';
  const actorOf = (req: Request) => (req as any).user?.id ?? (req as any).session?.userId ?? null;
  const str = (v: unknown) => (v == null ? null : String(v));

  // Persona-agnostic flag probe (no auth) so the admin UI can hide the tab when OFF.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isEnterpriseIntelligenceIntegrationEnabled() });
  });

  // Gate ALL remaining routes on the flag FIRST (503 before any auth/DB touch when OFF).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isEnterpriseIntelligenceIntegrationEnabled()) {
      return res.status(503).json({ ok: false, error: 'enterprise_intelligence_integration_disabled' });
    }
    next();
  };

  app.get(`${BASE}/feature-flag`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });

  // ---- reads (GET-never-writes) ----
  app.get(`${BASE}/summary`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getIntegrationSummary(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/catalog`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getIntegrationCatalog(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/cross-intelligence`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getCrossIntelligenceIntegration(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/service-composition`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEnterpriseServiceComposition(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/interoperability`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getPlatformInteroperability(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/coordination`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEnterpriseCoordination(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/validation`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getIntegrationValidation(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/metrics`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEnterpriseMetrics(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getRegistry(pool)); } catch (e) { next(e); }
  });

  // ---- audit (drift) ----
  app.get(`${BASE}/audit/drift`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getIntegrationDrift(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/audit/snapshots`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      res.json(await getIntegrationSnapshots(pool, { limit: Number.isFinite(limit as number) ? limit : undefined }));
    } catch (e) { next(e); }
  });

  // ---- write paths (lazy ensure-schema lives inside the service) ----
  app.post(`${BASE}/discover`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await discoverIntegration(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/register`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await registerIntegrationService(pool, req.body ?? {}, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/audit/capture`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await captureIntegrationSnapshot(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });

  // ---- per-service reads (literal segment + param; registered LAST) ----
  app.get(`${BASE}/explain/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await explainIntegration(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getRegistryEntry(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
}
