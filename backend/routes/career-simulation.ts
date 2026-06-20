/**
 * PHASE 4.8 — Career Simulation routes (additive, flag-gated, super-admin).
 *
 * Exposes the additive, read-only Career Simulation ("What-If Analysis") engine
 * behind the `careerSimulation` flag (env `FF_CAREER_SIMULATION`, default OFF).
 * Strictly additive: flag OFF => every route returns 503 `feature_disabled`
 * BEFORE any DB touch => byte-identical legacy behaviour (no schema, no read,
 * no write).
 *
 * The engine COMPOSES the canonical role readiness scorer (getRoleReadiness) and
 * the competency profile (getProfile) / trend engine (computeProfileTrends) to
 * answer "if capability X improves to level N, which roles become available?" —
 * it never recomputes a readiness score and never fabricates a level.
 *
 * Access control: `subject` is an OPERATOR-supplied identifier for any assessed
 * person (not the caller's identity), so every route is super-admin gated to
 * prevent IDOR — mirrors /api/career-gap/* and /api/career-readiness/*.
 *
 * Routes (all requireAuth + requireSuperAdmin, flag-gated):
 *   GET  /api/career-simulation/_meta/status            — lightweight flag probe
 *   GET  /api/career-simulation/:subject/history        — append-only run history (read-only)
 *   GET  /api/career-simulation/:subject/scenarios      — ranked preset scenario set
 *   GET  /api/career-simulation/:subject/projection     — forward trajectory projection
 *   GET  /api/career-simulation/:subject/trajectory     — projection-driven simulation
 *   POST /api/career-simulation/:subject/snapshot       — run a what-if + persist (write)
 *   GET  /api/career-simulation/:subject                — what-if (changes via query)
 *
 * Query-driven what-if (GET /:subject): read-only, no persist.
 *   ?set=dom_interpersonal:4,dom_cognitive:5   absolute target levels (1–5)
 *   ?delta=dom_behavioral:1,COMP_X:-1           relative deltas
 *   target may be an onto-domain (`dom_*`) or a competency_id (resolved to its domain).
 *
 * GET is strictly read-only (NEVER triggers DDL — the engine probes the
 * competency-runtime AND role-profile schemas before composing; history uses a
 * to_regclass probe). The ONLY write path is POST /:subject/snapshot, which
 * lazily ensures the append-only schema behind the flag gate.
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCareerSimulationEnabled } from '../config/feature-flags.js';
import {
  CAREER_SIMULATION_VERSION,
  buildCareerSimulation,
  type SimChange,
} from '../services/career-simulation-engine.js';
import { buildFutureProjection, simulateFutureTrajectory } from '../services/future-projection-engine.js';
import {
  buildScenarioSet,
  persistWhatIfRun,
  listSimulationHistory,
} from '../services/scenario-engine.js';

/** Parse `?set=`/`?delta=` query strings into SimChange[]. Never throws. */
function parseChanges(req: Request): SimChange[] {
  const changes: SimChange[] = [];
  const parsePairs = (raw: unknown, kind: 'set' | 'delta') => {
    if (typeof raw !== 'string' || !raw.trim()) return;
    for (const part of raw.split(',')) {
      const [target, valStr] = part.split(':');
      const t = String(target ?? '').trim();
      const v = Number(String(valStr ?? '').trim());
      if (!t || !Number.isFinite(v)) continue;
      if (kind === 'set') changes.push({ target: t, to_level: v });
      else changes.push({ target: t, delta: v });
    }
  };
  parsePairs(req.query.set, 'set');
  parsePairs(req.query.delta, 'delta');
  return changes;
}

/** Parse a JSON body { changes: [{target,to_level|delta}] }. Never throws. */
function parseBodyChanges(req: Request): SimChange[] {
  const body = req.body ?? {};
  const raw = Array.isArray(body.changes) ? body.changes : [];
  const out: SimChange[] = [];
  for (const c of raw) {
    const target = String(c?.target ?? '').trim();
    if (!target) continue;
    const change: SimChange = { target };
    if (c?.to_level != null && Number.isFinite(Number(c.to_level))) change.to_level = Number(c.to_level);
    if (c?.delta != null && Number.isFinite(Number(c.delta))) change.delta = Number(c.delta);
    out.push(change);
  }
  return out;
}

export function registerCareerSimulationEngineRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF. The only
  // byte-identical-OFF state: the route exists but never reads/writes/DDLs.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCareerSimulationEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'careerSimulation' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: CAREER_SIMULATION_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[career-simulation]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- Lightweight flag-probe status (no DB touch) ---------------------------
  // Literal path registered FIRST so the `/:subject` param handler can't swallow it.
  app.get(
    '/api/career-simulation/_meta/status',
    gate,
    requireAuth,
    requireSuperAdmin,
    (_req: Request, res: Response) => {
      res.json({ ok: true, version: CAREER_SIMULATION_VERSION, enabled: true, flag: 'careerSimulation' });
    },
  );

  // ---- Append-only run history (read-only, to_regclass probe) ----------------
  app.get(
    '/api/career-simulation/:subject/history',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const limit = Number.parseInt(String(req.query.limit ?? '50'), 10);
      return listSimulationHistory(pool, String(req.params.subject), Number.isFinite(limit) ? limit : 50);
    }),
  );

  // ---- Ranked preset scenario set (read-only) -------------------------------
  app.get(
    '/api/career-simulation/:subject/scenarios',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildScenarioSet(pool, String(req.params.subject))),
  );

  // ---- Forward trajectory simulation (projection-driven, read-only) ---------
  // Registered BEFORE `/:subject/projection` literal is not required (distinct
  // depth) but kept specific-first for clarity.
  app.get(
    '/api/career-simulation/:subject/trajectory',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const periods = Number.parseInt(String(req.query.periods ?? ''), 10);
      return simulateFutureTrajectory(pool, String(req.params.subject), Number.isFinite(periods) ? periods : undefined);
    }),
  );

  // ---- Forward trajectory projection (read-only) ----------------------------
  app.get(
    '/api/career-simulation/:subject/projection',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const periods = Number.parseInt(String(req.query.periods ?? ''), 10);
      return buildFutureProjection(pool, String(req.params.subject), Number.isFinite(periods) ? periods : undefined);
    }),
  );

  // ---- Run a what-if + persist (the ONLY write path) ------------------------
  app.post(
    '/api/career-simulation/:subject/snapshot',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => {
      const changes = parseBodyChanges(req);
      const env = await buildCareerSimulation(pool, String(req.params.subject), changes);
      const row = await persistWhatIfRun(pool, env);
      return { run: row, envelope: env };
    }),
  );

  // ---- Query-driven what-if envelope (read-only) ----------------------------
  app.get(
    '/api/career-simulation/:subject',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req) => buildCareerSimulation(pool, String(req.params.subject), parseChanges(req))),
  );
}
