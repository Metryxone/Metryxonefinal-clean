/**
 * MX-302C — Career Launchpad telemetry route
 * ----------------------------------------------------------------------------
 * Flag-gated (careerLaunchpad / FF_CAREER_LAUNCHPAD). Default OFF → the route
 * 503s BEFORE any auth/DB touch, so flag-OFF is byte-identical (no audit row is
 * ever written; the dashboard itself is not rendered when the flag is OFF).
 *
 * This is the step-6 audit surface: it records that the Launchpad dashboard was
 * rendered and which widgets had data available — METADATA ONLY (counts + a
 * boolean availability map), never any user content or scores. It reuses the
 * shared, redacting platform-audit logger; it performs no metric computation.
 *
 * Security: requireAuth; the subject is the authenticated principal resolved
 * server-side (never a client-supplied id) — no IDOR surface.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isCareerLaunchpadEnabled } from '../config/feature-flags';
import { logAudit } from '../services/platform-audit';

type RequireAuth = (req: Request, res: Response, next: () => void) => void;

function selfId(req: Request): string | null {
  const u = (req as any).user;
  const id = u?.id ?? u?.userId ?? u?.user_id;
  return id != null ? String(id) : null;
}

export function registerCareerLaunchpadRoutes(app: Express, pool: Pool, requireAuth: RequireAuth): void {
  const BASE = '/api/career-launchpad';

  const gate = (_req: Request, res: Response, next: () => void) => {
    if (!isCareerLaunchpadEnabled()) {
      return res.status(503).json({ ok: false, enabled: false, message: 'Career Launchpad is not enabled.' });
    }
    next();
  };

  // Probe — intentionally NOT gated (cheap flag detection), mirrors MX-302B.
  app.get(`${BASE}/enabled`, (_req, res) => {
    res.json({ ok: true, enabled: isCareerLaunchpadEnabled() });
  });

  // Telemetry — metadata-only render/widget-availability audit.
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
    const event = typeof body.event === 'string' ? body.event.slice(0, 64) : 'dashboard_render';

    void logAudit(pool, req, {
      action: 'export',
      entityType: 'career_launchpad_dashboard',
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
