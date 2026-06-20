/**
 * PHASE 4.2 — Career Match routes (additive, flag-gated, super-admin).
 *
 * Exposes the additive, read-only Career Match engine behind the `careerMatch`
 * flag (env `FF_CAREER_MATCH`, default OFF). Strictly additive: flag OFF => every
 * route returns 503 `feature_disabled` BEFORE any DB touch => byte-identical legacy
 * behaviour (no schema, no read, no write).
 *
 * The engine COMPOSES the already-built subject profiles (competency / EI /
 * Phase-4.3 readiness / role-readiness-v2 anchor fit) and RANKS the `cg_roles`
 * catalog into the subject's top role matches. It never recomputes an upstream
 * score and never fabricates a role, a number or a requirement. Match% and
 * Confidence are SEPARATE axes; non-anchor matches are honestly 'Provisional'.
 *
 * Access control: `subject` is an OPERATOR-supplied identifier for any assessed
 * person (not the caller's identity), so every route is super-admin gated to
 * prevent IDOR — mirrors /api/career-readiness/* and /api/career-gap/*.
 *
 * Routes (all requireAuth + requireSuperAdmin, flag-gated):
 *   GET  /api/career-match/_meta/status              — lightweight flag probe
 *   GET  /api/career-match/admin/rules               — config-as-data rules (db or defaults)
 *   POST /api/career-match/admin/rules               — upsert the active rules row (write)
 *   POST /api/career-match/admin/seed                — seed the rules table from defaults (write)
 *   GET  /api/career-match/:subject/history          — append-only snapshot history (read-only)
 *   GET  /api/career-match/:subject/dashboard        — UI-ready dashboard projection
 *   GET  /api/career-match/:subject/role/:roleId     — fit for ONE catalog role
 *   POST /api/career-match/:subject/snapshot         — capture an append-only snapshot (write)
 *   GET  /api/career-match/:subject                  — composed top-matches envelope
 *
 * GET is strictly read-only (NEVER triggers DDL — composition self-gates behind
 * competencyRuntimeReady(); config/history reads use to_regclass probes). The ONLY
 * write/DDL paths are the explicit POST snapshot and the admin rules CRUD / seed.
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCareerMatchEnabled } from '../config/feature-flags.js';
import {
  CAREER_MATCH_VERSION,
  buildCareerMatch,
  buildCareerMatchForRole,
  buildCareerMatchDashboard,
  getMatchingRules,
  upsertMatchingRules,
  seedCareerMatchDefaults,
  persistCareerMatchSnapshot,
  listCareerMatchHistory,
} from '../services/career-match-engine.js';

export function registerCareerMatchRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF. The only
  // byte-identical-OFF state: the route exists but never reads/writes/DDLs.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCareerMatchEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'careerMatch' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: CAREER_MATCH_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[career-match]', req.path, err?.message ?? err);
        if (!res.headersSent) {
          // Honor intended client (4xx) statuses (e.g. invalid_rules_body /
          // invalid_role_id); everything else degrades to a generic 500.
          const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 500
            ? err.status
            : 500;
          const error = status === 500 ? 'internal_error' : String(err?.message ?? 'bad_request');
          res.status(status).json({ ok: false, error });
        }
      }
    };

  // ---- Lightweight flag-probe status (no DB touch) --------------------------
  // Literal path registered FIRST so the `/:subject` param handler can't swallow it.
  app.get(
    '/api/career-match/_meta/status',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: CAREER_MATCH_VERSION, enabled: true, flag: 'careerMatch' });
    },
  );

  // ---- Config-as-data rules (read-only — to_regclass probe, defaults fallback) --
  app.get(
    '/api/career-match/admin/rules',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => getMatchingRules(pool)),
  );

  // ---- Upsert the active rules row (write path — ensures config schema) ------
  app.post(
    '/api/career-match/admin/rules',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (typeof body !== 'object' || Array.isArray(body)) {
        throw Object.assign(new Error('invalid_rules_body'), { status: 400 });
      }
      const rules = await upsertMatchingRules(pool, body as any);
      return { source: 'db', rules };
    }),
  );

  // ---- Seed the rules table from inline defaults (write path) ----------------
  app.post(
    '/api/career-match/admin/seed',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => seedCareerMatchDefaults(pool)),
  );

  // ---- Append-only snapshot history (read-only, to_regclass probe) -----------
  // Registered BEFORE `/:subject` (literal-before-param).
  app.get(
    '/api/career-match/:subject/history',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const limit = Number.parseInt(String(req.query.limit ?? '50'), 10);
      return listCareerMatchHistory(pool, String(req.params.subject), Number.isFinite(limit) ? limit : 50);
    }),
  );

  // ---- Dashboard projection (read-only) -------------------------------------
  app.get(
    '/api/career-match/:subject/dashboard',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const env = await buildCareerMatch(pool, String(req.params.subject));
      return buildCareerMatchDashboard(env);
    }),
  );

  // ---- Fit for ONE catalog role (read-only) ---------------------------------
  app.get(
    '/api/career-match/:subject/role/:roleId',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const roleId = Number.parseInt(String(req.params.roleId), 10);
      if (!Number.isFinite(roleId)) {
        throw Object.assign(new Error('invalid_role_id'), { status: 400 });
      }
      return buildCareerMatchForRole(pool, String(req.params.subject), roleId);
    }),
  );

  // ---- Capture an append-only snapshot (the ONLY subject write path) ---------
  app.post(
    '/api/career-match/:subject/snapshot',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const env = await buildCareerMatch(pool, String(req.params.subject));
      const row = await persistCareerMatchSnapshot(pool, env);
      return { snapshot: row, envelope: env };
    }),
  );

  // ---- Composed top-matches envelope (read-only) ----------------------------
  app.get(
    '/api/career-match/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildCareerMatch(pool, String(req.params.subject))),
  );
}
