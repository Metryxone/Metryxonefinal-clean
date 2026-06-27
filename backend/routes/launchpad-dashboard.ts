/**
 * MX-302C — Career Launchpad Dashboard (backend surface)
 * ----------------------------------------------------------------------------
 * Flag-gated (launchpadDashboard / FF_LAUNCHPAD_DASHBOARD). Default OFF → every
 * data route 503s BEFORE any auth/DB touch, so flag-OFF is byte-identical (no
 * row is read or written; the dashboard itself is gated by `careerLaunchpad`).
 *
 * The Career Launchpad Dashboard is a frontend-composition decision surface (15
 * widgets composed from already-existing metrics/engines). This adds the real
 * backend surface it was missing:
 *   - GET  /api/launchpad-dashboard/enabled   — persona-agnostic flag probe (ungated)
 *   - GET  /api/launchpad-dashboard/summary   — read-only widget-availability +
 *       placement-readiness checklist completion for the authenticated seeker
 *   - POST /api/launchpad-dashboard/telemetry — metadata-only render audit
 *
 * COMPOSE-NEVER-RECOMPUTE: the summary reads `career_seeker_profiles.data`
 * (to_regclass-probed) and derives the SAME deterministic readiness checklist the
 * dashboard renders — it computes no new score, runs NO DDL, and fabricates
 * nothing. Absent profile → honest nulls (null ≠ 0). Never throws.
 *
 * Security: requireAuth; the subject is the authenticated principal resolved
 * server-side (never a client-supplied id) — no IDOR surface.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isLaunchpadDashboardEnabled } from '../config/feature-flags';
import { logAudit } from '../services/platform-audit';

type RequireAuth = (req: Request, res: Response, next: () => void) => void;

/** Resolve the authenticated subject id (self only — never client-supplied). */
function selfId(req: Request): string | null {
  const u = (req as any).user;
  const id = u?.id ?? u?.userId ?? u?.user_id;
  return id != null ? String(id) : null;
}

/**
 * The placement-readiness checklist — mirrors the dashboard's
 * (CareerLaunchpadDashboard.readinessChecks) so the server reports the SAME
 * deterministic signals the toolkit renders. Derived from concrete profile
 * fields only; no score is fabricated.
 */
function readinessChecks(profile: any): Array<{ key: string; label: string; done: boolean; pts: number }> {
  const p = profile && typeof profile === 'object' ? profile : {};
  const drives = Array.isArray(p.drives) ? p.drives : [];
  const projects = Array.isArray(p.projects) ? p.projects : [];
  return [
    { key: 'photo',       label: 'Add a profile photo',           done: !!p.photo,                                       pts: 5 },
    { key: 'education',   label: 'Fill your education section',    done: Array.isArray(p.education) && p.education.length > 0, pts: 15 },
    { key: 'skills',      label: 'Add at least 2 skills',         done: ((p.skills?.technical) || []).length >= 2,        pts: 10 },
    { key: 'resume',      label: 'Build your resume',             done: !!p.resumeBuilt,                                  pts: 10 },
    { key: 'assessment',  label: 'Take the competency assessment',done: !!p.competencyProfile?.assessmentDone,            pts: 15 },
    { key: 'drives',      label: 'Track 1+ campus drive',         done: drives.length >= 1,                               pts: 10 },
    { key: 'projects',    label: 'Add 1+ project',                done: projects.length >= 1,                             pts: 15 },
    { key: 'goal',        label: 'Set a career goal',             done: !!p.targetRole,                                   pts: 10 },
    { key: 'linkedin',    label: 'Add your LinkedIn URL',         done: !!p.linkedin,                                     pts: 5 },
    { key: 'github',      label: 'Add your GitHub URL',           done: !!p.github,                                       pts: 5 },
  ];
}

/**
 * Widget-availability map — which of the dashboard widgets have underlying data
 * for this seeker. Honest booleans only; absent → false (the widget renders its
 * honest empty state on the client).
 */
function widgetAvailability(profile: any): Record<string, boolean> {
  const p = profile && typeof profile === 'object' ? profile : {};
  return {
    profile:      !!(p.education || p.skills || p.summary),
    skills:       ((p.skills?.technical) || []).length > 0,
    resume:       !!p.resumeBuilt,
    assessment:   !!p.competencyProfile?.assessmentDone,
    goal:         !!p.targetRole,
    projects:     Array.isArray(p.projects) && p.projects.length > 0,
    experience:   Array.isArray(p.experience) && p.experience.length > 0,
    links:        !!(p.linkedin || p.github),
  };
}

