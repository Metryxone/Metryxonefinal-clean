/**
 * Task #293 — Journey Tail Completion (routes).
 *
 * BASE /api/journey-tail/* — persona-facing (parent / mentor-coach / teacher-counsellor), NOT a super-admin
 * surface, so handlers use requireAuth (+ a role check on the counsellor follow-up queue) rather than
 * requireSuperAdmin. Strictly additive + reversible + flag-gated (`journeyTailCompletion`, default OFF):
 *   - OFF → every route 503 BEFORE auth/DDL (flagGate first); the lazy ensure-schema is never reached, so no
 *     jt_* table is created → byte-identical legacy incl. schema. OFF smoke ∈ {503} (and the global gate
 *     leaves {401,403} honest too if auth ran first elsewhere).
 *   - `/enabled` is an ungated-by-auth probe (flagGate only) so the SPA hides the new surfaces byte-identically.
 *   - GET handlers are read-only (to_regclass PROBE, never DDL). Writes delegate to service fns that re-assert
 *     the flag before ensure-schema.
 *   - Authorization is enforced HERE (req.user available): parents act only on OWNED children; mentors/seekers
 *     act only on their own relationship; the follow-up queue is staff-role gated. The service stays pure data.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  JOURNEY_TAIL_VERSION,
  JT_PARENT_ACTION_TYPES,
  JT_PARENT_ACTION_STATUS,
  JT_MENTOR_ENGAGEMENT_KINDS,
  JT_OBSERVER_TYPES,
  JT_FOLLOWUP_STATUS,
  recordParentSupportAction,
  updateParentSupportActionStatus,
  listParentSupportActions,
  recordMentorEngagement,
  listMentorEngagements,
  recordStakeholderObservation,
  updateObservationFollowupStatus,
  listObservationsForParent,
  listFollowUpQueue,
  composeJourneyTailOverview,
} from '../services/journey-tail-engine';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('journeyTailCompletion')) {
    return res.status(503).json({ ok: false, error: 'journey_tail_completion_disabled' });
  }
  next();
}

const actorId = (req: Request): string => String((req.user as any)?.id ?? '');
const actorEmail = (req: Request): string | null => {
  const e = (req.user as any)?.email;
  return e ? String(e) : null;
};
const actorRoles = (req: Request): string[] => {
  const u = req.user as any;
  const roles: string[] = [];
  if (u?.role) roles.push(String(u.role));
  if (Array.isArray(u?.roles)) for (const r of u.roles) if (r) roles.push(String(r));
  return roles.map((r) => r.toLowerCase());
};
const STAFF_ROLES = new Set(['counsellor', 'counselor', 'school_admin', 'institute_admin', 'institute_staff', 'teacher', 'admin', 'super_admin']);
export const isStaff = (req: Request): boolean => actorRoles(req).some((r) => STAFF_ROLES.has(r));

const s = (v: unknown, max = 4000): string => (v == null ? '' : String(v)).slice(0, max).trim();

// ── Ownership / association helpers (read the LIVE substrate; never write) ─────────────────────────────
async function ownedChildIds(pool: Pool, parentId: string): Promise<string[]> {
  try {
    const r = await pool.query(`SELECT id FROM children WHERE parent_id = $1`, [parentId]);
    return r.rows.map((x: any) => String(x.id));
  } catch {
    return [];
  }
}
async function childOwnedBy(pool: Pool, childId: string, parentId: string): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT 1 FROM children WHERE id = $1 AND parent_id = $2`, [childId, parentId]);
    return (r.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}
async function actorMentorProfileId(pool: Pool, userId: string): Promise<string | null> {
  try {
    const r = await pool.query(`SELECT id FROM mentor_profiles WHERE user_id = $1 LIMIT 1`, [userId]);
    return r.rowCount ? String(r.rows[0].id) : null;
  } catch {
    return null;
  }
}
/** A seeker may engage a mentor ONLY after a real post-match relationship exists (mentor_bookings). */
export async function seekerHasBooking(pool: Pool, seekerId: string, mentorProfileId: string): Promise<boolean> {
  try {
    const r = await pool.query(
      `SELECT 1 FROM mentor_bookings WHERE seeker_id = $1 AND mentor_profile_id = $2 LIMIT 1`,
      [seekerId, mentorProfileId],
    );
    return (r.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

export function registerJourneyTailRoutes(app: Express, pool: Pool, requireAuth: Mw): void {
  // ── Probes ──────────────────────────────────────────────────────────────────────────────────────────
  app.get('/api/journey-tail/enabled', flagGate, (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });
  app.get('/api/journey-tail/feature-flag', flagGate, requireAuth, (_req: Request, res: Response) => {
    res.json({ ok: true, flag: 'journeyTailCompletion', enabled: isFlagEnabled('journeyTailCompletion'), version: JOURNEY_TAIL_VERSION });
  });
  app.get('/api/journey-tail/catalog', flagGate, requireAuth, (_req: Request, res: Response) => {
    res.json({
      ok: true, version: JOURNEY_TAIL_VERSION, read_only: true,
      parent_action_types: JT_PARENT_ACTION_TYPES,
      parent_action_status: JT_PARENT_ACTION_STATUS,
      mentor_engagement_kinds: JT_MENTOR_ENGAGEMENT_KINDS,
      observer_types: JT_OBSERVER_TYPES,
      follow_up_status: JT_FOLLOWUP_STATUS,
    });
  });
  app.get('/api/journey-tail/overview', flagGate, requireAuth, async (_req: Request, res: Response) => {
    try { res.json(await composeJourneyTailOverview(pool)); }
    catch (err) { console.error('[journey-tail] overview error:', err); res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true }); }
  });

  // ── 1) Parent support-action loop ───────────────────────────────────────────────────────────────────
  app.get('/api/journey-tail/parent/support-actions', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const childId = s(req.query.childId, 64) || null;
      if (childId && !(await childOwnedBy(pool, childId, actorId(req)))) {
        return res.status(403).json({ ok: false, error: 'not_your_child' });
      }
      res.json(await listParentSupportActions(pool, actorId(req), childId));
    } catch (err) { console.error('[journey-tail] parent actions read:', err); res.status(200).json({ ok: true, actions: [], available: false }); }
  });

  app.post('/api/journey-tail/parent/support-actions', flagGate, requireAuth, async (req: Request, res: Response) => {
    const b = (req.body ?? {}) as Record<string, any>;
    const childId = s(b.child_id, 64);
    if (!childId) return res.status(400).json({ ok: false, error: 'child_id_required' });
    if (!(await childOwnedBy(pool, childId, actorId(req)))) return res.status(403).json({ ok: false, error: 'not_your_child' });
    const r = await recordParentSupportAction(pool, {
      parentId: actorId(req), parentEmail: actorEmail(req), childId,
      actionType: s(b.action_type), title: b.title ?? null, note: b.note ?? null,
      sourceContext: b.source_context ?? null, linkedObservationId: b.linked_observation_id ?? null,
    });
    if (!r.ok) return res.status(r.reason === 'flag_off' ? 503 : 400).json({ ok: false, error: r.reason });
    res.json({ ok: true, id: r.id });
  });

  app.patch('/api/journey-tail/parent/support-actions/:id', flagGate, requireAuth, async (req: Request, res: Response) => {
    const r = await updateParentSupportActionStatus(pool, {
      parentId: actorId(req), actionId: s(req.params.id, 64), status: s((req.body ?? {}).status),
    });
    if (!r.ok) return res.status(r.reason === 'flag_off' ? 503 : 400).json({ ok: false, error: r.reason });
    res.json({ ok: true, updated: r.updated });
  });

  // Parent view of observations shared with them (Teacher/Counsellor → Parent continuation).
  app.get('/api/journey-tail/parent/observations', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const ids = await ownedChildIds(pool, actorId(req));
      res.json(await listObservationsForParent(pool, ids));
    } catch (err) { console.error('[journey-tail] parent observations read:', err); res.status(200).json({ ok: true, observations: [], available: false }); }
  });

  // Parent acknowledges / marks-actioned a shared observation (effect surfaced back).
  app.post('/api/journey-tail/parent/observations/:id/status', flagGate, requireAuth, async (req: Request, res: Response) => {
    const status = s((req.body ?? {}).status);
    if (!['acknowledged', 'actioned'].includes(status)) {
      return res.status(400).json({ ok: false, error: 'invalid_parent_status' });
    }
    const ids = await ownedChildIds(pool, actorId(req));
    const r = await updateObservationFollowupStatus(pool, { observationId: s(req.params.id, 64), status, childIds: ids });
    if (!r.ok) return res.status(r.reason === 'flag_off' ? 503 : 400).json({ ok: false, error: r.reason });
    if (!r.updated) return res.status(404).json({ ok: false, error: 'observation_not_found_or_not_shared' });
    res.json({ ok: true, updated: true });
  });

  // ── 2) Mentor/Coach engagement tail ─────────────────────────────────────────────────────────────────
  app.get('/api/journey-tail/mentor/engagements', flagGate, requireAuth, async (req: Request, res: Response) => {
    try {
      const seekerId = s(req.query.seekerId, 64) || null;
      const mentorProfileId = s(req.query.mentorProfileId, 64) || null;
      const myMentorProfile = await actorMentorProfileId(pool, actorId(req));
      // A seeker reads their OWN engagements (visible-only); a mentor reads their OWN profile's engagements.
      if (seekerId && seekerId === actorId(req)) {
        return res.json(await listMentorEngagements(pool, { seekerId, visibleOnly: true }));
      }
      if (mentorProfileId && myMentorProfile && mentorProfileId === myMentorProfile) {
        return res.json(await listMentorEngagements(pool, { mentorProfileId }));
      }
      if (!seekerId && !mentorProfileId && myMentorProfile) {
        return res.json(await listMentorEngagements(pool, { mentorProfileId: myMentorProfile }));
      }
      if (!seekerId && !mentorProfileId) {
        return res.json(await listMentorEngagements(pool, { seekerId: actorId(req), visibleOnly: true }));
      }
      return res.status(403).json({ ok: false, error: 'not_a_participant' });
    } catch (err) { console.error('[journey-tail] mentor engagements read:', err); res.status(200).json({ ok: true, engagements: [], available: false }); }
  });

  app.post('/api/journey-tail/mentor/engagements', flagGate, requireAuth, async (req: Request, res: Response) => {
    const b = (req.body ?? {}) as Record<string, any>;
    const mentorProfileId = s(b.mentor_profile_id, 64);
    if (!mentorProfileId) return res.status(400).json({ ok: false, error: 'mentor_profile_id_required' });
    const myMentorProfile = await actorMentorProfileId(pool, actorId(req));
    const isMentor = !!myMentorProfile && myMentorProfile === mentorProfileId;
    // A mentor may post against a named mentee; any other authed caller posts as the seeker
    // (themselves) — they can never impersonate another seeker, so seeker_id is forced to the actor.
    const seekerId = isMentor ? (s(b.seeker_id, 64) || null) : actorId(req);
    const isSeeker = !isMentor && seekerId === actorId(req);
    if (!isMentor && !isSeeker) return res.status(403).json({ ok: false, error: 'not_a_participant' });
    // Participant integrity (both directions): an engagement is the tail of a real MATCH, not a cold
    // message. A seeker may only post against a mentor they actually booked; a mentor may only post
    // against a seeker who actually booked them. Either way the (mentor_profile_id, seeker_id) pair
    // must exist in mentor_bookings. (Mentor self-notes with no seeker_id are allowed.)
    if (isSeeker && !(await seekerHasBooking(pool, actorId(req), mentorProfileId))) {
      return res.status(403).json({ ok: false, error: 'no_mentor_booking' });
    }
    if (isMentor && seekerId && !(await seekerHasBooking(pool, seekerId, mentorProfileId))) {
      return res.status(403).json({ ok: false, error: 'not_a_participant' });
    }
    const r = await recordMentorEngagement(pool, {
      mentorProfileId, seekerId, bookingRef: b.booking_ref ?? null,
      authorId: actorId(req), authorRole: isMentor ? 'mentor' : 'seeker', authorEmail: actorEmail(req),
      kind: s(b.kind), note: b.note ?? null, progress: b.progress ?? null, nextGoal: b.next_goal ?? null,
      visibleToSeeker: b.visible_to_seeker !== false,
    });
    if (!r.ok) return res.status(r.reason === 'flag_off' ? 503 : 400).json({ ok: false, error: r.reason });
    res.json({ ok: true, id: r.id });
  });

  // ── 3) Teacher/Counsellor continuation ──────────────────────────────────────────────────────────────
  // Live capture for the stakeholder survey (today it POSTs to a route absent from the live backend → a
  // dead-end). Authed staff submit; observer_id is the actor.
  app.post('/api/journey-tail/observations', flagGate, requireAuth, async (req: Request, res: Response) => {
    if (!isStaff(req)) return res.status(403).json({ ok: false, error: 'staff_role_required' });
    const b = (req.body ?? {}) as Record<string, any>;
    const childId = s(b.child_id ?? b.childId, 64);
    if (!childId) return res.status(400).json({ ok: false, error: 'child_id_required' });
    const r = await recordStakeholderObservation(pool, {
      childId, observerId: actorId(req), observerType: s(b.observer_type ?? b.observerType),
      observerName: b.observer_name ?? b.observerName ?? null, observerEmail: actorEmail(req),
      organization: b.organization ?? null, period: b.period ?? null,
      academic: b.academic, emotional: b.emotional, social: b.social,
      overallRating: b.overall_rating ?? b.overallRating,
      strengths: b.strengths ?? null, concerns: b.concerns ?? b.areasOfConcern ?? null,
      recommendations: b.recommendations ?? null,
      followUpRequired: (b.follow_up_required ?? b.followUpRequired) === true,
      shareWithParent: (b.share_with_parent ?? b.shareWithParent) === true,
    });
    if (!r.ok) return res.status(r.reason === 'flag_off' ? 503 : 400).json({ ok: false, error: r.reason });
    res.json({ ok: true, id: r.id });
  });

  // Counsellor follow-up queue (downstream view) — staff-role gated.
  app.get('/api/journey-tail/counsellor/follow-up-queue', flagGate, requireAuth, async (req: Request, res: Response) => {
    if (!isStaff(req)) return res.status(403).json({ ok: false, error: 'staff_role_required' });
    try {
      const includeResolved = s(req.query.includeResolved) === 'true';
      res.json(await listFollowUpQueue(pool, { includeResolved }));
    } catch (err) { console.error('[journey-tail] follow-up queue read:', err); res.status(200).json({ ok: true, observations: [], available: false }); }
  });

  // Counsellor/staff transitions a follow-up (open → acknowledged → actioned → resolved).
  app.patch('/api/journey-tail/observations/:id/follow-up', flagGate, requireAuth, async (req: Request, res: Response) => {
    if (!isStaff(req)) return res.status(403).json({ ok: false, error: 'staff_role_required' });
    const r = await updateObservationFollowupStatus(pool, { observationId: s(req.params.id, 64), status: s((req.body ?? {}).status) });
    if (!r.ok) return res.status(r.reason === 'flag_off' ? 503 : 400).json({ ok: false, error: r.reason });
    if (!r.updated) return res.status(404).json({ ok: false, error: 'observation_not_found' });
    res.json({ ok: true, updated: true });
  });
}
