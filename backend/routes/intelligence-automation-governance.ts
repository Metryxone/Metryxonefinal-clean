/**
 * MX-800 Phase 2.12 — Intelligence Automation & Governance Orchestration Platform: admin routes.
 *
 * Flag-gated by `intelligenceAutomationGovernance` (default OFF). With the flag OFF every route returns 503
 * BEFORE any auth/DB touch and the lazy ensure-schema is never reached → byte-identical legacy behaviour
 * incl. schema. `/enabled` is a persona-agnostic probe; `/feature-flag` is the super-admin UI gate (res.ok).
 *
 * Reads are GET-never-writes (compose a READ-ONLY view over the EXISTING automation/governance/workflow/
 * event/approval substrate + the prior intelligence-tier read-only summaries; engines are READ for
 * existence + persisted output, never invoked / activated; no event is emitted, no scheduler started, no
 * workflow executed, nothing decided/approved). The ONLY write paths are POST /discover, POST /register,
 * POST /audit/capture (ensure-schema inside the service). Literal sub-paths are registered BEFORE the
 * `:uid` param handlers.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isIntelligenceAutomationGovernanceEnabled } from '../config/feature-flags';
import {
  getAutomationGovernanceCatalog, getGovernanceOrchestration, getWorkflowOrchestration,
  getPolicyOrchestration, getValidationAutomation, getEventOrchestration, getApprovalWorkflows,
  getAutomationObservability, getAutomationGovernanceValidation, getAutomationGovernanceMetrics,
  getAutomationGovernanceSummary, explainAutomationGovernance,
  getAutomationGovernanceRegistry, getAutomationGovernanceCapability,
  discoverAutomationGovernance, registerAutomationGovernanceCapability,
  captureAutomationGovernanceSnapshot, getAutomationGovernanceSnapshots, getAutomationGovernanceDrift,
} from '../services/intelligence-automation-governance';

export function registerIntelligenceAutomationGovernanceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/intelligence-automation-governance';
  const actorOf = (req: Request) => (req as any).user?.id ?? (req as any).session?.userId ?? null;
  const str = (v: unknown) => (v == null ? null : String(v));

  // Persona-agnostic flag probe (no auth) so the admin UI can hide the tab when OFF.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isIntelligenceAutomationGovernanceEnabled() });
  });

  // Gate ALL remaining routes on the flag FIRST (503 before any auth/DB touch when OFF).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isIntelligenceAutomationGovernanceEnabled()) {
      return res.status(503).json({ ok: false, error: 'intelligence_automation_governance_disabled' });
    }
    next();
  };

  app.get(`${BASE}/feature-flag`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });

  // ---- reads (GET-never-writes) ----
  app.get(`${BASE}/summary`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getAutomationGovernanceSummary(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/catalog`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getAutomationGovernanceCatalog(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/governance-orchestration`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getGovernanceOrchestration(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/workflow-orchestration`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getWorkflowOrchestration(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/policy-orchestration`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getPolicyOrchestration(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/validation-automation`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getValidationAutomation(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/event-orchestration`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getEventOrchestration(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/approval-workflows`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getApprovalWorkflows(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/observability`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getAutomationObservability(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/validation`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getAutomationGovernanceValidation(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/metrics`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getAutomationGovernanceMetrics(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getAutomationGovernanceRegistry(pool)); } catch (e) { next(e); }
  });

  // ---- audit (drift) ----
  app.get(`${BASE}/audit/drift`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getAutomationGovernanceDrift(pool)); } catch (e) { next(e); }
  });
  app.get(`${BASE}/audit/snapshots`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      res.json(await getAutomationGovernanceSnapshots(pool, { limit: Number.isFinite(limit as number) ? limit : undefined }));
    } catch (e) { next(e); }
  });

  // ---- write paths (lazy ensure-schema lives inside the service) ----
  app.post(`${BASE}/discover`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await discoverAutomationGovernance(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/register`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await registerAutomationGovernanceCapability(pool, req.body ?? {}, str(actorOf(req)))); } catch (e) { next(e); }
  });
  app.post(`${BASE}/audit/capture`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await captureAutomationGovernanceSnapshot(pool, str(actorOf(req)))); } catch (e) { next(e); }
  });

  // ---- per-capability reads (literal segment + param; registered LAST) ----
  app.get(`${BASE}/explain/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await explainAutomationGovernance(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
  app.get(`${BASE}/registry/:uid`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getAutomationGovernanceCapability(pool, String(req.params.uid))); } catch (e) { next(e); }
  });
}
