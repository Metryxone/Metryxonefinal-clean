/**
 * MX-700 Phase 1.38 — Platform Lifecycle Management Engine admin routes.
 *
 * Flag-gated by `platformLifecycleManagement` (default OFF). With the flag OFF
 * every route returns 503 BEFORE any auth/DB touch and ensure-schema is never
 * reached -> byte-identical legacy behaviour incl. schema. `/enabled` is a
 * persona-agnostic probe; `/feature-flag` is the super-admin UI gate (res.ok).
 *
 * This is the MANAGEMENT tier over the Phase 1.37 Foundation: it COMPOSES the
 * Foundation registry + transitionState() (no parallel registry/engine). Reads
 * are GET-never-writes (services probe via to_regclass and degrade to
 * `ready:false`). Only the POST ops below create/modify rows (ensure-schema there).
 *
 * Literal sub-paths are registered BEFORE the `:uid` param handlers.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isPlatformLifecycleManagementEnabled } from '../config/feature-flags';
import {
  getEntityLifecycle, getEntityLifecycleDetail, getManagementSummary,
  getDeprecation, getRetirement, getVersionHistory, getEvolution,
  registerEntity, deprecateEntity, retireEntity, setVersion, recordEvolution,
  isLifecycleView,
} from '../services/platform-lifecycle-management';

export function registerPlatformLifecycleManagementRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/platform-lifecycle-management';
  const actorOf = (req: Request) => (req as any).user?.id ?? (req as any).session?.userId ?? null;
  const str = (v: unknown) => (v == null ? undefined : String(v));
  const intOf = (v: unknown) => {
    if (v == null) return undefined;
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : undefined;
  };

  // Persona-agnostic flag probe (no auth) so the admin UI can hide the tab when OFF.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isPlatformLifecycleManagementEnabled() });
  });

  // Gate ALL remaining routes on the flag FIRST (503 before any auth/DB touch when OFF).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isPlatformLifecycleManagementEnabled()) {
      return res.status(503).json({ ok: false, error: 'platform_lifecycle_management_disabled' });
    }
    next();
  };

  // Super-admin UI tab gate (res.ok). 503 when OFF (tab hidden), 200 when ON.
  app.get(`${BASE}/feature-flag`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });

  // ---- reads (GET-never-writes) ----
  app.get(`${BASE}/summary`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getManagementSummary(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/deprecation`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getDeprecation(pool, { uid: str(req.query.uid), limit: intOf(req.query.limit) })); } catch (e) { next(e); }
  });

  app.get(`${BASE}/retirement`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getRetirement(pool, { uid: str(req.query.uid), limit: intOf(req.query.limit) })); } catch (e) { next(e); }
  });

  app.get(`${BASE}/evolution`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getEvolution(pool, { uid: str(req.query.uid), type: str(req.query.type), limit: intOf(req.query.limit) })); } catch (e) { next(e); }
  });

  // version ledger for an entity (literal segment + param)
  app.get(`${BASE}/version/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getVersionHistory(pool, String(req.params.uid))); } catch (e) { next(e); }
  });

  // typed lifecycle views (feature/capability/module/api/model) — literal BEFORE :uid
  app.get(`${BASE}/entities/:view`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const view = String(req.params.view);
      if (!isLifecycleView(view)) {
        return res.status(400).json({ ok: false, error: 'unknown_view', allowed: ['feature', 'capability', 'module', 'api', 'model'] });
      }
      res.json(await getEntityLifecycle(pool, view, { state: str(req.query.state), limit: intOf(req.query.limit) }));
    } catch (e) { next(e); }
  });

  // full per-entity lifecycle detail (registry + deprecation + retirement + versions + evolution + history)
  app.get(`${BASE}/entity/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getEntityLifecycleDetail(pool, String(req.params.uid))); } catch (e) { next(e); }
  });

  // ---- writes (ensure-schema inside the service) ----
  app.post(`${BASE}/register`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const b = req.body || {};
      if (!b.uid || !b.entity_type || !b.identifier) {
        return res.status(400).json({ ok: false, error: 'uid, entity_type, identifier required' });
      }
      const out = await registerEntity(pool, {
        uid: String(b.uid), entityType: String(b.entity_type), identifier: String(b.identifier),
        state: str(b.state), activation: str(b.activation), featureFlag: str(b.feature_flag),
        repoRef: str(b.repository_reference), actor: str(actorOf(req)) ?? null,
      });
      res.status(out.ok ? 200 : 400).json(out);
    } catch (e) { next(e); }
  });

  app.post(`${BASE}/deprecate/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const b = req.body || {};
      const out = await deprecateEntity(pool, String(req.params.uid), {
        policy: str(b.policy), reason: str(b.reason), replacementReference: str(b.replacement_reference),
        migrationTarget: str(b.migration_target), compatibilityStatus: str(b.compatibility_status),
        timeline: str(b.timeline), effectiveAt: str(b.effective_at), actor: str(actorOf(req)) ?? null,
      });
      res.status(out.ok ? 200 : (out.error === 'unknown_entity' ? 404 : 400)).json(out);
    } catch (e) { next(e); }
  });

  app.post(`${BASE}/retire/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const b = req.body || {};
      const out = await retireEntity(pool, String(req.params.uid), {
        approvalStatus: str(b.approval_status), approvedBy: str(b.approved_by),
        archiveReference: str(b.archive_reference), knowledgePreservation: str(b.knowledge_preservation),
        force: b.force === true || b.force === 'true', actor: str(actorOf(req)) ?? null,
      });
      const code = out.ok ? 200 : (out.error === 'unknown_entity' ? 404 : (out.error === 'has_active_dependents' ? 409 : 400));
      res.status(code).json(out);
    } catch (e) { next(e); }
  });

  app.post(`${BASE}/version/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const b = req.body || {};
      const out = await setVersion(pool, String(req.params.uid), {
        currentVersion: str(b.current_version), previousVersion: str(b.previous_version),
        migrationVersion: str(b.migration_version), rollbackVersion: str(b.rollback_version),
        releaseStatus: str(b.release_status), compatibility: str(b.compatibility), actor: str(actorOf(req)) ?? null,
      });
      res.status(out.ok ? 200 : (out.error === 'unknown_entity' ? 404 : 400)).json(out);
    } catch (e) { next(e); }
  });

  app.post(`${BASE}/evolution/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const b = req.body || {};
      if (!b.evolution_type) return res.status(400).json({ ok: false, error: 'evolution_type required' });
      const out = await recordEvolution(pool, String(req.params.uid), {
        evolutionType: String(b.evolution_type), summary: str(b.summary),
        fromValue: str(b.from_value), toValue: str(b.to_value), evidence: str(b.evidence), actor: str(actorOf(req)) ?? null,
      });
      res.status(out.ok ? 200 : (out.error === 'unknown_entity' ? 404 : 400)).json(out);
    } catch (e) { next(e); }
  });
}
