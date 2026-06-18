/**
 * Competency Framework Intelligence — Phase 1 FOUNDATION routes (read-only).
 *
 * Exposes the EXISTING competency framework as ONE master spine by composing the
 * two disjoint namespaces (see services/competency-framework-intelligence.ts). Strictly
 * additive + read-only: every route is gated by the
 * `competencyFrameworkIntelligence` flag. Flag OFF → 503 `feature_disabled`
 * (the SuperAdmin panel hides) → byte-identical legacy behaviour. No writes, no
 * schema/DDL, never fabricates rows.
 *
 * Public (auth) read views:
 *   GET /api/competency-intelligence/spine          — canonical spine decision
 *   GET /api/competency-intelligence/competencies   — canonical 300-genome
 *   GET /api/competency-intelligence/role-requirements?role=... — role → competencies
 *   GET /api/competency-intelligence/levels         — proficiency levels / anchor records / layers
 *   GET /api/competency-intelligence/indicators     — behavioural indicator records (ont_indicators)
 *   GET /api/competency-intelligence/taxonomy       — Industry→…→Role records (both namespaces)
 *   GET /api/competency-intelligence/crosswalk      — id-space crosswalk registry
 *
 * Admin (superadmin) report:
 *   GET /api/admin/competency-intelligence/readiness — framework readiness/gap report
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCompetencyFrameworkIntelligenceEnabled } from '../config/feature-flags.js';
import {
  COMPETENCY_INTELLIGENCE_VERSION,
  CANONICAL_SPINE,
  getMasterCompetencies,
  getRoleRequirements,
  getCompetencyLevels,
  getIndicators,
  getTaxonomy,
  buildCompetencyCrosswalk,
  getFrameworkReadiness,
} from '../services/competency-framework-intelligence.js';

export function registerCompetencyFrameworkIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF. This is the
  // only byte-identical-OFF state: the route exists but never reads/writes.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCompetencyFrameworkIntelligenceEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'competencyFrameworkIntelligence' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: COMPETENCY_INTELLIGENCE_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[competency-intelligence]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- Public (authenticated) read views ----------------------------------
  app.get('/api/competency-intelligence/spine', gate, requireAuth, wrap(async () => CANONICAL_SPINE));

  app.get('/api/competency-intelligence/competencies', gate, requireAuth, wrap(async (req) =>
    getMasterCompetencies(pool, {
      domainId: req.query.domain_id as string | undefined,
      familyId: req.query.family_id as string | undefined,
      search: req.query.q as string | undefined,
      limit: req.query.limit ? Math.max(1, parseInt(String(req.query.limit), 10) || 0) : undefined,
    }),
  ));

  app.get('/api/competency-intelligence/role-requirements', gate, requireAuth, wrap(async (req) =>
    getRoleRequirements(pool, String(req.query.role ?? req.query.q ?? '')),
  ));

  app.get('/api/competency-intelligence/levels', gate, requireAuth, wrap(async () => getCompetencyLevels(pool)));

  app.get('/api/competency-intelligence/indicators', gate, requireAuth, wrap(async () => getIndicators(pool)));

  app.get('/api/competency-intelligence/taxonomy', gate, requireAuth, wrap(async () => getTaxonomy(pool)));

  app.get('/api/competency-intelligence/crosswalk', gate, requireAuth, wrap(async () => buildCompetencyCrosswalk(pool)));

  // ---- Admin (superadmin) framework readiness / gap report ----------------
  app.get(
    '/api/admin/competency-intelligence/readiness',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => getFrameworkReadiness(pool)),
  );
}
