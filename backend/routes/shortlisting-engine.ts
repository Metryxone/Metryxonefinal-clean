/**
 * PHASE 5.9 — Shortlisting Engine (routes).
 *
 * Base: /api/shortlisting-engine/*
 *   meta      GET   /_meta/status
 *   workflow  GET   /workflow                                  (workflow_engine FSM definition)
 *   list      GET   /job/:jobId/pipeline?status=               (read-only)
 *   summary   GET   /job/:jobId/summary                        (funnel + coverage, read-only)
 *   status    POST  /job/:jobId/candidate/:candidateId/status  (WRITE — set status)
 *   history   GET   /job/:jobId/candidate/:candidateId/history (workflow tracking, read-only)
 *   entry     GET   /job/:jobId/candidate/:candidateId         (current status, read-only)
 *
 * Contract:
 *   - Flag-gated: `shortlisting` (FF_SHORTLISTING). OFF => every route 503 BEFORE
 *     any auth/DB/DDL touch (byte-identical legacy).
 *   - Super-admin gated (requireAuth -> requireSuperAdmin). IDOR-safe: candidates
 *     are job-scoped inside the engine (strict equality); no client identity trusted.
 *   - GET = read-only (to_regclass probe + degrade, NEVER runs DDL). POST = the
 *     only write path; the engine ensures schema there.
 *   - Engine never throws; not-found => 404, conflict => 409, bad input => 400.
 *   - Literal / more-specific sub-paths registered BEFORE param routes.
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isShortlistingEnabled } from '../config/feature-flags';
import {
  SHORTLISTING_ENGINE_VERSION as ENGINE_VERSION,
  getWorkflowDefinition,
  setPipelineStatus,
  getPipelineEntry,
  listPipeline,
  getPipelineHistory,
  pipelineSummary,
  type EngineResult,
} from '../services/shortlisting-engine';

type Mw = (req: any, res: any, next: any) => void;

function send(res: Response, result: EngineResult): void {
  if (result.ok) { res.json(result.data); return; }
  const status = result.code === 'not_found' ? 404 : result.code === 'conflict' ? 409 : 400;
  res.status(status).json({ error: result.message, code: result.code });
}

export function registerShortlistingEngineRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const gate: Mw = (_req, res, next) => {
    if (!isShortlistingEnabled()) {
      return res.status(503).json({
        error: 'Shortlisting engine is not enabled',
        flag: 'shortlisting',
        env: 'FF_SHORTLISTING',
      });
    }
    next();
  };
  const guards = [gate, requireAuth, requireSuperAdmin];
  const base = '/api/shortlisting-engine';

  // ── meta + workflow definition (literal — first) ───────────────────────────
  app.get(`${base}/_meta/status`, ...guards, (_req: Request, res: Response) => {
    res.json({ engine: 'shortlisting-engine', version: ENGINE_VERSION, ok: true });
  });
  app.get(`${base}/workflow`, ...guards, (_req: Request, res: Response) => {
    res.json({ engine: 'shortlisting-engine', version: ENGINE_VERSION, workflow: getWorkflowDefinition() });
  });

  // ── job-scoped reads (literal sub-paths BEFORE the param-terminal) ──────────
  app.get(`${base}/job/:jobId/pipeline`, ...guards, async (req: Request, res: Response) => {
    send(res, await listPipeline(pool, req.params.jobId, { status: (req.query.status as string) ?? null }));
  });
  app.get(`${base}/job/:jobId/summary`, ...guards, async (req: Request, res: Response) => {
    send(res, await pipelineSummary(pool, req.params.jobId));
  });

  // ── Status Management (WRITE) ──────────────────────────────────────────────
  app.post(`${base}/job/:jobId/candidate/:candidateId/status`, ...guards, async (req: Request, res: Response) => {
    const b = req.body ?? {};
    send(res, await setPipelineStatus(pool, {
      jobId: req.params.jobId,
      candidateId: req.params.candidateId,
      status: b.status,
      note: b.note ?? null,
      actor: b.actor ?? b.updatedBy ?? b.updated_by ?? null,
    }));
  });

  // ── Workflow Tracking + current entry (history BEFORE the param-terminal) ──
  app.get(`${base}/job/:jobId/candidate/:candidateId/history`, ...guards, async (req: Request, res: Response) => {
    send(res, await getPipelineHistory(pool, req.params.jobId, req.params.candidateId));
  });
  app.get(`${base}/job/:jobId/candidate/:candidateId`, ...guards, async (req: Request, res: Response) => {
    send(res, await getPipelineEntry(pool, req.params.jobId, req.params.candidateId));
  });
}
