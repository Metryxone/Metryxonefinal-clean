/**
 * MX-800 Phase 2.5 — Knowledge Intelligence Engine: admin routes.
 *
 * Flag-gated by `knowledgeIntelligenceEngine` (default OFF). With the flag OFF every route returns
 * 503 BEFORE any auth/DB touch and the lazy ensure-schema is never reached → byte-identical legacy
 * behaviour incl. schema. `/enabled` is a persona-agnostic probe; `/feature-flag` is the super-admin
 * UI gate (res.ok).
 *
 * Reads are GET-never-writes (compose a READ-ONLY projection over the EXISTING ontology / knowledge
 * tables + the prior intelligence-tier summaries). The ONLY write paths are POST /discover, POST
 * /register, POST /audit/capture (ensure-schema inside the service). Literal sub-paths are registered
 * BEFORE the `:uid` param handlers.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isKnowledgeIntelligenceEngineEnabled } from '../config/feature-flags';
import {
  getKnowledgeGraph, getSemanticIntelligence, getOntologyIntelligence, getKnowledgeReasoning,
  getKnowledgeContext, getKnowledgeValidation, getKnowledgeMetrics, getKnowledgeSummary,
  explainKnowledgeSource, getKnowledgeRegistry, getKnowledgeSource, discoverKnowledge,
  registerKnowledgeSource, captureKnowledgeSnapshot, getKnowledgeSnapshots, getKnowledgeDrift,
} from '../services/knowledge-intelligence';

export function registerKnowledgeIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/knowledge-intelligence';
  const actorOf = (req: Request) => (req as any).user?.id ?? (req as any).session?.userId ?? null;
  const str = (v: unknown) => (v == null ? null : String(v));

  // Persona-agnostic flag probe (no auth) so the admin UI can hide the tab when OFF.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isKnowledgeIntelligenceEngineEnabled() });
  });

  // Gate ALL remaining routes on the flag FIRST (503 before any auth/DB touch when OFF).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isKnowledgeIntelligenceEngineEnabled()) {
      return res.status(503).json({ ok: false, error: 'knowledge_intelligence_disabled' });
    }
    next();
  };

  app.get(`${BASE}/feature-flag`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });

  // ---- reads (GET-never-writes) ----
  app.get(`${BASE}/summary`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getKnowledgeSummary(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/graph`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getKnowledgeGraph(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/semantic`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getSemanticIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/ontology`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getOntologyIntelligence(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/reasoning`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getKnowledgeReasoning(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/context`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getKnowledgeContext(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/validation`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getKnowledgeValidation(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/metrics`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getKnowledgeMetrics(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getKnowledgeRegistry(pool)); } catch (e) { next(e); }
  });

  // ---- audit (drift) ----
  app.get(`${BASE}/audit/drift`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getKnowledgeDrift(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/audit/snapshots`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      res.json(await getKnowledgeSnapshots(pool, { limit: Number.isFinite(limit as number) ? limit : undefined }));
    } catch (e) { next(e); }
  });

  // ---- write paths (lazy ensure-schema lives inside the service) ----
  app.post(`${BASE}/discover`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await discoverKnowledge(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/register`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await registerKnowledgeSource(pool, req.body ?? {}, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/audit/capture`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await captureKnowledgeSnapshot(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });

  // ---- per-source reads (literal segment + param; registered LAST) ----
  app.get(`${BASE}/explain/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await explainKnowledgeSource(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getKnowledgeSource(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
}
