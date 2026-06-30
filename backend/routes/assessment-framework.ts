/**
 * CAPADEX 3.0 — Program 1 · Phase 1.3 Assessment Framework Completion routes (read-only composer).
 *
 * Serves the ONE canonical Assessment Framework + measured coverage + classified gaps:
 *   - GET /api/assessment-framework/enabled    flag probe (flag state isn't sensitive; 503 when OFF)
 *   - GET /api/admin/assessment-framework/framework   canonical 10-type taxonomy + 19→10 crosswalk + overlaps
 *   - GET /api/admin/assessment-framework/coverage    per-type status + evidence VERIFIED vs live FS+DB
 *   - GET /api/admin/assessment-framework/gaps        classified remaining gaps
 *   - GET /api/admin/assessment-framework/summary     rollup + enterprise-ready verdict
 *
 * Strictly additive + reversible + flag-gated (`assessmentFrameworkCompletion`,
 * FF_ASSESSMENT_FRAMEWORK_COMPLETION, default OFF):
 *   - OFF → every route 503 → byte-identical legacy behaviour (no schema touched).
 *   - GET-only; reads via to_regclass probes / fs existence checks and NEVER writes (no DDL anywhere).
 *   - Never throws: any unexpected error degrades to a 200 honest-degraded JSON.
 *   - Detail routes are super-admin (mounted under /api/admin → global auth gate also applies).
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  ASSESSMENT_FRAMEWORK,
  SPEC_19_CROSSWALK,
  ASSESSMENT_AXES,
  KNOWN_OVERLAPS,
} from '../config/assessment-framework';
import {
  composeCoverage,
  composeSummary,
  ASSESSMENT_GAPS,
} from '../services/assessment-framework-engine';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('assessmentFrameworkCompletion')) {
    return res.status(503).json({ ok: false, error: 'assessment_framework_completion_disabled' });
  }
  next();
}

export function registerAssessmentFrameworkRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  // Flag probe (flag STATE is not sensitive). flagGate first → 503 when OFF; res.ok=true only when ON.
  app.get('/api/assessment-framework/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  // Canonical framework (static registry — no DB read).
  app.get('/api/admin/assessment-framework/framework', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true,
        taxonomy_frozen: true,
        axes: ASSESSMENT_AXES,
        types: ASSESSMENT_FRAMEWORK,
        spec_19_crosswalk: SPEC_19_CROSSWALK,
        known_overlaps: KNOWN_OVERLAPS,
      });
    } catch (err) {
      console.error('[assessment-framework] framework error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Per-type coverage — evidence VERIFIED against the live filesystem + DB (SSoT for present/absent).
  app.get('/api/admin/assessment-framework/coverage', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, coverage: await composeCoverage(pool) });
    } catch (err) {
      console.error('[assessment-framework] coverage error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Classified remaining gaps.
  app.get('/api/admin/assessment-framework/gaps', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, gaps: ASSESSMENT_GAPS });
    } catch (err) {
      console.error('[assessment-framework] gaps error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });

  // Rollup + enterprise-ready verdict.
  app.get('/api/admin/assessment-framework/summary', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, summary: await composeSummary(pool) });
    } catch (err) {
      console.error('[assessment-framework] summary error:', err);
      res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
    }
  });
}
