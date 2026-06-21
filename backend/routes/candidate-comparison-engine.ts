/**
 * PHASE 5.8 — Candidate Comparison Engine (routes).
 *
 * Base: /api/candidate-comparison-engine/*
 *   meta       GET   /_meta/status
 *   Compare    GET   /job/:jobId/compare?candidates=a,b,c       (read-only)
 *   dashboard  POST  /job/:jobId/dashboard                      (WRITE — save view)
 *   list       GET   /job/:jobId/dashboards
 *   read       GET   /dashboard/:dashboardId
 *   report     POST  /job/:jobId/report                         (WRITE — generate report)
 *   list       GET   /job/:jobId/reports
 *   read       GET   /report/:reportId
 *
 * Contract:
 *   - Flag-gated: `candidateComparison` (FF_CANDIDATE_COMPARISON). OFF => every
 *     route 503 BEFORE any auth/DB/DDL touch (byte-identical legacy).
 *   - Super-admin gated (requireAuth -> requireSuperAdmin). IDOR-safe: candidate
 *     comparison is job-scoped inside the engine; no client identity is trusted.
 *   - GET = read-only (to_regclass probe + degrade, NEVER runs DDL). POST = the
 *     only write path; the engine ensures schema there.
 *   - Engine never throws; not-found => 404, conflict => 409, bad input => 400.
 *   - Literal / more-specific sub-paths registered BEFORE param routes.
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isCandidateComparisonEnabled } from '../config/feature-flags';
import {
  CANDIDATE_COMPARISON_ENGINE_VERSION as ENGINE_VERSION,
  compareCandidates,
  saveComparisonDashboard,
  getComparisonDashboard,
  listComparisonDashboards,
  generateComparisonReport,
  getComparisonReport,
  listComparisonReports,
  type EngineResult,
} from '../services/candidate-comparison-engine';

type Mw = (req: any, res: any, next: any) => void;

function send(res: Response, result: EngineResult): void {
  if (result.ok) { res.json(result.data); return; }
  const status = result.code === 'not_found' ? 404 : result.code === 'conflict' ? 409 : 400;
  res.status(status).json({ error: result.message, code: result.code });
}

function parseCandidates(raw: unknown): string[] {
  return String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

export function registerCandidateComparisonEngineRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const gate: Mw = (_req, res, next) => {
    if (!isCandidateComparisonEnabled()) {
      return res.status(503).json({
        error: 'Candidate Comparison engine is not enabled',
        flag: 'candidateComparison',
        env: 'FF_CANDIDATE_COMPARISON',
      });
    }
    next();
  };
  const guards = [gate, requireAuth, requireSuperAdmin];
  const base = '/api/candidate-comparison-engine';

  // ── meta (literal — first) ─────────────────────────────────────────────────
  app.get(`${base}/_meta/status`, ...guards, (_req: Request, res: Response) => {
    res.json({ engine: 'candidate-comparison-engine', version: ENGINE_VERSION, ok: true });
  });

  // ── Comparison (read-only) ─────────────────────────────────────────────────
  app.get(`${base}/job/:jobId/compare`, ...guards, async (req: Request, res: Response) => {
    send(res, await compareCandidates(pool, req.params.jobId, parseCandidates(req.query.candidates)));
  });

  // ── Dashboard save (WRITE) + reads ─────────────────────────────────────────
  app.post(`${base}/job/:jobId/dashboard`, ...guards, async (req: Request, res: Response) => {
    const b = req.body ?? {};
    send(res, await saveComparisonDashboard(pool, {
      jobId: req.params.jobId,
      candidateIds: Array.isArray(b.candidateIds ?? b.candidate_ids)
        ? (b.candidateIds ?? b.candidate_ids)
        : parseCandidates(b.candidates),
      name: b.name ?? null,
      createdBy: b.createdBy ?? b.created_by ?? null,
    }));
  });
  app.get(`${base}/job/:jobId/dashboards`, ...guards, async (req: Request, res: Response) => {
    send(res, await listComparisonDashboards(pool, req.params.jobId));
  });
  app.get(`${base}/dashboard/:dashboardId`, ...guards, async (req: Request, res: Response) => {
    send(res, await getComparisonDashboard(pool, req.params.dashboardId));
  });

  // ── Report generate (WRITE) + reads ────────────────────────────────────────
  app.post(`${base}/job/:jobId/report`, ...guards, async (req: Request, res: Response) => {
    const b = req.body ?? {};
    send(res, await generateComparisonReport(pool, {
      jobId: req.params.jobId,
      candidateIds: Array.isArray(b.candidateIds ?? b.candidate_ids)
        ? (b.candidateIds ?? b.candidate_ids)
        : parseCandidates(b.candidates),
      dashboardId: b.dashboardId ?? b.dashboard_id ?? null,
      format: b.format ?? null,
      generatedBy: b.generatedBy ?? b.generated_by ?? null,
    }));
  });
  app.get(`${base}/job/:jobId/reports`, ...guards, async (req: Request, res: Response) => {
    send(res, await listComparisonReports(pool, req.params.jobId));
  });
  app.get(`${base}/report/:reportId`, ...guards, async (req: Request, res: Response) => {
    send(res, await getComparisonReport(pool, req.params.reportId));
  });
}
