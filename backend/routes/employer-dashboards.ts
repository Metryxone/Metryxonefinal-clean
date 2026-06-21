/**
 * PHASE 5.13 — Employer Dashboards (routes).
 *
 * Base: /api/employer-dashboards/*  (ALL GET — pure read/compose layer; no POST, no DDL)
 *   meta      GET /_meta/status
 *   config    GET /config                                  (sections per dashboard, bands, disclaimer)
 *   employer  GET /employer/:employerId/employer           (employer_dashboard — executive)
 *   recruiter GET /employer/:employerId/recruiter          (recruiter_dashboard — recruiting ops)
 *   talent    GET /employer/:employerId/talent             (talent_dashboard — talent / L&D)
 *   overview  GET /employer/:employerId/overview           (all three — ONE evidence load)
 *
 * Contract:
 *   - Flag-gated: `employerDashboards` (FF_EMPLOYER_DASHBOARDS). OFF => every route 503 BEFORE any
 *     auth/DB touch (byte-identical legacy).
 *   - Super-admin gated (requireAuth -> requireSuperAdmin). IDOR-safe inside the engines (every read
 *     strictly scoped by employer_id; cross-employer rows never leak).
 *   - PURE READ: composes already-recorded operator evidence + the Phase 5.12 engines; runs NO DDL
 *     and writes NO rows. Engines never throw; not-found => 404, bad input => 400.
 *   - Literal / more-specific sub-paths registered BEFORE param routes.
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isEmployerDashboardsEnabled } from '../config/feature-flags';
import type { EngineResult } from '../services/workforce-intelligence-shared';
import {
  EMPLOYER_DASHBOARD_VERSION, EMPLOYER_DASHBOARD_DISCLAIMER, PROVENANCE,
  FUNNEL_STAGES, FUNNEL_ACTIVE,
} from '../services/employer-dashboard-shared';
import {
  computeEmployerDashboard, computeRecruiterDashboard, computeTalentDashboard, computeDashboardOverview,
} from '../services/employer-dashboard-engine';

type Mw = (req: any, res: any, next: any) => void;

function send(res: Response, result: EngineResult): void {
  if (result.ok) { res.json(result.data); return; }
  const status = result.code === 'not_found' ? 404 : result.code === 'conflict' ? 409 : 400;
  res.status(status).json({ error: result.message, code: result.code });
}

export function registerEmployerDashboardsRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const gate: Mw = (_req, res, next) => {
    if (!isEmployerDashboardsEnabled()) {
      return res.status(503).json({
        error: 'Employer Dashboards is not enabled',
        flag: 'employerDashboards',
        env: 'FF_EMPLOYER_DASHBOARDS',
      });
    }
    next();
  };
  const guards = [gate, requireAuth, requireSuperAdmin];
  const base = '/api/employer-dashboards';

  // ── meta + config (literal — first) ────────────────────────────────────────
  app.get(`${base}/_meta/status`, ...guards, (_req: Request, res: Response) => {
    res.json({ engine: 'employer-dashboards', version: EMPLOYER_DASHBOARD_VERSION, ok: true });
  });
  app.get(`${base}/config`, ...guards, (_req: Request, res: Response) => {
    res.json({
      engine: 'employer-dashboards',
      version: EMPLOYER_DASHBOARD_VERSION,
      dashboards: {
        employer_dashboard:  { sections: ['open_jobs', 'applications', 'hiring_funnel', 'readiness', 'competency_analytics', 'assessment_analytics', 'hiring_analytics'] },
        recruiter_dashboard: { sections: ['open_jobs', 'applications', 'hiring_funnel', 'talent_pool'] },
        talent_dashboard:    { sections: ['talent_pool', 'readiness', 'competency_analytics', 'assessment_analytics'] },
      },
      funnel_stages: FUNNEL_STAGES,
      funnel_active_stages: FUNNEL_ACTIVE,
      bands: { high: '>=75', moderate: '>=50', developing: '>=25', low: '<25', unmeasured: 'null (coverage 0)' },
      composes: 'Phase 5.12 workforce-intelligence engines (team competency / department readiness / talent distribution / skill inventory / capability heatmap) over a single evidence load',
      provenance: PROVENANCE,
      disclaimer: EMPLOYER_DASHBOARD_DISCLAIMER,
    });
  });

  // ── per-dashboard employer aggregates (read-only) ──────────────────────────
  app.get(`${base}/employer/:employerId/employer`, ...guards, async (req: Request, res: Response) => {
    send(res, await computeEmployerDashboard(pool, req.params.employerId));
  });
  app.get(`${base}/employer/:employerId/recruiter`, ...guards, async (req: Request, res: Response) => {
    send(res, await computeRecruiterDashboard(pool, req.params.employerId));
  });
  app.get(`${base}/employer/:employerId/talent`, ...guards, async (req: Request, res: Response) => {
    send(res, await computeTalentDashboard(pool, req.params.employerId));
  });
  app.get(`${base}/employer/:employerId/overview`, ...guards, async (req: Request, res: Response) => {
    send(res, await computeDashboardOverview(pool, req.params.employerId));
  });
}
