/**
 * MX-77X — Persona-scoped Enterprise Workforce surfaces (routes).
 *
 * The SuperAdmin console (`/api/enterprise-workforce/*`) is `requireSuperAdmin`-gated, so an
 * employer or employee can NOT consume it. These persona routes re-use the SAME composer view
 * functions (compose-never-recompute) but expose only what each persona may see:
 *
 *   EMPLOYER  /api/employer/workforce/*   (flag + employer requireAuth; under the existing
 *             `/api/employer` module gate). Org-level AGGREGATE developmental views only
 *             (skill-gap, talent-risk, talent-forecasting). Person-level succession/mobility
 *             candidates name individuals and stay SuperAdmin-scoped — EXCLUDED here.
 *
 *   EMPLOYEE  /api/my-workforce/*         (flag + requireAuth; self-scoped via resolveEffectiveUserId
 *             IDOR guard). Own readiness trend + role-general future-readiness (NOT personalized).
 *
 * Contract (identical canon to the console):
 *   - Flag-gated: `enterpriseWorkforceConsole` (FF_ENTERPRISE_WORKFORCE_CONSOLE). OFF => every route
 *     503 BEFORE any auth/DB touch. No new flag, no new tables, no DDL — all GET, read-only.
 *   - COMPOSE-NEVER-RECOMPUTE: composes the existing console view functions + read-only SELECTs.
 *   - Engines never throw; each view degrades to abstained:true rather than failing the request.
 *   - Developmental signals only; null=missing never fabricated 0; cohort aggregates k>=30.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isEnterpriseWorkforceConsoleEnabled } from '../config/feature-flags';
import { resolveEffectiveUserId } from './behavioural-memory';
import {
  ENTERPRISE_WORKFORCE_CONSOLE_VERSION,
  DEFAULT_ORG_ID,
  skillGapView,
  talentRiskView,
  talentForecastingView,
  employerWorkforceOverview,
  employeeWorkforceOverview,
  subjectReadinessTrendView,
} from '../services/enterprise-workforce-console';

type Mw = (req: any, res: any, next: any) => void;

export function registerEnterpriseWorkforcePersonaRoutes(app: Express, pool: Pool, requireAuth: Mw): void {
  const gate: Mw = (_req, res, next) => {
    if (!isEnterpriseWorkforceConsoleEnabled()) {
      return res.status(503).json({
        error: 'Enterprise Workforce surfaces are not enabled',
        flag: 'enterpriseWorkforceConsole',
        env: 'FF_ENTERPRISE_WORKFORCE_CONSOLE',
      });
    }
    next();
  };
  const guards = [gate, requireAuth];

  // ── EMPLOYER — org-level AGGREGATE developmental views (no person-level rows) ──
  const eb = '/api/employer/workforce';
  app.get(`${eb}/_meta/status`, ...guards, (_req: Request, res: Response) => {
    res.json({ engine: 'employer-workforce', version: ENTERPRISE_WORKFORCE_CONSOLE_VERSION, scope: 'employer', ok: true });
  });
  app.get(`${eb}/overview`, ...guards, async (_req: Request, res: Response) => {
    res.json(await employerWorkforceOverview(pool, DEFAULT_ORG_ID));
  });
  app.get(`${eb}/skill-gap`, ...guards, async (_req: Request, res: Response) => {
    res.json(await skillGapView(pool, DEFAULT_ORG_ID));
  });
  app.get(`${eb}/talent-risk`, ...guards, async (_req: Request, res: Response) => {
    res.json(await talentRiskView(pool, DEFAULT_ORG_ID));
  });
  app.get(`${eb}/talent-forecasting`, ...guards, async (_req: Request, res: Response) => {
    res.json(await talentForecastingView(pool));
  });

  // ── EMPLOYEE — strictly self-scoped (IDOR-guarded) ──
  const mb = '/api/my-workforce';
  app.get(`${mb}/_meta/status`, ...guards, (_req: Request, res: Response) => {
    res.json({ engine: 'employee-workforce', version: ENTERPRISE_WORKFORCE_CONSOLE_VERSION, scope: 'employee-self', ok: true });
  });
  app.get(`${mb}/overview`, ...guards, async (req: Request, res: Response) => {
    const resolved = resolveEffectiveUserId(req, req.query.userId);
    if (resolved.forbidden) return res.status(403).json({ error: 'forbidden: cross-user access denied' });
    res.json(await employeeWorkforceOverview(pool, resolved.userId ?? ''));
  });
  app.get(`${mb}/readiness-trend`, ...guards, async (req: Request, res: Response) => {
    const resolved = resolveEffectiveUserId(req, req.query.userId);
    if (resolved.forbidden) return res.status(403).json({ error: 'forbidden: cross-user access denied' });
    res.json(await subjectReadinessTrendView(pool, resolved.userId ?? ''));
  });
}
