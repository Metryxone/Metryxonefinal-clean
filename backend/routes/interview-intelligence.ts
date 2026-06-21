/**
 * PHASE 5.10 — Interview Intelligence (routes).
 *
 * Base: /api/interview-intelligence/*
 *   meta        GET   /_meta/status
 *   workflow    GET   /workflow                                       (interview FSM + vocab)
 *
 *   --- interview_engine: Scheduling + Decision Tracking ---
 *   schedule    POST  /job/:jobId/candidate/:candidateId/interviews  (WRITE)
 *   decision    POST  /job/:jobId/candidate/:candidateId/decisions   (WRITE — append-only)
 *   decisions   GET   /job/:jobId/candidate/:candidateId/decisions   (read-only)
 *   list        GET   /job/:jobId/interviews?status=&candidateId=     (read-only)
 *   summary     GET   /job/:jobId/summary                            (read-only)
 *   status      POST  /interview/:interviewId/status                 (WRITE — atomic)
 *
 *   --- interview_feedback_engine: Feedback + Panel Reviews ---
 *   feedbackP   POST  /interview/:interviewId/feedback               (WRITE — upsert)
 *   feedbackG   GET   /interview/:interviewId/feedback               (read-only)
 *   panel       GET   /interview/:interviewId/panel-review           (read-only)
 *   candFb      GET   /job/:jobId/candidate/:candidateId/feedback    (read-only)
 *
 *   --- evaluation_engine: Scoring + Evaluation ---
 *   scoreP      POST  /interview/:interviewId/scores                 (WRITE — upsert)
 *   scoreG      GET   /interview/:interviewId/scores                 (read-only)
 *   eval        GET   /interview/:interviewId/evaluation             (read-only)
 *   candEval    GET   /job/:jobId/candidate/:candidateId/evaluation  (read-only)
 *
 *   interview   GET   /interview/:interviewId                        (read-only; param-terminal)
 *
 * Contract:
 *   - Flag-gated: `interviewIntelligence` (FF_INTERVIEW_INTELLIGENCE). OFF => every route
 *     503 BEFORE any auth/DB/DDL touch (byte-identical legacy).
 *   - Super-admin gated (requireAuth -> requireSuperAdmin). IDOR-safe inside the engines
 *     (candidate strictly job-scoped; feedback/scores scoped to a valid interview).
 *   - GET = read-only (to_regclass probe + degrade, NEVER runs DDL). POST = the only write
 *     path; the engines ensure schema there.
 *   - Engines never throw; not-found => 404, conflict => 409, bad input => 400.
 *   - Literal / more-specific sub-paths registered BEFORE param-terminal routes.
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isInterviewIntelligenceEnabled } from '../config/feature-flags';
import {
  INTERVIEW_ENGINE_VERSION as ENGINE_VERSION,
  getInterviewWorkflow,
  scheduleInterview,
  updateInterviewStatus,
  recordDecision,
  getInterview,
  listInterviews,
  getDecisionHistory,
  interviewSummary,
  type EngineResult,
} from '../services/interview-engine';
import {
  submitFeedback,
  getInterviewFeedback,
  getCandidateFeedback,
  panelReview,
} from '../services/interview-feedback-engine';
import {
  recordScore,
  getScores,
  evaluationSummary,
  candidateEvaluation,
} from '../services/evaluation-engine';

type Mw = (req: any, res: any, next: any) => void;

function send(res: Response, result: EngineResult): void {
  if (result.ok) { res.json(result.data); return; }
  const status = result.code === 'not_found' ? 404 : result.code === 'conflict' ? 409 : 400;
  res.status(status).json({ error: result.message, code: result.code });
}

export function registerInterviewIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const gate: Mw = (_req, res, next) => {
    if (!isInterviewIntelligenceEnabled()) {
      return res.status(503).json({
        error: 'Interview Intelligence is not enabled',
        flag: 'interviewIntelligence',
        env: 'FF_INTERVIEW_INTELLIGENCE',
      });
    }
    next();
  };
  const guards = [gate, requireAuth, requireSuperAdmin];
  const base = '/api/interview-intelligence';

  // ── meta + workflow definition (literal — first) ───────────────────────────
  app.get(`${base}/_meta/status`, ...guards, (_req: Request, res: Response) => {
    res.json({ engine: 'interview-intelligence', version: ENGINE_VERSION, ok: true });
  });
  app.get(`${base}/workflow`, ...guards, (_req: Request, res: Response) => {
    res.json({ engine: 'interview-intelligence', version: ENGINE_VERSION, workflow: getInterviewWorkflow() });
  });

  // ── interview_engine: job-scoped reads + writes ────────────────────────────
  app.post(`${base}/job/:jobId/candidate/:candidateId/interviews`, ...guards, async (req: Request, res: Response) => {
    const b = req.body ?? {};
    send(res, await scheduleInterview(pool, {
      jobId: req.params.jobId,
      candidateId: req.params.candidateId,
      roundName: b.roundName ?? b.round_name ?? null,
      roundSeq: b.roundSeq ?? b.round_seq ?? null,
      mode: b.mode ?? null,
      scheduledAt: b.scheduledAt ?? b.scheduled_at ?? null,
      durationMins: b.durationMins ?? b.duration_mins ?? null,
      location: b.location ?? null,
      panelists: b.panelists ?? [],
      note: b.note ?? null,
      actor: b.actor ?? b.createdBy ?? b.created_by ?? null,
    }));
  });

  app.post(`${base}/job/:jobId/candidate/:candidateId/decisions`, ...guards, async (req: Request, res: Response) => {
    const b = req.body ?? {};
    send(res, await recordDecision(pool, {
      jobId: req.params.jobId,
      candidateId: req.params.candidateId,
      decision: b.decision,
      interviewId: b.interviewId ?? b.interview_id ?? null,
      stage: b.stage ?? null,
      rationale: b.rationale ?? null,
      actor: b.actor ?? b.decidedBy ?? b.decided_by ?? null,
    }));
  });
  app.get(`${base}/job/:jobId/candidate/:candidateId/decisions`, ...guards, async (req: Request, res: Response) => {
    send(res, await getDecisionHistory(pool, req.params.jobId, req.params.candidateId));
  });

  // ── feedback + evaluation candidate-level reads (literal sub-paths) ─────────
  app.get(`${base}/job/:jobId/candidate/:candidateId/feedback`, ...guards, async (req: Request, res: Response) => {
    send(res, await getCandidateFeedback(pool, req.params.jobId, req.params.candidateId));
  });
  app.get(`${base}/job/:jobId/candidate/:candidateId/evaluation`, ...guards, async (req: Request, res: Response) => {
    send(res, await candidateEvaluation(pool, req.params.jobId, req.params.candidateId));
  });

  app.get(`${base}/job/:jobId/interviews`, ...guards, async (req: Request, res: Response) => {
    send(res, await listInterviews(pool, req.params.jobId, {
      status: (req.query.status as string) ?? null,
      candidateId: (req.query.candidateId as string) ?? (req.query.candidate_id as string) ?? null,
    }));
  });
  app.get(`${base}/job/:jobId/summary`, ...guards, async (req: Request, res: Response) => {
    send(res, await interviewSummary(pool, req.params.jobId));
  });

  // ── interview-scoped writes + reads (literal sub-paths BEFORE param-terminal) ──
  app.post(`${base}/interview/:interviewId/status`, ...guards, async (req: Request, res: Response) => {
    const b = req.body ?? {};
    send(res, await updateInterviewStatus(pool, {
      interviewId: req.params.interviewId,
      status: b.status,
      note: b.note ?? null,
      actor: b.actor ?? b.updatedBy ?? b.updated_by ?? null,
    }));
  });

  app.post(`${base}/interview/:interviewId/feedback`, ...guards, async (req: Request, res: Response) => {
    const b = req.body ?? {};
    send(res, await submitFeedback(pool, {
      interviewId: req.params.interviewId,
      panelist: b.panelist,
      recommendation: b.recommendation ?? null,
      strengths: b.strengths ?? null,
      concerns: b.concerns ?? null,
      comments: b.comments ?? null,
      actor: b.actor ?? b.submittedBy ?? b.submitted_by ?? null,
    }));
  });
  app.get(`${base}/interview/:interviewId/feedback`, ...guards, async (req: Request, res: Response) => {
    send(res, await getInterviewFeedback(pool, req.params.interviewId));
  });
  app.get(`${base}/interview/:interviewId/panel-review`, ...guards, async (req: Request, res: Response) => {
    send(res, await panelReview(pool, req.params.interviewId));
  });

  app.post(`${base}/interview/:interviewId/scores`, ...guards, async (req: Request, res: Response) => {
    const b = req.body ?? {};
    send(res, await recordScore(pool, {
      interviewId: req.params.interviewId,
      panelist: b.panelist,
      criterion: b.criterion,
      score: b.score,
      maxScore: b.maxScore ?? b.max_score ?? null,
      comments: b.comments ?? null,
      actor: b.actor ?? b.scoredBy ?? b.scored_by ?? null,
    }));
  });
  app.get(`${base}/interview/:interviewId/scores`, ...guards, async (req: Request, res: Response) => {
    send(res, await getScores(pool, req.params.interviewId));
  });
  app.get(`${base}/interview/:interviewId/evaluation`, ...guards, async (req: Request, res: Response) => {
    send(res, await evaluationSummary(pool, req.params.interviewId));
  });

  // ── interview param-terminal (LAST) ────────────────────────────────────────
  app.get(`${base}/interview/:interviewId`, ...guards, async (req: Request, res: Response) => {
    send(res, await getInterview(pool, req.params.interviewId));
  });
}
