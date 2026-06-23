/**
 * Competency Coverage Matrices routes — MX-100X Phase 3 (additive, feature-flagged, READ-ONLY).
 *
 * Mount prefix: /api/v2/competency-coverage-matrices
 * Gating order: foundation -> competencyCoverageMatrices -> auth.
 * Flag OFF (`competencyCoverageMatrices`, env FF_COMPETENCY_COVERAGE_MATRICES) → every route 503
 * BEFORE any auth/DB touch → byte-identical legacy behaviour (existing competency / assessment /
 * benchmark routes UNTOUCHED).
 *
 *   GET  /overview     — composed overview of all three matrices + honest findings
 *   GET  /competency   — competency coverage matrix (by type + by domain)
 *   GET  /assessment   — assessment coverage matrix (genome bridge) + disjoint bank context
 *   GET  /benchmark    — benchmark coverage matrix (k-anonymity-aware)
 *   GET  /feature-flag — flag readback (also gated → 503 OFF)
 *   GET  /_meta/versions — methodology stamp (also gated → 503 OFF)
 *
 * Every route is READ-ONLY (to_regclass probe + degrade; no DDL, no POST). There is no write path
 * in this phase.
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  COMPETENCY_COVERAGE_MATRICES_VERSION,
  COVERAGE_MATRICES_METHODOLOGY,
  getCompetencyCoverageMatrix,
  getAssessmentCoverageMatrix,
  getBenchmarkCoverageMatrix,
  getCoverageMatricesOverview,
} from '../services/competency-coverage-matrices-engine';
import {
  isAdaptiveIntelligenceFoundationEnabled,
  isCompetencyCoverageMatricesEnabled,
} from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = { COMPETENCY_COVERAGE_MATRICES_VERSION };
const LANGUAGE_POLICY = {
  allowed: ['competency coverage', 'assessment coverage', 'benchmark coverage', 'assessment readiness', 'content gap', 'k-anonymity suppression'],
  disallowed: ['hiring recommendation', 'promotion verdict', 'pass/fail', 'suitability score', 'salary guarantee'],
};

function flagState() {
  return {
    adaptiveIntelligenceFoundation: isAdaptiveIntelligenceFoundationEnabled(),
    competencyCoverageMatrices: isCompetencyCoverageMatricesEnabled(),
  };
}
function envelope<T extends object>(payload: T) {
  return { ok: true, ...payload, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: flagState() };
}
function errorEnvelope(error: string, extra: Record<string, unknown> = {}, code = 503) {
  return {
    status: code,
    body: { ok: false, error, ...extra, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: flagState() },
  };
}

function requireFoundation(_req: Request, res: Response, next: NextFunction) {
  if (!isAdaptiveIntelligenceFoundationEnabled()) {
    const e = errorEnvelope('adaptiveIntelligenceFoundation disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}
function requireCoverageMatrices(_req: Request, res: Response, next: NextFunction) {
  if (!isCompetencyCoverageMatricesEnabled()) {
    const e = errorEnvelope('competencyCoverageMatrices disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}

export function registerCompetencyCoverageMatricesRoutes(opts: {
  app: Express;
  pool: Pool;
  requireAuth: RequireAuth;
}): void {
  const { app, pool, requireAuth } = opts;
  const BASE = '/api/v2/competency-coverage-matrices';

  // Flag-OFF contract: EVERY route 503s before any work when OFF (incl. readback/meta).
  app.get(`${BASE}/feature-flag`, requireFoundation, requireCoverageMatrices, (_req, res) =>
    res.json({ ok: true, feature_flag: flagState() }));
  app.get(`${BASE}/_meta/versions`, requireFoundation, requireCoverageMatrices, (_req, res) =>
    res.json({ ok: true, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, methodology: COVERAGE_MATRICES_METHODOLOGY }));

  app.get(`${BASE}/overview`, requireFoundation, requireCoverageMatrices, requireAuth, async (_req, res) => {
    try {
      return res.json(envelope({ overview: await getCoverageMatricesOverview(pool) }));
    } catch (err) {
      const e = errorEnvelope('overview_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  app.get(`${BASE}/competency`, requireFoundation, requireCoverageMatrices, requireAuth, async (_req, res) => {
    try {
      return res.json(envelope({ competency: await getCompetencyCoverageMatrix(pool) }));
    } catch (err) {
      const e = errorEnvelope('competency_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  app.get(`${BASE}/assessment`, requireFoundation, requireCoverageMatrices, requireAuth, async (_req, res) => {
    try {
      return res.json(envelope({ assessment: await getAssessmentCoverageMatrix(pool) }));
    } catch (err) {
      const e = errorEnvelope('assessment_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  app.get(`${BASE}/benchmark`, requireFoundation, requireCoverageMatrices, requireAuth, async (_req, res) => {
    try {
      return res.json(envelope({ benchmark: await getBenchmarkCoverageMatrix(pool) }));
    } catch (err) {
      const e = errorEnvelope('benchmark_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });
}
