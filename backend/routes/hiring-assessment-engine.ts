/**
 * PHASE 5.7 — Assessment-Led Hiring (routes).
 *
 * Base: /api/hiring-assessment-engine/*
 *   Invitations  POST   /invites
 *   read         GET    /invites/by-token/:token       (literal — before /:inviteId)
 *   read         GET    /invites/:inviteId
 *   Completion   POST   /invites/:inviteId/complete
 *   list         GET    /job/:jobId/invites
 *   Validation   GET    /job/:jobId/candidate/:candidateId/validate
 *   Scoring      GET    /job/:jobId/candidate/:candidateId/score
 *   Comparison   GET    /job/:jobId/compare?candidates=a,b,c
 *   Ranking      GET    /job/:jobId/ranking[?limit=]
 *   snapshot     POST   /job/:jobId/ranking/snapshot     (literal — before /:jobId catch-alls)
 *   snapshots    GET    /job/:jobId/ranking/snapshots[?runId=]
 *
 * Contract:
 *   - Flag-gated: `hiringAssessment` (FF_HIRING_ASSESSMENT). OFF => every route 503
 *     BEFORE any auth/DB/DDL touch (byte-identical legacy).
 *   - Super-admin gated (requireAuth -> requireSuperAdmin). IDOR-safe: no
 *     client-supplied identity is trusted as the principal.
 *   - GET = read-only (to_regclass probe + degrade, NEVER runs DDL). POST = the
 *     only write path; the engine ensures schema there.
 *   - Engine never throws; not-found => 404, conflict => 409, bad input => 400.
 *   - Literal / more-specific sub-paths registered BEFORE param routes.
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isHiringAssessmentEnabled } from '../config/feature-flags';
import {
  HIRING_ASSESSMENT_ENGINE_VERSION as ENGINE_VERSION,
  createAssessmentInvite,
  recordAssessmentCompletion,
  getInvite,
  getInviteByToken,
  listInvitesForJob,
  validateAssessment,
  scoreAssessment,
  compareAssessments,
  rankCandidates,
  snapshotRanking,
  listRankingSnapshots,
  type EngineResult,
} from '../services/hiring-assessment-engine';

type Mw = (req: any, res: any, next: any) => void;

function send(res: Response, result: EngineResult): void {
  if (result.ok) { res.json(result.data); return; }
  const status = result.code === 'not_found' ? 404 : result.code === 'conflict' ? 409 : 400;
  res.status(status).json({ error: result.message, code: result.code });
}

export function registerHiringAssessmentEngineRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const gate: Mw = (_req, res, next) => {
    if (!isHiringAssessmentEnabled()) {
      return res.status(503).json({
        error: 'Assessment-Led Hiring engine is not enabled',
        flag: 'hiringAssessment',
        env: 'FF_HIRING_ASSESSMENT',
      });
    }
    next();
  };
  const guards = [gate, requireAuth, requireSuperAdmin];
  const base = '/api/hiring-assessment-engine';

  // ── meta (literal — first) ─────────────────────────────────────────────────
  app.get(`${base}/_meta/status`, ...guards, (_req: Request, res: Response) => {
    res.json({ engine: 'hiring-assessment-engine', version: ENGINE_VERSION, ok: true });
  });

  // ── Invitations (WRITE) ────────────────────────────────────────────────────
  app.post(`${base}/invites`, ...guards, async (req: Request, res: Response) => {
    const b = req.body ?? {};
    send(res, await createAssessmentInvite(pool, {
      jobId: b.jobId ?? b.job_id,
      candidateId: b.candidateId ?? b.candidate_id,
      assessmentId: b.assessmentId ?? b.assessment_id ?? null,
      candidateEmail: b.candidateEmail ?? b.candidate_email ?? null,
      expiresInDays: b.expiresInDays ?? b.expires_in_days ?? null,
    }));
  });

  // ── invite reads (literal 'by-token' BEFORE /:inviteId) ────────────────────
  app.get(`${base}/invites/by-token/:token`, ...guards, async (req: Request, res: Response) => {
    send(res, await getInviteByToken(pool, req.params.token));
  });
  app.get(`${base}/invites/:inviteId`, ...guards, async (req: Request, res: Response) => {
    send(res, await getInvite(pool, req.params.inviteId));
  });

  // ── Completion (WRITE) ─────────────────────────────────────────────────────
  app.post(`${base}/invites/:inviteId/complete`, ...guards, async (req: Request, res: Response) => {
    const b = req.body ?? {};
    send(res, await recordAssessmentCompletion(pool, req.params.inviteId, {
      scoreRunId: b.scoreRunId ?? b.score_run_id ?? null,
      capadexSessionId: b.capadexSessionId ?? b.capadex_session_id ?? null,
    }));
  });

  // ── list invites for a job ─────────────────────────────────────────────────
  app.get(`${base}/job/:jobId/invites`, ...guards, async (req: Request, res: Response) => {
    send(res, await listInvitesForJob(pool, req.params.jobId));
  });

  // ── Validation (read-only) ─────────────────────────────────────────────────
  app.get(`${base}/job/:jobId/candidate/:candidateId/validate`, ...guards, async (req: Request, res: Response) => {
    send(res, await validateAssessment(pool, req.params.jobId, req.params.candidateId));
  });

  // ── Scoring (read-only) ────────────────────────────────────────────────────
  app.get(`${base}/job/:jobId/candidate/:candidateId/score`, ...guards, async (req: Request, res: Response) => {
    send(res, await scoreAssessment(pool, req.params.jobId, req.params.candidateId));
  });

  // ── Comparison (read-only) ─────────────────────────────────────────────────
  app.get(`${base}/job/:jobId/compare`, ...guards, async (req: Request, res: Response) => {
    const raw = req.query.candidates;
    const ids = String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    send(res, await compareAssessments(pool, req.params.jobId, ids));
  });

  // ── Ranking snapshot (WRITE — literal 'snapshot' before /ranking read) ─────
  app.post(`${base}/job/:jobId/ranking/snapshot`, ...guards, async (req: Request, res: Response) => {
    const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
    send(res, await snapshotRanking(pool, req.params.jobId, { limit }));
  });

  // ── persisted ranking snapshots (read-only) ────────────────────────────────
  app.get(`${base}/job/:jobId/ranking/snapshots`, ...guards, async (req: Request, res: Response) => {
    const runId = req.query.runId != null ? String(req.query.runId) : undefined;
    send(res, await listRankingSnapshots(pool, req.params.jobId, { runId }));
  });

  // ── Ranking (read-only — registered after the more-specific /ranking/* paths)
  app.get(`${base}/job/:jobId/ranking`, ...guards, async (req: Request, res: Response) => {
    const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
    send(res, await rankCandidates(pool, req.params.jobId, { limit }));
  });
}
