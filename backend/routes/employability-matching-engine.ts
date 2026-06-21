/**
 * PHASE 5.6 — Employability Matching Engine (routes).
 *
 * Base: /api/employability-matching-engine/*
 *   - employability_matching_engine : GET /subject/:subjectId           (all 3 metrics)
 *                                     GET /subject/:subjectId/hiring-readiness
 *   - job_readiness_engine          : GET /subject/:subjectId/job-readiness
 *   - employer_fit_engine           : GET /subject/:subjectId/employer-fit
 *   - explain                       : GET /subject/:subjectId/explain    (full + provenance)
 *
 * Contract:
 *   - Flag-gated: `employabilityMatching` (FF_EMPLOYABILITY_MATCHING). OFF => every
 *     route 503 BEFORE any auth/DB touch (byte-identical legacy).
 *   - Super-admin gated (requireAuth -> requireSuperAdmin). IDOR-safe: no
 *     client-supplied identity is trusted.
 *   - GET-only / read-only: composes the read-only loadPassportContext and runs
 *     NO DDL (this phase adds zero tables).
 *   - Engine never throws; bad input => 400.
 *   - Literal/more-specific sub-paths registered BEFORE param routes.
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isEmployabilityMatchingEnabled } from '../config/feature-flags';
import {
  EMPLOYABILITY_MATCHING_ENGINE_VERSION as ENGINE_VERSION,
  buildEmployabilityMatch,
  getHiringReadiness,
  getJobReadiness,
  getEmployerFit,
  type EngineResult,
} from '../services/employability-matching-engine';

type Mw = (req: any, res: any, next: any) => void;

function send(res: Response, result: EngineResult): void {
  if (result.ok) {
    res.json(result.data);
    return;
  }
  const status = result.code === 'not_found' ? 404 : 400;
  res.status(status).json({ error: result.message, code: result.code });
}

export function registerEmployabilityMatchingEngineRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const gate: Mw = (_req, res, next) => {
    if (!isEmployabilityMatchingEnabled()) {
      return res.status(503).json({
        error: 'Employability Matching Engine is not enabled',
        flag: 'employabilityMatching',
        env: 'FF_EMPLOYABILITY_MATCHING',
      });
    }
    next();
  };
  const guards = [gate, requireAuth, requireSuperAdmin];
  const base = '/api/employability-matching-engine';

  // ── meta (literal — registered first) ──────────────────────────────────────
  app.get(`${base}/_meta/status`, ...guards, (_req: Request, res: Response) => {
    res.json({ engine: 'employability-matching-engine', version: ENGINE_VERSION, ok: true });
  });

  // ── single-metric (more specific — before /subject/:subjectId) ─────────────
  app.get(`${base}/subject/:subjectId/hiring-readiness`, ...guards, async (req: Request, res: Response) => {
    send(res, await getHiringReadiness(pool, req.params.subjectId));
  });

  app.get(`${base}/subject/:subjectId/job-readiness`, ...guards, async (req: Request, res: Response) => {
    send(res, await getJobReadiness(pool, req.params.subjectId));
  });

  app.get(`${base}/subject/:subjectId/employer-fit`, ...guards, async (req: Request, res: Response) => {
    send(res, await getEmployerFit(pool, req.params.subjectId));
  });

  // ── explain (full envelope incl. inputs/provenance) ────────────────────────
  app.get(`${base}/subject/:subjectId/explain`, ...guards, async (req: Request, res: Response) => {
    send(res, await buildEmployabilityMatch(pool, req.params.subjectId));
  });

  // ── full match (all three metrics) ─────────────────────────────────────────
  app.get(`${base}/subject/:subjectId`, ...guards, async (req: Request, res: Response) => {
    send(res, await buildEmployabilityMatch(pool, req.params.subjectId));
  });
}
