/**
 * Dynamic Reporting Engine — Phase 1 S9
 * Route registration for the dynamic report endpoints.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { generateReport, upsertDynamicReport, type Persona } from '../services/dynamic-report';
import { isEnabled } from '../services/feature-flags';

type AuthMiddleware = (req: Request, res: Response, next: NextFunction) => void;

const VALID_PERSONAS: Persona[] = ['student', 'parent', 'teacher', 'counsellor'];

function resolvePersona(raw: unknown): Persona {
  const val = Array.isArray(raw) ? raw[0] : raw;
  const str = typeof val === 'string' ? val : undefined;
  return VALID_PERSONAS.includes(str as Persona) ? (str as Persona) : 'student';
}

export function registerDynamicReportRoutes(
  app:               Express,
  pool:              Pool,
  _requireAuth:      AuthMiddleware,
  requireSuperAdmin: AuthMiddleware
) {

  // ── POST /api/capadex/report/generate-dynamic ──────────────────────────────
  // Generates a dynamic report for a session and upserts the result into
  // capadex_reports.dynamic_report.
  // Requires super-admin — report generation is a system operation; consumers
  // of the completed report access it via the standard report endpoints.
  // Feature-flag gated (`dynamic_reporting`).
  app.post(
    '/api/capadex/report/generate-dynamic',
    requireSuperAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { session_id, persona } = req.body as { session_id?: string; persona?: string };

        if (!session_id || typeof session_id !== 'string') {
          return res.status(400).json({ error: 'session_id is required.' });
        }

        // Resolve tenant context for flag check — ensures tenant-specific overrides are respected.
        const { rows: sessionMeta } = await pool.query<{ tenant_id: string | null }>(
          `SELECT tenant_id FROM capadex_sessions WHERE id = $1 LIMIT 1`,
          [session_id]
        );
        const tenantId: string | undefined = sessionMeta[0]?.tenant_id ?? undefined;

        if (!isEnabled('dynamic_reporting', tenantId)) {
          return res.status(403).json({ error: 'Dynamic reporting feature is not enabled.' });
        }

        // Only pass persona override when explicitly supplied; otherwise let
        // generateReport derive it from session.persona so the correct
        // persona tone is used for non-student sessions.
        const resolvedPersona = persona ? resolvePersona(persona) : undefined;
        const report = await generateReport(pool, session_id, resolvedPersona);

        if (!report) {
          return res.status(404).json({ error: 'Session not found or report generation failed.' });
        }

        await upsertDynamicReport(pool, session_id, report);

        return res.json({ ok: true, report });
      } catch (err) {
        next(err);
      }
    }
  );

  // ── GET /api/admin/dynamic-report/:sessionId ───────────────────────────────
  // Returns the stored dynamic_report (or generates on-demand if absent).
  app.get(
    '/api/admin/dynamic-report/:sessionId',
    requireSuperAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = String(req.params.sessionId);
        const persona = resolvePersona(req.query.persona);

        // Return stored if present
        const { rows } = await pool.query<{ dynamic_report: DynamicReportJson | null }>(
          `SELECT dynamic_report FROM capadex_reports WHERE session_id = $1 LIMIT 1`,
          [sessionId]
        );

        if (rows[0]?.dynamic_report) {
          return res.json({ source: 'cached', report: rows[0].dynamic_report });
        }

        // Generate on-demand (ignores feature flag for admin access)
        const report = await generateReport(pool, sessionId, persona);
        if (!report) {
          return res.status(404).json({ error: 'Session not found or could not generate report.' });
        }

        await upsertDynamicReport(pool, sessionId, report);

        return res.json({ source: 'generated', report });
      } catch (err) {
        next(err);
      }
    }
  );

  // ── GET /api/admin/dynamic-report/templates ────────────────────────────────
  // Returns all insight templates for admin governance.
  app.get(
    '/api/admin/dynamic-report/templates',
    requireSuperAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const construct = Array.isArray(req.query.construct) ? req.query.construct[0] : req.query.construct;
        const band      = Array.isArray(req.query.band)      ? req.query.band[0]      : req.query.band;
        const persona   = Array.isArray(req.query.persona)   ? req.query.persona[0]   : req.query.persona;

        const conditions: string[] = [];
        const params: string[]     = [];

        if (construct) { conditions.push(`construct_key = $${params.length + 1}`); params.push(String(construct)); }
        if (band)      { conditions.push(`confidence_band = $${params.length + 1}`); params.push(String(band)); }
        if (persona)   { conditions.push(`persona = $${params.length + 1}`); params.push(String(persona)); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const { rows } = await pool.query(
          `SELECT id, construct_key, confidence_band, persona,
                  insight_text, why_generated, growth_opportunity, created_at
           FROM insight_templates
           ${where}
           ORDER BY construct_key, confidence_band, persona`,
          params
        );

        return res.json({ templates: rows, total: rows.length });
      } catch (err) {
        next(err);
      }
    }
  );
}

// Local helper type — matches what pg returns for a JSONB column
interface DynamicReportJson {
  [key: string]: unknown;
}
