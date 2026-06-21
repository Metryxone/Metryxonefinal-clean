/**
 * PHASE 5.14 — Notifications & Workflows (routes).
 *
 * Base: /api/notifications/*  (ALL GET — pure read/compose layer; no POST, no DDL, SENDS NOTHING)
 *   meta          GET /_meta/status
 *   config        GET /config                                       (thresholds, audiences, disclaimer)
 *   catalog       GET /catalog                                      (alert-type + severity catalog)
 *   notifications GET /employer/:employerId/notifications           (notification_engine — alert feed)
 *   workflows     GET /employer/:employerId/workflows               (workflow_notifications)
 *   communications GET /employer/:employerId/communications         (communication_engine — previews)
 *   overview      GET /employer/:employerId/overview                (all three — ONE evidence load)
 *
 * Contract:
 *   - Flag-gated: `notificationEngine` (FF_NOTIFICATION_ENGINE). OFF => every route 503 BEFORE any
 *     auth/DB touch (byte-identical legacy).
 *   - Super-admin gated (requireAuth -> requireSuperAdmin). IDOR-safe inside the engines (every read
 *     strictly scoped by employer_id; cross-employer rows never leak).
 *   - PURE READ: composes already-recorded operator evidence + the Phase 5.13/5.12 engines; runs NO
 *     DDL, writes NO rows, and SENDS NOTHING. Engines never throw; not-found => 404, bad input => 400.
 *   - Literal / more-specific sub-paths registered BEFORE param routes.
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isNotificationEngineEnabled } from '../config/feature-flags';
import type { EngineResult } from '../services/workforce-intelligence-shared';
import {
  NOTIFICATION_ENGINE_VERSION, NOTIFICATION_DISCLAIMER, PROVENANCE,
  ALERT_TYPES, THRESHOLDS, STAGE_NEXT_ACTION, SEVERITY_RANK,
} from '../services/notification-engine-shared';
import {
  computeNotifications, computeWorkflowNotifications, computeCommunications, computeNotificationOverview,
} from '../services/notification-engine';

type Mw = (req: any, res: any, next: any) => void;

function send(res: Response, result: EngineResult): void {
  if (result.ok) { res.json(result.data); return; }
  const status = result.code === 'not_found' ? 404 : result.code === 'conflict' ? 409 : 400;
  res.status(status).json({ error: result.message, code: result.code });
}

export function registerNotificationRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const gate: Mw = (_req, res, next) => {
    if (!isNotificationEngineEnabled()) {
      return res.status(503).json({
        error: 'Notifications & Workflows is not enabled',
        flag: 'notificationEngine',
        env: 'FF_NOTIFICATION_ENGINE',
      });
    }
    next();
  };
  const guards = [gate, requireAuth, requireSuperAdmin];
  const base = '/api/notifications';

  // ── meta + config + catalog (literal — first) ──────────────────────────────
  app.get(`${base}/_meta/status`, ...guards, (_req: Request, res: Response) => {
    res.json({ engine: 'notifications', version: NOTIFICATION_ENGINE_VERSION, ok: true });
  });
  app.get(`${base}/config`, ...guards, (_req: Request, res: Response) => {
    res.json({
      engine: 'notifications',
      version: NOTIFICATION_ENGINE_VERSION,
      deliverables: {
        notification_engine: 'GET /employer/:employerId/notifications — derived alert feed (7 types)',
        workflow_notifications: 'GET /employer/:employerId/workflows — active-stage next-action + stalled',
        communication_engine: 'GET /employer/:employerId/communications — message previews (never sent)',
      },
      thresholds_days: THRESHOLDS,
      stage_next_action: STAGE_NEXT_ACTION,
      audiences: ['employer', 'recruiter'],
      delivery: 'none (read-only; this engine sends no email/SMS/push and writes nothing)',
      composes: 'Phase 5.13 dashboard evidence (→ 5.12 workforce evidence) + a scoped candidate/job timestamp read, over a single evidence load',
      provenance: PROVENANCE,
      disclaimer: NOTIFICATION_DISCLAIMER,
    });
  });
  app.get(`${base}/catalog`, ...guards, (_req: Request, res: Response) => {
    res.json({
      engine: 'notifications',
      version: NOTIFICATION_ENGINE_VERSION,
      alert_types: ALERT_TYPES,
      severities: Object.keys(SEVERITY_RANK),
      categories: {
        job_alert: ['job.no_applicants', 'job.newly_posted'],
        application_alert: ['application.new', 'application.awaiting_screening'],
        interview_alert: ['interview.upcoming', 'interview.outcome_overdue'],
        offer_alert: ['offer.pending'],
        employer_alert: ['employer.jobs_without_applicants', 'employer.unbound_candidates', 'employer.open_jobs_summary'],
        recruiter_alert: ['recruiter.stalled_candidates', 'recruiter.offers_pending', 'recruiter.interviews_upcoming'],
        status_change: ['status.decision_recorded', 'status.recently_updated'],
      },
      provenance: PROVENANCE,
      disclaimer: NOTIFICATION_DISCLAIMER,
    });
  });

  // ── per-employer notification views (read-only; param routes — last) ───────
  app.get(`${base}/employer/:employerId/notifications`, ...guards, async (req: Request, res: Response) => {
    send(res, await computeNotifications(pool, req.params.employerId));
  });
  app.get(`${base}/employer/:employerId/workflows`, ...guards, async (req: Request, res: Response) => {
    send(res, await computeWorkflowNotifications(pool, req.params.employerId));
  });
  app.get(`${base}/employer/:employerId/communications`, ...guards, async (req: Request, res: Response) => {
    send(res, await computeCommunications(pool, req.params.employerId));
  });
  app.get(`${base}/employer/:employerId/overview`, ...guards, async (req: Request, res: Response) => {
    send(res, await computeNotificationOverview(pool, req.params.employerId));
  });
}
