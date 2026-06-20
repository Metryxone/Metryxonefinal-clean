/**
 * PHASE 4.9 — Career Passport Foundation routes (additive, flag-gated, super-admin).
 *
 * Exposes the additive, read-only Career Passport Foundation engine behind the
 * `careerPassportFoundation` flag (env `FF_CAREER_PASSPORT_FOUNDATION`, default
 * OFF). Strictly additive: flag OFF => every route returns 503 `feature_disabled`
 * BEFORE any DB touch => byte-identical legacy behaviour (no schema, no read,
 * no write).
 *
 * The engine COMPOSES already-computed engine outputs (competency-runtime
 * getProfile, ei-profile-engine, the Phase-4.3 readiness aggregator) plus the
 * subject's career_seeker_profiles record and append-only history into SIX
 * passport components — it never recomputes a score and never fabricates a fact.
 *
 * DISTINCT from the EXISTING Career Passport (cp_* tables, flag `careerPassport`,
 * routes /api/passport/*, registerCareerPassportRoutes). This is a NEW base
 * (/api/career-passport/*), a NEW flag, a NEW register fn and a NEW append-only
 * table (career_passport_snapshots) — zero collision with that subsystem.
 *
 * Access control: `subject` is an OPERATOR-supplied identifier for any assessed
 * person (not the caller's identity), so every route is super-admin gated to
 * prevent IDOR — mirrors /api/career-simulation/* and /api/career-readiness/*.
 *
 * Routes (all requireAuth + requireSuperAdmin, flag-gated):
 *   GET  /api/career-passport/_meta/status          — lightweight flag probe
 *   GET  /api/career-passport/:subject/history       — append-only snapshot history
 *   GET  /api/career-passport/:subject/competency    — Competency Profile component
 *   GET  /api/career-passport/:subject/ei            — EI Profile component
 *   GET  /api/career-passport/:subject/profile       — Career Profile component
 *   GET  /api/career-passport/:subject/readiness     — Career Readiness component
 *   GET  /api/career-passport/:subject/achievements  — Achievements component
 *   GET  /api/career-passport/:subject/journey       — Career Journey component
 *   POST /api/career-passport/:subject/snapshot      — generate + persist (write)
 *   GET  /api/career-passport/:subject               — full composed passport
 *
 * GET is strictly read-only (NEVER triggers DDL — the engine probes the
 * competency-runtime schema before composing it; history uses a to_regclass
 * probe). The ONLY write path is POST /:subject/snapshot, which lazily ensures
 * the append-only schema behind the flag gate.
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCareerPassportFoundationEnabled } from '../config/feature-flags.js';
import {
  PASSPORT_GENERATOR_VERSION,
  generateCareerPassport,
  persistPassportSnapshot,
  listPassportHistory,
} from '../services/passport-generator.js';
import type { PassportSectionKey } from '../services/passport-profile.js';

export function registerCareerPassportFoundationRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF. The only
  // byte-identical-OFF state: the route exists but never reads/writes/DDLs.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCareerPassportFoundationEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'careerPassportFoundation' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: PASSPORT_GENERATOR_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[career-passport-foundation]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  /** Read one component out of the full composed passport. Read-only. */
  const section = (key: PassportSectionKey): RequestHandler =>
    wrap(async (req) => {
      const passport = await generateCareerPassport(pool, String(req.params.subject));
      return {
        subject_id: passport.subject_id,
        version: passport.version,
        generated_at: passport.generated_at,
        section: passport.sections[key],
      };
    });

  // ---- Lightweight flag-probe status (no DB touch) --------------------------
  // Literal path registered FIRST so the `/:subject` param handler can't swallow it.
  app.get(
    '/api/career-passport/_meta/status',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({
        ok: true,
        version: PASSPORT_GENERATOR_VERSION,
        enabled: true,
        flag: 'careerPassportFoundation',
      });
    },
  );

  // ---- Append-only snapshot history (read-only, to_regclass probe) ----------
  app.get(
    '/api/career-passport/:subject/history',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const limit = Number.parseInt(String(req.query.limit ?? '50'), 10);
      return listPassportHistory(pool, String(req.params.subject), Number.isFinite(limit) ? limit : 50);
    }),
  );

  // ---- Individual passport components (read-only) ---------------------------
  app.get('/api/career-passport/:subject/competency', gate, requireAuth, requireSuperAdmin, section('competency_profile'));
  app.get('/api/career-passport/:subject/ei', gate, requireAuth, requireSuperAdmin, section('ei_profile'));
  app.get('/api/career-passport/:subject/profile', gate, requireAuth, requireSuperAdmin, section('career_profile'));
  app.get('/api/career-passport/:subject/readiness', gate, requireAuth, requireSuperAdmin, section('career_readiness'));
  app.get('/api/career-passport/:subject/achievements', gate, requireAuth, requireSuperAdmin, section('achievements'));
  app.get('/api/career-passport/:subject/journey', gate, requireAuth, requireSuperAdmin, section('career_journey'));

  // ---- Generate + persist a passport snapshot (the ONLY write path) ---------
  app.post(
    '/api/career-passport/:subject/snapshot',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const passport = await generateCareerPassport(pool, String(req.params.subject));
      const row = await persistPassportSnapshot(pool, passport);
      return { snapshot: row, passport };
    }),
  );

  // ---- Full composed passport (read-only) -----------------------------------
  app.get(
    '/api/career-passport/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => generateCareerPassport(pool, String(req.params.subject))),
  );
}
