/**
 * MX-700 Phase 1.41 — Platform Lifecycle Automation & Continuous Governance Engine admin routes.
 *
 * Flag-gated by `platformLifecycleAutomation` (default OFF). With the flag OFF every route returns
 * 503 BEFORE any auth/DB touch and the lazy ensure-schema is never reached -> byte-identical legacy
 * behaviour incl. schema. `/enabled` is a persona-agnostic probe; `/feature-flag` is the super-admin
 * UI gate (res.ok).
 *
 * ENHANCEMENT tier over the 1.37 Foundation + 1.38 Management + 1.39 Intelligence + 1.40 Evolution:
 * it COMPOSES their registry/ledgers/validation/metrics getters (no parallel automation/governance/
 * policy/compliance/validation registry, no parallel engine, no business-logic change). All reads are
 * GET-never-writes (the services probe via to_regclass / measure compliance read-only and degrade to
 * `ready:false`). The WRITE paths (register policy, set policy enabled, capture governance snapshot)
 * each own a lazy ensure-schema that runs ONLY when the flag is ON.
 *
 * Literal sub-paths (`/audit/drift`, `/policies/:uid/status`) are registered BEFORE any param handler.
 * No frontend panel is shipped this phase (STOP clause — backend-only).
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isPlatformLifecycleAutomationEnabled } from '../config/feature-flags';
import {
  getAutomationSummary, getAutomationMetrics, getLifecycleAutomation, getContinuousGovernance,
  evaluateCompliance, getOrchestration, getContinuousValidation, getQualityGates,
  getPolicyDefinitions, registerPolicy, setPolicyEnabled,
  getGovernanceAudit, getGovernanceDrift, getGovernanceSnapshots, captureGovernanceSnapshot,
} from '../services/platform-lifecycle-automation';

export function registerPlatformLifecycleAutomationRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
) {
  const BASE = '/api/admin/platform-lifecycle-automation';
  const actorOf = (req: Request) => (req as any).user?.id ?? (req as any).session?.userId ?? null;
  const str = (v: unknown) => (v == null ? undefined : String(v));
  const intOf = (v: unknown) => {
    if (v == null) return undefined;
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : undefined;
  };

  // Persona-agnostic flag probe (no auth) so the admin UI can hide the tab when OFF.
  app.get(`${BASE}/enabled`, (_req: Request, res: Response) => {
    res.json({ enabled: isPlatformLifecycleAutomationEnabled() });
  });

  // Gate ALL remaining routes on the flag FIRST (503 before any auth/DB touch when OFF).
  const gate: RequestHandler = (_req, res, next) => {
    if (!isPlatformLifecycleAutomationEnabled()) {
      return res.status(503).json({ ok: false, error: 'platform_lifecycle_automation_disabled' });
    }
    next();
  };

  // Super-admin UI tab gate (res.ok). 503 when OFF (tab hidden), 200 when ON.
  app.get(`${BASE}/feature-flag`, gate, requireAuth, requireSuperAdmin, (_req, res) => {
    res.json({ ok: true, enabled: true });
  });

  // ---- reads (GET-never-writes) ----
  app.get(`${BASE}/summary`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getAutomationSummary(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/metrics`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getAutomationMetrics(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/automation`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getLifecycleAutomation(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/governance`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getContinuousGovernance(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/compliance`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await evaluateCompliance(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/orchestration`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getOrchestration(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/continuous-validation`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getContinuousValidation(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/quality-gates`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getQualityGates(pool)); } catch (e) { next(e); }
  });

  // Policy engine (built-in definitions + curated custom registry).
  app.get(`${BASE}/policies`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getPolicyDefinitions(pool, { domain: str(req.query.domain) })); } catch (e) { next(e); }
  });

  // Continuous audit (composite view + drift + snapshots). Literal sub-paths BEFORE any param handler.
  app.get(`${BASE}/audit/drift`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getGovernanceDrift(pool)); } catch (e) { next(e); }
  });

  app.get(`${BASE}/audit/snapshots`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await getGovernanceSnapshots(pool, { limit: intOf(req.query.limit) })); } catch (e) { next(e); }
  });

  app.get(`${BASE}/audit`, gate, requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try { res.json(await getGovernanceAudit(pool)); } catch (e) { next(e); }
  });

  // ---- writes (flag-ON only; each service path owns its lazy ensure-schema) ----
  app.post(`${BASE}/policies`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const r = await registerPolicy(pool, {
        policyKey: String(b.policyKey ?? b.policy_key ?? ''), title: String(b.title ?? ''), description: str(b.description),
        policyDomain: String(b.policyDomain ?? b.policy_domain ?? ''), scopeEntityType: str(b.scopeEntityType ?? b.scope_entity_type),
        ruleKind: String(b.ruleKind ?? b.rule_kind ?? ''), ruleField: str(b.ruleField ?? b.rule_field),
        ruleParams: (b.ruleParams ?? b.rule_params) && typeof (b.ruleParams ?? b.rule_params) === 'object' ? (b.ruleParams ?? b.rule_params) : undefined,
        severity: str(b.severity), enabled: b.enabled === false ? false : undefined, evidence: str(b.evidence),
        documentation: str(b.documentation), lifecycleUid: str(b.lifecycleUid ?? b.lifecycle_uid), actor: actorOf(req),
      });
      res.status(r.ok ? 200 : 400).json(r);
    } catch (e) { next(e); }
  });

  app.post(`${BASE}/policies/:uid/status`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const r = await setPolicyEnabled(pool, String(req.params.uid), b.enabled !== false);
      res.status(r.ok ? 200 : (r.error === 'unknown_policy' ? 404 : 400)).json(r);
    } catch (e) { next(e); }
  });

  app.post(`${BASE}/audit/capture`, gate, requireAuth, requireSuperAdmin, async (req, res, next) => {
    try { res.json(await captureGovernanceSnapshot(pool, actorOf(req))); } catch (e) { next(e); }
  });
}
