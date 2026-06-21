/**
 * PHASE 5.3 — Job Posting Engine (routes).
 *
 * Surfaces the three deliverable engines under one base: /api/job-posting-engine/*
 *   - job_posting_engine    : POST /jobs (create), PUT /jobs/:id (edit), POST /jobs/:id/publish
 *   - job_management_engine  : POST /jobs/:id/{pause,close,archive}, PUT /jobs/:id/visibility
 *   - job_workflows          : POST /jobs/:id/submit, POST /jobs/:id/approve, GET /jobs/:id/workflow
 *
 * Contract:
 *   - Flag-gated: `jobPostingEngine` (FF_JOB_POSTING_ENGINE). OFF => every route 503
 *     BEFORE any auth/DB touch (byte-identical legacy).
 *   - Super-admin gated (requireAuth -> requireSuperAdmin) — operator-supplied ids
 *     are never trusted for actor/creator; the authenticated principal is stamped.
 *   - GET routes are read-only (engine uses to_regclass probes, no DDL).
 *   - Engine never throws; invalid transitions map to 409, not-found to 404,
 *     bad input to 400.
 *   - Literal sub-paths registered BEFORE param routes (Express order discipline).
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isJobPostingEngineEnabled, JOB_POSTING_ENGINE_VERSION } from '../config/feature-flags';
import {
  JOB_POSTING_ENGINE_VERSION as ENGINE_VERSION,
  JOB_STATUS,
  VISIBILITY,
  CHANNELS,
  createJob,
  editJob,
  publishJob,
  pauseJob,
  closeJob,
  archiveJob,
  setVisibility,
  distributeJob,
  unpublishChannel,
  getDistributions,
  submitForReview,
  decideStage,
  getWorkflow,
  listJobs,
  getJob,
  type Actor,
  type EngineResult,
} from '../services/job-posting-engine';

type Mw = (req: any, res: any, next: any) => void;

export function registerJobPostingEngineRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  // Flag gate runs FIRST on every route — OFF => 503 before auth/DB.
  const gate: Mw = (_req, res, next) => {
    if (!isJobPostingEngineEnabled()) {
      return res.status(503).json({
        error: 'Job Posting Engine is not enabled',
        flag: 'jobPostingEngine',
        env: 'FF_JOB_POSTING_ENGINE',
      });
    }
    next();
  };

  const guards = [gate, requireAuth, requireSuperAdmin];

  const actorOf = (req: Request): Actor => ({
    id: (req as any).user?.id,
    role: (req as any).user?.role ?? 'super_admin',
  });

  const send = (res: Response, r: EngineResult, okStatus = 200) => {
    if (r.ok) return res.status(okStatus).json({ success: true, data: r.data });
    const status = r.code === 'not_found' ? 404 : r.code === 'invalid_transition' ? 409 : 400;
    return res.status(status).json({ success: false, code: r.code, error: r.message });
  };

  // ── meta (literal — before any param route) ────────────────────────────────
  app.get('/api/job-posting-engine/_meta/status', ...guards, (_req: Request, res: Response) => {
    res.json({
      engine: 'job-posting-engine',
      version: ENGINE_VERSION ?? JOB_POSTING_ENGINE_VERSION,
      flag: 'jobPostingEngine',
      statuses: Object.values(JOB_STATUS),
      visibility: VISIBILITY,
      channels: CHANNELS,
      engines: {
        job_posting_engine: ['create', 'edit', 'publish'],
        job_management_engine: ['pause', 'close', 'archive', 'visibility', 'distribute', 'unpublish_channel'],
        job_workflows: ['submit', 'approve(hr|legal|leadership)', 'reject', 'history'],
      },
    });
  });

  // ── reads ──────────────────────────────────────────────────────────────────
  app.get('/api/job-posting-engine/jobs', ...guards, async (req: Request, res: Response) => {
    const r = await listJobs(pool, {
      status: (req.query.status as string) || undefined,
      visibility: (req.query.visibility as string) || undefined,
    });
    send(res, r);
  });

  // Literal sub-paths BEFORE /jobs/:id
  app.get('/api/job-posting-engine/jobs/:id/workflow', ...guards, async (req: Request, res: Response) => {
    send(res, await getWorkflow(pool, req.params.id));
  });

  app.get('/api/job-posting-engine/jobs/:id/distributions', ...guards, async (req: Request, res: Response) => {
    send(res, await getDistributions(pool, req.params.id));
  });

  app.get('/api/job-posting-engine/jobs/:id', ...guards, async (req: Request, res: Response) => {
    send(res, await getJob(pool, req.params.id));
  });

  // ── job_posting_engine: create / edit / publish ────────────────────────────
  app.post('/api/job-posting-engine/jobs', ...guards, async (req: Request, res: Response) => {
    send(res, await createJob(pool, actorOf(req), req.body ?? {}), 201);
  });

  app.put('/api/job-posting-engine/jobs/:id', ...guards, async (req: Request, res: Response) => {
    send(res, await editJob(pool, actorOf(req), req.params.id, req.body ?? {}));
  });

  app.post('/api/job-posting-engine/jobs/:id/publish', ...guards, async (req: Request, res: Response) => {
    send(res, await publishJob(pool, actorOf(req), req.params.id, req.body?.comments));
  });

  // ── job_management_engine: pause / close / archive / visibility ────────────
  app.post('/api/job-posting-engine/jobs/:id/pause', ...guards, async (req: Request, res: Response) => {
    send(res, await pauseJob(pool, actorOf(req), req.params.id, req.body?.comments));
  });

  app.post('/api/job-posting-engine/jobs/:id/close', ...guards, async (req: Request, res: Response) => {
    send(res, await closeJob(pool, actorOf(req), req.params.id, req.body?.comments));
  });

  app.post('/api/job-posting-engine/jobs/:id/archive', ...guards, async (req: Request, res: Response) => {
    send(res, await archiveJob(pool, actorOf(req), req.params.id, req.body?.comments));
  });

  app.put('/api/job-posting-engine/jobs/:id/visibility', ...guards, async (req: Request, res: Response) => {
    send(res, await setVisibility(pool, actorOf(req), req.params.id, req.body?.visibility));
  });

  app.post('/api/job-posting-engine/jobs/:id/distribute', ...guards, async (req: Request, res: Response) => {
    send(res, await distributeJob(pool, actorOf(req), req.params.id, req.body?.channels));
  });

  app.post('/api/job-posting-engine/jobs/:id/unpublish-channel', ...guards, async (req: Request, res: Response) => {
    send(res, await unpublishChannel(pool, actorOf(req), req.params.id, req.body?.channel));
  });

  // ── job_workflows: submit / approve|reject ─────────────────────────────────
  app.post('/api/job-posting-engine/jobs/:id/submit', ...guards, async (req: Request, res: Response) => {
    send(res, await submitForReview(pool, actorOf(req), req.params.id, req.body?.comments));
  });

  app.post('/api/job-posting-engine/jobs/:id/approve', ...guards, async (req: Request, res: Response) => {
    const { stage, decision, notes } = req.body ?? {};
    send(res, await decideStage(pool, actorOf(req), req.params.id, stage, decision ?? 'approve', notes));
  });
}