export function registerLaunchpadDashboardRoutes(app: Express, pool: Pool, requireAuth: RequireAuth): void {
  const BASE = '/api/launchpad-dashboard';

  /** Flag gate — 503 before any auth/DB touch when OFF (byte-identical legacy). */
  const gate = (_req: Request, res: Response, next: () => void) => {
    if (!isLaunchpadDashboardEnabled()) {
      return res.status(503).json({ ok: false, enabled: false, message: 'Launchpad Dashboard is not enabled.' });
    }
    next();
  };

  // ── Probe: enabled flag. Intentionally NOT gated — always 200 with
  // {enabled:false} when OFF so the frontend can cheaply detect the flag state.
  // DATA routes below are gate-protected and 503 when OFF (byte-identical). ──
  app.get(`${BASE}/enabled`, (_req, res) => {
    res.json({ ok: true, enabled: isLaunchpadDashboardEnabled() });
  });

  // ── Summary: read-only widget availability + readiness checklist completion.
  // Composes the authenticated seeker's real profile substrate; never throws,
  // never fabricates (absent profile → honest nulls). ──
  app.get(`${BASE}/summary`, gate, requireAuth, async (req, res) => {
    const uid = selfId(req);
    if (!uid) return res.status(401).json({ ok: false, message: 'Unauthorized' });

    try {
      // Probe the table exists before reading (no ensure-schema, no DDL).
      const reg = await pool.query("SELECT to_regclass('public.career_seeker_profiles') AS t");
      if (!reg.rows[0]?.t) {
        return res.json({
          ok: true,
          subject: uid,
          has_profile: false,
          readiness: null,
          widgets: null,
          note: 'No career profile substrate present — honest empty state.',
        });
      }

      const r = await pool.query(
        'SELECT data FROM career_seeker_profiles WHERE user_id = $1 LIMIT 1',
        [uid],
      );
      const data = r.rows[0]?.data ?? null;

      if (data == null) {
        return res.json({
          ok: true,
          subject: uid,
          has_profile: false,
          readiness: null,
          widgets: null,
          note: 'No profile for this user yet — null ≠ 0.',
        });
      }

      const checks = readinessChecks(data);
      const earned = checks.reduce((acc, c) => acc + (c.done ? c.pts : 0), 0);
      const possible = checks.reduce((acc, c) => acc + c.pts, 0);
      const percent = possible > 0 ? Math.round((earned / possible) * 100) : null;

      return res.json({
        ok: true,
        subject: uid,
        has_profile: true,
        readiness: {
          percent,
          earned_points: earned,
          possible_points: possible,
          completed: checks.filter((c) => c.done).length,
          total: checks.length,
          checks,
        },
        widgets: widgetAvailability(data),
      });
    } catch (e: any) {
      // Never throws — degrade to an honest-degraded payload.
      return res.json({
        ok: true,
        degraded: true,
        subject: uid,
        has_profile: null,
        readiness: null,
        widgets: null,
        note: 'Summary temporarily unavailable (degraded, not fabricated).',
      });
    }
  });

  // ── Telemetry: metadata-only render audit (counts + availability map). Never
  // any user content or scores. Reuses the shared redacting platform-audit logger. ──
  app.post(`${BASE}/telemetry`, gate, requireAuth, async (req, res) => {
    const uid = selfId(req);
    if (!uid) return res.status(401).json({ ok: false, message: 'Unauthorized' });

    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const availability = (body.widget_availability && typeof body.widget_availability === 'object')
      ? body.widget_availability as Record<string, unknown>
      : {};
    // Coerce to a clean boolean map + counts (never trust client cardinality blindly).
    const map: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(availability)) map[String(k)] = v === true;
    const widgetsTotal = Number(body.widgets_total) || Object.keys(map).length;
    const widgetsWithData = Object.values(map).filter(Boolean).length;
    const aiMode = body.ai_mode === 'llm' || body.ai_mode === 'rule_based' ? body.ai_mode : null;
    const event = typeof body.event === 'string' ? body.event.slice(0, 64) : 'launchpad_dashboard_render';

    void logAudit(pool, req, {
      action: 'export',
      entityType: 'launchpad_dashboard',
      entityId: uid,
      metadata: {
        event,
        widgets_total: widgetsTotal,
        widgets_with_data: widgetsWithData,
        ai_mode: aiMode,
        widget_availability: map,
      },
    });

    res.json({ ok: true, recorded: { widgets_total: widgetsTotal, widgets_with_data: widgetsWithData } });
  });
}
