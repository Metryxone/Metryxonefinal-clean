/**
 * MX-700 Phase 1.40 — Platform Evolution & Technical Debt Intelligence Engine admin routes.
 *
 * Flag-gated by `platformEvolutionIntelligence` (default OFF). With the flag OFF every route
 * returns 503 BEFORE any auth/DB touch and the lazy ensure-schema is never reached -> byte-identical
 * legacy behaviour incl. schema. `/enabled` is a persona-agnostic probe; `/feature-flag` is the
 * super-admin UI gate (res.ok).
 *
 * ENHANCEMENT tier over the 1.37 Foundation + 1.38 Management + 1.39 Intelligence: it COMPOSES
 * their registry/ledgers/getters (no parallel debt/version/evolution registry, no parallel engine,
 * no business-logic change). All reads are GET-never-writes (the services probe via to_regclass and
 * degrade to `ready:false`). The WRITE paths (register debt, update debt status, preserve knowledge,
 * capture evolution snapshot) each own a lazy ensure-schema that runs ONLY when the flag is ON.
 *
 * Literal sub-paths (`/technical-debt/markers`) are registered BEFORE the `:uid` param handler.
 * No frontend panel is shipped this phase (STOP clause — backend-only).
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isPlatformEvolutionIntelligenceEnabled } from '../config/feature-flags';
import {
  getEvolutionSummary, getTechnicalDebtIntelligence, scanRepositoryDebtMarkers, getTechnicalDebtRegistry,
  registerTechnicalDebt, updateTechnicalDebtStatus, getVersionIntelligence, getEntityVersionHistory,
  getDeprecationIntelligence, getRetirementIntelligence, getKnowledgeIntelligence, getKnowledgeRegistry,
  preserveKnowledge, getEvolutionIntelligence, getEvolutionValidation, getEvolutionMetrics,
  captureEvolutionSnapshot, getEvolutionSnapshots, getEvolutionDrift, getEvolutionReports,
} from '../services/platform-evolution-intelligence';

export function registerPlatformEvolutionIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/platform-evolution-intelligence';
  const actorOf = (req: Request) => (req as any).user?.id ?? (req as any).session?.userId ?? null;
  const str = (v: unknown) => (v == null ? undefined : String(v));
  const intOf = (v: unknown) => {
    if (v == null) return undefined;
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : undefined;
  };
  const arr = (v: unknown): string[] | undefined => {
    if (v == null) return undefined;
    if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
    return String(v).split(',').map((x) => x.trim()).filter(Boolean);
  };

  // Persona-agnostic flag probe (no auth) so the admin UI can hide the tab when OFF.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isPlatformEvolutionIntelligenceEnabled() });
  });

  // Gate ALL remaining routes on the flag FIRST (503 before any auth/DB touch when OFF).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isPlatformEvolutionIntelligenceEnabled()) {
      return res.status(503).json({ ok: false, error: 'platform_evolution_intelligence_disabled' });
    }
    next();
  };

  // Super-admin UI tab gate (res.ok). 503 when OFF (tab hidden), 200 when ON.
  app.get(`${BASE}/feature-flag`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });

  // ---- reads (GET-never-writes) ----
  app.get(`${BASE}/summary`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEvolutionSummary(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/metrics`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEvolutionMetrics(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/validation`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEvolutionValidation(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/reports`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEvolutionReports(pool)); } catch (e) { next(e); }
  });

  // Technical Debt — literal `/markers` BEFORE the `:uid` param handler.
  app.get(`${BASE}/technical-debt/markers`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await scanRepositoryDebtMarkers({ sampleLimit: intOf(req.query.sample) })); } catch (e) { next(e); }
  });

  app.get(`${BASE}/technical-debt`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const intel = await getTechnicalDebtIntelligence(pool);
      const registry = await getTechnicalDebtRegistry(pool, { status: str(req.query.status), limit: intOf(req.query.limit) });
      res.json({ ...intel, registry_items: registry });
    } catch (e) { next(e); }
  });

  app.get(`${BASE}/version`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getVersionIntelligence(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/version/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getEntityVersionHistory(pool, String(req.params.uid))); } catch (e) { next(e); }
  });

  app.get(`${BASE}/deprecation`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getDeprecationIntelligence(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/retirement`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getRetirementIntelligence(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/knowledge`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const intel = await getKnowledgeIntelligence(pool);
      const registry = await getKnowledgeRegistry(pool, { decisionType: str(req.query.type), limit: intOf(req.query.limit) });
      res.json({ ...intel, registry_items: registry });
    } catch (e) { next(e); }
  });

  app.get(`${BASE}/evolution`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEvolutionIntelligence(pool)); } catch (e) { next(e); }
  });

  // Continuous evolution audit (drift + snapshots).
  app.get(`${BASE}/audit/drift`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEvolutionDrift(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/audit/snapshots`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getEvolutionSnapshots(pool, { limit: intOf(req.query.limit) })); } catch (e) { next(e); }
  });

  // ---- writes (flag-ON only; each service path owns its lazy ensure-schema) ----
  app.post(`${BASE}/technical-debt`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const r = await registerTechnicalDebt(pool, {
        title: String(b.title ?? ''), category: str(b.category), type: str(b.type), owner: str(b.owner),
        priority: str(b.priority), severity: str(b.severity), impact: str(b.impact), dependencies: arr(b.dependencies),
        evidence: str(b.evidence), documentation: str(b.documentation), repositoryReference: str(b.repositoryReference),
        lifecycleUid: str(b.lifecycleUid), actor: actorOf(req),
      });
      res.status(r.ok ? 200 : 400).json(r);
    } catch (e) { next(e); }
  });

  app.post(`${BASE}/technical-debt/:uid/status`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const r = await updateTechnicalDebtStatus(pool, String(req.params.uid), { status: String(b.status ?? ''), note: str(b.note), actor: actorOf(req) });
      res.status(r.ok ? 200 : (r.error === 'unknown_debt_item' ? 404 : 400)).json(r);
    } catch (e) { next(e); }
  });

  app.post(`${BASE}/knowledge`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const r = await preserveKnowledge(pool, {
        decisionType: String(b.decisionType ?? b.type ?? ''), title: String(b.title ?? ''), decision: str(b.decision),
        rationale: str(b.rationale), lessonsLearned: str(b.lessonsLearned), documentationLinks: arr(b.documentationLinks),
        repositoryReference: str(b.repositoryReference), lifecycleUid: str(b.lifecycleUid), actor: actorOf(req),
      });
      res.status(r.ok ? 200 : 400).json(r);
    } catch (e) { next(e); }
  });

  app.post(`${BASE}/audit/capture`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await captureEvolutionSnapshot(pool, actorOf(req))); } catch (e) { next(e); }
  });
}
