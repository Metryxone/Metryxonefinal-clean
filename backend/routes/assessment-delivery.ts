/**
 * CAPADEX 3.0 — Program 3 · Phase 3.4 Enterprise Assessment Delivery Engine routes.
 *
 * A read-only certification composer over the ONE canonical Assessment Delivery model + the
 * reuse-before-build engineering-closure mechanisms. SEVEN INDEPENDENT dimensions certified SEPARATELY:
 *   delivery_engine · candidate_experience · session_management · accessibility · security · apis · frontend.
 * Scope is CANDIDATE EXPERIENCE ONLY — launch→submission. NOT scoring/psychometrics/reports (Phase 3.5+).
 *
 * READ (certification):
 *   - GET /api/assessment-delivery/enabled                     flag probe (503 when OFF)
 *   - GET /api/admin/assessment-delivery/model                 canonical registry
 *   - GET /api/admin/assessment-delivery/dimensions            the 7 dimensions, evidence VERIFIED vs live FS+DB
 *   - GET /api/admin/assessment-delivery/candidate-experience  candidate-journey catalog
 *   - GET /api/admin/assessment-delivery/delivery-modes        delivery-mode catalog
 *   - GET /api/admin/assessment-delivery/question-delivery     question-delivery catalog
 *   - GET /api/admin/assessment-delivery/launch                launch modes
 *   - GET /api/admin/assessment-delivery/session               session capabilities
 *   - GET /api/admin/assessment-delivery/timing                timing capabilities
 *   - GET /api/admin/assessment-delivery/response              response capabilities
 *   - GET /api/admin/assessment-delivery/accessibility         accessibility capabilities
 *   - GET /api/admin/assessment-delivery/security              security controls
 *   - GET /api/admin/assessment-delivery/notifications         notification types
 *   - GET /api/admin/assessment-delivery/mapping               10-dimension mapping model
 *   - GET /api/admin/assessment-delivery/repository-alignment  evidence rollup vs live FS+DB
 *   - GET /api/admin/assessment-delivery/adoption              SEPARATE usage axis (never a gap)
 *   - GET /api/admin/assessment-delivery/gaps                  OPEN + RESOLVED gaps
 *   - GET /api/admin/assessment-delivery/summary               7 dimensions reported SEPARATELY + verdict + 3.5 readiness
 *
 * MECHANISMS (reuse-before-build; the ONLY DDL sites — run behind flag + super-admin → OFF creates 0 tables):
 *   launches/{upsert,list,:key} · sessions/{start,transition,list} · responses/{save,:key} ·
 *   events/{record,:key} · notifications/{record,:key}.
 *
 * Strictly additive + reversible + flag-gated (`assessmentDelivery`, FF_ASSESSMENT_DELIVERY, default OFF):
 * OFF → every route 503 (503-before-auth) → byte-identical legacy incl. schema (no table touched).
 * Never throws: unexpected errors degrade to a 200 honest-degraded JSON. Coverage⟂Confidence⟂Adoption; null≠0.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  AD_AXES, AD_DIMENSIONS, CANDIDATE_EXPERIENCE_STEPS, DELIVERY_MODES, QUESTION_DELIVERY_MODES,
  LAUNCH_MODES, SESSION_CAPABILITIES, TIMING_CAPS, RESPONSE_CAPS, ACCESSIBILITY_CAPS,
  SECURITY_CONTROLS, NOTIFICATION_TYPES, MAPPING_MODEL, AD_DECISIONS,
} from '../config/assessment-delivery';
import {
  composeDimensions, composeCandidateExperience, composeDeliveryModes, composeQuestionDelivery,
  composeLaunchModes, composeSessionCaps, composeTimingCaps, composeResponseCaps, composeAccessibilityCaps,
  composeSecurityControls, composeNotificationTypes, composeMapping, composeRepositoryAlignment,
  composeAdoption, classifiedGaps, composeSummary,
} from '../services/assessment-delivery-engine';
import {
  upsertLaunch, listLaunches, getLaunch,
  startSession, transitionSession, listSessions,
  saveResponse, listResponses,
  recordEvent, listEvents,
  recordNotification, listNotifications,
} from '../services/assessment-delivery-mechanisms';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('assessmentDelivery')) {
    return res.status(503).json({ ok: false, error: 'assessment_delivery_disabled' });
  }
  next();
}

function degraded(res: Response, tag: string, err: unknown) {
  console.error(`[assessment-delivery] ${tag} error:`, err);
  res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
}

function actorOf(req: Request): string | undefined {
  const u = (req as unknown as { user?: { email?: string; username?: string } }).user;
  return u?.email || u?.username || undefined;
}

export function registerAssessmentDeliveryRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const g = [flagGate, requireAuth, requireSuperAdmin];

  // Flag probe (flag STATE is not sensitive). 503 when OFF; res.ok=true only when ON.
  app.get('/api/assessment-delivery/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  // Canonical model (static registry — no DB read).
  app.get('/api/admin/assessment-delivery/model', ...g, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true, platform_frozen: true,
        axes: AD_AXES, dimensions: AD_DIMENSIONS,
        candidate_experience_steps: CANDIDATE_EXPERIENCE_STEPS, delivery_modes: DELIVERY_MODES,
        question_delivery_modes: QUESTION_DELIVERY_MODES, launch_modes: LAUNCH_MODES,
        session_capabilities: SESSION_CAPABILITIES, timing_caps: TIMING_CAPS, response_caps: RESPONSE_CAPS,
        accessibility_caps: ACCESSIBILITY_CAPS, security_controls: SECURITY_CONTROLS,
        notification_types: NOTIFICATION_TYPES, mapping_model: MAPPING_MODEL, decisions: AD_DECISIONS,
      });
    } catch (err) { degraded(res, 'model', err); }
  });

  app.get('/api/admin/assessment-delivery/dimensions', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, dimensions: await composeDimensions(pool) }); }
    catch (err) { degraded(res, 'dimensions', err); }
  });

  app.get('/api/admin/assessment-delivery/candidate-experience', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, candidate_experience: composeCandidateExperience() }); }
    catch (err) { degraded(res, 'candidate-experience', err); }
  });

  app.get('/api/admin/assessment-delivery/delivery-modes', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, delivery_modes: composeDeliveryModes() }); }
    catch (err) { degraded(res, 'delivery-modes', err); }
  });

  app.get('/api/admin/assessment-delivery/question-delivery', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, question_delivery: composeQuestionDelivery() }); }
    catch (err) { degraded(res, 'question-delivery', err); }
  });

  app.get('/api/admin/assessment-delivery/launch', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, launch: await composeLaunchModes(pool) }); }
    catch (err) { degraded(res, 'launch', err); }
  });

  app.get('/api/admin/assessment-delivery/session', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, session: await composeSessionCaps(pool) }); }
    catch (err) { degraded(res, 'session', err); }
  });

  app.get('/api/admin/assessment-delivery/timing', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, timing: await composeTimingCaps(pool) }); }
    catch (err) { degraded(res, 'timing', err); }
  });

  app.get('/api/admin/assessment-delivery/response', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, response: await composeResponseCaps(pool) }); }
    catch (err) { degraded(res, 'response', err); }
  });

  app.get('/api/admin/assessment-delivery/accessibility', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, accessibility: await composeAccessibilityCaps(pool) }); }
    catch (err) { degraded(res, 'accessibility', err); }
  });

  app.get('/api/admin/assessment-delivery/security', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, security: await composeSecurityControls(pool) }); }
    catch (err) { degraded(res, 'security', err); }
  });

  app.get('/api/admin/assessment-delivery/notifications', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, notifications: await composeNotificationTypes(pool) }); }
    catch (err) { degraded(res, 'notifications', err); }
  });

  app.get('/api/admin/assessment-delivery/mapping', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, mapping: await composeMapping(pool) }); }
    catch (err) { degraded(res, 'mapping', err); }
  });

  app.get('/api/admin/assessment-delivery/repository-alignment', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, repository_alignment: await composeRepositoryAlignment(pool) }); }
    catch (err) { degraded(res, 'repository-alignment', err); }
  });

  app.get('/api/admin/assessment-delivery/adoption', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, adoption: await composeAdoption(pool) }); }
    catch (err) { degraded(res, 'adoption', err); }
  });

  app.get('/api/admin/assessment-delivery/gaps', ...g, async (_req: Request, res: Response) => {
    try {
      const { gaps, gap_counts, resolved_gaps, resolved_gap_counts, resolved_gap_count } = classifiedGaps();
      res.json({ ok: true, gaps, gap_counts, gap_total: gaps.length, resolved_gaps, resolved_gap_counts, resolved_gap_count });
    } catch (err) { degraded(res, 'gaps', err); }
  });

  app.get('/api/admin/assessment-delivery/summary', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, summary: await composeSummary(pool) }); }
    catch (err) { degraded(res, 'summary', err); }
  });

  // ── MECHANISMS — reuse-before-build. The ONLY DDL sites (behind flag + super-admin). ──

  // Launches
  app.post('/api/admin/assessment-delivery/launches/upsert', ...g, async (req: Request, res: Response) => {
    try {
      const launch_key = String(req.body?.launch_key || '').trim();
      const assessment_slug = String(req.body?.assessment_slug || '').trim();
      if (!launch_key || !assessment_slug) return res.status(400).json({ ok: false, error: 'launch_key_and_assessment_slug_required' });
      res.json({ ok: true, result: await upsertLaunch(pool, { ...req.body, launch_key, assessment_slug, owner: req.body?.owner ?? actorOf(req) }) });
    } catch (err) { degraded(res, 'launches-upsert', err); }
  });

  app.get('/api/admin/assessment-delivery/launches', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, launches: await listLaunches(pool) }); }
    catch (err) { degraded(res, 'launches-list', err); }
  });

  app.get('/api/admin/assessment-delivery/launches/:key', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, launch: await getLaunch(pool, String(req.params.key)) }); }
    catch (err) { degraded(res, 'launch-get', err); }
  });

  // Sessions — literal /start,/transition BEFORE the /:key param route.
  app.post('/api/admin/assessment-delivery/sessions/start', ...g, async (req: Request, res: Response) => {
    try {
      const session_key = String(req.body?.session_key || '').trim();
      if (!session_key) return res.status(400).json({ ok: false, error: 'session_key_required' });
      res.json({ ok: true, result: await startSession(pool, { ...req.body, session_key }) });
    } catch (err) { degraded(res, 'sessions-start', err); }
  });

  app.post('/api/admin/assessment-delivery/sessions/transition', ...g, async (req: Request, res: Response) => {
    try {
      const session_key = String(req.body?.session_key || '').trim();
      const status = String(req.body?.status || '').trim();
      if (!session_key || !status) return res.status(400).json({ ok: false, error: 'session_key_and_status_required' });
      res.json({ ok: true, result: await transitionSession(pool, session_key, status, req.body?.state) });
    } catch (err) { degraded(res, 'sessions-transition', err); }
  });

  app.get('/api/admin/assessment-delivery/sessions', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, sessions: await listSessions(pool, req.query.launch_key ? String(req.query.launch_key) : undefined) }); }
    catch (err) { degraded(res, 'sessions-list', err); }
  });

  // Responses — literal /save BEFORE the /:key param route.
  app.post('/api/admin/assessment-delivery/responses/save', ...g, async (req: Request, res: Response) => {
    try {
      const session_key = String(req.body?.session_key || '').trim();
      const question_ref = String(req.body?.question_ref || '').trim();
      if (!session_key || !question_ref) return res.status(400).json({ ok: false, error: 'session_key_and_question_ref_required' });
      res.json({ ok: true, result: await saveResponse(pool, { ...req.body, session_key, question_ref }) });
    } catch (err) { degraded(res, 'responses-save', err); }
  });

  app.get('/api/admin/assessment-delivery/responses/:key', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, responses: await listResponses(pool, String(req.params.key)) }); }
    catch (err) { degraded(res, 'responses-list', err); }
  });

  // Events — literal /record BEFORE the /:key param route.
  app.post('/api/admin/assessment-delivery/events/record', ...g, async (req: Request, res: Response) => {
    try {
      const event_type = String(req.body?.event_type || '').trim();
      if (!event_type) return res.status(400).json({ ok: false, error: 'event_type_required' });
      res.json({ ok: true, result: await recordEvent(pool, { ...req.body, event_type }) });
    } catch (err) { degraded(res, 'events-record', err); }
  });

  app.get('/api/admin/assessment-delivery/events/:key', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, events: await listEvents(pool, String(req.params.key)) }); }
    catch (err) { degraded(res, 'events-list', err); }
  });

  // Notifications — literal /record BEFORE the /:key param route.
  app.post('/api/admin/assessment-delivery/notifications/record', ...g, async (req: Request, res: Response) => {
    try {
      const notif_type = String(req.body?.notif_type || '').trim();
      if (!notif_type) return res.status(400).json({ ok: false, error: 'notif_type_required' });
      res.json({ ok: true, result: await recordNotification(pool, { ...req.body, notif_type }) });
    } catch (err) { degraded(res, 'notifications-record', err); }
  });

  app.get('/api/admin/assessment-delivery/notifications/:key', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, notifications: await listNotifications(pool, String(req.params.key)) }); }
    catch (err) { degraded(res, 'notifications-history', err); }
  });
}
